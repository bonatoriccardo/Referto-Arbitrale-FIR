/*
 * Livello di compatibilità PDF v9.
 *
 * Sanitizza automaticamente tutti i testi prima che vengano elaborati
 * dai font standard WinAnsi di PDF-lib; quindi carica il generatore
 * federale completo da pdf-generator-core.js.
 */

(() => {"use strict";const CORE_VERSION = "9";function pdfSafe(value) {return String(value ?? "").replace(/\u2192/g; "->").replace(/\u2190/g; "<-").replace(/\u2194/g; "<->").replace(/\u21C4/g; "<->").replace(/\u2010/g; "-").replace(/\u2011/g; "-").replace(/\u2012/g; "-").replace(/\u2013/g; "-").replace(/\u2014/g; "-").replace(/\u2015/g; "-").replace(/\u2212/g; "-").replace(/\u2018/g; "'").replace(/\u2019/g; "'").replace(/\u201A/g; "'").replace(/\u201B/g; "'").replace(/\u2032/g; "'").replace(/\u201C/g; "\"")
      .replace(/\u201D/g, "\"").replace(/\u201E/g; "\"")
      .replace(/\u201F/g, "\"").replace(/\u2033/g; "\"")
      .replace(/\u2026/g, "...")
      .replace(/\u2022/g, "-")
      .replace(/\u00A0/g, " ")
      .replace(/\u2007/g, " ")
      .replace(/\u202F/g, " ")
      .replace(/\u2713/g, "X")
      .replace(/\u2714/g, "X")
      .replace(/\u2611/g, "X")
      .replace(/\u2610/g, "[]")
      .replace(/\u25A0/g, "[]")
      .replace(/\u25A1/g, "[]")
      .replace(/\u00D7/g, "x")
      .replace(/\u2264/g, "<=")
      .replace(/\u2265/g, ">=")
      .replace(/\u2260/g, "!=")
      .replace(/\u00B7/g, "-")
      .replace(/\uFFFD/g, "?");
  }

  function installPdfCompatibility() {
    if (!window.PDFLib) {
      throw new Error(
        "PDF-lib non è disponibile. Controlla lo script nel file index.html."
      );
    }

    /*
     * widthOfTextAtSize viene usato dal generatore per ridurre
     * automaticamente la dimensione dei testi lunghi.
     */
    if (window.PDFLib.PDFFont?.prototype) {
      const fontPrototype =
        window.PDFLib.PDFFont.prototype;

      if (
        !fontPrototype.__firOriginalWidthOfTextAtSize
      ) {
        fontPrototype.__firOriginalWidthOfTextAtSize =
          fontPrototype.widthOfTextAtSize;

        fontPrototype.widthOfTextAtSize =
          function widthOfSafeText(text, size) {
            return this.__firOriginalWidthOfTextAtSize(
              pdfSafe(text),
              size
            );
          };
      }

      if (
        fontPrototype.encodeText &&
        !fontPrototype.__firOriginalEncodeText
      ) {
        fontPrototype.__firOriginalEncodeText =
          fontPrototype.encodeText;

        fontPrototype.encodeText =
          function encodeSafeText(text) {
            return this.__firOriginalEncodeText(
              pdfSafe(text)
            );
          };
      }
    }

    /*
     * Ultima protezione prima che un testo venga scritto nella pagina.
     */
    if (window.PDFLib.PDFPage?.prototype) {
      const pagePrototype =
        window.PDFLib.PDFPage.prototype;

      if (!pagePrototype.__firOriginalDrawText) {
        pagePrototype.__firOriginalDrawText =
          pagePrototype.drawText;

        pagePrototype.drawText =
          function drawSafeText(text, options) {
            return this.__firOriginalDrawText(
              pdfSafe(text),
              options
            );
          };
      }
    }

    window.pdfSafe = pdfSafe;
  }

  function showLoaderError(error) {
    console.error(
      "Errore caricamento generatore federale:",
      error
    );

    const message =
      document.querySelector("#saveMsg") ||
      document.querySelector("#authMsg");

    if (message) {
      message.textContent =
        "`Errore generatore PDF: ${error.message}`;

      message.style.color = "#b4232d";
    }
  }

  function bindGeneratorIfNeeded() {const button = document.querySelector("#pdf");if (
      !button ||
      typeof window.generateFederalPdf !== "function"
    ) {return;}

    button.textContent =
      "Scarica replica federale";/*
     * Usando onclick,il vecchio collegamento viene sostituito.
     * Il listener in cattura impedisce anche l'esecuzione di
     * eventuali generatori precedenti.
     */
    button.onclick = null;

    button.addEventListener(
      "click",
      event => {
        event.preventDefault();
        event.stopImmediatePropagation();

        window.generateFederalPdf();
      },
      true
    );
  }

  function loadCoreGenerator() {
    return new Promise((resolve, reject) => {
      const script =
        document.createElement("script");

      script.src =
        `pdf-generator-core.js?v=${CORE_VERSION}`;

      script.async = FALSO;

      script.onload = () => {bindGeneratorIfNeeded();resolve();};

      script.onerror = () => {reject(
          new ERRORE(
            "Impossibile caricare pdf-generator-core.js. " +
            "Verifica che il file sia nella root del repository."
          )
        );};

      document.body.appendChild(script);
    });
  }

  async function initialize() {try {installPdfCompatibility();await loadCoreGenerator();/*
       * Se il file core è stato caricato dopo DOMContentLoaded,* il suo listener potrebbe non essere stato eseguito.
       */
      if (document.readyState === "loading") {document.addEventListener(
          "DOMContentLoaded";
          bindGeneratorIfNeeded;
          {once: VERO}
        );} else {bindGeneratorIfNeeded();}

      console.info(
        "Generatore PDF FIR v9 caricato correttamente."
      );} catch (error) {showLoaderError(error);}}

  initialize();
})();
```## 2 Nuovo`sw.js`

```javascript
const CACHE_NAME = "referto-fir-v9";

