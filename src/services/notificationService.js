// src/services/notificationService.js
import { Notification } from "../Models/NotificationModel.js";
import { User } from "../Models/UserModels/UserModel.js";
import { sequelize1 } from "../config/sequelize.js";

class NotificationService {
  // Create session booking notifications for both learner and teacher
  static async createSessionBookingNotification(sessionData) {
    const { sessionId, learnerId, teacherId, topicName, scheduledAt, sessionType } = sessionData;
    
    try {
      const [learner, teacher] = await Promise.all([
        User.findByPk(learnerId, { attributes: ['firstName', 'lastName'] }),
        User.findByPk(teacherId, { attributes: ['firstName', 'lastName'] })
      ]);

      const learnerName = learner ? `${learner.firstName} ${learner.lastName || ''}`.trim() : 'Student';
      const teacherName = teacher ? `${teacher.firstName} ${teacher.lastName || ''}`.trim() : 'Teacher';

      // Notification for LEARNER
      const learnerNotification = {
        user_id: learnerId,
        title: "Session Booked! 🎉",
        message: `Your ${sessionType} session on "${topicName}" with ${teacherName} has been confirmed`,
        type: "session_booking",
        category: "learn",
        priority: "high",
        data: {
          sessionId,
          teacherId,
          teacherName,
          topicName,
          scheduledAt,
          sessionType,
          action: {
            label: "View Session",
            callback: `/learn/my-session`
          }
        }
      };

      // Notification for TEACHER
      const teacherNotification = {
        user_id: teacherId,
        title: "New Session Booked! 📚",
        message: `${learnerName} booked your "${topicName}" ${sessionType} session`,
        type: "session_booking",
        category: "teach", 
        priority: "high",
        data: {
          sessionId,
          learnerId,
          learnerName,
          topicName,
          scheduledAt,
          sessionType,
          action: {
            label: "View Schedule",
            callback: `/teach/schedule`
          }
        }
      };

      const [learnerNotif, teacherNotif] = await Promise.all([
        Notification.create(learnerNotification),
        Notification.create(teacherNotification)
      ]);

      // Emit real-time notifications
      this.emitRealTimeNotification(learnerId, learnerNotif);
      this.emitRealTimeNotification(teacherId, teacherNotif);

      return { learnerNotif, teacherNotif };
    } catch (error) {
      console.error('❌ Error creating session booking notifications:', error);
      throw error;
    }
  }

  // Get notifications for user with formatting - UPDATED to handle field names correctly
  static async getUserNotifications(userId, category = 'all', filter = 'all') {
    try {
      const whereClause = { user_id: userId };
      
      if (category !== 'all') {
        whereClause.category = category;
      }
      
      if (filter === 'unread') {
        whereClause.read = false;
      }

      // Use raw SQL query to avoid Sequelize field name issues
      let query = `
        SELECT 
          id, title, message, logo, type, category, read, priority, 
          data, expires_at, created_at, updated_at
        FROM "user".notifications 
        WHERE user_id = $1
      `;
      
      const params = [userId];
      
      if (category !== 'all') {
        query += ` AND category = $${params.length + 1}`;
        params.push(category);
      }
      
      if (filter === 'unread') {
        query += ` AND read = false`;
      }
      
      query += ` ORDER BY created_at DESC LIMIT 50`;
      
      const notifications = await sequelize1.query(query, {
        bind: params,
        type: sequelize1.QueryTypes.SELECT
      });

      // Format for frontend - handle both createdAt and created_at
      return notifications.map(notification => ({
        id: notification.id,
        title: notification.title,
        message: notification.message,
        time: this.formatTimeAgo(notification.created_at), // Use created_at from SQL
        logo: notification.logo || "/lo.jpg",
        type: notification.type,
        category: notification.category,
        read: notification.read,
        priority: notification.priority,
        timeRemaining: this.getTimeRemaining(notification.data),
        progress: this.calculateProgress(notification),
        action: notification.data?.action
      }));
    } catch (error) {
      console.error('❌ Error fetching notifications:', error);
      // Return empty array instead of throwing to prevent frontend crashes
      return [];
    }
  }

  // Get unread counts by category - UPDATED to use raw SQL
  static async getUnreadCounts(userId) {
    try {
      const result = await sequelize1.query(`
        SELECT category, COUNT(*) as count
        FROM "user".notifications 
        WHERE user_id = $1 AND read = false
        GROUP BY category
      `, {
        bind: [userId],
        type: sequelize1.QueryTypes.SELECT
      });

      const counts = { all: 0, learn: 0, teach: 0 };
      
      result.forEach(row => {
        counts[row.category] = parseInt(row.count);
        counts.all += parseInt(row.count);
      });

      return counts;
    } catch (error) {
      console.error('❌ Error getting unread counts:', error);
      // Return default counts instead of throwing
      return { all: 0, learn: 0, teach: 0 };
    }
  }

  // Mark notification as read
  static async markAsRead(notificationId, userId) {
    try {
      const [affectedCount] = await Notification.update(
        { read: true },
        { where: { id: notificationId, user_id: userId } }
      );
      
      return affectedCount > 0;
    } catch (error) {
      console.error('❌ Error marking notification as read:', error);
      return false;
    }
  }

  // Mark all as read
  static async markAllAsRead(userId, category = 'all') {
    try {
      const whereClause = { user_id: userId, read: false };
      
      if (category !== 'all') {
        whereClause.category = category;
      }

      const [affectedCount] = await Notification.update(
        { read: true },
        { where: whereClause }
      );
      
      return affectedCount;
    } catch (error) {
      console.error('❌ Error marking all notifications as read:', error);
      return 0;
    }
  }

