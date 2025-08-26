import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Conversation, ConversationSchema } from './schemas/conversation.schema/conversation.schema';
import { ConversationController } from './conversation.controller';
import { ConversationService } from './conversation.service';
import { User, UserSchema } from '../user/schemas/user.schema/user.schema';
import { CloudinaryModule } from 'src/common/cloudinary/cloudinary.module';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: Conversation.name, schema: ConversationSchema },
            { name: User.name, schema: UserSchema },
        ]),
        CloudinaryModule,
    ],
    controllers: [ConversationController],
    providers: [ConversationService],
    exports: [ConversationService],
})
export class ConversationModule { }
