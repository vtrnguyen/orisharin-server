import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Like, LikeDocument } from './schemas/like.schema/like.schema';
import { Post, PostDocument } from '../post/schemas/post.schema/post.schema';
import { Comment, CommentDocument } from '../comment/schemas/comment.schema/comment.schema';
import { LikeTargetType } from 'src/common/enums/like-target-type.enum';

@Injectable()
export class LikeService {
    constructor(
        @InjectModel(Like.name)
        private readonly likeModel: Model<LikeDocument>,
        @InjectModel(Post.name)
        private readonly postModel: Model<PostDocument>,
        @InjectModel(Comment.name)
        private readonly commentModel: Model<CommentDocument>,
    ) { }

    async like(userId: string, targetId: string, type: LikeTargetType) {
        if (type === LikeTargetType.Post) {
            const post = await this.postModel.exists({ _id: targetId });
            if (!post) throw new NotFoundException('Post not found');
        } else if (type === LikeTargetType.Comment) {
            const comment = await this.commentModel.exists({ _id: targetId });
            if (!comment) throw new NotFoundException('Comment not found');
        } else {
            throw new BadRequestException('Invalid like type');
        }

        const existed = await this.likeModel.findOne({ userId, targetId, targetType: type });
        if (existed) throw new BadRequestException('Already liked');
        return this.likeModel.create({ userId, targetId, targetType: type });
    }

    async unlike(userId: string, targetId: string, type: LikeTargetType) {
        return this.likeModel.deleteOne({ userId, targetId, targetType: type }).exec();
    }

    async getLikes(targetId: string, type: LikeTargetType, userId?: string) {
        const likes = await this.likeModel.find({ targetId, targetType: type }).exec();
        const likedByUser = userId
            ? await this.likeModel.exists({ targetId, targetType: type, userId })
            : false;
        return {
            count: likes.length,
            likedByUser: !!likedByUser,
            likes,
        };
    }
}