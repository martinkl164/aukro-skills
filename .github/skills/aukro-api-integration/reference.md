# Aukro API – Reference

This file supplements the [Aukro API integration skill](SKILL.md). For full request/response shapes, use the OpenAPI spec: skill asset [openapi.yaml](openapi.yaml).

**Changelog date (skill):** see SKILL.md frontmatter `changelogDate`. When updating, follow the “Keeping the skill up to date” steps in SKILL.md. To validate, run from repo root:
- `node .github/skills/aukro-api-integration/scripts/check-changelog.mjs` (date check)
- `node .github/skills/aukro-api-integration/scripts/validate-skill-docs.mjs` (docs vs spec consistency and deprecation check)

## OpenAPI spec location

- **Skill asset:** `.github/skills/aukro-api-integration/openapi.yaml`
- **Official:** https://api.aukro.cz/assets/openapi.yaml

Search the YAML for `paths:` and `components/schemas:` to get exact fields and types.

## Security (per operation)

- **api-key:** Send header `X-Aukro-Api-Key`.
- **bearer-key:** Send `Authorization: Bearer <token>` (JWT from POST /authenticate).
- Many endpoints list both; send API key and Bearer when both are present.

## Main schemas (components/schemas)

| Schema | Use |
|--------|-----|
| `OfferV2Request` | POST /offers-v2 body. Required: name, language, description, quantity, categoryId, shippingTemplateId, duration, images, location. |
| `OfferV2Response` | Response of POST /offers-v2. |
| `OffersV2PatchRequest` | PATCH /offers-v2/{id} body. All fields optional. |
| `OfferDataResponse` | GET /offers/{id} response. |
| `MonetaryAmount` | `{ amount: number, currency: string }` (ISO 4217). |
| `OfferV2RequestLocation` | location in offer: city, postCode, countryCode (CZ, SK, PL). |
| `OfferV2RequestImage` | images[] item: either `id` (from /images) or `url`. |
| `OfferV2RequestAttributes` | attributes[]: id, value (free text) or selectedId (predefined). |
| `PublicApiItemAttributeDto` | Attribute in PATCH/import: id, value, selectedId. |
| `RestError` | Error body: uuid, errors[], timestamp. errors[]: severity, message, code, field, additionalInfo. |
| `OfferTerminateRequest` | POST /offers/{id}/terminate: auctionCancelBids?, auctionCancelBidsReason?. |
| `UserWebhookSettingsDto` | Webhook settings: secretKey, webhookUrl, notes?, secretKeyExpiration?, secretKeyExpirationContactEmail?. |
| `WebhookSubscriptionsRequest` / `WebhookSubscriptionsResponse` | events: WebhookEventEnum[]. |
| `PublicLoginVM` | POST /authenticate: username, password. |
| `PublicApiJWTInfo` | Response: token. |

## Offer types and pricing

- **Auction:** auctionPrice > 0, buyNowPrice optional, quantity = 1.
- **Buy now:** auctionPrice = 0, buyNowPrice > 0, quantity ≥ 1.
- **Combined:** both auction and buy now; quantity = 1.
- duration: 3, 5, 7, 10 or 30 (30 only for buy now).
- Currency by domain: CZK (aukro.cz), EUR (aukro.sk), HUF (aukro.hu). Use MonetaryAmount in all price fields.

## List offers (GET /offers-v2/list)

- Query: `page` (0-based), `size` (1–60), `status` (array: ACTIVE, SCHEDULE, ENDED, SCHEDULED_PUBLIC, SCHEDULED_ACTIVE), `sort` (e.g. itemId_DESC).
- Headers: `X-Accept-Language` (BCP-47, default cs-CZ), `X-Accept-Currency` (default CZK).
- Response: content[], page (number, size, totalElements, totalPages).

## Webhook events (subscription)

Subscribe via POST /webhook/subscriptions with body `{ events: WebhookEventEnum[] }`. Event names (no version suffix): itemExpired, itemCreated, itemExposed, itemWon, itemTerminated, newOrderSubmitted, itemWonExpired, orderStoppedByBuyer, orderPaymentReturnedToBuyer, orderNotPaid, orderReceivedPaymentSplit, orderPaid, orderReceived, orderPaidOut, itemBid, itemReexposed, cancelBid, packetOrdered, packetNewLabel, packetFailed.

Webhook delivery: POST to your URL with `Authorization` = your secretKey. Respond 2xx within 2s. Source IPs for allowlist: Production 185.175.85.228, Development 185.175.85.227.

## Offer description HTML

Root: `<div class="aukro-offer-default">`. Blocks: `<div data-layout="text">`, `image`, `text-image`, `image-text`, `image-image`. Allowed tags: h2, p, strong, ol, ul, li, img. Max 65,000 characters including HTML.

## Images

- Upload first via POST /images (multipart, key `images`) or POST /images/url (JSON `{ imagesUrl: string[] }`).
- Response: array of `PublicApiImageDto` with `imageId`. Use these ids in OfferV2Request.images[].id, or pass URLs in images[].url.
- Max 24 images per offer (category’s maxItemImages). Formats: JPEG, PNG, WebP, GIF. Max 5 MB per image.

## Import (POST /offers-import-v2)

- multipart/form-data, key `data`; file CSV or JSON (see API examples).
- Response: code (import UUID), offers[] (entityId, offerId, status, errors). Check status via GET /offers-import/{id}.

## Language and currency by domain

| Domain | Language (BCP-47) | Currency |
|--------|-------------------|----------|
| aukro.cz | cs-CZ | CZK |
| aukro.sk | sk-SK | EUR |
| aukro.hu | hu-HU | HUF |
| aukro.hr | hr-HR | — |
| aukro.si | sl-SI | — |

Use the domain the user account is registered on for offer creation; read endpoints accept any supported language/currency via headers.
