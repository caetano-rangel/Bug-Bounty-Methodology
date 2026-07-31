/**
 * postmessage_scanner.js
 *
 * Varre uma lista de URLs e detecta paginas que registram
 * window.addEventListener("message", ...), capturando o
 * codigo-fonte do listener para analise manual posterior.
 *
 * Uso:
 *   node postmessage_scanner.js urls.txt
 *   node postmessage_scanner.js urls.txt cookies.json   <- com sessao logada
 *
 * urls.txt    = uma URL por linha (ex: saida do httpx com https:// completo)
 * cookies.json = export de cookies no formato do puppeteer/EditThisCookie
 *                (array de objetos com pelo menos name, value, domain)
 *
 * Requisitos:
 *   npm install puppeteer
 */

const fs = require("fs");
const puppeteer = require("puppeteer");

const INPUT_FILE = process.argv[2];
const COOKIES_FILE = process.argv[3];
const OUTPUT_FILE = "postmessage_report.json";
const TIMEOUT_MS = 15000;

if (!INPUT_FILE || !fs.existsSync(INPUT_FILE)) {
  console.error("Uso: node postmessage_scanner.js urls.txt [cookies.json]");
  process.exit(1);
}

const urls = fs
  .readFileSync(INPUT_FILE, "utf-8")
  .split("\n")
  .map((l) => l.trim())
  .filter(Boolean);

let cookies = [];
if (COOKIES_FILE) {
  if (!fs.existsSync(COOKIES_FILE)) {
    console.error(`Arquivo de cookies nao encontrado: ${COOKIES_FILE}`);
    process.exit(1);
  }
  try {
    cookies = JSON.parse(fs.readFileSync(COOKIES_FILE, "utf-8"));
    console.log(`Carregados ${cookies.length} cookies de ${COOKIES_FILE}`);
  } catch (e) {
    console.error(`Erro ao parsear ${COOKIES_FILE}: ${e.message}`);
    process.exit(1);
  }
}

// Script injetado ANTES de qualquer JS da pagina rodar.
// Sobrescreve addEventListener pra capturar registros do tipo "message".
const HOOK_SCRIPT = `
  (function() {
    window.__postMessageListeners = [];
    const originalAdd = EventTarget.prototype.addEventListener;
    EventTarget.prototype.addEventListener = function(type, listener, options) {
      if (type === "message") {
        try {
          window.__postMessageListeners.push(listener.toString());
        } catch (e) {}
      }
      return originalAdd.call(this, type, listener, options);
    };
  })();
`;

