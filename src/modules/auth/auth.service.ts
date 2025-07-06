import { BadRequestException, Injectable, UnauthorizedException } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Account } from "../account/schemas/account.schema/account.schema";
import { User } from "../user/schemas/user.schema/user.schema";
import { Model } from "mongoose";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcryptjs";

@Injectable()
export class AuthService {
    constructor(
        @InjectModel(Account.name)
        private accountModel: Model<Account>,
        @InjectModel(User.name)
        private userModel: Model<User>,
        private jwtService: JwtService,
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

        const user = await this.userModel.create({
            accountId: account._id,
            username,
            fullName,
            displayName: fullName,
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
                email: account.email,
                role: account.role,
            } : null
        };
    }
}