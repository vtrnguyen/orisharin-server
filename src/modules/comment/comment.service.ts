import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Comment, CommentDocument } from './schemas/comment.schema/comment.schema';

@Injectable()
export class CommentService {
    constructor(
        @InjectModel(Comment.name)
        private readonly commentModel: Model<CommentDocument>,
    ) { }

    async create(commentData: Partial<Comment>) {
        return this.commentModel.create(commentData);
    }

    async findAllByPost(postId: string) {
        return this.commentModel.find({ postId }).populate('authorId').exec();
    }

    async findById(id: string) {
        return this.commentModel.findById(id).exec();
    }
}