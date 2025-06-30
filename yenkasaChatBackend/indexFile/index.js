// yenkasaChat Backend with MongoDB
const express = require('express');
const { MongoClient, ObjectId, ServerApiVersion } = require('mongodb');
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// --- MongoDB Setup ---
const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("❌ MONGODB_URI missing in .env");
  process.exit(1);
}

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

let db;

async function connectDB() {
  try {
    await client.connect();
    db = client.db();
    console.log("✅ Connected to MongoDB");

    // Indexes
    await db.collection('messages').createIndex({ roomId: 1 });
    await db.collection('messages').createIndex({ roomId: 1, timestamp: -1 });
    await db.collection('chatRooms').createIndex({ participants: 1 });
    await db.collection('chatRooms').createIndex({ lastMessageAt: -1 });

    console.log("✅ Indexes created");
  } catch (err) {
    console.error("❌ MongoDB connection error:", err);
    process.exit(1);
  }
}

function isValidObjectId(id) {
  return ObjectId.isValid(id) && (String(new ObjectId(id)) === id);
}

// 1. Create or fetch chatroom
app.post('/chatrooms', async (req, res) => {
  const { userId, otherUserId } = req.body;

  if (!userId || !otherUserId || userId === otherUserId) {
    return res.status(400).json({ error: 'Invalid user IDs' });
  }

  if (!db) return res.status(503).json({ error: 'DB not connected' });

  const participants = [userId, otherUserId].sort();

  try {
    const existing = await db.collection('chatRooms').findOne({
      participants: { $all: participants, $size: 2 },
    });

    if (existing) {
      return res.status(200).json({
        roomId: existing._id.toString(),
        participants: existing.participants,
        createdAt: existing.createdAt,
        message: "Chat room already exists.",
      });
    }

    const newRoom = {
      participants,
      createdAt: new Date(),
      lastMessageAt: new Date(),
    };

    const result = await db.collection('chatRooms').insertOne(newRoom);

    res.status(201).json({
      roomId: result.insertedId.toString(),
      participants,
      createdAt: newRoom.createdAt,
    });
  } catch (err) {
    console.error("❌ /chatrooms error:", err);
    res.status(500).json({ error: "Failed to create chatroom" });
  }
});

// 2. Send a message with status
app.post('/messages', async (req, res) => {
  const { roomId, senderId, text } = req.body;

  if (!roomId || !senderId || !text?.trim()) {
    return res.status(400).json({ error: 'Invalid input' });
  }

  if (!isValidObjectId(roomId)) {
    return res.status(400).json({ error: 'Invalid roomId' });
  }

  if (!db) return res.status(503).json({ error: 'DB not connected' });

  try {
    const timestamp = new Date();
    const message = {
      roomId: new ObjectId(roomId),
      senderId,
      text: text.trim(),
      timestamp,
      status: "sent" // ✅ Add status field
    };

    const result = await db.collection('messages').insertOne(message);

    await db.collection('chatRooms').updateOne(
      { _id: new ObjectId(roomId) },
      { $set: { lastMessageAt: timestamp } }
    );

    res.status(201).json({
      messageId: result.insertedId.toString(),
      ...message,
      roomId,
      timestamp: timestamp.toISOString(),
    });
  } catch (err) {
    console.error("❌ /messages error:", err);
    res.status(500).json({ error: "Failed to send message" });
  }
});

// 3. Get messages for a room (include status)
app.get('/chatrooms/:roomId/messages', async (req, res) => {
  const { roomId } = req.params;
  const limit = parseInt(req.query.limit) || 50;
  const before = req.query.beforeTimestamp;

  if (!isValidObjectId(roomId)) {
    return res.status(400).json({ error: 'Invalid roomId' });
  }

  if (!db) return res.status(503).json({ error: 'DB not connected' });

  try {
    const query = { roomId: new ObjectId(roomId) };

    if (before) {
      const beforeDate = new Date(before);
      if (!isNaN(beforeDate.getTime())) {
        query.timestamp = { $lt: beforeDate };
      } else {
        return res.status(400).json({ error: 'Invalid timestamp' });
      }
    }

    const messages = await db.collection('messages')
      .find(query)
      .sort({ timestamp: -1 })
      .limit(limit)
      .toArray();

    res.status(200).json(messages.reverse().map(msg => ({
      messageId: msg._id.toString(),
      roomId: msg.roomId.toString(),
      senderId: msg.senderId,
      text: msg.text,
      timestamp: msg.timestamp.toISOString(),
      status: msg.status || "sent"
    })));
  } catch (err) {
    console.error("❌ /chatrooms/:roomId/messages error:", err);
    res.status(500).json({ error: "Failed to get messages" });
  }
});

// 4. Get chatrooms for user (same as before)
app.get('/users/:userId/chatrooms', async (req, res) => {
  const { userId } = req.params;

  if (!userId || !db) {
    return res.status(400).json({ error: 'Invalid request or DB not ready' });
  }

  try {
    const rooms = await db.collection('chatRooms')
      .find({ participants: userId })
      .sort({ lastMessageAt: -1 })
      .toArray();

    const enriched = await Promise.all(rooms.map(async room => {
      const lastMsg = await db.collection('messages')
        .find({ roomId: room._id })
        .sort({ timestamp: -1 })
        .limit(1)
        .toArray();

      return {
        roomId: room._id.toString(),
        participants: room.participants,
        createdAt: room.createdAt.toISOString(),
        lastMessageAt: room.lastMessageAt.toISOString(),
        lastMessage: lastMsg[0]
          ? {
              text: lastMsg[0].text,
              senderId: lastMsg[0].senderId,
              timestamp: lastMsg[0].timestamp.toISOString(),
              status: lastMsg[0].status || "sent"
            }
          : null,
      };
    }));

    res.status(200).json(enriched);
  } catch (err) {
    console.error("❌ /users/:userId/chatrooms error:", err);
    res.status(500).json({ error: "Failed to get chatrooms" });
  }
});

async function startServer() {
  await connectDB();
  app.listen(PORT, () => {
    console.log(`🚀 Yenkasa backend running: http://localhost:${PORT}`);
  });
}

startServer();

process.on('unhandledRejection', console.error);
process.on('uncaughtException', console.error);
