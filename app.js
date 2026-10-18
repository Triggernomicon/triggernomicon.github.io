import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase, ref, set, get, update, onValue, push, remove, query, orderByChild, endAt } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { firebaseConfig } from "./config.js?v=20261018d";
import { playVictory, playKO, unlockAudio, playTurnChime } from "./sounds.js?v=20261018d";
import { permanentMatches, stationCard, singular } from "./engine.js?v=20261018d";
import { runEvents, countOf, abilitiesOf, describeAbilities, countsFor, isCreatureToken, noteTokenKind, entersTapped, spellAbility, activatedAbilities, TOKEN_USES, entersWithCounters, matchesSearch, manaValue, countTypes, clearAbilityCaches, entersInstead, activationCondition, suspendOf, winRule, evalWin, pactOf, loseEffect, damageLoses, overloadOf, addlSacOf, drawCount, counterOf, counterMatches, answerKind, staticRules, spellMatches, adjustCost, boardRules, permanentMatches as permMatch, oppPickOf, auraStealOf, devotion, tokenPerm, tokenPT, counterTokens, tidyTokenStacks, blanketLines, staticBuffs, ownKeywords, parseTargetFilter, attachBuff, grantedLand, enchantType, equipCost, sagaChapters, selfBuff, grantedMana, hitTriggers, myriadCount, setTypeAdds, vanishingOf, hasStorm, firebendingOf, foretellOf, isChangeling, changelingHas, bigHitTriggers, crewOf, detectCombos } from "./engine.js?v=20261018d";

// ---------- Settings ----------
const START_LIFE = 40;
const MAX_PLAYERS = 6;
const COLORS = ["#e05252", "#4f8ef7", "#3fb37f", "#e3a33b", "#a46ee8", "#e46fb0"];
const TOKEN_PRESETS = ["Treasure", "Food", "Clue", "Blood", "Squirrel", "Soldier", "Zombie", "Spirit", "Goblin", "Saproling", "Thopter", "Elf Warrior"];
// turnOnly: always clears at end of turn. ongoing: stays until removed. Otherwise the phone asks.
const EFFECTS = [
  { key: "fog", name: "Fog (no combat damage)", icon: "🌫️", turnOnly: true },
  { key: "indestructible", name: "Indestructible", icon: "🛡️" },
  { key: "hexproof", name: "Hexproof", icon: "🔰" },
  { key: "shroud", name: "Shroud", icon: "🌑" },
  { key: "protection", name: "Protection", icon: "✨" },
  { key: "preventall", name: "Prevent all damage", icon: "⛔" },
  { key: "cantlose", name: "Can't lose", icon: "♾️" },
  { key: "monarch", name: "Monarch", icon: "👑", exclusive: true, ongoing: true },
  { key: "initiative", name: "Initiative", icon: "🗝️", exclusive: true, ongoing: true },
  { key: "blessing", name: "City's Blessing", icon: "🏙️", ongoing: true },
];
// Counters that sit on the player
const PLAYER_COUNTERS = [
  { k: "poison", label: "☠ Poison", lethal: 10 },
  { k: "energy", label: "⚡ Energy" },
  { k: "experience", label: "🎓 Experience" },
  { k: "rad", label: "☢ Rad" },
];
// Counters that sit on permanents
const COUNTERS = [
  { k: "p1p1", label: "+1/+1" },
  { k: "m1m1", label: "−1/−1" },
  { k: "loyalty", label: "Loyalty" },
  { k: "charge", label: "Charge" },
  { k: "shield", label: "Shield" },
  { k: "stun", label: "Stun" },
  { k: "oil", label: "Oil" },
  { k: "lore", label: "Lore" },
  { k: "time", label: "Time" },
];
const effectDef = k => EFFECTS.find(e => e.key === k);
// Dungeons (venture / initiative)
const DUNGEONS = {
  lmop: { name: "Lost Mine of Phandelver", rooms: [
    { n: "Cave Entrance", o: "Scry 1.", next: [1, 2] },
    { n: "Goblin Lair", o: "Create a 1/1 red Goblin creature token.", next: [3, 4] },
    { n: "Mine Tunnels", o: "Create a Treasure token.", next: [4, 5] },
    { n: "Storeroom", o: "Put a +1/+1 counter on target creature.", next: [6] },
    { n: "Dark Pool", o: "Each opponent loses 1 life and you gain 1 life.", next: [6] },
    { n: "Fungi Cavern", o: "Target creature gets -4/-0 until your next turn.", next: [6] },
    { n: "Temple of Dumathoin", o: "Draw a card.", next: [] } ] },
  mad: { name: "Dungeon of the Mad Mage", rooms: [
    { n: "Yawning Portal", o: "You gain 1 life.", next: [1] },
    { n: "Dungeon Level", o: "Scry 1.", next: [2, 3] },
    { n: "Goblin Bazaar", o: "Create a Treasure token.", next: [4] },
    { n: "Twisted Caverns", o: "Target creature can't attack until your next turn.", next: [4] },
    { n: "Lost Level", o: "Scry 2.", next: [5, 6] },
    { n: "Runestone Caverns", o: "Exile the top two cards of your library. You may play them.", next: [7] },
    { n: "Muiral's Graveyard", o: "Create two 1/1 black Skeleton creature tokens.", next: [7] },
    { n: "Deep Mines", o: "Scry 3.", next: [8] },
    { n: "Mad Wizard's Lair", o: "Draw three cards and reveal them. You may cast one of them without paying its mana cost.", next: [] } ] },
  tomb: { name: "Tomb of Annihilation", rooms: [
    { n: "Trapped Entry", o: "Each player loses 1 life.", next: [1, 2] },
    { n: "Veils of Fear", o: "Each player loses 2 life unless they discard a card.", next: [3] },
    { n: "Oubliette", o: "Discard a card and sacrifice an artifact, a creature, and a land.", next: [4] },
    { n: "Sandfall Cell", o: "Each player loses 2 life unless they sacrifice an artifact, a creature, or a land.", next: [4] },
    { n: "Cradle of the Death God", o: "Create a 4/4 black God Horror creature token with deathtouch.", next: [] } ] },
  under: { name: "Undercity", rooms: [
    { n: "Secret Entrance", o: "Search your library for a basic land card, reveal it, put it into your hand, then shuffle.", next: [1, 2] },
    { n: "Forge", o: "Put two +1/+1 counters on target creature.", next: [3, 4] },
    { n: "Lost Well", o: "Scry 2.", next: [4, 5] },
    { n: "Trap!", o: "Target player loses 5 life.", next: [6] },
    { n: "Arena", o: "Goad target creature.", next: [6] },
    { n: "Stash", o: "Create a Treasure token.", next: [6] },
    { n: "Archives", o: "Draw a card.", next: [7] },
    { n: "Catacombs", o: "Create a 4/1 black Skeleton creature token with menace.", next: [8] },
    { n: "Throne of the Dead Three", o: "Reveal the top ten cards of your library. Put a creature card from among them onto the battlefield with three +1/+1 counters on it. It gains hexproof until your next turn. Then shuffle.", next: [] } ] },
};
const SCRYFALL = "https://api.scryfall.com";

// ---------- Helpers ----------
const app = document.getElementById("app");
const params = new URLSearchParams(location.search);
let db;

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const clone = o => JSON.parse(JSON.stringify(o ?? {}));
const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "x";
const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const joinUrl = code => `${location.origin}${location.pathname}?room=${code}`;
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
  del(k) { try { localStorage.removeItem(k); } catch { /* private mode */ } },
};

function toast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg; t.style.display = "block";
  clearTimeout(toast.timer); toast.timer = setTimeout(() => (t.style.display = "none"), 5000);
}
window.addEventListener("unhandledrejection", e => toast(e.reason?.message || "Something went wrong."));

function seated(room) {
  return Object.entries(room?.players || {}).map(([id, p]) => ({ id, ...p })).sort((a, b) => (a.seat ?? 0) - (b.seat ?? 0));
}
function isOut(p) {
  if (p.lost) return true;
  if (p.effects?.cantlose || Object.values(p.bf || {}).some(e => /you can't lose the game/i.test(e.o || ""))) return false;
  const unlife = Object.values(p.bf || {}).some(e => /don't lose the game for having 0 or less life/i.test(e.o || ""));
  return (!unlife && (p.life ?? START_LIFE) <= 0) || (p.poison || 0) >= 10 || Object.values(p.cmd || {}).some(n => n >= 21);
}
// Why a player is out, in a few words
function outReason(p, ps = []) {
  if (p.lost) return p.lost.reason;
  if ((p.poison || 0) >= 10) return "10 poison counters";
  const k = Object.entries(p.cmd || {}).find(([, n]) => n >= 21);
  if (k) { const [oid, sl] = k[0].split("~"); const o = ps.find(x => x.id === oid); return `21 commander damage${o ? ` from ${o.name}` : ""}${sl ? `'s ${sl.split("-")[0].replace(/^\w/, c => c.toUpperCase())}` : ""}`; }
  return "life hit 0";
}
function logTo(code, text) { try { window.__onMyLog?.(text); } catch {} return push(ref(db, `rooms/${code}/log`), { t: Date.now(), text }); }

function makeCode() {
  const L = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  return Array.from({ length: 4 }, () => L[Math.floor(Math.random() * L.length)]).join("");
}

// ---------- Card helpers ----------
function counterLabel(k) {
  const c = COUNTERS.find(x => x.k === k);
  if (c) return c.label;
  return k.replace(/^x_/, "").replace(/-/g, " ").replace(/\b\w/g, m => m.toUpperCase());
}
function group(e) {
  const t = e.t || "";
  if (/\bCreature\b/.test(t)) return "creature";
  if (/\bPlaneswalker\b/.test(t)) return "pw";
  if (/\bLand\b/.test(t)) return "land";
  return "other";
}
const isSpell = c => /\b(Instant|Sorcery)\b/.test(c.t || "") && !/\b(Creature|Land|Artifact|Enchantment)\b/.test(c.t || "");
const shortType = t => (t || "").split(" // ")[0].split(" — ")[0];
// Mindslaver-style control of another player's turn
const controlText = c => !c ? "" : c.active ? `🎮 ${c.byName} controls ${c.targetName}'s turn (${c.src})` : `🎮 ${c.byName} will control ${c.targetName}'s next turn (${c.src})`;
// Every always-on effect on anyone's battlefield, for the TV banner and the phones' "In play" list
function effectsInPlay(room) {
  const out = [];
  seated(room || {}).filter(o => !isOut(o)).forEach(o => Object.values(o.bf || {}).forEach(e => {
    const lines = blanketLines(e);
    if (!lines.length) return;
    out.push({ src: dispName(e), owner: o, lines, off: e.tap && lines.some(l => /^as long as [^,]+ is untapped/i.test(l)) });
  }));
  // whole-table effects first, then "you control" ones
  const scope = x => x.lines.some(l => !/\byou control\b|^your\b|^you\b/i.test(l)) ? 0 : 1;
  out.sort((a, b) => scope(a) - scope(b));
  // spells that last this turn (Silence, Fog…): shown first
  const now = room?.turnNo || 0, seat = seated(room || {}), ps = Object.fromEntries(seat.map(o => [o.id, o])), byName = n => seat.find(o => o.name === n) || { id: "", name: n || "?", color: "#888" };
  const turnFx = [];
  if (room?.silence && room.silence.turnNo === now) turnFx.push({ src: room.silence.src, owner: ps[room.silence.by] || byName(room.silence.byName), thisTurn: true,
    lines: [room.silence.target ? `${ps[room.silence.target]?.name || "That player"} can't cast spells this turn.` : `${room.silence.byName}'s opponents can't cast spells this turn.`] });
  if (room?.fog && room.fog.turnNo === now) turnFx.push({ src: room.fog.src, owner: byName(room.fog.by), thisTurn: true,
    lines: [room.fog.oppsOf ? `Prevent all damage creatures ${ps[room.fog.oppsOf]?.name || "their"}'s opponents control would deal this turn.` : room.fog.except ? `Prevent all combat damage this turn except by ${room.fog.except} creatures.` : room.fog.onlyName ? `Prevent all combat damage ${room.fog.onlyName} would deal this turn.` : "Prevent all combat damage this turn."] });
  return [...turnFx, ...out];
}
// ----- Turn steps (shown under the tabs and on the TV) -----
const STEPS = ["Upkeep", "Draw", "Main 1", "Combat", "Main 2", "End"];
const stepOf = room => room?.step?.turnNo === (room?.turnNo || 0) ? room.step.i : 0;
let tableStep = "", tableTypeAdds = [], tableTurn = null;
let mustAtkSeen = null;
// Humility-style "base power and toughness 1/1" in play anywhere at the table (set on every room update)
let tablePT = null, tableBuffs = [], tableLose = [], tablePlayers = {}, tableSpoil = {}, tableTurnNo = 0;
// Celebration: two or more nonland permanents entered under that player's control this turn
const celebrating = o => { if (!o) return false; const n = Object.values(o.bf || {}).filter(e => (e.et || 0) === tableTurnNo && !/\bLand\b/.test(e.t || "")).length + Object.values(o.tokens || {}).reduce((a, t) => a + (t.fresh?.turnNo === tableTurnNo ? t.fresh.n || 0 : 0), 0); return n >= 2; };
const CELEB_FORM = /^celebration — as long as two or more nonland permanents entered the battlefield under your control this turn, [^\n]*?is an? [A-Z][a-z]+ with base power and toughness (\d+)\/(\d+)(, flying)?/im;
function updateTablePT(room) {
  tablePT = null; tableBuffs = []; tableLose = []; tablePlayers = {}; tableSpoil = {};
  seated(room || {}).forEach(o => { if (o.spoil && o.spoil.turnNo === (room?.turnNo || 0)) tableSpoil[o.id] = o.spoil.pt; });
  tableStep = room?.turn ? STEPS[stepOf(room)] : ""; tableTurn = room?.turn || null; tableTurnNo = room?.turnNo || 0;
  tableCombat = `${room?.turnNo || 0}:${room?.step?.turnNo === (room?.turnNo || 0) ? room.step.extra || 0 : 0}`;
  // Yavimaya: "Each land is a Forest in addition to its other land types"
  const adds = [];
  seated(room || {}).filter(o => !isOut(o)).forEach(o => Object.values(o.bf || {}).forEach(e => { const m = String(e.o || "").match(/^each land is an? (Plains|Island|Swamp|Mountain|Forest) in addition to its other land types/im); if (m) adds.push({ to: "Land", add: m[1], src: dispName(e) }); }));
  setTypeAdds(adds); tableTypeAdds = adds;
  const live = seated(room || {}).filter(o => !isOut(o));
  live.forEach(o => { tablePlayers[o.id] = o; Object.values(o.bf || {}).forEach(e => boardRules(e.o).forEach(r => { if (r.kind === "loseAll") { tableLose.push(r.filter); if (r.pt) tablePT = r.pt; } })); });
  const lost = e => tableLose.some(f => permanentMatches(e, f));
  live.forEach(o => Object.entries(o.bf || {}).forEach(([id, e]) => { if (!lost(e)) staticBuffs(e).forEach(b => {
    if (b.cond && (e.c?.[b.cond.key] || 0) < b.cond.n) return;
    if (b.chosenColor) { if (!e.color) return; b = { ...b, filter: parseTargetFilter(`${e.color} creature`) }; } // Caged Sun
    if (b.perCtr) { const k = e.c?.[b.perCtr] || 0; if (!k) return; b = { ...b, dp: b.dp * k, dt: b.dt * k }; } // Chitterspitter
    if (b.condGy && Object.keys(o.gy || {}).length < b.condGy) return; // Threshold: Nut Collector
    if (b.condTypes && new Set(Object.values(o.gy || {}).flatMap(c => ["Artifact", "Battle", "Creature", "Enchantment", "Instant", "Kindred", "Land", "Planeswalker", "Sorcery"].filter(t => new RegExp(`\\b${t}\\b`).test(c.t || "")))).size < b.condTypes) return; // Delirium
    tableBuffs.push({ ownerId: o.id, srcId: id, src: dispName(e), b });
  }); }));
}
// ----- Auras and Equipment: what's attached to what -----
const attCache = new Map(), sbCache = new Map();
const sbOf = e => { const k = e.n + "|" + e.o; if (!sbCache.has(k)) sbCache.set(k, selfBuff(e)); return sbCache.get(k); };
const attOf = e => { const k = e.n + "|" + (e.o || ""); if (!attCache.has(k)) attCache.set(k, attachBuff(e)); return attCache.get(k); };
// Sword of the Squeak: creatures you control with base power or toughness 1
function base1Count(p) {
  const cards = Object.values(p?.bf || {}).filter(e => /\bCreature\b/.test(e.t || "") && (e.p === "1" || e.tg === "1")).length;
  const toks = Object.values(p?.tokens || {}).filter(t => isCreatureToken(t.name) && (() => { const m = String(t.desc || "").match(/(\d+)\/(\d+)/); return !m || m[1] === "1" || m[2] === "1"; })()).reduce((a, t) => a + (t.count || 0), 0);
  return cards + toks;
}
const eqList = t => String(t?.eq || "").split("+").filter(Boolean);
// Auras / Equipment on this permanent (a card id) or token stack (its eq list)
function attachedTo(owner, id, isToken, e) {
  return Object.entries(owner?.bf || {}).filter(([sid, a]) => a.att && (isToken ? eqList(e).includes(sid) : a.att === id));
}
// What an Aura / Equipment is on: a name for display
function hostName(owner, sid) {
  const a = owner?.bf?.[sid];
  if (!a?.att) return "";
  if (a.att === "tok") { const t = Object.values(owner.tokens || {}).find(x => eqList(x).includes(sid)); return t ? `${t.name} token` : ""; }
  return owner.bf[a.att] ? dispName(owner.bf[a.att]) : "";
}

// What anthems / keyword grants on the table do to this permanent (or token stack)
// Coat of Arms: +1/+1 for each other creature on the battlefield that shares a creature type with it
function coatOf(e, id, isToken) {
  const coats = Object.values(tablePlayers).reduce((a, o) => a + Object.values(o.bf || {}).filter(x => /each creature gets \+1\/\+1 for each other creature on the battlefield that shares at least one creature type with it/i.test(x.o || "")).length, 0);
  if (!coats || !(isToken || /\bCreature\b/.test(e.t || ""))) return 0;
  const sub = t => (String(t || "").split(" — ")[1] || "").split(/\s+/).filter(Boolean);
  const cl = x => /\bchangeling\b/i.test(x.o || "") || /\bShapeshifter\b/.test(x.t || "") && /changeling/i.test(x.o || "");
  const mine = sub(e.t), all = cl(e);
  let k = 0;
  Object.values(tablePlayers).forEach(o => {
    Object.entries(o.bf || {}).forEach(([bid, x]) => { if (bid === id || !/\bCreature\b/.test(x.t || "")) return; if (all || cl(x) || sub(x.t).some(s => mine.includes(s))) k++; });
    Object.entries(o.tokens || {}).forEach(([tk, t]) => { if (!isCreatureToken(t.name)) return; const tt = sub(`Token Creature — ${t.name}`); const n = (t.count || 0) - (tk === id ? 1 : 0); if (n > 0 && (all || tt.some(s => mine.includes(s)))) k += n; });
  });
  return k * coats;
}
function p1p1Creatures(o) {
  return Object.values(o?.bf || {}).filter(x => /\bCreature\b/.test(x.t || "") && (x.c?.p1p1 || 0) > 0).length + Object.values(o?.tokens || {}).filter(t => isCreatureToken(t.name) && (t.c?.p1p1 || 0) > 0).reduce((a, t) => a + (t.count || 0), 0);
}
// buffsOn is pure for one render pass; memoize it there (big token boards call it thousands of times)
let BUFF_CACHE = null;
function buffsOn(e, ownerId, id, isToken) {
  if (BUFF_CACHE && id != null) { const key = `${ownerId}|${id}|${isToken ? 1 : 0}|${e?.n || e?.name || ""}|${(e?.ep || []).length}`, hit = BUFF_CACHE.get(key);
    if (hit) return { dp: hit.dp, dt: hit.dt, kws: [...hit.kws], from: [...hit.from] };
    const r = buffsOn0(e, ownerId, id, isToken); BUFF_CACHE.set(key, r); return { dp: r.dp, dt: r.dt, kws: [...r.kws], from: [...r.from] }; }
  return buffsOn0(e, ownerId, id, isToken);
}
function buffsOn0(e, ownerId, id, isToken) {
  const out = { dp: 0, dt: 0, kws: [], from: [] };
  if (!ownerId) return out;
  if (e?.adj && (e.adj.p || e.adj.t)) { out.dp += e.adj.p || 0; out.dt += e.adj.t || 0; out.from.push({ src: "manual adjustment", dp: e.adj.p || 0, dt: e.adj.t || 0 }); } // ✎ set by hand on the phone
  { const k = coatOf(e, id, isToken); if (k) { out.dp += k; out.dt += k; out.from.push({ src: "Coat of Arms", dp: k, dt: k }); } }
  { const o = String(e.o || ""), ow = tablePlayers[ownerId];
    const sa = o.match(/as long as you have (\d+) or more life, this creature gets \+(\d+)\/\+(\d+)(?: and has ([a-z ]+))?/i);
    if (sa && ow && (ow.life ?? 40) >= Number(sa[1])) { out.dp += Number(sa[2]); out.dt += Number(sa[3]); out.from.push({ src: `itself (${sa[1]}+ life)`, dp: Number(sa[2]), dt: Number(sa[3]) }); if (sa[4]) out.kws.push({ k: sa[4].trim(), src: "itself" }); }
    const cd = o.match(/as long as you've completed a dungeon, this creature gets \+(\d+)\/\+(\d+)(?: and has ([a-z ]+))?/i);
    if (cd && ow?.dgDone) { out.dp += Number(cd[1]); out.dt += Number(cd[2]); out.from.push({ src: "itself (dungeon completed)", dp: Number(cd[1]), dt: Number(cd[2]) }); if (cd[3]) out.kws.push({ k: cd[3].trim(), src: "itself" }); }
    if (ow && /\bCreature\b/.test(e.t || "") || isToken) Object.entries(ow?.bf || {}).forEach(([lid, l]) => { if (lid === id) return; const m = String(l.o || "").match(/other creatures you control get \+(\d+)\/\+(\d+) as long as you've completed a dungeon/i); if (m && ow.dgDone) { out.dp += Number(m[1]); out.dt += Number(m[2]); out.from.push({ src: l.n, dp: Number(m[1]), dt: Number(m[2]) }); } });
    const cb = o.match(/this creature gets \+(\d+)\/\+(\d+) as long as you have the city's blessing/i);
    if (cb && ow?.effects?.blessing) { out.dp += Number(cb[1]); out.dt += Number(cb[2]); out.from.push({ src: "itself (city's blessing)", dp: Number(cb[1]), dt: Number(cb[2]) }); }
    if (ow && /\bHuman\b/.test(e.t || "")) Object.values(ow.bf || {}).forEach(l => { const lo = String(l.o || "");
      if (l.chosenKw && /^Humans you control have each of the chosen abilities\.?$/m.test(lo)) l.chosenKw.split(",").forEach(k => out.kws.push({ k, src: l.n }));
      const hm = lo.match(/as long as you control (four|five|three|\d+) or more Humans, Humans you control get \+(\d+)\/\+(\d+)/i);
      if (hm && Object.values(ow.bf || {}).filter(x => /\bHuman\b/.test(x.t || "") && /\bCreature\b/.test(x.t || "")).length + Object.values(ow.tokens || {}).filter(t => /\bHuman\b/.test(`${t.name} ${t.desc || ""}`)).reduce((a, t) => a + (t.count || 0), 0) >= ({ three: 3, four: 4, five: 5 }[hm[1].toLowerCase()] || Number(hm[1]))) { out.dp += Number(hm[2]); out.dt += Number(hm[3]); out.from.push({ src: l.n, dp: Number(hm[2]), dt: Number(hm[3]) }); } });
    const zb = o.match(/gets \+X\/\+0, where X is the number of other creatures you control with base power (\d+)/i);
    if (zb && ow) { const want = zb[1], n = Object.entries(ow.bf || {}).filter(([xid, x]) => x !== e && xid !== id && /\bCreature\b/.test(x.t || "") && String(x.p) === want).length + Object.values(ow.tokens || {}).filter(t => isCreatureToken(t.name) && (String(t.desc || "").match(/(\d+|X)\/(\d+|X)/) || [])[1] === want).reduce((a, t) => a + (t.count || 1), 0); if (n) { out.dp += n; out.from.push({ src: `itself (${n} with base power ${want})`, dp: n, dt: 0 }); } }
    const dv = o.match(/^this creature gets \+(\d+)\/\+(\d+) as long as you control an? ([A-Z][a-z]+)\.?$/m);
    if (dv && ow && [...Object.values(ow.bf || {}).filter(x => x !== e).map(x => x.t || ""), ...Object.values(ow.tokens || {}).map(t => `Token Creature — ${t.name}`)].some(t => new RegExp(`\\b${dv[3]}\\b`).test(t))) { out.dp += Number(dv[1]); out.dt += Number(dv[2]); out.from.push({ src: `itself (${dv[3]})`, dp: Number(dv[1]), dt: Number(dv[2]) }); } }
  if (/\bCreature\b/.test(e.t || "") || isToken) Object.entries(tablePlayers[ownerId]?.bf || {}).forEach(([hid, x]) => { if (hid === id) return; const m = String(x.o || "").match(/^each other creature you control that's an? ([A-Z][a-z]+) or ([A-Z][a-z]+) gets \+X\/\+X, where X is the number of counters on/m); if (!m) return;
    const t = isToken ? `Token Creature — ${e.name || e.n}` : e.t || ""; if (!new RegExp(`\\b(${m[1]}|${m[2]})\\b`).test(t)) return; const k = Object.values(x.c || {}).reduce((a, v) => a + (v > 0 ? v : 0), 0); if (k) { out.dp += k; out.dt += k; out.from.push({ src: x.n, dp: k, dt: k }); } });
  if (/\bCreature\b/.test(e.t || "") || isToken) { const ow = tablePlayers[ownerId], has = isToken ? eqList(ow?.tokens?.[id] || e).length > 0 : Object.values(ow?.bf || {}).some(a => a.att === id);
    if (has) Object.values(ow?.bf || {}).forEach(x => { const m = String(x.o || "").match(/creatures you control that are (?:enchanted or equipped|equipped or enchanted|equipped|enchanted) have ([a-z ,]+?)\.?(?:\n|$)/im); if (m) m[1].split(/,\s*|\s+and\s+/).filter(Boolean).forEach(k => out.kws.push({ k: k.trim(), src: x.n })); }); }
  if ((e.c?.p1p1 || 0) > 0) Object.values(tablePlayers[ownerId]?.bf || {}).forEach(x => { const m = String(x.o || "").match(/^each creature you control with a \+1\/\+1 counter on it has ([a-z ,]+?)\.?$/im); if (m) m[1].split(/,\s*|\s+and\s+/).filter(Boolean).forEach(k => out.kws.push({ k: k.trim(), src: x.n })); });
  tableBuffs.forEach(({ ownerId: oid, srcId, src, b }) => {
    if (b.scope === "you" && oid !== ownerId) return;
    if (b.yourTurn && tableTurn !== oid) return;
    if (b.scope === "opp" && oid === ownerId) return;
    if (b.other && srcId === id && oid === ownerId) return;
    if (b.tokenOnly && !isToken && !e.tok) return;
    if (!permanentMatches(e, b.filter)) return;
    out.dp += b.dp; out.dt += b.dt;
    if (b.dp || b.dt) out.from.push({ src, dp: b.dp, dt: b.dt });
    b.kws.forEach(k => out.kws.push({ k, src }));
  });
  // Note: Firebase drops empty arrays, so an epTag entry saved with ids: [] comes back with no ids at all; it must still mean "no nontoken creatures"
  Object.entries(tablePlayers[ownerId]?.eot || {}).forEach(([eid, x]) => { // until end of turn (Giant Growth, Overrun, Craterhoof)
    const tokHit = () => x.epTag ? (e.ep || []).includes(eid) : (x.toks || []).some(k => id === k || String(id).startsWith(k + "~"));
    const hit = x.target ? (!isToken && x.target === id) : x.token ? (isToken && x.token === id) : ((x.filter ? permanentMatches(e, x.filter) : true) && x.other !== id && (x.perm || /\bCreature\b/.test(e.t || "")) && (x.epTag ? (isToken ? tokHit() : (x.ids || []).includes(id)) : (!x.ids || (isToken ? tokHit() : x.ids.includes(id)))));
    if (!hit) return;
    out.dp += x.dp; out.dt += x.dt;
    if (x.dp || x.dt) out.from.push({ src: `${x.src} (this turn)`, dp: x.dp, dt: x.dt });
    (x.kws || []).forEach(k => out.kws.push({ k, src: `${x.src} (this turn)` }));
  });
  const owner = tablePlayers[ownerId];
  const sb = !isToken && e.o ? sbOf(e) : null; // Squirrel Mob: +1/+1 for each other Squirrel
  if (sb?.gy) {
    const k = Object.values(owner?.gy || {}).filter(c => !sb.types.length || sb.types.some(t => new RegExp(`\\b${t}`, "i").test(c.t || ""))).length;
    if (k > 0) { out.dp += sb.dp * k; out.dt += sb.dt * k; out.from.push({ src: `itself (${k} ${sb.types.join("/") || ""} card${k === 1 ? "" : "s"} in graveyard)`, dp: sb.dp * k, dt: sb.dt * k }); }
  } else if (sb) {
    const pool = sb.all ? Object.values(tablePlayers) : [owner].filter(Boolean);
    let k = pool.reduce((a, o) => a + countTypes(o, sb.types), 0);
    if (sb.other && sb.types.some(t => new RegExp(`\\b${t}`, "i").test(e.t || "") || changelingHas(e, t))) k -= 1;
    if (k > 0) { out.dp += sb.dp * k; out.dt += sb.dt * k; out.from.push({ src: `itself (${k} ${sb.types.join("/")})`, dp: sb.dp * k, dt: sb.dt * k }); }
  }
  attachedTo(owner, id, isToken, e).forEach(([, a]) => { // Equipment / Auras on it
    const ab = attOf(a);
    if (!ab) return;
    const k = ab.per ? (ab.per.ctr ? a.c?.[ab.per.ctr] || 0 : ab.per.hand ? a.handN || 0 : ab.per.sameName ? (a.imprint ? Object.values(tablePlayers).reduce((s2, o) => s2 + Object.values(o?.bf || {}).filter(x => x.n === a.imprint && /\bLand\b/.test(x.t || "")).length, 0) : 0) : ab.per.base1 ? base1Count(owner) : countTypes(owner, ab.per.types)) : 1;
    const dp = ab.dp * k, dt = ab.dt * k;
    out.dp += dp; out.dt += dt;
    if (dp || dt) out.from.push({ src: dispName(a), dp, dt });
    ab.kws.forEach(kw => out.kws.push({ k: kw, src: dispName(a) }));
  });
  return out;
}
// Keywords a permanent has right now: its own (unless Humility-type) + granted + temporary (riot, Act of Treason)
const splitKwList = t => t ? t.split(/,\s*(?:and\s+)?|\s+and\s+/).map(x => x.trim().toLowerCase()).filter(Boolean) : [];
// Wonder / Anger / Filth: "As long as this card is in your graveyard and you control an Island, creatures you control have flying"
function gyGrantKws(ownerId) {
  const o = tablePlayers[ownerId]; if (!o) return [];
  return Object.values(o.gy || {}).flatMap(g => { const m = String(g.o || "").match(/as long as this card is in your graveyard and you control an? ([A-Z][a-z]+), creatures you control have ([a-z ]+?)\./i);
    return m && Object.values(o.bf || {}).some(x => new RegExp(`\\b${m[1]}\\b`).test(x.t || "")) ? [{ k: m[2].toLowerCase(), src: `${g.n} (graveyard)` }] : []; });
}
function kwsOf(e, ownerId, id, isToken) {
  const own = tableLose.some(f => permanentMatches(e, f)) || (tableSpoil[ownerId] && /\bCreature\b/.test(e.t || "")) ? [] : ownKeywords(e).map(k => ({ k, src: "" }));
  const all = [...own, ...buffsOn(e, ownerId, id, isToken).kws, ...(e.haste ? [{ k: "haste", src: e.haste === true ? "riot" : e.haste }] : []),
    ...(e.chosen && /protection from the chosen player/i.test(e.o || "") ? [{ k: `protection from ${e.chosen.name}`, src: "" }] : []),
    ...(e.suspect || e.sus ? [{ k: "menace", src: "suspected" }] : []),
    ...(isToken && tablePlayers[ownerId]?.tokens?.[id]?.ind >= tableTurnNo ? [{ k: "indestructible", src: tablePlayers[ownerId].tokens[id].indSrc || "" }] : []), // For the Common Good: only the tokens it marked
    ...((() => { const cf = String(e.o || "").match(CELEB_FORM); return cf && cf[3] && celebrating(tablePlayers[ownerId]) ? [{ k: "flying", src: "celebration" }] : []; })()),
    ...((isToken || /\bCreature\b/.test(e.t || "")) ? gyGrantKws(ownerId) : []),
    ...(/has first strike during your turn/i.test(e.o || "") && ownerId === tableTurn ? [{ k: "first strike", src: "your turn" }] : []), // Razorkin Needlehead
    ...(ownerId === tableTurn ? splitKwList((String(e.o || "").match(/^during your turn, [^.\n]*? (?:has|have) ([a-z ,]+?)\.?$/im) || [])[1]).map(k => ({ k, src: "your turn" })) : []), // Shocker
    ...(!isToken && tablePlayers[ownerId] && attachedTo(tablePlayers[ownerId], id, false).some(([, a]) => /\bEquipment\b/.test(a.t || "")) ? splitKwList((String(e.o || "").match(/as long as [^,]*? is equipped, (?:it|[^.]*?) (?:has|gets [+−-]\d+\/[+−-]\d+ and has) ([a-z ,]+?)\./i) || [])[1]).map(k => ({ k, src: "equipped" })) : [])];
  return all.filter((x, i) => all.findIndex(y => y.k === x.k) === i);
}
// Summoning sickness: hasn't been under its controller's control since their most recent turn began (and no haste)
function isSick(e, owner, id) {
  if (!/\bCreature\b/.test(e.t || "") || e.et == null) return false;
  if (e.et < (owner?.myTurnNo ?? -1)) return false;
  return !kwsOf(e, owner?.id, id).some(x => x.k === "haste");
}
function sickTokens(t, owner, k) {
  if (!isCreatureToken(t.name) || !t.fresh) return 0;
  if (t.fresh.turnNo < (owner?.myTurnNo ?? -1)) return 0;
  if (kwsOf(tokenPerm(t), owner?.id, k, true).some(x => x.k === "haste")) return 0;
  return Math.min(t.fresh.n, t.count);
}
function tokPTfx(t, ownerId, k) {
  const base = tableSpoil[ownerId] && isCreatureToken(t.name) ? tokenPT({ ...t, c: t.c }, tableSpoil[ownerId]) : tokenPT(t, tablePT);
  if (!base) return "";
  const b = { ...buffsOn(tokenPerm(t), ownerId, k, true) };
  const each = String(t.desc || "").match(/gets \+1\/\+1 for each ([a-z]+?)s? you control/i); // Urza's Saga Constructs
  if (each && tablePlayers[ownerId]) { const n = countTypes(tablePlayers[ownerId], [each[1].toLowerCase()]); b.dp += n; b.dt += n; }
  if (!b.dp && !b.dt) return base;
  const [p0, t0] = base.split("/");
  const adj = (v, d) => /^-?\d+$/.test(v) ? String(Number(v) + d) : v;
  return `${adj(p0, b.dp)}/${adj(t0, b.dt)}`;
}
// ----- Combat preview: who can block an attacker, and what happens if they do -----
const kwHas = (kws, k) => (kws || []).includes(k);
// A creature's combat stats: a card ("bf", id) or a token stack ("tok", key) of `owner`
function combatStats(owner, kind, id) {
  if (!owner) return null;
  if (kind === "bf") {
    const e = owner.bf?.[id];
    if (!e || !/\bCreature\b/.test(e.t || "")) return null;
    const [p, t] = String(ptOf(e, countsFor(owner), owner.id, id) || "0/0").split("/").map(x => Number(x) || 0);
    const o = String(e.o || "");
    return { name: dispName(e), p, t, kws: kwsOf(e, owner.id, id).map(x => x.k), avail: e.tap ? 0 : 1, count: 1, regen: !!owner.shields?.[`bf:${id}`],
      colors: colorsOf(e.m), type: e.t || "", o, ownerName: owner.name,
      cantBlock: !!e.suspect || /^(?:this creature|[^.\n]*?) can't block\.?$/im.test(o) || kwsOf(e, owner.id, id).some(x => x.k === "can't block"),
      indestr: /^(.*,\s*)?indestructible\b/im.test(o) || !!e.c?.x_indestructible || kwsOf(e, owner.id, id).some(x => x.k === "indestructible"),
      unblock: /^(?:this creature|[^.\n]*?) can't be blocked\.?$/im.test(o) || kwsOf(e, owner.id, id).some(x => x.k === "can't be blocked") };
  }
  const t = owner.tokens?.[id];
  if (!t || !isCreatureToken(t.name)) return null;
  const [p, tg] = String(tokPTfx(t, owner.id, id) || "1/1").split("/").map(x => Number(x) || 0);
  const kws = kwsOf(tokenPerm(t), owner.id, id, true).map(x => x.k);
  return { name: `${t.name} token`, p, t: tg, kws, avail: t.count - (t.tapped || 0), count: t.count, cantBlock: !!t.sus || kws.includes("can't block"), indestr: kws.includes("indestructible"), unblock: kws.includes("can't be blocked"), regen: !!t.sh,
    colors: colorsOf(tokenPerm(t).m), type: tokenPerm(t).t, o: "", ownerName: owner.name };
}
const COLOR_NAMES = { W: "white", U: "blue", B: "black", R: "red", G: "green" };
const colorsOf = m => [...new Set((String(m || "").match(/[WUBRG]/g) || []))];
// Can blocker b block attacker a (defender = the blocker's player)?
function canBlock(a, b, defender) {
  if (b.avail <= 0) return "tapped";
  if (b.cantBlock) return "can't block";
  if (a.unblock) return "it can't be blocked";
  const ao = String(a.o || ""), bo = String(b.o || "");
  // protection: from a color, from creatures / everything, from a player (True-Name Nemesis), from multicolored
  for (const k of a.kws || []) {
    const m = k.match(/^protection from (.+)$/); if (!m) continue;
    const what = m[1];
    if (what === "everything" || what === "creatures") return `protection from ${what}`;
    if (what === "all colors" && b.colors?.length) return "protection from all colors";
    if (what === "multicolored" && (b.colors?.length || 0) > 1) return "protection from multicolored";
    if (what === "monocolored" && b.colors?.length === 1) return "protection from monocolored";
    const col = Object.entries(COLOR_NAMES).find(([, n]) => n === what)?.[0];
    if (col && b.colors?.includes(col)) return `protection from ${what}`;
    if (defender?.name && what.toLowerCase() === defender.name.toLowerCase()) return `protection from ${defender.name}`;
    if (!col && !["everything", "creatures", "all colors", "multicolored", "monocolored"].includes(what) && new RegExp(`\\b${singular(what)}`, "i").test(b.type || "")) return `protection from ${what}`;
  }
  // fear: only artifact creatures and/or black creatures; intimidate: artifact creatures and/or ones sharing a color
  if (kwHas(a.kws, "fear") && !/\bArtifact\b/.test(b.type || "") && !b.colors?.includes("B")) return "fear";
  if (kwHas(a.kws, "intimidate") && !/\bArtifact\b/.test(b.type || "") && !(b.colors || []).some(c => (a.colors || []).includes(c))) return "intimidate";
  // "can't be blocked except by creatures with flying" / "except by Walls"
  const exc = ao.match(/can't be blocked except by (?:creatures with )?([a-z ]+?)(?:\.|$)/im);
  if (exc && !/two or more|three or more/i.test(exc[1])) { const need = singular(exc[1].trim()); if (!kwHas(b.kws, need) && !new RegExp(`\\b${need}`, "i").test(b.type || "")) return `only ${exc[1].trim()} can block it`; }
  // "can't be blocked by creatures with power 2 or less", "can't be blocked by Walls / artifact creatures"
  const byPow = ao.match(/can't be blocked by creatures with power (\d+) or (less|greater)/i);
  if (byPow && (byPow[2].toLowerCase() === "less" ? b.p <= Number(byPow[1]) : b.p >= Number(byPow[1]))) return `power ${byPow[2].toLowerCase() === "less" ? "≤" : "≥"} ${byPow[1]}`;
  const byType = !byPow && ao.match(/can't be blocked by ([A-Za-z ]+?)s?(?: creatures)?(?:\.|$)/m);
  if (byType && !/more than one|except/i.test(byType[0]) && new RegExp(`\\b${byType[1].trim()}`, "i").test(b.type || "")) return `can't be blocked by ${byType[1].trim()}s`;
  // the blocker's own limits: "can block only creatures with flying"
  if (/can block only creatures with flying/i.test(bo) && !kwHas(a.kws, "flying")) return "it can only block flyers";
  if (kwHas(a.kws, "flying") && !kwHas(b.kws, "flying") && !kwHas(b.kws, "reach")) return "flying";
  if (kwHas(a.kws, "shadow") && !kwHas(b.kws, "shadow")) return "shadow";
  if (kwHas(a.kws, "skulk") && b.p > a.p) return "skulk";
  if (kwHas(a.kws, "horsemanship") && !kwHas(b.kws, "horsemanship")) return "horsemanship";
  const walk = (a.kws || []).find(k => /^[a-z]+walk$/.test(k));
  if (walk) { const ty = walk.replace(/walk$/, ""); const lands = Object.values(defender?.bf || {}).filter(e => /\bLand\b/.test(e.t || "")); if (lands.some(e => new RegExp(`\\b${ty}`, "i").test(e.t) || tableTypeAdds.some(x => x.add.toLowerCase() === ty))) return walk; }
  if (a.evade && b.p < a.evade) return `power below ${a.evade}`;
  if (a.ring && b.p > a.p) return "Ring-bearer";
  return "";
}
// What happens if b blocks a (first strike, double strike, deathtouch, indestructible, trample)
function fightOut(a, b) {
  const fs = x => kwHas(x.kws, "first strike") || kwHas(x.kws, "double strike");
  const kills = (src, tgt, dmg) => !tgt.indestr && !tgt.regen && dmg > 0 && (kwHas(src.kws, "deathtouch") || dmg >= tgt.t);
  let aDies = false, bDies = false;
  if (fs(a) && !fs(b)) { bDies = kills(a, b, a.p); if (!bDies) aDies = kills(b, a, b.p); }
  else if (fs(b) && !fs(a)) { aDies = kills(b, a, b.p); if (!aDies) bDies = kills(a, b, a.p); }
  else { aDies = kills(b, a, b.p); bDies = kills(a, b, a.p); }
  if (!aDies && !bDies && kwHas(a.kws, "double strike")) bDies = kills(a, b, a.p * 2);
  if (!aDies && !bDies && kwHas(b.kws, "double strike")) aDies = kills(b, a, b.p * 2);
  const total = kwHas(a.kws, "double strike") ? a.p * 2 : a.p;
  const tramp = kwHas(a.kws, "trample") ? Math.max(0, total - (kwHas(a.kws, "deathtouch") ? 1 : b.indestr ? b.t : b.t)) : 0;
  return { aDies, bDies, tramp };
}
// Every creature `defender` could block `a` with, and how it goes
// 🛡 who is already blocking this combat (kept on the player, so Undo takes it back too)
let tableCombat = ""; // this combat (turn + extra-combat number), set with the table state
const blockingNow = p => p?.blk?.k === tableCombat ? (p.blk.u || {}) : {};
function blockPreview(a, defender) {
  const rows = [];
  Object.keys(defender?.bf || {}).forEach(id => { const b = combatStats(defender, "bf", id); if (b) rows.push({ ...b, kind: "bf", id }); });
  Object.keys(defender?.tokens || {}).forEach(k => { const b = combatStats(defender, "tok", k); if (b) rows.push({ ...b, kind: "tok", id: k }); });
  const used = blockingNow(defender); // a creature blocks one attacker per combat (blocking doesn't tap it)
  rows.forEach(b => { const n = used[`${b.kind}:${b.id}`] || 0;
    if (n && !/can block (?:an additional|any number of|two|three)/i.test(b.o || "")) { b.avail = Math.max(0, b.avail - n); b.blocking = n; } });
  rows.forEach(b => { b.why = b.blocking && b.avail <= 0 ? "already blocking" : canBlock(a, b, defender); b.out = b.why ? null : fightOut(a, b); });
  const able = rows.filter(b => !b.why);
  return { rows, able, killers: able.filter(b => b.out.aDies && !b.out.bDies), trades: able.filter(b => b.out.aDies && b.out.bDies), menace: kwHas(a.kws, "menace") || /can't be blocked except by (?:two|three) or more creatures/i.test(a.o || "") };
}
const outText = (b, mine) => !b.out ? `can't block (${b.why})` : b.out.aDies && b.out.bDies ? "⚖ trade: both die" : b.out.aDies ? (mine ? "❌ blocks and kills yours, survives" : "✅ blocks and kills it, survives") : b.out.bDies ? (mine ? "✅ yours kills it" : "❌ your blocker dies") : "🛡 nothing dies";
// Can `casterId` target this permanent? (shroud, hexproof, protection from everything / from the chosen player)
// ----- The Ring tempts you: level abilities and the current Ring-bearer -----
const RING_LEVELS = [
  "Legendary, and can't be blocked by creatures with greater power",
  "Whenever it attacks, draw a card, then discard a card",
  "Whenever it becomes blocked by a creature, that creature's controller sacrifices it at end of combat",
  "Whenever it deals combat damage to a player, each opponent loses 3 life",
];
const ringLevel = p => Math.min(4, p?.ring?.n || 0);
// The Ring-bearer, if it's still on the battlefield: a card ({id, e}) or a token stack ({tok, k, t})
function ringBearer(p) {
  const b = p?.ring?.bearer;
  if (!b) return null;
  if (b.id) { const e = p.bf?.[b.id]; return e ? { ...b, e } : null; }
  if (b.tok) { const k = Object.keys(p.tokens || {}).find(x => p.tokens[x].name === b.tok && p.tokens[x].count > 0); return k ? { ...b, k, t: p.tokens[k] } : null; }
  return null;
}
const ringTitle = p => RING_LEVELS.slice(0, ringLevel(p)).map((t, i) => `${i + 1}. ${t}`).join("\n");

// The colors of whatever is doing the targeting right now (set per reminder), for "hexproof from blue" and "protection from red"
let targetSrcColors = null;
const COLOR_WORD = { W: "white", U: "blue", B: "black", R: "red", G: "green" };
let lighthouseBy = null; // Arcane Lighthouse: this player ignores opponents' creatures' hexproof/shroud this turn
function cantTarget(e, ownerId, id, casterId, isToken) {
  const kws0 = kwsOf(e, ownerId, id, isToken).map(x => x.k);
  const kws = lighthouseBy && casterId === lighthouseBy && ownerId !== casterId && (isToken || /\bCreature\b/.test(e.t || "")) ? kws0.filter(k => k !== "shroud" && k !== "hexproof" && !/^hexproof from/.test(k)) : kws0;
  if (kws.includes("shroud") || kws.includes("protection from everything")) return true;
  if (kws.includes("hexproof") && ownerId !== casterId) return true;
  if (targetSrcColors?.length) {
    const words = targetSrcColors.map(c => COLOR_WORD[c]);
    if (ownerId !== casterId && kws.some(k => { const m = k.match(/^hexproof from ([a-z]+)$/); return m && words.includes(m[1]); })) return true;
    if (kws.some(k => { const m = k.match(/^protection from ([a-z]+)$/); return m && words.includes(m[1]); })) return true;
  }
  if (e.chosen && e.chosen.id === casterId && /protection from the chosen player/i.test(e.o || "")) return true;
  return false;
}
const kwHtml = list => list.map(x => `<span class="kw ${x.src ? "granted" : ""}" ${x.src ? `title="from ${esc(x.src)}"` : ""}>${esc(x.k)}</span>`).join("");
function ptOf(e, counts = {}, ownerId, id) {
  { const cf = String(e.o || "").match(CELEB_FORM); if (cf && celebrating(tablePlayers[ownerId])) e = { ...e, p: cf[1], tg: cf[2] }; } // Goddric
  if (tableSpoil[ownerId] && /\bCreature\b/.test(e.t || "") && e.p != null) e = { ...e, p: tableSpoil[ownerId].split("/")[0], tg: tableSpoil[ownerId].split("/")[1], cda: null };
  { const o = String(e.o || ""), ow = tablePlayers[ownerId];
    if (ow && /^(\*|1\+\*)$/.test(String(e.p)) && /\bpower is equal to\b/i.test(o)) {
      const opps = Object.values(tablePlayers).filter(x => x && x.id !== ownerId && !x.out);
      let v = null, m;
      if ((m = o.match(/power is equal to your devotion to (white|blue|black|red|green)/i))) { const sym = { white: "W", blue: "U", black: "B", red: "R", green: "G" }[m[1].toLowerCase()]; v = Object.values(ow.bf || {}).reduce((a, x) => a + (String(x.m || "").match(/\{[^}]+\}/g) || []).filter(q => q.includes(sym)).length, 0); }
      else if (/power is equal to 1 plus the number of card types among cards in your opponents' graveyards/i.test(o)) { const ts = new Set(); opps.forEach(x => Object.values(x.gy || {}).forEach(c => (String(c.t || "").split("—")[0].match(/\b(Artifact|Battle|Creature|Enchantment|Instant|Kindred|Land|Planeswalker|Sorcery)\b/g) || []).forEach(t => ts.add(t)))); v = 1 + ts.size; }
      else if ((m = o.match(/power is equal to the number of (artifacts|creatures|enchantments|lands) your opponents control/i))) { const T = m[1].slice(0, -1).replace(/^\w/, c => c.toUpperCase()); v = opps.reduce((a, x) => a + Object.values(x.bf || {}).filter(c => new RegExp(`\\b${T}\\b`).test(c.t || "")).length + (T === "Artifact" ? Object.values(x.tokens || {}).filter(t => !isCreatureToken(t.name) || /artifact/i.test(t.desc || "")).reduce((b, t) => b + (t.count || 0), 0) : 0), 0); }
      if (v != null) e = { ...e, p: String(v) };
    } }
  const base = ptBase(e, counts);
  if (!ownerId || !base) return base;
  const b = buffsOn(e, ownerId, id);
  if (!b.dp && !b.dt) return base;
  const [p0, t0] = base.split("/");
  const adj = (v, d) => /^-?\d+$/.test(v) ? String(Number(v) + d) : (d ? `${v}${d > 0 ? "+" : ""}${d}` : v);
  return `${adj(p0, b.dp)}/${adj(t0, b.dt)}`;
}
function ptBase(e, counts = {}) {
  if (tablePT && /\bCreature\b/.test(e.t || "") && e.p != null) e = { ...e, p: tablePT.split("/")[0], tg: tablePT.split("/")[1], cda: null };
  if (e.p == null || e.tg == null) return "";
  if (e.cda === "hand") { if (e.handN == null) return `${e.p}/${e.tg}`; e = { ...e, p: String(e.handN), tg: String(e.handN) }; }
  else if (e.cda && counts[e.cda] != null) e = { ...e, p: String(counts[e.cda]), tg: String(counts[e.cda]) };
  const d = (e.c?.p1p1 || 0) - (e.c?.m1m1 || 0);
  const adj = v => /^-?\d+$/.test(String(v)) ? String(Number(v) + d) : (d ? `${v}${d > 0 ? "+" : ""}${d}` : String(v));
  return `${adj(e.p)}/${adj(e.tg)}`;
}
function extraCounters(e) {
  return Object.entries(e.c || {})
    .filter(([k, n]) => n && !((k === "p1p1" || k === "m1m1") && e.p != null))
    .map(([k, n]) => `${counterLabel(k)} ${n}`);
}
// Layouts whose second face isn't part of the front card (transform, modal double-faced, adventure, prepare…)
const FRONT_ONLY = ["transform", "modal_dfc", "adventure", "prepare", "reversible_card", "flip"];
// One face of a multi-face card, as a card the app can play
function faceCard(card, i) {
  const f = card?.faces?.[i];
  if (!f) return card;
  return { ...card, fname: f.n, t: f.t || card.t, m: f.m || (i ? "" : card.m), o: f.o || "", p: f.p ?? null, tg: f.tg ?? null, img: f.img || card.img || "", face: i };
}
// Trim a Scryfall card down to what the app needs
function slim(c) {
  const f = c.card_faces?.[0] || {};
  const faces = !!c.card_faces;
  const pick = k => (c[k] != null ? c[k] : f[k] != null ? f[k] : null);
  return {
    n: c.name,
    t: (faces && f.type_line) || c.type_line || "",
    m: pick("mana_cost") || "",
    p: pick("power"),
    tg: pick("toughness"),
    l: pick("loyalty"),
    o: c.oracle_text != null ? c.oracle_text : faces && FRONT_ONLY.includes(c.layout) ? (f.oracle_text || "") : (c.card_faces || []).map(x => x.oracle_text || "").join("\n//\n"),
    img: c.image_uris?.normal || f.image_uris?.normal || "",
    ...(faces ? { layout: c.layout, faces: c.card_faces.map(x => ({ n: x.name, t: x.type_line || "", m: x.mana_cost || "", o: x.oracle_text || "", p: x.power ?? null, tg: x.toughness ?? null, img: x.image_uris?.normal || "" })) } : {}),
  };
}
// Mana cost as Scryfall symbol icons, e.g. {2}{G}{G}
function manaHtml(m) {
  if (!m) return "";
  const front = String(m).split(" // ")[0];
  return `<span class="mana">${front.replace(/\{([^}]+)\}/g, (_, sym) =>
    `<img src="https://svgs.scryfall.io/card-symbols/${encodeURIComponent(sym.replace(/\//g, ""))}.svg" alt="{${esc(sym)}}" title="{${esc(sym)}}">`)}</span>`;
}
// An activated ability's cost with real mana symbols: "{1}{G}{G}{G}", "{T}, Sacrifice a creature"
const abCostHtml = c => `<span class="ab-cost">${String(c || "").split(/(\{[^}]+\})/).map(x => /^\{[^}]+\}$/.test(x) ? manaHtml(x) : esc(x)).join("")}</span>`;
// Show alternate printed names (e.g. "Shadowbringers (Dovin's Veto)")
const dispName = c => (c.nick ? `${c.nick} (${c.n})` : c.fname ? c.fname : c.faces?.length && FRONT_ONLY.includes(c.layout) ? c.faces[0].n : c.n);

// Finds a card by an alternate printed name (Universes Beyond / showcase "flavor names")
const normName = s => String(s || "").toLowerCase().replace(/[’‘]/g, "'").replace(/[^a-z0-9' ]/g, "").replace(/\s+/g, " ").trim();
const altNames = c => [c.flavor_name, c.printed_name, ...(c.card_faces || []).flatMap(f => [f.flavor_name, f.printed_name])].filter(Boolean);
// Showcase names Scryfall doesn't list as flavor names (Final Fantasy Through the Ages…)
const KNOWN_NICKS = { "search for the frozen esper": "Nature's Claim" };
async function findByNickname(name) {
  const want = normName(name);
  if (KNOWN_NICKS[want]) { try { const r = await fetch(`${SCRYFALL}/cards/named?exact=${encodeURIComponent(KNOWN_NICKS[want])}`); if (r.ok) return { ...slim(await r.json()), nick: name }; } catch { /* fall through */ } }
  const urls = [
    `${SCRYFALL}/cards/search?q=${encodeURIComponent(`!"${name}"`)}&unique=prints&include_extras=true`,
    `${SCRYFALL}/cards/search?q=${encodeURIComponent(name)}&unique=prints&include_extras=true`,
    `${SCRYFALL}/cards/named?fuzzy=${encodeURIComponent(name)}`,
  ];
  for (const url of urls) {
    try {
      const r = await fetch(url);
      if (r.ok) {
        const j = await r.json();
        const list = j.object === "list" ? j.data || [] : [j];
        const hit = list.find(c => altNames(c).some(a => normName(a) === want));
        if (hit) return { ...slim(hit), nick: name };
      }
    } catch { /* try the next way */ }
    await sleep(120);
  }
  return null;
}

function bfEntry(card) {
  const e = { n: card.n, t: card.t || "", img: card.img || "", m: card.m || "" };
  if (card.o) e.o = card.o;
  if (card.face != null) { e.face = card.face; if (card.fname) e.fname = card.fname; }
  else if (card.faces?.length && FRONT_ONLY.includes(card.layout)) { e.face = 0; e.fname = card.faces[0].n; }
  if (card.bestowT) e.bestowT = card.bestowT; // bestowed: an Aura until what it enchants leaves
  if (card.fd && card.fname) e.fname = card.fname; // face-down: "🂠 Face-down 2/2"
  if (card.nick) e.nick = card.nick;
  if (card.mode) e.mode = card.mode;
  const cda = card.o ? abilitiesOf(card).cda : null;
  if (cda) e.cda = cda;
  if (card.p != null && card.tg != null) { e.p = String(card.p); e.tg = String(card.tg); }
  if (card.l != null && /^\d+$/.test(String(card.l))) e.c = { loyalty: Number(card.l) };
  return e;
}

// ---------- Decklist parsing + Scryfall lookup ----------
function parseDeck(text) {
  const out = [];
  let section = "main", cmdSeen = 0;
  for (const raw of text.split(/\r?\n/)) {
    let line = raw.trim();
    if (!line) { if (section === "commander" && cmdSeen) section = "main"; continue; }
    const head = line.replace(/^\/\/\s*/, "").replace(/:$/, "").trim().toLowerCase();
    if (/^(commanders?|deck|main(board)?|sideboard|maybeboard|considering|companion|tokens?)(\s*\(\d+\))?$/.test(head)) {
      section = head.startsWith("commander") ? "commander" : /^(deck|main)/.test(head) ? "main" : head === "sideboard" ? "side" : "skip";
      continue;
    }
    if (line.startsWith("//") || line.startsWith("#") || section === "skip") continue;
    let qty = 1;
    const m = line.match(/^(\d+)\s*x?\s+(.*)$/i);
    if (m) { qty = Number(m[1]); line = m[2]; }
    let isCmd = section === "commander" || /\*CMDR\*|\[[^\]]*commander/i.test(line);
    line = line.replace(/\[.*?\]/g, "").replace(/\*[A-Z]+\*/g, "").trim();
    const pr = line.match(/\s+\(([A-Za-z0-9]+)\)(?:\s+(\S+))?$/); // "(MH3) 250": the exact printing
    line = line.replace(/\s+\([A-Za-z0-9]+\)(\s+\S+)?$/, "").replace(/\s+#.*$/, "").trim();
    line = line.replace(/\s+\/\s+/g, " // ");
    if (section === "commander") cmdSeen++;
    if (line) out.push({ qty, name: line, isCmd, side: section === "side", ...(pr && pr[2] ? { set: pr[1].toLowerCase(), cn: pr[2].replace(/\*$/, "") } : {}) });
  }
  const merged = new Map();
  out.forEach(e => {
    const k = e.name.toLowerCase();
    const cur = merged.get(k);
    if (cur) { cur.qty += e.qty; cur.isCmd ||= e.isCmd; cur.side &&= e.side; if (!cur.set && e.set) { cur.set = e.set; cur.cn = e.cn; } } else merged.set(k, { ...e });
  });
  return [...merged.values()];
}

async function lookupCards(names) {
  const byName = new Map();
  for (let i = 0; i < names.length; i += 75) {
    const chunk = names.slice(i, i + 75);
    const r = await fetch(`${SCRYFALL}/cards/collection`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ identifiers: chunk.map(name => ({ name })) }),
    });
    if (!r.ok) throw new Error(`Scryfall returned an error (${r.status}).`);
    const j = await r.json();
    (j.data || []).forEach(c => {
      const s = slim(c);
      byName.set(c.name.toLowerCase(), s);
      (c.card_faces || []).forEach(f => byName.set(String(f.name).toLowerCase(), s));
    });
    if (i + 75 < names.length) await sleep(150);
  }
  return byName;
}

// Deck library: every deck saved on this device, plus which one is active
function loadLib() {
  try {
    const lib = JSON.parse(store.get("mtga_decks") || "null");
    if (lib && lib.decks) return lib;
  } catch { /* fall through */ }
  const lib = { active: null, decks: {} };
  try { // bring over a deck saved by the older single-deck version
    const old = JSON.parse(store.get("mtga_deck") || "null");
    if (old?.cards) { const id = newId(); old.name = old.cmds?.[0] || "My deck"; lib.decks[id] = old; lib.active = id; }
  } catch { /* ignore */ }
  return lib;
}
const saveLib = lib => store.set("mtga_decks", JSON.stringify(lib));

// ---------- Shared game actions ----------
async function nextTurn(code, before = null, tbAt = null) {
  const room = (await get(ref(db, `rooms/${code}`))).val();
  if (!room) return;
  // ↶ Undo end turn: remember the whole table as it was before this turn ended (not the log)
  const tbSnap = JSON.parse(JSON.stringify(before || room)); delete tbSnap.log; delete tbSnap.turnBack; delete tbSnap.rewind;
  const all = seated(room);
  if (!all.length) return;
  const i = all.findIndex(p => p.id === room.turn);
  let next = null;
  for (let k = 1; k <= all.length; k++) {
    const c = all[(i + k + all.length) % all.length];
    if (!isOut(c)) { next = c; break; }
  }
  if (!next) return;
  const xt0 = room.extraTurn; // an extra turn already taken hands over to the next one queued
  const xt = xt0?.taken ? (xt0.queue?.length ? { ...xt0.queue[0], queue: xt0.queue.slice(1) } : null) : xt0;
  const skipX = xt && all.some(p => p.id !== xt.pid && !isOut(p) && Object.values(p.bf || {}).some(e => /if an opponent would begin an extra turn, that player skips that turn instead/i.test(e.o || "")));
  if (xt && !xt.taken && xt.pid === room.turn && !skipX && !isOut(all.find(p => p.id === xt.pid) || {})) next = all.find(p => p.id === xt.pid);
  const upd = { turn: next.id, turnNo: (room.turnNo || 0) + 1 };
  { // Rounds: a round ends when play passes back around to the first player's seat
    const seatOf = p => p.seat ?? all.indexOf(p), N = Math.max(...all.map(seatOf)) + 1, cur = all.find(p => p.id === room.turn);
    const fs = room.firstSeat ?? (cur ? seatOf(cur) : 0), rank = p => ((seatOf(p) - fs) % N + N) % N;
    const wrapped = cur && next.id !== room.turn && rank(next) <= rank(cur);
    upd.round = (room.round || 1) + (wrapped ? 1 : 0); if (room.firstSeat == null) upd.firstSeat = fs;
    if (wrapped) setTimeout(() => logTo(code, `— Round ${upd.round} —`), 0);
  }
  if (xt0) upd.extraTurn = !xt ? null : !xt.taken && !skipX && next.id === xt.pid && xt.pid === room.turn ? { ...xt, taken: true, turnNo: (room.turnNo || 0) + 1 } : (xt.queue?.length ? { ...xt.queue[0], queue: xt.queue.slice(1) } : null);
  if (room.airLock && room.airLock.by === next.id) upd.airLock = null;
  if (room.turn) upd.turnBack = { at: tbAt || Date.now(), by: room.turn, byName: room.players?.[room.turn]?.name || "the last player", snap: tbSnap };
  all.forEach(p => Object.entries(p.effects || {}).forEach(([k, ef]) => {
    if (ef.dur === "turn") upd[`players/${p.id}/effects/${k}`] = null;
  }));
  // Untap step for the incoming player
  Object.entries(next.bf || {}).forEach(([id, e]) => { if (e.tap) upd[`players/${next.id}/bf/${id}/tap`] = null; });
  Object.entries(next.tokens || {}).forEach(([k, t]) => { if (t.tapped) upd[`players/${next.id}/tokens/${k}/tapped`] = null; });
  await update(ref(db, `rooms/${code}`), upd);
  logTo(code, `${next.name}'s turn`);
}

// Put the whole table back the way it was before the last "End turn" (everyone's boards, life, taps, the turn marker)
async function takeBackTurn(code) {
  const r = (await get(ref(db, `rooms/${code}`))).val(), tb = r?.turnBack;
  if (!tb?.snap) return;
  const since = Object.values(r.log || {}).filter(l => (l.t || 0) > tb.at && !/'s turn$|^— Round/.test(l.text || "")).length;
  if (!confirm(`Go back to ${tb.byName}'s turn?\n\nEverything since they ended their turn is undone for everyone${since ? ` (${since} log entr${since === 1 ? "y" : "ies"})` : ""}.`)) return;
  const upd = {};
  new Set([...Object.keys(r), ...Object.keys(tb.snap)]).forEach(k => { if (k !== "log" && k !== "turnBack" && k !== "rewind") upd[k] = tb.snap[k] ?? null; });
  upd.turnBack = null; upd.rewind = { at: Date.now(), tb: tb.at };
  await update(ref(db, `rooms/${code}`), upd);
  logTo(code, `↶ Took back the end of ${tb.byName}'s turn: it's ${tb.byName}'s turn again`);
}

async function resetGame(code) {
  const room = (await get(ref(db, `rooms/${code}`))).val();
  if (!room) return;
  const upd = { turn: null, round: null, firstSeat: null, log: null, turnBack: null, rewind: null, pending: null, airLock: null, control: null, notes: null, casts: null, draws: null, replies: null, orders: null, winner: null };
  upd.gameNo = Date.now(); // tells every phone a new game started (digital decks reshuffle)
  Object.keys(room).forEach(k => { if (k !== "players" && k !== "created" && !(k in upd)) upd[k] = null; }); // Silence, Fog, day/night, steps, combat… all from the old game
  upd.log = null;
  // each player starts fresh: keep only who they are (name, color, seat, commanders); everything from the old game goes (phasing, ring, dungeon, pumps…)
  const KEEP = ["name", "color", "seat", "commanders"];
  seated(room).forEach(p => {
    const b = `players/${p.id}/`;
    Object.keys(room.players?.[p.id] || {}).forEach(k => { if (!KEEP.includes(k)) upd[b + k] = null; });
    upd[b + "life"] = START_LIFE;
    upd[b + "poison"] = 0;
  });
  await update(ref(db, `rooms/${code}`), upd);
  logTo(code, "New game");
}

// Shown on the home screen and controller so you can confirm which version is deployed
// Selfless Squire / Willbreaker trigger text (used by the card buttons and the trigger hooks)
const SQUIRE_RE = /^(?:[^—\n]{1,40} — )?whenever damage that would be dealt to you is prevented, put that many \+1\/\+1 counters on (?:this creature|[^.]+)\.?$/im;
const WILLB_RE = /^(?:[^—\n]{1,40} — )?whenever a creature an opponent controls becomes the target of a spell or ability you control, gain control of that creature/im;
const APP_VERSION = "2026.10.18d";

// Brand: the clasped tome emblem (original art) and the Triggernomicon wordmark
const TOME_SVG = `<img class="tome" src="tome-logo.svg?v=20261018d" alt="" aria-hidden="true">`; // the jeweled tome
const WORDMARK = `<span class="wm-big">T</span>RIGGERNOMICON`;
const FAN_NOTE = `Triggernomicon is unofficial Fan Content permitted under the <a href="https://company.wizards.com/en/legal/fancontentpolicy" target="_blank" rel="noopener">Fan Content Policy</a>. Not approved/endorsed by Wizards. Portions of the materials used are property of Wizards of the Coast. ©Wizards of the Coast LLC. Card data and images from <a href="https://scryfall.com" target="_blank" rel="noopener">Scryfall</a>.`;

// ---------- Home ----------
function renderHome(msg = "") {
  app.onclick = null;
  app.innerHTML = `
  <div class="home">
    <div class="home-brand">${TOME_SVG}<h1 aria-label="Triggernomicon">${WORDMARK}</h1><p class="sub">Never miss a trigger</p></div>
    ${msg ? `<p class="error">${esc(msg)}</p>` : ""}
    <section class="card">
      <h2>Join a game</h2>
      <form id="joinForm" class="row">
        <input id="joinCode" placeholder="Room code" maxlength="4" autocapitalize="characters" autocomplete="off">
        <button class="btn primary">Join</button>
      </form>
    </section>
    <section class="card">
      <h2>Host on this screen</h2>
      <p class="muted">Open this on the TV, or on the laptop connected to it.</p>
      <button id="hostBtn" class="btn wide">Create a room</button>
    </section>
    <p class="ver">Version ${APP_VERSION}</p>
    <p class="fan-note">${FAN_NOTE}</p>
  </div>`;
  document.getElementById("joinForm").onsubmit = e => {
    e.preventDefault();
    const c = document.getElementById("joinCode").value.trim().toUpperCase();
    if (c) location.search = `?room=${c}`;
  };
  document.getElementById("hostBtn").onclick = createRoom;
}

// 🧹 Old tables clean themselves up: a room nobody has touched for 30 days is deleted
const ROOM_TTL = 30 * 864e5;
function touchRoom(code, snap) { // stamp "last used" at most every 6 hours (only on a room that still exists)
  const r = snap?.val?.(); if (!code || !r) return;
  if (!r.touched || Date.now() - r.touched > 6 * 36e5) update(ref(db, `rooms/${code}`), { touched: Date.now() }).catch(() => {});
}
async function cleanupRooms(keep) {
  try {
    const last = Number(localStorage.getItem("mtga_cleanup") || 0); if (Date.now() - last < 864e5) return; // once a day per TV
    localStorage.setItem("mtga_cleanup", String(Date.now()));
    const cutoff = Date.now() - ROOM_TTL, old = (await get(query(ref(db, "rooms"), orderByChild("touched"), endAt(cutoff)))).val() || {};
    for (const [k, r] of Object.entries(old)) {
      if (k === keep || !r) continue;
      if (r.touched && r.touched < cutoff) await remove(ref(db, `rooms/${k}`));
      else if (!r.touched) await update(ref(db, `rooms/${k}`), { touched: Date.now() }); // rooms from before this update get a fresh 30 days
    }
  } catch { /* cleanup is best-effort */ }
}
async function createRoom() {
  let code;
  for (let i = 0; i < 10; i++) {
    code = makeCode();
    if (!(await get(ref(db, `rooms/${code}`))).exists()) break;
  }
  await set(ref(db, `rooms/${code}`), { created: Date.now(), touched: Date.now() });
  await cleanupRooms(code);
  location.search = `?host=${code}`;
}

// ---------- TV / host ----------
let tvOut = null, tvSound = false, tvWinAt;
// TV view: "both" = text rows with card thumbnails under them (default), "cards" = pictures only, "list" = text only
let tvView = ["both", "cards", "list"].includes(store.get("mtga_tvview")) ? store.get("mtga_tvview") : "both", tvCards = tvView !== "list";
const TV_VIEWS = { both: "📝🖼 Text + pictures", cards: "🖼 Pictures only", list: "📝 Text only" };
// TV pictures: "art" = just the card's artwork with its name (default, readable from the couch), "card" = the whole card image
let tvPics = store.get("mtga_tvpics") === "card" ? "card" : "art";
const TV_PICS = { art: "🎨 Art + name", card: "🃏 Full cards" };
// Big full-screen moment (K.O. / victory) that fades out on its own
function flash(kind, big, small) {
  const d = document.createElement("div");
  d.className = `flash ${kind}`;
  d.innerHTML = `<div class="flash-big">${big}</div><div class="flash-small">${esc(small)}</div>`;
  document.body.appendChild(d);
  setTimeout(() => d.classList.add("gone"), kind === "win" ? 4200 : 2600);
  setTimeout(() => d.remove(), kind === "win" ? 5000 : 3400);
  d.onclick = () => d.remove();
}

function startHost(code, watch = false) {
  app.innerHTML = `
  <div class="tv">
    <header class="tv-head">
      <div class="brand">${TOME_SVG}<div><span class="brand-name" aria-label="Triggernomicon">${WORDMARK}</span><span class="brand-tag">Never miss a trigger</span></div></div>
      <div class="turn" id="turnInfo"></div>
      <div class="join">
        <div id="qr"></div>
        <div>
          <div class="small">Scan or go to</div>
          <div class="url">${esc(location.host + location.pathname)}</div>
          <div class="code">${esc(code)}</div>
        </div>
      </div>
    </header>
    <div id="winBar" class="win-bar" hidden></div>
    <div id="pendingBar" class="pending-bar" hidden></div>
    <div id="fxBar" class="fx-bar" hidden></div>
    <main id="board" class="board"></main>
    <div id="seatPanel" class="seat-panel" hidden></div>
    <footer class="tv-foot">
      <div class="tv-actions">
        ${watch ? `<span class="muted">👀 Watching (view only)</span>` : `<button data-a="next" class="btn primary">Next turn ▶</button>
        <button data-a="take-back" class="btn ghost" id="tbBtn" hidden>↶ Undo end turn</button>
        <button data-a="reset" class="btn ghost">Reset game</button>
        <button data-a="seats" class="btn ghost" id="seatsBtn" title="Take a player out of this game (they can join again with the code)">👥 Seats</button>`}
        <button data-a="sound" class="btn ghost" id="soundBtn">🔇 Sound off</button>
        <button data-a="tvview" class="btn ghost" id="viewBtn" title="Switch the board view">View: ${TV_VIEWS[tvView]}</button>
        <button data-a="tvpics" class="btn ghost" id="picsBtn" title="Artwork only, or the whole card">Pictures: ${TV_PICS[tvPics]}</button>
        ${watch ? "" : `<span class="muted watch-link">Remote viewers (view only): <b>${esc(location.host + location.pathname)}?watch=${esc(code)}</b></span>`}
      </div>
      <div id="log" class="log"></div>
    </footer>
  </div>`;
  if (typeof QRCode !== "undefined") {
    new QRCode(document.getElementById("qr"), { text: joinUrl(code), width: 176, height: 176 });
  } else {
    document.getElementById("qr").style.display = "none";
  }
  const board = document.getElementById("board");
  const turnInfo = document.getElementById("turnInfo");
  const logEl = document.getElementById("log");

  let lastRoomSnap = null;
  const renderTv = snap => {
    const room = snap.val();
    if (!room) { board.innerHTML = `<div class="empty">Room ${esc(code)} not found.</div>`; return; }
    updateTablePT(room);
    const ps = seated(room);
    board.dataset.count = ps.length;
    const fxAll = effectsInPlay(room); // lasting effects sit on their owner's panel, this-turn ones in the bar
    tvFxByOwner = {}; fxAll.filter(x => !x.thisTurn).forEach(x => (tvFxByOwner[x.owner.id] ||= []).push(x));
    board.innerHTML = ps.length
      ? ps.map(p => panel({ ...p, __notes: room.notes?.[p.id] }, ps, room.turn)).join("")
      : `<div class="empty">Scan the code or enter ${esc(code)} on your phone to join.</div>`;
    if (tvCards) requestAnimationFrame(() => fitTvCards(board)); // after the bars above the board are drawn
    const tp = ps.find(p => p.id === room.turn);
    // K.O. and victory moments
    const outNow = new Set(ps.filter(p => isOut(p)).map(p => p.id));
    if (tvOut) ps.filter(p => outNow.has(p.id) && !tvOut.has(p.id)).forEach(p => { flash("ko", `💀 K.O.`, `${p.name} is out: ${outReason(p, ps)}`); if (tvSound) playKO(); });
    tvOut = outNow;
    const alive = ps.filter(p => !isOut(p));
    if (!watch && ps.length >= 2 && alive.length === 1 && !room.winner) {
      update(ref(db, `rooms/${code}`), { winner: { pid: alive[0].id, name: alive[0].name, src: "last one standing", at: Date.now() } });
      logTo(code, `🏆 ${alive[0].name} is the last one standing!`);
    }
    if (room.winner && tvWinAt !== room.winner.at) {
      if (tvWinAt !== undefined) { flash("win", "🏆 VICTORY!", `${room.winner.name} wins (${room.winner.src})`); if (tvSound) playVictory(); }
      tvWinAt = room.winner.at;
    } else if (!room.winner) tvWinAt = null;
    const wb = document.getElementById("winBar");
    wb.hidden = !room.winner;
    if (room.winner) wb.innerHTML = `🏆 <b>${esc(room.winner.name)}</b> wins the game! <span>(${esc(room.winner.src)})</span>`;
    const fxs = fxAll.filter(x => x.thisTurn), fb = document.getElementById("fxBar"); // lasting effects sit on their owner's panel
    fb.hidden = !fxs.length && !room.control;
    fb.innerHTML = (room.control ? `<span class="fx-chip ctl">${esc(controlText(room.control))}</span>` : "") + (fxs.length ? `<span class="fx-title">🌐 In play</span>${fxs.map(x => `<span class="fx-chip ${x.off ? "off" : ""}" style="--pc:${esc(x.owner.color)}"><b>${esc(x.src)}</b> <i>(${esc(x.owner.name)})</i>: ${esc(x.lines.join(" "))}${x.off ? " <em>· off while tapped</em>" : ""}</span>`).join("")}` : "");
    const pb = document.getElementById("pendingBar"), pend = room.pending;
    pb.hidden = !pend;
    if (pend) {
      const left = Object.entries(pend.waiting || {}).filter(([, v]) => v !== "pass");
      pb.innerHTML = `⏳ <b>${esc(pend.byName)}</b>: ${esc(pend.src)} (${esc(pend.text)}) ${left.length
        ? "· " + left.map(([id, v]) => v === "respond" ? `<span class="resp">✋ ${esc(room.players?.[id]?.name || "?")} is responding…</span>` : `waiting on ${esc(room.players?.[id]?.name || "?")}`).join(" · ")
        : "· everyone passed"}`;
    }
    { const tbb = document.getElementById("tbBtn"); if (tbb) tbb.hidden = !room.turnBack; }
    turnInfo.textContent = tp ? `${tp.name}'s Turn${room.turnNo ? ` · Round ${room.round || 1}` : ""}${room.airLock ? ` · 🌀 exile casting locked (${room.airLock.name})` : ""}` : "";
    logEl.innerHTML = Object.values(room.log || {}).sort((a, b) => b.t - a.t).slice(0, 6)
      .map(l => `<div>${esc(l.text)}</div>`).join("");
  };
  let seatOpen = false;
  onValue(ref(db, `rooms/${code}`), snap => { lastRoomSnap = snap; touchRoom(code, snap); renderTv(snap); if (seatOpen) renderSeats(); });
  setTimeout(() => cleanupRooms(code), 5000);
  { let pend = null; tvRerender = () => { clearTimeout(pend); pend = setTimeout(() => { if (lastRoomSnap && tvCards) renderTv(lastRoomSnap); }, 300); }; } // token art arrived
  window.addEventListener("resize", () => { if (tvCards) fitTvCards(board); });
  try { new ResizeObserver(() => { if (tvCards) fitTvCards(board); }).observe(board); } catch {} // bars appearing/disappearing change the space

  app.onclick = e => {
    const a = e.target.closest("[data-a]")?.dataset.a;
    if (a === "tvpics") { tvPics = tvPics === "art" ? "card" : "art"; store.set("mtga_tvpics", tvPics); document.getElementById("picsBtn").textContent = `Pictures: ${TV_PICS[tvPics]}`; if (lastRoomSnap) renderTv(lastRoomSnap); return; }
    if (a === "tvview") { tvView = { both: "cards", cards: "list", list: "both" }[tvView]; tvCards = tvView !== "list"; store.set("mtga_tvview", tvView); document.getElementById("viewBtn").textContent = `View: ${TV_VIEWS[tvView]}`; if (lastRoomSnap) renderTv(lastRoomSnap); return; }
    if (a === "sound") { const ok = unlockAudio(); document.getElementById("soundBtn").textContent = ok ? "🔊 Sound on" : "🔇 No audio"; tvSound = ok; }
    if (watch) return;
    if (a === "next") nextTurn(code);
    if (a === "take-back") takeBackTurn(code);
    if (a === "reset" && confirm("Reset life, counters, battlefields, tokens and effects for everyone?")) resetGame(code);
    if (a === "seats") { seatOpen = !seatOpen; renderSeats(); }
    if (a === "seat-rm") { const id = e.target.closest("[data-id]")?.dataset.id; if (id) removeFromTable(code, id); }
  };
  // 👥 switching players on game night: take someone out of their seat (not a ban: they can join again with the code)
  function renderSeats() {
    const el = document.getElementById("seatPanel"); if (!el) return;
    el.hidden = !seatOpen; if (!seatOpen) return;
    const room = lastRoomSnap?.val() || {}, ps = seated(room);
    el.innerHTML = `<div class="seat-head"><b>Seats</b><span class="muted">Remove a player to free their seat. They can join again with code ${esc(code)}.</span><button class="btn ghost small" data-a="seats">Close</button></div>
      <div class="seat-list">${ps.length ? ps.map(o => `<div class="seat-row" style="--pc:${esc(o.color || "#888")}"><span class="seat-dot"></span><b>${esc(o.name)}</b>${o.id === room.turn ? `<span class="muted">· their turn</span>` : ""}<button class="btn small" data-a="seat-rm" data-id="${esc(o.id)}">Remove from table</button></div>`).join("") : `<span class="muted">Nobody is seated.</span>`}</div>`;
  }
  async function removeFromTable(code, id) {
    const room = lastRoomSnap?.val() || {}, o = room.players?.[id]; if (!o) return;
    if (!confirm(`Take ${o.name} out of this game?\n\nTheir life, board and cards on this table are cleared. They can join again with the code.`)) return;
    if (room.turn === id && seated(room).length > 1) await nextTurn(code); // don't leave the turn on an empty seat
    await update(ref(db, `rooms/${code}`), { [`players/${id}`]: null, [`notes/${id}`]: null, [`orders/${id}`]: null });
    if (room.pending?.waiting?.[id]) await update(ref(db, `rooms/${code}/pending/waiting`), { [id]: null });
    await logTo(code, `👥 ${o.name} was removed from the table`);
  }
}

// Commander damage entries: key "<opponentId>~<commander>" (or just "<opponentId>" from older games)
function cmdEntries(p, ps) {
  return Object.entries(p.cmd || {}).filter(([, n]) => n > 0).map(([k, n]) => {
    const [oid, slugName] = k.split("~");
    const o = ps.find(x => x.id === oid);
    const name = slugName ? (o?.commanders || []).find(c => slugify(c) === slugName) || slugName.replace(/-/g, " ") : "";
    return { k, n, o, name };
  }).filter(x => x.o);
}
const slugify = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const shortCmd = n => n.split(",")[0].split(" // ")[0];

function permChip(e, counts, owner, id) {
  const pt = ptOf(e, counts, owner?.id, id);
  const kws = owner && /\bCreature\b/.test(e.t || "") ? kwsOf(e, owner.id, id) : [];
  const sick = owner && isSick(e, owner, id);
  const extra = extraCounters(e);
  return `<span class="perm-chip ${e.tap ? "tapped" : ""} ${e.own ? "borrowed" : ""}" ${e.own ? `style="--oc:${esc(e.own.color || "#888")}" title="${esc(e.own.name)}'s"` : ""}>${e.cmd ? "⭐ " : ""}${e.own ? "🔀 " : ""}${owner?.ring?.bearer?.id === id ? "💍 " : ""}${esc(dispName(e))}${pt ? ` <b>${pt}</b>` : ""}${extra.length ? ` <i>${esc(extra.join(" · "))}</i>` : ""}${e.imprint ? ` <i>[${esc(e.imprint)}]</i>` : ""}${kws.length ? ` <span class="kws">${esc(kws.map(x => x.k).join(", "))}</span>` : ""}${sick ? " 💤" : ""}</span>`;
}

// Shrink each player's cards until everything fits inside their panel (big boards get smaller cards)
// Card names on picture tiles: up to three lines; a name that needs more gets a smaller font until it fits
function fitTileNames(root) {
  root.querySelectorAll(".tslot.art .tcard .tc-name").forEach(el => {
    if (el.closest(".tpile") && el.closest(".tslot") !== el.closest(".tpile").lastElementChild) return; // covered pile cards show one line
    el.style.fontSize = ""; const cs = getComputedStyle(el); let fs = parseFloat(cs.fontSize) || 12;
    const pad = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
    const over = () => (el.scrollHeight - pad) > fs * 1.12 * 3 + 1 || el.scrollWidth > el.clientWidth + 1; // too many lines, or one word wider than the card
    for (let i = 0; i < 10 && fs > 7.5 && over(); i++) { fs -= 0.75; el.style.fontSize = fs + "px"; }
    el.style.overflowWrap = over() ? "anywhere" : ""; // last resort on tiny tiles: break the long word
  });
}
function fitTvCards(board) {
  board.classList.add("fitting"); // no width animations while measuring
  try { fitTvCards0(board); fitTileNames(board); } finally { void board.offsetWidth; board.classList.remove("fitting"); }
}
function fitTvCards0(board) {
  board.querySelectorAll(".panel.cardsview").forEach(panel => {
    const pc = panel.querySelector(".p-cards"); if (!pc || !pc.children.length) return;
    pc.querySelectorAll(".tpile").forEach(pl => pl.replaceWith(...pl.children)); // undo the piles of an earlier fit
    const pr = panel.getBoundingClientRect(), H = pr.bottom - pc.getBoundingClientRect().top - window.innerHeight * 0.03 - 10;
    const gx = window.innerWidth * 0.005, gy = window.innerHeight * 0.006, STRIP = 0.3, CW = 0.716;
    const slotW = k => k.classList.contains("has-att") ? CW : k.classList.contains("tapped") ? 1 : CW;
    const slotH = k => 1 + 0.24 * (Number(k.style.getPropertyValue("--na")) || 0);
    const rows = [...pc.querySelectorAll(".trow")].map(r => { const el = r.querySelector(".trow-cards");
      return { el, W: el.clientWidth, cre: /creature/i.test(r.querySelector(".trow-lbl")?.textContent || ""), slots: [...el.querySelectorAll(":scope > .tslot")].map(k => ({ k, f: slotW(k), hf: slotH(k), att: k.classList.contains("has-att") })) }; });
    // 🗂 a crowded row can fan into piles: each card shows its name strip, the last one in full
    const pileOf = (r, ch, fan) => {
      if (!fan || r.slots.length < 3 || r.slots.reduce((a, s) => a + s.f * ch + gx, 0) <= r.W + gx) return null; // fits on one line: no piles
      const plain = r.slots.filter(s => !s.att), att = r.slots.filter(s => s.att); if (plain.length < 2) return null;
      const cw = CW * ch, room = Math.max(1, Math.floor((r.W + gx - att.length * (cw + gx)) / (cw + gx)));
      const per = Math.ceil(plain.length / Math.min(plain.length, room)); if (per < 2) return null;
      const piles = []; for (let i = 0; i < plain.length; i += per) piles.push(plain.slice(i, i + per));
      return { piles, att };
    };
    const items = (r, ch, fan) => { const pl = pileOf(r, ch, fan); return pl ? [...pl.piles.map(g => [CW, 1 + STRIP * (g.length - 1)]), ...pl.att.map(s => [s.f, s.hf])] : r.slots.map(s => [s.f, s.hf]); };
    const fanRow = (r, mode) => mode === 2 || (mode === 1 && !r.cre);
    const fits = (ch, mode) => rows.reduce((tot, r, ri) => { let h = 0, lineH = 0, x = 0, lines = 0; items(r, ch, fanRow(r, mode)).forEach(([f, hf]) => { const w = f * ch; if (x && x + w > r.W) { h += lineH; lines++; x = 0; lineH = 0; } x += w + gx; lineH = Math.max(lineH, hf * ch); }); h += lineH; return tot + h + lines * gy + (ri ? gy * 1.5 : 0); }, 0) <= H;
    const best = mode => { let ch = Math.min(H, window.innerHeight * 0.26); while (ch > 28 && !fits(ch, mode)) ch *= 0.95; return ch; };
    // fan lands / artifacts first; creatures only when the board is still tiny (their P/T matter most)
    // creatures fan only as a last resort (their P/T matter in combat), when the cards would otherwise shrink to dots
    const c0 = best(0), c1 = best(1), tiny = window.innerHeight * 0.11, c2 = Math.max(c0, c1) < tiny ? best(2) : 0;
    let mode = 0, ch = c0;
    if (c1 > c0 * 1.12) { mode = 1; ch = c1; }
    if (c2 > ch * 1.12) { mode = 2; ch = c2; }
    if (window.TVFAN_DEBUG) console.log("fit", panel.querySelector(".p-name")?.textContent, Math.round(c0), Math.round(c1), Math.round(c2), "mode", mode);
    pc.style.setProperty("--ch", `${Math.floor(ch)}px`);
    rows.forEach(r => { const pl = pileOf(r, ch, fanRow(r, mode)); if (!pl) return;
      pl.piles.forEach(g => { const d = document.createElement("div"); d.className = "tpile"; g[0].k.before(d); g.forEach(s => d.appendChild(s.k)); }); });
    pc.classList.toggle("fanned", mode > 0);
    // then check where the cards really landed (screens differ): shrink until the last row sits inside the panel
    const cs = getComputedStyle(panel), limit = panel.getBoundingClientRect().bottom - (parseFloat(cs.paddingBottom) || 0) - (parseFloat(cs.borderBottomWidth) || 0) - 2;
    const lowest = () => Math.max(...[...pc.children].map(k => k.getBoundingClientRect().bottom));
    for (let i = 0; i < 30 && ch > 14 && (lowest() > limit || pc.scrollHeight > pc.clientHeight + 1); i++) { ch *= 0.94; pc.style.setProperty("--ch", `${Math.floor(ch)}px`); }
    const tx = panel.querySelector(".p-text"); // Text + cards: shrink the text column's font until it fits too
    if (tx) { let fs = 1; tx.style.setProperty("--fs", "1"); const txLow = () => Math.max(0, ...[...tx.querySelectorAll(".perm-chip, .token, .stat, .badge")].map(k => k.getBoundingClientRect().bottom));
      for (let i = 0; i < 8 && fs > 0.6 && txLow() > limit; i++) { fs -= 0.06; tx.style.setProperty("--fs", fs.toFixed(2)); } }
  });
}
// Attached Auras / Equipment ride behind their host (peeking out above it), not in their own row
const attachedIds = p => new Set(Object.entries(p.bf || {}).filter(([sid, a]) => a.att && (a.att === "tok" ? Object.values(p.tokens || {}).some(t => t.count > 0 && eqList(t).includes(sid)) : p.bf?.[a.att])).map(([sid]) => sid));
const attsOn = (p, id, t) => Object.entries(p.bf || {}).filter(([sid, a]) => a.att && (t ? a.att === "tok" && eqList(t).includes(sid) : a.att === id));
const attHtml = atts => atts.map(([, a], i) => `<div class="tatt" style="--i:${i}">${a.img && !a.fd ? `<img src="${esc(smallImg(a.img))}" alt="" loading="lazy">` : ""}<span class="tc-name">${esc(dispName(a))}</span></div>`).join("");
const attSlot = atts => atts.length ? ` has-att" style="--na:${atts.length}` : "";
// Card rows by type, each with a small sideways header ("CREATURES", "LANDS"…)
function otherLabel(perms, toks) {
  const kinds = new Set([...perms.map(e => /\bPlaneswalker\b/.test(e.t || "") ? "Planeswalkers" : /\bBattle\b/.test(e.t || "") ? "Battles" : /\bArtifact\b/.test(e.t || "") ? "Artifacts" : /\bEnchantment\b/.test(e.t || "") ? "Enchantments" : "Other"), ...(toks.length ? ["Artifacts"] : [])]);
  return kinds.size === 1 ? [...kinds][0] : kinds.size === 2 && kinds.has("Artifacts") && kinds.has("Enchantments") ? "Artifacts · Ench." : "Other";
}
const typeRows = rows => rows.filter(([, html]) => html).map(([lbl, html]) => `<div class="trow"><span class="trow-lbl">${esc(lbl)}</span><div class="trow-cards">${html}</div></div>`).join("");
// 🃏 TV card view: the card's own picture (small Scryfall size), turned sideways when tapped
const smallImg = u => tvPics === "art" ? String(u || "").replace("/normal/", "/art_crop/") : String(u || "").replace("/normal/", "/small/");
const tvSlotCls = () => tvPics === "art" ? "art" : "";
function cardTile(e, counts, owner, id, atts = []) {
  const pt = /\bCreature\b/.test(e.t || "") ? ptOf(e, counts, owner?.id, id) : "";
  const sick = owner && /\bCreature\b/.test(e.t || "") && isSick(e, owner, id);
  const extra = extraCounters(e);
  const img = e.fd ? "" : e.img; // never show what a face-down card really is
  return `<div class="tslot ${tvSlotCls()} ${e.tap ? "tapped" : ""}${attSlot(atts)}" title="${esc(dispName(e))}">${attHtml(atts)}<div class="tcard ${img ? "" : "noimg"} ${e.own ? "borrowed" : ""}" ${e.own ? `style="--oc:${esc(e.own.color || "#888")}"` : ""}>
    ${img ? `<img src="${esc(smallImg(img))}" alt="" loading="lazy" onerror="this.parentNode.classList.add('noimg');this.remove()">` : ""}
    <span class="tc-name">${e.fd ? "🂠 Face-down" : esc(dispName(e))}</span>
    <span class="tc-tags">${blockingNow(owner)[`bf:${id}`] ? "🛡" : ""}${e.cmd ? "⭐" : ""}${e.own ? "🔀" : ""}${owner?.ring?.bearer?.id === id ? "💍" : ""}${sick ? "💤" : ""}</span>
    ${extra.length ? `<span class="tc-ctr">${esc(extra.join(" · "))}</span>` : ""}
    ${pt ? `<span class="tc-pt">${pt}</span>` : ""}
  </div></div>`;
}
function landTile(e, n, atts = []) {
  const img = e.fd ? "" : e.img;
  return `<div class="tslot ${tvSlotCls()} ${e.tap ? "tapped" : ""}${attSlot(atts)}" title="${esc(dispName(e))}${n > 1 ? ` ×${n}` : ""}">${attHtml(atts)}<div class="tcard land ${img ? "" : "noimg"} ${n > 1 ? "stack" : ""}">
    ${img ? `<img src="${esc(smallImg(img))}" alt="" loading="lazy" onerror="this.parentNode.classList.add('noimg');this.remove()">` : ""}
    <span class="tc-name">${esc(dispName(e))}</span>${n > 1 ? `<span class="tc-count">×${n}</span>` : ""}</div></div>`;
}
// Official token art from Scryfall (matched by name, then size and color), cached on this screen
const TOKART = (() => { try { return JSON.parse(store.get("mtga_tokart") || "{}"); } catch { return {}; } })();
const tokArtPending = new Set(); let tokArtQ = Promise.resolve(), tvRerender = null;
const tokArtName = n => String(n || "").replace(/^\d+\/\d+\s+/, "").replace(/^(white|blue|black|red|green|colorless)(\s+and\s+(white|blue|black|red|green))?\s+/i, "").replace(/\s+tokens?$/i, "").trim();
function tokenArt(t) {
  const name = tokArtName(t.name), pt = (String(t.desc || t.name || "").match(/(\d+)\/(\d+)/) || []).slice(1), cols = (tokenPerm(t).m.match(/[WUBRG]/g) || []).join("").toLowerCase();
  const k = `${name.toLowerCase()}|${pt.join("/")}|${cols}`;
  if (k in TOKART) return TOKART[k];
  if (!name || tokArtPending.has(k)) return "";
  tokArtPending.add(k);
  tokArtQ = tokArtQ.then(async () => {
    let img = "";
    const base = `t:token !"${name}"`, size = pt.length ? ` pow=${pt[0]} tou=${pt[1]}` : "";
    for (const q of [...new Set([`${base}${size}${cols ? ` c=${cols}` : ""}`, `${base}${size}`, base])]) {
      try { const r = await fetch(`${SCRYFALL}/cards/search?q=${encodeURIComponent(q)}&include_extras=true&unique=art&order=released&dir=desc`);
        if (r.ok) { const c = (await r.json()).data?.[0]; img = c?.image_uris?.normal || c?.card_faces?.[0]?.image_uris?.normal || ""; } } catch {}
      if (img) break;
      await new Promise(res => setTimeout(res, 120)); // be gentle with Scryfall
    }
    TOKART[k] = img; tokArtPending.delete(k);
    try { store.set("mtga_tokart", JSON.stringify(TOKART)); } catch {}
    if (img) tvRerender?.();
  });
  return "";
}
function tokenTiles(p, tk, t, atts = []) {
  const pt = isCreatureToken(t.name) ? tokPTfx(t, p.id, tk) : "", up = t.count - (t.tapped || 0), sick = sickTokens(t, p, tk);
  const art = tokenArt(t);
  const tile = (n, tapped, at = []) => `<div class="tslot ${tvSlotCls()} ${tapped ? "tapped" : ""}${attSlot(at)}" title="${esc(t.name)}">${attHtml(at)}<div class="tcard ${art ? "tokimg" : "token"}">
    ${art ? `<img src="${esc(smallImg(art))}" alt="" loading="lazy">` : ""}
    <span class="tc-name">${ringBearer(p)?.k === tk ? "💍 " : ""}${esc(t.name)}</span>
    ${n > 1 ? `<span class="tc-count">×${n}</span>` : ""}${(sick && !tapped) || (!tapped && blockingNow(p)[`tok:${tk}`]) ? `<span class="tc-tags">${!tapped && blockingNow(p)[`tok:${tk}`] ? `🛡${blockingNow(p)[`tok:${tk}`] > 1 ? blockingNow(p)[`tok:${tk}`] : ""}` : ""}${sick && !tapped ? "💤" : ""}</span>` : ""}
    ${pt ? `<span class="tc-pt">${pt}</span>` : ""}</div></div>`;
  return (up > 0 ? tile(up, false, atts) : "") + (t.tapped ? tile(t.tapped, true, up > 0 ? [] : atts) : "");
}
let tvFxByOwner = {};
// 🌐 each player's always-on effects, one short line apiece (full text on hover / in the phones' "In play" list)
function panelFx(p) {
  const fx = tvFxByOwner[p.id] || []; if (!fx.length) return "";
  const MAX = 3, shown = fx.slice(0, MAX);
  return `<div class="p-fx">${shown.map(x => `<div class="pfx ${x.off ? "off" : ""}" title="${esc(x.src + ": " + x.lines.join(" "))}"><b>${esc(x.src)}</b> ${esc(x.lines.join(" "))}${x.off ? " <em>(off: tapped)</em>" : ""}</div>`).join("")}${fx.length > MAX ? `<div class="pfx more">+${fx.length - MAX} more (see phones: In play)</div>` : ""}</div>`;
}
function panel(p, ps, turn) {
  const out = isOut(p);
  const cmd = cmdEntries(p, ps);
  const tokens = Object.values(p.tokens || {}).filter(t => t.count > 0);
  const tokensE = Object.entries(p.tokens || {}).filter(([, t]) => t.count > 0);
  const effects = Object.values(p.effects || {});
  const bf = Object.values(p.bf || {});
  const counts = countsFor(p);
  const bfE = Object.entries(p.bf || {});
  const creatures = bfE.filter(([, e]) => group(e) === "creature");
  const others = bfE.filter(([, e]) => group(e) === "pw" || group(e) === "other");
  const lands = bf.filter(e => group(e) === "land");
  const tappedLands = lands.filter(e => e.tap).length;
  const taxes = Object.entries(p.tax || {}).filter(([, n]) => n > 0);
  const pcounters = PLAYER_COUNTERS.filter(c => p[c.k] > 0);
  const cardsBlock = (() => { // grouped: creatures · other permanents · lands (identical lands stacked)
      const div = `<div class="tslot tdiv"></div>`;
      const onIt = attachedIds(p), othV = others.filter(([id]) => !onIt.has(id));
      const cre = creatures.filter(([id]) => !onIt.has(id)).map(([id, e]) => cardTile(e, counts, p, id, attsOn(p, id))).join("") + tokensE.filter(([, t]) => isCreatureToken(t.name)).map(([tk, t]) => tokenTiles(p, tk, t, attsOn(p, tk, t))).join("");
      const oth = othV.map(([id, e]) => cardTile(e, counts, p, id, attsOn(p, id))).join("") + tokensE.filter(([, t]) => !isCreatureToken(t.name)).map(([tk, t]) => tokenTiles(p, tk, t, attsOn(p, tk, t))).join("");
      const stacks = new Map(); bfE.filter(([, e]) => group(e) === "land").forEach(([id, e]) => { if (onIt.has(id)) return; const at = attsOn(p, id); const k = at.length ? `att|${id}` : `${e.n}|${e.tap ? 1 : 0}|${e.fd ? 1 : 0}`; const st = stacks.get(k); if (st) st.n++; else stacks.set(k, { e, n: 1, at }); }); // an enchanted land gets its own tile
      const ghost = h => h.replace(/<div class="tslot /g, '<div class="tslot phased ');
      const phE = Object.entries(p.phased?.bf || {}), phT = Object.entries(p.phased?.tokens || {}).filter(([, t]) => t.count > 0);
      const phCre = ghost(phE.filter(([, e]) => group(e) === "creature").map(([id, e]) => cardTile(e, counts, p, id)).join("") + phT.filter(([, t]) => isCreatureToken(t.name)).map(([tk, t]) => tokenTiles(p, tk, t)).join(""));
      const phOth = ghost(phE.filter(([, e]) => group(e) === "pw" || group(e) === "other").map(([id, e]) => cardTile(e, counts, p, id)).join("") + phT.filter(([, t]) => !isCreatureToken(t.name)).map(([tk, t]) => tokenTiles(p, tk, t)).join(""));
      const phLnd = ghost(phE.filter(([, e]) => group(e) === "land").map(([id, e]) => landTile(e, 1)).join(""));
      const lnd = [...stacks.values()].sort((a, b) => (a.e.n > b.e.n ? 1 : a.e.n < b.e.n ? -1 : 0) || (a.e.tap ? 1 : 0) - (b.e.tap ? 1 : 0)).map(({ e, n, at }) => landTile(e, n, at)).join("");
      return `<div class="p-cards">${typeRows([["Creatures", cre + phCre], [otherLabel(othV.map(([, e]) => e), tokensE.filter(([, t]) => !isCreatureToken(t.name))), oth + phOth], ["Lands", lnd + phLnd]])}</div>`; });
  return `
  <section class="panel ${p.id === turn ? "active" : ""} ${out ? "out" : ""} ${tvCards ? "cardsview" : ""}" style="--pc:${esc(p.color)}">
    <div class="p-name">${esc(p.name)}${p.id === turn ? `<span class="turn-tag">Turn${tableStep ? ` · ${esc(tableStep)}` : ""}</span>` : ""}</div>
    <div class="p-life">${p.life ?? START_LIFE}</div>
    ${tvView === "both" ? `<div class="p-body"><div class="p-text">` : ""}
    <div class="p-stats">
      ${pcounters.map(c => `<span class="stat ${c.k} ${c.lethal && p[c.k] >= c.lethal ? "lethal" : ""}">${c.label} ${p[c.k]}</span>`).join("")}
      ${cmd.map(x => `<span class="stat cmd ${x.n >= 21 ? "lethal" : ""}" style="--oc:${esc(x.o.color)}">⚔ ${esc(x.name ? shortCmd(x.name) : x.o.name)} ${x.n}</span>`).join("")}
      ${p.prot ? `<span class="stat">🛡 ${esc(p.prot.src)}</span>` : ""}${p.ring?.n ? `<span class="stat ring" title="${esc(ringTitle(p))}">💍 tempted ×${p.ring.n}${ringBearer(p) ? ` · ${esc(ringBearer(p).name)}` : ""}</span>` : ""}${p.phased ? `<span class="stat">👻 ${Object.keys(p.phased.bf || {}).length + Object.values(p.phased.tokens || {}).reduce((a, t) => a + (t.count || 0), 0)} phased</span>` : ""}
      ${Object.keys(p.gy || {}).length ? `<span class="stat">🪦 ${Object.keys(p.gy).length}</span>` : ""}${Object.keys(p.ex || {}).length ? `<span class="stat">🚫 ${Object.keys(p.ex).length}</span>` : ""}
      ${taxes.map(([k, n]) => `<span class="stat">⭐ ${esc(k.split("-")[0].replace(/^\w/, m => m.toUpperCase()))} tax +${n * 2}</span>`).join("")}
    </div>
    <div class="p-effects">${effects.map(ef => `<span class="badge ${ef.dur === "turn" ? "turn" : ""}">${ef.icon} ${esc(ef.name)}${ef.dur === "turn" ? " · this turn" : ""}</span>`).join("")}${p.dg && DUNGEONS[p.dg.d] ? `<span class="badge">🏰 ${esc(DUNGEONS[p.dg.d].name)}: ${esc(DUNGEONS[p.dg.d].rooms[p.dg.r]?.n || "")}</span>` : ""}${p.dgDone ? `<span class="badge">🏆 Dungeons completed ×${p.dgDone}${p.dgList ? ` (${esc(p.dgList)})` : ""}</span>` : ""}</div>
    ${panelFx(p)}
    ${tvView === "cards" ? cardsBlock() : ""}
    ${tvView !== "cards" && creatures.length ? `<div class="p-perms">${creatures.map(([id, e]) => permChip(e, counts, p, id)).join("")}</div>` : ""}
    ${tvView !== "cards" && (others.length || lands.length) ? `<div class="p-perms">${others.map(([id, e]) => permChip(e, counts, p, id)).join("")}${lands.length ? `<span class="perm-chip land">Lands ×${lands.length}${tappedLands ? ` (${tappedLands} tapped)` : ""}</span>` : ""}</div>` : ""}
    ${Object.values(p.susp || {}).length ? `<div class="p-perms">${Object.values(p.susp).map(e => `<span class="perm-chip susp">⏳ ${esc(dispName(e))} <b>${e.time}</b></span>`).join("")}</div>` : ""}
    ${tvView !== "cards" && (Object.keys(p.phased?.bf || {}).length || Object.keys(p.phased?.tokens || {}).length) ? `<div class="p-perms">${[...Object.values(p.phased.bf || {}).map(e => dispName(e)), ...Object.values(p.phased.tokens || {}).map(t => `${t.count} ${t.name}`)].map(n => `<span class="perm-chip phased">👻 ${esc(n)} <i>phased out</i></span>`).join("")}</div>` : ""}
    ${Object.values(p.air || {}).length ? `<div class="p-perms">${Object.values(p.air).map(e => `<span class="perm-chip air">🌀 ${esc(dispName(e))} <i>cast for {2}</i></span>`).join("")}</div>` : ""}
    <div class="p-tokens">${tvView === "cards" ? "" : tokensE.map(([tk, t]) => `<span class="token">${ringBearer(p)?.k === tk ? "💍 " : ""}${esc(t.name)}${t.c || buffsOn(tokenPerm(t), p.id, tk, true).dp || buffsOn(tokenPerm(t), p.id, tk, true).dt ? ` <b>${tokPTfx(t, p.id, tk)}</b>` : ""} <b>×${t.count}</b>${sickTokens(t, p, tk) ? ` 💤${sickTokens(t, p, tk) < t.count ? sickTokens(t, p, tk) : ""}` : ""}${t.tapped ? ` <i class="tapped-note">${t.tapped === t.count ? "all tapped" : t.tapped + " tapped"}</i>` : ""}</span>`).join("")}</div>
    ${tvView === "both" ? `</div>${cardsBlock()}</div>` : ""}
    ${Object.values(p.__notes || {}).length ? `<div class="p-perms">${Object.values(p.__notes).map(n => `<span class="perm-chip gift">🎁 ${esc(n.short || n.text)}</span>`).join("")}</div>` : ""}
    ${out ? `<div class="ko-tag">💀 K.O.<small>${esc(outReason(p, ps))}</small></div>` : ""}
  </section>`;
}

// ---------- Joining ----------
async function startJoinOrPlay(code) {
  const snap = await get(ref(db, `rooms/${code}`));
  if (!snap.exists()) { renderHome(`Room ${code} wasn't found. Check the code on the TV.`); return; }
  const pid = store.get(`mtga_${code}`);
  if (pid && snap.val().players?.[pid]) startController(code, pid);
  else renderJoin(code, snap.val());
}

function renderJoin(code, room) {
  app.onclick = null;
  const ps = seated(room);
  if (ps.length >= MAX_PLAYERS) { renderHome(`Room ${code} is full (${MAX_PLAYERS} players).`); return; }
  const taken = new Set(ps.map(p => p.color));
  let color = COLORS.find(c => !taken.has(c)) || COLORS[0];
  const lastName = store.get("mtga_name") || "";
  app.innerHTML = `
  <div class="home">
    <h1>Join ${esc(code)}</h1>
    <p class="sub">${ps.length} of ${MAX_PLAYERS} seats taken</p>
    <section class="card">
      <form id="nameForm">
        <label>Your name<input id="pname" maxlength="16" required autocomplete="off" value="${esc(lastName)}"></label>
        <div class="label">Color</div>
        <div class="swatches">${COLORS.map(c => `<button type="button" class="swatch ${c === color ? "on" : ""} ${taken.has(c) ? "taken" : ""}" data-c="${c}" style="background:${c}" ${taken.has(c) ? "disabled" : ""} aria-label="color"></button>`).join("")}</div>
        <button class="btn primary wide">Take a seat</button>
      </form>
    </section>
  </div>`;
  app.querySelectorAll(".swatch:not([disabled])").forEach(b => (b.onclick = () => {
    color = b.dataset.c;
    app.querySelectorAll(".swatch").forEach(x => x.classList.toggle("on", x === b));
  }));
  document.getElementById("nameForm").onsubmit = async e => {
    e.preventDefault();
    const name = document.getElementById("pname").value.trim();
    if (!name) return;
    const fresh = (await get(ref(db, `rooms/${code}`))).val();
    const cur = seated(fresh);
    if (cur.length >= MAX_PLAYERS) { renderHome("That room just filled up."); return; }
    const seat = cur.reduce((m, p) => Math.max(m, p.seat ?? 0), -1) + 1;
    const pRef = push(ref(db, `rooms/${code}/players`));
    await set(pRef, { name, color, seat, life: START_LIFE, poison: 0 });
    store.set(`mtga_${code}`, pRef.key);
    store.set("mtga_name", name);
    logTo(code, `${name} joined`);
    startController(code, pRef.key);
  };
}

// ---------- Phone controller ----------
function startController(code, pid) {
  const valgSeen = {}; let m1Seen = null, firstGainT = -1; const sephN = {}; let masterLifeMe = null, myGySeen = null, atkCount = {}; const curseHit = new Set();
  // ----- Digital deck: play with no paper cards (library + hand kept on this phone only) -----
  let dig = (() => { try { return JSON.parse(store.get(`mtga_dig_${code}`) || "null"); } catch { return null; } })();
  const digSave = () => store.set(`mtga_dig_${code}`, JSON.stringify(dig));
  // a card of mine going back to my hand (bounce, Cyclonic Rift, graveyard → hand…) lands in the digital hand too
  const toDigHand = list => { if (!dig?.on) return; const add = list.filter(e => e && !e.own && !e.tok).map(e => e.fd?.card?.n || e.n).filter(Boolean); if (!add.length) return;
    dig.hand.push(...add); digSave(); setTimeout(() => { try { renderHand(); } catch {} }, 0); toast(`🂠 ${add.join(", ")} → your hand`); };
  // Digital deck helpers on reminders/notes: draw, wheel, look at the top, graveyard → top of library
  const digDone = new Set(); const sylvN = new Map();
  const NUMW = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
  const numW = w => /^\d+$/.test(w) ? Number(w) : NUMW[String(w).toLowerCase()] || 0;
  function digExtras(text, ref, key, hasDraw = false) {
    if (!dig?.on) return ""; const dn = k => digDone.has(key + ":" + k);
    const t = String(text || ""), out = [], N = "(a|an|one|two|three|four|five|six|seven|eight|nine|ten|\\d+)";
    const wh = t.match(new RegExp(`discards? (?:your|their) hand,? (?:and |then )?draws? ${N} cards?`, "i"));
    if (wh && !dn("wheel")) out.push(`<button class="btn small primary" data-a="dig-wheel" ${ref} data-k="${numW(wh[1])}" data-key="${esc(key)}:wheel">🂠 Discard my hand (${dig.hand.length}) → draw ${numW(wh[1])}</button>`);
    else if (!wh && !hasDraw && !dn("draw") && !/\b(?:each|target|that) (?:player|opponent)s? (?:may )?draws?\b/i.test(t)) { const d = t.match(new RegExp(`\\b(?:you may )?draw ${N} (?:additional )?cards?\\b`, "i")); if (d) out.push(`<button class="btn small" data-a="dig-drawn" ${ref} data-k="${numW(d[1])}" data-key="${esc(key)}:draw">🂠 Draw ${numW(d[1])}</button>`); }
    const lk = t.match(new RegExp(`\\b(?:scry|surveil) (\\d+)|look at the top ${N} cards? of your library`, "i"));
    if (lk && !dn("look")) { const k = Number(lk[1]) || numW(lk[2]); out.push(`<button class="btn small" data-a="dig-look" data-k="${k}" data-key="${esc(key)}:look">👁 Look at top ${k}</button>`); }
    const pb = t.match(new RegExp(`put ${N} cards? from your hand on top of your library`, "i"));
    if (pb) out.push(`<span class="mini">Then on the 🂠 Hand tab, tap a card → ⤒ Top (${numW(pb[1])}×).</span>`);
    if (/puts? all (?:the )?cards from (?:their|your) graveyard on the bottom of (?:their|your) library/i.test(t) && !dn("gybot") && Object.keys(me?.gy || {}).length) out.push(`<button class="btn small" data-a="dig-gybot" data-key="${esc(key)}:gybot">🂠 My graveyard (${Object.keys(me.gy).length}) → bottom of my library</button>`);
    if (/choose two cards in your hand drawn this turn\. for each of those cards, pay 4 life or put the card on top/i.test(t) && dn("draw") && (sylvN.get(key) || 0) < 2) { // Sylvan Library
      const tn = room?.turnNo ?? 0, left = [...dig.hand], drawn = (dig.dtTurn === tn ? dig.dtList || [] : []).filter(nm => { const j = left.indexOf(nm); if (j < 0) return false; left.splice(j, 1); return true; });
      out.push(`<span class="mini">Card ${(sylvN.get(key) || 0) + 1} of 2 drawn this turn:</span><select class="fetch-pick" id="syl-${esc(key)}">${[...drawn].reverse().map(nm => `<option value="${esc(nm)}">${esc(nm)}</option>`).join("")}</select><button class="btn small" data-a="syl-go" data-v="life" data-key="${esc(key)}">💔 Pay 4 life</button><button class="btn small" data-a="syl-go" data-v="top" data-key="${esc(key)}">⤒ Put it back</button>`); }
    const dc = !wh && t.match(new RegExp(`\\b(?:then |you may )?discard ${N} cards?( at random)?`, "i"));
    if (dc && !/\b(?:each|target) (?:player|opponent)s? discards?\b/i.test(t) && !dn("disc") && dig.hand.length) out.push(dc[2] ? `<button class="btn small" data-a="dig-disc-x" data-v="rand" data-key="${esc(key)}:disc">🎲 Discard 1 at random</button>`
      : `<select class="fetch-pick" id="ddc-${esc(key)}">${dig.hand.map((nm, i) => `<option value="${i}">${esc(nm)}</option>`).join("")}</select><button class="btn small" data-a="dig-disc-x" data-key="${esc(key)}:disc">🗑 Discard${numW(dc[1]) > 1 ? ` (${numW(dc[1])} total)` : ""}</button>`);
    if (/put (?:up to one )?target card from (?:a|your) graveyard on top of (?:its owner's|your) library/i.test(t) && !dn("gytop")) { const g = Object.entries(me?.gy || {}); if (g.length) out.push(`<select class="fetch-pick" id="dgt-${esc(key)}">${g.map(([gid, c]) => `<option value="${gid}">${esc(dispName(c))}</option>`).join("")}</select><button class="btn small" data-a="dig-gytop" data-key="${esc(key)}:gytop">⤒ On top of my library</button>`); }
    return out.length ? `<div class="row dig-x">${out.join("")}</div>` : "";
  }
  // "discard a land card" etc.: with a digital hand, pick the card from it
  function digDiscardSel(what, id) {
    if (!dig?.on || !/^discard (?:a|an|one) /i.test(what || "")) return "";
    const ty = (String(what).match(/^discard (?:a|an|one) (\w+) card/i) || [])[1];
    const ok = nm => { const c = deckCard(nm) || lookupCard(nm); return !ty || !c || new RegExp(`\\b${ty}\\b`, "i").test(c.t || ""); };
    const l = [...new Set(dig.hand.filter(ok))];
    return l.length ? `<select class="fetch-pick" id="${id}">${l.map(nm => `<option value="${esc(nm)}">${esc(nm)}</option>`).join("")}</select>` : `<span class="mini">No ${esc(ty || "")} card in your digital hand.</span>`;
  }
  function digDiscardPick(id) {
    const nm = document.getElementById(id)?.value; if (!dig?.on || !nm) return null; const j = dig.hand.indexOf(nm); if (j < 0) return null;
    dig.hand.splice(j, 1); digSave(); discardFromHand(deckCard(nm) || lookupCard(nm) || { n: nm }); setTimeout(() => { try { renderHand(); } catch {} }, 0); return nm;
  }
  // Allosaurus Shepherd: "Until end of turn, each Elf creature you control has base power and toughness 5/5…"
  // "Tokens you control gain indestructible until your next turn": marks the stacks that exist now (new tokens stack separately)
  function markTokInd(src) { const until = (room?.turnNo || 0) + Math.max(1, seated(room).length) - 1;
    mutate(p => { Object.values(p.tokens || {}).forEach(t => { if (t.count > 0) { t.ind = until; t.indSrc = src; } }); tidyTokenStacks(p); }); }
  const plural = w => /f$/i.test(w) ? w.replace(/f$/i, "ves") : /(s|x|ch|sh)$/i.test(w) ? w + "es" : w + "s";
  const BASE_SET = /until end of turn, each ([A-Za-z]+) creature you control has base power and toughness (\d+)\/(\d+)/i;
  function baseSetBtn(r) { const m = String(r.text || "").match(BASE_SET); return m && !r.baseDone ? `<div class="row"><button class="btn small primary" data-a="base-go" data-id="${r.id}">Make my ${esc(plural(m[1]))} ${m[2]}/${m[3]} this turn</button></div>` : ""; }
  function applyBaseSet(r) {
    const m = String(r.text || "").match(BASE_SET); if (!m) return;
    const ty = m[1], P = Number(m[2]), T = Number(m[3]), isTy = (t, o) => new RegExp(`\\b${ty}\\b`, "i").test(t || "") || /\bchangeling\b/i.test(o || "");
    const num = v => Number.isFinite(Number(v)) ? Number(v) : 0;
    const cards = Object.entries(me.bf || {}).filter(([, e]) => /\bCreature\b/.test(e.t || "") && isTy(e.t, e.o || lookupCard(e.n)?.o)).map(([id, e]) => [id, num(e.p ?? lookupCard(e.n)?.p), num(e.tg ?? lookupCard(e.n)?.tg)]);
    const toks = Object.entries(me.tokens || {}).filter(([, t]) => isCreatureToken(t.name) && isTy(`${t.name} ${t.desc || ""}`, t.desc)).map(([k, t]) => { const pt = String(t.desc || "").match(/(\d+)\/(\d+)/) || [0, 1, 1]; return [k, Number(pt[1]), Number(pt[2])]; });
    if (!cards.length && !toks.length) { toast(`No ${ty} creatures to change.`); return; }
    mutate(p => { p.eot ||= {}; const nid = () => `b${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
      cards.forEach(([id, bp, bt]) => { if (p.bf?.[id]) p.eot[nid()] = { src: r.src, target: id, dp: P - bp, dt: T - bt, kws: [] }; });
      toks.forEach(([k, bp, bt]) => { const t = p.tokens?.[k]; if (!t) return; const eid = nid(); t.ep = [...(t.ep || []), eid]; p.eot[eid] = { src: r.src, epTag: true, ids: [], toks: [], dp: P - bp, dt: T - bt, kws: [] }; }); });
    r.baseDone = true; logTo(code, `⚙ ${r.src}: ${me.name}'s ${plural(ty)} have base ${P}/${T} until end of turn (${[...cards.map(([id]) => dispName(me.bf[id])), ...toks.map(([k]) => `${me.tokens[k].name} tokens`)].join(", ")})`);
  }
  // Demonic Consultation / Tainted Pact, resolved against the digital library
  function consultBox(r) {
    if (!r.consult || !dig?.on) return "";
    if (r.consult === "dc") { const names = [...new Set([...(deck?.cards || []).map(c => c.n), ...dig.lib])].sort((a, b) => a.localeCompare(b));
      return `<div class="row"><select class="fetch-pick" id="dcn-${r.id}"><option value="">(a name not in my library: exile it all)</option>${names.map(n => `<option value="${esc(n)}">${esc(n)}</option>`).join("")}</select><button class="btn small primary" data-a="dc-go" data-id="${r.id}">🂠 Name it and resolve</button></div>`; }
    const ex = r.tpEx || [], last = ex.at(-1), dup = last && ex.indexOf(last) !== ex.length - 1;
    return `<div class="row">${ex.length ? `<span class="mini">Exiled: ${esc(ex.join(", "))}</span>` : ""}${dup ? `<span class="mini">Two with the same name: it stops.</span><button class="btn small" data-a="tp-done" data-id="${r.id}">Done</button>`
      : `${last ? `<button class="btn small primary" data-a="tp-take" data-id="${r.id}">✋ Take ${esc(last)}</button>` : ""}<button class="btn small" data-a="tp-step" data-id="${r.id}">🂠 Exile the next card</button><button class="btn small" data-a="tp-all" data-id="${r.id}">Exile everything (take nothing)</button>`}</div>`;
  }
  const exileNames = names => { if (!names.length) return; act([], p => names.forEach(nm => { const c = deckCard(nm) || lookupCard(nm) || { n: nm }; toZone(p, { n: c.n, t: c.t || "", m: c.m || "", ...(c.o ? { o: c.o } : {}) }, "ex"); })); };
  function digTextOf(r) { // a spell's reminder may have lost the "look at the top…" part; read the card too
    let t = r.text || "";
    if (!/scry|surveil|look at the top/i.test(t)) { const c = lookupCard(r.src) || deckCard(r.src); if (c && /\b(Instant|Sorcery)\b/.test(c.t || "") && reminders.find(x => x.src === r.src) === r) t += " " + String(c.o || "").replace(/\n/g, " "); }
    return t;
  }
  const digShuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const digFull = () => (deck?.cards || []).filter(c => !(deck.cmds || []).includes(c.n)).flatMap(c => Array(c.qty || 1).fill(c.n));
  function digDraw(n = 1, bottom = false) { if (!dig) return 0; let k = 0; const tn = room?.turnNo ?? 0; if (dig.dtTurn !== tn) { dig.dtTurn = tn; dig.dtList = []; }
    for (let i = 0; i < n && dig.lib.length; i++, k++) { const c = bottom ? dig.lib.pop() : dig.lib.shift(); dig.hand.push(c); dig.dtList.push(c); } if (k < n) toast("Your library is empty."); digSave(); return k; }
  function digNew(draw = 7) { dig = { on: true, deckId: lib.active, lib: digShuffle(digFull()), hand: [], peek: 0, mull: 0 }; digDraw(draw); }
  let planarT = -1, planarN = 0, actTargeting = false; const valiantSeen = new Set();
  // Valiant: the first time each turn one of my spells or abilities targets this creature
  function heroicCheck(id) { // Heroic: a spell of mine targeted it (Aura spells, spell target pickers)
    const e = me?.bf?.[id]; if (!e) return;
    const m = String(e.o || lookupCard(e.n)?.o || "").match(/^heroic — whenever you cast a spell that targets (?:this creature|[^,]+), ([^\n]+)/im); if (!m) return;
    const sp = spellAbility({ n: `${e.n} · heroic`, t: "Instant", o: m[1] });
    reminders.push(normalizeRem({ id: newId(), src: `${dispName(e)} (heroic)`, srcId: id, text: m[1].replace(/^\w/, c => c.toUpperCase()), times: 1, ...(sp.effs.length ? { effs: sp.effs } : {}) }));
    setTimeout(render, 0);
  }
  function valiantCheck(id, isSpell = true) {
    if (isSpell) heroicCheck(id);
    const e = me?.bf?.[id]; if (!e) return;
    const m = String(e.o || lookupCard(e.n)?.o || "").match(/^valiant — whenever this creature becomes the target of a spell or ability you control for the first time each turn, ([^\n]+)/im);
    const k = `${id}:${room?.turnNo || 0}`; if (!m || valiantSeen.has(k)) return; valiantSeen.add(k);
    const ig = m[1].match(/^it gets \+(\d+)\/\+(\d+)(?: and gains ([a-z ]+?))? until end of turn\.?$/i);
    if (ig) { act([{ type: "effects", effs: [{ k: "pumpOn", target: { kind: "bf", id }, dp: Number(ig[1]), dt: Number(ig[2]), kws: ig[3] ? ig[3].split(/ and |, /) : [] }], times: 1, count: 1, src: `${dispName(e)} (valiant)`, srcId: id }]); return; }
    const sp = spellAbility({ n: `${e.n} · valiant`, t: "Instant", o: m[1] });
    reminders.push(normalizeRem({ id: newId(), src: `${dispName(e)} (valiant)`, srcId: id, text: m[1].replace(/^\w/, c => c.toUpperCase()), times: 1, ...(sp.effs.length ? { effs: sp.effs.map(f => f.k === "pumpTarget" && /^it gets/i.test(m[1]) ? { k: "pumpOn", target: { kind: "bf", id }, dp: f.dp || 0, dt: f.dt || 0, kws: f.kws || [] } : f) } : {}) }));
    setTimeout(render, 0);
  }
  const warCredit = {}; // War Elemental: damage my own sources already counted, by opponent name
  let me = null, room = null, pendingEffect = null, dead = false, lifeSeen = null, manualUp = 0, prepWatch = [], gySeen = null, exSeen = null, combatSeen = null, tapSeen = null, oppLandSeen = null, pairsSeen = null, oppLifeSeen = null, hitOnce = {}, castHaste = null, castHasteNow = null, oppEndSeen = null, envTurn = null, manualDown = 0, bloodSkip = 0, lockSkip = 0, restoreSkip = 0, lastKicked = false, artTapSeen = null, recentTrig = [];
  let tab = store.get("mtga_tab") || "life";
  const lib = loadLib();
  let deck = lib.decks[lib.active] || null;
  const saveDeck = () => saveLib(lib);
  function newDeck(d) {
    const id = newId();
    lib.decks[id] = d; lib.active = id; deck = d;
    saveLib(lib);
  }
  function useDeck(id) {
    lib.active = id && lib.decks[id] ? id : null;
    deck = lib.active ? lib.decks[lib.active] : null;
    saveLib(lib);
    searchEl.value = "";
    deckChanged();
  }
  const anyCache = new Map();
  const expanded = new Set();
  let rmOpen = null;
  let tapOpen = null; // token row showing tap / untap controls
  let atkOpen = null; // token row showing attack controls
  let poolOpen = false; // mana pool "add" row
  let trampleDmg = null; // set by "Blocked: take trample damage" for the take-damage step
  const resolvedCount = {}; // "second time this ability resolved this turn" tracking // token row showing the "how did it leave?" choices
  let auto = store.get("mtga_auto") !== "off";
  let trackMana = store.get("mtga_mana") === "on"; // optional: ⚡ tap-for-mana buttons that fill the mana pool
  let reminders = [];
  const lookupCard = name => deck?.cards.find(c => c.n === name)
    || Object.values(lib?.decks || {}).flatMap(d => d.cards).find(c => c.n === name)
    || anyCache?.get(name)
    || Object.values(me?.bf || {}).find(e => e.n === name && e.o)
    || null;
  const undo = [], undoMeta = [], redo = [];
  let actSeq = 0, actLabel = "", pendLog = null, digAtAct = null;
  let orderTriggers = (() => { try { return localStorage.getItem("mtga_order") !== "0"; } catch { return true; } })();
  let turnAlerts = (() => { try { return !!localStorage.getItem("mtga_alerts"); } catch { return false; } })();
  function turnAlert() {
    if (!turnAlerts) return;
    try { navigator.vibrate?.([250, 120, 250]); } catch {}
    try { playTurnChime(); } catch {}
    try { if (document.hidden && "Notification" in window && Notification.permission === "granted") new Notification("🃏 Your turn", { body: `Round ${room?.round || 1} — it's your turn in Triggernomicon.`, tag: "mtga-turn" }); } catch {}
    try { const t0 = document.title; let k = 0; const iv = setInterval(() => { document.title = k++ % 2 ? t0 : "🔔 Your turn!"; if (k > 12 || !document.hidden) { clearInterval(iv); document.title = t0; } }, 800); } catch {}
  }
  const undoExt = []; // opponent life changes made alongside each undo step
  const pending = {};
  const pPath = `rooms/${code}/players/${pid}`;

  // Groups rapid taps into one log line (e.g. five taps of -1 → "lost 5 life")
  const logDelta = (key, d, fmt) => {
    const p = (pending[key] ||= { d: 0 });
    p.d += d;
    clearTimeout(p.timer);
    p.timer = setTimeout(() => { if (p.d) logTo(code, fmt(p.d)); delete pending[key]; }, 1500);
  };
  const clearPending = () => Object.keys(pending).forEach(k => { clearTimeout(pending[k].timer); delete pending[k]; });

  app.innerHTML = `
  <div class="ctl-wrap">
  <div class="ctl">
    <div id="wideAsk"></div>
    <div class="sticky-top">
      <div id="ctlHead" class="ctl-head"></div>
      <nav class="tabs">
        <button data-a="tab" data-tab="life">Life</button>
        <button data-a="tab" data-tab="board">Board</button>
        <button data-a="tab" data-tab="deck">Deck</button>
        <button data-a="tab" data-tab="hand" id="handTab" hidden>🂠 Hand</button>
        <button data-a="tab" data-tab="table">🌐 Table</button>
      </nav>
      <div id="stepBar"></div>
      <div id="poolBar"></div>
    </div>
    <div id="remBox"></div>

    <div class="pane" data-pane="life">
      <div id="lifeMain"></div>
      <div id="lifeBody"></div>
      <div id="ctlEffects"></div>
    </div>

    <div class="pane" data-pane="board">
      <section class="card">
        <div class="card-head"><h3>Play a card</h3><button class="btn small" id="autoBtn" data-a="auto"></button></div>
        <input id="deckSearch" type="search" class="full" placeholder="Search your deck…" autocomplete="off">
        <div id="searchResults" class="results"></div>
        <details class="any-card">
          <summary>Card not in your deck?</summary>
          <input id="anySearch" type="search" class="full" placeholder="Search every card…" autocomplete="off">
          <div id="anyResults" class="results"></div>
        </details>
      </section>
      <div id="cmdZone"></div>
      <div id="bfList"></div>
      <div id="tokList"></div>
      <div id="airList"></div>
      <div id="zoneList"></div>
      <div id="suspList"></div>
      <section class="card" data-tour="tokens">
        <h3>Make tokens</h3>
        <div class="chips">${TOKEN_PRESETS.map(n => `<button class="chip" data-a="tok-add" data-name="${esc(n)}">+ ${esc(n)}</button>`).join("")}</div>
        <form id="customToken" class="row">
          <input id="tokName" placeholder="Other token (e.g. 1/1 Bird)" maxlength="30" autocomplete="off">
          <button class="btn">Add</button>
        </form>
      </section>
    </div>

    <div class="pane" data-pane="hand"><div id="handPane"></div></div>
    <div class="pane" data-pane="table"><div id="tablePane"></div></div>

    <div class="pane" data-pane="deck">
      <div id="deckInfo"></div>
      <section class="card">
        <h3>Add a card</h3>
        <input id="addSearch" type="search" class="full" placeholder="Search every card…" autocomplete="off">
        <div id="addResults" class="results"></div>
      </section>
      <section class="card" id="deckListCard">
        <div class="card-head"><h3>Deck list</h3><span id="deckCount" class="muted"></span></div>
        <input id="listFilter" type="search" class="full" placeholder="Filter your deck…" autocomplete="off">
        <div id="deckList" class="results"></div>
      </section>
      <section class="card" data-tour="import">
        <h3>Import a deck</h3>
        <p class="muted">Paste a decklist exported from Moxfield, Archidekt, MTG Arena, or similar. Put your commander under a "Commander" heading, or pick it after importing. Each import is saved as a new deck on this phone, so you can keep several and switch above.</p>
        <textarea id="deckText" rows="8" placeholder="Commander&#10;1 Chatterfang, Squirrel General&#10;&#10;Deck&#10;1 Sol Ring&#10;1 Academy Manufactor&#10;…"></textarea>
        <button id="importBtn" class="btn primary wide">Import deck</button>
        <p id="importStatus" class="muted"></p>
      </section>
    </div>

    <div class="ctl-foot">
      <button class="btn" data-a="undo" id="undoBtn" title="Undo your last action on your own board (life, cards, tokens, counters, reminders, and life you made opponents lose)">↶ Undo</button>
      <button class="btn" data-a="redo" id="redoBtn">↷ Redo</button>
      <button class="btn" data-a="alerts" id="alertBtn">🔔 Turn alerts</button>
      <button class="btn" data-a="order-mode" id="orderBtn">🔀 Order triggers</button>
      <button class="btn" data-a="wide" id="wideBtn" title="Computer layout: your controls and the live table side by side">🖥 Computer layout</button>
      <button class="btn" data-a="tour" id="tourBtn" title="Replay the quick tour of the app">🎓 Tutorial</button>
      <button class="btn ghost" data-a="leave">Leave game</button>
    </div>
    <p class="ver">Version ${APP_VERSION}</p>
  </div>
  <aside id="sideTable" class="side-table"></aside>
  </div>
  <div id="cardModal" class="modal" hidden></div>`;

  const $ = id => document.getElementById(id);
  const head = $("ctlHead"), lifeMain = $("lifeMain"), lifeBody = $("lifeBody"), effEl = $("ctlEffects");
  const cmdZone = $("cmdZone"), bfList = $("bfList"), tokList = $("tokList"), deckInfo = $("deckInfo");
  const searchEl = $("deckSearch"), resultsEl = $("searchResults"), anyEl = $("anySearch"), anyRes = $("anyResults");
  const modal = $("cardModal");

  // ----- 🖥 Computer layout: controls on the left, the live table on the right -----
  let wide = store.get("mtga_layout") === "wide";
  function applyWide() {
    document.body.classList.toggle("wide", wide);
    const wb = document.getElementById("wideBtn"); if (wb) wb.textContent = wide ? "📱 Phone layout" : "🖥 Computer layout";
    const tt = app.querySelector('.tabs [data-tab="table"]'); if (tt) tt.hidden = wide; // the table is always showing
    if (wide && tab === "table") { tab = "life"; store.set("mtga_tab", tab); }
    const st = document.getElementById("sideTable"); if (st && !wide) st.innerHTML = "";
    // first visit on a big screen with a mouse: offer it once
    const ask = document.getElementById("wideAsk");
    if (ask) ask.innerHTML = !store.get("mtga_layout") && window.innerWidth >= 1100 && window.matchMedia?.("(pointer: fine)")?.matches
      ? `<div class="wide-ask">🖥 On a computer? Use the computer layout: your controls and the live table side by side. <button class="btn small primary" data-a="wide-yes">Use it</button><button class="btn small" data-a="wide-no">No thanks</button></div>` : "";
  }
  applyWide();

  // ----- Tabs -----
  function applyTab() {
    { const ht = document.getElementById("handTab"); if (ht) ht.hidden = !dig?.on; if (tab === "hand" && !dig?.on) tab = "deck"; }
    app.querySelectorAll(".pane").forEach(p => (p.hidden = p.dataset.pane !== tab));
    app.querySelectorAll(".tabs button").forEach(b => b.classList.toggle("on", b.dataset.tab === tab));
  }
  applyTab();

  // ----- Quick tour (first join; replay any time from 🎓 Tutorial) -----
  // mtga_tour: unset = show on first join, "seen" = don't auto-show, "always" = show on every join
  const TOUR = () => [
    { h: "Welcome to Triggernomicon 👋", b: "Your phone is your controller: life, cards and triggers live here, and the TV shows everyone's board. This quick tour shows you around. It takes about a minute." },
    { sel: '#ctlHead [data-a="start"], #ctlHead [data-a="end"], #ctlHead .banner', h: "Turns", b: "Whoever goes first taps <b>Start game: I go first</b>. After that, this button says <b>End turn</b> when it's your turn, so the app knows when upkeep, combat and end-step triggers happen." },
    { sel: "#ctlHead .head-row", h: "Top bar", b: "📜 <b>Log</b> shows everything that's happened this game. Tap 🂠 <b>Drew</b> when you draw an <i>extra</i> card from a spell or ability, so draw triggers fire. You don't need it for your draw step: the app counts that draw automatically when your turn starts. Your life is always shown on the right." },
    { tab: "life", sel: '.tabs [data-tab="life"]', h: "Life tab", b: "Your life total, player counters and commander damage. Every change you make here shows up on the TV." },
    { tab: "life", sel: "#lifeMain .life-btns", h: "Change your life", b: "Tap −5, −1, +1 or +5. Quick taps get grouped into one line in the game log, like \"lost 5 life\"." },
    { tab: "life", sel: '[data-tour="pc"]', h: "Player counters", b: "Poison, energy, experience and more. Poison turns red at 10." },
    { tab: "life", sel: '[data-tour="cmd"]', h: "Commander damage", b: "When an opponent's commander hits you, add it under that player. 21 from one commander is lethal." },
    { tab: "board", sel: '.tabs [data-tab="board"]', h: "Board tab", b: "Your battlefield. Everything you play goes here, and the app watches it for triggers and combos." },
    { tab: "board", sel: "#deckSearch", h: "Play a card", b: "Search your deck and tap a card to play it. If it has a trigger the app understands, a reminder pops up at the top of the screen with buttons to apply it." },
    { tab: "board", sel: "#autoBtn", h: "Auto triggers", b: "On: simple triggers (gain life, make tokens, add counters) happen by themselves. Off: every trigger waits for you to tap Apply." },
    { tab: "board", sel: '[data-tour="tokens"]', h: "Tokens", b: "One tap for common tokens, or type any other token you need." },
    { tab: "board", sel: "#undoBtn", h: "Undo", b: "Tapped the wrong thing? Undo takes back your last action, including reminders and life you made opponents lose." },
    { tab: "deck", sel: '.tabs [data-tab="deck"]', h: "Deck tab", b: "Your saved decks, the triggers the app understands in your deck, your card list, and import." },
    { tab: "deck", sel: '[data-tour="dig"]', h: "No cards? No problem", b: "Forgot your cards? Play your deck from your phone: shuffle, draw, mulligan, scry and search. A Hand tab appears while it's on." },
    { tab: "table", sel: '.tabs [data-tab="table"]', h: "Table tab", b: "Everyone's board on your phone: life, commander damage and every permanent, with pictures. Handy if you're playing remotely or can't see the TV. Tap a picture to see the whole card." },
    { tab: "life", sel: "#wideBtn", h: "Playing from a computer?", b: "Tap 🖥 Computer layout (at the bottom of any tab) to put your controls and the live table side by side. Tap it again to switch back to the phone layout." },
    { tab: "deck", sel: '[data-tour="import"]', h: "Last step: import your deck", last: true,
      b: deck ? `You already have <b>${esc(deck.name || "a deck")}</b> loaded. To add another, export it as text from Moxfield, Archidekt or Arena, paste it here and tap <b>Import deck</b>.`
        : "Export your deck as text from Moxfield, Archidekt or MTG Arena, paste it in this box and tap <b>Import deck</b>. Put your commander under a \"Commander\" heading, or pick it after importing." },
  ];
  let tourEl = null, tourI = 0, tourSteps = [];
  function tourEnd(focusImport) {
    if (!tourEl) return;
    tourEl.remove(); tourEl = null;
    window.removeEventListener("resize", tourPlace); window.removeEventListener("scroll", tourPlace, true);
    if (store.get("mtga_tour") !== "always") store.set("mtga_tour", "seen");
    if (focusImport) { tab = "deck"; store.set("mtga_tab", tab); applyTab(); const t = $("deckText"); t?.scrollIntoView({ block: "center" }); setTimeout(() => t?.focus(), 350); }
  }
  function tourPlace() {
    if (!tourEl || !tourSteps[tourI]) return;
    const st = tourSteps[tourI], spot = tourEl.querySelector(".tour-spot"), pop = tourEl.querySelector(".tour-pop");
    const el = st.sel && document.querySelector(st.sel);
    const r = el && !el.closest("[hidden]") ? el.getBoundingClientRect() : null;
    const vw = window.innerWidth, vh = window.innerHeight, pad = 6;
    if (!r || !r.width) { spot.hidden = true; pop.classList.add("center"); pop.style.top = pop.style.left = ""; tourEl.classList.add("dim"); return; }
    tourEl.classList.remove("dim"); spot.hidden = false; pop.classList.remove("center");
    Object.assign(spot.style, { top: `${r.top - pad}px`, left: `${r.left - pad}px`, width: `${r.width + pad * 2}px`, height: `${r.height + pad * 2}px` });
    const ph = pop.offsetHeight, pw = Math.min(340, vw - 24);
    pop.style.left = `${Math.max(12, Math.min(vw - pw - 12, r.left + r.width / 2 - pw / 2))}px`;
    const below = r.bottom + pad + 10, above = r.top - pad - 10 - ph;
    pop.style.top = `${below + ph <= vh - 8 || above < 8 ? Math.min(below, vh - ph - 8) : above}px`;
  }
  function tourShow(i) {
    tourI = Math.max(0, Math.min(tourSteps.length - 1, i));
    const st = tourSteps[tourI];
    if (st.tab && (st.tab !== tab)) { tab = st.tab; store.set("mtga_tab", tab); applyTab(); }
    const el = st.sel && document.querySelector(st.sel);
    if (el && !el.closest(".sticky-top")) {
      const sticky = app.querySelector(".sticky-top")?.offsetHeight || 0, r = el.getBoundingClientRect();
      if (r.height > window.innerHeight * 0.4) window.scrollTo(0, window.scrollY + r.top - sticky - 8); // tall card: line its top up under the tabs
      else el.scrollIntoView({ block: "center" });
    }
    else if (st.tab) window.scrollTo(0, 0);
    tourEl.querySelector(".tour-pop").innerHTML = `
      <div class="tour-step">${tourI + 1} / ${tourSteps.length}</div>
      <h3>${st.h}</h3>
      <p>${st.b}</p>
      ${tourI === 0 || st.last ? `<label class="tour-always"><input type="checkbox" data-t="always" ${store.get("mtga_tour") === "always" ? "checked" : ""}> Show this tour every time I join a game</label>` : ""}
      <div class="row">
        ${tourI ? `<button class="btn" data-t="back">Back</button>` : `<button class="btn ghost" data-t="skip">Skip tour</button>`}
        ${st.last ? `<button class="btn primary" data-t="import">Import my deck</button>` : `<button class="btn primary" data-t="next">${tourI ? "Next" : "Show me"}</button>`}
      </div>
      ${tourI && !st.last ? `<button class="tour-x" data-t="skip" aria-label="Close tour">✕</button>` : ""}
      ${st.last ? `<button class="tour-x" data-t="done" aria-label="Close tour">✕</button>` : ""}`;
    (window.requestAnimationFrame || setTimeout)(tourPlace); setTimeout(tourPlace, 250);
  }
  function startTour() {
    if (tourEl) return;
    tourSteps = TOUR().filter(st => !(wide && st.tab === "table")); // computer layout: the table is already on screen
    tourEl = document.createElement("div");
    tourEl.id = "tour";
    tourEl.innerHTML = `<div class="tour-spot"></div><div class="tour-pop" role="dialog" aria-live="polite"></div>`;
    document.body.appendChild(tourEl);
    tourEl.addEventListener("click", e => {
      const t = e.target.closest("[data-t]")?.dataset.t;
      if (t === "always") { store.set("mtga_tour", e.target.checked ? "always" : "seen"); return; }
      if (t === "next") tourShow(tourI + 1);
      else if (t === "back") tourShow(tourI - 1);
      else if (t === "skip" || t === "done") tourEnd(false);
      else if (t === "import") tourEnd(true);
    });
    window.addEventListener("resize", tourPlace); window.addEventListener("scroll", tourPlace, true);
    tourShow(0);
  }
  { // auto-start once the controller has drawn
    const t0 = Date.now(), iv = setInterval(() => {
      if (Date.now() - t0 > 20000 || !document.body.contains(app.querySelector(".ctl"))) { clearInterval(iv); return; }
      if (!me || !app.querySelector("#lifeMain .life-btns")) return;
      clearInterval(iv);
      const pref = store.get("mtga_tour");
      if (pref !== "seen") { try { startTour(); } catch (err) { tourEl?.remove(); tourEl = null; console.warn("tour", err); } }
    }, 300);
  }

  // ----- State changes -----
  async function mutate(fn, merge = false) {
    if (!me) return;
    if (!undo.length || (!merge && undoMeta.at(-1)?.seq !== actSeq)) { undo.push(clone(me)); undoExt.push(null); undoMeta.push({ seq: actSeq, label: actLabel, rem: clone(reminders || []), dig: digAtAct?.seq === actSeq ? digAtAct.dig : (dig ? clone(dig) : null), ...(pendLog?.seq === actSeq ? { log: pendLog.text } : {}) }); redo.length = 0; }
    if (undo.length > 50) { undo.shift(); undoExt.shift(); undoMeta.shift(); }
    const next = clone(me);
    fn(next);
    me = next;
    render();
    await set(ref(db, pPath), next);
  }

  // Runs game events through the trigger engine as one undoable change
  // pre: changes before triggers resolve; post: changes after (things leaving at the same time still "see" the event)
  // opts.tag: remember this change as a spell's resolution (so a counterspell can reverse it); opts.merge: same Undo step as the last change
  // Every creature's power, anthems included (Ferocious, Shamanic Revelation)
  function powersNow() {
    return [...Object.entries(me.bf || {}).filter(([, e]) => /\bCreature\b/.test(e.t || "")).map(([id, e]) => Number(ptOf(e, countsFor(me), pid, id).split("/")[0]) || 0),
      ...Object.entries(me.tokens || {}).filter(([, t]) => t.count > 0 && isCreatureToken(t.name)).flatMap(([k, t]) => Array(t.count).fill(Number(String(tokPTfx(t, pid, k) || "0").split("/")[0]) || 0))];
  }
  // Greatest power among my creatures (Overwhelming Stampede)
  function maxPowerNow() {
    const pw = [...Object.entries(me.bf || {}).filter(([, e]) => /\bCreature\b/.test(e.t || "")).map(([id, e]) => Number(ptOf(e, countsFor(me), pid, id).split("/")[0]) || 0),
      ...Object.entries(me.tokens || {}).filter(([, t]) => t.count > 0 && isCreatureToken(t.name)).map(([k, t]) => Number(String(tokPTfx(t, pid, k) || "0").split("/")[0]) || 0)];
    return pw.length ? Math.max(...pw) : 0;
  }
  function act(events, pre, post, opts = {}) {
    if (actTargeting) events?.forEach(ev => (ev.effs || []).forEach(f => { if (f.target?.kind === "bf" && /^(pumpOn|countersOn|kwOn|tapOn|untapOn)$/.test(f.k || "")) valiantCheck(f.target.id); }));
    if (room?.dieGain && events?.some(ev => ev.type === "dies" && !ev.foreign)) dieGainCheck(events);
    const needPow = events.some(ev => ev.effs?.some(f => f.xGreatest || f.fero || f.minPow != null));
    const attackers = room?.combat?.turnNo === (room?.turnNo || 0) ? room.combat.n || 0 : 0;
    const ctx = { logs: [], remind: [], drain: 0, who: me.name, attackers, ...(etbX != null ? { x: etbX } : {}), ...(needPow ? { maxPower: maxPowerNow(), powers: powersNow() } : {}),
      oppCre: seated(room || {}).filter(o => o.id !== pid && !isOut(o)).reduce((a, o) => a + Object.values(o.bf || {}).filter(e => /\bCreature\b/.test(e.t || "")).length + Object.values(o.tokens || {}).filter(t => isCreatureToken(t.name)).reduce((b, t) => b + (t.count || 0), 0), 0) };
    etbX = null;
    const bfBefore = me?.bf ? { ...me.bf } : {};
    const eqToks = Object.entries(me?.tokens || {}).filter(([, t]) => t.eq && t.count > 0 && isCreatureToken(t.name)).map(([k, t]) => [k, t.count, eqList(t)]); // equipped tokens: "whenever equipped creature dies"
    const tag = opts.tag || (activeCast && steps[activeCast] && !steps[activeCast].reverted ? activeCast : null);
    const before = tag ? clone(me) : null;
    let tokGone = 0, entered = 0, enteredNames = [], enteredPT = [], untapEnt = [];
    const tokTally = p => { const m = {}; Object.values(p.tokens || {}).forEach(t => { if (!t.own) m[t.name] = (m[t.name] || 0) + (t.count || 0); }); return m; };
    events.forEach((ev, i) => { if (ev.type !== "dies" || ev.ts) return;
      if (ev.ids?.length) ev.ts = ev.ids.map(id => (me.bf?.[id] || bfBefore?.[id])?.t || "");
      else if (ev.token) { const sac = events.slice(0, i).reverse().find(x => x.type === "sac" && x.token && x.name), nm = sac?.name || ev.name; if (nm) ev.ts = [tokenPerm(Object.values(me.tokens || {}).find(t => t.name === nm) || { name: nm }).t]; } });
    mutate(p => { const b4 = tokTally(p); if (pre) pre(p); runEvents(p, events, ctx, { enabled: auto, lookup: lookupCard, env: boardEnv(), turnNo: room?.turnNo || 0, cz: deck?.cmds || [] }); if (post) post(p); const af = tokTally(p); tokGone = Object.entries(b4).reduce((a, [n, c]) => a + Math.max(0, c - (af[n] || 0)), 0);
      Object.entries(af).forEach(([n, c]) => { const g = c - (b4[n] || 0); if (g > 0 && isCreatureToken(n)) { const tk = Object.values(p.tokens || {}).find(t => t.name === n), pt = String(tk?.desc || "").match(/(\d+)\/(\d+)/); if (pt) for (let q = 0; q < Math.min(g, 10); q++) enteredPT.push({ p: Number(pt[1]), t: Number(pt[2]) }); entered += g; enteredNames.push(`${g > 1 ? g + " " : ""}${n} token${g > 1 ? "s" : ""}`); } });
      Object.entries(p.bf || {}).forEach(([id, e]) => { if (!bfBefore[id] && /\b(Artifact|Creature)\b/.test(e.t || "") && !e.own && !e.tapped) untapEnt.push(e.nick || e.n); });
      Object.entries(p.bf || {}).forEach(([id, e]) => { if (!bfBefore[id] && /\bCreature\b/.test(e.t || "") && !e.own) { entered += 1; enteredNames.push(e.nick || e.n); enteredPT.push({ id, p: Number(e.p) || 0, t: Number(e.tg) || 0, ty: e.t || "" }); } }); }, !!opts.merge);
    if (enteredPT.length && Object.values(me.bf || {}).some(e => /^Evolve\b/m.test(e.o || lookupCard(e.n)?.o || ""))) setTimeout(() => evolveCheck(enteredPT), 0);
    { const gs = Object.entries(me.bf || {}).map(([gid, x]) => [gid, x, String(x.o || lookupCard(x.n)?.o || "").match(/[Ee]ach other ([A-Z][a-z]+) you control enters with an additional \+1\/\+1 counter on it for each \1 you already control/)]).filter(([, , m]) => m);
      gs.forEach(([gid, g, m]) => { const typ = new RegExp(`\\b${m[1]}\\b`), ent = enteredPT.filter(x => x.id && x.id !== gid && typ.test(x.ty || "")); if (!ent.length) return;
        const already = Object.entries(bfBefore).filter(([bid, x]) => typ.test(x.t || "")).length;
        if (already) setTimeout(() => { mutate(p => ent.forEach(x => { const y = p.bf?.[x.id]; if (y) { y.c ||= {}; y.c.p1p1 = (y.c.p1p1 || 0) + already; } })); logTo(code, `⚙ ${dispName(g)}: +${already} +1/+1 counter${already === 1 ? "" : "s"} on the entering ${m[1]}`); }, 0); }); }
    { const aw = Object.entries(me.bf || {}).filter(([, x]) => /each other creature you control enters with a number of additional \+1\/\+1 counters on it equal to [^']+'s toughness/i.test(x.o || lookupCard(x.n)?.o || ""));
      const ids = enteredPT.filter(x => x.id && !aw.some(([aid]) => aid === x.id)).map(x => x.id);
      if (aw.length && ids.length) setTimeout(() => { const k = aw.reduce((a, [aid, x]) => a + (Number(ptOf(x, countsFor(me), pid, aid).split("/")[1]) || 0), 0); if (!k) return;
        mutate(p => ids.forEach(id => { const x = p.bf?.[id]; if (x) { x.c ||= {}; x.c.p1p1 = (x.c.p1p1 || 0) + k; } })); logTo(code, `⚙ ${dispName(aw[0][1])}: +${k} +1/+1 counters on ${ids.length} entering creature${ids.length === 1 ? "" : "s"}`); }, 0); }
    if (tokGone > 0) permLeftWatch(tokGone);
    if (tokGone > 0 && !opts.noTokLeave && !noRelease && Object.values(me.bf || {}).some(e => /whenever (?:a|one or more) tokens? you control leaves? the battlefield/i.test(e.o || lookupCard(e.n)?.o || "")))
      setTimeout(() => act([{ type: "tokleave", n: tokGone }], null, null, { noTokLeave: true }), 0);
    if (untapEnt.length) seated(room).filter(o => o.id !== pid && !isOut(o)).forEach(o => Object.values(o.bf || {}).filter(e => /whenever an artifact or creature an opponent controls enters untapped, they may tap that permanent/i.test(e.o || lookupCard(e.n)?.o || "")).forEach(e => reminders.push({ id: newId(), src: `${o.name}'s ${dispName(e)}`, text: `${untapEnt.join(", ")} entered untapped: tap ${untapEnt.length === 1 ? "it" : "each one"}, or ${o.name} creates a 1/1 white Vampire with lifelink for each you leave untapped.`, times: 1 })));
    if (entered > 0) seated(room).filter(o => o.id !== pid && !isOut(o) && Object.values(o.bf || {}).some(e => /whenever a creature an opponent controls enters/i.test(e.o || lookupCard(e.n)?.o || "")))
      .forEach(o => sendOrders({ [o.id]: {} }, { how: "oppEnters", n: entered, names: enteredNames.slice(0, 6) }));
    const disc = events.filter(ev => ev.type === "discard").reduce((a, ev) => a + (ev.n || 1), 0);
    if (disc) seated(room).filter(o => o.id !== pid && !isOut(o) && Object.values(o.bf || {}).some(e => /whenever an opponent discards/i.test(e.o || lookupCard(e.n)?.o || "")))
      .forEach(o => sendOrders({ [o.id]: {} }, { how: "oppDiscard", n: disc }));
    const died = events.filter(ev => ev.type === "dies" && !ev.foreign).reduce((a, ev) => a + (ev.n || 1), 0);
    if (died) { const t = room?.turnNo || 0; setTimeout(() => mutate(p => { p.deaths = { t, n: (p.deaths?.t === t ? p.deaths.n || 0 : 0) + died }; }, true), 0); }
    if (died) seated(room).filter(o => o.id !== pid && !isOut(o) && Object.values(o.bf || {}).some(e => { const c = lookupCard(e.n) || e; return c?.o && abilitiesOf({ ...c, o: e.o || c.o }).trig.some(t => t.cond?.ev === "dies" && !t.cond.mine); }))
      .forEach(o => sendOrders({ [o.id]: {} }, { how: "foreignDies", n: died, token: events.filter(ev => ev.type === "dies" && !ev.foreign).every(ev => ev.token), ts: events.filter(ev => ev.type === "dies" && !ev.foreign).flatMap(ev => ev.ts?.length ? (ev.token ? Array(ev.n || 1).fill(ev.ts[0]) : ev.ts) : []).slice(0, 200), src: `${me.name}'s creature${died === 1 ? "" : "s"}` }));
    if (tag) recordStep(tag, before);
    ctx.logs.forEach(l => logTo(code, l));
    if (ctx.applied?.length && !opts.noTrack) { const t = room?.turnNo || 0; recentTrig = [...recentTrig.filter(x => x.turn === t), ...ctx.applied.map(x => ({ ...clone(x), turn: t, at: Date.now() }))].slice(-12); }
    setTimeout(() => checkWinsAt("state"), 0);
    if (ctx.drain || ctx.hits) {
      const u = {}, loss = {};
      seated(room).forEach(o => {
        if (o.id === pid) return;
        let n = (isOut(o) ? 0 : ctx.drain) + (ctx.hits?.[o.id] || 0);
        if (n && o.prot?.life) { logTo(code, `🛡 ${o.name}'s life can't change (${o.prot.src})`); n = 0; }
        if (n) { u[`players/${o.id}/life`] = (o.life ?? START_LIFE) - n; loss[o.id] = n; }
      });
      if (ctx.dmgDrain || ctx.dmgHits) { const dm = {}; seated(room).filter(o => o.id !== pid && !isOut(o)).forEach(o => { const v = (ctx.dmgDrain || 0) + (ctx.dmgHits ? (ctx.hits?.[o.id] || 0) : 0); if (v) dm[o.id] = v; }); setTimeout(() => { deliriumPunish(dm); render(); }, 0); }
      if (Object.keys(u).length) {
        update(ref(db, `rooms/${code}`), u);
        const last = undoExt[undoExt.length - 1];
        if (last?.loss) Object.entries(loss).forEach(([k, n]) => (last.loss[k] = (last.loss[k] || 0) + n));
        else undoExt[undoExt.length - 1] = { loss };
        if (tag && steps[tag]) steps[tag].segs.at(-1).loss = loss;
      }
    }
    if (!noRelease) Object.entries(bfBefore).forEach(([id, e]) => {
      if (me.bf?.[id] || me.phased?.bf?.[id]) return; // still here (or only phased out)
      const o = e.o || lookupCard(e.n)?.o || "";
      if (/leaves the battlefield/i.test(o)) setTimeout(() => releaseHeld(id, dispName(e)), 0);
    });
    if (me.ring?.bearer && !ringBearer(me) && !(me.ring.bearer.id && me.phased?.bf?.[me.ring.bearer.id])) {
      const gone = me.ring.bearer.name;
      setTimeout(() => { if (me.ring?.bearer?.name === gone && !ringBearer(me)) { mutate(p => { if (p.ring) delete p.ring.bearer; }, true); logTo(code, `💍 ${me.name}'s Ring-bearer (${gone}) left; still tempted ×${me.ring.n}`); } }, 0);
    }
    // Sagas: a new lore counter means a chapter
    const lorePrev = Object.fromEntries(Object.keys(me.bf || {}).map(id => [id, bfBefore[id]?.c?.lore || 0]));
    if (Object.entries(me.bf || {}).some(([id, e]) => (e.c?.lore || 0) > lorePrev[id])) setTimeout(() => sagaCheck(lorePrev), 0);
    // Soulbond pairs end when either leaves
    const broke = Object.entries(me.bf || {}).filter(([, e]) => e.pair && !me.bf[e.pair]);
    if (broke.length) setTimeout(() => mutate(p => broke.forEach(([id]) => { if (p.bf?.[id]) delete p.bf[id].pair; }), true), 0);
    // Auras whose permanent left go to the graveyard; Equipment just falls off
    const orphans = Object.entries(me.bf || {}).filter(([sid, a]) => a.att && (a.att === "tok" ? !Object.values(me.tokens || {}).some(t => eqList(t).includes(sid)) : !me.bf[a.att] && !me.phased?.bf?.[a.att]));
    if (orphans.length) setTimeout(() => {
      const still = orphans.filter(([sid]) => me.bf?.[sid]?.att);
      if (!still.length) return;
      mutate(p => still.forEach(([sid, a]) => { if (a.bestowT && p.bf[sid]) { p.bf[sid].t = a.bestowT; delete p.bf[sid].bestowT; delete p.bf[sid].att; } else if (/\bAura\b/.test(a.t || "")) { delete p.bf[sid]; toZone(p, a, "gy"); } else if (p.bf[sid]) delete p.bf[sid].att; }), true);
      still.forEach(([, a]) => logTo(code, /\bAura\b/.test(a.t || "") ? `📎 ${me.name}'s ${dispName(a)} went to the graveyard (what it enchanted left)` : `📎 ${me.name}'s ${dispName(a)} is unattached (what it equipped left)`));
    }, 0);
    if (ctx.others?.length) seated(room).filter(o => o.id !== pid && !isOut(o)).forEach(o => sendOrders({ [o.id]: {} }, { how: "fx", effs: ctx.others, src: ctx.others[0].src || "" }));
    if (eqToks.length && events.some(ev => ev.type === "dies" && ev.token)) eqToks.forEach(([k, c, eqs]) => { if ((me.tokens?.[k]?.count || 0) < c) leaveHooks([], "die", eqs); });
    setTimeout(checkZeroToughness, 0);
    (ctx.notes || []).forEach(n => opponents().forEach(o => sendNote(o.id, { text: `Draw ${n.draw === 1 ? "a card" : n.draw + " cards"}.`, short: `draw ${n.draw}`, src: n.src })));
    if (ctx.remind.length) {
      ctx.remind.filter(r => r.mana && /^(\{[WUBRGC]\})+$/.test(r.mana.syms)).forEach(r => setTimeout(() => { poolAdd(r.mana.syms.repeat(r.mana.n), r.src); render(); }, 0));
      ctx.remind = ctx.remind.filter(r => !(r.mana && /^(\{[WUBRGC]\})+$/.test(r.mana.syms)));
      ctx.remind.filter(r => r.extraCombat).forEach(r => setTimeout(() => extraCombat(r.src), 0));
      ctx.remind.filter(r => r.doublePow).forEach(r => setTimeout(() => doublePower(r.src), 0));
      ctx.remind = ctx.remind.filter(r => !r.doublePow);
      ctx.remind = ctx.remind.filter(r => !r.extraCombat);
      ctx.remind.filter(r => r.mill).forEach(r => setTimeout(() => millOut(r), 0));
      ctx.remind = ctx.remind.filter(r => !r.mill || /^target/.test(r.mill.who));
      ctx.remind.forEach(r => { if (r.mill) r.millTarget = r.mill; });
      ctx.remind.filter(r => r.selfCopies).forEach(r => setTimeout(() => { const x = me.bf?.[r.selfCopies.id || r.srcId]; if (!x || x.tok) return; const full = lookupCard(x.n) || x; for (let i = 0; i < r.selfCopies.n; i++) playCard({ ...full, t: r.selfCopies.nonleg ? String(full.t || "").replace(/^Legendary /, "") : full.t }, { tokenCopy: true, via: r.src }); }, 0));
      ctx.remind = ctx.remind.filter(r => !r.selfCopies);
      ctx.remind.filter(r => r.dieReturn).forEach(r => setTimeout(() => dieReturn(bfBefore[r.srcId] || { n: r.src }), 0));
      ctx.remind = ctx.remind.filter(r => !r.dieReturn);
      ctx.remind.forEach(r => {
        const nr = normalizeRem({ ...r, id: newId(), ...(tag ? { castKey: tag } : {}) });
        if (/^draw that many cards/i.test(nr.text || "")) { const ex = reminders.find(x => x.manyN && x.srcId === nr.srcId && x.text === nr.text); if (ex) { ex.manyN += 1; ex.drawN = ex.manyN; ex.note = `${ex.manyN} attacked → draw ${ex.manyN}`; return; } nr.manyN = 1; nr.drawN = 1; nr.note = "1 attacked → draw 1"; }
        reminders.push(nr);
        noteAbility(nr);
        if (tag && steps[tag] && !opts.tag) steps[tag].rems.push(nr.id);
      });
      render();
    }
  }

  function lifeChange(d) {
    if (me.prot?.life && !confirm(`${me.prot.src}: your life total can't change right now.\n\nChange it anyway?`)) return;
    if (d > 0) manualUp += d;
    else if (d < 0) { manualDown += -d; // taking life back off cancels a pending "was that life gain?" question first
      const ga = reminders.find(x => x.gainAsk);
      if (ga) { const k = Math.min(ga.gainAsk, -d); ga.gainAsk -= k; if (!ga.gainAsk) reminders = reminders.filter(x => x !== ga); else normalizeRem(ga); }
    }
    mutate(p => { p.life = (p.life ?? START_LIFE) + d; if (d > 0) { const t = room?.turnNo || 0; p.lifeGained = t; p.lifeGainedN = { t, n: (p.lifeGainedN?.t === t ? p.lifeGainedN.n || 0 : 0) + d }; } });
    logDelta("life", d, x => `${me.name} ${x > 0 ? "gained" : "lost"} ${Math.abs(x)} life → ${me.life}`);
  }
  function pcChange(k, d) {
    if ((me[k] || 0) + d < 0) return;
    const label = PLAYER_COUNTERS.find(c => c.k === k)?.label || k;
    mutate(p => { p[k] = (p[k] || 0) + d; });
    logDelta("pc" + k, d, x => `${me.name}: ${x > 0 ? "+" : ""}${x} ${label.replace(/^\S+\s/, "").toLowerCase()} → ${me[k] || 0}`);
  }
  function cmdChange(key, d) {
    const cur = me.cmd?.[key] || 0;
    if (cur + d < 0) return;
    mutate(p => { p.cmd ||= {}; p.cmd[key] = cur + d; p.life = (p.life ?? START_LIFE) - d; });
    const [oid, sl] = key.split("~");
    const o = room.players?.[oid];
    const nm = sl ? shortCmd((o?.commanders || []).find(c => slugify(c) === sl) || sl) : "";
    logDelta("cmd" + key, d, x => `${me.name} ${x > 0 ? "took" : "removed"} ${Math.abs(x)} commander damage from ${o?.name || "?"}${nm ? `'s ${nm}` : ""} → ${me.cmd?.[key] || 0}`);
  }
  function tokChange(name, d) {
    const k = slug(name);
    const cur = me.tokens?.[k]?.count || 0;
    const n = Math.max(0, cur + d);
    if (n === cur) return;
    const label = me.tokens?.[k]?.name || name;
    if (d > 0) { act([{ type: "create", name: label, n: d }]); return; }
    const gone = cur - n, creature = isCreatureToken(label);
    act([{ type: "sac", name: label, n: gone, token: true, creature }, ...(creature ? [{ type: "dies", n: gone, token: true }] : [])], p => {
      if (n === 0) delete p.tokens[k]; else p.tokens[k] = { name: label, count: n };
    });
    logDelta("tok" + k, -gone, x => `${me.name} removed ${Math.abs(x)} ${label} → ${me.tokens?.[k]?.count || 0}`);
  }
  function addEffect(key, dur) {
    const def = effectDef(key);
    if (!def) return;
    mutate(p => { p.effects ||= {}; p.effects[key] = { name: def.name, icon: def.icon, dur }; });
    if (def.exclusive) {
      const u = {};
      seated(room).forEach(o => { if (o.id !== pid && o.effects?.[key]) u[`players/${o.id}/effects/${key}`] = null; });
      if (Object.keys(u).length) update(ref(db, `rooms/${code}`), u);
    }
    logTo(code, `${me.name}: ${def.icon} ${def.name}${dur === "turn" ? " (this turn)" : ""}`);
  }
  function removeEffect(key) {
    const ef = me.effects?.[key];
    if (!ef) return;
    mutate(p => { delete p.effects[key]; });
    logTo(code, `${me.name}: ${ef.name} ended`);
  }

  // ----- Battlefield -----
  // Tell the table you drew (opponents' "whenever an opponent draws" cards listen for this)
  // Narset / Spirit of the Labyrinth / Leovold: how many more cards this player may draw this turn
  function drawCap() {
    const lim = tableRules().filter(({ rule }) => rule.kind === "drawLimit");
    if (!lim.length) return { left: Infinity };
    const max = Math.min(...lim.map(x => x.rule.max)), src = lim.find(x => x.rule.max === max).src;
    const drawn = Object.values(room?.draws || {}).filter(d => d.by === pid && (d.turnNo ?? -1) === (room?.turnNo || 0)).reduce((a, d) => a + (d.n || 1), 0);
    return { left: Math.max(0, max - drawn), max, src };
  }
  // Tell the table you drew; caps the number when a draw limit is in play (returns how many were logged)
  function broadcastDraw(n = 1, why = "", manual = false, already = false) {
    if (dig?.on && n > 0 && !already && why !== "digital-done") { digDraw(n); setTimeout(renderHand, 0); }
    const st = why !== "draw step" ? boardEnv().steal[0] : null;
    if (st && n > 0) {
      const instead = st.gives === "draw" ? `${st.owner} draws ${n === 1 ? "a card" : n + " cards"} instead` : st.gives === "treasure" ? `${st.owner} creates ${n === 1 ? "a Treasure" : n + " Treasures"} instead` : st.then;
      if (confirm(`${st.src} (${st.owner}): you don't draw ${n === 1 ? "that card" : `those ${n} cards`}.\n${instead.replace(/^\w/, c => c.toUpperCase())}.\n\nOK = apply it · Cancel = draw normally`)) {
        if (st.gives === "draw") sendNote(st.ownerId, { text: `Draw ${n === 1 ? "a card" : n + " cards"}.`, short: `draw ${n}`, src: `${st.src}: ${me.name}'s draw` });
        else if (st.gives === "treasure") sendNote(st.ownerId, { text: `Create ${n === 1 ? "a Treasure" : n + " Treasures"} (${me.name}'s draw).`, token: "Treasure", count: n, desc: "Treasure artifact", src: st.src });
        logTo(code, `🕵 ${st.src}: ${me.name}'s ${n === 1 ? "draw" : `${n} draws`}${why ? ` (${why})` : ""} → ${instead}`);
        return 0;
      }
    }
    const cap = drawCap();
    if (n > cap.left) {
      if (manual && cap.left === 0 && confirm(`${cap.src}: you can't draw more than ${cap.max} card${cap.max === 1 ? "" : "s"} each turn, and you already have.\n\nLog this draw anyway?`)) cap.left = n;
      else {
        logTo(code, `🚫 ${cap.src}: ${me.name} can only draw ${cap.max} card${cap.max === 1 ? "" : "s"} each turn${why ? ` (${why})` : ""}${cap.left ? ` · drew ${cap.left} of ${n}` : " · no draw"}`);
        if (!cap.left) { toast(`${cap.src}: no more draws this turn`); return 0; }
        n = cap.left;
      }
    }
    const tai = why !== "draw step" && Object.values(me?.bf || {}).filter(x => /if you would draw a card except the first one you draw in each of your draw steps, draw two cards instead/i.test(x.o || lookupCard(x.n)?.o || ""));
    if (tai?.length) { const n0 = n; n = n * 2 ** tai.length; logTo(code, `📚 ${dispName(tai[0])}: ${me.name} draws ${n} instead of ${n0}`); }
    const drewBefore = Object.values(room?.draws || {}).filter(d => d.by === pid && (d.turnNo || 0) === (room?.turnNo || 0)).reduce((a, d) => a + (d.n || 1), 0);
    setTimeout(() => act([{ type: "draw", n, before: drewBefore, ...(why === "draw step" ? { step: true } : {}) }]), 0);
    if (why === "draw step") setTimeout(() => Object.entries(me.gy || {}).forEach(([gid, g]) => { const dn = (String(g.o || lookupCard(g.n)?.o || "").match(/^Dredge (\d+)/m) || [])[1];
      if (dn) { reminders.push({ id: newId(), src: dispName(g), text: `Dredge ${dn}: instead of that draw, you may mill ${dn} and return ${dispName(g)} to your hand.`, times: 1, dredge: { gid, n: Number(dn) } }); render(); } }), 0);
    push(ref(db, `rooms/${code}/draws`), { by: pid, n, turnNo: room?.turnNo || 0, ...(why === "draw step" ? { step: true } : {}), at: Date.now() });
    if (drewBefore < 3 && drewBefore + n >= 3) setTimeout(() => eqCounterTrigger("third card drawn"), 0);
    logTo(code, `${me.name} drew ${n === 1 ? "a card" : n + " cards"}${why ? ` (${why})` : ""}`);
    return n;
  }
  function broadcastCast(card) {
    if (/\bEnchantment\b/.test(card.t || "")) setTimeout(() => {
      const tats = Object.values(me.bf || {}).find(x => /whenever you cast an enchantment spell, if you don't control a creature named Keimi, create Keimi/i.test(x.o || lookupCard(x.n)?.o || ""));
      const keimi = Object.entries(me.tokens || {}).find(([, t]) => t.name === "Keimi" && t.count > 0) || Object.values(me.bf || {}).find(x => x.n === "Keimi");
      if (keimi) { const u = {}; const opps = opponents().filter(o => !isOut(o)); opps.forEach(o => { u[`players/${o.id}/life`] = (o.life ?? START_LIFE) - 1; }); if (opps.length) { update(ref(db, `rooms/${code}`), u); act([{ type: "effects", effs: [{ k: "gain", n: opps.length }], times: 1, count: 1, src: "Keimi" }]); logTo(code, `🐸 Keimi: each opponent loses 1, ${me.name} gains ${opps.length}`); } }
      else if (tats) { act([{ type: "create", name: "Keimi", n: 1, desc: "legendary 3/3 black and green Frog creature", src: dispName(tats) }]); }
      if (tats) { reminders = reminders.filter(r => !/^if you don't control a creature named keimi/i.test(r.text || "")); render(); }
    }, 60);
    const rd = useRiders(card);
    castHaste = rd.haste || null;
    if (rd.haste) logTo(code, `⚡ ${me.name}'s ${dispName(card)} gains haste (${rd.haste} mana)`);
    if (rd.nc) logTo(code, `🛡 ${me.name}'s ${dispName(card)} can't be countered (${rd.nc} mana)`);
    return push(ref(db, `rooms/${code}/casts`), { by: pid, turnNo: room?.turnNo || 0, n: card.n, t: card.t || "", img: card.img || "", m: card.m || "", ...(card.nick ? { nick: card.nick } : {}),
      ...(/this spell can't be countered/i.test(card.o || "") ? { nc: true } : rd.nc ? { nc: rd.nc } : me.ncTurn === (room.turnNo || 0) ? { nc: "Veil" } : {}), at: Date.now() }).key;
  }

  // ----- Table rules (cost changes / casting restrictions from anyone's permanents) -----
  function tableRules() {
    const out = [];
    if (me) (deck?.cmds || []).filter(n => !Object.values(me.bf || {}).some(e => e.n === n)).forEach(n => { const c = lookupCard(n); if (!c || !/^Eminence — As long as [^\n]+ is in the command zone or on the battlefield/m.test(c.o || "")) return; staticRules(c.o).forEach(rule => { if (rule.who === "you") out.push({ rule, src: `${dispName(c)} (command zone)`, owner: me }); }); });
    seated(room).filter(o => !isOut(o)).forEach(o => Object.values(o.bf || {}).forEach(e => {
      if (!e.o) return;
      staticRules(e.o).forEach(rule => {
        if (rule.whileUntapped && e.tap) return;
        if (rule.who === "all" || (rule.who === "opp" && o.id !== pid) || (rule.who === "you" && o.id === pid)) out.push({ rule, src: dispName(e), owner: o });
      });
    }));
    return out;
  }
  // Board rules that change triggers/abilities for this player (Humility, Torpor Orb, Panharmonicon, Null Rod, Thalia…)
  function boardEnv() {
    const env = { loseAll: [], hush: [], double: [], tapIn: [], noAct: [], rip: [], skipDraw: [], discardExile: [], steal: [], agent: [], untapOthers: [], untapRule: [], orderTriggers };
    seated(room || {}).filter(o => !isOut(o)).forEach(o => Object.values(o.bf || {}).forEach(e => boardRules(e.o).forEach(r => {
      if (r.whileUntapped && e.tap) return;
      if (r.who === "all" || (r.who === "opp" && o.id !== pid) || (r.who === "you" && o.id === pid)) env[r.kind]?.push({ ...r, src: dispName(e), owner: o.name, ownerId: o.id, ...(e.att ? { att: e.att } : {}) });
    })));
    env.redBonus = redBonus();
    const lt = envTurn ?? (room?.turnNo || 0);
    env.oppLost = Math.max(0, ...seated(room || {}).filter(o => o.id !== pid).map(o => o.lifeLost?.t === lt ? o.lifeLost.n || 0 : 0));
    env.anyLost = Math.max(env.oppLost, me?.lifeLost?.t === lt ? me.lifeLost.n || 0 : 0);
    if (me?.spoil?.turnNo === (room?.turnNo || 0)) env.loseAll.push({ filter: { alts: [["creature"]], controller: "any", mv: null }, src: me.spoil.src, owner: me.name, ownerId: pid, text: "creatures lose all abilities" });
    env.dmgMult = dmgMult(true).m;
    { const opps = seated(room || {}).filter(o => o.id !== pid && !isOut(o)); env.desig = { "an opponent is the monarch": opps.some(o => o.effects?.monarch), "you're the monarch": !!me?.effects?.monarch, "you aren't the monarch": !me?.effects?.monarch, "you have the initiative": !!me?.effects?.initiative, "you've completed a dungeon": !!me?.dgDone }; }
    return env;
  }
  // Why this permanent's activated abilities can't be used right now (Null Rod, Humility…), or ""
  function actBlocked(e) {
    const env = boardEnv();
    const ab = room?.turn && room.turn !== pid && Object.values(room.players?.[room.turn]?.bf || {}).find(x => /during your turn, your opponents can't cast spells or activate abilities of artifacts, creatures, or enchantments/i.test(x.o || lookupCard(x.n)?.o || ""));
    if (ab && /\b(Artifact|Creature|Enchantment)\b/.test(e.t || "")) return `${dispName(ab)} (${room.players[room.turn].name}): no abilities of artifacts, creatures or enchantments during their turn`;
    const r = env.loseAll.find(x => permMatch(e, x.filter)) || env.noAct.find(x => permMatch(e, x.filter));
    return r ? `${r.src}${r.owner !== me.name ? ` (${r.owner})` : ""}: ${r.text}` : "";
  }
  // What the table's rules do to casting this card: cost change, warnings, and reasons it can't be cast
  function castCheck(card, zone = null) {
    const res = { more: 0, less: 0, tags: [], blocks: [], notes: [] };
    let floor = null;
    if (!card || /\bLand\b/.test(card.t || "")) return res;
    const mv = manaValue(card.m);
    const myTurnCasts = Object.values(room?.casts || {}).filter(c => c.by === pid && (c.turnNo || 0) === (room?.turnNo || 0) && !c.countered);
    const who = o => o.id === pid ? "your" : `${o.name}'s`;
    tableRules().forEach(({ rule, src, owner }) => {
      if (!spellMatches(rule, card)) return;
      if (rule.kind === "cost") {
        if (rule.when === "notCasterTurn" && room?.turn === pid) return;
        if (rule.when === "ownerTurn" && room?.turn !== owner.id) return;
        const k = rule.per === "p1p1creature" ? p1p1Creatures(owner) : rule.per ? countTypes(owner, [rule.per]) : 1, n = rule.n * k;
        if (!n) return;
        if (rule.less) res.less += n; else res.more += n;
        res.tags.push(`${rule.less ? "−" : "+"}${n} ${src}${rule.per === "p1p1creature" ? ` (${k} with +1/+1 counters)` : rule.per ? ` (${k} ${k === 1 ? rule.per : rule.per.replace(/([^aeiou])y$/, "$1ie") + "s"})` : ""}`);
      } else if (rule.kind === "limit") {
        if (myTurnCasts.some(c => spellMatches(rule, c))) res.blocks.push(`${src}: you've already cast ${rule.filter.alts[0]?.[0] === "permanent" ? "a" : `a ${rule.filter.alts.map(a => a.join(" ")).join("/")}`} spell this turn`);
      } else if (rule.kind === "mv") {
        if (rule.max === "lands") {
          const lands = Object.values(me.bf || {}).filter(e => /\bLand\b/.test(e.t || "")).length;
          if (!lands) res.notes.push(`${src}: mana value can't be more than your lands (the app sees no lands on your board)`);
          else if (mv > lands) res.blocks.push(`${src}: mana value ${mv} is more than your ${lands} land${lands === 1 ? "" : "s"}`);
        } else if (rule.atLeast != null && mv >= rule.atLeast) res.blocks.push(`${src}: mana value ${rule.atLeast} or more can't be cast`);
        else if (rule.atMost != null && mv <= rule.atMost) res.blocks.push(`${src}: mana value ${rule.atMost} or less can't be cast`);
      } else if (rule.kind === "noX") {
        if (/\{X\}/.test(card.m || "")) res.blocks.push(`${src}: spells with {X} can't be cast`);
      } else if (rule.kind === "parity") {
        if (/\{X\}/.test(card.m || "")) res.notes.push(`${src}: ${rule.even ? "even" : "odd"} mana value can't be cast (X counts)`);
        else if ((mv % 2 === 0) === rule.even) res.blocks.push(`${src}: ${rule.even ? "even" : "odd"} mana value (${mv}) can't be cast`);
      } else if (rule.kind === "yourTurn") {
        if (room?.turn === owner.id) res.blocks.push(`${src}: no spells during ${who(owner)} turn`);
      } else if (rule.kind === "sorcery") {
        if (/\bInstant\b/.test(card.t || "") || /^Flash\b/m.test(card.o || "") || room?.turn !== pid) res.notes.push(`${src}: sorcery speed only (your main phase, empty stack)`);
      } else if (rule.kind === "floor") { if (!floor || rule.n > floor.n) floor = { n: rule.n, src };
      } else if (rule.kind === "zoneBan") {
        const ZN = { cz: "the command zone", gy: "a graveyard", exile: "exile", lib: "a library" };
        if (zone && rule.zones.includes(zone)) res.blocks.push(`${src}: can't cast spells from ${ZN[zone]}`);
        else if (!zone) res.notes.push(`${src}: ${rule.text}`);
      } else if (rule.kind === "ownTurn") {
        if (room?.turn && room.turn !== pid) res.blocks.push(`${src}: spells only during your own turn`);
      } else if (rule.kind === "note") res.notes.push(`${src}: ${rule.text}`);
    });
    staxCastNotes(card, res, mv, myTurnCasts);
    if (room?.silence && room.silence.turnNo === (room.turnNo || 0) && (room.silence.target ? room.silence.target === pid : room.silence.by !== pid)) res.blocks.push(`${room.silence.byName}'s ${room.silence.src}: you can't cast spells this turn`);
    // The card's own timing: "Cast this spell only during combat on an opponent's turn" (Wake the Dead), "only during your turn", …
    String(card.o || "").split(" // ")[0].replace(/\([^)]*\)/g, "").match(/cast this spell only [^.]*/gi)?.forEach(line => {
      const l = line.toLowerCase(), why = line.replace(/^cast this spell only /i, "only "), tracked = room?.step?.turnNo === (room?.turnNo || 0), st = STEPS[stepOf(room)] || "", mine = room?.turn === pid;
      if (/from (?:your|a) graveyard|from exile/.test(l)) return;
      const bad = [];
      if (/opponent's turn/.test(l) && room?.turn && mine) bad.push("it's your turn");
      if (/(?:on|during) your turn|your declare attackers|your end step/.test(l) && room?.turn && !mine) bad.push("it isn't your turn");
      const needCombat = /during combat|declare (?:attackers|blockers) step|before the combat damage step|before blockers are declared|after blockers are declared/.test(l) && !/before combat or/.test(l);
      if (needCombat && st !== "Combat") (tracked ? bad : res.notes).push(tracked ? `it's the ${st} step, not combat` : `${dispName(card)}: ${why} (the app isn't sure which step it is)`);
      if (/after combat/.test(l) && tracked && !/^(Main 2|End)$/.test(st)) bad.push(`it's the ${st} step`);
      if (/your end step/.test(l) && tracked && st !== "End") bad.push(`it's the ${st} step`);
      const ctl = l.match(/if you control (a|an|two or more|three or more) ([a-z]+?)s?$/);
      if (ctl) { const need = /two/.test(ctl[1]) ? 2 : /three/.test(ctl[1]) ? 3 : 1, have = countTypes(me, [ctl[2]]); if (have < need) bad.push(`you control ${have} ${ctl[2]}${have === 1 ? "" : "s"}`); }
      if (/if you've cast another spell this turn/.test(l) && !myTurnCasts.length) bad.push("you haven't cast another spell this turn");
      if (bad.length) res.blocks.push(`${dispName(card)}: ${why} (${bad.join(", ")})`);
      else if (!needCombat && !ctl && !/opponent's turn|your turn|after combat|your end step|another spell/.test(l)) res.notes.push(`${dispName(card)}: ${why}`);
    });
    const self = String(card.o || "").match(/this spell costs \{(\d+)\} less to cast for each (creature|artifact|enchantment|land|planeswalker)s? (on the battlefield|you control(?! with)|your opponents control)/i);
    if (self) {
      const ty = self[2].toLowerCase(), who = self[3].toLowerCase();
      const k = seated(room || {}).filter(o => !isOut(o) && (who === "on the battlefield" || (who === "you control") === (o.id === pid))).reduce((a, o) => a + countTypes(o, [ty]), 0);
      if (k) { res.less += k * Number(self[1]); res.tags.push(`−${k * Number(self[1])} ${k} ${ty}${k === 1 ? "" : "s"}`); }
    }
    if (/if you control a commander, you may cast this spell without paying its mana cost/i.test(card.o || "") && Object.values(me?.bf || {}).some(e => e.cmd)) res.tags.push("−all free (you control a commander)");
    if (/this spell costs \{1\} less to cast for each creature you control with a \+1\/\+1 counter on it/i.test(card.o || "")) { const k = p1p1Creatures(me); if (k) { res.less += k; res.tags.push(`−${k} with +1/+1 counters`); } }
    { const ds = seated(room || {}).filter(o => !isOut(o)).flatMap(o => Object.values(o.bf || {})).filter(x => /each spell a player casts costs \{1\} more to cast for each other spell that player has cast this turn/i.test(x.o || lookupCard(x.n)?.o || "")).length;
      if (ds && myTurnCasts.length) { res.more += ds * myTurnCasts.length; res.tags.push(`+${ds * myTurnCasts.length} Damping Sphere (${myTurnCasts.length} cast this turn)`); } }
    if (/this spell costs \{X\} less to cast, where X is the total power of creatures you control/i.test(card.o || "")) { const k = Object.entries(me?.bf || {}).filter(([, e]) => /\bCreature\b/.test(e.t || "")).reduce((a, [id, e]) => a + (Number(ptOf(e, countsFor(me), pid, id).split("/")[0]) || 0), 0) + Object.entries(me?.tokens || {}).filter(([, t]) => isCreatureToken(t.name)).reduce((a, [k2, t]) => a + (Number(String(tokPTfx(t, pid, k2) || "0").split("/")[0]) || 0) * (t.count || 0), 0); if (k) { res.less += k; res.tags.push(`−${k} total power`); } }
    { const om = Object.values(me?.bf || {}).find(x => /you may cast spells from your hand without paying their mana costs/i.test(x.o || lookupCard(x.n)?.o || "")); if (om) { res.less += mv + 20; res.tags.push(`free (${dispName(om)})`); }
      const op = Object.values(me?.bf || {}).find(x => /you may cast spells with mana value less than or equal to the number of creatures you control from your hand without paying their mana costs/i.test(x.o || lookupCard(x.n)?.o || ""));
      if (!om && op && mv <= countTypes(me, ["creature"])) { res.less += mv + 20; res.tags.push(`free (${dispName(op)})`); } }
    if (/this spell costs \{X\} less to cast, where X is the greatest number of artifacts an opponent controls/i.test(card.o || "")) { const k = Math.max(0, ...seated(room || {}).filter(o => o.id !== pid && !isOut(o)).map(o => Object.values(o.bf || {}).filter(x => /\bArtifact\b/.test(x.t || "")).length + Object.values(o.tokens || {}).filter(t => !isCreatureToken(t.name) || /artifact/i.test(t.desc || "")).reduce((a, t) => a + (t.count || 0), 0))); if (k) { res.less += k; res.tags.push(`−${k} (most artifacts an opponent controls)`); } }
    { const dg = Object.values(me?.bf || {}).find(x => /you may cast dragon spells without paying their mana costs/i.test(x.o || lookupCard(x.n)?.o || "")); if (dg && /\bDragon\b/.test(card.t || "")) { res.less += mv + 20; res.tags.push(`free (${dispName(dg)})`); } }
    { const tb = Object.values(me?.bf || {}).filter(x => /during your turn, spells you cast cost \{1\} less to cast for each creature you control with power 4 or greater/i.test(x.o || lookupCard(x.n)?.o || "")); if (tb.length && room?.turn === pid) { const k = Object.entries(me.bf || {}).filter(([id, x]) => /\bCreature\b/.test(x.t || "") && Number(ptOf(x, countsFor(me), pid, id).split("/")[0]) >= 4).length; if (k) { res.less += k * tb.length; res.tags.push(`−${k * tb.length} (${tb.map(dispName).join(", ")}: power 4+)`); } } }
    if (/this spell costs \{X\} less to cast, where X is the greatest power among creatures you control/i.test(card.o || "")) { const k = maxPowerNow(); if (k) { res.less += k; res.tags.push(`−${k} greatest power`); } }
    const atkLess = String(card.o || "").match(/this spell costs \{(\d+)\} less to cast for each creature that attacked this turn/i);
    if (atkLess) {
      const k = seated(room || {}).reduce((a, o) => a + (o.attacked?.turnNo === (room?.turnNo || 0) ? Object.keys(o.attacked.bf || {}).length + Object.values(o.attacked.tok || {}).reduce((x, n) => x + n, 0) : 0), 0);
      if (k) { res.less += k * Number(atkLess[1]); res.tags.push(`−${k * Number(atkLess[1])} ${k} attacked`); }
    }
    if (floor) { const now = manaValue(adjustCost(card.m || "", res.more, res.less)); if (now < floor.n && res.less < mv + 20) { res.more += floor.n - now; res.tags.push(`+${floor.n - now} ${floor.src} (costs at least ${floor.n})`); } }
    // Timing: only instants and Flash on someone else's turn (Leyline of Anticipation, Yeva… let more through)
    if (room?.turn && room.turn !== pid && !/\bInstant\b/.test(card.t || "") && !/^Flash\b/m.test(card.o || "") && !flashOk(card)) {
      if (/as though it had flash/i.test(card.o || "")) res.notes.push("Check its text: it can sometimes be cast as though it had flash.");
      else res.blocks.push("Not your turn: only instants and spells with flash can be cast now");
    }
    return res;
  }
  // Opponents' "whenever an opponent casts … unless that player pays" taxes (Rhystic Study, Mystic Remora, Esper Sentinel…),
  // Chalice of the Void, Void Mirror, search hosers (Stranglehold, Aven Mindcensor, Ashiok) and Containment Priest
  function staxCastNotes(card, res, mv, myTurnCasts) {
    const cO = String(card.o || "").split(" // ")[0];
    const youText = (t, o) => /^counter (?:it|that spell)/i.test(t) ? "it's countered" : /^(?:you may )?draw/i.test(t) ? `${o.id === pid ? "you" : o.name} ${/^you may/i.test(t) ? "may draw" : "draws"}${t.replace(/^(?:you may )?draw/i, "")}`
      : t.replace(/^(that player|this \w+ deals \d+ damage to that player)/i, x => /deals/i.test(x) ? x.replace(/that player$/i, "you") : "you").replace(/^you (loses|sacrifices|discards)/i, (x, v) => `you ${v.replace(/s$/, "")}`).replace(/\band you gain\b/i, `and ${o.name} gains`);
    const warn = (src, txt) => { res.notes.push(`${src}: ${txt}`); res.tags.push(`⚠ ${src.replace(/ \(.*\)$/, "")}`); };
    const fits = (w, cc = card) => { w = (w || "").trim().toLowerCase(); if (!w) return true;
      return w.split(/\s+/).every(x => x === "noncreature" ? !/\bCreature\b/.test(cc.t || "") : x === "nonartifact" ? !/\bArtifact\b/.test(cc.t || "") : /^(creature|artifact|enchantment|instant|sorcery|planeswalker)$/.test(x) ? new RegExp(`\\b${x}\\b`, "i").test(cc.t || "") : /^(white|blue|black|red|green)$/.test(x) ? colorsOf(cc.m).includes({ white: "W", blue: "U", black: "B", red: "R", green: "G" }[x]) : x === "multicolored" ? colorsOf(cc.m).length > 1 : true); };
    seated(room || {}).filter(o => !isOut(o)).forEach(o => Object.entries(o.bf || {}).forEach(([id, e]) => {
      const text = String(e.o || lookupCard(e.n)?.o || ""), src = `${dispName(e)}${o.id === pid ? "" : ` (${o.name})`}`;
      text.split("\n").forEach(line => {
        const m = line.match(/^whenever (an opponent|a player) casts (their first |a |an )?([a-z ]*?)\s*spell(?: each turn)?(?: [^,]*)?, (.+?) unless (?:that player|they|its controller) (pays? \{(\w+)\}|discards? a card)/i);
        if (m) {
          if (/opponent/i.test(m[1]) && o.id === pid) return;
          if (/that doesn't share|with the same name/i.test(line) || !fits(m[3])) return;
          if (/first/i.test(m[2] || "") && myTurnCasts.some(c => fits(m[3], c))) return;
          let amt = m[6] || "";
          if (amt === "X" && /where X is (?:this creature's|its) power/i.test(line)) amt = ptOf(e, countsFor(o), o.id, id).split("/")[0];
          else if (amt === "X" && /where X is its mana value/i.test(line)) amt = String(mv);
          const what = youText(m[4], o);
          res.tags.push(m[6] ? `+{${amt}}? ${dispName(e)}` : `? ${dispName(e)}: discard`);
          res.notes.push(`${src}: pay ${m[6] ? `{${amt}}` : "a discard"} or ${what}`);
          return;
        }
        { const pc = line.match(/^whenever (?:a player|an opponent) casts a spell, that player flips a coin\. (.+)$/i); if (pc && !(/an opponent/i.test(line) && o.id === pid)) { warn(src, `flip a coin: ${pc[1].replace(/^if they lose the flip, counter that spell\.?$/i, "lose → your spell is countered")}`); return; } }
        const k = line.match(/^whenever an opponent casts (?:a |an )?([a-z ]*?)\s*spell, (that player [^.]+)\./i);
        if (k && o.id !== pid && fits(k[1]) && !/unless/i.test(line)) warn(src, youText(k[2], o));
      });
      if (/whenever a player casts a spell with mana value equal to the number of charge counters on/i.test(text)) {
        const ch = e.c?.charge;
        if (ch == null) warn(src, "spells with mana value equal to its charge counters are countered (set its charge counters to check)");
        else if (ch === mv) res.blocks.push(`${src}: ${ch} charge counter${ch === 1 ? "" : "s"} — mana value ${mv} gets countered`);
      }
      if (/whenever a player casts a spell, if no colored mana was spent to cast it, counter that spell/i.test(text) && !/\{[^}]*[WUBRG][^}]*\}/.test(card.m || "")) warn(src, "countered unless you spend colored mana on it");
      if (o.id !== pid && /search(?:es)? (?:your|their|a|target player's|that player's|its owner's) library/i.test(cO)) {
        if (/^your opponents can't search libraries/im.test(text)) warn(src, "you can't search libraries (the search part does nothing)");
        if (/^spells and abilities your opponents control can't cause their controller to search their library/im.test(text)) warn(src, "your spells can't make you search your library");
        if (/^if an opponent would search a library, that player searches the top four cards/im.test(text)) warn(src, "you only search the top four cards");
      }
      if (/^if a nontoken creature would enter and it wasn't cast, exile it instead/im.test(text) && /\bcreature\b[^.]*\bonto the battlefield|onto the battlefield[^.]*\bcreature\b/i.test(cO)) warn(src, "nontoken creatures put onto the battlefield without being cast are exiled");
    }));
  }
  // "You may cast [green creature] spells as though they had flash"
  function flashOk(card) {
    const CW = { white: "W", blue: "U", black: "B", red: "R", green: "G" };
    return Object.values(me?.bf || {}).some(e => {
      if (e.tap && /as long as [^,]+ is tapped, you may cast spells as though they had flash/i.test(e.o || lookupCard(e.n)?.o || "")) return true;
      const m = String(e.o || lookupCard(e.n)?.o || "").match(/you may cast ([a-z ]*?)\s*spells(?: [^.]*?)? as though they had flash/i);
      if (!m) return false;
      return m[1].trim().split(/\s+/).filter(Boolean).every(w => CW[w.toLowerCase()] ? colorsOf(card.m).includes(CW[w.toLowerCase()]) : /^(nonland|noncreature)$/i.test(w) ? !new RegExp(`\\b${w.slice(3)}\\b`, "i").test(card.t || "") : new RegExp(`\\b${w}\\b`, "i").test(card.t || ""));
    });
  }
  const costOf = (card, extra = 0) => { const k = castCheck(card); return adjustCost(card.m || "", k.more + extra, k.less); };
  // Cost + rule tags for a Cast button row
  function costHtml(card, extra = 0) {
    const k = castCheck(card);
    const changed = k.more || k.less || extra;
    const tip = t => { const key = t.replace(/^(⚠ |\+\{\w+\}\? )/, ""); const n = /^(⚠|\+\{)/.test(t) ? k.notes.find(x => x.startsWith(key)) : ""; return n ? ` title="${esc(n)}"` : ""; };
    return `${manaHtml(changed ? adjustCost(card.m || "", k.more + extra, k.less) : card.m)}${k.tags.map(t => `<span class="cost-tag ${t[0] === "−" ? "down" : "up"}"${tip(t)}>${esc(t)}</span>`).join("")}${k.blocks.length ? `<span class="cost-tag no" title="${esc(k.blocks.join("; "))}">⛔ ${esc(k.blocks[0].split(":")[0])}</span>` : ""}`;
  }
  // Warn before casting something the table's rules forbid (the player can override: the app may not know everything)
  function okToCast(card, zone = null) {
    const k = castCheck(card, zone);
    if (k.blocks.length) return confirm(`Can't cast ${dispName(card)}:\n• ${k.blocks.join("\n• ")}\n\nCast it anyway?`);
    if (k.notes.length) toast(k.notes[0]);
    return true;
  }
  function rulesStrip() {
    const env = boardEnv();
    const list = [...tableRules(), ...Object.values(env).filter(Array.isArray).flat().map(r => ({ rule: r, src: r.src, owner: seated(room).find(o => o.name === r.owner) || me }))];
    effectsInPlay(room).forEach(x => x.lines.forEach(l => { if (!list.some(y => y.src === x.src && y.owner.id === x.owner.id && y.rule.text === l)) list.push({ rule: { text: l + (x.off ? " (off while tapped)" : "") }, src: x.src, owner: x.owner }); }));
    if (!list.length) return "";
    const by = new Map();
    list.forEach(({ rule, src, owner }) => { const k = src + owner.id; if (!by.has(k)) by.set(k, { src, owner, lines: [] }); by.get(k).lines.push(rule.text); });
    return `<details class="rules-strip"><summary>⚖ Rules & effects in play (${by.size})</summary>${[...by.values()].map(x =>
      `<div class="mini"><b style="color:${esc(x.owner.color)}">${esc(x.src)}</b>${x.owner.id === pid ? "" : ` (${esc(x.owner.name)})`}: ${esc([...new Set(x.lines)].join(" "))}</div>`).join("")}</details>`;
  }

  let noRelease = false; // set while a permanent changes control (that isn't leaving the battlefield)
  function releaseHeld(srcId, name) {
    const holders = seated(room).filter(o => !isOut(o)).filter(o => Object.values(o.ex || {}).some(e => e.heldBy?.by === pid && e.heldBy?.srcId === srcId));
    if (!holders.length) return;
    logTo(code, `↩ ${name} left the battlefield: what it exiled comes back`);
    holders.forEach(o => sendOrders({ [o.id]: {} }, { how: "unhold", holder: pid, srcId }));
  }
  // ----- Control changes: cards you control but don't own (and giving them back) -----
  function receiveCards(o) {
    const stamp = room?.turnNo || 0;
    const back = [], took = [];
    act([], p => {
      p.bf ||= {};
      (o.cards || []).forEach(c => {
        const e = { ...c };
        if (e.own?.id === pid) { delete e.own; delete e.stolen; back.push(dispName(e)); }
        else { e.own = e.own || o.from; if (o.until === "eot") e.stolen = { until: "eot", turnNo: stamp }; else delete e.stolen; took.push(dispName(e)); }
        if (o.untap) delete e.tap;
        e.et = stamp;
        if (o.haste) e.haste = o.src || "haste"; else delete e.haste;
        p.bf[newId()] = e;
      });
      (o.toks || []).forEach(t => {
        const mine = t.own?.id === pid;
        const k = mine ? Object.keys(p.tokens || {}).find(x => p.tokens[x].name === t.name && !p.tokens[x].own) || slugify(t.name) : `${slugify(t.name)}~${(t.own || o.from).id}`;
        p.tokens ||= {};
        const cur = p.tokens[k];
        p.tokens[k] = { ...(cur || {}), name: t.name, desc: t.desc || cur?.desc || "", count: (cur?.count || 0) + t.count, ...(mine ? {} : { own: t.own || o.from, ...(o.until === "eot" ? { stolen: { until: "eot", turnNo: stamp } } : {}) }) };
        if (mine) { delete p.tokens[k].own; delete p.tokens[k].stolen; }
        (mine ? back : took).push(`${t.count} ${t.name}`);
      });
    });
    if (took.length) toast(`You now control ${took.join(", ")}${o.until === "eot" ? " until end of turn" : ""}`);
    if (back.length) { logTo(code, `↩ ${back.join(", ")} returned to ${me.name}`); toast(`${back.join(", ")} came back to you`); }
    render();
  }
  // Give borrowed permanents/tokens back to their owners (one, or everything that was only until end of turn)
  function returnBorrowed(ids, tokKeys) {
    const byOwner = {};
    ids.forEach(id => { const e = me.bf?.[id]; if (e?.own) (byOwner[e.own.id] ||= { cards: [], toks: [] }).cards.push({ ...e }); });
    tokKeys.forEach(k => { const t = me.tokens?.[k]; if (t?.own) (byOwner[t.own.id] ||= { cards: [], toks: [] }).toks.push({ ...t }); });
    if (!Object.keys(byOwner).length) return;
    noRelease = true;
    act([], p => { ids.forEach(id => delete p.bf?.[id]); tokKeys.forEach(k => delete p.tokens?.[k]); });
    noRelease = false;
    Object.entries(byOwner).forEach(([oid, x]) => {
      logTo(code, `↩ ${me.name} returned ${[...x.cards.map(dispName), ...x.toks.map(t => `${t.count} ${t.name}`)].join(", ")} to ${room.players?.[oid]?.name || "its owner"}`);
      sendOrders({ [oid]: {} }, { how: "receive", cards: x.cards, toks: x.toks, from: meTag() });
    });
  }

  // ----- Graveyard & exile -----
  const zoneEntry = (e, extra = {}) => ({ n: e.n, t: e.t || "", m: e.m || "", img: e.img || "", ...(e.nick ? { nick: e.nick } : {}), ...(e.own ? { own: e.own, ...(e.o ? { o: e.o } : {}) } : {}), at: Date.now(), ...extra });
  const meTag = () => ({ id: pid, name: me.name, color: me.color });
  const meOwner = () => ({ ...me, id: pid });
  // Put a card into your graveyard or exile (commanders stay out: their owner chooses the command zone); Rest in Peace turns graveyard into exile
  // Mana Reflection / Nyxbloom Ancient: tapping a permanent for mana makes twice / three times as much
  const plShroud = o => o?.id !== pid && Object.values(o?.bf || {}).some(x => /^you have (shroud|hexproof)\.?$/im.test(x.o || lookupCard(x.n)?.o || ""));
  // Freestrider Lookout & co.: targeting an opponent, their spell, permanent or graveyard is a crime
  const commitCrime = why => { if (Object.values(me.bf || {}).some(x => /whenever you commit a crime/i.test(x.o || lookupCard(x.n)?.o || ""))) setTimeout(() => act([{ type: "crime", why }]), 0); };
  const preventMe = () => { const x = Object.values(me?.bf || {}).find(e => /prevent all damage that would be dealt to you\.?$/im.test(e.o || lookupCard(e.n)?.o || "")); return x ? dispName(x) : ""; };
  const manaMult = () => Object.values(me?.bf || {}).reduce((a, x) => { const o = String(x.o || lookupCard(x.n)?.o || ""); return a * (/if you tap a permanent for mana, it produces three times as much/i.test(o) ? 3 : /if you tap a permanent for mana, it produces twice as much/i.test(o) ? 2 : 1); }, 1);
  function toZone(p, e, zone, extra) {
    if (!e) return null;
    if (e.earthbent && (zone === "gy" || zone === "ex") && !e.own) {
      const c = deckCard(e.n) || { n: e.n, t: e.ebT || e.t, m: e.m || "", img: e.img || "", ...(e.o ? { o: e.o } : {}) };
      setTimeout(() => { logTo(code, `⛰ ${dispName(e)} returns to the battlefield tapped (earthbend)`); playCard(c, { via: "earthbend", tapped: true }); }, 0);
      return null;
    }
    if (zone === "gy" && e.et != null && !e.own && !e.noReturn && /when this [a-z]+ is put into a graveyard from the battlefield, return it to its owner's hand/i.test(e.o || lookupCard(e.n)?.o || "")) { setTimeout(() => logTo(code, `↩ ${dispName(e)} returned to ${me.name}'s hand`), 0); return null; }
    if (zone === "gy" && e.exileDie != null && e.exileDie === (room?.turnNo || 0)) { zone = "ex"; setTimeout(() => logTo(code, `🚫 ${dispName(e)} was exiled instead of dying`), 0); }
    if (e.own && e.own.id !== pid) { // borrowed card: it goes to its owner's graveyard/exile
      const c = { n: e.n, t: e.t || "", m: e.m || "", img: e.img || "", ...(e.cmd ? { cmd: true } : {}) };
      setTimeout(() => sendOrders({ [e.own.id]: {} }, { how: "tozone", zone, cards: [c], src: dispName(e) }), 0);
      return null;
    }
    if (e.cmd || e.tok) return null;
    const rip = zone === "gy" ? boardEnv().rip : [];
    if (rip.length) zone = "ex";
    p[zone] ||= {};
    const id = newId();
    const keepO = zone === "gy" && /this card is in your graveyard/i.test(e.o || lookupCard(e.n)?.o || "") ? { o: e.o || lookupCard(e.n)?.o } : {};
    p[zone][id] = zoneEntry({ ...e, own: null }, { ...keepO, ...(rip.some(x => x.void) ? { void: true, ...(e.o ? { o: e.o } : {}) } : {}), ...(extra || {}) });
    return id;
  }
  // "As an additional cost to cast this spell, discard a card / pay 3 life / exile … from your graveyard"
  function addlCosts(card) {
    const wb = String(card.o || "").match(/as an additional cost to cast this spell, (you may )?waterbend \{(\d+)\}/i);
    if (wb) reminders.push({ id: newId(), src: dispName(card), text: "", times: 1, wbend: { n: Number(wb[2]), optional: !!wb[1] } });
    const m = String(card.o || "").match(/as an additional cost to cast this spell, (?:you may )?(discard (a|one|two|three|\d+) cards?|pay (\d+) life|exile ([^.]+?) from your graveyard)(?: or [^.]+)?\./i);
    if (!m || /^as an additional cost to cast this spell, you may/im.test(card.o)) return;
    const name = dispName(card);
    if (m[2]) reminders.push({ id: newId(), src: name, text: "", times: 1, impulse: { n: ({ a: 1, one: 1, two: 2, three: 3 })[m[2].toLowerCase()] || Number(m[2]) || 1, cards: [], toGy: true }, note: "Additional cost: log the card you discarded." });
    else if (m[3]) {
      if (me.prot?.life) toast(`${me.prot.src}: your life total can't change, so you can't pay life.`);
      else { mutate(p => { p.life = (p.life ?? START_LIFE) - Number(m[3]); }); logTo(code, `${me.name} paid ${m[3]} life (${name})`); }
    } else if (m[4]) reminders.push({ id: newId(), src: name, text: `Exile ${m[4]} from your graveyard (additional cost).`, times: 1 });
  }
  const deckCard = n => deck?.cards.find(c => c.n === n) || anyCache.get(n) || null;
  const zoneCard = e => deckCard(e.n) || e;
  const ALT_CAST = /^(Flashback|Escape|Retrace|Jump-start|Unearth|Disturb|Embalm|Eternalize|Encore|Scavenge|Aftermath|Mayhem)\b/m;
  const altCastOf = c => ((c?.o || "").match(ALT_CAST) || [])[1] || gyGrant(c);
  function gyGrant(c) {
    const os = Object.values(me?.bf || {}).map(x => String(x.o || lookupCard(x.n)?.o || ""));
    if (/\bLand\b/.test(c?.t || "") && os.some(o => /you may play lands from your graveyard/i.test(o))) return "Play from graveyard";
    if (room?.turn === pid && /\b(Artifact|Creature|Enchantment|Planeswalker|Battle|Land)\b/.test(c?.t || "") && os.some(o => /during each of your turns, you may play a land and cast a permanent spell of each permanent type from your graveyard/i.test(o))) return "From graveyard (Muldrotha)";
    { const own = String(c?.o || lookupCard(c?.n)?.o || "").match(/you may cast this card from your graveyard as long as you control an? ([A-Z][a-z]+)/); if (own && Object.values(me?.bf || {}).some(x => new RegExp(`\\b${own[1]}\\b`).test(x.t || ""))) return "Cast from graveyard"; }
    if (!/\bLand\b/.test(c?.t || "") && /\b(Artifact|Creature|Enchantment|Planeswalker|Battle)\b/.test(c?.t || "") && room?.turn === pid && os.some(o => /during your turn, nonland permanent cards in your graveyard have retrace/i.test(o))) return "Retrace: discard a land";
    return "";
  }
  const zoneOpen = new Set();
  const phasedList = () => [...Object.values(me?.phased?.bf || {}).map(e => ({ label: dispName(e), cmd: !!e.cmd })), ...Object.values(me?.phased?.tokens || {}).map(t => ({ label: `${t.count} ${t.name} token${t.count === 1 ? "" : "s"}` }))];
  function cmdZoneHtml() {
    const inZone = (deck?.cmds || []).map((name, i) => [name, i]).filter(([name]) => ![...Object.values(me?.bf || {}), ...Object.values(me?.phased?.bf || {}), ...Object.values(me?.air || {})].some(e => e.n === name));
    if (!inZone.length) return "";
    return `<section class="card"><h3>Command zone</h3>${inZone.map(([name, i]) => { const casts = me.tax?.[slug(name)] || 0;
      return `<div class="counter"><span class="who">⭐ ${esc(name)} ${costHtml(deck.cards.find(c => c.n === name) || { n: name, m: "" }, casts * 2)}<span class="sub">${casts ? `Cast ${casts}× · next tax +${casts * 2}` : "Not cast yet"}</span></span>
        <button class="btn small primary" data-a="cast-cmd" data-i="${i}">Cast${casts ? ` (+${casts * 2})` : ""}</button></div>`; }).join("")}</section>`;
  }
  function zonesHtml() {
    const nowT = room.turnNo || 0;
    const opts = (deck?.cards || []).map((c, i) => [c, i]).sort((a, b) => a[0].n.localeCompare(b[0].n)).map(([c, i]) => `<option value="${i}">${esc(dispName(c))}</option>`).join("");
    return ["gy", "ex"].map(z => {
      const list = Object.entries(me[z] || {}).sort((a, b) => (b[1].at || 0) - (a[1].at || 0));
      const btn = (id, to, label, cls = "") => `<button class="btn small ${cls}" data-a="zone" data-z="${z}" data-id="${id}" data-to="${to}">${label}</button>`;
      return `<section class="card zone-card"><details ${zoneOpen.has(z) ? "open" : ""}><summary data-a="zone-toggle" data-z="${z}">${z === "gy" ? "🪦 Graveyard" : "🚫 Exile"} <b>${list.length}</b></summary>
        ${list.map(([id, e]) => {
          const c = zoneCard(e), play = z === "ex" && ((e.play && (e.play.any || e.play.until >= nowT)) || /you may cast this card from exile/i.test(c.o || lookupCard(c.n)?.o || ""));
          let alt = z === "gy" ? (altCastOf(c) || (e.fb === nowT ? "Flashback" : "")) : e.foretold && e.foretold.turnNo < nowT ? `Foretell ${e.foretold.cost}` : "";
          if (alt === "Mayhem") alt = e.disc === nowT ? `Mayhem ${((c.o || "").match(/^Mayhem ((?:\{[^}]+\})+)/m) || [])[1] || ""}` : ""; // only the turn you discarded it
          if (z === "gy" && !alt && breachOn() && !/\bLand\b/.test(c.t || "")) alt = "Escape (Breach)";
          return `<div class="zone-row ${play ? "playable" : ""}"><button class="link who" data-a="view" data-ref="${z}:${id}">${esc(dispName(e))}</button> ${manaHtml(e.m)}
            ${e.own ? `<span class="own-tag" style="--oc:${esc(e.own.color || "#888")}">${esc(e.own.name)}'s</span>` : ""}${e.foretold ? `<span class="cost-tag">🔮 foretold${e.foretold.turnNo >= nowT ? " · castable next turn" : ""}</span>` : ""}${play ? `<span class="cost-tag down">🔥 playable ${(e.play || { any: true }).any ? "while exiled" : e.play.next ? "through your next turn" : "this turn"}</span>` : ""}${e.toHand ? `<span class="cost-tag">→ hand at your end step (${esc(e.src)})</span>` : ""}
            <div class="zone-acts">${play ? btn(id, "cast", /\bLand\b/.test(e.t) ? "Play" : "Cast", "primary") : alt ? btn(id, "cast", `Cast (${esc(alt)})`, "primary") : ""}
              ${btn(id, "hand", "Hand")}${btn(id, "bf", "Battlefield")}${btn(id, z === "gy" ? "ex" : "gy", z === "gy" ? "Exile" : "Graveyard")}${play || alt ? "" : btn(id, "cast", "Cast")}${btn(id, "drop", "✕", "ghost")}</div></div>`;
        }).join("") || `<p class="muted">Empty.</p>`}
        <div class="zone-add"><select class="fetch-pick" id="za-${z}">${opts}</select>
          ${z === "gy" ? `<button class="btn small" data-a="zone-add" data-z="gy" data-why="milled">Milled</button><button class="btn small" data-a="zone-add" data-z="gy" data-why="discarded">Discarded</button>`
            : `<button class="btn small" data-a="zone-add" data-z="ex" data-why="exiled">Exiled</button>`}</div>
      </details></section>`;
    }).join("");
  }
  // Effects that need a picker get their own reminder shape (Regrowth, impulse draw, Jeska's Will, Bojuka Bog)
  const resolveAmt = (n, srcId) => n && typeof n === "object" ? (n.ctr ? me?.bf?.[srcId]?.c?.[n.ctr] || 0 : n.count ? countOf(me || {}, n.count) : n) : n;
  function ventureBox(r) {
    const cur = me.dg && DUNGEONS[me.dg.d];
    if (cur) { const room0 = cur.rooms[me.dg.r], nx = room0?.next || [];
      return `<div class="mini">In ${esc(cur.name)} — ${esc(room0?.n || "")}. Move to:</div>` + nx.map(i => `<button class="btn small" data-a="dg-go" data-id="${r.id}" data-d="${me.dg.d}" data-r="${i}">${esc(cur.rooms[i].n)}: ${esc(cur.rooms[i].o.slice(0, 60))}${cur.rooms[i].next.length ? "" : " (completes it)"}</button>`).join(""); }
    const ks = r.venture?.under || /venture into Undercity/i.test(r.text || "") ? ["under"] : ["lmop", "mad", "tomb"];
    return `<div class="mini">Not in a dungeon — enter:</div>` + ks.map(k => `<button class="btn small" data-a="dg-go" data-id="${r.id}" data-d="${k}" data-r="0">${esc(DUNGEONS[k].name)} (${esc(DUNGEONS[k].rooms[0].n)}: ${esc(DUNGEONS[k].rooms[0].o.slice(0, 50))})</button>`).join("");
  }
  function dungeonRoom(dk, ri) {
    const d = DUNGEONS[dk], rm = d?.rooms[ri]; if (!rm) return;
    const done = !rm.next.length;
    mutate(p => { if (done) { delete p.dg; p.dgDone = (p.dgDone || 0) + 1; p.dgList = [...String(p.dgList || "").split(", ").filter(Boolean), d.name].slice(-4).join(", "); } else p.dg = { d: dk, r: ri }; });
    logTo(code, `🏰 ${me.name} ventured into ${d.name}: ${rm.n} — ${rm.o}${done ? ` (dungeon completed!)` : ""}`);
    const sp = spellAbility({ n: `${d.name} · ${rm.n}`, t: "Sorcery", o: rm.o }), kw = (rm.o.match(/ with (deathtouch|menace)/) || [])[1];
    const effs = (sp.auto ? sp.effs : sp.effs.filter(f => ["fetch", "countersTarget", "impulse", "tlose", "discardN"].includes(f.k))).map(f => f.k === "tok" && kw ? { ...f, desc: `${f.desc} with ${kw}` } : f);
    if (effs.length) act([{ type: "effects", effs, times: 1, count: 1, src: `🏰 ${rm.n}` }]);
    if (!sp.auto && !effs.length) reminders.push(normalizeRem({ id: newId(), src: `🏰 ${d.name}: ${rm.n}`, text: rm.o, times: 1 }));
    if (done && Object.values(me.bf || {}).some(e => /whenever you complete a dungeon/i.test(e.o || lookupCard(e.n)?.o || ""))) Object.values(me.bf || {}).forEach(e => { const m = String(e.o || lookupCard(e.n)?.o || "").match(/whenever you complete a dungeon, ([^\n]+)/i); if (m) reminders.push(normalizeRem({ id: newId(), src: dispName(e), text: m[1][0].toUpperCase() + m[1].slice(1), times: 1 })); });
  }
  function normalizeRem(r) {
    // Work out X where the app knows it (Sunbird's Invocation, Pyreswipe Hawk); Thickest in the Thicket gets a picker that counts the target's power
    const fillX = (t, n) => t.replace(/,?\s*where X is [^.]+/i, "").replace(/\bX\b/g, String(n));
    if (r.xVal != null) { if (/\bX\b/.test(r.text || "")) { r.text = fillX(r.text, r.xVal); r.note ||= `X = ${r.xVal} (${r.xWhy})`; } delete r.xVal; }
    if (/where X is the greatest mana value among artifacts you control/i.test(r.text || "")) { const n = Math.max(0, ...Object.values(me?.bf || {}).filter(x => /\bArtifact\b/.test(x.t || "")).map(x => manaValue(x.m || ""))); r.note ||= `X = ${n} (greatest mana value among your artifacts)`; r.text = fillX(r.text, n); }
    if (!r.counterPick && /^put X \+1\/\+1 counters on target creature, where X is that creature's power\.?$/i.test((r.text || "").trim())) { const g = spellAbility({ n: "power counters", t: "Instant", o: "Put a +1/+1 counter on target creature." }).effs.find(f => f.k === "countersTarget"); if (g) r.counterPick = { ...g, left: 1, nFromPower: true }; }
    if (!r.eqPick && /attach (?:up to one )?target Equipment you control to (?:it|this creature|target (?:attacking )?creature)/i.test(r.text || "")) r.eqPick = { to: /to target/i.test(r.text) ? null : r.srcId || null };
    if (r.drawN == null && r.srcId && /^draw a card for each Aura and Equipment attached to it\.?$/i.test(r.text || "")) { const n = Object.values(me?.bf || {}).filter(a => a.att === r.srcId).length; r.drawN = n; r.note = `${n} attached`; }
    if (r.drawN == null && /draw a card for each equipped attacking creature you control/i.test(r.text || "")) { const t = room?.turnNo || 0, at = me?.attacked?.turnNo === t ? me.attacked : {};
      const n = Object.keys(at.bf || {}).filter(id => Object.values(me.bf || {}).some(a => a.att === id)).length + Object.keys(at.tok || {}).filter(k => eqList(me.tokens?.[k]).length).length;
      const cl = r.srcId && me.bf?.[r.srcId], pw = cl ? Number(String(ptOf(cl, countsFor(me), pid, r.srcId)).split("/")[0]) || 0 : null;
      r.drawN = n; r.note = `${n} equipped attacker${n === 1 ? "" : "s"} so far${pw != null ? ` · ${dispName(cl)}'s power is ${pw}${pw >= 7 ? " → make the two Treasures" : " (under 7: no Treasures)"}` : ""}`; }
    if (!r.venture && /\bventure into (the dungeon|Undercity)\b/i.test(r.text || "") && !/you've completed|can't venture/i.test(r.text || "")) r.venture = { under: /Undercity/i.test(r.text) };
    if (!r.takeInit && /\byou take the initiative\b/i.test(r.text || "")) r.takeInit = true;
    if (!r.becomeMon && /\byou become the monarch\b/i.test(r.text || "")) r.becomeMon = true;
    if (!r.note && r.srcId && /whenever you cast an aura spell that targets a modified permanent you control/i.test(me?.bf?.[r.srcId]?.o || "")) r.note = "Only if that Aura targets a modified permanent you control (it has counters, Equipment, or an Aura) — skip otherwise.";
    if (!r.note && /where X is the total amount of life your opponents lost this turn/i.test(r.text || "")) { const t = room?.turnNo || 0, n = seated(room || {}).filter(o => o.id !== pid).reduce((a, o) => a + (o.lifeLost?.t === t ? o.lifeLost.n || 0 : 0), 0); r.note = `Opponents lost ${n} life this turn (logged) → X = ${n}`; }
    if (!r.note && (r.effs?.some(f => f.k === "fetch") || /^search your library/i.test(r.text || ""))) { const am = seated(room || {}).filter(o => o.id !== pid && !isOut(o)).flatMap(o => Object.values(o.bf || {}).filter(x => /if an opponent would search a library, that player searches the top four cards of that library instead/i.test(x.o || lookupCard(x.n)?.o || "")).map(x => `${o.name}'s ${dispName(x)}`)); if (am.length) r.note = `Only the top four cards of your library (${am.join(", ")}).`; }
    if (!r.tymnaAsk && /you may pay X life, where X is the number of opponents that were dealt combat damage this turn\. If you do, draw X cards/i.test(r.text || "")) { r.tymnaAsk = { max: seated(room || {}).filter(o => o.id !== pid && !isOut(o)).length }; delete r.effs; }
    if (!r.note && /equal to the amount of life you gained this turn/i.test(r.text || "")) { const t = room?.turnNo || 0, g = me?.lifeGainedN?.t === t ? me.lifeGainedN.n || 0 : null, l = me?.lifeLost?.t === t ? me.lifeLost.n || 0 : 0; r.note = `${g != null ? `Gained ${g} life` : "Life gained this turn isn't logged — count it"}; lost ${l} life this turn (logged).`; }
    if (!r.tymna && /you may pay X life, where X is the number of opponents that were dealt combat damage this turn\. if you do, draw X cards/i.test(r.text || "")) r.tymna = { max: seated(room || {}).filter(o => o.id !== pid && !isOut(o)).length };
    if (!r.pakoAsk && /put a \+1\/\+1 counter on [^.]+ for each noncreature card exiled this way/i.test(r.text || "") && r.srcId) { r.pakoAsk = { id: r.srcId, max: seated(room).filter(o => !isOut(o)).length }; delete r.effs; }
    if (/if you've cast both a creature spell and a noncreature spell this turn/i.test(r.text || "") && !r.note) { const cs = Object.values(room?.casts || {}).filter(c => c.by === pid && (c.turnNo || 0) === (room?.turnNo || 0) && !c.countered), cr = cs.some(c => /\bCreature\b/.test(c.t || "")), nc = cs.some(c => !/\bCreature\b/.test(c.t || "") && !/\bLand\b/.test(c.t || "")); r.note = cr && nc ? "✓ Logged casts this turn include both — apply it." : `✗ Logged casts this turn: ${cr ? "creature yes" : "no creature spell"}, ${nc ? "noncreature yes" : "no noncreature spell"} — skip unless you cast one off the log.`; }
    if (/^double the power and toughness of each creature you control until end of turn/i.test(r.text || "")) r.dblAll = true;
    if (/where X is the number of cards you've drawn this turn minus one/i.test(r.text || "") && !r.note) { const d = Object.values(room?.draws || {}).filter(x => x.by === pid && (x.turnNo || 0) === (room?.turnNo || 0)).reduce((a, x) => a + (x.n || 1), 0); r.note = `You've drawn ${d} this turn (logged) → X = ${Math.max(0, d - 1)}`; }
    if (r.effs?.some(f => f.k === "remove" && f.all && /\battacking\b/i.test(f.what || ""))) r.effs = r.effs.map(f => f.k === "remove" && f.all && /\battacking\b/i.test(f.what || "") ? { ...f, all: false, n: 99, atk: true } : f);
    if (r.effs?.some(f => f.k === "remove" && f.all && /\bexcept\b|aren't\b|not chosen\b/i.test(f.what || ""))) r.effs = r.effs.map(f => f.k === "remove" && f.all && /\bexcept\b|aren't\b|not chosen\b/i.test(f.what || "") ? { ...f, all: false, n: 99, pickAll: true, filter: { alts: [["creature"], ["artifact"], ["enchantment"], ...(/nonland permanent/i.test(f.what || "") ? [["planeswalker"], ["battle"]] : [])], controller: "any", mv: null } } : f);
    if (r.effs?.some(f => f.k === "ping")) {
      const f = r.effs.find(x => x.k === "ping");
      // "Create three Hamster tokens, then it deals X damage …, where X is the number of Hamsters you control" (Rolling Hamsphere): make the tokens first, then count
      const pre = /^create\b[^.]*\btokens?\b[^.]*\bthen\b[^.]*\bdeals? X damage/i.test(r.text || "") ? r.effs.filter(x => x.k === "tok") : [];
      r.ping = { n: resolveAmt(f.n, r.srcId), left: r.times || 1, ...(f.playerOnly ? { playerOnly: true } : {}), ...(f.oppOnly ? { oppOnly: true } : {}), ...(pre.length && f.n && typeof f.n === "object" ? { cnt: f.n } : {}) };
      r.thenEffs = r.effs.filter(x => x.k !== "ping" && !pre.includes(x));
      delete r.effs; r.times = 1;
      if (pre.length) setTimeout(() => { act([{ type: "effects", effs: pre, times: r.ping.left || 1, count: 1, src: r.src, srcId: r.srcId }]); setTimeout(() => { if (reminders.includes(r)) { normalizeRem(r); render(); } }, 60); }, 0);
    }
    if (r.ping?.cnt) r.ping.n = resolveAmt(r.ping.cnt, r.srcId);
    if (r.ping && r.ping.n && typeof r.ping.n === "object") r.ping.n = resolveAmt(r.ping.n, r.srcId);
    if (r.ping) {
      const am = r.thenEffs?.find(x => x.k === "amass");
      r.text = `Deal ${r.ping.n} damage to ${r.ping.oppOnly ? "target opponent" : r.ping.playerOnly ? "target player" : "any target"}${r.ping.left > 1 ? ` (${r.ping.left} times)` : ""}${am ? `, then amass ${am.type} ${am.n}` : ""}.`;
    }
    if (!r.copyFrom && r.srcId && /copy (the exiled card|a card exiled with)/i.test(r.text || "")) r.copyFrom = r.srcId;
    if (r.crDmg && !r.text) r.text = r.crDmg.self ? "Target creature deals damage equal to its power to itself." : `Deal ${r.crDmg.n} damage to target ${r.crDmg.cr === false ? "planeswalker" : `creature${r.crDmg.pw ? " or planeswalker" : ""}`}${r.crDmg.oppOnly ? " an opponent controls" : ""}${r.crDmg.ctrl ? ` and ${r.crDmg.ctrl} to its controller` : ""}.`;
    if (r.earthbend && !r.text) r.text = `Earthbend ${r.earthbend.n}: target land you control becomes a 0/0 creature with haste (still a land) with ${r.earthbend.n} +1/+1 counters. When it dies or is exiled, it returns tapped.`;
    if (r.anyColor && !r.text) r.text = (r.anyN || 1) > 1 ? `Add ${r.anyN} mana${r.anyOne ? " of any one color" : " in any combination of colors"}.` : "Add one mana of any color.";
    if (r.tokAtkMe && !r.text) r.text = `Create X ${r.tokAtkMe.desc} tokens (X = creatures attacking you).`;
    if (r.veil && !r.text) r.text = `Spells you control can't be countered this turn; you and your permanents gain hexproof from ${r.veil.hexFrom.join(" and ")}. (Draws a card if an opponent cast a ${r.veil.drawIf.join(" or ")} spell this turn.)`;
    if (r.plumb && !r.text) r.text = "You draw a card and lose 1 life (plus one copy per creature you sacrifice).";
    if (r.minusX && !r.text) r.text = "Each creature gets −X/−X until end of turn (X = what you paid).";
    if (r.bounceOwn && !r.text) r.text = `Return a ${r.bounceOwn.what} you control to its owner's hand.`;
    if (r.drainX && !r.text) r.text = "Each opponent loses X life; you gain the total.";
    if (r.spoil && !r.text) r.text = `Until end of turn, creatures target player controls lose all abilities and have base P/T ${r.spoil.pt}.`;
    if (r.necroSel && !r.text) r.text = "Destroy all creatures, then return one of the creature cards that died to the battlefield under your control.";
    if (r.imprintLib && !r.text) r.text = `Search your library for ${/^[aeiou]/i.test(r.imprintLib.what) ? "an" : "a"} ${r.imprintLib.what} card and exile it (imprint).`;
    if (r.sacNPick && !r.text) r.text = `Sacrifice ${r.sacNPick.n} ${r.sacNPick.what}s to activate ${r.src}.`;
    if (r.flipFace && !r.text) r.text = r.flipFace.reenter ? (r.flipFace.front ? "Exile it, then return it to the battlefield (front face up)." : "Exile it, then return it to the battlefield transformed.") : "Transform it.";
    if (r.eachDraw && !r.text) r.text = `Each player draws ${r.eachDraw.n === "X" ? "X" : r.eachDraw.n} card${r.eachDraw.n === 1 ? "" : "s"}.`;
    if (r.revealMv && !r.text) r.text = r.revealMv === "lose" ? "Reveal the top card of your library and put it into your hand. You lose life equal to its mana value." : "Reveal the top card of your library and put it into your hand. Each opponent loses X life and you gain X life (X = its mana value).";
    if (r.oppsTok && !r.text) r.text = `Each opponent creates ${r.oppsTok.n === 1 ? "a" : r.oppsTok.n} ${r.oppsTok.desc} token${r.oppsTok.n === 1 ? "" : "s"}.`;
    if (r.gyDrain) r.text = `${r.gyDrain.k} card${r.gyDrain.k === 1 ? "" : "s"} went to ${r.gyDrain.name}'s graveyard. Have them lose ${r.gyDrain.n} life${r.gyDrain.k > 1 ? " for each" : ""} (you gain the same)?`;
    if (r.victimize && !r.text) r.text = `Choose ${r.victimize.n} target ${r.victimize.what} cards in your graveyard. Sacrifice ${/^[aeiou]/i.test(r.victimize.sacWhat) ? "an" : "a"} ${r.victimize.sacWhat}. If you do, return the chosen cards to the battlefield${r.victimize.tapped ? " tapped" : ""}.`;
    if (r.gainAsk) r.text = `Your life went up by ${r.gainAsk} by hand. Was that life gain? (“Whenever you gain life” triggers)`;
    if (r.tloseX && !r.text) r.text = r.tloseX === true ? "Target player loses X life." : `Target player loses ${r.tloseX} life.`;
    if (r.clearCtrs && !r.text) r.text = "Remove all counters from target permanent.";
    if (r.drainDevo && !r.text) r.text = `Each opponent loses X life (X = your devotion to ${({ W: "white", U: "blue", B: "black", R: "red", G: "green" })[r.drainDevo]}); you gain the total.`;
    if (r.oppLose && !r.text) r.text = `Target opponent loses ${r.oppLose.n} life.`;
    if (r.dieGain && !r.text) r.text = r.dieGain.ifPaid ? `If you paid the waterbend cost: whenever a creature dies this turn, you gain ${r.dieGain.n} life.` : `Whenever a creature dies this turn, you gain ${r.dieGain.n} life.`;
    if (r.wbend && !r.text) r.text = `Waterbend {${r.wbend.n}}${r.wbend.optional ? " (optional)" : ""}: tap artifacts and creatures to help pay — each pays {1}.`;
    if (r.dmgDef && !r.text) r.text = `Deal ${r.dmgDef.n === "attackers" ? "X" : r.dmgDef.n} damage to the defending player${r.dmgDef.n === "attackers" ? " (X = attacking creatures)" : ""}.`;
    if (r.dmgPer && !r.text) r.text = `Damage to each ${r.dmgPer.who} equal to ${r.dmgPer.mult === 2 ? "twice " : ""}the number of ${r.dmgPer.what} they control.`;
    if (r.dmgAll && !r.text) r.text = `Deal ${r.dmgAll.n === "creatures" ? "X (the number of creatures)" : r.dmgAll.n} damage to each ${r.dmgAll.opp ? "creature your opponents control" : "creature"}${r.dmgAll.noFly ? " without flying" : ""}${r.dmgAll.players ? ` and each ${r.dmgAll.players === "opp" ? "opponent" : "player"}` : ""}.`;
    if (r.copySpell && !r.text) r.text = `Copy ${r.copySpell.card?.n || "that spell"}?${r.copySpell.haste ? " (a permanent copy gains haste)" : ""}`;
    if (r.text && /^[a-z]/.test(r.text)) r.text = r.text[0].toUpperCase() + r.text.slice(1);
    if (r.bane && !r.text) r.text = "Target enchantment deals damage equal to its mana value to its controller unless they sacrifice it.";
    if (r.effs?.length === 1) {
      const g = r.effs[0], t = r.times || 1;
      const conv = g.k === "swap" ? { swap: g } : g.k === "controlTurn" ? { controlTurn: true } : g.k === "countersTarget" ? { counterPick: { ...g, left: (g.total || 1) * t } }
        : g.k === "pumpTarget" ? { pumpPick: g } : g.k === "tokCopy" ? { tokCopy: true, ...(g.n != null ? { copyN: g.n } : {}) } : g.k === "tplayerTok" ? { tplayerTok: g } : g.k === "prolif" ? { prolif: true }
        : g.k === "attachNew" ? { attachNew: r.ent || {} } : g.k === "regen" ? { regen: g }
        : g.k === "rummage" ? { impulse: { n: 1, cards: [], toGy: true }, note: "You may discard a card. If you do, draw a card." }
        : g.k === "extraCombat" ? null
        : g.k === "radiant" ? { radiant: {}, text: "Copy a single-target spell or ability from this turn for each other legal target." }
        : g.k === "dmgCr" ? { crDmg: { n: resolveAmt(g.n, r.srcId), pw: g.pw, cr: g.cr, oppOnly: g.opp, ...(g.ctrl ? { ctrl: g.ctrl } : {}), ...(g.exile ? { exile: true } : {}), ...(g.upTo ? { grp: true } : {}) } }
        : g.k === "victimize" ? { victimize: g } : g.k === "revealMv" ? { revealMv: g.mode } : g.k === "oppsTok" ? { oppsTok: g } : g.k === "imprintLib" ? { imprintLib: g } : g.k === "animate" ? { animate: g, text: `Target ${g.what} becomes an artifact creature with base power and toughness ${g.p}/${g.tg} (unless it's a Vehicle).` } : g.k === "copyPick" ? { copySpell: { card: null, pick: true }, text: "Copy target instant or sorcery spell you control." } : g.k === "maze" ? { maze: true, text: "Untap target attacking creature. Combat damage to and by it is prevented this turn." } : g.k === "eachDraw" ? { eachDraw: g } : g.k === "transformSelf" || g.k === "reenterFace" ? { flipFace: { id: r.srcId, reenter: g.k === "reenterFace", front: !!g.front } } : g.k === "tapLock" ? { tapLock: g, text: `Tap up to one target ${g.what}. It doesn't untap while you control ${r.src}.` } : g.k === "blink" ? { blink: g.filter ? { filter: g.filter } : true, text: `Exile target ${g.what || "creature"} you control, then return it to the battlefield.` } : g.k === "copyTrig" ? { copyTrig: true, text: "Copy target triggered ability you control." } : g.k === "arcum" ? { arcum: true, text: "Target artifact creature's controller sacrifices it, then may search for a noncreature artifact and put it onto the battlefield." } : g.k === "attachSelf" ? { attachPick: { srcId: r.srcId, type: g.type }, text: `Attach it to target ${g.type} you control.` } : g.k === "tloseX" ? { tloseX: true } : g.k === "clearCtrs" ? { clearCtrs: true } : g.k === "drainDevo" ? { drainDevo: g.color } : g.k === "oppLoseThat" ? { oppLose: { n: r.evN || 1 } }
        : g.k === "dmgPer" ? { dmgPer: g } : g.k === "dmgDef" ? { dmgDef: { n: g.n } }
        : g.k === "earthbend" ? { earthbend: { n: g.n === "experience" ? (me.experience || 0) : g.n } } : g.k === "dieGain" ? { dieGain: { n: g.n, ifPaid: g.ifPaid } }
        : g.k === "dmgAll" ? { dmgAll: g } : g.k === "copySpell" ? { copySpell: { ...g, card: r.evCard || null } } : g.k === "discardN" ? { impulse: { n: g.n, cards: [], toGy: true } } : g.k === "wisecrack" ? { crDmg: { self: true, atk: g.atk, cr: true } } : g.k === "bane" ? { bane: {} }
        : g.k === "suspect" ? { suspect: g } : g.k === "copyCreature" ? { copyCreature: g } : g.k === "sacThen" ? { sacThen: g } : g.k === "tgain" ? { tgain: g } : g.k === "gyOne" ? { gyOne: true }
        : g.k === "oracle" ? { oracle: g, text: `Look at the top X cards of your library (X = your devotion to ${g.colorName}). ${g.dig ? "Put up to one on top and the rest on the bottom. " : ""}If X is at least the number of cards left in your library, you win.` } : null;
      if (conv) { Object.assign(r, conv); delete r.effs; r.times = 1; }
    }
    const f = r.effs?.length === 1 && ["regrow", "impulse", "handmana", "gyhate", "stealEx"].includes(r.effs[0].k) ? r.effs[0] : null;
    if (f) {
      delete r.effs;
      if (f.k === "regrow") { r.regrow = f; r.left = f.all ? 1 : (f.n || 1) * (r.times || 1); }
      if (f.k === "impulse") r.impulse = { ...f, n: f.n === "X" ? "X" : f.n * (r.times || 1), cards: [] };
      if (f.k === "handmana") r.handMana = f;
      if (f.k === "gyhate") r.gyHate = f;
      if (f.k === "stealEx") r.stealEx = { ...f, who: r.who && r.who !== pid ? r.who : opponents().length === 1 ? opponents()[0].id : null };
      r.times = 1;
    }
    const DEST = { hand: "your hand", battlefield: "the battlefield", top: "the top of your library" };
    if (r.regrow) r.text = `Return ${r.regrow.all ? "all" : r.regrow.upTo ? `up to ${r.left}` : r.left > 1 ? r.left : /^[aeiou]/i.test(r.regrow.what) && r.regrow.what !== "card" ? "an" : "a"} ${r.regrow.what === "card" ? "" : r.regrow.what + " "}card${r.regrow.all || r.left > 1 ? "s" : ""} from ${r.regrow.any ? "a" : "your"} graveyard to ${DEST[r.regrow.dest]}${r.regrow.tapped ? " tapped" : ""}.`;
    if (r.regrow?.xLabel) r.text = `Return X target ${r.regrow.what} cards from your graveyard to the battlefield (one at a time; Done when finished). They're sacrificed at the next end step.`;
    if (r.impulse?.toGy) r.text = "Log the cards you discarded (so your graveyard / exile is right).";
    else if (r.impulse) r.text = `Exile the top ${r.impulse.n === "X" ? "X" : r.impulse.n} card${r.impulse.n === 1 ? "" : "s"} of your library. You may play ${r.impulse.n === 1 ? "it" : "them"} ${r.impulse.next ? "until the end of your next turn" : "this turn"}.`;
    if (r.impulse?.choose && !r.note) r.note = "Add the card you choose to play FIRST; the other just stays exiled.";
    if (r.handMana) r.text = `Add ${r.handMana.syms} for each card in an opponent's hand.`;
    if (r.stealEx) r.text = r.stealEx.dest === "battlefield" ? "Put a card from an opponent's library onto the battlefield under your control." : "Exile a card from an opponent's library. You may play it while it stays exiled.";
    if (r.gyHate) r.text = r.gyHate.who === "target" ? "Exile target player's graveyard." : r.gyHate.who === "opps" ? "Exile each opponent's graveyard." : "Exile all graveyards.";
    return r;
  }
  function regrowBox(r) {
    const f = r.regrow;
    const list = Object.entries(me.gy || {}).filter(([, e]) => permMatch(e, f.filter));
    const theirs = f.any && f.dest === "battlefield" ? seated(room).filter(o => o.id !== pid && !isOut(o)).flatMap(o => Object.entries(o.gy || {}).filter(([, e]) => permMatch(e, f.filter)).map(([id, e]) => [`o:${o.id}:${id}`, e, o])) : [];
    if (theirs.length && !f.all) {
      const to2 = { hand: "To hand", battlefield: "Onto battlefield", top: "On top of library" }[f.dest];
      return `<select class="fetch-pick" id="rg-${r.id}">${[...list.map(([id, e]) => `<option value="${id}">${esc(dispName(e))}</option>`), ...theirs.map(([v, e, o]) => `<option value="${v}">${esc(o.name)}'s ${esc(dispName(e))}</option>`)].join("")}</select>
      <button class="btn small primary" data-a="rg-go" data-id="${r.id}">${to2}${r.left > 1 ? ` (${r.left} left)` : ""}</button>`;
    }
    const pre = `${f.mill ? `<div class="mini">Log the milled cards first (🪦 Graveyard → Milled).</div>` : ""}${f.any ? `<div class="mini">Only your graveyard is listed. For another player's card, use “Card not in your deck?”.</div>` : ""}`;
    if (!list.length) return `${pre}<span class="mini">No ${esc(f.what)} cards in your graveyard (in the app).</span>`;
    const to = { hand: "To hand", battlefield: "Onto battlefield", top: "On top of library" }[f.dest];
    if (f.all) return `${pre}<button class="btn small primary" data-a="rg-all" data-id="${r.id}">Return all ${list.length}: ${esc(list.map(([, e]) => e.n).join(", "))}</button>`;
    return `${pre}<select class="fetch-pick" id="rg-${r.id}">${list.map(([id, e]) => `<option value="${id}">${esc(dispName(e))}</option>`).join("")}</select>
      <button class="btn small primary" data-a="rg-go" data-id="${r.id}">${to}${r.left > 1 ? ` (${r.left} left)` : ""}</button>`;
  }
  function impulseBox(r) {
    const k = r.impulse;
    if (k.n === "X" && k.x == null) return `<label class="mini">X = <input type="number" min="0" inputmode="numeric" class="x-input" id="ix-${r.id}"></label><button class="btn small primary" data-a="imp-x" data-id="${r.id}">Set</button>`;
    const n = k.n === "X" ? k.x : k.n;
    // digital deck: discards come from the digital hand; exiled-from-top cards can be read off the digital library
    const inHand = k.toGy && dig?.on ? (() => { const left = [...dig.hand]; k.cards.forEach(c => { const j = left.indexOf(c.n); if (j >= 0) left.splice(j, 1); }); return left; })() : null;
    const opts = inHand ? inHand.map(nm => [nm, (deck?.cards || []).findIndex(c => c.n === nm)]).filter(([, i]) => i >= 0).map(([nm, i]) => `<option value="${i}">${esc(dispName(deck.cards[i]))}</option>`).join("")
      : (deck?.cards || []).map((c, i) => [c, i]).sort((a, b) => a[0].n.localeCompare(b[0].n)).map(([c, i]) => `<option value="${i}">${esc(dispName(c))}</option>`).join("");
    const digTop = !k.toGy && dig?.on && !k.cards.length && n > 0 ? `<button class="btn small primary" data-a="imp-dig" data-id="${r.id}">🂠 Exile the top ${n} of my digital library</button>` : "";
    return `${digTop}<div class="mini">${k.toGy ? "Which cards did you discard?" : "Which cards were exiled?"}</div><div class="ans-list">${k.cards.map((c, j) => `<span class="pill">${esc(c.n)} <button class="linkish" data-a="imp-del" data-id="${r.id}" data-j="${j}">✕</button></span>`).join("")}</div>
      ${k.cards.length < n ? `<select class="fetch-pick" id="ip-${r.id}">${opts}</select><button class="btn small" data-a="imp-add" data-id="${r.id}">Add (${k.cards.length}/${n})</button>` : ""}
      ${k.cards.length ? `<button class="btn small primary" data-a="imp-go" data-id="${r.id}">${k.toGy ? "Discarded → graveyard" : "Exiled · make playable"}</button>` : ""}`;
  }
  function handManaBox(r) {
    const f = r.handMana;
    return `${f.waiting ? `<span class="mini">⏳ Asked ${esc(room.players?.[f.waiting]?.name || "them")}…</span>` : opponents().map(o => `<button class="btn small primary" data-a="hm-ask" data-id="${r.id}" data-o="${o.id}" style="border-left:4px solid ${esc(o.color)}">Ask ${esc(o.name)}</button>`).join("")}
      <label class="mini">or cards in hand: <input type="number" min="0" inputmode="numeric" class="x-input" id="hm-${r.id}"></label><button class="btn small" data-a="hm-set" data-id="${r.id}">Set</button>`;
  }
  function handManaDone(r, n, who) {
    const f = r.handMana;
    delete r.handMana;
    r.mana = { syms: f.syms, n };
    r.note = `${who ? `${who} has` : "Opponent has"} ${n} card${n === 1 ? "" : "s"} in hand`;
    logTo(code, `${r.src}: ${who || "target opponent"} has ${n} card${n === 1 ? "" : "s"} in hand → add ${f.syms} × ${n}`);
    render();
  }
  // Gonti / Thief of Sanity / Praetor's Grasp / Bribery: name the card you took (it's from their deck, so type it in)
  function stealExBox(r) {
    const k = r.stealEx;
    if (!k.who) return opponents().map(o => `<button class="btn small primary" data-a="sx-who" data-id="${r.id}" data-o="${o.id}" style="border-left:4px solid ${esc(o.color)}">${esc(o.name)}</button>`).join("");
    const o = room.players?.[k.who];
    if (k.card) return `<span class="pill">${esc(k.card.n)} (${esc(o?.name || "?")}'s)</span>
      <button class="btn small primary" data-a="sx-go" data-id="${r.id}">${k.dest === "battlefield" ? "Onto my battlefield" : "Exile · playable by me"}</button>
      <button class="linkish" data-a="sx-clear" data-id="${r.id}">change</button>`;
    return `<span class="mini">${esc(o?.name || "?")}'s card:</span><input type="search" class="x-input wide-in" id="sx-${r.id}" placeholder="Card name" autocomplete="off">
      <button class="btn small" data-a="sx-find" data-id="${r.id}">Find</button>`;
  }
  // Dauthi Voidwalker: pick an opponent's exiled card with a void counter
  function voidBox(r) {
    const list = seated(room).filter(o => o.id !== pid).flatMap(o => Object.entries(o.ex || {}).filter(([, e]) => e.void).map(([id, e]) => ({ o, id, e })));
    if (!list.length) return `<span class="mini">No opponent cards with void counters (in the app).</span>`;
    return `<select class="fetch-pick" id="vp-${r.id}">${list.map(x => `<option value="${x.o.id}|${x.id}">${esc(x.o.name)}: ${esc(dispName(x.e))}</option>`).join("")}</select>
      <button class="btn small primary" data-a="void-go" data-id="${r.id}">Take it (play this turn, free)</button>`;
  }
  // Orcish Bowmasters & friends: each ping picks its own target
  // Thassa's Oracle: X is your devotion when the trigger resolves (so a bounce in response lowers it)
  function oracleBox(r) {
    const x = devotion(me)[r.oracle.color] || 0;
    return `<span class="mini">X right now = <b>${x}</b> (devotion to ${esc(r.oracle.colorName)})</span>
      <label class="mini">Cards left in library <input type="number" min="0" inputmode="numeric" class="x-input" id="or-${r.id}"></label>
      <button class="btn small primary" data-a="oracle-go" data-id="${r.id}">Resolve</button>
      <button class="btn small" data-a="oracle-go" data-id="${r.id}" data-empty="1">Library is empty</button>`;
  }
  // The Ring tempts you: pick (or keep) a Ring-bearer
  function ringBox(r) {
    const next = (me.ring?.n || 0) + 1, cur = ringBearer(me);
    const opts = [...Object.entries(me.bf || {}).filter(([, e]) => /\bCreature\b/.test(e.t || "")).map(([id, e]) => [`bf:${id}`, dispName(e)]),
      ...Object.entries(me.tokens || {}).filter(([, t]) => t.count > 0 && isCreatureToken(t.name)).map(([k, t]) => [`tok:${k}`, `${t.name} token${t.count > 1 ? ` (one of ${t.count})` : ""}`])];
    const sel = cur ? (cur.id ? `bf:${cur.id}` : `tok:${cur.k}`) : "";
    return `<span class="mini">Time #${next}${next <= 4 ? ` · unlocks: ${esc(RING_LEVELS[next - 1])}` : " · all four abilities already unlocked"}</span>
      ${opts.length ? `<select class="fetch-pick" id="rb-${r.id}">${opts.map(([v, n]) => `<option value="${esc(v)}" ${v === sel ? "selected" : ""}>${esc(n)}</option>`).join("")}</select>
      <button class="btn small primary" data-a="ring-go" data-id="${r.id}">💍 Make Ring-bearer</button>`
      : `<span class="mini">No creature to be your Ring-bearer.</span><button class="btn small primary" data-a="ring-go" data-id="${r.id}">OK</button>`}`;
  }
  // Attacking: ask who it attacks; a Ring-bearer also carries its Ring abilities
  // My attacker's combat stats, with Champion of Lambholt / Ring-bearer evasion and Torbran's +2
  function myAtkStats(kind, id) {
    const s = combatStats(tablePlayers[pid] || { ...me, id: pid }, kind, id);
    if (!s) return null;
    const ev = Object.entries(me.bf || {}).filter(([, e]) => /creatures with power less than [^.]*? power can't block creatures you control/i.test(e.o || lookupCard(e.n)?.o || ""))
      .map(([x, e]) => Number(ptOf(e, countsFor(me), pid, x).split("/")[0]) || 0).sort((a, b) => b - a)[0];
    if (ev) s.evade = ev;
    if ((kind === "bf" ? me.ring?.bearer?.id === id : ringBearer(me)?.k === id) && ringLevel(me)) s.ring = 1;
    const src = kind === "bf" ? me.bf[id] : me.tokens[id];
    const am = ampDmg(s.p, src, true);
    if (am.n !== s.p) { s.p = am.n; s.amp = am.why; }
    return s;
  }
  // The attack preview for one of my creatures: one block per opponent
  function planBox(r, kind, id, n) {
    const a = myAtkStats(kind, id);
    if (!a) return `<span class="mini">It isn't a creature right now.</span>`;
    return `<div class="atk-plan"><div class="mini">${esc(a.name)} ${a.p}/${a.t}${a.kws.length ? ` · ${esc(a.kws.join(", "))}` : ""}${n > 1 ? ` · ${n} attacking` : ""}</div>${opponents().filter(o => !isOut(o)).map(o => {
      const pv = blockPreview(a, { ...o, id: o.id });
      const warn = pv.killers.length ? `⚠ ${pv.killers.map(b => `${b.name} ${b.p}/${b.t}`).join(", ")} could block and kill it` : pv.trades.length ? `⚖ ${pv.trades.map(b => b.name).join(", ")} could trade with it` : "";
      return `<details class="plan-opp" ${warn ? "open" : ""}><summary style="border-left:4px solid ${esc(o.color)}"><b>${esc(o.name)}</b>: ${pv.able.length ? `${pv.able.length} could block${pv.menace ? " (menace: needs 2)" : ""}` : "✅ nothing can block it"}${warn ? ` · <span class="plan-warn">${esc(warn)}</span>` : ""}</summary>
        ${pv.rows.length ? pv.rows.map(b => `<div class="mini plan-row ${b.out ? "" : "muted"}">${esc(b.name)} <b>${b.p}/${b.t}</b>${b.count > 1 ? ` ×${b.avail}/${b.count}` : ""}${b.kws.length ? ` <i>${esc(b.kws.join(", "))}</i>` : ""} — ${esc(outText(b, true))}${b.out?.tramp ? ` · ${b.out.tramp} tramples over` : ""}</div>`).join("") : `<div class="mini muted">No creatures.</div>`}
      </details><button class="btn small ${warn ? "" : "primary"}" ${kind === "bf" ? `data-a="plan-go" data-id="${r.id}"` : `data-a="tok-atk" data-k="${esc(id)}"`} data-o="${o.id}">⚔ Attack ${esc(o.name)}${pv.killers.length ? " anyway" : ""}</button>`;
    }).join("")}</div>`;
  }
  // Attack with a creature card (after the preview); oid = who it attacks
  function attackNow(bid, oid) {
        const e = me.bf?.[bid];
        if (!e) return;
        const full = { ...e, o: e.o || lookupCard(e.n)?.o };
        if (isSick(full, meOwner(), bid) && !confirm(`${dispName(e)} is summoning sick (it came under your control this turn).\n\nAttack anyway?`)) return;
        const vig = kwsOf(full, pid, bid).some(x => x.k === "vigilance");
        logTo(code, `${me.name}: ${dispName(e)} attacks`);
        act([{ type: "attacks", id: bid, t: e.t || "", kws: kwsOf(full, pid, bid).map(x => x.k) }, ...(!vig && !e.tap ? [{ type: "tapped", id: bid }] : []), ...youAttackEv()], p => { if (!vig) p.bf[bid].tap = true; markAttacked(p, "bf", bid, 1); p.youAtk = combatKey(); });
        if ((e.c?.p1p1 || 0) > 0) { const by = Object.values(me.bf || {}).filter(x => /whenever a creature you control with a \+1\/\+1 counter on it attacks, double the number of \+1\/\+1 counters on it/i.test(x.o || lookupCard(x.n)?.o || "")).length;
          if (by) { act([], p => { const x = p.bf?.[bid]; if (x?.c?.p1p1) x.c.p1p1 *= 2 ** by; }); logTo(code, `⚔ ${dispName(e)}'s +1/+1 counters doubled (Byrke)`); } }
        const power = Number(ptOf(me.bf?.[bid] || e, countsFor(me), pid, bid).split("/")[0]) || 0;
        startAttack(dispName(e), { name: e.n, myriad: myriadCount({ ...e, o: e.o || lookupCard(e.n)?.o }), power, cmd: !!e.cmd || (!e.own && !!deck?.cmds?.includes(e.n)), ownId: e.own?.id || null, loses: damageLoses(lookupCard(e.n)), stats: myAtkStats("bf", bid) }, me.ring?.bearer?.id === bid, { ...e, id: bid }, kwsOf(full, pid, bid));
    if (oid) { const r = reminders.filter(x => x.attack).at(-1); if (r) sendAttack(r, oid); }
  }
  // Send an attack to a defender: their phone gets the "is attacking you" note
  function sendAttack(r, oid) {
        const o = room.players?.[oid];
        if (!r || !o) return;
        { const ck = `${combatKey()}|${oid}`; if (!curseHit.has(ck)) { curseHit.add(ck); seated(room).filter(x => !isOut(x)).forEach(ow => Object.values(ow.bf || {}).filter(e => e.encOpp === oid && /whenever enchanted player is attacked, create a gold token\. each opponent attacking that player does the same/i.test(e.o || lookupCard(e.n)?.o || "")).forEach(e => {
          setTimeout(() => act([{ type: "create", name: "Gold", n: 1, desc: "Gold", src: `${ow.id === pid ? "" : `${ow.name}'s `}${dispName(e)}` }]), 0);
          if (ow.id !== pid) sendNote(ow.id, { text: `${me.name} attacked ${o.name} (enchanted by your ${dispName(e)}): create a Gold token.`, src: dispName(e) });
          logTo(code, `🪙 ${dispName(e)}: ${o.name} was attacked → Gold for ${ow.id === pid ? me.name : `${ow.name} and ${me.name}`}`); })); } }
        { const ck = `b|${combatKey()}|${oid}`; if (!curseHit.has(ck)) { curseHit.add(ck); seated(room).filter(x => !isOut(x)).forEach(ow => Object.values(ow.bf || {}).filter(e => /whenever a player attacks one of your opponents, if that opponent has more life than another of your opponents, that attacking player draws a card and you put a \+1\/\+1 counter on each creature you control/i.test(e.o || lookupCard(e.n)?.o || "")).forEach(e => {
          if (oid === ow.id) return; const lifeOf = x => x.life ?? START_LIFE, others = seated(room).filter(x => !isOut(x) && x.id !== ow.id && x.id !== oid);
          if (!others.some(x => lifeOf(x) < lifeOf(o))) return;
          reminders.push({ id: newId(), src: `${ow.id === pid ? "" : `${ow.name}'s `}${dispName(e)}`, text: `You attacked ${o.name} (more life than another opponent): draw a card${ow.id === pid ? ", and put a +1/+1 counter on each creature you control" : ""}.`, drawN: 1, times: 1 });
          if (ow.id !== pid) sendNote(ow.id, { text: `${me.name} attacked ${o.name}: put a +1/+1 counter on each creature you control (${dispName(e)}).`, src: dispName(e) }); })); } }
        reminders = reminders.filter(x => x.id !== r.id);
        const a = r.attack;
        { const tax = Object.values(o.bf || {}).map(x => [x, (String(x.o || lookupCard(x.n)?.o || "").match(/creatures can't attack you unless their controller pays \{(\d+)\} for each (?:creature they control that's attacking you|of those creatures)/i) || [])[1] || (/creatures can't attack you or planeswalkers you control unless their controller pays \{X\} for each of those creatures, where X is the number of enchantments you control/i.test(x.o || lookupCard(x.n)?.o || "") ? String(countTypes(o, ["enchantment"])) : null)]).filter(x => x[1] && x[1] !== "0");
          Object.values(o.bf || {}).filter(x => /each creature with one or more counters on it can't attack you or planeswalkers you control unless its controller pays \{X\}/i.test(x.o || lookupCard(x.n)?.o || "")).forEach(x => { const at = Object.values(me.bf || {}).find(y => y.n === a.name), k = Object.values(at?.c || {}).reduce((s2, v) => s2 + (Number(v) || 0), 0); if (k) reminders.push({ id: newId(), src: `${o.name}'s ${dispName(x)}`, text: `Pay {${k * (a.times || 1)}} to attack ${o.name} (${k} counter${k === 1 ? "" : "s"} on ${a.name}).`, times: 1 }); });
          tax.forEach(([x, n]) => { const due = Number(n) * (a.times || 1); reminders.push({ id: newId(), src: `${o.name}'s ${dispName(x)}`, text: `Pay {${due}} to attack ${o.name}${(a.times || 1) > 1 ? ` (${a.times} attackers)` : ""}.`, times: 1 }); logTo(code, `💰 ${o.name}'s ${dispName(x)}: ${me.name} pays {${due}} to attack`); }); }
        sendNote(oid, { kind: "hit", text: `${r.src}${a.cmd ? " (commander)" : ""} ${/^([2-9]|\d\d+) /.test(r.src) ? "attack" : "attacks"} you for ${a.power}${a.ds ? " (double strike, both hits)" : ""}${a.mult ? ` (${a.multWhy})` : ""}${a.torbran ? ` (includes +${a.torbran} per red source)` : ""}.`, src: r.src, power: a.power, ...(a.loses ? { loses: true } : {}), ...(a.ring ? { ring: a.ring } : {}), ...(a.evade ? { evade: a.evade } : {}), cardN: a.name, ...(a.times > 1 ? { times: a.times } : {}), ...(a.stats ? { stats: a.stats, ...(a.stats.kws.includes("trample") ? { trample: true } : {}) } : {}),
          cmdKey: a.cmd ? `${a.ownId || pid}~${slugify(a.name)}` : "", fromId: pid });
        logTo(code, `⚔ ${me.name}'s ${r.src} ${/^([2-9]|\d\d+) /.test(r.src) ? "attack" : "attacks"} ${o.name}`);
        { const cnt = Math.max(1, a.times || 1), lose = Object.values(o.bf || {}).reduce((acc, x) => { const t = String(x.o || lookupCard(x.n)?.o || ""); let m = t.match(/whenever a creature attacks you(?: or a planeswalker you control)?, that creature's controller loses (\d+) life and you gain \1 life/i); if (m) acc.push([x, Number(m[1])]); m = t.match(/whenever a creature with power (\d+) or greater attacks you, its controller loses (\d+) life and you gain \2 life/i); if (m && (a.power || 0) >= Number(m[1])) acc.push([x, Number(m[2])]); return acc; }, []);
          lose.forEach(([x, n]) => { const tot = n * cnt; mutate(p => { p.life = (p.life ?? START_LIFE) - tot; }); sendOrders({ [oid]: {} }, { how: "gainLife", n: tot, src: dispName(x), why: `${me.name}'s ${r.src} attacked: gain ${tot}` }); logTo(code, `⚙ ${o.name}'s ${dispName(x)}: ${me.name} loses ${tot}, ${o.name} gains ${tot}`); });
          const ck = combatKey(); atkCount = atkCount.k === ck ? atkCount : { k: ck, n: 0, fired: {} }; const was = atkCount.n; atkCount.n += cnt;
          seated(room).filter(x => !isOut(x)).forEach(ow => Object.values(ow.bf || {}).forEach(x => { const t = String(x.o || lookupCard(x.n)?.o || ""), mine = ow.id === pid;
            [[3, /whenever a player attacks with three or more creatures, ([^\n.]+)\./i], [5, /whenever a player attacks with five or more creatures, ([^\n.]+)\./i]].forEach(([need, re]) => { const m = t.match(re), fk = `${ow.id}|${x.n}|${need}`; if (!m || was >= need || atkCount.n < need || atkCount.fired[fk]) return; atkCount.fired[fk] = 1;
              if (mine) reminders.push(normalizeRem({ id: newId(), src: dispName(x), text: m[1][0].toUpperCase() + m[1].slice(1) + ".", times: 1 })); else sendNote(ow.id, { text: `${me.name} attacked with ${need}+ creatures — your ${dispName(x)}: ${m[1]}.`, src: dispName(x) }); }); })); }
        const myr = a.myriad && opponents().filter(x => x.id !== oid && !isOut(x));
        if (myr?.length) reminders.push({ id: newId(), src: `${r.src} (myriad${a.myriad > 1 ? ` ×${a.myriad}` : ""})`, text: `Copies attack each other opponent: ${myr.map(x => x.name).join(", ")}.`, times: 1, myriad: { name: a.name, n: a.myriad, others: myr.map(x => x.id) } });
        render();
  }
  let combatFired = null, oppCombatSeen = null, akiriSeen = {};
  function fireCombat() { const t = room.turnNo || 0; if (combatFired === t) return; combatFired = t; phaseEvents([{ type: "phase", phase: "combat", mine: true }]); }
  function startAttack(src, attack, bearer, e, kws) {
    if (room.turn === pid) fireCombat();
    const times = attack.times || 1;
    const basePow = Math.max(0, Math.round((attack.power || 0) / times));
    const cb = room.combat?.turnNo === (room.turnNo || 0) ? room.combat.n || 0 : 0;
    update(ref(db, `rooms/${code}/combat`), { turnNo: room.turnNo || 0, n: cb + times });
    const mult = dmgMult(true);
    if (mult.m > 1) { attack.power *= mult.m; attack.mult = mult.m; attack.multWhy = mult.srcs.join(", "); }
    if (e && isRedSrc(e) && redBonus()) { attack.power += redBonus() * times; attack.torbran = redBonus(); }
    const cfb = e && String(e.o || lookupCard(e.n)?.o || "").match(/has firebending (\d+) as long as there's an? ([A-Z][a-z]+) card in your graveyard/);
    const fb = (cfb && Object.values(me.gy || {}).some(c => new RegExp(`\\b${cfb[2]}\\b`).test(c.t || lookupCard(c.n)?.t || "")) ? Number(cfb[1]) : 0) + (e ? firebendingOf({ ...e, o: e.o || lookupCard(e.n)?.o }) || (/^Firebending X, where X is this creature's power/im.test(e.o || lookupCard(e.n)?.o || "") ? basePow : 0) : 0) + (kws || []).filter(x => /^firebending \d+$/.test(x.k)).reduce((a, x) => a + Number(x.k.split(" ")[1]), 0);
    if (fb) { poolAdd("{R}".repeat(fb * times), `${src}: firebending ${fb}${times > 1 ? ` ×${times}` : ""}, until end of combat`, true); logTo(code, `🔥 ${me.name}'s ${src}: firebending → {R}×${fb * times} until end of combat`); }
    { const nAtt = e?.id ? attachedTo(me, e.id, false).length : eqList(e).length; // Equipment / Auras on the attacker
      if (nAtt) { const ck = combatKey();
        Object.entries(me.bf || {}).forEach(([sid, x]) => { const o = String(x.o || lookupCard(x.n)?.o || "");
          const ak = o.match(/whenever you attack (?:a player )?with one or more equipped creatures, ([^.]+)\./i); // Akiri
          if (ak && akiriSeen[sid] !== ck) { akiriSeen[sid] = ck; reminders.push(normalizeRem({ id: newId(), src: dispName(x), srcId: sid, text: ak[1][0].toUpperCase() + ak[1].slice(1) + ".", times: 1, ...(/^draw a card$/i.test(ak[1]) ? { drawN: 1 } : {}) })); }
          const rv = e?.id && o.match(/whenever a creature you control that's enchanted or equipped attacks, that creature gains ([a-z ]+?) until end of turn/i); // Reyav
          if (rv) { kws = [...(kws || []), { k: rv[1], src: dispName(x) }]; const tid = e.id; mutate(p => { p.eot ||= {}; p.eot[`rv${Date.now().toString(36)}${sid}`] = { src: dispName(x), target: tid, dp: 0, dt: 0, kws: [rv[1]] }; }); logTo(code, `⚙ ${dispName(x)}: ${src} gains ${rv[1]} until end of turn`); }
        }); } }
    if ((kws || []).some(x => x.k === "double strike")) { attack.ds = true; attack.power *= 2; }
    if (e?.id) attachedTo(me, e.id, false).forEach(([sid, a]) => {
      const tx0 = (String(a.o || lookupCard(a.n)?.o || "").match(/^whenever (?:equipped|enchanted) creature attacks, (?!if it's the first combat)(.+)$/im) || [])[1];
      const ord = tx0 && tx0.match(/^put a \+1\/\+1 counter on it\. then if it has (three|\d+) or more \+1\/\+1 counters on it, sacrifice this aura\.?$/i); // the Ordeals
      if (ord) { const need = ord[1] === "three" ? 3 : Number(ord[1]), now = (me.bf?.[e.id]?.c?.p1p1 || 0) + 1;
        mutate(p => { const x = p.bf?.[e.id]; if (x) { x.c ||= {}; x.c.p1p1 = (x.c.p1p1 || 0) + 1; } }); logTo(code, `⚙ ${dispName(a)}: +1/+1 counter on ${src} (${now})`);
        if (now >= need) { const sw = String(a.o || lookupCard(a.n)?.o || "").match(/^when you sacrifice this aura, ([^\n]+)/im); const sp = sw && spellAbility({ n: `${a.n} · sacrificed`, t: "Instant", o: sw[1] });
          reminders.push({ id: newId(), src: dispName(a), text: `${src} has ${now} +1/+1 counters: sacrifice ${dispName(a)} (move it to the graveyard).`, times: 1 });
          if (sw) reminders.push(normalizeRem({ id: newId(), src: `${dispName(a)} (sacrificed)`, text: sw[1].replace(/^\w/, c => c.toUpperCase()), times: 1, ...(sp?.effs.length ? { effs: sp.effs } : {}) })); } }
      const tx = ord ? null : tx0;
      if (tx) { const sp = spellAbility({ n: `${a.n} · attack`, t: "Instant", o: tx.replace(/^you may /i, "") }); const ef = sp.effs.filter(f => ["fetch", "tok", "pumpTarget", "countersTarget", "countersEach", "ping", "drain"].includes(f.k));
        if (ef.some(f => f.k === "fetch")) reminders.push({ id: newId(), src: dispName(a), text: "Search your library", fetch: ef.find(f => f.k === "fetch"), left: 1, times: 1, note: /you may/i.test(tx) ? "Optional." : "" });
        else if (ef.length && (sp.auto || !/\b(?:tap|untap|destroy|exile|return|fight|sacrifice)\b/i.test(tx))) act([{ type: "effects", effs: ef, times: 1, count: 1, src: dispName(a), srcId: sid }]); // Andúril stays automatic
        else if (ef.length) reminders.push(normalizeRem({ id: newId(), src: dispName(a), srcId: sid, text: tx.replace(/^\w/, c => c.toUpperCase()), times: 1, effs: ef })); // Greatsword of Tyr: the counter plus a tap you pick
        else reminders.push({ id: newId(), src: dispName(a), text: tx, times: 1 }); } if (/whenever equipped creature attacks, if it's the first combat phase of the turn, untap it/i.test(a.o || lookupCard(a.n)?.o || "")) reminders.push({ id: newId(), src: dispName(a), text: "First combat this turn? Untap it. There's an additional combat phase after this one (use ↺ Combat on the step bar).", times: 1, untapOne: e.id }); });
    if (room.turn === pid && stepOf(room) < 3) update(ref(db, `rooms/${code}`), { step: { turnNo: room.turnNo || 0, i: 3 } });
    const lvl = bearer ? ringLevel(me) : 0;
    if (lvl) attack.ring = lvl;
    // Champion of Lambholt: "Creatures with power less than this creature's power can't block creatures you control"
    const ev = Object.entries(me.bf || {}).filter(([, e]) => /creatures with power less than [^.]*? power can't block creatures you control/i.test(e.o || lookupCard(e.n)?.o || ""))
      .map(([id, e]) => ({ src: dispName(e), n: Number(ptOf(e, countsFor(me), pid, id).split("/")[0]) || 0 })).sort((a, b) => b.n - a.n)[0];
    if (ev) attack.evade = ev;
    if (opponents().length) reminders.push({ id: newId(), src, text: "Who is it attacking?", times: 1, attack });
    if (lvl >= 2) {
      reminders.push({ id: newId(), src: `${src} (Ring-bearer)`, text: "Draw a card.", times: 1, note: "Then discard a card." });
      reminders.push({ id: newId(), src: `${src} (Ring-bearer)`, text: "", times: 1, impulse: { n: 1, cards: [], toGy: true } });
    }
    render();
  }
  // Ring level 4: the Ring-bearer hit me, so each of its controller's opponents loses 3 (my own 3 comes off with the damage)
  function ringDrain(n) {
    const u = {};
    seated(room).filter(o => o.id !== n.fromId && o.id !== pid && !isOut(o)).forEach(o => {
      if (o.prot?.life) { logTo(code, `🛡 ${o.name}'s life can't change (${o.prot.src})`); return; }
      u[`players/${o.id}/life`] = (o.life ?? START_LIFE) - 3;
    });
    if (Object.keys(u).length) update(ref(db, `rooms/${code}`), u);
    logTo(code, `💍 ${n.from}'s Ring-bearer dealt combat damage to ${me.name}: each of ${n.from}'s opponents loses 3 life`);
  }
  function pingBox(r) {
    const k = r.ping;
    const amt = ampDmg(k.n, (r.srcId && me.bf?.[r.srcId]) || lookupCard(r.src), true).n;
    const hexed = o => plShroud(o) || (o.hexFrom?.turnNo === (room.turnNo || 0) && (targetSrcColors || []).some(c => o.hexFrom.colors.includes(COLOR_WORD[c])));
    return `${opponents().map(o => `<button class="btn small primary" ${o.prot?.all || hexed(o) ? "disabled" : ""} title="${hexed(o) ? (o.hexFrom ? `hexproof from ${esc(o.hexFrom.colors.join("/"))}` : "can't be targeted (shroud/hexproof)") : ""}" data-a="ping-go" data-id="${r.id}" data-o="${o.id}" style="border-left:4px solid ${esc(o.color)}">${o.prot?.all ? "🛡 " : "💥 "}${amt} → ${esc(o.name)}</button>`).join("")}
      ${k.playerOnly ? "" : `<button class="btn small" data-a="ping-go" data-id="${r.id}" data-o="">Creature / planeswalker</button>`}${k.left > 1 ? `<span class="mini">${k.left} left</span>` : ""}`;
  }
  // Panoptic Mirror / Isochron Scepter: cast a copy of an imprinted card
  function copyBox(r) {
    const e = me.bf?.[r.copyFrom];
    const list = e?.imprints || (e?.imprint ? [e.imprint] : []);
    if (!list.length) { // the imprint popup was skipped: say which card is under it now
      const opts = (deck?.cards || []).map((c, i) => [c, i]).filter(([c]) => /\b(Instant|Sorcery)\b/.test(c.t || "")).sort((a, b) => dispName(a[0]).localeCompare(dispName(b[0])));
      return opts.length ? `<span class="mini">Nothing imprinted yet. Which card is exiled under it?</span><select class="fetch-pick" id="cpi-${r.id}">${opts.map(([c, i]) => `<option value="${i}">${esc(dispName(c))}</option>`).join("")}</select><button class="btn small" data-a="copy-imprint" data-id="${r.id}">Set imprint</button>`
        : `<span class="mini">Nothing imprinted on it yet.</span>`; }
    return list.map((n, i) => `<button class="btn small primary" data-a="copy-cast" data-id="${r.id}" data-i="${i}">Cast a copy of ${esc(n)}</button>`).join("");
  }
  function counterOptions(f) {
    const players = seated(room).filter(o => !isOut(o) && (o.id === pid || f.filter.controller !== "you"));
    return players.flatMap(o => [
      ...Object.entries(o.bf || {}).filter(([id, e]) => permMatch(e, f.filter) && !cantTarget(e, o.id, id, pid)).map(([id, e]) => ({ v: `${o.id}|bf|${id}`, label: `${o.id === pid ? "" : `${o.name}: `}${dispName(e)}${ptOf(e, countsFor(o), o.id, id) ? ` ${ptOf(e, countsFor(o), o.id, id)}` : ""}` })),
      ...Object.entries(o.tokens || {}).filter(([k, t]) => permMatch(tokenAsPerm(t), f.filter) && !cantTarget(tokenAsPerm(t), o.id, k, pid, true)).map(([k, t]) => ({ v: `${o.id}|tok|${k}`, label: `${o.id === pid ? "" : `${o.name}: `}${t.name} token ${tokenPT(t, tablePT)} (×${t.count})` })),
    ]);
  }
  function swapBox(r) {
    const f = r.swap;
    const theirs = seated(room).filter(o => o.id !== pid && !isOut(o)).flatMap(o => Object.entries(o.bf || {}).filter(([id, e]) => permMatch(e, f.filter) && !cantTarget(e, o.id, id, pid)).map(([id, e]) => ({ v: `${o.id}|${id}`, label: `${o.name}: ${dispName(e)}` })));
    const mine = Object.entries(me.bf || {}).filter(([id, e]) => permMatch(e, f.filter) && id !== r.srcId).map(([id, e]) => ({ v: `${pid}|${id}`, label: dispName(e) }));
    const opt = l => l.map(o => `<option value="${o.v}">${esc(o.label)}</option>`).join("");
    if (f.self) return `${theirs.length ? `<select class="fetch-pick" id="sw-${r.id}">${opt(theirs)}</select><button class="btn small primary" data-a="swap-go" data-id="${r.id}">Exchange</button>` : `<span class="mini">No ${esc(f.what)} to take.</span>`}
      ${f.sacIfNone ? `<button class="btn small" data-a="swap-none" data-id="${r.id}">No exchange → sacrifice it</button>` : ""}`;
    return `<span class="mini">Yours:</span><select class="fetch-pick" id="sa-${r.id}">${opt(mine)}</select><span class="mini">Theirs:</span><select class="fetch-pick" id="sw-${r.id}">${opt(theirs)}</select>
      <button class="btn small primary" data-a="swap-go" data-id="${r.id}" ${mine.length && theirs.length ? "" : "disabled"}>Exchange</button>`;
  }
  function counterPickBox(r) {
    const f = r.counterPick;
    const opts = counterOptions(f);
    if (!opts.length) return `<span class="mini">No ${esc(f.what)} on your board.</span>`;
    return `<select class="fetch-pick" id="cp-${r.id}">${opts.map(o => `<option value="${o.v}">${esc(o.label)}</option>`).join("")}</select>
      <button class="btn small primary" data-a="cp-go" data-id="${r.id}">${f.nFromPower ? `Put counters equal to its power` : `Put ${f.n} ${esc(f.label)}`}${r.counterPick.left > 1 ? ` (${r.counterPick.left} left)` : ""}</button>
      ${f.dist ? `<span class="mini">So far: ${esc(Object.entries(f.dist).map(([v, n]) => `${opts.find(o => o.v === v)?.label.split(" (")[0] || "?"} +${n}`).join(", "))}</span>` : ""}`;
  }
  function prolifBox(r) {
    const rows = [];
    seated(room).filter(o => !isOut(o)).forEach(o => {
      const mine = o.id === pid, who = mine ? "" : `${o.name}: `;
      Object.entries(o.bf || {}).forEach(([id, e]) => { const cs = Object.entries(e.c || {}).filter(([, v]) => v > 0); if (cs.length) rows.push({ v: `${o.id}|bf|${id}`, on: mine, label: `${who}${dispName(e)} (${cs.map(([k, v]) => `${counterLabel(k)} ${v}`).join(", ")})` }); });
      Object.entries(o.tokens || {}).forEach(([k, t]) => { const cs = Object.entries(t.c || {}).filter(([, v]) => v > 0); if (cs.length) rows.push({ v: `${o.id}|tok|${k}`, on: mine, label: `${who}${t.count} ${t.name} token${t.count === 1 ? "" : "s"} (${cs.map(([x, v]) => `${counterLabel(x)} ${v}`).join(", ")})` }); });
      PLAYER_COUNTERS.filter(c => o[c.k] > 0).forEach(c => rows.push({ v: `${o.id}|player|${c.k}`, on: mine ? c.k !== "poison" && c.k !== "rad" : c.k === "poison", label: `${mine ? "You" : o.name}: ${c.label} ${o[c.k]}` }));
    });
    if (!rows.length) return `<span class="mini">Nothing on the table has counters.</span>`;
    return `<div class="modes">${rows.map(x => `<label class="mode-check"><input type="checkbox" class="pf-box" data-rid="${r.id}" value="${esc(x.v)}" ${x.on ? "checked" : ""}><span>${esc(x.label)}</span></label>`).join("")}</div>
      <button class="btn small primary" data-a="pf-go" data-id="${r.id}">Proliferate</button>`;
  }
  // State-based check: creatures at 0 or less toughness (from −1/−1 counters etc.) die
  function checkZeroToughness() {
    if (!me) return;
    const counts = countsFor(me);
    const dead = Object.entries(me.bf || {}).filter(([id, e]) => /\bCreature\b/.test(e.t || "") && !reminders.some(x => x.copyEnt && x.copyEnt.id === id) && /^-?\d+$/.test(ptOf(e, counts, pid, id).split("/")[1] || "") && Number(ptOf(e, counts, pid, id).split("/")[1]) <= 0).map(([id]) => id);
    const deadToks = Object.entries(me.tokens || {}).filter(([k, t]) => { const tg = tokPTfx(t, pid, k).split("/")[1]; return /^-?\d+$/.test(tg || "") && Number(tg) <= 0; }).map(([k]) => k);
    const sig = [...dead, ...deadToks].sort().join(",");
    if (!sig || reminders.some(x => x.sba === sig)) return;
    reminders = reminders.filter(x => !x.sba);
    reminders.push({ id: newId(), src: "Zero toughness", text: `${[...dead.map(id => dispName(me.bf[id])), ...deadToks.map(k => `${me.tokens[k].count} ${me.tokens[k].name}`)].join(", ")} ${dead.length + deadToks.length === 1 ? "has" : "have"} 0 toughness and should die.`, times: 1, sba: sig, sbaIds: dead, sbaToks: deadToks });
    render();
  }
  function gyHateBox(r) {
    const f = r.gyHate, cnt = o => Object.keys(room.players?.[o.id]?.gy || {}).length;
    if (f.who === "target") return seated(room).filter(o => !isOut(o)).map(o => `<button class="btn small primary" data-a="gh-go" data-id="${r.id}" data-o="${o.id}" style="border-left:4px solid ${esc(o.color)}">${esc(o.name)} (🪦 ${cnt(o)})</button>`).join("");
    return `<button class="btn small primary" data-a="gh-go" data-id="${r.id}" data-o="*">${f.who === "opps" ? "Each opponent's graveyard" : "All graveyards"}</button>`;
  }

  // ----- Intuition / Gifts Ungiven / Fact or Fiction: you show cards, an opponent chooses -----
  const opLabel = k => k.from === "top" ? `Reveal the top ${k.n}, then ${k.piles === "opp" ? "an opponent splits them into two piles" : "split them into two piles for an opponent to choose"}`
    : `Search for ${k.upTo ? "up to " : ""}${k.n} card${k.n > 1 ? "s" : ""}${k.distinct ? " with different names" : ""}; an opponent picks ${k.pick} → your ${k.chosenTo}, the rest → your ${k.restTo}`;
  function oppPickBox(r) {
    const k = r.oppPick;
    if (k.waiting) return `<span class="mini">⏳ Waiting for ${esc(room.players?.[k.waiting]?.name || "them")} to choose…</span>`;
    if (k.pilesToChoose) return k.pilesToChoose.map((pile, i) => `<button class="btn small primary" data-a="op-take" data-id="${r.id}" data-i="${i}">Take pile ${i + 1}: ${esc(pile.join(", ") || "(empty)")}</button>`).join("");
    const used = new Set(k.cards.map(c => c.n));
    const pool = (deck?.cards || []).map((c, i) => [c, i]).filter(([c]) => !(k.distinct && used.has(c.n))).sort((a, b) => a[0].n.localeCompare(b[0].n));
    const full = k.cards.length >= k.n;
    return `<div class="ans-list">${k.cards.map((c, j) => `<span class="pill">${k.piles === "you" ? `<label><input type="checkbox" class="op-pile" data-rid="${r.id}" value="${j}"> ` : ""}${esc(c.n)}${k.piles === "you" ? "</label>" : ""} <button class="linkish" data-a="op-del" data-id="${r.id}" data-j="${j}">✕</button></span>`).join("")}</div>
      ${full ? "" : `<select class="fetch-pick" id="op-${r.id}">${pool.map(([c, i]) => `<option value="${i}">${esc(dispName(c))}</option>`).join("")}</select>
        <button class="btn small" data-a="op-add" data-id="${r.id}">Add (${k.cards.length}/${k.n})</button>`}
      ${k.piles === "you" && full ? `<div class="mini">Tick the cards in pile 1; the rest are pile 2.</div>` : ""}
      ${full || (k.upTo && k.cards.length) ? opponents().map(o => `<button class="btn small primary" data-a="op-send" data-id="${r.id}" data-o="${o.id}" style="border-left:4px solid ${esc(o.color)}">Show ${esc(o.name)}</button>`).join("") : ""}`;
  }
  function resolveOppPick(r, rep) {
    const k = r.oppPick, names = k.cards.map(c => c.n), who = rep.name || "They";
    if (k.piles === "opp") { // they split; you choose a pile
      const p1 = rep.picks || [], p2 = [...names]; p1.forEach(n => p2.splice(p2.indexOf(n), 1));
      k.waiting = null; k.pilesToChoose = [p1, p2];
      logTo(code, `${r.src}: ${who} split the cards: [${p1.join(", ") || "—"}] / [${p2.join(", ") || "—"}]`);
      render(); return;
    }
    const chosen = rep.picks || [], rest = [...names]; chosen.forEach(n => rest.splice(rest.indexOf(n), 1));
    const to = k.piles ? "hand" : k.chosenTo, restTo = k.piles ? "graveyard" : k.restTo;
    reminders = reminders.filter(x => x.id !== r.id);
    logTo(code, `🔎 ${r.src}: ${who} chose ${chosen.join(", ") || "nothing"} → ${me.name}'s ${to}${rest.length ? `; ${rest.join(", ")} → ${restTo}` : ""}`);
    const toGy = [...(to === "graveyard" ? chosen : []), ...(restTo === "graveyard" ? rest : [])];
    if (toGy.length) act([], p => toGy.forEach(n => toZone(p, deckCard(n) || { n }, "gy")));
    toast(`${chosen.join(", ")} → your ${to}`);
    if (k.from === "search") reminders.push({ id: newId(), src: r.src, text: "🔀 Shuffle your library.", times: 1 });
    render();
  }

  // ----- Counterspells -----
  // Each spell's resolution is remembered as a before/after snapshot, so a counter can reverse exactly what that spell did
  // (later triggers, draws and life changes are left alone).
  const steps = {}, stepKeys = [];
  let activeCast = null; // set while you act on a spell's own prompt (choose a mode, search…), so that counts as the spell too
  function newStep(key) {
    if (!steps[key]) { stepKeys.push(key); if (stepKeys.length > 40) delete steps[stepKeys.shift()]; steps[key] = { segs: [], rems: [] }; }
    return steps[key];
  }
  function recordStep(key, before) {
    newStep(key).segs.push({ before, after: clone(me), loss: null });
  }
  const remSnap = () => new Set(reminders.map(r => r.id));
  function endStep(key, snap, info) {
    const st = newStep(key);
    Object.assign(st, info);
    reminders.forEach(r => { if (!snap.has(r.id)) { r.castKey = key; if (!st.rems.includes(r.id)) st.rems.push(r.id); } });
  }
  const isObj = v => v && typeof v === "object" && !Array.isArray(v);
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  // Move cur from "from" toward "to" only where this spell changed things; numbers move by the difference
  function patchState(cur, from, to, depth = 0) {
    let conflicts = 0;
    new Set([...Object.keys(from || {}), ...Object.keys(to || {})]).forEach(k => {
      const f = from?.[k], t = to?.[k];
      if (same(f, t)) return;
      // top-level containers (bf, tokens, tax, delayed…): a missing one is just empty, so only this spell's entries move
      if (depth === 0 && (isObj(f) || isObj(t)) && (f === undefined || isObj(f)) && (t === undefined || isObj(t))) {
        if (!isObj(cur[k])) { if (cur[k] !== undefined) { conflicts++; return; } cur[k] = {}; }
        conflicts += patchState(cur[k], f || {}, t || {}, 1);
        if (!Object.keys(cur[k]).length) delete cur[k];
        return;
      }
      const c = cur[k];
      if (isObj(f) && isObj(t) && isObj(c)) { conflicts += patchState(c, f, t, depth + 1); return; }
      if (typeof f === "number" && typeof t === "number" && typeof c === "number") { cur[k] = c + (t - f); return; }
      if (t === undefined) { // the change added it: take it away (a token pile only loses what was added)
        if (isObj(f) && isObj(c) && typeof f.count === "number" && typeof c.count === "number") c.count -= f.count;
        else if (typeof f === "number" && typeof c === "number") { cur[k] = c - f; if (!cur[k]) delete cur[k]; }
        else delete cur[k];
        return;
      }
      if (f === undefined) { // the change removed it: put it back
        if (c === undefined) cur[k] = clone(t);
        else if (isObj(t) && isObj(c) && typeof t.count === "number" && typeof c.count === "number") c.count += t.count;
        else conflicts++;
        return;
      }
      if (same(c, f)) cur[k] = clone(t); else conflicts++;
    });
    return conflicts;
  }
  function tidyTokens(p) {
    Object.entries(p.tokens || {}).forEach(([k, t]) => {
      if (!(t.count > 0)) delete p.tokens[k];
      else if (t.tapped > t.count) t.tapped = t.count;
    });
  }
  function shiftOppLife(loss, sign) {
    if (!loss) return;
    const u = {};
    Object.entries(loss).forEach(([oid, n]) => { u[`players/${oid}/life`] = (room.players?.[oid]?.life ?? START_LIFE) + sign * n; });
    update(ref(db, `rooms/${code}`), u);
  }
  function revertCast(key, ctr) {
    const st = steps[key];
    if (!st || st.reverted) return;
    st.reverted = true;
    const gone = reminders.filter(r => st.rems.includes(r.id));
    const used = st.rems.length - gone.length;
    gone.forEach(r => clearWindow(r));
    reminders = reminders.filter(r => !st.rems.includes(r.id));
    st.removedRems = gone;
    let conflicts = 0;
    mutate(p => { [...st.segs].reverse().forEach(g => { conflicts += patchState(p, g.after, g.before); }); tidyTokens(p); if (st.perm && st.card && !st.cmd) st.gyId = toZone(p, st.card, "gy"); });
    st.segs.forEach(g => shiftOppLife(g.loss, +1));
    { const xt = room.extraTurn, list = xt ? [{ ...xt, queue: undefined }, ...(xt.queue || [])] : [];
      const i = list.findIndex(x => !x.taken && x.pid === pid && x.src === st.name);
      if (i >= 0) { st.xtDropped = list[i]; const rest = list.filter((_, j) => j !== i); update(ref(db, `rooms/${code}`), { extraTurn: rest.length ? { ...rest[0], queue: rest.slice(1) } : null }); logTo(code, `⏭ ${st.name} didn't resolve: no extra turn from it`); } }
    logTo(code, `🚫 ${me.name}'s ${st.name} was ${ctr.bounced ? "returned to their hand" : "countered"} by ${ctr.byName}'s ${ctr.src}`);
    if (used || conflicts) reminders.push({ id: newId(), src: st.name, text: "Countered after you'd already acted on it.", times: 1,
      note: conflicts ? "Most of it was reversed, but some of it was changed again since. Check the board." : "The board was reversed. Put back any real cards it moved (searched, drew), and undo anything it did to other players by hand." });
    if (st.cmd) reminders.push({ id: newId(), src: st.name, text: "Your commander was countered. Move it to the command zone (or graveyard). Its tax still counts.", times: 1 });
    if (st.counters) update(ref(db, `rooms/${code}/casts/${st.counters}`), { countered: null }); // my counterspell was countered, so its target comes back
    render();
  }
  function reapplyCast(key) {
    const st = steps[key];
    if (!st || !st.reverted) return;
    st.reverted = false;
    mutate(p => { st.segs.forEach(g => patchState(p, g.before, g.after)); tidyTokens(p); if (st.gyId) { delete p.gy?.[st.gyId]; st.gyId = null; } });
    st.segs.forEach(g => shiftOppLife(g.loss, -1));
    reminders.push(...(st.removedRems || []));
    st.removedRems = null;
    if (st.xtDropped) { const nx = st.xtDropped; st.xtDropped = null; update(ref(db, `rooms/${code}`), { extraTurn: room.extraTurn ? { ...room.extraTurn, queue: [...(room.extraTurn.queue || []), nx] } : nx }); }
    logTo(code, `↩ ${me.name}'s ${st.name} resolves after all (its counterspell was countered)`);
    if (st.counters && st.counterInfo) update(ref(db, `rooms/${code}/casts/${st.counters}`), { countered: { ...st.counterInfo, at: Date.now() } });
    render();
  }
  // Spells this phone could counter right now (other players' spells this turn that haven't been countered)
  // "Spells and abilities can't be countered" (Spider-Punk) / "Spells you control can't be countered"
  function uncounterable() {
    const out = { all: null, by: {} };
    seated(room || {}).filter(o => !isOut(o)).forEach(o => Object.values(o.bf || {}).forEach(e => boardRules(e.o).forEach(r => {
      if (r.kind !== "noCounter") return;
      if (r.who === "all") out.all = dispName(e); else out.by[o.id] = dispName(e);
    })));
    return out;
  }
  function counterable() {
    const nc = uncounterable();
    if (nc.all) return [];
    return Object.entries(room?.casts || {}).filter(([, c]) => c.by !== pid && !c.countered && !nc.by[c.by] && (c.turnNo || 0) === (room.turnNo || 0))
      .sort((a, b) => b[1].at - a[1].at);
  }
  const castLabel = c => `${room.players?.[c.by]?.name || "?"}'s ${c.nick || c.n}${c.nc ? ` (can't be countered${typeof c.nc === "string" ? `: ${c.nc}` : ""})` : ""}`;
  // Send the counter to the spell's caster (their phone reverses it, or asks them to pay)
  let lastX = null; let etbX = null;
  function sendCounter(myKey, targetKey, src, info) {
    const tc = room.casts?.[targetKey];
    if (!tc) return;
    const ctr = { by: pid, byName: me.name, src, unless: info?.unless || null, at: Date.now(), ...(info?.tok ? { tok: info.tok } : {}) };
    update(ref(db, `rooms/${code}/casts/${targetKey}`), { countered: ctr });
    logTo(code, `✋ ${me.name} cast ${src} targeting ${castLabel(tc)}${info?.unless ? ` (unless they pay ${info.unless})` : ""}`);
    if (myKey && steps[myKey]) { steps[myKey].counters = targetKey; steps[myKey].counterInfo = ctr; }
    if (tc.by && tc.by !== pid) commitCrime("counter");
    if (info?.drain) { const mv = manaValue(tc.m || ""); if (mv > 0) reminders.push({ id: newId(), src, text: `At the beginning of your next main phase, add {C}×${mv} (${castLabel(tc)}'s mana value).`, times: 1, mana: { syms: "{C}", n: mv }, note: "Tap when your next main phase starts" }); }
    if (info?.tok && tc.by) { const t = info.tok; sendNote(tc.by, { text: `${src} countered your spell: create ${t.n === 1 ? "a" : t.n} ${t.desc} token${t.n === 1 ? "" : "s"}.`, token: t.name, count: t.n, desc: t.desc, src }); logTo(code, `${src}: ${tc.byName || "its controller"} gets ${t.n} ${t.name} token${t.n === 1 ? "" : "s"}`); }
  }
  // My deck's cards that answer things at instant speed
  function deckAnswers() {
    return (deck?.cards || []).map((c, i) => ({ c, i, kind: answerKind(c) })).filter(x => x.kind);
  }
  function showCounter(sel) {
    const list = counterable();
    if (!list.length) { toast("No spells to counter right now."); modal.hidden = true; return; }
    sel = list.find(([k]) => k === sel) ? sel : list[0][0];
    const target = room.casts[sel];
    const mine = deckAnswers().filter(x => x.kind === "counter" && counterOf(x.c)?.spell);
    modal.innerHTML = `<div class="modal-inner">
      <h3>✋ Counter a spell</h3>
      <select class="fetch-pick" id="ctrTarget">${list.map(([k, c]) => `<option value="${k}" ${k === sel ? "selected" : ""}>${esc(castLabel(c))}</option>`).join("")}</select>
      ${target.nc ? `<p class="mini">⛔ This spell can't be countered${typeof target.nc === "string" ? ` (cast with ${esc(target.nc)} mana)` : ""}. Your counterspell would do nothing to it.</p>` : ""}
      <p class="mini">Which counterspell did you cast?</p>
      <div class="ans-list">${mine.length ? mine.map(({ c, i }) => {
        const ok = counterMatches(counterOf(c), target) && !target.nc;
        return `<button class="btn small ${ok ? "primary" : ""}" data-a="ctr-cast" data-i="${i}" data-k="${sel}" ${ok ? "" : "disabled"}>${esc(dispName(c))} ${costHtml(c)}${ok ? "" : target.nc ? " · can't be countered" : " · can't target that"}</button>`;
      }).join("") : `<span class="mini">No counterspells in your deck list.</span>`}
      <button class="btn small" data-a="ctr-other" data-k="${sel}">Something not in my deck list</button></div>
      <button class="btn wide" data-a="close-modal">Cancel</button></div>`;
    modal.hidden = false;
    $("ctrTarget").onchange = e => showCounter(e.target.value);
  }
  function answersHtml(pend) {
    const cast = pend.castKey ? room.casts?.[pend.castKey] : null;
    const list = deckAnswers().filter(x => x.kind !== "counter" || (cast && counterMatches(counterOf(x.c), cast)) || counterOf(x.c)?.ability);
    if (!list.length) return "";
    const icon = { counter: "🚫", protect: "🛡", remove: "💥" };
    return `<div class="mini">Possible answers in your deck (tap the one you cast):</div><div class="ans-list">${list.map(({ c, i, kind }) =>
      `<button class="btn small" data-a="ans-play" data-i="${i}" data-kind="${kind}">${icon[kind]} ${esc(dispName(c))} ${costHtml(c)}</button>`).join("")}</div>`;
  }
  function playCard(card, opts = {}) {
    const fz = opts.fromZone;
    if (fz) mutate(p => { delete p[fz.z]?.[fz.id]; });
    const giftM = !opts.via && (card.o || "").match(/^Gift (an? [^(\n]+?)\s*(?:\(|$)/m);
    if (giftM && opponents().length) {
      const bonus = (card.o.match(/if the gift was promised,[^\n]*/i) || [])[0] || "";
      reminders.push({ id: newId(), src: dispName(card), text: `Promise a gift (${giftM[1]})?`, times: 1, gift: giftM[1], bonus });
    }
    if (!opts.via && deck?.cmds?.includes(card.n)) {
      if (Object.values(me.bf || {}).some(e => e.n === card.n)) { toast(`${card.n} is already on the battlefield.`); return; }
      castCommander(card.n);
      return;
    }
    const land = /\bLand\b/.test(card.t || "");
    const castsBefore = Object.values(room.casts || {}).filter(c => (c.turnNo || 0) === (room.turnNo || 0)).length; // for Storm
    if (!land && !opts.via && !opts.copy && (/^Convoke\b/m.test(card.o || "") || (/\bArtifact\b/.test(card.t || "") && Object.values(me.bf || {}).some(x => /artifact spells you cast have convoke/i.test(x.o || lookupCard(x.n)?.o || ""))))) reminders.push({ id: newId(), src: dispName(card), text: "Convoke: tap creatures to help pay (each pays {1} or one mana of its color).", times: 1, convoke: true });
    const castKey = !land && !opts.via && (!opts.copy || opts.castCopy) ? broadcastCast(card) : null; // a copy that isn't cast (Narset's Reversal, Twincast) isn't a cast: no storm count
    if (castKey && !opts.copy) {
      const t = room?.turnNo || 0, spent = opts.free ? 0 : manaValue(costOf(card)), prev = me.spentT?.t === t ? me.spentT.n || 0 : 0;
      if (spent > 0) { mutate(p => { p.spentT = { t, n: prev + spent }; }, true); if (Object.values(me.bf || {}).some(x => /whenever you expend \d+/i.test(x.o || lookupCard(x.n)?.o || ""))) setTimeout(() => act([{ type: "expend", prev, n: prev + spent }]), 0); }
      if (fz?.z === "ex") Object.values(me.bf || {}).forEach(x => { const m = String(x.o || lookupCard(x.n)?.o || "").match(/whenever you (?:play a land from exile or )?cast a spell from exile, you gain (\d+) life/i); if (m) setTimeout(() => act([{ type: "effects", effs: [{ k: "gain", n: Number(m[1]) }], times: 1, count: 1, src: dispName(x) }]), 0); });
    }
    if (castKey && !opts.copy && !opts.free) payForCast(card, opts.altCost && /^\{/.test(opts.altCost) ? opts.altCost : costOf(card)); // warp / dash / blitz / bestow pay their own cost
    if (castKey && castHaste) { opts = { ...opts, haste: castHaste }; castHaste = null; }
    if (castKey && !opts.copy && !/\bCreature\b/.test(card.t || "")) setTimeout(() => eqCounterTrigger("noncreature spell"), 0);
    if (castKey && !opts.copy) { const ext = Object.values(me.bf || {}).filter(e => /^Extort\b/m.test(e.o || lookupCard(e.n)?.o || "")); if (ext.length) { reminders.push({ id: newId(), src: ext.length > 1 ? `Extort ×${ext.length}` : `${dispName(ext[0])} (extort)`, text: `You may pay {W/B}${ext.length > 1 ? ` up to ${ext.length} times` : ""}. Each time: each opponent loses 1 life and you gain that much.`, times: 1, extort: ext.length }); setTimeout(render, 0); } }
    if (isSpell(card)) {
      logTo(code, `${me.name} cast ${dispName(card)}`); toast(`Cast ${dispName(card)}`);
      // costs and cast triggers stay even if the spell is countered
      if (card.o && !opts.copy) addlCosts(card);
      const altDraw = (card.o || "").match(/you may pay ((?:\{[^}]+\})+) rather than pay this spell's mana cost[^]*?if the \1 cost was paid, an opponent draws a card/i);
      if (altDraw && !opts.copy) reminders.push({ id: newId(), src: dispName(card), text: `Did you pay ${altDraw[1]} instead? Then an opponent draws a card.`, times: 1, altDraw: true });
      if ((!opts.copy || opts.castCopy) && castKey) prowess(card);
      const sac = card.o && addlSacOf(card);
      if (sac) reminders.push({ id: newId(), src: dispName(card), text: `Sacrifice ${sac.n > 1 ? sac.n : /^[aeiou]/i.test(sac.what) ? "an" : "a"} ${sac.what} (additional cost).`, times: 1,
        edictLocal: { kind: "edict", text: "", src: dispName(card), n: sac.n, filter: sac.filter } });
      const selfExile = new RegExp(`(^|\\. )exile (this spell|${card.n.split(" // ")[0].replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})\\.?$`, "im").test(card.o || "");
      const buyback = !opts.copy && !fz && ((card.o || "").match(/^Buyback ((?:\{[^}]+\})+)/m) || [])[1];
      const bought = buyback && confirm(`Did you pay buyback ${buyback} for ${dispName(card)}? (OK = it returns to your hand)`);
      if (bought) logTo(code, `${me.name} paid buyback ${buyback}: ${dispName(card)} returns to hand`);
      act(opts.copy && !opts.castCopy ? (/\b(Instant|Sorcery)\b/.test(card.t || "") ? [{ type: "cast", card, copied: true }] : []) : [{ type: "cast", card, prior: myPriorCasts(castKey), ...(fz ? { fromZone: fz.z || true } : {}), ...(opts.free || opts.castCopy ? { free: true } : {}) }], p => { if (opts.copy || bought) return; if (!opts.exileAfter && !selfExile && new RegExp(`shuffle (?:this card|${card.n.split(" // ")[0].replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}) into its owner's library`, "i").test(card.o || "")) return; const reb = !fz && !opts.exileAfter && /^Rebound\b/m.test(card.o || ""), adv = card.face === 1 && card.layout === "adventure" && !opts.copy; toZone(p, { ...card, ...(adv ? { o: (deckCard(card.n) || card).o, t: (deckCard(card.n) || card).t, fname: undefined, face: undefined } : {}), ...(opts.own ? { own: opts.own } : {}) }, opts.exileAfter || selfExile || reb || adv ? "ex" : "gy", reb ? { rebound: room?.turnNo || 0 } : adv ? { play: { any: true }, src: "adventure" } : undefined); }, null, { merge: !!fz }); // it ends up there even if countered
      // everything below is the spell resolving
      const snap = remSnap();
      const pc = card.o && pactOf(card);
      const le = card.o && loseEffect(card.o);
      { const nx = String(card.o || "").split(" // ")[0].match(/^the next time a source of your choice would deal damage to you this turn, [^\n]+/im); if (nx) reminders.push({ id: newId(), src: dispName(card), text: nx[0].replace(/^\w/, c => c.toUpperCase()), times: 1 }); }
      { const ue = String(card.o || "").split(" // ")[0].match(/^put an? ([+-]1\/[+-]1|\w+) counters? on each of up to (\w+) target creatures?[^.]*\./im); if (ue) reminders.push({ id: newId(), src: dispName(card), text: ue[0], times: 1 }); }
      { const mo = String(card.o || "").match(/^whenever one or more creatures you control deal combat damage to one or more players this turn, you become the monarch\.?$/im); if (mo) reminders.push({ id: newId(), src: dispName(card), text: "If your creatures deal combat damage to a player this turn: you become the monarch.", times: 1, becomeMon: true }); }
      { const bb = String(card.o || "").match(/each player loses 1 life for each attacking creature they control if \{B\} was spent to cast this spell/i); if (bb) reminders.push({ id: newId(), src: dispName(card), text: "If {B} was spent: each player loses 1 life for each attacking creature they control.", times: 1 }); }
      if (le) reminders.push({ id: newId(), src: dispName(card), text: le === "target" ? "Target player loses the game." : "You lose the game.", times: 1, loseFx: le, effs: le === "target" ? [{ k: "tloseGame" }] : [] });
      const wr = card.o && winRule(card);
      if (wr && wr.when === "cast") setTimeout(() => checkWin(card, null, wr), 0);
      let sp = card.o ? spellAbility(card) : { effs: [] };
      if (/players can't lose life this turn/i.test(card.o || "")) { update(ref(db, `rooms/${code}`), { noLoss: { turnNo: room.turnNo || 0, src: dispName(card), by: me.name, game: /can't lose the game or win the game this turn/i.test(card.o), hexproof: /players gain hexproof/i.test(card.o) } }); logTo(code, `🛡 ${me.name}'s ${dispName(card)}: players can't lose life${/can't lose the game/i.test(card.o) ? " or lose/win the game" : ""} this turn${/players gain hexproof/i.test(card.o) ? " · players have hexproof" : ""}`); }
      if (/each player discards their hand, then draws cards equal to the greatest number of cards a player discarded this way/i.test(card.o || "") && !opts.copy) {
        const v = prompt(`${dispName(card)}: the biggest hand at the table had how many cards? (everyone discards, then draws that many)`, "7");
        const n = Math.max(0, Math.floor(Number(v) || 0));
        seated(room).filter(o => !isOut(o) && o.id !== pid).forEach(o => sendNote(o.id, { text: `${me.name}'s ${dispName(card)}: discard your hand, then draw ${n} card${n === 1 ? "" : "s"}.`, src: dispName(card), drawN: n }));
        if (n) reminders.push({ id: newId(), src: dispName(card), text: `Discard your hand, then draw ${n} card${n === 1 ? "" : "s"} (everyone does).`, times: 1, drawN: n });
        logTo(code, `🌀 ${me.name}'s ${dispName(card)}: everyone discards their hand and draws ${n}`);
      }
      if (/create a token that's a copy of target artifact or creature you control, except it's an artifact in addition to its other types\. it gains haste until end of turn\. sacrifice it at the beginning of the next end step/i.test(card.o || "")) reminders.push({ id: newId(), src: dispName(card), text: "Copy which artifact or creature you control?", times: 1, dupPick: true });
      if (/destroy all creatures\. you gain 1 life for each creature destroyed this way/i.test(card.o || "")) { const n = seated(room).filter(o => !isOut(o)).reduce((a, o) => a + Object.values(o.bf || {}).filter(x => /\bCreature\b/.test(x.t || "")).length + Object.values(o.tokens || {}).filter(t => isCreatureToken(t.name)).reduce((s, t) => s + (t.count || 0), 0), 0);
        reminders.push({ id: newId(), src: dispName(card), text: `Gain 1 life for each creature destroyed (${n} on the battlefield now; fewer if some survive).`, times: 1 }); }
      const chancy = /\bflips? (?:a coin|\w+ coins)\b|\bsecretly (?:chooses?|votes?)\b|\bchooses? (?:fame or fortune|silence or snitch)\b/i.test(String(card.o || "").split(" // ")[0]);
      const xtIf = /(?:^|\.\s+)if [^.]*?, (?:you )?take an extra turn after this one/im.test(String(card.o || "")) && !/\bif you do\b/i.test((String(card.o || "").match(/[^.]*take an extra turn after this one/i) || [""])[0]);
      if (xtIf && !opts.copy) reminders.push({ id: newId(), src: dispName(card), text: String(card.o).split(" // ")[0].replace(/\([^)]*\)/g, "").split("\n").filter(l => !/^(prowl|kicker|flashback|buyback|bargain|convoke|delve|devoid)\b/i.test(l.trim())).join(" ").replace(/\s+/g, " ").trim(), times: 1 });
      // "Take an extra turn after this one" / Time Warp's "Target player takes …" (the caster, nearly always). A copy (Narset's Reversal, Isochron Scepter) gives a turn too
      if (/(?:^|[.:—•]\s*|\n)(?:take|target player takes) an extra turn after this one/i.test(card.o || "") && !chancy && !xtIf) {
        const lose = /at the beginning of that turn's end step, you lose the game/i.test(card.o || "");
        const nx = { pid, name: me.name, src: dispName(card), lose, taken: false };
        update(ref(db, `rooms/${code}`), { extraTurn: room.extraTurn ? { ...room.extraTurn, queue: [...(room.extraTurn.queue || []), nx] } : nx });
        logTo(code, `⏭ ${me.name}'s ${dispName(card)}${opts.copy ? " (copy)" : ""}: ${me.name} takes an extra turn after this one${/target player takes/i.test(card.o || "") ? " (target: themself; if they targeted someone else, fix the turn order by hand)" : ""}${lose ? " (and loses the game at that turn's end step)" : ""}`);
      }
      { const rf = (card.o || "").match(/^add ((?:\{[WUBRGC]\})+), then add (\{[WUBRGC]\}) for each card named ([^.]+?) in each graveyard\.?$/im);
        if (rf) { const k = Math.max(0, seated(room).reduce((a, o) => a + Object.values(o.gy || {}).filter(g => g.n === rf[3]).length, 0) - (opts.copy || card.n !== rf[3] ? 0 : 1)); poolAdd(rf[1] + rf[2].repeat(k), dispName(card)); logTo(code, `${me.name}'s ${dispName(card)}: ${rf[1]}${rf[2].repeat(k)} (${k} in graveyards)`); } }
      if (/choose 1, 2, or 3 at random/i.test(card.o || "")) reminders.push({ id: newId(), src: dispName(card), text: "Roll a d3 (choose 1, 2, or 3 at random): the countered spell's controller mills that many, then exiles cards from the top until a nonland card; they may cast it free.", times: 1 });
      if (!/you lose life equal to that spell's mana value/i.test(card.o || "") && /change the target of target spell with a single target|you may choose new targets for target spell or ability/i.test(card.o || "")) reminders.push({ id: newId(), src: dispName(card), text: "Which spell gets a new target?", times: 1, retarget: true });
      if (/tokens you control gain indestructible until your next turn/i.test(card.o || "")) { markTokInd(dispName(card)); logTo(code, `🛡 ${me.name}'s ${dispName(card)}: their tokens are indestructible until their next turn`); }
      if (/each player secretly chooses a number 0 or greater/i.test(card.o || "") && !opts.copy) reminders.push({ id: newId(), src: dispName(card), text: "Wheel of Misfortune: everyone secretly picks a number. Highest takes that much damage; everyone but the lowest discards their hand and draws seven.", times: 1, wom: { mine: null, ans: {} } });
      if (/change the target of target spell with a single target\. you lose life equal to that spell's mana value/i.test(card.o || "")) reminders.push({ id: newId(), src: dispName(card), text: "Change the target of target spell. You lose life equal to its mana value:", times: 1, impLoss: true });
      if (/choose a card name\. exile the top six cards of your library, then reveal cards from the top of your library until you reveal a card with the chosen name/i.test(card.o || "") || /exile the top card of your library\. you may put that card into your hand unless it has the same name as another card exiled this way/i.test(card.o || ""))
        reminders.push({ id: newId(), src: dispName(card), text: "Resolve it with your library. If it exiled your whole library, Thassa's Oracle's \"Library is empty\" button wins on resolution; log any cards you keep with 🂠 Drew.", times: 1, consult: /choose a card name/i.test(card.o || "") ? "dc" : "tp" });
      if (/target instant or sorcery card in your graveyard gains flashback until end of turn/i.test(card.o || "")) reminders.push({ id: newId(), src: dispName(card), text: "Which instant or sorcery in your graveyard gains flashback this turn?", times: 1, fbGrant: true });
      if (/^target player can't cast spells this turn\./im.test(card.o || "")) {
        const kick = /if this spell was kicked, creatures can't attack this turn/i.test(card.o || "") && !opts.copy && confirm(`Was ${dispName(card)} kicked?`);
        reminders.push({ id: newId(), src: dispName(card), text: `Target player can't cast spells this turn.${kick ? " Kicked: creatures can't attack this turn." : ""}`, times: 1, silenceAsk: true });
        if (kick) logTo(code, `🚫 ${me.name}'s ${dispName(card)} (kicked): creatures can't attack this turn`);
      }
      if (/^your opponents can't cast spells this turn\.?$/im.test(card.o || "")) { update(ref(db, `rooms/${code}`), { silence: { turnNo: room.turnNo || 0, src: dispName(card), by: pid, byName: me.name } }); logTo(code, `🤐 ${me.name}'s ${dispName(card)}: opponents can't cast spells this turn`); }
      // Storm: copy it for each spell cast before it this turn (anyone's)
      const hasSt = card.o && (hasStorm(card) || (/\b(Instant|Sorcery)\b/.test(card.t || "") && Object.values(me.bf || {}).some(x => /instant and sorcery spells you cast have storm/i.test(x.o || lookupCard(x.n)?.o || "")))) && castKey;
      // the app only knows about spells logged in it, so let the player confirm the count
      const stormN = hasSt ? Math.max(0, Math.floor(Number(opts.storm ?? prompt(`${dispName(card)} — Storm: how many spells were cast before it this turn (by anyone)?\n\nThe app counted ${castsBefore}${castsBefore ? "" : " (spells you didn't log aren't counted)"}.`, String(castsBefore))) || 0)) : 0;
      if (stormN) logTo(code, `⛈ ${me.name}'s ${dispName(card)}: storm ${stormN} → ${stormN} cop${stormN === 1 ? "y" : "ies"}`);
      if (stormN && /\b(Instant|Sorcery)\b/.test(card.t || "") && Object.values(me.bf || {}).some(x => /whenever you cast or copy an instant or sorcery spell/i.test(x.o || lookupCard(x.n)?.o || ""))) act(Array.from({ length: Math.min(stormN, 60) }, () => ({ type: "cast", card, copied: true }))); // magecraft sees each storm copy
      if (/for each card exiled this way, copy it, and you may cast the copy without paying its mana cost/i.test(card.o || "") && !opts.copy) {
        reminders.push({ id: newId(), src: dispName(card), text: "Exile instant and sorcery cards from your graveyard and cast copies of them for free: one (normal), or every one (overloaded).", times: 1, mizzix: true });
        setTimeout(() => { reminders = reminders.filter(x => !(x.src === dispName(card) && !x.mizzix && /^Exile target card that's an instant or sorcery/i.test(x.text || ""))); render(); }, 0);
      }
      const airEff = sp.effs?.find(f => f.k === "airbend");
      if (airEff) reminders.push({ id: newId(), src: dispName(card), text: "", times: 1, effs: [airEff],
        air: { ...airEff, lock: airEff.lock || /opponents can't cast spells from anywhere other than their hands/i.test(card.o || "") } });
      if (sp.modes?.length) reminders.push({ id: newId(), src: dispName(card), text: "", times: 1, modes: sp.modes, pick: sp.pick, ...(sp.repeat ? { repeat: true, reps: {} } : {}), ...(sp.note ? { note: sp.note } : {}) });
      const opk = card.o && oppPickOf(card);
      if (opk) reminders.push({ id: newId(), src: dispName(card), text: "", times: 1, oppPick: { ...opk, cards: [] } });
      const ctr = card.o && counterOf(card);
      if (ctr?.spell && !opts.counters) reminders.push({ id: newId(), src: dispName(card), text: "Counter which spell?", times: 1, counterAsk: ctr });
      const ovl = card.o && overloadOf(card);
      if (/^prevent all combat damage that would be dealt this turn\.?$/im.test(card.o || "")) update(ref(db, `rooms/${code}/fog`), { turnNo: room.turnNo || 0, src: dispName(card), by: me.name, except: null });
      { const fx = (card.o || "").match(/prevent all combat damage that would be dealt this turn by non-([a-z]+) creatures/i); if (fx) update(ref(db, `rooms/${code}/fog`), { turnNo: room.turnNo || 0, src: dispName(card), by: me.name, except: fx[1] }); }
      if (/^prevent all combat damage that would be dealt by creatures other than target creature this turn/im.test(card.o || "")) reminders.push({ id: newId(), src: dispName(card), text: "Which creature still deals combat damage?", times: 1, fogPick: true });
      if (/^prevent all damage that would be dealt this turn by creatures your opponents control\.?$/im.test(card.o || "")) { update(ref(db, `rooms/${code}/fog`), { turnNo: room.turnNo || 0, src: dispName(card), by: me.name, except: null, oppsOf: pid }); logTo(code, `🛡 ${me.name}'s ${dispName(card)}: damage from ${me.name}'s opponents' creatures is prevented this turn`); }
      if (/prevent all combat damage that would be dealt this turn/i.test(card.o || "")) { const pm = card.o.match(/prevent all combat damage that would be dealt this turn[^.]*\./i)[0]; reminders.push({ id: newId(), src: dispName(card), text: pm, times: 1 }); logTo(code, `🛡 ${me.name}'s ${dispName(card)}: ${pm}`); }
      if (chancy && sp.effs?.length) sp = { ...sp, effs: [], auto: false };
      let effs = sp.auto ? sp.effs : sp.effs.filter(f => (f.k === "tok" && (f.n?.attacking || f.lead)) || ["fetch", "remove", "adnaus", "setlife", "edict", "imprint", "regrow", "impulse", "handmana", "gyhate", "countersTarget", "countersEach", "tokCopy", "tplayerTok", "untapAll", "untapN", "ping", "pumpTarget", "pumpAll", "controlTurn", "swap", "prolif", "tempt", "oracle", "drawPer", "regen", "copyAllTokens", "tgain", "gyOne", "sacThen", "drawFor", "gainPer", "mill", "copyCreature", "suspect", "manaAny", "dmgTurn", "noPreventTurn", "dmgCr", "wisecrack", "bane", "radiant", "extraCombat", "untapAttacked", "rummage", "dmgAll", "discardN", "copySpell", "dmgPer", "doublePow", "dmgDef", "pcounter", "earthbend", "dieGain", "tokAtkMe", "veil", "plumb", "minusX", "bounceOwn", "drainX", "necroSel", "spoil", "tloseX", "clearCtrs", "drainDevo", "oppLoseThat", "victimize", "prepSelf", "oppsTok", "revealMv", "attachSelf", "untapSelf", "arcum", "addType", "copyNext", "animate", "copyPick", "maze", "eachDraw", "wheelGy", "blink", "copyTrig", "transformSelf", "reenterFace", "exileRetMine"].includes(f.k));
      if (/where x is the number of creatures that died this turn/i.test(card.o || "")) {
        const t = room.turnNo || 0, x = seated(room).reduce((a, o) => a + (o.deaths?.t === t ? o.deaths.n || 0 : 0), 0);
        sp.effs.filter(f => f.k === "tok" && /\bX\/X\b/.test(f.desc || "")).forEach(f => { act([{ type: "create", name: f.name, n: f.n || 1, desc: f.desc.replace(/\bX\/X\b/, `${x}/${x}`), src: dispName(card) }]); logTo(code, `${dispName(card)}: ${x} creature${x === 1 ? "" : "s"} died this turn → ${x}/${x} ${f.name}`); });
        effs = effs.filter(f => !(f.k === "tok" && /\bX\/X\b/.test(f.desc || "")));
        sp.noRemind = true;
      }
      { const kd = (card.o || "").match(/if this spell was kicked, it deals (\d+) damage to (?:that creature|that permanent|it) instead/i);
        if (kd) lastKicked = opts.copy ? !!opts.kicked : confirm(`Was ${dispName(card)} kicked (${((card.o.match(/^Kicker ((?:\{[^}]+\})+)/m) || [])[1]) || "kicker"})?`);
        if (kd && lastKicked) { effs = effs.map(f => f.k === "dmgCr" ? { ...f, n: Number(kd[1]) } : f); logTo(code, `${me.name}'s ${dispName(card)} was kicked (${kd[1]} damage)`); } }
      if ((/discard any number of cards at random\. creatures you control get \+1\/\+0 until end of turn for each card discarded this way/i.test(card.o || "") || /discard your hand, then draw [a-z]+ cards\. for each card discarded this way, creatures you control get \+1\/\+0 until end of turn/i.test(card.o || "")) && !opts.copy) {
        const x = Math.max(0, Math.floor(Number(prompt(`${dispName(card)}: how many cards did you discard${/at random/i.test(card.o) ? " at random" : ""}?`, "1")) || 0));
        effs = effs.map(f => f.k === "pumpAll" ? { ...f, dp: String(x) } : f).filter(f => f.k !== "pumpAll" || x > 0); logTo(code, `${me.name}'s ${dispName(card)}: discarded ${x}${/at random/i.test(card.o) ? " at random" : ""} → creatures get +${x}/+0`);
        if (x) act([{ type: "discard", n: x }]);
        { const dd = (card.o || "").match(/discard your hand, then draw (a|one|two|three|four|five|seven|\d+) cards?/i); if (dd) { const k = ({ a: 1, one: 1, two: 2, three: 3, four: 4, five: 5, seven: 7 })[dd[1].toLowerCase()] || Number(dd[1]); reminders.push({ id: newId(), src: dispName(card), text: `Draw ${k} cards.`, drawN: k, times: 1 }); } } }
      if (/as an additional cost to cast this spell, pay x life/i.test(card.o || "") && !opts.copy) {
        const x = Math.max(0, Math.floor(Number(prompt(`${dispName(card)}: pay how much life (X)?`, "1")) || 0));
        if (x && !me.prot?.life) { mutate(p => { p.life = (p.life ?? START_LIFE) - x; }); logTo(code, `${me.name} paid ${x} life for ${dispName(card)} (X = ${x})`); }
        effs = effs.map(f => f.k === "pumpTarget" || f.k === "pumpAll" ? { ...f, dp: String(f.dp).replace(/x/i, x), dt: String(f.dt).replace(/x/i, x) } : f);
      }
      if (ovl) {
        const normal = effs.find(f => f.k === "remove");
        effs = effs.filter(f => f.k !== "remove");
        reminders.push({ id: newId(), src: dispName(card), text: "How did you cast it?", times: 1, ovlAsk: { normal, over: ovl.over, cost: ovl.cost, base: card.m || "" } });
      }
      if (!sp.auto) effs = effs.concat(sp.effs.filter(f => (f.k === "mana" && f.perCount) || (f.k === "tok" && f.n === "X")).filter(f => !effs.includes(f)));
      const xIf = (card.o || "").match(/if X is (\d+) or more, (destroy all other creatures|creatures you control get)/i);
      const xPump = f => (f.k === "pumpTarget" || f.k === "pumpAll") && /^[+-]?X$/i.test(String(f.dp ?? "")) && !/pay x life/i.test(card.o || "");
      if (effs.some(f => f.n === "X" && ["tok", "mill", "tokCopy"].includes(f.k)) || effs.some(xPump) || xIf) {
        const x = opts.copy && lastX != null ? lastX : Math.max(0, Math.floor(Number(prompt(`${dispName(card)}: what was X?`, "1")) || 0));
        lastX = x; effs = effs.map(f => xPump(f) ? { ...f, dp: String(f.dp).replace(/x/i, x), dt: String(f.dt).replace(/x/i, x) } : f.n === "X" && ["tok", "mill", "tokCopy"].includes(f.k) ? { ...f, n: x } : f.k === "amass" && /amass [a-z]+ x\b/i.test(card.o || "") ? { ...f, n: x } : f);
        if (xIf && x < Number(xIf[1])) { effs = effs.filter(f => !(/destroy/i.test(xIf[2]) ? f.k === "remove" && f.all : f.k === "pumpAll")); logTo(code, `${dispName(card)}: X = ${x} (less than ${xIf[1]}, so no "${xIf[2]}…")`); }
        if (/^search your library and\/or graveyard/im.test(card.o || "")) reminders.push({ id: newId(), src: dispName(card), text: `${(card.o.match(/^search your library and\/or graveyard[^.]*\./im) || [""])[0].replace(/\bX\b/g, x)}${x >= Number((xIf || [])[1] || 99) ? " Creatures you control get +X/+X and gain haste." : ""}`, times: 1 });
        else if (xIf) effs = effs.map(f => f.k === "remove" && f.all && /other creatures/i.test(f.what || "") ? { ...f, spare: (effs.find(g => g.k === "tok") || {}).name } : f.k === "pumpAll" ? { ...f, dp: String(f.dp).replace(/x/i, x), dt: String(f.dt).replace(/x/i, x) } : f);
      }
      // "Create ... tokens, then put a counter on each creature" → tokens exist before the counters go out
      const tokFirst = /\bcreate [^.]*tokens?, then put/i.test(card.o || "") || /^create [^.]*tokens?\.[^]*creatures you control get/im.test(card.o || "") ? effs.filter(f => f.k === "tok" && typeof f.n === "number") : [];
      if (tokFirst.length && effs.length > tokFirst.length) { act(tokFirst.map(f => ({ type: "create", name: f.name, n: f.n * (1 + stormN), desc: f.desc, tapped: !!f.tapped, src: dispName(card) })), null, null, { tag: castKey, merge: true }); effs = effs.filter(f => !tokFirst.includes(f)); }
      if (effs.length || pc) act(effs.length ? [{ type: "effects", effs, times: 1 + stormN, count: 1, src: dispName(card) }] : [],
        pc ? p => { p.delayed ||= {}; p.delayed[newId()] = { src: dispName(card), cost: pc, turnNo: room.turnNo || 0 }; } : null, null, { tag: castKey, merge: true });
      // Leftover simple instructions (Opt: "Scry 1. Draw a card.", Pym Particles' "Draw a card.") → a reminder with a Drew button
      if (card.o && !sp.modes?.length && !opts.copy) {
        const sents = card.o.replace(/\([^)]*\)/g, "").split(/\n|(?<=\.)\s+/).map(x => x.trim()).filter(Boolean);
        const simple = sents.filter(x => /^(?:then )?(?:draw (a|one|two|three|four|\d+) cards?|scry \d+|surveil \d+)\.?$/i.test(x) || (sp.auto && /^(?:you draw (?:a|one|two|three|four|\d+) cards? and (?:you )?lose \d+ life|(?:scry|surveil) \d+, then draw (?:a|one|two|three|four|\d+) cards?)\.?$/i.test(x)));
        const dm = simple.map(x => x.match(/(?:^|then |you )draw (a|one|two|three|four|\d+) cards?/i)).find(Boolean);
        { const fc = sents.filter(x => /^you may cast [^.]* from among (?:them|those cards)/i.test(x)); if (fc.length && (effs.length || sp.auto)) reminders.push({ id: newId(), src: dispName(card), text: fc.join(" "), times: 1 }); }
        if (sp.auto) { const fl = sents.filter(x => /^creatures you control with [a-z ]+ get [+-]\d+\/[+-]\d+/i.test(x)); if (fl.length && !sp.effs.some(f => f.k === "pumpAll")) reminders.push({ id: newId(), src: dispName(card), text: fl.join(" "), times: 1 }); }
        if (sp.auto) { const th = sents.filter(x => /^then (?:you )?(?:put|return)\b/i.test(x)); if (th.length && !sp.effs.some(f => /regrow|reanimate|fetch|necro/i.test(f.k))) reminders.push({ id: newId(), src: dispName(card), text: th.map(x => x.replace(/^then /i, "").replace(/^\w/, c => c.toUpperCase())).join(" "), times: 1 }); }
        const fresh = reminders.some(x => !snap.has(x.id));
        if (simple.length && !sp.auto && sp.effs.some(f => f.k === "tok") && !effs.some(f => f.k === "tok")) { const ts = sents.find(x => /\bcreate\b/i.test(x)); reminders.push({ id: newId(), src: dispName(card), text: (ts || "Create the tokens.").replace(/^\w/, c => c.toUpperCase()), times: 1, effs: sp.effs.filter(f => f.k === "tok") }); }
        if (simple.length && !sp.effs.some(f => /^draw|adnaus|rummage|tdraw/.test(f.k))) reminders.push({ id: newId(), src: dispName(card), text: simple.map(x => x.replace(/^\w/, c => c.toUpperCase())).join(" "), times: 1, ...(dm ? { drawN: ({ a: 1, one: 1, two: 2, three: 3, four: 4 })[dm[1].toLowerCase()] || Number(dm[1]) } : {}) });
        else if ((!sp.auto || (effs.length && effs.every(f => f.k === "extraCombat"))) && !sp.noRemind && !fresh && (!effs.length || effs.every(f => f.k === "extraCombat" || (f.k === "tok" && f.lead))) && !ctr?.spell && !wr && !le && !pc && !/^prevent all combat damage that would be dealt this turn\.?$/im.test(card.o)) reminders.push({ id: newId(), src: dispName(card), text: sents.join(" "), times: 1 });
      }
      if (castKey) endStep(castKey, snap, { name: dispName(card) });
      if (castKey && opts.counters) sendCounter(castKey, opts.counters.key, dispName(card), ctr);
      render();
      return;
    }
    const id = newId();
    logTo(code, opts.via ? `${me.name} put ${dispName(card)} onto the battlefield (${opts.via})` : `${me.name} ${land ? "played" : "cast"} ${dispName(card)}`);
    if (castKey) prowess(card); // prowess first: tokens made by this spell's cast triggers weren't there when prowess triggered
    if (castKey) act([{ type: "cast", card, id, prior: myPriorCasts(castKey), ...(fz ? { fromZone: fz.z || true } : {}), ...(opts.free || opts.castCopy ? { free: true } : {}) }], null, null, { merge: !!fz }); // cast triggers stay even if it's countered
    if (castKey && card.o) addlCosts(card);
    const snapP = remSnap();
    const tapRule = boardEnv().tapIn.find(r => permMatch({ t: card.t || "", m: card.m || "" }, r.filter));
    if (tapRule && !opts.tapped && entersTapped(card, me) !== true) toast(`${dispName(card)} enters tapped (${tapRule.src})`);
    let tapped = opts.tapped || (tapRule ? true : entersTapped(card, me));
    if (tapped && /\bLand\b/.test(card.t || "") && Object.values(me.bf || {}).some(x => /^lands you control enter untapped\.?$/im.test(x.o || lookupCard(x.n)?.o || ""))) { tapped = false; logTo(code, `${dispName(card)} enters untapped (Horizon Explorer)`); }
    const amulet = Object.values(me.bf || {}).some(x => /whenever a permanent you control enters tapped, untap it/i.test(x.o || lookupCard(x.n)?.o || ""));
    if (!opts.tapped && !tapRule && /enters tapped unless it's your first, second, or third turn of the game/i.test(card.o || "")) tapped = !(room?.turn === pid && (me.turns || 1) <= 3);
    if (typeof tapped === "string" && /unless you have two or more opponents/i.test(tapped)) tapped = opponents().filter(o => !isOut(o)).length < 2;
    const shock = typeof tapped === "string" && tapped.match(/you may pay (\d+) life\. if you don't, it enters tapped/i);
    if (shock) { const n = Number(shock[1]), pay = opts.shockPay ?? confirm(`${dispName(card)}: pay ${n} life so it enters untapped?\n\nOK = pay ${n} life (untapped)\nCancel = it enters tapped`);
      tapped = !pay;
      if (pay) setTimeout(() => { if (!me.prot?.life) mutate(p => { p.life = (p.life ?? START_LIFE) - n; }, true); logTo(code, `${me.name} paid ${n} life: ${dispName(card)} enters untapped`); }, 0);
      else logTo(code, `${me.name}'s ${dispName(card)} entered tapped`); }
    else if (typeof tapped === "string") { reminders.push({ id: newId(), src: dispName(card), text: tapped, times: 1, note: "It entered untapped. Tap it if it should be." }); }
    const kickedNow = castKey && /^Kicker\b/m.test(card.o || "") && /\bif it was kicked\b/i.test(card.o || "") ? confirm(`Was ${dispName(card)} kicked (${(card.o.match(/^Kicker ((?:\{[^}]+\})+)/m) || [])[1] || "kicker"})?`) : false;
    { const ch = String(card.o || "").match(/^As (?:this [a-z]+|[^\n]+?) enters, choose ([A-Z][a-z]+) or ([A-Z][a-z]+)\.\n• \1 — ([^\n]+)\n• \2 — ([^\n]+)/m);
      if (ch) { const first = opts.mode != null ? opts.mode === ch[1] : confirm(`${dispName(card)}: choose ${ch[1]}?\n\nOK = ${ch[1]}: ${ch[3]}\n\nCancel = ${ch[2]}: ${ch[4]}`);
        card = { ...card, o: card.o.replace(ch[0], `${first ? ch[3] : ch[4]}`), mode: first ? ch[1] : ch[2] }; logTo(code, `${me.name}'s ${dispName(card)}: chose ${card.mode}`); } }
    if (castKey && !opts.copy && !opts.tokenCopy && !/\b(Instant|Sorcery)\b/.test(card.t || "")) { const wc = String(card.o || "").match(/^When you cast this spell(?: and when this creature dies)?, ([^\n]+)$/m);
      if (wc) { const tx = wc[1][0].toUpperCase() + wc[1].slice(1), sp = spellAbility({ n: `${card.n} · cast trigger`, t: "Sorcery", o: tx }); if (sp.auto && sp.effs.length) setTimeout(() => act([{ type: "effects", effs: sp.effs, times: 1, count: 1, src: dispName(card) }]), 0); if (!sp.auto || /,|\bthen\b/.test(tx)) reminders.push(normalizeRem({ id: newId(), src: `${dispName(card)} (cast trigger)`, text: tx, times: 1 })); } }
    if (castKey && !opts.copy && !opts.tokenCopy) {
      const osp = (String(card.o || "").match(/^Offspring ((?:\{[^}]+\})+)/m) || [])[1] || (/\bCreature\b/.test(card.t || "") && !/\bLand\b/.test(card.t || "") ? Object.values(me.bf || {}).map(x => (String(x.o || "").match(/creature spells you cast gain offspring ((?:\{[^}]+\})+)/i) || [])[1]).find(Boolean) : null);
      if (osp && confirm(`Did you pay offspring ${osp} for ${dispName(card)}? (OK = also create a 1/1 token copy)`)) { logTo(code, `${me.name} paid offspring ${osp}: a 1/1 token copy of ${dispName(card)}`); setTimeout(() => playCard({ ...card, p: "1", tg: "1" }, { tokenCopy: true, via: "offspring" }), 60); }
    }
    { const gm = String(card.o || "").match(/^As [^\n]+? enters, choose two abilities from among ([a-z ]+), ([a-z ]+), and ([a-z ]+)\./m);
      if (gm) { const ks = [gm[1], gm[2], gm[3]]; reminders.push({ id: newId(), src: dispName(card), srcId: id, text: "Choose two abilities:", times: 1, gmPick: { id, pairs: [[ks[0], ks[1]], [ks[0], ks[2]], [ks[1], ks[2]]] } }); }
      const cn = !gm && String(card.o || "").match(/^As [^\n]+? enters, (choose a (?:number|nonland card name|card name))\.?/m);
      if (cn && !/choose a (creature type|color)\b/i.test(cn[1]) && !reminders.some(x => x.srcId === id && /As it enters/i.test(x.text || ""))) reminders.push({ id: newId(), src: dispName(card), srcId: id, text: `As it enters, ${cn[1]} (tell the table).`, times: 1 }); }
    { const ce = !opts.tokenCopy && String(card.o || "").match(/^You may have (?:this (?:creature|Vehicle|artifact|enchantment)|[A-Z][^\n]*?) enter as a copy of (any creature on the battlefield|a creature or planeswalker you control|a creature an opponent controls|any creature|any enchantment on the battlefield|any artifact on the battlefield|any Ally creature on the battlefield|any nonland permanent on the battlefield|any artifact or creature on the battlefield|another creature you control|a creature you control)/m);
      if (ce) reminders.push({ id: newId(), src: dispName(card), srcId: id, text: `Enter as a copy of ${ce[1]}?`, times: 1, copyEnt: { id, scope: /you control/.test(ce[1]) ? "mine" : /opponent/.test(ce[1]) ? "opp" : "any", pw: /planeswalker/.test(ce[1]), kind: /nonland permanent/.test(ce[1]) ? "nonland" : /artifact or creature/.test(ce[1]) ? "Artifact|Creature" : /enchantment/.test(ce[1]) ? "Enchantment" : /artifact/.test(ce[1]) ? "Artifact" : "Creature", ally: /Ally/.test(ce[1]), rider: /additional \+1\/\+1 counter/i.test(card.o) ? "spark" : /is a Bird in addition/i.test(card.o) ? "bird" : /crew 3 and it loses all other/i.test(card.o) ? "mech" : "" } }); }
    if (!opts.tokenCopy && /\bAura\b/.test(card.t || "") && /^Enchant (opponent|player)$/m.test(card.o || ""))
      reminders.push({ id: newId(), src: dispName(card), srcId: id, text: `${dispName(card)}: which ${/opponent$/m.test(card.o.match(/^Enchant (opponent|player)$/m)[0]) ? "opponent" : "player"} does it enchant?`, times: 1, encPick: { id, opp: /^Enchant opponent$/m.test(card.o) } });
    if (/power and toughness are each equal to the number of cards in your hand/i.test(card.o || "")) setTimeout(() => { const v = prompt(`${dispName(card)}: how many cards are in your hand?`, "3"); if (v != null) mutate(p => { if (p.bf?.[id]) p.bf[id].handN = Math.max(0, Number(v) || 0); }); }, 80);
    if (amulet && tapped === true) { tapped = false; logTo(code, `${dispName(card)} entered tapped → untapped (Amulet of Vigor)`); }
    if (/\bLand\b/.test(card.t || "") && !opts.tokenCopy && seated(room).some(o => !isOut(o) && Object.values(o.bf || {}).some(x => /whenever a player plays a land, that player draws a card/i.test(x.o || lookupCard(x.n)?.o || ""))) && !opts.fromZone?.z?.startsWith?.("bf"))
      reminders.push(normalizeRem({ id: newId(), src: "Horn of Greed", text: "You played a land: draw a card.", times: 1 }));
    // Springleaf Parade, Hangarback-style "When this enters, create X …": ask X once (it's the X paid)
    if (!opts.tokenCopy && /\{X\}/.test(card.m || "") && /when (?:this [a-z]+|[^.\n]*?) enters,[^.\n]*\bX\b/i.test(card.o || "") && !/enters with X\b/i.test(card.o || "")) {
      const v = prompt(`${dispName(card)}: what was X?`, "1"); etbX = Math.max(0, Math.floor(Number(v) || 0)); }
    act([{ type: "enters", id, card, cast: !!castKey, ...(opts.tokenCopy ? { tok: true } : {}), ...(land && !opts.via && !opts.fromZone ? { played: true } : {}) }], p => {
      p.bf ||= {}; p.bf[id] = { ...(kickedNow ? { kicked: true } : {}), ...bfEntry(card), et: room?.turnNo || 0, ...(opts.warp ? { warp: room?.turnNo || 0 } : {}), ...(opts.dash ? { dash: true, haste: "dash" } : {}), ...(opts.own && opts.own.id !== pid ? { own: opts.own } : {}), ...(opts.tokenCopy ? { tok: true } : {}), ...(opts.haste ? { haste: opts.haste } : {}), ...(opts.sacNext ? { sacNext: opts.sacNext } : {}), ...(opts.blitz ? { blitz: true } : {}) };
      if (tapped === true) p.bf[id].tap = true;
      enterCounters(p, id, card);
      if (/\bSaga\b/.test(card.t || "")) { p.bf[id].c ||= {}; p.bf[id].c.lore = (p.bf[id].c.lore || 0) + 1; } // a Saga enters with its first lore counter
      const van = card.o && vanishingOf(card);
      if (van) { p.bf[id].c ||= {}; p.bf[id].c.time = van; } // Vanishing N: N time counters
      if (/^[^.\n]*? enters prepared\b/im.test(card.o || "")) p.bf[id].prepared = true;
    }, null, castKey ? { tag: castKey, merge: true } : { merge: !!fz });
    const fresh = me.bf?.[id];
    if (fresh) setTimeout(() => { legendCheck(id); render(); }, 0);
    const abl = String(card.o || "").match(/^When this Equipment enters, create an? ([^.]*?)\b([A-Z][a-z]+) creature token, then attach this Equipment to it/m); // Ancestral Blade
    if (fresh && (abl || /^(Living weapon|Job select|For Mirrodin!)/m.test(card.o || ""))) setTimeout(() => {
      if (abl) { act([{ type: "create", name: abl[2], n: 1, desc: `${abl[1]}${abl[2]} creature`, src: dispName(card) }]); setTimeout(() => { const k = Object.keys(me.tokens || {}).find(x => me.tokens[x].name === abl[2] && !eqList(me.tokens[x]).length); if (k && me.bf?.[id]) attachTo(id, `tok:${k}`); }, 0); return; }
      const job = /^Job select\b/m.test(card.o || ""), fm = /^For Mirrodin!/m.test(card.o || ""), tn = job ? "Hero" : fm ? "Rebel" : "Phyrexian Germ", gt = (String(card.o || "").match(/[Ee]quipped creature is an? ([A-Z][a-z]+) in addition to its other types/) || [])[1];
      act([{ type: "create", name: tn, n: 1, desc: job ? `1/1 colorless ${tn}${gt ? ` ${gt}` : ""} creature` : fm ? "2/2 red Rebel creature" : "0/0 black Phyrexian Germ creature", src: `${dispName(card)} (${job ? "job select" : fm ? "For Mirrodin!" : "living weapon"})` }]);
      setTimeout(() => { const k = Object.keys(me.tokens || {}).find(x => me.tokens[x].name === tn && !eqList(me.tokens[x]).length); if (k && me.bf?.[id]) attachTo(id, `tok:${k}`); }, 0);
    }, 0);
    if (fresh && /\bCreature\b/.test(card.t || "")) { // Soulbond: pair as either enters
      const sb = /^Soulbond\b/m.test(card.o || "") ? id : Object.entries(me.bf || {}).find(([x, e]) => x !== id && !e.pair && /^Soulbond\b/m.test(e.o || lookupCard(e.n)?.o || ""))?.[0];
      if (sb && Object.entries(me.bf || {}).some(([x, e]) => x !== sb && !e.pair && /\bCreature\b/.test(e.t || ""))) { reminders.push({ id: newId(), src: dispName(me.bf[sb] || card), text: "Soulbond: pair it with another unpaired creature?", times: 1, soulbond: { id: sb } }); setTimeout(render, 0); }
    }
    if (fresh && /^as [^,]+? enters(?: the battlefield)?,? choose a creature type/im.test(card.o || ""))
      { reminders.push({ id: newId(), src: dispName(card), srcId: id, text: "As it enters, choose a creature type.", times: 1, chooseType: id }); setTimeout(render, 0); }
    if (fresh && /as this [a-z]+ enters, you may have it become a copy of any creature on the battlefield until end of turn, except it has haste/i.test(card.o || ""))
      { reminders.push({ id: newId(), src: dispName(card), srcId: id, text: "Become a copy of any creature on the battlefield until end of turn (with haste)?", times: 1, mirrorPick: id }); setTimeout(render, 0); }
    if (fresh && /^as [^,]+? enters(?: the battlefield)?,? choose a color/im.test(card.o || ""))
      { reminders.push({ id: newId(), src: dispName(card), srcId: id, text: "As it enters, choose a color.", times: 1, chooseColor: id }); setTimeout(render, 0); }
    const ench = fresh && !opts.via && card.o && !auraStealOf(card) && enchantType(card);
    if (ench && !/^(opponent|player)$/.test(ench)) { reminders.push({ id: newId(), src: dispName(card), srcId: id, text: `Attach it to which ${ench}?`, times: 1, attachPick: { srcId: id, type: ench } }); setTimeout(render, 0); }
    if (fresh && /\bCreature\b/.test(fresh.t || "") && kwsOf({ ...fresh, o: fresh.o || card.o }, pid, id).some(x => x.k === "riot"))
      { reminders.push({ id: newId(), src: dispName(card), srcId: id, text: "Riot: it enters with your choice of a +1/+1 counter or haste.", times: 1, riot: id }); setTimeout(render, 0); }
    if (fresh && /^as [^,]+? enters(?: the battlefield)?,? choose (?:a|an) (?:player|opponent)/im.test(card.o || ""))
      { reminders.push({ id: newId(), src: dispName(card), srcId: id, text: "As it enters, choose a player.", times: 1, choosePlayer: id, oppOnly: /choose an opponent/i.test(card.o) }); setTimeout(render, 0); }
    const aura = !opts.via && card.o && auraStealOf(card);
    if (aura) reminders.push({ id: newId(), src: dispName(card), text: "", times: 1, effs: [aura] });
    const wrE = card.o && winRule(card);
    if (wrE && wrE.when === "manual" && /^when [^,]* enters/i.test(wrE.text) && !/devotion to \w+[^]*number of cards in your library, you win/i.test(card.o || "")) reminders.push({ id: newId(), src: dispName(card), text: wrE.text, times: 1, winAsk: true });
    const instead = card.o ? entersInstead(card) : null;
    if (instead) { reminders.push({ id: newId(), src: dispName(card), text: `To keep it, ${instead}. Otherwise it goes to your graveyard.`, times: 1, instead: { bfId: id, what: instead } }); render(); }
    if (castKey) endStep(castKey, snapP, { name: dispName(card), perm: true, card: { n: card.n, t: card.t || "", m: card.m || "", img: card.img || "" } });
  }
  // "Enters with N counters": add them, or remind when it depends on a choice
  function enterCounters(p, id, card) {
    const w = card.o ? entersWithCounters(card, p, id) : null;
    if (!w || (w.remind && /enter as a copy of/i.test(w.remind))) return;
    if (/^Multikicker/m.test(card.o || "") && /enters with an? (\w+) counter on it for each time it was kicked/i.test(card.o)) {
      const key = card.o.match(/enters with an? (\w+) counter on it for each time it was kicked/i)[1].toLowerCase();
      const k = Math.max(0, Math.floor(Number(prompt(`${dispName(card)}: how many times was it kicked?`, "1")) || 0));
      const e = p.bf[id]; if (k) { e.c ||= {}; e.c[key] = (e.c[key] || 0) + k; }
      logTo(code, `⚙ ${dispName(card)}: kicked ${k}× → ${k} ${key} counter${k === 1 ? "" : "s"}`); return;
    }
    if (w.remind) { const cm = w.remind.match(/enters with (a|an|one|two|three|four|five|\d+) \+1\/\+1 counters? on it/i), cn = cm && ({ a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5 }[cm[1].toLowerCase()] || Number(cm[1]));
      reminders.push({ id: newId(), src: dispName(card), srcId: id, text: w.remind, times: 1, ...(cn ? { ewc: { id, n: cn } } : { note: "Add its counters by hand (open the card ▼)." }) }); return; } // Bloodthirst / Unleash: one tap if it applies
    if (!w.n) return;
    const e = p.bf[id];
    e.c ||= {}; e.c[w.key] = (e.c[w.key] || 0) + w.n;
    logTo(code, `⚙ ${dispName(card)} entered with ${w.n} ${w.label} counter${w.n === 1 ? "" : "s"}`);
  }
  function castCommander(name) {
    const card = deck?.cards.find(c => c.n === name) || { n: name, t: "Legendary Creature" };
    const castKey = broadcastCast(card);
    const casts = me.tax?.[slug(name)] || 0;
    const id = newId();
    logTo(code, `${me.name} cast ${name} from the command zone${casts ? ` (tax +${casts * 2})` : ""}`);
    payForCast(card, (costOf(card) || "") + (casts ? `{${casts * 2}}` : ""));
    act([{ type: "cast", card, id, fromZone: "cmd" }], p => { p.tax ||= {}; p.tax[slug(name)] = casts + 1; }); // tax counts even if it's countered
    const snap = remSnap();
    act([{ type: "enters", id, card, cast: true }], p => {
      p.bf ||= {}; p.bf[id] = { ...bfEntry(card), cmd: true, et: room?.turnNo || 0 };
      enterCounters(p, id, card);
    }, null, { tag: castKey, merge: true });
    endStep(castKey, snap, { name, perm: true, cmd: true });
  }
  const myPriorCasts = key => Object.entries(room?.casts || {}).filter(([k, c]) => k !== key && c.by === pid && (c.turnNo || 0) === (room?.turnNo || 0)).map(([, c]) => ({ n: c.n, t: c.t || "" }));
  // How many prowess triggers a creature has: its own keyword plus each source that grants it (Sokka, Monastery Mentor's tokens…)
  function prowessCount(e, id, isToken) {
    const own = (tableLose.some(f => permanentMatches(e, f)) ? [] : ownKeywords(e)).filter(k => k === "prowess").length;
    const granted = new Set(buffsOn(e, pid, id, isToken).kws.filter(x => x.k === "prowess").map(x => x.src)).size;
    return own + granted;
  }
  function prowess(card) {
    if (!card || /\bCreature\b/.test(card.t || "") || /\bLand\b/.test(card.t || "")) return;
    // Veyran: casting an instant or sorcery makes each prowess trigger an additional time
    const dbl = boardEnv().double.filter(d => d.ownerId === pid);
    const mult0 = /\b(Instant|Sorcery)\b/.test(card.t || "") ? 1 + dbl.filter(d => d.on === "castIS").length : 1;
    // Harmonic Prodigy ("a Shaman or another Wizard"), Sword-style "equipped creature's triggers": that creature's prowess triggers again
    const mult = (t, id, nm) => mult0 + dbl.filter(d => d.on === "source" && d.types?.some(x => new RegExp(`\\b${x}\\b`, "i").test(t || "")) && !(d.another && d.src === nm)).length + dbl.filter(d => d.on === "equipped" && d.att === id).length;
    const ids = Object.entries(me.bf || {}).filter(([, e]) => /\bCreature\b/.test(e.t || "")).map(([id, e]) => [id, mult(e.t, id, e.nick || e.n) * prowessCount({ ...e, o: e.o || lookupCard(e.n)?.o }, id, false)]).filter(x => x[1] > 0);
    const tks = Object.entries(me.tokens || {}).filter(([, t]) => t.count > 0 && isCreatureToken(t.name)).map(([k, t]) => [k, mult(tokenPerm(t).t, k, t.name) * prowessCount(tokenPerm(t), k, true)]).filter(x => x[1] > 0);
    if (!ids.length && !tks.length) return;
    const tag = () => `pw${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
    mutate(p => { p.eot ||= {};
      ids.forEach(([id, n]) => { p.eot[tag()] = { src: n > 1 ? `prowess ×${n}` : "prowess", target: id, dp: n, dt: n, kws: [] }; });
      tks.forEach(([k, n]) => { const t = p.tokens?.[k]; if (!t) return; const eid = tag(); t.ep = [...(t.ep || []), eid]; p.eot[eid] = { epTag: true, src: n > 1 ? `prowess ×${n}` : "prowess", dp: n, dt: n, kws: [], ids: [], toks: [k] }; }); });
    logTo(code, `⚙ Prowess: ${[...ids.map(([id, n]) => `${dispName(me.bf[id])} +${n}/+${n}`), ...tks.map(([k, n]) => `${me.tokens[k].count} ${me.tokens[k].name} +${n}/+${n}`)].join(", ")} until end of turn`);
  }
  // Creatures that attacked this turn (Relentless Assault: "untap all creatures that attacked this turn")
  const combatKey = () => `${room.turnNo || 0}:${room.step?.turnNo === (room.turnNo || 0) ? room.step.extra || 0 : 0}`;
  const youAttackEv = () => me.youAtk === combatKey() ? [] : [{ type: "youattack" }];
  function markAttacked(p, kind, id, n) {
    const t = room.turnNo || 0;
    if (p.attacked?.turnNo !== t) p.attacked = { turnNo: t };
    p.attacked[kind] ||= {};
    p.attacked[kind][id] = (p.attacked[kind][id] || 0) + n;
  }
  // An additional combat phase (Relentless Assault, Aggravated Assault, Moraug…)
  function extraCombat(src) {
    if (room.turn !== pid) { toast("Additional combat only happens on your turn."); return; }
    poolStepEnd(true, false);
    update(ref(db, `rooms/${code}`), { step: { turnNo: room.turnNo || 0, i: 3, extra: (room.step?.extra || 0) + 1 } });
    logTo(code, `⚔ ${me.name}: additional combat phase${src ? ` (${src})` : ""}`);
  }
  function toggleTap(id) {
    const e = me.bf?.[id];
    if (!e) return;
    const tapping = !e.tap;
    if (tapping) act([{ type: "tapped", id }], p => { p.bf[id].tap = true; });
    else mutate(p => { delete p.bf[id].tap; });
    const eo = e.o || lookupCard(e.n)?.o || "";
    if (!tapping && me.riders?.some(x => x.src === dispName(e))) mutate(p => { const i = (p.riders || []).map(x => x.src).lastIndexOf(dispName(e)); if (i >= 0) p.riders.splice(i, 1); if (!p.riders?.length) delete p.riders; }, true);
    if (tapping && PATH_RIDER.test(eo)) addRider({ kind: "path", src: dispName(e), n: Number(eo.match(PATH_RIDER)[1]) || 1, at: Date.now() });
    if (tapping && NC_RIDER.test(eo)) {
      const forType = /chosen type/i.test(eo.match(NC_RIDER)[1]) ? (e.ctype || "?") : null;
      reminders.push({ id: newId(), src: dispName(e), text: forType ? `Tapped for a ${forType} creature spell? Then that spell can't be countered.` : "Tapped for a legendary spell? Then that spell can't be countered.", times: 1, ncAsk: true, ncType: forType }); render();
    }
    if (tapping && !/\bLand\b/.test(e.t || "") && /\{T\}[^:\n]*: Add\b/.test(eo)) { const kn = Object.values(me.bf || {}).filter(x => /whenever you tap a nonland permanent for mana, add one mana of any type that permanent produced/i.test(x.o || lookupCard(x.n)?.o || "")); if (kn.length) toast(`⚡ ${dispName(e)}: ${kn.map(x => `${dispName(x)} +1 of a type it made`).join(" · ")}`); }
    if (!/\bLand\b/.test(e.t || "")) return;
    if (tapping) { const us = Object.values(me.bf || {}).filter(x => x.att === id && /whenever enchanted (?:land|forest) is tapped for mana, its controller adds an additional/i.test(x.o || lookupCard(x.n)?.o || "")); if (us.length) toast(`⚡ ${dispName(e)}: ${us.map(x => `${dispName(x)} +1 ${x.color || "chosen color"}`).join(" · ")}`); }
    if (tapping) extraManaNote(e);
    const lt = reminders.find(r => r.landTap);
    if (!tapping) { if (lt) { lt.landTap.ids = lt.landTap.ids.filter(x => x !== id); if (!lt.landTap.ids.length) reminders = reminders.filter(r => r !== lt); render(); } return; }
    if (!landGrants(id).length) return;
    if (lt) { if (!lt.landTap.ids.includes(id)) lt.landTap.ids.push(id); }
    else reminders.push({ id: newId(), src: "Land tapped", text: "", times: 1, landTap: { ids: [id] } });
    render();
  }
  // Mill: the milled players log which cards went to their graveyards
  function millOut(r) {
    const f = r.mill, n = f.n === "X" ? null : f.n * (r.times || 1);
    if (/^target/.test(f.who)) return; // asks who first
    const who = f.who === "you" ? [pid] : f.who === "each player" ? seated(room).filter(o => !isOut(o)).map(o => o.id) : opponents().filter(o => !isOut(o)).map(o => o.id);
    who.forEach(id => sendNote(id, { kind: "millLog", n: n ?? 1, src: r.src, text: "", ...(id === pid && f.pick ? { pick: f.pick, ifType: f.ifType || null, ifTok: f.ifTok || null } : {}) }));
    logTo(code, `🪦 ${r.src}: ${who.map(id => id === pid ? me.name : room.players?.[id]?.name).join(", ")} mill${who.length === 1 && who[0] !== pid ? "s" : ""} ${n ?? "X"} card${n === 1 ? "" : "s"}`);
  }
  // Enduring Vitality (and other Glimmers): it died as a creature, so it comes back as a non-creature enchantment
  function dieReturn(e) {
    const gid = Object.entries(me.gy || {}).filter(([, c]) => c.n === e.n).sort((a, b) => (b[1].at || 0) - (a[1].at || 0))[0]?.[0];
    if (!gid) return;
    const c = me.gy[gid];
    const t = String(c.t || e.t || "").replace(/\s*\bCreature\b\s*/, " ").replace(/\s+/g, " ").trim();
    playCard({ ...(lookupCard(c.n) || {}), ...c, ...(e.o ? { o: e.o } : {}), t, p: undefined, tg: undefined }, { fromZone: { z: "gy", id: gid }, via: "came back as an enchantment (not a creature)" });
  }
  // Vanishing: at my upkeep a time counter comes off; when the last one does, it's sacrificed
  function vanishTick() {
    const list = Object.entries(me.bf || {}).filter(([, e]) => (e.c?.time || 0) > 0 && vanishingOf({ ...e, o: e.o || lookupCard(e.n)?.o }));
    if (!list.length) return;
    const done = list.filter(([, e]) => e.c.time === 1);
    list.forEach(([, e]) => logTo(code, `⏳ ${me.name}'s ${dispName(e)}: time counter removed (${e.c.time - 1} left)${e.c.time === 1 ? " → sacrificed" : ""}`));
    const events = done.flatMap(([id, e]) => { const cre = /\bCreature\b/.test(e.t || ""); return [{ type: "sac", name: e.n, n: 1, token: false, creature: cre }, ...(cre ? [{ type: "dies", n: 1, token: false, ids: [id] }] : [])]; });
    act(events, p => list.forEach(([id]) => { const x = p.bf?.[id]; if (x?.c?.time) { x.c.time -= 1; if (!x.c.time) delete x.c.time; } }),
      p => done.forEach(([id]) => { const x = p.bf?.[id]; if (!x) return; delete p.bf[id]; toZone(p, x, "gy"); }));
  }
  // Underworld Breach: nonland cards in my graveyard have escape (mana cost + exile three other cards)
  const breachOn = () => Object.values(me.bf || {}).some(e => /each nonland card in your graveyard has escape/i.test(e.o || lookupCard(e.n)?.o || ""));
  // Escape cost's exile part: "Exile four other cards from your graveyard" (Breach: three)
  function escapeExileN(c) { const m = String(c?.o || "").match(/^Escape—[^,]+, Exile (\w+) other cards? from your graveyard/m); return m ? (({ one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8 })[m[1].toLowerCase()] || Number(m[1]) || 0) : breachOn() ? 3 : 0; }
  // Suspect: menace and can't block until it stops being suspected
  function suspectMine(kind, id, why) {
    const name = kind === "bf" ? dispName(me.bf?.[id] || {}) : `${me.tokens?.[id]?.name || "?"} token`;
    mutate(p => {
      if (kind === "bf") { if (p.bf?.[id]) p.bf[id].suspect = true; return; }
      const t = p.tokens?.[id]; if (!t) return;
      if (t.count === 1) { t.sus = true; tidyTokenStacks(p); return; }
      const one = { ...t, count: 1, sus: true }; delete one.tapped; delete one.fresh;
      t.count -= 1; if (t.tapped > t.count) t.tapped = t.count;
      p.tokens[`__sus_${Date.now()}`] = one; tidyTokenStacks(p);
    });
    logTo(code, `🕵 ${me.name}'s ${name} is suspected (menace, can't block) — ${why}`);
  }
  // Tabernacle at Pendrell Vale: every creature costs {1} at its controller's upkeep, or it's destroyed
  function tabernacleCost() {
    let n = 0; const srcs = [];
    seated(room).filter(o => !isOut(o)).forEach(o => Object.values(o.bf || {}).forEach(e => { const m = String(e.o || "").match(/all creatures have "at the beginning of your upkeep, destroy this creature unless you pay \{(\d+)\}/i); if (m) { n += Number(m[1]); srcs.push(dispName(e)); } }));
    return n ? { n, srcs } : null;
  }
  function tabernacleBox(r) {
    const cards = Object.entries(me.bf || {}).filter(([, e]) => /\bCreature\b/.test(e.t || ""));
    const toks = Object.entries(me.tokens || {}).filter(([, t]) => t.count > 0 && isCreatureToken(t.name));
    return `<span class="mini">Tick what you pay {${r.tabernacle.n}} each to keep.</span><div class="ans-list">${cards.map(([id, e]) => `<label class="mode-check"><input type="checkbox" class="tb-box" data-rid="${r.id}" value="${id}" checked><span>${esc(dispName(e))}</span></label>`).join("")}
      ${toks.map(([k, t]) => `<label class="mini">${esc(t.name)} keep <input type="number" min="0" max="${t.count}" class="x-input tb-tok" data-rid="${r.id}" data-k="${esc(k)}" value="${t.count}"> / ${t.count}</label>`).join("")}</div>
      <button class="btn small primary" data-a="tab-go" data-id="${r.id}">Pay and destroy the rest</button>`;
  }
  // Torbran, Thane of Red Fell: red sources I control deal +N damage to opponents and their permanents
  function redBonus() {
    return Object.values(me?.bf || {}).reduce((a, e) => { const m = String(e.o || lookupCard(e.n)?.o || "").match(/if a red source you control would deal damage to an opponent or a permanent an opponent controls, it deals that much damage plus (\d+) instead/i); return a + (m ? Number(m[1]) : 0); }, 0);
  }
  const isRedSrc = c => /R/.test(String(c?.m || "")) || /\bred\b/i.test(c?.desc || "");
  // Damage multipliers on my sources: Isengard Unleashed this turn, Fiery Emancipation, Furnace of Rath / Dictate of the Twin Gods (anyone's)
  function dmgMult(toOpp = true) {
    let m = 1; const srcs = [];
    if (toOpp && me?.turnFx?.mult > 1 && me.turnFx.turnNo === (room?.turnNo || 0)) { m *= me.turnFx.mult; srcs.push(`×${me.turnFx.mult} ${me.turnFx.src}`); }
    seated(room || {}).filter(o => !isOut(o)).forEach(o => Object.values(o.bf || {}).forEach(e => {
      const t = String(e.o || lookupCard(e.n)?.o || "");
      const mine = t.match(/if a source you control would deal damage to (an opponent or a permanent an opponent controls|a permanent or player)[^,]*, it deals (double|triple) that damage/i);
      if (mine && o.id === pid && (toOpp || /permanent or player/i.test(mine[1]))) { const k = mine[2].toLowerCase() === "triple" ? 3 : 2; m *= k; srcs.push(`×${k} ${dispName(e)}`); }
      const any = t.match(/if a source would deal damage to a permanent or player, it deals (double|triple) that damage/i);
      if (any) { const k = any[1].toLowerCase() === "triple" ? 3 : 2; m *= k; srcs.push(`×${k} ${dispName(e)}`); }
    }));
    return { m, srcs };
  }
  // How much damage one of my sources really deals: multipliers first, then Torbran's +N (the hit player orders them, so they pick the smaller)
  function ampDmg(n, srcCard, toOpp = true) {
    const { m, srcs } = dmgMult(toOpp);
    const red = toOpp && isRedSrc(srcCard) ? redBonus() : 0;
    return { n: n * m + red, why: [...srcs, ...(red ? [`+${red} red source`] : [])].join(", ") };
  }
  // Damage to a creature: shows the outcome, destroys it if it's lethal
  // Damage marked on creatures this turn (it wears off when the turn ends)
  const markedOf = o => o?.marked?.turnNo === (room?.turnNo || 0) ? o.marked : null;
  const tokMarks = (o, k) => Object.values(markedOf(o)?.tok?.[k] || {}).slice(0, o.tokens?.[k]?.count || 0);
  const hasDeathtouch = (e, id) => !!e && kwsOf({ ...e, o: e.o || lookupCard(e.n)?.o }, pid, id).some(x => x.k === "deathtouch");
  function crTargets(k) {
    const out = [];
    seated(room).filter(o => !isOut(o) && !(k.oppOnly && o.id === pid) && !(k.only && o.id !== k.only)).forEach(o => {
      Object.entries(o.bf || {}).forEach(([id, e]) => {
        const cr = /\bCreature\b/.test(e.t || ""), pw = /\bPlaneswalker\b/.test(e.t || "");
        if (!((k.cr !== false && cr) || (k.pw && pw)) || cantTarget(e, o.id, id, pid)) return;
        const s = cr ? combatStats(o, "bf", id) : { name: dispName(e), p: 0, t: e.c?.loyalty || 0, pw: true, indestr: false };
        if (s) out.push({ v: `${o.id}|bf|${id}`, o, s: { ...s, dmg: cr ? markedOf(o)?.bf?.[id] || 0 : 0 } });
      });
      if (k.cr !== false) Object.entries(o.tokens || {}).forEach(([id, t]) => {
        if (!(t.count > 0) || !isCreatureToken(t.name) || cantTarget(tokenPerm(t), o.id, id, pid, true)) return;
        const s = combatStats(o, "tok", id);
        if (!s) return;
        const marks = tokMarks(o, id);
        if (t.count > marks.length) out.push({ v: `${o.id}|tok|${id}|`, o, s: { ...s, dmg: 0, n: t.count - marks.length, name: `${s.name}${marks.length ? ` (${t.count - marks.length} undamaged)` : ""}` } });
        marks.forEach((d, i) => out.push({ v: `${o.id}|tok|${id}|${i}`, o, s: { ...s, dmg: d, n: 1, name: `${s.name} (the one with ${d} damage)` } }));
      });
    });
    if (k.excl?.length) return out.filter(x => !k.excl.includes(x.v));
    return out;
  }
  function crAmount(r, c) {
    const k = r.crDmg;
    if (k.self) return { n: c.s.p, why: "" };
    return ampDmg(k.n, (r.srcId && me.bf?.[r.srcId]) || lookupCard(r.src.replace(/ \(.*\)$/, "")), c.o.id !== pid);
  }
  const crDT = (r, c) => r.crDmg.self ? (c.s.kws || []).includes("deathtouch") : !!r.crDmg.dt || hasDeathtouch(r.srcId && me.bf?.[r.srcId], r.srcId);
  function crOutcome(c, n, dt) {
    if (c.s.pw) return n >= c.s.t ? "dies" : `${c.s.t - n} loyalty left`;
    if (c.s.indestr) return "survives (indestructible)";
    const left = c.s.t - (c.s.dmg || 0);
    if (n >= left || (dt && n > 0)) return `${c.s.regen ? "dies unless it regenerates" : "dies"}${dt && n < left ? " (deathtouch)" : ""}`;
    return `survives (${(c.s.dmg || 0) + n} damage marked)`;
  }
  const crLabel = c => `${c.o.name}: ${c.s.name} ${c.s.pw ? `(loyalty ${c.s.t})` : `${c.s.p}/${c.s.t}${c.s.dmg ? `, ${c.s.dmg} dmg` : ""}`}`;
  function crDmgBox(r) {
    const k = r.crDmg, list = crTargets(k);
    if (!list.length) return `<span class="mini">No legal targets right now.</span>`;
    return `<select class="fetch-pick" id="cd-${r.id}">${list.map(c => { const a = crAmount(r, c); return `<option value="${c.v}">${esc(crLabel(c))} · ${a.n} dmg → ${crOutcome(c, a.n, crDT(r, c))}</option>`; }).join("")}</select>
      ${k.atk ? `<label class="mini"><input type="checkbox" id="cda-${r.id}"> It's attacking (+${k.atk} to its controller)</label>` : ""}
      <button class="btn small primary" data-a="cd-go" data-id="${r.id}">${k.self ? "Deal its power to itself" : "Deal damage"}</button>`;
  }
  // Deal damage to one creature / planeswalker: lethal → destroyed on its owner's phone, otherwise the damage stays marked this turn
  function dealCr(c, n, src, why, dt, exile) {
    const [oid, kind, id, idx] = c.v.split("|");
    const out = crOutcome(c, n, dt);
    logTo(code, `💥 ${me.name}'s ${src}: ${n} damage to ${c.o.name}'s ${c.s.name}${why ? ` (${why})` : ""} → ${out}`);
    const ix = idx === undefined || idx === "" ? -1 : Number(idx);
    if (!c.s.pw && n > 0) setTimeout(() => repercuss(oid, n, `${c.s.name} was dealt ${n}`), 0);
    if (/^dies/.test(out)) {
      sendOrders({ [oid]: { targets: [{ kind, id }] } }, { how: exile ? "exile" : "destroy", src, rider: "", lethal: true });
      if (kind === "tok" && ix >= 0) sendOrders({ [oid]: {} }, { how: "markDmg", kind, id, idx: ix, clear: true, src });
    } else if (c.s.pw) { if (n > 0) sendOrders({ [oid]: {} }, { how: "ctrSub", id, key: "loyalty", n, src }); }
    else if (n > 0) sendOrders({ [oid]: {} }, { how: "markDmg", kind, id, idx: ix, n, src, ...(exile ? { exileDie: true } : {}) });
    return out;
  }
  function crDmgGo(r) {
    const k = r.crDmg, v = document.getElementById(`cd-${r.id}`)?.value;
    const atkHit = !!document.getElementById(`cda-${r.id}`)?.checked;
    const c = v && crTargets(k).find(x => x.v === v);
    if (!c) { toast("Pick a target first."); return; }
    reminders = reminders.filter(x => x.id !== r.id);
    // "each of up to two target creatures": the other picks can't choose this one again
    if (k.grp && v.split("|")[1] === "bf") reminders.filter(x => x.crDmg?.grp && x.src === r.src).forEach(x => { x.crDmg.excl = [...(x.crDmg.excl || []), v]; });
    const oid = v.split("|")[0];
    if (oid !== pid) commitCrime("damage");
    const a = crAmount(r, c);
    { const [, kd, tid] = v.split("|"), te = kd === "bf" ? room.players?.[oid]?.bf?.[tid] : null; const tn = te && String(te.fname || te.n).split(",")[0];
      if (te && tn && new RegExp(`^prevent all damage that would be dealt to (?:this creature|${tn.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})\\.?$`, "im").test(te.o || lookupCard(te.n)?.o || "")) { a.n = 0; a.why = `${dispName(te)} prevents all damage dealt to it`; } }
    dealCr(c, a.n, r.src, a.why, crDT(r, c), !!k.exile);
    if (a.n > 0) lifelinkGain(r.llSrc || r.srcId, a.n, r.src);
    if (k.ctrl) { // Shocker: "…and 2 damage to that creature's controller"
      const o = room.players?.[oid], hit = ampDmg(k.ctrl, (r.srcId && me.bf?.[r.srcId]) || lookupCard(r.src), oid !== pid);
      if (oid === pid) { if (!me.prot?.life) mutate(p => { p.life = (p.life ?? START_LIFE) - hit.n; }); logTo(code, `💥 ${r.src}: ${hit.n} damage to ${me.name}`); }
      else { act([{ type: "effects", effs: [{ k: "tlose", n: hit.n, target: oid, targetName: o?.name }], times: 1, count: 1, src: r.src, srcId: r.srcId }]); setTimeout(() => { deliriumPunish({ [oid]: hit.n }); render(); }, 0); }
    }
    if (k.atk && atkHit) {
      const o = room.players?.[oid], hit = ampDmg(k.atk, lookupCard(r.src), oid !== pid);
      act([{ type: "effects", effs: [{ k: "tlose", n: hit.n, target: oid, targetName: o?.name }], times: 1, count: 1, src: r.src, srcId: r.srcId }]);
      if (oid !== pid) setTimeout(() => { deliriumPunish({ [oid]: hit.n }); render(); }, 0);
    }
    render();
  }
  // Radiant Performer: copy a single-target spell cast this turn for every other legal target
  // A targeted ability from one of my permanents (pinger, "destroy target creature" trigger…): shared with the table this turn
  function noteAbility(r) {
    if (!r?.srcId || !me.bf?.[r.srcId]) return;
    const rm = r.effs?.length === 1 && r.effs[0].k === "remove" && !r.effs[0].all && (r.effs[0].n || 1) === 1 && r.effs[0].how !== "steal" ? r.effs[0] : null;
    const plan = r.ping ? { k: "ping", n: r.ping.n } : r.crDmg && !r.crDmg.self && !r.crDmg.only ? { k: "dmgCr", n: r.crDmg.n, cr: r.crDmg.cr !== false, pw: !!r.crDmg.pw, opp: !!r.crDmg.oppOnly } : rm ? { ...rm, filter: rm.filter } : null;
    if (!plan) return;
    const t = room.turnNo || 0, e = me.bf[r.srcId];
    if (plan.k !== "remove" && hasDeathtouch(e, r.srcId)) plan.dt = true; // a copied ability still has the same source
    const stale = Object.fromEntries(Object.entries(room.abils || {}).filter(([, a]) => (a.turnNo || 0) !== t).map(([k]) => [k, null]));
    update(ref(db, `rooms/${code}/abils`), { ...stale, [newId()]: { n: `${dispName(e)} (ability)`, src: dispName(e), m: e.m || "", by: pid, turnNo: t, at: Date.now(), plan } });
  }
  function radiantSpells() {
    const spells = Object.entries(room.casts || {}).filter(([, c]) => (c.turnNo || 0) === (room.turnNo || 0) && !c.countered && !/Radiant Performer/.test(c.n))
      .map(([k, c]) => ({ k, c, at: c.at || 0, card: lookupCard(c.n) || deckCard(c.n) })).filter(x => x.card?.o && !/\b(Creature|Artifact|Enchantment|Planeswalker|Battle|Land)\b/.test(x.card.t || ""));
    const abils = Object.entries(room.abils || {}).filter(([, a]) => (a.turnNo || 0) === (room.turnNo || 0) && a.plan)
      .map(([k, a]) => ({ k, c: { n: a.n, by: a.by }, at: a.at || 0, card: { n: a.src, m: a.m || "" }, plan: a.plan }));
    return [...spells, ...abils].sort((a, b) => b.at - a.at);
  }
  // A spell or ability the app didn't see (an opponent's untracked pinger…): typed in by hand
  function radiantCur(r) {
    if (r.radiant.k === "manual") return r.radiant.manual;
    return radiantSpells().find(x => x.k === r.radiant.k);
  }
  const radiantPlanOf = x => x.plan || radiantPlan(x.card);
  function radiantPlan(card) {
    const sp = spellAbility(card);
    return (sp.effs || []).find(f => ["ping", "dmgCr"].includes(f.k) || (f.k === "remove" && !f.all && (f.n || 1) === 1 && f.how !== "steal")) || null;
  }
  function radiantCands(f) {
    if (f.k === "remove") return removalCandidates(f).map(c => { const [, kind, id] = c.v.split("|"); return { v: c.v, o: c.o, label: `${c.o.name}: ${c.label}`, kind, id, n: kind === "tok" ? c.o.tokens?.[id]?.count || 1 : 1 }; });
    const players = f.k === "ping" ? seated(room).filter(o => !isOut(o)).map(o => ({ v: `P|${o.id}`, o, label: `${o.name} (player)`, player: true })) : [];
    return [...players, ...crTargets(f.k === "ping" ? { cr: true, pw: true } : { cr: f.cr, pw: f.pw, oppOnly: f.opp }).map(c => ({ ...c, label: crLabel(c) }))];
  }
  function radiantBox(r) {
    const list = radiantSpells();
    const cur = radiantCur(r);
    const manual = `<details class="mini" ${!list.length ? "open" : ""}><summary>Not listed? (a spell or ability the app didn't see)</summary>
      Damage: <input type="number" min="0" class="x-input" id="rdn-${r.id}" value="1"> to
      <select class="fetch-pick" id="rdk-${r.id}"><option value="ping">any target</option><option value="cpw">creature or planeswalker</option><option value="cr">creature</option></select>
      <button class="btn small" data-a="rd-manual" data-id="${r.id}">Use this</button></details>`;
    const pick = `${list.length ? `<select class="fetch-pick" id="rd-${r.id}">${list.map(x => `<option value="${x.k}" ${x.k === r.radiant.k ? "selected" : ""}>${esc(castLabel(x.c))}</option>`).join("")}</select><button class="btn small" data-a="rd-pick" data-id="${r.id}">Copy this one</button>` : `<span class="mini">No spell or ability this turn that the app can read.</span>`}${manual}`;
    if (!cur) return pick;
    const f = radiantPlanOf(cur);
    if (!f) return `${pick}<span class="mini">The app can copy damage spells and single-target removal. For ${esc(cur.c.n)}, make one copy per other legal target by hand.</span>`;
    const cands = radiantCands(f);
    return `${pick}<div class="mini">Original target (it's skipped; every other legal target gets a copy):</div>
      <select class="fetch-pick" id="rdo-${r.id}">${cands.map(c => `<option value="${c.v}">${esc(c.label)}</option>`).join("")}</select>
      <button class="btn small primary" data-a="rd-go" data-id="${r.id}">Copy to all others</button>`;
  }
  function radiantGo(r) {
    const cur = radiantCur(r), orig = document.getElementById(`rdo-${r.id}`)?.value;
    const f = cur && radiantPlanOf(cur);
    if (!f || !orig) return;
    reminders = reminders.filter(x => x !== r);
    const src = `${r.src} (copy of ${cur.c.n})`;
    // a stack of tokens is several permanents: each one gets a copy
    const many = c => c.v.startsWith("P|") || c.player ? 1 : (c.s?.n || c.n || 1) - (c.v === orig ? 1 : 0);
    const cands = radiantCands(f).filter(c => many(c) > 0 && (c.v !== orig || /\|tok\|/.test(c.v)));
    logTo(code, `✨ ${me.name}'s ${r.src}: copying ${cur.c.n} for every other legal target (${cands.reduce((a, c) => a + many(c), 0)} copies)`);
    if (f.k === "remove") {
      const byOwner = {};
      cands.forEach(c => { for (let i = 0; i < many(c); i++) (byOwner[c.o.id] ||= { targets: [] }).targets.push({ kind: c.kind, id: c.id }); });
      sendOrders(byOwner, { how: f.how, src, rider: f.rider || "", ...(f.noRegen ? { noRegen: true } : {}) });
      render(); return;
    }
    const effs = [], hits = {};
    cands.forEach(c => {
      const a = ampDmg(f.n, cur.card, c.o.id !== pid);
      if (c.player) {
        if (c.o.id === pid) { if (!me.prot?.life) { mutate(p => { p.life = (p.life ?? START_LIFE) - a.n; }); logTo(code, `💥 ${src}: ${a.n} damage to ${me.name}`); } }
        else if (!c.o.prot?.all) { effs.push({ k: "tlose", n: a.n, target: c.o.id, targetName: c.o.name }); hits[c.o.id] = (hits[c.o.id] || 0) + a.n; }
        return;
      }
      for (let i = 0; i < many(c); i++) dealCr(c, a.n, src, a.why, !!f.dt);
    });
    if (effs.length) act([{ type: "effects", effs, times: 1, count: 1, src }]);
    if (Object.keys(hits).length) setTimeout(() => { deliriumPunish(hits); render(); }, 0);
    render();
  }
  // Damage to each creature: who dies, who survives (damage stays marked), and players for Earthquake
  function creatureCount() { return seated(room).filter(o => !isOut(o)).reduce((a, o) => a + countTypes(o, ["creature"]), 0); }
  function dmgAllPlan(r, x) {
    const f = r.dmgAll, n = f.n === "creatures" ? creatureCount() : f.n === "X" ? x : f.n;
    if (n == null || Number.isNaN(n)) return null;
    const src = (r.srcId && me.bf?.[r.srcId]) || lookupCard(r.src.replace(/ \(.*\)$/, ""));
    const hits = [];
    seated(room).filter(o => !isOut(o) && !(f.opp && o.id === pid)).forEach(o => {
      const amt = ampDmg(n, src, o.id !== pid);
      Object.entries(o.bf || {}).forEach(([id, e]) => {
        const cr = /\bCreature\b/.test(e.t || ""), pw = /\bPlaneswalker\b/.test(e.t || "");
        if (!(cr || (f.pw && pw)) || (f.other && o.id === pid && id === r.srcId)) return;
        const s0 = cr ? combatStats(o, "bf", id) : { name: dispName(e), p: 0, t: e.c?.loyalty || 0, pw: true };
        if (!s0 || (cr && f.noFly && s0.kws.includes("flying")) || (cr && f.onlyFly && !s0.kws.includes("flying"))) return;
        hits.push({ c: { v: `${o.id}|bf|${id}`, o, s: { ...s0, dmg: cr ? markedOf(o)?.bf?.[id] || 0 : 0 } }, n: amt.n, why: amt.why, count: 1 });
      });
      Object.entries(o.tokens || {}).forEach(([k, t]) => {
        if (!(t.count > 0) || !isCreatureToken(t.name)) return;
        const s0 = combatStats(o, "tok", k);
        if (!s0 || (f.noFly && s0.kws.includes("flying")) || (f.onlyFly && !s0.kws.includes("flying"))) return;
        const marks = tokMarks(o, k);
        hits.push({ c: { v: `${o.id}|tok|${k}`, o, s: { ...s0, dmg: Math.max(0, ...marks, 0) } }, n: amt.n, why: amt.why, count: t.count, tok: true });
      });
    });
    const players = f.players ? seated(room).filter(o => !isOut(o) && !(f.players === "opp" && o.id === pid)).map(o => ({ o, ...ampDmg(n, src, o.id !== pid) })) : [];
    return { n, hits, players };
  }
  function dmgAllBox(r) {
    const f = r.dmgAll;
    if (f.n === "X" && r.dmgAll.x == null) return `<label class="mini">X = <input type="number" min="0" class="x-input" id="dax-${r.id}"></label><button class="btn small primary" data-a="da-x" data-id="${r.id}">Set X</button>`;
    const plan = dmgAllPlan(r, r.dmgAll.x);
    if (!plan) return "";
    const dies = plan.hits.filter(h => /^dies/.test(crOutcome(h.c, h.n, false))), lives = plan.hits.filter(h => !dies.includes(h));
    const nm = h => `${h.c.o.name}'s ${h.c.s.name}${h.count > 1 ? ` ×${h.count}` : ""}`;
    return `<div class="mini">${plan.n} damage${f.n === "creatures" ? ` (${plan.n} creatures on the battlefield)` : ""}. 💀 Dies: ${dies.length ? esc(dies.map(nm).join(", ")) : "none"}${lives.length ? ` · 🛡 Survives: ${esc(lives.map(h => `${nm(h)} (${crOutcome(h.c, h.n, false)})`).join(", "))}` : ""}${plan.players.length ? ` · Players: ${esc(plan.players.map(p => `${p.o.name} ${p.n}`).join(", "))}` : ""}</div>
      <button class="btn small primary" data-a="da-go" data-id="${r.id}">Deal the damage</button>`;
  }
  function dmgAllGo(r) {
    const plan = dmgAllPlan(r, r.dmgAll.x);
    if (!plan) return;
    reminders = reminders.filter(x => x !== r);
    const byOwner = {}, dead = [], hurt = [];
    plan.hits.forEach(h => {
      const [oid, kind, id] = h.c.v.split("|");
      const out = crOutcome(h.c, h.n, false);
      if (!h.c.s.pw && h.n > 0) (r.repTot ||= {})[oid] = (r.repTot[oid] || 0) + h.n * h.count;
      if (/^dies/.test(out)) { for (let i = 0; i < h.count; i++) (byOwner[oid] ||= { targets: [] }).targets.push({ kind, id }); dead.push(`${h.c.o.name}'s ${h.c.s.name}${h.count > 1 ? ` ×${h.count}` : ""}`); }
      else if (h.c.s.pw) sendOrders({ [oid]: {} }, { how: "ctrSub", id, key: "loyalty", n: h.n, src: r.src });
      else if (h.n > 0) { sendOrders({ [oid]: {} }, { how: "markDmg", kind, id, idx: -1, n: h.n, all: h.tok, src: r.src }); hurt.push(h.c.s.name); }
    });
    Object.entries(r.repTot || {}).forEach(([oid, n]) => setTimeout(() => repercuss(oid, n, `${r.src} hit their creatures for ${n} in all`), 0));
    logTo(code, `💥 ${me.name}'s ${r.src}: ${plan.n} damage to each creature${dead.length ? ` · dies: ${dead.join(", ")}` : ""}${hurt.length ? ` · survives: ${hurt.join(", ")}` : ""}`);
    if (Object.keys(byOwner).length) sendOrders(byOwner, { how: "destroy", src: r.src, rider: "", lethal: true });
    const effs = [], hits = {};
    plan.players.forEach(({ o, n }) => {
      if (o.id === pid) { if (!me.prot?.life) { mutate(p => { p.life = (p.life ?? START_LIFE) - n; }); logTo(code, `💥 ${r.src}: ${n} damage to ${me.name}`); } }
      else if (!o.prot?.all) { effs.push({ k: "tlose", n, target: o.id, targetName: o.name }); hits[o.id] = n; }
    });
    if (effs.length) act([{ type: "effects", effs, times: 1, count: 1, src: r.src, srcId: r.srcId }]);
    if (Object.keys(hits).length) setTimeout(() => { deliriumPunish(hits); render(); }, 0);
    render();
  }
  // Price of Progress: damage to each player equal to (twice) the number of X they control
  function dmgPerPlan(r) {
    const f = r.dmgPer, src = (r.srcId && me.bf?.[r.srcId]) || lookupCard(r.src);
    return seated(room).filter(o => !isOut(o) && !(f.who === "opponent" && o.id === pid)).map(o => {
      const k = Object.values(o.bf || {}).filter(e => permMatch(e, f.filter)).length;
      const a = ampDmg(k * f.mult, src, o.id !== pid);
      return { o, k, n: k ? a.n : 0, why: a.why };
    });
  }
  function dmgPerBox(r) {
    const plan = dmgPerPlan(r);
    return `<div class="mini">${esc(plan.map(x => `${x.o.name}: ${x.k} ${r.dmgPer.what} → ${x.n}`).join(" · "))}</div><button class="btn small primary" data-a="dp-go" data-id="${r.id}">Deal the damage</button>`;
  }
  function dmgPerGo(r) {
    const plan = dmgPerPlan(r);
    reminders = reminders.filter(x => x !== r);
    const effs = [], hits = {};
    plan.filter(x => x.n > 0).forEach(({ o, n }) => {
      if (o.id === pid) { if (!me.prot?.life) mutate(p => { p.life = (p.life ?? START_LIFE) - n; }); }
      else if (!o.prot?.all) { effs.push({ k: "tlose", n, target: o.id, targetName: o.name }); hits[o.id] = n; }
    });
    logTo(code, `💥 ${me.name}'s ${r.src}: ${plan.map(x => `${x.o.name} ${x.n}`).join(", ")}`);
    if (effs.length) act([{ type: "effects", effs, times: 1, count: 1, src: r.src, srcId: r.srcId }]);
    if (Object.keys(hits).length) setTimeout(() => { deliriumPunish(hits); render(); }, 0);
    render();
  }
  // Double Trouble: each creature I control gets +X/+0 where X is its power right now
  function doublePower(src) {
    const cards = Object.entries(me.bf || {}).filter(([, e]) => /\bCreature\b/.test(e.t || "")).map(([id, e]) => [id, Number(ptOf(e, countsFor(me), pid, id).split("/")[0]) || 0]).filter(([, n]) => n > 0);
    const toks = Object.entries(me.tokens || {}).filter(([, t]) => isCreatureToken(t.name)).map(([k, t]) => [k, Number(String(tokPTfx(t, pid, k) || "0/0").split("/")[0]) || 0]).filter(([, n]) => n > 0);
    if (!cards.length && !toks.length) return;
    mutate(p => {
      p.eot ||= {};
      const nid = () => `d${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
      cards.forEach(([id, n]) => { if (p.bf?.[id]) p.eot[nid()] = { src, target: id, dp: n, dt: 0, kws: [] }; });
      toks.forEach(([k, n]) => { const t = p.tokens?.[k]; if (!t) return; const eid = nid(); t.ep = [...(t.ep || []), eid]; p.eot[eid] = { src, epTag: true, ids: [], toks: [], dp: n, dt: 0, kws: [] }; });
    });
    logTo(code, `⚙ ${src}: doubled the power of ${me.name}'s creatures (${[...cards.map(([id, n]) => `${dispName(me.bf[id])} ${n}→${n * 2}`), ...toks.map(([k, n]) => `${me.tokens[k].name} tokens ${n}→${n * 2}`)].join(", ")})`);
  }
  // Ghost-Spider: X damage to the defending player, X = attacking creatures
  const attackersNow = () => me.attacked?.turnNo === (room.turnNo || 0) ? Object.keys(me.attacked.bf || {}).length + Object.values(me.attacked.tok || {}).reduce((a, n) => a + n, 0) : 0;
  function dmgDefBox(r) {
    const k = r.dmgDef, x = k.n === "attackers" ? attackersNow() : k.n === "X" ? null : k.n;
    const src = (r.srcId && me.bf?.[r.srcId]) || lookupCard(r.src);
    return `${k.n === "X" || k.n === "attackers" ? `<label class="mini">X = <input type="number" min="0" class="x-input" id="ddx-${r.id}" value="${x ?? ""}"></label>${k.n === "attackers" ? `<span class="mini">(${x} attacking so far; change it if you declare more)</span>` : ""}` : ""}
      ${opponents().filter(o => !isOut(o)).map(o => `<button class="btn small primary" data-a="dd-go" data-id="${r.id}" data-o="${o.id}" style="border-left:4px solid ${esc(o.color)}">💥 → ${esc(o.name)}${x != null ? ` (${ampDmg(x, src, true).n})` : ""}</button>`).join("")}`;
  }
  // Repercussion: whenever a creature is dealt damage, that much damage to its controller (from the Repercussion's controller)
  const REPERC = /whenever a creature is dealt damage, [^.]*? deals that much damage to that creature's controller/i;
  function repercuss(victimId, n, why) {
    if (!(n > 0)) return;
    seated(room).filter(o => !isOut(o)).forEach(o => Object.values(o.bf || {}).filter(e => REPERC.test(e.o || lookupCard(e.n)?.o || "")).forEach(e => {
      if (o.id === pid) repercHit(victimId, n, dispName(e), why);
      else sendOrders({ [o.id]: {} }, { how: "reperc", victim: victimId, n, src: dispName(e), why });
    }));
  }
  function repercHit(victimId, n, src, why) {
    const e = Object.values(me.bf || {}).find(x => dispName(x) === src);
    const a = ampDmg(n, e, victimId !== pid), v = room.players?.[victimId];
    logTo(code, `💥 ${me.name}'s ${src}: ${a.n} damage to ${v?.name || "?"}${why ? ` (${why})` : ""}${a.why ? ` (${a.why})` : ""}`);
    if (victimId === pid) { if (!me.prot?.life) mutate(p => { p.life = (p.life ?? START_LIFE) - a.n; }); }
    else if (!v?.prot?.all) { act([{ type: "effects", effs: [{ k: "tlose", n: a.n, target: victimId, targetName: v?.name }], times: 1, count: 1, src }]); setTimeout(() => { deliriumPunish({ [victimId]: a.n }); render(); }, 0); }
  }
  // Earthbend N: a land becomes a 0/0 haste creature with N +1/+1 counters; it comes back tapped when it dies or is exiled
  function earthbendBox(r) {
    const k = r.earthbend, lands = Object.entries(me.bf || {}).filter(([, e]) => /\bLand\b/.test(e.t || ""));
    if (!lands.length) return `<span class="mini">You control no lands.</span>`;
    return `${k.n === "X" ? `<label class="mini">X = <input type="number" min="0" class="x-input" id="ebx-${r.id}" value="0"></label>` : ""}<select class="fetch-pick" id="eb-${r.id}">${lands.map(([id, e]) => `<option value="${id}">${esc(dispName(e))}${e.earthbent ? " (already earthbent)" : ""}${e.tap ? " (tapped)" : ""}</option>`).join("")}</select>
      <button class="btn small primary" data-a="eb-go" data-id="${r.id}">⛰ Earthbend${k.n === "X" ? "" : ` ${k.n}`}</button>`;
  }
  function earthbendGo(r) {
    const id = document.getElementById(`eb-${r.id}`)?.value, e = id && me.bf?.[id];
    if (!e) return;
    const n = r.earthbend.n === "X" ? Math.max(0, Number(document.getElementById(`ebx-${r.id}`)?.value) || 0) : r.earthbend.n;
    reminders = reminders.filter(x => x !== r);
    mutate(p => { const x = p.bf[id]; if (!x) return; if (!/\bCreature\b/.test(x.t || "")) { x.ebT = x.t; x.t = x.t.replace(/\bLand\b/, "Land Creature"); x.p = "0"; x.tg = "0"; } x.haste = r.src; x.earthbent = true; });
    logTo(code, `⛰ ${me.name}'s ${r.src}: earthbend ${n} — ${dispName(e)} is a 0/0 creature with haste`);
    if (n > 0) act([{ type: "effects", effs: [{ k: "countersOn", target: { kind: "bf", id }, n, key: "p1p1", label: "+1/+1" }], times: 1, count: 1, src: r.src, srcId: r.srcId }]);
    else setTimeout(render, 0);
  }
  // Waterbend {N}: tap artifacts and creatures to help pay (each pays {1})
  function wbendBox(r) {
    const cards = Object.entries(me.bf || {}).filter(([, e]) => !e.tap && /\b(Artifact|Creature)\b/.test(e.t || ""));
    const toks = Object.entries(me.tokens || {}).filter(([, t]) => t.count - (t.tapped || 0) > 0 && (isCreatureToken(t.name) || /\bArtifact\b/.test(tokenPerm(t).t || "")));
    return `<div class="ans-list">${cards.map(([id, e]) => `<label class="mode-check"><input type="checkbox" class="wb-box" data-rid="${r.id}" value="${id}"><span>${esc(dispName(e))}</span></label>`).join("")}
      ${toks.map(([k, t]) => `<label class="mini">${esc(t.name)} tap <input type="number" min="0" max="${t.count - (t.tapped || 0)}" class="x-input wb-tok" data-rid="${r.id}" data-k="${esc(k)}" value="0"></label>`).join("")}</div>
      <button class="btn small primary" data-a="wb-go" data-id="${r.id}">Tap them (pay up to {${r.wbend.n}})</button>${r.wbend.optional ? `<button class="btn small" data-a="wb-no" data-id="${r.id}">Not paying it</button>` : ""}`;
  }
  // "Whenever a creature dies this turn, you gain 1 life" (Ruinous Waterbending): watched by every phone
  function dieGainCheck(events) {
    const n = (events || []).filter(ev => ev.type === "dies" && !ev.token || ev.type === "dies" && ev.token && /creature/i.test(ev.name || "creature")).reduce((a, ev) => a + (ev.n || 1), 0);
    if (!n) return;
    Object.entries(room?.dieGain || {}).filter(([, g]) => g.turnNo === (room.turnNo || 0)).forEach(([oid, g]) => {
      if (oid === pid) setTimeout(() => act([{ type: "effects", effs: [{ k: "gain", n: g.n * n }], times: 1, count: 1, src: g.src }]), 0);
      else sendOrders({ [oid]: {} }, { how: "gainLife", n: g.n * n, src: g.src, why: `${n} creature${n === 1 ? "" : "s"} died` });
    });
  }
  // Abilities a token type borrows (Hazel's Brewmaster: "Foods you control have all activated abilities of all creature cards exiled with it")
  function borrowedAbilities(t) {
    const out = [];
    Object.values(me.bf || {}).forEach(h => {
      const m = String(h.o || lookupCard(h.n)?.o || "").match(/^([A-Z][a-z]+)s you control have all activated abilities of all creature cards exiled with/m);
      if (!m || t.name.toLowerCase() !== m[1].toLowerCase()) return;
      (h.brew || []).forEach(n => { const c = lookupCard(n) || deckCard(n); if (c?.o) activatedAbilities(c).forEach((ab, i) => out.push({ n, i, ab, host: dispName(h) })); });
    });
    return out;
  }
  // Colors of a reminder's source (the spell or permanent doing the targeting)
  function remSrcColors(r) {
    const name = String(r.src || "").replace(/ \(.*\)$/, "").replace(/^.*?'s /, "");
    const c = (r.srcId && me.bf?.[r.srcId]) || deckCard(name) || lookupCard(name);
    return c ? colorsOf(c.m) : null;
  }
  // Exotic Orchard: what opponents' lands could make
  function oppLandColors() {
    const set = new Set();
    opponents().filter(o => !isOut(o)).forEach(o => Object.values(o.bf || {}).filter(e => /\bLand\b/.test(e.t || "")).forEach(e => {
      [["Plains", "W"], ["Island", "U"], ["Swamp", "B"], ["Mountain", "R"], ["Forest", "G"]].forEach(([ty, c]) => { if (new RegExp(`\\b${ty}\\b`).test(e.t)) set.add(c); });
      const o = String(e.o || lookupCard(e.n)?.o || "");
      if (/add one mana of any color\b(?! that)/i.test(o)) ["W", "U", "B", "R", "G"].forEach(c => set.add(c));
      (o.match(/add[^.\n]*/gi) || []).forEach(l => (l.match(/\{([WUBRG])\}/g) || []).forEach(x => set.add(x[1])));
    }));
    return MCOL.filter(c => set.has(c));
  }
  // Necromantic Selection: pick the creature to take, then wipe
  function necroBox(r) {
    const list = seated(room).filter(o => !isOut(o)).flatMap(o => Object.entries(o.bf || {}).filter(([id, e]) => /\bCreature\b/.test(e.t || "") && !e.tok).map(([id, e]) => { const s = combatStats(o, "bf", id); return { v: `${o.id}|${id}`, label: `${o.name}: ${dispName(e)}${s?.indestr ? " (indestructible — won't die)" : s?.regen ? " (regeneration shield — will survive)" : ""}`, ok: !s?.indestr && !s?.regen }; }));
    return `${list.length ? `<span class="mini">Creature card to take after the wipe:</span><select class="fetch-pick" id="ns-${r.id}">${list.filter(x => x.ok).map(x => `<option value="${x.v}">${esc(x.label)}</option>`).join("")}<option value="">(none)</option></select>` : ""}<button class="btn small primary" data-a="ns-go" data-id="${r.id}">💀 Destroy all creatures</button>`;
  }
  // A permanent's card, plus abilities it gained (Urza's Saga chapters)
  function abCard(e) {
    const c00 = lookupCard(e.n) || e, c0 = /^\d+\+ \| /m.test(c00.o || "") ? stationCard(c00, e) : c00;
    const c = e.face != null && e.o ? { ...c0, n: `${c0.n}#f${e.face}`, o: e.o, t: e.t || c0.t } : e.mode && e.o ? { ...c0, n: `${c0.n}#m${e.mode}`, o: e.o } : c0;
    return e.gained?.length ? { ...c, n: `${c.n}#g${e.gained.length}`, o: `${c.o || ""}\n${e.gained.join("\n")}` } : c;
  }
  // "Prepared" creatures (Stensian Sanguinist): the spell half after "//"
  function preparedSpell(e) {
    const fc = (deckCard(e.n) || lookupCard(e.n))?.faces?.[1];
    if (fc) return { n: fc.n, m: fc.m, t: fc.t, o: fc.o, img: fc.img || "" };
    const o = String(e.o || lookupCard(e.n)?.o || ""), parts = o.split(/\n\/\/\n/);
    if (parts.length < 2) return null;
    const m = parts[1].match(/^(.+?) ((?:\{[^}]+\})+) — ([^\n]+)\n([^]*)$/);
    return m ? { n: m[1].trim(), m: m[2], t: m[3].trim(), o: m[4].trim(), img: "" } : null;
  }
  // My commanders' color identity (mana symbols in their cost and text)
  function cmdColors() {
    const names = [...(deck?.cmds || []), ...Object.values(me.bf || {}).filter(e => e.cmd).map(e => e.n)];
    const set = new Set();
    names.forEach(n => { const c = deckCard(n) || lookupCard(n) || Object.values(me.bf || {}).find(e => e.n === n); String(`${c?.m || ""} ${c?.o || ""}`).match(/\{[^}]+\}/g)?.forEach(sym => (sym.match(/[WUBRG]/g) || []).forEach(x => set.add(x))); });
    return set.size ? MCOL.filter(c => set.has(c)) : null;
  }
  // Legend rule: two legendary permanents with the same name → keep one (Spider-Verse, Mirror Gallery turn it off)
  function legendCheck(id) {
    const e = me.bf?.[id];
    if (!e || !/\bLegendary\b/.test(e.t || "")) return;
    const same = Object.keys(me.bf).filter(x => x !== id && me.bf[x].n === e.n);
    if (!same.length) return;
    const off = Object.values(me.bf).map(x => String(x.o || lookupCard(x.n)?.o || "").match(/the ["“]legend rule["”] doesn't apply(?: to ([^.]+?))?\./i)).find(m => m && (!m[1] || permMatch(e, parseTargetFilter(m[1]))));
    if (off) { logTo(code, `👑 ${me.name}: two ${dispName(e)} — the legend rule doesn't apply (${off[1] ? off[1] : "all"})`); return; }
    reminders.push({ id: newId(), src: "Legend rule", text: `You control two or more ${dispName(e)}. Keep one; the rest go to the graveyard.`, times: 1, legend: { ids: [...same, id] } });
  }
  // Spider-Verse: copy a spell cast from anywhere but your hand
  function copySpellGo(r) {
    const k = r.copySpell, c = k.card && (deckCard(k.card.n) || lookupCard(k.card.n) || k.card);
    reminders = reminders.filter(x => x !== r);
    if (!c) { render(); return; }
    if (k.once && me.copyTurn?.[r.src] === (room.turnNo || 0)) { toast(`${r.src}: already used this turn.`); render(); return; }
    if (k.once) mutate(p => { p.copyTurn ||= {}; p.copyTurn[r.src] = room.turnNo || 0; });
    logTo(code, `${me.name}: ${r.src} copied ${dispName(c)}`);
    if (isSpell(c)) playCard(c, { copy: true });
    else playCard(c, { via: `${r.src} copy`, tokenCopy: true, ...(k.haste ? { haste: r.src } : {}) });
  }
  function rmAmongBox(r) {
    const k = r.rmAmong, list = Object.entries(me.bf || {}).filter(([, e]) => (e.c?.[k.key] || 0) > 0 && permMatch(e, parseTargetFilter(k.what)));
    return `<div class="mini">Remove ${k.n} counters (cost) from:</div>${list.map(([id, e]) => `<label class="mini">${esc(dispName(e))} (${e.c[k.key]}) <input type="number" min="0" max="${e.c[k.key]}" class="x-input ra-n" data-rid="${r.id}" data-id="${id}" value="0"></label>`).join("")}
      <button class="btn small primary" data-a="ra-go" data-id="${r.id}">Remove</button>`;
  }
  // Crew N: tap creatures with total power N; the Vehicle is an artifact creature until end of turn
  function crewBox(r) {
    const k = r.crew, list = Object.entries(me.bf || {}).filter(([id, e]) => id !== k.id && !e.tap && /\bCreature\b/.test(e.t || ""));
    const toks = Object.entries(me.tokens || {}).filter(([, t]) => isCreatureToken(t.name) && t.count - (t.tapped || 0) > 0);
    const pw = (kind, id) => myAtkStats(kind, id)?.p ?? 0;
    return `<div class="mini">Crew ${k.n}: tap creatures with total power ${k.n} or more.</div><div class="ans-list">
      ${list.map(([id, e]) => `<label class="mode-check"><input type="checkbox" class="cw-box" data-rid="${r.id}" value="${id}"><span>${esc(dispName(e))} (power ${Number(ptOf(e, countsFor(me), pid, id).split("/")[0]) || 0})</span></label>`).join("")}
      ${toks.map(([kk, t]) => `<label class="mini">${esc(t.name)} (power ${Number(String(tokPTfx(t, pid, kk) || "0/0").split("/")[0]) || 0}) tap <input type="number" min="0" max="${t.count - (t.tapped || 0)}" class="x-input cw-tok" data-rid="${r.id}" data-k="${esc(kk)}" value="0"></label>`).join("")}</div>
      <button class="btn small primary" data-a="crew-go" data-id="${r.id}">Crew it</button>`;
  }
  // Enchanter's Bane: pick an enchantment; its controller sacrifices it or takes damage equal to its mana value
  function baneTargets() {
    const out = [];
    seated(room).filter(o => !isOut(o)).forEach(o => Object.entries(o.bf || {}).forEach(([id, e]) => { if (/\bEnchantment\b/.test(e.t || "") && !cantTarget(e, o.id, id, pid)) out.push({ v: `${o.id}|${id}`, o, e, mv: manaValue(e.m) }); }));
    return out;
  }
  function baneBox(r) {
    const list = baneTargets();
    if (!list.length) return `<span class="mini">No enchantments to target.</span>`;
    return `<select class="fetch-pick" id="bn-${r.id}">${list.map(c => `<option value="${c.v}">${esc(c.o.name)}: ${esc(dispName(c.e))} (MV ${c.mv})</option>`).join("")}</select>
      <button class="btn small primary" data-a="bane-go" data-id="${r.id}">Target it</button>`;
  }
  // Delirium: card types among cards in my graveyard
  const CARD_TYPES = ["Artifact", "Battle", "Creature", "Enchantment", "Instant", "Kindred", "Land", "Planeswalker", "Sorcery"];
  function gyTypes(p = me) { const set = new Set(); Object.values(p?.gy || {}).forEach(e => CARD_TYPES.forEach(t => { if (new RegExp(`\\b${t}\\b`).test(e.t || "")) set.add(t); })); return set.size; }
  // Fear of Burning Alive: my source dealt noncombat damage to opponents
  function deliriumPunish(hits) {
    if (gyTypes() < 4) return;
    Object.values(me.bf || {}).filter(e => /whenever a source you control deals noncombat damage to an opponent, if there are four or more card types among cards in your graveyard, this creature deals that amount of damage to target creature that player controls/i.test(e.o || lookupCard(e.n)?.o || ""))
      .forEach(e => Object.entries(hits).forEach(([oid, n]) => { if (n > 0) reminders.push({ id: newId(), src: dispName(e), text: `Delirium: deal ${n} damage to target creature ${room.players?.[oid]?.name || "they"} control${room.players?.[oid] ? "s" : ""}.`, times: 1, crDmg: { n, cr: true, only: oid } }); }));
  }
  // ----- Slim mana pool: what's floating, emptied between steps unless something says it stays -----
  const MCOL = ["W", "U", "B", "R", "G", "C"];
  function keepRules() { // Electro, Leyline Tyrant: "You don't lose unspent red mana…"; Upwelling / Omnath: everything (or green)
    const keep = new Set();
    seated(room || {}).filter(o => !isOut(o)).forEach(o => Object.values(o.bf || {}).forEach(e => {
      const t = String(e.o || (o.id === pid ? lookupCard(e.n)?.o : "") || "");
      if (o.id === pid) { const m = t.match(/you don't lose unspent (white|blue|black|red|green|colorless)? ?mana as steps and phases end/i); if (m) (m[1] ? [({ white: "W", blue: "U", black: "B", red: "R", green: "G", colorless: "C" })[m[1].toLowerCase()]] : MCOL).forEach(c => keep.add(c)); }
      if (/players don't lose unspent mana as steps and phases end/i.test(t)) MCOL.forEach(c => keep.add(c));
    }));
    return keep;
  }
  // Pay a mana cost (e.g. "{2}" or "{2}{B}") out of my mana pool: colored/hybrid first, then generic (colorless first)
  function payPool(pay, label) {
    const pool = { ...(me.pool || {}) }, took = [];
    let left = 0;
    (String(pay).match(/\{[^}]+\}/g) || []).forEach(sy => {
      if (/^\{\d+\}$/.test(sy) || /^\{[XT]\}$/.test(sy)) return;
      if (/\/P\}$/.test(sy)) return; // Phyrexian: mana or 2 life, asked separately
      const opts = sy.match(/[WUBRGC]/g) || [];
      const c = opts.sort((a, b2) => (pool[b2] || 0) - (pool[a] || 0)).find(x => (pool[x] || 0) > 0);
      if (c) { pool[c]--; took.push(c); } else left++;
    });
    let gen = (String(pay).match(/\{(\d+)\}/g) || []).reduce((a, x) => a + Number(x.replace(/\D/g, "")), 0);
    const order = ["C", ...MCOL.filter(c => c !== "C").sort((a, b2) => (pool[b2] || 0) - (pool[a] || 0))];
    for (const c of order) { while (gen > 0 && (pool[c] || 0) > 0) { pool[c]--; gen--; took.push(c); } }
    left += gen;
    if (took.length) mutate(p => { took.forEach(c => { p.pool[c] -= 1; if (!p.pool[c]) delete p.pool[c]; }); if (p.pool && !Object.keys(p.pool).length) delete p.pool; if (p.poolHaste > (p.pool?.C || 0)) { if (p.pool?.C) p.poolHaste = p.pool.C; else { delete p.poolHaste; delete p.poolHasteSrc; } } }, true);
    if (label) logTo(code, `${me.name} paid ${pay} for ${label}${took.length ? ` (from the pool: ${took.map(c => `{${c}}`).join("")})` : ""}${left ? ` · ${left} more from another source` : ""}`);
    return { took, left };
  }
  // 💸 casting a spell: take what I can from a tracked mana pool, and ask how each Phyrexian symbol was paid
  // 💚 lifelink on damage that isn't combat (pings, "deals N damage" abilities): you gain that much, which fires "whenever you gain life"
  // a creature of mine dealt damage to an opponent outside combat: "whenever this / enchanted / equipped creature deals damage to an opponent"
  function noncombatHit(srcId, n, victim) {
    const e = srcId && me.bf?.[srcId]; if (!e) return;
    const P = "^(?:[^\\n—]{1,40} — )?whenever ";
    const T = " deals damage to (?:an opponent|a player|one of your opponents)(?: or a planeswalker)?, ([^\\n]+)$";
    const own = String(e.o || lookupCard(e.n)?.o || "").match(new RegExp(P + selfRef(e) + T, "im"));
    if (own) fxRem(dispName(e), srcId, own[1], /\bdraw a card\b/i.test(own[1]) ? { drawN: 1 } : {});
    Object.entries(me.bf || {}).filter(([, a]) => a.att === srcId).forEach(([aid, a]) => { const m = String(a.o || lookupCard(a.n)?.o || "").match(new RegExp(P + "(?:enchanted|equipped) creature" + T, "im")); if (m) fxRem(dispName(a), aid, `${dispName(e)} dealt damage to ${victim}: ${m[1]}`, /\bdraw a card\b/i.test(m[1]) ? { drawN: 1 } : {}); });
    setTimeout(render, 0);
  }
  function lifelinkGain(srcId, n, label) {
    const e = srcId && me.bf?.[srcId]; if (!e || !(n > 0) || me.prot?.life) return;
    if (!kwsOf({ ...e, o: e.o || lookupCard(e.n)?.o }, pid, srcId).some(x => x.k === "lifelink")) return;
    mutate(p => { p.life = (p.life ?? START_LIFE) + n; }); logTo(code, `💚 ${me.name}'s ${label || dispName(e)}: lifelink +${n} life`);
  }
  function payForCast(card, cost) {
    cost = String(cost || "");
    if (me.pool && Object.keys(me.pool).length && cost.replace(/\{[^}]*\/P\}/g, "")) payPool(cost.replace(/\{[^}]*\/P\}/g, ""), dispName(card));
    const phy = cost.match(/\{[^}]*\/P\}/g) || [];
    if (phy.length) reminders.push({ id: newId(), src: dispName(card), times: 1, phyx: phy.join(""),
      text: `Phyrexian mana ${phy.join("")}: pay each with its color or with 2 life. How did you pay?` });
  }
  function poolAdd(syms, why, combat) {
    const add = {}; (String(syms).match(/\{([WUBRGC])\}/g) || []).forEach(x => { const c = x[1]; add[c] = (add[c] || 0) + 1; });
    if (!Object.keys(add).length) return;
    mutate(p => { const k = combat ? "poolC" : "pool"; p[k] ||= {}; Object.entries(add).forEach(([c, n]) => { p[k][c] = (p[k][c] || 0) + n; }); }, true);
    if (why) toast(`🔋 +${Object.entries(add).map(([c, n]) => `${n > 1 ? n : ""}{${c}}`).join(" ")} (${why})`);
  }
  // A step or turn ended: unspent mana goes away unless kept; combat-only mana (firebending) leaves after combat
  function poolStepEnd(leavingCombat, newTurn) {
    if (!me.pool && !me.poolC) return;
    const keep = keepRules();
    const lost = Object.entries(me.pool || {}).filter(([c, n]) => n > 0 && !keep.has(c));
    const kept = Object.entries(me.pool || {}).filter(([c, n]) => n > 0 && keep.has(c));
    const combatGone = leavingCombat || newTurn ? Object.values(me.poolC || {}).reduce((a, n) => a + n, 0) : 0;
    if (!lost.length && !combatGone && !(newTurn && kept.length)) return;
    mutate(p => { lost.forEach(([c]) => delete p.pool[c]); if (p.poolHaste > (p.pool?.C || 0)) { if (p.pool?.C) p.poolHaste = p.pool.C; else { delete p.poolHaste; delete p.poolHasteSrc; } } if (p.pool && !Object.keys(p.pool).length) delete p.pool; if (combatGone) delete p.poolC; if (newTurn && kept.length && p.poolKept == null) p.poolKept = (room?.turnNo || 1) - 1; if (!p.pool) delete p.poolKept; }, true);
    if (lost.length || combatGone) logTo(code, `🔋 ${me.name}'s unspent mana emptied`);
  }
  function poolHtml() {
    const pool = me.pool || {}, pc = me.poolC || {};
    const chips = [...MCOL.filter(c => pool[c] > 0).map(c => `<button class="pool-chip" data-a="pool-spend" data-c="${c}" title="Spend one">${manaHtml(`{${c}}`)}<b>×${pool[c]}</b></button>`),
      ...MCOL.filter(c => pc[c] > 0).map(c => `<button class="pool-chip combat" data-a="pool-spend" data-c="${c}" data-combat="1" title="Until end of combat">${manaHtml(`{${c}}`)}<b>×${pc[c]}</b>⚔</button>`)];
    const keep = keepRules();
    const old = me.poolKept != null && me.poolKept < (room.turnNo || 0) && MCOL.some(c => pool[c] > 0 && keep.has(c));
    return `<span class="pool-label">🔋 Mana</span>${chips.join("") || `<span class="mini muted">empty</span>`}${old ? `<span class="mini pool-old">kept from an earlier turn</span>` : ""}${Math.min(me.poolHaste || 0, pool.C || 0) ? `<span class="mini">⚡ ${Math.min(me.poolHaste, pool.C)} {C} from ${esc(me.poolHasteSrc || "Hall")}: a creature spell paid with it gains haste</span>` : ""}
      <button class="btn small pool-plus ${poolOpen ? "on" : ""}" data-a="pool-open">＋</button>${chips.length ? `<button class="btn small ghost" data-a="pool-clear">Clear</button>` : ""}
      ${poolOpen ? `<div class="pool-add">${MCOL.map(c => `<button class="pool-chip" data-a="pool-add" data-c="${c}">${manaHtml(`{${c}}`)}</button>`).join("")}</div>` : ""}`;
  }
  // Plain mana abilities a permanent has ("{T}: Add {C}{C}", basic land types) → one-tap "tap for mana into the pool"
  function plainMana(e, eid) {
    const o = String(e.o || lookupCard(e.n)?.o || "") + (e.gained?.length ? "\n" + e.gained.join("\n") : "");
    const out = [];
    const condOk = l => { const n = l.match(/[Aa]ctivate only if you control (\w+) or more lands/); if (n) return Object.values(me.bf || {}).filter(x => /\bLand\b/.test(x.t || "")).length >= ({ two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7 }[n[1].toLowerCase()] || Number(n[1]) || 0);
      const c = l.match(/[Aa]ctivate only if you control an? ([A-Z][a-z]+)/); return !c || Object.values(me.bf || {}).some(x => new RegExp(`\\b${c[1]}\\b`).test(x.t || "")); };
    o.split("\n").map(l => condOk(l) ? l.replace(/\s*Activate only if you control an? [A-Z][a-z]+\./, "").replace(/\s*Activate only if you control \w+ or more lands\./, "") : "").forEach(l => { const m = l.replace(/[()]/g, "").trim().match(/^\{T\}: Add ((?:\{[WUBRGC]\})+)(?:, ((?:\{[WUBRGC]\})+),)?( or ((?:\{[WUBRGC]\})+))?\.(?: [^.]*? deals (\d+) damage to you\.| spend this mana only [^.]*\.)?$/i) || l.replace(/[()]/g, "").trim().match(/^\{T\}: Add ((?:\{[WUBRGC]\})+)()()()$/); if (m) { const pain = m[5] ? `!${m[5]}` : ""; out.push(m[1] + pain); if (m[2]) out.push(m[2] + pain); if (m[4]) out.push(m[4] + pain); } });
    if (/\bLand\b/.test(e.t || "")) [["Plains", "W"], ["Island", "U"], ["Swamp", "B"], ["Mountain", "R"], ["Forest", "G"]].forEach(([ty, c]) => { if (new RegExp(`\\b${ty}\\b`).test(e.t) && !out.includes(`{${c}}`)) out.push(`{${c}}`); });
    if (/\bLand\b/.test(e.t || "")) { const all = seated(room).filter(o => !isOut(o)).flatMap(o => Object.values(o.bf || {}).map(x => String(x.o || lookupCard(x.n)?.o || "")));
      all.forEach(t => { const m = t.match(/each land is an? (Forest|Swamp|Island|Mountain|Plains) in addition to its other land types/i); if (m) { const s = `{${({ forest: "G", swamp: "B", island: "U", mountain: "R", plains: "W" })[m[1].toLowerCase()]}}`; if (!out.includes(s)) out.push(s); } });
      if (Object.values(me.bf || {}).some(x => /lands you control are every basic land type in addition to their other types/i.test(x.o || lookupCard(x.n)?.o || "")) && !out.includes("any")) out.push("any"); }
    { const mc = o.match(/^Metalcraft — \{T\}: Add one mana of any color\. Activate only if you control three or more artifacts\.?$/m); if (mc && countTypes(me, ["artifact"]) >= 3) out.push("any"); }
    if (/^\{T\}: Add one mana of any color\b/im.test(o)) out.push("any");
    o.split("\n").forEach(l => { const m = l.match(/^\{T\}, Pay (\d+) life: Add one mana of any color\.?$/i); if (m) out.push(`any~${m[1]}`); });
    o.split("\n").forEach(l => { const m = l.match(/^\{T\}: Add ((?:\{[WUBRGC]\})+)\. Put an? ([a-z]+) counter on [^.]+\.$/i); if (m) out.push(`${m[1]}+c:${m[2].toLowerCase()}`); });
    o.split("\n").forEach(l => { const m = l.match(/^((?:\{[^}T]+\})+), \{T\}: Add (\{[WUBRGC]\}) for each (white |blue |black |red |green )?creature card in your graveyard\./i); if (!m) return;
      const col = m[3] ? { white: "W", blue: "U", black: "B", red: "R", green: "G" }[m[3].trim().toLowerCase()] : null;
      const n = Object.values(me.gy || {}).filter(c => /\bCreature\b/.test(c.t || lookupCard(c.n)?.t || "") && (!col || new RegExp(col).test(c.m || lookupCard(c.n)?.m || ""))).length;
      if (n) out.push(`${m[2].repeat(n)}@${m[1]}`); });
    o.split("\n").forEach(l => { const m = l.match(/^\{T\}, Pay (\d+) life: Add ((?:\{[WUBRGC]\})+)\.( If that mana is spent on a creature spell, it gains haste\.)?/i); if (m) out.push(`${m[2]}~${m[1]}${m[3] ? "^h" : ""}`); });
    { const pc = o.match(/^\{T\}: Add (\{[WUBRGC]\}) for each (\w+) counter on (?:this|it)[^.\n]*\./im); const n = pc ? e.c?.[pc[2].toLowerCase()] || 0 : 0; if (n) out.push(pc[1].repeat(n)); }
    o.split("\n").forEach(l => { const m = l.replace(/\([^)]*\)/g, "").trim().match(/^((?:\{[^}T]+\})+), \{T\}: Add (one mana of any color|(?:\{[WUBRGC]\})+(?:, (?:\{[WUBRGC]\})+)*(?:,? or (?:\{[WUBRGC]\})+)?)\.?$/i); if (m) (/any color/i.test(m[2]) ? ["any"] : m[2].split(/,? or |, /)).forEach(x => out.push(`${x}@${m[1]}`)); });
    // creatures that tap for mana because of other cards
    grantedCreatureMana(false, e.t || lookupCard(e.n)?.t || "", e, eid).forEach(x => out.push(x));
    return [...new Set(out)];
  }
  // Cryptolith Rite / Enduring Vitality ("Creatures you control have …"), Jaheira ("Tokens you control have {T}: Add {G}"), Song of Freyalise chapters I-II
  function grantedCreatureMana(isTok, t, ent, eid) {
    const out = [];
    Object.entries(me.bf || {}).forEach(([aid, a]) => grantedMana({ ...a, o: a.o || lookupCard(a.n)?.o }).forEach(g => {
      const hit = g.who === "permanents" ? !(g.other && (a === ent || (eid && aid === eid))) : g.who === "countered" ? /\bCreature\b/.test(t || "") && Object.values(ent?.c || {}).some(v => v > 0) : / and /.test(g.who) ? g.who.split(" and ").some(w => new RegExp(`\\b${w}`, "i").test(t || "")) : g.who === "tokens" ? isTok : g.who === "creatures" ? /\bCreature\b/.test(t || "") : g.who === "creature tokens" ? isTok && /\bCreature\b/.test(t || "") : new RegExp(`\\b${g.who.replace(/s$/, "")}`, "i").test(t || "");
      if (!hit) return;
      const m = g.text.match(/add ((?:\{[WUBRGC]\})+)/i); out.push(m ? m[1] : /any color/i.test(g.text) ? "any" : null);
    }));
    if (me.tempMana && me.tempMana.until >= (room?.turnNo || 0) && /\bCreature\b/.test(t || "")) out.push("any");
    return out.filter(Boolean);
  }
  // ----- Sagas -----
  const ROMAN = ["", "I", "II", "III", "IV", "V", "VI"];
  function sagaCheck(prev) {
    Object.entries(me.bf || {}).forEach(([id, e]) => {
      const sg = sagaChapters({ ...e, o: e.o || lookupCard(e.n)?.o, t: e.t || lookupCard(e.n)?.t });
      if (!sg) return;
      const was = prev[id] || 0, now = e.c?.lore || 0;
      if (now <= was) return;
      for (let k = was + 1; k <= now; k++) sg.chapters.filter(ch => ch.nums.includes(k)).forEach(ch => runChapter(id, e, ch, k));
      if (was < sg.last && now >= sg.last) Object.entries(me.bf || {}).forEach(([wid, w]) => { // Historian's Boon, Tom Bombadil
        for (const m of String(w.o || lookupCard(w.n)?.o || "").matchAll(/^whenever the final chapter ability of a saga you control (?:resolves|triggers), ([^\n]+)/gim)) {
          const sp = spellAbility({ n: `${w.n} · final chapter`, t: "Instant", o: m[1] });
          reminders.push(normalizeRem({ id: newId(), src: dispName(w), srcId: wid, text: `${dispName(e)}'s final chapter: ${m[1].replace(/^\w/, c => c.toUpperCase())}`, times: 1, ...(sp.effs.length ? { effs: sp.effs } : {}) })); } });
      if (now >= sg.last) setTimeout(() => {
        if (!me.bf?.[id]) return;
        logTo(code, `📜 ${me.name}'s ${dispName(e)}: final chapter done, sacrificed`);
        act([{ type: "sac", name: e.n, n: 1, token: false, creature: false, artifact: false }], p => { const x = p.bf?.[id]; if (!x) return; delete p.bf[id]; toZone(p, x, "gy"); });
      }, 0);
    });
  }
  function runChapter(id, e, ch, k) {
    const gains = ch.text.match(/^this saga gains "(.+)"\.?$/i);
    if (gains) { const ab = gains[1].replace(/'/g, '"'); mutate(p => { const x = p.bf?.[id]; if (x) x.gained = [...(x.gained || []), ab]; }); logTo(code, `📜 ${me.name}'s ${dispName(e)}: chapter ${ROMAN[k] || k} — gains "${gains[1]}"`); render(); return; }
    if (/until your next turn, creatures you control (?:gain|have) "\{T\}: Add one mana of any color\./i.test(ch.text)) mutate(p => { p.tempMana = { src: dispName(e), until: (room.turnNo || 0) + Math.max(1, seated(room).length) - 1 }; }, true);
    const name = `${dispName(e)} (${ROMAN[k] || k})`;
    logTo(code, `📜 ${me.name}'s ${dispName(e)}: chapter ${ROMAN[k] || k}`);
    const sp = spellAbility({ n: `${e.n} · ch${k}`, t: "Sorcery", o: ch.text });
    const effs = sp.auto ? sp.effs : sp.effs.filter(f => ["fetch", "remove", "edict", "regrow", "countersTarget", "countersEach", "pumpTarget", "pumpAll", "untapAll", "untapN", "ping", "gyhate", "copyAllTokens", "tempt", "regen", "impulse"].includes(f.k));
    if (effs.length) act([{ type: "effects", effs, times: 1, count: 1, src: name, srcId: id }]);
    if (!sp.auto) reminders.push({ id: newId(), src: name, text: ch.text, times: 1, ...(effs.length ? { note: "Applied what the app could. Handle the rest yourself." } : {}) });
    render();
  }
  // ----- Mana with strings attached: Delighted Halfling, Path of Ancestry -----
  const NC_RIDER = /spend this mana only to cast (a legendary spell|a creature spell of the chosen type), and that spell can't be countered/i;
  const PATH_RIDER = /when that mana is spent to cast a creature spell that shares a creature type with your commander, scry (\d+)/i;
  function addRider(r) { mutate(p => { p.riders = [...(p.riders || []).filter(x => x.turnNo === (room.turnNo || 0)), { ...r, turnNo: room.turnNo || 0 }]; }, true); }
  const subtypes = t => (String(t || "").split(" — ")[1] || "").split(/\s+/).filter(Boolean);
  function cmdTypes() { return (deck?.cmds || []).flatMap(n => subtypes(lookupCard(n)?.t)); }
  // When I cast: use up a rider that applies to this spell
  // ----- Infinite combos on my board -----
  let combosSeen = new Set();
  function myCombos() { return me && !isOut(me) ? detectCombos(me, n => lookupCard(n), { hand: dig?.on ? [...dig.hand] : [], cast: Object.values(room?.casts || {}).filter(c => c.by === pid && (c.turnNo || 0) === (room?.turnNo || 0) && !c.countered).map(c => c.n) }) : []; }
  function announceCombos() {
    const list = myCombos(), keys = new Set(list.map(c => c.key));
    list.filter(c => !combosSeen.has(c.key)).forEach(c => { logTo(code, `♾ ${me.name} has an infinite combo: ${c.name}${c.win ? " — that wins the game" : ""}`); toast(`♾ Infinite combo: ${c.name}`); });
    combosSeen = keys;
  }
  function comboBox() {
    const list = myCombos();
    if (!list.length) return "";
    return list.map(c => `<div class="reminder combo-box"><div class="rem-src">♾ Infinite combo${c.win ? " · wins" : ""}</div><div><b>${esc(c.name)}</b></div><div class="mini">${esc(c.desc)}</div><div class="row">${
      c.kind === "drainAll" || c.kind === "dmgAll" ? `<button class="btn small primary" data-a="combo-go" data-k="${esc(c.key)}">♾ Run it: every opponent ${c.kind === "dmgAll" ? "takes" : "loses"} lethal</button>`
      : c.kind === "drainOne" ? seated(room).filter(o => o.id !== pid && !isOut(o)).map(o => `<button class="btn small primary" data-a="combo-go" data-k="${esc(c.key)}" data-o="${o.id}" style="border-left:4px solid ${esc(o.color)}">♾ ${esc(o.name)} loses</button>`).join("")
      : c.kind === "mana" ? `<label class="mini">How much? <input type="number" min="1" class="x-input" id="cb-n-${esc(c.key)}" value="20"></label><button class="btn small primary" data-a="combo-go" data-k="${esc(c.key)}">Add {C}</button>`
      : c.kind === "grow" ? `<label class="mini">How many activations? <input type="number" min="1" max="12" class="x-input" id="cb-n-${esc(c.key)}" value="3"></label><button class="btn small primary" data-a="combo-go" data-k="${esc(c.key)}">♾ Activate</button>`
      : c.kind === "castLoop" && c.spell !== "Sensei's Divining Top" ? `<label class="mini">How many loops? <input type="number" min="1" max="99" class="x-input" id="cb-n-${esc(c.key)}" value="10"></label><button class="btn small primary" data-a="combo-go" data-k="${esc(c.key)}">♾ Loop</button>`
      : c.kind === "castLoop" ? `<label class="mini">How many loops? (≤ cards in your library) <input type="number" min="1" max="99" class="x-input" id="cb-n-${esc(c.key)}" value="${c.dmg ? Math.min(99, Math.ceil(Math.max(1, ...opponents().map(o => o.life ?? START_LIFE)) / c.dmg)) : 10}"></label><button class="btn small primary" data-a="combo-go" data-k="${esc(c.key)}">♾ Loop</button>`
      : c.kind === "tokens" ? `<label class="mini">How many loops? <input type="number" min="1" max="999" class="x-input" id="cb-n-${esc(c.key)}" value="20"></label><button class="btn small primary" data-a="combo-go" data-k="${esc(c.key)}">Loop</button>`
      : `<span class="mini">Do the loop by hand as many times as you need.</span>`}</div></div>`).join("");
  }
  function runCombo(c, oid) {
    const n = Math.max(1, Math.min(999, Number(document.getElementById(`cb-n-${c.key}`)?.value) || 20));
    if (c.kind === "grow") { // activate the "create X tokens" ability n times; doublers, Food makers and enter triggers apply each time
      const e = me.bf?.[c.srcId]; if (!e) return;
      const i = activatedAbilities(abCard(e)).findIndex(a => /create x /i.test(a.text || a.label || ""));
      if (i < 0) return;
      const was = orderTriggers; orderTriggers = false;
      try { for (let k = 0; k < Math.min(n, 12); k++) activate(c.srcId, i); } finally { orderTriggers = was; }
      logTo(code, `♾ ${me.name} ran ${c.name}: ${Math.min(n, 12)} activations (tap the new ${c.typ}s for the mana)`);
      render(); return;
    }
    if (c.kind === "castLoop") { runCastLoop(c, Math.min(n, 99)); return; }
    if (c.kind === "drainAll" || c.kind === "dmgAll" || c.kind === "drainOne") {
      const opps = seated(room).filter(o => o.id !== pid && !isOut(o) && (!oid || o.id === oid));
      if (!opps.length || !confirm(`${c.name}: ${opps.map(o => o.name).join(", ")} ${c.kind === "dmgAll" ? "take" : "lose"} enough to die?`)) return;
      const total = opps.reduce((a, o) => a + Math.max(1, o.life ?? START_LIFE), 0);
      logTo(code, `♾ ${me.name} runs ${c.name}`);
      act([{ type: "effects", effs: [...opps.map(o => ({ k: "tlose", n: Math.max(1, o.life ?? START_LIFE), target: o.id, targetName: o.name })), ...(c.kind !== "dmgAll" || /Heliod/.test(c.name) ? [{ k: "gain", n: total }] : [])], times: 1, count: 1, src: `♾ ${c.name}` }]);
      return;
    }
    if (c.kind === "mana") { poolAdd("{C}".repeat(n), `♾ ${c.name}`); logTo(code, `♾ ${me.name} made ${n} colorless mana (${c.name})`); render(); return; }
    if (c.kind === "tokens" && c.tokenOf) { act([{ type: "create", name: c.tokenOf, n, desc: `copy of ${c.tokenOf}, with haste (Kiki-Jiki)`, src: `♾ ${c.name}` }]); logTo(code, `♾ ${me.name} made ${n} hasty ${c.tokenOf} tokens (${c.name})`); return; }
    if (c.kind === "tokens") { // sacrifice loop with no drain: tally the death triggers and treasures
      const mana = Object.values(me.bf || {}).some(e => /^sacrifice a creature: add \{C\}\{C\}/im.test(e.o || lookupCard(e.n)?.o || ""));
      const treas = Object.values(me.bf || {}).some(e => /whenever another creature you control dies, create a treasure/i.test(e.o || lookupCard(e.n)?.o || ""));
      const sqK = Object.keys(me.tokens || {}).find(k => isCreatureToken(me.tokens[k].name) && /squirrel/i.test(me.tokens[k].name)) || Object.keys(me.tokens || {}).find(k => isCreatureToken(me.tokens[k].name));
      act([{ type: "sac", name: sqK ? me.tokens[sqK].name : "creature", n, token: true, creature: true }, { type: "dies", n, token: true }], null, p => { // the sacrificed tokens were replaced one by one
        const nm = sqK && me.tokens?.[sqK]?.name; let left = n;
        if (nm) Object.keys(p.tokens || {}).filter(k => p.tokens[k].name === nm).forEach(k => { const t = p.tokens[k], d = Math.min(left, t.count); t.count -= d; left -= d; if (t.tapped > t.count) t.tapped = t.count; if (t.count <= 0) delete p.tokens[k]; });
      });
      if (mana) poolAdd("{C}{C}".repeat(n), `♾ ${c.name}`);
      logTo(code, `♾ ${me.name} looped ${c.name} ×${n}${treas ? ` (+${n} Treasure)` : ""}${mana ? ` (+${2 * n} {C})` : ""}`);
      render(); return;
    }
  }
  // Elsha + Top: n real casts of the spell — every cast trigger, prowess and token, one at a time
  function runCastLoop(c, n) {
    const card = deckCard(c.spell) || lookupCard(c.spell);
    if (!card) return;
    const was = orderTriggers; orderTriggers = false;
    const before = new Set(reminders.map(r => r.id));
    try {
      for (let i = 0; i < n; i++) {
        broadcastCast(card); prowess(card);
        act([{ type: "cast", card, prior: [] }]);
        if (c.fuelSac) { // the token that paid for this loop
          const ks = Object.entries(me.tokens || {}).filter(([, t]) => t.count > 0 && t.name.toLowerCase() === c.fuelSac.toLowerCase()).sort((a, b) => (a[1].ep?.length || 0) - (b[1].ep?.length || 0));
          if (ks.length) { const [k, t] = ks[0]; act([{ type: "sac", name: t.name, n: 1, token: true, creature: true }, { type: "dies", n: 1, token: true }], p => { const x = p.tokens?.[k]; if (!x) return; x.count -= 1; if ((x.tapped || 0) > x.count) x.tapped = x.count; if (x.count <= 0) delete p.tokens[k]; }); }
        }
      }
    } finally { orderTriggers = was; }
    const seen = new Map(); // the same trigger n times reads as one reminder ×n
    reminders.filter(r => !before.has(r.id)).forEach(r => { const k = `${r.src}|${r.text}`, f = seen.get(k); if (f && !r.effs?.length && !f.effs?.length) { f.times = (f.times || 1) + (r.times || 1); r._drop = true; } else seen.set(k, r); });
    reminders = reminders.filter(r => !r._drop); seen.forEach(r => normalizeRem(r));
    if (c.spell === "Sensei's Divining Top") reminders.push(normalizeRem({ id: newId(), src: `♾ ${c.name}`, text: `Draw ${n === 1 ? "a card" : n + " cards"} (tapping ${c.spell} each loop). It ends on top of your library.`, times: 1, drawN: n }));
    logTo(code, `♾ ${me.name} looped ${c.name} ×${n}`);
    render();
  }
  function useRiders(card) {
    const hh = Math.min(me.poolHaste || 0, me.pool?.C || 0);
    if (hh > 0 && /\bCreature\b/.test(card.t || "") && confirm(`Spend ${me.poolHasteSrc || "Hall of the Bandit Lord"}'s {C} on ${dispName(card)}? It gains haste.`)) {
      const src = me.poolHasteSrc || "Hall of the Bandit Lord";
      mutate(p => { p.poolHaste = hh - 1; if (!p.poolHaste) { delete p.poolHaste; delete p.poolHasteSrc; } if (p.pool?.C) { p.pool.C -= 1; if (!p.pool.C) delete p.pool.C; if (!Object.keys(p.pool).length) delete p.pool; } }, true);
      castHasteNow = src;
    }
    const live = (me.riders || []).filter(x => x.turnNo === (room?.turnNo || 0));
    const out = {}, used = [];
    if (castHasteNow) { out.haste = castHasteNow; castHasteNow = null; }
    if (!live.length) return out;
    const nc = live.find(x => x.kind === "nc" && (x.ctype ? /\bCreature\b/.test(card.t || "") && subtypes(card.t).includes(x.ctype) : /\bLegendary\b/.test(card.t || "")));
    if (nc) { out.nc = nc.src; used.push(nc); }
    const cpn = live.find(x => x.kind === "copyNext" && new RegExp(`\\b${x.ctype}\\b`, "i").test(card.t || ""));
    if (cpn) { used.push(cpn); lastKicked = false; setTimeout(() => { logTo(code, `⚙ ${cpn.src}: copying ${dispName(card)}`); playCard(card, { copy: true, kicked: lastKicked }); }, 50); }

    const ct = cmdTypes(), shares = /\bCreature\b/.test(card.t || "") && (subtypes(card.t).some(x => ct.includes(x)) || (ct.length > 0 && isChangeling(card)));
    const path = shares && live.find(x => x.kind === "path");
    if (path) { used.push(path); reminders.push({ id: newId(), src: path.src, text: `Scry ${path.n}.`, times: 1, note: `${dispName(card)} shares a creature type with your commander.` }); }
    if (used.length) mutate(p => { p.riders = (p.riders || []).filter(x => !used.some(u => u.at === x.at)); if (!p.riders.length) delete p.riders; }, true);
    return out;
  }
  // Cryptolith Rite / Jaheira: how many of my creatures and tokens can tap for mana right now
  function manaCrew() {
    const grants = Object.values(me.bf || {}).flatMap(a => grantedMana({ ...a, o: a.o || lookupCard(a.n)?.o }).map(g => ({ ...g, src: dispName(a) })));
    if (!grants.length) return null;
    const covered = (isTok, t) => grants.some(g => g.who === "permanents" ? isTok || /\bCreature\b/.test(t) : g.who === "tokens" ? isTok : g.who === "creatures" ? /\bCreature\b/.test(t) : g.who === "creature tokens" ? isTok && /\bCreature\b/.test(t) : new RegExp(`\\b${g.who.replace(/s$/, "")}`, "i").test(t));
    let ready = 0, sick = 0;
    Object.entries(me.bf || {}).forEach(([id, e]) => {
      if (!covered(false, e.t || "") || e.tap) return;
      if (isSick({ ...e, o: e.o || lookupCard(e.n)?.o }, meOwner(), id)) sick++; else ready++;
    });
    Object.entries(me.tokens || {}).forEach(([k, t]) => {
      const tp = tokenPerm(t).t;
      if (!covered(true, tp)) return;
      const free = t.count - (t.tapped || 0);
      const sk = /\bCreature\b/.test(tp) ? Math.min(free, sickTokens(t, meOwner(), k)) : 0;
      sick += sk; ready += free - sk;
    });
    return { ready, sick, srcs: [...new Set(grants.map(g => g.src))] };
  }
  // "If you do, draw a card": the part the app can't do itself stays as a reminder
  function thenLeftover(r) {
    const t = r.sacThen.thenText.trim().replace(/^\w/, c => c.toUpperCase());
    if (!r.sacThen.then.length || /\b(draw|scry|surveil|discard|look at)\b/i.test(t)) reminders.push({ id: newId(), src: r.src, text: t, times: 1 });
  }
  // Convoke: tap untapped creatures to help pay
  function convokeBox(r) {
    const cards = Object.entries(me.bf || {}).filter(([, e]) => /\bCreature\b/.test(e.t || "") && !e.tap);
    const toks = Object.entries(me.tokens || {}).filter(([, t]) => isCreatureToken(t.name) && t.count - (t.tapped || 0) > 0);
    if (!cards.length && !toks.length) return `<span class="mini">No untapped creatures.</span>`;
    return `<div class="ans-list">${cards.map(([id, e]) => `<label class="mode-check"><input type="checkbox" class="cv-box" data-rid="${r.id}" value="${id}"><span>${esc(dispName(e))}</span></label>`).join("")}
      ${toks.map(([k, t]) => `<label class="mini">${esc(t.name)} <input type="number" min="0" max="${t.count - (t.tapped || 0)}" class="x-input cv-tok" data-rid="${r.id}" data-k="${esc(k)}" value="0"> / ${t.count - (t.tapped || 0)}</label>`).join("")}</div>
      <button class="btn small primary" data-a="convoke-go" data-id="${r.id}">Tap them to convoke</button>`;
  }
  // Forage: exile three cards from your graveyard, or sacrifice a Food
  function forageBox(r) {
    const food = Object.values(me.tokens || {}).some(t => t.name === "Food" && t.count > 0);
    const gy = Object.entries(me.gy || {});
    return `${food ? `<button class="btn small primary" data-a="forage-food" data-id="${r.id}">🍖 Sacrifice a Food</button>` : ""}
      ${gy.length >= 3 ? `<span class="mini">or exile 3:</span>${[0, 1, 2].map(j => `<select class="fetch-pick fg-pick" data-rid="${r.id}">${gy.map(([g, c], i) => `<option value="${g}" ${i === j ? "selected" : ""}>${esc(dispName(c))}</option>`).join("")}</select>`).join("")}<button class="btn small" data-a="forage-gy" data-id="${r.id}">Exile these 3</button>` : ""}
      ${!food && gy.length < 3 ? `<span class="mini">You can't forage: no Food and fewer than 3 cards in your graveyard.</span>` : ""}`;
  }
  // A chosen sacrifice ("tok:<key>" or "bf:<id>"): its events, the board change and a label
  function sacPrep(v) {
    if (v.startsWith("tok:")) {
      const k = v.slice(4), t = me.tokens?.[k];
      if (!t) return null;
      const cre = isCreatureToken(t.name);
      return { label: `a ${t.name} token`, events: [{ type: "sac", name: t.name, n: 1, token: true, creature: cre }, ...(cre ? [{ type: "dies", n: 1, token: true }] : [])],
        apply: p => { const x = p.tokens?.[k]; if (!x) return; x.count -= 1; if (x.tapped > x.count) x.tapped = x.count; if (x.count <= 0) delete p.tokens[k]; } };
    }
    const id = v.slice(3), e = me.bf?.[id];
    if (!e) return null;
    const cre = /\bCreature\b/.test(e.t || "");
    return { label: dispName(e), events: [{ type: "sac", name: e.n, n: 1, token: false, creature: cre, artifact: /\bArtifact\b/.test(e.t || "") }, ...(cre ? [{ type: "dies", n: 1, token: false, ids: [id] }] : [])],
      apply: p => { const x = p.bf?.[id]; if (!x) return; delete p.bf[id]; toZone(p, x, "gy"); } };
  }
  // Selfless Squire: "Whenever damage that would be dealt to you is prevented, put that many +1/+1 counters on this creature"
  function squirePrevented(n, why) {
    if (!(n > 0) || !me) return;
    Object.entries(me.bf || {}).filter(([, x]) => SQUIRE_RE.test(x.o || lookupCard(x.n)?.o || "")).forEach(([id, x]) =>
      act([{ type: "effects", effs: [{ k: "countersOn", target: { kind: "bf", id }, n, key: "p1p1", label: "+1/+1" }], times: 1, count: 1, src: `${dispName(x)} (${n} damage prevented${why ? `: ${why}` : ""})`, srcId: id }]));
  }
  // Willbreaker: "Whenever a creature an opponent controls becomes the target of a spell or ability you control, gain control of that creature …"
  function willbreakerTargeted(oid, id, via) {
    if (!me || oid === pid) return;
    const tgt = room?.players?.[oid]?.bf?.[id];
    if (!tgt || !/\bCreature\b/.test(tgt.t || "")) return;
    Object.values(me.bf || {}).filter(x => WILLB_RE.test(x.o || lookupCard(x.n)?.o || "")).forEach(x => {
      if (reminders.some(r => r.wbk?.id === id && r.src === dispName(x))) return;
      reminders.push({ id: newId(), src: dispName(x), text: `${room.players[oid].name}'s ${dispName(tgt)} became the target of your ${via || "spell or ability"}: gain control of it for as long as you control ${dispName(x)}.`, times: 1, wbk: { oid, id } });
    });
    setTimeout(render, 0);
  }
  // A counter added by hand with +: if something would trigger, ask whether a spell or ability put it there
  function counterAsk(id, k, d) {
    const e = me?.bf?.[id];
    if (!e || !(d > 0)) return;
    const test = clone(me), te = test.bf?.[id]; if (!te) return;
    te.c ||= {}; te.c[k] = Math.max(0, (te.c[k] || 0) - d); if (!te.c[k]) delete te.c[k];
    const ctx = { logs: [], remind: [], drain: 0, who: me.name };
    try { runEvents(test, [{ type: "effects", effs: [{ k: "countersOn", target: { kind: "bf", id }, n: d, key: k, label: counterLabel(k) }], times: 1, count: 1, src: "?" }], ctx, { enabled: true, lookup: lookupCard, env: boardEnv(), turnNo: room?.turnNo || 0 }); } catch (err) { return; }
    const names = new Set([...ctx.remind.map(r => r.src), ...ctx.logs.slice(1).map(l => (l.match(/^\W*([^:]+):/) || [])[1]).filter(Boolean)].filter(x => x && x !== "?"));
    Object.values(me.bf || {}).forEach(x => { if (/whenever you put one or more counters on a permanent or player/i.test(x.o || lookupCard(x.n)?.o || "")) names.add(dispName(x)); });
    if (!names.size) return;
    const have = reminders.find(r => r.ctrAsk?.id === id && r.ctrAsk.k === k);
    const r = have || { id: newId(), src: dispName(e), times: 1, ctrAsk: { id, k, n: 0 } };
    r.ctrAsk.n += d; r.ctrAsk.names = [...names];
    r.text = `You added ${r.ctrAsk.n} ${counterLabel(k)} counter${r.ctrAsk.n === 1 ? "" : "s"} by hand. That triggers ${[...names].join(", ")}. Did a spell or ability put ${r.ctrAsk.n === 1 ? "it" : "them"} there?`;
    if (!have) reminders.push(r);
    render();
  }
  // I put counters on something (a picked target): Generous Patron / Kros (a creature I don't control), All Will Be One (any permanent or player)
  function counterPutTriggers(list) {
    if (!me || !list?.length) return;
    Object.values(me.bf || {}).forEach(x => { const t = String(x.o || lookupCard(x.n)?.o || "");
      const opp = t.match(/^(?:[^—\n]{1,40} — )?whenever you put one or more counters on a creature you don't control, ([^\n]+)$/im);
      if (opp) list.filter(l => l.oid !== pid && l.n > 0).forEach(() => reminders.push(normalizeRem({ id: newId(), src: dispName(x), text: opp[1][0].toUpperCase() + opp[1].slice(1), times: 1, ...(/^draw a card\.?$/i.test(opp[1]) ? { drawN: 1 } : {}) })));
      const any = t.match(/^(?:[^—\n]{1,40} — )?whenever you put one or more counters on a permanent or player, this [a-z]+ deals that much damage to ([^\n]+?)\.?$/im);
      if (any) list.filter(l => l.n > 0).forEach(l => reminders.push(normalizeRem({ id: newId(), src: dispName(x), text: `Deal ${l.n} damage to ${any[1]}.`, times: 1, effs: [{ k: "ping", n: l.n }] })));
    });
    setTimeout(render, 0);
  }
  // One of my sources dealt damage to an opponent (combat or a ping): War Elemental, Quest for Pure Flame, The Red Terror
  function dmgToOpp(n, srcCard, srcLabel, victim) {
    if (!(n > 0) || !me) return;
    const red = /\{[^}]*R[^}]*\}/.test(srcCard?.m || "") || /\bred\b/i.test(srcCard?.desc || "");
    Object.entries(me.bf || {}).forEach(([id, x]) => { const t = String(x.o || lookupCard(x.n)?.o || "");
      if (/^(?:[^—\n]{1,40} — )?whenever an opponent is dealt damage, put that many \+1\/\+1 counters/im.test(t)) warCredit[victim] = (warCredit[victim] || 0) + n;
      if (/^(?:[^—\n]{1,40} — )?whenever an opponent is dealt damage, put that many \+1\/\+1 counters on (?:this creature|[^.]+)\.?$/im.test(t)) { setTimeout(() => act([{ type: "effects", effs: [{ k: "countersOn", target: { kind: "bf", id }, n: n, key: "p1p1", label: "+1/+1" }], times: 1, count: 1, src: dispName(x), srcId: id }]), 0); logTo(code, `⚙ ${me.name}'s ${dispName(x)}: ${victim} was dealt ${n} damage (${srcLabel}) → +${n} +1/+1 counter${n === 1 ? "" : "s"}`); }
      if (/^(?:[^—\n]{1,40} — )?whenever a source you control deals damage to an opponent, you may put a (\w+) counter on this [a-z]+\.?$/im.test(t)) { const k = t.match(/^(?:[^—\n]{1,40} — )?whenever a source you control deals damage to an opponent, you may put a (\w+) counter/im)[1].toLowerCase(); mutate(p => { const e = p.bf?.[id]; if (e) { e.c ||= {}; e.c[k] = (e.c[k] || 0) + 1; } }); logTo(code, `⚙ ${me.name}'s ${dispName(x)}: ${srcLabel} damaged ${victim} → +1 ${k} counter`); }
      if (red && /^(?:[^—\n]{1,40} — )?whenever a red source you control deals damage to one or more permanents and\/or players, put a \+1\/\+1 counter on [^.]+\.?$/im.test(t)) { setTimeout(() => act([{ type: "effects", effs: [{ k: "countersOn", target: { kind: "bf", id }, n: 1, key: "p1p1", label: "+1/+1" }], times: 1, count: 1, src: dispName(x), srcId: id }]), 0); logTo(code, `⚙ ${me.name}'s ${dispName(x)}: red source ${srcLabel} dealt damage → +1 +1/+1 counter`); }
    });
  }
  // My creature dealt combat damage to a player: its "whenever … deals combat damage to a player" triggers
  function combatHit(o) {
    dmgToOpp((o.dmg || 0) * Math.max(1, o.times || 1), lookupCard(o.cardN) || Object.values(me.bf || {}).find(e => e.n === o.cardN) || Object.values(me.tokens || {}).find(t => t.name === o.cardN), o.src, o.victim);
    if ((deck?.cmds || []).includes(o.cardN) && !seated(room).some(x => x.effects?.monarch)) Object.values(me.bf || {}).filter(x => /when your commander deals combat damage to a player, if there is no monarch, you become the monarch/i.test(x.o || lookupCard(x.n)?.o || "")).slice(0, 1).forEach(x => { reminders.push({ id: newId(), src: dispName(x), text: "Your commander hit a player and there's no monarch: you become the monarch.", times: 1, becomeMon: true }); setTimeout(render, 0); });
    if (Object.values(me.bf || {}).some(x => x.n === o.cardN && x.belloT === (room?.turnNo || 0))) { reminders.push({ id: newId(), src: `${o.src} (Bello)`, text: "Draw a card.", times: 1, drawN: 1 }); setTimeout(render, 0); }
    prepWatch = prepWatch.filter(w => w.turn === (room.turnNo || 0));
    prepWatch.filter(w => w.name === o.cardN && me.bf?.[w.srcId] && !me.bf[w.srcId].prepared).forEach(w => { mutate(p => { if (p.bf?.[w.srcId]) p.bf[w.srcId].prepared = true; }); logTo(code, `🔮 ${me.name}'s ${dispName(me.bf[w.srcId])} is prepared (${o.src} hit ${o.victim})`); });
    const card = lookupCard(o.cardN) || Object.values(me.bf || {}).find(e => e.n === o.cardN);
    const ll = Object.entries(me.bf || {}).find(([id, e]) => e.n === o.cardN && kwsOf({ ...e, o: e.o || lookupCard(e.n)?.o }, pid, id).some(x => x.k === "lifelink"));
    const llTok = !ll && Object.entries(me.tokens || {}).find(([k, t]) => o.cardN === t.name && kwsOf(tokenPerm(t), pid, k, true).some(x => x.k === "lifelink"));
    if ((ll || llTok) && o.dmg > 0 && !me.prot?.life) { const g = o.dmg * Math.max(1, o.times || 1); mutate(p => { p.life = (p.life ?? START_LIFE) + g; }); logTo(code, `💚 ${me.name}'s ${o.src}: lifelink +${g} life`); }
    const big = card ? bigHitTriggers({ ...card, o: card.o || lookupCard(card.n)?.o }).filter(h => (o.dmg || 0) >= h.min).map(h => h.text) : [];
    const hitT = String(card?.t || Object.values(me.tokens || {}).find(t => t.name === o.cardN) && `Token Creature — ${o.cardN}` || "");
    const anyMine = Object.values(me.bf || {}).flatMap(x => String(x.o || lookupCard(x.n)?.o || "").split("\n").map(l => l.trim().match(/^whenever an? (nontoken |historic |artifact |legendary )?([A-Z][a-z]+|creature) you control deals combat damage to a player(?: or battle)?, (.+)$/i)).filter(m => m && !(/nontoken/i.test(m[1] || "") && /\bToken\b/.test(hitT)) && (!/historic/i.test(m[1] || "") || /\b(Legendary|Artifact|Saga)\b/.test(hitT)) && (!/artifact/i.test(m[1] || "") || /\bArtifact\b/.test(hitT)) && (!/legendary/i.test(m[1] || "") || /\bLegendary\b/.test(hitT)) && (/^creature$/i.test(m[2]) || new RegExp(`\\b${m[2]}\\b`, "i").test(hitT))).map(m => ({ text: m[3].replace(/create that many /i, `create ${o.dmg || 1} `), src: dispName(x) })));
    { const key = `${room.turnNo || 0}:${o.victim || ""}`; Object.values(me.bf || {}).forEach(x => { const m0 = String(x.o || lookupCard(x.n)?.o || "").match(/^whenever one or more (?:[a-z-]+ )?(creatures|[A-Z][a-z]+?)s? you control deal combat damage to a player, (.+)$/im), m = m0 && (m0[1] === "creature" || m0[1] === "creatures" || (/^outlaw$/i.test(m0[1]) ? /\b(Assassin|Mercenary|Pirate|Rogue|Warlock)\b/.test(hitT) : new RegExp(`\\b${m0[1]}`, "i").test(hitT))) ? [m0[0], m0[2]] : null; if (m && !(hitOnce[dispName(x)] || []).includes(key)) { hitOnce[dispName(x)] = [...(hitOnce[dispName(x)] || []), key]; anyMine.push({ text: m[1], src: dispName(x) }); } }); }
    { const hid = Object.entries(me.bf || {}).find(([, e]) => e.n === o.cardN)?.[0]; if (hid) Object.values(me.bf || {}).filter(a => a.att === hid).forEach(a => { const m = String(a.o || lookupCard(a.n)?.o || "").match(/^(?:[^—\n]{1,40} — )?(?:whenever|when) (?:enchanted|equipped) creature deals (?:combat )?damage to (?:an opponent|a player), (.+)$/im); if (m) anyMine.push({ text: m[1], src: `${dispName(a)} (${o.src})` }); }); }
    // qualified hitters: "a modified creature / creature token / enchanted / equipped creature you control", "… with a +1/+1 counter on it", "your commander"
    { const hid = Object.entries(me.bf || {}).find(([, e]) => e.n === o.cardN)?.[0], he = hid && me.bf[hid], isTok = !hid && Object.values(me.tokens || {}).some(t => t.name === o.cardN);
      const att = hid ? Object.values(me.bf || {}).filter(a => a.att === hid) : [], ctr = he ? Object.values(he.c || {}).some(v => v > 0) : false;
      const ok = q => { q = q.toLowerCase(); return q === "modified creature" ? (ctr || att.length > 0) : q === "creature token" ? isTok : q === "enchanted creature" ? att.some(a => /\bAura\b/.test(a.t || "")) : q === "equipped creature" ? att.some(a => /\bEquipment\b/.test(a.t || "")) : q === "commander" ? (deck?.cmds || []).includes(o.cardN) : q === "p1p1" ? (he?.c?.p1p1 || 0) > 0 : false; };
      Object.values(me.bf || {}).forEach(x => String(x.o || lookupCard(x.n)?.o || "").split("\n").forEach(l => { const t = l.trim().replace(/^[^—:{}]{1,60} — /, "");
        let m = t.match(/^whenever (?:a |an )?(modified creature|creature token|enchanted creature|equipped creature) you control deals combat damage to (?:a player|an opponent), (.+)$/i), q = m?.[1], fx = m?.[2];
        if (!m) { m = t.match(/^whenever (?:a |an )?creature you control with a \+1\/\+1 counter on it deals combat damage to (?:a player|an opponent), (.+)$/i); if (m) { q = "p1p1"; fx = m[1]; } }
        if (!m) { m = t.match(/^whenever (?:your commander|a commander you control) deals combat damage to (?:a player|an opponent), (.+)$/i); if (m) { q = "commander"; fx = m[1]; } }
        if (m && ok(q)) anyMine.push({ text: fx.replace(/\bthat creature\b/i, o.src), src: dispName(x) }); })); }
    // Kutzil, Malamet Exemplar: "Whenever one or more creatures you control each with power greater than its base power deals combat damage to a player, …"
    { const key = `${room.turnNo || 0}:${o.victim || ""}`, hid = Object.entries(me.bf || {}).find(([, e]) => e.n === o.cardN)?.[0], he = hid && me.bf[hid];
      const base = he ? Number(lookupCard(he.n)?.p ?? he.p) : NaN, now = he ? Number(ptOf(he, countsFor(me), pid, hid).split("/")[0]) : NaN;
      if (he && now > base) Object.values(me.bf || {}).forEach(x => { const m = String(x.o || lookupCard(x.n)?.o || "").match(/^whenever one or more creatures you control each with power greater than its base power deals? combat damage to a player, (.+)$/im); if (m && !(hitOnce[dispName(x)] || []).includes(key)) { hitOnce[dispName(x)] = [...(hitOnce[dispName(x)] || []), key]; anyMine.push({ text: m[1], src: dispName(x) }); } }); }
    const texts = [...(card ? hitTriggers({ ...card, o: card.o || lookupCard(card.n)?.o }) : []), ...big, ...anyMine];
    if (!texts.length) return;
    const o0 = o;
    texts.forEach(item => { const text = item.text ?? item, o = item.src ? { ...o0, src: item.src } : o0; // an Aura's / Equipment's trigger is labeled with its own name
      const times = Math.max(1, o.times || 1);
      if (/you get that many additional upkeep steps after this phase/i.test(text)) { const n = (o.dmg || 1) * times; reminders.push({ id: newId(), src: o.src, text: `${o.dmg || "?"} combat damage: you get ${n} additional upkeep step${n === 1 ? "" : "s"} after this phase.`, times: 1, extraUp: n }); setTimeout(render, 0); return; }
      if (/roll a d20\. you create a number of treasure tokens equal to the result/i.test(text)) { for (let i = 0; i < times; i++) reminders.push({ id: newId(), src: o.src, text: "Roll a d20. You create a number of Treasure tokens equal to the result.", times: 1 }); setTimeout(render, 0); return; }
      if (/^put a \+1\/\+1 counter on (?:that creature|it)\.?$/i.test(text.trim())) { const hid = Object.entries(me.bf || {}).find(([, e]) => e.n === o.cardN)?.[0], tk = !hid && Object.entries(me.tokens || {}).find(([, t]) => t.name === o.cardN)?.[0];
        if (hid || tk) { mutate(p => { const x = hid ? p.bf?.[hid] : p.tokens?.[tk]; if (x) { x.c ||= {}; x.c.p1p1 = (x.c.p1p1 || 0) + 1; } }); logTo(code, `⚔ ${o.src}: +1/+1 counter (dealt combat damage)`); return; } }
      logTo(code, `⚔ ${me.name}'s ${o0.src} dealt combat damage to ${o.victim}${item.src ? ` (${item.src})` : ""}: ${text.replace(/\.$/, "")}${times > 1 ? ` (×${times})` : ""}`);
      const sp = spellAbility({ n: `${o.cardN} · combat damage · ${text.slice(0, 60)}`, t: "Instant", o: text });
      const effs = sp.auto ? sp.effs : sp.effs.filter(f => ["fetch", "remove", "edict", "regrow", "countersTarget", "countersEach", "pumpTarget", "pumpAll", "untapAll", "untapN", "ping", "gyhate", "tempt", "tgain", "gyOne", "impulse"].includes(f.k));
      if (effs.length) act([{ type: "effects", effs, times, count: times, src: o.src }]);
      if (!sp.auto && !effs.length) reminders.push({ id: newId(), src: o.src, text, times });
    });
    render();
  }
  // Myriad: tapped, attacking token copies for each other opponent (exiled at end of combat)
  function myriadAttack(m) {
    const card = lookupCard(m.name) || Object.values(me.bf || {}).find(e => e.n === m.name) || { n: m.name };
    const pt = card.p != null ? `${card.p}/${card.tg}` : "1/1";
    const sub = (String(card.t || "").split(" — ")[1] || "").trim();
    const before = Object.values(me.tokens || {}).filter(t => t.name === m.name && t.myr).reduce((a, t) => a + t.count, 0);
    act([{ type: "create", name: m.name, n: m.n * m.others.length, desc: `${pt} copy of ${m.name}${sub ? ` (${sub})` : ""}`, tapped: true, src: `${m.name} (myriad)` }],
      null, p => { Object.values(p.tokens || {}).forEach(t => { if (t.name === m.name) { t.myr = true; t.tl = card.t || "Creature"; } }); tidyTokenStacks(p); });
    setTimeout(() => {
      const made = Object.values(me.tokens || {}).filter(t => t.name === m.name && t.myr).reduce((a, t) => a + t.count, 0) - before;
      const each = Math.max(1, Math.floor(made / m.others.length));
      const k = Object.keys(me.tokens || {}).find(x => me.tokens[x].name === m.name && me.tokens[x].myr);
      const per = k ? Number(String(tokPTfx(me.tokens[k], pid, k) || pt).split("/")[0]) || 0 : Number(pt.split("/")[0]) || 0;
      m.others.forEach(oid => {
        sendNote(oid, { kind: "hit", text: `${each} ${m.name} cop${each === 1 ? "y" : "ies"} (myriad) attack you for ${per * each}.`, src: `${m.name} (myriad ×${each})`, power: per * each, cardN: m.name, fromId: pid, ...(each > 1 ? { times: each } : {}) });
        logTo(code, `⚔ ${me.name}'s ${each} ${m.name} cop${each === 1 ? "y" : "ies"} (myriad) attack ${room.players?.[oid]?.name}`);
      });
      if (room.turn === pid && stepOf(room) < 3) update(ref(db, `rooms/${code}`), { step: { turnNo: room.turnNo || 0, i: 3 } });
      render();
    }, 0);
  }
  // Tokens made "sacrifice it at the beginning of the next end step" (The Fire Crystal, Kiki-style copies)
  // "At the beginning of the end step, sacrifice Underworld Breach"
  function sacEndSelf() {
    const list = Object.entries(me.bf || {}).filter(([, e]) => { if (e.sacNext) return true; const o = e.o || lookupCard(e.n)?.o || ""; const short = e.n.split(",")[0]; return new RegExp(`^at the beginning of the end step, sacrifice (?:this [a-z]+|${short.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})\\.?$`, "im").test(o); });
    if (!list.length) return;
    logTo(code, `${me.name} sacrificed ${list.map(([, e]) => dispName(e)).join(", ")} (end step)`);
    list.filter(([, e]) => e.blitz).forEach(([id, e]) => reminders.push({ id: newId(), src: `${dispName(e)} (blitz)`, text: "Draw a card.", times: 1 }));
    act(list.map(([, e]) => ({ type: "sac", name: e.n, n: 1, token: false, creature: /\bCreature\b/.test(e.t || "") })), null, p => list.forEach(([id]) => { const x = p.bf?.[id]; if (!x) return; delete p.bf[id]; toZone(p, x, "gy"); }));
  }
  // Any end step: Norin-style "return at the beginning of the next end step"; my end step: warped permanents get exiled
  function endStepHooks(mine) {
    if (mine && me.effects?.monarch) { reminders.push({ id: newId(), src: "👑 Monarch", text: "Draw a card.", times: 1 }); setTimeout(render, 0);
      const arch = seated(room).filter(o => !isOut(o)).flatMap(o => Object.values(o.bf || {}).filter(x => /at the beginning of the monarch's end step, that player draws a card/i.test(x.o || lookupCard(x.n)?.o || "")).map(x => `${o.id === pid ? "" : `${o.name}'s `}${dispName(x)}`));
      arch.forEach(src => reminders.push({ id: newId(), src, text: "You're the monarch: draw a card.", times: 1, drawN: 1 })); }
    const back = Object.entries(me.ex || {}).filter(([, x]) => x.retEnd);
    const warped = mine ? Object.entries(me.bf || {}).filter(([, e]) => e.warp != null) : [];
    const dashed = mine ? Object.entries(me.bf || {}).filter(([, e]) => e.dash) : [];
    if (dashed.length) { act([], p => dashed.forEach(([id]) => { if (p.bf?.[id]) { detachIn(p, id); delete p.bf[id]; } })); dashed.forEach(([, e]) => logTo(code, `↩ ${me.name}'s ${dispName(e)} (dash) returned to hand`)); toDigHand(dashed.map(([, e]) => e)); }
    if (mine && room.extraTurn?.taken && room.extraTurn.pid === pid && room.extraTurn.turnNo === (room.turnNo || 0) && room.extraTurn.lose)
      reminders.push({ id: newId(), src: room.extraTurn.src, text: "End step of the extra turn: you lose the game.", times: 1, loseFx: "you" });
    if (!back.length && !warped.length) return;
    act([], p => {
      back.forEach(([id]) => delete p.ex?.[id]);
      warped.forEach(([id, e]) => { if (!p.bf?.[id]) return; detachIn(p, id); delete p.bf[id]; p.ex ||= {}; p.ex[newId()] = zoneEntry({ n: e.n, t: e.t || "", m: e.m || "", img: e.img || "", ...(e.o ? { o: e.o } : {}) }, { play: { until: 1e9, any: true }, src: "warp" }); });
    });
    warped.forEach(([, e]) => logTo(code, `🌀 ${me.name}'s ${dispName(e)} (warp) was exiled — castable from exile later`));
    back.forEach(([, x]) => { logTo(code, `↩ ${me.name}'s ${dispName(x)} returns to the battlefield (${x.src || "end step"})`); setTimeout(() => { const before = new Set(Object.keys(me.bf || {})); playCard(zoneCard(x), { via: x.src || "end step" });
      if (x.retBonus) setTimeout(() => { const nid = Object.keys(me.bf || {}).find(k => !before.has(k) && me.bf[k].n === x.n); if (nid) mutate(p => { const y = p.bf?.[nid]; if (!y) return; y.c ||= {}; if (/\bPlaneswalker\b/.test(y.t || "")) y.c.loyalty = (y.c.loyalty || 0) + 1; else y.c.p1p1 = (y.c.p1p1 || 0) + 1; }); }, 50); }, 0); });
  }
  function sacEndTokens() {
    sacEndSelf();
    const list = Object.entries(me.tokens || {}).filter(([, t]) => t.sacEnd && t.count > 0);
    if (!list.length) return;
    const events = list.flatMap(([, t]) => [{ type: "sac", name: t.name, n: t.count, token: true, creature: true }, { type: "dies", n: t.count, token: true }]);
    logTo(code, `${me.name} sacrificed ${list.map(([, t]) => `${t.count} ${t.name} cop${t.count === 1 ? "y" : "ies"}`).join(", ")} (end step)`);
    act(events, null, p => list.forEach(([k]) => delete p.tokens?.[k]));
  }
  function exileMyriad() {
    const n = Object.values(me.tokens || {}).filter(t => t.myr).reduce((a, t) => a + t.count, 0);
    if (!n) return;
    logTo(code, `⚔ ${me.name}: ${n} myriad cop${n === 1 ? "y" : "ies"} exiled at end of combat`);
    mutate(p => { Object.keys(p.tokens || {}).forEach(k => { if (p.tokens[k].myr) delete p.tokens[k]; }); });
  }
  // ----- Sacrifice as a cost (Ashnod's Altar, Phyrexian Altar…): pick what to sacrifice -----
  function sacChoices(what) {
    const f = parseTargetFilter(what);
    const cards = Object.entries(me.bf || {}).filter(([, e]) => permMatch(e, f)).map(([id, e]) => [`bf:${id}`, dispName(e)]);
    const toks = Object.entries(me.tokens || {}).filter(([, t]) => t.count > 0 && permMatch(tokenPerm(t), f)).map(([k, t]) => { const pt = isCreatureToken(t.name) ? tokPTfx(t, pid, k) : "", eqs = eqList(t).map(x => me.bf?.[x] ? dispName(me.bf[x]) : "").filter(Boolean);
      return [`tok:${k}`, `${t.name} token${pt ? ` ${pt}` : ""}${eqs.length ? ` 📎 ${eqs.join(", ")}` : ""}${t.c && Object.keys(t.c).length ? ` (${Object.entries(t.c).map(([ck, cv]) => `${cv} ${ck === "p1p1" ? "+1/+1" : ck === "m1m1" ? "−1/−1" : ck}`).join(", ")})` : ""}${t.count > 1 ? ` ×${t.count}` : ""}`]; });
    return [...toks, ...cards];
  }
  function sacBox(r) {
    const opts = sacChoices(r.sacCost.what).filter(([v]) => v !== `bf:${r.sacCost.id}` || !r.sacCost.notSelf);
    return opts.length ? `<select class="fetch-pick" id="sc-${r.id}">${opts.map(([v, n]) => `<option value="${esc(v)}">${esc(n)}</option>`).join("")}</select>
      <button class="btn small primary" data-a="sac-go" data-id="${r.id}">🗡 Sacrifice</button>` : `<span class="mini">Nothing to sacrifice.</span>`;
  }
  // Cleanup: discard down to your maximum hand size (Reliquary Tower, Thought Vessel: none; Spellbook / Library of Leng too)
  function handSizeReminder() {
    const all = seated(room).filter(o => !isOut(o));
    const mineNone = Object.values(me.bf || {}).find(e => /\byou have no maximum hand size\b/i.test(e.o || lookupCard(e.n)?.o || ""));
    if (mineNone) return;
    let max = 7; const why = [];
    Object.values(me.bf || {}).forEach(e => { const m = String(e.o || lookupCard(e.n)?.o || "").match(/your maximum hand size is (increased|reduced) by (\w+)/i); if (m) { const d = ({ one: 1, two: 2, three: 3, four: 4 })[m[2].toLowerCase()] || Number(m[2]) || 0; max += m[1] === "increased" ? d : -d; why.push(dispName(e)); } });
    all.filter(o => o.id !== pid).forEach(o => Object.values(o.bf || {}).forEach(e => { const m = String(e.o || "").match(/each opponent's maximum hand size is reduced by (\w+)/i); if (m) { max -= ({ one: 1, two: 2, three: 3 })[m[1].toLowerCase()] || Number(m[1]) || 0; why.push(`${o.name}'s ${dispName(e)}`); } }));
    if (dig?.on && dig.hand.length <= Math.max(0, max)) return; // the digital hand knows: nothing to discard
    reminders.push({ id: newId(), src: "Cleanup", text: `Discard down to ${max} card${max === 1 ? "" : "s"} in hand.${dig?.on ? ` You have ${dig.hand.length}: discard ${dig.hand.length - Math.max(0, max)} (🗑 in your hand).` : ""}`, times: 1, note: why.length ? `Changed by ${why.join(", ")}.` : "" });
    render();
  }
  // Mana boosters on the table when a land is tapped: Mana Reflection, Caged Sun, Zendikar Resurgent, Mana Flare…
  function extraManaNote(land) {
    const out = [];
    seated(room).filter(o => !isOut(o)).forEach(o => Object.values(o.bf || {}).forEach(e => {
      const t = String(e.o || (o.id === pid ? lookupCard(e.n)?.o : "") || "");
      const mine = o.id === pid;
      if (mine && /if you tap a permanent for mana, it produces twice as much/i.test(t)) out.push(`${dispName(e)}: twice as much`);
      if (mine && /if you tap a permanent for mana, it produces three times as much/i.test(t)) out.push(`${dispName(e)}: three times as much`);
      else if (mine && /whenever a land's ability causes you to add one or more mana of the chosen color/i.test(t)) out.push(`${dispName(e)}: +1 ${e.color || "chosen color"} if it made ${e.color || "that color"}`);
      else if ((mine && /whenever you tap a (?:land|[a-z]+) for mana, add/i.test(t)) || /whenever a player taps a land for mana, (?:that player|its controller) adds/i.test(t)) out.push(`${o.id === pid ? "" : `${o.name}'s `}${dispName(e)}: +1 extra`);
      { const pun = t.match(/whenever (a player|an opponent) taps (an? (?:land|island|swamp|mountain|forest|plains|nonbasic land)) for mana, ((?!(?:that player|its controller) adds)[^.]+)/i);
        if (pun && (pun[1].toLowerCase() === "a player" || !mine) && (/nonbasic/i.test(pun[2]) ? !/\bBasic\b/.test(land.t || "") : /\bland\b/i.test(pun[2]) || new RegExp(`\\b${pun[2].split(" ").pop()}\\b`, "i").test(land.t || ""))) out.push(`${mine ? "" : `${o.name}'s `}${dispName(e)}: ${pun[3]}`); }
    }));
    if (out.length) toast(`⚡ ${dispName(land)}: ${out.join(" · ")}`);
  }
  // Abilities a land has from other cards: Bootlegger's Stash (all your lands), Squirrel Nest (the land it enchants)
  function landGrants(landId) {
    return Object.entries(me.bf || {}).flatMap(([sid, a]) => grantedLand(a).filter(g => g.scope === "lands" || a.att === landId).map(g => ({ sid, src: dispName(a), text: g.text, scope: g.scope })));
  }
  function landTapBox(r) {
    const ids = r.landTap.ids.filter(x => me.bf?.[x]?.tap);
    const names = ids.map(x => dispName(me.bf[x]));
    const seen = new Set(), opts = [];
    ids.forEach(lid => landGrants(lid).forEach(g => { const k = g.sid + "|" + g.text; if (!seen.has(k)) { seen.add(k); opts.push(g); } }));
    return `<span class="mini">You tapped ${esc(names.join(", ") || "a land")}. For mana, or instead:</span>
      ${opts.map(g => `<button class="btn small primary" data-a="land-grant" data-id="${r.id}" data-s="${esc(g.sid)}" data-t="${esc(g.text)}">${esc(g.text.replace(/^\{T\}:\s*/, "").replace(/\.$/, ""))} <span class="mini">(${esc(g.src)})</span></button>`).join("")}`;
  }
  function useLandGrant(r, sid, text) {
    const lid = r.landTap.ids.find(x => me.bf?.[x]?.tap && landGrants(x).some(g => g.sid === sid && g.text === text));
    if (!lid) return;
    const src = dispName(me.bf[sid]), land = dispName(me.bf[lid]);
    r.landTap.ids = r.landTap.ids.filter(x => x !== lid);
    if (!r.landTap.ids.length) reminders = reminders.filter(x => x !== r);
    const ab = activatedAbilities({ n: `${me.bf[sid].n} (granted)`, t: "Land", o: text })[0];
    logTo(code, `${me.name} tapped ${land}: ${text.replace(/^\{T\}:\s*/, "").replace(/\.$/, "").toLowerCase()} (${src})`);
    if (ab?.effs.length) act([{ type: "effects", effs: ab.effs, times: 1, count: 1, src, srcId: sid }]);
    if (!ab?.auto || ab.partial) reminders.push({ id: newId(), src, text: text.replace(/^\{T\}:\s*/, ""), times: 1 });
    render();
  }
  // ----- Auras & Equipment -----
  function attachTargets(type) { // [value, label] for a picker
    const t = (type || "creature").toLowerCase();
    const cards = Object.entries(me.bf || {}).filter(([, e]) => permMatch(e, parseTargetFilter(t.replace(/ you control$/, "")))).map(([id, e]) => [`bf:${id}`, dispName(e)]);
    const toks = /creature|permanent/.test(t) && !/legendary/.test(t) ? Object.entries(me.tokens || {}).filter(([, x]) => x.count > 0 && isCreatureToken(x.name)).map(([k, x]) => [`tok:${k}`, `${x.name} token${x.count > 1 ? ` (one of ${x.count})` : ""}${eqList(x).length ? " (equipped)" : ""}`]) : [];
    return [...cards, ...toks];
  }
  function detachIn(p, sid) {
    const a = p.bf?.[sid];
    if (!a?.att) return;
    if (a.att === "tok") Object.values(p.tokens || {}).forEach(t => { if (eqList(t).includes(sid)) { const l = eqList(t).filter(x => x !== sid); if (l.length) t.eq = l.join("+"); else delete t.eq; } });
    delete a.att;
    tidyTokenStacks(p);
  }
  function attachTo(sid, target) {
    const a = me.bf?.[sid];
    if (!a) return;
    const rc = /^Reconfigure\b/m.test(String(a.o || lookupCard(a.n)?.o || ""));
    if (!rc && target && /\bCreature\b/.test(a.t || "") && /\b(Equipment|Fortification)\b/.test(a.t || "")) { toast(`${dispName(a)} is a creature right now, so it can't be attached.`); return; }
    let name = "";
    if (target?.startsWith("bf:")) name = me.bf[target.slice(3)] ? dispName(me.bf[target.slice(3)]) : "";
    else if (target?.startsWith("tok:")) name = me.tokens?.[target.slice(4)] ? `${me.tokens[target.slice(4)].name} token` : "";
    act([], p => {
      detachIn(p, sid);
      const s = p.bf?.[sid];
      if (s && rc) { if (target) { s.rcT ||= s.t; s.t = String(s.rcT).replace(/\bCreature\b\s*/, ""); } else if (s.rcT) { s.t = s.rcT; delete s.rcT; } } // Reconfigure: not a creature while attached
      if (!s || !target) return;
      if (target.startsWith("bf:")) { if (p.bf[target.slice(3)]) s.att = target.slice(3); return; }
      const k = Object.keys(p.tokens || {}).find(x => x === target.slice(4)) || Object.keys(p.tokens || {}).find(x => p.tokens[x].name === me.tokens?.[target.slice(4)]?.name);
      const t = k && p.tokens[k];
      if (!t) return;
      const tappedOne = (t.tapped || 0) >= t.count; // only if every one of them is tapped
      const freshOne = (t.fresh?.n || 0) > 0;
      const one = { ...t, count: 1, eq: [...eqList(t), sid].join("+") };
      delete one.tapped; delete one.fresh;
      if (tappedOne) one.tapped = 1;
      if (freshOne) one.fresh = { turnNo: t.fresh.turnNo, n: 1 };
      t.count -= 1; if (tappedOne) t.tapped -= 1; if (freshOne) t.fresh.n -= 1;
      p.tokens[`__new_${sid}`] = one;
      s.att = "tok";
      tidyTokenStacks(p);
    });
    logTo(code, target ? `📎 ${me.name} attached ${dispName(a)} to ${name}` : `📎 ${me.name} unattached ${dispName(a)}`);
    render();
  }
  function attachPickBox(r, sid, type) {
    const opts = attachTargets(type);
    return opts.length ? `<select class="fetch-pick" id="ap-${r.id}">${opts.map(([v, n]) => `<option value="${esc(v)}">${esc(n)}</option>`).join("")}</select>
      <button class="btn small primary" data-a="attach-go" data-id="${r.id}" data-s="${esc(sid)}">📎 Attach</button>` : `<span class="mini">Nothing to attach it to.</span>`;
  }
  function attachNewBox(r) {
    const ent = r.attachNew || {};
    if (ent.id && me.bf?.[ent.id]) return `<button class="btn small primary" data-a="attach-new" data-id="${r.id}" data-v="bf:${esc(ent.id)}">📎 Attach to ${esc(dispName(me.bf[ent.id]))}</button>`;
    const names = [...new Set((ent.toks || []).filter(n => isCreatureToken(n)))];
    const btns = names.map(n => { const k = Object.keys(me.tokens || {}).filter(x => me.tokens[x].name === n && !eqList(me.tokens[x]).length).sort((a, b) => (me.tokens[b].fresh?.n || 0) - (me.tokens[a].fresh?.n || 0))[0];
      return k ? `<button class="btn small primary" data-a="attach-new" data-id="${r.id}" data-v="tok:${esc(k)}">📎 Attach to a new ${esc(n)}</button>` : ""; }).join("");
    return btns || `<span class="mini">It already left.</span>`;
  }
  // Regeneration shields (Swarmyard): used up when it would be destroyed; gone at end of turn
  function regenBox(r) {
    const f = r.regen;
    const cards = Object.entries(me.bf || {}).filter(([, e]) => /\bCreature\b/.test(e.t || "") && permMatch(e, f.filter)).map(([id, e]) => [`bf:${id}`, dispName(e)]);
    const toks = Object.entries(me.tokens || {}).filter(([, t]) => t.count > 0 && isCreatureToken(t.name) && permMatch(tokenPerm(t), f.filter)).map(([k, t]) => [`tok:${k}`, `${t.name} token${tokPTfx(t, pid, k) ? ` ${tokPTfx(t, pid, k)}` : ""}${t.count > 1 ? ` (one of ${t.count})` : ""}${t.sh ? " (shielded)" : ""}`]);
    const opts = [...cards, ...toks];
    return opts.length ? `<select class="fetch-pick" id="rg-${r.id}">${opts.map(([v, n]) => `<option value="${esc(v)}">${esc(n)}</option>`).join("")}</select>
      <button class="btn small primary" data-a="regen-go" data-id="${r.id}">♻ Shield it</button>` : `<span class="mini">No ${esc(f.what)} to regenerate.</span>`;
  }
  function untapAll() {
    mutate(p => { Object.values(p.bf || {}).forEach(e => delete e.tap); Object.values(p.tokens || {}).forEach(t => delete t.tapped); });
    logTo(code, `${me.name} untapped everything`);
  }
  // Untap step: yours (everything except "doesn't untap" cards; a stun counter comes off instead), or another player's with Seedborn Muse
  function phaseIn(why) {
    const ph = me.phased;
    if (!ph || (!Object.keys(ph.bf || {}).length && !Object.keys(ph.tokens || {}).length)) return false;
    const n = Object.keys(ph.bf || {}).length + Object.values(ph.tokens || {}).reduce((a, t) => a + (t.count || 0), 0);
    act([], p => {
      p.bf ||= {}; Object.assign(p.bf, p.phased?.bf || {});
      p.tokens ||= {};
      Object.entries(p.phased?.tokens || {}).forEach(([k, t]) => { const cur = p.tokens[k]; p.tokens[k] = cur ? { ...cur, count: cur.count + t.count, ...(t.tapped ? { tapped: (cur.tapped || 0) + t.tapped } : {}) } : t; });
      delete p.phased;
    });
    logTo(code, `👻 ${me.name}: ${n} permanent${n === 1 ? "" : "s"} phased in${why ? ` (${why})` : ""}`);
    return true;
  }
  let untapStepAt = 0;
  const capName2 = d => (String(d).match(/([A-Z][a-z]+)(?:\s+(?:artifact|creature|enchantment))?\s*$/) || [])[1] || String(d).split(" ").pop().replace(/^\w/, c => c.toUpperCase());
  function untapStep(mine) {
    if (mine) untapStepAt = Date.now();
    if (mine) {
      phaseIn("untap step");
      if (me.prot) { const src = me.prot.src; act([], p => { delete p.prot; }); logTo(code, `🛡 ${me.name}'s ${src} protection ended`); }
      const ur = boardEnv().untapRule;
      const sk = ur.find(r => r.skip);
      if (sk) { logTo(code, `${me.name} skips their untap step (${sk.src})`); return; }
      if (ur.length) return limitedUntap(ur);
    }
    const rules = mine ? null : boardEnv().untapOthers;
    if (!mine && !rules.length) return;
    const fits = e => mine || rules.some(r => permMatch(e, r.filter));
    const held = [], stunned = [];
    const anyTapped = Object.values(me.bf || {}).some(e => e.tap && fits(e)) || Object.values(me.tokens || {}).some(t => t.tapped && fits(tokenAsPerm(t)));
    if (!anyTapped) return;
    const orb = mine && seated(room).filter(o => !isOut(o)).flatMap(o => Object.values(o.bf || {})).find(x => /whenever a permanent becomes untapped, that permanent's controller mills a card/i.test(x.o || lookupCard(x.n)?.o || ""));
    if (orb) setTimeout(() => { const n = untapNow.n; if (n > 0) { sendNote(pid, { kind: "millLog", n, src: `${dispName(orb)} (${n} untapped)`, text: "" }); logTo(code, `🪦 ${dispName(orb)}: ${me.name} untapped ${n} permanent${n === 1 ? "" : "s"} → mills ${n}`); } }, 0);
    const untapNow = { n: 0 };
    act([], p => {
      Object.values(p.bf || {}).forEach(e => {
        if (!e.tap || !fits(e)) return;
        if (e.c?.stun) { e.c.stun -= 1; if (!e.c.stun) delete e.c.stun; stunned.push(dispName(e)); return; }
        if (mine && /doesn't untap during (your|its controller's) untap step/i.test(e.o || lookupCard(e.n)?.o || "")) { held.push(dispName(e)); return; }
        if (e.lockBy) { if (lockHeld(e.lockBy)) { held.push(`${dispName(e)} (${e.lockBy.src})`); return; } delete e.lockBy; }
        delete e.tap; untapNow.n++;
      });
      Object.values(p.tokens || {}).forEach(t => { if (t.tapped && fits(tokenAsPerm(t))) { untapNow.n += t.tapped; delete t.tapped; } });
    });
    logTo(code, mine ? `${me.name} untapped (untap step)${held.length ? ` · stayed tapped: ${held.join(", ")}` : ""}${stunned.length ? ` · stun counter removed: ${stunned.join(", ")}` : ""}`
      : `${me.name} untapped during ${turnName()}'s untap step (${rules[0].src})`);
  }
  const turnName = () => room.players?.[room.turn]?.name || "their";
  // Your untap step under Winter Orb / Static Orb / Smoke / Back to Basics: blocked things stay tapped; limited ones are your pick
  function limitedUntap(ur) {
    const blocks = ur.filter(r => r.block), limits = ur.filter(r => r.max);
    const counts = countsFor(me);
    const statOk = (e, st) => {
      if (!st) return true;
      if (st.k === "nonmanaAbility") { const c = lookupCard(e.n) || e; return !!c.o && activatedAbilities(c).some(a => !a.manaPer); }
      const pt = ptOf(e, counts, pid, Object.keys(me.bf || {}).find(k => me.bf[k] === e)).split("/");
      const v = st.k === "power" ? Number(pt[0]) : st.k === "toughness" ? Number(pt[1]) : manaValue(e.m);
      if (Number.isNaN(v)) return false;
      return st.op === ">=" ? v >= st.val : v <= st.val;
    };
    const isBlocked = e => blocks.some(r => permMatch(e, r.block) && statOk(e, r.stat));
    const held = new Set(), notes = [];
    Object.entries(me.bf || {}).forEach(([id, e]) => {
      if (!e.tap) return;
      if (isBlocked(e)) { held.add(id); notes.push(`${dispName(e)} (${blocks.find(r => permMatch(e, r.block) && statOk(e, r.stat)).src})`); return; }
      if (/doesn't untap during (your|its controller's) untap step/i.test(e.o || lookupCard(e.n)?.o || "")) { held.add(id); notes.push(dispName(e)); }
      else if (lockHeld(e.lockBy)) { held.add(id); notes.push(`${dispName(e)} (${e.lockBy.src})`); }
    });
    // anything a limit covers waits for your pick
    const picks = [];
    limits.forEach(r => {
      const opts = [];
      Object.entries(me.bf || {}).forEach(([id, e]) => { if (e.tap && !held.has(id) && permMatch(e, r.filter) && !picks.some(p => p.opts.some(o => o.v === `bf|${id}`))) opts.push({ v: `bf|${id}`, label: dispName(e) }); });
      Object.entries(me.tokens || {}).forEach(([k, t]) => { if (t.tapped && permMatch(tokenAsPerm(t), r.filter)) for (let i = 0; i < Math.min(t.tapped, r.max); i++) opts.push({ v: `tok|${k}|${i}`, label: `${t.name} token` }); });
      if (opts.length > r.max) picks.push({ rule: r, opts });
    });
    const waiting = new Set(picks.flatMap(p => p.opts.map(o => o.v.split("|").slice(0, 2).join("|"))));
    act([], p => {
      Object.entries(p.bf || {}).forEach(([id, e]) => {
        if (!e.tap || held.has(id) || waiting.has(`bf|${id}`)) return;
        if (e.c?.stun) { e.c.stun -= 1; if (!e.c.stun) delete e.c.stun; return; }
        delete e.tap;
      });
      Object.entries(p.tokens || {}).forEach(([k, t]) => {
        if (!t.tapped || waiting.has(`tok|${k}`)) return;
        const tp = tokPTfx(t, pid, k).split("/"), tperm = { ...tokenAsPerm(t), p: tp[0], tg: tp[1] };
        const r = blocks.find(x => permMatch(tperm, x.block) && (!x.stat || (x.stat.k === "power" ? (x.stat.op === ">=" ? Number(tp[0]) >= x.stat.val : Number(tp[0]) <= x.stat.val)
          : x.stat.k === "toughness" ? (x.stat.op === ">=" ? Number(tp[1]) >= x.stat.val : Number(tp[1]) <= x.stat.val) : false)));
        if (r) { notes.push(`${t.tapped} ${t.name} ${tp.join("/")} (${r.src})`); return; }
        delete t.tapped;
      });
    });
    logTo(code, `${me.name} untapped (untap step)${notes.length ? ` · stayed tapped: ${notes.join(", ")}` : ""}${picks.length ? ` · choosing under ${picks.map(p => p.rule.src).join(", ")}` : ""}`);
    picks.forEach(pk => reminders.push({ id: newId(), src: pk.rule.src, text: `Untap only ${pk.rule.max} ${pk.rule.what} this untap step. Which?`, times: 1, untapPick: { max: pk.rule.max, opts: pk.opts } }));
    if (picks.length) render();
  }
  function permCounter(id, k, d) {
    const e = me.bf?.[id];
    if (!e) return;
    const n = (e.c?.[k] || 0) + d;
    if (n < 0) return;
    if (k === "lore" && d > 0) setTimeout(() => sagaCheck({ [id]: n - d }), 0);
    else if (d > 0 && k !== "loyalty") setTimeout(() => counterAsk(id, k, d), 0);
    mutate(p => {
      const t = p.bf[id];
      t.c ||= {};
      if (n === 0) delete t.c[k]; else t.c[k] = n;
    });
    const label = counterLabel(k), nm = e.n;
    logDelta(`pc${id}${k}`, d, x => `${me.name}: ${nm} ${x > 0 ? "+" : ""}${x} ${label} → ${me.bf?.[id]?.c?.[k] || 0}`);
  }
  // Airbend: exile it; its owner may cast it for {2}
  function airbend(id) {
    const e = me.bf?.[id];
    if (!e) return;
    const keep = { n: e.n, t: e.t, m: e.m || "", img: e.img || "" };
    if (e.nick) keep.nick = e.nick;
    if (e.o) keep.o = e.o;
    if (e.cmd) keep.cmd = true;
    logTo(code, `🌀 ${me.name}'s ${dispName(e)} was airbended`);
    if (e.cmd) toast("Commander: recast it from Airbended for {2} (no tax), or send it to the command zone.");
    act([], p => { delete p.bf[id]; p.air ||= {}; p.air[id] = { ...keep, was: JSON.parse(JSON.stringify(e)) }; });
    expanded.delete(id);
  }
  // ----- Removal: pick targets, wait for responses, then the owner's phone carries it out -----
  const VERB = { destroy: "Destroy", exile: "Exile", bounce: "Return to hand", airbend: "Airbend", steal: "Gain control of", phase: "Phase out", tuck: "Shuffle into library" };
  // Chaos Warp: the owner reveals their top card; a permanent card goes onto the battlefield
  function cwarpBox(r) {
    const list = (deck?.cards || []).map((c, i) => [c, i]).filter(([c]) => !/\b(Instant|Sorcery)\b/.test(c.t || "")).sort((a, b) => a[0].n.localeCompare(b[0].n));
    return `${list.length ? `<select class="fetch-pick" id="cw-${r.id}">${list.map(([c, i]) => `<option value="${i}">${esc(dispName(c))}</option>`).join("")}</select>
      <button class="btn small primary" data-a="cw-go" data-id="${r.id}">Put it onto the battlefield</button>` : ""}<button class="btn small" data-a="cw-none" data-id="${r.id}">Not a permanent card</button>`;
  }
  function removeLabel(f, r) {
    const cap = (f.n || 1) * (r?.times || 1);
    if (f.atk) return `${VERB[f.how]} all ${f.what} (tick the attackers)`;
    if (f.pickAll) return `${VERB[f.how]} all ${f.what} (tick the ones that go)`;
    return f.all ? `${VERB[f.how]} ${/s\b/.test(f.what.split(" ")[0]) || /s$/.test(f.what) ? "all" : "each"} ${f.what}` : `${VERB[f.how]} ${f.upTo || cap > 1 ? `up to ${cap} ` : ""}target ${f.what}`;
  }
  const tokenAsPerm = t => tokenPerm(t);
  function removalCandidates(f) {
    const out = [];
    seated(room).forEach(o => {
      if (f.filter.controller === "opp" && o.id === pid) return;
      if (f.filter.controller === "you" && o.id !== pid) return;
      if (f.atk && room.turn && o.id !== room.turn) return;
      Object.entries(o.bf || {}).forEach(([id, e]) => { if (permanentMatches(e, f.filter) && (f.all || !cantTarget(e, o.id, id, pid))) out.push({ v: `${o.id}|bf|${id}`, o, label: dispName(e) }); });
      Object.entries(o.tokens || {}).forEach(([k, t]) => { if (t.count > 0 && permanentMatches(tokenAsPerm(t), f.filter) && (f.all || !cantTarget(tokenAsPerm(t), o.id, k, pid, true))) out.push({ v: `${o.id}|tok|${k}`, o, label: `${t.name} token (×${t.count})` }); });
    });
    return out;
  }
  function removePicker(r) {
    const f0 = r.effs.find(x => x.k === "remove"), kick = kickInstead(r);
    const f = kick && r.kicked ? { ...f0, ...kick } : f0;
    const kb = kick ? `<button class="btn small ${r.kicked ? "on" : ""}" data-a="kick-tog" data-id="${r.id}">${r.kicked ? "✓ Kicked" : `Kicked? (${esc(kick.cost)})`}</button>` : "";
    const w = windowState(r), dis = w.ready ? "" : "disabled";
    const list = removalCandidates(f).filter(c => !(f.another && r.srcId && c.v === `${pid}|bf|${r.srcId}`));
    if (kb) return kb + removePickerInner(r, f, w, dis, list);
    return removePickerInner(r, f, w, dis, list);
  }
  function kickInstead(r) {
    const o = lookupCard(r.src)?.o || deckCard(r.src)?.o || "";
    const k = o.match(/^Kicker ((?:\{[^}]+\})+)/m), m = o.match(/if this spell was kicked, (destroy|exile) target ([a-z ]+?) instead/i);
    return k && m ? { cost: k[1], how: m[1].toLowerCase(), what: m[2], filter: parseTargetFilter(m[2]) } : null;
  }
  function removePickerInner(r, f, w, dis, list) {
    if (f.all) return `${w.html}<span class="mini">${list.length} match${list.length === 1 ? "" : "es"} across the table.</span>
      <button class="btn small primary" data-a="rm-go" data-id="${r.id}" ${dis}>${VERB[f.how]} all</button>`;
    if (!list.length) return `<span class="mini">No legal targets right now.</span>`;
    const cap = (f.n || 1) * (r.times || 1);
    if (cap === 1) return `${w.html}<select class="fetch-pick" id="rp-${r.id}">${list.map(c => `<option value="${c.v}">${esc(c.o.name)}: ${esc(c.label)}</option>`).join("")}</select>
      <button class="btn small primary" data-a="rm-go" data-id="${r.id}" ${dis}>${VERB[f.how]}</button>`;
    return `${w.html}<div class="modes">${list.map(c => `<label class="mode-check"><input type="checkbox" class="rm-box" data-rid="${r.id}" value="${c.v}"><span><b>${esc(c.o.name)}</b>: ${esc(c.label)}</span></label>`).join("")}</div>
      <button class="btn small primary" data-a="rm-go" data-id="${r.id}" ${dis}>${VERB[f.how]} selected${f.atk || f.pickAll ? "" : ` (up to ${cap})`}</button>`;
  }
  // Send each owner an order; their phone removes the cards so their triggers and Undo work
  // Orders sent to other players are remembered with the undo step, so undoing it asks them to put things back (and redo sends them again)
  function trackSentOrder(oid, o) {
    if (!me) return;
    if (!undo.length || undoMeta.at(-1)?.seq !== actSeq) { undo.push(clone(me)); undoExt.push(null); undoMeta.push({ seq: actSeq, label: actLabel, rem: clone(reminders || []) }); }
    const i = undoExt.length - 1; undoExt[i] ||= {}; (undoExt[i].orders ||= []).push({ oid, o: clone(o) });
  }
  function rawOrder(oid, o) { update(ref(db, `rooms/${code}/orders/${oid}`), { [newId()]: { ...o, by: pid, byName: me.name, at: Date.now() } }); }
  // After undo/redo: a response window that belonged to an undone step is closed, and restored effects get announced again
  function resyncWindows() {
    if (room?.pending?.by === pid && !reminders.some(r => r.id === room.pending.id)) update(ref(db, `rooms/${code}`), { pending: null });
    reminders.forEach(r => { if (r.announced && !r.forced && room?.pending?.id !== r.id) r.announced = false; });
    setTimeout(() => { try { announceWindows(); render(); } catch {} }, 80);
  }
  function sendOrders(byOwner, extra) {
    Object.entries(byOwner).forEach(([oid, order]) => {
      const o = { ...order, ...extra, by: pid, byName: me.name, at: Date.now() };
      if (oid !== pid && o.how !== "revertOrder") { o.key ||= newId(); trackSentOrder(oid, o); }
      if (oid !== pid && o.how !== "steal") [...(o.targets || []), ...(o.effs || []).map(f => f.target).filter(Boolean)].filter(t => t.kind === "bf" && t.id).forEach(t => willbreakerTargeted(oid, t.id, o.src));
      if (oid === pid) executeOrder(o);
      else update(ref(db, `rooms/${code}/orders/${oid}`), { [newId()]: o });
    });
  }
  function removeGo(r) {
    const f0 = r.effs.find(x => x.k === "remove"), kick = kickInstead(r), f = kick && r.kicked ? { ...f0, ...kick } : f0;
    if (!windowState(r).ready) return;
    const byOwner = {};
    if (f.all) seated(room).filter(o => !(f.how === "steal" && o.id === pid)).forEach(o => { byOwner[o.id] = { all: true, filter: f.filter, ...(f.spare ? { spare: f.spare } : {}) }; });
    else {
      const cap = (f.n || 1) * (r.times || 1);
      const vals = cap === 1 ? [document.getElementById(`rp-${r.id}`)?.value].filter(Boolean)
        : [...document.querySelectorAll(`.rm-box[data-rid="${r.id}"]:checked`)].map(x => x.value);
      if (!vals.length) { toast("Pick a target first."); return; }
      if (vals.length > cap) { toast(`Pick at most ${cap}.`); return; }
      vals.forEach(v => { const [oid, kind, id] = v.split("|"); (byOwner[oid] ||= { targets: [] }).targets.push({ kind, id }); });
    }
    if (!f.all && Object.keys(byOwner).some(oid => oid !== pid) && f.how !== "phase") commitCrime("removal");
    clearWindow(r);
    reminders = reminders.filter(x => x.id !== r.id);
    logTo(code, `${me.name}: ${r.src} → ${removeLabel(f, r).toLowerCase()}`);
    const srcO = (r.srcId && me.bf?.[r.srcId]?.o) || lookupCard(r.src)?.o || "";
    const hold = f.how === "exile" && (f.hold || /leaves the battlefield, return the exiled (card|permanent)|until [^.]*leaves the battlefield/i.test(srcO)) && r.srcId ? { by: pid, srcId: r.srcId, src: r.src } : null;
    sendOrders(byOwner, { how: f.how, src: r.src, ...(hold ? { hold } : {}), ...(f.noRegen ? { noRegen: true } : {}), rider: f.rider || "", ...(f.how === "steal" ? { until: f.until || null, untap: !!f.untap, haste: !!f.haste } : {}), ...(f.stealPlay ? { stealPlay: true } : {}), ...(f.counters ? { counters: f.counters } : {}) });
    render();
  }
  // "Life total becomes …"
  function lifePicker(r) {
    const f = r.effs.find(x => x.k === "setlife");
    const w = windowState(r), dis = w.ready ? "" : "disabled";
    if (f.scope === "target") return `${w.html}<select class="fetch-pick" id="lp-${r.id}">${seated(room).filter(o => !isOut(o)).map(o => `<option value="${o.id}">${esc(o.name)} (${o.life ?? START_LIFE})</option>`).join("")}</select>
      <button class="btn small primary" data-a="life-go" data-id="${r.id}" ${dis}>Set to ${f.val}</button>`;
    const preview = seated(room).filter(o => !isOut(o)).map(o => `${esc(o.name)} ${o.life ?? START_LIFE}→${lifeTarget(f, o)}`).join(" · ");
    return `${w.html}<span class="mini">${preview}</span><button class="btn small primary" data-a="life-go" data-id="${r.id}" ${dis}>Apply</button>`;
  }
  function lifeTarget(f, o) {
    if (f.val != null) return f.val;
    if (f.count) return countTypes(o, f.count);
    const lives = seated(room).filter(x => !isOut(x)).map(x => x.life ?? START_LIFE);
    return f.agg === "lowest" ? Math.min(...lives) : Math.max(...lives);
  }
  function lifeGo(r) {
    const f = r.effs.find(x => x.k === "setlife");
    if (!windowState(r).ready) return;
    clearWindow(r);
    reminders = reminders.filter(x => x.id !== r.id);
    const who = f.scope === "each" ? seated(room).filter(o => !isOut(o)) : f.scope === "you" ? [room.players[pid] && { id: pid, ...room.players[pid] }]
      : [seated(room).find(o => o.id === document.getElementById(`lp-${r.id}`)?.value)];
    const byOwner = {};
    who.filter(Boolean).forEach(o => { byOwner[o.id] = { setlife: f.count ? { count: f.count } : { val: lifeTarget(f, o) } }; });
    logTo(code, `${me.name}: ${r.src}: ${f.label}`);
    sendOrders(byOwner, { how: "setlife", src: r.src });
    render();
  }
  const isIndestructible = (e, id) => /^(.*,\s*)?indestructible\b/im.test(e.o || lookupCard(e.n)?.o || "") || !!me.effects?.indestructible || !!e.c?.x_indestructible || kwsOf({ ...e, o: e.o || lookupCard(e.n)?.o }, pid, id).some(x => x.k === "indestructible");
  // Carry out an order on this phone's own board (from anyone, including yourself)
  // Put back only what the order changed (a card, a token stack, life…), keeping everything that happened since
  function revertParts(p, before, after) {
    const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
    new Set([...Object.keys(before || {}), ...Object.keys(after || {})]).forEach(k => {
      const b0 = before?.[k], a0 = after?.[k];
      if (same(b0, a0)) return;
      const objs = v => v && typeof v === "object" && !Array.isArray(v);
      if (objs(b0) || objs(a0)) { const bo = objs(b0) ? b0 : {}, ao = objs(a0) ? a0 : {};
        new Set([...Object.keys(bo), ...Object.keys(ao)]).forEach(sk => { if (same(bo[sk], ao[sk])) return; p[k] ||= {}; if (bo[sk] === undefined) delete p[k][sk]; else p[k][sk] = clone(bo[sk]); });
        if (p[k] && objs(p[k]) && !Object.keys(p[k]).length) delete p[k];
      } else if (b0 === undefined) delete p[k]; else p[k] = clone(b0);
    });
  }
  const orderSnaps = new Map(); // order key → my state just before it ran (for "put it back" after the sender undoes)
  function executeOrder(o) {
    if (o.how === "revertOrder") {
      if (!orderSnaps.has(o.key)) return;
      reminders.unshift({ id: newId(), src: `${o.byName} undid ${o.src}`, text: `Put your board back the way it was before ${o.src}?`, times: 1, revertKey: o.key });
      render(); return;
    }
    if (o.by && o.by !== pid && o.how !== "airbend") try { targetedTriggers(o); } catch (err) { reportError(err, "targetedTriggers"); }
    if (o.key && o.by !== pid) { const sv = { snap: clone(me), src: o.src }; orderSnaps.set(o.key, sv); if (orderSnaps.size > 30) orderSnaps.delete(orderSnaps.keys().next().value);
      setTimeout(() => { sv.after = clone(me); }, 400); } // what the order changed = before vs. just after
    if (o.how === "lose") { markLost(`${o.byName}'s ${o.src}`); return; }
    if (o.how === "nlMill") { nonlandMilled(o.n, o.who); return; }
    if (o.how === "gyexile") {
      const n = Object.keys(me.gy || {}).length;
      if (!n) return;
      logTo(code, `🚫 ${o.byName}'s ${o.src}: ${me.name}'s graveyard (${n} card${n === 1 ? "" : "s"}) exiled`);
      act([], p => { Object.values(p.gy || {}).forEach(e => { p.ex ||= {}; p.ex[newId()] = { ...e, at: Date.now() }; }); delete p.gy; });
      return;
    }
    if (o.how === "receive") { receiveCards(o); return; }
    if (o.how === "gyOne") {
      const c = me.gy?.[o.id];
      if (!c) return;
      logTo(code, `🚫 ${o.byName}'s ${o.src}: ${me.name}'s ${dispName(c)} exiled from the graveyard`);
      act([], p => { const x = p.gy?.[o.id]; if (!x) return; delete p.gy[o.id]; p.ex ||= {}; p.ex[newId()] = { ...x, at: Date.now() }; });
      return;
    }
    if (o.how === "combatHit") { combatHit(o); return; }
    if (o.how === "animate") { animateMine(o.id, o.p, o.tg, `${o.byName}'s ${o.src}`); return; }
    if (o.how === "addType") { addTypeMine(o.id, o.type, `${o.byName}'s ${o.src}`); return; }
    if (o.how === "tapLock") { tapLockApply(o); return; }
    if (o.how === "untapOne") { if (o.kind === "bf" && me.bf?.[o.id]?.tap) toggleTap(o.id); else if (o.kind === "tok" && me.tokens?.[o.id]?.tapped) mutate(p => { const t = p.tokens?.[o.id]; if (t?.tapped) t.tapped -= 1; }); logTo(code, `${o.byName}'s ${o.src} untapped ${me.name}'s ${o.kind === "bf" ? dispName(me.bf?.[o.id] || {}) : "token"}`); return; }
    if (o.how === "arcum") {
      const x = me.bf?.[o.id]; if (!x) return;
      sacrificeChosen([`bf|${o.id}`], `${o.byName}'s ${o.src}`);
      reminders.push({ id: newId(), src: `${o.byName}'s ${o.src}`, text: "Search your library", fetch: searchOf("Search your library for a noncreature artifact card, put it onto the battlefield, then shuffle."), left: 1, times: 1, note: "Optional." });
      render(); return;
    }
    if (o.how === "oppDiscard") { act([{ type: "oppdiscard", n: o.n || 1, by: o.by }]); return; }
    if (o.how === "oppEnters") {
      Object.entries(me.bf || {}).forEach(([id, e]) => {
        const m = String(e.o || lookupCard(e.n)?.o || "").match(/whenever a creature an opponent controls enters, (you may have that player lose (\d+) life|[^\n]+)/i);
        if (!m) return;
        const who = room.players?.[o.by]?.name || o.byName;
        if (m[2]) reminders.push(normalizeRem({ id: newId(), src: dispName(e), srcId: id, text: `${who}'s ${o.names.join(", ")} entered. You may have ${who} lose ${Number(m[2]) * o.n} life.`, times: 1, oppLose: { n: Number(m[2]) * o.n, only: o.by } }));
        else reminders.push({ id: newId(), src: dispName(e), srcId: id, text: `${who}'s ${o.names.join(", ")} entered: ${m[1]}`, times: o.n });
      });
      render(); return;
    }
    if (o.how === "blockedDmg") { // lifelink counts damage dealt to blockers too
      becameBlocked(o.cardN, o.src);
      const ll = Object.entries(me.bf || {}).find(([id, e]) => e.n === o.cardN && kwsOf({ ...e, o: e.o || lookupCard(e.n)?.o }, pid, id).some(x => x.k === "lifelink"))
        || Object.entries(me.tokens || {}).find(([k, t]) => o.cardN === t.name && kwsOf(tokenPerm(t), pid, k, true).some(x => x.k === "lifelink"));
      if (ll && o.dmg > 0 && !me.prot?.life) { mutate(p => { p.life = (p.life ?? START_LIFE) + o.dmg; }); logTo(code, `💚 ${me.name}'s ${o.src}: lifelink +${o.dmg} life (dealt to ${o.victim})`); }
      return;
    }
    if (o.how === "suspect") { suspectMine(o.kind, o.id, `${o.byName}'s ${o.src}`); return; }
    if (o.how === "fx") { act([{ type: "effects", effs: o.effs, times: 1, count: 1, src: `${o.byName}'s ${o.src || "effect"}` }]); return; }
    if (o.how === "tozone") {
      o.cards.forEach(c => {
        if (c.cmd) { reminders.push({ id: newId(), src: c.n, text: `Your commander left the battlefield (it was under another player's control). Command zone or ${o.zone === "ex" ? "exile" : "graveyard"}?`, times: 1 }); return; }
        act([], p => { toZone(p, c, o.zone); });
      });
      const names = o.cards.filter(c => !c.cmd).map(c => c.n);
      if (names.length) logTo(code, `${names.join(", ")} → ${me.name}'s ${o.zone === "ex" || boardEnv().rip.length ? "exile" : "graveyard"} (owner)`);
      render(); return;
    }
    if (o.how === "receiveEx") {
      act([], p => { p.ex ||= {}; o.cards.forEach(c => { p.ex[newId()] = zoneEntry({ ...c, own: o.own }, { play: { until: o.until ?? 1e9, any: o.until == null }, src: o.src, ...(o.heldBy ? { heldBy: o.heldBy } : {}) }); }); });
      logTo(code, `🕵 ${me.name} may play ${o.cards.map(c => c.n).join(", ")} (${o.own.name}'s, ${o.src})`);
      toast(`${o.cards.map(c => c.n).join(", ")}: you may play ${o.cards.length === 1 ? "it" : "them"} (🚫 Exile)`);
      zoneOpen.add("ex"); render(); return;
    }
    if (o.how === "dropEx") { act([], p => { delete p.ex?.[o.id]; }); return; }
    if (o.how === "unhold") { // the permanent holding these cards left: they come back to the battlefield under their owner's control
      const back = Object.entries(me.ex || {}).filter(([, e]) => e.heldBy?.by === o.holder && e.heldBy?.srcId === o.srcId);
      back.forEach(([xid, e]) => {
        const c = e.own && e.own.id !== pid ? null : zoneCard(e);
        if (e.own && e.own.id !== pid) { // a card I could play (Hostage Taker) goes home to its owner
          act([], p => { delete p.ex?.[xid]; });
          sendOrders({ [e.own.id]: {} }, { how: "returnBf", cards: [{ n: e.n, t: e.t, m: e.m, img: e.img, ...(e.o ? { o: e.o } : {}) }], src: e.src });
        } else playCard(c, { fromZone: { z: "ex", id: xid }, via: `returned: ${e.heldBy.src} left` });
      });
      return;
    }
    if (o.how === "returnBf") { o.cards.forEach(c => playCard(deckCard(c.n) || c, { via: `returned: ${o.src} left` })); return; }
    if (o.how === "bane") {
      const e = me.bf?.[o.id];
      if (!e) return;
      reminders.push({ id: newId(), src: `${o.byName}'s ${o.src}`, text: `Sacrifice ${o.name}, or it deals ${o.n} damage to you.`, times: 1, baneAsk: { id: o.id, n: o.n, name: o.name } });
      render(); return;
    }
    if (o.how === "markDmg") {
      if (o.kind === "bf" && !o.clear && o.n > 0 && me.bf?.[o.id]) { const e = me.bf[o.id], short = e.n.split(",")[0].replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), m = String(e.o || lookupCard(e.n)?.o || "").match(new RegExp(`^Whenever (?:this creature|${short}) is dealt (noncombat )?damage, ([^\\n]+)$`, "m"));
        if (m) { reminders.push(normalizeRem({ id: newId(), src: dispName(e), srcId: o.id, text: `Dealt ${o.n} damage (${o.byName}'s ${o.src})${m[1] ? " — only if it was noncombat damage" : ""}: ${m[2].replace(/that much damage/i, `${o.n} damage`).replace(/that many/i, String(o.n))}`, times: 1 })); setTimeout(render, 0); } }
      if (o.exileDie && o.kind === "bf" && me.bf?.[o.id]) logTo(code, `⚠ ${me.name}'s ${dispName(me.bf[o.id])}: if it would die this turn, it's exiled instead (${o.byName}'s ${o.src})`);
      act([], p => {
        const t = room.turnNo || 0;
        if (o.exileDie && o.kind === "bf" && p.bf?.[o.id]) p.bf[o.id].exileDie = t;
        if (p.marked?.turnNo !== t) p.marked = { turnNo: t };
        if (o.kind === "bf") { p.marked.bf ||= {}; if (o.clear) delete p.marked.bf[o.id]; else p.marked.bf[o.id] = (p.marked.bf[o.id] || 0) + o.n; return; }
        p.marked.tok ||= {};
        let l = Object.values(p.marked.tok[o.id] || {});
        if (o.all) l = Array.from({ length: p.tokens?.[o.id]?.count || 0 }, (_, i) => (l[i] || 0) + o.n); // every token in the stack was hit
        else if (o.clear) { if (o.idx >= 0) l.splice(o.idx, 1); }
        else if (o.idx >= 0 && o.idx < l.length) l[o.idx] += o.n; else l.push(o.n);
        if (l.length) p.marked.tok[o.id] = l; else delete p.marked.tok[o.id];
      });
      return;
    }
    if (o.how === "foreignDies") { act([{ type: "dies", n: o.n, token: !!o.token, foreign: true, ...(o.ts?.length === o.n ? { ts: o.ts } : {}) }]); return; }
    if (o.how === "gyTake") { const g = Object.entries(me.gy || {}).find(([, x]) => x.n === o.name); if (g) { act([], p => { delete p.gy?.[g[0]]; }); logTo(code, `${o.name} left ${me.name}'s graveyard (${o.byName}'s ${o.src})`); } return; }
    if (o.how === "ctrClear") { const e = me.bf?.[o.id]; if (!e) return; act([], p => { if (p.bf[o.id]) delete p.bf[o.id].c; }); logTo(code, `${o.byName}'s ${o.src}: all counters removed from ${me.name}'s ${dispName(e)}`); return; }
    if (o.how === "gainLife") { logTo(code, `⚙ ${o.byName}'s ${o.src}: ${o.why}`); act([{ type: "effects", effs: [{ k: "gain", n: o.n }], times: 1, count: 1, src: o.src }]); return; }
    if (o.how === "reperc") { repercHit(o.victim, o.n, o.src, o.why); return; }
    if (o.how === "ctrSub") {
      const e = me.bf?.[o.id];
      if (!e) return;
      const left = Math.max(0, (e.c?.[o.key] || 0) - o.n);
      act([], p => { p.bf[o.id].c ||= {}; p.bf[o.id].c[o.key] = left; });
      logTo(code, `💥 ${me.name}'s ${dispName(e)}: ${o.n} damage → ${left} ${o.key} left (${o.byName}'s ${o.src})`);
      return;
    }
    if (o.how === "setlife") {
      const v = o.setlife.count ? countTypes(me, o.setlife.count) : o.setlife.val;
      const was = me.life ?? START_LIFE;
      logTo(code, `❤ ${me.name}'s life total became ${v} (was ${was}, ${o.src})`);
      act([], p => { p.life = v; });
      return;
    }
    const f = o.filter;
    const bfIds = o.all
      ? Object.entries(me.bf || {}).filter(([, e]) => permanentMatches(e, f) && !(f.controller === "opp" && o.by === pid) && !(f.controller === "you" && o.by !== pid)).map(([id]) => id)
      : (o.targets || []).filter(t => t.kind === "bf").map(t => t.id);
    const tokHits = {};
    if (o.all) Object.entries(me.tokens || {}).forEach(([k, t]) => { if (permanentMatches(tokenAsPerm(t), f) && !(f.controller === "opp" && o.by === pid)) { const keep = o.spare && o.by === pid && t.name === o.spare && t.fresh?.turnNo === (room.turnNo || 0) ? t.fresh.n || 0 : 0; if (t.count - keep > 0) tokHits[k] = t.count - keep; } });
    (o.targets || []).filter(t => t.kind === "tok").forEach(t => { tokHits[t.id] = (tokHits[t.id] || 0) + 1; });
    if (o.tokensFilter) Object.entries(me.tokens || {}).forEach(([k, t]) => { if (permanentMatches(tokenAsPerm(t), o.tokensFilter)) tokHits[k] = t.count; });
    const gone = [], survived = [], events = [], riders = [], regenned = [], regenTok = {};
    const goneP = {}, tokSnap = clone(me.tokens || {});
    const shields = { ...(me.shields || {}) };
    if (o.how === "destroy") Object.keys(tokHits).forEach(k => { const t = me.tokens?.[k]; if (t && kwsOf(tokenPerm(t), pid, k, true).some(x => x.k === "indestructible")) { survived.push(`${t.name} tokens`); delete tokHits[k]; } });
    if (o.how === "destroy" && !o.noRegen) Object.entries(tokHits).forEach(([k, n]) => { // shielded tokens (Swarmyard, Asceticism) regenerate
      const t = me.tokens?.[k];
      if (!t?.sh) return;
      const save = Math.min(n, t.count);
      regenTok[k] = save; tokHits[k] = n - save;
      if (!tokHits[k]) delete tokHits[k];
    });
    bfIds.forEach(id => {
      const e = me.bf?.[id];
      if (!e) return;
      if (o.how === "destroy" && isIndestructible(e, id)) { survived.push(dispName(e)); return; }
      if (o.how === "destroy" && !o.noRegen && shields[`bf:${id}`]) { shields[`bf:${id}`]--; regenned.push([id, e]); return; }
      try { goneP[id] = ptOf(e, countsFor(me), pid, id); } catch {}
      gone.push([id, e]);
      if (o.how === "destroy" && /\bCreature\b/.test(e.t || "")) events.push({ type: "dies", n: 1, token: false, ids: [id] });
    });
    Object.entries(tokHits).forEach(([k, n]) => {
      const t = me.tokens?.[k];
      if (!t) return;
      const cnt = Math.min(n, t.count);
      if (o.how === "destroy" && isCreatureToken(t.name)) events.push({ type: "dies", n: cnt, token: true, name: t.name });
    });
    if (o.how === "phase") {
      const toks = Object.entries(tokHits).filter(([k]) => me.tokens?.[k]);
      if (!gone.length && !toks.length) return;
      logTo(code, `👻 ${o.byName}'s ${o.src}: ${me.name}'s ${[...gone.map(([, e]) => dispName(e)), ...toks.map(([k, n]) => `${Math.min(n, me.tokens[k].count)} ${me.tokens[k].name}`)].join(", ")}${o.counters && gone.length ? ` got ${o.counters.n} ${o.counters.label} counter${o.counters.n === 1 ? "" : "s"} and` : ""} phased out`);
      act([], p => {
        p.phased ||= {}; p.phased.bf ||= {}; p.phased.tokens ||= {};
        gone.forEach(([id, e]) => {
          if (o.counters) { e = { ...e, c: { ...(e.c || {}), [o.counters.key]: (e.c?.[o.counters.key] || 0) + o.counters.n } }; }
          p.phased.bf[id] = e; delete p.bf[id];
        });
        toks.forEach(([k, n]) => { const t = p.tokens?.[k]; if (!t) return; const c = Math.min(n, t.count);
          const cur = p.phased.tokens[k]; p.phased.tokens[k] = { ...t, count: (cur?.count || 0) + c }; delete p.phased.tokens[k].tapped;
          t.count -= c; if (t.count <= 0) delete p.tokens[k]; else if (t.tapped > t.count) t.tapped = t.count; });
      });
      render(); return;
    }
    if (o.how === "steal") {
      const cards = gone.map(([, e]) => ({ ...e }));
      const toks = Object.entries(tokHits).filter(([k]) => me.tokens?.[k]).map(([k, n]) => ({ ...me.tokens[k], count: Math.min(n, me.tokens[k].count) }));
      if (!cards.length && !toks.length) return;
      logTo(code, `🔀 ${o.byName}'s ${o.src}: ${o.byName} gains control of ${me.name}'s ${[...cards.map(dispName), ...toks.map(t => `${t.count} ${t.name}`)].join(", ")}${o.until === "eot" ? " until end of turn" : ""}`);
      noRelease = true;
      act([], p => {
        gone.forEach(([id]) => delete p.bf[id]);
        toks.forEach(t => { const k = Object.keys(p.tokens || {}).find(x => p.tokens[x].name === t.name && !p.tokens[x].own); if (!k) return; p.tokens[k].count -= t.count; if (p.tokens[k].count <= 0) delete p.tokens[k]; });
      });
      noRelease = false;
      sendOrders({ [o.giveTo || o.by]: {} }, { how: "receive", cards, toks, from: meTag(), until: o.until || null, untap: !!o.untap, haste: !!o.haste, src: o.src });
      gone.filter(([, e]) => e.cmd).forEach(([, e]) => reminders.push({ id: newId(), src: dispName(e), text: `${o.byName} took control of your commander. Its combat damage still counts as commander damage from it.`, times: 1 }));
      render(); return;
    }
    // riders like "Its controller gains life equal to its power" / "creates a 3/3 Beast"
    let gain = 0;
    if (o.rider) gone.forEach(([gid, e]) => {
      if (/gains life equal to its power/i.test(o.rider)) gain += Math.max(0, Number((goneP[gid] || ptOf(e, countsFor(me), pid, gid)).split("/")[0]) || 0);
      else if (/creates two tokens that are copies of that creature, except their base power is half/i.test(o.rider)) {
        const [pp, tt] = String(ptOf(e, countsFor(me)) || "0/0").split("/").map(x => Number(x) || 0);
        const desc = `${Math.ceil(pp / 2)}/${Math.ceil(tt / 2)} copy of ${e.n}`;
        setTimeout(() => act([{ type: "create", name: e.n, n: 2, desc, src: `${o.byName}'s ${o.src}` }], null, p => { Object.values(p.tokens || {}).forEach(t => { if (t.name === e.n && !t.tl) t.tl = (e.t || "Creature").replace(/^Legendary\s+/, ""); }); }), 0);
      }
      else riders.push(o.rider);
    });
    if (o.rider && /gains life equal to its power/i.test(o.rider)) Object.entries(tokHits).forEach(([k, n]) => { const t = me.tokens?.[k] || tokSnap[k]; if (t) gain += Math.max(0, Number(String(tokPTfx(t, pid, k) || "0/0").split("/")[0]) || 0) * Math.min(n, t.count || n); });
    if (o.rider && !gone.length && Object.keys(tokHits).length && !/gains life|copies of that creature/i.test(o.rider)) riders.push(o.rider);
    const VERBED = { destroy: "destroyed", exile: "exiled", bounce: "returned to hand", airbend: "airbended", steal: "stolen", phase: "phased out", tuck: "shuffled into their library" };
    const names = [...gone.map(([, e]) => dispName(e)), ...Object.entries(tokHits).filter(([k]) => me.tokens?.[k]).map(([k, n]) => `${Math.min(n, me.tokens[k].count)} ${me.tokens[k].name}`)];
    const tokNames = Object.entries(tokHits).filter(([k]) => me.tokens?.[k]).map(([k, n]) => `${Math.min(n, me.tokens[k].count)} ${me.tokens[k].name}`);
    if (o.how === "bounce" && tokNames.length) {
      const cardNames = gone.map(([, e]) => dispName(e));
      logTo(code, `💥 ${o.byName}'s ${o.src}: ${cardNames.length ? `${me.name}'s ${cardNames.join(", ")} returned to hand; ` : ""}${me.name}'s ${tokNames.join(", ")} token${tokNames.length > 1 || /^[2-9]|\d\d/.test(tokNames[0]) ? "s" : ""} vanished`);
    } else if (names.length) logTo(code, `${o.how === "airbend" ? "🌀" : "💥"} ${o.byName}'s ${o.src}: ${me.name}'s ${names.join(", ")} ${VERBED[o.how]}`);
    if (survived.length) logTo(code, `🛡 ${me.name}'s ${survived.join(", ")} survived (indestructible)`);
    if (regenned.length || Object.keys(regenTok).length) {
      logTo(code, `♻ ${me.name}'s ${[...regenned.map(([, e]) => dispName(e)), ...Object.entries(regenTok).map(([k, n]) => `${n} ${me.tokens[k].name}`)].join(", ")} regenerated (tapped instead of destroyed)`);
      mutate(p => {
        regenned.forEach(([id]) => { if (p.bf?.[id]) p.bf[id].tap = true; if (p.marked?.bf) delete p.marked.bf[id]; }); // regenerating removes its damage
        Object.entries(regenTok).forEach(([k, n]) => { const t = p.tokens?.[k]; if (t) { t.tapped = Math.min(t.count, (t.tapped || 0) + n); t.sh -= 1; if (t.sh <= 0) delete t.sh; } });
        tidyTokenStacks(p);
        p.shields = Object.fromEntries(Object.entries(shields).filter(([, v]) => v > 0)); if (!Object.keys(p.shields).length) delete p.shields;
      });
    }
    if (!names.length && !survived.length) return;
    act(events, p => {
      Object.entries(tokHits).forEach(([k, n]) => {
        const t = p.tokens?.[k];
        if (!t) return;
        t.count -= Math.min(n, t.count);
        if (t.count <= 0) delete p.tokens[k]; else if (t.tapped > t.count) t.tapped = t.count;
      });
      if (gain) p.life = (p.life ?? START_LIFE) + gain;
    }, p => {
      // permanents leave after triggers check, so "whenever another creature dies" sees a board wipe
      gone.forEach(([id, e]) => {
        delete p.bf[id];
        if (o.how === "airbend") { p.air ||= {}; p.air[id] = { ...airKeep(e), was: JSON.parse(JSON.stringify(e)) }; }
        if (o.how === "destroy") toZone(p, e, "gy");
        if (o.how === "exile" && !o.stealPlay) toZone(p, e, "ex", o.hold ? { heldBy: o.hold } : undefined);
      });
    });
    if (gain) logTo(code, `${me.name} gained ${gain} life (${o.src})`);
    if (o.how === "bounce") toDigHand(gone.filter(([, e]) => !e.cmd).map(([, e]) => e));
    // Hostage Taker: the exiled card is the caster's to play (it stays yours: if it dies later it comes back to your graveyard)
    if (o.stealPlay && o.by !== pid) {
      const cards = gone.filter(([, e]) => !e.own || e.own.id === pid).map(([, e]) => ({ n: e.n, t: e.t || "", m: e.m || "", img: e.img || "", ...(e.o ? { o: e.o } : {}) }));
      if (cards.length) sendOrders({ [o.by]: {} }, { how: "receiveEx", cards, own: meTag(), src: o.src, ...(o.hold ? { heldBy: o.hold } : {}) });
    }
    gone.filter(([, e]) => e.cmd).forEach(([, e]) => reminders.push({ id: newId(), src: dispName(e), text: o.how === "bounce" ? "Your commander went to your hand (or the command zone, your choice)." : "Your commander can go to the command zone instead.", times: 1 }));
    riders.forEach(text => {
      if (text === "chaoswarp") { reminders.push({ id: newId(), src: `${o.byName}'s ${o.src}`, text: "Shuffle, then reveal the top card of your library. If it's a permanent card, put it onto the battlefield.", times: 1, cwarp: true }); return; }
      const txt = text.replace(/^creates\b/i, "create").replace(/^may /i, "you may ").replace(/\btheir library\b/gi, "your library");
      const effs = parseEffectsLite(txt);
      if (effs.tok) act([{ type: "create", name: effs.tok.name, n: effs.tok.n, desc: effs.tok.desc }]);
      else reminders.push({ id: newId(), src: o.src, text: txt.replace(/^\w/, c => c.toUpperCase()), times: 1,
        ...(/search your library/i.test(txt) ? { fetch: searchOf(txt), left: 1, text: "Search your library" } : {}) });
    });
    render();
  }
  const parseEffectsLite = t => { const m = t.match(/create (a|an|one|two|three) ([^.]*?)\btokens?\b/i); return m ? { tok: { name: (m[2].match(/\b[A-Z][\w'-]*/g) || ["Token"]).join(" "), n: { a: 1, an: 1, one: 1, two: 2, three: 3 }[m[1].toLowerCase()], desc: m[2].trim() } } : {}; };
  const searchOf = t => spellAbility({ n: "__rider", o: t.replace(/^you may /i, "") }).effs.find(f => f.k === "fetch") || null;

  // ----- Ad Nauseam: reveal, lose life equal to mana value, repeat -----
  const adnLabel = r => `Reveal top card → hand, lose its mana value${r.adn ? ` · ${r.adn.count} revealed, −${r.adn.lost} life` : ""}`;
  function adnPicker(r) {
    const used = name => Object.values(me.bf || {}).filter(e => e.n === name).length + (r.adn?.names || []).filter(n => n === name).length
      + (deck?.cards.find(c => c.n === name && dispName(c) === r.src) ? 1 : 0);
    const list = (deck?.cards || []).map((c, i) => [c, i]).filter(([c]) => c.qty - used(c.n) > 0).sort((a, b) => a[0].n.localeCompare(b[0].n));
    return `<select class="fetch-pick" id="an-${r.id}">${list.map(([c, i]) => `<option value="${i}">${esc(dispName(c))} (${manaValue(c.m)})</option>`).join("")}</select>
      <button class="btn small primary" data-a="adn-go" data-id="${r.id}">Revealed it</button>`;
  }

  const airLabel = f => f.scope === "all other" ? `Airbend all other ${f.what}s. Choose up to one to spare:`
    : f.scope === "all" ? `Airbend all ${f.what}s` : `Airbend target ${f.what}:`;
  const airMatch = (e, what) => what === "permanent" ? true : what === "nonland permanent" ? !/\bLand\b/.test(e.t || "")
    : new RegExp(`\\b${what.replace(/^(nontoken|attacking|tapped) /, "")}\\b`, "i").test(e.t || "");
  // ----- Response window: effects that hit other players wait for everyone to pass -----
  const needsWindow = r => r.effs?.some(f => f.k === "tloseGame" || f.k === "airbend" || f.k === "tlose" || f.k === "remove" || (f.k === "setlife" && f.scope !== "you"));
  const opponents = () => seated(room).filter(o => o.id !== pid && !isOut(o));
  function announceWindows() {
    if (!room || room.pending) return; // one at a time; the next one waits its turn
    const r = reminders.find(x => needsWindow(x) && !x.announced);
    if (!r) return;
    r.announced = true;
    const opps = opponents();
    if (!opps.length) { r.forced = true; return; }
    const f = r.effs.find(x => x.k === "tloseGame" || x.k === "airbend" || x.k === "tlose" || x.k === "remove" || x.k === "setlife");
    const text = f.k === "tloseGame" ? "Target player loses the game" : f.k === "airbend" ? airLabel(f).replace(/\. Choose.*$|:$/, "") : f.k === "remove" ? removeLabel(f, r) : f.k === "setlife" ? f.label : `Target player loses ${f.n * (r.times || 1)} life`;
    update(ref(db, `rooms/${code}`), { pending: { id: r.id, by: pid, byName: me.name, src: r.src, text, castKey: r.castKey && !steps[r.castKey]?.reverted ? r.castKey : null,
      waiting: Object.fromEntries(opps.map(o => [o.id, "wait"])), at: Date.now() } });
    logTo(code, `⏳ ${me.name}: ${r.src} (${text}). Any responses?`);
  }
  function windowState(r) {
    if (!needsWindow(r)) return { ready: true, html: "" };
    if (r.forced) return { ready: true, html: "" };
    const pend = room.pending?.id === r.id ? room.pending : null;
    if (!pend) return { ready: false, html: `<div class="wait-line">⏳ Waiting to announce (another effect is resolving)</div>` };
    const left = Object.entries(pend.waiting || {}).filter(([, v]) => v !== "pass");
    if (!left.length) return { ready: true, html: `<div class="wait-line ok">✓ Everyone passed. Resolve when ready.</div>` };
    const who = left.map(([id, v]) => `${esc(room.players?.[id]?.name || "?")}${v === "respond" ? " (responding)" : ""}`).join(", ");
    return { ready: false, html: `<div class="wait-line">⏳ Waiting on ${who} <button class="linkish" data-a="force" data-id="${r.id}">Resolve anyway</button></div>` };
  }
  function clearWindow(r) {
    if (room?.pending?.id === r.id) update(ref(db, `rooms/${code}`), { pending: null });
  }
  // Opponent side: "Kari is casting X. Respond?"
  function responseBox() {
    const pend = room?.pending;
    if (!pend || pend.by === pid) return "";
    const mine = pend.waiting?.[pid];
    if (!mine || mine === "pass") return "";
    return `<div class="respond-box">
      <div><b>${esc(pend.byName)}</b> is resolving <b>${esc(pend.src)}</b>: ${esc(pend.text)}</div>
      <div class="row">${mine === "respond"
        ? `${answersHtml(pend)}<span class="mini">Waiting for you to finish responding…</span><button class="btn small primary" data-a="pass">Done responding</button>`
        : `<button class="btn small primary" data-a="pass">No response</button><button class="btn small" data-a="respond">Respond</button>`}</div>
    </div>`;
  }

  // ----- Gifts & notes sent to other players ("Kari: draw a card") -----
  function sendNote(oid, note) {
    const nid = newId();
    update(ref(db, `rooms/${code}/notes/${oid}`), { [nid]: { from: me.name, at: Date.now(), ...note } });
  }
  let handAskOpen = false;
  const handAskForm = () => !handAskOpen ? "" : `<div class="ask-box hand-box">
      <div><b>👁 Ask to see a hand</b></div>
      <div class="row"><select id="ha-opp" class="fetch-pick">${opponents().filter(o => !isOut(o)).map(o => `<option value="${o.id}">${esc(o.name)}</option>`).join("")}</select>
        <input id="ha-why" placeholder="Why? e.g. Thoughtseize" maxlength="40" autocomplete="off"></div>
      <label class="mode-check"><input type="checkbox" class="ha-pick" value="1"><span>I choose a card for them to discard</span></label>
      <div class="row"><button class="btn small primary" data-a="hand-ask-send">Send request</button><button class="btn small ghost" data-a="hand-ask-close">Cancel</button></div>
    </div>`;
  const handDeckList = () => [...new Map((deck?.cards || []).filter(c => !deck.cmds?.includes(c.n)).map(c => [c.n, c])).values()].sort((a, b) => dispName(a).localeCompare(dispName(b)));
  function notesBox() {
    // combat results first (newest on top): what just died matters before the next attacker is blocked
    const rank = n => n.kind === "blkres" || n.src === "Blocks" ? 0 : 1;
    const mine = Object.entries(room?.notes?.[pid] || {}).sort(([, a], [, b]) => rank(a) - rank(b) || (rank(a) ? 0 : (b.at || 0) - (a.at || 0)));
    return handAskForm() + mine.map(([nid, n]) => n.kind === "handask" ? `<div class="ask-box hand-box">
      <div>👁 <b>${esc(n.from)}</b>${n.src ? ` (${esc(n.src)})` : ""} wants to see your hand${n.pick ? " and choose a card for you to discard" : ""}.</div>
      ${dig?.on ? `<div class="row"><button class="btn small primary" data-a="hand-show" data-n="${nid}">Show my hand (${dig.hand.length} card${dig.hand.length === 1 ? "" : "s"})</button><button class="btn small" data-a="hand-decline" data-n="${nid}">Decline</button></div>`
        : `<div class="mini">Tick the cards you're holding:</div>
      <input id="hs-q-${nid}" class="hs-q full" data-rid="${nid}" placeholder="Search your deck…" autocomplete="off">
      <div class="hs-list">${handDeckList().map(c => `<label class="mode-check hs-item" data-nm="${esc(dispName(c).toLowerCase())}"><input type="checkbox" class="hs-box" data-rid="${nid}" value="${esc(c.n)}"><span>${esc(dispName(c))}</span></label>`).join("") || `<p class="mini">No deck loaded: import it on the Deck tab.</p>`}</div>
      <div class="row"><button class="btn small primary" data-a="hand-show" data-n="${nid}">Show these</button><button class="btn small" data-a="hand-decline" data-n="${nid}">Decline</button></div>`}
    </div>` : n.kind === "handshow" ? `<div class="ask-box hand-box">
      <div>👁 <b>${esc(n.from)}</b>'s hand${n.src ? ` (${esc(n.src)})` : ""}: ${(n.cards || []).length} card${(n.cards || []).length === 1 ? "" : "s"}${n.digital ? "" : " <span class=\"muted\">(ticked from their decklist)</span>"}</div>
      ${n.pick ? `<div class="mini"><b>Tap the card they must discard.</b></div>` : ""}
      <div class="hs-cards">${(n.cards || []).map((c, j) => `<button class="hs-card" data-a="${n.pick ? "hand-pickcard" : "hand-view"}" data-n="${nid}" data-j="${j}">${c.img ? `<img src="${esc(c.img)}" alt="" loading="lazy">` : ""}<span>${esc(c.n)}</span></button>`).join("") || `<p class="mini">Their hand is empty.</p>`}</div>
      <div class="row"><button class="btn small" data-a="note-done" data-n="${nid}">Done</button></div>
    </div>` : n.kind === "discardask" ? `<div class="hit-box">
      <div>🗑 <b>${esc(n.from)}</b>${n.src ? `'s ${esc(n.src)}` : ""}: discard <b>${esc(n.card)}</b>.</div>
      <div class="row"><button class="btn small primary" data-a="hand-discard" data-n="${nid}">Discard it</button><button class="btn small" data-a="note-done" data-n="${nid}">Done</button></div>
    </div>` : n.kind === "millLog" ? `<div class="ask-box">
      <div>🪦 ${n.from === me.name ? `<b>${esc(n.src)}</b>: you milled ${n.n} card${n.n === 1 ? "" : "s"}` : `<b>${esc(n.from)}</b>'s <b>${esc(n.src)}</b> put ${n.n} card${n.n === 1 ? "" : "s"} from your library into your graveyard`}. Which?</div>
      ${dig?.on && n.n ? `<div class="mini">🂠 Top ${Math.min(n.n, dig.lib.length)} of your digital library: <b>${esc(dig.lib.slice(0, n.n).join(", ") || "(empty)")}</b></div>
      <div class="row"><button class="btn small primary" data-a="ml-go" data-n="${nid}">Put them in the graveyard</button></div>` : `
     <div class="row">${n.n > 6 ? `<div class="modes">${(deck?.cards || []).map((c, i) => [c, i]).sort((a, b) => a[0].n.localeCompare(b[0].n)).map(([c, i]) => `<label class="mode-check"><input type="checkbox" class="ml-box" data-n="${nid}" value="${i}"><span>${esc(dispName(c))}</span></label>`).join("")}</div>` : ""}${Array.from({ length: n.n > 6 ? 0 : n.n }, (_, j) => `<select class="fetch-pick ml-pick" data-n="${nid}"><option value="">Pick a card…</option>${(deck?.cards || []).map((c, i) => [c, i]).sort((a, b) => a[0].n.localeCompare(b[0].n)).map(([c, i]) => `<option value="${i}">${esc(dispName(c))}</option>`).join("")}</select>`).join("")}
        <button class="btn small primary" data-a="ml-go" data-n="${nid}">Add to graveyard</button><button class="btn small" data-a="ml-skip" data-n="${nid}">Skip</button></div>`}
    </div>` : n.kind === "count" ? `<div class="ask-box">
      <div>❓ <b>${esc(n.from)}</b>'s <b>${esc(n.src)}</b>: ${esc(n.text)}</div>
      <div class="row"><input type="number" min="0" inputmode="numeric" class="x-input" id="cn-${nid}"><button class="btn small primary" data-a="count-send" data-n="${nid}">Send</button></div>
    </div>` : n.kind === "opick" ? `<div class="ask-box">
      <div>🔎 <b>${esc(n.from)}</b>'s <b>${esc(n.src)}</b>: ${n.mode === "split" ? "split these into two piles. Tick pile 1; the rest are pile 2. They take one pile." : n.mode === "piles" ? "choose a pile. They get it in hand; the other goes to their graveyard." : `choose ${n.pick}. ${n.chosenTo === "hand" ? "They get your choice in hand" : "Your choice goes to their graveyard"}; the rest go to their ${n.restTo}.`}</div>
      ${n.mode === "piles" ? `<div class="row">${n.piles.map((pile, i) => `<button class="btn small primary" data-a="opick-pile" data-n="${nid}" data-i="${i}">Pile ${i + 1}: ${esc(pile.join(", ") || "(empty)")}</button>`).join("")}</div>`
        : `<div class="modes">${n.cards.map((c, j) => `<label class="mode-check"><input type="checkbox" class="opick-box" data-n="${nid}" value="${j}"><span>${c.img ? `<img class="op-thumb" src="${esc(c.img)}" alt="">` : ""}${esc(c.n)}</span></label>`).join("")}</div>
      <div class="row"><button class="btn small primary" data-a="opick-go" data-n="${nid}">${n.mode === "split" ? "These are pile 1" : `Choose ${n.pick}`}</button></div>`}
    </div>` : n.kind === "edict" ? `<div class="hit-box">
      <div>🗡 <b>${esc(n.from)}</b>'s <b>${esc(n.src)}</b>: ${esc(n.text)}</div>
      <div class="row">${edictPicker(`n:${nid}`, n.n || 1, n.filter)}</div>
    </div>` : n.kind === "hit" ? `<div class="hit-box">
      <div>⚔ <b>${esc(n.from)}</b>'s <b>${esc(n.src)}</b>${n.stats ? ` <span class="pt">${n.stats.p}/${n.stats.t}</span>${(n.times || 1) > 1 ? " each" : ""}` : ""}${n.cmdKey ? " <span class=\"pill\">commander</span>" : ""} ${(n.times || 1) > 1 ? "are" : "is"} attacking you.${n.stats ? (() => { const k = (n.stats.kws || []).filter(x => /^(flying|trample|menace|deathtouch|first strike|double strike|lifelink|indestructible|vigilance|infect|wither|fear|intimidate|shadow|skulk|horsemanship|protection from .+|[a-z]+walk)$/.test(x)); return k.length ? `<div class="mini kws-line">${esc([...new Set(k)].join(" · "))}</div>` : ""; })() : ""}</div>
      ${n.evade ? `<div class="mini ring-note">🛡 ${esc(n.evade.src)}: creatures with power less than ${n.evade.n} can't block it.</div>` : ""}
      ${n.ring ? `<div class="mini ring-note">💍 Ring-bearer: can't be blocked by creatures with power greater than ${n.power}${n.ring >= 3 ? " · if you block it, you sacrifice the blocker at end of combat" : ""}${n.ring >= 4 ? ` · if it deals you combat damage, each of ${esc(n.from)}'s opponents loses 3 life` : ""}</div>` : ""}
      ${preventMe() ? `<div class="mini ring-note">🛡 ${esc(preventMe())}: all damage that would be dealt to you is prevented.</div>` : ""}
      <div class="row"><label class="mini">Damage <input type="number" min="0" inputmode="numeric" class="x-input" id="hd-${nid}" value="${preventMe() ? 0 : n.power}"></label>
        <button class="btn small primary" data-a="hit-take" data-n="${nid}">Take damage</button>
        ${n.trample ? "" : `<button class="btn small" data-a="hit-block" data-n="${nid}" title="Blocked by something the app doesn't list">Blocked (other)</button>`}</div>
      ${n.stats && !n.res ? (() => { const pv = blockPreview(n.stats, { ...me, id: pid }), no = pv.rows.filter(b => b.why);
        return `<div class="blk-pick"><div class="mini"><b>🛡 Declare blockers</b>${pv.menace ? " · menace: needs 2 or more" : ""}${(n.times || 1) > 1 ? ` · blocks one of the ${n.times}` : ""}</div>
        ${pv.able.length ? `<div class="modes">${pv.able.map(b => b.kind === "tok" && b.avail > 1
          ? `<label class="mode-check blk"><input type="number" class="blk-num x-input" data-n="${nid}" data-v="${b.kind}:${esc(b.id)}" min="0" max="${b.avail}" value="0" inputmode="numeric"><span>${esc(b.name)} <b>${b.p}/${b.t}</b> <span class="muted">(how many? ${b.avail} untapped)</span><span class="mini blk-out">${esc(outText(b, false))}</span></span></label>`
          : `<label class="mode-check blk"><input type="checkbox" class="blk-box" data-n="${nid}" value="${b.kind}:${esc(b.id)}"><span>${esc(b.name)} <b>${b.p}/${b.t}</b><span class="mini blk-out">${esc(outText(b, false))}</span></span></label>`).join("")}</div>
        <button class="btn small primary" data-a="hit-blockwith" data-n="${nid}">🛡 Block with selected</button>` : `<div class="mini muted">None of your creatures can block it.</div>`}
        ${no.length ? `<div class="mini muted">Can't block: ${no.map(b => `${esc(b.name)} (${esc(b.why)})`).join(", ")}</div>` : ""}</div>`; })() : ""}
      ${false ? (() => { const pv = blockPreview(n.stats, { ...me, id: pid }); return `<details class="plan-opp"><summary>🛡 Your blockers: ${pv.able.length ? `${pv.able.length} can block${pv.menace ? " (menace: needs 2)" : ""}` : "none can block it"}</summary>${pv.rows.map(b => `<div class="mini plan-row ${b.out ? "" : "muted"}">${esc(b.name)} <b>${b.p}/${b.t}</b> — ${esc(outText(b, false))}${b.out?.tramp ? ` · ${b.out.tramp} tramples over to you` : ""}</div>`).join("")}</details>
        ${n.trample && pv.able.length ? `<div class="row"><select class="fetch-pick" id="tb-${nid}">${pv.able.map(b => `<option value="${kwHas(n.stats.kws, "deathtouch") ? 1 : b.t}">${esc(b.name)} (${b.p}/${b.t})</option>`).join("")}</select><button class="btn small" data-a="hit-trample" data-n="${nid}">Blocked: take trample damage</button></div>` : ""}`; })() : ""}
    </div>` : n.kind === "blkres" ? `<div class="hit-box">
      <div>🛡 <b>${esc(n.text)}</b></div>
      ${n.note ? `<div class="mini">${esc(n.note)}</div>` : ""}
      <div class="row">${(n.dies || []).filter(d => d.kind === "bf" ? me.bf?.[d.id] : me.tokens?.[d.id]?.count > 0).map(d => d.kind === "bf" ? `<button class="btn small" data-a="move" data-id="${esc(d.id)}" data-dest="Graveyard">☠ ${esc(d.name)} died</button>` : `<button class="btn small" data-a="tok-rm-go" data-k="${esc(d.id)}" data-how="died">☠ ${esc(d.name)} died</button>`).join("")}
        <button class="btn small primary" data-a="note-done" data-n="${nid}">Done</button></div>
    </div>` : n.kind === "ask" ? `<div class="ask-box">
      <div>❓ <b>${esc(n.from)}</b>'s <b>${esc(n.src)}</b>: ${esc(n.text)}</div>
      <div class="row"><button class="btn small primary" data-a="note-answer" data-n="${nid}" data-v="yes">${esc(n.yes)}</button>
        <button class="btn small" data-a="note-answer" data-n="${nid}" data-v="no">${esc(n.no)}</button></div>
    </div>` : `<div class="gift-box">
      <div>🎁 <b>${esc(n.from)}</b>${n.src ? ` (${esc(n.src)})` : ""}: ${esc(n.text)}</div>${digExtras(n.text, `data-nt="${nid}"`, "n" + nid)}
      <div class="row">${n.drawN && !dig?.on ? `<button class="btn small primary" data-a="note-drew" data-n="${nid}" title="Record the draws so draw triggers (yours and the table's) fire">🂠 Drew ${n.drawN}</button>` : ""}${n.token ? `<button class="btn small primary" data-a="note-take" data-n="${nid}">Take ${esc(n.token)}${n.tapped ? " (tapped)" : ""}</button>` : ""}
        <button class="btn small ${n.token ? "" : "primary"}" data-a="note-done" data-n="${nid}">${n.token ? "Dismiss" : "Done"}</button></div>
    </div>`).join("");
  }
  // "That player may pay {2}. If they don't…": ask the player who triggered it, then resolve their answer
  function punishAsk(r) {
    let ask = r.punish.ask;
    if (/\{X\}/.test(ask) && /power/i.test(r.punish.xIs || "")) {
      const e = me.bf?.[r.srcId];
      const pt = e ? ptOf(e, countsFor(me)) : "";
      if (pt) ask = ask.replace("{X}", `{${pt.split("/")[0]}}`);
    }
    return ask;
  }
  // ----- Losing -----
  // Everybody Lives! ("Players gain hexproof until end of turn"): other players can't be targeted
  const PLAYER_TARGET_ACTS = new Set(["rem-target", "tlx-go", "ol-go", "tp-go", "edict-target", "gh-go", "mill-to", "tgain-go", "ctl-go", "draw-to", "ping-go", "dd-go", "bombs-go", "altdraw", "sx-who", "spoil-go", "pairhurt-go"]);
  const playerHexproof = o => !!o && o.id !== pid && room?.noLoss?.hexproof && room.noLoss.turnNo === (room.turnNo || 0);
  function lockHexPlayers() {
    if (!room?.noLoss?.hexproof || room.noLoss.turnNo !== (room.turnNo || 0)) return;
    document.querySelectorAll("#remBox button[data-o], #remBox option[value]").forEach(b => {
      const oid = b.tagName === "BUTTON" ? b.dataset.o : null;
      if (b.tagName === "BUTTON" && PLAYER_TARGET_ACTS.has(b.dataset.a) && playerHexproof(room.players?.[oid])) { b.disabled = true; b.title = `Hexproof this turn (${room.noLoss.src})`; if (!b.textContent.startsWith("🛡")) b.textContent = `🛡 ${b.textContent}`; }
    });
    document.querySelectorAll("#remBox select option").forEach(op => { const m = /^(pl|player):(\w+)$/.exec(op.value || ""); if (m && playerHexproof(room.players?.[m[2]])) op.disabled = true; });
  }
  // Equipment granting "Whenever you cast a noncreature spell and whenever you draw your third card each turn, put a +1/+1 counter on this creature."
  function eqCounterTrigger(why) {
    Object.entries(me.bf || {}).forEach(([sid, a]) => {
      const o = String(a.o || lookupCard(a.n)?.o || "");
      if (!a.att || !/has "whenever you cast a noncreature spell and whenever you draw your third card each turn, put a \+1\/\+1 counter on this creature/i.test(o)) return;
      if (a.att === "tok") { const k = Object.keys(me.tokens || {}).find(x => eqList(me.tokens[x]).includes(sid)); if (k) act([{ type: "effects", effs: [{ k: "countersOn", target: { kind: "tok", id: k }, n: 1, key: "p1p1", label: "+1/+1" }], times: 1, count: 1, src: `${dispName(a)} (${why})` }]); }
      else if (me.bf?.[a.att]) act([{ type: "effects", effs: [{ k: "countersOn", target: { kind: "bf", id: a.att }, n: 1, key: "p1p1", label: "+1/+1" }], times: 1, count: 1, src: `${dispName(a)} (${why})` }]);
    });
  }
  // Double-faced cards: flip in place (Transform) or leave and come back on the other face
  // Day / night: daybound permanents show their front by day, nightbound their back by night
  let dnSeen = null; const dnBusy = new Set();
  function dnSync() {
    if (!me || !room) return;
    const dn = room.dn || null, faceO = e => { const c = deckCard(e.n) || lookupCard(e.n); return c?.faces?.length ? faceCard(c, e.face || 0).o || "" : String(e.o || ""); };
    if (!dn) { if (Object.values(me.bf || {}).some(e => /^Daybound\b/m.test(faceO(e)))) { update(ref(db, `rooms/${code}`), { dn: "day" }); logTo(code, "☀ It becomes day (a daybound permanent arrived)"); } return; }
    Object.entries(me.bf || {}).forEach(([id, e]) => { const o = faceO(e), k = `${id}:${e.face || 0}:${dn}`;
      if ((dn === "night" ? /^Daybound\b/m.test(o) : /^Nightbound\b/m.test(o)) && !dnBusy.has(k)) { dnBusy.add(k); flipFace(id, false, false, dn); } });
    if (dnSeen && dnSeen !== dn) Object.entries(me.bf || {}).forEach(([id, e]) => { const m = faceO(e).match(/^whenever day becomes night or night becomes day, ([^\n]+)/im);
      if (m) { const sp = spellAbility({ n: `${e.n} · day/night`, t: "Instant", o: m[1] }); reminders.push(normalizeRem({ id: newId(), src: dispName(e), srcId: id, text: m[1].replace(/^\w/, c => c.toUpperCase()), times: 1, ...(sp.effs.length ? { effs: sp.effs } : {}) })); setTimeout(render, 0); } });
    dnSeen = dn;
  }
  // Face-down 2/2s (disguise, morph, megamorph, cloak, manifest): no name or abilities until turned face up
  function playFaceDown(fd) {
    const ward = /^(Disguise|cloak)$/i.test(fd.how || "");
    playCard({ n: "Face-down creature", fname: "🂠 Face-down", t: "Creature", o: ward ? "Ward {2}" : "(No abilities while face down.)", p: "2", tg: "2", m: "", fd }, { via: fd.card ? "" : "face down" });
    setTimeout(() => { const id = Object.keys(me.bf || {}).reverse().find(k => me.bf[k].n === "Face-down creature" && !me.bf[k].fd); if (id) mutate(p => { if (p.bf?.[id]) p.bf[id].fd = fd; });
      Object.entries(me.bf || {}).forEach(([wid, w]) => { const m = String(w.o || lookupCard(w.n)?.o || "").match(/^whenever a face-down creature you control enters, ([^\n]+)/im); // Trail of Mystery
        if (m) { const sp = spellAbility({ n: `${w.n} · face-down enters`, t: "Instant", o: m[1] }); const f = sp.effs.find(x => x.k === "fetch"); reminders.push(f ? { id: newId(), src: dispName(w), srcId: wid, text: "Search your library", fetch: f, left: 1, times: 1, note: "Optional." } : normalizeRem({ id: newId(), src: dispName(w), srcId: wid, text: m[1].replace(/^\w/, c => c.toUpperCase()), times: 1 })); } });
      render(); }, 0);
  }
  function turnFaceUp(id) {
    const e = me.bf?.[id]; if (!e?.fd) return;
    let card = e.fd.card;
    if (!card) { const nm = (prompt("Which card is it?") || "").trim(); card = nm && (deckCard(nm) || lookupCard(nm)); if (!card) { toast("Card not found. Type its exact name."); return; } }
    const mega = /^Megamorph$/i.test(e.fd.how || "");
    mutate(p => { const x = p.bf?.[id]; if (!x) return; Object.assign(x, { n: card.n, t: card.t, o: card.o, m: card.m || "", img: card.img || "" }); if (card.p != null) { x.p = String(card.p); x.tg = String(card.tg); } delete x.fd; delete x.fname; if (mega) { x.c ||= {}; x.c.p1p1 = (x.c.p1p1 || 0) + 1; } });
    logTo(code, `🂡 ${me.name} turned ${card.n} face up${e.fd.cost ? ` (${e.fd.how} ${e.fd.cost})` : ""}${mega ? " with a +1/+1 counter" : ""}`);
    const fx = t => { const sp = spellAbility({ n: `${card.n} · face up · ${t}`, t: "Instant", o: t }); return sp.effs.filter(f => f.k !== "selfc"); };
    const self = String(card.o || "").match(/^When this (?:creature|permanent|land) is turned face up, ([^\n]+)/im);
    if (self) { const ef = fx(self[1]); reminders.push(normalizeRem({ id: newId(), src: card.n, srcId: id, text: self[1].replace(/^\w/, c => c.toUpperCase()), times: 1, ...(ef.length ? { effs: ef } : {}) })); }
    Object.entries(me.bf || {}).forEach(([wid, w]) => { const o = String(w.o || lookupCard(w.n)?.o || "");
      for (const m of o.matchAll(/^whenever (?:a|another) permanent you control is turned face up, (?:if it's a creature, )?([^\n]+)|^whenever this (?:creature|enchantment) or another (?:creature|permanent) you control is turned face up, ([^\n]+)/gim)) {
        if (/^whenever another/i.test(m[0]) && wid === id) continue;
        const t = m[1] || m[2], cm = t.match(/^put (a|an|one|two|three) \+1\/\+1 counters? on it\.?$/i);
        if (cm && /\bCreature\b/.test(card.t || "")) { const n = ({ a: 1, an: 1, one: 1, two: 2, three: 3 })[cm[1].toLowerCase()]; mutate(p => { const x = p.bf?.[id]; if (x) { x.c ||= {}; x.c.p1p1 = (x.c.p1p1 || 0) + n; } }); logTo(code, `⚙ ${dispName(w)}: ${n} +1/+1 counter${n === 1 ? "" : "s"} on ${card.n}`); continue; }
        const ef = fx(t); reminders.push(normalizeRem({ id: newId(), src: dispName(w), srcId: wid, text: `${card.n} turned face up: ${t.replace(/^\w/, c => c.toUpperCase())}`, times: 1, ...(ef.length ? { effs: ef } : {}) })); } });
    render();
  }
  function flipFace(id, reenter, front, src) {
    const e = me.bf?.[id], card = e && (deckCard(e.n) || lookupCard(e.n));
    if (!e || !card?.faces?.length) { toast("That card has no other face."); return; }
    const to = front ? 0 : 1 - (e.face || 0), fc = faceCard(card, to);
    if (reenter) {
      act([], p => { detachIn(p, id); Object.values(p.bf || {}).forEach(a => { if (a.att === id) delete a.att; }); delete p.bf[id]; });
      logTo(code, `🔄 ${me.name}'s ${dispName(e)} left and returned as ${fc.fname}`);
      setTimeout(() => playCard(fc, { via: src || "transform" }), 0);
      return;
    }
    mutate(p => { const x = p.bf?.[id]; if (!x) return; Object.assign(x, { face: to, fname: fc.fname, t: fc.t, o: fc.o, img: fc.img || x.img }); if (fc.p != null) { x.p = String(fc.p); x.tg = String(fc.tg); } else { delete x.p; delete x.tg; } });
    logTo(code, `🔄 ${me.name}'s ${dispName(e)} transformed into ${fc.fname}`);
    { const tm = String(fc.o || "").match(/^whenever this creature transforms into [^,]+, ([^\n]+)/im); // Huntmaster, Ulrich
      if (tm) { const sp = spellAbility({ n: `${fc.fname} · transforms`, t: "Instant", o: tm[1] }); reminders.push(normalizeRem({ id: newId(), src: fc.fname, srcId: id, text: tm[1].replace(/^\w/, c => c.toUpperCase()), times: 1, ...(sp.effs.length ? { effs: sp.effs.filter(f => f.k !== "selfc") } : {}) })); setTimeout(render, 0); } }
    Object.entries(me.bf || {}).forEach(([aid, a]) => { if (a.att === id && /when equipped creature transforms, transform this equipment/i.test(String(a.o || lookupCard(a.n)?.o || ""))) setTimeout(() => flipFace(aid, false, false, "equipped creature transformed"), 0); });
  }
  // Tezzeret −2: an artifact becomes an artifact creature with base P/T (Vehicles keep theirs)
  function animateMine(id, pw, tg, src) {
    const e = me.bf?.[id]; if (!e) return;
    const veh = /\bVehicle\b/.test(e.t || "");
    mutate(p => { const x = p.bf?.[id]; if (!x) return; if (!/\bCreature\b/.test(x.t || "")) x.t = x.t.replace(/\bArtifact\b/, "Artifact Creature"); if (!veh) { x.p = String(pw); x.tg = String(tg); } });
    logTo(code, `⚙ ${src}: ${me.name}'s ${dispName(e)} is now an artifact creature${veh ? "" : ` (${pw}/${tg})`}`);
  }
  // Liquimetal Coating: a type added until end of turn
  function addTypeMine(id, type, src) {
    const t = room.turnNo || 0;
    mutate(p => { const x = p.bf?.[id]; if (!x || new RegExp(`\\b${type}\\b`).test(x.t || "")) return; x.typeAdd = { t: x.t, turn: t }; x.t = `${type} ${x.t}`.replace(/^(\w+) (Legendary|Basic|Snow) /, "$2 $1 "); });
    logTo(code, `⚙ ${src}: ${me.name}'s ${dispName(me.bf?.[id] || {})} is ${/^[aeiou]/i.test(type) ? "an" : "a"} ${type.toLowerCase()} until end of turn`);
  }
  const elixirOn = () => Object.values(me?.bf || {}).some(x => /you may activate abilities of creatures you control as though those creatures had haste/i.test(x.o || lookupCard(x.n)?.o || ""));
  function markLost(reason) {
    if (me.lost) return;
    { const pa = Object.values(me.bf || {}).find(x => /you can't lose the game and your opponents can't win the game/i.test(x.o || lookupCard(x.n)?.o || "")); if (pa) { logTo(code, `🛡 ${me.name} can't lose the game (${dispName(pa)}) — ${reason}`); toast(`${dispName(pa)}: you can't lose the game.`); return; } }
    if (room?.noLoss?.game && room.noLoss.turnNo === (room.turnNo || 0)) { logTo(code, `🛡 ${me.name} can't lose the game this turn (${room.noLoss.src}) — ${reason}`); return; }
    logTo(code, `💀 ${me.name} loses the game (${reason})`);
    update(ref(db, pPath), { lost: { reason, at: Date.now() } });
  }

  // ----- Alternate win conditions -----
  function declareWin(src) {
    if (room.winner) return;
    // Platinum Angel / Angel's Grace ("your opponents can't win the game"), Abyssal Persecutor ("you can't win the game")
    const stop = [...seated(room).filter(o => o.id !== pid && !isOut(o)).flatMap(o => Object.values(o.bf || {}).filter(e => /your opponents can't win the game/i.test(e.o || "")).map(e => `${o.name}'s ${dispName(e)}`)),
      ...Object.values(me.bf || {}).filter(e => /\byou can't win the game/i.test(e.o || lookupCard(e.n)?.o || "")).map(e => `your ${dispName(e)}`)][0];
    if (stop) { logTo(code, `🚫 ${me.name} would win (${src}), but ${stop} says they can't win`); toast(`Can't win: ${stop}`); return; }
    update(ref(db, `rooms/${code}`), { winner: { pid, name: me.name, src, at: Date.now() } });
    logTo(code, `🏆 ${me.name} wins the game! (${src})`);
  }
  // Check a win clause; when the app can't evaluate it, ask the player
  function checkWin(card, srcId, rule) {
    if (room?.noLoss?.game && room.noLoss.turnNo === (room.turnNo || 0)) { toast(`${room.noLoss.src}: nobody can win the game this turn`); return; }
    let res = evalWin(rule, me, srcId);
    if (rule.cond.castBefore) { // Approach of the Second Sun: count your casts of it this game
      const n = Object.values(room.casts || {}).filter(c => c.by === pid && c.n === card.n).length;
      res = { met: n >= 2, progress: `cast ${n} time${n === 1 ? "" : "s"} this game` };
      if (!res.met && /gain (\d+) life/i.test(rule.cond.otherwise)) {
        const g = Number(rule.cond.otherwise.match(/gain (\d+) life/i)[1]);
        act([], p => { p.life = (p.life ?? START_LIFE) + g; });
        logTo(code, `${me.name} gained ${g} life (${dispName(card)})`);
        reminders.push({ id: newId(), src: dispName(card), text: "Put it into your library seventh from the top.", times: 1, note: "Cast it again later to win." });
        render(); return;
      }
    }
    const name = dispName(card);
    if (res.met === true) { declareWin(name); return; }
    if (res.met === null) {
      reminders.push({ id: newId(), src: name, text: rule.text, times: 1, winAsk: true });
    } else if (rule.when !== "state") {
      logTo(code, `${name}: win condition not met (${res.progress})`);
      reminders.push({ id: newId(), src: name, text: `Not yet: ${res.progress}`, times: 1, note: res.missing || "" });
    }
    render();
  }
  function checkWinsAt(when) {
    Object.entries(me.bf || {}).forEach(([id, e]) => {
      const c = lookupCard(e.n), rule = c && winRule(c);
      if (rule && rule.when === when) checkWin(c, id, rule);
    });
  }

  // ----- Imprint (Chrome Mox): record which card was exiled -----
  function imprintPicker(r) {
    const f = r.effs.find(x => x.k === "imprint");
    const onBf = n => Object.values(me.bf || {}).filter(e => e.n === n).length;
    const list = (deck?.cards || []).map((c, i) => [c, i]).filter(([c]) => matchesSearch(c, { alts: f.alts }, null) && c.qty - onBf(c.n) > 0 && dispName(c) !== r.src && (!dig?.on || dig.hand.includes(c.n)))
      .sort((a, b) => a[0].n.localeCompare(b[0].n));
    if (!list.length) return `<span class="mini">No ${esc(f.what)} cards in your deck list.</span>`;
    return `<select class="fetch-pick" id="ip-${r.id}">${list.map(([c, i]) => `<option value="${i}">${esc(dispName(c))}</option>`).join("")}</select>
      <button class="btn small primary" data-a="imprint-go" data-id="${r.id}">Exile it</button>`;
  }
  // ----- Suspend: exile with time counters, tick down each upkeep, cast when the last comes off -----
  function suspendCard(c) {
    const sp = suspendOf(c);
    if (!sp) return;
    const id = newId();
    logTo(code, `⏳ ${me.name} suspended ${dispName(c)} (${sp.time} time counters)`);
    act([], p => { p.susp ||= {}; p.susp[id] = { n: c.n, t: c.t || "", m: c.m || "", img: c.img || "", ...(c.o ? { o: c.o } : {}), ...(c.nick ? { nick: c.nick } : {}), time: sp.time }; });
  }
  function tickSuspend() {
    const list = Object.entries(me.susp || {});
    if (!list.length) return;
    act([], p => Object.values(p.susp || {}).forEach(e => { e.time = Math.max(0, (e.time || 0) - 1); }));
    list.forEach(([id, e]) => {
      const left = Math.max(0, (e.time || 0) - 1);
      logTo(code, `⏳ ${dispName(e)}: ${left ? `${left} time counter${left === 1 ? "" : "s"} left` : "last time counter removed!"}`);
      if (!left) reminders.push({ id: newId(), src: dispName(e), text: "Cast it without paying its mana cost.", times: 1, suspCast: id });
    });
    render();
  }
  function castSuspended(sid) {
    const e = me.susp?.[sid];
    if (!e) return;
    const card = lookupCard(e.n) || e;
    act([], p => { delete p.susp[sid]; });
    playCard(card, {});
    if (/\bCreature\b/.test(card.t || "")) toast("Cast from suspend: it has haste.");
  }

  // ----- Edicts: the player who must sacrifice chooses on their own phone -----
  function edictVictims(r, f) {
    const live = seated(room).filter(o => !isOut(o));
    if (f.who === "that") return r.who ? live.filter(o => o.id === r.who) : null;
    if (f.who === "each") return live;
    if (f.who === "opps") return live.filter(o => o.id !== pid);
    if (f.who === "you") return live.filter(o => o.id === pid);
    return null; // target: the caster picks
  }
  function sendEdicts(r, victims) {
    const f = r.effs.find(x => x.k === "edict");
    const n = (f.n || 1) * (r.times || 1);
    victims.forEach(o => {
      const note = { kind: "edict", text: `Sacrifice ${n > 1 ? n + " × " : /^[aeiou]/i.test(f.what) ? "an " : "a "}${f.what}.`, src: r.src, n, filter: f.filter };
      if (o.id === pid) reminders.push({ id: newId(), src: r.src, text: note.text, times: 1, edictLocal: note });
      else sendNote(o.id, note);
    });
    logTo(code, `${r.src}: ${victims.map(o => o.name).join(", ")} must sacrifice ${/^[aeiou]/i.test(f.what) ? "an" : "a"} ${f.what}`);
  }
  function dispatchEdicts() {
    reminders.filter(r => r.oppsTok).forEach(r => {
      reminders = reminders.filter(x => x !== r);
      const f = r.oppsTok, n = f.n * (r.times || 1), opps = seated(room).filter(o => o.id !== pid && !isOut(o));
      opps.forEach(o => sendNote(o.id, { text: `Create ${n === 1 ? "a" : n}${f.tapped ? " tapped" : ""} ${f.desc} token${n === 1 ? "" : "s"}.`, token: f.name, count: n, desc: f.desc, src: r.src, ...(f.tapped ? { tapped: true } : {}) }));
      if (opps.length) logTo(code, `${r.src}: ${opps.map(o => o.name).join(", ")} each create ${n} ${f.name}`);
    });
    reminders.filter(r => r.effs?.some(f => f.k === "edict") && !r.edictSent).forEach(r => {
      const f = r.effs.find(x => x.k === "edict");
      const v = edictVictims(r, f);
      if (!v) return; // needs a target pick first
      r.edictSent = true;
      reminders = reminders.filter(x => x.id !== r.id);
      if (v.length) sendEdicts(r, v);
    });
  }
  // What this phone could sacrifice for an edict
  function sacOptions(filter) {
    const out = [];
    Object.entries(me.bf || {}).forEach(([id, e]) => { if (permanentMatches(e, filter)) out.push({ v: `bf|${id}`, label: dispName(e) }); });
    Object.entries(me.tokens || {}).forEach(([k, t]) => { if (t.count > 0 && permanentMatches(tokenAsPerm(t), filter)) for (let i = 0; i < t.count && i < 20; i++) out.push({ v: `tok|${k}`, label: `${t.name} token${t.c ? ` ${tokenPT(t, tablePT)}` : ""}` + (t.count > 1 ? ` (${t.count})` : "") }); });
    return out.filter((x, i, a) => x.v.startsWith("bf") || a.findIndex(y => y.v === x.v) === i);
  }
  function edictPicker(key, n, filter) {
    const opts = sacOptions(filter);
    if (!opts.length) return `<span class="mini">Nothing that qualifies.</span><button class="btn small" data-a="edict-none" data-k="${key}">OK</button>`;
    if (n === 1) return `<select class="fetch-pick" id="ep-${key}">${opts.map(o => `<option value="${o.v}">${esc(o.label)}</option>`).join("")}</select>
      <button class="btn small primary" data-a="edict-go" data-k="${key}">Sacrifice</button>`;
    return `<div class="modes">${opts.map(o => `<label class="mode-check"><input type="checkbox" class="ep-box" data-k="${key}" value="${o.v}"><span>${esc(o.label)}</span></label>`).join("")}</div>
      <button class="btn small primary" data-a="edict-go" data-k="${key}">Sacrifice ${n}</button>`;
  }
  // Sacrifice the chosen permanents/tokens (fires sacrifice + death triggers)
  function sacrificeChosen(vals, src) {
    const events = [], names = [], bfIds = [], tok = {};
    vals.forEach(v => {
      const [kind, id] = v.split("|");
      if (kind === "bf") {
        const e = me.bf?.[id]; if (!e || bfIds.includes(id)) return;
        bfIds.push(id); names.push(dispName(e));
        const creature = /\bCreature\b/.test(e.t || "");
        events.push({ type: "sac", name: e.n, n: 1, token: false, creature, artifact: /\bArtifact\b/.test(e.t || "") });
        if (creature) events.push({ type: "dies", n: 1, token: false, ids: [id] });
      } else tok[id] = (tok[id] || 0) + 1;
    });
    Object.entries(tok).forEach(([k, n]) => {
      const t = me.tokens?.[k]; if (!t) return;
      const c = Math.min(n, t.count), creature = isCreatureToken(t.name);
      names.push(`${c} ${t.name}`);
      events.push({ type: "sac", name: t.name, n: c, token: true, creature });
      if (creature) events.push({ type: "dies", n: c, token: true });
    });
    if (!names.length) return;
    logTo(code, `🗡 ${me.name} sacrificed ${names.join(", ")} (${src})`);
    act(events, p => {
      Object.entries(tok).forEach(([k, n]) => { const t = p.tokens?.[k]; if (!t) return; t.count -= Math.min(n, t.count); if (t.count <= 0) delete p.tokens[k]; else if (t.tapped > t.count) t.tapped = t.count; });
    }, p => { bfIds.forEach(id => { toZone(p, p.bf[id], "gy"); delete p.bf[id]; }); });
  }
  function readEdictChoice(key, n) {
    if (n === 1) return [document.getElementById(`ep-${key}`)?.value].filter(Boolean);
    return [...document.querySelectorAll(`.ep-box[data-k="${key}"]:checked`)].map(x => x.value);
  }

  function askPunishers() {
    reminders.filter(r => r.punish && r.who && !r.asked && room.players?.[r.who]).forEach(r => {
      r.asked = true;
      const unless = /unless/i.test(r.text);
      const theirs = t => t.replace(/^you (\w+?)(e?s)?\b/i, (m0, v) => `${me.name} ${v}${/(s|sh|ch|x)$/.test(v) ? "es" : "s"}`).replace(/^draw/i, `${me.name} draws`);
      const what = unless ? `${theirs(r.punish.elseText)} unless you ${punishAsk(r).toLowerCase()}.`
        : `${punishAsk(r)}${r.punish.elseText ? `, or ${theirs(r.punish.elseText)}` : ""}${r.punish.doText ? `. If you do: ${r.punish.doText}` : ""}.`;
      sendNote(r.who, { kind: "ask", text: what, src: r.src, yes: punishAsk(r), no: r.punish.askNo, replyTo: pid, rid: r.id });
    });
  }
  function resolvePunish(r, paid, name) {
    reminders = reminders.filter(x => x.id !== r.id);
    const who = name || room.players?.[r.who]?.name || "They";
    const effs = paid ? r.punish.doEffs : r.punish.elseEffs;
    const text = paid ? r.punish.doText : r.punish.elseText;
    logTo(code, `${r.src}: ${who} ${paid ? `paid (${punishAsk(r).replace(/^Pay /, "")})` : "didn't pay"}`);
    if (effs.length) act([{ type: "effects", effs, times: 1, count: 1, src: r.src, srcId: r.srcId }]);
    const leftover = text && text.replace(/(you )?create[^.]*?tokens?\.?/i, "").replace(/you (gain|lose) \w+ life\.?/i, "").trim();
    if (leftover) reminders.push({ id: newId(), src: r.src, text: leftover.replace(/^\w/, c => c.toUpperCase()), times: 1, note: `${who} ${paid ? "paid" : "didn't pay"}.` });
    render();
  }
  const GIFT_TOKENS = { food: "Food", treasure: "Treasure", clue: "Clue", fish: "Fish", bird: "Bird", octopus: "Octopus" };
  function giftNote(what, src) {
    const w = what.toLowerCase();
    if (/card/.test(w)) return { text: `Draw ${/extra card/.test(w) ? "an extra card" : "a card"}.`, short: "draw a card", src };
    const key = Object.keys(GIFT_TOKENS).find(k => w.includes(k));
    if (key) return { text: `You get ${what.trim()} token.`, short: `${GIFT_TOKENS[key]} token`, token: GIFT_TOKENS[key], tapped: /tapped/.test(w), desc: what.trim(), src };
    return { text: `Gift: ${what.trim()}.`, short: what.trim(), src };
  }
  function giveGift(r, oid) {
    const o = room.players?.[oid];
    reminders = reminders.filter(x => x.id !== r.id);
    if (!o) { render(); return; }
    sendNote(oid, giftNote(r.gift, r.src));
    logTo(code, `🎁 ${me.name} promised ${o.name} a gift: ${r.gift} (${r.src})`);
    if (r.bonus) reminders.push({ id: newId(), src: r.src, text: r.bonus, times: 1, note: "The gift was promised, so this applies." });
    render();
  }

  function airPicker(r) {
    const f = r.effs.find(x => x.k === "airbend");
    const opts = seated(room).flatMap(o => Object.entries(o.bf || {}).filter(([, e]) => airMatch(e, f.what))
      .map(([id, e]) => `<option value="${o.id}|${id}">${esc(o.name)}: ${esc(dispName(e))}</option>`)).join("");
    const w = windowState(r), dis = w.ready ? "" : "disabled";
    if (f.scope === "all") return `${w.html}<button class="btn small primary" data-a="air-go" data-id="${r.id}" ${dis}>Airbend them all</button>`;
    return `${w.html}<select class="fetch-pick" id="ap-${r.id}">${f.scope === "all other" ? `<option value="?">Which creature is spared? (pick one)</option><option value="">Spare none</option>` : ""}${opts}</select>
      <button class="btn small primary" data-a="air-go" data-id="${r.id}" ${dis}>${f.scope === "all other" ? "Airbend the rest" : "Airbend it"}</button>`;
  }
  function airKeep(e) {
    const k = { n: e.n, t: e.t || "", m: e.m || "", img: e.img || "" };
    if (e.nick) k.nick = e.nick;
    if (e.o) k.o = e.o;
    if (e.cmd) k.cmd = true;
    return k;
  }
  // Move the chosen permanents (on anyone's board) into their owners' Airbended zones
  function airbendMany(r, picked) {
    const f = r.effs.find(x => x.k === "airbend");
    const targets = []; // [ownerId, permId]
    if (f.scope === "target") { if (picked) targets.push(picked.split("|")); }
    else seated(room).forEach(o => Object.entries(o.bf || {}).forEach(([id, e]) => {
      if (airMatch(e, f.what) && `${o.id}|${id}` !== picked) targets.push([o.id, id]);
    }));
    const tokensToo = f.scope !== "target" && /creature|permanent/.test(f.what);
    if (!targets.length && !tokensToo) { toast("Nothing to airbend."); return; }
    reminders = reminders.filter(x => x.id !== r.id);
    const byOwner = {};
    targets.forEach(([oid, id]) => { (byOwner[oid] ||= { targets: [] }).targets.push({ kind: "bf", id }); });
    if (tokensToo) seated(room).forEach(o => { (byOwner[o.id] ||= { targets: [] }).tokensFilter = { alts: f.what === "permanent" ? [["permanent"]] : [["creature"]], controller: "any" }; });
    if (f.lock) update(ref(db, `rooms/${code}`), { airLock: { by: pid, name: me.name } });
    logTo(code, `🌀 ${r.src}: airbend ${f.scope === "target" ? "target" : "all other"} ${f.what}s${f.lock ? ". Exile casting locked until " + me.name + "'s next turn" : ""}`);
    sendOrders(byOwner, { how: "airbend", src: r.src });
  }
  function castFromAir(id) {
    const e = me.air?.[id];
    if (!e) return;
    const card = lookupCard(e.n) || e;
    const nid = newId();
    broadcastCast(card); prowess(card); // airbended noncreature permanents still trigger prowess

    logTo(code, `${me.name} cast ${dispName(e)} from exile for {2} (airbend)`);
    const tapped = entersTapped(card, me);
    act([{ type: "cast", card, id: nid, fromZone: "ex" }, { type: "enters", id: nid, card }], p => {
      delete p.air[id];
      p.bf ||= {}; p.bf[nid] = { ...bfEntry(card), ...(e.nick ? { nick: e.nick } : {}), ...(e.cmd ? { cmd: true } : {}) };
      if (tapped === true) p.bf[nid].tap = true;
      enterCounters(p, nid, card);
    });
  }
  // Ty Lee: tap a creature; it doesn't untap while the source's controller still has it
  function tapLockApply(o) {
    if (o.kind === "bf") { if (!me.bf?.[o.id]) return; mutate(p => { const e = p.bf?.[o.id]; if (e) { e.tap = true; e.lockBy = o.lock; } }); logTo(code, `🔒 ${o.byName}'s ${o.src} tapped ${me.name}'s ${dispName(me.bf[o.id])} (it stays tapped while they control ${o.src})`); }
    else { mutate(p => { const t = p.tokens?.[o.id]; if (t) t.tapped = Math.min(t.count, (t.tapped || 0) + 1); }); logTo(code, `🔒 ${o.byName}'s ${o.src} tapped one of ${me.name}'s ${me.tokens?.[o.id]?.name || ""} tokens (keep it tapped while they control ${o.src})`); }
  }
  const lockHeld = lb => !!lb && Object.values(room?.players?.[lb.id]?.bf || {}).some(x => x.n === lb.n) && !isOut(room.players[lb.id]);
  // Sidisi / Colossal Grave-Reaver: "Whenever one or more [creature] cards are put into your graveyard from your library, …"
  function libToGy(cards, gids) {
    Object.entries(me.bf || {}).forEach(([sid, a]) => {
      const m = String(a.o || lookupCard(a.n)?.o || "").match(/whenever one or more ([a-z]+ )?cards are put into your graveyard from your library, ([^.]+)\./i);
      if (!m) return;
      const ty = (m[1] || "").trim(), hit = cards.map((c, i) => [c, gids?.[i]]).filter(([c]) => !ty || new RegExp(`\\b${ty}`, "i").test(c.t || ""));
      if (!hit.length) return;
      const fx = m[2], sp = spellAbility({ n: `${a.n} · gy · ${m[2].slice(0, 40)}`, t: "Instant", o: fx[0].toUpperCase() + fx.slice(1) + "." });
      const toks = sp.effs.filter(f => f.k === "tok");
      if (toks.length) { act([{ type: "effects", effs: toks, times: 1, count: 1, src: dispName(a), srcId: sid }]); return; }
      if (/put one of them onto the battlefield/i.test(fx)) { reminders.push({ id: newId(), src: dispName(a), srcId: sid, text: `Put one of them onto the battlefield: ${hit.map(([c]) => c.n).join(", ")}.`, times: 1, gyToBf: hit.filter(([, g]) => g).map(([c, g]) => [g, c.n]) }); render(); return; }
      reminders.push(normalizeRem({ id: newId(), src: dispName(a), srcId: sid, text: fx[0].toUpperCase() + fx.slice(1) + ".", times: 1 })); render();
    });
  }
  // Evolve: a bigger creature entering under your control → +1/+1 counter
  function evolveCheck(list) {
    const ups = {};
    Object.entries(me.bf || {}).filter(([, e]) => /^Evolve\b/m.test(e.o || lookupCard(e.n)?.o || "")).forEach(([id, e]) => {
      let [p0, t0] = ptOf(e, countsFor(me), pid, id).split("/").map(Number);
      list.forEach(x => { if (x.id === id || Number.isNaN(p0)) return; if (x.p > p0 || x.t > t0) { ups[id] = (ups[id] || 0) + 1; p0++; t0++; } });
    });
    if (!Object.keys(ups).length) return;
    // through the engine, so "whenever a +1/+1 counter is put on this creature" (Fathom Mage, Scurry Oak) and counter doublers see it
    Object.entries(ups).forEach(([id, n]) => {
      act([{ type: "effects", effs: [{ k: "countersOn", target: { kind: "bf", id }, n, key: "p1p1", label: "+1/+1" }], times: 1, count: 1, src: `🧬 ${dispName(me.bf?.[id] || {})} evolved`, srcId: id }]); });
  }
  function womBox(r) {
    const k = r.wom, others = seated(room).filter(o => !isOut(o) && o.id !== pid);
    if (k.mine == null) return `<label class="mini">Your secret number <input type="number" min="0" class="x-input" id="wom-${r.id}"></label><button class="btn small primary" data-a="wom-ask" data-id="${r.id}">Lock it in & ask the table</button>`;
    return `<span class="mini">Waiting on ${others.filter(o => k.ans?.[o.id] == null).map(o => esc(o.name)).join(", ") || "nobody"}…</span>`;
  }
  function womCheck(r) {
    const k = r.wom, others = seated(room).filter(o => !isOut(o) && o.id !== pid);
    if (k.mine == null || others.some(o => k.ans?.[o.id] == null)) return;
    const all = [[pid, me.name, k.mine], ...others.map(o => [o.id, o.name, k.ans[o.id]])];
    const hi = Math.max(...all.map(x => x[2])), lo = Math.min(...all.map(x => x[2]));
    reminders = reminders.filter(x => x !== r);
    logTo(code, `🎡 ${r.src} reveal: ${all.map(x => `${x[1]} ${x[2]}`).join(", ")} · highest ${hi}, lowest ${lo}`);
    const hits = all.filter(x => x[2] === hi && hi > 0);
    hits.forEach(([oid, nm]) => { if (oid === pid) { if (!me.prot?.life && !preventMe()) mutate(p => { p.life = (p.life ?? START_LIFE) - hi; }); } else act([{ type: "effects", effs: [{ k: "tlose", n: hi, target: oid, targetName: nm }], times: 1, count: 1, src: r.src }]); });
    all.filter(x => x[2] !== lo).forEach(([oid]) => { if (oid === pid) reminders.push({ id: newId(), src: r.src, text: "You didn't choose the lowest number: discard your hand, then draw seven cards.", times: 1, drawN: 7 }); else sendNote(oid, { text: `${me.name}'s ${r.src}: you didn't choose the lowest number — discard your hand, then draw seven cards.`, src: r.src }); });
    render();
  }
  // ⚔🛡 combat triggers the app can see from the notes and orders: "attacks you", "blocks", "becomes blocked"
  const reQ = x => String(x).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const selfRef = e => `(?:this (?:creature|permanent|enchantment|artifact|land|vehicle)|${reQ(dispName(e).split(",")[0].split(" // ")[0])}|${reQ(String(e.n || "").split(",")[0].split(" // ")[0])})`;
  const fxRem = (src, srcId, text, extra = {}) => { const t = text.replace(/^\w/, c => c.toUpperCase()), sp = spellAbility({ n: `${src} · combat`, t: "Instant", o: text });
    reminders.push(normalizeRem({ id: newId(), src, srcId, text: t, times: 1, ...(sp.effs.length ? { effs: sp.effs } : {}), ...extra })); };
  function attackedTriggers(h) { // an opponent's creature(s) just attacked me
    const n = Math.max(1, h.times || 1), st = h.stats || {}, fly = (st.kws || []).some(k => /^flying$/i.test(k));
    Object.entries(me.bf || {}).forEach(([id, e]) => { const o = String(e.o || lookupCard(e.n)?.o || "");
      { const pm = o.match(/^(?:[^\n—]{1,40} — )?whenever a creature attacks(?: or blocks)?, ([^\n]+)$/im); if (pm) fxRem(dispName(e), id, `${h.from}'s ${h.src} attacked: ${pm[1]}`); }
      for (const m of o.matchAll(/^(?:[^\n—]{1,40} — )?whenever a creature( without flying| with power (\d+) or greater)? attacks you(?: or a planeswalker you control)?, ([^\n]+)$/gim)) {
        if (/that creature's controller loses \d+ life and you gain \d+ life/i.test(m[3])) continue; // the attacker's phone does these
        if (m[1] && /without flying/i.test(m[1]) && fly) continue;
        if (m[2] && st.p != null && st.p < Number(m[2])) continue;
        fxRem(dispName(e), id, `${h.from}'s ${h.src} attacked you${n > 1 ? ` (×${n})` : ""}: ${m[3]}`, n > 1 ? { times: n } : {}); }
      const once = o.match(/^(?:[^\n—]{1,40} — )?whenever (?:an opponent|a player) attacks you(?: and\/or one or more planeswalkers you control| with one or more creatures)?, ([^\n]+)$/im);
      if (once && attackedOnce !== `${tableCombat}|${h.fromId}|${id}`) { attackedOnce = `${tableCombat}|${h.fromId}|${id}`; fxRem(dispName(e), id, `${h.from} attacked you: ${once[1]}`); }
    });
  }
  let attackedOnce = "";
  // 🎯 "becomes the target" triggers when another player's spell or ability reaches my permanents (asked as "if it targeted…": orders don't say whether they targeted)
  function targetedTriggers(o) {
    const hit = [...(o.targets || []), ...(o.effs || []).map(f => f.target).filter(Boolean)].filter(t => t.kind === "bf" && me.bf?.[t.id]).map(t => t.id);
    if (!hit.length) return;
    const P = "^(?:[^\\n—]{1,40} — )?when(?:ever)? ", TAIL = " becomes? the target of (a spell or ability|a spell|an ability)(?: an opponent controls| you don't control)?(?: for the first time each turn)?, ([^\\n]+)$";
    const nm = id => dispName(me.bf[id]);
    Object.entries(me.bf || {}).forEach(([wid, w]) => { const t = String(w.o || lookupCard(w.n)?.o || ""); if (!/becomes? the target of/i.test(t)) return;
      const tries = [[new RegExp(P + selfRef(w) + "(?: attacks or)?" + TAIL, "im"), hit.includes(wid) ? [wid] : []],
        [new RegExp(P + "enchanted (?:creature|permanent|land)" + TAIL, "im"), w.att && hit.includes(w.att) ? [w.att] : []],
        [new RegExp(P + "(?:you (?:or|and\\/or) (?:at least )?)?(another |a |one or more |one )?(creatures?|permanents?|[A-Z][a-z]+s?) you control" + TAIL, "im"), null],
        [new RegExp(P + "(a |another )(creature|permanent)" + TAIL, "im"), null]]; // Cowardice: anyone's, but only mine reach this phone
      for (const [re, ids0] of tries) { const m = t.match(re); if (!m) continue;
        let ids = ids0;
        if (!ids) { const kind = m[2] || "", other = /another/i.test(m[1] || ""); ids = hit.filter(id => (!other || id !== wid) && (/^permanents?$/i.test(kind) || (/^creatures?$/i.test(kind) ? /\bCreature\b/.test(me.bf[id].t || "") : new RegExp(`\\b${reQ(kind.replace(/s$/, ""))}`, "i").test(me.bf[id].t || "")))); }
        if (!ids.length) continue;
        const what = m[m.length - 2], eff = m[m.length - 1];
        fxRem(dispName(w), wid, `If ${o.byName}'s ${o.src || "effect"} targeted ${ids.map(nm).join(", ")}${what === "a spell" ? " (a spell, not an ability)" : what === "an ability" ? " (an ability)" : ""}: ${eff}`);
        break; }
    });
    setTimeout(render, 0);
  }
  function blockTriggers(list) { // my creatures just blocked: [{kind,id}]
    const done = new Set();
    list.forEach(x => { if (x.kind !== "bf" || done.has(x.id)) return; done.add(x.id); const e = me.bf?.[x.id]; if (!e) return; const o = String(e.o || lookupCard(e.n)?.o || "");
      const m = o.match(new RegExp(`^(?:[^\\n—]{1,40} — )?when(?:ever)? ${selfRef(e)} (?:attacks or )?blocks(?: or becomes blocked)?(?: by)?(?: a creature)?, ([^\\n]+)$`, "im"));
      if (m) fxRem(dispName(e), x.id, `It blocked: ${m[1]}`);
      const bu = o.match(/^Bushido (\d+)/m); if (bu) act([{ type: "effects", effs: [{ k: "pumpOn", target: { kind: "bf", id: x.id }, dp: Number(bu[1]), dt: Number(bu[1]), kws: [] }], times: 1, count: 1, src: `${dispName(e)} (bushido)`, srcId: x.id }]); });
    const names = [...done].map(id => dispName(me.bf[id] || {})).filter(Boolean).join(", ") || "your blocker";
    seated(room).filter(ow => !isOut(ow)).forEach(ow => Object.entries(ow.bf || {}).forEach(([wid, w]) => { const o = String(w.o || lookupCard(w.n)?.o || ""); // Powerstone Minefield (anyone's), "a creature you control blocks" (mine)
      const m = o.match(/^(?:[^\n—]{1,40} — )?whenever a creature (?:attacks or )?blocks, ([^\n]+)$/im) || (ow.id === pid && o.match(/^(?:[^\n—]{1,40} — )?whenever (?:a|another) creature you control blocks(?: a creature)?, ([^\n]+)$/im));
      if (m) fxRem(ow.id === pid ? dispName(w) : `${ow.name}'s ${dispName(w)}`, ow.id === pid ? wid : undefined, `${names} blocked: ${m[1]}`); }));
  }
  function becameBlocked(cardN, src) { // the defender says my attacker was blocked
    Object.entries(me.bf || {}).filter(([, e]) => e.n === cardN).slice(0, 1).forEach(([id, e]) => { const o = String(e.o || lookupCard(e.n)?.o || "");
      const m = o.match(new RegExp(`^(?:[^\\n—]{1,40} — )?whenever ${selfRef(e)} (?:blocks or )?becomes blocked(?: by (?:a|one or more) creatures?)?, ([^\\n]+)$`, "im"));
      if (m) fxRem(dispName(e), id, `It became blocked: ${m[1]}`);
      const af = o.match(/^Afflict (\d+)/m); if (af) reminders.push({ id: newId(), src: `${dispName(e)} (afflict)`, srcId: id, text: `The defending player loses ${af[1]} life.`, times: 1, effs: [{ k: "tlose", n: Number(af[1]), who: "opponent" }] });
      const bu = o.match(/^Bushido (\d+)/m); if (bu) act([{ type: "effects", effs: [{ k: "pumpOn", target: { kind: "bf", id }, dp: Number(bu[1]), dt: Number(bu[1]), kws: [] }], times: 1, count: 1, src: `${dispName(e)} (bushido)`, srcId: id }]);
      Object.entries(me.bf || {}).forEach(([qid, q]) => { const gm = String(q.o || lookupCard(q.n)?.o || "").match(/^(?:[^\n—]{1,40} — )?whenever (?:a|another) creature you control becomes blocked, ([^\n]+)$/im); if (gm && !(qid === id && /^whenever another/i.test(gm[0]))) fxRem(dispName(q), qid, `${dispName(e)} became blocked: ${gm[1]}`); });
      Object.entries(me.bf || {}).filter(([, q]) => q.att === id).forEach(([qid, q]) => { const qo = String(q.o || lookupCard(q.n)?.o || ""), qm = qo.match(/^(?:[^\n—]{1,40} — )?whenever equipped creature becomes blocked, ([^\n]+)$/im); if (qm) fxRem(dispName(q), qid, `${dispName(e)} became blocked: ${qm[1]}`); });
      if (m || af || bu) { toast(`🛡 ${dispName(e)} was blocked: its trigger is up`); setTimeout(render, 0); }
    });
  }
  function pairsAttackCheck() {
    const tp = Object.values(me.bf || {}).find(x => /whenever an opponent attacks you with two or more creatures/i.test(x.o || lookupCard(x.n)?.o || ""));
    if (!tp || !room.turn || room.turn === pid) return;
    const k = Object.values(room.notes?.[pid] || {}).filter(n => n.kind === "hit" && n.fromId === room.turn).reduce((a, n) => a + (n.times || 1), 0);
    const key = `${room.turnNo || 0}`;
    if (k >= 2 && pairsSeen !== key) { pairsSeen = key; reminders.push(normalizeRem({ id: newId(), src: dispName(tp), text: "An opponent attacked you with two or more creatures: you draw a card.", times: 1 })); setTimeout(render, 0); }
  }
  function counterLeave(e) {
    const ctr = Object.entries(e?.c || {}).filter(([, v]) => v > 0);
    if (!ctr.length || !/\bCreature\b/.test(e.t || "")) return;
    const oz = Object.entries(me.bf || {}).filter(([, x]) => /whenever a creature you control leaves the battlefield, if it had counters on it, put those counters on/i.test(x.o || lookupCard(x.n)?.o || ""));
    const oo = Object.values(me.bf || {}).filter(x => /whenever a creature you control with a \+1\/\+1 counter on it leaves the battlefield, create (a|an) ([^.]+?) token for each \+1\/\+1 counter on it/i.test(x.o || lookupCard(x.n)?.o || ""));
    if (oz.length) setTimeout(() => { mutate(p => oz.forEach(([oid]) => { const x = p.bf?.[oid]; if (!x) return; x.c ||= {}; ctr.forEach(([k, v]) => { x.c[k] = (x.c[k] || 0) + v; }); })); logTo(code, `⚙ ${dispName(oz[0][1])}: took ${ctr.map(([k, v]) => `${v} ${k === "p1p1" ? "+1/+1" : k}`).join(", ")} counters from ${dispName(e)}`); }, 0);
    const n = e.c?.p1p1 || 0;
    if (n && oo.length) oo.forEach(x => { const m = String(x.o || lookupCard(x.n)?.o || "").match(/create (?:a|an) ([^.]+?) token for each \+1\/\+1 counter/i); setTimeout(() => act([{ type: "create", name: capName2(m[1]), n, desc: m[1], src: dispName(x) }]), 0); });
  }
  // Super Shredder: "Whenever another permanent leaves the battlefield, put a +1/+1 counter on …" (n permanents left)
  function permLeftWatch(n, goneId) {
    if (!(n > 0)) return;
    const ws = Object.entries(me.bf || {}).filter(([sid, x]) => sid !== goneId && /whenever another permanent leaves the battlefield, put a \+1\/\+1 counter on/i.test(x.o || lookupCard(x.n)?.o || ""));
    if (!ws.length) return;
    setTimeout(() => { mutate(p => ws.forEach(([sid]) => { const x = p.bf?.[sid]; if (x) { x.c ||= {}; x.c.p1p1 = (x.c.p1p1 || 0) + n; } })); ws.forEach(([, x]) => logTo(code, `⚙ ${dispName(x)}: +${n} +1/+1 counter${n === 1 ? "" : "s"} (permanent${n === 1 ? "" : "s"} left)`)); render(); }, 0);
  }
  function leaveHooks(ids, how, eqIds) {
    Object.entries(me.bf || {}).forEach(([sid, a]) => {
      const o = String(a.o || lookupCard(a.n)?.o || "");
      let m;
      if (how === "die" && (m = o.match(/(?:whenever|when) (?:equipped|enchanted) creature dies, ([^.]+)\./i)) && (ids.includes(a.att) || (eqIds || []).includes(sid)))
        reminders.push(normalizeRem({ id: newId(), src: dispName(a), srcId: sid, text: m[1][0].toUpperCase() + m[1].slice(1) + ".", times: 1 }));
      // Splinter: "Whenever Splinter or another nontoken creature you control leaves the battlefield, create a Mutagen token."
      if (ids.length && (m = o.match(/whenever (?:[^,\n]+? or )?another (?:nontoken )?creature you control leaves the battlefield, ([^.]+)\./i)) && (ids.some(x => x !== sid) || new RegExp(`^whenever ${String(a.n).split(",")[0].replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} or another`, "i").test(m[0]))) {
        const tk = m[1].match(/^create (a|an) ([A-Z][a-z]+) token$/i);
        if (tk) setTimeout(() => act([{ type: "create", name: tk[2], n: ids.length, desc: tk[2], src: dispName(a) }]), 0);
        else reminders.push(normalizeRem({ id: newId(), src: dispName(a), srcId: sid, text: m[1][0].toUpperCase() + m[1].slice(1) + ".", times: ids.length }));
      }
      if (how === "leave" && !ids.includes(sid) && (m = o.match(/whenever one or more other creatures you control leave the battlefield without dying, ([^.]+)\./i)))
        reminders.push(normalizeRem({ id: newId(), src: dispName(a), srcId: sid, text: m[1][0].toUpperCase() + m[1].slice(1) + ".", times: 1 }));
    });
  }
  function moveOut(id, dest) {
    const e = me.bf?.[id];
    if (!e) return;
    permLeftWatch(1, id);
    { const lv = String(e.o || lookupCard(e.n)?.o || "").match(/^(?:[A-Z][\w' ]+ — )?When [^,\n]+? leaves the battlefield, ([^\n]+)$/m); if (lv && !/^return the exiled/i.test(lv[1])) reminders.push({ id: newId(), src: dispName(e), text: lv[1][0].toUpperCase() + lv[1].slice(1) + (e.c && Object.keys(e.c).length ? ` (it had ${Object.entries(e.c).map(([k, v]) => `${v} ${counterLabel(k)}`).join(", ")})` : ""), times: 1 }); }
    { const pg = (dest === "Graveyard" || dest === "Sacrificed") && String(e.o || lookupCard(e.n)?.o || "").match(/^When (?:this (?:artifact|creature|enchantment|permanent)|[^,\n]+?) is put into a graveyard from the battlefield, ([^\n]+)$/m); if (pg && !/^return it to its owner's hand/i.test(pg[1])) reminders.push({ id: newId(), src: dispName(e), text: pg[1][0].toUpperCase() + pg[1].slice(1), times: 1 }); }
    if (e.c && Object.values(e.c).some(v => v > 0)) Object.entries(me.bf || {}).forEach(([sid, x]) => { if (sid !== id && /^whenever another permanent you control leaves the battlefield, if it had counters on it, investigate/im.test(x.o || lookupCard(x.n)?.o || "")) setTimeout(() => act([{ type: "create", name: "Clue", n: 1, desc: "Clue", src: dispName(x) }]), 0); });
    if (room?.turn === pid) Object.entries(me.bf || {}).forEach(([sid, x]) => { if (sid === id || x.sukiT === (room.turnNo || 0) || !/^whenever another permanent you control leaves the battlefield during your turn, create a 1\/1 white Ally creature token\. this ability triggers only once each turn/im.test(x.o || lookupCard(x.n)?.o || "")) return; mutate(p => { if (p.bf?.[sid]) p.bf[sid].sukiT = room.turnNo || 0; }); setTimeout(() => act([{ type: "create", name: "Ally", n: 1, desc: "1/1 white Ally creature", src: dispName(x) }]), 0); });
    if (e.blitz && (dest === "Graveyard" || dest === "Sacrificed")) reminders.push({ id: newId(), src: `${dispName(e)} (blitz)`, text: "Draw a card.", times: 1 });
    const creature = /\bCreature\b/.test(e.t || "");
    if (creature && !e.own) leaveHooks([id], dest === "Graveyard" || dest === "Sacrificed" ? "die" : "leave");
    if (!e.own) counterLeave(e);
    // Spine of Ish Sah: a manual "→ Graveyard" might just be fixing a mistake
    const correction = dest === "Graveyard" && /when this [a-z]+ is put into a graveyard from the battlefield, return it to its owner's hand/i.test(e.o || lookupCard(e.n)?.o || "")
      && !confirm(`${dispName(e)} goes back to your hand when it hits the graveyard from the battlefield.\n\nOK = that happened (it returns to hand).\nCancel = I'm just fixing a mistake (leave it in the graveyard).`);
    const dies = (dest === "Graveyard" || dest === "Sacrificed") && creature;
    const events = [...(dest === "Sacrificed" ? [{ type: "sac", name: e.n, n: 1, token: false, creature, artifact: /\bArtifact\b/.test(e.t || "") }] : []),
      ...(dies ? [{ type: "dies", n: 1, token: false, ids: [id] }] : [])];
    act(events, null, p => { // it leaves after triggers check, so its own "when this dies" still fires
      delete p.bf[id];
      const parts = e.mutCards?.length > 1 ? e.mutCards.map(c => Object.fromEntries(Object.entries(c).filter(([, v]) => v != null && v !== ""))) : null;
      if (dest === "Graveyard" || dest === "Sacrificed") (parts || [e]).forEach(c => toZone(p, correction ? { ...c, noReturn: true } : c, "gy"));
      if (dest === "Exile") (parts || [e]).forEach(c => toZone(p, c, "ex"));
    });
    expanded.delete(id);
    logTo(code, `${me.name}: ${e.n} → ${dest}`);
    if (dest === "Hand") toDigHand([e]);
  }

  // Undo: puts your board (life, cards, tokens, counters, mana, reminders) back to how it was before your last action.
  // Life you made opponents lose comes back too; other changes on their boards don't.
  function stepName(m) { return m?.log || m?.label || "a change"; }
  window.__onMyLog = text => { if (!text.includes(me?.name || "\u0000")) return; const m = undoMeta[undoMeta.length - 1]; if (m && m.seq === actSeq) { if (!m.log) m.log = text.slice(0, 80); } else if (pendLog?.seq !== actSeq) pendLog = { seq: actSeq, text: text.slice(0, 80) }; };
  function reportError(err, where) {
    console.error(err);
    const msg = String(err?.message || err).slice(0, 140);
    toast(`⚠ Something went wrong (${where || "app"}): ${msg}. Handle it by hand; please report it.`);
    try { logTo(code, `⚠ App error for ${me?.name || "?"} (${where || "app"}): ${msg}`); } catch {}
  }
  window.addEventListener("error", ev => { if (ev?.error) reportError(ev.error, "background"); });
  window.addEventListener("unhandledrejection", ev => reportError(ev?.reason, "background"));
  async function doUndo() {
    const prev = undo.pop();
    if (!prev) { toast("Nothing to undo."); return; }
    const ext = undoExt.pop(), meta = undoMeta.pop();
    redo.push({ snap: clone(me), ext, meta, rem: clone(reminders), dig: dig ? clone(dig) : null });
    lifeSeen = prev.life ?? START_LIFE;
    if (ext?.loss) {
      const u = {};
      Object.entries(ext.loss).forEach(([oid, n]) => { u[`players/${oid}/life`] = (room.players?.[oid]?.life ?? START_LIFE) + n; });
      update(ref(db, `rooms/${code}`), u);
    }
    clearPending();
    (ext?.orders || []).forEach(({ oid, o }) => rawOrder(oid, { how: "revertOrder", key: o.key, src: o.src || "an effect" }));
    me = prev;
    if (meta?.rem) reminders = meta.rem;
    if (meta?.dig && dig?.on) { dig = clone(meta.dig); digSave(); setTimeout(() => { try { renderHand(); } catch {} }, 0); } // the card goes back to the digital hand
    actSeq++;
    render();
    await set(ref(db, pPath), prev);
    logTo(code, `↶ ${me.name} undid: ${stepName(meta)}`);
    resyncWindows();
    toast(`Undid: ${stepName(meta)}`);
  }
  async function doRedo() {
    const r = redo.pop();
    if (!r) { toast("Nothing to redo."); return; }
    undo.push(clone(me)); undoExt.push(r.ext); undoMeta.push({ ...r.meta, rem: clone(reminders), dig: dig ? clone(dig) : null });
    lifeSeen = r.snap.life ?? START_LIFE;
    if (r.ext?.loss) { const u = {}; Object.entries(r.ext.loss).forEach(([oid, n]) => { u[`players/${oid}/life`] = (room.players?.[oid]?.life ?? START_LIFE) - n; }); update(ref(db, `rooms/${code}`), u); }
    (r.ext?.orders || []).forEach(({ oid, o }) => update(ref(db, `rooms/${code}/orders/${oid}`), { [newId()]: { ...o, at: Date.now() } })); // send the same orders again
    setTimeout(resyncWindows, 0);
    me = r.snap; reminders = r.rem || reminders;
    if (r.dig && dig?.on) { dig = clone(r.dig); digSave(); setTimeout(() => { try { renderHand(); } catch {} }, 0); }
    actSeq++;
    render();
    await set(ref(db, pPath), r.snap);
    logTo(code, `↷ ${me.name} redid: ${stepName(r.meta)}`);
    toast(`Redid: ${stepName(r.meta)}`);
  }
  async function leave() {
    if (!confirm("Leave this game? Your seat, counters and battlefield will be removed.")) return;
    dead = true;
    const name = me.name;
    await remove(ref(db, pPath));
    await logTo(code, `${name} left`);
    store.del(`mtga_${code}`);
    location.href = location.pathname;
  }

  // ----- Card lookup for modal / play -----
  function cardFromRef(r) {
    const [kind, key] = r.split(":");
    if (kind === "deck") return deck?.cards[Number(key)];
    if (kind === "gy" || kind === "ex") { const e = me?.[kind]?.[key]; return e ? zoneCard(e) : null; }
    if (kind === "bf") {
      const e = me?.bf?.[key];
      if (!e) return null;
      return deck?.cards.find(c => c.n === e.n) || anyCache.get(e.n) || e;
    }
    return null;
  }
  function showCard(c, now) {
    if (!c) return;
    modal.innerHTML = `<div class="modal-inner">
      ${c.img ? `<img src="${esc(c.img)}" alt="${esc(c.n)}">` : `<div class="card-text"><h3>${esc(c.n)}</h3><p>${esc(c.t)}</p><p>${esc(c.o || "")}</p></div>`}
      ${now?.length ? `<div class="now-box"><b>On the battlefield now</b>${now.map(l => `<div>${esc(l)}</div>`).join("")}</div>` : ""}
      <button class="btn wide" data-a="close-modal">Close</button></div>`;
    modal.hidden = false;
  }
  // Rules text for the common artifact tokens, so they can be read even offline
  const TOKEN_TEXT = {
    treasure: ["Token Artifact — Treasure", "{T}, Sacrifice this artifact: Add one mana of any color."],
    food: ["Token Artifact — Food", "{2}, {T}, Sacrifice this artifact: You gain 3 life."],
    clue: ["Token Artifact — Clue", "{2}, Sacrifice this artifact: Draw a card."],
    blood: ["Token Artifact — Blood", "{1}, {T}, Discard a card, Sacrifice this artifact: Draw a card."],
    map: ["Token Artifact — Map", "{1}, {T}, Sacrifice this artifact: Target creature you control explores. Activate only as a sorcery."],
    powerstone: ["Token Artifact — Powerstone", "{T}: Add {C}. This mana can't be spent to cast a nonartifact spell."],
    gold: ["Token Artifact — Gold", "Sacrifice this artifact: Add one mana of any color."],
    junk: ["Token Artifact — Junk", "{T}, Sacrifice this artifact: Exile the top card of your library. You may play that card this turn. Activate only as a sorcery."],
  };
  const tokenImg = new Map();
  async function showToken(k) {
    const t = me?.tokens?.[k];
    if (!t) return;
    const [type, text] = TOKEN_TEXT[k] || [t.desc ? `Token: ${t.desc}` : "Token", ""];
    showCard({ n: `${t.name} ×${t.count}`, t: type, o: text, img: tokenImg.get(k) || "" });
    if (tokenImg.has(k)) return;
    try { // look up official token art on Scryfall
      const r = await fetch(`${SCRYFALL}/cards/search?q=${encodeURIComponent(`t:token !"${t.name}"`)}&include_extras=true&unique=art&order=released&dir=desc`);
      const j = r.ok ? await r.json() : null;
      const c = j?.data?.find(x => !t.desc || !/\d+\/\d+/.test(t.desc) || `${x.power}/${x.toughness}` === t.desc.match(/\d+\/\d+/)[0]) || j?.data?.[0];
      const img = c?.image_uris?.normal || c?.card_faces?.[0]?.image_uris?.normal || "";
      tokenImg.set(k, img);
      if (img && !modal.hidden && modal.querySelector("h3")?.textContent.startsWith(t.name)) showCard({ n: t.name, t: type, o: text, img });
    } catch { tokenImg.set(k, ""); }
  }
  modal.onclick = e => {
    if (e.target.closest("[data-a=log-card]")) { showLogCard(e.target.closest("[data-a=log-card]").dataset.n); return; }
    if (e.target === modal || e.target.closest("[data-a=close-modal]")) {
      if (backToLog) { backToLog = false; showLog(); return; } // closing a card opened from the log returns to the log
      modal.hidden = true; logOpen = false;
    }
  };

  // ----- Battle log (full history, newest first) -----
  let logOpen = false;
  // Every card the log might mention: anything on anyone's battlefield or airbended, anything cast, and your decks
  function logCards() {
    const dict = new Map();
    const add = c => { if (!c?.n) return; [c.n, dispName(c)].forEach(k => { const cur = dict.get(k); if (!cur || (!cur.img && c.img)) dict.set(k, c); }); };
    seated(room).forEach(o => { Object.values(o.bf || {}).forEach(add); Object.values(o.air || {}).forEach(add); });
    Object.values(room?.casts || {}).forEach(add);
    Object.values(lib.decks || {}).forEach(d => d.cards.forEach(add));
    return dict;
  }
  function linkify(text, dict) {
    const names = [...dict.keys()].filter(n => n.length > 2 && text.includes(n)).sort((a, b) => b.length - a.length);
    if (!names.length) return esc(text);
    let out = "", i = 0;
    while (i < text.length) {
      const hit = names.find(n => text.startsWith(n, i));
      if (hit) { out += `<button class="log-card" data-a="log-card" data-n="${esc(hit)}">${esc(hit)}</button>`; i += hit.length; }
      else { out += esc(text[i]); i++; }
    }
    return out;
  }
  async function showLogCard(name) {
    const c = logCards().get(name);
    logOpen = false; backToLog = true;
    let card = c?.img ? c : (lookupCard(c?.n || name) || null);
    if (!card?.img) card = await fetchCard(c?.n || name) || c;
    showCard(card);
  }
  let backToLog = false;

  // Abilities used from your hand: Transmute, cycling, landcycling
  function handAbilities(c) {
    const out = [];
    const o = c.o || "";
    if (/^Transmute\b/m.test(o)) out.push({ kind: "transmute", label: "Transmute" });
    if (c.faces?.length > 1 && /^(modal_dfc|adventure)$/.test(c.layout || "")) out.push({ kind: "backFace", label: `${c.layout === "adventure" ? "Adventure: " : "▶ "}${c.faces[1].n}` });
    if (suspendOf(c)) out.push({ kind: "suspend", label: `Suspend ${suspendOf(c).time}` });
    { const em = o.match(/^Exile this card from your hand: Add ((?:\{[^}]+\})+)\.?$/m); if (em) out.push({ kind: "exileMana", label: `Exile: add ${em[1]}`, syms: em[1] }); }
    { const wp = o.match(/^Warp ((?:\{[^}]+\})+)/m); if (wp) out.push({ kind: "warp", label: `Warp ${wp[1]}`, cost: wp[1] }); }
    { const ds = o.match(/^Dash ((?:\{[^}]+\})+)/m); if (ds) out.push({ kind: "dash", label: `Dash ${ds[1]}`, cost: ds[1] }); }
    { const bw = o.match(/^Bestow ((?:\{[^}]+\})+)/m); if (bw) out.push({ kind: "bestow", label: `Bestow ${bw[1]} (as an Aura)`, cost: bw[1] }); }
    { const fd = o.match(/^(Disguise|Morph|Megamorph)(?: ((?:\{[^}]+\})+)|—([^(\n]+?)\s*(?:\(|$))/m); if (fd) { const cost = fd[2] || (fd[3] || "").trim(); out.push({ kind: "facedown", label: `🂠 Face down for {3} (${fd[1]}${fd[2] ? " " : ": "}${cost} to turn up)`, how: fd[1], cost }); } }
    { const mu = o.match(/^Mutate ((?:\{[^}]+\})+)/m); if (mu) out.push({ kind: "mutate", label: `Mutate ${mu[1]}`, cost: mu[1] }); }
    { const nj = o.match(/^(Ninjutsu|Commander ninjutsu) ((?:\{[^}]+\})+)/m); if (nj) out.push({ kind: "ninjutsu", label: `${nj[1]} ${nj[2]}`, cost: nj[2] });
      else if (/\bCreature\b/.test(c.t || "")) { const g = Object.values(me?.bf || {}).map(x => String(x.o || lookupCard(x.n)?.o || "").match(/^Each creature card in your hand has ninjutsu ((?:\{[^}]+\})+)/m)).find(Boolean); if (g) out.push({ kind: "ninjutsu", label: `Ninjutsu ${g[1]} (granted)`, cost: g[1] }); } }
    { const bz = o.match(/^Blitz[ —]((?:\{[^}]+\})+)(?:, pay (\d+) life)?/mi), hz = !bz && /\bCreature\b/.test(c.t || "") && manaValue(c.m || "") >= 4 && Object.values(me?.bf || {}).find(x => /each creature spell you cast with mana value 4 or greater has blitz/i.test(x.o || lookupCard(x.n)?.o || ""));
      if (bz || hz) { const casts = hz ? Object.values(me.tax || {}).reduce((a, n) => a + (n || 0), 0) : 0; out.push({ kind: "blitz", life: bz?.[2] ? Number(bz[2]) : 0, label: `Blitz ${bz ? bz[1] : c.m}${bz?.[2] ? `, ${bz[2]} life` : ""}${hz ? ` (${dispName(hz)}${casts ? `, −{${casts}}` : ""})` : ""}`, cost: bz ? bz[1] : c.m }); } }
    const lc = o.match(/^(Basic land|[A-Z][a-z]+)cycling\b/m);
    if (lc) out.push({ kind: "landcycle", label: `${lc[1]}cycle`, type: lc[1].toLowerCase() });
    else if (/^Cycling\b/m.test(o)) out.push({ kind: "cycle", label: "Cycle" });
    if (foretellOf(c)) out.push({ kind: "foretell", label: `Foretell ({2})`, cost: foretellOf(c) });
    // "{1}{R}, Discard this card: …" (Steel Wrecking Ball): same flow as channel
    for (const m of o.matchAll(/^((?:\{[^}]+\})+), Discard (?:this card|[^:]+?): (.+)$/gm)) {
      if (/^Channel/.test(m[0])) continue;
      out.push({ kind: "channel", plain: true, label: `Discard ${m[1]}`, text: m[2].trim() });
    }
    // Channel (Boseiju, Otawara…): discard it from your hand for an effect
    const ch = o.match(/^Channel — ((?:\{[^}]+\})+), Discard [^:]+: (.+)$/m);
    if (ch) {
      const legends = Object.values(me.bf || {}).filter(e => /\bLegendary\b/.test(e.t || "") && /\bCreature\b/.test(e.t || "")).length;
      const less = /costs \{1\} less to activate for each legendary creature you control/i.test(ch[2]) ? legends : 0;
      out.push({ kind: "channel", label: `Channel ${ch[1]}${less ? ` (−${less})` : ""}`, text: ch[2].replace(/\s*This ability costs[^.]*\./i, "").trim() });
    }
    return out;
  }
  // A card discarded from hand: graveyard (or exile with Necropotence-style effects)
  function discardFromHand(c) {
    const dx = boardEnv().discardExile[0];
    act([{ type: "discard", n: 1 }], p => { toZone(p, { n: c.n, t: c.t || "", m: c.m || "", img: c.img || "", ...(c.o ? { o: c.o } : {}) }, dx ? "ex" : "gy", { disc: room.turnNo || 0 }); });
    return dx;
  }
  function useHandAbility(c, h) {
    const name = dispName(c);
    if (h.kind === "suspend") { suspendCard(c); return; }
    if (h.kind === "exileMana") {
      act([], p => { toZone(p, { n: c.n, t: c.t || "", m: c.m || "", img: c.img || "", ...(c.o ? { o: c.o } : {}) }, "ex"); });
      poolAdd(h.syms, name); logTo(code, `${me.name} exiled ${name} from hand: added ${h.syms}`); render(); return;
    }
    if (h.kind === "ninjutsu") {
      const t = room.turnNo || 0, atk = Object.entries(me.bf || {}).filter(([id, e]) => me.attacked?.turnNo === t && me.attacked.bf?.[id] && /\bCreature\b/.test(e.t || ""));
      reminders.push({ id: newId(), src: name, text: `${h.label}: return an unblocked attacker you control to hand; ${name} enters tapped and attacking.`, times: 1, ninPick: { card: c, cost: h.cost, list: atk.map(([id, e]) => [id, dispName(e)]) }, ...(dig?.on ? { digBack: c.n } : {}) });
      Object.entries(me.bf || {}).forEach(([sid, x]) => { const m = String(x.o || lookupCard(x.n)?.o || "").match(/^Whenever you activate a ninjutsu ability, ([^\n]+)$/m); if (m) reminders.push(normalizeRem({ id: newId(), src: dispName(x), srcId: sid, text: m[1][0].toUpperCase() + m[1].slice(1), times: 1 })); });
      render(); return;
    }
    if (h.kind === "blitz") { if (!okToCast(c)) return; if (h.life) { mutate(p => { p.life = (p.life ?? START_LIFE) - h.life; }); logTo(code, `${me.name} paid ${h.life} life for ${name}'s blitz`); } logTo(code, `${me.name} cast ${name} for its blitz cost ${h.cost} (haste; sacrifice it at the next end step, draw a card when it dies)`); playCard(c, { blitz: true, haste: "blitz", sacNext: "blitz", altCost: h.cost }); return; }
    if (h.kind === "mutate") { if (!okToCast(c)) return; reminders.push({ id: newId(), src: name, text: `Mutate (${h.cost}): put it on top of or under a non-Human creature you own.`, times: 1, mutPick: { card: { n: c.n, t: c.t || "", m: c.m || "", o: c.o || "", p: c.p ?? null, tg: c.tg ?? null, img: c.img || "" }, cost: h.cost }, ...(dig?.on ? { digBack: c.n } : {}) }); render(); return; }
    if (h.kind === "bestow") { if (!okToCast(c)) return; logTo(code, `${me.name} cast ${name} for its bestow cost ${h.cost}`); playCard({ ...c, t: "Enchantment — Aura", bestowT: c.t }, { altCost: h.cost }); setTimeout(() => { const id = Object.keys(me.bf || {}).reverse().find(k => me.bf[k].n === c.n && me.bf[k].bestowT); if (id) reminders.push({ id: newId(), src: name, text: "Bestowed: attach it to a creature (open its row → Enchant creature). If that creature leaves, it becomes a creature again.", times: 1 }); render(); }, 0); return; }
    if (h.kind === "facedown") { if (!okToCast(c)) return; playFaceDown({ card: c, how: h.how, cost: h.cost }); return; }
    if (h.kind === "dash") { if (!okToCast(c)) return; logTo(code, `${me.name} cast ${name} for its dash cost ${h.cost} (haste; back to hand at end step)`); playCard(c, { dash: true, altCost: h.cost }); return; }
    if (h.kind === "warp") { if (!okToCast(c)) return; logTo(code, `${me.name} cast ${name} for its warp cost ${h.cost} (exiled at the next end step; castable later)`); playCard(c, { warp: true, altCost: h.cost }); return; }
    if (h.kind === "backFace") { const fc = faceCard(c, 1); if (fc && (/\bLand\b/.test(fc.t || "") || okToCast(fc))) playCard(fc); return; }
    if (h.kind === "foretell") { // pay {2}, exile it face down; cast it on a later turn for its foretell cost
      act([], p => { p.ex ||= {}; p.ex[newId()] = { n: c.n, t: c.t || "", m: c.m || "", img: c.img || "", ...(c.o ? { o: c.o } : {}), foretold: { cost: h.cost, turnNo: room.turnNo || 0 }, at: Date.now() }; });
      logTo(code, `🔮 ${me.name} foretold a card (exiled face down)`);
      render(); return;
    }
    if (h.kind === "channel") {
      const dx = discardFromHand(c);
      logTo(code, h.plain ? `${me.name} discarded ${name}: ${h.text}${dx ? ` (exiled by ${dx.src})` : ""}` : `${me.name} channeled ${name} (discarded${dx ? `, exiled by ${dx.src}` : ""})`);
      const sp = spellAbility({ n: `${c.n} (channel)`, t: "Instant", o: h.text });
      const effs = sp.auto ? sp.effs : sp.effs.filter(f => ["fetch", "remove", "edict", "regrow", "countersTarget", "pumpTarget", "untapN", "ping", "gyhate", "dmgCr", "wisecrack", "bane"].includes(f.k));
      if (effs.length) act([{ type: "effects", effs, times: 1, count: 1, src: name }]);
      if (!sp.auto && !effs.length) reminders.push({ id: newId(), src: name, text: h.text, times: 1 });
      render(); return;
    }
    if (h.kind !== "suspend") discardFromHand(c);
    if (h.kind === "cycle") {
      logTo(code, `${me.name} cycled ${name}`);
      reminders.push({ id: newId(), src: name, text: "Draw a card.", times: 1 });
      { Object.entries(me.bf || {}).forEach(([wid, w]) => { const am = String(w.o || lookupCard(w.n)?.o || "").match(/^whenever you cycle (?:another|a) card, ([^\n]+)$/im); if (am) reminders.push(normalizeRem({ id: newId(), src: dispName(w), srcId: wid, text: `You cycled ${name}: ${am[1]}`, times: 1 })); }); } // "whenever you cycle a card" ("cycle or discard" runs as a discard: cycling discards the card)
      { const wc = String(c.o || "").match(/^When you (?:cast or )?cycle (?:this card|[^,\n]+), ([^\n]+)$/m); if (wc) { let tx = wc[1][0].toUpperCase() + wc[1].slice(1);
        if (/\bX\b/.test(tx) && /^(?:[A-Za-z]+)?cycling [^\n]*\{X\}/im.test(c.o || "")) { const x = Math.max(0, Math.floor(Number(prompt(`${name}: X paid for cycling = ?`, "1")) || 0)); tx = tx.replace(/,?\s*where X is [^.]+/i, "").replace(/\bX\b/g, String(x)); } // Shark Typhoon
        const sp = spellAbility({ n: `${c.n} (cycled)`, t: "Instant", o: tx }); if (sp.auto && sp.effs.length) act([{ type: "effects", effs: sp.effs, times: 1, count: 1, src: name }]); else reminders.push({ id: newId(), src: `${name} (cycled)`, text: tx, times: 1 }); } }
      render(); return;
    }
    const fetch = h.kind === "transmute"
      ? { k: "fetch", n: 1, desc: `mana value ${manaValue(c.m)}`, alts: [], mv: { op: "=", val: manaValue(c.m) }, dest: "hand", reveal: true, shuffle: true }
      : { k: "fetch", n: 1, desc: h.type === "basic land" ? "basic land" : h.type, alts: h.type === "basic land" ? [["basic", "land"]] : [[h.type]], mv: null, dest: "hand", reveal: true, shuffle: true };
    logTo(code, `${me.name} ${h.kind === "transmute" ? "transmuted" : `${h.type}cycled`} ${name} (discarded)`);
    reminders.push({ id: newId(), src: name, text: "Search your library", fetch, left: 1, times: 1 });
    render();
  }

  function showLog() {
    logOpen = true;
    const entries = Object.values(room?.log || {}).sort((a, b) => b.t - a.t);
    const dict = logCards();
    const time = t => new Date(t).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    const color = text => seated(room).find(p => text.startsWith(p.name))?.color;
    modal.innerHTML = `<div class="modal-inner log-sheet">
      <div class="card-head"><h3>Battle log</h3><span class="muted">${entries.length} entries</span></div>
      <div class="log-list">${entries.length ? entries.map(l => `
        <div class="log-entry ${l.text.startsWith("⚙") ? "auto" : ""}" style="--lc:${esc(color(l.text) || "var(--line)")}">
          <span class="log-time">${time(l.t)}</span><span>${linkify(l.text, dict)}</span>
        </div>`).join("") : `<p class="muted">Nothing has happened yet.</p>`}</div>
      <div class="miss-box">${missOpen ? `<textarea id="missNote" class="full" rows="3" placeholder="What did the app miss or get wrong? (e.g. “Blood Artist should have drained when my Squirrel died”)"></textarea>
        <div class="row"><button class="btn small primary" data-a="miss-send">📨 Send report</button><button class="btn small" data-a="miss-copy">📋 Copy report</button><button class="btn small" data-a="miss-cancel">Cancel</button></div>
        <div class="mini muted">Sends this log, everyone's board and your open reminders (no hands) so Claude can look into it.</div>`
        : `<button class="btn small" data-a="miss-open">🤔 Missed a trigger? Report it</button>`}</div>
      <button class="btn wide" data-a="close-modal">Close</button></div>`;
    modal.hidden = false;
  }
  // 🤔 "Missed a trigger?": a snapshot of the game for Claude to read (log + boards + open reminders)
  let missOpen = false;
  function missReport(note) {
    const entries = Object.values(room?.log || {}).sort((a, b) => a.t - b.t).slice(-120);
    const board = o => ({ name: o.name, life: o.life ?? START_LIFE,
      bf: Object.values(o.bf || {}).map(e => dispName(e) + (e.tap ? " (tapped)" : "") + (e.c && Object.keys(e.c).length ? ` [${Object.entries(e.c).map(([k, n]) => `${k}:${n}`).join(",")}]` : "")),
      tokens: Object.values(o.tokens || {}).filter(t => t.count > 0).map(t => `${t.count}× ${t.name}${t.tapped ? ` (${t.tapped} tapped)` : ""}`),
      phased: [...Object.values(o.phased?.bf || {}).map(dispName), ...Object.values(o.phased?.tokens || {}).map(t => `${t.count}× ${t.name}`)],
      air: Object.values(o.air || {}).map(dispName), gy: Object.values(o.gy || {}).map(dispName), pool: o.pool || null });
    return { at: Date.now(), when: new Date().toString(), v: APP_VERSION, room: code, by: me?.name || "?", note: String(note || "").slice(0, 2000),
      turnNo: room?.turnNo || 0, turn: room?.players?.[room?.turn]?.name || "", step: tableStep || "",
      log: entries.map(l => `${new Date(l.t).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" })}  ${l.text}`),
      boards: seated(room).map(board), reminders: reminders.map(r => `${r.src}: ${r.text || ""}`).slice(0, 30) };
  }
  const missText = r => `TRIGGERNOMICON REPORT ${r.v} · room ${r.room} · ${r.when}\nFrom ${r.by} · turn ${r.turnNo} (${r.turn}${r.step ? `, ${r.step}` : ""})\n\nNOTE: ${r.note || "(none)"}\n\nOPEN REMINDERS:\n${r.reminders.join("\n") || "(none)"}\n\nBOARDS:\n${r.boards.map(b => `${b.name} (${b.life}): ${b.bf.join("; ")}${b.tokens.length ? ` | tokens: ${b.tokens.join("; ")}` : ""}${b.phased.length ? ` | phased out: ${b.phased.join("; ")}` : ""}${b.air.length ? ` | airbent: ${b.air.join("; ")}` : ""}${b.gy.length ? ` | graveyard: ${b.gy.join("; ")}` : ""}`).join("\n")}\n\nLOG (oldest first):\n${r.log.join("\n")}`;

  // ----- Search -----
  function renderSearch() {
    if (!deck) { resultsEl.innerHTML = `<p class="muted">Import your deck in the Deck tab to search it here.</p>`; return; }
    const q = searchEl.value.trim().toLowerCase();
    if (!q) { resultsEl.innerHTML = ""; return; }
    const hits = deck.cards.map((c, i) => [c, i]).filter(([c]) => dispName(c).toLowerCase().includes(q)).slice(0, 15);
    resultsEl.innerHTML = hits.length ? hits.map(([c, i]) => `
      <div class="result">
        <button class="link" data-a="view" data-ref="deck:${i}">${esc(dispName(c))}</button>
        ${costHtml(c)}
        <span class="type">${esc(shortType(c.t))}</span>
        ${handAbilities(c).map((h, j) => `<button class="btn small" data-a="hand-ab" data-ref="deck:${i}" data-j="${j}">${esc(h.label)}</button>`).join("")}
        <button class="btn small primary" data-a="play" data-ref="deck:${i}">${isSpell(c) ? "Cast" : "Play"}</button>
      </div>`).join("") : `<p class="muted">No match in your deck.</p>`;
  }
  searchEl.oninput = renderSearch;
  renderSearch();

  // Scryfall name autocomplete; each result gets a button with the given action
  function autocomplete(input, out, action, label, nickAction) {
    let timer = null;
    input.oninput = () => {
      clearTimeout(timer);
      const q = input.value.trim();
      if (q.length < 2) { out.innerHTML = ""; return; }
      timer = setTimeout(async () => {
        try {
          const r = await fetch(`${SCRYFALL}/cards/autocomplete?q=${encodeURIComponent(q)}`);
          const names = ((await r.json()).data || []).slice(0, 10);
          out.innerHTML = names.length ? names.map(n => `
            <div class="result"><span class="who">${esc(n)}</span>
            <button class="btn small primary" data-a="${action}" data-name="${esc(n)}">${label}</button></div>`).join("")
            : nickAction && q.length >= 3
              ? `<div class="result"><span class="who muted">No card named that. It may be an alternate printed name.</span>
                 <button class="btn small primary" data-a="${nickAction}" data-name="${esc(q)}">Look it up</button></div>`
              : `<p class="muted">No cards found.</p>`;
        } catch { out.innerHTML = `<p class="muted">Couldn't reach Scryfall.</p>`; }
      }, 300);
    };
  }
  async function fetchCard(name) {
    let card = anyCache.get(name);
    if (!card) {
      const r = await fetch(`${SCRYFALL}/cards/named?exact=${encodeURIComponent(name)}`);
      if (!r.ok) { toast("Couldn't load that card."); return null; }
      card = slim(await r.json());
      anyCache.set(name, card); anyCache.set(card.n, card);
    }
    return card;
  }
  autocomplete(anyEl, anyRes, "play-any", "Play");
  async function playAny(name) {
    const card = await fetchCard(name);
    if (!card) return;
    playCard(card);
    anyEl.value = ""; anyRes.innerHTML = "";
  }

  // ----- Deck editing -----
  const addEl = $("addSearch"), addRes = $("addResults"), filterEl = $("listFilter");
  autocomplete(addEl, addRes, "add-card", "Add", "add-nick");
  let findTarget = null; // a not-found name the player is currently fixing
  addEl.addEventListener("input", () => { if (!addEl.value.trim()) findTarget = null; });
  async function addNick(name) {
    addRes.innerHTML = `<p class="muted">Searching alternate names…</p>`;
    const card = await findByNickname(name);
    if (!card) { addRes.innerHTML = `<p class="muted">Couldn't find "${esc(name)}". Try the card's original name instead.</p>`; return; }
    await addToDeck(null, card);
  }
  async function addToDeck(name, found) {
    let card = found || await fetchCard(name);
    if (!card) return;
    const fixing = findTarget;
    findTarget = null;
    if (fixing && !card.nick && normName(fixing) !== normName(card.n)) card = { ...card, nick: fixing.split(/\s+\/\/?\s+/)[0] };
    if (!deck) newDeck({ name: "New deck", cards: [], cmds: [], missing: [], at: Date.now() });
    const have = deck.cards.find(c => c.n === card.n);
    if (have) { have.qty += 1; if (card.nick && !have.nick) have.nick = card.nick; }
    else { deck.cards.push({ qty: 1, ...card }); deck.cards.sort((a, b) => a.n.localeCompare(b.n)); }
    const front = card.n.split(" // ")[0].toLowerCase();
    deck.missing = (deck.missing || []).filter(m => {
      const mf = m.replace(/\s+\/\/?\s+.*$/, "").toLowerCase();
      return m !== fixing && mf !== front && m.toLowerCase() !== card.n.toLowerCase() && normName(m) !== normName(card.nick);
    });
    saveDeck(deck);
    addEl.value = ""; addRes.innerHTML = "";
    toast(`Added ${dispName(card)}`);
    deckChanged();
  }
  function deckQty(i, d) {
    const c = deck?.cards[i];
    if (!c) return;
    if (c.qty + d <= 0) {
      if (!confirm(`Remove ${c.n} from your deck?`)) return;
      deck.cards.splice(i, 1);
      deck.cmds = deck.cmds.filter(n => n !== c.n);
    } else c.qty += d;
    saveDeck(deck);
    deckChanged();
  }
  function renderDeckList() {
    $("deckListCard").hidden = !deck;
    if (!deck) return;
    const total = deck.cards.reduce((s, c) => s + c.qty, 0);
    $("deckCount").textContent = `${total} cards`;
    const q = filterEl.value.trim().toLowerCase();
    const rows = deck.cards.map((c, i) => [c, i]).filter(([c]) => !q || dispName(c).toLowerCase().includes(q));
    $("deckList").innerHTML = rows.length ? rows.map(([c, i]) => `
      <div class="result">
        <button class="star ${deck.cmds.includes(c.n) ? "on" : ""}" data-a="cmd-toggle" data-i="${i}" aria-label="Commander">${deck.cmds.includes(c.n) ? "⭐" : "☆"}</button>
        <button class="link" data-a="view" data-ref="deck:${i}">${esc(dispName(c))}</button>
        ${manaHtml(c.m)}
        <button class="btn small" data-a="dq" data-i="${i}" data-d="-1">−</button>
        <span class="num">${c.qty}</span>
        <button class="btn small" data-a="dq" data-i="${i}" data-d="1">+</button>
      </div>`).join("") : `<p class="muted">No cards match.</p>`;
  }
  filterEl.oninput = renderDeckList;
  let pubDone = false;
  function publishCommanders() {
    if (!me) return;
    const cmds = deck?.cmds || [];
    if (JSON.stringify(me.commanders || []) !== JSON.stringify(cmds)) update(ref(db, pPath), { commanders: cmds.length ? cmds : null });
  }
  function deckChanged() {
    publishCommanders();
    searchEl.placeholder = deck ? `Search ${deck.name || "your deck"}…` : "Search your deck…";
    renderDeck(); renderDeckList(); renderSearch(); render(); }

  // ----- Deck import -----
  $("customToken").onsubmit = e => {
    e.preventDefault();
    const inp = $("tokName");
    const n = inp.value.trim();
    if (!n) return;
    tokChange(n, 1);
    inp.value = ""; inp.blur();
  };

  $("importBtn").onclick = async () => {
    const status = $("importStatus"), btn = $("importBtn");
    const entries = parseDeck($("deckText").value);
    if (!entries.length) { status.textContent = "Couldn't find any cards in that list."; return; }
    btn.disabled = true;
    status.textContent = `Looking up ${entries.length} cards…`;
    try {
      const byName = await lookupCards(entries.map(e => e.name));
      const retry = entries.filter(e => !byName.get(e.name.toLowerCase()) && e.name.includes(" // "));
      if (retry.length) {
        const front = e => e.name.split(" // ")[0];
        const b2 = await lookupCards(retry.map(front));
        retry.forEach(e => { const v = b2.get(front(e).toLowerCase()); if (v) byName.set(e.name.toLowerCase(), v); });
      }
      // Showcase/flavor names ("Stay with Me" = Rhystic Study): look the exact printing up by set + collector number
      const byPrint = entries.filter(e => !byName.get(e.name.toLowerCase()) && e.set && e.cn);
      if (byPrint.length) {
        status.textContent = `Looking up ${byPrint.length} printing${byPrint.length === 1 ? "" : "s"} by set number…`;
        for (let i = 0; i < byPrint.length; i += 75) {
          const chunk = byPrint.slice(i, i + 75);
          try {
            const r = await fetch(`${SCRYFALL}/cards/collection`, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
              body: JSON.stringify({ identifiers: chunk.map(e => ({ set: e.set, collector_number: e.cn })) }) });
            if (r.ok) (await r.json()).data?.forEach(c => { const e = chunk.find(x => x.set === String(c.set).toLowerCase() && x.cn.toLowerCase() === String(c.collector_number).toLowerCase()); if (e) byName.set(e.name.toLowerCase(), { ...slim(c), ...(normName(c.name) !== normName(e.name) ? { nick: e.name } : {}) }); });
          } catch { /* fall back to the name search below */ }
        }
      }
      const unknown = entries.filter(e => !byName.get(e.name.toLowerCase()));
      for (const [n, e] of unknown.entries()) {
        status.textContent = `Checking alternate names (${n + 1} of ${unknown.length})…`;
        const c = await findByNickname(e.name.split(" // ")[0]);
        if (c) byName.set(e.name.toLowerCase(), c);
      }
      const canLead = c => !!c && (/Legendary/.test(c.t) && /(Creature|Planeswalker)/.test(c.t) || /Background/.test(c.t) || /can be your commander/i.test(c.o || ""));
      let cmdEntries = entries.filter(e => e.isCmd);
      if (!cmdEntries.some(e => canLead(byName.get(e.name.toLowerCase())))) {
        cmdEntries = entries.filter(e => e.side && canLead(byName.get(e.name.toLowerCase())));
        cmdEntries.forEach(e => (e.isCmd = true));
      }
      const used = entries.filter(e => !e.side || e.isCmd);
      const cards = [], missing = [];
      used.forEach(e => {
        const c = byName.get(e.name.toLowerCase());
        if (c && !cards.some(x => x.n === c.n)) cards.push({ qty: e.qty, ...c });
        else if (!c) missing.push(e.name);
      });
      const cmds = [...new Set(cmdEntries.map(e => byName.get(e.name.toLowerCase())).filter(canLead).map(c => c.n))].slice(0, 2);
      newDeck({ name: cmds[0] || "Imported deck", cards: cards.sort((a, b) => a.n.localeCompare(b.n)), cmds, missing, at: Date.now() });
      $("deckText").value = "";
      const total = cards.reduce((s, c) => s + c.qty, 0);
      status.textContent = `Imported ${total} cards.${missing.length ? ` ${missing.length} couldn't be found (listed above).` : ""}${cmds.length ? "" : " No commander found, so pick one above."}`;
      deckChanged();
    } catch (err) {
      status.textContent = `Import failed: ${err.message}`;
    } finally {
      btn.disabled = false;
    }
  };

  async function refreshDeck() {
    if (!deck) return;
    const st = () => document.getElementById("refreshStatus");
    if (st()) st().textContent = `Refreshing ${deck.cards.length} cards…`;
    try {
      const byName = await lookupCards(deck.cards.map(c => c.n));
      let changed = 0;
      deck.cards = deck.cards.map(c => {
        const f = byName.get(c.n.toLowerCase()) || byName.get(c.n.split(" // ")[0].toLowerCase());
        if (!f) return c;
        if (f.o !== c.o || f.t !== c.t || f.m !== c.m) changed++;
        return { ...c, ...f, qty: c.qty, ...(c.nick ? { nick: c.nick } : {}), img: c.nick ? c.img || f.img : f.img };
      });
      deck.at = Date.now();
      saveDeck(); clearAbilityCaches(); deckChanged();
      if (st()) st().textContent = `Done. ${changed} card${changed === 1 ? "" : "s"} had updated text.`;
    } catch (err) { if (st()) st().textContent = `Refresh failed: ${err.message}`; }
  }

  function renderDeck() {
    const ids = Object.keys(lib.decks);
    const count = d => d.cards.reduce((s, c) => s + c.qty, 0);
    const libHtml = `
    <section class="card" data-tour="decks">
      <h3>Your decks</h3>
      ${ids.length ? `<select id="deckPick" class="full">${ids.map(id => `<option value="${id}" ${id === lib.active ? "selected" : ""}>${esc(lib.decks[id].name || "Untitled")} (${count(lib.decks[id])})</option>`).join("")}</select>`
        : `<p class="muted">No decks saved on this phone yet. Import one below, or start an empty deck.</p>`}
      <div class="row">
        <button class="btn" data-a="deck-new">+ New empty deck</button>
        ${deck ? `<button class="btn" data-a="deck-rename">Rename</button>` : ""}
      </div>
    </section>`;
    const digHtml = `
    <section class="card" data-tour="dig">
      <h3>No cards? No problem</h3>
      <p class="muted">Build your deck here, then play it from your phone: shuffle, draw your hand, mulligan, scry and search, all in the app.</p>
      ${deck ? `<div class="row"><button class="btn primary" data-a="dig-open">🂠 ${dig?.on ? "Open my digital deck" : "Play this deck digitally"}</button>${dig?.on ? `<button class="btn" data-a="dig-off">Stop using it</button>` : ""}</div>` : `<p class="muted"><b>First import a deck (bottom of this tab) or pick one above.</b> Then a "Play this deck digitally" button shows up here.</p>`}
    </section>`;
    if (!deck) { deckInfo.innerHTML = libHtml + digHtml; return; }
    const total = deck.cards.reduce((s, c) => s + c.qty, 0);
    const legends = deck.cards.filter(c => /Legendary/.test(c.t) && /(Creature|Planeswalker)/.test(c.t) && !deck.cmds.includes(c.n));
    const known = deck.cards.map((c, i) => [c, c.o ? describeAbilities(abilitiesOf(c)) : [], i]).filter(([, l]) => l.length);
    const abilitiesHtml = `
    <section class="card">
      <h3>Triggers the app understands (${known.length})</h3>
      ${known.length ? `<details><summary class="muted">Show cards</summary>${known.map(([c, l, i]) => `<div class="ab-row"><button class="link" data-a="view" data-ref="deck:${i}">${esc(dispName(c))}</button> ${manaHtml(c.m)}<div class="mini">${l.map(esc).join("<br>")}</div></div>`).join("")}</details>`
        : `<p class="muted">No recognized triggers in this deck yet.</p>`}
      <p class="muted">"Auto" resolves on its own. "Reminder" pops up so you can apply or handle it yourself.</p>
    </section>`;
    deckInfo.innerHTML = libHtml + digHtml + abilitiesHtml + `
    <section class="card">
      <h3>${esc(deck.name || "Untitled")}</h3>
      <p><b>${total}</b> cards · imported ${new Date(deck.at).toLocaleDateString()}</p>
      <div class="label">Commander${deck.cmds.length > 1 ? "s" : ""}</div>
      ${deck.cmds.length ? `<div class="chips">${deck.cmds.map((n, i) => `<button class="chip on" data-a="cmd-rm" data-i="${i}">⭐ ${esc(n)} ✕</button>`).join("")}</div>`
        : `<p class="muted">No commander picked yet.</p>`}
      ${deck.cmds.length < 2 ? `<select id="cmdPick" class="full"><option value="">${deck.cmds.length ? "Add a partner…" : "Choose your commander…"}</option>
        ${legends.length ? `<optgroup label="Legendary">${legends.map(c => `<option>${esc(c.n)}</option>`).join("")}</optgroup>` : ""}
        <optgroup label="All cards">${deck.cards.filter(c => !deck.cmds.includes(c.n) && !legends.includes(c)).map(c => `<option>${esc(c.n)}</option>`).join("")}</optgroup></select>
        <p class="muted">Commander not in the list? Add it with "Add a card" below, then pick it here, or tap ☆ next to it in the deck list.</p>` : ""}
      ${deck.missing?.length ? `<div class="label error">Couldn't find these. Tap Find to search for the right card:</div>
        ${deck.missing.map((m, i) => `<div class="result"><span class="who error">${esc(m)}</span>
          <button class="btn small primary" data-a="find-missing" data-i="${i}">Find</button>
          <button class="btn small ghost" data-a="miss-rm" data-i="${i}" aria-label="Dismiss">✕</button></div>`).join("")}` : ""}
      <button class="btn wide" data-a="deck-refresh">↻ Refresh card text from Scryfall</button>
      <p class="muted" id="refreshStatus">Picks up errata and newly previewed cards. Your counts and nicknames are kept.</p>
      <button class="btn ghost wide" data-a="deck-clear">Delete this deck</button>
    </section>`;
  }
  renderDeck();
  renderDeckList();
  if (deck) searchEl.placeholder = `Search ${deck.name || "your deck"}…`;
  app.onchange = e => {
    if (e.target.id === "deckPick") { useDeck(e.target.value); return; }
    if (e.target.id === "cmdPick" && e.target.value) {
      deck.cmds.push(e.target.value);
      if (["Imported deck", "New deck"].includes(deck.name)) deck.name = e.target.value;
      saveDeck(deck); deckChanged();
    }
  };

  // ----- Rendering -----
  let adjScope = "eot", adjOpen = null; // ✎ manual P/T adjustment: "eot" (this turn) or "perm"; which token stack has the panel open
  const manEotOf = (kind, key) => kind === "bf" ? me.eot?.[`man_${key}`] : (() => { const eid = (me.tokens?.[key]?.ep || []).find(x => x.startsWith("man")); return eid ? me.eot?.[eid] : null; })();
  const sgn = n => `${n >= 0 ? "+" : "−"}${Math.abs(n)}`;
  function adjHtml(kind, key, perm) {
    const eot = manEotOf(kind, key), parts = [];
    if (eot && (eot.dp || eot.dt)) parts.push(`${sgn(eot.dp || 0)}/${sgn(eot.dt || 0)} this turn`);
    if (perm && (perm.p || perm.t)) parts.push(`${sgn(perm.p || 0)}/${sgn(perm.t || 0)} permanent`);
    const b = (w, d) => `<button class="btn small" data-a="adj" data-kind="${kind}" data-id="${esc(key)}" data-w="${w}" data-d="${d}">${d > 0 ? "+1" : "−1"}</button>`;
    return `<div class="adj-box">
      <div class="label">✎ Adjust power / toughness <span class="muted">(if the app has a size wrong)</span></div>
      <div class="chips"><button class="chip ${adjScope === "eot" ? "on" : ""}" data-a="adj-scope" data-s="eot">Until end of turn</button><button class="chip ${adjScope === "perm" ? "on" : ""}" data-a="adj-scope" data-s="perm">Permanent</button></div>
      <div class="adj-rows"><span>Power</span>${b("p", -1)}${b("p", 1)}<span>Toughness</span>${b("t", -1)}${b("t", 1)}</div>
      ${parts.length ? `<div class="mini">Manual: ${parts.join(" · ")} <button class="btn small ghost" data-a="adj-clear" data-kind="${kind}" data-id="${esc(key)}">✕ Clear</button></div>` : ""}
    </div>`;
  }
  // 🌐 Table: the whole table on this phone (same info as the TV), one player per card
  const tableClosed = new Set(); // boards this player folded up
  function renderTable() {
    const el = document.getElementById(wide ? "sideTable" : "tablePane"); if (!el || !room) return;
    tvRerender = () => { if (tab === "table" || wide) renderTable(); }; // token art arriving
    const ps = [...seated(room).filter(o => o.id !== pid), ...seated(room).filter(o => o.id === pid)], fx = effectsInPlay(room); // opponents first, you last
    const cards = (p, counts) => {
      const bfE = Object.entries(p.bf || {}), tokE = Object.entries(p.tokens || {}).filter(([, t]) => t.count > 0), onIt = attachedIds(p);
      const tile = (html, attrs) => html.replace('<div class="tslot', `<div ${attrs} class="tslot`);
      const cre = bfE.filter(([id, e]) => group(e) === "creature" && !onIt.has(id)).map(([id, e]) => tile(cardTile(e, counts, p, id, attsOn(p, id)), `data-a="tview" data-o="${p.id}" data-id="${esc(id)}"`)).join("")
        + tokE.filter(([, t]) => isCreatureToken(t.name)).map(([k, t]) => tile(tokenTiles(p, k, t, attsOn(p, k, t)), `data-a="tview-tok" data-o="${p.id}" data-k="${esc(k)}"`)).join("");
      const othE = bfE.filter(([id, e]) => (group(e) === "pw" || group(e) === "other") && !onIt.has(id));
      const oth = othE.map(([id, e]) => tile(cardTile(e, counts, p, id, attsOn(p, id)), `data-a="tview" data-o="${p.id}" data-id="${esc(id)}"`)).join("")
        + tokE.filter(([, t]) => !isCreatureToken(t.name)).map(([k, t]) => tile(tokenTiles(p, k, t, attsOn(p, k, t)), `data-a="tview-tok" data-o="${p.id}" data-k="${esc(k)}"`)).join("");
      const stacks = new Map(); bfE.filter(([id, e]) => group(e) === "land" && !onIt.has(id)).forEach(([id, e]) => { const at = attsOn(p, id); const k = at.length ? `att|${id}` : `${e.n}|${e.tap ? 1 : 0}`; const st = stacks.get(k); if (st) st.n++; else stacks.set(k, { e, id, n: 1, at }); });
      const lnd = [...stacks.values()].map(({ e, id, n, at }) => tile(landTile(e, n, at), `data-a="tview" data-o="${p.id}" data-id="${esc(id)}"`)).join("");
      return `<div class="tp-cards">${typeRows([["Creatures", cre], [otherLabel(othE.map(([, e]) => e), tokE.filter(([, t]) => !isCreatureToken(t.name))), oth], ["Lands", lnd]])}</div>`;
    };
    el.innerHTML = `${fx.length ? `<section class="card"><h3>🌐 In play</h3>${fx.map(x => `<div class="mini"><b style="color:${esc(x.owner.color)}">${esc(x.src)}</b> (${esc(x.owner.name)}): ${esc(x.lines.join(" "))}</div>`).join("")}</section>` : ""}
    ${ps.map(p => { const counts = countsFor(p), bfE = Object.entries(p.bf || {}), out = isOut(p);
      const nCre = bfE.filter(([, e]) => group(e) === "creature").length + Object.values(p.tokens || {}).filter(t => t.count > 0 && isCreatureToken(t.name)).reduce((a, t) => a + t.count, 0);
      const nLand = bfE.filter(([, e]) => group(e) === "land").length, nOth = bfE.length - nLand - bfE.filter(([, e]) => group(e) === "creature").length;
      const cmd = cmdEntries(p, ps);
      return `<section class="card tpanel ${p.id === room.turn ? "active" : ""} ${out ? "out" : ""}" style="--pc:${esc(p.color)}">
        <div class="tp-head"><span class="dot" style="background:${esc(p.color)}"></span><b>${esc(p.name)}${p.id === pid ? " (you)" : ""}</b>${p.id === room.turn ? `<span class="turn-tag">Turn${tableStep ? ` · ${esc(tableStep)}` : ""}</span>` : ""}<span class="tp-life ${out ? "dead" : ""}">${p.life ?? START_LIFE}</span></div>
        <div class="p-stats">${PLAYER_COUNTERS.filter(c => p[c.k] > 0).map(c => `<span class="stat">${c.label} ${p[c.k]}</span>`).join("")}${cmd.map(x => `<span class="stat ${x.n >= 21 ? "lethal" : ""}">⚔ ${esc(x.name ? shortCmd(x.name) : x.o.name)} ${x.n}</span>`).join("")}${Object.keys(p.gy || {}).length ? `<span class="stat">🪦 ${Object.keys(p.gy).length}</span>` : ""}${Object.keys(p.ex || {}).length ? `<span class="stat">🚫 ${Object.keys(p.ex).length}</span>` : ""}${Object.values(p.effects || {}).map(ef => `<span class="stat">${ef.icon} ${esc(ef.name)}</span>`).join("")}${out ? `<span class="stat lethal">💀 out</span>` : ""}</div>
        <details class="tp-board" data-p="${p.id}" ${tableClosed.has(p.id) ? "" : "open"}><summary>Board: ${nCre} creature${nCre === 1 ? "" : "s"} · ${nOth} other · ${nLand} land${nLand === 1 ? "" : "s"}</summary>
          <div class="tp-chips">${bfE.filter(([, e]) => group(e) !== "land").map(([id, e]) => permChip(e, counts, p, id)).join("")}${Object.entries(p.tokens || {}).filter(([, t]) => t.count > 0).map(([k, t]) => `<span class="perm-chip">${esc(t.name)}${isCreatureToken(t.name) ? ` <b>${tokPTfx(t, p.id, k)}</b>` : ""} <b>×${t.count}</b>${t.tapped ? ` <i>${t.tapped} tapped</i>` : ""}</span>`).join("")}</div>
          ${cards(p, counts)}
        </details>
      </section>`; }).join("")}
    <p class="muted">Tap a picture to see the whole card. Updates live.</p>`;
    requestAnimationFrame(() => { try { fitTileNames(el); } catch {} });
    el.querySelectorAll("details.tp-board").forEach(d => d.ontoggle = () => { if (d.open) tableClosed.delete(d.dataset.p); else tableClosed.add(d.dataset.p); });
  }
  let mullRule = store.get("mtga_mullrule") === "official" ? "official" : "free"; // free = redraw 7 and keep all (house rule)
  let digOpenI = -1, digSeen = Infinity; // Hand tab: which card is expanded; how many were already drawn (new ones slide in)
  const cardTint = c => { const col = String(c.m || "").match(/\{([WUBRG])\}/g) || []; const set = [...new Set(col.map(x => x[1]))];
    return set.length > 1 ? "#c9a64a" : ({ W: "#e8e0c4", U: "#3d7cc9", B: "#6b5f73", R: "#d24b3a", G: "#3f9a5a" })[set[0]] || (/Land/.test(c.t || "") ? "#9a7b55" : "#9aa1ab"); };
  function renderHand() {
    const el = document.getElementById("handPane"); if (!el) return;
    if (!dig?.on) { el.innerHTML = ""; return; }
    if (digOpenI >= dig.hand.length) digOpenI = -1;
    const card = n => deckCard(n) || lookupCard(n) || { n };
    const q = (document.getElementById("digQ")?.value || "").toLowerCase();
    const libHits = q.length >= 2 ? [...new Set(dig.lib)].filter(n => n.toLowerCase().includes(q)).slice(0, 12) : [];
    el.innerHTML = `
    <section class="card">
      <div class="card-head"><h3>Your hand (${dig.hand.length})</h3><span class="muted">Library ${dig.lib.length}</span></div>
      ${dig.mull > 0 ? `<div class="mull-bar"><span>🔁 <b>Mulligan:</b> tap a card and put ${dig.mull} more on the bottom.</span><button class="btn small" data-a="dig-keep">Keep this hand</button></div>` : ""}
      ${dig.hand.length ? `<div class="hstack">${dig.hand.map((n, i) => { const c = card(n), open = i === digOpenI, fresh = i >= digSeen;
        const acts = dig.mull > 0 ? `<button class="btn small primary" data-a="dig-bot" data-i="${i}">⤓ Put on bottom (mulligan)</button><button class="btn small" data-a="dig-play" data-i="${i}">▶ Play</button>${/if this card is in your opening hand, you may begin the game with it on the battlefield/i.test(c.o || "") ? `<button class="btn small primary" data-a="dig-leyline" data-i="${i}">🌅 Start the game with it in play</button>` : ""}` : `<button class="btn small primary" data-a="dig-play" data-i="${i}">▶ Play</button>${/if this card is in your opening hand, you may begin the game with it on the battlefield/i.test(c.o || "") ? `<button class="btn small primary" data-a="dig-leyline" data-i="${i}">🌅 Start the game with it in play</button>` : ""}${(c.o ? handAbilities(c) : []).map((h, j) => `<button class="btn small primary" data-a="dig-handab" data-i="${i}" data-j="${j}">${esc(h.label)}</button>`).join("")}<button class="btn small" data-a="dig-top" data-i="${i}">⤒ Top</button><button class="btn small" data-a="dig-bot" data-i="${i}">⤓ Bottom</button><button class="btn small" data-a="dig-disc" data-i="${i}">🗑 Discard</button>`;
        return `<div class="hcard ${open ? "open" : ""} ${fresh ? "fresh" : ""}" style="--ci:${cardTint(c)}">
          <button class="hcard-face ${c.img ? "" : "noimg"}" data-a="dig-view" data-i="${i}" aria-expanded="${open}" aria-label="${esc(dispName(c))}">
            ${c.img ? `<img src="${esc(c.img)}" alt="${esc(dispName(c))}" loading="lazy" onerror="this.parentNode.classList.add('noimg');this.remove()">` : ""}
            <span class="hcard-txt"><span class="hcard-name">${esc(dispName(c))}</span>${manaHtml(c.m || "")}${open ? `<small>${esc(c.t || "")}</small><span class="hcard-o">${esc(c.o || "")}</span>` : ""}</span>
          </button>
          ${open ? `<div class="hcard-acts">${acts}</div>` : ""}
        </div>`; }).join("")}</div><p class="muted hstack-tip">Tap a card to look at it and play it.</p>` : `<p class="muted">No cards in hand.</p>`}
    </section>
    <section class="card">
      <h3>Library</h3>
      <button class="lib-pile" data-a="dig-draw" aria-label="Draw a card"><span class="lib-back"></span><span class="lib-back"></span><span class="lib-back"><b>${dig.lib.length}</b><small>tap to draw</small></span></button>
      <div class="row">
        <button class="btn" data-a="dig-draw">Draw 1</button><button class="btn" data-a="dig-drawbot">Draw from bottom</button>
        <button class="btn" data-a="dig-peek">👁 Look at top…</button><button class="btn" data-a="dig-mill">Mill 1</button><button class="btn" data-a="dig-shuffle">🔀 Shuffle</button>
      </div>
      ${dig.peek > 0 ? `<div class="dig-peek"><p class="muted">Top ${Math.min(dig.peek, dig.lib.length)} (first is the top card). Reorder with ⤒ Top, move any to the bottom, then Done.</p>${dig.lib.slice(0, dig.peek).map((n, i) => `<div class="dig-row"><span>${i + 1}. ${esc(dispName(card(n)))}</span><div class="row">${i ? `<button class="btn small" data-a="dig-pk-top" data-i="${i}">⤒ Top</button>` : ""}<button class="btn small" data-a="dig-pk-bot" data-i="${i}">⤓ Bottom</button><button class="btn small" data-a="dig-pk-hand" data-i="${i}">✋ To hand</button><button class="btn small" data-a="dig-pk-gy" data-i="${i}">🗑 Graveyard</button></div></div>`).join("")}<button class="btn small primary" data-a="dig-peek-done">Done</button></div>` : ""}
      <input id="digQ" type="search" class="full" placeholder="Search your library (tutor)…" autocomplete="off" value="${esc(q)}">
      ${libHits.map(n => `<div class="dig-row"><span>${esc(dispName(card(n)))}</span><div class="row"><button class="btn small" data-a="dig-tutor" data-n="${esc(n)}">✋ To hand</button><button class="btn small" data-a="dig-tutor-bf" data-n="${esc(n)}">▶ Onto battlefield</button></div></div>`).join("")}
    </section>
    <div class="hand-zones">${tab === "hand" ? cmdZoneHtml() + zonesHtml() : ""}</div>
    <section class="card">
      <h3>Game</h3>
      <div class="row"><button class="btn" data-a="dig-new">🔄 New game: shuffle and draw 7</button><button class="btn" data-a="dig-mulligan">Mulligan</button></div>
      <div class="mull-rule"><span class="muted">Mulligan rule:</span>
        <button class="chip ${mullRule === "free" ? "on" : ""}" data-a="dig-mullrule" data-r="free">Free: redraw 7, keep all</button>
        <button class="chip ${mullRule === "official" ? "on" : ""}" data-a="dig-mullrule" data-r="official">Official: 1st free, then bottom 1, 2…</button></div>
      <div class="mull-rule"><span class="muted">2-player game, going first:</span>
        <button class="chip ${store.get("mtga_firstdraw") !== "on" ? "on" : ""}" data-a="dig-firstdraw" data-v="off">Skip first draw (official)</button>
        <button class="chip ${store.get("mtga_firstdraw") === "on" ? "on" : ""}" data-a="dig-firstdraw" data-v="on">Draw anyway</button></div>
      <p class="muted">Your library and hand stay on this phone. Cards you play go onto the board like normal, and draws from reminders (draw step, "Draw a card") come from this library automatically.</p>
    </section>`;
    digSeen = dig.hand.length;
    const qi = document.getElementById("digQ"); if (qi) qi.oninput = () => { const pos = qi.selectionStart; renderHand(); const n2 = document.getElementById("digQ"); if (n2) { n2.focus(); n2.setSelectionRange(pos, pos); } };
  }
  function render() { BUFF_CACHE = new Map(); Object.values(room?.players || {}).forEach(p => Object.values(p?.tokens || {}).forEach(t => noteTokenKind(t?.name, t?.desc))); try { return render0(); } finally { BUFF_CACHE = null; if (tab === "hand") renderHand(); if (tab === "table" || wide) renderTable(); } }
  function render0() {
    { const ub = document.getElementById("undoBtn"), rb = document.getElementById("redoBtn"), ab = document.getElementById("alertBtn");
      if (ub) { ub.disabled = !undo.length; ub.textContent = undo.length ? `↶ Undo: ${stepName(undoMeta[undoMeta.length - 1])}`.slice(0, 46) : "↶ Undo"; }
      if (rb) { rb.disabled = !redo.length; rb.textContent = redo.length ? `↷ Redo: ${stepName(redo[redo.length - 1].meta)}`.slice(0, 46) : "↷ Redo"; }
      if (ab) ab.textContent = turnAlerts ? "🔔 Turn alerts: on" : "🔕 Turn alerts: off";
      const ob = document.getElementById("orderBtn"); if (ob) ob.textContent = orderTriggers ? "🔀 I order triggers: on" : "🔀 I order triggers: off"; }
    if (!me || !room) return;
    announceWindows();
    askPunishers();
    dispatchEdicts();
    const ps = seated(room);
    const opps = ps.filter(o => o.id !== pid);
    const turnP = ps.find(o => o.id === room.turn);
    const pb = document.getElementById("poolBar");
    if (pb) { const show = me.pool || me.poolC || poolOpen || trackMana || keepRules().size; pb.className = show ? "pool-bar" : ""; pb.innerHTML = show ? poolHtml() : ""; }
    const sb = document.getElementById("stepBar");
    if (sb) {
      const si = stepOf(room), mine = room.turn === pid;
      sb.className = turnP ? "step-bar" : "";
      sb.innerHTML = turnP ? `<span class="step-who" style="--pc:${esc(turnP.color)}"><span class="sw-turn">${mine ? "Your Turn" : `${esc(turnP.name)}'s Turn`}</span>${room.turnNo ? `<span class="sw-round">Round ${room.round || 1}</span>` : ""}</span>
        <span class="step-list">${STEPS.map((n, i) => `<span class="step ${i === si ? "on" : i < si ? "done" : ""}">${n}</span>`).join("")}</span>
        ${mine && (si === 3 || si === 4) ? `<button class="btn small step-next" data-a="extra-combat" title="Additional combat phase (Aggravated Assault, Genji Glove…)">↺ Combat</button>` : ""}
        ${celebrating(me) ? `<span class="chip" title="Two or more nonland permanents entered under your control this turn">🎉 Celebration</span>` : ""}${room.dn ? `<button class="btn small" data-a="dn-toggle" title="Day/night (tap to switch it yourself)">${room.dn === "night" ? "🌙 Night" : "☀ Day"}</button>` : ""}${mine && seated(room).some(o => Object.values(o.bf || {}).some(e => /\b(Plane|Phenomenon)\b/.test(e.t || ""))) ? `<button class="btn small" data-a="planar-open" title="Roll the planar die">🌀 Planar die</button>` : ""}${mine ? `<button class="btn small" data-a="free-roll" data-s="6" title="Roll a die">🎲 d6</button><button class="btn small" data-a="free-roll" data-s="20" title="Roll a d20">🎲 d20</button>` : ""}${mine ? (si < STEPS.length - 1 ? `<button class="btn small step-next" data-a="step-next">${STEPS[si + 1]} ▶</button>` : `<button class="btn small primary step-next" data-a="end">End turn ▶</button>`) : ""}` : "";
    }

    head.innerHTML = `
      <div class="head-row" style="--pc:${esc(me.color)}">
        <span class="dot" style="background:${esc(me.color)}"></span>
        <b>${esc(me.name)}</b><span class="room">${esc(code)}</span>
        <button class="log-btn" data-a="log" aria-label="Battle log">📜 Log</button>
        <button class="log-btn draw-btn" data-a="drew" aria-label="I drew a card">🂠 Drew</button>
        ${counterable().length ? `<button class="log-btn ctr-btn" data-a="counter-open" aria-label="Counter a spell">✋ Counter</button>` : ""}
        ${(() => { const ns = Object.values(room.notes?.[pid] || {}), n = reminders.length + ns.length, atk = ns.some(x => x.kind === "hit");
          return n ? `<button class="rem-badge ${atk ? "atk" : ""}" data-a="rem-jump" title="${atk ? "You're being attacked" : "Reminders and messages"}: tap to see them">${atk ? "⚔" : ns.length ? "🔔" : "⚙"} ${n}</button>` : ""; })()}
        <span class="head-life ${isOut(me) ? "dead" : ""}">❤ ${me.life ?? START_LIFE}</span>
      </div>
      ${!turnP ? `<button class="btn primary wide small" data-a="start">Start game: I go first</button>`
        : room.turn === pid ? `<button class="btn primary wide small" data-a="end">Your turn · End turn ▶</button>`
        : `<div class="banner">${esc(turnP.name)}'s turn</div>`}
      ${room.turnBack && (room.turnBack.by === pid || room.turn === pid) ? `<button class="btn small ghost wide tb-btn" data-a="take-back">↶ Undo end turn (back to ${room.turnBack.by === pid ? "your" : esc(room.turnBack.byName) + "'s"} turn)</button>` : ""}`;
    // keep what the player already picked in open reminders when the screen refreshes (someone else's life change, etc.)
    const rb = $("remBox"), keep = {};
    rb.querySelectorAll("select[id], input[id]").forEach(x => { keep["#" + x.id] = x.value; });
    rb.querySelectorAll("input[type=checkbox]").forEach(x => { keep[`cb|${x.className}|${x.dataset.rid || ""}|${x.value}`] = x.checked; });
    queueMicrotask(() => {
      rb.querySelectorAll("select[id], input[id]").forEach(x => { const v = keep["#" + x.id]; if (v != null && v !== "" && (x.tagName !== "SELECT" || [...x.options].some(o => o.value === v))) x.value = v; });
      rb.querySelectorAll("input[type=checkbox]").forEach(x => { const v = keep[`cb|${x.className}|${x.dataset.rid || ""}|${x.value}`]; if (v != null) x.checked = v; });
      try { hsFilter(); } catch {}
    });
    $("remBox").innerHTML = `${reminders.filter(r => r.resolveOrder).length > 1 ? `<div class="order-banner">🔀 These triggered at the same time. Tap <b>▶ Resolve</b> in the order you want them to happen.</div>` : ""}${room.control ? `<div class="ctl-bar">${esc(controlText(room.control))}${room.control.target === pid && room.control.active ? " · do what they say this turn" : ""}</div>` : ""}${rulesStrip()}${room.winner ? `<div class="win-box">🏆 <b>${esc(room.winner.name)}</b> wins the game! (${esc(room.winner.src)})</div>` : ""}${comboBox()}${responseBox()}${notesBox()}${reminders.length ? `<div class="reminders">${reminders.slice(-4).map(r => `
        <div class="reminder">${(targetSrcColors = remSrcColors(r), "")}
          <div><b class="rsrc">⚙ ${esc(r.src)}</b>${r.times > 1 ? ` ×${r.times}` : ""}: ${r.oppPick ? esc(opLabel(r.oppPick)) : ""}${r.effs?.some(f => f.k === "setlife") ? esc(r.effs.find(f => f.k === "setlife").label.replace(/^\w/, c => c.toUpperCase())) : r.effs?.some(f => f.k === "remove") ? removeLabel(r.effs.find(f => f.k === "remove"), r) : r.effs?.some(f => f.k === "adnaus") ? adnLabel(r) : r.effs?.some(f => f.k === "airbend") ? airLabel(r.effs.find(f => f.k === "airbend")) : r.modes ? `Choose ${r.pick === "multi" ? "one or more" : r.pick}${r.times > 1 ? " (each time)" : ""}:` : r.fetch ? `Search for ${r.fetch.desc === "card" ? (r.fetch.n > 1 ? `up to ${r.fetch.n} cards` : "any card") : `${r.fetch.n > 1 ? `up to ${r.fetch.n} ` : r.fetch.n === "X" ? "X " : "a "}${esc(r.fetch.desc)} card${r.fetch.n !== 1 ? "s" : ""}`}${r.fetch.dest === "hand" ? " → hand" : r.fetch.dest === "top" ? " → top of library" : r.fetch.dest === "graveyard" ? " → graveyard" : ""}` : r.mana ? `Add ${manaHtml(r.mana.n <= 10 ? r.mana.syms.repeat(r.mana.n) : r.mana.syms)}${r.mana.n > 10 ? ` × ${r.mana.n}` : ""}` : esc(r.text)}${r.note ? `<div class="mini">${esc(r.note)}</div>` : ""}${baseSetBtn(r)}${consultBox(r)}${digExtras(r.impulse || r.instead ? "" : digTextOf(r), `data-id="${r.id}"`, "r" + r.id, !!(r.drawN || drawCount(r.text)) && !r.effs?.length)}</div>
          ${copyHostBar(r)}${wheelBar(r)}${coinBar(r)}${diceBar(r)}${radBar(r)}${discoverBar(r)}${sephNote(r)}${exploreBar(r)}${enteredNote(r)}<div class="row">
            ${r.pact ? `<button class="btn small primary" data-a="pact-paid" data-id="${r.id}">Paid ${esc(r.pact.cost)}</button>
                <button class="btn small" data-a="pact-lose" data-id="${r.id}">Can't pay → I lose</button>`
              : r.loseFx === "you" ? `<button class="btn small" data-a="lose-me" data-id="${r.id}">💀 I lose</button>`
              : r.loseFx === "target" ? windowState(r).html + opponents().map(o => `<button class="btn small primary" ${windowState(r).ready && !o.prot?.all && !plShroud(o) ? "" : "disabled"} data-a="lose-target" data-id="${r.id}" data-o="${o.id}" style="border-left:4px solid ${esc(o.color)}">💀 ${esc(o.name)}</button>`).join("")
              : r.phyx ? (() => { const n = (r.phyx.match(/\{/g) || []).length; return Array.from({ length: n + 1 }, (_, k) => `<button class="btn small ${k ? "" : "primary"}" data-a="phyx-go" data-id="${r.id}" data-k="${k}">${k === 0 ? "Paid with mana" : k === n ? `Paid ${2 * k} life${n > 1 ? " (all life)" : ""}` : `${k} with life (−${2 * k}), ${n - k} with mana`}</button>`).join(""); })()
              : r.winAsk ? `<button class="btn small primary" data-a="win-yes" data-id="${r.id}">🏆 Condition met, I win</button>`
              : r.suspCast ? `<button class="btn small primary" data-a="susp-go" data-rid="${r.id}">Cast it</button>`
              : r.instead ? `${digDiscardSel(r.instead.what, "ins-" + r.id)}<button class="btn small primary" data-a="instead-yes" data-id="${r.id}">Done (${esc(r.instead.what.replace(/^discard /, "discarded "))})</button>
                <button class="btn small" data-a="instead-no" data-id="${r.id}">Didn't → graveyard</button>`
              : r.effs?.some(f => f.k === "imprint") ? imprintPicker(r)
              : r.oppPick ? oppPickBox(r)
              : r.regrow ? regrowBox(r)
              : r.impulse ? impulseBox(r)
              : r.handMana ? handManaBox(r)
              : r.gyHate ? gyHateBox(r)
              : r.stealEx ? stealExBox(r)
              : r.untapPick ? `<div class="modes">${r.untapPick.opts.map(o => `<label class="mode-check"><input type="checkbox" class="up-box" data-rid="${r.id}" value="${o.v}"><span>${esc(o.label)}</span></label>`).join("")}</div>
                <button class="btn small primary" data-a="untap-pick" data-id="${r.id}">Untap selected (up to ${r.untapPick.max})</button>`
              : r.choosePlayer ? seated(room).filter(o => !isOut(o) && (!r.oppOnly || o.id !== pid)).map(o => `<button class="btn small primary" data-a="choose-pl" data-id="${r.id}" data-o="${o.id}" style="border-left:4px solid ${esc(o.color)}">${o.id === pid ? "Me" : esc(o.name)}</button>`).join("")
              : r.swap ? swapBox(r)
              : r.controlTurn ? opponents().map(o => `<button class="btn small primary" data-a="ctl-go" data-id="${r.id}" data-o="${o.id}" style="border-left:4px solid ${esc(o.color)}">🎮 ${esc(o.name)}</button>`).join("")
              : r.riot ? `<button class="btn small primary" data-a="riot" data-id="${r.id}" data-v="counter">+1/+1 counter</button><button class="btn small primary" data-a="riot" data-id="${r.id}" data-v="haste">Haste</button>`
              : r.pumpPick ? (() => { const f = r.pumpPick, opts = counterOptions(f);
                  if (!opts.length) return `<span class="mini">No ${esc(f.what)} to target.</span>`;
                  const choose = f.kws.some(k => /color of your choice/.test(k));
                  return `<select class="fetch-pick" id="pp-${r.id}">${opts.map(o => `<option value="${o.v}">${esc(o.label)}</option>`).join("")}</select>
                    ${choose ? `<select class="fetch-pick" id="pc-${r.id}">${["white", "blue", "black", "red", "green"].map(c => `<option>${c}</option>`).join("")}</select>` : ""}
                    <button class="btn small primary" data-a="pp-go" data-id="${r.id}">Apply</button>`; })()
              : r.counterPick ? counterPickBox(r)
              : r.prolif ? prolifBox(r)
              : r.countersX ? `<label class="mini">X = <input type="number" min="0" inputmode="numeric" class="x-input" id="cx-${r.id}"></label><button class="btn small primary" data-a="cx-go" data-id="${r.id}">Apply</button>`
              : r.sba ? `<button class="btn small primary" data-a="sba-go" data-id="${r.id}">☠ They die</button>`
              : r.tokCopy ? (Object.keys(me.tokens || {}).length ? `<select class="fetch-pick" id="tc-${r.id}">${Object.entries(me.tokens).map(([k, t]) => `<option value="${esc(k)}">${esc(t.name)}${tokenPT(t) ? ` ${tokenPT({ ...t, c: null })}` : ""}</option>`).join("")}</select><button class="btn small primary" data-a="tc-go" data-id="${r.id}">Copy it</button>` : `<span class="mini">You have no tokens.</span>`)
              : r.tplayerTok ? seated(room).filter(o => !isOut(o)).map(o => `<button class="btn small ${o.id === pid ? "primary" : ""}" data-a="tp-go" data-id="${r.id}" data-o="${o.id}" style="border-left:4px solid ${esc(o.color)}">${o.id === pid ? "Me" : esc(o.name)}</button>`).join("")
              : r.atkPlan ? planBox(r, "bf", r.atkPlan.id, 1)
              : r.escapeEx ? (() => { const gy = Object.entries(me.gy || {}); return `${Array.from({ length: r.escapeEx.n }, (_, j) => `<select class="fetch-pick ee-pick" data-rid="${r.id}">${gy.map(([g, c], i) => `<option value="${g}" ${i === j ? "selected" : ""}>${esc(dispName(c))}</option>`).join("")}</select>`).join("")}<button class="btn small primary" data-a="escape-go" data-id="${r.id}">Exile them</button>`; })()
              : r.suspect ? (() => { const list = seated(room).flatMap(o => [...Object.entries(o.bf || {}).filter(([, e]) => /\bCreature\b/.test(e.t || "") && !e.suspect).map(([id, e]) => [`${o.id}|bf|${id}`, `${o.id === pid ? "" : o.name + ": "}${dispName(e)}`]), ...Object.entries(o.tokens || {}).filter(([, t]) => t.count > 0 && isCreatureToken(t.name) && !t.sus).map(([k, t]) => [`${o.id}|tok|${k}`, `${o.id === pid ? "" : o.name + ": "}${t.name} token`])]); return list.length ? `<select class="fetch-pick" id="su-${r.id}">${list.map(([v, n]) => `<option value="${esc(v)}">${esc(n)}</option>`).join("")}</select><button class="btn small primary" data-a="suspect-go" data-id="${r.id}">🕵 Suspect it</button>` : `<span class="mini">No creatures to suspect.</span>`; })()
              : r.sameMv ? (() => { const opts = (deck?.cards || []).map((c, i) => [c, i]).sort((a, b) => a[0].n.localeCompare(b[0].n)); return `<span class="mini">${esc(r.sameMv.name || "Their spell")} has mana value <b>${r.sameMv.mv}</b>. Your top card:</span><select class="fetch-pick" id="pb-${r.id}">${opts.map(([c, i]) => `<option value="${i}">${esc(dispName(c))} (${manaValue(c.m)})</option>`).join("")}</select><button class="btn small primary" data-a="samemv-go" data-id="${r.id}">Reveal</button>`; })()
              : r.tabernacle ? tabernacleBox(r)
              : r.soulbond ? (() => { const opts = Object.entries(me.bf || {}).filter(([id, e]) => /\bCreature\b/.test(e.t || "") && !e.pair && id !== r.soulbond.id); return opts.length ? `<select class="fetch-pick" id="sb-${r.id}">${opts.map(([id, e]) => `<option value="${id}">${esc(dispName(e))}</option>`).join("")}</select><button class="btn small primary" data-a="pair-go" data-id="${r.id}">🔗 Pair</button>` : `<span class="mini">No unpaired creature to pair with.</span>`; })()
              : r.pairHurt ? `<label class="mini">Damage <input type="number" min="1" class="x-input" id="ph-${r.id}" value="1"></label>${opponents().filter(o => !isOut(o)).map(o => `<button class="btn small primary" data-a="pairhurt-go" data-id="${r.id}" data-o="${o.id}" style="border-left:4px solid ${esc(o.color)}">💥 ${esc(o.name)}</button>`).join("")}`
              : r.bombs ? opponents().filter(o => !isOut(o)).map(o => `<button class="btn small primary" data-a="bombs-go" data-id="${r.id}" data-o="${o.id}" style="border-left:4px solid ${esc(o.color)}">🎃 ${esc(o.name)} (${r.bombs.n} damage, takes it)</button>`).join("")
              : r.freeCast != null ? `<button class="btn small primary" data-a="free-cast" data-id="${r.id}">Cast it free</button>`
              : r.untapOne ? `<button class="btn small primary" data-a="untap-one" data-id="${r.id}">Untap it</button>`
              : r.copyCreature ? (() => { const opts = attachTargets("creature"); return opts.length ? `<select class="fetch-pick" id="cc-${r.id}">${opts.map(([v, n]) => `<option value="${esc(v)}">${esc(n)}</option>`).join("")}</select><button class="btn small primary" data-a="copycre-go" data-id="${r.id}">Copy it</button>` : `<span class="mini">No creatures.</span>`; })()
              : r.landTap ? landTapBox(r)
              : r.mana ? `<button class="btn small primary" data-a="mana-pool" data-id="${r.id}">🔋 Into my mana</button>`
              : r.anyColor ? `${(r.anyN || 1) > 1 ? `<span class="mini">${r.anyOne ? `${r.anyN} of one color:` : `${r.anyN - (r.anyGot || 0)} left to pick:`}</span>` : ""}${MCOL.slice(0, 5).filter(c => !r.colors || r.colors.includes(c)).map(c => `<button class="btn small" data-a="any-color" data-id="${r.id}" data-c="${c}">${manaHtml(`{${c}}`)}</button>`).join("")}`
              : r.sacCost ? sacBox(r)
              : r.millPick ? (() => { const ok = r.millPick.ids.filter(g => me.gy?.[g] && (r.millPick.pick !== "permanent" || !/\b(Instant|Sorcery)\b/.test(me.gy[g].t || ""))); return `${ok.length ? `<select class="fetch-pick" id="mp-${r.id}">${ok.map(g => `<option value="${g}">${esc(dispName(me.gy[g]))}</option>`).join("")}</select><button class="btn small primary" data-a="millpick-go" data-id="${r.id}">✋ To hand</button>` : `<span class="mini">None of them qualify.</span>`}<button class="btn small" data-a="millpick-go" data-id="${r.id}" data-none="1">None</button>`; })()
              : r.millTarget ? seated(room).filter(o => !isOut(o)).map(o => `<button class="btn small ${o.id === pid ? "" : "primary"}" data-a="mill-to" data-id="${r.id}" data-o="${o.id}" style="border-left:4px solid ${esc(o.color)}">🪦 ${o.id === pid ? "Me" : esc(o.name)} mills ${r.millTarget.n}</button>`).join("")
              : r.convoke ? convokeBox(r)
              : r.forage ? forageBox(r)
              : r.sacThen?.what === "forage" ? forageBox(r)
              : r.chooseType ? `<input class="x-input type-in" id="ct-${r.id}" list="ctl-${r.id}" placeholder="Squirrel" style="width:9em"><datalist id="ctl-${r.id}">${[...new Set([...Object.values(me.bf || {}), ...(deck?.cards || [])].flatMap(c => /\bCreature\b/.test(c.t || "") ? (String(c.t).split(" — ")[1] || "").split(/\s+/) : []).filter(Boolean))].map(t => `<option value="${esc(t)}">`).join("")}</datalist><button class="btn small primary" data-a="type-go" data-id="${r.id}">Choose</button>`
              : r.sacThen ? (() => { const opts = sacChoices(r.sacThen.what); return opts.length ? `<select class="fetch-pick" id="st-${r.id}">${opts.map(([v, n]) => `<option value="${esc(v)}">${esc(n)}</option>`).join("")}</select><button class="btn small primary" data-a="sacthen-go" data-id="${r.id}">🗡 Sacrifice</button>` : `<span class="mini">Nothing to sacrifice.</span>`; })()
              : r.tgain ? seated(room).filter(o => !isOut(o)).map(o => `<button class="btn small ${o.id === pid ? "primary" : ""}" data-a="tgain-go" data-id="${r.id}" data-o="${o.id}" style="border-left:4px solid ${esc(o.color)}">❤ ${o.id === pid ? "Me" : esc(o.name)} +${r.tgain.n}</button>`).join("")
              : r.gyOne ? (() => { const opts = seated(room).flatMap(o => Object.entries(o.gy || {}).map(([gid, c]) => [`${o.id}|${gid}`, `${o.id === pid ? "My" : `${o.name}'s`} ${c.n}`])); return opts.length ? `<select class="fetch-pick" id="go-${r.id}">${opts.map(([v, n]) => `<option value="${esc(v)}">${esc(n)}</option>`).join("")}</select><button class="btn small primary" data-a="gyone-go" data-id="${r.id}">🚫 Exile it</button>` : `<span class="mini">No cards in any graveyard.</span>`; })()
              : r.myriad ? `<button class="btn small primary" data-a="myriad-go" data-id="${r.id}">⚔ Create ${r.myriad.n * r.myriad.others.length} attacking cop${r.myriad.n * r.myriad.others.length === 1 ? "y" : "ies"}</button>`
              : r.ncAsk ? `<button class="btn small primary" data-a="nc-yes" data-id="${r.id}">Yes: my next ${r.ncType ? `${esc(r.ncType)} creature` : "legendary"} spell can't be countered</button>`
              : r.chooseColor ? ["white", "blue", "black", "red", "green"].map(c => `<button class="btn small" data-a="color-go" data-id="${r.id}" data-c="${c}">${manaHtml(`{${({ white: "W", blue: "U", black: "B", red: "R", green: "G" })[c]}}`)} ${c}</button>`).join("")
              : r.attachPick ? attachPickBox(r, r.attachPick.srcId, r.attachPick.type)
              : r.attachNew ? attachNewBox(r)
              : r.regen ? regenBox(r)
              : r.oracle ? oracleBox(r)
              : r.tempt ? ringBox(r)
              : r.ping ? pingBox(r)
              : r.crDmg ? crDmgBox(r)
              : r.radiant ? radiantBox(r)
              : r.dmgAll ? dmgAllBox(r)
              : r.dmgPer ? dmgPerBox(r)
              : r.dmgDef ? dmgDefBox(r)
              : r.earthbend ? earthbendBox(r)
              : r.altDraw ? opponents().filter(o => !isOut(o)).map(o => `<button class="btn small" data-a="altdraw" data-id="${r.id}" data-o="${o.id}" style="border-left:4px solid ${esc(o.color)}">${esc(o.name)} draws</button>`).join("")
              : r.veil ? `<button class="btn small primary" data-a="veil-go" data-id="${r.id}">Apply</button>`
              : r.plumb ? `<div class="mini">Sacrifice creatures (optional): one copy each. Each copy: draw a card, lose 1 life.</div><div class="ans-list">${Object.entries(me.bf || {}).filter(([, e]) => /\bCreature\b/.test(e.t || "")).map(([id, e]) => `<label class="mode-check"><input type="checkbox" class="pl-box" data-rid="${r.id}" value="${id}"><span>${esc(dispName(e))}</span></label>`).join("")}${Object.entries(me.tokens || {}).filter(([, t]) => isCreatureToken(t.name)).map(([k, t]) => `<label class="mini">${esc(t.name)} <input type="number" min="0" max="${t.count}" class="x-input pl-tok" data-rid="${r.id}" data-k="${esc(k)}" value="0"> / ${t.count}</label>`).join("")}</div><button class="btn small primary" data-a="plumb-go" data-id="${r.id}">Resolve</button>`
              : r.minusX ? `<label class="mini">X = <input type="number" min="0" class="x-input" id="mx-${r.id}" value="${r.x ?? ""}"></label><button class="btn small primary" data-a="mx-go" data-id="${r.id}">Each creature gets −X/−X</button>`
              : r.bounceOwn ? (() => { const list = Object.entries(me.bf || {}).filter(([, e]) => r.bounceOwn.what === "permanent" || new RegExp(`\\b${r.bounceOwn.what}\\b`, "i").test(e.t || "")); return list.length ? `<select class="fetch-pick" id="bo-${r.id}">${list.map(([id, e]) => `<option value="${id}">${esc(dispName(e))}${e.tap ? " (tapped)" : ""}</option>`).join("")}</select><button class="btn small primary" data-a="bo-go" data-id="${r.id}">↩ To hand</button>` : `<span class="mini">Nothing to return.</span>`; })()
              : r.shockLand ? `<button class="btn small primary" data-a="shock-pay" data-id="${r.id}">❤ Pay ${r.shockLand.n} life (untapped)</button><button class="btn small" data-a="shock-tap" data-id="${r.id}">Enters tapped</button>`
              : r.drainX ? `<label class="mini">X = <input type="number" min="0" class="x-input" id="dx-${r.id}"></label><button class="btn small primary" data-a="dx-go" data-id="${r.id}">Drain each opponent</button>`
              : r.spoil ? seated(room).filter(o => !isOut(o)).map(o => `<button class="btn small ${o.id === pid ? "" : "primary"}" data-a="spoil-go" data-id="${r.id}" data-o="${o.id}" style="border-left:4px solid ${esc(o.color)}">${esc(o.name)}</button>`).join("")
              : r.necroSel ? necroBox(r)
              : r.mirrorPick ? (() => { const list = seated(room).filter(o => !isOut(o)).flatMap(o => Object.entries(o.bf || {}).filter(([id, e]) => /\bCreature\b/.test(e.t || "") && !(o.id === pid && id === r.mirrorPick)).map(([id, e]) => [`${o.id}|${id}`, `${o.id === pid ? "" : `${o.name}: `}${dispName(e)}`]));
                  return list.length ? `<select class="fetch-pick" id="mir-${r.id}">${list.map(([v, l]) => `<option value="${v}">${esc(l)}</option>`).join("")}</select><button class="btn small primary" data-a="mir-go" data-id="${r.id}">Copy it</button>` : `<span class="mini">No creatures to copy.</span>`; })()
              : r.arcum ? (() => { const list = seated(room).filter(o => !isOut(o)).flatMap(o => Object.entries(o.bf || {}).filter(([, e]) => /\bArtifact\b/.test(e.t || "") && /\bCreature\b/.test(e.t || "")).map(([id, e]) => [`${o.id}|${id}`, `${o.id === pid ? "" : `${o.name}: `}${dispName(e)}`]));
                  return list.length ? `<select class="fetch-pick" id="arc-${r.id}">${list.map(([v, l]) => `<option value="${v}">${esc(l)}</option>`).join("")}</select><button class="btn small primary" data-a="arc-go" data-id="${r.id}">Sacrifice it</button>` : `<span class="mini">No artifact creatures.</span>`; })()
              : r.tapNPick ? (() => { const k = r.tapNPick, flt = parseTargetFilter(k.what), bfs = Object.entries(me.bf || {}).filter(([x, e]) => x !== k.id && !e.tap && permMatch(e, flt)), toks = Object.entries(me.tokens || {}).filter(([, t]) => t.count - (t.tapped || 0) > 0 && permMatch(tokenAsPerm(t), flt));
                  return `<div class="ans-list">${bfs.map(([x, e]) => `<label class="mode-check"><input type="checkbox" class="tn-box" data-rid="${r.id}" value="${x}"><span>${esc(dispName(e))}</span></label>`).join("")}${toks.map(([kk, t]) => `<label class="mini">${esc(t.name)} <input type="number" min="0" max="${t.count - (t.tapped || 0)}" class="x-input tn-tok" data-rid="${r.id}" data-k="${esc(kk)}" value="0"> / ${t.count - (t.tapped || 0)}</label>`).join("")}</div><button class="btn small primary" data-a="tn-go" data-id="${r.id}">Tap ${k.n} & activate</button>`; })()
              : r.addType ? (() => { const f = r.addType, list = seated(room).filter(o => !isOut(o)).flatMap(o => Object.entries(o.bf || {}).filter(([, e]) => permMatch(e, f.filter) && !new RegExp(`\\b${f.type}\\b`).test(e.t || "")).map(([id, e]) => [`${o.id}|${id}`, `${o.id === pid ? "" : `${o.name}: `}${dispName(e)}`]));
                  return list.length ? `<select class="fetch-pick" id="at-${r.id}">${list.map(([v, l]) => `<option value="${v}">${esc(l)}</option>`).join("")}</select><button class="btn small primary" data-a="at-go" data-id="${r.id}">Make it ${/^[aeiou]/i.test(f.type) ? "an" : "a"} ${esc(f.type.toLowerCase())}</button>` : `<span class="mini">Nothing to target.</span>`; })()
              : r.rebound ? `<button class="btn small primary" data-a="reb-go" data-id="${r.id}">Cast it free</button>`
              : r.flipFace ? `<button class="btn small primary" data-a="flip-go" data-id="${r.id}">🔄 ${r.flipFace.reenter ? "Exile and return" : "Transform"}</button>`
              : r.blink ? (() => { const list = Object.entries(me.bf || {}).filter(([id, e]) => (r.blink.filter ? !/\bLand\b/.test(e.t || "") || permanentMatches(e, r.blink.filter) : /\bCreature\b/.test(e.t || "")) && !e.own && (!r.blink.filter || permanentMatches(e, r.blink.filter)) && !(r.blink.filter && id === r.srcId && /another/i.test(r.text || "")));
                  return list.length ? `<select class="fetch-pick" id="bk-${r.id}">${list.map(([id, e]) => `<option value="${id}">${esc(dispName(e))}</option>`).join("")}</select><button class="btn small primary" data-a="bk-go" data-id="${r.id}">Blink it</button>` : `<span class="mini">No creature to blink.</span>`; })()
              : r.copyTrig ? (() => { const list = reminders.filter(x => x !== r && !x.copyTrig), done = recentTrig.filter(x => x.turn === (room.turnNo || 0)).map((x, i) => [i, x]).reverse();
                  const opts = [...list.map(x => `<option value="r:${x.id}">⏳ ${esc(x.src)}: ${esc(String(x.text || "").slice(0, 60))}</option>`), ...done.map(([i, x]) => `<option value="a:${i}">✓ ${esc(x.src)}: ${esc(String(x.text || "").slice(0, 60))}</option>`)];
                  return opts.length ? `<select class="fetch-pick" id="ct-${r.id}">${opts.join("")}</select><button class="btn small primary" data-a="ct-go" data-id="${r.id}">Copy it</button>` : `<span class="mini">No triggered ability this turn to copy.</span>`; })()
              : r.animate ? (() => { const f = r.animate, list = seated(room).filter(o => !isOut(o)).flatMap(o => Object.entries(o.bf || {}).filter(([, e]) => permMatch(e, f.filter)).map(([id, e]) => [`${o.id}|${id}`, `${o.o === pid ? "" : o.id === pid ? "" : `${o.name}: `}${dispName(e)}`]));
                  return list.length ? `<select class="fetch-pick" id="an-${r.id}">${list.map(([v, l]) => `<option value="${v}">${esc(l)}</option>`).join("")}</select><button class="btn small primary" data-a="an-go" data-id="${r.id}">Animate it</button>` : `<span class="mini">Nothing to target.</span>`; })()
              : r.maze ? (() => { const t = room.turnNo || 0, list = seated(room).filter(o => !isOut(o) && o.attacked?.turnNo === t).flatMap(o => Object.keys(o.attacked.bf || {}).filter(id => o.bf?.[id]).map(id => [`${o.id}|${id}`, `${o.id === pid ? "" : `${o.name}: `}${dispName(o.bf[id])}`]));
                  return list.length ? `<select class="fetch-pick" id="mz-${r.id}">${list.map(([v, l]) => `<option value="${v}">${esc(l)}</option>`).join("")}</select><button class="btn small primary" data-a="mz-go" data-id="${r.id}">Untap it, no combat damage</button>` : `<span class="mini">No attacking creatures this turn (in the app).</span>`; })()
              : r.eachDraw ? `${r.eachDraw.n === "X" ? `<label class="mini">X = <input type="number" min="0" class="x-input" id="ed-${r.id}"></label>` : ""}<button class="btn small primary" data-a="ed-go" data-id="${r.id}">Everyone draws</button>`
              : r.citadel ? `<select class="fetch-pick" id="cit-${r.id}">${(deck?.cards || []).map((c, i) => [c, i]).filter(([c]) => !r.citadel.nc || !/\b(Creature|Land)\b/.test(c.t || "")).sort((a, b2) => a[0].n.localeCompare(b2[0].n)).map(([c, i]) => `<option value="${i}">${esc(dispName(c))}${r.citadel.nc ? "" : ` (${/\bLand\b/.test(c.t || "") ? "land" : `${manaValue(c.m || "")} life`})`}</option>`).join("")}</select><button class="btn small primary" data-a="cit-go" data-id="${r.id}">Play it</button>`
              : r.imprintLib ? (() => { const f = parseTargetFilter(r.imprintLib.what), seen = new Set(), opts = (deck?.cards || []).filter(c => permMatch(c, f) && !seen.has(c.n) && seen.add(c.n)).sort((a, b2) => a.n.localeCompare(b2.n));
                  return `<select class="fetch-pick" id="il-${r.id}">${opts.map(c => `<option value="${esc(c.n)}">${esc(c.n)}</option>`).join("")}</select><button class="btn small primary" data-a="il-go" data-id="${r.id}">Exile it</button>`; })()
              : r.sacNPick ? (() => { const flt = parseTargetFilter(r.sacNPick.what), o = sacOptions(flt).filter(x => x.v.startsWith("bf|") && x.v !== `bf|${r.sacNPick.id}`);
                  const toks = Object.entries(me.tokens || {}).filter(([, t]) => t.count > 0 && permMatch(tokenAsPerm(t), flt));
                  const have = o.length + toks.reduce((a, [, t]) => a + t.count, 0);
                  return `<div class="mini">Pick ${r.sacNPick.n} (you have ${have}).</div><div class="ans-list">${o.map(x => `<label class="mode-check"><input type="checkbox" class="sn-box" data-rid="${r.id}" value="${x.v}"><span>${esc(x.label)}</span></label>`).join("")}${toks.map(([k, t]) => `<label class="mini">${esc(t.name)} <input type="number" min="0" max="${t.count}" class="x-input sn-tok" data-rid="${r.id}" data-k="${esc(k)}" value="0"> / ${t.count}</label>`).join("")}</div><button class="btn small primary" data-a="sn-go" data-id="${r.id}">Sacrifice ${r.sacNPick.n}${r.sacNPick.id ? " & activate" : ""}</button>`; })()
              : r.revealMv ? `<div class="mini">Which card was it?</div><select class="fetch-pick" id="rv-c-${r.id}"><option value="">—</option>${(deck?.cards || []).map((c, i) => [c, i]).sort((a, b2) => a[0].n.localeCompare(b2[0].n)).map(([c, i]) => `<option value="${i}">${esc(dispName(c))} (MV ${manaValue(c.m || "")})</option>`).join("")}</select><label class="mini">or MV <input type="number" min="0" inputmode="numeric" class="x-input" id="rv-x-${r.id}"></label><button class="btn small primary" data-a="rv-go" data-id="${r.id}">${r.revealMv === "lose" ? "Lose that much" : "Drain that much"}</button>`
              : r.gyDrain ? `<button class="btn small primary" data-a="gyd-go" data-id="${r.id}">${esc(r.gyDrain.name)} loses ${r.gyDrain.n * r.gyDrain.k}, I gain ${r.gyDrain.n * r.gyDrain.k}</button>`
              : r.victimize ? (() => { const f = r.victimize, gy = Object.entries(me.gy || {}).filter(([, e]) => permMatch(e, f.filter)), sac = sacOptions(f.sacFilter);
                  return `<div class="mini">1. Choose up to ${f.n} (targets are picked before the sacrifice):</div><div class="ans-list">${gy.length ? gy.map(([id, e]) => `<label class="mode-check"><input type="checkbox" class="vic-box" data-rid="${r.id}" value="${id}"><span>${esc(dispName(e))}</span></label>`).join("") : `<span class="mini">No ${esc(f.what)} cards in your graveyard (in the app).</span>`}</div>
                    <div class="mini">2. Sacrifice:</div>${sac.length ? `<select class="fetch-pick" id="vic-s-${r.id}">${sac.map(o => `<option value="${o.v}">${esc(o.label)}</option>`).join("")}</select>` : `<span class="mini">Nothing to sacrifice, so nothing returns.</span>`}
                    <button class="btn small primary" data-a="vic-go" data-id="${r.id}" ${sac.length ? "" : "disabled"}>Resolve</button>`; })()
              : r.revertKey ? `<button class="btn small primary" data-a="rv-back" data-id="${r.id}">↩ Put it back</button><button class="btn small" data-a="rv-keep" data-id="${r.id}">Keep my board as it is</button>`
              : r.ctrAsk ? `<button class="btn small primary" data-a="ca-yes" data-id="${r.id}">Yes, resolve the triggers</button><button class="btn small" data-a="ca-no" data-id="${r.id}">No, just adjusting</button>`
              : r.wbk ? (r.wbk.id ? `<button class="btn small primary" data-a="wbk-go" data-id="${r.id}">Gain control</button>` : `<select class="fetch-pick" id="wbk-${r.id}">${opponents().filter(o => !isOut(o)).flatMap(o => Object.entries(o.bf || {}).filter(([, x]) => /\bCreature\b/.test(x.t || "")).map(([cid, x]) => `<option value="${esc(o.id)}|${esc(cid)}">${esc(o.name)}: ${esc(dispName(x))}</option>`)).join("")}</select><button class="btn small primary" data-a="wbk-go" data-id="${r.id}">Gain control</button>`)
              : r.dmgAsk ? `<label class="mini">Damage <input type="number" min="0" class="x-input" id="dk-${r.id}" value="${r.dmgAsk.n}"></label><button class="btn small primary" data-a="dk-go" data-id="${r.id}">Yes, add that many counters</button><button class="btn small" data-a="dk-no" data-id="${r.id}">No, it was life loss</button>`
              : r.sqAsk ? `<label class="mini">Damage prevented <input type="number" min="1" class="x-input" id="sq-${r.id}" value="1"></label><button class="btn small primary" data-a="sq-go" data-id="${r.id}">Add counters</button>`
              : r.gainAsk ? `<button class="btn small primary" data-a="ga-yes" data-id="${r.id}">💚 Yes, I gained ${r.gainAsk} life</button><button class="btn small" data-a="ga-no" data-id="${r.id}">No, just a correction</button>`
              : r.tloseX ? `${r.tloseX === true ? `<label class="mini">X = <input type="number" min="0" class="x-input" id="tlx-${r.id}"></label>` : ""}${seated(room).filter(o => !isOut(o)).map(o => `<button class="btn small ${o.id === pid ? "" : "primary"}" data-a="tlx-go" data-id="${r.id}" data-o="${o.id}" style="border-left:4px solid ${esc(o.color)}">${esc(o.name)} loses${r.tloseX === true ? " X" : ` ${r.tloseX}`}</button>`).join("")}`
              : r.extort ? Array.from({ length: r.extort }, (_, i) => `<button class="btn small ${i ? "" : "primary"}" data-a="ext-go" data-id="${r.id}" data-n="${i + 1}">Paid {W/B}${i ? ` ×${i + 1}` : ""}</button>`).join("")
              : r.bloodAsk ? `<button class="btn small primary" data-a="bla-yes" data-id="${r.id}">Lose ${r.bloodAsk} more</button><button class="btn small" data-a="bla-no" data-id="${r.id}">No, that was a correction</button>`
              : r.oppLose ? opponents().filter(o => !isOut(o) && (!r.oppLose.only || o.id === r.oppLose.only)).map(o => `<button class="btn small primary" data-a="ol-go" data-id="${r.id}" data-o="${o.id}" style="border-left:4px solid ${esc(o.color)}">${esc(o.name)} loses ${r.oppLose.n}</button>`).join("")
              : r.drainDevo ? (() => { const n = devotion(me)[r.drainDevo] || 0; return `<button class="btn small primary" data-a="dd2-go" data-id="${r.id}">Drain ${n} from each opponent (devotion ${n})</button>`; })()
              : r.clearCtrs ? (() => { const list = seated(room).filter(o => !isOut(o)).flatMap(o => Object.entries(o.bf || {}).filter(([, e]) => Object.values(e.c || {}).some(n => n > 0)).map(([id, e]) => [`${o.id}|${id}`, `${o.name}: ${dispName(e)} (${Object.entries(e.c).filter(([, n]) => n > 0).map(([k, n]) => `${n} ${counterLabel(k)}`).join(", ")})`])); return list.length ? `<select class="fetch-pick" id="cc-${r.id}">${list.map(([v, l]) => `<option value="${v}">${esc(l)}</option>`).join("")}</select><button class="btn small primary" data-a="cc-go" data-id="${r.id}">Remove all counters</button>` : `<span class="mini">No permanent has counters.</span>`; })()
              : r.wbend ? wbendBox(r)
              : r.tokAtkMe ? (() => { const x = Object.values(room.notes?.[pid] || {}).filter(n => n.kind === "hit").reduce((a, n) => a + (n.times || 1), 0); return `<label class="mini">X (creatures attacking you) = <input type="number" min="0" class="x-input" id="ta-x-${r.id}" value="${x}"></label><button class="btn small primary" data-a="tam-go" data-id="${r.id}">Create them</button>`; })()
              : r.tapTokX ? `${Object.entries(me.tokens || {}).filter(([, t]) => t.count - (t.tapped || 0) > 0).map(([k, t]) => `<label class="mini">${esc(t.name)} <input type="number" min="0" max="${t.count - (t.tapped || 0)}" class="x-input tx-tok" data-rid="${r.id}" data-k="${esc(k)}" value="${t.count - (t.tapped || 0)}"> / ${t.count - (t.tapped || 0)}</label>`).join("") || `<span class="mini">No untapped tokens.</span>`}<button class="btn small primary" data-a="tx-go" data-id="${r.id}">Tap them</button>`
              : r.dieGain ? `<button class="btn small primary" data-a="dg-yes" data-id="${r.id}">${r.dieGain.ifPaid ? "I paid it — track it" : "Track it"}</button>`
              : r.repManual ? `<select class="fetch-pick" id="rpv-${r.id}">${seated(room).filter(o => !isOut(o)).map(o => `<option value="${o.id}">${esc(o.name)}'s creature</option>`).join("")}</select><label class="mini">was dealt <input type="number" min="0" class="x-input" id="rpn-${r.id}" value="1"></label><button class="btn small primary" data-a="rp-go" data-id="${r.id}">Deal that to its controller</button>`
              : r.copySpell?.pick && !r.copySpell.card ? (() => { const list = Object.entries(room.casts || {}).filter(([, c]) => (r.copySpell.any ? c.n !== r.src : c.by === pid) && (c.turnNo || 0) === (room.turnNo || 0) && /\b(Instant|Sorcery)\b/.test(c.t || "") && !c.countered).reverse();
                  return list.length ? `<select class="fetch-pick" id="csp-${r.id}">${list.map(([k, c]) => `<option value="${esc(k)}">${esc(c.nick || c.n)}${c.by !== pid ? ` (${esc(c.byName || "opponent")})` : ""}</option>`).join("")}</select><button class="btn small primary" data-a="cs-go" data-id="${r.id}">Copy it</button>` : `<span class="mini">You haven't cast an instant or sorcery this turn (in the app).</span>`; })()
              : r.copySpell ? `<button class="btn small primary" data-a="cs-go" data-id="${r.id}">Copy it</button>`
              : r.legend ? r.legend.ids.filter(x => me.bf?.[x]).map(x => `<button class="btn small" data-a="leg-keep" data-id="${r.id}" data-k="${x}">Keep ${esc(dispName(me.bf[x]))}${me.bf[x].tap ? " (tapped)" : ""}${Object.keys(me.bf[x].c || {}).length ? " (has counters)" : ""}</button>`).join("")
              : r.crew ? crewBox(r)
              : r.rmAmong ? rmAmongBox(r)
              : r.bane ? baneBox(r)
              : r.baneAsk ? `<button class="btn small" data-a="bane-sac" data-id="${r.id}">Sacrifice it</button><button class="btn small primary" data-a="bane-dmg" data-id="${r.id}">Take ${r.baneAsk.n} damage</button>`
              : r.cwarp ? cwarpBox(r)
              : r.devo ? Object.entries(r.devo).filter(([, n]) => n > 0).map(([col, n]) => `<button class="btn small primary" data-a="devo-go" data-id="${r.id}" data-c="${col}">${manaHtml(`{${col}}`)} × ${n}</button>`).join("") || `<span class="mini">No devotion yet.</span>`
              : r.copyFrom ? copyBox(r)
              : r.voidPick ? voidBox(r)
              : r.counterAsk ? (() => { const nc = uncounterable(); if (nc.all) return `<span class="mini">⛔ ${esc(nc.all)}: spells can't be countered.</span>`; const list = counterable().filter(([, c]) => counterMatches(r.counterAsk, c));
                  return list.length ? `<select class="fetch-pick" id="ca-${r.id}">${list.map(([k, c]) => `<option value="${k}">${esc(castLabel(c))}</option>`).join("")}</select>
                    <button class="btn small primary" data-a="ctr-ask" data-id="${r.id}">Counter it</button>` : `<span class="mini">No spell it can counter right now.</span>`; })()
              : r.unlessCtr ? `<button class="btn small primary" data-a="unless-paid" data-id="${r.id}">Paid ${manaHtml(r.unlessCtr.cost)}</button>
                <button class="btn small" data-a="unless-no" data-id="${r.id}">Didn't pay → countered</button>`
              : r.fbGrant ? (() => { const l = Object.entries(me.gy || {}).filter(([, e]) => /\b(Instant|Sorcery)\b/.test(e.t || zoneCard(e).t || "")); return l.length ? `<select class="fetch-pick" id="fbg-${r.id}">${l.map(([id, e]) => `<option value="${id}">${esc(dispName(e))}</option>`).join("")}</select><button class="btn small primary" data-a="fbg-go" data-id="${r.id}">Grant flashback</button>` : `<span class="mini">No instant or sorcery in your graveyard (in the app).</span>`; })()
              : r.echo ? `<button class="btn small primary" data-a="echo-go" data-id="${r.id}" data-v="1">Paid ${manaHtml(r.echo.cost)}</button><button class="btn small" data-a="echo-go" data-id="${r.id}" data-v="0">🗡 Sacrifice it</button>`
              : r.relicPick ? `<select class="fetch-pick" id="rl-${r.id}">${r.relicPick.map(([id, n]) => `<option value="${id}">${esc(n)}</option>`).join("")}</select><button class="btn small primary" data-a="relic-go" data-id="${r.id}">Tap it</button>`
              : r.tapLock ? (() => { const l = crTargets({ cr: true }).filter(c => c.v !== `${pid}|bf|${r.srcId}`); return l.length ? `<select class="fetch-pick" id="tl-${r.id}">${l.map(c => `<option value="${c.v}">${esc(c.o.id === pid ? "Mine" : c.o.name)}: ${esc(c.s.name)}</option>`).join("")}</select><button class="btn small primary" data-a="tl-go" data-id="${r.id}">Tap it</button>` : `<span class="mini">No creature to target.</span>`; })()
              : r.gyToBf ? (() => { const l = r.gyToBf.filter(([g]) => me.gy?.[g]); return l.length ? `<select class="fetch-pick" id="g2b-${r.id}">${l.map(([g, n]) => `<option value="${g}">${esc(n)}</option>`).join("")}</select><button class="btn small primary" data-a="g2b-go" data-id="${r.id}">Onto the battlefield</button>` : `<span class="mini">None of them are still in your graveyard.</span>`; })()
              : r.cumUp ? `<button class="btn small primary" data-a="cum-go" data-id="${r.id}" data-v="1">Paid${r.cumUp.life ? ` ${r.cumUp.life * r.cumUp.n} life` : ""}</button><button class="btn small" data-a="cum-go" data-id="${r.id}" data-v="0">🗡 Sacrifice it</button>`
              : r.wheelAll ? `<button class="btn small primary" data-a="wheel-go" data-id="${r.id}">Tell the table</button>`
              : r.impLoss ? (() => { const l = Object.entries(room.casts || {}).filter(([, c]) => (c.turnNo || 0) === (room.turnNo || 0) && !c.countered && c.n !== r.src).reverse(); return l.length ? `<select class="fetch-pick" id="imp-${r.id}">${l.map(([k, c]) => `<option value="${esc(k)}">${esc(castLabel(c))} (MV ${manaValue(c.m || "")})</option>`).join("")}</select><button class="btn small primary" data-a="imp-go" data-id="${r.id}">Retargeted: lose the life</button>` : `<span class="mini">No spell on the stack (in the app).</span>`; })()
              : r.moxD ? `${digDiscardSel("discard a land card", "mxd-" + r.id)}<button class="btn small primary" data-a="moxd-go" data-id="${r.id}" data-v="1">Discarded a land</button><button class="btn small" data-a="moxd-go" data-id="${r.id}" data-v="0">Didn't → graveyard</button>`
              : r.dredge ? `<button class="btn small primary" data-a="dredge-go" data-id="${r.id}">Dredged ${r.dredge.n} (instead of drawing)</button>`
              : r.station ? (() => { const l = Object.entries(me.bf || {}).filter(([id, e]) => id !== r.station.id && !e.tap && /\bCreature\b/.test(e.t || "")); return l.length ? `<select class="fetch-pick" id="st-${r.id}">${l.map(([id, e]) => `<option value="${id}">${esc(dispName(e))} (power ${Number(ptOf(e, countsFor(me), pid, id).split("/")[0]) || 0})</option>`).join("")}</select><button class="btn small primary" data-a="st-go" data-id="${r.id}">Tap it: add charge counters</button>` : `<span class="mini">No untapped creature to tap.</span>`; })()
              : r.encPick ? seated(room).filter(o => !isOut(o) && (!r.encPick.opp || o.id !== pid)).map(o => `<button class="btn small" data-a="enc-go" data-id="${r.id}" data-o="${o.id}" style="border-left:4px solid ${esc(o.color || "#888")}">${esc(o.id === pid ? "Me" : o.name)}</button>`).join("")
              : r.retarget ? (() => { const l = Object.entries(room.casts || {}).filter(([, c]) => (c.turnNo || 0) === (room.turnNo || 0) && !c.countered && c.n !== r.src).reverse(); return `${l.length ? `<select class="fetch-pick" id="rtg-${r.id}">${l.map(([k, c]) => `<option value="${esc(k)}">${esc(castLabel(c))}</option>`).join("")}</select>` : ""}<input class="x-input wide-in" id="rtn-${r.id}" placeholder="New target (optional)"><button class="btn small primary" data-a="rtg-go" data-id="${r.id}">Log it</button>`; })()
              : r.wom ? womBox(r)
              : r.amulet ? `${["W", "U", "B", "R", "G", "C"].map(c => `<button class="btn small" data-a="amu-go" data-id="${r.id}" data-c="${c}">${manaHtml(`{${c}}`)}</button>`).join("")}`
              : r.foodPick ? `<select class="fetch-pick" id="fdc-${r.id}">${r.foodPick.filter(([id]) => me.bf?.[id]).map(([id, n, mv]) => `<option value="${id}">${esc(n)} (+${1 + mv})</option>`).join("")}</select><button class="btn small primary" data-a="food-go" data-id="${r.id}">Exile it</button>`
              : r.retPick ? `<div class="modes">${Object.entries(me.bf || {}).filter(([, e]) => !e.own && (/\bCreature\b/.test(e.t || "") || (r.retPick.pw && /\bPlaneswalker\b/.test(e.t || "")))).map(([id, e]) => `<label class="mode-check"><input type="checkbox" class="rtp-box" data-rid="${r.id}" value="${id}"><span>${esc(dispName(e))}</span></label>`).join("")}</div><button class="btn small primary" data-a="rtp-go" data-id="${r.id}">Exile selected</button>`
              : r.dupPick ? (() => { const l = Object.entries(me.bf || {}).filter(([, e]) => /\b(Creature|Artifact)\b/.test(e.t || "") && !e.own); return l.length ? `<select class="fetch-pick" id="dup-${r.id}">${l.map(([id, e]) => `<option value="${id}">${esc(dispName(e))}</option>`).join("")}</select><button class="btn small primary" data-a="dup-go" data-id="${r.id}">Copy it</button>` : `<span class="mini">Nothing to copy.</span>`; })()
              : r.dblAll ? `<button class="btn small primary" data-a="dbl-go" data-id="${r.id}">✖2 Double them</button>`
              : r.copyEnt ? (() => { const k = r.copyEnt, l = seated(room).filter(o => !isOut(o) && (k.scope !== "mine" || o.id === pid) && (k.scope !== "opp" || o.id !== pid)).flatMap(o => Object.entries(o.bf || {}).filter(([id, e]) => ((k.kind === "nonland" ? !/\bLand\b/.test(e.t || "") : new RegExp(`\\b(${k.kind || "Creature"})\\b`).test(e.t || "")) || (k.pw && /\bPlaneswalker\b/.test(e.t || ""))) && (!k.ally || /\bAlly\b/.test(e.t || "")) && !(o.id === pid && id === k.id)).map(([id, e]) => [`${o.id}|${id}`, `${o.id === pid ? "" : `${o.name}: `}${dispName(e)} (MV ${manaValue(e.m || "")})`]));
                  return l.length ? `<select class="fetch-pick" id="cpe-${r.id}">${l.map(([v, n]) => `<option value="${v}">${esc(n)}</option>`).join("")}</select><button class="btn small primary" data-a="cpe-go" data-id="${r.id}">Copy it</button>` : `<span class="mini">Nothing it can copy.</span>`; })()
              : r.fogPick ? (() => { const l = seated(room).filter(o => !isOut(o)).flatMap(o => Object.entries(o.bf || {}).filter(([, e]) => /\bCreature\b/.test(e.t || "")).map(([id, e]) => [e.n, `${o.id === pid ? "" : `${o.name}: `}${dispName(e)}`])); return `<select class="fetch-pick" id="fgp-${r.id}">${l.map(([v, n]) => `<option value="${esc(v)}">${esc(n)}</option>`).join("")}</select><button class="btn small primary" data-a="fgp-go" data-id="${r.id}">That one still deals damage</button>`; })()
              : r.selvala ? `<button class="btn small primary" data-a="selv-go" data-id="${r.id}">Add ${r.selvala.x} mana</button>`
              : r.pmana ? (r.pmana.cols.length === 2 ? `<label class="mini">${manaHtml(`{${r.pmana.cols[0]}}`)} <input type="number" min="0" max="${r.pmana.x}" class="x-input" id="pm-${r.id}" value="${r.pmana.x}" inputmode="numeric"></label><span class="mini">rest ${manaHtml(`{${r.pmana.cols[1]}}`)}</span>` : "")
                + `<button class="btn small primary" data-a="pm-go" data-id="${r.id}">Add ${r.pmana.x} mana</button>`
              : r.gmPick ? r.gmPick.pairs.map((pr, i) => `<button class="btn small" data-a="gm-go" data-id="${r.id}" data-i="${i}">${esc(pr.join(" + "))}</button>`).join("")
              : r.ninPick ? (r.ninPick.list.length ? r.ninPick.list.map(([id, n]) => `<button class="btn small" data-a="nin-go" data-id="${r.id}" data-t="${id}">↩ ${esc(n)}</button>`).join("") : `<span class="mini">No attacker marked this turn — move the unblocked one to hand yourself.</span><button class="btn small" data-a="nin-go" data-id="${r.id}" data-t="">Put it in anyway</button>`)
              : r.tymnaAsk ? `<div class="mini">How many opponents took combat damage this turn? (pay that much life, draw that many)</div>${Array.from({ length: r.tymnaAsk.max + 1 }, (_, i) => `<button class="btn small" data-a="tymna-go" data-id="${r.id}" data-n="${i}">${i}</button>`).join("")}`
              : r.tymna ? `<div class="mini">How many opponents were dealt combat damage this turn? (pay that much life, draw that many)</div>${Array.from({ length: r.tymna.max + 1 }, (_, i) => `<button class="btn small" data-a="tymna-go" data-id="${r.id}" data-n="${i}">${i}</button>`).join("")}`
              : r.typeDraw ? (() => { const ts = new Map(); Object.values(me.bf || {}).forEach(e => { const sub = String(e.t || "").split(" — ")[1]; if (/\bCreature\b|\bKindred\b|\bTribal\b/.test(e.t || "") && sub) sub.split(/\s+/).forEach(w => ts.set(w, 0)); }); Object.values(me.tokens || {}).forEach(t => String(t.name || "").split(/\s+/).filter(w => /^[A-Z][a-z]+$/.test(w) && !/^(Treasure|Clue|Food|Blood|Map|Gold|Powerstone|Incubator|Junk|Shard)$/.test(w)).forEach(w => ts.set(w, 0)));
                  const list = [...ts.keys()].map(w => [w, countTypes(me, [w.toLowerCase()])]).filter(x => x[1]).sort((a2, b2) => b2[1] - a2[1]).slice(0, 8);
                  return `<div class="mini">Pick the type (counted from your board) or type the number yourself.</div>${list.map(([w, n]) => `<button class="btn small" data-a="tdraw-go" data-id="${r.id}" data-n="${n}" data-w="${esc(w)}">${esc(w)}: draw ${n}</button>`).join("")}<input type="number" min="0" id="tdn-${r.id}" style="width:4em" placeholder="#"><button class="btn small primary" data-a="tdraw-go" data-id="${r.id}" data-n="">Draw that many</button>`; })()
              : /target non-aura enchantment you control becomes a creature in addition to its other types and has base power and base toughness each equal to its mana value/i.test(r.text || "") && !r.zurDone ? (() => { const l = Object.entries(me.bf || {}).filter(([, e]) => /\bEnchantment\b/.test(e.t || "") && !/\bAura\b/.test(e.t || "") && !/\bCreature\b/.test(e.t || ""));
                  return l.length ? `<select class="fetch-pick" id="zur-${r.id}">${l.map(([id, e]) => `<option value="${id}">${esc(dispName(e))} (${manaValue(e.m)}/${manaValue(e.m)})</option>`).join("")}</select><button class="btn small primary" data-a="zur-go" data-id="${r.id}">Animate it</button>` : `<span class="mini">No non-Aura noncreature enchantment to animate.</span>`; })()
              : r.mutPick ? (() => { const l = Object.entries(me.bf || {}).filter(([, e]) => /\bCreature\b/.test(e.t || "") && !/\bHuman\b/.test(e.t || "") && !e.own);
                  return l.length ? `<select class="fetch-pick" id="mut-${r.id}">${l.map(([id, e]) => `<option value="${id}">${esc(dispName(e))}${e.mutCards?.length > 1 ? ` (${e.mutCards.length} merged)` : ""}</option>`).join("")}</select><button class="btn small primary" data-a="mut-go" data-id="${r.id}" data-v="top">On top</button><button class="btn small" data-a="mut-go" data-id="${r.id}" data-v="under">Underneath</button>` : `<span class="mini">No non-Human creature you own to mutate onto — cast it normally.</span>`; })()
              : r.extraUp ? `<button class="btn small primary" data-a="xup-go" data-id="${r.id}">⏮ Run upkeep triggers (${r.extraUp} left)</button>`
              : r.radMill ? `<button class="btn small primary" data-a="radmill-go" data-id="${r.id}">☢ Mill ${r.radMill} and log them</button>`
              : r.pakoAsk ? `<div class="mini">How many of the exiled cards were noncreature?</div>${Array.from({ length: r.pakoAsk.max + 1 }, (_, i) => `<button class="btn small" data-a="pako-go" data-id="${r.id}" data-n="${i}">${i}</button>`).join("")}`
              : r.venture || /\bventure into (the dungeon|Undercity)\b/i.test(r.text || "") && !/you've completed|can't venture/i.test(r.text || "") ? ventureBox(r)
              : r.takeInit || /\byou take the initiative\b/i.test(r.text || "") ? `<button class="btn small primary" data-a="init-go" data-id="${r.id}">🗝️ Take the initiative${me.effects?.initiative ? " (again)" : ""} + venture into Undercity</button>`
              : r.planar ? `<button class="btn small primary" data-a="planar-go" data-id="${r.id}" data-v="r">🎲 Roll for me</button><button class="btn small" data-a="planar-go" data-id="${r.id}" data-v="blank">Blank</button><button class="btn small" data-a="planar-go" data-id="${r.id}" data-v="chaos">🌀 Chaos</button><button class="btn small" data-a="planar-go" data-id="${r.id}" data-v="pw">⇄ Planeswalk</button>`
              : /\b(manifest|manifests|cloak|cloaks)\b/i.test(r.text || "") && !/turned face up/i.test(r.text || "") ? `<button class="btn small primary" data-a="fd-make" data-id="${r.id}">🂠 Add a face-down 2/2</button>`
              : r.ewc ? `<button class="btn small primary" data-a="ewc-go" data-id="${r.id}">Add ${r.ewc.n} +1/+1 counter${r.ewc.n === 1 ? "" : "s"}</button>`
              : r.becomeMon || /\byou become the monarch\b/i.test(r.text || "") ? `<button class="btn small primary" data-a="mon-go" data-id="${r.id}">👑 Become the monarch</button>`
              : r.silenceAsk ? seated(room).map(o => `<button class="btn small" data-a="sil-go" data-id="${r.id}" data-p="${o.id}">${esc(o.id === pid ? "Me" : o.name)}</button>`).join("")
              : r.eqPick ? (() => { const eqs = Object.entries(me.bf || {}).filter(([, a]) => /\bEquipment\b/.test(a.t || "")), tg = attachTargets("creature");
                  return eqs.length ? `<select class="fetch-pick" id="eqp-e-${r.id}">${eqs.map(([i, a]) => `<option value="${i}">${esc(dispName(a))}${a.att ? " (moving)" : ""}</option>`).join("")}</select>${r.eqPick.to ? "" : `<select class="fetch-pick" id="eqp-t-${r.id}">${tg.map(([v, n]) => `<option value="${esc(v)}">${esc(n)}</option>`).join("")}</select>`}<button class="btn small primary" data-a="eqp-go" data-id="${r.id}">📎 Attach</button>` : `<span class="mini">No Equipment to attach.</span>`; })()
              : r.mizzix ? (() => { const gs = Object.entries(me.gy || {}).filter(([, g]) => /\b(Instant|Sorcery)\b/.test(g.t || lookupCard(g.n)?.t || "")); return gs.length ? `${gs.map(([gid, g]) => `<button class="btn small" data-a="mzx-go" data-id="${r.id}" data-g="${gid}">Copy ${esc(dispName(g))}</button>`).join("")}<button class="btn small primary" data-a="mzx-go" data-id="${r.id}" data-g="*">Overloaded: copy all ${gs.length}</button>` : `<span class="mini">No instant or sorcery cards in your graveyard.</span>`; })()
              : r.ovlAsk ? `<button class="btn small" data-a="ovl" data-id="${r.id}" data-v="0">Normal ${manaHtml(r.ovlAsk.base)}</button>
                <button class="btn small primary" data-a="ovl" data-id="${r.id}" data-v="1">Overloaded ${manaHtml(r.ovlAsk.cost)}</button>`
              : (r.drawN || drawCount(r.text)) && !r.effs?.length ? `${drawCap().left < (r.drawN || drawCount(r.text)) * (r.times || 1) ? `<span class="cost-tag no">${esc(drawCap().src)}: ${drawCap().left ? `only ${drawCap().left} more draw${drawCap().left === 1 ? "" : "s"}` : "no more draws"} this turn</span>` : ""}<button class="btn small primary" data-a="draw-go" data-id="${r.id}" data-n="${(r.drawN || drawCount(r.text)) * (r.times || 1)}">${drawCap().left ? `🂠 Drew ${Math.min(drawCap().left, (r.drawN || drawCount(r.text)) * (r.times || 1))}` : "OK (no draw)"}</button>${r.times > 1 ? `
                <button class="btn small" data-a="draw-go" data-id="${r.id}" data-n="${r.drawN || drawCount(r.text)}" data-one="1">Drew ${r.drawN || drawCount(r.text)} (one trigger)</button>` : ""}`
              : r.edictLocal ? edictPicker(`r:${r.id}`, r.edictLocal.n || 1, r.edictLocal.filter)
              : r.effs?.some(f => f.k === "edict") ? seated(room).filter(o => !isOut(o)).map(o => `<button class="btn small primary" data-a="edict-target" data-id="${r.id}" data-o="${o.id}" style="border-left:4px solid ${esc(o.color)}">${esc(o.name)}</button>`).join("")
              : r.effs?.some(f => f.k === "setlife") ? lifePicker(r)
              : r.effs?.some(f => f.k === "remove") ? removePicker(r)
              : r.effs?.some(f => f.k === "adnaus") ? adnPicker(r)
              : r.effs?.some(f => f.k === "airbend") ? airPicker(r)
              : r.punish ? `<span class="mini">${r.who ? `Waiting for ${esc(room.players?.[r.who]?.name || "them")} to choose…` : "Who triggered it?"}</span>
                  <button class="btn small" data-a="pun-res" data-id="${r.id}" data-v="yes">They paid</button>
                  <button class="btn small primary" data-a="pun-res" data-id="${r.id}" data-v="no">They didn't</button>`
              : r.attack ? opponents().map(o => `<button class="btn small primary" data-a="atk-to" data-id="${r.id}" data-o="${o.id}" style="border-left:4px solid ${esc(o.color)}">⚔ ${esc(o.name)}</button>`).join("")
              : r.gift ? opponents().map(o => `<button class="btn small primary" data-a="gift-to" data-id="${r.id}" data-o="${o.id}" style="border-left:4px solid ${esc(o.color)}">🎁 ${esc(o.name)}</button>`).join("")
              : r.effs?.some(f => f.k === "tdraw") ? opponents().map(o => `<button class="btn small primary" data-a="draw-to" data-id="${r.id}" data-o="${o.id}" style="border-left:4px solid ${esc(o.color)}">🎁 ${esc(o.name)} draws ${r.effs.find(f => f.k === "tdraw").n * (r.times || 1)}</button>`).join("")
              : r.effs?.some(f => f.k === "tlose") ? windowState(r).html + seated(room).filter(o => o.id !== pid && !isOut(o)).map(o =>
                `<button class="btn small primary" ${windowState(r).ready && !o.prot?.all ? "" : "disabled"} data-a="rem-target" data-id="${r.id}" data-o="${o.id}" style="border-left:4px solid ${esc(o.color)}">${o.prot?.all ? "🛡 " : ""}${esc(o.name)} loses ${r.effs.find(f => f.k === "tlose").n * (r.times || 1)}</button>`).join("")
              : r.modes ? modePicker(r) : r.choice ? r.effs.map((f, i) => `<button class="btn small primary" data-a="rem-pick" data-id="${r.id}" data-i="${i}">${esc(f.name)}</button>`).join("")
              : r.effs?.length ? `<button class="btn small primary" data-a="rem-apply" data-id="${r.id}">${r.resolveOrder ? "▶ Resolve" : "Apply"}</button>`
              : r.fetch ? fetchPicker(r) : ""}
            ${reminders.length > 1 && reminders[0] !== r ? `<button class="btn small ghost" data-a="rem-up" data-id="${r.id}" title="You choose the order: move this one to the top to resolve it first">⬆ First</button>` : ""}<button class="btn small" data-a="rem-dismiss" data-id="${r.id}">${r.atkPlan ? "Cancel" : r.gift ? "No gift" : r.effs?.some(f => f.k === "adnaus") ? "Stop" : r.effs?.length || (drawCount(r.text) && /^you may/i.test(r.text)) ? "Skip" : "Done"}</button>
          </div>
        </div>`).join("")}${reminders.length > 4 ? `<div class="mini">+${reminders.length - 4} more</div>` : ""}</div>` : ""}`;
    lockHexPlayers();
    $("autoBtn").textContent = `Auto triggers: ${auto ? "on" : "off"}`;
    $("autoBtn").classList.toggle("on", auto);

    // Life tab
    lifeMain.innerHTML = `
      <div class="me" style="--pc:${esc(me.color)}">
        <div class="me-life ${isOut(me) ? "dead" : ""}">${me.life ?? START_LIFE}</div>
        <div class="life-btns">${[-5, -1, 1, 5].map(d => `<button class="btn big" data-a="life" data-d="${d}">${d > 0 ? "+" : "−"}${Math.abs(d)}</button>`).join("")}</div>
      </div>`;
    lifeBody.innerHTML = `
      <section class="card" data-tour="pc">
        <h3>Player counters</h3>
        ${PLAYER_COUNTERS.map(c => `
          <div class="counter">
            <span class="who">${c.label}</span>
            <button class="btn" data-a="pc" data-k="${c.k}" data-d="-1">−</button>
            <span class="num ${c.lethal && (me[c.k] || 0) >= c.lethal ? "lethal" : ""}">${me[c.k] || 0}</span>
            <button class="btn" data-a="pc" data-k="${c.k}" data-d="1">+</button>
          </div>`).join("")}
      </section>
      <section class="card" data-tour="cmd">
        <h3>Commander damage taken</h3>
        ${opps.length ? opps.map(o => {
          const cmds = o.commanders?.length ? o.commanders : [""];
          const rows = cmds.map(c => [c ? `${o.id}~${slugify(c)}` : o.id, c]);
          if (o.commanders?.length && me.cmd?.[o.id]) rows.push([o.id, "(earlier, unassigned)"]);
          return rows.map(([key, c]) => {
            const n = me.cmd?.[key] || 0;
            return `<div class="counter">
              <span class="dot" style="background:${esc(o.color)}"></span><span class="who">${esc(o.name)}${c ? `<span class="sub">${esc(c)}</span>` : ""}</span>
              <button class="btn" data-a="cmd" data-o="${esc(key)}" data-d="-1">−</button>
              <span class="num ${n >= 21 ? "lethal" : ""}">${n}</span>
              <button class="btn" data-a="cmd" data-o="${esc(key)}" data-d="1">+</button>
            </div>`;
          }).join("");
        }).join("") + `<p class="muted">21 from any one commander knocks you out. Also takes it off your life total.</p>` : `<p class="muted">No opponents have joined yet.</p>`}
      </section>
      ${opps.length ? `<section class="card"><h3>👁 Look at a hand</h3><p class="muted">For Thoughtseize, Telepathy, "look at target player's hand"… They get a popup to show it (or decline).</p><button class="btn" data-a="hand-ask-open">👁 Ask to see a hand…</button></section>` : ""}`;

    const active = Object.entries(me.effects || {});
    const pd = pendingEffect && effectDef(pendingEffect);
    effEl.innerHTML = `
      <section class="card">
        <h3>Effects</h3>
        ${active.length ? `<div class="active-effects">${active.map(([k, ef]) => `<button class="chip on" data-a="eff-rm" data-k="${esc(k)}">${ef.icon} ${esc(ef.name)}${ef.dur === "turn" ? " · this turn" : ""} ✕</button>`).join("")}</div>` : ""}
        ${pd ? `<div class="ask"><div>${pd.icon} ${esc(pd.name)}: how long?</div>
          <div class="row">
            <button class="btn" data-a="eff-dur" data-dur="turn">This turn</button>
            <button class="btn" data-a="eff-dur" data-dur="ongoing">Until removed</button>
            <button class="btn ghost" data-a="eff-cancel">Cancel</button>
          </div></div>` : ""}
        <div class="chips">${EFFECTS.filter(d => !me.effects?.[d.key]).map(d => `<button class="chip" data-a="eff-add" data-k="${d.key}">${d.icon} ${esc(d.name)}</button>`).join("")}</div>
        <p class="muted">"This turn" effects clear on their own when the turn passes. Tap an active effect to remove it.</p>
      </section>`;

    // Board tab: command zone (a commander on the battlefield isn't in it)
    cmdZone.innerHTML = cmdZoneHtml();

    // Board tab: battlefield
    const entries = Object.entries(me.bf || {});
    const groups = [["creature", "Creatures"], ["pw", "Planeswalkers"], ["other", "Artifacts & enchantments"], ["land", "Lands"]];
    bfList.innerHTML = `
      <section class="card">
        <div class="card-head"><h3>Battlefield</h3><button class="btn small ${trackMana ? "on" : ""}" data-a="mana-mode" title="Show ⚡ buttons that tap for mana into your mana pool">🔋 ${trackMana ? "Mana: on" : "Mana: off"}</button>${entries.some(([, e]) => e.tap) || Object.values(me.tokens || {}).some(t => t.tapped) ? `<button class="btn small" data-a="untap-all">Untap all</button>` : ""}</div>
        ${entries.length ? groups.map(([g, label]) => {
          const list = entries.filter(([, e]) => group(e) === g).sort((a, b) => a[1].n.localeCompare(b[1].n));
          return list.length ? `<div class="grp-title">${label} (${list.length})</div>${list.map(([id, e]) => permRow(id, e)).join("")}` : "";
        }).join("") : phasedList().length ? "" : `<p class="muted">Nothing here yet. Search your deck above to play a card.</p>`}
        ${phasedList().length ? `<div class="grp-title">👻 Phased out (${phasedList().length})</div><p class="mini">Still yours, but treated as though they don't exist until they phase in at your next untap step.</p>${phasedList().map(n => `<div class="perm phased"><div class="perm-row"><span class="who">${n.cmd ? "⭐ " : ""}${esc(n.label)}</span><span class="att-tag">👻 Phased out</span></div></div>`).join("")}<button class="btn small" data-a="phase-in">Phase in now</button>` : ""}
      </section>`;

    // Board tab: suspended cards
    const susp = Object.entries(me.susp || {});
    $("suspList").innerHTML = susp.length ? `
      <section class="card">
        <h3>⏳ Suspended</h3>
        <p class="muted">A time counter comes off at the start of each of your turns.</p>
        ${susp.map(([id, e]) => `<div class="counter">
          <button class="link who" data-a="view-susp" data-id="${id}">${esc(dispName(e))}</button>
          <button class="btn" data-a="susp-time" data-id="${id}" data-d="-1">−</button><span class="num">${e.time}</span>
          <button class="btn" data-a="susp-time" data-id="${id}" data-d="1">+</button>
          ${e.time <= 0 ? `<button class="btn small primary" data-a="susp-cast" data-id="${id}">Cast free</button>` : ""}
        </div>`).join("")}
      </section>` : "";

    // Board tab: airbended cards (in exile, owner may cast for {2})
    const air = Object.entries(me.air || {});
    $("airList").innerHTML = air.length ? `
      <section class="card air-card">
        <h3>🌀 Airbended</h3>
        <p class="muted">In exile. You may cast these for ${manaHtml("{2}")} instead of their mana cost.</p>
        ${air.map(([id, e]) => `<div class="counter">
          <button class="link who" data-a="view-air" data-id="${id}">${esc(dispName(e))}</button> ${manaHtml(e.m)}
          ${room.airLock && room.airLock.by !== pid ? `<span class="mini">Locked until ${esc(room.airLock.name)}'s next turn</span>`
            : `<button class="btn small primary" data-a="air-cast" data-id="${id}">Cast for ${manaHtml("{2}")}${e.cmd ? " (no tax)" : ""}</button>`}
          ${e.cmd ? `<button class="btn small" data-a="air-cmd" data-id="${id}">→ Command zone</button>` : ""}
          <button class="btn small" data-a="air-back" data-id="${id}" title="It shouldn't have been airbended">↩ Back on the battlefield</button>
          <button class="btn small ghost" data-a="air-drop" data-id="${id}" aria-label="Leave in exile">✕</button>
        </div>`).join("")}
      </section>` : "";

    const ph = me.phased, phList = [...Object.values(ph?.bf || {}).map(dispName), ...Object.values(ph?.tokens || {}).map(t => `${t.count} ${t.name}`)];
    $("zoneList").innerHTML = (me.prot ? `<section class="card phased-card">
      <h3>👻 Phased out${me.prot ? ` · 🛡 ${esc(me.prot.src)}` : ""}</h3>
      ${me.prot ? `<p class="mini">${me.prot.all ? "Protection from everything" : ""}${me.prot.all && me.prot.life ? " · " : ""}${me.prot.life ? "your life total can't change" : ""} until your next turn.</p>` : ""}
      </section>` : "") + (me.ring?.n ? `<section class="card ring-card">
      <h3>💍 The Ring has tempted you ×${me.ring.n}</h3>
      <p class="mini">Ring-bearer: <b>${ringBearer(me) ? esc(ringBearer(me).name) : "none (choose one the next time the Ring tempts you)"}</b></p>
      <ol class="mini ring-list">${RING_LEVELS.slice(0, ringLevel(me)).map(t => `<li>${esc(t)}</li>`).join("")}</ol></section>` : "") + (tab === "hand" ? "" : zonesHtml());

    // Board tab: tokens
    const toks = Object.entries(me.tokens || {});
    tokList.innerHTML = `
      <section class="card">
        <h3>Your tokens</h3>
        ${(() => { const mc = manaCrew(); return mc ? `<p class="mini mana-line">⚡ ${mc.ready} creature${mc.ready === 1 ? "" : "s"}/token${mc.ready === 1 ? "" : "s"} can tap for mana now${mc.sick ? ` · ${mc.sick} summoning sick` : ""} <span class="muted">(${esc(mc.srcs.join(", "))})</span></p>` : ""; })()}
        ${toks.length ? toks.map(([k, t]) => `
          <div class="tok-item">
          <div class="tok-name">
            <button class="link who tok-title" data-a="view-token" data-k="${esc(k)}">${esc(t.name)}</button>${tokPTfx(t, pid, k) ? `<span class="pt">${tokPTfx(t, pid, k)}</span>` : ""}${tokMarks(me, k).length ? ` <span class="dmg-tag" title="Damage marked this turn">🩸${tokMarks(me, k).join(", ")}</span>` : ""}
            ${isCreatureToken(t.name) ? kwHtml(kwsOf(tokenPerm(t), pid, k, true)) : ""}${sickTokens(t, meOwner(), k) ? `<span class="sick">💤${sickTokens(t, meOwner(), k) < t.count ? ` ${sickTokens(t, meOwner(), k)}` : ""}</span>` : ""}${t.c ? ` <span class="cost-tag down">${esc(Object.entries(t.c).map(([ck, v]) => `${counterLabel(ck)} ×${v}`).join(" · "))}</span>` : ""}
            ${ringBearer(me)?.k === k ? `<span class="ring-tag" title="${esc(ringTitle(me))}">💍 Ring-bearer</span>` : ""}
            ${attachedTo(me, k, true, t).map(([, a]) => `<span class="att-tag">📎 ${esc(dispName(a))}</span>`).join("")}
            ${t.sus ? `<span class="att-tag">🕵 suspected · can't block</span>` : ""}${blockingNow(me)[`tok:${k}`] ? `<span class="att-tag">🛡 ${blockingNow(me)[`tok:${k}`]} blocking this combat</span>` : ""}${t.sh ? `<span class="att-tag">♻ regen shield${t.sh > 1 ? ` ×${t.sh}` : ""}</span>` : ""}
            ${t.tapped ? `<span class="sub">${t.tapped} of ${t.count} tapped</span>` : ""}
            ${t.own ? `<span class="own-tag" style="--oc:${esc(t.own.color || "#888")}">${esc(t.own.name)}'s</span>` : ""}
          </div>
          <div class="tok-controls">
            <button class="btn ${rmOpen === k ? "on" : ""}" data-a="tok-rm" data-k="${esc(k)}" aria-label="Remove">−</button>
            <span class="num">${t.count}</span>
            <button class="btn" data-a="tok" data-k="${esc(k)}" data-d="1">+</button>
            <button class="btn" data-a="tok" data-k="${esc(k)}" data-d="5">+5</button>
            <button class="btn small ${tapOpen === k ? "on" : ""}" data-a="tok-tapmenu" data-k="${esc(k)}" aria-label="Tap">⤵ Tap</button>
            ${trackMana && t.count - (t.tapped || 0) > 0 ? [...new Set(grantedCreatureMana(true, tokenPerm(t).t, t))].filter(sym => !/\bCreature\b/.test(tokenPerm(t).t) || t.count - (t.tapped || 0) > sickTokens(t, meOwner(), k)).map(sym => `<button class="btn small mana-tap" data-a="tok-mana" data-k="${esc(k)}" data-s="${sym}" title="Tap one for mana">⚡${sym === "any" ? "any" : manaHtml(sym)}</button>`).join("") : ""}
            ${isCreatureToken(t.name) ? `<button class="btn small" data-a="tok-ctr" data-k="${esc(k)}" aria-label="Counters">±⬆</button><button class="btn small ${adjOpen === k ? "on" : ""}" data-a="tok-adjmenu" data-k="${esc(k)}" title="Adjust power/toughness by hand">✎ P/T</button><button class="btn small ${atkOpen === k ? "on" : ""}" data-a="tok-atkmenu" data-k="${esc(k)}">⚔ Attack</button>` : ""}
            ${borrowedAbilities(t).map(x => `<button class="btn small" data-a="brew-ab" data-k="${esc(k)}" data-n="${esc(x.n)}" data-i="${x.i}" title="From ${esc(x.n)} (${esc(x.host)})">🍲 ${esc(x.ab.cost)}: ${esc(x.ab.label.slice(0, 40))}</button>`).join("")}
            ${(TOKEN_USES[k] || TOKEN_USES[slugify(t.name)]) ? `<button class="btn small primary" data-a="tok-use" data-k="${esc(k)}">${(TOKEN_USES[k] || TOKEN_USES[slugify(t.name)]).label}</button>` : ""}${t.own ? `<button class="btn small" data-a="give-back-tok" data-k="${esc(k)}">↩ Return</button>` : ""}
          </div>
          ${atkOpen === k ? `<div class="rm-row"><span class="muted">Attack with</span>
            <input type="number" min="1" max="${t.count - (t.tapped || 0)}" inputmode="numeric" class="x-input" id="ta-${esc(k)}" value="${t.count - (t.tapped || 0)}">
            <span class="muted">of ${t.count - (t.tapped || 0)} untapped</span>
            <button class="btn small ghost" data-a="tok-atkmenu" data-k="${esc(k)}">Cancel</button>${planBox({ id: "" }, "tok", k, t.count - (t.tapped || 0))}</div>` : ""}
          ${adjOpen === k ? `<div class="rm-row adj-tok">${adjHtml("tok", k, t.adj)}<button class="btn small ghost" data-a="tok-adjmenu" data-k="${esc(k)}">Done</button></div>` : ""}
          ${tapOpen === k ? `<div class="rm-row"><span class="muted">${t.tapped || 0} of ${t.count} tapped:</span>
            <button class="btn small" data-a="tok-tap" data-k="${esc(k)}" data-d="1" ${(t.tapped || 0) >= t.count ? "disabled" : ""}>Tap 1</button>
            <button class="btn small" data-a="tok-tap" data-k="${esc(k)}" data-d="all" ${(t.tapped || 0) >= t.count ? "disabled" : ""}>Tap all</button>
            <button class="btn small" data-a="tok-tap" data-k="${esc(k)}" data-d="-1" ${!t.tapped ? "disabled" : ""}>Untap 1</button>
            <button class="btn small" data-a="tok-tap" data-k="${esc(k)}" data-d="none" ${!t.tapped ? "disabled" : ""}>Untap all</button>
            <button class="btn small ghost" data-a="tok-tapmenu" data-k="${esc(k)}">Done</button></div>` : ""}
          ${rmOpen === k ? `<div class="rm-row"><span class="muted">Remove 1 ${esc(t.name)}:</span>
            ${(isCreatureToken(t.name) ? [["died", "☠ Died"], ["sac", "🗡 Sacrificed"], ["other", "↩ Exiled / other"]] : [["sac", "🗡 Sacrificed"], ["other", "↩ Other"]])
              .map(([how, lbl]) => `<button class="btn small" data-a="tok-rm-go" data-k="${esc(k)}" data-how="${how}">${lbl}</button>`).join("")}
            <button class="btn small ghost" data-a="tok-rm" data-k="${esc(k)}">Done</button></div>` : ""}
          </div>`).join("") : `<p class="muted">None yet. Tap a token below to make one.</p>`}
      </section>`;
  }

  // "Choose one / one or more —" modes
  const PICK_N = { one: 1, two: 2, three: 3, four: 4 };
  function modePicker(r) {
    const label = m => `${m.name ? `<b>${esc(m.name)}</b>: ` : ""}${esc(m.text)}`;
    if (r.repeat) {
      const need = PICK_N[r.pick] || 1, got = Object.values(r.reps).reduce((a, b) => a + b, 0);
      return `<div class="modes">${r.modes.map((m, i) => `<div class="mode-rep"><button class="btn small" data-a="mode-rep" data-id="${r.id}" data-i="${i}" data-d="-1" ${r.reps[i] ? "" : "disabled"}>−</button><span class="num">${r.reps[i] || 0}</span>
        <button class="btn small" data-a="mode-rep" data-id="${r.id}" data-i="${i}" data-d="1" ${got >= need ? "disabled" : ""}>+</button><span>${label(m)}</span></div>`).join("")}</div>
        <button class="btn small primary" data-a="mode-go" data-id="${r.id}" ${got === need ? "" : "disabled"}>Apply (${got}/${need})</button>`;
    }
    if (r.pick === "one") return `<div class="modes">${r.modes.map((m, i) =>
      `<button class="btn small mode" data-a="mode-go" data-id="${r.id}" data-i="${i}">${label(m)}</button>`).join("")}</div>`;
    return `<div class="modes">${r.modes.map((m, i) =>
      `<label class="mode-check"><input type="checkbox" class="mode-box" data-rid="${r.id}" value="${i}"><span>${label(m)}</span></label>`).join("")}
      <button class="btn small primary" data-a="mode-go" data-id="${r.id}">Apply selected</button></div>`;
  }
  function applyModes(r, idxs) {
    const picked = idxs.map(i => r.modes[i]).filter(Boolean);
    if (!picked.length) { toast(r.pick === "multi" ? "Tick at least one option." : "Pick an option."); return; }
    if (picked.some(m => JSON.stringify(m.effs).match(/"X"|tloseX|"[+-]X"/))) {
      const x = Math.max(0, Math.floor(Number(prompt(`${r.src}: X = ?`, "1")) || 0));
      const sub = f => f.k === "tloseX" ? { k: "tloseX", n: x } : f.k === "regrow" && f.filter?.mv?.val === "X" ? { ...f, filter: { ...f.filter, mv: { ...f.filter.mv, val: x } } }
        : f.k === "pumpTarget" ? { ...f, dp: String(f.dp).replace(/X/i, x), dt: String(f.dt).replace(/X/i, x), ...(f.n === "X" ? { n: x } : {}) } : f;
      picked.forEach((m, i) => { picked[i] = { ...m, effs: m.effs.map(sub) }; });
      picked.forEach(m => m.effs.filter(f => f.k === "tloseX").forEach(f => reminders.push({ id: newId(), src: r.src, text: `Target player loses ${f.n} life.`, times: 1, tloseX: f.n })));
      picked.forEach((m, i) => { const had = m.effs.some(f => f.k === "tloseX"); picked[i] = { ...m, effs: m.effs.filter(f => f.k !== "tloseX"), ...(had && m.effs.length === 1 ? { extra: false } : {}) }; });
    }
    reminders = reminders.filter(x => x.id !== r.id);
    logTo(code, `${me.name}: ${r.src} → ${picked.map(m => m.name || m.text).join(", ")}`);
    const PICKERS = ["revealMv", "victimize", "tloseX", "clearCtrs", "drainDevo", "dmgCr", "wisecrack", "dmgAll", "discardN", "mill", "drawFor", "gainPer", "tgain", "gyOne", "sacThen", "pumpTarget", "pumpAll", "countersTarget", "tokCopy", "tplayerTok", "edict", "handmana", "impulse", "regrow", "gyhate", "stealEx", "ping", "remove", "fetch", "adnaus", "countersEach", "tok"];
    picked.filter(m => m.extra && !(m.effs.length && m.effs.every(f => PICKERS.includes(f.k)))).forEach(m => reminders.push({ id: newId(), src: r.src, text: m.text, times: r.times,
      note: m.effs.length ? "Partly applied. Handle the rest yourself." : "" }));
    picked.filter(m => m.extra && m.effs.length && m.effs.every(f => PICKERS.includes(f.k)) && /\bdraw (a|one|two|three) cards?\b/i.test(m.text) && !m.effs.some(f => /draw/i.test(f.k)))
      .forEach(m => reminders.push({ id: newId(), src: r.src, text: (m.text.match(/\bdraw (?:a|one|two|three) cards?\./i) || ["Draw a card."])[0].replace(/^\w/, c => c.toUpperCase()), times: r.times }));
    picked.forEach(m => m.effs.filter(f => ["remove", "fetch", "adnaus"].includes(f.k)).forEach(f =>
      reminders.push(f.k === "fetch" ? { id: newId(), src: r.src, text: "Search your library", fetch: f, left: f.n, times: 1 }
        : { id: newId(), src: r.src, text: f.how ? `${f.how} ${f.what}` : "Reveal cards", effs: [f], times: r.times || 1 })));
    const effs = picked.flatMap(m => m.effs).filter(f => !["remove", "fetch", "adnaus"].includes(f.k));
    if (effs.length) act([{ type: "effects", effs, times: r.times || 1, count: r.count || 1, src: r.src, srcId: r.srcId }]);
    else render();
  }

  // Lands in the deck that a search effect can find, minus copies already on the battlefield
  // The mana value limit for a search: a fixed number, counted from the board, or what the caster entered
  function searchX(r) {
    const mv = r.fetch.mv;
    if (!mv) return null;
    if (mv.val != null) return mv.val;
    if (mv.count) return countTypes(me, mv.count);
    return r.x ?? null;
  }
  function fetchCandidates(r) {
    if (!deck) return [];
    const x = searchX(r);
    // copies already used: on the battlefield before the search started, plus ones picked (a battlefield pick lands there too, so don't count it twice)
    const onBf = name => Object.values(me.bf || {}).filter(e => e.n === name).length;
    r.startBf ||= Object.fromEntries([...new Set(Object.values(me.bf || {}).map(e => e.n))].map(n => [n, onBf(n)]));
    const taken = name => Math.max(onBf(name), (r.startBf[name] || 0) + (r.picked || []).filter(n => n === name).length)
      + (deck.cards.find(c => c.n === name && dispName(c) === r.src && isSpell(c)) ? 1 : 0);
    // Myriad Landscape: "basic land cards that share a land type" → after the first pick, only lands sharing one of its types
    const need = r.fetch.share && r.picked?.length ? sharedTypes(r.picked) : null;
    // digital deck: only cards still in the library (each pick is pulled out of it right away)
    return deck.cards.map((c, i) => [c, i]).filter(([c]) => matchesSearch(c, r.fetch, x) && (dig?.on ? dig.lib.includes(c.n) : c.qty - taken(c.n) > 0) && (!need || landTypes(c.t).some(t => need.includes(t))))
      .sort((a, b) => a[0].n.localeCompare(b[0].n));
  }
  const LAND_TYPES = ["Plains", "Island", "Swamp", "Mountain", "Forest"];
  const landTypes = t => LAND_TYPES.filter(x => new RegExp(`\\b${x}\\b`).test(t || ""));
  // land types every picked card has in common
  const sharedTypes = names => names.map(n => landTypes(deck?.cards.find(c => c.n === n)?.t)).reduce((a, b) => a.filter(t => b.includes(t)));
  const DEST_LABEL = { battlefield: "Put onto battlefield", hand: "Put into hand", top: "Put on top of library", graveyard: "Put into graveyard" };
  function fetchPicker(r) {
    const f = r.fetch;
    if (f.mv?.ask && r.x == null) return `<div class="x-ask"><label>${f.mv.op === "=" ? "Mana value" : "X"} (${esc(f.mv.hint)}):
        <input type="number" min="0" inputmode="numeric" id="fx-${r.id}" class="x-input"></label>
        <button class="btn small primary" data-a="fetch-x" data-id="${r.id}">Show cards</button></div>`;
    const list = fetchCandidates(r);
    let xs = f.mv ? `<span class="mini">Mana value ${f.mv.op === "<=" ? "≤" : f.mv.op === ">=" ? "≥" : "="} ${searchX(r)}${f.mv.ask ? ` <button class="linkish" data-a="fetch-x-reset" data-id="${r.id}">change</button>` : ""}</span>` : "";
    if (f.share && r.picked?.length) xs += `<span class="mini">Must share a land type with ${esc(r.picked.join(", "))} (${esc(sharedTypes(r.picked).join("/") || "none")})</span>`;
    if (!list.length) return `${xs}<span class="mini">No matching cards left in your deck list.</span>`;
    return `${xs}<select class="fetch-pick" id="fp-${r.id}">${list.map(([c, i]) => `<option value="${i}">${esc(dispName(c))}${c.m ? ` (${manaValue(c.m)})` : ""}</option>`).join("")}</select>
      <button class="btn small primary" data-a="fetch-put" data-id="${r.id}">${DEST_LABEL[f.dest]}${f.dest === "battlefield" && f.tapped ? " tapped" : ""}${r.left > 1 ? ` (${r.left} left)` : ""}</button>`;
  }
  // When a search finishes (or is skipped), remind to shuffle
  // ----- Coin flips (Okaun, Zndrsplt, Krark, Stitch in Time…) -----
  // Smellerbee & co.: "you may discard your hand. If you do, draw cards equal to the number of attacking creatures"
  const WHEEL_ATK = /you may discard your hand\. if you do, draw (?:cards equal to the number of attacking creatures|that many cards)/i;
  // Springheart Nantuko: pay to copy the creature it enchants, otherwise a 1/1 Insect
  const COPY_HOST = /you may pay ((?:\{[^}]+\})+) if this permanent is attached to a creature you control\. if you do, create a token that's a copy of that creature\. if you didn't create a token this way, create an? ([^.]+?) token/i;
  function copyHostBar(r) {
    const m = String(r.text || "").match(COPY_HOST); if (!m) return "";
    const self = r.srcId && me.bf?.[r.srcId], host = self?.att && self.att !== "tok" ? me.bf?.[self.att] : null;
    return `<div class="row">${host ? `<button class="btn small primary" data-a="copyhost-go" data-id="${r.id}" data-k="copy">Paid ${manaHtml(m[1])}: copy ${esc(dispName(host))}</button>` : `<span class="mini muted">Not attached to a creature you control.</span>`}
      <button class="btn small" data-a="copyhost-go" data-id="${r.id}" data-k="alt">Make ${esc(m[2])}</button></div>`;
  }
  function wheelBar(r) {
    if (!WHEEL_ATK.test(r.text || "")) return "";
    const thatMany = /draw that many cards/i.test(r.text), handN = dig?.on ? dig.hand.length : null;
    const n = thatMany ? handN : attackersNow();
    return `<div class="row">${dig?.on ? `<button class="btn small primary" data-a="wheelatk-go" data-id="${r.id}">🗑 Discard my hand (${handN}) → draw ${n ?? "?"}</button>`
      : `<label class="mini">Draw <input type="number" min="0" class="x-input" id="wh-${r.id}" value="${n ?? ""}" inputmode="numeric"></label><button class="btn small primary" data-a="wheelatk-go" data-id="${r.id}">🗑 I discarded my hand → draw</button>`}
      <span class="mini muted">${thatMany ? "" : `${attackersNow()} attacking so far: tap after you've declared all attackers.`}</span></div>`;
  }
  function coinBar(r) {
    if (!/\bflips? (?:a coin|\w+ coins|that many)|\bflip a coin\b|\bflip coins\b/i.test(r.text || "")) return "";
    const f = r.flips || { w: 0, l: 0 }, until = /until you lose a flip/i.test(r.text || "");
    const done = until && f.l > 0;
    return `<div class="row mini">🪙 ${f.w || f.l ? `Won ${f.w} · lost ${f.l}${done ? " — done flipping" : ""}` : "Coin flip"}${done ? "" : `
      <button class="btn small primary" data-a="coin-go" data-id="${r.id}" data-v="r">🪙 Flip for me</button>
      <button class="btn small" data-a="coin-go" data-id="${r.id}" data-v="1">Won</button>
      <button class="btn small" data-a="coin-go" data-id="${r.id}" data-v="0">Lost</button>`}</div>`;
  }
  // "Each player gets a rad counter", "target player gets two rad counters", "you get half X rad counters"…
  const RADN = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 };
  function radParse(text) {
    const m = String(text || "").match(/\b(each player|each opponent|target player|you|that player|they|defending player)(?: may)? gets? (a|an|one|two|three|four|five|six|\d+|x|half x|that many|twice that many|a number of) rad counters?/i);
    if (!m) return null;
    const w = m[2].toLowerCase(), who = m[1].toLowerCase();
    return { who: who === "each player" ? "all" : who === "each opponent" ? "opps" : who === "you" ? "me" : "pick", n: RADN[w] ?? (/^\d+$/.test(w) ? Number(w) : null) };
  }
  function radBar(r) {
    const k = radParse(r.text); if (!k || r.radDone) return "";
    const btn = (p, label, color) => `<button class="btn small" data-a="rad-go" data-id="${r.id}" data-p="${p}"${color ? ` style="border-left:4px solid ${esc(color)}"` : ""}>${esc(label)}</button>`;
    return `<div class="row mini">☢ <input type="number" min="0" id="radn-${r.id}" style="width:4em" value="${k.n ?? ""}" placeholder="#"> rad →
      ${k.who === "all" ? btn("all", "Each player") : k.who === "opps" ? btn("opps", "Each opponent") : k.who === "me" ? btn(pid, "Me") : seated(room).filter(o => !isOut(o)).map(o => btn(o.id, o.id === pid ? "Me" : o.name, o.color)).join("")}</div>`;
  }
  function giveRad(ids, n, src) {
    if (!n || !ids.length) return;
    const u = {}; ids.forEach(id => { const o = room.players?.[id]; if (o) u[`players/${id}/rad`] = (o.rad || 0) + n; });
    update(ref(db, `rooms/${code}`), u);
    logTo(code, `☢ ${src}: ${ids.map(id => id === pid ? me.name : room.players?.[id]?.name).join(", ")} ${ids.length === 1 ? "gets" : "get"} ${n} rad counter${n === 1 ? "" : "s"}`);
  }
  // Discover N (Pantlaza…): pick a nonland card with mana value N or less, cast it free or put it into your hand
  function discoverBar(r) {
    const m = String(r.text || "").match(/\bdiscovers? (\d+|x)\b/i); if (!m || r.discDone || /that player discovers/i.test(r.text || "")) return "";
    let n = /^\d+$/.test(m[1]) ? Number(m[1]) : null;
    if (n == null && /x is that creature's toughness/i.test(r.text)) { const last = Object.entries(me.bf || {}).filter(([, e]) => /\bCreature\b/.test(e.t || "")).at(-1); if (last) n = Number(ptOf(last[1], countsFor(me), pid, last[0]).split("/")[1]) || null; }
    const cards = (deck?.cards || []).map((c, i) => [c, i]).filter(([c]) => !/\bLand\b/.test(c.t || "") && (n == null || manaValue(c.m) <= n)).sort((a, b) => manaValue(b[0].m) - manaValue(a[0].m) || a[0].n.localeCompare(b[0].n));
    return `<div class="row mini">🔭 Discover <input type="number" min="0" id="dsn-${r.id}" style="width:3.5em" value="${n ?? ""}" data-a="dsc-n" data-id="${r.id}">: exile from the top until a nonland card with that mana value or less, then
      <select class="fetch-pick" id="dsc-${r.id}">${cards.map(([c, i]) => `<option value="${i}">${esc(dispName(c))} (${manaValue(c.m)})</option>`).join("")}</select>
      <button class="btn small primary" data-a="dsc-go" data-id="${r.id}" data-v="cast">Cast it free</button><button class="btn small" data-a="dsc-go" data-id="${r.id}" data-v="hand">Put it in hand</button></div>`;
  }
  // Explore (Hakbal, Path of Discovery, Map tokens…): one row per exploring creature
  function dmgWatchers(e) {
    if (!/\bCreature\b/.test(e.t || "")) return [];
    return Object.values(me.bf || {}).flatMap(x => { const m = String(x.o || lookupCard(x.n)?.o || "").match(/whenever an? ([A-Z][a-z]+) you control is dealt damage, ([^\n]+)/); return m && new RegExp(`\\b${m[1]}\\b`).test(e.t || "") ? [[dispName(x), m[2]]] : []; });
  }
  function exploreWho(r) {
    const t = String(r.text || "");
    if (!/\bexplores?\b/i.test(t) || /whenever a creature you control explores/i.test(t)) return null;
    const ty = t.match(/each ([A-Z][a-z]+) creature you control explores/i);
    if (ty) return Object.entries(me.bf || {}).filter(([, e]) => new RegExp(`\\b${ty[1]}\\b`).test(e.t || "") && /\bCreature\b/.test(e.t || "")).map(([id]) => id);
    if (/target creature you control explores/i.test(t)) return Object.entries(me.bf || {}).filter(([, e]) => /\bCreature\b/.test(e.t || "")).map(([id]) => id);
    if (/whenever a creature you control enters, it explores/i.test(t)) { const last = Object.entries(me.bf || {}).filter(([, e]) => /\bCreature\b/.test(e.t || "")).at(-1); return last ? [last[0]] : []; }
    return r.srcId && me.bf?.[r.srcId] ? [r.srcId] : [];
  }
  function exploreBar(r) {
    const ids = exploreWho(r); if (!ids || r.explDone) return "";
    const twice = Object.values(me.bf || {}).filter(x => /if a creature you control would explore, instead it explores, then it explores again/i.test(x.o || lookupCard(x.n)?.o || "")).length;
    const per = 2 ** twice, done = r.expl || {};
    const pick = /target creature you control explores/i.test(r.text || "");
    const rows = (pick ? ids.filter(id => !done[id] || done[id] < per).slice(0, 999) : ids).map(id => `<div class="row mini">🧭 ${esc(dispName(me.bf[id]))}${per > 1 ? ` (${done[id] || 0}/${per})` : ""}: ${(done[id] || 0) >= per ? "explored" : `<button class="btn small" data-a="xpl-go" data-id="${r.id}" data-c="${id}" data-v="land">Land → hand</button><button class="btn small" data-a="xpl-go" data-id="${r.id}" data-c="${id}" data-v="non">Nonland → +1/+1</button>`}</div>`);
    return rows.length ? `<div class="mini">Explore: reveal the top card. A land goes to your hand; otherwise a +1/+1 counter, and you may put the card into your graveyard.${per > 1 ? ` Topography Tracker: explores ${per}× each.` : ""}</div>${rows.join("")}` : "";
  }
  // "if another Human entered the battlefield under your control this turn" (Éowyn)
  function enteredNote(r) {
    const m = String(r.text || "").match(/if (another )?(?:an? )?([A-Z]?[a-z]+) entered the battlefield under your control this turn/i); if (!m) return "";
    const t = room?.turnNo || 0, ty = m[2].toLowerCase() === "creature" ? "Creature" : m[2][0].toUpperCase() + m[2].slice(1);
    const hit = Object.entries(me.bf || {}).filter(([id, e]) => e.et === t && (!m[1] || id !== r.srcId) && new RegExp(`\\b${ty}\\b`).test(e.t || ""));
    return `<div class="mini">${hit.length ? `✓ ${esc(hit.map(([, e]) => dispName(e)).join(", "))} entered this turn` : `✗ No ${esc(ty)} entered under your control this turn (per the app) — skip it`}</div>`;
  }
  function sephNote(r) {
    if (!/if this is the fourth time this ability has resolved this turn/i.test(r.text || "")) return "";
    if (r.sephN == null) { const k = `${r.src}|${room?.turnNo || 0}`; sephN[k] = (sephN[k] || 0) + 1; r.sephN = sephN[k]; }
    return `<div class="mini">${r.sephN >= 4 && r.sephN % 4 === 0 ? "🔄 This is the fourth time this turn — transform Sephiroth." : `Resolution #${r.sephN} this turn (transforms on the 4th).`}</div>`;
  }
  // Nonland cards were milled (The Wise Mothman, Mirelurk Queen, Screeching Scorchbeast, Glowing One…)
  const nlOnce = {};
  function nonlandMilled(n, who) {
    if (!n) return;
    const t = room?.turnNo || 0;
    Object.entries(me.bf || {}).forEach(([id, e]) => {
      const o = String(e.o || lookupCard(e.n)?.o || "");
      const m = o.match(/whenever (?:one or more nonland cards are milled|a player mills a nonland card|an opponent mills a nonland card), ([^\n]+)/i); if (!m) return;
      if (/an opponent mills/i.test(m[0]) && who === pid) return;
      if (/only once each turn|do this only once each turn/i.test(m[1]) || /this ability triggers only once each turn/i.test(o)) { if (nlOnce[id] === t) return; nlOnce[id] = t; }
      let txt = m[1].replace(/\bwhere x is the number of nonland cards milled this way\b/i, `X = ${n}`).replace(/\bthat many\b/gi, String(n));
      if (/^you gain 1 life\.?$/i.test(txt)) { act([{ type: "effects", effs: [{ k: "gain", n }], times: 1, count: 1, src: dispName(e) }]); return; }
      reminders.push(normalizeRem({ id: newId(), src: dispName(e), srcId: id, text: `${n} nonland card${n === 1 ? " was" : "s were"} milled: ${txt.replace(/^\w/, c => c.toUpperCase())}`, times: 1, ...(/^draw a card/i.test(txt) ? { drawN: 1 } : {}) }));
    });
    if (who === pid) seated(room).filter(o => o.id !== pid && !isOut(o)).forEach(o => { if (Object.values(o.bf || {}).some(x => /nonland cards? (?:are|is) milled|mills a nonland card/i.test(x.o || lookupCard(x.n)?.o || ""))) sendOrders({ [o.id]: {} }, { how: "nlMill", n, who: pid }); });
    setTimeout(render, 0);
  }
  // ----- Dice (Mr. House, Wyll, Barbarian Class, d20 tables…) -----
  const DWORD = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7 }, SIDES = { four: 4, six: 6, eight: 8, ten: 10, twelve: 12, twenty: 20 };
  function diceSpec(text) {
    const t = String(text || "");
    const m = t.match(/\b(each player )?rolls? (a|an|one|two|three|four|five|six|seven|x|\d+|that many) (?:(d(\d+))|(four|six|eight|ten|twelve|twenty)-sided di(?:c?e))\b/i);
    if (!m) return null;
    const w = m[2].toLowerCase(), n = DWORD[w] ?? (/^\d+$/.test(w) ? Number(w) : null);
    return { n: /plus an additional six-sided die for each/i.test(t) ? null : n, sides: m[4] ? Number(m[4]) : SIDES[m[5].toLowerCase()], each: !!m[1], minus: /and subtract the number of cards in your hand/i.test(t) };
  }
  const advDice = () => Object.values(me.bf || {}).filter(x => /if you would roll one or more dice, instead roll that many dice plus one and ignore the lowest roll/i.test(x.o || lookupCard(x.n)?.o || "")).length;
  function diceTable(r) {
    const c = (r.srcId && me.bf?.[r.srcId]) || lookupCard(String(r.src || "").replace(/ \(.*\)$/, "").replace(/^.*'s /, "")) || null;
    const o = String(c?.o || lookupCard(c?.n)?.o || "");
    const rows = [];
    o.split("\n").forEach(l => { let m = l.match(/^(\d+)(?:\s*[—–-]\s*(\d+))?\s*\|\s*(.+)$/); if (m) return rows.push({ lo: Number(m[1]), hi: Number(m[2] || m[1]), text: m[3] });
      m = l.match(/^(\d+)(?: or (\d+))? — (.+)$/); if (m) rows.push({ lo: Number(m[1]), hi: Number(m[2] || m[1]), text: m[3] }); });
    return rows;
  }
  function diceBar(r) {
    const k = diceSpec(r.text); if (!k) return "";
    const adv = advDice();
    if (r.dice) {
      const d = r.dice, tot = d.kept.reduce((a, b) => a + b, 0), adj = k.minus ? tot - (Number(d.hand) || 0) : tot;
      const ev = d.kept.filter(v => v % 2 === 0).length, od = d.kept.length - ev, diff = new Set(d.kept).size;
      const row = d.kept.length === 1 && diceTable(r).find(x => adj >= x.lo && adj <= x.hi);
      return `<div class="row mini">🎲 Rolled ${d.kept.join(", ")}${d.dropped.length ? ` (dropped ${d.dropped.join(", ")})` : ""}${d.kept.length > 1 ? ` · total ${tot} · ${ev} even, ${od} odd, ${diff} different` : ""}${k.minus ? ` · minus hand → ${adj}` : ""}${d.each ? ` · ${esc(d.each)}` : ""}</div>${row ? `<div class="row mini">→ <b>${esc(row.text)}</b> <button class="btn small primary" data-a="dice-do" data-id="${r.id}">Do it</button></div>` : ""}${d.auto ? `<div class="mini">${esc(d.auto)}</div>` : ""}`;
    }
    return `<div class="row mini">🎲 Roll <input type="number" min="1" id="dn-${r.id}" style="width:3.5em" value="${k.n ?? 1}"> d${k.sides}${adv ? ` (+${adv}, drop the lowest)` : ""}${k.minus ? ` · cards in hand <input type="number" min="0" id="dh-${r.id}" style="width:3.5em" value="0">` : ""}
      <button class="btn small primary" data-a="dice-go" data-id="${r.id}" data-v="r">🎲 Roll for me</button> or results <input type="text" id="dv-${r.id}" style="width:6em" placeholder="e.g. 4,6"><button class="btn small" data-a="dice-go" data-id="${r.id}" data-v="m">Use</button></div>`;
  }
  // Fire "whenever you roll…" triggers; returns a summary line
  function diceRolled(kept, src, visit) {
    const notes = [];
    const rfx = t => { const sp = spellAbility({ n: `dice · ${t}`, t: "Instant", o: t }); return sp.auto ? sp.effs : sp.effs.filter(f => ["countersTarget", "remove", "regrow", "ping", "tlose", "fetch", "pumpTarget"].includes(f.k)); };
    Object.entries(me.bf || {}).forEach(([id, x]) => { // Dee Kay / Night Shift: "Whenever you roll a 6, …"
      const o = String(x.o || lookupCard(x.n)?.o || "");
      for (const m of o.matchAll(/^whenever you roll (?:a|an) (\d+), ([^\n]+)/gim)) { const hits = kept.filter(v => v === Number(m[1])).length;
        if (hits) reminders.push(normalizeRem({ id: newId(), src: dispName(x), srcId: id, text: `You rolled a ${m[1]}: ${m[2].replace(/^\w/, c => c.toUpperCase())}`, times: hits, effs: rfx(m[2]) })); }
      const vm = visit && o.match(/^whenever you roll to visit your attractions, ([^\n]+)/im);
      if (vm) { const ifr = vm[1].match(/^if you roll (?:a|an) (\d+), (.+)$/i); if (!ifr || kept.includes(Number(ifr[1]))) reminders.push(normalizeRem({ id: newId(), src: dispName(x), srcId: id, text: (ifr ? ifr[2] : vm[1]).replace(/^\w/, c => c.toUpperCase()), times: 1 })); }
    });
    if (visit) Object.values(me.gy || {}).forEach(g => { const o = String(g.o || lookupCard(g.n)?.o || ""); const m = o.match(/whenever you roll to visit your attractions, if you roll (?:a|an) (\d+), you may return this card from your graveyard to the battlefield/i);
      if (m && kept.includes(Number(m[1]))) reminders.push({ id: newId(), src: `${g.n} (graveyard)`, text: `You rolled a ${m[1]} to visit: you may return ${g.n} from your graveyard to the battlefield.`, times: 1 }); });
    Object.entries(me.bf || {}).forEach(([id, x]) => {
      const o = String(x.o || lookupCard(x.n)?.o || "");
      const hi = o.match(/whenever you roll a (\d+) or higher, create a 3\/3 colorless Robot artifact creature token\. if you rolled (\d+) or higher, instead create that token and a Treasure token/i);
      if (hi) { const n4 = kept.filter(v => v >= Number(hi[1])).length, n6 = kept.filter(v => v >= Number(hi[2])).length; if (n4) { act([{ type: "create", name: "Robot", n: n4, desc: "3/3 colorless Robot artifact creature", src: dispName(x) }, ...(n6 ? [{ type: "create", name: "Treasure", n: n6, desc: "Treasure", src: dispName(x) }] : [])]); notes.push(`${dispName(x)}: ${n4} Robot${n4 === 1 ? "" : "s"}${n6 ? ` + ${n6} Treasure` : ""}`); } return; }
      const any = o.match(/whenever you roll one or more dice, ([^\n]+)/i); if (!any) return;
      const t = any[1];
      if (/^put a number of charge counters on this artifact equal to the result/i.test(t)) { const v = kept.reduce((a, b) => a + b, 0); mutate(p => { const y = p.bf?.[id]; if (y) { y.c ||= {}; y.c.charge = (y.c.charge || 0) + v; } }); notes.push(`${dispName(x)}: +${v} charge`); }
      else if (/^put a \+1\/\+1 counter on (?:this creature|[^.]+?)\.?$/i.test(t)) { mutate(p => { const y = p.bf?.[id]; if (y) { y.c ||= {}; y.c.p1p1 = (y.c.p1p1 || 0) + 1; } }); notes.push(`${dispName(x)}: +1/+1 counter`); }
      else reminders.push(normalizeRem({ id: newId(), src: dispName(x), srcId: id, text: `You rolled: ${t.replace(/^\w/, c => c.toUpperCase())}`, times: 1, effs: rfx(t) }));
    });
    if (notes.length) logTo(code, `🎲 ${notes.join("; ")}`);
    return notes.join("; ");
  }
  function rollDice(n, sides) {
    const adv = advDice(), all = Array.from({ length: n + adv }, () => 1 + Math.floor(Math.random() * sides));
    const sorted = [...all].sort((a, b) => a - b), dropped = sorted.slice(0, adv);
    const kept = [...all]; dropped.forEach(v => kept.splice(kept.indexOf(v), 1));
    return { kept, dropped };
  }
  function coinResult(win, src) {
    Object.entries(me.bf || {}).forEach(([id, e]) => {
      const o = String(e.o || lookupCard(e.n)?.o || "");
      const m = win ? o.match(/whenever (?:you win|a player wins) a coin flip, ([^\n]+)/i) : o.match(/whenever you lose a coin flip, ([^\n]+)/i);
      if (!m) return;
      const t = m[1];
      if (/^double [^.]*?power and toughness until end of turn/i.test(t)) {
        const [pw, tg] = ptOf(me.bf[id], countsFor(me), pid, id).split("/").map(x => Number(x) || 0);
        act([{ type: "effects", effs: [{ k: "pumpOn", target: { kind: "bf", id }, dp: pw, dt: tg, kws: [] }], times: 1, count: 1, src: dispName(e) }]);
      } else if (/^draw a card\.?$/i.test(t)) broadcastDraw(1, `${dispName(e)} (won a flip)`);
      else if (/^put a (\w+) counter on (?:this \w+|it)\.?$/i.test(t)) { const k = t.match(/^put a (\w+) counter/i)[1].toLowerCase(); mutate(p => { const x = p.bf?.[id]; if (x) { x.c ||= {}; x.c[k] = (x.c[k] || 0) + 1; } }); logTo(code, `🍀 ${dispName(e)}: +1 ${k} counter (${me.bf?.[id]?.c?.[k] || 1})`); }
      else if (/^create two treasure tokens/i.test(t)) act([{ type: "create", name: "Treasure", n: 2, desc: "Treasure", src: dispName(e) }]);
      else reminders.push(normalizeRem({ id: newId(), src: dispName(e), srcId: id, text: `${win ? "You won a coin flip" : "You lost a coin flip"}: ${t.replace(/^\w/, c => c.toUpperCase())}`, times: 1 }));
    });
    if (win) seated(room).filter(o => o.id !== pid && !isOut(o)).forEach(o => Object.values(o.bf || {}).forEach(x => { const m = String(x.o || lookupCard(x.n)?.o || "").match(/whenever a player wins a coin flip, ([^\n]+)/i); if (m) sendNote(o.id, { text: `${me.name} won a coin flip (${src}): ${m[1]}`, src: dispName(x) }); }));
  }
  function finishSearch(r) {
    // Wan Shi Tong, Ob Nixilis Unshackled…: "Whenever an opponent searches their library, …"
    seated(room || {}).filter(o => o.id !== pid && !isOut(o)).forEach(o => Object.values(o.bf || {}).forEach(x => { const m = String(x.o || lookupCard(x.n)?.o || "").match(/whenever an opponent searches their library, ([^\n]+)/i); if (!m) return;
      sendNote(o.id, { text: `${me.name} searched their library (${r.src}): ${m[1].replace(/^\w/, c => c.toUpperCase())}`, src: dispName(x) });
      if (/\bthat player\b/i.test(m[1])) reminders.push({ id: newId(), src: `${o.name}'s ${dispName(x)}`, text: `You searched your library: ${m[1].replace(/^[^.]*?that player /i, "you ").replace(/\byou (sacrifices|loses|discards)\b/gi, (y, v) => `you ${v.slice(0, -1)}`)}`, times: 1 });
      logTo(code, `🔎 ${o.name}'s ${dispName(x)}: ${me.name} searched their library`); }));
    if (dig?.on) { const m = String((lookupCard(r.src) || deckCard(r.src))?.o || "").match(/(?:,\s*|\bthen )discard (a|one|two|three) cards?( at random)?/i); // Gamble: the discard comes after the search
      if (m) reminders.push({ id: newId(), src: r.src, text: `Discard ${m[1]} card${/^(a|one)$/i.test(m[1]) ? "" : "s"}${m[2] || ""}.`, times: 1 }); }
    if (r.fetch?.shuffle && dig?.on && !r.digShuffled) { const top = r.fetch.dest === "top" ? dig.lib.splice(0, (r.picked || []).length) : []; digShuffle(dig.lib); dig.lib.unshift(...top); digSave(); r.digShuffled = true; }
    if (r.fetch?.shuffle && !r.digShuffled) reminders.push({ id: newId(), src: r.src, text: "🔀 Shuffle your library.", times: 1 });
    if (r.fetch?.other && r.left <= 0) reminders.push({ id: newId(), src: r.src, text: "Put the other card you found into your hand.", times: 1 });
  }

  // Activate an ability: pay the costs the app can track, then resolve what it understands
  function activate(id, i, opts = {}) {
    const e = me.bf?.[id];
    const card = e && abCard(e);
    const ab = card && activatedAbilities(card)[i];
    if (!ab) return;
    const c = ab.costs, name = dispName(e);
    if (/activate only as a sorcery/i.test(ab.text || "") || new RegExp(`${ab.text.slice(0, 30).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[^\n]*activate only as a sorcery`, "i").test(card.o || "")) {
      const tracked = room.step?.turnNo === (room.turnNo || 0), st = STEPS[stepOf(room)];
      const bad = room.turn && room.turn !== pid ? "it isn't your turn" : tracked && !/^Main/.test(st) ? `it's your ${st} step, not a main phase` : "";
      if (bad && !confirm(`${name}: activate only as a sorcery (your main phase, nothing on the stack), and ${bad}.\n\nUse it anyway?`)) return;
    }
    const why = actBlocked(e);
    if (why && !confirm(`${name} can't use that ability:\n${why}\n\nUse it anyway?`)) return;
    if (/put this (?:artifact|creature|permanent) on top of its owner's library/i.test(ab.text || "")) setTimeout(() => { if (!me.bf?.[id]) return; act([], p => { detachIn(p, id); delete p.bf[id]; }); logTo(code, `${me.name}: ${name} → top of library`); }, 50);
    if (/reveal cards from the top of your library until you reveal a basic land card\. put that card into your hand and all other cards revealed this way into your graveyard/i.test(ab.text || "")) {
      const v = prompt(`${name}: how many cards went to your graveyard?`, "5");
      const k = Math.max(0, Math.floor(Number(v) || 0));
      if (k) setTimeout(() => sendNote(pid, { kind: "millLog", n: k, src: name, text: "" }), 60);
    }
    if (/put a charge counter on this artifact\. note the type of mana spent to pay this activation cost/i.test(ab.text || "")) reminders.push({ id: newId(), src: name, text: "Which mana did you spend?", times: 1, amulet: { id } });
    if (/add one mana of (?:this artifact's|its) last noted type/i.test(ab.text || "") && e.noted) setTimeout(() => { poolAdd(`{${e.noted}}`, name); reminders = reminders.filter(x => !(x.src === name && /last noted type/i.test(x.text || ""))); logTo(code, `${me.name}'s ${name}: added {${e.noted}}`); render(); }, 60);
    if (/draw a card at the beginning of the next turn's upkeep/i.test(ab.text || "")) mutate(p => { p.delayDraw = [...(p.delayDraw || []), { turnNo: room.turnNo || 0, src: name }]; });
    if (ab.powerMana) { const x = Math.max(0, Number(String(ptOf({ ...e, o: e.o || lookupCard(e.n)?.o }, countsFor(me), pid, id) || "0").split("/")[0]) || 0), cols = ab.powerMana.cols;
      setTimeout(() => { reminders = reminders.filter(r => !(r.src === name && !r.pmana && /where X is [^.]*power/i.test(r.text || ""))); reminders.push({ id: newId(), src: name, text: `Add ${x} mana in any combination of ${cols.map(c => `{${c}}`).join(" and/or ")} (${name}'s power is ${x}).`, times: 1, pmana: { x, cols } }); render(); }, 60); }
    if (/^add X mana in any combination of colors, where X is the greatest power among creatures you control/i.test(ab.text || "")) { const x = maxPowerNow(); setTimeout(() => { reminders = reminders.filter(r => !(r.src === name && /greatest power among creatures/i.test(r.text || ""))); reminders.push({ id: newId(), src: name, text: `Add ${x} mana in any combination of colors.`, times: 1, selvala: { x } }); render(); }, 60); }
    if (/^for each color among permanents you control, add one mana of that color/i.test(ab.text || "")) {
      const W = { white: "W", blue: "U", black: "B", red: "R", green: "G" };
      const cols = new Set([...Object.values(me.bf || {}).flatMap(x => /\bLand\b/.test(x.t || "") ? [] : colorsOf(x.m)), ...Object.values(me.tokens || {}).flatMap(t => Object.entries(W).filter(([w]) => new RegExp(`\\b${w}\\b`, "i").test(`${t.desc || ""} ${t.name}`)).map(([, l]) => l))]);
      const syms = "WUBRG".split("").filter(l => cols.has(l)).map(l => `{${l}}`.repeat(manaMult())).join("");
      setTimeout(() => { reminders = reminders.filter(x => !(x.src === name && /for each color among permanents/i.test(x.text || ""))); if (syms) poolAdd(syms, name); logTo(code, `${me.name}'s ${name}: ${syms || "no colored permanents → nothing"}`); render(); }, 60);
    }
    if (/creatures your opponents control lose hexproof and shroud/i.test(ab.text || "")) { update(ref(db, `rooms/${code}`), { lighthouse: { turnNo: room.turnNo || 0, by: pid } }); logTo(code, `🔦 ${me.name}'s ${name}: opponents' creatures lose hexproof and shroud this turn`); }
    const exh = new RegExp(`^Exhaust — ${String(ab.cost || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}:`, "m").test(card.o || "");
    if (exh && e.exh?.[i] && !opts.sacNDone && !opts.tapNDone) { if (!confirm(`${name}: you already used that exhaust ability (once per game).\n\nUse it anyway?`)) return; }
    if (exh && !opts.sacNDone && !opts.tapNDone) mutate(p => { const x = p.bf?.[id]; if (x) { x.exh ||= {}; x.exh[i] = true; } }, true);
    if (c.sacN && !opts.sacNDone) { reminders.push(normalizeRem({ id: newId(), src: name, srcId: id, text: "", times: 1, sacNPick: { ...c.sacN, id, i } })); render(); return; }
    if (/exile the top card of your library face down/i.test(ab.text) && c.life) {
      const k = Math.floor(Number(prompt(`${name}: how many times? (${c.life} life each)`, "1")) || 0);
      if (k <= 0) return;
      const handAt = /into your hand at the beginning of your next end step/i.test(ab.text);
      act([], p => {
        p.life = (p.life ?? START_LIFE) - k * c.life;
        p.ex ||= {};
        for (let i = 0; i < k; i++) p.ex[newId()] = { n: "Face-down card", t: "", m: "", img: "", fd: true, src: name, ...(handAt ? { toHand: "end" } : {}), at: Date.now() };
      });
      logTo(code, `${me.name} paid ${k * c.life} life: ${name} exiled ${k} card${k === 1 ? "" : "s"} face down${handAt ? " (to hand at their end step)" : ""}`);
      return;
    }
    const lvUp = String(ab.text || "").match(/^Level (\d+)$/);
    if (lvUp) { // Class: gain the next level (as a sorcery)
      const n = Number(lvUp[1]), cur = e.lvl || 1;
      if (n !== cur + 1) { toast(n <= cur ? `${name} is already level ${cur}.` : `Level ${cur + 1} comes first.`); return; }
      mutate(p => { if (p.bf[id]) p.bf[id].lvl = n; });
      logTo(code, `📈 ${me.name}'s ${name} reached level ${n}`);
      { const lt = String(card.o || "").match(new RegExp(`^When this Class becomes level ${n}, ([^\n]+)$`, "m")); // Wizard Class: "When this Class becomes level 2, draw two cards."
        if (lt) { const dn = lt[1].match(/^draw (a|one|two|three|four) cards?\.?$/i); reminders.push(normalizeRem({ id: newId(), src: name, srcId: id, text: lt[1][0].toUpperCase() + lt[1].slice(1), times: 1, ...(dn ? { drawN: ({ a: 1, one: 1, two: 2, three: 3, four: 4 })[dn[1].toLowerCase()] } : {}) })); } }
      render(); return;
    }
    if (ab.manaPer) {
      const mp = ab.manaPer;
      if (c.tap && e.tap) { toast(`${name} is already tapped.`); return; }
      const mcost = (String(ab.cost || "").match(/\{(?!T\})[^}]+\}/g) || []).join("");
      if (mcost) payPool(mcost, name);
      if (mp.devotion) {
        const dv = devotion(me);
        act([], p => { if (c.tap && p.bf[id]) p.bf[id].tap = true; });
        reminders.push({ id: newId(), src: name, text: "Choose a color: add mana equal to your devotion to it.", times: 1, devo: dv });
        render(); return;
      }
      const n = countTypes(me, mp.types);
      act([], p => { if (c.tap && p.bf[id]) p.bf[id].tap = true; });
      if (n) poolAdd(mp.syms.repeat(n), `${name}: ${n} ${mp.what}`);
      logTo(code, `${me.name} tapped ${name} for ${mp.syms} × ${n}`);
      render(); return;
    }
    if (/copy (the exiled card|a card exiled with)/i.test(ab.text)) reminders.push({ id: newId(), src: name, srcId: id, text: ab.text, times: 1, copyFrom: id });
    if (/exiled card an opponent owns with a void counter/i.test(ab.text)) reminders.push({ id: newId(), src: name, text: "Choose an exiled card an opponent owns with a void counter. You may play it this turn without paying its mana cost.", times: 1, voidPick: true });
    if (/discard your hand/i.test(ab.cost)) reminders.push({ id: newId(), src: name, text: "Log the cards you discarded (so your graveyard is right).", times: 1, impulse: { n: 30, cards: [], toGy: true } });
    if (c.tap && e.tap) { toast(`${name} is already tapped.`); return; }
    if (/tap x untapped tokens you control/i.test(ab.cost || "")) {
      act(c.tap && !e.tap ? [{ type: "tapped", id }] : [], p => { if (c.tap) p.bf[id].tap = true; if (c.life) p.life = (p.life ?? START_LIFE) - c.life; });
      logTo(code, `${me.name} activated ${name}${c.life ? ` (paid ${c.life} life)` : ""}: tap X tokens for X mana`);
      reminders.push({ id: newId(), src: name, text: "Tap X untapped tokens: add X mana in any combination of colors.", times: 1, tapTokX: true });
      render(); return;
    }
    const wbc = String(ab.cost || "").match(/waterbend \{(\d+)\}/i);
    if (wbc) reminders.push({ id: newId(), src: name, text: "", times: 1, wbend: { n: Number(wbc[1]) } });
    if (/activate only if you created a token this turn/i.test(ab.text || "") && me.madeTok !== (room.turnNo || 0) && !confirm(`${name}: activate only if you created a token this turn, and the app hasn't seen you create one.\n\nUse it anyway?`)) return;
    const tapN = String(ab.cost || "").match(/tap (two|three|four|five) untapped ([a-z ]+?)s you control/i);
    if (tapN && !opts.tapNDone) { reminders.push({ id: newId(), src: name, srcId: id, text: `Tap ${tapN[1]} untapped ${tapN[2]}s you control (cost).`, times: 1, tapNPick: { n: ({ two: 2, three: 3, four: 4, five: 5 })[tapN[1].toLowerCase()], what: tapN[2].toLowerCase(), id, i } }); render(); return; }
    const tapOther = String(ab.cost || "").match(/tap an untapped ([a-z ]+?) you control/i);
    if (tapOther) {
      const want = tapOther[1].toLowerCase(), cand = Object.entries(me.bf || {}).filter(([x, y]) => x !== id && !y.tap && new RegExp(`\\b${want}\\b`, "i").test(y.t || "") && !(want === "creature" && isSick({ ...y, o: y.o || lookupCard(y.n)?.o }, meOwner(), x) && false));
      const tk = Object.entries(me.tokens || {}).find(([, t]) => t.count - (t.tapped || 0) > 0 && (want !== "creature" || isCreatureToken(t.name)));
      if (!cand.length && !tk) { toast(`No untapped ${want} to tap.`); return; }
      const pick = !tk && cand.length ? cand[0] : null; // tokens first (cheapest to tap)
      if (pick) act(pick[1].tap ? [] : [{ type: "tapped", id: pick[0] }], p => { if (p.bf[pick[0]]) p.bf[pick[0]].tap = true; });
      else mutate(p => { const t = p.tokens?.[tk[0]]; if (t) t.tapped = Math.min(t.count, (t.tapped || 0) + 1); });
      logTo(code, `${me.name} tapped ${pick ? dispName(pick[1]) : `a ${tk[1].name} token`} for ${name}'s cost`);
    }
    if (c.tap && isSick({ ...e, o: e.o || card.o }, meOwner(), id) && !elixirOn() && !confirm(`${name} is summoning sick, so it can't use {T} abilities yet.\n\nUse it anyway?`)) return;
    if (c.loyalty != null && (e.c?.loyalty || 0) + c.loyalty < 0) { toast("Not enough loyalty."); return; }
    if (c.loyalty != null) { const used = e.loyT?.turn === (room.turnNo || 0) ? e.loyT.n : 0, max = Object.values(me.bf || {}).some(x => /you may activate the loyalty abilities of planeswalkers you control twice each turn/i.test(x.o || lookupCard(x.n)?.o || "")) ? 2 : 1;
      if (used >= max && !confirm(`${name} has already used ${used === 1 ? "a loyalty ability" : `${used} loyalty abilities`} this turn.\n\nUse another anyway?`)) return;
      mutate(p => { const x = p.bf?.[id]; if (x) x.loyT = { turn: room.turnNo || 0, n: used + 1 }; }); }
    const among = String(ab.cost || "").match(/remove (a|an|one|two|three|\d+) ([a-z+/1-]+) counters? from among ([a-z ]+?) you control/i);
    if (among) {
      const key = c.remove?.key || "p1p1", n = c.remove?.n || 1, what = among[3];
      const have = Object.values(me.bf || {}).filter(x => permMatch(x, parseTargetFilter(what))).reduce((a, x) => a + (x.c?.[key] || 0), 0);
      if (have < n) { toast(`Not enough counters among your ${what}.`); return; }
      reminders.push({ id: newId(), src: name, text: "", times: 1, rmAmong: { n, key, what } });
      c.remove = null;
    }
    if (c.remove && (e.c?.[c.remove.key] || 0) < c.remove.n) { toast("Not enough counters."); return; }
    let anyX = null;
    if (c.removeAny) { const have = e.c?.[c.removeAny.key] || 0; anyX = Math.max(0, Math.min(have, Math.floor(Number(prompt(`${name}: remove how many ${c.removeAny.label} counters? (you have ${have})`, String(have))) || 0))); }
    if (c.forage && !opts.foraged) { reminders.push({ id: newId(), src: name, text: "Forage (cost): exile three cards from your graveyard or sacrifice a Food.", times: 1, forage: { id, i } }); render(); return; }
    let tokKey = null, sacCard = null, sacMany = null, xVal = null;
    const sx = String(ab.cost || "").match(/sacrifice x ([a-z]+?)s?(?:,|$)/i);
    if (sx) {
      const want = sx[1].toLowerCase(), stacks = Object.entries(me.tokens || {}).filter(([, t]) => t.name.toLowerCase() === want && t.count > 0);
      const have = stacks.reduce((a, [, t]) => a + t.count, 0);
      const x = Math.floor(Number(prompt(`${name}: sacrifice how many ${sx[1]}s? (X — you have ${have} ${sx[1]} tokens)`, String(have))) || 0);
      if (x <= 0) return;
      if (x > have) { toast(`You only have ${have} ${sx[1]} tokens (sacrifice creature cards by hand).`); return; }
      let left = x; sacMany = stacks.map(([k, t]) => { const n = Math.min(left, t.count); left -= n; return [k, n, t.name]; }).filter(([, n]) => n);
      xVal = x; c.sacOther = false;
    }
    if (c.sacMany && !sacMany) {
      const want = c.sacMany.what.toLowerCase(), stacks = Object.entries(me.tokens || {}).filter(([, t]) => t.name.toLowerCase() === want && t.count > 0);
      const have = stacks.reduce((a, [, t]) => a + t.count, 0);
      if (have < c.sacMany.n) { toast(`You need ${c.sacMany.n} ${c.sacMany.what}s to sacrifice (you have ${have}).`); return; }
      let left = c.sacMany.n; sacMany = stacks.map(([k, t]) => { const n = Math.min(left, t.count); left -= n; return [k, n, t.name]; }).filter(([, n]) => n);
      c.sacOther = false;
    }
    if (c.sacWhat && !c.sacMany) {
      const want = singular(c.sacWhat).toLowerCase();
      if (opts.sac?.startsWith("tok:")) tokKey = opts.sac.slice(4);
      else if (opts.sac?.startsWith("bf:")) sacCard = opts.sac.slice(3);
      else {
        tokKey = Object.keys(me.tokens || {}).find(k => me.tokens[k].name.toLowerCase() === want && me.tokens[k].count > 0) || null;
        const choices = sacChoices(want);
        // Ashnod's Altar & co: when there's a real choice, ask what to sacrifice
        if ((!tokKey || choices.length > 1) && choices.length) { reminders.push({ id: newId(), src: name, text: `Sacrifice ${/^[aeiou]/i.test(want) ? "an" : "a"} ${want} (cost): which one?`, times: 1, sacCost: { id, i, what: want } }); render(); return; }
        if (!tokKey) { toast(`No ${c.sacWhat} to sacrifice.`); return; }
      }
    }
    const events = [];
    const isCre = /\bCreature\b/.test(e.t || ""), isArt = /\bArtifact\b/.test(e.t || "");
    if (c.sacSelf) {
      events.push({ type: "sac", name: e.n, n: 1, token: false, creature: isCre, artifact: isArt });
      if (isCre) events.push({ type: "dies", n: 1, token: false, ids: [id] });
    }
    (sacMany || []).forEach(([, n, tn]) => { const cre = isCreatureToken(tn); events.push({ type: "sac", name: tn, n, token: true, creature: cre }); if (cre) events.push({ type: "dies", n, token: true }); });
    if (sacMany) logTo(code, `🗡 ${me.name} sacrificed ${sacMany.reduce((a, [, n]) => a + n, 0)} ${sacMany[0][2]}s (${name})`);
    if (tokKey && me.tokens?.[tokKey]) {
      const tn = me.tokens[tokKey].name, cre = isCreatureToken(tn);
      events.push({ type: "sac", name: tn, n: 1, token: true, creature: cre });
      if (cre) events.push({ type: "dies", n: 1, token: true });
    }
    const sc = sacCard && me.bf?.[sacCard];
    if (sc) {
      const cre = /\bCreature\b/.test(sc.t || "");
      events.push({ type: "sac", name: sc.n, n: 1, token: false, creature: cre, artifact: /\bArtifact\b/.test(sc.t || "") });
      if (cre) events.push({ type: "dies", n: 1, token: false, ids: [sacCard] });
    }
    if (/\{X\}/.test(ab.cost || "") && xVal == null) { xVal = Math.max(0, Math.floor(Number(prompt(`${name}: X = ?`, "1")) || 0)); }
    let effs = ab.auto ? ab.effs : ab.effs.filter(f => ["fetch", "remove", "adnaus", "setlife", "edict", "imprint", "regrow", "impulse", "handmana", "gyhate", "countersTarget", "countersEach", "tokCopy", "tplayerTok", "untapAll", "untapN", "ping", "pumpTarget", "pumpAll", "controlTurn", "swap", "prolif", "tempt", "oracle", "drawPer", "regen", "copyAllTokens", "tgain", "gyOne", "sacThen", "drawFor", "gainPer", "mill", "copyCreature", "suspect", "manaAny", "dmgTurn", "noPreventTurn", "dmgCr", "wisecrack", "bane", "radiant", "extraCombat", "untapAttacked", "rummage", "dmgAll", "discardN", "copySpell", "dmgPer", "doublePow", "dmgDef", "pcounter", "earthbend", "dieGain", "tokAtkMe", "veil", "plumb", "minusX", "bounceOwn", "drainX", "necroSel", "spoil", "tloseX", "clearCtrs", "drainDevo", "oppLoseThat", "victimize", "prepSelf", "oppsTok", "revealMv", "attachSelf", "untapSelf", "arcum", "addType", "copyNext", "animate", "copyPick", "maze", "eachDraw", "wheelGy", "blink", "copyTrig", "transformSelf", "reenterFace", "exileRetMine"].includes(f.k));
    if (anyX != null) effs = effs.map(f => f.k === "ping" && f.n === "that" ? { ...f, n: anyX } : f);
    if (xVal != null) effs = effs.map(f => f.k === "pumpTarget" ? { ...f, dp: String(f.dp).replace(/x/i, xVal), dt: String(f.dt).replace(/x/i, xVal) } : f);
    const selfX = xVal != null && String(ab.text).match(/and (?:this creature|[A-Z][^,]*?) gets \+X\/\+0 until end of turn/);
    if (selfX && xVal) { mutate(p => { p.eot ||= {}; p.eot[`x${Date.now().toString(36)}`] = { src: name, target: id, dp: xVal, dt: 0, kws: [] }; }); logTo(code, `⚙ ${name} gets +${xVal}/+0 until end of turn`); }
    const dcost = !/they gain control of this artifact/i.test(ab.text) && !/discard (this card|your hand)/i.test(ab.cost) && (ab.cost.match(/discard (two|a|one|three|\d+) cards?/i) || [])[1];
    if (dcost) reminders.push({ id: newId(), src: name, text: "", times: 1, impulse: { n: ({ a: 1, one: 1, two: 2, three: 3 })[dcost.toLowerCase()] || Number(dcost) || 1, cards: [], toGy: true }, note: "Cost: log the card you discarded." });
    // Pumpkin Bombs: discard two, draw three, fuse counter, damage a target opponent who then takes it
    if (/they gain control of this artifact/i.test(ab.text) && /fuse counter/i.test(ab.text)) {
      act([], p => { const t = p.bf[id]; if (c.tap) t.tap = true; t.c ||= {}; t.c.x_fuse = (t.c.x_fuse || 0) + 1; });
      logTo(code, `${me.name} activated ${name}: fuse counter → ${(me.bf[id].c?.x_fuse || 0)}`);
      const dk = (ab.cost.match(/discard (two|a|one|three|\d+) cards?/i) || [])[1];
      if (dk) reminders.push({ id: newId(), src: name, text: "", times: 1, impulse: { n: ({ a: 1, one: 1, two: 2, three: 3 })[dk.toLowerCase()] || Number(dk) || 1, cards: [], toGy: true } });
      const dr = ab.text.match(/draw (two|three|four|\d+) cards/i); if (dr) reminders.push({ id: newId(), src: name, text: `Draw ${dr[1]} cards.`, times: 1 });
      reminders.push({ id: newId(), src: name, srcId: id, text: "Damage a target opponent (one per fuse counter); they gain control of it.", times: 1, bombs: { key: "x_fuse", n: (me.bf[id]?.c?.x_fuse || 0) } });
      render(); return;
    }
    // Three Tree City: mana equal to the creatures you control of the chosen type
    if (/add an amount of mana of that color equal to the number of creatures you control of the chosen type/i.test(ab.text)) {
      const ty = e.ctype, n = ty ? countTypes(me, [ty.toLowerCase()]) : 0;
      act([], p => { if (c.tap && p.bf[id]) p.bf[id].tap = true; });
      logTo(code, `${me.name} activated ${name}: ${n} ${ty || "?"}${n === 1 ? "" : "s"}`);
      reminders.push({ id: newId(), src: name, text: ty ? "Choose a color." : "Choose a creature type for it first (open the card).", times: 1, ...(ty ? { devo: { W: n, U: n, B: n, R: n, G: n }, devoWhy: `${n} ${ty} creature${n === 1 ? "" : "s"}` } : {}) });
      render(); return;
    }
    const le = loseEffect(ab.text);
    if (le) reminders.push({ id: newId(), src: name, text: le === "target" ? "Target player loses the game." : "You lose the game.", times: 1, loseFx: le, effs: le === "target" ? [{ k: "tloseGame" }] : [] });
    if (effs.length) events.push({ type: "effects", effs, times: 1, count: 1, src: name, srcId: id });
    if (c.tap && !e.tap) events.push({ type: "tapped", id });
    { let mc = (String(ab.cost || "").match(/\{(?![TQ]\})[^}]+\}/g) || []).join("");
      const tz = /\bArtifact\b/.test(e.t || "") && me.tezT !== (room.turnNo || 0) && Object.values(me.bf || {}).find(x => /the first activated ability of an artifact you activate each turn costs \{2\} less to activate/i.test(x.o || lookupCard(x.n)?.o || ""));
      if (tz) { mutate(p => { p.tezT = room.turnNo || 0; }, true); const gen = (mc.match(/\{(\d+)\}/g) || []).reduce((a, x) => a + Number(x.replace(/\D/g, "")), 0); mc = mc.replace(/\{\d+\}/g, "") + (gen > 2 ? `{${gen - 2}}` : ""); toast(`${dispName(tz)}: this ability costs {2} less`); }
      if (mc && me.pool && Object.keys(me.pool).length) payPool(mc, name); }
    { const em = String(ab.text || "").match(/^you get an emblem with "(.+)"\.?$/i); if (em) { mutate(p => { p.emblems = [...(p.emblems || []), { text: em[1], src: name }]; }); logTo(code, `🏅 ${me.name} got an emblem (${name}): ${em[1]}`); } }
    logTo(code, `${me.name} activated ${name}: ${ab.label}`);
    const pickerOnly = (!ab.auto && effs.length && effs.every(f => f.k === "maze")) || !ab.auto && effs.length && effs.every(f => ["fetch", "remove", "imprint", "regrow", "impulse", "gyhate", "edict", "countersTarget", "tokCopy", "tplayerTok", "pumpTarget", "regen", "copyCreature", "manaAny", "dmgCr", "wisecrack", "bane", "radiant", "clearCtrs", "tloseX", "oppLoseThat", "drainDevo", "victimize", "revealMv", "arcum", "ping", "addType", "animate", "maze", "copyPick", "blink", "copyTrig", "transformSelf", "reenterFace", "exileRetMine"].includes(f.k)) && !/\b(then|and) (draw|you|each|create|put|gain|lose|deal)/i.test(ab.text);
    if ((!ab.auto || ab.partial) && !le && !pickerOnly && !/exiled card an opponent owns with a void counter|copy (the exiled card|a card exiled with)/i.test(ab.text)) reminders.push({ id: newId(), src: name, text: ab.text, times: 1,
      note: ab.auto ? "Partly applied. Handle the rest yourself." : (c.sacWhat && !tokKey && !sc) || c.sacOther ? "Sacrifice what the cost asks for yourself." : "",
      ...(() => { const dn = !ab.effs?.some(f => /draw/i.test(f.k)) && String(ab.text).match(/\bdraws? (a|one|two|three|four|five) cards?/i); return dn ? { drawN: ({ a: 1, one: 1, two: 2, three: 3, four: 4, five: 5 })[dn[1].toLowerCase()] } : {}; })() }); // loots: a Drew button for the draw part
    act(events, p => {
      const t = p.bf[id];
      if (c.tap) t.tap = true;
      if (c.life) p.life = (p.life ?? START_LIFE) - c.life;
      if (c.loyalty != null) { t.c ||= {}; t.c.loyalty = (t.c.loyalty || 0) + c.loyalty; }
      if (c.remove) { t.c[c.remove.key] -= c.remove.n; if (!t.c[c.remove.key]) delete t.c[c.remove.key]; }
      if (anyX && c.removeAny && t.c?.[c.removeAny.key]) { t.c[c.removeAny.key] -= anyX; if (t.c[c.removeAny.key] <= 0) delete t.c[c.removeAny.key]; }
      if (tokKey && p.tokens?.[tokKey]) { p.tokens[tokKey].count -= 1; if (p.tokens[tokKey].tapped > p.tokens[tokKey].count) p.tokens[tokKey].tapped = p.tokens[tokKey].count; if (!p.tokens[tokKey].count) delete p.tokens[tokKey]; }
      if (sc && p.bf?.[sacCard]) { const x = p.bf[sacCard]; delete p.bf[sacCard]; toZone(p, x, "gy"); }
      (sacMany || []).forEach(([k, n]) => { const x = p.tokens?.[k]; if (!x) return; x.count -= n; if (x.tapped > x.count) x.tapped = x.count; if (x.count <= 0) delete p.tokens[k]; });
    }, p => { // leaves after triggers check, so its own "when this dies" fires
      if (c.sacSelf && p.bf?.[id]) { toZone(p, p.bf[id], "gy"); delete p.bf[id]; }
      if (c.exileSelf && !c.sacSelf && p.bf?.[id]) { toZone(p, p.bf[id], "ex"); delete p.bf[id]; }
    });
    if (c.sacSelf) expanded.delete(id);
  }
  function removeToken(k, how) {
    const t = me.tokens?.[k];
    if (!t) return;
    const creature = isCreatureToken(t.name);
    const events = how === "sac" ? [{ type: "sac", name: t.name, n: 1, token: true, creature }, ...(creature ? [{ type: "dies", n: 1, token: true }] : [])]
      : how === "died" ? [{ type: "dies", n: 1, token: true, name: t.name }] : [];
    if (t.count <= 1) rmOpen = null;
    logDelta(`rm${k}${how}`, 1, x => `${me.name}: ${x} ${t.name} ${how === "sac" ? "sacrificed" : how === "died" ? "died" : "removed"}`);
    act(events, p => {
      const t = p.tokens[k];
      t.count -= 1;
      if (!t.count) delete p.tokens[k];
      else if (t.tapped > t.count) t.tapped = t.count;
    });
  }
  function useToken(k) {
    const t = me.tokens?.[k], use = t && (TOKEN_USES[k] || TOKEN_USES[slugify(t.name)]);
    if (!t || !use) return;
    const why = actBlocked({ t: isCreatureToken(t.name) ? `Token Creature — ${t.name}` : `Token Artifact — ${t.name}`, n: t.name, m: "" });
    if (why && !confirm(`${t.name} tokens can't be used right now:\n${why}\n\nUse one anyway?`)) return;
    logTo(code, `${me.name} used a ${t.name}`);
    if (use.note) reminders.push({ id: newId(), src: t.name, text: use.note, times: 1, ...(/add one mana of any color/i.test(use.note) ? { anyColor: true, anyN: 1 } : {}) });
    act([{ type: "sac", name: t.name, n: 1, token: true, creature: false },
      ...(use.effs ? [{ type: "effects", effs: use.effs, times: 1, count: 1, src: t.name }] : [])], p => {
      p.tokens[k].count -= 1;
      if (!p.tokens[k].count) delete p.tokens[k];
    });
  }

  function permRow(id, e) {
    const pt = ptOf(e.cda ? e : { ...e, cda: lookupCard(e.n)?.o ? abilitiesOf(lookupCard(e.n)).cda : null }, countsFor(me), pid, id);
    const kwList = /\bCreature\b/.test(e.t || "") ? kwsOf({ ...e, o: e.o || lookupCard(e.n)?.o }, pid, id) : [];
    const sickNow = isSick({ ...e, o: e.o || lookupCard(e.n)?.o }, meOwner(), id) && !elixirOn();
    const extra = extraCounters(e);
    const open = expanded.has(id);
    const mana = e.m != null ? e.m : deck?.cards.find(c => c.n === e.n)?.m;
    return `
    <div class="perm ${e.tap ? "tapped" : ""}">
      <div class="perm-row">
        <button class="link who" data-a="view" data-ref="bf:${id}">${e.cmd ? "⭐ " : ""}${esc(dispName(e))}</button>
        ${me.ring?.bearer?.id === id ? `<span class="ring-tag" title="${esc(ringTitle(me))}">💍 Ring-bearer${ringLevel(me) ? " · legendary" : ""}</span>` : ""}
        ${/\bdelirium\b/i.test(e.o || lookupCard(e.n)?.o || "") ? `<span class="cond ${gyTypes() >= 4 ? "on" : "off"}" title="Card types in your graveyard">🪦 Delirium ${gyTypes()}/4</span>` : ""}${e.pair && me.bf?.[e.pair] ? `<span class="att-tag">🔗 ${esc(dispName(me.bf[e.pair]))}</span>` : ""}${e.suspect ? `<span class="att-tag">🕵 suspected · can't block</span>` : ""}${blockingNow(me)[`bf:${id}`] ? `<span class="att-tag">🛡 blocking this combat</span>` : ""}${/is dealt damage, [^,.]+ deals that much damage to target opponent/i.test(e.o || lookupCard(e.n)?.o || "") ? `<button class="btn small" data-a="pair-hurt" data-id="${id}" title="It or its partner was dealt damage">💥 Hurt</button>` : ""}${e.color ? `<span class="att-tag">🎨 ${esc(e.color)}</span>` : ""}${e.ctype ? `<span class="att-tag">🏷 ${esc(e.ctype)}</span>` : ""}${/\bLand\b/.test(e.t || "") ? tableTypeAdds.filter(a => !new RegExp(`\\b${a.add}\\b`).test(e.t)).map(a => `<span class="att-tag" title="${esc(a.src)}">+${esc(a.add)}</span>`).join("") : ""}${(() => { const sg = /\bSaga\b/.test(e.t || "") && sagaChapters({ ...e, o: e.o || lookupCard(e.n)?.o }); return sg ? `<span class="att-tag">📜 ${e.c?.lore || 0}/${sg.last}</span>` : ""; })()}
        ${/\bClass\b/.test(e.t || "") ? `<span class="att-tag">📈 Level ${e.lvl || 1}</span>` : ""}        ${e.att ? `<span class="att-tag">📎 on ${esc(hostName(me, id) || "?")}</span>` : ""}${attachedTo(me, id, false).map(([, a]) => `<span class="att-tag">📎 ${esc(dispName(a))}</span>`).join("")}${me.shields?.[`bf:${id}`] ? `<span class="att-tag">♻ regen</span>` : ""}
        ${e.own ? `<span class="own-tag" style="--oc:${esc(e.own.color || "#888")}">${esc(e.own.name)}'s${e.stolen?.until === "eot" ? " · until end of turn" : ""}</span>` : ""}
        ${manaHtml(mana)}
        ${(() => { const c = lookupCard(e.n) || e; const mp = c?.o ? activatedAbilities(c).find(a => a.manaPer && !a.manaPer.devotion)?.manaPer : null;
          return mp ? `<span class="cost-tag down" title="${esc(mp.what)} you control">⚡ ${manaHtml(mp.syms)}×${countTypes(me, mp.types)}</span>` : ""; })()}
        ${pt ? `<span class="pt">${pt}</span>` : ""}${markedOf(me)?.bf?.[id] ? `<span class="dmg-tag" title="Damage marked this turn">🩸${markedOf(me).bf[id]}</span>` : ""}${kwList.length ? kwHtml(kwList) : ""}${sickNow ? `<span class="sick" title="Summoning sick: entered since your turn began">💤</span>` : ""}
        ${(() => { const c = lookupCard(e.n), wr = c && winRule(c); if (!wr || wr.when === "manual") return "";
          const res = evalWin(wr, me, id); if (res.met === null) return `<span class="cond">🏆 ?</span>`;
          return `<span class="cond ${res.met ? "on" : "off"}" title="${esc(wr.text)}">🏆 ${esc(res.progress)}</span>`; })()}
        ${(() => { const cc = lookupCard(e.n) && activationCondition(lookupCard(e.n)); if (!cc) return "";
          const have = countTypes(me, [cc.type]); const ok = have >= cc.n;
          return `<span class="cond ${ok ? "on" : "off"}" title="Activate only if you control ${cc.n} ${cc.type}${cc.n > 1 ? "s" : ""}">${ok ? "✓" : "✗"} ${have}/${cc.n} ${esc(cc.type)}${cc.n > 1 ? "s" : ""}</span>`; })()}
        ${trackMana && !e.tap && !sickNow ? plainMana(e, id).map(sym => { const [out0, pay] = sym.split("@"); const out = out0.replace(/!\d+$|~\d+|\^h|\+c:\w+/g, ""); return `<button class="btn small mana-tap" data-a="tap-mana" data-id="${id}" data-s="${sym}" title="Tap for mana (into your mana pool)${pay ? `; pays ${pay} from your pool` : ""}">⚡${pay ? `${manaHtml(pay)}→` : ""}${out === "any" ? "any" : manaHtml(out)}${/!\d+$/.test(out0) ? "💥" : ""}${/~(\d+)/.test(out0) ? `❤${out0.match(/~(\d+)/)[1]}` : ""}</button>`; }).join("") : ""}
        <button class="btn small ${e.tap ? "on" : ""} ${sickNow && !e.tap ? "sick-btn" : ""}" data-a="tap" data-id="${id}" ${sickNow && !e.tap ? `data-sick="1" title="Summoning sick"` : ""}>${e.tap ? "Tapped" : sickNow ? "💤 Tap" : "Tap"}</button>
        ${/\bCreature\b/.test(e.t || "") && !e.tap ? `<button class="btn small" data-a="attack" data-id="${id}">⚔ Attack</button>` : ""}
        ${!open && (() => { const c = { ...e, o: e.o || lookupCard(e.n)?.o, t: e.t || lookupCard(e.n)?.t }; return equipCost(c) || enchantType(c); })() ? `<button class="btn small" data-a="expand" data-id="${id}">📎 ${/\bEquipment\b/.test(e.t || "") ? "Equip" : "Attach"}</button>` : ""}
        <button class="btn small" data-a="expand" data-id="${id}" aria-label="More">${!open && lookupCard(e.n)?.o && activatedAbilities(lookupCard(e.n)).length ? "⚡▼" : open ? "▲" : "▼"}</button>
      </div>
      ${extra.length && !open ? `<div class="mini">${esc(extra.join(" · "))}</div>` : ""}
      ${open ? `<div class="perm-more">
        ${Object.entries(e.c || {}).map(([k, n]) => `
          <div class="counter">
            <span class="who">${esc(counterLabel(k))}</span>
            <button class="btn" data-a="pcount" data-id="${id}" data-k="${k}" data-d="-1">−</button>
            <span class="num">${n}</span>
            <button class="btn" data-a="pcount" data-id="${id}" data-k="${k}" data-d="1">+</button>
          </div>`).join("")}
        <div class="chips">
          ${/\bSaga\b/.test(e.t || "") ? `<button class="chip" data-a="pcount" data-id="${id}" data-k="lore" data-d="1">+ Lore (next chapter)</button>` : ""}
          ${COUNTERS.filter(x => !(e.c || {})[x.k]).map(x => `<button class="chip" data-a="pcount" data-id="${id}" data-k="${x.k}" data-d="1">+ ${x.label}</button>`).join("")}
          <button class="chip" data-a="pcount-other" data-id="${id}">+ Other…</button>
        </div>
        ${/\bCreature\b/.test(e.t || "") ? adjHtml("bf", id, e.adj) : ""}
        ${(() => {
          const card = abCard(e);
          const abs = card?.o ? activatedAbilities(card) : [];
          const why = abs.length ? actBlocked(e) : "";
          return abs.length ? `<div class="label">Activate${why ? ` <span class="cost-tag no">⛔ ${esc(why.split(":")[0])}</span>` : ""}</div><div class="abilities">${abs.map((ab, i) =>
            `<button class="btn small ability ${why ? "blocked" : ""}" data-a="activate" data-id="${id}" data-i="${i}" ${sickNow && ab.costs?.tap ? `disabled title="Summoning sick: {T} abilities can't be used until your next turn"` : ""}>${sickNow && ab.costs?.tap ? "💤 " : ""}${ab.powerMana ? `${abCostHtml(ab.cost)}<span class="ab-sep">:</span> add ${Math.max(0, Number(String(ptOf({ ...e, o: e.o || lookupCard(e.n)?.o }, countsFor(me), pid, id) || "0").split("/")[0]) || 0)} mana (${ab.powerMana.cols.map(c => manaHtml(`{${c}}`)).join(" / ")}) <span class="mini">= its power</span>` : ab.manaPer && !ab.manaPer.devotion ? `${ab.costs.tap ? "Tap: " : ""}add ${manaHtml(ab.manaPer.syms)} × ${countTypes(me, ab.manaPer.types)}` : /^[+−-]?(\d+|X)$/.test(ab.cost || "") ? esc(ab.label) : `${abCostHtml(ab.cost)}<span class="ab-sep">:</span> ${esc(ab.label)}`}</button>`).join("")}</div>` : "";
        })()}
        ${(() => { const c = lookupCard(e.n), wr = c && winRule(c); return wr ? `<button class="btn small ability" data-a="win-manual" data-id="${id}">🏆 Win condition met: declare win</button>` : ""; })()}
        ${(() => { const c = { ...e, o: e.o || lookupCard(e.n)?.o, t: e.t || lookupCard(e.n)?.t }; const ec = equipCost(c), en = enchantType(c); if (!ec && !en) return "";
          const opts = attachTargets(ec ? "creature" : en).filter(([v]) => v !== `bf:${id}`);
          return `<div class="label">${ec ? `Equip ${manaHtml(ec)}` : `Enchant ${esc(en)}`}${e.att ? ` · on ${esc(hostName(me, id) || "?")}` : ""}</div><div class="abilities">
            ${opts.length ? `<select class="fetch-pick" id="eq-${id}">${opts.map(([v, n]) => `<option value="${esc(v)}">${esc(n)}</option>`).join("")}</select><button class="btn small ability" data-a="equip-go" data-id="${id}">📎 ${e.att ? "Move" : "Attach"}</button>` : `<span class="mini">Nothing to attach it to.</span>`}
            ${e.att ? `<button class="btn small" data-a="unattach" data-id="${id}">Unattach</button>` : ""}</div>`; })()}
        <div class="leave-row">
          <span class="muted">Leaves to:</span>
          ${/\bCreature\b/.test(e.t || "") && e.tap ? `<button class="btn small" data-a="attack" data-id="${id}">⚔ Attack</button>` : ""}${(() => { const o = String(e.o || lookupCard(e.n)?.o || ""); const bu = o.match(/^Bushido (\d+)/m) || o.match(/^Afflict (\d+)/m), bt = /^whenever this creature (?:blocks or )?becomes blocked, /im.test(o); return bu || bt ? `<button class="btn small" data-a="blocked" data-id="${id}" title="It blocked or became blocked">🛡 Blocked${bu ? (/^Afflict/.test(bu[0]) ? ` (afflict ${bu[1]})` : ` (+${bu[1]}/+${bu[1]})`) : ""}</button>` : ""; })()}${e.fd ? `<button class="btn small primary" data-a="faceup" data-id="${id}">🂡 Turn face up${e.fd.card ? `: ${esc(e.fd.card.n)}` : ""}${e.fd.cost ? ` (${esc(e.fd.cost)})` : ""}</button>` : ""}${(() => { const c0 = deckCard(e.n) || lookupCard(e.n); return c0?.faces?.length > 1 && /^(transform|flip)$/.test(c0.layout || "") ? `<button class="btn small" data-a="flip-man" data-id="${id}" title="Turn it to its other face">🔄 ${esc(c0.faces[1 - (e.face || 0)].n)}</button>` : ""; })()}${/equipped creature gets \+1\/\+1 for each card in your hand|power and toughness are each equal to the number of cards in your hand/i.test(e.o || lookupCard(e.n)?.o || "") ? `<button class="btn small" data-a="hand-set" data-id="${id}" title="Cards in your hand (the app can't see your hand)">✋ Hand: ${e.handN ?? 0}</button>` : ""}${/each of those creatures has "\{1\}\{U\}: Exile this creature, then return it to the battlefield/i.test(e.o || lookupCard(e.n)?.o || "") ? `<button class="btn small" data-a="dd-blink" data-id="${id}">✨ Blink it or its pair ({1}{U})</button>` : ""}${(() => { const sv = String(e.o || lookupCard(e.n)?.o || "").match(/^((?:\{[^}]+\})+), \{T\}: Add X mana in any combination of colors, where X is the greatest power among creatures you control/m); return sv && !e.tap ? `<button class="btn small" data-a="selv-btn" data-id="${id}" data-c="${sv[1]}">⚡ ${sv[1]}, Tap: add X (X = ${maxPowerNow()})</button>` : ""; })()}${(() => { const xm = String(e.o || lookupCard(e.n)?.o || "").match(/^\{T\}: Add X mana of any one color, where X is (?:the number of ([A-Za-z]+?)s you control|[^.\n]*?'s power)/m); if (!xm || e.tap) return ""; const x = xm[1] ? countTypes(me, [xm[1].toLowerCase()]) : Number(ptOf(e, countsFor(me), pid, id).split("/")[0]) || 0; return `<button class="btn small" data-a="xany" data-id="${id}" data-x="${x}">⚡ Tap: add ${x} of one color</button>`; })()}${String(e.o || lookupCard(e.n)?.o || "").match(/^Exile a creature you control: Add X mana of any one color, where X is 1 plus the exiled creature's mana value/m) ? `<button class="btn small" data-a="foodchain" data-id="${id}">⚡ Exile a creature for mana</button>` : ""}${/^Station \(/m.test(e.o || lookupCard(e.n)?.o || "") ? `<button class="btn small" data-a="station" data-id="${id}">🚀 Station (${e.c?.charge || 0} charge)</button>` : ""}${/you may cast noncreature spells from the top of your library/i.test(e.o || lookupCard(e.n)?.o || "") ? `<button class="btn small" data-a="citadel" data-k="nc" data-id="${id}">📚 Cast a noncreature spell from top of library</button>` : ""}${/creatures? you control: add one mana of any color/i.test(e.o || lookupCard(e.n)?.o || "") && /^tap an untapped ([a-z ]+?) you control: add one mana of any color/im.test(e.o || lookupCard(e.n)?.o || "") ? `<button class="btn small" data-a="relic" data-id="${id}">⚡ Tap a ${esc(((e.o || lookupCard(e.n)?.o || "").match(/^tap an untapped ([a-z ]+?) you control:/im) || [])[1] || "creature")} for mana</button>` : ""}${(() => { const vm = String(e.o || lookupCard(e.n)?.o || "").match(/^\{0\}: Add X mana in any combination of (\{\w\}) and\/or (\{\w\}), where X is [^\n]*?power/im); return vm ? `<button class="btn small" data-a="vivi" data-id="${id}" data-s1="${vm[1]}" data-s2="${vm[2]}">⚡ Add X mana (${vm[1]}/${vm[2]})</button>` : ""; })()}${/you may play lands and cast spells from the top of your library\. if you cast a spell this way, pay life equal to its mana value/i.test(e.o || lookupCard(e.n)?.o || "") ? `<button class="btn small" data-a="citadel" data-id="${id}">📚 Play from top of library</button>` : ""}${/becomes prepared|enters prepared/i.test(e.o || lookupCard(e.n)?.o || "") && preparedSpell(e) ? (e.prepared ? `<button class="btn small primary" data-a="prep-cast" data-id="${id}">🔮 Cast ${esc(preparedSpell(e)?.n || "its spell")} (copy)</button>` : `<button class="btn small" data-a="prep-mark" data-id="${id}" title="It became prepared">🔮 Mark prepared</button>`) : ""}${REPERC.test(e.o || lookupCard(e.n)?.o || "") ? `<button class="btn small" data-a="rep-manual" data-id="${id}" title="Combat damage, fights…">💥 A creature was dealt damage</button>` : ""}${bigHitTriggers({ ...e, o: e.o || lookupCard(e.n)?.o }).map((h, i) => `<button class="btn small" data-a="bighit" data-id="${id}" data-i="${i}" title="Blockers, fights, other damage the app didn't see">💥 Dealt ${h.min}+ damage</button>`).join("")}${crewOf({ ...e, o: e.o || lookupCard(e.n)?.o }) && !e.crewT ? `<button class="btn small" data-a="crew" data-id="${id}">🚗 Crew ${crewOf({ ...e, o: e.o || lookupCard(e.n)?.o })}</button>` : ""}
          ${e.own ? `<button class="btn small primary" data-a="give-back" data-id="${id}">↩ Return to ${esc(e.own.name)}</button>` : ""}
          ${["Graveyard", "Sacrificed", "Exile", "Hand", ...(e.cmd ? ["Command zone"] : [])].map(d => `<button class="btn small" data-a="move" data-id="${id}" data-dest="${d}">${d}</button>`).join("")}
          <button class="btn small air-btn" data-a="airbend" data-id="${id}">🌀 Airbended</button>
          ${WILLB_RE.test(e.o || lookupCard(e.n)?.o || "") ? `<button class="btn small" data-a="wbk-ask" data-id="${id}">🎯 I targeted an opponent's creature…</button>` : ""}
          ${SQUIRE_RE.test(e.o || lookupCard(e.n)?.o || "") ? `<button class="btn small" data-a="sq-ask" data-id="${id}">🛡 Damage to me was prevented…</button>` : ""}
          ${/whenever (?:this creature|[^,\n]+?) is dealt (?:noncombat |combat )?damage, /i.test(e.o || lookupCard(e.n)?.o || "") || dmgWatchers(e).length ? `<button class="btn small" data-a="dealt-dmg" data-id="${id}">💥 It was dealt damage…</button>` : ""}
        </div>
      </div>` : ""}
    </div>`;
  }

  // ----- Clicks -----
  app.addEventListener("pointerdown", () => unlockAudio(), { once: true });
  app.onclick = e => {
    const b = e.target.closest("[data-a]");
    if (!b) return;
    const rr = b.dataset.id ? reminders.find(x => x.id === b.dataset.id) : null;
    activeCast = rr?.castKey && !["rem-dismiss", "unless-paid", "unless-no"].includes(b.dataset.a) ? rr.castKey : null;
    if (!["undo", "redo", "expand", "tok-tapmenu", "tok-atkmenu", "tok-rm", "alerts", "rem-up", "mana-mode"].includes(b.dataset.a)) { actSeq++; actLabel = (b.textContent || b.dataset.a).replace(/\s+/g, " ").trim().slice(0, 40); digAtAct = { seq: actSeq, dig: dig ? clone(dig) : null }; } // digital hand/library as they were before this tap, for Undo
    actTargeting = /-go$/.test(b.dataset.a || "") || b.dataset.a === "rem-apply"; // a target picked for one of my spells/abilities (Valiant)
    try { onAction(e, b); } catch (err) { reportError(err, b.dataset.a); } finally { activeCast = null; setTimeout(() => { actTargeting = false; }, 0); }
  };
  const onAction = (e, b) => {
    const a = b.dataset.a;
    { const r0 = b.dataset.id && reminders.find(x => x.id === b.dataset.id); targetSrcColors = r0 ? remSrcColors(r0) : null; }
    if (a === "wide" || a === "wide-yes" || a === "wide-no") { wide = a === "wide" ? !wide : a === "wide-yes"; store.set("mtga_layout", wide ? "wide" : "phone"); applyWide(); applyTab(); render(); return; }
    if (a === "tab") { tab = b.dataset.tab; store.set("mtga_tab", tab); applyTab(); if (tab !== "hand") document.querySelectorAll(".hand-zones").forEach(x => { x.innerHTML = ""; }); if (tab === "table") renderTable(); else render(); return; }
    if (a === "tview") { const o = room.players?.[b.dataset.o], x = o?.bf?.[b.dataset.id]; if (x && !x.fd) showCard(lookupCard(x.n) || x); return; }
    if (a === "tview-tok") { const o = room.players?.[b.dataset.o], t = o?.tokens?.[b.dataset.k]; if (t) showCard({ n: `${t.name} ×${t.count}`, t: t.desc ? `Token: ${t.desc}` : "Token", o: "", img: tokenArt(t) }); return; }
    if (a === "tour") { startTour(); return; }
    if (/^dig-(play|top|bot|disc|new|mulligan|off)$/.test(a)) digOpenI = -1;
    if (a === "deck-clear") {
      if (deck && confirm(`Delete "${deck.name}" from this phone?`)) {
        delete lib.decks[lib.active];
        useDeck(Object.keys(lib.decks)[0]);
      }
      return;
    }
    if (a === "deck-new") {
      const name = (prompt("Name for the new deck?", "New deck") || "").trim();
      if (name) { newDeck({ name, cards: [], cmds: [], missing: [], at: Date.now() }); searchEl.value = ""; deckChanged(); }
      return;
    }
    if (a === "deck-rename") {
      const name = (prompt("Rename this deck", deck.name) || "").trim();
      if (name) { deck.name = name; saveDeck(); renderDeck(); deckChanged(); }
      return;
    }
    if (a === "cmd-toggle") {
      const c = deck?.cards[Number(b.dataset.i)];
      if (!c) return;
      if (deck.cmds.includes(c.n)) deck.cmds = deck.cmds.filter(n => n !== c.n);
      else if (deck.cmds.length >= 2) { toast("Two commanders max. Remove one first."); return; }
      else {
        deck.cmds.push(c.n);
        if (["Imported deck", "New deck"].includes(deck.name)) deck.name = c.n;
      }
      saveDeck(); deckChanged();
      return;
    }
    if (a === "cmd-rm") { deck.cmds.splice(Number(b.dataset.i), 1); saveDeck(deck); deckChanged(); return; }
    if (a === "add-card") { addToDeck(b.dataset.name); return; }
    if (a === "dq") { deckQty(Number(b.dataset.i), Number(b.dataset.d)); return; }
    if (a === "miss-rm") { deck.missing.splice(Number(b.dataset.i), 1); saveDeck(deck); renderDeck(); return; }
    if (a === "add-nick") { addNick(b.dataset.name); return; }
    if (a === "find-missing") {
      findTarget = deck.missing[Number(b.dataset.i)];
      addEl.value = findTarget.split(/\s+\/\/?\s+/)[0];
      addEl.oninput(); addEl.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    if (a === "view") {
      const [kind, id] = b.dataset.ref.split(":");
      const e = kind === "bf" ? me?.bf?.[id] : null;
      if (e && /\bCreature\b/.test(e.t || "")) {
        const full = { ...e, o: e.o || lookupCard(e.n)?.o };
        const bfs = buffsOn(full, pid, id), kw = kwsOf(full, pid, id);
        const lines = [`${ptOf(full, countsFor(me), pid, id)}${isSick(full, meOwner(), id) ? " · 💤 summoning sick" : ""}`,
          ...(kw.length ? [`Keywords: ${kw.map(x => x.k + (x.src ? ` (from ${x.src})` : "")).join(", ")}`] : []),
          ...bfs.from.map(x => `${x.dp >= 0 ? "+" : ""}${x.dp}/${x.dt >= 0 ? "+" : ""}${x.dt} from ${x.src}`)];
        showCard(cardFromRef(b.dataset.ref), lines);
      } else showCard(cardFromRef(b.dataset.ref));
      return;
    }
    if (!me) return;
    const d = Number(b.dataset.d);
    switch (a) {
      case "life": lifeChange(d); break;
      case "pc": pcChange(b.dataset.k, d); break;
      case "cmd": cmdChange(b.dataset.o, d); break;
      case "tok": { const t = me.tokens?.[b.dataset.k]; if (t) tokChange(t.name, d); break; }
      case "adj-scope": { adjScope = b.dataset.s === "perm" ? "perm" : "eot"; render(); break; }
      case "tok-adjmenu": { adjOpen = adjOpen === b.dataset.k ? null : b.dataset.k; render(); break; }
      case "adj": case "adj-clear": {
        const kind = b.dataset.kind, key = b.dataset.id, w = b.dataset.w, d = Number(b.dataset.d) || 0, clear = a === "adj-clear";
        const name = kind === "bf" ? dispName(me.bf?.[key] || {}) : `${me.tokens?.[key]?.name || "token"} tokens`;
        const scope = adjScope;
        mutate(p => {
          const bump = (o, kp, kt) => { o[w === "p" ? kp : kt] = (o[w === "p" ? kp : kt] || 0) + d; };
          if (kind === "bf") {
            const e = p.bf?.[key]; if (!e) return;
            if (clear) { delete e.adj; if (p.eot) delete p.eot[`man_${key}`]; return; }
            if (scope === "perm") { e.adj ||= { p: 0, t: 0 }; bump(e.adj, "p", "t"); if (!e.adj.p && !e.adj.t) delete e.adj; }
            else { p.eot ||= {}; const x = (p.eot[`man_${key}`] ||= { src: "manual adjustment", target: key, dp: 0, dt: 0, kws: [] }); bump(x, "dp", "dt"); if (!x.dp && !x.dt) delete p.eot[`man_${key}`]; }
          } else {
            const t = p.tokens?.[key]; if (!t) return;
            const dropEot = eid => { if (p.eot) delete p.eot[eid]; t.ep = (t.ep || []).filter(y => y !== eid); if (!t.ep.length) delete t.ep; };
            let eid = (t.ep || []).find(x => x.startsWith("man"));
            if (clear) { delete t.adj; if (eid) dropEot(eid); return; }
            if (scope === "perm") { t.adj ||= { p: 0, t: 0 }; bump(t.adj, "p", "t"); if (!t.adj.p && !t.adj.t) delete t.adj; }
            else {
              if (!eid) { eid = `man${Date.now().toString(36)}`; t.ep = [...(t.ep || []), eid]; }
              p.eot ||= {}; const x = (p.eot[eid] ||= { src: "manual adjustment", epTag: true, ids: [], toks: [], dp: 0, dt: 0, kws: [] }); bump(x, "dp", "dt");
              if (!x.dp && !x.dt) dropEot(eid);
            }
          }
        });
        if (clear) logTo(code, `✎ ${me.name} cleared the manual P/T adjustment on ${name}`);
        else logDelta(`adj|${kind}|${key}|${w}|${scope}`, d, n => `✎ ${me.name} manually adjusted ${name}: ${sgn(n)} ${w === "p" ? "power" : "toughness"} ${scope === "eot" ? "until end of turn" : "(permanent)"}`);
        break;
      }
      case "tok-ctr": { // put (or remove) +1/+1 counters on some tokens of a stack; they split off into their own stack
        const k = b.dataset.k, t = me.tokens?.[k];
        if (!t) break;
        const how = Number(prompt(`How many of these ${t.count} ${t.name} tokens get counters?`, String(t.count)));
        if (!(how > 0)) break;
        const n = Number(prompt("How many +1/+1 counters on each? (use a negative number to remove)", "1"));
        if (!n) break;
        mutate(p => { if (n > 0) counterTokens(p, k, how, "p1p1", n); else { counterTokens(p, k, how, "p1p1", n); Object.values(p.tokens || {}).forEach(x => { if (x.c?.p1p1 <= 0) { delete x.c.p1p1; if (!Object.keys(x.c).length) delete x.c; } }); tidyTokenStacks(p); } });
        logTo(code, `${me.name}: ${n > 0 ? "+" : ""}${n} +1/+1 on ${Math.min(how, t.count)} ${t.name} token${how === 1 ? "" : "s"}`);
        break;
      }
      case "tok-add": tokChange(b.dataset.name, 1); break;
      case "eff-add": {
        const def = effectDef(b.dataset.k);
        if (def.turnOnly) addEffect(def.key, "turn");
        else if (def.ongoing) addEffect(def.key, "ongoing");
        else { pendingEffect = def.key; render(); }
        break;
      }
      case "eff-dur": { const k = pendingEffect; pendingEffect = null; addEffect(k, b.dataset.dur); break; }
      case "eff-cancel": pendingEffect = null; render(); break;
      case "eff-rm": removeEffect(b.dataset.k); break;
      case "play": {
        const c = cardFromRef(b.dataset.ref);
        if (c && okToCast(c)) { // digital deck: a card cast from Board search that's in my digital hand leaves it
          if (dig?.on) { const hi = dig.hand.indexOf(c.n); if (hi >= 0) { dig.hand.splice(hi, 1); digSave(); setTimeout(() => { try { renderHand(); } catch {} }, 0); toast(`🂠 ${dispName(c)} taken from your digital hand`); } }
          playCard(c); searchEl.value = ""; renderSearch(); }
        break;
      }
      case "play-any": playAny(b.dataset.name); break;
      case "cast-cmd": {
        const n = deck.cmds[Number(b.dataset.i)], c = deck.cards.find(x => x.n === n) || { n, t: "Legendary Creature" };
        if (okToCast(c, "cz")) castCommander(n);
        break;
      }
      case "tap": if (b.dataset.sick && !confirm(`${dispName(me.bf?.[b.dataset.id] || {})} is summoning sick, so it can't use its own {T} abilities or attack.\n\nTap it anyway? (OK for things like crew, convoke or Relic of Legends.)`)) break; toggleTap(b.dataset.id); break;
      case "untap-all": untapAll(); break;
      case "expand": { const id = b.dataset.id; expanded.has(id) ? expanded.delete(id) : expanded.add(id); render(); break; }
      case "pcount": permCounter(b.dataset.id, b.dataset.k, d); break;
      case "pcount-other": {
        const name = (prompt("Counter name (e.g. Flying, Quest, Ki)") || "").trim();
        if (name) permCounter(b.dataset.id, ["loyalty", "charge", "shield", "stun", "oil", "lore", "time"].includes(slug(name)) ? slug(name) : "x_" + slug(name), 1);
        break;
      }
      case "move": moveOut(b.dataset.id, b.dataset.dest); break;
      case "start": update(ref(db, `rooms/${code}`), { turn: pid, turnNo: (room.turnNo || 0) + 1, round: 1, firstSeat: me.seat ?? 0 }); logTo(code, `${me.name} goes first`); break;
      case "step-next": {
        if (room.turn !== pid) break;
        const i = Math.min(STEPS.length - 1, stepOf(room) + 1);
        const atEnd = i === STEPS.length - 1;
        if (STEPS[i] === "Combat") fireCombat();
        if (STEPS[i] === "Main 2") phaseEvents([{ type: "phase", phase: "main2", mine: true }]);
        if (STEPS[i] === "Main 2") Object.entries(me.bf || {}).forEach(([id, e]) => { const m = String(e.o || lookupCard(e.n)?.o || "").match(/at the beginning of your second main phase, if you gained (\d+|a|one) or more life this turn, this creature becomes prepared/i); if (!m || e.prepared) return;
          const need = Number(m[1]) || 1, t = room?.turnNo || 0, got = me.lifeGainedN?.t === t ? me.lifeGainedN.n || 0 : (me.lifeGained === t ? null : 0);
          if (got != null && got >= need) { mutate(p => { if (p.bf?.[id]) p.bf[id].prepared = true; }); logTo(code, `🔮 ${me.name}'s ${dispName(e)} is prepared (gained ${got} life this turn)`); }
          else if (got == null) { reminders.push({ id: newId(), src: dispName(e), srcId: id, text: `If you gained ${need} or more life this turn, it becomes prepared (tap 🔮 on it).`, times: 1 }); render(); } });
        if (i > 3) exileMyriad();
        poolStepEnd(stepOf(room) === 3, false);
        update(ref(db, `rooms/${code}`), { step: { turnNo: room.turnNo || 0, i, ...(atEnd ? { endFired: true } : {}) } });
        if (atEnd) { phaseEvents([{ type: "phase", phase: "end", mine: true }]); checkWinsAt("end"); handSizeReminder(); sacEndTokens(); endStepHooks(true); }
        break;
      }
      case "end": {
        const tbAt = Date.now(), before = JSON.parse(JSON.stringify(room || {}));
        if (before.players && me) before.players[pid] = JSON.parse(JSON.stringify(me));
        localTB = { at: tbAt, rem: clone(reminders), dig: dig ? clone(dig) : null, undoN: undo.length };
        exileMyriad();
        if (!(room.step?.turnNo === (room.turnNo || 0) && room.step.endFired)) sacEndTokens();
        if (!(room.step?.turnNo === (room.turnNo || 0) && room.step.endFired)) { phaseEvents([{ type: "phase", phase: "end", mine: true }]); checkWinsAt("end"); endStepHooks(true); }
        const eotIds = Object.entries(me.bf || {}).filter(([, e]) => e.own && e.stolen?.until === "eot").map(([id]) => id);
        const eotToks = Object.entries(me.tokens || {}).filter(([, t]) => t.own && t.stolen?.until === "eot").map(([k]) => k);
        if (eotIds.length || eotToks.length) returnBorrowed(eotIds, eotToks);
        const fds = Object.entries(me.ex || {}).filter(([, e]) => e.toHand === "end");
        if (fds.length) {
          act([], p => fds.forEach(([id]) => delete p.ex?.[id]));
          logTo(code, `${fds[0][1].src}: ${me.name} put ${fds.length} face-down card${fds.length === 1 ? "" : "s"} into hand`);
          toast(`${fds.length} face-down card${fds.length === 1 ? "" : "s"} → your hand`);
        }
        nextTurn(code, before, tbAt); break;
      }
      case "take-back": takeBackTurn(code); break;
      case "undo": doUndo(); break;
      case "redo": doRedo(); break;
      case "order-mode": { orderTriggers = !orderTriggers; try { localStorage.setItem("mtga_order", orderTriggers ? "1" : "0"); } catch {} toast(orderTriggers ? "🔀 When several triggers happen at once, you resolve them in the order you choose" : "Triggers that happen at once resolve automatically"); render(); break; }
      case "alerts": { turnAlerts = !turnAlerts; try { localStorage.setItem("mtga_alerts", turnAlerts ? "1" : ""); } catch {} if (turnAlerts && "Notification" in window && Notification.permission === "default") Notification.requestPermission().catch(() => {}); toast(turnAlerts ? "🔔 Turn alerts on: buzz, chime and a notification when it's your turn" : "🔕 Turn alerts off"); render(); break; }
      case "rem-up": { const i = reminders.findIndex(x => x.id === b.dataset.id); if (i > 0) { const [r] = reminders.splice(i, 1); reminders.unshift(r); } render(); break; }
      case "auto": auto = !auto; store.set("mtga_auto", auto ? "on" : "off"); render(); toast(`Auto triggers ${auto ? "on" : "off"}`); break;
      case "log": showLog(); break;
      case "miss-open": missOpen = true; showLog(); setTimeout(() => document.getElementById("missNote")?.focus(), 50); break;
      case "miss-cancel": missOpen = false; showLog(); break;
      case "miss-copy": case "miss-send": (async () => {
        const r = missReport(document.getElementById("missNote")?.value || ""), txt = missText(r);
        const copy = async () => { try { await navigator.clipboard.writeText(txt); return true; } catch { return false; } };
        if (b.dataset.a === "miss-copy") { toast(await copy() ? "📋 Report copied: paste it to Claude" : "Couldn't copy on this phone"); return; }
        const key = `${code}-${Date.now().toString(36)}`;
        let saved = "";
        try { await set(ref(db, `reports/${key}`), r); saved = `reports/${key}`; } catch {}
        if (!saved) try { await set(ref(db, `rooms/${code}/reports/${key}`), r); saved = `rooms/${code}/reports/${key}`; } catch {}
        const copied = await copy();
        missOpen = false; showLog();
        toast(saved ? `📨 Report saved (${key})${copied ? " and copied" : ""}. Tell Claude: “check report ${key}”` : copied ? "Couldn't save it online, but it's copied: paste it to Claude" : "Couldn't save or copy the report");
        logTo(code, `🤔 ${me.name} reported a missed trigger${r.note ? `: ${r.note.slice(0, 120)}` : ""}`);
      })(); break;
      case "rem-jump": window.scrollTo({ top: 0, behavior: "smooth" }); break;
      case "view-token": showToken(b.dataset.k); break;
      case "activate": activate(b.dataset.id, Number(b.dataset.i)); break;
      case "attack": { // preview first: who can block, what could happen
        const e = me.bf?.[b.dataset.id];
        if (!e) break;
        { const no = Object.values(me.bf || {}).find(x => /creatures you control can't attack/i.test(x.o || lookupCard(x.n)?.o || "")); if (no && !confirm(`${dispName(no)}: creatures you control can't attack. Attack anyway?`)) break; }
        reminders = reminders.filter(x => !x.atkPlan);
        reminders.push({ id: newId(), src: dispName(e), text: "", times: 1, atkPlan: { kind: "bf", id: b.dataset.id } });
        render(); try { window.scrollTo({ top: 0, behavior: "smooth" }); } catch {} break;
      }
      case "plan-go": {
        const r = reminders.find(x => x.id === b.dataset.id);
        if (!r) break;
        reminders = reminders.filter(x => x !== r);
        attackNow(r.atkPlan.id, b.dataset.o || null);
        break;
      }
      case "tok-use": useToken(b.dataset.k); break;
      case "brew-ab": {
        const k = b.dataset.k, t = me.tokens?.[k], c = lookupCard(b.dataset.n) || deckCard(b.dataset.n), ab = c && activatedAbilities(c)[Number(b.dataset.i)];
        if (!t || !ab) break;
        const cs = ab.costs || {}, sacSelf = /sacrifice (this|it|~)/i.test(ab.cost) || cs.sacSelf;
        if (cs.tap && t.count - (t.tapped || 0) <= 0) { toast(`No untapped ${t.name}.`); break; }
        const cre = isCreatureToken(t.name);
        act(sacSelf ? [{ type: "sac", name: t.name, n: 1, token: true, creature: cre }, ...(cre ? [{ type: "dies", n: 1, token: true }] : [])] : [], p => {
          const x = p.tokens?.[k]; if (!x) return;
          if (sacSelf) { x.count -= 1; if (x.tapped > x.count) x.tapped = x.count; if (x.count <= 0) delete p.tokens[k]; }
          else if (cs.tap) x.tapped = Math.min(x.count, (x.tapped || 0) + 1);
          if (cs.life) p.life = (p.life ?? START_LIFE) - cs.life;
        });
        logTo(code, `🍲 ${me.name}'s ${t.name} used ${c.n}'s ability (${ab.cost}): ${ab.label}`);
        if (ab.auto && ab.effs.length) act([{ type: "effects", effs: ab.effs, times: 1, count: 1, src: `${t.name} (${c.n})` }]);
        if (ab.auto && (/\bdraw\b/i.test(ab.text) || /sacrifice (?:an?|another|two|three)\b/i.test(ab.cost))) { reminders.push({ id: newId(), src: `${t.name} (${c.n})`, text: (ab.text.match(/\bdraw [^.]*\./i) || [ab.text])[0].replace(/^\w/, x => x.toUpperCase()), times: 1, note: /sacrifice (?:an?|another|two|three)\b/i.test(ab.cost) ? `Cost: ${ab.cost.replace(/^.*?(sacrifice)/i, "$1")} — do that yourself.` : "" }); render(); }
        else { reminders.push(normalizeRem({ id: newId(), src: `${t.name} (${c.n})`, text: ab.text, times: 1, ...(ab.effs.length ? { effs: ab.effs } : {}), note: /\{|pay|discard|exile/i.test(ab.cost.replace(/\{T\}/g, "")) ? `Pay the rest of the cost: ${ab.cost}` : "" })); render(); }
        break;
      }
      case "copyhost-go": {
        const r = reminders.find(x => x.id === b.dataset.id); if (!r) break;
        const m = String(r.text || "").match(COPY_HOST); if (!m) break;
        const self = r.srcId && me.bf?.[r.srcId], host = self?.att && self.att !== "tok" ? me.bf?.[self.att] : null;
        reminders = reminders.filter(x => x.id !== r.id);
        if (b.dataset.k === "copy" && host) {
          const [pp, tt] = [host.p ?? lookupCard(host.n)?.p ?? "1", host.tg ?? lookupCard(host.n)?.tg ?? "1"];
          const tl = String(host.t || lookupCard(host.n)?.t || "Creature").replace(/^Legendary\s+/, "");
          act([{ type: "create", name: host.n, n: 1, desc: `${pp}/${tt} copy of ${host.n}`, src: r.src }], null, p => { Object.values(p.tokens || {}).forEach(t => { if (t.name === host.n && !t.tl) t.tl = tl; }); });
          logTo(code, `⚙ ${r.src}: ${me.name} paid ${m[1]} → token copy of ${dispName(host)}`);
        } else {
          const desc = m[2].replace(/^an?\s+/i, ""), nm = (desc.match(/([A-Z][a-z]+) creature/) || [])[1] || "Insect";
          act([{ type: "create", name: nm, n: 1, desc, src: r.src }]);
          logTo(code, `⚙ ${r.src}: ${me.name} created a ${desc} token`);
        }
        render(); break;
      }
      case "dig-leyline": { if (!dig) break; const i = Number(b.dataset.i), n = dig.hand[i], c = n && (deckCard(n) || lookupCard(n)); if (!c) break;
        dig.hand.splice(i, 1); digSave(); digOpenI = -1; playCard(c, { via: "opening hand" }); logTo(code, `🌅 ${me.name} began the game with ${dispName(c)} on the battlefield`); renderHand(); break; }
      case "dig-handab": { // bestow / cycling / channel / ninjutsu… straight from the digital hand
        if (!dig) break; const i = Number(b.dataset.i), n = dig.hand[i], c = n && (deckCard(n) || lookupCard(n)), h = c && handAbilities(c)[Number(b.dataset.j)];
        if (!h) break;
        dig.hand.splice(i, 1); dig.mull = 0; digSave(); digOpenI = -1;
        useHandAbility(c, h); setTimeout(renderHand, 0); break;
      }
      case "hand-ab": {
        const c = cardFromRef(b.dataset.ref), h = c && handAbilities(c)[Number(b.dataset.j)];
        if (h) { useHandAbility(c, h); searchEl.value = ""; renderSearch(); }
        break;
      }
      case "airbend": airbend(b.dataset.id); break;
      case "dealt-dmg": {
        const e = me.bf?.[b.dataset.id]; if (!e) break;
        const own = String(e.o || lookupCard(e.n)?.o || "").match(/whenever (?:this creature|[^,\n]+?) is dealt (noncombat |combat )?damage, ([^\n]+)/i), w = dmgWatchers(e); if (!own && !w.length) break;
        const n = Math.max(0, Math.floor(Number(prompt(`${dispName(e)} was dealt how much ${own?.[1] || ""}damage?`, "1")) || 0)); if (!n) break;
        const fix = t => { const x = t.replace(/\bthat much damage\b/gi, `${n} damage`).replace(/\bthat many\b/gi, String(n)).replace(/^it deals/i, `${dispName(e)} deals`); return x[0].toUpperCase() + x.slice(1); };
        if (own) reminders.push(normalizeRem({ id: newId(), src: dispName(e), srcId: b.dataset.id, text: fix(own[2]), times: 1 }));
        w.forEach(([src, t]) => reminders.push(normalizeRem({ id: newId(), src, text: fix(t), times: 1 })));
        logTo(code, `💥 ${me.name}'s ${dispName(e)} was dealt ${n} damage`); render(); break;
      }
      case "air-cast": castFromAir(b.dataset.id); break;
      case "edict-target": {
        const r = reminders.find(x => x.id === b.dataset.id), o = room.players?.[b.dataset.o];
        if (!r || !o) break;
        r.edictSent = true;
        reminders = reminders.filter(x => x.id !== r.id);
        sendEdicts(r, [{ id: b.dataset.o, ...o }]);
        render();
        break;
      }
      case "edict-go":
      case "edict-none": {
        const key = b.dataset.k, [kind, id] = key.split(":");
        const src = kind === "n" ? room.notes?.[pid]?.[id] : reminders.find(x => x.id === id)?.edictLocal;
        if (!src) break;
        const n = src.n || 1;
        if (b.dataset.a === "edict-go") {
          const vals = readEdictChoice(key, n);
          if (!vals.length) { toast("Pick what to sacrifice."); break; }
          if (vals.length > n) { toast(`Pick ${n}.`); break; }
          sacrificeChosen(vals, src.src);
        } else logTo(code, `${me.name} had nothing to sacrifice (${src.src})`);
        if (kind === "n") update(ref(db, `rooms/${code}/notes/${pid}`), { [id]: null });
        else { reminders = reminders.filter(x => x.id !== id); render(); }
        break;
      }
      case "give-back": returnBorrowed([b.dataset.id], []); break;
      case "choose-pl": {
        const r = reminders.find(x => x.id === b.dataset.id), o = room.players?.[b.dataset.o];
        if (!r || !o) break;
        reminders = reminders.filter(x => x.id !== r.id);
        act([], p => { if (p.bf?.[r.choosePlayer]) p.bf[r.choosePlayer].chosen = { id: b.dataset.o, name: o.name }; });
        logTo(code, `${me.name}: ${r.src} chose ${b.dataset.o === pid ? "themself" : o.name}`);
        break;
      }
      case "swap-go": {
        const r = reminders.find(x => x.id === b.dataset.id), f = r?.swap;
        const theirs = document.getElementById(`sw-${b.dataset.id}`)?.value, mineV = f?.self ? `${pid}|${r.srcId}` : document.getElementById(`sa-${b.dataset.id}`)?.value;
        if (!f || !theirs || !mineV) break;
        const [oid, tid] = theirs.split("|"), myId = mineV.split("|")[1], mine = me.bf?.[myId];
        if (!mine) { toast("That permanent isn't on your battlefield."); break; }
        reminders = reminders.filter(x => x.id !== r.id);
        noRelease = true;
        act([], p => { delete p.bf[myId]; });
        noRelease = false;
        sendOrders({ [oid]: {} }, { how: "steal", targets: [{ kind: "bf", id: tid }], src: r.src, until: null });
        sendOrders({ [oid]: {} }, { how: "receive", cards: [{ ...mine }], toks: [], from: meTag(), src: r.src });
        logTo(code, `🔀 ${me.name}: ${r.src} exchanges ${dispName(mine)} with ${room.players?.[oid]?.name}'s ${dispName(room.players?.[oid]?.bf?.[tid] || { n: "permanent" })}`);
        render(); break;
      }
      case "swap-none": {
        const r = reminders.find(x => x.id === b.dataset.id);
        if (!r) break;
        reminders = reminders.filter(x => x.id !== r.id);
        if (me.bf?.[r.srcId]) moveOut(r.srcId, "Sacrificed");
        render(); break;
      }
      case "ctl-go": {
        const r = reminders.find(x => x.id === b.dataset.id), o = room.players?.[b.dataset.o];
        if (!r || !o) break;
        reminders = reminders.filter(x => x.id !== r.id);
        update(ref(db, `rooms/${code}`), { control: { by: pid, byName: me.name, target: b.dataset.o, targetName: o.name, src: r.src, active: false, at: Date.now() } });
        logTo(code, `🎮 ${me.name} will control ${o.name}'s next turn (${r.src})`);
        render(); break;
      }
      case "ml-go": {
        const nid = b.dataset.n, n = room.notes?.[pid]?.[nid];
        if (!n) break;
        // digital deck: the milled cards are simply the top of the library
        const picks = dig?.on ? (() => { const nm = dig.lib.splice(0, n.n || 0); digSave(); setTimeout(() => { try { renderHand(); } catch {} }, 0); return nm.map(x => deckCard(x) || lookupCard(x) || { n: x }); })()
          : [...document.querySelectorAll(`.ml-pick[data-n="${nid}"]`), ...document.querySelectorAll(`.ml-box[data-n="${nid}"]:checked`)].filter(x => x.value !== "").map(x => deck?.cards[Number(x.value)]).filter(Boolean);
        update(ref(db, `rooms/${code}/notes/${pid}`), { [nid]: null });
        const ids = [];
        act([], p => picks.forEach(c => { const gid = toZone(p, c, "gy"); if (gid) ids.push(gid); }));
        if (picks.length) setTimeout(() => libToGy(picks, ids), 0);
        logTo(code, `${me.name}: ${picks.map(c => c.n).join(", ")} → graveyard (${n.from === me.name ? "" : `${n.from}'s `}${n.src})`);
        { const nl = picks.filter(c => !/\bLand\b/.test(String(c.t || "").split(" // ")[0])).length;
          if (n.rad && nl) { const gain = Object.values(me.bf || {}).some(x => /you gain life rather than lose life from radiation/i.test(x.o || lookupCard(x.n)?.o || ""));
            mutate(p => { p.life = (p.life ?? START_LIFE) + (gain ? nl : -nl); p.rad = Math.max(0, (p.rad || 0) - nl); });
            logTo(code, `☢ ${me.name}: ${nl} nonland milled → ${gain ? "gains" : "loses"} ${nl} life, −${nl} rad`); }
          if (nl) setTimeout(() => nonlandMilled(nl, pid), 0);
          if (picks.length && n.from === me.name) Object.values(me.bf || {}).forEach(x => { if (!/whenever one or more cards are put into your graveyard from your library, each opponent loses 1 life for each card type among those cards/i.test(x.o || lookupCard(x.n)?.o || "")) return;
            const types = new Set(picks.flatMap(c => (String(c.t || "").split(" // ")[0].split(" — ")[0].match(/\b(Artifact|Battle|Creature|Enchantment|Instant|Kindred|Land|Planeswalker|Sorcery)\b/g) || [])));
            const k = types.size; if (!k) return; const u = {}; opponents().filter(o2 => !isOut(o2)).forEach(o2 => { u[`players/${o2.id}/life`] = (o2.life ?? START_LIFE) - k; }); update(ref(db, `rooms/${code}`), u); logTo(code, `⚙ ${dispName(x)}: ${k} card type${k === 1 ? "" : "s"} milled → each opponent loses ${k}`); }); }
        if (n.pick) { reminders.push({ id: newId(), src: n.src, text: `You may put a ${n.pick === "card" ? "" : n.pick + " "}card milled this way into your hand.`, times: 1, millPick: { ids, pick: n.pick, ifType: n.ifType, ifTok: n.ifTok } }); render(); }
        break;
      }
      case "ml-skip": {
        const nid = b.dataset.n, n = room.notes?.[pid]?.[nid];
        update(ref(db, `rooms/${code}/notes/${pid}`), { [nid]: null });
        if (n?.ifType && n?.ifTok && countTypes(me, [n.ifType.toLowerCase()])) act([{ type: "create", name: n.ifTok, n: 1, desc: n.ifTok, src: n.src }]);
        break;
      }
      case "millpick-go": {
        const r = reminders.find(x => x.id === b.dataset.id);
        if (!r) break;
        reminders = reminders.filter(x => x !== r);
        const v = b.dataset.none ? null : document.getElementById(`mp-${r.id}`)?.value;
        const c = v && me.gy?.[v];
        if (c) { act([], p => { delete p.gy?.[v]; }); toDigHand([c]); logTo(code, `${me.name} put ${dispName(c)} into their hand (${r.src})`); }
        const f = r.millPick;
        if (f.ifType && f.ifTok && (countTypes(me, [f.ifType.toLowerCase()]) || new RegExp(`\\b${f.ifType}\\b`).test(c?.t || ""))) act([{ type: "create", name: f.ifTok, n: 1, desc: f.ifTok, src: r.src }]);
        render();
        break;
      }
      case "pp-go": {
        const r = reminders.find(x => x.id === b.dataset.id), f = r?.pumpPick, v = document.getElementById(`pp-${b.dataset.id}`)?.value;
        if (!f || !v) break;
        const color = document.getElementById(`pc-${b.dataset.id}`)?.value;
        const [oid, kind, tid] = v.split("|");
        const num = x => Number(String(x).replace("−", "-").replace(/x/i, "0")) || 0;
        const eff = { k: "pumpOn", target: { kind, id: tid }, dp: num(f.dp), dt: num(f.dt), kws: f.kws.map(k => /color of your choice/.test(k) ? `protection from ${color}` : k) };
        if ((r.ppLeft ?? f.n ?? 1) > 1) r.ppLeft = (r.ppLeft ?? f.n) - 1; else reminders = reminders.filter(x => x.id !== r.id);
        if (f.untapOnly) {
          if (oid === pid) { if (kind === "bf" && me.bf?.[tid]?.tap) toggleTap(tid); else if (kind === "tok" && me.tokens?.[tid]?.tapped) mutate(p => { const t = p.tokens?.[tid]; if (t?.tapped) t.tapped -= 1; }); logTo(code, `${me.name}: ${r.src} untapped ${kind === "bf" ? dispName(me.bf[tid] || {}) : `a ${me.tokens?.[tid]?.name} token`}`); }
          else { sendOrders({ [oid]: {} }, { how: "untapOne", kind, id: tid, src: r.src }); }
          if ((r.ppLeft ?? f.n ?? 1) > 1) r.ppLeft = (r.ppLeft ?? f.n) - 1; else reminders = reminders.filter(x => x.id !== r.id);
          render(); break;
        }
        if (oid === pid && r.srcId && /whenever that creature deals combat damage to a player this combat, this creature becomes prepared/i.test(me.bf?.[r.srcId]?.o || lookupCard(me.bf?.[r.srcId]?.n)?.o || "")) {
          const tn = kind === "bf" ? me.bf?.[tid]?.n : me.tokens?.[tid]?.name;
          if (tn) prepWatch.push({ name: tn, srcId: r.srcId, turn: room.turnNo || 0 });
        }
        if (f.untap) { if (oid === pid) { if (kind === "bf" && me.bf?.[tid]?.tap) setTimeout(() => toggleTap(tid), 0); else if (kind === "tok" && me.tokens?.[tid]?.tapped) mutate(p => { const t = p.tokens?.[tid]; if (t?.tapped) t.tapped -= 1; }); } }
        if (oid === pid) act([{ type: "effects", effs: [eff], times: 1, count: 1, src: r.src, srcId: r.srcId }]);
        else { sendOrders({ [oid]: {} }, { how: "fx", effs: [eff], src: r.src }); logTo(code, `${me.name}: ${r.src} → ${room.players?.[oid]?.name || "?"}'s creature`); }
        render(); break;
      }
      case "riot": {
        const r = reminders.find(x => x.id === b.dataset.id);
        if (!r || !me.bf?.[r.riot]) { reminders = reminders.filter(x => x !== r); render(); break; }
        reminders = reminders.filter(x => x.id !== r.id);
        if (b.dataset.v === "haste") { act([], p => { if (p.bf[r.riot]) p.bf[r.riot].haste = true; }); logTo(code, `${me.name}: ${r.src} has haste (riot)`); }
        else act([{ type: "effects", effs: [{ k: "countersOn", target: { kind: "bf", id: r.riot }, n: 1, key: "p1p1", label: "+1/+1" }], times: 1, count: 1, src: `${r.src} (riot)` }]);
        render(); break;
      }
      case "cx-go": {
        const r = reminders.find(x => x.id === b.dataset.id), x = Number(document.getElementById(`cx-${b.dataset.id}`)?.value);
        if (!r?.countersX || !(x > 0)) break;
        reminders = reminders.filter(y => y.id !== r.id);
        act([{ type: "effects", effs: [{ ...r.countersX, n: x }], times: 1, count: 1, src: r.src, srcId: r.srcId }]);
        break;
      }
      case "pf-go": {
        const r = reminders.find(x => x.id === b.dataset.id);
        if (!r) break;
        const byOwner = {};
        [...document.querySelectorAll(`.pf-box[data-rid="${r.id}"]:checked`)].forEach(x => {
          const [oid, kind, id] = x.value.split("|");
          const g = (byOwner[oid] ||= { bf: [], toks: [], player: [] });
          (kind === "bf" ? g.bf : kind === "tok" ? g.toks : g.player).push(id);
        });
        reminders = reminders.filter(x => x.id !== r.id);
        Object.entries(byOwner).forEach(([oid, g]) => {
          const effs = [{ k: "prolifOn", ...g }];
          if (oid === pid) act([{ type: "effects", effs, times: 1, count: 1, src: r.src, srcId: r.srcId }]);
          else sendOrders({ [oid]: {} }, { how: "fx", effs, src: r.src });
        });
        if (!Object.keys(byOwner).length) logTo(code, `${me.name}: ${r.src} proliferated nothing`);
        render(); break;
      }
      case "sba-go": {
        const r = reminders.find(x => x.id === b.dataset.id);
        if (!r) break;
        reminders = reminders.filter(x => x.id !== r.id);
        (r.sbaIds || []).forEach(id => { if (me.bf?.[id]) moveOut(id, "Graveyard"); });
        (r.sbaToks || []).forEach(k => { const n = me.tokens?.[k]?.count || 0; for (let i = 0; i < n; i++) removeToken(k, "died"); });
        render(); break;
      }
      case "cp-go": {
        const r = reminders.find(x => x.id === b.dataset.id), f = r?.counterPick, v = document.getElementById(`cp-${b.dataset.id}`)?.value;
        if (!f || !v) break;
        f.left -= 1;
        const place = list => { // [{v, n}] → my own counters here, other players' by order
          const byOwner = {};
          list.forEach(({ v: tv, n }) => { const [oid, kind, id] = tv.split("|"); (byOwner[oid] ||= []).push({ k: "countersOn", target: { kind, id }, n, key: f.key, label: f.label }); if (f.kws?.length && kind === "bf") byOwner[oid].push({ k: "pumpOn", target: { kind, id }, dp: 0, dt: 0, kws: f.kws }); });
          counterPutTriggers(list.map(({ v: tv, n }) => ({ oid: tv.split("|")[0], n })));
          Object.entries(byOwner).forEach(([oid, effs]) => {
            if (oid === pid) act([{ type: "effects", effs, times: 1, count: 1, src: r.src, srcId: r.srcId }]);
            else { sendOrders({ [oid]: {} }, { how: "fx", effs, src: r.src }); logTo(code, `${me.name}: ${r.src} → counters on ${room.players?.[oid]?.name || "?"}'s creature`); }
          });
        };
        const m1 = list => { if (f.key === "m1m1") setTimeout(() => list.forEach(x => act([{ type: "m1m1put", creatures: 1, n: x.n }])), 0); }; // Nest of Scarabs, Hapatra
        if (f.total > 1) { // distribute: collect, then put each creature's share on at once (so doublers see one event per creature)
          f.dist ||= {}; f.dist[v] = (f.dist[v] || 0) + 1;
          if (f.left > 0) { render(); break; }
          reminders = reminders.filter(x => x.id !== r.id);
          const dl = Object.entries(f.dist).map(([tv, n]) => ({ v: tv, n }));
          place(dl); m1(dl);
          render(); break;
        }
        if (f.left <= 0) reminders = reminders.filter(x => x.id !== r.id);
        let nn = f.n;
        if (f.nFromPower) { const [oid, kind, id] = v.split("|"), o = room.players?.[oid]; nn = kind === "bf" ? Number(String(ptOf(o?.bf?.[id] || {}, countsFor(o || {}), oid, id) || "0").split("/")[0]) || 0 : Number(String(tokenPT(o?.tokens?.[id] || {}, tablePT) || "0").split("/")[0]) || 0; if (!nn) { logTo(code, `${r.src}: its power is 0, so no counters`); render(); break; } }
        place([{ v, n: nn }]); m1([{ v, n: nn }]);
        render(); break;
      }
      case "tc-go": {
        const r = reminders.find(x => x.id === b.dataset.id), k = document.getElementById(`tc-${b.dataset.id}`)?.value, t = k && me.tokens?.[k];
        if (!r || !t) break;
        reminders = reminders.filter(x => x.id !== r.id);
        const two = r.twoIf && (new RegExp(`\\b${r.twoIf}`, "i").test(`${t.name} ${t.desc || ""} ${tokenPerm(t).t || ""}`));
        const cn = Number(r.copyN) > 0 ? Number(r.copyN) : 1;
        act([{ type: "create", name: t.name, n: two ? 2 * cn : cn, desc: t.desc || "", src: r.src }]); // a copy doesn't copy counters
        // For the Common Good: "…then you gain 1 life for each token you control" counts the new copies too
        if (r.copyN && /tokens you control gain indestructible until your next turn/i.test(String((lookupCard(r.src) || deckCard(r.src))?.o || ""))) setTimeout(() => markTokInd(r.src), 0); // the copies exist before the "then"
        if (r.copyN && /you gain 1 life for each token you control/i.test(String((lookupCard(r.src) || deckCard(r.src))?.o || ""))) { const k = two ? 2 * cn : cn; setTimeout(() => act([{ type: "effects", effs: [{ k: "gain", n: k }], times: 1, count: 1, src: `${r.src} (new copies)` }]), 0); }
        if (two) logTo(code, `${me.name}: ${r.src} — it's a ${r.twoIf}, so two copies`);
        break;
      }
      case "tp-go": {
        const r = reminders.find(x => x.id === b.dataset.id), f = r?.tplayerTok;
        if (!f) break;
        reminders = reminders.filter(x => x.id !== r.id);
        if (b.dataset.o === pid) act([{ type: "create", name: f.name, n: f.n, desc: f.desc, src: r.src, ...(f.tapped ? { tapped: true } : {}) }]);
        else { const o = room.players?.[b.dataset.o]; sendNote(b.dataset.o, { text: `Create ${f.n === 1 ? "a" : f.n}${f.tapped ? " tapped" : ""} ${f.desc} token${f.n === 1 ? "" : "s"}.`, token: f.name, count: f.n, desc: f.desc, src: r.src, ...(f.tapped ? { tapped: true } : {}) }); logTo(code, `${r.src}: ${o?.name || "they"} create${f.n === 1 ? "s" : ""} ${f.n} ${f.name}`); render(); }
        break;
      }
      case "untap-pick": {
        const r = reminders.find(x => x.id === b.dataset.id);
        if (!r?.untapPick) break;
        const vals = [...document.querySelectorAll(`.up-box[data-rid="${r.id}"]:checked`)].map(x => x.value);
        if (vals.length > r.untapPick.max) { toast(`Pick at most ${r.untapPick.max}.`); break; }
        reminders = reminders.filter(x => x.id !== r.id);
        const names = [];
        act([], p => vals.forEach(v => {
          const [kind, id] = v.split("|");
          if (kind === "bf" && p.bf?.[id]) { delete p.bf[id].tap; names.push(dispName(p.bf[id])); }
          if (kind === "tok" && p.tokens?.[id]?.tapped) { p.tokens[id].tapped -= 1; if (!p.tokens[id].tapped) delete p.tokens[id].tapped; names.push(`${p.tokens[id].name} token`); }
        }));
        logTo(code, `${me.name} untapped ${names.join(", ") || "nothing"} (${r.src})`);
        render(); break;
      }
      case "phase-in": phaseIn("by hand"); break;
      case "devo-go": {
        const r = reminders.find(x => x.id === b.dataset.id);
        if (!r?.devo) break;
        const col = b.dataset.c, n = r.devo[col];
        delete r.devo;
        r.mana = { syms: `{${col}}`, n }; r.text = ""; poolAdd(`{${col}}`.repeat(n), r.src); r.note = r.devoWhy ? r.devoWhy : `devotion to ${({ W: "white", U: "blue", B: "black", R: "red", G: "green" })[col]}: ${n}`;
        logTo(code, `${me.name} tapped ${r.src} for {${col}} × ${n} (${r.devoWhy || "devotion"})`);
        render(); break;
      }
      case "da-x": { const r = reminders.find(x => x.id === b.dataset.id); if (r?.dmgAll) { r.dmgAll = { ...r.dmgAll, x: Math.max(0, Number(document.getElementById(`dax-${r.id}`)?.value) || 0) }; render(); } break; }
      case "tx-go": {
        const r = reminders.find(x => x.id === b.dataset.id);
        if (!r) break;
        const toks = [...document.querySelectorAll(`.tx-tok[data-rid="${r.id}"]`)].map(x => [x.dataset.k, Math.max(0, Number(x.value) || 0)]).filter(([, n]) => n);
        const x = toks.reduce((a, [, n]) => a + n, 0);
        reminders = reminders.filter(y => y !== r);
        if (x) {
          mutate(p => toks.forEach(([k, n]) => { const t = p.tokens?.[k]; if (t) t.tapped = Math.min(t.count, (t.tapped || 0) + n); }));
          logTo(code, `${me.name} tapped ${x} token${x === 1 ? "" : "s"} for ${r.src}: ${x} mana`);
          reminders.push({ id: newId(), src: r.src, text: "", times: 1, anyColor: true, anyN: x });
        }
        render(); break;
      }
      case "altdraw": {
        const r = reminders.find(x => x.id === b.dataset.id), o = room.players?.[b.dataset.o];
        if (!r || !o) break;
        reminders = reminders.filter(x => x !== r);
        sendNote(b.dataset.o, { text: `Draw a card (${me.name} paid ${r.src}'s alternate cost).`, src: r.src });
        logTo(code, `${me.name}: ${r.src} (alternate cost) → ${o.name} draws a card`);
        render(); break;
      }
      case "kick-tog": { const r = reminders.find(x => x.id === b.dataset.id); if (r) { r.kicked = !r.kicked; render(); } break; }
      case "veil-go": {
        const r = reminders.find(x => x.id === b.dataset.id);
        if (!r?.veil) break;
        reminders = reminders.filter(x => x !== r);
        mutate(p => { p.ncTurn = room.turnNo || 0; p.hexFrom = { turnNo: room.turnNo || 0, colors: r.veil.hexFrom }; p.eot ||= {}; p.eot[`veil${Date.now().toString(36)}`] = { src: r.src, filter: { alts: [["permanent"]], controller: "any", mv: null }, perm: true, dp: 0, dt: 0, kws: r.veil.hexFrom.map(c => `hexproof from ${c}`), ids: Object.keys(me.bf || {}), toks: Object.keys(me.tokens || {}) }; });
        logTo(code, `🛡 ${me.name}'s ${r.src}: spells ${me.name} controls can't be countered this turn; ${me.name} and their permanents have hexproof from ${r.veil.hexFrom.join(" and ")}`);
        const COL = { white: "W", blue: "U", black: "B", red: "R", green: "G" };
        const hit = Object.values(room.casts || {}).some(c => c.by !== pid && (c.turnNo || 0) === (room.turnNo || 0) && r.veil.drawIf.some(col => new RegExp(COL[col] || "_").test(c.m || "")));
        if (hit) reminders.push({ id: newId(), src: r.src, text: "Draw a card (an opponent cast a " + r.veil.drawIf.join(" or ") + " spell this turn).", times: 1 });
        render(); break;
      }
      case "plumb-go": {
        const r = reminders.find(x => x.id === b.dataset.id);
        if (!r?.plumb) break;
        const ids = [...document.querySelectorAll(`.pl-box[data-rid="${r.id}"]:checked`)].map(x => x.value);
        const toks = [...document.querySelectorAll(`.pl-tok[data-rid="${r.id}"]`)].map(x => [x.dataset.k, Math.max(0, Number(x.value) || 0)]).filter(([, n]) => n);
        const n = ids.length + toks.reduce((a, [, k]) => a + k, 0);
        reminders = reminders.filter(x => x !== r);
        const gone = ids.map(id => [id, me.bf[id]]).filter(([, e]) => e);
        act([...gone.map(([id, e]) => ({ type: "sac", name: e.n, n: 1, token: false, creature: true })), ...(gone.length ? [{ type: "dies", n: gone.length, token: false, ids: gone.map(([id]) => id) }] : []),
          ...toks.flatMap(([k, c]) => [{ type: "sac", name: me.tokens[k].name, n: c, token: true, creature: true }, { type: "dies", n: c, token: true }])],
          p => { p.life = (p.life ?? START_LIFE) - (1 + n); toks.forEach(([k, c]) => { const t = p.tokens?.[k]; if (t) { t.count -= c; if (t.tapped > t.count) t.tapped = t.count; if (t.count <= 0) delete p.tokens[k]; } }); },
          p => gone.forEach(([id, e]) => { if (p.bf?.[id]) { delete p.bf[id]; toZone(p, e, "gy"); } }));
        logTo(code, `${me.name}: ${r.src} — sacrificed ${n} creature${n === 1 ? "" : "s"} → ${n} cop${n === 1 ? "y" : "ies"}; draws ${1 + n}, loses ${1 + n} life`);
        reminders.push({ id: newId(), src: r.src, text: `Draw ${1 + n === 1 ? "a card" : `${1 + n} cards`}.`, times: 1 });
        render(); break;
      }
      case "mx-go": {
        const r = reminders.find(x => x.id === b.dataset.id);
        if (!r?.minusX) break;
        const x = Math.max(0, Number(document.getElementById(`mx-${r.id}`)?.value) || 0);
        reminders = reminders.filter(y => y !== r);
        if (x) act([{ type: "effects", effs: [{ k: "pumpAll", everyone: true, other: false, dp: String(-x), dt: String(-x), kws: [], xCount: null }], times: 1, count: 1, src: r.src, srcId: r.srcId }]); else render();
        break;
      }
      case "bo-go": {
        const r = reminders.find(x => x.id === b.dataset.id), id = document.getElementById(`bo-${b.dataset.id}`)?.value, e = id && me.bf?.[id];
        if (!r || !e) break;
        reminders = reminders.filter(x => x !== r);
        act([], null, p => { delete p.bf[id]; });
        logTo(code, `↩ ${me.name}: ${dispName(e)} returned to hand (${r.src})`); toDigHand([e]);
        render(); break;
      }
      case "shock-pay": case "shock-tap": {
        const r = reminders.find(x => x.id === b.dataset.id), k = r?.shockLand;
        if (!k) break;
        reminders = reminders.filter(x => x !== r);
        if (b.dataset.a === "shock-pay") { if (!me.prot?.life) mutate(p => { p.life = (p.life ?? START_LIFE) - k.n; }); logTo(code, `${me.name} paid ${k.n} life: ${r.src} enters untapped`); }
        else { mutate(p => { if (p.bf?.[k.id]) p.bf[k.id].tap = true; }); logTo(code, `${me.name}'s ${r.src} entered tapped`); }
        render(); break;
      }
      case "dx-go": {
        const r = reminders.find(x => x.id === b.dataset.id);
        if (!r?.drainX) break;
        const x = Math.max(0, Number(document.getElementById(`dx-${r.id}`)?.value) || 0);
        reminders = reminders.filter(y => y !== r);
        const opps = opponents().filter(o => !isOut(o) && !o.prot?.life);
        if (x && opps.length) {
          act([{ type: "effects", effs: opps.map(o => ({ k: "tlose", n: x, target: o.id, targetName: o.name })), times: 1, count: 1, src: r.src, srcId: r.srcId }], p => { if (!me.prot?.life) p.life = (p.life ?? START_LIFE) + x * opps.length; });
          logTo(code, `🩸 ${me.name}'s ${r.src}: each opponent loses ${x}; ${me.name} gains ${x * opps.length}`);
        }
        render(); break;
      }
      case "spoil-go": {
        const r = reminders.find(x => x.id === b.dataset.id), o = room.players?.[b.dataset.o];
        if (!r?.spoil || !o) break;
        reminders = reminders.filter(x => x !== r);
        update(ref(db, `rooms/${code}/players/${b.dataset.o}/spoil`), { turnNo: room.turnNo || 0, pt: r.spoil.pt, src: r.src });
        logTo(code, `🥀 ${me.name}'s ${r.src}: ${o.name}'s creatures lose all abilities and are ${r.spoil.pt} until end of turn`);
        render(); break;
      }
      case "ns-go": {
        const r = reminders.find(x => x.id === b.dataset.id);
        if (!r?.necroSel) break;
        const v = document.getElementById(`ns-${r.id}`)?.value || "";
        reminders = reminders.filter(x => x !== r);
        const [oid, cid] = v.split("|"), taken = v && room.players?.[oid]?.bf?.[cid];
        const byOwner = {};
        seated(room).filter(o => !isOut(o)).forEach(o => { byOwner[o.id] = { all: true, filter: { alts: [["creature"]], controller: "any", mv: null } }; });
        sendOrders(byOwner, { how: "destroy", src: r.src, rider: "" });
        logTo(code, `💀 ${me.name}'s ${r.src}: all creatures destroyed`);
        const tStats = taken && combatStats(room.players[oid] && { ...room.players[oid], id: oid }, "bf", cid);
        if (taken && (tStats?.indestr || tStats?.regen)) logTo(code, `${r.src}: ${taken.n} didn't die (${tStats.indestr ? "indestructible" : "regenerated"}), so nothing comes back`);
        else if (taken) {
          const c = { ...(deckCard(taken.n) || lookupCard(taken.n) || taken), ...(r.necroSel.zombie ? { t: `${taken.t || "Creature"}${/Zombie/.test(taken.t || "") ? "" : " Zombie"}`, m: /B/.test(taken.m || "") ? taken.m : `${taken.m || ""}{B}` } : {}) };
          setTimeout(() => {
            if (oid === pid) { const g = Object.entries(me.gy || {}).find(([, x]) => x.n === taken.n); playCard(c, { via: r.src, ...(g ? { fromZone: { z: "gy", id: g[0] } } : {}) }); }
            else { sendOrders({ [oid]: {} }, { how: "gyTake", name: taken.n, src: r.src }); const o = room.players[oid]; playCard(c, { via: r.src, own: { id: oid, name: o.name, color: o.color } }); }
            logTo(code, `🧟 ${me.name} returned ${taken.n} to the battlefield under their control${r.necroSel.zombie ? " (a black Zombie too)" : ""}`);
          }, 60);
        }
        render(); break;
      }
      case "tlx-go": case "ol-go": {
        const r = reminders.find(x => x.id === b.dataset.id), o = room.players?.[b.dataset.o];
        if (!r || !o) break;
        const n = r.oppLose ? r.oppLose.n : r.tloseX === true ? Math.max(0, Number(document.getElementById(`tlx-${r.id}`)?.value) || 0) : r.tloseX;
        reminders = reminders.filter(x => x !== r);
        if (n > 0) {
          if (b.dataset.o === pid) { if (!me.prot?.life) mutate(p => { p.life = (p.life ?? START_LIFE) - n; }); logTo(code, `${r.src}: ${me.name} loses ${n} life`); }
          else act([{ type: "effects", effs: [{ k: "tlose", n, target: b.dataset.o, targetName: o.name }], times: 1, count: 1, src: r.src, srcId: r.srcId }]);
        }
        render(); break;
      }
      case "dd2-go": {
        const r = reminders.find(x => x.id === b.dataset.id);
        if (!r) break;
        reminders = reminders.filter(x => x !== r);
        const n = devotion(me)[r.drainDevo] || 0, opps = opponents().filter(o => !isOut(o) && !o.prot?.life);
        if (n && opps.length) { act([{ type: "effects", effs: opps.map(o => ({ k: "tlose", n, target: o.id, targetName: o.name })), times: 1, count: 1, src: r.src, srcId: r.srcId }], p => { if (!me.prot?.life) p.life = (p.life ?? START_LIFE) + n * opps.length; }); logTo(code, `🩸 ${me.name}'s ${r.src}: devotion ${n} — each opponent loses ${n}; ${me.name} gains ${n * opps.length}`); }
        render(); break;
      }
      case "cc-go": {
        const r = reminders.find(x => x.id === b.dataset.id), v = document.getElementById(`cc-${b.dataset.id}`)?.value;
        if (!r || !v) break;
        reminders = reminders.filter(x => x !== r);
        const [oid, id] = v.split("|");
        sendOrders({ [oid]: {} }, { how: "ctrClear", id, src: r.src });
        render(); break;
      }
      case "mir-go": {
        const r = reminders.find(x => x.id === b.dataset.id), v = document.getElementById(`mir-${b.dataset.id}`)?.value;
        if (!r || !v) break;
        const [oid, cid] = v.split("|"), src = room.players?.[oid]?.bf?.[cid], full = src && (lookupCard(src.n) || src);
        if (!src || !me.bf?.[r.mirrorPick]) break;
        reminders = reminders.filter(x => x !== r);
        const t = room.turnNo || 0;
        mutate(p => { const x = p.bf?.[r.mirrorPick]; if (!x) return; x.mirror = { n: x.n, t: x.t, m: x.m, o: x.o, p: x.p, tg: x.tg, img: x.img, turn: t }; Object.assign(x, { n: src.n, t: src.t || full.t, m: src.m || full.m || "", o: src.o || full.o || "", p: src.p ?? full.p, tg: src.tg ?? full.tg, img: src.img || full.img || "", haste: r.src }); });
        logTo(code, `🪞 ${me.name}'s ${r.src} is a copy of ${dispName(src)} until end of turn (with haste)`);
        render(); break;
      }
      case "arc-go": {
        const r = reminders.find(x => x.id === b.dataset.id), v = document.getElementById(`arc-${b.dataset.id}`)?.value;
        if (!r || !v) break;
        reminders = reminders.filter(x => x !== r);
        const [oid, id] = v.split("|");
        if (oid === pid) { sacrificeChosen([`bf|${id}`], r.src); reminders.push({ id: newId(), src: r.src, text: "Search your library", fetch: searchOf("Search your library for a noncreature artifact card, put it onto the battlefield, then shuffle."), left: 1, times: 1, note: "Optional." }); }
        else { sendOrders({ [oid]: {} }, { how: "arcum", id, src: r.src }); logTo(code, `${me.name}'s ${r.src}: ${room.players?.[oid]?.name} sacrifices ${dispName(room.players?.[oid]?.bf?.[id] || {})}`); }
        render(); break;
      }
      case "tn-go": {
        const r = reminders.find(x => x.id === b.dataset.id), k = r?.tapNPick;
        if (!k) break;
        const ids = [...document.querySelectorAll(`.tn-box[data-rid="${r.id}"]:checked`)].map(x => x.value), tk = {};
        document.querySelectorAll(`.tn-tok[data-rid="${r.id}"]`).forEach(x => { const n = Math.max(0, Number(x.value) || 0); if (n) tk[x.dataset.k] = n; });
        if (ids.length + Object.values(tk).reduce((a, n) => a + n, 0) !== k.n) { toast(`Pick exactly ${k.n}.`); break; }
        reminders = reminders.filter(x => x !== r);
        act(ids.map(x => ({ type: "tapped", id: x })), p => { ids.forEach(x => { if (p.bf?.[x]) p.bf[x].tap = true; }); Object.entries(tk).forEach(([kk, n]) => { const t = p.tokens?.[kk]; if (t) t.tapped = Math.min(t.count, (t.tapped || 0) + n); }); });
        logTo(code, `${me.name} tapped ${[...ids.map(x => dispName(me.bf[x] || {})), ...Object.entries(tk).map(([kk, n]) => `${n} ${me.tokens?.[kk]?.name}`)].join(", ")} for ${r.src}'s cost`);
        setTimeout(() => activate(k.id, k.i, { tapNDone: true }), 0);
        break;
      }
      case "at-go": {
        const r = reminders.find(x => x.id === b.dataset.id), f = r?.addType, v = document.getElementById(`at-${b.dataset.id}`)?.value;
        if (!f || !v) break;
        reminders = reminders.filter(x => x !== r);
        const [oid, tid] = v.split("|");
        if (oid === pid) addTypeMine(tid, f.type, r.src);
        else { sendOrders({ [oid]: {} }, { how: "addType", id: tid, type: f.type, src: r.src }); logTo(code, `${me.name}'s ${r.src}: ${room.players?.[oid]?.name}'s ${dispName(room.players?.[oid]?.bf?.[tid] || {})} is ${/^[aeiou]/i.test(f.type) ? "an" : "a"} ${f.type.toLowerCase()} until end of turn`); }
        render(); break;
      }
      case "reb-go": {
        const r = reminders.find(x => x.id === b.dataset.id), x = r && me.ex?.[r.rebound];
        reminders = reminders.filter(y => y !== r);
        if (!x) { render(); break; }
        logTo(code, `↺ ${me.name} cast ${dispName(x)} from exile (rebound)`);
        playCard(zoneCard(x), { fromZone: { z: "ex", id: r.rebound } });
        break;
      }
      case "flip-go": {
        const r = reminders.find(x => x.id === b.dataset.id); if (!r?.flipFace) break;
        reminders = reminders.filter(x => x !== r);
        flipFace(r.flipFace.id || r.srcId, r.flipFace.reenter, r.flipFace.front, r.src);
        render(); break;
      }
      case "faceup": { turnFaceUp(b.dataset.id); break; }
      case "ewc-go": { const r = reminders.find(x => x.id === b.dataset.id); if (!r?.ewc) break; reminders = reminders.filter(x => x !== r); const { id, n } = r.ewc;
        if (me.bf?.[id]) { mutate(p => { const x = p.bf?.[id]; if (x) { x.c ||= {}; x.c.p1p1 = (x.c.p1p1 || 0) + n; } }); logTo(code, `⚙ ${r.src} entered with ${n} +1/+1 counter${n === 1 ? "" : "s"}`); } render(); break; }
      case "dig-open": { if (!dig?.on || dig.deckId !== lib.active) { digNew(7); logTo(code, `🂠 ${me.name} shuffled their digital deck and drew 7`); } else dig.on = true; digSave(); tab = "hand"; store.set("mtga_tab", tab); applyTab(); renderHand(); renderDeck(); break; }
      case "dig-off": { dig = null; store.del(`mtga_dig_${code}`); tab = "deck"; applyTab(); renderDeck(); break; }
      case "dig-new": { digNew(7); logTo(code, `🂠 ${me.name} started a new digital game: shuffled and drew 7`); renderHand(); break; }
      case "dig-mulligan": { if (!dig) break; const m = (dig.mullN || 0) + 1, bot = mullRule === "free" ? 0 : m - 1; // official Commander: first mulligan free, then 1, 2…
        dig.lib = digShuffle([...dig.lib, ...dig.hand]); dig.hand = []; digDraw(7); dig.mullN = m; dig.mull = bot; digSave();
        logTo(code, `🂠 ${me.name} mulliganed${bot ? ` (putting ${bot} on the bottom)` : " (new 7)"}`); renderHand(); break; }
      case "dig-firstdraw": { store.set("mtga_firstdraw", b.dataset.v === "on" ? "on" : "off"); renderHand(); break; }
      case "dig-mullrule": { mullRule = b.dataset.r === "official" ? "official" : "free"; store.set("mtga_mullrule", mullRule); renderHand(); break; }
      case "dig-draw": { broadcastDraw(1, "", true); renderHand(); break; }
      case "dig-drawbot": { const k = digDraw(1, true); if (k) broadcastDraw(1, "from the bottom", true, true); renderHand(); break; }
      case "dig-shuffle": { if (!dig) break; digShuffle(dig.lib); digSave(); logTo(code, `🔀 ${me.name} shuffled their library`); renderHand(); break; }
      case "dig-peek": { if (!dig) break; const n = Math.max(1, Math.min(20, Number(prompt("Look at how many cards from the top?", "3")) || 0)); if (!n) break; dig.peek = n; digSave(); renderHand(); break; }
      case "dig-peek-done": { if (!dig) break; dig.peek = 0; digSave(); renderHand(); break; }
      case "dig-pk-bot": case "dig-pk-hand": case "dig-pk-gy": { if (!dig) break; const i = Number(b.dataset.i), [n] = dig.lib.splice(i, 1); if (!n) break;
        if (a === "dig-pk-bot") dig.lib.push(n); else if (a === "dig-pk-hand") dig.hand.push(n); else { const c = deckCard(n) || lookupCard(n) || { n }; mutate(p => toZone(p, { n: c.n, t: c.t || "", m: c.m || "", ...(c.o ? { o: c.o } : {}) }, "gy")); logTo(code, `🗑 ${me.name} put ${n} into their graveyard from the library`); }
        dig.peek = Math.max(0, dig.peek - 1); digSave(); renderHand(); break; } // a card moved away: don't reveal a new one
      case "dig-pk-top": { if (!dig) break; const i = Number(b.dataset.i), [n] = dig.lib.splice(i, 1); if (n) dig.lib.unshift(n); digSave(); renderHand(); break; }
      case "dig-mill": { if (!dig?.lib.length) break; const n = dig.lib.shift(), c = deckCard(n) || lookupCard(n) || { n }; mutate(p => toZone(p, { n: c.n, t: c.t || "", m: c.m || "", ...(c.o ? { o: c.o } : {}) }, "gy")); logTo(code, `${me.name} milled ${n}`); digSave(); renderHand(); break; }
      case "dig-play": { if (!dig) break; const i = Number(b.dataset.i), n = dig.hand[i], c = n && (deckCard(n) || lookupCard(n)); if (!c) { toast("Card not found."); break; } if (!okToCast(c)) break; dig.hand.splice(i, 1); dig.mull = 0; digSave(); playCard(c); renderHand(); break; }
      case "dig-keep": { if (!dig) break; dig.mull = 0; digSave(); renderHand(); break; }
      case "dig-top": case "dig-bot": { if (!dig) break; const i = Number(b.dataset.i), [n] = dig.hand.splice(i, 1); if (!n) break; if (a === "dig-top") dig.lib.unshift(n); else { dig.lib.push(n); if (dig.mull > 0) dig.mull -= 1; } digSave(); renderHand(); break; }
      case "dig-disc": { if (!dig) break; const i = Number(b.dataset.i), [n] = dig.hand.splice(i, 1); const c = n && (deckCard(n) || lookupCard(n) || { n }); if (c) discardFromHand(c); logTo(code, `${me.name} discarded ${n}`); digSave(); renderHand(); break; }
      case "dig-tutor": case "dig-tutor-bf": { if (!dig) break; const n = b.dataset.n, i = dig.lib.indexOf(n); if (i < 0) break; dig.lib.splice(i, 1); digShuffle(dig.lib);
        if (a === "dig-tutor") { dig.hand.push(n); logTo(code, `🔎 ${me.name} searched their library for a card and shuffled`); } else { const c = deckCard(n) || lookupCard(n); if (c) playCard(c, { via: "search" }); logTo(code, `🔎 ${me.name} put ${n} onto the battlefield from their library`); }
        const qi = document.getElementById("digQ"); if (qi) qi.value = ""; digSave(); renderHand(); break; }
      case "dig-wheel": case "dig-drawn": { if (!dig?.on) break; const k = Number(b.dataset.k) || 0, src = (b.dataset.id && reminders.find(x => x.id === b.dataset.id)?.src) || room.notes?.[pid]?.[b.dataset.nt]?.src || "";
        if (a === "dig-wheel") { const hand = [...dig.hand]; dig.hand = []; digSave(); hand.forEach(nm => discardFromHand(deckCard(nm) || lookupCard(nm) || { n: nm })); logTo(code, `🗑 ${me.name} discarded their hand (${hand.length})${src ? ` for ${src}` : ""}`);
          if (b.dataset.id) reminders = reminders.filter(x => x.id !== b.dataset.id); if (b.dataset.nt) update(ref(db, `rooms/${code}/notes/${pid}`), { [b.dataset.nt]: null }); }
        digDone.add(b.dataset.key); broadcastDraw(k, src); renderHand(); render(); break; }
      case "dig-disc-x": { if (!dig?.on || !dig.hand.length) break; const i = b.dataset.v === "rand" ? Math.floor(Math.random() * dig.hand.length) : Number(document.getElementById(`ddc-${b.dataset.key.replace(/:\w+$/, "")}`)?.value); const [nm] = dig.hand.splice(i, 1); if (!nm) break;
        digSave(); discardFromHand(deckCard(nm) || lookupCard(nm) || { n: nm }); logTo(code, `🗑 ${me.name} discarded ${nm}${b.dataset.v === "rand" ? " (at random)" : ""}`); if (b.dataset.v === "rand") digDone.add(b.dataset.key); renderHand(); render(); break; }
      case "dig-gybot": { if (!dig?.on) break; const names = digShuffle(Object.values(me.gy || {}).map(c => c.n)); act([], p => { p.gy = null; }); dig.lib.push(...names); digSave(); digDone.add(b.dataset.key); logTo(code, `${me.name} put their graveyard (${names.length}) on the bottom of their library`); renderHand(); render(); break; }
      case "base-go": { const r = reminders.find(x => x.id === b.dataset.id); if (!r) break; applyBaseSet(r); reminders = reminders.filter(x => x !== r); render(); break; }
      case "dc-go": { const r = reminders.find(x => x.id === b.dataset.id); if (!r || !dig?.on) break; const want = document.getElementById(`dcn-${r.id}`)?.value || "";
        const gone = dig.lib.splice(0, 6); let found = null; while (dig.lib.length) { const n = dig.lib.shift(); if (want && n === want) { found = n; break; } gone.push(n); }
        exileNames(gone); if (found) dig.hand.push(found); digSave(); reminders = reminders.filter(x => x !== r);
        logTo(code, `${me.name}'s ${r.src}: named ${want || "a card not in the library"} → exiled ${gone.length}${found ? `, ${found} → hand` : ""}${dig.lib.length ? "" : " · library is empty"}`);
        if (!dig.lib.length) toast("Your library is empty: Thassa's Oracle (or Jace) wins now."); renderHand(); render(); break; }
      case "tp-step": { const r = reminders.find(x => x.id === b.dataset.id); if (!r || !dig?.on) break; if (!dig.lib.length) { toast("Your library is empty."); break; } const n = dig.lib.shift(); (r.tpEx ||= []).push(n); exileNames([n]); digSave(); renderHand(); render(); break; }
      case "tp-all": { const r = reminders.find(x => x.id === b.dataset.id); if (!r || !dig?.on) break; const ex = (r.tpEx ||= []), out = []; while (dig.lib.length) { const n = dig.lib.shift(); out.push(n); const d = ex.includes(n); ex.push(n); if (d) break; } exileNames(out); digSave();
        logTo(code, `${me.name}'s ${r.src}: exiled ${ex.length} card${ex.length === 1 ? "" : "s"}, took nothing${dig.lib.length ? "" : " · library is empty"}`); if (!dig.lib.length) toast("Your library is empty: Thassa's Oracle (or Jace) wins now."); reminders = reminders.filter(x => x !== r); renderHand(); render(); break; }
      case "tp-take": { const r = reminders.find(x => x.id === b.dataset.id); if (!r?.tpEx?.length) break; const n = r.tpEx.at(-1);
        act([], p => { const e = Object.entries(p.ex || {}).filter(([, c]) => c.n === n).at(-1); if (e) delete p.ex[e[0]]; }); dig.hand.push(n); digSave(); logTo(code, `${me.name}'s ${r.src}: took ${n} (exiled ${r.tpEx.length - 1})`); reminders = reminders.filter(x => x !== r); renderHand(); render(); break; }
      case "tp-done": reminders = reminders.filter(x => x.id !== b.dataset.id); render(); break;
      case "syl-go": { if (!dig?.on) break; const key = b.dataset.key, nm = document.getElementById(`syl-${key}`)?.value; if (!nm) break; sylvN.set(key, (sylvN.get(key) || 0) + 1);
        const tn = room?.turnNo ?? 0; if (dig.dtTurn === tn) { const j = (dig.dtList || []).lastIndexOf(nm); if (j >= 0) dig.dtList.splice(j, 1); }
        if (b.dataset.v === "life") { mutate(p => { p.life = (p.life ?? START_LIFE) - 4; }); logTo(code, `${me.name} paid 4 life to keep a card (Sylvan Library)`); }
        else { const j = dig.hand.lastIndexOf(nm); if (j >= 0) { dig.hand.splice(j, 1); dig.lib.unshift(nm); } logTo(code, `${me.name} put a card back on top (Sylvan Library)`); }
        digSave(); renderHand(); render(); break; }
      case "dig-look": { if (!dig?.on) break; dig.peek = Number(b.dataset.k) || 1; digDone.add(b.dataset.key); digSave(); tab = "hand"; store.set("mtga_tab", tab); applyTab(); renderHand(); render(); break; }
      case "dig-gytop": { if (!dig?.on) break; const gid = document.getElementById(`dgt-${b.dataset.key.replace(/:\w+$/, "")}`)?.value, c = gid && me.gy?.[gid]; if (!c) break;
        act([], p => { if (p.gy?.[gid]) delete p.gy[gid]; }); dig.lib.unshift(c.n); digSave(); digDone.add(b.dataset.key); logTo(code, `⤒ ${me.name} put ${dispName(c)} from their graveyard on top of their library`); renderHand(); render(); break; }
      case "dig-view": { const i = Number(b.dataset.i); digOpenI = digOpenI === i ? -1 : i; renderHand(); if (digOpenI >= 0) setTimeout(() => document.querySelector(".hcard.open")?.scrollIntoView?.({ block: "nearest", behavior: "smooth" }), 30); break; }
      case "blocked": { // Bushido N, or "whenever this creature blocks or becomes blocked"
        const id = b.dataset.id, e = me.bf?.[id]; if (!e) break; const o = String(e.o || lookupCard(e.n)?.o || ""), bu = o.match(/^Bushido (\d+)/m), bt = o.match(/^whenever this creature (?:blocks or )?becomes blocked, ([^\n]+)/im), af = o.match(/^Afflict (\d+)/m);
        if (af) reminders.push({ id: newId(), src: `${dispName(e)} (afflict)`, srcId: id, text: `The defending player loses ${af[1]} life.`, times: 1, effs: [{ k: "tlose", n: Number(af[1]), who: "opponent" }] }); // Afflict N: when it becomes blocked
        if (bu) act([{ type: "effects", effs: [{ k: "pumpOn", target: { kind: "bf", id }, dp: Number(bu[1]), dt: Number(bu[1]), kws: [] }], times: 1, count: 1, src: `${dispName(e)} (bushido)`, srcId: id }]);
        if (bt) { const sp = spellAbility({ n: `${e.n} · blocks`, t: "Instant", o: bt[1] }); reminders.push(normalizeRem({ id: newId(), src: dispName(e), srcId: id, text: bt[1].replace(/^\w/, c => c.toUpperCase()), times: 1, ...(sp.effs.length ? { effs: sp.effs } : {}) })); }
        logTo(code, `🛡 ${me.name}'s ${dispName(e)} ${bu ? `blocked or became blocked (bushido +${bu[1]}/+${bu[1]})` : af ? "became blocked" : "blocked or became blocked"}`); render(); break;
      }
      case "fd-make": { const r = reminders.find(x => x.id === b.dataset.id); const cl = /\bcloak/i.test(r?.text || ""); playFaceDown({ how: cl ? "cloak" : "manifest" }); break; }
      case "dn-toggle": { const nx = room.dn === "night" ? "day" : "night"; update(ref(db, `rooms/${code}`), { dn: nx }); logTo(code, `${nx === "night" ? "🌙 It becomes night" : "☀ It becomes day"} (set by ${me.name})`); break; }
      case "flip-man": { flipFace(b.dataset.id, false, false, "transform"); render(); break; }
      case "bk-go": {
        const r = reminders.find(x => x.id === b.dataset.id), id = document.getElementById(`bk-${b.dataset.id}`)?.value, e = me.bf?.[id];
        if (!r || !e) break;
        reminders = reminders.filter(x => x !== r);
        const c = zoneCard(e);
        if (/\bCreature\b/.test(e.t || "")) { leaveHooks([id], "leave"); counterLeave(e); }
        if (r.retDelay) { reminders = reminders.filter(x => x !== r); act([], p => { const x = p.bf?.[id]; if (!x) return; detachIn(p, id); p.ex ||= {}; p.ex[id] = { n: x.n, t: x.t || "", m: x.m || "", img: x.img || "", ...(x.o ? { o: x.o } : {}), retEnd: true, src: r.src, at: Date.now() }; delete p.bf[id]; }); logTo(code, `✨ ${me.name}'s ${r.src}: ${dispName(e)} exiled until the next end step`); render(); break; }
        act([], p => { detachIn(p, id); Object.entries(p.bf || {}).forEach(([sid, a]) => { if (a.att === id) delete a.att; }); delete p.bf[id]; });
        logTo(code, `✨ ${me.name}'s ${r.src}: ${dispName(e)} blinked (exiled and returned)`);
        setTimeout(() => playCard(c, { via: r.src }), 0);
        break;
      }
      case "ct-go": {
        const r = reminders.find(x => x.id === b.dataset.id), v = document.getElementById(`ct-${b.dataset.id}`)?.value || "";
        if (!r || !v) break;
        if (v.startsWith("r:")) {
          const t = reminders.find(x => x.id === v.slice(2)); if (!t) break;
          reminders = reminders.filter(x => x !== r);
          reminders.push({ ...clone(t), id: newId(), src: `${t.src} (copy)` });
          logTo(code, `${me.name}'s ${r.src} copied ${t.src}'s triggered ability`);
          render(); break;
        }
        const x = recentTrig.filter(y => y.turn === (room.turnNo || 0))[Number(v.slice(2))]; if (!x) break;
        reminders = reminders.filter(y => y !== r);
        logTo(code, `${me.name}'s ${r.src} copied ${x.src}'s triggered ability`);
        act([{ type: "effects", effs: x.effs, times: 1, count: x.count || 1, src: `${x.src} (copy)`, srcId: x.srcId, ...(x.evN != null ? { n: x.evN } : {}) }], null, null, { noTrack: true });
        break;
      }
      case "an-go": {
        const r = reminders.find(x => x.id === b.dataset.id), f = r?.animate, v = document.getElementById(`an-${b.dataset.id}`)?.value;
        if (!f || !v) break;
        reminders = reminders.filter(x => x !== r);
        const [oid, tid] = v.split("|");
        if (oid === pid) animateMine(tid, f.p, f.tg, r.src); else sendOrders({ [oid]: {} }, { how: "animate", id: tid, p: f.p, tg: f.tg, src: r.src });
        render(); break;
      }
      case "mz-go": {
        const r = reminders.find(x => x.id === b.dataset.id), v = document.getElementById(`mz-${b.dataset.id}`)?.value;
        if (!r || !v) break;
        reminders = reminders.filter(x => x !== r);
        const [oid, tid] = v.split("|"), o = room.players?.[oid], e = o?.bf?.[tid];
        if (oid === pid) { if (me.bf?.[tid]?.tap) toggleTap(tid); } else sendOrders({ [oid]: {} }, { how: "untapOne", kind: "bf", id: tid, src: r.src });
        const t = room.turnNo || 0, list = room.maze?.turnNo === t ? room.maze.list || [] : [];
        update(ref(db, `rooms/${code}`), { maze: { turnNo: t, list: [...list, { oid, name: e?.n || "" }] } });
        logTo(code, `🌀 ${me.name}'s ${r.src}: ${o?.name}'s ${dispName(e || {})} untapped; combat damage to and by it is prevented this turn`);
        render(); break;
      }
      case "ed-go": {
        const r = reminders.find(x => x.id === b.dataset.id), f = r?.eachDraw;
        if (!f) break;
        const n = f.n === "X" ? Math.max(0, Number(document.getElementById(`ed-${r.id}`)?.value) || 0) : f.n;
        if (f.n === "X" && document.getElementById(`ed-${r.id}`)?.value === "") { toast("Enter X."); break; }
        reminders = reminders.filter(x => x !== r);
        if (n > 0) { broadcastDraw(n, r.src); seated(room).filter(o => o.id !== pid && !isOut(o)).forEach(o => sendNote(o.id, { text: `Draw ${n === 1 ? "a card" : `${n} cards`}.`, src: r.src })); }
        render(); break;
      }
      case "hand-set": {
        const e = me.bf?.[b.dataset.id]; if (!e) break;
        const v = prompt("How many cards are in your hand?", String(e.handN ?? 0)); if (v == null) break;
        mutate(p => { if (p.bf?.[b.dataset.id]) p.bf[b.dataset.id].handN = Math.max(0, Number(v) || 0); });
        break;
      }
      case "citadel": {
        const e = me.bf?.[b.dataset.id]; if (!e) break;
        reminders.push(normalizeRem(b.dataset.k === "nc" ? { id: newId(), src: dispName(e), text: "Cast a noncreature spell from the top of your library (you may cast it as though it had flash).", times: 1, citadel: { nc: true } }
          : { id: newId(), src: dispName(e), text: "Play the top card of your library: a land, or a spell paying life equal to its mana value.", times: 1, citadel: true }));
        render(); break;
      }
      case "dd-blink": {
        const e = me.bf?.[b.dataset.id]; if (!e) break;
        reminders.push(normalizeRem({ id: newId(), src: dispName(e), srcId: b.dataset.id, text: "{1}{U}: Exile this creature (or the creature it's paired with), then return it to the battlefield.", times: 1, blink: true }));
        render(); break;
      }
      case "relic": {
        const e = me.bf?.[b.dataset.id]; if (!e) break;
        const what = ((e.o || lookupCard(e.n)?.o || "").match(/^tap an untapped ([a-z ]+?) you control:/im) || [])[1] || "creature";
        const list = Object.entries(me.bf || {}).filter(([id, x]) => !x.tap && id !== b.dataset.id && permanentMatches(x, parseTargetFilter(what)));
        if (!list.length) { toast(`No untapped ${what} to tap.`); break; }
        reminders.push({ id: newId(), src: dispName(e), text: `Tap an untapped ${what} you control: add one mana of any color.`, times: 1, relicPick: list.map(([id, x]) => [id, dispName(x)]) });
        render(); break;
      }
      case "relic-go": {
        const r = reminders.find(x => x.id === b.dataset.id), id = document.getElementById(`rl-${b.dataset.id}`)?.value;
        if (!r || !me.bf?.[id]) break;
        reminders = reminders.filter(x => x !== r);
        mutate(p => { if (p.bf?.[id]) p.bf[id].tap = true; });
        logTo(code, `${me.name} tapped ${dispName(me.bf[id])} for ${r.src}`);
        reminders.push({ id: newId(), src: r.src, text: "Add one mana of any color.", times: 1, anyColor: true, anyN: 1 });
        render(); break;
      }
      case "vivi": {
        const e = me.bf?.[b.dataset.id]; if (!e) break;
        if (room.turn && room.turn !== pid) { toast(`${dispName(e)}: only during your turn.`); break; }
        if (e.viviTurn === (room.turnNo || 0) && !confirm(`${dispName(e)}: already used this turn. Use it anyway?`)) break;
        const x = Math.max(0, Number(ptOf(e, countsFor(me), pid, b.dataset.id).split("/")[0]) || 0);
        if (!x) { toast(`${dispName(e)} has 0 power.`); break; }
        const v = prompt(`${dispName(e)}: X = ${x}. How many ${b.dataset.s1}? (the rest are ${b.dataset.s2})`, String(x)); if (v == null) break;
        const a = Math.max(0, Math.min(x, Math.floor(Number(v) || 0)));
        mutate(p => { if (p.bf?.[b.dataset.id]) p.bf[b.dataset.id].viviTurn = room.turnNo || 0; });
        poolAdd(b.dataset.s1.repeat(a) + b.dataset.s2.repeat(x - a), dispName(e));
        logTo(code, `${me.name}'s ${dispName(e)}: added ${b.dataset.s1.repeat(a)}${b.dataset.s2.repeat(x - a)}`);
        render(); break;
      }
      case "cit-go": {
        const r = reminders.find(x => x.id === b.dataset.id), c = deck?.cards?.[Number(document.getElementById(`cit-${b.dataset.id}`)?.value)];
        if (!r || !c) break;
        reminders = reminders.filter(x => x !== r);
        const land = /\bLand\b/.test(c.t || "") && !/\/\//.test(c.n), mv = land || r.citadel?.nc ? 0 : manaValue(c.m || "");
        if (mv && !me.prot?.life) mutate(p => { p.life = (p.life ?? START_LIFE) - mv; });
        logTo(code, `📚 ${me.name} ${land ? "played" : "cast"} ${dispName(c)} from the top of their library${mv ? ` (paid ${mv} life, ${r.src})` : ` (${r.src})`}`);
        playCard(c);
        break;
      }
      case "il-go": {
        const r = reminders.find(x => x.id === b.dataset.id), v = document.getElementById(`il-${b.dataset.id}`)?.value;
        if (!r || !v) break;
        reminders = reminders.filter(x => x !== r);
        if (r.srcId && me.bf?.[r.srcId]) mutate(p => { p.bf[r.srcId].imprint = v; });
        logTo(code, `${me.name}'s ${r.src} exiled ${v} from their library (imprint)`);
        render(); break;
      }
      case "sn-go": {
        const r = reminders.find(x => x.id === b.dataset.id), k = r?.sacNPick;
        if (!k) break;
        const vals = [...document.querySelectorAll(`.sn-box[data-rid="${r.id}"]:checked`)].map(x => x.value);
        document.querySelectorAll(`.sn-tok[data-rid="${r.id}"]`).forEach(x => { const n = Math.min(me.tokens?.[x.dataset.k]?.count || 0, Math.max(0, Number(x.value) || 0)); for (let j = 0; j < n; j++) vals.push(`tok|${x.dataset.k}`); });
        if (vals.length !== k.n) { toast(`Pick exactly ${k.n}.`); break; }
        reminders = reminders.filter(x => x !== r);
        sacrificeChosen(vals, r.src);
        if (k.id) setTimeout(() => activate(k.id, k.i, { sacNDone: true }), 0);
        break;
      }
      case "rv-go": {
        const r = reminders.find(x => x.id === b.dataset.id);
        if (!r?.revealMv) break;
        const dTop = dig?.on && dig.lib.length ? dig.lib.shift() : null; // digital deck: it's simply the top card
        if (dTop) { dig.hand.push(dTop); digSave(); setTimeout(() => { try { renderHand(); } catch {} }, 0); }
        const cv = document.getElementById(`rv-c-${r.id}`)?.value, c = dTop ? (deckCard(dTop) || lookupCard(dTop) || { n: dTop, m: "" }) : cv ? deck?.cards?.[Number(cv)] : null, xs = dTop ? "" : document.getElementById(`rv-x-${r.id}`)?.value;
        if (!c && xs === "") { toast("Pick the card or enter its mana value."); break; }
        const mv = xs !== "" ? Math.max(0, Number(xs) || 0) : manaValue(c.m || "");
        reminders = reminders.filter(x => x !== r);
        logTo(code, `${me.name} revealed ${c ? dispName(c) : "a card"} (MV ${mv}) and put it into their hand (${r.src})`);
        if (mv > 0) {
          if (r.revealMv === "lose") { if (!me.prot?.life) mutate(p => { p.life = (p.life ?? START_LIFE) - mv; }); logTo(code, `${me.name} lost ${mv} life (${r.src})`); }
          else act([{ type: "effects", effs: [{ k: "drain", n: mv }, { k: "gain", n: mv }], times: 1, count: 1, src: r.src, srcId: r.srcId }]);
        }
        render(); break;
      }
      case "gyd-go": {
        const r = reminders.find(x => x.id === b.dataset.id), g = r?.gyDrain;
        if (!g) break;
        reminders = reminders.filter(x => x !== r);
        const n = g.n * g.k, o = room.players?.[g.who];
        act([{ type: "effects", effs: [{ k: "tlose", n, target: g.who, targetName: o?.name }, { k: "gain", n }], times: 1, count: 1, src: r.src, srcId: r.srcId }]);
        break;
      }
      case "combo-go": { const c = myCombos().find(x => x.key === b.dataset.k); if (c) runCombo(c, b.dataset.o); break; }
      case "vic-go": {
        const r = reminders.find(x => x.id === b.dataset.id), f = r?.victimize, sv = document.getElementById(`vic-s-${b.dataset.id}`)?.value;
        if (!f || !sv) break;
        const picks = [...document.querySelectorAll(`.vic-box[data-rid="${r.id}"]:checked`)].map(x => x.value);
        if (picks.length > f.n) { toast(`Choose at most ${f.n}.`); break; }
        const cards = picks.map(id => [id, me.gy?.[id]]).filter(([, c]) => c);
        reminders = reminders.filter(x => x.id !== r.id);
        sacrificeChosen([sv], r.src);
        cards.forEach(([id, c]) => playCard(zoneCard(c), { fromZone: { z: "gy", id }, via: r.src, tapped: f.tapped }));
        if (cards.length) logTo(code, `${me.name} returned ${cards.map(([, c]) => dispName(c)).join(", ")} to the battlefield${f.tapped ? " tapped" : ""} (${r.src})`);
        render(); break;
      }
      case "ext-go": {
        const r = reminders.find(x => x.id === b.dataset.id), n = Number(b.dataset.n) || 1;
        if (!r) break;
        reminders = reminders.filter(x => x !== r);
        act([{ type: "effects", effs: [{ k: "drain", n }, { k: "gain", n }], times: 1, count: 1, src: r.src }]);
        break;
      }
      case "bla-yes": case "bla-no": {
        const r = reminders.find(x => x.id === b.dataset.id);
        if (!r) break;
        reminders = reminders.filter(x => x !== r);
        if (b.dataset.a === "bla-yes") { bloodSkip += r.bloodAsk; mutate(p => { p.life = (p.life ?? START_LIFE) - r.bloodAsk; }); logTo(code, `🩸 ${r.src}: ${me.name} loses ${r.bloodAsk} more`); }
        else { const t = room.turnNo || 0; if (me.lifeLost?.t === t) mutate(p => { p.lifeLost.n = Math.max(0, (p.lifeLost.n || 0) - 0); }, true); render(); }
        break;
      }
      case "rv-back": case "rv-keep": {
        const r = reminders.find(x => x.id === b.dataset.id); if (!r?.revertKey) break;
        reminders = reminders.filter(x => x !== r);
        const sv = orderSnaps.get(r.revertKey);
        if (b.dataset.a === "rv-back" && sv) { orderSnaps.delete(r.revertKey); logTo(code, `↩ ${me.name}'s board put back (${r.src})`); mutate(p => revertParts(p, sv.snap, sv.after || clone(me))); }
        else render();
        break;
      }
      case "ca-yes": case "ca-no": {
        const r = reminders.find(x => x.id === b.dataset.id), a = r?.ctrAsk;
        if (!a) break;
        reminders = reminders.filter(x => x !== r);
        if (b.dataset.a === "ca-no" || !me.bf?.[a.id]) { render(); break; }
        // take the hand-added counters back off and put them on through the engine, so triggers (and doublers) resolve
        mutate(p => { const x = p.bf?.[a.id]; if (!x) return; x.c ||= {}; x.c[a.k] = Math.max(0, (x.c[a.k] || 0) - a.n); if (!x.c[a.k]) delete x.c[a.k]; }, true);
        counterPutTriggers([{ oid: pid, n: a.n }]);
        act([{ type: "effects", effs: [{ k: "countersOn", target: { kind: "bf", id: a.id }, n: a.n, key: a.k, label: counterLabel(a.k) }], times: 1, count: 1, src: `${r.src} (a spell or ability)`, srcId: a.id }]);
        break;
      }
      case "wbk-go": {
        const r = reminders.find(x => x.id === b.dataset.id); if (!r?.wbk) break;
        const [oid, id] = r.wbk.id ? [r.wbk.oid, r.wbk.id] : String(document.getElementById(`wbk-${r.id}`)?.value || "").split("|");
        if (!oid || !id) break;
        reminders = reminders.filter(x => x !== r);
        sendOrders({ [oid]: {} }, { how: "steal", targets: [{ kind: "bf", id }], src: r.src, until: null });
        logTo(code, `🎯 ${me.name}'s ${r.src}: gains control of ${room.players?.[oid]?.name || "?"}'s ${dispName(room.players?.[oid]?.bf?.[id] || {})}`);
        render(); break;
      }
      case "wbk-ask": { const e = me.bf?.[b.dataset.id]; if (e) { reminders.push({ id: newId(), src: dispName(e), text: "Which opponent's creature did your spell or ability target?", times: 1, wbk: { id: null } }); render(); } break; }
      case "sq-ask": { const e = me.bf?.[b.dataset.id]; if (e) { reminders.push({ id: newId(), src: dispName(e), srcId: b.dataset.id, text: "How much damage that would have been dealt to you was prevented?", times: 1, sqAsk: true }); render(); } break; }
      case "dk-go": case "dk-no": {
        const r = reminders.find(x => x.id === b.dataset.id); if (!r?.dmgAsk) break;
        reminders = reminders.filter(x => x !== r);
        const n = b.dataset.a === "dk-go" ? Math.max(0, Number(document.getElementById(`dk-${r.id}`)?.value) || 0) : 0;
        if (n && me.bf?.[r.dmgAsk.id]) act([{ type: "effects", effs: [{ k: "countersOn", target: { kind: "bf", id: r.dmgAsk.id }, n, key: "p1p1", label: "+1/+1" }], times: 1, count: 1, src: `${r.src} (opponents dealt ${n} damage)`, srcId: r.dmgAsk.id }]);
        else render();
        break;
      }
      case "sq-go": {
        const r = reminders.find(x => x.id === b.dataset.id); if (!r?.sqAsk) break;
        const n = Math.max(0, Number(document.getElementById(`sq-${r.id}`)?.value) || 0);
        reminders = reminders.filter(x => x !== r);
        if (n) squirePrevented(n, "by hand"); else render();
        break;
      }
      case "ga-yes": case "ga-no": {
        const r = reminders.find(x => x.id === b.dataset.id);
        if (!r) break;
        reminders = reminders.filter(x => x !== r);
        if (b.dataset.a === "ga-yes") { const first = firstGainT !== (room?.turnNo || 0); firstGainT = room?.turnNo || 0; act([{ type: "gainlife", n: r.gainAsk, first }]); }
        else { const t = room.turnNo || 0, n = r.gainAsk; if (me.lifeLost?.t === t) mutate(p => { p.lifeLost.n = Math.max(0, (p.lifeLost.n || 0) - n); }, true); render(); }
        break;
      }
      case "prep-mark": { const e = me.bf?.[b.dataset.id]; if (e) { mutate(p => { p.bf[b.dataset.id].prepared = true; }); logTo(code, `🔮 ${me.name}'s ${dispName(e)} is prepared`); } break; }
      case "eqp-go": { const r = reminders.find(x => x.id === b.dataset.id); if (!r?.eqPick) break;
        const eid = document.getElementById(`eqp-e-${r.id}`)?.value, tv = r.eqPick.to ? `bf:${r.eqPick.to}` : document.getElementById(`eqp-t-${r.id}`)?.value;
        reminders = reminders.filter(x => x !== r); if (eid && tv) attachTo(eid, tv); render(); break; }
      case "mzx-go": { // Mizzix's Mastery: exile, then cast a copy of each, one after another
        const r = reminders.find(x => x.id === b.dataset.id);
        if (!r) break;
        const gs = Object.entries(me.gy || {}).filter(([gid, g]) => (b.dataset.g === "*" || gid === b.dataset.g) && /\b(Instant|Sorcery)\b/.test(g.t || lookupCard(g.n)?.t || ""));
        reminders = reminders.filter(x => x !== r);
        mutate(p => gs.forEach(([gid, g]) => { delete p.gy?.[gid]; p.ex ||= {}; p.ex[newId()] = g; }));
        logTo(code, `${me.name}: ${r.src} exiled ${gs.map(([, g]) => dispName(g)).join(", ")} and casts ${gs.length === 1 ? "a copy" : "copies"}`);
        gs.forEach(([, g], i) => setTimeout(() => { const c = deckCard(g.n) || lookupCard(g.n) || g; logTo(code, `${me.name} cast a copy of ${dispName(c)} (${r.src}, free)`); playCard(c, { copy: true, castCopy: true }); }, 80 * i));
        render(); break;
      }
      case "prep-cast": {
        const e = me.bf?.[b.dataset.id], c = e && preparedSpell(e);
        if (!c) break;
        mutate(p => { delete p.bf[b.dataset.id].prepared; });
        logTo(code, `🔮 ${me.name} cast a copy of ${c.n} (${dispName(e)} was prepared)`);
        playCard(c, { copy: true, castCopy: true });
        break;
      }
      case "tam-go": {
        const r = reminders.find(x => x.id === b.dataset.id);
        if (!r?.tokAtkMe) break;
        const x = Math.max(0, Number(document.getElementById(`ta-x-${r.id}`)?.value) || 0);
        reminders = reminders.filter(y => y !== r);
        if (x) act([{ type: "create", name: r.tokAtkMe.name, n: x, desc: r.tokAtkMe.desc, src: r.src }]); else render();
        break;
      }
      case "eb-go": { const r = reminders.find(x => x.id === b.dataset.id); if (r?.earthbend) earthbendGo(r); break; }
      case "dg-yes": {
        const r = reminders.find(x => x.id === b.dataset.id);
        if (!r?.dieGain) break;
        reminders = reminders.filter(x => x !== r);
        update(ref(db, `rooms/${code}/dieGain`), { [pid]: { turnNo: room.turnNo || 0, n: r.dieGain.n, src: r.src } });
        logTo(code, `⚙ ${me.name}'s ${r.src}: whenever a creature dies this turn, ${me.name} gains ${r.dieGain.n} life`);
        render(); break;
      }
      case "wb-go": case "wb-no": {
        const r = reminders.find(x => x.id === b.dataset.id);
        if (!r?.wbend) break;
        reminders = reminders.filter(x => x !== r);
        if (b.dataset.a === "wb-no") { logTo(code, `${me.name} didn't pay ${r.src}'s waterbend cost`); reminders = reminders.filter(x => !(x.dieGain?.ifPaid && x.src === r.src)); render(); break; }
        const ids = [...document.querySelectorAll(`.wb-box[data-rid="${r.id}"]:checked`)].map(x => x.value);
        const toks = [...document.querySelectorAll(`.wb-tok[data-rid="${r.id}"]`)].map(x => [x.dataset.k, Math.max(0, Number(x.value) || 0)]).filter(([, n]) => n);
        const n = ids.length + toks.reduce((a, [, k]) => a + k, 0);
        if (n) act(ids.filter(id => !me.bf[id]?.tap).map(id => ({ type: "tapped", id })), p => { ids.forEach(id => { if (p.bf?.[id]) p.bf[id].tap = true; }); toks.forEach(([k, c]) => { const t = p.tokens?.[k]; if (t) t.tapped = Math.min(t.count, (t.tapped || 0) + c); }); });
        logTo(code, `💧 ${me.name} waterbent for ${r.src}: tapped ${n} (paid {${Math.min(n, r.wbend.n)}} of {${r.wbend.n}}${n < r.wbend.n ? "; the rest with mana" : ""})`);
        render(); break;
      }
      case "dd-go": {
        const r = reminders.find(x => x.id === b.dataset.id), o = room.players?.[b.dataset.o];
        if (!r?.dmgDef || !o) break;
        const x = r.dmgDef.n === "attackers" || r.dmgDef.n === "X" ? Math.max(0, Number(document.getElementById(`ddx-${r.id}`)?.value) || 0) : r.dmgDef.n;
        reminders = reminders.filter(y => y !== r);
        const a = ampDmg(x, (r.srcId && me.bf?.[r.srcId]) || lookupCard(r.src), true);
        logTo(code, `💥 ${me.name}'s ${r.src}: ${a.n} damage to ${o.name}${a.why ? ` (${a.why})` : ""}`);
        if (!o.prot?.all) { act([{ type: "effects", effs: [{ k: "tlose", n: a.n, target: b.dataset.o, targetName: o.name }], times: 1, count: 1, src: r.src, srcId: r.srcId }]); setTimeout(() => { deliriumPunish({ [b.dataset.o]: a.n }); render(); }, 0); }
        render(); break;
      }
      case "rep-manual": { const e = me.bf?.[b.dataset.id]; if (e) { reminders.push({ id: newId(), src: dispName(e), srcId: b.dataset.id, text: "A creature was dealt damage the app didn't see (combat, a fight…).", times: 1, repManual: true }); render(); } break; }
      case "rp-go": {
        const r = reminders.find(x => x.id === b.dataset.id);
        if (!r) break;
        const v = document.getElementById(`rpv-${r.id}`)?.value, n = Math.max(0, Number(document.getElementById(`rpn-${r.id}`)?.value) || 0);
        reminders = reminders.filter(x => x !== r);
        if (v && n) repercHit(v, n, r.src, "a creature was dealt damage");
        render(); break;
      }
      case "dp-go": { const r = reminders.find(x => x.id === b.dataset.id); if (r?.dmgPer) dmgPerGo(r); break; }
      case "da-go": { const r = reminders.find(x => x.id === b.dataset.id); if (r?.dmgAll) dmgAllGo(r); break; }
      case "cs-go": { const r = reminders.find(x => x.id === b.dataset.id); if (r?.copySpell?.pick && !r.copySpell.card) { const c = room.casts?.[document.getElementById(`csp-${r.id}`)?.value]; if (!c) break; r.copySpell.card = { n: c.n, t: c.t, m: c.m, img: c.img };
        if (r.copySpell.bounce) { const ck = document.getElementById(`csp-${r.id}`)?.value; update(ref(db, `rooms/${code}/casts/${ck}`), { countered: { by: pid, byName: me.name, src: r.src, bounced: true, at: Date.now() } }); if (c.by && c.by !== pid) sendNote(c.by, { text: `${r.src} returned ${c.n} to your hand (it didn't resolve).`, src: r.src }); logTo(code, `↩ ${r.src}: ${c.n} returned to its owner's hand`); } } if (r?.copySpell) copySpellGo(r); break; }
      case "leg-keep": {
        const r = reminders.find(x => x.id === b.dataset.id);
        if (!r?.legend) break;
        reminders = reminders.filter(x => x !== r);
        const gone = r.legend.ids.filter(x => x !== b.dataset.k && me.bf?.[x]).map(x => [x, me.bf[x]]);
        logTo(code, `👑 ${me.name}: legend rule — kept one ${dispName(me.bf[b.dataset.k] || gone[0]?.[1] || {})}, ${gone.length} to the graveyard`);
        act(gone.filter(([, e]) => /\bCreature\b/.test(e.t || "")).map(([id]) => ({ type: "dies", n: 1, token: false, ids: [id] })), null, p => gone.forEach(([id, e]) => { delete p.bf[id]; if (!e.tok) toZone(p, e, "gy"); }));
        gone.filter(([, e]) => e.cmd).forEach(([, e]) => reminders.push({ id: newId(), src: dispName(e), text: "Your commander can go to the command zone instead.", times: 1 }));
        render(); break;
      }
      case "bighit": { // "Whenever X deals 4 or more damage": damage the app didn't track (blockers, fights)
        const e = me.bf?.[b.dataset.id], h = e && bigHitTriggers({ ...e, o: e.o || lookupCard(e.n)?.o })[Number(b.dataset.i)];
        if (!h) break;
        logTo(code, `💥 ${me.name}'s ${dispName(e)} dealt ${h.min} or more damage: ${h.text.replace(/\.$/, "")}`);
        const sp = spellAbility({ n: `${e.n} · damage`, t: "Instant", o: h.text });
        const effs = sp.effs.filter(f => ["impulse", "ping", "dmgCr", "remove", "pumpTarget", "countersTarget", "tgain"].includes(f.k));
        if (sp.auto || effs.length) act([{ type: "effects", effs: sp.auto ? sp.effs : effs, times: 1, count: 1, src: dispName(e), srcId: b.dataset.id }]);
        else reminders.push({ id: newId(), src: dispName(e), text: h.text, times: 1 });
        render(); break;
      }
      case "crew": { const e = me.bf?.[b.dataset.id]; if (e) { reminders.push({ id: newId(), src: dispName(e), srcId: b.dataset.id, text: "", times: 1, crew: { id: b.dataset.id, n: crewOf({ ...e, o: e.o || lookupCard(e.n)?.o }) } }); render(); } break; }
      case "crew-go": {
        const r = reminders.find(x => x.id === b.dataset.id), k = r?.crew;
        if (!k || !me.bf?.[k.id]) break;
        const ids = [...document.querySelectorAll(`.cw-box[data-rid="${r.id}"]:checked`)].map(x => x.value);
        const toks = [...document.querySelectorAll(`.cw-tok[data-rid="${r.id}"]`)].map(x => [x.dataset.k, Math.max(0, Number(x.value) || 0)]).filter(([, n]) => n);
        const power = ids.reduce((a, id) => a + (Number(ptOf(me.bf[id], countsFor(me), pid, id).split("/")[0]) || 0), 0) + toks.reduce((a, [kk, n]) => a + n * (Number(String(tokPTfx(me.tokens[kk], pid, kk) || "0/0").split("/")[0]) || 0), 0);
        if (power < k.n && !confirm(`That's only power ${power} (Crew ${k.n} needs ${k.n}).\n\nCrew it anyway?`)) break;
        reminders = reminders.filter(x => x !== r);
        const v = me.bf[k.id];
        act(ids.filter(id => !me.bf[id].tap).map(id => ({ type: "tapped", id })), p => {
          ids.forEach(id => { if (p.bf[id]) p.bf[id].tap = true; });
          toks.forEach(([kk, n]) => { const t = p.tokens?.[kk]; if (t) t.tapped = Math.min(t.count, (t.tapped || 0) + n); });
          const x = p.bf[k.id];
          if (x && !/\bCreature\b/.test(x.t || "")) { x.crewT = x.t; x.t = x.t.replace(/\bArtifact\b/, "Artifact Creature"); }
          if (x) x.crew = room.turnNo || 0;
        });
        logTo(code, `🚗 ${me.name} crewed ${dispName(v)} with ${[...ids.map(id => dispName(me.bf[id])), ...toks.map(([kk, n]) => `${n} ${me.tokens[kk]?.name}`)].join(", ") || "nothing"} (power ${power}) — it's a creature until end of turn`);
        render(); break;
      }
      case "ra-go": {
        const r = reminders.find(x => x.id === b.dataset.id), k = r?.rmAmong;
        if (!k) break;
        const picks = [...document.querySelectorAll(`.ra-n[data-rid="${r.id}"]`)].map(x => [x.dataset.id, Math.max(0, Number(x.value) || 0)]).filter(([, n]) => n);
        const tot = picks.reduce((a, [, n]) => a + n, 0);
        if (tot !== k.n) { toast(`Remove exactly ${k.n} counters (you picked ${tot}).`); break; }
        reminders = reminders.filter(x => x !== r);
        act([], p => picks.forEach(([id, n]) => { const t = p.bf?.[id]; if (!t?.c) return; t.c[k.key] = Math.max(0, (t.c[k.key] || 0) - n); if (!t.c[k.key]) delete t.c[k.key]; }));
        logTo(code, `${me.name}: ${r.src} — removed ${picks.map(([id, n]) => `${n} from ${dispName(me.bf[id] || {})}`).join(", ")}`);
        render(); break;
      }
      case "rd-pick": { const r = reminders.find(x => x.id === b.dataset.id); if (r?.radiant) { r.radiant.k = document.getElementById(`rd-${r.id}`)?.value; render(); } break; }
      case "rd-manual": {
        const r = reminders.find(x => x.id === b.dataset.id);
        if (!r?.radiant) break;
        const n = Math.max(0, Number(document.getElementById(`rdn-${r.id}`)?.value) || 0), kind = document.getElementById(`rdk-${r.id}`)?.value || "ping";
        r.radiant.k = "manual";
        r.radiant.manual = { k: "manual", c: { n: `${n} damage to ${kind === "ping" ? "any target" : kind === "cpw" ? "a creature or planeswalker" : "a creature"}` }, card: { n: "", m: "" },
          plan: kind === "ping" ? { k: "ping", n } : { k: "dmgCr", n, cr: true, pw: kind === "cpw" } };
        render(); break;
      }
      case "rd-go": { const r = reminders.find(x => x.id === b.dataset.id); if (r?.radiant) radiantGo(r); break; }
      case "cd-go": { const r = reminders.find(x => x.id === b.dataset.id); if (r?.crDmg) crDmgGo(r); break; }
      case "bane-go": {
        const r = reminders.find(x => x.id === b.dataset.id), v = document.getElementById(`bn-${b.dataset.id}`)?.value;
        const c = v && baneTargets().find(x => x.v === v);
        if (!r || !c) break;
        reminders = reminders.filter(x => x !== r);
        logTo(code, `${me.name}: ${r.src} → ${c.o.name}'s ${dispName(c.e)} (sacrifice it or take ${c.mv})`);
        sendOrders({ [c.o.id]: {} }, { how: "bane", id: v.split("|")[1], n: c.mv, name: dispName(c.e), src: r.src });
        render(); break;
      }
      case "bane-sac": case "bane-dmg": {
        const r = reminders.find(x => x.id === b.dataset.id), k = r?.baneAsk;
        if (!k) break;
        reminders = reminders.filter(x => x !== r);
        const e = me.bf?.[k.id];
        if (b.dataset.a === "bane-sac" && e) {
          logTo(code, `🗡 ${me.name} sacrificed ${dispName(e)} (${r.src})`);
          act(/\bCreature\b/.test(e.t || "") ? [{ type: "dies", n: 1, token: false, ids: [k.id] }] : [], null, p => { delete p.bf[k.id]; toZone(p, e, "gy"); });
        } else if (me.prot?.life) logTo(code, `🛡 ${me.name}'s life can't change (${me.prot.src})`);
        else { mutate(p => { p.life = (p.life ?? START_LIFE) - k.n; }); logTo(code, `💥 ${k.name} dealt ${k.n} damage to ${me.name} (${r.src})`); }
        render(); break;
      }
      case "cw-go": case "cw-none": {
        const r = reminders.find(x => x.id === b.dataset.id);
        if (!r) break;
        reminders = reminders.filter(x => x !== r);
        if (b.dataset.a === "cw-none") { logTo(code, `${me.name} revealed a nonpermanent card (${r.src})`); render(); break; }
        const c = deck?.cards[Number(document.getElementById(`cw-${r.id}`)?.value)];
        if (!c) { render(); break; }
        logTo(code, `${me.name} revealed ${dispName(c)} (${r.src})`);
        playCard(c, { via: r.src });
        break;
      }
      case "ping-go": {
        const r = reminders.find(x => x.id === b.dataset.id), k = r?.ping;
        if (!k) break;
        const oid = b.dataset.o, o = oid && room.players?.[oid];
        k.left -= 1;
        if (k.left <= 0) reminders = reminders.filter(x => x.id !== r.id); else normalizeRem(r);
        const srcCard = (r.srcId && me.bf?.[r.srcId]) || lookupCard(r.src);
        const am = o ? ampDmg(k.n, srcCard, oid !== pid) : { n: k.n, why: "" };
        { const pv = o && Object.values(o.bf || {}).find(x => /prevent all damage that would be dealt to you\.?$/im.test(x.o || lookupCard(x.n)?.o || "")); if (pv) { am.n = 0; am.why = `prevented by ${o.name}'s ${dispName(pv)}`; } }
        if (am.why) logTo(code, `🔥 ${r.src}: ${k.n} → ${am.n} damage (${am.why})`);
        const effs = [...(o ? [{ k: "tlose", n: am.n, target: oid, targetName: o.name }] : []), ...(r.thenEffs || [])];
        if (o && oid !== pid) { commitCrime("damage"); dmgToOpp(am.n, srcCard, r.src, o.name); setTimeout(() => { deliriumPunish({ [oid]: am.n }); render(); }, 0); }
        if (!o) reminders.push({ id: newId(), src: r.src, srcId: r.srcId, text: `Deal ${k.n} damage to target creature or planeswalker.`, times: 1, crDmg: { n: k.n, pw: true, cr: true }, llSrc: r.srcId });
        if (o && am.n > 0) lifelinkGain(r.srcId, am.n, r.src); // Walking Ballista with Heliod's lifelink
        if (o && oid !== pid && am.n > 0) noncombatHit(r.srcId, am.n, o.name); // Niv-Mizzet + Curiosity
        if (effs.length) act([{ type: "effects", effs, times: 1, count: 1, src: r.src, srcId: r.srcId }]);
        else render();
        break;
      }
      case "copy-imprint": { // record the imprinted card after the fact (no exile move: it's already exiled in real life)
        const r = reminders.find(x => x.id === b.dataset.id), c = r && deck?.cards[Number(document.getElementById(`cpi-${r.id}`)?.value)];
        if (!c || !me.bf?.[r.copyFrom]) break;
        mutate(p => { const e = p.bf?.[r.copyFrom]; if (e) { e.imprints = [dispName(c)]; e.imprint = dispName(c); } });
        logTo(code, `${me.name}'s ${r.src}: imprinted ${dispName(c)}`); break;
      }
      case "copy-cast": {
        const r = reminders.find(x => x.id === b.dataset.id), e = r && me.bf?.[r.copyFrom];
        const list = e?.imprints || (e?.imprint ? [e.imprint] : []);
        const name = list[Number(b.dataset.i)], c = name && (deck?.cards.find(x => dispName(x) === name || x.n === name) || anyCache.get(name));
        if (!c) { toast("Couldn't find that card in your deck list."); break; }
        reminders = reminders.filter(x => x.id !== r.id);
        logTo(code, `${me.name} cast a copy of ${dispName(c)} (${r.src}, free)`);
        playCard(c, { copy: true, castCopy: true });
        break;
      }
      case "sx-who": { const r = reminders.find(x => x.id === b.dataset.id); if (r?.stealEx) { r.stealEx.who = b.dataset.o; render(); } break; }
      case "sx-clear": { const r = reminders.find(x => x.id === b.dataset.id); if (r?.stealEx) { delete r.stealEx.card; render(); } break; }
      case "sx-find": {
        const r = reminders.find(x => x.id === b.dataset.id), q = document.getElementById(`sx-${b.dataset.id}`)?.value.trim();
        if (!r?.stealEx || !q) break;
        (async () => {
          let card = anyCache.get(q) || null;
          if (!card) {
            try { const res = await fetch(`${SCRYFALL}/cards/named?fuzzy=${encodeURIComponent(q)}`); if (res.ok) { card = slim(await res.json()); anyCache.set(card.n, card); } } catch {}
          }
          if (!card) { toast("Couldn't find that card."); return; }
          r.stealEx.card = card; render();
        })();
        break;
      }
      case "sx-go": {
        const r = reminders.find(x => x.id === b.dataset.id), k = r?.stealEx;
        if (!k?.card || !k.who) break;
        const o = room.players[k.who], own = { id: k.who, name: o.name, color: o.color };
        reminders = reminders.filter(x => x.id !== r.id);
        if (k.dest === "battlefield") playCard(k.card, { via: r.src, own });
        else {
          act([], p => { p.ex ||= {}; p.ex[newId()] = zoneEntry({ ...k.card, own }, { play: { until: 1e9, any: true }, src: r.src }); });
          logTo(code, `🕵 ${me.name} exiled ${o.name}'s ${k.card.n} with ${r.src} (may play it while it's exiled)`);
          if (k.restGy) sendNote(k.who, { kind: "millLog", n: k.restGy, src: r.src, text: "" });
          zoneOpen.add("ex");
        }
        render(); break;
      }
      case "void-go": {
        const r = reminders.find(x => x.id === b.dataset.id), v = document.getElementById(`vp-${b.dataset.id}`)?.value;
        if (!r || !v) break;
        const [oid, xid] = v.split("|"), o = room.players[oid], e = o?.ex?.[xid];
        if (!e) break;
        reminders = reminders.filter(x => x.id !== r.id);
        act([], p => { p.ex ||= {}; p.ex[newId()] = zoneEntry({ ...e, own: { id: oid, name: o.name, color: o.color } }, { play: { until: room.turnNo || 0, free: true }, src: r.src }); });
        sendOrders({ [oid]: {} }, { how: "dropEx", id: xid });
        logTo(code, `🕵 ${me.name} took ${o.name}'s ${e.n} from exile (${r.src}): may play it this turn for free`);
        zoneOpen.add("ex"); render(); break;
      }
      case "give-back-tok": returnBorrowed([], [b.dataset.k]); break;
      case "zone-toggle": {
        e.preventDefault();
        const z = b.dataset.z;
        zoneOpen.has(z) ? zoneOpen.delete(z) : zoneOpen.add(z);
        render(); break;
      }
      case "zone-add": {
        const z = b.dataset.z, c = deck?.cards[Number(document.getElementById(`za-${z}`)?.value)];
        if (!c) break;
        const dx = b.dataset.why === "discarded" && boardEnv().discardExile[0];
        let mgid = null;
        act(b.dataset.why === "discarded" ? [{ type: "discard", n: 1 }] : [], p => { mgid = toZone(p, c, dx ? "ex" : z, b.dataset.why === "discarded" ? { disc: room.turnNo || 0 } : undefined); });
        if (b.dataset.why === "milled" && !dx) setTimeout(() => libToGy([c], [mgid]), 0);
        logTo(code, `${me.name} ${b.dataset.why} ${dispName(c)}${dx ? ` → exiled (${dx.src})` : ""}`);
        break;
      }
      case "zone": {
        const z = b.dataset.z, id = b.dataset.id, to = b.dataset.to, e = me[z]?.[id];
        if (!e) break;
        const where = z === "gy" ? "graveyard" : "exile";
        if (to === "cast" || to === "bf") {
          const c = zoneCard(e);
          if (to === "cast" && !/\bLand\b/.test(c.t || "") && !okToCast(c, z === "gy" ? "gy" : "exile")) break;
          let alt = z === "gy" ? altCastOf(c) || (e.fb === (room.turnNo || 0) ? "Flashback" : "") : "";
          if (alt === "Mayhem" && e.disc !== (room.turnNo || 0)) alt = "";
          const escape = to === "cast" && z === "gy" && (alt === "Escape" || (!alt && breachOn() && !/\bLand\b/.test(c.t || "")));
          if (escape && !alt) alt = "Escape, Underworld Breach";
          const exN = escape ? escapeExileN(c) : 0;
          if (escape && Object.keys(me.gy || {}).length - 1 < exN) { toast(`Escape needs ${exN} other cards in your graveyard.`); break; }
          logTo(code, `${me.name}: ${dispName(c)} from ${where}${alt ? ` (${alt})` : ""}`);
          const co = String(c.o || e.o || ""), cm = re => (co.match(re) || [])[1] || ""; // pay the alternative cost from the pool, not the printed one
          const altCost = z === "ex" && e.foretold ? e.foretold.cost || cm(/^Foretell ((?:\{[^}]+\})+)/m) : alt === "Flashback" ? cm(/^Flashback ((?:\{[^}]+\})+)/m) : /^Escape/.test(alt) ? cm(/^Escape—((?:\{[^}]+\})+)/m) : alt === "Mayhem" ? cm(/^Mayhem ((?:\{[^}]+\})+)/m) : "";
          playCard({ ...c, ...(e.o && !c.o ? { o: e.o } : {}) }, { fromZone: { z, id }, ...(altCost ? { altCost } : {}), ...(e.own ? { own: e.own } : {}), ...(to === "bf" ? { via: `from ${where}` } : {}), ...(/^(Flashback|Jump-start)$/.test(alt) ? { exileAfter: true } : {}) });
          if (exN) { reminders.push({ id: newId(), src: dispName(c), text: `Escape cost: exile ${exN} other cards from your graveyard.`, times: 1, escapeEx: { n: exN } }); render(); }
          const fbs = alt === "Flashback" && String(c.o || "").match(/^Flashback—Sacrifice (two|three|four|five|\d+) (creature|artifact|permanent|land)s/m);
          if (fbs) { reminders.push(normalizeRem({ id: newId(), src: `${dispName(c)} (flashback)`, text: `Flashback cost: sacrifice ${fbs[1]} ${fbs[2]}s.`, times: 1, sacNPick: { n: ({ two: 2, three: 3, four: 4, five: 5 })[fbs[1].toLowerCase()] || Number(fbs[1]), what: fbs[2], id: null } })); render(); }
        } else {
          act([], p => { const x = p[z]?.[id]; if (!x) return; delete p[z][id]; if (to === "gy" || to === "ex") toZone(p, x, to); });
          logTo(code, `${me.name}: ${dispName(e)} ${where} → ${{ hand: "hand", gy: "graveyard", ex: "exile", drop: "library / elsewhere" }[to]}`);
          if (to === "hand") toDigHand([zoneCard(e)]);
        }
        break;
      }
      case "rg-go": case "rg-all": {
        const r = reminders.find(x => x.id === b.dataset.id), f = r?.regrow;
        if (!f) break;
        const ids = b.dataset.a === "rg-all" ? Object.entries(me.gy || {}).filter(([, e]) => permMatch(e, f.filter)).map(([id]) => id)
          : [document.getElementById(`rg-${r.id}`)?.value].filter(Boolean);
        if (!ids.length) break;
        if (ids[0].startsWith("o:")) { // someone else's graveyard → onto my battlefield under my control
          const [, oid, gid] = ids[0].split(":"), o = room.players?.[oid], c = o?.gy?.[gid];
          if (!c) break;
          sendOrders({ [oid]: {} }, { how: "gyTake", name: c.n, src: r.src });
          playCard(zoneCard(c), { via: r.src, own: { id: oid, name: o.name, color: o.color }, tapped: f.tapped });
          r.left -= 1; if (r.left <= 0) reminders = reminders.filter(x => x.id !== r.id); else normalizeRem(r);
          render(); break;
        }
        const names = ids.map(id => dispName(me.gy[id]));
        if (f.drainPow && countTypes(me, [f.drainPow.type]) >= f.drainPow.n) { const pw = ids.reduce((a, id) => a + (Number(me.gy[id]?.p ?? lookupCard(me.gy[id]?.n)?.p) || 0), 0); if (pw) setTimeout(() => act([{ type: "effects", effs: [{ k: "drain", n: pw }], times: 1, count: 1, src: r.src }]), 0); }
        if (f.dest === "battlefield") ids.forEach(id => playCard(zoneCard(me.gy[id]), { fromZone: { z: "gy", id }, via: r.src, tapped: f.tapped, ...(f.sacNext ? { sacNext: r.src } : {}) }));
        else {
          const back = ids.map(id => me.gy[id]).filter(Boolean);
          act([], p => ids.forEach(id => delete p.gy?.[id]));
          if (f.dest === "hand") toDigHand(back); else if (dig?.on) { dig.lib.unshift(...back.map(c => c.n).reverse()); digSave(); setTimeout(() => { try { renderHand(); } catch {} }, 0); }
          logTo(code, `${me.name} returned ${names.join(", ")} from graveyard to ${f.dest === "hand" ? "hand" : "the top of their library"} (${r.src})`);
        }
        r.left = b.dataset.a === "rg-all" ? 0 : r.left - 1;
        if (r.left <= 0) reminders = reminders.filter(x => x.id !== r.id); else normalizeRem(r);
        render(); break;
      }
      case "imp-x": { const r = reminders.find(x => x.id === b.dataset.id); const v = Number(document.getElementById(`ix-${b.dataset.id}`)?.value); if (r && v > 0) { r.impulse.x = v; render(); } break; }
      case "imp-add": {
        const r = reminders.find(x => x.id === b.dataset.id), c = deck?.cards[Number(document.getElementById(`ip-${b.dataset.id}`)?.value)];
        if (r && c) { r.impulse.cards.push({ n: c.n, t: c.t || "", m: c.m || "", img: c.img || "" }); render(); }
        break;
      }
      case "imp-dig": { const r = reminders.find(x => x.id === b.dataset.id), k = r?.impulse; if (!k || !dig?.on) break; const n = k.n === "X" ? k.x : k.n;
        dig.lib.splice(0, n).forEach(nm => { const c = deckCard(nm) || lookupCard(nm) || { n: nm }; k.cards.push({ n: c.n, t: c.t || "", m: c.m || "", img: c.img || "" }); }); k.digLib = true; digSave(); renderHand(); render(); break; }
      case "imp-del": { const r = reminders.find(x => x.id === b.dataset.id); if (r) { r.impulse.cards.splice(Number(b.dataset.j), 1); render(); } break; }
      case "imp-go": {
        const r = reminders.find(x => x.id === b.dataset.id), k = r?.impulse;
        if (!k?.cards.length) break;
        reminders = reminders.filter(x => x.id !== r.id);
        if (dig?.on && (k.toGy || !k.digLib)) { const z = k.toGy ? dig.hand : dig.lib; k.cards.forEach(c => { const j = z.indexOf(c.n); if (j >= 0) z.splice(j, 1); }); digSave(); setTimeout(() => { try { renderHand(); } catch {} }, 0); }
        if (k.toGy) {
          const dx = boardEnv().discardExile[0];
          act([{ type: "discard", n: k.cards.length }], p => k.cards.forEach(c => toZone(p, c, dx ? "ex" : "gy", { disc: room.turnNo || 0 })));
          logTo(code, `${me.name} discarded ${k.cards.map(c => c.n).join(", ")} (${r.src})${dx ? ` → exiled (${dx.src})` : ""}`);
          zoneOpen.add("gy"); render(); break;
        }
        const until = (room.turnNo || 0) + (k.next ? seated(room).filter(o => !isOut(o)).length : 0);
        act([], p => { p.ex ||= {}; k.cards.forEach((c, i) => { p.ex[newId()] = k.choose && i >= k.choose ? zoneEntry(c, { src: r.src }) : zoneEntry(c, { play: { until, next: !!k.next }, src: r.src }); }); });
        if (k.choose && k.cards.length > k.choose) logTo(code, `${me.name} chose ${k.cards.slice(0, k.choose).map(c => c.n).join(", ")} to play (${r.src}); the rest stay exiled`);
        logTo(code, `🔥 ${me.name} exiled ${k.cards.map(c => c.n).join(", ")} with ${r.src} (playable ${k.next ? "through their next turn" : "this turn"})`);
        zoneOpen.add("ex");
        render(); break;
      }
      case "hm-ask": {
        const r = reminders.find(x => x.id === b.dataset.id);
        if (!r?.handMana) break;
        sendNote(b.dataset.o, { kind: "count", text: "How many cards are in your hand?", src: r.src, replyTo: pid, rid: r.id });
        r.handMana.waiting = b.dataset.o;
        render(); break;
      }
      case "hm-set": {
        const r = reminders.find(x => x.id === b.dataset.id), v = document.getElementById(`hm-${b.dataset.id}`)?.value;
        if (r?.handMana && v !== "") handManaDone(r, Math.max(0, Number(v) || 0), "");
        break;
      }
      case "count-send": {
        const nid = b.dataset.n, n = room.notes?.[pid]?.[nid], v = document.getElementById(`cn-${nid}`)?.value;
        if (!n || v === "") break;
        update(ref(db, `rooms/${code}/notes/${pid}`), { [nid]: null });
        update(ref(db, `rooms/${code}/replies/${n.replyTo}`), { [n.rid]: { count: Math.max(0, Number(v) || 0), name: me.name } });
        break;
      }
      case "gh-go": {
        const r = reminders.find(x => x.id === b.dataset.id), f = r?.gyHate;
        if (!f) break;
        const who = b.dataset.o === "*" ? seated(room).filter(o => !isOut(o) && (f.who === "all" || o.id !== pid)).map(o => o.id) : [b.dataset.o];
        reminders = reminders.filter(x => x.id !== r.id);
        sendOrders(Object.fromEntries(who.map(id => [id, {}])), { how: "gyexile", src: r.src });
        render(); break;
      }
      case "op-add": {
        const r = reminders.find(x => x.id === b.dataset.id), c = deck?.cards[Number(document.getElementById(`op-${b.dataset.id}`)?.value)];
        if (!r || !c) break;
        if (r.oppPick.cards.length < r.oppPick.n) r.oppPick.cards.push({ n: c.n, img: c.img || "" });
        render(); break;
      }
      case "op-del": { const r = reminders.find(x => x.id === b.dataset.id); if (r) { r.oppPick.cards.splice(Number(b.dataset.j), 1); render(); } break; }
      case "op-send": {
        const r = reminders.find(x => x.id === b.dataset.id), k = r?.oppPick, o = room.players?.[b.dataset.o] && { ...room.players[b.dataset.o], id: b.dataset.o };
        if (!k || !o || !k.cards.length) break;
        let note;
        if (k.piles === "you") {
          const ticks = [...document.querySelectorAll(`.op-pile[data-rid="${r.id}"]:checked`)].map(x => Number(x.value));
          const p1 = k.cards.filter((_, j) => ticks.includes(j)).map(c => c.n), p2 = k.cards.filter((_, j) => !ticks.includes(j)).map(c => c.n);
          note = { kind: "opick", mode: "piles", piles: [p1, p2] };
        } else note = { kind: "opick", mode: k.piles === "opp" ? "split" : "pick", pick: k.pick || 1, chosenTo: k.chosenTo, restTo: k.restTo, cards: k.cards };
        sendNote(o.id, { ...note, src: r.src, text: `${r.src}: choose`, replyTo: pid, rid: r.id });
        k.waiting = o.id;
        logTo(code, `🔎 ${me.name} revealed for ${r.src}: ${k.cards.map(c => c.n).join(", ")}. ${o.name} chooses.`);
        render(); break;
      }
      case "op-take": {
        const r = reminders.find(x => x.id === b.dataset.id), k = r?.oppPick;
        if (!k?.pilesToChoose) break;
        const i = Number(b.dataset.i), take = k.pilesToChoose[i], other = k.pilesToChoose[1 - i];
        reminders = reminders.filter(x => x.id !== r.id);
        logTo(code, `🔎 ${r.src}: ${me.name} took ${take.join(", ") || "nothing"} into hand${other.length ? `; ${other.join(", ")} → graveyard` : ""}`);
        if (other.length) act([], p => other.forEach(n => toZone(p, deckCard(n) || { n }, "gy")));
        render(); break;
      }
      case "opick-go": case "opick-pile": {
        const nid = b.dataset.n, n = room.notes?.[pid]?.[nid];
        if (!n) break;
        let picks;
        if (b.dataset.a === "opick-pile") picks = n.piles[Number(b.dataset.i)];
        else {
          const js = [...document.querySelectorAll(`.opick-box[data-n="${nid}"]:checked`)].map(x => Number(x.value));
          if (n.mode === "pick" && js.length !== Math.min(n.pick, n.cards.length)) { toast(`Choose ${Math.min(n.pick, n.cards.length)}.`); break; }
          picks = js.map(j => n.cards[j].n);
        }
        update(ref(db, `rooms/${code}/notes/${pid}`), { [nid]: null });
        update(ref(db, `rooms/${code}/replies/${n.replyTo}`), { [n.rid]: { picks, name: me.name } });
        break;
      }
      case "counter-open": showCounter(); break;
      case "ctr-cast": {
        const c = deck?.cards[Number(b.dataset.i)];
        if (!c || !okToCast(c)) break;
        modal.hidden = true;
        playCard(c, { counters: { key: b.dataset.k } });
        break;
      }
      case "ctr-other": {
        modal.hidden = true;
        sendCounter(null, b.dataset.k, "a counterspell", null);
        break;
      }
      case "ctr-ask": {
        const r = reminders.find(x => x.id === b.dataset.id);
        const k = document.getElementById(`ca-${b.dataset.id}`)?.value;
        if (!r || !k) break;
        sendCounter(r.castKey, k, r.src, r.counterAsk);
        reminders = reminders.filter(x => x.id !== r.id);
        render();
        break;
      }
      case "unless-paid": case "unless-no": {
        const r = reminders.find(x => x.id === b.dataset.id);
        if (!r) break;
        reminders = reminders.filter(x => x.id !== r.id);
        const { key, ctr } = r.unlessCtr;
        if (b.dataset.a === "unless-paid") {
          logTo(code, `${me.name} paid ${r.unlessCtr.cost} for ${ctr.byName}'s ${ctr.src}; ${steps[key]?.name || "the spell"} resolves`);
          if (steps[key]) steps[key].paidAt = ctr.at;
          update(ref(db, `rooms/${code}/casts/${key}`), { countered: null });
        } else revertCast(key, ctr);
        render();
        break;
      }
      case "ans-play": {
        const c = deck?.cards[Number(b.dataset.i)];
        const pend = room?.pending;
        if (!c || !okToCast(c)) break;
        if (b.dataset.kind === "counter" && pend?.castKey && counterOf(c)?.spell) playCard(c, { counters: { key: pend.castKey } });
        else playCard(c);
        break;
      }
      case "fbg-go": {
        const r = reminders.find(x => x.id === b.dataset.id), id = document.getElementById(`fbg-${b.dataset.id}`)?.value;
        if (!r || !me.gy?.[id]) break;
        mutate(p => { if (p.gy?.[id]) p.gy[id].fb = room.turnNo || 0; });
        logTo(code, `${me.name}'s ${r.src}: ${dispName(me.gy[id])} gains flashback this turn`);
        reminders = reminders.filter(x => x.id !== r.id);
        render();
        break;
      }
      case "echo-go": {
        const r = reminders.find(x => x.id === b.dataset.id);
        if (!r) break;
        reminders = reminders.filter(x => x.id !== r.id);
        if (b.dataset.v === "1") { mutate(p => { if (p.bf?.[r.echo.id]) p.bf[r.echo.id].echoDone = true; }); logTo(code, `${me.name} paid echo ${r.echo.cost} for ${r.src}`); }
        else moveOut(r.echo.id, "Sacrificed");
        render();
        break;
      }
      case "tl-go": {
        const r = reminders.find(x => x.id === b.dataset.id), v = document.getElementById(`tl-${b.dataset.id}`)?.value;
        if (!r || !v) break;
        const [oid, kind, tid] = v.split("|"), lock = { id: pid, n: (me.bf?.[r.srcId]?.n) || r.src, src: r.src };
        reminders = reminders.filter(x => x !== r);
        if (oid === pid) tapLockApply({ kind, id: tid, lock, src: r.src, byName: me.name });
        else sendOrders({ [oid]: {} }, { how: "tapLock", kind, id: tid, lock, src: r.src });
        render(); break;
      }
      case "g2b-go": {
        const r = reminders.find(x => x.id === b.dataset.id), g = document.getElementById(`g2b-${b.dataset.id}`)?.value, c = g && me.gy?.[g];
        if (!r || !c) break;
        reminders = reminders.filter(x => x !== r);
        logTo(code, `${me.name}'s ${r.src}: ${dispName(c)} from graveyard → battlefield`);
        playCard(zoneCard(c), { fromZone: { z: "gy", id: g }, via: r.src });
        break;
      }
      case "cum-go": {
        const r = reminders.find(x => x.id === b.dataset.id), k = r?.cumUp;
        if (!k) break;
        reminders = reminders.filter(x => x !== r);
        if (b.dataset.v === "1") { if (k.life && !me.prot?.life) mutate(p => { p.life = (p.life ?? START_LIFE) - k.life * k.n; }); logTo(code, `${me.name} paid cumulative upkeep for ${r.src}: ${k.life ? `${k.life * k.n} life` : `${k.cost} ×${k.n}`}`); }
        else moveOut(k.id, "Sacrificed");
        render(); break;
      }
      case "station": {
        const e = me.bf?.[b.dataset.id]; if (!e) break;
        reminders.push({ id: newId(), src: dispName(e), srcId: b.dataset.id, text: "Station: tap another creature you control, put charge counters equal to its power on this (sorcery speed).", times: 1, station: { id: b.dataset.id } });
        render(); break;
      }
      case "st-go": {
        const r = reminders.find(x => x.id === b.dataset.id), cid = document.getElementById(`st-${b.dataset.id}`)?.value, c = me.bf?.[cid];
        if (!r || !c) break;
        const pw = Math.max(0, Number(ptOf(c, countsFor(me), pid, cid).split("/")[0]) || 0);
        reminders = reminders.filter(x => x !== r);
        mutate(p => { if (p.bf?.[cid]) p.bf[cid].tap = true; const s = p.bf?.[r.station.id]; if (s) { s.c ||= {}; s.c.charge = (s.c.charge || 0) + pw; } });
        logTo(code, `🚀 ${me.name} tapped ${dispName(c)} to station ${r.src}: +${pw} charge (${(me.bf?.[r.station.id]?.c?.charge || 0)} total)`);
        render(); break;
      }
      case "wheel-go": {
        const r = reminders.find(x => x.id === b.dataset.id), f = r?.wheelAll; if (!f) break;
        reminders = reminders.filter(x => x !== r);
        seated(room).filter(o => !isOut(o) && o.id !== pid).forEach(o => sendNote(o.id, { text: `${me.name}'s ${r.src}: ${f.may ? `you may discard your hand and draw ${f.n} cards` : `discard your hand, then draw ${f.n} cards`}.`, src: r.src, drawN: f.n }));
        reminders.push({ id: newId(), src: r.src, text: `${f.may ? "You may discard your hand and draw" : "Discard your hand, then draw"} ${f.n} cards.`, times: 1, drawN: f.n });
        logTo(code, `🌀 ${me.name}'s ${r.src}: everyone ${f.may ? "may discard their hand and draw" : "discards their hand and draws"} ${f.n}`);
        render(); break;
      }
      case "imp-go": {
        const r = reminders.find(x => x.id === b.dataset.id), c = room.casts?.[document.getElementById(`imp-${b.dataset.id}`)?.value];
        if (!r || !c) break;
        const mv = manaValue(c.m || "");
        reminders = reminders.filter(x => x !== r);
        if (mv && !me.prot?.life) mutate(p => { p.life = (p.life ?? START_LIFE) - mv; });
        logTo(code, `${me.name}'s ${r.src}: changed the target of ${castLabel(c)} · lost ${mv} life`);
        render(); break;
      }
      case "moxd-go": {
        const r = reminders.find(x => x.id === b.dataset.id); if (!r) break;
        reminders = reminders.filter(x => x !== r);
        if (b.dataset.v === "1") { const dn = digDiscardPick("mxd-" + r.id); if (!dn) act([{ type: "discard", n: 1 }]); logTo(code, `${me.name} discarded ${dn || "a land"} for ${r.src}`); }
        else moveOut(r.moxD.id, "Graveyard");
        render(); break;
      }
      case "dredge-go": {
        const r = reminders.find(x => x.id === b.dataset.id), k = r?.dredge; if (!k) break;
        reminders = reminders.filter(x => x !== r);
        const g = me.gy?.[k.gid]; if (!g) { render(); break; }
        act([], p => { delete p.gy?.[k.gid]; });
        if (dig?.on) { const drawn = dig.hand.pop(); if (drawn) dig.lib.unshift(drawn); digSave(); toDigHand([g]); } // the dredge replaces the draw that already happened
        sendNote(pid, { kind: "millLog", n: k.n, src: `${dispName(g)} (dredge)`, text: "" });
        logTo(code, `${me.name} dredged ${dispName(g)}: milled ${k.n}, returned it to hand (instead of a draw)`);
        render(); break;
      }
      case "enc-go": {
        const r = reminders.find(x => x.id === b.dataset.id), o = room.players?.[b.dataset.o]; if (!r || !o) break;
        reminders = reminders.filter(x => x !== r);
        mutate(p => { if (p.bf?.[r.encPick.id]) p.bf[r.encPick.id].encOpp = b.dataset.o; });
        if (b.dataset.o !== pid) commitCrime("aura");
        logTo(code, `${me.name}'s ${r.src} enchants ${o.name}`); render(); break;
      }
      case "rtg-go": {
        const r = reminders.find(x => x.id === b.dataset.id); if (!r) break;
        const c = room.casts?.[document.getElementById(`rtg-${r.id}`)?.value], nt = document.getElementById(`rtn-${r.id}`)?.value || "";
        reminders = reminders.filter(x => x !== r);
        logTo(code, `↪ ${me.name}'s ${r.src}: new target${c ? ` for ${castLabel(c)}` : ""}${nt ? ` → ${nt}` : ""}`);
        if (c && c.by !== pid) commitCrime("spell");
        render(); break;
      }
      case "wom-ask": {
        const r = reminders.find(x => x.id === b.dataset.id); if (!r) break;
        const v = document.getElementById(`wom-${r.id}`)?.value; if (v === "" || v == null) { toast("Pick your own number first."); break; }
        r.wom.mine = Math.max(0, Number(v) || 0);
        seated(room).filter(o => !isOut(o) && o.id !== pid).forEach(o => sendNote(o.id, { kind: "count", text: "Secretly choose a number 0 or greater (Wheel of Misfortune). Everyone reveals together.", src: r.src, replyTo: pid, rid: `${r.id}_${o.id}` }));
        logTo(code, `🎡 ${me.name}'s ${r.src}: everyone secretly picks a number`);
        womCheck(r); render(); break;
      }
      case "amu-go": {
        const r = reminders.find(x => x.id === b.dataset.id); if (!r) break;
        reminders = reminders.filter(x => x !== r);
        mutate(p => { const x = p.bf?.[r.amulet.id]; if (x) { x.c ||= {}; x.c.charge = (x.c.charge || 0) + 1; x.noted = b.dataset.c; } });
        logTo(code, `${me.name}'s ${r.src}: charge counter, noted {${b.dataset.c}}`); render(); break;
      }
      case "rtp-go": {
        const r = reminders.find(x => x.id === b.dataset.id); if (!r) break;
        const ids = [...document.querySelectorAll(`.rtp-box[data-rid="${r.id}"]:checked`)].map(x => x.value).filter(id => me.bf?.[id]);
        reminders = reminders.filter(x => x !== r);
        if (ids.length) { ids.forEach(id => { const e = me.bf[id]; if (/\bCreature\b/.test(e.t || "")) { leaveHooks([id], "leave"); counterLeave(e); } });
          act([], p => ids.forEach(id => { const x = p.bf?.[id]; if (!x) return; detachIn(p, id); p.ex ||= {}; p.ex[id] = { n: x.n, t: x.t || "", m: x.m || "", img: x.img || "", ...(x.o ? { o: x.o } : {}), retEnd: true, src: r.src, ...(r.retPick.bonus ? { retBonus: true } : {}), at: Date.now() }; delete p.bf[id]; }));
          logTo(code, `✨ ${me.name}'s ${r.src}: ${ids.length} exiled until the next end step${r.retPick.bonus ? " (they come back with an extra counter)" : ""}`); }
        render(); break;
      }
      case "dup-go": {
        const r = reminders.find(x => x.id === b.dataset.id), id = document.getElementById(`dup-${b.dataset.id}`)?.value, e = me.bf?.[id]; if (!r || !e) break;
        reminders = reminders.filter(x => x !== r);
        const c = zoneCard(e);
        playCard({ ...c, t: /\bArtifact\b/.test(c.t || "") ? c.t : `Artifact ${c.t}` }, { tokenCopy: true, via: r.src, haste: r.src, sacNext: r.src });
        logTo(code, `🔥 ${me.name}'s ${r.src}: token copy of ${dispName(e)} (haste, sacrificed at the next end step)`);
        break;
      }
      case "dbl-go": {
        const r = reminders.find(x => x.id === b.dataset.id); if (!r) break;
        reminders = reminders.filter(x => x !== r);
        const t = Date.now().toString(36), ups = [];
        mutate(p => { p.eot ||= {};
          Object.entries(p.bf || {}).forEach(([id, e]) => { if (!/\bCreature\b/.test(e.t || "")) return; const [pp, tt] = ptOf(e, countsFor(me), pid, id).split("/").map(Number); if (Number.isNaN(pp)) return; p.eot[`d${t}${id}`] = { src: r.src, target: id, dp: pp, dt: tt, kws: [] }; ups.push(`${dispName(e)} ${pp * 2}/${tt * 2}`); });
          Object.entries(p.tokens || {}).forEach(([k, tk]) => { if (!isCreatureToken(tk.name)) return; const [pp, tt] = String(tokPTfx(tk, pid, k) || "").split("/").map(Number); if (Number.isNaN(pp)) return; { const eid = `d${t}${k}`; tk.ep = [...(tk.ep || []), eid]; p.eot[eid] = { src: r.src, epTag: true, dp: pp, dt: tt, kws: [], ids: [], toks: [] }; } ups.push(`${tk.name} ${pp * 2}/${tt * 2}`); }); });
        logTo(code, `✖2 ${me.name}'s ${r.src}: ${ups.join(", ") || "no creatures"}`); render(); break;
      }
      case "cpe-go": {
        const r = reminders.find(x => x.id === b.dataset.id), v = document.getElementById(`cpe-${b.dataset.id}`)?.value; if (!r || !v) break;
        const [oid, cid] = v.split("|"), src = room.players?.[oid]?.bf?.[cid], full = src && (lookupCard(src.n) || src), k = r.copyEnt;
        if (!src || !me.bf?.[k.id]) break;
        reminders = reminders.filter(x => x !== r);
        mutate(p => { const x = p.bf?.[k.id]; if (!x) return; const was = x.n;
          Object.assign(x, { n: src.n, t: src.t || full.t, m: src.m || full.m || "", o: src.o || full.o || "", img: src.img || full.img || x.img, copyOf: was, ...(src.p != null ? { p: src.p, tg: src.tg } : {}) });
          if (k.rider === "spark") { x.t = x.t.replace(/^Legendary\s+/, ""); if (/\bCreature\b/.test(x.t)) { x.c ||= {}; x.c.p1p1 = (x.c.p1p1 || 0) + 1; } else { x.c ||= {}; x.c.loyalty = (x.c.loyalty || 0) + 1; } }
          if (k.rider === "bird") { x.t = x.t.includes("—") ? `${x.t} Bird` : `${x.t} — Bird`; x.o = `Flying\n${x.o}`; }
          if (k.rider === "mech") { x.t = "Artifact — Vehicle"; x.o = "Crew 3"; } });
        logTo(code, `🪞 ${me.name}'s ${r.src} entered as a copy of ${dispName(src)}`);
        if (/^When (?:this creature|[^,]+?) enters/m.test(src.o || full.o || "")) reminders.push({ id: newId(), src: dispName(src), text: `${dispName(src)}'s "enters" ability triggers for the copy: ${((src.o || full.o || "").match(/^When (?:this creature|[^,]+?) enters[^\n]*/m) || [""])[0]}`, times: 1 });
        render(); break;
      }
      case "fgp-go": {
        const r = reminders.find(x => x.id === b.dataset.id), v = document.getElementById(`fgp-${b.dataset.id}`)?.value; if (!r || !v) break;
        reminders = reminders.filter(x => x !== r);
        update(ref(db, `rooms/${code}/fog`), { turnNo: room.turnNo || 0, src: r.src, by: me.name, except: null, onlyName: v });
        logTo(code, `🛡 ${me.name}'s ${r.src}: only ${v} deals combat damage this turn`); render(); break;
      }
      case "xany": {
        const e = me.bf?.[b.dataset.id]; if (!e || e.tap) break;
        const x = Number(b.dataset.x) || 0;
        mutate(p => { if (p.bf?.[b.dataset.id]) p.bf[b.dataset.id].tap = true; });
        if (x) reminders.push({ id: newId(), src: dispName(e), text: `Add ${x} mana of any one color.`, times: 1, anyColor: true, anyN: x, anyOne: true });
        logTo(code, `${me.name} tapped ${dispName(e)} for ${x} mana`); render(); break;
      }
      case "foodchain": {
        const e = me.bf?.[b.dataset.id]; if (!e) break;
        const l = Object.entries(me.bf || {}).filter(([, x]) => /\bCreature\b/.test(x.t || ""));
        if (!l.length) { toast("No creature to exile."); break; }
        reminders.push({ id: newId(), src: dispName(e), text: "Exile a creature you control: add 1 + its mana value of one color (creature spells only).", times: 1, foodPick: l.map(([id, x]) => [id, dispName(x), manaValue(x.m || "")]) });
        render(); break;
      }
      case "food-go": {
        const r = reminders.find(x => x.id === b.dataset.id), id = document.getElementById(`fdc-${b.dataset.id}`)?.value, x = me.bf?.[id]; if (!r || !x) break;
        reminders = reminders.filter(y => y !== r);
        const n = 1 + manaValue(x.m || "");
        moveOut(id, "Exile");
        reminders.push({ id: newId(), src: r.src, text: `Add ${n} mana of any one color (only for creature spells).`, times: 1, anyColor: true, anyN: n, anyOne: true });
        render(); break;
      }
      case "selv-btn": {
        const e = me.bf?.[b.dataset.id]; if (!e || e.tap) break;
        const x = maxPowerNow();
        mutate(p => { if (p.bf?.[b.dataset.id]) p.bf[b.dataset.id].tap = true; });
        payPool(b.dataset.c, `${dispName(e)}'s cost`);
        reminders.push({ id: newId(), src: dispName(e), text: `Add ${x} mana in any combination of colors.`, times: 1, selvala: { x } });
        render(); break;
      }
      case "selv-go": {
        const r = reminders.find(x => x.id === b.dataset.id); if (!r) break;
        const v = prompt(`Which ${r.selvala.x} mana? (letters W U B R G, e.g. ${"G".repeat(r.selvala.x)})`, "G".repeat(r.selvala.x)); if (v == null) break;
        const syms = (v.toUpperCase().match(/[WUBRG]/g) || []).slice(0, r.selvala.x).map(c => `{${c}}`).join("");
        reminders = reminders.filter(x => x !== r);
        if (syms) poolAdd(syms, r.src); logTo(code, `${me.name}'s ${r.src}: added ${syms}`); render(); break;
      }
      case "gm-go": {
        const r = reminders.find(x => x.id === b.dataset.id); if (!r) break;
        reminders = reminders.filter(x => x !== r);
        const pr = r.gmPick.pairs[Number(b.dataset.i)], id = r.gmPick.id;
        mutate(p => { if (p.bf?.[id]) p.bf[id].chosenKw = pr.join(","); }); logTo(code, `${me.name}'s ${r.src}: chose ${pr.join(" and ")}`);
        render(); break;
      }
      case "nin-go": {
        const r = reminders.find(x => x.id === b.dataset.id); if (!r) break;
        reminders = reminders.filter(x => x !== r);
        const tid = b.dataset.t, back = tid && me.bf?.[tid];
        if (back) moveOut(tid, "Hand");
        logTo(code, `🥷 ${me.name}: ninjutsu — ${dispName(r.ninPick.card)} enters tapped and attacking${back ? ` (${dispName(back)} returned to hand)` : ""}`);
        if (r.ninPick.cost && me.pool && Object.keys(me.pool).length) payPool(r.ninPick.cost, `${dispName(r.ninPick.card)} (ninjutsu)`);
        playCard(r.ninPick.card, { via: "ninjutsu", tapped: true });
        render(); break;
      }
      case "tymna-go": {
        const r = reminders.find(x => x.id === b.dataset.id); if (!r) break;
        reminders = reminders.filter(x => x !== r);
        const n = Number(b.dataset.n) || 0;
        if (n) { mutate(p => { p.life = (p.life ?? START_LIFE) - n; }); logTo(code, `${me.name}'s ${r.src}: paid ${n} life to draw ${n}`); reminders.push({ id: newId(), src: r.src, text: `Draw ${n} card${n === 1 ? "" : "s"}.`, drawN: n, times: 1 }); }
        render(); break;
      }
      case "tymna-go": {
        const r = reminders.find(x => x.id === b.dataset.id); if (!r) break;
        reminders = reminders.filter(x => x !== r);
        const n = Number(b.dataset.n) || 0;
        if (n) { mutate(p => { p.life = (p.life ?? START_LIFE) - n; }); logTo(code, `${me.name}'s ${r.src}: paid ${n} life to draw ${n}`); reminders.push({ id: newId(), src: r.src, text: `Draw ${n} card${n === 1 ? "" : "s"}.`, drawN: n, times: 1 }); }
        render(); break;
      }
      case "pako-go": {
        const r = reminders.find(x => x.id === b.dataset.id); if (!r) break;
        reminders = reminders.filter(x => x !== r);
        const n = Number(b.dataset.n) || 0, id = r.pakoAsk.id;
        if (n && me.bf?.[id]) { const add = n; mutate(p => { const x = p.bf?.[id]; if (x) { x.c ||= {}; x.c.p1p1 = (x.c.p1p1 || 0) + add; } }); logTo(code, `⚙ ${me.name}'s ${r.src}: ${n} noncreature card${n === 1 ? "" : "s"} exiled → +${add} +1/+1`); }
        else logTo(code, `⚙ ${me.name}'s ${r.src}: no noncreature cards exiled`);
        render(); break;
      }
      case "dg-go": {
        const r = reminders.find(x => x.id === b.dataset.id);
        reminders = reminders.filter(x => x !== r);
        dungeonRoom(b.dataset.d, Number(b.dataset.r));
        render(); break;
      }
      case "init-go": {
        const r = reminders.find(x => x.id === b.dataset.id);
        reminders = reminders.filter(x => x !== r);
        if (!me.effects?.initiative) addEffect("initiative", "ongoing"); else logTo(code, `${me.name} took the initiative again`);
        reminders.push({ id: newId(), src: "🗝️ Initiative", text: "Venture into Undercity.", times: 1, venture: { under: true } });
        render(); break;
      }
      case "mon-go": {
        const r = reminders.find(x => x.id === b.dataset.id);
        reminders = reminders.filter(x => x !== r);
        if (!me.effects?.monarch) addEffect("monarch", "ongoing");
        render(); break;
      }
      case "sil-go": {
        const r = reminders.find(x => x.id === b.dataset.id);
        if (!r) break;
        const t = seated(room).find(o => o.id === b.dataset.p);
        update(ref(db, `rooms/${code}`), { silence: { turnNo: room.turnNo || 0, src: r.src, by: pid, byName: me.name, target: b.dataset.p } });
        logTo(code, `🤐 ${me.name}'s ${r.src}: ${t?.name || "that player"} can't cast spells this turn`);
        reminders = reminders.filter(x => x.id !== r.id);
        render();
        break;
      }
      case "ovl": {
        const r = reminders.find(x => x.id === b.dataset.id);
        if (!r) break;
        const over = b.dataset.v === "1", eff = over ? r.ovlAsk.over : r.ovlAsk.normal;
        reminders = reminders.filter(x => x.id !== r.id);
        if (over) logTo(code, `${me.name} overloaded ${r.src} (${r.ovlAsk.cost})`);
        if (eff) reminders.push({ id: newId(), src: r.src, text: "", times: 1, effs: [eff] });
        render();
        break;
      }
      case "dice-go": {
        const r = reminders.find(x => x.id === b.dataset.id), k = r && diceSpec(r.text); if (!k) break;
        const n = Math.max(1, Math.floor(Number(document.getElementById(`dn-${r.id}`)?.value) || k.n || 1));
        let d;
        if (b.dataset.v === "r") d = rollDice(n, k.sides);
        else { const vals = String(document.getElementById(`dv-${r.id}`)?.value || "").split(/[^0-9]+/).filter(Boolean).map(Number).filter(v => v >= 1 && v <= k.sides); if (!vals.length) { toast("Type the results, e.g. 4,6"); break; } d = { kept: vals, dropped: [] }; }
        if (k.minus) d.hand = Number(document.getElementById(`dh-${r.id}`)?.value) || 0;
        if (k.each && b.dataset.v === "r") { const per = seated(room).filter(o => !isOut(o)).map(o => [o.name, 1 + Math.floor(Math.random() * k.sides)]); d.each = per.map(([nm, v]) => `${nm} ${v}`).join(", "); if (b.dataset.v === "r") d.kept = [per.find(([nm]) => nm === me.name)?.[1] || d.kept[0]]; }
        r.dice = d;
        logTo(code, `🎲 ${me.name} rolled ${d.kept.join(", ")}${d.dropped.length ? ` (dropped ${d.dropped.join(", ")})` : ""} on d${k.sides} (${r.src})${d.each ? ` — ${d.each}` : ""}`);
        const fx = [];
        const tx = String(r.text || "");
        { const m = tx.match(/create a number of (.+?) tokens? (?:with [^.]+? )?equal to the result/i) || tx.match(/you create a number of (.+?) equal to the result/i); if (m) { const v = d.kept.reduce((a, b2) => a + b2, 0), sp = spellAbility({ n: `${r.src} · dice`, t: "Instant", o: `Create ${v} ${m[1].replace(/ tokens?$/i, "")} tokens${/with flying/i.test(tx) && !/with flying/i.test(m[1]) ? " with flying" : ""}.` }); const toks = sp.effs.filter(f => f.k === "tok"); if (toks.length) { act([{ type: "effects", effs: toks.map(f => ({ ...f, n: v })), times: 1, count: 1, src: r.src }]); fx.push(`created ${v}`); } } }
        const ev = d.kept.filter(v => v % 2 === 0).length, od = d.kept.length - ev, diff = new Set(d.kept).size;
        [["even", ev], ["odd", od], ["different", diff]].forEach(([w, cnt]) => { const m = tx.match(new RegExp(`for each ${w} result, create an? (.+?) token((?: with [^.]+?)?)(?: named [^.]+)?\\.`, "i")); if (m && cnt) { const sp = spellAbility({ n: `${r.src} · ${w}`, t: "Instant", o: `Create ${cnt} ${m[1]} tokens${m[2] || ""}.` }); const toks = sp.effs.filter(f => f.k === "tok"); if (toks.length) { act([{ type: "effects", effs: toks.map(f => ({ ...f, n: cnt })), times: 1, count: 1, src: r.src }]); fx.push(`${cnt} ${w} → ${toks[0].name}`); } }
          const cm = tx.match(new RegExp(`for each ${w} result, put an? \\+1\\/\\+1 counter on this`, "i")); if (cm && cnt && r.srcId && me.bf?.[r.srcId]) { mutate(p => { const y = p.bf?.[r.srcId]; if (y) { y.c ||= {}; y.c.p1p1 = (y.c.p1p1 || 0) + cnt; } }); fx.push(`+${cnt} +1/+1`); }
          const tm = tx.match(new RegExp(`create a tapped treasure token for each ${w} result`, "i")); if (tm && cnt) { act([{ type: "create", name: "Treasure", n: cnt, desc: "Treasure", tapped: true, src: r.src }]); fx.push(`${cnt} tapped Treasure`); } });
        if (/if you rolled 6 exactly seven times, you win the game/i.test(tx) && d.kept.filter(v => v === 6).length === 7) reminders.push({ id: newId(), src: r.src, text: "You rolled 6 exactly seven times.", times: 1, winAsk: true });
        const trig = diceRolled(d.kept, r.src, !!r.visitRoll);
        if (r.visitRoll) { const v = d.kept[0], atts = Object.entries(me.bf || {}).filter(([, e]) => /\bAttraction\b/.test(e.t || ""));
          atts.forEach(([id, e]) => { const vt = String(e.o || lookupCard(e.n)?.o || "").match(/visit — ([^\n]+)/i); reminders.push(normalizeRem({ id: newId(), src: `🎡 ${dispName(e)}`, srcId: id, text: `If ${v} is lit on ${dispName(e)}, visit it: ${vt ? vt[1] : "use its visit ability"}`, times: 1, visitOf: id })); });
          if (atts.length) logTo(code, `🎡 ${me.name} rolled ${v} to visit ${atts.length} Attraction${atts.length === 1 ? "" : "s"}`); }
        d.auto = [fx.join(", "), trig].filter(Boolean).join(" · ");
        render(); break;
      }
      case "planar-open": {
        const tn = room?.turnNo || 0; if (planarT !== tn) { planarT = tn; planarN = 0; }
        reminders.push({ id: newId(), src: "🌀 Planar die", text: `Roll the planar die. This roll costs {${planarN}}.`, times: 1, planar: true });
        render(); break;
      }
      case "planar-go": {
        const r = reminders.find(x => x.id === b.dataset.id); if (!r) break;
        reminders = reminders.filter(x => x !== r);
        let v = b.dataset.v; if (v === "r") { const d = 1 + Math.floor(Math.random() * 6); v = d === 1 ? "chaos" : d === 6 ? "pw" : "blank"; }
        planarN += 1;
        logTo(code, `🌀 ${me.name} rolled the planar die: ${v === "chaos" ? "chaos ensues" : v === "pw" ? "planeswalk" : "blank"}`);
        const planes = seated(room).flatMap(o => Object.entries(o.bf || {}).filter(([, e]) => /\b(Plane|Phenomenon)\b/.test(e.t || "")).map(([id, e]) => [id, e, o]));
        const fire = re => planes.forEach(([id, e, o]) => { for (const m of String(e.o || lookupCard(e.n)?.o || "").matchAll(re)) {
          const sp = spellAbility({ n: `${e.n} · ${m[0].slice(0, 40)}`, t: "Instant", o: m[1] });
          reminders.push(normalizeRem({ id: newId(), src: `🌀 ${dispName(e)}`, srcId: o.id === pid ? id : undefined, text: m[1].replace(/^\w/, c => c.toUpperCase()), times: 1, ...(sp.effs.some(f => f.k !== "selfc") ? { effs: sp.effs.filter(f => f.k !== "selfc") } : {}) })); } }); // "it" on a plane means the target, never the plane
        fire(/^whenever you roll the planar die, ([^\n]+)/gim);
        if (v === "chaos") fire(/^(?:whenever|when) chaos ensues, ([^\n]+)/gim);
        if (v === "pw") reminders.push({ id: newId(), src: "🌀 Planeswalk", text: "Put the current plane on the bottom of the planar deck and reveal the next one (play it from your deck search).", times: 1 });
        render(); break;
      }
      case "free-roll": {
        reminders.push({ id: newId(), src: "🎲 Dice", text: `Roll a d${b.dataset.s === "20" ? 20 : 6}.`, times: 1 });
        render(); break;
      }
      case "dice-do": {
        const r = reminders.find(x => x.id === b.dataset.id); if (!r?.dice) break;
        const k = diceSpec(r.text), tot = r.dice.kept.reduce((a, b2) => a + b2, 0) - (k?.minus ? Number(r.dice.hand) || 0 : 0), row = diceTable(r).find(x => tot >= x.lo && tot <= x.hi);
        if (row) reminders.push(normalizeRem({ id: newId(), src: `${r.src} (${tot})`, srcId: r.srcId, text: row.text.replace(/^\[([+−-]\d+)\],? (?:then )?/i, "Loyalty $1, then ").replace(/^\w/, c => c.toUpperCase()), times: 1 }));
        reminders = reminders.filter(x => x !== r); render(); break;
      }
      case "coin-go": {
        const r = reminders.find(x => x.id === b.dataset.id); if (!r) break;
        const thumb = Object.values(me.bf || {}).some(x => /if you would flip a coin, instead flip two coins and ignore one/i.test(x.o || lookupCard(x.n)?.o || ""));
        const flip = () => Math.random() < 0.5;
        const win = b.dataset.v === "r" ? (thumb ? flip() || flip() : flip()) : b.dataset.v === "1";
        r.flips ||= { w: 0, l: 0 }; if (win) r.flips.w += 1; else r.flips.l += 1;
        logTo(code, `🪙 ${me.name} ${win ? "won" : "lost"} a coin flip (${r.src})${b.dataset.v === "r" ? ` — flipped by the app${thumb ? ", Krark's Thumb: best of two" : ""}` : ""}`);
        if (b.dataset.v === "r") toast(win ? "🪙 Won the flip!" : "🪙 Lost the flip");
        coinResult(win, r.src);
        render(); break;
      }
      case "xpl-go": {
        const r = reminders.find(x => x.id === b.dataset.id), cid = b.dataset.c, e = me.bf?.[cid]; if (!r || !e) break;
        r.expl ||= {}; r.expl[cid] = (r.expl[cid] || 0) + 1;
        const land = b.dataset.v === "land";
        if (land) { if (dig?.on && dig.lib.length) { dig.hand.push(dig.lib.shift()); digSave(); setTimeout(() => { try { renderHand(); } catch {} }, 0); } logTo(code, `🧭 ${me.name}'s ${dispName(e)} explored: a land → hand`); toast("Put the land into your hand"); }
        else { mutate(p => { const x = p.bf?.[cid]; if (x) { x.c ||= {}; x.c.p1p1 = (x.c.p1p1 || 0) + 1; } }); logTo(code, `🧭 ${me.name}'s ${dispName(e)} explored: nonland → +1/+1 counter (keep it on top or put it in the graveyard)`); }
        setTimeout(() => act([{ type: "explore", land, n: 1, id: cid }, ...(land ? [] : [{ type: "counters", n: 1, id: cid }])]), 0);
        const ids = exploreWho(r) || [], per = 2 ** Object.values(me.bf || {}).filter(x => /if a creature you control would explore, instead it explores, then it explores again/i.test(x.o || lookupCard(x.n)?.o || "")).length;
        if (/target creature you control explores/i.test(r.text || "") ? Object.values(r.expl).some(v => v >= per) : ids.every(id => (r.expl[id] || 0) >= per)) r.explDone = true;
        render(); break;
      }
      case "mut-go": {
        const r = reminders.find(x => x.id === b.dataset.id), tid = document.getElementById(`mut-${b.dataset.id}`)?.value, e = me.bf?.[tid];
        if (!r?.mutPick || !e) break;
        const card = r.mutPick.card, top = b.dataset.v === "top";
        reminders = reminders.filter(x => x !== r);
        if (r.mutPick.cost && me.pool && Object.keys(me.pool).length) payPool(r.mutPick.cost, `${card.n} (mutate)`);
        broadcastCast(card);
        const own = x => ({ n: x.n, t: x.t || "", m: x.m || "", o: x.mutO ?? x.o ?? lookupCard(x.n)?.o ?? "", p: x.p ?? null, tg: x.tg ?? null, img: x.img || "" });
        mutate(p => { const x = p.bf?.[tid]; if (!x) return;
          const list = x.mutCards?.length ? [...x.mutCards] : [own(x)];
          if (top) list.unshift(card); else list.push(card);
          const t0 = list[0];
          x.mutCards = list; x.n = t0.n; x.t = t0.t; x.m = t0.m; x.img = t0.img; x.mutO = t0.o;
          if (t0.p != null) x.p = t0.p; if (t0.tg != null) x.tg = t0.tg;
          x.o = list.map(c => c.o).filter(Boolean).join("\n"); });
        logTo(code, `🧬 ${me.name} mutated ${dispName(card)} ${top ? "on top of" : "under"} ${dispName(e)}${top ? ` (it's now ${dispName(card)})` : ""}`);
        setTimeout(() => act([{ type: "cast", card }, { type: "mutates", id: tid, n: (me.bf?.[tid]?.mutCards?.length || 2) - 1 }]), 0);
        render(); break;
      }
      case "xup-go": {
        const r = reminders.find(x => x.id === b.dataset.id); if (!r) break;
        r.extraUp -= 1; if (r.extraUp <= 0) reminders = reminders.filter(x => x !== r);
        logTo(code, `⏮ ${me.name}: an additional upkeep step (${r.src})`);
        phaseEvents([{ type: "phase", phase: "upkeep", mine: true, active: pid }]);
        render(); break;
      }
      case "zur-go": {
        const r = reminders.find(x => x.id === b.dataset.id), id = document.getElementById(`zur-${b.dataset.id}`)?.value, e = me.bf?.[id];
        if (!r || !e) break;
        const v = manaValue(e.m);
        mutate(p => { const x = p.bf?.[id]; if (!x) return; x.t = x.t.replace(/\bEnchantment\b/, "Enchantment Creature"); x.p = String(v); x.tg = String(v); });
        logTo(code, `⚙ ${r.src}: ${me.name}'s ${dispName(e)} is now a ${v}/${v} enchantment creature`);
        reminders = reminders.filter(x => x !== r); render(); break;
      }
      case "rad-go": {
        const r = reminders.find(x => x.id === b.dataset.id); if (!r) break;
        const n = Math.max(0, Math.floor(Number(document.getElementById(`radn-${r.id}`)?.value) || 0)); if (!n) { toast("How many rad counters?"); break; }
        const live = seated(room).filter(o => !isOut(o));
        const ids = b.dataset.p === "all" ? live.map(o => o.id) : b.dataset.p === "opps" ? live.filter(o => o.id !== pid).map(o => o.id) : [b.dataset.p];
        giveRad(ids, n, r.src);
        if (!/target player|that player|they/i.test(r.text) || b.dataset.p === "all" || b.dataset.p === "opps") r.radDone = true;
        render(); break;
      }
      case "dsc-go": {
        const r = reminders.find(x => x.id === b.dataset.id), c = deck?.cards[Number(document.getElementById(`dsc-${b.dataset.id}`)?.value)];
        if (!r || !c) break;
        r.discDone = true;
        if (dig?.on) { const li = dig.lib.indexOf(c.n); if (li >= 0) dig.lib.splice(li, 1); if (b.dataset.v !== "cast") dig.hand.push(c.n); digSave(); setTimeout(() => { try { renderHand(); } catch {} }, 0); }
        if (b.dataset.v === "cast") { logTo(code, `🔭 ${me.name} discovered ${dispName(c)} (${r.src}) and cast it without paying its mana cost`); playCard(c, { free: true }); }
        else { logTo(code, `🔭 ${me.name} discovered ${dispName(c)} (${r.src}) → hand`); toast(`${dispName(c)} → your hand`); }
        render(); break;
      }
      case "radmill-go": {
        const r = reminders.find(x => x.id === b.dataset.id); if (!r) break;
        reminders = reminders.filter(x => x !== r);
        sendNote(pid, { kind: "millLog", n: r.radMill, src: "☢ Radiation", text: "", rad: true });
        render(); break;
      }
      case "tdraw-go": {
        const r = reminders.find(x => x.id === b.dataset.id);
        if (!r) break;
        const n = b.dataset.n !== "" ? Number(b.dataset.n) : Math.max(0, Math.floor(Number(document.getElementById(`tdn-${r.id}`)?.value) || 0));
        if (b.dataset.n === "" && !document.getElementById(`tdn-${r.id}`)?.value) { toast("Type how many first."); break; }
        if (n) broadcastDraw(n, `${r.src}${b.dataset.w ? ` (${b.dataset.w})` : ""}`);
        else logTo(code, `${me.name}'s ${r.src}: drew 0`);
        reminders = reminders.filter(x => x.id !== r.id);
        render();
        break;
      }
      case "note-drew": { // another player's wheel (Windfall): record my draws so Psychosis/Scrawling Crawler and friends see them
        const nid = b.dataset.n, n = room.notes?.[pid]?.[nid]; if (!n) break;
        update(ref(db, `rooms/${code}/notes/${pid}`), { [nid]: null });
        broadcastDraw(Number(n.drawN) || 0, n.src || ""); render(); break;
      }
      case "draw-go": {
        const r = reminders.find(x => x.id === b.dataset.id);
        if (!r) break;
        broadcastDraw(Number(b.dataset.n), r.src);
        if (b.dataset.one && r.times > 1) r.times -= 1;
        else reminders = reminders.filter(x => x.id !== r.id);
        render();
        break;
      }
      case "pact-paid": {
        const r = reminders.find(x => x.id === b.dataset.id);
        if (!r) break;
        reminders = reminders.filter(x => x.id !== r.id);
        logTo(code, `${me.name} paid ${r.pact.cost} for ${r.src}`);
        act([], p => { delete p.delayed?.[r.pact.id]; });
        break;
      }
      case "pact-lose": case "lose-me": {
        const r = reminders.find(x => x.id === b.dataset.id);
        if (!r || !confirm("Confirm: you lose the game?")) break;
        reminders = reminders.filter(x => x.id !== r.id);
        if (r.pact) act([], p => { delete p.delayed?.[r.pact.id]; });
        markLost(r.pact ? `couldn't pay for ${r.src}` : r.src);
        break;
      }
      case "lose-target": {
        const r = reminders.find(x => x.id === b.dataset.id), o = room.players?.[b.dataset.o];
        if (!r || !o || !windowState(r).ready) break;
        clearWindow(r);
        reminders = reminders.filter(x => x.id !== r.id);
        sendOrders({ [b.dataset.o]: {} }, { how: "lose", src: r.src });
        commitCrime("target player");
        render();
        break;
      }
      case "mill-to": {
        const r = reminders.find(x => x.id === b.dataset.id);
        if (!r) break;
        reminders = reminders.filter(x => x !== r);
        sendNote(b.dataset.o, { kind: "millLog", n: r.millTarget.n === "X" ? 1 : r.millTarget.n, src: r.src, text: "" });
        logTo(code, `🪦 ${r.src}: ${b.dataset.o === pid ? me.name : room.players?.[b.dataset.o]?.name} mills ${r.millTarget.n}`);
        render(); break;
      }
      case "convoke-go": {
        const r = reminders.find(x => x.id === b.dataset.id);
        if (!r) break;
        const ids = [...document.querySelectorAll(`.cv-box[data-rid="${r.id}"]:checked`)].map(x => x.value);
        const toks = [...document.querySelectorAll(`.cv-tok[data-rid="${r.id}"]`)].map(x => [x.dataset.k, Math.max(0, Number(x.value) || 0)]).filter(([, n]) => n);
        reminders = reminders.filter(x => x !== r);
        const n = ids.length + toks.reduce((a, [, k]) => a + k, 0);
        if (n) {
          act(ids.filter(id => !me.bf?.[id]?.tap).map(id => ({ type: "tapped", id })), p => { ids.forEach(id => { if (p.bf?.[id]) p.bf[id].tap = true; }); toks.forEach(([k, c]) => { const t = p.tokens?.[k]; if (t) t.tapped = Math.min(t.count, (t.tapped || 0) + c); }); });
          logTo(code, `${me.name} tapped ${n} creature${n === 1 ? "" : "s"} to convoke ${r.src} (paid ${n} of the cost)`);
        }
        render(); break;
      }
      case "forage-food": case "forage-gy": {
        const r = reminders.find(x => x.id === b.dataset.id);
        if (!r) break;
        let events = [], apply = null, what = "";
        if (b.dataset.a === "forage-food") {
          const k = Object.keys(me.tokens || {}).find(x => me.tokens[x].name === "Food" && me.tokens[x].count > 0);
          const sx = k && sacPrep(`tok:${k}`);
          if (!sx) { toast("No Food to sacrifice."); break; }
          events = sx.events; apply = sx.apply; what = "sacrificed a Food";
        } else {
          const gids = [...new Set([...document.querySelectorAll(`.fg-pick[data-rid="${r.id}"]`)].map(x => x.value))];
          if (gids.length < 3) { toast("Pick three different cards."); break; }
          apply = p => gids.forEach(g => { const x = p.gy?.[g]; if (!x) return; delete p.gy[g]; p.ex ||= {}; p.ex[newId()] = { ...x, at: Date.now() }; });
          what = `exiled ${gids.map(g => dispName(me.gy[g])).join(", ")} from their graveyard`;
        }
        reminders = reminders.filter(x => x !== r);
        logTo(code, `🍂 ${me.name} foraged (${what}) for ${r.src}`);
        if (r.forage) { act(events, apply); activate(r.forage.id, r.forage.i, { foraged: true }); }
        else { act([...events, ...(r.sacThen.then.length ? [{ type: "effects", effs: r.sacThen.then, times: 1, count: 1, src: r.src, srcId: r.srcId }] : [])], apply); thenLeftover(r); }
        render(); break;
      }
      case "type-go": {
        const r = reminders.find(x => x.id === b.dataset.id);
        const v = (document.getElementById(`ct-${b.dataset.id}`)?.value || "").trim();
        if (!r || !v) { toast("Type a creature type."); break; }
        const ty = v.charAt(0).toUpperCase() + v.slice(1);
        reminders = reminders.filter(x => x !== r);
        mutate(p => { const x = p.bf?.[r.chooseType]; if (!x) return; x.ctype = ty;
          const o0 = String(x.o || lookupCard(x.n)?.o || "");
          const o1 = o0.replace(/creatures you control of the chosen type get \+/gi, `${ty} creatures you control get +`)
            .replace(/creature spells you cast of the chosen type cost/gi, `${ty} spells you cast cost`).replace(/creature spells of the chosen type cost/gi, `${ty} spells cost`)
            .replace(/whenever a creature you control of the chosen type enters or attacks, ([^.\n]+)\./gi, (m, fx) => `Whenever ${/^[AEIOU]/.test(ty) ? "an" : "a"} ${ty} you control enters, ${fx}.\nWhenever ${/^[AEIOU]/.test(ty) ? "an" : "a"} ${ty} you control attacks, ${fx}.`)
.replace(/if a triggered ability of another creature you control of the chosen type triggers, it triggers an additional time/gi, `If a triggered ability of a ${ty} you control triggers, that ability triggers an additional time`)
            .replace(/another creature you control of the chosen type enters/gi, `another ${ty} you control enters`).replace(/whenever you cast a spell of the chosen type/gi, `Whenever you cast a ${ty} spell`);
          if (o1 !== o0) { x.o = o1; x.mode = ty; } });
        logTo(code, `🏷 ${me.name} chose ${ty} for ${r.src}`);
        render(); break;
      }
      case "escape-go": {
        const r = reminders.find(x => x.id === b.dataset.id);
        if (!r) break;
        const gids = [...new Set([...document.querySelectorAll(`.ee-pick[data-rid="${r.id}"]`)].map(x => x.value))];
        if (gids.length < r.escapeEx.n) { toast(`Pick ${r.escapeEx.n} different cards.`); break; }
        reminders = reminders.filter(x => x !== r);
        logTo(code, `${me.name} exiled ${gids.map(g => dispName(me.gy[g])).join(", ")} from their graveyard (escape: ${r.src})`);
        act([], p => gids.forEach(g => { const x = p.gy?.[g]; if (!x) return; delete p.gy[g]; p.ex ||= {}; p.ex[newId()] = { ...x, at: Date.now() }; }));
        render(); break;
      }
      case "suspect-go": {
        const r = reminders.find(x => x.id === b.dataset.id), v = document.getElementById(`su-${b.dataset.id}`)?.value;
        if (!r || !v) break;
        reminders = reminders.filter(x => x !== r);
        const [oid, kind, id] = v.split("|");
        if (oid === pid) suspectMine(kind, id, r.src); else sendOrders({ [oid]: {} }, { how: "suspect", kind, id, src: r.src });
        render(); break;
      }
      case "samemv-go": {
        const r = reminders.find(x => x.id === b.dataset.id), c = deck?.cards[Number(document.getElementById(`pb-${b.dataset.id}`)?.value)];
        if (!r || !c) break;
        reminders = reminders.filter(x => x !== r);
        const same = manaValue(c.m) === r.sameMv.mv;
        logTo(code, `${me.name} revealed ${dispName(c)} (${r.src}): mana value ${manaValue(c.m)} vs ${r.sameMv.mv}${same ? " — match!" : " — no match"}`);
        if (same) reminders.push({ id: newId(), src: r.src, text: `Cast ${dispName(c)} without paying its mana cost?`, times: 1, freeCast: deck.cards.indexOf(c) });
        render(); break;
      }
      case "free-cast": {
        const r = reminders.find(x => x.id === b.dataset.id), c = r && deck?.cards[r.freeCast];
        if (!c) break;
        reminders = reminders.filter(x => x !== r);
        logTo(code, `${me.name} cast ${dispName(c)} for free (${r.src})`);
        playCard(c, {}); break;
      }
      case "tab-go": {
        const r = reminders.find(x => x.id === b.dataset.id);
        if (!r) break;
        reminders = reminders.filter(x => x !== r);
        const keep = new Set([...document.querySelectorAll(`.tb-box[data-rid="${r.id}"]:checked`)].map(x => x.value));
        const tokKeep = Object.fromEntries([...document.querySelectorAll(`.tb-tok[data-rid="${r.id}"]`)].map(x => [x.dataset.k, Math.max(0, Number(x.value) || 0)]));
        const dieCards = Object.entries(me.bf || {}).filter(([id, e]) => /\bCreature\b/.test(e.t || "") && !keep.has(id) && !isIndestructible(e, id));
        const dieToks = Object.entries(me.tokens || {}).filter(([k, t]) => isCreatureToken(t.name) && t.count > 0 && (tokKeep[k] ?? t.count) < t.count).map(([k, t]) => [k, t.count - (tokKeep[k] ?? t.count)]);
        const paid = keep.size + Object.values(tokKeep).reduce((a, n) => a + n, 0);
        logTo(code, `⛪ ${me.name} paid {${paid * r.tabernacle.n}} for ${paid} creature${paid === 1 ? "" : "s"}${dieCards.length || dieToks.length ? `; destroyed ${[...dieCards.map(([, e]) => dispName(e)), ...dieToks.map(([k, n]) => `${n} ${me.tokens[k].name}`)].join(", ")}` : ""} (${r.src})`);
        const events = [...(dieCards.length ? [{ type: "dies", n: dieCards.length, token: false, ids: dieCards.map(([id]) => id) }] : []), ...(dieToks.length ? [{ type: "dies", n: dieToks.reduce((a, [, n]) => a + n, 0), token: true }] : [])];
        act(events, p => dieToks.forEach(([k, n]) => { const t = p.tokens?.[k]; if (!t) return; t.count -= n; if (t.tapped > t.count) t.tapped = t.count; if (t.count <= 0) delete p.tokens[k]; }),
          p => dieCards.forEach(([id]) => { const x = p.bf?.[id]; if (!x) return; delete p.bf[id]; toZone(p, x, "gy"); }));
        render(); break;
      }
      case "pair-go": {
        const r = reminders.find(x => x.id === b.dataset.id), other = document.getElementById(`sb-${b.dataset.id}`)?.value;
        if (!r || !other || !me.bf?.[r.soulbond.id] || !me.bf?.[other]) break;
        reminders = reminders.filter(x => x !== r);
        mutate(p => { p.bf[r.soulbond.id].pair = other; p.bf[other].pair = r.soulbond.id; });
        logTo(code, `🔗 ${me.name} paired ${dispName(me.bf[r.soulbond.id])} with ${dispName(me.bf[other])} (soulbond)`);
        render(); break;
      }
      case "pair-hurt": { const e = me.bf?.[b.dataset.id]; if (e) { reminders.push({ id: newId(), src: dispName(e), srcId: b.dataset.id, text: "It (or its partner) was dealt damage: deal that much to target opponent.", times: 1, pairHurt: true }); render(); } break; }
      case "pairhurt-go": {
        const r = reminders.find(x => x.id === b.dataset.id), o = room.players?.[b.dataset.o];
        if (!r || !o) break;
        reminders = reminders.filter(x => x !== r);
        const n = ampDmg(Math.max(1, Number(document.getElementById(`ph-${r.id}`)?.value) || 1), me.bf?.[r.srcId], true).n;
        act([{ type: "effects", effs: [{ k: "tlose", n, target: b.dataset.o, targetName: o.name }], times: 1, count: 1, src: r.src, srcId: r.srcId }]);
        logTo(code, `💥 ${me.name}'s ${r.src} dealt ${n} damage to ${o.name}`);
        render(); break;
      }
      case "bombs-go": {
        const r = reminders.find(x => x.id === b.dataset.id), o = room.players?.[b.dataset.o], e = r && me.bf?.[r.srcId];
        if (!e || !o) break;
        reminders = reminders.filter(x => x !== r);
        const n = ampDmg(e.c?.[r.bombs.key] || 0, e, true).n;
        act([{ type: "effects", effs: [{ k: "tlose", n, target: b.dataset.o, targetName: o.name }], times: 1, count: 1, src: r.src, srcId: r.srcId }]);
        logTo(code, `🎃 ${me.name}'s ${r.src}: ${n} damage to ${o.name}, who gains control of it`);
        noRelease = true;
        act([], p => { delete p.bf[r.srcId]; });
        noRelease = false;
        sendOrders({ [b.dataset.o]: {} }, { how: "receive", cards: [{ ...e }], toks: [], from: meTag(), src: r.src });
        render(); break;
      }
      case "sacthen-go": {
        const r = reminders.find(x => x.id === b.dataset.id);
        const v = document.getElementById(`st-${b.dataset.id}`)?.value;
        if (!r || !v) break;
        reminders = reminders.filter(x => x !== r);
        const sx = sacPrep(v);
        if (!sx) break;
        logTo(code, `🗡 ${me.name} sacrificed ${sx.label} (${r.src})`);
        act([...sx.events, ...(r.sacThen.then.length ? [{ type: "effects", effs: r.sacThen.then, times: 1, count: 1, src: r.src, srcId: r.srcId }] : [])], sx.apply);
        thenLeftover(r);
        render();
        break;
      }
      case "tgain-go": {
        const r = reminders.find(x => x.id === b.dataset.id);
        if (!r) break;
        reminders = reminders.filter(x => x !== r);
        if (b.dataset.o === pid) act([{ type: "effects", effs: [{ k: "gain", n: r.tgain.n }], times: 1, count: 1, src: r.src }]);
        else { sendOrders({ [b.dataset.o]: {} }, { how: "fx", effs: [{ k: "gain", n: r.tgain.n }], src: r.src }); logTo(code, `${r.src}: ${room.players?.[b.dataset.o]?.name} gains ${r.tgain.n} life`); }
        render();
        break;
      }
      case "gyone-go": {
        const r = reminders.find(x => x.id === b.dataset.id);
        const v = document.getElementById(`go-${b.dataset.id}`)?.value;
        if (!r || !v) break;
        reminders = reminders.filter(x => x !== r);
        const [oid, gid] = v.split("|");
        const gc = room.players?.[oid]?.gy?.[gid], host = r.srcId && me.bf?.[r.srcId];
        if (gc && host && /\bCreature\b/.test(gc.t || "") && /have all activated abilities of all creature cards exiled with/i.test(host.o || lookupCard(host.n)?.o || ""))
          mutate(p => { const h = p.bf?.[r.srcId]; if (h) h.brew = [...(h.brew || []), gc.n]; });
        if (oid === pid) executeOrder({ how: "gyOne", id: gid, src: r.src, byName: me.name });
        else sendOrders({ [oid]: {} }, { how: "gyOne", id: gid, src: r.src });
        render();
        break;
      }
      case "myriad-go": {
        const r = reminders.find(x => x.id === b.dataset.id);
        if (!r) break;
        reminders = reminders.filter(x => x !== r);
        myriadAttack(r.myriad);
        break;
      }
      case "sac-go": {
        const r = reminders.find(x => x.id === b.dataset.id);
        const v = document.getElementById(`sc-${b.dataset.id}`)?.value;
        if (!r || !v) break;
        reminders = reminders.filter(x => x !== r);
        const what = v.startsWith("tok:") ? `a ${me.tokens?.[v.slice(4)]?.name || "token"} token` : dispName(me.bf?.[v.slice(3)] || {});
        logTo(code, `🗡 ${me.name} sacrificed ${what} (${dispName(me.bf?.[r.sacCost.id] || {})})`);
        activate(r.sacCost.id, r.sacCost.i, { sac: v });
        break;
      }
      case "nc-yes": {
        const r = reminders.find(x => x.id === b.dataset.id);
        if (!r) break;
        reminders = reminders.filter(x => x !== r);
        addRider({ kind: "nc", src: r.src, at: Date.now(), ...(r.ncType ? { ctype: r.ncType } : {}) });
        toast(`Your next ${r.ncType ? `${r.ncType} creature` : "legendary"} spell this turn can't be countered (${r.src})`);
        render();
        break;
      }
      case "color-go": {
        const r = reminders.find(x => x.id === b.dataset.id);
        if (!r) break;
        reminders = reminders.filter(x => x !== r);
        mutate(p => { if (p.bf?.[r.chooseColor]) p.bf[r.chooseColor].color = b.dataset.c; });
        logTo(code, `🎨 ${me.name} chose ${b.dataset.c} for ${r.src}`);
        render();
        break;
      }
      case "land-grant": { const r = reminders.find(x => x.id === b.dataset.id); if (r) useLandGrant(r, b.dataset.s, b.dataset.t); break; }
      case "attach-go": {
        const r = reminders.find(x => x.id === b.dataset.id);
        const v = document.getElementById(`ap-${b.dataset.id}`)?.value;
        if (!v) break;
        if (r) reminders = reminders.filter(x => x !== r);
        reminders = reminders.filter(x => !(x.src === r?.src && /^Bestowed: attach it to a creature/i.test(x.text || ""))); // the "attach it" note is done too
        attachTo(b.dataset.s, v);
        break;
      }
      case "attach-new": {
        const r = reminders.find(x => x.id === b.dataset.id);
        if (!r) break;
        reminders = reminders.filter(x => x !== r);
        attachTo(r.srcId, b.dataset.v);
        break;
      }
      case "equip-go": {
        const v = document.getElementById(`eq-${b.dataset.id}`)?.value;
        if (v?.startsWith("bf:")) valiantCheck(v.slice(3), /\bAura\b/.test(me.bf?.[b.dataset.id]?.t || "")); // equip and aura targets count (heroic: only Aura spells)
        if (v) attachTo(b.dataset.id, v);
        break;
      }
      case "unattach": attachTo(b.dataset.id, null); break;
      case "regen-go": {
        const r = reminders.find(x => x.id === b.dataset.id);
        const v = document.getElementById(`rg-${b.dataset.id}`)?.value;
        if (!r || !v) break;
        reminders = reminders.filter(x => x !== r);
        const name = v.startsWith("bf:") ? dispName(me.bf[v.slice(3)] || {}) : `${me.tokens?.[v.slice(4)]?.name || "?"} token`;
        mutate(p => {
          if (v.startsWith("bf:")) { p.shields ||= {}; p.shields[v] = (p.shields[v] || 0) + 1; return; }
          const t = p.tokens?.[v.slice(4)]; if (!t) return;
          if (t.count === 1) { t.sh = (t.sh || 0) + 1; tidyTokenStacks(p); return; }
          // one token of the stack gets the shield, so it splits off into its own row
          const tappedOne = (t.tapped || 0) >= t.count, freshOne = (t.fresh?.n || 0) > 0;
          const one = { ...t, count: 1, sh: (t.sh || 0) + 1 }; delete one.tapped; delete one.fresh;
          if (tappedOne) one.tapped = 1; if (freshOne) one.fresh = { turnNo: t.fresh.turnNo, n: 1 };
          t.count -= 1; if (tappedOne) t.tapped -= 1; if (freshOne) t.fresh.n -= 1;
          p.tokens[`__sh_${Date.now()}`] = one; tidyTokenStacks(p);
        });
        logTo(code, `♻ ${me.name}: ${r.src} — ${name} will regenerate the next time it would be destroyed this turn`);
        render();
        break;
      }
      case "tok-atkmenu": atkOpen = atkOpen === b.dataset.k ? null : b.dataset.k; render(); break;
      case "tok-atk": {
        const k = b.dataset.k, t = me.tokens?.[k];
        if (!t) break;
        const free = t.count - (t.tapped || 0);
        const n = Math.max(1, Math.min(free, Number(document.getElementById(`ta-${k}`)?.value) || free));
        if (!free) { toast("They're all tapped."); break; }
        const vig = kwsOf(tokenPerm(t), pid, k, true).some(x => x.k === "vigilance");
        const per = Number(String(tokPTfx(t, pid, k) || "0/0").split("/")[0]) || 0;
        logTo(code, `${me.name}: ${n} ${t.name} token${n === 1 ? "" : "s"} attack`);
        act([{ type: "attacks", tok: t.name, t: tokenPerm(t).t, n, kws: kwsOf(tokenPerm(t), pid, k, true).map(x => x.k) }, ...youAttackEv()], p => { p.youAtk = combatKey(); const x = p.tokens?.[k]; if (x && !vig) x.tapped = Math.min(x.count, (x.tapped || 0) + n); if (!vig) markAttacked(p, "tok", k, n); });
        atkOpen = null;
        startAttack(n === 1 ? t.name : `${n} ${t.name}s`, { name: t.name, power: per * n, cmd: false, ownId: null, loses: false, times: n, stats: myAtkStats("tok", k) }, ringBearer(me)?.k === k && n === 1, t, kwsOf(tokenPerm(t), pid, k, true));
        if (b.dataset.o) { const r = reminders.filter(x => x.attack).at(-1); if (r) sendAttack(r, b.dataset.o); }
        break;
      }
      case "pool-open": poolOpen = !poolOpen; render(); break;
      case "untap-one": { const r = reminders.find(x => x.id === b.dataset.id); if (!r) break; reminders = reminders.filter(x => x !== r); if (me.bf?.[r.untapOne]?.tap) toggleTap(r.untapOne); render(); break; }
      case "extra-combat": if (room.turn === pid) extraCombat(); break;
      case "copycre-go": {
        const r = reminders.find(x => x.id === b.dataset.id), v = document.getElementById(`cc-${b.dataset.id}`)?.value;
        if (!r || !v) break;
        reminders = reminders.filter(x => x !== r);
        const src = v.startsWith("bf:") ? me.bf[v.slice(3)] : (() => { const t = me.tokens?.[v.slice(4)]; return t ? { n: t.name, t: tokenPerm(t).t.replace(/^Token /, ""), desc: t.desc } : null; })();
        if (!src) break;
        const card = lookupCard(src.n) || src, pt = card.p != null ? `${card.p}/${card.tg}` : (String(src.desc || "").match(/\d+\/\d+/) || ["1/1"])[0];
        const tl = String(card.t || src.t || "Creature").replace(/^Legendary /, "");
        act([{ type: "create", name: src.n, n: 1, desc: `${pt} copy of ${src.n}`, src: r.src }], null, p => { Object.values(p.tokens || {}).forEach(t => { if (t.name === src.n && !t.tl) { t.tl = tl; if (r.copyCreature.eotSac) t.sacEnd = true; } }); tidyTokenStacks(p); });
        logTo(code, `${me.name}: ${r.src} made a token copy of ${dispName(src)}${r.copyCreature.eotSac ? " (sacrificed at the next end step)" : ""}`);
        render(); break;
      }
      case "mana-mode": trackMana = !trackMana; store.set("mtga_mana", trackMana ? "on" : "off"); toast(trackMana ? "Mana tracking on: ⚡ buttons tap into your mana pool" : "Mana tracking off"); render(); break;
      case "pool-add": poolAdd(`{${b.dataset.c}}`); render(); break;
      case "phyx-go": { // Phyrexian mana: k symbols paid with 2 life each, the rest with mana (from the pool if it's tracked)
        const r = reminders.find(x => x.id === b.dataset.id); if (!r) break;
        const k = Number(b.dataset.k) || 0, syms = r.phyx.match(/\{[^}]+\}/g) || [], life = 2 * k;
        reminders = reminders.filter(x => x !== r);
        if (life) { mutate(p => { p.life = (p.life ?? START_LIFE) - life; }); logTo(code, `${me.name} paid ${life} life for ${r.src}'s Phyrexian mana`); }
        const rest = syms.slice(k).map(x => x.replace("/P", "")).join("");
        if (rest) { if (me.pool && Object.keys(me.pool).length) payPool(rest, `${r.src} (Phyrexian mana)`); else logTo(code, `${me.name} paid ${rest} for ${r.src}'s Phyrexian mana`); }
        render(); break;
      }
      case "pool-clear": mutate(p => { delete p.pool; delete p.poolC; delete p.poolHaste; delete p.poolHasteSrc; }); render(); break;
      case "pool-spend": {
        const c = b.dataset.c, k = b.dataset.combat ? "poolC" : "pool";
        if (c === "C" && k === "pool" && me.poolHaste && (me.pool?.C || 0) > me.poolHaste) { /* plain {C} first: keep the Hall mana */ }
        else if (c === "C" && k === "pool" && me.poolHaste) toast(`That was ${me.poolHasteSrc || "Hall"}'s {C} (no creature spell, no haste)`);
        mutate(p => { if (!p[k]?.[c]) return; p[k][c] -= 1; if (!p[k][c]) delete p[k][c]; if (!Object.keys(p[k]).length) delete p[k]; if (p.poolHaste > (p.pool?.C || 0)) p.poolHaste = p.pool?.C || 0; if (!p.poolHaste) { delete p.poolHaste; delete p.poolHasteSrc; } });
        render(); break;
      }
      case "tap-mana": { // tap a permanent for mana straight into the pool
        const e = me.bf?.[b.dataset.id];
        if (!e || e.tap) break;
        { const why = actBlocked(e); if (why && !confirm(`${dispName(e)} can't use that ability:\n${why}\n\nUse it anyway?`)) break; }
        let sym = b.dataset.s;
        if (sym.includes("@")) { // pay the {1} first: out of the pool if it's there
          const [out, pay] = sym.split("@"); sym = out;
          payPool(pay, `${dispName(e)}'s mana`);
        }
        const lifePay = Number((sym.match(/~(\d+)/) || [])[1]) || 0, hasteR = /\^h/.test(sym), ctrAdd = (sym.match(/\+c:(\w+)/) || [])[1]; sym = sym.replace(/~\d+|\^h|\+c:\w+/g, "");
        if (ctrAdd) { const tid = b.dataset.id; setTimeout(() => { mutate(p => { const x = p.bf?.[tid]; if (x) { x.c ||= {}; x.c[ctrAdd] = (x.c[ctrAdd] || 0) + 1; } }); logTo(code, `⏳ ${dispName(e)}: +1 ${ctrAdd} counter → ${(me.bf?.[tid]?.c?.[ctrAdd] || 0)}`); }, 0); }
        if (lifePay) { mutate(p => { p.life = (p.life ?? START_LIFE) - lifePay; }); logTo(code, `${me.name} paid ${lifePay} life for ${dispName(e)}'s mana`); }
        if (hasteR) { const hs = dispName(e); setTimeout(() => mutate(p => { p.poolHaste = (p.poolHaste || 0) + 1; p.poolHasteSrc = hs; }, true), 0); }
        const eo2 = e.o || lookupCard(e.n)?.o || "";
        const ci = /any color among legendary creatures and planeswalkers you control/i.test(eo2) ? [...new Set(Object.values(me.bf || {}).filter(x => /\bLegendary\b/.test(x.t || "") && /\b(Creature|Planeswalker)\b/.test(x.t || "")).flatMap(x => colorsOf(x.m)))] : /any color in your commander's color identity/i.test(eo2) ? cmdColors() : /any color that a land an opponent controls could produce/i.test(eo2) ? oppLandColors() : null;
        if (sym === "any") { reminders.push({ id: newId(), src: dispName(e), text: ci ? (ci.length ? `Add one mana: ${ci.map(c => `{${c}}`).join(" / ")}.` : "No color available (it adds nothing).") : "Add one mana of any color.", times: 1, anyColor: true, ...(manaMult() > 1 ? { anyN: manaMult(), anyOne: true } : {}), ...(ci ? { colors: ci } : {}) }); toggleTap(b.dataset.id); break; }
        toggleTap(b.dataset.id);
        const mult = manaMult();
        if (/\bCreature\b/.test(e.t || "")) { const bc = Object.values(me.bf || {}).filter(x => /whenever you tap a creature for mana, add an additional \{G\}/i.test(x.o || lookupCard(x.n)?.o || "")).length; if (bc) setTimeout(() => { poolAdd("{G}".repeat(bc), "Badgermole Cub"); render(); }, 0); }
        let extra = "";
        if (/\bLand\b/.test(e.t || "")) { // Caged Sun (+1 of its color), Zendikar Resurgent / Mana Flare / Heartbeat (+1 of what it made)
          const col = (sym.match(/\{([WUBRG])\}/) || [])[1];
          const cagedN = col ? Object.values(me.bf || {}).filter(x => x.color && ({ white: "W", blue: "U", black: "B", red: "R", green: "G" })[x.color] === col && /whenever a land's ability causes you to add one or more mana of the chosen color/i.test(x.o || lookupCard(x.n)?.o || "")).length : 0;
          const sameN = Object.values(me.bf || {}).filter(x => /whenever you tap a land for mana, add one (?:additional )?mana of any type that land produced/i.test(x.o || lookupCard(x.n)?.o || "")).length
            + seated(room).filter(o => !isOut(o)).reduce((a, o) => a + Object.values(o.bf || {}).filter(x => /whenever a player taps a land for mana, (?:that player|its controller) adds (?:one )?(?:additional )?mana of any type that land produced/i.test(x.o || "")).length, 0);
          extra = (col ? `{${col}}`.repeat(cagedN) : "") + (sym.match(/\{[WUBRGC]\}/) || [""])[0].repeat(sameN);
          Object.values(me.bf || {}).forEach(x => { const m = String(x.o || lookupCard(x.n)?.o || "").match(/[Ww]henever you tap an? ([A-Z][a-z]+) for mana, add an additional (\{[WUBRGC]\})/); if (m && new RegExp(`\\b${m[1]}\\b`).test(e.t || "")) extra += m[2]; });
        }
        const pain = Number((sym.match(/!(\d+)$/) || [])[1]) || 0; sym = sym.replace(/!\d+$/, "");
        if (pain) { if (!me.prot?.life) mutate(p => { p.life = (p.life ?? START_LIFE) - pain; }); logTo(code, `💥 ${dispName(e)} dealt ${pain} damage to ${me.name} (mana)`); }
        poolAdd(sym.repeat(mult) + extra, dispName(e) + (mult > 1 ? " ×2" : "") + (extra ? " + extra" : ""));
        render(); break;
      }
      case "tok-mana": {
        const k = b.dataset.k, t = me.tokens?.[k];
        if (!t || t.count - (t.tapped || 0) <= 0) break;
        mutate(p => { const x = p.tokens?.[k]; if (x) x.tapped = Math.min(x.count, (x.tapped || 0) + 1); });
        if (b.dataset.s === "any") reminders.push({ id: newId(), src: `${t.name} token`, text: "Add one mana of any color.", times: 1, anyColor: true, anyN: 1 });
        else poolAdd(b.dataset.s, `${t.name} token`);
        render(); break;
      }
      case "any-color": {
        const r = reminders.find(x => x.id === b.dataset.id);
        if (!r) break;
        if (r.anyOne || (r.anyN || 1) <= 1) { reminders = reminders.filter(x => x !== r); poolAdd(`{${b.dataset.c}}`.repeat(r.anyN || 1), r.src); }
        else { r.anyGot = (r.anyGot || 0) + 1; poolAdd(`{${b.dataset.c}}`, r.src); if (r.anyGot >= r.anyN) reminders = reminders.filter(x => x !== r); }
        render(); break;
      }
      case "mana-pool": {
        const r = reminders.find(x => x.id === b.dataset.id);
        if (!r?.mana) break;
        reminders = reminders.filter(x => x !== r);
        poolAdd(r.mana.syms.repeat(r.mana.n), r.src);
        render(); break;
      }
      case "oracle-go": {
        const r = reminders.find(x => x.id === b.dataset.id);
        if (!r) break;
        const inp = document.getElementById(`or-${r.id}`);
        const lib = b.dataset.empty ? 0 : inp && inp.value !== "" ? Math.max(0, Number(inp.value) || 0) : NaN;
        if (Number.isNaN(lib)) { toast("Enter how many cards are left in your library"); break; }
        const x = devotion(me)[r.oracle.color] || 0;
        reminders = reminders.filter(y => y.id !== r.id);
        if (x >= lib) { logTo(code, `🔮 ${me.name}'s ${r.src}: X = ${x} (devotion to ${r.oracle.colorName}), ${lib} card${lib === 1 ? "" : "s"} in library`); declareWin(r.src); }
        else { logTo(code, `🔮 ${me.name}'s ${r.src}: looked at the top ${x}; ${lib} cards left in library, so no win`); toast(`No win: X = ${x}, library ${lib}`); }
        render();
        break;
      }
      case "ring-go": {
        const r = reminders.find(x => x.id === b.dataset.id);
        if (!r) break;
        const v = document.getElementById(`rb-${r.id}`)?.value || "";
        let bearer = null;
        if (v.startsWith("bf:") && me.bf?.[v.slice(3)]) bearer = { id: v.slice(3), name: dispName(me.bf[v.slice(3)]) };
        else if (v.startsWith("tok:") && me.tokens?.[v.slice(4)]) bearer = { tok: me.tokens[v.slice(4)].name, name: me.tokens[v.slice(4)].name };
        reminders = reminders.filter(y => y.id !== r.id);
        const n = (me.ring?.n || 0) + 1;
        logTo(code, `💍 The Ring tempts ${me.name} (${r.src}) · time #${n}${bearer ? ` · Ring-bearer: ${bearer.name}` : ""}${n <= 4 ? ` · gains: ${RING_LEVELS[n - 1]}` : ""}`);
        act([{ type: "tempt" }, ...(bearer ? [{ type: "ringbearer", id: bearer.id || null }] : [])], p => { p.ring = { n, ...(bearer ? { bearer } : {}) }; });
        render();
        break;
      }
      case "ring-atk": { // the Ring-bearer is a token: attack with one of them
        const rb = ringBearer(me);
        if (!rb?.t) break;
        const power = Number(String(tokPTfx(rb.t, pid, rb.k) || "0/0").split("/")[0]) || 0;
        logTo(code, `${me.name}: ${rb.name} (Ring-bearer) attacks`);
        act([], p => { const t = p.tokens?.[rb.k]; if (t && (t.tapped || 0) < t.count) t.tapped = (t.tapped || 0) + 1; markAttacked(p, "tok", rb.k, 1); });
        startAttack(rb.name, { name: rb.name, power, cmd: false, ownId: null, loses: false }, true);
        break;
      }
      case "win-manual": {
        const e = me.bf?.[b.dataset.id];
        if (e && confirm(`Declare that ${me.name} wins with ${dispName(e)}?`)) declareWin(dispName(e));
        break;
      }
      case "win-yes": {
        const r = reminders.find(x => x.id === b.dataset.id);
        if (r && confirm(`Declare that ${me.name} wins with ${r.src}?`)) { reminders = reminders.filter(x => x.id !== r.id); declareWin(r.src); }
        break;
      }
      case "instead-yes": {
        const r = reminders.find(x => x.id === b.dataset.id);
        if (r) { digDiscardPick("ins-" + r.id); logTo(code, `${me.name}: ${r.src}: ${r.instead.what.replace(/^discard/, "discarded")}`); reminders = reminders.filter(x => x.id !== r.id); render(); }
        break;
      }
      case "instead-no": {
        const r = reminders.find(x => x.id === b.dataset.id);
        if (!r) break;
        reminders = reminders.filter(x => x.id !== r.id);
        logTo(code, `${me.name}: ${r.src} went to the graveyard`);
        act([], p => { toZone(p, p.bf?.[r.instead.bfId], "gy"); delete p.bf?.[r.instead.bfId]; });
        break;
      }
      case "imprint-go": {
        const r = reminders.find(x => x.id === b.dataset.id);
        const c = r && deck?.cards[Number(document.getElementById(`ip-${r.id}`)?.value)];
        if (!c) break;
        reminders = reminders.filter(x => x.id !== r.id);
        if (dig?.on) { const hi = dig.hand.indexOf(c.n); if (hi >= 0) { dig.hand.splice(hi, 1); digSave(); setTimeout(renderHand, 0); } } // it leaves the digital hand
        logTo(code, `${me.name} exiled ${dispName(c)} with ${r.src} (imprint)`);
        act([], p => {
          const e = p.bf?.[r.srcId];
          if (e) {
            const multi = /a card exiled with/i.test(lookupCard(e.n)?.o || "");
            e.imprints = multi ? [...(e.imprints || []), dispName(c)] : [dispName(c)];
            e.imprint = e.imprints.join(", ");
          }
          p.ex ||= {}; p.ex[newId()] = zoneEntry(c, { src: `${r.src} (imprint)` });
        });
        break;
      }
      case "susp-time": {
        const id = b.dataset.id, d = Number(b.dataset.d);
        mutate(p => { const e = p.susp?.[id]; if (e) e.time = Math.max(0, (e.time || 0) + d); });
        break;
      }
      case "susp-cast": castSuspended(b.dataset.id); break;
      case "susp-go": {
        const r = reminders.find(x => x.id === b.dataset.rid);
        if (r) { reminders = reminders.filter(x => x.id !== r.id); castSuspended(r.suspCast); }
        break;
      }
      case "view-susp": { const e = me.susp?.[b.dataset.id]; if (e) showCard(lookupCard(e.n) || e); break; }
      case "life-go": { const r = reminders.find(x => x.id === b.dataset.id); if (r) lifeGo(r); break; }
      case "deck-refresh": refreshDeck(); break;
      case "rm-go": { const r = reminders.find(x => x.id === b.dataset.id); if (r) removeGo(r); break; }
      case "adn-go": {
        const r = reminders.find(x => x.id === b.dataset.id);
        const c = r && deck?.cards[Number(document.getElementById(`an-${r.id}`)?.value)];
        if (!c) break;
        const mv = manaValue(c.m);
        r.adn ||= { count: 0, lost: 0, names: [] };
        r.adn.count++; r.adn.lost += mv; r.adn.names.push(c.n);
        logTo(code, `${me.name} revealed ${dispName(c)} (${r.src}): −${mv} life`);
        act([], p => { p.life = (p.life ?? START_LIFE) - mv; });
        break;
      }
      case "air-go": {
        const r = reminders.find(x => x.id === b.dataset.id);
        if (r && !windowState(r).ready) break;
        const apv = document.getElementById(`ap-${r?.id}`)?.value;
        if (r && apv === "?") { toast("Pick the creature to spare first (or “Spare none”)."); break; }
        if (r) clearWindow(r);
        if (r) airbendMany(r, apv || "");
        break;
      }
      case "air-back": {
        const e = me.air?.[b.dataset.id];
        if (!e) break;
        logTo(code, `↩ ${me.name}: ${dispName(e)} back on the battlefield (wasn't airbended)`);
        act([], p => { const x = p.air?.[b.dataset.id]; if (!x) return; delete p.air[b.dataset.id]; p.bf ||= {}; const w = x.was || { n: x.n, t: x.t, m: x.m, img: x.img, ...(x.nick ? { nick: x.nick } : {}), ...(x.o ? { o: x.o } : {}), ...(x.cmd ? { cmd: true } : {}) }; delete w.att; p.bf[b.dataset.id] = w; });
        break;
      }
      case "air-cmd": {
        const e = me.air?.[b.dataset.id];
        if (!e) break;
        logTo(code, `${me.name}: ${dispName(e)} → command zone`);
        act([], p => { delete p.air[b.dataset.id]; });
        break;
      }
      case "air-drop": {
        const e = me.air?.[b.dataset.id];
        if (e && confirm(`Leave ${dispName(e)} in exile for good?`)) {
          logTo(code, `${me.name}: ${dispName(e)} stays in exile`);
          act([], p => { toZone(p, p.air[b.dataset.id], "ex"); delete p.air[b.dataset.id]; });
        }
        break;
      }
      case "view-air": { const e = me.air?.[b.dataset.id]; if (e) showCard(lookupCard(e.n) || e); break; }
      case "tok-rm": rmOpen = rmOpen === b.dataset.k ? null : b.dataset.k; render(); break;
      case "tok-tapmenu": tapOpen = tapOpen === b.dataset.k ? null : b.dataset.k; render(); break;
      case "tok-tap": {
        const k = b.dataset.k, t = me.tokens?.[k];
        if (!t) break;
        const d = b.dataset.d;
        mutate(p => {
          const x = p.tokens[k], cur = x.tapped || 0;
          const next = d === "all" ? x.count : d === "none" ? 0 : Math.max(0, Math.min(x.count, cur + Number(d)));
          if (next) x.tapped = next; else delete x.tapped;
        });
        break;
      }
      case "tok-rm-go": removeToken(b.dataset.k, b.dataset.how); break;
      case "rem-target": {
        const r = reminders.find(x => x.id === b.dataset.id);
        const o = room.players?.[b.dataset.o];
        if (!r || !o || !windowState(r).ready) break;
        clearWindow(r);
        reminders = reminders.filter(x => x.id !== r.id);
        const effs = r.effs.map(f => f.k === "tlose" ? { ...f, target: b.dataset.o, targetName: o.name } : f);
        if (b.dataset.o !== pid) commitCrime("target player");
        act([{ type: "effects", effs, times: r.times || 1, count: r.count || 1, src: r.src, srcId: r.srcId }]);
        break;
      }
      case "fetch-x": {
        const r = reminders.find(x => x.id === b.dataset.id);
        const v = Number(document.getElementById(`fx-${b.dataset.id}`)?.value);
        if (!r || !Number.isFinite(v) || v < 0) { toast("Enter a number first."); break; }
        r.x = v; render();
        break;
      }
      case "fetch-x-reset": { const r = reminders.find(x => x.id === b.dataset.id); if (r) { r.x = null; render(); } break; }
      case "fetch-put": {
        const r = reminders.find(x => x.id === b.dataset.id);
        const sel = document.getElementById(`fp-${b.dataset.id}`);
        const card = r && sel && deck?.cards[Number(sel.value)];
        if (!card) break;
        if (r.left === "X" || r.left == null || Number.isNaN(r.left)) r.left = 1;
        r.left -= 1;
        (r.picked ||= []).push(card.n);
        const f = r.fetch;
        // digital deck: take the card out of the library; shuffle when the search ends (before "put it on top")
        if (dig?.on) { const li = dig.lib.indexOf(card.n); if (li >= 0) dig.lib.splice(li, 1);
          if (r.left <= 0 && f.shuffle) { digShuffle(dig.lib); r.digShuffled = true; }
          if (!boardEnv().agent[0]) { if (f.dest === "hand") dig.hand.push(card.n); else if (f.dest === "top") dig.lib.unshift(card.n); }
          digSave(); setTimeout(() => { try { renderHand(); } catch {} }, 0); }
        if (r.left <= 0) { reminders = reminders.filter(x => x.id !== r.id); finishSearch(r); }
        const agent = boardEnv().agent[0];
        if (agent) { // the searcher exiles what they find; the Agent's controller may play it
          sendOrders({ [agent.ownerId]: {} }, { how: "receiveEx", cards: [{ n: card.n, t: card.t || "", m: card.m || "", img: card.img || "", ...(card.o ? { o: card.o } : {}) }], own: meTag(), src: agent.src });
          logTo(code, `🕵 ${agent.src} (${agent.owner}): ${me.name}'s search (${r.src}) found ${dispName(card)} → exiled; ${agent.owner} may play it`);
          toast(`${agent.src}: ${dispName(card)} is exiled for ${agent.owner}`);
          render(); break;
        }
        if (f.dest === "battlefield") playCard(card, { tapped: f.tapped, via: r.src });
        else {
          // Hand / top of library stay hidden unless the card says to reveal it; graveyard is public
          const shown = f.reveal || f.dest === "graveyard";
          const where = f.dest === "hand" ? "into hand" : f.dest === "top" ? "on top of their library" : "into the graveyard";
          logTo(code, `${me.name} searched with ${r.src}: ${shown ? dispName(card) : "a card"} ${where}`);
          if (f.dest === "graveyard") act([], p => { toZone(p, card, "gy"); });
          toast(`${dispName(card)} → ${f.dest === "hand" ? "your hand" : f.dest === "top" ? "top of your library" : "your graveyard"}`);
          render();
        }
        break;
      }
      case "mode-rep": {
        const r = reminders.find(x => x.id === b.dataset.id);
        if (!r?.repeat) break;
        const i = b.dataset.i;
        r.reps[i] = Math.max(0, (r.reps[i] || 0) + Number(b.dataset.d));
        if (!r.reps[i]) delete r.reps[i];
        render(); break;
      }
      case "mode-go": {
        const r = reminders.find(x => x.id === b.dataset.id);
        if (!r) break;
        const idxs = r.repeat ? Object.entries(r.reps).flatMap(([i, n]) => Array(n).fill(Number(i)))
          : b.dataset.i != null ? [Number(b.dataset.i)]
          : [...document.querySelectorAll(`.mode-box[data-rid="${r.id}"]:checked`)].map(x => Number(x.value));
        applyModes(r, idxs);
        break;
      }
      case "atk-to": { const r = reminders.find(x => x.id === b.dataset.id); if (r) sendAttack(r, b.dataset.o); break; }
      case "hit-trample": { // trample: only damage beyond the blocker's toughness gets through
        const n = room.notes?.[pid]?.[b.dataset.n];
        if (!n) break;
        const need = Number(document.getElementById(`tb-${b.dataset.n}`)?.value) || 0;
        const blocker = document.getElementById(`tb-${b.dataset.n}`)?.selectedOptions?.[0]?.textContent || "a blocker";
        if (n.cardN && n.fromId) sendOrders({ [n.fromId]: {} }, { how: "blockedDmg", cardN: n.cardN, src: n.src, dmg: Math.min(Number(document.getElementById(`hd-${b.dataset.n}`)?.value) || n.power, need), victim: blocker });
        const inp = document.getElementById(`hd-${b.dataset.n}`);
        trampleDmg = Math.max(0, (Number(inp?.value) || n.power) - need);
        logTo(code, `🛡 ${me.name} blocked ${n.from}'s ${n.src} with ${blocker}; trample: ${trampleDmg} damage gets through`);
      } // falls through: take the trample damage
      case "hit-take": {
        const n = room.notes?.[pid]?.[b.dataset.n];
        if (!n) break;
        const dmg = trampleDmg != null ? trampleDmg : Math.max(0, Number(document.getElementById(`hd-${b.dataset.n}`)?.value ?? n.power) || 0);
        trampleDmg = null;
        update(ref(db, `rooms/${code}/notes/${pid}`), { [b.dataset.n]: null });
        if (!dmg) { logTo(code, `${me.name} took no damage from ${n.from}'s ${n.src}`); break; }
        const noPrev = seated(room).filter(o => !isOut(o)).flatMap(o => [...Object.values(o.bf || {}).filter(e => boardRules(e.o).some(r => r.kind === "noPrevent")).map(dispName), ...(o.turnFx?.noPrevent && o.turnFx.turnNo === (room.turnNo || 0) ? [o.turnFx.noPrevent] : [])])[0];
        if (room.maze?.turnNo === (room.turnNo || 0) && !noPrev && !n.noncombat && (room.maze.list || []).some(m => m.oid === n.fromId && m.name === n.cardN)) { logTo(code, `🌀 ${n.from}'s ${n.src}: combat damage to ${me.name} prevented (Maze of Ith)`); squirePrevented(dmg); break; }
        if (room.fog?.turnNo === (room.turnNo || 0) && !noPrev && !n.noncombat && !(room.fog.oppsOf && n.fromId === room.fog.oppsOf) && !(room.fog.onlyName && n.cardN === room.fog.onlyName) && !(room.fog.except && new RegExp(`\\b${room.fog.except}`, "i").test(`${n.stats?.type || ""} ${n.src || ""} ${lookupCard(n.cardN || "")?.t || ""}`))) { logTo(code, `🌫 ${n.from}'s ${n.src}: combat damage to ${me.name} prevented (${room.fog.by}'s ${room.fog.src})`); squirePrevented(dmg); break; }
        if (me.prot?.all && !noPrev && !confirm(`${me.prot.src}: you have protection from everything, so this damage is prevented.\n\nTake it anyway?`)) { logTo(code, `🛡 ${me.name} took no damage from ${n.from}'s ${n.src} (${me.prot.src})`); squirePrevented(dmg); break; }
        if (me.prot?.life) { // damage is dealt (not prevented), but the life total can't change
          const curC = n.cmdKey ? (me.cmd?.[n.cmdKey] || 0) : 0;
          if (n.cmdKey) mutate(p => { p.cmd ||= {}; p.cmd[n.cmdKey] = curC + dmg; });
          if (n.ring >= 4) ringDrain(n);
          logTo(code, `⚔ ${n.from}'s ${n.src} dealt ${dmg} to ${me.name}${noPrev ? ` (${noPrev}: can't be prevented)` : ""}, but their life total can't change (${me.prot.src})${n.cmdKey ? ` · commander damage ${curC + dmg}` : ""}`);
          break;
        }
        const cur = n.cmdKey ? (me.cmd?.[n.cmdKey] || 0) : 0;
        if (n.cardN && n.fromId) sendOrders({ [n.fromId]: {} }, { how: "combatHit", cardN: n.cardN, src: n.src, victim: me.name, times: n.times || 1, dmg: Math.round(dmg / Math.max(1, n.times || 1)) });
        if (n.ring >= 4) ringDrain(n);
        mutate(p => { p.life = (p.life ?? START_LIFE) - dmg - (n.ring >= 4 ? 3 : 0); if (n.cmdKey) { p.cmd ||= {}; p.cmd[n.cmdKey] = cur + dmg; } });
        logTo(code, `⚔ ${me.name} took ${dmg} from ${n.from}'s ${n.src}${noPrev && me.prot?.all ? ` (${noPrev}: can't be prevented)` : ""}${n.cmdKey ? ` (commander damage ${cur + dmg}${cur + dmg >= 21 ? " — lethal!" : ""})` : ""}`);
        if (n.loses) markLost(`combat damage from ${n.from}'s ${n.src}`);
        break;
      }
      case "hand-ask-open": handAskOpen = true; render(); setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 30); break;
      case "hand-ask-close": handAskOpen = false; render(); break;
      case "hand-ask-send": {
        const oid = document.getElementById("ha-opp")?.value, o = room.players?.[oid]; if (!o) break;
        const why = (document.getElementById("ha-why")?.value || "").trim(), pick = !!document.querySelector(".ha-pick")?.checked;
        sendNote(oid, { kind: "handask", fromId: pid, src: why, pick });
        logTo(code, `👁 ${me.name} asked to see ${o.name}'s hand${why ? ` (${why})` : ""}`);
        toast(`Asked ${o.name} to show their hand`); handAskOpen = false; render(); break;
      }
      case "hand-show": {
        const nid = b.dataset.n, n = room.notes?.[pid]?.[nid]; if (!n) break;
        const names = dig?.on ? [...dig.hand] : [...document.querySelectorAll(`.hs-box[data-rid="${nid}"]:checked`)].map(x => x.value);
        const cards = names.map(nm => { const d = deckCard(nm) || lookupCard(nm) || {}; return { n: nm, img: d.img || "" }; });
        sendNote(n.fromId, { kind: "handshow", fromId: pid, src: n.src || "", pick: !!n.pick, digital: !!dig?.on, cards });
        update(ref(db, `rooms/${code}/notes/${pid}`), { [nid]: null });
        logTo(code, `👁 ${me.name} showed ${n.from} their hand (${cards.length} card${cards.length === 1 ? "" : "s"})`); break;
      }
      case "hand-decline": {
        const nid = b.dataset.n, n = room.notes?.[pid]?.[nid]; if (!n) break;
        sendNote(n.fromId, { text: `${me.name} declined to show their hand.`, src: n.src || "" });
        update(ref(db, `rooms/${code}/notes/${pid}`), { [nid]: null });
        logTo(code, `👁 ${me.name} declined to show ${n.from} their hand`); break;
      }
      case "hand-view": { const n = room.notes?.[pid]?.[b.dataset.n], c = n?.cards?.[Number(b.dataset.j)]; if (c) showCard(deckCard(c.n) || lookupCard(c.n) || { n: c.n, t: "", o: "", img: c.img }); break; }
      case "hand-pickcard": {
        const nid = b.dataset.n, n = room.notes?.[pid]?.[nid], c = n?.cards?.[Number(b.dataset.j)]; if (!c) break;
        if (!confirm(`Make ${n.from} discard ${c.n}?`)) break;
        sendNote(n.fromId, { kind: "discardask", fromId: pid, card: c.n, src: n.src || "" });
        update(ref(db, `rooms/${code}/notes/${pid}`), { [nid]: null });
        logTo(code, `🗑 ${me.name}${n.src ? `'s ${n.src}` : ""}: ${n.from} discards ${c.n}`); break;
      }
      case "hand-discard": {
        const nid = b.dataset.n, n = room.notes?.[pid]?.[nid]; if (!n) break;
        if (dig?.on) { const i = dig.hand.indexOf(n.card); if (i >= 0) { dig.hand.splice(i, 1); digSave(); setTimeout(renderHand, 0); } }
        const c = deckCard(n.card) || lookupCard(n.card) || { n: n.card };
        discardFromHand(c);
        update(ref(db, `rooms/${code}/notes/${pid}`), { [nid]: null });
        logTo(code, `🗑 ${me.name} discarded ${n.card}${n.src ? ` (${n.from}'s ${n.src})` : ""}`); break;
      }
      case "wheelatk-go": {
        const r = reminders.find(x => x.id === b.dataset.id); if (!r) break;
        const thatMany = /draw that many cards/i.test(r.text);
        let n;
        if (dig?.on) {
          const hand = [...dig.hand]; n = thatMany ? hand.length : attackersNow();
          dig.hand = []; digSave();
          hand.forEach(nm => discardFromHand(deckCard(nm) || lookupCard(nm) || { n: nm }));
          logTo(code, `🗑 ${me.name} discarded their hand (${hand.length}) for ${r.src}`);
        } else {
          n = Math.max(0, Number(document.getElementById(`wh-${r.id}`)?.value) || 0);
          logTo(code, `🗑 ${me.name} discarded their hand for ${r.src}`);
        }
        reminders = reminders.filter(x => x.id !== r.id);
        if (n > 0) broadcastDraw(n, r.src);
        setTimeout(renderHand, 0); render(); break;
      }
      case "pm-go": { // Vivi: X mana split between her colours
        const r = reminders.find(x => x.id === b.dataset.id); if (!r?.pmana) break;
        const { x, cols } = r.pmana, a1 = cols.length === 2 ? Math.max(0, Math.min(x, Math.floor(Number(document.getElementById(`pm-${r.id}`)?.value) || 0))) : x;
        const syms = `{${cols[0]}}`.repeat(a1) + (cols[1] ? `{${cols[1]}}`.repeat(x - a1) : "");
        reminders = reminders.filter(y => y.id !== r.id);
        if (syms) poolAdd(syms, r.src);
        logTo(code, `${me.name}'s ${r.src}: added ${x} mana (${syms || "none"})`);
        render(); break;
      }
      case "hit-blockwith": { // declare blockers from the popup
        const nid = b.dataset.n, n = room.notes?.[pid]?.[nid];
        if (!n?.stats) break;
        const picks = [...document.querySelectorAll(`.blk-box[data-n="${nid}"]:checked`)].map(x => x.value);
        document.querySelectorAll(`.blk-num[data-n="${nid}"]`).forEach(x => { const k = Math.max(0, Math.min(Number(x.max) || 0, Math.floor(Number(x.value) || 0))); for (let i = 0; i < k; i++) picks.push(x.dataset.v); });
        if (!picks.length) { toast("Tick the creature(s) that block."); break; }
        const a = n.stats, pv = blockPreview(a, { ...me, id: pid });
        const bl = picks.map(v => { const i = v.indexOf(":"); return pv.rows.find(r => r.kind === v.slice(0, i) && r.id === v.slice(i + 1)); }).filter(Boolean);
        if (pv.menace && bl.length < 2 && !confirm(`${n.src} has menace: it can't be blocked except by two or more creatures.\n\nBlock with just one anyway?`)) break;
        const dt = kwHas(a.kws, "deathtouch"), total = kwHas(a.kws, "double strike") ? a.p * 2 : a.p;
        let aDies, dies = null, tramp = 0;
        if (bl.length === 1) { const o = fightOut(a, bl[0]); aDies = o.aDies; dies = o.bDies ? [bl[0]] : []; tramp = o.tramp; }
        else { aDies = !a.indestr && !a.regen && (bl.some(x => x.p > 0 && kwHas(x.kws, "deathtouch")) || bl.reduce((s2, x) => s2 + x.p, 0) >= a.t);
          tramp = kwHas(a.kws, "trample") ? Math.max(0, total - bl.reduce((s2, x) => s2 + (dt ? 1 : x.t), 0)) : 0; }
        const grp = []; bl.forEach(x => { const g = grp.find(y => y.kind === x.kind && y.id === x.id); if (g) g.n++; else grp.push({ ...x, n: 1 }); });
        const shortNames = grp.map(x => x.n > 1 ? `${x.n} ${x.name.replace(/ token$/, "")} tokens` : x.name).join(" and ");
        const names = grp.map(x => `${x.n > 1 ? `${x.n} ${x.name.replace(/ token$/, "")} tokens` : x.name} (${x.p}/${x.t}${x.n > 1 ? " each" : ""})`).join(" and ");
        const aName = (n.times || 1) > 1 ? `one ${a.name}` : n.src; // a group of tokens: one of them was blocked
        const result = bl.length === 1 ? `${dies.length ? `${bl[0].name} dies` : `${bl[0].name} survives`}; ${aName} ${aDies ? "dies" : "survives"}` : `${aName} ${aDies ? "dies" : "survives"}; ${n.from} splits its ${total} damage among the blockers`;
        logTo(code, `🛡 ${me.name} blocked ${n.from}'s ${aName} (${a.p}/${a.t}) with ${names}: ${result}${tramp ? ` · ${tramp} tramples over` : ""}`);
        blockTriggers(bl);
        mutate(p => { const k = tableCombat; if (p.blk?.k !== k) p.blk = { k, u: {} }; p.blk.u ||= {}; bl.forEach(x => { const key = `${x.kind}:${x.id}`; p.blk.u[key] = (p.blk.u[key] || 0) + 1; }); });
        if (n.fromId) sendNote(n.fromId, { text: `${me.name} blocked your ${aName} with ${names}. ${bl.length === 1 ? (aDies ? `Your ${aName} should die` : `Your ${aName} survives`) + (dies.length ? ` and kills ${bl[0].name}` : "") : `${aDies ? `Your ${aName} should die. ` : ""}You split its ${total} damage among the blockers`}${tramp ? `; ${tramp} trample damage hits ${me.name}` : ""}.`, src: "Blocks" });
        if (n.cardN && n.fromId) sendOrders({ [n.fromId]: {} }, { how: "blockedDmg", cardN: n.cardN, src: n.src, dmg: Math.max(0, total - tramp), victim: shortNames });
        const autoDie = bl.length === 1 && dies.length ? dies[0] : null; // one blocker and it clearly dies: send it to the graveyard now (Undo if a trick changes that)
        sendNote(pid, { kind: "blkres", text: `${shortNames} blocked ${n.from}'s ${aName}: ${result}.`, note: bl.length > 1 ? `Tap ☠ for each blocker that dies once ${n.from} assigns the damage.` : autoDie ? `${autoDie.name} went to your graveyard. If a combat trick saved it, tap ↶ Undo.` : "",
          dies: bl.length > 1 ? bl.map(x => ({ kind: x.kind, id: x.id, name: x.name })) : [] });
        if (autoDie) setTimeout(() => { if (autoDie.kind === "bf") { if (me.bf?.[autoDie.id]) moveOut(autoDie.id, "Graveyard"); } else if (me.tokens?.[autoDie.id]?.count > 0) removeToken(autoDie.id, "died"); }, 0);
        if (n.ring >= 3) { reminders.push({ id: newId(), src: `${n.from}'s Ring-bearer`, text: "Sacrifice the creature that blocked it (at end of combat).", times: 1,
          edictLocal: { kind: "edict", text: "", src: `${n.from}'s ${n.src} (Ring-bearer)`, n: 1, filter: parseTargetFilter("creature") } }); }
        const times = n.times || 1;
        if (times > 1) { // a group of tokens: one was blocked, the rest keep coming
          const per = Math.round(n.power / times);
          update(ref(db, `rooms/${code}/notes/${pid}/${nid}`), { times: times - 1, power: n.power - per });
          if (tramp) { mutate(p => { p.life = (p.life ?? START_LIFE) - tramp; }); logTo(code, `⚔ ${me.name} took ${tramp} trample damage from ${n.from}'s ${n.src}`); }
        } else if (tramp) { trampleDmg = tramp; onAction(e, { dataset: { a: "hit-take", n: nid } }); }
        else update(ref(db, `rooms/${code}/notes/${pid}`), { [nid]: null });
        render(); break;
      }
      case "hit-block": {
        const n = room.notes?.[pid]?.[b.dataset.n];
        update(ref(db, `rooms/${code}/notes/${pid}`), { [b.dataset.n]: null });
        if (n) logTo(code, `🛡 ${me.name} blocked ${n.from}'s ${n.src}`);
        if (n?.cardN && n.fromId) sendOrders({ [n.fromId]: {} }, { how: "blockedDmg", cardN: n.cardN, src: n.src, dmg: Number(document.getElementById(`hd-${b.dataset.n}`)?.value) || n.power || 0, victim: "a blocker" });
        if (n?.ring >= 3) { reminders.push({ id: newId(), src: `${n.from}'s Ring-bearer`, text: "Sacrifice the creature that blocked it (at end of combat).", times: 1,
          edictLocal: { kind: "edict", text: "", src: `${n.from}'s ${n.src} (Ring-bearer)`, n: 1, filter: parseTargetFilter("creature") } }); render(); }
        break;
      }
      case "gift-to": { const r = reminders.find(x => x.id === b.dataset.id); if (r) giveGift(r, b.dataset.o); break; }
      case "draw-to": {
        const r = reminders.find(x => x.id === b.dataset.id), o = room.players?.[b.dataset.o];
        if (!r || !o) break;
        const n = r.effs.find(f => f.k === "tdraw").n * (r.times || 1);
        reminders = reminders.filter(x => x.id !== r.id);
        sendNote(b.dataset.o, { text: `Draw ${n === 1 ? "a card" : n + " cards"}.`, short: `draw ${n}`, src: r.src });
        logTo(code, `🎁 ${r.src}: ${o.name} draws ${n}`);
        // anything else the ability does stays as a reminder
        const rest = r.text.replace(/target (opponent|player) draws [^.]*\.\s*/i, "").trim();
        if (rest) {
          let note = "Handle the rest yourself.";
          if (/second time this ability has resolved this turn/i.test(rest)) {
            const key = `${r.srcId || r.src}:${room.turnNo || 0}`;
            resolvedCount[key] = (resolvedCount[key] || 0) + 1;
            note = resolvedCount[key] === 2 ? "⚡ Second time this turn: you draw two cards!" : `Resolved ${resolvedCount[key]}× this turn.`;
          }
          reminders.push({ id: newId(), src: r.src, text: rest, times: r.times, note });
        }
        render();
        break;
      }
      case "pun-res": {
        const r = reminders.find(x => x.id === b.dataset.id);
        if (r) {
          if (r.who) Object.entries(room.notes?.[r.who] || {}).forEach(([nid, n]) => { if (n.rid === r.id) update(ref(db, `rooms/${code}/notes/${r.who}`), { [nid]: null }); });
          resolvePunish(r, b.dataset.v === "yes");
        }
        break;
      }
      case "note-done": {
        const n = room.notes?.[pid]?.[b.dataset.n];
        update(ref(db, `rooms/${code}/notes/${pid}`), { [b.dataset.n]: null });
        const dm = n?.text?.match(/^Draw (a card|an extra card|(\d+) cards)/);
        if (dm) broadcastDraw(dm[2] ? Number(dm[2]) : 1, n.src);
        break;
      }
      case "note-answer": {
        const n = room.notes?.[pid]?.[b.dataset.n];
        if (!n) break;
        update(ref(db, `rooms/${code}/notes/${pid}`), { [b.dataset.n]: null });
        update(ref(db, `rooms/${code}/replies/${n.replyTo}`), { [n.rid]: { paid: b.dataset.v === "yes", name: me.name } });
        break;
      }
      case "drew": if (broadcastDraw(1, "", true)) toast("Logged a draw"); break;
      case "note-take": {
        const n = room.notes?.[pid]?.[b.dataset.n];
        if (!n) break;
        update(ref(db, `rooms/${code}/notes/${pid}`), { [b.dataset.n]: null });
        act([{ type: "create", name: n.token, n: n.count || 1, desc: n.desc, tapped: !!n.tapped }], p => {});

        break;
      }
      case "rem-dismiss": {
        const r = reminders.find(x => x.id === b.dataset.id);
        if (r?.digBack && dig?.on) { dig.hand.push(r.digBack); digSave(); setTimeout(renderHand, 0); toast(`${r.src} went back to your hand`); } // ninjutsu / mutate not used after all
        if (r) clearWindow(r);
        const dm = r && !r.effs?.length && !r.punish && r.text.match(/^(?:you )?draw (a|one|two|three|\d+) cards?\.?$/i);
        if (dm) broadcastDraw(dm[1] === "a" || dm[1] === "one" ? 1 : dm[1] === "two" ? 2 : dm[1] === "three" ? 3 : Number(dm[1]), r.src);
        if (r?.fetch) { r.left = 0; reminders = reminders.filter(x => x.id !== r.id); finishSearch(r); render(); break; }
        reminders = reminders.filter(x => x.id !== b.dataset.id); render(); break;
      }
      case "force": { const r = reminders.find(x => x.id === b.dataset.id); if (r) { r.forced = true; render(); } break; }
      case "pass": update(ref(db, `rooms/${code}/pending/waiting`), { [pid]: "pass" }); logTo(code, `${me.name}: no response`); break;
      case "respond": update(ref(db, `rooms/${code}/pending/waiting`), { [pid]: "respond" }); logTo(code, `✋ ${me.name} is responding`); break;
      case "rem-apply":
      case "rem-pick": {
        const r = reminders.find(x => x.id === b.dataset.id);
        reminders = reminders.filter(x => x.id !== b.dataset.id);
        const effs = r && (b.dataset.a === "rem-pick" ? [r.effs[Number(b.dataset.i)]] : r.effs);
        if (r) act([{ type: "effects", effs, times: r.times, count: r.count, src: r.src, srcId: r.srcId }]);
        else render();
        break;
      }
      case "leave": tourEl?.remove(); tourEl = null; leave(); break;
    }
  };

  // "At the beginning of…" triggers. Only writes to the database if something actually changes.
  function phaseEvents(list, when = "") {
    if (!me || !auto) return;
    const test = clone(me);
    const ctx = { logs: [], remind: [], drain: 0, who: me.name };
    runEvents(test, list, ctx, { enabled: true, lookup: lookupCard, env: boardEnv(), turnNo: room?.turnNo || 0 });
    if (ctx.logs.length || ctx.drain) act(list);
    else if (ctx.remind.length) { ctx.remind.forEach(r => { const x = normalizeRem({ ...r, id: newId() }); if (when) { if (x.text) x.text = `${when}: ${x.text[0].toLowerCase()}${x.text.slice(1)}`; else x.note = `${when}.`; } reminders.push(x); }); render(); }
  }
  const doneMsgs = new Set();
  let seenCasts = null; // casts already processed on this phone
  const lostCtr = new Set(), bootAt = Date.now();
  let seenDraws = null;
  let wasOut = null, sawWin; // for this phone's K.O. / victory moments
  let seenNotes = null; // attack / message popups already announced on this phone
  const hsFilter = () => document.querySelectorAll(".hs-q").forEach(q => { const v = q.value.trim().toLowerCase(); q.closest(".hand-box")?.querySelectorAll(".hs-item").forEach(l => { l.hidden = !!v && !l.dataset.nm.includes(v) && !l.querySelector("input")?.checked; }); });
  document.addEventListener("input", e => { if (e.target.classList?.contains("hs-q")) hsFilter(); });
  let lastTurn; // undefined until the first snapshot, so reloading the page doesn't re-fire triggers
  let localTB = null, seenRewind, seenGame; // ↶ Undo end turn: this phone's reminders / digital deck / undo depth from just before the turn ended
  onValue(ref(db, `rooms/${code}`), snap => {
    if (dead) return;
    touchRoom(code, snap);
    room = snap.val();
    updateTablePT(room);
    let prevTurn = lastTurn;
    lastTurn = room?.turn ? `${room.turn}:${room.turnNo || 0}` : null;
    if (room?.turnBack && localTB?.at !== room.turnBack.at) localTB = { at: room.turnBack.at, rem: clone(reminders), dig: dig ? clone(dig) : null, undoN: undo.length };
    if (seenGame === undefined) seenGame = room?.gameNo ?? null;
    else if ((room?.gameNo ?? null) !== seenGame) { // 🔄 New game on the TV: start this phone fresh too
      seenGame = room?.gameNo ?? null;
      if (room?.gameNo) {
        reminders = []; undo.length = 0; undoMeta.length = 0; undoExt.length = 0; redo.length = 0; localTB = null; digOpenI = -1;
        if (dig?.on) { digNew(7); digSave(); setTimeout(() => { renderHand(); renderDeck(); }, 0); toast("🔄 New game: your digital deck was shuffled and you drew 7"); }
        else toast("🔄 New game");
      }
    }
    if (seenRewind === undefined) seenRewind = room?.rewind?.at ?? null; // first snapshot after loading: an old take-back isn't news
    else if (room?.rewind && seenRewind !== room.rewind.at) { // the end of a turn was taken back: don't run start-of-turn things, put this phone back too
      const first = false; seenRewind = room.rewind.at;
      if (!first) {
        prevTurn = lastTurn; // no turn change happened
        oppEndSeen = room.step?.endFired && room.step.turnNo === (room.turnNo || 0) ? (room.turnNo || 0) : null;
        if (localTB && localTB.at === room.rewind.tb) {
          reminders = localTB.rem || [];
          if (localTB.dig) { dig = localTB.dig; digSave(); } 
          const n = Math.min(localTB.undoN, undo.length); undo.length = n; undoMeta.length = n; undoExt.length = n; redo.length = 0;
          setTimeout(() => { renderHand(); renderDeck(); }, 0);
        }
        localTB = null;
        toast("↶ Back to the previous turn");
      }
    }
    if (me && prevTurn && lastTurn && prevTurn !== lastTurn && room.turn === pid && room.dn) { // day/night flips as the new turn starts
      const [pp, pt] = prevTurn.split(":"), n = Object.values(room.casts || {}).filter(c => c.by === pp && String(c.turnNo || 0) === pt).length;
      const nx = room.dn === "day" && n === 0 ? "night" : room.dn === "night" && n >= 2 ? "day" : null;
      if (nx) { update(ref(db, `rooms/${code}`), { dn: nx }); logTo(code, `${nx === "night" ? "🌙 It becomes night" : "☀ It becomes day"} (${room.players?.[pp]?.name || "last player"} cast ${n} spell${n === 1 ? "" : "s"} last turn)`); }
    }
    setTimeout(dnSync, 0);
    const fireOppEnd = t => { oppEndSeen = t; envTurn = t; try { phaseEvents([{ type: "phase", phase: "end", mine: false }]); } finally { envTurn = null; } if (Object.values(me.bf || {}).some(e => e.sacNext)) setTimeout(sacEndSelf, 0); if (Object.values(me.ex || {}).some(x => x.retEnd)) setTimeout(() => endStepHooks(false), 0); };
    if (me && room?.turn && room.turn !== pid && room.step?.endFired && room.step.turnNo === (room.turnNo || 0) && oppEndSeen !== (room.turnNo || 0)) fireOppEnd(room.turnNo || 0);
    if (me && prevTurn && lastTurn && prevTurn !== lastTurn) { const [pp, pt] = prevTurn.split(":"); if (pp !== pid && oppEndSeen !== Number(pt) && room.players?.[pp]) fireOppEnd(Number(pt)); }
    if (!room) { dead = true; renderHome("This room no longer exists."); return; }
    const p = room.players?.[pid];
    if (!p) { dead = true; store.del(`mtga_${code}`); renderJoin(code, room); return; }
    me = p;
    { // new attacks / messages for me: buzz, say so, and bring the top of the screen into view
      const mine = room.notes?.[pid] || {}, ids = Object.keys(mine);
      if (seenNotes === null) seenNotes = new Set(ids);
      else { const fresh = ids.filter(x => !seenNotes.has(x)); fresh.forEach(x => seenNotes.add(x));
        const ns = fresh.map(x => mine[x]).filter(n => n && n.from !== me.name);
        ns.filter(n => n.kind === "hit").forEach(n => { try { attackedTriggers(n); } catch (err) { reportError(err, "attackedTriggers"); } });
        if (ns.length) { const h = ns.find(n => n.kind === "hit");
          try { navigator.vibrate?.(h ? [220, 90, 220, 90, 220] : [160, 80, 160]); } catch {}
          try { if (turnAlerts) playTurnChime(); } catch {}
          toast(h ? `⚔ ${h.from}'s ${h.src} is attacking you!` : `🔔 ${ns[0].from}${ns[0].src ? ` (${ns[0].src})` : ""} sent you something`);
          setTimeout(() => { try { window.scrollTo({ top: 0, behavior: "smooth" }); } catch {} }, 60); } }
    }
    const outNow = isOut(me);
    if (wasOut === false && outNow) { flash("ko", "💀 K.O.", `You're out: ${outReason(me, seated(room))}`); playKO(); }
    wasOut = outNow;
    if (room.winner && sawWin !== undefined && sawWin !== room.winner.at && room.winner.pid === pid) { flash("win", "🏆 VICTORY!", `You win! (${room.winner.src})`); playVictory(); }
    sawWin = room.winner?.at ?? null;
    if (!pubDone) { pubDone = true; publishCommanders(); }
    render();
    if (logOpen && !modal.hidden) showLog();
    // "attacks each combat if able" (Toski): a nudge when my combat starts
    const ck = room.turn === pid && stepOf(room) === 3 ? `${room.turnNo || 0}:${room.step?.extra || 0}` : null;
    if (ck && ck !== mustAtkSeen) {
      mustAtkSeen = ck;
      const must = Object.entries(me.bf || {}).filter(([id, e]) => !e.tap && /\bCreature\b/.test(e.t || "") && /attacks each combat if able/i.test(e.o || lookupCard(e.n)?.o || "") && !isSick({ ...e, o: e.o || lookupCard(e.n)?.o }, meOwner(), id));
      if (must.length) { reminders.push({ id: newId(), src: "Combat", text: `${must.map(([, e]) => dispName(e)).join(", ")} must attack this combat if able.`, times: 1 }); setTimeout(render, 0); }
    }
    // Crewed Vehicles stop being creatures when the turn ends
    const crewed = Object.entries(me.bf || {}).filter(([, e]) => e.crewT && e.crew !== (room.turnNo || 0));
    if (crewed.length) mutate(p => crewed.forEach(([id]) => { const x = p.bf?.[id]; if (x?.crewT) { x.t = x.crewT; delete x.crewT; delete x.crew; } }));
    // our own "give it back" corrections aren't life gain
    if (me && lifeSeen != null && restoreSkip > 0 && (me.life ?? START_LIFE) > lifeSeen) { const k = Math.min(restoreSkip, (me.life ?? START_LIFE) - lifeSeen); restoreSkip -= k; lifeSeen += k; }
    // Everybody Lives!: "Players can't lose life this turn" (a − you tap yourself is a correction and stays)
    if (me && lifeSeen != null && (me.life ?? START_LIFE) < lifeSeen && room?.noLoss?.turnNo === (room.turnNo || 0)) {
      const d = lifeSeen - (me.life ?? START_LIFE), man = Math.min(manualDown, d), back = d - man;
      manualDown -= man;
      if (back > 0) { restoreSkip += back; lifeSeen = me.life ?? START_LIFE; setTimeout(() => { mutate(p => { p.life = (p.life ?? START_LIFE) + back; }); logTo(code, `🛡 ${me.name} can't lose life this turn (${room.noLoss.src}): +${back} back`); }, 0); }
    }
    // Erebos ("Your opponents can't gain life"), Sulfuric Vortex ("Players can't gain life"): undo gains the app made; a manual + is a correction
    if (me && lifeSeen != null && (me.life ?? START_LIFE) > lifeSeen) {
      const ot = e => e.o || lookupCard(e.n)?.o || "";
      let lockBy = null;
      seated(room).filter(o => !isOut(o)).forEach(o => Object.values(o.bf || {}).forEach(e => { if (!lockBy && ((o.id !== pid && /your opponents can't gain life/i.test(ot(e))) || /players can't gain life/i.test(ot(e)))) lockBy = `${o.id === pid ? "your" : `${o.name}'s`} ${dispName(e)}`; }));
      if (lockBy) {
        const g = (me.life ?? START_LIFE) - lifeSeen, hand = Math.min(manualUp, g), auto = g - hand;
        manualUp -= hand; lifeSeen = me.life ?? START_LIFE;
        if (auto > 0) { lockSkip += auto; setTimeout(() => { mutate(p => { p.life = (p.life ?? START_LIFE) - auto; }); logTo(code, `🚫 ${me.name} can't gain life (${lockBy}): −${auto} back off`); }, 0); }
      }
    }
    // "Whenever you gain life" (Sanguine Bond, Excalibur II): my life went up
    if (me && lifeSeen != null && (me.life ?? START_LIFE) > lifeSeen && Object.values(me.bf || {}).some(e => /whenever you gain life\b/i.test(e.o || lookupCard(e.n)?.o || ""))) {
      const g = (me.life ?? START_LIFE) - lifeSeen; lifeSeen = me.life ?? START_LIFE;
      const hand = Math.min(manualUp, g); manualUp -= hand;
      if (g - hand > 0) { const first = firstGainT !== (room?.turnNo || 0); firstGainT = room?.turnNo || 0; setTimeout(() => act([{ type: "gainlife", n: g - hand, first }]), 0); }
      if (hand > 0) { const ga = reminders.find(x => x.gainAsk); if (ga) { ga.gainAsk += hand; normalizeRem(ga); } else reminders.push(normalizeRem({ id: newId(), src: "Life total", text: "", times: 1, gainAsk: hand })); setTimeout(render, 0); }
    }
    if (me && lifeSeen != null && (me.life ?? START_LIFE) < lifeSeen) { let d = lifeSeen - (me.life ?? START_LIFE); const t = room.turnNo || 0; lifeSeen = me.life ?? START_LIFE;
      { const lk = Math.min(lockSkip, d); lockSkip -= lk; d -= lk; }
      // Bloodletter of Aclazotz on the active player's board: I lose twice as much during their turn
      let dd = d; const skip = Math.min(bloodSkip, dd); bloodSkip -= skip; dd -= skip;
      const man = Math.min(manualDown, dd); manualDown = 0;
      const act0 = room.turn && room.turn !== pid ? room.players?.[room.turn] : null;
      const bl = act0 ? Object.values(act0.bf || {}).filter(e => /if an opponent would lose life during your turn, they lose twice that much life instead/i.test(e.o || lookupCard(e.n)?.o || "")) : [];
      if (bl.length && dd > 0 && !me.prot?.life) {
        const mult = 2 ** bl.length - 1, autoX = (dd - man) * mult, manX = man * mult, srcN = `${act0.name}'s ${dispName(bl[0])}`;
        if (autoX > 0) { bloodSkip += autoX; setTimeout(() => { mutate(p => { p.life = (p.life ?? START_LIFE) - autoX; }); logTo(code, `🩸 ${srcN}: ${me.name} loses ${autoX} more (twice as much during ${act0.name}'s turn) → ${(me.life ?? START_LIFE)}`); }, 0); }
        if (manX > 0) { reminders.push({ id: newId(), src: srcN, text: `You took off ${man} life by hand during ${act0.name}'s turn. If that was life loss, you lose ${manX} more.`, times: 1, bloodAsk: manX }); setTimeout(render, 0); }
      } setTimeout(() => mutate(p => { p.lifeLost = { t, n: (p.lifeLost?.t === t ? p.lifeLost.n : 0) + d }; }, true), 0); }
    if (me) { if ((me.life ?? START_LIFE) <= (lifeSeen ?? 0)) manualUp = 0; lifeSeen = me.life ?? START_LIFE; }
    if (me) setTimeout(announceCombos, 0);
    if (me) { // emblem: "Whenever an artifact you control becomes tapped, draw a card."
      const tappedNow = new Set(Object.entries(me.bf || {}).filter(([, e]) => e.tap && /\bArtifact\b/.test(e.t || "")).map(([id]) => id));
      const em = (me.emblems || []).filter(x => /whenever an artifact you control becomes tapped, draw a card/i.test(x.text));
      if (artTapSeen && em.length) { const fresh = [...tappedNow].filter(id => !artTapSeen.has(id)).length; if (fresh) { reminders.push({ id: newId(), src: `${em[0].src} emblem`, text: `Draw ${fresh * em.length === 1 ? "a card" : `${fresh * em.length} cards`}.`, times: 1, drawN: fresh * em.length }); setTimeout(render, 0); } }
      artTapSeen = tappedNow;
    }
    if (me && Object.values(me.bf || {}).some(e => e.typeAdd && e.typeAdd.turn !== (room.turnNo || 0))) setTimeout(() => {
      const back = Object.entries(me.bf || {}).filter(([, e]) => e.typeAdd && e.typeAdd.turn !== (room.turnNo || 0));
      if (back.length) mutate(p => back.forEach(([id]) => { const x = p.bf?.[id]; if (x?.typeAdd) { x.t = x.typeAdd.t; delete x.typeAdd; } }));
    }, 0);
    if (me && Object.values(me.bf || {}).some(e => e.mirror && e.mirror.turn !== (room.turnNo || 0))) setTimeout(() => {
      const back = Object.entries(me.bf || {}).filter(([, e]) => e.mirror && e.mirror.turn !== (room.turnNo || 0));
      if (!back.length) return;
      mutate(p => back.forEach(([id]) => { const x = p.bf?.[id]; if (!x?.mirror) return; const m = x.mirror; Object.assign(x, { n: m.n, t: m.t, m: m.m, o: m.o, p: m.p, tg: m.tg, img: m.img }); delete x.mirror; delete x.haste; }));
      logTo(code, `🪞 ${me.name}'s ${back.map(([, e]) => e.mirror.n).join(", ")} stopped being a copy`);
    }, 0);
    if (me) {
      const march = seated(room).filter(o => !isOut(o)).some(o => Object.values(o.bf || {}).some(e => /each noncreature artifact is an artifact creature with power and toughness each equal to its mana value/i.test(e.o || lookupCard(e.n)?.o || "")));
      const on = Object.entries(me.bf || {}).filter(([, e]) => march && !e.marchT && /\bArtifact\b/.test(e.t || "") && !/\bCreature\b/.test(e.t || ""));
      const off = Object.entries(me.bf || {}).filter(([, e]) => !march && e.marchT);
      if (on.length || off.length) setTimeout(() => {
        mutate(p => {
          on.forEach(([id]) => { const x = p.bf?.[id]; if (!x || x.marchT || /\bCreature\b/.test(x.t || "")) return; const mv = manaValue(x.m || lookupCard(x.n)?.m || ""); x.marchT = { t: x.t, p: x.p ?? null, tg: x.tg ?? null }; x.t = x.t.replace(/\bArtifact\b/, "Artifact Creature"); x.p = String(mv); x.tg = String(mv); if (x.att && /\b(Equipment|Fortification)\b/.test(x.t)) { detachIn(p, id); x.marchFell = true; } });
          off.forEach(([id]) => { const x = p.bf?.[id]; if (!x?.marchT) return; x.t = x.marchT.t; if (x.marchT.p == null) delete x.p; else x.p = x.marchT.p; if (x.marchT.tg == null) delete x.tg; else x.tg = x.marchT.tg; delete x.marchT; });
        });
        if (on.length) logTo(code, `🤖 March of the Machines: ${me.name}'s ${on.map(([, e]) => dispName(e)).join(", ")} ${on.length === 1 ? "is" : "are"} now artifact creatures`);
        const fell = on.filter(([, e]) => e.att && /\b(Equipment|Fortification)\b/.test(e.t || ""));
        if (fell.length) logTo(code, `📎 ${fell.map(([, e]) => dispName(e)).join(", ")} fell off (an Equipment that's a creature can't stay attached)`);
        if (off.length) logTo(code, `🤖 ${me.name}'s artifacts are no longer creatures`);
      }, 0);
    }
    if (me) {
      const dv = devotion(me), flips = [];
      Object.entries(me.bf || {}).forEach(([id, e]) => {
        const m = String(e.o || lookupCard(e.n)?.o || "").match(/as long as your devotion to (white|blue|black|red|green)(?: and (white|blue|black|red|green))? is less than (\w+), [^.]*? isn't a creature/i);
        if (!m) return;
        const C = { white: "W", blue: "U", black: "B", red: "R", green: "G" }, have = (dv[C[m[1].toLowerCase()]] || 0) + (m[2] ? dv[C[m[2].toLowerCase()]] || 0 : 0) - (m[2] ? 0 : 0);
        const need = ({ three: 3, four: 4, five: 5, six: 6, seven: 7 })[m[3].toLowerCase()] || Number(m[3]) || 5;
        const isCr = /\bCreature\b/.test(e.t || "");
        if (have < need && isCr) flips.push([id, false, have, need]); else if (have >= need && !isCr && e.godT) flips.push([id, true, have, need]);
      });
      if (flips.length) setTimeout(() => {
        mutate(p => flips.forEach(([id, on]) => { const x = p.bf?.[id]; if (!x) return; if (on) { x.t = x.godT; delete x.godT; } else if (/\bCreature\b/.test(x.t || "")) { x.godT = x.t; x.t = x.t.replace(/\s*\bCreature\b/, ""); } }));
        flips.forEach(([id, on, have, need]) => logTo(code, `${on ? "⚡" : "💤"} ${me.name}'s ${dispName(me.bf?.[id] || {})} ${on ? "is a creature now" : "isn't a creature"} (devotion ${have}/${need})`));
      }, 0);
    }
    if (me && !me.effects?.blessing && Object.values(me.bf || {}).some(e => /^Ascend\b/m.test(e.o || lookupCard(e.n)?.o || "")) && Object.keys(me.bf || {}).length + Object.values(me.tokens || {}).reduce((a, t) => a + (t.count || 0), 0) >= 10) {
      setTimeout(() => { if (!me.effects?.blessing) { addEffect("blessing", "ongoing"); logTo(code, `🏙️ ${me.name} got the city's blessing (ten or more permanents)`); } }, 0);
    }
    if (me) {
      const now = {}; seated(room).forEach(o => { if (o.id !== pid) now[o.id] = Object.keys(o.gy || {}); });
      if (gySeen) {
        const asc = Object.entries(me.bf || {}).map(([id, e]) => [id, e, String(e.o || lookupCard(e.n)?.o || "").match(/whenever a card is put into an opponent's graveyard from anywhere, if this \w+ has (\w+) or more (\w+) counters on it, you may have that player lose (\d+) life\. if you do, you gain \3 life/i)]).filter(x => x[2]);
        asc.forEach(([id, e, m]) => {
          const need = ({ one: 1, two: 2, three: 3, four: 4, five: 5 })[m[1].toLowerCase()] || Number(m[1]) || 1, have = e.c?.[`x_${m[2].toLowerCase()}`] || e.c?.[m[2].toLowerCase()] || 0;
          if (have < need) return;
          Object.entries(now).forEach(([oid, ids]) => {
            const k = ids.filter(x => !(gySeen[oid] || []).includes(x)).length;
            if (k > 0 && !isOut(room.players[oid])) { reminders.push(normalizeRem({ id: newId(), src: dispName(e), srcId: id, text: "", times: 1, gyDrain: { who: oid, name: room.players[oid].name, n: Number(m[3]), k } })); setTimeout(render, 0); }
          });
        });
      }
      gySeen = now;
      { const mine = Object.entries(me.gy || {}), fresh = myGySeen ? mine.filter(([gid]) => !myGySeen.has(gid)) : [];
        fresh.forEach(([, c]) => { const o = String(c.o || lookupCard(c.n)?.o || ""); if (/is put into a graveyard from anywhere, its owner shuffles their graveyard into their library/i.test(o)) { reminders.push({ id: newId(), src: dispName(c), text: `${dispName(c)} hit your graveyard: shuffle your graveyard into your library.`, times: 1 }); setTimeout(render, 0); } });
        if (fresh.length) mine.filter(([gid]) => !fresh.some(([f]) => f === gid) || true).forEach(([gid, g]) => { const o = String(g.o || lookupCard(g.n)?.o || "");
          const m = o.match(/^whenever (a land card|another creature) is put into (?:a|your) graveyard(?: from (?:anywhere|the battlefield))?, ([^\n]+)/im); if (!m) return;
          const hits = fresh.filter(([f, c]) => f !== gid && (/land/i.test(m[1]) ? /\bLand\b/.test(c.t || lookupCard(c.n)?.t || "") : /\bCreature\b/.test(c.t || lookupCard(c.n)?.t || ""))).length;
          if (hits) { reminders.push(normalizeRem({ id: newId(), src: `${dispName(g)} (in your graveyard)`, text: m[2].replace(/^\w/, c => c.toUpperCase()), times: hits })); setTimeout(render, 0); } });
        myGySeen = new Set(mine.map(([gid]) => gid)); }
      const exNow = {}; seated(room).forEach(o => { exNow[o.id] = Object.keys(o.ex || {}); });
      const myGyN = Object.keys(me.gy || {}).length;
      if (exSeen) {
        const fresh = id => (exNow[id] || []).filter(x => !(exSeen.ex[id] || []).includes(x));
        const any = Object.keys(exNow).some(id => fresh(id).length);
        const mine = fresh(pid).map(x => me.ex?.[x]).filter(Boolean);
        const lg = mine.length && (myGyN < exSeen.gyN || mine.some(x => (x.play && x.src !== "adventure" && x.src !== "warp") || /imprint/i.test(x.src || "")));
        const ups = [];
        Object.entries(me.bf || {}).forEach(([id, e]) => {
          const o = String(e.o || lookupCard(e.n)?.o || "");
          if (any && /whenever one or more other cards are put into exile from anywhere, put a time counter on/i.test(o)) ups.push([id, "time", "time"]);
          if (lg && /whenever one or more cards are put into exile from your library and\/or your graveyard, put a \+1\/\+1 counter on/i.test(o)) ups.push([id, "p1p1", "+1/+1"]);
        });
        if (ups.length) setTimeout(() => { mutate(p => ups.forEach(([id, k]) => { const x = p.bf?.[id]; if (x) { x.c ||= {}; x.c[k] = (x.c[k] || 0) + 1; } })); ups.forEach(([id, , l]) => logTo(code, `⚙ ${dispName(me.bf?.[id] || {})}: cards exiled → ${l} counter`)); }, 0);
      }
      const gyIds = Object.keys(me.gy || {});
      if (exSeen?.gyIds) {
        const added = gyIds.filter(x => !exSeen.gyIds.includes(x)), gone = exSeen.gyIds.filter(x => !gyIds.includes(x));
        const fire = [];
        Object.entries(me.bf || {}).forEach(([sid, e]) => {
          const o = String(e.o || lookupCard(e.n)?.o || "");
          let m;
          if (added.length && (m = o.match(/whenever one or more land cards are put into your graveyard from anywhere, ([^.]+)\./i)) && added.some(g => /\bLand\b/.test(me.gy[g]?.t || ""))) fire.push([sid, e, m[1]]);
          if (gone.length && (m = o.match(/whenever one or more cards leave your graveyard, ([^.]+)\./i))) fire.push([sid, e, m[1]]);
        });
        if (fire.length) setTimeout(() => { fire.forEach(([sid, e, fx]) => { const sp = spellAbility({ n: `${e.n} · gy · ${fx.slice(0, 40)}`, t: "Instant", o: fx[0].toUpperCase() + fx.slice(1) + "." }), toks = sp.effs.filter(f => f.k === "tok");
          if (toks.length) act([{ type: "effects", effs: toks, times: 1, count: 1, src: dispName(e), srcId: sid }]);
          else reminders.push(normalizeRem({ id: newId(), src: dispName(e), srcId: sid, text: fx[0].toUpperCase() + fx.slice(1) + ".", times: 1 })); }); render(); }, 0);
      }
      exSeen = { ex: exNow, gyN: myGyN, gyIds };
      { const tapNow = new Set(Object.entries(me.bf || {}).filter(([, e]) => e.tap).map(([id]) => id));
        if (tapSeen) {
          const freshT = [...tapNow].filter(id => !tapSeen.has(id) && me.bf[id]), freshU = [...tapSeen].filter(id => !tapNow.has(id) && me.bf?.[id]);
          let dmg = 0; const toks = [];
          if (room.turn === pid && freshT.length && Object.values(me.bf || {}).some(x => /creatures you control have "whenever this creature becomes tapped for the first time during each of your turns, put a \+1\/\+1 counter on it/i.test(x.o || lookupCard(x.n)?.o || ""))) {
            const tk = freshT.filter(id => /\bCreature\b/.test(me.bf[id].t || "") && me.bf[id].firstTap !== (room.turnNo || 0));
            if (tk.length) setTimeout(() => { mutate(p => tk.forEach(id => { const x = p.bf?.[id]; if (x) { x.firstTap = room.turnNo || 0; x.c ||= {}; x.c.p1p1 = (x.c.p1p1 || 0) + 1; } })); logTo(code, `⚙ +1/+1 counter on ${tk.map(id => dispName(me.bf[id] || {})).join(", ")} (first tap this turn)`); }, 0); }
          if (room.turn === pid && freshT.length && Object.values(me.bf || {}).some(x => /whenever a creature you control becomes tapped during your turn, if it's the first time that creature has become tapped this turn, untap it/i.test(x.o || lookupCard(x.n)?.o || ""))) {
            const ut = freshT.filter(id => /\bCreature\b/.test(me.bf[id].t || "") && me.bf[id].capTap !== (room.turnNo || 0));
            if (ut.length) setTimeout(() => { mutate(p => ut.forEach(id => { const x = p.bf?.[id]; if (x) { x.capTap = room.turnNo || 0; delete x.tap; } })); logTo(code, `🛡 Untapped ${ut.map(id => dispName(me.bf[id] || {})).join(", ")} (first tap this turn)`); }, 0); }
          { const bw = []; freshT.forEach(id => Object.values(me.bf || {}).forEach(a => { const m = a.att === id && String(a.o || lookupCard(a.n)?.o || "").match(/whenever equipped creature becomes tapped, it deals (\d+) damage to each opponent/i); if (m) bw.push([a, Number(m[1])]); }));
            if (bw.length) setTimeout(() => bw.forEach(([a, n]) => { const hits = Object.fromEntries(opponents().filter(o => !isOut(o)).map(o => [o.id, ampDmg(n, a, true).n])); act([{ type: "effects", effs: Object.entries(hits).map(([oid, v]) => ({ k: "tlose", n: v, target: oid, targetName: room.players?.[oid]?.name })), times: 1, count: 1, src: dispName(a) }]); }), 0); }
          freshT.forEach(id => { if (/whenever (?:this land|[^,\n]+?) becomes tapped, it deals 1 damage to you/i.test(me.bf[id].o || lookupCard(me.bf[id].n)?.o || "")) dmg++; });
          Object.values(me.bf || {}).forEach(x => { const m = String(x.o || lookupCard(x.n)?.o || "").match(/[Ww]henever one or more nontoken ([A-Z][a-z]+) you control become tapped, create an? ([^.]+?) token/); if (!m) return; if (freshT.some(id => new RegExp(`\\b${m[1]}\\b`).test(me.bf[id].t || ""))) toks.push([m[2].match(/([A-Z][a-z]+) creature/)?.[1] || "Token", m[2], 1, dispName(x)]); });
          Object.values(me.bf || {}).forEach(x => { const m = String(x.o || lookupCard(x.n)?.o || "").match(/[Ww]henever an? ([A-Z][a-z]+) you control becomes tapped, create an? ([^.]+?) token/); if (!m) return; const k = freshT.filter(id => new RegExp(`\\b${m[1]}\\b`).test(me.bf[id].t || "")).length; if (k) toks.push([capName2(m[2]), m[2], k, dispName(x)]); });
          const orb = freshU.length && Date.now() - untapStepAt > 4000 && seated(room).filter(o => !isOut(o)).flatMap(o => Object.values(o.bf || {})).find(x => /whenever a permanent becomes untapped, that permanent's controller mills a card/i.test(x.o || lookupCard(x.n)?.o || ""));
          if (dmg || toks.length || orb) setTimeout(() => {
            if (dmg && !me.prot?.life && !preventMe()) { mutate(p => { p.life = (p.life ?? START_LIFE) - dmg; }); logTo(code, `🔥 ${me.name} took ${dmg} damage from tapping (City of Brass-style)`); }
            toks.forEach(([nm, desc, k, src]) => act([{ type: "create", name: nm, n: k, desc, src }]));
            if (orb) { sendNote(pid, { kind: "millLog", n: freshU.length, src: `${dispName(orb)} (untapped)`, text: "" }); logTo(code, `🪦 ${dispName(orb)}: ${me.name} untapped ${freshU.length} → mills ${freshU.length}`); }
          }, 0);
        }
        tapSeen = tapNow; }
      { const t = room.turnNo || 0, bello = room.turn === pid && Object.values(me.bf || {}).some(x => /during your turn, each non-Equipment artifact and non-Aura enchantment you control with mana value 4 or greater is a 4\/4 Elemental creature/i.test(x.o || lookupCard(x.n)?.o || ""));
        const add = bello ? Object.entries(me.bf || {}).filter(([, e]) => e.belloT !== t && !e.belloPrev && !/\bCreature\b/.test(e.t || "") && ((/\bArtifact\b/.test(e.t || "") && !/\bEquipment\b/.test(e.t || "")) || (/\bEnchantment\b/.test(e.t || "") && !/\bAura\b/.test(e.t || ""))) && manaValue(e.m) >= 4).map(([id]) => id) : [];
        const back = Object.entries(me.bf || {}).filter(([, e]) => e.belloPrev && (!bello || e.belloT !== t)).map(([id]) => id);
        if (add.length || back.length) setTimeout(() => {
          mutate(p => { back.forEach(id => { const x = p.bf?.[id]; if (!x?.belloPrev) return; x.t = x.belloPrev.t; if (x.belloPrev.p == null) delete x.p; else x.p = x.belloPrev.p; if (x.belloPrev.tg == null) delete x.tg; else x.tg = x.belloPrev.tg; delete x.belloPrev; delete x.belloT; });
            add.forEach(id => { const x = p.bf?.[id]; if (!x || x.belloPrev) return; x.belloPrev = { t: x.t, p: x.p ?? null, tg: x.tg ?? null }; x.belloT = t; const [a, b] = String(x.t).split(" — "); x.t = `${a} Creature — ${b ? b + " " : ""}Elemental`; x.p = "4"; x.tg = "4"; }); });
          if (add.length) { act([{ type: "effects", effs: add.map(id => ({ k: "pumpOn", target: { kind: "bf", id }, dp: 0, dt: 0, kws: ["indestructible", "haste"] })), times: 1, count: 1, src: "Bello" }]); logTo(code, `🦝 Bello: ${add.map(id => dispName(me.bf[id])).join(", ")} ${add.length === 1 ? "is a" : "are"} 4/4 Elemental creature${add.length === 1 ? "" : "s"} this turn`); }
          if (back.length) logTo(code, `🦝 Bello: ${me.name}'s artifacts/enchantments stop being creatures`);
        }, 0); }
      { const now = {}; seated(room).forEach(o => Object.entries(o.bf || {}).forEach(([id, e]) => { if (e.c?.m1m1) now[`${o.id}|${id}`] = e.c.m1m1; }));
        if (m1Seen) {
          const ups = Object.entries(now).filter(([k, v]) => v > (m1Seen[k] || 0)).map(([k, v]) => { const [oid, id] = k.split("|"); return { oid, id, n: v - (m1Seen[k] || 0) }; })
            .filter(u => /\bCreature\b/.test(room.players?.[u.oid]?.bf?.[u.id]?.t || ""));
          if (ups.length) setTimeout(() => Object.entries(me.bf || {}).forEach(([sid, x]) => { const o = String(x.o || lookupCard(x.n)?.o || "");
            if (/whenever one or more -1\/-1 counters are put on a creature, draw a card if you control that creature\. if you don't control it, its controller loses 1 life/i.test(o)) {
              const mineN = ups.filter(u => u.oid === pid).length; if (mineN) broadcastDraw(mineN, `${dispName(x)} (-1/-1 counters on your creature${mineN === 1 ? "" : "s"})`);
              const loss = {}; ups.filter(u => u.oid !== pid).forEach(u => { loss[u.oid] = (loss[u.oid] || 0) + 1; });
              if (Object.keys(loss).length) { const u = {}; Object.entries(loss).forEach(([oid, n]) => { u[`players/${oid}/life`] = (room.players?.[oid]?.life ?? START_LIFE) - n; }); update(ref(db, `rooms/${code}`), u); logTo(code, `⚙ ${dispName(x)}: ${Object.entries(loss).map(([oid, n]) => `${room.players?.[oid]?.name} loses ${n}`).join(", ")} (-1/-1 counters)`); } }
            const per = o.match(/whenever a -1\/-1 counter is put on a creature, (you may )?create an? ([^.]+?) token/i);
            if (per) { const k = ups.reduce((a, u) => a + u.n, 0); reminders.push(normalizeRem({ id: newId(), src: dispName(x), srcId: sid, text: `${k} -1/-1 counter${k === 1 ? " was" : "s were"} put on creatures: ${per[1] ? "you may " : ""}create ${k} ${per[2]} token${k === 1 ? "" : "s"}.`, times: 1 })); }
            if (/whenever one or more -1\/-1 counters are put on a creature, put a charge counter on this/i.test(o)) { mutate(p => { const y = p.bf?.[sid]; if (y) { y.c ||= {}; y.c.charge = (y.c.charge || 0) + ups.length; } }); logTo(code, `⚙ ${dispName(x)}: +${ups.length} charge`); }
            if (/whenever you put one or more -1\/-1 counters on a creature, create/i.test(o)) reminders.push(normalizeRem({ id: newId(), src: dispName(x), srcId: sid, text: `If you put those -1/-1 counters (${ups.length} creature${ups.length === 1 ? "" : "s"}): create that many 1/1 green Snake tokens with deathtouch.`, times: 1 }));
            render(); }), 0);
        }
        m1Seen = now; }
      { const now = {}; seated(room).filter(o => o.id !== pid).forEach(o => { now[o.id] = Object.entries(o.bf || {}).filter(([, e]) => /\bLand\b/.test(e.t || "")).map(([id]) => id); });
        if (oppLandSeen) {
          const k = Object.entries(now).reduce((a, [oid, ids]) => a + ids.filter(x => !(oppLandSeen[oid] || []).includes(x)).length, 0);
          const bg = k && Object.values(me.bf || {}).find(x => /whenever an opponent plays a land, you may put a land card from your hand onto the battlefield/i.test(x.o || lookupCard(x.n)?.o || ""));
          if (bg) { reminders.push({ id: newId(), src: dispName(bg), text: `An opponent played a land: you may put a land card from your hand onto the battlefield${k > 1 ? ` (×${k})` : ""}.`, times: 1 }); setTimeout(render, 0); }
          const seenL = oppLandSeen;
          if (k) setTimeout(() => Object.entries(me.bf || {}).forEach(([sid, x]) => { if (!/^whenever a land an opponent controls enters, that player loses 1 life\. put a \+1\/\+1 counter on this creature/im.test(x.o || lookupCard(x.n)?.o || "")) return; const who = Object.entries(now).filter(([oid, ids]) => ids.some(i => !(seenL[oid] || []).includes(i))).map(([oid]) => room.players?.[oid]?.name).join(", "); setTimeout(() => mutate(p => { const y = p.bf?.[sid]; if (y) { y.c ||= {}; y.c.p1p1 = (y.c.p1p1 || 0) + k; } }), 0); logTo(code, `⚙ ${dispName(x)}: +${k} +1/+1`); reminders.push({ id: newId(), src: dispName(x), text: `${who} had a land enter: they lose 1 life${k > 1 ? ` (×${k})` : ""}.`, times: 1 }); render(); }), 0);
        }
        oppLandSeen = now; }
      { const cb = room.combat ? `${room.combat.turnNo}:${room.combat.n || 0}` : "";
        if (combatSeen != null && cb && cb !== combatSeen && (room.combat.n || 0) > 0) {
          const nor = Object.entries(me.bf || {}).filter(([, e]) => /when a player casts a spell or a creature attacks, exile/i.test(e.o || lookupCard(e.n)?.o || ""));
          if (nor.length) setTimeout(() => nor.forEach(([id, e]) => { if (me.bf?.[id]) act([{ type: "effects", effs: [{ k: "exileRet" }], times: 1, count: 1, src: `${dispName(e)} (a creature attacked)`, srcId: id }]); }), 0);
        }
        combatSeen = cb; }
      pairsAttackCheck();
      { const now = Object.fromEntries(seated(room).filter(o => o.id !== pid).map(o => [o.id, o.life ?? START_LIFE]));
        if (oppLifeSeen && room.turn === pid) { const lost = Object.entries(now).reduce((a, [oid, l]) => a + Math.max(0, (oppLifeSeen[oid] ?? l) - l), 0);
          const kf = lost && Object.values(me.bf || {}).find(x => /whenever an opponent loses life during your turn, you draw that many cards/i.test(x.o || lookupCard(x.n)?.o || ""));
          if (kf) { reminders.push(normalizeRem({ id: newId(), src: dispName(kf), text: `Opponents lost ${lost} life: draw ${lost} card${lost === 1 ? "" : "s"}.`, times: 1, drawN: lost })); setTimeout(render, 0); } }
        { const all = { ...now, [pid]: me.life ?? START_LIFE }, prev = oppLifeSeen && { ...oppLifeSeen, [pid]: masterLifeMe ?? all[pid] }; masterLifeMe = all[pid];
          const ml = prev && Object.values(me.bf || {}).find(x => /whenever a player loses life, that player mills that many cards/i.test(x.o || lookupCard(x.n)?.o || ""));
          if (prev) { const oppLost = Object.entries(all).filter(([oid]) => oid !== pid).reduce((a, [oid, l]) => a + Math.max(0, (prev[oid] ?? l) - l), 0), meLost = Math.max(0, (prev[pid] ?? all[pid]) - all[pid]);
            Object.entries(me.bf || {}).forEach(([sid, x]) => { const o = String(x.o || lookupCard(x.n)?.o || "");
              if (oppLost && /whenever one or more opponents lose life, ([^\n]+)/i.test(o) && x.emetT !== (room.turnNo || 0) && !(/do this only once each turn/i.test(o) && valgSeen[`emet${sid}`] === (room.turnNo || 0))) { valgSeen[`emet${sid}`] = room.turnNo || 0; reminders.push(normalizeRem({ id: newId(), src: dispName(x), srcId: sid, text: o.match(/whenever one or more opponents lose life, ([^\n]+)/i)[1].replace(/^\w/, c => c.toUpperCase()), times: 1 })); setTimeout(render, 0); }
              // War Elemental: life an opponent lost that the app didn't already count as my damage → ask whether it was damage
              if (/^(?:[^—\n]{1,40} — )?whenever an opponent is dealt damage, put that many \+1\/\+1 counters/im.test(o)) Object.entries(all).filter(([oid]) => oid !== pid).forEach(([oid, l]) => { const nm = room.players?.[oid]?.name || "?"; let d = Math.max(0, (prev[oid] ?? l) - l); const c = Math.min(d, warCredit[nm] || 0); d -= c; warCredit[nm] = (warCredit[nm] || 0) - c; if (!d) return;
                const have = reminders.find(r => r.dmgAsk?.id === sid); if (have) { have.dmgAsk.n += d; have.dmgAsk.who = [...new Set([...have.dmgAsk.who, nm])]; have.text = `${have.dmgAsk.who.join(", ")} lost ${have.dmgAsk.n} life. Was an opponent dealt damage? How much?`; }
                else reminders.push({ id: newId(), src: dispName(x), srcId: sid, text: `${nm} lost ${d} life. Was an opponent dealt damage? How much?`, times: 1, dmgAsk: { id: sid, n: d, who: [nm] } });
                setTimeout(render, 0); });
              if (oppLost && /whenever an opponent loses life, you gain that much life/i.test(o)) { reminders.push(normalizeRem({ id: newId(), src: dispName(x), srcId: sid, text: `Opponents lost ${oppLost} life: gain ${oppLost} life.`, effs: [{ k: "gain", n: oppLost }], times: 1 })); setTimeout(render, 0); }
              if (/whenever an opponent loses life for the first time during each of their turns, put a \+1\/\+1 counter on [^.]+ and draw a card/i.test(o) && room.turn && room.turn !== pid && (prev[room.turn] ?? all[room.turn]) > all[room.turn] && x.valgT !== (room.turnNo || 0) && valgSeen[sid] !== (room.turnNo || 0)) { valgSeen[sid] = room.turnNo || 0; setTimeout(() => mutate(p => { const y = p.bf?.[sid]; if (y) { y.valgT = room.turnNo || 0; y.c ||= {}; y.c.p1p1 = (y.c.p1p1 || 0) + 1; } }), 0); { const nm = room.players?.[room.turn]?.name; setTimeout(() => logTo(code, `⚙ ${dispName(x)}: ${nm} lost life on their turn → +1/+1`), 0); } reminders.push({ id: newId(), src: dispName(x), srcId: sid, text: "Draw a card.", times: 1 }); setTimeout(render, 0); }
              { const gl = meLost && !/whenever you lose life, draw that many cards/i.test(o) && o.match(/whenever you lose life(?! for the first time)(?: during your turn)?, ([^\n]+)/i);
                if (gl) { reminders.push(normalizeRem({ id: newId(), src: dispName(x), srcId: sid, text: `You lost ${meLost} life: ${gl[1].replace(/\bfor each 1 life you lost,\s*/i, `${meLost}× `).replace(/\bthat many\b/gi, String(meLost)).replace(/^\w/, c => c.toUpperCase())}`, times: 1 })); setTimeout(render, 0); } }
              if (meLost && /whenever you lose life, draw that many cards/i.test(o)) { reminders.push({ id: newId(), src: dispName(x), srcId: sid, text: `You lost ${meLost} life: draw ${meLost} card${meLost === 1 ? "" : "s"}.`, drawN: meLost, times: 1 }); setTimeout(render, 0); } }); }
          if (ml) Object.entries(all).forEach(([oid, l]) => { const d = (prev[oid] ?? l) - l; if (d > 0) { const nm = oid === pid ? "You" : room.players?.[oid]?.name || "?"; reminders.push({ id: newId(), src: dispName(ml), text: `${nm} lost ${d} life → ${oid === pid ? "mill" : "mills"} ${d} card${d === 1 ? "" : "s"}.`, times: 1 }); setTimeout(render, 0); } }); }
        oppLifeSeen = now; }
      if (room.turn && room.turn !== pid && oppCombatSeen !== (room.turnNo || 0) && ((room.step?.turnNo === (room.turnNo || 0) && STEPS[room.step.i] === "Combat") || (room.combat?.turnNo === (room.turnNo || 0) && room.combat.n > 0))) {
        const first = oppCombatSeen === null; oppCombatSeen = room.turnNo || 0; if (!first) setTimeout(() => phaseEvents([{ type: "phase", phase: "combat", mine: false }]), 0); }
      else if (oppCombatSeen === null) oppCombatSeen = -1;
      lighthouseBy = room.lighthouse && room.lighthouse.turnNo === (room.turnNo || 0) ? room.lighthouse.by : null;
    }
    const casts = room.casts || {};
    if (seenCasts === null) seenCasts = new Set(Object.keys(casts));
    else {
      const fresh = Object.entries(casts).filter(([k]) => !seenCasts.has(k));
      fresh.forEach(([k]) => seenCasts.add(k));
      // earlier spells the same player cast this turn ("their first … spell each turn")
      const priorOf = c => Object.values(casts).filter(x => x.by === c.by && (x.turnNo || 0) === (c.turnNo || 0) && x.at < c.at).map(x => ({ n: x.n, t: x.t }));
      const theirs = fresh.filter(([, c]) => c.by !== pid).map(([, c]) => ({ type: "oppcast", card: { n: c.n, t: c.t, m: c.m || "" }, by: c.by, prior: priorOf(c) }));
      if (theirs.length) phaseEvents(theirs);
    }
    // my spells that got countered (or whose counterspell got countered)
    Object.entries(casts).forEach(([k, c]) => {
      const st = steps[k];
      if (c.by === pid && !st && c.countered && !lostCtr.has(k + c.countered.at)) {
        lostCtr.add(k + c.countered.at);
        if (c.countered.at > bootAt) { reminders.push({ id: newId(), src: c.countered.src, text: `${c.countered.byName} countered your ${c.nick || c.n}${c.countered.unless ? ` (unless you pay ${c.countered.unless})` : ""}.`, times: 1,
          note: "This phone lost track of that spell (page reloaded?). Remove it and anything it did by hand." }); render(); }
      }
      if (c.by !== pid || !st) return;
      const ctr = c.countered;
      if (ctr && st.seenCtr !== ctr.at) {
        st.seenCtr = ctr.at;
        if (ctr.unless) {
          reminders.push({ id: newId(), src: ctr.src, text: `${ctr.byName}'s ${ctr.src}: pay ${ctr.unless} or ${st.name} is countered.`, times: 1, unlessCtr: { key: k, ctr, cost: ctr.unless } });
          render();
        } else revertCast(k, ctr);
      } else if (!ctr && st.seenCtr) {
        st.seenCtr = null;
        const ask = reminders.find(r => r.unlessCtr?.key === k);
        if (ask) { reminders = reminders.filter(r => r !== ask); render(); }
        if (st.reverted) reapplyCast(k);
      }
    });
    const draws = room.draws || {};
    if (seenDraws === null) seenDraws = new Set(Object.keys(draws));
    else {
      const fresh = Object.entries(draws).filter(([k]) => !seenDraws.has(k));
      fresh.forEach(([k]) => seenDraws.add(k));
      const theirs = fresh.filter(([, d]) => d.by !== pid).map(([k, d]) => ({ type: "oppdraw", n: d.n || 1, by: d.by, step: !!d.step, theirTurn: room.turn === d.by,
        before: Object.entries(draws).filter(([k2, x]) => k2 < k && x.by === d.by && (x.turnNo || 0) === (d.turnNo || 0)).reduce((a, [, x]) => a + (x.n || 1), 0) }));
      if (theirs.length) phaseEvents(theirs);
      { const al = theirs.filter(d => d.n >= 2), ac = al.length && Object.values(me.bf || {}).find(x => /if an opponent would draw two or more cards, instead you and that player each draw a card/i.test(x.o || lookupCard(x.n)?.o || ""));
        if (ac) al.forEach(d => { reminders.push({ id: newId(), src: dispName(ac), text: `${room.players?.[d.by]?.name || "An opponent"} drew ${d.n}: instead you and they each draw one (they put back ${d.n - 1}).`, times: 1, drawN: 1 }); sendNote(d.by, { text: `${me.name}'s ${dispName(ac)}: instead of drawing ${d.n}, you draw 1 (put the rest back) and ${me.name} draws 1.`, src: dispName(ac) }); }); }
    }
    // answers to "that player may pay…" questions we asked
    // each order / reply runs exactly once, even when several arrive together
    Object.entries(room.orders?.[pid] || {}).forEach(([oid, o]) => {
      if (doneMsgs.has("o" + oid)) return;
      doneMsgs.add("o" + oid);
      update(ref(db, `rooms/${code}/orders/${pid}`), { [oid]: null });
      executeOrder(o);
    });
    Object.entries(room.replies?.[pid] || {}).forEach(([rid, rep]) => {
      if (doneMsgs.has("r" + rid + (rep.at || ""))) return;
      doneMsgs.add("r" + rid + (rep.at || ""));
      update(ref(db, `rooms/${code}/replies/${pid}`), { [rid]: null });
      if (rid.includes("_")) { const [base, oid] = rid.split("_"), rw = reminders.find(x => x.id === base && x.wom); if (rw) { rw.wom.ans = { ...(rw.wom.ans || {}), [oid]: Math.max(0, Number(rep.count) || 0) }; womCheck(rw); render(); } return; }
      const r = reminders.find(x => x.id === rid);
      if (r?.oppPick) resolveOppPick(r, rep);
      else if (r?.handMana) handManaDone(r, Number(rep.count) || 0, rep.name);
      else if (r) resolvePunish(r, rep.paid, rep.name);
    });
    if (prevTurn !== undefined && lastTurn && lastTurn !== prevTurn) {
      const mine = room.turn === pid;
      const ctl = room.control;
      if (ctl && ctl.by === pid) { // the controlling player's phone keeps the banner up to date
        if (!ctl.active && room.turn === ctl.target) { update(ref(db, `rooms/${code}/control`), { active: true }); logTo(code, `🎮 ${ctl.byName} controls ${ctl.targetName}'s turn (${ctl.src})`); }
        else if (ctl.active && room.turn !== ctl.target) { update(ref(db, `rooms/${code}`), { control: null }); logTo(code, `🎮 ${ctl.targetName}'s controlled turn is over`); }
      }
      if (me.shields || Object.values(me.tokens || {}).some(t => t.sh)) mutate(p => { delete p.shields; Object.values(p.tokens || {}).forEach(t => delete t.sh); tidyTokenStacks(p); });
      if (me.eot || Object.values(me.tokens || {}).some(t => t.pump)) {
        mutate(p => { delete p.eot; Object.values(p.tokens || {}).forEach(t => { delete t.pump; delete t.ep; }); tidyTokenStacks(p); });
        logTo(code, `${me.name}: "until end of turn" effects ended`);
      }
      if (mine) mutate(p => { p.myTurnNo = room.turnNo || 0; p.turns = (p.turns || 0) + 1; });
      if (mine) Object.entries(me.ex || {}).filter(([, x]) => x.rebound != null && x.rebound < (room.turnNo || 0)).forEach(([xid, x]) => reminders.push({ id: newId(), src: dispName(x), text: `Rebound: you may cast ${dispName(x)} from exile without paying its mana cost.`, times: 1, rebound: xid }));
      untapStep(mine);
      // draw step: the first player in a 2-player game skips their first draw
      const skip = mine && boardEnv().skipDraw[0];
      if (skip) logTo(code, `${me.name} skips their draw step (${skip.src})`);
      else if (mine && !(room.turnNo === 1 && seated(room).length === 2 && store.get("mtga_firstdraw") !== "on")) broadcastDraw(1, "draw step"); // official: in a 2-player game the first player skips their first draw (house rule switch on the Hand tab)
      if (mine) tickSuspend();
      if (mine) Object.values(me.bf || {}).filter(x => /at the beginning of each of your main phases, if you haven't added mana with this ability this turn, you may add X mana of any one color, where X is the number of Islands target opponent controls/i.test(x.o || lookupCard(x.n)?.o || "")).forEach(x => {
        const best = Math.max(0, ...opponents().filter(o => !isOut(o)).map(o => Object.values(o.bf || {}).filter(l => /\bIsland\b/.test(l.t || "")).length));
        if (best) reminders.push({ id: newId(), src: dispName(x), text: `Main phase: add ${best} mana of one color (most Islands an opponent controls).`, times: 1, anyColor: true, anyN: best, anyOne: true }); });
      { const dd = (me.delayDraw || []).filter(d => d.turnNo < (room.turnNo || 0));
        if (dd.length) { mutate(p => { p.delayDraw = (p.delayDraw || []).filter(d => d.turnNo >= (room.turnNo || 0)); if (!p.delayDraw.length) delete p.delayDraw; }); dd.forEach(d => reminders.push(normalizeRem({ id: newId(), src: d.src, text: "Draw a card (this upkeep).", times: 1 }))); } }
      if (mine) { const cum = Object.entries(me.bf || {}).map(([id, e]) => [id, e, (String(e.o || lookupCard(e.n)?.o || "").match(/^Cumulative upkeep[—-]\s*([^(\n]+?)\.?\s*(?:\(|$)/m) || [])[1]]).filter(x => x[2]);
        if (cum.length) { mutate(p => cum.forEach(([id]) => { const x = p.bf?.[id]; if (x) { x.c ||= {}; x.c.x_age = (x.c.x_age || 0) + 1; } }));
          cum.forEach(([id, e, cost]) => { const n = (me.bf?.[id]?.c?.x_age || 0) || 1, lf = (cost.match(/^pay (\d+) life$/i) || [])[1];
            reminders.push({ id: newId(), src: dispName(e), srcId: id, text: `Cumulative upkeep: ${cost} ×${n} (age counters), or sacrifice ${dispName(e)}.`, times: 1, cumUp: { id, cost, n, life: lf ? Number(lf) : 0 } }); }); } }
      if (mine) Object.entries(me.bf || {}).forEach(([id, e]) => { const ec = e.et != null && e.et < (room.turnNo || 0) && !e.echoDone && (String(e.o || lookupCard(e.n)?.o || "").match(/^Echo ((?:\{[^}]+\})+)/m) || [])[1];
        if (ec) reminders.push({ id: newId(), src: dispName(e), srcId: id, text: `Echo: pay ${ec} or sacrifice ${dispName(e)}.`, times: 1, echo: { id, cost: ec } }); });
      if (mine) checkWinsAt("upkeep");
      if (mine) turnAlert();
      if (!mine && room.turn) { const act0 = room.players?.[room.turn]; if (act0) Object.entries(me.bf || {}).forEach(([id, x]) => { const t = String(x.o || lookupCard(x.n)?.o || "");
        const la = t.match(/^at the beginning of the upkeep of enchanted creature's controller, that player loses (\d+) life/im);
        if (la) reminders.push({ id: newId(), src: dispName(x), srcId: id, text: `${act0.name}'s upkeep: if ${dispName(x)} enchants one of their creatures, they lose ${la[1]} life.`, times: 1, effs: [{ k: "tlose", n: Number(la[1]) }] });
        const rk = t.match(/^at the beginning of the chosen player's upkeep, (?:this artifact|[^,]+?) deals X damage to that player, where X is (\d+) minus the number of cards in their hand/im);
        if (rk) reminders.push({ id: newId(), src: dispName(x), srcId: id, text: `${act0.name}'s upkeep: if they're the chosen player, ${dispName(x)} deals ${rk[1]} minus their hand size in damage to them.`, times: 1 }); }); }
      if (mine) seated(room).filter(o => !isOut(o) && o.id !== pid).forEach(o => Object.values(o.bf || {}).forEach(x => { const t = String(x.o || lookupCard(x.n)?.o || "");
        const ep = t.match(/^at the beginning of each player's upkeep, that player ([^\n]+)/im);
        if (ep) { const fade = /for each fade counter/i.test(ep[1]) ? (x.c?.fade ?? null) : null;
          reminders.push({ id: newId(), src: `${o.name}'s ${dispName(x)}`, text: ("You " + ep[1].replace(/\bthey control\b/gi, "you control").replace(/\btheir\b/gi, "your")).replace(/\bYou taps\b/, "You tap").replace(/\bYou sacrifices\b/, "You sacrifice").replace(/\bYou loses\b/, "You lose").replace(/\bYou discards\b/, "You discard").replace(/\bYou draws\b/, "You draw"), note: fade != null ? `${fade} fade counter${fade === 1 ? "" : "s"} on it now` : "", times: 1 }); }
        const kt = t.match(/^all artifacts have "at the beginning of your upkeep, sacrifice this artifact unless you pay \{(\d+)\}\."/im);
        if (kt) { const n = countTypes(me, ["artifact"]); if (n) reminders.push({ id: newId(), src: `${o.name}'s ${dispName(x)}`, text: `Pay {${Number(kt[1])}} for each of your ${n} artifact${n === 1 ? "" : "s"} (up to {${n * Number(kt[1])}}), or sacrifice the ones you don't pay for.`, times: 1 }); } }));
      if (mine && me.effects?.initiative) { reminders.push({ id: newId(), src: "🗝️ Initiative", text: "Upkeep: venture into Undercity.", times: 1, venture: { under: true } }); setTimeout(render, 0); }
      if (mine) Object.entries(me.delayed || {}).filter(([, d]) => (d.turnNo || 0) < (room.turnNo || 0)).forEach(([did, d]) =>
        reminders.push({ id: newId(), src: d.src, text: `Pay ${d.cost} now, or you lose the game.`, times: 1, pact: { id: did, cost: d.cost } }));
      if (mine && Object.keys(me.delayed || {}).length) render();
      if (mine && (me.rad || 0) > 0) { reminders.push({ id: newId(), src: "☢ Radiation", text: `Precombat main: mill ${me.rad} card${me.rad === 1 ? "" : "s"}. For each nonland card milled, ${Object.values(me.bf || {}).some(x => /you gain life rather than lose life from radiation/i.test(x.o || lookupCard(x.n)?.o || "")) ? "gain" : "lose"} 1 life and remove a rad counter.`, times: 1, radMill: me.rad }); setTimeout(render, 0); }
      // start-of-turn triggers come up together; the draw-step and main-phase ones say when they happen (Ripples of Undeath)
      { const whose = mine ? "your" : `${room.players?.[room.turn]?.name || "their"}'s`; ["upkeep", "draw", "main1"].forEach(phase => phaseEvents([{ type: "phase", phase, mine, active: room.turn }], phase === "draw" ? `During ${whose} draw step` : phase === "main1" ? `During ${whose} first main phase` : "")); }
      if (mine && Object.values(me.bf || {}).some(e => /\bAttraction\b/.test(e.t || ""))) reminders.push({ id: newId(), src: "🎡 Attractions", text: "Precombat main: roll to visit your Attractions. Roll a six-sided die.", times: 1, visitRoll: true });
      if (me.riders) mutate(p => { delete p.riders; }, true);
      poolStepEnd(true, true);
      if (me.tempMana && me.tempMana.until < (room.turnNo || 0)) mutate(p => { delete p.tempMana; }, true);
      if (Object.values(me.tokens || {}).some(t => t.ind && t.ind < (room.turnNo || 0))) mutate(p => { Object.values(p.tokens || {}).forEach(t => { if (t.ind && t.ind < (room.turnNo || 0)) { delete t.ind; delete t.indSrc; } }); tidyTokenStacks(p); }, true);
      if (mine) vanishTick();
      const tab = mine && tabernacleCost();
      if (tab && (Object.values(me.bf || {}).some(e => /\bCreature\b/.test(e.t || "")) || Object.values(me.tokens || {}).some(t => isCreatureToken(t.name)))) { reminders.push({ id: newId(), src: tab.srcs.join(", "), text: `Upkeep: pay {${tab.n}} for each creature you control, or destroy it.`, times: 1, tabernacle: tab }); render(); }
      const sagas = mine ? Object.entries(me.bf || {}).filter(([, e]) => /\bSaga\b/.test(e.t || "")) : [];
      if (sagas.length) { logTo(code, `📜 ${me.name}: lore counter on ${sagas.map(([, e]) => dispName(e)).join(", ")} (after the draw step)`); act([], p => sagas.forEach(([id]) => { const x = p.bf?.[id]; if (x) { x.c ||= {}; x.c.lore = (x.c.lore || 0) + 1; } })); }
    }
  });
}

// ---------- Boot ----------
function renderSetupNeeded(detail = "") {
  app.innerHTML = `
  <div class="home">
    <h1>Almost there</h1>
    <section class="card">
      <p>Open <b>config.js</b> and paste in your Firebase values, then upload the folder again.</p>
      ${detail ? `<p class="error">${esc(detail)}</p>` : ""}
    </section>
  </div>`;
}

function init() {
  if (!firebaseConfig || /PASTE/.test(firebaseConfig.apiKey) || /PASTE/.test(firebaseConfig.databaseURL || "PASTE")) {
    renderSetupNeeded(); return;
  }
  try {
    db = getDatabase(initializeApp(firebaseConfig));
  } catch (err) {
    renderSetupNeeded(err.message); return;
  }
  const host = params.get("host"), watch = params.get("watch");
  const room = params.get("room");
  if (watch) startHost(watch.toUpperCase(), true); // view-only board for remote friends
  else if (host) startHost(host.toUpperCase());
  else if (room) startJoinOrPlay(room.toUpperCase()).catch(err => renderHome(err.message));
  else renderHome();
}

init();
