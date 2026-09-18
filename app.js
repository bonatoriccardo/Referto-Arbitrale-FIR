const firebaseConfig = {
  apiKey: "AIzaSyA1mu-2RcO8r09yYz8_PXrH1QUnUbgnaFM",
  authDomain: "referto-arbitrale-fir.firebaseapp.com",
  projectId: "referto-arbitrale-fir",
  storageBucket: "referto-arbitrale-fir.firebasestorage.app",
  messagingSenderId: "102392200236",
  appId: "1:102392200236:web:db5445434b0d391452a589",
  measurementId: "G-0V3B99CKE8"
};

firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];

const show = (element, visible = true) => {
  element.classList.toggle("hidden", !visible);
};

const escapeHtml = value => String(value ?? "").replace(
  /[&<>'"]/g,
  character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;"
  })[character]
);

window.addEventListener("error", event => {
  const box = $("#authMsg");

  if (box) {
    box.textContent = `Errore applicazione: ${event.message}`;
  }
});

window.addEventListener("unhandledrejection", event => {
  const box = $("#authMsg");

  if (box && !$("#auth").classList.contains("hidden")) {
    box.textContent =
      `Errore: ${event.reason?.message || event.reason}`;
  }
});

async function removeOldCache() {
  if ("serviceWorker" in navigator) {
    const registrations =
      await navigator.serviceWorker.getRegistrations();

    await Promise.all(
      registrations.map(registration => registration.unregister())
    );
  }

  if ("caches" in window) {
    const keys = await caches.keys();

    await Promise.all(
      keys
        .filter(key => key.startsWith("referto-fir-"))
        .map(key => caches.delete(key))
    );
  }
}

const categories = [
  "SERIE A ELITE MASCHILE",
  "SERIE A ELITE FEMM",
  "COPPA CONFERENCE",
  "SERIE A",
  "SERIE A FEMM",
  "SERIE B",
  "SERIE C",
  "U18",
  "U16",
  "U14"
];

const committees = [
  "Comitato Regionale Abruzzese",
  "Comitato Provinciale di Bolzano",
  "Comitato Regionale Calabro",
  "Comitato Regionale Campano",
  "Comitato Regionale Friuli Venezia Giulia",
  "Comitato Regionale Emilia Romagna",
  "Comitato Regionale Laziale",
  "Comitato Regionale Ligure",
  "Comitato Regionale Lombardo",
  "Comitato Regionale Marche",
  "Comitato Regionale Piemonte",
  "Comitato Regionale Pugliese",
  "Comitato Regionale Sardo",
  "Comitato Regionale Siciliano",
  "Comitato Regionale Toscano",
  "Comitato Provinciale di Trento",
  "Comitato Regionale Veneto",
  "Comitato Regionale Umbro",
  "Ufficio Giudice Sportivo C.O."
];

const roles = [
  "1° Assistente",
  "2° Assistente",
  "4° Uomo",
  "5° Uomo",
  "TMO",
  "Tutor",
  "Dir. Concentr."
];

const points = {
  try: 5,
  conversion: 2,
  penalty: 3,
  drop: 3
};

const labels = {
  try: "Meta",
  conversion: "Trasformazione",
  penalty: "Punizione",
  drop: "Drop",
  yellow: "Cartellino giallo",
  secondYellow: "Espulsione per 2° giallo",
  red: "Cartellino rosso",
  temporary: "Sostituzione temporanea",
  permanent: "Sostituzione definitiva"
};

const checkLabels = {
  doctor: "Medico presente",
  escorts: "Accompagnatori presenti",
  manager: "Dirigente addetto all’arbitro",
  crowd: "Comportamento del pubblico",
  security: "Misure d’ordine",
  facilities: "Rilievi su terreno o spogliatoi",
  injuries: "Infortuni",
  before: "Incidenti prima della gara",
  during: "Incidenti durante la gara",
  after: "Incidenti dopo la gara",
  details: "Descrizione dettagliata"
};

let user = null;
let reportId = null;
let events = [];
let step = 0;
let selectedTeam = "home";
let selectedEvent = null;

