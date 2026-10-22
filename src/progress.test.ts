import { describe, expect, it } from "vitest";
import {
  DAY,
  MINUTE,
  STORAGE_KEY,
  answerCard,
  dueCards,
  emptyProgress,
  finishSession,
  loadProgress,
  saveProgress,
} from "./progress";

const now = Date.UTC(2026, 9, 22, 3);

describe("복습 일정", () => {
  it("선택 문제 정답만으로 복습 단계를 올리지 않는다", () => {
    const choice = answerCard(emptyProgress(), "a", true, now, "choice");
    expect(choice.cards.a).toMatchObject({ level: 0, attempts: 1, dueAt: now });
    const recall = answerCard(choice, "a", true, now + MINUTE, "recall");
    expect(recall.cards.a).toMatchObject({
      level: 1,
      attempts: 2,
      dueAt: now + MINUTE + DAY,
    });
    const repeatedChoice = answerCard(
      recall,
      "a",
      true,
      now + 2 * MINUTE,
      "choice",
    );
    expect(repeatedChoice.cards.a?.dueAt).toBe(recall.cards.a?.dueAt);
    expect(repeatedChoice.cards.a?.level).toBe(1);
  });
  it("학습하지 않은 글자는 복습 목록에 넣지 않는다", () => {
    expect(dueCards(emptyProgress(), now)).toEqual([]);
  });

  it("첫 정답은 다음 날에 복습하고 이후에는 간격을 늘린다", () => {
    const first = answerCard(emptyProgress(), "a", true, now);
    expect(dueCards(first, now + DAY - 1)).toEqual([]);
    expect(dueCards(first, now + DAY)).toEqual(["a"]);
    const second = answerCard(first, "a", true, now + DAY);
    expect(second.cards.a?.dueAt).toBe(now + 4 * DAY);
    expect(first.cards.a?.attempts).toBe(1);
  });

  it("틀린 글자는 즉시 복습하고 고쳐 맞히면 10분 뒤에 다시 본다", () => {
    const wrong = answerCard(emptyProgress(), "u", false, now);
    expect(dueCards(wrong, now)).toEqual(["u"]);
    const corrected = answerCard(wrong, "u", true, now + MINUTE);
    expect(dueCards(corrected, now + 10 * MINUTE)).toEqual([]);
    expect(dueCards(corrected, now + 11 * MINUTE)).toEqual(["u"]);
    expect(corrected.cards.u).toMatchObject({
      attempts: 2,
      correct: 1,
      needsRetry: false,
    });
  });

  it("계속 틀리면 정답으로 처리하지 않고 복습 대상으로 남긴다", () => {
    let progress = answerCard(emptyProgress(), "e", true, now);
    progress = answerCard(progress, "e", false, now + DAY);
    progress = answerCard(progress, "e", false, now + DAY + MINUTE);
    expect(progress.cards.e).toMatchObject({
      attempts: 3,
      correct: 1,
      level: 0,
      needsRetry: true,
    });
    expect(dueCards(progress, now + DAY + MINUTE)).toEqual(["e"]);
  });
});

describe("브라우저 기록", () => {
  it("답변과 완료 기록을 저장하고 다시 불러온다", () => {
    let value: string | null = null;
    const storage = {
      getItem: () => value,
      setItem: (_key: string, data: string) => {
        value = data;
      },
    };
    const progress = finishSession(
      answerCard(emptyProgress(), "i", true, now),
      { at: now, total: 1, correct: 1, mode: "lesson" },
    );
    expect(saveProgress(storage, progress)).toBe(true);
    expect(loadProgress(storage)).toEqual({ progress, warning: "" });
  });

  it.each([
    "{broken",
    JSON.stringify({ version: 2 }),
    JSON.stringify({ version: 1, cards: { a: null }, activities: [] }),
    JSON.stringify({
      version: 1,
      cards: {},
      activities: [{ at: 0, total: 1, correct: 7, mode: "lesson" }],
    }),
  ])("손상된 기록을 안전하게 처리한다: %s", (value) => {
    const result = loadProgress({ getItem: () => value });
    expect(result.progress).toEqual(emptyProgress());
    expect(result.warning).not.toBe("");
  });

  it("저장 공간이 없거나 접근이 막혀도 실패 여부를 반환한다", () => {
    expect(
      saveProgress(
        {
          setItem: () => {
            throw new Error("quota");
          },
        },
        emptyProgress(),
      ),
    ).toBe(false);
    expect(
      loadProgress({
        getItem: () => {
          throw new Error("denied");
        },
      }).warning,
    ).not.toBe("");
  });

  it("학습 기록은 최근 100회까지 보관한다", () => {
    let progress = emptyProgress();
    for (let i = 0; i < 105; i++)
      progress = finishSession(progress, {
        at: now + i,
        total: 5,
        correct: 4,
        mode: "lesson",
      });
    expect(progress.activities).toHaveLength(100);
    expect(progress.activities[0].at).toBe(now + 104);
    expect(STORAGE_KEY).toBe("haru.progress.v1");
  });
});
