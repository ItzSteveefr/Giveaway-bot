/**
 * giveaway/dm.js
 * --------------
 * DM message formatting and sending for giveaway winners.
 * Each giveaway type has its own template (PRD Section 12).
 * DM failures (closed DMs) are logged but never crash the process.
 */

const defaults = require('../config/defaults');

/* ── DM Templates (Section 12.1 – 12.3) ──────────────────── */

const DM_TEMPLATES = {
  mutual: [
    '## Congratulations 🎉',
    '{Username}, you\'ve won a giveaway of prize **{prize}** from a mutual giveaway.',
    '1. Open a ticket in their server',
    '2. Show them the proof of you winning the giveaway',
    '3. Claim your prize',
    '-# If they refuse to pay you the prize even after you followed all the rules — open an investigation ticket in our support server.',
  ].join('\n'),

  sponsorship: [
    '## Congratulations 🎉',
    '{Username}, you\'ve won a giveaway of prize **{prize}** from a sponsored giveaway.',
    '1. Open a ticket in their server',
    '2. Show them the proof of you winning the giveaway',
    '3. Claim your prize',
    '-# If they refuse to pay you the prize even after you followed all the rules — open an investigation ticket in our support server.',
  ].join('\n'),

  event: [
    '## Congratulations 🎉',
    '{Username}, you\'ve won a giveaway of prize **{prize}** from an event.',
    '1. Make sure you followed all the rules',
    '2. Open a ticket in our support server',
    '3. Claim your prize',
  ].join('\n'),
};

/**
 * Get the DM template for a giveaway type.
 * @param {string} type — 'mutual' | 'sponsorship' | 'event'
 * @returns {string} The template string with {Username} and {prize} placeholders
 */
function getDMTemplate(type) {
  return DM_TEMPLATES[type] || DM_TEMPLATES.event;
}

/**
 * Send DMs to all giveaway winners.
 *
 * @param {string[]} winnerUserIds — Array of user IDs who won
 * @param {object} giveaway — Row from the giveaways table
 * @param {import('discord.js').Client} client — The Discord client
 */
async function dmWinners(winnerUserIds, giveaway, client) {
  const template = getDMTemplate(giveaway.type);

  for (const userId of winnerUserIds) {
    try {
      const user = await client.users.fetch(userId);

      /* Build the final message with placeholder substitution */
      const message =
        template
          .replace('{Username}', `<@${userId}>`)
          .replace('{prize}', giveaway.prize) +
        `\n\n**Support Server:** ${defaults.SUPPORT_SERVER}`;

      await user.send(message);
    } catch (err) {
      /* User has DMs closed or is otherwise unreachable — log and continue */
      console.warn(`[DM] Could not DM user ${userId}: ${err.message}`);
    }
  }
}

module.exports = { dmWinners, getDMTemplate };
