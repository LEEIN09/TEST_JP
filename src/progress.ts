import { allItems, lessons, type KanaId, type LessonId } from "./content";

export const STORAGE_KEY = "haru.progress.v1";
export const MINUTE = 60_000;
export const DAY = 24 * 60 * MINUTE;

export type CardProgress = {
  attempts: number;
  correct: number;
  level: number;
  dueAt: number;
  needsRetry: boolean;
};
export type Activity = {
  at: number;
  total: number;
  correct: number;
  mode: "lesson" | "review";
  exercise?: "recall";
  lessonId?: LessonId;
};
export type Progress = {
  version: 1;
  cards: Partial<Record<KanaId, CardProgress>>;
  activities: Activity[];
  completedLessons?: LessonId[];
};

export function emptyProgress(): Progress {
  return { version: 1, cards: {}, activities: [] };
}

export function isLessonComplete(progress: Progress, id: LessonId): boolean {
  return (
    !!progress.completedLessons?.includes(id) ||
    progress.activities.some(
      (a) => a.mode === "lesson" && (a.lessonId ?? "a-row") === id,
    )
  );
}

export function answerCard(
  progress: Progress,
  id: KanaId,
  correct: boolean,
  now: number,
  exercise: "choice" | "recall" = "recall",
): Progress {
  const previous = progress.cards[id];
  const level = correct ? Math.min((previous?.level ?? 0) + 1, 4) : 0;
  // A corrected mistake returns soon; a correct first answer returns tomorrow.
  const delay = !correct
    ? 0
    : previous?.needsRetry
      ? 10 * MINUTE
      : [0, DAY, 3 * DAY, 7 * DAY, 14 * DAY][level];
  // Recognition is practice, not evidence of independent recall. Preserve the
  // existing schedule after a correct choice; new cards remain due for recall.
  const recognition = exercise === "choice" && correct;
  return {
    ...progress,
    cards: {
      ...progress.cards,
      [id]: {
        attempts: (previous?.attempts ?? 0) + 1,
        correct: (previous?.correct ?? 0) + Number(correct),
        level: recognition ? (previous?.level ?? 0) : level,
        dueAt: recognition ? (previous?.dueAt ?? now) : now + delay,
        needsRetry: recognition ? (previous?.needsRetry ?? false) : !correct,
      },
    },
  };
}

export function dueCards(progress: Progress, now: number): KanaId[] {
  return allItems
    .filter((card) => {
      const saved = progress.cards[card.id];
      return saved && saved.dueAt <= now;
    })
    .map((card) => card.id);
}

export function finishSession(
  progress: Progress,
  activity: Activity,
): Progress {
  return {
    ...progress,
    activities: [activity, ...progress.activities].slice(0, 100),
    completedLessons: lessons
      .filter(
        (lesson) =>
          isLessonComplete(progress, lesson.id) ||
          (activity.mode === "lesson" &&
            (activity.lessonId ?? "a-row") === lesson.id),
      )
      .map((lesson) => lesson.id),
  };
}

function isValidProgress(value: unknown): value is Progress {
  if (!value || typeof value !== "object") return false;
  const p = value as Progress;
  if (
    p.version !== 1 ||
    !p.cards ||
    typeof p.cards !== "object" ||
    Array.isArray(p.cards) ||
    !Array.isArray(p.activities)
  )
    return false;
  if (
    p.completedLessons !== undefined &&
    (!Array.isArray(p.completedLessons) ||
      !p.completedLessons.every((id) =>
        lessons.some((lesson) => lesson.id === id),
      ))
  )
    return false;
  const validCount = (n: unknown): n is number =>
    typeof n === "number" && Number.isSafeInteger(n) && n >= 0;
  return (
    Object.entries(p.cards).every(
      ([id, card]) =>
        allItems.some((k) => k.id === id) &&
        card &&
        validCount(card.attempts) &&
        card.attempts > 0 &&
        validCount(card.correct) &&
        card.correct <= card.attempts &&
        validCount(card.level) &&
        card.level <= 4 &&
        validCount(card.dueAt) &&
        typeof card.needsRetry === "boolean",
    ) &&
    p.activities.every(
      (a) =>
        a &&
        validCount(a.at) &&
        validCount(a.total) &&
        a.total > 0 &&
        validCount(a.correct) &&
        a.correct <= a.total &&
        (a.mode === "lesson" || a.mode === "review") &&
        (a.exercise === undefined || a.exercise === "recall") &&
        (a.lessonId === undefined || lessons.some((l) => l.id === a.lessonId)),
    )
  );
}

export function loadProgress(storage: Pick<Storage, "getItem">): {
  progress: Progress;
  warning: string;
} {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return { progress: emptyProgress(), warning: "" };
    const parsed: unknown = JSON.parse(raw);
    if (!isValidProgress(parsed)) throw new Error("Invalid progress");
    return { progress: parsed, warning: "" };
  } catch {
    return {
      progress: emptyProgress(),
      warning:
        "이전 기록을 불러오지 못했어요. 지금 학습을 시작하면 새 기록으로 저장합니다.",
    };
  }
}

export function saveProgress(
  storage: Pick<Storage, "setItem">,
  progress: Progress,
): boolean {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(progress));
    return true;
  } catch {
    return false;
  }
}
