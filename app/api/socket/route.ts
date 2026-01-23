import { Server as SocketIOServer } from "socket.io";
import { Server as HTTPServer } from "http";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import {
  chatRooms,
  chatMessages,
  chatRoomParticipants,
  user,
} from "@/db/schema";
import { eq, and } from "drizzle-orm";

// Global Socket.io server instance (reused across requests)
let io: SocketIOServer | null = null;
let httpServer: HTTPServer | null = null;

function getIO(): SocketIOServer {
  if (!io) {
    // Create HTTP server wrapper for Socket.io
    httpServer = new HTTPServer();
    io = new SocketIOServer(httpServer, {
      path: "/api/socket",
      addTrailingSlash: false,
      cors: {
        origin: process.env.NEXT_PUBLIC_APP_URL || "*",
        methods: ["GET", "POST"],
        credentials: true,
      },
      transports: ["websocket", "polling"],
    });

    // Authentication middleware
    io.use(async (socket, next) => {
      try {
        // Get cookies from handshake (Socket.io automatically includes cookies)
        const cookieHeader = socket.handshake.headers.cookie || "";

        // Verify session with Better Auth using cookies
        const session = await auth.api.getSession({
          headers: new Headers({
            cookie: cookieHeader,
          }),
        });

        if (!session?.user) {
          return next(new Error("Invalid session"));
        }

        // Attach user to socket
        socket.data.userId = session.user.id;
        socket.data.userEmail = session.user.email;
        socket.data.userName = session.user.name;

        next();
      } catch (error) {
        console.error("[Socket] Auth error:", error);
        next(new Error("Authentication failed"));
      }
    });

    // Connection handler
    io.on("connection", async (socket) => {
      const userId = socket.data.userId;
      console.log(`[Socket] User connected: ${userId}`);

      // Join user's personal room for notifications
      socket.join(`user:${userId}`);

      // Handle room joining
      socket.on("join-room", async ({ roomId }: { roomId: string }) => {
        try {
          // Verify user has access to this room
          const hasAccess = await verifyRoomAccess(roomId, userId);

          if (!hasAccess) {
            socket.emit("error", { message: "Access denied to this room" });
            return;
          }

          socket.join(`room:${roomId}`);
          console.log(`[Socket] User ${userId} joined room ${roomId}`);

          // Notify others in room (optional)
          socket.to(`room:${roomId}`).emit("user-joined", {
            userId,
            roomId,
          });
        } catch (error) {
          console.error("[Socket] Error joining room:", error);
          socket.emit("error", { message: "Failed to join room" });
        }
      });

      // Handle leaving room
      socket.on("leave-room", ({ roomId }: { roomId: string }) => {
        socket.leave(`room:${roomId}`);
        console.log(`[Socket] User ${userId} left room ${roomId}`);
      });

      // Handle sending messages
      socket.on(
        "send-message",
        async (data: {
          roomId: string;
          text?: string;
          mediaUrl?: string;
          mediaType?: string;
          mediaFileName?: string;
        }) => {
          try {
            console.log("[Socket] send-message received:", {
              roomId: data.roomId,
              text: data.text,
              userId,
            });

            const { roomId, text, mediaUrl, mediaType, mediaFileName } = data;

            if (!roomId) {
              socket.emit("error", { message: "Room ID is required" });
              return;
            }

            if (!text && !mediaUrl) {
              socket.emit("error", { message: "Message text or media is required" });
              return;
            }

            // Verify access
            const hasAccess = await verifyRoomAccess(roomId, userId);
            if (!hasAccess) {
              console.error("[Socket] Access denied for room:", { roomId, userId });
              socket.emit("error", { message: "Access denied" });
              return;
            }

            // Check if room is blocked
            const [room] = await db
              .select()
              .from(chatRooms)
              .where(eq(chatRooms.id, roomId))
              .limit(1);

            if (room?.status === "blocked") {
              socket.emit("error", { message: "Chat is blocked" });
              return;
            }

            // Get user role for this room
            const senderRole = await getUserRoleInRoom(roomId, userId);

            // Save message to database
            console.log("[Socket] Saving message to database:", {
              roomId,
              senderId: userId,
              senderRole,
              text: text?.substring(0, 50),
            });

            const [message] = await db
              .insert(chatMessages)
              .values({
                roomId,
                senderId: userId,
                senderRole,
                text: text || null,
                mediaUrl: mediaUrl || null,
                mediaType: mediaType || null,
                mediaFileName: mediaFileName || null,
              })
              .returning();

            console.log("[Socket] Message saved:", {
              messageId: message.id,
              roomId: message.roomId,
            });

            // Update room's last message
            await db
              .update(chatRooms)
              .set({
                lastMessageAt: new Date(),
                lastMessagePreview: text?.substring(0, 100) || "[Media]",
                updatedAt: new Date(),
              })
              .where(eq(chatRooms.id, roomId));

            // Get sender info
            const [sender] = await db
              .select({
                id: user.id,
                name: user.name,
                image: user.image,
              })
              .from(user)
              .where(eq(user.id, userId))
              .limit(1);

            // Broadcast to room
            const messagePayload = {
              ...message,
              sender: sender || {
                id: userId,
                name: socket.data.userName,
                image: null,
              },
            };

            console.log("[Socket] Broadcasting message to room:", {
              roomId,
              messageId: message.id,
              roomName: `room:${roomId}`,
            });

            io!.to(`room:${roomId}`).emit("new-message", messagePayload);

            // Also emit to sender to confirm
            socket.emit("new-message", messagePayload);

            // Notify participants not in room
            const participants = await db
              .select({ userId: chatRoomParticipants.userId })
              .from(chatRoomParticipants)
              .where(eq(chatRoomParticipants.roomId, roomId));

            participants.forEach((p) => {
              if (p.userId !== userId) {
                io!.to(`user:${p.userId}`).emit("room-message", {
                  roomId,
                  message: {
                    ...message,
                    sender: sender || {
                      id: userId,
                      name: socket.data.userName,
                      image: null,
                    },
                  },
                });
              }
            });
          } catch (error) {
            console.error("[Socket] Error sending message:", error);
            socket.emit("error", { message: "Failed to send message" });
          }
        }
      );

      // Handle message deletion
      socket.on(
        "delete-message",
        async ({
          messageId,
          roomId,
        }: {
          messageId: string;
          roomId: string;
        }) => {
          try {
            // Verify message belongs to user or user is admin
            const [message] = await db
              .select()
              .from(chatMessages)
              .where(eq(chatMessages.id, messageId))
              .limit(1);

            if (!message) {
              socket.emit("error", { message: "Message not found" });
              return;
            }

            // Check permission (sender or admin)
            const isAdmin = await checkIsAdmin(userId);
            if (message.senderId !== userId && !isAdmin) {
              socket.emit("error", { message: "Permission denied" });
              return;
            }

            // Mark as deleted
            await db
              .update(chatMessages)
              .set({
                isDeleted: true,
                deletedAt: new Date(),
              })
              .where(eq(chatMessages.id, messageId));

            // Broadcast deletion
            io!.to(`room:${roomId}`).emit("message-deleted", { messageId });
          } catch (error) {
            console.error("[Socket] Error deleting message:", error);
            socket.emit("error", { message: "Failed to delete message" });
          }
        }
      );

      // Handle admin joining room (invisible)
      socket.on("admin-join-room", async ({ roomId }: { roomId: string }) => {
        try {
          const isAdmin = await checkIsAdmin(userId);
          if (!isAdmin) {
            socket.emit("error", { message: "Admin access required" });
            return;
          }

          // Verify room exists
          const hasAccess = await verifyRoomAccess(roomId, userId);
          if (!hasAccess) {
            socket.emit("error", { message: "Room not found" });
            return;
          }

          // Add admin as participant (invisible)
          await db
            .insert(chatRoomParticipants)
            .values({
              roomId,
              userId,
              role: "admin",
              isVisible: false, // Invisible by default
            })
            .onConflictDoNothing();

          socket.join(`room:${roomId}`);
          console.log(
            `[Socket] Admin ${userId} joined room ${roomId} (invisible)`
          );
        } catch (error) {
          console.error("[Socket] Error admin joining room:", error);
          socket.emit("error", { message: "Failed to join room" });
        }
      });

      // Handle blocking chat
      socket.on("block-chat", async ({ roomId }: { roomId: string }) => {
        try {
          // Verify user is seller or admin
          const [room] = await db
            .select()
            .from(chatRooms)
            .where(eq(chatRooms.id, roomId))
            .limit(1);

          if (!room) {
            socket.emit("error", { message: "Room not found" });
            return;
          }

          const isAdmin = await checkIsAdmin(userId);
          const isSeller = room.sellerId === userId;

          if (!isAdmin && !isSeller) {
            socket.emit("error", { message: "Permission denied" });
            return;
          }

          // Block room
          await db
            .update(chatRooms)
            .set({
              status: "blocked",
              blockedBy: userId,
              blockedAt: new Date(),
            })
            .where(eq(chatRooms.id, roomId));

          // Notify room
          io!
            .to(`room:${roomId}`)
            .emit("chat-blocked", { roomId, blockedBy: userId });
        } catch (error) {
          console.error("[Socket] Error blocking chat:", error);
          socket.emit("error", { message: "Failed to block chat" });
        }
      });

      // Disconnect handler
      socket.on("disconnect", () => {
        console.log(`[Socket] User disconnected: ${userId}`);
      });
    });
  }

  return io;
}

