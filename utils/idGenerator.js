/**
 * utils/idGenerator.js
 * --------------------
 * Generates short, human-readable giveaway IDs in the format GW-XXXX
 * where X is an uppercase alphanumeric character. Checks the database
 * for collisions before returning a unique ID.
 */

const db = require('../database');

/* Character set for the random portion of the ID */
const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

/**
 * Generate a single random GW-XXXX string (no collision check).
 * @returns {string} e.g. "GW-A3F9"
 */
function randomId() {
  let id = 'GW-';
  for (let i = 0; i < 4; i++) {
    id += CHARS[Math.floor(Math.random() * CHARS.length)];
  }
  return id;
}

/**
 * Generate a unique giveaway ID that does not already exist in the database.
 * Retries up to 100 times to avoid infinite loops in the unlikely event of
 * extreme collision density.
 *
 * @returns {string} A unique giveaway ID e.g. "GW-B7K2"
 * @throws {Error} If a unique ID cannot be generated after 100 attempts
 */
function generateGiveawayId() {
  for (let attempt = 0; attempt < 100; attempt++) {
    const id = randomId();
    const existing = db.getGiveaway(id);
    if (!existing) return id;
  }
  throw new Error('Failed to generate a unique giveaway ID after 100 attempts.');
}

module.exports = { generateGiveawayId };
