import Razorpay from "razorpay";
import crypto from "crypto";
import { Op, Sequelize } from "sequelize";
import { User } from "../Models/UserModels/UserModel.js";
import { Session } from "../Models/SessionModel.js";
// import { BookedSession } from "../Models/BookedSession.js";
import { Payment } from "../Models/PaymentModels.js";
import { FeedbackSummary } from "../Models/feedbacksummary.js";
import { Language } from "../Models/LanguageModel.js";
import { Teachertopicstats } from "../Models/TeachertopicstatsModel.js";
import { CatalogueNode } from "../Models/CatalogModels/catalogueNode.model.js";
import { getRazorpayInstance } from "./PaymentControllers/paymentController.js";
import TeacherAvailability from "../Models/TeacherAvailability.js";
import Feedback from "../Models/feedbackModels.js";

// creating the instance for razorpay 
// const razorpay = new Razorpay({
//   key_id: process.env.RAZORPAY_KEY_ID,
//   key_secret: process.env.RAZORPAY_KEY_SECRET,
// });


export const getTeachersForTopic = async (req, res) => {
  try {
    const { topicId } = req.query;
    const user_id = req.user?.id || req.user?.user_id || req.user?.userId;

    console.log("=== DEBUG INFO ===");
    console.log("Current user_id:", user_id);
    console.log("Topic ID:", topicId);
    console.log("==================");

    if (!topicId) {
      return res.status(400).json({ error: true, message: "Topic ID is required" });
    }

    const now = new Date();
    const next7Days = new Date();
    next7Days.setDate(now.getDate() + 7);

    // First, check if topic exists
    const topicNode = await CatalogueNode.findByPk(topicId, {
      attributes: ["node_id", "name", "prices", "is_topic"]
    });

    if (!topicNode) {
      return res.status(404).json({ error: true, message: "Topic not found" });
    }

    console.log("Topic found:", topicNode.name);

    // Check how many users have topic stats for this topic
    const topicStatsCount = await Teachertopicstats.count({
      where: { node_id: topicId }
    });
    console.log("Users with topic stats:", topicStatsCount);

    // Check how many sessions exist for this topic
    const sessionCount = await Session.count({
      where: { topic_id: topicId }
    });
    console.log("Total sessions for topic:", sessionCount);

    // Check available sessions in next 7 days
    const availableSessionCount = await Session.count({
      where: { 
        topic_id: topicId,
        status: "available",
        scheduled_at: { 
          [Op.between]: [now, next7Days] 
        }
      }
    });
    console.log("Available sessions in next 7 days:", availableSessionCount);

    const topicPrices = topicNode.prices || { bridgers: 0, experts: 0, masters: 0, legends: 0 };

    const allLanguages = await Language.findAll({
      attributes: ["language_id", "language_name"],
      raw: true
    });
    const languageLookup = Object.fromEntries(
      allLanguages.map(lang => [lang.language_id, lang.language_name])
    );

    // STEP 1: Try without user exclusion first to see if there are any teachers
    console.log("=== STEP 1: Query WITHOUT user exclusion ===");
    const allTeachersQuery = await User.findAll({
      attributes: ["id", "firstName", "lastName"],
      include: [
        {
          model: Teachertopicstats,
          as: "topicStats",
          where: { node_id: topicId },
          attributes: ["level"],  // ✅ FIXED: Use 'level' instead of 'tier'
          required: false
        },
        {
          model: Session,
          as: "teachingSessions",
          where: { 
            topic_id: topicId,
            [Op.or]: [
              { status: "completed" },
              { 
                status: "available", 
                scheduled_at: { 
                  [Op.between]: [now, next7Days] 
                } 
              }
            ]
          },
          attributes: ["status", "scheduled_at"],
          required: true
        }
      ]
    });

    console.log("Total teachers found (including you):", allTeachersQuery.length);
    allTeachersQuery.forEach(teacher => {
      console.log(`- ${teacher.firstName} ${teacher.lastName} (ID: ${teacher.id})`);
    });

    // STEP 2: Now with user exclusion
    console.log("=== STEP 2: Query WITH user exclusion ===");
    const teachers = await User.findAll({
      attributes: ["id", "firstName", "lastName", "preferred_language_id", "known_language_ids"],
      where: {
        id: { [Op.ne]: user_id } // Exclude current user
      },
      include: [
        {
          model: Language,
          as: "preferredLanguage",
          attributes: ["language_name"],
          required: false
        },
        {
          model: FeedbackSummary,
          as: "feedbackSummaries",
          where: { node_id: topicId, node_type: "topic" },
          attributes: ["avg_star_rating"],
          required: false
        },
        {
          model: Teachertopicstats,
          as: "topicStats",
          where: { node_id: topicId },
          attributes: ["level"],  // ✅ FIXED: Use 'level' instead of 'tier'
          required: false
        },
        {
          model: Session,
          as: "teachingSessions",
          where: { 
            topic_id: topicId,
            [Op.or]: [
              { status: "completed" },
              { 
                status: "available", 
                scheduled_at: { 
                  [Op.between]: [now, next7Days] 
                } 
              }
            ]
          },
          attributes: ["status", "scheduled_at"],
          required: true,
          include: [
            {
              model: CatalogueNode,
              as: "catalogueNode",
              attributes: ["name"],
              required: false
            }
          ]
        }
      ],
      order: [
        [{ model: FeedbackSummary, as: "feedbackSummaries" }, "avg_star_rating", "DESC NULLS LAST"]
      ]
    });

    console.log("Teachers after excluding current user:", teachers.length);

    const topicName = topicNode.name || teachers[0]?.teachingSessions[0]?.CatalogueNode?.name || null;

    const teacherData = teachers.map(teacher => {
      const sessions = teacher.teachingSessions || [];
      
      const completedSessions = sessions.filter(s => s.status === "completed");
      const availableSessions = sessions.filter(s => 
        s.status === "available" && 
        new Date(s.scheduled_at) >= now && 
        new Date(s.scheduled_at) <= next7Days
      );
      
      const sessionsDelivered = completedSessions.length;
      const avgRating = teacher.feedbackSummaries?.[0]?.avg_star_rating || 0;
      const level = teacher.topicStats?.[0]?.level;  // ✅ FIXED: Use 'level' instead of 'tier'

      // ✅ FIXED: Price mapping function - handles plural keys
      const getTeacherPrice = (skillLevel) => {
        if (!skillLevel) return 0;
        
        // Convert PascalCase to lowercase and add 's' for plural
        const normalizedLevel = skillLevel.toLowerCase() + 's';
        return topicPrices[normalizedLevel] || 0;
      };

      const teacherPrice = getTeacherPrice(level);
      const knownLanguageNames = teacher.known_language_ids?.map(id => languageLookup[id]).filter(Boolean) || [];

      console.log(`Teacher: ${teacher.firstName}, Available slots: ${availableSessions.length}`);

      return {
        userId: teacher.id,
        name: `${teacher.firstName} ${teacher.lastName || ""}`.trim(),
        level: level?.toLowerCase() || 'bridger',  // ✅ FIXED: Use actual level, convert to lowercase
        price: teacherPrice,
        topicId,
        sessionsDelivered,
        avgRating,
        preferredLanguage: teacher.preferredLanguage?.language_name || null,
        knownLanguages: knownLanguageNames,
        availableSlots: availableSessions
          .map(s => s.scheduled_at)
          .sort((a, b) => new Date(a).getTime() - new Date(b).getTime()),
        hasAvailableSlots: availableSessions.length > 0
      };
    }).filter(teacher => teacher.hasAvailableSlots);

    console.log("Final filtered teacher count:", teacherData.length);
    console.log("topicPrice:",topicPrices);
    return res.json({ 
      teachers: teacherData,
      topicName: topicName,
      topicPrices: topicPrices
    });

  } catch (error) {
    console.error("Error fetching teacher data:", error);
    res.status(500).json({ error: true, message: "Internal server error" });
  }
};

