// Копирование полного исходного текста блока кода. Успех показывается только после записи в clipboard,
// отказ даёт сообщение с советом выделить текст вручную. Номеров строк в разметке нет, поэтому
// `textContent` совпадает с исходным кодом.

const successText = 'Код скопирован';
const failureText = 'Не удалось скопировать код. Выделите текст вручную';
const successDuration = 2000;
const failureDuration = 8000;

async function writeClipboard(text: string): Promise<boolean> {
  try {
    if (!navigator.clipboard?.writeText) return false;
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function initCodeBlocks(): void {
  const timers = new WeakMap<HTMLElement, number>();

  const show = (block: HTMLElement, state: 'idle' | 'success' | 'error') => {
    const status = block.querySelector<HTMLElement>('[data-code-status]');
    const label = block.querySelector<HTMLElement>('.code-copy-label');
    const button = block.querySelector<HTMLElement>('[data-code-copy]');
    if (!status || !label || !button) return;
    clearTimeout(timers.get(block));
    block.dataset.copyState = state;
    label.textContent = state === 'success' ? 'Скопировано' : 'Копировать';
    status.textContent = { idle: '', success: successText, error: failureText }[state];
    if (state === 'idle') return;
    timers.set(
      block,
      window.setTimeout(
        () => show(block, 'idle'),
        state === 'success' ? successDuration : failureDuration,
      ),
    );
  };

  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-code-copy]')) {
    button.hidden = false;
  }

  document.addEventListener('click', (event) => {
    if (!(event.target instanceof Element)) return;
    const button = event.target.closest<HTMLButtonElement>('[data-code-copy]');
    const block = button?.closest<HTMLElement>('[data-code-block]');
    const code = block?.querySelector('pre code');
    if (!block || !code) return;
    // Запись стартует синхронно в обработчике клика, чтобы сохранить пользовательский жест.
    void writeClipboard(code.textContent ?? '').then((ok) => show(block, ok ? 'success' : 'error'));
  });
}
