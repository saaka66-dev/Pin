(() => {
  'use strict';
  const CATEGORIES = {
    '支出': ['餐飲', '交通', '購物', '居住', '娛樂', '醫療', '其他'],
    '收入': ['薪資', '獎金', '投資', '其他']
  };
  const MONTH_LIMIT = 500;
  const form = document.querySelector('#entry-form');
  const fields = document.querySelector('#form-fields');
  const submit = document.querySelector('#submit-button');
  const refresh = document.querySelector('#refresh-button');
  const categorySelect = form.elements.category;
  const dateInput = form.elements.entry_date;
  const formMessage = document.querySelector('#form-message');
  const listMessage = document.querySelector('#list-message');
  const listNote = document.querySelector('#list-note');
  const list = document.querySelector('#entry-list');
  const filterButtons = document.querySelectorAll('.filter-button');
  const filterMessage = document.querySelector('#filter-message');
  const sumIncome = document.querySelector('#sum-income');
  const sumExpense = document.querySelector('#sum-expense');
  const sumBalance = document.querySelector('#sum-balance');
  const number = new Intl.NumberFormat('zh-TW', { maximumFractionDigits: 0 });
  const money = { format: value => `${value < 0 ? '−' : ''}NT$${number.format(Math.abs(value))}` };
  let selectedType = '全部';
  let loadedEntries = null;
  let client;
  let submitting = false;

  function message(node, text, type = '') {
    node.textContent = text;
    node.className = `message ${type}`;
    node.hidden = !text;
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
  // Dates are bookkeeping dates in Taiwan time, independent of the device time zone.
  function taipeiToday() {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  }
  function monthRange() {
    const [year, month] = taipeiToday().split('-').map(Number);
    const next = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, '0')}-01`;
    return { start: `${year}-${String(month).padStart(2, '0')}-01`, next, label: `${year} 年 ${month} 月` };
  }
  function fillCategories() {
    const type = form.elements.entry_type.value;
    categorySelect.replaceChildren(new Option('請選擇類別', ''), ...CATEGORIES[type].map(name => new Option(name)));
  }
  function resetForm() {
    form.reset();
    fillCategories();
    dateInput.value = taipeiToday();
  }

  function renderSummary(entries) {
    let income = 0;
    let expense = 0;
    for (const entry of entries) {
      if (entry.entry_type === '收入') income += entry.amount; else expense += entry.amount;
    }
    sumIncome.textContent = money.format(income);
    sumExpense.textContent = money.format(expense);
    sumBalance.textContent = money.format(income - expense);
    sumBalance.className = income - expense < 0 ? 'expense' : '';
  }
  function render(entries) {
    list.replaceChildren();
    for (const entry of entries) {
      const isIncome = entry.entry_type === '收入';
      const card = element('li', 'entry-card', '');
      const top = element('div', 'card-top', '');
      const title = element('div', 'card-heading', '');
      title.append(element('h3', 'card-title', entry.category), element('span', `tag ${isIncome ? 'type-income' : 'type-expense'}`, entry.entry_type), element('span', 'tag', entry.payment_method));
      top.append(title, element('strong', `card-amount ${isIncome ? 'income' : 'expense'}`, `${isIncome ? '+' : '−'}${money.format(entry.amount)}`));
      card.append(top);
      if (entry.note) card.append(element('p', 'card-description', entry.note));
      const created = new Date(entry.created_at);
      const time = Number.isNaN(created.getTime()) ? '時間未知' : created.toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false });
      card.append(element('p', 'card-meta', `${entry.entry_date} · 登記於 ${time}（台北時間）`));
      list.append(card);
    }
  }
  function applyFilter() {
    if (loadedEntries === null) return;
    const visible = selectedType === '全部' ? loadedEntries : loadedEntries.filter(entry => entry.entry_type === selectedType);
    render(visible);
    message(filterMessage, loadedEntries.length && !visible.length ? `本月沒有「${selectedType}」紀錄。` : '');
  }
  filterButtons.forEach(button => {
    button.addEventListener('click', () => {
      selectedType = button.dataset.type;
      filterButtons.forEach(item => item.setAttribute('aria-pressed', String(item === button)));
      applyFilter();
    });
  });

  async function loadEntries() {
    const range = monthRange();
    refresh.disabled = true;
    list.setAttribute('aria-busy', 'true');
    message(listMessage, '正在載入記帳紀錄…');
    try {
      const { data, error } = await client.from('ledger_entries')
        .select('id,entry_date,entry_type,category,amount,payment_method,note,created_at')
        .gte('entry_date', range.start).lt('entry_date', range.next)
        .order('entry_date', { ascending: false }).order('created_at', { ascending: false }).order('id', { ascending: false })
        .limit(MONTH_LIMIT);
      if (error) throw error;
      loadedEntries = data || [];
      const truncated = loadedEntries.length >= MONTH_LIMIT;
      listNote.textContent = `${range.label}，依日期由新到舊排列${truncated ? `；僅顯示最新 ${MONTH_LIMIT} 筆，統計可能不完整` : ''}。`;
      renderSummary(loadedEntries);
      applyFilter();
      message(listMessage, loadedEntries.length ? '' : '本月還沒有記帳紀錄。');
    } catch (error) {
      message(listMessage, `清單載入失敗：${errorText(error)} 可按「重新整理」重試。`, 'error');
    } finally {
      refresh.disabled = false;
      list.setAttribute('aria-busy', 'false');
    }
  }

  form.addEventListener('change', event => {
    if (event.target.name === 'entry_type') fillCategories();
  });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (submitting || !form.reportValidity()) return;
    if (!navigator.onLine) {
      message(formMessage, '目前離線，這筆尚未送出。請恢復連線後再按「記一筆」；內容僅保留在目前頁面，關閉或重新載入會遺失。', 'error');
      return;
    }
    if (!client) {
      message(formMessage, '服務尚未連線，這筆未送出。請確認網路後重新載入；重新載入前請先另行記下內容。', 'error');
      return;
    }
    const values = new FormData(form);
    const payload = {
      entry_date: String(values.get('entry_date') || ''),
      entry_type: String(values.get('entry_type') || ''),
      category: String(values.get('category') || ''),
      amount: Number(values.get('amount')),
      payment_method: String(values.get('payment_method') || ''),
      note: String(values.get('note') || '').trim()
    };
    if (!Number.isInteger(payload.amount) || payload.amount < 1 || payload.amount > 10000000) {
      message(formMessage, '金額須為 1 到 10,000,000 之間的整數。', 'error');
      return;
    }
    submitting = true;
    fields.disabled = true;
    submit.textContent = '送出中…';
    message(formMessage, '正在記錄…');
    try {
      const { error } = await client.from('ledger_entries').insert(payload);
      if (error) throw error;
      resetForm();
      const range = monthRange();
      const inMonth = payload.entry_date >= range.start && payload.entry_date < range.next;
      message(formMessage, inMonth ? '已記錄！可在下方查看本月紀錄。' : `已記錄！日期 ${payload.entry_date} 不在本月，不會出現在本月清單與統計。`, 'success');
      await loadEntries();
    } catch (error) {
      message(formMessage, `送出失敗：${errorText(error)} 輸入內容已保留。`, 'error');
    } finally {
      submitting = false;
      fields.disabled = false;
      submit.textContent = '記一筆 →';
    }
  });

  resetForm();
  try {
    const config = window.LEDGER_CONFIG;
    client = window.supabase.createClient(config.supabaseUrl, config.supabasePublishableKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
    refresh.addEventListener('click', loadEntries);
    loadEntries();
  } catch {
    refresh.disabled = true;
    message(formMessage, '服務初始化失敗，請檢查網路連線後重新載入頁面。', 'error');
    message(listMessage, '目前無法讀取記帳紀錄。', 'error');
  }
})();
