import { Body, Controller, Delete, Get, Param, Post, Put, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PartyInvitationsService } from './party-invitations.service';

@Controller('schools/:schoolId/party-invitations')
@UseGuards(JwtAuthGuard)
export class PartyInvitationsController {
  constructor(private readonly service: PartyInvitationsService) {}

  @Get()
  list(@Param('schoolId') schoolId: string) {
    return this.service.list(schoolId);
  }

  @Get('received')
  listReceived(@Param('schoolId') schoolId: string, @Request() req: any) {
    return this.service.listReceived(schoolId, req.user.id);
  }

  @Get(':id')
  get(@Param('schoolId') schoolId: string, @Param('id') id: string) {
    return this.service.get(schoolId, id);
  }

  @Post()
  create(@Param('schoolId') schoolId: string, @Body() body: {
    birthdayStudentId: string;
    title: string;
    body?: string;
    imageUrl?: string;
    eventDate?: string;
    recipientStudentIds: string[];
  }) {
    return this.service.create(schoolId, body);
  }

  @Put(':id')
  update(
    @Param('schoolId') schoolId: string,
    @Param('id') id: string,
    @Body() body: {
      title?: string;
      body?: string;
      imageUrl?: string;
      eventDate?: string;
      recipientStudentIds?: string[];
    },
  ) {
    return this.service.update(schoolId, id, body);
  }

  @Delete(':id')
  delete(@Param('schoolId') schoolId: string, @Param('id') id: string) {
    return this.service.delete(schoolId, id);
  }

  @Post(':id/send')
  send(@Param('schoolId') schoolId: string, @Param('id') id: string) {
    return this.service.send(schoolId, id, false);
  }

  @Post(':id/remind')
  remind(@Param('schoolId') schoolId: string, @Param('id') id: string) {
    return this.service.send(schoolId, id, true);
  }
}
