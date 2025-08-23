import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { Message, MessageDocument } from "./schemas/message.schema/message.schema";
import { Conversation, ConversationDocument } from "../conversation/schemas/conversation.schema/conversation.schema";
import { ApiResponseDto } from "src/common/dtos/api-response.dto";
import { CloudinaryService } from "src/common/cloudinary/cloudinary.service";

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
            .exec();

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
                const pid = this.extractCloudinaryPublicId(url);
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

    private extractCloudinaryPublicId(url?: string): string | null {
        if (!url) return null;
        try {
            const re = /\/upload\/(?:.*\/)?v\d+\/(.+?)\.(?:jpg|jpeg|png|gif|mp4|webm|mov|svg|webp|bmp|tiff|heic|heif)(?:\?|$)/i;
            const m = url.match(re);
            if (m && m[1]) return m[1];

            const re2 = /\/upload\/(.+?)\.(?:jpg|jpeg|png|gif|mp4|webm|mov|svg|webp|bmp|tiff|heic|heif)(?:\?|$)/i;
            const m2 = url.match(re2);
            if (m2 && m2[1]) {
                let id = m2[1];
                const parts = id.split('/');
                if (parts.length > 1 && (/[,]|^c_|^w_|^h_|^g_/.test(parts[0]))) {
                    while (parts.length > 1 && (/[,]|^c_|^w_|^h_|^g_/.test(parts[0]))) {
                        parts.shift();
                    }
                }
                return parts.join('/');
            }
        } catch (e) {
        }
        return null;
    }
}
