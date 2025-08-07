import { BadRequestException, Injectable, UnauthorizedException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Account } from "../account/schemas/account.schema/account.schema";
import { User } from "../user/schemas/user.schema/user.schema";
import { Model } from "mongoose";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcryptjs";
import { CloudinaryService } from "src/common/cloudinary/cloudinary.service";

@Injectable()
export class AuthService {
    constructor(
        @InjectModel(Account.name)
        private accountModel: Model<Account>,
        @InjectModel(User.name)
        private userModel: Model<User>,
        private jwtService: JwtService,
        private cloudinaryService: CloudinaryService,
    ) { }

    async register({ email, password, fullName, username }: any) {
        const existingAccount = await this.accountModel.findOne({ email });
        if (existingAccount) {
            throw new BadRequestException('Email already exists');
        }

        const existingUser = await this.userModel.findOne({ username });
        if (existingUser) {
            throw new BadRequestException('Username already exists');
        }

        const hashed = await bcrypt.hash(password, 10);

        const account = await this.accountModel.create({
            email,
            password: hashed,
            role: "user",
            isActive: true,
        });

        const fs = require('fs');
        const path = require('path');
        const defaultAvatarPath = require('path').resolve(process.cwd(), 'src/public/images/orisharin_default_avatar.png');
        const defaultAvatarBuffer = require('fs').readFileSync(defaultAvatarPath);
        const defaultAvatarFile = {
            buffer: defaultAvatarBuffer,
            mimetype: 'image/png',
            originalname: 'orisharin_default_avatar.png',
        } as Express.Multer.File;

        const result = await this.cloudinaryService.uploadImage(defaultAvatarFile);
        const avatarUrl = result.secure_url;

        const user = await this.userModel.create({
            accountId: account._id,
            username,
            fullName,
            displayName: fullName,
            avatarUrl,
        });

        return {
            success: true,
            accessToken: this.jwtService.sign({
                id: account._id,
                email: account.email,
                userId: user._id,
                role: account.role,
            }),
            user: {
                id: user._id,
                username: user.username,
                fullName: user.fullName,
                email: account.email,
                role: account.role,
            }
        };
    }

    async login({ email, password }: any) {
        const account = await this.accountModel.findOne({ email });
        if (!account) throw new UnauthorizedException('Email not found');

        const isMatch = await bcrypt.compare(password, account.password);
        if (!isMatch) throw new UnauthorizedException('Wrong password');

        const user = await this.userModel.findOne({ accountId: account._id });

        return {
            success: true,
            accessToken: this.jwtService.sign({
                id: account._id,
                email: account.email,
                userId: user?._id,
                role: account.role,
            }),
            user: user ? {
                id: user._id,
                username: user.username,
                fullName: user.fullName,
                avatarUrl: user.avatarUrl,
                email: account.email,
                role: account.role,
            } : null
        };
    }
}