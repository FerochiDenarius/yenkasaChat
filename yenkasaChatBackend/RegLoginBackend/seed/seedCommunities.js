// scripts/seedCommunities.js - REAL GHANA COMMUNITIES
require('dotenv').config();
const mongoose = require('mongoose');
const Community = require('../models/community.model');

// 🌍 YENKASA LOCAL COMMUNITIES (Accra–Adenta–Madina Belt)
const yenkasaCommunities = [
  {
    name: 'ayimensah',
    displayName: 'Ayimensah',
    description: 'Peaceful hillside residential area near Aburi with scenic views and cool weather.',
    location: 'Ayimensah, Greater Accra',
    categories: ['Local', 'Residential', 'Scenic']
  },
  {
    name: 'danfa',
    displayName: 'Danfa',
    description: 'Traditional Ga-East community known for its vibrant culture and peaceful environment.',
    location: 'Danfa, Greater Accra',
    categories: ['Local', 'Cultural', 'Residential']
  },
  {
    name: 'kweiman',
    displayName: 'Kweiman',
    description: 'Developing community surrounded by greenery and close to the Adenta–Aburi corridor.',
    location: 'Kweiman, Greater Accra',
    categories: ['Local', 'Suburban', 'Residential']
  },
  {
    name: 'oyarifa',
    displayName: 'Oyarifa',
    description: 'Growing residential area linking Accra and Aburi with modern estates and local markets.',
    location: 'Oyarifa, Greater Accra',
    categories: ['Local', 'Residential', 'Developing']
  },
  {
    name: 'abokobi',
    displayName: 'Abokobi',
    description: 'Historic settlement and district capital of Ga East with cultural and civic institutions.',
    location: 'Abokobi, Greater Accra',
    categories: ['Local', 'Historic', 'Civic']
  },
  {
    name: 'frafraha',
    displayName: 'Frafraha',
    description: 'Busy suburban town along the Adenta–Dodowa Road with schools and new housing developments.',
    location: 'Frafraha, Greater Accra',
    categories: ['Local', 'Residential', 'Suburban']
  },
  {
    name: 'new-legon',
    displayName: 'New Legon',
    description: 'Emerging residential zone near Adenta, popular for its quiet environment and accessibility.',
    location: 'New Legon, Greater Accra',
    categories: ['Local', 'Residential', 'Developing']
  },
  {
    name: 'adenta',
    displayName: 'Adenta',
    description: 'Rapidly growing residential and administrative hub in Accra’s northeastern corridor.',
    location: 'Adenta, Greater Accra',
    categories: ['Local', 'Residential', 'Urban']
  },
  {
    name: 'adenta-newsite',
    displayName: 'Adenta New Site',
    description: 'Modern housing extension of Adenta with new estates and improved infrastructure.',
    location: 'Adenta New Site, Greater Accra',
    categories: ['Local', 'Residential', 'Developing']
  },
  {
    name: 'amrahia',
    displayName: 'Amrahia',
    description: 'Quiet suburban community with local schools and new gated estates along the Adenta–Oyibi road.',
    location: 'Amrahia, Greater Accra',
    categories: ['Local', 'Residential', 'Suburban']
  },
  {
    name: 'oyibi',
    displayName: 'Oyibi',
    description: 'Educational and residential town hosting Valley View University and emerging estates.',
    location: 'Oyibi, Greater Accra',
    categories: ['Local', 'Residential', 'Education']
  },
  {
    name: 'legon-campus',
    displayName: 'Legon Campus',
    description: 'Home to the University of Ghana, known for academic excellence and green spaces.',
    location: 'Legon, Greater Accra',
    categories: ['Local', 'Education', 'University']
  },
  {
    name: 'east-legon',
    displayName: 'East Legon',
    description: 'Upscale business and residential area with restaurants, cafes, and shopping centers.',
    location: 'East Legon, Accra, Greater Accra',
    categories: ['Local', 'Upscale', 'Business']
  },
  {
    name: 'menpeasem',
    displayName: 'Menpeasem',
    description: 'Residential neighborhood between East Legon and Adjiringanor, close to schools and shops.',
    location: 'Menpeasem, Greater Accra',
    categories: ['Local', 'Residential', 'Urban']
  },
  {
    name: 'ogbojo',
    displayName: 'Ogbojo',
    description: 'Quiet neighborhood near East Legon with a mix of traditional and modern living.',
    location: 'Ogbojo, Greater Accra',
    categories: ['Local', 'Residential', 'Peaceful']
  },
  {
    name: 'adjinganor',
    displayName: 'Adjinganor',
    description: 'Prime residential and commercial area known for its modern architecture and accessibility.',
    location: 'Adjinganor, East Legon, Greater Accra',
    categories: ['Local', 'Residential', 'Upscale']
  },
  {
    name: 'botwe',
    displayName: 'Botwe',
    description: 'Residential suburb between East Legon and Madina, popular among young families.',
    location: 'Botwe, Greater Accra',
    categories: ['Local', 'Residential', 'Suburban']
  },
  {
    name: 'madina-zongo-junction',
    displayName: 'Madina Zongo Junction',
    description: 'Bustling area with markets, transport terminals, and diverse communities.',
    location: 'Madina Zongo Junction, Greater Accra',
    categories: ['Local', 'Commercial', 'Transport']
  },
  {
    name: 'atomic-junction',
    displayName: 'Atomic Junction',
    description: 'Major transport and commercial hub connecting Legon, Haatso, and Kwabenya.',
    location: 'Atomic Junction, Greater Accra',
    categories: ['Local', 'Commerce', 'Transport']
  },
  {
    name: 'upsa',
    displayName: 'UPSA',
    description: 'University community around the University of Professional Studies, Accra.',
    location: 'UPSA, East Legon, Greater Accra',
    categories: ['Local', 'Education', 'University']
  },
  {
    name: 'bawaleshie',
    displayName: 'Bawaleshie',
    description: 'Residential enclave near East Legon with access to schools and main roads.',
    location: 'Bawaleshie, Greater Accra',
    categories: ['Local', 'Residential', 'Suburban']
  },
  {
    name: 'american-house',
    displayName: 'American House',
    description: 'Commercial hub in East Legon known for its shops, offices, and nightlife.',
    location: 'American House, East Legon, Greater Accra',
    categories: ['Local', 'Commercial', 'Business']
  },
  {
    name: 'school-junction',
    displayName: 'School Junction',
    description: 'Growing residential community near Nmai Dzorn with quick access to Adenta.',
    location: 'School Junction, Greater Accra',
    categories: ['Local', 'Residential', 'Developing']
  },
  {
    name: 'mataheko',
    displayName: 'Mataheko',
    description: 'Urban neighborhood in Accra with schools, churches, and local businesses.',
    location: 'Mataheko, Accra, Greater Accra',
    categories: ['Local', 'Urban', 'Residential']
  },
  {
    name: 'nana-krom',
    displayName: 'Nana Krom',
    description: 'Developing residential suburb between Adenta and East Legon Hills.',
    location: 'Nana Krom, Greater Accra',
    categories: ['Local', 'Residential', 'Developing']
  },
  {
    name: 'hatso',
    displayName: 'Hatso',
    description: 'Dynamic residential town with local markets and easy access to Legon and Madina.',
    location: 'Hatso, Greater Accra',
    categories: ['Local', 'Residential', 'Urban']
  },
  {
    name: 'taifa',
    displayName: 'Taifa',
    description: 'Highly populated community with active markets and small businesses.',
    location: 'Taifa, Greater Accra',
    categories: ['Local', 'Commerce', 'Residential']
  },
  {
    name: 'odokor',
    displayName: 'Odokor',
    description: 'Busy Accra neighborhood with transport connections and urban lifestyle.',
    location: 'Odokor, Accra, Greater Accra',
    categories: ['Local', 'Urban', 'Transport']
  },
  {
    name: 'aboso-okai',
    displayName: 'Aboso Okai',
    description: 'Famous for auto parts dealers and mechanical workshops in central Accra.',
    location: 'Aboso Okai, Accra, Greater Accra',
    categories: ['Local', 'Commerce', 'Mechanics']
  }
];

