// Управление микшированием: готовность, ползунки, примеры и полный сброс без анимации.
import { defaultMix, mixingSvg, mixCaption, mixStatus, type MixParameters } from '@/lib/mixing';
export function initMixingDemos(): void {
  document.querySelectorAll<HTMLElement>('[data-mixing-demo]').forEach((root) => {
    if (root.dataset.state !== 'static') return;
    const controls = root.querySelector<HTMLFieldSetElement>('[data-controls]')!;
    const chart = root.querySelector<HTMLElement>('[data-chart]')!;
    const status = root.querySelector<HTMLElement>('[data-status]')!;
    const caption = root.querySelector<HTMLElement>('[data-caption]')!;
    const note = root.querySelector<HTMLElement>('[data-note]')!;
    const announcer = root.querySelector<HTMLElement>('[data-announce]')!;
    const sliders = [...root.querySelectorAll<HTMLInputElement>('[data-param]')];
    const staticChart = chart.innerHTML;
    let p: MixParameters = { ...defaultMix };
    let timer = 0;
    const render = (announce = true) => {
      try {
        chart.innerHTML = mixingSvg(p, root.id);
        status.textContent = mixStatus(p);
        caption.textContent = mixCaption(p);
        sliders.forEach((slider) => {
          const key = slider.dataset.param as keyof MixParameters;
          slider.value = String(p[key]);
          const text = String(p[key]).replace('.', ',');
          slider.setAttribute('aria-valuetext', key === 'phase' ? `${text}°` : text);
          root.querySelector<HTMLOutputElement>(`[data-output="${key}"]`)!.textContent = text;
        });
        clearTimeout(timer);
        if (announce)
          timer = window.setTimeout(() => {
            announcer.textContent = mixStatus(p);
          }, 700);
      } catch {
        clearTimeout(timer);
        chart.innerHTML = staticChart;
        status.textContent = mixStatus(defaultMix);
        caption.textContent = mixCaption(defaultMix);
        sliders.forEach((slider) => {
          const key = slider.dataset.param as keyof MixParameters;
          slider.value = String(defaultMix[key]);
          slider.setAttribute('aria-valuetext', String(defaultMix[key]));
          root.querySelector<HTMLOutputElement>(`[data-output="${key}"]`)!.textContent = String(
            defaultMix[key],
          ).replace('.', ',');
        });
        controls.disabled = true;
        root.dataset.state = 'error';
        note.textContent = 'Не удалось обновить визуализацию. Показано начальное состояние.';
      }
    };
    sliders.forEach((slider) =>
      slider.addEventListener('input', () => {
        p[slider.dataset.param as keyof MixParameters] = Number(slider.value);
        render();
      }),
    );
    root.querySelector('[data-reset]')!.addEventListener('click', () => {
      p = { ...defaultMix };
      render();
    });
    root.querySelectorAll<HTMLButtonElement>('[data-preset]').forEach((button) =>
      button.addEventListener('click', () => {
        p =
          button.dataset.preset === 'overload'
            ? { gain1: 0.8, gain2: 0.8, phase: 0 }
            : { gain1: 0.5, gain2: 0.5, phase: 180 };
        render();
      }),
    );
    render(false);
    if (root.getAttribute('data-state') !== 'error') {
      controls.disabled = false;
      root.dataset.state = 'ready';
    }
    window.addEventListener('pagehide', () => clearTimeout(timer), { once: true });
  });
}
