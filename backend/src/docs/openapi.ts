/**
 * openapi.ts
 *
 * OpenAPI 3.0 specification for the GhostPay backend.
 *
 * IMPORTANT — this spec is written against the ACTUAL registered routes only.
 * Do not add documentation for routes that do not exist.
 *
 * Actual route surface (audited from server.ts + all Router files):
 *
 *   Health
 *     GET  /health
 *
 *   Algorand
 *     GET  /api/algorand/network
 *     GET  /api/algorand/signer
 *     GET  /api/algorand/balance/:address
 *     GET  /api/algorand/assets/:address
 *     GET  /api/algorand/transactions/:address
 *     GET  /api/algorand/params              ← offline transaction parameters
 *     POST /api/algorand/send
 *
 *   Identity
 *     POST /api/identity/request-verification
 *     POST /api/identity/send-sms-otp
 *     POST /api/identity/verify-mobile
 *     GET  /api/identity/mobile/:mobileNumber/wallets
 *     GET  /api/identity/wallet/:walletAddress
 *
 *   Accounts  (x402 account-mapping layer)
 *     POST /api/accounts
 *     GET  /api/accounts/phone/:phone
 *     GET  /api/accounts/wallet/:walletId
 */

import type { OpenAPIV3 } from 'openapi-types';
import { env } from '../config/env.js';

