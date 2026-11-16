(() => {
  'use strict';
  const installButton = document.querySelector('#install-button');
  const connectionMessage = document.querySelector('#connection-message');
  const pwaMessage = document.querySelector('#pwa-message');
  let installPrompt;
  function updateConnection() {
    connectionMessage.hidden = navigator.onLine;
    connectionMessage.textContent = navigator.onLine ? '' : '目前離線：可開啟已快取的頁面，但無法記帳或更新清單。填寫內容不會自動補送，關閉或重新載入會遺失。';
  }
  updateConnection();
  window.addEventListener('online', updateConnection);
  window.addEventListener('offline', updateConnection);
  window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    installPrompt = event;
    installButton.hidden = false;
  });
  installButton.addEventListener('click', async () => {
    if (!installPrompt) return;
    installButton.hidden = true;
    try { await installPrompt.prompt(); await installPrompt.userChoice; }
    catch {
      pwaMessage.textContent = '未完成安裝，可使用瀏覽器選單的安裝或加入主畫面功能。';
      pwaMessage.hidden = false;
    }
    finally { installPrompt = null; }
  });
  window.addEventListener('appinstalled', () => {
    installPrompt = null;
    installButton.hidden = true;
  });
  if ('serviceWorker' in navigator && window.isSecureContext) {
    window.addEventListener('load', async () => {
      try {
        const registration = await navigator.serviceWorker.register('./sw.js', { scope: './', updateViaCache: 'none' });
        const showUpdate = () => {
          pwaMessage.replaceChildren('有新版本可以使用。', updateButton);
          pwaMessage.hidden = false;
        };
        const updateButton = document.createElement('button');
        updateButton.type = 'button';
        updateButton.className = 'secondary small';
        updateButton.textContent = '立即更新';
        updateButton.addEventListener('click', () => {
          const editing = document.querySelector('#entry-form')?.elements.amount?.value;
          if (editing && !window.confirm('表單中尚未送出的內容會清除，確定要立即更新嗎？')) return;
          updateButton.disabled = true;
          registration.waiting?.postMessage({ type: 'SKIP_WAITING' });
        });
        let reloading = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          if (reloading || !updateButton.disabled) return;
          reloading = true;
          window.location.reload();
        });
        // 每次開啟與回到前景時檢查是否有新版本。
        registration.update().catch(() => {});
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') registration.update().catch(() => {});
        });
        if (registration.waiting) showUpdate();
        registration.addEventListener('updatefound', () => {
          const worker = registration.installing;
          worker?.addEventListener('statechange', () => {
            if (worker.state === 'installed' && navigator.serviceWorker.controller) showUpdate();
          });
        });
      } catch {
        pwaMessage.textContent = '離線功能尚未啟用，請在連線正常時重新開啟網頁。';
        pwaMessage.hidden = false;
      }
    });
  }
})();
