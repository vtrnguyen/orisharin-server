import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Message, MessageDocument } from './schemas/message.schema/message.schema';
import { Conversation, ConversationDocument } from '../conversation/schemas/conversation.schema/conversation.schema';

@Injectable()
export class MessageService {
    constructor(
        @InjectModel(Message.name)
        private readonly messageModel: Model<MessageDocument>,
        @InjectModel(Conversation.name)
        private readonly conversationModel: Model<ConversationDocument>,
    ) { }

    async create(messageData: Partial<Message>) {
        return this.messageModel.create(messageData);
    }

    async findByConversation(conversationId: string) {
        return this.messageModel.find({ conversationId }).populate('senderId').exec();
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
}