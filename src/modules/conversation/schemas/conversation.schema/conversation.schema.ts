import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types, Schema as MongooseSchema } from 'mongoose';

export type ConversationDocument = Conversation & Document;

const LastMessageSchema = new MongooseSchema(
    {
        _id: { type: Types.ObjectId, ref: 'Message' },
        content: { type: String, default: '' },
        mediaUrls: { type: [String], default: [] },
        senderId: { type: Types.ObjectId, ref: 'User' },
        type: { type: String, enum: ['text', 'image', 'video', 'file', 'audio', 'system'], default: 'text' },
        sentAt: { type: Date, default: Date.now },
    },
    { _id: false }
);

const PinnedMessageSchema = new MongooseSchema(
    {
        messageId: { type: Types.ObjectId, ref: 'Message', required: true },
        content: { type: String, default: '' },
        pinnedBy: { type: Types.ObjectId, ref: 'User', required: false },
        pinnedAt: { type: Date, default: Date.now },
        sender: {
            id: { type: Types.ObjectId, ref: 'User', required: false },
            username: { type: String, default: '' },
            fullName: { type: String, default: '' },
            avatarUrl: { type: String, default: '' },
        },
    },
    { _id: false }
);

@Schema({ timestamps: true })
export class Conversation {
    @Prop({ type: [Types.ObjectId], ref: 'User' })
    participantIds: Types.ObjectId[];

    @Prop({ default: false })
    isGroup: boolean;

    @Prop()
    name?: string;

    @Prop({ default: "" })
    avatarUrl?: string;

    @Prop({ type: Types.ObjectId, ref: 'Message', required: false })
    lastMessageId?: Types.ObjectId;

    @Prop({ type: LastMessageSchema, default: null })
    lastMessage?: {
        _id?: Types.ObjectId;
        content?: string;
        mediaUrls?: string[];
        senderId?: Types.ObjectId;
        type?: string;
        sentAt?: Date;
    } | null;

    @Prop({ type: [PinnedMessageSchema], default: [] })
    pinnedMessages?: {
        messageId: Types.ObjectId;
        content?: string;
        pinnedBy?: Types.ObjectId;
        pinnedAt?: Date;
        sender?: { id?: Types.ObjectId; username?: string; fullName?: string; avatarUrl?: string };
    }[];

    @Prop({ type: String, default: 'default' })
    theme?: string;

    @Prop({ type: Types.ObjectId, ref: 'User' })
    createdBy: Types.ObjectId;
}

export const ConversationSchema = SchemaFactory.createForClass(Conversation);