// export const BookPaidSlot = async (req, res) => {

//   try {
//     const user_id = req.user?.id || req.user?.user_id || req.user?.userId;
//     const { slot, teacher_id, level, topic_id,paymentMode: requestedMode } = req.body;

//     const paymentMode = ['LIVE', 'DEMO'].includes(requestedMode) ? requestedMode : 'DEMO';
    
//     console.log("=== BOOKING REQUEST DEBUG ===");
//     console.log("User ID:", user_id);
//     console.log("Request body:", { slot, teacher_id, level, topic_id });
//     console.log("===============================");

//     if (!slot || !teacher_id || !level || !topic_id) {
//       return res.status(400).json({
//         success: false,
//         message: "Missing required fields: slot, teacher_id, level, topic_id",
//       });
//     }

//     if (!user_id) {
//       console.error('Auth middleware failed to set req.user:', req.user);
//       return res.status(401).json({
//         success: false,
//         message: "Authentication failed - user not found in request",
//       });
//     }

//     //Validate teacher & topic, fetch actual level & price from DB
//     const teacherStats = await Teachertopicstats.findOne({
//       where: { teacherId: teacher_id, node_id: topic_id },
//     });

//     if (!teacherStats) {
//       return res.status(404).json({ 
//         success: false, 
//         message: "Teacher not found for this topic" 
//       });
//     }

