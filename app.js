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
  if (element) {
    element.classList.toggle("hidden", !visible);
  }
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

const eventLabels = {
  try: "Meta",
  conversion: "Trasformazione",
  penalty: "Punizione",
  drop: "Calcio di rimbalzo",
  yellow: "1° cartellino giallo",
  secondYellow: "Espulsione per 2° cartellino giallo",
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
let currentProfile = {};

function populateOptions(element, values) {
  element.innerHTML =
    '<option value="">Seleziona</option>' +
    values
      .map(value => `<option>${escapeHtml(value)}</option>`)
      .join("");
}

populateOptions($("#committee"), committees);
populateOptions($("#category"), categories);

$("#teamRows").innerHTML = roles.map((role, index) => `
  <div class="team-row">
    <input
      value="${escapeHtml(role)}"
      aria-label="Ruolo"
      disabled
    >

    <input
      name="team.${index}.name"
      placeholder="Nome e cognome"
      aria-label="${escapeHtml(role)} nominativo"
    >

    <input
      name="team.${index}.card"
      placeholder="Numero tessera"
      inputmode="numeric"
      aria-label="${escapeHtml(role)} numero tessera"
    >
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

function setMessage(element, text, isError = false) {
  if (!element) {
    return;
  }

  element.textContent = text;
  element.style.color = isError ? "#b4232d" : "#17633a";
}

function authMessage(error) {
  const messages = {
    "auth/invalid-credential":
      "E-mail o password non corretti.",
    "auth/user-not-found":
      "E-mail o password non corretti.",
    "auth/wrong-password":
      "E-mail o password non corretti.",
    "auth/email-already-in-use":
      "Esiste già un account con questa e-mail.",
    "auth/weak-password":
      "La password deve contenere almeno 6 caratteri.",
    "auth/invalid-email":
      "L’indirizzo e-mail non è valido.",
    "auth/too-many-requests":
      "Troppi tentativi. Attendi qualche minuto e riprova.",
    "auth/network-request-failed":
      "Connessione non disponibile. Controlla la rete.",
    "auth/unauthorized-domain":
      "Questo dominio non è autorizzato in Firebase.",
    "auth/user-disabled":
      "Questo account è stato disabilitato."
  };

  return (
    messages[error?.code] ||
    error?.message ||
    "Operazione non riuscita."
  );
}

async function refreshVerifiedToken() {
  if (!auth.currentUser) {
    throw new Error(
      "Sessione scaduta. Accedi nuovamente."
    );
  }

  await auth.currentUser.reload();

  if (!auth.currentUser.emailVerified) {
    throw new Error(
      "Verifica prima il tuo indirizzo e-mail."
    );
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

  $("#progress").textContent =
    `Passaggio ${step + 1} di 5`;

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

function validateCurrentStep() {
  const currentPanel = $$(".panel")[step];

  if (!currentPanel) {
    return true;
  }

  const invalidField =
    [...currentPanel.querySelectorAll("[required]")]
      .find(field => !field.checkValidity());

  if (invalidField) {
    invalidField.reportValidity();
    return false;
  }

  return true;
}

$("#steps").addEventListener("click", event => {
  const button = event.target.closest("[data-go]");

  if (!button) {
    return;
  }

  const destination = Number(button.dataset.go);

  if (destination > step && !validateCurrentStep()) {
    return;
  }

  go(destination);
});

$("#prev").addEventListener("click", () => {
  go(step - 1);
});

$("#next").addEventListener("click", () => {
  if (!validateCurrentStep()) {
    return;
  }

  go(step + 1);
});

function updateTeamNames() {
  const homeName =
    $("#homeInput").value.trim() || "Società 1";

  const awayName =
    $("#awayInput").value.trim() || "Società 2";

  $$(".js-home").forEach(element => {
    element.textContent = homeName;
  });

  $$(".js-away").forEach(element => {
    element.textContent = awayName;
  });
}

$("#homeInput").addEventListener("input", () => {
  updateTeamNames();

  if (step === 2) {
    renderEvents();
  }
});

$("#awayInput").addEventListener("input", () => {
  updateTeamNames();

  if (step === 2) {
    renderEvents();
  }
});

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
    attachments: {
      concussion: false,
      modDIntegration: false,
      modB: 0,
      dae: 0,
      documents: 0
    },
    notes: "",
    declaration: false,
    events
  };

  new FormData($("#reportForm"))
    .forEach((value, key) => {
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

        data[section] ??= {};

        data[section][property] =
          value === "on" ? true : value;

        return;
      }

      data[key] = value === "on" ? true : value;
    });

  data.attachments.modB =
    Number(data.attachments.modB || 0);

  data.attachments.dae =
    Number(data.attachments.dae || 0);

  data.attachments.documents =
    Number(data.attachments.documents || 0);

  return data;
}

function setFormData(data) {
  Object.entries(data || {}).forEach(
    ([section, value]) => {
      if (section === "events") {
        events = Array.isArray(value) ? value : [];
        return;
      }

      if (section === "team") {
        (value || []).forEach((member, index) => {
          Object.entries(member || {})
            .forEach(([property, fieldValue]) => {
              const element = $(
                `[name="team.${index}.${property}"]`
              );

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
        Object.entries(value)
          .forEach(([property, fieldValue]) => {
            const elements = $$(
              `[name="${section}.${property}"]`
            );

            if (!elements.length) {
              return;
            }

            if (elements[0].type === "radio") {
              elements.forEach(element => {
                element.checked =
                  element.value === fieldValue;
              });
            } else if (
              elements[0].type === "checkbox"
            ) {
              elements[0].checked =
                Boolean(fieldValue);
            } else {
              elements[0].value =
                fieldValue ?? "";
            }
          });

        return;
      }

      const element =
        $(`[name="${section}"]`);

      if (!element) {
        return;
      }

      if (element.type === "checkbox") {
        element.checked = Boolean(value);
      } else {
        element.value = value ?? "";
      }
    }
  );

  updateTeamNames();
  renderEvents();
}

function resetEventEditor() {
  [
    "#evMinute",
    "#evPerson",
    "#evNumber",
    "#evCard",
    "#evOutNumber",
    "#evOut",
    "#evInNumber",
    "#evIn",
    "#evNotes"
  ].forEach(selector => {
    const element = $(selector);

    if (element) {
      element.value = "";
    }
  });

  $("#evHalf").value = "1";
  $("#evSubjectType").value = "player";

  selectedEvent = null;

  show($("#eventEditor"), false);
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
    `${eventLabels[type]} · ${teamName}`;

  const isScoring = [
    "try",
    "conversion",
    "penalty",
    "drop"
  ].includes(type);

  const isDisciplinary = [
    "yellow",
    "secondYellow",
    "red"
  ].includes(type);

  const isChange = [
    "temporary",
    "permanent"
  ].includes(type);

  $$(".subject-field").forEach(element => {
    show(element, isDisciplinary);
  });

  $$(".person-field").forEach(element => {
    show(element, isDisciplinary);
  });

  $$(".number-field").forEach(element => {
    show(
      element,
      isDisciplinary &&
      $("#evSubjectType").value === "player"
    );
  });

  $$(".card-field").forEach(element => {
    show(element, isDisciplinary);
  });

  $$(".change-field").forEach(element => {
    show(element, isChange);
  });

  $$(".reason-field").forEach(element => {
    show(element, !isScoring);
  });

  show($("#eventEditor"));
  $("#evMinute").focus();
}

$("#evSubjectType").addEventListener(
  "change",
  () => {
    const isPlayer =
      $("#evSubjectType").value === "player";

    $$(".number-field").forEach(element => {
      show(element, isPlayer);
    });
  }
);

$("#cancelEvent").addEventListener(
  "click",
  resetEventEditor
);

$("#confirmEvent").addEventListener(
  "click",
  () => {
    if (!selectedEvent) {
      alert("Seleziona prima il tipo di evento.");
      return;
    }

    const minute = $("#evMinute").value;

    if (minute === "") {
      alert("Inserisci il minuto dell’evento.");
      return;
    }

    const isDisciplinary = [
      "yellow",
      "secondYellow",
      "red"
    ].includes(selectedEvent);

    const isChange = [
      "temporary",
      "permanent"
    ].includes(selectedEvent);

    const matchEvent = {
      team: selectedTeam,
      type: selectedEvent,
      half: $("#evHalf").value,
      minute,
      subjectType:
        $("#evSubjectType").value,
      person:
        $("#evPerson").value.trim(),
      number:
        $("#evNumber").value.trim(),
      card:
        $("#evCard").value.trim(),
      outNumber:
        $("#evOutNumber").value.trim(),
      out:
        $("#evOut").value.trim(),
      inNumber:
        $("#evInNumber").value.trim(),
      in:
        $("#evIn").value.trim(),
      notes:
        $("#evNotes").value.trim()
    };

    if (
      isDisciplinary &&
      !matchEvent.person
    ) {
      alert(
        "Inserisci il cognome e nome del soggetto."
      );
      return;
    }

    if (
      isChange &&
      (
        !matchEvent.out ||
        !matchEvent.in
      )
    ) {
      alert(
        "Inserisci il giocatore uscito e quello entrato."
      );
      return;
    }

    events.push(matchEvent);

    resetEventEditor();
    renderEvents();
  }
);

function calculateScore(team) {
  return events
    .filter(matchEvent =>
      matchEvent.team === team
    )
    .reduce(
      (total, matchEvent) =>
        total +
        (points[matchEvent.type] || 0),
      0
    );
}

function eventDetails(matchEvent) {
  if (
    [
      "temporary",
      "permanent"
    ].includes(matchEvent.type)
  ) {
    const outgoing = [
      matchEvent.outNumber &&
        `n. ${matchEvent.outNumber}`,
      matchEvent.out
    ].filter(Boolean).join(" ");

    const incoming = [
      matchEvent.inNumber &&
        `n. ${matchEvent.inNumber}`,
      matchEvent.in
    ].filter(Boolean).join(" ");

    return [
      `${outgoing || "—"} → ${incoming || "—"}`,
      matchEvent.notes
    ].filter(Boolean).join(" · ");
  }

  if (
    [
      "yellow",
      "secondYellow",
      "red"
    ].includes(matchEvent.type)
  ) {
    return [
      matchEvent.subjectType === "member"
        ? "Tesserato"
        : "Giocatore",
      matchEvent.person,
      matchEvent.number &&
        `maglia ${matchEvent.number}`,
      matchEvent.card &&
        `tessera ${matchEvent.card}`,
      matchEvent.notes
    ].filter(Boolean).join(" · ");
  }

  return matchEvent.notes || "";
}

function renderEvents() {
  updateTeamNames();

  $("#homeScore").textContent =
    calculateScore("home");

  $("#awayScore").textContent =
    calculateScore("away");

  show(
    $("#emptyEvents"),
    events.length === 0
  );

  $("#eventsList").innerHTML = events
    .map((matchEvent, index) => {
      const teamName =
        matchEvent.team === "home"
          ? (
            $("#homeInput").value ||
            "Società 1"
          )
          : (
            $("#awayInput").value ||
            "Società 2"
          );

      return `
        <div class="
          event-row
          ${matchEvent.team === "away" ? "away" : ""}
        ">
          <div class="event-minute">
            ${escapeHtml(matchEvent.half)}T ·
            ${escapeHtml(matchEvent.minute)}'
          </div>

          <div class="event-main">
            <b>
              ${escapeHtml(
                eventLabels[matchEvent.type]
              )}
              · ${escapeHtml(teamName)}
            </b>

            <small>
              ${escapeHtml(
                eventDetails(matchEvent) ||
                "Nessun dettaglio"
              )}
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
    })
    .join("");
}

