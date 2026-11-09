import { expect, test, type Page } from '@playwright/test';
import type { GalaxyCategory } from '../../src/lib/playbook-galaxy';

declare global {
  interface Window {
    galaxyRendering: { draws: number; frames: number; colors: number; litPixels: number };
  }
}

test.setTimeout(60_000);
test.use({ launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] } });

test.beforeEach(async ({ page }) => {
  await page.route('https://fonts.googleapis.com/**', (route) =>
    route.fulfill({ contentType: 'text/css', body: '' }));
  await page.addInitScript(() => {
    window.galaxyRendering = { draws: 0, frames: 0, colors: 0, litPixels: 0 };
    for (const name of ['drawArrays', 'drawElements'] as const) {
      const original = WebGL2RenderingContext.prototype[name];
      Object.defineProperty(WebGL2RenderingContext.prototype, name, {
        value: function (this: WebGL2RenderingContext, ...args: number[]) {
          Reflect.apply(original, this, args);
          window.galaxyRendering.draws++;
          if (this.getParameter(this.DRAW_FRAMEBUFFER_BINDING) !== null) return;
          // 表示用バッファが消える前に、HUD ではなく実際の WebGL ピクセルを確認する。
          const size = 128;
          const pixels = new Uint8Array(size * size * 4);
          this.readPixels(Math.floor((this.drawingBufferWidth - size) / 2),
            Math.floor((this.drawingBufferHeight - size) / 2), size, size, this.RGBA, this.UNSIGNED_BYTE, pixels);
          const colors = new Set<number>();
          let litPixels = 0;
          for (let index = 0; index < pixels.length; index += 4) {
            colors.add((pixels[index] << 16) | (pixels[index + 1] << 8) | pixels[index + 2]);
            if (Math.max(pixels[index], pixels[index + 1], pixels[index + 2]) > 50) litPixels++;
          }
          Object.assign(window.galaxyRendering, {
            frames: window.galaxyRendering.frames + 1, colors: colors.size, litPixels,
          });
        },
      });
    }
  });
});

test.afterEach(async ({ page }, info) => {
  expect(await page.pageErrors()).toEqual([]);
  const errors = (await page.consoleMessages()).filter((message) => message.type() === 'error').map((message) => message.text());
  if (info.annotations.some((annotation) => annotation.type === 'webgl-failure')) {
    expect(errors.length).toBeGreaterThan(0);
    for (const error of errors) expect(error).toMatch(/Unable to render 3D scene|Error creating WebGL context/);
  } else {
    expect(errors).toEqual([]);
  }
});

async function renderedGalaxy(page: Page) {
  await expect(page.locator('playbook-explorer')).toHaveAttribute('data-view', '3d');
  await expect(page.locator('.galaxy-stage')).toHaveAttribute('aria-busy', 'false');
  await expect(page.locator('.galaxy-stage canvas')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.galaxyRendering.draws)).toBeGreaterThan(100);
  await expect.poll(() => page.evaluate(() => window.galaxyRendering.frames)).toBeGreaterThan(0);
}

async function settleFrames(page: Page) {
  return page.evaluate(async () => {
    for (let index = 0; index < 6; index++) await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    return window.galaxyRendering.frames;
  });
}

test('2D から遅延読込した本物の 3D 銀河を描画し、太陽と7目的地を表示する', async ({ page }, info) => {
  const scripts: string[] = [];
  page.on('request', (request) => { if (request.resourceType() === 'script') scripts.push(request.url()); });
  await page.goto('/playbook/');
  await expect(page.getByRole('button', { name: '3D ギャラクシー', exact: true })).toBeVisible();
  expect(scripts.some((url) => url.includes('playbook-galaxy-scene'))).toBe(false);
  await expect(page.locator('.galaxy-stage canvas')).toHaveCount(0);
  await page.getByRole('button', { name: '3D ギャラクシー', exact: true }).click();
  await renderedGalaxy(page);
  expect(scripts.some((url) => url.includes('playbook-galaxy-scene'))).toBe(true);
  await expect.poll(() => page.evaluate(() => window.galaxyRendering.colors)).toBeGreaterThan(50);
  await expect.poll(() => page.evaluate(() => window.galaxyRendering.litPixels)).toBeGreaterThan(100);
  await expect(page.locator('.galaxy-planet-label:visible')).toHaveCount(8);
  await expect(page.locator('.galaxy-sun-label')).toHaveText('SDLC');
  await expect(page.locator('.galaxy-planet-label strong')).toHaveText([
    'Introduction', 'Plan', 'Develop', 'Review', 'Test & Secure', 'Operate', 'Administration',
  ]);
  await expect(page.locator('[data-music]')).toHaveCount(0);
  await expect(page.locator('.category-section:visible')).toHaveCount(0);
  expect(await page.locator('.site-header').evaluate((element) => element instanceof HTMLElement && element.inert)).toBe(true);
  await page.screenshot({ path: info.outputPath('galaxy-overview.png') });
});

