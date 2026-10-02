// Проверяет правила плеера эксперимента: имена кнопок по состоянию, время, перемотку и клавиши в фокусе.
import { describe, expect, it } from 'vitest';
import {
  formatTime,
  muteButtonLabel,
  playButtonLabel,
  playerKeyAction,
  positionText,
  seekStep,
  seekTo,
  stateText,
  volumeText,
  type PlayerTarget,
} from '@/lib/sampling-player';

const plain = (text: string) => text.replaceAll(' ', ' ');
const key = (k: string, modifiers: Partial<KeyboardEvent> = {}) => ({
  key: k,
  altKey: false,
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
  ...modifiers,
});

describe('доступные имена и состояние', () => {
  it('главная кнопка называет действие для текущего состояния', () => {
    expect(playButtonLabel('ready')).toBe('Воспроизвести');
    expect(playButtonLabel('playing')).toBe('Пауза');
    expect(playButtonLabel('paused')).toBe('Продолжить');
    expect(playButtonLabel('error')).toBe('Воспроизвести');
  });

  it('mute называет действие', () => {
    expect(muteButtonLabel(false)).toBe('Выключить звук');
    expect(muteButtonLabel(true)).toBe('Включить звук');
  });

  it('строка состояния покрывает все состояния', () => {
    expect(stateText('ready')).toBe('Остановлен');
    expect(stateText('loading')).toBe('Загрузка…');
    expect(stateText('playing')).toBe('Воспроизводится');
    expect(stateText('paused')).toBe('Пауза');
    expect(stateText('unavailable')).toBe('Звук недоступен');
    expect(stateText('error')).toBe('Ошибка воспроизведения');
  });
});

describe('время и значения', () => {
  it('позиция и длительность с десятыми долями секунды', () => {
    expect(formatTime(0)).toBe('0:00,0');
    expect(formatTime(1.34)).toBe('0:01,3');
    expect(formatTime(2)).toBe('0:02,0');
    expect(formatTime(61.25)).toBe('1:01,3');
    expect(formatTime(-1)).toBe('0:00,0');
  });

  it('aria-valuetext позиции и громкости', () => {
    expect(plain(positionText(0.3, 2))).toBe('0,3 с из 2 с');
    expect(plain(volumeText(30))).toBe('30 %');
  });
});

describe('seekTo', () => {
  it('шаг 0,1 с и границы фрагмента', () => {
    expect(seekStep).toBe(0.1);
    expect(seekTo(0.3 + seekStep, 2)).toBe(0.4);
    expect(seekTo(1.04, 2)).toBe(1);
    expect(seekTo(-0.1, 2)).toBe(0);
    expect(seekTo(2.1, 2)).toBe(2);
  });
});

describe('playerKeyAction', () => {
  const targets: PlayerTarget[] = ['button', 'position', 'volume', 'other'];

  it('пробел переключает паузу на ползунке позиции, на кнопке остаётся её действие', () => {
    expect(playerKeyAction(key(' '), 'position')).toBe('toggle');
    expect(playerKeyAction(key(' '), 'button')).toBeNull();
  });

  it('стрелки перематывают на кнопках, ползунок позиции двигается нативно', () => {
    expect(playerKeyAction(key('ArrowLeft'), 'button')).toBe('back');
    expect(playerKeyAction(key('ArrowRight'), 'button')).toBe('forward');
    expect(playerKeyAction(key('ArrowRight'), 'position')).toBeNull();
  });

  it('ползунок громкости и посторонние поля не перехватываются', () => {
    for (const k of [' ', 'ArrowLeft', 'ArrowRight', 'ArrowUp']) {
      expect(playerKeyAction(key(k), 'volume')).toBeNull();
      expect(playerKeyAction(key(k), 'other')).toBeNull();
    }
  });

  it('сочетания с модификаторами и другие клавиши игнорируются', () => {
    for (const target of targets) {
      expect(playerKeyAction(key('ArrowRight', { metaKey: true }), target)).toBeNull();
      expect(playerKeyAction(key(' ', { shiftKey: true }), target)).toBeNull();
      expect(playerKeyAction(key('Enter'), target)).toBeNull();
    }
  });
});
