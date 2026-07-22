/**
 * Power gene system.
 *
 * A power is not a hand-written thing. It is a set of genes:
 *     element(s) + delivery(s) + modifier(s) + body trait
 * Mastery unlocks more gene slots, so a maxed player is genuinely
 * more complex than a new one -- with no new code.
 *
 * Children inherit genes from two parents, sometimes mutate, and each
 * generation can push its level cap a little higher.
 *
 * Engine-agnostic: no DOM, no engine imports. Drop into PlayCanvas,
 * Three.js, a Node server, whatever.
 */

// ---------------------------------------------------------------- genes

// element -> rarity weight (lower = rarer)
export const ELEMENTS = {
  Fire: 10, Ice: 10, Water: 10, Earth: 10, Wind: 10, Metal: 9,
  Lightning: 7, Toxin: 7, Sound: 6,
  Shadow: 4, Light: 4, Gravity: 2,
};

// how the power comes out of you
export const DELIVERIES = {
  Projectile: 10, Aura: 9, Touch: 9,
  Transform: 6, Terrain: 5, Summon: 3,
};

// behaviour attached to any element/delivery pair
export const MODIFIERS = {
  Homing: 8, Lingering: 8, Piercing: 8, Chain: 7, Splitting: 6,
  Delayed: 6, Draining: 5, Reflecting: 4, Vortex: 3, Unstable: 3,
};

export const BODY_TRAITS = {
  None: 30, "Glowing Eyes": 10, Scales: 8, Tail: 8, Claws: 8,
  Wings: 4, "Extra Arms": 3, "Translucent Skin": 3, Horns: 6,
};

// two elements fused get a real name instead of "Fire/Ice"
const FUSIONS = new Map([
  ["Fire|Ice", "Steam"],
  ["Earth|Fire", "Magma"],
  ["Fire|Wind", "Firestorm"],
  ["Fire|Metal", "Forge"],
  ["Ice|Wind", "Blizzard"],
  ["Earth|Ice", "Permafrost"],
  ["Ice|Water", "Glacier"],
  ["Lightning|Metal", "Magnetism"],
  ["Lightning|Water", "Stormsurge"],
  ["Lightning|Wind", "Tempest"],
  ["Light|Shadow", "Eclipse"],
  ["Shadow|Toxin", "Blight"],
  ["Light|Sound", "Resonance"],
  ["Earth|Gravity", "Tectonic"],
  ["Gravity|Light", "Singularity"],
  ["Toxin|Water", "Miasma"],
  ["Earth|Metal", "Ironclad"],
  ["Sound|Wind", "Howl"],
]);

function fusionName(a, b) {
  const key = [a, b].sort().join("|");
  return FUSIONS.get(key) ?? `${a}/${b}`;
}

// ------------------------------------------------------- mastery curve

export const UNLOCK_SECOND_DELIVERY = 20;
export const UNLOCK_SECOND_MODIFIER = 45;
export const UNLOCK_AWAKENING = 70; // second element

export const BASE_LEVEL_CAP = 75;
export const CAP_PER_GENERATION = 8;
export const MAX_LEVEL = 100;
export const MUTATION_CHANCE = 0.12;

export function xpForLevel(level) {
  return Math.floor(50 * Math.pow(level, 1.5));
}

function weightedPick(table, exclude = []) {
  const opts = Object.entries(table).filter(([k]) => !exclude.includes(k));
  const total = opts.reduce((s, [, w]) => s + w, 0);
  let roll = Math.random() * total;
  for (const [key, weight] of opts) {
    roll -= weight;
    if (roll <= 0) return key;
  }
  return opts[opts.length - 1][0];
}

function choice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ------------------------------------------------------------- power

export class Power {
  constructor(elements, deliveries, modifiers, body, generation = 1) {
    this.elements = elements;
    this.deliveries = deliveries;
    this.modifiers = modifiers;
    this.body = body;
    this.generation = generation;
    this.level = 1;
    this.xp = 0;
  }

  // -- derived ------------------------------------------------------

  get levelCap() {
    return Math.min(MAX_LEVEL, BASE_LEVEL_CAP + CAP_PER_GENERATION * (this.generation - 1));
  }

  /** How many of each gene are actually active at this level. */
  get slots() {
    return {
      elements: this.level >= UNLOCK_AWAKENING ? 2 : 1,
      deliveries: this.level >= UNLOCK_SECOND_DELIVERY ? 2 : 1,
      modifiers: this.level >= UNLOCK_SECOND_MODIFIER ? 2 : 1,
    };
  }

