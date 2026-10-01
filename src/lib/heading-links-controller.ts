// Копирование адреса раздела по нажатию на `#` у заголовка. Ссылка при этом остаётся обычной:
// переход по якорю выполняет браузер, успех сообщается только после записи в clipboard.
import { headingLinkUrl } from '@/lib/heading-links';

const successText = 'Адрес раздела скопирован';
const failureText = 'Не удалось скопировать адрес. Он доступен в адресной строке';
const hideAfter = 2500;

async function writeClipboard(text: string): Promise<boolean> {
  try {
    if (!navigator.clipboard?.writeText) return false;
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function initHeadingLinks(): void {
  const status = document.querySelector<HTMLElement>('[data-copy-status]');
  let timer = 0;

  const announce = (ok: boolean) => {
    if (!status) return;
    clearTimeout(timer);
    status.dataset.state = ok ? 'success' : 'error';
    status.textContent = ok ? successText : failureText;
    status.hidden = false;
    timer = window.setTimeout(() => {
      status.hidden = true;
      status.textContent = '';
    }, hideAfter);
  };

  document.addEventListener('click', (event) => {
    if (!(event.target instanceof Element)) return;
    const link = event.target.closest<HTMLAnchorElement>('a[data-heading-link]');
    if (!link) return;
    const url = headingLinkUrl(location.href, link.getAttribute('href') ?? '');
    // Запись стартует синхронно в обработчике клика, чтобы сохранить пользовательский жест.
    void writeClipboard(url).then(announce);
  });
}
