import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Conversation, ConversationDocument } from './schemas/conversation.schema/conversation.schema';

@Injectable()
export class ConversationService {
    constructor(
        @InjectModel(Conversation.name)
        private readonly conversationModel: Model<ConversationDocument>,
    ) { }

    async create(conversationData: Partial<Conversation>) {
        return this.conversationModel.create(conversationData);
    }

    async findByUser(userId: string) {
        return this.conversationModel.find({ participantIds: userId }).exec();
    }

    async findById(id: string) {
        return this.conversationModel.findById(id).exec();
    }
}
