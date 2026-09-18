/* global PDFLib, getFormData, events, calculateScore */

(() => {
  "use strict";

  const PAGE_WIDTH = 595.28;
  const PAGE_HEIGHT = 841.89;
  const MARGIN = 50;

  const SCORE_TYPES = [
    { key: "try", label: "METE", points: 5 },
    { key: "conversion", label: "TRASF.", points: 2 },
    { key: "penalty", label: "PUNIZ.", points: 3 },
    { key: "drop", label: "DROP", points: 3 }
  ];

  const COMMITTEES = {
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
      "P.le Repubblica Argentina 3",
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

  function formatDate(value) {
    if (!value) return "";

    const parts = value.split("-");

    if (parts.length !== 3) return value;

    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }

  function safeFileName(value) {
    return String(value || "gara")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/gi, "-")
      .replace(/^-|-$/g, "");
  }

  function countEvents(team, half, type) {
    return events.filter(event =>
      event.team === team &&
      String(event.half) === String(half) &&
      event.type === type
    ).length;
  }

  function teamName(data, team) {
    return team === "home"
      ? data.match.home || "SOCIETÀ N. 1"
      : data.match.away || "SOCIETÀ N. 2";
  }

  function download(bytes, fileName) {
    const blob = new Blob([bytes], {
      type: "application/pdf"
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = fileName;
    link.style.display = "none";

    document.body.appendChild(link);
    link.click();

    setTimeout(() => {
      link.remove();
      URL.revokeObjectURL(url);
    }, 2000);
  }

  async function generateFederalPdf() {
    const status = document.querySelector("#saveMsg");

    try {
      if (status) {
        status.textContent =
          "Generazione della replica federale in corso…";
      }

      if (!window.PDFLib) {
        throw new Error("La libreria PDF non è disponibile.");
      }

      const {
        PDFDocument,
        StandardFonts,
        rgb
      } = window.PDFLib;

      const documentPdf = await PDFDocument.create();

      const regular = await documentPdf.embedFont(
        StandardFonts.Helvetica
      );

      const bold = await documentPdf.embedFont(
        StandardFonts.HelveticaBold
      );

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
        COMMITTEES[data.referee.committee] ||
        ["", "", "", ""];

      const black = rgb(0, 0, 0);
      const white = rgb(1, 1, 1);
      const lightGray = rgb(0.94, 0.94, 0.94);

      function addPage() {
        return documentPdf.addPage([
          PAGE_WIDTH,
          PAGE_HEIGHT
        ]);
      }

      function pdfY(top, height = 0) {
        return PAGE_HEIGHT - top - height;
      }

      function line(
        page,
        x1,
        top1,
        x2,
        top2,
        thickness = 1
      ) {
        page.drawLine({
          start: {
            x: x1,
            y: PAGE_HEIGHT - top1
          },
          end: {
            x: x2,
            y: PAGE_HEIGHT - top2
          },
          thickness,
          color: black
        });
      }

      function rectangle(
        page,
        x,
        top,
        width,
        height,
        thickness = 1,
        fill = null
      ) {
        page.drawRectangle({
          x,
          y: pdfY(top, height),
          width,
          height,
          borderWidth: thickness,
          borderColor: black,
          color: fill || undefined
        });
      }

      function fittedSize(
        value,
        font,
        initialSize,
        maxWidth,
        minimum = 5
      ) {
        let size = initialSize;
        const textValue = String(value ?? "");

        while (
          size > minimum &&
          font.widthOfTextAtSize(textValue, size) >
            maxWidth
        ) {
          size -= 0.25;
        }

        return size;
      }

      function text(
        page,
        value,
        x,
        top,
        options = {}
      ) {
        const stringValue = String(value ?? "");

        if (!stringValue) return;

        const font = options.bold ? bold : regular;
        const width = options.width || 0;

        const size = width
          ? fittedSize(
              stringValue,
              font,
              options.size || 9,
              width
            )
          : options.size || 9;

        let drawX = x;

        if (width && options.align === "center") {
          drawX =
            x +
            (
              width -
              font.widthOfTextAtSize(
                stringValue,
                size
              )
            ) / 2;
        }

        if (width && options.align === "right") {
          drawX =
            x +
            width -
            font.widthOfTextAtSize(
              stringValue,
              size
            );
        }

        page.drawText(stringValue, {
          x: drawX,
          y: PAGE_HEIGHT - top - size,
          size,
          font,
          color: black
        });
      }

      function centeredText(
        page,
        value,
        x,
        top,
        width,
        height,
        options = {}
      ) {
        const font = options.bold ? bold : regular;

        const size = fittedSize(
          value,
          font,
          options.size || 9,
          width - 6
        );

        const drawX =
          x +
          (
            width -
            font.widthOfTextAtSize(
              String(value),
              size
            )
          ) / 2;

        const drawTop =
          top +
          (height - size) / 2 -
          1;

        text(page, value, drawX, drawTop, {
          size,
          bold: options.bold
        });
      }

      function wrapText(
        page,
        value,
        x,
        top,
        width,
        options = {}
      ) {
        const font = options.bold ? bold : regular;
        const size = options.size || 9;
        const lineHeight =
          options.lineHeight || size * 1.25;

        const paragraphs =
          String(value ?? "").split(/\n/);

        let currentTop = top;

        paragraphs.forEach(paragraph => {
          const words = paragraph.split(/\s+/);
          let currentLine = "";

          words.forEach(word => {
            const candidate =
              currentLine
                ? `${currentLine} ${word}`
                : word;

            if (
              font.widthOfTextAtSize(
                candidate,
                size
              ) <= width
            ) {
              currentLine = candidate;
            } else {
              if (currentLine) {
                text(
                  page,
                  currentLine,
                  x,
                  currentTop,
                  {
                    size,
                    bold: options.bold
                  }
                );

                currentTop += lineHeight;
              }

              currentLine = word;
            }
          });

          if (currentLine) {
            text(
              page,
              currentLine,
              x,
              currentTop,
              {
                size,
                bold: options.bold
              }
            );

            currentTop += lineHeight;
          }
        });

        return currentTop;
      }

      function cell(
        page,
        value,
        x,
        top,
        width,
        height,
        options = {}
      ) {
        rectangle(
          page,
          x,
          top,
          width,
          height,
          options.thickness || 0.8,
          options.fill || null
        );

        if (options.wrap) {
          wrapText(
            page,
            value,
            x + 3,
            top + 3,
            width - 6,
            {
              size: options.size || 8,
              bold: options.bold,
              lineHeight: options.lineHeight
            }
          );
        } else {
          centeredText(
            page,
            value,
            x,
            top,
            width,
            height,
            {
              size: options.size || 8,
              bold: options.bold
            }
          );
        }
      }

      function checkbox(
        page,
        x,
        top,
        checked,
        size = 13
      ) {
        rectangle(
          page,
          x,
          top,
          size,
          size,
          1.2
        );

        if (checked) {
          line(
            page,
            x + 2,
            top + 7,
            x + 5,
            top + 11,
            1.5
          );

          line(
            page,
            x + 5,
            top + 11,
            x + 11,
            top + 2,
            1.5
          );
        }
      }

      function pageCode(
        page,
        code,
        number,
        total
      ) {
        const x = 475;
        const top = 744;
        const width = 70;

        rectangle(
          page,
          x,
          top,
          width,
          58,
          1.4
        );

        cell(
          page,
          "Foglio",
          x,
          top,
          width,
          17,
          {
            bold: true,
            thickness: 0
          }
        );

        cell(
          page,
          `N° ${number} di ${total}`,
          x,
          top + 17,
          width,
          18,
          {
            bold: true,
            thickness: 0.8
          }
        );

        cell(
          page,
          code,
          x,
          top + 35,
          width,
          23,
          {
            bold: true,
            size: 14,
            thickness: 0
          }
        );
      }

      /*
       * PAGINA 1 — MAIL
       */

      function drawMailPage() {
        const page = addPage();

        const leftX = 65;
        const rightX = 300;
        const boxWidth = 205;
        const rowHeight = 14;

        rectangle(
          page,
          leftX,
          55,
          boxWidth,
          84,
          1.2
        );

        rectangle(
          page,
          rightX,
          55,
          boxWidth,
          84,
          1.2
        );

        for (let i = 1; i < 6; i += 1) {
          line(
            page,
            leftX,
            55 + i * rowHeight,
            leftX + boxWidth,
            55 + i * rowHeight
          );

          line(
            page,
            rightX,
            55 + i * rowHeight,
            rightX + boxWidth,
            55 + i * rowHeight
          );
        }

        text(page, "SPEDISCE:", leftX + 3, 57, {
          size: 9,
          bold: true
        });

        text(page, fullName, leftX + 3, 72, {
          size: 8,
          width: boxWidth - 6
        });

        text(
          page,
          data.referee.email,
          leftX + 3,
          86,
          {
            size: 7,
            width: boxWidth - 6
          }
        );

        text(
          page,
          data.referee.phone,
          leftX + 3,
          100,
          {
            size: 8,
            width: boxWidth - 6
          }
        );

        text(page, "Tess:", leftX + 3, 114, {
          size: 8,
          bold: true
        });

        text(
          page,
          data.referee.card,
          leftX + 3,
          128,
          {
            size: 8,
            width: boxWidth - 6
          }
        );

        text(page, "COMITATO:", rightX + 3, 57, {
          size: 9,
          bold: true
        });

        text(
          page,
          data.referee.committee,
          rightX + 3,
          72,
          {
            size: 7,
            width: boxWidth - 6
          }
        );

        committee.forEach((value, index) => {
          text(
            page,
            value,
            rightX + 3,
            86 + index * 14,
            {
              size: 7,
              width: boxWidth - 6
            }
          );
        });

        text(page, "MAIL", 55, 165, {
          size: 28,
          bold: true
        });

        text(
          page,
          "A:",
          65,
          224,
          {
            size: 10
          }
        );

        text(
          page,
          "FEDERAZIONE ITALIANA RUGBY",
          120,
          214,
          {
            size: 11,
            bold: true
          }
        );

        text(
          page,
          "Ufficio del Giudice Sportivo",
          343,
          214,
          {
            size: 10,
            bold: true
          }
        );

        line(page, 65, 240, 505, 240, 1.2);

        text(page, "Fogli:", 300, 250, {
          size: 9
        });

        text(page, "6", 355, 249, {
          size: 10,
          bold: true
        });

        line(page, 65, 270, 505, 270, 1.2);

        text(page, "Tel Arbitro:", 65, 282, {
          size: 9
        });

        text(
          page,
          data.referee.phone,
          140,
          281,
          {
            size: 9,
            bold: true,
            width: 100
          }
        );

        text(page, "Data:", 300, 282, {
          size: 9
        });

        text(
          page,
          formatDate(data.match.date),
          340,
          281,
          {
            size: 9,
            bold: true
          }
        );

        line(page, 65, 300, 505, 300, 1.2);

        text(page, "GARA:", 65, 313, {
          size: 9
        });

        text(
          page,
          `${data.match.category || ""}: ` +
          `${data.match.home || ""} - ` +
          `${data.match.away || ""}`,
          112,
          312,
          {
            size: 9,
            bold: true,
            width: 390
          }
        );

        line(page, 65, 334, 505, 334, 1.2);

        checkbox(
          page,
          52,
          350,
          Boolean(data.attachments.concussion)
        );

        text(
          page,
          "Presenza di modello 'concussion'",
          69,
          351,
          {
            size: 9,
            bold: true
          }
        );

        line(page, 65, 380, 505, 380, 1.2);

        text(
          page,
          "ALLEGATI MODD.:",
          66,
          383,
          {
            size: 10,
            bold: true
          }
        );

        const disciplinaryPlayers = events.filter(
          event =>
            [
              "yellow",
              "secondYellow",
              "red"
            ].includes(event.type) &&
            event.subjectType !== "member"
        );

        const disciplinaryMembers = events.filter(
          event =>
            [
              "yellow",
              "secondYellow",
              "red"
            ].includes(event.type) &&
            event.subjectType === "member"
        );

        const attachments = [
          ["A", 1],
          ["B", Number(data.attachments.modB || 0)],
          ["C", disciplinaryPlayers.length ? 1 : 0],
          ["C1", disciplinaryMembers.length ? 1 : 0],
          ["D", 1],
          [
            "D/AA*",
            data.attachments.modDIntegration ? 1 : 0
          ],
          ["F", 1],
          ["DAE", Number(data.attachments.dae || 0)],
          [
            "DOC",
            Number(data.attachments.documents || 0)
          ]
        ];

        const attachmentStartX = 98;
        const attachmentWidth = 45;

        cell(
          page,
          "",
          65,
          410,
          33,
          50,
          {
            thickness: 0.8
          }
        );

        text(
          page,
          "N° fogli",
          68,
          420,
          {
            size: 6,
            bold: true
          }
        );

        text(
          page,
          "allegati",
          68,
          430,
          {
            size: 6,
            bold: true
          }
        );

        attachments.forEach(
          ([label, value], index) => {
            const x =
              attachmentStartX +
              index * attachmentWidth;

            cell(
              page,
              label,
              x,
              392,
              attachmentWidth,
              18,
              {
                bold: true,
                size: 8
              }
            );

            cell(
              page,
              String(value),
              x,
              410,
              attachmentWidth,
              50,
              {
                bold: true,
                size: 12
              }
            );
          }
        );

        wrapText(
          page,
          "NB: Il presente referto deve essere inviato " +
          "via mail entro 24 ore dalla conclusione della gara",
          66,
          485,
          430,
          {
            size: 9,
            bold: true,
            lineHeight: 12
          }
        );

        wrapText(
          page,
          "*ALLEGARE MODELLO D INTEGRATIVO REDATTO DA " +
          "ASSISTENTE ARBITRO (valevole solo per le categorie nazionali)",
          66,
          525,
          430,
          {
            size: 8,
            bold: true,
            lineHeight: 11
          }
        );

        wrapText(
          page,
          "SPECIFICARE SE SI SONO VERIFICATI INFORTUNI " +
          "DI \"TRAUMA CRANICO COMMOTIVO\" E/O INFORTUNI " +
          "GRAVI ACCOMPAGNATI DA CERTIFICATO MEDICO E " +
          "ALLEGATO 'CONCUSSION'",
          75,
          575,
          410,
          {
            size: 8,
            bold: true,
            lineHeight: 10
          }
        );

        text(page, "NOTE:", 66, 640, {
          size: 9,
          bold: true
        });

        rectangle(
          page,
          65,
          655,
          440,
          120,
          1
        );

        wrapText(
          page,
          data.notes,
          70,
          662,
          430,
          {
            size: 8,
            lineHeight: 10
          }
        );

        return page;
      }

      /*
       * PAGINA 2 — MOD. F
       */

      function drawHalfCard(
        page,
        top,
        half,
        isSecondHalf
      ) {
        const x = 50;
        const width = 495;
        const height = 310;

        rectangle(page, x, top, width, height, 1.2);

        cell(
          page,
          "FIR",
          x,
          top,
          35,
          42,
          {
            bold: true,
            size: 15
          }
        );

        cell(
          page,
          "COMITATO NAZIONALE ARBITRI",
          x + 35,
          top,
          165,
          24,
          {
            bold: true,
            size: 8
          }
        );

        cell(
          page,
          "CAMPIONATO",
          x + 35,
          top + 24,
          85,
          18,
          {
            size: 7
          }
        );

        cell(
          page,
          data.match.category || "",
          x + 120,
          top + 24,
          80,
          18,
          {
            bold: true,
            size: 7
          }
        );

        cell(
          page,
          "SOC.",
          x + 200,
          top,
          45,
          24,
          {
            size: 7
          }
        );

        cell(
          page,
          data.match.home || "",
          x + 245,
          top,
          102,
          24,
          {
            bold: true,
            size: 7
          }
        );

        cell(
          page,
          "SOC.",
          x + 347,
          top,
          45,
          24,
          {
            size: 7
          }
        );

        cell(
          page,
          data.match.away || "",
          x + 392,
          top,
          103,
          24,
          {
            bold: true,
            size: 7
          }
        );

        cell(
          page,
          String(half),
          x,
          top + 42,
          35,
          50,
          {
            bold: true,
            size: 20
          }
        );

        cell(
          page,
          "gara del",
          x + 35,
          top + 42,
          65,
          18,
          {
            size: 7
          }
        );

        cell(
          page,
          formatDate(data.match.date),
          x + 35,
          top + 60,
          65,
          32,
          {
            bold: true,
            size: 8
          }
        );

        cell(
          page,
          "inizio",
          x + 100,
          top + 42,
          50,
          18,
          {
            size: 7
          }
        );

        cell(
          page,
          isSecondHalf
            ? data.match.secondStart || ""
            : data.match.firstStart || "",
          x + 100,
          top + 60,
          50,
          32,
          {
            bold: true,
            size: 8
          }
        );

        cell(
          page,
          "fine",
          x + 150,
          top + 42,
          50,
          18,
          {
            size: 7
          }
        );

        cell(
          page,
          isSecondHalf
            ? data.match.secondEnd || ""
            : data.match.firstEnd || "",
          x + 150,
          top + 60,
          50,
          32,
          {
            bold: true,
            size: 8
          }
        );

        const tempTop = top + 24;
        const tempX = x + 200;
        const tempWidth = 295;

        cell(
          page,
          "SOSTITUZIONI TEMPORANEE",
          tempX,
          tempTop,
          tempWidth,
          18,
          {
            size: 8
          }
        );

        const tempEvents = events.filter(event =>
          event.type === "temporary" &&
          String(event.half) === String(half)
        );

        for (let row = 0; row < 5; row += 1) {
          const rowTop =
            tempTop + 18 + row * 14;

          ["home", "away"].forEach(
            (team, teamIndex) => {
              const event = tempEvents
                .filter(item => item.team === team)[row];

              const cellX =
                tempX +
                teamIndex * (tempWidth / 2);

              cell(
                page,
                event
                  ? `${event.minute}'  ` +
                    `${event.outNumber || ""} ${event.out || ""} → ` +
                    `${event.inNumber || ""} ${event.in || ""}`
                  : "",
                cellX,
                rowTop,
                tempWidth / 2,
                14,
                {
                  size: 6
                }
              );
            }
          );
        }

        const scoreTop = top + 92;
        const scoreLeftWidth = 200;
        const eventAreaX = x + scoreLeftWidth;
        const eventAreaWidth = width - scoreLeftWidth;

        const leftColumns = 12;
        const leftColumnWidth =
          scoreLeftWidth / leftColumns;

        for (
          let column = 0;
          column <= leftColumns;
          column += 1
        ) {
          line(
            page,
            x + column * leftColumnWidth,
            scoreTop,
            x + column * leftColumnWidth,
            scoreTop + 120,
            0.6
          );
        }

        for (let row = 0; row <= 5; row += 1) {
          line(
            page,
            x,
            scoreTop + row * 24,
            x + scoreLeftWidth,
            scoreTop + row * 24,
            0.8
          );
        }

        SCORE_TYPES.forEach((scoreType, index) => {
          const scoreCountHome =
            countEvents(
              "home",
              half,
              scoreType.key
            );

          const scoreCountAway =
            countEvents(
              "away",
              half,
              scoreType.key
            );

          const rowTop =
            scoreTop + index * 24;

          text(
            page,
            scoreType.label,
            x + 82,
            rowTop + 7,
            {
              size: 6,
              bold: true
            }
          );

          text(
            page,
            String(scoreCountHome),
            x + 45,
            rowTop + 6,
            {
              size: 8,
              bold: true
            }
          );

          text(
            page,
            String(scoreCountAway),
            x + 170,
            rowTop + 6,
            {
              size: 8,
              bold: true
            }
          );
        });

        const disciplinary = events.filter(event =>
          String(event.half) === String(half) &&
          [
            "yellow",
            "secondYellow",
            "red"
          ].includes(event.type)
        );

        cell(
          page,
          "TESSERATI O GIOCATORI",
          eventAreaX,
          scoreTop,
          eventAreaWidth,
          18,
          {
            size: 8
          }
        );

        const disciplineColumns = [
          ["AMMONITI", "home", "yellow"],
          ["ESPULSI", "home", "red"],
          ["AMMONITI", "away", "yellow"],
          ["ESPULSI", "away", "red"]
        ];

        disciplineColumns.forEach(
          ([label, team, type], index) => {
            const columnX =
              eventAreaX +
              index * (eventAreaWidth / 4);

            cell(
              page,
              label,
              columnX,
              scoreTop + 18,
              eventAreaWidth / 4,
              18,
              {
                size: 7
              }
            );

            const relevant = disciplinary.filter(event =>
              event.team === team &&
              (
                type === "yellow"
                  ? event.type === "yellow"
                  : ["red", "secondYellow"]
                      .includes(event.type)
              )
            );

            for (let row = 0; row < 4; row += 1) {
              const item = relevant[row];

              cell(
                page,
                item
                  ? `${item.minute}' n.${item.number || ""}`
                  : "",
                columnX,
                scoreTop + 36 + row * 15,
                eventAreaWidth / 4,
                15,
                {
                  size: 6
                }
              );
            }
          }
        );

        const permanentTop = scoreTop + 120;

        cell(
          page,
          "SOSTITUZIONI DEFINITIVE",
          eventAreaX,
          permanentTop,
          eventAreaWidth,
          18,
          {
            size: 8
          }
        );

        const permanent = events.filter(event =>
          event.type === "permanent" &&
          String(event.half) === String(half)
        );

        for (let row = 0; row < 7; row += 1) {
          ["home", "away"].forEach(
            (team, teamIndex) => {
              const item = permanent
                .filter(event => event.team === team)[row];

              cell(
                page,
                item
                  ? `${item.minute}' ` +
                    `${item.outNumber || ""} ${item.out || ""} → ` +
                    `${item.inNumber || ""} ${item.in || ""}`
                  : "",
                eventAreaX +
                  teamIndex * (eventAreaWidth / 2),
                permanentTop + 18 + row * 14,
                eventAreaWidth / 2,
                14,
                {
                  size: 6
                }
              );
            }
          );
        }

        if (isSecondHalf) {
          text(
            page,
            "L'arbitro",
            x + 10,
            top + 278,
            {
              size: 8
            }
          );

          text(
            page,
            fullName,
            x + 95,
            top + 278,
            {
              size: 8,
              bold: true,
              width: 100
            }
          );

          text(
            page,
            "Numero Tessera",
            x + 10,
            top + 295,
            {
              size: 8
            }
          );

          text(
            page,
            data.referee.card,
            x + 130,
            top + 295,
            {
              size: 8,
              bold: true
            }
          );
        }
      }

      function drawModFPage() {
        const page = addPage();

        drawHalfCard(
          page,
          52,
          1,
          false
        );

        drawHalfCard(
          page,
          375,
          2,
          true
        );

        text(page, "Firma:", 205, 735, {
          size: 9,
          bold: true
        });

        line(page, 300, 755, 455, 755, 1);

        centeredText(
          page,
          reverseName,
          300,
          756,
          155,
          18,
          {
            size: 8
          }
        );

        pageCode(page, "MOD. F", 2, 6);

        return page;
      }

      /*
       * PAGINA 3 — MOD. A
       */

      function drawModAPage() {
        const page = addPage();

        const x = 50;
        const width = 495;

        rectangle(page, x, 52, width, 278, 1.2);

        cell(
          page,
          "FEDERUGBY\nCommissione\nNazionale\nArbitri",
          x,
          52,
          130,
          60,
          {
            bold: true,
            size: 9,
            wrap: true
          }
        );

        cell(
          page,
          "REFERTO\nARBITRALE",
          x + 130,
          52,
          190,
          60,
          {
            bold: true,
            size: 14,
            wrap: true
          }
        );

        cell(
          page,
          `Gara del: ${formatDate(data.match.date)}`,
          x + 320,
          52,
          175,
          30,
          {
            bold: true,
            size: 9
          }
        );

        cell(
          page,
          `Ore: ${data.match.time || ""}`,
          x + 320,
          82,
          175,
          30,
          {
            bold: true,
            size: 9
          }
        );

        cell(
          page,
          `Campionato: ${data.match.category || ""}`,
          x,
          112,
          160,
          28,
          {
            size: 8
          }
        );

        cell(
          page,
          `Gara giocata a: ${data.match.location || ""}`,
          x + 160,
          112,
          190,
          28,
          {
            size: 8
          }
        );

        cell(
          page,
          `Campo: ${data.match.field || ""}`,
          x + 350,
          112,
          145,
          28,
          {
            size: 8
          }
        );

        const officials = [
          {
            role: "ARBITRO",
            name: fullName,
            card: data.referee.card
          },
          {
            role: "G. di L. 1",
            name: data.team?.[0]?.name || "",
            card: data.team?.[0]?.card || ""
          },
          {
            role: "G. di L. 2",
            name: data.team?.[1]?.name || "",
            card: data.team?.[1]?.card || ""
          }
        ];

        officials.forEach((official, index) => {
          const top = 140 + index * 16;

          cell(
            page,
            official.role,
            x,
            top,
            60,
            16,
            {
              bold: true,
              size: 7
            }
          );

          cell(
            page,
            official.name,
            x + 60,
            top,
            360,
            16,
            {
              size: 8
            }
          );

          cell(
            page,
            `Codice: ${official.card}`,
            x + 420,
            top,
            75,
            16,
            {
              size: 7
            }
          );
        });

        const timesTop = 188;

        [
          ["I° tempo", 0, 60],
          ["inizio", 60, 55],
          [data.match.firstStart || "", 115, 55],
          ["fine", 170, 55],
          [data.match.firstEnd || "", 225, 55],
          ["II° tempo", 280, 60],
          ["inizio", 340, 50],
          [data.match.secondStart || "", 390, 50],
          ["fine", 440, 55]
        ].forEach(([value, offset, cellWidth]) => {
          cell(
            page,
            value,
            x + offset,
            timesTop,
            cellWidth,
            22,
            {
              bold:
                String(value).includes("tempo") ||
                String(value).includes(":"),
              size: 7
            }
          );
        });

        const scoreTop = 210;
        const teamWidth = width / 2;

        ["home", "away"].forEach(
          (team, teamIndex) => {
            const teamX =
              x + teamIndex * teamWidth;

            cell(
              page,
              teamName(data, team),
              teamX,
              scoreTop,
              teamWidth,
              26,
              {
                bold: true,
                size: 9
              }
            );

            const labelWidth = 95;
            const metricWidth =
              (teamWidth - labelWidth) / 4;

            cell(
              page,
              "Punteggi",
              teamX,
              scoreTop + 26,
              labelWidth,
              18,
              {
                size: 8
              }
            );

            SCORE_TYPES.forEach(
              (scoreType, index) => {
                cell(
                  page,
                  scoreType.label,
                  teamX +
                    labelWidth +
                    index * metricWidth,
                  scoreTop + 26,
                  metricWidth,
                  18,
                  {
                    size: 6
                  }
                );
              }
            );

            [
              ["I° tempo", 1],
              ["II° tempo", 2],
              ["totale n.", 0]
            ].forEach(
              ([label, half], rowIndex) => {
                const rowTop =
                  scoreTop + 44 + rowIndex * 18;

                cell(
                  page,
                  label,
                  teamX,
                  rowTop,
                  labelWidth,
                  18,
                  {
                    bold: half === 0,
                    size: 7
                  }
                );

                SCORE_TYPES.forEach(
                  (scoreType, index) => {
                    const value = half
                      ? countEvents(
                          team,
                          half,
                          scoreType.key
                        )
                      : (
                          countEvents(
                            team,
                            1,
                            scoreType.key
                          ) +
                          countEvents(
                            team,
                            2,
                            scoreType.key
                          )
                        );

                    cell(
                      page,
                      String(value),
                      teamX +
                        labelWidth +
                        index * metricWidth,
                      rowTop,
                      metricWidth,
                      18,
                      {
                        bold: half === 0,
                        size: 8
                      }
                    );
                  }
                );
              }
            );

            cell(
              page,
              "Punti",
              teamX,
              scoreTop + 98,
              labelWidth,
              20,
              {
                bold: true,
                size: 9
              }
            );

            SCORE_TYPES.forEach(
              (scoreType, index) => {
                const total =
                  countEvents(
                    team,
                    1,
                    scoreType.key
                  ) +
                  countEvents(
                    team,
                    2,
                    scoreType.key
                  );

                cell(
                  page,
                  String(total * scoreType.points),
                  teamX +
                    labelWidth +
                    index * metricWidth,
                  scoreTop + 98,
                  metricWidth,
                  20,
                  {
                    bold: true,
                    size: 9
                  }
                );
              }
            );

            text(
              page,
              `Totale: ${calculateScore(team)}`,
              teamX + 5,
              scoreTop + 122,
              {
                size: 10,
                bold: true
              }
            );
          }
        );

        text(
          page,
          "SOSTITUZIONI TEMPORANEE GIOCATORI",
          155,
          352,
          {
            size: 11,
            bold: true
          }
        );

        text(
          page,
          "(Le sostituzioni definitive vanno riportate " +
          "sui fogli MOD. B - elenchi giocatori)",
          112,
          368,
          {
            size: 8,
            bold: true
          }
        );

        const substitutionTop = 388;
        const substitutionHeight = 190;
        const halfWidth = width / 2;

        ["home", "away"].forEach(
          (team, teamIndex) => {
            const tableX =
              x + teamIndex * halfWidth;

            cell(
              page,
              teamName(data, team),
              tableX,
              substitutionTop,
              halfWidth,
              20,
              {
                bold: true,
                size: 8
              }
            );

            const columns = [
              { label: "N°", width: 25 },
              {
                label: "Giocatore uscito",
                width: 83
              },
              { label: "N°", width: 25 },
              {
                label: "Giocatore entrato",
                width: 83
              },
              { label: "t/min", width: 31.5 }
            ];

            let columnX = tableX;

            columns.forEach(column => {
              cell(
                page,
                column.label,
                columnX,
                substitutionTop + 20,
                column.width,
                18,
                {
                  size: 6
                }
              );

              columnX += column.width;
            });

            const relevant = events.filter(event =>
              event.team === team &&
              event.type === "temporary"
            );

            for (let row = 0; row < 8; row += 1) {
              const item = relevant[row];
              let rowX = tableX;

              const values = item
                ? [
                    item.outNumber || "",
                    item.out || "",
                    item.inNumber || "",
                    item.in || "",
                    `${item.half}/${item.minute}`
                  ]
                : ["", "", "", "", ""];

              columns.forEach((column, index) => {
                cell(
                  page,
                  values[index],
                  rowX,
                  substitutionTop + 38 + row * 18,
                  column.width,
                  18,
                  {
                    size: 6
                  }
                );

                rowX += column.width;
              });
            }
          }
        );

        const checksTop = 595;

        const checkItems = [
          [
            "Cartellini gialli estratti",
            events.some(event =>
              event.type === "yellow"
            )
          ],
          [
            "Cartellini rossi estratti",
            events.some(event =>
              ["red", "secondYellow"]
                .includes(event.type)
            )
          ],
          [
            "Reclami/trauma cranico",
            Boolean(data.attachments.concussion)
          ],
          [
            "Assenze medico/accompagnatori",
            data.checks.doctor === "No" ||
            data.checks.escorts === "No"
          ],
          [
            "Comportamenti anomali",
            data.checks.manager === "Censurabile" ||
            data.checks.crowd === "Scorretto"
          ],
          [
            "Infortuni gravi",
            data.checks.injuries === "Si"
          ],
          [
            "Rilievi",
            data.checks.facilities === "Si"
          ],
          [
            "Incidenti",
            Boolean(
              data.checks.before ||
              data.checks.during ||
              data.checks.after
            )
          ]
        ];

        checkItems.forEach(
          ([label, checked], index) => {
            const column = index % 3;
            const row = Math.floor(index / 3);

            const itemX =
              x + column * 165;

            const itemTop =
              checksTop + row * 20;

            text(
              page,
              label,
              itemX,
              itemTop,
              {
                size: 7,
                bold: true,
                width: 135
              }
            );

            checkbox(
              page,
              itemX + 142,
              itemTop - 2,
              checked,
              13
            );
          }
        );

        text(page, "Fogli allegati:", x, 664, {
          size: 9
        });

        const playerDiscipline = events.filter(event =>
          [
            "yellow",
            "secondYellow",
            "red"
          ].includes(event.type) &&
          event.subjectType !== "member"
        );

        const memberDiscipline = events.filter(event =>
          [
            "yellow",
            "secondYellow",
            "red"
          ].includes(event.type) &&
          event.subjectType === "member"
        );

        const attachmentBoxes = [
          [
            "Elenchi Giocatori\nMod. B",
            data.attachments.modB || 0
          ],
          [
            "Espulsioni\nMod. C/C1",
            playerDiscipline.length ||
            memberDiscipline.length
              ? 1
              : 0
          ],
          [
            "Assenze, rilievi,\nincidenti - Mod. D",
            1
          ],
          [
            "Mod. D integrativo",
            data.attachments.modDIntegration
              ? 1
              : 0
          ]
        ];

        attachmentBoxes.forEach(
          ([label, value], index) => {
            const boxX =
              x + index * 105;

            cell(
              page,
              label,
              boxX,
              680,
              90,
              55,
              {
                size: 7,
                wrap: true
              }
            );

            text(
              page,
              `n. ${value}`,
              boxX + 8,
              720,
              {
                size: 9,
                bold: true
              }
            );
          }
        );

        text(page, "FIRMA", 420, 684, {
          size: 10,
          bold: true
        });

        line(page, 365, 730, 535, 730, 1.1);

        centeredText(
          page,
          reverseName,
          365,
          731,
          170,
          17,
          {
            size: 8
          }
        );

        pageCode(page, "MOD. A", 3, 6);

        return page;
      }

      /*
       * PAGINA 4 — MOD. C
       */

      function drawDisciplinaryTable(
        page,
        title,
        top,
        eventType,
        rows
      ) {
        const x = 50;
        const width = 495;

        cell(
          page,
          title,
          x,
          top,
          width,
          22,
          {
            bold: true,
            size: 10,
            fill: lightGray
          }
        );

        const columns = [
          { label: "SQ.\nn°", width: 38 },
          {
            label: "Cognome giocatore",
            width: 250
          },
          { label: "N°\nMaglia", width: 40 },
          { label: "n° tessera", width: 57 },
          { label: "tempo", width: 55 },
          { label: "minuto", width: 55 }
        ];

        let columnX = x;

        columns.forEach(column => {
          cell(
            page,
            column.label,
            columnX,
            top + 22,
            column.width,
            25,
            {
              size: 7,
              wrap: true
            }
          );

          columnX += column.width;
        });

        const relevant = events.filter(event =>
          event.type === eventType &&
          event.subjectType !== "member"
        );

        for (let row = 0; row < rows; row += 1) {
          const item = relevant[row];
          let rowX = x;

          const values = item
            ? [
                item.team === "home" ? "1" : "2",
                item.person || "",
                item.number || "",
                item.card || "",
                item.half || "",
                item.minute || ""
              ]
            : ["", "", "", "", "", ""];

          columns.forEach((column, index) => {
            cell(
              page,
              values[index],
              rowX,
              top + 47 + row * 18,
              column.width,
              18,
              {
                size: 7
              }
            );

            rowX += column.width;
          });
        }

        return top + 47 + rows * 18;
      }

      function drawModCPage() {
        const page = addPage();

        text(page, "FEDERUGBY", 50, 48, {
          size: 11,
          bold: true
        });

        let nextTop = drawDisciplinaryTable(
          page,
          "GIOCATORI ESCLUSI TEMPORANEAMENTE - " +
          "1° CARTELLINO GIALLO",
          50,
          "yellow",
          8
        );

        nextTop = drawDisciplinaryTable(
          page,
          "GIOCATORI ESPULSI PER 2° CARTELLINO GIALLO",
          nextTop + 10,
          "secondYellow",
          4
        );

        nextTop = drawDisciplinaryTable(
          page,
          "GIOCATORI ESPULSI - CARTELLINO ROSSO",
          nextTop + 10,
          "red",
          4
        );

        const redEvents = events.filter(event =>
          event.type === "red" &&
          event.subjectType !== "member"
        );

        for (let index = 0; index < 4; index += 1) {
          const reasonTop =
            nextTop + 10 + index * 64;

          rectangle(
            page,
            50,
            reasonTop,
            495,
            58,
            1
          );

          text(
            page,
            "Motivo:",
            53,
            reasonTop + 3,
            {
              size: 8
            }
          );

          wrapText(
            page,
            redEvents[index]?.notes || "",
            55,
            reasonTop + 16,
            485,
            {
              size: 7,
              lineHeight: 9
            }
          );
        }

        const footerTop = 720;

        rectangle(
          page,
          50,
          footerTop,
          495,
          65,
          1.2
        );

        cell(
          page,
          "Foglio\nN° 4 di 6\nMOD. C",
          50,
          footerTop,
          85,
          65,
          {
            bold: true,
            size: 9,
            wrap: true
          }
        );

        cell(
          page,
          `Data: ${formatDate(data.match.date)}`,
          135,
          footerTop,
          220,
          25,
          {
            bold: true,
            size: 8
          }
        );

        cell(
          page,
          `SQ 1: ${data.match.home || ""}`,
          135,
          footerTop + 25,
          110,
          40,
          {
            size: 7,
            wrap: true
          }
        );

        cell(
          page,
          `SQ 2: ${data.match.away || ""}`,
          245,
          footerTop + 25,
          110,
          40,
          {
            size: 7,
            wrap: true
          }
        );

        cell(
          page,
          `L'arbitro\n${reverseName}`,
          355,
          footerTop,
          190,
          65,
          {
            size: 8,
            wrap: true
          }
        );

        return page;
      }

      /*
       * PAGINA 5 — MOD. C1
       */

      function drawModC1Page() {
        const page = addPage();

        const x = 50;
        const width = 495;

        text(page, "FEDERUGBY", x, 48, {
          size: 11,
          bold: true
        });

        cell(
          page,
          "TESSERATI ESPULSI",
          x,
          50,
          width,
          35,
          {
            bold: true,
            size: 12,
            fill: lightGray
          }
        );

        const members = events.filter(event =>
          event.subjectType === "member" &&
          [
            "secondYellow",
            "red"
          ].includes(event.type)
        );

        const columns = [
          { label: "SQ.\nN°", width: 38 },
          {
            label: "Cognome e Nome",
            width: 290
          },
          { label: "n° tessera", width: 57 },
          { label: "tempo", width: 55 },
          { label: "minuto", width: 55 }
        ];

        let currentTop = 85;

        for (let index = 0; index < 8; index += 1) {
          let columnX = x;

          columns.forEach(column => {
            cell(
              page,
              index === 0 ? column.label : "",
              columnX,
              currentTop,
              column.width,
              24,
              {
                size: 7,
                wrap: true
              }
            );

            columnX += column.width;
          });

          const item = members[index];

          const values = item
            ? [
                item.team === "home" ? "1" : "2",
                item.person || "",
                item.card || "",
                item.half || "",
                item.minute || ""
              ]
            : ["", "", "", "", ""];

          columnX = x;

          columns.forEach((column, valueIndex) => {
            cell(
              page,
              values[valueIndex],
              columnX,
              currentTop + 24,
              column.width,
              20,
              {
                size: 7
              }
            );

            columnX += column.width;
          });

          rectangle(
            page,
            x,
            currentTop + 44,
            width,
            52,
            1
          );

          text(
            page,
            "Motivo:",
            x + 3,
            currentTop + 47,
            {
              size: 8
            }
          );

          wrapText(
            page,
            item?.notes || "",
            x + 5,
            currentTop + 61,
            width - 10,
            {
              size: 7,
              lineHeight: 9
            }
          );

          currentTop += 96;
        }

        const footerTop = 720;

        rectangle(
          page,
          x,
          footerTop,
          width,
          65,
          1.2
        );

        cell(
          page,
          "Foglio\nN° 5 di 6\nMOD. C1",
          x,
          footerTop,
          85,
          65,
          {
            bold: true,
            size: 9,
            wrap: true
          }
        );

        cell(
          page,
          `Data: ${formatDate(data.match.date)}`,
          x + 85,
          footerTop,
          220,
          25,
          {
            bold: true,
            size: 8
          }
        );

        cell(
          page,
          `SQ 1: ${data.match.home || ""}`,
          x + 85,
          footerTop + 25,
          110,
          40,
          {
            size: 7,
            wrap: true
          }
        );

        cell(
          page,
          `SQ 2: ${data.match.away || ""}`,
          x + 195,
          footerTop + 25,
          110,
          40,
          {
            size: 7,
            wrap: true
          }
        );

        cell(
          page,
          `L'arbitro\n${reverseName}`,
          x + 305,
          footerTop,
          190,
          65,
          {
            size: 8,
            wrap: true
          }
        );

        return page;
      }

      /*
       * PAGINA 6 — MOD. D
       */

      function drawAnswerPair(
        page,
        label,
        top,
        leftLabel,
        leftSelected,
        rightLabel,
        rightSelected
      ) {
        text(page, label, 53, top, {
          size: 8
        });

        text(
          page,
          leftLabel,
          370,
          top,
          {
            size: 8,
            bold: true,
            align: "right",
            width: 65
          }
        );

        checkbox(
          page,
          440,
          top - 2,
          leftSelected,
          14
        );

        text(
          page,
          rightLabel,
          475,
          top,
          {
            size: 8,
            bold: true
          }
        );

        checkbox(
          page,
          520,
          top - 2,
          rightSelected,
          14
        );
      }

      function drawModDPage() {
        const page = addPage();

        rectangle(
          page,
          50,
          50,
          495,
          700,
          1.2
        );

        cell(
          page,
          "FEDERUGBY",
          50,
          50,
          80,
          22,
          {
            bold: true,
            size: 10
          }
        );

        cell(
          page,
          `GARA: ${data.match.category || ""}: ` +
          `${data.match.home || ""} - ` +
          `${data.match.away || ""}`,
          130,
          50,
          320,
          22,
          {
            bold: true,
            size: 8
          }
        );

        cell(
          page,
          `del: ${formatDate(data.match.date)}`,
          450,
          50,
          95,
          22,
          {
            bold: true,
            size: 8
          }
        );

        text(
          page,
          "Riferimenti riassuntivi:",
          52,
          76,
          {
            size: 9,
            bold: true
          }
        );

        drawAnswerPair(
          page,
          "1) Il medico era presente al campo?",
          96,
          "SÌ",
          data.checks.doctor === "Si",
          "NO",
          data.checks.doctor === "No"
        );

        drawAnswerPair(
          page,
          "2) Gli accompagnatori erano entrambi presenti?",
          116,
          "SÌ",
          data.checks.escorts === "Si",
          "NO",
          data.checks.escorts === "No"
        );

        drawAnswerPair(
          page,
          "3) Il comportamento del dirigente addetto all'arbitro è stato:",
          136,
          "Normale",
          data.checks.manager === "Normale",
          "Censurabile",
          data.checks.manager === "Censurabile"
        );

        drawAnswerPair(
          page,
          "4) Il comportamento del pubblico è stato:",
          156,
          "Corretto",
          data.checks.crowd === "Corretto",
          "Scorretto",
          data.checks.crowd === "Scorretto"
        );

        text(
          page,
          "5) Misure d'ordine prese dall'Ente ospitante:",
          53,
          180,
          {
            size: 8
          }
        );

        const securityOptions = [
          "Svolte da forze dell'ordine",
          "Richieste ma assenti",
          "Non richieste ed assenti"
        ];

        securityOptions.forEach(
          (option, index) => {
            const optionTop =
              178 + index * 20;

            text(
              page,
              option,
              300,
              optionTop,
              {
                size: 8,
                bold: true,
                align: "right",
                width: 185
              }
            );

            checkbox(
              page,
              495,
              optionTop - 2,
              data.checks.security === option,
              14
            );
          }
        );

        drawAnswerPair(
          page,
          "6) Rilievi su terreno e spogliatoi:",
          244,
          "NO",
          data.checks.facilities === "No",
          "SÌ",
          data.checks.facilities === "Si"
        );

        drawAnswerPair(
          page,
          "7) Infortuni:",
          264,
          "NO",
          data.checks.injuries === "No",
          "SÌ",
          data.checks.injuries === "Si"
        );

        text(
          page,
          "8) Incidenti avvenuti:",
          53,
          286,
          {
            size: 8
          }
        );

        const incidentOptions = [
          [
            "Prima della gara",
            data.checks.before
          ],
          [
            "Durante la gara",
            data.checks.during
          ],
          [
            "Dopo la gara",
            data.checks.after
          ]
        ];

        incidentOptions.forEach(
          ([label, checked], index) => {
            const x = 180 + index * 115;

            text(
              page,
              label,
              x,
              286,
              {
                size: 8,
                bold: true
              }
            );

            checkbox(
              page,
              x + 88,
              283,
              Boolean(checked),
              14
            );
          }
        );

        cell(
          page,
          "DESCRIVERE DETTAGLIATAMENTE E NELL'ORDINE " +
          "DI QUANTO BARRATO IN PREMESSA",
          50,
          310,
          495,
          24,
          {
            bold: true,
            size: 9,
            fill: lightGray
          }
        );

        rectangle(
          page,
          50,
          334,
          495,
          416,
          1.2
        );

        wrapText(
          page,
          data.checks.details || "",
          58,
          344,
          479,
          {
            size: 9,
            lineHeight: 12
          }
        );

        rectangle(
          page,
          50,
          750,
          495,
          50,
          1.2
        );

        cell(
          page,
          "MOD. D",
          50,
          750,
          70,
          50,
          {
            bold: true,
            size: 13
          }
        );

        cell(
          page,
          "Foglio\nn. 6 di 6",
          120,
          750,
          90,
          50,
          {
            bold: true,
            size: 9,
            wrap: true
          }
        );

        text(
          page,
          "Firma:",
          235,
          766,
          {
            size: 9
          }
        );

        line(page, 285, 782, 515, 782, 1);

        centeredText(
          page,
          reverseName,
          285,
          783,
          230,
          15,
          {
            size: 8
          }
        );

        return page;
      }

      drawMailPage();
      drawModFPage();
      drawModAPage();
      drawModCPage();
      drawModC1Page();
      drawModDPage();

      const bytes = await documentPdf.save();

      const fileName =
        `referto-federale-` +
        `${data.match.date || "bozza"}-` +
        `${safeFileName(data.match.home)}.pdf`;

      download(bytes, fileName);

      if (status) {
        status.textContent =
          "Replica federale generata. Controlla la cartella Download.";
        status.style.color = "#17633a";
      }
    } catch (error) {
      console.error(
        "Errore nella generazione della replica federale:",
        error
      );

      if (status) {
        status.textContent =
          `Errore PDF: ${error.message}`;
        status.style.color = "#b4232d";
      }
    }
  }

  window.generateFederalPdf = generateFederalPdf;

  window.addEventListener(
    "DOMContentLoaded",
    () => {
      const button =
        document.querySelector("#pdf");

      if (!button) return;

      button.textContent =
        "Scarica replica federale";

      button.addEventListener(
        "click",
        event => {
          event.preventDefault();
          event.stopImmediatePropagation();

          generateFederalPdf();
        },
        true
      );
    }
  );
})();
