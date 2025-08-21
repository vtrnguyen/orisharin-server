import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model, Types } from "mongoose";
import { Message, MessageDocument } from "./schemas/message.schema/message.schema";
import { Conversation, ConversationDocument } from "../conversation/schemas/conversation.schema/conversation.schema";
import { ApiResponseDto } from "src/common/dtos/api-response.dto";

@Injectable()
export class MessageService {
    constructor(
        @InjectModel(Message.name)
        private readonly messageModel: Model<MessageDocument>,
        @InjectModel(Conversation.name)
        private readonly conversationModel: Model<ConversationDocument>,
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
}
