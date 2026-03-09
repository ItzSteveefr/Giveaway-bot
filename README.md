# Discord Giveaway Bot

A fully-featured Discord Giveaway Management Bot built with **discord.js v14** and **SQLite**. Supports three giveaway types (Mutual, Sponsorship, Event) with per-server configuration, automated scheduling, winner selection, and DM notifications.

---

## Features

- 🤝 **Mutual Giveaways** — Partnership giveaways with another server (auto-end after N days)
- 💰 **Sponsorship Giveaways** — Sponsored giveaways with optional custom channels
- 🎉 **Event Giveaways** — In-server event giveaways with flexible channel options
- ⏰ **Automated Scheduler** — Posts and ends giveaways automatically on schedule
- 🏆 **Fair Winner Selection** — Fisher-Yates shuffle with ban-awareness
- ✉️ **Winner DMs** — Automatic DM notifications to winners
- 🛡️ **Per-Server Isolation** — Complete multi-server support with separate configurations
- 🚫 **User Banning** — Ban users from entering giveaways

---

## Tech Stack

| Package         | Purpose                          |
|-----------------|----------------------------------|
| `discord.js`    | Discord API wrapper (v14)        |
| `better-sqlite3`| SQLite database                  |
| `dotenv`        | Environment variable loading     |
| `node-cron`     | Cron-based scheduler             |
| `uuid`          | Unique ID generation             |

---

## Prerequisites

- **Node.js** v18.0 or higher
- A Discord bot application with the following enabled in the [Developer Portal](https://discord.com/developers/applications):
  - **Message Content Intent** ✅
  - **Server Members Intent** (optional)

---

## Setup

### 1. Clone the Repository

```bash
git clone <your-repo-url>
cd GiveawayBot
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Edit the `.env` file and replace the placeholder values:

```env
DISCORD_TOKEN=your_bot_token_here
CLIENT_ID=your_application_client_id_here
```

- **DISCORD_TOKEN**: Your bot token from the Discord Developer Portal → Bot → Token
- **CLIENT_ID**: Your application ID from the Developer Portal → General Information → Application ID

### 4. Replace Placeholders (Optional)

Before deployment, replace these placeholders in `config/defaults.js`:

| Placeholder              | Replace with                  |
|--------------------------|-------------------------------|
| `[BOT_NAME]`             | Your bot's display name       |
| `[BOT_DESCRIPTION]`      | Your bot's description        |
| `[SUPPORT_SERVER_INVITE]`| Your support server invite URL|

### 5. Deploy Slash Commands

Run this once (or whenever you change command definitions):

```bash
node deploy-commands.js
```

> ℹ️ Global commands can take up to **1 hour** to appear in all servers.

### 6. Start the Bot

```bash
node index.js
```

Or use the npm script:

```bash
npm start
```

---

## Bot Invite URL

Generate your invite URL from the Developer Portal or use this template:

```
https://discord.com/api/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=536890385&scope=bot%20applications.commands
```

Replace `YOUR_CLIENT_ID` with your application's Client ID.

### Required Bot Permissions

- Send Messages
- Embed Links
- Read Message History
- Add Reactions
- Manage Channels (for custom channels)
- Mention Everyone (for pings)

---

## Commands

All commands are under the `/gw` group:

| Command         | Description                                      |
|-----------------|--------------------------------------------------|
| `/gw schedule`  | Launch the multi-step giveaway creation UI       |
| `/gw list`      | Show queued, active, and recent giveaways        |
| `/gw edit`      | Edit a scheduled (queued) giveaway by ID         |
| `/gw stop`      | Stop a queued or active giveaway                 |
| `/gw reroll`    | Reroll winner(s) for an ended giveaway           |
| `/gw ban`       | Ban a user from entering giveaways               |
| `/gw config`    | Configure bot settings (admin only)              |

### First-Time Server Setup

Before using giveaway commands, an admin must run:

```
/gw config manager_role:@YourRole mutual_channel:#mutual-giveaways sponsor_channel:#sponsored
```

---

## Project Structure

```
├── index.js                  # Entry point — bot login, events, scheduler
├── deploy-commands.js        # Slash command registration script
├── database.js               # SQLite connection, schema, queries
├── scheduler.js              # Cron job for auto-posting/ending
├── .env                      # Environment variables
│
├── commands/gw/
│   ├── index.js              # /gw command group routing
│   ├── schedule.js           # /gw schedule
│   ├── list.js               # /gw list
│   ├── edit.js               # /gw edit
│   ├── stop.js               # /gw stop
│   ├── reroll.js             # /gw reroll
│   ├── ban.js                # /gw ban
│   └── config.js             # /gw config
│
├── interactions/
│   ├── _sessions.js          # In-memory session store
│   ├── modals.js             # Modal submit handlers
│   ├── selectMenus.js        # Select menu handlers
│   └── buttons.js            # Button handlers
│
├── giveaway/
│   ├── poster.js             # Posts giveaway embeds
│   ├── ender.js              # Ends giveaways, picks winners
│   ├── winner.js             # Winner selection (Fisher-Yates)
│   └── dm.js                 # Winner DM templates & sending
│
├── utils/
│   ├── embeds.js             # Reusable embed builders
│   ├── permissions.js        # Permission check helper
│   ├── channelCreator.js     # Dynamic channel creation
│   └── idGenerator.js        # GW-XXXX ID generation
│
└── config/
    └── defaults.js           # Default values & templates
```

---

## Database

The bot uses SQLite (via `better-sqlite3`) stored at `./data/bot.db` (auto-created on first run).

### Tables

- **guild_config** — Per-server settings (manager role, channels)
- **giveaways** — All giveaway records with full lifecycle tracking
- **giveaway_entries** — User entries per giveaway
- **banned_users** — Per-server giveaway bans

---

## License

ISC
