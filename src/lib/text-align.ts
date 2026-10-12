// Выравнивание текста статьи: «left» — по умолчанию, «justify» фиксируется атрибутом data-text-align на <html>.
export type TextAlign = 'left' | 'justify';

export const textAlignStorageKey = 'ta-align';
export const textAlignOptions: readonly { value: TextAlign; label: string; short: string }[] = [
  { value: 'left', label: 'По левому краю', short: 'Слева' },
  { value: 'justify', label: 'По ширине', short: 'По ширине' },
];

type ReadableStorage = Pick<Storage, 'getItem'>;
type WritableStorage = Pick<Storage, 'setItem'>;

export function parseTextAlign(value: unknown): TextAlign {
  return value === 'justify' ? 'justify' : 'left';
}

/** Доступ к хранилищу может бросить исключение (запрет cookies, приватный режим); тогда выравнивание — слева. */
export function readStoredTextAlign(
  getStorage: () => ReadableStorage = () => localStorage,
): TextAlign {
  try {
    return parseTextAlign(getStorage().getItem(textAlignStorageKey));
  } catch {
    return 'left';
  }
}

/** Возвращает false, если сохранить выбор не удалось; в текущем окне он уже применён. */
export function writeStoredTextAlign(
  align: TextAlign,
  getStorage: () => WritableStorage = () => localStorage,
): boolean {
  try {
    getStorage().setItem(textAlignStorageKey, align);
    return true;
  } catch {
    return false;
  }
}

export function applyTextAlign(
  root: Pick<HTMLElement, 'setAttribute' | 'removeAttribute'>,
  align: TextAlign,
) {
  if (align === 'justify') root.setAttribute('data-text-align', 'justify');
  else root.removeAttribute('data-text-align');
}

/** Синхронный скрипт для <head>: ставит атрибут до отрисовки, чтобы текст не перескакивал при загрузке. */
export const textAlignInitScript = `(function(){try{if(localStorage.getItem(${JSON.stringify(textAlignStorageKey)})==='justify')document.documentElement.setAttribute('data-text-align','justify')}catch(e){}})()`;
