import { Module } from "@nestjs/common";
import { GraphController } from "./graph.controller";
import { GraphService } from "./graph.service";
import { Neo4jService } from "../../database/neo4j.service";
import { PrismaService } from "../../database/prisma.service";

@Module({
  controllers: [GraphController],
  providers: [GraphService, Neo4jService, PrismaService],
  exports: [GraphService],
})
export class GraphModule {}
