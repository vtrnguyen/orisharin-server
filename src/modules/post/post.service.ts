import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Post, PostDocument } from "./schemas/post.schema/post.schema";
import { Model, Types } from "mongoose";
import { CloudinaryService } from "src/common/cloudinary/cloudinary.service";
import { User, UserDocument } from "../user/schemas/user.schema/user.schema";
import { Comment, CommentDocument } from "../comment/schemas/comment.schema/comment.schema";
import { ApiResponseDto } from "src/common/dtos/api-response.dto";
import { Like, LikeDocument } from "../like/schemas/like.schema/like.schema";
import { LikeTargetType } from "src/common/enums/like-target-type.enum";

@Injectable()
export class PostService {
    constructor(
        @InjectModel(Post.name)
        private readonly postModel: Model<PostDocument>,
        @InjectModel(User.name)
        private readonly userModel: Model<UserDocument>,
        @InjectModel(Comment.name)
        private readonly commentModel: Model<CommentDocument>,
        @InjectModel(Like.name)
        private readonly likeModel: Model<LikeDocument>,
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

            // collect referenced post ids (sharedFromPostId or originalPostId)
            const referencedIds = new Set<string>();
            for (const p of posts) {
                if ((p as any).sharedFromPostId) referencedIds.add(String((p as any).sharedFromPostId));
                else if ((p as any).originalPostId) referencedIds.add(String((p as any).originalPostId));
            }

            // fetch all referenced posts in batch with their authors
            let refsMap: Record<string, any> = {};
            if (referencedIds.size > 0) {
                const refs = await this.postModel
                    .find({ _id: { $in: Array.from(referencedIds).map(id => new Types.ObjectId(id)) } })
                    .populate('authorId')
                    .lean()
                    .exec();

                for (const r of refs) {
                    const userObj = r.authorId && typeof r.authorId === 'object'
                        ? {
                            id: (r.authorId as any)._id,
                            username: (r.authorId as any).username,
                            fullName: (r.authorId as any).fullName,
                            avatarUrl: (r.authorId as any).avatarUrl,
                        }
                        : null;

                    const { authorId, ...rPostData } = r;
                    refsMap[String(r._id)] = {
                        post: {
                            ...rPostData,
                            id: r._id,
                        },
                        author: userObj,
                    };
                }
            }

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

                // determine referenced id (prefer sharedFromPostId over originalPostId)
                const refId = post.sharedFromPostId ? String(post.sharedFromPostId) : (post.originalPostId ? String(post.originalPostId) : null);
                const referenced = refId ? (refsMap[refId] || null) : null;

                return {
                    post: {
                        ...postData,
                        id: post._id,
                    },
                    author: user,
                    sharedPost: post.sharedFromPostId ? referenced : null,
                    originalPost: (!post.sharedFromPostId && post.originalPostId) ? referenced : null,
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

            // collect referenced post ids
            const referencedIds = new Set<string>();
            for (const p of posts) {
                if ((p as any).sharedFromPostId) referencedIds.add(String((p as any).sharedFromPostId));
                else if ((p as any).originalPostId) referencedIds.add(String((p as any).originalPostId));
            }

            // fetch referenced posts
            let refsMap: Record<string, any> = {};
            if (referencedIds.size > 0) {
                const refs = await this.postModel
                    .find({ _id: { $in: Array.from(referencedIds).map(id => new Types.ObjectId(id)) } })
                    .populate('authorId')
                    .lean()
                    .exec();

                for (const r of refs) {
                    const userObj = r.authorId && typeof r.authorId === 'object'
                        ? {
                            id: (r.authorId as any)._id,
                            username: (r.authorId as any).username,
                            fullName: (r.authorId as any).fullName,
                            avatarUrl: (r.authorId as any).avatarUrl,
                        }
                        : null;

                    const { authorId, ...rPostData } = r;
                    refsMap[String(r._id)] = {
                        post: {
                            ...rPostData,
                            id: r._id,
                        },
                        author: userObj,
                    };
                }
            }

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

                const refId = post.sharedFromPostId ? String(post.sharedFromPostId) : (post.originalPostId ? String(post.originalPostId) : null);
                const referenced = refId ? (refsMap[refId] || null) : null;

                return {
                    post: {
                        ...postData,
                        id: post._id,
                    },
                    author: userObj,
                    sharedPost: post.sharedFromPostId ? referenced : null,
                    originalPost: (!post.sharedFromPostId && post.originalPostId) ? referenced : null,
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

    async findDeletedByUserPaginated(username: string, page = 1, limit = 10, currentUserId?: string) {
        try {
            const user = await this.userModel.findOne({ username }).exec() as UserDocument | null;
            if (!user) return new ApiResponseDto(null, "User not found", false, "User not found");

            if (!currentUserId || currentUserId !== String(user._id)) {
                return new ApiResponseDto(null, "Unauthorized", false, "You are not allowed to view this resource");
            }

            const skip = (page - 1) * limit;
            const posts = await this.postModel
                .find({ authorId: user._id, isDeleted: true })
                .populate("authorId")
                .sort({ updatedAt: -1 })
                .skip(skip)
                .limit(limit)
                .exec();

            const total = await this.postModel.countDocuments({ authorId: user._id, isDeleted: true });

            // collect referenced post ids from the page
            const referencedIds = new Set<string>();
            for (const p of posts) {
                if ((p as any).sharedFromPostId) referencedIds.add(String((p as any).sharedFromPostId));
                else if ((p as any).originalPostId) referencedIds.add(String((p as any).originalPostId));
            }

            // fetch referenced posts in batch with their authors
            let refsMap: Record<string, any> = {};
            if (referencedIds.size > 0) {
                const refs = await this.postModel
                    .find({ _id: { $in: Array.from(referencedIds).map(id => new Types.ObjectId(id)) } })
                    .populate('authorId')
                    .lean()
                    .exec();

                for (const r of refs) {
                    const userObj = r.authorId && typeof r.authorId === 'object'
                        ? {
                            id: (r.authorId as any)._id,
                            username: (r.authorId as any).username,
                            fullName: (r.authorId as any).fullName,
                            avatarUrl: (r.authorId as any).avatarUrl,
                        }
                        : null;

                    const { authorId, ...rPostData } = r;
                    refsMap[String(r._id)] = {
                        post: {
                            ...rPostData,
                            id: r._id,
                        },
                        author: userObj,
                    };
                }
            }

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

                const refId = post.sharedFromPostId ? String(post.sharedFromPostId) : (post.originalPostId ? String(post.originalPostId) : null);
                const referenced = refId ? (refsMap[refId] || null) : null;

                return {
                    post: {
                        ...postData,
                        id: post._id,
                    },
                    author: userObj,
                    sharedPost: post.sharedFromPostId ? referenced : null,
                    originalPost: (!post.sharedFromPostId && post.originalPostId) ? referenced : null,
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
                "Get user's deleted posts successfully",
                true
            );
        } catch (error: any) {
            return new ApiResponseDto(null, error.message, false, "Get user's deleted posts failed");
        }
    }

    async getPostDetail(username: string, postId: string) {
        try {
            // find user by username
            const user = await this.userModel.findOne({
                username: username
            }).exec();
            if (!user) return new ApiResponseDto(null, "User not found", false, "User not found");

            const post = await this.postModel
                .findOne({
                    _id: postId,
                    authorId: user._id,
                    isDeleted: false,
                })
                .populate("authorId")
                .exec();
            if (!post) return new ApiResponseDto(null, "Post not found", false, "Post not found");

            // get all post comments and replies
            const comments = await this.commentModel
                .find({ postId, parentCommentId: null })
                .populate("authorId")
                .lean()
                .exec();
            const allReplies = await this.commentModel
                .find({ postId, parentCommentId: { $ne: null } })
                .populate("authorId")
                .lean()
                .exec();

            const commentWithReplies = comments.map(comment => ({
                ...comment,
                author: comment.authorId,
                replies: allReplies
                    .filter(r => r.parentCommentId?.toString() === comment._id.toString())
                    .map(reply => ({
                        ...reply,
                        author: reply.authorId,
                    })),
            }));

            const { authorId, ...postData } = post.toObject();

            // fetch referenced post if any (prefer sharedFromPostId)
            const refId = (post as any).sharedFromPostId ? String((post as any).sharedFromPostId)
                : (post as any).originalPostId ? String((post as any).originalPostId) : null;

            let referenced: any = null;
            if (refId) {
                const r = await this.postModel.findById(new Types.ObjectId(refId)).populate('authorId').lean().exec();
                if (r) {
                    const userObj = r.authorId && typeof r.authorId === 'object'
                        ? {
                            id: (r.authorId as any)._id,
                            username: (r.authorId as any).username,
                            fullName: (r.authorId as any).fullName,
                            avatarUrl: (r.authorId as any).avatarUrl,
                        }
                        : null;

                    const { authorId: rAuthorId, ...rPostData } = r;
                    referenced = {
                        post: {
                            ...rPostData,
                            id: r._id,
                        },
                        author: userObj,
                    };
                }
            }

            const data = {
                post: {
                    ...postData,
                    id: post._id,
                },
                author: authorId,
                comments: commentWithReplies,
                sharedPost: (post as any).sharedFromPostId ? referenced : null,
                originalPost: (!(post as any).sharedFromPostId && (post as any).originalPostId) ? referenced : null,
            };

            return new ApiResponseDto(data, "Get post detail successfully", true);
        } catch (error: any) {
            return new ApiResponseDto(null, error.message, false, "An error occurred while fetching post details.");
        }
    }

    async restore(postId: string, currentUserId: string) {
        try {
            const post = await this.postModel.findById(postId).exec();
            if (!post) return new ApiResponseDto(null, "Post not found", false, "Post not found");

            // only author can restore
            if (post.authorId.toString() !== currentUserId) {
                return new ApiResponseDto(null, "Unauthorized", false, "You are not the author of this post");
            }

            const updated = await this.postModel
                .findByIdAndUpdate(postId, { isDeleted: false }, { new: true })
                .exec();

            if (!updated) return new ApiResponseDto(null, "Restore failed", false, "Post not found");

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

            return new ApiResponseDto(data, "Restore post successfully", true);
        } catch (error: any) {
            return new ApiResponseDto(null, error.message, false, "Restore post successfully");
        }
    }

    async permanentlyDelete(postId: string, currentUserId: string) {
        try {
            const post = await this.postModel.findById(postId).exec();
            if (!post) return new ApiResponseDto(null, "Post not found", false, "Post not found");

            // only author can permanently delete
            if (post.authorId.toString() !== currentUserId) {
                return new ApiResponseDto(null, "Unauthorized", false, "You are not the author of this post");
            }

            // delete media from media server if any
            if (Array.isArray(post.mediaUrls) && post.mediaUrls.length > 0) {
                const extractPublicId = (url: string): string | null => {
                    try {
                        const withoutQuery = url.split('?')[0];
                        const idx = withoutQuery.indexOf('/upload/');
                        if (idx === -1) return null;
                        let after = withoutQuery.substring(idx + '/upload/'.length);
                        after = after.replace(/^v\d+\//, '');
                        // remove file extension
                        after = after.replace(/\.[^/.]+$/, '');
                        return after;
                    } catch {
                        return null;
                    }
                };

                for (const url of post.mediaUrls) {
                    const publicId = extractPublicId(url);
                    if (publicId) {
                        try {
                            await this.cloudinaryService.deleteImage(publicId);
                        } catch (err) {
                        }
                    }
                }
            }

            // delete related comments
            await this.commentModel.deleteMany({ postId: post._id }).exec();
            // delete related likes
            await this.likeModel.deleteMany({ targetId: post._id, type: LikeTargetType.Post }).exec();
            await this.postModel.findByIdAndDelete(postId).exec();

            return new ApiResponseDto(null, "Post permanently deleted", true);
        } catch (error: any) {
            return new ApiResponseDto(null, error.message, false, "Hard delete post failed");
        }
    }
}
