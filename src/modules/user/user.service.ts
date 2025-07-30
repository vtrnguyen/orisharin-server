import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema/user.schema';
import { ApiResponseDto } from 'src/common/dtos/api-response.dto';

@Injectable()
export class UserService {
    constructor(
        @InjectModel(User.name)
        private readonly userModel: Model<UserDocument>,
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

        const success = !!user;
        const message = user ? "get user info successfully" : "user not found";

        return new ApiResponseDto(user, message, success);
    }
}