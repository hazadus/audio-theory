// Геометрия статичных превью карточек визуализаций: область 280 × 150, без осей и подписей.
import { ladderFrequency } from '@/lib/music-theory';

export type PreviewKind =
  | 'daw-project'
  | 'daw-roll'
  | 'daw-clips'
  | 'daw-chain'
  | 'music-ladder'
  | 'music-keys'
  | 'music-rhythm'
  | 'music-circle'
  | 'tone'
  | 'phase'
  | 'sampling'
  | 'compressor'
  | 'loudness'
  | 'lfo'
  | 'bytes'
  | 'pcm'
  | 'prediction'
  | 'mixing'
  | 'noise'
  | 'voice'
  | 'adsr'
  | 'adsr-click'
  | 'filter-step'
  | 'filter-smoothing'
  | 'intro-oscillator'
  | 'intro-envelope'
  | 'intro-lfo';
export const previewKinds: readonly PreviewKind[] = [
  'daw-project',
  'daw-roll',
  'daw-clips',
  'daw-chain',
  'music-ladder',
  'music-keys',
  'music-rhythm',
  'music-circle',
  'noise',
  'tone',
  'phase',
  'sampling',
  'compressor',
  'loudness',
  'lfo',
  'bytes',
  'pcm',
  'prediction',
  'mixing',
  'voice',
  'adsr',
  'adsr-click',
  'filter-step',
  'filter-smoothing',
  'intro-oscillator',
  'intro-envelope',
  'intro-lfo',
];

/** Роль цвета; в разметке превращается в `var(--chart-<роль>)`. */
export type PreviewColor = 'signal' | 'result' | 'sample' | 'axis' | 'grid';

export interface PreviewPath {
  d: string;
  color: PreviewColor;
  width: number;
  dash?: string;
}
export interface PreviewDot {
  x: number;
  y: number;
  color: PreviewColor;
}
export interface Preview {
  paths: PreviewPath[];
  dots: PreviewDot[];
}

export const previewWidth = 280;
export const previewHeight = 150;
/** Горизонтальная линия нуля, общая для всех превью. */
export const previewMidline = 75;

const f1 = (n: number) => n.toFixed(1);

function wave(x0: number, x1: number, cy: number, amplitude: number, cycles: number, phase = 0) {
  const steps = 120;
  let d = '';
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const y = cy - amplitude * Math.sin(2 * Math.PI * cycles * t + phase);
    d += `${i ? 'L' : 'M'}${f1(x0 + (x1 - x0) * t)} ${f1(y)}`;
  }
  return d;
}

function tonePreview(): Preview {
  return {
    paths: [
      { d: wave(16, 264, 62, 36, 4), color: 'signal', width: 2 },
      { d: 'M16 128H264', color: 'grid', width: 3 },
      { d: 'M16 128H170', color: 'signal', width: 3 },
    ],
    dots: [{ x: 170, y: 128, color: 'signal' }],
  };
}

function phasePreview(): Preview {
  return {
    paths: [
      { d: 'M18 75a30 30 0 1 0 60 0a30 30 0 1 0-60 0', color: 'axis', width: 1.25 },
      { d: 'M48 75H78', color: 'signal', width: 2 },
      { d: 'M48 75V45', color: 'result', width: 2, dash: '4 3' },
      { d: wave(96, 264, 75, 36, 2), color: 'signal', width: 2 },
      { d: wave(96, 264, 75, 36, 2, Math.PI / 2), color: 'result', width: 2, dash: '5 4' },
    ],
    dots: [
      { x: 78, y: 75, color: 'signal' },
      { x: 48, y: 45, color: 'result' },
    ],
  };
}

function samplingPreview(): Preview {
  const count = 24;
  const dots: PreviewDot[] = [];
  let stems = '';
  for (let i = 0; i <= count; i += 1) {
    const t = i / count;
    const x = 16 + 248 * t;
    const y = 75 - 48 * Math.sin(2 * Math.PI * 3 * t);
    dots.push({ x: Number(f1(x)), y: Number(f1(y)), color: 'sample' });
    stems += `M${f1(x)} 75V${f1(y)}`;
  }
  return {
    paths: [
      { d: wave(16, 264, 75, 48, 3), color: 'signal', width: 2 },
      { d: stems, color: 'sample', width: 1.25 },
    ],
    dots,
  };
}

