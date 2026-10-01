# Целевая структура проекта

Файлы и каталоги добавляются по мере выполнения [плана реализации](plan.md), без пустых заготовок. ✅ отмечает то, что уже есть; остальные пути — целевые. Контракты данных и учебных компонентов описаны в [спецификации](spec.md#данные-материалов-и-учебные-компоненты).

```text
.agents/skills/{commit,execute,issue}/SKILL.md ✅ # Скиллы разработки Codex
.claude/skills/{commit,execute,issue}/SKILL.md ✅ # Скиллы разработки Claude Code
.agents/skills/write-article/SKILL.md   # Вход в скилл Codex
.claude/skills/write-article/SKILL.md   # Вход в скилл Claude Code
.github/workflows/pages.yml           # Проверки, сборка и деплой
docs/ ✅                             # Документация проекта
  design/ ✅                         # HTML-макеты
  authoring/                         # Общие правила и шаблон статьи
src/
  content/articles/                  # Пять статей в MDX и будущие материалы
  content.config.ts                  # Схема коллекции статей
  data/topics.ts                     # Четыре тематические группы
  data/glossary.json                  # Единый источник определений
  components/                        # Каркас, учебные блоки, поиск и визуализация
  layouts/                           # Общая страница и страница статьи
  lib/                               # Метаданные, ссылки, расчёты и Web Audio
    urls.ts ✅                       # Построитель URL с базовым путём
    rehype-site-urls.mjs ✅           # Преобразование адресов в Markdown/MDX
    rehype-math-errors.mjs ✅         # Ошибки формул блокируют сборку
  pages/                             # Статические маршруты Astro
    index.astro ✅                   # Начальная страница
  styles/                            # Токены, базовые стили и оформление статьи
    tokens.css ✅                    # Используемые токены дизайн-системы
    math.css ✅                      # Локальные стили и шрифты KaTeX
  site.config.ts ✅                  # Адрес сайта, репозитория и базовый путь
public/
  fonts/                             # Локальные WOFF2 и лицензии
  licenses/katex.txt ✅              # Лицензия KaTeX
scripts/                             # Проверка контента и собранного сайта
  check-mdx.mjs ✅                   # Проверка MDX, формул и ресурсов
tests/                               # Unit-тесты и браузерные сценарии
  unit/urls.test.ts ✅                # Контракт URL и базового пути
  e2e/home.spec.ts ✅                 # Начальная страница на статических сборках
  fixtures/mdx/ ✅                   # Служебные материалы для проверки MDX
astro.config.mjs ✅
tsconfig.json ✅
package.json ✅
package-lock.json ✅
eslint.config.mjs ✅                 # ESLint для JavaScript, TypeScript и Astro
.prettierrc.json ✅                   # Prettier с поддержкой Astro
.prettierignore ✅                    # Исключение макетов и генерируемых файлов
vitest.config.ts ✅                   # Unit-тесты в Node.js
playwright.config.ts ✅               # Три браузера, корень и префикс
justfile ✅                          # dev, fmt, lint, typecheck, test, test-e2e, build
```

Основной HTML создаётся при сборке. Клиентский JavaScript подключается к поиску, теме, навигации, фильтрам и интерактивному примеру по необходимости; полноценный клиентский фреймворк для первого выпуска не требуется. Макеты служат визуальными образцами: их демонстрационный рантайм не переносится в приложение.
