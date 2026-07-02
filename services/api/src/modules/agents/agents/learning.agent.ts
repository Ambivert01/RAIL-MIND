import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../../database/prisma.service";
import { MemoryService } from "../../memory/memory.service";
import { AgentThought } from "@railmind/shared-types";

@Injectable()
export class LearningAgent {
  private readonly logger = new Logger(LearningAgent.name);

  constructor(
    private prisma: PrismaService,
    private memoryService: MemoryService,
  ) {}

  // ─── Called when an incident is closed — persists knowledge ───────────────
  async onIncidentClosed(incidentId: string, onThought?: (t: AgentThought) => void) {
    const thoughts: AgentThought[] = [];
    const emit = (step: string, detail: string) => {
      const t: AgentThought = {
        agentName: "LEARNING",
        step,
        detail,
        timestamp: new Date().toISOString(),
        isComplete: false,
      };
      thoughts.push(t);
      onThought?.(t);
    };

    emit("Initializing", "Capturing resolved incident into organizational memory...");

    const incident = await this.prisma.incident.findUnique({
      where: { id: incidentId },
      include: { asset: { select: { assetCode: true, assetType: true } } },
    });

    if (!incident || incident.status !== "RESOLVED") {
      emit("Skipped", "Incident not resolved yet — memory capture deferred");
      return { captured: false, thoughts };
    }

    emit("Ingesting to vector DB", `Embedding ${incident.incidentNumber} into semantic memory...`);

    // Ingest incident into Qdrant
    try {
      await this.memoryService.ingestIncident(incidentId);
      emit("Vector stored", `${incident.incidentNumber} indexed for semantic search`);
    } catch (e) {
      this.logger.warn(`Failed to ingest incident ${incidentId}: ${e.message}`);
      emit("Warning", "Vector ingestion failed — will retry on next search");
    }

    // Auto-create lesson learned if resolution and lessonsLearned exist
    if (incident.lessonsLearned && incident.rootCause) {
      emit("Creating lesson", "Extracting lesson learned from resolution...");
      try {
        const existing = await this.prisma.lessonLearned.findFirst({
          where: { incidentId },
        });

        if (!existing) {
          const lesson = await this.prisma.lessonLearned.create({
            data: {
              title: `Lesson from ${incident.incidentNumber}: ${incident.rootCause}`,
              content: incident.lessonsLearned,
              assetType: incident.asset?.assetType ?? null,
              incidentId,
              tags: [
                incident.rootCause.toLowerCase().replace(/\s+/g, "-"),
                incident.asset?.assetType?.toLowerCase() ?? "general",
                "auto-generated",
              ],
            },
          });
          // Ingest lesson into vector DB
          await this.memoryService.ingestLesson(lesson.id).catch(() => {});
          emit("Lesson created", `New lesson added: "${lesson.title.slice(0, 60)}..."`);
        } else {
          emit("Lesson exists", "Lesson already captured for this incident");
        }
      } catch (e) {
        this.logger.warn(`Failed to create lesson for ${incidentId}: ${e.message}`);
      }
    }

    // Create audit log entry
    try {
      await this.prisma.auditLog.create({
        data: {
          action: "KNOWLEDGE_CAPTURED",
          resourceType: "Incident",
          resourceId: incidentId,
          metadata: {
            incidentNumber: incident.incidentNumber,
            rootCause: incident.rootCause,
            hasLessons: !!incident.lessonsLearned,
          } as any,
        },
      });
    } catch { /* non-critical */ }

    const done: AgentThought = {
      agentName: "LEARNING",
      step: "Knowledge captured",
      detail: `${incident.incidentNumber} added to Railway Memory Network. Future investigations will reference this resolution.`,
      timestamp: new Date().toISOString(),
      isComplete: true,
    };
    thoughts.push(done);
    onThought?.(done);

    return { captured: true, incidentId, thoughts };
  }

  // ─── Run during investigation to capture context ───────────────────────────
  async run(
    input: { query: string; resolvedIncidents?: string[] },
    onThought?: (t: AgentThought) => void,
  ) {
    const thoughts: AgentThought[] = [];
    const emit = (step: string, detail: string) => {
      const t: AgentThought = {
        agentName: "LEARNING",
        step,
        detail,
        timestamp: new Date().toISOString(),
        isComplete: false,
      };
      thoughts.push(t);
      onThought?.(t);
    };

    emit("Initializing", "Scanning organizational memory for knowledge gaps...");

    // Ingest any newly resolved incidents passed in
    if (input.resolvedIncidents?.length) {
      emit("Ingesting", `Updating memory with ${input.resolvedIncidents.length} recent resolutions...`);
      for (const id of input.resolvedIncidents) {
        await this.memoryService.ingestIncident(id).catch(() => {});
      }
    }

    const [lessonCount, procedureCount] = await Promise.all([
      this.prisma.lessonLearned.count(),
      this.prisma.procedure.count(),
    ]);

    emit("Memory status", `Repository contains ${lessonCount} lessons and ${procedureCount} procedures`);

    const done: AgentThought = {
      agentName: "LEARNING",
      step: "Memory updated",
      detail: `Knowledge base current: ${lessonCount} lessons, ${procedureCount} SOPs indexed`,
      timestamp: new Date().toISOString(),
      isComplete: true,
    };
    thoughts.push(done);
    onThought?.(done);

    return {
      lessonCount,
      procedureCount,
      updated: input.resolvedIncidents?.length ?? 0,
      thoughts,
    };
  }
}