function compressorPreview(): Preview {
  const threshold = -24;
  const ratio = 4;
  const x = (v: number) => 100 + ((v + 60) / 60) * 120;
  const y = (v: number) => 140 - ((v + 60) / 60) * 130;
  const out = (v: number) => threshold + (v - threshold) / ratio;
  let curve = '';
  for (let i = 0; i <= 60; i += 1) {
    const v = -60 + i;
    const o =
      v < threshold - 3
        ? v
        : v > threshold + 3
          ? out(v)
          : v + (1 / ratio - 1) * ((v - threshold + 3) ** 2 / 12);
    curve += `${i ? 'L' : 'M'}${f1(x(v))} ${f1(y(o))}`;
  }
  return {
    paths: [
      { d: `M${x(-60)} 140H${x(0)}M${x(-60)} 140V${y(0)}`, color: 'axis', width: 1 },
      { d: `M${x(-60)} ${y(-60)}L${x(0)} ${y(0)}`, color: 'axis', width: 1, dash: '3 3' },
      { d: `M${f1(x(threshold))} 10V140`, color: 'axis', width: 1, dash: '2 3' },
      { d: curve, color: 'result', width: 2.25 },
    ],
    dots: [-26, -16, -8, -2].map((v) => ({
      x: Number(f1(x(v))),
      y: Number(f1(y(v < threshold ? v : out(v)))),
      color: 'sample' as const,
    })),
  };
}

/** Окружность фазы и два цикла форм (синусоида, пила) с вертикальным курсором текущей фазы. */
function lfoPreview(): Preview {
  const angle = -Math.PI / 4;
  const tipX = 48 + 30 * Math.cos(angle);
  const tipY = 75 - 30 * Math.sin(angle);
  const cursor = 96 + 168 * ((angle + Math.PI) / (2 * Math.PI));
  return {
    paths: [
      { d: 'M18 75a30 30 0 1 0 60 0a30 30 0 1 0-60 0', color: 'axis', width: 1.25 },
      { d: `M48 75L${f1(tipX)} ${f1(tipY)}`, color: 'result', width: 2 },
      { d: wave(96, 264, 42, 26, 1, Math.PI), color: 'signal', width: 2 },
      { d: 'M96 134L264 82', color: 'signal', width: 2 },
      { d: 'M264 82V134', color: 'signal', width: 2, dash: '4 3' },
      { d: `M${f1(cursor)} 12V140`, color: 'result', width: 1.25 },
    ],
    dots: [
      { x: Number(f1(tipX)), y: Number(f1(tipY)), color: 'result' },
      { x: Number(f1(cursor)), y: Number(f1(42 - 26 * Math.sin(angle))), color: 'result' },
      { x: Number(f1(cursor)), y: Number(f1(108 - 26 * (angle / Math.PI))), color: 'result' },
    ],
  };
}

/** Карта чанков на линии нуля и строки байтов: выбранное поле выделено, его чанк отмечен точкой. */
function bytesPreview(): Preview {
  // Сегменты карты пропорциональны чанкам учебного файла: 12, 36, 24, 24 и 26 байт.
  const segments = [12, 36, 24, 24, 26];
  const scale = 248 / 122;
  let x = 16;
  let map = '';
  for (const bytes of segments) {
    const width = bytes * scale;
    map += `M${f1(x + 2)} 75H${f1(x + width - 2)}`;
    x += width;
  }
  const cell = (row: number, column: number) => {
    const cx = 34 + column * 30;
    const cy = row < 2 ? 25 + row * 22 : 103 + (row - 2) * 22;
    return `M${cx} ${cy}H${cx + 16}`;
  };
  let grid = '';
  let current = '';
  for (let row = 0; row < 4; row += 1) {
    for (let column = 0; column < 8; column += 1) {
      // Выбранное поле — четыре байта во второй строке.
      if (row === 1 && column >= 2 && column < 6) current += cell(row, column);
      else grid += cell(row, column);
    }
  }
  return {
    paths: [
      { d: map, color: 'axis', width: 6 },
      { d: grid, color: 'grid', width: 8 },
      { d: current, color: 'result', width: 8 },
    ],
    dots: [{ x: Number(f1(16 + 12 * scale + 18 * scale)), y: 75, color: 'result' }],
  };
}

