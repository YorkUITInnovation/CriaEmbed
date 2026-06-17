import { buildEmbedCriabotPrompt } from "../../src/services/embedPrompt";

describe("buildEmbedCriabotPrompt", () => {
  it("returns the original prompt when empty", () => {
    expect(buildEmbedCriabotPrompt("   ")).toBe("");
  });

  it("adds course scope and rewrites course-relative questions", () => {
    const prompt = buildEmbedCriabotPrompt(
      "can you tell me about this course learning outcomes?",
      {
        courseId: 13,
        courseName: "Art of Art",
        courseShortName: "ART101",
        name: "I am a student and my name is Alex",
        currentDate: "2026-06-09"
      }
    );

    expect(prompt).toContain('current course is "Art of Art"');
    expect(prompt).toContain("Moodle course id 13");
    expect(prompt).toContain("Alex");
    expect(prompt).toContain("Today's date is 2026-06-09");
    expect(prompt).toContain(
      'For the course "Art of Art": can you tell me about this course learning outcomes?'
    );
  });

  it("does not duplicate course title when already present", () => {
    const prompt = buildEmbedCriabotPrompt(
      "What are the Art of Art learning outcomes?",
      {
        courseName: "Art of Art"
      }
    );

    expect(prompt).not.toContain(
      'For the course "Art of Art": What are the Art of Art'
    );
    expect(prompt).toContain("q: What are the Art of Art learning outcomes?");
  });
});
