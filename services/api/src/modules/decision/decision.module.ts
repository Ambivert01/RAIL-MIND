import { Module } from "@nestjs/common";
import { DecisionService } from "./decision.service";
import { ConfigModule } from "@nestjs/config";

@Module({
  imports: [ConfigModule],
  providers: [DecisionService],
  exports: [DecisionService],
})
export class DecisionModule {}