function populateOptions(element, values) {
  element.innerHTML =
    '<option value="">Seleziona</option>' +
    values.map(value => `<option>${escapeHtml(value)}</option>`).join("");
}

populateOptions($("#committee"), committees);
populateOptions($("#category"), categories);

$("#teamRows").innerHTML = roles.map((role, index) => `
  <div class="team-row">
    <input value="${escapeHtml(role)}" disabled>
    <input name="team.${index}.name" placeholder="Nome e cognome">
    <input name="team.${index}.card" placeholder="Numero tessera">
  </div>
`).join("");

const stepNames = [
  "Profilo",
  "Gara",
  "Cartellino",
  "Riferimenti",
  "Riepilogo"
];

$("#steps").innerHTML = stepNames.map((name, index) => `
  <button type="button" data-go="${index}">
    ${index + 1}. ${name}
  </button>
`).join("");

function authMessage(error) {
  const messages = {
    "auth/invalid-credential": "E-mail o password non corretti.",
    "auth/user-not-found": "E-mail o password non corretti.",
    "auth/wrong-password": "E-mail o password non corretti.",
    "auth/too-many-requests":
      "Troppi tentativi. Attendi qualche minuto e riprova.",
    "auth/network-request-failed":
      "Connessione non disponibile. Controlla la rete.",
    "auth/unauthorized-domain":
      "Dominio non autorizzato in Firebase Authentication.",
    "auth/user-disabled": "Questo account è stato disabilitato."
  };

  return messages[error.code] || error.message || "Accesso non riuscito.";
}

async function refreshVerifiedToken() {
  if (!auth.currentUser) {
    throw new Error("Sessione scaduta: accedi nuovamente.");
  }

  await auth.currentUser.reload();

  if (!auth.currentUser.emailVerified) {
    throw new Error("Verifica prima il tuo indirizzo e-mail.");
  }

  await auth.currentUser.getIdToken(true);
  user = auth.currentUser;
}

function go(targetStep) {
  step = Math.max(0, Math.min(4, targetStep));

  $$(".panel").forEach((panel, index) => {
    show(panel, index === step);
  });

  $$("#steps button").forEach((button, index) => {
    button.classList.toggle("active", index === step);
  });

  show($("#prev"), step > 0);
  show($("#next"), step < 4);

  $("#progress").textContent = `Passaggio ${step + 1} di 5`;

  if (step === 2) {
    renderEvents();
  }

  if (step === 4) {
    renderSummary();
  }

  window.scrollTo({ top: 0, behavior: "smooth" });
}

$("#steps").addEventListener("click", event => {
  const button = event.target.closest("[data-go]");

  if (button) {
    go(Number(button.dataset.go));
  }
});

$("#prev").addEventListener("click", () => go(step - 1));

$("#next").addEventListener("click", () => {
  const currentPanel = $$(".panel")[step];

  const invalidField = [...currentPanel.querySelectorAll("[required]")]
    .find(field => !field.checkValidity());

  if (invalidField) {
    invalidField.reportValidity();
    return;
  }

  go(step + 1);
});

function updateTeamNames() {
  const home = $("#homeInput").value.trim() || "Società 1";
  const away = $("#awayInput").value.trim() || "Società 2";

  $$(".js-home").forEach(element => {
    element.textContent = home;
  });

  $$(".js-away").forEach(element => {
    element.textContent = away;
  });
}

$("#homeInput").addEventListener("input", updateTeamNames);
$("#awayInput").addEventListener("input", updateTeamNames);

function getFormData() {
  const data = {
    referee: {},
    match: {},
    team: [],
    checks: {
      before: false,
      during: false,
      after: false
    },
    notes: "",
    declaration: false,
    events
  };

  new FormData($("#reportForm")).forEach((value, key) => {
    if (key.startsWith("team.")) {
      const [, index, property] = key.split(".");

      data.team[index] ??= { role: roles[index] };
      data.team[index][property] = value;
      return;
    }

    if (key.includes(".")) {
      const [section, property] = key.split(".");
      data[section][property] = value === "on" ? true : value;
      return;
    }

    data[key] = value === "on" ? true : value;
  });

  return data;
}

