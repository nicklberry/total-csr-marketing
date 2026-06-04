import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const glossary = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/glossary' }),
  schema: z.object({
    title:        z.string(),
    date:         z.string(),
    lastModified: z.string().optional(),
  }),
});

const blog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/blog' }),
  schema: z.object({
    title:        z.string(),
    date:         z.string(),
    lastModified: z.string().optional(),
    author:       z.string().optional(),
    excerpt:      z.string().optional(),
    categories:   z.array(z.string()).optional(),
  }),
});

export const collections = { glossary, blog };
