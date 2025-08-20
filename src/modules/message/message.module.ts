import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Message, MessageSchema } from './schemas/message.schema/message.schema';
import { MessageController } from './message.controller';
import { MessageService } from './message.service';
import { Conversation, ConversationSchema } from '../conversation/schemas/conversation.schema/conversation.schema';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: Message.name, schema: MessageSchema },
            { name: Conversation.name, schema: ConversationSchema },
        ]),
    ],
    controllers: [MessageController],
    providers: [MessageService],
    exports: [MessageService],
})
export class MessageModule { }
