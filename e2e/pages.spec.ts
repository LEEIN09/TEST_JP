import { expect, test } from "@playwright/test";

test("Pages 하위 경로에서 화면·음원·출처·새로고침이 동작한다", async ({
  page,
}) => {
  const errors: string[] = [];
  const failed: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("response", (response) => {
    if (response.status() >= 400) failed.push(response.url());
  });
  await page.goto("./");
  await expect(
    page.getByRole("heading", { name: /오늘의 일본어/ }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "이용 안내 · 음성 출처", exact: true })
    .click();
  const credit = page.getByRole("link", { name: "음성 출처와 이용 조건 보기" });
  await expect(credit).toHaveAttribute("href", "/TEST_JP/audio/NOTICE.txt");
  const notice = await page.request.get("audio/NOTICE.txt");
  expect(notice.ok()).toBe(true);
  expect(await notice.text()).toContain("Creative Commons Attribution 3.0");
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", { name: "첫 학습 시작하기", exact: true })
    .click();
  const audioResponse = page.waitForResponse((response) =>
    response.url().endsWith("/TEST_JP/audio/a.mp3"),
  );
  await page.getByRole("button", { name: "あ 발음 듣기", exact: true }).click();
  const response = await audioResponse;
  expect(response.ok()).toBe(true);
  expect(response.headers()["content-type"]).toContain("audio");
  await expect(
    page.getByRole("button", { name: "あ 발음 멈추기", exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: /오늘의 일본어/ }),
  ).toBeVisible();
  expect(errors).toEqual([]);
  expect(failed).toEqual([]);
});
