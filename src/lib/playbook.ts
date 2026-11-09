import { getCollection } from 'astro:content';

export async function getPlaybookEntries() {
  const entries = await getCollection('playbook', ({ id }) => id.startsWith('ja/'));
  return entries
    .map((entry) => ({ entry, slug: entry.id.slice(3) }))
    .sort((a, b) => a.entry.data.order - b.entry.data.order || a.slug.localeCompare(b.slug));
}
