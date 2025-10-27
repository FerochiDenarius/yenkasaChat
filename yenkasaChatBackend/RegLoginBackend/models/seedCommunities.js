// seed/seedCommunities.js
const mongoose = require('mongoose');
const Community = require('../models/community');

// 🏘️ Default community list
const DEFAULT_COMMUNITIES = [
  "Ayimensah","Danfa","Kweiman","Oyarifa","Abokobi","Frafraha",
  "New Legon","Adenta","Adenta NewSite","Amrahia","Oyibi",
  "Legon Campus","East Legon","Menpeasem","Ogbojo","Adjinganor",
  "Botwe","Madina Zongo Juntion","Atomic Juntion","UPSA","Bawaleshie",
  "American House","School Junction","Mataheko","Nana Krom",
  "Hatso","Taifa","Odokor","Aboso Okai"
];

async function seedCommunities() {
  try {
    console.log('🌍 Checking default communities...');

    for (const name of DEFAULT_COMMUNITIES) {
      const existing = await Community.findOne({ name });
      if (!existing) {
        await Community.create({
          name,
          description: `Community for ${name} users on Yenkasa.`,
          isDefault: true,
          isActive: true,
        });
        console.log(`✅ Added default community: ${name}`);
      } else {
        console.log(`ℹ️ Already exists: ${name}`);
      }
    }

    console.log('✨ Default communities setup complete.');
  } catch (error) {
    console.error('❌ Error seeding communities:', error);
  }
}

module.exports = seedCommunities;
