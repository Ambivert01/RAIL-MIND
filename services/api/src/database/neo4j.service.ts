import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import neo4j, { Driver, Session, QueryResult } from "neo4j-driver";

@Injectable()
export class Neo4jService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(Neo4jService.name);
  private driver: Driver;

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    const uri = this.configService.get<string>("neo4j.uri");
    const user = this.configService.get<string>("neo4j.user");
    const password = this.configService.get<string>("neo4j.password");

    try {
      this.driver = neo4j.driver(uri, neo4j.auth.basic(user, password), {
        maxConnectionPoolSize: 50,
        connectionAcquisitionTimeout: 30000,
        maxTransactionRetryTime: 30000,
      });
      await this.driver.verifyConnectivity();
      this.logger.log("✅ Neo4j connected");
    } catch (error) {
      this.logger.error("❌ Failed to connect to Neo4j", error);
      // Don't throw — app can run without graph for initial setup
    }
  }

  async onModuleDestroy() {
    if (this.driver) {
      await this.driver.close();
      this.logger.log("🔌 Neo4j disconnected");
    }
  }

  getSession(database?: string, write = true): Session {
    if (!this.driver) throw new Error('Neo4j driver not initialized');
    return this.driver.session({
      database: database || "neo4j",
      defaultAccessMode: write ? neo4j.session.WRITE : neo4j.session.READ,
    });
  }

  /** Execute a read Cypher query and return all records */
  async query<T = Record<string, any>>(
    cypher: string,
    params: Record<string, any> = {}
  ): Promise<T[]> {
    const session = this.driver.session({ database: "neo4j", defaultAccessMode: neo4j.session.READ });
    try {
      const result: QueryResult = await session.executeRead((tx) => tx.run(cypher, params));
      return result.records.map((record) => {
        const obj: Record<string, any> = {};
        record.keys.forEach((key) => {
          const val = record.get(key);
          obj[key as string] = this.convertNeo4jValue(val);
        });
        return obj as T;
      });
    } finally {
      await session.close();
    }
  }

  /** Execute a write transaction */
  async write<T = Record<string, any>>(
    cypher: string,
    params: Record<string, any> = {}
  ): Promise<T[]> {
    const session = this.getSession();
    try {
      const result = await session.executeWrite((tx) => tx.run(cypher, params));
      return result.records.map((record) => {
        const obj: Record<string, any> = {};
        record.keys.forEach((key) => {
          obj[key as string] = this.convertNeo4jValue(record.get(key));
        });
        return obj as T;
      });
    } finally {
      await session.close();
    }
  }

  /** Run multiple queries in a single transaction */
  async runTransaction(
    queries: { cypher: string; params?: Record<string, any> }[]
  ): Promise<void> {
    const session = this.getSession();
    try {
      await session.executeWrite(async (tx) => {
        for (const q of queries) {
          await tx.run(q.cypher, q.params || {});
        }
      });
    } finally {
      await session.close();
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      if (!this.driver) return false;
      await this.driver.verifyConnectivity();
      return true;
    } catch {
      return false;
    }
  }

  /** Convert Neo4j integer/date to JS primitives */
  private convertNeo4jValue(val: any): any {
    if (val === null || val === undefined) return val;
    if (neo4j.isInt(val)) return val.toNumber();
    if (val instanceof Date) return val.toISOString();
    if (Array.isArray(val)) return val.map((v) => this.convertNeo4jValue(v));
    if (typeof val === "object" && val.constructor?.name === "Node") {
      return {
        id: this.convertNeo4jValue(val.identity),
        labels: val.labels,
        properties: Object.fromEntries(
          Object.entries(val.properties).map(([k, v]) => [
            k,
            this.convertNeo4jValue(v),
          ])
        ),
      };
    }
    if (typeof val === "object" && val.constructor?.name === "Relationship") {
      return {
        id: this.convertNeo4jValue(val.identity),
        type: val.type,
        start: this.convertNeo4jValue(val.start),
        end: this.convertNeo4jValue(val.end),
        properties: Object.fromEntries(
          Object.entries(val.properties).map(([k, v]) => [
            k,
            this.convertNeo4jValue(v),
          ])
        ),
      };
    }
    return val;
  }
}
