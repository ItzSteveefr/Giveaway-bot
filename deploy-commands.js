/**
 * deploy-commands.js
 * ------------------
 * One-time script to register slash commands globally via Discord's REST API.
 * Run this script whenever commands change:
 *   node deploy-commands.js
 *
 * This registers commands at the APPLICATION level (global) so they
 * appear in every server the bot is in. Global commands can take up
 * to 1 hour to propagate to all guilds.
 */

require('dotenv').config();

const { REST, Routes } = require('discord.js');
const gwCommand = require('./commands/gw/index');

/* Validate required environment variables */
if (!process.env.DISCORD_TOKEN) {
  console.error('ERROR: DISCORD_TOKEN is not set in .env');
  process.exit(1);
}
if (!process.env.CLIENT_ID) {
  console.error('ERROR: CLIENT_ID is not set in .env');
  process.exit(1);
}

/* Build the commands array */
const commands = [gwCommand.data.toJSON()];

/* Create the REST client */
const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

/* Deploy */
(async () => {
  try {
    console.log(`[Deploy] Registering ${commands.length} application command(s)...`);

    const data = await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: commands }
    );

    console.log(`[Deploy] Successfully registered ${data.length} global command(s).`);
    console.log('[Deploy] Note: Global commands may take up to 1 hour to propagate.');
  } catch (err) {
    console.error('[Deploy] Failed to register commands:', err);
    process.exit(1);
  }
})();
