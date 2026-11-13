const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff"
  }
});

export async function onRequestGet({ request }) {
  const url = new URL(request.url);
  const username = (url.searchParams.get("username") || "").replace(/^@/, "").trim();
  if (!/^[A-Za-z][A-Za-z0-9_]{4,31}$/.test(username)) {
    return json({ username, status: "invalid", message: "Username должен содержать 5–32 символа: буквы, цифры и подчёркивание." }, 400);
  }

  try {
    const response = await fetch("https://t.me/" + encodeURIComponent(username), {
      headers: { "accept": "text/html", "user-agent": "RacerUserbot/1.0 username availability check" },
      redirect: "follow",
      signal: AbortSignal.timeout(6500)
    });
    const html = await response.text();
    const titleMatch = html.match(/<div[^>]+class=["'][^"']*tgme_page_title[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
    const pageTitle = titleMatch?.[1]?.replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').trim();

    if (response.status === 404 || /Sorry, this page is unavailable/i.test(html)) {
      return json({ username, status: "available", message: "Публичная страница не найдена — имя может быть свободно. Обязательно перепроверь в Telegram." });
    }
    if (pageTitle) {
      return json({ username, status: "occupied", message: "Найдена публичная страница Telegram. Если имя не открывается у тебя, перепроверь в приложении." });
    }
    return json({ username, status: "unknown", message: "Telegram не вернул однозначный результат; доступность не подтверждена." });
  } catch {
    return json({ username, status: "unknown", message: "Не удалось получить ответ Telegram. Попробуй позже." });
  }
}
