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

    @Prop({ default: Date.now })
    sentAt: Date;
}

export const MessageSchema = SchemaFactory.createForClass(Message);