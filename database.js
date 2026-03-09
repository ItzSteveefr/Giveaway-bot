/**
 * database.js
 * -----------
 * SQLite database connection, table initialization, and all query functions.
 * Uses sql.js (WASM-based SQLite) â€” requires NO native compilation or C++ tools.
 * The database file is stored at ./data/bot.db and is auto-created on first run.
 */

const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

/* â”€â”€ Database path â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
const DATA_DIR = path.join(__dirname, 'data');
const DB_PATH = path.join(DATA_DIR, 'bot.db');

/* Module-level database instance (set during init) */
let db = null;

/**
 * Save the current database state to disk.
 * Called after every write operation to ensure durability.
 */
function save() {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(DB_PATH, buffer);
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
 *  INITIALIZATION
 * â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

/**
 * Initialize the database. Must be called (and awaited) before any
 * query functions are used. Creates the data directory and all tables
 * if they don't already exist.
 */
async function initDatabase() {
  const SQL = await initSqlJs();

  /* Ensure the data directory exists */
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  /* Load existing database or create a new one */
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  /* Create all tables */
  db.run(`
    CREATE TABLE IF NOT EXISTS guild_config (
      guildId           TEXT PRIMARY KEY,
      managerRoleId     TEXT,
      mutualChannelId   TEXT,
      sponsorChannelId  TEXT,
      createdAt         INTEGER DEFAULT (strftime('%s','now'))
    )
  `);

    db.run(`
    CREATE TABLE IF NOT EXISTS giveaways (
      id                TEXT PRIMARY KEY,
      guildId           TEXT NOT NULL,
      type              TEXT NOT NULL,
      prize             TEXT NOT NULL,
      winners           INTEGER NOT NULL,
      serverLink        TEXT,
      ping              TEXT,
      postAt            INTEGER NOT NULL,
      endAt             INTEGER,
      channelId         TEXT,
      categoryId        TEXT,
      customChannelName TEXT,
      requirementText   TEXT,
      messageId         TEXT,
      status            TEXT DEFAULT 'queued',
      winnerIds         TEXT,
      notes             TEXT,
      createdBy         TEXT NOT NULL,
      createdAt         INTEGER DEFAULT (strftime('%s','now')),
      postedAt          INTEGER,
      endedAt           INTEGER
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS giveaway_entries (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      giveawayId  TEXT NOT NULL,
      userId      TEXT NOT NULL,
      guildId     TEXT NOT NULL,
      enteredAt   INTEGER DEFAULT (strftime('%s','now')),
      UNIQUE(giveawayId, userId)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS banned_users (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      guildId      TEXT NOT NULL,
      userId       TEXT NOT NULL,
      giveawayType TEXT NOT NULL DEFAULT 'all',
      bannedBy     TEXT NOT NULL,
      reason       TEXT,
      bannedAt     INTEGER DEFAULT (strftime('%s','now')),
      UNIQUE(guildId, userId, giveawayType)
    )
  `);

  /* Backward-compatible migrations for older DB files */
  ensureGiveawaysRequirementColumn();
  migrateBannedUsersTableIfNeeded();

  save();
  console.log('[DB] Database initialized â€” all tables ready.');
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
 *  HELPERS â€” sql.js query wrappers
 * â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

/**
 * Execute a SELECT query and return all matching rows as an array of objects.
 * @param {string} sql â€” SQL query string with ? placeholders
 * @param {any[]} params â€” Bind parameters
 * @returns {object[]}
 */
function queryAll(sql, params = []) {
  const stmt = db.prepare(sql);
  if (params.length > 0) stmt.bind(params);

  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

/**
 * Execute a SELECT query and return the first matching row as an object.
 * @param {string} sql â€” SQL query string with ? placeholders
 * @param {any[]} params â€” Bind parameters
 * @returns {object|undefined}
 */
function queryOne(sql, params = []) {
  const stmt = db.prepare(sql);
  if (params.length > 0) stmt.bind(params);

  let row = undefined;
  if (stmt.step()) {
    row = stmt.getAsObject();
  }
  stmt.free();
  return row;
}

/**
 * Execute a write query (INSERT, UPDATE, DELETE) and save to disk.
 * @param {string} sql â€” SQL statement with ? placeholders
 * @param {any[]} params â€” Bind parameters
 */
function execute(sql, params = []) {
  db.run(sql, params);
  save();
}

/**
 * Ensure the giveaways table has requirementText for custom event requirements.
 */
function ensureGiveawaysRequirementColumn() {
  const columns = queryAll('PRAGMA table_info(giveaways)');
  const hasRequirementText = columns.some((col) => col.name === 'requirementText');

  if (!hasRequirementText) {
    db.run('ALTER TABLE giveaways ADD COLUMN requirementText TEXT');
  }
}

/**
 * Migrate legacy banned_users schema to typed blacklist entries.
 */
function migrateBannedUsersTableIfNeeded() {
  const columns = queryAll('PRAGMA table_info(banned_users)');
  const hasGiveawayType = columns.some((col) => col.name === 'giveawayType');

  if (hasGiveawayType) return;

  db.run('ALTER TABLE banned_users RENAME TO banned_users_old');

  db.run(`
    CREATE TABLE banned_users (
      id           INTEGER PRIMARY KEY AUTOINCREMENT,
      guildId      TEXT NOT NULL,
      userId       TEXT NOT NULL,
      giveawayType TEXT NOT NULL DEFAULT 'all',
      bannedBy     TEXT NOT NULL,
      reason       TEXT,
      bannedAt     INTEGER DEFAULT (strftime('%s','now')),
      UNIQUE(guildId, userId, giveawayType)
    )
  `);

  db.run(`
    INSERT INTO banned_users (guildId, userId, giveawayType, bannedBy, reason, bannedAt)
    SELECT guildId, userId, 'all', bannedBy, reason, bannedAt
    FROM banned_users_old
  `);

  db.run('DROP TABLE banned_users_old');
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
 *  GUILD CONFIG QUERIES
 * â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

/**
 * Get the configuration for a guild.
 * @param {string} guildId
 * @returns {object|undefined}
 */
function getGuildConfig(guildId) {
  return queryOne('SELECT * FROM guild_config WHERE guildId = ?', [guildId]);
}

/**
 * Upsert (insert or update) a guild's configuration.
 * Only non-null values are updated â€” existing values are preserved.
 *
 * @param {string} guildId
 * @param {object} data â€” { managerRoleId?, mutualChannelId?, sponsorChannelId? }
 */
function upsertGuildConfig(guildId, data) {
  const existing = getGuildConfig(guildId);

  if (existing) {
    execute(
      `UPDATE guild_config
       SET managerRoleId   = COALESCE(?, managerRoleId),
           mutualChannelId = COALESCE(?, mutualChannelId),
           sponsorChannelId = COALESCE(?, sponsorChannelId)
       WHERE guildId = ?`,
      [
        data.managerRoleId ?? null,
        data.mutualChannelId ?? null,
        data.sponsorChannelId ?? null,
        guildId,
      ]
    );
  } else {
    execute(
      `INSERT INTO guild_config (guildId, managerRoleId, mutualChannelId, sponsorChannelId)
       VALUES (?, ?, ?, ?)`,
      [
        guildId,
        data.managerRoleId ?? null,
        data.mutualChannelId ?? null,
        data.sponsorChannelId ?? null,
      ]
    );
  }
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
 *  GIVEAWAY QUERIES
 * â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

/**
 * Get a single giveaway by ID.
 * @param {string} id â€” Giveaway ID e.g. "GW-A3F9"
 * @returns {object|undefined}
 */
function getGiveaway(id) {
  return queryOne('SELECT * FROM giveaways WHERE id = ?', [id]);
}

/**
 * Get a giveaway by ID scoped to a specific guild.
 * @param {string} id
 * @param {string} guildId
 * @returns {object|undefined}
 */
function getGiveawayByGuild(id, guildId) {
  return queryOne('SELECT * FROM giveaways WHERE id = ? AND guildId = ?', [id, guildId]);
}

/**
 * Create a new giveaway record.
 * @param {object} data â€” All giveaway fields
 */
function createGiveaway(data) {
  execute(
    `INSERT INTO giveaways
      (id, guildId, type, prize, winners, serverLink, ping, postAt, endAt,
       channelId, categoryId, customChannelName, requirementText, status, createdBy)
     VALUES
      (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'queued', ?)`,
    [
      data.id,
      data.guildId,
      data.type,
      data.prize,
      data.winners,
      data.serverLink ?? null,
      data.ping ?? null,
      data.postAt,
      data.endAt ?? null,
      data.channelId ?? null,
      data.categoryId ?? null,
      data.customChannelName ?? null,
      data.requirementText ?? null,
      data.createdBy,
    ]
  );
}

/**
 * Update specific fields on a giveaway.
 * @param {string} id â€” Giveaway ID
 * @param {object} updates â€” Key/value pairs to SET
 */
function updateGiveaway(id, updates) {
  const keys = Object.keys(updates);
  if (keys.length === 0) return;

  const setClauses = keys.map((k) => `${k} = ?`).join(', ');
  const values = keys.map((k) => updates[k]);
  values.push(id);

  execute(`UPDATE giveaways SET ${setClauses} WHERE id = ?`, values);
}

/**
 * List giveaways for a guild filtered by status(es).
 * @param {string} guildId
 * @param {string[]} statuses â€” e.g. ['queued', 'active']
 * @param {number} [limit=50]
 * @returns {object[]}
 */
function listGiveaways(guildId, statuses, limit = 50) {
  const placeholders = statuses.map(() => '?').join(', ');
  return queryAll(
    `SELECT * FROM giveaways
     WHERE guildId = ? AND status IN (${placeholders})
     ORDER BY createdAt DESC
     LIMIT ?`,
    [guildId, ...statuses, limit]
  );
}

/**
 * Get all giveaways that are due to be posted (queued and past postAt).
 * @param {number} now â€” Current Unix timestamp in seconds
 * @returns {object[]}
 */
function getGiveawaysDueToPost(now) {
  return queryAll(
    "SELECT * FROM giveaways WHERE status = 'queued' AND postAt <= ?",
    [now]
  );
}

/**
 * Get all giveaways that are due to end (active and past endAt).
 * @param {number} now â€” Current Unix timestamp in seconds
 * @returns {object[]}
 */
function getGiveawaysDueToEnd(now) {
  return queryAll(
    "SELECT * FROM giveaways WHERE status = 'active' AND endAt IS NOT NULL AND endAt <= ?",
    [now]
  );
}

/**
 * Get an active giveaway by its Discord message ID.
 * Used for reaction-based entry/leave DMs.
 * @param {string} messageId
 * @returns {object|undefined}
 */
function getGiveawayByMessageId(messageId) {
  return queryOne(
    "SELECT * FROM giveaways WHERE messageId = ? AND status = 'active'",
    [messageId]
  );
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
 *  GIVEAWAY ENTRIES QUERIES
 * â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

/**
 * Record a giveaway entry (used when storing reaction users at giveaway end).
 * @param {string} giveawayId
 * @param {string} userId
 * @param {string} guildId
 */
function createEntry(giveawayId, userId, guildId) {
  try {
    execute(
      `INSERT OR IGNORE INTO giveaway_entries (giveawayId, userId, guildId)
       VALUES (?, ?, ?)`,
      [giveawayId, userId, guildId]
    );
  } catch {
    /* Ignore duplicate entries */
  }
}

/**
 * Get all entries for a giveaway.
 * @param {string} giveawayId
 * @returns {object[]}
 */
function getEntries(giveawayId) {
  return queryAll(
    'SELECT * FROM giveaway_entries WHERE giveawayId = ?',
    [giveawayId]
  );
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
 *  BANNED USERS QUERIES
 * â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

/**
 * Ban a user from giveaways in a guild.
 * @param {string} guildId
 * @param {string} userId
 * @param {string} bannedBy â€” User ID of the moderator
 * @param {string|null} reason
 * @returns {boolean} true if inserted, false if already banned
 */
function banUser(guildId, userId, bannedBy, reason, giveawayType = 'all') {
  try {
    execute(
      `INSERT INTO banned_users (guildId, userId, giveawayType, bannedBy, reason)
       VALUES (?, ?, ?, ?, ?)`,
      [guildId, userId, giveawayType, bannedBy, reason ?? null]
    );
    return true;
  } catch (err) {
    /* UNIQUE constraint violation â€” user already banned */
    if (err.message && err.message.includes('UNIQUE')) return false;
    throw err;
  }
}

/**
 * Check if a user is banned in a guild.
 * @param {string} guildId
 * @param {string} userId
 * @param {string|null} [giveawayType=null]
 * @returns {boolean}
 */
function isBanned(guildId, userId, giveawayType = null) {
  const row = giveawayType
    ? queryOne(
      `SELECT 1
       FROM banned_users
       WHERE guildId = ? AND userId = ? AND (giveawayType = 'all' OR giveawayType = ?)`,
      [guildId, userId, giveawayType]
    )
    : queryOne(
      'SELECT 1 FROM banned_users WHERE guildId = ? AND userId = ?',
      [guildId, userId]
    );

  return !!row;
}

/**
 * Get all banned user IDs for a guild.
 * @param {string} guildId
 * @param {string|null} [giveawayType=null]
 * @returns {string[]}
 */
function getBannedUserIds(guildId, giveawayType = null) {
  const rows = giveawayType
    ? queryAll(
      `SELECT DISTINCT userId
       FROM banned_users
       WHERE guildId = ? AND (giveawayType = 'all' OR giveawayType = ?)`,
      [guildId, giveawayType]
    )
    : queryAll(
      'SELECT DISTINCT userId FROM banned_users WHERE guildId = ?',
      [guildId]
    );

  return rows.map((row) => row.userId);
}

/* â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
 *  EXPORTS
 * â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â• */

module.exports = {
  initDatabase,
  /* Guild Config */
  getGuildConfig,
  upsertGuildConfig,
  /* Giveaways */
  getGiveaway,
  getGiveawayByGuild,
  getGiveawayByMessageId,
  createGiveaway,
  updateGiveaway,
  listGiveaways,
  getGiveawaysDueToPost,
  getGiveawaysDueToEnd,
  /* Entries */
  createEntry,
  getEntries,
  /* Bans */
  banUser,
  isBanned,
  getBannedUserIds,
};





