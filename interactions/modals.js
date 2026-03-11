/**
 * interactions/modals.js
 * ----------------------
 * Handles all ModalSubmitInteraction events, routed by customId.
 *
 * TWO-MODAL FLOW:
 *   1st modal: collects giveaway info (type-specific fields, NO duration)
 *   → replies with a "⏱️ Set Duration" button
 *   2nd modal (gw_modal_duration): collects duration string (e.g. "2d", "30m")
 *   → continues to next step (channel selection or save)
 *
 * Also handles: custom channel name modals and edit field modals.
 */

const {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} = require('discord.js');
const sessions = require('./_sessions');
const { saveGiveawayFromSession } = require('./selectMenus');
const db = require('../database');
const { buildErrorEmbed, buildSuccessEmbed } = require('../utils/embeds');
const { generateGiveawayId } = require('../utils/idGenerator');
const defaults = require('../config/defaults');

/* ══════════════════════════════════════════════════════════
 *  DURATION PARSING UTILITY
 * ══════════════════════════════════════════════════════════ */

/**
 * Parse a duration string like "30m", "2d", "1w", "3600s" into seconds.
 * Supported units: s (seconds), m (minutes), d (days), w (weeks).
 *
 * @param {string} str — Duration string e.g. "7d"
 * @returns {number|null} Duration in seconds, or null if invalid
 */
function parseDuration(str) {
  const trimmed = str.trim().toLowerCase();
  const match = trimmed.match(/^(\d+)\s*([smhdw])$/);
  if (!match) return null;

  const amount = parseInt(match[1], 10);
  if (isNaN(amount) || amount < 1) return null;

  const unit = match[2];
  const multipliers = {
    s: 1,
    m: 60,
    h: 3600,
    d: 86400,
    w: 604800,
  };

  return amount * (multipliers[unit] || 0);
}

/* ══════════════════════════════════════════════════════════
 *  PING NORMALIZATION UTILITY
 * ══════════════════════════════════════════════════════════ */

/**
 * Normalize a ping value from the modal input.
 * Accepts: @everyone, @here, none, or a numeric role ID (Discord snowflake).
 * If a numeric role ID is provided, converts it to the mention format <@&ID>.
 *
 * @param {string} raw — Raw ping input from the modal
 * @returns {string} Normalized ping string
 */
function normalizePing(raw) {
  const trimmed = raw.trim();
  const lower = trimmed.toLowerCase();

  /* Pass through standard values */
  if (lower === 'none' || lower === '@everyone' || lower === '@here') {
    return trimmed;
  }

  /* If it's already a role mention like <@&123456789>, pass through */
  if (/^<@&\d+>$/.test(trimmed)) {
    return trimmed;
  }

  /* If it's a pure numeric snowflake (17-20 digits), convert to role mention */
  if (/^\d{17,20}$/.test(trimmed)) {
    return `<@&${trimmed}>`;
  }

  /* Anything else — pass through as-is */
  return trimmed;
}

/* ══════════════════════════════════════════════════════════
 *  MODAL ROUTER
 * ══════════════════════════════════════════════════════════ */

/**
 * Handle a modal submit interaction.
 * @param {import('discord.js').ModalSubmitInteraction} interaction
 */
async function handleModal(interaction) {
  const { customId } = interaction;

  /* ── Mutual Giveaway Modal ──────────────────────────────── */
  if (customId === 'gw_modal_mutual') {
    return handleMutualModal(interaction);
  }

  /* ── Sponsorship Giveaway Modal ─────────────────────────── */
  if (customId === 'gw_modal_sponsorship') {
    return handleSponsorshipModal(interaction);
  }

  /* ── Event Giveaway Modal ───────────────────────────────── */
  if (customId === 'gw_modal_event') {
    return handleEventModal(interaction);
  }

  /* ── Duration Modal (2nd modal for all types) ──────────── */
  if (customId === 'gw_modal_duration') {
    return handleDurationModal(interaction);
  }

  /* ── Sponsorship Custom Channel Name Modal ──────────────── */
  if (customId === 'gw_modal_sponsor_channelname') {
    return handleSponsorChannelNameModal(interaction);
  }

  /* ── Event Custom Channel Name Modal ────────────────────── */
  if (customId === 'gw_modal_event_channelname') {
    return handleEventChannelNameModal(interaction);
  }

  /* ── Edit Field Modals ──────────────────────────────────── */
  if (customId.startsWith('gw_modal_edit_')) {
    return handleEditModal(interaction);
  }
}

