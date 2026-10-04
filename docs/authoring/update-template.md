# Шаблон записи журнала обновлений

Образец для файлов `src/content/updates/<id>.json`; правила применения — в [общих правилах](rules.md#журнал-обновлений), требования — в [спецификации](../spec.md#записи-и-даты). Имя файла совпадает с `id`. Служебные тестовые записи лежат в `tests/fixtures/updates/` и в публичный журнал не входят.

## Новая статья

Файл `src/content/updates/sampling-published.json`: краткое описание обязательно, пунктов 0–4.

```json
{
  "id": "sampling-published",
  "date": "2026-10-04",
  "order": 1,
  "type": "new",
  "article": "sampling",
  "summary": "Как непрерывный сигнал превращается в отсчёты и что происходит при слишком низкой частоте дискретизации.",
  "items": [
    {
      "text": "Эксперимент с частотой дискретизации",
      "target": { "article": "sampling", "anchor": "sampling-demo" }
    }
  ]
}
```

## Дополнение статьи

Файл `src/content/updates/sampling-nyquist-section.json`: пунктов 1–4, каждый ведёт на изменённое место, `summary` не нужен.

```json
{
  "id": "sampling-nyquist-section",
  "date": "2026-10-12",
  "order": 1,
  "type": "updated",
  "article": "sampling",
  "items": [
    {
      "text": "Новый раздел о частоте Найквиста",
      "target": { "article": "sampling", "anchor": "nyquist" }
    },
    { "text": "Термин «алиасинг»", "target": { "glossary": "aliasing" } }
  ]
}
```

Допустимые цели записей статей: `{ "article": "<slug>", "anchor": "<якорь>" }` (якорь необязателен) и `{ "glossary": "<id термина>" }`. Текст пункта — обычный текст без HTML и Markdown; весь он является ссылкой.

## Трек

Записи трека используют поле `track` вместо `article`; одна запись относится ровно к одному материалу. Правила — в [разделе о треках](rules.md#запись-журнала-для-трека), якорь этапа — `stage-<id>`.

Создание трека, файл `src/content/updates/track-sound-engineer-published.json`: `summary` обязателен, пунктов 0–4.

```json
{
  "id": "track-sound-engineer-published",
  "date": "2026-10-20",
  "order": 1,
  "type": "new",
  "track": "sound-engineer",
  "summary": "Маршрут по опубликованным материалам для тех, кто работает со звуком в студии и на записи.",
  "items": [
    {
      "text": "Первый этап: основы звука",
      "target": { "track": "sound-engineer", "anchor": "stage-basics" }
    }
  ]
}
```

Содержательное изменение состава, порядка или пояснений, файл `src/content/updates/track-sound-engineer-compressor.json`: пунктов 1–4, `summary` не нужен.

```json
{
  "id": "track-sound-engineer-compressor",
  "date": "2026-10-27",
  "order": 1,
  "type": "updated",
  "track": "sound-engineer",
  "items": [
    {
      "text": "Компрессор добавлен в этап обработки",
      "target": { "track": "sound-engineer", "anchor": "stage-processing" }
    }
  ]
}
```

Цель пункта трека — `{ "track": "<slug>", "anchor": "stage-<id этапа>" }` (якорь необязателен), либо статья и термин как выше. Пример показывает формат: slug, id этапов и даты в нём служебные.
