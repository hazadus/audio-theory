// Проверяет модель и тексты визуализации вращающегося вектора: точку e^{j(2πft + φ)},
// перенос угла, отрицательные частоты, сетку параметров, анимацию, расчёт и разметку.
import { describe, expect, it } from 'vitest';
import {
  advance,
  defaultState,
  normalizeFrequency,
  normalizePhase,
  normalizeTime,
  phasorPoint,
  rotation,
  wrapAngle,
} from '@/lib/phasor';
import {
  angleFormula,
  complexText,
  cursorMarkup,
  partChartSvg,
  partFormulaHtml,
  partPath,
  phasorAnnouncement,
  phasorStatus,
  planeMarkup,
  planeSvg,
  timePosition,
  valuePosition,
} from '@/lib/phasor-view';

describe('phasorPoint', () => {
  it('в начальном состоянии z = e^{jπ/4} ≈ 0,71 + j0,71', () => {
    const point = phasorPoint(defaultState.frequency, defaultState.phase, defaultState.time);
    expect(point.re).toBeCloseTo(Math.SQRT1_2, 12);
    expect(point.im).toBeCloseTo(Math.SQRT1_2, 12);
    expect(point.wrapped).toBeCloseTo(Math.PI / 4, 12);
  });

  it('модуль всегда равен 1, части — косинус и синус полного угла', () => {
    for (const frequency of [-2, -0.75, 0, 0.5, 1.25, 2]) {
      for (const time of [0, 0.13, 0.5, 1.99]) {
        const point = phasorPoint(frequency, 30, time);
        expect(Math.hypot(point.re, point.im)).toBeCloseTo(1, 12);
        expect(point.re).toBeCloseTo(Math.cos(2 * Math.PI * frequency * time + Math.PI / 6), 12);
        expect(point.im).toBeCloseTo(Math.sin(2 * Math.PI * frequency * time + Math.PI / 6), 12);
      }
    }
  });

  it('за четверть периода вектор поворачивается на π/2 по знаку частоты', () => {
    expect(phasorPoint(1, 0, 0.25).im).toBeCloseTo(1, 12);
    expect(phasorPoint(-1, 0, 0.25).im).toBeCloseTo(-1, 12);
    expect(phasorPoint(1, 0, 0.25).re).toBe(0);
  });

  it('частоты f и −f при нулевой фазе дают одинаковую вещественную и противоположную мнимую часть', () => {
    for (const time of [0.1, 0.37, 1.2]) {
      const plus = phasorPoint(0.75, 0, time);
      const minus = phasorPoint(-0.75, 0, time);
      expect(minus.re).toBeCloseTo(plus.re, 12);
      expect(minus.im).toBeCloseTo(-plus.im, 12);
    }
  });

  it('вещественная часть при −f и φ совпадает с частотой +f и фазой −φ', () => {
    for (const time of [0.2, 0.9, 1.55]) {
      expect(phasorPoint(-1.5, 60, time).re).toBeCloseTo(phasorPoint(1.5, -60, time).re, 12);
    }
  });
});

describe('wrapAngle', () => {
  it('приводит угол к [−π, π)', () => {
    expect(wrapAngle(Math.PI)).toBeCloseTo(-Math.PI, 12);
    expect(wrapAngle(3 * Math.PI)).toBeCloseTo(-Math.PI, 12);
    expect(wrapAngle(-Math.PI)).toBeCloseTo(-Math.PI, 12);
    expect(wrapAngle((5 * Math.PI) / 2)).toBeCloseTo(Math.PI / 2, 12);
    expect(wrapAngle(-0)).toBe(0);
  });
});

describe('нормализация параметров', () => {
  it('частота: шаг 0,25 Гц в [−2, 2]', () => {
    expect(normalizeFrequency(0.6)).toBe(0.5);
    expect(normalizeFrequency(-0.13)).toBe(-0.25);
    expect(normalizeFrequency(5)).toBe(2);
    expect(normalizeFrequency(-0.1)).toBe(0);
    expect(Object.is(normalizeFrequency(-0.1), -0)).toBe(false);
    expect(normalizeFrequency(Number.NaN)).toBe(defaultState.frequency);
  });

  it('фаза: целые градусы с переносом через оборот', () => {
    expect(normalizePhase(180)).toBe(-180);
    expect(normalizePhase(-181)).toBe(179);
    expect(normalizePhase(44.6)).toBe(45);
  });

  it('время: сотые доли секунды в окне [0, 2)', () => {
    expect(normalizeTime(0.304)).toBe(0.3);
    expect(normalizeTime(2)).toBe(0);
    expect(normalizeTime(2.15)).toBe(0.15);
    expect(normalizeTime(-0.01)).toBe(1.99);
  });

  it('направление вращения по знаку частоты', () => {
    expect(rotation(0.25)).toBe('counterclockwise');
    expect(rotation(-0.25)).toBe('clockwise');
    expect(rotation(0)).toBe('still');
  });
});

