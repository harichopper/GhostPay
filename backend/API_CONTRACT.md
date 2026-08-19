# GhostPay x402 Account-Mapping API Contract

## Overview

These endpoints form the authoritative backend source of truth for the GhostPay x402 Algorand integration.

They provide deterministic, database-backed resolution of:

```
Phone ↔ Account ↔ WalletId ↔ Algorand Wallet Address
```

The backend (MongoDB) is the source of truth. Frontend state is never authoritative.

---

## Authentication

All account endpoints support service-to-service API key authentication.

**Configuration:**

```env
ACCOUNTS_API_KEY=<strong-secret>   # Set in production. Leave empty for open dev access.
```

**Behaviour:**

| Scenario | Result |
|---|---|
| `ACCOUNTS_API_KEY` not set | All requests allowed (development mode) |
| `ACCOUNTS_API_KEY` set, no key provided | 401 Unauthorized |
| `ACCOUNTS_API_KEY` set, wrong key | 401 Unauthorized |
| `ACCOUNTS_API_KEY` set, correct key | Request proceeds |

**Providing the key:**

```http
Authorization: Bearer <key>
```

or

```http
X-Api-Key: <key>
```

**Production requirement:** The server will refuse to start with `NODE_ENV=production` and `ACCOUNTS_API_KEY` unset.

---

## Endpoints

### POST /api/accounts

Creates a new account mapping: `phone → accountId → walletId → walletAddress`

This is a mapping operation only. No blockchain transaction is performed.

**Authentication:** API key (if `ACCOUNTS_API_KEY` is configured)

**Request:**

```json
{
  "phone": "+919876543210",
  "walletId": "wallet_xxxxx",
  "walletAddress": "ALGORAND_ADDRESS_58CHARS",
  "network": "testnet"
}
```

| Field | Type | Required | Description |
|---|---|---|---|
| `phone` | string | yes | International phone number. Normalized to `+<digits>` before storage. |
| `walletId` | string | yes | Application-level GhostPay wallet identifier. Must be globally unique. |
| `walletAddress` | string | yes | Algorand account address. Validated with `algosdk.isValidAddress`. |
| `network` | string | yes | Algorand network. Accepted: `testnet`, `mainnet`, `localnet`. |

**Success response — 201 Created:**

```json
{
  "success": true,
  "account": {
    "accountId": "acct_xxxxx",
    "phone": "+919876543210",
    "walletId": "wallet_xxxxx",
    "walletAddress": "ALGORAND_ADDRESS",
    "network": "testnet",
    "status": "active"
  }
}
```

**Error responses:**

| Status | Code | Condition |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Missing or invalid field. `field` property identifies which. |
| 401 | `UNAUTHORIZED` | API key required but not provided or incorrect. |
| 409 | `ACCOUNT_EXISTS` | Phone number already registered. |
| 409 | `WALLET_ID_EXISTS` | walletId already registered to another account. |
| 409 | `WALLET_ADDRESS_EXISTS` | walletAddress already registered to another account. |
| 503 | `SERVICE_UNAVAILABLE` | MongoDB not configured. |
| 500 | `INTERNAL_ERROR` | Unexpected server error. |

---

### GET /api/accounts/phone/:phone

Resolves an account by phone number. Returns the primary wallet mapping.

**Authentication:** API key (if `ACCOUNTS_API_KEY` is configured)

**Request:**

```
GET /api/accounts/phone/+919876543210
```

The phone number must be URL-encoded when it contains a `+`:

```
GET /api/accounts/phone/%2B919876543210
```

**Success response — 200 OK:**

```json
{
  "success": true,
  "account": {
    "accountId": "acct_xxxxx",
    "phone": "+919876543210",
    "walletId": "wallet_xxxxx",
    "walletAddress": "ALGORAND_ADDRESS",
    "network": "testnet",
    "status": "active"
  }
}
```

**Error responses:**

