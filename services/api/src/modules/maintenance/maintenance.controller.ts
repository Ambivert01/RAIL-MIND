import { Controller, Get, Post, Patch, Param, Body, Query, UseGuards, Request } from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiOperation } from "@nestjs/swagger";
import { MaintenanceService } from "./maintenance.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { Roles } from "../../common/decorators/roles.decorator";

@ApiTags("Maintenance")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("maintenance")
export class MaintenanceController {
  constructor(private readonly maintenanceService: MaintenanceService) {}

  @ApiOperation({ summary: "Risk-prioritised maintenance queue" })
  @Get("queue")
  getQueue() { return this.maintenanceService.getQueue(); }

  @ApiOperation({ summary: "Maintenance stats summary" })
  @Get("stats")
  getStats() { return this.maintenanceService.getStats(); }

  @ApiOperation({ summary: "List work orders (maintenance records)" })
  @Get("work-orders")
  getWorkOrders(
    @Query("status") status?: string,
    @Query("assetId") assetId?: string,
  ) {
    return this.maintenanceService.getWorkOrders({ status, assetId });
  }

  @ApiOperation({ summary: "Get single work order" })
  @Get("work-orders/:id")
  getWorkOrder(@Param("id") id: string) {
    return this.maintenanceService.getWorkOrder(id);
  }

  @ApiOperation({ summary: "Create a new work order" })
  @Roles("ENGINEER", "MAINTENANCE_MANAGER", "ADMINISTRATOR")
  @Post("work-orders")
  createWorkOrder(@Body() body: any, @Request() req) {
    return this.maintenanceService.createWorkOrder({
      ...body,
      performedById: body.performedById ?? req.user.id,
    });
  }

  @ApiOperation({ summary: "Update a work order" })
  @Roles("ENGINEER", "MAINTENANCE_MANAGER", "ADMINISTRATOR")
  @Patch("work-orders/:id")
  updateWorkOrder(@Param("id") id: string, @Body() body: any) {
    return this.maintenanceService.updateWorkOrder(id, body);
  }

  @ApiOperation({ summary: "Get maintenance history for an asset" })
  @Get("assets/:id/history")
  getAssetHistory(@Param("id") id: string) {
    return this.maintenanceService.getAssetHistory(id);
  }
}
