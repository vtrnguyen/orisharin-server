import { Controller, Get, Put, Param, Body, UseGuards } from '@nestjs/common';
import { UserService } from './user.service';
import { IdValidationPipe } from 'common/pipes/id-validation.pipe';
import { JwtAuthGuard } from 'common/guards/jwt-auth.guard';
import { RolesGuard } from 'common/guards/role.guard';
import { Roles } from 'common/decorators/roles.decorator';

@Controller('api/v1/users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UserController {
    constructor(private readonly userService: UserService) { }

    @Get()
    @Roles('admin')
    async getAllUsers() {
        return this.userService.findAll();
    }

    @Get(':query')
    async getUserByIdOrUsername(@Param('query') query: string) {
        return this.userService.findByIdOrUsername(query);
    }
}