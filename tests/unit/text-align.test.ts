import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';
import {
  applyTextAlign,
  parseTextAlign,
  readStoredTextAlign,
  textAlignInitScript,
  writeStoredTextAlign,
} from '@/lib/text-align';

const throwing = () => {
  throw new Error('SecurityError');
};

function fakeRoot() {
  const attrs = new Map<string, string>();
  return {
    attrs,
    setAttribute: (name: string, value: string) => void attrs.set(name, value),
    removeAttribute: (name: string) => void attrs.delete(name),
  };
}

describe('выравнивание текста', () => {
  it('разбирает значение и заменяет неверное на «слева»', () => {
    expect(parseTextAlign('justify')).toBe('justify');
    expect(parseTextAlign('left')).toBe('left');
    expect(parseTextAlign('center')).toBe('left');
    expect(parseTextAlign(null)).toBe('left');
  });

  it('читает и пишет выбор в хранилище', () => {
    const data = new Map<string, string>();
    const storage = {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => void data.set(key, value),
    };
    expect(readStoredTextAlign(() => storage)).toBe('left');
    expect(writeStoredTextAlign('justify', () => storage)).toBe(true);
    expect(data.get('ta-align')).toBe('justify');
    expect(readStoredTextAlign(() => storage)).toBe('justify');
  });

  it('при недоступном хранилище остаётся «слева» и сообщает об отказе записи', () => {
    expect(readStoredTextAlign(throwing)).toBe('left');
    expect(writeStoredTextAlign('justify', throwing)).toBe(false);
  });

  it('ставит атрибут только для «по ширине»', () => {
    const root = fakeRoot();
    applyTextAlign(root, 'justify');
    expect(root.attrs.get('data-text-align')).toBe('justify');
    applyTextAlign(root, 'left');
    expect(root.attrs.has('data-text-align')).toBe(false);
  });
});

describe('скрипт начальной загрузки', () => {
  const run = (stored: string | null | 'throw') => {
    const root = fakeRoot();
    runInNewContext(textAlignInitScript, {
      localStorage: {
        getItem: (key: string) => {
          if (stored === 'throw') throw new Error('SecurityError');
          return key === 'ta-align' ? stored : null;
        },
      },
      document: { documentElement: root },
    });
    return root.attrs.get('data-text-align');
  };

  it('применяет сохранённое «по ширине»', () => expect(run('justify')).toBe('justify'));
  it('игнорирует прочие значения', () => {
    expect(run('left')).toBeUndefined();
    expect(run(null)).toBeUndefined();
  });
  it('не падает без доступа к хранилищу', () => expect(run('throw')).toBeUndefined());
});