const builders: Record<PreviewKind, () => Preview> = {
  // Четыре дорожки с клипами и курсор воспроизведения.
  'daw-project': () => ({
    paths: [
      { d: 'M16 24H264M16 56H264M16 88H264M16 120H264', color: 'grid', width: 1 },
      { d: 'M20 40H260M20 72H260M20 104H260M140 136H260', color: 'signal', width: 18 },
      { d: 'M112 14V146', color: 'result', width: 2.5 },
    ],
    dots: [],
  }),
  // Сетка piano roll: ноты разной длины на ступенях.
  'daw-roll': () => ({
    paths: [
      {
        d: 'M16 22H264M16 52H264M16 82H264M16 112H264M78 14V136M140 14V136M202 14V136',
        color: 'grid',
        width: 1,
      },
      { d: 'M20 127H74M82 97H105M113 67H136M144 37H258', color: 'signal', width: 16 },
    ],
    dots: [],
  }),
  // Ноты MIDI-клипа над формой волны аудиоклипа.
  'daw-clips': () => ({
    paths: [
      { d: 'M20 30H60M66 46H106M112 22H192M198 38H258', color: 'signal', width: 10 },
      { d: wave(20, 258, 108, 26, 14), color: 'result', width: 1.5 },
    ],
    dots: [],
  }),
  // Пять блоков цепочки со стрелками, выбран третий.
  'daw-chain': () => ({
    paths: [
      {
        d: 'M18 58h36v34h-36ZM70 58h36v34h-36ZM174 58h36v34h-36ZM226 58h36v34h-36Z',
        color: 'axis',
        width: 1.5,
      },
      { d: 'M122 58h36v34h-36Z', color: 'signal', width: 3 },
      { d: 'M56 75H68M108 75H120M160 75H172M212 75H224', color: 'axis', width: 1.5 },
    ],
    dots: [],
  }),
  'music-ladder': () => ({
    paths: [
      { d: 'M16 132H264', color: 'axis', width: 1 },
      { d: 'M16 132L264 24', color: 'result', width: 2, dash: '4 4' },
    ],
    dots: Array.from({ length: 13 }, (_, i) => ({
      x: 16 + ((ladderFrequency(i, 'equal') - 220) / 220) * 248,
      y: 132 - i * 9,
      color: 'signal' as const,
    })),
    // Пунктирная линия равных прибавок герц даёт ориентир для сравнения двух лестниц.
  }),
  'music-keys': () => ({
    paths: [
      {
        d: 'M24 28H256V126H24ZM57 28V126M90 28V126M123 28V126M156 28V126M189 28V126M222 28V126',
        color: 'axis',
        width: 1.5,
      },
      { d: 'M57 28V84M90 28V84M156 28V84M189 28V84M222 28V84', color: 'axis', width: 18 },
      { d: 'M40 94V120M106 94V120M172 94V120', color: 'signal', width: 22 },
    ],
    dots: [],
  }),
  'music-rhythm': () => ({
    paths: [
      { d: 'M16 42H264M16 78H264M16 114H264', color: 'grid', width: 1 },
      {
        d: 'M28 28V55M90 28V55M152 28V55M214 28V55M28 64V92M59 64V92M90 64V92M137 64V92M214 64V92',
        color: 'signal',
        width: 10,
      },
      {
        d: 'M28 102V126M75 102V126M90 102V126M137 102V126M152 102V126M199 102V126M214 102V126M261 102V126',
        color: 'result',
        width: 8,
      },
    ],
    dots: [],
  }),
  'music-circle': () => ({
    paths: [{ d: 'M140 20a55 55 0 1 1 0 110a55 55 0 1 1 0-110', color: 'axis', width: 1.5 }],
    dots: Array.from({ length: 12 }, (_, i) => ({
      x: 140 + 55 * Math.sin((i * Math.PI) / 6),
      y: 75 - 55 * Math.cos((i * Math.PI) / 6),
      color: i === 0 ? ('signal' as const) : ('axis' as const),
    })),
  }),
  'intro-oscillator': () => ({
    paths: [{ d: 'M16 75L78 28L140 122L202 28L264 75', color: 'signal', width: 2.5 }],
    dots: [],
  }),
  'intro-envelope': () => ({
    paths: [
      { d: 'M16 125L55 24L112 80H215L264 125', color: 'signal', width: 2.5 },
      { d: 'M215 20V130', color: 'axis', width: 1, dash: '4 4' },
    ],
    dots: [
      { x: 55, y: 24, color: 'signal' },
      { x: 112, y: 80, color: 'signal' },
      { x: 215, y: 80, color: 'signal' },
    ],
  }),
  'intro-lfo': () => ({
    paths: [{ d: wave(16, 264, 75, 44, 2), color: 'signal', width: 2.5 }],
    dots: [{ x: 47, y: 31, color: 'result' }],
  }),
  noise: () => ({
    paths: [
      { d: 'M18 40H262', color: 'signal', width: 2 },
      { d: 'M18 18L262 80', color: 'result', width: 2, dash: '6 4' },
      {
        d: 'M30 136V132M66 136V128M102 136V120M138 136V104M174 136V88',
        color: 'signal',
        width: 12,
      },
      {
        d: 'M46 136V114M82 136V113M118 136V116M154 136V113M190 136V115',
        color: 'result',
        width: 8,
        dash: '3 2',
      },
    ],
    dots: [],
  }),
  tone: tonePreview,
  phase: phasePreview,
  sampling: samplingPreview,
  compressor: compressorPreview,
  loudness: loudnessPreview,
  lfo: lfoPreview,
  bytes: bytesPreview,
  pcm: () => {
    let original = '';
    let extended = '';
    for (let i = 0; i < 24; i++) original += `M${70 + i * 8} 44v20`;
    for (let i = 0; i < 32; i++) extended += `M${6 + i * 8} 100v20`;
    return {
      paths: [
        { d: original, color: 'signal', width: 3 },
        { d: extended, color: 'grid', width: 3 },
        {
          d: 'M6 100v20M14 100v20M22 100v20M30 100v20M38 100v20M46 100v20M54 100v20M62 100v20',
          color: 'result',
          width: 3,
        },
        { d: 'M70 74v12', color: 'axis', width: 1.5 },
      ],
      dots: [],
    };
  },
  prediction: predictionPreview,
  voice: voicePreview,
  adsr: adsrPreview,
  'adsr-click': adsrClickPreview,
  'filter-step': filterStepPreview,
  'filter-smoothing': filterSmoothingPreview,
  mixing: () => ({
    paths: [
      { d: wave(16, 264, 75, 22, 2), color: 'signal', width: 1.5 },
      { d: wave(16, 264, 75, 22, 2, Math.PI / 2), color: 'sample', width: 1.5, dash: '5 4' },
      { d: wave(16, 264, 75, Math.sqrt(2) * 22, 2, Math.PI / 4), color: 'result', width: 2.5 },
    ],
    dots: [],
  }),
};

