// Две шкалы глубины тремоло для статичных учебных графиков; l ∈ [−1, 1], D ∈ [0, 1].
export function attenuationGain(lfo: number, depth: number): number {
  return 1 - (depth / 2) * (1 + lfo);
}

export function centeredGain(lfo: number, depth: number): number {
  return 1 + depth * lfo;
}
