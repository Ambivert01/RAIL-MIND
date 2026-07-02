import { Module, forwardRef } from "@nestjs/common";
import { IncidentsController } from "./incidents.controller";
import { IncidentsService } from "./incidents.service";
import { PrismaService } from "../../database/prisma.service";
import { MemoryService } from "../memory/memory.service";
import { EmbeddingsService } from "../memory/embeddings.service";
import { QdrantService } from "../../database/qdrant.service";
import { Neo4jService } from "../../database/neo4j.service";
import { AgentsModule } from "../agents/agents.module";

@Module({
  imports: [forwardRef(() => AgentsModule)],
  controllers: [IncidentsController],
  providers: [IncidentsService, PrismaService, MemoryService, EmbeddingsService, QdrantService, Neo4jService],
  exports: [IncidentsService],
})
export class IncidentsModule {}
