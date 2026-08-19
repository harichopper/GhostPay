import mongoose, { Schema } from 'mongoose';

export interface WalletLink {
  walletId: string;       // application-level GhostPay wallet identifier (e.g. "wallet_<nanoid>")
  address: string;        // Algorand account address
  network: string;        // algorand network this wallet belongs to ("testnet" | "mainnet" | "localnet")
  label?: string;
  isDefault: boolean;
  verifiedAt: Date;
  addedAt: Date;
}

export interface MobileIdentity {
  accountId: string;      // stable application-level account identifier (e.g. "acct_<nanoid>")
  mobileNumber: string;
  wallets: WalletLink[];
  verified: boolean;
  status: 'active' | 'suspended';
  createdAt: Date;
  updatedAt: Date;
}

const walletSchema = new Schema<WalletLink>(
  {
    walletId: { type: String, required: true },
    address: { type: String, required: true },
    network: { type: String, required: true, default: 'testnet' },
    label: { type: String },
    isDefault: { type: Boolean, default: false },
    verifiedAt: { type: Date, required: true },
    addedAt: { type: Date, required: true }
  },
  { _id: false }
);

const mobileIdentitySchema = new Schema<MobileIdentity>(
  {
    accountId: { type: String, required: true, unique: true, index: true },
    mobileNumber: { type: String, required: true, unique: true, index: true },
    wallets: { type: [walletSchema], default: [] },
    verified: { type: Boolean, default: true },
    status: { type: String, enum: ['active', 'suspended'], default: 'active' }
  },
  {
    timestamps: true
  }
);

// Compound index: fast lookup by walletId across all wallet sub-documents
mobileIdentitySchema.index({ 'wallets.walletId': 1 }, { unique: true, sparse: true });
// Fast lookup by Algorand address across all wallet sub-documents
mobileIdentitySchema.index({ 'wallets.address': 1 });

export const MobileIdentityModel =
  mongoose.models.MobileIdentity || mongoose.model<MobileIdentity>('MobileIdentity', mobileIdentitySchema);
