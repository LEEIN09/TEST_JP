import { expect, test, type Page } from "@playwright/test";

const cards = [
  { glyph: "あ", reading: "아" },
  { glyph: "い", reading: "이" },
  { glyph: "う", reading: "우" },
  { glyph: "え", reading: "에" },
  { glyph: "お", reading: "오" },
];

async function learn(page: Page) {
  await page
    .getByRole("button", { name: "첫 학습 시작하기", exact: true })
    .click();
  for (let i = 0; i < cards.length; i++) {
    await expect(
      page.getByRole("heading", {
        name: `이 글자는 ‘${cards[i].reading}’예요.`,
      }),
    ).toBeVisible();
    await page
      .getByRole("button", {
        name: i === 4 ? "이제 기억해 볼까요?" : "다음 글자",
        exact: true,
      })
      .click();
  }
  await expect(
    page.getByRole("heading", { name: "어떻게 읽을까요?" }),
  ).toBeVisible();
}

async function answer(page: Page, reading: string, last: boolean) {
  const recall = await page.locator(".recall-form").isVisible();
  if (recall) {
    await page.getByLabel("이 글자의 발음", { exact: true }).fill(reading);
    await page.getByRole("button", { name: "정답 확인", exact: true }).click();
    await expect(
      page.getByLabel("이 글자의 발음", { exact: true }),
    ).toBeDisabled();
  } else {
    await page.locator(".answer").filter({ hasText: reading }).click();
    await expect(page.locator(".answer:enabled")).toHaveCount(0);
  }
  await expect(page.locator(".feedback")).toBeVisible();
  await page
    .getByRole("button", {
      name: last ? (recall ? "결과 보기" : "직접 답해보기") : "다음 문제",
      exact: true,
    })
    .click();
}

async function navigate(page: Page, label: string) {
  const desktop = page.getByRole("navigation", {
    name: "주 메뉴",
    exact: true,
  });
  const nav = (await desktop.isVisible())
    ? desktop
    : page.getByRole("navigation", { name: "모바일 주 메뉴" });
  await nav.getByRole("button", { name: label, exact: true }).click();
}

test("첫 학습 → 오답 복습 → 새로고침 후 기록과 일정 유지", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await learn(page);
  await expect(
    page.getByRole("button", { name: "다음 문제", exact: true }),
  ).toBeDisabled();
  await answer(page, "오", false); // あ를 틀린다.
  for (let i = 1; i < cards.length; i++) {
    await expect(page.locator(".quiz-glyph")).toHaveText(cards[i].glyph);
    await answer(page, cards[i].reading, i === 4);
  }
  await expect(
    page.getByRole("heading", { name: "소리를 직접 적어 볼까요?" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "정답 확인", exact: true }),
  ).toBeDisabled();
  await expect(page.locator(".audio-button")).toHaveCount(0);
  await answer(page, "오", false);
  for (let i = 1; i < cards.length; i++)
    await answer(page, cards[i].reading, i === 4);
  await expect(
    page.getByRole("heading", { name: "오늘도 한 걸음 가까워졌어요." }),
  ).toBeVisible();
  await expect(page.locator(".result-stats")).toContainText("4맞힌 항목");
  await page.getByRole("button", { name: "오답 1개 복습하기" }).click();
  await expect(page.locator(".quiz-glyph")).toHaveText("あ");
  await answer(page, "아", true);
  await expect(
    page.getByRole("button", { name: /오답 .*복습하기/ }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "오늘의 학습으로", exact: true })
    .click();
  await page.reload();
  await expect(page.locator(".stats-strip")).toContainText("5 / 14개");
  await navigate(page, "학습 기록");
  await expect(page.locator(".activity-row")).toHaveCount(2);
  await expect(page.locator(".history-summary")).toContainText("11개");
  await navigate(page, "복습");
  await expect(
    page.getByRole("heading", { name: "지금은 복습할 항목이 없어요" }),
  ).toBeVisible();
  await expect(page.locator(".schedule-row")).toHaveCount(5);
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("haru.progress.v1")!),
  );
  expect(saved.cards.a.attempts).toBe(3);
  expect(saved.cards.a.needsRetry).toBe(false);
  expect(saved.cards.a.dueAt - Date.now()).toBeGreaterThan(8 * 60_000);
  expect(errors).toEqual([]);
});

test("빈 복습 상태, 글자 노트, 모든 글자 정답", async ({ page }) => {
  await page.goto("/");
  await navigate(page, "복습");
  await expect(
    page.getByRole("heading", { name: "첫 학습부터 시작해 볼까요?" }),
  ).toBeVisible();
  await navigate(page, "글자 노트");
  await expect(page.locator(".note-card")).toHaveCount(5);
  await navigate(page, "오늘의 학습");
  await learn(page);
  for (let i = 0; i < cards.length; i++)
    await answer(page, cards[i].reading, i === 4);
  for (let i = 0; i < cards.length; i++)
    await answer(page, ["Ａ", " I ", "u", "에", "o"][i], i === 4);
  await expect(page.locator(".result-stats")).toContainText("5맞힌 항목");
  await expect(
    page.getByRole("button", { name: /오답 .*복습하기/ }),
  ).toHaveCount(0);
});

test("중도 종료 확인, 키보드 닫기, 답변 직후 기록 유지", async ({ page }) => {
  await page.goto("/");
  await learn(page);
  await answer(page, "아", false);
  await page.getByRole("button", { name: "나가기", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByRole("button", { name: "나가기", exact: true }).click();
  await page.getByRole("button", { name: "학습 홈으로 나가기" }).click();
  await page.reload();
  await expect(page.locator(".stats-strip")).toContainText("1 / 14개");
  await navigate(page, "학습 기록");
  await expect(page.locator(".activity-row")).toHaveCount(0);
  await expect(page.locator(".history-summary")).toContainText("1개");
});

test("손상된 기록과 저장 실패를 숨기지 않고 학습은 계속한다", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem("haru.progress.v1", "{invalid");
    Storage.prototype.setItem = () => {
      throw new DOMException("Full", "QuotaExceededError");
    };
  });
  await page.goto("/");
  await expect(page.getByRole("status")).toContainText(
    "이전 기록을 불러오지 못했어요",
  );
  await learn(page);
  await page.locator(".answer").filter({ hasText: "아" }).click();
  await expect(page.locator(".storage-warning")).toContainText(
    "기록을 저장하지 못했어요",
  );
  await expect(page.locator(".feedback")).toContainText("잘 기억했어요");
});

test("홈과 글자 노트에 가로 넘침이 없고 주요 화면이 표시된다", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /반가워요/ })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await navigate(page, "글자 노트");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
