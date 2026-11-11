(() => {
  'use strict';
  const installButton = document.querySelector('#install-button');
  const connectionMessage = document.querySelector('#connection-message');
  const pwaMessage = document.querySelector('#pwa-message');
  let installPrompt;
  function updateConnection() {
    connectionMessage.hidden = navigator.onLine;
    connectionMessage.textContent = navigator.onLine ? '' : '目前離線：可開啟已快取的頁面，但無法送出或更新清單。填寫內容不會自動補送，關閉或重新載入會遺失。';
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
          pwaMessage.textContent = '新版本已備妥。請先完成目前填寫，再關閉所有報修頁面並重新開啟以更新。';
          pwaMessage.hidden = false;
        };
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