function loudnessPreview(): Preview {
  // Сверху динамичная огибающая: тихий куплет и удары припева; снизу та же музыка после лимитера —
  // почти ровный брусок под пунктирным потолком.
  let dynamic = '';
  let loud = '';
  for (let i = 0; i < 40; i += 1) {
    const x = f1(20 + 6 * i);
    const chorus = i >= 20;
    const hit = i % 5 === 0 ? 1 : i % 5 === 1 ? 0.7 : 0.45;
    const top = (chorus ? 26 : 13) * hit + (chorus ? 4 : 3);
    dynamic += `M${x} ${f1(42 - top)}V${f1(42 + top)}`;
    const flat = (chorus ? 26 : 23) - (i % 5 === 0 ? 0 : 1.5);
    loud += `M${x} ${f1(112 - flat)}V${f1(112 + flat)}`;
  }
  return {
    paths: [
      { d: dynamic, color: 'signal', width: 3 },
      { d: 'M16 84H264M16 140H264', color: 'axis', width: 1, dash: '3 3' },
      { d: loud, color: 'result', width: 3 },
    ],
    dots: [],
  };
}

function voicePreview(): Preview {
  // Сверху сумма двух пил с небольшой расстройкой, снизу гармоники 1/k и отражения кольцами.
  let sum = '';
  for (let i = 0; i <= 160; i += 1) {
    const t = i / 160;
    const saw = (cycles: number) => 2 * ((cycles * t) % 1) - 1;
    const y = 44 - 13 * (saw(3) + saw(3.08));
    sum += `${i ? 'L' : 'M'}${f1(16 + 248 * t)} ${f1(y)}`;
  }
  let stems = '';
  for (let k = 1; k <= 9; k += 1) {
    const x = 24 + 26 * (k - 1);
    stems += `M${x} 136V${f1(136 - 44 / k)}`;
  }
  return {
    paths: [
      { d: sum, color: 'signal', width: 2 },
      { d: 'M16 136H264', color: 'axis', width: 1 },
      { d: stems, color: 'signal', width: 3 },
    ],
    dots: [
      { x: 63, y: 124, color: 'sample' },
      { x: 141, y: 127, color: 'sample' },
      { x: 219, y: 129, color: 'sample' },
    ],
  };
}

function adsrPreview(): Preview {
  // Сверху огибающая ADSR с ровным sustain, снизу пила под той же огибающей.
  const env = (t: number) =>
    t < 0.15
      ? t / 0.15
      : t < 0.35
        ? 1 - (0.4 * (t - 0.15)) / 0.2
        : t < 0.7
          ? 0.6
          : 0.6 * (1 - (t - 0.7) / 0.3);
  let curve = '';
  let signal = '';
  for (let i = 0; i <= 160; i += 1) {
    const t = i / 160;
    const x = f1(16 + 248 * t);
    curve += `${i ? 'L' : 'M'}${x} ${f1(62 - 46 * env(t))}`;
    const saw = 2 * ((14 * t) % 1) - 1;
    signal += `${i ? 'L' : 'M'}${x} ${f1(112 - 26 * saw * env(t))}`;
  }
  return {
    paths: [
      { d: 'M16 62H264M16 112H264', color: 'grid', width: 1 },
      { d: 'M53 16V140M102 16V140M189 16V140', color: 'axis', width: 1, dash: '3 4' },
      { d: curve, color: 'sample', width: 2.5 },
      { d: signal, color: 'signal', width: 1.5 },
    ],
    dots: [],
  };
}

