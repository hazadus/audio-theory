/** Umami: счётчик и запись сеансов работают только на боевом домене, локальный просмотр их не накручивает. */
export const analyticsConfig = {
  host: 'https://stats.amgold.ru',
  websiteId: '0c5bed30-08b5-4117-ad14-6faeab88bb8b',
  domain: 'hazadus.github.io',
};

export const siteConfig = {
  site: 'https://hazadus.github.io',
  base: '/audio-theory/',
  repository: 'https://github.com/hazadus/audio-theory',
  depot: {
    name: 'Депо – бесплатный менеджер аудиосэмплов',
    url: 'https://depot.amgold.ru',
    host: 'depot.amgold.ru',
  },
};
