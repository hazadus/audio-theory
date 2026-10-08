/** Тематические группы статей в порядке вывода; названия и описания — из дизайн-системы. */
export const topics = [
  { id: 'basics', title: 'Основы звука', description: 'Физика звука, аналоговый сигнал' },
  {
    id: 'digital',
    title: 'Цифровой сигнал',
    description: 'Дискретизация, отсчёты и их представление',
  },
  {
    id: 'conv',
    title: 'АЦП и ЦАП',
    description: 'Преобразование аналогового и цифрового сигналов',
  },
  { id: 'data', title: 'Аудиоданные в программах', description: 'Каналы, кадры, блоки и буферы' },
  {
    id: 'processing',
    title: 'Обработка звука',
    description: 'Динамика, эффекты и их параметры',
  },
  {
    id: 'synthesis',
    title: 'Синтез',
    description: 'Осцилляторы, огибающие и фильтры синтезатора',
  },
  {
    id: 'cpp',
    title: 'C++ для аудио',
    description: 'Язык C++, владение объектами и время жизни в коде плагина',
  },
] as const;

export type TopicId = (typeof topics)[number]['id'];

export const topicIds = topics.map((topic) => topic.id) as [TopicId, ...TopicId[]];
