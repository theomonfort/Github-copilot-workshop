// ── Slide engine (split content by <h2>; cover = header + first H2 group) ──
type Slide = HTMLElement[];
let slides: Slide[] = [];
let current = 0;
let restoreFns: Array<() => void> = [];
let slideRefreshToken = 0;
let preservedTocScrollTop: number | null = null;
const SLIDE_PREPARING_CLASS = 'slide-preparing';
// Set true when Esc fires inside present mode to short-circuit the
// present→article paint and propagate "no present" onto the destination doc.
let escapingFromPresent = false;

function setSlidePreparing(on: boolean) {
  document.documentElement.classList.toggle(SLIDE_PREPARING_CLASS, on);
  document.body.classList.toggle(SLIDE_PREPARING_CLASS, on);
}

function buildSlides(): Slide[] {
  const section = document.querySelector<HTMLElement>('.playbook-detail');
  if (!section) return [];
  const header = section.querySelector<HTMLElement>(':scope > header');
  const article = section.querySelector<HTMLElement>(':scope > article.prose-akq');
  if (!article) return header ? [[header]] : [];

  const groups: HTMLElement[][] = [];
  let bucket: HTMLElement[] = [];
  Array.from(article.children).forEach((child) => {
    const el = child as HTMLElement;
    if (el.tagName === 'H2' && bucket.length > 0) {
      groups.push(bucket);
      bucket = [el];
    } else {
      bucket.push(el);
    }
  });
  if (bucket.length) groups.push(bucket);

  if (header && groups[0] && section.dataset.hasNutshell === 'true') groups[0] = [header, ...groups[0]];
  else if (header) groups.unshift([header]);

  const linksAside = section.querySelector<HTMLElement>(':scope > aside.links-aside');
  if (linksAside) groups.push([linksAside]);

  return groups;
}

function showSlide(i: number) {
  if (!slides.length) return;
  current = Math.max(0, Math.min(slides.length - 1, i));
  slides.forEach((slide, idx) => {
    const active = idx === current;
    slide.forEach((el) => {
      el.classList.toggle('akq-slide-hidden', !active);
      el.classList.toggle('akq-slide-active', active);
    });
  });
  updateChrome();
}

function updateChrome() {
  const counter = document.querySelector<HTMLElement>('.slide-counter');
  if (counter) {
    const text = counter.querySelector<HTMLElement>('.slide-counter-text');
    if (text) text.textContent = `${current + 1} / ${slides.length}`;
  }
  const prog = document.querySelector<HTMLElement>('.slide-progress');
  if (prog) {
    prog.innerHTML = '';
    for (let i = 0; i < slides.length; i++) {
      const bar = document.createElement('button');
      bar.type = 'button';
      bar.className = 'slide-progress-bar' + (i <= current ? ' active' : '');
      bar.dataset.slideIndex = String(i);
      bar.setAttribute('role', 'tab');
      bar.setAttribute('aria-label', `Slide ${i + 1}`);
      bar.setAttribute('aria-selected', i === current ? 'true' : 'false');
      bar.addEventListener('click', () => {
        showSlide(i);
        const url = new URL(window.location.href);
        if (i > 0) url.searchParams.set('slide', String(i + 1));
        else url.searchParams.delete('slide');
        history.replaceState(null, '', url.pathname + url.search);
      });
      prog.appendChild(bar);
    }
  }
  const tag = document.querySelector<HTMLElement>('.slide-title-tag');
  if (tag) {
    const titleEl = document.querySelector<HTMLElement>('.playbook-detail header h1');
    const titleText = titleEl?.textContent ?? '';
    tag.replaceChildren();
    if (current !== 0) {
      const titleSpan = document.createElement('span');
      titleSpan.className = 'tag-main';
      titleSpan.textContent = titleText;
      tag.appendChild(titleSpan);
    }
    tag.classList.toggle('visible', current > 0);
  }
  document.body.classList.toggle('slide-cover', current === 0);
  // Update active item in left TOC (now playbook-entry-based, handled by syncToc)
}

// ── TOC across playbook entries ──────────────────────────────
function rememberTocScroll() {
  const toc = document.querySelector<HTMLElement>('.present-toc');
  if (toc) preservedTocScrollTop = toc.scrollTop;
}

function restoreTocScroll(toc: HTMLElement) {
  if (preservedTocScrollTop === null) return;
  const top = preservedTocScrollTop;
  toc.scrollTop = top;
  requestAnimationFrame(() => {
    toc.scrollTop = top;
    requestAnimationFrame(() => {
      toc.scrollTop = top;
      if (preservedTocScrollTop === top) preservedTocScrollTop = null;
    });
  });
}

