import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Like, LikeDocument } from './schemas/like.schema/like.schema';
import { Post, PostDocument } from '../post/schemas/post.schema/post.schema';
import { Comment, CommentDocument } from '../comment/schemas/comment.schema/comment.schema';
import { LikeTargetType } from 'src/common/enums/like-target-type.enum';
import { NotificationService } from '../notification/notification.service';
import { NotificationGateway } from '../notification/notification.gateway';
import { Types } from 'mongoose';

@Injectable()
export class LikeService {
    constructor(
        @InjectModel(Like.name)
        private readonly likeModel: Model<LikeDocument>,
        @InjectModel(Post.name)
        private readonly postModel: Model<PostDocument>,
        @InjectModel(Comment.name)
        private readonly commentModel: Model<CommentDocument>,
        private readonly notificationService: NotificationService,
        private readonly notificationGateway: NotificationGateway
    ) { }

    async like(userId: string, targetId: string, type: LikeTargetType) {
        let recipientId: string | undefined;

        if (type === LikeTargetType.Post) {
            const post = await this.postModel.findById(targetId);
            if (!post) throw new NotFoundException('Post not found');
            recipientId = post.authorId.toString();
        } else if (type === LikeTargetType.Comment) {
            const comment = await this.commentModel.findById(targetId);
            if (!comment) throw new NotFoundException('Comment not found');
            recipientId = comment.authorId.toString();
        } else {
            throw new BadRequestException('Invalid like type');
        }

        const existed = await this.likeModel.findOne({ userId, targetId, targetType: type });
        if (existed) throw new BadRequestException('Already liked');
        const like = await this.likeModel.create({ userId, targetId, targetType: type });

        if (recipientId && recipientId !== userId) {
            const notification = await this.notificationService.create({
                recipientId: new Types.ObjectId(recipientId),
                fromUserId: new Types.ObjectId(userId),
                type: 'like',
                postId: type === LikeTargetType.Post ? new Types.ObjectId(targetId) : undefined,
                commentId: type === LikeTargetType.Comment ? new Types.ObjectId(targetId) : undefined,
            });
            this.notificationGateway.sendNotification(recipientId, notification);
        }

        return like;
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