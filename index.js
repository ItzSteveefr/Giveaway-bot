/**
 * index.js
 * --------
 * Entry point for the Discord Giveaway Bot.
 *
 * Startup sequence (per PRD Section 16):
 *   1. Load .env via dotenv
 *   2. Initialize SQLite database — create tables if not exists
 *   3. Create discord.js Client with required intents and partials
 *   4. Load all command files
 *   5. Register interaction handlers (commands, modals, selectMenus, buttons)
 *   6. Start the node-cron scheduler
 *   7. Login with DISCORD_TOKEN
 */

require('dotenv').config();

const {
  Client,
  GatewayIntentBits,
  Partials,
  Collection,
  Events,
} = require('discord.js');

const db = require('./database');
const { startScheduler } = require('./scheduler');
const gwCommand = require('./commands/gw/index');
const { handleModal } = require('./interactions/modals');
const { handleSelectMenu } = require('./interactions/selectMenus');
const { handleButton } = require('./interactions/buttons');

/* ══════════════════════════════════════════════════════════
 *  ASYNC STARTUP — sql.js requires async initialization
 * ══════════════════════════════════════════════════════════ */

(async () => {
  /* ── 1. Initialize Database ─────────────────────────────── */
  await db.initDatabase();

  /* ── 2. Create Discord Client ───────────────────────────── */
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildMessageReactions,
      GatewayIntentBits.DirectMessages,
    ],
    partials: [
      Partials.Message,
      Partials.Channel,
      Partials.Reaction,
    ],
  });

  /* ── 3. Load Commands ───────────────────────────────────── */
  client.commands = new Collection();
  client.commands.set(gwCommand.data.name, gwCommand);
  console.log('[Commands] Loaded /gw command group with all subcommands.');

  /* ── 4. Register Interaction Handler ────────────────────── */
  client.on(Events.InteractionCreate, async (interaction) => {
    try {
      /* ── Slash Commands ───────────────────────────────────── */
      if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (!command) {
          console.warn(`[Interaction] Unknown command: ${interaction.commandName}`);
          return;
        }
        return await command.execute(interaction);
      }

      /* ── Select Menus ─────────────────────────────────────── */
      if (interaction.isStringSelectMenu()) {
        return await handleSelectMenu(interaction);
      }

      /* ── Modals ───────────────────────────────────────────── */
      if (interaction.isModalSubmit()) {
        return await handleModal(interaction);
      }

      /* ── Buttons ──────────────────────────────────────────── */
      if (interaction.isButton()) {
        return await handleButton(interaction);
      }
    } catch (err) {
      console.error(`[Interaction] Unhandled error:`, err);

      /* Attempt to reply with an error if possible */
      const errorMsg = { content: '❌ An unexpected error occurred.', ephemeral: true };
      try {
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp(errorMsg);
        } else {
          await interaction.reply(errorMsg);
        }
      } catch {
        /* Could not even send the error — nothing else we can do */
      }
    }
  });

  /* ── 5. Reaction Add / Remove DMs ───────────────────────── */
  
  const defaults = require('./config/defaults');

  client.on(Events.MessageReactionAdd, async (reaction, user) => {
    if (user.bot) return;
    if (reaction.partial) await reaction.fetch();
    if (reaction.message.partial) await reaction.message.fetch();

    if (reaction.emoji.name !== defaults.REACTION_EMOJI) return;

    /* Check if this is an active giveaway message */
    const giveaway = db.getGiveawayByMessageId(reaction.message.id);
    if (!giveaway) return;

    /* DM the user that they entered */
    try {
      const messageLink = `https://discord.com/channels/${reaction.message.guildId}/${reaction.message.channelId}/${reaction.message.id}`;
      const dmMsg = defaults.ENTRY_DM
        .replace('{Username}', `<@${user.id}>`)
        .replace('{messageLink}', messageLink);
      
      await user.send(dmMsg);
    } catch (err) {
      console.warn(`[Reaction] Could not send entry DM to ${user.id}`);
    }
  });

  client.on(Events.MessageReactionRemove, async (reaction, user) => {
    if (user.bot) return;
    if (reaction.partial) await reaction.fetch();
    if (reaction.message.partial) await reaction.message.fetch();

    if (reaction.emoji.name !== defaults.REACTION_EMOJI) return;

    /* Check if this is an active giveaway message */
    const giveaway = db.getGiveawayByMessageId(reaction.message.id);
    if (!giveaway) return;

    /* DM the user that they left */
    try {
      const messageLink = `https://discord.com/channels/${reaction.message.guildId}/${reaction.message.channelId}/${reaction.message.id}`;
      const dmMsg = defaults.LEAVE_DM
        .replace('{Username}', `<@${user.id}>`)
        .replace('{messageLink}', messageLink);
      
      await user.send(dmMsg);
    } catch (err) {
      console.warn(`[Reaction] Could not send leave DM to ${user.id}`);
    }
  });

  /* ── 6. Bot Ready Event ─────────────────────────────────── */
  client.once(Events.ClientReady, (readyClient) => {
    console.log(`[Bot] Ready! Logged in as ${readyClient.user.tag}`);
    console.log(`[Bot] Serving ${readyClient.guilds.cache.size} guild(s).`);

    /* ── 7. Start the scheduler ─────────────────────────────── */
    startScheduler(client);
  });

  /* ── 7. Login ───────────────────────────────────────────── */
  await client.login(process.env.DISCORD_TOKEN);
})();
