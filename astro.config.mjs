import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import { unified } from '@astrojs/markdown-remark';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import remarkHeadingAnchors from './src/lib/remark-heading-anchors.mjs';
import rehypeHeadingLinks from './src/lib/rehype-heading-links.mjs';
import rehypeCodeBlocks from './src/lib/rehype-code-blocks.mjs';
import rehypeMathErrors from './src/lib/rehype-math-errors.mjs';
import rehypeSiteUrls from './src/lib/rehype-site-urls.mjs';
import { siteConfig } from './src/site.config.ts';
import buildArtifact from './scripts/build-artifact.mjs';

let resolvedBase = siteConfig.base;

export default defineConfig({
  output: 'static',
  site: siteConfig.site,
  base: siteConfig.base,
  trailingSlash: 'always',
  integrations: [
    buildArtifact(),
    {
      name: 'site-urls',
      hooks: {
        'astro:config:done': ({ config }) => {
          resolvedBase = config.base;
        },
      },
    },
    mdx(),
  ],
  markdown: {
    // Цвета токенов задаются переменными `--astro-code-*` (src/styles/code.css), а не конкретной темой Shiki.
    shikiConfig: { theme: 'css-variables' },
    processor: unified({
      remarkPlugins: [remarkMath, remarkHeadingAnchors],
      rehypePlugins: [
        [rehypeKatex, { output: 'htmlAndMathml', strict: 'ignore', trust: false }],
        rehypeMathErrors,
        rehypeCodeBlocks,
        rehypeHeadingLinks,
        [rehypeSiteUrls, { getBase: () => resolvedBase }],
      ],
    }),
  },
});
