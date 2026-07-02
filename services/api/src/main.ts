import { NestFactory } from "@nestjs/core";
import { ValidationPipe, Logger } from "@nestjs/common";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import { IoAdapter } from "@nestjs/platform-socket.io";
import { AppModule } from "./app.module";
import { GlobalExceptionFilter } from "./common/filters/global-exception.filter";
import helmet from "helmet";
import type { Request, Response } from "express";

async function bootstrap() {
  const logger = new Logger("Bootstrap");
  const app = await NestFactory.create(AppModule, {
    logger: ["log", "warn", "error", "debug"],
  });

  // ─── CORS ──────────────────────────────────────────────────────────────────
  const allowedOrigins = [
    "http://localhost:3000",
    ...(process.env.FRONTEND_URL ? [process.env.FRONTEND_URL] : []),
  ];

  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (curl, Postman, server-to-server)
      if (!origin) return callback(null, true);
      // Allow *.onrender.com for Render preview/production URLs
      if (
        allowedOrigins.includes(origin) ||
        /^https:\/\/[a-z0-9-]+\.onrender\.com$/.test(origin)
      ) {
        return callback(null, true);
      }
      callback(new Error(`CORS blocked: ${origin}`));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  });

  // ─── Security Headers (Helmet) ────────────────────────────────────────────
  app.use(helmet({
    crossOriginEmbedderPolicy: false,  // allow Mapbox iframes
    contentSecurityPolicy: false,      // allow Next.js inline scripts
  }));

  // ─── Global Exception Filter ───────────────────────────────────────────────
  app.useGlobalFilters(new GlobalExceptionFilter());

  // ─── Global Prefix ─────────────────────────────────────────────────────────
  app.setGlobalPrefix("api/v1");

  // ─── Validation ────────────────────────────────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    })
  );

  // ─── WebSocket Adapter ─────────────────────────────────────────────────────
  app.useWebSocketAdapter(new IoAdapter(app));

  // ─── Swagger ───────────────────────────────────────────────────────────────
  if (process.env.NODE_ENV !== "production") {
    const config = new DocumentBuilder()
      .setTitle("RailMind API")
      .setDescription("Cognitive Railway Operating System API")
      .setVersion("1.0")
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup("api/docs", app, document);
    logger.log("Swagger UI available at /api/docs");
  }

  // ─── Health Check (no auth — used by Render/load balancer) ─────────────────
  const httpAdapter = app.getHttpAdapter();
  httpAdapter.get("/api/v1/health", async (_req: Request, res: Response) => {
    try {
      // CQ-053 fix: actually check DB connectivity
      const appRef = app as any;
      const prisma = appRef.get?.("PrismaService");
      const dbOk = prisma ? await prisma.healthCheck().catch(() => false) : true;
      res.status(dbOk ? 200 : 503).json({
        status: dbOk ? "ok" : "degraded",
        db: dbOk ? "connected" : "unreachable",
        timestamp: new Date().toISOString(),
      });
    } catch {
      res.status(503).json({ status: "error", timestamp: new Date().toISOString() });
    }
  });

  const port = process.env.PORT || 3001;
  app.enableShutdownHooks(); // Fix 8: graceful shutdown for Docker/k8s

  await app.listen(port);

  // Graceful SIGTERM handler
  process.on("SIGTERM", async () => {
    await app.close();
    process.exit(0);
  });
  logger.log(`🚂 RailMind API running on port ${port}`);
  logger.log(`📊 Environment: ${process.env.NODE_ENV || "development"}`);
}

bootstrap();