//     const topicNode = await CatalogueNode.findByPk(topic_id);
//     if (!topicNode) {
//       return res.status(404).json({ 
//         success: false, 
//         message: "Topic not found" 
//       });
//     }

//     //Check if slot is still available and not already booked
//     const existingBooking = await Session.findOne({
//       where: {
//         teacher_id,
//         scheduled_at: new Date(slot),
//         status: {
//           [Op.in]: ["pending", "upcoming", "booked", "completed"]
//         }
//       }
//     });

//     if (existingBooking) {
//       console.log("Slot unavailable - existing booking:", existingBooking.toJSON());
//       return res.status(400).json({
//         success: false,
//         message: "This slot is no longer available"
//       });
//     }

//     //Ensure the slot exists and is available
//     const availableSession = await Session.findOne({
//       where: {
//         teacher_id,
//         scheduled_at: new Date(slot),
//         status: "available"
//       }
//     });

//     if (!availableSession) {
//       return res.status(400).json({
//         success: false,
//         message: "This slot is not available for booking"
//       });
//     }

//     //Enhanced pricing validation with debugging
//     const skillLevel = teacherStats.level;  // ✅ FIXED: Use 'level' instead of 'tier'
//     const prices = topicNode.prices || {};
    
//     console.log("=== PRICING DEBUG ===");
//     console.log("Teacher Stats:", teacherStats.toJSON());
//     console.log("Topic Node prices:", prices);
//     console.log("Teacher Level from DB:", skillLevel);  // ✅ FIXED: Updated variable name
//     console.log("Level from frontend:", level);
//     console.log("====================");

//     // ✅ FIXED: Price mapping for plural keys
//     const getTierPrice = (skillLevel, pricesObj) => {
//       if (!skillLevel || !pricesObj || typeof pricesObj !== 'object') {
//         console.log("Invalid skill level or prices object:", { skillLevel, pricesObj });
//         return 0;
//       }

//       // Convert PascalCase to lowercase and add 's' for plural
//       const normalizedLevel = skillLevel.toLowerCase() + 's';
      
//       console.log("Looking for price with key:", normalizedLevel);
      
//       if (pricesObj[normalizedLevel] !== undefined && pricesObj[normalizedLevel] !== null) {
//         console.log(`Found price for key '${normalizedLevel}':`, pricesObj[normalizedLevel]);
//         return Number(pricesObj[normalizedLevel]) || 0;
//       }

//       console.log("No matching price key found. Available keys:", Object.keys(pricesObj));
//       return 0;
//     };

//     const amount = getTierPrice(skillLevel, prices);  // ✅ FIXED: Use skillLevel

//     console.log("Final calculated amount:", amount);

//     if (amount <= 0) {
//       console.error("Price configuration error:", {
//         skillLevel,  // ✅ FIXED: Updated variable name
//         level,
//         prices,
//         amount,
//         availableKeys: Object.keys(prices)
//       });
      
//       return res.status(400).json({ 
//         success: false, 
//         message: `Invalid price configuration for teacher level '${skillLevel}'. Available pricing tiers: ${Object.keys(prices).join(', ')}. Please contact support.`  // ✅ FIXED: Updated variable name
//       });
//     }

//     // ✅ FIXED: Level verification - compare actual skill levels
//     const normalizedDbLevel = skillLevel.toLowerCase();  // ✅ FIXED: Use skillLevel
//     const normalizedRequestLevel = level.toString().toLowerCase().trim();
    
//     if (normalizedRequestLevel !== normalizedDbLevel) {
//       return res.status(400).json({
//         success: false,
//         message: `Teacher level mismatch. Expected: ${skillLevel}, Received: ${level}. Please refresh and try again.`  // ✅ FIXED: Use skillLevel
//       });
//     }

