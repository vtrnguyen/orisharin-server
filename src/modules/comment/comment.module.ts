import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Comment, CommentSchema } from './schemas/comment.schema/comment.schema';
import { CommentController } from './comment.controller';
import { CommentService } from './comment.service';
import { CloudinaryModule } from 'src/common/cloudinary/cloudinary.module';
import { Post, PostSchema } from '../post/schemas/post.schema/post.schema';
import { NotificationModule } from '../notification/notification.module';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: Comment.name, schema: CommentSchema },
            { name: Post.name, schema: PostSchema },
        ]),
        CloudinaryModule,
        NotificationModule,
    ],
    controllers: [CommentController],
    providers: [CommentService],
    exports: [CommentService],
})
export class CommentModule { }
