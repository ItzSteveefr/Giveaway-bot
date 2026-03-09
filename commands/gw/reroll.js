/**
 * commands/gw/reroll.js
 * ---------------------
 * /gw reroll — Reroll winner(s) for an ended or stopped giveaway.
 * Re-runs winner selection from the original reaction pool, excluding
 * previously selected winners. DMs OLD winners with re-roll notification.
 */

const { SlashCommandSubcommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../../database');
const { isAuthorized } = require('../../utils/permissions');
const { buildNoPermissionEmbed, buildErrorEmbed, buildEndedGiveawayEmbed } = require('../../utils/embeds');
const { selectWinners } = require('../../giveaway/winner');
const { dmWinners } = require('../../giveaway/dm');
const defaults = require('../../config/defaults');

/**
 * Build the /gw reroll subcommand definition.
 * @returns {SlashCommandSubcommandBuilder}
 */
function buildSubcommand() {
  return new SlashCommandSubcommandBuilder()
    .setName('reroll')
    .setDescription('Reroll winner(s) for an ended giveaway')
    .addStringOption((opt) =>
      opt.setName('id').setDescription('The giveaway ID (e.g. GW-A3F9)').setRequired(true)
    );
}

/**
 * DM the old winners with the re-roll notification message.
 * @param {string[]} oldWinnerIds — User IDs of old winners
 * @param {object} giveaway — Giveaway row
 * @param {import('discord.js').Client} client
 */
async function dmOldWinnersReroll(oldWinnerIds, giveaway, client) {
  for (const userId of oldWinnerIds) {
    try {
      const user = await client.users.fetch(userId);
      const message = defaults.REROLL_DM_TEMPLATE
        .replace('{Username}', `<@${userId}>`)
        .replace('{channelLink}', `<#${giveaway.channelId}>`);

      await user.send(message);
    } catch (err) {
      console.warn(`[Reroll] Could not DM old winner ${userId}: ${err.message}`);
    }
  }
}

/**
 * Execute the /gw reroll command.
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

  /* Reroll only works on ended/stopped giveaways */
  if (giveaway.status !== 'ended' && giveaway.status !== 'stopped') {
    return interaction.reply({
      embeds: [buildErrorEmbed(`Cannot reroll a giveaway that is **${giveaway.status}**. Only ended or stopped giveaways can be rerolled.`)],
      ephemeral: true,
    });
  }

  /* Must have a posted message to fetch reactions from */
  if (!giveaway.messageId || !giveaway.channelId) {
    return interaction.reply({
      embeds: [buildErrorEmbed('This giveaway was never posted, so there are no reactions to reroll from.')],
      ephemeral: true,
    });
  }

  await interaction.deferReply({ ephemeral: true });

  try {
    /* Fetch the channel and message */
    const channel = await interaction.client.channels.fetch(giveaway.channelId);
    const message = await channel.messages.fetch(giveaway.messageId);

    /* Get previous winners to exclude */
    let previousWinners = [];
    if (giveaway.winnerIds) {
      try {
        previousWinners = JSON.parse(giveaway.winnerIds);
      } catch {
        previousWinners = [];
      }
    }

    /* Re-run winner selection excluding previous winners */
    const { winners, totalEligible } = await selectWinners(message, giveaway, {
      excludeIds: previousWinners,
    });

    if (winners.length === 0) {
      return interaction.editReply({
        embeds: [buildErrorEmbed('No eligible users remaining to reroll. All eligible users have already won.')],
      });
    }

    /* DM the OLD winners with reroll notification */
    if (previousWinners.length > 0) {
      await dmOldWinnersReroll(previousWinners, giveaway, interaction.client);
    }

    /* Update the embed on the original message */
    const updatedEmbed = buildEndedGiveawayEmbed(giveaway, winners);
    updatedEmbed.addFields({
      name: '🔄  Rerolled',
      value: `Winners have been rerolled by <@${interaction.user.id}>.`,
    });
    await message.edit({ embeds: [updatedEmbed] });

    /* Announce new winners in the channel */
    const mentions = winners.map((wId) => `<@${wId}>`).join(', ');
    await channel.send(
      `🔄 **Reroll!** Congratulations ${mentions}! You are the new winner(s) of **${giveaway.prize}** (${id})!`
    );

    /* DM the new winners */
    await dmWinners(winners, giveaway, interaction.client);

    /* Update the database */
    db.updateGiveaway(id, {
      winnerIds: JSON.stringify(winners),
    });

    /* Confirm to the command user */
    const confirmEmbed = new EmbedBuilder()
      .setTitle('🔄  Reroll Successful')
      .addFields(
        { name: 'ID', value: id, inline: true },
        { name: 'New Winner(s)', value: mentions, inline: true }
      )
      .setColor(defaults.EMBED_COLOR_SUCCESS)
      .setFooter({ text: defaults.EMBED_FOOTER_TEXT })
      .setTimestamp();

    return interaction.editReply({ embeds: [confirmEmbed] });
  } catch (err) {
    console.error(`[Reroll] Failed to reroll giveaway ${id}: ${err.message}`);
    return interaction.editReply({
      embeds: [buildErrorEmbed(`Failed to reroll: ${err.message}`)],
    });
  }
}

module.exports = { buildSubcommand, execute };
