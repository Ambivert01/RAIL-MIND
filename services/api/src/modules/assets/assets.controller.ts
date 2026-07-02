import { Controller, Get, Param, Query, UseGuards } from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiQuery } from "@nestjs/swagger";
import { AssetsService } from "./assets.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";

@ApiTags("Assets")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("assets")
export class AssetsController {
  constructor(private readonly assetsService: AssetsService) {}

  @Get()
  @ApiQuery({ name: "type", required: false })
  @ApiQuery({ name: "status", required: false })
  @ApiQuery({ name: "stationId", required: false })
  findAll(
    @Query("type") type?: string,
    @Query("status") status?: string,
    @Query("stationId") stationId?: string,
  ) {
    return this.assetsService.findAll({ type, status, stationId });
  }

  @Get("twin")
  getTwinAssets() {
    return this.assetsService.getTwinAssets();
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.assetsService.findOne(id);
  }

  @Get(":id/profile")
  getProfile(@Param("id") id: string) {
    return this.assetsService.getProfile(id);
  }

  @Get("code/:code")
  findByCode(@Param("code") code: string) {
    return this.assetsService.findByCode(code);
  }
}
