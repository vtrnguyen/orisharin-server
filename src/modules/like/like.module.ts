import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Like, LikeSchema } from './schemas/like.schema/like.schema';
import { LikeController } from './like.controller';
import { LikeService } from './like.service';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: Like.name, schema: LikeSchema },
        ]),
    ],
    controllers: [LikeController],
    providers: [LikeService],
    exports: [LikeService],
})
export class LikeModule { }