function setFormData(data) {
  Object.entries(data || {}).forEach(([section, value]) => {
    if (section === "events") {
      events = Array.isArray(value) ? value : [];
      return;
    }

    if (section === "team") {
      (value || []).forEach((member, index) => {
        Object.entries(member || {}).forEach(([property, fieldValue]) => {
          const element = $(`[name="team.${index}.${property}"]`);

          if (element) {
            element.value = fieldValue ?? "";
          }
        });
      });

      return;
    }

    if (
      value &&
      typeof value === "object" &&
      !("seconds" in value)
    ) {
      Object.entries(value).forEach(([property, fieldValue]) => {
        const elements = $$(`[name="${section}.${property}"]`);

        if (!elements.length) {
          return;
        }

        if (elements[0].type === "radio") {
          elements.forEach(element => {
            element.checked = element.value === fieldValue;
          });
        } else if (elements[0].type === "checkbox") {
          elements[0].checked = Boolean(fieldValue);
        } else {
          elements[0].value = fieldValue ?? "";
        }
      });

      return;
    }

    const element = $(`[name="${section}"]`);

    if (!element) {
      return;
    }

    if (element.type === "checkbox") {
      element.checked = Boolean(value);
    } else {
      element.value = value ?? "";
    }
  });

  updateTeamNames();
  renderEvents();
}

$$(".team-choice").forEach(button => {
  button.addEventListener("click", () => {
    $$(".team-choice").forEach(item => {
      item.classList.remove("selected");
    });

    button.classList.add("selected");
    selectedTeam = button.dataset.team;
  });
});

$$(".event-tile").forEach(button => {
  button.addEventListener("click", () => {
    openEventEditor(button.dataset.event);
  });
});

function openEventEditor(type) {
  selectedEvent = type;

  const teamName = selectedTeam === "home"
    ? ($("#homeInput").value || "Società 1")
    : ($("#awayInput").value || "Società 2");

  $("#editorTitle").textContent = `${labels[type]} · ${teamName}`;

  const isChange = ["temporary", "permanent"].includes(type);
  const isDisciplinary =
    ["yellow", "secondYellow", "red"].includes(type);

  $$(".change-field").forEach(element => show(element, isChange));

  $$(".person-field, .number-field, .card-field")
    .forEach(element => show(element, isDisciplinary));

  show($("#eventEditor"));
  $("#evMinute").focus();
}

$("#cancelEvent").addEventListener("click", () => {
  show($("#eventEditor"), false);
  selectedEvent = null;
});

$("#confirmEvent").addEventListener("click", () => {
  if (!selectedEvent) {
    alert("Seleziona un evento.");
    return;
  }

  const minute = $("#evMinute").value;

  if (minute === "") {
    alert("Inserisci il minuto.");
    return;
  }

  const matchEvent = {
    team: selectedTeam,
    type: selectedEvent,
    half: $("#evHalf").value,
    minute,
    person: $("#evPerson").value.trim(),
    number: $("#evNumber").value.trim(),
    card: $("#evCard").value.trim(),
    out: $("#evOut").value.trim(),
    in: $("#evIn").value.trim(),
    notes: $("#evNotes").value.trim()
  };

  const isChange =
    ["temporary", "permanent"].includes(selectedEvent);

  if (isChange && (!matchEvent.out || !matchEvent.in)) {
    alert("Indica chi esce e chi entra.");
    return;
  }

  events.push(matchEvent);

  [
    "#evMinute",
    "#evPerson",
    "#evNumber",
    "#evCard",
    "#evOut",
    "#evIn",
    "#evNotes"
  ].forEach(selector => {
    $(selector).value = "";
  });

  show($("#eventEditor"), false);
  selectedEvent = null;
  renderEvents();
});

function calculateScore(team) {
  return events
    .filter(matchEvent => matchEvent.team === team)
    .reduce(
      (total, matchEvent) =>
        total + (points[matchEvent.type] || 0),
      0
    );
}

function eventDetails(matchEvent) {
  if (["temporary", "permanent"].includes(matchEvent.type)) {
    return [
      `${matchEvent.out || "—"} → ${matchEvent.in || "—"}`,
      matchEvent.notes
    ].filter(Boolean).join(" · ");
  }

  return [
    matchEvent.person,
    matchEvent.number && `maglia ${matchEvent.number}`,
    matchEvent.card && `tessera ${matchEvent.card}`,
    matchEvent.notes
  ].filter(Boolean).join(" · ");
}

