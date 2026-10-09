// Проверяет токены: пары light-dark() для всех цветов и пороги контраста дизайн-системы в обеих темах.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('../../src/styles/tokens.css', import.meta.url), 'utf8');

type Theme = 'light' | 'dark';
const tokens = new Map<string, Record<Theme, string>>();
for (const [, name, value] of css.matchAll(/^ {2}(--[\w-]+): ([^;]+);$/gm)) {
  const pair = value.match(/^light-dark\((oklch\([^)]+\)), (oklch\([^)]+\))\)$/);
  if (pair) tokens.set(name, { light: pair[1], dark: pair[2] });
  else if (/^oklch\(/.test(value)) tokens.set(name, { light: value, dark: value });
  else {
    const alias = value.match(/^var\((--[\w-]+)\)$/);
    if (alias) tokens.set(name, { light: `alias:${alias[1]}`, dark: `alias:${alias[1]}` });
  }
}

function resolve(name: string, theme: Theme): string {
  const value = tokens.get(name)![theme];
  return value.startsWith('alias:') ? resolve(value.slice(6), theme) : value;
}

function toLinear(color: string): [number, number, number] {
  const [l, c, h] = color
    .match(/oklch\(([^)/]+)/)![1]
    .trim()
    .split(/\s+/)
    .map((part) => parseFloat(part));
  const a = c * Math.cos((h * Math.PI) / 180);
  const b = c * Math.sin((h * Math.PI) / 180);
  const L = l / 100;
  const l_ = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m_ = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const rgb = [
    4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
    -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
    -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
  ];
  return rgb.map((v) => Math.min(1, Math.max(0, v))) as [number, number, number];
}

function contrast(fg: string, bg: string, theme: Theme): number {
  const luminance = (name: string) => {
    const [r, g, b] = toLinear(resolve(name, theme));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const [hi, lo] = [luminance(fg), luminance(bg)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const text: [string, string][] = [
  ['--color-text', '--color-bg'],
  ['--color-text', '--color-surface'],
  ['--color-text', '--color-surface-raised'],
  ['--color-text-muted', '--color-bg'],
  ['--color-text-muted', '--color-surface'],
  ['--color-text-inverse', '--color-text'],
  ['--color-link', '--color-bg'],
  ['--color-link', '--color-surface'],
  ['--color-link-visited', '--color-bg'],
  ['--color-link-external', '--color-bg'],
  ['--color-link', '--color-accent-soft'],
  ['--color-on-accent', '--color-accent'],
  ['--color-on-accent', '--color-accent-hover'],
  ['--color-text', '--color-selection-bg'],
  ['--color-text', '--color-mark-bg'],
  ['--color-info', '--color-info-bg'],
  ['--color-warning', '--color-warning-bg'],
  ['--color-success', '--color-success-bg'],
  ['--color-error', '--color-error-bg'],
  ['--color-info', '--color-surface'],
  ['--color-warning', '--color-surface'],
  ['--color-success', '--color-surface'],
  ['--color-error', '--color-surface'],
  ['--color-code-text', '--color-code-bg'],
  ['--syntax-keyword', '--color-code-bg'],
  ['--syntax-string', '--color-code-bg'],
  ['--syntax-number', '--color-code-bg'],
  ['--syntax-function', '--color-code-bg'],
  ['--syntax-comment', '--color-code-bg'],
  ['--syntax-punctuation', '--color-code-bg'],
  ['--color-math', '--color-bg'],
  ['--chart-label', '--chart-bg'],
];

const graphics: [string, string][] = [
  ['--color-focus', '--color-bg'],
  ['--color-focus', '--color-surface'],
  ['--color-border-strong', '--color-bg'],
  ['--color-border-strong', '--color-surface'],
  ['--chart-axis', '--chart-bg'],
  ...[1, 2, 3, 4, 5, 6, 7].map((n): [string, string] => [`--chart-series-${n}`, '--chart-bg']),
  // Узлы общего графа связей лежат на фоне страницы.
  ...[1, 2, 3, 4, 5, 6, 7].map((n): [string, string] => [`--chart-series-${n}`, '--color-bg']),
];

describe.each<Theme>(['light', 'dark'])('токены, тема %s', (theme) => {
  it.each(text)('текст %s на %s ≥ 4,5:1', (fg, bg) => {
    expect(contrast(fg, bg, theme)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(graphics)('линия или граница %s против %s ≥ 3:1', (fg, bg) => {
    expect(contrast(fg, bg, theme)).toBeGreaterThanOrEqual(3);
  });
});

describe('набор токенов', () => {
  it('содержит цвета обеих тем и семантические алиасы графиков', () => {
    expect(tokens.size).toBeGreaterThan(45);
    expect(tokens.get('--color-bg')!.light).not.toBe(tokens.get('--color-bg')!.dark);
    expect(resolve('--chart-signal', 'dark')).toBe(tokens.get('--chart-series-1')!.dark);
  });

  it('задаёт явный выбор темы через color-scheme', () => {
    expect(css).toMatch(/:root\[data-theme='dark'\]\s*\{\s*color-scheme: dark;/);
    expect(css).toMatch(/:root\[data-theme='light'\]\s*\{\s*color-scheme: light;/);
  });
});
