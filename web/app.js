const $ = (s) => document.querySelector(s);
const results = $('#results');
const form = $('#searchForm');
const saved = new Set();
let current = [];

function slugify(s) {
  return s.toLowerCase().replace(/[^a-z0-9_]/g, '').replace(/^_+|_+$/g, '').slice(0, 20);
}
function generate(base, style, minLen, count) {
  const root = slugify(base) || 'racer';
  const tails = {
    mixed: ['hub','zone','wave','core','lab','x','one','ify','space','daily','world','hq','nova','flow'],
    clean: ['app','io','lab','club','live','now','pro','hub','base','team','link','net'],
    bot: ['_bot','bot','_user_bot','_helper_bot','_tg_bot'],
    x: ['x','xx','_x','007','24','_01','_404','x7','_x9']
  }[style] || [];
  const out = new Set();
  if (root.length >= 5) out.add(root);
  for (let i=0; out.size<count && i<500; i++) {
    const tail = tails[i % tails.length];
    let candidate = (i % 3 === 0 ? root + tail : i % 3 === 1 ? root.slice(0, Math.max(2, root.length-1)) + tail : root + '_' + tail.replace(/^_/, ''));
    if (i % 4 === 0) candidate = candidate + (i % 9);
    if (candidate.length >= minLen && candidate.length <= 32 && /^[a-z][a-z0-9_]*$/.test(candidate)) out.add(candidate);
  }
  return [...out].slice(0,count);
}
function render() {
  if (!current.length) return;
  $('#resultCount').textContent = `${current.length} вариантов · доступность не проверена`;
  results.className = 'results-grid';
  results.innerHTML = current.map((name) => `
    <article class="result-card">
      <div><div class="result-name">@${name}</div><span class="result-status">● Не проверено</span></div>
      <div class="result-actions"><button class="mini-btn" data-save="${name}" aria-label="Сохранить">${saved.has(name) ? '★' : '☆'}</button><button class="mini-btn" data-copy="${name}" aria-label="Копировать">⧉</button></div>
    </article>`).join('');
}
form.addEventListener('submit', e => {
  e.preventDefault();
  current = generate($('#query').value, $('#style').value, $('#length').value === 'any' ? 5 : Number($('#length').value), Number($('#count').value));
  render();
});
results.addEventListener('click', async e => {
  const save = e.target.closest('[data-save]')?.dataset.save;
  const copy = e.target.closest('[data-copy]')?.dataset.copy;
  if (save) { saved.has(save) ? saved.delete(save) : saved.add(save); render(); }
  if (copy) { try { await navigator.clipboard.writeText('@'+copy); e.target.textContent='✓'; } catch { e.target.textContent='@'+copy; } }
});
$('#copyAll').addEventListener('click', async () => {
  if (!current.length) { $('#resultCount').textContent='Сначала сгенерируй варианты'; return; }
  try { await navigator.clipboard.writeText(current.map(x=>'@'+x).join('\n')); $('#copyAll').textContent='Скопировано ✓'; }
  catch { $('#copyAll').textContent='Копирование недоступно'; }
});
