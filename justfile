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

# Собирает сайт в корне и под префиксом, запускает полный прогон Playwright.
test-e2e:
    npm run test:e2e

# Собирает статический сайт в dist/.
build:
    npm run build
