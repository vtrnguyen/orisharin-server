import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type UserDocument = User & Document;

@Schema({ timestamps: true })
export class User {
    @Prop({ type: Types.ObjectId, ref: 'Account', required: true })
    accountId: Types.ObjectId;

    @Prop({ required: true, unique: true })
    username: string;

    @Prop({ required: true, unique: true })
    fullName: string;

    @Prop()
    displayName: string;

    @Prop()
    avatarUrl: string;

    @Prop()
    bio: string;

    @Prop({ type: [String], default: [] })
    websiteLinks: string[];

    @Prop({ default: false })
    isVerified: boolean;

    @Prop({ default: 0 })
    followersCount: number;

    @Prop({ default: 0 })
    followingCount: number;
}

export const UserSchema = SchemaFactory.createForClass(User);
