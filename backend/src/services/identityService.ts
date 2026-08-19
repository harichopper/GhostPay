import algosdk from 'algosdk';
import { env } from '../config/env.js';
import { MobileIdentityModel } from '../models/MobileIdentity.js';
import { MobileVerificationModel } from '../models/MobileVerification.js';
import { sendOtpSms } from './smsService.js';

type WalletRecord = {
  walletId: string;
  address: string;
  network: string;
  label?: string;
  isDefault: boolean;
  verifiedAt: Date;
  addedAt: Date;
};

function normalizeSinglePrimaryWallet(wallets: WalletRecord[], preferredAddress?: string) {
  if (wallets.length === 0) {
    return { wallets, changed: false };
  }

  const defaultWallets = wallets.filter((wallet) => wallet.isDefault);
  const preferredExists = Boolean(preferredAddress && wallets.some((wallet) => wallet.address === preferredAddress));

  let primaryAddress = defaultWallets[0]?.address;
  if (defaultWallets.length !== 1) {
    if (preferredExists && preferredAddress) {
      primaryAddress = preferredAddress;
    } else {
      primaryAddress = wallets[0].address;
    }
  }

  const normalized = wallets.map((wallet) => ({
    ...wallet,
    isDefault: wallet.address === primaryAddress
  }));

  const changed = normalized.some((wallet, index) => wallet.isDefault !== wallets[index].isDefault);
  return { wallets: normalized, changed };
}

function toWalletRecords(wallets: Array<{
  walletId: string;
  address: string;
  network: string;
  label?: string;
  isDefault: boolean;
  verifiedAt: Date;
  addedAt: Date;
}>): WalletRecord[] {
  return wallets.map((wallet) => ({
    walletId: wallet.walletId,
    address: wallet.address,
    network: wallet.network,
    label: wallet.label,
    isDefault: Boolean(wallet.isDefault),
    verifiedAt: new Date(wallet.verifiedAt),
    addedAt: new Date(wallet.addedAt)
  }));
}

export function normalizeMobileNumber(input: string): string {
  const digits = input.replace(/\D/g, '');

  if (digits.length < 8 || digits.length > 15) {
    throw new Error('Mobile number must contain between 8 and 15 digits');
  }

  return `+${digits}`;
}

function createOtpCode(): string {
  const value = Math.floor(100000 + Math.random() * 900000);
  return `${value}`;
}

/** Generates a collision-resistant application-level account identifier. */
export function generateAccountId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 9);
  return `acct_${timestamp}${random}`;
}

/** Generates a collision-resistant application-level wallet identifier. */
export function generateWalletId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 9);
  return `wallet_${timestamp}${random}`;
}

