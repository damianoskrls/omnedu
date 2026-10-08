import { Controller, Get, Param } from '@nestjs/common';
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

  @Get(':userId')
  @Roles('school_admin')
  one(@Param('schoolId') schoolId: string, @Param('userId') userId: string) {
    return this.students.getParent(schoolId, userId);
  }
}
