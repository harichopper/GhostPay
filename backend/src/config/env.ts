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
  enforceContract: process.env.ENFORCE_CONTRACT === 'true'
};