function syncToc() {
  const toc = document.querySelector<HTMLElement>('.present-toc');
  if (!toc) return;
  const currentScrollTop = preservedTocScrollTop ?? toc.scrollTop;
  const currentId = (location.pathname.match(/\/(?:en\/)?playbook\/([^/]+)/)?.[1]) || toc.dataset.currentId || '';
  const items = Array.from(toc.querySelectorAll<HTMLElement>('.toc-item'));
  items.forEach((el) => {
    el.classList.remove('toc-hidden');
    el.classList.toggle('active', el.dataset.id === currentId);
    if (el.dataset.id === currentId) el.setAttribute('aria-current', 'page');
    else el.removeAttribute('aria-current');
    // Preserve present mode in target href when navigating
    if (document.body.classList.contains('present-mode')) {
      const u = new URL(el.getAttribute('href') || '', window.location.origin);
      u.searchParams.set('present', '1');
      u.searchParams.delete('slide');
      el.setAttribute('href', u.pathname + (u.search ? u.search : ''));
    }
  });
  // Do not auto-scroll the TOC: keep the user's current sidebar position stable.
  toc.scrollTop = currentScrollTop;
  restoreTocScroll(toc);
}

function enterSlideMode(startSlide?: number) {
  slides = buildSlides();
  if (!slides.length) return;

  // Tag every slide element so CSS can apply
  slides.forEach((slide) => slide.forEach((el) => el.classList.add('akq-slide-el')));
  restoreFns.push(() => {
    slides.forEach((slide) =>
      slide.forEach((el) => {
        el.classList.remove('akq-slide-el', 'akq-slide-hidden', 'akq-slide-active');
      })
    );
  });

  syncToc();

  // start at slide param (1-indexed in the URL) or the cover slide
  const params = new URLSearchParams(window.location.search);
  const raw = params.get('slide');
  const s = startSlide ?? (raw === null ? 0 : parseInt(raw, 10) - 1);
  showSlide(isNaN(s) ? 0 : s);
}

function resetChrome() {
  const counter = document.querySelector<HTMLElement>('.slide-counter');
  if (counter) {
    const text = counter.querySelector<HTMLElement>('.slide-counter-text');
    if (text) text.textContent = '';
  }
  const prog = document.querySelector<HTMLElement>('.slide-progress');
  if (prog) prog.innerHTML = '';
  const tag = document.querySelector<HTMLElement>('.slide-title-tag');
  if (tag) {
    tag.innerHTML = '';
    tag.classList.remove('visible');
  }
  document.body.classList.remove('slide-cover');
}

function exitSlideMode() {
  restoreFns.forEach((fn) => fn());
  restoreFns = [];
  document
    .querySelectorAll<HTMLElement>('.akq-slide-el, .akq-slide-hidden, .akq-slide-active')
    .forEach((el) => {
      el.classList.remove('akq-slide-el', 'akq-slide-hidden', 'akq-slide-active');
    });
  slides = [];
  current = 0;
  resetChrome();
}

async function refreshSlideMode() {
  const token = ++slideRefreshToken;
  setSlidePreparing(true);
  exitSlideMode();
  if (!document.body.classList.contains('present-mode')) {
    setSlidePreparing(false);
    return;
  }
  if (!document.querySelector('.playbook-detail')) {
    setSlidePreparing(false);
    return;
  }
  await renderMermaid();
  if (token !== slideRefreshToken) return;
  if (!document.body.classList.contains('present-mode')) {
    setSlidePreparing(false);
    return;
  }
  if (!document.querySelector('.playbook-detail')) {
    setSlidePreparing(false);
    return;
  }
  enterSlideMode();
  syncSlideUrl();
  requestAnimationFrame(() => {
    if (token === slideRefreshToken) setSlidePreparing(false);
  });
}

