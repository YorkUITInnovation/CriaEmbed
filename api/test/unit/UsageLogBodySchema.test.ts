/**
 * Guards the tsoa body-validation contract for POST /internal/usage-logs.
 *
 * tsoa compiles `Record<string, any>` to a nestedObjectLiteral with no
 * declared keys; with `noImplicitAdditionalProperties: "silently-remove-extras"`
 * (tsoa.json) the generated validator then strips every key, and the row
 * persists `{}` (found live 2026-11-02: criabot-side usage-log rows lost
 * `other.status`). These fields must stay typed `unknown` so tsoa emits a
 * pass-through `any`. This test fails if they are ever re-typed.
 */
import * as path from "path";
import { MetadataGenerator } from "@tsoa/cli/dist/metadataGeneration/metadataGenerator";

describe("UsageLogCreateBody tsoa schema", () => {
  const controllerPath = path.join(
    __dirname,
    "../../src/controllers/internal/UsageLogController.ts"
  );
  const metadata = new MetadataGenerator(controllerPath, undefined, undefined, [
    controllerPath
  ]).Generate();

  const properties = (metadata.referenceTypeMap as any)["UsageLogCreateBody"]
    .properties as Array<{ name: string; type: { dataType: string } }>;
  const dataTypeOf = (name: string) =>
    properties.find(p => p.name === name)?.type?.dataType;

  it.each(["other", "group_responses", "request_payload", "response_payload"])(
    "compiles %s as pass-through 'any' (never a strippable Record)",
    field => {
      expect(dataTypeOf(field)).toBe("any");
    }
  );
});
