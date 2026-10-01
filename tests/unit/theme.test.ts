import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';
import {
  applyTheme,
  nextTheme,
  parseTheme,
  readStoredTheme,
  themeButtonLabel,
  themeInitScript,
  writeStoredTheme,
} from '@/lib/theme';

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

describe('режимы темы', () => {
  it('разбирает значение и заменяет неверное на авто', () => {
    expect(parseTheme('light')).toBe('light');
    expect(parseTheme('dark')).toBe('dark');
    expect(parseTheme('auto')).toBe('auto');
    expect(parseTheme('sepia')).toBe('auto');
    expect(parseTheme(null)).toBe('auto');
  });

  it('переключает по кругу: светлая → тёмная → авто → светлая', () => {
    expect(nextTheme('light')).toBe('dark');
    expect(nextTheme('dark')).toBe('auto');
    expect(nextTheme('auto')).toBe('light');
  });

  it('сообщает текущий и следующий режим в имени кнопки', () => {
    expect(themeButtonLabel('light')).toBe('Тема: светлая. Переключить на: тёмная');
    expect(themeButtonLabel('auto')).toBe('Тема: авто. Переключить на: светлая');
  });

  it('фиксирует тему атрибутом, а в авто убирает его', () => {
    const root = fakeRoot();
    applyTheme(root, 'dark');
    expect(root.attrs.get('data-theme')).toBe('dark');
    applyTheme(root, 'auto');
    expect(root.attrs.has('data-theme')).toBe(false);
  });
});

describe('хранилище', () => {
  it('читает и записывает выбор', () => {
    const data = new Map<string, string>();
    const storage = {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => void data.set(key, value),
    };
    expect(readStoredTheme(() => storage)).toBe('auto');
    expect(writeStoredTheme('dark', () => storage)).toBe(true);
    expect(readStoredTheme(() => storage)).toBe('dark');
  });

  it('при отказе доступа читает авто, а запись сообщает о неудаче', () => {
    expect(readStoredTheme(throwing)).toBe('auto');
    expect(readStoredTheme(() => ({ getItem: throwing }))).toBe('auto');
    expect(writeStoredTheme('light', throwing)).toBe(false);
    expect(writeStoredTheme('light', () => ({ setItem: throwing }))).toBe(false);
  });
});

describe('ранний скрипт', () => {
  const run = (localStorage: unknown) => {
    const root = fakeRoot();
    runInNewContext(themeInitScript, { localStorage, document: { documentElement: root } });
    return root.attrs.get('data-theme');
  };

  it('восстанавливает сохранённую тему', () => {
    expect(run({ getItem: () => 'dark' })).toBe('dark');
    expect(run({ getItem: () => 'light' })).toBe('light');
  });

  it('оставляет авто при пустом, неверном значении и отказе хранилища', () => {
    expect(run({ getItem: () => null })).toBeUndefined();
    expect(run({ getItem: () => 'auto' })).toBeUndefined();
    expect(run({ getItem: throwing })).toBeUndefined();
  });

  it('не падает, если доступ к localStorage бросает исключение', () => {
    const root = fakeRoot();
    const context = {
      document: { documentElement: root },
      get localStorage() {
        return throwing();
      },
    };
    expect(() => runInNewContext(themeInitScript, context)).not.toThrow();
  });
});
