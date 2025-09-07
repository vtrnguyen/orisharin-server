import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Comment, CommentDocument } from './schemas/comment.schema/comment.schema';
import { ApiResponseDto } from 'src/common/dtos/api-response.dto';
import { CloudinaryService } from 'src/common/cloudinary/cloudinary.service';
import { Post, PostDocument } from '../post/schemas/post.schema/post.schema';
import { NotificationService } from '../notification/notification.service';
import { NotificationGateway } from '../notification/notification.gateway';

@Injectable()
export class CommentService {
    constructor(
        @InjectModel(Comment.name)
        private readonly commentModel: Model<CommentDocument>,
        @InjectModel(Post.name)
        private readonly postModel: Model<PostDocument>,
        private readonly cloudinaryService: CloudinaryService,
        private readonly notificationService: NotificationService,
        private readonly notificationGateway: NotificationGateway,
    ) { }

    async create(commentData: Partial<Comment>, files?: Express.Multer.File[]) {
        try {
            let mediaUrls: string[] = [];
            if (files && files.length > 0) {
                for (const file of files) {
                    const result = await this.cloudinaryService.uploadImage(file);
                    if (result && result.secure_url) {
                        mediaUrls.push(result.secure_url);
                    }
                }
            }
            commentData.mediaUrls = mediaUrls;
            const comment = await this.commentModel.create(commentData);

            // update the comment count in the parent comment or post
            if (commentData.parentCommentId) {
                await this.commentModel.findByIdAndUpdate(
                    commentData.parentCommentId,
                    { $inc: { commentsCount: 1 } },
                );
            }

            if (commentData.postId) {
                // if the comment is on a post, increment the post's comment count
                await this.postModel.findByIdAndUpdate(
                    commentData.postId,
                    { $inc: { commentsCount: 1 } }
                );
            }

            // populate the author information
            const populatedComment = await this.commentModel
                .findById(comment._id)
                .populate('authorId')
                .exec();

            (async () => {
                try {
                    let recipientIdStr: string | null = null;

                    // if replying to a comment -> notify parent comment's author
                    if (commentData.parentCommentId) {
                        const parent = await this.commentModel.findById(commentData.parentCommentId).exec();
                        if (parent && parent.authorId) {
                            const parentAuthorId = parent.authorId.toString();
                            const authorIdStr = commentData.authorId ? String(commentData.authorId) : '';
                            if (parentAuthorId !== authorIdStr) {
                                recipientIdStr = parentAuthorId;
                            }
                        }
                    }

                    // if not reply (or parent author is the same as author), notify post owner
                    if (!recipientIdStr && commentData.postId) {
                        const post = await this.postModel.findById(commentData.postId).exec();
                        if (post && post.authorId) {
                            const postAuthorId = post.authorId.toString();
                            const authorIdStr = commentData.authorId ? String(commentData.authorId) : '';
                            if (postAuthorId !== authorIdStr) {
                                recipientIdStr = postAuthorId;
                            }
                        }
                    }

                    if (recipientIdStr) {
                        const notificationPayload: Partial<any> = {
                            recipientId: new Types.ObjectId(recipientIdStr),
                            fromUserId: new Types.ObjectId(String(commentData.authorId)),
                            type: commentData.parentCommentId ? 'reply' : 'comment',
                            postId: commentData.postId ? new Types.ObjectId(commentData.postId) : undefined,
                            commentId: new Types.ObjectId(String(comment._id)),
                        };

                        const created = await this.notificationService.create(notificationPayload);

                        let notificationToSend: any = null;
                        if (created && typeof created === 'object' && 'data' in created) {
                            notificationToSend = created.data;
                        } else {
                            notificationToSend = created;
                        }

                        if (notificationToSend) {
                            try {
                                this.notificationGateway.sendNotification(recipientIdStr, notificationToSend);
                            } catch (e) { }
                        }
                    }
                } catch (e) { }
            })();

            return new ApiResponseDto(populatedComment, "Comment created successfully", true);
        } catch (error: any) {
            return new ApiResponseDto(null, error.message, false, "Comment failed");
        }
    }

    async findAllByPost(postId: string) {
        try {
            const comments = await this.commentModel.find({ postId }).populate('authorId').exec();
            return new ApiResponseDto(comments, "Get comments successfully", true);
        } catch (error: any) {
            return new ApiResponseDto(null, error.message, false, "Get comment failed");
        }
    }

    async findById(id: string) {
        try {
            const comment = await this.commentModel.findById(id).exec();
            const success = !!comment;
            const message = comment ? "Get comment successfully" : "Comment not found";
            return new ApiResponseDto(comment, message, success);
        } catch (error: any) {
            return new ApiResponseDto(null, error.message, false, "Get comment failed");
        }
    }
}