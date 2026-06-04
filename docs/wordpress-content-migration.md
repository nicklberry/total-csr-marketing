# WordPress blog and glossary migration

This site already has the structure needed to move WordPress content into Astro content collections:

- Blog posts render from `src/content/blog/*.md` at `/insurance-agency-blog/[slug]/`.
- Glossary entries render from `src/content/glossary/*.md` at `/insurance-glossary/[slug]/`.
- The importer converts WordPress WXR XML exports into those Markdown files.

## What to export from WordPress

Export the two WordPress WXR files separately:

1. **Glossary export**: WordPress custom post type `glossary`.
2. **Blog export**: WordPress post type `post`.

Only published items are imported. Drafts, revisions, attachments, and other post types are ignored.

## Local migration workflow

1. Download the XML files into an untracked temporary folder:

   ```bash
   mkdir -p tmp/wp-exports
   # Save the files as:
   # tmp/wp-exports/glossary-export.xml
   # tmp/wp-exports/post-export.xml
   ```

2. Preview the import before writing files:

   ```bash
   npm run import:wp -- --dry-run tmp/wp-exports/glossary-export.xml tmp/wp-exports/post-export.xml
   ```

3. Generate the Astro content files:

   ```bash
   npm run import:wp -- tmp/wp-exports/glossary-export.xml tmp/wp-exports/post-export.xml
   ```

4. Review generated Markdown frontmatter and body HTML in:

   ```text
   src/content/blog/
   src/content/glossary/
   ```

5. Run the site build:

   ```bash
   npm run build
   ```

6. Commit the generated Markdown files, but do **not** commit the source XML files. The `tmp/` folder is ignored.

## URL mapping

The importer keeps the WordPress slug from `wp:post_name`, so URLs become:

- WordPress blog post slug `example-post` → `/insurance-agency-blog/example-post/`
- WordPress glossary slug `actual-cash-value` → `/insurance-glossary/actual-cash-value/`

Before launch, compare these against the current WordPress URLs and add redirects for any URL whose path changes. If the old WordPress blog path was `/example-post/` or `/blog/example-post/`, redirect it to `/insurance-agency-blog/example-post/`. If the old glossary path was `/glossary/actual-cash-value/`, redirect it to `/insurance-glossary/actual-cash-value/`.

## Post-import QA checklist

- Confirm the dry run reports the expected number of blog posts and glossary items.
- Spot-check titles, dates, author names, excerpts, and categories in generated frontmatter.
- Spot-check rich content: tables, ordered lists, unordered lists, links, and embedded images.
- Find any links still pointing at WordPress paths and decide whether to update them in content or cover them with redirects.
- Check images referenced in imported HTML. The importer preserves image URLs; if WordPress media will be shut down, download those assets into `public/` and update the image `src` paths.
- Run `npm run build` and resolve any content schema or rendering errors before deploying.

## Notes about the importer

The importer is intentionally dependency-free and preserves body content as cleaned HTML inside Markdown files. It removes common Elementor/Microsoft Word noise attributes while leaving semantic HTML such as paragraphs, headings, lists, tables, links, and images intact.
