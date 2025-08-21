import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Message, MessageSchema } from './schemas/message.schema/message.schema';
import { MessageController } from './message.controller';
import { MessageService } from './message.service';
import { Conversation, ConversationSchema } from '../conversation/schemas/conversation.schema/conversation.schema';
import { MessageGateway } from './message.gateway';
import { JwtModule } from '@nestjs/jwt';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: Message.name, schema: MessageSchema },
            { name: Conversation.name, schema: ConversationSchema },
        ]),
        JwtModule.register({
            secret: process.env.JWT_SECRET || 'replace_with_real_secret',
            signOptions: { expiresIn: '7d' },
        }),
    ],
    controllers: [MessageController],
    providers: [MessageService, MessageGateway],
    exports: [MessageService],
})
export class MessageModule { }