/* ══════════════════════════════════════════════════════════
 *  HELPER — Show duration button after first modal
 * ══════════════════════════════════════════════════════════ */

/**
 * Reply with a "Set Duration" button for the second modal.
 * @param {import('discord.js').ModalSubmitInteraction} interaction
 */
function showDurationButton(interaction) {
  const btn = new ButtonBuilder()
    .setCustomId('gw_duration_btn')
    .setLabel('⏱️ Set Duration')
    .setStyle(ButtonStyle.Primary);

  const row = new ActionRowBuilder().addComponents(btn);

  return interaction.reply({
    content: '✅ **Giveaway info saved!** Now set the duration for this giveaway.',
    components: [row],
    ephemeral: true,
  });
}

/* ══════════════════════════════════════════════════════════
 *  MUTUAL GIVEAWAY MODAL (1st modal — info only)
 * ══════════════════════════════════════════════════════════ */

async function handleMutualModal(interaction) {
  const sessionKey = `${interaction.user.id}_${interaction.guildId}`;
  const session = sessions.get(sessionKey) || {};

  /* Extract fields */
  const prize = interaction.fields.getTextInputValue('prize');
  const winnersStr = interaction.fields.getTextInputValue('winners');
  const serverLink = interaction.fields.getTextInputValue('serverLink');
  const ping = interaction.fields.getTextInputValue('ping');
  const postAtStr = interaction.fields.getTextInputValue('postAt');

  /* Validate winners count */
  const winners = parseInt(winnersStr, 10);
  if (isNaN(winners) || winners < 1 || !Number.isInteger(winners)) {
    return interaction.reply({
      embeds: [buildErrorEmbed('Winners must be a whole number greater than 0.')],
      ephemeral: true,
    });
  }

  /* Validate timestamp */
  const postAt = parseInt(postAtStr, 10);
  if (isNaN(postAt)) {
    return interaction.reply({
      embeds: [buildErrorEmbed('Invalid Unix timestamp. Please provide a valid number.')],
      ephemeral: true,
    });
  }

  const now = Math.floor(Date.now() / 1000);
  if (postAt <= now) {
    return interaction.reply({
      embeds: [buildErrorEmbed('Timestamp must be in the future.')],
      ephemeral: true,
    });
  }

  /* Resolve the mutual channel */
  const guildConfig = db.getGuildConfig(interaction.guildId);
  if (!guildConfig?.mutualChannelId) {
    return interaction.reply({
      embeds: [buildErrorEmbed('No mutual channel is configured. Run `/gw config` first.')],
      ephemeral: true,
    });
  }

  /* Save session data — duration will be set in the 2nd modal */
  Object.assign(session, {
    type: 'mutual',
    prize,
    winners,
    serverLink,
    ping,
    postAt,
    endAt: null,
    channelId: guildConfig.mutualChannelId,
  });

  /* Normalize ping — convert role IDs to mention format */
  session.ping = normalizePing(session.ping);

  sessions.set(sessionKey, session);

  /* Show the duration button → opens 2nd modal */
  return showDurationButton(interaction);
}

/* ══════════════════════════════════════════════════════════
 *  SPONSORSHIP GIVEAWAY MODAL (1st modal — info only)
 * ══════════════════════════════════════════════════════════ */

