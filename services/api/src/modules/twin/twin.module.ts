import { Module } from "@nestjs/common";
import { TwinController } from "./twin.controller";
import { TwinService } from "./twin.service";
import { PrismaService } from "../../database/prisma.service";

@Module({
  controllers: [TwinController],
  providers: [TwinService, PrismaService],
  exports: [TwinService],
})
export class TwinModule {}
