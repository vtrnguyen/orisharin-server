import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type NotificationDocument = Notification & Document;

@Schema({ timestamps: true })
export class Notification {
    @Prop({ type: Types.ObjectId, ref: 'User' })
    recipientId: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: 'User' })
    fromUserId: Types.ObjectId;

    @Prop({ enum: ['like', 'comment', 'follow', 'repost', 'message', 'call'], required: true })
    type: string;

    @Prop({ type: Types.ObjectId })
    postId?: Types.ObjectId;

    @Prop({ type: Types.ObjectId })
    commentId?: Types.ObjectId;

    @Prop({ type: Types.ObjectId })
    messageId?: Types.ObjectId;

    @Prop({ default: false })
    isRead: boolean;
}

export const NotificationSchema = SchemaFactory.createForClass(Notification);
