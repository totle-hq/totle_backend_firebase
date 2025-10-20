import { Op } from "sequelize";
import { User } from "../../Models/UserModels/UserModel.js";
import { Session } from "../../Models/SessionModel.js";
import { BookedSession } from "../../Models/BookedSession.js";
// import { getDistance } from "../../utils/distance.js"; // Haversine or similar
import { CatalogueNode } from "../../Models/CatalogModels/catalogueNode.model.js";
function zonedTimeToUtc(dateString) {
  return new Date(dateString);
}





function calculateMismatchPercentage(learnerLangs = [], teacherLangs = []) {
  const matches = teacherLangs.filter(lang => learnerLangs.includes(lang)).length;
  const total = new Set([...learnerLangs, ...teacherLangs]).size;
  const mismatch = total - matches;
  return (mismatch / total) * 100;
}

function getScore(learner, teacher, mismatchPercent, distanceKm, learnerGender) {
  let score = 0;

  // 1. Gender preference
  const genderPoints = learnerGender === "female" ? 10 : 5;
  if (learner.gender && teacher.gender && learner.gender === teacher.gender) {
    score += genderPoints;
  }

  // 2. Language mismatch penalty
  score -= mismatchPercent; // lower is better

  // 3. Distance preference (further is better)
  score += distanceKm / 10; // tuned divisor

  return score;
}

function getDistance(coord1, coord2) {
  if (!coord1 || !coord2) return 0;

  const { lat: lat1, lon: lon1 } = coord1;
  const { lat: lat2, lon: lon2 } = coord2;

  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return 0;

  const toRad = (value) => (value * Math.PI) / 180;
  const R = 6371; // Earth's radius in km

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in km
}

export const bookFreeSession = async (req, res) => {
  console.log("🔥 Hit bookFreeSession API");

  try {
    const learner_id = req.user?.id;
    const { topic_id } = req.body;

    if (!learner_id || !topic_id) {
      return res.status(400).json({
        error: true,
        message: "Learner ID and Topic ID are required",
      });
    }

    // 🧩 Validate learner
    const learner = await User.findOne({ where: { id: learner_id } });
    if (!learner) {
      console.warn("⚠️ Learner not found:", learner_id);
      return res.status(404).json({ error: true, message: "Learner not found" });
    }

    // 🟢 Get all available sessions for the topic
    const availableSessions = await Session.findAll({
      where: { topic_id, status: "available" },
      raw: true,
    });

    console.log(`📊 Found ${availableSessions.length} available sessions`);
    if (availableSessions.length < 1) {
      console.warn("⚠️ Not enough available sessions for booking");
      return res.status(404).json({
        error: true,
        message: "Bridgers aren't available for this session yet",
      });
    }

    // 🧠 Match scoring logic
    let bestSession = null;
    let highestScore = -Infinity;

    for (const session of availableSessions) {
      const teacher = await User.findOne({
        where: { id: session.teacher_id },
      });

      if (!teacher) {
        console.warn("⚠️ Missing teacher for session:", session.session_id);
        continue;
      }

      if (!teacher.known_language_ids || !learner.known_language_ids) {
        console.warn("⚠️ Missing language data for teacher/learner");
        continue;
      }

      const mismatchPercent = calculateMismatchPercentage(
        learner.known_language_ids,
        teacher.known_language_ids
      );
      const distanceKm = getDistance(learner.location, teacher.location);
      const score = getScore(
        learner,
        teacher,
        mismatchPercent,
        distanceKm,
        learner.gender
      );

      console.log(
        `🧮 Score → Teacher ${teacher.firstName} (${session.session_id}): ${score}`
      );

      if (score > highestScore) {
        highestScore = score;
        bestSession = session;
      }
    }

    if (!bestSession) {
      console.error("❌ No suitable session found after scoring");
      return res
        .status(500)
        .json({ error: true, message: "No suitable session found" });
    }

    console.log("🏆 Best teacher:", bestSession.teacher_id);

    // 🕒 Time logic
    const now = new Date();
    const bufferMinutes = 30; // 🔁 30 for testing; use 120 for production
    const minStartIST = new Date(now.getTime() + bufferMinutes * 60 * 1000);

    // ✅ Convert cutoff to UTC for DB comparison
    const minStartUTC = zonedTimeToUtc(minStartIST, "Asia/Kolkata");

    console.log("⏰ Now (IST):", now.toLocaleString("en-IN"));
    console.log("⏰ Earliest allowed slot (IST):", minStartIST.toLocaleString("en-IN"));
    console.log("⏰ Earliest allowed slot (UTC):", minStartUTC.toISOString());

    // 🔍 Debug all available slots for this teacher
    const teacherSlots = await Session.findAll({
      where: {
        teacher_id: bestSession.teacher_id,
        topic_id,
        status: "available",
      },
      attributes: ["session_id", "scheduled_at"],
      order: [["scheduled_at", "ASC"]],
      raw: true,
    });

    console.log("📅 All slots for this teacher:");
    teacherSlots.forEach((s) =>
      console.log(
        ` → ${s.session_id}: ${new Date(s.scheduled_at).toISOString()} (${new Date(
          s.scheduled_at
        ).toLocaleString("en-IN")})`
      )
    );

    // ✅ Find next available slot after buffer time (no toUTC conversion)
    const nextSlot = await Session.findOne({
      where: {
        teacher_id: bestSession.teacher_id,
        topic_id,
        status: "available",
        scheduled_at: { [Op.gte]: minStartUTC },
      },
      order: [["scheduled_at", "ASC"]],
    });

    if (!nextSlot) {
      console.warn("⚠️ No suitable future slot found for booking");
      return res.status(404).json({
        error: true,
        message: "Bridgers for this session will be available soon.",
      });
    }

    console.log(
      `✅ Next slot found: ${nextSlot.session_id} at ${new Date(
        nextSlot.scheduled_at
      ).toLocaleString("en-IN")}`
    );

    // 🏷️ Get topic name
    const topic = await CatalogueNode.findOne({
      where: { node_id: topic_id },
      attributes: ["name"],
    });

    // 💾 Save booking
    await BookedSession.create({
      learner_id,
      teacher_id: nextSlot.teacher_id,
      topic_id,
      topic: topic?.name || "Unknown",
      session_id: nextSlot.session_id,
    });

    // 🔄 Update Session status
    await Session.update(
      { student_id: learner_id, status: "upcoming" },
      { where: { session_id: nextSlot.session_id } }
    );

    // 👨‍🏫 Fetch teacher details
    const teacher = await User.findOne({
      where: { id: nextSlot.teacher_id },
      attributes: ["firstName", "lastName"],
    });

    console.log(
      `🎯 Booking confirmed → ${topic?.name} with ${teacher.firstName} ${teacher.lastName}`
    );

    // ✅ Return response
    return res.status(200).json({
      success: true,
      message: "Session booked successfully",
      data: {
        sessionId: nextSlot.session_id,
        teacherName: `${teacher.firstName} ${teacher.lastName}`,
        topicName: topic?.name || "Unknown",
        scheduledAt: new Date(nextSlot.scheduled_at).toLocaleString("en-IN"),
      },
    });
  } catch (err) {
    console.error("❌ Error booking session:", err);
    return res
      .status(500)
      .json({ error: true, message: "Internal server error" });
  }
};
