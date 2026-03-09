/**
 * utils/embeds.js
 * ---------------
 * Reusable embed builders for every embed the bot sends.
 * All embeds follow the PRD Section 11 design specifications
 * with polished formatting and visual hierarchy.
 */

const { EmbedBuilder } = require('discord.js');
const defaults = require('../config/defaults');

/**
 * Map giveaway type keys to human-readable labels.
 */
const TYPE_LABELS = {
  mutual: 'Mutual Giveaway',
  sponsorship: 'Sponsorship Giveaway',
  event: 'Event Giveaway',
};

/**
 * Map giveaway type keys to header emojis.
 */
const TYPE_EMOJIS = {
  mutual: '🤝',
  sponsorship: '💰',
  event: '🎉',
};

/**
 * Build the Active Giveaway embed (Section 11.1).
 *
 * - Mutual / Sponsorship: Shows default requirements in embed, NO server link
 *   (server link is sent outside the embed by poster.js).
 * - Event: Shows custom requirementText if provided.
 *
 * @param {object} giveaway — Row from the giveaways table
 * @returns {EmbedBuilder}
 */
function buildActiveGiveawayEmbed(giveaway) {
  const typeLabel = TYPE_LABELS[giveaway.type] || giveaway.type;
  const typeEmoji = TYPE_EMOJIS[giveaway.type] || '🎉';

  const fields = [
    { name: '🏆  Prize', value: giveaway.prize, inline: true },
    { name: '👥  Winners', value: `${giveaway.winners} winner(s)`, inline: true },
  ];

  /* End time — show relative timestamp if endAt is set */
  if (giveaway.endAt) {
    fields.push({ name: '⏰  Ends', value: `<t:${giveaway.endAt}:R>`, inline: true });
  }

  /* ── Requirements ──────────────────────────────────────── */
  if (giveaway.type === 'mutual' || giveaway.type === 'sponsorship') {
    /* Default requirement text for mutual/sponsorship */
    fields.push({
      name: '📋  Requirements',
      value: defaults.SPONSOR_MUTUAL_REQUIREMENTS,
      inline: false,
    });
  } else if (giveaway.type === 'event' && giveaway.requirementText) {
    /* Custom requirement text for event giveaways */
    fields.push({
      name: '📋  Requirements',
      value: giveaway.requirementText,
      inline: false,
    });
  }

  /* Links for event giveaways (if they exist and separate from requirements) */
  if (giveaway.type === 'event' && giveaway.serverLink) {
    fields.push({ name: '🔗  Links', value: giveaway.serverLink, inline: false });
  }

  return new EmbedBuilder()
    .setTitle(`${typeEmoji}  GIVEAWAY — ${typeLabel}`)
    .addFields(fields)
    .setDescription('React with 🎉 to enter!')
    .setColor(defaults.EMBED_COLOR_ACTIVE)
    .setFooter({ text: `${defaults.EMBED_FOOTER_TEXT}  •  Giveaway ID: ${giveaway.id}` })
    .setTimestamp();
}

/**
 * Build the Ended Giveaway embed (Section 11.2).
 *
 * @param {object} giveaway — Row from the giveaways table
 * @param {string[]} winnerIds — Array of winner user IDs
 * @returns {EmbedBuilder}
 */
function buildEndedGiveawayEmbed(giveaway, winnerIds) {
  const typeLabel = TYPE_LABELS[giveaway.type] || giveaway.type;

  const fields = [
    { name: '🏆  Prize', value: giveaway.prize, inline: true },
    { name: '👥  Winners', value: `${giveaway.winners} winner(s)`, inline: true },
  ];

  /* Requirements — keep visible in ended state */
  if (giveaway.type === 'mutual' || giveaway.type === 'sponsorship') {
    fields.push({
      name: '📋  Requirements',
      value: defaults.SPONSOR_MUTUAL_REQUIREMENTS,
      inline: false,
    });
  } else if (giveaway.type === 'event' && giveaway.requirementText) {
    fields.push({
      name: '📋  Requirements',
      value: giveaway.requirementText,
      inline: false,
    });
  }

  /* Links for event giveaways */
  if (giveaway.type === 'event' && giveaway.serverLink) {
    fields.push({ name: '🔗  Links', value: giveaway.serverLink, inline: false });
  }

  /* Winner mentions */
  const winnerMentions =
    winnerIds.length > 0
      ? winnerIds.map((id) => `<@${id}>`).join(', ')
      : 'No valid entries';

  fields.push({ name: '🥇  Winner(s)', value: winnerMentions, inline: false });

  return new EmbedBuilder()
    .setTitle(`🎊  GIVEAWAY ENDED — ${typeLabel}`)
    .addFields(fields)
    .setColor(defaults.EMBED_COLOR_ENDED)
    .setFooter({ text: `${defaults.EMBED_FOOTER_TEXT}  •  Giveaway ID: ${giveaway.id}` })
    .setTimestamp();
}

