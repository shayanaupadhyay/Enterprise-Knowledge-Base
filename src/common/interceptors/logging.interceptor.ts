import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Request } from 'express';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

/**
 * Structured request/response timing log for every HTTP call.
 * Intentionally provider-agnostic so it can be swapped for OpenTelemetry
 * exporters later without touching controllers or services.
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const { method, originalUrl } = request;
    const startedAt = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          this.logger.log(`${method} ${originalUrl} +${Date.now() - startedAt}ms`);
        },
        error: (error: Error) => {
          this.logger.warn(
            `${method} ${originalUrl} failed after ${Date.now() - startedAt}ms: ${error.message}`,
          );
        },
      }),
    );
  }
}
