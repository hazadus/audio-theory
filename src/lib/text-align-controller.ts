// Единое состояние выравнивания в окне для обоих переключателей: десктопного и мобильного.
import {
  applyTextAlign,
  parseTextAlign,
  readStoredTextAlign,
  textAlignStorageKey,
  writeStoredTextAlign,
  type TextAlign,
} from '@/lib/text-align';

const changeEvent = 'textalignchange';
let align: TextAlign | undefined;

export function getTextAlign(): TextAlign {
  return (align ??= readStoredTextAlign());
}

function publish() {
  const current = getTextAlign();
  applyTextAlign(document.documentElement, current);
  document.dispatchEvent(new CustomEvent<TextAlign>(changeEvent, { detail: current }));
}

/** Выравнивание держится в памяти окна: при отказе storage переключение работает, но не сохраняется. */
export function setTextAlign(next: TextAlign) {
  align = next;
  writeStoredTextAlign(next);
  publish();
}

/** Вызывает обработчик сразу и после каждого изменения, в том числе из другой вкладки. */
export function onTextAlignChange(handler: (align: TextAlign) => void) {
  document.addEventListener(changeEvent, (event) =>
    handler((event as CustomEvent<TextAlign>).detail),
  );
  handler(getTextAlign());
}

window.addEventListener('storage', (event) => {
  if (event.key === textAlignStorageKey || event.key === null) {
    align = parseTextAlign(event.newValue);
    publish();
  }
});