  get activeElements() {
    return this.elements.slice(0, this.slots.elements);
  }

  get activeDeliveries() {
    return this.deliveries.slice(0, this.slots.deliveries);
  }

  get activeModifiers() {
    return this.modifiers.slice(0, this.slots.modifiers);
  }

  get elementName() {
    const act = this.activeElements;
    return act.length === 1 ? act[0] : fusionName(act[0], act[1]);
  }

  /** Raw strength. Scales with level, nudged up by bloodline. */
  get potency() {
    return Math.round((10 + this.level * 1.4 + (this.generation - 1) * 3) * 10) / 10;
  }

  get name() {
    return `${this.activeModifiers[0]} ${this.elementName} ${this.activeDeliveries[0]}`;
  }

  // -- progression --------------------------------------------------

  /** Returns a list of things that unlocked. */
  addXp(amount) {
    const events = [];
    this.xp += amount;
    while (this.level < this.levelCap && this.xp >= xpForLevel(this.level + 1)) {
      this.xp -= xpForLevel(this.level + 1);
      this.level += 1;
      if (this.level === UNLOCK_SECOND_DELIVERY)
        events.push(`unlocked 2nd delivery: ${this.deliveries[1]}`);
      if (this.level === UNLOCK_SECOND_MODIFIER)
        events.push(`unlocked 2nd modifier: ${this.modifiers[1]}`);
      if (this.level === UNLOCK_AWAKENING)
        events.push(`AWAKENED -- second element: ${this.elements[1]}`);
    }
    return events;
  }

  // -- saving -------------------------------------------------------

  toJSON() {
    return {
      elements: this.elements,
      deliveries: this.deliveries,
      modifiers: this.modifiers,
      body: this.body,
      generation: this.generation,
      level: this.level,
      xp: this.xp,
    };
  }

  static fromJSON(d) {
    const p = new Power(d.elements, d.deliveries, d.modifiers, d.body, d.generation);
    p.level = d.level;
    p.xp = d.xp;
    return p;
  }

  // -- display ------------------------------------------------------

  describe() {
    const s = this.slots;
    const lines = [
      `  ${this.name}`,
      `  gen ${this.generation}   lvl ${this.level}/${this.levelCap}   potency ${this.potency}`,
      `  elements  : ${this.activeElements.join(", ")}` +
        (s.elements === 1 ? `   [locked: ${this.elements[1]}]` : ""),
      `  deliveries: ${this.activeDeliveries.join(", ")}` +
        (s.deliveries === 1 ? `   [locked: ${this.deliveries[1]}]` : ""),
      `  modifiers : ${this.activeModifiers.join(", ")}` +
        (s.modifiers === 1 ? `   [locked: ${this.modifiers[1]}]` : ""),
    ];
    if (this.body !== "None") lines.push(`  body      : ${this.body}`);
    return lines.join("\n");
  }
}

// ------------------------------------------------------------ creation

/** A brand new user with no parents. */
export function rollPower(generation = 1) {
  const e1 = weightedPick(ELEMENTS);
  const e2 = weightedPick(ELEMENTS, [e1]);
  const d1 = weightedPick(DELIVERIES);
  const d2 = weightedPick(DELIVERIES, [d1]);
  const m1 = weightedPick(MODIFIERS);
  const m2 = weightedPick(MODIFIERS, [m1]);
  return new Power([e1, e2], [d1, d2], [m1, m2], weightedPick(BODY_TRAITS), generation);
}

/** Child inherits each gene slot from one parent, sometimes mutating. */
export function breed(a, b) {
  const inherit = (slot, table) => {
    const ga = a[slot];
    const gb = b[slot];
    const out = [];
    for (let i = 0; i < 2; i++) {
      if (Math.random() < MUTATION_CHANCE) {
        out.push(weightedPick(table, out));
      } else {
        let pick = choice([ga[i], gb[i]]);
        if (out.includes(pick)) pick = weightedPick(table, out); // no duplicate genes
        out.push(pick);
      }
    }
    return out;
  };

  let body = choice([a.body, b.body]);
  if (Math.random() < MUTATION_CHANCE) body = weightedPick(BODY_TRAITS);

  return new Power(
    inherit("elements", ELEMENTS),
    inherit("deliveries", DELIVERIES),
    inherit("modifiers", MODIFIERS),
    body,
    Math.max(a.generation, b.generation) + 1
  );
}
