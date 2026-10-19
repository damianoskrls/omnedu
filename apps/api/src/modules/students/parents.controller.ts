import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { StudentsService } from './students.service';

@ApiTags('parents')
@ApiBearerAuth('access-token')
@Controller('schools/:schoolId/parents')
export class ParentsController {
  constructor(private students: StudentsService) {}

  @Get()
  @Roles('school_admin')
  list(@Param('schoolId') schoolId: string) {
    return this.students.listParents(schoolId);
  }

  @Post()
  @Roles('school_admin')
  create(
    @Param('schoolId') schoolId: string,
    @Body() body: { fullName: string; email?: string; phone?: string; notes?: string },
  ) {
    return this.students.createStandaloneParent(schoolId, body);
  }

  @Get(':userId')
  @Roles('school_admin')
  one(@Param('schoolId') schoolId: string, @Param('userId') userId: string) {
    return this.students.getParent(schoolId, userId);
  }

  @Patch(':userId')
  @Roles('school_admin')
  update(
    @Param('schoolId') schoolId: string,
    @Param('userId') userId: string,
    @Body() body: { fullName?: string; email?: string; phone?: string; notes?: string },
  ) {
    return this.students.updateStandaloneParent(schoolId, userId, body);
  }

  @Delete(':userId')
  @Roles('school_admin')
  remove(@Param('schoolId') schoolId: string, @Param('userId') userId: string) {
    return this.students.deleteStandaloneParent(schoolId, userId);
  }

  @Post(':userId/children')
  @Roles('school_admin')
  linkChild(
    @Param('schoolId') schoolId: string,
    @Param('userId') userId: string,
    @Body() body: { studentId: string; relation?: string; isPrimary?: boolean },
  ) {
    return this.students.linkChildToParent(schoolId, userId, body.studentId, body);
  }

  @Delete(':userId/children/:studentId')
  @Roles('school_admin')
  unlinkChild(
    @Param('schoolId') schoolId: string,
    @Param('userId') userId: string,
    @Param('studentId') studentId: string,
  ) {
    return this.students.unlinkChildFromParent(schoolId, userId, studentId);
  }
}
