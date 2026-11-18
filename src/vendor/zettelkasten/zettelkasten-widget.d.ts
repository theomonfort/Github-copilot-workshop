export interface ZettelkastenVault {
  id: string;
  label: string;
  title: string;
  accent: string;
  retroAccent: string;
  loadSeedNotes: () => Promise<{ default: Record<string, string> }>;
  apiBaseUrl: null;
  storageKey: string;
  initialNote: string;
  persistLocalStorage: false;
}

export interface ZettelkastenWidget {
  openVaultAndNote: (
    vaultId: string,
    note: string,
    options?: { pinGraph?: boolean; focusGraph?: boolean },
  ) => Promise<void>;
  hasOpenPopup: () => boolean;
  dismissPopup: () => boolean;
  fitView: () => void;
  destroy: () => void;
}

export function mountZettelkasten(
  container: HTMLElement,
  options: {
    locale: 'ja';
    vaults: ZettelkastenVault[];
    initialVault: string;
    readOnly: true;
    apiBaseUrl: null;
    persistLocalStorage: false;
    pinInitialNote: boolean;
    colorByGroup: boolean;
    onActiveChange: (note: { vaultLabel: string; vaultAccent?: string; title: string }) => void;
  },
): Promise<ZettelkastenWidget>;
