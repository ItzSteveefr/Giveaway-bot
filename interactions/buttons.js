/**
 * interactions/buttons.js
 * -----------------------
 * Handles all ButtonInteraction events, routed by customId.
 * Includes the "Set Duration" button for the two-modal giveaway flow
 * and pagination for the /gw list command.
 */

const {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
} = require('discord.js');
const sessions = require('./_sessions');
const { buildErrorEmbed } = require('../utils/embeds');

/**
 * Handle a button interaction.
 * @param {import('discord.js').ButtonInteraction} interaction
 */
async function handleButton(interaction) {
  const { customId } = interaction;

  /* ── Duration Button (opens 2nd modal) ──────────────────── */
  if (customId === 'gw_duration_btn') {
    return handleDurationButton(interaction);
  }

  /* ── List Pagination ────────────────────────────────────── */
  if (customId.startsWith('gw_list_')) {
    return handleListPagination(interaction);
  }

  /* Unknown button — ignore gracefully */
  console.warn(`[Buttons] Unhandled button interaction: ${customId}`);
}

/**
 * Handle the "Set Duration" button click — opens the duration modal.
 */
async function handleDurationButton(interaction) {
  const sessionKey = `${interaction.user.id}_${interaction.guildId}`;
  const session = sessions.get(sessionKey);

  if (!session || !session.type) {
    return interaction.reply({
      embeds: [buildErrorEmbed('Session expired. Please run `/gw schedule` again.')],
      ephemeral: true,
    });
  }

  const modal = new ModalBuilder()
    .setCustomId('gw_modal_duration')
    .setTitle('⏱️ Set Giveaway Duration');

  const duration = new TextInputBuilder()
    .setCustomId('duration')
    .setLabel('Duration')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('e.g. 30m, 2d, 1w, 3600s, 12h')
    .setRequired(true);

  modal.addComponents(new ActionRowBuilder().addComponents(duration));

  return interaction.showModal(modal);
}

/**
 * Handle pagination buttons for /gw list.
 */
async function handleListPagination(interaction) {
  return interaction.reply({
    embeds: [buildErrorEmbed('Pagination is not yet needed for this list size.')],
    ephemeral: true,
  });
}

module.exports = { handleButton };
