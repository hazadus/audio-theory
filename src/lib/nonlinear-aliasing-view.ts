// Тексты и график визуализации «Два тона и отражения» статьи /nonlinear-aliasing/: спектр выхода
// кривой от 0 до fs/2 с входными тонами, настоящими сочетаниями и отражениями, крестики эталона
// аналоговой цепи. График строится в пикселях контейнера, поэтому подписи остаются 12 px при любой
// ширине.
import {
  floorDb,
  toneAmplitude,
  toneFrequencies,
  type AliasingCurve,
  type AliasingParameters,
  type AliasingRender,
  type AliasingSampleRate,
  type Component,
  type OversamplingFactor,
} from '@/lib/nonlinear-aliasing';
import { dbToGain } from '@/lib/distortion';
import { driveText } from '@/lib/distortion-view';
import { fixed } from '@/lib/voice-sources-view';

export { driveText };

export const curveNames: Record<AliasingCurve, string> = {
  tanh: 'tanh, симметричная',
  asymmetric: 'tanh со смещением b = 0,2',
  hard: 'жёсткое ограничение',
};

/** Частота в килогерцах с запятой: 44,1; 48; 22,05. */
export const khzText = (hz: number) =>
  `${fixed(hz / 1000, hz % 100 ? 2 : hz % 1000 ? 1 : 0)}\u00a0кГц`;

export const sampleRateText = (rate: AliasingSampleRate) => khzText(rate);
export const factorText = (factor: OversamplingFactor) => `${factor}×`;

/** Уровень в dBFS; отсутствующий — «нет». */
export function dbfsText(db: number): string {
  return Number.isFinite(db) ? `${fixed(db, 1)}\u00a0dBFS` : 'нет';
}

/** Суммарный уровень отражений, дБ относительно синусоиды 0 dBFS. */
export function totalText(db: number): string {
  return db > floorDb ? `${fixed(db, 1)}\u00a0дБ` : `ниже ${fixed(floorDb, 0)}\u00a0дБ`;
}

export interface AliasingStatus {
  setup: string;
  aliases: string;
  products: string;
}

export function aliasingStatus(r: AliasingRender): AliasingStatus {
  const { p } = r;
  const peak = 2 * toneAmplitude * dbToGain(p.driveDb);
  const nyquist = khzText(p.sampleRate / 2);
  const rate =
    p.factor === 1
      ? `кривая работает при ${sampleRateText(p.sampleRate)}, всё выше ${nyquist} отражается`
      : `кривая работает при ${khzText(r.processRate)}; в полосу до ${nyquist} отражаются только составляющие выше ${khzText((p.factor - 0.5) * p.sampleRate)}`;
  const setup = `Кривая «${curveNames[p.curve]}», входное усиление ${driveText(p.driveDb)}: пик суммы тонов на входе кривой ${fixed(peak, 2)}. Передискретизация ${factorText(p.factor)}: ${rate}.`;
  const strongest = r.strongestAlias;
  const aliases = strongest
    ? `Отражения: суммарно ${totalText(r.aliasTotal)}, самое сильное — ${khzText(strongest.hz)}, ${dbfsText(strongest.alias)}.`
    : `Отражений выше ${fixed(floorDb, 0)}\u00a0dBFS нет.`;
  const near = [18000, 21000]
    .map((hz) => r.components.find((c) => c.hz === hz))
    .filter((c): c is Component => c !== undefined && Number.isFinite(c.reference));
  const nearText = near.length
    ? `${near.map((c) => khzText(c.hz)).join(' и ')} — ${dbfsText(near[0].reference)}`
    : 'около тонов сочетаний нет';
  const { level, reference } = r.difference;
  let difference: string;
  if (Number.isFinite(reference) && reference > floorDb)
    difference = `разностный тон 1\u00a0кГц ${dbfsText(reference)}`;
  else if (Number.isFinite(level) && level > floorDb)
    difference = `на 1\u00a0кГц ${dbfsText(level)}, но это отражение: у симметричной кривой разностного тона почти нет`;
  else difference = 'разностного тона 1\u00a0кГц нет: кривая симметрична';
  const products = `Интермодуляция, которую дала бы и аналоговая цепь: ${nearText}; ${difference}.`;
  return { setup, aliases, products };
}

