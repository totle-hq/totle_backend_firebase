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
      const whereClause = { user_id: userId, dismissed_at: null };
      if (filter === "unread") whereClause.read = false;
      
      if (category !== 'all')  whereClause.category = category;
      

      const notifications = await Notification.findAll({
        where: whereClause,
        order: [['created_at', 'DESC']], // mapped correctly via model
        limit: 50,
      });
      
      // Format for frontend - handle both createdAt and created_at
      return notifications.map(notification => ({
        id: notification.id,
        title: notification.title,
        message: notification.message,
        time: this.formatTimeAgo(notification.created_at),
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
      const rows = await Notification.findAll({
        where:{
          user_id: userId,
          read: false,
          dismissed_at: null,
        },
        attributes:[
          'category',
          [Notification.sequelize.fn('COUNT', Notification.sequelize.col('id')), 'count']
        ],
        group:['category'],
        raw: true
      });

      const counts = {all:0, learn: 0, teach: 0};
      rows.forEach(row=>{
        const count = Number(row.count);
        counts[row.category]=count;
        counts.all+=count;
      })
      
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
    if (!userId) {
      throw new Error("userId is required to create a notification");
    }

    try {
      const notification = await Notification.create({
        user_id: userId,
        title: testData.title ?? "📊 Test Result Available",
        message:
          testData.message ??
          "Your test has been evaluated. Tap to view details.",
        type: testData.type ?? "test_evaluation",
        category: testData.category ?? "learn",
        priority: testData.priority ?? "medium",
        data: {
          test_id: testData.data?.test_id,
          percentage: testData.data?.percentage,
          result: testData.data?.result,
          cooling_period_days: testData.data?.cooling_period_days ?? 0,
          action: {
            label: "View Result",
            callback: testData.data?.action?.callback ?? "/learn/my-tests",
          },
          ...testData.data,
        },
      });

      // 🔔 Emit real-time notification
      if (typeof this.emitRealTimeNotification === "function") {
        this.emitRealTimeNotification(userId, notification);
      }

      return notification;
    } catch (error) {
      console.error("❌ Error creating test notification:", error.message);
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
        
        global.io.to(`user:${userId}`).emit('notification:new', notificationData);
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
      const [stats] = await Notification.findAll({
        where: { user_id: userId },
        attributes: [
          [Notification.sequelize.fn('COUNT', Notification.sequelize.col('id')), 'total'],
          [
            Notification.sequelize.fn(
              'SUM',
              Notification.sequelize.literal(`CASE WHEN read = false THEN 1 ELSE 0 END`)
            ),
            'unread'
          ],
          [
            Notification.sequelize.fn(
              'SUM',
              Notification.sequelize.literal(`CASE WHEN category = 'learn' THEN 1 ELSE 0 END`)
            ),
            'learn_count'
          ],
          [
            Notification.sequelize.fn(
              'SUM',
              Notification.sequelize.literal(`CASE WHEN category = 'teach' THEN 1 ELSE 0 END`)
            ),
            'teach_count'
          ],
          [
            Notification.sequelize.fn(
              'SUM',
              Notification.sequelize.literal(`CASE WHEN priority = 'high' THEN 1 ELSE 0 END`)
            ),
            'high_priority'
          ]
        ],
        raw: true
      });

      return {
        total: Number(stats?.total || 0),
        unread: Number(stats?.unread || 0),
        learn_count: Number(stats?.learn_count || 0),
        teach_count: Number(stats?.teach_count || 0),
        high_priority: Number(stats?.high_priority || 0)
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

  static async createSessionRescheduleNotification({
    sessionId,
    learnerId,
    teacherId,
    oldTime,
    newTime,
  }) {
    const format = (d) =>
      new Date(d).toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      });

    const learnerNotification = {
      user_id: learnerId,
      title: "Session Rescheduled ⏰",
      message: `Your session has been rescheduled from ${format(oldTime)} to ${format(newTime)}`,
      type: "session_rescheduled",
      category: "learn",
      priority: "high",
      data: {
        sessionId,
        oldTime,
        newTime,
        action: {
          label: "View Session",
          callback: "/learn/my-session",
        },
      },
    };

    const teacherNotification = {
      user_id: teacherId,
      title: "Session Time Updated ⏰",
      message: `A session has been rescheduled from ${format(oldTime)} to ${format(newTime)}`,
      type: "session_rescheduled",
      category: "teach",
      priority: "high",
      data: {
        sessionId,
        oldTime,
        newTime,
        action: {
          label: "View Schedule",
          callback: "/teach/my-sessions",
        },
      },
    };

    const [learnerNotif, teacherNotif] = await Promise.all([
      Notification.create(learnerNotification),
      Notification.create(teacherNotification),
    ]);

    // 🔔 Real-time push
    this.emitRealTimeNotification(learnerId, learnerNotif);
    this.emitRealTimeNotification(teacherId, teacherNotif);
  }


  // DISMISS NOTIFICATION
  static async dismissNotification(notificationId, userId) {
    try {
      const [affected] = await Notification.update(
        { dismissed_at: new Date(),read: true, },
        {
          where: {
            id: notificationId,
            user_id: userId,
            dismissed_at: null,
          },
        }
      );

      return affected > 0;
    } catch (error) {
      console.error("❌ Error dismissing notification:", error);
      return false;
    }
  }

  // CLEAR ALL NOTIFICATIONS
  static async clearAllNotifications(userId) {
    try {
      if (!userId) return false;

      const [affected] = await Notification.update(
        {
          dismissed_at: new Date(),
          read: true,
        },
        {
          where: {
            user_id: userId,
            dismissed_at: null,
          },
        }
      );

      return affected > 0;
    } catch (error) {
      console.error("❌ Error clearing all notifications:", error);
      return false;
    }
  }

}

export default NotificationService;