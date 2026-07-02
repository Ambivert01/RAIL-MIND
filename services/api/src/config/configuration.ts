export default () => ({
  port: parseInt(process.env.PORT || "3001", 10),
  nodeEnv: process.env.NODE_ENV || "development",

  database: {
    url: process.env.DATABASE_URL,
  },

  neo4j: {
    uri: process.env.NEO4J_URI || "bolt://localhost:7687",
    user: process.env.NEO4J_USER || "neo4j",
    password: process.env.NEO4J_PASSWORD || "railmind_neo4j",
  },

  qdrant: {
    url: process.env.QDRANT_URL || "http://localhost:6333",
    apiKey: process.env.QDRANT_API_KEY,
  },

  redis: {
    url: process.env.REDIS_URL || "redis://localhost:6379",
  },

  // minio: reserved for future file storage implementation

  jwt: {
    secret: (() => {
      const secret = process.env.JWT_SECRET;
      if (!secret || secret === "railmind_dev_secret") {
        if (process.env.NODE_ENV === "production") {
          throw new Error("JWT_SECRET must be set in production — refusing to start with default");
        }
        console.warn("⚠️  JWT_SECRET not set — using insecure default (development only)");
      }
      return secret || "railmind_dev_secret";
    })(),
    expiry: process.env.JWT_EXPIRY || "7d",
    refreshExpiry: process.env.REFRESH_TOKEN_EXPIRY || "30d",
  },

  ai: {
    openaiApiKey: process.env.OPENAI_API_KEY,
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    defaultModel: process.env.AI_MODEL || "gpt-4o-mini",
    embeddingModel: process.env.EMBEDDING_MODEL || "text-embedding-3-small",
  },

  frontend: {
    url: process.env.FRONTEND_URL || "http://localhost:3000",
  },
});
