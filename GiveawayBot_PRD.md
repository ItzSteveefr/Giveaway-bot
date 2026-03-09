# 📄 Product Requirements Document — Discord Giveaway Bot

**Document Version:** 1.0  
**Stack:** JavaScript (Node.js) · discord.js v14 · SQLite (better-sqlite3)  
**Bot Name:** `[BOT_NAME]` *(placeholder — replace before deployment)*  
**Bot Description:** `[BOT_DESCRIPTION]` *(placeholder — replace before deployment)*  
**Support Server Invite:** `[SUPPORT_SERVER_INVITE]` *(placeholder — replace before deployment)*  
**Embed Brand Color (Primary):** `#FFD700` (Gold)  
**Embed Brand Color (Secondary/Background accent):** `#1a1a1a` (Minimal Black)

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Tech Stack & Dependencies](#2-tech-stack--dependencies)
3. [Project Structure](#3-project-structure)
4. [Database Schema](#4-database-schema)
5. [Configuration System (Per-Guild)](#5-configuration-system-per-guild)
6. [Permission System](#6-permission-system)
7. [Giveaway Types — Full Specification](#7-giveaway-types--full-specification)
8. [Command Reference](#8-command-reference)
9. [UI Flows — Step-by-Step](#9-ui-flows--step-by-step)
10. [Scheduler — Automated Posting & Ending](#10-scheduler--automated-posting--ending)
11. [Embed Designs](#11-embed-designs)
12. [DM Message Templates](#12-dm-message-templates)
13. [Winner Selection Logic](#13-winner-selection-logic)
14. [Error Handling & Edge Cases](#14-error-handling--edge-cases)
15. [Multi-Server Support](#15-multi-server-support)
16. [Bot Startup & Initialization](#16-bot-startup--initialization)
17. [Environment Variables](#17-environment-variables)

---

## 1. Project Overview

This is a fully-featured Discord Giveaway Management Bot built with **discord.js v14** and **SQLite**. It is designed to operate across an unlimited number of Discord servers simultaneously, with per-server configuration and isolation.

The bot enables authorized users (server admins and configurable role holders) to schedule, manage, edit, stop, and reroll giveaways across three distinct types: **Mutual Giveaways**, **Sponsorship Giveaways**, and **Event Giveaways**.

Each giveaway type has its own flow, embed format, channel behavior, winner DM messaging, and scheduling logic. The entire setup is driven through Discord's native UI components: slash commands, modals, select menus, and button interactions — requiring zero external dashboard.

---

## 2. Tech Stack & Dependencies

### Runtime
- **Node.js** v18+ (LTS recommended)
- **JavaScript** (ESModules or CommonJS — CommonJS preferred for SQLite compatibility)

### Core Libraries

| Package | Version | Purpose |
|---|---|---|
| `discord.js` | `^14.x` | Discord API wrapper — slash commands, UI components, REST |
| `better-sqlite3` | `^9.x` | SQLite3 bindings — synchronous, fast, no callback hell |
| `dotenv` | `^16.x` | Environment variable loading |
| `node-cron` | `^3.x` | Cron-based scheduler for checking pending giveaways every minute |
| `uuid` | `^9.x` | Generating unique Giveaway IDs |

### Install Command
```bash
npm install discord.js better-sqlite3 dotenv node-cron uuid
```

### Discord.js v14 — Key Concepts Used
- `SlashCommandBuilder` + `SlashCommandSubcommandBuilder` for `/gw` command group
- `ModalBuilder` + `TextInputBuilder` for multi-step form UIs
- `ActionRowBuilder` + `StringSelectMenuBuilder` for dropdown menus
- `ButtonBuilder` + `ButtonStyle` for interactive buttons
- `EmbedBuilder` for all giveaway and response embeds
- `PermissionFlagsBits` for admin checks
- `ChatInputCommandInteraction`, `ModalSubmitInteraction`, `StringSelectMenuInteraction`, `ButtonInteraction` for interaction handling
- `Guild.channels.create()` for dynamic channel creation
- `User.send()` for DMs

---

## 3. Project Structure

```
/
├── index.js                  # Entry point — bot login, event registration, scheduler init
├── deploy-commands.js        # One-time script to register slash commands globally or per-guild
├── .env                      # Environment variables (never commit)
├── database.js               # SQLite connection, table init, all DB query functions
├── scheduler.js              # node-cron job — checks for giveaways to post or end
│
├── /commands
│   └── gw/
│       ├── index.js          # /gw command group entry — routes subcommands
│       ├── schedule.js       # /gw schedule — multi-step giveaway creation
│       ├── list.js           # /gw list — shows queued and recent giveaways
│       ├── edit.js           # /gw edit — edit a scheduled giveaway by ID
│       ├── stop.js           # /gw stop — stop a scheduled or active giveaway
│       ├── reroll.js         # /gw reroll — reroll winner(s) for an ended giveaway
│       └── ban.js            # /gw ban — ban user from entering giveaways
│
├── /interactions
│   ├── modals.js             # Handles all ModalSubmitInteraction events
│   ├── selectMenus.js        # Handles all StringSelectMenuInteraction events
│   └── buttons.js            # Handles all ButtonInteraction events
│
├── /giveaway
│   ├── poster.js             # Posts a giveaway embed to the correct channel
│   ├── ender.js              # Ends a giveaway: picks winners, edits embed, DMs winners
│   ├── winner.js             # Winner selection logic (random, ban-aware)
│   └── dm.js                 # DM message formatting and sending
│
├── /utils
│   ├── embeds.js             # Reusable embed builders
│   ├── permissions.js        # Permission check helper
│   ├── channelCreator.js     # Creates new channels in a given category
│   └── idGenerator.js        # Generates short readable giveaway IDs
│
└── /config
    └── defaults.js           # Default values (embed colors, default messages, etc.)
```

---

## 4. Database Schema

All tables use `guildId` as a foreign key to ensure complete multi-server isolation. The database file is `./data/bot.db` (auto-created on startup).

### Table: `guild_config`

Stores per-guild settings. One row per guild.

```sql
CREATE TABLE IF NOT EXISTS guild_config (
  guildId           TEXT PRIMARY KEY,
  managerRoleId     TEXT,             -- Role ID allowed to run /gw commands
  mutualChannelId   TEXT,             -- Pre-set channel for Mutual Giveaways
  sponsorChannelId  TEXT,             -- Pre-set channel for Sponsorship Giveaways (no custom channel)
  createdAt         INTEGER DEFAULT (strftime('%s','now'))
);
```

### Table: `giveaways`

One row per giveaway, across all guilds.

```sql
CREATE TABLE IF NOT EXISTS giveaways (
  id                TEXT PRIMARY KEY,      -- Short unique ID e.g. "GW-A3F9"
  guildId           TEXT NOT NULL,
  type              TEXT NOT NULL,         -- 'mutual' | 'sponsorship' | 'event'
  prize             TEXT NOT NULL,
  winners           INTEGER NOT NULL,      -- Number of winners
  serverLink        TEXT,                  -- Server link (optional for event)
  ping              TEXT,                  -- Ping role/everyone/here (as string e.g. "@everyone")
  postAt            INTEGER NOT NULL,      -- Unix timestamp (seconds) when to post
  channelId         TEXT,                  -- Target channel ID (resolved at creation)
  categoryId        TEXT,                  -- Category ID if custom channel was created
  customChannelName TEXT,                  -- Channel name if created dynamically
  messageId         TEXT,                  -- Discord message ID after posting
  status            TEXT DEFAULT 'queued', -- 'queued' | 'active' | 'ended' | 'stopped'
  winnerIds         TEXT,                  -- JSON array of winner user IDs e.g. '["123","456"]'
  createdBy         TEXT NOT NULL,         -- User ID who created this giveaway
  createdAt         INTEGER DEFAULT (strftime('%s','now')),
  postedAt          INTEGER,               -- Unix timestamp when actually posted
  endedAt           INTEGER                -- Unix timestamp when ended/stopped
);
```

### Table: `giveaway_entries`

Tracks who has reacted/entered each giveaway. Populated when giveaway ends by fetching reaction users from the message.

```sql
CREATE TABLE IF NOT EXISTS giveaway_entries (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  giveawayId  TEXT NOT NULL,
  userId      TEXT NOT NULL,
  guildId     TEXT NOT NULL,
  enteredAt   INTEGER DEFAULT (strftime('%s','now')),
  UNIQUE(giveawayId, userId)
);
```

### Table: `banned_users`

Users banned from entering giveaways in a specific guild.

```sql
CREATE TABLE IF NOT EXISTS banned_users (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  guildId     TEXT NOT NULL,
  userId      TEXT NOT NULL,
  bannedBy    TEXT NOT NULL,
  reason      TEXT,
  bannedAt    INTEGER DEFAULT (strftime('%s','now')),
  UNIQUE(guildId, userId)
);
```

---

## 5. Configuration System (Per-Guild)

Before using any `/gw` commands, a server admin must configure the bot. Configuration is done via `/gw config` (add this subcommand).

### `/gw config` subcommand (add to the `/gw` group)

This command takes the following options:

| Option | Type | Description |
|---|---|---|
| `manager_role` | Role | The role that can run `/gw` commands (alongside admins) |
| `mutual_channel` | Channel | Default channel for Mutual Giveaways |
| `sponsor_channel` | Channel | Default channel for Sponsorship Giveaways (when no custom channel) |

The bot upserts these values into `guild_config` for the current guild.

---

## 6. Permission System

A user is **authorized** to use `/gw` commands if either of these is true:

1. They have the `Administrator` Discord permission (`PermissionFlagsBits.Administrator`)
2. They have the role stored in `guild_config.managerRoleId` for the current guild

This check is implemented as a reusable async helper in `/utils/permissions.js`:

```js
// utils/permissions.js
function isAuthorized(member, guildConfig) {
  if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;
  if (guildConfig?.managerRoleId && member.roles.cache.has(guildConfig.managerRoleId)) return true;
  return false;
}
```

If a non-authorized user invokes any `/gw` command, the bot replies with an ephemeral embed:

> ❌ **You don't have permission to use this command.**

---

## 7. Giveaway Types — Full Specification

### 7.1 Mutual Giveaway

A giveaway posted in partnership with another server (mutual promotion).

**Required fields collected from user:**
- Unix timestamp (when to post)
- Prize
- Number of winners
- Server link
- Ping (role mention string, `@everyone`, `@here`, or `none`)
- Days *(duration in days — used to calculate the end time from the post time)*

**Channel behavior:** Always posts to `guild_config.mutualChannelId`. No custom channel allowed.

**Outside message:** A default plaintext/plain embed message is always posted **above** the giveaway embed every time a Mutual Giveaway is sent. This message is hardcoded (configurable in `config/defaults.js`):

```
🤝 **Mutual Giveaway!** React with 🎉 to enter!
```
*(Exact text configurable — see Section 11)*

**End time:** Calculated as `postAt + (days * 86400)` seconds.

**DM on win:** Uses the Mutual Giveaway DM template (Section 12.1).

---

### 7.2 Sponsorship Giveaway

A giveaway sponsored by another server or entity.

**Required fields:**
- Prize
- Number of winners
- Server link
- Unix timestamp (when to post)
- Ping

**Channel behavior (two options presented after filling fields):**
- **No custom channel** → Posts to `guild_config.sponsorChannelId`
- **Custom channel** → Prompts for:
  - Discord Category (select from list of server categories)
  - Channel name (text input, emojis allowed)
  - Bot creates the channel in the selected category and posts there

**End time:** Sponsorship giveaways do not have a `days` field. They are ended manually via `/gw stop` or have no automatic end. *(If you want auto-end, a duration field should be added — not currently specified.)*

**DM on win:** Uses the Sponsorship DM template (Section 12.2).

---

### 7.3 Event Giveaway

An in-server event giveaway.

**Required fields:**
- Prize
- Number of winners
- Links *(optional — could be a rules doc, form, etc.)*
- Unix timestamp (when to post)
- Channel *(always asks for channel — either custom-created or existing)*

**Channel behavior:**
- User is always asked to specify a channel
- Options: **Custom channel** (create new) or **Existing channel** (select from list)
- If custom channel: prompts for Category and channel name (emojis allowed)

**End time:** Event giveaways are ended manually via `/gw stop` unless a duration is specified. *(Duration field not currently specified — end manually.)*

**DM on win:** Uses the Event DM template (Section 12.3).

---

## 8. Command Reference

All commands are grouped under the `/gw` slash command. The full command group is registered globally (works across all servers the bot is in).

### Command Group: `/gw`

| Subcommand | Description |
|---|---|
| `/gw schedule` | Launch the multi-step giveaway creation UI |
| `/gw list` | Show all queued and recently ended giveaways for this server |
| `/gw edit` | Edit a scheduled giveaway by ID |
| `/gw stop` | Stop a queued or active giveaway by ID |
| `/gw reroll` | Reroll winner(s) for an ended giveaway |
| `/gw ban` | Ban a user from entering giveaways in this server |
| `/gw config` | Configure bot settings for this server (admin only) |

---

### `/gw schedule`

Triggers a multi-step UI flow (see Section 9 for full step-by-step). No command options — everything is collected through UI components.

**Permission required:** Authorized user (admin or manager role)

---

### `/gw list`

Shows an embed with two sections:
1. **Queued / Active Giveaways** — status is `queued` or `active`
2. **Recent Giveaways** — status is `ended` or `stopped`, limited to last 10

Each entry in the list shows:
- Giveaway ID
- Type (Mutual / Sponsorship / Event)
- Prize
- Status
- Post time (formatted from Unix timestamp)
- Channel

**Interaction:** Ephemeral reply with paginated embeds if there are more than 10 total.

---

### `/gw edit`

Options:
- `id` (String, required) — The giveaway ID (e.g. `GW-A3F9`)

After providing the ID, a select menu appears with the editable fields:
- Prize
- Number of winners
- Timestamp (post time)
- Link

Selecting a field opens a Modal with the current value pre-filled, prompting the user to change it.

**Constraints:**
- Can only edit giveaways with status `queued`
- Cannot edit `active` or `ended` giveaways

---

### `/gw stop`

Options:
- `id` (String, required) — The giveaway ID

**Behavior:**
- If status is `queued`: Cancels the giveaway before it posts. Updates status to `stopped`.
- If status is `active`: Force-ends the giveaway. Picks winner(s) immediately from current reactions, edits the embed to show winners, DMs winner(s), updates status to `stopped`.
- If status is `ended` or `stopped`: Replies with an ephemeral error embed.

---

### `/gw reroll`

Options:
- `id` (String, required) — The giveaway ID

**Behavior:**
- Only works on giveaways with status `ended` or `stopped` (that had winners)
- Re-runs winner selection from the original entry pool (excluding previously selected winners, or including them — see Section 13)
- DMs new winner(s)
- Updates `winnerIds` in the database
- Edits the original embed to show new winners

---

### `/gw ban`

Options:
- `user` (User, required) — The user to ban
- `reason` (String, optional) — Reason for the ban

**Behavior:**
- Inserts into `banned_users` table for the current guild
- Banned users' reactions are ignored during winner selection
- Reply with a confirmation embed (ephemeral)
- If user is already banned, replies with an error

---

## 9. UI Flows — Step-by-Step

### 9.1 `/gw schedule` — Full Flow

---

#### Step 1: Type Selection

**Trigger:** User runs `/gw schedule`

**Bot sends:** An ephemeral message with a `StringSelectMenu` containing three options:

```
Select Giveaway Type
────────────────────
🤝  Mutual Giveaway
💰  Sponsorship
🎉  Event
```

Custom IDs: `gw_type_select`

---

#### Step 2A: Mutual Giveaway — Modal

**Trigger:** User selects `Mutual Giveaway`

**Bot opens a Modal** titled `🤝 Mutual Giveaway Setup` with these `TextInput` fields:

| Field Label | Style | Placeholder | Required |
|---|---|---|---|
| Prize | Short | e.g. Nitro Classic | ✅ |
| Number of Winners | Short | e.g. 3 | ✅ |
| Server Link | Short | https://discord.gg/... | ✅ |
| Ping | Short | @everyone / @here / none | ✅ |
| Post Timestamp (Unix) | Short | e.g. 1720000000 | ✅ |
| Duration (Days) | Short | e.g. 7 | ✅ |

Modal Custom ID: `gw_modal_mutual`

On submit → validate all fields → insert into `giveaways` table with status `queued` → reply ephemeral success embed with the generated Giveaway ID.

---

#### Step 2B: Sponsorship — Modal

**Trigger:** User selects `Sponsorship`

**Bot opens a Modal** titled `💰 Sponsorship Giveaway Setup`:

| Field Label | Style | Placeholder | Required |
|---|---|---|---|
| Prize | Short | e.g. $50 Steam Gift Card | ✅ |
| Number of Winners | Short | e.g. 1 | ✅ |
| Server Link | Short | https://discord.gg/... | ✅ |
| Ping | Short | @everyone / @here / none | ✅ |
| Post Timestamp (Unix) | Short | e.g. 1720000000 | ✅ |

Modal Custom ID: `gw_modal_sponsorship`

**After modal submit → Step 2B-2: Channel Selection**

**Bot edits/sends** an ephemeral message with a `StringSelectMenu`:

```
Where should this giveaway be posted?
──────────────────────────────────────
📌  No Custom Channel (use preset channel)
📁  Custom Channel (create new)
```

Custom ID: `gw_sponsor_channel_select`

If **No Custom Channel** selected: Resolve `guild_config.sponsorChannelId` as the target. Save and confirm.

If **Custom Channel** selected → Step 2B-3:

**Bot sends** a `StringSelectMenu` listing all categories in the guild (fetched via `guild.channels.cache.filter(c => c.type === ChannelType.GuildCategory)`).

Custom ID: `gw_sponsor_category_select`

After category selected → Bot opens a Modal:

| Field Label | Style | Placeholder | Required |
|---|---|---|---|
| Channel Name | Short | e.g. 💰〡sponsored-giveaway | ✅ |

Modal Custom ID: `gw_modal_sponsor_channelname`

On submit → create the channel in that category → set as `channelId` → save giveaway → confirm.

---

#### Step 2C: Event — Modal

**Trigger:** User selects `Event`

**Bot opens a Modal** titled `🎉 Event Giveaway Setup`:

| Field Label | Style | Placeholder | Required |
|---|---|---|---|
| Prize | Short | e.g. Custom Role | ✅ |
| Number of Winners | Short | e.g. 2 | ✅ |
| Links | Short | Optional link(s) | ❌ |
| Post Timestamp (Unix) | Short | e.g. 1720000000 | ✅ |

Modal Custom ID: `gw_modal_event`

**After modal submit → Step 2C-2: Channel Selection**

**Bot sends** `StringSelectMenu`:

```
Select Channel Type
───────────────────
📌  Use Existing Channel
📁  Create Custom Channel
```

Custom ID: `gw_event_channel_type_select`

If **Use Existing Channel**: Bot sends a `StringSelectMenu` listing all text channels in the guild.

Custom ID: `gw_event_channel_existing_select`

If **Create Custom Channel**: Bot sends category `StringSelectMenu`, then modal for channel name (same as Sponsorship flow).

On completion → save giveaway → confirm with ephemeral success embed.

---

### 9.2 Interaction State Management

Because Discord modals cannot carry arbitrary state, the bot must persist in-progress setup state between interaction steps. Use an **in-memory Map** keyed by `userId` (or `userId_guildId`) to store the partial giveaway data across steps.

```js
// In-memory session store
const sessions = new Map();
// Key: `${userId}_${guildId}`
// Value: { type, prize, winners, serverLink, ping, postAt, days, categoryId, ... }
```

Sessions are cleared after the giveaway is saved or if the user doesn't complete setup within 10 minutes (use a timeout).

---

## 10. Scheduler — Automated Posting & Ending

The scheduler runs every **60 seconds** using `node-cron`.

### Cron Job Logic

```
Every 60 seconds:
  1. Query all giveaways WHERE status = 'queued' AND postAt <= now()
     → For each: call poster.js → post the embed → update status to 'active', set postedAt, set messageId

  2. Query all giveaways WHERE status = 'active' AND endAt <= now()
     → For each: call ender.js → fetch reaction users → pick winners → edit embed → DM winners → update status to 'ended'
```

### `endAt` field

The `giveaways` table needs an `endAt` column (Unix seconds):

```sql
endAt INTEGER  -- Calculated: postAt + (days * 86400) for Mutual; NULL for others (manual end)
```

Add this to the schema.

### Error Handling in Scheduler

If a guild has been kicked from the bot, or a channel has been deleted, catch the error gracefully, log it, and mark the giveaway as `stopped` with a note in a `notes` column (add `notes TEXT` to schema).

---

## 11. Embed Designs

All embeds use:
- **Color:** `#FFD700` (Gold)
- **Footer:** `[BOT_NAME] • Giveaway ID: GW-XXXX`
- **Timestamp:** Discord embed timestamp (set to `new Date()` at post time)

---

### 11.1 Active Giveaway Embed (all types)

```
┌─────────────────────────────────────┐
│  🎉 GIVEAWAY — [TYPE]               │  ← title
│─────────────────────────────────────│
│  🏆 Prize       [prize]             │
│  👥 Winners     [n] winner(s)       │
│  🔗 Server      [link or N/A]       │
│  ⏰ Ends        <t:UNIX:R>          │  ← Discord relative timestamp
│─────────────────────────────────────│
│  React with 🎉 to enter!            │
│─────────────────────────────────────│
│  Footer: [BOT_NAME] • GW-XXXX       │
└─────────────────────────────────────┘
```

For **Event Giveaways** with a link field, show `🔗 Links` row. If no link, omit the row.

---

### 11.2 Ended Giveaway Embed

Same as active, but:
- Title changes to: `🎊 GIVEAWAY ENDED — [TYPE]`
- Add new field: `🥇 Winner(s)` → lists winner(s) as `<@userId>` mentions
- Remove the "React with 🎉 to enter!" line
- Embed color changes to `#888888` (grey) to indicate ended state

---

### 11.3 Outside Message (Mutual Giveaway Only)

Posted as a **plain message** (not inside the embed) directly before the giveaway embed:

```
🤝 **Mutual Giveaway Alert!**
[ping]
A new mutual giveaway is live! React with 🎉 below to enter and win **[prize]**!
```

This string is defined in `config/defaults.js` as `MUTUAL_OUTSIDE_MESSAGE` and uses template substitution for `[ping]` and `[prize]`.

---

### 11.4 Success Confirmation Embed (Ephemeral)

Shown to the user after successfully creating a giveaway:

```
✅ Giveaway Scheduled
─────────────────────
ID:       GW-XXXX
Type:     Mutual Giveaway
Prize:    [prize]
Winners:  [n]
Posts at: <t:UNIX:F>
Channel:  #channel-name
```

---

### 11.5 `/gw list` Embed

```
📋 Giveaways — [Server Name]
─────────────────────────────────
QUEUED / ACTIVE
• GW-A3F9 | Mutual | Nitro Classic | Posts <t:UNIX:R> | #giveaways
• GW-B1C2 | Sponsorship | $50 Steam Card | Active | #sponsored

RECENT (Last 10 Ended)
• GW-Z9X8 | Event | Custom Role | Ended | Winners: @user1
• ...
```

---

## 12. DM Message Templates

DMs are sent using `user.send({ content: message })`. If the DM fails (user has DMs closed), log the failure and note it in the embed or console — do **not** crash.

The `{Username}` placeholder is replaced with `<@userId>` (Discord mention) or the user's display name. The `{prize}` placeholder is replaced with the giveaway's prize string.

---

### 12.1 Mutual Giveaway Win DM

```
## Congratulations 🎉
{Username}, you've won a giveaway of prize **{prize}** from a mutual giveaway.
1. Open a ticket in their server
2. Show them the proof of you winning the giveaway
3. Claim your prize
-# If they refuse to pay you the prize even after you followed all the rules — open an investigation ticket in our support server.
```

Support server link appended: `[SUPPORT_SERVER_INVITE]`

---

### 12.2 Sponsorship Win DM

```
## Congratulations 🎉
{Username}, you've won a giveaway of prize **{prize}** from a sponsored giveaway.
1. Open a ticket in their server
2. Show them the proof of you winning the giveaway
3. Claim your prize
-# If they refuse to pay you the prize even after you followed all the rules — open an investigation ticket in our support server.
```

Support server link appended: `[SUPPORT_SERVER_INVITE]`

---

### 12.3 Event Win DM

```
## Congratulations 🎉
{Username}, you've won a giveaway of prize **{prize}** from an event.
1. Make sure you followed all the rules
2. Open a ticket in our support server
3. Claim your prize
```

Support server link appended: `[SUPPORT_SERVER_INVITE]`

---

### 12.4 DM Sending Function

```js
// giveaway/dm.js
async function dmWinners(winners, giveaway, client) {
  const template = getDMTemplate(giveaway.type); // returns correct template string
  for (const userId of winners) {
    try {
      const user = await client.users.fetch(userId);
      const msg = template
        .replace('{Username}', `<@${userId}>`)
        .replace('{prize}', giveaway.prize)
        + `\n\n**Support Server:** [SUPPORT_SERVER_INVITE]`;
      await user.send(msg);
    } catch (err) {
      console.warn(`Could not DM user ${userId}: ${err.message}`);
    }
  }
}
```

---

## 13. Winner Selection Logic

Winner selection happens in `giveaway/winner.js`.

### Process

1. Fetch the giveaway message from Discord using `channel.messages.fetch(messageId)`
2. Fetch all users who reacted with 🎉 using `message.reactions.resolve('🎉').users.fetch()`
3. Filter out:
   - The bot itself (`user.bot === true`)
   - Users in `banned_users` table for this guild
4. Randomly shuffle the remaining users (Fisher-Yates shuffle)
5. Select the first `n` users where `n = giveaway.winners`
6. If fewer eligible users than `n`: select all eligible users, note in embed "Only X winners could be selected"

### Reroll Logic (`/gw reroll`)

- Fetch the same reaction pool
- Remove previously selected winners from the pool
- Re-run random selection for `n` new winners
- If pool is exhausted (all users already won), reply with ephemeral error

---

## 14. Error Handling & Edge Cases

| Scenario | Behavior |
|---|---|
| User has DMs closed | Log error, continue — do not crash or stop giveaway end process |
| Channel deleted before giveaway posts | Mark giveaway as `stopped`, log error |
| Guild config not set (no channels configured) | Reply with ephemeral embed: "⚠️ This server has not been configured yet. Run `/gw config` first." |
| Invalid Unix timestamp (in the past) | Reject in modal validation, reply ephemeral: "❌ Timestamp must be in the future." |
| Non-integer winners count | Reject in modal validation, reply ephemeral: "❌ Winners must be a whole number." |
| No reactions on giveaway at end time | Post in channel: "❌ No valid entries found for this giveaway." — mark as ended |
| Giveaway ID not found | Reply ephemeral: "❌ No giveaway found with that ID in this server." |
| Bot missing channel permissions | Catch `DiscordAPIError[50013]`, notify the command user ephemerally |
| Scheduler error on individual giveaway | Catch, log, skip that entry — don't halt the cron job |

---

## 15. Multi-Server Support

The bot is designed for unlimited servers from day one.

### Key Principles

- Every database query includes `guildId` as a filter — data is never leaked between servers
- Guild config is stored per-guild in `guild_config`
- The bot registers all slash commands **globally** (using `REST.put(Routes.applicationCommands(clientId))`) so they appear in every server
- The bot's `GatewayIntentBits` must include: `Guilds`, `GuildMessages`, `MessageContent`, `GuildMessageReactions`, `DirectMessages`
- `Partials` must include: `Message`, `Channel`, `Reaction` — required for reaction events on older messages

### Privileged Intents

In the Discord Developer Portal, enable:
- **Message Content Intent** (required to read reaction users on older messages)
- **Server Members Intent** (optional — only if you want to look up member data)

---

## 16. Bot Startup & Initialization

### `index.js` startup sequence:

1. Load `.env` via `dotenv.config()`
2. Initialize SQLite database (`database.js`) — creates all tables if they don't exist
3. Create `discord.js` Client with required intents and partials
4. Load all command files from `/commands/`
5. Register interaction handlers (commands, modals, selectMenus, buttons)
6. Start the `node-cron` scheduler (`scheduler.js`)
7. Log in with `client.login(process.env.DISCORD_TOKEN)`

### `deploy-commands.js`

A separate script (run once, or whenever commands change) that uses Discord's REST API to register all slash commands globally:

```js
const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
await rest.put(
  Routes.applicationCommands(process.env.CLIENT_ID),
  { body: commands }
);
```

---

## 17. Environment Variables

File: `.env` (never commit to version control)

```env
DISCORD_TOKEN=your_bot_token_here
CLIENT_ID=your_application_client_id_here
```

### Required Discord Bot Settings (Developer Portal)

- **Bot Token:** Used in `DISCORD_TOKEN`
- **Application ID:** Used in `CLIENT_ID`
- **Scopes for invite URL:** `bot` + `applications.commands`
- **Bot Permissions for invite URL:** `Send Messages`, `Embed Links`, `Read Message History`, `Add Reactions`, `Manage Channels` (for creating custom channels), `Mention Everyone` (for ping functionality)
- **Privileged Gateway Intents:** Message Content Intent ✅

---

## Appendix A — Giveaway ID Format

IDs are generated as `GW-` followed by 4 uppercase alphanumeric characters, e.g. `GW-A3F9`.

```js
// utils/idGenerator.js
function generateGiveawayId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let id = 'GW-';
  for (let i = 0; i < 4; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}
```

Check for collision against existing IDs in the database before inserting.

---

## Appendix B — Default Config Values (`config/defaults.js`)

```js
module.exports = {
  EMBED_COLOR_ACTIVE: '#FFD700',      // Gold
  EMBED_COLOR_ENDED: '#888888',       // Grey
  EMBED_COLOR_ERROR: '#FF4444',       // Red
  EMBED_COLOR_SUCCESS: '#44FF88',     // Green
  EMBED_FOOTER_TEXT: '[BOT_NAME]',    // Replace with actual bot name
  SUPPORT_SERVER: '[SUPPORT_SERVER_INVITE]', // Replace with actual link
  MUTUAL_OUTSIDE_MESSAGE: `🤝 **Mutual Giveaway Alert!**\n{ping}\nA new mutual giveaway is live! React with 🎉 below to enter and win **{prize}**!`,
  SESSION_TIMEOUT_MS: 10 * 60 * 1000, // 10 minutes
};
```

---

## Appendix C — Discord.js v14 Interaction Routing Pattern

All interactions funnel through `client.on('interactionCreate', handler)`. Route them by type and custom ID prefix:

```js
client.on('interactionCreate', async (interaction) => {
  if (interaction.isChatInputCommand()) {
    // Route to /commands/gw/index.js → subcommand handler
  }
  if (interaction.isStringSelectMenu()) {
    // Route to /interactions/selectMenus.js by customId
  }
  if (interaction.isModalSubmit()) {
    // Route to /interactions/modals.js by customId
  }
  if (interaction.isButton()) {
    // Route to /interactions/buttons.js by customId
  }
});
```

Use a **prefix-based routing convention** for custom IDs:

| Prefix | Usage |
|---|---|
| `gw_type_select` | Type selection menu |
| `gw_modal_mutual` | Mutual giveaway modal |
| `gw_modal_sponsorship` | Sponsorship giveaway modal |
| `gw_modal_event` | Event giveaway modal |
| `gw_sponsor_channel_select` | Sponsorship channel type select |
| `gw_sponsor_category_select` | Sponsorship category select |
| `gw_modal_sponsor_channelname` | Sponsorship custom channel name modal |
| `gw_event_channel_type_select` | Event channel type select |
| `gw_event_channel_existing_select` | Event existing channel select |
| `gw_event_category_select` | Event category select |
| `gw_modal_event_channelname` | Event custom channel name modal |
| `gw_edit_field_select` | Edit field selection menu |
| `gw_modal_edit_[field]` | Edit field modal (e.g. `gw_modal_edit_prize`) |

---

*End of PRD — GiveawayBot v1.0*