//     const razorpay = getRazorpayInstance(paymentMode);

//     // Create a Razorpay order
//     const timestamp = Date.now().toString().slice(-8);
//     const shortUserId = user_id.slice(-8);
//     const receipt = `s_${timestamp}_${shortUserId}`;
    
//     console.log("Generated receipt:", receipt, "Length:", receipt.length);
    
//     const order = await razorpay.orders.create({
//       amount: amount * 100,
//       currency: "INR",
//       receipt: receipt,
//       notes: {
//         teacher_id: teacher_id.toString(),
//         user_id: user_id.toString(),
//         topic_id: topic_id.toString(),
//         slot,
//         skillLevel: skillLevel,  // ✅ FIXED: Use skillLevel instead of tier
//         amount: amount.toString(),
//         session_id: availableSession.id 
//       },
//     });

//     console.log("Razorpay order created:", order.id, "Amount:", amount);

//     // ✅ Create Payment record with "created" status
//     const paymentRecord = await Payment.create({
//       user_id,
//       entity_type: "session",
//       entity_id: availableSession.id,
//       order_id: order.id,
//       amount: amount * 100, // Store in paise
//       currency: "INR",
//       status: "created",
//       payment_mode: paymentMode,
//     });

//     console.log("Payment record created:", paymentRecord.payment_id);

//     // ✅ Update session to pending (same as before)
//     await availableSession.update({
//       student_id: user_id,
//       status: "pending",
//       updatedAt: new Date()
//     });

//     console.log("Session updated to pending:", availableSession.toJSON());

//     return res.json({
//       success: true,
//       order_id: order.id,
//       amount,
//       currency: "INR",
//       key: process.env.RAZORPAY_KEY_ID,
//       session_id: availableSession.id,
//       payment_id: paymentRecord.payment_id, // ✅ Return payment record ID
//       message: "Order created successfully",
//       payment_mode: paymentMode,
//     });

//   } catch (error) {
//     console.error("Booking error:", error);
    
//     if (error.statusCode) {
//       return res.status(error.statusCode).json({
//         success: false,
//         message: error.error?.description || "Payment gateway error",
//       });
//     }

//     res.status(500).json({
//       success: false,
//       message: "Internal server error during booking process",
      
//     });
//   }
// };



// ✅ UPDATED: confirmBooking function - now updates Payment record
export const confirmBooking = async (req, res) => {
  const transaction = await sequelize1.transaction();

  try {
    const user_id = req.user?.id;

    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      slot,
      teacher_id,
      topic_id,
      level,
    } = req.body;

    const payment = await Payment.findOne({
      where: { order_id: razorpay_order_id },
      transaction,
    });

    if (!payment) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        message: "Payment record not found",
      });
    }

    /* VERIFY SIGNATURE */

    const generatedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(razorpay_order_id + "|" + razorpay_payment_id)
      .digest("hex");

    if (generatedSignature !== razorpay_signature) {
      await payment.update(
        { status: "failed", failure_reason: "Invalid signature" },
        { transaction }
      );

      await transaction.rollback();

      return res.status(400).json({
        success: false,
        message: "Payment verification failed",
      });
    }

    const SESSION_DURATION = 90;

    const start = new Date(slot);
    const end = new Date(start.getTime() + SESSION_DURATION * 60000);

    /*
    🔐 LOCK TEACHER AVAILABILITY ROW
    This prevents two users booking same slot simultaneously
    */

    const availability = await TeacherAvailability.findOne({
      where: {
        teacher_id,
        start_at: { [Op.lte]: start },
        end_at: { [Op.gte]: end },
        is_active: true,
      },
      lock: transaction.LOCK.UPDATE,
      transaction,
    });

    if (!availability) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        message: "Slot already booked",
      });
    }

    /*
    CREATE SESSION
    */

    const session = await Session.create(
      {
        topic_id,
        teacher_id,
        student_id: user_id,
        scheduled_at: start,
        completed_at: end,
        duration_minutes: SESSION_DURATION,
        session_tier: "paid",
        session_level: level,
        status: "upcoming",
      },
      { transaction }
    );

    /*
    UPDATE PAYMENT
    */

    await payment.update(
      {
        razorpay_payment_id,
        razorpay_signature,
        status: "success",
        entity_id: session.session_id,
      },
      { transaction }
    );

    /*
    SPLIT AVAILABILITY SLOT
    */

    if (start > availability.start_at) {
      await TeacherAvailability.create(
        {
          teacher_id,
          start_at: availability.start_at,
          end_at: start,
          is_active: true,
        },
        { transaction }
      );
    }

    if (end < availability.end_at) {
      await TeacherAvailability.create(
        {
          teacher_id,
          start_at: end,
          end_at: availability.end_at,
          is_active: true,
        },
        { transaction }
      );
    }

    await availability.update(
      { is_active: false },
      { transaction }
    );

    await transaction.commit();

    return res.json({
      success: true,
      message: "Session booked successfully",
      session_id: session.session_id,
    });

  } catch (error) {
    await transaction.rollback();

    console.error("Confirm booking error:", error);

    res.status(500).json({
      success: false,
      message: "Booking confirmation failed",
    });
  }
};

