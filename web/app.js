(() => {
  const SUPABASE_URL = "https://sbmjexbqvxaxnlwgivnn.supabase.co";
  const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_14jWngiP_uCXHZBt50bfqA_ymwXPf-z";
  const FOUNDER_EMAIL = "suckapupsik@gmail.com";
  const client = window.supabase?.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
  let currentUser = null;
  let currentProfile = null;

  const $ = (id) => document.getElementById(id);
  const toast = (message, error = false) => {
    const node = $("toast");
    node.textContent = message;
    node.classList.toggle("error", error);
    node.classList.add("visible");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => node.classList.remove("visible"), 4200);
  };
  const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const normalize = (s) => s.trim().replace(/^@/, "");
  const validUsername = (s) => /^[A-Za-z][A-Za-z0-9_]{4,31}$/.test(s);
  $("year").textContent = new Date().getFullYear();

  async function signIn() {
    if (!client) return toast("Не удалось инициализировать Supabase.", true);
    const { error } = await client.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin + window.location.pathname }
    });
    if (error) toast("Вход через Google пока не настроен: " + error.message, true);
  }
  async function signOut() {
    const { error } = await client.auth.signOut();
    if (error) toast(error.message, true);
    else toast("Вы вышли из аккаунта.");
  }
  async function loadProfile(user) {
    const { data, error } = await client.from("profiles").select("id,email,display_name,avatar_url,role,telegram_username,telegram_linked_at").eq("id", user.id).maybeSingle();
    if (error) { toast("Не удалось загрузить профиль: " + error.message, true); return null; }
    return data;
  }
  function renderAuth() {
    const loggedIn = !!currentUser;
    $("login-top").hidden = loggedIn;
    $("login-google").hidden = loggedIn;
    $("logout").hidden = !loggedIn;
    $("account-actions").hidden = !loggedIn;
    const name = currentProfile?.display_name || currentUser?.user_metadata?.full_name || currentUser?.email || "Пользователь";
    if (!loggedIn) {
      $("auth-state").innerHTML = '<span class="avatar">?</span><div><strong>Ты не вошёл</strong><p>Войди, чтобы сохранять историю поиска.</p></div>';
      $("admin-nav").hidden = true;
      $("admin").hidden = true;
      return;
    }
    const avatar = currentProfile?.avatar_url || currentUser.user_metadata?.avatar_url;
    $("auth-state").innerHTML = (avatar ? '<img class="avatar" src="' + escapeHtml(avatar) + '" alt="">' : '<span class="avatar">' + escapeHtml(name.slice(0,1).toUpperCase()) + '</span>') +
      '<div><strong>' + escapeHtml(name) + '</strong><p>' + escapeHtml(currentUser.email || "") + '</p><span class="role-pill">' + escapeHtml(currentProfile?.role || "member") + '</span></div>';
    const isAdmin = ["founder", "admin"].includes(currentProfile?.role);
    $("admin-nav").hidden = !isAdmin;
    $("admin").hidden = !isAdmin;
    $("telegram-state").textContent = currentProfile?.telegram_linked_at
      ? "Telegram привязан" + (currentProfile.telegram_username ? ": @" + currentProfile.telegram_username : ".")
      : "Telegram не привязан. Нажми кнопку, чтобы подготовить подтверждение.";
  }
  async function refreshAuth() {
    if (!client) { toast("Supabase не загрузился. Проверь подключение к сети.", true); return; }
    const { data: { session } } = await client.auth.getSession();
    currentUser = session?.user || null;
    currentProfile = currentUser ? await loadProfile(currentUser) : null;
    renderAuth();
    if (currentUser) { await loadHistory(); if (["founder", "admin"].includes(currentProfile?.role)) await loadAdmin(); }
  }
  async function checkOne(username) {
    if (!validUsername(username)) return { username, status: "invalid", message: "Неверный формат (5–32 символа; буквы, цифры и _)." };
    try {
      const response = await fetch("/api/check?username=" + encodeURIComponent(username), { headers: { "Accept": "application/json" } });
      if (!response.ok) throw new Error("Сервис проверки недоступен (" + response.status + ")");
      const result = await response.json();
      return { username, ...result };
    } catch (error) {
      return { username, status: "unknown", message: "Не удалось проверить: " + error.message };
    }
  }
  function renderResults(results) {
    const root = $("results");
    $("result-count").textContent = results.length + (results.length === 1 ? " результат" : " результатов");
    root.classList.remove("empty");
    root.innerHTML = results.map((r) => {
      const labels = { occupied: "Занят", available: "Похоже свободен", unknown: "Не удалось определить", invalid: "Неверный формат" };
      const state = labels[r.status] || labels.unknown;
      return '<div class="result-row"><div class="result-name"><span class="result-at">@</span><strong>' + escapeHtml(r.username) + '</strong></div><div class="result-detail">' + escapeHtml(r.message || "Результат предварительный") + '</div><span class="status status-' + escapeHtml(r.status || "unknown") + '">' + escapeHtml(state) + '</span><a class="open-telegram" href="https://t.me/' + encodeURIComponent(r.username) + '" target="_blank" rel="noopener noreferrer" aria-label="Открыть в Telegram">↗</a></div>';
    }).join("");
  }
  $("search-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const values = $("username").value.split(/[\s,;]+/).map(normalize).filter(Boolean);
    const unique = [...new Set(values)].slice(0, 20);
    if (!unique.length) return toast("Введи хотя бы один юзернейм.", true);
    if (values.length > 20) toast("За один раз можно проверить максимум 20 имён.");
    $("search-button").disabled = true;
    $("search-button").textContent = "Проверяем…";
    $("results").innerHTML = '<div class="loading"><span class="spinner"></span> Проверяем указанные имена…</div>';
    const results = [];
    for (const username of unique) { results.push(await checkOne(username)); }
    renderResults(results);
    if (currentUser) {
      await client.from("search_history").insert(unique.map((query) => ({ user_id: currentUser.id, query })));
      await loadHistory();
    }
    $("search-button").disabled = false;
    $("search-button").textContent = "Проверить";
  });

  async function loadHistory() {
    if (!currentUser) return;
    const { data, error } = await client.from("search_history").select("query,created_at").eq("user_id", currentUser.id).order("created_at", { ascending: false }).limit(10);
    const root = $("history");
    if (error) { root.innerHTML = '<p class="hint">Не удалось загрузить историю.</p>'; return; }
    root.innerHTML = '<h3>Последние поиски</h3>' + (data?.length ? data.map((item) => '<button class="history-item" data-query="' + escapeHtml(item.query) + '">@' + escapeHtml(item.query) + '<span>↗</span></button>').join("") : '<p class="hint">История пока пуста.</p>');
    root.querySelectorAll("[data-query]").forEach((button) => button.addEventListener("click", () => { $("username").value = button.dataset.query; $("search-form").requestSubmit(); }));
  }
  async function loadAdmin() {
    const { data: users, error: usersError } = await client.from("profiles").select("id,email,role,telegram_username,telegram_linked_at,created_at").order("created_at", { ascending: false }).limit(100);
    const { count: searches } = await client.from("search_history").select("*", { count: "exact", head: true });
    const { count: telegram } = await client.from("profiles").select("*", { count: "exact", head: true }).not("telegram_linked_at", "is", null);
    if (usersError) { $("admin-users").innerHTML = '<tr><td colspan="4">Ошибка доступа: ' + escapeHtml(usersError.message) + '</td></tr>'; return; }
    $("stat-users").textContent = String(users?.length ?? 0);
    $("stat-searches").textContent = String(searches ?? 0);
    $("stat-telegram").textContent = String(telegram ?? 0);
    $("admin-users").innerHTML = (users || []).map((user) => '<tr><td>' + escapeHtml(user.email) + '</td><td><span class="role-pill">' + escapeHtml(user.role) + '</span></td><td>' + (user.telegram_username ? '@' + escapeHtml(user.telegram_username) : "—") + '</td><td>' + (user.created_at ? new Date(user.created_at).toLocaleDateString("ru-RU") : "—") + '</td></tr>').join("") || '<tr><td colspan="4">Пользователей пока нет.</td></tr>';
  }
  async function linkTelegram() {
    if (!currentUser) return toast("Сначала войди через Google.", true);
    const tokenBytes = crypto.getRandomValues(new Uint8Array(24));
    const token = Array.from(tokenBytes, (b) => b.toString(16).padStart(2, "0")).join("");
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
    const tokenHash = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const { error } = await client.from("telegram_link_challenges").insert({ user_id: currentUser.id, token_hash: tokenHash, expires_at: expiresAt });
    if (error) return toast("Не удалось создать подтверждение: " + error.message, true);
    await navigator.clipboard?.writeText("/start link_" + token).catch(() => {});
    toast("Команда подтверждения скопирована. Отправь её своему RacerUserbot Telegram-боту в течение 10 минут. Если бот ещё не настроен, привязка пока не завершится.");
    $("telegram-state").textContent = "Команда: /start link_" + token + " — отправь её боту для подтверждения.";
  }
  $("login-top").addEventListener("click", signIn);
  $("login-google").addEventListener("click", signIn);
  $("logout").addEventListener("click", signOut);
  $("link-telegram").addEventListener("click", linkTelegram);
  client?.auth.onAuthStateChange(() => { setTimeout(refreshAuth, 0); });
  refreshAuth();
})();