import hashlib
import logging
import os
from datetime import datetime, timezone

import httpx
from telegram import Update
from telegram.ext import Application, CommandHandler, ContextTypes

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
log = logging.getLogger("raceruserbot")
BOT_TOKEN = os.environ["BOT_TOKEN"]
SUPABASE_URL = os.environ["SUPABASE_URL"].rstrip("/")
SUPABASE_SERVICE_ROLE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]


def headers():
    return {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "Authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }


async def start(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    message, user = update.effective_message, update.effective_user
    if not message or not user:
        return
    payload = context.args[0] if context.args else ""
    if not payload.startswith("link_"):
        await message.reply_text(
            "Привет! Я бот привязки Telegram для RacerUserbot.\n\n"
            "Войди на сайте, нажми «Привязать Telegram» и отправь сюда "
            "скопированную команду /start link_…"
        )
        return

    token = payload.removeprefix("link_")
    if len(token) != 48 or any(c not in "0123456789abcdef" for c in token.lower()):
        await message.reply_text("Некорректная команда. Создай новый код на сайте.")
        return

    token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
    now = datetime.now(timezone.utc)
    async with httpx.AsyncClient(timeout=10.0) as client:
        lookup = await client.get(
            f"{SUPABASE_URL}/rest/v1/telegram_link_challenges",
            params={
                "select": "id,user_id,expires_at",
                "token_hash": f"eq.{token_hash}",
                "consumed_at": "is.null",
                "expires_at": f"gt.{now.isoformat()}",
                "limit": "1",
            },
            headers=headers(),
        )
        if lookup.status_code >= 400:
            log.error("Challenge lookup failed: %s %s", lookup.status_code, lookup.text[:300])
            await message.reply_text("Сервис привязки временно недоступен. Попробуй позже.")
            return
        rows = lookup.json()
        if not rows:
            await message.reply_text("Код истёк, не найден или уже использован. Создай новый на сайте.")
            return
        challenge = rows[0]

        # Claim the one-time challenge first, so concurrent/replayed commands cannot rebind it.
        claimed = await client.patch(
            f"{SUPABASE_URL}/rest/v1/telegram_link_challenges",
            params={
                "id": f"eq.{challenge['id']}",
                "consumed_at": "is.null",
                "expires_at": f"gt.{now.isoformat()}",
            },
            json={"consumed_at": now.isoformat()},
            headers=headers(),
        )
        if claimed.status_code >= 400:
            log.error("Challenge claim failed: %s %s", claimed.status_code, claimed.text[:300])
            await message.reply_text("Не удалось подтвердить код. Создай новый.")
            return
        if not claimed.json():
            await message.reply_text("Код уже использован или истёк. Создай новый.")
            return

        linked = await client.patch(
            f"{SUPABASE_URL}/rest/v1/profiles",
            params={"id": f"eq.{challenge['user_id']}"},
            json={
                "telegram_user_id": user.id,
                "telegram_username": user.username,
                "telegram_linked_at": now.isoformat(),
            },
            headers=headers(),
        )
        if linked.status_code >= 400 or not linked.json():
            log.error("Profile link failed: %s %s", linked.status_code, linked.text[:300])
            await message.reply_text("Не удалось привязать аккаунт. Создай новый код и попробуй снова.")
            return

    display = f"@{user.username}" if user.username else user.full_name
    await message.reply_text(f"Готово! Telegram {display} привязан к твоему аккаунту RacerUserbot.")


async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    if update.effective_message:
        await update.effective_message.reply_text(
            "Войди на RacerUserbot, нажми «Привязать Telegram» и отправь боту "
            "скопированную команду /start link_…"
        )


def main() -> None:
    app = Application.builder().token(BOT_TOKEN).build()
    app.add_handler(CommandHandler("start", start))
    app.add_handler(CommandHandler("help", help_command))
    log.info("RacerUserbot Telegram linking bot is starting")
    app.run_polling(allowed_updates=Update.ALL_TYPES)


if __name__ == "__main__":
    main()
