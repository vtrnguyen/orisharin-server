import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ConversationDocument = Conversation & Document;

@Schema({ timestamps: true })
export class Conversation {
    @Prop({ type: [Types.ObjectId], ref: 'User' })
    participantIds: Types.ObjectId[];

    @Prop({ default: false })
    isGroup: boolean;

    @Prop()
    name?: string;

    @Prop({ type: Types.ObjectId, ref: 'User' })
    createdBy: Types.ObjectId;
}

export const ConversationSchema = SchemaFactory.createForClass(Conversation);
