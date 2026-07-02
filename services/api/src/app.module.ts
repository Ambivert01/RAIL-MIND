import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { ThrottlerModule } from "@nestjs/throttler";
import { ScheduleModule } from "@nestjs/schedule";
import { APP_GUARD } from "@nestjs/core";

import configuration from "./config/configuration";
import { PrismaService } from "./database/prisma.service";
import { Neo4jService } from "./database/neo4j.service";
import { QdrantService } from "./database/qdrant.service";
import { RedisService } from "./database/redis.service";
import { RolesGuard } from "./common/guards/roles.guard";

import { AuthModule } from "./modules/auth/auth.module";
import { AssetsModule } from "./modules/assets/assets.module";
import { StationsModule } from "./modules/stations/stations.module";
import { IncidentsModule } from "./modules/incidents/incidents.module";
import { RiskModule } from "./modules/risk/risk.module";
import { MemoryModule } from "./modules/memory/memory.module";
import { GraphModule } from "./modules/graph/graph.module";
import { AgentsModule } from "./modules/agents/agents.module";
import { RecommendationsModule } from "./modules/recommendations/recommendations.module";
import { NotificationsModule } from "./modules/notifications/notifications.module";
import { TwinModule } from "./modules/twin/twin.module";
import { AnalyticsModule } from "./modules/analytics/analytics.module";
import { SearchModule } from "./modules/search/search.module";
import { MaintenanceModule } from "./modules/maintenance/maintenance.module";
import { UsersModule } from "./modules/users/users.module";
import { AuditModule } from "./modules/audit/audit.module";
import { DecisionModule } from "./modules/decision/decision.module";

@Module({
  imports: [
    // ─── Configuration ──────────────────────────────────────────────────────
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: [".env", "../../.env"],
    }),

    // ─── Rate Limiting ──────────────────────────────────────────────────────
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 200 }]),

    // ─── Task Scheduling ────────────────────────────────────────────────────
    ScheduleModule.forRoot(),

    // ─── Feature Modules ────────────────────────────────────────────────────
    AuthModule,
    AssetsModule,
    StationsModule,
    IncidentsModule,
    RiskModule,
    MemoryModule,
    GraphModule,
    AgentsModule,
    RecommendationsModule,
    NotificationsModule,
    TwinModule,
    AnalyticsModule,
    SearchModule,
    MaintenanceModule,
    UsersModule,
    AuditModule,
    DecisionModule,
  ],
  providers: [
    PrismaService,
    Neo4jService,
    QdrantService,
    RedisService,
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
  exports: [PrismaService, Neo4jService, QdrantService, RedisService],
})
export class AppModule {}
