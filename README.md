<p align="center">
  <a href="https://aukro.cz/" target="_blank">
    <img src="https://logo.clearbit.com/aukro.cz" alt="Aukro" width="96" height="96" />
  </a>
</p>

<h1 align="center">aukro-skills</h1>

<p align="center">
  Agent skills for integrating with the <a href="https://api.aukro.cz/">Aukro Public API</a> — works with <strong>GitHub Copilot</strong> and <strong>Cursor</strong>.
</p>

<p align="center">
  <a href="https://aukro.cz/"><img src="https://img.shields.io/badge/aukro.cz-official%20site-orange?logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0id2hpdGUiIGQ9Ik0xMiAyQzYuNDggMiAyIDYuNDggMiAxMnM0LjQ4IDEwIDEwIDEwIDEwLTQuNDggMTAtMTBTMTcuNTIgMiAxMiAyem0tMSAxNy45M1Y0LjA3YzMuOTQuNDkgNyAzLjg1IDcgNy45M3MtMy4wNiA3LjQ0LTcgNy45M3oiLz48L3N2Zz4=" alt="Aukro official site" /></a>
  <a href="https://api.aukro.cz/"><img src="https://img.shields.io/badge/API%20docs-api.aukro.cz-blue" alt="API docs" /></a>
  <img src="https://img.shields.io/badge/API%20changelog-26.02.2026-blue" alt="Changelog" />
  <img src="https://img.shields.io/badge/GitHub%20Copilot-skill-8957e5?logo=github" alt="Copilot" />
  <img src="https://img.shields.io/badge/Cursor-skill-black?logo=cursor" alt="Cursor" />
  <img src="https://img.shields.io/badge/license-MIT-green" alt="License" />
</p>

Each skill ships a pinned `openapi.yaml`, step-by-step implementation guidance, and validation scripts that automatically detect when the Aukro API changelog advances — prompting a one-command spec refresh.

---

## Skills

| Platform | Path |
| --- | --- |
| GitHub Copilot | [`.github/skills/aukro-api-integration`](.github/skills/aukro-api-integration/) |
| Cursor | [`.cursor/skills/aukro-api-integration`](.cursor/skills/aukro-api-integration/) |

Each skill directory contains:

```
aukro-api-integration/
├── SKILL.md                      # Instructions + update workflow loaded by the agent
├── openapi.yaml                  # Pinned Aukro OpenAPI spec (source of truth for types)
├── reference.md                  # Quick endpoint/schema lookup table
└── scripts/
    ├── check-changelog.mjs       # Compares spec changelog date vs SKILL.md
    └── validate-skill-docs.mjs   # Checks endpoints & schemas for deprecation/gaps
```

---

## Example

When you ask your agent about the Aukro API, the skill is activated automatically:

---

**You**
> How do I create a new offer on Aukro? Which fields are required?

**Agent** *(skill `aukro-api-integration` loaded)*
> Call `POST /offers-v2` with an `OfferV2Request` body. Required fields:
>
> | Field | Type | Notes |
> | --- | --- | --- |
> | `name` | `string` | Offer title |
> | `language` | `string` | BCP-47, e.g. `cs-CZ` |
> | `description` | `string` | HTML root `<div class="aukro-offer-default">` |
> | `quantity` | `integer` | ≥ 1; must be `1` for auctions |
> | `categoryId` | `integer` | Leaf category ID |
> | `shippingTemplateId` | `integer` | From `GET /shipping-templates` |
> | `duration` | `integer` | `3`, `5`, `7`, `10`, or `30` days |
> | `images` | `array` | Upload via `POST /images` first, then pass the returned `imageId` |
> | `location` | `object` | `{ city, postCode, countryCode }` |
>
> Authentication: `X-Aukro-Api-Key` on every request; `Authorization: Bearer <token>` for user-scoped endpoints (token via `POST /authenticate`).
>
> ```ts
> await fetch(`${BASE_URL}/offers-v2`, {
>   method: "POST",
>   headers: {
>     "Content-Type": "application/json",
>     "X-Aukro-Api-Key": API_KEY,
>     "Authorization": `Bearer ${token}`,
>   },
>   body: JSON.stringify(offerPayload),
> });
> ```

---

## Quick Start

```bash
git clone https://github.com/your-org/aukro-skills.git
```

Drop the cloned directory (or use it as a submodule) inside your project. The agents pick up skills automatically — no config needed.

---

## Validation

Run from the repo root after updating the spec or docs:

```bash
# GitHub Copilot skill
node .github/skills/aukro-api-integration/scripts/check-changelog.mjs
node .github/skills/aukro-api-integration/scripts/validate-skill-docs.mjs

# Cursor skill
node .cursor/skills/aukro-api-integration/scripts/check-changelog.mjs
node .cursor/skills/aukro-api-integration/scripts/validate-skill-docs.mjs
```

| Exit code | Meaning |
| --- | --- |
| `0` | Everything is in sync ✓ |
| `1` | Docs need updating — stale date, deprecated endpoint, or missing schema |
| `2` | Script error — file missing or unparseable |

---

## Keeping the Spec Fresh

The skills are self-aware about their own freshness. Here's how the update cycle works:

```
┌─────────────────────────────────────────────────────────────────┐
│                        Update Lifecycle                         │
└─────────────────────────────────────────────────────────────────┘

  1. DETECT ──► check-changelog.mjs fetches the latest changelog
                date from the live API spec and compares it with
                the pinned changelogDate in SKILL.md.

         exit 0 → already up to date, nothing to do ✓
         exit 1 → newer date found, proceed to step 2

  2. DOWNLOAD ─► Fetch the full updated spec:

                 curl -o openapi.yaml \
                   https://api.aukro.cz/assets/openapi.yaml

                 (or ask your agent: "refresh the Aukro API spec")

  3. UPDATE ──► Set changelogDate in SKILL.md to the new date.
                The agent does this automatically when asked to
                run the update workflow.

  4. VALIDATE ─► validate-skill-docs.mjs cross-checks every
                 documented endpoint and schema against the new
                 spec — flagging deprecated or missing items.

  5. SYNC ────► Repeat for both skill directories to keep
                Copilot and Cursor agents in lockstep.
```

**Manual one-liner** (run from repo root):

```bash
# Check if an update is needed
node .github/skills/aukro-api-integration/scripts/check-changelog.mjs

# If exit code 1 — download, then validate:
curl -o .github/skills/aukro-api-integration/openapi.yaml \
     https://api.aukro.cz/assets/openapi.yaml
curl -o .cursor/skills/aukro-api-integration/openapi.yaml \
     https://api.aukro.cz/assets/openapi.yaml
node .github/skills/aukro-api-integration/scripts/validate-skill-docs.mjs
```

**Let your agent do it** — just ask:
> *"Check if the Aukro API spec has changed and update the skill if needed."*

The agent reads the `SKILL.md` update workflow, fetches the live spec, compares changelog dates, downloads the new YAML, bumps `changelogDate`, and runs both validation scripts automatically.

> Keep `.github/skills/` and `.cursor/skills/` in sync to avoid behavioral drift between agents.
