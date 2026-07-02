import { Controller, Post, Get, Param, Body, Query, UseGuards } from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiOperation } from "@nestjs/swagger";
import { MemoryService } from "./memory.service";
import { EmbeddingsService } from "./embeddings.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { Roles } from "../../common/decorators/roles.decorator";

@ApiTags("Railway Memory")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("memory")
export class MemoryController {
  constructor(
    private readonly memoryService: MemoryService,
    private readonly embeddingsService: EmbeddingsService,
  ) {}

  @ApiOperation({ summary: "Hybrid semantic + graph memory search" })
  @Post("search")
  search(@Body() body: {
    query: string;
    mode?: string;
    limit?: number;
    types?: string[];
    filters?: { assetType?: string };
  }) {
    return this.memoryService.search(body.query, {
      limit: body.limit,
      assetType: body.filters?.assetType,
      types: body.types,
    });
  }

  @ApiOperation({ summary: "Build knowledge package for agent context" })
  @Post("knowledge-package")
  buildKnowledgePackage(@Body() body: { query: string; assetId?: string }) {
    return this.memoryService.buildKnowledgePackage(body.query, body.assetId);
  }

  @ApiOperation({ summary: "Get all lessons learned" })
  @Get("lessons")
  getLessons(@Query("limit") limit?: number) {
    return this.memoryService.getLessons(limit);
  }

  @ApiOperation({ summary: "Get all procedures/SOPs" })
  @Get("procedures")
  getProcedures(@Query("limit") limit?: number) {
    return this.memoryService.getProcedures(limit);
  }

  // ─── Fixed: was using @Query("id") instead of @Param("id") ───────────────
  @ApiOperation({ summary: "Ingest an incident into vector memory" })
  @Post("ingest/incident/:id")
  ingestIncident(@Param("id") id: string) {
    return this.memoryService.ingestIncident(id);
  }

  @ApiOperation({ summary: "Ingest a lesson into vector memory" })
  @Post("ingest/lesson/:id")
  ingestLesson(@Param("id") id: string) {
    return this.memoryService.ingestLesson(id);
  }

  @ApiOperation({ summary: "Ingest a procedure into vector memory" })
  @Post("ingest/procedure/:id")
  ingestProcedure(@Param("id") id: string) {
    return this.memoryService.ingestProcedure(id);
  }

  @ApiOperation({ summary: "Batch ingest all incidents, lessons, procedures, maintenance records, and recommendations into vector memory (5 Qdrant collections)" })
  @Roles("ADMINISTRATOR", "ENGINEER")
  @Post("ingest-all")
  async ingestAll() {
    return this.memoryService.ingestAll();
  }

  @ApiOperation({ summary: "Get memory health stats (collection sizes)" })
  @Get("stats")
  async getStats() {
    const stats = await this.memoryService.getStats();
    return {
      ...stats,
      usingMockEmbeddings: this.embeddingsService.usingMockEmbeddings,
      embeddingMode: this.embeddingsService.usingMockEmbeddings
        ? "MOCK — similarity search results are non-semantic. Add OPENAI_API_KEY to enable real embeddings."
        : "REAL — OpenAI text-embedding-3-small",
    };
  }
}
