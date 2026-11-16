(() => {
  'use strict';
  const CATEGORIES = [
    ['機票', '✈️'], ['飯店', '🏨'], ['交通', '🚆'], ['吃飯', '🍜'], ['買東西', '🛍️'], ['門票', '🎟️'], ['其他', '📌']
  ];
  const ICONS = Object.fromEntries(CATEGORIES);
  const CURRENCIES = [
    ['TWD', '新台幣'], ['JPY', '日圓'], ['KRW', '韓元'], ['USD', '美元'], ['EUR', '歐元'], ['THB', '泰銖'],
    ['HKD', '港幣'], ['CNY', '人民幣'], ['SGD', '新加坡幣'], ['VND', '越南盾'], ['GBP', '英鎊'], ['AUD', '澳幣']
  ];
  const CURRENCY_NAMES = Object.fromEntries(CURRENCIES);
  const LOAD_LIMIT = 1000;
  const ALL_TRIPS = '__all__';
  const form = document.querySelector('#entry-form');
  const fields = document.querySelector('#form-fields');
  const submit = document.querySelector('#submit-button');
  const refresh = document.querySelector('#refresh-button');
  const tripView = document.querySelector('#trip-view');
  const tripOptions = document.querySelector('#trip-options');
  const categorySwitch = document.querySelector('.category-switch');
  const filterGroup = document.querySelector('.type-filters');
  const currencySelect = form.elements.currency;
  const rateInput = form.elements.exchange_rate;
  const rateLabel = document.querySelector('#rate-label');
  const amountInput = form.elements.amount;
  const preview = document.querySelector('#twd-preview');
  const formMessage = document.querySelector('#form-message');
  const listMessage = document.querySelector('#list-message');
  const listNote = document.querySelector('#list-note');
  const list = document.querySelector('#entry-list');
  const filterMessage = document.querySelector('#filter-message');
  const breakdown = document.querySelector('#breakdown');
  const sumTotal = document.querySelector('#sum-total');
  const sumCount = document.querySelector('#sum-count');
  const sumDaily = document.querySelector('#sum-daily');
  const sumDailyLabel = document.querySelector('#sum-daily-label');
  const whole = new Intl.NumberFormat('zh-TW', { maximumFractionDigits: 0 });
  const decimal = new Intl.NumberFormat('zh-TW', { maximumFractionDigits: 2 });
  const twd = value => `${value < 0 ? '−' : ''}NT$${whole.format(Math.abs(value))}`;
  let selectedCategory = '全部';
  let selectedTrip = null;
  let loadedEntries = null;
  let client;
  let submitting = false;

  const store = {
    get(key) { try { return localStorage.getItem(`travel:${key}`); } catch { return null; } },
    set(key, value) { try { localStorage.setItem(`travel:${key}`, value); } catch { /* 非必要 */ } }
  };
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
  // 日期以台北時間為準，與裝置時區無關。
  function taipeiToday() {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Taipei', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  }
  function dayCount(entries) {
    if (!entries.length) return 0;
    const dates = entries.map(entry => Date.parse(`${entry.expense_date}T00:00:00Z`));
    return Math.round((Math.max(...dates) - Math.min(...dates)) / 86400000) + 1;
  }

  // 表單：類別按鈕、幣別與匯率
  categorySwitch.replaceChildren(...CATEGORIES.map(([name, icon], index) => {
    const label = element('label', 'type-option', '');
    const input = document.createElement('input');
    Object.assign(input, { type: 'radio', name: 'category', value: name, required: true, defaultChecked: index === 3 });
    label.append(input, ` ${icon} ${name}`);
    return label;
  }));
  currencySelect.replaceChildren(...CURRENCIES.map(([code, name]) => new Option(`${name} ${code}`, code)));

  function latestRate(currency) {
    return loadedEntries?.find(entry => entry.currency === currency)?.exchange_rate;
  }
  function updateCurrency({ keepRate = false } = {}) {
    const currency = currencySelect.value;
    const isTwd = currency === 'TWD';
    rateLabel.hidden = isTwd;
    rateInput.required = !isTwd;
    if (isTwd) rateInput.value = '1';
    else if (!keepRate || !rateInput.value || rateInput.value === '1') rateInput.value = latestRate(currency) ?? '';
    rateLabel.firstChild.textContent = `匯率（1 ${CURRENCY_NAMES[currency]} = ? 台幣）`;
    updatePreview();
  }
  function previewAmount() {
    const amount = Number(amountInput.value);
    const rate = currencySelect.value === 'TWD' ? 1 : Number(rateInput.value);
    if (!amountInput.value || !rate || !Number.isFinite(amount * rate)) return null;
    return Math.round(amount * rate);
  }
  function updatePreview() {
    const value = previewAmount();
    preview.textContent = value === null ? '—' : twd(value);
  }
  function resetForm() {
    const trip = form.elements.trip_name.value;
    const currency = currencySelect.value;
    const payment = form.elements.payment_method.value;
    form.reset();
    form.elements.expense_date.value = taipeiToday();
    form.elements.trip_name.value = trip || (selectedTrip && selectedTrip !== ALL_TRIPS ? selectedTrip : '');
    currencySelect.value = currency || store.get('currency') || 'TWD';
    form.elements.payment_method.value = payment || '信用卡';
    updateCurrency();
  }

  // 清單、統計與篩選
  function tripNames() {
    const names = [];
    for (const entry of loadedEntries || []) if (!names.includes(entry.trip_name)) names.push(entry.trip_name);
    return names;
  }
  function renderTrips() {
    const names = tripNames();
    if (!names.includes(selectedTrip) && selectedTrip !== ALL_TRIPS) {
      const remembered = store.get('trip');
      selectedTrip = names.includes(remembered) ? remembered : (names[0] ?? ALL_TRIPS);
    }
    tripView.replaceChildren(...names.map(name => new Option(name, name)), new Option('全部旅程', ALL_TRIPS));
    tripView.value = selectedTrip;
    tripOptions.replaceChildren(...names.map(name => new Option(name)));
  }
  function tripEntries() {
    if (!loadedEntries) return [];
    return selectedTrip === ALL_TRIPS ? loadedEntries : loadedEntries.filter(entry => entry.trip_name === selectedTrip);
  }
  function renderSummary(entries) {
    const total = entries.reduce((sum, entry) => sum + entry.twd_amount, 0);
    const days = dayCount(entries);
    sumTotal.textContent = twd(total);
    sumCount.textContent = `${whole.format(entries.length)} 筆`;
    sumDaily.textContent = days ? twd(Math.round(total / days)) : '—';
    sumDailyLabel.textContent = days ? `平均每天（${days} 天）` : '平均每天';
    const sums = CATEGORIES.map(([name, icon]) => ({ name, icon, sum: entries.filter(entry => entry.category === name).reduce((s, entry) => s + entry.twd_amount, 0) }))
      .filter(item => item.sum !== 0).sort((a, b) => b.sum - a.sum);
    const max = Math.max(1, ...sums.map(item => item.sum));
    breakdown.replaceChildren(...sums.map(item => {
      const row = element('li', 'breakdown-row', '');
      const bar = element('span', 'breakdown-bar', '');
      bar.style.width = `${Math.max(0, item.sum) / max * 100}%`;
      const percent = total > 0 && item.sum > 0 ? ` · ${Math.round(item.sum / total * 100)}%` : '';
      row.append(element('span', 'breakdown-name', `${item.icon} ${item.name}`), element('span', 'breakdown-track', ''), element('span', 'breakdown-value', `${twd(item.sum)}${percent}`));
      row.children[1].append(bar);
      return row;
    }));
    if (!sums.length) breakdown.replaceChildren(element('li', 'breakdown-empty', '還沒有花費紀錄。'));
  }
  function render(entries) {
    list.replaceChildren();
    for (const entry of entries) {
      const card = element('li', 'entry-card', '');
      const top = element('div', 'card-top', '');
      const title = element('div', 'card-heading', '');
      title.append(element('h3', 'card-title', `${ICONS[entry.category] ?? ''} ${entry.category}`), element('span', 'tag', entry.payment_method));
      if (entry.twd_amount < 0) title.append(element('span', 'tag type-income', '退款／沖銷'));
      top.append(title, element('strong', `card-amount ${entry.twd_amount < 0 ? 'income' : 'expense'}`, twd(entry.twd_amount)));
      card.append(top);
      if (entry.currency !== 'TWD') card.append(element('p', 'card-foreign', `${CURRENCY_NAMES[entry.currency] ?? entry.currency} ${decimal.format(entry.amount)} × 匯率 ${entry.exchange_rate}`));
      if (entry.note) card.append(element('p', 'card-description', entry.note));
      const created = new Date(entry.created_at);
      const time = Number.isNaN(created.getTime()) ? '時間未知' : created.toLocaleString('zh-TW', { timeZone: 'Asia/Taipei', hour12: false });
      const trip = selectedTrip === ALL_TRIPS ? `${entry.trip_name} · ` : '';
      card.append(element('p', 'card-meta', `${trip}${entry.expense_date} · 登記於 ${time}（台北時間）`));
      list.append(card);
    }
  }
  function renderFilters() {
    filterGroup.replaceChildren(...['全部', ...CATEGORIES.map(([name]) => name)].map(name => {
      const button = element('button', 'filter-button', name === '全部' ? name : `${ICONS[name]} ${name}`);
      button.type = 'button';
      button.setAttribute('aria-pressed', String(name === selectedCategory));
      button.addEventListener('click', () => { selectedCategory = name; renderFilters(); applyView(); });
      return button;
    }));
  }
  function applyView() {
    if (loadedEntries === null) return;
    const entries = tripEntries();
    renderSummary(entries);
    const visible = selectedCategory === '全部' ? entries : entries.filter(entry => entry.category === selectedCategory);
    render(visible);
    message(filterMessage, entries.length && !visible.length ? `這趟旅程沒有「${selectedCategory}」紀錄。` : '');
    message(listMessage, loadedEntries.length ? '' : '還沒有花費紀錄，先在上方記一筆吧！');
  }
  tripView.addEventListener('change', () => {
    selectedTrip = tripView.value;
    if (selectedTrip !== ALL_TRIPS) { store.set('trip', selectedTrip); form.elements.trip_name.value = selectedTrip; }
    applyView();
  });

  async function loadEntries() {
    refresh.disabled = true;
    list.setAttribute('aria-busy', 'true');
    message(listMessage, '正在載入花費紀錄…');
    try {
      const { data, error } = await client.from('travel_expenses')
        .select('id,trip_name,expense_date,category,currency,amount,exchange_rate,twd_amount,payment_method,note,created_at')
        .order('expense_date', { ascending: false }).order('created_at', { ascending: false }).order('id', { ascending: false })
        .limit(LOAD_LIMIT);
      if (error) throw error;
      loadedEntries = (data || []).map(entry => ({ ...entry, amount: Number(entry.amount), exchange_rate: Number(entry.exchange_rate), twd_amount: Number(entry.twd_amount) }));
      const truncated = loadedEntries.length >= LOAD_LIMIT;
      listNote.textContent = `依日期由新到舊排列${truncated ? `；僅載入最新 ${LOAD_LIMIT} 筆，統計可能不完整` : ''}。`;
      renderTrips();
      if (!form.elements.trip_name.value && selectedTrip !== ALL_TRIPS) form.elements.trip_name.value = selectedTrip;
      if (currencySelect.value !== 'TWD' && !rateInput.value) updateCurrency();
      applyView();
    } catch (error) {
      tripView.replaceChildren(new Option('無法載入', ''));
      message(listMessage, `清單載入失敗：${errorText(error)} 可按「重新整理」重試。`, 'error');
    } finally {
      refresh.disabled = false;
      list.setAttribute('aria-busy', 'false');
    }
  }

  form.addEventListener('change', event => {
    if (event.target === currencySelect) { store.set('currency', currencySelect.value); updateCurrency(); }
  });
  form.addEventListener('input', event => {
    if (event.target === amountInput || event.target === rateInput) updatePreview();
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
    const currency = String(values.get('currency') || 'TWD');
    const payload = {
      trip_name: String(values.get('trip_name') || '').trim(),
      expense_date: String(values.get('expense_date') || ''),
      category: String(values.get('category') || ''),
      currency,
      amount: Number(values.get('amount')),
      exchange_rate: currency === 'TWD' ? 1 : Number(values.get('exchange_rate')),
      payment_method: String(values.get('payment_method') || ''),
      note: String(values.get('note') || '').trim()
    };
    const converted = previewAmount();
    if (!payload.trip_name) return message(formMessage, '請填寫旅程名稱。', 'error');
    if (!payload.amount) return message(formMessage, '金額不可為 0；退款或沖銷請輸入負數。', 'error');
    if (!(payload.exchange_rate > 0)) return message(formMessage, '請填寫大於 0 的匯率。', 'error');
    if (converted === null || Math.abs(converted) > 10000000) return message(formMessage, '換算後的台幣金額須在 ±10,000,000 以內。', 'error');
    submitting = true;
    fields.disabled = true;
    submit.textContent = '送出中…';
    message(formMessage, '正在記錄…');
    try {
      const { error } = await client.from('travel_expenses').insert(payload);
      if (error) throw error;
      selectedTrip = payload.trip_name;
      store.set('trip', selectedTrip);
      resetForm();
      message(formMessage, `已記錄到「${payload.trip_name}」：${CURRENCY_NAMES[currency]} ${decimal.format(payload.amount)}，約 ${twd(converted)}。`, 'success');
      await loadEntries();
      updateCurrency();
    } catch (error) {
      message(formMessage, `送出失敗：${errorText(error)} 輸入內容已保留。`, 'error');
    } finally {
      submitting = false;
      fields.disabled = false;
      submit.textContent = '記一筆 →';
    }
  });

  renderFilters();
  resetForm();
  try {
    const config = window.LEDGER_CONFIG;
    client = window.supabase.createClient(config.supabaseUrl, config.supabasePublishableKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
    refresh.addEventListener('click', loadEntries);
    loadEntries();
  } catch {
    refresh.disabled = true;
    tripView.replaceChildren(new Option('無法載入', ''));
    message(formMessage, '服務初始化失敗，請檢查網路連線後重新載入頁面。', 'error');
    message(listMessage, '目前無法讀取花費紀錄。', 'error');
  }
})();
