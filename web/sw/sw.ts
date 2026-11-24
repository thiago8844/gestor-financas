/// <reference lib="webworker" />
// Service worker do PWA: cache dos arquivos do app (precache) + Web Push.
// Fica fora de src/ porque usa os tipos de worker, que conflitam com os do DOM.
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from "workbox-precaching";
import { NavigationRoute, registerRoute } from "workbox-routing";

declare const self: ServiceWorkerGlobalScope;

cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);

// Navegação cai no index.html (SPA), exceto chamadas de API.
registerRoute(new NavigationRoute(createHandlerBoundToURL("/index.html"), { denylist: [/^\/api\//] }));

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});
self.skipWaiting();
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

type PushPayload = { id?: number; title?: string; body?: string; url?: string; tag?: string };

self.addEventListener("push", (event) => {
  let dados: PushPayload = {};
  try {
    dados = event.data?.json() ?? {};
  } catch {
    dados = { body: event.data?.text() };
  }

  event.waitUntil(
    self.registration.showNotification(dados.title ?? "Gestor Finanças", {
      body: dados.body,
      icon: "/web-app-manifest-192x192.png",
      badge: "/favicon-96x96.png",
      // Mesmo tipo de notificação substitui a anterior em vez de empilhar.
      tag: dados.id ? `n-${dados.id}` : dados.tag,
      data: { url: dados.url ?? "/" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url ?? "/", self.location.origin).href;

  event.waitUntil(
    (async () => {
      const janelas = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const aberta = janelas.find((janela) => new URL(janela.url).origin === self.location.origin);

      if (aberta) {
        await aberta.focus();
        // Navega o app já aberto pelo roteador do SPA.
        aberta.postMessage({ type: "NAVIGATE", url });
        return;
      }

      await self.clients.openWindow(url);
    })()
  );
});
