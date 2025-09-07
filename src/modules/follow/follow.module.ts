import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { FollowController } from './follow.controller';
import { FollowService } from './follow.service';
import { Follow, FollowSchema } from './schemas/follow.schema/follow.schema';
import { User, UserSchema } from '../user/schemas/user.schema/user.schema';
import { NotificationModule } from '../notification/notification.module';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: Follow.name, schema: FollowSchema },
            { name: User.name, schema: UserSchema }
        ]),
        NotificationModule,
    ],
    controllers: [FollowController],
    providers: [FollowService],
    exports: [FollowService],
})
export class FollowModule { }