test('惑星と衛星から概要と記事を開き、戻ると URL の目的地を復元する', async ({ page }) => {
  await page.goto('/playbook/?view=3d');
  await renderedGalaxy(page);
  const systems: GalaxyCategory[] = JSON.parse((await page.locator('[data-systems]').textContent())!);
  const entry = systems.find((system) => system.id === 'plan')!.entries[0];
  await page.getByRole('button', { name: /^企画 \(/ }).click();
  await expect(page).toHaveURL(/view=3d&sector=plan$/);
  await page.getByRole('button', { name: entry.title, exact: true }).click();
  const detail = page.locator(`[data-detail="${entry.slug}"]`);
  await expect(detail).toBeVisible();
  await expect(detail).toContainText(entry.summary);
  await expect(detail.locator('a')).toBeFocused();
  await expect(detail.locator('a')).toHaveAttribute('href', entry.href);
  expect(entry.href).not.toContain('/theomonfort/');
  const previousCanvas = (await page.locator('.galaxy-stage canvas').elementHandle())!;
  await detail.locator('a').click();
  await expect(page).toHaveURL(new RegExp(`${entry.href}$`));
  await expect(page.locator('.galaxy-stage canvas')).toHaveCount(0);
  expect(await previousCanvas.evaluate((canvas) => canvas instanceof HTMLCanvasElement
    && canvas.getContext('webgl2')?.isContextLost())).toBe(true);
  await previousCanvas.dispose();
  await expect(page.locator('body')).not.toHaveClass(/present-mode/);
  await page.goBack();
  await renderedGalaxy(page);
  await expect(page.getByRole('combobox', { name: '目的地', exact: true })).toHaveValue('plan');
  await expect(page.locator('.galaxy-stage canvas')).toHaveCount(1);
  await page.reload();
  await renderedGalaxy(page);
  await expect(page.getByRole('combobox', { name: '目的地', exact: true })).toHaveValue('plan');
});

test('遅延読込の途中で 2D に戻っても古い描画を開始せず、再入場できる', async ({ page }) => {
  let release!: () => void;
  let requested!: (url: string) => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const request = new Promise<string>((resolve) => { requested = resolve; });
  await page.route(/playbook-galaxy-scene.*\.js$/, async (route) => {
    requested(route.request().url());
    await gate;
    await route.continue();
  });
  try {
    await page.goto('/playbook/');
    await page.getByRole('button', { name: '3D ギャラクシー', exact: true }).click();
    const url = await request;
    await page.getByRole('button', { name: '2D カタログ', exact: true }).click();
    release();
    await page.evaluate(async (url) => { await import(url); }, url);
    await expect(page.locator('.galaxy-stage canvas')).toHaveCount(0);
    expect(await page.evaluate(() => window.galaxyRendering.draws)).toBe(0);
    expect(await page.locator('.site-header').evaluate((element) => element instanceof HTMLElement && element.inert)).toBe(false);
    await page.getByRole('button', { name: '3D ギャラクシー', exact: true }).click();
    await renderedGalaxy(page);
    await expect(page.locator('.galaxy-stage canvas')).toHaveCount(1);
  } finally {
    release();
  }
});

test('カメラボタンとドラッグ・ズーム・パンが実際の投影を変える', async ({ page }) => {
  await page.goto('/playbook/?view=3d');
  await renderedGalaxy(page);
  const label = page.getByRole('button', { name: /^企画 \(/ });
  const position = () => label.evaluate((element) => `${element.style.left},${element.style.top}`);
  const before = await position();
  await page.getByRole('button', { name: '左に回転', exact: true }).click();
  await expect.poll(position).not.toBe(before);
  const rotated = await position();
  await page.getByRole('button', { name: '上から見る', exact: true }).click();
  await expect.poll(position).not.toBe(rotated);
  const tilted = await position();
  await page.getByRole('button', { name: '拡大', exact: true }).click();
  await expect.poll(position).not.toBe(tilted);
  await page.getByRole('button', { name: 'カメラをリセット', exact: true }).click();
  await expect.poll(position).toBe(before);
  const canvas = page.locator('.galaxy-stage canvas');
  const bounds = (await canvas.boundingBox())!;
  const x = bounds.x + bounds.width * 0.8;
  const y = bounds.y + bounds.height * 0.8;
  for (const button of ['left', 'right'] as const) {
    const previous = await position();
    await page.mouse.move(x, y);
    await page.mouse.down({ button });
    await page.mouse.move(x - 100, y - 40, { steps: 4 });
    await page.mouse.up({ button });
    await expect.poll(position).not.toBe(previous);
  }
  const panned = await position();
  await page.mouse.wheel(0, -180);
  await expect.poll(position).not.toBe(panned);
});

test('reduced-motion と動きの停止を尊重し、Esc と 2D 復帰で描画を終了する', async ({ page }) => {
  await page.goto('/playbook/?view=3d&sector=plan');
  await renderedGalaxy(page);
  const motion = page.getByRole('button', { name: '動き', exact: true });
  await expect(motion).toHaveAttribute('aria-pressed', 'false');
  expect(await settleFrames(page)).toBe(await settleFrames(page));
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await motion.click();
  await expect(motion).toHaveAttribute('aria-pressed', 'true');
  const moving = await settleFrames(page);
  await expect.poll(() => page.evaluate(() => window.galaxyRendering.frames)).toBeGreaterThan(moving);
  await motion.click();
  await expect(motion).toHaveAttribute('aria-pressed', 'false');
  expect(await settleFrames(page)).toBe(await settleFrames(page));
  await page.getByRole('button', { name: 'ミッション', exact: true }).click();
  await expect(page.locator('.galaxy-panel')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.galaxy-panel')).toBeHidden();
  await page.keyboard.press('Escape');
  await expect(page).toHaveURL(/\/playbook\/\?view=3d$/);
  await page.keyboard.press('Escape');
  await expect(page).toHaveURL(/\/playbook\/$/);
  await expect(page.locator('.galaxy-stage canvas')).toHaveCount(0);
  await expect(page.locator('.category-section:visible')).toHaveCount(7);
  expect(await page.locator('.site-header').evaluate((element) => element instanceof HTMLElement && element.inert)).toBe(false);
  const stopped = await settleFrames(page);
  expect(await settleFrames(page)).toBe(stopped);
  await page.getByRole('button', { name: '3D ギャラクシー', exact: true }).click();
  await renderedGalaxy(page);
  await expect(page.locator('.galaxy-stage canvas')).toHaveCount(1);
});

test('モバイルでも目的地とミッションを操作でき、2D に戻れる', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/playbook/?view=3d&sector=invalid');
  await renderedGalaxy(page);
  await expect(page).not.toHaveURL(/sector=/);
  await page.getByRole('combobox', { name: '目的地', exact: true }).selectOption('administration');
  await expect(page).toHaveURL(/view=3d&sector=administration$/);
  await page.getByRole('button', { name: 'ミッション', exact: true }).click();
  await expect(page.locator('[data-sector="administration"]')).toBeVisible();
  await page.locator('[data-sector="administration"] [data-entry]').first().click();
  await expect(page.locator('[data-sector="administration"] [data-detail]:visible')).toHaveCount(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('button', { name: '2D カタログ', exact: true }).click();
  await expect(page.locator('.category-section:visible')).toHaveCount(7);
  await expect(page.locator('.galaxy-stage canvas')).toHaveCount(0);
});

test('WebGL が使えなくてもエラーを示し、利用可能な 2D カタログを残す',
  { annotation: { type: 'webgl-failure', description: 'WebGL の初期化失敗を意図的に再現' } }, async ({ page }) => {
    await page.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.getContext;
      Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
        value: function (this: HTMLCanvasElement, type: string, ...args: unknown[]) {
          return type.startsWith('webgl') ? null : Reflect.apply(original, this, [type, ...args]);
        },
      });
    });
    await page.goto('/playbook/?view=3d');
    await expect(page.getByRole('alert')).toHaveText('3D 表示を読み込めませんでした。2D カタログをご利用ください。');
    await expect(page.locator('playbook-explorer')).toHaveAttribute('data-view', '2d');
    await expect(page.getByRole('button', { name: '2D カタログ', exact: true })).toBeFocused();
    await expect(page.locator('.category-section:visible')).toHaveCount(7);
    await expect(page.locator('.galaxy-stage canvas')).toHaveCount(0);
    await page.locator('[data-playbook-tile]').first().click();
    await expect(page.getByRole('link', { name: '◀ Playbook に戻る', exact: true })).toBeVisible();
  });

