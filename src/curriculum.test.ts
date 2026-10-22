import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { allItems, getItem, lessons } from "./content";
import { checkReading } from "./reading";
import {
  emptyProgress,
  finishSession,
  isLessonComplete,
  loadProgress,
  answerCard,
  dueCards,
} from "./progress";
import manifest from "../public/audio/manifest.json";

describe("확장한 학습 내용", () => {
  it("최근 기록이 100회를 넘어도 단원 완료 상태를 보존한다", () => {
    let progress = finishSession(emptyProgress(), {
      at: 1,
      total: 5,
      correct: 5,
      mode: "lesson",
      lessonId: "ka-row",
    });
    for (let i = 0; i < 105; i++)
      progress = finishSession(progress, {
        at: i + 2,
        total: 1,
        correct: 1,
        mode: "review",
      });
    expect(progress.activities).toHaveLength(100);
    expect(progress.activities.every((a) => a.mode === "review")).toBe(true);
    expect(isLessonComplete(progress, "ka-row")).toBe(true);
    expect(
      isLessonComplete(
        loadProgress({ getItem: () => JSON.stringify(progress) }).progress,
        "ka-row",
      ),
    ).toBe(true);
  });
  it("모든 항목이 정확히 한 단원에 연결되고 출처가 있는 음원을 가진다", () => {
    const reachable = lessons.flatMap((lesson) => [...lesson.ids]);
    expect(new Set(reachable).size).toBe(allItems.length);
    expect([...reachable].sort()).toEqual(
      allItems.map((item) => item.id).sort(),
    );
    for (const item of allItems) {
      const saved = manifest[item.id];
      expect(saved.glyph).toBe(item.glyph);
      expect(saved.phoneme).toBe(item.phonemes);
      const bytes = readFileSync(
        new URL(`../public/audio/${item.id}.mp3`, import.meta.url),
      );
      expect(bytes.length).toBeGreaterThan(1000);
      expect(createHash("sha256").update(bytes).digest("hex")).toBe(
        saved.sha256,
      );
    }
  });

  it("인사말은 발음이나 일본어 베껴 쓰기 대신 뜻을 답한다", () => {
    const card = getItem("konnichiwa");
    expect(checkReading(card, "안녕하세요")).toBe("correct");
    expect(checkReading(card, "hello!")).toBe("correct");
    expect(checkReading(card, "곤니치와")).toBe("incorrect");
    expect(checkReading(card, "konnichiwa")).toBe("incorrect");
    expect(checkReading(card, "こんにちは")).toBe("incorrect");
    expect(checkReading(getItem("ohayou"), "좋은아침이에요.")).toBe("correct");
    expect(checkReading(getItem("oyasumi"), "잘 자요!")).toBe("correct");
    expect(checkReading(getItem("arigatou"), "감사합니다")).toBe("correct");
    expect(checkReading(card, "hello goodbye")).toBe("incorrect");
  });

  it("이전 あ행 기록은 보존하고 새 단원을 완료한 것으로 잘못 표시하지 않는다", () => {
    const original = finishSession(
      answerCard(emptyProgress(), "a", true, 100),
      { at: 100, total: 5, correct: 5, mode: "lesson" },
    );
    const loaded = loadProgress({ getItem: () => JSON.stringify(original) });
    expect(loaded.progress).toEqual(original);
    expect(loaded.warning).toBe("");
    expect(isLessonComplete(loaded.progress, "a-row")).toBe(true);
    expect(isLessonComplete(loaded.progress, "ka-row")).toBe(false);
    expect(isLessonComplete(loaded.progress, "greetings")).toBe(false);
    const next = finishSession(loaded.progress, {
      at: 200,
      total: 4,
      correct: 4,
      mode: "lesson",
      exercise: "recall",
      lessonId: "greetings",
    });
    expect(isLessonComplete(next, "greetings")).toBe(true);
    expect(next.cards.a).toEqual(original.cards.a);
  });

  it("문자와 인사말이 섞인 오답을 모두 복습한다", () => {
    const progress = answerCard(
      answerCard(emptyProgress(), "ka", false, 100),
      "arigatou",
      false,
      100,
    );
    expect(dueCards(progress, 100)).toEqual(["ka", "arigatou"]);
    expect(
      loadProgress({ getItem: () => JSON.stringify(progress) }).progress,
    ).toEqual(progress);
  });
});
