// Проверка объёма и полей заметок «Подробнее».
import { describe, expect, it } from 'vitest';
import { marginNoteItems } from '@/lib/margin-note';

const item = {
  label: 'Дискретизация → Период',
  description: 'Связь частоты и периода отсчётов.',
  target: { article: 'sampling', anchor: 'sampling-period' },
};

describe('Заметка «Подробнее»', () => {
  it('принимает 1–3 ссылки и отклоняет пустую либо чрезмерную заметку', () => {
    for (const length of [1, 2, 3]) {
      expect(marginNoteItems.parse(Array.from({ length }, () => item))).toHaveLength(length);
    }
    for (const length of [0, 4]) {
      expect(marginNoteItems.safeParse(Array.from({ length }, () => item)).success).toBe(false);
    }
  });

  it('отклоняет пустые названия, пояснения и неверные цели', () => {
    for (const invalid of [
      { ...item, label: ' ' },
      { ...item, description: '' },
      { ...item, target: { article: '' } },
      { ...item, target: { url: 'не адрес' } },
      { ...item, target: { article: 'sampling', anchor: ' ' } },
    ]) {
      expect(marginNoteItems.safeParse([invalid]).success).toBe(false);
    }
  });
});
