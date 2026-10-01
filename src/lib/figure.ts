// Доступное описание статичного SVG: название и описание вставляются в первый `<svg>` рисунка.

const svgOpenTag = /<svg\b([^>]*)>/;

function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export interface SvgText {
  /** Префикс `id` для `<title>` и `<desc>`; берётся из `id` рисунка. */
  id: string;
  title: string;
  description: string;
}

/** Добавляет в первый `<svg>` роль `img`, `<title>` и `<desc>`; без SVG или с готовым `<title>` выбрасывает ошибку. */
export function annotateSvg(html: string, { id, title, description }: SvgText): string {
  const match = svgOpenTag.exec(html);
  if (!match) throw new Error(`Figure «${id}»: внутри нужен SVG`);
  if (/<title\b/.test(html) || /<desc\b/.test(html)) {
    throw new Error(
      `Figure «${id}»: название и описание задаются атрибутами name и alt, а не в SVG`,
    );
  }
  if (!title.trim() || !description.trim()) {
    throw new Error(`Figure «${id}»: у SVG должны быть название и описание`);
  }
  const attributes = match[1]
    .replace(/\s(?:role|aria-labelledby|aria-label|focusable)="[^"]*"/g, '')
    .trimEnd();
  const open = `<svg${attributes} role="img" aria-labelledby="${id}-title ${id}-desc" focusable="false">`;
  const text = `<title id="${id}-title">${escapeHtml(title)}</title><desc id="${id}-desc">${escapeHtml(description)}</desc>`;
  return html.slice(0, match.index) + open + text + html.slice(match.index + match[0].length);
}
