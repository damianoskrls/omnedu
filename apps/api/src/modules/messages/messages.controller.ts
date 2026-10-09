import { BadRequestException, Body, Controller, Delete, ForbiddenException, Get, HttpException, Param, Post, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { MessagesService } from './messages.service';
import { OpenConversationDto, SendMessageDto } from './dto/conversation.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { StorageService } from '../../common/storage/storage.service';
import { isSchoolLead } from '../../common/school-lead';

@ApiTags('messages')
@ApiBearerAuth('access-token')
@Controller('schools/:schoolId/conversations')
export class MessagesController {
  constructor(
    private messages: MessagesService,
    private storage: StorageService,
  ) {}

  @Get()
  myConversations(@Param('schoolId') schoolId: string, @CurrentUser() user: JwtPayload) {
    return this.messages.getConversations(user.sub, schoolId, user.role);
  }

  @Get('contacts')
  contacts(@Param('schoolId') schoolId: string, @CurrentUser() user: JwtPayload) {
    return this.messages.contacts(user.sub, schoolId, user.role);
  }

  @Get('typing')
  typing(@Param('schoolId') schoolId: string, @CurrentUser() user: JwtPayload) {
    return this.messages.whoIsTyping(schoolId, user.sub);
  }

  @Get('unread-count')
  unreadCount(@Param('schoolId') schoolId: string, @CurrentUser() user: JwtPayload) {
    return this.messages.unreadCount(user.sub, schoolId, user.role).then((count) => ({ count }));
  }

  @Post('broadcast')
  broadcast(
    @Param('schoolId') schoolId: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: { userIds?: string[]; body?: string },
  ) {
    return this.messages.broadcast(schoolId, user.sub, user.role, body.userIds ?? [], body.body);
  }

  @Post()
  getOrCreate(
    @Param('schoolId') schoolId: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: OpenConversationDto,
  ) {
    if (body.kind === 'admin' || body.kind === 'teacher' || body.kind === 'driver') {
      return this.messages.openScoped(schoolId, user.sub, user.role, body.kind, body.withUserId);
    }
    if (!isSchoolLead(user.role)) {
      throw new ForbiddenException('Η συνομιλία ανοίγει μόνο με τη διαχείριση ή με τη δασκάλα του παιδιού');
    }
    const ids = [...new Set([...(body.participantIds ?? []), user.sub])];
    return this.messages.getOrCreateConversation(schoolId, ids, user.sub);
  }

  @Post(':conversationId/typing')
  pulseTyping(
    @Param('schoolId') schoolId: string,
    @Param('conversationId') conversationId: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: { active?: boolean },
  ) {
    return this.messages.pulseTyping(schoolId, conversationId, user.sub, body?.active !== false);
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

  @Post(':conversationId/messages/image')
  @UseInterceptors(FileInterceptor('file', {
    storage: memoryStorage(),
    fileFilter: (_req, file, cb) => {
      if (!file.mimetype.startsWith('image/')) return cb(new BadRequestException('Μόνο εικόνα επιτρέπεται.'), false);
      cb(null, true);
    },
    limits: { fileSize: 8 * 1024 * 1024 },
  }))
  async sendImage(
    @Param('conversationId') conversationId: string,
    @CurrentUser() user: JwtPayload,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { body?: string },
  ) {
    if (!file) throw new BadRequestException('Διάλεξε εικόνα.');
    try {
      const mediaUrl = await this.storage.upload(file, 'messages');
      return await this.messages.sendMessage(conversationId, user.sub, body?.body, mediaUrl);
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw new BadRequestException('Η εικόνα δεν ανέβηκε. Δοκίμασε μια μικρότερη JPG ή PNG.');
    }
  }

  @Post(':conversationId/messages')
  sendMessage(
    @Param('conversationId') conversationId: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: SendMessageDto,
  ) {
    return this.messages.sendMessage(conversationId, user.sub, body.body, body.mediaUrl);
  }

  @Delete(':conversationId')
  removeConversation(
    @Param('schoolId') schoolId: string,
    @Param('conversationId') conversationId: string,
    @Query('scope') scope: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.messages.removeConversation(schoolId, conversationId, user.sub, scope === 'everyone' ? 'everyone' : 'me');
  }

  @Delete(':conversationId/messages/:messageId')
  deleteMessage(@Param('messageId') messageId: string, @CurrentUser() user: JwtPayload) {
    return this.messages.deleteMessage(messageId, user.sub);
  }
}
