// Проверяет представление эксперимента дискретизации: числа, статус, подпись, описание и геометрию графика.
import { describe, expect, it } from 'vitest';
import { defaultSampleRate, samplingExperiment, sourceValue } from '@/lib/sampling';
import {
  chartDescription,
  chartTitle,
  formatNumber,
  plural,
  samplingCaption,
  samplingChart,
  samplingStatus,
  showsAlias,
} from '@/lib/sampling-view';

const nbsp = ' ';
const plain = (text: string) => text.replaceAll(nbsp, ' ');

describe('formatNumber', () => {
  it('разделяет разряды неразрывным пробелом, в том числе в четырёхзначных числах', () => {
    expect(formatNumber(8000)).toBe(`8${nbsp}000`);
    expect(formatNumber(16000)).toBe(`16${nbsp}000`);
    expect(formatNumber(1234567)).toBe(`1${nbsp}234${nbsp}567`);
    expect(formatNumber(800)).toBe('800');
  });

  it('пишет дробную часть через запятую без лишних нулей и минус «−»', () => {
    expect(formatNumber(666.6667, 1)).toBe('666,7');
    expect(formatNumber(125, 1)).toBe('125');
    expect(formatNumber(-0.5, 1)).toBe('−0,5');
    expect(formatNumber(-0.01, 1)).toBe('0');
  });
});

describe('plural', () => {
  it('склоняет «отсчёт» по числу', () => {
    const word = (n: number) => plural(n, 'отсчёт', 'отсчёта', 'отсчётов');
    expect([1, 2, 4, 5, 11, 12, 21, 22, 25].map(word)).toEqual([
      'отсчёт',
      'отсчёта',
      'отсчёта',
      'отсчётов',
      'отсчётов',
      'отсчётов',
      'отсчёт',
      'отсчёта',
      'отсчётов',
    ]);
    expect(word(1.5)).toBe('отсчёта');
  });
});

describe('начальное состояние 8 000 Гц', () => {
  const experiment = samplingExperiment(defaultSampleRate);

  it('подпись перечисляет условия и совпадает с расчётом', () => {
    expect(plain(samplingCaption(experiment))).toBe(
      'Синусоида f = 1 кГц на интервале 0–\u20603 мс; fₛ = 8 000 Гц, Tₛ = 125 мкс, 25 отсчётов.',
    );
  });

  it('статус: fₛ > 2f, 8 отсчётов на период', () => {
    const status = samplingStatus(experiment);
    expect(status.tone).toBe('success');
    expect(status.title).toBe('fₛ > 2f.');
    expect(plain(status.text)).toBe(
      '8 отсчётов на период — синусоида восстанавливается однозначно.',
    );
  });

  it('название и описание SVG называют параметры и число отсчётов', () => {
    expect(plain(chartTitle(experiment))).toBe(
      'Отсчёты синусоиды 1 кГц при частоте дискретизации 8 000 Гц',
    );
    const description = plain(chartDescription(experiment, true));
    expect(description).toContain('от 0 до 3 мс');
    expect(description).toContain('25 отсчётов через каждые 125 мкс');
    expect(description).not.toContain('Пунктир');
  });

  it('видимая синусоида не показывается: наложения нет', () => {
    expect(showsAlias(experiment, true)).toBe(false);
    expect(samplingChart(experiment, true).resultPath).toBe('');
  });
});

