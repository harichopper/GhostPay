export type TxStatus = 'pending' | 'syncing' | 'confirmed' | 'failed';

export interface GhostTransaction {
  id: string;
  sender: string;
  receiver: string;
  amount: number;
  timestamp: string;
  status: TxStatus;
  signedTxnBase64?: string;
  txHash?: string;
  explorerUrl?: string;
  network?: string;
  contractVerified?: boolean;
  error?: string;
}

export interface SendTxPayload {
  sender: string;
  receiver: string;
  amount: number;
  timestamp: string;
  signedTxnBase64?: string;
  demoMode?: boolean;
}

export interface SendTxResponse {
  txId: string;
  confirmedRound?: number;
  explorerUrl?: string;
  network?: string;
  contractVerified?: boolean;
}

export interface NetworkInfoResponse {
  network: 'testnet' | 'mainnet';
  explorerTxBaseUrl: string;
  demoModeAllowed: boolean;
  signerAddress: string;
  contractAppId: number;
  contractEnabled: boolean;
}

export interface AccountAsset {
  assetId: number;
  name: string;
  unitName: string;
  amount: number;
  decimals: number;
  isAlgo: boolean;
}

export interface MintAssetPayload {
  assetName?: string;
  unitName?: string;
  total?: number;
  decimals?: number;
  assetUrl?: string;
  senderAddress?: string;
  signedTxnBase64?: string;
}

export interface MintAssetResponse {
  txId: string;
  assetId?: number;
  creator: string;
  explorerUrl: string;
  network: string;
}

export interface WalletIdentityItem {
  address: string;
  label?: string;
  isDefault: boolean;
  verifiedAt: string;
  addedAt: string;
}

export interface WalletLookupResponse {
  mobileNumber: string;
  verified: boolean;
  wallets: WalletIdentityItem[];
}

export interface VerificationRequestResponse {
  mobileNumber: string;
  verificationSent: boolean;
  expiresInSeconds: number;
  devOtpCode?: string;
}

export interface WalletIdentityResponse {
  identity: {
    mobileNumber: string;
    verified: boolean;
    wallets: WalletIdentityItem[];
  } | null;
}
