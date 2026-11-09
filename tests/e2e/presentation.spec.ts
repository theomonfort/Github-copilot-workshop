import { readdirSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

const slugs = readdirSync(new URL('../../src/content/playbook/ja/', import.meta.url))
  .filter((name) => name.endsWith('.md'))
  .map((name) => name.slice(0, -3));

async function expectSlide(page: Page, number: number) {
  await expect(page.locator('body')).toHaveClass(/present-mode/);
  await expect(page.locator('body')).not.toHaveClass(/slide-preparing/);
  await expect(page.locator('.slide-counter-text')).toHaveText(new RegExp(`^${number} / \\d+$`));
  await expect(page.getByRole('tab', { name: `Slide ${number}`, exact: true })).toHaveAttribute('aria-selected', 'true');
}

test.beforeEach(async ({ page }) => {
  await page.route('https://fonts.googleapis.com/**', (route) =>
    route.fulfill({ contentType: 'text/css', body: '' }));
});

test.afterEach(async ({ page }) => {
  expect(await page.pageErrors()).toEqual([]);
  const errors = (await page.consoleMessages()).filter((message) => message.type() === 'error');
  expect(errors.map((message) => message.text())).toEqual([]);
});

test('一覧が入口で、全カード・カテゴリ・2カラムと基本導線が使える', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/playbook\/$/);
  await expect(page.locator('body')).not.toHaveClass(/present-mode/);
  await expect(page.locator('[data-playbook-tile]')).toHaveCount(slugs.length);
  await expect(page.locator('.category-section')).toHaveCount(7);
  await expect(page.getByRole('navigation', { name: 'SDLC ナビゲーション' })).toBeVisible();
  const columns = await page.locator('.category-section ul').first()
    .evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length);
  expect(columns).toBe(2);
  await page.locator('[data-playbook-tile][href="/playbook/github/"]').click();
  await expect(page).toHaveURL(/\/playbook\/github\/$/);
  await expect(page.locator('body')).not.toHaveClass(/present-mode/);
  await expect(page.getByRole('heading', { name: 'ギットハブ', exact: true })).toBeVisible();
  await expect(page.locator('article.prose-akq > h2').first()).toBeVisible();
  await page.getByRole('link', { name: '◀ Playbook に戻る', exact: true }).click();
  await expect(page).toHaveURL(/\/playbook\/$/);
});

test('全詳細ページのローカルリンクと画像が解決する', async ({ request }) => {
  const paths = new Set<string>();
  for (const slug of slugs) {
    const response = await request.get(`/playbook/${slug}/`);
    expect(response.status(), slug).toBe(200);
    const html = await response.text();
    expect(html).toContain('Playbook に戻る');
    for (const match of html.matchAll(/(?:href|src)="(\/[^"]*)"/g)) {
      const path = match[1].replaceAll('&amp;', '&');
      expect(path).not.toMatch(/^\/theomonfort\//);
      if (!path.startsWith('//')) paths.add(path);
    }
  }
  for (const path of paths) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(200);
  }
  for (const category of ['introduction', 'plan', 'develop', 'review', 'secure', 'operate', 'administration']) {
    for (const prefix of ['planet', 'slide-bg']) {
      expect((await request.get(`/${prefix}-${category}.webp`)).status()).toBe(200);
    }
  }
});

test('カードから明示的にプレゼンを開始し、見出し単位で前後に移動する', async ({ page }) => {
  await page.goto('/playbook/');
  await page.getByRole('link', { name: 'ギットハブのプレゼンモード', exact: true }).click();
  await expect(page).toHaveURL(/\/playbook\/github\/\?present=1$/);
  await expectSlide(page, 1);
  await expect(page.locator('.hero-quote.akq-slide-active')).toBeVisible();
  const headings = await page.locator('.prose-akq > h2').allTextContents();
  expect(headings.length).toBeGreaterThan(1);
  await expect(page.locator('.slide-progress-bar')).toHaveCount(headings.length + 1);
  await page.keyboard.press('ArrowRight');
  await expectSlide(page, 2);
  await expect(page).toHaveURL(/present=1&slide=2$/);
  await expect(page.locator('.prose-akq > h2.akq-slide-active')).toHaveText(headings[1]);
  await expect(page.locator('.playbook-detail > header')).toBeHidden();
  await page.keyboard.press('ArrowLeft');
  await expectSlide(page, 1);
  await expect(page).not.toHaveURL(/slide=/);
  await expect(page.locator('.prose-akq > h2.akq-slide-active')).toHaveText(headings[0]);
});

