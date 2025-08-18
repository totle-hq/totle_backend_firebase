import { Sequelize } from "sequelize";
import { Session } from "../Models/SessionModel.js";
import { sequelize1 } from "../config/sequelize.js";
import { Language } from "../Models/LanguageModel.js";
import { User } from "../Models/UserModels/UserModel.js";

export const getProjections = async (monthSessions, filters = {}) => {
  const { tier, level, languageId, sessionFilters = {} } = filters;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Build base where clause with all filters except topic/domain
  const baseWhere = { 
    status: 'completed',
    ...sessionFilters
  };

  // Remove topic_id filter for projections
  if (baseWhere.topic_id) {
    delete baseWhere.topic_id;
  }

  // Build teacher filters
  const teacherWhere = {
    ...(tier && tier !== 'all' && { tier }),
    ...(level && level !== 'All' && { level }),
    ...(languageId && { preferred_language_id: languageId })
  };

  // Get oldest session with all filters applied
  const oldestSession = await Session.findOne({
    attributes: [[Sequelize.fn('MIN', Sequelize.col('completed_at')), 'oldest']],
    where: baseWhere,
    ...(Object.keys(teacherWhere).length > 0 && {
      include: [{
        model: User,
        as: 'teacher',
        where: teacherWhere,
        attributes: [],
        required: true
      }]
    }),
    raw: true
  });

  if (!oldestSession?.oldest) {
    return { nextDay: 0, nextWeek: 0, nextMonth: 0 };
  }

  const dataAgeDays = Math.floor((today - new Date(oldestSession.oldest)) / (1000 * 60 * 60 * 24));
  const baseline = monthSessions || 1;

  if (dataAgeDays < 90) {
    const daysPassed = today.getDate();
    const avgDaily = baseline / daysPassed;
    return {
      nextDay: Math.max(1, Math.ceil(avgDaily * 1.05)),
      nextWeek: Math.max(1, Math.ceil(avgDaily * 7 * 1.15)),
      nextMonth: Math.max(1, Math.ceil(baseline * 1.3))
    };
  }

  // For >=3 months data
  const threeMonthStart = new Date(new Date().setMonth(today.getMonth() - 3));
  const threeMonthCount = await Session.count({
    where: {
      ...baseWhere,
      completed_at: { [Sequelize.Op.between]: [threeMonthStart, today] }
    },
    ...(Object.keys(teacherWhere).length > 0 && {
      include: [{
        model: User,
        as: 'teacher',
        where: teacherWhere,
        attributes: [],
        required: true
      }]
    })
  });

  const threeMonthAvg = threeMonthCount / 3;
  return {
    nextDay: Math.max(1, Math.ceil((threeMonthAvg / 30) * 1.1)),
    nextWeek: Math.max(1, Math.ceil((threeMonthAvg / 4) * 1.25)),
    nextMonth: Math.max(1, Math.ceil(threeMonthAvg * 1.4))
  };
};
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