$("#eventsList").addEventListener(
  "click",
  event => {
    const button =
      event.target.closest("[data-delete]");

    if (!button) {
      return;
    }

    const index =
      Number(button.dataset.delete);

    const confirmed = window.confirm(
      "Eliminare questo evento?"
    );

    if (!confirmed) {
      return;
    }

    events.splice(index, 1);
    renderEvents();
  }
);

function renderSummary() {
  const data = getFormData();

  const disciplinaryCount = events.filter(
    matchEvent => [
      "yellow",
      "secondYellow",
      "red"
    ].includes(matchEvent.type)
  ).length;

  const substitutionsCount = events.filter(
    matchEvent => [
      "temporary",
      "permanent"
    ].includes(matchEvent.type)
  ).length;

  $("#summary").innerHTML = `
    <div class="scoreboard">
      <div class="score-team home-card">
        <span>
          ${escapeHtml(
            data.match.home || "Società 1"
          )}
        </span>

        <strong>
          ${calculateScore("home")}
        </strong>
      </div>

      <div class="versus">
        FINALE
      </div>

      <div class="score-team away-card">
        <span>
          ${escapeHtml(
            data.match.away || "Società 2"
          )}
        </span>

        <strong>
          ${calculateScore("away")}
        </strong>
      </div>
    </div>

    <div class="summary-grid">
      <div class="summary-box">
        <small>Gara</small>
        <b>
          ${escapeHtml(
            data.match.category || "—"
          )}
        </b>
      </div>

      <div class="summary-box">
        <small>Data e ora</small>
        <b>
          ${escapeHtml(
            data.match.date || "—"
          )}
          ·
          ${escapeHtml(
            data.match.time || "—"
          )}
        </b>
      </div>

      <div class="summary-box">
        <small>Eventi registrati</small>
        <b>${events.length}</b>
      </div>

      <div class="summary-box">
        <small>Provvedimenti</small>
        <b>${disciplinaryCount}</b>
      </div>

      <div class="summary-box">
        <small>Sostituzioni</small>
        <b>${substitutionsCount}</b>
      </div>

      <div class="summary-box">
        <small>Modello concussion</small>
        <b>
          ${
            data.attachments.concussion
              ? "Presente"
              : "Non presente"
          }
        </b>
      </div>
    </div>

    <p>
      <b>Arbitro:</b>
      ${escapeHtml(data.referee.firstName)}
      ${escapeHtml(data.referee.lastName)}
      · Tessera
      ${escapeHtml(data.referee.card)}
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
    firebase.firestore.FieldValue
      .serverTimestamp();

  if (isNew) {
    data.createdAt =
      firebase.firestore.FieldValue
        .serverTimestamp();
  }

  const reference = isNew
    ? db.collection("reports").doc()
    : db.collection("reports").doc(reportId);

  reportId = reference.id;

  currentProfile = {
    ...data.referee
  };

  await Promise.all([
    reference.set(
      data,
      { merge: true }
    ),

    db.collection("profiles")
      .doc(user.uid)
      .set(
        {
          ...currentProfile,
          updatedAt:
            firebase.firestore.FieldValue
              .serverTimestamp()
        },
        { merge: true }
      )
  ]);

  setMessage(
    $("#saveMsg"),
    status === "completed"
      ? "Referto confermato."
      : "Bozza salvata correttamente."
  );

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

    setMessage(
      $("#saveMsg"),
      error.code === "permission-denied"
        ? (
          "Permesso negato: verifica le regole " +
          "Firestore e accedi nuovamente."
        )
        : `Errore: ${error.message}`,
      true
    );
  }
}

$("#save").addEventListener(
  "click",
  () => guardedSave("draft")
);

$("#complete").addEventListener(
  "click",
  () => guardedSave("completed")
);

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

  if (!reports.length) {
    $("#reports").innerHTML = `
      <div class="empty">
        Nessun referto salvato.
      </div>
    `;

    return;
  }

  $("#reports").innerHTML = reports
    .map(report => `
      <div class="report-item">
        <span>
          <b>
            ${escapeHtml(
              report.match?.home || "Gara"
            )}
            –
            ${escapeHtml(
              report.match?.away || ""
            )}
          </b>

          <br>

          <small>
            ${escapeHtml(
              report.match?.date || "Senza data"
            )}
          </small>
        </span>

        <span>
          <span class="badge">
            ${
              report.status === "completed"
                ? "Confermato"
                : "Bozza"
            }
          </span>

          <button
            data-load="${report.id}"
            type="button"
          >
            Apri
          </button>
        </span>
      </div>
    `)
    .join("");
}

$("#reports").addEventListener(
  "click",
  async event => {
    const button =
      event.target.closest("[data-load]");

    if (!button) {
      return;
    }

    try {
      const snapshot = await db
        .collection("reports")
        .doc(button.dataset.load)
        .get();

      if (!snapshot.exists) {
        alert(
          "Il referto selezionato non esiste più."
        );
        return;
      }

      reportId = snapshot.id;

      $("#reportForm").reset();
      setFormData(snapshot.data());

      go(0);
    } catch (error) {
      alert(
        `Errore durante l’apertura: ${error.message}`
      );
    }
  }
);

function resetNewReport() {
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
      ...currentProfile,
      email: user?.email || currentProfile.email
    },
    attachments: {
      concussion: false,
      modDIntegration: false,
      modB: 2,
      dae: 1,
      documents: 0
    }
  });

  resetEventEditor();
  go(0);
}

$("#newReport").addEventListener(
  "click",
  () => {
    const confirmed = window.confirm(
      "Creare un nuovo referto? " +
      "Le modifiche non salvate andranno perse."
    );

    if (confirmed) {
      resetNewReport();
    }
  }
);

$("#authForm").addEventListener(
  "submit",
  async event => {
    event.preventDefault();

    const message = $("#authMsg");
    const submitButton =
      event.submitter ||
      $('#authForm button[type="submit"]');

    setMessage(
      message,
      "Accesso in corso…"
    );

    submitButton.disabled = true;

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

      setMessage(
        message,
        "Accesso riuscito."
      );
    } catch (error) {
      console.error(
        "Errore durante l’accesso:",
        error
      );

      setMessage(
        message,
        authMessage(error),
        true
      );
    } finally {
      submitButton.disabled = false;
    }
  }
);

$("#register").addEventListener(
  "click",
  async () => {
    const message = $("#authMsg");

    setMessage(
      message,
      "Creazione account in corso…"
    );

    try {
      await auth.setPersistence(
        firebase.auth.Auth.Persistence.LOCAL
      );

      const credential =
        await auth.createUserWithEmailAndPassword(
          $("#email").value.trim(),
          $("#password").value
        );

      await credential.user
        .sendEmailVerification();

      setMessage(
        message,
        "Account creato. Controlla la tua e-mail."
      );
    } catch (error) {
      setMessage(
        message,
        authMessage(error),
        true
      );
    }
  }
);

$("#reset").addEventListener(
  "click",
  async () => {
    const message = $("#authMsg");

    try {
      const email =
        $("#email").value.trim();

      if (!email) {
        throw new Error(
          "Inserisci prima l’indirizzo e-mail."
        );
      }

      await auth.sendPasswordResetEmail(email);

      setMessage(
        message,
        "E-mail di recupero inviata."
      );
    } catch (error) {
      setMessage(
        message,
        authMessage(error),
        true
      );
    }
  }
);

$("#resend").addEventListener(
  "click",
  async () => {
    try {
      await auth.currentUser
        .sendEmailVerification();

      setMessage(
        $("#verifyMsg"),
        "E-mail di verifica inviata."
      );
    } catch (error) {
      setMessage(
        $("#verifyMsg"),
        authMessage(error),
        true
      );
    }
  }
);

$("#reload").addEventListener(
  "click",
  async () => {
    try {
      await auth.currentUser.reload();
      await auth.currentUser.getIdToken(true);

      if (!auth.currentUser.emailVerified) {
        throw new Error(
          "L’indirizzo non risulta ancora verificato."
        );
      }

      await routeUser(auth.currentUser);
    } catch (error) {
      setMessage(
        $("#verifyMsg"),
        authMessage(error),
        true
      );
    }
  }
);

$("#logout").addEventListener(
  "click",
  async () => {
    await auth.signOut();
    window.location.reload();
  }
);

async function routeUser(currentUser) {
  user = currentUser;

  show(
    $("#logout"),
    Boolean(currentUser)
  );

  show(
    $("#auth"),
    !currentUser
  );

  show(
    $("#verify"),
    Boolean(currentUser) &&
    !currentUser.emailVerified
  );

  show(
    $("#app"),
    Boolean(currentUser) &&
    currentUser.emailVerified
  );

  if (
    !currentUser ||
    !currentUser.emailVerified
  ) {
    return;
  }

  try {
    await refreshVerifiedToken();

    const profileSnapshot = await db
      .collection("profiles")
      .doc(currentUser.uid)
      .get();

    currentProfile = profileSnapshot.exists
      ? profileSnapshot.data()
      : {
        email: currentUser.email
      };

    setFormData({
      referee: currentProfile
    });

    await loadReports();
    go(0);
  } catch (error) {
    console.error(
      "Errore di inizializzazione:",
      error
    );

    $("#reports").innerHTML = `
      <p class="message">
        ${
          error.code === "permission-denied"
            ? (
              "Firestore non autorizzato: " +
              "pubblica le regole di sicurezza."
            )
            : escapeHtml(error.message)
        }
      </p>
    `;
  }
}

auth.onAuthStateChanged(routeUser);

window.addEventListener("error", event => {
  console.error(
    "Errore applicazione:",
    event.error || event.message
  );
});

window.addEventListener(
  "unhandledrejection",
  event => {
    console.error(
      "Promise non gestita:",
      event.reason
    );
  }
);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("./sw.js?v=8")
      .catch(error => {
        console.warn(
          "Service worker non registrato:",
          error
        );
      });
  });
}