| Status | Code | Condition |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Phone format is invalid. |
| 401 | `UNAUTHORIZED` | API key required but not provided or incorrect. |
| 404 | `ACCOUNT_NOT_FOUND` | No account exists for this phone. |
| 503 | `SERVICE_UNAVAILABLE` | MongoDB not configured. |
| 500 | `INTERNAL_ERROR` | Unexpected server error. |

---

### GET /api/accounts/wallet/:walletId

Resolves an account by application-level walletId.

**Authentication:** API key (if `ACCOUNTS_API_KEY` is configured)

**Request:**

```
GET /api/accounts/wallet/wallet_xxxxx
```

**Success response — 200 OK:**

```json
{
  "success": true,
  "account": {
    "accountId": "acct_xxxxx",
    "phone": "+919876543210",
    "walletId": "wallet_xxxxx",
    "walletAddress": "ALGORAND_ADDRESS",
    "network": "testnet",
    "status": "active"
  }
}
```

**Error responses:**

| Status | Code | Condition |
|---|---|---|
| 400 | `VALIDATION_ERROR` | walletId is empty or whitespace. |
| 401 | `UNAUTHORIZED` | API key required but not provided or incorrect. |
| 404 | `ACCOUNT_NOT_FOUND` | No account exists for this walletId. |
| 503 | `SERVICE_UNAVAILABLE` | MongoDB not configured. |
| 500 | `INTERNAL_ERROR` | Unexpected server error. |

---

## Bidirectional Consistency Guarantee

Given a created account with `phone = P`, `walletId = W`, `walletAddress = A`, `accountId = C`:

```
GET /api/accounts/phone/P  → { accountId: C, walletId: W, walletAddress: A }
GET /api/accounts/wallet/W → { accountId: C, phone: P,    walletAddress: A }
```

Both lookups resolve to the same database document. The `accountId` is the stable join key.

---

## x402 Consumer Flow

**Phone-first (payment destination resolution):**

```
x402 request with phone P
  → GET /api/accounts/phone/P
  → walletAddress resolved  ← payment destination
  → network resolved        ← which Algorand network to use
```

**WalletId-first (account reconciliation):**

```
walletId W known
  → GET /api/accounts/wallet/W
  → phone resolved          ← identity
  → walletAddress resolved  ← Algorand address
  → network resolved        ← network context
```

---

## Security Notes

- Responses **never** contain: `privateKey`, `mnemonic`, `seedPhrase`, `secretKey`, `password`, `PIN`, `encryptedPrivateKey`
- Phone numbers are returned only in the account object. They are not logged.
- `ACCOUNTS_API_KEY` is never reflected in responses or logs.
- In production (`NODE_ENV=production`), the server will exit on startup if `ACCOUNTS_API_KEY` is not set.

---

## Supported Networks

| Value | Description |
|---|---|
| `testnet` | Algorand TestNet |
| `mainnet` | Algorand MainNet |
| `localnet` | Local Algorand sandbox |

Any other value is rejected with a `VALIDATION_ERROR`.

---

## Phone Normalization

Phones are normalized before storage and lookup:

- All non-digit characters removed
- `+` prefix added
- Minimum 8 digits, maximum 15 digits enforced

This means `+919876543210`, `919876543210`, and `+91 98765 43210` all resolve to `+919876543210`.

---

## MongoDB Indexes

| Field | Index type | Purpose |
|---|---|---|
| `mobileNumber` | unique | Primary phone lookup, duplicate prevention |
| `accountId` | unique | Account ID lookup, duplicate prevention |
| `wallets.walletId` | unique, sparse | WalletId lookup, duplicate prevention |
| `wallets.address` | non-unique | Algorand address lookup (used by send-gate) |

---

## Limitations

- No rate limiting on account endpoints (use an API gateway or reverse proxy in production)
- Phone normalization strips all non-digits and adds `+`. Country-specific digit-count validation is not enforced.
- Account creation via `/api/accounts` does not trigger OTP verification. The `verified` flag on the resulting document is `false` until the user completes the OTP flow via `/api/identity/verify-mobile`.
- These APIs have been tested against `mongodb-memory-server`. A pre-production test against a real Atlas or self-hosted MongoDB instance is recommended before go-live.
