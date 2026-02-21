# Space Shooter Telegram Mini App Monorepo

Готовый монорепозиторий Telegram Mini App:
- `backend` — FastAPI + PostgreSQL
- `frontend` — React + Vite + Canvas game
- `bot` — python-telegram-bot
- `docker-compose.yml` — единый запуск

## 1) Что подготовить заранее

- Домен (или субдомен), который указывает на ваш сервер (`A` запись).
- HTTPS для этого домена (через ваш reverse proxy: Caddy/Nginx/Traefik).
- Telegram бот, созданный через BotFather.

## 2) Откуда брать ключевые значения

- `BOT_TOKEN`
  - В BotFather после `/newbot`.
  - Если токен уже светился, сделайте `/revoke` и используйте новый.
- `ADMIN_TELEGRAM_IDS`
  - Ваш Telegram numeric user id.
  - Получить можно у ботов вроде `@userinfobot` / `@RawDataBot`.
  - Если админов несколько: через запятую, например `123456789,987654321`.
- `JWT_SECRET`
  - Сгенерировать на сервере:
  - `openssl rand -hex 32`
- `BOT_INTERNAL_TOKEN`
  - Сгенерировать на сервере:
  - `openssl rand -hex 32`
  - Это общий секрет между backend и bot.
  - В `bot/.env` значение `INTERNAL_API_TOKEN` должно быть точно таким же.

## 3) Заполнить env-файлы

Скопируйте примеры:

```bash
cp .env.example .env
cp backend/.env.example backend/.env
cp bot/.env.example bot/.env
cp frontend/.env.example frontend/.env
```

### Корневой `.env`

- `POSTGRES_DB` — имя БД.
- `POSTGRES_USER` — пользователь БД.
- `POSTGRES_PASSWORD` — пароль пользователя БД.
- `FRONTEND_PORT` — локальный порт frontend на сервере (обычно `8080`).

### `backend/.env`

- `BOT_TOKEN` — токен из BotFather.
- `JWT_SECRET` — сгенерированный секрет (см. выше).
- `ADMIN_TELEGRAM_IDS` — список Telegram ID админов.
- `BOT_INTERNAL_TOKEN` — внутренний токен backend↔bot.
- `ALLOWED_ORIGINS=https://<APP_DOMAIN>` — публичный домен Mini App.
- `MINI_APP_URL=https://<APP_DOMAIN>` — тот же публичный домен.
- `SESSION_COOKIE_SECURE=true` — оставьте `true` для HTTPS.

### `bot/.env`

- `BOT_TOKEN` — тот же токен из BotFather.
- `MINI_APP_URL=https://<APP_DOMAIN>` — тот же публичный домен.
- `ADMIN_TELEGRAM_IDS` — Telegram ID админов.
- `INTERNAL_API_TOKEN` — должен совпадать с `BOT_INTERNAL_TOKEN` из backend.

## 4) Поднять приложение

```bash
docker compose up -d --build
```

Проверка:

```bash
docker compose ps
docker compose logs -f
```

Локальные health-check endpoints:

- `http://127.0.0.1:<FRONTEND_PORT>/healthz`
- `http://127.0.0.1:8000/health`
- `http://127.0.0.1:8081/health`

## 5) Привязать домен в Telegram (BotFather)

Когда приложение уже запущено и ваш домен отвечает по HTTPS:

1. Откройте BotFather -> ваш бот -> `Mini Apps`.
2. В `Main App` укажите: `https://<APP_DOMAIN>`.
3. В `Menu Button` укажите тот же URL: `https://<APP_DOMAIN>`.

После изменения URL в BotFather перезапуск контейнеров обычно не нужен, если `MINI_APP_URL` в env уже совпадает.

## 6) Проверка полного сценария

1. В Telegram отправьте боту `/start`.
2. Нажмите `Open Space Shooter`.
3. Новый пользователь увидит экран без доступа и нажмёт `Запросить доступ`.
4. Админ открывает `/admin` в Mini App и делает `Approve`.
5. Пользователь открывает `/play`, играет, результат попадает в leaderboard.

## 7) Ротация BOT_TOKEN (если нужен revoke)

1. В BotFather: `/revoke` -> выберите бота -> получите новый токен.
2. Обновите `BOT_TOKEN` в:
   - `backend/.env`
   - `bot/.env`
3. Перезапустите сервисы:

```bash
docker compose up -d --build backend bot
```

## Безопасность

- Верификация Telegram WebApp `initData` на backend (HMAC SHA-256).
- Сессия в `httpOnly` cookie.
- Admin API требует валидную сессию и вхождение в `ADMIN_TELEGRAM_IDS`.
- Game API доступно только пользователям со статусом `APPROVED`.
