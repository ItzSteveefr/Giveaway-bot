/**
 * commands/gw/index.js
 * --------------------
 * /gw command group entry point.
 * Defines the top-level SlashCommand with all subcommands and routes
 * incoming interactions to the correct subcommand handler.
 */

const { SlashCommandBuilder } = require('discord.js');

/* Import all subcommand modules */
const schedule = require('./schedule');
const list = require('./list');
const edit = require('./edit');
const stop = require('./stop');
const reroll = require('./reroll');
const ban = require('./ban');
const config = require('./config');

/* ── Build the /gw command with all subcommands ──────────── */
const command = new SlashCommandBuilder()
  .setName('gw')
  .setDescription('Giveaway management commands')
  .addSubcommand(schedule.buildSubcommand())
  .addSubcommand(list.buildSubcommand())
  .addSubcommand(edit.buildSubcommand())
  .addSubcommand(stop.buildSubcommand())
  .addSubcommand(reroll.buildSubcommand())
  .addSubcommand(ban.buildSubcommand())
  .addSubcommand(config.buildSubcommand());

/* ── Route subcommand execution ──────────────────────────── */

/**
 * Map subcommand names to their execute functions.
 */
const subcommandHandlers = {
  schedule: schedule.execute,
  list: list.execute,
  edit: edit.execute,
  stop: stop.execute,
  reroll: reroll.execute,
  ban: ban.execute,
  config: config.execute,
};

/**
 * Handle an incoming /gw interaction by routing to the correct subcommand.
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 */
async function execute(interaction) {
  const subcommand = interaction.options.getSubcommand();
  const handler = subcommandHandlers[subcommand];

  if (!handler) {
    return interaction.reply({
      content: `Unknown subcommand: ${subcommand}`,
      ephemeral: true,
    });
  }

  await handler(interaction);
}

module.exports = {
  data: command,
  execute,
};
