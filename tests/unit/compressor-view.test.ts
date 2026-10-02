// Проверяет представление визуализации компрессора: записи чисел, статус, подпись, параметры ползунков
// и разметку обоих графиков.
import { describe, expect, it } from 'vitest';
import { attackSteps, defaultSettings, ratioSteps } from '@/lib/compressor';
import {
  compressorCaption,
  compressorPlayLabel,
  compressorStateText,
  compressorStatus,
  compressorView,
  curveOutput,
  curveSvg,
  dbText,
  dbfsText,
  msText,
  parameterSpecs,
  ratioText,
  sliderFill,
  timeSvg,
} from '@/lib/compressor-view';

const plain = (text: string) => text.replaceAll(' ', ' ');
const spec = (key: string) => parameterSpecs.find((item) => item.key === key)!;

describe('записи чисел', () => {
  it('децибелы, степень сжатия и время', () => {
    expect(plain(dbText(-16.4123))).toBe('−16,4 дБ');
    expect(plain(dbText(6, 0))).toBe('6 дБ');
    expect(plain(dbfsText(-24, 0))).toBe('−24 dBFS');
    expect(ratioText(4)).toBe('4:1');
    expect(ratioText(1.5)).toBe('1,5:1');
    expect(ratioText(Infinity)).toBe('∞:1');
    expect(plain(msText(0.1))).toBe('0,1 мс');
    expect(plain(msText(1000))).toBe('1 000 мс');
  });
});

describe('статус и подпись', () => {
  it('начальное состояние называет разброс пиков и подавление', () => {
    const { status } = compressorView(defaultSettings);
    expect(plain(status.title)).toBe('Разброс пиков: 24 дБ на входе, 7,7 дБ на выходе.');
    expect(plain(status.text)).toContain('Наибольшее подавление усиления — 16,4 дБ');
    expect(status.warning).toBe(false);
  });

  it('без сжатия статус говорит, что уровень не меняется', () => {
    const { status } = compressorView({ ...defaultSettings, ratio: 1 });
    expect(status.text).toContain('не меняет уровень');
  });

  it('перегрузка — предупреждение', () => {
    const { summary } = compressorView({ ...defaultSettings, makeup: 24 });
    const status = compressorStatus(summary);
    expect(status.warning).toBe(true);
    expect(status.text).toContain('выше 0 dBFS обрезается');
  });

  it('подпись перечисляет все параметры и условия примера', () => {
    const caption = plain(compressorCaption(defaultSettings));
    for (const part of [
      'порогом −24 dBFS',
      'степенью сжатия 4:1',
      'коленом 6 дБ',
      'атакой 1 мс',
      'восстановлением 100 мс',
      'компенсацией 0 дБ',
      'пиками −2, −16, −8, −26 dBFS',
    ]) {
      expect(caption).toContain(part);
    }
  });
});

describe('параметры ползунков', () => {
  it('неравномерные шкалы переводят положение в значение и обратно', () => {
    const ratio = spec('ratio');
    expect(ratio.max).toBe(ratioSteps.length - 1);
    expect(ratio.value(ratio.max)).toBe(Infinity);
    expect(ratio.position(4)).toBe(ratioSteps.indexOf(4));
    expect(ratio.value(ratio.position(4))).toBe(4);
    const attack = spec('attack');
    expect(attack.value(0)).toBe(attackSteps[0]);
    expect(attack.text(attack.value(attack.max))).toBe('100 мс');
  });

  it('заливка ползунка — доля шкалы', () => {
    expect(sliderFill(spec('threshold'), -60)).toBe(0);
    expect(sliderFill(spec('threshold'), 0)).toBe(100);
    expect(sliderFill(spec('makeup'), 12)).toBe(50);
  });

  it('у каждого параметра есть подписи краёв шкалы', () => {
    expect(parameterSpecs.map((item) => item.key)).toEqual([
      'threshold',
      'ratio',
      'knee',
      'attack',
      'release',
      'makeup',
    ]);
    expect(spec('ratio').scale).toEqual(['1:1', '∞:1']);
  });
});

describe('графики', () => {
  it('характеристика ограничена полной шкалой', () => {
    expect(curveOutput(-2, { ...defaultSettings, ratio: 1, makeup: 12 })).toBe(0);
    expect(curveOutput(-30, defaultSettings)).toBe(-30);
  });

  it('разметка содержит название, описание, линии и точки пиков', () => {
    const { track, summary } = compressorView(defaultSettings);
    const curve = curveSvg(defaultSettings, summary, 'demo');
    expect(curve).toContain('role="img"');
    expect(curve).toContain('aria-labelledby="demo-curve-title demo-curve-desc"');
    expect(curve.match(/compressor-demo-dot/g)).toHaveLength(4);
    expect(curve).toContain('compressor-demo-knee');
    expect(curveSvg({ ...defaultSettings, knee: 0 }, summary, 'demo')).not.toContain(
      'compressor-demo-knee',
    );

    const time = timeSvg(defaultSettings, track, summary, 'demo');
    expect(time).toContain('aria-labelledby="demo-time-title demo-time-desc"');
    expect(time).toContain('compressor-demo-input');
    expect(time).toContain('compressor-demo-output');
    expect(time).toContain('compressor-demo-gain');
    expect(plain(time)).toContain('удар 1: −2 dBFS → −18,3 dBFS');
  });
});

describe('плеер', () => {
  it('имя кнопки и строка состояния', () => {
    expect(compressorPlayLabel('playing')).toBe('Остановить');
    expect(compressorPlayLabel('ready')).toBe('Воспроизвести');
    expect(compressorStateText('playing', 'wet')).toBe('Звучит результат компрессора');
    expect(compressorStateText('playing', 'dry')).toBe('Звучит исходный сигнал');
    expect(compressorStateText('unavailable', 'wet')).toContain('Звук недоступен');
  });
});
