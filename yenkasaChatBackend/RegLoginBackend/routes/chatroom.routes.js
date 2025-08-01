router.post('/', authMiddleware, async (req, res) => {
  const userId = req.user.id;
  const { recipientId, username: recipientUsername } = req.body;

  console.log('--- Attempting to create/retrieve chat room ---');
  console.log(`Authenticated User ID (sender): ${userId}`);
  console.log(`Received recipientId: ${recipientId}`);
  console.log(`Received recipientUsername: "${recipientUsername}"`);

  if (!recipientId && !recipientUsername) {
    return res.status(400).json({ success: false, message: 'Recipient ID or username is required.' });
  }

  try {
    let otherUser = null;

    if (recipientId && mongoose.Types.ObjectId.isValid(recipientId)) {
      console.log(`Looking up user by ID: ${recipientId}`);
      otherUser = await User.findById(recipientId);
    } else if (recipientUsername) {
      console.log(`Looking up user by username: "${recipientUsername}"`);
      otherUser = await User.findOne({ username: new RegExp(`^${recipientUsername}$`, 'i') });
    }

    if (!otherUser) {
      console.error('❌ Recipient NOT FOUND using provided ID or username.');
      return res.status(404).json({ success: false, message: 'Recipient not found' });
    }

    if (otherUser._id.toString() === userId) {
      return res.status(400).json({ success: false, message: 'You cannot create a room with yourself' });
    }

    const existingRoom = await ChatRoom.findOne({
      participants: { $all: [new mongoose.Types.ObjectId(userId), otherUser._id] },
    });

    if (existingRoom) {
      return res.json({
        success: true,
        roomId: existingRoom._id,
        message: 'Chat room already exists',
        participant: {
          id: otherUser._id,
          username: otherUser.username,
          avatar: otherUser.avatar || null
        }
      });
    }

    const newRoom = new ChatRoom({
      participants: [new mongoose.Types.ObjectId(userId), otherUser._id],
    });
    await newRoom.save();

    return res.status(201).json({
      success: true,
      roomId: newRoom._id,
      message: 'New chat room created',
      participant: {
        id: otherUser._id,
        username: otherUser.username,
        avatar: otherUser.avatar || null
      }
    });
  } catch (err) {
    console.error('❌ Chat room creation error:', err.message);
    console.error(err.stack);
    res.status(500).json({ success: false, message: 'Failed to create chat room' });
  }
});
