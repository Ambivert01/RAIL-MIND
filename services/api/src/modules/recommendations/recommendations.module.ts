import { Module } from "@nestjs/common";
import { RecommendationsController } from "./recommendations.controller";
import { RecommendationsService } from "./recommendations.service";
import { PrismaService } from "../../database/prisma.service";

@Module({
  controllers: [RecommendationsController],
  providers: [RecommendationsService, PrismaService],
  exports: [RecommendationsService],
})
export class RecommendationsModule {}
