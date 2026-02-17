# CPHELP — Creative Planning Technology Support

AI-powered helpdesk ticket submission form for Creative Planning's Managed IT division. Clients access this form via a desktop system tray icon to submit support requests, which are triaged by Claude AI and forwarded to the PSA via Rewst webhook.

## Architecture

```
Client Browser                    Azure App Service (PHP 8.1)
┌─────────────┐    POST /generate-questions.php    ┌──────────────┐
│  index.html  │ ──────────────────────────────────▶│  Claude API   │
│  (SPA flow)  │◀──────────────────────────────────│  (Anthropic)  │
│              │    POST /submit-ticket.php         ├──────────────┤
│              │ ──────────────────────────────────▶│ Rewst Webhook │
└─────────────┘                                    └──────────────┘
```

**Stack:** Vanilla HTML/CSS/JS frontend, PHP 8.1 backend, Anthropic Claude API, Rewst webhook integration.

This app intentionally uses a simple stack (no framework) for fast load times and minimal complexity — it's a single-page form, not a full application.

## File Structure

```
├── .github/workflows/deploy.yml   # GitHub Actions → Azure App Service
├── assets/                         # Logo, favicons, web manifest
├── js/
│   ├── main.js                     # Initialization, URL params, event binding
│   ├── form-handler.js             # Validation, stage navigation, submission
│   ├── ai-integration.js           # Claude API communication
│   └── ui-manager.js               # Modals, priority UI, proxy detection UI
├── index.html                      # Single-page app (form → summary → confirm)
├── styles.css                      # Full brand stylesheet
├── generate-questions.php          # Backend: Claude API for ticket triage
├── submit-ticket.php               # Backend: forwards payload to Rewst webhook
├── .user.ini                       # PHP config overrides
├── .env.example                    # Required environment variables template
└── .gitignore
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `ANTHROPIC_API_KEY` | Anthropic API key for Claude | Yes |
| `WEBHOOK_URL` | Rewst webhook endpoint URL | Yes |

Set these in **Azure App Service → Environment variables** for production.

## Core Flow

1. User opens the form (optionally with URL parameters pre-filled)
2. User fills out contact info and describes their issue
3. Claude AI analyzes the issue and returns: subject line, priority, and 0–2 follow-up questions
4. User reviews the summary, confirms/adjusts priority, answers optional questions
5. Ticket is submitted to Rewst webhook as `application/x-www-form-urlencoded`
6. Confirmation page shows next steps

## URL Parameters

The desktop tray app (NinjaRMM) can pre-fill fields via URL parameters:

| Parameter | Usage | Example |
|-----------|-------|---------|
| `computer` | Sets hidden computerName field | `?computer=LAPTOP-ABC` |
| `user` | Sets hidden userName field | `?user=jsmith` |
| `issue` | Pre-fills issue description | `?issue=Printer%20not%20working` |
| `noai` | Disables AI review when `1` | `?noai=1` |

## AI Behavior

- **Model:** `claude-sonnet-4-5-20250929`
- **Questions:** Defaults to zero. Only asks 1–2 when the description is genuinely vague and the user hasn't indicated they lack further details.
- **Priority:** Urgent / High / Normal based on scope and impact.
- **Proxy detection:** Detects when someone submits on behalf of another user and prompts for the affected person's contact info.
- **Graceful degradation:** If the AI call fails, the form still works with default priority and no questions.

## Deployment

Deployed via GitHub Actions on push to `main`. The workflow uses OIDC authentication with Azure Managed Identities.

**To deploy:** Push to `main`. The workflow triggers automatically.

**Manual trigger:** Go to Actions → "Build and deploy PHP app" → Run workflow.

## Local Development

1. Clone the repo
2. Copy `.env.example` to `.env.local`
3. Serve with any local PHP server: `php -S localhost:8080`
4. The AI and webhook calls require valid environment variables

## Webhook Payload

Submitted as `application/x-www-form-urlencoded` to the Rewst webhook. All fields are always present (empty string if unused). See `submit-ticket.php` for the complete field list.

## Brand Guidelines

- **Primary:** #165D7D | **Accent:** #A3623F | **Tan:** #C3AC80
- **Headlines:** DM Serif Display | **Body:** Mukta Malar
- **Design:** Clean, centered (max 800px), generous whitespace, mobile-responsive
