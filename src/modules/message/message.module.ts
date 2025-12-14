import { forwardRef, Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import { Message, MessageSchema } from "./schemas/message.schema/message.schema";
import { MessageController } from "./message.controller";
import { MessageService } from "./message.service";
import { Conversation, ConversationSchema } from "../conversation/schemas/conversation.schema/conversation.schema";
import { MessageGateway } from "./message.gateway";
import { JwtModule } from "@nestjs/jwt";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { CloudinaryModule } from "src/common/cloudinary/cloudinary.module";
import { ConversationModule } from "../conversation/conversation.module";
import { User, UserSchema } from "../user/schemas/user.schema/user.schema";
import { UserModule } from "../user/user.module";

@Module({
    imports: [
        ConfigModule,
        MongooseModule.forFeature([
            { name: Message.name, schema: MessageSchema },
            { name: Conversation.name, schema: ConversationSchema },
            { name: User.name, schema: UserSchema },
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
        forwardRef(() => ConversationModule),
        CloudinaryModule,
        UserModule,
    ],
    controllers: [MessageController],
    providers: [MessageService, MessageGateway],
    exports: [MessageService, MessageGateway],
})
export class MessageModule { }
