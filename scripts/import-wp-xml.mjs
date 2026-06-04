#!/usr/bin/env node
/**
 * WordPress WXR → Astro content collection importer
 *
 * Usage:
 *   node scripts/import-wp-xml.mjs path/to/export.xml
 *
 * Reads a WordPress export file and writes individual .md files into:
 *   src/content/glossary/   (wp:post_type = glossary)
 *   src/content/blog/       (wp:post_type = post)
 *
 * Only published items are imported. Elementor/Word noise attributes
 * are stripped from the HTML content.
 *
 * Run this locally — the generated .md files are what gets committed.
 * You do NOT commit the source XML.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// ---------------------------------------------------------------------------
// XML helpers
// ---------------------------------------------------------------------------

function extractCDATA(raw) {
  if (!raw) return '';
  const m = raw.match(/<!\[CDATA\[([\s\S]*?)\]\]>/);
  return m ? m[1].trim() : raw.trim();
}

function getTag(xml, tag) {
  const m = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`));
  return m ? extractCDATA(m[1]) : '';
}

// ---------------------------------------------------------------------------
// HTML cleaner — strips Elementor/Word noise attributes
// ---------------------------------------------------------------------------

function cleanHtml(html) {
  return html
    .replace(/\s+data-ccp-[a-z-]+=(?:"[^"]*"|'[^']*')/g, '')
    .replace(/\s+data-contrast=(?:"[^"]*"|'[^']*')/g, '')
    .replace(/\s+data-leveltext=(?:"[^"]*"|'[^']*')/g, '')
    .replace(/\s+data-font=(?:"[^"]*"|'[^']*')/g, '')
    .replace(/\s+data-listid=(?:"[^"]*"|'[^']*')/g, '')
    .replace(/\s+data-list-defn-props=(?:"[^"]*"|'[^']*')/g, '')
    .replace(/\s+data-aria-posinset=(?:"[^"]*"|'[^']*')/g, '')
    .replace(/\s+data-aria-level=(?:"[^"]*"|'[^']*')/g, '')
    .replace(/\s+aria-setsize=(?:"[^"]*"|'[^']*')/g, '')
    .replace(/\s+aria-rowcount=(?:"[^"]*"|'[^']*')/g, '')
    .replace(/\s+aria-rowindex=(?:"[^"]*"|'[^']*')/g, '')
    .replace(/\s+data-celllook=(?:"[^"]*"|'[^']*')/g, '')
    .replace(/\s+data-tablestyle=(?:"[^"]*"|'[^']*')/g, '')
    .replace(/\s+data-tablelook=(?:"[^"]*"|'[^']*')/g, '')
    // Remove whitespace-only noise spans left behind
    .replace(/<span(\s[^>]*)?>(\s|&nbsp;)<\/span>/g, '')
    // Collapse 3+ blank lines
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ---------------------------------------------------------------------------
// YAML frontmatter serialiser (no dependencies)
// ---------------------------------------------------------------------------

function toFrontmatter(obj) {
  const lines = ['---'];
  for (const [key, val] of Object.entries(obj)) {
    if (val === null || val === undefined || val === '') continue;
    if (Array.isArray(val)) {
      if (val.length === 0) continue;
      lines.push(`${key}:`);
      for (const v of val) lines.push(`  - "${String(v).replace(/"/g, '\\"')}"`);
    } else {
      lines.push(`${key}: "${String(val).replace(/"/g, '\\"')}"`);
    }
  }
  lines.push('---');
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Parse items from WXR
// ---------------------------------------------------------------------------

function parseItems(xml) {
  const items = [];
  const re = /<item>([\s\S]*?)<\/item>/g;
  let m;

  while ((m = re.exec(xml)) !== null) {
    const raw = m[1];

    const postType = getTag(raw, 'wp:post_type');
    const status   = getTag(raw, 'wp:status');
    if (status !== 'publish') continue;

    const title      = getTag(raw, 'title');
    const slug       = getTag(raw, 'wp:post_name');
    const date       = getTag(raw, 'wp:post_date').split(' ')[0]; // YYYY-MM-DD
    const modified   = getTag(raw, 'wp:post_modified').split(' ')[0];
    const author     = getTag(raw, 'dc:creator');
    const rawContent = getTag(raw, 'content:encoded');
    const rawExcerpt = getTag(raw, 'excerpt:encoded');

    const categories = [];
    const catRe = /<category domain="category"[^>]*><!\[CDATA\[([\s\S]*?)\]\]><\/category>/g;
    let cm;
    while ((cm = catRe.exec(raw)) !== null) categories.push(cm[1]);

    const content = cleanHtml(rawContent);
    const excerpt = cleanHtml(rawExcerpt);

    if (!slug || !content) continue;

    items.push({ postType, title, slug, date, modified, author, content, excerpt, categories });
  }

  return items;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const xmlPath = process.argv[2];
if (!xmlPath) {
  console.error('Usage: node scripts/import-wp-xml.mjs path/to/export.xml');
  process.exit(1);
}

console.log(`Reading ${xmlPath} …`);
const xml = readFileSync(xmlPath, 'utf-8');

console.log('Parsing items …');
const items = parseItems(xml);

const glossaryItems = items.filter(i => i.postType === 'glossary');
const blogItems     = items.filter(i => i.postType === 'post');

console.log(`Found: ${glossaryItems.length} glossary entries, ${blogItems.length} blog posts`);

if (glossaryItems.length > 0) {
  const dir = join(ROOT, 'src/content/glossary');
  mkdirSync(dir, { recursive: true });
  let count = 0;
  for (const item of glossaryItems) {
    const fm = toFrontmatter({ title: item.title, date: item.date, lastModified: item.modified });
    writeFileSync(join(dir, `${item.slug}.md`), `${fm}\n\n${item.content}\n`, 'utf-8');
    count++;
  }
  console.log(`✓ Wrote ${count} glossary entries → src/content/glossary/`);
}

if (blogItems.length > 0) {
  const dir = join(ROOT, 'src/content/blog');
  mkdirSync(dir, { recursive: true });
  let count = 0;
  for (const item of blogItems) {
    const fm = toFrontmatter({
      title:      item.title,
      date:       item.date,
      lastModified: item.modified !== item.date ? item.modified : undefined,
      author:     item.author || undefined,
      excerpt:    item.excerpt || undefined,
      categories: item.categories.length ? item.categories : undefined,
    });
    writeFileSync(join(dir, `${item.slug}.md`), `${fm}\n\n${item.content}\n`, 'utf-8');
    count++;
  }
  console.log(`✓ Wrote ${count} blog posts → src/content/blog/`);
}

console.log('Done.');
