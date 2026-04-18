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

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function parseGhanaLocation(location = '') {
  const parts = location.split(',').map(part => part.trim()).filter(Boolean);
  const town = parts[0] || '';
  const state = parts[parts.length - 1] || 'Greater Accra';
  return { state, city: town, town };
}

const ghanaLocalCommunities = yenkasaCommunities.map(community => {
  const parsed = parseGhanaLocation(community.location);
  return {
    ...community,
    country: 'Ghana',
    state: parsed.state,
    city: parsed.city,
    town: parsed.town,
    communityLevel: 'town',
    communityType: 'local'
  };
});

const ghanaInterestCommunities = interestCommunities.map(community => ({
  ...community,
  country: 'Ghana',
  state: '',
  city: '',
  town: '',
  communityLevel: 'interest',
  communityType: 'interest'
}));

const nigeriaStates = [
  ['Abia', 'Umuahia'],
  ['Adamawa', 'Yola'],
  ['Akwa Ibom', 'Uyo'],
  ['Anambra', 'Awka'],
  ['Bauchi', 'Bauchi'],
  ['Bayelsa', 'Yenagoa'],
  ['Benue', 'Makurdi'],
  ['Borno', 'Maiduguri'],
  ['Cross River', 'Calabar'],
  ['Delta', 'Asaba'],
  ['Ebonyi', 'Abakaliki'],
  ['Edo', 'Benin City'],
  ['Ekiti', 'Ado-Ekiti'],
  ['Enugu', 'Enugu'],
  ['FCT', 'Abuja'],
  ['Gombe', 'Gombe'],
  ['Imo', 'Owerri'],
  ['Jigawa', 'Dutse'],
  ['Kaduna', 'Kaduna'],
  ['Kano', 'Kano'],
  ['Katsina', 'Katsina'],
  ['Kebbi', 'Birnin Kebbi'],
  ['Kogi', 'Lokoja'],
  ['Kwara', 'Ilorin'],
  ['Lagos', 'Ikeja'],
  ['Nasarawa', 'Lafia'],
  ['Niger', 'Minna'],
  ['Ogun', 'Abeokuta'],
  ['Ondo', 'Akure'],
  ['Osun', 'Osogbo'],
  ['Oyo', 'Ibadan'],
  ['Plateau', 'Jos'],
  ['Rivers', 'Port Harcourt'],
  ['Sokoto', 'Sokoto'],
  ['Taraba', 'Jalingo'],
  ['Yobe', 'Damaturu'],
  ['Zamfara', 'Gusau']
];

const nigeriaStateCommunities = nigeriaStates.map(([state, capital]) => ({
  name: `nigeria-${slugify(state)}-state`,
  displayName: `${state} State`,
  description: `State-level community for people living in or connected to ${state} State, Nigeria.`,
  location: `${state} State, Nigeria`,
  country: 'Nigeria',
  state,
  city: capital,
  town: '',
  communityLevel: 'state',
  communityType: 'local',
  categories: ['Local', 'State', 'Nigeria']
}));

