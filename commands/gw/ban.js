/**
 * commands/gw/ban.js
 * ------------------
 * /gw ban — Blacklist a user from entering giveaways in this server.
 * Supports 3 giveaway types (mutual, sponsorship, event) plus 'all'.
 * Banned users' reactions are ignored during winner selection.
 * DMs the banned user with a notification message.
 */

const { SlashCommandSubcommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../database');
const { isAuthorized } = require('../../utils/permissions');
const { buildNoPermissionEmbed, buildErrorEmbed } = require('../../utils/embeds');
const defaults = require('../../config/defaults');

/** Human-readable labels for giveaway types in DMs and embeds */
const TYPE_DISPLAY = {
  all: 'all giveaways',
  mutual: 'Mutual Giveaways',
  sponsorship: 'Sponsorship Giveaways',
  event: 'Event Giveaways',
};

/**
 * Build the /gw ban subcommand definition.
 * @returns {SlashCommandSubcommandBuilder}
 */
function buildSubcommand() {
  return new SlashCommandSubcommandBuilder()
    .setName('ban')
    .setDescription('Blacklist a user from entering giveaways in this server')
    .addUserOption((opt) =>
      opt.setName('user').setDescription('The user to blacklist').setRequired(true)
    )
    .addStringOption((opt) =>
      opt
        .setName('type')
        .setDescription('Type of giveaway to blacklist from')
        .setRequired(true)
        .addChoices(
          { name: 'All Giveaways', value: 'all' },
          { name: 'Mutual Giveaways', value: 'mutual' },
          { name: 'Sponsorship Giveaways', value: 'sponsorship' },
          { name: 'Event Giveaways', value: 'event' }
        )
    )
    .addStringOption((opt) =>
      opt.setName('reason').setDescription('Reason for the blacklist').setRequired(false)
    );
}

/**
 * DM the blacklisted user with a notification.
 * @param {import('discord.js').User} user — The user to DM
 * @param {string} giveawayType — The type key
 * @param {string} reason — The reason for the blacklist
 */
async function dmBlacklistedUser(user, giveawayType, reason) {
  try {
    const typeDisplay = TYPE_DISPLAY[giveawayType] || giveawayType;
    const message = defaults.BLACKLIST_DM_TEMPLATE
      .replace('{Username}', `<@${user.id}>`)
      .replace('{giveawayType}', typeDisplay)
      .replace('{reason}', reason || 'No reason provided');

    await user.send(message);
  } catch (err) {
    console.warn(`[Ban] Could not DM blacklisted user ${user.id}: ${err.message}`);
  }
}

/**
 * Execute the /gw ban command.
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 */
async function execute(interaction) {
  /* Permission check */
  const guildConfig = db.getGuildConfig(interaction.guildId);
  if (!isAuthorized(interaction.member, guildConfig)) {
    return interaction.reply({ embeds: [buildNoPermissionEmbed()], ephemeral: true });
  }

  const user = interaction.options.getUser('user');
  const giveawayType = interaction.options.getString('type');
  const reason = interaction.options.getString('reason') || null;

  /* Attempt to ban the user */
  const success = db.banUser(interaction.guildId, user.id, interaction.user.id, reason, giveawayType);

  if (!success) {
    return interaction.reply({
      embeds: [buildErrorEmbed(`**${user.tag}** is already blacklisted from **${TYPE_DISPLAY[giveawayType]}** in this server.`)],
      ephemeral: true,
    });
  }

  /* DM the blacklisted user */
  await dmBlacklistedUser(user, giveawayType, reason);

  /* Build confirmation embed */
  const embed = new EmbedBuilder()
    .setTitle('🚫  User Blacklisted from Giveaways')
    .addFields(
      { name: 'User', value: `<@${user.id}> (${user.tag})`, inline: true },
      { name: 'Type', value: TYPE_DISPLAY[giveawayType], inline: true },
      { name: 'Reason', value: reason || 'No reason provided', inline: true },
      { name: 'Blacklisted By', value: `<@${interaction.user.id}>`, inline: true }
    )
    .setColor(defaults.EMBED_COLOR_SUCCESS)
    .setFooter({ text: defaults.EMBED_FOOTER_TEXT })
    .setTimestamp();

  return interaction.reply({ embeds: [embed], ephemeral: true });
}

module.exports = { buildSubcommand, execute };
