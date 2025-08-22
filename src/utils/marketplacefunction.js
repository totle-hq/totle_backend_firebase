import { Sequelize } from "sequelize";
import { Session } from "../Models/SessionModel.js";
import { sequelize1 } from "../config/sequelize.js";

import { User } from "../Models/UserModels/UserModel.js";


export const getProjections = async (monthSessions, filters = {}) => {
  try {
    const { tier, level, languageId, sessionFilters = {} } = filters;
    const today = new Date();
    today.setHours(0, 0, 0, 0);


    monthSessions = Number(monthSessions) || 0;
    const currentDate = today.getDate();
    const totalDaysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();

 
    const baseWhere = { status: 'completed', ...sessionFilters };

    if (Array.isArray(baseWhere.topic_id)) {
      baseWhere.topic_id = { [Sequelize.Op.in]: baseWhere.topic_id };
    }


    if (tier && tier !== 'all') baseWhere.session_tier = tier;
    if (level && level !== 'All') baseWhere.session_level = level;

    const teacherInclude = languageId
      ? [{ model: User, as: 'teacher', where: { preferred_language_id: languageId }, attributes: [], required: true }]
      : [];

 
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

   
    if (dataAgeDays < 90) {
      return calculateNewDataProjections(monthSessions, currentDate, totalDaysInMonth);
    } else {
      return await calculateHistoricalProjections(baseWhere, teacherInclude, monthSessions, totalDaysInMonth);
    }

  } catch (error) {
    console.error("Error in getProjections:", error);
    return {
      nextDay: Math.max(0, Math.ceil(monthSessions / 30)),
      nextWeek: Math.max(0, Math.ceil(monthSessions / 4)),
      nextMonth: Math.max(0, Math.ceil(monthSessions * 1.1))
    };
  }
};


function calculateBasicProjections(monthSessions, currentDate, totalDaysInMonth) {
  const daysPassed = Math.max(1, currentDate);
  const dailyRate = monthSessions / daysPassed;
  const projectedMonthTotal = dailyRate * totalDaysInMonth;

  return {
    nextDay: Math.max(0, Math.round(dailyRate)),
    nextWeek: Math.max(0, Math.round(dailyRate * 7)),
    nextMonth: Math.round(projectedMonthTotal)
  };
}

function calculateNewDataProjections(monthSessions, currentDate, totalDaysInMonth) {
  const daysPassed = Math.max(1, currentDate);
  const dailyRate = monthSessions / daysPassed;
  const projectedMonthTotal = dailyRate * totalDaysInMonth;

  const growthFactor = 1.1; 
  return {
    nextDay: Math.max(0, Math.round(dailyRate * growthFactor)),
    nextWeek: Math.max(0, Math.round(dailyRate * 7 * growthFactor)),
    nextMonth: Math.round(projectedMonthTotal * growthFactor)
  };
}