  // Delete notification
  static async deleteNotification(notificationId, userId) {
    try {
      const result = await Notification.destroy({
        where: { id: notificationId, user_id: userId }
      });
      
      return result > 0;
    } catch (error) {
      console.error('❌ Error deleting notification:', error);
      return false;
    }
  }

  // Create test notification for debugging
  static async createTestNotification(userId, testData = {}) {
    try {
      const testNotification = await Notification.create({
        user_id: userId,
        title: testData.title || "Test Notification 🧪",
        message: testData.message || "This is a test notification to verify the system is working",
        type: testData.type || "test",
        category: testData.category || "learn",
        priority: testData.priority || "medium",
        data: testData.data || {
          test: true,
          action: {
            label: "Test Action",
            callback: "/learn/my-session"
          }
        }
      });

      // Emit real-time notification
      this.emitRealTimeNotification(userId, testNotification);
      
      return testNotification;
    } catch (error) {
      console.error('❌ Error creating test notification:', error);
      throw error;
    }
  }

  // Helper: Format time ago - IMPROVED with better formatting
  static formatTimeAgo(createdAt) {
    if (!createdAt) return 'recently';
    
    const createdDate = new Date(createdAt);
    const now = new Date();
    const seconds = Math.floor((now - createdDate) / 1000);
    
    if (seconds < 60) return 'just now';
    if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60);
      return `${minutes} min ago`;
    }
    if (seconds < 86400) {
      const hours = Math.floor(seconds / 3600);
      return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    }
    if (seconds < 604800) {
      const days = Math.floor(seconds / 86400);
      return `${days} day${days > 1 ? 's' : ''} ago`;
    }
    
    // For older notifications, show the date
    return createdDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }

  // Helper: Calculate progress for learn notifications - IMPROVED
  static calculateProgress(notification) {
    if (notification.type === 'session_booking' && notification.category === 'learn') {
      try {
        const sessionTime = new Date(notification.data?.scheduledAt);
        const now = new Date();
        
        if (isNaN(sessionTime.getTime())) return undefined;
        
        const timeUntilSession = sessionTime - now;
        
        // If session already started or passed
        if (timeUntilSession <= 0) return 100;
        
        // Calculate progress based on 24-hour window before session
        const totalWindow = 24 * 60 * 60 * 1000; // 24 hours
        const timeBeforeSession = Math.min(timeUntilSession, totalWindow);
        
        return Math.max(0, Math.min(100, 100 - (timeBeforeSession / totalWindow) * 100));
      } catch (error) {
        console.error('Error calculating progress:', error);
        return undefined;
      }
    }
    return undefined;
  }

  // Helper: Get time remaining for urgent sessions - IMPROVED
  static getTimeRemaining(data) {
    if (!data?.scheduledAt) return undefined;
    
    try {
      const sessionTime = new Date(data.scheduledAt);
      const now = new Date();
      
      if (isNaN(sessionTime.getTime())) return undefined;
      
      const diffMs = sessionTime - now;
      
      // Session already passed
      if (diffMs < 0) return undefined;
      
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      
      if (diffHours < 1) {
        return diffMinutes <= 0 ? 'starting now' : `${diffMinutes} min`;
      }
      if (diffHours < 24) {
        return `${diffHours} hour${diffHours > 1 ? 's' : ''}`;
      }
      
      return undefined; // Only show for sessions within 24 hours
    } catch (error) {
      console.error('Error calculating time remaining:', error);
      return undefined;
    }
  }

  // Emit real-time notification via Socket.io - IMPROVED with error handling
  static emitRealTimeNotification(userId, notification) {
    try {
      if (global.io) {
        const notificationData = {
          id: notification.id,
          title: notification.title,
          message: notification.message,
          time: this.formatTimeAgo(notification.created_at || notification.createdAt),
          logo: notification.logo || "/lo.jpg",
          type: notification.type,
          category: notification.category,
          read: notification.read,
          priority: notification.priority
        };
        
        global.io.to(`user_${userId}`).emit('new_notification', notificationData);
        console.log(`📡 Real-time notification sent to user ${userId}`);
      } else {
        console.log('⚠️ Socket.io not available for real-time notification');
      }
    } catch (error) {
      console.error('❌ Error emitting real-time notification:', error);
    }
  }

  // Get notification statistics for dashboard
  static async getNotificationStats(userId) {
    try {
      const stats = await sequelize1.query(`
        SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN read = false THEN 1 END) as unread,
          COUNT(CASE WHEN category = 'learn' THEN 1 END) as learn_count,
          COUNT(CASE WHEN category = 'teach' THEN 1 END) as teach_count,
          COUNT(CASE WHEN priority = 'high' THEN 1 END) as high_priority
        FROM "user".notifications 
        WHERE user_id = $1
      `, {
        bind: [userId],
        type: sequelize1.QueryTypes.SELECT
      });

      return stats[0] || {
        total: 0,
        unread: 0,
        learn_count: 0,
        teach_count: 0,
        high_priority: 0
      };
    } catch (error) {
      console.error('❌ Error getting notification stats:', error);
      return {
        total: 0,
        unread: 0,
        learn_count: 0,
        teach_count: 0,
        high_priority: 0
      };
    }
  }
}

export default NotificationService;