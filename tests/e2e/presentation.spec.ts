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
  for (const label of await toc.locator('.toc-section, .toc-text').allTextContents()) {
    expect(label).not.toMatch(/[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u);
  }
  await expect(toc.locator('[data-id="github"] .toc-text')).toHaveText('GitHub');
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

test('Zettelkasten で検索・閲覧し、編集せず同じスライドへ戻れる', async ({ page }) => {
  const writes: string[] = [];
  const vaultRequests: string[] = [];
  const apiRequests: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.pathname.startsWith('/zettelkasten/')) vaultRequests.push(url.pathname);
    if (/^\/api\/notes(?:\/|$)/.test(url.pathname)) apiRequests.push(url.pathname);
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method())) writes.push(request.url());
  });
  await page.goto('/playbook/github/?present=1&slide=2');
  await expectSlide(page, 2);
  const storedNotes = JSON.stringify({ 'test-only-note': '# Test-only note\n\nIsolated fixture.' });
  await page.evaluate((value) =>
    localStorage.setItem('workshop:zettelkasten:introduction', value), storedNotes);
  await page.keyboard.press('z');
  const dialog = page.getByRole('dialog', { name: 'Zettelkasten ナレッジグラフ', exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('.zk-canvas')).toBeVisible();
  await expect(dialog.locator('.zk-note-title')).toHaveText('GitHub');
  await expect(dialog.locator('.zk-read-pane')).not.toBeEmpty();
  await expect(dialog.locator('.zk-new-note-btn, [data-mode="edit"], [data-action="delete-note"]')).toHaveCount(0);
  await expect(dialog.locator('.zk-edit-pane')).toBeHidden();
  await expect(dialog.locator('[data-action="reset-seed"]')).toBeHidden();

  const search = dialog.locator('.zk-search-input');
  await search.fill('GitHub Copilot');
  await dialog.locator('.zk-search-item[data-open-slug="github-copilot"]').click();
  await expect(dialog.locator('.zk-note-title')).toHaveText('GitHub Copilot');
  await search.fill('workshop-nonexistent-note');
  await expect(dialog.locator('.zk-search-empty')).toBeVisible();
  await expect(dialog.locator('.zk-create-from-search')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('.zk-search-results')).toBeHidden();

  await dialog.getByRole('button', { name: 'Esc スライドに戻る', exact: true }).focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('.slide-counter-text')).toHaveText(/^2 \/ \d+$/);
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(page.locator('.zk-root')).toHaveCount(0);
  await expectSlide(page, 2);
  await expect(page.locator('[data-zk-trigger]')).toBeFocused();
  expect(await page.evaluate(() => localStorage.getItem('workshop:zettelkasten:introduction'))).toBe(storedNotes);
  expect(vaultRequests).toContain('/zettelkasten/introduction.json');
  expect(apiRequests).toEqual([]);
  expect(writes).toEqual([]);
});

