// src/controllers/SessionStreamControllers/updateSessionTiming.controller.js
import { Session } from "../../Models/SessionModel.js";

/**
 * POST /api/session/update-timing
 * Body: { sessionId: <uuid>, newTime: <ISO string> }
 *
 * Used by Helix (Ops) admins to postpone / prepone a session.
 */
export const updateSessionTiming = async (req, res) => {
  console.log("================= 🧩 updateSessionTiming START =================");

  try {
    /* ---------------------------------------------------------------
       STEP 1. Raw Input Logging
    ---------------------------------------------------------------- */
    console.log("🧩 [1] Raw headers:", req.headers);
    console.log("🧩 [2] Raw body:", req.body);
    console.log("🧩 [3] Authenticated user:", req.user || "(no user in request)");

    const { sessionId, newTime } = req.body || {};

    if (!sessionId || !newTime) {
      console.warn("⚠️ [VALIDATION] Missing sessionId or newTime in body");
      console.log("================= 🧩 updateSessionTiming END =================");
      return res.status(400).json({
        success: false,
        message: "sessionId and newTime are required",
      });
    }

    /* ---------------------------------------------------------------
       STEP 2. Fetch Session
    ---------------------------------------------------------------- */
    console.log(`🧩 [4] Looking up session → ${sessionId}`);

    const session = await Session.findByPk(sessionId);
    if (!session) {
      console.warn(`⚠️ [NOT FOUND] Session ${sessionId} does not exist.`);
      console.log("================= 🧩 updateSessionTiming END =================");
      return res
        .status(404)
        .json({ success: false, message: "Session not found" });
    }

    console.log("🧩 [5] Session found:", {
      id: session.session_id,
      teacher_id: session.teacher_id,
      student_id: session.student_id,
      scheduled_at: session.scheduled_at,
      status: session.status,
    });

    /* ---------------------------------------------------------------
       STEP 3. Validate New Time
    ---------------------------------------------------------------- */
    console.log("🧩 [6] Parsing newTime:", newTime);
    const parsedTime = new Date(newTime);

    if (isNaN(parsedTime.getTime())) {
      console.error("❌ [PARSING ERROR] newTime invalid:", newTime);
      console.log("================= 🧩 updateSessionTiming END =================");
      return res.status(400).json({
        success: false,
        message: "Invalid date/time format",
        received: newTime,
      });
    }

    const now = new Date();
    if (parsedTime < now) {
      console.warn(
        `⚠️ [VALIDATION] Attempted to set past time → ${parsedTime.toISOString()} < ${now.toISOString()}`
      );
      console.log("================= 🧩 updateSessionTiming END =================");
      return res.status(400).json({
        success: false,
        message: "Cannot set session time in the past",
      });
    }

    /* ---------------------------------------------------------------
       STEP 4. Perform Update
    ---------------------------------------------------------------- */
    console.log(
      `🧩 [7] Updating session ${sessionId} scheduled_at → ${parsedTime.toISOString()}`
    );

    const oldTime = session.scheduled_at;
    session.scheduled_at = parsedTime;
    await session.save();

    console.log("✅ [8] Session updated successfully!");
    console.log("🧩 [8a] Old Time:", oldTime);
    console.log("🧩 [8b] New Time:", parsedTime);
    console.log("🧩 [8c] Database Save Complete ✓");

    /* ---------------------------------------------------------------
       STEP 5. Respond to Client
    ---------------------------------------------------------------- */
    const responseData = {
      success: true,
      message: "Session time updated successfully",
      data: {
        session_id: sessionId,
        oldTime,
        newTime: parsedTime,
        updatedBy: req.user?.id || "system",
      },
    };

    console.log("🧩 [9] Response Payload:", responseData);
    console.log("================= 🧩 updateSessionTiming END =================");

    return res.status(200).json(responseData);
  } catch (err) {
    /* ---------------------------------------------------------------
       STEP 6. Catch-All Error Handler
    ---------------------------------------------------------------- */
    console.error("❌ [ERROR] updateSessionTiming Exception:", err);
    console.error(err.stack);
    console.log("================= 🧩 updateSessionTiming FAIL =================");

    return res.status(500).json({
      success: false,
      message: "Failed to update session time",
      error: err.message || err,
    });
  }
};