const nigeriaCityTownSeeds = [
  ['Lagos', 'Ikeja', 'Ikeja'],
  ['Lagos', 'Lagos Island', 'Lagos Island'],
  ['Lagos', 'Lekki', 'Lekki'],
  ['Lagos', 'Victoria Island', 'Victoria Island'],
  ['Lagos', 'Surulere', 'Surulere'],
  ['Lagos', 'Yaba', 'Yaba'],
  ['Lagos', 'Ajah', 'Ajah'],
  ['FCT', 'Abuja', 'Wuse'],
  ['FCT', 'Abuja', 'Garki'],
  ['FCT', 'Abuja', 'Maitama'],
  ['FCT', 'Abuja', 'Gwarinpa'],
  ['FCT', 'Abuja', 'Kubwa'],
  ['FCT', 'Abuja', 'Nyanya'],
  ['Oyo', 'Ibadan', 'Ibadan'],
  ['Oyo', 'Ogbomosho', 'Ogbomosho'],
  ['Oyo', 'Oyo', 'Oyo'],
  ['Kano', 'Kano', 'Kano'],
  ['Kano', 'Wudil', 'Wudil'],
  ['Rivers', 'Port Harcourt', 'Port Harcourt'],
  ['Rivers', 'Bonny', 'Bonny'],
  ['Rivers', 'Obio-Akpor', 'Obio-Akpor'],
  ['Anambra', 'Onitsha', 'Onitsha'],
  ['Anambra', 'Nnewi', 'Nnewi'],
  ['Anambra', 'Awka', 'Awka'],
  ['Abia', 'Aba', 'Aba'],
  ['Abia', 'Umuahia', 'Umuahia'],
  ['Enugu', 'Enugu', 'Enugu'],
  ['Imo', 'Owerri', 'Owerri'],
  ['Edo', 'Benin City', 'Benin City'],
  ['Delta', 'Warri', 'Warri'],
  ['Delta', 'Asaba', 'Asaba'],
  ['Ogun', 'Abeokuta', 'Abeokuta'],
  ['Ogun', 'Sango Ota', 'Sango Ota'],
  ['Ogun', 'Ijebu Ode', 'Ijebu Ode'],
  ['Osun', 'Osogbo', 'Osogbo'],
  ['Ondo', 'Akure', 'Akure'],
  ['Ekiti', 'Ado-Ekiti', 'Ado-Ekiti'],
  ['Kwara', 'Ilorin', 'Ilorin'],
  ['Plateau', 'Jos', 'Jos'],
  ['Kaduna', 'Kaduna', 'Kaduna'],
  ['Kaduna', 'Zaria', 'Zaria'],
  ['Niger', 'Minna', 'Minna'],
  ['Niger', 'Suleja', 'Suleja'],
  ['Benue', 'Makurdi', 'Makurdi'],
  ['Cross River', 'Calabar', 'Calabar'],
  ['Akwa Ibom', 'Uyo', 'Uyo'],
  ['Bayelsa', 'Yenagoa', 'Yenagoa'],
  ['Borno', 'Maiduguri', 'Maiduguri'],
  ['Adamawa', 'Yola', 'Yola'],
  ['Bauchi', 'Bauchi', 'Bauchi'],
  ['Gombe', 'Gombe', 'Gombe'],
  ['Taraba', 'Jalingo', 'Jalingo'],
  ['Jigawa', 'Dutse', 'Dutse'],
  ['Katsina', 'Katsina', 'Katsina'],
  ['Kebbi', 'Birnin Kebbi', 'Birnin Kebbi'],
  ['Kogi', 'Lokoja', 'Lokoja'],
  ['Nasarawa', 'Lafia', 'Lafia'],
  ['Sokoto', 'Sokoto', 'Sokoto'],
  ['Yobe', 'Damaturu', 'Damaturu'],
  ['Zamfara', 'Gusau', 'Gusau'],
  ['Ebonyi', 'Abakaliki', 'Abakaliki']
];

const nigeriaCityTownCommunities = nigeriaCityTownSeeds.map(([state, city, town]) => ({
  name: `nigeria-${slugify(state)}-${slugify(town)}`,
  displayName: town,
  description: `Local community for people in ${town}, ${state} State, Nigeria.`,
  location: `${town}, ${state} State, Nigeria`,
  country: 'Nigeria',
  state,
  city,
  town,
  communityLevel: town === city ? 'city' : 'town',
  communityType: 'local',
  categories: ['Local', 'City', 'Town', 'Nigeria']
}));

// 🔁 Combine and add default flags
const communities = [
  ...ghanaLocalCommunities,
  ...ghanaInterestCommunities,
  ...nigeriaStateCommunities,
  ...nigeriaCityTownCommunities
].map(c => ({
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

    console.log('🌱 Seeding Ghana and Nigeria communities...');

    for (const community of communities) {
      const result = await Community.findOneAndUpdate(
        { name: community.name },
        {
          $set: {
            displayName: community.displayName,
            description: community.description || '',
            location: community.location || '',
            categories: community.categories || [],
            country: community.country || 'Ghana',
            state: community.state || '',
            city: community.city || '',
            town: community.town || '',
            communityLevel: community.communityLevel || null,
            communityType: community.communityType || null,
            isActive: true,
            isApproved: true
          }
        },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );

      if (result.createdAt?.getTime?.() === result.updatedAt?.getTime?.()) {
        console.log(`🌟 Created community: ${community.displayName}`);
      } else {
        console.log(`⚡ Synced community: ${community.displayName}`);
      }
    }

    console.log('✨ Done!');

  } catch (err) {
    console.error('❌ Error seeding database:', err);
    process.exit(1);
  }
}

// Automatically seed on server start
seedCommunities();

