import type { APIContext, GetStaticPaths } from 'astro';
import { getCollection } from 'astro:content';
import { vaults } from '../../lib/zettelkasten/vaults';
import { localizeVaultNotes } from '../../vendor/zettelkasten/localize.js';
import { serializeFrontmatter } from '../../vendor/zettelkasten/parser.js';

export const prerender = true;

export const getStaticPaths = (async () => {
  const entries = await getCollection('zettelkasten');
  const rawNotes = entries.map(({ id, data, body }) =>
    [id, serializeFrontmatter(data, body ?? '')] as const);
  const translations = Object.fromEntries(rawNotes
    .filter(([id]) => id.startsWith('ja/'))
    .map(([id, raw]) => [id.slice(3), raw]));

  return vaults.map(({ id }) => {
    const seedNotes = Object.fromEntries(rawNotes
      .filter(([path]) => path.startsWith(`${id}/`))
      .map(([path, raw]) => [path.slice(id.length + 1), raw]));
    if (!Object.keys(seedNotes).length) throw new Error(`ノート集が空です: ${id}`);
    return {
      params: { vault: id },
      props: { notes: localizeVaultNotes(id, seedNotes, translations) },
    };
  });
}) satisfies GetStaticPaths;

export function GET({ props }: APIContext<{ notes: Record<string, string> }>) {
  return new Response(JSON.stringify(props.notes), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}
