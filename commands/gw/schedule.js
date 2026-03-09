/**
 * commands/gw/schedule.js
 * -----------------------
 * /gw schedule — Launches the multi-step giveaway creation UI.
 * Sends an ephemeral StringSelectMenu for type selection (Step 1).
 * All subsequent steps are handled by the interaction handlers
 * (selectMenus.js and modals.js).
 */

const {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} = require('discord.js');
const { SlashCommandSubcommandBuilder } = require('discord.js');
const db = require('../../database');
const { isAuthorized } = require('../../utils/permissions');
const { buildNoPermissionEmbed, buildNotConfiguredEmbed } = require('../../utils/embeds');

/**
 * Build the /gw schedule subcommand definition.
 * @returns {SlashCommandSubcommandBuilder}
 */
function buildSubcommand() {
  return new SlashCommandSubcommandBuilder()
    .setName('schedule')
    .setDescription('Launch the multi-step giveaway creation UI');
}

/**
 * Execute the /gw schedule command.
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 */
async function execute(interaction) {
  /* Permission check */
  const guildConfig = db.getGuildConfig(interaction.guildId);
  if (!isAuthorized(interaction.member, guildConfig)) {
    return interaction.reply({ embeds: [buildNoPermissionEmbed()], ephemeral: true });
  }

  /* Guild config check — at least one channel should be configured */
  if (!guildConfig) {
    return interaction.reply({ embeds: [buildNotConfiguredEmbed()], ephemeral: true });
  }

  /* Build the type selection select menu (Step 1) */
  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('gw_type_select')
    .setPlaceholder('Select Giveaway Type')
    .addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel('Mutual Giveaway')
        .setDescription('Partnership giveaway with another server')
        .setEmoji('🤝')
        .setValue('mutual'),
      new StringSelectMenuOptionBuilder()
        .setLabel('Sponsorship')
        .setDescription('Sponsored giveaway by another server or entity')
        .setEmoji('💰')
        .setValue('sponsorship'),
      new StringSelectMenuOptionBuilder()
        .setLabel('Event')
        .setDescription('In-server event giveaway')
        .setEmoji('🎉')
        .setValue('event')
    );

  const row = new ActionRowBuilder().addComponents(selectMenu);

  return interaction.reply({
    content: '**Select Giveaway Type**\n────────────────────',
    components: [row],
    ephemeral: true,
  });
}

module.exports = { buildSubcommand, execute };
