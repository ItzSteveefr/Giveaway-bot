/**
 * utils/permissions.js
 * --------------------
 * Reusable permission check helper. A user is authorized to run /gw commands
 * if they have the Administrator permission OR hold ANY of the configured
 * manager roles (stored as a JSON array in the DB).
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

  /* Members with any of the configured manager roles have access */
  if (guildConfig?.managerRoleId) {
    try {
      const roleIds = JSON.parse(guildConfig.managerRoleId);
      if (Array.isArray(roleIds)) {
        return roleIds.some((roleId) => member.roles.cache.has(roleId));
      }
    } catch {
      /* Fallback: treat as a single role ID (backward compat) */
      if (member.roles.cache.has(guildConfig.managerRoleId)) return true;
    }
  }

  return false;
}

module.exports = { isAuthorized };
