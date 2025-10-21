import { Op, literal } from "sequelize";
import { User } from "../Models/UserModels/UserModel.js";
import { Language } from "../Models/LanguageModel.js";
import UserDomainProgress from "../Models/progressModels.js";
import { Teachertopicstats } from "../Models/TeachertopicstatsModel.js";
// import { BookedSession } from "../Models/BookedSession.js";
import { Session } from "../Models/SessionModel.js";
import { Test } from "../Models/test.model.js";
import { TestFlag } from "../Models/TestflagModel.js";
import Feedback from "../Models/feedbackModels.js";
import { SessionAttendance } from "../Models/SessionAttendance.js";
import { CatalogueNode } from "../Models/index.js";

export const getAllUserDetails = async (req, res) => {
  try {
    const limit = 50;
    const page = parseInt(req.query.page) || 1;
    const offset = (page - 1) * limit;

    const sortBy = req.query.sortBy || "firstName";
    const order = req.query.order === "desc" ? "DESC" : "ASC";

    // Define which fields can be sorted at database level
    const databaseFields = [
      "firstName",
      "lastName",
      "email",
      "mobile",
      "dob",
      "gender",
      "status",
      "isLoggedIn",
    ];

    // Only apply database sorting if the field exists in the database
    const shouldSortInDatabase = databaseFields.includes(sortBy);

// Optional filter for minors / consent status
const where = {};
if (req.query.filter === "minor") where.isMinor = true;
if (req.query.filter === "adult") where.isMinor = false;
if (req.query.filter === "pendingConsent") where.minorConsentAccepted = false;

const { count: totalUsers, rows: users } = await User.findAndCountAll({
  where,
  offset,
  limit,
  ...(shouldSortInDatabase && { order: [[sortBy, order]] }),
  attributes: [
    "id",
    "firstName",
    "lastName",
    "email",
    "mobile",
    "dob",
    "gender",
    "known_language_ids",
    "preferred_language_id",
    "ipAddress",
    "location",
    "isLoggedIn",
    "status",
    "isMinor",                // ✅ include new field
    "minorConsentAccepted",   // ✅ include new field
  ],
});


    if (!users.length) return res.status(404).json({ error: "No users found" });

    const userIds = users.map((u) => u.id);

    const [
      attendanceRecords,
      languages,
      tests,
      testFlags,
      progress,
      sessions,
      feedbacks,
      teacherStats,
      bookedSessions,
    ] = await Promise.all([
      SessionAttendance.findAll({
        where: { user_id: { [Op.in]: userIds } },
        attributes: ["user_id", "status"],
      }),
      Language.findAll(),
      Test.findAll({
        where: {
          user_id: { [Op.in]: userIds },
          submitted_at: { [Op.ne]: null },
        },
        attributes: ["user_id", "result"],
      }),
      TestFlag.findAll({
        where: {
          user_id: { [Op.in]: userIds },
          reason: { [Op.in]: ["network_issue", "fraudulent_activity"] },
        },
      }),
      UserDomainProgress.findAll({
        where: { user_id: { [Op.in]: userIds } },
        attributes: ["user_id", "goal"],
      }),
      Session.findAll({
        where: {
          [Op.or]: [
            { student_id: { [Op.in]: userIds } },
            { teacher_id: { [Op.in]: userIds } },
          ],
        },
        attributes: ["session_id", "student_id", "teacher_id", "status"],
      }),
      Feedback.findAll({
        where: { flagged_issue: true },
        include: [
          {
            model: Session,
            as: "session",
            required: true,
            attributes: ["teacher_id", "student_id"],
          },
        ],
      }),
      Teachertopicstats.findAll({
        where: { teacherId: { [Op.in]: userIds } },
        attributes: ["teacherId", "tier", "sessionCount"],
      }),
      Session.findAll({
        where: { student_id: { [Op.in]: userIds } },
        attributes: ["student_id"],
      }),
    ]);

    const languageMap = {};
    languages.forEach((lang) => {
      languageMap[lang.language_id] = lang.language_name;
    });

    const attendanceMap = {};
    attendanceRecords.forEach(({ user_id, status }) => {
      if (!attendanceMap[user_id]) {
        attendanceMap[user_id] = { present: 0, absent: 0, missed: 0 };
      }
      attendanceMap[user_id][status]++;
    });

    const testStatsMap = {};
    tests.forEach(({ user_id, result }) => {
      if (!testStatsMap[user_id])
        testStatsMap[user_id] = { total: 0, passed: 0, failed: 0 };
      testStatsMap[user_id].total++;
      if (result?.passed) testStatsMap[user_id].passed++;
      else testStatsMap[user_id].failed++;
    });

    const testFlagMap = {};
    testFlags.forEach(({ user_id }) => {
      testFlagMap[user_id] = (testFlagMap[user_id] || 0) + 1;
    });

    const goalMap = {};
    progress.forEach(({ user_id, goal }) => {
      if (goal) goalMap[user_id] = (goalMap[user_id] || 0) + 1;
    });

    const sessionMap = {};
    const completedMap = {};
    const activeSessionMap = {};
    sessions.forEach((s) => {
      const ids = [s.student_id, s.teacher_id];
      ids.forEach((uid) => {
        if (!uid) return;
        sessionMap[uid] = (sessionMap[uid] || 0) + 1;
        if (s.status === "completed")
          completedMap[uid] = (completedMap[uid] || 0) + 1;
        if (s.status === "available" && s.student_id === uid)
          activeSessionMap[uid] = (activeSessionMap[uid] || 0) + 1;
      });
    });

    const feedbackByUser = {};
    const feedbackAgainstUser = {};
    feedbacks.forEach((fb) => {
      const bridgerId = fb.bridger_id;
      const { teacher_id, student_id } = fb.session || {};
      if (bridgerId)
        feedbackByUser[bridgerId] = (feedbackByUser[bridgerId] || 0) + 1;
      [teacher_id, student_id].forEach((id) => {
        if (id) feedbackAgainstUser[id] = (feedbackAgainstUser[id] || 0) + 1;
      });
    });

    const teachingMap = {};
    teacherStats.forEach(({ teacherId, tier, sessionCount }) => {
      if (!teachingMap[teacherId])
        teachingMap[teacherId] = {
          Bridger: 0,
          Expert: 0,
          Master: 0,
          Legend: 0,
        };
      teachingMap[teacherId][tier] += sessionCount;
    });

    const bookedMap = {};
    bookedSessions.forEach(({ learner_id }) => {
      bookedMap[learner_id] = (bookedMap[learner_id] || 0) + 1;
    });

    const results = users.map((user) => {
      const id = user.id;
      const teaching = teachingMap[id] || {
        Bridger: 0,
        Expert: 0,
        Master: 0,
        Legend: 0,
      };
      const totalTeaching = Object.values(teaching).reduce((a, b) => a + b, 0);
      const attendance = attendanceMap[id] || {
        present: 0,
        missed: 0,
        absent: 0,
      };
      return {
        id,
        name: `${user.firstName} ${user.lastName || ""}`.trim(),
        email: user.email,
        mobile: user.mobile || "Not Provided",
        known_languages: (user.known_language_ids || []).map(
          (id) => languageMap[id] || `ID: ${id}`
        ),
        preferred_language: user.preferred_language_id
          ? languageMap[user.preferred_language_id] ||
            `ID: ${user.preferred_language_id}`
          : null,
        gender: user.gender,
dob: user?.dob
  ? new Date(user.dob).toLocaleDateString("en-GB").split("/").join("-")
  : null,
isMinor: user.isMinor,
minorConsentAccepted: user.minorConsentAccepted,
ip_location:

          user?.ipAddress && user?.location
            ? (() => {
                const cleanLocation = user.location
                  .replace(/^['"]|['"]$/g, "")
                  .trim();
                const parts = cleanLocation.split(",").map((p) => p.trim());
                const city = parts[0]; // First value is city
                return `${user.ipAddress} ${city}`;
              })()
            : user?.ipAddress || "Not Available",

        logged: user.isLoggedIn ? "Active" : "Inactive",
        status: user.status || "Not Set",
        learner_sessions: bookedMap[id] || 0,
        active_sessions: activeSessionMap[id] || 0,
        goals_added: goalMap[id] || 0,
        bridger_sessions: teaching.Bridger,
        expert_sessions: teaching.Expert,
        master_sessions: teaching.Master,
        legend_sessions: teaching.Legend,
        teacher_sessions_total: totalTeaching,
        testsTaken: testStatsMap[id]?.total || 0,
        testsPassed: testStatsMap[id]?.passed || 0,
        testsFailed: testStatsMap[id]?.failed || 0,
        missedTests: testFlagMap[id] || 0,
        missedSessions: attendance.missed || 0,
        sessionsFlaggedByUser: feedbackByUser[id] || 0,
        sessionsUserGotFlaggedFor: feedbackAgainstUser[id] || 0,
      };
    });

    // Updated derivedFields array to include ALL calculated fields
    const derivedFields = [
      "missedSessions",
      "testsPassed",
      "testsFailed",
      "goals_added",
      "teacher_sessions_total",
      "learner_sessions",
      "active_sessions",
      "bridger_sessions",
      "expert_sessions",
      "master_sessions",
      "legend_sessions",
      "testsTaken",
      "missedTests",
      "sessionsFlaggedByUser",
      "sessionsUserGotFlaggedFor",
      "preferred_language",
      "known_language_ids",
      "location",
    ];

    // Sort in-memory for ALL non-database fields
    if (!shouldSortInDatabase) {
      results.sort((a, b) => {
        let aVal = a[sortBy];
        let bVal = b[sortBy];

        // Handle different data types
        if (typeof aVal === "string" && typeof bVal === "string") {
          aVal = aVal.toLowerCase();
          bVal = bVal.toLowerCase();
          return order === "DESC"
            ? bVal.localeCompare(aVal)
            : aVal.localeCompare(bVal);
        }

        // Handle numbers (including undefined/null as 0)
        aVal = aVal || 0;
        bVal = bVal || 0;
        return order === "DESC" ? bVal - aVal : aVal - bVal;
      });
    }

    console.log(totalUsers, results);
    return res.json({
      currentPage: page,
      totalPages: Math.ceil(totalUsers / limit),
      totalUsers,
      users: results,
    });
  } catch (error) {
    console.error("Error fetching combined user details:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

export const setUserBlacklistOrActive = async (req, res) => {
  const { user_id, status } = req.body;

  const allowedStatuses = ["active", "blacklist"];
  console.log(req.body);

  if (!allowedStatuses.includes(status)) {
    return res.status(400).json({
      message: `Invalid status. Allowed values: ${allowedStatuses.join(", ")}.`,
    });
  }

  try {
    const user = await User.findOne({ where: { id: user_id } });
    console.log(user);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    user.status = status;
    await user.save();

    return res.status(200).json({
      message: `User status updated to "${status}" successfully.`,
      user_id,
      status: user.status,
    });
  } catch (err) {
    console.error("Error updating user status:", err);
    return res.status(500).json({ message: "Internal server error." });
  }
};


// GET /api/admin/sessions
export const nucleusSessionDetails = async (req, res) => {
  try {
    const sessions = await Session.findAll({
      include: [
        {
          model: CatalogueNode,
          as: "catalogueNode", // alias used in associations.js
          attributes: ["node_id", "name", "address_of_node"],
        },
        {
          model: User,
          as: "teacher",
          attributes: ["id", "firstName", "lastName", "email"],
        },
        {
          model: User,
          as: "student",
          attributes: ["id", "firstName", "lastName", "email"],
        },
      ],
      order: [["scheduled_at", "DESC"]],
    });

    const formatted = sessions.map((s) => ({
      sessionId: s.session_id,
      topicId: s.catalogueNode?.node_id || null,
      topicName: s.catalogueNode?.name || null,
      topicPath: s.catalogueNode?.address_of_node || null,

      scheduledAt: s.scheduled_at,
      durationMinutes: s.duration_minutes,
      plannedEndAt: s.planned_end_at, // virtual computed field
      sessionTier: s.session_tier,
      sessionLevel: s.session_level,
      status: s.status,

      learnerId: s.student?.id || null,
      learnerName: s.student ? `${s.student.firstName}` : null,
      learnerEmail: s.student?.email || null,

      teacherId: s.teacher?.id || null,
      teacherName: s.teacher ? `${s.teacher.firstName}` : null,
      teacherEmail: s.teacher?.email || null,
    }));

    res.status(200).json({ success: true, data: formatted });
  } catch (err) {
    console.error("❌ Error fetching session details:", err);
    res.status(500).json({ success: false, message: "Something went wrong" });
  }
};


// export const deleteUser = async (req, res) => {
//   try {
//     const id = req.query.id;
//     console.log("Received ID for deletion:", id);

//     if (!id) {
//       console.warn("No ID provided");
//       return res
//         .status(400)
//         .json({ error: true, message: "User ID is required" });
//     }

//     const user = await User.findByPk(id);
//     if (!user) {
//       console.warn(`No user found with ID: ${id}`);
//       return res.status(404).json({ error: true, message: "User not found" });
//     }

//     await user.destroy();
//     console.log(`User ${id} deleted successfully`);

//     return res.json({ success: true, message: "User deleted successfully" });
//   } catch (err) {
//     console.error("Error deleting user:", err); // This should show the actual Sequelize or DB error
//     return res
//       .status(500)
//       .json({ error: true, message: "Internal Server Error" });
//   }
// };