// Helper functions
async function verifyRoomAccess(
  roomId: string,
  userId: string
): Promise<boolean> {
  const [room] = await db
    .select()
    .from(chatRooms)
    .where(eq(chatRooms.id, roomId))
    .limit(1);

  if (!room) return false;

  // Check if user is buyer, seller, or admin participant
  const [participant] = await db
    .select()
    .from(chatRoomParticipants)
    .where(
      and(
        eq(chatRoomParticipants.roomId, roomId),
        eq(chatRoomParticipants.userId, userId)
      )
    )
    .limit(1);

  return (
    room.buyerId === userId ||
    room.sellerId === userId ||
    participant !== undefined ||
    (await checkIsAdmin(userId))
  );
}

async function getUserRoleInRoom(
  roomId: string,
  userId: string
): Promise<"customer" | "seller" | "admin"> {
  const [room] = await db
    .select()
    .from(chatRooms)
    .where(eq(chatRooms.id, roomId))
    .limit(1);

  if (!room) throw new Error("Room not found");

  if (room.buyerId === userId) return "customer";
  if (room.sellerId === userId) return "seller";
  if (await checkIsAdmin(userId)) return "admin";

  throw new Error("User not authorized in room");
}

async function checkIsAdmin(userId: string): Promise<boolean> {
  const { roles, userRoles } = await import("@/db/schema");
  const userRole = await db
    .select()
    .from(userRoles)
    .innerJoin(roles, eq(userRoles.roleId, roles.id))
    .where(eq(userRoles.userId, userId))
    .limit(1);

  return userRole.some((r) => r.roles.name.toLowerCase() === "admin");
}

// Next.js API Route handlers
export async function GET() {
  // Upgrade to WebSocket
  if (!io) {
    getIO();
  }

  // Return connection info
  return new Response(JSON.stringify({ status: "Socket.io server ready" }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST() {
  // Handle Socket.io upgrade
  if (!io) {
    getIO();
  }

  return new Response(JSON.stringify({ status: "ok" }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
