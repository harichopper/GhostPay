import { Schema, model, Document } from 'mongoose';

export interface INotification extends Document {
  walletAddress: string;
  type: 'payment' | 'system' | 'security' | 'reward';
  title: string;
  message: string;
  time?: string;
  isUnread: boolean;
  createdAt: Date;
}

const NotificationSchema = new Schema<INotification>({
  walletAddress: { type: String, required: true, index: true },
  type: { type: String, required: true, enum: ['payment', 'system', 'security', 'reward'], default: 'system' },
  title: { type: String, required: true },
  message: { type: String, required: true },
  time: { type: String },
  isUnread: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

export const NotificationModel = model<INotification>('Notification', NotificationSchema);
