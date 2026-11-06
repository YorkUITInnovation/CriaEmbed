import { Config } from "../config.js";
import { Client } from "@elastic/elasticsearch";
import { CriaError } from "../models/CriaResponse.js";

const MAX_K = 50;
const MAX_METADATA_BYTES = 16 * 1024;
const NAMESPACE_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;

export class VectorStoreService {
  private client: Client;
  private index: string;
  private initialized: boolean = false;

  constructor() {
    this.client = new Client({
      node: `http://${Config.ELASTICSEARCH_HOST}:${Config.ELASTICSEARCH_PORT}`,
      auth:
        Config.ELASTICSEARCH_USERNAME && Config.ELASTICSEARCH_PASSWORD
          ? {
              username: Config.ELASTICSEARCH_USERNAME,
              password: Config.ELASTICSEARCH_PASSWORD
            }
          : undefined
    });
    this.index = Config.ELASTICSEARCH_INDEX || "criaembed";
  }

  private normalizeNamespace(botName: string): string {
    const trimmed = (botName || "").trim();
    if (!NAMESPACE_PATTERN.test(trimmed)) {
      throw new CriaError("Invalid bot identifier for vector namespace.", 400);
    }
    return trimmed;
  }

  private validateEmbedding(embedding: number[]): void {
    if (!Array.isArray(embedding) || embedding.length === 0) {
      throw new CriaError("Embedding must be a non-empty numeric vector.", 400);
    }
    const expectedDims = Number(Config.RAGFLOW_EMBED_DIM || 768);
    if (expectedDims > 0 && embedding.length !== expectedDims) {
      throw new CriaError(`Embedding dimension must be ${expectedDims}.`, 400);
    }
    if (!embedding.every(value => Number.isFinite(value))) {
      throw new CriaError("Embedding contains non-finite values.", 400);
    }
  }

  private validateMetadata(metadata: Record<string, any>): void {
    const encoded = JSON.stringify(metadata || {});
    if (!encoded || Buffer.byteLength(encoded, "utf8") > MAX_METADATA_BYTES) {
      throw new CriaError("Embedding metadata is invalid or too large.", 400);
    }
  }

  private validateK(k: number): number {
    if (!Number.isInteger(k) || k <= 0 || k > MAX_K) {
      throw new CriaError(`k must be an integer between 1 and ${MAX_K}.`, 400);
    }
    return k;
  }

  private toDocumentId(namespace: string, id: string): string {
    const rawId = String(id || "").trim();
    if (!rawId || rawId.length > 256) {
      throw new CriaError("Embedding id is invalid.", 400);
    }
    return `${namespace}:${encodeURIComponent(rawId)}`;
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
            embedding: {
              type: "dense_vector",
              dims: Number(Config.RAGFLOW_EMBED_DIM || 768)
            },
            metadata: {
              type: "object",
              properties: {
                botNamespace: { type: "keyword" }
              }
            }
          }
        }
      });
    } else {
      await this.client.indices.putMapping({
        index: this.index,
        properties: {
          metadata: {
            type: "object",
            properties: { botNamespace: { type: "keyword" } }
          }
        }
      });
    }
  }

  async upsert(
    botName: string,
    id: string,
    embedding: number[],
    metadata: Record<string, any>
  ): Promise<void> {
    const namespace = this.normalizeNamespace(botName);
    this.validateEmbedding(embedding);
    this.validateMetadata(metadata);
    const documentId = this.toDocumentId(namespace, id);
    await this.initialize();
    await this.client.index({
      index: this.index,
      id: documentId,
      body: {
        embedding,
        metadata: {
          ...(metadata || {}),
          botNamespace: namespace
        }
      }
    });
  }

  async search(
    botName: string,
    queryEmbedding: number[],
    k: number = 10
  ): Promise<any[]> {
    const namespace = this.normalizeNamespace(botName);
    this.validateEmbedding(queryEmbedding);
    const size = this.validateK(k);
    await this.initialize();
    const legacy = await this.client.count({
      index: this.index,
      query: {
        bool: { must_not: [{ exists: { field: "metadata.botNamespace" } }] }
      }
    });
    if (legacy.count > 0) {
      throw new CriaError(
        "Vector index contains unowned legacy documents. Re-upload under verified bot ownership and remove the old copies before searching.",
        409
      );
    }
    const scriptQuery = {
      script_score: {
        query: {
          bool: {
            filter: [{ term: { "metadata.botNamespace": namespace } }]
          }
        },
        script: {
          source: `cosineSimilarity(params.query_vector, 'embedding') + 1.0`,
          params: { query_vector: queryEmbedding }
        }
      }
    };
    const result = await this.client.search({
      index: this.index,
      size,
      query: scriptQuery
    });
    return result.hits?.hits || [];
  }

  async close(): Promise<void> {
    await this.client.close();
  }
}
