import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { StationsService } from "./stations.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";

@ApiTags("Stations")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("stations")
export class StationsController {
  constructor(private readonly stationsService: StationsService) {}

  @Get()
  findAll() {
    return this.stationsService.findAll();
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.stationsService.findOne(id);
  }

  @Get(":id/dashboard")
  getDashboard(@Param("id") id: string) {
    return this.stationsService.getDashboard(id);
  }
}
