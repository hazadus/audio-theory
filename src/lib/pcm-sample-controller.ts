// Два способа ввода одного отсчёта; неверный ввод сохраняет последний корректный разбор.
import { defaultPcm24, parsePcm24Bytes, parsePcm24Integer, pcm24View } from '@/lib/integer-pcm';

function init(root: HTMLElement): void {
  const controls = root.querySelector<HTMLFieldSetElement>('[data-controls]')!;
  const integer = root.querySelector<HTMLInputElement>('[name="integer"]')!;
  const bytes = root.querySelector<HTMLInputElement>('[name="bytes"]')!;
  const status = root.querySelector<HTMLElement>('[data-status]')!;
  const render = (value: number) => {
    const view = pcm24View(value);
    for (const field of root.querySelectorAll<HTMLElement>('[data-result]')) {
      field.textContent = view[field.dataset.result as keyof typeof view];
    }
    root.querySelector('[data-extension]')!.textContent = view.extension;
    root.querySelector('[data-extended-rest]')!.textContent = view.extended.slice(3);
    integer.value = String(value);
    bytes.value = view.bytes;
    integer.removeAttribute('aria-invalid');
    bytes.removeAttribute('aria-invalid');
    status.removeAttribute('data-error');
    status.textContent = `Отсчёт ${value}. Знаковый бит ${view.sign}. ${view.float}.`;
  };
  const submit = (form: string, input: HTMLInputElement, parse: (text: string) => number) => {
    root.querySelector(form)!.addEventListener('submit', (event) => {
      event.preventDefault();
      try {
        render(parse(input.value));
      } catch (error) {
        input.setAttribute('aria-invalid', 'true');
        status.setAttribute('data-error', '');
        status.textContent = `${error instanceof Error ? error.message : 'Неверный ввод.'} Показан последний корректный отсчёт.`;
      }
    });
  };
  submit('[data-integer-form]', integer, parsePcm24Integer);
  submit('[data-bytes-form]', bytes, parsePcm24Bytes);
  for (const button of root.querySelectorAll<HTMLButtonElement>('[data-example]'))
    button.addEventListener('click', () => render(Number(button.dataset.example)));
  root.querySelector('[data-reset]')!.addEventListener('click', () => render(defaultPcm24));
  render(defaultPcm24);
  controls.disabled = false;
  root.dataset.state = 'ready';
}

export function initPcmSamples(): void {
  for (const root of document.querySelectorAll<HTMLElement>('[data-pcm-demo]')) {
    try {
      init(root);
    } catch (error) {
      root.dataset.state = 'error';
      root.querySelector<HTMLFieldSetElement>('[data-controls]')!.disabled = true;
      root.querySelector('[data-status]')!.textContent =
        'Не удалось запустить ввод. Показан статичный разбор отсчёта.';
      console.error(error);
    }
  }
}
