/**
 * interactions/modals.js
 * ----------------------
 * Handles all ModalSubmitInteraction events, routed by customId.
 * Covers all giveaway creation modals (mutual, sponsorship, event),
 * custom channel name modals, and edit field modals.
 */

const {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  EmbedBuilder,
} = require('discord.js');
const sessions = require('./_sessions');
const { saveGiveawayFromSession } = require('./selectMenus');
const db = require('../database');
const { buildErrorEmbed, buildSuccessEmbed } = require('../utils/embeds');
const { generateGiveawayId } = require('../utils/idGenerator');
const { createChannel } = require('../utils/channelCreator');
const defaults = require('../config/defaults');

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
 *  MUTUAL GIVEAWAY MODAL (Step 2A submit)
 * ══════════════════════════════════════════════════════════ */

async function handleMutualModal(interaction) {
  const sessionKey = `${interaction.user.id}_${interaction.guildId}`;
  const session = sessions.get(sessionKey) || {};

  /* Extract fields */
  const prize = interaction.fields.getTextInputValue('prize');
  const winnersStr = interaction.fields.getTextInputValue('winners');
  const serverLink = interaction.fields.getTextInputValue('serverLink');
  const ping = interaction.fields.getTextInputValue('ping');
  const postAndDays = interaction.fields.getTextInputValue('postAndDays');

  /* Parse the combined "timestamp | days" field */
  const parts = postAndDays.split('|').map((s) => s.trim());
  if (parts.length !== 2) {
    return interaction.reply({
      embeds: [buildErrorEmbed('Invalid format. Use: `timestamp | days` (e.g. `1720000000 | 7`)')],
      ephemeral: true,
    });
  }

  const postAt = parseInt(parts[0], 10);
  const days = parseInt(parts[1], 10);

  /* Validate winners count */
  const winners = parseInt(winnersStr, 10);
  if (isNaN(winners) || winners < 1 || !Number.isInteger(winners)) {
    return interaction.reply({
      embeds: [buildErrorEmbed('Winners must be a whole number greater than 0.')],
      ephemeral: true,
    });
  }

  /* Validate timestamp */
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

  /* Validate days */
  if (isNaN(days) || days < 1 || !Number.isInteger(days)) {
    return interaction.reply({
      embeds: [buildErrorEmbed('Duration must be a whole number of days greater than 0.')],
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

  /* Calculate endAt */
  const endAt = postAt + days * 86400;

  /* Save session data */
  Object.assign(session, {
    type: 'mutual',
    prize,
    winners,
    serverLink,
    ping,
    postAt,
    endAt,
    channelId: guildConfig.mutualChannelId,
  });

  /* Generate ID and save directly (no more steps for mutual) */
  try {
    const id = generateGiveawayId();

    db.createGiveaway({
      id,
      guildId: interaction.guildId,
      type: 'mutual',
      prize,
      winners,
      serverLink,
      ping,
      postAt,
      endAt,
      channelId: guildConfig.mutualChannelId,
      createdBy: interaction.user.id,
    });

    /* Resolve channel name */
    let channelName = 'configured channel';
    try {
      const ch = await interaction.client.channels.fetch(guildConfig.mutualChannelId);
      channelName = ch?.name || 'configured channel';
    } catch {
      /* ignore */
    }

    const successEmbed = buildSuccessEmbed(
      { id, type: 'mutual', prize, winners, postAt },
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

/* ══════════════════════════════════════════════════════════
 *  SPONSORSHIP GIVEAWAY MODAL (Step 2B submit)
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

  /* Update session with all collected data */
  Object.assign(session, {
    type: 'sponsorship',
    prize,
    winners,
    serverLink,
    ping,
    postAt,
    endAt: null, /* Sponsorship has no auto-end */
  });
  sessions.set(sessionKey, session);

  /* Show channel selection (Step 2B-2) */
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

/* ══════════════════════════════════════════════════════════
 *  EVENT GIVEAWAY MODAL (Step 2C submit)
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

  /* Update session */
  Object.assign(session, {
    type: 'event',
    prize,
    winners,
    serverLink: null,
    requirementText,
    ping,
    postAt,
    endAt: null, /* Event has no auto-end */
  });
  sessions.set(sessionKey, session);

  /* Show channel type selection (Step 2C-2) */
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

/* ══════════════════════════════════════════════════════════
 *  SPONSORSHIP CHANNEL NAME MODAL (Step 2B-3)
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

  await interaction.deferReply({ ephemeral: true });

  try {
    /* Create the channel in the selected category */
    const channel = await createChannel(interaction.guild, session.categoryId, channelName);

    session.channelId = channel.id;
    session.customChannelName = channelName;

    /* Generate ID and save */
    const id = generateGiveawayId();

    db.createGiveaway({
      id,
      guildId: interaction.guildId,
      type: session.type,
      prize: session.prize,
      winners: session.winners,
      serverLink: session.serverLink || null,
      ping: session.ping || null,
      postAt: session.postAt,
      endAt: session.endAt || null,
      channelId: channel.id,
      categoryId: session.categoryId,
      customChannelName: channelName,
      createdBy: interaction.user.id,
    });

    const successEmbed = buildSuccessEmbed(
      { id, type: session.type, prize: session.prize, winners: session.winners, postAt: session.postAt },
      channel.name
    );

    sessions.delete(sessionKey);

    return interaction.editReply({ embeds: [successEmbed] });
  } catch (err) {
    console.error(`[Modals] Error creating sponsor channel: ${err.message}`);
    sessions.delete(sessionKey);
    return interaction.editReply({
      embeds: [buildErrorEmbed(`Failed to create channel: ${err.message}`)],
    });
  }
}

/* ══════════════════════════════════════════════════════════
 *  EVENT CHANNEL NAME MODAL (Step 2C custom channel)
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

  await interaction.deferReply({ ephemeral: true });

  try {
    /* Create the channel in the selected category */
    const channel = await createChannel(interaction.guild, session.categoryId, channelName);

    session.channelId = channel.id;
    session.customChannelName = channelName;

    /* Generate ID and save */
    const id = generateGiveawayId();

    db.createGiveaway({
      id,
      guildId: interaction.guildId,
      type: session.type,
      prize: session.prize,
      winners: session.winners,
      serverLink: session.serverLink || null,
      ping: session.ping || null,
      postAt: session.postAt,
      endAt: session.endAt || null,
      channelId: channel.id,
      categoryId: session.categoryId,
      customChannelName: channelName,
      createdBy: interaction.user.id,
    });

    const successEmbed = buildSuccessEmbed(
      { id, type: session.type, prize: session.prize, winners: session.winners, postAt: session.postAt },
      channel.name
    );

    sessions.delete(sessionKey);

    return interaction.editReply({ embeds: [successEmbed] });
  } catch (err) {
    console.error(`[Modals] Error creating event channel: ${err.message}`);
    sessions.delete(sessionKey);
    return interaction.editReply({
      embeds: [buildErrorEmbed(`Failed to create channel: ${err.message}`)],
    });
  }
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

    /* If mutual giveaway, recalculate endAt */
    if (giveaway.type === 'mutual' && giveaway.endAt) {
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

module.exports = { handleModal };
