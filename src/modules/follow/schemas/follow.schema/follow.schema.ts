import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type FollowDocument = Follow & Document;

@Schema({ timestamps: true })
export class Follow {
    @Prop({ type: Types.ObjectId, ref: 'User' })
    followerId: Types.ObjectId;

    @Prop({ type: Types.ObjectId, ref: 'User' })
    followingId: Types.ObjectId;
}

export const FollowSchema = SchemaFactory.createForClass(Follow);
