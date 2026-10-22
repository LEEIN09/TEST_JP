import { expect, test } from "@playwright/test";

const courses = [
  {
    title: "히라가나 か행",
    id: "ka-row",
    glyphs: ["か", "き", "く", "け", "こ"],
    choices: ["카", "키", "쿠", "케", "코"],
    answers: [" KA ", "키", "ku", "ke", "ko"],
  },
  {
    title: "기본 인사말",
    id: "greetings",
    glyphs: ["おはよう", "こんにちは", "ありがとう", "おやすみなさい"],
    choices: ["좋은 아침이에요", "안녕하세요", "고마워요", "안녕히 주무세요"],
    answers: ["좋은아침이에요.", "안녕하세요", "감사합니다", "잘 자요!"],
  },
];

for (const course of courses) {
  test(`${course.title} 선택부터 학습·입력·기록 저장까지 완료한다`, async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.locator(".course-card")).toHaveCount(3);
    await page
      .getByRole("button", { name: `${course.title} 학습 시작`, exact: true })
      .click();
    for (let i = 0; i < course.glyphs.length; i++) {
      await expect(page.locator(".big-glyph")).toHaveText(course.glyphs[i]);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await page
        .getByRole("button", {
          name:
            i === course.glyphs.length - 1
              ? "이제 기억해 볼까요?"
              : course.id === "greetings"
                ? "다음 표현"
                : "다음 글자",
          exact: true,
        })
        .click();
    }
    for (let i = 0; i < course.choices.length; i++) {
      await page
        .locator(".answer")
        .filter({ hasText: course.choices[i] })
        .click();
      await expect(page.locator(".feedback")).toContainText("잘 기억했어요");
      await page
        .getByRole("button", {
          name: i === course.choices.length - 1 ? "직접 답해보기" : "다음 문제",
          exact: true,
        })
        .click();
    }
    for (let i = 0; i < course.answers.length; i++) {
      await expect(page.locator(".quiz-glyph")).toHaveText(course.glyphs[i]);
      if (course.id === "greetings")
        await expect(
          page.getByLabel("이 인사말의 뜻", { exact: true }),
        ).toBeVisible();
      await page.locator("#reading-answer").fill(course.answers[i]);
      await page
        .getByRole("button", { name: "정답 확인", exact: true })
        .click();
      await expect(page.locator(".feedback")).toContainText("잘 기억했어요");
      await page
        .getByRole("button", {
          name: i === course.answers.length - 1 ? "결과 보기" : "다음 문제",
          exact: true,
        })
        .click();
    }
    await expect(page.locator(".result-stats")).toContainText(
      `${course.answers.length}맞힌 항목`,
    );
    const saved = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("haru.progress.v1")!),
    );
    expect(saved.activities[0].lessonId).toBe(course.id);
    expect(saved.activities[0].correct).toBe(course.answers.length);
    await page
      .getByRole("button", { name: "오늘의 학습으로", exact: true })
      .click();
    await page.reload();
    await expect(
      page.locator(".course-card").filter({ hasText: course.title }),
    ).toContainText("학습 완료");
  });
}

test("문자와 인사말이 섞인 복습에서 문제 종류와 오답 일정을 유지한다", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      "haru.progress.v1",
      JSON.stringify({
        version: 1,
        cards: {
          ka: { attempts: 1, correct: 0, level: 0, dueAt: 0, needsRetry: true },
          arigatou: {
            attempts: 1,
            correct: 0,
            level: 0,
            dueAt: 0,
            needsRetry: true,
          },
        },
        activities: [],
      }),
    ),
  );
  await page.goto("/");
  await page
    .getByRole("button", { name: "지금 2개 복습하기", exact: true })
    .click();
  await page
    .getByRole("button", { name: "복습 시작하기", exact: true })
    .click();
  await expect(
    page.getByLabel("이 글자의 발음", { exact: true }),
  ).toBeVisible();
  await page.locator("#reading-answer").fill("쿠");
  await page.getByRole("button", { name: "정답 확인", exact: true }).click();
  await expect(page.locator(".feedback")).toContainText("카");
  await page.getByRole("button", { name: "다음 문제", exact: true }).click();
  await expect(
    page.getByLabel("이 인사말의 뜻", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".audio-button")).toHaveCount(0);
  await page.locator("#reading-answer").fill("감사합니다");
  await page.getByRole("button", { name: "정답 확인", exact: true }).click();
  await page.getByRole("button", { name: "결과 보기", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "오답 1개 복습하기", exact: true }),
  ).toBeVisible();
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("haru.progress.v1")!),
  );
  expect(saved.cards.ka.needsRetry).toBe(true);
  expect(saved.cards.arigatou.needsRetry).toBe(false);
  expect(saved.cards.arigatou.dueAt - Date.now()).toBeGreaterThan(8 * 60_000);
});

test("기존 기록을 읽으면 추천 단원을 か행으로 이어 준다", async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      "haru.progress.v1",
      JSON.stringify({
        version: 1,
        cards: {
          a: {
            attempts: 2,
            correct: 2,
            level: 1,
            dueAt: 4102444800000,
            needsRetry: false,
          },
        },
        activities: [
          { at: 1, total: 5, correct: 5, mode: "lesson", exercise: "recall" },
        ],
      }),
    ),
  );
  await page.goto("/");
  await expect(page.locator(".hero")).toContainText(
    "오늘의 추천 단원: 히라가나 か행",
  );
  await expect(
    page.locator(".course-card").filter({ hasText: "히라가나 あ행" }),
  ).toContainText("학습 완료");
  await page
    .getByRole("button", { name: "다음 단원 시작하기", exact: true })
    .click();
  await expect(page.locator(".big-glyph")).toHaveText("か");
});
