// Единое состояние темы в окне для всех контролов: кнопки в шапке и выбора в меню.
import {
  applyTheme,
  parseTheme,
  readStoredTheme,
  themeStorageKey,
  writeStoredTheme,
  type ThemeMode,
} from '@/lib/theme';

const changeEvent = 'themechange';
let mode: ThemeMode | undefined;

export function getThemeMode(): ThemeMode {
  return (mode ??= readStoredTheme());
}

function publish() {
  const current = getThemeMode();
  applyTheme(document.documentElement, current);
  document.dispatchEvent(new CustomEvent<ThemeMode>(changeEvent, { detail: current }));
}

/** Режим держится в памяти окна: при отказе storage переключение работает, но не сохраняется. */
export function setThemeMode(next: ThemeMode) {
  mode = next;
  writeStoredTheme(next);
  publish();
}

/** Вызывает обработчик сразу и после каждого изменения темы, в том числе из другой вкладки. */
export function onThemeChange(handler: (mode: ThemeMode) => void) {
  document.addEventListener(changeEvent, (event) =>
    handler((event as CustomEvent<ThemeMode>).detail),
  );
  handler(getThemeMode());
}

window.addEventListener('storage', (event) => {
  if (event.key === themeStorageKey || event.key === null) {
    mode = parseTheme(event.newValue);
    publish();
  }
});