function renderEvents() {
  updateTeamNames();

  $("#homeScore").textContent = calculateScore("home");
  $("#awayScore").textContent = calculateScore("away");

  show($("#emptyEvents"), events.length === 0);

  $("#eventsList").innerHTML = events.map((matchEvent, index) => {
    const teamName = matchEvent.team === "home"
      ? ($("#homeInput").value || "Società 1")
      : ($("#awayInput").value || "Società 2");

    return `
      <div class="event-row ${matchEvent.team === "away" ? "away" : ""}">
        <div class="event-minute">
          ${escapeHtml(matchEvent.half)}T ·
          ${escapeHtml(matchEvent.minute)}'
        </div>

        <div class="event-main">
          <b>
            ${escapeHtml(labels[matchEvent.type])}
            · ${escapeHtml(teamName)}
          </b>
          <small>
            ${escapeHtml(eventDetails(matchEvent) || "Nessun dettaglio")}
          </small>
        </div>

        <button
          class="danger"
          type="button"
          data-delete="${index}"
          aria-label="Elimina evento"
        >
          ×
        </button>
      </div>
    `;
  }).join("");
}

$("#eventsList").addEventListener("click", event => {
  const button = event.target.closest("[data-delete]");

  if (!button) {
    return;
  }

  events.splice(Number(button.dataset.delete), 1);
  renderEvents();
});

function renderSummary() {
  const data = getFormData();

  $("#summary").innerHTML = `
    <div class="scoreboard">
      <div class="score-team home-card">
        <span>${escapeHtml(data.match.home || "Società 1")}</span>
        <strong>${calculateScore("home")}</strong>
      </div>

      <div class="versus">FINALE</div>

      <div class="score-team away-card">
        <span>${escapeHtml(data.match.away || "Società 2")}</span>
        <strong>${calculateScore("away")}</strong>
      </div>
    </div>

    <div class="summary-grid">
      <div class="summary-box">
        <small>Gara</small>
        <b>${escapeHtml(data.match.category || "—")}</b>
      </div>

      <div class="summary-box">
        <small>Data e ora</small>
        <b>
          ${escapeHtml(data.match.date || "—")}
          · ${escapeHtml(data.match.time || "—")}
        </b>
      </div>

      <div class="summary-box">
        <small>Eventi</small>
        <b>${events.length}</b>
      </div>
    </div>

    <p>
      <b>Arbitro:</b>
      ${escapeHtml(data.referee.firstName)}
      ${escapeHtml(data.referee.lastName)}
      · Tessera ${escapeHtml(data.referee.card)}
    </p>
  `;
}

async function saveReport(status = "draft") {
  await refreshVerifiedToken();

  const data = getFormData();
  const isNew = !reportId;

  data.owner = user.uid;
  data.status = status;
  data.updatedAt =
    firebase.firestore.FieldValue.serverTimestamp();

  if (isNew) {
    data.createdAt =
      firebase.firestore.FieldValue.serverTimestamp();
  }

  const reference = isNew
    ? db.collection("reports").doc()
    : db.collection("reports").doc(reportId);

  reportId = reference.id;

  await Promise.all([
    reference.set(data, { merge: true }),

    db.collection("profiles")
      .doc(user.uid)
      .set(
        {
          ...data.referee,
          updatedAt:
            firebase.firestore.FieldValue.serverTimestamp()
        },
        { merge: true }
      )
  ]);

  $("#saveMsg").textContent =
    status === "completed"
      ? "Referto confermato."
      : "Bozza salvata correttamente.";

  await loadReports();
}

async function guardedSave(status) {
  try {
    if (
      status === "completed" &&
      !$("#reportForm").reportValidity()
    ) {
      return;
    }

    await saveReport(status);
  } catch (error) {
    console.error(error);

    $("#saveMsg").textContent =
      error.code === "permission-denied"
        ? "Permesso negato: pubblica le regole Firestore e accedi nuovamente."
        : `Errore: ${error.message}`;
  }
}