/**
 * Build the success confirmation embed shown after scheduling a giveaway (Section 11.4).
 *
 * @param {object} giveaway — Row from the giveaways table
 * @param {string} channelName — Human-readable channel name
 * @returns {EmbedBuilder}
 */
function buildSuccessEmbed(giveaway, channelName) {
  const typeLabel = TYPE_LABELS[giveaway.type] || giveaway.type;

  return new EmbedBuilder()
    .setTitle('✅  Giveaway Scheduled')
    .addFields(
      { name: 'ID', value: giveaway.id, inline: true },
      { name: 'Type', value: typeLabel, inline: true },
      { name: 'Prize', value: giveaway.prize, inline: true },
      { name: 'Winners', value: `${giveaway.winners}`, inline: true },
      { name: 'Posts at', value: `<t:${giveaway.postAt}:F>`, inline: true },
      { name: 'Channel', value: channelName ? `#${channelName}` : 'Configured channel', inline: true }
    )
    .setColor(defaults.EMBED_COLOR_SUCCESS)
    .setFooter({ text: defaults.EMBED_FOOTER_TEXT })
    .setTimestamp();
}

/**
 * Build the /gw list embed (Section 11.5).
 *
 * @param {string} serverName — Guild name
 * @param {object[]} activeGiveaways — Giveaways with status queued/active
 * @param {object[]} recentGiveaways — Recently ended/stopped giveaways (max 10)
 * @returns {EmbedBuilder}
 */
function buildListEmbed(serverName, activeGiveaways, recentGiveaways) {
  const typeShort = { mutual: 'Mutual', sponsorship: 'Sponsorship', event: 'Event' };

  /* Queued / Active section */
  let activeText = '';
  if (activeGiveaways.length === 0) {
    activeText = 'No queued or active giveaways.';
  } else {
    activeText = activeGiveaways
      .map((g) => {
        const status = g.status === 'queued' ? `Posts <t:${g.postAt}:R>` : 'Active';
        return `• **${g.id}** | ${typeShort[g.type] || g.type} | ${g.prize} | ${status} | <#${g.channelId || 'N/A'}>`;
      })
      .join('\n');
  }

  /* Recent section */
  let recentText = '';
  if (recentGiveaways.length === 0) {
    recentText = 'No recent giveaways.';
  } else {
    recentText = recentGiveaways
      .map((g) => {
        let winnerStr = '';
        if (g.winnerIds) {
          try {
            const ids = JSON.parse(g.winnerIds);
            winnerStr = ` | Winners: ${ids.map((id) => `<@${id}>`).join(', ')}`;
          } catch {
            winnerStr = '';
          }
        }
        const statusLabel = g.status.charAt(0).toUpperCase() + g.status.slice(1);
        return `• **${g.id}** | ${typeShort[g.type] || g.type} | ${g.prize} | ${statusLabel}${winnerStr}`;
      })
      .join('\n');
  }

  return new EmbedBuilder()
    .setTitle(`📋  Giveaways — ${serverName}`)
    .addFields(
      { name: 'QUEUED / ACTIVE', value: activeText },
      { name: 'RECENT (Last 10 Ended)', value: recentText }
    )
    .setColor(defaults.EMBED_COLOR_ACTIVE)
    .setFooter({ text: defaults.EMBED_FOOTER_TEXT })
    .setTimestamp();
}

/**
 * Build a generic error embed.
 *
 * @param {string} message — Error message to display
 * @returns {EmbedBuilder}
 */
function buildErrorEmbed(message) {
  return new EmbedBuilder()
    .setDescription(`❌  ${message}`)
    .setColor(defaults.EMBED_COLOR_ERROR);
}

/**
 * Build a no-permission embed.
 *
 * @returns {EmbedBuilder}
 */
function buildNoPermissionEmbed() {
  return new EmbedBuilder()
    .setDescription("❌  **You don't have permission to use this command.**")
    .setColor(defaults.EMBED_COLOR_ERROR);
}

/**
 * Build a not-configured embed.
 *
 * @returns {EmbedBuilder}
 */
function buildNotConfiguredEmbed() {
  return new EmbedBuilder()
    .setDescription('⚠️  This server has not been configured yet. Run `/gw config` first.')
    .setColor(defaults.EMBED_COLOR_ERROR);
}

module.exports = {
  TYPE_LABELS,
  buildActiveGiveawayEmbed,
  buildEndedGiveawayEmbed,
  buildSuccessEmbed,
  buildListEmbed,
  buildErrorEmbed,
  buildNoPermissionEmbed,
  buildNotConfiguredEmbed,
};
