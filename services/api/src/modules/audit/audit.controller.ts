import { Controller, Get, Param, Query, UseGuards } from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiOperation } from "@nestjs/swagger";
import { AuditService } from "./audit.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { Roles } from "../../common/decorators/roles.decorator";

@ApiTags("Audit")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("audit")
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @ApiOperation({ summary: "Get audit logs (admin/safety officer only)" })
  @Roles("ADMINISTRATOR", "SAFETY_OFFICER")
  @Get("logs")
  getLogs(
    @Query("userId") userId?: string,
    @Query("resourceType") resourceType?: string,
    @Query("action") action?: string,
    @Query("limit") limit?: number,
  ) {
    return this.auditService.getLogs({ userId, resourceType, action, limit });
  }

  @ApiOperation({ summary: "Audit stats summary" })
  @Roles("ADMINISTRATOR", "SAFETY_OFFICER")
  @Get("stats")
  getStats() { return this.auditService.getStats(); }

  @ApiOperation({ summary: "Full agent decision trace by agent run ID" })
  @Get("decision/:id")
  getDecisionTrace(@Param("id") id: string) {
    return this.auditService.getDecisionTrace(id);
  }

  @ApiOperation({ summary: "Raw agent run trace" })
  @Get("agent-run/:id")
  getAgentRunTrace(@Param("id") id: string) {
    return this.auditService.getAgentRunTrace(id);
  }
}
