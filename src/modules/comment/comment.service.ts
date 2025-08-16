import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Comment, CommentDocument } from './schemas/comment.schema/comment.schema';
import { ApiResponseDto } from 'src/common/dtos/api-response.dto';
import { CloudinaryService } from 'src/common/cloudinary/cloudinary.service';
import { Post, PostDocument } from '../post/schemas/post.schema/post.schema';

@Injectable()
export class CommentService {
    constructor(
        @InjectModel(Comment.name)
        private readonly commentModel: Model<CommentDocument>,
        @InjectModel(Post.name)
        private readonly postModel: Model<PostDocument>,
        private readonly cloudinaryService: CloudinaryService,
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
                    { $inc: { commentCount: 1 } },
                );
            }

            if (commentData.postId) {
                // if the comment is on a post, increment the post's comment count
                await this.postModel.findByIdAndUpdate(
                    commentData.postId,
                    { $inc: { commentsCount: 1 } }
                );
            }

            return new ApiResponseDto(comment, "Comment created successfully", true);
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