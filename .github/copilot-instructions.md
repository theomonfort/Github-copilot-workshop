# Copilot Instructions

## Language

- Write all responses, comments, commit messages, and PR descriptions in **English**.

## Stack

- **Astro** only. Do not use Next.js, React Router, or SvelteKit.
- Use Astro components (.astro) for pages and layouts.
- Use Astro **content collections** (`src/content/`) for Markdown content.
- Style with Tailwind CSS. Add scoped <style> blocks when needed.
- Use TypeScript everywhere (.ts files and .astro frontmatter).
- Use Mermaid for diagrams when content contains ` ```mermaid ` blocks.

## Conventions

- Pages live in src/pages/.
- Reusable UI lives in src/components/.
- Content lives in `src/content/`.
- Playbook content exists in three shapes:
  - `src/content/playbook/*.md` — flat Japanese compatibility copy for the workshop starter.
  - `src/content/playbook/ja/*.md` — latest Japanese playbook.
  - `src/content/playbook/en/*.md` — latest English playbook.
- Playbook category metadata lives in `src/lib/playbook-categories.ts`. Use it for category order, labels, icons, actor names, avatars, descriptions, and category colors.
- Content schemas are defined in `src/content.config.ts`.
- The package manager is **pnpm**. Use `pnpm install`, `pnpm dev`, and `pnpm build`.
- Public assets are referenced with the `/theomonfort/` base path, for example `/theomonfort/icons/copilot-chat.png`.
- Each Playbook Markdown file includes an `accent` object with exact Tailwind classes (`text`, `border`, `glow`, `shadow`) and `hex`. Use those values directly when styling playbook cards/details.

## Workshop goal

- In the Copilot Chat section, start by building the **playbook landing page** rather than presentation mode.
- The landing page should read playbook Markdown, render a card grid, and use `src/lib/playbook-categories.ts` plus category visuals from `public/planet-*.webp` and icons from `public/icons/`.
- Keep the implementation simple first: index page, cards, links to detail pages. Add presentation mode only in later steps.
- Use the supplied assets in `public/` instead of inventing remote URLs.
- Scope this starter to the Playbook landing page and Playbook detail pages only.

## Code review

- Run a **self-review** before submitting changes; align with existing files' conventions, naming, and templates.
- PR descriptions must always cover **what / why / how to verify** (the three points).
- For breaking changes (frontmatter schema, routing, build config), explicitly document the reasoning and impact.
- Split large changes into smaller PRs to reduce review load.
- Run `pnpm build` before considering the implementation complete.

## Documentation lookups (must follow)

Before writing any **Astro** code, you **must call the following Context7 MCP tools first**:

1. Resolve the library ID with `resolve-library-id`.
2. Fetch the latest docs with `get-library-docs`.
3. Implement based on the docs you just fetched.

**Prohibited**:
- Do not skip Context7 just because you think you "already know it." Always check the docs, even for familiar technologies.