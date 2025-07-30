import { Op } from "sequelize";
import { User } from "../../Models/UserModels/UserModel.js";
import { Session } from "../../Models/SessionModel.js";
import { BookedSession } from "../../Models/BookedSession.js";
// import { getDistance } from "../../utils/distance.js"; // Haversine or similar
import { CatalogueNode } from "../../Models/CatalogModels/catalogueNode.model.js";

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
      return res.status(400).json({ error: true, message: "Learner ID and Topic ID are required" });
    }

    const learner = await User.findOne({ where: { id: learner_id } });
    if (!learner) {
      console.warn("⚠️ Learner not found:", learner_id);
      return res.status(404).json({ error: true, message: "Learner not found" });
    }
    // console.log("Session associations:", Object.keys(Session.associations));


    const availableSessions = await Session.findAll({
      where: { topic_id, status: "available" },
      raw: true,
    });


    if (availableSessions.length < 2) {
      console.warn("⚠️ Not enough available sessions for booking", availableSessions.length);
      return res.status(404).json({ error: true, message: "Not enough available sessions" });
    }

    // 🧠 Match Scoring
    let bestSession = null;
    let highestScore = -Infinity;

    for (const session of availableSessions) {
      // console.log("session:", session);
      let teacher = await User.findOne({
        where: { id: session.teacher_id }
      });

      console.log("id", session.teacher_id)
      
      if(!teacher.known_language_ids) {
        console.error("❌ Teacher has no known languages, can't book session");
        return res.status(400).json({ error: true, message: "❌ Teacher has no known languages, can't book session" });
      }

      if(!learner.known_language_ids) {
        console.error("❌ Learner has no known languages, can't book session");
        return res.status(400).json({ error: true, message: "❌ Learner has no known languages, can't book session" });
      }
        
      // console.log("Matching session:", session.id, "with teacher:", teacher);
      const mismatchPercent = calculateMismatchPercentage(
        learner.known_language_ids || [],
        teacher.known_language_ids || []
      );


      const distanceKm = getDistance(learner.location, teacher.location); // IP or lat/lng based
      const score = getScore(learner, teacher, mismatchPercent, distanceKm, learner.gender);
      console.log("score for session", session.id, ":", score);
      if (score > highestScore) {
        highestScore = score;
        bestSession = session;
      }
    }

    if (!bestSession) {
      return res.status(500).json({ error: true, message: "No suitable session found" });
    }

    // ⏰ Find a slot at least 2 hours from now
    const now = new Date();
    const twoHoursLater = new Date(now.getTime() + 2 * 60 * 60 * 1000);

    const nextSlot = await Session.findOne({
      where: {
        teacher_id: bestSession.teacher_id,
        topic_id,
        status: "available",
        scheduled_at: { [Op.gte]: twoHoursLater }
      },
      order: [["scheduled_at", "ASC"]]
    });
    console.log("Next slot found:", nextSlot ? nextSlot.id : "None");

    if (!nextSlot) {
      console.warn("⚠️ No suitable future slot found for booking");
      return res.status(404).json({ error: true, message: "No suitable future slot found" });
    }

    let topicName = await CatalogueNode.findOne({
      where: { node_id: topic_id },
      attributes: ['name']
    });

    // Save booking
    await BookedSession.create({
      learner_id,
      teacher_id: nextSlot.teacher_id,
      topic_id,
      topic: topicName.name || "Unknown",
    });

    await Session.update(
      { student_id: learner_id, status: "upcoming" },
      { where: { id: nextSlot.id } }
    );

    const teacher = await User.findOne({
      where: { id: nextSlot.teacher_id },
      attributes: ['firstName', 'lastName']
    });

    const topic = await CatalogueNode.findOne({
      where: { node_id: topic_id },
      attributes: ['name']
    });

    return res.status(200).json({
      success: true,
      message: "Session booked successfully",
      data: {
        sessionId: nextSlot.id,
        teacherName: `${teacher.firstName} ${teacher.lastName}`,
        topicName: topic?.name || "Unknown",
        scheduledAt: nextSlot.scheduled_at,
      }
    });

  } catch (err) {
    console.error("❌ Error booking session:", err);
    return res.status(500).json({ error: true, message: "Internal server error" });
  }
};
