import { Controller, Get, Post, Param, UseGuards } from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiOperation } from "@nestjs/swagger";
import { RiskService } from "./risk.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { Roles } from "../../common/decorators/roles.decorator";

@ApiTags("Risk")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("risk")
export class RiskController {
  constructor(private readonly riskService: RiskService) {}

  @ApiOperation({ summary: "Network-wide risk dashboard" })
  @Get("dashboard")
  getDashboard() { return this.riskService.getDashboard(); }

  @ApiOperation({ summary: "Geographic heatmap data for Digital Twin map" })
  @Get("heatmap")
  getHeatmap() { return this.riskService.getHeatmap(); }

  @ApiOperation({ summary: "7-day risk score trend" })
  @Get("trends")
  getTrends() { return this.riskService.getTrends(); }

  @ApiOperation({ summary: "30-day risk forecast per critical asset" })
  @Get("forecast")
  getForecast() { return this.riskService.getForecast(); }

  @ApiOperation({ summary: "Risk record for a specific asset" })
  @Get("assets/:assetId")
  getAssetRisk(@Param("assetId") assetId: string) {
    return this.riskService.getAssetRisk(assetId);
  }

  @ApiOperation({ summary: "Recalculate risk for all assets" })
  @Roles("ADMINISTRATOR", "SAFETY_OFFICER", "MAINTENANCE_MANAGER")
  @Post("recalculate")
  recalculateAll() { return this.riskService.recalculateAll(); }

  @ApiOperation({ summary: "Calculate risk for a single asset" })
  @Roles("ENGINEER", "ADMINISTRATOR", "SAFETY_OFFICER", "MAINTENANCE_MANAGER")
  @Post("assets/:assetId/calculate")
  calculateAsset(@Param("assetId") assetId: string) {
    return this.riskService.calculateAndSaveRisk(assetId);
  }
}