$("#save").addEventListener("click", () => guardedSave("draft"));
$("#complete").addEventListener("click", () => guardedSave("completed"));

function createPdf() {
  const data = getFormData();
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({ unit: "mm", format: "a4" });

  let y = 36;

  function addLine(text, size = 10, bold = false) {
    pdf.setFontSize(size);
    pdf.setFont("helvetica", bold ? "bold" : "normal");

    const lines = pdf.splitTextToSize(String(text ?? ""), 180);

    if (y + lines.length * 6 > 280) {
      pdf.addPage();
      y = 17;
    }

    pdf.text(lines, 15, y);
    y += lines.length * 6;
  }

  pdf.setFillColor(0, 59, 122);
  pdf.rect(0, 0, 210, 26, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(16);
  pdf.text("FEDERAZIONE ITALIANA RUGBY", 15, 17);

  pdf.setTextColor(20, 38, 58);

  addLine("REFERTO ARBITRALE - BETA", 14, true);

  addLine(
    `${data.match.home || "Società 1"} ` +
    `${calculateScore("home")} - ` +
    `${calculateScore("away")} ` +
    `${data.match.away || "Società 2"}`,
    16,
    true
  );

  addLine(
    `${data.match.category || ""} - ` +
    `${data.match.date || ""} ore ${data.match.time || ""}`
  );

  addLine(
    `Campo: ${data.match.field || ""} - ` +
    `${data.match.location || ""}`
  );

  addLine(
    `Arbitro: ${data.referee.firstName || ""} ` +
    `${data.referee.lastName || ""} - ` +
    `Tessera ${data.referee.card || ""}`
  );

  addLine("TEAM ARBITRALE", 12, true);

  data.team
    .filter(member => member?.name)
    .forEach(member => {
      addLine(
        `${member.role}: ${member.name} - ` +
        `${member.card || "tessera non indicata"}`
      );
    });

  addLine("EVENTI", 12, true);

  if (!events.length) {
    addLine("Nessun evento registrato.");
  }

  events.forEach(matchEvent => {
    const teamName = matchEvent.team === "home"
      ? data.match.home || "Società 1"
      : data.match.away || "Società 2";

    addLine(
      `${matchEvent.half}T ${matchEvent.minute}' - ` +
      `${teamName} - ${labels[matchEvent.type]} - ` +
      `${eventDetails(matchEvent)}`
    );
  });

  addLine("RIFERIMENTI", 12, true);

  Object.entries(data.checks).forEach(([key, value]) => {
    addLine(
      `${checkLabels[key] || key}: ` +
      `${value === true ? "Sì" : value || "—"}`
    );
  });

  addLine("NOTE", 12, true);
  addLine(data.notes || "—");

  return { pdf, data };
}

function makeFileName(data) {
  const team = (data.match.home || "gara")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-|-$/g, "");

  return `referto-${data.match.date || "bozza"}-${team}.pdf`;
}

function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = fileName;
  link.style.display = "none";

  document.body.appendChild(link);
  link.click();

  setTimeout(() => {
    URL.revokeObjectURL(url);
    link.remove();
  }, 2000);
}