// ── Presentation mode toggle ───────────────────────────────────
function setPresent(on: boolean) {
  on = on && window.matchMedia('(min-width: 768px)').matches;
  if (on && !document.querySelector('.playbook-detail')) return;
  const wasOn = document.body.classList.contains('present-mode');
  document.body.classList.toggle('present-mode', on);
  document.documentElement.classList.toggle('present-mode', on);
  if (on) restoreTocPref();
  const url = new URL(window.location.href);
  if (on) url.searchParams.set('present', '1');
  else { url.searchParams.delete('present'); url.searchParams.delete('slide'); }
  history.replaceState(null, '', url.pathname + (url.search || '') + url.hash);

  if (on) void refreshSlideMode();
  if (!on) {
    slideRefreshToken++;
    setSlidePreparing(false);
    if (wasOn || slides.length) exitSlideMode();
  }

  if (on) {
    document.querySelectorAll<SVGSVGElement>('.mermaid-wrap svg').forEach((svg) => {
      svg.removeAttribute('width');
      svg.removeAttribute('height');
      svg.style.maxWidth = 'none';
      svg.style.width = '100%';
      svg.style.height = 'auto';
    });
  }
}

function syncSlideUrl() {
  const url = new URL(window.location.href);
  if (current > 0) url.searchParams.set('slide', String(current + 1));
  else url.searchParams.delete('slide');
  const nextUrl = url.pathname + (url.search || '') + url.hash;
  if (nextUrl !== window.location.pathname + window.location.search + window.location.hash) {
    history.replaceState(null, '', nextUrl);
  }
}

function initPresent() {
  const params = new URLSearchParams(window.location.search);
  setPresent(params.get('present') === '1');
  const btn = document.getElementById('present-toggle');
  if (btn && !btn.dataset.bound) {
    btn.dataset.bound = '1';
    btn.addEventListener('click', () =>
      setPresent(!document.body.classList.contains('present-mode'))
    );
  }
  document.querySelectorAll<HTMLButtonElement>('[data-slide-action]').forEach((b) => {
    if (b.dataset.bound) return;
    b.dataset.bound = '1';
    b.addEventListener('click', (e) => {
      e.preventDefault();
      b.blur();
      const action = b.dataset.slideAction;
      const keyMap: Record<string, string> = { prev: 'ArrowLeft', next: 'ArrowRight', exit: 'Escape' };
      const key = keyMap[action || ''];
      if (key) {
        document.body.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
      }
    });
  });
}

function onKey(e: KeyboardEvent) {
  const t = e.target as HTMLElement | null;
  if (e.altKey || e.ctrlKey || e.metaKey || t?.closest('input,textarea,select,[contenteditable="true"]')) return;
  const section = document.querySelector<HTMLElement>('.playbook-detail');
  if (!section) return;
  const present = document.body.classList.contains('present-mode');

  if (e.key === 'p' || e.key === 'P') {
    e.preventDefault();
    setPresent(!present);
    return;
  }
  if (e.key === 'Escape') {
    // Escape always returns to the playbook grid — bypass the intermediate
    // article view. Keep present-mode + slide-preparing on while the SPA
    // navigation runs so the article doesn't flash into view; clean up
    // <html>'s persistent classes in the after-swap handler below.
    const index = section.dataset.index || '/playbook';
    if (present) {
      escapingFromPresent = true;
      setSlidePreparing(true);
    }
    navigateSmooth(index);
    return;
  }
  if (!present) return;

  if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
    e.preventDefault();
    if (current < slides.length - 1) {
      showSlide(current + 1);
      syncSlideUrl();
    } else {
      const nx = section?.dataset.next;
      if (nx) navigateSmooth(nx + '?present=1');
    }
    return;
  }
  if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
    e.preventDefault();
    if (current > 0) {
      showSlide(current - 1);
      syncSlideUrl();
    } else {
      const pv = section?.dataset.prev;
      if (pv) navigateSmooth(pv + `?present=1&slide=999`);
    }
    return;
  }
  if (e.key === 't' || e.key === 'T') {
    e.preventDefault();
    toggleToc();
    return;
  }
}

const TOC_HIDDEN_KEY = 'akq:present:toc-hidden';
function applyTocHidden(hidden: boolean) {
  document.body.classList.toggle('akq-toc-hidden', hidden);
  document
    .querySelectorAll<HTMLButtonElement>('[data-toc-toggle]')
    .forEach((btn) => btn.setAttribute('aria-pressed', hidden ? 'true' : 'false'));
}
function toggleToc(force?: boolean) {
  const next = typeof force === 'boolean' ? force : !document.body.classList.contains('akq-toc-hidden');
  applyTocHidden(next);
  try {
    localStorage.setItem(TOC_HIDDEN_KEY, next ? '1' : '0');
  } catch (error) { console.warn('[presentation storage]', error); }
}
function restoreTocPref() {
  let hidden = false;
  try {
    hidden = localStorage.getItem(TOC_HIDDEN_KEY) === '1';
  } catch (error) { console.warn('[presentation storage]', error); }
  applyTocHidden(hidden);
}
function onTocToggleClick(e: MouseEvent) {
  const target = e.target as HTMLElement | null;
  const tocItem = target?.closest<HTMLElement>('.present-toc .toc-item');
  if (tocItem) {
    rememberTocScroll();
    tocItem.blur();
    return;
  }
  const btn = target?.closest<HTMLElement>('[data-toc-toggle]');
  if (!btn) return;
  e.preventDefault();
  toggleToc();
}

