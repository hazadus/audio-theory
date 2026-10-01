import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import { unified } from '@astrojs/markdown-remark';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeMathErrors from './src/lib/rehype-math-errors.mjs';

export default defineConfig({
  output: 'static',
  integrations: [mdx()],
  markdown: {
    processor: unified({
      remarkPlugins: [remarkMath],
      rehypePlugins: [
        [rehypeKatex, { output: 'htmlAndMathml', strict: 'ignore', trust: false }],
        rehypeMathErrors,
      ],
    }),
  },
});