function openPrintableReport() {
  const data = getFormData();
  const popup = window.open("", "_blank");

  if (!popup) {
    $("#saveMsg").textContent =
      "Il browser ha bloccato la finestra. Consenti i popup e riprova.";
    return;
  }

  const rows = events.map(matchEvent => {
    const teamName = matchEvent.team === "home"
      ? data.match.home || "Società 1"
      : data.match.away || "Società 2";

    return `
      <tr>
        <td>${escapeHtml(matchEvent.half)}T ${escapeHtml(matchEvent.minute)}'</td>
        <td>${escapeHtml(teamName)}</td>
        <td>${escapeHtml(labels[matchEvent.type])}</td>
        <td>${escapeHtml(eventDetails(matchEvent))}</td>
      </tr>
    `;
  }).join("");

  popup.document.open();

  popup.document.write(`
    <!doctype html>
    <html lang="it">
    <head>
      <meta charset="utf-8">
      <title>Referto ${escapeHtml(data.match.date || "")}</title>

      <style>
        @page { size: A4; margin: 14mm; }

        body {
          color: #14263a;
          font: 12px Arial, sans-serif;
        }

        header {
          padding: 18px;
          color: #fff;
          background: #003b7a;
        }

        h1 { margin: 0; font-size: 20px; }

        h2 {
          color: #003b7a;
          border-bottom: 2px solid #c8a84e;
        }

        .score {
          margin: 20px 0;
          padding: 15px;
          color: #fff;
          font-size: 24px;
          font-weight: bold;
          text-align: center;
          background: #003b7a;
        }

        table {
          width: 100%;
          border-collapse: collapse;
        }

        th, td {
          padding: 7px;
          text-align: left;
          border: 1px solid #ccd8e2;
        }

        th { background: #eaf4fb; }
      </style>
    </head>

    <body>
      <header>
        <h1>FEDERAZIONE ITALIANA RUGBY</h1>
        <div>Referto arbitrale - Beta</div>
      </header>

      <p class="score">
        ${escapeHtml(data.match.home || "Società 1")}
        ${calculateScore("home")} -
        ${calculateScore("away")}
        ${escapeHtml(data.match.away || "Società 2")}
      </p>

      <p>
        <b>Gara:</b>
        ${escapeHtml(data.match.category || "")} ·
        ${escapeHtml(data.match.date || "")}
        ${escapeHtml(data.match.time || "")}
      </p>

      <p>
        <b>Campo:</b>
        ${escapeHtml(data.match.field || "")} ·
        ${escapeHtml(data.match.location || "")}
      </p>

      <h2>Eventi</h2>

      <table>
        <thead>
          <tr>
            <th>Tempo</th>
            <th>Squadra</th>
            <th>Evento</th>
            <th>Dettagli</th>
          </tr>
        </thead>

        <tbody>
          ${rows || '<tr><td colspan="4">Nessun evento</td></tr>'}
        </tbody>
      </table>

      <h2>Note</h2>
      <p>${escapeHtml(data.notes || "—")}</p>

      <script>
        window.onload = function () {
          setTimeout(function () {
            window.print();
          }, 400);
        };
      <\/script>
    </body>
    </html>
  `);

  popup.document.close();
}

async function downloadReportPdf() {
  $("#saveMsg").textContent = "Preparazione PDF…";

  try {
    if (!window.jspdf?.jsPDF) {
      throw new Error("Libreria PDF non disponibile");
    }

    const { pdf, data } = createPdf();
    const blob = pdf.output("blob");

    downloadBlob(blob, makeFileName(data));

    $("#saveMsg").textContent =
      "PDF generato. Controlla la cartella Download.";
  } catch (error) {
    console.error("Errore PDF:", error);

    $("#saveMsg").textContent =
      "Download diretto non disponibile. Apro la versione stampabile.";

    openPrintableReport();
  }
}

$("#pdf").addEventListener("click", downloadReportPdf);

async function loadReports() {
  await refreshVerifiedToken();

  const snapshot = await db
    .collection("reports")
    .where("owner", "==", user.uid)
    .get();

  const reports = snapshot.docs
    .map(document => ({
      id: document.id,
      ...document.data()
    }))
    .sort((first, second) =>
      (second.updatedAt?.seconds || 0) -
      (first.updatedAt?.seconds || 0)
    );

  $("#reports").innerHTML = reports.length
    ? reports.map(report => `
        <div class="report-item">
          <span>
            <b>
              ${escapeHtml(report.match?.home || "Gara")} –
              ${escapeHtml(report.match?.away || "")}
            </b>
            <br>
            <small>${escapeHtml(report.match?.date || "Senza data")}</small>
          </span>

          <span>
            <span class="badge">
              ${report.status === "completed" ? "Confermato" : "Bozza"}
            </span>

            <button data-load="${report.id}" type="button">
              Apri
            </button>
          </span>
        </div>
      `).join("")
    : '<div class="empty">Nessun referto salvato.</div>';
}

