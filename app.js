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
  secondYellow: "Secondo giallo",
  red: "Cartellino rosso",
  temporary: "Sostituzione temporanea",
  permanent: "Sostituzione definitiva"
};

let user = null;
let reportId = null;
let events = [];
let step = 0;

function setOptions(element, values, first = "Seleziona") {
  element.innerHTML =
    `<option value="">${first}</option>` +
    values.map(value => `<option>${value}</option>`).join("");
}

setOptions($("#committee"), committees);
setOptions($("#category"), categories);

$("#teamRows").innerHTML = roles.map((role, index) => `
  <div class="team-row">
    <input value="${role}" disabled>
    <input
      name="team.${index}.name"
      placeholder="Nome e cognome"
    >
    <input
      name="team.${index}.card"
      placeholder="Tessera"
    >
    <span></span>
  </div>
`).join("");

const stepNames = [
  "Profilo",
  "Gara",
  "Cartellino",
  "Eventi",
  "Riepilogo"
];

$("#steps").innerHTML = stepNames.map((name, index) => `
  <button type="button" data-go="${index}">
    ${index + 1}. ${name}
  </button>
`).join("");

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

  $("#progress").textContent = `${step + 1} / 5`;

  if (step === 4) {
    renderSummary();
  }

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

$("#steps").addEventListener("click", event => {
  const target = event.target.dataset.go;

  if (target !== undefined) {
    go(Number(target));
  }
});

$("#prev").addEventListener("click", () => {
  go(step - 1);
});

$("#next").addEventListener("click", () => {
  const panel = $$(".panel")[step];

  const invalidField = [...panel.querySelectorAll("[required]")]
    .find(field => !field.checkValidity());

  if (invalidField) {
    invalidField.reportValidity();
    return;
  }

  go(step + 1);
});

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
      renderEvents();
      return;
    }

    if (section === "team") {
      (value || []).forEach((member, index) => {
        Object.entries(member).forEach(([property, fieldValue]) => {
          const element = $(`[name="team.${index}.${property}"]`);

          if (element) {
            element.value = fieldValue ?? "";
          }
        });
      });

      return;
    }

    if (value && typeof value === "object") {
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
}

$("#addEvent").addEventListener("click", () => {
  const event = {
    team: $("#evTeam").value,
    half: $("#evHalf").value,
    minute: $("#evMinute").value,
    type: $("#evType").value,
    person: $("#evPerson").value,
    number: $("#evNumber").value,
    card: $("#evCard").value,
    notes: $("#evNotes").value
  };

  if (!event.minute) {
    alert("Inserisci il minuto dell’evento.");
    return;
  }

  events.push(event);

  [
    "#evMinute",
    "#evPerson",
    "#evNumber",
    "#evCard",
    "#evNotes"
  ].forEach(selector => {
    $(selector).value = "";
  });

  renderEvents();
});

function calculateScore(team) {
  return events
    .filter(event => event.team === team)
    .reduce((total, event) => {
      return total + (points[event.type] || 0);
    }, 0);
}

function renderEvents() {
  const data = getFormData();

  const homeScore = calculateScore("home");
  const awayScore = calculateScore("away");

  $("#homeName").textContent =
    data.match.home || "Società 1";

  $("#awayName").textContent =
    data.match.away || "Società 2";

  $("#homeScore").textContent = homeScore;
  $("#awayScore").textContent = awayScore;

  $("#eventsBody").innerHTML = events.map((event, index) => `
    <tr>
      <td>${event.team === "home" ? "1" : "2"}</td>
      <td>${event.half}</td>
      <td>${event.minute}</td>
      <td>${labels[event.type]}</td>
      <td>${event.person || ""}</td>
      <td>
        <button
          type="button"
          class="danger"
          data-delete="${index}"
          aria-label="Elimina evento"
        >
          ×
        </button>
      </td>
    </tr>
  `).join("");
}

$("#eventsBody").addEventListener("click", event => {
  const index = event.target.dataset.delete;

  if (index === undefined) {
    return;
  }

  events.splice(Number(index), 1);
  renderEvents();
});

$("#reportForm").addEventListener("input", () => {
  if (step === 2) {
    renderEvents();
  }
});

function getScores() {
  return [
    calculateScore("home"),
    calculateScore("away")
  ];
}

function renderSummary() {
  const data = getFormData();
  const [homeScore, awayScore] = getScores();

  $("#summary").innerHTML = `
    <div class="score">
      <div>
        <span>${data.match.home || "Società 1"}</span>
        <b>${homeScore}</b>
      </div>

      <div>
        <span>${data.match.away || "Società 2"}</span>
        <b>${awayScore}</b>
      </div>
    </div>

    <p>
      <b>Gara:</b>
      ${data.match.category || ""} —
      ${data.match.date || ""},
      ${data.match.time || ""}
    </p>

    <p>
      <b>Arbitro:</b>
      ${data.referee.firstName || ""}
      ${data.referee.lastName || ""}
      · Tessera ${data.referee.card || ""}
    </p>

    <p>
      <b>Eventi registrati:</b> ${events.length}
    </p>
  `;
}

