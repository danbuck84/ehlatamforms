# Data Model

All collections live in Cloud Firestore (`southamerica-east1`). All timestamps are stored and transmitted as UTC instants.

## Collections

### 1. `sessions/{sessionId}`
`sessionId` is `YYYY-MM-DD` in `America/Sao_Paulo` (with an optional `-[a-z]` suffix if two sessions share a day).

| Field | Type | Description |
|---|---|---|
| `startsAt` | `Timestamp` | UTC instant of class start (default `18:00` BRT = `21:00Z`) |
| `endsAt` | `Timestamp` | UTC instant of class end (default `19:00` BRT = `22:00Z`) |
| `timezone` | `"America/Sao_Paulo"` | Canonical class IANA timezone |
| `title` | `string \| null` | Optional custom title |
| `topic` | `string \| null` | Optional conversation topic shown to students |
| `opensOffsetMin` | `number` | Minutes before `startsAt` check-in opens (default **360** = 6h → `12:00` BRT) |
| `closesOffsetMin` | `number` | Minutes after `startsAt` check-in closes (default **360** = 6h → `00:00` BRT next day) |
| `status` | `"scheduled" \| "cancelled"` | Open/closed is derived from time, never stored |
| `requireKeyword` | `boolean` | Default `true` |
| `peakAudience` | `number \| null` | Manual Zoom count entered by the teacher (excluding the teacher) |
| `notes` | `string \| null` | Optional admin notes |
| `createdAt`, `updatedAt` | `Timestamp` | Audit timestamps |

### 2. `sessionSecrets/{sessionId}` (Admin Only)
| Field | Type | Description |
|---|---|---|
| `keyword` | `string` | Secret word announced at the end of class (1–100 chars) |
| `fuzzy` | `boolean` | Default `true` (allows Damerau–Levenshtein distance $\le 1$ when compact length $\ge 5$) |
| `updatedAt` | `Timestamp` | Last update timestamp |

### 3. `checkins/{sessionId}__{emailKey}`
`emailKey` = hex SHA-256 of `emailCanonical`. Deterministic ID guarantees at most one check-in per student per session.

| Field | Type | Description |
|---|---|---|
| `sessionId` | `string` | Reference to `sessions/{sessionId}` |
| `email` | `string` | Trimmed, lowercased email as typed |
| `emailCanonical` | `string` | Dots and `+tag` stripped for Gmail/Googlemail; `+tag` stripped for other domains |
| `emailDomain` | `string` | Domain portion of `email` |
| `country` | `string` | ISO 3166-1 alpha-2 country code |
| `role` | `"rocketseat_student" \| "digital_house_student" \| "dhrs_team" \| "other" \| null` | Student affiliation |
| `speaking` | `"a_lot" \| "a_little" \| "chat_only" \| "listened"` | Self-reported participation |
| `level` | `"too_easy" \| "a_bit_easy" \| "just_right" \| "a_bit_hard" \| "too_hard" \| null` | Perceived conversation level |
| `rating` | `1 \| 2 \| 3 \| 4 \| 5` | Class rating |
| `comment` | `string \| null` | Optional comment ($\le 1000$ chars) |
| `topicSuggestion` | `string \| null` | Optional future topic ($\le 200$ chars) |
| `keywordMatch` | `"exact" \| "fuzzy" \| "not_required"` | How the keyword matched |
| `uiLanguage` | `"en" \| "pt" \| "es"` | Active UI language when submitted |
| `isTeacher` | `boolean` | `true` when email is in `ADMIN_EMAILS`; excluded from `sessionStats` |
| `late` | `boolean` | `true` when captured inside the window offline and delivered within the 48h grace period |
| `clientSubmissionId` | `string` | UUID v4 for idempotent retries |
| `submittedAt` | `Timestamp` | Server timestamp |
| `appVersion` | `string` | Client build version |

### 4. `students/{emailKey}`
Powers returning-student metrics now and `"This is your Nth class! 🔥"` streaks in v1.1.
- Fields: `firstSeenAt`, `lastSeenAt`, `totalCheckins`, `lastCountry`, `emailDomain`, `isTeacher`.

### 5. `sessionStats/{sessionId}`
Updated transactionally alongside `checkins` (excluding `isTeacher: true`).
- Fields: `total`, `ratingSum`, `ratingCount`, `byCountry`, `bySpeaking`, `byLevel`, `byRole`, `byDomain`.

### 6. `rateLimits/{hmacKey}`
Backed by a Firestore TTL policy on `expiresAt`. Keys are HMAC-SHA256 hashed with `HASH_PEPPER` so raw IPs and emails are never stored.
