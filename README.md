# SmartVolve Onboarding

Portale di onboarding conversazionale per i clienti SmartVolve.  
L'utente interagisce con un assistente AI che raccoglie informazioni sul profilo aziendale, e al termine può confermare i dati e ricevere il riepilogo.

## Quick Start

```bash
# Installa dipendenze
npm install

# Avvia dev server (porta 3001)
npm run dev -- --port 3001
```

Apri [http://localhost:3001/demo](http://localhost:3001/demo) per testare con il tenant "Azienda Demo".

### Tenant disponibili

| Slug                | Display Name       |
| ------------------- | ------------------ |
| `demo`              | Azienda Demo       |
| `studio-rossi`      | Studio Rossi       |
| `immobiliare-verde` | Immobiliare Verde  |

Per aggiungere un nuovo tenant: modifica `lib/onboarding/config.ts`.

## Funzionalità

### A) localStorage — Storico chat
- I messaggi vengono salvati automaticamente in `localStorage` con chiave `onboarding-messages-{tenantId}`.
- Al reload la conversazione viene ripristinata.
- Bottone **"Azzera"** nell'header per resettare la chat (con conferma visiva di 2 secondi).

### B) Progress steps
- Barra a 4 step sotto l'header: **Nome → Settore → Tool → Obiettivi**.
- Lo step attivo viene rilevato dall'analisi dell'ultimo messaggio dell'assistente (keyword matching).
- Step completati: cerchio verde con check. Step attivo: cerchio blu con animazione pulse.

### C) End feedback form
- Quando l'assistente risponde con keyword di completamento ("grazie", "perfetto", "ottimo"…), appare un form inline.
- Campi: nome e cognome, email, consenso contatto (tutti obbligatori con validazione).
- I dati vengono salvati in `localStorage` come `onboarding-feedback-{tenantId}`.
- Dopo l'invio, l'input viene disabilitato per la sessione.

### D) Export profilo
- Bottone **"Esporta"** nell'header (visibile solo dopo il feedback).
- Scarica un file `onboarding-{tenantId}-{YYYYMMDD}.json` con: tenantId, timestamp, messaggi, dati feedback.

## Architettura

```
app/
├── api/chat/route.ts        ← Proxy backend verso Cloud Run
├── [tenantId]/page.tsx       ← Pagina tenant (SSR)
├── globals.css               ← Design tokens + dark mode
├── layout.tsx                ← Root layout
components/
└── onboarding/
    └── OnboardingChat.tsx    ← Client component principale
lib/
└── onboarding/
    └── config.ts             ← Configurazione tenant
```

## Deploy su Cloud Run

```bash
# Prerequisiti: gcloud CLI autenticato
./deploy.sh
```

Lo script:
1. Imposta progetto `smartvolve-factory`
2. Builda l'immagine con Cloud Build
3. Deploya su Cloud Run (`europe-west8`)
4. Salva l'URL in `.cloudrun-url`

## CI/CD (GitHub Actions)

- **Push su `main`**: build + lint + typecheck
- **Tag `v*`** (es. `git tag v0.1.0 && git push origin v0.1.0`): deploy automatico su Cloud Run

### Secrets GitHub necessari

| Secret                | Descrizione                              |
| --------------------- | ---------------------------------------- |
| `WIF_PROVIDER`        | Workload Identity Federation provider    |
| `WIF_SERVICE_ACCOUNT` | Service account per Cloud Run            |

## Comandi utili

```bash
npm run dev          # Dev server (Turbopack)
npm run build        # Production build
npm run lint         # ESLint
npm run typecheck    # TypeScript check
./deploy.sh          # Deploy Cloud Run
```

## Variabili d'ambiente

Nessuna variabile è richiesta per lo sviluppo locale.  
Vedi `.env.example` per i secrets di produzione.

## License

Private — SmartVolve © 2025
