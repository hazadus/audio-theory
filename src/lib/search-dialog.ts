// Правила открытия поискового диалога по горячей клавише «/».

/** Часть события клавиатуры, нужная для решения; позволяет проверять правила без DOM. */
export interface SlashKeyEvent {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  isComposing: boolean;
  repeat: boolean;
  defaultPrevented: boolean;
  target: EventTarget | { tagName?: string; isContentEditable?: boolean } | null;
}

const editableTags = new Set(['INPUT', 'TEXTAREA', 'SELECT']);

/** Поле ввода, список выбора или редактируемая область: «/» там остаётся символом. */
export function isEditableTarget(target: SlashKeyEvent['target']): boolean {
  if (!target) return false;
  const { tagName, isContentEditable } = target as {
    tagName?: string;
    isContentEditable?: boolean;
  };
  return editableTags.has(tagName?.toUpperCase() ?? '') || isContentEditable === true;
}

/**
 * «/» открывает поиск, если это не сочетание с Ctrl, Cmd или Alt, не композиционный ввод,
 * не повтор удержанной клавиши и не ввод в поле. Shift допустим: на русской раскладке «/» набирается с ним.
 */
export function shouldOpenSearch(event: SlashKeyEvent): boolean {
  if (event.key !== '/' || event.defaultPrevented || event.repeat) return false;
  if (event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return false;
  return !isEditableTarget(event.target);
}
