import { Controller, Get, Post, Param, Query, Body, UseGuards } from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { GraphService } from "./graph.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { Roles } from "../../common/decorators/roles.decorator";

@ApiTags("Knowledge Graph")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("graph")
export class GraphController {
  constructor(private readonly graphService: GraphService) {}

  @Roles("ADMINISTRATOR")
  @Post("query")
  queryGraph(@Body() body: { cypher: string; params?: Record<string, any> }) {
    return this.graphService.queryGraph(body.cypher, body.params);
  }

  @Get("node/:id/neighbours")
  getNeighbours(
    @Param("id") id: string,
    @Query("type") type: string = "Asset",
    @Query("depth") depth: number = 2,
  ) {
    return this.graphService.getNeighbours(id, type, depth);
  }

  @Get("incident/:id")
  getIncidentGraph(@Param("id") id: string) {
    return this.graphService.getIncidentGraph(id);
  }

  @Get("asset/:id")
  getAssetGraph(@Param("id") id: string) {
    return this.graphService.getAssetGraph(id);
  }

  @Get("search")
  searchNodes(
    @Query("q") query: string,
    @Query("types") types?: string,
  ) {
    return this.graphService.searchNodes(query, types?.split(","));
  }

  @Get("path")
  findPath(@Query("from") from: string, @Query("to") to: string) {
    return this.graphService.findPath(from, to);
  }

  @Get("stats")
  getStats() {
    return this.graphService.getStats();
  }

  @Roles("ADMINISTRATOR")
  @Post("seed")
  seedGraph() {
    return this.graphService.seedFromPostgres();
  }
}
