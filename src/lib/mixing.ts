// Модель двух синусоид: вклады источников, сумма, ограничение и аналитическая амплитуда.
export interface MixParameters {
  gain1: number;
  gain2: number;
  phase: number;
}
export const defaultMix: Readonly<MixParameters> = { gain1: 0.5, gain2: 0.5, phase: 0 };
export function mixAt(turn: number, p: MixParameters) {
  const angle = 2 * Math.PI * turn;
  const first = p.gain1 * Math.sin(angle);
  const second = p.gain2 * Math.sin(angle + (p.phase * Math.PI) / 180);
  const sum = first + second;
  return { first, second, sum, clipped: Math.max(-1, Math.min(1, sum)) };
}
/** Амплитуда идеальной синусоиды, а не максимум редкой сетки отсчётов. */
export function mixPeak(p: MixParameters): number {
  const phase = (p.phase * Math.PI) / 180;
  const peak = Math.hypot(p.gain1 + p.gain2 * Math.cos(phase), p.gain2 * Math.sin(phase));
  return peak < 1e-12 ? 0 : peak;
}
export const mixNumber = (value: number) => value.toFixed(3).replace('.', ',');
export function mixStatus(p: MixParameters): string {
  const peak = mixPeak(p);
  const level = peak === 0 ? '−∞' : (20 * Math.log10(peak)).toFixed(2).replace('.', ',');
  const state =
    peak > 1 + 1e-12
      ? 'Сумма превышает ±1: ограничение срезает вершины.'
      : peak === 0
        ? 'Источники полностью компенсируют друг друга.'
        : 'Сумма помещается в ±1; ограниченная линия совпадает с ней.';
  return `Амплитуда суммы: ${mixNumber(peak)} (${level} дБ относительно 1). ${state}`;
}
export function mixCaption(p: MixParameters): string {
  return `Две идеальные синусоиды одной частоты с исходной амплитудой 1. Усиления g₁ = ${mixNumber(p.gain1)}, g₂ = ${mixNumber(p.gain2)}, разность фаз ${p.phase}°. Линии показывают вклады после усиления, сумму и её ограничение до ±1. Звука нет.`;
}
export function mixingSvg(p: MixParameters, id: string): string {
  const path = (key: 'first' | 'second' | 'sum' | 'clipped') => {
    let d = '';
    for (let i = 0; i <= 640; i++) {
      const value = mixAt((2 * i) / 640, p)[key];
      d += `${i ? 'L' : 'M'}${(54 + (358 * i) / 640).toFixed(2)} ${(160 - 60 * value).toFixed(2)}`;
    }
    return d;
  };
  const ticks = [-2, -1, 0, 1, 2]
    .map(
      (value) =>
        `<line x1="54" x2="412" y1="${160 - 60 * value}" y2="${160 - 60 * value}" class="${Math.abs(value) === 1 ? 'limit' : 'grid'}"/><text x="45" y="${164 - 60 * value}" text-anchor="end">${value}</text>`,
    )
    .join('');
  return `<svg viewBox="0 0 440 330" role="img" aria-labelledby="${id}-chart-title ${id}-chart-desc" xmlns="http://www.w3.org/2000/svg"><title id="${id}-chart-title">Сумма двух сигналов</title><desc id="${id}-chart-desc">${mixCaption(p)} ${mixStatus(p)}</desc><g class="ticks">${ticks}<text x="54" y="20">Отсчёт, без единиц</text><text x="54" y="303">0</text><text x="233" y="303" text-anchor="middle">1</text><text x="412" y="303" text-anchor="end">2</text><text x="233" y="324" text-anchor="middle">Время, в периодах</text></g><path class="first" d="${path('first')}"/><path class="second" d="${path('second')}"/><path class="sum" d="${path('sum')}"/><path class="clipped" d="${path('clipped')}"/></svg>`;
}
