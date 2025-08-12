// File: services/unreadCount.service.js

const UnreadMessageCount = require('../models/unreadMessageCount.model'); // Adjust path if necessary
const mongoose = require('mongoose'); // Needed for validating ObjectIds if you choose to

/**
 * Increments the unread message count for a specific user in a specific room.
 * If no entry exists for the user/room combination, it creates one.
 *
 * @param {string|mongoose.Types.ObjectId} userId - The ID of the user.
 * @param {string|mongoose.Types.ObjectId} roomId - The ID of the chat room.
 * @returns {Promise<{success: boolean, data?: object, error?: string}>}
 */
async function incrementUnreadCount(userId, roomId) {
    // Optional: Validate ObjectIds if they are expected to be valid MongoDB ObjectIds
    if (!mongoose.Types.ObjectId.isValid(userId) || !mongoose.Types.ObjectId.isValid(roomId)) {
        console.error(`Invalid userId or roomId provided to incrementUnreadCount. UserID: ${userId}, RoomID: ${roomId}`);
        return { success: false, error: "Invalid user ID or room ID format." };
    }

    try {
        const result = await UnreadMessageCount.findOneAndUpdate(
            { userId: userId, roomId: roomId },
            { 
                $inc: { count: 1 },
                $set: { updatedAt: new Date() } // Keep track of the last time the count was modified
            },
            { 
                upsert: true, // Create the document if it doesn't exist
                new: true,    // Return the modified document
                setDefaultsOnInsert: true // Ensure default values (like count: 0) are applied on insert if upserting
            }
        );
        // console.log(`Unread count updated for user ${userId} in room ${roomId}. New count: ${result.count}`);
        return { success: true, data: result };
    } catch (error) {
        console.error(`Error incrementing unread message count for user ${userId} in room ${roomId}:`, error);
        return { success: false, error: error.message };
    }
}

/**
 * Resets the unread message count to zero for a specific user in a specific room.
 * Also updates the lastReadTimestamp.
 *
 * @param {string|mongoose.Types.ObjectId} userId - The ID of the user.
 * @param {string|mongoose.Types.ObjectId} roomId - The ID of the chat room.
 * @returns {Promise<{success: boolean, data?: object, error?: string}>}
 */
async function resetUnreadCount(userId, roomId) {
    if (!mongoose.Types.ObjectId.isValid(userId) || !mongoose.Types.ObjectId.isValid(roomId)) {
        console.error(`Invalid userId or roomId provided to resetUnreadCount. UserID: ${userId}, RoomID: ${roomId}`);
        return { success: false, error: "Invalid user ID or room ID format." };
    }

    try {
        const result = await UnreadMessageCount.findOneAndUpdate(
            { userId: userId, roomId: roomId },
            { 
                $set: { 
                    count: 0, 
                    lastReadTimestamp: new Date(),
                    updatedAt: new Date()
                } 
            },
            { 
                new: true, // Return the modified document
                // No upsert here usually, as we only reset if an entry (potentially with count > 0) exists.
                // If you want to create an entry if it doesn't exist when resetting, add upsert:true.
            } 
        );

        if (result) {
            // console.log(`Unread count reset for user ${userId} in room ${roomId}.`);
        } else {
            // This case means no document was found for the userId/roomId.
            // You might want to create one with count 0 here if your logic requires it.
            // For now, just logging.
            // console.log(`No unread count entry found to reset for user ${userId} in room ${roomId}. (Or count was already 0 and no timestamp to update)`);
            // Optionally, create it if it doesn't exist:
            // await UnreadMessageCount.updateOne(
            //   { userId: userId, roomId: roomId },
            //   { $setOnInsert: { count: 0, lastReadTimestamp: new Date(), userId: userId, roomId: roomId } },
            //   { upsert: true }
            // );
        }
        return { success: true, data: result };
    } catch (error) {
        console.error(`Error resetting unread message count for user ${userId} in room ${roomId}:`, error);
        return { success: false, error: error.message };
    }
}

/**
 * Fetches the unread message count for a specific user in a specific room.
 *
 * @param {string|mongoose.Types.ObjectId} userId - The ID of the user.
 * @param {string|mongoose.Types.ObjectId} roomId - The ID of the chat room.
 * @returns {Promise<{success: boolean, count: number, error?: string}>}
 */
async function getUnreadCountForRoom(userId, roomId) {
    if (!mongoose.Types.ObjectId.isValid(userId) || !mongoose.Types.ObjectId.isValid(roomId)) {
        console.error(`Invalid userId or roomId provided to getUnreadCountForRoom. UserID: ${userId}, RoomID: ${roomId}`);
        return { success: false, error: "Invalid user ID or room ID format.", count: 0 };
    }

    try {
        const unreadEntry = await UnreadMessageCount.findOne({ userId: userId, roomId: roomId });
        const count = unreadEntry ? unreadEntry.count : 0;
        // console.log(`Fetched unread count for user ${userId} in room ${roomId}: ${count}`);
        return { success: true, count: count };
    } catch (error) {
        console.error(`Error fetching unread count for user ${userId} in room ${roomId}:`, error);
        return { success: false, error: error.message, count: 0 };
    }
}

/**
 * Fetches all unread message counts for a user across all rooms where count > 0.
 *
 * @param {string|mongoose.Types.ObjectId} userId - The ID of the user.
 * @returns {Promise<{success: boolean, data?: Array<object>, totalUnread?: number, error?: string}>}
 */
async function getAllUnreadCountsForUser(userId) {
    if (!mongoose.Types.ObjectId.isValid(userId)) {
        console.error(`Invalid userId provided to getAllUnreadCountsForUser. UserID: ${userId}`);
        return { success: false, error: "Invalid user ID format.", data: [] };
    }

    try {
        const unreadEntries = await UnreadMessageCount.find({ 
            userId: userId, 
            count: { $gt: 0 } 
        }).select('roomId count -_id'); // Select only roomId and count, exclude the main _id

        let totalUnread = 0;
        const roomCounts = unreadEntries.map(entry => {
            totalUnread += entry.count;
            return { roomId: entry.roomId, count: entry.count };
        });
        
        // console.log(`Fetched all unread counts for user ${userId}:`, roomCounts);
        return { success: true, data: roomCounts, totalUnread: totalUnread };
    } catch (error) {
        console.error(`Error fetching all unread counts for user ${userId}:`, error);
        return { success: false, error: error.message, data: [], totalUnread: 0 };
    }
}

module.exports = {
    incrementUnreadCount,
    resetUnreadCount,
    getUnreadCountForRoom,
    getAllUnreadCountsForUser,
};
