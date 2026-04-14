import algosdk from 'algosdk';
import { API_BASE_URL } from '../config/env';
import type {
  AccountAsset,
  MintAssetPayload,
  MintAssetResponse,
  NetworkInfoResponse,
  SendTxPayload,
  SendTxResponse,
  VerificationRequestResponse,
  WalletIdentityResponse,
  WalletLookupResponse
} from '../types/transaction';

async function parseApiResponse<T>(response: Response): Promise<T> {
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error ?? 'Unexpected API error');
  }

  return data as T;
}

export async function sendTransactionToAlgorand(payload: SendTxPayload): Promise<SendTxResponse> {
  if (!algosdk.isValidAddress(payload.receiver)) {
    throw new Error('Receiver address is not a valid Algorand address');
  }

  const response = await fetch(`${API_BASE_URL}/api/algorand/send`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  return parseApiResponse<SendTxResponse>(response);
}

export async function fetchBalanceFromApi(address: string): Promise<number> {
  const response = await fetch(`${API_BASE_URL}/api/algorand/balance/${address}`);
  const data = await parseApiResponse<{ balanceAlgo: number }>(response);
  return data.balanceAlgo;
}

export async function fetchAccountAssets(address: string): Promise<AccountAsset[]> {
  const response = await fetch(`${API_BASE_URL}/api/algorand/assets/${address}`);
  const data = await parseApiResponse<{ assets: AccountAsset[] }>(response);
  return data.assets;
}

export async function mintTestAsset(payload: MintAssetPayload): Promise<MintAssetResponse> {
  const response = await fetch(`${API_BASE_URL}/api/algorand/mint`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  return parseApiResponse<MintAssetResponse>(response);
}

export async function fetchBackendSignerAddress(): Promise<string> {
  const response = await fetch(`${API_BASE_URL}/api/algorand/signer`);
  const data = await parseApiResponse<{ signerAddress: string }>(response);
  return data.signerAddress;
}

export async function fetchNetworkInfo(): Promise<NetworkInfoResponse> {
  const response = await fetch(`${API_BASE_URL}/api/algorand/network`);
  return parseApiResponse<NetworkInfoResponse>(response);
}

export async function requestMobileVerification(mobileNumber: string): Promise<VerificationRequestResponse> {
  const response = await fetch(`${API_BASE_URL}/api/identity/request-verification`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ mobileNumber })
  });

  return parseApiResponse<VerificationRequestResponse>(response);
}

export async function verifyMobileAndLinkWallet(input: {
  mobileNumber: string;
  otpCode: string;
  walletAddress: string;
  walletLabel?: string;
}): Promise<WalletLookupResponse> {
  const response = await fetch(`${API_BASE_URL}/api/identity/verify-mobile`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(input)
  });

  return parseApiResponse<WalletLookupResponse>(response);
}

export async function lookupWalletsByMobile(mobileNumber: string): Promise<WalletLookupResponse> {
  const encoded = encodeURIComponent(mobileNumber);
  const response = await fetch(`${API_BASE_URL}/api/identity/mobile/${encoded}/wallets`);
  return parseApiResponse<WalletLookupResponse>(response);
}

export async function lookupIdentityByWallet(walletAddress: string): Promise<WalletIdentityResponse> {
  const encoded = encodeURIComponent(walletAddress);
  const response = await fetch(`${API_BASE_URL}/api/identity/wallet/${encoded}`);
  return parseApiResponse<WalletIdentityResponse>(response);
}
