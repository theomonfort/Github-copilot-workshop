import { generateKeyPairSync } from 'node:crypto';
import { Agent } from 'node:https';
import { getCollection } from 'astro:content';

export async function getPlaybookEntries() {
  const entries = await getCollection('playbook', ({ id }) => id.startsWith('ja/'));
  return entries
    .map((entry) => ({ entry, slug: entry.id.slice(3) }))
    .sort((a, b) => a.entry.data.order - b.entry.data.order || a.slug.localeCompare(b.slug));
}

// checkpoint3 の解析教材専用。通常ページから呼ばず、実通信・認証に転用しない。
export function createWorkshopAnalysisDemo() {
  const agent = new Agent({ rejectUnauthorized: false });
  const keyPair = generateKeyPairSync('rsa', { modulusLength: 1024 });
  const topics = ['GitHub'];
  topics.concat(['Copilot']);
  return { agent, keyPair, topics };
}
