import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { Message, MessageDocument } from "./schemas/message.schema/message.schema";
import { Conversation, ConversationDocument } from "../conversation/schemas/conversation.schema/conversation.schema";
import { ApiResponseDto } from "src/common/dtos/api-response.dto";
import { CloudinaryService } from "src/common/cloudinary/cloudinary.service";
import { Reaction } from "src/common/enums/reaction.enum";
import { extractCloudinaryPublicId } from "src/common/functions/extract-cloudinary-public-id";

@Injectable()
export class MessageService {
    constructor(
        @InjectModel(Message.name)
        private readonly messageModel: Model<MessageDocument>,
        @InjectModel(Conversation.name)
        private readonly conversationModel: Model<ConversationDocument>,
        private cloudinaryService: CloudinaryService
    ) { }

    async create(messageData: Partial<Message>) {
        const message = await this.messageModel.create(messageData);

        // Populate sender info for realtime broadcast
        const populatedMessage = await this.messageModel
            .findById(message._id)
            .populate("senderId", "fullName username avatarUrl")
            .populate({ path: "reactions.userId", select: "fullName username avatarUrl" })
            .exec();

        try {
            if (populatedMessage) {
                const senderRef = (populatedMessage.senderId && (populatedMessage.senderId as any)._id)
                    ? (populatedMessage.senderId as any)._id
                    : populatedMessage.senderId;

                await this.conversationModel.findByIdAndUpdate(
                    String(populatedMessage.conversationId),
                    {
                        lastMessageId: populatedMessage._id,
                        lastMessage: {
                            _id: populatedMessage._id,
                            content: populatedMessage.content || '',
                            mediaUrls: populatedMessage.mediaUrls || [],
                            senderId: senderRef,
                            type: populatedMessage.type || 'text',
                            sentAt: populatedMessage.sentAt || new Date(),
                        }
                    },
                    { new: true },
                ).exec();
            }
        } catch (error: any) { }

        return populatedMessage;
    }

    async revoke(messageId: string, userId: string) {
        try {
            const msg: any = await this.messageModel.findById(messageId).exec();
            if (!msg) return new ApiResponseDto(null, "message not found", false, "message not found");

            const msgObjectId = new Types.ObjectId(msg.senderId);
            if (!msg.senderId || msgObjectId.toString() !== userId) return new ApiResponseDto(null, "unauthorized", false, "you are not the sender");

            const mediaUrls: string[] = Array.isArray(msg.mediaUrls) ? msg.mediaUrls.slice() : [];
            const publicIds: string[] = [];
            for (const url of mediaUrls) {
                const pid = extractCloudinaryPublicId(url);
                if (pid) publicIds.push(pid);
            }

            if (publicIds.length > 0) {
                await Promise.allSettled(publicIds.map(pid => this.cloudinaryService.deleteImage(pid)));
            }

            await this.messageModel.findByIdAndDelete(messageId).exec();

            return new ApiResponseDto({ id: messageId, conversationId: String(msg.conversationId) }, "message deleted", true);
        } catch (error: any) {
            return new ApiResponseDto(null, error.message || "delete failed", false, "delete failed");
        }
    }

