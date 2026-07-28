import {
  extractSessionPayload,
  resolvePersonalizationBlock
} from "../../src/services/personalizationPayload.js";

describe("personalizationPayload", () => {
  it("extracts payload from session body", () => {
    expect(
      extractSessionPayload({
        payload: { year_of_study: "3rd year", faculty: "Science" }
      })
    ).toEqual({ year_of_study: "3rd year", faculty: "Science" });
  });

  it("extracts nested sessionData.payload", () => {
    expect(
      extractSessionPayload({
        sessionData: { payload: { faculty: "Arts" } }
      })
    ).toEqual({ faculty: "Arts" });
  });

  it("resolves present variables and skips missing entries", () => {
    const block = resolvePersonalizationBlock(
      [
        {
          variableName: "year_of_study",
          systemMessage: "I am a [year_of_study] student."
        },
        { variableName: "faculty", systemMessage: "My Faculty is [faculty]." },
        { variableName: "major", systemMessage: "My major is [major]." }
      ],
      { year_of_study: "3rd year", faculty: "Science" }
    );
    expect(block).toBe("I am a 3rd year student.\nMy Faculty is Science.");
  });

  it("returns empty when no templates or payload", () => {
    expect(resolvePersonalizationBlock([], { a: "1" })).toBe("");
    expect(
      resolvePersonalizationBlock(
        [{ variableName: "a", systemMessage: "Hi [a]" }],
        {}
      )
    ).toBe("");
  });
});
