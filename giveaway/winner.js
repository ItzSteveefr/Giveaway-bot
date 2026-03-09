/**
 * giveaway/winner.js
 * ------------------
 * Winner selection logic for giveaways (PRD Section 13).
 * Fetches 🎉 reaction users, filters bots and banned users,
 * shuffles with Fisher-Yates, and picks the top N.
 */

const db = require('../database');
const defaults = require('../config/defaults');

/**
 * Fisher-Yates (Durstenfeld) shuffle — in-place.
 * @param {any[]} array
 * @returns {any[]} The same array, shuffled
 */
function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

/**
 * Select winners from a giveaway message's 🎉 reactions.
 *
 * @param {import('discord.js').Message} message — The giveaway message
 * @param {object} giveaway — Row from the giveaways table
 * @param {object} [options] — Additional options
 * @param {string[]} [options.excludeIds=[]] — User IDs to exclude (used for rerolls)
 * @returns {Promise<{winners: string[], totalEligible: number}>}
 */
async function selectWinners(message, giveaway, options = {}) {
  const excludeIds = options.excludeIds || [];

  /* Step 1: Fetch all users who reacted with the giveaway emoji */
  const reaction = message.reactions.resolve(defaults.REACTION_EMOJI);
  if (!reaction) {
    return { winners: [], totalEligible: 0 };
  }

  /* Fetch all reaction users (handles pagination automatically up to 100) */
  const reactionUsers = await reaction.users.fetch();

  /* Step 2: Get banned user IDs for this guild */
  const bannedIds = db.getBannedUserIds(giveaway.guildId);

  /* Step 3: Filter out bots, banned users, and excluded users */
  const eligible = reactionUsers
    .filter((user) => !user.bot)
    .filter((user) => !bannedIds.includes(user.id))
    .filter((user) => !excludeIds.includes(user.id))
    .map((user) => user.id);

  /* Step 4: Store entries in the database for record-keeping */
  for (const userId of eligible) {
    db.createEntry(giveaway.id, userId, giveaway.guildId);
  }

  /* Step 5: Shuffle and pick winners */
  shuffle(eligible);
  const numWinners = Math.min(giveaway.winners, eligible.length);
  const winners = eligible.slice(0, numWinners);

  return { winners, totalEligible: eligible.length };
}

module.exports = { selectWinners, shuffle };
