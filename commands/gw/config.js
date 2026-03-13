/**
 * commands/gw/config.js
 * ---------------------
 * /gw config — Configure bot settings for this server.
 * Admin-only. Sets manager roles (multiple), mutual channel, and sponsor channel.
 */

const { SlashCommandSubcommandBuilder, ChannelType, PermissionFlagsBits } = require('discord.js');
const db = require('../../database');
const { buildErrorEmbed } = require('../../utils/embeds');
const defaults = require('../../config/defaults');
const { EmbedBuilder } = require('discord.js');

/**
 * Build the /gw config subcommand definition.
 * @returns {SlashCommandSubcommandBuilder}
 */
function buildSubcommand() {
  return new SlashCommandSubcommandBuilder()
    .setName('config')
    .setDescription('Configure bot settings for this server (admin only)')
    .addStringOption((opt) =>
      opt
        .setName('manager_roles')
        .setDescription('Role IDs or @mentions separated by commas (e.g. @Role1, @Role2)')
        .setRequired(false)
    )
    .addChannelOption((opt) =>
      opt
        .setName('mutual_channel')
        .setDescription('Default channel for Mutual Giveaways')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false)
    )
    .addChannelOption((opt) =>
      opt
        .setName('sponsor_channel')
        .setDescription('Default channel for Sponsorship Giveaways')
        .addChannelTypes(ChannelType.GuildText)
        .setRequired(false)
    );
}

/**
 * Execute the /gw config command.
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 */
async function execute(interaction) {
  /* Only server administrators can use /gw config */
  if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({
      embeds: [buildErrorEmbed("You need **Administrator** permission to configure the bot.")],
      ephemeral: true,
    });
  }

  const managerRolesRaw = interaction.options.getString('manager_roles');
  const mutualChannel = interaction.options.getChannel('mutual_channel');
  const sponsorChannel = interaction.options.getChannel('sponsor_channel');

  /* At least one option must be provided */
  if (!managerRolesRaw && !mutualChannel && !sponsorChannel) {
    return interaction.reply({
      embeds: [buildErrorEmbed('Please provide at least one option to configure.')],
      ephemeral: true,
    });
  }

  /* Parse manager roles — extract role IDs from mentions or raw IDs */
  let managerRoleIds = null;
  if (managerRolesRaw) {
    const roleIdPattern = /(\d{17,20})/g;
    const matches = managerRolesRaw.match(roleIdPattern);

    if (!matches || matches.length === 0) {
      return interaction.reply({
        embeds: [buildErrorEmbed('No valid role IDs found. Use @mentions or paste role IDs separated by commas.')],
        ephemeral: true,
      });
    }

    managerRoleIds = JSON.stringify(matches);
  }

  /* Upsert the config */
  db.upsertGuildConfig(interaction.guildId, {
    managerRoleId: managerRoleIds,
    mutualChannelId: mutualChannel?.id ?? null,
    sponsorChannelId: sponsorChannel?.id ?? null,
  });

  /* Build a confirmation embed listing what was updated */
  const fields = [];
  if (managerRoleIds) {
    const ids = JSON.parse(managerRoleIds);
    const mentions = ids.map((id) => `<@&${id}>`).join(', ');
    fields.push({ name: 'Manager Roles', value: mentions, inline: true });
  }
  if (mutualChannel) fields.push({ name: 'Mutual Channel', value: `<#${mutualChannel.id}>`, inline: true });
  if (sponsorChannel) fields.push({ name: 'Sponsor Channel', value: `<#${sponsorChannel.id}>`, inline: true });

  const embed = new EmbedBuilder()
    .setTitle('✅ Configuration Updated')
    .addFields(fields)
    .setColor(defaults.EMBED_COLOR_SUCCESS)
    .setFooter({ text: defaults.EMBED_FOOTER_TEXT })
    .setTimestamp();

  return interaction.reply({ embeds: [embed], ephemeral: true });
}

module.exports = { buildSubcommand, execute };
