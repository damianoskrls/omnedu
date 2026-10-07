import { Controller, Get, Patch, Body, Param, Post, Delete, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

@ApiTags('users')
@ApiBearerAuth('access-token')
@Controller('users')
export class UsersController {
  constructor(private users: UsersService) {}

  @Get('me')
  getMe(@CurrentUser() user: JwtPayload) {
    return this.users.findById(user.sub);
  }

  @Patch('me')
  updateMe(
    @CurrentUser() user: JwtPayload,
    @Body() body: { fullName?: string; phone?: string; avatarUrl?: string; email?: string },
  ) {
    return this.users.updateProfile(user.sub, body, user);
  }

  @Delete('me')
  deleteMe(@CurrentUser() user: JwtPayload) {
    return this.users.deleteAccount(user.sub);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.users.findById(id);
  }

  @Post('me/fcm-token')
  saveFcmToken(
    @CurrentUser() user: JwtPayload,
    @Body() body: { token: string; platform: 'android' | 'ios' },
  ) {
    return this.users.saveFcmToken(user.sub, body.token, body.platform);
  }

  @Delete('me/fcm-token')
  removeFcmToken(@Body() body: { token: string }) {
    return this.users.removeFcmToken(body.token);
  }
}
