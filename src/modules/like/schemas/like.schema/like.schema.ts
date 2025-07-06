import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type LikeDocument = Like & Document;

@Schema({ timestamps: true })
export class Like {
    @Prop({ type: Types.ObjectId, ref: 'User' })
    userId: Types.ObjectId;

    @Prop({ type: Types.ObjectId })
    targetId: Types.ObjectId;

    @Prop({ enum: ['Post', 'Comment'], required: true })
    targetType: string;
}

export const LikeSchema = SchemaFactory.createForClass(Like);
