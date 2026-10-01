# Показывает доступные команды.
default:
    @just --list

# Запускает сайт в режиме разработки; параметры передаются Astro.
dev *args:
    npm run dev -- {{args}}

# Собирает статический сайт в dist/.
build:
    npm run build
