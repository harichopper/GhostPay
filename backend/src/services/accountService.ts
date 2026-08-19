/**
 * accountService.ts
 *
 * Backend account-mapping layer for GhostPay's Algorand x402 integration.
 *
 * Provides deterministic, database-backed resolution of:
 *   Phone ↔ Account ↔ WalletId ↔ Algorand Wallet Address
 *
 * Built on top of the existing MobileIdentity collection — no duplicate model is created.
 */

import algosdk from 'algosdk';
import { env } from '../config/env.js';
import { MobileIdentityModel } from '../models/MobileIdentity.js';
import { generateAccountId, normalizeMobileNumber } from './identityService.js';

export type SupportedNetwork = 'testnet' | 'mainnet' | 'localnet';

const SUPPORTED_NETWORKS: SupportedNetwork[] = ['testnet', 'mainnet', 'localnet'];

export function isSupportedNetwork(value: string): value is SupportedNetwork {
  return SUPPORTED_NETWORKS.includes(value as SupportedNetwork);
}

/**
 * Safe public account view — never includes private key material.
 */
export type AccountView = {
  accountId: string;
  phone: string;
  walletId: string;
  walletAddress: string;
  network: SupportedNetwork;
  status: 'active' | 'suspended';
};

/**
 * Validate input for account creation.
 * Returns null on success, or a descriptive error string.
 */
function validateCreateAccountInput(input: {
  phone?: unknown;
  walletId?: unknown;
  walletAddress?: unknown;
  network?: unknown;
}): { field: string; message: string } | null {
  // phone
  if (!input.phone || typeof input.phone !== 'string' || !input.phone.trim()) {
    return { field: 'phone', message: 'phone is required' };
  }

  // phone format — delegate to existing normalizer which validates digit count
  try {
    normalizeMobileNumber(input.phone);
  } catch {
    return { field: 'phone', message: 'phone format is invalid. Provide a valid international phone number (e.g. +919XXXXXXXXX)' };
  }

  // walletId
  if (!input.walletId || typeof input.walletId !== 'string' || !input.walletId.trim()) {
    return { field: 'walletId', message: 'walletId is required' };
  }

  // walletAddress
  if (!input.walletAddress || typeof input.walletAddress !== 'string' || !input.walletAddress.trim()) {
    return { field: 'walletAddress', message: 'walletAddress is required' };
  }

  if (!algosdk.isValidAddress(input.walletAddress.trim())) {
    return { field: 'walletAddress', message: 'walletAddress is not a valid Algorand address' };
  }

  // network
  if (!input.network || typeof input.network !== 'string' || !input.network.trim()) {
    return { field: 'network', message: 'network is required. Supported values: testnet, mainnet, localnet' };
  }

  if (!isSupportedNetwork(input.network.trim().toLowerCase())) {
    return { field: 'network', message: `network "${input.network}" is not supported. Supported values: testnet, mainnet, localnet` };
  }

  return null;
}

/**
 * Creates a new GhostPay account mapping:
 *   phone → accountId → walletId → walletAddress
 *
 * This is an account-mapping operation only — no blockchain transaction is performed.
 *
 * Throws structured errors for:
 * - VALIDATION_ERROR  — missing or invalid input
 * - ACCOUNT_EXISTS    — phone already has an account
 * - WALLET_ID_EXISTS  — walletId already mapped to a different account
 * - WALLET_ADDRESS_EXISTS — walletAddress already mapped
 */
export async function createAccount(input: {
  phone?: unknown;
  walletId?: unknown;
  walletAddress?: unknown;
  network?: unknown;
}): Promise<AccountView> {
  // --- Validate inputs ---
  const validationError = validateCreateAccountInput(input);
  if (validationError) {
    const err = Object.assign(new Error(validationError.message), {
      code: 'VALIDATION_ERROR',
      field: validationError.field
    });
    throw err;
  }

  const phone = normalizeMobileNumber(input.phone as string);
  const walletId = (input.walletId as string).trim();
  const walletAddress = (input.walletAddress as string).trim();
  const network = (input.network as string).trim().toLowerCase() as SupportedNetwork;

  // --- Duplicate checks ---

  // 1. Phone already has an account
  const existingByPhone = await MobileIdentityModel.findOne({ mobileNumber: phone });
  if (existingByPhone) {
    const err = Object.assign(
      new Error('An account already exists for this phone number.'),
      { code: 'ACCOUNT_EXISTS' }
    );
    throw err;
  }

  // 2. walletId already in use
  const existingByWalletId = await MobileIdentityModel.findOne({ 'wallets.walletId': walletId });
  if (existingByWalletId) {
    const err = Object.assign(
      new Error('This walletId is already associated with another account.'),
      { code: 'WALLET_ID_EXISTS' }
    );
    throw err;
  }

  // 3. walletAddress already in use (an Algorand address can only map to one account)
  const existingByAddress = await MobileIdentityModel.findOne({ 'wallets.address': walletAddress });
  if (existingByAddress) {
    const err = Object.assign(
      new Error('This wallet address is already associated with another account.'),
      { code: 'WALLET_ADDRESS_EXISTS' }
    );
    throw err;
  }

  // --- Create account ---
  const accountId = generateAccountId();
  const now = new Date();

  const doc = await MobileIdentityModel.create({
    accountId,
    mobileNumber: phone,
    verified: false,   // account created but not OTP-verified yet
    status: 'active',
    wallets: [
      {
        walletId,
        address: walletAddress,
        network,
        label: 'Primary Wallet',
        isDefault: true,
        verifiedAt: now,
        addedAt: now
      }
    ]
  });

  return {
    accountId: doc.accountId,
    phone: doc.mobileNumber,
    walletId,
    walletAddress,
    network,
    status: doc.status
  };
}

/**
 * Retrieves an account by phone number.
 * Returns the primary wallet mapping.
 */
export async function getAccountByPhone(phoneRaw: string): Promise<AccountView | null> {
  const phone = normalizeMobileNumber(phoneRaw);
  const doc = await MobileIdentityModel.findOne({ mobileNumber: phone });
  if (!doc) {
    return null;
  }

  const primaryWallet = doc.wallets.find((w: { isDefault: boolean }) => w.isDefault) ?? doc.wallets[0];
  if (!primaryWallet) {
    return null;
  }

  return {
    accountId: doc.accountId,
    phone: doc.mobileNumber,
    walletId: primaryWallet.walletId,
    walletAddress: primaryWallet.address,
    network: isSupportedNetwork(primaryWallet.network) ? primaryWallet.network : env.algorandNetwork as SupportedNetwork,
    status: doc.status
  };
}

/**
 * Retrieves an account by application-level walletId.
 * Returns the account and the specific wallet matching the ID.
 */
export async function getAccountByWalletId(walletId: string): Promise<AccountView | null> {
  const trimmed = walletId.trim();
  if (!trimmed) {
    return null;
  }

  const doc = await MobileIdentityModel.findOne({ 'wallets.walletId': trimmed });
  if (!doc) {
    return null;
  }

  const wallet = doc.wallets.find((w: { walletId: string }) => w.walletId === trimmed);
  if (!wallet) {
    return null;
  }

  return {
    accountId: doc.accountId,
    phone: doc.mobileNumber,
    walletId: wallet.walletId,
    walletAddress: wallet.address,
    network: isSupportedNetwork(wallet.network) ? wallet.network : env.algorandNetwork as SupportedNetwork,
    status: doc.status
  };
}
