const Contact = require('../models/contact.model');

function normalizeUserShape(user) {
  if (!user) return null;
  return {
    _id: user._id || user.id,
    username: user.username || user.contactUsername || '',
    profileImage: user.profileImage || user.avatar || user.profilePicUrl || ''
  };
}

async function ensureContactExists(userId, contactUser, options = {}) {
  const normalized = normalizeUserShape(contactUser);
  if (!userId || !normalized?._id) return null;

  return Contact.findOneAndUpdate(
    {
      userId,
      contactId: normalized._id
    },
    {
      $set: {
        contactUsername: normalized.username,
        profilePicUrl: normalized.profileImage,
        lastInteractionAt: options.lastInteractionAt || new Date()
      },
      $setOnInsert: {
        createdAt: new Date()
      }
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true
    }
  ).catch((err) => {
    if (err?.code === 11000) {
      return Contact.findOne({ userId, contactId: normalized._id });
    }
    throw err;
  });
}

async function syncChatParticipantsAsContacts(userA, userB, options = {}) {
  const a = normalizeUserShape(userA);
  const b = normalizeUserShape(userB);
  if (!a?._id || !b?._id) return [];

  return Promise.all([
    ensureContactExists(a._id, b, options),
    ensureContactExists(b._id, a, options)
  ]);
}

module.exports = {
  ensureContactExists,
  syncChatParticipantsAsContacts
};