test('Zettelkasten は分野を切り替えられ、ページ移動後も対象記事を開く', async ({ page }) => {
  await page.goto('/playbook/github/?present=1');
  await expectSlide(page, 1);
  await page.locator('[data-zk-trigger]').click();
  const dialog = page.getByRole('dialog', { name: 'Zettelkasten ナレッジグラフ', exact: true });
  await expect(dialog.locator('.zk-note-title')).toHaveText('GitHub');
  await dialog.locator('.zk-vault-tab[data-vault-id="develop"]').click();
  await expect(dialog.locator('.zk-vault-tab[data-vault-id="develop"]')).toHaveAttribute('aria-selected', 'true');
  await expect(dialog.locator('[data-zk-current]')).toHaveText('開発 / GitHub');
  await dialog.locator('.zk-search-input').fill('Copilot CLI');
  await dialog.locator('.zk-search-item[data-open-slug="copilot-cli"]').click();
  await expect(dialog.locator('.zk-note-title')).toHaveText('Copilot CLI');
  await dialog.getByRole('button', { name: 'Esc スライドに戻る', exact: true }).click();
  await page.locator('.present-toc [data-id="cli"]').click();
  await expect(page).toHaveURL(/\/playbook\/cli\/\?present=1$/);
  await expectSlide(page, 1);
  await page.keyboard.press('z');
  await expect(dialog.locator('.zk-root')).toHaveCount(1);
  await expect(dialog.locator('.zk-note-title')).toHaveText('Copilot CLI');
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(page.locator('.zk-root')).toHaveCount(0);
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

test('更新した図表はレトロ配色で描画され、比較タブを切り替えられる', async ({ page }) => {
  await page.goto('/playbook/copilot-memory/?present=1');
  await expectSlide(page, 1);
  await expect(page.locator('.hero-quote.akq-slide-active')).toBeVisible();
  await expect(page.locator('.slide-progress-bar')).toHaveCount(7);
  await page.goto('/playbook/github-copilot/?present=1&slide=6');
  await expectSlide(page, 6);
  const fusion = page.locator('.fusion-slide.akq-slide-active');
  await expect(fusion).toBeVisible();
  await expect(fusion.locator('.fusion-metric > strong').first()).toHaveCSS('color', 'rgb(0, 240, 255)');
  await expect(fusion.locator('.fusion-metric').first()).toHaveCSS('border-radius', '0px');
  await page.goto('/playbook/pull-requests/?present=1&slide=7');
  await expectSlide(page, 7);
  await expect(page.locator('.figtabs-panel[data-idx="1"]')).toBeVisible();
  await page.locator('label[for="smm-2"]').click();
  await expect(page.locator('.figtabs-panel[data-idx="1"]')).toBeHidden();
  await expect(page.locator('.figtabs-panel[data-idx="2"]')).toBeVisible();
  await page.locator('#smm-2').focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('.figtabs-panel[data-idx="3"]')).toBeVisible();
  await expectSlide(page, 7);
  await page.goto('/playbook/code-quality/?present=1&slide=2');
  await expectSlide(page, 2);
  await page.locator('.vsx-pick > summary').first().click();
  await expect(page.locator('.vsx-pick[open] [data-side="cq"]')).toBeVisible();
  await page.locator('label[for="cqvs-scanning"]').click();
  await expect(page.locator('.vsx-pick[open] [data-side="cq"]')).toBeHidden();
  await expect(page.locator('.vsx-pick[open] [data-side="cs"]')).toBeVisible();
});

test('デモ手順と動画の標準操作はスライド操作と競合せず、非表示の動画は停止する', async ({ page }) => {
  await page.goto('/playbook/copilot-app/?present=1&slide=3');
  await expectSlide(page, 3);
  const demo = page.locator('.workshop-demo.akq-slide-active');
  await expect(demo).not.toHaveAttribute('open');
  await demo.locator(':scope > summary').focus();
  await page.keyboard.press('Space');
  await expect(demo).toHaveAttribute('open', '');
  await expectSlide(page, 3);
  await page.goto('/playbook/copilot-app/?present=1&slide=10');
  await expectSlide(page, 10);
  const video = page.locator('video');
  await expect(video).toBeVisible();
  await expect(video).toHaveAttribute('src', '/media/copilot-app-fraud-scoring.mp4');
  await expect(video).toHaveAttribute('controls', '');
  await expect.poll(() => video.evaluate((element: HTMLVideoElement) => element.readyState)).toBeGreaterThanOrEqual(1);
  expect(await video.evaluate((element: HTMLVideoElement) => element.videoWidth)).toBeGreaterThan(0);
  await video.focus();
  await page.keyboard.press('Space');
  await expect.poll(() => video.evaluate((element: HTMLVideoElement) => element.currentTime)).toBeGreaterThan(0);
  await expectSlide(page, 10);
  await page.getByRole('button', { name: '次のスライド', exact: true }).click();
  await expectSlide(page, 11);
  expect(await video.evaluate((element: HTMLVideoElement) => element.paused)).toBe(true);
});
