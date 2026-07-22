"""
Power gene system.

A power is not a hand-written thing. It is a set of genes:
    element(s) + delivery(s) + modifier(s) + body trait
Mastery unlocks more gene slots, so a maxed player is genuinely
more complex than a new one -- with no new code.

Children inherit genes from two parents, sometimes mutate, and each
generation can push its level cap a little higher.
"""

import random

# ---------------------------------------------------------------- genes

# element -> rarity weight (lower = rarer)
ELEMENTS = {
    "Fire": 10, "Ice": 10, "Water": 10, "Earth": 10, "Wind": 10, "Metal": 9,
    "Lightning": 7, "Toxin": 7, "Sound": 6,
    "Shadow": 4, "Light": 4, "Gravity": 2,
}

# how the power comes out of you
DELIVERIES = {
    "Projectile": 10, "Aura": 9, "Touch": 9,
    "Transform": 6, "Terrain": 5, "Summon": 3,
}

# behaviour attached to any element/delivery pair
MODIFIERS = {
    "Homing": 8, "Lingering": 8, "Piercing": 8, "Chain": 7, "Splitting": 6,
    "Delayed": 6, "Draining": 5, "Reflecting": 4, "Vortex": 3, "Unstable": 3,
}

BODY_TRAITS = {
    "None": 30, "Glowing Eyes": 10, "Scales": 8, "Tail": 8, "Claws": 8,
    "Wings": 4, "Extra Arms": 3, "Translucent Skin": 3, "Horns": 6,
}

# two elements fused get a real name instead of "Fire/Ice"
FUSIONS = {
    frozenset(("Fire", "Ice")): "Steam",
    frozenset(("Fire", "Earth")): "Magma",
    frozenset(("Fire", "Wind")): "Firestorm",
    frozenset(("Fire", "Metal")): "Forge",
    frozenset(("Ice", "Wind")): "Blizzard",
    frozenset(("Ice", "Earth")): "Permafrost",
    frozenset(("Ice", "Water")): "Glacier",
    frozenset(("Lightning", "Metal")): "Magnetism",
    frozenset(("Lightning", "Water")): "Stormsurge",
    frozenset(("Lightning", "Wind")): "Tempest",
    frozenset(("Shadow", "Light")): "Eclipse",
    frozenset(("Shadow", "Toxin")): "Blight",
    frozenset(("Light", "Sound")): "Resonance",
    frozenset(("Gravity", "Earth")): "Tectonic",
    frozenset(("Gravity", "Light")): "Singularity",
    frozenset(("Water", "Toxin")): "Miasma",
    frozenset(("Earth", "Metal")): "Ironclad",
    frozenset(("Wind", "Sound")): "Howl",
}

# ------------------------------------------------------- mastery curve

UNLOCK_SECOND_DELIVERY = 20
UNLOCK_SECOND_MODIFIER = 45
UNLOCK_AWAKENING = 70          # second element

BASE_LEVEL_CAP = 75
CAP_PER_GENERATION = 8
MAX_LEVEL = 100


def xp_for_level(level):
    return int(50 * (level ** 1.5))


def weighted_pick(table, exclude=()):
    opts = [(k, w) for k, w in table.items() if k not in exclude]
    return random.choices([k for k, _ in opts], weights=[w for _, w in opts])[0]


# ------------------------------------------------------------- power

