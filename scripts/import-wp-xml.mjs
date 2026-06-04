#!/usr/bin/env node
/**
 * WordPress WXR → Astro content collection importer
 *
 * Usage:
 *   node scripts/import-wp-xml.mjs path/to/export.xml [path/to/another-export.xml]
 *   node scripts/import-wp-xml.mjs --dry-run tmp/wp-exports/glossary-export.xml tmp/wp-exports/post-export.xml
 *
 * Reads one or more WordPress export files and writes individual .md files into:
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
// CLI helpers
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const wantsHelp = args.includes('--help') || args.includes('-h');
const usage = 'Usage: node scripts/import-wp-xml.mjs [--dry-run] path/to/export.xml [path/to/another-export.xml]';
const xmlPaths = args.filter(arg => arg !== '--dry-run' && arg !== '--help' && arg !== '-h');

if (wantsHelp) {
  console.log(usage);
  process.exit(0);
}

if (xmlPaths.length === 0) {
  console.error(usage);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// XML helpers
// ---------------------------------------------------------------------------

function extractCDATA(raw) {
  if (!raw) return '';
  const m = raw.match(/<!\[CDATA\[([\s\S]*?)\]\]>/);
  return decodeEntities(m ? m[1].trim() : raw.trim());
}

function decodeEntities(value) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, code) => String.fromCharCode(parseInt(code, 16)));
}

function getTag(xml, tag) {
  const m = xml.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`));
  return m ? extractCDATA(m[1]) : '';
}

function getCategories(raw) {
  const categories = [];
  const catRe = /<category\s+[^>]*domain="category"[^>]*>([\s\S]*?)<\/category>/g;
  let cm;
  while ((cm = catRe.exec(raw)) !== null) {
    const category = extractCDATA(cm[1]);
    if (category && !categories.includes(category)) categories.push(category);
  }
  return categories;
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

function yamlString(value) {
  return JSON.stringify(String(value));
}

function toFrontmatter(obj) {
  const lines = ['---'];
  for (const [key, val] of Object.entries(obj)) {
    if (val === null || val === undefined || val === '') continue;
    if (Array.isArray(val)) {
      if (val.length === 0) continue;
      lines.push(`${key}:`);
      for (const v of val) lines.push(`  - ${yamlString(v)}`);
    } else {
      lines.push(`${key}: ${yamlString(val)}`);
    }
  }
  lines.push('---');
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Parse items from WXR
// ---------------------------------------------------------------------------

function parseItems(xml, sourcePath) {
  const items = [];
  const skipped = [];
  const re = /<item>([\s\S]*?)<\/item>/g;
  let m;

  while ((m = re.exec(xml)) !== null) {
    const raw = m[1];

    const postType = getTag(raw, 'wp:post_type');
    const status = getTag(raw, 'wp:status');
    if (status !== 'publish') continue;

    const title = getTag(raw, 'title');
    const slug = getTag(raw, 'wp:post_name');
    const date = getTag(raw, 'wp:post_date').split(' ')[0]; // YYYY-MM-DD
    const modified = getTag(raw, 'wp:post_modified').split(' ')[0];
    const author = getTag(raw, 'dc:creator');
    const rawContent = getTag(raw, 'content:encoded');
    const rawExcerpt = getTag(raw, 'excerpt:encoded');
    const categories = getCategories(raw);

    const content = cleanHtml(rawContent);
    const excerpt = cleanHtml(rawExcerpt);

    if (!slug || !content) {
      skipped.push({ title: title || '(untitled)', postType, reason: !slug ? 'missing slug' : 'missing content' });
      continue;
    }

    items.push({ postType, title, slug, date, modified, author, content, excerpt, categories, sourcePath });
  }

  return { items, skipped };
}

function writeContent(items, postType, dirName, frontmatterForItem) {
  const dir = join(ROOT, 'src/content', dirName);
  const matchingItems = items.filter(i => i.postType === postType);

  if (matchingItems.length === 0) return 0;
  if (!dryRun) mkdirSync(dir, { recursive: true });

  for (const item of matchingItems) {
    const fm = toFrontmatter(frontmatterForItem(item));
    const outputPath = join(dir, `${item.slug}.md`);
    if (!dryRun) writeFileSync(outputPath, `${fm}\n\n${item.content}\n`, 'utf-8');
  }

  return matchingItems.length;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const allItems = [];
const allSkipped = [];

for (const xmlPath of xmlPaths) {
  console.log(`Reading ${xmlPath} …`);
  const xml = readFileSync(xmlPath, 'utf-8');

  console.log('Parsing items …');
  const { items, skipped } = parseItems(xml, xmlPath);
  allItems.push(...items);
  allSkipped.push(...skipped.map(item => ({ ...item, sourcePath: xmlPath })));
}

const glossaryCount = writeContent(allItems, 'glossary', 'glossary', item => ({
  title: item.title,
  date: item.date,
  lastModified: item.modified !== item.date ? item.modified : undefined,
}));

const blogCount = writeContent(allItems, 'post', 'blog', item => ({
  title: item.title,
  date: item.date,
  lastModified: item.modified !== item.date ? item.modified : undefined,
  author: item.author || undefined,
  excerpt: item.excerpt || undefined,
  categories: item.categories.length ? item.categories : undefined,
}));

const mode = dryRun ? 'Would write' : 'Wrote';
console.log(`${mode}: ${glossaryCount} glossary entries → src/content/glossary/`);
console.log(`${mode}: ${blogCount} blog posts → src/content/blog/`);

if (allSkipped.length > 0) {
  console.log(`Skipped ${allSkipped.length} published item(s):`);
  for (const item of allSkipped) {
    console.log(`- ${item.title} (${item.postType || 'unknown'}): ${item.reason} [${item.sourcePath}]`);
  }
}

console.log('Done.');
