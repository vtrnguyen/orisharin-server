import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type AccountDocument = Account & Document;

@Schema({ timestamps: true })
export class Account {
    @Prop({ required: true, unique: true })
    email: string;

    @Prop()
    password: string;

    @Prop({ default: 'local' })
    provider: 'local' | 'google' | 'facebook';

    @Prop({ default: 'user' })
    role: 'user' | 'admin';

    @Prop({ default: true })
    isActive: boolean;

    @Prop({ default: false })
    isBanned: boolean;
}

export const AccountSchema = SchemaFactory.createForClass(Account);
