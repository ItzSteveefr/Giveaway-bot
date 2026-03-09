/**
 * commands/gw/stop.js
 * -------------------
 * /gw stop — Stop a queued or active giveaway by ID.
 *   - Queued → cancel before posting, set status to 'stopped'
 *   - Active → force-end (pick winners immediately), set status to 'stopped'
 *   - Ended/Stopped → ephemeral error
 */

const { SlashCommandSubcommandBuilder } = require('discord.js');
const db = require('../../database');
const { isAuthorized } = require('../../utils/permissions');
const { buildNoPermissionEmbed, buildErrorEmbed } = require('../../utils/embeds');
const { endGiveaway } = require('../../giveaway/ender');
const defaults = require('../../config/defaults');
const { EmbedBuilder } = require('discord.js');

/**
 * Build the /gw stop subcommand definition.
 * @returns {SlashCommandSubcommandBuilder}
 */
function buildSubcommand() {
  return new SlashCommandSubcommandBuilder()
    .setName('stop')
    .setDescription('Stop a queued or active giveaway by ID')
    .addStringOption((opt) =>
      opt.setName('id').setDescription('The giveaway ID (e.g. GW-A3F9)').setRequired(true)
    );
}

/**
 * Execute the /gw stop command.
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

  /* Handle based on current status */
  if (giveaway.status === 'ended' || giveaway.status === 'stopped') {
    return interaction.reply({
      embeds: [buildErrorEmbed(`This giveaway has already **${giveaway.status}**.`)],
      ephemeral: true,
    });
  }

  if (giveaway.status === 'queued') {
    /* Cancel before it posts */
    const now = Math.floor(Date.now() / 1000);
    db.updateGiveaway(id, { status: 'stopped', endedAt: now, notes: 'Manually stopped before posting.' });

    const embed = new EmbedBuilder()
      .setTitle('🛑 Giveaway Stopped')
      .setDescription(`Giveaway **${id}** has been cancelled before posting.`)
      .setColor(defaults.EMBED_COLOR_SUCCESS)
      .setFooter({ text: defaults.EMBED_FOOTER_TEXT })
      .setTimestamp();

    return interaction.reply({ embeds: [embed], ephemeral: true });
  }

  if (giveaway.status === 'active') {
    /* Force-end the giveaway — pick winners immediately */
    await interaction.deferReply({ ephemeral: true });

    const { success, winners } = await endGiveaway(giveaway, interaction.client);

    if (success) {
      const winnerMentions = winners.length > 0
        ? winners.map((id) => `<@${id}>`).join(', ')
        : 'No valid entries';

      const embed = new EmbedBuilder()
        .setTitle('🛑 Giveaway Force-Ended')
        .addFields(
          { name: 'ID', value: id, inline: true },
          { name: 'Prize', value: giveaway.prize, inline: true },
          { name: 'Winner(s)', value: winnerMentions, inline: false }
        )
        .setColor(defaults.EMBED_COLOR_SUCCESS)
        .setFooter({ text: defaults.EMBED_FOOTER_TEXT })
        .setTimestamp();

      /* Mark as stopped instead of ended since it was force-stopped */
      db.updateGiveaway(id, { status: 'stopped' });

      return interaction.editReply({ embeds: [embed] });
    } else {
      return interaction.editReply({
        embeds: [buildErrorEmbed('Failed to force-end the giveaway. Check the console for details.')],
      });
    }
  }
}

module.exports = { buildSubcommand, execute };
