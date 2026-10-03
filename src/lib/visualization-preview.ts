// Геометрия статичных превью карточек визуализаций: область 280 × 150, без осей и подписей.
export type PreviewKind = 'tone' | 'phase' | 'sampling' | 'compressor';
export const previewKinds: readonly PreviewKind[] = ['tone', 'phase', 'sampling', 'compressor'];

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

const builders: Record<PreviewKind, () => Preview> = {
  tone: tonePreview,
  phase: phasePreview,
  sampling: samplingPreview,
  compressor: compressorPreview,
};

export const buildPreview = (kind: PreviewKind): Preview => builders[kind]();