// ✅ UPDATED: handlePaymentFailure function - now updates Payment record
export const handlePaymentFailure = async (req, res) => {
  try {
    const user_id = req.user?.id || req.user?.user_id || req.user?.userId;
    const { order_id, error_description, payment_id } = req.body;

    console.log("=== PAYMENT FAILURE DEBUG ===");
    console.log("User ID:", user_id);
    console.log("Order ID:", order_id);
    console.log("Payment ID:", payment_id);
    console.log("Error description:", error_description);
    console.log("=============================");

    if (!order_id) {
      return res.status(400).json({
        success: false,
        message: "Order ID is required"
      });
    }

    if (!user_id) {
      console.error('Auth middleware failed to set req.user:', req.user);
      return res.status(401).json({
        success: false,
        message: "Authentication failed - user not found in request"
      });
    }

    // ✅ Find and update Payment record
    const paymentRecord = await Payment.findOne({
      where: {
        order_id,
        user_id,
        status: { [Op.in]: ["created", "pending"] }
      }
    });

    if (paymentRecord) {
      await paymentRecord.update({
        razorpay_payment_id: payment_id || null,
        status: "failed",
        failure_reason: error_description || "Payment failed"
      });
      console.log("✅ Payment record updated to failed");
    }

    // Find the most recent pending session for this user
    const session = await Session.findOne({
      where: {
        student_id: user_id, 
        status: "pending"
      },
      order: [['updatedAt', 'DESC']]
    });

    if (session) {
      await session.update({
        status: "available",
        student_id: null, 
        completed_at: null, 
        updatedAt: new Date()
      });

      console.log("Payment failure handled - session returned to available:", session.id);
    } else {
      console.log("No pending session found for failed payment:", {
        order_id,
        student_id: user_id
      });
    }

    res.json({
      success: true,
      message: "Payment failure handled successfully",
      payment_id: paymentRecord?.payment_id
    });

  } catch (error) {
    console.error("Payment failure handling error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to handle payment failure",
      
    });
  }
};

