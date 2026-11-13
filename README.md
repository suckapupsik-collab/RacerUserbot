# RacerUserbot

RacerUserbot is a Telegram username search website, Supabase-backed account system, and optional Telegram linking bot.

## Website

Cloudflare Pages site: https://raceruserbot.pages.dev
Repository: https://github.com/suckapupsik-collab/RacerUserbot

The website is deployed from `web/`. It accepts usernames to check rather than generating usernames. The Pages Function in `functions/api/check.js` inspects Telegram's public page and deliberately returns `unknown` when it cannot determine a result. Its "possibly available" status is heuristic, not an official Telegram availability guarantee.

## Supabase

Project ref: `sbmjexbqvxaxnlwgivnn`
URL: https://sbmjexbqvxaxnlwgivnn.supabase.co

Initial schema includes profiles, search history, Telegram link challenges, and site settings. Row Level Security is enabled. The profile trigger grants the `founder` role to a verified Supabase Auth user whose email is `suckapupsik@gmail.com`.

### Enable Google OAuth

1. In Supabase Dashboard → Authentication → Sign In / Providers, enable Google and enter the Google OAuth Client ID and Client Secret.
2. In Google Cloud Console, create a Web OAuth client and set this authorized redirect URI:
   `https://sbmjexbqvxaxnlwgivnn.supabase.co/auth/v1/callback`
3. In Supabase Authentication → URL Configuration, set Site URL to `https://raceruserbot.pages.dev` and add redirect URLs `https://raceruserbot.pages.dev/**` and `https://*.raceruserbot.pages.dev/**`.
4. Never put the Google client secret or Supabase service-role key in browser code or commit them to Git.

## Telegram account linking bot

The bot validates the one-time challenge created by the signed-in website user and writes the Telegram user ID to that user's profile.

1. Create a Telegram bot using BotFather and obtain its token.
2. Run `python -m pip install -r bot/requirements.txt`.
3. Set `BOT_TOKEN`, `SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY` as private environment variables on the host. Get the service-role key from Supabase Dashboard → Project Settings → API Keys; never expose it to the browser or commit it.
4. Start the bot with `python bot/main.py`.
5. In the website, sign in with Google, press "Привязать Telegram", then send the copied `/start link_...` command to this bot.

Do not deploy the bot with secrets inside source files. Keep the service-role key private.
