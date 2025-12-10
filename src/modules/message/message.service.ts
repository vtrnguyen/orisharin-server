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
        const mediaUrls: string[] = Array.isArray(messageData.mediaUrls) ? messageData.mediaUrls.slice() : [];
        const content = (messageData.content || '').toString();
        const providedType = (messageData as any).type as string | undefined;
        const createdIds: Types.ObjectId[] = [];
        const nowBase = messageData.sentAt ? new Date(messageData.sentAt).getTime() : Date.now();

        try {
            if (mediaUrls.length > 0) {
                for (let i = 0; i < mediaUrls.length; i++) {
                    const url = mediaUrls[i];
                    const inferred = providedType || this.inferTypeFromUrl(url);
                    const sentAt = new Date(nowBase + i);
                    const md: Partial<Message> = {
                        ...messageData,
                        content: '',
                        mediaUrls: [url],
                        type: inferred,
                        sentAt,
                    };
                    const created = await this.messageModel.create(md);
                    createdIds.push(created._id as Types.ObjectId);
                }

                if (content && content.trim() !== '') {
                    const sentAt = new Date(nowBase + mediaUrls.length);
                    const textType = providedType && providedType !== 'system' ? providedType : 'text';
                    const md: Partial<Message> = {
                        ...messageData,
                        content,
                        mediaUrls: [],
                        type: textType,
                        sentAt,
                    };
                    const created = await this.messageModel.create(md);
                    createdIds.push(created._id as Types.ObjectId);
                }
            } else {
                const singleType = providedType || (messageData.type || 'text');
                const md: Partial<Message> = {
                    ...messageData,
                    type: singleType,
                    sentAt: messageData.sentAt || new Date(),
                };
                const created = await this.messageModel.create(md);
                createdIds.push(created._id as Types.ObjectId);
            }

            const populated = await this.messageModel.find({ _id: { $in: createdIds } })
                .populate("senderId", "fullName username avatarUrl")
                .populate({ path: "reactions.userId", select: "fullName username avatarUrl" })
                .sort({ sentAt: 1 })
                .exec();

            const lastMsg = populated[populated.length - 1];
            if (lastMsg) {
                try {
                    const senderRef = (lastMsg.senderId && (lastMsg.senderId as any)._id)
                        ? (lastMsg.senderId as any)._id
                        : lastMsg.senderId;

                    await this.conversationModel.findByIdAndUpdate(
                        String(lastMsg.conversationId),
                        {
                            lastMessageId: lastMsg._id,
                            lastMessage: {
                                _id: lastMsg._id,
                                content: lastMsg.content || '',
                                mediaUrls: lastMsg.mediaUrls || [],
                                senderId: senderRef,
                                type: lastMsg.type || 'text',
                                sentAt: lastMsg.sentAt || new Date(),
                            }
                        },
                        { new: true }
                    ).exec();
                } catch (e) { }
            }

            return populated.length === 1 ? populated[0] : populated;
        } catch (error: any) {
            throw error;
        }
    }

    async revoke(messageId: string, userId: string, forAll: boolean = false) {
        try {
            const msg: any = await this.messageModel.findById(messageId).exec();
            if (!msg) return new ApiResponseDto(null, "message not found", false, "message not found");

            const msgSenderId = String((msg.senderId && (msg.senderId._id ? msg.senderId._id : msg.senderId)) ?? msg.senderId);
            if (!msg.senderId || msgSenderId !== String(userId)) {
                return new ApiResponseDto(null, "unauthorized", false, "you are not the sender");
            }

            if (forAll) {
                const updatedMsg = await this.messageModel.findByIdAndUpdate(
                    messageId,
                    { $set: { isHideAll: true }, $unset: { hideForUsers: "" } },
                    { new: true }
                ).exec();

                try {
                    const convId = String(msg.conversationId);
                    if (updatedMsg) {
                        const senderRef = (updatedMsg.senderId && (updatedMsg.senderId as any)._id)
                            ? (updatedMsg.senderId as any)._id
                            : updatedMsg.senderId;

                        await this.conversationModel.findByIdAndUpdate(convId, {
                            lastMessageId: updatedMsg._id,
                            lastMessage: {
                                _id: updatedMsg._id,
                                content: 'Đã thu hồi một tin nhắn',
                                mediaUrls: updatedMsg.mediaUrls || [],
                                senderId: senderRef,
                                type: updatedMsg.type || 'text',
                                sentAt: updatedMsg.sentAt || new Date(),
                                isHideAll: true
                            }
                        }).exec();
                    }
                } catch (e) { }

                return new ApiResponseDto({ id: messageId, conversationId: String(msg.conversationId), forAll: true }, "message hidden for all", true);
            } else {
                await this.messageModel.findByIdAndUpdate(
                    messageId,
                    { $addToSet: { hideForUsers: new Types.ObjectId(userId) }, $set: { isHideAll: false } },
                    { new: true }
                ).exec();

                return new ApiResponseDto({ id: messageId, conversationId: String(msg.conversationId), hiddenForUserId: userId }, "message hidden for user", true);
            }
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

    private inferTypeFromUrl(url: string): 'image' | 'video' | 'audio' | 'file' {
        const imgExt = /\.(jpg|jpeg|png|gif|webp|svg)(\?.*)?$/i;
        const videoExt = /\.(mp4|webm|ogg|mov|avi|mkv)(\?.*)?$/i;
        const audioExt = /\.(mp3|wav|aac|m4a|ogg)(\?.*)?$/i;

        if (videoExt.test(url)) return 'video';
        if (imgExt.test(url)) return 'image';
        if (audioExt.test(url)) return 'audio';
        return 'file';
    }
}
