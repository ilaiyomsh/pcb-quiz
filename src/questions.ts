export interface VisitorQuestion {
  question: string;
  options: string[];
  multi_select: boolean;
}

const MAX_QUESTIONS = 3;
const MAX_OPTIONS = 6;
const MAX_CHARS = 200;
const OTHER_LABELS = new Set(["אחר", "other"]);

// The agent's tool input is model output, and the browser renders it, so check it before sending it on.
export function parseVisitorQuestions(input: unknown): VisitorQuestion[] | string {
  if (typeof input !== "object" || input === null) return "input must be an object";
  const questions = (input as Record<string, unknown>).questions;
  if (!Array.isArray(questions) || questions.length < 1 || questions.length > MAX_QUESTIONS) {
    return `questions must be an array of 1-${MAX_QUESTIONS} items`;
  }
  const parsed: VisitorQuestion[] = [];
  for (const item of questions) {
    const question = typeof item?.question === "string" ? item.question.trim() : "";
    if (!question || question.length > MAX_CHARS) return "each question needs a short question text";
    const options: unknown = item.options;
    if (!Array.isArray(options)) return "options must be an array";
    const labels = options
      .map((option) => (typeof option === "string" ? option.trim() : ""))
      // The chat adds its own "other" button with a text field.
      .filter((label) => !OTHER_LABELS.has(label.toLowerCase()));
    if (labels.length < 2 || labels.length > MAX_OPTIONS) return `each question needs 2-${MAX_OPTIONS} options, not counting "other"`;
    if (labels.some((label) => !label || label.length > MAX_CHARS)) return "options must be short non-empty strings";
    if (new Set(labels).size !== labels.length) return "options must not repeat";
    if (typeof item.multi_select !== "boolean") return "multi_select must be a boolean";
    parsed.push({ question, options: labels, multi_select: item.multi_select });
  }
  return parsed;
}
