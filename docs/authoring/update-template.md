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

Допустимые цели: `{ "article": "<slug>", "anchor": "<якорь>" }` (якорь необязателен) и `{ "glossary": "<id термина>" }`. Текст пункта — обычный текст без HTML и Markdown; весь он является ссылкой.
