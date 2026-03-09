/**
 * interactions/_sessions.js
 * -------------------------
 * In-memory session store for multi-step interaction flows.
 * Keyed by `userId_guildId`. Sessions auto-expire after the
 * configured SESSION_TIMEOUT_MS (10 minutes by default).
 */

const defaults = require('../config/defaults');

/**
 * Extended Map that automatically clears entries after a timeout.
 */
class SessionStore extends Map {
  /**
   * Set a value with automatic expiry.
   * @param {string} key
   * @param {any} value
   * @returns {this}
   */
  set(key, value) {
    /* Clear any existing timeout for this key */
    const existing = super.get(key);
    if (existing?._timeout) {
      clearTimeout(existing._timeout);
    }

    /* Attach a timeout that will delete the entry */
    value._timeout = setTimeout(() => {
      super.delete(key);
    }, defaults.SESSION_TIMEOUT_MS);

    return super.set(key, value);
  }

  /**
   * Delete a key and clear its timeout.
   * @param {string} key
   * @returns {boolean}
   */
  delete(key) {
    const existing = super.get(key);
    if (existing?._timeout) {
      clearTimeout(existing._timeout);
    }
    return super.delete(key);
  }
}

module.exports = new SessionStore();