async function handleSponsorshipModal(interaction) {
  const sessionKey = `${interaction.user.id}_${interaction.guildId}`;
  const session = sessions.get(sessionKey) || {};

  /* Extract fields */
  const prize = interaction.fields.getTextInputValue('prize');
  const winnersStr = interaction.fields.getTextInputValue('winners');
  const serverLink = interaction.fields.getTextInputValue('serverLink');
  const ping = interaction.fields.getTextInputValue('ping');
  const postAtStr = interaction.fields.getTextInputValue('postAt');

  /* Validate winners count */
  const winners = parseInt(winnersStr, 10);
  if (isNaN(winners) || winners < 1 || !Number.isInteger(winners)) {
    return interaction.reply({
      embeds: [buildErrorEmbed('Winners must be a whole number greater than 0.')],
      ephemeral: true,
    });
  }

  /* Validate timestamp */
  const postAt = parseInt(postAtStr, 10);
  if (isNaN(postAt)) {
    return interaction.reply({
      embeds: [buildErrorEmbed('Invalid Unix timestamp. Please provide a valid number.')],
      ephemeral: true,
    });
  }

  const now = Math.floor(Date.now() / 1000);
  if (postAt <= now) {
    return interaction.reply({
      embeds: [buildErrorEmbed('Timestamp must be in the future.')],
      ephemeral: true,
    });
  }

  /* Save session — duration will be set in the 2nd modal, channel later */
  Object.assign(session, {
    type: 'sponsorship',
    prize,
    winners,
    serverLink,
    ping,
    postAt,
    endAt: null,
  });

  /* Normalize ping — convert role IDs to mention format */
  session.ping = normalizePing(session.ping);

  sessions.set(sessionKey, session);

  /* Show the duration button → opens 2nd modal */
  return showDurationButton(interaction);
}

/* ══════════════════════════════════════════════════════════
 *  EVENT GIVEAWAY MODAL (1st modal — info only)
 * ══════════════════════════════════════════════════════════ */

async function handleEventModal(interaction) {
  const sessionKey = `${interaction.user.id}_${interaction.guildId}`;
  const session = sessions.get(sessionKey) || {};

  /* Extract fields */
  const prize = interaction.fields.getTextInputValue('prize');
  const winnersStr = interaction.fields.getTextInputValue('winners');
  const requirementText = interaction.fields.getTextInputValue('requirements') || null;
  const postAtStr = interaction.fields.getTextInputValue('postAt');
  const ping = interaction.fields.getTextInputValue('ping');

  /* Validate winners count */
  const winners = parseInt(winnersStr, 10);
  if (isNaN(winners) || winners < 1 || !Number.isInteger(winners)) {
    return interaction.reply({
      embeds: [buildErrorEmbed('Winners must be a whole number greater than 0.')],
      ephemeral: true,
    });
  }

  /* Validate timestamp */
  const postAt = parseInt(postAtStr, 10);
  if (isNaN(postAt)) {
    return interaction.reply({
      embeds: [buildErrorEmbed('Invalid Unix timestamp. Please provide a valid number.')],
      ephemeral: true,
    });
  }

  const now = Math.floor(Date.now() / 1000);
  if (postAt <= now) {
    return interaction.reply({
      embeds: [buildErrorEmbed('Timestamp must be in the future.')],
      ephemeral: true,
    });
  }

  /* Save session — duration will be set in the 2nd modal, channel later */
  Object.assign(session, {
    type: 'event',
    prize,
    winners,
    serverLink: null,
    requirementText,
    ping,
    postAt,
    endAt: null,
  });

  /* Normalize ping — convert role IDs to mention format */
  session.ping = normalizePing(session.ping);

  sessions.set(sessionKey, session);

  /* Show the duration button → opens 2nd modal */
  return showDurationButton(interaction);
}

/* ══════════════════════════════════════════════════════════
 *  DURATION MODAL (2nd modal — for all types)
 * ══════════════════════════════════════════════════════════ */

