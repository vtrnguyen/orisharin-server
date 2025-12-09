import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';
import { Reaction } from 'src/common/enums/reaction.enum';

export type MessageDocument = Message & Document;

const ReactionSchema = new MongooseSchema(
    {
        userId: { type: Types.ObjectId, ref: 'User', required: true },
        type: { type: String, enum: Object.values(Reaction), required: true },
    },
    { _id: false }
);

const UpdateMessageSchema = new MongooseSchema(
    {
        updatedAt: { type: Date, required: true, default: Date.now },
        content: { type: String, default: '' },
        mediaUrls: { type: [String], default: [] },
        editedBy: { type: Types.ObjectId, ref: 'User', required: false },
    },
    { _id: false }
);

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

    @Prop({ type: [ReactionSchema], default: [] })
    reactions?: { userId: Types.ObjectId; type: string }[];

    @Prop({ type: Map, of: Number, default: {} })
    reactionsCount?: Map<string, number>;

    @Prop({ type: String, enum: ['text', 'image', 'video', 'file', 'audio', 'system'], default: 'text' })
    type?: string;

    @Prop({ type: [Types.ObjectId], ref: 'User', default: [] })
    hideForUsers?: Types.ObjectId[];

    @Prop({ type: Boolean, default: false })
    isHideAll?: boolean;

    @Prop({ type: [Types.ObjectId], ref: 'User', default: [] })
    userTagIds?: Types.ObjectId[];

    @Prop({ type: [UpdateMessageSchema], default: [] })
    updateMessages?: { updatedAt: Date; content?: string; mediaUrls?: string[]; editedBy?: Types.ObjectId }[];

    @Prop({ type: Boolean, default: false })
    isPinned?: boolean;

    @Prop({ type: Types.ObjectId, ref: 'Message', required: false })
    messageReply?: Types.ObjectId;

    @Prop({ default: Date.now })
    sentAt: Date;
}

export const MessageSchema = SchemaFactory.createForClass(Message);