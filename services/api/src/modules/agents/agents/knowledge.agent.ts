import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../../database/prisma.service";
import { Neo4jService } from "../../../database/neo4j.service";
import { MemoryService } from "../../memory/memory.service";
import { AgentThought } from "@railmind/shared-types";

@Injectable()
export class KnowledgeAgent {
  private readonly logger = new Logger(KnowledgeAgent.name);

  constructor(
    private prisma: PrismaService,
    private neo4j: Neo4jService,
    private memoryService: MemoryService,
  ) {}

  async run(
    input: { query: string; assetId?: string; incidentIds?: string[] },
    onThought?: (t: AgentThought) => void,
  ) {
    const thoughts: AgentThought[] = [];
    const emit = (step: string, detail: string) => {
      const t: AgentThought = { agentName: "KNOWLEDGE", step, detail, timestamp: new Date().toISOString(), isComplete: false };
      thoughts.push(t);
      onThought?.(t);
    };

    emit("Initializing", "Accessing Railway Memory Network...");

    // Retrieve lessons learned
    emit("Searching lessons", "Looking for relevant lessons learned...");
    const lessons = await this.prisma.lessonLearned.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    const relevantLessons = lessons.filter((l) => {
      const text = `${l.title} ${l.content}`.toLowerCase();
      const queryWords = input.query.toLowerCase().split(" ");
      return queryWords.some((w) => w.length > 3 && text.includes(w));
    });

    emit("Lessons found", `${relevantLessons.length} relevant lessons from organizational memory`);

    // Retrieve applicable procedures
    emit("Searching procedures", "Loading applicable SOPs and procedures...");
    const procedures = await this.prisma.procedure.findMany({ take: 5 });
    emit("Procedures loaded", `${procedures.length} procedures available`);

    // Graph context
    emit("Exploring graph", "Traversing knowledge graph for relationships...");
    let graphContext: any[] = [];
    if (input.assetId) {
      try {
        graphContext = await this.neo4j.query(
          `MATCH (a {id: $id})-[r*1..2]-(related)
           RETURN a, type(r[0]) as relType, related
           LIMIT 15`,
          { id: input.assetId },
        );
      } catch {
        emit("Graph", "Knowledge graph query skipped (connection unavailable)");
      }
    }
    emit("Graph traversal complete", `Found ${graphContext.length} related entities`);

    const done: AgentThought = {
      agentName: "KNOWLEDGE",
      step: "Done",
      detail: `Retrieved ${relevantLessons.length} lessons, ${procedures.length} procedures, ${graphContext.length} graph connections`,
      timestamp: new Date().toISOString(),
      isComplete: true,
    };
    thoughts.push(done);
    onThought?.(done);

    return {
      lessons: relevantLessons,
      procedures,
      graphContext,
      historicalContext: relevantLessons.map((l) => l.content).join(". "),
      thoughts,
      confidence: 80 + Math.min(15, relevantLessons.length * 3),
    };
  }
}