export const getPaidTeachersWithAvailability = async (req, res) => {
  try {
    const { topicId } = req.params;
    const currentUserId =
      req.user?.id || req.user?.user_id || req.user?.userId;

    if (!topicId) {
      return res.status(400).json({
        success: false,
        message: "Topic ID is required",
      });
    }

    const now = new Date();
    const next7Days = new Date();
    next7Days.setDate(now.getDate() + 7);

    /*
      STEP 1: Get paid teachers for topic
    */
    const paidTeachers = await Teachertopicstats.findAll({
      where: {
        node_id: topicId,
        tier: "paid",
      },
      attributes: ["teacherId", "level"],
      raw: true,
    });
    console.log("paidTeachers count:", paidTeachers.length);

    if (!paidTeachers.length) {
      return res.json({ success: true, teachers: [] });
    }

    const teacherMap = new Map();

    paidTeachers.forEach((t) => {
      if (t.teacherId !== currentUserId) {
        teacherMap.set(t.teacherId, {
          teacher_id: t.teacherId,
          level: t.level,
          availableSlots: [],
        });
      }
    });

    const teacherIds = Array.from(teacherMap.keys());

    if (!teacherIds.length) {
      return res.json({ success: true, teachers: [] });
    }

    /*
      STEP 2: Get availability linked to topic (M2M)
    */
    const availabilities = await TeacherAvailability.findAll({
      where: {
        teacher_id: { [Op.in]: teacherIds },
        is_active: true,
        end_at: {
          [Op.gte]: new Date(now.getTime() + 90 * 60 * 1000),
        },
        start_at: {
          [Op.lte]: next7Days,
        },
      },
      include: [
        {
          model: CatalogueNode,
          as: "topics",
          where: { node_id: topicId },
          attributes: [],
          through: { attributes: [] },
          required: true,
        },
      ],
      order: [["start_at", "ASC"]],
      raw: false,
    });

    /*
      STEP 3: Group availability under teachers
    */
    for (const slot of availabilities) {
      const teacherId = slot.teacher_id;

      if (teacherMap.has(teacherId)) {
        teacherMap.get(teacherId).availableSlots.push({
          availability_id: slot.availability_id,
          start: slot.start_at,
          end: slot.end_at,
        });
      }
    }
    /*
      STEP 4: Fetch user + rating info (USING Feedback MODEL)
    */

    // First get teacher IDs that actually have slots
    const teacherIdsWithSlots = Array.from(teacherMap.entries())
      .filter(([_, data]) => data.availableSlots.length > 0)
      .map(([teacherId]) => teacherId);

    console.log("teacher id", teacherIdsWithSlots.length)

    if (!teacherIdsWithSlots.length) {
      return res.json({ success: true, teachers: [] });
    }

    // 1️⃣ Get average rating per teacher from Feedback
    const ratings = await Feedback.findAll({
      attributes: [
        "bridger_id",
        [Sequelize.fn("AVG", Sequelize.col("star_rating")), "avg_rating"],
      ],
      where: {
        topic_id: topicId,
        bridger_id: { [Op.in]: teacherIdsWithSlots },
      },
      group: ["bridger_id"],
      raw: true,
    });

    const ratingMap = new Map();
    ratings.forEach((r) => {
      ratingMap.set(r.bridger_id, parseFloat(r.avg_rating));
    });

    /*
      STEP 6: Session breakdown (🔥 NEW)
    */
    const sessionStats = await Session.findAll({
      attributes: [
        "teacher_id",
        [Sequelize.fn("COUNT", Sequelize.col("session_id")), "total_sessions"],
        [
          Sequelize.fn(
            "SUM",
            Sequelize.literal(
              `CASE WHEN session_tier = 'paid' THEN 1 ELSE 0 END`
            )
          ),
          "paid_sessions",
        ],
        [
          Sequelize.fn(
            "SUM",
            Sequelize.literal(
              `CASE WHEN session_tier = 'free' THEN 1 ELSE 0 END`
            )
          ),
          "free_sessions",
        ],
      ],
      where: {
        topic_id: topicId,
        teacher_id: { [Op.in]: teacherIdsWithSlots },
        status: "completed",
      },
      group: ["teacher_id"],
      raw: true,
    });

    const sessionStatsMap = new Map();

    sessionStats.forEach((row) => {
      sessionStatsMap.set(row.teacher_id, {
        totalSessionsCount: parseInt(row.total_sessions, 10) || 0,
        paidSessionsCount: parseInt(row.paid_sessions, 10) || 0,
        freeSessionsCount: parseInt(row.free_sessions, 10) || 0,
      });
    });

    /*
      STEP 7: Fetch users
    */

    // 2️⃣ Fetch all users in one query
    const users = await User.findAll({
      where: { id: { [Op.in]: teacherIdsWithSlots } },
      attributes: ["id", "firstName", "lastName"],
      raw: true,
    });

    const userMap = new Map();
    users.forEach((u) => userMap.set(u.id, u));
    /*
      STEP 8: Build response
    */   
    const teachersWithAvailability = teacherIdsWithSlots.map(
      (teacherId) => {
        console.log(teacherId)

        const teacherData = teacherMap.get(teacherId);
        const user = userMap.get(teacherId);
        const stats = sessionStatsMap.get(teacherId) || {
          totalSessionsCount: 0,
          paidSessionsCount: 0,
          freeSessionsCount: 0,
        };

        return {
          teacher_id: teacherId,
          name: user
            ? `${user.firstName} ${user.lastName || ""}`.trim()
            : "Unknown",
          level: teacherData.level,
          avgRating: ratingMap.get(teacherId) || 0,
          totalSessionsCount: stats.totalSessionsCount,
          // paidSessionsCount: stats.paidSessionsCount,
          // freeSessionsCount: stats.freeSessionsCount,
          availableSlots: teacherData.availableSlots,
        };
      }
    );

    // Fetch topic prices
    const topic = await CatalogueNode.findByPk(topicId, {
      attributes: ["prices"],
      raw: true,
    });

    const topicPrices = topic?.prices || {};



    return res.json({
      success: true,
      teachers: teachersWithAvailability,
      prices: {
        bridgers: topicPrices.bridgers || 0,
        experts: topicPrices.experts || 0,
        masters: topicPrices.masters || 0,
        legends: topicPrices.legends || 0,
      },
    });
  } catch (error) {
    console.error("Error fetching paid teachers:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const createPaidBookingOrder = async (req, res) => {
  try {
    const user_id = req.user?.id;
    const { slot, teacher_id, topic_id, level } = req.body;

    if (!user_id || !slot || !teacher_id || !topic_id || !level) {
      return res.status(400).json({
        success: false,
        message: "Missing parameters"
      });
    }

    const teacherStats = await Teachertopicstats.findOne({
      where: { teacherId: teacher_id, node_id: topic_id }
    });

    if (!teacherStats) {
      return res.status(404).json({
        success: false,
        message: "Teacher not qualified"
      });
    }

    const topicNode = await CatalogueNode.findByPk(topic_id);

    const prices = topicNode.prices || {};
    const priceKey = teacherStats.level.toLowerCase() + "s";
    const amount = Number(prices[priceKey] || 0);

    if (amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid price"
      });
    }

    const razorpay = getRazorpayInstance("LIVE");

    const order = await razorpay.orders.create({
      amount: amount * 100,
      currency: "INR",
      receipt: `slot_${Date.now()}`,
      notes: {
        user_id,
        teacher_id,
        topic_id,
        slot,
        level
      }
    });

    const payment = await Payment.create({
      user_id,
      entity_type: "session",
      entity_id: topic_id,
      order_id: order.id,
      amount: amount * 100,
      currency: "INR",
      status: "created"
    });

    return res.json({
      success: true,
      order_id: order.id,
      payment_id: payment.payment_id,
      amount,
      key: process.env.RAZORPAY_KEY_ID
    });

  } catch (err) {
    console.error("Order creation error:", err);

    res.status(500).json({
      success: false,
      message: "Order creation failed"
    });
  }
};

