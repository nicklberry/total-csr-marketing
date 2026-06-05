#!/usr/bin/env node
/**
 * WordPress image importer
 *
 * Usage:
 *   node scripts/import-wp-images.mjs tmp/wp-exports/totalcsr-wordpress-posts.xml
 *   node scripts/import-wp-images.mjs tmp/wp-exports/totalcsr-wordpress-glossary.xml
 *
 * What it does:
 *   1. Scans all .md files in src/content/blog/ and src/content/glossary/
 *      for image URLs pointing to wp-content/uploads or the old domain
 *   2. Also pulls attachment URLs directly from the XML (<wp:post_type>attachment</wp:post_type>)
 *   3. Downloads each unique image to public/images/blog/ or public/images/glossary/
 *   4. Rewrites the URLs in the .md files to the new local path
 *
 * Run AFTER import-wp-xml.mjs so the .md files already exist.
 * Safe to re-run — skips images that are already downloaded.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname, basename, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { get as httpGet } from 'node:http';
import { get as httpsGet } from 'node:https';
import { createWriteStream } from 'node:fs';
import { readdirSync } from 'node:fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT      = join(__dirname, '..');

// ── Config ──────────────────────────────────────────────────────────────────

const OLD_DOMAIN   = 'https://totalcsr.com';
const OLD_DOMAIN_2 = 'http://totalcsr.com';
const WP_UPLOADS   = '/wp-content/uploads/';

// ── Helpers ──────────────────────────────────────────────────────────────────

function extractCDATA(raw) {
  if (!raw) return '';
  const m = raw.match(/<!\[CDATA\[([\s\S]*?)\]\]>/);
  return m ? m[1].trim() : raw.trim();
}

function download(url, destPath) {
  return new Promise((resolve, reject) => {
    const get = url.startsWith('https') ? httpsGet : httpGet;
    const file = createWriteStream(destPath);
    get(url, res => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        file.close();
        download(res.headers.location, destPath).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode !== 200) {
        file.close();
        reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        return;
      }
      res.pipe(file);
      file.on('finish', () => file.close(resolve));
    }).on('error', err => {
      file.close();
      reject(err);
    });
  });
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// Collect all image URLs from a block of HTML/markdown content
function findImageUrls(content) {
  const urls = new Set();
  // <img src="...">
  const imgRe = /<img[^>]+src=["']([^"']+)["']/gi;
  let m;
  while ((m = imgRe.exec(content)) !== null) urls.add(m[1]);
  // WordPress srcset
  const srcsetRe = /srcset=["']([^"']+)["']/gi;
  while ((m = srcsetRe.exec(content)) !== null) {
    m[1].split(',').forEach(part => {
      const u = part.trim().split(/\s+/)[0];
      if (u) urls.add(u);
    });
  }
  // Bare URL references in markdown/html
  const bareRe = /https?:\/\/[^\s"'<>)]+\.(?:jpg|jpeg|png|gif|webp|svg|avif)/gi;
  while ((m = bareRe.exec(content)) !== null) urls.add(m[0]);
  return [...urls].filter(u =>
    u.includes('wp-content/uploads') ||
    u.includes('totalcsr.com')
  );
}

// Derive a clean local filename from a URL, deduplicating if needed
const usedFilenames = new Map(); // original url -> local filename

function localFilename(url) {
  if (usedFilenames.has(url)) return usedFilenames.get(url);
  let name = basename(url.split('?')[0]);
  // Strip WordPress size suffixes like -800x600
  name = name.replace(/-\d+x\d+(\.[a-z]+)$/i, '$1');
  if (!extname(name)) name += '.jpg';
  usedFilenames.set(url, name);
  return name;
}

// Canonical URL — strip size variants so we download the original once
function canonicalUrl(url) {
  return url.replace(/-\d+x\d+(\.[a-z]+)$/i, '$1');
}

// ── Parse attachment URLs from XML ───────────────────────────────────────────

function parseAttachmentUrls(xml) {
  const urls = new Set();
  const re = /<item>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = re.exec(xml)) !== null) {
    const item = m[1];
    const type = extractCDATA(item.match(/<wp:post_type>([\s\S]*?)<\/wp:post_type>/)?.[1] || '');
    if (type !== 'attachment') continue;
    const status = extractCDATA(item.match(/<wp:status>([\s\S]*?)<\/wp:status>/)?.[1] || '');
    if (status === 'trash') continue;
    // attachment_url postmeta
    const attUrlMatch = item.match(/<wp:attachment_url><!\[CDATA\[([\s\S]*?)\]\]><\/wp:attachment_url>/);
    if (attUrlMatch) urls.add(attUrlMatch[1].trim());
    // guid as fallback
    const guidMatch = item.match(/<guid[^>]*><!\[CDATA\[([\s\S]*?)\]\]><\/guid>/);
    if (guidMatch && guidMatch[1].includes('wp-content/uploads')) {
      urls.add(guidMatch[1].trim());
    }
  }
  return [...urls];
}

// ── Main ─────────────────────────────────────────────────────────────────────

const xmlPath = process.argv[2];
if (!xmlPath) {
  console.error('Usage: node scripts/import-wp-images.mjs path/to/export.xml');
  process.exit(1);
}

console.log(`Reading ${xmlPath} …`);
const xml = readFileSync(xmlPath, 'utf-8');

// Collect image URLs from attachment items
const attachmentUrls = parseAttachmentUrls(xml);
console.log(`Found ${attachmentUrls.length} attachment URLs in XML`);

// Collect image URLs from generated .md files
const mdDirs = [
  join(ROOT, 'src/content/blog'),
  join(ROOT, 'src/content/glossary'),
];

const mdFiles = [];
for (const dir of mdDirs) {
  if (!existsSync(dir)) continue;
  readdirSync(dir)
    .filter(f => f.endsWith('.md'))
    .forEach(f => mdFiles.push(join(dir, f)));
}

console.log(`Scanning ${mdFiles.length} markdown files for image URLs …`);

const mdImageUrls = new Set();
for (const f of mdFiles) {
  findImageUrls(readFileSync(f, 'utf-8')).forEach(u => mdImageUrls.add(u));
}

console.log(`Found ${mdImageUrls.size} image URLs in markdown files`);

// Merge all URLs, canonicalise, deduplicate
const allUrls = new Set([...attachmentUrls, ...mdImageUrls].map(canonicalUrl));
console.log(`Total unique images to download: ${allUrls.size}`);

// Public image directories
const blogImgDir     = join(ROOT, 'public/images/blog');
const glossaryImgDir = join(ROOT, 'public/images/glossary');
mkdirSync(blogImgDir,     { recursive: true });
mkdirSync(glossaryImgDir, { recursive: true });

// Download
let downloaded = 0, skipped = 0, failed = 0;
const urlToLocal = new Map(); // url -> /images/blog/filename.jpg  (public path)

for (const url of allUrls) {
  const name   = localFilename(url);
  // Most images go to blog; glossary has few/none — just use blog for both
  const dest   = join(blogImgDir, name);
  const pubPath = `/images/blog/${name}`;
  urlToLocal.set(url, pubPath);

  if (existsSync(dest)) {
    skipped++;
    continue;
  }

  try {
    await download(url, dest);
    downloaded++;
    if (downloaded % 20 === 0) console.log(`  … ${downloaded} downloaded`);
    await sleep(80); // be polite
  } catch (err) {
    console.warn(`  SKIP ${url} — ${err.message}`);
    failed++;
    if (existsSync(dest)) {
      try { require('fs').unlinkSync(dest); } catch {}
    }
  }
}

console.log(`Download complete: ${downloaded} new, ${skipped} already existed, ${failed} failed`);

// ── Rewrite URLs in .md files ────────────────────────────────────────────────

console.log('Rewriting image URLs in markdown files …');
let rewritten = 0;

for (const f of mdFiles) {
  let content = readFileSync(f, 'utf-8');
  let changed = false;

  for (const [origUrl, localPath] of urlToLocal) {
    // Match canonical URL and all size variants
    const base   = origUrl.replace(/\.[a-z]+$/i, '');
    const ext    = (origUrl.match(/\.[a-z]+$/i) || ['.jpg'])[0];
    const sizeRe = new RegExp(base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?:-\\d+x\\d+)?' + ext.replace('.', '\\.'), 'gi');
    const updated = content.replace(sizeRe, localPath);
    if (updated !== content) { content = updated; changed = true; }
  }

  if (changed) {
    writeFileSync(f, content, 'utf-8');
    rewritten++;
  }
}

console.log(`Rewrote image URLs in ${rewritten} markdown files`);
console.log('Done. Commit public/images/ and src/content/ together.');
