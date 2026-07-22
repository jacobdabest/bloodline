import { World, MIN_PLAYTIME_HOURS } from "./lineage.js";

const HOUR = 3600 * 1000;
let now = Date.now();

const w = new World();

console.log("=== two players join ===\n");
const ava = w.join("u1", "Ava");
const ben = w.join("u2", "Ben");
for (const p of [ava, ben]) console.log(`${p.name}: ${p.power.name}`);

console.log("\n=== Ava tries to breed immediately ===\n");
console.log(" ", w.propose("u1", "u2", now).reason);

console.log("\n=== ...they play for a while ===\n");
ava.playtimeHours = 12;
ben.playtimeHours = 8;
for (let i = 0; i < 600; i++) {
  ava.power.addXp(3000);
  ben.power.addXp(3000);
}
console.log(`  Ava is now lvl ${ava.power.level}: ${ava.power.name}`);
console.log(`  Ben is now lvl ${ben.power.level}: ${ben.power.name}`);

console.log("\n=== Ava proposes, Ben consents ===\n");
console.log(" ", w.propose("u1", "u2", now).reason);
const res = w.accept("u2", "u1", now);
const bc = res.birthCode;
console.log(`  child genes : ${bc.power.name} (gen ${bc.power.generation}, cap ${bc.power.levelCap})`);
console.log(`  BIRTH CODE  : ${bc.code}`);
console.log(`  expires in  : ${CODE_DAYS(bc, now)} days`);

console.log("\n=== Ava tries again right away ===\n");
console.log(" ", w.propose("u1", "u2", now).reason);

console.log("\n=== Ava gives the code to her friend Cid ===\n");
const join = w.joinWithCode("u3", "Cid", bc.code, now);
const cid = join.player;
console.log(`  Cid is born: ${cid.power.name}`);
console.log(`  gen ${cid.power.generation}, level cap ${cid.power.levelCap} (a fresh player caps at 75)`);
console.log(`  starting potency ${cid.power.potency} vs a fresh roll's 11.4 -- barely an edge`);

console.log("\n=== someone tries to reuse the code ===\n");
console.log(" ", w.joinWithCode("u4", "Alt", bc.code, now).reason);

console.log("\n=== a code nobody claims ===\n");
now += 60 * HOUR; // past the breed cooldown
ava.playtimeHours = 40;
ben.playtimeHours = 40;
w.propose("u1", "u2", now);
const lost = w.accept("u2", "u1", now).birthCode;
console.log(`  minted ${lost.code}, never given to anyone`);
now += 8 * 24 * HOUR;
console.log(`  8 days later -> pruned ${w.pruneCodes(now)} dead code(s)`);

console.log("\n=== Cid has a kid with Dot, three generations deep ===\n");
const dot = w.join("u5", "Dot");
cid.playtimeHours = 20;
dot.playtimeHours = 20;
for (let i = 0; i < 600; i++) { cid.power.addXp(3000); dot.power.addXp(3000); }
w.propose("u3", "u5", now);
const gc = w.accept("u5", "u3", now).birthCode;
w.joinWithCode("u6", "Eli", gc.code, now);

console.log("Family tree of Eli:\n");
console.log(w.ancestryOf("u6").join("\n"));

function CODE_DAYS(code, t) {
  return Math.round((code.expiresAt - t) / (24 * HOUR));
}
