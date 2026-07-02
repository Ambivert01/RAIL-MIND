import { Module } from "@nestjs/common";
import { AgentsController } from "./agents.controller";
import { AgentsService } from "./agents.service";
import { ExecutiveAgent } from "./agents/executive.agent";
import { IncidentAgent } from "./agents/incident.agent";
import { KnowledgeAgent } from "./agents/knowledge.agent";
import { RiskAgent } from "./agents/risk.agent";
import { EngineerAgent } from "./agents/engineer.agent";
import { PlannerAgent } from "./agents/planner.agent";
import { LearningAgent } from "./agents/learning.agent";
import { PrismaService } from "../../database/prisma.service";
import { Neo4jService } from "../../database/neo4j.service";
import { QdrantService } from "../../database/qdrant.service";
import { MemoryService } from "../memory/memory.service";
import { EmbeddingsService } from "../memory/embeddings.service";
import { GraphService } from "../graph/graph.service";
import { RiskService } from "../risk/risk.service";
import { AgentsGateway } from "./agents.gateway";
import { RedisService } from "../../database/redis.service";
import { DecisionModule } from "../decision/decision.module";
import { DecisionService } from "../decision/decision.service";

@Module({
  imports: [DecisionModule],
  controllers: [AgentsController],
  providers: [
    AgentsService,
    ExecutiveAgent,
    IncidentAgent,
    KnowledgeAgent,
    RiskAgent,
    EngineerAgent,
    PlannerAgent,
    LearningAgent,
    PrismaService,
    Neo4jService,
    QdrantService,
    MemoryService,
    EmbeddingsService,
    GraphService,
    RiskService,
    AgentsGateway,
    RedisService,
    DecisionService,
  ],
  exports: [AgentsService, LearningAgent, DecisionService, AgentsGateway],
})
export class AgentsModule {}