export async function requestMobileVerification(mobileNumberRaw: string) {
  const mobileNumber = normalizeMobileNumber(mobileNumberRaw);
  const otpCode = createOtpCode();
  const expiresAt = new Date(Date.now() + env.otpExpiryMinutes * 60_000);

  await MobileVerificationModel.findOneAndUpdate(
    { mobileNumber },
    {
      mobileNumber,
      otpCode,
      expiresAt,
      attempts: 0
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const sms = await sendOtpSms(mobileNumber, otpCode);

  return {
    mobileNumber,
    verificationSent: sms.delivered,
    expiresInSeconds: env.otpExpiryMinutes * 60,
    sms,
    devOtpCode: env.revealOtpInResponse ? otpCode : undefined
  };
}

export async function verifyMobileAndLinkWallet(input: {
  mobileNumberRaw: string;
  otpCode: string;
  walletAddress: string;
  walletLabel?: string;
  walletId?: string;
  network?: string;
}) {
  const mobileNumber = normalizeMobileNumber(input.mobileNumberRaw);
  const otpCode = input.otpCode.trim();
  const walletAddress = input.walletAddress.trim();
  const network = input.network?.trim() || env.algorandNetwork;

  if (!algosdk.isValidAddress(walletAddress)) {
    throw new Error('Wallet address is invalid');
  }

  const verification = await MobileVerificationModel.findOne({ mobileNumber });
  if (!verification) {
    throw new Error('Verification code not found. Request OTP again.');
  }

  if (verification.expiresAt.getTime() < Date.now()) {
    await MobileVerificationModel.deleteOne({ mobileNumber });
    throw new Error('Verification code expired. Request OTP again.');
  }

  if (verification.otpCode !== otpCode) {
    verification.attempts += 1;
    await verification.save();
    throw new Error('Incorrect verification code');
  }

  await MobileVerificationModel.deleteOne({ mobileNumber });

  const now = new Date();

  // Ensure account exists; generate accountId on first creation
  const existingDoc = await MobileIdentityModel.findOne({ mobileNumber }).lean<{
    accountId?: string;
    wallets?: Array<{ address: string; walletId?: string }>;
  } | null>();

  const accountId = existingDoc?.accountId || generateAccountId();
  const isFirstWallet = !existingDoc?.wallets || existingDoc.wallets.length === 0;

  // Derive walletId: use provided one, or carry over existing one for this address, or generate new
  const existingWallet = existingDoc?.wallets?.find((w) => w.address === walletAddress);
  const walletId = input.walletId?.trim() || existingWallet?.walletId || generateWalletId();

  await MobileIdentityModel.updateOne(
    { mobileNumber },
    {
      $setOnInsert: {
        mobileNumber,
        accountId,
        wallets: []
      },
      $set: {
        verified: true
      }
    },
    { upsert: true }
  );

  await MobileIdentityModel.updateOne(
    {
      mobileNumber,
      'wallets.address': { $ne: walletAddress }
    },
    {
      $push: {
        wallets: {
          walletId,
          address: walletAddress,
          network,
          label: input.walletLabel?.trim() || (isFirstWallet ? 'Primary Wallet' : 'Secondary Wallet'),
          isDefault: isFirstWallet,
          verifiedAt: now,
          addedAt: now
        }
      }
    }
  );

  if (input.walletLabel?.trim()) {
    await MobileIdentityModel.updateOne(
      {
        mobileNumber,
        'wallets.address': walletAddress
      },
      {
        $set: {
          'wallets.$.label': input.walletLabel.trim()
        }
      }
    );
  }

  let existing = await MobileIdentityModel.findOne({ mobileNumber });
  if (!existing) {
    throw new Error('Unable to load linked identity after verification');
  }

  const normalizedWallets = normalizeSinglePrimaryWallet(toWalletRecords(existing.wallets), walletAddress);
  if (normalizedWallets.changed) {
    await MobileIdentityModel.updateOne({ mobileNumber }, { $set: { wallets: normalizedWallets.wallets } });
    existing = await MobileIdentityModel.findOne({ mobileNumber });
    if (!existing) {
      throw new Error('Unable to load linked identity after enforcing primary wallet');
    }
  }

  return {
    mobileNumber: existing.mobileNumber,
    verified: true,
    wallets: existing.wallets
  };
}

export async function getWalletsByMobile(mobileNumberRaw: string) {
  const mobileNumber = normalizeMobileNumber(mobileNumberRaw);
  let identity = await MobileIdentityModel.findOne({ mobileNumber });

  if (!identity) {
    return {
      mobileNumber,
      verified: false,
      wallets: []
    };
  }

  const normalizedWallets = normalizeSinglePrimaryWallet(toWalletRecords(identity.wallets));
  if (normalizedWallets.changed) {
    await MobileIdentityModel.updateOne({ mobileNumber }, { $set: { wallets: normalizedWallets.wallets } });
    identity = await MobileIdentityModel.findOne({ mobileNumber });
    if (!identity) {
      throw new Error('Unable to load identity after enforcing primary wallet');
    }
  }

  const wallets = [...identity.wallets].sort((a, b) => Number(b.isDefault) - Number(a.isDefault));

  return {
    mobileNumber,
    verified: identity.verified,
    wallets
  };
}

export async function getIdentityByWallet(walletAddressRaw: string) {
  const walletAddress = walletAddressRaw.trim();
  if (!algosdk.isValidAddress(walletAddress)) {
    throw new Error('Wallet address is invalid');
  }

  let identity = await MobileIdentityModel.findOne({ 'wallets.address': walletAddress });

  if (!identity) {
    return null;
  }

  const normalizedWallets = normalizeSinglePrimaryWallet(toWalletRecords(identity.wallets));
  if (normalizedWallets.changed) {
    await MobileIdentityModel.updateOne(
      { mobileNumber: identity.mobileNumber },
      { $set: { wallets: normalizedWallets.wallets } }
    );
    identity = await MobileIdentityModel.findOne({ 'wallets.address': walletAddress });
    if (!identity) {
      return null;
    }
  }

  return {
    mobileNumber: identity.mobileNumber,
    verified: identity.verified,
    wallets: identity.wallets
  };
}
