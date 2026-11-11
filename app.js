(() => {
  'use strict';
  const form = document.querySelector('#repair-form');
  const fields = document.querySelector('#form-fields');
  const submit = document.querySelector('#submit-button');
  const refresh = document.querySelector('#refresh-button');
  const formMessage = document.querySelector('#form-message');
  const listMessage = document.querySelector('#list-message');
  const list = document.querySelector('#request-list');
  const filterButtons = document.querySelectorAll('.filter-button');
  const filterMessage = document.querySelector('#filter-message');
  let selectedUrgency = '全部';
  let loadedRequests = null;
  let client;
  let submitting = false;
  function message(element, text, type = '') {
    element.textContent = text;
    element.className = `message ${type}`;
    element.hidden = !text;
  }
  function errorText(error) {
    return error?.message || '網路連線失敗，請稍後再試。';
  }
  function element(tag, className, text) {
    const node = document.createElement(tag);
    node.className = className;
    node.textContent = text;
    return node;
  }
  function render(requests) {
    list.replaceChildren();
    for (const request of requests) {
      const card = element('li', 'request-card', '');
      const top = element('div', 'card-top', '');
      top.append(element('h3', 'card-title', request.location));
      const tags = element('div', 'tags', '');
      const urgencyClass = { '高': 'high', '中': 'medium', '低': 'low' }[request.urgency] || 'low';
      tags.append(element('span', 'tag', request.category), element('span', `tag urgency-${urgencyClass}`, `${request.urgency}緊急`), element('span', 'tag', request.status));
      top.append(tags);
      const date = new Date(request.created_at);
      const time = Number.isNaN(date.getTime()) ? '時間未知' : date.toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false });
      card.append(top, element('p', 'card-description', request.description), element('p', 'card-meta', `${request.reporter_name} · ${time}（台北時間）`));
      list.append(card);
    }
  }
  function applyFilter() {
    if (loadedRequests === null) return;
    const visibleRequests = selectedUrgency === '全部'
      ? loadedRequests
      : loadedRequests.filter(request => request.urgency === selectedUrgency);
    render(visibleRequests);
    message(filterMessage, loadedRequests.length && !visibleRequests.length
      ? `最近 20 筆紀錄中，沒有緊急程度為「${selectedUrgency}」的報修。` : '');
  }
  filterButtons.forEach(button => {
    button.addEventListener('click', () => {
      selectedUrgency = button.dataset.urgency;
      filterButtons.forEach(item => item.setAttribute('aria-pressed', String(item === button)));
      applyFilter();
    });
  });
  async function loadRequests() {
    refresh.disabled = true;
    list.setAttribute('aria-busy', 'true');
    message(listMessage, '正在載入報修紀錄…');
    try {
      const { data, error } = await client.from('repair_requests')
        .select('id,reporter_name,location,category,description,urgency,status,created_at')
        .order('created_at', { ascending: false }).order('id', { ascending: false }).limit(20);
      if (error) throw error;
      loadedRequests = data || [];
      applyFilter();
      message(listMessage, data?.length ? '' : '目前還沒有報修紀錄。');
    } catch (error) {
      message(listMessage, `清單載入失敗：${errorText(error)} 可按「重新整理」重試。`, 'error');
    } finally {
      refresh.disabled = false;
      list.setAttribute('aria-busy', 'false');
    }
  }
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (submitting || !form.reportValidity()) return;
    if (!navigator.onLine) {
      message(formMessage, '目前離線，報修尚未送出。請恢復連線後再按送出；內容僅保留在目前頁面，關閉或重新載入會遺失。', 'error');
      return;
    }
    if (!client) {
      message(formMessage, '服務尚未連線，報修未送出。請確認網路後重新載入；重新載入前請先另行記下填寫內容。', 'error');
      return;
    }
    const values = new FormData(form);
    const payload = Object.fromEntries(['reporter_name', 'location', 'category', 'description', 'urgency'].map(key => [key, String(values.get(key) || '').trim()]));
    if (Object.values(payload).some(value => !value)) {
      message(formMessage, '請完整填寫所有欄位，內容不可只有空白。', 'error');
      return;
    }
    submitting = true;
    fields.disabled = true;
    submit.textContent = '送出中…';
    message(formMessage, '正在送出報修…');
    try {
      const { error } = await client.from('repair_requests').insert(payload);
      if (error) throw error;
      form.reset();
      message(formMessage, '報修已成功送出！可在下方查看最新紀錄。', 'success');
      await loadRequests();
    } catch (error) {
      message(formMessage, `送出失敗：${errorText(error)} 輸入內容已保留。`, 'error');
    } finally {
      submitting = false;
      fields.disabled = false;
      submit.textContent = '送出報修 →';
    }
  });
  try {
    const config = window.REPAIR_CONFIG;
    client = window.supabase.createClient(config.supabaseUrl, config.supabasePublishableKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
    refresh.addEventListener('click', loadRequests);
    loadRequests();
  } catch {
    refresh.disabled = true;
    message(formMessage, '服務初始化失敗，請檢查網路連線後重新載入頁面。', 'error');
    message(listMessage, '目前無法讀取報修紀錄。', 'error');
  }
})();
