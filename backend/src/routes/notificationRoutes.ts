import { Router } from 'express';
import { isMongoConfigured } from '../db/mongo.js';
import { NotificationModel } from '../models/Notification.js';

export const notificationRouter = Router();

/**
 * GET /api/notifications/:walletAddress
 * Get all stored notifications for a wallet from MongoDB
 */
notificationRouter.get('/:walletAddress', async (request, response) => {
  try {
    const { walletAddress } = request.params;
    if (!walletAddress) {
      response.status(400).json({ error: 'walletAddress parameter is required' });
      return;
    }

    if (!isMongoConfigured()) {
      response.json({ notifications: [] });
      return;
    }

    let notifications = await NotificationModel.find({ walletAddress }).sort({ createdAt: -1 });

    // Seed default welcome notification if user has 0 notifications in DB
    if (notifications.length === 0) {
      const initialNotif = await NotificationModel.create({
        walletAddress,
        type: 'system',
        title: 'GhostPay Vault Connected',
        message: 'Your wallet is connected to Algorand Testnet with Zero-Data privacy enabled.',
        time: 'Just now',
        isUnread: true
      });
      notifications = [initialNotif];
    }

    response.json({ notifications });
  } catch (error) {
    response.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to fetch notifications'
    });
  }
});

/**
 * POST /api/notifications
 * Save a new notification entry into MongoDB
 */
notificationRouter.post('/', async (request, response) => {
  try {
    const { walletAddress, type, title, message, time } = request.body as {
      walletAddress?: string;
      type?: 'payment' | 'system' | 'security' | 'reward';
      title?: string;
      message?: string;
      time?: string;
    };

    if (!walletAddress || !title || !message) {
      response.status(400).json({ error: 'walletAddress, title, and message are required' });
      return;
    }

    if (!isMongoConfigured()) {
      response.status(503).json({ error: 'MongoDB is not configured' });
      return;
    }

    const created = await NotificationModel.create({
      walletAddress,
      type: type || 'system',
      title,
      message,
      time: time || 'Just now',
      isUnread: true
    });

    response.status(201).json({ notification: created });
  } catch (error) {
    response.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to create notification'
    });
  }
});

/**
 * PATCH /api/notifications/:id/read
 * Mark notification as read
 */
notificationRouter.patch('/:id/read', async (request, response) => {
  try {
    const { id } = request.params;
    if (!isMongoConfigured()) {
      response.json({ success: true });
      return;
    }

    await NotificationModel.findByIdAndUpdate(id, { isUnread: false });
    response.json({ success: true });
  } catch (error) {
    response.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to update notification'
    });
  }
});

/**
 * DELETE /api/notifications/:walletAddress
 * Clear all notifications for a wallet address
 */
notificationRouter.delete('/:walletAddress', async (request, response) => {
  try {
    const { walletAddress } = request.params;
    if (!isMongoConfigured()) {
      response.json({ success: true });
      return;
    }

    await NotificationModel.deleteMany({ walletAddress });
    response.json({ success: true });
  } catch (error) {
    response.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to delete notifications'
    });
  }
});
