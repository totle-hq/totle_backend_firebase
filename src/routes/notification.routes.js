// src/routes/notification.routes.js
import express from "express";
import authMiddleware from "../middlewares/authMiddleware.js";
import NotificationService from "../services/notificationService.js";

const router = express.Router();

// Get user notifications
router.get("/", authMiddleware, async (req, res) => {
  try {
    const { category = 'all', filter = 'all' } = req.query;
    const notifications = await NotificationService.getUserNotifications(
      req.user.id, 
      category, 
      filter
    );
    
    res.json({ success: true, notifications });
  } catch (error) {
    console.error('❌ Get notifications error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get unread counts
router.get("/counts", authMiddleware, async (req, res) => {
  try {
    const counts = await NotificationService.getUnreadCounts(req.user.id);
    res.json({ success: true, counts });
  } catch (error) {
    console.error('❌ Get counts error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Mark notification as read
router.patch("/:id/read", authMiddleware, async (req, res) => {
  try {
    const success = await NotificationService.markAsRead(req.params.id, req.user.id);
    res.json({ success });
  } catch (error) {
    console.error('❌ Mark as read error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Mark all as read
router.patch("/read-all", authMiddleware, async (req, res) => {
  try {
    const { category = 'all' } = req.query;
    const affectedCount = await NotificationService.markAllAsRead(req.user.id, category);
    res.json({ success: true, affectedCount });
  } catch (error) {
    console.error('❌ Mark all as read error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Delete notification
router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const { Notification } = await import("../Models/NotificationModel.js");
    const result = await Notification.destroy({
      where: { id: req.params.id, user_id: req.user.id }
    });
    
    if (result === 0) {
      return res.status(404).json({ success: false, message: "Notification not found" });
    }
    
    res.json({ success: true, message: "Notification deleted" });
  } catch (error) {
    console.error('❌ Delete notification error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

router.patch("/:id/dismiss", authMiddleware, async (req, res) => {
  try {
    const success = await NotificationService.dismissNotification(
      req.params.id,
      req.user.id
    );

    if (!success) {
      return res.status(404).json({
        success: false,
        message: "Notification not found or already dismissed",
      });
    }

    res.json({ success: true });
  } catch (error) {
    console.error("❌ Dismiss notification error:", error);
    res.status(500).json({ success: false });
  }
});


export default router;