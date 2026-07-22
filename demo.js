import { rollPower, breed, Power } from "./powers.js";

console.log("=== four players join the server ===\n");
const players = {};
for (const who of ["Ava", "Ben", "Cid", "Dot"]) {
  players[who] = rollPower();
  console.log(`${who}:`);
  console.log(players[who].describe(), "\n");
}

console.log("=== Ava grinds to max ===\n");
const ava = players.Ava;
for (let i = 0; i < 400; i++) {
  for (const note of ava.addXp(3000)) console.log(`  lvl ${ava.level}: ${note}`);
}
console.log();
console.log(ava.describe(), "\n");

console.log("=== Ava + Ben have a kid ===\n");
const kid = breed(ava, players.Ben);
console.log("Child:");
console.log(kid.describe(), "\n");

console.log("=== saving and loading works ===\n");
const saved = JSON.stringify(kid.toJSON());
const loaded = Power.fromJSON(JSON.parse(saved));
console.log(`  saved  : ${saved.slice(0, 70)}...`);
console.log(`  loaded : ${loaded.name} (gen ${loaded.generation})\n`);

console.log("=== five generations of that bloodline ===\n");
let line = kid;
let partner = players.Cid;
for (let g = 0; g < 5; g++) {
  for (let i = 0; i < 500; i++) line.addXp(3000);
  const child = breed(line, partner);
  console.log(`gen ${child.generation}: ${child.name}  (cap ${child.levelCap})`);
  line = child;
  partner = rollPower();
}
