// Thin glue between a quest room and the vendored shell (levels, hints, stars). No hint/star logic here.
import { startGame } from './vendor/shell.js';

const BAND = { a: 0, b: 1, c: 2 };
const key = id => `fc-quest-${id}`;

function load(id){
  try { const j = JSON.parse(globalThis.localStorage.getItem(key(id))); return j && typeof j === 'object' ? j : {}; } catch (e) { return {}; }
}
export function saveQuest(gameId, ctl){
  try { globalThis.localStorage.setItem(key(gameId), JSON.stringify(ctl.save())); } catch (e) {}
}

// band: 'a'|'b'|'c'; levels(band, index) -> { kind, target, extra, ...data }. Returns the shell controller unchanged.
export function startQuest(game, { gameId, band, levels }){
  const b = BAND[band] ?? 1;
  return startGame(game.telemetry, { game: gameId, band: b, mode: 'solo', device: 'same', progress: load(gameId) },
    (bi, i) => levels(['a', 'b', 'c'][bi], i));
}

// A band chosen in the room's band chip: the controller carries on at that band (the room then restarts at level 1).
export function setQuestBand(ctl, band){ ctl.setBand(BAND[band] ?? 1); }