export function aliasingCaption(p: AliasingParameters): string {
  const oversampling =
    p.factor === 1
      ? 'без передискретизации'
      : `с передискретизацией ${factorText(p.factor)} и идеальными фильтрами`;
  return `Тоны ${toneFrequencies.map((hz) => khzText(hz)).join(' и ')} по ${fixed(toneAmplitude, 2)} проходят кривую «${curveNames[p.curve]}» с входным усилением ${driveText(p.driveDb)} при ${sampleRateText(p.sampleRate)} ${oversampling}. Спектр выхода от 0 до ${khzText(p.sampleRate / 2)} в dBFS: входные тоны, настоящие сочетания частот и отражения различаются линиями и метками, крестики — уровни той же кривой в аналоговой цепи перед идеальным АЦП. Звук синтезирован из тех же составляющих при частоте дискретизации браузера, уровень выхода выровнен по RMS со входом.`;
}

const f1 = (x: number) => x.toFixed(1);

/** Шаг подписей оси частот, Гц. */
const tickStep = (nyquist: number, width: number) =>
  nyquist > 30000 ? (width < 420 ? 10000 : 5000) : width < 420 ? 5000 : 2000;

export function aliasingSvg(r: AliasingRender, id: string, width = 680): string {
  const w = Math.max(280, Math.round(width));
  const left = 48;
  const right = w - 16;
  const top = 36;
  const height = 240;
  const bottom = top + height;
  const nyquist = r.p.sampleRate / 2;
  const x = (hz: number) => left + ((right - left) * hz) / nyquist;
  const y = (db: number) => top + (height * Math.min(0, Math.max(floorDb, db))) / floorDb;

  let grid = '';
  for (let db = 0; db >= floorDb; db -= 20)
    grid += `<path class="${db === 0 ? 'zero' : 'grid'}" d="M${left} ${f1(y(db))}H${right}"/><text class="tick" x="${left - 6}" y="${f1(y(db) + 4)}" text-anchor="end">${fixed(db, 0)}</text>`;
  const step = tickStep(nyquist, w);
  let ticks = '';
  for (let hz = 0; hz < nyquist; hz += step)
    ticks += `<text class="tick" x="${f1(x(hz))}" y="${bottom + 16}" text-anchor="${hz === 0 ? 'start' : 'middle'}">${fixed(hz / 1000, 0)}</text>`;
  ticks += `<path class="zero" d="M${f1(x(nyquist))} ${top}V${bottom}"/><text class="tick" x="${f1(x(nyquist))}" y="${top - 6}" text-anchor="end">fs/2 = ${khzText(nyquist)}</text>`;

  let aliases = '';
  let products = '';
  let tones = '';
  let markers = '';
  let crosses = '';
  for (const c of r.components) {
    const px = f1(x(c.hz));
    const line = `M${px} ${bottom}V${f1(y(c.level))}`;
    if (c.kind === 'alias') aliases += line;
    else if (c.kind === 'product') {
      products += line;
      markers += `<circle class="mark product" cx="${px}" cy="${f1(y(c.level))}" r="3.5"/>`;
    } else {
      tones += line;
      markers += `<rect class="mark tone" x="${f1(x(c.hz) - 4)}" y="${f1(y(c.level) - 4)}" width="8" height="8"/>`;
    }
    if (c.kind !== 'tone' && c.reference > floorDb) {
      const cy = y(c.reference);
      crosses += `M${f1(x(c.hz) - 4)} ${f1(cy - 4)}l8 8M${f1(x(c.hz) - 4)} ${f1(cy + 4)}l8 -8`;
    }
  }
  const status = aliasingStatus(r);
  const desc = `${aliasingCaption(r.p)} ${status.setup} ${status.aliases} ${status.products}`;
  const total = bottom + 44;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${total}" viewBox="0 0 ${w} ${total}" role="img" aria-labelledby="${id}-chart-title ${id}-chart-desc">
<title id="${id}-chart-title">Спектр выхода кривой: тоны, сочетания и отражения</title>
<desc id="${id}-chart-desc">${desc}</desc>
<text class="label" x="${left - 40}" y="${top - 16}">Спектр выхода, dBFS</text>
${grid}
<path class="line alias" d="${aliases}"/><path class="line product" d="${products}"/><path class="line tone" d="${tones}"/>
${markers}<path class="cross" d="${crosses}"/>
${ticks}<text class="tick" x="${right}" y="${bottom + 32}" text-anchor="end">частота, кГц</text>
</svg>`;
}
