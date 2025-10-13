// src/events/cpsGeneratorEvents.js
// -----------------------------------------------------------------------------
// CPS Generator Event Bus (Socket.IO facade)
//   - Namespace: /cps-generator
//   - Exposes safe emitters and a register function for server bootstrap
//   - Keeps all event names in one place for consistency
// -----------------------------------------------------------------------------

export const CPS_EVENTS = Object.freeze({
  STARTED: "generation_started",
  DIM_PROGRESS: "dimension_progress",
  VALIDATION: "validation_event",
  BACKUP: "backup_invoked",
  COMPLETED: "generation_completed",
});

let ioRef = null;       // Socket.IO server (set at bootstrap)
let nspRef = null;      // Namespace instance

/**
 * Register CPS generator namespace and listeners.
 * Call once at server bootstrap (after Socket.IO is created).
 * @param {import("socket.io").Server} io
 */
export function registerCpsGeneratorNamespace(io) {
  if (!io) {
    console.warn("[CPS][Events] registerCpsGeneratorNamespace called without IO");
    return null;
  }
  ioRef = io;
  nspRef = io.of("/cps-generator");

  // Optional: authenticate/authorize here if needed
  nspRef.on("connection", (socket) => {
    // Potential filters:
    //   - room join by batch_id
    //   - room join by userId
    // For now, accept all clients.
    // socket.on("join_batch", ({ batch_id }) => socket.join(`batch:${batch_id}`));

    socket.emit("hello", { ok: true, message: "Connected to CPS Generator stream." });

    socket.on("disconnect", () => {
      // no-op for now
    });
  });

  console.log("[CPS][Events] Namespace /cps-generator registered");
  return nspRef;
}

/** ---------------- Safe Emit Helpers ---------------- */

/**
 * Emit to namespace (broadcast).
 */
export function emitCpsEvent(event, payload) {
  try {
    if (nspRef) nspRef.emit(event, payload);
  } catch (_) {
    // swallow
  }
}

/**
 * Emit to a specific room if you later scope by batch or user.
 * Example room names (your choice):
 *  - `batch:<batch_id>`
 *  - `user:<user_id>`
 */
export function emitCpsEventToRoom(room, event, payload) {
  try {
    if (nspRef) nspRef.to(room).emit(event, payload);
  } catch (_) {
    // swallow
  }
}

/** ---------------- Convenience wrappers for core events ---------------- */

export const cpsEmit = {
  started: (data) => emitCpsEvent(CPS_EVENTS.STARTED, data),
  dimensionProgress: (data) => emitCpsEvent(CPS_EVENTS.DIM_PROGRESS, data),
  validation: (data) => emitCpsEvent(CPS_EVENTS.VALIDATION, data),
  backupInvoked: (data) => emitCpsEvent(CPS_EVENTS.BACKUP, data),
  completed: (data) => emitCpsEvent(CPS_EVENTS.COMPLETED, data),
};

/**
 * Get namespace (if already registered).
 */
export function getCpsNamespace() {
  return nspRef;
}
