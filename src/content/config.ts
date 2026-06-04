import { defineCollection, z } from 'astro:content';

const glossary = defineCollection({
  type: 'content',
  schema: z.object({
    title:        z.string(),
    date:         z.string(),
    lastModified: z.string().optional(),
  }),
});

const blog = defineCollection({
  type: 'content',
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
