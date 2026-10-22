import { answerLabel, type Kana } from "./content";

export function normalizeReading(value: string): string {
  return value.normalize("NFKC").trim().toLowerCase();
}

export function checkReading(
  card: Kana,
  value: string,
): "empty" | "correct" | "incorrect" {
  const normalized = normalizeReading(value);
  if (!normalized) return "empty";
  const answers =
    card.kind === "greeting"
      ? [answerLabel(card), ...card.aliases]
      : [card.reading, card.roman];
  const normalizeAnswer = (answer: string) =>
    card.kind === "greeting"
      ? normalizeReading(answer)
          .replace(/\s+/gu, "")
          .replace(/[.!?。！？]+$/gu, "")
      : normalizeReading(answer);
  return answers.some(
    (answer) => normalizeAnswer(answer) === normalizeAnswer(value),
  )
    ? "correct"
    : "incorrect";
}