function adsrClickPreview(): Preview {
  // Слева синус включается скачком на вершине, справа — с короткой атакой.
  const panel = (x0: number, smooth: boolean) => {
    let d = `M${x0} 75H${x0 + 30}`;
    for (let i = 0; i <= 60; i += 1) {
      const t = i / 60;
      const gain = smooth ? Math.min(1, t / 0.25) : 1;
      d += `L${f1(x0 + 30 + 80 * t)} ${f1(75 - 44 * gain * Math.cos(2 * Math.PI * 2.5 * t))}`;
    }
    return d;
  };
  return {
    paths: [
      { d: 'M16 75H264', color: 'grid', width: 1 },
      { d: 'M46 20V130M180 20V130', color: 'axis', width: 1.25 },
      { d: panel(16, false), color: 'signal', width: 2 },
      { d: panel(150, true), color: 'result', width: 2 },
    ],
    dots: [{ x: 46, y: 31, color: 'sample' }],
  };
}

function filterStepPreview(): Preview {
  // Ступенька входа пунктиром и отсчёты выхода на экспоненте с отметкой постоянной времени.
  const dots: PreviewDot[] = [];
  let curve = '';
  for (let i = 0; i <= 120; i += 1) {
    const t = i / 120;
    curve += `${i ? 'L' : 'M'}${f1(20 + 240 * t)} ${f1(130 - 100 * (1 - Math.exp(-5 * t)))}`;
  }
  for (let n = 0; n <= 20; n += 1)
    dots.push({
      x: Number(f1(20 + 12 * n)),
      y: Number(f1(130 - 100 * (1 - Math.exp(-n / 4)))),
      color: 'result',
    });
  return {
    paths: [
      { d: 'M20 130H260', color: 'axis', width: 1 },
      { d: 'M20 30H260', color: 'signal', width: 1.5, dash: '5 4' },
      { d: 'M20 67H260M68 20V136', color: 'grid', width: 1.25, dash: '6 4' },
      { d: curve, color: 'result', width: 1.5 },
    ],
    dots,
  };
}

function filterSmoothingPreview(): Preview {
  // Тонкая пила и скруглённый выход фильтра поверх неё.
  let saw = '';
  let smooth = '';
  let y = 0;
  const b = Math.exp(-1 / 14);
  for (let i = 0; i <= 480; i += 1) {
    const t = i / 480;
    const x = 2 * ((3 * t + 0.5) % 1) - 1;
    y = i === 0 ? -0.1 : x + b * (y - x);
    if (i % 2 === 0) {
      saw += `${i ? 'L' : 'M'}${f1(16 + 248 * t)} ${f1(75 - 50 * x)}`;
      smooth += `${i ? 'L' : 'M'}${f1(16 + 248 * t)} ${f1(75 - 50 * y)}`;
    }
  }
  return {
    paths: [
      { d: 'M16 75H264', color: 'grid', width: 1 },
      { d: saw, color: 'signal', width: 1.25 },
      { d: smooth, color: 'result', width: 2.5 },
    ],
    dots: [],
  };
}

function predictionPreview(): Preview {
  // Сверху отсчёты плавного сигнала, снизу — малый остаток предсказания в тех же моментах.
  const count = 16;
  const dots: PreviewDot[] = [];
  let stems = '';
  for (let i = 0; i < count; i += 1) {
    const t = i / (count - 1);
    const x = 24 + 232 * t;
    dots.push({
      x: Number(f1(x)),
      y: Number(f1(46 - 28 * Math.sin(2 * Math.PI * 0.9 * t))),
      color: 'signal',
    });
    if (i >= 2) stems += `M${f1(x)} 118V${f1(118 - 9 * Math.sin(2 * Math.PI * 0.9 * t + 1.2))}`;
  }
  return {
    paths: [
      { d: 'M16 118H264', color: 'axis', width: 1 },
      { d: stems, color: 'sample', width: 3 },
    ],
    dots,
  };
}

export const buildPreview = (kind: PreviewKind): Preview => builders[kind]();
