// Графики одного шумового фрагмента: время, плотность мощности и мощность октав.
import { comparisonRms, noiseBandPower, noiseOctaves, type NoiseExperiment } from '@/lib/noise';

/** Число с фиксированными знаками, запятой и знаком «−»; округлённый ноль без знака. */
export function noiseNumber(x: number, digits = 2): string {
  const text = Math.abs(x).toFixed(digits).replace('.', ',');
  return x < 0 && /[1-9]/.test(text) ? `−${text}` : text;
}
export const noiseDb = (power: number) => 10 * Math.log10(Math.max(power, 1e-20));
const f = (x: number) => x.toFixed(2);

export function noiseStatus(e: NoiseExperiment): string {
  return `Seed ${e.seed}. Оба фрагмента: 4 с, 48 кГц, RMS ${noiseNumber(comparisonRms)} (−18,42 dBFS без поправки AES17). Среднее: белый ${noiseNumber(e.white.metrics.mean, 4)}, розовый ${noiseNumber(e.pink.metrics.mean, 4)}. Пик: белый ${noiseNumber(e.white.metrics.peak, 3)}, розовый ${noiseNumber(e.pink.metrics.peak, 3)}.`;
}

export function noiseCaption(seed: number): string {
  return `Белый и розовый шум при seed ${seed} и одинаковом RMS. Сверху первые 128 отсчётов, ниже усреднённая PSD и мощность октав от 125–250 до 8 000–16 000 Гц. Мощность октавы показана относительно среднего квадрата всего фрагмента. Розовый спектр — приближение Voss–McCartney с 16 рядами.`;
}

export function noiseSvg(e: NoiseExperiment, id: string, width = 680): string {
  const w = Math.max(300, Math.round(width));
  const left = 49;
  const right = w - 18;
  const area = right - left;
  const grid = (ys: number[], top: number, height: number, min: number, max: number) =>
    ys
      .map((v) => {
        const y = top + height * (1 - (v - min) / (max - min));
        return `<path class="grid" d="M${left} ${f(y)}H${right}"/><text class="tick" x="${left - 8}" y="${f(y + 4)}" text-anchor="end">${noiseNumber(v, Number.isInteger(v) ? 0 : 1)}</text>`;
      })
      .join('');
  const wave = (kind: 'white' | 'pink') => {
    let d = '';
    for (let n = 0; n < 128; n++)
      d += `${n ? 'L' : 'M'}${f(left + (area * n) / 127)} ${f(95 - e[kind].samples[n] * 90)}`;
    return `<path class="${kind}" d="${d}"/>`;
  };
  const freqX = (hz: number) => left + (area * Math.log2(hz / 125)) / 7;
  const density = (kind: 'white' | 'pink') => {
    let d = '';
    for (let i = 0; i < 84; i++) {
      const low = 125 * 2 ** (i / 12);
      const high = low * 2 ** (1 / 12);
      const db = noiseDb(noiseBandPower(e[kind].psd, low, high) / (high - low));
      const y = 370 - (160 * (Math.min(-20, Math.max(-80, db)) + 80)) / 60;
      d += `${i ? 'L' : 'M'}${f(freqX(Math.sqrt(low * high)))} ${f(y)}`;
    }
    return `<path class="${kind}" d="${d}"/>`;
  };
  const bars = noiseOctaves
    .map((low, i) => {
      const center = left + (area * (i + 0.5)) / 7;
      const bw = Math.min(23, area / 20);
      return (
        (['white', 'pink'] as const)
          .map((kind, j) => {
            const db = noiseDb(e[kind].octaves[i] / e[kind].metrics.rms ** 2);
            const y = 605 - (140 * (Math.max(-30, db) + 30)) / 30;
            const x = center + (j - 1) * bw;
            return `<rect class="bar ${kind}" x="${f(x)}" y="${f(y)}" width="${f(bw - 2)}" height="${f(605 - y)}"${kind === 'pink' ? ` fill="url(#${id}-hatch)"` : ''}/>`;
          })
          .join('') +
        `<text class="tick" x="${f(center)}" y="626" text-anchor="middle">${low >= 1000 ? `${low / 1000}к` : low}</text>`
      );
    })
    .join('');
  const freqTicks = w < 480 ? [125, 1000, 16000] : [125, 500, 2000, 8000, 16000];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="655" viewBox="0 0 ${w} 655" role="img" aria-labelledby="${id}-title ${id}-desc">
  <title id="${id}-title">Белый и розовый шум: время, PSD и октавы</title>
  <desc id="${id}-desc">Seed ${e.seed}. Сплошная линия — белый шум; пунктир и штриховка — розовый. Белая PSD примерно горизонтальна; розовая убывает. Мощность октав белого шума растёт, розового — примерно одинакова. Измерения конечного фрагмента колеблются.</desc>
  <defs><pattern id="${id}-hatch" width="6" height="6" patternUnits="userSpaceOnUse"><path class="hatch" d="M-1 1L1 -1M0 6L6 0M5 7L7 5"/></pattern></defs>
  <text class="label" x="${left}" y="23">Отсчёты во времени</text>
  ${grid([-0.5, 0, 0.5], 50, 90, -0.5, 0.5)}${wave('white')}${wave('pink')}
  <text class="tick" x="${left}" y="166">0</text><text class="tick" x="${right}" y="166" text-anchor="end">2,65 мс</text>
  <text class="label" x="${left}" y="196">PSD, дБ относительно 1/Гц</text>
  ${grid([-80, -65, -50, -35, -20], 210, 160, -80, -20)}${density('white')}${density('pink')}
  ${freqTicks.map((hz) => `<text class="tick" x="${f(freqX(hz))}" y="392" text-anchor="${hz === 125 ? 'start' : hz === 16000 ? 'end' : 'middle'}">${hz >= 1000 ? `${hz / 1000}к` : hz}</text>`).join('')}
  <text class="tick" x="${right}" y="410" text-anchor="end">Частота, Гц</text>
  <text class="label" x="${left}" y="449">Мощность октавы, дБ к общей</text>
  ${grid([-30, -20, -10, 0], 465, 140, -30, 0)}${bars}
  <text class="tick" x="${right}" y="647" text-anchor="end">Нижняя граница октавы, Гц</text>
  </svg>`;
}
