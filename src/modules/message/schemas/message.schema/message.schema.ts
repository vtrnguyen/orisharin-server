import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type MessageDocument = Message & Document;

@Schema({ timestamps: false })
export class Message {
    @Prop({ type: Types.ObjectId, ref: 'Conversation', required: true })
    conversationId: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: 'User', required: true })
    senderId: Types.ObjectId;

    @Prop()
    content?: string;

    @Prop({ type: [String], default: [] })
    mediaUrls?: string[];

    @Prop({ type: [Types.ObjectId], ref: 'User', default: [] })
    seenBy: Types.ObjectId[];

    @Prop({ default: Date.now })
    sentAt: Date;
}

export const MessageSchema = SchemaFactory.createForClass(Message);
