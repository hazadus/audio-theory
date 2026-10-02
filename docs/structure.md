# Целевая структура проекта

Файлы и каталоги добавляются по мере выполнения [плана реализации](plan.md), без пустых заготовок. ✅ отмечает то, что уже есть; остальные пути — целевые. Контракты данных и учебных компонентов описаны в [спецификации](spec.md#данные-материалов-и-учебные-компоненты).

```text
.agents/skills/{commit,execute,issue}/SKILL.md ✅ # Скиллы разработки Codex
.claude/skills/{commit,execute,issue}/SKILL.md ✅ # Скиллы разработки Claude Code
.agents/skills/write-article/SKILL.md ✅ # Вход в скилл Codex
.claude/skills/write-article/SKILL.md ✅ # Вход в скилл Claude Code
.github/workflows/pages.yml ✅        # Проверки, сборка и деплой
docs/ ✅                             # Документация проекта
  overview.md ✅                    # Обзор устройства отдельных частей сайта
  deploy.md ✅                      # CI, GitHub Pages и проверка публикации
  design/ ✅                         # HTML-макеты
  authoring/ ✅                       # Общие правила и шаблон статьи
    rules.md ✅                      # Подготовка и дополнение материалов
    checklist.md ✅                  # Проверки перед авторским чтением и коммитом
    sources.md ✅                    # Пополняемый список рекомендуемых источников
    article-template.mdx ✅          # Собираемый служебный образец
    template-review.md ✅            # Результат прохождения чеклиста на образце
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
    glossary-list.ts ✅              # Порядок, буквенные группы, подписи ссылок, текущая буква
    glossary-controller.ts ✅        # Текущая буква указателя при прокрутке
    git-date.ts ✅                   # Дата последнего коммита файла и «Черновик»
    headings.ts ✅                   # Оглавление H2/H3 и уникальность якорей
    toc.ts ✅                        # Текущий раздел и подпись оглавления
    toc-controller.ts ✅             # Выделение раздела и раскрытие оглавления
    heading-links.ts ✅              # Полный адрес раздела для копирования
    heading-links-controller.ts ✅   # Копирование адреса по нажатию на «#» и статус
    rehype-heading-links.mjs ✅      # Ссылка-якорь «#» в заголовках H2–H4
    reading-progress.ts ✅           # Доля прочитанного и порог кнопки «Наверх»
    reading-progress-controller.ts ✅ # Полоса прогресса и кнопка «Наверх»
    term.ts ✅                       # Положение подсказки термина и уникальные id
    term-controller.ts ✅            # Открытие подсказок при наведении, фокусе и касании
    article-content.ts ✅            # Источники, ссылки, листинги и нумерация блоков
    remark-heading-anchors.mjs ✅    # Синтаксис {#anchor} в заголовках MDX
    reading-time.ts ✅               # Подсчёт слов и время чтения по MDX
    theme.ts ✅                      # Режимы темы, чтение и запись выбора, ранний скрипт
    theme-controller.ts ✅           # Общее состояние темы в окне для всех контролов
    materials.ts ✅                  # Состояние списка: query, фильтр, сортировка, группы
    materials-controller.ts ✅       # Фильтр и сортировка в адресе и истории
    article-list.ts ✅               # Записи статей с датой для главной и списка
    home.ts ✅                       # Группы главной: порядок по дате, лимит карточек, скрытие пустых
    navigation.ts ✅                 # Пункты основной навигации и активный пункт
    search-dialog.ts ✅              # Правила открытия поиска по «/»
    search-controller.ts ✅          # Состояния и выдача поиска в диалоге
    search-view.ts ✅                # Плоский список переходов и безопасный разбор фрагментов
    urls.ts ✅                       # Построитель URL с базовым путём
    rehype-site-urls.mjs ✅           # Преобразование адресов в Markdown/MDX
    rehype-math-errors.mjs ✅         # Ошибки формул блокируют сборку
    rehype-pagefind.mjs ✅            # Исключает дубли формул KaTeX из индекса Pagefind
    rehype-code-blocks.mjs ✅         # Шапка языка и кнопка копирования у блоков кода
    code-block-controller.ts ✅      # Копирование кода и статус результата
  pages/                             # Статические маршруты Astro
    index.astro ✅                   # Главная: тематические группы и карточки
    materials/index.astro ✅         # Все материалы: фильтр, сортировка
    glossary.astro ✅                # Глоссарий: список терминов и указатель букв
    about.astro ✅                   # О проекте: назначение, проверка, предложения
    [slug].astro ✅                  # Маршруты статей из slug
  assets/fonts/ ✅                   # Локальные WOFF2 Literata, Golos Text, JetBrains Mono
  layouts/
    BaseLayout.astro ✅              # Каркас страницы: тема, ссылка перехода, шапка, подвал
    ArticleLayout.astro ✅           # Статья: крошки, метаданные, связи, колонки
  components/
    SiteHeader.astro ✅              # Шапка, навигация и компактное меню
    SiteFooter.astro ✅              # Подвал с описанием и внешними ссылками
    ThemeChoice.astro ✅             # Три варианта темы для мобильного меню
    Icon.astro ✅                    # Иконки Lucide с обводкой 1.5/1.75 px
    Term.astro ✅                    # Термин из глоссария: ссылка, английское название, подсказка
    Callout.astro ✅                 # Врезка: пять типов с меткой, иконкой и формой рамки
    CalloutCase.astro ✅             # Блок «Неверно» / «Верно» внутри врезки об ошибке
    SelfCheck.astro ✅               # Самопроверка на <details><summary>
    Equation.astro ✅                # Блочная формула с номером, прокруткой и <dl> обозначений
    Figure.astro ✅                  # Статичный рисунок: SVG с названием и описанием, подпись «Рис. N.»
    DataTable.astro ✅               # Таблица с caption, scope, закреплённым первым столбцом и прокруткой
    SearchButton.astro ✅            # Кнопка поиска в шапке
    SearchDialog.astro ✅            # Диалог поиска на <dialog>
    ThemeToggle.astro ✅             # Кнопка выбора светлой, тёмной и автоматической темы
  styles/                            # Токены, базовые стили и оформление статьи
    tokens.css ✅                    # Токены дизайн-системы для светлой и тёмной тем
    fonts.css ✅                     # @font-face локальных шрифтов
    base.css ✅                      # Фон, шрифты, заголовки, выделение и фокус
    math.css ✅                      # Локальные стили и шрифты KaTeX
    code.css ✅                      # Подсветка Shiki через --syntax-*, шапка и кнопка блока кода
  site.config.ts ✅                  # Адрес сайта, репозитория и базовый путь
public/
  licenses/ ✅                       # Лицензии KaTeX, шрифтов и Lucide
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
  e2e/search-dialog.spec.ts ✅        # Диалог поиска: фокус, закрытие, «/»
  e2e/search-results.spec.ts ✅       # Состояния выдачи, задержка, ошибка, устаревшие ответы
  e2e/search.spec.ts ✅               # Настоящий API Pagefind в корне и под префиксом
  fixtures/artifact/ ✅              # Контрольная сборка с ошибочной внутренней ссылкой
  unit/articles.test.ts ✅            # Схема статьи, slug и группы
  unit/glossary.test.ts ✅            # Схема глоссария и разрешение целей
  unit/glossary-list.test.ts ✅       # Порядок, группы, указатель, подписи ссылок
  e2e/about.spec.ts ✅                # О проекте: текст, кнопка issue, переход из подвала
  e2e/glossary.spec.ts ✅             # Глоссарий: список, цели, подсказки, поиск, указатель
  unit/git-date.test.ts ✅            # Git-дата во временном репозитории
  unit/headings.test.ts ✅            # Оглавление и повтор якорей
  unit/toc.test.ts ✅                 # Текущий раздел и подпись оглавления
  unit/article-content.test.ts ✅     # Правила содержимого статьи
  unit/heading-anchors.test.ts ✅     # Синтаксис {#anchor} и ошибки
  unit/heading-links.test.ts ✅       # Адрес раздела и ссылка в заголовке
  unit/reading-progress.test.ts ✅    # Границы прогресса и порог «Наверх»
  unit/term.test.ts ✅                # Положение подсказки, id и поиск термина
  unit/reading-time.test.ts ✅        # Подсчёт слов и оценка времени чтения
  unit/navigation.test.ts ✅          # Активный пункт навигации под префиксом
  e2e/layout.spec.ts ✅               # Шапка, подвал, ссылка перехода, компактное меню
  unit/theme.test.ts ✅               # Режимы темы, отказ storage, ранний скрипт
  unit/tokens.test.ts ✅              # Пары тем и пороги контраста токенов
  fixtures/articles/ ✅              # Служебные статьи коллекции
  fixtures/mdx/ ✅                   # Служебные материалы для проверки MDX
astro.config.mjs ✅
tsconfig.json ✅
package.json ✅
package-lock.json ✅
eslint.config.mjs ✅                 # ESLint для JavaScript, TypeScript и Astro
.prettierrc.json ✅                   # Prettier с поддержкой Astro
.prettierignore ✅                    # Исключение макетов и генерируемых файлов
.env.example ✅                       # ARTICLES_DIR и ALLOW_DRAFT_ARTICLES
vitest.config.ts ✅                   # Unit-тесты в Node.js
playwright.config.ts ✅               # Три браузера, корень и префикс
justfile ✅                          # dev, fmt, lint, typecheck, test, test-e2e, build
```

Основной HTML создаётся при сборке. Клиентский JavaScript подключается к поиску, теме, навигации, фильтрам и интерактивному примеру по необходимости; полноценный клиентский фреймворк для первого выпуска не требуется. Макеты служат визуальными образцами: их демонстрационный рантайм не переносится в приложение.
