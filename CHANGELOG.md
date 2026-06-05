# Changelog

All notable changes to this project will be documented in this file.

## [0.1.0] — 2025-06-05

### Added

- **Onboarding chat UI** — conversational interface per raccolta dati clienti
- **Multi-tenant routing** — pagine dinamiche `/[tenantId]` con configurazione in `lib/onboarding/config.ts`
- **API proxy** — `POST /api/chat` proxy verso backend Cloud Run (nessun URL esterno nel client)
- **localStorage storico chat** — persistenza messaggi con chiave `onboarding-messages-{tenantId}`
- **Bottone "Azzera chat"** — reset localStorage + conferma visiva 2s
- **Progress steps** — barra 4 step (Nome, Settore, Tool, Obiettivi) con rilevamento keyword
- **Step pulse animation** — animazione CSS sullo step attivo
- **End feedback form** — form inline con validazione (nome ≥ 3 char, email regex, consenso obbligatorio)
- **Session lock** — input disabilitato dopo invio feedback
- **Export profilo JSON** — download `onboarding-{tenantId}-{YYYYMMDD}.json`
- **Dark mode** — design tokens CSS con supporto `prefers-color-scheme`
- **Dockerfile** — multi-stage build per Cloud Run (node:20-slim, standalone output)
- **deploy.sh** — script deploy one-command per Cloud Run (`europe-west8`)
- **GitHub Actions CI/CD** — build + lint + typecheck su push, deploy su tag `v*`
- **Dependabot** — aggiornamenti settimanali npm e GitHub Actions
