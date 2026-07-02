import {
  Controller, Get, Post, Patch, Param,
  Body, Query, UseGuards, Request
} from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiOperation } from "@nestjs/swagger";
import { IncidentsService } from "./incidents.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { Roles } from "../../common/decorators/roles.decorator";

@ApiTags("Incidents")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("incidents")
export class IncidentsController {
  constructor(private readonly incidentsService: IncidentsService) {}

  @ApiOperation({ summary: "List incidents with optional filters" })
  @Get()
  findAll(
    @Query("status") status?: string,
    @Query("severity") severity?: string,
    @Query("assetId") assetId?: string,
    @Query("stationId") stationId?: string,
    @Query("limit") limit?: number,
  ) {
    return this.incidentsService.findAll({ status, severity, assetId, stationId, limit });
  }

  @ApiOperation({ summary: "Incident counts by status/severity" })
  @Get("stats")
  getStats() { return this.incidentsService.getStats(); }

  @ApiOperation({ summary: "Get single incident with events and recommendations" })
  @Get(":id")
  findOne(@Param("id") id: string) { return this.incidentsService.findOne(id); }

  @ApiOperation({ summary: "Get timeline events for an incident" })
  @Get(":id/timeline")
  getTimeline(@Param("id") id: string) { return this.incidentsService.getTimeline(id); }

  @ApiOperation({ summary: "Get similar incidents for the same asset type" })
  @Get(":id/similar")
  getSimilar(@Param("id") id: string, @Query("assetId") assetId: string) {
    return this.incidentsService.getSimilarIncidents(assetId, id);
  }

  @ApiOperation({ summary: "Full AI-assisted investigation package: similar, causes, timeline, recommendations" })
  @Get(":id/investigation")
  getInvestigation(@Param("id") id: string) {
    return this.incidentsService.getInvestigation(id);
  }

  @ApiOperation({ summary: "Create a new incident" })
  @Roles("ENGINEER", "OPERATOR", "ADMINISTRATOR", "SAFETY_OFFICER", "MAINTENANCE_MANAGER")
  @Post()
  create(@Body() body: any, @Request() req) {
    return this.incidentsService.create({ ...body, createdById: req.user.id });
  }

  @ApiOperation({ summary: "Update incident fields" })
  @Roles("ENGINEER", "OPERATOR", "ADMINISTRATOR", "SAFETY_OFFICER", "MAINTENANCE_MANAGER")
  @Patch(":id")
  update(@Param("id") id: string, @Body() body: any) {
    return this.incidentsService.update(id, body);
  }

  @ApiOperation({ summary: "Close / resolve an incident" })
  @Roles("ENGINEER", "ADMINISTRATOR", "SAFETY_OFFICER", "MAINTENANCE_MANAGER")
  @Post(":id/close")
  close(
    @Param("id") id: string,
    @Body() body: { resolution: string; rootCause?: string; lessonsLearned?: string },
  ) {
    return this.incidentsService.close(id, body.resolution, body.rootCause, body.lessonsLearned);
  }

  @ApiOperation({ summary: "Add a timeline event to an incident" })
  @Post(":id/events")
  addEvent(@Param("id") id: string, @Body() body: any) {
    return this.incidentsService.addEvent(id, body);
  }
}