export const verifyPaymentAndCreateSession = async (req, res) => {
  const transaction = await sequelize1.transaction();

  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      slot,
      teacher_id,
      topic_id,
      level,
    } = req.body;

    const payment = await Payment.findOne({
      where: { order_id: razorpay_order_id },
      transaction,
    });

    if (!payment) {
      await transaction.rollback();
      return res.status(404).json({ message: "Payment not found" });
    }

    /* VERIFY SIGNATURE */

    const generatedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_SECRET)
      .update(razorpay_order_id + "|" + razorpay_payment_id)
      .digest("hex");

    if (generatedSignature !== razorpay_signature) {
      await payment.update(
        { status: "failed", failure_reason: "Signature mismatch" },
        { transaction }
      );

      await transaction.rollback();

      return res.status(400).json({
        success: false,
        message: "Payment verification failed",
      });
    }

    /* UPDATE PAYMENT */

    await payment.update(
      {
        razorpay_payment_id,
        razorpay_signature,
        status: "success",
      },
      { transaction }
    );

    /* CREATE SESSION */

    const start = new Date(slot);
    const end = new Date(start.getTime() + 90 * 60000);

    const session = await Session.create(
      {
        topic_id,
        teacher_id,
        student_id: payment.user_id,
        scheduled_at: start,
        completed_at: end,
        duration_minutes: 90,
        session_tier: "paid",
        session_level: level,
        status: "upcoming",
      },
      { transaction }
    );

    /* UPDATE ENTITY ID TO SESSION */

    await payment.update(
      { entity_id: session.session_id },
      { transaction }
    );

    await transaction.commit();

    return res.json({
      success: true,
      session_id: session.session_id,
      message: "Session booked successfully",
    });
  } catch (err) {
    await transaction.rollback();

    console.error("Payment verify error", err);

    res.status(500).json({
      success: false,
      message: "Payment verification failed",
    });
  }
};