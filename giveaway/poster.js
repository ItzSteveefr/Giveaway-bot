/**
 * giveaway/poster.js
 * ------------------
 * Posts a giveaway embed to the correct channel. For Mutual giveaways,
 * posts the outside message first. For Mutual/Sponsorship, posts the
 * server link OUTSIDE the embed as a separate message. Adds a 🎉
 * reaction to the embed message so users can click to enter.
 */

const db = require('../database');
const defaults = require('../config/defaults');
const { buildActiveGiveawayEmbed } = require('../utils/embeds');

/**
 * Post a giveaway embed to Discord and update the database.
 *
 * @param {object} giveaway — Row from the giveaways table
 * @param {import('discord.js').Client} client — The Discord client
 * @returns {Promise<boolean>} true if posted successfully, false otherwise
 */
async function postGiveaway(giveaway, client) {
  try {
    /* Resolve the target channel */
    const channel = await client.channels.fetch(giveaway.channelId);
    if (!channel) {
      throw new Error(`Channel ${giveaway.channelId} not found`);
    }

    /* For Mutual giveaways, post the outside message first (includes ping) */
    if (giveaway.type === 'mutual') {
      const outsideMsg = defaults.MUTUAL_OUTSIDE_MESSAGE
        .replace('{ping}', giveaway.ping || '')
        .replace('{prize}', giveaway.prize);

      await channel.send(outsideMsg);
    }

    /* Build and send the giveaway embed */
    const embed = buildActiveGiveawayEmbed(giveaway);

    /* For non-mutual types with a ping, send the ping as message content */
    let content = undefined;
    if (giveaway.type !== 'mutual' && giveaway.ping && giveaway.ping !== 'none') {
      content = giveaway.ping;
    }

    const message = await channel.send({ content, embeds: [embed] });

    /* Add the entry reaction */
    await message.react(defaults.REACTION_EMOJI);

    /* For Mutual/Sponsorship — send the server link OUTSIDE the embed */
    if ((giveaway.type === 'mutual' || giveaway.type === 'sponsorship') && giveaway.serverLink) {
      await channel.send(`🔗 **Server:** ${giveaway.serverLink}`);
    }

    /* Update the giveaway record in the database */
    const now = Math.floor(Date.now() / 1000);
    db.updateGiveaway(giveaway.id, {
      status: 'active',
      messageId: message.id,
      postedAt: now,
    });

    console.log(`[Poster] Posted giveaway ${giveaway.id} in channel ${channel.name} (${channel.id})`);
    return true;
  } catch (err) {
    console.error(`[Poster] Failed to post giveaway ${giveaway.id}: ${err.message}`);

    /* Mark as stopped with a note explaining the failure */
    db.updateGiveaway(giveaway.id, {
      status: 'stopped',
      notes: `Failed to post: ${err.message}`,
      endedAt: Math.floor(Date.now() / 1000),
    });

    return false;
  }
}

module.exports = { postGiveaway };
