export type PersonalizationPayloadEntry = {
  variableName: string;
  systemMessage: string;
};

export function extractSessionPayload(
  sessionData: Record<string, unknown> | null | undefined
): Record<string, string> {
  if (!sessionData || typeof sessionData !== "object") {
    return {};
  }

  let raw: unknown = sessionData.payload;
  if (
    raw === undefined &&
    sessionData.sessionData &&
    typeof sessionData.sessionData === "object"
  ) {
    raw = (sessionData.sessionData as Record<string, unknown>).payload;
  }

  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return {};
  }

  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (value === null || value === undefined) {
      continue;
    }
    const text = String(value).trim();
    if (text.length > 0) {
      out[key] = text;
    }
  }
  return out;
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function resolvePersonalizationBlock(
  templates: PersonalizationPayloadEntry[] | null | undefined,
  payload: Record<string, string>
): string {
  if (!templates?.length || !payload || !Object.keys(payload).length) {
    return "";
  }

  const lines: string[] = [];
  for (const entry of templates) {
    const variableName = (entry?.variableName || "").trim();
    const systemMessage = (entry?.systemMessage || "").trim();
    if (!variableName || !systemMessage) {
      continue;
    }
    const value = payload[variableName];
    if (value === undefined || value === null || String(value).trim() === "") {
      continue;
    }
    const resolved = systemMessage.replace(
      new RegExp(`\\[${escapeRegExp(variableName)}\\]`, "g"),
      String(value)
    );
    lines.push(resolved);
  }

  return lines.join("\n").trim();
}
