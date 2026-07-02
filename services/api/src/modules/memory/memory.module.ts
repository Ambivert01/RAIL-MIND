import { Module } from "@nestjs/common";
import { MemoryController } from "./memory.controller";
import { MemoryService } from "./memory.service";
import { EmbeddingsService } from "./embeddings.service";
import { PrismaService } from "../../database/prisma.service";
import { QdrantService } from "../../database/qdrant.service";
import { Neo4jService } from "../../database/neo4j.service";

@Module({
  controllers: [MemoryController],
  providers: [MemoryService, EmbeddingsService, PrismaService, QdrantService, Neo4jService],
  exports: [MemoryService, EmbeddingsService],
})
export class MemoryModule {}
