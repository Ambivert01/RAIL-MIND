import {
  Injectable,
  OnModuleInit,
  Logger,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { QdrantClient } from "@qdrant/js-client-rest";

export interface QdrantPoint {
  id: string; // Must be a valid UUID string — Qdrant supports UUID format
  vector: number[];
  payload: Record<string, any>;
}

export interface QdrantSearchResult {
  id: string;
  score: number;
  payload: Record<string, any>;
}

export const COLLECTIONS = {
  INCIDENTS: "incidents",
  LESSONS: "lessons",
  MAINTENANCE: "maintenance",
  PROCEDURES: "procedures",
  RECOMMENDATIONS: "recommendations",
  MANUALS: "manuals",
} as const;

export const VECTOR_SIZE = 1536; // OpenAI text-embedding-3-small dimension

@Injectable()
export class QdrantService implements OnModuleInit {
  private readonly logger = new Logger(QdrantService.name);
  private client: QdrantClient;

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    const url = this.configService.get<string>("qdrant.url");
    const apiKey = this.configService.get<string>("qdrant.apiKey");

    try {
      this.client = new QdrantClient({
        url,
        apiKey: apiKey || undefined,
      });
      await this.initializeCollections();
      this.logger.log("✅ Qdrant connected and collections initialized");
    } catch (error) {
      this.logger.error("❌ Failed to connect to Qdrant", error);
      // Don't throw — allow app to start without vector DB for basic ops
    }
  }

  private async initializeCollections() {
    const collections = Object.values(COLLECTIONS);
    for (const name of collections) {
      try {
        const exists = await this.collectionExists(name);
        if (!exists) {
          await this.client.createCollection(name, {
            vectors: {
              size: VECTOR_SIZE,
              distance: "Cosine",
            },
            optimizers_config: {
              indexing_threshold: 100,
            },
          });
          this.logger.log(`📦 Created Qdrant collection: ${name}`);
        }
      } catch (error) {
        this.logger.warn(`Could not init collection ${name}: ${error.message}`);
      }
    }
  }

  async collectionExists(name: string): Promise<boolean> {
    try {
      const collections = await this.client.getCollections();
      return collections.collections.some((c) => c.name === name);
    } catch {
      return false;
    }
  }

  /** Upsert a vector point into a collection */
  async upsert(
    collection: string,
    points: QdrantPoint[]
  ): Promise<void> {
    if (!this.client || points.length === 0) return;
    try {
      await this.client.upsert(collection, {
        wait: true,
        points: points.map((p) => ({
          id: p.id,
          vector: p.vector,
          payload: p.payload,
        })),
      });
    } catch (error) {
      this.logger.error(`Failed to upsert to ${collection}:`, error);
      throw error;
    }
  }

  /** Semantic search across a collection */
  async search(
    collection: string,
    vector: number[],
    limit = 5,
    filter?: Record<string, any>
  ): Promise<QdrantSearchResult[]> {
    if (!this.client) return [];
    try {
      const results = await this.client.search(collection, {
        vector,
        limit,
        with_payload: true,
        filter,
      });
      return results.map((r) => ({
        id: String(r.id),
        score: r.score,
        payload: r.payload as Record<string, any>,
      }));
    } catch (error) {
      this.logger.error(`Search failed in ${collection}:`, error);
      return [];
    }
  }

  /** Search across multiple collections and merge results */
  async searchMultiCollection(
    collections: string[],
    vector: number[],
    limit = 5
  ): Promise<QdrantSearchResult[]> {
    const allResults: QdrantSearchResult[] = [];
    for (const col of collections) {
      const results = await this.search(col, vector, limit);
      allResults.push(...results.map((r) => ({ ...r, collection: col })));
    }
    return allResults
      .sort((a, b) => b.score - a.score)
      .slice(0, limit * 2);
  }

  /** Delete a point from a collection */
  async delete(collection: string, id: string): Promise<void> {
    if (!this.client) return;
    try {
      await this.client.delete(collection, {
        wait: true,
        points: [id],
      });
    } catch (error) {
      this.logger.warn(`Failed to delete ${id} from ${collection}`);
    }
  }

  /** Get collection stats */
  async getCollectionInfo(collection: string) {
    if (!this.client) return null;
    try {
      return await this.client.getCollection(collection);
    } catch {
      return null;
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      if (!this.client) return false;
      await this.client.getCollections();
      return true;
    } catch {
      return false;
    }
  }
}
