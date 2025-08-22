import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { Message, MessageSchema } from "./schemas/message.schema/message.schema";
import { MessageController } from "./message.controller";
import { MessageService } from "./message.service";
import { Conversation, ConversationSchema } from "../conversation/schemas/conversation.schema/conversation.schema";
import { MessageGateway } from "./message.gateway";
import { JwtModule } from "@nestjs/jwt";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { CloudinaryModule } from "src/common/cloudinary/cloudinary.module";

@Module({
    imports: [
        ConfigModule,
        MongooseModule.forFeature([
            { name: Message.name, schema: MessageSchema },
            { name: Conversation.name, schema: ConversationSchema },
        ]),
        JwtModule.registerAsync({
            imports: [ConfigModule],
            useFactory: async (configService: ConfigService) => ({
                secret: configService.get<string>("JWT_SECRET"),
                signOptions: {
                    expiresIn: configService.get<string>("JWT_EXPIRES_IN") || "7d",
                },
            }),
            inject: [ConfigService],
        }),
        CloudinaryModule,
    ],
    controllers: [MessageController],
    providers: [MessageService, MessageGateway],
    exports: [MessageService],
})
export class MessageModule { }
