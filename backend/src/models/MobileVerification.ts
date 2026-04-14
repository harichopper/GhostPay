import mongoose, { Schema } from 'mongoose';

export interface MobileVerification {
  mobileNumber: string;
  otpCode: string;
  expiresAt: Date;
  attempts: number;
  createdAt: Date;
  updatedAt: Date;
}

const mobileVerificationSchema = new Schema<MobileVerification>(
  {
    mobileNumber: { type: String, required: true, unique: true, index: true },
    otpCode: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    attempts: { type: Number, default: 0 }
  },
  {
    timestamps: true
  }
);

mobileVerificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const MobileVerificationModel =
  mongoose.models.MobileVerification || mongoose.model<MobileVerification>('MobileVerification', mobileVerificationSchema);
