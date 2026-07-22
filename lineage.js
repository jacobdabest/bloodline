/**
 * Lineage: consent-based breeding and birth codes.
 *
 * Flow:
 *   1. Player A proposes a child with Player B.
 *   2. B accepts. A birth code is minted, holding the child's genes.
 *   3. A or B gives that code to a real new person.
 *   4. New person redeems it on a fresh account and is born into the bloodline.
 *
 * A code is a one-time token. It expires. It carries a higher level cap
 * but almost no starting power, so it is worth recruiting a friend for
 * and worthless to farm on an alt.
 */

import { breed, rollPower, Power } from "./powers.js";

// ------------------------------------------------------------ tuning

export const MIN_PLAYTIME_HOURS = 3;      // before you can breed at all
export const BREED_COOLDOWN_HOURS = 48;   // per player, after a child
export const CODE_EXPIRY_DAYS = 7;        // unclaimed codes die
export const MAX_UNCLAIMED_CODES = 2;     // per player, stops hoarding

const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;

// ------------------------------------------------------------ player

export class Player {
  constructor(id, name, power) {
    this.id = id;
    this.name = name;
    this.power = power;
    this.playtimeHours = 0;
    this.lastChildAt = null;
    this.parents = null;      // [idA, idB] if born from a code
  }

  canBreed(now = Date.now()) {
    if (this.playtimeHours < MIN_PLAYTIME_HOURS)
      return { ok: false, reason: `needs ${MIN_PLAYTIME_HOURS}h playtime (has ${this.playtimeHours}h)` };
    if (this.lastChildAt !== null && now - this.lastChildAt < BREED_COOLDOWN_HOURS * HOUR) {
      const left = Math.ceil((BREED_COOLDOWN_HOURS * HOUR - (now - this.lastChildAt)) / HOUR);
      return { ok: false, reason: `on cooldown, ${left}h left` };
    }
    return { ok: true };
  }

  toJSON() {
    return {
      id: this.id, name: this.name, power: this.power.toJSON(),
      playtimeHours: this.playtimeHours, lastChildAt: this.lastChildAt,
      parents: this.parents,
    };
  }

  static fromJSON(d) {
    const p = new Player(d.id, d.name, Power.fromJSON(d.power));
    p.playtimeHours = d.playtimeHours;
    p.lastChildAt = d.lastChildAt;
    p.parents = d.parents;
    return p;
  }
}

// -------------------------------------------------------- birth code

function randomChunk(n) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no confusable 0/O/1/I
  let out = "";
  for (let i = 0; i < n; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

export class BirthCode {
  constructor(code, power, parentIds, createdAt) {
    this.code = code;
    this.power = power;          // the child's genes, already rolled
    this.parentIds = parentIds;
    this.createdAt = createdAt;
    this.claimedBy = null;
  }

  get expiresAt() {
    return this.createdAt + CODE_EXPIRY_DAYS * DAY;
  }

  isExpired(now = Date.now()) {
    return now > this.expiresAt;
  }

  isUsable(now = Date.now()) {
    return this.claimedBy === null && !this.isExpired(now);
  }
}

// ----------------------------------------------------------- world

export class World {
  constructor() {
    this.players = new Map();
    this.codes = new Map();
    this.proposals = new Map(); // key: "a>b"
  }

  // -- accounts -----------------------------------------------------

  /** A newcomer with no code: random power, generation 1. */
  join(id, name) {
    const p = new Player(id, name, rollPower());
    this.players.set(id, p);
    return p;
  }

  /** A newcomer holding a code: born into a bloodline. */
  joinWithCode(id, name, code, now = Date.now()) {
    const bc = this.codes.get(code.toUpperCase());
    if (!bc) return { ok: false, reason: "no such code" };
    if (bc.claimedBy) return { ok: false, reason: "code already used" };
    if (bc.isExpired(now)) return { ok: false, reason: "code expired" };

    const p = new Player(id, name, bc.power);
    p.parents = bc.parentIds;
    bc.claimedBy = id;
    this.players.set(id, p);
    return { ok: true, player: p };
  }

  // -- breeding -----------------------------------------------------

  unclaimedCodesFor(playerId, now = Date.now()) {
    return [...this.codes.values()].filter(
      (c) => c.parentIds.includes(playerId) && c.isUsable(now)
    );
  }

  /** Step 1: A asks B for a child. */
  propose(aId, bId, now = Date.now()) {
    const a = this.players.get(aId);
    const b = this.players.get(bId);
    if (!a || !b) return { ok: false, reason: "unknown player" };
    if (aId === bId) return { ok: false, reason: "cannot breed with yourself" };

    for (const who of [a, b]) {
      const check = who.canBreed(now);
      if (!check.ok) return { ok: false, reason: `${who.name}: ${check.reason}` };
      if (this.unclaimedCodesFor(who.id, now).length >= MAX_UNCLAIMED_CODES)
        return { ok: false, reason: `${who.name} has unclaimed codes already` };
    }

    this.proposals.set(`${aId}>${bId}`, now);
    return { ok: true, reason: `${a.name} asked ${b.name}. Waiting for consent.` };
  }

  /** Step 2: B accepts. Both must have acted -- no one-sided breeding. */
  accept(bId, aId, now = Date.now()) {
    if (!this.proposals.has(`${aId}>${bId}`))
      return { ok: false, reason: "no pending proposal from that player" };

    const a = this.players.get(aId);
    const b = this.players.get(bId);
    for (const who of [a, b]) {
      const check = who.canBreed(now);
      if (!check.ok) return { ok: false, reason: `${who.name}: ${check.reason}` };
    }

    const childPower = breed(a.power, b.power);
    const code = `${childPower.elementName.toUpperCase().slice(0, 5)}-${randomChunk(4)}-${randomChunk(2)}`;
    const bc = new BirthCode(code, childPower, [aId, bId], now);

    this.codes.set(code, bc);
    this.proposals.delete(`${aId}>${bId}`);
    a.lastChildAt = now;
    b.lastChildAt = now;

    return { ok: true, birthCode: bc };
  }

  /** Housekeeping: drop dead codes so slots free up. */
  pruneCodes(now = Date.now()) {
    let dropped = 0;
    for (const [key, c] of this.codes) {
      if (c.isExpired(now) && !c.claimedBy) {
        this.codes.delete(key);
        dropped++;
      }
    }
    return dropped;
  }

  // -- family tree --------------------------------------------------

  ancestryOf(playerId, depth = 0) {
    const p = this.players.get(playerId);
    if (!p) return [];
    const pad = "  ".repeat(depth);
    let lines = [`${pad}${p.name} -- ${p.power.name} (gen ${p.power.generation})`];
    if (p.parents) {
      for (const parentId of p.parents) {
        lines = lines.concat(this.ancestryOf(parentId, depth + 1));
      }
    }
    return lines;
  }
}
