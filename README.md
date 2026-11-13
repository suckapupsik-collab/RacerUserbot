# RacerUserbot

Starter project for the RacerUserbot username discovery website, Telegram bot, and Cloudflare Worker API.

## Project archive

`RacerUserbot.zip` contains the starter project files. See the archive and its included README for setup instructions.

## Important limitation

Telegram's public Bot API does not provide a general endpoint for checking arbitrary username availability. Until a supported provider is configured, the checker reports `unknown` rather than guessing.
