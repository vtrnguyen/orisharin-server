import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from './schemas/user.schema/user.schema';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { IdValidationPipe } from 'common/pipes/id-validation.pipe';
import { CloudinaryModule } from 'src/common/cloudinary/cloudinary.module';
import { Follow, FollowSchema } from '../follow/schemas/follow.schema/follow.schema';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: User.name, schema: UserSchema },
            { name: Follow.name, schema: FollowSchema },
        ]),
        CloudinaryModule,
    ],
    controllers: [UserController],
    providers: [UserService, IdValidationPipe],
    exports: [UserService],
})
export class UserModule { }
