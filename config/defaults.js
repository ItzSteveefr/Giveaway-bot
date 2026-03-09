/**
 * config/defaults.js
 * ------------------
 * Default configuration values used throughout the bot.
 * Replace placeholder values ([BOT_NAME], [SUPPORT_SERVER_INVITE]) before deployment.
 */

module.exports = {
  /* ── Embed Colors ───────────────────────────────────────── */

  /** Gold — used for active giveaway embeds */
  EMBED_COLOR_ACTIVE: '#FFD700',

  /** Grey — used for ended giveaway embeds */
  EMBED_COLOR_ENDED: '#888888',

  /** Red — used for error embeds */
  EMBED_COLOR_ERROR: '#FF4444',

  /** Green — used for success embeds */
  EMBED_COLOR_SUCCESS: '#44FF88',

  /* ── Branding ───────────────────────────────────────────── */

  /** Footer text appended to every embed */
  EMBED_FOOTER_TEXT: 'GiveawayBot',

  /** Support server invite link appended to winner DMs */
  SUPPORT_SERVER: 'https://discord.gg/SGgccCXD',

  /** Bot description placeholder */
  BOT_DESCRIPTION: 'A fully-featured Discord Giveaway Management Bot built with discord.js v14 and SQLite.',

  /* ── Mutual Giveaway Outside Message ────────────────────── */

  /**
   * Plain-text message posted ABOVE the giveaway embed for Mutual Giveaways.
   * Supports {ping} and {prize} template placeholders.
   */
  MUTUAL_OUTSIDE_MESSAGE:
    '🤝 **Mutual Giveaway Alert!**\n{ping}\nA new mutual giveaway is live! React with 🎉 below to enter and win **{prize}**!',

  /* ── Sponsorship / Mutual Requirements ──────────────────── */

  /**
   * Default requirement text shown inside giveaway embeds for Mutual
   * and Sponsorship giveaways. Displayed as an embed field.
   */
  SPONSOR_MUTUAL_REQUIREMENTS: [
    '1. Must be in their server to win',
    '2. Claim in their server if you win',
    '3. Joining after the giveaway ends doesn\'t count',
  ].join('\n'),

  /* ── Re-roll DM Template ────────────────────────────────── */

  /**
   * DM sent to the OLD winner(s) when a giveaway is rerolled.
   * Placeholders: {Username}, {channelLink}
   */
  REROLL_DM_TEMPLATE: [
    '{Username}, the giveaway {channelLink} has been re-rolled due to one of the following reasons:',
    '',
    '1. You did not complete the requirements',
    '2. You did not claim the prize in the allocated time period',
    '',
    '-# Contact management if you think this is a mistake',
  ].join('\n'),

  /* ── Blacklist DM Template ──────────────────────────────── */

  /**
   * DM sent to a user when they are blacklisted from giveaways.
   * Placeholders: {Username}, {giveawayType}, {reason}
   */
  BLACKLIST_DM_TEMPLATE: [
    '{Username}, you have been blacklisted from all future {giveawayType} due to {reason}',
    '',
    'You may appeal it through our management tickets.',
  ].join('\n'),

  /* ── Session Management ─────────────────────────────────── */

  /** Time (ms) before an in-progress /gw schedule session expires (10 minutes) */
  SESSION_TIMEOUT_MS: 10 * 60 * 1000,

  /* ── Reaction Emoji ─────────────────────────────────────── */

  /** The emoji users react with to enter a giveaway */
  REACTION_EMOJI: '🎉',
};