class Power:
    def __init__(self, elements, deliveries, modifiers, body, generation=1):
        self.elements = elements
        self.deliveries = deliveries
        self.modifiers = modifiers
        self.body = body
        self.generation = generation
        self.level = 1
        self.xp = 0

    # -- derived ------------------------------------------------------

    @property
    def level_cap(self):
        return min(MAX_LEVEL, BASE_LEVEL_CAP + CAP_PER_GENERATION * (self.generation - 1))

    @property
    def slots(self):
        """How many of each gene are actually active at this level."""
        return {
            "elements": 2 if self.level >= UNLOCK_AWAKENING else 1,
            "deliveries": 2 if self.level >= UNLOCK_SECOND_DELIVERY else 1,
            "modifiers": 2 if self.level >= UNLOCK_SECOND_MODIFIER else 1,
        }

    @property
    def active_elements(self):
        return self.elements[: self.slots["elements"]]

    @property
    def active_deliveries(self):
        return self.deliveries[: self.slots["deliveries"]]

    @property
    def active_modifiers(self):
        return self.modifiers[: self.slots["modifiers"]]

    @property
    def element_name(self):
        act = self.active_elements
        if len(act) == 1:
            return act[0]
        return FUSIONS.get(frozenset(act), "/".join(act))

    @property
    def potency(self):
        """Raw strength. Scales with level, nudged up by bloodline."""
        return round(10 + self.level * 1.4 + (self.generation - 1) * 3, 1)

    @property
    def name(self):
        return f"{self.active_modifiers[0]} {self.element_name} {self.active_deliveries[0]}"

    # -- progression --------------------------------------------------

    def add_xp(self, amount):
        """Returns a list of things that unlocked."""
        events = []
        self.xp += amount
        while self.level < self.level_cap and self.xp >= xp_for_level(self.level + 1):
            self.xp -= xp_for_level(self.level + 1)
            self.level += 1
            if self.level == UNLOCK_SECOND_DELIVERY:
                events.append(f"unlocked 2nd delivery: {self.deliveries[1]}")
            if self.level == UNLOCK_SECOND_MODIFIER:
                events.append(f"unlocked 2nd modifier: {self.modifiers[1]}")
            if self.level == UNLOCK_AWAKENING:
                events.append(f"AWAKENED -- second element: {self.elements[1]}")
        return events

    # -- display ------------------------------------------------------

    def describe(self):
        s = self.slots
        lines = [
            f"  {self.name}",
            f"  gen {self.generation}   lvl {self.level}/{self.level_cap}   potency {self.potency}",
            f"  elements  : {', '.join(self.active_elements)}"
            + (f"   [locked: {self.elements[1]}]" if s['elements'] == 1 else ""),
            f"  deliveries: {', '.join(self.active_deliveries)}"
            + (f"   [locked: {self.deliveries[1]}]" if s['deliveries'] == 1 else ""),
            f"  modifiers : {', '.join(self.active_modifiers)}"
            + (f"   [locked: {self.modifiers[1]}]" if s['modifiers'] == 1 else ""),
        ]
        if self.body != "None":
            lines.append(f"  body      : {self.body}")
        return "\n".join(lines)


# ------------------------------------------------------------ creation

def roll_power(generation=1):
    """A brand new user with no parents."""
    e1 = weighted_pick(ELEMENTS)
    e2 = weighted_pick(ELEMENTS, exclude=(e1,))
    d1 = weighted_pick(DELIVERIES)
    d2 = weighted_pick(DELIVERIES, exclude=(d1,))
    m1 = weighted_pick(MODIFIERS)
    m2 = weighted_pick(MODIFIERS, exclude=(m1,))
    return Power([e1, e2], [d1, d2], [m1, m2], weighted_pick(BODY_TRAITS), generation)


MUTATION_CHANCE = 0.12


def breed(a, b):
    """Child inherits each gene slot from one parent, sometimes mutating."""
    def inherit(slot, table):
        ga, gb = getattr(a, slot), getattr(b, slot)
        out = []
        for i in range(2):
            if random.random() < MUTATION_CHANCE:
                out.append(weighted_pick(table, exclude=tuple(out)))
            else:
                pick = random.choice([ga[i], gb[i]])
                if pick in out:                      # avoid duplicate genes
                    pick = weighted_pick(table, exclude=tuple(out))
                out.append(pick)
        return out

    body = random.choice([a.body, b.body])
    if random.random() < MUTATION_CHANCE:
        body = weighted_pick(BODY_TRAITS)

    return Power(
        inherit("elements", ELEMENTS),
        inherit("deliveries", DELIVERIES),
        inherit("modifiers", MODIFIERS),
        body,
        generation=max(a.generation, b.generation) + 1,
    )


# ---------------------------------------------------------------- demo

if __name__ == "__main__":
    print("=== four players join the server ===\n")
    players = {}
    for who in ("Ava", "Ben", "Cid", "Dot"):
        players[who] = roll_power()
        print(f"{who}:")
        print(players[who].describe(), "\n")

    print("=== Ava grinds to max ===\n")
    ava = players["Ava"]
    for _ in range(400):
        for note in ava.add_xp(3000):
            print(f"  lvl {ava.level}: {note}")
    print()
    print(ava.describe(), "\n")

    print("=== Ava + Ben have a kid ===\n")
    kid = breed(ava, players["Ben"])
    print("Child:")
    print(kid.describe(), "\n")

    print("=== five generations of that bloodline ===\n")
    line = kid
    partner = players["Cid"]
    for g in range(5):
        for _ in range(500):
            line.add_xp(3000)
        child = breed(line, partner)
        print(f"gen {child.generation}: {child.name}  (cap {child.level_cap})")
        line, partner = child, roll_power()
