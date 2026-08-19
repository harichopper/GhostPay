/**
 * accountService.test.ts
 *
 * Unit tests for the account-mapping service layer.
 * MongoDB is mocked — no live connection required.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mock env BEFORE importing anything that reads it
// ---------------------------------------------------------------------------
vi.mock('../config/env.js', () => ({
  env: {
    algorandNetwork: 'testnet',
    accountsApiKey: ''
  }
}));

// ---------------------------------------------------------------------------
// Mock MobileIdentityModel
// ---------------------------------------------------------------------------
const mockFindOne = vi.fn();
const mockCreate = vi.fn();

vi.mock('../models/MobileIdentity.js', () => ({
  MobileIdentityModel: {
    findOne: (...args: unknown[]) => mockFindOne(...args),
    create: (...args: unknown[]) => mockCreate(...args)
  }
}));

// ---------------------------------------------------------------------------
// Mock identityService only for normalizeMobileNumber and generators
// (the real normalizeMobileNumber is tested separately)
// ---------------------------------------------------------------------------
vi.mock('../services/identityService.js', () => ({
  normalizeMobileNumber: (input: string) => {
    const digits = input.replace(/\D/g, '');
    if (digits.length < 8 || digits.length > 15) {
      throw new Error('Mobile number must contain between 8 and 15 digits');
    }
    return `+${digits}`;
  },
  generateAccountId: () => 'acct_test123',
  generateWalletId: () => 'wallet_test456'
}));

import { createAccount, getAccountByPhone, getAccountByWalletId } from '../services/accountService.js';

// A valid Algorand testnet address (58-char base32)
const VALID_ADDRESS = 'TEK5RKWGNATWM2XDLDINNFIXWGHO5ZF5PPO4W3J56OGLSQKLPFFTY2RKZ4';
// Use algosdk pattern: 58 chars, A-Z2-7
const REAL_VALID_ADDRESS = 'A'.repeat(58);

// Use a properly valid address from algosdk
const ALGORAND_VALID_ADDRESS = 'TEK5RKWGNATWM2XDLDINNFIXWGHO5ZF5PPO4W3J56OGLSQKLPFFTY2RKZ4';

function resetMocks() {
  mockFindOne.mockReset();
  mockCreate.mockReset();
}

// ---------------------------------------------------------------------------
// createAccount
// ---------------------------------------------------------------------------
describe('createAccount', () => {
  beforeEach(resetMocks);

  it('creates a valid account', async () => {
    mockFindOne.mockResolvedValue(null); // no duplicates
    mockCreate.mockResolvedValue({
      accountId: 'acct_test123',
      mobileNumber: '+919876543210',
      status: 'active',
      wallets: [
        {
          walletId: 'wallet_abc',
          address: ALGORAND_VALID_ADDRESS,
          network: 'testnet',
          isDefault: true
        }
      ]
    });

    const result = await createAccount({
      phone: '+919876543210',
      walletId: 'wallet_abc',
      walletAddress: ALGORAND_VALID_ADDRESS,
      network: 'testnet'
    });

    expect(result.accountId).toBe('acct_test123');
    expect(result.phone).toBe('+919876543210');
    expect(result.walletId).toBe('wallet_abc');
    expect(result.walletAddress).toBe(ALGORAND_VALID_ADDRESS);
    expect(result.network).toBe('testnet');
    expect(result.status).toBe('active');
  });

  it('rejects when phone is missing', async () => {
    await expect(createAccount({
      walletId: 'wallet_abc',
      walletAddress: ALGORAND_VALID_ADDRESS,
      network: 'testnet'
    })).rejects.toMatchObject({ code: 'VALIDATION_ERROR', message: expect.stringContaining('phone') });
  });

  it('rejects when phone format is invalid (too short)', async () => {
    await expect(createAccount({
      phone: '+123',
      walletId: 'wallet_abc',
      walletAddress: ALGORAND_VALID_ADDRESS,
      network: 'testnet'
    })).rejects.toMatchObject({ code: 'VALIDATION_ERROR', field: 'phone' });
  });

  it('rejects when walletId is missing', async () => {
    await expect(createAccount({
      phone: '+919876543210',
      walletAddress: ALGORAND_VALID_ADDRESS,
      network: 'testnet'
    })).rejects.toMatchObject({ code: 'VALIDATION_ERROR', field: 'walletId' });
  });

  it('rejects when walletAddress is missing', async () => {
    await expect(createAccount({
      phone: '+919876543210',
      walletId: 'wallet_abc',
      network: 'testnet'
    })).rejects.toMatchObject({ code: 'VALIDATION_ERROR', field: 'walletAddress' });
  });

  it('rejects when walletAddress is not a valid Algorand address', async () => {
    await expect(createAccount({
      phone: '+919876543210',
      walletId: 'wallet_abc',
      walletAddress: 'not-a-real-address',
      network: 'testnet'
    })).rejects.toMatchObject({ code: 'VALIDATION_ERROR', field: 'walletAddress' });
  });

  it('rejects when network is missing', async () => {
    await expect(createAccount({
      phone: '+919876543210',
      walletId: 'wallet_abc',
      walletAddress: ALGORAND_VALID_ADDRESS
    })).rejects.toMatchObject({ code: 'VALIDATION_ERROR', field: 'network' });
  });

  it('rejects when network is not supported', async () => {
    await expect(createAccount({
      phone: '+919876543210',
      walletId: 'wallet_abc',
      walletAddress: ALGORAND_VALID_ADDRESS,
      network: 'rinkeby'
    })).rejects.toMatchObject({ code: 'VALIDATION_ERROR', field: 'network' });
  });

  it('returns ACCOUNT_EXISTS when phone is already registered', async () => {
    // First findOne (by phone) returns an existing doc
    mockFindOne.mockResolvedValueOnce({ mobileNumber: '+919876543210' });

    await expect(createAccount({
      phone: '+919876543210',
      walletId: 'wallet_new',
      walletAddress: ALGORAND_VALID_ADDRESS,
      network: 'testnet'
    })).rejects.toMatchObject({ code: 'ACCOUNT_EXISTS' });
  });

  it('returns WALLET_ID_EXISTS when walletId is already registered', async () => {
    mockFindOne
      .mockResolvedValueOnce(null)                                          // phone check: no duplicate
      .mockResolvedValueOnce({ 'wallets.walletId': 'wallet_abc' });        // walletId check: exists

    await expect(createAccount({
      phone: '+911111111111',
      walletId: 'wallet_abc',
      walletAddress: ALGORAND_VALID_ADDRESS,
      network: 'testnet'
    })).rejects.toMatchObject({ code: 'WALLET_ID_EXISTS' });
  });

  it('returns WALLET_ADDRESS_EXISTS when walletAddress is already registered', async () => {
    mockFindOne
      .mockResolvedValueOnce(null)   // phone check
      .mockResolvedValueOnce(null)   // walletId check
      .mockResolvedValueOnce({ 'wallets.address': ALGORAND_VALID_ADDRESS }); // address check

    await expect(createAccount({
      phone: '+912222222222',
      walletId: 'wallet_new',
      walletAddress: ALGORAND_VALID_ADDRESS,
      network: 'testnet'
    })).rejects.toMatchObject({ code: 'WALLET_ADDRESS_EXISTS' });
  });

  it('normalizes phone number before duplicate check (+91 vs 91)', async () => {
    mockFindOne.mockResolvedValueOnce({ mobileNumber: '+919876543210' });

    // Both raw inputs normalize to +919876543210
    await expect(createAccount({
      phone: '919876543210', // without leading +
      walletId: 'wallet_x',
      walletAddress: ALGORAND_VALID_ADDRESS,
      network: 'testnet'
    })).rejects.toMatchObject({ code: 'ACCOUNT_EXISTS' });
  });
});

// ---------------------------------------------------------------------------
// getAccountByPhone
// ---------------------------------------------------------------------------
describe('getAccountByPhone', () => {
  beforeEach(resetMocks);

  it('returns account for existing phone', async () => {
    mockFindOne.mockResolvedValueOnce({
      accountId: 'acct_xyz',
      mobileNumber: '+919876543210',
      status: 'active',
      wallets: [{
        walletId: 'wallet_abc',
        address: ALGORAND_VALID_ADDRESS,
        network: 'testnet',
        isDefault: true
      }]
    });

    const result = await getAccountByPhone('+919876543210');
    expect(result).not.toBeNull();
    expect(result?.accountId).toBe('acct_xyz');
    expect(result?.walletId).toBe('wallet_abc');
    expect(result?.walletAddress).toBe(ALGORAND_VALID_ADDRESS);
  });

  it('returns null for unknown phone', async () => {
    mockFindOne.mockResolvedValueOnce(null);
    const result = await getAccountByPhone('+910000000000');
    expect(result).toBeNull();
  });

  it('normalizes phone before querying', async () => {
    mockFindOne.mockResolvedValueOnce(null);
    // Both forms should normalize to same query
    await getAccountByPhone('919876543210');
    expect(mockFindOne).toHaveBeenCalledWith({ mobileNumber: '+919876543210' });
  });

  it('throws on invalid phone format', async () => {
    await expect(getAccountByPhone('+1')).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------
// getAccountByWalletId
// ---------------------------------------------------------------------------
describe('getAccountByWalletId', () => {
  beforeEach(resetMocks);

  it('returns account for existing walletId', async () => {
    mockFindOne.mockResolvedValueOnce({
      accountId: 'acct_xyz',
      mobileNumber: '+919876543210',
      status: 'active',
      wallets: [{
        walletId: 'wallet_abc',
        address: ALGORAND_VALID_ADDRESS,
        network: 'testnet',
        isDefault: true
      }]
    });

    const result = await getAccountByWalletId('wallet_abc');
    expect(result).not.toBeNull();
    expect(result?.accountId).toBe('acct_xyz');
    expect(result?.phone).toBe('+919876543210');
    expect(result?.walletAddress).toBe(ALGORAND_VALID_ADDRESS);
  });

  it('returns null for unknown walletId', async () => {
    mockFindOne.mockResolvedValueOnce(null);
    const result = await getAccountByWalletId('wallet_unknown');
    expect(result).toBeNull();
  });

  it('returns null for empty walletId', async () => {
    const result = await getAccountByWalletId('   ');
    expect(result).toBeNull();
    expect(mockFindOne).not.toHaveBeenCalled();
  });

  it('returns null for malformed walletId with no match', async () => {
    mockFindOne.mockResolvedValueOnce(null);
    const result = await getAccountByWalletId('!!!invalid-id!!!');
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Consistency: phone → walletId → same account
// ---------------------------------------------------------------------------
describe('bidirectional resolution consistency', () => {
  beforeEach(resetMocks);

  it('phone lookup and walletId lookup resolve to same accountId', async () => {
    const sharedDoc = {
      accountId: 'acct_shared',
      mobileNumber: '+919876543210',
      status: 'active',
      wallets: [{
        walletId: 'wallet_shared',
        address: ALGORAND_VALID_ADDRESS,
        network: 'testnet',
        isDefault: true
      }]
    };

    mockFindOne.mockResolvedValue(sharedDoc);

    const byPhone = await getAccountByPhone('+919876543210');
    const byWallet = await getAccountByWalletId('wallet_shared');

    expect(byPhone?.accountId).toBe('acct_shared');
    expect(byWallet?.accountId).toBe('acct_shared');
    expect(byPhone?.accountId).toBe(byWallet?.accountId);
    expect(byPhone?.walletId).toBe(byWallet?.walletId);
    expect(byPhone?.walletAddress).toBe(byWallet?.walletAddress);
    expect(byPhone?.phone).toBe(byWallet?.phone);
  });
});
