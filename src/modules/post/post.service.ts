import { BadRequestException, Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Post, PostDocument } from "./schemas/post.schema/post.schema";
import { Model, Types } from "mongoose";
import { CloudinaryService } from "src/common/cloudinary/cloudinary.service";
import { User, UserDocument } from "../user/schemas/user.schema/user.schema";
import { Comment, CommentDocument } from "../comment/schemas/comment.schema/comment.schema";
import { ApiResponseDto } from "src/common/dtos/api-response.dto";

@Injectable()
export class PostService {
    constructor(
        @InjectModel(Post.name)
        private readonly postModel: Model<PostDocument>,
        @InjectModel(User.name)
        private readonly userModel: Model<UserDocument>,
        @InjectModel(Comment.name)
        private readonly commentModel: Model<CommentDocument>,
        private readonly cloudinaryService: CloudinaryService
    ) { }

    async create(
        authorId: string,
        body: {
            content: string;
            privacy?: 'public' | 'followers' | 'private';
            originalPostId?: string;
            sharedFromPostId?: string;
        },
        files?: Express.Multer.File[]
    ) {
        let mediaUrls: string[] = [];

        if (files && files.length > 0) {
            for (const file of files) {
                const result = await this.cloudinaryService.uploadImage(file);
                mediaUrls.push(result.secure_url);
            }
        }

        if (!body.content && mediaUrls.length === 0) {
            throw new BadRequestException('Content or media is required');
        }

        const post = new this.postModel({
            authorId: new Types.ObjectId(authorId),
            content: body.content,
            mediaUrls,
            privacy: body.privacy || 'public',
            originalPostId: body.originalPostId ? new Types.ObjectId(body.originalPostId) : undefined,
            sharedFromPostId: body.sharedFromPostId ? new Types.ObjectId(body.sharedFromPostId) : undefined,
        });

        return post.save();
    }

    async delete(postId: string, currentUserId: string) {
        try {
            const post = await this.postModel.findById(postId).exec();
            if (!post) return new ApiResponseDto(null, "Post not found", false, "Post not found");

            // only author can delete
            if (post.authorId.toString() !== currentUserId) return new ApiResponseDto(null, "Unauthorized", false, "You are not the author of this post");

            // soft delete
            const updated = await this.postModel
                .findByIdAndUpdate(postId, { isDeleted: true }, { new: true })
                .populate("authorId")
                .exec();

            if (!updated) {
                return new ApiResponseDto(null, "Post not found after update", false, "Post not found");
            }

            // map to consistent response shape (post + author)
            const user = updated.authorId && typeof updated.authorId === 'object'
                ? {
                    id: (updated.authorId as any)._id,
                    username: (updated.authorId as any).username,
                    fullName: (updated.authorId as any).fullName,
                    avatarUrl: (updated.authorId as any).avatarUrl,
                }
                : null;

            const { authorId, ...postData } = updated.toObject();

            const data = {
                post: {
                    ...postData,
                    id: updated._id,
                },
                author: user,
            };

            return new ApiResponseDto(data, "Delete post successfully", true);
        } catch (error: any) {
            return new ApiResponseDto(null, error.message, false, "Delete post failed");
        }
    }

    async findAllPaginated(page = 1, limit = 10) {
        try {
            const skip = (page - 1) * limit;
            const posts = await this.postModel
                .find({ isDeleted: false })
                .populate("authorId")
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .exec();

            const total = await this.postModel.countDocuments({ isDeleted: false });

            const data = posts.map(post => {
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

            return new ApiResponseDto(
                {
                    data,
                    total,
                    page,
                    limit,
                    hasMore: page * limit < total
                },
                "Get posts successfully",
                true
            );
        } catch (error: any) {
            return new ApiResponseDto(null, error.message, false, "Get posts failed");
        }
    }

    async findByUsername(username: string) {
        const user = await this.userModel.findOne({ username }).exec();
        if (!user) return [];
        const posts = await this.postModel
            .find({ authorId: user._id })
            .populate("authorId")
            .sort({ createdAt: -1 })
            .exec();

        return posts.map(post => {
            const userObj = post.authorId && typeof post.authorId === 'object'
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
                author: userObj,
            };
        });
    }

    async findAllByUserPaginated(username: string, page = 1, limit = 10) {
        try {
            const user = await this.userModel.findOne({ username }).exec();

            if (!user) {
                return new ApiResponseDto(null, "User not found", false);
            }

            const skip = (page - 1) * limit;
            const posts = await this.postModel
                .find({ authorId: user._id, isDeleted: false })
                .populate("authorId")
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .exec();

            const total = await this.postModel.countDocuments({ authorId: user._id, isDeleted: false });

            const data = posts.map(post => {
                const userObj = post.authorId && typeof post.authorId === 'object'
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
                    author: userObj,
                };
            });

            return new ApiResponseDto(
                {
                    data,
                    total,
                    page,
                    limit,
                    hasMore: page * limit < total
                },
                "Get user's posts successfully",
                true
            );
        } catch (error: any) {
            return new ApiResponseDto(null, error.message, false, "Get user's posts failed");
        }
    }

    async getPostDetail(postId: string) {
        try {
            // get post info by id
            const post = await this.postModel
                .findById(postId)
                .where({ isDeleted: false })
                .populate("authorId")
                .exec();
            if (!post) return new ApiResponseDto(null, "Get post detail failed", false, "Post not found!");

            // get all post comments
            const comments = await this.commentModel
                .find({ postId, parentCommentId: null })
                .populate('authorId')
                .lean()
                .exec();

            // get all replies for each comment
            const allReplies = await this.commentModel
                .find({ postId, parentCommentId: { $ne: null } })
                .populate('authorId')
                .lean()
                .exec();

            // map comments with their replies
            const commentWithReplies = comments.map(comment => ({
                ...comment,
                author: comment.authorId,
                replies: allReplies
                    .filter(r => r.parentCommentId?.toString() === comment._id.toString())
                    .map(reply => ({
                        ...reply,
                        author: reply.authorId,
                    })),
            }))

            // map post, replace author id to author
            const { authorId, ...postData } = post.toObject();

            const data = {
                post: {
                    ...postData,
                    id: post._id,
                },
                author: authorId,
                comments: commentWithReplies,
            };

            return new ApiResponseDto(data, "Get post detail successfully", true);
        } catch (error: any) {
            return new ApiResponseDto(null, error.message, false, "An error occurred while fetching post details.");
        }
    }
}
