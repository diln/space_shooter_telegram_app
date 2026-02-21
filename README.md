# Space Shooter Telegram Mini App Monorepo

Monorepo для Telegram Mini App:
- `backend` — FastAPI + SQLAlchemy 2 + Alembic + PostgreSQL
- `frontend` — React + Vite + TypeScript + Canvas 2D game
- `bot` — python-telegram-bot (polling) + internal notify API
- `docker-compose.yml` — единый запуск (локально и на сервере)

## Быстрый запуск

1. Создайте env-файлы:

```bash
cp .env.example .env
cp backend/.env.example backend/.env
cp bot/.env.example bot/.env
cp frontend/.env.example frontend/.env
```

2. Заполните значения:

- `.env`
  - `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`
  - `FRONTEND_PORT` (обычно `8080`)
  - `EDGE_SHARED_NETWORK` (обычно `edge_shared`)
- `backend/.env`
  - `BOT_TOKEN`
  - `JWT_SECRET` (сгенерируйте: `openssl rand -hex 32`)
  - `ADMIN_TELEGRAM_IDS`
  - `BOT_INTERNAL_TOKEN` (сгенерируйте: `openssl rand -hex 32`)
  - `ALLOWED_ORIGINS=https://app1.adminremote.ru`
  - `MINI_APP_URL=https://app1.adminremote.ru`
- `bot/.env`
  - `BOT_TOKEN`
  - `MINI_APP_URL=https://app1.adminremote.ru`
  - `ADMIN_TELEGRAM_IDS`
  - `INTERNAL_API_TOKEN` (должен совпадать с `BOT_INTERNAL_TOKEN`)

3. Запустите:

```bash
docker compose up -d --build
```

4. Проверяйте:

```bash
docker compose ps
docker compose logs -f
```

## Интеграция с существующим edge (`lab`)

В этом проекте `frontend` подключается к сети `edge_shared` и доступен как `space_frontend:80`.

### 1) Caddy (`/opt/lab/caddy/Caddyfile`)

```caddy
app1.adminremote.ru {
  reverse_proxy space_frontend:80
}
```

### 2) HAProxy (`/opt/lab/haproxy/haproxy.cfg`)

В `frontend fe_tls_in` добавьте:

```haproxy
  acl sni_space_app req.ssl_sni -i app1.adminremote.ru
  use_backend be_space_app if sni_space_app
```

В конец файла добавьте:

```haproxy
backend be_space_app
  server caddy caddy:443 check resolvers docker init-addr last,libc,none
```

### 3) Перезапуск edge

```bash
cd /opt/lab
docker compose up -d caddy haproxy
```

Важно: контейнеры `lab` (`caddy`, `haproxy`) должны быть подключены к сети `edge_shared`.

## Почему backend падал с `password authentication failed`

Причина: пароль пользователя `app` в Postgres не совпал с паролем, который backend использует в `DATABASE_URL`.

Сейчас `DATABASE_URL` собирается автоматически из `.env` (`POSTGRES_USER/POSTGRES_PASSWORD/POSTGRES_DB`), поэтому держите пароль в одном месте: в корневом `.env`.

Если БД уже была и пароль менялся:

1. Без потери данных — сменить пароль в БД:

```bash
docker compose exec postgres psql -U app -d postgres -c "ALTER USER app WITH PASSWORD 'change_me_strong';"
# подставьте ваши реальные user/password из .env
```

2. С потерей данных (быстрее для теста):

```bash
docker compose down -v
docker compose up -d --build
```

## Безопасность

- Верификация Telegram WebApp `initData` на backend (HMAC SHA-256)
- Сессия в `httpOnly` cookie
- Admin endpoints: валидная сессия + `ADMIN_TELEGRAM_IDS`
- Game endpoints: только `APPROVED` пользователи