// 💡 INTEREST-BASED COMMUNITIES (No fixed location)
const interestCommunities = [
  {
    name: 'tech-innovators',
    displayName: 'Tech Innovators Ghana',
    description: 'A space for Ghanaian developers, designers, and tech founders to share ideas and projects.',
    categories: ['Technology', 'Innovation', 'Networking']
  },
  {
    name: 'creative-artists',
    displayName: 'Creative Artists Hub',
    description: 'For painters, photographers, writers, and musicians to collaborate and inspire each other.',
    categories: ['Art', 'Creativity', 'Community']
  },
  {
    name: 'ghanaian-foodies',
    displayName: 'Ghanaian Foodies',
    description: 'Explore recipes, street food spots, and traditional dishes from all over Ghana.',
    categories: ['Food', 'Culture', 'Lifestyle']
  },
  {
    name: 'sports-fans',
    displayName: 'Ghana Sports Fans',
    description: 'For fans of football, athletics, and all Ghanaian sports moments.',
    categories: ['Sports', 'Community', 'Events']
  },
  {
    name: 'young-entrepreneurs',
    displayName: 'Young Entrepreneurs Ghana',
    description: 'Connect with fellow business owners, share experiences, and find support for startups.',
    categories: ['Business', 'Entrepreneurship', 'Networking']
  },
  {
    name: 'health-and-wellness',
    displayName: 'Health & Wellness Ghana',
    description: 'Discussions on fitness, mental health, nutrition, and living a balanced lifestyle.',
    categories: ['Health', 'Wellness', 'Fitness']
  },
  {
    name: 'movies-and-series',
    displayName: 'Movies & Series Lovers',
    description: 'Talk about your favorite Nollywood, Hollywood, and local films and shows.',
    categories: ['Entertainment', 'Movies', 'TV']
  },
  {
    name: 'book-club',
    displayName: 'Book Club Ghana',
    description: 'Readers unite! Share your favorite Ghanaian and international books.',
    categories: ['Books', 'Education', 'Literature']
  },
  {
    name: 'music-lovers',
    displayName: 'Music Lovers Ghana',
    description: 'A place to discover and discuss Afrobeats, Highlife, Gospel, and more.',
    categories: ['Music', 'Culture', 'Entertainment']
  },
  {
    name: 'travelers-ghana',
    displayName: 'Travelers in Ghana',
    description: 'Share travel tips, destinations, and hidden gems across Ghana.',
    categories: ['Travel', 'Adventure', 'Culture']
  }
];

// 🔁 Add default flags to all communities
const communities = [...yenkasaCommunities, ...interestCommunities].map(c => ({
  ...c,
  isActive: true,
  isApproved: true
}));

async function seedCommunities() {
  try {
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('✅ Connected to MongoDB');

    console.log('🗑️  Clearing existing communities...');
    await Community.deleteMany({});

    console.log('🌱 Seeding Ghana communities...');
    const created = await Community.insertMany(communities);

    console.log(`✅ Successfully created ${created.length} communities!`);
    console.log('✨ Done!');
  
  } catch (err) {
    console.error('❌ Error seeding database:', err);
    process.exit(1);
  }
}

seedCommunities();