async function handleDurationModal(interaction) {
  const sessionKey = `${interaction.user.id}_${interaction.guildId}`;
  const session = sessions.get(sessionKey);

  if (!session || !session.type) {
    return interaction.reply({
      embeds: [buildErrorEmbed('Session expired. Please run `/gw schedule` again.')],
      ephemeral: true,
    });
  }

  const durationStr = interaction.fields.getTextInputValue('duration');
  const durationSeconds = parseDuration(durationStr);

  if (!durationSeconds) {
    return interaction.reply({
      embeds: [buildErrorEmbed('Invalid duration format. Use a number followed by a unit:\n`s` = seconds, `m` = minutes, `h` = hours, `d` = days, `w` = weeks\nExamples: `30m`, `2d`, `1w`, `3600s`')],
      ephemeral: true,
    });
  }

  /* Calculate endAt from postAt + duration */
  session.endAt = session.postAt + durationSeconds;
  sessions.set(sessionKey, session);

  /* ── Route to the next step based on giveaway type ──────── */

  if (session.type === 'mutual') {
    /* Mutual: Channel is already set (preset). Save directly. */
    try {
      const id = generateGiveawayId();

      db.createGiveaway({
        id,
        guildId: interaction.guildId,
        type: 'mutual',
        prize: session.prize,
        winners: session.winners,
        serverLink: session.serverLink,
        ping: session.ping,
        postAt: session.postAt,
        endAt: session.endAt,
        channelId: session.channelId,
        createdBy: interaction.user.id,
      });

      let channelName = 'configured channel';
      try {
        const ch = await interaction.client.channels.fetch(session.channelId);
        channelName = ch?.name || 'configured channel';
      } catch {
        /* ignore */
      }

      const successEmbed = buildSuccessEmbed(
        { id, type: 'mutual', prize: session.prize, winners: session.winners, postAt: session.postAt },
        channelName
      );

      sessions.delete(sessionKey);
      return interaction.reply({ embeds: [successEmbed], ephemeral: true });
    } catch (err) {
      console.error(`[Modals] Error saving mutual giveaway: ${err.message}`);
      sessions.delete(sessionKey);
      return interaction.reply({
        embeds: [buildErrorEmbed(`Failed to create giveaway: ${err.message}`)],
        ephemeral: true,
      });
    }
  }

  if (session.type === 'sponsorship') {
    /* Sponsorship: Show channel selection next */
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('gw_sponsor_channel_select')
      .setPlaceholder('Select channel option')
      .addOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel('No Custom Channel (use preset)')
          .setDescription('Posts to the configured sponsor channel')
          .setEmoji('📌')
          .setValue('no_custom'),
        new StringSelectMenuOptionBuilder()
          .setLabel('Custom Channel (create new)')
          .setDescription('Create a new channel for this giveaway')
          .setEmoji('📁')
          .setValue('custom')
      );

    const row = new ActionRowBuilder().addComponents(selectMenu);

    return interaction.reply({
      content: '**Where should this giveaway be posted?**\n──────────────────────────────────────',
      components: [row],
      ephemeral: true,
    });
  }

  if (session.type === 'event') {
    /* Event: Show channel type selection next */
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('gw_event_channel_type_select')
      .setPlaceholder('Select channel type')
      .addOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel('Use Existing Channel')
          .setDescription('Post in an existing text channel')
          .setEmoji('📌')
          .setValue('existing'),
        new StringSelectMenuOptionBuilder()
          .setLabel('Create Custom Channel')
          .setDescription('Create a new channel for this giveaway')
          .setEmoji('📁')
          .setValue('custom')
      );

    const row = new ActionRowBuilder().addComponents(selectMenu);

    return interaction.reply({
      content: '**Select Channel Type**\n───────────────────',
      components: [row],
      ephemeral: true,
    });
  }
}

/* ══════════════════════════════════════════════════════════
 *  SPONSORSHIP CHANNEL NAME MODAL — DEFERRED CREATION
 * ══════════════════════════════════════════════════════════ */

async function handleSponsorChannelNameModal(interaction) {
  const sessionKey = `${interaction.user.id}_${interaction.guildId}`;
  const session = sessions.get(sessionKey);

  if (!session) {
    return interaction.reply({
      embeds: [buildErrorEmbed('Session expired. Please run `/gw schedule` again.')],
      ephemeral: true,
    });
  }

  const channelName = interaction.fields.getTextInputValue('channelName');

  /* Store channel creation params — channel will be created at post time */
  session.customChannelName = channelName;
  /* channelId stays null — poster.js creates the channel when it's time */

  /* Save the giveaway with deferred channel creation */
  return saveGiveawayFromSession(interaction, session);
}