async function navigateSmooth(href: string) {
  try {
    if (document.body.classList.contains('present-mode')) setSlidePreparing(true);
    const mod = await import('astro:transitions/client');
    await mod.navigate(href);
  } catch (error) {
    console.error('[presentation navigation]', error);
    window.location.href = href;
  }
}

const win = window as Window & typeof globalThis & {
  __akqGlossaryCleanup?: () => void;
};

win.__akqGlossaryCleanup?.();

async function initGlossaryInteractions() {
  if (!document.querySelector('.playbook-detail')) {
    setPresent(false);
    return;
  }

  initPresent();
  if (!document.body.classList.contains('present-mode')) {
    await renderMermaid();
  }
  syncToc();
}

document.addEventListener('keydown', onKey);
document.addEventListener('click', onTocToggleClick);
function preparePresentNavigation(event?: Event) {
  rememberTocScroll();
  if (escapingFromPresent) {
    // Escape-to-index: don't carry present-mode onto the destination doc.
    // The current page's classes stay put so the article view doesn't flash;
    // the after-swap handler strips them from <html> once the swap lands.
    return;
  }
  const currentPresent = document.body.classList.contains('present-mode') || document.documentElement.classList.contains('present-mode');
  const targetPresent = new URLSearchParams(location.search).get('present') === '1';
  if (!currentPresent && !targetPresent) return;
  setSlidePreparing(true);

  const astroEvent = event as (Event & {
    newDocument?: Document;
    detail?: { newDocument?: Document };
  });
  const nextDocument = astroEvent.newDocument ?? astroEvent.detail?.newDocument;
  nextDocument?.documentElement.classList.add('present-mode', SLIDE_PREPARING_CLASS);
  nextDocument?.body?.classList.add('present-mode', SLIDE_PREPARING_CLASS);
  if (document.body.classList.contains('akq-toc-hidden')) {
    nextDocument?.body?.classList.add('akq-toc-hidden');
  }
}
function clearPresentAfterEscape() {
  if (!escapingFromPresent) return;
  escapingFromPresent = false;
  // <html> persists across View Transitions, so its present-mode +
  // slide-preparing classes must be cleared manually once the index lands.
  document.documentElement.classList.remove('present-mode', SLIDE_PREPARING_CLASS);
  document.body.classList.remove('present-mode', SLIDE_PREPARING_CLASS);
}
document.addEventListener('astro:before-preparation', preparePresentNavigation);
document.addEventListener('astro:before-swap', preparePresentNavigation);
document.addEventListener('astro:after-swap', clearPresentAfterEscape);
document.addEventListener('astro:page-load', initGlossaryInteractions);
const desktopQuery = window.matchMedia('(min-width: 768px)');
function onViewportChange() {
  if (!desktopQuery.matches) setPresent(false);
}
desktopQuery.addEventListener('change', onViewportChange);
win.__akqGlossaryCleanup = () => {
  document.removeEventListener('keydown', onKey);
  document.removeEventListener('click', onTocToggleClick);
  document.removeEventListener('astro:before-preparation', preparePresentNavigation);
  document.removeEventListener('astro:before-swap', preparePresentNavigation);
  document.removeEventListener('astro:after-swap', clearPresentAfterEscape);
  document.removeEventListener('astro:page-load', initGlossaryInteractions);
  desktopQuery.removeEventListener('change', onViewportChange);
};

// ── Mermaid (loaded async, won't block keyboard) ───────────────
let mermaidRenderPromise: Promise<void> | null = null;

async function renderMermaid() {
  if (mermaidRenderPromise) return mermaidRenderPromise;

  mermaidRenderPromise = renderMermaidNow().finally(() => {
    mermaidRenderPromise = null;
  });
  return mermaidRenderPromise;
}

