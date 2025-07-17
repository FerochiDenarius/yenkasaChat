// PATCH /api/auth/update-player-id/:userId
const updatePlayerId = async (req, res) => {
  try {
    const { playerId } = req.body;
    const { userId } = req.params;

    if (!playerId) {
      return res.status(400).json({ error: "Player ID is required" });
    }

    const user = await User.findByIdAndUpdate(userId, { playerId }, { new: true });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.status(200).json({ message: "Player ID updated", user });
  } catch (error) {
    console.error("Error updating playerId:", error);
    res.status(500).json({ error: "Server error updating playerId" });
  }
};
