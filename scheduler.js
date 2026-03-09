/**
 * scheduler.js
 * ------------
 * node-cron scheduler that runs every 60 seconds to:
 *   1. Post queued giveaways whose postAt has passed
 *   2. End active giveaways whose endAt has passed
 * Each giveaway is processed independently — a failure on one
 * does not halt processing of others.
 */

const cron = require('node-cron');
const db = require('./database');
const { postGiveaway } = require('./giveaway/poster');
const { endGiveaway } = require('./giveaway/ender');

/**
 * Start the scheduler. Should be called once during bot initialization.
 *
 * @param {import('discord.js').Client} client — The Discord client
 */
function startScheduler(client) {
  /* Run every 60 seconds */
  cron.schedule('* * * * *', async () => {
    const now = Math.floor(Date.now() / 1000);

    /* ── 1. Post queued giveaways that are due ─────────────── */
    const dueToPost = db.getGiveawaysDueToPost(now);
    for (const giveaway of dueToPost) {
      try {
        await postGiveaway(giveaway, client);
      } catch (err) {
        console.error(`[Scheduler] Error posting giveaway ${giveaway.id}: ${err.message}`);
        /* Mark as stopped so it isn't retried indefinitely */
        db.updateGiveaway(giveaway.id, {
          status: 'stopped',
          notes: `Scheduler post error: ${err.message}`,
          endedAt: now,
        });
      }
    }

    /* ── 2. End active giveaways that are past endAt ──────── */
    const dueToEnd = db.getGiveawaysDueToEnd(now);
    for (const giveaway of dueToEnd) {
      try {
        await endGiveaway(giveaway, client);
      } catch (err) {
        console.error(`[Scheduler] Error ending giveaway ${giveaway.id}: ${err.message}`);
        /* Mark as stopped so it isn't retried indefinitely */
        db.updateGiveaway(giveaway.id, {
          status: 'stopped',
          notes: `Scheduler end error: ${err.message}`,
          endedAt: now,
        });
      }
    }
  });

  console.log('[Scheduler] Cron job started — checking every 60 seconds.');
}

module.exports = { startScheduler };
