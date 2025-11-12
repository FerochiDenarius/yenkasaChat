require('dotenv').config();
const mongoose = require('mongoose');
const path = require('path');

const User = require(path.join(__dirname, '../models/user.model.js'));
const Permission = require(path.join(__dirname, '../models/permission.model.js'));

async function run() {
  try {
    console.log('🚀 Connecting to MongoDB...');
    console.log('🌐 URI:', process.env.MONGODB_URI);
    await mongoose.connect(process.env.MONGODB_URI);

    const userEmail = 'ofosumenyabrightkofi@gmail.com';
    console.log('🔍 Searching for user:', userEmail);

    const user = await User.findOne({ email: userEmail });
    if (!user) throw new Error(`No user found with email ${userEmail}`);
    console.log('👤 Found user before update:', user);

    // Get senior_developer Permission object
    const seniorPerm = await Permission.findOne({ role: 'senior_developer' });
    if (!seniorPerm) throw new Error('❌ senior_developer permissions not found. Seed them first!');

    // Assign role object to user
    user.role = seniorPerm._id; // <-- reference to Permission document
    user.verified = true;

    await user.save();

    // ✅ Print populated role and permissions
    const updatedUser = await User.findOne({ email: userEmail }).populate('role');
    console.log('✅ User updated successfully!');
    console.log('👤 Updated user:', updatedUser);

    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  }
}

run();