test('TOC で別エントリの先頭へ切替え、スクロールとプレゼンを維持する', async ({ page }) => {
  await page.goto('/playbook/github/?present=1&slide=2');
  await expectSlide(page, 2);
  const toc = page.getByRole('navigation', { name: 'プレゼン目次' });
  await expect(toc.locator('.toc-section')).toHaveCount(7);
  await expect(toc.locator('.toc-item')).toHaveCount(slugs.length);
  const before = await toc.evaluate((el) => {
    const link = el.querySelector<HTMLElement>('[data-id="cli"]');
    if (!link) throw new Error('CLI の TOC エントリがありません');
    el.scrollTop = link.offsetTop - 150;
    return el.scrollTop;
  });
  expect(before).toBeGreaterThan(0);
  await toc.locator('[data-id="cli"]').click();
  await expect(page).toHaveURL(/\/playbook\/cli\/\?present=1$/);
  await expectSlide(page, 1);
  await expect(toc.locator('[data-id="cli"]')).toHaveAttribute('aria-current', 'page');
  await expect(toc.locator('[data-id="github"]')).not.toHaveAttribute('aria-current');
  await expect.poll(() => toc.evaluate((el) => el.scrollTop)).toBe(before);
  await expect(page.locator('.playbook-detail')).toHaveCSS('background-image', /slide-bg-develop\.webp/);
});

test('スライドの深いリンクを直接開き、再読み込みしても保持する', async ({ page }) => {
  await page.goto('/playbook/github/?present=1&slide=3');
  await expectSlide(page, 3);
  await page.reload();
  await expectSlide(page, 3);
  await page.getByRole('button', { name: '前のスライド', exact: true }).click();
  await expectSlide(page, 2);
  await page.getByRole('button', { name: '次のスライド', exact: true }).click();
  await expectSlide(page, 3);
});

test('不正なスライド番号は範囲内に正規化する', async ({ page }) => {
  await page.goto('/playbook/github/?present=1&slide=invalid');
  await expectSlide(page, 1);
  await expect(page).not.toHaveURL(/slide=/);
  await page.goto('/playbook/github/?present=1&slide=999');
  await expect(page.locator('body')).not.toHaveClass(/slide-preparing/);
  const count = await page.locator('.slide-progress-bar').count();
  await expectSlide(page, count);
  await expect(page).toHaveURL(new RegExp(`slide=${count}$`));
});

test('最終リンク集はグループ別に表示し、進捗バーでも移動できる', async ({ page }) => {
  await page.goto('/playbook/github/?present=1');
  await expectSlide(page, 1);
  const count = await page.locator('.slide-progress-bar').count();
  await page.getByRole('tab', { name: `Slide ${count}`, exact: true }).click();
  await expectSlide(page, count);
  const links = page.locator('.links-aside');
  await expect(links).toBeVisible();
  await expect(links.getByRole('heading', { name: '公式リンク', exact: true })).toBeVisible();
  expect(await links.locator('h3').count()).toBeGreaterThan(1);
  await expect(links.locator('a').first()).toHaveAttribute('href', 'https://github.com/about');
  await page.keyboard.press('ArrowRight');
  await expect(page).toHaveURL(/\/playbook\/github-copilot\/\?present=1$/);
  await expectSlide(page, 1);
});

test('後続スライドの Mermaid 図が実体の SVG として表示される', async ({ page }) => {
  await page.goto('/playbook/cloud-agent/?present=1&slide=8');
  await expectSlide(page, 8);
  const diagram = page.locator('.mermaid-wrap.akq-slide-active svg');
  await expect(diagram).toBeVisible();
  const size = await diagram.boundingBox();
  expect(size?.width).toBeGreaterThan(100);
  expect(size?.height).toBeGreaterThan(100);
  await expect(page.locator('pre[data-language="mermaid"]')).toHaveCount(0);
  await page.keyboard.press('ArrowLeft');
  await expect(diagram).toBeHidden();
  await page.keyboard.press('ArrowRight');
  await expect(diagram).toBeVisible();
});

test('Esc は一覧へ戻り、通常ページをプレゼン状態にしない', async ({ page }) => {
  await page.goto('/playbook/mcp/?present=1');
  await expectSlide(page, 1);
  await page.keyboard.press('Escape');
  await expect(page).toHaveURL(/\/playbook\/$/);
  await expect(page.locator('body')).not.toHaveClass(/present-mode|slide-preparing/);
  await expect(page.locator('[data-playbook-tile]').first()).toBeVisible();
  await page.locator('[data-playbook-tile]').first().click();
  await expect(page.locator('body')).not.toHaveClass(/present-mode/);
  await expect(page.getByRole('link', { name: '◀ Playbook に戻る', exact: true })).toBeVisible();
});

test('モバイルは1カラムで、プレゼンURLも通常の詳細に戻る', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/playbook/');
  const columns = await page.locator('.category-section ul').first()
    .evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length);
  expect(columns).toBe(1);
  await expect(page.locator('.presentation-link').first()).toBeHidden();
  await page.goto('/playbook/mcp/?present=1&slide=3');
  await expect(page).not.toHaveURL(/present=|slide=/);
  await expect(page.locator('body')).not.toHaveClass(/present-mode/);
  await expect(page.locator('#present-toggle')).toBeHidden();
  await expect(page.getByRole('link', { name: '◀ Playbook に戻る', exact: true })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
});
