import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Follow, FollowDocument } from './schemas/follow.schema/follow.schema';
import { User, UserDocument } from '../user/schemas/user.schema/user.schema';
import { ApiResponseDto } from 'src/common/dtos/api-response.dto';

@Injectable()
export class FollowService {
    constructor(
        @InjectModel(Follow.name)
        private readonly followModel: Model<FollowDocument>,
        @InjectModel(User.name)
        private readonly userModel: Model<UserDocument>,
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
}