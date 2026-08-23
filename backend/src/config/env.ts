import dotenv from 'dotenv';

dotenv.config();

export type AlgorandNetwork = 'testnet' | 'mainnet';
export type SmsProvider = 'none' | 'twilio';

function parseNetwork(value: string | undefined): AlgorandNetwork {
  return value?.toLowerCase() === 'mainnet' ? 'mainnet' : 'testnet';
}

function parsePositiveNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseSmsProvider(value: string | undefined): SmsProvider {
  return value?.toLowerCase() === 'twilio' ? 'twilio' : 'none';
}

const algorandNetwork = parseNetwork(process.env.ALGORAND_NETWORK);
const isProduction = process.env.NODE_ENV === 'production';
const smsProvider = parseSmsProvider(process.env.SMS_PROVIDER);

const defaultAlgodServer =
  algorandNetwork === 'mainnet' ? 'https://mainnet-api.algonode.cloud' : 'https://testnet-api.algonode.cloud';

const defaultExplorerTxBaseUrl =
  algorandNetwork === 'mainnet'
    ? 'https://explorer.perawallet.app/tx/'
    : 'https://testnet.explorer.perawallet.app/tx/';

export const env = {
  port: Number(process.env.PORT ?? 4000),
  corsOrigin: process.env.CORS_ORIGIN ?? '*',
  mongodbUri: process.env.MONGODB_URI ?? '',
  mongodbDbName: process.env.MONGODB_DB_NAME ?? 'ghostpay',
  otpExpiryMinutes: parsePositiveNumber(process.env.OTP_EXPIRY_MINUTES, 5),
  revealOtpInResponse: !isProduction && process.env.REVEAL_OTP_IN_RESPONSE !== 'false',
  smsProvider,
  twilioAccountSid: process.env.TWILIO_ACCOUNT_SID ?? '',
  twilioAuthToken: process.env.TWILIO_AUTH_TOKEN ?? '',
  twilioApiKeySid: process.env.TWILIO_API_KEY_SID ?? '',
  twilioApiKeySecret: process.env.TWILIO_API_KEY_SECRET ?? '',
  twilioFromNumber: process.env.TWILIO_FROM_NUMBER ?? '',
  otpMessageTemplate:
    process.env.OTP_MESSAGE_TEMPLATE ??
    'Your GhostPay verification code is {{OTP}}. It expires in {{MINUTES}} minutes.',
  algorandNetwork,
  algodServer: process.env.ALGORAND_ALGOD_SERVER ?? defaultAlgodServer,
  algodPort: process.env.ALGORAND_ALGOD_PORT ?? '',
  algodToken: process.env.ALGORAND_ALGOD_TOKEN ?? '',
  explorerTxBaseUrl: process.env.ALGORAND_EXPLORER_TX_BASE_URL ?? defaultExplorerTxBaseUrl,
  signerMnemonic: process.env.ALGORAND_SENDER_MNEMONIC ?? '',
  allowDemoMode: !isProduction && process.env.ALLOW_DEMO_MODE !== 'false',
  maxAlgoPerTx: parsePositiveNumber(process.env.MAX_ALGO_PER_TX, 1000),
  confirmationRounds: parsePositiveNumber(process.env.CONFIRMATION_ROUNDS, 6),
  contractAppId: Number(process.env.GHOSTPAY_CONTRACT_APP_ID ?? 0),
  enforceContract: process.env.ENFORCE_CONTRACT === 'true',
  requireIdentityForSend: process.env.REQUIRE_IDENTITY_FOR_SEND !== 'false',
  // x402 account mapping — set to a strong secret in production; leave empty for open dev access
  accountsApiKey: process.env.ACCOUNTS_API_KEY ?? '',
  // x402 payment protocol — GoPlausible facilitator URL
  x402FacilitatorUrl: process.env.X402_FACILITATOR_URL ?? 'https://facilitator.goplausible.xyz',
  // x402 payTo address — Algorand address that receives USDC micropayments
  // Defaults to the signer wallet. Set X402_PAY_TO in .env to use a separate treasury wallet.
  x402PayTo: process.env.X402_PAY_TO ?? '',
  // x402 network — CAIP-2 identifier (defaults to Algorand Testnet)
  x402Network: process.env.X402_NETWORK ?? '',
  // x402 asset — USDC ASA ID (testnet: 10458941, mainnet: 31566704)
  x402Asset: process.env.X402_ASSET ?? '',
  // x402 price in USD cents for security analysis (default: 10 = $0.10)
  x402PriceCents: parsePositiveNumber(process.env.X402_PRICE_CENTS, 10)
};
