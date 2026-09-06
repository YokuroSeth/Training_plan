export class UserRateLimiter {
  constructor({ limit = 3, windowMs = 1000, blockMs = 5 * 60 * 1000 } = {}) {
    this.limit = limit;
    this.windowMs = windowMs;
    this.blockMs = blockMs;
    this.users = new Map();
  }

  check(userId, now = Date.now()) {
    const current = this.users.get(userId) || { timestamps: [], blockedUntil: 0 };
    if (current.blockedUntil > now) {
      return { allowed: false, blocked: true, blockedUntil: current.blockedUntil };
    }

    current.timestamps = current.timestamps.filter((timestamp) => now - timestamp < this.windowMs);
    current.timestamps.push(now);
    if (current.timestamps.length > this.limit) {
      current.timestamps = [];
      current.blockedUntil = now + this.blockMs;
      this.users.set(userId, current);
      return { allowed: false, blocked: true, newlyBlocked: true, blockedUntil: current.blockedUntil };
    }

    current.blockedUntil = 0;
    this.users.set(userId, current);
    return { allowed: true, blocked: false };
  }

  cleanup(now = Date.now()) {
    for (const [userId, state] of this.users) {
      const hasRecentMessages = state.timestamps.some((timestamp) => now - timestamp < this.windowMs);
      if (!hasRecentMessages && state.blockedUntil <= now) this.users.delete(userId);
    }
  }
}
