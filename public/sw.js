// Service worker mínimo: existe só para o telemóvel aceitar instalar a app.
// Não guarda nada em cache, de propósito — uma agenda tem de estar sempre atualizada,
// e uma cache antiga mostraria marcações velhas ou uma versão antiga da app.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (evento) => evento.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});
