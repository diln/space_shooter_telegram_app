import asyncio
import logging
from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI, Header, HTTPException, status
from pydantic import BaseModel
from telegram import InlineKeyboardButton, InlineKeyboardMarkup, Update, WebAppInfo
from telegram.ext import Application, CommandHandler, ContextTypes

from app.config import Settings, get_settings

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

settings = get_settings()
application: Application | None = None


class NewRequestPayload(BaseModel):
    request_id: int
    telegram_id: int
    username: str | None = None
    first_name: str
    last_name: str | None = None
    comment: str | None = None


async def start_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    del context
    keyboard = InlineKeyboardMarkup(
        [[InlineKeyboardButton(text="Open Space Shooter", web_app=WebAppInfo(url=settings.mini_app_url))]]
    )
    await update.effective_chat.send_message(
        "Welcome! Open the Mini App and request access.",
        reply_markup=keyboard,
    )


async def admin_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    del context
    if update.effective_user is None or update.effective_user.id not in settings.admin_telegram_ids:
        await update.effective_chat.send_message("Admin access required.")
        return

    keyboard = InlineKeyboardMarkup(
        [[InlineKeyboardButton(text="Open Admin Panel", web_app=WebAppInfo(url=f"{settings.mini_app_url}/admin"))]]
    )
    await update.effective_chat.send_message("Open admin panel:", reply_markup=keyboard)


@asynccontextmanager
async def lifespan(app: FastAPI):
    del app
    global application

    application = Application.builder().token(settings.bot_token).build()
    application.add_handler(CommandHandler("start", start_command))
    application.add_handler(CommandHandler("admin", admin_command))

    await application.initialize()
    await application.start()
    if application.updater is None:
        raise RuntimeError("Bot updater is not configured")
    await application.updater.start_polling()

    logger.info("Telegram bot polling started")

    try:
        yield
    finally:
        if application.updater:
            await application.updater.stop()
        await application.stop()
        await application.shutdown()
        logger.info("Telegram bot polling stopped")


app = FastAPI(title="space-shooter-bot", lifespan=lifespan)


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/internal/new-request")
async def notify_new_request(
    payload: NewRequestPayload,
    x_internal_token: str = Header(default=""),
) -> dict[str, bool]:
    if x_internal_token != settings.internal_api_token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid internal token")

    if application is None:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Bot is not ready")

    username_line = f"@{payload.username}" if payload.username else "(no username)"
    name_line = payload.first_name if not payload.last_name else f"{payload.first_name} {payload.last_name}"
    comment_line = payload.comment or "(empty)"

    message = (
        "New access request\n"
        f"Request ID: {payload.request_id}\n"
        f"Telegram ID: {payload.telegram_id}\n"
        f"Username: {username_line}\n"
        f"Name: {name_line}\n"
        f"Comment: {comment_line}"
    )

    keyboard = InlineKeyboardMarkup(
        [[InlineKeyboardButton(text="Open Admin", web_app=WebAppInfo(url=f"{settings.mini_app_url}/admin"))]]
    )

    for admin_id in settings.admin_telegram_ids:
        try:
            await application.bot.send_message(chat_id=admin_id, text=message, reply_markup=keyboard)
        except Exception as exc:
            logger.warning("Failed to notify admin %s: %s", admin_id, exc)

    return {"ok": True}


async def serve() -> None:
    config = uvicorn.Config(
        app,
        host=settings.internal_api_host,
        port=settings.internal_api_port,
        log_level="info",
    )
    server = uvicorn.Server(config)
    await server.serve()


if __name__ == "__main__":
    asyncio.run(serve())
