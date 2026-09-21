// Muda a versão da app nos três sítios onde ela vive, para ficarem sempre iguais.
// Uso: npm run versao 0.2.0
import { readFileSync, writeFileSync } from "node:fs";

const versao = process.argv[2];

if (!/^\d+\.\d+\.\d+$/.test(versao ?? "")) {
  console.error("Indica a versão nova, por exemplo: npm run versao 0.2.0");
  process.exit(1);
}

const atualizarJson = (caminho) => {
  const dados = JSON.parse(readFileSync(caminho, "utf8"));
  const anterior = dados.version;
  dados.version = versao;
  writeFileSync(caminho, JSON.stringify(dados, null, 2) + "\n");
  return anterior;
};

const anterior = atualizarJson("src-tauri/tauri.conf.json");
atualizarJson("package.json");

// No Cargo.toml só se mexe na versão do próprio pacote, não nas das dependências.
const cargo = readFileSync("src-tauri/Cargo.toml", "utf8");
const cargoNovo = cargo.replace(
  /(\[package\][\s\S]*?\nversion\s*=\s*")[^"]+(")/,
  `$1${versao}$2`,
);
writeFileSync("src-tauri/Cargo.toml", cargoNovo);

console.log(`Versão ${anterior} → ${versao} (tauri.conf.json, package.json, Cargo.toml).`);
console.log("");
console.log("Para publicar:");
console.log(`  git commit -am "Versão ${versao}"`);
console.log(`  git tag v${versao}`);
console.log("  git push && git push --tags");
