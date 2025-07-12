import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Like, LikeSchema } from './schemas/like.schema/like.schema';
import { LikeController } from './like.controller';
import { LikeService } from './like.service';
import { Post, PostSchema } from '../post/schemas/post.schema/post.schema';
import { Comment, CommentSchema } from '../comment/schemas/comment.schema/comment.schema';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: Like.name, schema: LikeSchema },
            { name: Post.name, schema: PostSchema },
            { name: Comment.name, schema: CommentSchema },
        ]),
    ],
    controllers: [LikeController],
    providers: [LikeService],
    exports: [LikeService],
})
export class LikeModule { }
