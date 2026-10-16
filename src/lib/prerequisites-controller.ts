// Запоминает раскрытие «Что нужно знать заранее» и раскрывает блок на время печати.
import { writePrerequisitesOpen } from '@/lib/prerequisites';

export function initPrerequisites() {
  const details = document.querySelector<HTMLDetailsElement>('[data-prerequisites]');
  if (!details) return;
  // Раскрытие для печати не меняет сохранённый выбор читателя. Событие toggle асинхронное,
  // поэтому записывается состояние на момент обработки, а не из события.
  let openedForPrint = false;
  details.addEventListener('toggle', () => {
    if (!openedForPrint) writePrerequisitesOpen(details.open);
  });
  window.addEventListener('beforeprint', () => {
    if (details.open) return;
    openedForPrint = true;
    details.open = true;
  });
  window.addEventListener('afterprint', () => {
    if (!openedForPrint) return;
    openedForPrint = false;
    details.open = false;
  });
}
