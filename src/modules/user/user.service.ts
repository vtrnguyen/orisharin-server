import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema/user.schema';
import { ApiResponseDto } from 'src/common/dtos/api-response.dto';
import { CloudinaryService } from 'src/common/cloudinary/cloudinary.service';
import { Follow, FollowDocument } from '../follow/schemas/follow.schema/follow.schema';

@Injectable()
export class UserService {
    constructor(
        @InjectModel(User.name)
        private readonly userModel: Model<UserDocument>,
        @InjectModel(Follow.name)
        private readonly followModel: Model<FollowDocument>,
        private readonly cloudinaryService: CloudinaryService,
    ) { }

    async findAll() {
        const users = await this.userModel.find().exec();
        const message = users.length > 0 ? "get all users successfully" : "no users found";
        return new ApiResponseDto(users, message, true);
    }

    async findByIdOrUsername(query: string) {
        const isObjectId = /^[0-9a-fA-F]{24}$/.test(query);
        let user;

        if (isObjectId) user = await this.userModel.findById(query).exec();
        else user = await this.userModel.findOne({ username: query }).exec();

        let followings: any[] = [];
        if (user) {
            followings = await this.followModel
                .find({ followerId: user._id })
                .limit(3)
                .populate('followingId')
                .exec();
            followings = followings
                .map(f => f.followingId)
                .filter(Boolean)
                .map(u => ({
                    id: u._id,
                    username: u.username,
                    fullName: u.fullName,
                    avatarUrl: u.avatarUrl,
                }));
        }

        const success = !!user;
        const message = user ? "get user info successfully" : "user not found";

        return new ApiResponseDto(
            { user, followings },
            message,
            success
        );
    }

    async updateProfile(
        userId: string,
        body: { bio?: string; websiteLinks?: string[] },
        avatar?: Express.Multer.File
    ) {
        let avatarUrl: string | undefined;
        if (avatar) {
            const currentUser = await this.userModel.findById(userId).exec();
            if (currentUser?.avatarUrl) {
                const matches = currentUser.avatarUrl.match(/\/([^\/]+)\.(jpg|jpeg|png|gif|webp|bmp|tiff|ico|svg|jfif|avif|heic|heif|raw|pdf|mp4|mov|webm|mkv|avi|flv|wmv|m3u8|ts|3gp|ogg|mp3|wav|aac|flac|opus|amr|m4a|m4v|mpg|mpeg|ogv|3g2|asf|m2ts|mts|mxf|vob|rm|rmvb|f4v|f4p|f4a|f4b)$/i);

                if (matches && matches[1]) {
                    const publicId = `orisharin/${matches[1]}`;
                    try {
                        await this.cloudinaryService.deleteImage(publicId);
                    } catch (e) {
                        console.error(`Failed to delete old avatar: ${e.message}`);
                    }
                }
            }

            const result = await this.cloudinaryService.uploadImage(avatar);
            avatarUrl = result.secure_url;
        }

        const updateData: any = {};
        if (avatarUrl) updateData.avatarUrl = avatarUrl;
        if (body.bio !== undefined) updateData.bio = body.bio;
        if (body.websiteLinks !== undefined) {
            if (Array.isArray(body.websiteLinks)) {
                updateData.websiteLinks = body.websiteLinks;
            } else if (typeof body.websiteLinks === "string" && body.websiteLinks !== "") {
                updateData.websiteLinks = [body.websiteLinks];
            } else {
                updateData.websiteLinks = [];
            }
        }

        const user = await this.userModel.findByIdAndUpdate(
            userId,
            updateData,
            { new: true },
        ).exec();

        const success = !!user;
        const message = user ? "profile updated successfully" : "user not found";

        return new ApiResponseDto(user, message, success);
    }

    async introduceUser(query: string) {
        const isObjectId = /^[0-9a-fA-F]{24}$/.test(query);
        let user;
        if (isObjectId) {
            user = await this.userModel.findById(query).exec();
        } else {
            user = await this.userModel.findOne({ username: query }).exec();
        }

        if (!user) {
            return new ApiResponseDto(null, "User not found", false);
        }

        const summary = {
            username: user.username,
            fullName: user.fullName,
            avatarUrl: user.avatarUrl,
            createdAt: user.createdAt,
        }
        return new ApiResponseDto(summary, "Get user summary successfully", true);
    }
}