async function saveReport(status = "draft") {
  if (!user) {
    return;
  }

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

  const reportReference = isNew
    ? db.collection("reports").doc()
    : db.collection("reports").doc(reportId);

  reportId = reportReference.id;

  try {
    await Promise.all([
      reportReference.set(data, { merge: true }),

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
        : "Bozza salvata.";

    await loadReports();
  } catch (error) {
    $("#saveMsg").textContent =
      `Errore durante il salvataggio: ${error.message}`;
  }
}

$("#save").addEventListener("click", () => {
  saveReport("draft");
});

$("#complete").addEventListener("click", async () => {
  if (!$("#reportForm").reportValidity()) {
    return;
  }

  await saveReport("completed");
});

$("#pdf").addEventListener("click", () => {
  const data = getFormData();
  const [homeScore, awayScore] = getScores();

  const { jsPDF } = window.jspdf;
  const documentPdf = new jsPDF();

  let y = 18;

  function addLine(text, size = 11, bold = false) {
    documentPdf.setFontSize(size);
    documentPdf.setFont(
      "helvetica",
      bold ? "bold" : "normal"
    );

    const lines = documentPdf.splitTextToSize(
      String(text),
      180
    );

    documentPdf.text(lines, 15, y);
    y += lines.length * 6;

    if (y > 275) {
      documentPdf.addPage();
      y = 18;
    }
  }

  addLine("FEDERAZIONE ITALIANA RUGBY", 15, true);
  addLine("REFERTO ARBITRALE — BETA", 13, true);

  addLine(
    `${data.match.category || ""} · ` +
    `${data.match.date || ""} ore ${data.match.time || ""}`
  );

  addLine(
    `${data.match.home || "Società 1"} ${homeScore} - ` +
    `${awayScore} ${data.match.away || "Società 2"}`,
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

  addLine("EVENTI", 12, true);

  if (!events.length) {
    addLine("Nessun evento registrato.");
  }

  events.forEach(event => {
    addLine(
      `Sq.${event.team === "home" ? "1" : "2"} · ` +
      `T${event.half} ${event.minute}' · ` +
      `${labels[event.type]} · ` +
      `${event.person || ""} ` +
      `${event.number ? `#${event.number}` : ""} ` +
      `${event.notes || ""}`
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
    "Documento generato dalla beta. " +
    "Verificare prima dell’invio ufficiale.",
    9
  );

  const safeHome = (data.match.home || "gara")
    .replace(/\W+/g, "-");

  documentPdf.save(
    `referto-${data.match.date || "bozza"}-${safeHome}.pdf`
  );
});

async function loadReports() {
  if (!user) {
    return;
  }

  try {
    const snapshot = await db
      .collection("reports")
      .where("owner", "==", user.uid)
      .get();

    const reports = snapshot.docs
      .map(document => ({
        id: document.id,
        ...document.data()
      }))
      .sort((first, second) => {
        const firstDate = first.updatedAt?.seconds || 0;
        const secondDate = second.updatedAt?.seconds || 0;
        return secondDate - firstDate;
      });

    if (!reports.length) {
      $("#reports").innerHTML =
        "<p>Nessun referto salvato.</p>";
      return;
    }

    $("#reports").innerHTML = reports.map(report => `
      <div class="report-item">
        <span>
          <b>
            ${report.match?.home || "Gara"} –
            ${report.match?.away || ""}
          </b>
          <br>
          ${report.match?.date || "Senza data"}
        </span>

        <span>
          <span class="badge">
            ${report.status === "completed"
              ? "Confermato"
              : "Bozza"}
          </span>

          <button
            data-load="${report.id}"
            type="button"
          >
            Apri
          </button>
        </span>
      </div>
    `).join("");
  } catch (error) {
    $("#reports").innerHTML =
      `<p class="msg">Errore: ${error.message}</p>`;
  }
}

$("#reports").addEventListener("click", async event => {
  const id = event.target.dataset.load;

  if (!id) {
    return;
  }

  try {
    const documentSnapshot = await db
      .collection("reports")
      .doc(id)
      .get();

    if (!documentSnapshot.exists) {
      alert("Il referto non è più disponibile.");
      return;
    }

    reportId = documentSnapshot.id;

    $("#reportForm").reset();
    setFormData(documentSnapshot.data());
    go(0);
  } catch (error) {
    alert(`Errore durante l’apertura: ${error.message}`);
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

  renderEvents();
  go(0);
});

$("#authForm").addEventListener("submit", async event => {
  event.preventDefault();
  $("#authMsg").textContent = "";

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
  $("#authMsg").textContent = "";

  try {
    const credentials =
      await auth.createUserWithEmailAndPassword(
        $("#email").value,
        $("#password").value
      );

    await credentials.user.sendEmailVerification();

    $("#authMsg").textContent =
      "Controlla la tua e-mail per verificare l’account.";
  } catch (error) {
    $("#authMsg").textContent = error.message;
  }
});

$("#reset").addEventListener("click", async () => {
  const email = $("#email").value;

  if (!email) {
    $("#authMsg").textContent =
      "Inserisci prima l’indirizzo e-mail.";
    return;
  }

  try {
    await auth.sendPasswordResetEmail(email);

    $("#authMsg").textContent =
      "E-mail di recupero inviata.";
  } catch (error) {
    $("#authMsg").textContent = error.message;
  }
});

$("#resend").addEventListener("click", async () => {
  try {
    await auth.currentUser.sendEmailVerification();
    alert("E-mail di verifica inviata.");
  } catch (error) {
    alert(error.message);
  }
});

$("#reload").addEventListener("click", async () => {
  await auth.currentUser.reload();

  if (auth.currentUser.emailVerified) {
    window.location.reload();
  } else {
    alert("L’indirizzo non risulta ancora verificato.");
  }
});

$("#logout").addEventListener("click", () => {
  auth.signOut();
});

auth.onAuthStateChanged(async currentUser => {
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
    const profile = await db
      .collection("profiles")
      .doc(currentUser.uid)
      .get();

    if (profile.exists) {
      setFormData({
        referee: profile.data()
      });
    } else {
      setFormData({
        referee: {
          email: currentUser.email
        }
      });
    }

    await loadReports();
    go(0);
  } catch (error) {
    alert(`Errore di inizializzazione: ${error.message}`);
  }
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js");
  });
}
