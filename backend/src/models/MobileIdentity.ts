import mongoose, { Schema } from 'mongoose';

export interface WalletLink {
  address: string;
  label?: string;
  isDefault: boolean;
  verifiedAt: Date;
  addedAt: Date;
}

export interface MobileIdentity {
  mobileNumber: string;
  wallets: WalletLink[];
  verified: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const walletSchema = new Schema<WalletLink>(
  {
    address: { type: String, required: true },
    label: { type: String },
    isDefault: { type: Boolean, default: false },
    verifiedAt: { type: Date, required: true },
    addedAt: { type: Date, required: true }
  },
  { _id: false }
);

const mobileIdentitySchema = new Schema<MobileIdentity>(
  {
    mobileNumber: { type: String, required: true, unique: true, index: true },
    wallets: { type: [walletSchema], default: [] },
    verified: { type: Boolean, default: true }
  },
  {
    timestamps: true
  }
);

export const MobileIdentityModel =
  mongoose.models.MobileIdentity || mongoose.model<MobileIdentity>('MobileIdentity', mobileIdentitySchema);
