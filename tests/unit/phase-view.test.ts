// Проверяет представление визуализации фазы: записи значений, статус, подпись, описания и разметку SVG.
import { describe, expect, it } from 'vitest';
import {
  chartDescription,
  circleDescription,
  phaseCaption,
  phaseChartSvg,
  phaseCircleSvg,
  phaseStatus,
  phaseText,
  radiansText,
  shiftExact,
  shiftText,
  turnFraction,
} from '@/lib/phase-view';

const plain = (text: string) => text.replaceAll('\u00a0', ' ').replaceAll('\u2060', '');

describe('записи фазы', () => {
  it('доля оборота и радианы — несократимые дроби', () => {
    expect([0, 15, 90, 180, 270, 360].map(turnFraction)).toEqual([
      '0',
      '1/24',
      '1/4',
      '1/2',
      '3/4',
      '1',
    ]);
    expect([0, 15, 90, 180, 270, 360].map(radiansText)).toEqual([
      '0',
      'π/12',
      'π/2',
      'π',
      '3π/2',
      '2π',
    ]);
    expect(plain(phaseText(90))).toBe('90° (π/2 рад)');
  });

  it('Δt округляется до тысячных миллисекунды, неточное значение отмечено «≈»', () => {
    expect(plain(shiftText(90))).toBe('0,25 мс');
    expect(plain(shiftText(45))).toBe('0,125 мс');
    expect(plain(shiftText(15))).toBe('0,042 мс');
    expect([90, 45, 360].every(shiftExact)).toBe(true);
    expect(shiftExact(15)).toBe(false);
    expect(plain(phaseStatus(15).text)).toBe(
      'Пунктир опережает сплошную линию на Δt = 1/24 T ≈ 0,042 мс.',
    );
  });
});

describe('phaseStatus', () => {
  it('описывает совпадение, опережение, противофазу и полный оборот', () => {
    expect(phaseStatus(0)).toEqual({ title: 'φ = 0°.', text: 'Синусоиды совпадают: сдвига нет.' });
    expect(plain(phaseStatus(90).text)).toBe(
      'Пунктир опережает сплошную линию на Δt = 1/4 T = 0,25 мс.',
    );
    expect(plain(phaseStatus(180).text)).toMatch(/^Противофаза: Δt = 1\/2 T = 0,5 мс\./);
    expect(plain(phaseStatus(360).text)).toBe(
      'Полный оборот: сдвиг на целый период, Δt = T = 1 мс. Синусоиды снова совпадают.',
    );
  });
});

describe('подпись и описания', () => {
  it('подпись перечисляет условия начального состояния', () => {
    expect(plain(phaseCaption(90))).toBe(
      'Две синусоиды f = 1 кГц (T = 1 мс) на интервале 0–2 мс: опорная с φ = 0° и сдвинутая с φ = 90° (π/2 рад), Δt = 1/4 T = 0,25 мс. На окружности та же фаза показана углом вектора.',
    );
  });

  it('описание графика называет положение отрезка Δt, при φ = 0 отрезка нет', () => {
    expect(plain(chartDescription(90))).toContain('максимум пунктира в 1 мс');
    expect(plain(chartDescription(90))).toContain('сплошной линии в 1,25 мс');
    expect(chartDescription(0)).not.toContain('Δt');
  });

  it('описание окружности даёт значения синусоид в момент t = 0', () => {
    expect(circleDescription(90)).toContain('0 у опорной, 1 у сдвинутой');
    expect(circleDescription(180)).toContain('0 у опорной, 0 у сдвинутой');
    expect(circleDescription(270)).toContain('−1 у сдвинутой');
  });
});

describe('разметка SVG', () => {
  it('график: две линии, маркеры в t = 0 и отрезок Δt только при сдвиге', () => {
    const svg = phaseChartSvg(90, 'demo');
    expect(svg).toContain('aria-labelledby="demo-chart-title demo-chart-desc"');
    expect(svg.match(/class="phase-demo-(reference|shifted)" d=/g)).toHaveLength(2);
    expect(svg.match(/class="phase-demo-dot /g)).toHaveLength(2);
    expect(svg).toContain('class="phase-demo-span"');
    expect(phaseChartSvg(0, 'demo')).not.toContain('phase-demo-span');
  });

  it('окружность: конец вектора под углом φ, дуга угла и полный оборот', () => {
    expect(phaseCircleSvg(90, 'demo')).toContain('x2="0" y2="-1"');
    expect(phaseCircleSvg(180, 'demo')).toContain('x2="-1" y2="0"');
    expect(phaseCircleSvg(90, 'demo')).toContain('<path class="phase-demo-arc"');
    expect(phaseCircleSvg(0, 'demo')).not.toContain('phase-demo-arc');
    expect(phaseCircleSvg(360, 'demo')).toContain('<circle class="phase-demo-arc"');
  });

  it('название окружности — текст без разметки', () => {
    expect(phaseCircleSvg(90, 'demo')).toMatch(/<title id="demo-circle-title">[^<]+<\/title>/);
  });
});
