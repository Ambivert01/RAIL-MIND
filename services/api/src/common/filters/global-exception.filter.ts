import {
  ExceptionFilter, Catch, ArgumentsHost, HttpException,
  HttpStatus, Logger,
} from "@nestjs/common";
import { Request, Response } from "express";

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();

    const isProd = process.env.NODE_ENV === "production";

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = "Internal server error";
    let details: any = undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const resp = exception.getResponse();
      message = typeof resp === "string" ? resp : (resp as any).message ?? message;
      if (!isProd && typeof resp === "object") details = resp;
    } else if (exception instanceof Error) {
      message = isProd ? "Internal server error" : exception.message;
      if (!isProd) details = { stack: exception.stack?.split("\n").slice(0, 5) };
      if (status === 500) this.logger.error(`Unhandled: ${exception.message}`, exception.stack);
    }

    res.status(status).json({
      statusCode: status,
      message: Array.isArray(message) ? message[0] : message,
      errors: Array.isArray(message) ? message : undefined,
      path: req.url,
      timestamp: new Date().toISOString(),
      ...(details && !isProd ? { details } : {}),
    });
  }
}
