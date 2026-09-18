/* global PDFLib, getFormData */

(() => {
  "use strict";

  const PAGE_WIDTH = 595.28;
  const PAGE_HEIGHT = 841.89;
  const MARGIN = 48;

  const EVENT_LABELS = {
    try: "META",
    conversion: "TRASFORMAZIONE",
    penalty: "PUNIZIONE",
    drop: "CALCIO DI RIMBALZO",
    yellow: "1° CARTELLINO GIALLO",
    secondYellow: "ESPULSIONE PER 2° GIALLO",
    red: "CARTELLINO ROSSO",
    temporary: "SOSTITUZIONE TEMPORANEA",
    permanent: "SOSTITUZIONE DEFINITIVA"
  };

  const EVENT_POINTS = {
    try: 5,
    conversion: 2,
    penalty: 3,
    drop: 3
  };

  const SCORE_TYPES = [
    { key: "try", label: "mete", points: 5 },
    { key: "conversion", label: "trasf.", points: 2 },
    { key: "penalty", label: "puniz.", points: 3 },
    { key: "drop", label: "drop", points: 3 }
  ];

  function pdfSafe(value) {
    return String(value ?? "")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[→↔⇄]/g, "->")
      .replace(/←/g, "<-")
      .replace(/[–—−]/g, "-")
      .replace(/[‘’]/g, "'")
      .replace(/[“”]/g, "\"")
      .replace(/…/g, "...")
      .replace(/•/g, "-")
      .replace(/✓|✔/g, "X")
      .replace(/☐/g, "[ ]")
      .replace(/☑/g, "[X]")
      .replace(/×/g, "x")
      .replace(/[^\x20-\x7e\xA0-\xFF\n]/g, "?");
  }

  function formatDate(value) {
    if (!value) {
      return "";
    }

    const parts = String(value).split("-");

    if (parts.length !== 3) {
      return value;
    }

    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }

  function safeFileName(value) {
    return pdfSafe(value || "gara")
      .replace(/[^a-z0-9]+/gi, "-")
      .replace(/^-|-$/g, "");
  }

  async function ensurePdfLib() {
    if (window.PDFLib) {
      return;
    }

    const sources = [
      "https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js",
      "https://unpkg.com/pdf-lib@1.17.1/dist/pdf-lib.min.js"
    ];

    for (const source of sources) {
      try {
        await new Promise((resolve, reject) => {
          const script = document.createElement("script");

          script.src = source;
          script.onload = resolve;
          script.onerror = reject;

          document.head.appendChild(script);
        });

        if (window.PDFLib) {
          return;
        }
      } catch (error) {
        console.warn("CDN PDF non disponibile:", source);
      }
    }

    throw new Error(
      "Impossibile caricare la libreria PDF. Controlla la connessione."
    );
  }

  function downloadPdf(bytes, fileName) {
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
    }, 2500);
  }

  function getEvents(data) {
    return Array.isArray(data.events)
      ? data.events
      : [];
  }

  function getTeamName(data, team) {
    return team === "home"
      ? data.match?.home || "SOCIETA N. 1"
      : data.match?.away || "SOCIETA N. 2";
  }

  function calculateTeamScore(data, team) {
    return getEvents(data)
      .filter(event => event.team === team)
      .reduce(
        (total, event) =>
          total + (EVENT_POINTS[event.type] || 0),
        0
      );
  }

  function countEvents(data, team, half, type) {
    return getEvents(data).filter(event =>
      event.team === team &&
      String(event.half) === String(half) &&
      event.type === type
    ).length;
  }

  async function buildFederalPdf() {
    await ensurePdfLib();

    if (typeof getFormData !== "function") {
      throw new Error(
        "I dati del referto non sono disponibili. Verifica app.js."
      );
    }

    const data = getFormData();
    const events = getEvents(data);

    const {
      PDFDocument,
      StandardFonts,
      rgb
    } = window.PDFLib;

    const pdf = await PDFDocument.create();

    const regularFont = await pdf.embedFont(
      StandardFonts.Helvetica
    );

    const boldFont = await pdf.embedFont(
      StandardFonts.HelveticaBold
    );

    const black = rgb(0, 0, 0);
    const white = rgb(1, 1, 1);
    const lightGray = rgb(0.94, 0.94, 0.94);

    const fullName = [
      data.referee?.firstName,
      data.referee?.lastName
    ].filter(Boolean).join(" ");

    const reverseName = [
      data.referee?.lastName,
      data.referee?.firstName
    ].filter(Boolean).join(" ");

    function addPage() {
      return pdf.addPage([
        PAGE_WIDTH,
        PAGE_HEIGHT
      ]);
    }

    function convertTop(top, height = 0) {
      return PAGE_HEIGHT - top - height;
    }

    function drawLine(
      page,
      x1,
      top1,
      x2,
      top2,
      thickness = 0.8
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

    function drawRectangle(
      page,
      x,
      top,
      width,
      height,
      options = {}
    ) {
      page.drawRectangle({
        x,
        y: convertTop(top, height),
        width,
        height,
        borderColor: options.borderColor || black,
        borderWidth:
          options.borderWidth === undefined
            ? 0.8
            : options.borderWidth,
        color: options.fill || undefined
      });
    }

    function fittedFontSize(
      value,
      font,
      initialSize,
      maxWidth,
      minimum = 5
    ) {
      const safeValue = pdfSafe(value);
      let size = initialSize;

      while (
        size > minimum &&
        font.widthOfTextAtSize(safeValue, size) > maxWidth
      ) {
        size -= 0.25;
      }

      return size;
    }

    function drawText(
      page,
      value,
      x,
      top,
      options = {}
    ) {
      const safeValue = pdfSafe(value);

      if (!safeValue) {
        return;
      }

      const font = options.bold
        ? boldFont
        : regularFont;

      const size = options.width
        ? fittedFontSize(
            safeValue,
            font,
            options.size || 8,
            options.width
          )
        : options.size || 8;

      let drawX = x;

      if (
        options.width &&
        options.align === "center"
      ) {
        drawX =
          x +
          (
            options.width -
            font.widthOfTextAtSize(safeValue, size)
          ) / 2;
      }

      if (
        options.width &&
        options.align === "right"
      ) {
        drawX =
          x +
          options.width -
          font.widthOfTextAtSize(safeValue, size);
      }

      page.drawText(safeValue, {
        x: drawX,
        y: PAGE_HEIGHT - top - size,
        size,
        font,
        color: options.color || black
      });
    }

    function drawCenteredText(
      page,
      value,
      x,
      top,
      width,
      height,
      options = {}
    ) {
      const safeValue = pdfSafe(value);
      const font = options.bold
        ? boldFont
        : regularFont;

      const size = fittedFontSize(
        safeValue,
        font,
        options.size || 8,
        width - 6
      );

      const textWidth =
        font.widthOfTextAtSize(
          safeValue,
          size
        );

      drawText(
        page,
        safeValue,
        x + (width - textWidth) / 2,
        top + (height - size) / 2 - 1,
        {
          size,
          bold: options.bold
        }
      );
    }

    function wrapText(
      page,
      value,
      x,
      top,
      width,
      options = {}
    ) {
      const safeValue = pdfSafe(value);
      const font = options.bold
        ? boldFont
        : regularFont;

      const size = options.size || 8;
      const lineHeight =
        options.lineHeight || size * 1.25;

      const maximumLines =
        options.maximumLines || 100;

      let currentTop = top;
      let usedLines = 0;

      safeValue.split(/\n/).forEach(paragraph => {
        let currentLine = "";

        paragraph.split(/\s+/).forEach(word => {
          const candidate = currentLine
            ? `${currentLine} ${word}`
            : word;

          if (
            font.widthOfTextAtSize(
              candidate,
              size
            ) <= width
          ) {
            currentLine = candidate;
            return;
          }

          if (
            currentLine &&
            usedLines < maximumLines
          ) {
            drawText(
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
            usedLines += 1;
          }

          currentLine = word;
        });

        if (
          currentLine &&
          usedLines < maximumLines
        ) {
          drawText(
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
          usedLines += 1;
        }
      });

      return currentTop;
    }

    function drawCell(
      page,
      value,
      x,
      top,
      width,
      height,
      options = {}
    ) {
      drawRectangle(
        page,
        x,
        top,
        width,
        height,
        {
          borderWidth:
            options.borderWidth === undefined
              ? 0.8
              : options.borderWidth,
          fill: options.fill
        }
      );

      if (options.wrap) {
        wrapText(
          page,
          value,
          x + 3,
          top + 3,
          width - 6,
          {
            size: options.size || 7,
            bold: options.bold,
            lineHeight: options.lineHeight,
            maximumLines: options.maximumLines
          }
        );
      } else {
        drawCenteredText(
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

    function drawCheckbox(
      page,
      x,
      top,
      checked,
      size = 13
    ) {
      drawRectangle(
        page,
        x,
        top,
        size,
        size,
        {
          borderWidth: 1.1
        }
      );

      if (!checked) {
        return;
      }

      drawLine(
        page,
        x + 2,
        top + 6,
        x + 5,
        top + 10,
        1.4
      );

      drawLine(
        page,
        x + 5,
        top + 10,
        x + 11,
        top + 2,
        1.4
      );
    }

    function drawPageCode(
      page,
      label,
      pageNumber
    ) {
      const x = 472;
      const top = 751;
      const width = 75;

      drawRectangle(
        page,
        x,
        top,
        width,
        52,
        {
          borderWidth: 1.2
        }
      );

      drawCell(
        page,
        `Foglio n. ${pageNumber} di 6`,
        x,
        top,
        width,
        23,
        {
          bold: true,
          size: 7,
          borderWidth: 0
        }
      );

      drawCell(
        page,
        label,
        x,
        top + 23,
        width,
        29,
        {
          bold: true,
          size: 13
        }
      );
    }

    /*
     * PAGINA 1 — MAIL
     */

    function drawMailPage() {
      const page = addPage();

      const leftX = 64;
      const rightX = 300;
      const boxWidth = 205;

      drawRectangle(
        page,
        leftX,
        55,
        boxWidth,
        84,
        { borderWidth: 1.1 }
      );

      drawRectangle(
        page,
        rightX,
        55,
        boxWidth,
        84,
        { borderWidth: 1.1 }
      );

      for (let row = 1; row < 6; row += 1) {
        drawLine(
          page,
          leftX,
          55 + row * 14,
          leftX + boxWidth,
          55 + row * 14
        );

        drawLine(
          page,
          rightX,
          55 + row * 14,
          rightX + boxWidth,
          55 + row * 14
        );
      }

      drawText(
        page,
        "SPEDISCE:",
        leftX + 3,
        57,
        {
          size: 9,
          bold: true
        }
      );

      drawText(
        page,
        fullName,
        leftX + 3,
        72,
        {
          size: 8,
          width: boxWidth - 6
        }
      );

      drawText(
        page,
        data.referee?.email,
        leftX + 3,
        86,
        {
          size: 7,
          width: boxWidth - 6
        }
      );

      drawText(
        page,
        data.referee?.phone,
        leftX + 3,
        100,
        {
          size: 8,
          width: boxWidth - 6
        }
      );

      drawText(
        page,
        "Tess:",
        leftX + 3,
        114,
        {
          size: 8,
          bold: true
        }
      );

      drawText(
        page,
        data.referee?.card,
        leftX + 3,
        128,
        {
          size: 8
        }
      );

      drawText(
        page,
        "COMITATO:",
        rightX + 3,
        57,
        {
          size: 9,
          bold: true
        }
      );

      drawText(
        page,
        data.referee?.committee,
        rightX + 3,
        72,
        {
          size: 7,
          width: boxWidth - 6
        }
      );

      drawText(
        page,
        "MAIL",
        55,
        165,
        {
          size: 28,
          bold: true
        }
      );

      drawText(page, "A:", 65, 224, {
        size: 10
      });

      drawText(
        page,
        "FEDERAZIONE ITALIANA RUGBY",
        120,
        214,
        {
          size: 11,
          bold: true
        }
      );

      drawText(
        page,
        "Ufficio del Giudice Sportivo",
        343,
        214,
        {
          size: 10,
          bold: true
        }
      );

      drawLine(
        page,
        65,
        240,
        505,
        240,
        1.2
      );

      drawText(page, "Fogli:", 300, 250, {
        size: 9
      });

      drawText(page, "6", 355, 249, {
        size: 10,
        bold: true
      });

      drawLine(
        page,
        65,
        270,
        505,
        270,
        1.2
      );

      drawText(
        page,
        "Tel Arbitro:",
        65,
        282,
        { size: 9 }
      );

      drawText(
        page,
        data.referee?.phone,
        140,
        281,
        {
          size: 9,
          bold: true,
          width: 100
        }
      );

      drawText(page, "Data:", 300, 282, {
        size: 9
      });

      drawText(
        page,
        formatDate(data.match?.date),
        340,
        281,
        {
          size: 9,
          bold: true
        }
      );

      drawLine(
        page,
        65,
        300,
        505,
        300,
        1.2
      );

      drawText(page, "GARA:", 65, 313, {
        size: 9
      });

      drawText(
        page,
        `${data.match?.category || ""}: ` +
        `${getTeamName(data, "home")} - ` +
        `${getTeamName(data, "away")}`,
        112,
        312,
        {
          size: 9,
          bold: true,
          width: 390
        }
      );

      drawLine(
        page,
        65,
        334,
        505,
        334,
        1.2
      );

      drawCheckbox(
        page,
        52,
        350,
        Boolean(data.attachments?.concussion)
      );

      drawText(
        page,
        "Presenza di modello 'concussion'",
        69,
        351,
        {
          size: 9,
          bold: true
        }
      );

      drawLine(
        page,
        65,
        380,
        505,
        380,
        1.2
      );

      drawText(
        page,
        "ALLEGATI MODD.:",
        66,
        383,
        {
          size: 10,
          bold: true
        }
      );

      const playerDiscipline =
        events.some(event =>
          [
            "yellow",
            "secondYellow",
            "red"
          ].includes(event.type) &&
          event.subjectType !== "member"
        );

      const memberDiscipline =
        events.some(event =>
          [
            "secondYellow",
            "red"
          ].includes(event.type) &&
          event.subjectType === "member"
        );

      const attachments = [
        ["A", 1],
        ["B", Number(data.attachments?.modB || 0)],
        ["C", playerDiscipline ? 1 : 0],
        ["C1", memberDiscipline ? 1 : 0],
        ["D", 1],
        [
          "D/AA*",
          data.attachments?.modDIntegration ? 1 : 0
        ],
        ["F", 1],
        ["DAE", Number(data.attachments?.dae || 0)],
        [
          "DOC",
          Number(data.attachments?.documents || 0)
        ]
      ];

      drawCell(
        page,
        "N° fogli\nallegati",
        65,
        410,
        33,
        50,
        {
          bold: true,
          size: 6,
          wrap: true
        }
      );

      attachments.forEach(
        ([label, value], index) => {
          const x = 98 + index * 45;

          drawCell(
            page,
            label,
            x,
            392,
            45,
            18,
            {
              bold: true,
              size: 8
            }
          );

          drawCell(
            page,
            String(value),
            x,
            410,
            45,
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
        "DI TRAUMA CRANICO COMMOTIVO E/O INFORTUNI GRAVI " +
        "ACCOMPAGNATI DA CERTIFICATO MEDICO E ALLEGATO CONCUSSION",
        75,
        575,
        410,
        {
          size: 8,
          bold: true,
          lineHeight: 10
        }
      );

      drawText(page, "NOTE:", 66, 640, {
        size: 9,
        bold: true
      });

      drawRectangle(
        page,
        65,
        655,
        440,
        120,
        { borderWidth: 1 }
      );

      wrapText(
        page,
        data.notes,
        70,
        662,
        430,
        {
          size: 8,
          lineHeight: 10,
          maximumLines: 10
        }
      );
    }

    /*
     * PAGINA 2 — MOD. F
     */

    function drawHalfCard(
      page,
      top,
      halfNumber
    ) {
      const x = MARGIN;
      const width = 499;

      drawRectangle(
        page,
        x,
        top,
        width,
        310,
        { borderWidth: 1.1 }
      );

      drawCell(
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

      drawCell(
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

      drawCell(
        page,
        "CAMPIONATO",
        x + 35,
        top + 24,
        85,
        18,
        { size: 7 }
      );

      drawCell(
        page,
        data.match?.category || "",
        x + 120,
        top + 24,
        80,
        18,
        {
          bold: true,
          size: 7
        }
      );

      drawCell(
        page,
        "SOC.",
        x + 200,
        top,
        40,
        24,
        { size: 7 }
      );

      drawCell(
        page,
        getTeamName(data, "home"),
        x + 240,
        top,
        108,
        24,
        {
          bold: true,
          size: 7
        }
      );

      drawCell(
        page,
        "SOC.",
        x + 348,
        top,
        40,
        24,
        { size: 7 }
      );

      drawCell(
        page,
        getTeamName(data, "away"),
        x + 388,
        top,
        111,
        24,
        {
          bold: true,
          size: 7
        }
      );

      drawCell(
        page,
        String(halfNumber),
        x,
        top + 42,
        35,
        50,
        {
          bold: true,
          size: 20
        }
      );

      drawCell(
        page,
        "gara del",
        x + 35,
        top + 42,
        65,
        18,
        { size: 7 }
      );

      drawCell(
        page,
        formatDate(data.match?.date),
        x + 35,
        top + 60,
        65,
        32,
        {
          bold: true,
          size: 8
        }
      );

      drawCell(
        page,
        "inizio",
        x + 100,
        top + 42,
        50,
        18,
        { size: 7 }
      );

      drawCell(
        page,
        halfNumber === 1
          ? data.match?.firstStart || ""
          : data.match?.secondStart || "",
        x + 100,
        top + 60,
        50,
        32,
        {
          bold: true,
          size: 8
        }
      );

      drawCell(
        page,
        "fine",
        x + 150,
        top + 42,
        50,
        18,
        { size: 7 }
      );

      drawCell(
        page,
        halfNumber === 1
          ? data.match?.firstEnd || ""
          : data.match?.secondEnd || "",
        x + 150,
        top + 60,
        50,
        32,
        {
          bold: true,
          size: 8
        }
      );

      drawCell(
        page,
        "SOSTITUZIONI TEMPORANEE",
        x + 200,
        top + 24,
        299,
        18,
        { size: 8 }
      );

      const temporaryEvents = events.filter(event =>
        event.type === "temporary" &&
        String(event.half) === String(halfNumber)
      );

      for (let row = 0; row < 5; row += 1) {
        ["home", "away"].forEach(
          (team, teamIndex) => {
            const item = temporaryEvents
              .filter(event => event.team === team)[row];

            drawCell(
              page,
              item
                ? `${item.minute}' ` +
                  `${item.outNumber || ""} ${item.out || ""} -> ` +
                  `${item.inNumber || ""} ${item.in || ""}`
                : "",
              x + 200 + teamIndex * 149.5,
              top + 42 + row * 14,
              149.5,
              14,
              { size: 6 }
            );
          }
        );
      }

      const scoreTop = top + 92;
      const leftWidth = 200;
      const rightWidth = 299;

      drawRectangle(
        page,
        x,
        scoreTop,
        leftWidth,
        120
      );

      for (let row = 1; row < 5; row += 1) {
        drawLine(
          page,
          x,
          scoreTop + row * 24,
          x + leftWidth,
          scoreTop + row * 24
        );
      }

      for (let column = 1; column < 12; column += 1) {
        drawLine(
          page,
          x + column * (leftWidth / 12),
          scoreTop,
          x + column * (leftWidth / 12),
          scoreTop + 120,
          0.5
        );
      }

      SCORE_TYPES.forEach((scoreType, index) => {
        drawText(
          page,
          scoreType.label.toUpperCase(),
          x + 82,
          scoreTop + 7 + index * 24,
          {
            size: 5,
            bold: true
          }
        );

        drawText(
          page,
          String(
            countEvents(
              data,
              "home",
              halfNumber,
              scoreType.key
            )
          ),
          x + 45,
          scoreTop + 6 + index * 24,
          {
            size: 8,
            bold: true
          }
        );

        drawText(
          page,
          String(
            countEvents(
              data,
              "away",
              halfNumber,
              scoreType.key
            )
          ),
          x + 170,
          scoreTop + 6 + index * 24,
          {
            size: 8,
            bold: true
          }
        );
      });

      drawCell(
        page,
        "TESSERATI O GIOCATORI",
        x + leftWidth,
        scoreTop,
        rightWidth,
        18,
        { size: 8 }
      );

      const disciplinaryColumns = [
        ["AMMONITI", "home", "yellow"],
        ["ESPULSI", "home", "red"],
        ["AMMONITI", "away", "yellow"],
        ["ESPULSI", "away", "red"]
      ];

      disciplinaryColumns.forEach(
        ([label, team, type], index) => {
          const columnX =
            x +
            leftWidth +
            index * (rightWidth / 4);

          drawCell(
            page,
            label,
            columnX,
            scoreTop + 18,
            rightWidth / 4,
            18,
            { size: 7 }
          );

          const relevant = events.filter(event =>
            event.team === team &&
            String(event.half) ===
              String(halfNumber) &&
            (
              type === "yellow"
                ? event.type === "yellow"
                : ["red", "secondYellow"]
                    .includes(event.type)
            )
          );

          for (let row = 0; row < 4; row += 1) {
            const item = relevant[row];

            drawCell(
              page,
              item
                ? `${item.minute}' n.${item.number || ""}`
                : "",
              columnX,
              scoreTop + 36 + row * 15,
              rightWidth / 4,
              15,
              { size: 6 }
            );
          }
        }
      );

      const permanentTop = scoreTop + 120;

      drawCell(
        page,
        "SOSTITUZIONI DEFINITIVE",
        x + leftWidth,
        permanentTop,
        rightWidth,
        18,
        { size: 8 }
      );

      const permanentEvents = events.filter(event =>
        event.type === "permanent" &&
        String(event.half) === String(halfNumber)
      );

      for (let row = 0; row < 7; row += 1) {
        ["home", "away"].forEach(
          (team, teamIndex) => {
            const item = permanentEvents
              .filter(event => event.team === team)[row];

            drawCell(
              page,
              item
                ? `${item.minute}' ` +
                  `${item.outNumber || ""} ${item.out || ""} -> ` +
                  `${item.inNumber || ""} ${item.in || ""}`
                : "",
              x +
                leftWidth +
                teamIndex * (rightWidth / 2),
              permanentTop + 18 + row * 14,
              rightWidth / 2,
              14,
              { size: 6 }
            );
          }
        );
      }
    }

    function drawModFPage() {
      const page = addPage();

      drawHalfCard(page, 50, 1);
      drawHalfCard(page, 373, 2);

      drawText(page, "L'arbitro", 58, 700, {
        size: 8
      });

      drawText(page, fullName, 135, 700, {
        size: 8,
        bold: true,
        width: 150
      });

      drawText(
        page,
        "Numero Tessera",
        58,
        719,
        { size: 8 }
      );

      drawText(
        page,
        data.referee?.card,
        160,
        719,
        {
          size: 8,
          bold: true
        }
      );

      drawText(page, "Firma:", 205, 754, {
        size: 9,
        bold: true
      });

      drawLine(
        page,
        300,
        775,
        455,
        775,
        1
      );

      drawCenteredText(
        page,
        reverseName,
        300,
        776,
        155,
        16,
        { size: 8 }
      );

      drawPageCode(page, "MOD. F", 2);
    }

    /*
     * PAGINA 3 — MOD. A
     */

    function drawModAPage() {
      const page = addPage();
      const x = MARGIN;
      const width = 499;

      drawRectangle(
        page,
        x,
        50,
        width,
        280,
        { borderWidth: 1.2 }
      );

      drawCell(
        page,
        "FEDERUGBY\nCommissione\nNazionale\nArbitri",
        x,
        50,
        130,
        62,
        {
          bold: true,
          size: 9,
          wrap: true
        }
      );

      drawCell(
        page,
        "REFERTO\nARBITRALE",
        x + 130,
        50,
        190,
        62,
        {
          bold: true,
          size: 14,
          wrap: true
        }
      );

      drawCell(
        page,
        `Gara del: ${formatDate(data.match?.date)}`,
        x + 320,
        50,
        179,
        31,
        {
          bold: true,
          size: 9
        }
      );

      drawCell(
        page,
        `Ore: ${data.match?.time || ""}`,
        x + 320,
        81,
        179,
        31,
        {
          bold: true,
          size: 9
        }
      );

      drawCell(
        page,
        `Campionato: ${data.match?.category || ""}`,
        x,
        112,
        160,
        28,
        { size: 8 }
      );

      drawCell(
        page,
        `Gara giocata a: ${data.match?.location || ""}`,
        x + 160,
        112,
        190,
        28,
        { size: 8 }
      );

      drawCell(
        page,
        `Campo: ${data.match?.field || ""}`,
        x + 350,
        112,
        149,
        28,
        { size: 8 }
      );

      const officials = [
        [
          "ARBITRO",
          fullName,
          data.referee?.card
        ],
        [
          "G. di L. 1",
          data.team?.[0]?.name,
          data.team?.[0]?.card
        ],
        [
          "G. di L. 2",
          data.team?.[1]?.name,
          data.team?.[1]?.card
        ]
      ];

      officials.forEach(
        ([role, officialName, card], index) => {
          const top = 140 + index * 16;

          drawCell(
            page,
            role,
            x,
            top,
            60,
            16,
            {
              bold: true,
              size: 7
            }
          );

          drawCell(
            page,
            officialName || "",
            x + 60,
            top,
            360,
            16,
            { size: 8 }
          );

          drawCell(
            page,
            `Codice: ${card || ""}`,
            x + 420,
            top,
            79,
            16,
            { size: 7 }
          );
        }
      );

      const timeCells = [
        ["I° tempo", 60],
        ["inizio", 50],
        [data.match?.firstStart || "", 50],
        ["fine", 45],
        [data.match?.firstEnd || "", 50],
        ["II° tempo", 60],
        ["inizio", 45],
        [data.match?.secondStart || "", 50],
        ["fine", 40],
        [data.match?.secondEnd || "", 49]
      ];

      let timeX = x;

      timeCells.forEach(([value, cellWidth]) => {
        drawCell(
          page,
          value,
          timeX,
          188,
          cellWidth,
          22,
          {
            bold:
              String(value).includes("tempo") ||
              String(value).includes(":"),
            size: 7
          }
        );

        timeX += cellWidth;
      });

      const scoreTop = 210;
      const teamWidth = width / 2;

      ["home", "away"].forEach(
        (team, teamIndex) => {
          const sectionX =
            x + teamIndex * teamWidth;

          const labelWidth = 95;
          const metricWidth =
            (teamWidth - labelWidth) / 4;

          drawCell(
            page,
            getTeamName(data, team),
            sectionX,
            scoreTop,
            teamWidth,
            26,
            {
              bold: true,
              size: 9
            }
          );

          drawCell(
            page,
            "Punteggi",
            sectionX,
            scoreTop + 26,
            labelWidth,
            18,
            { size: 8 }
          );

          SCORE_TYPES.forEach(
            (scoreType, index) => {
              drawCell(
                page,
                scoreType.label,
                sectionX +
                  labelWidth +
                  index * metricWidth,
                scoreTop + 26,
                metricWidth,
                18,
                { size: 6 }
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
                scoreTop +
                44 +
                rowIndex * 18;

              drawCell(
                page,
                label,
                sectionX,
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
                        data,
                        team,
                        half,
                        scoreType.key
                      )
                    : (
                        countEvents(
                          data,
                          team,
                          1,
                          scoreType.key
                        ) +
                        countEvents(
                          data,
                          team,
                          2,
                          scoreType.key
                        )
                      );

                  drawCell(
                    page,
                    String(value),
                    sectionX +
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

          drawCell(
            page,
            "Punti",
            sectionX,
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
                  data,
                  team,
                  1,
                  scoreType.key
                ) +
                countEvents(
                  data,
                  team,
                  2,
                  scoreType.key
                );

              drawCell(
                page,
                String(
                  total * scoreType.points
                ),
                sectionX +
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

          drawText(
            page,
            `Totale: ${calculateTeamScore(data, team)}`,
            sectionX + 5,
            scoreTop + 122,
            {
              size: 10,
              bold: true
            }
          );
        }
      );

      drawText(
        page,
        "SOSTITUZIONI TEMPORANEE GIOCATORI",
        155,
        352,
        {
          size: 11,
          bold: true
        }
      );

      drawText(
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
      const halfWidth = width / 2;

      const columnWidths = [
        25,
        83,
        25,
        83,
        33.5
      ];

      const headers = [
        "N°",
        "Giocatore uscito",
        "N°",
        "Giocatore entrato",
        "t/min"
      ];

      ["home", "away"].forEach(
        (team, teamIndex) => {
          const tableX =
            x + teamIndex * halfWidth;

          drawCell(
            page,
            getTeamName(data, team),
            tableX,
            substitutionTop,
            halfWidth,
            20,
            {
              bold: true,
              size: 8
            }
          );

          let columnX = tableX;

          headers.forEach((header, index) => {
            drawCell(
              page,
              header,
              columnX,
              substitutionTop + 20,
              columnWidths[index],
              18,
              { size: 6 }
            );

            columnX += columnWidths[index];
          });

          const relevant = events.filter(event =>
            event.team === team &&
            event.type === "temporary"
          );

          for (let row = 0; row < 8; row += 1) {
            const event = relevant[row];

            const values = event
              ? [
                  event.outNumber || "",
                  event.out || "",
                  event.inNumber || "",
                  event.in || "",
                  `${event.half}/${event.minute}`
                ]
              : ["", "", "", "", ""];

            columnX = tableX;

            values.forEach((value, index) => {
              drawCell(
                page,
                value,
                columnX,
                substitutionTop +
                  38 +
                  row * 18,
                columnWidths[index],
                18,
                { size: 6 }
              );

              columnX += columnWidths[index];
            });
          }
        }
      );

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
          Boolean(data.attachments?.concussion)
        ],
        [
          "Assenze medico/accompagnatori",
          data.checks?.doctor === "No" ||
          data.checks?.escorts === "No"
        ],
        [
          "Comportamenti anomali",
          data.checks?.manager === "Censurabile" ||
          data.checks?.crowd === "Scorretto"
        ],
        [
          "Infortuni gravi",
          data.checks?.injuries === "Si"
        ],
        [
          "Rilievi",
          data.checks?.facilities === "Si"
        ],
        [
          "Incidenti",
          Boolean(
            data.checks?.before ||
            data.checks?.during ||
            data.checks?.after
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
            596 + row * 20;

          drawText(
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

          drawCheckbox(
            page,
            itemX + 142,
            itemTop - 2,
            checked
          );
        }
      );

      drawText(
        page,
        "Fogli allegati:",
        x,
        664,
        { size: 9 }
      );

      const playerDiscipline =
        events.some(event =>
          [
            "yellow",
            "secondYellow",
            "red"
          ].includes(event.type) &&
          event.subjectType !== "member"
        );

      const memberDiscipline =
        events.some(event =>
          [
            "secondYellow",
            "red"
          ].includes(event.type) &&
          event.subjectType === "member"
        );

      const attachments = [
        [
          "Elenchi Giocatori\nMod. B",
          Number(data.attachments?.modB || 0)
        ],
        [
          "Espulsioni\nMod. C/C1",
          playerDiscipline || memberDiscipline
            ? 1
            : 0
        ],
        [
          "Assenze, rilievi,\nincidenti - Mod. D",
          1
        ],
        [
          "Mod. D integrativo",
          data.attachments?.modDIntegration
            ? 1
            : 0
        ]
      ];

      attachments.forEach(
        ([label, value], index) => {
          const boxX =
            x + index * 105;

          drawCell(
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

          drawText(
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

      drawText(
        page,
        "FIRMA",
        420,
        684,
        {
          size: 10,
          bold: true
        }
      );

      drawLine(
        page,
        365,
        730,
        535,
        730,
        1
      );

      drawCenteredText(
        page,
        reverseName,
        365,
        731,
        170,
        17,
        { size: 8 }
      );

      drawPageCode(page, "MOD. A", 3);
    }

    /*
     * PAGINA 4 — MOD. C
     */

    function drawDisciplinaryTable(
      page,
      title,
      top,
      eventType,
      rowCount
    ) {
      const x = MARGIN;
      const width = 499;

      drawCell(
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
        { label: "SQ. n°", width: 38 },
        {
          label: "Cognome giocatore",
          width: 254
        },
        { label: "N° Maglia", width: 40 },
        { label: "n° tessera", width: 57 },
        { label: "tempo", width: 55 },
        { label: "minuto", width: 55 }
      ];

      let columnX = x;

      columns.forEach(column => {
        drawCell(
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

      for (let row = 0; row < rowCount; row += 1) {
        const event = relevant[row];

        const values = event
          ? [
              event.team === "home" ? "1" : "2",
              event.person || "",
              event.number || "",
              event.card || "",
              event.half || "",
              event.minute || ""
            ]
          : ["", "", "", "", "", ""];

        columnX = x;

        values.forEach((value, index) => {
          drawCell(
            page,
            value,
            columnX,
            top + 47 + row * 18,
            columns[index].width,
            18,
            { size: 7 }
          );

          columnX += columns[index].width;
        });
      }

      return top + 47 + rowCount * 18;
    }

    function drawModCPage() {
      const page = addPage();

      drawText(
        page,
        "FEDERUGBY",
        MARGIN,
        38,
        {
          size: 11,
          bold: true
        }
      );

      let top = drawDisciplinaryTable(
        page,
        "GIOCATORI ESCLUSI TEMPORANEAMENTE - " +
        "1° CARTELLINO GIALLO",
        50,
        "yellow",
        8
      );

      top = drawDisciplinaryTable(
        page,
        "GIOCATORI ESPULSI PER 2° CARTELLINO GIALLO",
        top + 10,
        "secondYellow",
        4
      );

      top = drawDisciplinaryTable(
        page,
        "GIOCATORI ESPULSI - CARTELLINO ROSSO",
        top + 10,
        "red",
        4
      );

      const redEvents = events.filter(event =>
        event.type === "red" &&
        event.subjectType !== "member"
      );

      for (let index = 0; index < 4; index += 1) {
        const reasonTop =
          top + 10 + index * 64;

        drawRectangle(
          page,
          MARGIN,
          reasonTop,
          499,
          58
        );

        drawText(
          page,
          "Motivo:",
          MARGIN + 3,
          reasonTop + 3,
          { size: 8 }
        );

        wrapText(
          page,
          redEvents[index]?.notes || "",
          MARGIN + 5,
          reasonTop + 16,
          489,
          {
            size: 7,
            lineHeight: 9,
            maximumLines: 4
          }
        );
      }

      drawRectangle(
        page,
        MARGIN,
        720,
        499,
        65,
        { borderWidth: 1.2 }
      );

      drawCell(
        page,
        "Foglio\nN° 4 di 6\nMOD. C",
        MARGIN,
        720,
        85,
        65,
        {
          bold: true,
          size: 9,
          wrap: true
        }
      );

      drawCell(
        page,
        `Data: ${formatDate(data.match?.date)}`,
        MARGIN + 85,
        720,
        220,
        25,
        {
          bold: true,
          size: 8
        }
      );

      drawCell(
        page,
        `SQ 1: ${getTeamName(data, "home")}`,
        MARGIN + 85,
        745,
        110,
        40,
        {
          size: 7,
          wrap: true
        }
      );

      drawCell(
        page,
        `SQ 2: ${getTeamName(data, "away")}`,
        MARGIN + 195,
        745,
        110,
        40,
        {
          size: 7,
          wrap: true
        }
      );

      drawCell(
        page,
        `L'arbitro\n${reverseName}`,
        MARGIN + 305,
        720,
        194,
        65,
        {
          size: 8,
          wrap: true
        }
      );
    }

    /*
     * PAGINA 5 — MOD. C1
     */

    function drawModC1Page() {
      const page = addPage();
      const x = MARGIN;
      const width = 499;

      drawText(
        page,
        "FEDERUGBY",
        x,
        38,
        {
          size: 11,
          bold: true
        }
      );

      drawCell(
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
        ["secondYellow", "red"].includes(event.type)
      );

      const columns = [
        { label: "SQ. N°", width: 38 },
        {
          label: "Cognome e Nome",
          width: 294
        },
        { label: "n° tessera", width: 57 },
        { label: "tempo", width: 55 },
        { label: "minuto", width: 55 }
      ];

      let top = 85;

      for (let row = 0; row < 6; row += 1) {
        let columnX = x;

        columns.forEach(column => {
          drawCell(
            page,
            row === 0 ? column.label : "",
            columnX,
            top,
            column.width,
            24,
            {
              size: 7,
              wrap: true
            }
          );

          columnX += column.width;
        });

        const event = members[row];

        const values = event
          ? [
              event.team === "home" ? "1" : "2",
              event.person || "",
              event.card || "",
              event.half || "",
              event.minute || ""
            ]
          : ["", "", "", "", ""];

        columnX = x;

        values.forEach((value, index) => {
          drawCell(
            page,
            value,
            columnX,
            top + 24,
            columns[index].width,
            20,
            { size: 7 }
          );

          columnX += columns[index].width;
        });

        drawRectangle(
          page,
          x,
          top + 44,
          width,
          60
        );

        drawText(
          page,
          "Motivo:",
          x + 3,
          top + 47,
          { size: 8 }
        );

        wrapText(
          page,
          event?.notes || "",
          x + 5,
          top + 61,
          width - 10,
          {
            size: 7,
            lineHeight: 9,
            maximumLines: 4
          }
        );

        top += 104;
      }

      drawRectangle(
        page,
        x,
        720,
        width,
        65,
        { borderWidth: 1.2 }
      );

      drawCell(
        page,
        "Foglio\nN° 5 di 6\nMOD. C1",
        x,
        720,
        85,
        65,
        {
          bold: true,
          size: 9,
          wrap: true
        }
      );

      drawCell(
        page,
        `Data: ${formatDate(data.match?.date)}`,
        x + 85,
        720,
        220,
        25,
        {
          bold: true,
          size: 8
        }
      );

      drawCell(
        page,
        `SQ 1: ${getTeamName(data, "home")}`,
        x + 85,
        745,
        110,
        40,
        {
          size: 7,
          wrap: true
        }
      );

      drawCell(
        page,
        `SQ 2: ${getTeamName(data, "away")}`,
        x + 195,
        745,
        110,
        40,
        {
          size: 7,
          wrap: true
        }
      );

      drawCell(
        page,
        `L'arbitro\n${reverseName}`,
        x + 305,
        720,
        194,
        65,
        {
          size: 8,
          wrap: true
        }
      );
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
      drawText(
        page,
        label,
        MARGIN + 3,
        top,
        {
          size: 8,
          width: 310
        }
      );

      drawText(
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

      drawCheckbox(
        page,
        440,
        top - 2,
        leftSelected
      );

      drawText(
        page,
        rightLabel,
        475,
        top,
        {
          size: 8,
          bold: true
        }
      );

      drawCheckbox(
        page,
        520,
        top - 2,
        rightSelected
      );
    }

    function drawModDPage() {
      const page = addPage();

      drawRectangle(
        page,
        MARGIN,
        50,
        499,
        700,
        { borderWidth: 1.2 }
      );

      drawCell(
        page,
        "FEDERUGBY",
        MARGIN,
        50,
        80,
        22,
        {
          bold: true,
          size: 10
        }
      );

      drawCell(
        page,
        `GARA: ${data.match?.category || ""}: ` +
        `${getTeamName(data, "home")} - ` +
        `${getTeamName(data, "away")}`,
        MARGIN + 80,
        50,
        320,
        22,
        {
          bold: true,
          size: 8
        }
      );

      drawCell(
        page,
        `del: ${formatDate(data.match?.date)}`,
        MARGIN + 400,
        50,
        99,
        22,
        {
          bold: true,
          size: 8
        }
      );

      drawText(
        page,
        "Riferimenti riassuntivi:",
        MARGIN + 2,
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
        "SI",
        data.checks?.doctor === "Si",
        "NO",
        data.checks?.doctor === "No"
      );

      drawAnswerPair(
        page,
        "2) Gli accompagnatori erano entrambi presenti?",
        116,
        "SI",
        data.checks?.escorts === "Si",
        "NO",
        data.checks?.escorts === "No"
      );

      drawAnswerPair(
        page,
        "3) Il comportamento del dirigente addetto all'arbitro è stato:",
        136,
        "Normale",
        data.checks?.manager === "Normale",
        "Censurabile",
        data.checks?.manager === "Censurabile"
      );

      drawAnswerPair(
        page,
        "4) Il comportamento del pubblico è stato:",
        156,
        "Corretto",
        data.checks?.crowd === "Corretto",
        "Scorretto",
        data.checks?.crowd === "Scorretto"
      );

      drawText(
        page,
        "5) Misure d'ordine prese dall'Ente ospitante:",
        MARGIN + 3,
        180,
        {
          size: 8
        }
      );

      [
        "Svolte da forze dell'ordine",
        "Richieste ma assenti",
        "Non richieste ed assenti"
      ].forEach((option, index) => {
        const top = 178 + index * 20;

        drawText(
          page,
          option,
          300,
          top,
          {
            size: 8,
            bold: true,
            align: "right",
            width: 185
          }
        );

        drawCheckbox(
          page,
          495,
          top - 2,
          data.checks?.security === option
        );
      });

      drawAnswerPair(
        page,
        "6) Rilievi su terreno e spogliatoi:",
        244,
        "NO",
        data.checks?.facilities === "No",
        "SI",
        data.checks?.facilities === "Si"
      );

      drawAnswerPair(
        page,
        "7) Infortuni:",
        264,
        "NO",
        data.checks?.injuries === "No",
        "SI",
        data.checks?.injuries === "Si"
      );

      drawText(
        page,
        "8) Incidenti avvenuti:",
        MARGIN + 3,
        286,
        {
          size: 8
        }
      );

      [
        [
          "Prima della gara",
          data.checks?.before
        ],
        [
          "Durante la gara",
          data.checks?.during
        ],
        [
          "Dopo la gara",
          data.checks?.after
        ]
      ].forEach(([label, checked], index) => {
        const x = 180 + index * 115;

        drawText(
          page,
          label,
          x,
          286,
          {
            size: 8,
            bold: true
          }
        );

        drawCheckbox(
          page,
          x + 88,
          283,
          Boolean(checked)
        );
      });

      drawCell(
        page,
        "DESCRIVERE DETTAGLIATAMENTE E NELL'ORDINE " +
        "DI QUANTO BARRATO IN PREMESSA",
        MARGIN,
        310,
        499,
        24,
        {
          bold: true,
          size: 9,
          fill: lightGray
        }
      );

      drawRectangle(
        page,
        MARGIN,
        334,
        499,
        416,
        {
          borderWidth: 1.2
        }
      );

      wrapText(
        page,
        data.checks?.details || "",
        MARGIN + 8,
        344,
        483,
        {
          size: 9,
          lineHeight: 12,
          maximumLines: 32
        }
      );

      drawRectangle(
        page,
        MARGIN,
        750,
        499,
        50,
        {
          borderWidth: 1.2
        }
      );

      drawCell(
        page,
        "MOD. D",
        MARGIN,
        750,
        70,
        50,
        {
          bold: true,
          size: 13
        }
      );

      drawCell(
        page,
        "Foglio\nn. 6 di 6",
        MARGIN + 70,
        750,
        90,
        50,
        {
          bold: true,
          size: 9,
          wrap: true
        }
      );

      drawText(
        page,
        "Firma:",
        235,
        766,
        { size: 9 }
      );

      drawLine(
        page,
        285,
        782,
        515,
        782,
        1
      );

      drawCenteredText(
        page,
        reverseName,
        285,
        783,
        230,
        15,
        { size: 8 }
      );
    }

    drawMailPage();
    drawModFPage();
    drawModAPage();
    drawModCPage();
    drawModC1Page();
    drawModDPage();

    const bytes = await pdf.save();

    const fileName =
      `referto-federale-` +
      `${data.match?.date || "bozza"}-` +
      `${safeFileName(data.match?.home)}.pdf`;

    downloadPdf(bytes, fileName);

    return fileName;
  }

  async function generateFederalPdf() {
    const message =
      document.querySelector("#saveMsg");

    const button =
      document.querySelector("#pdf");

    try {
      if (button) {
        button.disabled = true;
      }

      if (message) {
        message.textContent =
          "Generazione della replica federale in corso…";

        message.style.color = "#17633a";
      }

      const fileName =
        await buildFederalPdf();

      if (message) {
        message.textContent =
          `Replica federale generata: ${fileName}`;
      }
    } catch (error) {
      console.error(
        "Errore PDF federale:",
        error
      );

      if (message) {
        message.textContent =
          `Errore PDF: ${error.message}`;

        message.style.color = "#b4232d";
      }
    } finally {
      if (button) {
        button.disabled = false;
      }
    }
  }

  function bindPdfButton() {
    const oldButton =
      document.querySelector("#pdf");

    if (!oldButton) {
      console.error(
        "Pulsante #pdf non trovato."
      );

      return;
    }

    /*
     * Clonando il pulsante eliminiamo ogni vecchio listener
     * eventualmente aggiunto da app.js o da versioni precedenti.
     */
    const button =
      oldButton.cloneNode(true);

    oldButton.replaceWith(button);

    button.textContent =
      "Scarica replica federale";

    button.addEventListener(
      "click",
      event => {
        event.preventDefault();
        event.stopPropagation();

        generateFederalPdf();
      }
    );

    window.generateFederalPdf =
      generateFederalPdf;

    console.info(
      "Generatore PDF federale v11 pronto."
    );
  }

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      bindPdfButton,
      { once: true }
    );
  } else {
    bindPdfButton();
  }
})();
