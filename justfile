# Показывает доступные команды.
default:
    @just --list

# Запускает сайт в режиме разработки; параметры передаются Astro.
dev *args:
    npm run dev -- {{args}}

# Форматирует исходники средствами Prettier.
fmt:
    npm run fmt

# Проверяет код средствами ESLint.
lint:
    npm run lint

# Проверяет компоненты Astro и типы TypeScript.
typecheck:
    npm run typecheck

# Запускает unit-тесты Vitest.
test:
    npm run test

# Собирает сайт в корне и под префиксом, запускает обязательный прогон Playwright.
test-e2e:
    npm run test:e2e

# Запускает все сценарии во всех шести комбинациях браузера и базового пути.
test-e2e-full:
    npm run test:e2e -- --config playwright.full.config.ts

# Проверяет опубликованную главную и ресурсы; URL включает базовый путь.
test-production url:
    npm run test:production -- {{quote(url)}}

# Собирает HTML и индекс Pagefind в dist/, проверяет локальные ссылки и ресурсы.
build:
    npm run build
