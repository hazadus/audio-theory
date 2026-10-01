// Проверяет положение подсказки термина, уникальные id и поиск записи глоссария.
import { describe, expect, it } from 'vitest';
import { findTerm, glossarySchema } from '@/lib/glossary';
import { nextTermId, placePopover } from '@/lib/term';
import glossary from '@/data/glossary.json';

const size = { width: 300, height: 100 };
const viewport = { width: 800, height: 600 };

describe('placePopover', () => {
  it('ставит подсказку под ссылкой', () => {
    expect(placePopover({ left: 100, top: 200, bottom: 220 }, size, viewport)).toEqual({
      left: 100,
      top: 228,
    });
  });

  it('при нехватке места снизу ставит над ссылкой', () => {
    expect(placePopover({ left: 100, top: 560, bottom: 580 }, size, viewport)).toEqual({
      left: 100,
      top: 452,
    });
  });

  it('если нет места и сверху, остаётся под ссылкой', () => {
    expect(
      placePopover({ left: 100, top: 20, bottom: 40 }, size, { width: 800, height: 120 }),
    ).toEqual({ left: 100, top: 48 });
  });

  it('удерживает подсказку внутри окна по горизонтали', () => {
    expect(placePopover({ left: 700, top: 200, bottom: 220 }, size, viewport).left).toBe(492);
    expect(placePopover({ left: -20, top: 200, bottom: 220 }, size, viewport).left).toBe(8);
  });

  it('на окне уже подсказки прижимает к левому краю', () => {
    expect(
      placePopover({ left: 100, top: 200, bottom: 220 }, size, { width: 200, height: 600 }).left,
    ).toBe(8);
  });
});

describe('nextTermId', () => {
  it('выдаёт разные id для повторных упоминаний', () => {
    expect(nextTermId('sample-rate')).not.toBe(nextTermId('sample-rate'));
  });
});

describe('findTerm', () => {
  const entries = glossarySchema.parse(glossary);

  it('находит запись из единого источника', () => {
    expect(findTerm(entries, 'sample-rate').en).toBe('sample rate');
  });

  it('неизвестный термин — ошибка', () => {
    expect(() => findTerm(entries, 'missing')).toThrow(/Неизвестный термин/);
  });
});
