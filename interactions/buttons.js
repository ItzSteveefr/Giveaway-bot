/**
 * interactions/buttons.js
 * -----------------------
 * Handles all ButtonInteraction events, routed by customId.
 * Currently handles pagination for the /gw list command.
 * Additional button interactions can be added here as needed.
 */

const { buildErrorEmbed } = require('../utils/embeds');

/**
 * Handle a button interaction.
 * @param {import('discord.js').ButtonInteraction} interaction
 */
async function handleButton(interaction) {
  const { customId } = interaction;

  /* ── List Pagination ────────────────────────────────────── */
  if (customId.startsWith('gw_list_')) {
    return handleListPagination(interaction);
  }

  /* Unknown button — ignore gracefully */
  console.warn(`[Buttons] Unhandled button interaction: ${customId}`);
}

/**
 * Handle pagination buttons for /gw list.
 * Custom IDs follow the pattern: gw_list_prev_{page} or gw_list_next_{page}
 */
async function handleListPagination(interaction) {
  /* Pagination is handled directly in the list embed builder */
  /* This is a placeholder for future pagination logic if the list */
  /* grows beyond a single embed. Currently the list shows all */
  /* queued/active and last 10 ended in a single embed. */
  return interaction.reply({
    embeds: [buildErrorEmbed('Pagination is not yet needed for this list size.')],
    ephemeral: true,
  });
}

module.exports = { handleButton };