async function calculateHistoricalProjections(baseWhere, teacherInclude, monthSessions, totalDaysInMonth) {
  const today = new Date();
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - 6); // last 6 months

  // 1. Get all sessions in the last 6 months
  const sessions = await Session.findAll({
    attributes: ['completed_at'],
    where: {
      ...baseWhere,
      completed_at: { [Sequelize.Op.gte]: startDate }
    },
    ...(teacherInclude.length > 0 && { include: teacherInclude }),
    raw: true
  });

  if (!sessions.length) {
    return {
      nextDay: Math.max(0, Math.round(monthSessions / totalDaysInMonth)),
      nextWeek: Math.max(0, Math.round(monthSessions / 4)),
      nextMonth: Math.round(monthSessions) // flat, no growth
    };
  }

  // ---- Aggregate sessions ----
  const weekCounts = {};
  const monthCounts = {};
  const dailyCounts = {};

  sessions.forEach(s => {
    const date = new Date(s.completed_at);
    const dayKey = date.toDateString();
    dailyCounts[dayKey] = (dailyCounts[dayKey] || 0) + 1;

    const weekKey = `${date.getFullYear()}-W${getWeekNumber(date)}`;
    weekCounts[weekKey] = (weekCounts[weekKey] || 0) + 1;

    const monthKey = `${date.getFullYear()}-${date.getMonth() + 1}`;
    monthCounts[monthKey] = (monthCounts[monthKey] || 0) + 1;
  });

  // ---- Daily Projection ----
  const todayDay = today.getDay();
  const last4SameWeekdays = Object.entries(dailyCounts)
    .map(([k, v]) => ({ date: new Date(k), count: v }))
    .filter(d => d.date.getDay() === todayDay)
    .sort((a, b) => a.date - b.date)
    .slice(-4)
    .map(d => d.count);

  let dailyAvg = getWeightedAverage(last4SameWeekdays, [0.5, 0.3, 0.2, 0.1]);
  const dailyTrend = getChangeRate(last4SameWeekdays);
  dailyAvg = Math.max(0, Math.round(dailyAvg * (1 + dailyTrend)));

  // ---- Weekly Projection ----
  const currentWeekKey = `${today.getFullYear()}-W${getWeekNumber(today)}`;
  const currentWeekCount = weekCounts[currentWeekKey] || 0;

  const lastFullWeeks = Object.keys(weekCounts)
    .sort()
    .filter(k => k !== currentWeekKey)
    .slice(-4);

  const lastFullWeeksCounts = lastFullWeeks.map(k => weekCounts[k]);
  let weeklyAvg = getWeightedAverage(lastFullWeeksCounts, [0.5, 0.3, 0.2]);
  const weeklyTrend = getChangeRate(lastFullWeeksCounts);

  // normalize current week (scale to full week)
  const normalizedCurrentWeek = today.getDay() > 0 ? (currentWeekCount / today.getDay()) * 7 : currentWeekCount;
  let projectedWeek = Math.max(0, Math.round((weeklyAvg * (1 + weeklyTrend) + normalizedCurrentWeek) / 2));

  // if no activity at all → force down to 0
  if (currentWeekCount === 0 && weeklyAvg < 1) {
    projectedWeek = 0;
  }

  // ---- Monthly Projection ----
  const currentMonthKey = `${today.getFullYear()}-${today.getMonth() + 1}`;
  const currentMonthCount = monthCounts[currentMonthKey] || 0;

  const lastFullMonths = Object.keys(monthCounts)
    .sort()
    .filter(k => k !== currentMonthKey)
    .slice(-3);

  const lastFullMonthsCounts = lastFullMonths.map(k => monthCounts[k]);
  let monthlyAvg = getWeightedAverage(lastFullMonthsCounts, [0.6, 0.25, 0.15]);
  const monthlyTrend = getChangeRate(lastFullMonthsCounts);

  const normalizedCurrentMonth = (today.getDate() > 0) ? (currentMonthCount / today.getDate()) * totalDaysInMonth : 0;
  let projectedMonth = Math.max(0, Math.round((monthlyAvg * (1 + monthlyTrend) + normalizedCurrentMonth) / 2));

  if (currentMonthCount === 0 && monthlyAvg < 1) {
    projectedMonth = 0;
  }

  return {
    nextDay: dailyAvg,
    nextWeek: projectedWeek,
    nextMonth: projectedMonth
  };
}

function getWeightedAverage(values, weights) {
  if (!values.length) return 0;
  let total = 0, weightSum = 0;
  for (let i = 0; i < values.length; i++) {
    const w = weights[i] || (1 / values.length);
    total += values[i] * w;
    weightSum += w;
  }
  return total / weightSum;
}

function getChangeRate(values) {
  if (values.length < 2) return 0;
  let changes = [];
  for (let i = 1; i < values.length; i++) {
    const prev = values[i - 1] || 1;
    changes.push((values[i] - prev) / prev);
  }
  return changes.reduce((a, b) => a + b, 0) / changes.length;
}

function getWeekNumber(d) {
  const onejan = new Date(d.getFullYear(), 0, 1);
  return Math.ceil((((d - onejan) / 86400000) + onejan.getDay() + 1) / 7);
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
