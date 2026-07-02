import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import OpenAI from "openai";

@Injectable()
export class EmbeddingsService {
  private readonly logger = new Logger(EmbeddingsService.name);
  private openai: OpenAI | null = null;
  public usingMockEmbeddings = false;
  private readonly model = "text-embedding-3-small";
  private readonly dimension = 1536;

  constructor(private config: ConfigService) {
    const apiKey = this.config.get<string>("ai.openaiApiKey");
    if (apiKey && apiKey !== "sk-your-openai-key-here") {
      this.openai = new OpenAI({ apiKey });
      this.logger.log("✅ OpenAI embeddings initialized");
    } else {
      this.logger.warn("⚠️  No OpenAI key — using deterministic mock embeddings");
      this.usingMockEmbeddings = true;
    }
  }

  async embed(text: string): Promise<number[]> {
    if (this.openai) {
      try {
        const response = await this.openai.embeddings.create({
          model: this.model,
          input: text.slice(0, 8000),
        });
        return response.data[0].embedding;
      } catch (error) {
        this.logger.warn(`Embedding failed, using mock: ${error.message}`);
      }
    }
    return this.mockEmbed(text);
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    if (this.openai && texts.length > 0) {
      try {
        const response = await this.openai.embeddings.create({
          model: this.model,
          input: texts.map((t) => t.slice(0, 8000)),
        });
        return response.data.map((d) => d.embedding);
      } catch (error) {
        this.logger.warn(`Batch embedding failed, using mock: ${error.message}`);
      }
    }
    return texts.map((t) => this.mockEmbed(t));
  }

  /** Deterministic mock embedding based on text hash — consistent across runs */
  private mockEmbed(text: string): number[] {
    const seed = this.hashCode(text);
    const rng = this.seededRng(seed);
    const vec = Array.from({ length: this.dimension }, () => rng() * 2 - 1);
    const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0));
    return norm > 0 ? vec.map((v) => v / norm) : vec;
  }

  private hashCode(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
    }
    return Math.abs(hash);
  }

  private seededRng(seed: number): () => number {
    let s = seed;
    return () => {
      s = (s * 1664525 + 1013904223) & 0xffffffff;
      return (s >>> 0) / 0xffffffff;
    };
  }

  cosineSimilarity(a: number[], b: number[]): number {
    const dot = a.reduce((sum, ai, i) => sum + ai * (b[i] ?? 0), 0);
    const magA = Math.sqrt(a.reduce((s, v) => s + v * v, 0));
    const magB = Math.sqrt(b.reduce((s, v) => s + v * v, 0));
    return magA && magB ? dot / (magA * magB) : 0;
  }
}
