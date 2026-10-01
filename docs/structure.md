# Целевая структура проекта

Файлы и каталоги добавляются по мере выполнения [плана реализации](plan.md), без пустых заготовок. ✅ отмечает то, что уже есть; остальные пути — целевые. Контракты данных и учебных компонентов описаны в [спецификации](spec.md#данные-материалов-и-учебные-компоненты).

```text
.agents/skills/{commit,execute,issue}/SKILL.md ✅ # Скиллы разработки Codex
.claude/skills/{commit,execute,issue}/SKILL.md ✅ # Скиллы разработки Claude Code
.agents/skills/write-article/SKILL.md   # Вход в скилл Codex
.claude/skills/write-article/SKILL.md   # Вход в скилл Claude Code
.github/workflows/pages.yml ✅        # Проверки, сборка и деплой
docs/ ✅                             # Документация проекта
  deploy.md ✅                      # CI, GitHub Pages и проверка публикации
  design/ ✅                         # HTML-макеты
  authoring/                         # Общие правила и шаблон статьи
src/
  content/articles/                  # Пять статей в MDX и будущие материалы
  content.config.ts ✅               # Коллекция статей
  data/topics.ts ✅                  # Четыре тематические группы
  data/glossary.json ✅               # Единый источник определений
  components/                        # Каркас, учебные блоки, поиск и визуализация
  layouts/                           # Общая страница и страница статьи
  lib/                               # Метаданные, ссылки, расчёты и Web Audio
    articles.ts ✅                   # Схема frontmatter и уникальность slug
    links.ts ✅                      # Цели ссылок и их разрешение с базовым путём
    glossary.ts ✅                   # Схема глоссария и проверка терминов и целей
    urls.ts ✅                       # Построитель URL с базовым путём
    rehype-site-urls.mjs ✅           # Преобразование адресов в Markdown/MDX
    rehype-math-errors.mjs ✅         # Ошибки формул блокируют сборку
  pages/                             # Статические маршруты Astro
    index.astro ✅                   # Начальная страница
    [slug].astro ✅                  # Маршруты статей из slug
  styles/                            # Токены, базовые стили и оформление статьи
    tokens.css ✅                    # Используемые токены дизайн-системы
    math.css ✅                      # Локальные стили и шрифты KaTeX
  site.config.ts ✅                  # Адрес сайта, репозитория и базовый путь
public/
  fonts/                             # Локальные WOFF2 и лицензии
  licenses/katex.txt ✅              # Лицензия KaTeX
scripts/                             # Проверка контента и собранного сайта
  build-artifact.mjs ✅              # Интеграция сборки индекса Pagefind и проверки артефакта
  check-articles.mjs ✅              # Проверка коллекции статей
  check-artifact.mjs ✅              # Локальные страницы, HTML-якоря и ресурсы HTML/CSS
  check-mdx.mjs ✅                   # Проверка MDX, формул и ресурсов
  check-production.mjs ✅            # Сетевая проверка публичной страницы и ресурсов
  test-production.mjs ✅             # CLI для production smoke-проверки
tests/                               # Unit-тесты и браузерные сценарии
  unit/urls.test.ts ✅                # Контракт URL и базового пути
  unit/artifact.test.ts ✅            # Цели ссылок и блокировка неверной сборки
  unit/production.test.ts ✅          # Smoke-команда, HTTP-ошибки и обязательные ресурсы
  e2e/home.spec.ts ✅                 # Начальная страница на статических сборках
  e2e/search.spec.ts ✅               # Настоящий API Pagefind в корне и под префиксом
  fixtures/artifact/ ✅              # Контрольная сборка с ошибочной внутренней ссылкой
  unit/articles.test.ts ✅            # Схема статьи, slug и группы
  unit/glossary.test.ts ✅            # Схема глоссария и разрешение целей
  fixtures/articles/ ✅              # Служебные статьи коллекции
  fixtures/mdx/ ✅                   # Служебные материалы для проверки MDX
astro.config.mjs ✅
tsconfig.json ✅
package.json ✅
package-lock.json ✅
eslint.config.mjs ✅                 # ESLint для JavaScript, TypeScript и Astro
.prettierrc.json ✅                   # Prettier с поддержкой Astro
.prettierignore ✅                    # Исключение макетов и генерируемых файлов
.env.example ✅                       # Тестовая переменная ARTICLES_DIR
vitest.config.ts ✅                   # Unit-тесты в Node.js
playwright.config.ts ✅               # Три браузера, корень и префикс
justfile ✅                          # dev, fmt, lint, typecheck, test, test-e2e, build
```

Основной HTML создаётся при сборке. Клиентский JavaScript подключается к поиску, теме, навигации, фильтрам и интерактивному примеру по необходимости; полноценный клиентский фреймворк для первого выпуска не требуется. Макеты служат визуальными образцами: их демонстрационный рантайм не переносится в приложение.