function checkOriginValidation(listenerSource) {
  // Heuristica simples: procura por padroes comuns de validacao de origin.
  const hasOriginCheck = /event\.origin|e\.origin|\.origin\s*===|\.origin\s*!==|\.origin\.endsWith|\.origin\.includes|\.origin\.match/i.test(
    listenerSource
  );
  const usesWildcardIndicator = /["']\*["']/.test(listenerSource);
  return { hasOriginCheck, usesWildcardIndicator };
}

(async () => {
  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--ignore-certificate-errors", "--no-sandbox"],
  });

  const results = [];

  // Guarda paginas/popups novos abertos durante o clique (ex: janela de
  // OAuth do Google/Okta), pra tambem checar se registraram listener.
  let newPopups = [];
  browser.on("targetcreated", async (target) => {
    try {
      if (target.type() !== "page") return;
      const popupPage = await target.page();
      if (!popupPage) return;
      await popupPage.evaluateOnNewDocument(HOOK_SCRIPT).catch(() => {});
      newPopups.push(popupPage);
    } catch (e) {}
  });

  for (const url of urls) {
    console.log(`\n>> Verificando: ${url}`);
    const page = await browser.newPage();
    newPopups = [];

    try {
      await page.evaluateOnNewDocument(HOOK_SCRIPT);
      await page.setDefaultNavigationTimeout(TIMEOUT_MS);

      // Se um arquivo de cookies foi fornecido, aplica os cookies cujo
      // dominio bate com o host da URL atual (ou subdominio dele).
      if (cookies.length > 0) {
        let hostname;
        try {
          hostname = new URL(url).hostname;
        } catch (e) {
          hostname = "";
        }

        const relevantCookies = cookies.filter((c) => {
          if (!c.domain) return false;
          const cookieDomain = c.domain.replace(/^\./, "");
          return hostname === cookieDomain || hostname.endsWith("." + cookieDomain);
        });

        if (relevantCookies.length > 0) {
          try {
            await page.setCookie(...relevantCookies);
            console.log(`   Aplicados ${relevantCookies.length} cookie(s) de sessao para ${hostname}`);
          } catch (e) {
            console.log(`   Aviso: falha ao aplicar cookies (${e.message})`);
          }
        }
      }

      await page.goto(url, { waitUntil: "networkidle2", timeout: TIMEOUT_MS });
      // pequena espera extra para listeners registrados de forma assincrona
      await new Promise((r) => setTimeout(r, 2000));

      const listenersInitial = await page.evaluate(() => window.__postMessageListeners || []);

      // Tenta clicar em botoes comuns de login/SSO, que costumam so registrar
      // o listener de postMessage no momento em que o popup e aberto.
      const LOGIN_BUTTON_KEYWORDS = [
        "log in", "login", "sign in", "signin", "entrar",
        "continue with google", "continue with", "sso", "single sign-on",
      ];

      const clicked = await page.evaluate((keywords) => {
        const clickable = Array.from(
          document.querySelectorAll("button, a, [role='button']")
        );
        const matches = clickable.filter((el) => {
          const text = (el.innerText || el.textContent || "").trim().toLowerCase();
          return text && keywords.some((k) => text.includes(k));
        });
        const clickedTexts = [];
        matches.slice(0, 3).forEach((el) => {
          try {
            clickedTexts.push((el.innerText || el.textContent || "").trim().slice(0, 40));
            el.click();
          } catch (e) {}
        });
        return clickedTexts;
      }, LOGIN_BUTTON_KEYWORDS);

      if (clicked.length > 0) {
        console.log(`   Cliquei em: ${clicked.map((t) => `"${t}"`).join(", ")}`);
        // popups de OAuth/SSO levam um instante pra abrir e registrar o listener
        await new Promise((r) => setTimeout(r, 3000));

        // Screenshot de debug: mostra visualmente o estado da pagina apos o clique
        const safeName = url.replace(/[^a-z0-9]/gi, "_").slice(0, 60);
        await page.screenshot({ path: `debug_${safeName}.png` }).catch(() => {});
      }

      const listenersAfterClick = await page.evaluate(() => window.__postMessageListeners || []);

      // Junta listeners da pagina principal com os de qualquer popup
      // que tenha aberto durante o clique (ex: janela de OAuth).
      let popupSources = [];
      for (const popupPage of newPopups) {
        try {
          const src = await popupPage.evaluate(() => window.__postMessageListeners || []);
          popupSources = popupSources.concat(src);
        } catch (e) {}
      }

      const listeners = Array.from(
        new Set([...listenersInitial, ...listenersAfterClick, ...popupSources])
      );

      if (listeners.length > 0) {
        console.log(`   [ACHOU] ${listeners.length} listener(s) de "message" registrado(s)`);
        const analyzed = listeners.map((src) => ({
          source: src,
          ...checkOriginValidation(src),
        }));

        analyzed.forEach((l, i) => {
          const flag = l.hasOriginCheck ? "possivel validacao de origin" : "SEM validacao aparente de origin";
          console.log(`   Listener #${i + 1}: ${flag}`);
        });

        results.push({ url, listeners: analyzed });
      } else {
        console.log("   Nenhum listener de message detectado.");
      }
    } catch (err) {
      console.log(`   Erro ao carregar: ${err.message}`);
      results.push({ url, error: err.message });
    } finally {
      await page.close();
    }
  }

  await browser.close();

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(results, null, 2));
  console.log(`\nRelatorio salvo em: ${OUTPUT_FILE}`);
  console.log(`\nResumo: ${results.filter(r => r.listeners?.length).length} de ${urls.length} URLs com listener detectado.`);
})();
