import { Module } from "@nestjs/common";
import { SearchController } from "./search.controller";
import { SearchService } from "./search.service";
import { PrismaService } from "../../database/prisma.service";
import { MemoryService } from "../memory/memory.service";
import { EmbeddingsService } from "../memory/embeddings.service";
import { QdrantService } from "../../database/qdrant.service";
import { Neo4jService } from "../../database/neo4j.service";

@Module({
  controllers: [SearchController],
  providers: [SearchService, PrismaService, MemoryService, EmbeddingsService, QdrantService, Neo4jService],
  exports: [SearchService],
})
export class SearchModule {}
