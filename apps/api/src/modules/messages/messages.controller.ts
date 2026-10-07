import { Controller, Get, Post, Delete, Body, Param, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { MessagesService } from './messages.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';

@ApiTags('messages')
@ApiBearerAuth('access-token')
@Controller('schools/:schoolId/conversations')
export class MessagesController {
  constructor(private messages: MessagesService) {}

  @Get()
  myConversations(@Param('schoolId') schoolId: string, @CurrentUser() user: JwtPayload) {
    return this.messages.getConversations(user.sub, schoolId, user.role);
  }

  @Get('contacts')
  contacts(@Param('schoolId') schoolId: string, @CurrentUser() user: JwtPayload) {
    return this.messages.contacts(user.sub, schoolId, user.role);
  }

  @Post()
  getOrCreate(
    @Param('schoolId') schoolId: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: { participantIds?: string[]; kind?: string; withUserId?: string },
  ) {
    if (body.kind === 'admin' || body.kind === 'teacher') {
      return this.messages.openScoped(schoolId, user.sub, user.role, body.kind, body.withUserId);
    }
    const ids = [...new Set([...(body.participantIds ?? []), user.sub])];
    return this.messages.getOrCreateConversation(schoolId, ids);
  }

  @Get(':conversationId/messages')
  getMessages(
    @Param('conversationId') conversationId: string,
    @CurrentUser() user: JwtPayload,
    @Query('cursor') cursor?: string,
    @Query('take') take?: number,
  ) {
    return this.messages.getMessages(conversationId, user.sub, cursor, take);
  }

  @Post(':conversationId/messages')
  sendMessage(
    @Param('conversationId') conversationId: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: { body: string; mediaUrl?: string },
  ) {
    return this.messages.sendMessage(conversationId, user.sub, body.body, body.mediaUrl);
  }

  @Delete(':conversationId/messages/:messageId')
  deleteMessage(@Param('messageId') messageId: string, @CurrentUser() user: JwtPayload) {
    return this.messages.deleteMessage(messageId, user.sub);
  }
}