/* ══════════════════════════════════════════════════════════
 *  EVENT CHANNEL NAME MODAL — DEFERRED CREATION
 * ══════════════════════════════════════════════════════════ */

async function handleEventChannelNameModal(interaction) {
  const sessionKey = `${interaction.user.id}_${interaction.guildId}`;
  const session = sessions.get(sessionKey);

  if (!session) {
    return interaction.reply({
      embeds: [buildErrorEmbed('Session expired. Please run `/gw schedule` again.')],
      ephemeral: true,
    });
  }

  const channelName = interaction.fields.getTextInputValue('channelName');

  /* Store channel creation params — channel will be created at post time */
  session.customChannelName = channelName;
  /* channelId stays null — poster.js creates the channel when it's time */

  /* Save the giveaway with deferred channel creation */
  return saveGiveawayFromSession(interaction, session);
}

/* ══════════════════════════════════════════════════════════
 *  EDIT FIELD MODALS
 * ══════════════════════════════════════════════════════════ */

async function handleEditModal(interaction) {
  const sessionKey = `${interaction.user.id}_${interaction.guildId}`;
  const editSession = sessions.get(sessionKey);

  if (!editSession?.giveawayId || !editSession?.editField) {
    return interaction.reply({
      embeds: [buildErrorEmbed('Session expired. Please run `/gw edit` again.')],
      ephemeral: true,
    });
  }

  const giveaway = db.getGiveawayByGuild(editSession.giveawayId, interaction.guildId);
  if (!giveaway) {
    sessions.delete(sessionKey);
    return interaction.reply({
      embeds: [buildErrorEmbed('Giveaway no longer exists.')],
      ephemeral: true,
    });
  }

  if (giveaway.status !== 'queued') {
    sessions.delete(sessionKey);
    return interaction.reply({
      embeds: [buildErrorEmbed('This giveaway can no longer be edited.')],
      ephemeral: true,
    });
  }

  const newValue = interaction.fields.getTextInputValue('editValue');
  const field = editSession.editField;

  /* Validate based on field type */
  const updates = {};

  if (field === 'prize') {
    if (!newValue.trim()) {
      return interaction.reply({
        embeds: [buildErrorEmbed('Prize cannot be empty.')],
        ephemeral: true,
      });
    }
    updates.prize = newValue.trim();
  } else if (field === 'winners') {
    const num = parseInt(newValue, 10);
    if (isNaN(num) || num < 1 || !Number.isInteger(num)) {
      return interaction.reply({
        embeds: [buildErrorEmbed('Winners must be a whole number greater than 0.')],
        ephemeral: true,
      });
    }
    updates.winners = num;
  } else if (field === 'postAt') {
    const ts = parseInt(newValue, 10);
    if (isNaN(ts)) {
      return interaction.reply({
        embeds: [buildErrorEmbed('Invalid Unix timestamp.')],
        ephemeral: true,
      });
    }
    const now = Math.floor(Date.now() / 1000);
    if (ts <= now) {
      return interaction.reply({
        embeds: [buildErrorEmbed('Timestamp must be in the future.')],
        ephemeral: true,
      });
    }
    updates.postAt = ts;

    /* Recalculate endAt if giveaway has an end time */
    if (giveaway.endAt) {
      const originalDuration = giveaway.endAt - giveaway.postAt;
      updates.endAt = ts + originalDuration;
    }
  } else if (field === 'serverLink') {
    updates.serverLink = newValue.trim() || null;
  }

  /* Apply the update */
  db.updateGiveaway(editSession.giveawayId, updates);

  sessions.delete(sessionKey);

  const embed = new EmbedBuilder()
    .setTitle('✅ Giveaway Updated')
    .setDescription(`Giveaway **${editSession.giveawayId}** has been updated.`)
    .addFields({
      name: field.charAt(0).toUpperCase() + field.slice(1),
      value: String(updates[field] ?? newValue),
      inline: true,
    })
    .setColor(defaults.EMBED_COLOR_SUCCESS)
    .setFooter({ text: defaults.EMBED_FOOTER_TEXT })
    .setTimestamp();

  return interaction.reply({ embeds: [embed], ephemeral: true });
}

module.exports = { handleModal, parseDuration };
