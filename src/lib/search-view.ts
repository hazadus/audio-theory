// Подготовка выдачи поиска к показу: плоский список переходов и безопасный разбор фрагментов.
import type { SearchResult } from '@/lib/search';

export interface SearchHit {
  /** Название статьи. */
  article: string;
  /** Название раздела; пусто, если переход ведёт к началу статьи. */
  section: string;
  url: string;
  /** Фрагмент текста со следами совпадений; без выделения, если его нет. */
  excerpt: string;
}

/** Часть фрагмента: обычный текст или совпадение. Текст всегда показывают через textContent. */
export interface ExcerptPart {
  text: string;
  mark: boolean;
}

const namedEntities: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

function decodeEntities(text: string): string {
  return text.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (whole, name: string) => {
    if (name[0] === '#') {
      const code =
        name[1].toLowerCase() === 'x' ? parseInt(name.slice(2), 16) : Number(name.slice(1));
      return Number.isSafeInteger(code) && code > 0 && code <= 0x10ffff
        ? String.fromCodePoint(code)
        : whole;
    }
    return namedEntities[name.toLowerCase()] ?? whole;
  });
}

/**
 * Разбирает фрагмент Pagefind (`<mark>` вокруг совпадений, остальное — экранированный текст).
 * Теги кроме `mark` отбрасываются, сущности превращаются в символы: результат безопасен
 * для вставки через textContent, разметка из индекса никогда не исполняется.
 */
export function parseExcerpt(excerpt: string): ExcerptPart[] {
  const parts: ExcerptPart[] = [];
  let marked = false;
  for (const chunk of excerpt.split(/(<\/?mark\s*>)/i)) {
    if (/^<mark\s*>$/i.test(chunk)) {
      marked = true;
      continue;
    }
    if (/^<\/mark\s*>$/i.test(chunk)) {
      marked = false;
      continue;
    }
    const text = decodeEntities(chunk.replace(/<[^>]*>/g, ''));
    if (text) parts.push({ text, mark: marked });
  }
  return parts;
}

/** Каждый найденный раздел — отдельный переход; статья без разделов даёт переход к своему началу. */
export function toHits(results: SearchResult[]): SearchHit[] {
  return results.flatMap((result) => {
    if (result.sections.length === 0) {
      return [{ article: result.title, section: '', url: result.url, excerpt: '' }];
    }
    return result.sections.map((section) => ({
      article: result.title,
      section: section.title === result.title ? '' : section.title,
      url: section.url,
      excerpt: section.excerpt,
    }));
  });
}

/**
 * Новый индекс выбранного результата. Из состояния «ничего не выбрано» (-1) `↓` выбирает первый,
 * `↑` выбора не создаёт; на границах списка выделение останавливается.
 */
export function moveSelection(current: number, count: number, step: 1 | -1): number {
  if (count <= 0) return -1;
  if (current < 0) return step === 1 ? 0 : -1;
  return Math.min(count - 1, Math.max(0, current + step));
}
