import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';
import {
  prerequisitesInitScript,
  readPrerequisitesOpen,
  writePrerequisitesOpen,
} from '@/lib/prerequisites';

const throwing = () => {
  throw new Error('SecurityError');
};

describe('состояние «Что нужно знать заранее»', () => {
  it('по умолчанию свёрнут, раскрытие сохраняется и снимается', () => {
    const data = new Map<string, string>();
    const storage = {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => void data.set(key, value),
    };
    expect(readPrerequisitesOpen(() => storage)).toBe(false);
    expect(writePrerequisitesOpen(true, () => storage)).toBe(true);
    expect(data.get('ta-prerequisites')).toBe('open');
    expect(readPrerequisitesOpen(() => storage)).toBe(true);
    writePrerequisitesOpen(false, () => storage);
    expect(data.get('ta-prerequisites')).toBe('closed');
    expect(readPrerequisitesOpen(() => storage)).toBe(false);
  });

  it('при недоступном хранилище остаётся свёрнутым и сообщает об отказе записи', () => {
    expect(readPrerequisitesOpen(throwing)).toBe(false);
    expect(writePrerequisitesOpen(true, throwing)).toBe(false);
  });
});

describe('скрипт начальной загрузки', () => {
  const run = (stored: string | null | 'throw') => {
    const details = { open: false };
    runInNewContext(prerequisitesInitScript, {
      localStorage: {
        getItem: (key: string) => {
          if (stored === 'throw') throw new Error('SecurityError');
          return key === 'ta-prerequisites' ? stored : null;
        },
      },
      document: { currentScript: { previousElementSibling: details } },
    });
    return details.open;
  };

  it('раскрывает блок при сохранённом «open»', () => expect(run('open')).toBe(true));
  it('игнорирует прочие значения', () => {
    expect(run('closed')).toBe(false);
    expect(run(null)).toBe(false);
  });
  it('не падает без доступа к хранилищу', () => expect(run('throw')).toBe(false));
});
