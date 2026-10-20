// En `npm run dev` (Vite inyecta /@vite/client) no se registra: la caché taparía los cambios.
if ('serviceWorker' in navigator && !document.querySelector('script[src="/@vite/client"]')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js')
      .then(reg => console.log('Service worker registrado, alcance:', reg.scope))
      .catch(err => console.error('Error al registrar el service worker:', err));
  });
}
