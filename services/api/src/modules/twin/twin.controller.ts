import { Controller, Get, UseGuards } from "@nestjs/common";
import { ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { TwinService } from "./twin.service";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";

@ApiTags("Digital Twin")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("twin")
export class TwinController {
  constructor(private readonly twinService: TwinService) {}

  @Get("state")
  getState() { return this.twinService.getState(); }

  @Get("layers")
  getLayers() { return this.twinService.getLayers(); }
}
