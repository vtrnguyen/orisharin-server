import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type PostDocument = Post & Document;

@Schema({ timestamps: true })
export class Post {
    @Prop({ type: Types.ObjectId, ref: 'User', required: true })
    authorId: Types.ObjectId;

    @Prop()
    content: string;

    @Prop({ type: [String], default: [] })
    mediaUrls: string[];

    @Prop({ type: Types.ObjectId, ref: 'Post' })
    originalPostId?: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: 'Post' })
    sharedFromPostId?: Types.ObjectId;

    @Prop({ enum: ['public', 'followers', 'private'], default: 'public' })
    privacy: string;

    @Prop({ default: 0 })
    likesCount: number;

    @Prop({ default: 0 })
    commentsCount: number;

    @Prop({ default: 0 })
    repostsCount: number;

    @Prop({ default: 0 })
    sharesCount: number;

    @Prop({ default: false })
    isDeleted: boolean;
}

export const PostSchema = SchemaFactory.createForClass(Post);
