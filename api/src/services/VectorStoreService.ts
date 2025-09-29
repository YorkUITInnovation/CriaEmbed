// VectorStoreService.ts
// Service for Elasticsearch/RAGFlow integration in CriaEmbed

import {Config} from "../config";
import {Client} from "@elastic/elasticsearch";

export class VectorStoreService {
  private client: Client;
  private index: string;

  constructor() {
    this.client = new Client({
      node: `http://${Config.ELASTICSEARCH_HOST}:${Config.ELASTICSEARCH_PORT}`,
      auth: Config.ELASTICSEARCH_USERNAME && Config.ELASTICSEARCH_PASSWORD ? {
        username: Config.ELASTICSEARCH_USERNAME,
        password: Config.ELASTICSEARCH_PASSWORD
      } : undefined,
      ssl: { rejectUnauthorized: false }
    });
    this.index = Config.ELASTICSEARCH_INDEX || "criaembed";
  }

  async indexExists(): Promise<boolean> {
    const { body } = await this.client.indices.exists({ index: this.index });
    return body as boolean;
  }

  async createIndex(): Promise<void> {
    if (!(await this.indexExists())) {
      await this.client.indices.create({
        index: this.index,
        body: {
          mappings: {
            properties: {
              embedding: { type: "dense_vector", dims: Config.RAGFLOW_EMBED_DIM || 768 },
              metadata: { type: "object" }
            }
          }
        }
      });
    }
  }

  // Add more methods for upsert/search as needed
}
