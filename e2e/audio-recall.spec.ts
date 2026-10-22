import { expect, test } from "@playwright/test";

test("모든 단원의 음원을 브라우저에서 실제 디코딩하고 재생한다", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const play = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      this.addEventListener(
        "playing",
        () => {
          document.documentElement.dataset.playedAudio = this.src;
          document.documentElement.dataset.audioDuration = String(
            this.duration,
          );
        },
        { once: true },
      );
      return play.call(this);
    };
  });
  await page.goto("/");
  const nav = page
    .getByRole("navigation", { name: /주 메뉴/ })
    .filter({ visible: true });
  await nav.getByRole("button", { name: "글자 노트", exact: true }).click();
  for (const [title, ids] of [
    ["히라가나 あ행", ["a", "i", "u", "e", "o"]],
    ["히라가나 か행", ["ka", "ki", "ku", "ke", "ko"]],
    ["기본 인사말", ["ohayou", "konnichiwa", "arigatou", "oyasumi"]],
  ] as const) {
    await page
      .getByRole("group", { name: "노트 단원 선택" })
      .getByRole("button", { name: title, exact: true })
      .click();
    for (const [index, id] of ids.entries()) {
      await page
        .locator(".note-card")
        .nth(index)
        .getByRole("button", { name: /발음 듣기/ })
        .click();
      await expect(page.locator("html")).toHaveAttribute(
        "data-played-audio",
        new RegExp(`/audio/${id}\\.mp3$`),
      );
      const duration = await page
        .locator("html")
        .getAttribute("data-audio-duration");
      expect(Number(duration)).toBeGreaterThan(0.4);
      expect(Number(duration)).toBeLessThan(5);
    }
  }
});

test("음원 오류는 재시도를 안내하고 학습을 막지 않는다", async ({ page }) => {
  await page.route("**/audio/a.mp3", (route) => route.abort());
  await page.goto("/");
  await page
    .getByRole("button", { name: "첫 학습 시작하기", exact: true })
    .click();
  await page.getByRole("button", { name: "あ 발음 듣기", exact: true }).click();
  await expect(page.locator(".audio-error")).toContainText(
    "소리를 재생하지 못했어요",
  );
  await page.getByRole("button", { name: "다음 글자", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "이 글자는 ‘이’예요." }),
  ).toBeVisible();
  await expect(page.locator(".audio-error")).toHaveCount(0);
});

test("한글 조합 중 Enter는 제출하지 않고 입력 정답을 한 번만 저장한다", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      "haru.progress.v1",
      JSON.stringify({
        version: 1,
        cards: {
          a: { attempts: 1, correct: 0, level: 0, dueAt: 0, needsRetry: true },
        },
        activities: [],
      }),
    ),
  );
  await page.goto("/");
  await page
    .getByRole("button", { name: "지금 1개 복습하기", exact: true })
    .click();
  await page
    .getByRole("button", { name: "복습 시작하기", exact: true })
    .click();
  const input = page.getByLabel("이 글자의 발음", { exact: true });
  await input.fill("   ");
  await expect(
    page.getByRole("button", { name: "정답 확인", exact: true }),
  ).toBeDisabled();
  await input.fill("아");
  await input.dispatchEvent("compositionstart");
  await input.press("Enter");
  await expect(page.locator(".feedback")).toHaveCount(0);
  await input.dispatchEvent("compositionend");
  await input.press("Enter");
  await expect(page.locator(".feedback")).toContainText("잘 기억했어요");
  await expect(input).toBeDisabled();
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("haru.progress.v1")!),
  );
  expect(saved.cards.a.attempts).toBe(2);
  expect(saved.cards.a.needsRetry).toBe(false);
});
