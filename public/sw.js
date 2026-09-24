// Guarda no telemóvel os ficheiros da app (nunca os dados), para ela abrir sem internet.
// Os dados do salão são guardados à parte, pela própria app.
//
// Regra de ouro: isto nunca pode impedir a app de abrir. Trata só das páginas e dos
// ficheiros da app e, à mínima dúvida, sai da frente e deixa o pedido seguir normalmente.
const CACHE = "flordelotus-app-2";

self.addEventListener("install", (evento) => {
  evento.waitUntil(
    (async () => {
      try {
        const cache = await caches.open(CACHE);
        await cache.add(new Request("/", { cache: "reload" }));
      } catch {
        // Sem rede na instalação: guarda-se na primeira vez que a app for aberta.
      }
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (evento) =>
  evento.waitUntil(
    (async () => {
      try {
        const nomes = await caches.keys();
        await Promise.all(nomes.filter((n) => n !== CACHE).map((n) => caches.delete(n)));
      } catch {
        // paciência
      }
      await self.clients.claim();
    })(),
  ),
);

/** Guarda uma cópia, se der. Nunca deixa o erro chegar à app. */
const guardarCopia = async (pedido, resposta) => {
  try {
    if (resposta && resposta.ok && resposta.type === "basic") {
      const cache = await caches.open(CACHE);
      await cache.put(pedido, resposta.clone());
    }
  } catch {
    // sem espaço, ou o telemóvel não deixa: segue na mesma
  }
};

/** Última linha: uma página simples, em vez de um erro do navegador. */
const paginaSemRede = () =>
  new Response(
    `<!doctype html><html lang="pt-PT"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Flor de Lotus</title>
<style>
  body { margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center;
    padding:24px; font-family:Inter,"Segoe UI",sans-serif; text-align:center;
    background:linear-gradient(140deg,#2e1065,#4c1d95 50%,#065f46); color:#fff }
  div { max-width:320px }
  h1 { font-size:1.4rem; margin:0 0 10px }
  p { opacity:.85; line-height:1.5; margin:0 0 20px }
  button { border:0; border-radius:10px; padding:.8rem 1.4rem; font:inherit; font-weight:700;
    background:#059669; color:#fff }
</style></head>
<body><div>
  <h1>Sem internet</h1>
  <p>A agenda precisa de ligação para abrir pela primeira vez neste aparelho. Liga o Wi-Fi ou os dados e tenta outra vez.</p>
  <button onclick="location.reload()">Tentar outra vez</button>
</div></body></html>`,
    { headers: { "Content-Type": "text/html; charset=utf-8" }, status: 503 },
  );

self.addEventListener("fetch", (evento) => {
  const pedido = evento.request;
  if (pedido.method !== "GET") return;

  let url;
  try {
    url = new URL(pedido.url);
  } catch {
    return;
  }
  // Os pedidos ao Supabase (dados) não passam por aqui.
  if (url.origin !== self.location.origin) return;

  const ePagina = pedido.mode === "navigate";
  const eFicheiroDaApp =
    url.pathname.startsWith("/assets/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/manifest.webmanifest";
  if (!ePagina && !eFicheiroDaApp) return;

  evento.respondWith(
    (async () => {
      // Com rede ganha sempre o servidor: nunca se abre uma versão antiga da app.
      try {
        const resposta = await fetch(pedido);
        evento.waitUntil(guardarCopia(ePagina ? new Request("/") : pedido, resposta));
        return resposta;
      } catch (semRede) {
        // Sem rede: a cópia guardada, se existir. Se o telemóvel não deixar sequer ler
        // a cache (acontece), não se insiste: devolve-se o erro da rede, e nunca um erro
        // nosso, para a app não deixar de abrir por causa disto.
        try {
          const guardada = await caches.match(ePagina ? "/" : pedido);
          if (guardada) return guardada;
        } catch {
          // segue para a página de aviso
        }
        // Nada guardado (primeira vez sem rede, ou o telemóvel limpou a cache): mais vale
        // uma página a explicar do que o erro em bruto do navegador.
        if (ePagina) return paginaSemRede();
        throw semRede;
      }
    })(),
  );
});
