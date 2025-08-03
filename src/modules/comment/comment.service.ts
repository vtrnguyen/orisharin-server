import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Comment, CommentDocument } from './schemas/comment.schema/comment.schema';
import { ApiResponseDto } from 'src/common/dtos/api-response.dto';

@Injectable()
export class CommentService {
    constructor(
        @InjectModel(Comment.name)
        private readonly commentModel: Model<CommentDocument>,
    ) { }

    async create(commentData: Partial<Comment>) {
        try {
            if (!Array.isArray(commentData.mediaUrls)) {
                commentData.mediaUrls = [];
            }
            const comment = await this.commentModel.create(commentData);
            return new ApiResponseDto(comment, 'Comment created successfully', true);
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