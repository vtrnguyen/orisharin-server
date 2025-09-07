import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Follow, FollowDocument } from './schemas/follow.schema/follow.schema';
import { User, UserDocument } from '../user/schemas/user.schema/user.schema';
import { ApiResponseDto } from 'src/common/dtos/api-response.dto';
import { NotificationService } from '../notification/notification.service';
import { NotificationGateway } from '../notification/notification.gateway';

@Injectable()
export class FollowService {
    constructor(
        @InjectModel(Follow.name)
        private readonly followModel: Model<FollowDocument>,
        @InjectModel(User.name)
        private readonly userModel: Model<UserDocument>,
        private readonly notificationService: NotificationService,
        private readonly notificationGateway: NotificationGateway,
    ) { }

    async follow(followerId: string, followingId: string) {
        try {
            const follow = await this.followModel.create({ followerId, followingId });

            // increase following for current user
            await this.userModel.findByIdAndUpdate(
                followerId,
                { $inc: { followingCount: 1 } },
            );
            // increase followers for the user being followed
            await this.userModel.findByIdAndUpdate(
                followingId,
                { $inc: { followersCount: 1 } },
            );

            // create notification for the followed user
            try {
                const notificationPayload: Partial<any> = {
                    recipientId: new Types.ObjectId(followingId),
                    fromUserId: new Types.ObjectId(followerId),
                    type: 'follow',
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
                        this.notificationGateway.sendNotification(followingId, notificationToSend);
                    } catch (e) { }
                }
            } catch (error: any) { }

            return new ApiResponseDto(follow, "follow successfully", true);
        } catch (error: any) {
            return new ApiResponseDto(null, error.message, false, "follow failed");
        }
    }

    async unfollow(followerId: string, followingId: string) {
        try {
            // delete the connection
            await this.followModel.deleteOne({ followerId, followingId }).exec();
            // decrease followers for current user
            await this.userModel.findByIdAndUpdate(
                followerId,
                { $inc: { followingCount: -1 } },
            );
            // decrease following for the user being followed
            await this.userModel.findByIdAndUpdate(
                followingId,
                { $inc: { followersCount: -1 } },
            );
            return new ApiResponseDto(null, "unfollow successfully", true);
        } catch (error: any) {
            return new ApiResponseDto(null, error.message, false, "unfollow failed");
        }
    }

    async getFollowers(userId: string, currentUserId?: string) {
        try {
            // find all users who follow the given userId
            const followers = await this.followModel
                .find({ followingId: userId })
                .populate('followerId')
                .exec();

            // if currentUserId is provided, get the set of users that current user is following
            let followingSet = new Set<string>();
            if (currentUserId) {
                const followings = await this.followModel.find({ followerId: currentUserId }).exec();
                followingSet = new Set(followings.map(f => f.followingId.toString()));
            }

            // map follower user info and check if current user is following them
            const data = followers
                .map(f => f.followerId)
                .filter(Boolean)
                .map((u: any) => ({
                    id: u._id,
                    username: u.username,
                    fullName: u.fullName,
                    avatarUrl: u.avatarUrl,
                    // isFollowed: true if current user is following this user
                    isFollowed: currentUserId ? followingSet.has(u._id.toString()) : undefined,
                }));

            return new ApiResponseDto(data, "get followers successfully", true);
        } catch (error: any) {
            return new ApiResponseDto([], error.message, false, "get followers failed");
        }
    }

    async getFollowing(userId: string, currentUserId?: string) {
        try {
            // find all users that the given userId is following
            const followings = await this.followModel
                .find({ followerId: userId })
                .populate('followingId')
                .exec();

            // if currentUserId is provided, get the set of users that current user is following
            let followingSet = new Set<string>();
            if (currentUserId) {
                const followingsOfCurrent = await this.followModel.find({ followerId: currentUserId }).exec();
                followingSet = new Set(followingsOfCurrent.map(f => f.followingId.toString()));
            }

            // map following user info and check if current user is following them
            const data = followings
                .map(f => f.followingId)
                .filter(Boolean)
                .map((u: any) => ({
                    id: u._id,
                    username: u.username,
                    fullName: u.fullName,
                    avatarUrl: u.avatarUrl,
                    // isFollowed: true if current user is following this user
                    isFollowed: currentUserId ? followingSet.has(u._id.toString()) : undefined,
                }));

            return new ApiResponseDto(data, "get following successfully", true);
        } catch (error: any) {
            return new ApiResponseDto([], error.message, false, "get following failed");
        }
    }

    async isFollowing(followerId: string, followingId: string) {
        const exists = await this.followModel.exists({ followerId, followingId });
        return new ApiResponseDto(
            { isFollowing: !!exists },
            !!exists ? "Following" : "Not following",
            true
        );
    }

    async suggest(currentUserId?: string, q?: string, limit = 10, after?: string) {
        try {
            // build following set of current user (if provided)
            let followingSet = new Set<string>();
            if (currentUserId) {
                const followings = await this.followModel.find({ followerId: currentUserId }).exec();
                followingSet = new Set(followings.map(f => f.followingId.toString()));
            }

            // exclude list: current user + users already followed
            const excludeIds = new Set<string>();
            if (currentUserId) excludeIds.add(currentUserId);
            for (const id of followingSet) excludeIds.add(id);

            // build query to find candidate users not in exclude list
            const query: any = { _id: { $nin: Array.from(excludeIds) } };

            // search by username or fullName if q provided
            if (q && q.trim()) {
                const re = new RegExp(q.trim(), 'i');
                query.$or = [{ username: re }, { fullName: re }];
            }

            // cursor: if 'after' provided and valid ObjectId, fetch docs with _id < after (newest-first)
            if (after) {
                try {
                    query._id.$lt = new Types.ObjectId(after);
                } catch (e) {
                    // invalid after -> ignore cursor
                }
            }

            const realLimit = Math.max(1, Math.min(Number(limit) || 10, 100));

            // select only needed fields and use lean for performance
            const users = await this.userModel
                .find(query)
                .select('username fullName avatarUrl bio')
                .sort({ _id: -1 })
                .limit(realLimit + 1)
                .lean()
                .exec();

            const hasMore = users.length > realLimit;
            const slice = users.slice(0, realLimit);

            const data = slice.map((u: any) => ({
                id: u._id,
                username: u.username,
                fullName: u.fullName,
                avatarUrl: u.avatarUrl,
                bio: u.bio,
                isFollowed: currentUserId ? followingSet.has(u._id.toString()) : false,
            }));

            const nextCursor = hasMore ? slice[slice.length - 1]._id.toString() : null;

            return new ApiResponseDto(
                { data, nextCursor, hasMore },
                "Get suggest users successfully",
                true
            );
        } catch (error: any) {
            return new ApiResponseDto([], error.message, false, "Get suggest users failed");
        }
    }
}