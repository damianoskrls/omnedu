import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const uploadProblem = this.uploadProblem(exception);
    const status = uploadProblem
      ? HttpStatus.BAD_REQUEST
      : exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message = uploadProblem
      ? uploadProblem
      : exception instanceof HttpException
        ? exception.getResponse()
        : 'Internal server error';

    if (status >= 500) {
      this.logger.error(exception);
    }

    response.status(status).json({
      success: false,
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      message: typeof message === 'object' ? (message as any).message : message,
    });
  }

  private uploadProblem(exception: unknown) {
    const error = exception as { name?: string; code?: string; message?: string; type?: string };
    if (error?.name === 'MulterError' || error?.code === 'LIMIT_FILE_SIZE') {
      return error.code === 'LIMIT_FILE_SIZE'
        ? 'Το αρχείο είναι πολύ μεγάλο. Δοκίμασε JPG ή PDF μέχρι 20 MB.'
        : 'Το αρχείο δεν ανέβηκε. Δοκίμασε ξανά JPG ή PDF.';
    }
    const text = `${error?.message || ''} ${error?.type || ''}`;
    if (/boundary|multipart|unsupported content type/i.test(text)) {
      return 'Το αρχείο δεν ανέβηκε σωστά. Δοκίμασε ξανά JPG ή PDF.';
    }
    return '';
  }
}
