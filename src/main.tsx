import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// Só na versão web publicada: no programa de computador não faz falta, e durante o
// desenvolvimento atrapalharia.
if ("serviceWorker" in navigator && import.meta.env.PROD && !("__TAURI_INTERNALS__" in window)) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}

// A app ocupa o ecrã exato e nunca faz scroll à página inteira; só as listas por dentro.
// Mas o iPhone, ao abrir o teclado, desloca a página, e às vezes não a devolve ao
// fechar, deixando a barra de baixo fora do sítio. Ao sair de um campo, volta ao topo.
const voltarAoSitio = () => {
  if (window.scrollY !== 0 || window.scrollX !== 0) window.scrollTo(0, 0);
};
window.addEventListener("focusout", () => window.setTimeout(voltarAoSitio, 100));
// O teclado acabou de fechar quando a parte visível volta a ocupar o ecrã todo.
window.visualViewport?.addEventListener("resize", () => {
  if (window.visualViewport && window.visualViewport.height >= window.innerHeight - 1) {
    voltarAoSitio();
  }
});
