import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { Account, AccountSchema } from '../account/schemas/account.schema/account.schema';
import { User, UserSchema } from '../user/schemas/user.schema/user.schema';
import { JwtStrategy } from 'common/strategies/jwt.strategy';

@Module({
    imports: [
        ConfigModule,
        PassportModule,
        MongooseModule.forFeature([
            { name: Account.name, schema: AccountSchema },
            { name: User.name, schema: UserSchema },
        ]),
        JwtModule.registerAsync({
            imports: [ConfigModule],
            useFactory: async (configService: ConfigService) => ({
                secret: configService.get<string>('JWT_SECRET'),
                signOptions: {
                    expiresIn: configService.get<string>('JWT_EXPIRES_IN') || '7d',
                },
            }),
            inject: [ConfigService],
        }),
    ],
    controllers: [AuthController],
    providers: [AuthService, JwtStrategy],
    exports: [AuthService],
})
export class AuthModule { }