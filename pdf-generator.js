/* global PDFLib, getFormData, events, calculateScore */

(() => {
  "use strict";

  const committeeData = {
    "Comitato Regionale Abruzzese": [
      "Via Montorio al Vomano, 18 c/o Palazzo CONI",
      "67100 L'AQUILA",
      "0862-314532",
      "crabruzzo@federugby.it"
    ],
    "Comitato Provinciale di Bolzano": [
      "Via Cagliari 23/5",
      "39100 BOLZANO",
      "0471-541781",
      "delegazionebolzano@federugby.it"
    ],
    "Comitato Regionale Calabro": [
      "Via Kennedy, 67",
      "87036 RENDE (CS)",
      "0984-1655581",
      "crcalabro@federugby.it"
    ],
    "Comitato Regionale Campano": [
      "Via Alessandro Longo, 46/E",
      "80127 NAPOLI",
      "081-5799057",
      "crcampano@federugby.it"
    ],
    "Comitato Regionale Friuli Venezia Giulia": [
      "P.le Repubblica Argentina 3, Stadio Friuli",
      "33100 UDINE",
      "0432-525433",
      "crfvg@federugby.it"
    ],
    "Comitato Regionale Emilia Romagna": [
      "Via San Leonardo, 110/a",
      "43122 PARMA",
      "0521-1798502 / 0521-1798503",
      "cremiliaromagna@federugby.it"
    ],
    "Comitato Regionale Laziale": [
      "Largo Lauro De Bosis n. 5",
      "00135 ROMA",
      "06-3241943 / 06-3244578",
      "crlazio@federugby.it"
    ],
    "Comitato Regionale Ligure": [
      "Viale Padre Santo 1",
      "16122 GENOVA",
      "010-562513 / 010-584159",
      "crligure@federugby.it"
    ],
    "Comitato Regionale Lombardo": [
      "Via Piranesi, 46",
      "20137 MILANO",
      "02-91091582 / 02-91091573",
      "crlombardo@federugby.it"
    ],
    "Comitato Regionale Marche": [
      "Piazza della Repubblica, 11/b",
      "60035 JESI (AN)",
      "0731-080734 / 328-1484682",
      "crmarche@federugby.it"
    ],
    "Comitato Regionale Piemonte": [
      "Via Giordano Bruno, 191",
      "10134 TORINO",
      "011-3161375 / 011-6165961",
      "crpiemonte@federugby.it"
    ],
    "Comitato Regionale Pugliese": [
      "Via Madonna dell'Arena, 4",
      "70123 BARI",
      "080-5346996",
      "crpuglia@federugby.it"
    ],
    "Comitato Regionale Sardo": [
      "Via Zagabria, 41",
      "09129 CAGLIARI",
      "070-492797",
      "crsardo@federugby.it"
    ],
    "Comitato Regionale Siciliano": [
      "Via del Totolo 46",
      "95126 CATANIA",
      "095-506287 / 095-506421",
      "crsiciliano@federugby.it"
    ],
    "Comitato Regionale Toscano": [
      "Via Piemonte, 52/A",
      "57124 LIVORNO",
      "0586-867071 / 0586-867077",
      "crtoscano@federugby.it"
    ],
    "Comitato Provinciale di Trento": [
      "Via Innsbruck, 23",
      "38121 TRENTO",
      "347-2549179",
      "cptrento@federugby.it"
    ],
    "Comitato Regionale Veneto": [
      "Via Sile 17",
      "31057 SILEA (TV)",
      "0422-460754",
      "crveneto@federugby.it"
    ],
    "Comitato Regionale Umbro": [
      "Via Martiri dei Lager, 65",
      "06100 PERUGIA",
      "075-50024486 / 075-5017085",
      "crumbro@federugby.it"
    ],
    "Ufficio Giudice Sportivo C.O.": [
      "Stadio Olimpico Curva Nord Foro Italico",
      "00135 ROMA",
      "06-36857306 / 800-420690",
      "segreteriags@federugby.it"
    ]
  };

  const scoreTypes = [
    "try",
    "conversion",
    "penalty",
    "drop"
  ];

  function clean(value) {
    return String(value ?? "")
      .replace(/[\r\n]+/g, " ")
      .trim();
  }

  function formatDate(value) {
    if (!value) {
      return "";
    }

    const parts = value.split("-");

    if (parts.length !== 3) {
      return value;
    }

    const [year, month, day] = parts;
    return `${day}/${month}/${year}`;
  }

  function getTeamName(data, team) {
    if (team === "home") {
      return data.match.home || "Società 1";
    }

    return data.match.away || "Società 2";
  }

  function countEvents(team, half, type) {
    return events.filter(matchEvent =>
      matchEvent.team === team &&
      String(matchEvent.half) === String(half) &&
      matchEvent.type === type
    ).length;
  }

  function downloadPdf(bytes, fileName) {
    const blob = new Blob(
      [bytes],
      { type: "application/pdf" }
    );

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = fileName;
    link.style.display = "none";

    document.body.appendChild(link);
    link.click();

    window.setTimeout(() => {
      link.remove();
      URL.revokeObjectURL(url);
    }, 2000);
  }

  function createSafeFileName(value) {
    return String(value || "gara")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/gi, "-")
      .replace(/^-|-$/g, "");
  }

  async function generateOfficialPdf() {
    const message = document.querySelector("#saveMsg");

    if (message) {
      message.textContent =
        "Compilazione del modello ufficiale in corso…";
    }

    try {
      if (!window.PDFLib) {
        throw new Error(
          "La libreria PDF non è stata caricata."
        );
      }

      const response = await fetch(
        "referto-base.pdf?v=7",
        { cache: "no-store" }
      );

      if (!response.ok) {
        throw new Error(
          "Il file referto-base.pdf non è stato trovato nella root."
        );
      }

      const templateBytes = await response.arrayBuffer();

      const {
        PDFDocument,
        StandardFonts,
        rgb
      } = window.PDFLib;

      const pdfDocument =
        await PDFDocument.load(templateBytes);

      const pages = pdfDocument.getPages();

      if (pages.length !== 6) {
        throw new Error(
          `Il modello deve contenere 6 pagine. Pagine trovate: ${pages.length}.`
        );
      }

      const regularFont = await pdfDocument.embedFont(
        StandardFonts.Helvetica
      );

      const boldFont = await pdfDocument.embedFont(
        StandardFonts.HelveticaBold
      );

      const white = rgb(1, 1, 1);
      const black = rgb(0, 0, 0);

      const data = getFormData();

      const fullName = [
        data.referee.firstName,
        data.referee.lastName
      ].filter(Boolean).join(" ");

      const reverseName = [
        data.referee.lastName,
        data.referee.firstName
      ].filter(Boolean).join(" ");

      const committee =
        committeeData[data.referee.committee] ||
        ["", "", "", ""];

      const disciplinaryEvents = events.filter(matchEvent =>
        [
          "yellow",
          "secondYellow",
          "red"
        ].includes(matchEvent.type)
      );

      const changes = events.filter(matchEvent =>
        [
          "temporary",
          "permanent"
        ].includes(matchEvent.type)
      );

      function topToPdfY(page, top, fontSize) {
        return page.getHeight() - top - fontSize;
      }

      function cover(page, x, top, width, height) {
        page.drawRectangle({
          x,
          y: page.getHeight() - top - height,
          width,
          height,
          color: white
        });
      }

      function drawText(
        page,
        value,
        x,
        top,
        fontSize = 9,
        useBold = false,
        maxWidth = 0
      ) {
        const valueToDraw = clean(value);

        if (!valueToDraw) {
          return;
        }

        const selectedFont = useBold
          ? boldFont
          : regularFont;

        let adjustedSize = fontSize;

        if (maxWidth > 0) {
          while (
            adjustedSize > 5 &&
            selectedFont.widthOfTextAtSize(
              valueToDraw,
              adjustedSize
            ) > maxWidth
          ) {
            adjustedSize -= 0.25;
          }
        }

        page.drawText(valueToDraw, {
          x,
          y: topToPdfY(
            page,
            top,
            adjustedSize
          ),
          size: adjustedSize,
          font: selectedFont,
          color: black,
          maxWidth: maxWidth || undefined
        });
      }

      function replaceText(
        page,
        value,
        x,
        top,
        width,
        height,
        fontSize = 9,
        useBold = false
      ) {
        cover(
          page,
          x,
          top,
          width,
          height
        );

        drawText(
          page,
          value,
          x + 1,
          top + 1,
          fontSize,
          useBold,
          width - 2
        );
      }

      function drawMark(page, x, top, enabled) {
        if (!enabled) {
          return;
        }

        drawText(
          page,
          "X",
          x,
          top,
          11,
          true
        );
      }

      /*
       * PAGINA 1 — MAIL
       */

      const page1 = pages[0];

      [
        [65, 83, 190, 13],
        [65, 98, 190, 13],
        [65, 112, 190, 13],
        [65, 140, 190, 14],
        [299, 83, 205, 13],
        [299, 98, 205, 13],
        [299, 112, 205, 13],
        [299, 127, 205, 13],
        [299, 140, 205, 14]
      ].forEach(rectangle => {
        cover(page1, ...rectangle);
      });

      drawText(
        page1,
        fullName,
        66,
        84,
        9,
        false,
        187
      );

      drawText(
        page1,
        data.referee.email,
        66,
        99,
        8,
        false,
        187
      );

      drawText(
        page1,
        data.referee.phone,
        66,
        113,
        9,
        false,
        187
      );

      drawText(
        page1,
        data.referee.card,
        66,
        142,
        9,
        false,
        187
      );

      drawText(
        page1,
        data.referee.committee,
        300,
        84,
        8,
        false,
        202
      );

      drawText(
        page1,
        committee[0],
        300,
        99,
        7,
        false,
        202
      );

      drawText(
        page1,
        committee[1],
        300,
        114,
        8,
        false,
        202
      );

      drawText(
        page1,
        committee[2],
        300,
        128,
        8,
        false,
        202
      );

      drawText(
        page1,
        committee[3],
        300,
        142,
        8,
        false,
        202
      );

      replaceText(
        page1,
        data.referee.phone,
        136,
        279,
        90,
        15,
        10,
        true
      );

      replaceText(
        page1,
        formatDate(data.match.date),
        339,
        279,
        115,
        15,
        10,
        true
      );

      replaceText(
        page1,
        `${data.match.category || ""}: ` +
        `${data.match.home || ""} - ` +
        `${data.match.away || ""}`,
        286,
        309,
        217,
        15,
        9,
        true
      );

      replaceText(
        page1,
        "6",
        354,
        250,
        25,
        14,
        10,
        true
      );

      const attachmentCounts = [
        1,
        2,
        disciplinaryEvents.length > 0 ? 1 : 0,
        0,
        1,
        0,
        1,
        1,
        0
      ];

      const attachmentX = [
        113,
        152,
        193,
        234,
        275,
        315,
        355,
        396,
        436
      ];

      attachmentX.forEach((x, index) => {
        replaceText(
          page1,
          String(attachmentCounts[index]),
          x,
          424,
          27,
          17,
          10,
          true
        );
      });

      drawMark(
        page1,
        53,
        344,
        data.checks?.injuries === "Si"
      );

      replaceText(
        page1,
        data.notes || "",
        66,
        600,
        391,
        100,
        9,
        false
      );

      /*
       * PAGINA 2 — CARTELLINO / MOD. F
       */

      const page2 = pages[1];

      [
        [316, 60, 70, 16],
        [451, 60, 70, 16],
        [187, 81, 100, 17],
        [84, 118, 90, 16],
        [92, 147, 70, 16],
        [188, 147, 70, 16],

        [316, 389, 70, 16],
        [451, 389, 70, 16],
        [187, 410, 100, 17],
        [84, 447, 90, 16],
        [92, 476, 70, 16],
        [188, 476, 70, 16],

        [145, 657, 160, 18],
        [181, 686, 90, 16],
        [300, 758, 160, 18]
      ].forEach(rectangle => {
        cover(page2, ...rectangle);
      });

      drawText(
        page2,
        data.match.home,
        317,
        62,
        8,
        true,
        68
      );

      drawText(
        page2,
        data.match.away,
        452,
        62,
        8,
        true,
        68
      );

      drawText(
        page2,
        data.match.category,
        188,
        83,
        8,
        true,
        98
      );

      drawText(
        page2,
        formatDate(data.match.date),
        86,
        121,
        9,
        true,
        86
      );

      drawText(
        page2,
        data.match.firstStart,
        94,
        150,
        8,
        true,
        66
      );

      drawText(
        page2,
        data.match.firstEnd,
        190,
        150,
        8,
        true,
        66
      );

      drawText(
        page2,
        data.match.home,
        317,
        391,
        8,
        true,
        68
      );

      drawText(
        page2,
        data.match.away,
        452,
        391,
        8,
        true,
        68
      );

      drawText(
        page2,
        data.match.category,
        188,
        412,
        8,
        true,
        98
      );

      drawText(
        page2,
        formatDate(data.match.date),
        86,
        450,
        9,
        true,
        86
      );

      drawText(
        page2,
        data.match.secondStart,
        94,
        479,
        8,
        true,
        66
      );

      drawText(
        page2,
        data.match.secondEnd,
        190,
        479,
        8,
        true,
        66
      );

      drawText(
        page2,
        fullName,
        147,
        660,
        9,
        true,
        156
      );

      drawText(
        page2,
        data.referee.card,
        183,
        689,
        9,
        true,
        85
      );

      drawText(
        page2,
        reverseName,
        303,
        761,
        9,
        false,
        155
      );

      const temporaryChanges = changes.filter(
        matchEvent => matchEvent.type === "temporary"
      );

      ["home", "away"].forEach(team => {
        temporaryChanges
          .filter(matchEvent => matchEvent.team === team)
          .slice(0, 5)
          .forEach((matchEvent, index) => {
            const baseX = team === "away"
              ? 378
              : 244;

            const top = 99 + index * 14;

            drawText(
              page2,
              matchEvent.minute,
              baseX,
              top,
              7,
              false,
              28
            );

            drawText(
              page2,
              matchEvent.out,
              baseX + 38,
              top,
              7,
              false,
              45
            );

            drawText(
              page2,
              matchEvent.in,
              baseX + 84,
              top,
              7,
              false,
              45
            );
          });
      });

      const permanentChanges = changes.filter(
        matchEvent => matchEvent.type === "permanent"
      );

      ["home", "away"].forEach(team => {
        permanentChanges
          .filter(matchEvent => matchEvent.team === team)
          .slice(0, 7)
          .forEach((matchEvent, index) => {
            const baseX = team === "away"
              ? 378
              : 244;

            const top = 547 + index * 14;

            drawText(
              page2,
              matchEvent.minute,
              baseX,
              top,
              7,
              false,
              28
            );

            drawText(
              page2,
              matchEvent.out,
              baseX + 38,
              top,
              7,
              false,
              45
            );

            drawText(
              page2,
              matchEvent.in,
              baseX + 84,
              top,
              7,
              false,
              45
            );
          });
      });

      /*
       * PAGINA 3 — MOD. A
       */

      const page3 = pages[2];

      replaceText(
        page3,
        formatDate(data.match.date),
        420,
        59,
        75,
        17,
        10,
        true
      );

      replaceText(
        page3,
        data.match.time,
        438,
        88,
        60,
        17,
        10,
        true
      );

      replaceText(
        page3,
        data.match.category,
        132,
        117,
        90,
        18,
        9,
        true
      );

      replaceText(
        page3,
        data.match.location,
        286,
        117,
        110,
        18,
        9,
        true
      );

      replaceText(
        page3,
        data.match.field,
        449,
        117,
        90,
        18,
        9,
        true
      );

      replaceText(
        page3,
        fullName,
        104,
        139,
        290,
        18,
        10,
        true
      );

      replaceText(
        page3,
        data.referee.card,
        474,
        139,
        65,
        18,
        10,
        true
      );

      const assistants = (data.team || [])
        .filter(member => member?.name)
        .slice(0, 2);

      assistants.forEach((assistant, index) => {
        replaceText(
          page3,
          assistant.name,
          104,
          154 + index * 15,
          290,
          16,
          9,
          true
        );

        replaceText(
          page3,
          assistant.card,
          474,
          154 + index * 15,
          65,
          16,
          9,
          true
        );
      });

      replaceText(
        page3,
        data.match.firstStart,
        112,
        198,
        42,
        16,
        9,
        true
      );

      replaceText(
        page3,
        data.match.firstEnd,
        162,
        198,
        42,
        16,
        9,
        true
      );

      replaceText(
        page3,
        data.match.secondStart,
        276,
        198,
        42,
        16,
        9,
        true
      );

      replaceText(
        page3,
        data.match.secondEnd,
        325,
        198,
        42,
        16,
        9,
        true
      );

      replaceText(
        page3,
        data.match.home,
        84,
        219,
        130,
        20,
        9,
        true
      );

      replaceText(
        page3,
        data.match.away,
        313,
        219,
        130,
        20,
        9,
        true
      );

      replaceText(
        page3,
        String(calculateScore("home")),
        245,
        219,
        28,
        20,
        12,
        true
      );

      replaceText(
        page3,
        String(calculateScore("away")),
        474,
        219,
        28,
        20,
        12,
        true
      );

      const scoreColumnsHome = [
        166,
        200,
        232,
        262
      ];

      const scoreColumnsAway = [
        395,
        429,
        461,
        491
      ];

      scoreTypes.forEach((type, index) => {
        const homeFirst = countEvents(
          "home",
          1,
          type
        );

        const homeSecond = countEvents(
          "home",
          2,
          type
        );

        const awayFirst = countEvents(
          "away",
          1,
          type
        );

        const awaySecond = countEvents(
          "away",
          2,
          type
        );

        [
          [
            homeFirst,
            scoreColumnsHome[index],
            257
          ],
          [
            homeSecond,
            scoreColumnsHome[index],
            272
          ],
          [
            homeFirst + homeSecond,
            scoreColumnsHome[index],
            286
          ],
          [
            awayFirst,
            scoreColumnsAway[index],
            257
          ],
          [
            awaySecond,
            scoreColumnsAway[index],
            272
          ],
          [
            awayFirst + awaySecond,
            scoreColumnsAway[index],
            286
          ]
        ].forEach(([value, x, top]) => {
          replaceText(
            page3,
            String(value),
            x,
            top,
            20,
            14,
            8,
            true
          );
        });
      });

      ["home", "away"].forEach(team => {
        temporaryChanges
          .filter(matchEvent => matchEvent.team === team)
          .slice(0, 10)
          .forEach((matchEvent, index) => {
            const x = team === "away"
              ? 284
              : 56;

            const top = 384 + index * 14;

            drawText(
              page3,
              matchEvent.number || "",
              x,
              top,
              7,
              false,
              20
            );

            drawText(
              page3,
              matchEvent.out,
              x + 22,
              top,
              7,
              false,
              75
            );

            drawText(
              page3,
              matchEvent.in,
              x + 116,
              top,
              7,
              false,
              75
            );

            drawText(
              page3,
              `${matchEvent.half}/${matchEvent.minute}`,
              x + 194,
              top,
              7,
              false,
              28
            );
          });
      });

      drawMark(
        page3,
        205,
        567,
        disciplinaryEvents.some(
          matchEvent => matchEvent.type === "yellow"
        )
      );

      drawMark(
        page3,
        365,
        567,
        disciplinaryEvents.some(matchEvent =>
          ["red", "secondYellow"].includes(matchEvent.type)
        )
      );

      drawMark(
        page3,
        205,
        596,
        data.checks?.facilities === "Si"
      );

      drawMark(
        page3,
        365,
        596,
        Boolean(
          data.checks?.before ||
          data.checks?.during ||
          data.checks?.after
        )
      );

      drawMark(
        page3,
        502,
        582,
        data.checks?.injuries === "Si"
      );

      replaceText(
        page3,
        reverseName,
        390,
        689,
        120,
        18,
        9,
        false
      );

      /*
       * PAGINA 4 — MOD. C
       */

      const page4 = pages[3];

      const disciplinaryGroups = {
        yellow: disciplinaryEvents.filter(
          matchEvent => matchEvent.type === "yellow"
        ),
        secondYellow: disciplinaryEvents.filter(
          matchEvent => matchEvent.type === "secondYellow"
        ),
        red: disciplinaryEvents.filter(
          matchEvent => matchEvent.type === "red"
        )
      };

      function fillDisciplinaryRows(
        eventList,
        firstTop,
        maximumRows
      ) {
        eventList
          .slice(0, maximumRows)
          .forEach((matchEvent, index) => {
            const top = firstTop + index * 13;

            drawMark(
              page4,
              matchEvent.team === "home"
                ? 57
                : 74,
              top,
              true
            );

            drawText(
              page4,
              matchEvent.person,
              88,
              top,
              8,
              false,
              218
            );

            drawText(
              page4,
              matchEvent.number,
              318,
              top,
              8,
              false,
              30
            );

            drawText(
              page4,
              matchEvent.card,
              359,
              top,
              8,
              false,
              45
            );

            drawText(
              page4,
              matchEvent.half,
              411,
              top,
              8,
              false,
              35
            );

            drawText(
              page4,
              matchEvent.minute,
              460,
              top,
              8,
              false,
              35
            );
          });
      }

      fillDisciplinaryRows(
        disciplinaryGroups.yellow,
        104,
        8
      );

      fillDisciplinaryRows(
        disciplinaryGroups.secondYellow,
        244,
        4
      );

      fillDisciplinaryRows(
        disciplinaryGroups.red,
        341,
        4
      );

      disciplinaryGroups.red
        .slice(0, 4)
        .forEach((matchEvent, index) => {
          drawText(
            page4,
            matchEvent.notes,
            55,
            425 + index * 76,
            8,
            false,
            425
          );
        });

      replaceText(
        page4,
        formatDate(data.match.date),
        201,
        722,
        125,
        16,
        9,
        true
      );

      replaceText(
        page4,
        data.match.home,
        127,
        759,
        95,
        17,
        8,
        true
      );

      replaceText(
        page4,
        data.match.away,
        226,
        759,
        95,
        17,
        8,
        true
      );

      replaceText(
        page4,
        reverseName,
        378,
        765,
        105,
        16,
        8,
        false
      );

      /*
       * PAGINA 5 — MOD. C1
       *
       * Nella beta attuale non è ancora presente una distinzione
       * tra giocatore e altro tesserato. La pagina viene quindi
       * mantenuta con intestazione gara e firma.
       */

      const page5 = pages[4];

      replaceText(
        page5,
        formatDate(data.match.date),
        197,
        723,
        125,
        16,
        9,
        true
      );

      replaceText(
        page5,
        data.match.home,
        125,
        760,
        95,
        17,
        8,
        true
      );

      replaceText(
        page5,
        data.match.away,
        224,
        760,
        95,
        17,
        8,
        true
      );

      replaceText(
        page5,
        reverseName,
        378,
        765,
        105,
        16,
        8,
        false
      );

      /*
       * PAGINA 6 — MOD. D
       */

      const page6 = pages[5];

      replaceText(
        page6,
        `${data.match.category || ""}: ` +
        `${data.match.home || ""} - ` +
        `${data.match.away || ""}`,
        122,
        55,
        300,
        17,
        9,
        true
      );

      replaceText(
        page6,
        formatDate(data.match.date),
        463,
        55,
        72,
        17,
        9,
        true
      );

      drawMark(
        page6,
        402,
        89,
        data.checks?.doctor === "Si"
      );

      drawMark(
        page6,
        485,
        89,
        data.checks?.doctor === "No"
      );

      drawMark(
        page6,
        402,
        106,
        data.checks?.escorts === "Si"
      );

      drawMark(
        page6,
        485,
        106,
        data.checks?.escorts === "No"
      );

      drawMark(
        page6,
        402,
        123,
        data.checks?.manager === "Normale"
      );

      drawMark(
        page6,
        485,
        123,
        data.checks?.manager === "Censurabile"
      );

      drawMark(
        page6,
        402,
        140,
        data.checks?.crowd === "Corretto"
      );

      drawMark(
        page6,
        485,
        140,
        data.checks?.crowd === "Scorretto"
      );

      const security = data.checks?.security || "";

      drawMark(
        page6,
        402,
        158,
        security.includes("Svolte")
      );

      drawMark(
        page6,
        402,
        175,
        security.includes("Richieste")
      );

      drawMark(
        page6,
        402,
        192,
        security.includes("Non richieste")
      );

      drawMark(
        page6,
        402,
        209,
        data.checks?.facilities === "No"
      );

      drawMark(
        page6,
        485,
        209,
        data.checks?.facilities === "Si"
      );

      drawMark(
        page6,
        402,
        226,
        data.checks?.injuries === "No"
      );

      drawMark(
        page6,
        485,
        226,
        data.checks?.injuries === "Si"
      );

      drawMark(
        page6,
        228,
        244,
        Boolean(data.checks?.before)
      );

      drawMark(
        page6,
        359,
        244,
        Boolean(data.checks?.during)
      );

      drawMark(
        page6,
        452,
        244,
        Boolean(data.checks?.after)
      );

      drawText(
        page6,
        data.checks?.details,
        53,
        275,
        9,
        false,
        480
      );

      replaceText(
        page6,
        reverseName,
        360,
        723,
        130,
        18,
        9,
        false
      );

      const completedPdf = await pdfDocument.save();

      const safeTeamName =
        createSafeFileName(data.match.home);

      const fileName =
        `referto-ufficiale-` +
        `${data.match.date || "bozza"}-` +
        `${safeTeamName}.pdf`;

      downloadPdf(
        completedPdf,
        fileName
      );

      if (message) {
        message.textContent =
          "Referto ufficiale generato. Controlla la cartella Download.";
      }
    } catch (error) {
      console.error(
        "Errore generazione referto ufficiale:",
        error
      );

      if (message) {
        message.textContent =
          `Errore generazione PDF: ${error.message}`;
      }
    }
  }

  window.generateOfficialPdf =
    generateOfficialPdf;

  window.addEventListener(
    "DOMContentLoaded",
    () => {
      const button =
        document.querySelector("#pdf");

      if (!button) {
        return;
      }

      button.textContent =
        "Scarica referto ufficiale";

      /*
       * Listener in cattura:
       * sostituisce il vecchio generatore presente in app.js.
       */
      button.addEventListener(
        "click",
        event => {
          event.preventDefault();
          event.stopImmediatePropagation();
          generateOfficialPdf();
        },
        true
      );
    }
  );
})();
