import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Post, PostSchema } from './schemas/post.schema/post.schema';
import { PostController } from './post.controller';
import { PostService } from './post.service';
import { CloudinaryModule } from 'src/common/cloudinary/cloudinary.module';
import { User, UserSchema } from '../user/schemas/user.schema/user.schema';
import { Comment, CommentSchema } from '../comment/schemas/comment.schema/comment.schema';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: Post.name, schema: PostSchema },
            { name: User.name, schema: UserSchema },
            { name: Comment.name, schema: CommentSchema }
        ]),
        CloudinaryModule,
    ],
    controllers: [PostController],
    providers: [PostService],
    exports: [PostService],
})
export class PostModule { }
