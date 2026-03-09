/**
 * giveaway/ender.js
 * -----------------
 * Ends a giveaway: picks winners from 🎉 reactions, edits the embed
 * to the ended state, DMs all winners, and updates the database.
 */

const db = require('../database');
const { selectWinners } = require('./winner');
const { dmWinners } = require('./dm');
const { buildEndedGiveawayEmbed } = require('../utils/embeds');

/**
 * End a giveaway — select winners, edit the embed, DM winners, update DB.
 *
 * @param {object} giveaway — Row from the giveaways table
 * @param {import('discord.js').Client} client — The Discord client
 * @param {object} [options] — Additional options
 * @param {string[]} [options.excludeIds=[]] — User IDs to exclude (for rerolls)
 * @returns {Promise<{success: boolean, winners: string[]}>}
 */
async function endGiveaway(giveaway, client, options = {}) {
  try {
    /* Resolve the channel and message */
    const channel = await client.channels.fetch(giveaway.channelId);
    if (!channel) {
      throw new Error(`Channel ${giveaway.channelId} not found or deleted`);
    }

    const message = await channel.messages.fetch(giveaway.messageId);
    if (!message) {
      throw new Error(`Message ${giveaway.messageId} not found`);
    }

    /* Select winners from reactions */
    const { winners, totalEligible } = await selectWinners(message, giveaway, {
      excludeIds: options.excludeIds || [],
    });

    /* Build the ended embed */
    const endedEmbed = buildEndedGiveawayEmbed(giveaway, winners);

    /* If fewer winners than expected, add a note */
    if (winners.length < giveaway.winners && winners.length > 0) {
      endedEmbed.addFields({
        name: '⚠️ Note',
        value: `Only ${winners.length} winner(s) could be selected from ${totalEligible} eligible entries.`,
      });
    }

    /* Edit the original message to show the ended state */
    await message.edit({ embeds: [endedEmbed] });

    /* If no valid entries, post a notice in the channel */
    if (winners.length === 0) {
      await channel.send(`❌ No valid entries found for giveaway **${giveaway.id}**.`);
    } else {
      /* Announce winners in the channel */
      const mentions = winners.map((id) => `<@${id}>`).join(', ');
      await channel.send(
        `🎊 Congratulations ${mentions}! You won **${giveaway.prize}**!`
      );
    }

    /* DM all winners */
    if (winners.length > 0) {
      await dmWinners(winners, giveaway, client);
    }

    /* Update the database */
    const now = Math.floor(Date.now() / 1000);
    db.updateGiveaway(giveaway.id, {
      status: 'ended',
      winnerIds: JSON.stringify(winners),
      endedAt: now,
    });

    console.log(
      `[Ender] Ended giveaway ${giveaway.id} — ${winners.length} winner(s): ${winners.join(', ') || 'none'}`
    );

    return { success: true, winners };
  } catch (err) {
    console.error(`[Ender] Failed to end giveaway ${giveaway.id}: ${err.message}`);

    /* Mark as stopped with an error note */
    db.updateGiveaway(giveaway.id, {
      status: 'stopped',
      notes: `Failed to end: ${err.message}`,
      endedAt: Math.floor(Date.now() / 1000),
    });

    return { success: false, winners: [] };
  }
}

module.exports = { endGiveaway };
