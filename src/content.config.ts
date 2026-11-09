import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const playbook = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/playbook' }),
  schema: z.object({
    title: z.string(),
    titleEn: z.string().optional(),
    summary: z.string(),
    icon: z.string().default('▶'),
    color: z.enum(['magenta', 'cyan', 'amber', 'green']).default('cyan'),
    accent: z.object({
      text: z.string(),
      border: z.string(),
      glow: z.string(),
      shadow: z.string(),
      hex: z.string(),
    }).optional(),
    related: z.array(z.string()).default([]),
    links: z.array(z.object({
      label: z.string(),
      url: z.url(),
      group: z.string().optional(),
    })).default([]),
    order: z.number().default(0),
    category: z.enum([
      'introduction', 'plan', 'develop', 'review', 'secure', 'operate', 'administration',
    ]).default('introduction'),
  }),
});

export const collections = { playbook };