$("#reports").addEventListener("click", async event => {
  const button = event.target.closest("[data-load]");

  if (!button) {
    return;
  }

  try {
    const snapshot = await db
      .collection("reports")
      .doc(button.dataset.load)
      .get();

    if (!snapshot.exists) {
      alert("Il referto non esiste più.");
      return;
    }

    reportId = snapshot.id;
    $("#reportForm").reset();
    setFormData(snapshot.data());
    go(0);
  } catch (error) {
    alert(`Errore durante l’apertura: ${error.message}`);
  }
});

$("#newReport").addEventListener("click", () => {
  reportId = null;
  events = [];
  selectedTeam = "home";
  selectedEvent = null;

  $("#reportForm").reset();

  $$(".team-choice").forEach(button => {
    button.classList.toggle(
      "selected",
      button.dataset.team === "home"
    );
  });

  setFormData({
    referee: {
      email: user.email
    }
  });

  go(0);
});

$("#authForm").addEventListener("submit", async event => {
  event.preventDefault();

  const message = $("#authMsg");
  const button = event.submitter ||
    $('#authForm button[type="submit"]');

  message.textContent = "Accesso in corso…";
  button.disabled = true;

  try {
    await auth.setPersistence(
      firebase.auth.Auth.Persistence.LOCAL
    );

    const credential =
      await auth.signInWithEmailAndPassword(
        $("#email").value.trim(),
        $("#password").value
      );

    await credential.user.reload();
    await credential.user.getIdToken(true);

    message.textContent = "Accesso riuscito.";
    await routeUser(auth.currentUser);
  } catch (error) {
    console.error("Errore login:", error);
    message.textContent = authMessage(error);
  } finally {
    button.disabled = false;
  }
});

$("#register").addEventListener("click", async () => {
  const message = $("#authMsg");
  message.textContent = "Creazione account…";

  try {
    await auth.setPersistence(
      firebase.auth.Auth.Persistence.LOCAL
    );

    const credential =
      await auth.createUserWithEmailAndPassword(
        $("#email").value.trim(),
        $("#password").value
      );

    await credential.user.sendEmailVerification();

    message.textContent =
      "Account creato. Controlla la tua e-mail.";
  } catch (error) {
    message.textContent = authMessage(error);
  }
});

$("#reset").addEventListener("click", async () => {
  const message = $("#authMsg");

  try {
    const email = $("#email").value.trim();

    if (!email) {
      throw new Error("Inserisci prima l’indirizzo e-mail.");
    }

    await auth.sendPasswordResetEmail(email);

    message.textContent = "E-mail di recupero inviata.";
  } catch (error) {
    message.textContent = authMessage(error);
  }
});

$("#resend").addEventListener("click", async () => {
  try {
    await auth.currentUser.sendEmailVerification();
    $("#verifyMsg").textContent = "E-mail inviata.";
  } catch (error) {
    $("#verifyMsg").textContent = authMessage(error);
  }
});

$("#reload").addEventListener("click", async () => {
  try {
    await refreshVerifiedToken();
    await routeUser(auth.currentUser);
  } catch (error) {
    $("#verifyMsg").textContent = authMessage(error);
  }
});

$("#logout").addEventListener("click", async () => {
  await auth.signOut();
  window.location.reload();
});

async function routeUser(currentUser) {
  user = currentUser;

  show($("#logout"), Boolean(currentUser));
  show($("#auth"), !currentUser);

  show(
    $("#verify"),
    Boolean(currentUser) && !currentUser.emailVerified
  );

  show(
    $("#app"),
    Boolean(currentUser) && currentUser.emailVerified
  );

  if (!currentUser || !currentUser.emailVerified) {
    return;
  }

  try {
    await refreshVerifiedToken();

    const profile = await db
      .collection("profiles")
      .doc(currentUser.uid)
      .get();

    setFormData({
      referee: profile.exists
        ? profile.data()
        : { email: currentUser.email }
    });

    await loadReports();
    go(0);
  } catch (error) {
    console.error("Errore inizializzazione:", error);

    $("#reports").innerHTML = `
      <p class="message">
        ${
          error.code === "permission-denied"
            ? "Firestore non autorizzato: pubblica le regole di sicurezza."
            : escapeHtml(error.message)
        }
      </p>
    `;
  }
}

auth.onAuthStateChanged(routeUser);

removeOldCache().catch(error => {
  console.warn("Pulizia cache non riuscita:", error);
});
