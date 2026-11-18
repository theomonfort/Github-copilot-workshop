import { resolvePlaybookZettelkastenTarget } from '../lib/zettelkasten/playbook-mapping';
import { getZettelkastenVaults } from '../lib/zettelkasten/vaults';
import { categories } from '../lib/playbook-categories';
import type { ZettelkastenWidget } from '../vendor/zettelkasten/zettelkasten-widget';

let widget: ZettelkastenWidget | null = null;
let request: AbortController | null = null;
let pageEvents: AbortController | null = null;
let slideObserver: MutationObserver | null = null;
let generation = 0;
let opener: HTMLButtonElement | null = null;

function currentTarget(button: HTMLButtonElement) {
  const category = categories.find(({ id }) => id === button.dataset.playbookCategory)?.id;
  const slide = document.querySelector<HTMLElement>('.slide-progress-bar[aria-selected="true"]');
  const index = Number(slide?.dataset.slideIndex ?? 0);
  return resolvePlaybookZettelkastenTarget(
    button.dataset.playbookSlug ?? '',
    category,
    Number.isInteger(index) && index >= 0 ? index : 0,
  );
}

function closeModal(restoreFocus = true) {
  generation++;
  // マウント後の分野切替は、上流側の destroyed ガードで完了を破棄する。
  if (!widget) request?.abort();
  request = null;
  widget?.destroy();
  widget = null;
  // 上流の destroy は root の匿名リスナーを残すため、次回は新しい要素にマウントする。
  const stage = document.querySelector<HTMLElement>('[data-zk-stage]');
  if (stage) stage.replaceWith(stage.cloneNode(false));
  document.querySelector<HTMLDialogElement>('#playbook-zettelkasten')?.close();
  document.body.classList.remove('akq-zk-open');
  if (restoreFocus && opener?.isConnected) opener.focus();
  opener = null;
}

async function openModal(button: HTMLButtonElement) {
  const dialog = document.querySelector<HTMLDialogElement>('#playbook-zettelkasten');
  const stage = dialog?.querySelector<HTMLElement>('[data-zk-stage]');
  const loading = dialog?.querySelector<HTMLElement>('[data-zk-loading]');
  const current = dialog?.querySelector<HTMLElement>('[data-zk-current]');
  if (!dialog || !stage || !loading || !current) {
    console.error('Zettelkasten の表示要素が見つかりません。');
    return;
  }
  if (dialog.open) return;
  const target = currentTarget(button);
  const token = ++generation;
  const controller = new AbortController();
  request = controller;
  opener = button;
  current.textContent = '';
  loading.hidden = false;
  loading.textContent = 'Zettelkasten を読み込み中…';
  dialog.showModal();
  document.body.classList.add('akq-zk-open');

  try {
    const { mountZettelkasten } = await import('../vendor/zettelkasten/zettelkasten-widget.js');
    if (token !== generation) return;
    const instance = await mountZettelkasten(stage, {
      locale: 'ja',
      vaults: getZettelkastenVaults(controller.signal).map((vault) =>
        vault.id === target.vault ? { ...vault, initialNote: target.note } : vault),
      initialVault: target.vault,
      readOnly: true,
      apiBaseUrl: null,
      persistLocalStorage: false,
      pinInitialNote: true,
      colorByGroup: false,
      onActiveChange: ({ vaultLabel, title }) => {
        if (token === generation) current.textContent = `${vaultLabel} / ${title}`;
      },
    });
    if (token !== generation) {
      instance.destroy();
      return;
    }
    widget = instance;
    loading.hidden = true;
    await instance.openVaultAndNote(target.vault, target.note, { pinGraph: true, focusGraph: true });
  } catch (error) {
    if (token !== generation && controller.signal.aborted) return;
    console.error('Zettelkasten の読み込みに失敗しました。', error);
    widget?.destroy();
    widget = null;
    loading.hidden = false;
    loading.textContent = 'ナレッジグラフを読み込めませんでした。閉じてからもう一度お試しください。';
  }
}

function teardown() {
  closeModal(false);
  pageEvents?.abort();
  pageEvents = null;
  slideObserver?.disconnect();
  slideObserver = null;
}

function setup() {
  teardown();
  const button = document.querySelector<HTMLButtonElement>('[data-zk-trigger]');
  const dialog = document.querySelector<HTMLDialogElement>('#playbook-zettelkasten');
  if (!button || !dialog) return;
  pageEvents = new AbortController();
  const { signal } = pageEvents;
  const syncTopic = () => {
    const topic = button.querySelector<HTMLElement>('[data-zk-topic]');
    if (topic) topic.textContent = currentTarget(button).note;
  };
  syncTopic();
  const progress = document.querySelector('.slide-progress');
  if (progress) {
    slideObserver = new MutationObserver(syncTopic);
    slideObserver.observe(progress, { subtree: true, childList: true, attributes: true, attributeFilter: ['aria-selected'] });
  }
  button.addEventListener('click', () => void openModal(button), { signal });
  dialog.querySelector('[data-zk-close]')?.addEventListener('click', () => closeModal(), { signal });
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    if (!widget?.dismissPopup()) closeModal();
  }, { signal });
  document.addEventListener('keydown', (event) => {
    if (dialog.open || !document.body.classList.contains('present-mode')) return;
    if (event.ctrlKey || event.metaKey || event.altKey || event.repeat) return;
    const target = event.target;
    if (target instanceof HTMLElement && (target.isContentEditable || target.closest('input,textarea,select'))) return;
    if (event.key.toLowerCase() === 'z') {
      event.preventDefault();
      void openModal(button);
    }
  }, { signal });
}

document.addEventListener('astro:before-preparation', teardown);
document.addEventListener('astro:page-load', setup);
setup();
