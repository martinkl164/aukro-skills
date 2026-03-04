---
name: aukro-api-integration
description: Integrate with Aukro Public API for selling on Aukro. Use when implementing Aukro connection, offers, categories, images, webhooks, or authentication. Follows official API docs and project OpenAPI spec.
changelogDate: "26.02.2026"
---

# Aukro API Integration

**OpenAPI changelog date (skill):** 26.02.2026 — when updating the skill, check the [official changelog](#keeping-the-skill-up-to-date) and refresh the spec if newer.

Use this skill whenever you are **implementing or changing integration with the Aukro API** (connection, offers, categories, images, webhooks, authentication). Always base requests and types on the **official API** and the **project OpenAPI spec**.

## When to use

- Implementing Aukro API client, auth, or connection
- Creating/updating offers (POST /offers-v2, PATCH /offers-v2/{id})
- Listing offers (GET /offers-v2/list), getting one offer (GET /offers/{id})
- Categories (GET /categories, GET /categories/{id}/attributes)
- Image upload (POST /images, POST /images/url)
- Webhooks (settings, subscriptions, event handling)
- Authentication (POST /authenticate, API key, Bearer token)
- Shipping templates, packets, or offer import (CSV/JSON)

## Authoritative sources

1. **Official docs:** https://api.aukro.cz/
2. **OpenAPI spec (official):** https://api.aukro.cz/assets/openapi.yaml
3. **Skill asset (prefer when using this skill):** `.cursor/skills/aukro-api-integration/openapi.yaml`

Before implementing or changing Aukro integration, **read the relevant parts of the OpenAPI spec** (skill asset: paths, schemas, required fields). Do not guess request/response shapes.

## Authentication

- **API key:** Required for all requests. Header: `X-Aukro-Api-Key`. Obtain from Aukro.
- **Bearer token:** For authenticated user operations. Obtain via `POST /authenticate` with `username` and `password` (JSON). Use `Authorization: Bearer <token>`.
- **Content-Type:** `application/json` for JSON bodies; use `multipart/form-data` only where the spec says so (e.g. image upload, offers-import-v2).

## Base URLs

- **Production:** `https://aukro.cz/api/v2`
- **Development:** `https://be.djp.aukro.cloud/backend-web/api/v2`

All paths below are relative to the base URL (e.g. `/offers-v2` → `{base}/offers-v2`).

## Key endpoints (use v2; older ones are deprecated)

| Operation | Method | Path | Notes |
|-----------|--------|------|--------|
| Authenticate | POST | `/authenticate` | Body: `{ username, password }`. Returns JWT. |
| Create offer | POST | `/offers-v2` | JSON body. Use `OfferV2Request` schema. |
| Update offer | PATCH | `/offers-v2/{id}` | Partial update. Use `OffersV2PatchRequest`. |
| Get offer | GET | `/offers/{id}` | Single offer data. |
| List offers | GET | `/offers-v2/list` | Query: `page`, `size`, `status`, `sort`. Headers: `X-Accept-Language`, `X-Accept-Currency`. |
| Terminate offer | POST | `/offers/{id}/terminate` | Body: `OfferTerminateRequest`. |
| Categories | GET | `/categories` | Optional `X-Accept-Language`. |
| Category attributes | GET | `/categories/{id}/attributes` | Leaf category only. |
| Upload images (binary) | POST | `/images` | multipart/form-data, key `images`. |
| Upload images by URL | POST | `/images/url` | JSON: `{ imagesUrl: string[] }`. |
| Create offers from file | POST | `/offers-import-v2` | multipart/form-data, key `data` (CSV/JSON). |
| Get import status | GET | `/offers-import/{id}` | `id` = import UUID. |
| Shipping templates | GET | `/shipping-templates` | User's templates. |
| Webhook settings | GET/POST/DELETE | `/webhook/settings` | Create/read/delete webhook config. |
| Webhook subscriptions | GET/POST | `/webhook/subscriptions` | Subscribe to event types. |

## Conventions

- **Currency:** ISO 4217 (e.g. CZK, EUR, HUF). Use `MonetaryAmount`: `{ amount, currency }`.
- **Language:** BCP-47 (e.g. cs-CZ, sk-SK). Send via `X-Accept-Language` where supported.
- **Offer description:** HTML with limited tags; root must be `<div class="aukro-offer-default">`. Allowed: h2, p, strong, ol/ul/li, img; layout blocks use `data-layout` (text, image, text-image, image-text, image-image). See OpenAPI tag "Offers" for full rules.
- **Offer images:** At least one title image. Formats: JPEG, PNG, WebP, GIF. Max 24 images per offer (category-dependent). Upload before creating offer (by binary or URL).
- **Errors:** API returns `RestError` with `errors[]` (severity, message, code, field, additionalInfo). Handle 4xx/5xx and parse this body.

## Implementation checklist

When adding or changing Aukro integration:

1. **Open** the OpenAPI spec (skill asset `openapi.yaml`) and find the path and schema for the operation.
2. **Define types** (or reuse) from the OpenAPI components (e.g. `OfferV2Request`, `OfferV2Response`, `MonetaryAmount`, `OfferV2RequestLocation`).
3. **Use correct base URL** (env or config for prod vs dev).
4. **Send API key** on every request; send Bearer token when the endpoint requires it (see security in OpenAPI).
5. **Set headers** (Content-Type, X-Accept-Language, X-Accept-Currency) as per spec.
6. **Handle errors** and map API error payloads to your app’s error type.
7. **Write tests** for the integration (mocked HTTP or contract tests); follow project TDD and AGENTS.md.

## Additional resources

- Full endpoint and schema details: [reference.md](reference.md)
- Official API documentation: https://api.aukro.cz/

## Keeping the skill up to date

Whenever you work on this skill, are asked to refresh the Aukro API spec, or want to validate the skill:

1. **Check the official changelog**
   - Fetch the spec: `https://api.aukro.cz/assets/openapi.yaml` (e.g. with `fetch_webpage`, or `curl` / `Invoke-WebRequest` in a terminal).
   - If the server returns 4xx/5xx or is unreachable, go to step 4.
   - In the response body (YAML), find the changelog date: under `tags`, the entry with `name: Changelog` has a `description` field. The **latest** date is the first one in that description, format `- DD.MM.YYYY`. Extract it with the first match of this regex: `-\s*(\d{2}\.\d{2}\.\d{4})` (capture group = DD.MM.YYYY, e.g. `26.02.2026`).

2. **Compare with the skill’s changelog date**
   - Read `changelogDate` from this file’s frontmatter and the line “OpenAPI changelog date (skill):” in the body.
   - Compare dates: parse both as DD.MM.YYYY and compare (year, then month, then day). If the **official** date is **newer** than the skill’s date, an update is needed.

3. **If the official changelog has a newer date**
   - **Download** the full OpenAPI YAML from https://api.aukro.cz/assets/openapi.yaml (you can reuse the response from step 1 if you already fetched it).
   - **Save** it as the skill asset: `.cursor/skills/aukro-api-integration/openapi.yaml` (overwrite existing). Use the Write tool or a terminal command writing the response body to that path.
   - **Update this skill:** set frontmatter `changelogDate` to the extracted date (DD.MM.YYYY) and update the line “OpenAPI changelog date (skill):” in the body to the same value.
   - **Validate docs against the updated spec:** run `node .cursor/skills/aukro-api-integration/scripts/validate-skill-docs.mjs`. If it reports deprecated/missing endpoint docs or schema mismatches, update SKILL.md/reference.md before finishing.

4. **If the official URL is unavailable** (e.g. 500)
   - Use the existing skill asset; do not change the changelog date.

**Validation scripts:** From the repo root run:
`node .cursor/skills/aukro-api-integration/scripts/check-changelog.mjs`
`node .cursor/skills/aukro-api-integration/scripts/validate-skill-docs.mjs`

- `check-changelog.mjs`
   - Exit 0: skill date is same/newer than local openapi.yaml.
   - Exit 1: openapi.yaml has a newer changelog date than SKILL.md → update SKILL.md date after refreshing spec.
   - Exit 2: script error (file missing or date parsing failed).

- `validate-skill-docs.mjs`
   - Exit 0: documented key endpoints and reference schemas are consistent with openapi.yaml and no documented endpoint is deprecated.
   - Exit 1: docs update needed (missing/deprecated documented endpoint, missing schema, or stale hardcoded date notice).
   - Exit 2: script error (file/section parsing issue).

Use both scripts after replacing `openapi.yaml`. Date matching alone is not enough, because an updated spec may deprecate/remove endpoints while keeping the changelog workflow valid.
