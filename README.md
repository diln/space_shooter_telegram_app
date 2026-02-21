# Space Shooter Telegram Mini App Monorepo

Monorepo для Telegram Mini App:
- `backend` — FastAPI + SQLAlchemy 2 + Alembic + PostgreSQL
- `frontend` — React + Vite + TypeScript + Canvas 2D game
- `bot` — python-telegram-bot (polling) + internal notify API
- `docker-compose.yml` — локальный запуск
- `docker-compose.prod.yml` + `deploy/caddy/Caddyfile` — прод с HTTPS через Caddy
- `docker-compose.edge.yml` — прод за внешним edge proxy (например, ваш `lab`)

## Структура

- `./backend`
- `./frontend`
- `./bot`
- `./deploy/caddy`

## Локальный запуск

1. Подготовьте env:

```bash
cp .env.example .env
cp backend/.env.example backend/.env
cp bot/.env.example bot/.env
cp frontend/.env.example frontend/.env
```

2. Запустите:

```bash
docker compose up --build
```

3. Проверка:
- frontend: [http://localhost:8080](http://localhost:8080)
- backend health: [http://localhost:8000/health](http://localhost:8000/health)
- bot health: [http://localhost:8081/health](http://localhost:8081/health)

## Cloudflared для локального Telegram WebApp

Важно: у вас фронт на `8080`, поэтому туннелить нужно именно `127.0.0.1:8080`.

```bash
cloudflared tunnel --url http://127.0.0.1:8080 --protocol http2
```

Дальше:
1. Берёте выданный `https://...` URL.
2. Ставите его в:
- `backend/.env` -> `MINI_APP_URL=https://...`
- `bot/.env` -> `MINI_APP_URL=https://...`
3. В BotFather обновляете:
- `Mini Apps -> Main App`
- `Mini Apps -> Menu Button`
4. Перезапускаете:

```bash
docker compose up -d --build backend bot frontend
```

## Прод: Caddy + Let's Encrypt (docker compose)

### Файлы
- `docker-compose.prod.yml`
- `docker-compose.edge.yml`
- `deploy/caddy/Caddyfile`
- `.env.prod.example`
- `backend/.env.prod.example`
- `bot/.env.prod.example`

### Шаги

1. DNS:
- создайте `A` запись домена/сабдомена на IP сервера, например `miniapp.example.com -> <SERVER_IP>`.

2. Env:

```bash
cp .env.prod.example .env.prod
cp backend/.env.prod.example backend/.env.prod
cp bot/.env.prod.example bot/.env.prod
```

Заполните минимум:
- `.env.prod`: `APP_DOMAIN`, `ACME_EMAIL`, `POSTGRES_*` (для режима с внешним edge: `EDGE_SHARED_NETWORK=edge_shared`)
- `backend/.env.prod`: `BOT_TOKEN`, `JWT_SECRET`, `ADMIN_TELEGRAM_IDS`, `BOT_INTERNAL_TOKEN`, `ALLOWED_ORIGINS=https://<APP_DOMAIN>`, `MINI_APP_URL=https://<APP_DOMAIN>`
- `bot/.env.prod`: `BOT_TOKEN`, `ADMIN_TELEGRAM_IDS`, `INTERNAL_API_TOKEN`, `MINI_APP_URL=https://<APP_DOMAIN>`

3. Запуск:

```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build
```

4. Проверка:
- откройте `https://<APP_DOMAIN>`
- в BotFather поставьте `https://<APP_DOMAIN>` в `Main App`/`Menu Button`

## Если на сервере заняты 80/443

У вас как раз этот случай. Рекомендуемый вариант: использовать существующий edge (`lab`) и не поднимать `space_caddy_prod`.

1. Создайте общую docker-сеть (один раз):

```bash
docker network create edge_shared
```

2. Поднимите Space Shooter без встроенного caddy, но с подключением frontend к `edge_shared`:

```bash
docker compose --env-file .env.prod -f docker-compose.prod.yml -f docker-compose.edge.yml up -d --build postgres backend bot frontend
```

3. В `lab/caddy/Caddyfile` добавьте:

```caddy
app1.adminremote.ru {
  reverse_proxy space_frontend_prod:80
}
```

4. В `lab/haproxy/haproxy.cfg` в `frontend fe_tls_in` добавьте:

```haproxy
  acl sni_space_app req.ssl_sni -i app1.adminremote.ru
  use_backend be_space_app if sni_space_app
```

И в конец файла:

```haproxy
backend be_space_app
  server caddy caddy:443 check resolvers docker init-addr last,libc,none
```

5. Перезапустите только edge-сервисы `lab`:

```bash
cd /opt/lab
docker compose up -d caddy haproxy
```

## Безопасность (реализовано)

- Верификация Telegram WebApp `initData` на backend (HMAC SHA-256).
- Сессия в `httpOnly` cookie.
- Admin endpoints: валидная сессия + `ADMIN_TELEGRAM_IDS`.
- Game endpoints: только `APPROVED` пользователи.

## Проверка бизнес-сценария

1. Открыть Mini App из Telegram (`/start` -> кнопка).
2. Статус `NEW`, нажать `Запросить доступ`.
3. В админке открыть `/admin`, сделать `Approve`.
4. Пользователь открывает `/play`, играет.
5. После `Game Over` score сохраняется и попадает в leaderboard.