describe('advance', () => {
  it('идёт в реальном времени и повторяет окно 2 с', () => {
    expect(advance(0.5, 250)).toBeCloseTo(0.75, 12);
    expect(advance(1.9, 200)).toBeCloseTo(0.1, 12);
  });
});

describe('тексты', () => {
  it('алгебраическая форма со знаком мнимой части', () => {
    expect(complexText(0.7071, 0.7071)).toBe('0,71 + j0,71');
    expect(complexText(-1, -0.5)).toBe('−1,00 − j0,50');
    expect(complexText(1, -0.001)).toBe('1,00 + j0,00');
  });

  it('расчёт угла: подстановка и перенос в [−π, π)', () => {
    expect(angleFormula(defaultState)).toBe('θ = 2π·0,5·0,00 + 0,785 ≈ 0,785 рад');
    expect(angleFormula({ frequency: -1, phase: -90, time: 0.5 })).toBe(
      'θ = 2π·(−1)·0,50 − 1,571 → 1,571 рад',
    );
  });

  it('проекции над графиками', () => {
    expect(partFormulaHtml('re', defaultState)).toBe('Re <i>z</i> = cos <i>θ</i> ≈ 0,71');
    expect(partFormulaHtml('im', { frequency: 0, phase: 90, time: 0 })).toBe(
      'Im <i>z</i> = sin <i>θ</i> = 1,00',
    );
  });

  it('статус называет направление, число оборотов и период', () => {
    expect(phasorStatus(defaultState)).toEqual({
      title: 'z ≈ 0,71 + j0,71.',
      text: 'Положительная частота: вектор вращается против часовой стрелки, 0,5 оборота в секунду, период 2 с. Мнимая часть — синусоида, вещественная — косинусоида той же частоты.',
    });
    const negative = phasorStatus({ frequency: -1, phase: 0, time: 0 }).text;
    expect(negative).toContain('по часовой стрелке, 1 оборот в секунду, период 1 с');
    expect(negative).toContain('при частоте +1 Гц и фазе −φ');
    expect(phasorStatus({ frequency: 0.75, phase: 0, time: 0 }).text).toContain('период ≈ 1,33 с');
    expect(phasorStatus({ frequency: 0, phase: 0, time: 0 }).text).toContain('стоит на месте');
  });

  it('объявление содержит параметры и значение z', () => {
    expect(phasorAnnouncement(defaultState)).toBe(
      'f = 0,5 Гц, φ = 45° (0,785 рад), t = 0,00 с. θ ≈ 0,785 рад, z ≈ 0,71 + j0,71.',
    );
  });
});

describe('разметка', () => {
  it('положения на графике', () => {
    expect(timePosition(0)).toBe(0);
    expect(timePosition(1)).toBe(50);
    expect(valuePosition(1)).toBe(10);
    expect(valuePosition(-1)).toBe(90);
  });

  it('линия проекции начинается с текущего значения и занимает окно 2 с', () => {
    const path = partPath('im', 0.5, 90);
    expect(path.startsWith('M0 25')).toBe(true);
    expect(path).toMatch(/L200 25$/);
  });

  it('курсор стоит в момент t, точка — на значении проекции', () => {
    const markup = cursorMarkup('re', { frequency: 0.5, phase: 0, time: 1 });
    expect(markup).toContain('x1="50%"');
    expect(markup).toContain('cy="90%"');
  });

  it('стрелка направления есть только у вращающегося вектора', () => {
    expect(planeMarkup(defaultState)).toContain('phasor-demo-arrow');
    expect(planeMarkup({ ...defaultState, frequency: 0 })).not.toContain('phasor-demo-arrow');
  });

  it('графики и плоскость имеют название и описание', () => {
    const chart = partChartSvg('re', defaultState, 'demo');
    expect(chart).toContain('role="img"');
    expect(chart).toContain(
      '<title id="demo-re-title">Вещественная часть вектора во времени</title>',
    );
    const plane = planeSvg(defaultState, 'demo');
    expect(plane).toContain('aria-labelledby="demo-plane-title demo-plane-desc"');
    expect(plane).toContain('0,71 + j0,71');
  });
});
