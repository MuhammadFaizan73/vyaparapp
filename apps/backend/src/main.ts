import { NestFactory } from "@nestjs/core";
import { ValidationPipe, ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from "@nestjs/common";
import { json } from "express";
import { AppModule } from "./app.module";

@Catch()
class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger("Exception");

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const message = exception instanceof HttpException
      ? exception.getResponse()
      : { message: "Internal server error", detail: String(exception) };

    if (status >= 500) {
      this.logger.error(`${request.method} ${request.url} → ${status}`, exception instanceof Error ? exception.stack : String(exception));
    }

    response.status(status).json(message);
  }
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix("api");
  app.enableCors();
  // Whether a client's HTTP cache is allowed to store/reuse a response is decided by
  // THIS server's response headers, not by anything the request sends — without an
  // explicit "no-store" here, Android's OkHttp (the networking stack React Native sits
  // on by default) can cache a GET response using its own heuristics regardless of any
  // Cache-Control the client sent, so a party created via POST then re-fetched via GET
  // kept coming back from the on-device cache without the new row. Every route here is
  // either a live business record or an auth-scoped read — never something safe to cache.
  app.use((_req: any, res: any, next: any) => {
    res.setHeader("Cache-Control", "no-store");
    next();
  });
  app.use(json({ limit: "25mb" }));
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new AllExceptionsFilter());
  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`Vyapar API running on http://localhost:${port}/api`);
}
bootstrap();
