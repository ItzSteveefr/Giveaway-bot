/**
 * commands/gw/edit.js
 * -------------------
 * /gw edit — Edit a scheduled (queued) giveaway by ID.
 * Shows a select menu of editable fields; selecting one opens a modal
 * with the current value pre-filled.
 */

const {
  SlashCommandSubcommandBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} = require('discord.js');
const db = require('../../database');
const { isAuthorized } = require('../../utils/permissions');
const { buildNoPermissionEmbed, buildErrorEmbed } = require('../../utils/embeds');

/* In-memory store to remember which giveaway ID a user is editing */
const editSessions = require('../../interactions/_sessions');

/**
 * Build the /gw edit subcommand definition.
 * @returns {SlashCommandSubcommandBuilder}
 */
function buildSubcommand() {
  return new SlashCommandSubcommandBuilder()
    .setName('edit')
    .setDescription('Edit a scheduled giveaway by ID')
    .addStringOption((opt) =>
      opt.setName('id').setDescription('The giveaway ID (e.g. GW-A3F9)').setRequired(true)
    );
}

/**
 * Execute the /gw edit command.
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 */
async function execute(interaction) {
  /* Permission check */
  const guildConfig = db.getGuildConfig(interaction.guildId);
  if (!isAuthorized(interaction.member, guildConfig)) {
    return interaction.reply({ embeds: [buildNoPermissionEmbed()], ephemeral: true });
  }

  const id = interaction.options.getString('id');
  const giveaway = db.getGiveawayByGuild(id, interaction.guildId);

  /* Validate the giveaway exists */
  if (!giveaway) {
    return interaction.reply({
      embeds: [buildErrorEmbed('No giveaway found with that ID in this server.')],
      ephemeral: true,
    });
  }

  /* Can only edit queued giveaways */
  if (giveaway.status !== 'queued') {
    return interaction.reply({
      embeds: [buildErrorEmbed(`Cannot edit a giveaway that is **${giveaway.status}**. Only queued giveaways can be edited.`)],
      ephemeral: true,
    });
  }

  /* Store the giveaway ID in the edit session for later modal handling */
  const sessionKey = `${interaction.user.id}_${interaction.guildId}`;
  editSessions.set(sessionKey, { giveawayId: id });

  /* Build the field selection select menu */
  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('gw_edit_field_select')
    .setPlaceholder('Select field to edit')
    .addOptions(
      new StringSelectMenuOptionBuilder()
        .setLabel('Prize')
        .setDescription(`Current: ${giveaway.prize}`)
        .setValue('prize'),
      new StringSelectMenuOptionBuilder()
        .setLabel('Number of Winners')
        .setDescription(`Current: ${giveaway.winners}`)
        .setValue('winners'),
      new StringSelectMenuOptionBuilder()
        .setLabel('Post Timestamp')
        .setDescription(`Current: ${giveaway.postAt}`)
        .setValue('postAt'),
      new StringSelectMenuOptionBuilder()
        .setLabel('Link')
        .setDescription(`Current: ${giveaway.serverLink || 'N/A'}`)
        .setValue('serverLink')
    );

  const row = new ActionRowBuilder().addComponents(selectMenu);

  return interaction.reply({
    content: `**Edit Giveaway ${id}**\nSelect the field you want to change:`,
    components: [row],
    ephemeral: true,
  });
}

module.exports = { buildSubcommand, execute };