export function buildOpenApiSpec(): OpenAPIV3.Document {
  return {
    openapi: '3.0.3',

    info: {
      title: 'GhostPay API',
      description: [
        'GhostPay backend API.',
        '',
        '**Authentication**',
        '',
        'Most endpoints are public (no authentication required).',
        'The `/api/accounts` endpoints support optional service-to-service API key auth',
        'controlled by the `ACCOUNTS_API_KEY` environment variable.',
        '',
        'When `ACCOUNTS_API_KEY` is set, provide the key using either:',
        '- `Authorization: Bearer <key>`',
        '- `X-Api-Key: <key>`',
        '',
        'When `ACCOUNTS_API_KEY` is empty (default for development), all account endpoints are open.',
        '',
        '**Identity gate**',
        '',
        'By default (`REQUIRE_IDENTITY_FOR_SEND=true`), `POST /api/algorand/send` requires',
        'both sender and receiver wallets to be linked to verified mobile numbers via the',
        'Identity API before a transaction is accepted.',
      ].join('\n'),
      version: '1.0.0',
      contact: {
        name: 'GhostPay'
      }
    },

    servers: [
      {
        url: `http://localhost:${env.port}`,
        description: 'Local development server'
      }
    ],

    tags: [
      { name: 'Health',    description: 'Service health check' },
      { name: 'Algorand',  description: 'Algorand blockchain operations — balance, assets, payments' },
      { name: 'Identity',  description: 'Mobile number identity — OTP verification and wallet linking' },
      { name: 'Accounts',  description: 'x402 account-mapping — phone ↔ walletId ↔ Algorand address' }
    ],

    // ── Security schemes ────────────────────────────────────────────────────
    components: {
      securitySchemes: {
        BearerApiKey: {
          type: 'http',
          scheme: 'bearer',
          description: 'API key via `Authorization: Bearer <key>`. Required when `ACCOUNTS_API_KEY` is configured on the server.'
        },
        XApiKey: {
          type: 'apiKey',
          in: 'header',
          name: 'X-Api-Key',
          description: 'API key via `X-Api-Key` header. Alternative to Bearer auth. Required when `ACCOUNTS_API_KEY` is configured.'
        }
      },

      schemas: {

        // ── Shared error shapes ────────────────────────────────────────────

        /** Used by /api/algorand and /api/identity routes */
        ErrorResponse: {
          type: 'object',
          required: ['error'],
          properties: {
            error: { type: 'string', description: 'Human-readable error description', example: 'Invalid Algorand address' }
          }
        } satisfies OpenAPIV3.SchemaObject,

        /** Used by /api/accounts routes */
        AccountErrorResponse: {
          type: 'object',
          required: ['success', 'code', 'message'],
          properties: {
            success: { type: 'boolean', example: false },
            code: {
              type: 'string',
              enum: ['VALIDATION_ERROR', 'ACCOUNT_EXISTS', 'WALLET_ID_EXISTS', 'WALLET_ADDRESS_EXISTS',
                     'ACCOUNT_NOT_FOUND', 'UNAUTHORIZED', 'SERVICE_UNAVAILABLE', 'INTERNAL_ERROR'],
              example: 'ACCOUNT_NOT_FOUND'
            },
            field: { type: 'string', description: 'Field that failed validation (only present on VALIDATION_ERROR)', example: 'phone' },
            message: { type: 'string', example: 'No account was found for this phone number.' }
          }
        } satisfies OpenAPIV3.SchemaObject,

        // ── Account schemas ────────────────────────────────────────────────

        AccountView: {
          type: 'object',
          description: 'Public account view. Never contains private key material.',
          required: ['accountId', 'phone', 'walletId', 'walletAddress', 'network', 'status'],
          properties: {
            accountId:     { type: 'string', description: 'Stable application-level account identifier', example: 'acct_lf2k7abc' },
            phone:         { type: 'string', description: 'Normalized international phone number', example: '+919876543210' },
            walletId:      { type: 'string', description: 'Application-level GhostPay wallet identifier', example: 'wallet_lf2k7xyz' },
            walletAddress: { type: 'string', description: 'Algorand account address (58-character base32)', example: 'TEK5RKWGNATWM2XDLDINNFIXWGHO5ZF5PPO4W3J56OGLSQKLPFFTY2RKZ4' },
            network:       { type: 'string', enum: ['testnet', 'mainnet', 'localnet'], example: 'testnet' },
            status:        { type: 'string', enum: ['active', 'suspended'], example: 'active' }
          }
        } satisfies OpenAPIV3.SchemaObject,

        AccountResponse: {
          type: 'object',
          required: ['success', 'account'],
          properties: {
            success: { type: 'boolean', example: true },
            account: { $ref: '#/components/schemas/AccountView' }
          }
        } satisfies OpenAPIV3.SchemaObject,

        CreateAccountRequest: {
          type: 'object',
          required: ['phone', 'walletId', 'walletAddress', 'network'],
          properties: {
            phone: {
              type: 'string',
              description: 'International phone number. Normalized to `+<digits>` before storage.',
              example: '+919876543210'
            },
            walletId: {
              type: 'string',
              description: 'Application-level GhostPay wallet identifier. Must be globally unique.',
              example: 'wallet_lf2k7xyz'
            },
            walletAddress: {
              type: 'string',
              description: 'Algorand account address. Validated with algosdk.isValidAddress.',
              example: 'TEK5RKWGNATWM2XDLDINNFIXWGHO5ZF5PPO4W3J56OGLSQKLPFFTY2RKZ4'
            },
            network: {
              type: 'string',
              enum: ['testnet', 'mainnet', 'localnet'],
              description: 'Algorand network this wallet belongs to.',
              example: 'testnet'
            }
          }
        } satisfies OpenAPIV3.SchemaObject,

        // ── Identity schemas ───────────────────────────────────────────────

        WalletLink: {
          type: 'object',
          description: 'A single wallet linked to a mobile identity.',
          required: ['walletId', 'address', 'network', 'isDefault', 'verifiedAt', 'addedAt'],
          properties: {
            walletId:   { type: 'string', description: 'Application-level wallet identifier', example: 'wallet_lf2k7xyz' },
            address:    { type: 'string', description: 'Algorand account address', example: 'TEK5RKWGNATWM2XDLDINNFIXWGHO5ZF5PPO4W3J56OGLSQKLPFFTY2RKZ4' },
            network:    { type: 'string', example: 'testnet' },
            label:      { type: 'string', description: 'Human-readable wallet label', example: 'Primary Wallet' },
            isDefault:  { type: 'boolean', description: 'Whether this is the primary wallet for this identity', example: true },
            verifiedAt: { type: 'string', format: 'date-time', example: '2026-08-19T10:00:00.000Z' },
            addedAt:    { type: 'string', format: 'date-time', example: '2026-08-19T10:00:00.000Z' }
          }
        } satisfies OpenAPIV3.SchemaObject,

        MobileIdentityResponse: {
          type: 'object',
          required: ['mobileNumber', 'verified', 'wallets'],
          properties: {
            mobileNumber: { type: 'string', example: '+919876543210' },
            verified:     { type: 'boolean', example: true },
            wallets:      { type: 'array', items: { $ref: '#/components/schemas/WalletLink' } }
          }
        } satisfies OpenAPIV3.SchemaObject,

        VerificationRequestResponse: {
          type: 'object',
          required: ['mobileNumber', 'verificationSent', 'expiresInSeconds'],
          properties: {
            mobileNumber:     { type: 'string', example: '+919876543210' },
            verificationSent: { type: 'boolean', example: true },
            expiresInSeconds: { type: 'integer', example: 300 },
            sms: {
              type: 'object',
              properties: {
                delivered: { type: 'boolean' },
                provider:  { type: 'string', enum: ['none', 'twilio'] },
                simulated: { type: 'boolean' }
              }
            },
            devOtpCode: {
              type: 'string',
              description: 'OTP code returned only in development when REVEAL_OTP_IN_RESPONSE=true. Never present in production.',
              example: '123456'
            }
          }
        } satisfies OpenAPIV3.SchemaObject,

        // ── Algorand schemas ───────────────────────────────────────────────

        NetworkInfoResponse: {
          type: 'object',
          required: ['network', 'signerAddress'],
          properties: {
            network:          { type: 'string', enum: ['testnet', 'mainnet'], example: 'testnet' },
            explorerTxBaseUrl:{ type: 'string', example: 'https://testnet.explorer.perawallet.app/tx/' },
            demoModeAllowed:  { type: 'boolean', example: true },
            contractAppId:    { type: 'integer', example: 0 },
            contractEnabled:  { type: 'boolean', example: false },
            signerAddress:    { type: 'string', description: 'Server signer wallet address (empty string if not configured)', example: 'VCMJKWOY5P5Z7CJST7I...' }
          }
        } satisfies OpenAPIV3.SchemaObject,

        AssetHolding: {
          type: 'object',
          required: ['assetId', 'name', 'unitName', 'amount', 'decimals', 'isAlgo'],
          properties: {
            assetId:  { type: 'integer', example: 0 },
            name:     { type: 'string', example: 'Algorand' },
            unitName: { type: 'string', example: 'ALGO' },
            amount:   { type: 'number', example: 10.5 },
            decimals: { type: 'integer', example: 6 },
            isAlgo:   { type: 'boolean', example: true }
          }
        } satisfies OpenAPIV3.SchemaObject,

        SendPaymentRequest: {
          type: 'object',
          required: ['sender', 'receiver', 'amount', 'timestamp'],
          properties: {
            sender:          { type: 'string', description: 'Sender Algorand address', example: 'TEK5RKWGNATWM2XDLDINNFIXWGHO5ZF5PPO4W3J56OGLSQKLPFFTY2RKZ4' },
            receiver:        { type: 'string', description: 'Receiver Algorand address', example: '6XPKERRH7SRNUUOULNHEGJENORE2Y537ZDYTUA5O4TRIGXRZQ5ML6LMXLY' },
            amount:          { type: 'number', description: 'Amount in ALGO (max 6 decimal places)', example: 1.5 },
            timestamp:       { type: 'string', description: 'ISO 8601 timestamp used as transaction note marker', example: '2026-08-19T10:00:00.000Z' },
            signedTxnBase64: {
              type: 'string',
              description: [
                'Pre-signed single payment transaction in base64 (client-signed mode, no contract).',
                'Omit to use server signer.',
                'The transaction note MUST start with `GhostPay:<timestamp>`.',
              ].join(' ')
            },
            signedGroupTxnsBase64: {
              type: 'array',
              items: { type: 'string' },
              minItems: 2,
              maxItems: 2,
              description: [
                'Pre-signed atomic group for contract mode: `[payTxnBase64, appCallTxnBase64]`.',
                'Use when `contractEnabled=true` (GHOSTPAY_CONTRACT_APP_ID is configured).',
                'Build the group offline using params from `GET /api/algorand/params`,',
                'assign group ID with `algosdk.assignGroupID`, sign both, and submit here.',
                'App-call args must be `["record", timestamp, amount_uint64_be]`.',
              ].join(' ')
            },
            demoMode:        { type: 'boolean', description: 'If true, return a fake txId without broadcasting. Only allowed when ALLOW_DEMO_MODE=true.', example: false }
          }
        } satisfies OpenAPIV3.SchemaObject,

        SendPaymentResponse: {
          type: 'object',
          required: ['txId', 'explorerUrl', 'network', 'contractVerified'],
          properties: {
            txId:             { type: 'string', description: 'Transaction ID on the Algorand network', example: 'ABCDEF1234567890...' },
            confirmedRound:   { type: 'integer', description: 'Block round the transaction was confirmed in', example: 38000000 },
            explorerUrl:      { type: 'string', description: 'Link to view the transaction in the Algorand explorer', example: 'https://testnet.explorer.perawallet.app/tx/ABCDEF...' },
            network:          { type: 'string', enum: ['testnet', 'mainnet'], example: 'testnet' },
            contractVerified: { type: 'boolean', description: 'Whether the transaction was verified by the GhostPay smart contract', example: false }
          }
        } satisfies OpenAPIV3.SchemaObject,

        /**
         * Response schema for GET /api/algorand/params.
         * All fields needed to construct and sign Algorand transactions offline.
         */
        PaymentParamsResponse: {
          type: 'object',
          required: [
            'network', 'genesisId', 'genesisHashB64',
            'firstValidRound', 'lastValidRound', 'minFee',
            'contractAppId', 'contractEnabled',
            'validityWindowRounds', 'fetchedAt'
          ],
          properties: {
            network:              { type: 'string', enum: ['testnet', 'mainnet'], description: 'Algorand network', example: 'testnet' },
            genesisId:            { type: 'string', description: 'Genesis block identifier', example: 'testnet-v1.0' },
            genesisHashB64:       { type: 'string', description: 'Base64-encoded genesis hash. Decode with Buffer.from(genesisHashB64, "base64") before passing to algosdk.', example: 'SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=' },
            firstValidRound:      { type: 'integer', description: 'First valid round for transactions built from these params', example: 47000000 },
            lastValidRound:       { type: 'integer', description: 'Last valid round — transactions expire after this round', example: 47001000 },
            minFee:               { type: 'integer', description: 'Minimum transaction fee in microALGO (typically 1000)', example: 1000 },
            contractAppId:        { type: 'integer', description: 'GhostPay contract application ID (0 = contract disabled)', example: 0 },
            contractEnabled:      { type: 'boolean', description: 'Whether the GhostPay smart contract is enabled for payments', example: false },
            validityWindowRounds: { type: 'integer', description: 'Number of rounds the params are valid for (lastValidRound - firstValidRound)', example: 1000 },
            fetchedAt:            { type: 'string', format: 'date-time', description: 'ISO 8601 timestamp when these params were fetched from the Algorand node', example: '2026-08-23T10:00:00.000Z' }
          }
        } satisfies OpenAPIV3.SchemaObject
      }
    },

    // ── Paths ────────────────────────────────────────────────────────────────
    paths: {

      // ── Health ─────────────────────────────────────────────────────────

      '/health': {
        get: {
          tags: ['Health'],
          operationId: 'getHealth',
          summary: 'Service health check',
          description: 'Returns a simple JSON object confirming the backend is running.',
          responses: {
            '200': {
              description: 'Service is healthy',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    required: ['ok', 'service'],
                    properties: {
                      ok:      { type: 'boolean', example: true },
                      service: { type: 'string',  example: 'ghostpay-backend' }
                    }
                  }
                }
              }
            }
          }
        }
      },

      // ── Algorand ───────────────────────────────────────────────────────

      '/api/algorand/network': {
        get: {
          tags: ['Algorand'],
          operationId: 'getAlgorandNetwork',
          summary: 'Get network configuration and signer address',
          description: 'Returns the current Algorand network configuration and the server signer wallet address.',
          responses: {
            '200': {
              description: 'Network info',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/NetworkInfoResponse' } } }
            }
          }
        }
      },

      '/api/algorand/signer': {
        get: {
          tags: ['Algorand'],
          operationId: 'getSignerAddress',
          summary: 'Get server signer wallet address',
          description: 'Returns the Algorand address derived from the server\'s `ALGORAND_SENDER_MNEMONIC`. Returns an empty string if not configured.',
          responses: {
            '200': {
              description: 'Signer address',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    required: ['signerAddress'],
                    properties: {
                      signerAddress: { type: 'string', description: 'Server signer Algorand address', example: 'TEK5RKWGNATWM2XDLDINNFIXWGHO5ZF5PPO4W3J56OGLSQKLPFFTY2RKZ4' }
                    }
                  }
                }
              }
            }
          }
        }
      },

      '/api/algorand/balance/{address}': {
        get: {
          tags: ['Algorand'],
          operationId: 'getAlgorandBalance',
          summary: 'Get ALGO balance for an address',
          description: 'Queries the Algorand node for the ALGO balance of the given address.',
          parameters: [
            {
              name: 'address',
              in: 'path',
              required: true,
              description: 'Algorand account address (58-character base32)',
              schema: { type: 'string', example: 'TEK5RKWGNATWM2XDLDINNFIXWGHO5ZF5PPO4W3J56OGLSQKLPFFTY2RKZ4' }
            }
          ],
          responses: {
            '200': {
              description: 'Account balance in ALGO',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    required: ['balanceAlgo'],
                    properties: {
                      balanceAlgo: { type: 'number', description: 'Balance in whole ALGO units', example: 10.5 }
                    }
                  }
                }
              }
            },
            '400': {
              description: 'Invalid Algorand address',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
            },
            '500': {
              description: 'Unable to fetch balance from Algorand node',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
            }
          }
        }
      },

      '/api/algorand/assets/{address}': {
        get: {
          tags: ['Algorand'],
          operationId: 'getAlgorandAssets',
          summary: 'Get ALGO and ASA holdings for an address',
          description: 'Returns all assets held by the address including native ALGO and any ASA tokens. Asset metadata (name, unit name, decimals) is fetched from the Algorand node.',
          parameters: [
            {
              name: 'address',
              in: 'path',
              required: true,
              description: 'Algorand account address',
              schema: { type: 'string', example: 'TEK5RKWGNATWM2XDLDINNFIXWGHO5ZF5PPO4W3J56OGLSQKLPFFTY2RKZ4' }
            }
          ],
          responses: {
            '200': {
              description: 'Asset holdings',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    required: ['assets'],
                    properties: {
                      assets: { type: 'array', items: { $ref: '#/components/schemas/AssetHolding' } }
                    }
                  }
                }
              }
            },
            '400': {
              description: 'Invalid Algorand address',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
            },
            '500': {
              description: 'Unable to fetch assets from Algorand node',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
            }
          }
        }
      },

      '/api/algorand/transactions/{address}': {
        get: {
          tags: ['Algorand'],
          operationId: 'getAlgorandTransactions',
          summary: 'Get recent transactions for an address',
          description: 'Returns the last 35 transactions for the given Algorand address, fetched from the Algonode indexer. Each transaction is normalized to a consistent shape.',
          parameters: [
            {
              name: 'address',
              in: 'path',
              required: true,
              description: 'Algorand account address',
              schema: { type: 'string', example: 'TEK5RKWGNATWM2XDLDINNFIXWGHO5ZF5PPO4W3J56OGLSQKLPFFTY2RKZ4' }
            }
          ],
          responses: {
            '200': {
              description: 'Transaction list (may be empty if indexer is unavailable)',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    required: ['transactions'],
                    properties: {
                      transactions: {
                        type: 'array',
                        items: {
                          type: 'object',
                          required: ['id', 'sender', 'receiver', 'amount', 'timestamp', 'status', 'txHash', 'explorerUrl', 'network'],
                          properties: {
                            id:          { type: 'string', example: 'ABCDEF1234567890' },
                            sender:      { type: 'string', example: 'TEK5RKWGNATWM2XDLDINNFIXWGHO5ZF5PPO4W3J56OGLSQKLPFFTY2RKZ4' },
                            receiver:    { type: 'string', example: '6XPKERRH7SRNUUOULNHEGJENORE2Y537ZDYTUA5O4TRIGXRZQ5ML6LMXLY' },
                            amount:      { type: 'number', example: 1.5 },
                            timestamp:   { type: 'string', format: 'date-time', example: '2026-08-23T10:00:00.000Z' },
                            status:      { type: 'string', example: 'confirmed' },
                            txHash:      { type: 'string', example: 'ABCDEF1234567890' },
                            explorerUrl: { type: 'string', example: 'https://testnet.explorer.perawallet.app/tx/ABCDEF1234567890' },
                            network:     { type: 'string', enum: ['testnet', 'mainnet'], example: 'testnet' }
                          }
                        }
                      }
                    }
                  }
                }
              }
            },
            '400': {
              description: 'Invalid Algorand address',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
            },
            '500': {
              description: 'Unable to fetch transactions',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
            }
          }
        }
      },

      '/api/algorand/params': {
        get: {
          tags: ['Algorand'],
          operationId: 'getPaymentParams',
          summary: 'Get Algorand transaction parameters for offline construction',
          description: [
            'Returns the minimum Algorand network parameters required to construct and sign',
            'transactions completely offline on the client.',
            '',
            '**Offline flow:**',
            '1. Call `GET /api/algorand/params` while online — cache the response.',
            '2. While offline, build transactions using `genesisId`, `genesisHashB64`,',
            '   `firstValidRound`/`lastValidRound` as the validity window, and `minFee`.',
            '3. If `contractEnabled` is true, build an atomic group of 2 transactions:',
            '   `[payTxn, appCallTxn]`, assign group ID, and sign both.',
            '4. When back online, submit via `POST /api/algorand/send`.',
            '',
            '**Validity window:** `lastValidRound - firstValidRound` rounds.',
            'On Algorand testnet each round is ~3.9 seconds — the default window is',
            '~1000 rounds ≈ 65 minutes. Re-fetch params before the window expires.',
            '',
            '**genesisHashB64:** base64-encoded genesis hash.',
            'Reconstruct as: `new Uint8Array(Buffer.from(genesisHashB64, "base64"))`',
            'when building transactions with algosdk.',
            '',
            '**No secrets are returned by this endpoint.**',
          ].join('\n'),
          responses: {
            '200': {
              description: 'Transaction parameters',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/PaymentParamsResponse' }
                }
              }
            },
            '503': {
              description: 'Algorand node unavailable',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
            }
          }
        }
      },

      '/api/algorand/send': {
        post: {
          tags: ['Algorand'],
          operationId: 'sendAlgoPayment',
          summary: 'Send an ALGO payment',
          description: [
            'Executes an ALGO payment transaction.',
            '',
            '**Three send modes (mutually exclusive):**',
            '',
            '1. **Server-signed** — omit `signedTxnBase64` and `demoMode`. The backend signs using `ALGORAND_SENDER_MNEMONIC`. `sender` must equal the server signer address.',
            '2. **Client-signed** — provide `signedTxnBase64`. The backend validates and broadcasts the pre-signed transaction.',
            '3. **Demo mode** — set `demoMode: true`. Returns a fake txId without broadcasting. Only available when `ALLOW_DEMO_MODE=true`.',
            '',
            '**Identity gate:** When `REQUIRE_IDENTITY_FOR_SEND=true` (default), both sender and receiver wallets must be linked to verified mobile numbers via `/api/identity/verify-mobile`.',
            '',
            '**Contract mode:** When `GHOSTPAY_CONTRACT_APP_ID > 0`, the payment is bundled with a smart-contract app call.',
          ].join('\n'),
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { $ref: '#/components/schemas/SendPaymentRequest' } } }
          },
          responses: {
            '200': {
              description: 'Transaction submitted and confirmed',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/SendPaymentResponse' } } }
            },
            '400': {
              description: 'Validation error — missing field, invalid address, amount out of range, bad timestamp',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
            },
            '403': {
              description: 'Identity gate: sender or receiver wallet is not linked to a verified mobile number',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
            },
            '500': {
              description: 'Transaction failed — insufficient funds, node error, etc.',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
            },
            '503': {
              description: 'MongoDB not configured but `REQUIRE_IDENTITY_FOR_SEND=true`',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
            }
          }
        }
      },

      // ── Identity ───────────────────────────────────────────────────────

      '/api/identity/request-verification': {
        post: {
          tags: ['Identity'],
          operationId: 'requestMobileVerification',
          summary: 'Request an OTP for mobile number verification',
          description: [
            'Generates a 6-digit OTP, stores it in MongoDB with a TTL, and delivers it via SMS (Twilio) or simulates delivery in dev mode.',
            '',
            'The OTP is valid for `OTP_EXPIRY_MINUTES` (default 5 minutes). Only one live OTP per mobile number at a time — repeated calls replace the previous OTP.',
            '',
            'In development when `REVEAL_OTP_IN_RESPONSE=true`, the `devOtpCode` field is included in the response.',
            '',
            '**Requires MongoDB** — returns 503 if `MONGODB_URI` is not configured.',
          ].join('\n'),
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['mobileNumber'],
                  properties: {
                    mobileNumber: { type: 'string', description: 'International phone number', example: '+919876543210' }
                  }
                }
              }
            }
          },
          responses: {
            '200': {
              description: 'OTP sent (or simulated in dev mode)',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/VerificationRequestResponse' } } }
            },
            '400': {
              description: 'Missing or invalid mobileNumber',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
            },
            '503': {
              description: 'MongoDB not configured',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
            }
          }
        }
      },

      '/api/identity/send-sms-otp': {
        post: {
          tags: ['Identity'],
          operationId: 'sendSmsOtp',
          summary: 'Send OTP via SMS (alias for request-verification)',
          description: 'Identical to `POST /api/identity/request-verification`. Provided as an alias for client compatibility.',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['mobileNumber'],
                  properties: {
                    mobileNumber: { type: 'string', example: '+919876543210' }
                  }
                }
              }
            }
          },
          responses: {
            '200': {
              description: 'OTP sent',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/VerificationRequestResponse' } } }
            },
            '400': {
              description: 'Missing or invalid mobileNumber',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
            },
            '503': {
              description: 'MongoDB not configured',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
            }
          }
        }
      },

      '/api/identity/verify-mobile': {
        post: {
          tags: ['Identity'],
          operationId: 'verifyMobileAndLinkWallet',
          summary: 'Verify OTP and link an Algorand wallet to a mobile number',
          description: [
            'Validates the OTP submitted by the user and links the provided Algorand wallet address to the mobile identity.',
            '',
            'Rules:',
            '- OTP must match and must not be expired',
            '- `walletAddress` must be a valid Algorand address',
            '- If this is the first wallet for the mobile number, it becomes the default (primary) wallet',
            '- Duplicate wallet addresses for the same mobile number are silently ignored',
            '- Exactly one wallet is marked as `isDefault` at all times',
            '',
            '**Requires MongoDB**',
          ].join('\n'),
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['mobileNumber', 'otpCode', 'walletAddress'],
                  properties: {
                    mobileNumber:  { type: 'string', example: '+919876543210' },
                    otpCode:       { type: 'string', description: '6-digit OTP', example: '123456' },
                    walletAddress: { type: 'string', description: 'Algorand address to link', example: 'TEK5RKWGNATWM2XDLDINNFIXWGHO5ZF5PPO4W3J56OGLSQKLPFFTY2RKZ4' },
                    walletLabel:   { type: 'string', description: 'Optional human-readable label for this wallet', example: 'My Main Wallet' }
                  }
                }
              }
            }
          },
          responses: {
            '200': {
              description: 'OTP verified — wallet linked to mobile identity',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/MobileIdentityResponse' } } }
            },
            '400': {
              description: 'Missing field, invalid OTP, expired OTP, or invalid Algorand address',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
            },
            '503': {
              description: 'MongoDB not configured',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
            }
          }
        }
      },

      '/api/identity/mobile/{mobileNumber}/wallets': {
        get: {
          tags: ['Identity'],
          operationId: 'getWalletsByMobile',
          summary: 'Get all wallets linked to a mobile number',
          description: [
            'Returns all Algorand wallets linked to the given mobile number, sorted with the primary (default) wallet first.',
            '',
            'Returns an empty wallet list (not 404) if the mobile number is not found.',
            '',
            '**Requires MongoDB**',
          ].join('\n'),
          parameters: [
            {
              name: 'mobileNumber',
              in: 'path',
              required: true,
              description: 'International phone number (URL-encoded)',
              schema: { type: 'string', example: '%2B919876543210' }
            }
          ],
          responses: {
            '200': {
              description: 'Wallet list for the mobile number (may be empty)',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/MobileIdentityResponse' } } }
            },
            '400': {
              description: 'Invalid mobile number format',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
            },
            '503': {
              description: 'MongoDB not configured',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
            }
          }
        }
      },

      '/api/identity/wallet/{walletAddress}': {
        get: {
          tags: ['Identity'],
          operationId: 'getIdentityByWallet',
          summary: 'Reverse-lookup: get mobile identity for an Algorand wallet address',
          description: [
            'Returns the mobile identity (including all linked wallets) associated with the given Algorand address.',
            '',
            'Returns `{ identity: null }` if no mobile identity is linked to this address.',
            '',
            '**Requires MongoDB**',
          ].join('\n'),
          parameters: [
            {
              name: 'walletAddress',
              in: 'path',
              required: true,
              description: 'Algorand account address',
              schema: { type: 'string', example: 'TEK5RKWGNATWM2XDLDINNFIXWGHO5ZF5PPO4W3J56OGLSQKLPFFTY2RKZ4' }
            }
          ],
          responses: {
            '200': {
              description: 'Mobile identity for the wallet (identity is null if not linked)',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    required: ['identity'],
                    properties: {
                      identity: {
                        allOf: [{ $ref: '#/components/schemas/MobileIdentityResponse' }],
                        nullable: true,
                        description: 'Mobile identity linked to this wallet, or null if not linked'
                      } as OpenAPIV3.SchemaObject
                    }
                  }
                }
              }
            },
            '400': {
              description: 'Invalid Algorand address',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
            },
            '503': {
              description: 'MongoDB not configured',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } }
            }
          }
        }
      },

      // ── Accounts ───────────────────────────────────────────────────────

      '/api/accounts': {
        post: {
          tags: ['Accounts'],
          operationId: 'createAccount',
          summary: 'Create a phone → walletId → walletAddress account mapping',
          description: [
            'Creates a new GhostPay account mapping that links a phone number to an application-level walletId and an Algorand wallet address.',
            '',
            'This is a **mapping operation only** — no blockchain transaction is performed and no OTP is required.',
            '',
            'After creation, the account `verified` flag is `false` until the user completes OTP verification via `/api/identity/verify-mobile`.',
            '',
            '**Uniqueness:** `phone`, `walletId`, and `walletAddress` must all be globally unique.',
            '',
            '**Phone normalization:** Phone numbers are normalized to `+<digits>` before storage. `+919876543210` and `919876543210` are treated as the same number.',
            '',
            '**Requires MongoDB.** Optionally protected by `ACCOUNTS_API_KEY`.',
          ].join('\n'),
          security: [
            { BearerApiKey: [] },
            { XApiKey: [] }
          ],
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateAccountRequest' } } }
          },
          responses: {
            '201': {
              description: 'Account created',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/AccountResponse' } } }
            },
            '400': {
              description: 'Validation error — missing or invalid field',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/AccountErrorResponse' } } }
            },
            '401': {
              description: 'API key required but not provided or incorrect',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/AccountErrorResponse' } } }
            },
            '409': {
              description: 'Duplicate phone, walletId, or walletAddress',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/AccountErrorResponse' } } }
            },
            '500': {
              description: 'Internal server error',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/AccountErrorResponse' } } }
            },
            '503': {
              description: 'MongoDB not configured',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/AccountErrorResponse' } } }
            }
          }
        }
      },

      '/api/accounts/phone/{phone}': {
        get: {
          tags: ['Accounts'],
          operationId: 'getAccountByPhone',
          summary: 'Resolve account by phone number',
          description: [
            'Returns the account and primary wallet mapping for the given phone number.',
            '',
            'Phone numbers are normalized before querying — `+919876543210` and `919876543210` resolve to the same account.',
            '',
            'URL-encode the `+` sign: use `%2B919876543210` in the path.',
            '',
            '**Requires MongoDB.** Optionally protected by `ACCOUNTS_API_KEY`.',
          ].join('\n'),
          security: [
            { BearerApiKey: [] },
            { XApiKey: [] }
          ],
          parameters: [
            {
              name: 'phone',
              in: 'path',
              required: true,
              description: 'International phone number (URL-encoded). Example: `%2B919876543210`',
              schema: { type: 'string', example: '%2B919876543210' }
            }
          ],
          responses: {
            '200': {
              description: 'Account found',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/AccountResponse' } } }
            },
            '400': {
              description: 'Invalid phone format',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/AccountErrorResponse' } } }
            },
            '401': {
              description: 'API key required but not provided or incorrect',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/AccountErrorResponse' } } }
            },
            '404': {
              description: 'No account found for this phone number',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/AccountErrorResponse' } } }
            },
            '500': {
              description: 'Internal server error',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/AccountErrorResponse' } } }
            },
            '503': {
              description: 'MongoDB not configured',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/AccountErrorResponse' } } }
            }
          }
        }
      },

      '/api/accounts/wallet/{walletId}': {
        get: {
          tags: ['Accounts'],
          operationId: 'getAccountByWalletId',
          summary: 'Resolve account by walletId',
          description: [
            'Returns the account mapping for the given application-level `walletId`.',
            '',
            'The `walletId` is the GhostPay application identifier — not the Algorand address.',
            '',
            '**Requires MongoDB.** Optionally protected by `ACCOUNTS_API_KEY`.',
          ].join('\n'),
          security: [
            { BearerApiKey: [] },
            { XApiKey: [] }
          ],
          parameters: [
            {
              name: 'walletId',
              in: 'path',
              required: true,
              description: 'Application-level GhostPay wallet identifier',
              schema: { type: 'string', example: 'wallet_lf2k7xyz' }
            }
          ],
          responses: {
            '200': {
              description: 'Account found',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/AccountResponse' } } }
            },
            '400': {
              description: 'Empty or whitespace walletId',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/AccountErrorResponse' } } }
            },
            '401': {
              description: 'API key required but not provided or incorrect',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/AccountErrorResponse' } } }
            },
            '404': {
              description: 'No account found for this walletId',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/AccountErrorResponse' } } }
            },
            '500': {
              description: 'Internal server error',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/AccountErrorResponse' } } }
            },
            '503': {
              description: 'MongoDB not configured',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/AccountErrorResponse' } } }
            }
          }
        }
      }
    }
  };
}
