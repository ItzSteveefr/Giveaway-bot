/**
 * utils/permissions.js
 * --------------------
 * Reusable permission check helper. A user is authorized to run /gw commands
 * if they have the Administrator permission OR hold the configured manager role.
 */

const { PermissionFlagsBits } = require('discord.js');

/**
 * Check whether a guild member is authorized to use /gw commands.
 *
 * @param {import('discord.js').GuildMember} member — The guild member to check
 * @param {object|null} guildConfig — Row from guild_config table (may be null)
 * @returns {boolean} true if the member is authorized
 */
function isAuthorized(member, guildConfig) {
  /* Server administrators always have access */
  if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;

  /* Members with the configured manager role have access */
  if (guildConfig?.managerRoleId && member.roles.cache.has(guildConfig.managerRoleId)) return true;

  return false;
}

module.exports = { isAuthorized };
