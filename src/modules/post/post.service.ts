import { BadRequestException, Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Post, PostDocument } from "./schemas/post.schema/post.schema";
import { Model, Types } from "mongoose";

@Injectable()
export class PostService {
    constructor(
        @InjectModel(Post.name)
        private readonly postModel: Model<PostDocument>,
    ) { }

    async create(
        authorId: string,
        body: {
            content: string;
            mediaUrls?: string[];
            privacy?: 'public' | 'followers' | 'private';
            originalPostId?: string;
            sharedFromPostId?: string;
        }
    ) {
        if (!body.content && (!body.mediaUrls || body.mediaUrls.length === 0)) {
            throw new BadRequestException('Content or media is required');
        }

        const post = new this.postModel({
            authorId: new Types.ObjectId(authorId),
            content: body.content,
            mediaUrls: body.mediaUrls || [],
            privacy: body.privacy || 'public',
            originalPostId: body.originalPostId ? new Types.ObjectId(body.originalPostId) : undefined,
            sharedFromPostId: body.sharedFromPostId ? new Types.ObjectId(body.sharedFromPostId) : undefined,
        });

        return post.save();
    }

    async findAll() {
        const posts = await this.postModel
            .find()
            .populate("authorId")
            .sort({ createdAt: -1 })
            .exec();

        return posts.map(post => {
            const user = post.authorId && typeof post.authorId === 'object'
                ? {
                    id: (post.authorId as any)._id,
                    username: (post.authorId as any).username,
                    fullName: (post.authorId as any).fullName,
                    avatarUrl: (post.authorId as any).avatarUrl,
                }
                : null;

            const { authorId, ...postData } = post.toObject();

            return {
                post: {
                    ...postData,
                    id: post._id,
                },
                author: user,
            };
        });
    }

    async findById(id: string) {
        return this.postModel.findById(id).exec();
    }
}
