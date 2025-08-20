import { Sequelize } from "sequelize";
import { Session } from "../Models/SessionModel.js";
import { sequelize1 } from "../config/sequelize.js";

import { User } from "../Models/UserModels/UserModel.js";

// Updated Projections Function
export const getProjections = async (monthSessions, filters = {}) => {
  try {
    const { tier, level, languageId, sessionFilters = {} } = filters;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
console.log(monthSessions);
    // 1. VALIDATE INPUT
    monthSessions = Number(monthSessions) || 0;
    const currentDate = today.getDate();
    const totalDaysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const monthProgress = currentDate / totalDaysInMonth;

    console.log('Projection Inputs:', {
      monthSessions,
      currentDate,
      totalDaysInMonth,
      monthProgress: `${Math.round(monthProgress * 100)}%`
    });

    // 2. BUILD WHERE CLAUSES
    const baseWhere = { status: 'completed', ...sessionFilters };
    delete baseWhere.topic_id;

    if (tier && tier !== 'all') {
      baseWhere.session_tier = tier;
    }
    if (level && level !== 'All') {
      baseWhere.session_level = level;
    }

    const teacherInclude = (languageId
      ? [{ model: User, as: 'teacher', where: { preferred_language_id: languageId }, attributes: [], required: true }]
      : []);

    // 3. CALCULATE DATA AGE
    const oldestSession = await Session.findOne({
      attributes: [[Sequelize.fn('MIN', Sequelize.col('completed_at')), 'oldest']],
      where: baseWhere,
      ...(teacherInclude.length > 0 && { include: teacherInclude }),
      raw: true
    });

    if (!oldestSession?.oldest) {
      return calculateBasicProjections(monthSessions, currentDate, totalDaysInMonth);
    }

    const dataAgeDays = Math.floor((today - new Date(oldestSession.oldest)) / (1000 * 60 * 60 * 24));
    
    // 4. PROJECTION LOGIC
    if (dataAgeDays < 90) {
      return calculateNewDataProjections(monthSessions, currentDate, totalDaysInMonth);
    } else {
      return await calculateHistoricalProjections(baseWhere, teacherInclude, monthSessions, monthProgress);
    }
  } catch (error) {
    console.error("Error in getProjections:", error);
    return {
      nextDay: Math.max(1, Math.ceil(monthSessions / 30)),
      nextWeek: Math.max(1, Math.ceil(monthSessions / 4)),
      nextMonth: Math.max(monthSessions + 1, Math.ceil(monthSessions * 1.3))
    };
  }
};


// Helper Functions
function calculateBasicProjections(monthSessions, currentDate, totalDaysInMonth) {
  const daysPassed = Math.max(1, currentDate); // avoid divide by 0
  const dailyRate = monthSessions / daysPassed;
  const projectedMonthTotal = dailyRate * totalDaysInMonth;

  return {
    nextDay: Math.max(1, Math.ceil(dailyRate)),         // tomorrow ≈ daily rate
    nextWeek: Math.max(1, Math.ceil(dailyRate * 7)),    // 7-day rate
    nextMonth: Math.ceil(projectedMonthTotal)           // full month projection
  };
}

function calculateNewDataProjections(monthSessions, currentDate, totalDaysInMonth) {
  const daysPassed = Math.max(1, currentDate);
  const dailyRate = monthSessions / daysPassed;
  const projectedMonthTotal = dailyRate * totalDaysInMonth;

  return {
    nextDay: Math.max(1, Math.ceil(dailyRate * 1.2)),       // add a buffer
    nextWeek: Math.max(1, Math.ceil(dailyRate * 7 * 1.2)),  // slightly higher
    nextMonth: Math.ceil(projectedMonthTotal * 1.2)         // boosted projection
  };
}



async function calculateHistoricalProjections(baseWhere, teacherWhere, monthSessions, monthProgress) {
  const threeMonthStart = new Date();
  threeMonthStart.setMonth(threeMonthStart.getMonth() - 3);
  
  const threeMonthCount = await Session.count({
    where: {
      ...baseWhere,
      completed_at: { [Sequelize.Op.gte]: threeMonthStart }
    },
    ...(Object.keys(teacherWhere).length > 0 && {
      include: [{ model: User, as: 'teacher', where: teacherWhere, attributes: [], required: true }]
    })
  });

  const threeMonthAvg = threeMonthCount / 3;
  const expectedMonthly = threeMonthAvg * (1 + (0.5 * monthProgress)); // Scale growth with month progress

  return {
    nextDay: Math.ceil((threeMonthAvg / 30) * 1.2),
    nextWeek: Math.ceil((threeMonthAvg / 4) * 1.3),
    nextMonth: Math.ceil(Math.max(
      monthSessions * 1.2, // Minimum 20% growth
      expectedMonthly      // Or historical trend
    ))
  };
}

export async function fixTeacherTopicStatsTier() {
  try {
    console.log("🔍 Ensuring enum values exist for catalog.enum_teacher_topic_stats_tier...");
    await sequelize1.query(`
      DO $$
      BEGIN
          IF NOT EXISTS (
              SELECT 1 FROM pg_enum e
              JOIN pg_type t ON e.enumtypid = t.oid
              WHERE t.typname = 'enum_teacher_topic_stats_tier' AND enumlabel = 'free'
          ) THEN
              ALTER TYPE catalog.enum_teacher_topic_stats_tier ADD VALUE 'free';
          END IF;

          IF NOT EXISTS (
              SELECT 1 FROM pg_enum e
              JOIN pg_type t ON e.enumtypid = t.oid
              WHERE t.typname = 'enum_teacher_topic_stats_tier' AND enumlabel = 'paid'
          ) THEN
              ALTER TYPE catalog.enum_teacher_topic_stats_tier ADD VALUE 'paid';
          END IF;
      END
      $$;
    `);

    console.log("🔍 Checking teacher_topic_stats.tier for invalid values...");
    const [result] = await sequelize1.query(`
      UPDATE catalog.teacher_topic_stats
      SET tier = 'free'
      WHERE tier NOT IN ('free', 'paid') OR tier IS NULL
      RETURNING id, tier;
    `);

    if (result.length > 0) {
      console.log(`✅ Fixed ${result.length} rows with invalid tier values.`);
    } else {
      console.log("✅ No invalid tier values found.");
    }
  } catch (error) {
    console.error("❌ Error fixing tier values:", error);
    throw error;
  }
}
