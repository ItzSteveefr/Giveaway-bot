/**
 * commands/gw/config.js
 * ---------------------
 * /gw config — Configure bot settings for this server.
 * Admin-only. Sets the manager role, mutual channel, and sponsor channel.
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
    .addRoleOption((opt) =>
      opt.setName('manager_role').setDescription('The role that can run /gw commands').setRequired(false)
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

  const managerRole = interaction.options.getRole('manager_role');
  const mutualChannel = interaction.options.getChannel('mutual_channel');
  const sponsorChannel = interaction.options.getChannel('sponsor_channel');

  /* At least one option must be provided */
  if (!managerRole && !mutualChannel && !sponsorChannel) {
    return interaction.reply({
      embeds: [buildErrorEmbed('Please provide at least one option to configure.')],
      ephemeral: true,
    });
  }

  /* Upsert the config */
  db.upsertGuildConfig(interaction.guildId, {
    managerRoleId: managerRole?.id ?? null,
    mutualChannelId: mutualChannel?.id ?? null,
    sponsorChannelId: sponsorChannel?.id ?? null,
  });

  /* Build a confirmation embed listing what was updated */
  const fields = [];
  if (managerRole) fields.push({ name: 'Manager Role', value: `<@&${managerRole.id}>`, inline: true });
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
