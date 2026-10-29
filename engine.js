// TableLore trigger engine (testing level).
// Reads a card's rules text, recognizes common token / landfall / sacrifice / cast / death
// patterns, and resolves them against a player's board. Anything it can't safely resolve
// becomes a reminder for the player instead of a guess.

const NUMS = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, twenty: 20 };
const num = w => (w == null ? null : NUMS[String(w).toLowerCase()] ?? (/^\d+$/.test(w) ? Number(w) : null));

export const NONCREATURE_TOKENS = ["treasure", "food", "clue", "blood", "map", "powerstone", "gold", "shard", "junk", "incubator", "lander", "mutagen"];
export const NC_TOKENS = new Set(); // named noncreature tokens met so far (Meteorite, Cragflame, Stoneforged Blade…)
export const noteTokenKind = (name, desc) => { if (name && desc && !/\bcreature\b/i.test(desc) && /\b(?:artifact|enchantment|equipment)\b/i.test(desc)) NC_TOKENS.add(String(name).toLowerCase()); };
export const isCreatureToken = name => !NONCREATURE_TOKENS.includes(String(name).toLowerCase()) && !NC_TOKENS.has(String(name).toLowerCase());
const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "x";

// Capitalized words in a phrase are the token's subtype name: "1/1 green Squirrel creature" → "Squirrel"
const capName = phrase => (String(phrase).match(/\b[A-Z][\w'’-]*/g) || []).filter(w => w !== "X").join(" ");

// Words that mean the effect needs a choice, a target or a condition we don't model
const NEEDS_PLAYER_BASE = /\b(target|for each|unless|equal to|where x|if you do|if it|if that|if you|instead|choose|any number|up to)\b|\btokens? or (a|an)\b/i;
const NEEDS_PLAYER = { test: t => NEEDS_PLAYER_BASE.test(t) || /\bif an opponent (?:has|controls)\b/i.test(t) || /\bsacrifices? (a|an|one|two|three|\d+) (?!.*\bthis\b)/i.test(t) || /life total becomes/i.test(t) || /\b(destroy|exile) (all|target|up to)\b/i.test(t) || /\breturn (all|target|up to)\b[^.]*\bhand/i.test(t) || /reveal the top card of your library and put/i.test(t) };
// Text the parsed effects already take care of (so it doesn't count as "partly applied")
const coverStrip = (t, effs, name) => { const has = k => effs.some(f => f.k === k), self = String(name || "").split(" // ")[0].split(",")[0].replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return String(t).replace(/\bmill (?:a|an|one|two|three|four|five|six|\w+) cards?/gi, m => has("mill") ? "" : m).replace(/\bproliferate(?: twice)?/gi, m => has("prolif") ? "" : m)
    .replace(/\bdeals? \w+ damage to each (?:other )?(?:creature|planeswalker)[^.]*/gi, m => has("dmgAll") ? "" : m).replace(new RegExp(`\\buntap (?:this creature|it|${self})\\b`, "i"), m => has("untapSelf") ? "" : m)
    .replace(/that's a copy of (?:it|this creature)[^.]*/gi, m => has("selfCopies") ? "" : m).replace(/\breturn all land cards from your graveyard to the battlefield(?: tapped)?/gi, m => has("regrow") ? "" : m)
    .replace(/\buntap all [a-z ]+? you control/gi, m => has("untapAll") ? "" : m)
    .replace(/\b(?:they|it|those tokens|the tokens?) (?:each )?(?:have|has) "[^"]*"\.?/gi, m => has("tok") ? "" : m)
    .replace(/\bdraw (?:a|one|two|three) cards?, then discard (?:a|one|two) cards?/gi, m => has("loot") ? "" : m); }; // Spawning Bed: the Scions' own mana ability
const EXTRA_ACTIONS = /\b(draw|put|return|destroy|exile|deals?|search|mill|scry|surveil|copy|untap|tap|discard|attach|fight|counter target|proliferate|investigate|connive|explore|reveal)\b/i;

const IRRPL = { elves: "elf", dwarves: "dwarf", wolves: "wolf", werewolves: "werewolf", thieves: "thief", mice: "mouse", fungi: "fungus", leaves: "leaf", halves: "half", octopi: "octopus", sphinxes: "sphinx", foxes: "fox", lynxes: "lynx", allies: "ally", harpies: "harpy", mummies: "mummy", ponies: "pony", puppies: "puppy", dragonflies: "dragonfly", fireflies: "firefly", butterflies: "butterfly", flies: "fly", spies: "spy", deities: "deity", mercenaries: "mercenary", sentries: "sentry", emissaries: "emissary", fish: "fish", sheep: "sheep", heroes: "hero", plains: "plains", colorless: "colorless", geese: "goose", oxen: "ox", homunculi: "homunculus", homunculus: "homunculus", pegasi: "pegasus", pegasus: "pegasus", octopus: "octopus", platypus: "platypus", platypuses: "platypus", nautilus: "nautilus", nautiluses: "nautilus", walrus: "walrus", walruses: "walrus", fungus: "fungus", cyclops: "cyclops", cyclopes: "cyclops", aurochs: "aurochs", thalakos: "thalakos", astartes: "astartes", custodes: "custodes", chorus: "chorus", locus: "locus", loci: "locus", witches: "witch", sorceries: "sorcery", abilities: "ability", libraries: "library", enemies: "enemy", glasses: "glass", class: "class", classes: "class", bosses: "boss", princesses: "princess", ladies: "lady", babies: "baby", bunnies: "bunny", kitties: "kitty", puppy: "puppy" };
export const singular = w => IRRPL[String(w).toLowerCase()] || IRRPL[String(w).toLowerCase().split(" ").pop()] && String(w).replace(/\S+$/, m => IRRPL[m.toLowerCase()]) || String(w).replace(/s$/, "");
const splitTypes = phrase => phrase.toLowerCase().split(/\s+(?:and\/or|or|and)\s+|,\s*(?:and\/or\s+|or\s+)?/).map(t => singular(t.trim())).filter(Boolean);
// "• Mode Name — Effect text" lines that follow a "choose one —" ability
export function parseModes(lines, start, cardName) {
  const modes = [];
  for (let i = start; i < lines.length && /^\s*[•▪]/.test(lines[i]); i++) {
    const raw = lines[i].replace(/^\s*[•▪]\s*/, "").replace(/\([^)]*\)/g, "").trim();
    const nm = raw.match(/^([^—]{1,40}) — (.+)$/);
    const text = nm ? nm[2] : raw;
    const effs = parseEffects(text, cardName);
    const residual = text.replace(/\bcreate\b[^.]*?tokens?[^.]*\./gi, "").replace(/you (gain|lose) \w+ life\.?/gi, "").replace(/each opponent loses \w+ life\.?/gi, "");
    modes.push({ name: nm ? nm[1].trim() : "", text, effs, extra: /\w/.test(residual.replace(/[.\s]/g, "")) || NEEDS_PLAYER.test(text) });
  }
  return modes;
}

// ----- Removal: destroy / exile / return target (or all) permanents -----
// Target filter from a phrase like "artifact or enchantment an opponent controls", "nonland permanent", "creature with mana value 3 or less"
export function parseTargetFilter(phrase) {
  let p = phrase.toLowerCase().trim();
  const controller = /an opponent controls|you don't control|your opponents control|target opponent controls/.test(p) ? "opp" : /you control/.test(p) ? "you" : "any";
  p = p.replace(/\s*(an opponent controls|you don't control|your opponents control|target opponent controls|you control)\b.*$/, "");
  let mv = null;
  const mvm = p.match(/with (?:mana value|converted mana cost) (\d+) or (less|greater)/);
  if (mvm) { mv = { op: mvm[2] === "less" ? "<=" : ">=", val: Number(mvm[1]) }; p = p.replace(mvm[0], ""); }
  let pw = null;
  const pwm = p.match(/with (power|toughness) (\d+) or (less|greater)/);
  if (pwm) { pw = { stat: pwm[1], op: pwm[3] === "less" ? "<=" : ">=", val: Number(pwm[2]) }; p = p.replace(pwm[0], ""); }
  const tapState = /\buntapped\b/.test(p) ? "untapped" : /\btapped\b/.test(p) ? "tapped" : null;
  p = p.replace(/\b(tapped|untapped|attacking|blocking|other)\b/g, "").trim();
  const IRR = IRRPL || { elves: "elf", dwarves: "dwarf", wolves: "wolf", werewolves: "werewolf", thieves: "thief", mice: "mouse", fungi: "fungus", leaves: "leaf", halves: "half", octopi: "octopus", sphinxes: "sphinx", foxes: "fox", lynxes: "lynx", allies: "ally", harpies: "harpy", mummies: "mummy", ponies: "pony", puppies: "puppy", dragonflies: "dragonfly", fireflies: "firefly", butterflies: "butterfly", flies: "fly", spies: "spy", deities: "deity", mercenaries: "mercenary", sentries: "sentry", emissaries: "emissary", fish: "fish", sheep: "sheep", heroes: "hero", plains: "plains", colorless: "colorless", geese: "goose", oxen: "ox", homunculi: "homunculus", homunculus: "homunculus", pegasi: "pegasus", pegasus: "pegasus", octopus: "octopus", platypus: "platypus", platypuses: "platypus", nautilus: "nautilus", nautiluses: "nautilus", walrus: "walrus", walruses: "walrus", fungus: "fungus", cyclops: "cyclops", cyclopes: "cyclops", aurochs: "aurochs", thalakos: "thalakos", astartes: "astartes", custodes: "custodes", chorus: "chorus", locus: "locus", loci: "locus", witches: "witch", sorceries: "sorcery", abilities: "ability", libraries: "library", enemies: "enemy", glasses: "glass", class: "class", classes: "class", bosses: "boss", princesses: "princess", ladies: "lady", babies: "baby", bunnies: "bunny", kitties: "kitty", puppy: "puppy" };
  const alts = p.split(/,?\s+(?:and\/or|or|and)\s+|,\s*/).map(a => a.trim().split(/\s+/).filter(Boolean).map(w => IRR[w] || w.replace(/s$/, ""))).filter(a => a.length);
  return { alts, controller, mv, ...(pw ? { pw } : {}), ...(tapState ? { tapState } : {}) };
}
// Yavimaya, Cradle of Growth: "Each land is a Forest in addition to its other land types" (set by the app from the table)
let typeAdds = [];
export function setTypeAdds(list) { typeAdds = list || []; }
const withAdds = t => typeAdds.reduce((s, a) => new RegExp(`\\b${a.to}\\b`, "i").test(s) && !new RegExp(`\\b${a.add}\\b`, "i").test(s) ? `${s} ${a.add}` : s, t || "");
// Changeling (Taurean Mauler, Mirror Entity…): a creature with every creature type
const NOT_CREATURE_TYPE = new Set("artifact battle creature enchantment instant land planeswalker sorcery kindred tribal legendary basic snow world token nontoken permanent spell card other equipment aura vehicle saga forest island swamp mountain plains desert gate cave sphere food treasure clue blood map powerstone gold shrine curse class case role room background cartouche rune attraction lesson trap adventure arcane siege".split(" "));
export const isChangeling = e => /\bCreature\b/.test(e?.t || "") && (/^Changeling\b|\bis every creature type\b|\bhas all creature types\b/im.test(e?.o || "") || /\bchangeling\b/i.test(e?.desc || ""));
// Every creature type (MTGJSON CardTypes, MIT license, 2026-10-22): a changeling is these, not "Food" or "Town"
export const CREATURE_TYPES = new Set("Advisor|Aenar|Aetherborn|Alien|Ally|Andorian|Android|Angel|Antelope|Ape|Archer|Archon|Armadillo|Army|Artificer|Assassin|Assembly-Worker|Astartes|Atog|Aurochs|Automaton|Avatar|Azra|Badger|Balloon|Barbarian|Bard|Basilisk|Bat|Bear|Beast|Beaver|Beeble|Beholder|Berserker|Bird|Bison|Blinkmoth|Boar|Borg|Brainiac|Bringer|Brushwagg|C'tan|Caitian|Camarid|Camel|Capybara|Caribou|Carrier|Cat|Centaur|Chicken|Child|Chimera|Citizen|Cleric|Clown|Cockatrice|Construct|Coward|Coyote|Crab|Crocodile|Custodes|Cyberman|Cyclops|Dalek|Dauthi|Demigod|Demon|Denobulan|Deserter|Detective|Devil|Dinosaur|Djinn|Doctor|Dog|Dragon|Drake|Dreadnought|Drix|Drone|Druid|Dryad|Dwarf|Echidna|Efreet|Egg|El-Aurian|Elder|Eldrazi|Elemental|Elephant|Elf|Elk|Employee|Eternal|Eye|Faerie|Ferengi|Ferret|Fish|Flagbearer|Fox|Fractal|Frog|Fungus|Gamer|Gamma|Gargoyle|Germ|Giant|Giraffe|Gith|Glimmer|Gnoll|Gnome|Goat|Goblin|God|Golem|Gorgon|Gorn|Graveborn|Gremlin|Griffin|Guest|Hag|Halfling|Hamster|Harpy|Head|Hedgehog|Hellion|Hero|Hippo|Hippogriff|Homarid|Homunculus|Horror|Horse|Human|Hydra|Hyena|Illusion|Imp|Incarnation|Inhuman|Inkling|Inquisitor|Insect|Jackal|Jellyfish|Juggernaut|Kangaroo|Kavu|Kelpien|Kirin|Kithkin|Klingon|Knight|Kobold|Kor|Kraken|Kree|Kwejian|Lamia|Lammasu|Lanthanite|Leech|Lemur|Leviathan|Lhurgoyf|Licid|Lizard|Llama|Lobster|Manticore|Masticore|Medusan|Mercenary|Merfolk|Metathran|Minion|Minotaur|Missing|Mite|Mole|Monger|Mongoose|Monk|Monkey|Moogle|Moonfolk|Mount|Mouse|Mutant|Myr|Mystic|Naga|Nautilus|Necron|Nephilim|Nightmare|Nightstalker|Ninja|Noble|Noggle|Nomad|Nymph|Octopus|Officer|Ogre|Ooze|Orb|Orc|Orgg|Orion|Otter|Ouphe|Ox|Oyster|Pangolin|Peasant|Pegasus|Pentavite|Performer|Pest|Phelddagrif|Phoenix|Phyrexian|Pilot|Pincher|Pirate|Plant|Platypus|Porcupine|Possum|Praetor|Primarch|Prism|Processor|Q|Qu|Rabbit|Raccoon|Ranger|Rat|Rebel|Reflection|Reveler|Rhino|Rigger|Robot|Rogue|Rukh|Sable|Salamander|Samurai|Sand|Saproling|Satyr|Scarecrow|Scientist|Scion|Scorpion|Scout|Sculpture|Seal|Serf|Serpent|Servo|Shade|Shaman|Shapeshifter|Shark|Sheep|Shi'ar|Siren|Skeleton|Skrull|Skunk|Slith|Sliver|Sloth|Slug|Snail|Snake|Soldier|Soltari|Sorcerer|Spawn|Specter|Spellshaper|Sphinx|Spider|Spike|Spirit|Splinter|Sponge|Spy|Squid|Squirrel|Starfish|Surrakar|Survivor|Symbiote|Synth|Talosian|Teddy|Tellarite|Tentacle|Tetravite|Thalakos|Tholian|Thopter|Thrull|Tiefling|Time Lord|Tosk|Toy|Treefolk|Tribble|Trill|Trilobite|Triskelavite|Troll|Turtle|Tyranid|Unicorn|Urzan|Utrom|Vampire|Varmint|Vedalken|Villain|Volver|Vorta|Vulcan|Wall|Walrus|Warlock|Warrior|Weasel|Weird|Werewolf|Whale|Wizard|Wolf|Wolverine|Wombat|Worm|Wraith|Wurm|Xindi|Yeti|Zombie|Zubera".toLowerCase().split("|"));
export const changelingHas = (e, w) => { const raw = String(w || "").toLowerCase(), x = singular(raw); return !!x && (CREATURE_TYPES.has(x) || CREATURE_TYPES.has(raw) || CREATURE_TYPES.has(raw.replace(/es$/, ""))) && !NOT_CREATURE_TYPE.has(x) && !COLOR_LETTER[x] && isChangeling(e); };
const reEsc = x => String(x).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
export function permanentMatches(e, f) {
  const t = withAdds(e.t || "");
  const ok = w => w === "permanent" ? true
    : w === "historic" ? /\b(Artifact|Legendary|Saga)\b/.test(t)
    : !w.startsWith("non") && changelingHas(e, w) ? true
    : w.startsWith("non") ? !new RegExp(`\\b${reEsc(w.slice(3).replace(/^-/, ""))}`, "i").test(t)
    : COLOR_LETTER[w] ? new RegExp(`\\{[^}]*${COLOR_LETTER[w]}`).test(e.m || "")
    : new RegExp(`\\b${reEsc(w)}`, "i").test(t);
  if (f.alts.length && !f.alts.some(a => a.every(ok))) return false;
  if (f.mv) { const v = manaValue(e.m); if (f.mv.op === "<=" ? v > f.mv.val : v < f.mv.val) return false; }
  if (f.tapState && !!e.tap !== (f.tapState === "tapped")) return false;
  if (f.pw) { const ctr = (e.c?.p1p1 || 0) - (e.c?.m1m1 || 0), v = (Number(f.pw.stat === "power" ? e.p : e.tg) || 0) + ctr; if (f.pw.op === "<=" ? v > f.pw.val : v < f.pw.val) return false; }
  return true;
}
export function parseRemoval(text) {
  const cw = text.match(/\bthe owner of target ([a-z ]+?) shuffles it into their library/i);
  if (cw) return { k: "remove", how: "tuck", n: 1, what: cw[1].trim(), filter: parseTargetFilter(cw[1]), rider: /reveals the top card of their library\. if it's a permanent card, they put it onto the battlefield/i.test(text) ? "chaoswarp" : "" };
  // Gaining control: "gain control of target creature until end of turn", Insurrection, Hostage Taker
  let g = text.match(/\buntap all ([a-z ]+?) and gain control of them( until end of turn)?/i);
  if (g) return { k: "remove", how: "steal", all: true, what: g[1].trim(), filter: { ...parseTargetFilter(g[1]), controller: "opp" }, until: g[2] ? "eot" : null, untap: true };
  g = text.match(/\bgain control of all ([^.]+?)( until end of turn)?(?:\.|$)/i);
  if (g) return { k: "remove", how: "steal", all: true, what: g[1].trim(), filter: { ...parseTargetFilter(g[1]), controller: "opp" }, until: g[2] ? "eot" : null, untap: /\buntap\b/i.test(text) };
  g = text.match(/\bgain control of (up to one |another )?target ([^.]*?)(?: for as long as [^.]*?| until end of turn)?(?:\.|$| and |,)/i);
  if (g) {
    const f = parseTargetFilter(g[2]);
    return { k: "remove", how: "steal", n: 1, upTo: !!g[1], what: g[2].replace(/\s*(an opponent controls|you don't control)$/i, "").trim(), filter: { ...f, controller: f.controller === "any" ? "opp" : f.controller },
      until: /gain control of[^.]*until end of turn/i.test(text) ? "eot" : null, untap: /\buntap (that creature|it|that permanent)\b/i.test(text), haste: /gains? haste/i.test(text), rider: "" };
  }
  g = text.match(/\b(up to (one|two|three) |any number of )?(?:other )?target ([^.]+?) phases? out\b/i);
  if (g) return { k: "remove", how: "phase", n: g[1] && /any number/i.test(g[1]) ? 10 : num(g[2]) || 1, upTo: !!g[1], what: g[3].trim(), filter: parseTargetFilter(g[3]), rider: "" };
  g = text.match(/\btarget ([^.]+?)\.\s*(?:it|that creature|that permanent) phases out\b/i);
  if (g) {
    const pc = text.match(/put (a|an|one|two|three|\d+) ([+−-]\d+\/[+−-]\d+|[a-z]+) counters? on target/i);
    return { k: "remove", how: "phase", n: 1, what: g[1].replace(/^.*\bon target /i, "").trim(), filter: parseTargetFilter(g[1].replace(/^.*\bon target /i, "")), rider: "",
      ...(pc ? { counters: { key: counterKey(pc[2]), n: num(pc[1]) || 1, label: pc[2] } } : {}) };
  }
  g = text.match(/\bexile (another )?target ([^.]+?) until [^.]+?\.\s*you may cast that card/i);
  if (g) return { k: "remove", how: "exile", n: 1, what: g[2].trim(), filter: parseTargetFilter(g[2]), rider: "", stealPlay: true, hold: true };
  // "destroy target …", "exile up to two target …", "return target … to its owner's hand"
  let m = text.match(/\b(destroy|exile|return) (up to (one|two|three|four|five) |(one|two|three) )?(?:other )?(?:another )?target ([^.]*?)(?: to (?:its|their) owners?'s? hands?)?(?:\.|;|$| and | then )/i);
  if (m && !/\bcards?\b/i.test(m[5]) && !/from (a|your|their|an opponent's) graveyard/i.test(m[5]) && !/\bspell\b/i.test(m[5])) {
    const how = m[1].toLowerCase() === "return" ? "bounce" : m[1].toLowerCase();
    const n = num(m[3] || m[4]) || 1;
    const rider = (text.match(/\bits controller ([^.]+)\./i) || [])[1] || (text.match(/\bthat player (may search [^.]+)\./i) || [])[1] || "";
    const hold = how === "exile" && (/until [^.]*leaves the battlefield/i.test(text) || /leaves the battlefield, return the exiled (card|permanent)/i.test(text));
    return { k: "remove", how, n, upTo: !!m[3], what: m[5].replace(/\s+until .*$/i, "").trim(), filter: parseTargetFilter(m[5]), rider, ...(hold ? { hold: true } : {}), ...(/\b(another|other) target/i.test(m[0]) ? { another: true } : {}) };
  }
  // "destroy all creatures", "exile all nonland permanents", "destroy all artifacts and enchantments"
  m = text.match(/\b(destroy|exile|return) (?:all|each) ([^.]*?)(?: to (?:their|its) owners?'s? hands?)?(?:\.|$)/i);
  if (m && !/\bcards?\b/i.test(m[2]) && !/graveyard/i.test(m[2])) {
    const how = m[1].toLowerCase() === "return" ? "bounce" : m[1].toLowerCase();
    return { k: "remove", how, all: true, what: m[2].trim(), filter: parseTargetFilter(m[2]) };
  }
  return null;
}

// ----- "That player may …" choices handed to an opponent -----
export function parsePunisher(text, cardName) {
  let m = text.match(/^(.*?)\s*unless that player pays ((?:\{[^}]+\})+)(?:, where x is ([^.]+))?\.?$/i);
  if (m) return { xIs: m[3] || "", ask: `Pay ${m[2]}`, askNo: "Don't pay", elseText: m[1].replace(/^you may /i, "").trim(), elseEffs: parseEffects(m[1], cardName), doText: "", doEffs: [] };
  m = text.match(/^that player may ([^.]+)\.\s*(?:if (?:they|that player|the player|he or she) (do|does|don't|doesn't|do not|does not)\b,?\s*([^.]+)\.?)?\s*(?:if (?:they|that player|the player) (do|does|don't|doesn't|do not|does not)\b,?\s*([^.]+)\.?)?/i);
  if (!m) return null;
  const out = { ask: m[1].replace(/^\w/, x => x.toUpperCase()), askNo: "Don't", elseText: "", elseEffs: [], doText: "", doEffs: [] };
  [[m[2], m[3]], [m[4], m[5]]].forEach(([w, t]) => {
    if (!w || !t) return;
    if (/n't|not/.test(w)) { out.elseText = t; out.elseEffs = parseEffects(t, cardName); }
    else { out.doText = t; out.doEffs = parseEffects(t, cardName); }
  });
  return out;
}

// ----- Tutors / land searches -----
// Mana value from a cost like "{2}{G}{G}" (X counts as 0, hybrid as 1)
// Life-gain replacements on the gaining player's board: "gain that much life plus 1" (Cleric Class, Angel of Vitality) and "twice that much"
// (Rhox Faithmender, Boon Reflection, Alhammarret's Archive). The +1s go first, then the doublings (the best order for the player).
export function gainAdj(p, n, lookup) {
  if (!(n > 0)) return { n, why: "" };
  let plus = 0, dbl = 0; const src = [];
  Object.values(p?.bf || {}).forEach(x => { const o = String(x.o || lookup?.(x.n)?.o || "");
    if (/^If you would gain life, you gain that much life plus 1 instead\.?$/m.test(o)) { plus++; src.push(x.n); }
    if (/^If you would gain life, you gain twice that much life instead\.?$/m.test(o)) { dbl++; src.push(x.n); } });
  if (!plus && !dbl) return { n, why: "" };
  const out = (n + plus) * 2 ** dbl;
  return { n: out, why: ` (${n} → ${out}: ${[...new Set(src)].join(", ")})` };
}
export function manaValue(m) {
  return (String(m || "").split(" // ")[0].match(/\{[^}]+\}/g) || []).reduce((a, sym) => {
    const x = sym.slice(1, -1);
    if (/^\d+$/.test(x)) return a + Number(x);
    if (/^[XYZ]$/i.test(x)) return a;
    const h = x.match(/^(\d+)\//);
    return a + (h ? Number(h[1]) : 1);
  }, 0);
}
const COLOR_LETTER = { white: "W", blue: "U", black: "B", red: "R", green: "G" };
// "Search your library for … card(s) …, put it into your hand / onto the battlefield / on top / into your graveyard"
export function parseSearch(text) {
  let m = text.match(/search your library for (up to )?(a|an|one|two|three|four|five|x|\d+) ([^.]*?)\bcards?\b([^.]*?)(?:,| and)\s*([^.]*?)\bput (it|them|that card|those cards|the card|one(?: of them)?) (into your hand|onto the battlefield(?: tapped)?|on top of your library|into your graveyard)/i);
  let dest, n, desc, qual, between = "";
  if (m) {
    dest = /hand/i.test(m[7]) ? "hand" : /battlefield/i.test(m[7]) ? "battlefield" : /top/i.test(m[7]) ? "top" : "graveyard";
    n = /^one/i.test(m[6]) ? 1 : m[2].toLowerCase() === "x" ? "X" : num(m[2]);
    desc = m[3]; qual = m[4]; between = m[5];
  } else {
    // Vampiric / Worldly Tutor: "…, then shuffle and put that card on top"
    m = text.match(/search your library for (a|an) ([^.]*?)\bcard\b([^.]*?),\s*([^.]*?)then shuffle(?: your library)?,? and put (?:that card|it|the card) on top/i);
    if (!m) return null;
    dest = "top"; n = 1; desc = m[2]; qual = m[3]; between = m[4];
  }
  desc = desc.trim();
  const words = desc.toLowerCase().replace(/\bcard\b/g, "").trim();
  const alts = words ? words.split(/,?\s+or\s+|,\s*/).map(a => a.trim().split(/\s+/).filter(Boolean)).filter(a => a.length) : [];
  // shared leading adjectives ("basic Forest or Plains", "green creature or land") apply to every alternative
  let mv = null;
  const q = (qual || "").toLowerCase();
  const mvm = q.match(/(?:mana value|converted mana cost) (less than or equal to|equal to|greater than or equal to|of)?\s*([^,.]*)/);
  if (mvm) {
    let rest = mvm[2].trim();
    let op = /less than or equal/.test(mvm[1] || "") || /or less/.test(rest) ? "<=" : /greater/.test(mvm[1] || "") || /or greater/.test(rest) ? ">=" : "=";
    rest = rest.replace(/\s*or (less|greater)$/, "");
    const lit = num(rest.split(/\s+/)[0]);
    const cnt = rest.match(/the number of ([a-z ,/]+?) you control/);
    mv = lit != null && !/plus|minus/.test(rest) ? { op, val: lit }
      : cnt ? { op, count: splitTypes(cnt[1]) }
      : { op, ask: true, hint: rest.replace(/^x\b/, "X") || "X" };
  }
  // Urza's Saga: "an artifact card with mana cost {0} or {1}"
  const mc = !mv && `${q} ${text}`.match(/with mana cost \{(\d+)\}(?: or \{(\d+)\})?/i);
  if (mc) mv = { op: "<=", val: Math.max(Number(mc[1]), Number(mc[2] ?? mc[1])) };
  return {
    k: "fetch", n, desc: (desc || "card") + (/cards? that share a land type/i.test(text) ? " (sharing a land type)" : ""), alts, mv, dest,
    ...(/cards? that share a land type/i.test(text) ? { share: true } : {}),
    tapped: /onto the battlefield tapped/i.test(text), reveal: /\breveal/i.test(between) || /\breveal/i.test(q),
    shuffle: /\bshuffle/i.test(text), other: /the other into your hand/i.test(text),
  };
}
// Does a deck card fit a search? x = chosen/known value for "X" mana value rules
export function matchesSearch(c, f, x) {
  const t = c.t || "";
  const okWord = w => {
    if (w === "basic") return /\bBasic\b/.test(t);
    if (COLOR_LETTER[w]) return new RegExp(`\\{[^}]*${COLOR_LETTER[w]}[^}]*\\}`).test(c.m || "");
    if (w === "colorless") return !/[WUBRG]/.test(c.m || "") && !/\bLand\b/.test(t);
    if (w.startsWith("non")) return !new RegExp(`\\b${w.slice(3).replace(/^-/, "")}`, "i").test(t);
    if (w === "permanent") return !/\b(Instant|Sorcery)\b/.test(t);
    return new RegExp(`\\b${singular(w)}`, "i").test(t);
  };
  if (f.alts?.length) {
    // leading words shared by the first alternative ("basic land", "green creature") apply to all
    const first = f.alts[0];
    const shared = f.alts.length > 1 ? first.slice(0, -1) : [];
    if (!f.alts.some(a => [...(a.length === 1 ? shared : []), ...a].every(okWord))) return false;
  }
  if (f.mv) {
    const v = f.mv.val ?? x;
    if (v == null) return true;
    const mv = /\bLand\b/.test(t) && !c.m ? 0 : manaValue(c.m);
    if (f.mv.op === "<=" && !(mv <= v)) return false;
    if (f.mv.op === ">=" && !(mv >= v)) return false;
    if (f.mv.op === "=" && mv !== v) return false;
  }
  return true;
}

const KNOWN_COUNTERS = ["loyalty", "charge", "shield", "stun", "oil", "lore", "time"];
const counterKey = w => {
  const t = String(w).toLowerCase().replace("−", "-");
  if (t === "+1/+1") return "p1p1";
  if (t === "-1/-1") return "m1m1";
  return KNOWN_COUNTERS.includes(t) ? t : "x_" + slug(t);
};

function parseEffects(text, cardName = "") {
  if (!/"[^"]+"/.test(text)) return parseEffects0(text, cardName);
  const full = parseEffects0(text, cardName), keep = new Set(parseEffects0(text.replace(/\s*"(?!when this (?:token|creature) enters\b)[^"]*"/gi, ""), cardName).map(f => f.k)); // a token's own "When this token enters, …" happens right away (Roxanne's Meteorite)
  return full.filter(f => keep.has(f.k) || /^(tok|tokCopy|tplayerTok|oppsTok|amass|selfCopies|copyCreature)$/.test(f.k)); // Pest's "When this token dies, you gain 1 life" is the token's, not this effect's
}
function parseEffects0(text, cardName = "") {
  // Ferocious — "If you control a creature with power 4 or greater, …": those effects only happen then
  const fero = String(text).match(/ferocious — if you control a creature with power 4 or greater, ([^\n]+)/i);
  if (fero) return [...parseEffects(text.replace(fero[0], ""), cardName), ...parseEffects(fero[1], cardName).map(f => ({ ...f, fero: true }))];
  const effs = [];
  const short = cardName.split("#")[0].split(" // ")[0].split(",")[0];
  // Chitterspitter: "you may sacrifice a token. If you do, put an acorn counter on this artifact."
  const sth = text.match(/^(?:you may )?sacrifice (a|an|another) ([a-z ]+?)\. if you do, (.+)$/i);
  if (sth) return [{ k: "sacThen", what: sth[2].trim(), then: parseEffects(sth[3], cardName), thenText: sth[3] }];
  // Forage: "you may forage. If you do, draw a card." (exile three cards from your graveyard or sacrifice a Food)
  const fgo = text.match(/^(?:you may )?forage\. if you do, (.+)$/i);
  if (fgo) return [{ k: "sacThen", what: "forage", then: parseEffects(fgo[1], cardName), thenText: fgo[1] }];
  // Mill: "Mill four cards", "target player mills three cards", "each opponent mills …"; Cache Grab picks one of them for your hand
  const mil = text.match(/(?:^|\. |, then |and )(?:(you|target player|target opponent|each player|each opponent) )?mills? (a|one|two|three|four|five|six|seven|eight|nine|ten|x|\d+) cards?/i);
  if (mil) {
    const f = { k: "mill", who: (mil[1] || "you").toLowerCase(), n: /^x$/i.test(mil[2]) ? "X" : num(mil[2]) || 1 };
    const pk = text.match(/you may put an? ([a-z ]*?)card from among (?:the )?cards milled this way into your hand/i);
    if (pk) f.pick = pk[1].trim() || "card";
    const sq = text.match(/[Ii]f you control an? ([A-Z][a-z]+) or returned an? \1 card to your hand this way, create an? ([A-Z][a-z]+) token/);
    if (sq) { f.ifType = sq[1]; f.ifTok = sq[2]; return [f]; } // the token is conditional, so it's handled with the pick
    effs.push(f);
  }
  // "put a charge counter on this enchantment", "put two +1/+1 counters on <name>"
  const selfRe = new RegExp(`put (a|an|one|two|three|four|five|\\d+) ([+−-]?\\d+/[+−-]?\\d+|[a-z]+) counters? on (?:it|this|${short.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})\\b`, "i");
  const hm = text.match(/\badd ((?:\{[^}]+\})+) for each card in (target opponent's|target player's|an opponent's) hand/i);
  if (hm) effs.push({ k: "handmana", syms: hm[1] });
  const mm = !hm && text.match(new RegExp(`\\badd ((?:\\{[^}]+\\})+)(?: for each ([+−-]?\\d+/[+−-]?\\d+|[a-z]+) counters? on (?:this|${short.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})[^.]*)?`, "i"));
  // Recursion: "return target creature card from your graveyard to your hand", "return all land cards from your graveyard to the battlefield tapped"
  const rgMv = text.match(/\breturn target ([a-z ]+?) card with mana value (\d+|x) or less from your graveyard to (your hand|the battlefield)/i);
  if (rgMv) effs.push({ k: "regrow", n: 1, what: rgMv[1], filter: { ...parseTargetFilter(rgMv[1]), mv: /^x$/i.test(rgMv[2]) ? { op: "<=", val: "X" } : { op: "<=", val: Number(rgMv[2]) } }, dest: /hand/i.test(rgMv[3]) ? "hand" : "battlefield" });
  // Victimize: "Choose two target creature cards in your graveyard. Sacrifice a creature. If you do, return the chosen cards to the battlefield tapped."
  const vic = text.match(/choose (two|three) target ([a-z ]+?) cards in your graveyard\. sacrifice an? ([a-z]+)\. if you do, return the chosen cards to the battlefield( tapped)?/i);
  if (vic) effs.push({ k: "victimize", n: num(vic[1]), what: vic[2], filter: parseTargetFilter(vic[2]), sacWhat: vic[3], sacFilter: parseTargetFilter(vic[3]), tapped: !!vic[4] });
  // Prepared: "this creature becomes prepared" (unconditional ones only; Stensian's "that creature deals combat damage" is tracked by the app)
  const prepS = text.match(/(?:^|[.,] )(?:then )?(?:this creature|it|[A-Z][^.,]*?) becomes prepared\b/);
  if (prepS && !/whenever that creature deals combat damage/i.test(text) && !/each creature you control becomes prepared|target creature[^.]* becomes prepared/i.test(text)
    && (!/\bif\b/i.test(text.split(/becomes prepared/i)[0].split(/[.]/).pop()) || /if this creature isn't prepared/i.test(text))) effs.push({ k: "prepSelf" });
  // Profane Command / Vampire Hexmage / Gray Merchant / Sanguine Bond
  if (/^target player loses x life\.?$/i.test(text.trim())) effs.push({ k: "tloseX" });
  const fxg = text.match(/^up to x target creatures gain ([a-z]+) until end of turn/i);
  if (fxg) effs.push({ k: "pumpTarget", n: "X", what: "creature", filter: parseTargetFilter("creature"), dp: "+0", dt: "+0", kws: [fxg[1].toLowerCase()] });
  if (/remove all counters from target permanent/i.test(text)) effs.push({ k: "clearCtrs" });
  const gm = text.match(/each opponent loses x life, where x is your devotion to (white|blue|black|red|green)\. you gain life equal to the life lost this way/i);
  if (gm) effs.push({ k: "drainDevo", color: { white: "W", blue: "U", black: "B", red: "R", green: "G" }[gm[1].toLowerCase()] });
  if (/^target opponent loses that much life\.?$/i.test(text.trim())) effs.push({ k: "oppLoseThat" });
  const rg = !rgMv && !vic && text.match(/\b(?:return|put) (up to (one|two|three|four|five) |(one|two|three) )?(?:another )?target ([^.]*?)\bcards? from (your|a|an opponent's) graveyard (?:to|onto|into|on top of) (your hand|the battlefield|the top of your library|your library)( tapped)?/i);
  const rga = !rg && text.match(/\breturn all ([^.]*?)\bcards? from your graveyard to (your hand|the battlefield)( tapped)?/i);
  if (rg) effs.push({ k: "regrow", n: num(rg[2] || rg[3]) || 1, upTo: !!rg[1], what: rg[4].trim() || "card", filter: parseTargetFilter(rg[4].trim() || "permanent"),
    any: rg[5].toLowerCase() !== "your", dest: /hand/i.test(rg[6]) ? "hand" : /battlefield/i.test(rg[6]) ? "battlefield" : "top", tapped: !!rg[7] });
  else if (/return enchanted creature card to the battlefield/i.test(text)) effs.push({ k: "regrow", n: 1, what: "creature", filter: parseTargetFilter("creature"), any: true, dest: "battlefield" });
  else if (rga) effs.push({ k: "regrow", all: true, what: rga[1].trim() || "card", filter: parseTargetFilter(rga[1].trim() || "permanent"), dest: /hand/i.test(rga[2]) ? "hand" : "battlefield", tapped: !!rga[3], mill: /\bmill\b/i.test(text) });
  // Impulse draw: "exile the top three cards of your library. You may play them this turn."
  const ip = text.match(/\bexile the top (?:(a|an|one|two|three|four|five|six|seven|x|\d+) )?cards? of your library/i);
  if (ip && /you may (?:play|cast) (?:it|that card|them|those cards|those)\b|until[^.]*?you may (?:play|cast)/i.test(text))
    effs.push({ k: "impulse", n: ip[1] && !/^x$/i.test(ip[1]) ? num(ip[1]) : ip[1] ? "X" : 1, next: /next turn|next end step|until the end of your next/i.test(text), ...(/choose one of them/i.test(text) ? { choose: 1 } : {}) });
  // Counters on each creature: Cathars' Crusade, Oran-Rief ("each green creature that entered this turn")
  const ceList = text.match(/\bput (a|an|one|two|three|\d+) ([+−-]\d+\/[+−-]\d+|[a-z]+) counters? on each ([a-z, ]+? (?:and\/or|or) [a-z ]+?) you control( that entered (?:the battlefield )?this turn)?\b/i);
  const ce = !ceList && text.match(/\bput (a|an|one|two|three|x|\d+) ([+−-]\d+\/[+−-]\d+|[a-z]+) counters? on each (other )?([a-z ]*?(?:creature|permanent|artifact|token))s?( you control)?( that entered (?:the battlefield )?this turn)?\b/i);
  const ce2 = !ce && (ceList || text.match(/\bput (a|an|one|two|three|\d+) ([+−-]\d+\/[+−-]\d+|[a-z]+) counters? on each ([a-z, ]+?) you control( that entered (?:the battlefield )?this turn)?(?:\.|$)/i));
  if (ce2) effs.push({ k: "countersEach", n: num(ce2[1]) || 1, key: counterKey(ce2[2]), label: ce2[2], other: false, what: ce2[3], filter: { ...parseTargetFilter(ce2[3].replace(/,?\s+(?:and\/)?or\s+/g, ", ")), controller: "you" }, entered: !!ce2[4], everyone: false });
  if (ce) { const opp = !ce[5] && /^\s*(?:your opponents control|an opponent controls|you don't control|each opponent controls)\b/i.test(text.slice(ce.index + ce[0].length)); // Archfiend of Ifnir: not yours
    effs.push({ k: "countersEach", n: /^x$/i.test(ce[1]) ? "X" : num(ce[1]) || 1, key: counterKey(ce[2]), label: ce[2], other: !!ce[3], what: ce[4], filter: parseTargetFilter(ce[4]), entered: !!ce[6], everyone: !ce[5], ...(opp ? { oppsOnly: true } : {}) }); }
  if (/\bproliferate\b/i.test(text)) effs.push({ k: "prolif" });
  // Counters on a target: "put two +1/+1 counters on target creature", "distribute two +1/+1 counters among one or two target creatures you control"
  const dc = text.match(/\bdistribute (two|three|four|five|\d+) ([+−-]\d+\/[+−-]\d+|[a-z]+) counters among [^.]*?target ([a-z ]+?)s?( you control)?(?:\.|$)/i);
  const ct = !dc && !/phases? out/i.test(text) && text.match(/\bput (a|an|one|two|three|\d+) ([+−-]\d+\/[+−-]\d+|[a-z]+) counters? on (?:up to one )?(?:another )?target ([a-z ]+?)( you control)?(?:\.|$|,| and)/i);
  const eu = !dc && text.match(/\bput (a|an|one|two) ([+−-]\d+\/[+−-]\d+|[a-z]+) counters? on each of up to (two|three|four) target ([a-z ]+?)s?( you control)?(?:\.|$)/i);
  if (eu) effs.push({ k: "countersTarget", n: 1, total: num(eu[3]) * (num(eu[1]) || 1), key: counterKey(eu[2]), label: eu[2], what: eu[4], filter: { ...parseTargetFilter(eu[4]), ...(eu[5] ? { controller: "you" } : {}) } });
  else if (dc) effs.push({ k: "countersTarget", n: 1, total: num(dc[1]), key: counterKey(dc[2]), label: dc[2], what: dc[3], filter: { ...parseTargetFilter(dc[3]), ...(dc[4] ? { controller: "you" } : {}) } });
  else if (ct) effs.push({ k: "countersTarget", n: num(ct[1]) || 1, key: counterKey(ct[2]), label: ct[2], what: ct[3], filter: { ...parseTargetFilter(ct[3]), ...(ct[4] ? { controller: "you" } : {}) } });
  if (/\bcreate X tokens that are copies of target token you control\b/i.test(text)) effs.push({ k: "tokCopy", n: "X" }); // For the Common Good
  if (/\bcreate a token that's a copy of target token you control\b/i.test(text)) { const tw = text.match(/if that token is an? ([a-z]+), instead create two tokens/i); effs.push({ k: "tokCopy", ...(tw ? { twoIf: tw[1].toLowerCase() } : {}) }); }
  // Hazel's Brewmaster: "exile up to one target card from a graveyard"
  if (/\bexile up to one target card from a graveyard\b/i.test(text)) effs.push({ k: "gyOne", upTo: true });
  // Valley Rotcaller: "each opponent loses X life and you gain X life, where X is the number of other Squirrels, Bats, Lizards, and Rats you control"
  const dcx = text.match(/each opponent loses x life and you gain x life, where x is the number of (other )?([a-z, ]+?) you control/i);
  if (dcx) effs.push({ k: "drainCount", other: !!dcx[1], types: splitTypes(dcx[2].replace(/,?\s+and\s+/g, ", ")) });
  if (/\bfor each token you control, create a token that's a copy of that permanent\b/i.test(text)) effs.push({ k: "copyAllTokens" });
  { const ss = text.match(/^create (?:a|an|one) ([^.]+?) creature token\. if you control (\w+) or more lands, create a token that's a copy of (?:this creature|it) instead\.?$/i); // Scute Swarm
    if (ss) return [{ k: "scute", lands: num(ss[2]) || Number(ss[2]), name: capName(ss[1]) || "Insect", desc: ss[1] }]; }
  { const dm = text.trim().match(/^double the number of \+1\/\+1 counters on (.+?)\.?$/i), on = dm?.[1] || "";
    if (dm && (/^(?:it|this creature|him|her)$/i.test(on) || (/^[A-Z]/.test(on) && !/^(?:each|all|target|another|up to|that)\b/i.test(on)))) return [{ k: "dblCtrSelf", key: "p1p1" }]; // Mossborn Hydra
    if (dm && /^each (.+?) you control$/i.test(on)) return [{ k: "dblCtrAll", key: "p1p1", filter: parseTargetFilter(on.replace(/^each /i, "").replace(/ you control$/i, "")) }]; // Kalonian Hydra, Bristly Bill
    if (/double the number of/i.test(text)) return []; } // other doubling (a target, "each kind of counter"): left to the player, so a partial result never goes through on its own
  { const sc = text.match(/\bcreate (a|one|two|three) tokens? that(?:'s| is| are) (?:a )?cop(?:y|ies) of (?:it|them|this creature)\b(, except (?:it|they|the tokens?) (?:isn't|aren't) legendary)?/i); if (sc && !/target/i.test(text.slice(0, sc.index + sc[0].length))) effs.push({ k: "selfCopies", n: num(sc[1]) || 1, nonleg: !!sc[2] }); }
  // Until end of turn: Overrun / Craterhoof ("creatures you control gain trample and get +X/+X until end of turn, where X is …"), Golgari Charm ("all creatures get -1/-1")
  // Overwhelming Stampede puts "until end of turn" first: "Until end of turn, creatures you control gain trample and get +X/+X, where X is …"
  const ptext = text.replace(/until end of turn, ((?:all |other )?creatures[^.]*?)(,? where x is [^.]*)?(\.|$)/i, "$1 until end of turn$2$3");
  const pa = ptext.match(/\b(all |other |[A-Z][a-z]+ )?creatures( you control)? (?:gain ([a-z ,]+?) and )?get ([+−-](?:\d+|x))\/([+−-](?:\d+|x))(?: and gain ([a-z ,]+?))? until end of turn(?:,? where x is (?:the number of ([a-z ]+?)(?: you control)?|(the greatest power among creatures you control))(?:\.|$|,))?(?: for each ([A-Za-z ]+?) you control)?/i);
  const ptype = pa && pa[1] && !/^(all|other) $/i.test(pa[1]) && !/^(until|those|target|each)/i.test(pa[1]) ? pa[1].trim().toLowerCase() : null; // Squirrel Wrangler: "Squirrel creatures get +1/+1"
  if (pa) effs.push({ k: "pumpAll", everyone: !pa[2], other: /other/i.test(pa[1] || ""), ...(ptype ? { type: ptype } : {}), dp: pa[4], dt: pa[5], kws: splitKws([pa[3], pa[6]].filter(Boolean).join(", ")), xCount: pa[7] ? pa[7].trim() : null, ...(pa[8] ? { xGreatest: true } : {}), ...(pa[9] ? { perEach: pa[9].trim() } : {}) });
  // "creatures you control gain haste until end of turn"; Song of Freyalise: "Those creatures gain vigilance, trample, and indestructible until end of turn"
  const pk = !pa && (ptext.match(/\b(all |other |those )?creatures( you control)? gain ([a-z0-9 ,]+?) until end of turn/i) || (() => { const x = ptext.match(/\beach (other )?creature( you control)? gains ([a-z0-9 ,]+?) until end of turn/i); return x ? [x[0], x[1] ? "other " : "", x[2], x[3]] : null; })());
  if (pk && splitKws(pk[3]).length) effs.push({ k: "pumpAll", everyone: !pk[2] && !/those/i.test(pk[1] || ""), other: /other/i.test(pk[1] || ""), dp: "+0", dt: "+0", kws: splitKws(pk[3]), xCount: null });
  // Giant Growth: "target creature gets +3/+3 until end of turn", "target creature gains flying until end of turn"
  const pt = text.match(/\b(?:up to one )?target ([a-z ]*?creature)( you control)? (?:gets ([+−-](?:\d+|x))\/([+−-](?:\d+|x))(?: and gains ([a-z ,]+?))?|gains ([a-z ,]+?)) until end of turn/i);
  const nb = !pt && text.match(/\btarget ([a-z ]*?creature) can't block this turn/i);
  if (nb) effs.push({ k: "pumpTarget", what: nb[1], filter: parseTargetFilter(nb[1]), dp: "+0", dt: "+0", kws: ["can't block"] });
  const tpd = !/damage to any target/i.test(text) && text.match(/deals (\d+|one|two|three|four|five) damage to target (player|opponent)(?! or)/i);
  if (tpd) effs.push({ k: "ping", n: num(tpd[1]) || 1, playerOnly: true });
  // Price of Progress: "deals damage to each player equal to twice the number of nonbasic lands that player controls"
  const pp = text.match(/deals damage to each (player|opponent) equal to (twice )?the number of ([a-z ]+?) (?:that player|they) controls?/i);
  if (pp) effs.push({ k: "dmgPer", who: pp[1].toLowerCase(), mult: pp[2] ? 2 : 1, what: pp[3], filter: parseTargetFilter(pp[3]) });
  if (pt) effs.push({ k: "pumpTarget", what: pt[1], filter: { ...parseTargetFilter(pt[1]), controller: pt[2] ? "you" : "any" }, dp: pt[3] || "+0", dt: pt[4] || "+0", kws: splitKws(pt[5] || pt[6] || "") });
  { const ep = text.match(/\beach player creates (a|an|one|two|three|\d+) ([^.]+?) tokens?\b/i);
    if (ep) { const n = num(ep[1]) || 1, desc = ep[2].replace(/\btapped\s+/i, "").replace(/\s+creature$/i, " creature").trim(), tap = /\btapped\b/i.test(ep[2]);
      effs.push({ k: "tok", n, name: capName(ep[2]) || "Token", desc, tapped: tap }, { k: "oppsTok", n, name: capName(ep[2]) || "Token", desc, ...(tap ? { tapped: true } : {}) }); } }
  const eo = text.match(/\beach opponent creates (a|an|one|two|three|\d+) ([^.]+?) tokens?\b/i);
  if (eo) effs.push({ k: "oppsTok", n: num(eo[1]) || 1, name: capName(eo[2]) || "Token", desc: eo[2].replace(/\btapped\s+/i, "").trim(), ...(/\btapped\b/i.test(eo[2]) ? { tapped: true } : {}) });
  // Dark Confidant / Twilight Prophet: reveal the top card, put it into your hand, life by its mana value
  const rmv = text.match(/reveal the top card of your library and put (?:it|that card) into your hand\. (you lose life equal to its mana value|each opponent loses x life and you gain x life, where x is that card's mana value)/i);
  if (rmv && !/repeat this process/i.test(text)) effs.push({ k: "revealMv", mode: /^you lose/i.test(rmv[1]) ? "lose" : "drain" });
  // Blade of the Bloodchief: counters go on the equipped creature
  const eqc = text.match(/put (a|an|one|two|three|\d+) \+1\/\+1 counters? on equipped creature(?:\. if equipped creature is an? ([a-z]+), put (two|three|\d+) \+1\/\+1 counters on it instead)?/i);
  if (eqc) effs.push({ k: "eqCtr", n: num(eqc[1]) || 1, ...(eqc[2] ? { typ: eqc[2], n2: num(eqc[3]) } : {}) });
  // Strata Scythe: "search your library for a land card, exile it" (imprint)
  const imL = text.match(/search your library for an? ([a-z ]+?) card, exile it/i);
  if (imL) effs.push({ k: "imprintLib", what: imL[1] });
  // Rogue's Passage: "Target creature can't be blocked this turn."
  { const ub = text.trim().match(/^target ([a-z ]*?creature) can't be blocked this turn\.?$/i); if (ub) effs.push({ k: "pumpTarget", what: ub[1], filter: parseTargetFilter(ub[1]), dp: "+0", dt: "+0", kws: ["can't be blocked"] }); }
  // Wake the Dead: X creature cards back, sacrificed at the next end step
  const wtd = text.match(/return x target ([a-z ]+?) cards from your graveyard to the battlefield\. sacrifice those creatures at the beginning of the next end step/i);
  if (wtd) effs.push({ k: "regrow", n: 20, upTo: true, xLabel: true, what: wtd[1], filter: parseTargetFilter(wtd[1]), dest: "battlefield", sacNext: true });
  // Mithril Coat: "attach it to target legendary creature you control"
  const ats = text.match(/^attach (?:it|this [a-z]+) to target ([a-z ]+?) you control\.?$/i);
  if (ats) effs.push({ k: "attachSelf", type: ats[1] });
  { const tl = text.match(/^tap (up to one )?target ([a-z ]+?)\. it doesn't untap during its controller's untap step for as long as you control/i); if (tl) effs.push({ k: "tapLock", what: tl[2] }); }
  if (new RegExp(`^exile (?:this creature|${short.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}|${short.split(" ")[0].replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})\\. return it to the battlefield under its owner's control at the beginning of the next end step`, "i").test(text.trim())) effs.push({ k: "exileRet" });
  if (new RegExp(`^untap (?:this creature|this artifact|${short.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})\\.?$`, "i").test(text.trim())) effs.push({ k: "untapSelf" });
  // Andúril: "put a +1/+1 counter on each creature you control. If you have the city's blessing, put two … instead"
  { const bl = text.match(/if you have the city's blessing, put (two|three) \+1\/\+1 counters on each creature you control instead/i); if (bl) effs.filter(f => f.k === "countersEach").forEach(f => { f.blessN = num(bl[1]); }); }
  // Golbez: "Then if you control eight or more artifacts, each opponent loses life equal to that card's power."
  { const gp = text.match(/then if you control (\w+) or more ([a-z]+?)s, each opponent loses life equal to that card's power/i); if (gp) effs.filter(f => f.k === "regrow").forEach(f => { f.drainPow = { n: num(gp[1]) || Number(gp[1]), type: gp[2] }; }); }
  if (/^it deals that much damage to any target\.?$/i.test(text.trim())) effs.push({ k: "ping", n: "that" });
  { const pp2 = text.match(/deals (\d+) damage to target player or planeswalker/i); if (pp2) effs.push({ k: "ping", n: Number(pp2[1]), playerOnly: true }); }
  // Massive Raid / The War Doctor / Murasa Pyromancer / Ondu Cleric: amounts from a count
  { const mr = text.match(/deals damage (?:to any target )?equal to the number of ([a-z]+?)s? you control(?: to any target)?/i) || text.match(/deals damage to any target equal to the number of ([a-z]+?)s? you control/i); if (mr && !/target creature/i.test(text)) effs.push({ k: "ping", n: { count: mr[1].toLowerCase() } }); }
  { const xc = text.match(/deals X damage to any target, where X is the number of ([a-z]+?)s you control/i); if (xc) { for (let i = effs.length - 1; i >= 0; i--) if (effs[i].k === "ping") effs.splice(i, 1); effs.push({ k: "ping", n: { count: xc[1].toLowerCase() } }); } }
  if (/deals damage equal to that creature's power to any target/i.test(text)) effs.push({ k: "ping", n: { enterPow: true } });
  { const wd = text.match(/deals damage equal to the number of ([a-z]+) counters on it to any target/i); if (wd) effs.push({ k: "ping", n: { ctr: counterKey(wd[1]) } }); }
  { const mp = text.match(/deal damage to target creature equal to the number of ([a-z]+?)s? you control/i); if (mp) effs.push({ k: "dmgCr", n: { count: mp[1].toLowerCase() }, pw: false, cr: true, opp: false }); }
  { const og = text.match(/gain life equal to the number of ([a-z]+?)s? you control/i); if (og && !effs.some(f => f.k === "gainPer")) effs.push({ k: "gain", n: { count: og[1].toLowerCase() } }); }
  // Jeskai Ascendancy: "creatures you control get +1/+1 until end of turn. Untap those creatures."
  if (/until end of turn\. untap those creatures/i.test(text)) effs.push({ k: "untapAll", what: "creatures", filter: parseTargetFilter("creature"), mine: true });
  // Wartime Protestors: "put a +1/+1 counter on that creature and it gains haste until end of turn"
  if (/put a \+1\/\+1 counter on that creature and it gains haste until end of turn/i.test(text)) effs.push({ k: "ctrEntering", n: 1, haste: true });
  // Thousand-Year Elixir: "Untap target creature."
  // Tezzeret −2: "Target artifact becomes an artifact creature. If it isn't a Vehicle, it has base power and toughness 4/4."
  { const an = text.match(/^target ([a-z ]+?) becomes an artifact creature\. if it isn't a vehicle, it has base power and toughness (\d+)\/(\d+)/i); if (an) effs.push({ k: "animate", what: an[1], filter: parseTargetFilter(an[1]), p: an[2], tg: an[3] }); }
  // Naru Meha: "copy target instant or sorcery spell you control"
  if (/^copy target instant or sorcery spell you control\b/i.test(text.trim())) effs.push({ k: "copyPick" });
  else if (/^copy target instant or sorcery spell\b/i.test(text.trim())) effs.push({ k: "copyPick", any: true, bounce: /then return it to its owner's hand/i.test(text) });
  // Maze of Ith
  if (/^untap target attacking creature\. prevent all combat damage that would be dealt to and dealt by that creature this turn/i.test(text.trim())) effs.push({ k: "maze" });
  // Prosperity: "Each player draws X cards."
  { const ep = text.trim().match(/^each player draws (x|\d+|a|one|two|three) cards?\.?$/i); if (ep) effs.push({ k: "eachDraw", n: /^x$/i.test(ep[1]) ? "X" : num(ep[1]) || Number(ep[1]) }); }
  { const ut = !/attacking creature\. prevent/i.test(text) && text.trim().match(/^untap (?:another )?target ([a-z ]+?)\.?$/i); if (ut) effs.push({ k: "pumpTarget", what: ut[1], filter: parseTargetFilter(ut[1]), dp: "+0", dt: "+0", kws: [], untap: true, untapOnly: true }); }
  // Liquimetal Coating: "Target permanent becomes an artifact in addition to its other types until end of turn."
  { const bt = text.match(/^target ([a-z ]+?) becomes an? ([a-z]+) in addition to its other types until end of turn/i); if (bt) effs.push({ k: "addType", what: bt[1], filter: parseTargetFilter(bt[1]), type: bt[2][0].toUpperCase() + bt[2].slice(1).toLowerCase() }); }
  // Jeong Jeong: "When you next cast a Lesson spell this turn, copy it"
  { const cn = text.match(/when you next cast an? ([a-z ]+?) spell this turn, copy it/i); if (cn) effs.push({ k: "copyNext", type: cn[1] }); }
  // Arcum Dagsson
  if (/target artifact creature's controller sacrifices it\. that player may search their library for a noncreature artifact card, put it onto the battlefield/i.test(text)) effs.push({ k: "arcum" });
  // Double-faced cards: "Transform Aang." / "Exile Joshua, then return it to the battlefield transformed under its owner's control." / back-face Sagas: "Exile Phoenix, then return it to the battlefield."
  if (new RegExp(`(?:^|\\. )transform (?:this [a-z]+|${short.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}|it)\\.?$`, "i").test(text.trim())) effs.push({ k: "transformSelf" });
  else if (/exile [^,.]+?, then return (?:it|that card) to the battlefield transformed under (?:its owner's|your) control/i.test(text)) effs.push({ k: "reenterFace", flip: true });
  else if (new RegExp(`exile (?:this [a-z]+|${short.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}), then return it to the battlefield\\.?\\s*$`, "i").test(text.trim())) effs.push({ k: "reenterFace", front: true });
  // Trenzalore Clocktower: "Shuffle your graveyard and hand into your library, then draw seven cards."
  { const wg = text.match(/shuffle your graveyard and hand into your library, then draw (seven|\w+) cards/i); if (wg) effs.push({ k: "wheelGy", n: num(wg[1]) || 7 }); }
  // Ephemerate: blink
  { const bl = text.match(/exile (?:up to one )?(?:another )?target ([a-z- ]*?creature) you control, then return (?:it|that card) to the battlefield under (?:its owner's|your) control/i)
      || text.match(/exile (?:up to one )?target ((?:[a-z]+, )*[a-z]+,? (?:or|and\/or) [a-z]+|creature|enchantment|artifact|nontoken permanent|permanent)(?: you control)?, then return (?:it|that card) to the battlefield under (?:its owner's|your) control/i)
      || text.match(/exile target (nontoken permanent|permanent|creature or enchantment)(?: you control)?, then return (?:it|that card) to the battlefield/i);
    if (bl) effs.push({ k: "blink", filter: parseTargetFilter(bl[1].replace(/,? (?:or|and\/or) /g, ", ")), what: bl[1] }); }
  { const er = text.match(/\bexile (each|all|any number of target) (nontoken )?(creatures?|creatures and\/or planeswalkers) you control\b[^.]*\.[^.]*?return (?:those cards|each of them) to the battlefield[^.]*?at the beginning of the next end step/i)
      || text.match(/\bexile (each|all|any number of target) (nontoken )?(creatures?|creatures and\/or planeswalkers) you control\b[^.]*\.\s*at the beginning of the next end step, return (?:those cards|each of them)/i)
      || text.match(/\bexile (all) (nontoken )?(creatures) you control, then roll a d20/i);
    if (er) effs.push({ k: "exileRetMine", pick: /any number/i.test(er[1]), nontoken: !!er[2], pw: /planeswalker/i.test(er[3]), bonus: /enters with an additional \+1\/\+1 counter/i.test(text) }); }
  // Strionic Resonator
  if (/^copy target (?:activated or )?triggered ability you control\b/i.test(text.trim())) effs.push({ k: "copyTrig" });
  if (/\btarget player investigates\b/i.test(text)) effs.push({ k: "tplayerTok", n: 1, name: "Clue", desc: "Clue" });
  const tp = text.match(/\btarget player creates (a|an|one|two|three|\d+) ([^.]+?) tokens?\b/i);
  if (tp) effs.push({ k: "tplayerTok", n: num(tp[1]) || 1, name: capName(tp[2]) || "Token", desc: tp[2].replace(/\btapped\s+/i, "").trim(), ...(/\btapped\b/i.test(tp[2]) ? { tapped: true } : {}) });
  const ua = text.match(/\buntap all ([a-z ,]+?) you control\b/i);
  if (ua && !/during each other player's untap step/i.test(text)) effs.push({ k: "untapAll", what: ua[1].trim(), filter: parseTargetFilter(ua[1]) });
  const un = !ua && text.match(/\buntap up to (one|two|three|four|five|six|seven|\d+) (lands|creatures|artifacts|permanents)\b/i);
  if (un) effs.push({ k: "untapN", n: num(un[1]), what: un[2], filter: parseTargetFilter(un[2]) });
  if (/\ball permanents you control phase out\b/i.test(text)) effs.push({ k: "phaseAll" });
  if (/your life total can't change/i.test(text) || /you gain protection from everything/i.test(text))
    effs.push({ k: "protect", life: /your life total can't change/i.test(text), all: /protection from everything/i.test(text) });
  const pg = text.match(/deals (\d+|one|two|three|x) damage to any target/i);
  if (pg) effs.push({ k: "ping", n: num(pg[1]) || 1 });
  // "deals 4 damage to target creature" (Thunder Magic, Flame Slash…): a creature picker that shows whether it dies
  const dcr = !pg && text.match(/deals (\d+|one|two|three|four|five|six|seven|eight|x) damage to (?:up to one )?(?:another )?target (creature or planeswalker|creature|planeswalker)( an opponent controls| you don't control| that player controls)?/i);
  const dctl = text.match(/and (\d+) damage to that (?:creature|permanent)'s controller/i);
  const dEach = !dcr && text.match(/deals (\d+|one|two|three|x) damage to each of up to (two|three|four) target (creatures|creatures and\/or planeswalkers)/i);
  if (dEach) for (let i = 0; i < num(dEach[2]); i++) effs.push({ k: "dmgCr", n: num(dEach[1]) ?? 0, pw: /planeswalker/i.test(dEach[3]), cr: true, opp: false, upTo: true });
  if (dcr && !/divided|each other/i.test(text) && (dctl || !/and \d+ damage to/i.test(text))) effs.push({ k: "dmgCr", n: num(dcr[1]) ?? 0, pw: /planeswalker/i.test(dcr[2]), cr: /creature/i.test(dcr[2]), opp: !!dcr[3], ...(dctl ? { ctrl: Number(dctl[1]) } : {}), ...(/if that creature would die this turn, exile it instead/i.test(text) ? { exile: true } : {}) });
  // Board damage: Pyroclasm, Blasphemous Act, Chain Reaction, Earthquake
  const da = text.match(/deals (\d+|x|one|two|three|four|five|six|seven|thirteen) damage to each (other )?(creature(?: and each planeswalker)?(?: without flying)?(?: with flying)?|creature your opponents control|creature you don't control|creature and planeswalker(?: your opponents control)?)( and each (?:player|opponent))?/i);
  if (da) effs.push({ k: "dmgAll", n: /^x$/i.test(da[1]) ? (/where x is the number of creatures on the battlefield/i.test(text) ? "creatures" : "X") : (num(da[1]) ?? (da[1].toLowerCase() === "thirteen" ? 13 : 0)),
    other: !!da[2], noFly: /without flying/i.test(da[3]), onlyFly: /with flying/i.test(da[3]) && !/without/i.test(da[3]), opp: /opponents control|don't control/i.test(da[3]), pw: /planeswalker/i.test(da[3]), players: da[4] ? (/opponent/i.test(da[4]) ? "opp" : "all") : "" });
  // Romantic Rendezvous: "Discard a card, then draw two cards."
  const dsc = !/as an additional cost|you may discard|each player discards|target (player|opponent) discards|discard (it|this card|your hand)/i.test(text) && text.match(/(?:^|\. |, then |: )discard (a|one|two|three|\d+) cards?/i);
  if (dsc) effs.push({ k: "discardN", n: num(dsc[1]) || 1 });
  // Spider-Verse: "you may copy it"
  { const wh = text.match(/\beach player (may )?discards? their hand(?:,)? (?:then|and) draws? (seven|five|three|\d+) cards\b/i); if (wh) effs.push({ k: "wheelAll", n: num(wh[2]) || Number(wh[2]), may: !!wh[1] }); }
  if (/\beach instant and sorcery card in your graveyard gains flashback until end of turn/i.test(text)) effs.push({ k: "fbAll" });
  if (/^you may copy it\b/i.test(text.trim())) effs.push({ k: "copySpell", once: /do this only once each turn/i.test(text), haste: /gains haste/i.test(text) });
  // Heroes' Hangout: "One or two target creatures each get +1/+0 and gain first strike until end of turn"
  const p2 = text.match(/\bone or two target ([a-z ]*?creatures?) each get ([+−-]\d+)\/([+−-]\d+)(?: and gain ([a-z ,]+?))? until end of turn/i);
  if (p2) effs.push({ k: "pumpTarget", n: 2, what: "creature", filter: parseTargetFilter("creature"), dp: p2[2], dt: p2[3], kws: splitKws(p2[4] || "") });
  // Wisecrack: the creature hits itself for its power
  if (/target creature deals damage equal to its power to itself/i.test(text)) { const wa = text.match(/if that creature is attacking, [^.]*? deals (\d+) damage to that creature's controller/i); effs.push({ k: "wisecrack", atk: wa ? Number(wa[1]) : 0 }); }
  // Enchanter's Bane: sacrifice it or take damage equal to its mana value
  if (/\b(?:there is an|take an) additional combat phase\b/i.test(text)) effs.push({ k: "extraCombat" });
  if (/\buntap all creatures (?:you control )?that attacked this turn\b/i.test(text)) effs.push({ k: "untapAttacked" });
  if (/\byou may discard a card\. if you do, draw a card\b/i.test(text)) effs.push({ k: "rummage" });
  { const lo = text.match(/^(?:you )?draw (a|one|two|three) cards?, then discard (a|one|two) cards?\.?$/i); if (lo) effs.push({ k: "loot", draw: num(lo[1]) || 1, disc: num(lo[2]) || 1 }); } // Agna Qel'a, Matzalantli: draw then discard
  if (/deals damage to that player equal to the number of noncreature spells they've cast this turn/i.test(text)) effs.push({ k: "dmgThem", n: "nc" });
  // Double Trouble: "Double the power of each creature you control until end of turn"
  if (/\bdouble the power of each creature you control until end of turn/i.test(text)) effs.push({ k: "doublePow" });
  // Ghost-Spider: "deals X damage to defending player, where X is the number of attacking creatures"
  const ddp = text.match(/deals (\d+|x) damage to (?:the )?defending player/i);
  if (ddp) effs.push({ k: "dmgDef", n: /^x$/i.test(ddp[1]) ? (/where x is the number of attacking creatures/i.test(text) ? "attackers" : "X") : Number(ddp[1]) });
  const xpc = text.match(/\byou get (an?|one|two|three|\d+) (experience|energy|rad|poison) counters?/i);
  if (xpc) effs.push({ k: "pcounter", key: xpc[2].toLowerCase(), n: num(xpc[1]) || 1 });
  const eb = text.match(/\bearthbend (\d+|x|one|two|three|four|five)\b/i);
  if (eb) effs.push({ k: "earthbend", n: /^x$/i.test(eb[1]) ? (/x is the number of experience counters you have/i.test(text) ? "experience" : "X") : num(eb[1]) });
  const dg = text.match(/whenever a creature dies this turn, you gain (\d+|one|two|three) life/i);
  if (dg) { const g = num(dg[1]) || 1; const i = effs.findIndex(f => f.k === "gain" && f.n === g); if (i >= 0) effs.splice(i, 1); effs.push({ k: "dieGain", n: g, ifPaid: /if this spell's additional cost was paid/i.test(text) }); }
  if (/spells you control can't be countered this turn/i.test(text)) effs.push({ k: "veil", drawIf: (text.match(/draw a card if an opponent has cast an? ([a-z]+) or ([a-z]+) spell this turn/i) || []).slice(1).map(c => c.toLowerCase()), hexFrom: (text.match(/gain hexproof from ([a-z]+) and from ([a-z]+)/i) || []).slice(1).map(c => c.toLowerCase()) });
  const pmk = !/hexproof from [a-z]+ and from/i.test(text) && text.match(/\bpermanents you control gain ([a-z ,]+?) until end of turn/i);
  if (pmk) effs.push({ k: "pumpAll", perm: true, everyone: false, other: false, dp: "+0", dt: "+0", kws: splitKws(pmk[1]), xCount: null });
  // Arachnogenesis: "Create X 1/2 green Spider creature tokens with reach, where X is the number of creatures attacking you"
  const xa = text.match(/create x ([^.]+?) tokens?(?: with [a-z ,]+?)?, where x is the number of creatures attacking you/i);
  if (xa) { const i = effs.findIndex(f => f.k === "tok"); if (i >= 0) effs.splice(i, 1); effs.push({ k: "tokAtkMe", name: capName(xa[1]) || "Token", desc: xa[1].trim() + (/with reach/i.test(text) ? " with reach" : "") }); }
  if (/as an additional cost to cast this spell, you may sacrifice one or more creatures\. when you do, copy this spell for each creature sacrificed this way/i.test(text)) effs.push({ k: "plumb" });
  if (/\beach creature gets -x\/-x until end of turn/i.test(text)) effs.push({ k: "minusX" });
  // Exsanguinate: "Each opponent loses X life. You gain life equal to the life lost this way."
  if (/\beach opponent loses x life\. you gain life equal to the life lost this way/i.test(text)) effs.push({ k: "drainX" });
  // Necromantic Selection
  if (/\bdestroy all creatures, then return a creature card put into a graveyard this way to the battlefield under your control/i.test(text)) effs.push({ k: "necroSel", zombie: /black zombie/i.test(text) });
  // Sudden Spoiling
  const ss = text.match(/until end of turn, creatures target player controls lose all abilities and have base power and toughness (\d+)\/(\d+)/i);
  if (ss) effs.push({ k: "spoil", pt: `${ss[1]}/${ss[2]}` });
  if (/target enchantment deals damage equal to its mana value to its controller unless that player sacrifices it/i.test(text)) effs.push({ k: "bane" });
  // Radiant Performer / Ghirapur Orrery-style: copy a single-target spell for every other legal target
  if (/copy that spell or ability for each other (?:permanent or player|[a-z ]+?) the spell or ability could target/i.test(text)) effs.push({ k: "radiant" });
  const am = text.match(/\bamass (\w+) (\d+|one|two|three|x)\b/i);
  if (am) effs.push({ k: "amass", type: am[1].replace(/^\w/, c => c.toUpperCase()), n: num(am[2]) || 1 });
  const xc = text.match(/\bexchange control of (.+?) and (up to one )?(?:another )?target ([a-z ]+?)(?: an opponent controls| you don't control)?(?:\.|$)/i);
  if (xc && (new RegExp(`^(this|${short.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "i").test(xc[1].trim()))) effs.push({ k: "swap", self: true, upTo: !!xc[2], what: xc[3], filter: { ...parseTargetFilter(xc[3]), controller: "opp" }, sacIfNone: /if you don't (?:or can't )?make an exchange, sacrifice/i.test(text) });
  else if (/\bexchange control of two target ([a-z ]+?)s?(?:\.|$)/i.test(text)) { const w = text.match(/exchange control of two target ([a-z ]+?)s?(?:\.|$)/i)[1]; effs.push({ k: "swap", self: false, what: w, filter: parseTargetFilter(w) }); }
  if (/\byou control target (player|opponent) during that player's next turn/i.test(text)) effs.push({ k: "controlTurn" });
  const sx = stealCardOf(text);
  if (sx) effs.push(sx);
  // Graveyard hate: "exile target player's graveyard", "exile each opponent's graveyard", "exile all graveyards"
  const gh = text.match(/\bexile (target player's|target opponent's|each opponent's|all|each player's) graveyards?/i);
  if (gh) effs.push({ k: "gyhate", who: /target/i.test(gh[1]) ? "target" : /opponent/i.test(gh[1]) ? "opps" : "all" });
  if (mm) { const pc = !mm[2] && text.match(/\badd (?:\{[^}]+\})+ for each ([a-z]+?)s? you control/i); effs.push({ k: "mana", syms: mm[1], per: mm[2] ? counterKey(mm[2]) : null, perLabel: mm[2] || (pc ? pc[1] : ""), ...(pc ? { perCount: pc[1].toLowerCase() } : {}) }); }
  const fx = parseSearch(text);
  if (fx) effs.push(fx);
  const sm = text.match(selfRe);
  if (sm) {
    const per = text.match(/for each (other )?([a-z ,/]+?) you control/i);
    effs.push({ k: "selfc", n: num(sm[1]), key: counterKey(sm[2]), label: sm[2], per: per ? { other: !!per[1], types: splitTypes(per[2]) } : null });
  }
  { const bo = text.match(/\bbolster (a|one|two|three|four|five|\d+)\b/i); if (bo) effs.push({ k: "countersTarget", n: num(bo[1]) || 1, key: "p1p1", label: "+1/+1", what: "creature you control with the least toughness", filter: { ...parseTargetFilter("creature"), controller: "you" }, bolster: true }); } // Bolster N
  const i = text.search(/\bcreate\b/i);
  if (i >= 0) {
    const seg = text.slice(i);
    const re = /(?:create|and|or|,)\s+(a|an|one|two|three|four|five|six|seven|eight|nine|ten|\d+|that many|x)\s+([^.;]*?)\btokens?\b/gi;
    for (const m of seg.matchAll(re)) {
      if (/copy|that's|named/i.test(m[2])) continue;
      const nmd = seg.slice(m.index + m[0].length).match(/^ named ([A-Z][A-Za-z'-]*(?: (?:of |the |of the )?[A-Z][A-Za-z'-]*)*)/); // "a tapped colorless artifact token named Meteorite"
      const pre = m[0].startsWith(",") && seg.slice(0, m.index).match(/^create ([A-Z][A-Za-z'-]*(?: (?:of |the |of the )?[A-Z][A-Za-z'-]*)*)$/); // Mabel: "create Cragflame, a legendary colorless Equipment artifact token"
      const name = nmd ? nmd[1] : pre ? pre[1] : capName(m[2]);
      if (!name) continue;
      const w = m[1].toLowerCase();
      const xm = w === "x" && text.match(/where x is the number of ([a-z]+?)s? you control/i);
      const xa = w === "x" && /where x is the number of attacking creatures/i.test(text);
      let n = w === "that many" ? "many" : xa ? { attacking: true } : xm ? { count: xm[1].toLowerCase() } : w === "x" && /where x is (?:the|that spell's) mana value(?: of that spell)?/i.test(text) ? { spellMv: true } : w === "x" && !/where x is/i.test(text) ? "X" : num(w);
      if (n == null) continue;
      { const fe = (num(w) === 1) && (text.match(/\bfor each ([a-z]+) you control, create /i) || seg.slice(m.index).match(/^[^.]*?\btokens? for each ([a-z]+) you control\b/i)); if (fe && fe[1] !== "other") n = { count: fe[1].toLowerCase() }; } // Cadira: a Rabbit for each token you control
      const KWL = "flying|haste|deathtouch|lifelink|vigilance|trample|menace|reach|first strike|double strike|hexproof|indestructible|defender|prowess|shroud|intimidate|fear|infect|wither|ward \\{\\d+\\}|toxic \\d+";
      const kwm = seg.slice(m.index + m[0].length).match(new RegExp(`^ with ((?:${KWL})(?:(?:, and |, | and )(?:${KWL}))*)(?=[.,;]|$| and (?!${KWL}))`, "i"));
      if (nmd || pre) noteTokenKind(name, m[2]);
      effs.push({ k: "tok", name, n, desc: m[2].replace(/\btapped\b/i, "").trim() + (kwm ? ` with ${kwm[1].toLowerCase()}` : ""), tapped: /\btapped\b/i.test(m[2]) });
    }
  }
  // Enduring Vitality: "return it to the battlefield under its owner's control. It's an enchantment."
  if (/return it to the battlefield under its owner's control\. it's an enchantment/i.test(text)) effs.push({ k: "dieReturn", ench: true });
  // Shamanic Revelation: "Draw a card for each creature you control"
  const dfe = text.match(/\bdraw a card for each ([a-z ]+?) you control\b/i);
  if (dfe && !/counters? on/i.test(dfe[1])) effs.push({ k: "drawFor", types: splitTypes(dfe[1]), label: dfe[1], ...(/you control of (?:that|the chosen) type/i.test(text) ? { chosen: true } : {}) });
  // "You gain 4 life for each creature you control with power 4 or greater" / "… for each Elf you control"
  const gpe = text.match(/you gain (\d+|one|two|three|four|five) life for each ([a-z ]+?) you control( with power (\d+) or greater)?/i);
  if (gpe) effs.push({ k: "gainPer", n: num(gpe[1]), types: splitTypes(gpe[2]), minPow: gpe[4] ? Number(gpe[4]) : null, label: gpe[2] + (gpe[3] || "") });
  let m = !gpe && text.match(/you (?:may )?gain (\d+|one|two|three|four|five) life/i);
  if (m) effs.push({ k: "gain", n: num(m[1]) });
  // "each player's life total becomes …" (Biorhythm and friends)
  let lt = text.match(/each player's life total becomes the number of ([a-z ,/]+?) (?:they|that player) controls?/i);
  if (lt) effs.push({ k: "setlife", scope: "each", count: splitTypes(lt[1]), label: `each player's life becomes the number of ${lt[1]} they control` });
  else if ((lt = text.match(/each player's life total becomes the (lowest|highest) life total among all players/i)))
    effs.push({ k: "setlife", scope: "each", agg: lt[1].toLowerCase(), label: `each player's life becomes the ${lt[1].toLowerCase()} life total` });
  else if ((lt = text.match(/\b(target opponent's|target player's|your) life total becomes (\d+)/i)))
    effs.push({ k: "setlife", scope: /your/i.test(lt[1]) ? "you" : "target", val: Number(lt[2]), label: `${lt[1]} life total becomes ${lt[2]}` });
  // Imprint-style: "you may exile a nonartifact, nonland card from your hand"
  const im = text.match(/exile (a|an) ([^.]*?)\bcard(?: with (?:mana value|converted mana cost) \w+(?: or less)?)? from your hand/i);
  if (im) {
    const words = im[2].toLowerCase().replace(/,/g, " ").trim();
    effs.push({ k: "imprint", what: im[2].trim() || "card", alts: words ? (/ or /.test(words) ? words.split(/\s+or\s+/).map(a => a.split(/\s+/).filter(Boolean)) : [words.split(/\s+/).filter(Boolean)]) : [] });
  }
  // Edicts: "that player sacrifices an artifact, creature, or land", "each opponent sacrifices a creature"
  const ed = text.match(/\b(that player|each other player|each player|each opponent|target player|target opponent|you) sacrifices? (a|an|one|two|three|\d+) ([^.]+?)(?: of (?:their|your) choice)?(?:\.|$)/i);
  if (ed && !/\bthis\b|\bit\b/.test(ed[3])) effs.push({ k: "edict", who: { "that player": "that", "each player": "each", "each other player": "opps", "each opponent": "opps", "target player": "target", "target opponent": "target", you: "you" }[ed[1].toLowerCase()],
    n: num(ed[2]), what: ed[3].trim(), filter: parseTargetFilter(ed[3]) });
  const rm = parseRemoval(text);
  if (rm) effs.push(/can't be regenerated/i.test(text) ? { ...rm, noRegen: true } : rm);
  const adn = /reveal the top card of your library and put (?:that card|it) into your hand\.\s*you lose life equal to its (?:mana value|converted mana cost)\.\s*you may repeat this process/i.test(text);
  if (adn) effs.push({ k: "adnaus" });
  const ab = text.match(/\bairbend (all other|all|up to one target|another target|target) ((?:nonland |nontoken |attacking |tapped )?(?:creature|permanent|artifact|enchantment)s?)(?: (?:you don't control|an opponent controls|target opponent controls))?/i);
  if (ab) effs.push({ k: "airbend", scope: ab[1].toLowerCase().replace(/^(up to one |another )/, ""), what: singular(ab[2].toLowerCase()),
    lock: /opponents can't cast spells from anywhere other than their hands/i.test(text) });
  const td = text.match(/target (opponent|player) draws (a|an|one|two|three|\d+) cards?/i);
  if (td) effs.push({ k: "tdraw", n: num(td[2]) });
  const od = text.match(/each opponent draws (a|an|one|two|three|\d+) cards?/i);
  if (od) effs.push({ k: "odraw", n: num(od[1]) });
  // Verdant Command: "Target player gains 3 life", "Exile target card from a graveyard"
  const tg = text.match(/\btarget player gains (\d+|one|two|three|four|five) life/i);
  if (tg) effs.push({ k: "tgain", n: num(tg[1]) });
  if (/\bexile target card from a graveyard\b/i.test(text)) effs.push({ k: "gyOne" });
  if (/^[^.]*\bdeals that much damage to target opponent\.?$/i.test(text.trim())) effs.push({ k: "ping", n: { evAmt: true }, oppOnly: true, playerOnly: true }); // Shalai and Hallar: opponents only
  const tl = text.match(/target (player|opponent) loses (\d+|one|two|three|four|five) life/i);
  if (tl) effs.push({ k: "tlose", n: num(tl[2]), who: tl[1].toLowerCase() });
  m = text.match(/each opponent loses (\d+|one|two|three|four|five) life/i);
  if (m) effs.push({ k: "drain", n: num(m[1]) });
  // Fear of Burning Alive: "it deals 4 damage to each opponent" (damage, so Torbran adds to it)
  const dmo = !m && text.match(/deals (\d+|one|two|three|four|five) damage to each opponent/i);
  if (dmo) effs.push({ k: "drain", n: num(dmo[1]), dmg: true });
  // Razorkin Needlehead: "this creature deals 1 damage to them" (the player who drew)
  const dmt = text.match(/deals (\d+|one|two|three) damage to (?:them|that player)\b/i);
  if (dmt) effs.push({ k: "dmgThem", n: num(dmt[1]) });
  // Kambal, Consul of Allocation: "that player loses 2 life and you gain 2 life"
  { const lt = text.match(/\b(?:that player|they) loses? (\d+|one|two|three|four|five) life\b(?! for each)/i); if (lt && !/unless|may\b/i.test(text)) effs.push({ k: "loseThem", n: num(lt[1]) || Number(lt[1]) }); }
  // The Fire Crystal: "Create a token that's a copy of target creature you control. Sacrifice it at the beginning of the next end step."
  if (/create a token that's a copy of (?:another )?target creature you control/i.test(text)) effs.push({ k: "copyCreature", eotSac: /sacrifice it at the beginning of the next end step/i.test(text), haste: /it gains haste/i.test(text) });
  const selfName = `(?:it|this [a-z]+|${short.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`;
  m = text.match(/(?:^|\. |and )you lose (\d+|one|two|three) life/i) || text.match(/\byou draw [^.]*? and lose (\d+|one|two|three) life/i);
  if (m) {
    // The One Ring: "you lose 1 life for each burden counter on The One Ring"
    const pc = text.match(new RegExp(`you lose [^.]*? life for each ([a-z+/1-]+) counters? on ${selfName}`, "i"));
    effs.push({ k: "lose", n: num(m[1]), ...(pc ? { perCtr: counterKey(pc[1]), perLabel: pc[1] } : {}) });
  }
  // The One Ring: "then draw a card for each burden counter on The One Ring" (counted after the new counter goes on)
  const dpc = text.match(new RegExp(`\\bdraw a card for each ([a-z+/1-]+) counters? on ${selfName}`, "i"));
  if (dpc) effs.push({ k: "drawPer", key: counterKey(dpc[1]), label: dpc[1] });
  // "Add one mana of any color" (Treasure, Gilded Goose), "Add two mana in any combination of colors" (Thornvault Forager), "Add three mana of any one color" (Lion's Eye Diamond)
  const many = text.replace(/"[^"]*"/g, "").match(/\badd (one|two|three|four|five|x|\d+) mana (of any one color|of any color|in any combination of colors)/i); // not abilities granted in quotes
  if (many) effs.push({ k: "manaAny", n: /^x$/i.test(many[1]) ? 1 : num(many[1]) || 1, one: /any one color/i.test(many[2]) });
  // Hobgoblin: "Hobgoblin gets +2/+0 until end of turn"
  const psf = text.match(new RegExp(`(?:^|\\. )(?:this creature|${short.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}) gets ([+−-]\\d+)\\/([+−-]\\d+)(?: and gains ([a-z ,]+?))? until end of turn`, "i"));
  if (psf) effs.push({ k: "pumpSelf", dp: Number(psf[1].replace("−", "-")), dt: Number(psf[2].replace("−", "-")), kws: splitKws(psf[3] || "") });
  // Yahenni: "Yahenni gains indestructible until end of turn"
  const psg = !psf && text.match(new RegExp(`(?:^|\\. )(?:this creature|${short.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}) gains ([a-z ,]+?) until end of turn`, "i"));
  if (psg) effs.push({ k: "pumpSelf", dp: 0, dt: 0, kws: splitKws(psg[1]) });
  // Isengard Unleashed: "If a source you control would deal damage this turn to an opponent…, it deals triple that damage instead"; "Damage can't be prevented this turn"
  const dtm = text.match(/if a source you control would deal damage this turn to [^,]+, it deals (double|triple) that damage instead/i);
  if (dtm) effs.push({ k: "dmgTurn", mult: dtm[1].toLowerCase() === "triple" ? 3 : 2 });
  if (/damage can't be prevented this turn/i.test(text)) effs.push({ k: "noPreventTurn" });
  // Sword of the Squeak: "you may attach this Equipment to that creature"
  if (/\battach (?:this equipment|it|[^.]+?) to that creature\b/i.test(text)) effs.push({ k: "attachNew" });
  // Swarmyard: "Regenerate target Insect, Rat, Spider, or Squirrel"
  const rgn = text.match(/\bregenerate (?:another )?target ([a-z ,]+?)(?:\.|$)/i);
  if (rgn) effs.push({ k: "regen", what: rgn[1].trim(), filter: parseTargetFilter(rgn[1].replace(/\bor\b/g, ",").replace(/,\s*,/g, ",")) });
  // Suspect (J. Jonah Jameson): menace and can't block
  if (/\bsuspect (?:up to one )?target creature\b/i.test(text)) effs.push({ k: "suspect", upTo: /up to one/i.test(text) });
  // The Lord of the Rings cards: "the Ring tempts you"
  if (/\bthe ring tempts you\b/i.test(text)) effs.push({ k: "tempt" });
  // Thassa's Oracle: "where X is your devotion to blue … If X is greater than or equal to the number of cards in your library, you win the game"
  const dvo = text.match(/where x is your devotion to (white|blue|black|red|green)/i);
  if (dvo && /x is greater than or equal to the number of cards in your library, you win the game/i.test(text))
    effs.push({ k: "oracle", color: { white: "W", blue: "U", black: "B", red: "R", green: "G" }[dvo[1].toLowerCase()], colorName: dvo[1].toLowerCase(),
      dig: /put up to one of them on top of your library and the rest on the bottom/i.test(text) });
  for (let i = effs.length - 1; i >= 0; i--) if (effs[i].k === "remove" && /graveyard/i.test(effs[i].what || "")) effs.splice(i, 1); // Bojuka Bog is graveyard hate, not removal
  if (/\breturn an? (land|creature|permanent) you control to its owner's hand\b/i.test(text)) effs.push({ k: "bounceOwn", what: text.match(/\breturn an? (land|creature|permanent) you control to its owner's hand/i)[1].toLowerCase() });
  const tq = text.match(/creature tokens? with "(this (?:token|creature) gets \+1\/\+1 for each [a-z ]+? you control)\.?"/i);
  if (tq) effs.forEach(f => { if (f.k === "tok" && !/for each/i.test(f.desc || "")) f.desc = `${f.desc} with "${tq[1]}"`; });
  if (/tokens? with changeling/i.test(text)) effs.forEach(f => { if (f.k === "tok" && !/changeling/i.test(f.desc || "")) f.desc = `${f.desc} with changeling`; });
  const drop = bad => { for (let i = effs.length - 1; i >= 0; i--) if (bad(effs[i])) effs.splice(i, 1); };
  if (effs.some(f => f.k === "blink" || f.k === "exileRetMine")) drop(f => f.k === "remove");
  if (/\bchoose (?:exactly )?(?:two|three|\d+) creatures you control\b/i.test(text)) drop(f => f.k === "pumpAll");
  if (effs.some(f => f.k === "ping" && f.n && typeof f.n === "object")) drop(f => f.k === "ping" && typeof f.n === "number");
  if (/\byou win the game\b/i.test(text)) drop(f => f.k === "gain"); // Approach of the Second Sun handles its own life gain
  if (/where X is that card's mana value/i.test(text)) drop(f => f.k === "pumpAll"); // Surge to Victory → a reminder instead
  drop(f => f.k === "pumpAll" && f.xCount === "attacking creatures"); // Tears of Rage
  if (/gains your choice of/i.test(text)) drop(f => f.k === "pumpTarget" && Number(f.dp) === 0 && Number(f.dt) === 0 && !(f.kws || []).length); // Orcish Medicine // Spry and Mighty: only the chosen ones
  if (/^create [^.]*tokens?, then roll a/im.test(text)) { const first = effs.find(f => f.k === "tok"); drop(f => f.k === "tok" && f !== first); if (first) first.lead = true; } // Clowning Around: the die decides the extra token
  if (effs.some(f => f.k === "eqCtr")) drop(f => f.k === "selfc");
  if (effs.some(f => f.k === "loot")) drop(f => f.k === "discardN"); // the loot reminder covers the discard
  effs.filter(f => f.k === "pumpTarget").forEach(f => {
    if (/\band can't be blocked this turn\b/i.test(text) && !f.kws.includes("can't be blocked")) f.kws = [...f.kws, "can't be blocked"];
    if (/until end of turn\. untap (?:it|that creature)\b/i.test(text)) f.untap = true;
  });
  // Spectacular Tactics: "Put a +1/+1 counter on target creature you control. It gains hexproof until end of turn."
  { const cg = text.match(/counters? on target [a-z ]+?\. (?:it|that creature) gains ([a-z ,]+?) until end of turn/i); if (cg) effs.filter(f => f.k === "countersTarget").forEach(f => { f.kws = splitKws(cg[1]); }); }
  if (effs.some(f => f.k === "imprintLib")) drop(f => f.k === "fetch");
  drop(f => f.k === "countersEach" && /^of up to/i.test(f.what || "")); // Silkguard: "each of up to X target creatures" is a pick, not "each"
  if (effs.some(f => f.k === "regrow" && f.sacNext)) drop(f => f.k === "regrow" && !f.sacNext);
  if (effs.some(f => f.k === "dieGain")) { const g = effs.find(f => f.k === "dieGain").n; const i = effs.findIndex(f => f.k === "gain" && f.n === g); if (i >= 0) effs.splice(i, 1); }
  return effs;
}

function parseCond(cond, cardName) {
  let c = cond.toLowerCase().trim();
  // Ryan Sinclair → "Whenever Ryan attacks": a name without a comma can be shortened to its first word
  { const nm = String(cardName || "").split(" // ")[0].split("#")[0]; const w = nm.toLowerCase().split(/\s+/); if (!nm.includes(",") && w.length > 1 && !/^(the|a|an)$/.test(w[0])) c = c.replace(new RegExp(`^${w[0].replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b(?! ${w[1].replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`), w.join(" ")); }
  const short = cardName.split("#")[0].split(" // ")[0].split(",")[0].toLowerCase();
  if (/^(?:this land|[a-z ,'-]+?) or another land you control enters$/.test(c)) return { ev: "land" };
  if (/^the ring tempts you$/.test(c)) return { ev: "tempt" };
  if (/^a creature token you control leaves the battlefield$/.test(c)) return { ev: "tokleave", once: false };
  if (/^you attack$/.test(c) || /^you attack (?:a player|one or more players|an opponent|one or more opponents)$/.test(c) || /^one or more creatures attack$/.test(c)) return { ev: "youattack" };
  if (/^you gain life$/.test(c)) return { ev: "gainlife" };
  if (/^you cast a spell that targets (?:this creature|[a-z ,'-]+)$/.test(c)) return { ev: "heroic" }; // Heroic: the app fires it when your spell targets the creature
  if (/^this creature (?:attacks with another creature with greater power|trains)$/.test(c)) return { ev: "self-etb", enters: false, attacks: true, check: true }; // Training: only with a bigger attacker alongside
  if (/^you (?:planeswalk to|encounter) /.test(c)) return { ev: "self-etb", enters: true, attacks: false }; // Planechase: a plane or phenomenon arriving
  if (/^you play a land from exile or cast a spell from exile$/.test(c)) return { ev: "cast", what: "", fromEx: true }; // Pia Nalaar, Consul of Revival (exile land plays stay manual)
  if (/^one or more (?:modified|equipped|enchanted|tapped|untapped) creatures you control attack$/.test(c)) return { ev: "youattack", check: true }; // Akki Battle Squad: only if one of them is modified
  if (/^one or more cards leave your graveyard$/.test(c)) return { ev: "gyleave" };
  if (/^this creature mutates$/.test(c) || c === `${short} mutates`) return { ev: "mutates" };
  { const ex = c.match(/^you expend (\d+)$/); if (ex) return { ev: "expend", n: Number(ex[1]) }; }
  { const xp = c.match(/^a creature you control explores(?: an? (land|nonland) card)?$/); if (xp) return { ev: "explore", land: xp[1] ? xp[1] === "land" : null }; }
  { const ma = c.match(/^(two|three|four|five) or more creatures (you control )?attack(?: a player| one or more players)?$/); if (ma) return { ev: "youattack", minAtk: ({ two: 2, three: 3, four: 4, five: 5 })[ma[1]], anyPlayer: !ma[2] }; }
  { const wb = c.match(/^you attack with one or more ([a-z]+?)s$/); if (wb) return { ev: "typedAtk", types: [wb[1]], nontoken: false, other: false, oneOrMore: true }; }
  if (/^one or more creatures attack one of your opponents(?: or a planeswalker they control)?$/.test(c)) return { ev: "youattack" };
  if (/^you gain life for the first time each turn$/.test(c)) return { ev: "gainlife", first: true };
  if (/^(?:this creature|[a-z ,'-]+?) or another creature dies$/.test(c)) return { ev: "dies", nontoken: false, mine: false, opp: false, other: false };
  { const oz = c.match(/^(?:this creature|[a-z ,'-]+?) or another ([a-z]+) (you control )?dies$/); if (oz && !/^(creature|permanent|token)$/.test(oz[1])) return { ev: "dies", types: [oz[1]], nontoken: false, mine: !!oz[2], opp: false, other: false }; } // Vengeful Dead: "this creature or another Zombie"
  if (/^(?:a|one or more) tokens? you control leaves? the battlefield$/.test(c)) return { ev: "tokleave", once: /one or more/.test(c) };
  if (c === `${short} becomes tapped` || c === `${cardName.split("#")[0].split(" // ")[0].toLowerCase()} becomes tapped` || /^this (creature|permanent|artifact|land) becomes tapped$/.test(c) || c === `${short} become tapped`) return { ev: "selftap" };
  if (/^you put one or more -1\/-1 counters on a creature$/.test(c)) return { ev: "m1m1put" };
  if (/^(?:one or more |a )?-1\/-1 counters? (?:is|are) put on (?:a|one or more) creatures?$/.test(c)) return { ev: "m1m1put", check: true, askNote: "Fires on -1/-1 counters you put with the app; add any others by hand." }; // Flourishing Defenses, Wickersmith's Tools (your own counters; others' by hand)
  if (/^you discard (a|one or more) cards?$/.test(c)) return { ev: "discard", once: /one or more/.test(c) };
  { const dk = c.match(/^you discard (?:a|an) ((?:non)?[a-z]+(?:,? (?:or )?(?:non)?[a-z]+)*) card$/); if (dk) return { ev: "discard", once: false, check: true, askNote: `Only if you discarded a ${dk[1]} card.` }; } // Bone Miser, Surly Badgersaur: the app doesn't know which card
  if (/^you cycle or discard (?:another|a) card$/.test(c)) return { ev: "discard", once: false }; // Archfiend of Ifnir (cycling is caught where you cycle)
  if (/^an opponent discards (a|one or more) cards?$/.test(c)) return { ev: "oppdiscard", once: /one or more/.test(c) };
  if (c === `${short} dies` || c === `${cardName.split("#")[0].split(" // ")[0].toLowerCase()} dies` || /^this (creature|permanent|vehicle) dies$/.test(c)) return { ev: "selfdies" };
  if (/^you sacrifice (?:this (?:creature|aura|artifact|enchantment|permanent|equipment|vehicle|land)|it)$/.test(c) || c === `you sacrifice ${short}`) return { ev: "selfsac" };
  if (/^you choose a creature as your ring-bearer$/.test(c)) return { ev: "ringbearer" };
  const akw = c.match(/^(?:a|another) creature you control with ([a-z ]+?) attacks$/);
  if (akw && !c.startsWith(short)) return { ev: "attack", types: null, kw: akw[1].trim(), other: /^another/.test(c) };
  let am = c.match(/^(?:a|another) ((?:nontoken )?(?:[a-z]+ )*?)creature you control attacks$/) || c.match(/^(?:a|another) ([a-z, ]+?) you control attacks$/);
  if (am && !c.startsWith(short)) return { ev: "attack", types: am[1].trim() && !/^nontoken$/.test(am[1].trim()) ? splitTypes(am[1].replace(/\bcreature\b/, "").trim() || "creature") : null, other: /^another/.test(c) };
  { const so = c.match(/^(?:this creature|[a-z ,'-]+?) or another ([a-z]+) you control enters$/); if (so && so[1] !== "creature") return { ev: "typed", types: [so[1]], other: false, once: false }; }
  const nick = (() => { const w = cardName.split("#")[0].split(" // ")[0].split(",")[0].toLowerCase().split(" "); return [w.slice(0, 2).join(" "), w[0] !== "the" && w.length > 2 ? w[0] : null].filter(x => x && x.length > 3); })(); // "Rosie Cotton" for Rosie Cotton of South Lane
  if (/\b(enters?|attacks?)\b/.test(c) && (c.startsWith(short) || nick.some(k => new RegExp(`^${k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} (?:enters|attacks|enters or attacks)$`).test(c)) || /^this (creature|artifact|enchantment|permanent|land|vehicle|equipment|aura|saga|planeswalker|battle|spacecraft|class|siege|room|case|role)/.test(c)))
    return { ev: "self-etb", enters: /\benters?\b/.test(c), attacks: /\battacks?\b/.test(c) };
  if (/one or more creature tokens (you control )?enter|you create one or more creature tokens/.test(c)) return { ev: "tokens", once: true, creature: true };
  if (/you create one or more tokens|one or more tokens (you control )?enter|one or more tokens enter the battlefield under your control/.test(c)) return { ev: "tokens", once: true };
  if (/(a|another) (nontoken )?creature token (you control )?(enters|is created)/.test(c)) return { ev: "tokens", creature: true };
  if (/you create a token|a token (you control )?enters/.test(c)) return { ev: "tokens" };
  if (/^(?:this creature|[a-z ,'-]+?) dies or is put into exile from the battlefield$/.test(c) && (c.startsWith(short) || /^this /.test(c))) return { ev: "selfdies", leaves: true, askNote: "" }; // God-Eternals
  if (/^(equipped|enchanted) creature dies$/.test(c)) return null; // the app handles these (it knows what's attached)
  if (/(a|another) creature token (you control )?dies/.test(c)) return { ev: "dies", token: true };
  if (/^one or more other creatures die$/.test(c)) return { ev: "dies", nontoken: false, mine: false, opp: false, other: true, once: true };
  if (/^one or more (nontoken )?creatures you control die$/.test(c)) return { ev: "dies", nontoken: /nontoken/.test(c), mine: true, other: false, once: true };
  if (/^one or more nontoken creatures die$/.test(c)) return { ev: "dies", nontoken: true, mine: false, opp: false, other: false, once: true }; // Ghoulish Procession
  { const to = c.match(/^(?:a|an) ([a-z]+) an opponent controls dies$/); if (to && !/^(creature|permanent|token|card|player|source)$/.test(to[1])) return { ev: "dies", types: [singular(to[1])], nontoken: false, mine: false, opp: true, other: false }; } // Hansk: "a Zombie an opponent controls dies"
  { const ta = c.match(/^(?:a|an|another) ([a-z]+) (you control )?dies$/); if (ta && !/^(creature|permanent|token|card|player|source)$/.test(ta[1])) return { ev: "dies", types: [singular(ta[1])], nontoken: false, mine: !!ta[2], opp: false, other: /^another/.test(c) }; } // Hungry Lynx ("a Rat dies"), Atla Palani ("an Egg you control dies")
  { const td = c.match(/^(a|another|one or more) (nontoken )?(?:other )?([a-z]+(?:,? (?:or |and\/or )?[a-z]+)*) you control (?:dies|die)$/); if (td && !/\bcreatures?\b|\btokens?\b|\bpermanents?\b/.test(td[3]) && !c.startsWith(short)) return { ev: "dies", types: splitTypes(td[3]), nontoken: !!td[2], mine: true, opp: false, other: td[1] === "another" || /\bother\b/.test(c), once: td[1] === "one or more" }; }
  if (/\bdies\b/.test(c) && /\bcreature\b/.test(c)) return { ...(/\b(attacking|blocking|modified) creature\b|with an? (?:[a-z+/-]+ )?counter on it|dealt damage this turn/.test(c) ? { check: true } : {}), ev: "dies", nontoken: /nontoken/.test(c), mine: /you control/.test(c) && !/you don't control/.test(c), opp: /an opponent controls|you don't control/.test(c), other: /\banother\b/.test(c) && !c.startsWith(short) && !/^this (?:creature|permanent) or another\b/.test(c) };
  let m = c.match(/you sacrifice (one or more|a|an|another) ([\w -]+?)(?: you control)?$/);
  if (m) return { ev: "sac", what: m[2], once: m[1] === "one or more" };
  m = c.match(/(?:a|an|another) ([\w-]+) you control is put into a graveyard/);
  if (m) return { ev: "sac", what: m[1] };
  if (/a land (you control )?enters|a land enters the battlefield under your control/.test(c)) return { ev: "land" };
  { const pw = c.match(/^(?:one or more )?(another|a|other) (nontoken )?creatures? you control with power (\d+) or (greater|less) enters?$/);
    if (pw) return { ev: "creature", nontoken: !!pw[2], other: pw[1] !== "a", ...(pw[4] === "greater" ? { powMin: Number(pw[3]) } : { powMax: Number(pw[3]) }), ...(/^one or more/.test(c) ? { once: true } : {}) }; }
  if (/(another|a) (nontoken )?creature (you control )?enters/.test(c)) return { ev: "creature", nontoken: /nontoken/.test(c), other: /another/.test(c) };
  m = c.match(/^(a|an|another|one or more) (other )?([a-z ,/]+?) (?:you control )?enters?(?: the battlefield)?(?: under your control)?$/); if (m) m = [m[0], m[1], m[3], m[2]];
  if (m && !/\b(opponent|player)\b/.test(m[2])) return { ev: "typed", types: splitTypes(m[2].replace(/^nontoken /, "")), other: m[1] === "another" || !!m[3], once: m[1] === "one or more", ...(/^nontoken /.test(m[2]) ? { nontoken: true } : {}) };
  if (/one or more \+1\/\+1 counters are put on (?:a|one or more) (?:creature|permanent)s? you control/.test(c)) return { ev: "counters", once: /one or more (?:creature|permanent)s/.test(c) }; // Shalai and Hallar: "on a creature" triggers once per creature
  if (/^you commit a crime$/.test(c)) return { ev: "crime" };
  { const om = c.match(/^one or more ([a-z]+?)s? you control attack(?: a player| one or more players| an opponent)?$/); if (om && om[1] !== "creature") return { ev: "typedAtk", types: [om[1]], nontoken: false, other: false, oneOrMore: true }; }
  { const aw = c.match(/^(a|an) ([a-z]+) attacks$/); if (aw && !["creature", "player", "opponent", "permanent", "token"].includes(aw[2]) && !c.startsWith(short)) return { ev: "typedAtk", types: [aw[2]], nontoken: false, other: false }; }
  { const ta = c.match(/^(a|an|another) ((?:nontoken |non-[a-z]+ )?[a-z]+(?: or [a-z]+)?) you control attacks$/); if (ta && !c.startsWith(short)) return { ev: "typedAtk", types: splitTypes(ta[2].replace(/^nontoken /, "")), nontoken: /nontoken/.test(ta[2]), other: ta[1] === "another" }; }
  if (/^a player sacrifices a permanent$/.test(c)) return { ev: "sac", what: "" };
  if (/^a creature attacks$/.test(c)) return { ev: "attack", types: null, other: false };
  if (/^a player sacrifices another permanent$/.test(c)) return { ev: "sac", what: "", notSelf: true };
  if (/^you create or sacrifice a token$/.test(c)) return { ev: "tokOrSac" };
  if (/^a creature is put into your graveyard from the battlefield$/.test(c)) return { ev: "dies", nontoken: true, mine: true, opp: false, other: false };
  if (/^you draw a card$/.test(c) || /^you draw a card except the first one you draw in each of your draw steps$/.test(c)) return { ev: "youdraw", exceptFirst: /except the first/.test(c) };
  { const y3 = c.match(/^you draw your (second|third) card (?:in a|each) turn$/); if (y3) return { ev: "youdraw", nth: { second: 2, third: 3 }[y3[1]] }; } // Sneaky Snacker, Tamiyo
  { const yn = c.match(/^you draw your (first|second|third) card each turn$/); if (yn) return { ev: "youdraw", nth: { first: 1, second: 2, third: 3 }[yn[1]] }; }
  if (/^you play a land or cast a spell$/.test(c)) return { ev: "playOrCast" };
  m = c.match(/(an opponent|a player|another player|enchanted opponent) draws (a card|one or more cards|cards?|their (?:first|second) card each turn)/);
  if (m) return { ev: "oppdraw", once: /one or more/.test(m[2]), self: m[1] === "a player", exceptFirst: /except the first one they draw in each of their draw steps/.test(c), ...(/second card each turn/.test(m[2]) ? { nth: 2 } : /first card each turn/.test(m[2]) ? { nth: 1 } : {}), ...(m[1] === "enchanted opponent" ? { enchOpp: true } : {}) };
  m = c.match(/(an opponent|a player|another player|each opponent) casts (an(?= )|a(?= )|their first|their second|another)? ?(.*?) ?spell(?: with mana value (\d+) or (less|greater))?/);
  if (m) return { ...(/with the same name as/.test(c) ? { check: true } : {}), ev: "oppcast", what: m[3] || "", self: m[1] === "a player", first: m[2] === "their first", ...(m[2] === "their second" ? { nth: 2 } : {}), ...(m[4] ? (m[5] === "less" ? { mvMax: Number(m[4]) } : { mvMin: Number(m[4]) }) : {}) };
  m = c.match(/you cast (?:(an|a|your first|your second|your third|another) )?(.*?) ?spell(?: with mana value (\d+) or greater)?/);
  if (m) m = [m[0], m[2], m[3], m[1]];
  if (m) return { ev: "cast", ...(/^your (second|third)$/.test(m[3] || "") && !m[1] ? { nth: { "your second": 2, "your third": 3 }[m[3]] } : {}), what: (m[1] || "").replace(/\s*from anywhere other than your hand/, ""), ...(m[2] ? { mvMin: Number(m[2]) } : {}), ...(/from anywhere other than your hand/.test(c) ? { notHand: true } : {}), ...(/\bspell from exile$/.test(c) ? { fromEx: true } : {}), ...(/\bspell from your graveyard$/.test(c) ? { fromGy: true } : {}) };
  // Spinneret and Spiderling: "whenever you attack with two or more Spiders"
  m = c.match(/^you attack with (two|three|four|five|six|seven|eight|\d+) or more ([a-z ]+?)$/);
  if (m) return { ev: "attackN", min: num(m[1]), types: splitTypes(m[2].replace(/\bcreatures?\b/, "").trim() || "creature") };
  // Attack conditions the app can't check itself: a reminder with the condition spelled out (once per attack, or per qualifying attacker)
  if (/^you attack with (?!(?:two|three|four|five|six|seven|eight|\d+) or more)/.test(c) || /^equipped creature and at least one other creature attack$/.test(c) || /^you attack (?:a player|the player|one of your opponents)\b/.test(c)) return { ev: "youattack", check: true, askNote: `Only if it applies: “whenever ${c}”.` }; // Ainok Strike Leader, Akiri, Loot Dispute
  if (/^one or more [a-z0-9 ,/'+-]+? (?:you control )?attack(?: a player| one or more players| an opponent| one of your opponents)?$/.test(c) && !/opponents? controls?/.test(c)) return { ev: "youattack", check: true, askNote: `Only if it applies: “whenever ${c}”.` }; // Alibou, The Earth King
  if (/^(?:a|an|another) [a-z ,/'+-]*?creature (?:you control )?(?:with|that's|that is|without) [^,]+? attacks(?: a player| one of your opponents| an opponent)?$/.test(c) || /^an? (?:enchanted|equipped|modified|legendary|token) [a-z ,'-]*?creature (?:or [a-z ]+ )?you control attacks$/.test(c) || /^(?:a|an|another) [a-z ,/'-]+? you control (?:with|that's) [^,]+? attacks$/.test(c))
    return { ev: "attack", types: null, other: false, check: true, askNote: `Only for an attacker that fits: “whenever ${c}”.` }; // Duskana, MacCready, Tenured Inkcaster, Reyav, Kestia, Nahiri
  return null;
}

const abCache = new Map();
// After refreshing card text from Scryfall, forget what was parsed before
export function clearAbilityCaches() { abCache.clear(); spellCache.clear(); actCache.clear(); }
export const abilitiesOf = card => {
  if (!abCache.has(card.n)) abCache.set(card.n, parseAbilities(card));
  return abCache.get(card.n);
};

// Parse a card's rules text once into triggers, replacement effects and P/T rules
// Keywords whose reminder text is the real rule: spell them out so the normal parsers see them
const KW_N = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
const kwNum = n => KW_N[Number(n)] || n;
export function kwExpand(o) {
  return String(o || "")
    // keyword triggers whose rules live only in reminder text (which the parser skips): spell them out
    .replace(/^Annihilator (\d+)[^\n]*/m, (_, n) => `Whenever this creature attacks, defending player sacrifices ${kwNum(n)} permanents of their choice.`)
    .replace(/^Dethrone\b[^\n]*/m, "Whenever this creature attacks, if defending player has the most life or is tied for most life, put a +1/+1 counter on this creature.")
    .replace(/^Fabricate (\d+)[^\n]*/m, (_, n) => `When this creature enters, choose one —\n• Put ${kwNum(n)} +1/+1 counter${n === "1" ? "" : "s"} on this creature.\n• Create ${kwNum(n)} 1/1 colorless Servo artifact creature token${n === "1" ? "" : "s"}.`)
    .replace(/^Melee\b[^\n]*/m, "Whenever this creature attacks, it gets +1/+1 until end of turn for each opponent you attacked this combat.")
    .replace(/^Renown (\d+)[^\n]*/m, (_, n) => `When this creature deals combat damage to a player, if it isn't renowned, put ${kwNum(n)} +1/+1 counter${n === "1" ? "" : "s"} on it and it becomes renowned.`)
    .replace(/^Soulshift (\d+)[^\n]*/m, (_, n) => `When this creature dies, you may return target Spirit card with mana value ${n} or less from your graveyard to your hand.`)
    .replace(/^Evoke[—-][^\n]*|^Evoke (?:\{[^}]+\})+[^\n]*/m, m => `${m}\nWhen this creature enters, if its evoke cost was paid, its controller sacrifices it.`)
    .replace(/^Fading (\d+)[^\n]*/m, (_, n) => `This permanent enters with ${kwNum(n)} fade counters on it.\nAt the beginning of your upkeep, remove a fade counter from this permanent. If you can't, sacrifice it.`)
    .replace(/^Ravenous\b[^\n]*/m, "This creature enters with X +1/+1 counters on it.\nWhen this creature enters, if X is 5 or more, draw a card.").replace(/^Modular (\d+)[^\n]*/m, "This creature enters with $1 +1/+1 counters on it.\nWhen this creature dies, you may put its +1/+1 counters on target artifact creature.")
    // keywords whose whole rule is a trigger in their reminder text (Afterlife, Battle cry, Mobilize, Increment, Hideaway, Partner with): use the reminder as the trigger
    .replace(/^([^\n(]*\b(?:Afterlife|Battle cry|Mobilize|Increment|Hideaway|Partner with)\b[^\n(]*)\(((?:When|Whenever|At the beginning)[^)]*)\)[^\n]*/gim, (m, kw, rem) => `${m}\n${rem.replace(/^When this permanent is put into a graveyard from the battlefield,/i, "When this creature dies,")}`)
    // Sunburst and Devour: counters on entering that depend on how it was cast or what was sacrificed: ask on entering
    .replace(/^Sunburst\b[^\n]*/m, m => `${m}\nWhen this permanent enters, it gets one ${/creature enters/i.test(m) ? "+1/+1" : "charge"} counter for each color of mana spent to cast it. Add them by hand on the card.`)
    .replace(/^Devour (land |artifact )?(\d+)[^\n]*/m, (m, what, n) => `${m}\nWhen this creature enters, devour: you may sacrifice any number of ${(what || "creature ").trim()}s; it gets ${n === "1" ? "one +1/+1 counter" : `${kwNum(n)} +1/+1 counters`} for each. Move them to the graveyard and add the counters by hand on the card.`)
    // "Whenever this creature attacks or dies, …" (Balor), "deals combat damage to a player or dies" (Park Heights Maverick): two triggers, one effect
    .replace(/^((?:[^—\n]{1,40} — )?)(Whenever|When) (this creature|this permanent|(?!a |an |another |one or more )[A-Z][^,\n]*?) ((?:attacks|deals combat damage to a player|blocks)) or dies, ([^\n]+)/gm, (m, pre, w, who, a, e) => `${pre}Whenever ${who} ${a}, ${e}\nWhen ${who} dies, ${e}`)
    // "Whenever you cast a black spell or a Swamp you control enters, …" (the Magus Staffs)
    .replace(/^Whenever you cast (an? [^,\n]+? spell) or (an? [^,\n]+? enters), ([^\n]+)/gm, (_, a, b, e) => `Whenever you cast ${a}, ${e}\nWhenever ${b}, ${e}`)
    // "When this creature enters or dies, …" (Mogg War Marshal, Stitcher's Supplier), "another creature you control enters or dies" (Pelt Collector), "enters or becomes tapped"
    .replace(/^(When|Whenever) ([^,\n]+?) enters or (dies|becomes tapped|leaves the battlefield), ([^\n]+)/gm, (_, w, who, b, e) => `${w} ${who} enters, ${e}\n${w} ${who} ${b}, ${e}`)
    // "When this artifact enters and when you sacrifice it, …" (Carrot Cake, Heaped Harvest)
    .replace(/^(When this [a-z]+ enters) and (when you sacrifice it), ([^\n]+)/gm, (_, a, b, e) => `${a}, ${e}\nWhen you sacrifice it, ${e}`)
    // "Whenever Millicent or another nontoken Spirit you control dies or deals combat damage to a player, …"
    .replace(/^(Whenever [^,\n]+?) dies or deals combat damage to a player, ([^\n]+)/gm, (_, a, e) => `${a} dies, ${e}\n${a} deals combat damage to a player, ${e}`)
    // "At the beginning of your upkeep and whenever you cast a white spell, …" (Shrines)
    .replace(/^(At the beginning of [^,\n]+?) and (whenever [^,\n]+), ([^\n]+)/gm, (_, a, b, e) => `${a}, ${e}\n${b[0].toUpperCase()}${b.slice(1)}, ${e}`)
    // "When X enters and at the beginning of your upkeep, …" (Minsc & Boo): two triggers with one effect
    .replace(/^(?:[^—\n]{1,40} — )?(When [^,\n]*? enters) and (at the beginning of [^,\n]+), ([^\n]+)/m, (_, a, b, e) => `${a}, ${e}\n${b[0].toUpperCase()}${b.slice(1)}, ${e}`)
    .replace(/^Training\b[^\n]*/m, "Whenever this creature attacks with another creature with greater power, put a +1/+1 counter on this creature.")
    .replace(/^Outlast ((?:\{[^}]+\})+)[^\n]*/m, "$1, {T}: Put a +1/+1 counter on this creature. Activate only as a sorcery.")
    .replace(/^Mentor\b[^\n]*/m, "Whenever this creature attacks, put a +1/+1 counter on target attacking creature with lesser power.")
    .replace(/^Bloodthirst (\d+)[^\n]*/m, "This creature enters with $1 +1/+1 counters on it if an opponent was dealt damage this turn.")
    .replace(/^Unleash\b[^\n]*/m, "This creature enters with a +1/+1 counter on it if you choose to unleash it. It can't block as long as it has a +1/+1 counter on it.");
}
export function parseAbilities(card) {
  const out = { trig: [], repl: [], cda: null };
  if (!card?.o) return out;
  card = { ...card, o: kwExpand(card.o) };
  const allLines = (/^Exploit\b/m.test(card.o) ? card.o.replace(/^Exploit\b[^\n]*\n?/m, "").replace(/^When (this creature|[^,\n]+?) exploits a creature, (?:you may )?/gm, "When $1 enters, you may sacrifice a creature. If you do, ") : card.o).split("\n");
  // Class levels: abilities under "{1}{B}: Level 2" only work once the Class reaches that level
  let curLvl = 1, curLine = "";
  const push0 = out.trig.push.bind(out.trig);
  out.trig.push = (...a) => push0(...a.map(x => ({ ...x, ...(curLvl > 1 ? { lvl: curLvl } : {}), ...(/^Max speed — /i.test(curLine.trim()) ? { maxSpeed: true } : {}), ...(/this ability triggers only once each turn|do this only once each turn|^(?:[^\n]* — )?whenever [^,]*\bfor the first time (?:each|this) turn\b/i.test(curLine) ? { onceTurn: true } : {}) })));
  for (let li = 0; li < allLines.length; li++) {
    let line = allLines[li];
    curLine = line;
    const lv = line.trim().match(/^(?:\{[^}]+\})+: Level (\d+)$/);
    if (lv) { curLvl = Number(lv[1]); continue; }
    line = line.replace(/\([^)]*\)/g, "").replace(/\s+/g, " ").trim();
    line = line.replace(/^[^—:{}]{1,60} — /, ""); // ability words like "Landfall —"
    const low = line.toLowerCase();
    if (/token/.test(low) && /twice that many/.test(low)) { out.repl.push({ kind: "double" }); continue; }
    if (/(?:counters would be put on an artifact or creature you control|if you would put one or more counters on a permanent you control), (?:put )?that many plus one of each of those kinds/.test(low)) { out.repl.push({ kind: "cplus", n: 1, perm: true }); continue; }
    if (/creature tokens would be created under your control, three times that many/.test(low)) { out.repl.push({ kind: "triple", creature: true }); continue; }
    let m = line.match(/those tokens plus (that many|an additional|a|an|one) (.*?)tokens? (?:are|is) created instead/i) || line.match(/instead create those tokens plus (that many|an additional|a|an|one) (.*?)tokens?\.?$/i);
    if (m) {
      const name = capName(m[2]);
      if (name) out.repl.push({ kind: "plus", name, many: /that many/i.test(m[1]), desc: m[2].trim() });
      continue;
    }
    if (/if you would create (?:a|one or more) clue, food, or treasure tokens?/.test(low)) { out.repl.push({ kind: "manufactor" }); continue; }
    { const ra = low.match(/^if one or more artifact tokens would be created under your control, that many (\d+)\/(\d+) ([a-z]+) ([a-z]+) creature tokens with ([a-z ]+?) are created instead/); if (ra) { out.repl.push({ kind: "artTokInstead", name: ra[4][0].toUpperCase() + ra[4].slice(1), desc: `${ra[1]}/${ra[2]} ${ra[3]} ${ra[4][0].toUpperCase() + ra[4].slice(1)} creature with ${ra[5]}` }); continue; } }
    // Bilbo, Fellow Conspirator: "If you would create a Food token, instead create a Food token and a Treasure token."
    m = line.match(/^if you would create an? ([a-z]+) token, instead create an? \1 token and an? ([a-z]+) token/i);
    if (m) { out.repl.push({ kind: "plusOn", on: capName(m[1]), name: capName(m[2]) }); continue; }
    if (/^if one or more \+1\/\+1 counters would be put on an? (creature|permanent|artifact or creature) you control, that many plus one/.test(low)) { out.repl.push({ kind: "cplus", n: 1, p1p1: true, ...(/(permanent|artifact or creature) you control/.test(low) ? { perm: true } : {}) }); continue; }
    if (/(counters? would be put on (?:a|an) (?:creature|permanent|artifact or creature)(?:, spacecraft, or planet)?(?:[^,]* you control)?|if an effect would put one or more counters on a permanent you control|^if you would put one or more counters on a permanent or player)[^.]*twice that many/.test(low)) {
      out.repl.push({ kind: "cdouble", p1p1: /\+1\/\+1 counters would/.test(low) }); continue;
    }
    if (/power and toughness are each equal to the number of cards in your hand/i.test(line)) out.cda = "hand";
    m = line.match(/power and toughness are each equal to the number of (lands|creatures|artifacts) you control/i);
    if (m) out.cda = m[1].toLowerCase().slice(0, -1);
    m = line.match(/power and toughness are each equal to the number of (creature |land |instant and sorcery )?cards in your graveyard/i);
    if (m) out.cda = `gy${m[1] ? ":" + m[1].trim().split(" ")[0] : ""}`;
    let cond, cond2 = null, text;
    const lnC = line.replace(/^at the beginning of combat on your turn,/i, "At the beginning of your combat,").replace(/^at the beginning of combat on each opponent's turn,/i, "At the beginning of each opponent's combat,").replace(/^at the beginning of each combat,/i, "At the beginning of each combat,");
    const lnP = lnC.replace(/^(?:survival — )?at the beginning of (?:each of )?your (?:postcombat|second) main phases?,/i, "At the beginning of your postcombat main phase,"); // Kona: "Survival — … second main phase"
    // Auras and curses: "the upkeep of enchanted creature's controller", "enchanted player's upkeep", "the chosen player's upkeep" → every upkeep, with whose it really is
    const whoUp = /^at the beginning of the upkeep of enchanted creature's controller, that player loses \d+ life|^at the beginning of the chosen player's upkeep, [^,]+? deals x damage to that player/i.test(lnP) ? null : lnP.match(/^at the beginning of (?:the upkeep of (enchanted creature's controller|the exiled card's owner)|(enchanted player's|the chosen player's|that player's) (?:first )?upkeep(?: each turn)?|each of that player's upkeeps|the end step|each upkeep)[^,]*,/i);
    const lnQ = whoUp ? lnP.replace(whoUp[0], /end step/i.test(whoUp[0]) ? "At the beginning of each end step," : "At the beginning of each upkeep,") : lnP;
    const ph = lnQ.match(/^at the beginning of (your|each|each player's|each opponent's) (upkeep|draw step|first main phase|precombat main phase|postcombat main phase|main phase|combat|end step|next end step)[^,]*, (.*)$/i);
    if (ph) {
      const phase = /postcombat/i.test(ph[2]) ? "main2" : /combat/i.test(ph[2]) ? "combat" : /upkeep/i.test(ph[2]) ? "upkeep" : /draw/i.test(ph[2]) ? "draw" : /main/i.test(ph[2]) ? "main1" : "end";
      const whose = /opponent/i.test(ph[1]) ? "opp" : /^your$/i.test(ph[1]) ? "your" : "each";
      cond = { ev: "phase", phase, whose, ...(whoUp && !/end step|each upkeep/i.test(whoUp[0]) ? { check: true, askNote: `Only on ${(whoUp[1] || whoUp[2] || "that player's").replace(/'s$/, "")}'s upkeep.` } : {}) };
      text = ph[3];
      // Tippy-Toe: "At the beginning of your end step, if you gained life this turn, draw a card."
      if (/^if you gained life this turn, /i.test(text)) { cond = { ...cond, ifGained: true }; text = text.replace(/^if you gained life this turn, /i, ""); }
      { const gn = text.match(/^if you(?:'ve)? gained (\d+|two|three|four|five|six|seven|eight|nine|ten) or more life this turn, /i); if (gn) { cond = { ...cond, ifGainedN: num(gn[1]) || Number(gn[1]) }; text = text.slice(gn[0].length).replace(/^\w/, c => c.toUpperCase()); } }
      if (/^if a creature died this turn, /i.test(text)) { cond = { ...cond, ifDied: true }; text = text.replace(/^if a creature died this turn, /i, "").replace(/^\w/, c => c.toUpperCase()); }
      if (/^if no creatures are on the battlefield, /i.test(text)) { cond = { ...cond, ifNoCreatures: true }; text = text.replace(/^if no creatures are on the battlefield, /i, "").replace(/^\w/, c => c.toUpperCase()); }
      { const nn = text.match(/^if you control no ([A-Z][a-z]+)s, /); if (nn) { cond = { ...cond, ifNone: nn[1].toLowerCase() }; text = text.slice(nn[0].length).replace(/^\w/, c => c.toUpperCase()); } }
      if (/^if you have the city's blessing, /i.test(text)) { cond = { ...cond, ifBlessing: true }; text = text.replace(/^if you have the city's blessing, /i, ""); }
      const ol = text.match(/^if an opponent lost (\d+|one|two|three|four|five) or more life this turn, /i) || text.match(/^if an opponent lost life this turn, /i);
      if (ol) { cond = { ...cond, ifOppLost: ol[1] ? num(ol[1]) || Number(ol[1]) : 1 }; text = text.slice(ol[0].length); }
      { const dz = text.match(/^if (an opponent is the monarch|you're the monarch|you aren't the monarch|you have the initiative|you've completed a dungeon), /i); if (dz) { cond = { ...cond, ifDesig: dz[1].toLowerCase() }; text = text.slice(dz[0].length).replace(/^\w/, c => c.toUpperCase()); } }
      const ntt = text.match(/^if it isn't that player's turn, /i);
      if (ntt) { cond = { ...cond, notTheirTurn: true }; text = text.slice(ntt[0].length).replace(/^\w/, c => c.toUpperCase()); }
      const icd = text.match(/^if you control (two|three|four|five|six|seven|eight|\d+) or more lands with different names, /i);
      if (icd) { cond = { ...cond, ifCount: { n: num(icd[1]) || Number(icd[1]), type: "land", distinct: true } }; text = text.slice(icd[0].length).replace(/^\w/, c => c.toUpperCase()); }
      const ic = text.match(/^if you control (two|three|four|five|six|seven|eight|\d+) or more ([a-z]+?)s, /i);
      if (ic) { cond = { ...cond, ifCount: { n: num(ic[1]) || Number(ic[1]), type: ic[2].toLowerCase() } }; text = text.slice(ic[0].length).replace(/^\w/, c => c.toUpperCase()); }
      const al = text.match(/^if a player lost (\d+|one|two|three|four|five) or more life this turn, /i);
      if (al) { cond = { ...cond, ifAnyLost: num(al[1]) || Number(al[1]) }; text = text.slice(al[0].length); }
      { const ic2 = text.match(/^if there are (\w+) or more counters among artifacts and creatures you control, /i); if (ic2) { cond = { ...cond, ifCtrs: num(ic2[1]) || Number(ic2[1]) }; text = text.slice(ic2[0].length).replace(/^\w/, c => c.toUpperCase()); } }
    } else {
      // a comma inside the card's own name ("When Gonti, Lord of Luxury enters, …") would split the line in the wrong place
      const full = card.n.split("#")[0].split(" // ")[0];
      const ln = (full.includes(",") ? line.split(full).join(full.split(",")[0]) : line).replace(/^whenever another creature dies, or a creature card is put into a graveyard from anywhere other than the battlefield, or a creature card leaves your graveyard, /i, "Whenever another creature dies, "); // Syr Konrad: the other two cases are by hand
      m = ln.match(/^(?:whenever|when) ([^,]+), (.*)$/i);
      if (!m) continue;
      { const tp = ln.match(/^whenever an opponent attacks you with two or more creatures, draws their second card each turn, or casts their second spell each turn, (.+)$/i);
        if (tp) { out.trig.push({ cond: { ev: "oppdraw", nth: 2 }, text: tp[1], effs: [], auto: false }); out.trig.push({ cond: { ev: "oppcast", what: "", nth: 2 }, text: tp[1], effs: [], auto: false }); continue; } }
      if (!parseCond(m[1], card.n)) { // the condition itself may contain commas: try each later comma
        const head = ln.match(/^(?:whenever|when) /i)[0];
        for (let i = ln.indexOf(", ", head.length + m[1].length + 1); i > 0; i = ln.indexOf(", ", i + 1)) {
          const cand = ln.slice(head.length, i);
          if (/, if /i.test(cand)) break;
          if (parseCond(cand, card.n)) { m = [ln, cand, ln.slice(i + 2)]; break; }
        }
      }
      const both = m[1].match(/^(.+?) and when(?:ever)? (.+)$/i);
      cond = parseCond(both ? both[1] : m[1], card.n);
      cond2 = both ? parseCond(both[2], card.n) : null;
      if (!cond && cond2) { cond = cond2; cond2 = null; }
      if (!cond) continue;
      text = m[2];
      // "When The One Ring enters, if you cast it, …": only when it was cast, not put onto the battlefield
      if (/^if you cast it(?: from your hand)?, /i.test(text)) { cond = { ...cond, castOnly: true }; text = text.replace(/^if you cast it(?: from your hand)?, /i, "").replace(/^\w/, c => c.toUpperCase()); }
      if (/^if it was a creature, /i.test(text)) text = text.replace(/^if it was a creature, /i, ""); // only creatures "die" here anyway
      // Roiling Vortex: "if no mana was spent to cast that spell" (only free casts the app knows about)
      if (/^if no mana was spent to cast (?:it|that spell), /i.test(text)) { cond = { ...cond, noMana: true }; text = text.replace(/^if no mana was spent to cast (?:it|that spell), /i, "").replace(/^\w/, c => c.toUpperCase()); }
      // Lux Artillery: "if there are thirty or more counters among artifacts and creatures you control"
      { const ic = text.match(/^if there are (\w+) or more counters among artifacts and creatures you control, /i); if (ic) { cond = { ...cond, ifCtrs: num(ic[1]) || Number(ic[1]) }; text = text.slice(ic[0].length).replace(/^\w/, c => c.toUpperCase()); } }
      if (/^if it was kicked, /i.test(text)) { cond = { ...cond, ifKicked: true }; text = text.replace(/^if it was kicked, /i, "").replace(/^\w/, c => c.toUpperCase()); }
      if (/^if it isn't that player's turn, /i.test(text)) { cond = { ...cond, notTheirTurn: true }; text = text.replace(/^if it isn't that player's turn, /i, "").replace(/^\w/, c => c.toUpperCase()); }
      { const icd = text.match(/^if you control (two|three|four|five|six|seven|eight|\d+) or more lands with different names, /i);
        if (icd) { cond = { ...cond, ifCount: { n: num(icd[1]) || Number(icd[1]), type: "land", distinct: true } }; text = text.slice(icd[0].length).replace(/^\w/, c => c.toUpperCase()); }
        const ic = text.match(/^if you control (two|three|four|five|six|seven|eight|\d+) or more ([a-z]+?)s, /i);
        if (ic) { cond = { ...cond, ifCount: { n: num(ic[1]) || Number(ic[1]), type: ic[2].toLowerCase() } }; text = text.slice(ic[0].length).replace(/^\w/, c => c.toUpperCase()); } }
    }
    const effs = parseEffects(text, card.n);
    const may = /\b(?:you|each player|each opponent|that player|target player|they|its controller) may\b/i.test(text) && !new RegExp(`^you may put an? [a-z0-9+/-]+ counter on (it|this creature|${card.n.split("#")[0].split(" // ")[0].split(",")[0].replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[^.]*)\\.?$`, "i").test(text.trim());
    const emin = new RegExp(`^if (?:${card.n.split(" // ")[0].split(",")[0].replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}|${card.n.split(" ")[0].replace(/[^A-Za-z'-]/g, "")}|it) is in the command zone`, "i").test(text);
    text = text.replace(/^if (?:it's|they're) not a token, /i, ""); // The Notary Hobbits: entering this way is never a token copy
    text = text.replace(new RegExp(`^if (?:${card.n.split(" // ")[0].split(",")[0].replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}|${card.n.split(" ")[0].replace(/[^A-Za-z'-]/g, "")}|it) is in the command zone(?: or on the battlefield)?, `, "i"), ""); // eminence: true whenever this fires
    { const ol2 = text.match(/^if an opponent lost (\d+|one|two|three|four|five) or more life this turn, /i) || text.match(/^if an opponent lost life this turn, /i); if (ol2) { cond = { ...cond, ifOppLost: ol2[1] ? num(ol2[1]) || Number(ol2[1]) : 1 }; text = text.slice(ol2[0].length); } }
    const unIf = (/^if\b/i.test(text.trim()) && !/^if you do\b/i.test(text.trim())) || /\bif (?:an opponent|a player|you) (?:lost|gained|cast|attacked|drew)\b[^.]*\bthis turn\b|\bfaces? a villainous choice\b/i.test(text); // a condition the app can't check (Davros), or an opponent's choice: remind instead of applying
    const auto = (effs.length > 0 && effs.every(f => f.k === "scute")) || !may && !unIf && !cond?.check && effs.length > 0 && !/^if mana from a treasure was spent to cast it\b/i.test(text) && !NEEDS_PLAYER.test(text.replace(/equal to the number of noncreature spells they've cast this turn/i, "").replace(/,? where x is the number of (?:other )?[a-z, ]+? you control/i, "").replace(/ for each (other )?[a-z ,/]+? you control/i, m => effs.some(f => f.per) ? "" : m).replace(/ for each [a-z+/1-]+ counters? on [^.,]*/gi, m => effs.some(f => f.perCtr || f.k === "drawPer") ? "" : m).replace(/\badd (\{[^}]+\})+ for each [^.]*/i, "").replace(/if equipped creature is an? [a-z]+, put [^.]*? instead/i, ""));
    const residual = text.replace(/^tap (?:up to one )?target [a-z ]+?\. it doesn't untap during its controller's untap step for as long as you control [^.]+\.?/i, m => effs.some(f => f.k === "tapLock") ? "" : m).replace(/^exile [^.]+\. return it to the battlefield under its owner's control at the beginning of the next end step\.?/i, m => effs.some(f => f.k === "exileRet") ? "" : m).replace(/\breturn an? (?:land|creature|permanent) you control to its owner's hand/i, m => effs.some(f => f.k === "bounceOwn") ? "" : m).replace(/search your library[^.]*?(onto the battlefield( tapped)?|into your hand|on top( of your library)?|into your graveyard|card, exile it)/i, "").replace(/\bcreate\b[^.]*?tokens?/gi, "").replace(/put (?:a|an|one|two|three|\d+) \+1\/\+1 counters? on equipped creature\.?(?: if equipped creature is an? [a-z]+, put [^.]*? instead\.?)?/gi, m => effs.some(f => f.k === "eqCtr") ? "" : m).replace(/put (a|an|one|two|three|four|five|\d+) \S+ counters? on [^.,]*/gi, m => effs.some(f => f.k === "selfc" || f.k === "countersEach") ? "" : m).replace(/\bdraw a card for each [^.]*/gi, m => effs.some(f => f.k === "drawPer") ? "" : m).replace(/\bdeals (?:\w+ )?damage to (each opponent|them|that player)\b(?: equal to the number of noncreature spells they've cast this turn)?/gi, m => effs.some(f => (f.k === "drain" && f.dmg) || f.k === "dmgThem") ? "" : m)
      .replace(/\buntap (all|up to \w+|those) [a-z ,]+?(you control)?(?=[.,]|$)/gi, m => effs.some(f => f.k === "untapAll" || f.k === "untapN") ? "" : m);
    const selfN = card.n.split(" // ")[0].split(",")[0].replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const rest = (effs.some(f => f.k === "dieReturn") ? residual.replace(/return it to the battlefield under its owner's control\. it's an enchantment\.?/i, "") : residual)
      .replace(/\bmill (?:a|an|one|two|three|four|five|six|\w+) cards?/gi, m => effs.some(f => f.k === "mill") ? "" : m)
      .replace(/\bproliferate(?: twice)?/gi, m => effs.some(f => f.k === "prolif") ? "" : m)
      .replace(/\bdeals? \w+ damage to each (?:other )?(?:creature|planeswalker)[^.]*/gi, m => effs.some(f => f.k === "dmgAll") ? "" : m)
      .replace(new RegExp(`\\buntap (?:this creature|it|${selfN})\\b`, "i"), m => effs.some(f => f.k === "untapSelf") ? "" : m)
      .replace(/that's a copy of (?:it|this creature)[^.]*/gi, m => effs.some(f => f.k === "selfCopies") ? "" : m)
      .replace(/\breturn all land cards from your graveyard to the battlefield(?: tapped)?/gi, m => effs.some(f => f.k === "regrow") ? "" : m);
    // a plain "draw N" the effects don't cover becomes its own draw reminder instead of "partly applied"
    const dm = !effs.some(f => /draw|rummage|loot/i.test(f.k)) && !/^if mana from a treasure was spent/i.test(text) && !/second time this ability has resolved this turn/i.test(text) && rest.match(/\b(?:you )?draws? (a|one|two|three|four|five|six|seven|\d+) cards?\b(?!,? then discard)/i);
    const drawRest = dm ? num(dm[1]) || 1 : 0;
    const partial = auto && EXTRA_ACTIONS.test((dm ? rest.replace(dm[0], "") : rest).replace(/\s*if this is the second time this ability has resolved this turn, draw a card\.?/i, "").replace(/\bdraw (?:a|one|two|three) cards?, then discard (?:a|one|two) cards?/gi, m => effs.some(f => f.k === "loot") ? "" : m));
    const choice = /\btokens? or (a|an)\b/i.test(text) && effs.filter(f => f.k === "tok").length > 1;
    const pun = parsePunisher(text, card.n);
    if (pun) { out.trig.push({ cond, text, effs: [], auto: false, punish: pun }); continue; }
    const modal = text.match(/choose (one or more|one or both|any number|up to one|up to two|one|two|three|up to that many)\b[^—]*—\s*$/i);
    if (modal) { // "choose up to one" (Hullbreaker Horror) is "choose one" that may be skipped (Done)
      const payN = text.match(/you may pay ((?:\{[^}]+\})+) up to (one|two|three|four|\d+) times/i);
      out.trig.push({ cond, text, effs: [], auto: false, modes: parseModes(allLines, li + 1, card.n), pick: /one or more|one or both|any number|up to that many|up to two/i.test(modal[1]) ? "multi" : modal[1].toLowerCase().replace(/^up to /, ""), ...(payN ? { note: `Pay ${payN[1]} for each mode you choose (up to ${payN[2]}).` } : {}) });
      continue;
    }
    if (/\.\s*otherwise,/i.test(text) && auto) { out.trig.push({ cond, text, effs, auto: false, partial, may, choice }); if (cond2) out.trig.push({ cond: cond2, text, effs, auto: false, partial, may, choice }); continue; }
    if (cond.minAtk) { out.trig.push({ cond, text, effs, auto: false, partial, may, choice, note: `Only if ${cond.minAtk} or more creatures attacked (${cond.anyPlayer ? "any player's attack — this only fires on yours" : "your attack"}).` }); continue; }
    if (cond.ev === "self-etb" && /\btoken, then attach this equipment to it\.?$/i.test(text)) continue; // Ancestral Blade: the app makes the token and attaches it
    out.trig.push({ cond, text, effs, auto, partial, may, choice, ...(drawRest ? { drawRest } : {}), ...(emin ? { eminence: true } : {}), ...(cond.askNote ? { note: cond.askNote } : {}) });
    if (cond2) out.trig.push({ cond: cond2, text, effs, auto, partial, may, choice, ...(drawRest ? { drawRest } : {}) });
  }
  return out;
}

const COND_LABEL = {
  phase: "at the start of a phase", oppcast: "when an opponent casts", oppdraw: "when an opponent draws", "self-etb": "when it enters/attacks", tokens: "when you create tokens", sac: "when you sacrifice",
  land: "landfall", creature: "when a creature enters", tempt: "when the Ring tempts you", ringbearer: "when you choose a Ring-bearer", cast: "when you cast", dies: "when a creature dies",
  selfdies: "when it dies", selfsac: "when you sacrifice it", selftap: "when it becomes tapped", youdraw: "when you draw", gainlife: "when you gain life", discard: "when you discard",
  oppdiscard: "when an opponent discards", crime: "when you commit a crime", youattack: "when you attack", attack: "when a creature attacks", typedAtk: "when your creatures attack",
  attackN: "when you attack with several creatures", mutates: "when it mutates", heroic: "when you target your creature", gyleave: "when cards leave your graveyard",
  expend: "when you expend", counters: "when counters go on it", tokleave: "when a token leaves", tokOrSac: "when a token leaves or you sacrifice", playOrCast: "when you play a land or cast a spell",
  m1m1put: "when -1/-1 counters are put", explore: "when a creature explores",
};
// What an instant or sorcery does when it resolves
const spellCache = new Map();
export function spellAbility(card) {
  if (!spellCache.has(card.n) && /\bsecretly chooses\b|\bif the discarded card (?:wasn't|was) an? /i.test(card.o || "")) spellCache.set(card.n, { effs: [], auto: false }); // Prisoner's Dilemma: depends on hidden choices
  if (!spellCache.has(card.n)) {
    const lines = (card.o || "").split("\n");
    const mi = lines.findIndex(l => /^choose (one or more|one or both|any number|one|two|three|four)\b[^—]*—\s*$/i.test(l.trim())
      || /^choose (one|two|three|four)\. (you may choose the same mode more than once|if you control a commander[^.]*, you may choose both instead)\.$/i.test(l.trim()));
    if (mi >= 0) {
      const ln = lines[mi].trim();
      const repeat = /same mode more than once/i.test(ln), both = /choose both instead/i.test(ln);
      const pick = ln.match(/one or more|one or both|any number/i) || both ? "multi" : ln.split(/\s+/)[1].replace(/\W/g, "").toLowerCase();
      spellCache.set(card.n, { effs: [], auto: false, modes: parseModes(lines, mi + 1, card.n), pick, ...(repeat ? { repeat: true } : {}), ...(both ? { note: "Choose both only if you control a commander." } : {}) });
      return spellCache.get(card.n);
    }
    if (lines.some(l => /^Spree\b/i.test(l.trim()))) { // Three Steps Ahead: "+ {1}{U} — Counter target spell."
      const modes = lines.map(l => l.trim().match(/^\+\s*((?:\{[^}]+\})+)\s+—\s+(.+)$/)).filter(Boolean).map(m => ({ name: `+${m[1]}`, text: m[2], effs: parseEffects(m[2], card.n), extra: true }));
      if (modes.length) { spellCache.set(card.n, { effs: [], auto: false, modes, pick: "multi", note: "Spree: pay the + cost of each mode you choose." }); return spellCache.get(card.n); }
    }
    const ti = lines.findIndex(l => /^Tiered\b/i.test(l.trim()));
    if (ti >= 0) { // "• Thundara — {3} — Thunder Magic deals 4 damage to target creature."
      const modes = lines.slice(ti + 1).map(l => l.trim().match(/^[•\-]\s*([^—]+?)\s+—\s+([^—]+?)\s+—\s+(.+)$/)).filter(Boolean)
        .map(m => ({ name: `${m[1]} (+${/^\{/.test(m[2]) ? m[2] : m[2].replace(/(\d+|[WUBRGC])/g, "{$1}")})`, text: m[3], effs: parseEffects(m[3], card.n), extra: true }));
      spellCache.set(card.n, { effs: [], auto: false, modes, pick: "one" });
      return spellCache.get(card.n);
    }
    const text = lines.map(l => l.replace(/\([^)]*\)/g, "").trim()).filter(Boolean).filter(l => !/^as an additional cost to cast this spell, sacrifice\b/i.test(l) && !/^when you cycle\b/i.test(l) && !/^(?:basic land|[a-z]+)?cycling\b/i.test(l)).join(" ").replace(/"[^"]+"/g, "(ability)");
    const effs = parseEffects(text, card.n);
    const auto = effs.length > 0 && !/\byou may\b/i.test(text) && !NEEDS_PLAYER.test(text.replace(/(token[^"]*?)with "[^"]*"/gi, "$1").replace(/,? where x is the number of (?:other )?[a-z, ]+? you control/i, "").replace(/ for each (other )?[a-z ,/]+? you control/i, m => effs.some(f => f.per) ? "" : m).replace(/ for each [a-z+/1-]+ counters? on [^.,]*/gi, m => effs.some(f => f.perCtr || f.k === "drawPer") ? "" : m).replace(/search your library[^.]*\./i, ""));
    spellCache.set(card.n, { effs, auto });
  }
  return spellCache.get(card.n);
}

// Human-readable summary for the Deck tab
export function describeAbilities(ab) {
  const lines = [];
  ab.repl.forEach(r => lines.push(
    r.kind === "cplus" ? "+1 extra +1/+1 counter whenever counters go on your creatures (auto)"
    : r.kind === "cdouble" ? `Doubles ${r.p1p1 ? "+1/+1 " : ""}counters put on your ${r.p1p1 ? "creatures" : "permanents"} (auto)`
    : r.kind === "double" ? "Doubles tokens you create (auto)"
    : r.kind === "plusOn" ? `Each ${r.on} you create comes with a ${r.name} (auto)`
    : r.kind === "plus" ? `Adds ${r.many ? "that many" : "one"} ${r.name} when you create tokens (auto)`
    : "Clue, Food or Treasure → one of each (auto)"));
  const PH = { upkeep: "upkeep", draw: "draw step", main1: "first main phase", main2: "second main phase", combat: "combat", end: "end step" };
  const condLabel = c => c.ev === "typed" ? `when ${c.other ? "another" : "a"} ${c.types.join(" or ")} enters` : c.ev === "phase" ? `at ${c.whose === "your" ? "your" : c.whose === "opp" ? "each opponent's" : "each"} ${PH[c.phase] || c.phase || "phase"}` : COND_LABEL[c.ev] || "when it triggers";
  ab.trig.forEach(t => lines.push(`${condLabel(t.cond)}${t.cond.what ? ` ${t.cond.what}` : ""}: ${t.punish ? "asks that player" : t.auto ? (t.partial ? "auto + reminder" : "auto") : "reminder"}`));
  if (ab.cda) lines.push(`P/T = number of ${ab.cda}s you control (auto)`);
  return lines;
}

// Counts used by "equal to the number of X you control"
export function countsFor(p) {
  const bf = Object.values(p.bf || {});
  const toks = Object.values(p.tokens || {});
  const tokCount = pred => toks.filter(t => pred(t.name)).reduce((s, t) => s + (t.count || 0), 0);
  return {
    land: bf.filter(e => /\bLand\b/.test(e.t)).length,
    creature: bf.filter(e => /\bCreature\b/.test(e.t)).length + tokCount(isCreatureToken),
    artifact: bf.filter(e => /\bArtifact\b/.test(e.t)).length + tokCount(n => !isCreatureToken(n)),
    gy: Object.keys(p.gy || {}).length,
    "gy:creature": Object.values(p.gy || {}).filter(e => /\bCreature\b/.test(e.t || "")).length,
    "gy:land": Object.values(p.gy || {}).filter(e => /\bLand\b/.test(e.t || "")).length,
    "gy:instant": Object.values(p.gy || {}).filter(e => /\b(Instant|Sorcery)\b/.test(e.t || "")).length,
  };
}

// How many of a card type or creature type you control (cards on the battlefield + tokens)
export function countOf(p, what) {
  const w = singular(what);
  if (w === "token") return Object.values(p.tokens || {}).reduce((a, t) => a + (t.count || 0), 0);
  const base = countsFor(p);
  if (base[w] != null) return base[w];
  const re = new RegExp(`\\b${w}`, "i");
  return Object.values(p.bf || {}).filter(e => re.test(e.t || "")).length
    + Object.values(p.tokens || {}).filter(t => re.test(t.name)).reduce((a, t) => a + (t.count || 0), 0);
}

function addTokens(p, name, n, desc, tapped, turnNo) {
  p.tokens ||= {};
  let k = slug(name);
  if (p.tokens[k] && (p.tokens[k].ep?.length || p.tokens[k].pump)) { // that stack got a pump this turn: the new ones stand apart
    const free = Object.keys(p.tokens).find(x => x.startsWith(`${k}~new`) && !p.tokens[x].ep?.length && !p.tokens[x].pump && !p.tokens[x].c);
    k = free || `${k}~new${Object.keys(p.tokens).filter(x => x.startsWith(`${k}~new`)).length + 1}`;
  }
  const cur = p.tokens[k];
  p.tokens[k] = { ...(cur || {}), name: cur?.name || name, count: (cur?.count || 0) + n };
  const tp = (cur?.tapped || 0) + (tapped ? n : 0);
  if (tp) p.tokens[k].tapped = tp;
  const d = cur?.desc || desc;
  if (d) p.tokens[k].desc = d;
  if (turnNo != null) p.madeTok = turnNo;
  if (turnNo != null) p.tokens[k].fresh = cur?.fresh?.turnNo === turnNo ? { turnNo, n: cur.fresh.n + n } : { turnNo, n };
}
// Token stacks: tokens with the same name and the same counters share a stack; counters split them off
const COLOR_SYM = { white: "{W}", blue: "{U}", black: "{B}", red: "{R}", green: "{G}" };
// extra creature types written in a token's description ("1/1 colorless Hero Wizard creature")
const tokSubtypes = t => { const m = String(t.desc || "").match(/((?:[A-Z][a-z]+ )+)(?:artifact )?creature\b/); const xs = m ? m[1].trim().split(/\s+/) : []; return [...new Set([t.name, ...xs])].join(" "); };
export const tokenPerm = t => ({ ...(t.ep?.length ? { ep: t.ep } : {}), ...(t.adj ? { adj: t.adj } : {}), t: t.tl ? `Token ${t.tl}` : isCreatureToken(t.name) ? `Token Creature — ${tokSubtypes(t)}` : `Token Artifact — ${t.name}`, n: t.name,
  m: Object.entries(COLOR_SYM).filter(([w]) => new RegExp(`\\b${w}\\b`, "i").test(t.desc || "")).map(([, m]) => m).join(""), c: t.c,
  ...(/ with ((?:flying|haste|deathtouch|lifelink|vigilance|trample|menace|reach|first strike|double strike|hexproof|indestructible|defender|prowess|shroud|intimidate|fear|flash|infect|wither|ward \{\d+\}|toxic \d+|afflict \d+)(?:(?:, and |, | and )\w[\w {}]*)*)$/i.test(t.desc || "") ? { o: String(t.desc).match(/ with (.+)$/)[1].split(/, and |, | and /).map(k => k[0].toUpperCase() + k.slice(1)).join("\n") } : {}), ...(t.eq ? { eq: t.eq } : {}), ...(t.sus ? { sus: true } : {}) });
export function tokenPT(t, pt) {
  if (!isCreatureToken(t.name)) return "";
  const m = String(t.desc || "").match(/(\d+|\*)\/(\d+|\*)/);
  let [p0, t0] = pt ? pt.split("/") : m ? [m[1], m[2]] : ["1", "1"];
  const d = (t.c?.p1p1 || 0) - (t.c?.m1m1 || 0);
  const adj = v => /^\d+$/.test(v) ? String(Number(v) + d) : v;
  return `${adj(p0)}/${adj(t0)}`;
}
// +1/+1 and −1/−1 counters on the same permanent cancel out
export function annihilate(c) {
  if (!c?.p1p1 || !c?.m1m1) return c;
  const n = Math.min(c.p1p1, c.m1m1);
  c.p1p1 -= n; c.m1m1 -= n;
  if (!c.p1p1) delete c.p1p1;
  if (!c.m1m1) delete c.m1m1;
  return c;
}
const sigOf = c => Object.entries(c || {}).filter(([, v]) => v).sort().map(([k, v]) => `${k}${v}`).join("-");
export function tokenKey(t) { return [slug(t.name), sigOf(t.c), t.own ? `of-${t.own.id}` : "", t.pump || "", t.ep?.length ? `ep-${t.ep.join(".")}` : "", t.eq ? `eq-${t.eq}` : "", t.sh ? `sh${t.sh}` : "", t.myr ? "myriad" : "", t.sus ? "suspect" : "", t.adj ? `adj${t.adj.p || 0}.${t.adj.t || 0}` : "", t.ind ? `ind${t.ind}` : ""].filter(Boolean).join("~"); }
// Merge stacks that ended up identical; drop empty ones
export function tidyTokenStacks(p) {
  const out = {};
  Object.values(p.tokens || {}).forEach(t => {
    if (!(t.count > 0)) return;
    if (t.c) { annihilate(t.c); if (!Object.keys(t.c).length) delete t.c; }
    const k = tokenKey(t), cur = out[k];
    if (!cur) { out[k] = { ...t }; if (!sigOf(t.c)) delete out[k].c; return; }
    cur.count += t.count;
    if (t.tapped) cur.tapped = (cur.tapped || 0) + t.tapped;
    if (t.fresh && (!cur.fresh || cur.fresh.turnNo === t.fresh.turnNo)) cur.fresh = { turnNo: t.fresh.turnNo, n: (cur.fresh?.n || 0) + t.fresh.n };
  });
  Object.values(out).forEach(t => { if (t.tapped > t.count) t.tapped = t.count; if (t.fresh && t.fresh.n > t.count) t.fresh.n = t.count; });
  if (Object.keys(out).length) p.tokens = out; else delete p.tokens;
}
// Put n counters of a kind on `howMany` tokens from stack k (untapped / newest ones first when asked)
export function counterTokens(p, k, howMany, key, n, preferFresh, noTidy) {
  const t = p.tokens?.[k];
  if (!t || howMany <= 0 || !n) return 0;
  const m = Math.min(howMany, t.count);
  const moved = { ...t, count: m, c: { ...(t.c || {}), [key]: (t.c?.[key] || 0) + n } };
  const untapped = t.count - (t.tapped || 0);
  const tapMove = Math.max(0, m - untapped);
  if (tapMove) moved.tapped = tapMove; else delete moved.tapped;
  const freshMove = !t.fresh ? 0 : preferFresh ? Math.min(m, t.fresh.n) : Math.max(0, t.fresh.n - (t.count - m)); // new ones go along only when asked (or when the whole stack moves)
  if (freshMove) moved.fresh = { turnNo: t.fresh.turnNo, n: freshMove }; else delete moved.fresh;
  t.count -= m;
  if (tapMove) t.tapped -= tapMove;
  if (freshMove) t.fresh.n -= freshMove;
  if (t.count <= 0) delete p.tokens[k]; else { if (!t.tapped) delete t.tapped; if (!t.fresh?.n) delete t.fresh; }
  p.tokens[`${k}~tmp${Math.random().toString(36).slice(2, 7)}`] = moved;
  if (!noTidy) tidyTokenStacks(p);
  return m;
}

const tokenIs = (name, t) => t === "token" || (t === "creature" && isCreatureToken(name))
  || (t === "artifact" && !isCreatureToken(name)) || new RegExp(`\\b${t}`, "i").test(name);
// Count permanents + tokens of any of these types (each counted once), optionally excluding one permanent
export function countTypes(p, types, excludeId) {
  const has = (text, t) => t === "permanent" || new RegExp(`\\b${t}`, "i").test(withAdds(text || ""));
  const cards = Object.entries(p.bf || {}).filter(([id, e]) => id !== excludeId && types.some(t => has(e.t, t) || changelingHas(e, t))).length;
  const toks = Object.values(p.tokens || {}).filter(t => types.some(x => tokenIs(t.name, x) || (["artifact", "creature", "enchantment"].includes(x) && new RegExp(`\\b${x}\\b`, "i").test(String(t.desc || "").split(" with ")[0])))).reduce((a, t) => a + (t.count || 0), 0);
  return cards + toks;
}

function matches(cond, ev, srcId) {
  switch (cond.ev) {
    case "self-etb":
      if (ev.id !== srcId) return 0;
      if (cond.castOnly && ev.type === "enters" && !ev.cast) return 0;
      return (ev.type === "enters" && cond.enters !== false) || (ev.type === "attacks" && cond.attacks) ? 1 : 0;
    case "tokens": {
      if (ev.type !== "tokens") return 0;
      const n = ev.list.filter(b => !cond.creature || isCreatureToken(b.name)).reduce((s, b) => s + b.n, 0);
      return n ? (cond.once ? 1 : n) : 0;
    }
    case "typed": {
      // "another permanent", "green creature", "colorless creature"…: a color word and/or "permanent" aren't on the type line
      const CL = { white: "W", blue: "U", black: "B", red: "R", green: "G" };
      const split = t => { const m = String(t).match(/^(white|blue|black|red|green|colorless|multicolou?red)\s+(.+)$/i); return m ? [m[1].toLowerCase(), m[2]] : [null, t]; };
      const colorOk = (col, c) => { if (!col) return true; const syms = (String(c?.m || "").match(/\{[^}]+\}/g) || []).join(""), has = k => new RegExp(k).test(syms) && !/\bDevoid\b/i.test(c?.o || "");
        const n = Object.values(CL).filter(has).length; return col === "colorless" ? n === 0 : /^multi/.test(col) ? n > 1 : has(CL[col]); };
      const cardHas = t => { const [col, rest] = split(t); return colorOk(col, ev.card) && (/^permanents?$/i.test(rest) ? !/\b(Instant|Sorcery)\b/.test(ev.card?.t || "") : new RegExp(`\\b${rest}`, "i").test(ev.card?.t || "")); };
      const tokHas = (b, t) => { const [col, rest] = split(t); return (!col || new RegExp(`\\b${col}\\b`, "i").test(b.desc || b.name || "")) && (/^permanents?$/i.test(rest) || tokenIs(b.name, rest)); };
      if (ev.type === "enters") return cond.types.some(cardHas) && !(cond.other && ev.id === srcId) && !(cond.nontoken && ev.tok) ? 1 : 0;
      if (ev.type === "tokens" && !cond.nontoken) {
        const n = ev.list.filter(b => cond.types.some(t => tokHas(b, t))).reduce((a, b) => a + b.n, 0);
        return n ? (cond.once ? 1 : n) : 0;
      }
      return 0;
    }
    case "creature": {
      const pwOk = pw => (cond.powMin == null || pw >= cond.powMin) && (cond.powMax == null || pw <= cond.powMax);
      if (ev.type === "enters" && /\bCreature\b/.test(ev.card.t || "") && !(cond.other && ev.id === srcId)) return cond.powMin != null || cond.powMax != null ? (pwOk(Number(ev.card.p) || 0) ? 1 : 0) : 1;
      if (ev.type === "tokens" && !cond.nontoken) { const n = ev.list.filter(b => isCreatureToken(b.name) && (cond.powMin == null && cond.powMax == null || pwOk(Number((String(b.desc || "").match(/^(\d+)\//) || [])[1]) || 0))).reduce((s, b) => s + b.n, 0); return cond.once ? (n ? 1 : 0) : n; }
      return 0; }
    case "creature_old":
      return 0;
    case "tempt": return ev.type === "tempt" ? 1 : 0;
    case "discard": return ev.type === "discard" ? (cond.once ? 1 : ev.n || 1) : 0;
    case "oppdiscard": return ev.type === "oppdiscard" ? (cond.once ? 1 : ev.n || 1) : 0;
    case "selftap": return ev.type === "tapped" && ev.id === srcId ? 1 : 0;
    case "youattack": return ev.type === "youattack" ? 1 : 0;
    case "gainlife": return ev.type === "gainlife" && (!cond.first || ev.first) ? 1 : 0;
    case "gyleave": return ev.type === "gyleave" ? 1 : 0;
    case "mutates": return ev.type === "mutates" && ev.id === srcId ? 1 : 0;
    case "expend": return ev.type === "expend" && ev.prev < cond.n && ev.n >= cond.n ? 1 : 0;
    case "explore": return ev.type === "explore" && (cond.land == null || cond.land === ev.land) ? (ev.n || 1) : 0;
    case "tokleave": return ev.type === "tokleave" ? (cond.once ? 1 : ev.n || 1) : 0;
    case "attackN": { // fires once, when this turn's attackers of that type reach the number
      if (ev.type !== "attacks" || !curP?.attacked) return 0;
      const isT = (e, name) => cond.types.some(t => t === "creature" || (e ? permanentMatches(e, { alts: [[t]], controller: "any" }) : tokenIs(name, t)));
      const now = Object.keys(curP.attacked.bf || {}).filter(id => curP.bf?.[id] && isT(curP.bf[id])).length
        + Object.entries(curP.attacked.tok || {}).reduce((a, [k, n]) => a + (curP.tokens?.[k] && isT(null, curP.tokens[k].name) ? n : 0), 0);
      const mine = ev.id ? (curP.bf?.[ev.id] && isT(curP.bf[ev.id]) ? 1 : 0) : ev.tok && isT(null, ev.tok) ? ev.n || 1 : 0;
      return mine && now >= cond.min && now - mine < cond.min ? 1 : 0;
    }
    case "selfsac": return ev.type === "sac" && ev.ids?.includes(srcId) ? 1 : 0; // Ordeals, Daemogoth Woe-Eater: "when you sacrifice this"
    case "selfdies": return (ev.type === "dies" || (cond.leaves && ev.type === "leaves" && (!cond.toGy || /^(?:Graveyard|Sacrificed)$/.test(ev.dest || "")))) && ev.ids?.includes(srcId) ? 1 : 0;
    case "attack": {
      if (ev.type !== "attacks" || (cond.other && ev.id === srcId)) return 0;
      if (cond.kw && !(ev.kws || []).includes(cond.kw)) return 0;
      if (cond.types && !cond.types.some(t => new RegExp(`\\b${t}`, "i").test(ev.tok || ev.card?.t || ev.t || ""))) return 0;
      return ev.n || 1;
    }
    case "ringbearer": return ev.type === "ringbearer" ? 1 : 0;
    case "land":
      return ev.type === "enters" && /\bLand\b/.test(ev.card.t || "") ? 1 : 0;
    case "sac": {
      if (ev.type !== "sac") return 0;
      const name = ev.name.toLowerCase();
      const ok = !cond.what || cond.what.split(/ or |, /).map(w => singular(w.trim())).some(w => w === "permanent" || name === w
        || (w === "artifact" && (ev.artifact || !isCreatureToken(ev.name)))
        || (w === "creature" && ev.creature) || (w === "token" && ev.token)
        || (w === "nontoken" && !ev.token)
        || (/^(land|enchantment|planeswalker|battle)$/.test(w) && new RegExp(`\\b${w}\\b`, "i").test(ev.t || "")));
      if (cond.notSelf && ev.id && ev.id === srcId) return 0;
      return ok ? (cond.once ? 1 : ev.n) : 0;
    }
    case "dies":
      if (ev.type !== "dies") return 0;
      if (ev.foreign && cond.mine) return 0; // another player's creature: "creature you control" doesn't see it
      if (cond.opp && !ev.foreign) return 0; // "a creature an opponent controls dies" (The Meathook Massacre)
      if (cond.once) return 1;
      if (cond.token && !ev.token) return 0;
      if (cond.nontoken && ev.token) return 0;
      if (cond.types && !ev.ts) return ev.name && cond.types.some(w => new RegExp(`\\b${w}\\b`, "i").test(ev.name)) ? ev.n || 1 : 0; // no type info: only a named token can match
      if (cond.types && ev.ts) { const n = ev.ts.filter((t, i) => cond.types.some(w => new RegExp(`\\b${w}\\b`, "i").test(t || "")) && !(cond.other && ev.ids?.[i] === srcId)).length * (ev.token && ev.ts.length === 1 ? ev.n || 1 : 1); return cond.once ? (n ? 1 : 0) : n; }
      // "another creature" doesn't count the source's own death
      return cond.other && ev.ids?.includes(srcId) ? ev.n - 1 : ev.n;
    case "phase":
      return ev.type === "phase" && ev.phase === cond.phase
        && (cond.whose === "each" || (cond.whose === "your" && ev.mine) || (cond.whose === "opp" && !ev.mine)) ? 1 : 0;
    case "counters":
      return ev.type === "counters" ? (cond.once ? 1 : ev.n || 1) : 0;
    case "crime": return ev.type === "crime" ? 1 : 0;
    case "heroic": return 0;
    case "m1m1put": return ev.type === "m1m1put" ? ev.creatures || 1 : 0; // one trigger per creature; ev.n = counters on each
    case "typedAtk": {
      if (ev.type !== "attacks" || (cond.other && ev.id && ev.id === srcId) || (cond.nontoken && ev.tok)) return 0;
      const t = ev.t || "";
      return cond.types.some(w => w === "creature" ? /\bCreature\b/.test(t) : w.startsWith("non-") ? /\bCreature\b/.test(t) && !new RegExp(`\\b${w.slice(4).replace(/ creature$/, "")}\\b`, "i").test(t) : new RegExp(`\\b${w}\\b`, "i").test(t)) ? (ev.n || 1) : 0;
    }
    case "tokOrSac": return ev.type === "tokens" ? 1 : ev.type === "sac" && ev.token ? (ev.n || 1) : 0;
    case "playOrCast": return (ev.type === "cast" && !ev.foreign) || (ev.type === "enters" && ev.played) ? 1 : 0;
    case "youdraw": {
      if (ev.type !== "draw") return 0;
      if (cond.nth) { const b = ev.before || 0; return b < cond.nth && b + (ev.n || 1) >= cond.nth ? 1 : 0; }
      return Math.max(0, (ev.n || 1) - (cond.exceptFirst && ev.step ? 1 : 0));
    }
    case "oppdraw":
      if (ev.type === "oppdraw" || (cond.self && ev.type === "draw")) {
        if (cond.nth) { const b = ev.before || 0; return b < cond.nth && b + (ev.n || 1) >= cond.nth ? 1 : 0; }
        const n = Math.max(0, (ev.n || 1) - (cond.exceptFirst && ev.step ? 1 : 0));
        return cond.once ? (n ? 1 : 0) : n;
      }
      return 0;
    case "oppcast":
      if (!(ev.type === "oppcast" || (cond.self && ev.type === "cast" && ev.id !== srcId))) return 0;
      // "their first noncreature spell each turn": skip if they already cast a matching spell this turn
      if (cond.first && (ev.prior || []).some(pc => matches({ ...cond, ev: "cast", first: false }, { type: "cast", card: pc }, srcId))) return 0;
      if (cond.nth && ev.type === "oppcast" && (ev.prior || []).length !== cond.nth - 1) return 0;
      return matches({ ...cond, ev: "cast" }, { ...ev, type: "cast", id: null }, srcId);
    case "cast": {
      if (ev.type !== "cast" || (ev.id && ev.id === srcId)) return 0; // a spell doesn't see itself being cast
      if (ev.copied && !/\bor copy\b/.test(cond.what || "")) return 0; // a copy that wasn't cast: only magecraft ("cast or copy") sees it
      if (cond.notHand && !ev.fromZone) return 0; // Spider-Verse
      if (cond.fromEx && ev.fromZone !== "ex") return 0; // Appa: "cast a spell from exile"
      if (cond.fromGy && ev.fromZone !== "gy") return 0;
      if (cond.noMana && !ev.free) return 0; // Roiling Vortex
      if (cond.nth && (ev.prior || []).length !== cond.nth - 1) return 0; // your second spell each turn
      if (cond.mvMin != null && manaValue(ev.card?.m || "") < cond.mvMin) return 0; // Angry Rabble
      if (cond.mvMax != null && manaValue(ev.card?.m || "") > cond.mvMax) return 0; // Eidolon of the Great Revel
      const t = ev.card.t || "", w = cond.what, COLS = { white: "W", blue: "U", black: "B", red: "R", green: "G" };
      if (COLS[w]) return new RegExp(`\\{[^}]*${COLS[w]}[^}]*\\}`).test(ev.card?.m || "") ? 1 : 0;
      if (w === "multicolored") return ["W", "U", "B", "R", "G"].filter(k => new RegExp(`\\{[^}]*${k}[^}]*\\}`).test(ev.card?.m || "")).length >= 2 ? 1 : 0;
      if (w && /,|\bor\b/.test(w) && !/instant or sorcery/.test(w)) return w.split(/,\s*(?:and\/or\s+|or\s+)?|\s+(?:and\/)?or\s+/).map(x => x.trim()).filter(Boolean).some(a => a === "noncreature" ? !/Creature/.test(t) : new RegExp(`\\b${a}\\b`, "i").test(t)) ? 1 : 0; // Sram: "an Aura, Equipment, or Vehicle spell"
      const ok = !w || (w === "noncreature" && !/Creature/.test(t)) || (w === "creature" && /Creature/.test(t))
        || (/instant or sorcery/.test(w) && /Instant|Sorcery/.test(t))
        || (w === "historic" && /\b(Artifact|Legendary|Saga)\b/.test(t))
        || (!["noncreature", "creature", "historic"].includes(w) && !/instant or sorcery/.test(w) && new RegExp(w.split(" ")[0], "i").test(t));
      return ok ? 1 : 0;
    }
  }
  return 0;
}

// Run game events against the player's board. Mutates p; fills ctx.logs, ctx.remind, ctx.drain.
// events: {type:"create", name, n} | {type:"enters", id, card} | {type:"cast", card}
//         {type:"sac", name, n, token, creature, artifact} | {type:"dies", n, token} | {type:"effects", effs, times, count, src}
// env (from the whole table): loseAll [{filter}], hush [{what, dies}], double [{on, types}], tapIn [{filter}]
let curP = null;
const sg = v => `${Number(v) >= 0 && !/^[+-]/.test(String(v)) ? "+" : ""}${v}`;
const pumpWords = (dp, dt, kws) => (Number(dp) || 0) === 0 && (Number(dt) || 0) === 0 && kws?.length ? `gains ${kws.join(", ")}` : `gets ${sg(dp)}/${sg(dt)}${kws?.length ? ` and ${kws.join(", ")}` : ""}`;
export function stationCard(c, e) {
  const ch = e?.c?.charge || 0;
  return { ...c, n: `${c.n}#st${ch}`, o: String(c.o || "").replace(/^(\d+)\+ \| (.*)$/gm, (m, n, rest) => ch >= Number(n) ? rest : "").replace(/\n{2,}/g, "\n") };
}
export function runEvents(p, events, ctx, { enabled = true, lookup, env = null, turnNo = null, cz = [] }) {
  curP = p;
  if (turnNo != null) ctx.turnNo = turnNo;
  const lost = e => (env?.loseAll || []).some(r => permanentMatches(e, r.filter));
  const sources = () => Object.entries(p.bf || {}).map(([id, e]) => {
    const card0 = lookup(e.n);
    const card = card0 && e.face != null && e.o ? { ...card0, n: `${e.fname || card0.n}#f${e.face}`, o: e.o, t: e.t || card0.t } : card0 && e.mode && e.o ? { ...card0, n: `${card0.n}#m${e.mode}`, o: e.o } : card0 && /^\d+\+ \| /m.test(card0.o || "") ? stationCard(card0, e) : card0;
    return card && !lost(e) ? { id, e, ab: abilitiesOf(card) } : null;
  }).filter(Boolean).concat((cz || []).filter(n => !Object.values(p.bf || {}).some(e => e.n === n)).map(n => { const card = lookup(n); if (!card || !/command zone or on the battlefield/i.test(card.o || "")) return null; const ab = abilitiesOf(card); return { id: `cz:${n}`, e: { n, t: card.t || "", o: card.o, cmd: true }, ab: { ...ab, trig: ab.trig.filter(t => t.eminence || /command zone/i.test(t.text || "")), repl: [] } }; }).filter(Boolean));
  // How many counters actually land, after Hardened Scales (+1) and The Earth Crystal / Doubling Season (×2)
  const counterAmount = (n, key, e) => {
    if (!enabled) return n;
    const creature = /\bCreature\b/.test(e?.t || "");
    if (n > 0 && e && creature) Object.values(p.bf || {}).forEach(x => { const mo = String(x.o || lookup?.(x.n)?.o || "").match(/^whenever you put (?:a|one or more|one or more \+1\/\+1) counters? on (?:a|another) creature you control, ([^.]+)\.(?: (?:this ability triggers only once each turn|do this only once each turn)\.)?/im);
      if (!mo || (/\+1\/\+1/.test(mo[0]) && key !== "p1p1")) return; const kk = `ctrany:${x.n}`; p.onceT ||= {}; if (/only once each turn/i.test(mo[0]) && p.onceT[kk] === ctx.turnNo) return; p.onceT[kk] = ctx.turnNo;
      ctx.remind.push({ src: label(x), text: mo[1][0].toUpperCase() + mo[1].slice(1).replace(/that many/i, n) + ".", times: 1 }); });
    if (key === "p1p1" && n > 0 && e) { const fm = String(e.o || lookup?.(e.n)?.o || "").match(/^whenever a \+1\/\+1 counter is put on this creature, ([^.]+)\./im); if (fm) ctx.remind.push({ src: label(e), text: fm[1][0].toUpperCase() + fm[1].slice(1) + ".", times: Math.min(n, 10) }); }
    if (key === "p1p1" && n > 0 && e) { const mm = String(e.o || lookup?.(e.n)?.o || "").match(/^whenever (?:one or more \+1\/\+1 counters are put on this creature|you put one or more \+1\/\+1 counters on this creature), ([^.]+)\.( this ability triggers only once each turn\.)?/im);
      if (mm) { const kk = `ctr:${e.n}`; p.onceT ||= {}; if (!mm[2] || p.onceT[kk] !== ctx.turnNo) { if (mm[2]) p.onceT[kk] = ctx.turnNo; ctx.remind.push({ src: label(e), text: mm[1][0].toUpperCase() + mm[1].slice(1) + ".", times: 1 }); } } }
    const reps = sources().flatMap(s => s.ab.repl).filter(r => (r.kind === "cplus" || r.kind === "cdouble") && (!r.p1p1 || (key === "p1p1" && (creature || r.perm))));
    let v = n;
    if (key === "m1m1" && creature && Object.values(p.bf || {}).some(x => /if one or more -1\/-1 counters would be put on a creature you control, that many -1\/-1 counters minus one are put on it instead/i.test(x.o || lookup?.(x.n)?.o || ""))) v = Math.max(0, v - 1);
    reps.filter(r => r.kind === "cplus").forEach(r => { v += r.n; });
    reps.filter(r => r.kind === "cdouble").forEach(() => { v *= 2; });
    return v;
  };
  const tokPerm = name => ({ t: isCreatureToken(name) ? `Token Creature — ${name}` : `Token Artifact — ${name}`, n: name, m: "" });
  const typesHit = (types, ev) => !types || (ev.type === "enters" ? types.some(w => new RegExp(`\\b${w}`, "i").test(ev.card?.t || ""))
    : ev.type === "tokens" ? ev.list.some(b => types.some(w => new RegExp(`\\b${w}`, "i").test(tokPerm(b.name).t))) : true);
  // Torpor Orb / Hushbringer / Elesh Norn: some entering or dying doesn't trigger anything
  const hushed = ev => {
    const hs = env?.hush || [];
    if (!hs.length) return ev;
    if (ev.type === "enters" || ev.type === "tokens") {
      if (hs.some(h => h.what === "permanent")) return null;
      if (hs.some(h => h.what === "creature")) {
        if (ev.type === "enters") return /\bCreature\b/.test(ev.card?.t || "") ? null : ev;
        const list = ev.list.filter(b => !isCreatureToken(b.name));
        return list.length ? { ...ev, list } : null;
      }
    }
    if (ev.type === "dies" && hs.some(h => h.dies)) return null;
    return ev;
  };
  // Panharmonicon / Elesh Norn / Teysa: those triggers happen an additional time
  const extra = ev => (env?.double || []).filter(d => (d.on === "enter" && (ev.type === "enters" || ev.type === "tokens") && typesHit(d.types, ev)) || (d.on === "dies" && ev.type === "dies")
    || (d.on === "castIS" && ev.type === "cast" && /\b(Instant|Sorcery)\b/.test(ev.card?.t || "")) || (d.on === "attack" && (ev.type === "attacks" || ev.type === "youattack"))).length;
  const srcExtra = (e, sid) => (env?.double || []).filter(d => d.on === "equipped" && sid && d.att === sid).length + (env?.double || []).filter(d => d.on === "source" && d.types?.some(t => new RegExp(`\\b${t}\\b`, "i").test(e.t || "")) && !(d.another && d.src && (e.nick || e.n) === d.src)).length;
  const label = e => e.nick || e.fname || e.n;
  const queue = [...events];
  // Sacrificed permanents: remember their type line ("whenever you sacrifice a land")
  queue.forEach(ev => { if (ev.type === "sac" && !ev.t && !ev.token) ev.t = lookup?.(ev.name)?.t || Object.values(p.bf || {}).find(x => x.n === ev.name)?.t || ""; });
  // Remember what died (creature types), so "whenever an Elf you control dies" can tell
  queue.forEach((ev, i) => { if (ev.type !== "dies" || ev.ts || ev.foreign) return;
    if (ev.ids?.length) { const ts = ev.ids.map(id => p.bf?.[id]?.t || ev.cardTs?.[id] || ""); if (ts.every(Boolean)) ev.ts = ts; }
    else if (ev.token) { const nm = ev.name || (queue[i - 1]?.type === "sac" && queue[i - 1].token ? queue[i - 1].name : null); if (nm) ev.ts = [tokenPerm({ name: nm, desc: p.tokens?.[slug(nm)]?.desc }).t]; } });
  let guard = 0;

  const applyEffects = (effs, times, count, src, srcId) => {
    for (let t = 0; t < Math.min(times, 50); t++) {
      for (let f of effs) {
        if (f.k === "tok") queue.push({ type: "create", name: f.name, desc: f.desc, tapped: f.tapped, n: f.n === "many" ? count : f.n?.attacking ? (ctx.attackers ?? 0) : f.n === "X" ? (ctx.x ?? 1) : f.n?.count ? countOf(p, f.n.count) : f.n, src });
        if (f.fero && (ctx.maxPower ?? 0) < 4) { if (!ctx.feroNoted) { ctx.feroNoted = 1; ctx.logs.push(`⚙ ${src}: ferocious didn't happen (no creature with power 4 or greater)`); } continue; }
        if (f.k === "gainPer") {
          const k = f.minPow != null ? (ctx.powers || []).filter(x => x >= f.minPow).length : countTypes(p, f.types);
          if (k) { const ga = gainAdj(p, f.n * k, lookup); p.life = (p.life ?? 40) + ga.n; p.lifeGained = ctx.turnNo; p.lifeGainedN = { t: ctx.turnNo, n: (p.lifeGainedN?.t === ctx.turnNo ? p.lifeGainedN.n || 0 : 0) + ga.n }; ctx.logs.push(`⚙ ${src}: ${ctx.who ? ctx.who + " " : ""}gained ${ga.n} life (${k} ${f.label})${ga.why}`); }
        }
        if (f.k === "drawFor" && f.chosen) { ctx.remind.push({ src, srcId, text: "Choose a creature type: draw a card for each permanent you control of that type.", typeDraw: true, times: 1 }); continue; }
        if (f.k === "drawFor") { const k = countTypes(p, f.types); if (k) ctx.remind.push({ src, srcId, text: `Draw ${k === 1 ? "a card" : k + " cards"}.`, note: `one for each ${f.label} you control`, times: 1 }); }
        if (f.k === "dieReturn") ctx.remind.push({ src, srcId, text: "Return it to the battlefield. It's an enchantment now (not a creature).", dieReturn: f, times: 1 });
        if ((f.k === "gain" || f.k === "dmgCr") && f.n && typeof f.n === "object") f = { ...f, n: f.n.count ? countTypes(p, [f.n.count]) : (p.bf?.[srcId]?.c?.[f.n.ctr] || 0) };
        if (f.k === "gain" && (p.life ?? 40) <= 5 && Object.values(p.bf || {}).some(x => /if you would gain life while you have 5 or less life, you gain twice that much life instead/i.test(x.o || lookup?.(x.n)?.o || ""))) { f = { ...f, n: f.n * 2 }; ctx.logs.push(`⚙ ${src}: life gain doubled (5 or less life)`); }
        if (f.k === "gain") { const ga = gainAdj(p, f.n, lookup); p.lifeGained = ctx.turnNo; p.lifeGainedN = { t: ctx.turnNo, n: (p.lifeGainedN?.t === ctx.turnNo ? p.lifeGainedN.n || 0 : 0) + ga.n }; p.life = (p.life ?? 40) + ga.n; ctx.logs.push(`⚙ ${src}: ${ctx.who ? ctx.who + " " : ""}gained ${ga.n} life${ga.why}`); }
        if (f.k === "lose") {
          const n = f.perCtr ? f.n * (p.bf?.[srcId]?.c?.[f.perCtr] || 0) : f.n;
          if (n) { p.life = (p.life ?? 40) - n; ctx.logs.push(`⚙ ${src}: ${ctx.who ? ctx.who + " " : ""}lost ${n} life${f.perCtr ? ` (${n / f.n} ${f.perLabel} counter${n / f.n === 1 ? "" : "s"})` : ""}`); }
          else if (f.perCtr) ctx.logs.push(`⚙ ${src}: no ${f.perLabel} counters, so ${ctx.who ? ctx.who + " " : ""}lost no life`);
        }
        if (f.k === "drawPer") {
          const n = p.bf?.[srcId]?.c?.[f.key] || 0;
          if (n) ctx.remind.push({ src, srcId, text: `Draw ${n === 1 ? "a card" : n + " cards"}.`, times: 1, note: `one for each ${f.label} counter` });
        }
        if (f.k === "copyAllTokens") { // Second Harvest: one copy of each token (counters aren't copied); doublers apply
          { const bt = Object.values(p.tokens || {}).filter(t => t.count > 0 && !t.own).map(t => ({ name: t.name, n: t.count, desc: t.desc })); if (bt.length) queue.push({ type: "create", name: bt[0].name, desc: bt[0].desc, n: bt.reduce((a, b) => a + b.n, 0), batch: bt, src }); } // one creation event: "plus a Food" replacements apply once
        }
        if (f.k === "pumpSelf" && p.bf?.[srcId]) { p.eot ||= {}; p.eot[`s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`] = { src, target: srcId, dp: f.dp, dt: f.dt, kws: f.kws || [] }; ctx.logs.push(`⚙ ${src}: ${!f.dp && !f.dt && f.kws?.length ? `gains ${f.kws.join(", ")}` : `gets ${f.dp >= 0 ? "+" : ""}${f.dp}/${f.dt >= 0 ? "+" : ""}${f.dt}${f.kws?.length ? ` and ${f.kws.join(", ")}` : ""}`} until end of turn`); }
        if (f.k === "dmgTurn") { p.turnFx = { ...(p.turnFx?.turnNo === ctx.turnNo ? p.turnFx : {}), turnNo: ctx.turnNo, mult: Math.max(p.turnFx?.turnNo === ctx.turnNo ? p.turnFx.mult || 1 : 1, 1) * f.mult, src }; ctx.logs.push(`🔥 ${src}: ${ctx.who ? ctx.who + "'s" : "your"} sources deal ${f.mult === 3 ? "triple" : "double"} damage to opponents this turn`); }
        if (f.k === "noPreventTurn") { p.turnFx = { ...(p.turnFx?.turnNo === ctx.turnNo ? p.turnFx : {}), turnNo: ctx.turnNo, noPrevent: src }; ctx.logs.push(`🔥 ${src}: damage can't be prevented this turn`); }
        if (f.k === "manaAny") ctx.remind.push({ src, srcId, text: "", anyColor: true, anyN: f.n, anyOne: f.one, times: 1 });
        if (f.k === "suspect") ctx.remind.push({ src, srcId, text: `Suspect ${f.upTo ? "up to one " : ""}target creature (menace, can't block).`, effs: [f], times: 1 });
        if (f.k === "mill") ctx.remind.push({ src, srcId, text: "", mill: f, times: 1 });
        if (f.k === "sacThen") ctx.remind.push({ src, srcId, text: `You may sacrifice ${/^[aeiou]/i.test(f.what) ? "an" : "a"} ${f.what}. If you do, ${f.thenText}`, effs: [f], times: 1 });
        if (f.k === "tgain" || f.k === "gyOne") ctx.remind.push({ src, srcId, text: f.k === "tgain" ? `Target player gains ${f.n} life.` : "Exile target card from a graveyard.", effs: [f], times: 1 });
        if (f.k === "regen") ctx.remind.push({ src, srcId, text: `Regenerate target ${f.what}.`, effs: [f], times: 1 });
        if (f.k === "tempt") ctx.remind.push({ src, srcId, text: "The Ring tempts you.", tempt: true, times: 1 });
        if (f.k === "oracle") ctx.remind.push({ src, srcId, text: "", oracle: f, times: 1 });
        if (f.k === "selfc" && p.bf?.[srcId]) {
          const e = p.bf[srcId]; e.c ||= {};
          const base = f.per ? f.n * countTypes(p, f.per.types, f.per.other ? srcId : null) : f.n;
          if (!base) continue;
          const add = counterAmount(base, f.key, e); // Doubling Season / Hardened Scales apply to "put a counter on this" too
          e.c[f.key] = (e.c[f.key] || 0) + add;
          ctx.logs.push(`⚙ ${src}: +${add} ${f.label} counter${add === 1 ? "" : "s"} → ${e.c[f.key]}`);
          if (f.key === "p1p1" && add > 0 && /\bCreature\b/.test(e.t || "")) queue.push({ type: "counters", n: 1, amt: add, id: srcId }); // Shalai and Hallar sees "put a counter on this" too
        }
        if (f.k === "imprint") ctx.remind.push({ src, srcId, text: `exile ${f.what} card from your hand`, effs: [f], times: 1 });
        if (f.k === "edict") ctx.remind.push({ src, srcId, text: `sacrifice ${f.what}`, effs: [f], times, count });
        if (f.k === "remove" || f.k === "adnaus" || f.k === "setlife") ctx.remind.push({ src, srcId, text: f.k === "adnaus" ? "Reveal cards" : f.k === "setlife" ? f.label : `${f.how} ${f.what}`, effs: [f], times: 1, count });
        if (f.k === "fetch") ctx.remind.push({ src, srcId, text: "Search your library", fetch: f, left: f.n, times: 1 });
        if (f.k === "regrow") ctx.remind.push({ src, srcId, text: "", regrow: f, left: f.all ? 1 : (f.n || 1) * Math.max(1, times), times: 1 });
        if (f.k === "impulse") ctx.remind.push({ src, srcId, text: "", impulse: { ...f, n: f.n === "X" ? "X" : f.n * Math.max(1, times), cards: [] }, times: 1 });
        if (f.k === "handmana") ctx.remind.push({ src, srcId, text: "", handMana: f, times: 1 });
        if (f.k === "countersEach" && f.blessN && p.effects?.blessing) f = { ...f, n: f.blessN };
        if (f.k === "countersEach" && f.n === "X") { ctx.remind.push({ src, srcId, text: `Put X ${f.label} counters on each ${f.what}${f.everyone ? "" : " you control"}.`, countersX: f, times: 1 }); continue; }
        if (f.k === "countersEach") {
          let cards = 0, toks = 0, per = 0;
          Object.entries(f.oppsOnly ? {} : p.bf || {}).forEach(([id, e]) => {
            if (f.other && id === srcId) return;
            if (!permanentMatches(e, f.filter)) return;
            if (f.entered && e.et !== ctx.turnNo) return;
            const amt = counterAmount(f.n, f.key, e); per = per || amt;
            e.c ||= {}; e.c[f.key] = (e.c[f.key] || 0) + amt; cards++;
          });
          // plan every stack first, then move them all and tidy once (tidying re-keys stacks)
          const plan = Object.entries(f.oppsOnly ? {} : p.tokens || {}).map(([k, t]) => {
            if (!t || !permanentMatches(tokenPerm(t), f.filter)) return null;
            const howMany = f.entered ? (t.fresh?.turnNo === ctx.turnNo ? t.fresh.n : 0) : t.count;
            return howMany ? [k, howMany, counterAmount(f.n, f.key, tokenPerm(t))] : null;
          }).filter(Boolean);
          plan.forEach(([k, howMany, amt]) => { toks += counterTokens(p, k, howMany, f.key, amt, f.entered, true); });
          if (plan.length) tidyTokenStacks(p);
          if (f.everyone) (ctx.others ||= []).push({ ...f, everyone: false, other: false, oppsOnly: false, src });
          if (f.key === "m1m1") { const cre = cards + toks + (f.everyone ? ctx.oppCre || 0 : 0); if (cre) queue.push({ type: "m1m1put", creatures: cre, n: typeof f.n === "number" ? f.n : 1 }); }
          if (cards || toks) {
            ctx.logs.push(`⚙ ${src}: ${f.label} counter${f.n === 1 ? "" : "s"} on ${cards ? `${cards} creature${cards === 1 ? "" : "s"}` : ""}${cards && toks ? " and " : ""}${toks ? `${toks} token${toks === 1 ? "" : "s"}` : ""}${f.entered ? " (entered this turn)" : ""}`);
            if (f.key === "p1p1") queue.push({ type: "counters", n: cards + toks, amt: per || (typeof f.n === "number" ? f.n : 1) });
          }
        }
        if (f.k === "countersOn") { // one chosen target (from a picker)
          if (f.target.kind === "bf" && p.bf?.[f.target.id]) {
            const e = p.bf[f.target.id], amt = counterAmount(f.n, f.key, e);
            e.c ||= {}; e.c[f.key] = (e.c[f.key] || 0) + amt;
            ctx.logs.push(`⚙ ${src}: ${amt} ${f.label} counter${amt === 1 ? "" : "s"} on ${e.nick || e.n}`);
            if (f.key === "p1p1") queue.push({ type: "counters", n: 1, amt });
          } else if (f.target.kind === "tok" && p.tokens?.[f.target.id]) {
            const t = p.tokens[f.target.id], amt = counterAmount(f.n, f.key, tokenPerm(t));
            counterTokens(p, f.target.id, 1, f.key, amt);
            ctx.logs.push(`⚙ ${src}: ${amt} ${f.label} counter${amt === 1 ? "" : "s"} on a ${t.name} token`);
            if (f.key === "p1p1") queue.push({ type: "counters", n: 1, amt });
          }
        }
        if (f.k === "prolif") ctx.remind.push({ src, srcId, text: "Proliferate: choose permanents and players with counters; each gets another of each kind.", prolif: true, times: 1 });
        if (f.k === "prolifOn") {
          const done = [];
          (f.bf || []).forEach(id => {
            const e = p.bf?.[id];
            if (!e?.c) return;
            Object.keys(e.c).filter(k => e.c[k] > 0).forEach(k => { e.c[k] += counterAmount(1, k, e); });
            done.push(e.nick || e.n);
          });
          (f.toks || []).forEach(k => {
            const t = p.tokens?.[k];
            if (!t?.c) return;
            const c = { ...t.c };
            Object.keys(c).filter(x => c[x] > 0).forEach(x => { c[x] += counterAmount(1, x, tokenPerm(t)); });
            t.c = c; done.push(`${t.count} ${t.name}`);
          });
          (f.player || []).forEach(k => { if (p[k] > 0) { p[k] += 1; done.push(k); } });
          if (f.toks?.length) tidyTokenStacks(p);
          if (done.length) ctx.logs.push(`⚙ ${src}: ${ctx.who ? ctx.who + " " : ""}proliferated ${done.join(", ")}`);
        }
        if (f.k === "pumpAll") {
          const xv = f.xGreatest ? (ctx.maxPower ?? 0) : f.xCount ? countOf(p, f.xCount) : null;
          const per = f.perEach ? countOf(p, f.perEach) : 1;
          const val = v => { const s = String(v).replace("−", "-"); return (/x$/i.test(s) ? (s.startsWith("-") ? -1 : 1) * (xv ?? 0) : Number(s)) * per; };
          p.eot ||= {};
          const flt = parseTargetFilter(f.perm ? "permanent" : f.type ? `${f.type} creature` : "creature");
          // only the creatures on the battlefield now (ones that enter later aren't affected)
          const eid = `e${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
          Object.keys(p.tokens || {}).filter(k => f.perm || isCreatureToken(p.tokens[k].name)).forEach(k => { if (permanentMatches(tokenPerm(p.tokens[k]), flt)) p.tokens[k].ep = [...(p.tokens[k].ep || []), eid]; });
          p.eot[eid] = { epTag: true, src, filter: flt, other: f.other ? srcId || null : null, dp: val(f.dp), dt: val(f.dt), kws: f.kws,
            ids: Object.keys(p.bf || {}).filter(id => (f.perm || /\bCreature\b/.test(p.bf[id].t || "")) && permanentMatches(p.bf[id], flt)), toks: Object.keys(p.tokens || {}).filter(k => f.perm || isCreatureToken(p.tokens[k].name)), ...(f.perm ? { perm: true } : {}) };
          ctx.logs.push(`⚙ ${src}: ${f.everyone ? `all ${f.type ? f.type + " " : ""}creatures` : `${ctx.who ? ctx.who + "'s " : ""}${f.type ? f.type + " " : ""}${f.perm ? "permanents" : "creatures"}`} ${val(f.dp) || val(f.dt) ? `get ${val(f.dp) >= 0 ? "+" : ""}${val(f.dp)}/${val(f.dt) >= 0 ? "+" : ""}${val(f.dt)}${f.kws.length ? ` and ${f.kws.join(", ")}` : ""}` : `gain ${f.kws.join(", ")}`} until end of turn`);
          if (f.everyone) (ctx.others ||= []).push({ ...f, everyone: false, other: false, dp: String(val(f.dp)), dt: String(val(f.dt)), xCount: null, xGreatest: false, perEach: null, src });
        }
        if (f.k === "pumpOn") { // one chosen creature or one token from a stack
          p.eot ||= {};
          const id = `e${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
          if (f.target.kind === "bf" && p.bf?.[f.target.id]) { p.eot[id] = { src, target: f.target.id, dp: f.dp, dt: f.dt, kws: f.kws }; ctx.logs.push(`⚙ ${src}: ${p.bf[f.target.id].nick || p.bf[f.target.id].n} ${pumpWords(f.dp, f.dt, f.kws)} until end of turn`); }
          if (f.target.kind === "tok" && p.tokens?.[f.target.id]) {
            const t = p.tokens[f.target.id];
            const moved = { ...t, count: 1, ep: [...(t.ep || []), id] }; delete moved.tapped; delete moved.fresh; // tagged, so the pump follows this token through re-stacking
            if ((t.count - (t.tapped || 0)) <= 0) moved.tapped = 1;
            t.count -= 1; if (moved.tapped) t.tapped -= 1;
            if (t.count <= 0) delete p.tokens[f.target.id];
            p.tokens[`${f.target.id}~${id}`] = moved;
            p.eot[id] = { src, epTag: true, ids: [], toks: [], dp: f.dp, dt: f.dt, kws: f.kws };
            ctx.logs.push(`⚙ ${src}: a ${t.name} token ${pumpWords(f.dp, f.dt, f.kws)} until end of turn`);
          }
        }
        if (f.k === "pumpTarget") ctx.remind.push({ src, srcId, text: f.untapOnly ? `Untap target ${f.what}.` : `Target ${f.what}${f.filter.controller === "you" ? " you control" : ""} ${pumpWords(f.dp, f.dt, f.kws)} until end of turn.`, pumpPick: f, times: 1 });
        if (f.k === "countersTarget") ctx.remind.push({ src, srcId, text: "", counterPick: { ...f, left: (f.total || 1) * Math.max(1, times) }, times: 1 });
        if (f.k === "scute") { const lands = Object.values(p.bf || {}).filter(e => /\bLand\b/.test(e.t || "")).length;
          for (let i = 0; i < Math.max(1, times); i++) { if (lands >= f.lands) ctx.remind.push({ src, srcId, text: "", selfCopies: { n: 1, id: srcId }, times: 1 }); else queue.push({ type: "create", name: f.name, desc: f.desc, n: 1, src }); }
          if (lands >= f.lands) ctx.logs.push(`⚙ ${src}: ${lands} lands — copies itself`); }
        if (f.k === "dblCtrSelf" && p.bf?.[srcId]) { const e = p.bf[srcId]; for (let i = 0; i < Math.max(1, times); i++) { const cur = e.c?.[f.key] || 0; if (!cur) break; const add = counterAmount(cur, f.key, e); e.c[f.key] = cur + add; } ctx.logs.push(`⚙ ${src}: doubled its +1/+1 counters → ${e.c?.[f.key] || 0}`); }
        if (f.k === "dblCtrAll") { let n = 0; Object.values(p.bf || {}).forEach(e => { if (!/\bCreature\b/.test(e.t || "") || (f.filter && !permanentMatches(e, f.filter))) return; for (let i = 0; i < Math.max(1, times); i++) { const cur = e.c?.[f.key] || 0; if (!cur) break; e.c[f.key] = cur + counterAmount(cur, f.key, e); n++; } }); ctx.logs.push(`⚙ ${src}: doubled the +1/+1 counters on ${n} creature${n === 1 ? "" : "s"}`); }
        if (f.k === "selfCopies") { const eid = ctx.curEv?.type === "enters" && ctx.curEv.id !== srcId ? ctx.curEv.id : srcId; ctx.remind.push({ src, srcId, text: "", selfCopies: { n: f.n * Math.max(1, times), nonleg: f.nonleg, id: eid }, times: 1 }); }
        if (f.k === "tokCopy") ctx.remind.push({ src, srcId, text: f.n != null && f.n !== 1 ? `Create ${f.n} tokens that are copies of target token you control.` : `Create a token that's a copy of target token you control.${f.twoIf ? ` (A ${f.twoIf}: two copies.)` : ""}`, tokCopy: true, ...(f.n != null ? { copyN: f.n } : {}), ...(f.twoIf ? { twoIf: f.twoIf } : {}), times: 1 });
        if (f.k === "drainCount") {
          const self = srcId && p.bf?.[srcId];
          const colorsAmong = /^colors? among permanent/.test(f.types[0] || ""); // Vivid (Shimmercreep): colors among the permanents you control
          const n = colorsAmong ? new Set(Object.values(p.bf || {}).flatMap(e => (String(e.m || "").match(/[WUBRG]/g) || []))).size
            : countTypes(p, f.types) - (f.other && self && f.types.some(t => permanentMatches(self, { alts: [[t]], controller: "any" })) ? 1 : 0);
          if (n > 0) { ctx.drain += n; p.life = (p.life ?? 40) + n; ctx.logs.push(`⚙ ${src}: each of ${ctx.who ? ctx.who + "'s " : ""}opponents loses ${n} life and ${ctx.who || "you"} gained ${n} (${colorsAmong ? "colors" : f.types.join("/")})`); }
        }
        if (f.k === "tplayerTok") ctx.remind.push({ src, srcId, text: `Target player creates ${f.n === 1 ? "a" : f.n}${f.tapped ? " tapped" : ""} ${f.desc} token${f.n === 1 ? "" : "s"}.`, tplayerTok: f, times: 1 });
        if (f.k === "untapAll" || f.k === "untapN") {
          let left = f.k === "untapN" ? f.n : Infinity, n = 0;
          Object.values(p.bf || {}).forEach(e => { if (left > 0 && e.tap && permanentMatches(e, f.filter)) { delete e.tap; left--; n++; } });
          Object.values(p.tokens || {}).forEach(t => { if (left > 0 && t.tapped && permanentMatches({ t: isCreatureToken(t.name) ? "Token Creature" : "Token Artifact", n: t.name }, f.filter)) { const k = Math.min(left, t.tapped); t.tapped -= k; if (!t.tapped) delete t.tapped; left -= k; n += k; } });
          ctx.logs.push(`⚙ ${src}: ${ctx.who ? ctx.who + " " : ""}untapped ${n} ${f.what}`);
        }
        if (f.k === "phaseAll") {
          p.phased ||= {};
          const nb = Object.keys(p.bf || {}).length, nt = Object.values(p.tokens || {}).reduce((a, t) => a + (t.count || 0), 0);
          p.phased.bf = { ...(p.phased.bf || {}), ...(p.bf || {}) }; delete p.bf;
          p.phased.tokens = { ...(p.phased.tokens || {}), ...(p.tokens || {}) }; delete p.tokens;
          ctx.logs.push(`👻 ${src}: ${nb} permanent${nb === 1 ? "" : "s"}${nt ? ` and ${nt} token${nt === 1 ? "" : "s"}` : ""} phased out`);
        }
        if (f.k === "protect") { p.prot = { src, life: !!f.life, all: !!f.all }; ctx.logs.push(`🛡 ${src}: ${f.all ? "protection from everything" : ""}${f.all && f.life ? " · " : ""}${f.life ? "life total can't change" : ""} until their next turn`); }
        if (f.k === "ping") ctx.remind.push({ src, srcId, text: "", ping: { n: f.n && f.n.enterPow ? (() => { const id = ctx.curEv?.id || ctx.curEv?.ids?.[0], x = id && p.bf?.[id]; if (x) return (Number(x.p) || 0) + (x.c?.p1p1 || 0) - (x.c?.m1m1 || 0); const tk = ctx.curEv?.list?.[0]; return Number((String(tk?.desc || "").match(/^(\d+)\//) || [])[1]) || 0; })() : f.n, left: 1, ...(f.playerOnly ? { playerOnly: true } : {}) }, thenEffs: [], times: 1 });
        if (f.k === "dmgCr") ctx.remind.push({ src, srcId, text: "", crDmg: { n: f.n, pw: f.pw, cr: f.cr, oppOnly: f.opp, ...(f.ctrl ? { ctrl: f.ctrl } : {}), ...(f.exile ? { exile: true } : {}), ...(f.upTo ? { grp: true } : {}) }, times: 1 });
        if (f.k === "dmgPer") ctx.remind.push({ src, srcId, text: "", dmgPer: f, times: 1 });
        if (f.k === "wisecrack") ctx.remind.push({ src, srcId, text: "", crDmg: { self: true, atk: f.atk, cr: true }, times: 1 });
        if (f.k === "bane") ctx.remind.push({ src, srcId, text: "", bane: {}, times: 1 });
        if (f.k === "extraCombat") ctx.remind.push({ src, srcId, text: "", extraCombat: true, times: 1 });
        if (f.k === "loot") ctx.remind.push({ src, srcId, text: `Draw ${f.draw === 1 ? "a card" : `${f.draw} cards`}, then discard ${f.disc === 1 ? "a card" : `${f.disc} cards`}.`, drawN: f.draw, times: 1 });
        if (f.k === "rummage") ctx.remind.push({ src, srcId, text: "", impulse: { n: 1, cards: [], toGy: true }, note: "You may discard a card. If you do, draw a card.", times: 1 });
        if (f.k === "untapAttacked" && p.attacked?.turnNo === ctx.turnNo) {
          const names = [];
          Object.keys(p.attacked.bf || {}).forEach(id => { if (p.bf?.[id]?.tap) { delete p.bf[id].tap; names.push(p.bf[id].n); } });
          Object.entries(p.attacked.tok || {}).forEach(([k, n]) => { const t = p.tokens?.[k]; if (t?.tapped) { const u = Math.min(n, t.tapped); t.tapped -= u; if (!t.tapped) delete t.tapped; names.push(`${u} ${t.name}`); } });
          if (names.length) ctx.logs.push(`⚙ ${src}: untapped ${names.join(", ")} (attacked this turn)`);
        }
        if (f.k === "dmgAll") ctx.remind.push({ src, srcId, text: "", dmgAll: f, times: 1 });
        if (f.k === "discardN") ctx.remind.push({ src, srcId, text: "", impulse: { n: f.n, cards: [], toGy: true }, times: 1 });
        if (f.k === "copySpell") ctx.remind.push({ src, srcId, text: "", copySpell: { ...f, card: ctx.curEv?.card || null }, times: 1 });
        if (f.k === "doublePow") ctx.remind.push({ src, srcId, text: "", doublePow: true, times: 1 });
        if (f.k === "dmgDef") ctx.remind.push({ src, srcId, text: "", dmgDef: { n: f.n }, times: 1 });
        if (f.k === "pcounter") { p[f.key] = (p[f.key] || 0) + f.n; ctx.logs.push(`⚙ ${src}: ${ctx.who || "you"} got ${f.n} ${f.key} counter${f.n === 1 ? "" : "s"} (${p[f.key]})`); }
        if (f.k === "earthbend") ctx.remind.push({ src, srcId, text: "", earthbend: { n: f.n === "experience" ? (p.experience || 0) : f.n }, times: 1 });
        if (f.k === "dieGain") ctx.remind.push({ src, srcId, text: "", dieGain: { n: f.n, ifPaid: f.ifPaid }, times: 1 });
        if (f.k === "tokAtkMe") ctx.remind.push({ src, srcId, text: "", tokAtkMe: f, times: 1 });
        if (f.k === "veil") ctx.remind.push({ src, srcId, text: "", veil: f, times: 1 });
        if (f.k === "plumb") ctx.remind.push({ src, srcId, text: "", plumb: true, times: 1 });
        if (f.k === "drainX") ctx.remind.push({ src, srcId, text: "", drainX: true, times: 1 });
        if (f.k === "necroSel") ctx.remind.push({ src, srcId, text: "", necroSel: f, times: 1 });
        if (f.k === "spoil") ctx.remind.push({ src, srcId, text: "", spoil: f, times: 1 });
        if (f.k === "eqCtr") {
          const host = p.bf?.[srcId]?.att, h = host && host !== "tok" && p.bf?.[host];
          if (h) { const n = f.typ && new RegExp(`\\b${f.typ}\\b`, "i").test(h.t || "") ? f.n2 : f.n, add = counterAmount(n, "p1p1", h); h.c ||= {}; h.c.p1p1 = (h.c.p1p1 || 0) + add; ctx.logs.push(`⚙ ${src}: +${add} +1/+1 counter${add === 1 ? "" : "s"} on ${h.nick || h.n} → ${h.c.p1p1}`); }
          else if (host === "tok") ctx.remind.push({ src, srcId, text: `Put ${f.n} +1/+1 counter${f.n === 1 ? "" : "s"} on the equipped token${f.typ ? ` (${f.n2} if it's a ${f.typ})` : ""}.`, times });
        }
        if (f.k === "attachSelf") ctx.remind.push({ src, srcId, text: `Attach it to target ${f.type} you control.`, attachPick: { srcId, type: f.type }, times: 1 });
        if (f.k === "imprintLib") ctx.remind.push({ src, srcId, text: "", imprintLib: f, times: 1 });
        if (f.k === "oppsTok") ctx.remind.push({ src, srcId, text: "", oppsTok: f, times: Math.max(1, times) });
        if (f.k === "revealMv") ctx.remind.push({ src, srcId, text: "", revealMv: f.mode, times: 1 });
        if (f.k === "victimize") ctx.remind.push({ src, srcId, text: "", victimize: f, times: 1 });
        if (f.k === "transformSelf" || f.k === "reenterFace") ctx.remind.push({ src, srcId, text: "", flipFace: { id: srcId, reenter: f.k === "reenterFace", front: !!f.front }, times: 1 });
        if (f.k === "ctrEntering") { const id = ctx.curEv?.id || ctx.curEv?.ids?.[0]; const x = id && p.bf?.[id]; if (x) { const add = counterAmount(f.n, "p1p1", x); x.c ||= {}; x.c.p1p1 = (x.c.p1p1 || 0) + add; if (f.haste) { p.eot ||= {}; p.eot[`h${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`] = { src, target: id, dp: 0, dt: 0, kws: ["haste"] }; } ctx.logs.push(`⚙ ${src}: +${add} +1/+1 counter${f.haste ? " and haste" : ""} on ${x.nick || x.fname || x.n}`); } else ctx.remind.push({ src, srcId, text: "Put a +1/+1 counter on that creature; it gains haste until end of turn.", times: 1 }); }
        if (f.k === "wheelGy") { const g = Object.keys(p.gy || {}).length; delete p.gy; ctx.logs.push(`⚙ ${src}: ${ctx.who || "they"} shuffled their graveyard (${g}) and hand into their library`); ctx.remind.push({ src, srcId, text: `Draw ${f.n} cards.`, drawN: f.n, times: 1, note: "Your hand went into your library first." }); }
        if (f.k === "blink") ctx.remind.push({ src, srcId, text: `Exile target ${f.what || "creature"} you control, then return it to the battlefield.`, blink: f.filter ? { filter: f.filter } : true, times: 1 });
        if (f.k === "copyTrig") ctx.remind.push({ src, srcId, text: "Copy target triggered ability you control.", copyTrig: true, times: 1 });
        if (f.k === "animate") ctx.remind.push({ src, srcId, text: `Target ${f.what} becomes an artifact creature with base power and toughness ${f.p}/${f.tg} (unless it's a Vehicle).`, animate: f, times: 1 });
        if (f.k === "copyPick") ctx.remind.push({ src, srcId, text: f.any ? `Copy target instant or sorcery spell${f.bounce ? ", then return it to its owner's hand" : ""}.` : "Copy target instant or sorcery spell you control.", copySpell: { card: null, pick: true, ...(f.any ? { any: true } : {}), ...(f.bounce ? { bounce: true } : {}) }, times: 1 });
        if (f.k === "maze") ctx.remind.push({ src, srcId, text: "Untap target attacking creature. Combat damage to and by it is prevented this turn.", maze: true, times: 1 });
        if (f.k === "eachDraw") ctx.remind.push({ src, srcId, text: "", eachDraw: f, times: 1 });
        if (f.k === "addType") ctx.remind.push({ src, srcId, text: `Target ${f.what} becomes ${/^[aeiou]/i.test(f.type) ? "an" : "a"} ${f.type.toLowerCase()} in addition to its other types until end of turn.`, addType: f, times: 1 });
        if (f.k === "copyNext") { p.riders = [...(p.riders || []).filter(x => x.turnNo === ctx.turnNo), { kind: "copyNext", ctype: f.type, src, at: Date.now(), turnNo: ctx.turnNo }]; ctx.logs.push(`⚙ ${src}: your next ${f.type} spell this turn gets copied`); }
        if (f.k === "arcum") ctx.remind.push({ src, srcId, text: "Target artifact creature's controller sacrifices it, then may search for a noncreature artifact and put it onto the battlefield.", arcum: true, times: 1 });
        if (f.k === "tapLock") ctx.remind.push({ src, srcId, text: `Tap up to one target ${f.what}. It doesn't untap while you control ${src}.`, tapLock: { what: f.what }, times: 1 });
        if (f.k === "exileRetMine" && !f.pick) { let k = 0; p.ex ||= {}; Object.entries(p.bf || {}).forEach(([id, x]) => { if (!/\bCreature\b/.test(x.t || "") || x.own) return; p.ex[id] = { n: x.n, t: x.t || "", m: x.m || "", img: x.img || "", ...(x.o ? { o: x.o } : {}), retEnd: true, src, at: Date.now() }; delete p.bf[id]; k++; });
          let tk = 0; if (!f.nontoken) Object.entries(p.tokens || {}).forEach(([key, t]) => { if (isCreatureToken(t.name)) { tk += t.count || 0; delete p.tokens[key]; } });
          ctx.logs.push(`⚙ ${src}: exiled ${k} creature${k === 1 ? "" : "s"}${tk ? ` (${tk} token${tk === 1 ? "" : "s"} gone for good)` : ""} — they return at the beginning of the next end step`); }
        if (f.k === "exileRetMine" && f.pick) ctx.remind.push({ src, srcId, text: "Exile any number of your creatures; they return at the beginning of the next end step.", retPick: { pw: f.pw, bonus: f.bonus }, times: 1 });
        if (f.k === "exileRet" && p.bf?.[srcId]) { p.ex ||= {}; const x = p.bf[srcId]; p.ex[srcId] = { n: x.n, t: x.t || "", m: x.m || "", img: x.img || "", ...(x.o ? { o: x.o } : {}), ...(x.cmd ? { cmd: true } : {}), retEnd: true, src, at: Date.now() }; delete p.bf[srcId]; ctx.logs.push(`⚙ ${src}: exiled — returns at the beginning of the next end step`); }
        if (f.k === "wheelAll") ctx.remind.push({ src, srcId, text: `Each player ${f.may ? "may discard their hand and draw" : "discards their hand, then draws"} ${f.n} cards.`, wheelAll: f, times: 1 });
        if (f.k === "fbAll") { let k = 0; Object.values(p.gy || {}).forEach(g => { if (/\b(Instant|Sorcery)\b/.test(g.t || "")) { g.fb = ctx.turnNo ?? 0; k++; } }); ctx.logs.push(`⚙ ${src}: ${k} instant/sorcery card${k === 1 ? "" : "s"} in the graveyard gained flashback this turn`); }
        if (f.k === "untapSelf" && p.bf?.[srcId]?.tap) { delete p.bf[srcId].tap; ctx.logs.push(`⚙ ${src}: untapped`); }
        if (f.k === "prepSelf" && p.bf?.[srcId]) { p.bf[srcId].prepared = true; ctx.logs.push(`🔮 ${src} is prepared`); }
        if (f.k === "tloseX") ctx.remind.push({ src, srcId, text: "", tloseX: true, times: 1 });
        if (f.k === "clearCtrs") ctx.remind.push({ src, srcId, text: "", clearCtrs: true, times: 1 });
        if (f.k === "drainDevo") ctx.remind.push({ src, srcId, text: "", drainDevo: f.color, times: 1 });
        if (f.k === "oppLoseThat") ctx.remind.push({ src, srcId, text: "", oppLose: { n: ctx.curEv?.n || 1 }, times: 1 });
        if (f.k === "minusX") ctx.remind.push({ src, srcId, text: "", minusX: true, times: 1 });
        if (f.k === "bounceOwn") ctx.remind.push({ src, srcId, text: "", bounceOwn: f, times: 1 });
        if (f.k === "radiant") ctx.remind.push({ src, srcId, text: "", radiant: {}, times: 1 });
        if (f.k === "amass") {
          const name = `${f.type.replace(/s$/, "")} Army`;
          const army = Object.values(p.bf || {}).find(e => e.army && e.n === name);
          if (army) { army.c ||= {}; army.c.p1p1 = (army.c.p1p1 || 0) + f.n; ctx.logs.push(`⚙ ${src}: amass ${f.type} ${f.n} → ${name} has ${army.c.p1p1} +1/+1`); }
          else {
            p.bf ||= {};
            p.bf[`army${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`] = { n: name, t: `Token Creature — ${f.type.replace(/s$/, "")} Army`, m: "", img: "", p: "0", tg: "0", tok: true, army: true, c: { p1p1: counterAmount(f.n, "p1p1", { t: "Creature" }) }, ...(ctx.turnNo != null ? { et: ctx.turnNo } : {}) };
            ctx.logs.push(`⚙ ${src}: amass ${f.type} ${f.n} → created a 0/0 ${name} with ${f.n} +1/+1`);
            queue.push({ type: "tokens", list: [{ name, n: 1 }] });
          }
        }
        if (f.k === "swap") ctx.remind.push({ src, srcId, text: f.self ? `Exchange control of ${src} and ${f.upTo ? "up to one " : ""}target ${f.what} an opponent controls.` : `Exchange control of two target ${f.what}s.`, swap: f, times: 1 });
        if (f.k === "controlTurn") ctx.remind.push({ src, srcId, text: "You control target player during their next turn.", controlTurn: true, times: 1 });
        if (f.k === "stealEx") ctx.remind.push({ src, srcId, text: "", effs: [f], times: 1 });
        if (f.k === "gyhate") ctx.remind.push({ src, srcId, text: "", gyHate: f, times: 1 });
        if (f.k === "mana") {
          const e = p.bf?.[srcId];
          const n = f.per ? (e?.c?.[f.per] || 0) : f.perCount ? countOf(p, f.perCount) : 1;
          if (n > 0) ctx.remind.push({ src, srcId, text: `Add ${n > 1 ? `${n}× ` : ""}${f.syms}`, mana: { syms: f.syms, n }, times: 1,
            note: f.per ? `${n} ${f.perLabel} counter${n === 1 ? "" : "s"}` : f.perCount ? `${n} ${f.perLabel}${n === 1 ? "" : "s"}` : "" });
        }
        if (f.k === "tlose" && f.target) {
          ctx.hits = ctx.hits || {};
          ctx.hits[f.target] = (ctx.hits[f.target] || 0) + f.n;
          ctx.logs.push(`⚙ ${src}: ${f.targetName || "target player"} loses ${f.n}`);
        }
        if (f.k === "odraw") { (ctx.notes ||= []).push({ to: "opps", draw: f.n, src }); ctx.logs.push(`⚙ ${src}: each of ${ctx.who ? ctx.who + "'s " : ""}opponents draws ${f.n}`); }
        const ncN = f.k === "dmgThem" && f.n === "nc" ? (ctx.curEv?.prior || []).filter(c => !/Creature/.test(c.t || "")).length + 1 : null;
        if (ncN != null) f = { ...f, n: ncN };
        if (f.k === "dmgThem" && ctx.curEv?.type === "phase") { const n = (Number(f.n) || 1) * (env?.dmgMult || 1); // Sulfuric Vortex: "each player's upkeep … to that player"
          if (ctx.curEv.mine) { p.life = (p.life ?? 40) - n; ctx.logs.push(`⚙ ${src}: ${n} damage to ${ctx.who || "you"}`); }
          else if (ctx.curEv.active) { (ctx.hits ||= {})[ctx.curEv.active] = (ctx.hits[ctx.curEv.active] || 0) + n; ctx.dmgHits = true; ctx.logs.push(`⚙ ${src}: ${n} damage to the active player`); }
          else ctx.remind.push({ src, srcId, text: `It deals ${n} damage to that player (whose turn it is).`, times: 1 }); }
        if (f.k === "dmgThem" && ctx.curEv?.type === "cast") { p.life = (p.life ?? 40) - f.n; ctx.logs.push(`⚙ ${src}: ${f.n} damage to ${ctx.who || "you"} (cast a spell)`); }
        if (f.k === "loseThem") { const ev = ctx.curEv || {};
          if (ev.type === "cast" || (ev.type === "phase" && ev.mine)) { p.life = (p.life ?? 40) - f.n; ctx.logs.push(`⚙ ${src}: ${ctx.who || "you"} lost ${f.n} life`); }
          else if (ev.type === "phase" && ev.active) { (ctx.hits ||= {})[ev.active] = (ctx.hits[ev.active] || 0) + f.n; ctx.logs.push(`⚙ ${src}: the active player loses ${f.n} life`); }
          else if (ev.by) { (ctx.hits ||= {})[ev.by] = (ctx.hits[ev.by] || 0) + f.n; ctx.logs.push(`⚙ ${src}: the player who ${/cast/.test(ev.type || "") ? "cast it" : "triggered it"} loses ${f.n} life`); }
          else ctx.remind.push({ src, srcId, text: `That player loses ${f.n} life.`, times: 1 }); }
        if (f.k === "dmgThem" && ctx.curEv?.by) { // the player who caused the trigger (drew a card, cast a spell…)
          const red = env?.redBonus && /R/.test(p.bf?.[srcId]?.m || "");
          const n = f.n * (env?.dmgMult || 1) + (red ? env.redBonus : 0); // applyEffects already repeats this per trigger
          (ctx.hits ||= {})[ctx.curEv.by] = (ctx.hits[ctx.curEv.by] || 0) + n;
          ctx.dmgHits = true;
          ctx.logs.push(`⚙ ${src}: ${n} damage to the player who ${/cast/.test(ctx.curEv.type || "") ? "cast it" : "drew"}${env?.dmgMult > 1 ? ` (×${env.dmgMult})` : ""}${red ? ` (+${env.redBonus} red source)` : ""}`);
        }
        if (f.k === "copyCreature") ctx.remind.push({ src, srcId, text: "Create a token copy of target creature you control.", copyCreature: f, times: 1 });
        if (f.k === "drain" && f.dmg) { // damage to each opponent: Torbran-style "+2 from red sources"
          const red = env?.redBonus && /R/.test(p.bf?.[srcId]?.m || "") ? env.redBonus : 0;
          const tot = f.n * (env?.dmgMult || 1) + red;
          ctx.drain += tot; ctx.dmgDrain = (ctx.dmgDrain || 0) + tot;
          ctx.logs.push(`⚙ ${src}: ${tot} damage to each of ${ctx.who ? ctx.who + "'s " : ""}opponents${env?.dmgMult > 1 ? ` (×${env.dmgMult})` : ""}${red ? ` (+${red} red source)` : ""}`);
          continue;
        }
        if (f.k === "drain") { ctx.drain += f.n; ctx.logs.push(`⚙ ${src}: each of ${ctx.who ? ctx.who + "'s " : ""}opponents loses ${f.n} life`); }
      }
    }
  };

  const settle = () => {
    Object.values(p.bf || {}).forEach(e => { if (e.c) { annihilate(e.c); if (!Object.keys(e.c).length) delete e.c; } });
    if (Object.values(p.tokens || {}).some(t => t.c?.p1p1 && t.c?.m1m1)) tidyTokenStacks(p);
  };
  while (queue.length && guard++ < 200) {
    const ev = queue.shift();
    if (ev.type === "effects") { applyEffects(ev.effs, ev.times, ev.count, ev.src, ev.srcId); continue; }
    if (ev.type === "create") {
      if (!ev.n) continue;
      let batch = ev.batch ? ev.batch.map(b => ({ name: b.name, n: b.n })) : [{ name: ev.name, n: ev.n }];
      const descs = ev.batch ? Object.fromEntries(ev.batch.map(b => [b.name, b.desc])) : { [ev.name]: ev.desc };
      const notes = [];
      if (enabled) {
        const srcs = sources();
        const repls = srcs.flatMap(s => s.ab.repl.map(r => ({ ...r, by: label(s.e) })));
        repls.filter(r => r.kind === "manufactor").forEach(r => {
          const next = [];
          batch.forEach(b => {
            if (["clue", "food", "treasure"].includes(b.name.toLowerCase())) ["Clue", "Food", "Treasure"].forEach(x => next.push({ name: x, n: b.n }));
            else next.push(b);
          });
          if (next.length !== batch.length) notes.push(r.by);
          batch = next;
        });
        repls.filter(r => r.kind === "artTokInstead").forEach(r => {
          let k = 0; const next = [];
          batch.forEach(b => { if (!isCreatureToken(b.name) || /\bartifact\b/i.test(descs[b.name] || "")) k += b.n; else next.push(b); });
          if (k) { next.push({ name: r.name, n: k }); descs[r.name] = r.desc; notes.push(r.by); batch = next; }
        });
        repls.filter(r => r.kind === "plusOn").forEach(r => {
          const on = batch.filter(b => b.name.toLowerCase() === r.on.toLowerCase()).reduce((a, b) => a + b.n, 0);
          if (on) { batch.push({ name: r.name, n: on }); notes.push(r.by); }
        });
        repls.filter(r => r.kind === "plus").forEach(r => {
          const total = batch.reduce((s, b) => s + b.n, 0);
          if (total) { batch.push({ name: r.name, n: r.many ? total : 1 }); descs[r.name] ||= r.desc; notes.push(r.by); }
        });
        repls.filter(r => r.kind === "double").forEach(r => { batch = batch.map(b => ({ ...b, n: b.n * 2 })); notes.push(r.by); });
        repls.filter(r => r.kind === "triple").forEach(r => { if (batch.some(b => !r.creature || isCreatureToken(b.name))) { batch = batch.map(b => (!r.creature || isCreatureToken(b.name) ? { ...b, n: b.n * 3 } : b)); notes.push(r.by); } });
        const merged = new Map();
        batch.forEach(b => merged.set(b.name, (merged.get(b.name) || 0) + b.n));
        batch = [...merged].map(([name, n]) => ({ name, n }));
      }
      batch.forEach(b => addTokens(p, b.name, b.n, descs[b.name], (ev.tapped && b.name === ev.name) || (env?.tapIn || []).some(r => permanentMatches(tokPerm(b.name), r.filter)), ctx.turnNo));
      ctx.logs.push(`${ev.src ? `⚙ ${ev.src}: ${ctx.who ? ctx.who + " " : ""}` : `${ctx.who} `}created ${batch.map(b => `${b.n} ${b.name}`).join(", ")}${notes.length ? ` (via ${[...new Set(notes)].join(", ")})` : ""}`);
      queue.push({ type: "tokens", list: batch.map(b => ({ ...b, desc: descs[b.name] || p.tokens?.[slug(b.name)]?.desc })) });
      continue;
    }
    if (!enabled) continue;
    const evx = hushed(ev);
    if (!evx) continue;
    const bonus = extra(evx);
    // Two or more automatic triggers from different sources on the same event: the player picks the order (env.orderTriggers)
    let deferAuto = false;
    if (env?.orderTriggers) { const srcs = new Set(); for (const s of sources()) for (const t of s.ab.trig) { if (!t.auto || (t.lvl || 1) > (s.e.lvl || 1)) continue; try { if (matches(t.cond, evx, s.id)) srcs.add(s.id); } catch {} } deferAuto = srcs.size >= 2; }
    for (const s of sources()) {
      for (let [ti, t] of s.ab.trig.entries()) {
        if ((t.lvl || 1) > (s.e.lvl || 1)) continue; // a Class level not reached yet
        let times = matches(t.cond, evx, s.id);
        if (!times) continue;
        if (t.effs?.some(f => f.n?.spellMv)) t = { ...t, effs: t.effs.map(f => f.n?.spellMv ? { ...f, n: manaValue(evx.card?.m || "") } : f) }; // Ovika: X = that spell's mana value
        if (t.onceTurn) { const k = `${s.id}:${ti}`; p.onceT ||= {}; if (p.onceT[k] === ctx.turnNo) continue; p.onceT[k] = ctx.turnNo; times = 1; }
        if (t.cond.ifGained && p.lifeGained !== ctx.turnNo) continue;
        if (t.maxSpeed && (p.speed || 0) < 4) continue; // "Max speed — …" works only at speed 4
        if (t.cond.ifGainedN && !(p.lifeGainedN?.t === ctx.turnNo && (p.lifeGainedN.n || 0) >= t.cond.ifGainedN)) continue; // Resplendent Angel, Valkyrie Harbinger: intervening "if"
        if (t.cond.ifDied && env && env.anyDied === false) continue; // Séance Board, Needletooth Pack
        if (t.cond.ifNoCreatures && env && env.anyCreature === true) continue; // Pestilence
        if (t.cond.ifNone && countTypes(p, [t.cond.ifNone]) > 0) continue; // Ophiomancer: "if you control no Snakes"
        if (t.cond.ifBlessing && !p.effects?.blessing) continue;
        if (t.cond.ifAnyLost && !((env?.anyLost || 0) >= t.cond.ifAnyLost)) continue;
        if (t.cond.ifKicked && !p.bf?.[s.id]?.kicked) continue;
        if (t.cond.ifCtrs && Object.values(p.bf || {}).filter(e => /\b(Artifact|Creature)\b/.test(e.t || "")).reduce((a, e) => a + Object.values(e.c || {}).reduce((b, v) => b + (v > 0 ? v : 0), 0), 0) + Object.values(p.tokens || {}).reduce((a, t) => a + (t.count || 0) * Object.values(t.c || {}).reduce((b, v) => b + (v > 0 ? v : 0), 0), 0) < t.cond.ifCtrs) continue;
        if (t.cond.notTheirTurn && evx.theirTurn) continue;
        if (t.cond.enchOpp && p.bf?.[s.id]?.encOpp && evx.by !== p.bf[s.id].encOpp) continue;
        if (t.cond.ifCount && (t.cond.ifCount.distinct ? new Set(Object.values(p.bf || {}).filter(e => /\bLand\b/.test(e.t || "")).map(e => e.n)).size : countTypes(p, [t.cond.ifCount.type])) < t.cond.ifCount.n) continue;
        if (t.cond.ifOppLost && !((env?.oppLost || 0) >= t.cond.ifOppLost)) continue;
        if (t.cond.ifDesig && env?.desig && !env.desig[t.cond.ifDesig]) continue;
        { const bx = bonus && (evx.type === "enters" || evx.type === "tokens" || evx.type === "dies" || evx.type === "cast" || evx.type === "attacks" || evx.type === "youattack") ? bonus : 0, sx = srcExtra(s.e, s.id); if (bx || sx) times *= 1 + bx + sx; } // each "triggers an additional time" adds one more
        const count = evx.type === "tokens" ? evx.list.reduce((a, b) => a + b.n, 0) : evx.n || 1;
        // South Pole Voyager: "if this is the second time this ability has resolved this turn, draw a card" (each Ally entering is its own trigger)
        if (t.auto && /if this is the second time this ability has resolved this turn, draw a card/i.test(t.text)) { const k = `${s.id}:${ti}`, inc = times * (t.cond?.once ? 1 : count); p.resolved ||= {}; const r0 = p.resolved[k]?.t === ctx.turnNo ? p.resolved[k].n : 0; p.resolved[k] = { t: ctx.turnNo, n: r0 + inc }; if (r0 < 2 && r0 + inc >= 2) ctx.remind.push({ src: label(s.e), srcId: s.id, text: "Draw a card (second time this turn).", drawN: 1, times: 1 }); }
        if (t.auto && deferAuto) { ctx.remind.push({ src: label(s.e), srcId: s.id, text: t.text, times, effs: t.effs, count, resolveOrder: true }); continue; }
        if (t.auto) {
          ctx.curEv = evx;
          applyEffects(t.effs, times, count, label(s.e), s.id);
          (ctx.applied ||= []).push({ src: label(s.e), srcId: s.id, effs: t.effs, count, text: t.text, evN: evx.n ?? null });
          const dl = t.partial && t.text.match(/^you draw (a|one|two|three) cards? and lose \w+ life\.?$/i);
          if (t.drawRest) ctx.remind.push({ src: label(s.e), srcId: s.id, text: `Draw ${t.drawRest * times === 1 ? "a card" : `${t.drawRest * times} cards`}.`, drawN: t.drawRest * times, times: 1 });
          else if (dl) ctx.remind.push({ src: label(s.e), text: `Draw ${dl[1] === "a" ? "a card" : `${dl[1]} cards`}.`, times });
          else if (!t.partial && !(t.effs || []).some(f => /draw/i.test(f.k)) && /\b(?:and|then) draw (?:a|one|two|three) cards?\b/i.test(t.text)) { const dm = t.text.match(/\b(?:and|then) draw (a|one|two|three) cards?\b/i), k = ({ a: 1, one: 1, two: 2, three: 3 })[dm[1].toLowerCase()] * Math.min(times * (t.cond?.once ? 1 : count), 50); ctx.remind.push({ src: label(s.e), srcId: s.id, text: `Draw ${k === 1 ? "a card" : `${k} cards`}.`, times: 1, drawN: k }); }
          else if (t.partial && !/^you gain \d+ life\. if this is the second time this ability has resolved this turn, draw a card\.?$/i.test(t.text)) ctx.remind.push({ src: label(s.e), text: t.text, times, note: "Partly applied. Handle the rest yourself." }); // (the second-time draw is tracked above)
        } else if (t.punish) {
          // one question per trigger, asked to the player who caused it
          for (let i = 0; i < Math.min(times, 20); i++) ctx.remind.push({ src: label(s.e), srcId: s.id, text: t.text, times: 1, punish: t.punish, who: ev.by || null });
        } else {
          const epw = () => { const x = evx.id && p.bf?.[evx.id]; if (x) return (Number(x.p) || 0) + (x.c?.p1p1 || 0) - (x.c?.m1m1 || 0); return Number((String(evx.list?.[0]?.desc || "").match(/^(\d+)\//) || [])[1]) || 0; };
          ctx.remind.push({ src: label(s.e), srcId: s.id, text: t.text, times, effs: (t.effs || []).map(f => f.k === "ping" && f.n?.enterPow ? { ...f, n: epw() } : f.k === "ping" && f.n?.evAmt ? { ...f, n: evx.amt || 1 } : f), count, choice: t.choice, modes: t.modes, pick: t.pick, ...(evx.type === "gainlife" ? { evN: evx.n } : {}), ...(t.note ? { note: t.note } : {}), who: ev.by || ev.active || null,
            ...(ev.type === "oppcast" && /same mana value/i.test(t.text) ? { sameMv: { mv: manaValue(ev.card?.m || ""), name: ev.card?.n } } : {}),
            ...(/where X is that spell's mana value/i.test(t.text) && ev.card ? { xVal: manaValue(ev.card.m || ""), xWhy: `${ev.card.n}'s mana value` } : {}),
            ...(t.effs?.some(f => f.k === "copySpell") && ev.card ? { evCard: ev.card } : {}),
            ...(t.effs?.some(f => f.k === "attachNew") ? { ent: ev.type === "enters" ? { id: ev.id, name: ev.card?.n } : ev.type === "tokens" ? { toks: ev.list.filter(b => !t.cond.types || t.cond.types.some(x => tokenIs(b.name, x))).map(b => b.name) } : null } : {}) });
        }
      }
    }
  }
  if (guard >= 200 && queue.length) ctx.remind.push({ src: "♾ Endless loop", text: "These triggers keep setting each other off, so this is an infinite loop. The app stopped after 200 steps. If nothing can stop it, a mandatory loop makes the game a draw; if something wins mid-loop (like Terror of the Peaks), that player wins.", times: 1 });
  settle();
  // "Champion: +2 counters → 2", "→ 4", "→ 6"… read as one line: "+2 +1/+1 counters ×3 → 6"
  // and Prosperous Innkeeper ×4: "Kari gained 1 life" four times → "Kari gained 4 life (×4)"
  const out = [];
  for (const l of ctx.logs) {
    const m = l.match(/^(⚙ .+?: \+\d+ .+? counters?) → (\d+)$/), prev = out.at(-1);
    if (m && prev?.key === m[1]) { prev.k++; prev.last = m[2]; continue; }
    if (!m && prev?.line === l) { prev.rep = (prev.rep || 1) + 1; continue; }
    out.push(m ? { key: m[1], k: 1, last: m[2] } : { line: l });
  }
  const sumUp = o => { const g = o.line.match(/^(.*? (?:gained|lost) )(\d+)( life)(.*)$/); return g ? `${g[1]}${Number(g[2]) * o.rep}${g[3]}${g[4]} (×${o.rep})` : `${o.line} ×${o.rep}`; };
  ctx.logs.splice(0, ctx.logs.length, ...out.map(o => o.line != null ? (o.rep > 1 ? sumUp(o) : o.line) : `${o.key}${o.k > 1 ? ` ×${o.k}` : ""} → ${o.last}`));
}

// Does this card enter tapped, given the board it's entering? true / false, or a reminder string when it's the player's call
export function entersTapped(card, p) {
  const line = (card?.o || "").split("\n").map(l => l.replace(/\([^)]*\)/g, "").trim())
    .find(l => /\benters( the battlefield)? tapped\b/i.test(l));
  if (!line) return false;
  const low = line.toLowerCase();
  if (!/\b(unless|if|you may|as)\b/.test(low.replace(/enters( the battlefield)? tapped\.?$/, ""))) return true;
  const lands = Object.values(p.bf || {}).filter(e => /\bLand\b/.test(e.t || ""));
  // "unless you control a legendary creature" (The Shire)
  const lc = low.match(/unless you control an? (legendary )?(creature|artifact|enchantment|planeswalker)\.?$/);
  if (lc) return !Object.values(p.bf || {}).some(e => new RegExp(`\\b${lc[2]}\\b`, "i").test(e.t || "") && (!lc[1] || /\bLegendary\b/.test(e.t || "")));
  if (/unless you control a basic land\.?$/.test(low)) return !lands.some(e => /\bBasic\b/.test(e.t || ""));
  // Check lands: "unless you control a Swamp or a Forest"
  let m = low.match(/unless you control an? ([a-z]+)(?: or an? ([a-z]+))?\.?$/);
  if (m && !["legendary", "creature", "artifact"].includes(m[1])) {
    const want = [m[1], m[2]].filter(Boolean);
    return !lands.some(e => want.some(w => new RegExp(`\\b${w}\\b`, "i").test(e.t)));
  }
  // Fast lands: "unless you control two or fewer other lands"; slow lands: "two or more other lands"
  m = low.match(/unless you control (two|three|\d) or (fewer|more) other lands/);
  if (m) {
    const n = { two: 2, three: 3 }[m[1]] ?? Number(m[1]);
    return m[2] === "fewer" ? !(lands.length <= n) : !(lands.length >= n);
  }
  m = low.match(/unless you control (two|three|\d) or more basic lands/);
  if (m) {
    const n = { two: 2, three: 3 }[m[1]] ?? Number(m[1]);
    return !(lands.filter(e => /\bBasic\b/.test(e.t)).length >= n);
  }
  return line;
}

// Activated abilities ("Cost: Effect" lines, plus planeswalker loyalty abilities)
const actCache = new Map();
export function activatedAbilities(card) {
  if (actCache.has(card.n)) return actCache.get(card.n);
  card = { ...card, o: kwExpand(card.o) };
  const short = card.n.split("#")[0].split(" // ")[0].split(",")[0].toLowerCase();
  const out = []; let curMS = false; const push0 = out.push.bind(out);
  out.push = (...a) => push0(...a.map(x => curMS ? { ...x, maxSpeed: true } : x)); // "Max speed — {T}: …" needs speed 4
  for (let line of (card.o || "").split("\n")) {
    curMS = /^Max speed — /i.test(line.trim());
    if (/^Channel\b/i.test(line.trim())) continue; // used from your hand, not the battlefield
    if (/^[^:]*\bdiscard (this card|~)\s*:/i.test(line.trim()) || new RegExp(`^[^:]*\\bdiscard ${card.n.split("#")[0].split(" // ")[0].replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*:`, "i").test(line.trim())) continue; // ditto
    line = line.replace(/\([^)]*\)/g, "").replace(/\s+/g, " ").trim().replace(/^[^—:{}]{1,60} — /, "");
    const m = line.match(/^([^:"]+?):\s*(.+)$/);
    if (!m || /^(whenever|when|at the beginning)/i.test(m[1])) continue;
    const cost = m[1].trim(), text = m[2].trim();
    const loy = cost.match(/^([+−-]?)(\d+|X)$/);
    if (!loy && !/\{|sacrifice|pay|remove|discard|exile|tap/i.test(cost)) continue;
    const lc = cost.toLowerCase();
    const costs = {
      tap: /\{T\}/.test(cost),
      life: num((lc.match(/pay (\d+|one|two|three) life/) || [])[1]),
      sacSelf: new RegExp(`sacrifice (this|${short.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`).test(lc),
      sacWhat: (lc.match(/sacrifice (?:a|an|another) ([a-z ]+?)(?:,|$)/) || [])[1] || null,
      sacMany: (() => { const m = lc.match(/sacrifice (two|three|four|five|six|\d+) ([a-z]+?)s?(?:,|$)/); return m && !/^(creature|artifact|permanent|land|enchantment)$/.test(m[2]) ? { n: num(m[1]), what: m[2] } : null; })(),
      sacN: (() => { const m = lc.match(/sacrifice (two|three|four|five|six|seven|eight|nine|ten|\d+) ((?:non[a-z]+ |other )?(?:creature|artifact|permanent|land|enchantment))s(?:,|$)/); return m ? { n: num(m[1]), what: m[2] } : null; })(),
      sacOther: /sacrifice (x|two|three|\d+) /.test(lc),
      sacAnother: /sacrifice another /.test(lc),
      forage: /\bforage\b/.test(lc),
      exileSelf: new RegExp(`(?:^|, |and )exile (?:it|this [a-z]+|${short.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").toLowerCase()})(?:,|$)`).test(lc),
      remove: (() => { const r = lc.match(/remove (a|an|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|\d+) ([a-z+/1-]+) counters? from/); return r ? { n: num(r[1]), key: counterKey(r[2]) } : null; })(),
      removeAny: (() => { const r = lc.match(/remove any number of ([a-z+/1-]+) counters? from/); return r ? { key: counterKey(r[1]), label: r[1] } : null; })(),
      loyalty: loy && loy[2] !== "X" ? (loy[1] === "+" ? 1 : loy[1] ? -1 : 0) * Number(loy[2]) : null,
    };
    if (costs.sacSelf) costs.sacWhat = null;
    // "Add {W} for each enchantment you control" (Serra's Sanctum, Gaea's Cradle, Cabal Coffers) and devotion (Nykthos)
    const mp = text.match(/^add ((?:\{[^}]+\})+) for each ([a-z ,]+?) you control\.?$/i);
    if (mp || /add an amount of mana of that color equal to your devotion to that color/i.test(text)) {
      out.push({ cost, text, label: text.replace(/\.$/, ""), costs, effs: [], auto: false, manaPer: mp ? { syms: mp[1], types: splitTypes(mp[2]), what: mp[2] } : { devotion: true } });
      continue;
    }
    // Vivi Ornitier: "Add X mana in any combination of {U} and/or {R}, where X is <this creature>'s power"
    const pm = text.match(/^add X mana in any combination of ((?:\{[WUBRGC]\}(?:,? (?:and\/or|or|and) )?)+), where X is (?:this creature's|its|[^.]*?'s) power/i);
    if (pm) { out.push({ cost, text, label: text.replace(/\.$/, ""), costs, effs: [], auto: false, powerMana: { cols: (pm[1].match(/[WUBRGC]/g) || []) } }); continue; }
    // Plain mana abilities with no cost worth tracking stay hidden
    if (/^add\b/i.test(text) && !costs.sacSelf && !costs.sacWhat && !costs.life && !costs.remove && !costs.forage) continue;
    const effs = parseEffects(text, card.n);
    const autoText = text.replace(/,? and you may choose new targets for the copy/i, "").replace(/\s*Activate only (?:if|as|during|once)[^.]*\./gi, "");
    const auto = effs.length > 0 && !/\byou may\b/i.test(autoText) && !NEEDS_PLAYER.test(autoText.replace(/(token[^"]*?)with "[^"]*"/gi, "$1").replace(/,? where x is the number of (?:other )?[a-z, ]+? you control/i, "").replace(/ for each (other )?[a-z ,/]+? you control/i, m => effs.some(f => f.per) ? "" : m).replace(/ for each [a-z+/1-]+ counters? on [^.,]*/gi, m => effs.some(f => f.perCtr || f.k === "drawPer") ? "" : m).replace(/search your library[^.]*\./i, ""));
    const residual = text.replace(/search your library[^.]*?(onto the battlefield( tapped)?|into your hand|on top( of your library)?|into your graveyard|card, exile it)/i, "").replace(/\bcreate\b[^.]*?tokens?/gi, "").replace(/^exile [^.]+\. return it to the battlefield under its owner's control at the beginning of the next end step\.?/i, m => effs.some(f => f.k === "exileRet") ? "" : m).replace(/^untap (?:this [a-z]+|[^.]+?)\.?$/i, m => effs.some(f => f.k === "untapSelf") ? "" : m).replace(/shuffle your graveyard and hand into your library, then draw \w+ cards\.?/i, m => effs.some(f => f.k === "wheelGy") ? "" : m).replace(/exile [^,.]+?, then return (?:it|that card) to the battlefield[^.]*\.?/i, m => effs.some(f => f.k === "reenterFace") ? "" : m).replace(/(?:^|\. )transform [^.]+\.?/i, m => effs.some(f => f.k === "transformSelf") ? "" : m).replace(/\bdeals (?:\w+ )?damage to each opponent\b/gi, m => effs.some(f => f.k === "drain" && f.dmg) ? "" : m).replace(/when you next cast an? [a-z ]+? spell this turn, copy it[^.]*\./i, m => effs.some(f => f.k === "copyNext") ? "" : m)
      .replace(/put (?:a|an|one|two|three|\d+) \+1\/\+1 counters? on equipped creature\.?(?: if equipped creature is an? [a-z]+, put [^.]*? instead\.?)?/gi, m => effs.some(f => f.k === "eqCtr") ? "" : m).replace(/put (a|an|one|two|three|four|five|\d+) \S+ counters? on [^.,]*/gi, m => effs.some(f => f.k === "selfc" || f.k === "countersEach") ? "" : m).replace(/\bdraw a card for each [^.]*/gi, m => effs.some(f => f.k === "drawPer") ? "" : m).replace(/\badd (\{[^}]+\})+\.?/gi, m => effs.some(f => f.k === "mana") ? "" : m).replace(/\badd (one|two|three|four|five|x|\d+) mana (of any one color|of any color|in any combination of colors)\.?/gi, m => effs.some(f => f.k === "manaAny") ? "" : m);
    const fx = effs.find(f => f.k === "fetch");
    const label = (loy ? `${cost}: ` : "") + (fx ? `Search for ${fx.desc}${fx.dest === "battlefield" ? (fx.tapped ? " (enters tapped)" : "") : fx.dest === "hand" ? " → hand" : fx.dest === "top" ? " → top of library" : " → graveyard"}`
      : text.replace(/,? then shuffle\.?/i, "").replace(/\.$/, ""));
    out.push({ cost, text, label: label.length > 70 ? label.slice(0, 67) + "…" : label, costs, effs, auto,
      partial: auto && (EXTRA_ACTIONS.test(coverStrip(residual, effs, card.n)) || /\badd\b/i.test(coverStrip(residual, effs, card.n))) });
  }
  actCache.set(card.n, out);
  return out;
}

// One-tap abilities for the common artifact tokens
export const TOKEN_USES = {
  food: { label: "Eat (+3 life)", effs: [{ k: "gain", n: 3 }] },
  treasure: { label: "Sac for mana", note: "Add one mana of any color." },
  clue: { label: "Crack", note: "Draw a card." },
  blood: { label: "Use", note: "Discard a card, then draw a card." },
  mutagen: { label: "Use ({1}: +1/+1 counter)", note: "Sorcery speed only.", effs: [{ k: "countersTarget", n: 1, key: "p1p1", label: "+1/+1", what: "creature", filter: { alts: [["creature"]], controller: "any", mv: null } }] }, // TMNT Mutagen token
};

// "This creature enters with N counters on it" (static). Returns counters to add, or a reminder when it depends on a choice.
export function entersWithCounters(card, p, selfId) {
  for (let line of kwExpand(card?.o).split("\n")) {
    line = line.replace(/\([^)]*\)/g, "").trim();
    const m = line.match(/enters(?: the battlefield)? with (a|an|one|two|three|four|five|six|seven|eight|\d+|x|that many) (additional )?([+−-]?\d+\/[+−-]?\d+|[a-z]+) counters? on it/i);
    if (!m) continue;
    const before = line.slice(0, m.index).toLowerCase();
    if (/\beach other\b|\bother [a-z]+ you control\b/.test(before)) continue; // Giada: it's about the others, not this card
    const per = line.match(/for each (other )?([a-z ,/]+?) you control/i);
    const xIs = line.match(/where x is the number of ([a-z]+?)s? you control/i);
    const conditional = /\b(if|unless|you may|as)\b/.test(before) || /\b(unless|if)\b/.test(line.slice(m.index));
    let n = num(m[1]);
    if (m[1].toLowerCase() === "x" && xIs) n = countTypes(p, splitTypes(xIs[1]), selfId);
    if (n != null && per) n *= countTypes(p, splitTypes(per[2]), per[1] ? selfId : null);
    if (conditional || n == null) return { remind: line };
    return { key: counterKey(m[3]), n, label: m[3] };
  }
  return null;
}

// Mox Diamond-style: "If this would enter, you may discard a land card instead. If you do, put it onto the battlefield. If you don't, put it into its owner's graveyard."
export function entersInstead(card) {
  const short = card.n.split("#")[0].split(" // ")[0].split(",")[0].replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const m = (card.o || "").match(new RegExp(`if (?:this \\w+|${short}) would enter(?: the battlefield)?, you may ([^.]+?) instead\\.`, "i"));
  return m ? m[1] : null;
}
// "Activate only if you control three or more artifacts" / "a Dragon"
export function activationCondition(card) {
  const m = (card.o || "").match(/activate only if you control (a|an|one|two|three|four|five|\d+)(?: or more)? ([a-z]+?)s?\b/i);
  return m ? { n: num(m[1]), type: m[2].toLowerCase() } : null;
}
// "Suspend 3—{0}"
export function suspendOf(card) {
  const m = (card.o || "").match(/^Suspend (\d+)\s*[—-]\s*((?:\{[^}]+\})*)/m);
  return m ? { time: Number(m[1]), cost: m[2] || "{0}" } : null;
}

// ----- Alternate win conditions ("you win the game") -----
const BIG = { ten: 10, twenty: 20, thirty: 30, forty: 40, fifty: 50, hundred: 100, "one hundred": 100, "two hundred": 200, eight: 8, seven: 7, six: 6, nine: 9 };
const bigNum = w => num(w) ?? BIG[String(w).toLowerCase()] ?? null;
const BASIC_TYPES = ["Plains", "Island", "Swamp", "Mountain", "Forest"];
const COLOR_WORDS = { W: "white", U: "blue", B: "black", R: "red", G: "green" };
function parseWinCond(text, cardName) {
  const t = text.toLowerCase();
  if (/a land of each basic land type and a creature of each color/.test(t)) return { coalition: true };
  if (/you've cast another spell named/.test(t)) return { castBefore: true, otherwise: (text.match(/otherwise, ([^\n]+)/i) || [])[1] || "" };
  let m = t.match(/you have (\w+(?: hundred)?) or more life/);
  if (m) return { life: bigNum(m[1]) };
  m = t.match(/there are (\w+(?: hundred)?) or more ([a-z+/1-]+) counters on (?:it|this|[^,.]+)/) || t.match(/has (\w+(?: hundred)?) or more ([a-z+/1-]+) counters on it/);
  if (m) return { counters: { n: bigNum(m[1]), key: counterKey(m[2]), label: m[2] } };
  m = t.match(/you control (\w+) or more artifacts with the same name/);
  if (m) return { sameName: bigNum(m[1]) };
  m = t.match(/you control (\w+(?: hundred)?) or more ([a-z]+?)s?(?: named ([^,.]+))?(?:,|\.|$| and)/);
  if (m) return { control: { n: bigNum(m[1]), type: m[2], named: m[3] || null } };
  return { unknown: text };
}
// Which win clause a card has, and when it gets checked
export function winRule(card) {
  const o = (card?.o || "").replace(/\([^)]*\)/g, "");
  if (!/you win the game/i.test(o)) return null;
  const line = o.split("\n").find(l => /you win the game/i.test(l)) || "";
  if (/^at the beginning of your upkeep/i.test(line)) return { when: "upkeep", cond: parseWinCond(line, card.n), text: line };
  if (/^at the beginning of (?:the|your|each) end step/i.test(line)) return { when: "end", cond: parseWinCond(line, card.n), text: line };
  if (/^when(?:ever)? there are/i.test(line) || /^(as long as|if) there are/i.test(line) || /^when(?:ever)? (?:this \w+|[^,]+?) has \w+ or more [a-z]+ counters on it/i.test(line)) return { when: "state", cond: parseWinCond(line, card.n), text: line };
  if (/\b(Instant|Sorcery)\b/.test(card.t || "") || /^you win the game if/i.test(line)) return { when: "cast", cond: parseWinCond(line, card.n), text: line };
  return { when: "manual", cond: { unknown: line }, text: line };
}
// Evaluate a win condition for this player. met: true/false, or null when the app can't tell
export function evalWin(rule, p, srcId) {
  const c = rule.cond;
  if (c.life != null) { const v = p.life ?? 40; return { met: v >= c.life, progress: `${v}/${c.life} life` }; }
  if (c.counters) { const v = p.bf?.[srcId]?.c?.[c.counters.key] || 0; return { met: v >= c.counters.n, progress: `${v}/${c.counters.n} ${c.counters.label}` }; }
  if (c.control) {
    let v;
    if (c.control.named) v = Object.values(p.bf || {}).filter(e => e.n.toLowerCase() === c.control.named.toLowerCase()).length;
    else v = countTypes(p, [c.control.type]);
    return { met: v >= c.control.n, progress: `${v}/${c.control.n} ${c.control.named ? c.control.named : c.control.type + "s"}` };
  }
  if (c.sameName) {
    const counts = {};
    Object.values(p.bf || {}).filter(e => /\bArtifact\b/.test(e.t || "")).forEach(e => { counts[e.n] = (counts[e.n] || 0) + 1; });
    Object.values(p.tokens || {}).filter(t => !isCreatureToken(t.name)).forEach(t => { counts[t.name] = (counts[t.name] || 0) + t.count; });
    const best = Math.max(0, ...Object.values(counts));
    return { met: best >= c.sameName, progress: `${best}/${c.sameName} same-name artifacts` };
  }
  if (c.coalition) {
    const lands = Object.values(p.bf || {}).filter(e => /\bLand\b/.test(e.t || ""));
    const haveTypes = BASIC_TYPES.filter(b => lands.some(e => new RegExp(`\\b${b}\\b`).test(e.t)));
    const colors = new Set();
    Object.values(p.bf || {}).filter(e => /\bCreature\b/.test(e.t || "")).forEach(e => (String(e.m || "").match(/[WUBRG]/g) || []).forEach(x => colors.add(x)));
    Object.values(p.tokens || {}).filter(t => isCreatureToken(t.name)).forEach(t => Object.entries(COLOR_WORDS).forEach(([L, w]) => { if (new RegExp(`\\b${w}\\b`, "i").test(t.desc || "")) colors.add(L); }));
    const missingTypes = BASIC_TYPES.filter(b => !haveTypes.includes(b));
    const missingColors = Object.keys(COLOR_WORDS).filter(L => !colors.has(L)).map(L => COLOR_WORDS[L]);
    return { met: !missingTypes.length && !missingColors.length, progress: `${haveTypes.length}/5 land types · ${colors.size}/5 colors`,
      missing: [missingTypes.length ? `lands: ${missingTypes.join(", ")}` : "", missingColors.length ? `creature colors: ${missingColors.join(", ")}` : ""].filter(Boolean).join(" · ") };
  }
  return { met: null, progress: "" };
}

// ----- Overload (Cyclonic Rift): the cost, and the removal with "target" changed to "each" -----
export function overloadOf(card) {
  const m = (card?.o || "").match(/^Overload ((?:\{[^}]+\})+)/m);
  if (!m) return null;
  const rules = (card.o || "").split("\n").filter(l => !/^Overload /.test(l)).join("\n");
  const over = parseRemoval(rules.replace(/\btarget\b/gi, "each"));
  return over ? { cost: m[1], over } : null;
}
// "As an additional cost to cast this spell, sacrifice a land." (Crop Rotation, Natural Order, Deadly Dispute)
export function addlSacOf(card) {
  const m = (card?.o || "").match(/as an additional cost to cast this spell, sacrifice (a|an|one|two|three) ([^.]+?)(?: or pay [^.]+)?\./i);
  if (!m) return null;
  const what = m[2].trim();
  return { n: num(m[1]) || 1, what, filter: parseTargetFilter(what) };
}
// "you may draw two cards" / "draw a card" reminders → how many cards
export function drawCount(text) {
  const m = String(text || "").trim().match(/^(?:you may )?draw (a|one|two|three|four|five|\d+) cards?\.?$/i);
  return m ? (/^\d+$/.test(m[1]) ? Number(m[1]) : num(m[1]) || 1) : 0;
}

// ----- Table rules: cost changes and casting restrictions from permanents (Grand Arbiter, Thalia, Rule of Law, Lavinia…) -----
// who: "opp" (the permanent's controller's opponents), "you" (its controller), "all"
const whoOf = t => /\b(your opponents|each opponent|opponents)\b/i.test(t) ? "opp" : /\byou cast\b|\byou can't\b/i.test(t) ? "you" : "all";
const spellFilter = pre => parseTargetFilter((pre || "").replace(/^(each|a|an)\s+/i, "").trim() || "permanent");
const staticCache = new Map();
export function staticRules(o) {
  if (!o) return [];
  if (staticCache.has(o)) return staticCache.get(o);
  const out = [];
  o.replace(/\([^)]*\)/g, "").split(/\n|(?<=\.)\s+/).map(x => x.trim().replace(/^(?:static ability|[A-Z][a-z]+(?: [A-Z]?[a-z]+)?) — (?=[A-Z])/i, "")).filter(Boolean).forEach(line => {
    let m;
    if (/^(when|whenever|at the beginning|\{|[+−-]\d|\w+ — )/i.test(line)) return; // triggered/activated abilities aren't static rules
    if ((m = line.match(/^(.*?)\bspells?\b(.*?)\bcosts? \{(\d+)\} (more|less) to cast for each creature you control with a \+1\/\+1 counter on it\.?$/i)) && !/that targets?|this spell/i.test(line)) {
      out.push({ kind: "cost", who: whoOf(m[2] + " " + m[1]), filter: spellFilter(m[1]), n: Number(m[3]), less: m[4].toLowerCase() === "less", per: "p1p1creature", when: null, text: line });
    } else if ((m = line.match(/^(.*?)\bspells?\b(.*?)\bcosts? \{(\d+)\} (more|less) to cast for each ([a-z]+?)s? you control\.?$/i)) && !/that targets?|this spell/i.test(line)) {
      out.push({ kind: "cost", who: whoOf(m[2] + " " + m[1]), filter: spellFilter(m[1]), n: Number(m[3]), less: m[4].toLowerCase() === "less", per: m[5].toLowerCase(), when: null, text: line });
    } else if ((m = line.match(/^(.*?)\bspells?\b(.*?)\bcosts? \{(\d+)\} (more|less) to cast\b(.*)$/i)) && !/that targets?|for each|this spell/i.test(line)) {
      out.push({ kind: "cost", who: whoOf(m[2] + " " + m[1]), filter: spellFilter(m[1]), n: Number(m[3]), less: m[4].toLowerCase() === "less",
        when: /except during its controller's turn/i.test(m[5]) ? "notCasterTurn" : /during your turn/i.test(m[5] + m[2]) ? "ownerTurn" : null, text: line });
    } else if ((m = line.match(/^(each player|each opponent|your opponents|players)(?: who has cast an? (\w+) spell this turn)? can't cast (?:more than one (\w+ )?spell each turn|additional (\w+) spells)/i))) {
      out.push({ kind: "limit", who: whoOf(m[1]), filter: spellFilter(m[2] || m[3] || m[4] || ""), text: line });
    } else if ((m = line.match(/^each opponent can't cast (\w+ )?spells with mana value greater than the number of lands that player controls/i))) {
      out.push({ kind: "mv", who: "opp", filter: spellFilter(m[1]), max: "lands", text: line });
    } else if ((m = line.match(/^(.*?)spells with mana value (\d+) or (greater|less) can't be cast/i))) {
      out.push({ kind: "mv", who: "all", filter: spellFilter(m[1]), [m[3].toLowerCase() === "greater" ? "atLeast" : "atMost"]: Number(m[2]), text: line });
    } else if ((m = line.match(/^(.*?)spells with \{X\} in their mana costs can't be cast/i))) {
      out.push({ kind: "noX", who: "all", filter: spellFilter(m[1]), text: line });
    } else if ((m = line.match(/^(.*?)(?:your opponents|each opponent|players?) can't cast (\w+ )?spells with (even|odd) mana values/i))) {
      out.push({ kind: "parity", who: whoOf(line), filter: spellFilter(m[2]), even: m[3].toLowerCase() === "even", text: line });
    } else if (/(your opponents|each opponent) can't cast spells during your turn|during your turn, your opponents can't cast spells/i.test(line)) {
      out.push({ kind: "yourTurn", who: "opp", filter: spellFilter(""), text: line });
    } else if ((m = line.match(/^(each opponent|each player|your opponents|players) can't draw more than (one|two|\d+) cards? each turn/i))) {
      out.push({ kind: "drawLimit", who: whoOf(m[1]), max: num(m[2]) || 1, filter: spellFilter(""), text: line });
    } else if (/\bwould draw (a|one or more) cards?\b/i.test(line) && /\b(opponent|player)\b/i.test(line)) {
      out.push({ kind: "drawNote", who: /opponent/i.test(line) ? "opp" : "all", filter: spellFilter(""), text: line });
    } else if ((m = line.match(/each spell that would cost less than (\w+) mana to cast costs \1 mana to cast/i))) {
      out.push({ kind: "floor", who: "all", n: num(m[1]) || Number(m[1]) || 3, whileUntapped: /^as long as [^,]+ is untapped/i.test(line), filter: spellFilter(""), text: line });
    } else if (/can't cast spells from anywhere other than their hands?/i.test(line)) {
      out.push({ kind: "zoneBan", who: whoOf(line), zones: ["cz", "gy", "exile", "lib"], filter: spellFilter(""), text: line });
    } else if ((m = line.match(/^(players|your opponents|each opponent) can't cast spells from ((?:graveyards|libraries|exile)(?:,? (?:or )?(?:graveyards|libraries|exile))*)/i))) {
      out.push({ kind: "zoneBan", who: whoOf(m[1]), zones: [/graveyards/i.test(m[2]) && "gy", /libraries/i.test(m[2]) && "lib", /exile/i.test(m[2]) && "exile"].filter(Boolean), filter: spellFilter(""), text: line });
    } else if (/^players can cast spells only during their own turns/i.test(line)) {
      out.push({ kind: "ownTurn", who: "all", filter: spellFilter(""), text: line });
    } else if (/can cast spells only any time they could cast a sorcery/i.test(line)) {
      out.push({ kind: "sorcery", who: whoOf(line), filter: spellFilter(""), text: line });
    } else if (/can't cast|can't be cast/i.test(line) && !/this spell/i.test(line)) {
      out.push({ kind: "note", who: whoOf(line), filter: spellFilter(""), text: line });
    }
  });
  staticCache.set(o, out);
  return out;
}
export const spellMatches = (rule, card) => permanentMatches({ t: card.t || "", m: card.m || "" }, rule.filter);
// Apply generic cost changes to a mana cost: more first, then less (which can't reduce colored mana)
export function adjustCost(m, more, less) {
  if (!m || (!more && !less)) return m || "";
  const syms = (String(m).split(" // ")[0].match(/\{[^}]+\}/g) || []);
  const gen = syms.filter(x => /^\{\d+\}$/.test(x)).reduce((a, x) => a + Number(x.slice(1, -1)), 0);
  const rest = syms.filter(x => !/^\{\d+\}$/.test(x));
  const n = Math.max(0, gen + more - less);
  const xs = rest.filter(x => /^\{[XYZ]\}$/.test(x)), others = rest.filter(x => !/^\{[XYZ]\}$/.test(x));
  return [...xs, ...(n ? [`{${n}}`] : []), ...others].join("") || "{0}";
}

// "You control enchanted creature." (Control Magic, Mind Control) → the aura's target is stolen
export function auraStealOf(card) {
  const m = (card?.o || "").match(/^you control enchanted (creature|permanent|artifact|land|planeswalker|enchantment)\.?$/im);
  return m && /\bAura\b/.test(card.t || "") ? { k: "remove", how: "steal", n: 1, what: m[1], filter: { ...parseTargetFilter(m[1]), controller: "opp" }, until: null, rider: "" } : null;
}
// Gonti, Thief of Sanity, Praetor's Grasp, Bribery: you get a card from an opponent's library
export function stealCardOf(text) {
  const o = String(text || "");
  if (!/(target opponent's|that player's|target player's|an opponent's|each opponent's|defending player's) library/i.test(o)) return null;
  if (/onto the battlefield under your control/i.test(o)) return { k: "stealEx", dest: "battlefield" };
  if (/you may (?:cast|play|look at and play|look at and cast) (?:it|that card|those cards|them|one of them)\b/i.test(o) && /\bexile\b/i.test(o)) {
    const top = o.match(/look at the top (two|three|four|five|\d+) cards/i);
    return { k: "stealEx", dest: "exile", ...(top && /put the rest into (?:their|that player's) graveyard/i.test(o) ? { restGy: (num(top[1]) || 1) - 1 } : {}) };
  }
  return null;
}

// Devotion: mana symbols of each color among the mana costs of permanents you control (hybrid counts for both colors)
export function devotion(p) {
  const out = { W: 0, U: 0, B: 0, R: 0, G: 0 };
  Object.values(p.bf || {}).forEach(e => (String(e.m || "").match(/\{[^}]+\}/g) || []).forEach(sym => {
    Object.keys(out).forEach(c => { if (sym.includes(c)) out[c] += 1; });
  }));
  return out;
}

// ----- Static buffs: anthems and keyword grants ("Creatures you control get +1/+1", "All creatures have haste", "Other Spiders you control have riot") -----
const KEYWORDS = ["flying", "first strike", "double strike", "deathtouch", "haste", "hexproof from (?:[a-z]+)", "hexproof", "indestructible", "lifelink", "menace", "reach", "trample", "vigilance", "defender", "shroud", "flash", "riot", "ward", "prowess", "protection from (?:all colors|everything|the color of your choice|[a-z]+)", "[a-z]+walk", "shadow", "fear", "intimidate", "infect", "wither", "skulk", "horsemanship", "banding", "firebending"];
const KW_RE = new RegExp(`^(?:${KEYWORDS.join("|")})(?: \\{[^}]+\\}| \\d+)?$`, "i");
const buffCache = new Map();
export function staticBuffs(card) {
  const o = card?.o || "";
  if (!o) return [];
  const key = card.n + "|" + o;
  if (buffCache.has(key)) return buffCache.get(key);
  const out = [], ytLines = new Set(); let ytFlag = false;
  o.replace(/\([^)]*\)/g, "").split("\n").forEach(raw => {
    if (/^\s*(?:[+−-]\d+|0|\[[+−-]?\d+\]):/.test(raw)) return; // planeswalker loyalty abilities aren't static buffs
    let line = raw.trim().replace(/\.$/, "").replace(/^(?:threshold|delirium|metalcraft|coven) — /i, "").replace(/^[A-Z][A-Za-z' ,.!-]{0,40}? — (?=[A-Z])/, "").replace(/^during your turn, (\w)/i, (m, c) => { ytFlag = true; return c.toUpperCase(); })
      .replace(/^each (other )?creature you control that's an? ([a-z ,]+?),? or ([a-z]+) gets (.+?) and has /i, (m, oth, list, last, pt) => `${oth ? "Other " : ""}${list}, and ${last} creatures you control get ${pt} and have `)
      .replace(/^each (other )?creature you control that's an? ([a-z ,]+?),? or ([a-z]+) gets /i, (m, oth, list, last) => `${oth ? "Other " : ""}${list}, and ${last} creatures you control get `);
    if (ytFlag) { ytLines.add(line); ytFlag = false; }
    // Nut Collector: "… as long as seven or more cards are in your graveyard"
    const gyc = line.match(/ as long as (\w+) or more cards are in your graveyard$/i);
    if (gyc) line = line.replace(gyc[0], "");
    const dlr = line.match(/ as long as there are (\w+) or more card types among cards in your graveyard$/i);
    if (dlr) line = line.replace(dlr[0], "");
    // Beastmaster Ascension: "As long as this has seven or more quest counters on it, creatures you control get +5/+5"
    const cnd = line.match(/^as long as [^,]+? has (\w+) or more ([a-z+/1-]+) counters on it, (.+)$/i);
    if (cnd) line = cnd[3];
    // Chitterspitter: "Squirrels you control get +1/+1 for each acorn counter on this artifact"
    const pctr = line.match(/ for each ([a-z+/1-]+) counters? on (?:this [a-z]+|it|[^,.]+)$/i);
    if (pctr) line = line.replace(pctr[0], "");
    const chosenColor = / of the chosen color\b/i.test(line);
    if (chosenColor) line = line.replace(/ of the chosen color\b/i, "");
    const m = line.match(/^(all |other )?(.+?)( you control| your opponents control)? (get|gets|have|has|gain|gains) (.+)$/i);
    if (!m || /^(when|whenever|at |as |if |enchanted|equipped|this|it )/i.test(line) || /until end of turn/i.test(line)) return;
    let subj = m[2].toLowerCase().trim();
    if (/\b(spells?|cards?|players?|lands? you|abilities|opponents?)\b/.test(subj) && !/creature/.test(subj)) return;
    if (/^(each|target|up to|that|those|another)\b/.test(subj)) return;
    if (!/(creature|token|s)$/.test(subj)) return; // a plural subject: "creatures", "Elf creatures", "Spiders", "creature tokens"
    let dp = 0, dt = 0, kws = [];
    const rest = m[5].trim();
    const pt = rest.match(/^([+−-]\d+)\/([+−-]\d+)(?: and (?:have|gain) (.+))?$/);
    if (/^(get|gets)$/i.test(m[4])) { if (!pt) return; dp = Number(pt[1].replace("−", "-")); dt = Number(pt[2].replace("−", "-")); if (pt[3]) kws = pt[3].split(/,\s*(?:and\s+)?|\s+and\s+/); }
    else { if (/base power|all abilities|until end of turn/i.test(rest)) return; kws = rest.split(/,\s*(?:and\s+)?|\s+and\s+/); }
    kws = splitKws(kws.join(", "));
    if (!dp && !dt && !kws.length) return;
    const types = subj.replace(/\btokens?\b/, "").trim() || "creature";
    out.push({ filter: parseTargetFilter(types), tokenOnly: /\btokens?\b/.test(subj), scope: m[3] ? (/opponents/i.test(m[3]) ? "opp" : "you") : "all", other: !!m[1] && /other/i.test(m[1]), dp, dt, kws, text: raw.trim().replace(/\.$/, ""),
      ...(cnd ? { cond: { n: bigNum(cnd[1]), key: counterKey(cnd[2]), label: cnd[2] } } : {}), ...(chosenColor ? { chosenColor: true } : {}), ...(pctr ? { perCtr: counterKey(pctr[1]) } : {}), ...(gyc ? { condGy: bigNum(gyc[1]) } : {}), ...(dlr ? { condTypes: bigNum(dlr[1]) } : {}) });
  });
  out.forEach(b => { if (/^(?:[^—]{1,40} — )?during your turn, /i.test(String(b.text || "")) || [...ytLines].some(l => String(b.text || "").startsWith(l.slice(0, 25)))) b.yourTurn = true; });
  buffCache.set(key, out);
  return out;
}
// Squirrel Mob: "This creature gets +1/+1 for each other Squirrel on the battlefield"
export function selfBuff(card) {
  const short = String(card?.n || "").split(" // ")[0].split(",")[0].replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const m = String(card?.o || "").match(new RegExp(`^(?:this creature|${short}) gets \\+(\\d+)\\/\\+(\\d+) for each (other )?([a-z ]+?)( you control| on the battlefield)\\.?$`, "im"));
  if (m) return { dp: Number(m[1]), dt: Number(m[2]), other: !!m[3], types: splitTypes(m[4]), all: /battlefield/i.test(m[5]) };
  const g = String(card?.o || "").match(new RegExp(`^(?:this creature|${short}) gets \\+(\\d+)\\/\\+(\\d+) for each ([a-z ]*?)\\s?cards? in your graveyard\\.?$`, "im"));
  return g ? { dp: Number(g[1]), dt: Number(g[2]), gy: true, types: g[3] ? splitTypes(g[3]) : [] } : null;
}
// Cryptolith Rite / Jaheira: "Creatures you control have "{T}: Add …"", "Tokens you control have "{T}: Add {G}.""
export function grantedMana(card) {
  const out = [];
  String(card?.o || "").split("\n").forEach(l => {
    const m = l.trim().match(/^(tokens|creatures|creature tokens|[a-z]+s) you control (?:have|gain) "(\{T\}: add [^"]+?)\.?"\.?$/i);
    if (m) out.push({ who: m[1].toLowerCase(), text: m[2] });
    // A Realm Reborn: "Other permanents you control have "{T}: Add one mana of any color.""
    const mp = !m && l.trim().match(/^(other )?permanents you control (?:have|gain) "(\{T\}: add [^"]+?)\.?"\.?$/i);
    if (mp) out.push({ who: "permanents", other: !!mp[1], text: mp[2] });
    const m2 = !m && l.trim().match(/^each (creature|[a-z]+(?: and [a-z]+)?) you control( with a counter on it)? has "(\{T\}: add [^"]+?)\.?"\.?$/i);
    if (m2) out.push({ who: m2[2] ? "countered" : m2[1].toLowerCase(), text: m2[3] });
  });
  return out;
}
// "Whenever this creature deals combat damage to a player, …"
export function bigHitTriggers(card) {
  const short = String(card?.n || "").split(" // ")[0].split(",")[0].toLowerCase();
  return String(card?.o || "").split("\n").map(l => l.trim().match(/^whenever ([^,]+?) deals (\d+) or more (?:combat )?damage(?: to a player)?, (.+)$/i)).filter(m => m && (/^this creature$/i.test(m[1]) || m[1].toLowerCase().startsWith(short))).map(m => ({ min: Number(m[2]), text: m[3] }));
}
// Crew N (Vehicles)
export function crewOf(card) { const m = String(card?.o || "").match(/^Crew (\d+)/m); return m ? Number(m[1]) : 0; }
export function hitTriggers(card) {
  const short = String(card?.n || "").split(" // ")[0].split(",")[0].toLowerCase();
  // ability words ("Throw — Whenever …") and Vehicles/artifact creatures ("Whenever this Vehicle deals combat damage …") count too
  // the card may call itself by its first name ("Legolas" on Legolas Greenleaf), and "a player or planeswalker / battle" and "an opponent" hit too
  return String(kwExpand(card?.o || "")).split("\n").map(l => l.trim().replace(/^[^—:{}]{1,60} — /, "").match(/^(?:whenever|when) ([^,]+?) deals combat damage to (?:a player|an opponent)(?: or (?:a )?(?:planeswalker|battle))?, (.+)$/i)).filter(m => { if (!m) return false; const who = m[1].toLowerCase(); return /^this (?:creature|vehicle|artifact|land|enchantment|permanent)(?: or equipped creature)?$/.test(who) || who.startsWith(short) || (who.length >= 3 && short.startsWith(who)); }).map(m => m[2]);
}
// Firebending N (own keyword)
export function firebendingOf(card) { return (String(card?.o || "").match(/^Firebending (\d+)/m) || [])[1] ? Number(String(card.o).match(/^Firebending (\d+)/m)[1]) : 0; }
// Foretell cost
export function foretellOf(card) { const m = String(card?.o || "").match(/^Foretell ((?:\{[^}]+\})+)/m); return m ? m[1] : null; }
// Vanishing N
export function vanishingOf(card) { const m = String(card?.o || "").match(/^Vanishing (\d+)/m); return m ? Number(m[1]) : 0; }
// Storm
export const hasStorm = card => /^Storm(?: \(|$)/m.test(String(card?.o || ""));
// Myriad (Scurry of Squirrels has it twice)
export function myriadCount(card) {
  const line = String(card?.o || "").replace(/\([^)]*\)/g, "").split("\n").find(l => /^\s*myriad\b/i.test(l)) || "";
  return line.split(",").filter(x => /^\s*myriad\s*$/i.test(x)).length;
}

// ----- Sagas: "I, II — …", "III — …" -----
const ROMAN = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6 };
export function sagaChapters(card) {
  if (!/\bSaga\b/.test(card?.t || "")) return null;
  const out = [];
  String(card.o || "").split("\n").forEach(l => {
    const m = l.trim().match(/^((?:I|II|III|IV|V|VI)(?:,\s*(?:I|II|III|IV|V|VI))*)\s+—\s+(.+)$/);
    if (m) out.push({ nums: m[1].split(/,\s*/).map(r => ROMAN[r]), text: m[2] });
  });
  return out.length ? { chapters: out, last: Math.max(...out.flatMap(c => c.nums)) } : null;
}

// ----- Auras and Equipment -----
// "Enchant land" / "Enchant creature you control" → what it can be attached to
export function enchantType(card) {
  if (card?.bestowT) return "creature"; // a bestowed creature is an Aura with enchant creature
  if (!/\bAura\b/.test(card?.t || "")) return null;
  const m = (card.o || "").match(/^Enchant ([a-z ]+?)$/im);
  return m ? m[1].trim().toLowerCase() : null;
}
// What it gives the creature it's on: "Equipped creature gets +1/+1 for each …", "Enchanted creature gets +2/+2 and has flying"
export function attachBuff(card) {
  const out = { dp: 0, dt: 0, kws: [], per: null, text: [] };
  String(card?.o || "").replace(/\([^)]*\)/g, "").split("\n").forEach(raw => {
    const line = raw.trim().replace(/\.$/, "");
    const m = line.match(/^(?:equipped|enchanted) creature (gets|has|gains) (.+)$/i);
    if (!m) return;
    const rest = m[2];
    const pt = rest.match(/^([+−-]\d+)\/([+−-]\d+)(?: for each (.+?))?(?: and (?:has|gains) (.+))?$/i);
    if (/^gets$/i.test(m[1]) && pt) {
      out.dp += Number(pt[1].replace("−", "-")); out.dt += Number(pt[2].replace("−", "-"));
      const pc = pt[3] && pt[3].match(/^([a-z+/1-]+) counters? on (?:this|it|[A-Z].*)$/i);
      if (pc) out.per = { ctr: counterKey(pc[1]), label: pt[3] };
      else if (pt[3] && /with the same name as the exiled card/i.test(pt[3])) out.per = { sameName: true, label: pt[3] };
      else if (pt[3] && /^card in your hand$/i.test(pt[3].trim())) out.per = { hand: true, label: pt[3] };
      else if (pt[3]) out.per = /base power or toughness 1/i.test(pt[3]) ? { base1: true, label: pt[3] } : { types: splitTypes(pt[3].replace(/ you control$/i, "")), label: pt[3] };
      if (pt[4]) out.kws.push(...splitKws(pt[4]));
    } else if (!/^gets$/i.test(m[1])) out.kws.push(...splitKws(rest));
    out.text.push(line);
  });
  return out.text.length ? out : null;
}
// Abilities lands get: Bootlegger's Stash ("Lands you control have …"), Squirrel Nest ("Enchanted land has …")
export function grantedLand(card) {
  const out = [];
  String(card?.o || "").split("\n").forEach(raw => {
    const m = raw.trim().match(/^(lands you control|enchanted land) (?:has|have) "(.+)"\.?$/i);
    if (m) out.push({ scope: /enchanted/i.test(m[1]) ? "enchanted" : "lands", text: m[2] });
  });
  return out;
}
// Equip cost ("Equip {2}")
export function equipCost(card) {
  const m = (card?.o || "").match(/^Equip ((?:\{[^}]+\})+)/m) || (card?.o || "").match(/^Reconfigure ((?:\{[^}]+\})+)/m);
  return m && /\bEquipment\b/.test(card.t || card.rcT || "") ? m[1] : null;
}

// "flying, first strike, and protection from black and from red" → each keyword on its own
export function splitKws(text) {
  const t = String(text).toLowerCase().replace(/protection from (?!all colors|everything|the color)([a-z]+)((?:,? (?:and )?from [a-z]+)+)/g, (m, a, rest) => [a, ...rest.match(/from ([a-z]+)/g).map(x => x.slice(5))].map(c => `protection from ${c}`).join(", "));
  return t.split(/,\s*(?:and\s+)?|\s+and\s+/).map(k => k.trim()).filter(k => KW_RE.test(k));
}
// A card's own keywords ("Flying, trample", "Riot")
export function ownKeywords(card) {
  const out = [];
  String(card?.o || "").replace(/\([^)]*\)/g, "").split("\n").forEach(l => {
    const line = l.trim().replace(/\.$/, "");
    const kws = splitKws(line);
    if (kws.length && line.toLowerCase().replace(/protection from (?:all colors|everything|the color of your choice|[a-z]+)(?:,? (?:and )?from [a-z]+)*/g, "x").split(/,\s*(?:and\s+)?|\s+and\s+/).every(p => p.trim() === "x" || KW_RE.test(p.trim()))) kws.forEach(k => out.push(k));
  });
  return out;
}

// Always-on effects worth showing the whole table ("All creatures have haste", anthems, "Players can't gain life", stax…)
const blanketCache = new Map();
export function blanketLines(card) {
  const o = card?.o || "";
  if (!o) return [];
  const key = card.n + "|" + o;
  if (blanketCache.has(key)) return blanketCache.get(key);
  const short = card.n.split("#")[0].split(" // ")[0].split(",")[0].toLowerCase();
  const out = [];
  o.replace(/\([^)]*\)/g, "").split("\n").forEach(raw => {
    [raw].forEach(part => { // a whole paragraph: a trigger's second sentence stays with its trigger
      const line = part.trim().replace(/^[A-Z][a-z]+(?: [A-Z]?[a-z]+)? — (?=[A-Z])/, "");
      if (!line || /^(when|whenever|at the beginning|as (?!long as)|if you do|then|•|[+−-]?\d+:|[+−-]\d)/i.test(line)) return;
      if (/opening hand/i.test(line)) return;
      if (/^[^"]*?(\{[^}]+\}|sacrifice|pay|discard|exile|remove|tap)[^":]*:/i.test(line)) return; // activated ability
      if (/^(enchant|equip|flash|flying|haste|vigilance|trample|lifelink|deathtouch|reach|menace|hexproof|indestructible|first strike|double strike|defender|ward|shroud|prowess|protection)\b[^.]*$/i.test(line)) return; // its own keywords
      const low = line.toLowerCase();
      if (low.startsWith(short) || /^(this|enchanted|equipped|it|that)\b/.test(low)) return; // about itself / what it's attached to
      if (!/^(all|each|skip|players?|creatures|creature (?:cards|tokens|spells)|other|spells|nonbasic|lands|permanents|artifacts|enchantments|planeswalkers|tokens|noncreature|nontoken|your opponents|opponents|you can't|you have|you may|your|if|damage|as long as|cards in|activated abilities|creatures and|instant and)/.test(low)) return;
      if (/^if (one or more tokens|you would create)/.test(low)) return; // token makers are shown on the board already
      out.push(line);
    });
  });
  blanketCache.set(key, out);
  return out;
}

// ----- Board rules that change how triggers and abilities work (Humility, Torpor Orb, Panharmonicon, Null Rod…) -----
const typeWords = phrase => phrase.toLowerCase().replace(/\s+(?:you control|your opponents control)$/, "")
  .split(/,?\s+(?:and|or)\s+|,\s*/).map(w => singular(w.trim())).filter(Boolean);
const boardCache = new Map();
export function boardRules(o) {
  if (!o) return [];
  if (boardCache.has(o)) return boardCache.get(o);
  const out = [];
  o.replace(/\([^)]*\)/g, "").split(/\n|(?<=\.)\s+/).map(x => x.trim().replace(/^(?:static ability|[A-Z][a-z]+(?: [A-Z]?[a-z]+)?) — (?=[A-Z])/i, "")).filter(Boolean).forEach(line => {
    let m;
    if (/^whenever you discard a card, exile that card from your graveyard/i.test(line)) { out.push({ kind: "discardExile", who: "you", text: line }); return; }
    if (/^(when|whenever|at the beginning|enchant\b|\{)/i.test(line)) return;
    const ent = "enter(?:s|ing)?(?: the battlefield)?";
    if ((m = line.match(/^(all )?(creatures|other creatures)( your opponents control)? lose all abilities(?: and (?:have|are) base power and toughness (\d+)\/(\d+))?/i))) {
      out.push({ kind: "loseAll", who: m[3] ? "opp" : "all", filter: parseTargetFilter("creature"), pt: m[4] ? `${m[4]}/${m[5]}` : null, text: line });
    } else if ((m = line.match(/^nonbasic lands are (\w+)s?\b/i))) {
      out.push({ kind: "loseAll", who: "all", filter: parseTargetFilter("nonbasic land"), text: line });
    } else if ((m = line.match(new RegExp(`^(creatures|permanents) ${ent}( or dying)? don't cause abilities( of permanents your opponents control)? to trigger`, "i")))) {
      out.push({ kind: "hush", who: m[3] ? "opp" : "all", what: singular(m[1].toLowerCase()), dies: !!m[2], text: line });
    } else if ((m = line.match(new RegExp(`^permanents ${ent} cause triggered abilities of permanents you control to trigger an additional time`, "i")))) {
      out.push({ kind: "double", who: "you", on: "enter", types: null, text: line });
    } else if (/^if you casting or copying an instant or sorcery spell causes a triggered ability of a permanent you control to trigger, that ability triggers an additional time/i.test(line)) {
      out.push({ kind: "double", who: "you", on: "castIS", types: null, text: line });
    } else if (/^if a creature attacking causes a triggered ability of a permanent you control to trigger, that ability triggers an additional time/i.test(line)) {
      out.push({ kind: "double", who: "you", on: "attack", types: null, text: line });
    } else if (/^if a triggered ability of equipped creature triggers, that ability triggers an additional time/i.test(line)) {
      out.push({ kind: "double", who: "you", on: "equipped", types: null, text: line });
    } else if ((m = line.match(/^if a triggered ability of an? ([a-z]+) or another ([a-z]+) you control triggers, that ability triggers an additional time/i))) {
      out.push({ kind: "double", who: "you", on: "source", types: [m[1].toLowerCase(), m[2].toLowerCase()], another: true, text: line });
    } else if ((m = line.match(/^if a triggered ability of an? ([a-z]+) you control triggers, that ability triggers an additional time/i))) {
      out.push({ kind: "double", who: "you", on: "source", types: [m[1].toLowerCase()], text: line });
    } else if ((m = line.match(new RegExp(`^if an? ([a-z ,]+?) (?:entering|${ent}|dying) (?:the battlefield )?causes a triggered ability of a permanent you control to trigger, that ability triggers an additional time`, "i")))) {
      const types = typeWords(m[1]);
      out.push({ kind: "double", who: "you", on: /dying/i.test(line) ? "dies" : "enter", types: types.includes("permanent") ? null : types, text: line });
    } else if ((m = line.match(new RegExp(`^((?:other )?(?:nonbasic lands|lands|creatures|artifacts|enchantments|planeswalkers|permanents)(?:,? (?:and|or) (?:nonbasic lands|lands|creatures|artifacts|enchantments|planeswalkers))*)( your opponents control)? ${ent} tapped`, "i")))) {
      out.push({ kind: "tapIn", who: m[2] ? "opp" : "all", filter: parseTargetFilter(m[1].replace(/^other /i, "")), text: line });
    } else if (/^you control your opponents while they're searching their libraries/i.test(line)) {
      out.push({ kind: "agent", who: "opp", text: line });
    } else if (/^if a card would be put into an opponent's graveyard from anywhere, instead exile it with a void counter on it/i.test(line)) {
      out.push({ kind: "rip", who: "opp", void: true, text: line });
    } else if ((m = line.match(/^untap all ([a-z ,]+?) you control during each other player's untap step/i))) {
      out.push({ kind: "untapOthers", who: "you", filter: parseTargetFilter(m[1]), text: line });
    } else if (/^spells(?: and abilities)?(?: you control)? can't be countered/i.test(line) || /^spells and abilities can't be countered/i.test(line)) {
      out.push({ kind: "noCounter", who: /you control/i.test(line) ? "you" : "all", text: line });
    } else if (/^damage can't be prevented/i.test(line)) {
      out.push({ kind: "noPrevent", who: "all", text: line });
    } else if (/^players skip their untap steps/i.test(line)) {
      out.push({ kind: "untapRule", who: "all", skip: true, text: line });
    } else if ((m = line.match(/^(as long as [^,]+ is untapped, )?players can't untap more than (one|two|three|\d+) ([a-z ]+?) during their untap steps/i))) {
      out.push({ kind: "untapRule", who: "all", max: num(m[2]), filter: parseTargetFilter(m[3]), what: m[3], whileUntapped: !!m[1], text: line });
    } else if ((m = line.match(/^(creatures|artifacts|permanents|lands)( your opponents control)? with (power|toughness|mana value) (\d+) or (greater|less) don't untap during (?:their|its) controllers?'? untap steps?/i))) {
      out.push({ kind: "untapRule", who: m[2] ? "opp" : "all", block: parseTargetFilter(m[1]), stat: { k: m[3].toLowerCase(), op: m[5].toLowerCase() === "greater" ? ">=" : "<=", val: Number(m[4]) }, what: `${m[1]} with ${m[3]} ${m[4]} or ${m[5]}`, text: line });
    } else if (/^each land with an activated ability that isn't a mana ability doesn't untap during its controller's untap step/i.test(line)) {
      out.push({ kind: "untapRule", who: "all", block: parseTargetFilter("land"), stat: { k: "nonmanaAbility" }, what: "lands with non-mana abilities", text: line });
    } else if ((m = line.match(/^(nonbasic lands|lands|artifacts|creatures|permanents)( your opponents control)? don't untap during (?:their|its) controllers?'? untap steps?/i))) {
      out.push({ kind: "untapRule", who: m[2] ? "opp" : "all", block: parseTargetFilter(m[1]), what: m[1], text: line });
    } else if (/^skip your draw step/i.test(line)) {
      out.push({ kind: "skipDraw", who: "you", text: line });
    } else if ((m = line.match(/^if an opponent would draw a card except the first one they draw in each of their draw steps, instead (.+?)\.?$/i))) {
      out.push({ kind: "steal", who: "opp", gives: /you draw a card/i.test(m[1]) ? "draw" : /treasure/i.test(m[1]) ? "treasure" : "other", then: m[1], text: line });
    } else if ((m = line.match(/^if a (?:nontoken )?card (?:or token )?would be put into (an opponent's|a|your opponents'?) graveyard from anywhere, exile it instead/i))) {
      out.push({ kind: "rip", who: /opponent/i.test(m[1]) ? "opp" : "all", text: line });
    } else if ((m = line.match(/^activated abilities of ([a-z ,]+?)( your opponents control)? can't be activated/i))) {
      out.push({ kind: "noAct", who: m[2] ? "opp" : "all", filter: parseTargetFilter(m[1]), text: line });
    }
  });
  boardCache.set(o, out);
  return out;
}

// ----- "An opponent chooses" card selection: Intuition, Gifts Ungiven, Fact or Fiction, Steam Augury -----
export function oppPickOf(card) {
  const o = (card?.o || "").replace(/\([^)]*\)/g, "").replace(/\s+/g, " ");
  let m = o.match(/search your library for (up to )?(\w+) cards?( with different names)?(?: and reveal them)?\. (?:target|an) opponent chooses (\w+) of (?:them|those cards)\. put (?:that card|the chosen cards?) into your (hand|graveyard) and the rest into your (hand|graveyard)/i);
  if (m) return { from: "search", n: num(m[2]), upTo: !!m[1], distinct: !!m[3], pick: num(m[4]), chosenTo: m[5].toLowerCase(), restTo: m[6].toLowerCase() };
  m = o.match(/reveal the top (\w+) cards of your library\. an opponent separates (?:those cards|them) into two piles\. put one pile into your hand and the other into your graveyard/i);
  if (m) return { from: "top", n: num(m[1]), piles: "opp" };
  m = o.match(/reveal the top (\w+) cards of your library and separate them into two piles\. an opponent chooses one of those piles\. put that pile into your hand and the other into your graveyard/i);
  if (m) return { from: "top", n: num(m[1]), piles: "you" };
  return null;
}

// ----- Counterspells -----
// "Counter target noncreature spell." / "…unless its controller pays {3}." / "Counter target activated or triggered ability."
export function counterOf(card) {
  const o = card?.o || "";
  const m = o.match(/\bcounter (?:up to one )?target ([^.]*?)(?:,? unless its controller pays ((?:\{[^}]+\})+(?:, where x is [^.]+)?|[^.]+?))?\./i);
  if (!m) return null;
  const what = m[1].trim();
  const spell = /\bspells?\b/i.test(what);
  const ability = /\babilit(y|ies)\b/i.test(what);
  if (!spell && !ability) return null;
  let filter = { alts: [], controller: "any", mv: null };
  if (spell) {
    const sp = what.match(/^(.*?)\bspells?\b(.*)$/i);
    const pre = sp[1].replace(/,?\s*(?:or )?$/, "").trim();
    const mvPart = (sp[2].match(/with (?:mana value|converted mana cost) \d+ or (?:less|greater)/i) || [""])[0];
    filter = parseTargetFilter(`${pre || "permanent"} ${mvPart}`);
    filter.alts = filter.alts.map(a => a.map(w => w === "instant" || w === "sorcery" ? w : w)); // keep words as-is
  }
  const tk = o.match(/\bits controller creates (a|an|one|two|three|four|\d+) ([^.]*?)\btokens?\b/i);
  const tok = tk ? { n: num(tk[1]) || 1, desc: tk[2].trim(), name: capName(tk[2]) || "Token" } : null;
  const drain = /at the beginning of your next main phase, add an amount of \{C\} equal to that spell's mana value/i.test(o);
  return { ...(drain ? { drain: true } : {}), what, spell, ability, filter, unless: m[2] ? m[2].replace(/, where x is .*/i, "") : null, unlessText: m[2] || null, ...(tok ? { tok } : {}) };
}
export const counterMatches = (info, cast) => !!info?.spell && permanentMatches({ t: cast.t || "", m: cast.m || "" }, info.filter);
// What kind of answer a card is at instant speed: "counter", "protect", "remove", or null
export function answerKind(card) {
  const o = card?.o || "", t = card?.t || "";
  if (counterOf(card)?.spell) return "counter";
  const fast = /\bInstant\b/.test(t) || /^Flash\b/m.test(o);
  if (!fast) return null;
  if (/hexproof|indestructible|phases? out|phase out|protection from|\bshroud\b|can't be the targets?/i.test(o)) return "protect";
  if (/\b(destroy|exile|return) (up to \w+ )?(target|all|each)\b|deals? (\d+|x) damage to (any target|target)|sacrifices? (a|an|two)|gets? [-−]\d+\/[-−]\d+/i.test(o)) return "remove";
  return null;
}

// ----- Lose conditions -----
// "At the beginning of your next upkeep, pay {3}{U}{U}. If you don't, you lose the game." (Pacts)
export function pactOf(card) {
  const m = (card?.o || "").match(/at the beginning of your next upkeep, pay ((?:\{[^}]+\})+)\. if you don't, you lose the game/i);
  return m ? m[1] : null;
}
// "Target player loses the game" (Door to Nothingness) / "you lose the game"
export function loseEffect(text) {
  if (/target (player|opponent) loses the game/i.test(text)) return "target";
  if (/\byou lose the game\b/i.test(text) && !/if you don't, you lose the game/i.test(text) && !/can't lose the game/i.test(text) && !/at the beginning of that turn's end step, you lose the game/i.test(text)) return "you";
  return null;
}
// Phage-style: "Whenever this deals combat damage to a player, that player loses the game."
export const damageLoses = card => /deals combat damage to a player, that player loses the game/i.test(card?.o || "");


// ----- Infinite combos: what my board can loop right now -----
// Each result: { key, name, pieces, win, kind, desc }. kind: drainAll (each opponent loses), dmgAll, drainOne, tokens, mana
const NAMED_COMBOS = [
  { all: ["Mikaeus, the Unhallowed", "Triskelion"], win: true, kind: "dmgAll", desc: "Triskelion pings with its counters, dies, and comes back with undying (+1/+1 from Mikaeus) forever: infinite damage." },
  { all: ["Heliod, Sun-Crowned", "Walking Ballista"], win: true, kind: "dmgAll", desc: "Each Ballista ping gains you life (lifelink), which puts a +1/+1 counter back on it: infinite damage and life." },
  { all: ["Niv-Mizzet, Parun", "Curiosity"], win: true, kind: "dmgAll", desc: "Each card drawn pings, each ping draws a card: infinite damage (stop before your library runs out)." },
  { all: ["Niv-Mizzet, Parun", "Ophidian Eye"], win: true, kind: "dmgAll", desc: "Each card drawn pings, each ping draws a card: infinite damage (stop before your library runs out)." },
  { all: ["Niv-Mizzet, Parun", "Tandem Lookout"], win: true, kind: "dmgAll", desc: "Each card drawn pings, each ping draws a card: infinite damage (stop before your library runs out)." },
  { all: ["Basalt Monolith", "Rings of Brighthearth"], win: false, kind: "mana", desc: "Copy Monolith's untap ability with Rings: infinite colorless mana." },
  { all: ["Aggravated Assault", "Sword of Feast and Famine"], needEquipped: "Sword of Feast and Famine", win: false, kind: "manual", desc: "The equipped creature connects, Sword of Feast and Famine untaps all your lands, and Aggravated Assault's {3}{R}{R} untaps your creatures for another combat: infinite combat phases (with five or more lands)." },
  { all: ["Ganax, Astral Hunter", "Draconic Visitor"], win: false, kind: "manual", desc: "Each Dragon entering makes a Treasure, Draconic Visitor turns it into a 5/5 flying Dragon, which triggers Ganax again. It's mandatory and never stops: with Terror of the Peaks (or a way to stop) it wins, otherwise it's a draw." },
  { all: ["Grim Monolith", "Power Artifact"], win: false, kind: "mana", desc: "Grim Monolith untaps for {2} with Power Artifact and taps for {C}{C}{C}: infinite colorless mana." },
  { all: ["Kinnan, Bonder Prodigy", "Basalt Monolith"], win: false, kind: "mana", desc: "Basalt Monolith taps for {C}{C}{C} plus one more from Kinnan, and untaps for {3}: infinite colorless mana." },
  { all: ["Shalai and Hallar", "The Red Terror"], win: true, kind: "manual", desc: "Shalai and Hallar is red: its damage puts a +1/+1 counter on The Red Terror, and that counter makes Shalai and Hallar deal 1 damage again. It never stops: infinite damage to your opponents." },
  { all: ["Shalai and Hallar", "War Elemental"], win: true, kind: "manual", desc: "Damage to an opponent puts that many +1/+1 counters on War Elemental, and those counters make Shalai and Hallar deal that much damage again: infinite damage." },
  { all: ["Heliod, Sun-Crowned", "Spike Feeder"], win: false, kind: "manual", desc: "Remove a counter from Spike Feeder to gain 2 life; Heliod puts a +1/+1 counter back on it: infinite life (and with Shalai and Hallar, infinite damage)." },
  { all: ["Archangel of Thune", "Spike Feeder"], win: false, kind: "manual", desc: "Remove a counter from Spike Feeder to gain 2 life; Archangel of Thune puts a +1/+1 counter on each creature you control: infinite life and counters (and with Shalai and Hallar, infinite damage)." },
  { all: ["Krenko, Mob Boss", "Thornbite Staff", "Goblin Bombardment"], needAttached: ["Thornbite Staff", "Krenko, Mob Boss"], win: true, kind: "manual", desc: "Krenko makes Goblins; sacrificing one to Goblin Bombardment deals 1 damage, and the death untaps Krenko through Thornbite Staff. With 2+ Goblins out it loops forever: infinite Goblins and damage." },
  { all: ["Krenko, Mob Boss", "Thornbite Staff", "Skirk Prospector"], needAttached: ["Thornbite Staff", "Krenko, Mob Boss"], win: false, kind: "manual", desc: "Krenko makes Goblins; sacrificing one to Skirk Prospector adds {R}, and the death untaps Krenko through Thornbite Staff: infinite Goblins, red mana and death triggers." },
  { all: ["Godo, Bandit Warlord", "Helm of the Host"], needAttached: ["Helm of the Host", "Godo, Bandit Warlord"], win: false, kind: "manual", desc: "Each combat Helm of the Host makes a hasty Godo token; its first attack untaps your Samurai and adds another combat, where Helm makes another Godo: infinite combat phases." },
  { all: ["Najeela, the Blade-Blossom", "Derevi, Empyrial Tactician"], win: false, kind: "manual", desc: "With five or more attackers connecting, Derevi untaps five lands for Najeela's {W}{U}{B}{R}{G}: untap everything and take another combat — infinite combats (and Warriors)." },
  { all: ["Deadeye Navigator", "Peregrine Drake"], needPair: true, win: false, kind: "manual", desc: "Paired with Deadeye Navigator, Peregrine Drake blinks for {1}{U} and untaps five lands: infinite mana and enter/leave triggers." },
  { all: ["Basalt Monolith", "Power Artifact"], win: false, kind: "mana", desc: "Monolith untaps for {1} with Power Artifact: infinite colorless mana." },
  ...["Zealous Conscripts", "Pestermite", "Deceiver Exarch", "Village Bell-Ringer", "Restoration Angel", "Felidar Guardian"].map(x => ({ all: ["Kiki-Jiki, Mirror Breaker", x], win: false, kind: "tokens", tokenOf: x, desc: `Kiki-Jiki copies ${x}, the copy untaps Kiki-Jiki: infinite hasty ${x} tokens.` })),
];
export function detectCombos(p, lookup, ctx = {}) {
  const ents = Object.entries(p.bf || {}).map(([id, e]) => ({ id, e, n: e.n, o: String(lookup(e.n)?.o || e.o || ""), t: e.t || lookup(e.n)?.t || "" }));
  const has = n => ents.find(x => x.n === n);
  const pick = re => ents.filter(x => re.test(x.o));
  const out = [];
  // Life loop: Sanguine Bond / Vito + Exquisite Blood
  const g2d = pick(/whenever you gain life, (?:target opponent|each opponent) loses (?:that much|\d+) life/i), l2g = pick(/whenever an opponent loses life, you gain (?:that much|\d+) life/i);
  if (g2d.length && l2g.length) out.push({ key: `life:${g2d[0].n}+${l2g[0].n}`, name: `${g2d[0].n} + ${l2g[0].n}`, pieces: [g2d[0].n, l2g[0].n], win: true, kind: "drainAll", desc: "Each life gain drains, each drain gains life: it never stops. It starts the next time you gain life or an opponent loses life." });
  // Mill loop: Bloodchief Ascension (3+ quest) + Mindcrank
  const bca = ents.filter(x => /whenever a card is put into an opponent's graveyard from anywhere, if this \w+ has (?:three|3) or more quest counters/i.test(x.o) && (x.e.c?.x_quest || x.e.c?.quest || 0) >= 3);
  const mill = pick(/whenever an opponent loses life, that player mills that many cards/i);
  if (bca.length && mill.length) out.push({ key: `mill:${bca[0].n}+${mill[0].n}`, name: `${bca[0].n} + ${mill[0].n}`, pieces: [bca[0].n, mill[0].n], win: true, kind: "drainOne", desc: "A card hits their graveyard: they lose 2, mill 2, lose 4… until they're dead. Starts when an opponent loses life or a card goes to their graveyard." });
  // Sacrifice loops: a free sac outlet + a death trigger that makes a creature token (or Chatterfang turning any token into a Squirrel)
  const sac = pick(/^sacrifice (?:a|another) creature: /im).filter(x => !/^sacrifice (?:a|another) creature: [^\n]*\{T\}/im.test(x.o));
  const dieTok = pick(/whenever (?:another|a) creature you control dies, create /i).filter(x => !/nontoken/i.test(x.o.match(/whenever (?:another|a) [^,]*dies, create [^.]*/i)?.[0] || ""));
  const plus = pick(/if one or more tokens would be created under your control, those tokens plus that many [^.]*creature tokens/i);
  const loopTok = dieTok.filter(x => plus.length || /dies, create [^.]*creature token/i.test(x.o));
  if (sac.length && loopTok.length) {
    const drain = pick(/dies, (?:each opponent|target (?:player|opponent)) loses \d+ life|whenever a token you control leaves the battlefield, each opponent loses \d+ life|whenever another creature dies, each opponent loses \d+ life/i);
    const pieces = [sac[0].n, loopTok[0].n, ...(plus.length && !/dies, create [^.]*creature token/i.test(loopTok[0].o) ? [plus[0].n] : []), ...(drain.length ? [drain[0].n] : [])];
    const mana = sac.find(x => /^sacrifice a creature: add /im.test(x.o));
    out.push({ key: `sac:${pieces.join("+")}`, name: pieces.join(" + "), pieces, win: !!drain.length, kind: drain.length ? "drainAll" : "tokens",
      desc: `Sacrifice a creature to ${sac[0].n}; ${loopTok[0].n} makes a new token${plus.length ? ` (plus a Squirrel from ${plus[0].n})` : ""} to sacrifice next: infinite death triggers${mana ? ", infinite colorless mana" : ""}${drain.length ? `, and ${drain[0].n} drains every opponent out` : ""}.` });
  }
  { const fc = has("Food Chain"), rec = ["Misthollow Griffin", "Eternal Scourge"].find(n => has(n) || Object.values(p.ex || {}).some(x => x.n === n));
    if (fc && rec) out.push({ key: `named:Food Chain+${rec}`, name: `Food Chain + ${rec}`, pieces: ["Food Chain", rec], win: false, kind: "tokens", desc: `Exile ${rec} to Food Chain for mana, cast it again from exile with that mana, and net one extra mana each loop: infinite mana for creature spells.` }); }
  // Squirrel Girl-style engine: "Create X tokens, where X is the number of <type> you control" + every creature taps for mana + haste
  { const grow = ents.map(x => ({ x, m: x.o.match(/^(?:[^\n{]*? — )?\{([^\n:]+?)\}: create x 1\/1 [a-z ]*?([A-Z][a-z]+) creature tokens, where x is the number of \2s you control/im) })).find(y => y.m);
    const tapAll = pick(/^(?:creatures|tokens|creature tokens|(?:other )?permanents) you control have "\{T\}: Add/im)[0] || ents.find(x => /^Song of Freyalise$/.test(x.n) && (x.e.c?.lore || 1) < 3);
    const hasteSrc = pick(/^(?:all creatures|creatures you control) have haste|^you may activate abilities of creatures you control as though those creatures had haste/im)[0];
    // no haste needed when the new tokens are sacrificed (Phyrexian Altar) or tapped by another permanent's cost (Supportive Parents)
    const sacMana = pick(/^sacrifice a creature: add one mana of any color/im)[0], tapTwo = pick(/^tap two untapped creatures you control: add one mana/im)[0];
    const manaAll = tapAll && hasteSrc ? tapAll : sacMana || tapTwo;
    const haste = tapAll && hasteSrc ? hasteSrc : manaAll;
    if (grow && manaAll && haste) {
      const typ = grow.m[2], cost = manaValue(`{${grow.m[1]}}`) || 4;
      const tokN = Object.values(p.tokens || {}).filter(t => new RegExp(`\\b${typ}\\b`, "i").test(t.name) && t.count > 0).reduce((a, t) => a + t.count, 0);
      const have = ents.filter(x => new RegExp(`\\b${typ}\\b`).test(x.t)).length + tokN;
      const dbl = pick(/if an effect would create one or more tokens under your control, it creates twice that many/i).length;
      const need = Math.ceil(cost / 2 ** dbl);
      const pieces = [...new Set([grow.x.n, manaAll.n, haste.n])];
      out.push({ key: `grow:${pieces.join("+")}`, name: pieces.join(" + "), pieces, win: false, kind: "grow", srcId: grow.x.id, typ, ready: have >= need,
        desc: `Each activation of ${grow.x.n} makes one new ${typ} per ${typ} you have (${have} now${dbl ? `, ×${2 ** dbl} from doublers` : ""}). The new ones have haste and tap for mana (${manaAll.n}), so the next activation pays for itself once you have ${need}+ ${typ}s${have >= need ? "" : ` (${need - have} short right now)`}: as many ${typ}s and as much mana as you want.` });
    } }
  // Elsha / Mystic Forge + Sensei's Divining Top: cast Top off the top, tap it to draw (Top goes back on top), repeat — once each loop costs nothing net
  { const fromTop = pick(/you may cast (?:noncreature|artifact) spells (?:and [a-z ]+ )?from the top of your library/i)[0], top = has("Sensei's Divining Top");
    if (fromTop && top) {
      const red = pick(/^(?:noncreature|artifact) spells you cast cost \{1\} less to cast/im)[0];
      const kykar = ents.find(x => /whenever you cast a noncreature spell, create a [^.]*?(spirit|ally|monk|elemental)[^.]* token/i.test(x.o) && /^sacrifice an? (spirit|ally|monk|elemental): add \{[WUBRGC]\}/im.test(x.o));
      const tokMaker = pick(/whenever you cast a noncreature spell, create (?:a|an) [^.]*creature token/i)[0], altar = pick(/^sacrifice a creature: add /im)[0];
      const ja = pick(/whenever you cast a noncreature spell, creatures you control get \+1\/\+1 until end of turn\. untap those creatures/i)[0];
      const dork = ja && (ents.find(x => /\bCreature\b/.test(x.t) && /^\{T\}: Add /im.test(x.o)) || (pick(/^tap an untapped legendary creature you control: add/im)[0] && ents.find(x => /\bLegendary\b/.test(x.t) && /\bCreature\b/.test(x.t))));
      const fuel = red ? { by: red.n } : dork ? { by: `${ja.n} + ${pick(/^tap an untapped legendary creature you control: add/im)[0]?.n || dork.n}` } : kykar ? { by: kykar.n, sac: (kykar.o.match(/^sacrifice an? ([a-z]+): add/im) || [])[1] } : tokMaker && altar ? { by: `${tokMaker.n} + ${altar.n}`, sac: (tokMaker.o.match(/whenever you cast a noncreature spell, create (?:a|an) [^.]*?([A-Z][a-z]+) creature token/) || [])[1] } : null;
      if (fuel) {
        const each = (re, n) => pick(re).length * n;
        const toks = pick(/whenever you cast a noncreature spell, create (?:a|an) [^.]*creature token/i).length;
        const dmg = each(/whenever you cast a noncreature spell, [^.]*?deals 2 damage to each opponent/i, 2) + each(/whenever you cast a noncreature spell, [^.]*?deals 1 damage to each opponent/i, 1) + toks * pick(/whenever (?:a|another) creature you control enters, [^.]*?deals 1 damage to each opponent/i).length;
        const pieces = [fromTop.n, "Sensei's Divining Top", ...fuel.by.split(" + ").filter(n => n !== fromTop.n)];
        out.push({ key: `top:${pieces.join("+")}`, name: pieces.join(" + "), pieces, win: dmg > 0, kind: "castLoop", spell: "Sensei's Divining Top", fuelSac: fuel.sac || null, dmg,
          desc: `Tap Top to draw (it goes back on top of your library), cast it again from the top with ${fromTop.n} — ${fuel.sac ? `the ${fuel.sac} token from ${fuel.by.split(" + ")[0]} pays its {1}` : `${fuel.by} pays for it`}. Every loop is a noncreature spell (prowess, cast triggers) and draws a card, so it's limited by your library${dmg ? `; each loop deals ${dmg} to each opponent` : ""}.` });
      } } }
  // Isochron Scepter with Dramatic Reversal + 3 or more mana from nonland permanents: infinite mana, and every loop is a cast
  { const sc = ents.find(x => x.n === "Isochron Scepter" && [x.e.imprint, ...(x.e.imprints || [])].includes("Dramatic Reversal"));
    if (sc) { const mana = ents.filter(x => !/\bLand\b/.test(x.t) && x.id !== sc.id).reduce((a, x) => { const m = x.o.match(/^\{T\}: Add ((?:\{[WUBRGC]\})+)/m); return a + (m ? (m[1].match(/\{/g) || []).length : /^\{T\}: Add one mana of any (?:color|type)/im.test(x.o) ? 1 : 0); }, 0);
      if (mana >= 3) out.push({ key: "named:Isochron+Reversal", name: "Isochron Scepter + Dramatic Reversal", pieces: ["Isochron Scepter", "Dramatic Reversal"], win: false, kind: "castLoop", spell: "Dramatic Reversal", fuelSac: null, dmg: 0,
        desc: `Your nonland permanents make ${mana} mana; Scepter's {2} casts Dramatic Reversal, which untaps them all: infinite mana, and each loop is an instant cast (prowess, magecraft, storm).` }); } }
  // Cards known to be in hand (digital hand) or cast by me this turn: some loops need a spell, not a permanent
  const handOrCast = n => (ctx.hand || []).includes(n) || (ctx.cast || []).includes(n);
  // Hullbreaker Horror + a mana rock that makes more than it costs (Sol Ring, Mana Vault, Mox Amber, Mana Crypt) + a cheap permanent:
  // cast the permanent → bounce the rock; recast the rock → bounce the permanent. Two casts per loop; mana left over = rock's mana − both costs
  { const hh = ents.find(x => (/^whenever you cast a spell, choose up to one —/im.test(x.o) && /return target nonland permanent to its owner's hand/i.test(x.o)) || /^whenever you cast a spell, return target permanent to its owner's hand/im.test(x.o)); // Hullbreaker Horror, Tidespout Tyrant
    if (hh) {
      const legCols = ents.filter(x => /\bLegendary\b/.test(x.t) && /\b(Creature|Planeswalker)\b/.test(x.t)).flatMap(x => (String(lookup(x.n)?.m || x.e.m || "").match(/[WUBRG]/g) || []));
      const rockOut = x => { const m = x.o.match(/^\{T\}: Add ((?:\{C\})+)\.?$/m); if (m) return { n: m[1].length / 3, colorless: true };
        if (/^\{T\}: Add one mana of any color among legendary creatures and planeswalkers you control/im.test(x.o)) return legCols.length ? { n: 1, colorless: false, cols: legCols } : null; return null; };
      const cards = [...ents.map(x => ({ n: x.n, t: x.t, m: String(lookup(x.n)?.m ?? x.e.m ?? "") })), ...(ctx.hand || []).map(n => ({ n, t: lookup(n)?.t || "", m: String(lookup(n)?.m || "") }))]
        .filter(c => c.n !== hh.n && !/\bLand\b/.test(c.t) && /\b(Artifact|Creature|Enchantment|Planeswalker|Battle)\b/.test(c.t));
      for (const rk of ents.filter(x => x.id !== hh.id && !/\bLand\b/.test(x.t))) {
        const out1 = rockOut(rk); if (!out1) continue;
        const rc = manaValue(String(lookup(rk.n)?.m ?? rk.e.m ?? ""));
        const fits = cards.filter(c => c.n !== rk.n).map(c => ({ ...c, mv: manaValue(c.m), pips: (c.m.match(/\{[WUBRG]\}/g) || []).map(s => s[1]) }))
          .filter(c => c.mv + rc <= out1.n && (out1.colorless ? !c.pips.length : c.pips.length <= 1 && c.pips.every(p => out1.cols.includes(p))))
          .sort((a, b) => a.mv - b.mv);
        if (!fits.length) continue;
        const y = fits[0], net = out1.n - rc - y.mv, pieces = [hh.n, rk.n, y.n];
        out.push({ key: `hull:${pieces.join("+")}`, name: pieces.join(" + "), pieces, win: false, kind: net > 0 && out1.colorless ? "mana" : "info",
          desc: `Tap ${rk.n} (${out1.n} mana), cast ${y.n} (${y.mv}): ${hh.n} returns ${rk.n} to your hand. Recast ${rk.n} (${rc}): ${hh.n} returns ${y.n}. Two spells per loop${net > 0 ? `, +${net} ${out1.colorless ? "colorless " : ""}mana each time: infinite mana, storm and cast triggers` : ": infinite storm count and cast triggers (no mana left over)"}.` });
        break;
      } } }
  // Thassa's Oracle wins (cards known to be in the digital hand): Demonic Consultation / Tainted Pact exile the library, Hermit Druid mills it when no basics are left
  { const inHand = n => (ctx.hand || []).includes(n);
    if (inHand("Thassa's Oracle")) {
      const libBasics = ctx.lib ? ctx.lib.filter(n => /\bBasic\b/.test(lookup(n)?.t || "") && /\bLand\b/.test(lookup(n)?.t || "")).length : null;
      const dupes = ctx.lib ? ctx.lib.length - new Set(ctx.lib).size : null;
      if (inHand("Demonic Consultation")) out.push({ key: "named:Demonic Consultation+Thassa's Oracle", name: "Demonic Consultation + Thassa's Oracle", pieces: ["Demonic Consultation", "Thassa's Oracle"], win: true, kind: "info",
        desc: "Cast Demonic Consultation naming Thassa's Oracle (it's in your hand, so your whole library is exiled), then cast Thassa's Oracle: with your library empty, you win." });
      if (inHand("Tainted Pact")) out.push({ key: "named:Tainted Pact+Thassa's Oracle", name: "Tainted Pact + Thassa's Oracle", pieces: ["Tainted Pact", "Thassa's Oracle"], win: true, kind: "info",
        desc: `Cast Tainted Pact and keep exiling: with no two cards in your library sharing a name, it exiles the whole library. Then cast Thassa's Oracle: you win.${dupes ? ` Careful: ${dupes} card${dupes === 1 ? " shares" : "s share"} a name in your library (basics count), so Pact stops early.` : ""}` });
      const hd = ents.find(x => /^\{G\}, \{T\}: Reveal cards from the top of your library until you reveal a basic land card\. Put that card into your hand and all other cards revealed this way into your graveyard\.?$/im.test(x.o));
      if (hd && (libBasics === null || libBasics === 0)) out.push({ key: `named:${hd.n}+Thassa's Oracle`, name: `${hd.n} + Thassa's Oracle`, pieces: [hd.n, "Thassa's Oracle"], win: true, kind: "info",
        desc: `Activate ${hd.n} ({G}, tap; it can't be summoning sick): with no basic lands left in your library, every card goes to your graveyard. Then cast Thassa's Oracle: you win.${libBasics === null ? " Only once your basic lands are out of the library." : ""}` });
    } }
  // +1/+1 counter loops around Shalai and Hallar, Walking Ballista and Vigor
  { const gainers = ents.filter(x => /^whenever you gain life, put (?:a|one) \+1\/\+1 counters? on (?:this creature|~|each creature you control|target creature(?: or enchantment)? you control|[^.]*?)(?: and scry 1)?\.?$/im.test(x.o) || /^whenever you gain life, put a \+1\/\+1 counter on /im.test(x.o));
    const llFor = id => { const t = ents.find(x => x.id === id); if (!t) return null;
      if (/^(?:[a-z ,]*\b)?lifelink\b/im.test(t.o) && !/gains? lifelink/i.test(t.o.match(/^.*lifelink.*$/im)?.[0] || "")) return t.n;
      const at = ents.find(x => x.e.att === id && /\b(?:equipped|enchanted) creature (?:gets [^.]*?and )?(?:has|gains) [^.]*lifelink/i.test(x.o)); if (at) return at.n;
      const all = pick(/^(?:other )?creatures you control have [^.]*lifelink/im)[0]; if (all && all.id !== id) return all.n;
      const hel = pick(/another target creature gains lifelink until end of turn/i)[0]; if (hel && hel.id !== id) return `${hel.n} (activate it)`;
      return null; };
    const sh = ents.find(x => /^whenever one or more \+1\/\+1 counters are put on a creature you control, [^,]+ deals that much damage to target opponent/im.test(x.o));
    if (sh && gainers.length) { const ll = llFor(sh.id); const g = gainers.find(x => x.id !== sh.id) || gainers[0];
      if (ll) { const pieces = [...new Set([sh.n, g.n, ...(ll.startsWith(g.n) ? [] : [ll.replace(/ \(activate it\)$/, "")])])];
        out.push({ key: `ll:${pieces.join("+")}`, name: pieces.join(" + "), pieces, win: true, kind: "dmgAll",
          desc: `${sh.n} has lifelink (${ll}): each +1/+1 counter makes it deal damage to an opponent, the lifelink gain triggers ${g.n}, which puts another counter on: infinite damage and life. Start it with any +1/+1 counter.` }); } }
    const bal = ents.find(x => /^Remove a \+1\/\+1 counter from this creature: It deals 1 damage to any target\.?$/m.test(x.o));
    if (bal) {
      const g = gainers.find(x => x.id !== bal.id && /each creature you control|target creature/i.test(x.o)), ll = llFor(bal.id);
      if (g && ll && !(g.n === "Heliod, Sun-Crowned")) out.push({ key: `ll:${bal.n}+${g.n}`, name: `${bal.n} + ${g.n}`, pieces: [bal.n, g.n], win: true, kind: "dmgAll",
        desc: `${bal.n} has lifelink (${ll}): each ping gains 1 life, ${g.n} puts the counter back. Infinite damage and life.` });
      const vig = ents.find(x => /if damage would be dealt to another creature you control, prevent that damage\. put a \+1\/\+1 counter on that creature for each 1 damage prevented/i.test(x.o));
      const boost = ents.find(x => /^if one or more \+1\/\+1 counters would be put on (?:a creature|an artifact or creature|a permanent|a creature or vehicle) you control, (?:that many plus one|twice that many)/im.test(x.o) || /^if an effect would put one or more counters on a permanent you control, it puts twice that many of those counters on that permanent instead/im.test(x.o));
      if (vig && boost) out.push({ key: `vig:${vig.n}+${bal.n}+${boost.n}`, name: `${vig.n} + ${bal.n} + ${boost.n}`, pieces: [vig.n, bal.n, boost.n], win: true, kind: "dmgAll",
        desc: `Ping ${bal.n} with itself: ${vig.n} prevents it and puts a counter back, and ${boost.n} adds at least one more. Each self-ping nets a counter to ping an opponent with: infinite damage.` });
    } }
  // Storm-Kiln Artist + Haze of Rage: buyback Haze with 3+ spells before it makes 4+ Treasures, enough to cast it again
  { const kiln = pick(/whenever you cast or copy an instant or sorcery spell, create a treasure token/i)[0];
    if (kiln && handOrCast("Haze of Rage")) out.push({ key: `named:${kiln.n}+Haze of Rage`, name: `${kiln.n} + Haze of Rage`, pieces: [kiln.n, "Haze of Rage"], win: false, kind: "info",
      desc: `With 3 or more spells cast before it this turn, Haze of Rage with buyback ({3}{R}) makes a Treasure for itself and each storm copy (4+), which pays for the next cast, and it returns to your hand: infinite Treasures, storm count and +1/+0 for your creatures.` }); }
  // Isochron Scepter (Narset's Reversal) + an extra-turn spell: copy it, the original returns to hand, every turn
  { const sc = ents.find(x => x.n === "Isochron Scepter" && [x.e.imprint, ...(x.e.imprints || [])].includes("Narset's Reversal"));
    const xt = sc && [...(ctx.hand || []), ...(ctx.cast || [])].find(n => { const c = lookup(n); return /\b(Instant|Sorcery)\b/.test(c?.t || "") && /(?:^|\n|[.:]\s*)(?:take|target player takes) an extra turn after this one/i.test(c?.o || ""); });
    if (xt) out.push({ key: `named:Isochron Scepter+Narset's Reversal+${xt}`, name: `Isochron Scepter (Narset's Reversal) + ${xt}`, pieces: ["Isochron Scepter", "Narset's Reversal", xt], win: false, kind: "info",
      desc: `Cast ${xt}, then (holding priority) pay {2} and tap Scepter: the Narset's Reversal copy copies ${xt} and returns it to your hand. One extra turn each turn, and you cast ${xt} again: infinite turns.` }); }
  // Underworld Breach + Lotus Petal + Brain Freeze: each Petal escape is a free spell (storm +1); Brain Freeze copies at yourself refill the graveyard
  { const ub = has("Underworld Breach"), lp = has("Lotus Petal") || has("Lion's Eye Diamond"), bfz = Object.values(p.gy || {}).some(c => c.n === "Brain Freeze") || handOrCast("Brain Freeze");
    if (ub && lp && bfz) { const led = lp.n === "Lion's Eye Diamond";
      out.push({ key: `named:Underworld Breach+${lp.n}+Brain Freeze`, name: `Underworld Breach + ${lp.n} + Brain Freeze`, pieces: ["Underworld Breach", lp.n, "Brain Freeze"], win: false, kind: "info",
      desc: led ? "Discard your hand and sacrifice Lion's Eye Diamond for three mana of one color, then escape it back (exile 3 other graveyard cards): +1 storm and +3 mana each time. Escape Brain Freeze ({1}{U}): one copy at yourself refills your graveyard, the rest mill an opponent. Repeat until they're milled out. Breach is sacrificed at the end step."
        : "Tap and sacrifice Lotus Petal, escape it back (exile 3 other graveyard cards): +1 storm each time. Cast Brain Freeze (from hand, or escape it too): point two copies at yourself to refill your graveyard (mill 3 each), the rest at an opponent. Repeat until they're milled out. Breach is sacrificed at the end step." }); } }
  // Underworld Breach + a wheel in the graveyard (Wheel of Fortune, Windfall) + Smothering Tithe or Jeska's Will: every escaped wheel pays for the next
  { const ub = has("Underworld Breach"), zone = [...Object.values(p.gy || {}).map(c => c.n), ...(ctx.hand || [])]; // escape works from the graveyard (a wheel in hand gets there after one cast)
    const wheel = zone.find(n => /each player discards their hand, then draws (?:seven cards|cards equal to the greatest number of cards a player discarded this way)/i.test(lookup(n)?.o || ""));
    const tithe = pick(/whenever an opponent draws a card, that player may pay \{2\}\. if the player doesn't, you create a treasure token/i)[0];
    const jeska = zone.find(n => /add \{R\} for each card in target opponent's hand/i.test(lookup(n)?.o || ""));
    if (ub && wheel && tithe) out.push({ key: `named:Underworld Breach+${tithe.n}+${wheel}`, name: `Underworld Breach + ${tithe.n} + ${wheel}`, pieces: ["Underworld Breach", tithe.n, wheel], win: false, kind: "info",
      desc: `Escape ${wheel} (its mana cost + exile 3 other graveyard cards): every card an opponent draws is a ${tithe.n} trigger, and each one they don't pay {2} for is a Treasure. Opponents who can't pay hand you enough Treasures to escape ${wheel} again: as many wheels as your graveyard allows. Breach is sacrificed at the end step.` });
    if (ub && wheel && jeska) out.push({ key: `named:Underworld Breach+${wheel}+${jeska}`, name: `Underworld Breach + ${wheel} + ${jeska}`, pieces: ["Underworld Breach", wheel, jeska], win: false, kind: "info",
      desc: `Escape ${jeska} ({2}{R}) for {R} per card in an opponent's hand (7 after a wheel), then escape ${wheel} ({2}{R}) to refill everyone's hand. Each pair nets mana, storm and magecraft triggers; it runs until your graveyard can't pay the escape costs. Breach is sacrificed at the end step.` });
  }
  // Underworld Breach + Grinding Station + a 0-cost artifact: sacrifice it to Station (mill 3), escape it (exile 3), it enters and untaps Station
  { const ub = has("Underworld Breach"), gs = ents.find(x => /^\{T\}, Sacrifice an artifact: Target player mills (?:three|\d+) cards?/im.test(x.o) && /whenever an artifact enters, you may untap this/i.test(x.o));
    const zero = gs && [...ents.filter(x => x.id !== gs.id), ...Object.values(p.gy || {}).map(c => ({ n: c.n, t: c.t || lookup(c.n)?.t || "" })), ...(ctx.hand || []).map(n => ({ n, t: lookup(n)?.t || "" }))].find(x => /\bArtifact\b/.test(x.t || lookup(x.n)?.t || "") && !/\bLand\b/.test(x.t || lookup(x.n)?.t || "") && x.n !== gs.n && manaValue(String(lookup(x.n)?.m ?? "")) === 0 && lookup(x.n)?.m != null);
    if (ub && gs && zero) out.push({ key: `named:Underworld Breach+${gs.n}+${zero.n}`, name: `Underworld Breach + ${gs.n} + ${zero.n}`, pieces: ["Underworld Breach", gs.n, zero.n], win: false, kind: "info",
      desc: `Tap ${gs.n} and sacrifice ${zero.n} (target player mills 3), escape ${zero.n} for free (exile 3 other graveyard cards); it enters and untaps ${gs.n}. Mill yourself to keep the graveyard stocked: infinite self-mill, storm, artifact enter and leave triggers. Breach is sacrificed at the end step.` }); }
  // Hullbreaker Horror + two permanents that cost {0} (Ornithopter, Memnite, Mox Opal…): each cast bounces the other
  { const hh = ents.find(x => (/^whenever you cast a spell, choose up to one —/im.test(x.o) && /return target nonland permanent to its owner's hand/i.test(x.o)) || /^whenever you cast a spell, return target permanent to its owner's hand/im.test(x.o)); // Hullbreaker Horror, Tidespout Tyrant
    if (hh && !out.some(c => c.key.startsWith("hull:"))) {
      const arts = ents.filter(x => /\bArtifact\b/.test(x.t)).length;
      const free = n => { const c = lookup(n); if (!c || /\bLand\b/.test(c.t || "") || !/\b(Artifact|Creature|Enchantment|Planeswalker)\b/.test(c.t || "")) return false;
        const m = String(c.m ?? ""); if (c.m != null && manaValue(m) === 0) return true;
        return /\baffinity for artifacts\b/i.test(c.o || "") && !/\{[WUBRG]\}/.test(m) && manaValue(m) <= arts; };
      const zs = [...new Set([...ents.filter(x => x.id !== hh.id).map(x => x.n), ...(ctx.hand || [])])].filter(free);
      if (zs.length >= 2) out.push({ key: `hull0:${zs[0]}+${zs[1]}`, name: `${hh.n} + ${zs[0]} + ${zs[1]}`, pieces: [hh.n, zs[0], zs[1]], win: false, kind: "info",
        desc: `Cast ${zs[0]} for free: ${hh.n} returns ${zs[1]} to your hand. Cast ${zs[1]}: it returns ${zs[0]}. Repeat: infinite storm count, cast triggers and enter/leave triggers.` }); } }
  // Chatterfang-style token adder ("those tokens plus that many 1/1 Squirrels"): sacrificing a creature that makes a token makes a Squirrel to sacrifice next
  { const sqAdd = pick(/if one or more tokens would be created under your control, those tokens plus that many [^.]*squirrel creature tokens/i)[0];
    const toks = Object.values(p.tokens || {}).filter(t => (t.count || 0) > 0);
    const squirrels = toks.filter(t => /squirrel/i.test(t.name)).reduce((a, t) => a + t.count, 0) + ents.filter(x => /\bSquirrel\b/.test(x.t) && x.n !== sqAdd?.n).length;
    const otherCreatures = toks.filter(t => /creature/i.test(t.desc || "") || /squirrel|soldier|zombie|spirit|goblin|elf|saproling|insect|rat|beast|human|cat|bird|wolf|bear|construct|thopter|servo|eldrazi/i.test(t.name)).reduce((a, t) => a + t.count, 0) + ents.filter(x => /\bCreature\b/.test(x.t)).length;
    if (sqAdd) {
      // + Pitiless Plunderer: {B}, sacrifice a Squirrel → a Treasure (and a Squirrel), the Treasure pays the next {B}
      const sqOut = pick(/^\{B\}, sacrifice x squirrels: /im)[0], tre = pick(/whenever another creature you control dies, create a treasure token/i).find(x => x.id !== sqAdd.id);
      if (sqOut && tre && squirrels >= 1) out.push({ key: `sqtre:${sqOut.n}+${tre.n}`, name: sqOut.n === sqAdd.n ? `${sqAdd.n} + ${tre.n}` : `${sqAdd.n} + ${sqOut.n} + ${tre.n}`, pieces: [...new Set([sqAdd.n, sqOut.n, tre.n])], win: false, kind: "tokens", spend: "Treasure", pump: sqOut.n,
        desc: `Pay {B} and sacrifice a Squirrel to ${sqOut.n}: ${tre.n} makes a Treasure, and ${sqAdd.n} adds a Squirrel with it. The Treasure pays the next {B}. Repeat: infinite death triggers, Treasure and Squirrels in and out, and each activation gives a target creature +1/-1 (shrink every opposing creature to 0 toughness).` });
      // + Warren Soultrader: pay 1 life, sacrifice a creature → a Treasure (and a Squirrel). Needs life back or extra tokens to be infinite
      const soul = pick(/^pay 1 life, sacrifice another creature: create a (?:treasure|food|clue) token/im)[0];
      if (soul && otherCreatures - ents.filter(x => /\bCreature\b/.test(x.t) && [soul.id, sqAdd.id].includes(x.id)).length >= 2) {
        const drainer = pick(/whenever (?:another|a) creature (?:you control )?dies, [^.]*(?:loses (?:1|one) life and you gain (?:1|one) life|you gain (?:1|one) life and [^.]*loses (?:1|one) life)/i).find(x => x.id !== soul.id);
        const extra = pick(/if you would create a clue, food, or treasure token, instead create one of each|those tokens plus an additional food token are created instead/i)[0];
        if (drainer) { const all = /each opponent loses/i.test(drainer.o.match(/whenever (?:another|a) creature[^.]*dies,[^.]*/i)?.[0] || "");
          out.push({ key: `soul:${soul.n}+${drainer.n}`, name: `${soul.n} + ${sqAdd.n} + ${drainer.n}`, pieces: [soul.n, sqAdd.n, drainer.n], win: true, kind: all ? "drainAll" : "drainOne",
            desc: `Pay 1 life and sacrifice a Squirrel to ${soul.n}. ${drainer.n} gives the life back and drains ${all ? "each opponent" : "an opponent"} for 1; the Treasure comes with a fresh Squirrel. Repeat: infinite drain, death triggers and Treasure.` }); }
        else if (extra) out.push({ key: `soul:${soul.n}+${extra.n}`, name: `${sqAdd.n} + ${soul.n} + ${extra.n}`, pieces: [sqAdd.n, soul.n, extra.n], win: false, kind: "loop", run: { sac: true, create: { name: "Treasure", desc: "Treasure artifact" }, life: -1, note: "Crack Foods ({2}: gain 3 life) to stay ahead." },
          desc: `Pay 1 life and sacrifice a creature to ${soul.n}: ${extra.n} adds ${/one of each/i.test(extra.o) ? "a Food and a Clue" : "a Food"} and ${sqAdd.n} adds a Squirrel for every token. Two loops give two Treasures to crack a Food for 3 life, so you come out ahead: infinite Squirrels, Treasure, Food${/one of each/i.test(extra.o) ? ", Clues (cards)" : ""}, death triggers and life, and ${sqAdd.n} can shrink every opposing creature.` });
      }
    }
  }
  // Hazel's Brewmaster: Foods gain the activated abilities of exiled creature cards. Devoted Druid's untap costs a Food nothing
  { const hz = pick(/foods you control have all activated abilities of all creature cards exiled with this creature/i)[0];
    const dd = hz && Object.values(p.ex || {}).find(c => { const o = String(lookup(c.n)?.o || c.o || ""); return /^\{T\}: Add \{[WUBRGC]\}/m.test(o) && /^put a -1\/-1 counter on this creature: untap this creature/im.test(o); });
    if (hz && dd) { const food = Object.values(p.tokens || {}).some(t => /^food$/i.test(t.name) && t.count > 0);
      out.push({ key: `hazel:${hz.n}+${dd.n}`, name: `${hz.n} + ${dd.n}`, pieces: [hz.n, dd.n], win: false, kind: food ? "mana" : "info", sym: (String(lookup(dd.n)?.o || dd.o || "").match(/^\{T\}: Add (\{[WUBRGC]\})/m) || [])[1] || "{C}",
        desc: `${food ? "" : "Needs a Food. "}If ${dd.n} was exiled with ${hz.n}, your Foods can tap for mana and untap by taking a -1/-1 counter, which does nothing to a Food: infinite mana.` }); } }
  // Saw in Half on an Eternal Witness: the two copies return Saw in Half and the mana (Lion's Eye Diamond, Cabal Ritual with threshold)
  { const sawIn = n => handOrCast(n) || ents.some(x => x.n === n);
    const saw = [...(ctx.hand || []), ...(ctx.cast || [])].find(n => /destroy target creature\. if that creature dies this way, its controller creates two tokens that are copies of that creature/i.test(lookup(n)?.o || ""));
    const wit = ents.find(x => /\bCreature\b/.test(x.t) && /^when (?:this creature|[^,]+) enters, (?:you may )?return (?:target|up to two target) cards? from your graveyard to your hand/im.test(x.o));
    const gyN = Object.keys(p.gy || {}).length;
    const fuel = has("Lion's Eye Diamond") ? "Lion's Eye Diamond" : sawIn("Cabal Ritual") && gyN >= 7 ? "Cabal Ritual" : null;
    if (saw && wit && fuel) out.push({ key: `saw:${saw}+${wit.n}+${fuel}`, name: `${saw} + ${wit.n} + ${fuel}`, pieces: [saw, wit.n, fuel], win: false, kind: "loop", run: { dies: true, create: { name: wit.n, desc: `copy of ${wit.n} (half power and toughness, rounded up)` }, casts: fuel === "Cabal Ritual" ? 2 : 1, note: `Each loop: one ${wit.n} dies and two copies enter (net +1).` },
      desc: fuel === "Cabal Ritual" ? `Cabal Ritual (threshold) makes {B}{B}{B}{B}{B}; ${saw} destroys ${wit.n} for two copies, which return ${saw} and Cabal Ritual. Repeat: infinite ${wit.n} tokens, death and enter triggers, storm and magecraft.`
        : `Cast ${saw} on ${wit.n}; holding priority, crack Lion's Eye Diamond for three mana. The two copies return ${saw} and the Diamond; recast the Diamond for {0}. Repeat: infinite ${wit.n} tokens, death and enter triggers, storm and magecraft.` }); }
  // Chain of Smog + a magecraft drain (Witherbloom Apprentice): target yourself and copy it forever
  { const cs = [...(ctx.hand || []), ...(ctx.cast || [])].find(n => /target player discards two cards\. that player may copy this spell/i.test(lookup(n)?.o || ""));
    const mc = pick(/magecraft — whenever you cast or copy an instant or sorcery spell, each opponent loses (?:1|one) life/i)[0];
    if (cs && mc) out.push({ key: `smog:${cs}+${mc.n}`, name: `${cs} + ${mc.n}`, pieces: [cs, mc.n], win: true, kind: "drainAll",
      desc: `Cast ${cs} targeting yourself. Each time it resolves, discard two (or what you have) and copy it targeting yourself again: every copy is a magecraft trigger, so ${mc.n} drains each opponent forever.` }); }
  // All Will Be One + something that puts a counter down whenever damage is dealt (War Elemental, The Red Terror, Quest for Pure Flame)
  { const awbo = pick(/whenever you put one or more counters on a permanent or player, this [a-z]+ deals that much damage to target opponent/i)[0];
    if (awbo) { const red = /\{R\}/.test(String(lookup(awbo.n)?.m || awbo.e.m || ""));
      const eng = ents.find(x => x.id !== awbo.id && (/whenever an opponent is dealt damage, put that many \+1\/\+1 counters/i.test(x.o) || /whenever a source you control deals damage to an opponent, you may put a [a-z]+ counter/i.test(x.o) || (red && /whenever a red source you control deals damage to [^,]*, put a \+1\/\+1 counter/i.test(x.o))));
      if (eng) out.push({ key: `awbo:${awbo.n}+${eng.n}`, name: `${awbo.n} + ${eng.n}`, pieces: [awbo.n, eng.n], win: true, kind: "dmgAll",
        desc: `Deal any damage to an opponent to start: ${eng.n} gets a counter, so ${awbo.n} deals that much damage to an opponent, which puts another counter on ${eng.n}. Repeat: infinite damage.` }); } }
  // Scurry Oak + Cathars' Crusade: each Squirrel entering puts a counter on Scurry Oak, which makes another Squirrel
  { const oakRe = /whenever one or more \+1\/\+1 counters are put on this creature, you may create a [^.]*creature token/i;
    const oak = pick(oakRe)[0] || (() => { const n = [...(ctx.hand || []), ...(ctx.cast || [])].find(n => /\bCreature\b/.test(lookup(n)?.t || "") && oakRe.test(lookup(n)?.o || "")); return n ? { n } : null; })();
    const cru = pick(/^whenever a(?:nother)? creature (?:you control )?enters(?: the battlefield)?(?: under your control)?, put a \+1\/\+1 counter on each creature you control/im)[0];
    if (oak && cru && ents.some(x => x.n === oak.n)) out.push({ key: `oak:${oak.n}+${cru.n}`, name: `${oak.n} + ${cru.n}`, pieces: [oak.n, cru.n], win: false, kind: "loop", run: { create: { name: "Squirrel", desc: (oak.o.match(/create an? ([^.]*?) creature token/i) || [, "1/1 green Squirrel"])[1] + " creature" }, dropRem: oak.n, note: "Check the new tokens' counters: in the real loop each one only gets counters from the tokens made after it." },
      desc: `Any creature entering starts it: ${cru.n} puts a counter on ${oak.n}, which makes a token; that token entering puts more counters on everything. Stop whenever you like: as many tokens and +1/+1 counters as you want.` });
    else if (oak && cru) out.push({ key: `oak:${oak.n}+${cru.n}`, name: `${oak.n} + ${cru.n}`, pieces: [oak.n, cru.n], win: false, kind: "info",
      desc: `Any creature entering starts it: ${cru.n} puts a counter on ${oak.n}, which makes a token; that token entering puts more counters on everything. Stop whenever you like: as many tokens and +1/+1 counters as you want.` }); }
  // Kodama of the East Tree + a bounce land + a landfall token maker (Rampaging Baloths)
  { const ko = pick(/whenever another permanent you control enters, if it wasn't put onto the battlefield with this ability, you may put a permanent card with equal or lesser mana value from your hand onto the battlefield/i)[0];
    const bounceRe = /when this land enters, return a land you control to its owner's hand/i;
    const bounce = ko && (ents.find(x => bounceRe.test(x.o))?.n || (ctx.hand || []).find(n => bounceRe.test(lookup(n)?.o || "")));
    const lf = ko && pick(/landfall — whenever a land you control enters, create [^.]*creature token/i)[0];
    if (ko && bounce && lf) out.push({ key: `kodama:${ko.n}+${bounce}+${lf.n}`, name: `${ko.n} + ${bounce} + ${lf.n}`, pieces: [ko.n, bounce, lf.n], win: false, kind: "loop", run: { create: { name: (lf.o.match(/create an? [^.]*?\b([A-Z][a-z]+) creature token/) || [, "Beast"])[1], desc: (lf.o.match(/create an? ([^.]*?) creature token/i) || [, "4/4 green Beast"])[1] + " creature" }, landfall: true, dropRem: ko.n, note: `Each loop is one landfall (${bounce} entering) and one token.` },
      desc: `With a land drop left: play ${bounce}, return ${bounce} itself to your hand; ${lf.n} makes a token, and the token entering lets ${ko.n} put ${bounce} back from your hand. Repeat: infinite tokens and landfall triggers.` }); }
  // Glacial Chasm lock: replay it from the graveyard with an extra land drop (The Gitrog Monster + Mole Man, Icetill Explorer)
  { const chasmIn = ents.find(x => x.n === "Glacial Chasm") || Object.values(p.gy || {}).find(c => c.n === "Glacial Chasm") || (ctx.hand || []).includes("Glacial Chasm");
    const fromGy = pick(/^you may play lands from your graveyard/im), extra = pick(/^you may play an additional land on each of your turns/im);
    if (chasmIn && fromGy.length && extra.length) { const pieces = [...new Set(["Glacial Chasm", fromGy[0].n, extra[0].n])];
      out.push({ key: `chasm:${pieces.join("+")}`, name: pieces.join(" + "), pieces, win: false, kind: "info",
        desc: `Play Glacial Chasm (it sacrifices another land), then replay that land from your graveyard. At upkeep, skip the cost, sacrifice Chasm and play it again from your graveyard: all damage to you is prevented forever. Your creatures can't attack while it's out.` }); } }
  // Kiki-Jiki / Splinter Twin + a creature whose "enters" untaps (Pestermite, Zealous Conscripts…) or Combat Celebrant: infinite hasty copies
  { const untapETB = o => /^when (?:this creature|[^,]+) enters, (?:you may )?(?:tap or untap|untap) (?:target|up to one target|another target) (?:nonland )?(?:permanent|creature|artifact or creature)/im.test(o) || /^when (?:this creature|[^,]+) enters, gain control of target permanent until end of turn\. untap that permanent/im.test(o) || /untap all other creatures you control and after this phase, there is an additional combat phase/i.test(o);
    const kiki = ents.find(x => /^\{T\}: Create a token that's a copy of target nonlegendary creature you control, except it has haste/im.test(x.o));
    const twin = ents.find(x => /^enchanted creature has "\{T\}: Create a token that's a copy of this creature, except it has haste/im.test(x.o) && x.e.att);
    const twinOn = twin && ents.find(y => y.id === twin.e.att);
    const mates = ents.filter(x => /\bCreature\b/.test(x.t) && !/\bLegendary\b/.test(x.t) && untapETB(x.o));
    if (kiki && mates.length && !out.some(c => c.pieces?.includes(kiki.n))) { const m = mates[0]; const cel = /additional combat phase/i.test(m.o);
      out.push({ key: `copyuntap:${kiki.n}+${m.n}`, name: `${kiki.n} + ${m.n}`, pieces: [kiki.n, m.n], win: false, kind: "tokens", tokenOf: m.n,
        desc: cel ? `${kiki.n} copies ${m.n}; the hasty copy attacks and exerts, untapping ${kiki.n} with an extra combat: infinite combats and hasty tokens.` : `${kiki.n} copies ${m.n}; the copy's "enters" untaps ${kiki.n}. Repeat: infinite hasty ${m.n} tokens.` }); }
    if (twinOn && untapETB(twinOn.o)) out.push({ key: `twin:${twinOn.n}`, name: `${twin.n} + ${twinOn.n}`, pieces: [twin.n, twinOn.n], win: false, kind: "tokens", tokenOf: twinOn.n,
      desc: `${twinOn.n} taps (Splinter Twin) to copy itself; the hasty copy's "enters" untaps the original. Repeat: infinite hasty ${twinOn.n} tokens.` });
    const rio = ents.find(x => /^at the beginning of combat on your turn, create x tokens that are copies of another target creature you control/im.test(x.o));
    const cel = ents.find(x => /untap all other creatures you control and after this phase, there is an additional combat phase/i.test(x.o));
    if (rio && cel) out.push({ key: `rio:${rio.n}+${cel.n}`, name: `${rio.n} + ${cel.n}`, pieces: [rio.n, cel.n], win: false, kind: "info",
      desc: `Each combat ${rio.n} copies ${cel.n}; a copy exerts as it attacks for another combat, where ${rio.n} makes more copies: infinite combats.` }); }
  // Dualcaster Mage + a spell that copies or blinks a creature (Twinflame, Heat Shimmer, Saw in Half, Ghostly Flicker…)
  { const hc = [...(ctx.hand || []), ...(ctx.cast || [])];
    const dual = hc.find(n => /^when (?:this creature|[^,]+) enters, copy target instant or sorcery spell/im.test(lookup(n)?.o || "") && /^Flash\b/m.test(lookup(n)?.o || "")) || ents.find(x => false)?.n;
    const spell = dual && hc.find(n => n !== dual && /\b(Instant|Sorcery)\b/.test(lookup(n)?.t || "") && /tokens? that(?:'s| are) (?:a )?cop(?:y|ies) of (?:target|another target|up to \w+ target|that) (?:artifact or )?creature|its controller creates two tokens that are copies of that creature|exile (?:two )?target [^.]*?(?:you control|you own)[^.]*?,? then return|exile (?:two )?target (?:artifacts?, creatures?,? and\/or lands?|nonland permanents?|creatures?)[^.]*?\. return (?:that card|those cards|them|it)/i.test(lookup(n)?.o || ""));
    if (dual && spell) out.push({ key: `dual:${dual}+${spell}`, name: `${dual} + ${spell}`, pieces: [dual, spell], win: false, kind: "info",
      desc: `Cast ${spell}, then flash in ${dual} copying it, targeting ${dual}: each new ${dual} copies the spell again. Repeat: infinite hasty ${dual} tokens or enters and leaves triggers.` }); }
  // Cloudstone Curio + two creatures that cost {0}: each one entering returns the other
  { const curio = pick(/^whenever a nonartifact permanent you control enters, you may return another permanent you control that shares a permanent type with it to its owner's hand/im)[0];
    if (curio) { const free = [...new Set([...ents.map(x => x.n), ...(ctx.hand || [])])].filter(n => { const c = lookup(n); return c && /\bCreature\b/.test(c.t || "") && !/\bArtifact\b/.test(c.t || "") && c.m != null && manaValue(String(c.m)) === 0; });
      if (free.length >= 2) out.push({ key: `curio:${free[0]}+${free[1]}`, name: `${curio.n} + ${free[0]} + ${free[1]}`, pieces: [curio.n, free[0], free[1]], win: false, kind: "info",
        desc: `Cast ${free[0]} for free: ${curio.n} returns ${free[1]}; cast ${free[1]}: it returns ${free[0]}. Repeat: infinite storm count, cast and enter triggers.` }); } }
  // Persist/undying loops: a free sacrifice outlet + something that cancels the counter (Mikaeus's undying on a persist creature, Metallic Mimic's extra +1/+1)
  { const outlet = sac[0] || pick(/^sacrifice another creature: /im).find(x => !/^sacrifice another creature: [^\n]*\{T\}/im.test(x.o));
    const kw = (x, k) => new RegExp(`^${k}\\b`, "im").test(x.o);
    const mik = pick(/other non-human creatures you control get \+1\/\+1 and have undying/i)[0], mimic = pick(/each other creature you control of the chosen type enters with an additional \+1\/\+1 counter/i)[0];
    const persistC = ents.find(x => /\bCreature\b/.test(x.t) && kw(x, "persist") && !/\bHuman\b/.test(x.t));
    const helper = (mik && persistC) ? mik : (mimic && persistC) ? mimic : null;
    if (outlet && helper && persistC) { const pieces = [...new Set([outlet.n, helper.n, persistC.n])];
      const dmgOut = /^sacrifice (?:a|another) creature: [^\n]*deals? \d+ damage to (?:any target|each opponent|target (?:player|opponent))/im.test(outlet.o);
      const drainer = ents.find(x => /whenever (?:this creature or )?another creature (?:you control )?dies, (?:each opponent|target player|target opponent) loses/i.test(x.o));
      if (drainer && !pieces.includes(drainer.n)) pieces.push(drainer.n);
      out.push({ key: `persist:${pieces.join("+")}`, name: pieces.join(" + "), pieces, win: dmgOut || !!drainer, kind: "info",
        desc: helper === mik ? `Sacrifice ${persistC.n} to ${outlet.n}: persist returns it with a −1/−1 counter; next time undying (from ${mik.n}) returns it with a +1/+1 counter, which cancels the −1/−1. Repeat: infinite death and enter triggers.` : `${persistC.n} comes back with persist's −1/−1 counter and ${mimic.n}'s extra +1/+1 counter, which cancel out (if it's the chosen type). Sacrifice it to ${outlet.n} again: infinite death and enter triggers.` }); }
    // Yawgmoth: pay 1 life and sacrifice to put a −1/−1 counter on an undying creature (clearing its +1/+1), with a death payoff paying the life back
    const yaw = pick(/^pay 1 life, sacrifice another creature: put a -1\/-1 counter on up to one target creature and draw a card/im)[0];
    const undC = ents.filter(x => /\bCreature\b/.test(x.t) && x.id !== yaw?.id && (kw(x, "undying") || (mik && x.id !== mik.id && !/\bHuman\b/.test(x.t))));
    const pay = pick(/whenever (?:this creature or another|another|a) creature(?: you control)? dies, [^.]*(?:you gain (?:1|one) life|loses (?:1|one) life and you gain)/i)[0] || pick(/whenever another creature dies, target opponent loses 1 life and you gain 1 life/i)[0];
    if (yaw && undC.length >= 2 && pay) { const pieces = [...new Set([yaw.n, undC[0].n, undC[1].n, pay.n])];
      out.push({ key: `yawg:${pieces.join("+")}`, name: pieces.join(" + "), pieces, win: true, kind: "drainAll",
        desc: `Pay 1 life and sacrifice one undying creature to ${yaw.n}, putting the −1/−1 counter on the other (cancelling its +1/+1). The sacrificed one returns with undying; ${pay.n} pays back the life. Repeat: draw your deck and drain everyone.` }); } }
  // Staff of Domination / Umbral Mantle + a creature that taps for four or more mana
  { const unt = pick(/^\{3\}, \{T\}: Untap target creature\.?$/im)[0] || pick(/equipped creature has "\{3\}, \{Q\}: This creature gets \+2\/\+2/i)[0];
    const big = unt && ents.find(x => /\bCreature\b/.test(x.t) && /^\{T\}: Add (?:\{G\} for each|an amount of \{G\} equal to|X mana of any one color|\{G\}\{G\}\{G\}\{G\})/im.test(x.o));
    if (unt && big) out.push({ key: `untap4:${unt.n}+${big.n}`, name: `${unt.n} + ${big.n}`, pieces: [unt.n, big.n], win: false, kind: "info",
      desc: `If ${big.n} makes four or more mana: tap it, spend three to untap it with ${unt.n}${/Umbral/.test(unt.n) ? " (it must be equipped)" : ""}, keep the rest. Repeat for infinite mana${/Staff/.test(unt.n) ? " (then the Staff's other abilities give infinite life and cards)" : ""}.` }); }
  // Recursion loops: a creature that comes back from the graveyard + a sac outlet, when the outlet and death triggers pay for the trip back
  { const OUT_RE = /^(?:pay 1 life, )?sacrifice (?:a|another) creature: ([^\n]*)/im;
    const outlets = ents.filter(x => OUT_RE.test(x.o) && !/\{T\}/.test(x.o.match(OUT_RE)[0].replace(/\([^)]*\)/g, "")));
    const outMana = x => { const l = x.o.match(OUT_RE)[1]; return /add one mana of any color|create a treasure token/i.test(l) ? { c: 1, n: 1 } : /add \{C\}\{C\}/i.test(l) ? { c: 0, n: 2 } : { c: 0, n: 0 }; };
    const treas = ents.filter(x => /whenever another creature you control dies, create a treasure token/i.test(x.o));
    const spawn = ents.filter(x => /whenever (?:this creature or )?another nontoken creature you control dies,[^.]*?(?:scion|spawn) creature token/i.test(x.o));
    const rooftop = ents.find(x => /you may pay \{0\} rather than pay the mana cost for zombie creature spells/i.test(x.o));
    const crime = ents.find(x => /whenever (?:this creature or )?another creature dies, target (?:player|opponent) loses/i.test(x.o));
    const drain = ents.find(x => /whenever (?:this creature or )?another creature (?:you control )?dies, (?:each opponent|target player|target opponent) loses/i.test(x.o));
    const gyE = Object.values(p.gy || {}).map(e => ({ n: e.n, e, o: String(lookup(e.n)?.o || e.o || ""), t: e.t || lookup(e.n)?.t || "" }));
    const zombies = ents.filter(x => /\bZombie\b/.test(x.t));
    const seen = new Set();
    [...ents, ...gyE].filter(x => /\bCreature\b/.test(x.t)).forEach(r => {
      if (seen.has(r.n)) return; let cost = null, why = "";
      if (/you may cast this card from your graveyard as long as you control a zombie/i.test(r.o)) { if (!zombies.some(z => z.n !== r.n)) return; cost = rooftop && /\bZombie\b/.test(r.t) ? "" : (lookup(r.n)?.m || r.e.m || ""); why = "recast it from your graveyard"; }
      else { let m = r.o.match(/^((?:\{[^}]+\})+): return this card from your graveyard to the battlefield/im); if (m) { cost = m[1]; why = "return it"; }
        else if ((m = r.o.match(/whenever another creature is put into your graveyard from the battlefield, you may pay ((?:\{[^}]+\})+)\. if you do, return this card/i))) { if (!spawn.length) return; cost = m[1]; why = "a Spawn dying returns it"; }
        else if ((m = r.o.match(/whenever you commit a crime, you may pay ((?:\{[^}]+\})+)\. if you do, return this card/i))) { if (!crime) return; cost = m[1]; why = `${crime.n} targeting an opponent returns it`; } }
      if (cost == null) return;
      const need = { c: (cost.match(/\{[WUBRG](?:\/[WUBRGP])?\}/g) || []).length, n: manaValue(cost) };
      const outlet = outlets.filter(o => o.n !== r.n).map(o => ({ o, m: outMana(o) })).sort((a, b) => b.m.n - a.m.n)[0]; if (!outlet) return;
      const extra = [...treas.map(x => ({ x, c: 1, n: 1 })), ...spawn.map(x => ({ x, c: 0, n: 1 }))].filter(e => e.x.n !== r.n && e.x.n !== outlet.o.n);
      let c = outlet.m.c, n = outlet.m.n; const used = [];
      for (const e of extra) { if (c >= need.c && n >= need.n) break; c += e.c; n += e.n; used.push(e.x.n); }
      if (c < need.c || n < need.n) return;
      seen.add(r.n);
      const pay = drain && drain.n !== r.n ? drain : null;
      if (/a Spawn dying/.test(why) && !used.some(u => spawn.some(x => x.n === u))) used.push(spawn[0].n);
      const pieces = [...new Set([r.n, outlet.o.n, ...used, ...(rooftop && cost === "" ? [rooftop.n] : []), ...(/crime/.test(why) ? [crime.n] : []), ...(pay ? [pay.n] : [])])];
      out.push({ key: `recur:${pieces.join("+")}`, name: pieces.join(" + "), pieces, win: !!pay, kind: "info",
        desc: `Sacrifice ${r.n} to ${outlet.o.n}, then ${why}${need.n ? ` for ${cost}, paid with the mana the loop makes` : " for free"}. Repeat: infinite death and enters triggers${pay ? `; ${pay.n} drains each time` : ""}.` });
    }); }
  NAMED_COMBOS.forEach(c => {
    if (!c.all.every(has)) return;
    if (c.needEquipped && !ents.some(x => x.n === c.needEquipped && x.e.att)) return;
    if (c.needAttached && !ents.some(x => x.n === c.needAttached[0] && ents.some(y => y.id === x.e.att && y.n === c.needAttached[1]))) return;
    if (c.needPair && !ents.some(x => x.n === c.all[0] && x.e.pair && ents.some(y => y.id === x.e.pair && y.n === c.all[1]))) return;
    if (c.needZombie && !ents.some(x => x.n !== "Gravecrawler" && /\bZombie\b/.test(x.t))) return;
    out.push({ key: `named:${c.all.join("+")}`, name: c.all.join(" + "), pieces: c.all, win: c.win, kind: c.kind, desc: c.desc, ...(c.tokenOf ? { tokenOf: c.tokenOf } : {}) });
  });
  if (CSB && ctx.csb !== false) out.push(...csbFor(p, ctx, out));
  return out;
}

// ----- Combos from Commander Spellbook's data (https://commanderspellbook.com, MIT license) -----
// The list is built from their bulk file (csb/build_ship.py) and loaded by the app after start-up.
// Each row: [card indexes…, zone masks…, feature indexes…, number of cards]. Zone bits: 1 battlefield, 2 hand,
// 4 graveyard, 8 exile, 16 command zone, 32 library (never checked); 64 = must be your commander.
const csbNorm = n => String(n || "").split(" // ")[0].trim().toLowerCase();
let CSB = null;
export function setComboData(data) {
  if (!data?.combos || !data?.cards) return false;
  const names = data.cards.map(c => csbNorm(c[0])), by = new Map();
  data.combos.forEach((row, i) => { const k = row[row.length - 1]; for (let j = 0; j < k; j++) { const n = names[row[j]]; let a = by.get(n); if (!a) by.set(n, a = []); a.push(i); } });
  CSB = { data, names, by, memo: new Map(), notes: null };
  return true;
}
export function setComboNotes(notes) { if (CSB && notes?.pre) { CSB.notes = notes.pre; CSB.memo.clear(); } }
// Combos in a decklist: every piece in the deck (and must-be-commander pieces are its commander), plus the ones a single card away
export function deckCombos(names, cmds = []) {
  if (!CSB) return null;
  const have = new Set(names.map(csbNorm)), cm = new Set(cmds.map(csbNorm)), full = [], near = new Map(), seen = new Set();
  for (const n of have) for (const i of CSB.by.get(n) || []) {
    if (seen.has(i)) continue; seen.add(i);
    const row = CSB.data.combos[i], k = row[row.length - 1]; let missing = [];
    for (let j = 0; j < k; j++) { const nm = CSB.names[row[j]], m = row[k + j]; if (!have.has(nm) || (m & 64 && !cm.has(nm))) missing.push(CSB.data.cards[row[j]][0]); }
    const cards = row.slice(0, k).map(x => CSB.data.cards[x]), feats = row.slice(2 * k, row.length - 1).map(f => CSB.data.feats[f]);
    const c = { id: cards.map(x => x[1]).join("-"), pieces: cards.map(x => x[0]), feats, missing };
    if (!missing.length) full.push(c);
    else if (missing.length === 1 && k >= 2) { const m = missing[0]; if (!near.has(m)) near.set(m, []); near.get(m).push(c); }
  }
  // keep the smallest version of each combo
  const sub = (a, b) => a.every(x => b.includes(x));
  const fullMin = full.filter(f => !full.some(g => g !== f && g.pieces.length < f.pieces.length && sub(g.pieces, f.pieces) && f.feats.every(x => g.feats.includes(x)))).sort((a, b) => a.pieces.length - b.pieces.length);
  const nearList = [...near.entries()].map(([card, list]) => ({ card, combos: list.sort((a, b) => a.pieces.length - b.pieces.length) })).sort((a, b) => b.combos.length - a.combos.length);
  return { full: fullMin, near: nearList };
}
// ----- Commander Brackets (Wizards of the Coast, beta; Game Changers as of the February 9, 2026 update, still current in October 2026) -----
export const GAME_CHANGERS = new Set(["Ad Nauseam", "Ancient Tomb", "Aura Shards", "Biorhythm", "Bolas's Citadel", "Braids, Cabal Minion", "Chrome Mox", "Coalition Victory", "Consecrated Sphinx", "Crop Rotation", "Cyclonic Rift", "Demonic Tutor", "Drannith Magistrate", "Enlightened Tutor", "Farewell", "Field of the Dead", "Fierce Guardianship", "Force of Will", "Gaea's Cradle", "Gamble", "Gifts Ungiven", "Glacial Chasm", "Grand Arbiter Augustin IV", "Grim Monolith", "Humility", "Imperial Seal", "Intuition", "Jeska's Will", "Lion's Eye Diamond", "Mana Vault", "Mishra's Workshop", "Mox Diamond", "Mystical Tutor", "Narset, Parter of Veils", "Natural Order", "Necropotence", "Notion Thief", "Opposition Agent", "Orcish Bowmasters", "Panoptic Mirror", "Rhystic Study", "Seedborn Muse", "Serra's Sanctum", "Smothering Tithe", "Survival of the Fittest", "Teferi's Protection", "Tergrid, God of Fright", "Thassa's Oracle", "The One Ring", "The Tabernacle at Pendrell Vale", "Underworld Breach", "Vampiric Tutor", "Worldly Tutor"]);
const MLD_NAMED = new Set(["Armageddon", "Cataclysm", "Catastrophe", "Decree of Annihilation", "Jokulhaups", "Obliterate", "Ravages of War", "Ruination", "Wildfire"]); // Wizards' examples
const MLD_RE = /\bdestroy all lands\b|\beach player sacrifices (?:all|half|four|five|six|seven) (?:the )?lands\b|\bsacrifices all lands\b|\bdestroy all (?:artifacts, creatures, and )?lands\b|\bexile all lands\b|\blands don't untap during their controllers' untap steps\b/i;
const XTURN_RE = /\btakes? an extra turn\b|\btake an extra turn\b/i;
// What the list can tell about a deck's bracket: Game Changers, mass land denial, extra-turn cards, two-card combos (from Spellbook's data)
export function bracketCheck(names, cmds = [], lookup = () => null) {
  const all = [...new Set([...cmds, ...names])], front = n => String(n).split(" // ")[0];
  const gcs = all.filter(n => GAME_CHANGERS.has(n) || GAME_CHANGERS.has(front(n)));
  const mld = all.filter(n => MLD_NAMED.has(front(n)) || (MLD_RE.test(lookup(n)?.o || "") && !/search (?:their|your) library for (?:up to \w+ )?basic land/i.test(lookup(n)?.o || ""))); // lands that get replaced (From the Ashes) don't count
  const xt = all.filter(n => XTURN_RE.test(lookup(n)?.o || "") && !/\bopponent\b[^.]*takes? an extra turn/i.test(lookup(n)?.o || ""));
  const dc = deckCombos(all, cmds);
  const two = (dc?.full || []).filter(c => c.pieces.length === 2 && c.feats.some(f => /^(?:infinite|win the game|each opponent loses the game)/i.test(f)));
  const reasons = []; let min = 2;
  if (gcs.length > 3) { min = 4; reasons.push(`${gcs.length} Game Changers (Bracket 3 allows up to 3)`); }
  else if (gcs.length) { min = Math.max(min, 3); reasons.push(`${gcs.length} Game Changer${gcs.length === 1 ? "" : "s"} (Brackets 1–2 allow none)`); }
  if (mld.length) { min = 4; reasons.push("mass land denial (only Bracket 4 and up)"); }
  if (two.length) { min = Math.max(min, 3); reasons.push(`${two.length} two-card combo${two.length === 1 ? "" : "s"} (none intended in Brackets 1–2; Bracket 3 not early-game)`); }
  if (xt.length > 2) reasons.push(`${xt.length} extra-turn cards (Brackets 1–3 expect few, not chained)`);
  return { min, gcs, mld, xt, two, reasons, comboData: !!dc };
}
export const comboDataInfo = () => CSB ? { combos: CSB.data.combos.length, ts: CSB.data.ts } : null;
// A piece's state from Spellbook ("without summoning sickness", "with two or more charge counters on it"…), checked
// against what the app tracks. Returns null when the board says it can't work yet (counters, level, chosen type),
// or a list of things still to check (summoning sickness, tapped, attached, paired, exiled with, anything else).
function csbState(code, name, n, zones, bfE, p, ctx) {
  const zone = zones.B.has(n) && /(?:^|\|)B=/.test(code) ? "B" : zones.E.has(n) && /(?:^|\|)E=/.test(code) ? "E" : zones.G.has(n) && /(?:^|\|)G=/.test(code) ? "G" : null;
  if (!zone) return [];
  const clauses = (code.split("|").find(x => x.startsWith(zone + "=")) || "").slice(2);
  if (!clauses) return [];
  if (clauses.startsWith("?")) return [`${name} ${clauses.slice(1).replace(/~/g, name)}`];
  const cands = zone === "B" ? bfE.filter(([, e]) => csbNorm(e.n) === n) : zone === "E" ? Object.entries(p.ex || {}).filter(([, e]) => csbNorm(e.n) === n) : Object.entries(p.gy || {}).filter(([, e]) => csbNorm(e.n) === n);
  const hostOf = id => p.bf?.[id]?.n || "";
  const cnt = (e, lab) => { const k = counterKey(lab), l = String(lab).toLowerCase(); return Number(e?.c?.[k] ?? e?.c?.[l] ?? e?.c?.["x_" + l] ?? (l === "loyalty" ? e?.loy : 0) ?? 0) || 0; };
  const tests = clauses.split(";").map(cl => { const [t, ...a] = cl.split(":"); return { t, a: a.join(":") }; });
  let best = null;
  for (const [id, e] of (cands.length ? cands : [[null, null]])) {
    let hard = true; const soft = [];
    for (const { t, a } of tests) {
      if (t === "c") { const [lab, op, v] = a.split(":"), x = cnt(e, lab), want = Number(v); if (!(op === ">=" ? x >= want : op === "<=" ? x <= want : op === "<" ? x < want : x === want)) hard = false; }
      else if (t === "lvl") { if (Math.max(Number(e?.lvl) || 1, cnt(e, "level")) < Number(a)) hard = false; }
      else if (t === "ch") { if (e?.ctype) { if (String(e.ctype).toLowerCase() !== a.toLowerCase()) hard = false; } else soft.push(`"${a}" chosen for ${name}`); }
      else if (t === "ns") { if (id && ctx.sick?.(id)) soft.push(`${name} to lose summoning sickness (next turn)`); }
      else if (t === "tap") { if (!e?.tap) soft.push(`${name} tapped`); }
      else if (t === "untap") { if (e?.tap) soft.push(`${name} untapped`); }
      else if (t === "att") { if (!e?.att || (a && csbNorm(hostOf(e.att)) !== csbNorm(a))) soft.push(`${name} attached to ${a || "a creature"}`); }
      else if (t === "pair") { if (!e?.pair || (a && csbNorm(hostOf(e.pair)) !== csbNorm(a))) soft.push(`${name} paired with ${a || "a creature"}`); }
      else if (t === "exby") { if (!bfE.some(([, h]) => csbNorm(h.n) === csbNorm(a) && (h.imprints || String(h.imprint || "").split(", ")).some(x => csbNorm(x) === n))) soft.push(`${name} exiled with ${a}`); }
    }
    if (hard && (!best || soft.length < best.length)) best = soft;
  }
  return best;
}
const CSB_WIN = /^(?:win the game|each opponent loses the game|infinite lifeloss|infinite damage to opponents|infinite damage)$/i;
function csbFor(p, ctx, hand) {
  const nm = x => csbNorm(x?.n ?? x);
  const bfE = Object.entries(p.bf || {}).filter(([, e]) => !e.tok);
  const imprinted = bfE.flatMap(([, e]) => e.imprints || (e.imprint ? String(e.imprint).split(", ") : []));
  const zones = { B: new Set(bfE.map(([, e]) => nm(e))), H: new Set((ctx.hand || []).map(nm)), G: new Set(Object.values(p.gy || {}).map(nm)), E: new Set([...Object.values(p.ex || {}).map(nm), ...imprinted.map(nm)]), C: new Set() };
  const cmds = new Set((ctx.cmds || []).map(nm));
  cmds.forEach(n => { if (!zones.B.has(n) && !zones.G.has(n) && !zones.E.has(n)) zones.C.add(n); });
  const sig = ["B", "H", "G", "E", "C"].map(z => [...zones[z]].sort().join("|")).join("#") + "#" + [...cmds].sort().join("|") + "#" + hand.map(c => c.key).sort().join("|")
    + "#" + bfE.filter(([, e]) => CSB.by.has(nm(e))).map(([id, e]) => `${nm(e)}:${JSON.stringify([e.c || 0, e.lvl || 0, e.ctype || 0, e.att ? p.bf?.[e.att]?.n || 1 : 0, e.pair ? p.bf?.[e.pair]?.n || 1 : 0, e.tap ? 1 : 0, ctx.sick?.(id) ? 1 : 0, e.imprints || e.imprint || 0])}`).sort().join("|");
  const hit = CSB.memo.get(sig); if (hit) return hit;
  const { data, names } = CSB, cand = new Set();
  for (const z of Object.values(zones)) for (const n of z) (CSB.by.get(n) || []).forEach(i => cand.add(i));
  const found = [];
  for (const i of cand) {
    const row = data.combos[i], k = row[row.length - 1]; let ok = true;
    for (let j = 0; j < k && ok; j++) { const n = names[row[j]], m = row[k + j];
      ok = !!((m & 1 && zones.B.has(n)) || (m & 2 && zones.H.has(n)) || (m & 4 && zones.G.has(n)) || (m & 8 && zones.E.has(n)) || (m & 16 && zones.C.has(n))) && (!(m & 64) || cmds.has(n)); }
    if (!ok) continue;
    const wait = [];
    const sts = data.st?.[i];
    if (sts) for (let j = 0; j < k && ok; j++) { const code = data.states[sts[j]]; if (code) { const r = csbState(code, data.cards[row[j]][0], names[row[j]], zones, bfE, p, ctx); if (!r) ok = false; else wait.push(...r); } }
    if (ok) found.push({ i, wait, set: new Set(row.slice(0, k).map(x => names[x])), feats: row.slice(2 * k, row.length - 1).map(f => data.feats[f]) });
  }
  // already covered by one of the app's own combo alerts (theirs do more: Loop buttons, conditions)
  const own = hand.map(c => new Set((c.pieces || String(c.name || "").split(" + ")).map(csbNorm)));
  const sub = (a, b) => [...a].every(x => b.has(x));
  let list = found.filter(f => !own.some(o => o.size && sub(o, f.set)));
  // a bigger version of a smaller combo that's also here, adding nothing new, is left out
  list = list.filter(f => !list.some(g => g !== f && g.set.size < f.set.size && sub(g.set, f.set) && f.feats.every(x => g.feats.includes(x))));
  list.sort((a, b) => a.set.size - b.set.size || b.feats.some(x => CSB_WIN.test(x)) - a.feats.some(x => CSB_WIN.test(x)));
  const res = list.slice(0, 8).map(f => { const row = data.combos[f.i], k = row[row.length - 1], cards = row.slice(0, k).map(x => data.cards[x]);
    const id = cards.map(c => c[1]).join("-"), note = CSB.notes?.[f.i];
    return { key: `csb:${id}`, name: cards.map(c => c[0]).join(" + "), pieces: cards.map(c => c[0]), win: f.feats.some(x => CSB_WIN.test(x)), kind: "info", csb: id,
      desc: `${f.feats.join(" · ")}.${note ? ` Needs: ${note}` : ""}`, wait: f.wait.length ? f.wait : null, more: list.length > 8 && f === list[7] ? list.length - 8 : 0 }; });
  if (CSB.memo.size > 300) CSB.memo.clear();
  CSB.memo.set(sig, res);
  return res;
}
