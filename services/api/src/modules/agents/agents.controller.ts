import { Controller, Get, Post, Body, Param, Query, UseGuards } from "@nestjs/common";
import { AskRailMindDto } from "./dto/ask-railmind.dto";
import { Throttle } from "@nestjs/throttler";
import { ApiTags, ApiBearerAuth, ApiOperation } from "@nestjs/swagger";
import { AgentsService } from "./agents.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";

@ApiTags("AI Agents")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("agents")
export class AgentsController {
  constructor(private readonly agentsService: AgentsService) {}

  @ApiOperation({ summary: "Ask RailMind a question — triggers full agent investigation" })
  @Throttle({ default: { limit: 5, ttl: 60000 } })  // 5 requests per minute — LLM cost guard
  @Post("ask")
  ask(@Body() body: { question: string; assetId?: string; incidentId?: string }) {
    return this.agentsService.ask({
      question: body.question,
      assetId: body.assetId,
      incidentId: body.incidentId,
    });
  }

  @Get()
  getStatus() {
    return this.agentsService.getAgentStatus();
  }

  @Get("history")
  getHistory(@Query("limit") limit?: string) {
    const parsedLimit = limit ? parseInt(limit, 10) : 20;
    // CQ-048 fix: limit arrives as string from HTTP, parse explicitly
    return this.agentsService.getAgentHistory(parsedLimit || 20);
  }

  @Get("runs/:id")
  getRun(@Param("id") id: string) {
    return this.agentsService.getAgentRun(id);
  }
}
