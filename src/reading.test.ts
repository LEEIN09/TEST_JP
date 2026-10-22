import { describe, expect, it } from "vitest";
import { kana } from "./content";
import { checkReading } from "./reading";

describe("직접 입력한 발음", () => {
  it.each(kana)("$glyph의 한글과 로마자를 정답으로 받는다", (card) => {
    expect(checkReading(card, card.reading)).toBe("correct");
    expect(checkReading(card, card.roman.toUpperCase())).toBe("correct");
    expect(checkReading(card, `  ${card.roman}  `)).toBe("correct");
    expect(checkReading(card, card.glyph)).toBe("incorrect");
  });
  it("전각 로마자와 분리된 한글 자모를 정규화한다", () => {
    expect(checkReading(kana[0], "Ａ")).toBe("correct");
    expect(checkReading(kana[0], "아".normalize("NFD"))).toBe("correct");
  });
  it("빈 답과 틀린 답을 구분하고 문장 안의 정답을 허용하지 않는다", () => {
    expect(checkReading(kana[0], "  ")).toBe("empty");
    expect(checkReading(kana[0], "a a")).toBe("incorrect");
    expect(checkReading(kana[0], "아니오")).toBe("incorrect");
  });
});
