// Подписи и адаптивная геометрия вводных опытов; кегль SVG сохраняется при изменении ширины.
import {
  adsrValue,
  introDuration,
  introLfo,
  introShapeNames,
  introTargets,
  keyUpTime,
  oscillatorPlotValue,
  targetValue,
  type IntroMode,
  type IntroParameters,
} from '@/lib/intro-sound';
export const introNames: Record<IntroMode, string> = {
  tone: 'Звук: выше, ниже, громче, тише',
  oscillator: 'Осциллятор: форма и звучание',
  envelope: 'ADSR: начало и конец ноты',
  lfo: 'LFO: движение звука',
};
export const introIds: Record<IntroMode, string> = {
  tone: 'intro-tone',
  oscillator: 'intro-oscillator',
  envelope: 'intro-envelope',
  lfo: 'intro-lfo',
};
export const numberText = (value: number, digits = 0) =>
  value.toLocaleString('ru-RU', { maximumFractionDigits: digits });
export function parameterText(key: string, value: number): string {
  if (['amplitude', 'sustain', 'width', 'depth', 'volume'].includes(key))
    return `${numberText(value * 100)} %`;
  if (['attack', 'decay', 'release'].includes(key)) return `${numberText(value, 2)} с`;
  if (['frequency', 'rate'].includes(key)) return `${numberText(value, 1)} Гц`;
  if (key === 'detune') return `${numberText(value)} центов`;
  return `${value > 0 ? '+' : ''}${numberText(value)} окт.`;
}
export function introCaption(mode: IntroMode, p: IntroParameters): string {
  switch (mode) {
    case 'tone':
      return `Тон ${numberText(p.frequency)} Гц, амплитуда ${numberText(p.amplitude * 100)} %. Полосы условно показывают сжатия воздуха, кривая — изменение давления за 10 мс.`;
    case 'oscillator':
      return `${introShapeNames[p.shape]}, ${numberText(p.frequency * 2 ** p.octave)} Гц. На графике два цикла${p.shape === 'supersaw' ? ' центральной пилы; остальные шесть слегка расстроены' : ''}${p.shape === 'square' ? `, заполнение ${numberText(p.width * 100)} %${p.pwm ? ' меняется автоматически' : ''}` : ''}.`;
    case 'envelope':
      return `Линейная огибающая усиления: A ${parameterText('attack', p.attack)}, D ${parameterText('decay', p.decay)}, S ${parameterText('sustain', p.sustain)}, R ${parameterText('release', p.release)}. После A и D клавиша удерживается ещё 1 с; затем отпускается.`;
    case 'lfo':
      return `${introShapeNames[p.shape]}, ${parameterText('rate', p.rate)}, глубина ${parameterText('depth', p.depth)}. Цель: ${introTargets[p.target].toLowerCase()}. Два цикла управляющей волны; точка следует за прослушиванием.`;
  }
}
export function targetReadout(p: IntroParameters, time: number): string {
  const value = targetValue(p, introLfo(p, time));
  switch (p.target) {
    case 'volume':
      return `Усиление: ${numberText(value * 100)} %`;
    case 'pitch':
      return `Частота тона: ${numberText(value)} Гц`;
    case 'filter':
      return `Частота среза: ${numberText(value)} Гц`;
    case 'pan':
      return value === 0
        ? 'Панорама: центр'
        : `Панорама: ${numberText(Math.abs(value) * 100)} % ${value < 0 ? 'влево' : 'вправо'}`;
  }
}
export function introChart(mode: IntroMode, p: IntroParameters, width = 640, time = 0): string {
  const w = Math.max(240, Math.round(width));
  const x0 = 18,
    x1 = w - 18,
    y0 = mode === 'tone' ? 76 : 30,
    y1 = 160;
  const mid = (y0 + y1) / 2;
  const span =
    mode === 'tone'
      ? 0.01
      : mode === 'envelope'
        ? introDuration(mode, p)
        : mode === 'lfo'
          ? 2 / p.rate
          : 2;
  const x = (t: number) => x0 + ((x1 - x0) * t) / span;
  const y = (value: number) =>
    mode === 'envelope' ? y1 - (y1 - y0) * value : mid - ((y1 - y0) / 2) * value;
  let path = '';
  for (let i = 0; i <= 400; i++) {
    const t = (i / 400) * span;
    const v =
      mode === 'tone'
        ? p.amplitude * Math.sin(2 * Math.PI * p.frequency * (t + time))
        : mode === 'envelope'
          ? adsrValue(p, t)
          : mode === 'lfo'
            ? introLfo(p, t)
            : oscillatorPlotValue(p, t, time);
    path += `${i ? 'L' : 'M'}${x(t).toFixed(2)} ${y(v).toFixed(2)}`;
  }
  let extra = '';
  if (mode === 'tone') {
    for (let i = 0; i < 70; i++) {
      const t = (i / 69) * span;
      const density = (1 + Math.sin(2 * Math.PI * p.frequency * (t + time))) / 2;
      extra += `<rect x="${x(t).toFixed(2)}" y="24" width="2" height="30" fill="var(--chart-signal)" opacity="${(0.08 + density * p.amplitude * 0.7).toFixed(2)}"/>`;
    }
  }
  if (mode === 'envelope') {
    extra += `<path d="${path}L${x1} ${y1}H${x0}Z" fill="var(--chart-signal)" opacity="0.12"/>`;
    for (const t of [p.attack, p.attack + p.decay, keyUpTime(p)])
      extra += `<circle cx="${x(t)}" cy="${y(adsrValue(p, t))}" r="4" fill="var(--chart-signal)"/>`;
    extra += `<path d="M${x(keyUpTime(p))} 24V${y1}" stroke="var(--chart-axis)" stroke-dasharray="4 4"/><text x="18" y="16">Нажата ↓</text><text x="${Math.min(x(keyUpTime(p)), w - 100)}" y="16">Отпущена ↑</text>`;
    if (time > 0)
      extra += `<path d="M${x(Math.min(time, span))} 24V${y1}" stroke="var(--chart-result)" stroke-width="2"/>`;
  }
  if (mode === 'lfo') {
    const t = time % span;
    extra += `<circle cx="${x(t)}" cy="${y(introLfo(p, time))}" r="5" fill="var(--chart-result)"/><text x="18" y="16">Параметр ↑</text>`;
  }
  const axis = mode === 'envelope' ? y1 : mid;
  const left = mode === 'tone' ? '0' : mode === 'oscillator' ? '0' : '0 с';
  const right =
    mode === 'tone' ? '10 мс' : mode === 'oscillator' ? '2 цикла' : `${numberText(span, 2)} с`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} 192" role="img" aria-label="${introCaption(mode, p)}"><g font-family="var(--font-ui)" font-size="13" fill="var(--chart-label)"><path d="M18 ${axis}H${x1}" stroke="var(--chart-grid)"/>${extra}<path d="${path}" fill="none" stroke="var(--chart-signal)" stroke-width="2.5" stroke-linejoin="round"/><text x="18" y="183">${left}</text><text x="${x1}" y="183" text-anchor="end">${right}</text></g></svg>`;
}
