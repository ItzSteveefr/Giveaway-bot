/**
 * utils/channelCreator.js
 * -----------------------
 * Creates a new text channel inside a specified category.
 * Used by Sponsorship and Event giveaway flows when the user
 * opts for a custom channel.
 */

const { ChannelType, PermissionFlagsBits } = require('discord.js');

/**
 * Create a text channel in the given category.
 *
 * @param {import('discord.js').Guild} guild — The guild to create the channel in
 * @param {string} categoryId — The ID of the parent category
 * @param {string} channelName — Desired channel name (emojis allowed)
 * @returns {Promise<import('discord.js').TextChannel>} The newly created channel
 * @throws {Error} If the bot lacks Manage Channels permission or the category is invalid
 */
async function createChannel(guild, categoryId, channelName) {
  const channel = await guild.channels.create({
    name: channelName,
    type: ChannelType.GuildText,
    parent: categoryId,
    reason: 'Giveaway Bot — custom channel for giveaway',
  });

  return channel;
}

module.exports = { createChannel };
