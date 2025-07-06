import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type CommentDocument = Comment & Document;

@Schema({ timestamps: true })
export class Comment {
    @Prop({ type: Types.ObjectId, ref: 'Post', required: true })
    postId: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: 'User', required: true })
    authorId: Types.ObjectId;

    @Prop()
    content: string;

    @Prop({ type: Types.ObjectId, ref: 'Comment' })
    parentCommentId?: Types.ObjectId;

    @Prop({ default: 0 })
    likesCount: number;

    @Prop({ default: false })
    isDeleted: boolean;
}

export const CommentSchema = SchemaFactory.createForClass(Comment);
