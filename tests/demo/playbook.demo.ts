import { expect, test } from '@playwright/test';

test('レトロ Playbook を1画面で巡る18秒デモ', async ({ page, context }) => {
  await page.route('https://fonts.googleapis.com/**', (route) =>
    route.fulfill({ contentType: 'text/css', body: '' }));
  await page.goto('/playbook/');
  const githubCard = page.locator('[data-playbook-tile][href="/playbook/github/"]');
  await expect(githubCard).toBeVisible();
  await githubCard.scrollIntoViewIfNeeded();
  await githubCard.hover();
  await expect(githubCard).toBeInViewport();
  const started = performance.now();

  // 見せるための待機はデモだけに置き、操作にかかった時間も含めて配分する。
  const holdUntil = async (milliseconds: number) => {
    await page.waitForTimeout(Math.max(0, milliseconds - (performance.now() - started)));
  };
  const expectSlide = async (number: number) => {
    await expect(page.locator('body')).toHaveClass(/present-mode/);
    await expect(page.locator('body')).not.toHaveClass(/slide-preparing/);
    await expect(page.locator('.slide-counter-text')).toHaveText(new RegExp(`^${number} / \\d+$`));
    await expect(page.getByRole('tab', { name: `Slide ${number}`, exact: true }))
      .toHaveAttribute('aria-selected', 'true');
  };

  await test.step('一覧からギットハブの記事を開く', async () => {
    await expect(page.getByRole('navigation', { name: 'SDLC ナビゲーション' })).toBeVisible();
    await holdUntil(2_500);
    await githubCard.click();
    await expect(page).toHaveURL(/\/playbook\/github\/$/);
    await expect(page.getByRole('heading', { name: 'ギットハブ', exact: true })).toBeVisible();
    await expect(page.locator('body')).not.toHaveClass(/present-mode/);
    await holdUntil(5_000);
  });

  await test.step('P でプレゼンを開始し、次のスライドへ進む', async () => {
    await page.keyboard.press('p');
    await expectSlide(1);
    await expect(page.locator('.hero-quote.akq-slide-active')).toBeVisible();
    await expect(page.locator('.hero-quote.akq-slide-active')).toBeInViewport();
    await holdUntil(8_000);
    await page.getByRole('button', { name: '次のスライド', exact: true }).click();
    await expectSlide(2);
    await expect(page.locator('.prose-akq > h2.akq-slide-active')).toBeVisible();
    await holdUntil(10_500);
  });

  await test.step('目次で Copilot に切り替え、進捗バーで Fusion を表示する', async () => {
    const toc = page.getByRole('navigation', { name: 'プレゼン目次' });
    await toc.locator('[data-id="github-copilot"]').click();
    await expect(page).toHaveURL(/\/playbook\/github-copilot\/\?present=1$/);
    await expectSlide(1);
    await expect(toc.locator('[data-id="github-copilot"]')).toHaveAttribute('aria-current', 'page');
    await holdUntil(13_500);
    await page.getByRole('tab', { name: 'Slide 6', exact: true }).click();
    await expectSlide(6);
    await expect(page.locator('.fusion-slide.akq-slide-active')).toBeVisible();
    await expect(page.locator('.fusion-slide.akq-slide-active')).toBeInViewport();
    await holdUntil(16_500);
  });

  await test.step('Esc で一覧へ戻る', async () => {
    await page.keyboard.press('Escape');
    await expect(page).toHaveURL(/\/playbook\/$/);
    await expect(page.locator('body')).not.toHaveClass(/present-mode|slide-preparing/);
    await expect(githubCard).toBeVisible();
    await githubCard.scrollIntoViewIfNeeded();
    await expect(githubCard).toBeInViewport();
    expect(context.pages()).toHaveLength(1);
    expect(await page.pageErrors()).toEqual([]);
    expect((await page.consoleMessages()).filter((message) => message.type() === 'error')).toEqual([]);
    await holdUntil(18_000);
  });

  const seconds = (performance.now() - started) / 1_000;
  console.log(`デモ画面の表示時間: ${seconds.toFixed(2)} 秒（準備・ビルド・ブラウザ起動を除く）`);
  expect(seconds).toBeGreaterThanOrEqual(15);
  expect(seconds).toBeLessThanOrEqual(20);
});