async function renderMermaidNow() {
  try {
    const blocks = document.querySelectorAll(
      'pre[data-language="mermaid"], pre > code.language-mermaid'
    );
    const existingWraps = document.querySelectorAll('.mermaid-wrap');
    if (blocks.length === 0 && existingWraps.length === 0) return;
    if (blocks.length === 0) {
      applyMermaidSizing();
      return;
    }

    const { default: mermaid } = await import('mermaid');
    mermaid.initialize({
      startOnLoad: false,
      theme: 'dark',
      themeVariables: {
        background: '#0a0e27',
        primaryColor: '#0a0e27',
        primaryTextColor: '#e8f4ff',
        primaryBorderColor: '#00f0ff',
        lineColor: '#00f0ff',
        secondaryColor: '#1a0a2e',
        tertiaryColor: '#05060f',
      },
        securityLevel: 'strict',
    });
    blocks.forEach((el, i) => {
      const pre = el.tagName === 'PRE' ? (el as HTMLElement) : (el.parentElement as HTMLElement | null);
      if (!pre || pre.dataset.mermaidProcessed === '1') return;
      pre.dataset.mermaidProcessed = '1';
      const raw = pre.textContent || '';
      const wrap = document.createElement('div');
      wrap.className = 'mermaid-wrap';
      // Preserve slide-engine classes if pre was tagged
      if (pre.classList.contains('akq-slide-el')) wrap.classList.add('akq-slide-el');
      if (pre.classList.contains('akq-slide-hidden')) wrap.classList.add('akq-slide-hidden');
      if (pre.classList.contains('akq-slide-active')) wrap.classList.add('akq-slide-active');
      wrap.id = `mermaid-${Date.now()}-${i}`;
      wrap.textContent = raw;
      pre.replaceWith(wrap);
    });

    // Mermaid can't render inside display:none slides — temporarily
    // move hidden wraps offscreen, render, then restore.
    const allWraps = Array.from(document.querySelectorAll<HTMLElement>('.mermaid-wrap'));
    const restored: Array<{ el: HTMLElement; orig: string }> = [];
    const restoredHiddenAncestors = new Map<HTMLElement, { orig: string; hadHidden: boolean }>();
    allWraps.forEach((el) => {
      const cs = window.getComputedStyle(el);
      if (cs.display === 'none') {
        restored.push({ el, orig: el.getAttribute('style') || '' });
        el.setAttribute(
          'style',
          (el.getAttribute('style') || '') +
            ';display:block !important;position:absolute !important;left:-99999px !important;top:0 !important;width:1100px !important;'
        );
      }

      let parent = el.parentElement;
      while (parent && !parent.classList.contains('playbook-detail')) {
        if (parent.classList.contains('akq-slide-hidden') && !restoredHiddenAncestors.has(parent)) {
          restoredHiddenAncestors.set(parent, {
            orig: parent.getAttribute('style') || '',
            hadHidden: true,
          });
          parent.classList.remove('akq-slide-hidden');
          parent.setAttribute(
            'style',
            (parent.getAttribute('style') || '') +
              ';display:block !important;position:absolute !important;left:-99999px !important;top:0 !important;width:1100px !important;visibility:hidden !important;'
          );
        }
        parent = parent.parentElement;
      }
    });
    await new Promise((r) => setTimeout(r, 30));
    try { await mermaid.run({ querySelector: '.mermaid-wrap' }); } catch (e) { console.error('[mermaid.run]', e); }
    // Keep mermaid's intrinsic size so vertical diagrams stay readable; CSS handles scrolling.
    applyMermaidSizing();
    restored.forEach(({ el, orig }) => {
      if (orig) el.setAttribute('style', orig); else el.removeAttribute('style');
    });
    restoredHiddenAncestors.forEach(({ orig, hadHidden }, el) => {
      if (orig) el.setAttribute('style', orig); else el.removeAttribute('style');
      if (hadHidden) el.classList.add('akq-slide-hidden');
    });

  } catch (err) {
    console.error('[mermaid]', err);
  }
}

function applyMermaidSizing() {
  document.querySelectorAll<SVGSVGElement>('.mermaid-wrap svg').forEach((svg) => {
    svg.removeAttribute('width');
    svg.removeAttribute('height');
    svg.style.maxWidth = 'none';
    svg.style.height = 'auto';
  });
}

// Initial kick-off, after every binding above is initialized so present mode
// and Mermaid set up on the first paint. Running this earlier hit a temporal
// dead zone on mermaidRenderPromise, making present mode fail once and flash
// the article view before astro:page-load re-ran it.
initGlossaryInteractions();
