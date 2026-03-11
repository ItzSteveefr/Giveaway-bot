/**
 * interactions/selectMenus.js
 * ---------------------------
 * Handles all StringSelectMenuInteraction events, routed by customId.
 * Covers the entire multi-step giveaway creation flow, edit field
 * selection, and channel/category selection for Sponsorship and Event types.
 */

const {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ChannelType,
} = require('discord.js');
const sessions = require('./_sessions');
const db = require('../database');
const { buildErrorEmbed, buildSuccessEmbed } = require('../utils/embeds');
const { generateGiveawayId } = require('../utils/idGenerator');
const defaults = require('../config/defaults');

/**
 * Handle a select menu interaction.
 * @param {import('discord.js').StringSelectMenuInteraction} interaction
 */
async function handleSelectMenu(interaction) {
  const { customId } = interaction;

  /* ── Step 1: Type Selection ─────────────────────────────── */
  if (customId === 'gw_type_select') {
    return handleTypeSelect(interaction);
  }

  /* ── Sponsorship: Channel Type Selection ────────────────── */
  if (customId === 'gw_sponsor_channel_select') {
    return handleSponsorChannelSelect(interaction);
  }

  /* ── Sponsorship: Category Selection ────────────────────── */
  if (customId === 'gw_sponsor_category_select') {
    return handleSponsorCategorySelect(interaction);
  }

  /* ── Event: Channel Type Selection ──────────────────────── */
  if (customId === 'gw_event_channel_type_select') {
    return handleEventChannelTypeSelect(interaction);
  }

  /* ── Event: Existing Channel Selection ──────────────────── */
  if (customId === 'gw_event_channel_existing_select') {
    return handleEventExistingChannelSelect(interaction);
  }

  /* ── Event: Category Selection ──────────────────────────── */
  if (customId === 'gw_event_category_select') {
    return handleEventCategorySelect(interaction);
  }

  /* ── Edit: Field Selection ──────────────────────────────── */
  if (customId === 'gw_edit_field_select') {
    return handleEditFieldSelect(interaction);
  }
}

/* ══════════════════════════════════════════════════════════
 *  TYPE SELECTION (Step 1)
 * ══════════════════════════════════════════════════════════ */

/**
 * Handle the giveaway type selection — opens the appropriate modal.
 */
async function handleTypeSelect(interaction) {
  const type = interaction.values[0]; // 'mutual' | 'sponsorship' | 'event'
  const sessionKey = `${interaction.user.id}_${interaction.guildId}`;

  /* Store the type in the session */
  sessions.set(sessionKey, { type });

  if (type === 'mutual') {
    return showMutualModal(interaction);
  } else if (type === 'sponsorship') {
    return showSponsorshipModal(interaction);
  } else if (type === 'event') {
    return showEventModal(interaction);
  }
}

/* ── Mutual Modal (Step 2A) — NO duration ─────────────────── */

