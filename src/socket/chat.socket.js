import DeptChatMessage from "../Models/DeptChatMessage.js";

export function registerChatHandlers(io) {
  io.on("connection", (socket) => {
    console.log("🔗 User connected:", socket.id);

    // Join department room
    socket.on("chat:join", ({ department, user }) => {
      socket.join(`chat:${department}`);
      io.to(`chat:${department}`).emit("chat:presence", {
        user,
        status: "online",
      });
    });

    // Leave room
    socket.on("chat:leave", ({ department, user }) => {
      socket.leave(`chat:${department}`);
      io.to(`chat:${department}`).emit("chat:presence", {
        user,
        status: "offline",
      });
    });

    // Handle message send
    socket.on("chat:message", async (payload) => {
      const { department, authorId, authorName, authorGlobalRole, authorDeptRole, content } = payload;

      try {
        // Save to DB
        const msg = await DeptChatMessage.create({
          department,
          authorId,
          authorName,
          authorGlobalRole,
          authorDeptRole,
          content,
        });

        // Broadcast to everyone in the room
        io.to(`chat:${department}`).emit("chat:message", {
          id: msg.id,
          department,
          authorId,
          authorName,
          authorGlobalRole,
          authorDeptRole,
          content,
          createdAt: msg.createdAt,
        });
      } catch (err) {
        console.error("❌ Error saving chat message:", err);
      }
    });
  });
}
