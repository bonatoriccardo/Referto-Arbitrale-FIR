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
    <input value="${role}" disabled>
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

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

$("#steps").addEventListener("click", event => {
  if (event.target.dataset.go !== undefined) {
    go(Number(event.target.dataset.go));
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
    checks: {},
    notes: "",
    declaration: false,
    events
  };

  new FormData($("#reportForm")).forEach((value, key) => {
    if (key.startsWith("team.")) {
      const [, index, property] = key.split(".");

      data.team[index] ??= {
        role: roles[index]
      };

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
      events = value || [];
      return;
    }

    if (section === "team") {
      (value || []).forEach((member, index) => {
        Object.entries(member).forEach(([property, fieldValue]) => {
          const element =
            $(`[name="team.${index}.${property}"]`);

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
        const elements =
          $$(`[name="${section}.${property}"]`);

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

    if (element) {
      if (element.type === "checkbox") {
        element.checked = Boolean(value);
      } else {
        element.value = value ?? "";
      }
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

  $("#editorTitle").textContent =
    `${labels[type]} · ${teamName}`;

  const isChange = ["temporary", "permanent"].includes(type);
  const isDisciplinary =
    ["yellow", "secondYellow", "red"].includes(type);

  $$(".change-field").forEach(element => {
    show(element, isChange);
  });

  $$(".person-field, .number-field, .card-field")
    .forEach(element => {
      show(element, isDisciplinary);
    });

  show($("#eventEditor"));
  $("#evMinute").focus();
}

$("#cancelEvent").addEventListener("click", () => {
  show($("#eventEditor"), false);
  selectedEvent = null;
});

$("#confirmEvent").addEventListener("click", () => {
  const minute = $("#evMinute").value;

  if (minute === "") {
    alert("Inserisci il minuto.");
    return;
  }

  const event = {
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

  if (isChange && (!event.out || !event.in)) {
    alert("Indica chi esce e chi entra.");
    return;
  }

  events.push(event);

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
    .filter(event => event.team === team)
    .reduce(
      (total, event) => total + (points[event.type] || 0),
      0
    );
}

function eventDetails(event) {
  if (["temporary", "permanent"].includes(event.type)) {
    return `${event.out} → ${event.in}`;
  }

  return [
    event.person,
    event.number && `maglia ${event.number}`,
    event.card && `tessera ${event.card}`,
    event.notes
  ].filter(Boolean).join(" · ");
}

function renderEvents() {
  updateTeamNames();

  $("#homeScore").textContent = calculateScore("home");
  $("#awayScore").textContent = calculateScore("away");

  show($("#emptyEvents"), events.length === 0);

  $("#eventsList").innerHTML = events.map((event, index) => {
    const teamName = event.team === "home"
      ? ($("#homeInput").value || "Società 1")
      : ($("#awayInput").value || "Società 2");

    return `
      <div class="event-row ${event.team === "away" ? "away" : ""}">
        <div class="event-minute">
          ${event.half}T · ${escapeHtml(event.minute)}'
        </div>

        <div class="event-main">
          <b>
            ${escapeHtml(labels[event.type])}
            · ${escapeHtml(teamName)}
          </b>
          <small>
            ${escapeHtml(eventDetails(event) || "Nessun dettaglio")}
          </small>
        </div>

        <button class="danger"
                type="button"
                data-delete="${index}"
                aria-label="Elimina">
          ×
        </button>
      </div>
    `;
  }).join("");
}

$("#eventsList").addEventListener("click", event => {
  if (event.target.dataset.delete === undefined) {
    return;
  }

  events.splice(Number(event.target.dataset.delete), 1);
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
        ? "Permesso negato: pubblica le regole Firestore, poi esci e accedi nuovamente."
        : `Errore: ${error.message}`;
  }
}

$("#save").addEventListener("click", () => {
  guardedSave("draft");
});

$("#complete").addEventListener("click", () => {
  guardedSave("completed");
});

$("#pdf").addEventListener("click", () => {
  const data = getFormData();
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF();

  let y = 17;

  function addLine(text, size = 10, bold = false) {
    pdf.setFontSize(size);
    pdf.setFont("helvetica", bold ? "bold" : "normal");

    const lines = pdf.splitTextToSize(String(text), 180);

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
  y = 36;

  addLine("REFERTO ARBITRALE — BETA", 14, true);

  addLine(
    `${data.match.category || ""} · ` +
    `${data.match.date || ""} ore ${data.match.time || ""}`
  );

  addLine(
    `${data.match.home || "Società 1"} ` +
    `${calculateScore("home")} - ` +
    `${calculateScore("away")} ` +
    `${data.match.away || "Società 2"}`,
    16,
    true
  );

  addLine(
    `Campo: ${data.match.field || ""} — ` +
    `${data.match.location || ""}`
  );

  addLine(
    `Arbitro: ${data.referee.firstName || ""} ` +
    `${data.referee.lastName || ""} · ` +
    `Tessera ${data.referee.card || ""}`
  );

  addLine("TEAM ARBITRALE", 12, true);

  data.team
    .filter(member => member?.name)
    .forEach(member => {
      addLine(
        `${member.role}: ${member.name} · ` +
        `${member.card || "tessera non indicata"}`
      );
    });

  addLine("EVENTI", 12, true);

  events.forEach(event => {
    const teamName = event.team === "home"
      ? (data.match.home || "Società 1")
      : (data.match.away || "Società 2");

    addLine(
      `${event.half}T ${event.minute}' · ` +
      `${teamName} · ${labels[event.type]} · ` +
      `${eventDetails(event)}`
    );
  });

  addLine("RIFERIMENTI", 12, true);

  Object.entries(data.checks).forEach(([key, value]) => {
    addLine(
      `${key}: ${value === true ? "Sì" : value || "—"}`
    );
  });

  addLine("NOTE", 12, true);
  addLine(data.notes || "—");

  addLine(
    "Documento beta: verificare prima dell’invio ufficiale.",
    8
  );

  const safeHome = (data.match.home || "gara")
    .replace(/\W+/g, "-");

  pdf.save(
    `referto-${data.match.date || "bozza"}-${safeHome}.pdf`
  );
});

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
              ${escapeHtml(report.match?.home || "Gara")}
              –
              ${escapeHtml(report.match?.away || "")}
            </b>
            <br>
            <small>
              ${escapeHtml(report.match?.date || "Senza data")}
            </small>
          </span>

          <span>
            <span class="badge">
              ${report.status === "completed"
                ? "Confermato"
                : "Bozza"}
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
  const id = event.target.dataset.load;

  if (!id) {
    return;
  }

  try {
    const snapshot = await db
      .collection("reports")
      .doc(id)
      .get();

    if (!snapshot.exists) {
      return;
    }

    reportId = snapshot.id;
    $("#reportForm").reset();
    setFormData(snapshot.data());
    go(0);
  } catch (error) {
    alert(error.message);
  }
});

$("#newReport").addEventListener("click", () => {
  reportId = null;
  events = [];

  $("#reportForm").reset();

  setFormData({
    referee: {
      email: user.email
    }
  });

  go(0);
});

$("#authForm").addEventListener("submit", async event => {
  event.preventDefault();

  try {
    await auth.signInWithEmailAndPassword(
      $("#email").value,
      $("#password").value
    );
  } catch (error) {
    $("#authMsg").textContent = error.message;
  }
});

$("#register").addEventListener("click", async () => {
  try {
    const credentials =
      await auth.createUserWithEmailAndPassword(
        $("#email").value,
        $("#password").value
      );

    await credentials.user.sendEmailVerification();

    $("#authMsg").textContent =
      "Account creato. Controlla la tua e-mail.";
  } catch (error) {
    $("#authMsg").textContent = error.message;
  }
});

$("#reset").addEventListener("click", async () => {
  try {
    if (!$("#email").value) {
      throw new Error("Inserisci prima l’e-mail.");
    }

    await auth.sendPasswordResetEmail($("#email").value);

    $("#authMsg").textContent =
      "E-mail di recupero inviata.";
  } catch (error) {
    $("#authMsg").textContent = error.message;
  }
});

$("#resend").addEventListener("click", async () => {
  try {
    await auth.currentUser.sendEmailVerification();
    $("#verifyMsg").textContent = "E-mail inviata.";
  } catch (error) {
    $("#verifyMsg").textContent = error.message;
  }
});

$("#reload").addEventListener("click", async () => {
  try {
    await refreshVerifiedToken();
    window.location.reload();
  } catch (error) {
    $("#verifyMsg").textContent = error.message;
  }
});

$("#logout").addEventListener("click", () => {
  auth.signOut();
});

auth.onAuthStateChanged(async currentUser => {
  user = currentUser;

  show($("#logout"), Boolean(currentUser));
  show($("#auth"), !currentUser);
  show($("#verify"), Boolean(currentUser) && !currentUser.emailVerified);
  show($("#app"), Boolean(currentUser) && currentUser.emailVerified);

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
    console.error(error);

    $("#reports").innerHTML = `
      <p class="message">
        ${
          error.code === "permission-denied"
            ? "Firestore non autorizzato: pubblica le regole di sicurezza indicate nel progetto."
            : escapeHtml(error.message)
        }
      </p>
    `;
  }
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js");
  });
}
