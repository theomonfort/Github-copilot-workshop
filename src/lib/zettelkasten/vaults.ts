import type { ZettelkastenVault } from '../../vendor/zettelkasten/zettelkasten-widget';

export const vaults = [
  { id: 'introduction', label: 'はじめに', accent: '#00f0ff' },
  { id: 'plan', label: '計画', accent: '#9bbc0f' },
  { id: 'develop', label: '開発', accent: '#ff2e88' },
  { id: 'review', label: 'レビュー', accent: '#ffb000' },
  { id: 'security', label: 'テストとセキュリティ', accent: '#38bdf8' },
  { id: 'administration', label: '管理', accent: '#bd93f9' },
  { id: 'extended', label: '全体マップ', accent: '#00f0ff' },
] as const;

export type ZettelkastenVaultId = typeof vaults[number]['id'];

function isNoteMap(value: unknown): value is Record<string, string> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && Object.values(value).every((note) => typeof note === 'string');
}

export function getZettelkastenVaults(signal: AbortSignal): ZettelkastenVault[] {
  return vaults.map(({ id, label, accent }) => ({
    id,
    label,
    title: label,
    accent,
    retroAccent: accent,
    apiBaseUrl: null,
    persistLocalStorage: false,
    storageKey: `workshop:zettelkasten:${id}`,
    initialNote: 'github',
    loadSeedNotes: async () => {
      const response = await fetch(`/zettelkasten/${id}.json`, { signal });
      if (!response.ok) throw new Error(`ノート集の取得に失敗しました: ${id} (${response.status})`);
      const notes: unknown = await response.json();
      if (!isNoteMap(notes) || !Object.keys(notes).length) {
        throw new Error(`ノート集の形式が不正です: ${id}`);
      }
      return { default: notes };
    },
  }));
}
