import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from './schemas/user.schema/user.schema';

@Injectable()
export class UserService {
    constructor(
        @InjectModel(User.name)
        private readonly userModel: Model<UserDocument>,
    ) { }

    async findAll() {
        return this.userModel.find().exec();
    }

    async findById(id: string) {
        return this.userModel.findById(id).exec();
    }

    async findByCustomId(customId: string) {
        return this.userModel.findOne({ customId }).exec();
    }

    async update(id: string, updateData: Partial<User>) {
        return this.userModel.findByIdAndUpdate(id, updateData, { new: true }).exec();
    }
}