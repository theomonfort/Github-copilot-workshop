import { expect, test } from '@playwright/test';
import type { Scene } from 'three';

declare global {
  interface Window {
    __THREE_DEVTOOLS__: EventTarget;
    playbookDemo: {
      draws: number;
      colors: number;
      nodes: Record<string, { x: number; y: number }>;
      ship: { world: [number, number, number]; inView: boolean; exhaust: number } | null;
    };
  }
}

test('レトロ Playbook を1画面で巡る24秒デモ', async ({ page, context }) => {
  await page.route('https://fonts.googleapis.com/**', (route) =>
    route.fulfill({ contentType: 'text/css', body: '' }));
  await page.addInitScript(() => {
    window.playbookDemo = { draws: 0, colors: 0, nodes: {}, ship: null };
    // Three.js の観測フックで実際に描画された船を読む。位置・アニメーションは変更しない。
    window.__THREE_DEVTOOLS__ = new EventTarget();
    window.__THREE_DEVTOOLS__.addEventListener('observe', (event) => {
      if (!(event instanceof CustomEvent)) return;
      const observed: unknown = event.detail;
      if (!observed || typeof observed !== 'object' || !('isScene' in observed) || observed.isScene !== true) return;
      const scene = observed as Scene;
      const original = scene.onAfterRender;
      scene.onAfterRender = function (...args) {
        original.apply(this, args);
        const ship = this.getObjectByName('navigation-courier');
        const exhaust = ship?.getObjectByName('courier-exhaust');
        if (!ship?.visible || !exhaust) return;
        const world = ship.getWorldPosition(ship.position.clone());
        const projected = world.clone().project(args[2]);
        window.playbookDemo.ship = {
          world: [world.x, world.y, world.z],
          inView: projected.z > -1 && projected.z < 1 && Math.abs(projected.x) < 0.95 && Math.abs(projected.y) < 0.95,
          exhaust: exhaust.scale.z,
        };
      };
    });
    // 描画を差し替えず観測する。WebGL の表示バッファが消える前に色を確認する。
    for (const name of ['drawArrays', 'drawElements'] as const) {
      const original = WebGL2RenderingContext.prototype[name];
      WebGL2RenderingContext.prototype[name] = function (...args: number[]) {
        Reflect.apply(original, this, args);
        window.playbookDemo.draws++;
        if (window.playbookDemo.draws < 100 || window.playbookDemo.colors > 50
          || this.getParameter(this.DRAW_FRAMEBUFFER_BINDING) !== null) return;
        const pixels = new Uint8Array(128 * 128 * 4);
        this.readPixels(Math.floor((this.drawingBufferWidth - 128) / 2),
          Math.floor((this.drawingBufferHeight - 128) / 2), 128, 128, this.RGBA, this.UNSIGNED_BYTE, pixels);
        const colors = new Set<number>();
        for (let index = 0; index < pixels.length; index += 4) {
          colors.add((pixels[index] << 16) | (pixels[index + 1] << 8) | pixels[index + 2]);
        }
        window.playbookDemo.colors = colors.size;
      };
    }

    // GraphView が描いた円とラベルを対応付け、DPR・ズーム込みの実座標でクリックする。
    const centres = new Map<number, number>();
    const prototype = CanvasRenderingContext2D.prototype;
    const fillRect = prototype.fillRect;
    prototype.fillRect = function (...args) {
      fillRect.apply(this, args);
      if (this.canvas.classList.contains('zk-canvas') && args[0] === 0 && args[1] === 0) {
        centres.clear();
        window.playbookDemo.nodes = {};
      }
    };
    const arc = prototype.arc;
    prototype.arc = function (...args) {
      arc.apply(this, args);
      if (this.canvas.classList.contains('zk-canvas')) centres.set(args[0], args[1]);
    };
    const fillText = prototype.fillText;
    prototype.fillText = function (...args) {
      fillText.apply(this, args);
      if (!this.canvas.classList.contains('zk-canvas')) return;
      const [title, x] = args;
      const y = centres.get(x);
      if (y === undefined) return;
      const point = new DOMPoint(x, y).matrixTransform(this.getTransform());
      const bounds = this.canvas.getBoundingClientRect();
      window.playbookDemo.nodes[title] = {
        x: bounds.x + point.x * bounds.width / this.canvas.width,
        y: bounds.y + point.y * bounds.height / this.canvas.height,
      };
    };
  });
  await page.goto('/playbook/');
  const githubCard = page.locator('[data-playbook-tile][href="/playbook/github/"]');
  await expect(githubCard).toBeVisible();
  await githubCard.scrollIntoViewIfNeeded();
  await githubCard.hover();
  await expect(githubCard).toBeInViewport();
  const started = performance.now();
  let actions = 0;
  let added3dTime = 0;

  // 見せるための待機はデモだけに置き、操作にかかった時間も含めて配分する。
  const holdUntil = async (milliseconds: number) => {
    await page.waitForTimeout(Math.max(0, milliseconds - (performance.now() - started)));
  };
  const action = async (at: number, title: string, run: () => Promise<void>) => {
    await holdUntil(at + added3dTime);
    await test.step(title, run);
    actions++;
  };
  const expectSlide = async (number: number) => {
    await expect(page.locator('body')).toHaveClass(/present-mode/);
    await expect(page.locator('body')).not.toHaveClass(/slide-preparing/);
    await expect(page.locator('.slide-counter-text')).toHaveText(new RegExp(`^${number} / \\d+$`));
    await expect(page.getByRole('tab', { name: `Slide ${number}`, exact: true }))
      .toHaveAttribute('aria-selected', 'true');
  };
  const flyTo = async (destination: string) => {
    const before = await page.evaluate(() => window.playbookDemo.ship);
    expect(before).not.toBeNull();
    const departed = performance.now();
    await page.getByRole('combobox', { name: '目的地', exact: true }).selectOption(destination);
    // 既存のズーム操作でカメラの追従だけを止め、船が画面内を横切る様子を見せる。
    await page.getByRole('button', { name: '縮小', exact: true }).press('Enter');
    actions++;
    await expect(page).toHaveURL(new RegExp(`view=3d&sector=${destination}$`));
    await expect.poll(() => page.evaluate((from) => {
      const ship = window.playbookDemo.ship;
      return ship !== null && ship.inView && ship.exhaust > 0.5
        && Math.hypot(...ship.world.map((value, index) => value - from[index])) > 1;
    }, before!.world)).toBe(true);
    await expect.poll(() => page.evaluate(() => {
      const ship = window.playbookDemo.ship;
      return { inView: ship?.inView, exhaust: ship?.exhaust };
    }), { intervals: [50] }).toEqual({ inView: true, exhaust: 0.12 });
    console.log(`宇宙船 ${destination}: 到着まで ${((performance.now() - departed) / 1_000).toFixed(2)} 秒、到着後0.6秒表示`);
    await page.waitForTimeout(600);
  };

  await action(400, '3D ギャラクシーを開く', async () => {
    await page.getByRole('button', { name: '3D ギャラクシー', exact: true }).click();
    await expect(page.locator('.galaxy-stage')).toHaveAttribute('aria-busy', 'false');
    await expect(page.locator('.galaxy-stage canvas')).toBeVisible();
    await expect.poll(() => page.evaluate(() => window.playbookDemo.colors)).toBeGreaterThan(50);
    await expect(page.locator('.galaxy-planet-label:visible')).toHaveCount(8);
  });
  await action(1_600, 'ドラッグで銀河を回転する', async () => {
    const label = page.getByRole('button', { name: /^企画 \(/ });
    const position = () => label.evaluate((element) => `${element.style.left},${element.style.top}`);
    const before = await position();
    const bounds = await page.locator('.galaxy-stage canvas').boundingBox();
    expect(bounds).not.toBeNull();
    const x = bounds!.x + bounds!.width * 0.8;
    const y = bounds!.y + bounds!.height * 0.8;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x - bounds!.width * 0.12, y - bounds!.height * 0.06, { steps: 8 });
    await page.mouse.up();
    await expect.poll(position).not.toBe(before);
  });
  await action(2_100, '宇宙船の動きを有効にする', async () => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.getByRole('button', { name: '動き', exact: true }).click();
    await expect(page.getByRole('button', { name: '動き', exact: true })).toHaveAttribute('aria-pressed', 'true');
  });
  await action(2_500, '宇宙船で Operate の惑星へ飛び、到着まで見せる', async () => {
    await flyTo('operate');
  });
  await action(5_500, '宇宙船で Test & Secure の惑星へ飛び、到着まで見せる', async () => {
    await flyTo('secure');
  });
  await action(8_300, '飛行を終えて後半の表示設定に戻す', async () => {
    await page.getByRole('button', { name: '動き', exact: true }).click();
    await expect(page.getByRole('button', { name: '動き', exact: true })).toHaveAttribute('aria-pressed', 'false');
    await page.emulateMedia({ reducedMotion: 'reduce' });
  });
  // 以降の操作と間隔は18秒版のまま、3D延長分だけ全体を後ろへずらす。
  added3dTime = 6_000;
  await action(2_500, 'Introduction の出発ステーションを選ぶ', async () => {
    await page.getByRole('combobox', { name: '目的地', exact: true }).selectOption('introduction');
    await expect(page).toHaveURL(/view=3d&sector=introduction$/);
  });
  await action(3_100, 'GitHub の衛星を選ぶ', async () => {
    await page.getByRole('button', { name: 'GitHub', exact: true }).click();
    await expect(page.locator('[data-detail="github"]')).toBeVisible();
  });
  await action(3_700, '3D の概要から記事を開く', async () => {
    await page.locator('[data-detail="github"] [data-galaxy-article]').click();
    await expect(page).toHaveURL(/\/playbook\/github\/$/);
    await expect(page.getByRole('heading', { name: 'ギットハブ', exact: true })).toBeVisible();
    await expect(page.locator('body')).not.toHaveClass(/present-mode/);
    await expect(page.locator('.galaxy-stage canvas')).toHaveCount(0);
  });
  await action(4_600, 'P でプレゼンを開始する', async () => {
    await page.keyboard.press('p');
    await expectSlide(1);
    await expect(page.locator('.hero-quote.akq-slide-active')).toBeInViewport();
  });
  const toc = page.getByRole('navigation', { name: 'プレゼン目次' });
  await action(5_100, '目次を閉じてスライドを広く表示する', async () => {
    await page.locator('[data-toc-toggle]').click();
    await expect(page.locator('body')).toHaveClass(/akq-toc-hidden/);
    await expect(toc).not.toBeInViewport();
  });
  await action(5_600, 'GitHub の次のスライドへ進む', async () => {
    await page.getByRole('button', { name: '次のスライド', exact: true }).click();
    await expectSlide(2);
    await expect(page.locator('.prose-akq > h2.akq-slide-active')).toBeVisible();
  });
  await action(6_100, 'キーボードでもう1枚進む', async () => {
    await page.keyboard.press('ArrowRight');
    await expectSlide(3);
  });
  await action(6_600, '目次を開き直す', async () => {
    await page.locator('[data-toc-toggle]').click();
    await expect(page.locator('body')).not.toHaveClass(/akq-toc-hidden/);
    await expect(toc).toBeInViewport();
  });
  await action(7_100, '目次から Copilot のセクションへ移る', async () => {
    await toc.locator('[data-id="github-copilot"]').click();
    await expect(page).toHaveURL(/\/playbook\/github-copilot\/\?present=1$/);
    await expectSlide(1);
    await expect(toc.locator('[data-id="github-copilot"]')).toHaveAttribute('aria-current', 'page');
  });
  await action(8_000, '進捗バーから Fusion を表示する', async () => {
    await page.getByRole('tab', { name: 'Slide 6', exact: true }).click();
    await expectSlide(6);
    await expect(page.locator('.fusion-slide.akq-slide-active')).toBeInViewport();
  });
  const dialog = page.getByRole('dialog', { name: 'Zettelkasten ナレッジグラフ', exact: true });
  await action(8_700, 'Zettelkasten の実グラフを開く', async () => {
    await page.locator('[data-zk-trigger]').click();
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('[data-zk-loading]')).toBeHidden();
    await expect(dialog.locator('.zk-note-title')).toHaveText('GitHub Copilot');
    await expect.poll(() => page.evaluate(() => Object.keys(window.playbookDemo.nodes).length))
      .toBeGreaterThan(5);
  });
  await action(10_000, '描画された GitHub ノードをクリックする', async () => {
    const point = () => page.evaluate(() => {
      const node = window.playbookDemo.nodes.GitHub;
      return node && document.elementFromPoint(node.x, node.y)?.matches('.zk-canvas') ? node : null;
    });
    await expect.poll(point).not.toBeNull();
    const node = (await point())!;
    await page.mouse.click(node.x, node.y);
    await expect(dialog.locator('.zk-note-title')).toHaveText('GitHub');
    await expect(dialog.locator('.zk-read-pane')).not.toBeEmpty();
  });
  await action(10_700, 'ノート内のリンクで Copilot へ戻る', async () => {
    await dialog.locator('.zk-read-pane .zk-wikilink[data-resolved="github-copilot"]').first().click();
    await expect(dialog.locator('.zk-note-title')).toHaveText('GitHub Copilot');
  });
  await action(11_500, '開発分野のノートへ切り替える', async () => {
    await dialog.locator('.zk-vault-tab[data-vault-id="develop"]').click();
    await expect(dialog.locator('.zk-vault-tab[data-vault-id="develop"]')).toHaveAttribute('aria-selected', 'true');
    await expect(dialog.locator('[data-zk-current]')).toHaveText('開発 / GitHub');
  });
  await action(12_300, 'Copilot CLI を検索する', async () => {
    await dialog.locator('.zk-search-input').fill('Copilot CLI');
    await expect(dialog.locator('.zk-search-item[data-open-slug="copilot-cli"]')).toBeVisible();
  });
  await action(12_900, '検索結果から CLI ノートを開く', async () => {
    await dialog.locator('.zk-search-item[data-open-slug="copilot-cli"]').click();
    await expect(dialog.locator('.zk-note-title')).toHaveText('Copilot CLI');
    await expect(dialog.locator('.zk-read-pane')).not.toBeEmpty();
  });
  await action(13_700, 'グラフを閉じて元のスライドへ戻る', async () => {
    await dialog.getByRole('button', { name: 'Esc スライドに戻る', exact: true }).click();
    await expect(dialog).not.toBeVisible();
    await expect(dialog.locator('.zk-root')).toHaveCount(0);
    await expectSlide(6);
  });
  await action(14_300, '目次から CLI のセクションへ移る', async () => {
    await toc.locator('[data-id="cli"]').click();
    await expect(page).toHaveURL(/\/playbook\/cli\/\?present=1$/);
    await expectSlide(1);
    await expect(toc.locator('[data-id="cli"]')).toHaveAttribute('aria-current', 'page');
  });
  await action(15_200, '目次を閉じる', async () => {
    await page.locator('[data-toc-toggle]').click();
    await expect(page.locator('body')).toHaveClass(/akq-toc-hidden/);
    await expect(toc).not.toBeInViewport();
  });
  await action(15_800, 'CLI の次のスライドへ進む', async () => {
    await page.getByRole('button', { name: '次のスライド', exact: true }).click();
    await expectSlide(2);
  });
  await action(16_700, 'Esc で一覧へ戻る', async () => {
    await page.keyboard.press('Escape');
    await expect(page).toHaveURL(/\/playbook\/$/);
    await expect(page.locator('body')).not.toHaveClass(/present-mode|slide-preparing/);
    await expect(githubCard).toBeVisible();
    await githubCard.scrollIntoViewIfNeeded();
    await expect(githubCard).toBeInViewport();
    expect(context.pages()).toHaveLength(1);
    expect(await page.pageErrors()).toEqual([]);
    expect((await page.consoleMessages()).filter((message) => message.type() === 'error')).toEqual([]);
  });
  await holdUntil(18_000 + added3dTime);

  const seconds = (performance.now() - started) / 1_000;
  console.log(`デモ画面の表示時間: ${seconds.toFixed(2)} 秒、操作数: ${actions}（従来6、3D延長: ${added3dTime / 1_000}秒、準備・ビルド・ブラウザ起動を除く）`);
  expect(actions).toBeGreaterThanOrEqual(12);
  expect(seconds).toBeGreaterThanOrEqual(24);
  expect(seconds).toBeLessThanOrEqual(26);
});