    async react(messageId: string, userId: string, type: string) {
        try {
            const allowedTypes = Object.values(Reaction);
            if (!allowedTypes.includes(type as Reaction)) {
                return new ApiResponseDto(null, "invalid reaction", false, "invalid reaction");
            }

            const msg: any = await this.messageModel.findById(messageId).exec();
            if (!msg) return new ApiResponseDto(null, "message not found", false, "message not found");

            // verify participant
            const conv = await this.conversationModel.findById(msg.conversationId).exec();
            if (!conv || !conv.participantIds.map((p: any) => String(p)).includes(String(userId))) {
                return new ApiResponseDto(null, "unauthorized", false, "You are not a participant");
            }

            const existing = (msg.reactions || []).find((r: any) => String(r.userId) === String(userId));

            if (existing && existing.type === type) {
                // remove reaction
                await this.messageModel.findByIdAndUpdate(
                    messageId,
                    { $pull: { reactions: { userId: new Types.ObjectId(userId) } }, $inc: { [`reactionsCount.${type}`]: -1 } },
                    { new: true }
                ).exec();

                const updated = await this.messageModel.findById(messageId)
                    .populate("senderId", "fullName username avatarUrl")
                    .populate({ path: "reactions.userId", select: "fullName username avatarUrl" })
                    .exec();

                return new ApiResponseDto({ message: updated, action: 'removed', type }, "reaction removed", true);
            }

            if (existing && existing.type !== type) {
                // change reaction
                const from = existing.type;
                await this.messageModel.findOneAndUpdate(
                    { _id: messageId, 'reactions.userId': new Types.ObjectId(userId) },
                    { $set: { 'reactions.$.type': type }, $inc: { [`reactionsCount.${type}`]: 1, [`reactionsCount.${from}`]: -1 } },
                    { new: true }
                ).exec();

                const updated = await this.messageModel.findById(messageId)
                    .populate("senderId", "fullName username avatarUrl")
                    .populate({ path: "reactions.userId", select: "fullName username avatarUrl" })
                    .exec();

                return new ApiResponseDto({ message: updated, action: 'changed', from, to: type }, "reaction changed", true);
            }

            // add new reaction
            await this.messageModel.findByIdAndUpdate(
                messageId,
                { $push: { reactions: { userId: new Types.ObjectId(userId), type } }, $inc: { [`reactionsCount.${type}`]: 1 } },
                { new: true }
            ).exec();

            const updated = await this.messageModel.findById(messageId)
                .populate("senderId", "fullName username avatarUrl")
                .populate({ path: "reactions.userId", select: "fullName username avatarUrl" })
                .exec();

            return new ApiResponseDto({ message: updated, action: 'added', type }, "reaction added", true);
        } catch (error: any) {
            return new ApiResponseDto(null, error.message || "reaction failed", false, "reaction failed");
        }
    }

    async findByConversationPaginated(
        conversationId: string,
        page: number = 1,
        limit: number = 20
    ) {
        let convId: Types.ObjectId;
        try {
            convId = new Types.ObjectId(conversationId);
        } catch (e) {
            return new ApiResponseDto(
                {
                    messages: [],
                    hasMore: false,
                    total: 0,
                    page,
                    limit
                },
                "Invalid conversation id",
                false,
                "Invalid conversation id"
            );
        }

        const skip = (page - 1) * limit;

        const messages = await this.messageModel
            .find({ conversationId: convId })
            .populate("senderId", "fullName username avatarUrl")
            .populate({ path: "reactions.userId", select: "fullName username avatarUrl" })
            .sort({ sentAt: -1 })
            .skip(skip)
            .limit(limit)
            .exec();

        const total = await this.messageModel.countDocuments({ conversationId: convId });
        const hasMore = skip + messages.length < total;

        const payload = {
            messages: messages.reverse(),
            hasMore,
            total,
            page,
            limit
        };

        return new ApiResponseDto(payload, "Get messages successfully", true);
    }

    async findById(id: string) {
        return this.messageModel.findById(id).exec();
    }

    async isParticipant(conversationId: string, userId: string) {
        const conv = await this.conversationModel.findById(conversationId).exec();
        if (!conv) return false;
        return conv.participantIds.map(id => id.toString()).includes(userId);
    }

    async getParticipants(conversationId: string) {
        const conv = await this.conversationModel.findById(conversationId).exec();
        return conv ? conv.participantIds : [];
    }

    async markAsRead(messageId: string, userId: string) {
        return this.messageModel.findByIdAndUpdate(
            messageId,
            { $addToSet: { seenBy: userId } },
            { new: true }
        ).exec();
    }

    async markConversationAsRead(conversationId: string, userId: string) {
        return this.messageModel.updateMany(
            {
                conversationId,
                seenBy: { $ne: userId }
            },
            { $addToSet: { seenBy: userId } }
        ).exec();
    }
}
