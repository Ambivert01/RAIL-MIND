import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Redis from "ioredis";

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis;
  private publisher: Redis;
  private subscriber: Redis;

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    const url = this.configService.get<string>("redis.url");
    const options = {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      retryStrategy: (times: number) => Math.min(times * 50, 2000),
    };

    try {
      this.client = new Redis(url, options);
      this.publisher = new Redis(url, options);
      this.subscriber = new Redis(url, options);

      await this.client.connect();
      this.logger.log("✅ Redis connected");
    } catch (error) {
      this.logger.error("❌ Failed to connect to Redis", error);
    }
  }

  async onModuleDestroy() {
    await this.client?.quit();
    await this.publisher?.quit();
    await this.subscriber?.quit();
    this.logger.log("🔌 Redis disconnected");
  }

  // ─── Cache Operations ──────────────────────────────────────────────────────

  async get<T>(key: string): Promise<T | null> {
    try {
      const val = await this.client.get(key);
      return val ? JSON.parse(val) : null;
    } catch { return null; }
  }

  async set(key: string, value: any, ttlSeconds?: number): Promise<void> {
    try {
      const str = JSON.stringify(value);
      if (ttlSeconds) {
        await this.client.setex(key, ttlSeconds, str);
      } else {
        await this.client.set(key, str);
      }
    } catch (error) {
      this.logger.warn(`Redis set failed for ${key}`);
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.client.del(key);
    } catch { }
  }

  async exists(key: string): Promise<boolean> {
    try {
      return (await this.client.exists(key)) > 0;
    } catch { return false; }
  }

  // ─── Pub/Sub (Event Bus) ───────────────────────────────────────────────────

  async publish(channel: string, message: any): Promise<void> {
    try {
      await this.publisher.publish(channel, JSON.stringify(message));
    } catch (error) {
      this.logger.warn(`Failed to publish to ${channel}`);
    }
  }

  async subscribe(
    channel: string,
    callback: (message: any) => void
  ): Promise<void> {
    try {
      await this.subscriber.subscribe(channel);
      this.subscriber.on("message", (ch, msg) => {
        if (ch === channel) {
          try {
            callback(JSON.parse(msg));
          } catch { callback(msg); }
        }
      });
    } catch (error) {
      this.logger.warn(`Failed to subscribe to ${channel}`);
    }
  }

  // ─── Stream (Durable Events) ───────────────────────────────────────────────

  async addToStream(stream: string, fields: Record<string, string>): Promise<string | null> {
    try {
      return await this.client.xadd(stream, "*", ...Object.entries(fields).flat());
    } catch { return null; }
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.client.ping();
      return true;
    } catch { return false; }
  }

  getClient(): Redis {
    return this.client;
  }
}
