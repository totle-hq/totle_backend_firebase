// sessionUtils.js

import { Op } from "sequelize";
import { Teachertopicstats } from "../Models/TeachertopicstatsModel.js";
import { Session } from "../Models/SessionModel.js";

// ----------------------------------------------------
// 1. Get eligible teacher IDs for a topic and tier
// ----------------------------------------------------
export const getEligibleTeacherIds = async (topic_id, tier = "free") => {
  const records = await Teachertopicstats.findAll({
    where: {
      node_id: topic_id,
      tier: tier,
    },
    attributes: ["teacherId"],
    raw: true,
  });
  return records.map((r) => r.teacherId);
};

// ----------------------------------------------------
// 2. Calculate language mismatch percentage
// ----------------------------------------------------
export const calculateMismatchPercentage = (arrA = [], arrB = []) => {
  const setA = new Set(arrA);
  const setB = new Set(arrB);
  const common = [...setA].filter((x) => setB.has(x));
  const total = arrA.length + arrB.length;
  if (total === 0) return 100;
  return 100 - (2 * common.length * 100) / total;
};

// ----------------------------------------------------
// 3. Get distance between two geo-locations (Haversine)
// ----------------------------------------------------
export const getDistance = (locA = {}, locB = {}) => {
  const R = 6371; // km
  const toRad = (v) => (v * Math.PI) / 180;
  if (!locA.lat || !locA.lng || !locB.lat || !locB.lng) return 10000;

  const dLat = toRad(locB.lat - locA.lat);
  const dLon = toRad(locB.lng - locA.lng);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(locA.lat)) *
      Math.cos(toRad(locB.lat)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
};

// ----------------------------------------------------
// 4. Score teacher based on mismatch, distance, etc.
// ----------------------------------------------------
export const scoreTeacher = (learner, teacher, mismatch, dist) => {
  const learnerAge = learner?.dob ? new Date().getFullYear() - new Date(learner.dob).getFullYear() : 20;
  const teacherAge = teacher?.dob ? new Date().getFullYear() - new Date(teacher.dob).getFullYear() : 25;
  const ageDiff = Math.abs(learnerAge - teacherAge);

  return (
    100 - ageDiff * 1.5 - mismatch * 0.6 - dist * 0.1
  );
};

// ----------------------------------------------------
// 5. Ensure buffer between sessions (30 min)
// ----------------------------------------------------
export const assertTeacherBuffer = async ({
  teacherId,
  startAt,
  durationMinutes,
  excludeSessionId = null,
}) => {
  const bufferMin = 30;
  const start = new Date(startAt);
  const end = new Date(start.getTime() + durationMinutes * 60000);
  const bufferStart = new Date(start.getTime() - bufferMin * 60000);
  const bufferEnd = new Date(end.getTime() + bufferMin * 60000);

  const clash = await Session.findOne({
    where: {
      teacher_id: teacherId,
      session_id: excludeSessionId ? { [Op.ne]: excludeSessionId } : { [Op.ne]: null },
      status: { [Op.in]: ["booked", "upcoming", "completed"] },
      scheduled_at: {
        [Op.lt]: bufferEnd,
      },
    },
    order: [["scheduled_at", "DESC"]],
  });

  if (clash) {
    const clashEnd = new Date(clash.scheduled_at.getTime() + clash.duration_minutes * 60000);
    if (clashEnd > bufferStart) {
      throw new Error("Teacher already has a session near this time");
    }
  }
};
