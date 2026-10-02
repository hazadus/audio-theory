// Статичные кривые 20, 40 и 80 фон по формуле (1) ISO 226:2023, без экстраполяции.
import data from '@/data/equal-loudness.json';

// p₀² = (20 мкПа / Па)²; αᵣ = 0,3; Tᵣ = 2,4 дБ SPL.
// Результат — дБ SPL. Коэффициенты для 29 частот сверены с таблицей 1 стандарта.
export const equalLoudnessContours = [20, 40, 80].map((phon) => ({
  phon,
  points: data.parameters.map(([frequencyHz, alpha, transferDb, thresholdDbSpl]) => ({
    frequencyHz,
    dbSpl:
      (10 / alpha) *
        Math.log10(
          4e-10 ** (0.3 - alpha) * (10 ** (0.03 * phon) - 10 ** 0.072) +
            10 ** ((alpha * (thresholdDbSpl + transferDb)) / 10),
        ) -
      transferDb,
  })),
}));
