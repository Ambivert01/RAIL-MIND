import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      // CQ-020 FIX: Only log queries in development — avoids memory pressure + SQL exposure in prod
      log: process.env.NODE_ENV === "development"
        ? [{ emit: "stdout", level: "query" }, { emit: "stdout", level: "warn" }]
        : [{ emit: "stdout", level: "error" }],
    });
  }

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log("✅ PostgreSQL connected via Prisma");
    } catch (error) {
      this.logger.error("❌ Failed to connect to PostgreSQL", error);
      throw error;
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log("🔌 PostgreSQL disconnected");
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }
}
