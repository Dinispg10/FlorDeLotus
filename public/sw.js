// Guarda no telemóvel os ficheiros da app (não os dados), para ela abrir mesmo sem
// internet. Os dados do salão são guardados à parte, pela própria app.
//
// Com rede, ganha sempre o servidor: assim nunca se abre uma versão antiga da app.
// Sem rede, serve-se a última versão guardada; os dados vêm da cópia local e a app
// mostra a faixa a avisar.
const CACHE = "flordelotus-app";

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (evento) =>
  evento.waitUntil(
    (async () => {
      // Caches de versões anteriores deste ficheiro não fazem falta.
      const nomes = await caches.keys();
      await Promise.all(nomes.filter((nome) => nome !== CACHE).map((nome) => caches.delete(nome)));
      await self.clients.claim();
    })(),
  ),
);

self.addEventListener("fetch", (evento) => {
  const pedido = evento.request;

  // Só a app: os pedidos ao Supabase (dados) nunca são guardados aqui.
  if (pedido.method !== "GET" || new URL(pedido.url).origin !== self.location.origin) return;

  evento.respondWith(
    (async () => {
      try {
        const resposta = await fetch(pedido);
        if (resposta && resposta.ok) {
          const copia = resposta.clone();
          caches.open(CACHE).then((cache) => cache.put(pedido, copia));
        }
        return resposta;
      } catch (erro) {
        const guardada = await caches.match(pedido);
        if (guardada) return guardada;
        // Uma página que nunca foi aberta: devolve-se a entrada da app.
        if (pedido.mode === "navigate") {
          const inicio = await caches.match("/");
          if (inicio) return inicio;
        }
        throw erro;
      }
    })(),
  );
});
