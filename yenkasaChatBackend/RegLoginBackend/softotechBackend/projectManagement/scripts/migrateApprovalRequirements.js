#!/usr/bin/env node

require('dotenv').config();

const portal = require('../services/softOTechPortal.service');

function argValue(name, fallback = '') {
  const prefix = `${name}=`;
  const entry = process.argv.find((value) => value.startsWith(prefix));
  return entry ? entry.slice(prefix.length) : fallback;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const limit = Number(argValue('--limit', '2000')) || 2000;
  const result = await portal.migrateApprovedProjectRequirements({ dryRun, limit }, {
    email: process.env.SOFTOTECH_MIGRATION_ACTOR_EMAIL || 'system@softotech.local',
    role: 'migration',
  });
  console.log(JSON.stringify(result, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