function showMutualModal(interaction) {
  const modal = new ModalBuilder()
    .setCustomId('gw_modal_mutual')
    .setTitle('🤝 Mutual Giveaway Setup');

  const prize = new TextInputBuilder()
    .setCustomId('prize')
    .setLabel('Prize')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('e.g. Nitro Classic')
    .setRequired(true);

  const winners = new TextInputBuilder()
    .setCustomId('winners')
    .setLabel('Number of Winners')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('e.g. 3')
    .setRequired(true);

  const serverLink = new TextInputBuilder()
    .setCustomId('serverLink')
    .setLabel('Server Link')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('https://discord.gg/...')
    .setRequired(true);

  const ping = new TextInputBuilder()
    .setCustomId('ping')
    .setLabel('Ping')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('@everyone / @here / none / Role ID')
    .setRequired(true);

  const postTimestamp = new TextInputBuilder()
    .setCustomId('postAt')
    .setLabel('Post Timestamp (Unix)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('e.g. 1720000000')
    .setRequired(true);

  modal.addComponents(
    new ActionRowBuilder().addComponents(prize),
    new ActionRowBuilder().addComponents(winners),
    new ActionRowBuilder().addComponents(serverLink),
    new ActionRowBuilder().addComponents(ping),
    new ActionRowBuilder().addComponents(postTimestamp)
  );

  return interaction.showModal(modal);
}

/* ── Sponsorship Modal (Step 2B) ──────────────────────────── */

function showSponsorshipModal(interaction) {
  const modal = new ModalBuilder()
    .setCustomId('gw_modal_sponsorship')
    .setTitle('💰 Sponsorship Giveaway Setup');

  const prize = new TextInputBuilder()
    .setCustomId('prize')
    .setLabel('Prize')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('e.g. $50 Steam Gift Card')
    .setRequired(true);

  const winners = new TextInputBuilder()
    .setCustomId('winners')
    .setLabel('Number of Winners')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('e.g. 1')
    .setRequired(true);

  const serverLink = new TextInputBuilder()
    .setCustomId('serverLink')
    .setLabel('Server Link')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('https://discord.gg/...')
    .setRequired(true);

  const ping = new TextInputBuilder()
    .setCustomId('ping')
    .setLabel('Ping')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('@everyone / @here / none / Role ID')
    .setRequired(true);

  const postTimestamp = new TextInputBuilder()
    .setCustomId('postAt')
    .setLabel('Post Timestamp (Unix)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('e.g. 1720000000')
    .setRequired(true);

  modal.addComponents(
    new ActionRowBuilder().addComponents(prize),
    new ActionRowBuilder().addComponents(winners),
    new ActionRowBuilder().addComponents(serverLink),
    new ActionRowBuilder().addComponents(ping),
    new ActionRowBuilder().addComponents(postTimestamp)
  );

  return interaction.showModal(modal);
}

/* ── Event Modal (Step 2C) ────────────────────────────────── */

function showEventModal(interaction) {
  const modal = new ModalBuilder()
    .setCustomId('gw_modal_event')
    .setTitle('🎉 Event Giveaway Setup');

  const prize = new TextInputBuilder()
    .setCustomId('prize')
    .setLabel('Prize')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('e.g. Custom Role')
    .setRequired(true);

  const winners = new TextInputBuilder()
    .setCustomId('winners')
    .setLabel('Number of Winners')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('e.g. 2')
    .setRequired(true);

  const requirements = new TextInputBuilder()
    .setCustomId('requirements')
    .setLabel('Custom Requirements')
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder('Optional — e.g. Must follow @user on Twitter\nMust be level 5+')
    .setRequired(false);

  const postTimestamp = new TextInputBuilder()
    .setCustomId('postAt')
    .setLabel('Post Timestamp (Unix)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('e.g. 1720000000')
    .setRequired(true);

  const ping = new TextInputBuilder()
    .setCustomId('ping')
    .setLabel('Ping')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('@everyone / @here / none / Role ID')
    .setRequired(true);

  modal.addComponents(
    new ActionRowBuilder().addComponents(prize),
    new ActionRowBuilder().addComponents(winners),
    new ActionRowBuilder().addComponents(requirements),
    new ActionRowBuilder().addComponents(postTimestamp),
    new ActionRowBuilder().addComponents(ping)
  );

  return interaction.showModal(modal);
}

/* ══════════════════════════════════════════════════════════
 *  SPONSORSHIP CHANNEL FLOW (Steps 2B-2 / 2B-3)
 * ══════════════════════════════════════════════════════════ */

async function handleSponsorChannelSelect(interaction) {
  const choice = interaction.values[0]; // 'no_custom' | 'custom'
  const sessionKey = `${interaction.user.id}_${interaction.guildId}`;
  const session = sessions.get(sessionKey);

  if (!session) {
    return interaction.reply({ embeds: [buildErrorEmbed('Session expired. Please run `/gw schedule` again.')], ephemeral: true });
  }

  if (choice === 'no_custom') {
    /* Use the preset sponsor channel */
    const guildConfig = db.getGuildConfig(interaction.guildId);
    if (!guildConfig?.sponsorChannelId) {
      return interaction.update({
        content: '',
        embeds: [buildErrorEmbed('No sponsor channel is configured. Run `/gw config` first.')],
        components: [],
      });
    }

    session.channelId = guildConfig.sponsorChannelId;

    /* Save the giveaway */
    return saveGiveawayFromSession(interaction, session);
  }

  if (choice === 'custom') {
    /* Show category selection */
    const categories = interaction.guild.channels.cache
      .filter((c) => c.type === ChannelType.GuildCategory)
      .map((c) => ({ label: c.name, value: c.id }));

    if (categories.length === 0) {
      return interaction.update({
        content: '',
        embeds: [buildErrorEmbed('No categories found in this server. Create one first.')],
        components: [],
      });
    }

    /* Trim to max 25 options (Discord limit) */
    const options = categories.slice(0, 25).map((c) =>
      new StringSelectMenuOptionBuilder().setLabel(c.label).setValue(c.value)
    );

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('gw_sponsor_category_select')
      .setPlaceholder('Select a category')
      .addOptions(options);

    const row = new ActionRowBuilder().addComponents(selectMenu);

    return interaction.update({
      content: '**Select Category for Custom Channel:**',
      components: [row],
    });
  }
}

async function handleSponsorCategorySelect(interaction) {
  const categoryId = interaction.values[0];
  const sessionKey = `${interaction.user.id}_${interaction.guildId}`;
  const session = sessions.get(sessionKey);

  if (!session) {
    return interaction.reply({ embeds: [buildErrorEmbed('Session expired. Please run `/gw schedule` again.')], ephemeral: true });
  }

  session.categoryId = categoryId;
  sessions.set(sessionKey, session);

  /* Open modal for channel name */
  const modal = new ModalBuilder()
    .setCustomId('gw_modal_sponsor_channelname')
    .setTitle('💰 Custom Channel Name');

  const channelName = new TextInputBuilder()
    .setCustomId('channelName')
    .setLabel('Channel Name')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('e.g. 💰〡sponsored-giveaway')
    .setRequired(true);

  modal.addComponents(new ActionRowBuilder().addComponents(channelName));

  return interaction.showModal(modal);
}

/* ══════════════════════════════════════════════════════════
 *  EVENT CHANNEL FLOW (Steps 2C-2)
 * ══════════════════════════════════════════════════════════ */

async function handleEventChannelTypeSelect(interaction) {
  const choice = interaction.values[0]; // 'existing' | 'custom'
  const sessionKey = `${interaction.user.id}_${interaction.guildId}`;
  const session = sessions.get(sessionKey);

  if (!session) {
    return interaction.reply({ embeds: [buildErrorEmbed('Session expired. Please run `/gw schedule` again.')], ephemeral: true });
  }

  if (choice === 'existing') {
    /* Show existing text channels */
    const textChannels = interaction.guild.channels.cache
      .filter((c) => c.type === ChannelType.GuildText)
      .map((c) => ({ label: `#${c.name}`, value: c.id }));

    if (textChannels.length === 0) {
      return interaction.update({
        content: '',
        embeds: [buildErrorEmbed('No text channels found in this server.')],
        components: [],
      });
    }

    const options = textChannels.slice(0, 25).map((c) =>
      new StringSelectMenuOptionBuilder().setLabel(c.label).setValue(c.value)
    );

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('gw_event_channel_existing_select')
      .setPlaceholder('Select a channel')
      .addOptions(options);

    const row = new ActionRowBuilder().addComponents(selectMenu);

    return interaction.update({
      content: '**Select Channel:**',
      components: [row],
    });
  }

  if (choice === 'custom') {
    /* Show category selection */
    const categories = interaction.guild.channels.cache
      .filter((c) => c.type === ChannelType.GuildCategory)
      .map((c) => ({ label: c.name, value: c.id }));

    if (categories.length === 0) {
      return interaction.update({
        content: '',
        embeds: [buildErrorEmbed('No categories found in this server. Create one first.')],
        components: [],
      });
    }

    const options = categories.slice(0, 25).map((c) =>
      new StringSelectMenuOptionBuilder().setLabel(c.label).setValue(c.value)
    );

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('gw_event_category_select')
      .setPlaceholder('Select a category')
      .addOptions(options);

    const row = new ActionRowBuilder().addComponents(selectMenu);

    return interaction.update({
      content: '**Select Category for Custom Channel:**',
      components: [row],
    });
  }
}

async function handleEventExistingChannelSelect(interaction) {
  const channelId = interaction.values[0];
  const sessionKey = `${interaction.user.id}_${interaction.guildId}`;
  const session = sessions.get(sessionKey);

  if (!session) {
    return interaction.reply({ embeds: [buildErrorEmbed('Session expired. Please run `/gw schedule` again.')], ephemeral: true });
  }

  session.channelId = channelId;

  /* Save the giveaway */
  return saveGiveawayFromSession(interaction, session);
}

async function handleEventCategorySelect(interaction) {
  const categoryId = interaction.values[0];
  const sessionKey = `${interaction.user.id}_${interaction.guildId}`;
  const session = sessions.get(sessionKey);

  if (!session) {
    return interaction.reply({ embeds: [buildErrorEmbed('Session expired. Please run `/gw schedule` again.')], ephemeral: true });
  }

  session.categoryId = categoryId;
  sessions.set(sessionKey, session);

  /* Open modal for channel name */
  const modal = new ModalBuilder()
    .setCustomId('gw_modal_event_channelname')
    .setTitle('🎉 Custom Channel Name');

  const channelName = new TextInputBuilder()
    .setCustomId('channelName')
    .setLabel('Channel Name')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('e.g. 🎉〡event-giveaway')
    .setRequired(true);

  modal.addComponents(new ActionRowBuilder().addComponents(channelName));

  return interaction.showModal(modal);
}

/* ══════════════════════════════════════════════════════════
 *  EDIT FIELD SELECTION
 * ══════════════════════════════════════════════════════════ */

async function handleEditFieldSelect(interaction) {
  const field = interaction.values[0]; // 'prize' | 'winners' | 'postAt' | 'serverLink'
  const sessionKey = `${interaction.user.id}_${interaction.guildId}`;
  const editSession = sessions.get(sessionKey);

  if (!editSession?.giveawayId) {
    return interaction.reply({ embeds: [buildErrorEmbed('Session expired. Please run `/gw edit` again.')], ephemeral: true });
  }

  const giveaway = db.getGiveaway(editSession.giveawayId);
  if (!giveaway) {
    return interaction.reply({ embeds: [buildErrorEmbed('Giveaway no longer exists.')], ephemeral: true });
  }

  /* Store which field is being edited */
  editSession.editField = field;
  sessions.set(sessionKey, editSession);

  /* Field label and current value mapping */
  const fieldLabels = {
    prize: { label: 'Prize', current: giveaway.prize },
    winners: { label: 'Number of Winners', current: String(giveaway.winners) },
    postAt: { label: 'Post Timestamp (Unix)', current: String(giveaway.postAt) },
    serverLink: { label: 'Link', current: giveaway.serverLink || '' },
  };

  const info = fieldLabels[field];

  const modal = new ModalBuilder()
    .setCustomId(`gw_modal_edit_${field}`)
    .setTitle(`Edit ${info.label}`);

  const input = new TextInputBuilder()
    .setCustomId('editValue')
    .setLabel(info.label)
    .setStyle(TextInputStyle.Short)
    .setValue(info.current)
    .setRequired(field !== 'serverLink'); /* Link is optional */

  modal.addComponents(new ActionRowBuilder().addComponents(input));

  return interaction.showModal(modal);
}

/* ══════════════════════════════════════════════════════════
 *  HELPERS
 * ══════════════════════════════════════════════════════════ */

/**
 * Save a giveaway from the session data and confirm to the user.
 * Used when the channel has been resolved (no more steps needed).
 */
async function saveGiveawayFromSession(interaction, session) {
  const sessionKey = `${interaction.user.id}_${interaction.guildId}`;

  try {
    /* Generate a unique giveaway ID */
    const id = generateGiveawayId();

    const giveawayData = {
      id,
      guildId: interaction.guildId,
      type: session.type,
      prize: session.prize,
      winners: session.winners,
      serverLink: session.serverLink || null,
      ping: session.ping || null,
      postAt: session.postAt,
      endAt: session.endAt || null,
      channelId: session.channelId || null,
      categoryId: session.categoryId || null,
      customChannelName: session.customChannelName || null,
      requirementText: session.requirementText || null,
      createdBy: interaction.user.id,
    };

    db.createGiveaway(giveawayData);

    /* Resolve channel name for the success embed */
    let channelName = 'unknown';
    if (session.channelId) {
      try {
        const ch = await interaction.client.channels.fetch(session.channelId);
        channelName = ch?.name || 'unknown';
      } catch {
        channelName = session.customChannelName || 'unknown';
      }
    } else if (session.customChannelName) {
      channelName = `${session.customChannelName} (created at post time)`;
    }

    /* Build and send the success embed */
    const successEmbed = buildSuccessEmbed(giveawayData, channelName);

    /* Clean up the session */
    sessions.delete(sessionKey);

    /* Use update if possible (from a select menu), otherwise reply */
    if (interaction.isStringSelectMenu()) {
      return interaction.update({
        content: '',
        embeds: [successEmbed],
        components: [],
      });
    } else {
      return interaction.reply({
        embeds: [successEmbed],
        ephemeral: true,
      });
    }
  } catch (err) {
    console.error(`[SelectMenus] Error saving giveaway: ${err.message}`);
    sessions.delete(sessionKey);

    if (interaction.isStringSelectMenu()) {
      return interaction.update({
        content: '',
        embeds: [buildErrorEmbed(`Failed to save giveaway: ${err.message}`)],
        components: [],
      });
    } else {
      return interaction.reply({
        embeds: [buildErrorEmbed(`Failed to save giveaway: ${err.message}`)],
        ephemeral: true,
      });
    }
  }
}

module.exports = { handleSelectMenu, saveGiveawayFromSession };
