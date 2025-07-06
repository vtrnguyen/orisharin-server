import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Message, MessageDocument } from './schemas/message.schema/message.schema';

@Injectable()
export class MessageService {
    constructor(
        @InjectModel(Message.name)
        private readonly messageModel: Model<MessageDocument>,
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
}