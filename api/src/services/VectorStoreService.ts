// VectorStoreService.ts
// Service for Elasticsearch/RAGFlow integration in CriaEmbed

import {Config} from "../config";
import {Client} from "@elastic/elasticsearch";

export class VectorStoreService {
  private client: Client;
  private index: string;
  private initialized: boolean = false;

  constructor() {
    this.client = new Client({
      node: `http://${Config.ELASTICSEARCH_HOST}:${Config.ELASTICSEARCH_PORT}`,
      auth: Config.ELASTICSEARCH_USERNAME && Config.ELASTICSEARCH_PASSWORD ? {
        username: Config.ELASTICSEARCH_USERNAME,
        password: Config.ELASTICSEARCH_PASSWORD
      } : undefined
    });
    this.index = Config.ELASTICSEARCH_INDEX || "criaembed";
  }

  private async initialize(): Promise<void> {
    if (!this.initialized) {
      await this.createIndex();
      this.initialized = true;
    }
  }

  async indexExists(): Promise<boolean> {
    return await this.client.indices.exists({ index: this.index });
  }

  async createIndex(): Promise<void> {
    if (!(await this.indexExists())) {
      await this.client.indices.create({
        index: this.index,
        mappings: {
          properties: {
            embedding: { type: "dense_vector", dims: Config.RAGFLOW_EMBED_DIM || 768 },
            metadata: { type: "object" }
          }
        }
      });
    }
  }

  // Add more methods for upsert/search as needed
    async upsert(id: string, embedding: number[], metadata: Record<string, any>): Promise<void> {
      await this.initialize();
      await this.client.index({
        index: this.index,
        id,
        body: {
          embedding,
          metadata
        }
      });
    }

    async search(queryEmbedding: number[], k: number = 10): Promise<any[]> {
      await this.initialize();
      const scriptQuery = {
        script_score: {
          query: { match_all: {} },
          script: {
            source: `cosineSimilarity(params.query_vector, 'embedding') + 1.0`,
            params: { query_vector: queryEmbedding }
          }
        }
      };
      const result = await this.client.search({
        index: this.index,
        size: k,
        query: scriptQuery
      });
      // @ts-ignore
      return result.hits?.hits || [];
    }
}