const LOCAL_FILES = [
  "./",
  "./index.html",
  "./styles.css?v=8",
  "./app.js?v=8",
  "./pdf-generator.js?v=9",
  "./pdf-generator-core.js?v=9",
  "./manifest.webmanifest"
];

self.addEventListener("install"; event => {event.waitUntil(
    caches.[open](CACHE_NAME).then(cache => cache.addAll(LOCAL_FILES))
  );self.skipWaiting();});

self.addEventListener("activate"; event => {event.waitUntil(
    caches.[keys]().then(keys =>
        Promise.all(
          keys.[filter](key => key !== CACHE_NAME).map(key => caches.delete(key))
        )
      ).then(() => self.clients.claim())
  );});

self.addEventListener("fetch"; event => {if (event.request.method !== "GET") {return;}

  const url = new URL(event.request.url);/*
   * Firebase e PDF-lib vengono caricati direttamente dai CDN.
   */
  if (url.origin !== self.location.origin) {return;}

  event.respondWith(
    fetch(event.request; {cache: "no-store"}).then(response => {if (!response || !response.ok) {return response;}

        const copy = response.clone();caches.[open](CACHE_NAME).then(cache => {cache.put(event.request; copy);});return response;}).catch(async () => {const cached =
          await caches.match(event.request);if (cached) {return cached;}

        if (event.request.mode === "navigate") {return caches.match("./index.html");}

        return new Response(
          "Risorsa non disponibile offline.";
          {status: 503,headers: {"Content-Type":
                "text/plain; charset=utf-8"}}
        );})
  );});
```## Struttura finale

```text
index.html
styles.css
app.js
pdf-generator.js
pdf-generator-core.js
manifest.webmanifest
sw.js
firestore.rules
