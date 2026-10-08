import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { Public } from '../../common/decorators/public.decorator';

@ApiTags('health')
@Controller('health')
export class HealthController {
  @Public()
  @Get()
  check() {
    const candidates = [
      join(process.cwd(), 'web-build-status.txt'),
      join(process.cwd(), 'apps/api/web-build-status.txt'),
      join(__dirname, '..', '..', '..', 'web-build-status.txt'),
    ];
    const file = candidates.find((path) => existsSync(path));
    const web = file ? readFileSync(file, 'utf8').slice(0, 2000) : 'unknown';
    return { status: 'ok', timestamp: new Date().toISOString(), web };
  }
}
