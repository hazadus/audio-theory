// Проверяет правила содержимого статьи: источники, ссылки, язык листингов, идентификаторы и нумерацию.
import { describe, expect, it } from 'vitest';
import { findDemos, assertValidArticles, type ArticleForCheck } from '@/lib/article-content';

const sources = '\n## Источники {#sources}\n\n- [Книга](https://example.com/book)\n';

function article(body: string, extra: Partial<ArticleForCheck['data']> = {}): ArticleForCheck {
  return {
    id: 'a.mdx',
    body: body + sources,
    data: {
      slug: 'a',
      related: [{ label: 'Я', description: 'Я', target: { article: 'a' } }],
      ...extra,
    },
    headings: [{ slug: 'sources' }],
  };
}

const check =
  (...articles: ArticleForCheck[]) =>
  () =>
    assertValidArticles(articles);

describe('assertValidArticles', () => {
  it('принимает статью со всеми обязательными элементами', () => {
    expect(
      check(
        article(
          '```ts\nlet x = 1;\n```\n\n<Figure id="f" number={1} />\n\n<DataTable id="t" number={1} />\n\n<Equation id="e" number={1} />',
        ),
      ),
    ).not.toThrow();
  });

  it('требует раздел «Источники» со ссылкой', () => {
    const bare = { ...article(''), body: 'Текст.' };
    expect(check(bare)).toThrow(/нет раздела «Источники»/);
    expect(check({ ...bare, body: '## Источники {#sources}\n\nТекст.' })).toThrow(/нет ссылок/);
  });

  it('требует язык у блока кода, но не у строчного', () => {
    expect(check(article('```\nx\n```'))).toThrow(/строка 1: блок кода без указания языка/);
    expect(check(article('Строчный `код` без языка.'))).not.toThrow();
  });

  it('проверяет внутренние ссылки и связанные темы', () => {
    expect(check(article('[x](/missing/)'))).toThrow(/неизвестную статью «missing»/);
    expect(check(article('[x](/a/#nope)'))).toThrow(/несуществующий раздел «a#nope»/);
    expect(check(article('[x](#sources)'))).not.toThrow();
    expect(check(article('[x](#nope)'))).toThrow(/несуществующий раздел «a#nope»/);
    expect(check(article('[x](https://example.com/#nope)'))).not.toThrow();
    expect(
      check(
        article('', { related: [{ label: 'Я', description: 'Я', target: { article: 'zzz' } }] }),
      ),
    ).toThrow(/related «Я» ведёт на неизвестную статью «zzz»/);
  });

  it('ссылается на идентификаторы блоков другой статьи', () => {
    const other = { ...article('<Figure id="wave" number={1} />'), id: 'b.mdx' };
    other.data = { ...other.data, slug: 'b' };
    expect(check(article('[x](/b/#wave)'), other)).not.toThrow();
    expect(check(article('[x](/b/#nope)'), other)).toThrow(/b#nope/);
  });

  it('передаёт проверку страниц треков готовому HTML, сохраняя проверку ссылок статей', () => {
    expect(
      check(article('[Треки](/tracks/) [Музыкант](/tracks/musician/#stage-intro)')),
    ).not.toThrow();
    expect(check(article('[Ошибка](/tracks/musician/extra/)'))).toThrow(/неизвестную статью/);
  });

  it.each([
    [
      'вводные',
      [
        'IntroToneDemo id="tone"',
        'IntroOscillatorDemo id="osc"',
        'IntroEnvelopeDemo id="adsr"',
        'IntroLfoDemo id="lfo"',
      ],
      ['tone', 'osc', 'adsr', 'lfo'],
    ],
    ['музыкальные', ['MusicNotesDemo', 'MusicRhythmDemo'], ['music-notes', 'music-rhythm']],
    [
      'DAW',
      ['DawProjectDemo', 'DawPianoRollDemo', 'DawClipsDemo', 'DawSignalChainDemo'],
      ['daw-project', 'daw-piano-roll', 'daw-clips', 'daw-signal-chain'],
    ],
  ])('%s опыты входят в реестр блоков и общую нумерацию', (_name, tags, ids) => {
    const blocks = tags.map((tag, i) => `<${tag} figure={${i + 1}} />`).join('\n\n');
    // Явный id опыта становится якорем: ссылка на него проходит проверку.
    const link = tags[0].includes(' id=') ? `\n\n[x](#${ids.at(-1)})` : '';
    const body = blocks + link;
    expect(check(article(body))).not.toThrow();
    const last = tags.length;
    expect(check(article(body.replace(`figure={${last}}`, `figure={${last + 1}}`)))).toThrow(
      `рисунков ожидался номер ${last}`,
    );
    expect(findDemos(body).map((demo) => demo.id)).toEqual(ids);
  });

  it('рисунки и визуализации образуют одну последовательность', () => {
    const ok = '<Figure id="f" number={1} />\n\n<SamplingDemo figure={2} />';
    expect(check(article(ok))).not.toThrow();
    const bad = '<Figure id="f" number={1} />\n\n<SamplingDemo figure={1} />';
    expect(check(article(bad))).toThrow(/рисунков ожидался номер 2, указан 1/);
  });

  it('таблицы и формулы нумеруются отдельно; формула без номера не участвует', () => {
    const body =
      '<Figure id="f" number={1} />\n\n<DataTable id="t" number={1} />\n\n<Equation id="e1" number={1} />\n\n<Equation id="e0" />\n\n<Equation id="e2" number={2} />';
    expect(check(article(body))).not.toThrow();
    expect(check(article('<DataTable id="t" number={2} />'))).toThrow(/таблиц ожидался номер 1/);
    expect(check(article('<Equation id="e" number={2} />'))).toThrow(/формул ожидался номер 1/);
  });

  it('проверяет формат, повтор и наличие идентификатора и номера', () => {
    expect(check(article('<Figure id="Bad_Id" number={1} />'))).toThrow(/kebab-case/);
    expect(check(article('<Figure id="x" number={1} />\n\n<Figure id="x" number={2} />'))).toThrow(
      /повторный идентификатор «x»/,
    );
    expect(check(article('<Figure number={1} />'))).toThrow(/без атрибута id/);
    expect(check(article('<Figure id="x" />'))).toThrow(/без номера/);
    expect(check(article('<Figure id="x" number={n} />'))).toThrow(/целым числом/);
    expect(check(article('<Figure id="sources" number={1} />'))).toThrow(/повторный идентификатор/);
  });

  it('не блокирует сборку из-за рекомендательных лимитов', () => {
    const tags = ['samples', 'aliasing', 'spectrum', 'phase', 'decibels', 'loudness'];
    const callouts = '<Callout type="note" title="Врезка">Текст.</Callout>\n\n'.repeat(8);
    const code = `\`\`\`python\n${'x = 1\n'.repeat(60)}\`\`\``;
    expect(
      check({ ...article(`${callouts}${code}`), data: { ...article('').data, tags } as never }),
    ).not.toThrow();
  });

  it('собирает все нарушения в одно сообщение', () => {
    expect(check(article('[x](/m/)\n\n```\nx\n```'))).toThrow(
      /без указания языка[\s\S]*неизвестную статью/,
    );
  });
});
