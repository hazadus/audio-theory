// Блок «Что нужно знать заранее»: свёрнут по умолчанию, раскрытие запоминается для всех статей.
export const prerequisitesStorageKey = 'ta-prerequisites';

type ReadableStorage = Pick<Storage, 'getItem'>;
type WritableStorage = Pick<Storage, 'setItem'>;

/** Доступ к хранилищу может бросить исключение (запрет cookies, приватный режим); тогда блок свёрнут. */
export function readPrerequisitesOpen(
  getStorage: () => ReadableStorage = () => localStorage,
): boolean {
  try {
    return getStorage().getItem(prerequisitesStorageKey) === 'open';
  } catch {
    return false;
  }
}

/** Возвращает false, если сохранить состояние не удалось; на текущей странице оно уже применено. */
export function writePrerequisitesOpen(
  open: boolean,
  getStorage: () => WritableStorage = () => localStorage,
): boolean {
  try {
    getStorage().setItem(prerequisitesStorageKey, open ? 'open' : 'closed');
    return true;
  } catch {
    return false;
  }
}

/** Синхронный скрипт сразу после `<details>`: раскрывает блок до отрисовки, чтобы текст не прыгал при загрузке. */
export const prerequisitesInitScript = `(function(){try{if(localStorage.getItem(${JSON.stringify(prerequisitesStorageKey)})==='open'){var d=document.currentScript.previousElementSibling;if(d)d.open=true}}catch(e){}})()`;
