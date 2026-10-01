// Выбор темы: «light» и «dark» фиксируют data-theme на <html>, «auto» убирает атрибут и отдаёт выбор системе.
export type ThemeMode = 'light' | 'dark' | 'auto';

export const themeStorageKey = 'theme';
export const themeModes: readonly ThemeMode[] = ['light', 'dark', 'auto'];

export const themeLabels: Record<ThemeMode, string> = {
  light: 'светлая',
  dark: 'тёмная',
  auto: 'авто',
};

type ReadableStorage = Pick<Storage, 'getItem'>;
type WritableStorage = Pick<Storage, 'setItem'>;

export function parseTheme(value: unknown): ThemeMode {
  return value === 'light' || value === 'dark' ? value : 'auto';
}

/** Порядок переключения: светлая → тёмная → авто → светлая. */
export function nextTheme(mode: ThemeMode): ThemeMode {
  return themeModes[(themeModes.indexOf(mode) + 1) % themeModes.length];
}

/** Доступ к хранилищу может бросить исключение (запрет cookies, приватный режим); тогда выбор — авто. */
export function readStoredTheme(getStorage: () => ReadableStorage = () => localStorage): ThemeMode {
  try {
    return parseTheme(getStorage().getItem(themeStorageKey));
  } catch {
    return 'auto';
  }
}

/** Возвращает false, если сохранить выбор не удалось; тема в текущем окне при этом уже применена. */
export function writeStoredTheme(
  mode: ThemeMode,
  getStorage: () => WritableStorage = () => localStorage,
): boolean {
  try {
    getStorage().setItem(themeStorageKey, mode);
    return true;
  } catch {
    return false;
  }
}

export function applyTheme(
  root: Pick<HTMLElement, 'setAttribute' | 'removeAttribute'>,
  mode: ThemeMode,
) {
  if (mode === 'auto') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', mode);
}

/** Доступное имя кнопки: текущий режим и следующий. */
export function themeButtonLabel(mode: ThemeMode): string {
  return `Тема: ${themeLabels[mode]}. Переключить на: ${themeLabels[nextTheme(mode)]}`;
}

/** Синхронный скрипт для <head>: выполняется до CSS и не зависит от модулей. Без JS остаётся системная тема. */
export const themeInitScript = `(function(){try{var m=localStorage.getItem(${JSON.stringify(themeStorageKey)});if(m==='light'||m==='dark')document.documentElement.setAttribute('data-theme',m)}catch(e){}})()`;
