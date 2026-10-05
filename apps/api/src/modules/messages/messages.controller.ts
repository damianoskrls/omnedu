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
    return this.messages.getConversations(user.sub, schoolId);
  }

  @Post()
  getOrCreate(
    @Param('schoolId') schoolId: string,
    @Body() body: { participantIds: string[] },
  ) {
    return this.messages.getOrCreateConversation(schoolId, body.participantIds);
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
