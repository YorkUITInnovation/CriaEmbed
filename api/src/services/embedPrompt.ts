type TrackingData = Record<string, unknown> | null | undefined;

function pickString(data: TrackingData, keys: string[]): string {
  if (!data || typeof data !== "object") {
    return "";
  }

  for (const key of keys) {
    const value = data[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }

  return "";
}

function rewriteCourseRelativeQuery(
  prompt: string,
  courseTitle: string
): string {
  const trimmedPrompt = prompt.trim();
  if (!trimmedPrompt || !courseTitle) {
    return trimmedPrompt;
  }

  if (trimmedPrompt.toLowerCase().includes(courseTitle.toLowerCase())) {
    return trimmedPrompt;
  }

  const refersToThisCourse =
    /\b(this course|the course|our course|course learning|learning outcomes?|course outcomes?|syllabus)\b/i.test(
      trimmedPrompt
    );

  if (!refersToThisCourse) {
    return trimmedPrompt;
  }

  return `For the course "${courseTitle}": ${trimmedPrompt}`;
}

/**
 * Build a Criabot prompt for embed chat using Moodle session tracking data.
 * Mirrors the legacy local_cria prompt preprocessing for course scope and user context.
 */
export function buildEmbedCriabotPrompt(
  userPrompt: string,
  trackingData?: TrackingData
): string {
  const prompt = (userPrompt || "").trim();
  if (!prompt) {
    return prompt;
  }

  const parts: string[] = [];

  const courseTitle = pickString(trackingData, [
    "courseName",
    "courseTitle",
    "courseFullName"
  ]);
  const courseShortName = pickString(trackingData, [
    "courseShortName",
    "courseNumber"
  ]);
  const courseId = pickString(trackingData, ["courseId"]);

  if (courseTitle || courseShortName || courseId) {
    let courseScope =
      "Answer using only the training materials indexed for this Moodle course assistant.";
    if (courseTitle) {
      courseScope += ` The current course is "${courseTitle}"`;
      if (courseShortName && courseShortName !== courseTitle) {
        courseScope += ` (${courseShortName})`;
      }
      if (courseId) {
        courseScope += `, Moodle course id ${courseId}`;
      }
      courseScope += ".";
    } else if (courseShortName) {
      courseScope += ` The current course code is "${courseShortName}".`;
    } else if (courseId) {
      courseScope += ` The current Moodle course id is ${courseId}.`;
    }
    courseScope +=
      ' When the user says "this course", "the course", or asks about course learning outcomes, they mean this course.';
    parts.push(courseScope);
  }

  const userName = pickString(trackingData, ["name"]);
  if (userName) {
    parts.push(`${userName}.`);
  }

  const grade = trackingData?.grade;
  if (grade !== undefined && grade !== null && `${grade}`.trim() !== "") {
    parts.push(`Current grade: ${grade}.`);
  }

  const groups = pickString(trackingData, ["groups"]);
  if (groups) {
    parts.push(`Groups: ${groups}.`);
  }

  const currentDate = pickString(trackingData, ["currentDate"]);
  if (currentDate) {
    parts.push(`Today's date is ${currentDate}.`);
  }

  const rewrittenPrompt = rewriteCourseRelativeQuery(prompt, courseTitle);
  parts.push(`q: ${rewrittenPrompt}`);

  return parts.join(" ");
}
