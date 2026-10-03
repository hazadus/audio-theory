// Проверяет модель и тексты визуализации форм LFO: значения форм, перенос фазы, анимацию,
// угол по точке на окружности, расчёты и разметку курсора.
import { describe, expect, it } from 'vitest';
import { advance, angleFromPoint, cyclePart, defaultPhase, lfoValues, wrapPhase } from '@/lib/lfo';
import {
  cursorMarkup,
  fixed,
  formulaHtml,
  lfoAnnouncement,
  lfoChartSvg,
  lfoCircleSvg,
  lfoStatus,
  phasePosition,
  phaseText,
  valuePosition,
} from '@/lib/lfo-view';

describe('lfoValues', () => {
  it('в начале цикла: синусоида 0, остальные −1', () => {
    expect(lfoValues(-180)).toEqual({ sine: 0, triangle: -1, square: -1, saw: -1 });
  });

  it('в середине цикла: треугольник и прямоугольник +1, синусоида и пила 0', () => {
    expect(lfoValues(0)).toEqual({ sine: 0, triangle: 1, square: 1, saw: 0 });
  });

  it('в четвертях цикла совпадает с формулами статьи', () => {
    const quarter = lfoValues(-90);
    expect(quarter.sine).toBeCloseTo(-1, 12);
    expect(quarter.triangle).toBeCloseTo(0, 12);
    expect(quarter.square).toBe(-1);
    expect(quarter.saw).toBeCloseTo(-0.5, 12);
    const threeQuarters = lfoValues(90);
    expect(threeQuarters.sine).toBeCloseTo(1, 12);
    expect(threeQuarters.triangle).toBeCloseTo(0, 12);
    expect(threeQuarters.square).toBe(1);
    expect(threeQuarters.saw).toBeCloseTo(0.5, 12);
  });

  it('все значения лежат в [−1, 1], пила не достигает +1 до переноса', () => {
    for (let degrees = -180; degrees < 180; degrees += 1) {
      for (const value of Object.values(lfoValues(degrees))) {
        expect(Math.abs(value)).toBeLessThanOrEqual(1);
      }
    }
    expect(lfoValues(179).saw).toBeLessThan(1);
  });
});

describe('wrapPhase', () => {
  it('переносит фазу в [−180, 180) с сохранением избытка', () => {
    expect(wrapPhase(180)).toBe(-180);
    expect(wrapPhase(181)).toBe(-179);
    expect(wrapPhase(-181)).toBe(179);
    expect(wrapPhase(540)).toBe(-180);
    expect(wrapPhase(-45.4)).toBe(-45);
  });

  it('нечисловой ввод возвращает начальное состояние', () => {
    expect(wrapPhase(Number.NaN)).toBe(defaultPhase);
  });
});

describe('advance', () => {
  it('делает оборот за 4 с и переносит фазу', () => {
    expect(advance(-180, 1000)).toBeCloseTo(-90, 9);
    expect(advance(170, 1000)).toBeCloseTo(-100, 9);
    expect(advance(0, 4000)).toBeCloseTo(0, 9);
  });
});

describe('angleFromPoint', () => {
  it('отсчитывает угол против часовой стрелки при оси y экрана вниз', () => {
    expect(angleFromPoint(1, 0)).toBe(0);
    expect(angleFromPoint(0, -1)).toBe(90);
    expect(angleFromPoint(0, 1)).toBe(-90);
    expect(wrapPhase(angleFromPoint(-1, 0))).toBe(-180);
    expect(angleFromPoint(1, 1)).toBeCloseTo(-45, 12);
  });

  it('центр окружности не задаёт угол', () => {
    expect(angleFromPoint(0, 0)).toBeNaN();
  });
});

describe('cyclePart', () => {
  it('различает начало, половины и середину цикла', () => {
    expect(cyclePart(-180)).toBe('start');
    expect(cyclePart(-1)).toBe('rising');
    expect(cyclePart(0)).toBe('middle');
    expect(cyclePart(179)).toBe('falling');
  });
});

describe('тексты', () => {
  it('fixed пишет запятую и «−», без «−0»', () => {
    expect(fixed(-0.7071, 2)).toBe('−0,71');
    expect(fixed(0.5, 2)).toBe('0,50');
    expect(fixed(-0.001, 2)).toBe('0,00');
  });

  it('phaseText показывает градусы и радианы', () => {
    expect(phaseText(-45)).toBe('−45° (−0,785 рад)');
    expect(phaseText(0)).toBe('0° (0,000 рад)');
  });

  it('расчёты подставляют фазу и дают значения формул', () => {
    expect(formulaHtml('sine', -45)).toBe('sin <i>φ</i> = sin(−0,785) ≈ −0,71');
    expect(formulaHtml('triangle', -45)).toBe('1 − 2|<i>φ</i>|/π = 1 − 2·0,785/π ≈ 0,50');
    expect(formulaHtml('square', -45)).toBe('<i>φ</i> = −0,785 &lt; 0 → −1');
    expect(formulaHtml('square', 0)).toBe('<i>φ</i> = 0,000 ≥ 0 → +1');
    expect(formulaHtml('saw', -45)).toBe('<i>φ</i>/π = −0,785/π ≈ −0,25');
  });

  it('при φ = 0 подстановка точна и пишется через «=»', () => {
    expect(formulaHtml('sine', 0)).toBe('sin <i>φ</i> = sin(0,000) = 0,00');
    expect(formulaHtml('triangle', 0)).toBe('1 − 2|<i>φ</i>|/π = 1 − 2·0,000/π = 1,00');
  });

  it('статус и объявление называют фазу и значения', () => {
    expect(lfoStatus(-45).title).toBe('φ = −45° (−0,785 рад).');
    expect(lfoStatus(-45).text).toMatch(/Первая половина/);
    expect(lfoStatus(0).text).toMatch(/Середина/);
    expect(lfoAnnouncement(-90)).toBe(
      'φ = −90° (−1,571 рад). Значения: синусоида −1,00, треугольник 0,00, прямоугольник −1, пила −0,50.',
    );
  });
});

describe('разметка', () => {
  it('курсор стоит на фазе, отметка — на значении формы', () => {
    expect(phasePosition(-180)).toBe(0);
    expect(phasePosition(0)).toBe(50);
    expect(cursorMarkup('triangle', 0)).toContain(`cx="50%" cy="${valuePosition(1)}%"`);
  });

  it('графики и окружность без NaN и с доступными названиями', () => {
    for (const degrees of [-180, -45, 0, 90, 179]) {
      const chart = lfoChartSvg('saw', degrees, 'demo');
      const circle = lfoCircleSvg(degrees, 'demo');
      expect(chart).not.toMatch(/NaN/);
      expect(circle).not.toMatch(/NaN/);
      expect(chart).toContain('aria-labelledby="demo-saw-title demo-saw-desc"');
      expect(circle).toContain('<desc id="demo-circle-desc">');
    }
  });

  it('у прямоугольника и пилы есть пунктир скачка, у синусоиды и треугольника — нет', () => {
    expect(lfoChartSvg('square', 0, 'd')).toContain('lfo-demo-jump');
    expect(lfoChartSvg('saw', 0, 'd')).toContain('lfo-demo-jump');
    expect(lfoChartSvg('sine', 0, 'd')).not.toContain('lfo-demo-jump');
    expect(lfoChartSvg('triangle', 0, 'd')).not.toContain('lfo-demo-jump');
  });
});
