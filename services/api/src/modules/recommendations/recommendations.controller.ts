import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards, Request } from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiOperation } from "@nestjs/swagger";
import { RecommendationsService } from "./recommendations.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { Roles } from "../../common/decorators/roles.decorator";

@ApiTags("Recommendations")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("recommendations")
export class RecommendationsController {
  constructor(private readonly svc: RecommendationsService) {}

  @Get()
  findAll(
    @Query("status") status?: string,
    @Query("priority") priority?: string,
    @Query("assetId") assetId?: string,
  ) {
    return this.svc.findAll({ status, priority, assetId });
  }

  @Get("stats")
  getStats() { return this.svc.getStats(); }

  @Get(":id")
  findOne(@Param("id") id: string) { return this.svc.findOne(id); }

  @Roles("ENGINEER", "MAINTENANCE_MANAGER", "ADMINISTRATOR", "SAFETY_OFFICER")
  @Patch(":id")
  update(@Param("id") id: string, @Body() body: { action?: string; priority?: string; reason?: string }) {
    return this.svc.update(id, body);
  }

  @Roles("ENGINEER", "MAINTENANCE_MANAGER", "ADMINISTRATOR", "SAFETY_OFFICER")
  @Post()
  create(@Body() body: any) { return this.svc.create(body); }

  @Roles("ENGINEER", "MAINTENANCE_MANAGER", "ADMINISTRATOR", "SAFETY_OFFICER")
  @Post(":id/approve")
  approve(@Param("id") id: string, @Request() req) {
    return this.svc.approve(id, req.user.id);
  }

  @Roles("ENGINEER", "MAINTENANCE_MANAGER", "ADMINISTRATOR", "SAFETY_OFFICER")
  @Post(":id/reject")
  reject(@Param("id") id: string, @Body("note") note?: string) {
    return this.svc.reject(id, note);
  }

  @Roles("ENGINEER", "MAINTENANCE_MANAGER", "ADMINISTRATOR")
  @Post(":id/complete")
  complete(@Param("id") id: string, @Body("outcomeNote") note?: string) {
    return this.svc.complete(id, note);
  }
}
