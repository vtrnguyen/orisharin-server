import { Controller, Get, Put, Param, Body, UseGuards } from '@nestjs/common';
import { UserService } from './user.service';
import { IdValidationPipe } from 'common/pipes/id-validation.pipe';
import { JwtAuthGuard } from 'common/guards/jwt-auth.guard';
import { CurrentUser } from 'common/decorators/current-user.decorator';
import { RolesGuard } from 'common/guards/role.guard';
import { Roles } from 'common/decorators/roles.decorator';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UserController {
    constructor(private readonly userService: UserService) { }

    @Get()
    @Roles('admin')
    async getAllUsers() {
        return this.userService.findAll();
    }

    @Get('profile')
    async getProfile(@CurrentUser() user: any) {
        return this.userService.findById(user.id);
    }

    @Get(':id')
    async getUserById(@Param('id', IdValidationPipe) id: string) {
        return this.userService.findById(id);
    }

    @Put(':id')
    async updateUser(@Param('id', IdValidationPipe) id: string, @Body() body) {
        return this.userService.update(id, body);
    }

    @Put(':id/ban')
    @Roles('admin')
    async banUser(@Param('id', IdValidationPipe) id: string) {
        return { message: 'User banned successfully' };
    }
}