describe('статус и подпись в других состояниях', () => {
  it('1,5 кГц: наложение, 500 Гц с противоположным знаком, дробный период', () => {
    const experiment = samplingExperiment(1500);
    const status = samplingStatus(experiment);
    expect(status.tone).toBe('error');
    expect(plain(status.text)).toBe(
      'Отсчёты совпадают с синусоидой 500 Гц с противоположным знаком.',
    );
    expect(plain(samplingCaption(experiment))).toContain('Tₛ = 666,7 мкс, 5 отсчётов');
    expect(plain(chartDescription(experiment, true))).toContain(
      'Пунктир — синусоида 500 Гц с противоположным знаком',
    );
    expect(plain(chartDescription(experiment, false))).not.toContain('Пунктир');
  });

  it('2 кГц: граница, без обещания восстановления', () => {
    const experiment = samplingExperiment(2000);
    const status = samplingStatus(experiment);
    expect(status.tone).toBe('warning');
    expect(status.title).toBe('fₛ = 2f.');
    expect(status.text).toContain('нельзя восстановить однозначно');
    expect(showsAlias(experiment, true)).toBe(false);
    expect(chartDescription(experiment, true)).toContain('Все отсчёты лежат на нулевой линии.');
  });

  it('1 кГц: постоянный нулевой сигнал', () => {
    const experiment = samplingExperiment(1000);
    expect(plain(samplingStatus(experiment).text)).toContain('постоянным нулевым сигналом (0 Гц)');
    expect(showsAlias(experiment, true)).toBe(true);
    expect(chartDescription(experiment, true)).toContain('постоянный нулевой сигнал');
  });

  it('статус выше Найквиста называет частоту, ниже — пишет дробное число отсчётов с запятой', () => {
    expect(plain(samplingStatus(samplingExperiment(1100)).text)).toBe(
      'Отсчёты совпадают с синусоидой 100 Гц с противоположным знаком.',
    );
    expect(plain(samplingStatus(samplingExperiment(2500)).text)).toBe(
      '2,5 отсчёта на период — синусоида восстанавливается однозначно.',
    );
  });
});

describe('samplingChart', () => {
  /** Обратное преобразование: процент от верха области → значение сигнала. */
  const valueAt = (percent: number) => 1.25 - (percent / 100) * 2.5;

  it('маркеры отсчётов стоят в моменты и на значениях модели', () => {
    for (const rate of [1000, 1500, 2000, 8000, 16000]) {
      const experiment = samplingExperiment(rate);
      const chart = samplingChart(experiment, true);
      expect(chart.samples).toHaveLength(experiment.samples.length);
      chart.samples.forEach((point, i) => {
        const sample = experiment.samples[i];
        expect(point.x).toBeCloseTo((sample.time / 0.003) * 100, 3);
        expect(valueAt(point.y)).toBeCloseTo(sample.value, 4);
      });
    }
  });

  it('нулевая линия посередине, значения ±1 на 10 % и 90 %', () => {
    const chart = samplingChart(samplingExperiment(8000), true);
    expect(chart.zero).toBe(50);
    expect(chart.yTicks.filter((tick) => !tick.minor).map((tick) => tick.position)).toEqual([
      10, 50, 90,
    ]);
  });

  it('линия сигнала проходит через исходную синусоиду в координатах viewBox', () => {
    const chart = samplingChart(samplingExperiment(8000), true);
    expect(chart.viewBox).toBe('0 0 3000 2500');
    const points = [...chart.signalPath.matchAll(/[ML]([\d.]+) ([\d.]+)/g)].map((m) => [
      Number(m[1]),
      Number(m[2]),
    ]);
    expect(points).toHaveLength(401);
    for (const [x, y] of points) {
      expect(1.25 - y / 1000).toBeCloseTo(sourceValue(1000, x / 1e6), 3);
    }
  });

  it('видимая синусоида при 1,5 кГц проходит через все отсчёты', () => {
    const experiment = samplingExperiment(1500);
    const chart = samplingChart(experiment, true);
    expect(chart.resultPath).not.toBe('');
    const points = new Map(
      [...chart.resultPath.matchAll(/[ML]([\d.]+) ([\d.]+)/g)].map((m) => [
        Number(m[1]),
        1.25 - Number(m[2]) / 1000,
      ]),
    );
    for (const sample of experiment.samples) {
      const x = Number((sample.time * 1e6).toFixed(1));
      if (points.has(x)) expect(points.get(x)).toBeCloseTo(sample.value, 3);
    }
    expect(samplingChart(experiment, false).resultPath).toBe('');
  });

  it('деления времени: 0, 1, 2, 3 мс основные, половины — второстепенные', () => {
    const ticks = samplingChart(samplingExperiment(8000), true).xTicks;
    expect(ticks.filter((tick) => !tick.minor).map((tick) => plain(tick.label))).toEqual([
      '0',
      '1',
      '2',
      '3 мс',
    ]);
    expect(ticks.filter((tick) => tick.minor).map((tick) => tick.label)).toEqual([
      '0,5',
      '1,5',
      '2,5',
    ]);
    // На узком графике остаётся не больше пяти делений по каждой оси.
    expect(ticks.filter((tick) => !tick.minor).length).toBeLessThanOrEqual(5);
  });
});
