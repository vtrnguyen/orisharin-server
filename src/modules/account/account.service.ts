import { Injectable } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Account, AccountDocument } from "./schemas/account.schema/account.schema";
import { Model } from "mongoose";

@Injectable()
export class AccountService {
    constructor(
        @InjectModel(Account.name)
        private readonly accountModel: Model<AccountDocument>,
    ) {}

    async create(data: Partial<Account>): Promise<AccountDocument> {
        const createdAccount = new this.accountModel(data);
        return createdAccount.save();
    }

    async findByEmail(email: string): Promise<AccountDocument | null> {
        return this.accountModel.findOne({ email }).exec();
    }
}
