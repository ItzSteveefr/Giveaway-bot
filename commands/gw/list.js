/**
 * commands/gw/list.js
 * -------------------
 * /gw list — Shows all queued/active and recently ended giveaways
 * for the current server in a formatted embed.
 */

const { SlashCommandSubcommandBuilder } = require('discord.js');
const db = require('../../database');
const { isAuthorized } = require('../../utils/permissions');
const { buildNoPermissionEmbed, buildListEmbed } = require('../../utils/embeds');

/**
 * Build the /gw list subcommand definition.
 * @returns {SlashCommandSubcommandBuilder}
 */
function buildSubcommand() {
  return new SlashCommandSubcommandBuilder()
    .setName('list')
    .setDescription('Show all queued, active, and recently ended giveaways');
}

/**
 * Execute the /gw list command.
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 */
async function execute(interaction) {
  /* Permission check */
  const guildConfig = db.getGuildConfig(interaction.guildId);
  if (!isAuthorized(interaction.member, guildConfig)) {
    return interaction.reply({ embeds: [buildNoPermissionEmbed()], ephemeral: true });
  }

  /* Fetch queued/active giveaways */
  const activeGiveaways = db.listGiveaways(interaction.guildId, ['queued', 'active'], 50);

  /* Fetch recently ended/stopped giveaways (last 10) */
  const recentGiveaways = db.listGiveaways(interaction.guildId, ['ended', 'stopped'], 10);

  /* Build and send the list embed */
  const embed = buildListEmbed(interaction.guild.name, activeGiveaways, recentGiveaways);

  return interaction.reply({ embeds: [embed], ephemeral: true });
}

module.exports = { buildSubcommand, execute };