test('描画中の WebGL コンテキスト喪失から安全に 2D へ戻る',
  { annotation: { type: 'webgl-failure', description: '描画後の WebGL 喪失を意図的に再現' } }, async ({ page }) => {
    await page.goto('/playbook/?view=3d');
    await renderedGalaxy(page);
    await page.locator('canvas').evaluate((canvas) => {
      if (!(canvas instanceof HTMLCanvasElement)) throw new Error('WebGL canvas がありません');
      const extension = canvas.getContext('webgl2')?.getExtension('WEBGL_lose_context');
      if (!extension) throw new Error('コンテキスト喪失の検証に必要な拡張がありません');
      extension.loseContext();
    });
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.locator('playbook-explorer')).toHaveAttribute('data-view', '2d');
    await expect(page.locator('.galaxy-stage canvas')).toHaveCount(0);
    expect(await page.locator('.site-header').evaluate((element) => element instanceof HTMLElement && element.inert)).toBe(false);
  });

test.describe('JavaScript なしのフォールバック', () => {
  test.use({ javaScriptEnabled: false });
  test('3D URL でも基本カタログと記事を利用できる', async ({ page }) => {
    await page.goto('/playbook/?view=3d&sector=plan');
    await expect(page.locator('.category-section:visible')).toHaveCount(7);
    await expect(page.locator('.explorer-controls')).toBeHidden();
    await page.locator('[data-playbook-tile]').first().click();
    await expect(page.getByRole('link', { name: '◀ Playbook に戻る', exact: true })).toBeVisible();
  });
});
