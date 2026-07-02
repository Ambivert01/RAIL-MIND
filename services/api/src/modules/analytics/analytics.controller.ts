import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiOperation } from "@nestjs/swagger";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { AnalyticsService } from "./analytics.service";

@ApiTags("Analytics")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("analytics")
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @ApiOperation({ summary: "Main dashboard KPIs and knowledge growth" })
  @Get("dashboard")
  getDashboard() {
    return this.analyticsService.getDashboard();
  }

  @ApiOperation({ summary: "Incident breakdown by severity, status, asset type, and trend" })
  @Get("incidents")
  getIncidentAnalytics() {
    return this.analyticsService.getIncidentAnalytics();
  }

  @ApiOperation({ summary: "Risk distribution, top risks, and 7-day trend" })
  @Get("risk")
  getRiskAnalytics() {
    return this.analyticsService.getRiskAnalytics();
  }

  @ApiOperation({ summary: "Knowledge growth: lessons, procedures, agent investigations" })
  @Get("knowledge")
  getKnowledgeAnalytics() {
    return this.analyticsService.getKnowledgeAnalytics();
  }
}
