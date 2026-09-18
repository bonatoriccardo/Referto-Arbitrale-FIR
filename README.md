# Referto Arbitrale FIR — Beta

Web app gratuita e mobile-first per la compilazione guidata del referto
arbitrale FIR.

## Funzioni disponibili

- registrazione con e-mail e password;
- verifica dell’indirizzo e-mail;
- recupero password;
- profilo arbitro;
- dati della gara e team arbitrale;
- registrazione cronologica degli eventi;
- calcolo automatico del punteggio;
- questionario post-gara;
- salvataggio e riapertura delle bozze;
- conferma del referto;
- generazione del PDF nel browser;
- installazione come applicazione web PWA.

## File del progetto

- `index.html`
- `styles.css`
- `app.js`
- `manifest.webmanifest`
- `sw.js`
- `firestore.rules`

## Configurazione Firebase

### 1. Authentication

Aprire:

Firebase Console → Authentication → Sign-in method

Abilitare:

- Email/Password

### 2. Dominio autorizzato

Aprire:

Firebase Console → Authentication → Settings → Authorized domains

Aggiungere:

```text
bonatoriccardo.github.io
