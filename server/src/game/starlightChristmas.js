import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import SlotSettingsLib from './starlightchristmasLib/SlotSettings.js';
import ServerLib from './starlightchristmasLib/Server.js';
import LoaderLib from './starlightchristmasLib/Loader.js';
import LogLib from './starlightchristmasLib/Log.js';
import WinPermissionLib from './starlightchristmasLib/WinPermission.js';
import SpinDispenserLib from './starlightchristmasLib/SpinDispenser.js';
import SpinStateLib from './starlightchristmasLib/SpinState.js';
import SpinResultLib from './starlightchristmasLib/SpinResult.js';
import FreeSpinStateLib from './starlightchristmasLib/FreeSpinState.js';
import { preserveFreeSpinsAfterCollect, hasRemainingFreeSpins } from './starlightchristmasLib/FreeSpinCollectState.js';
import BuyFreeSpinsStateLib from './starlightchristmasLib/BuyFreeSpinsState.js';
import FormatterStateLib from './starlightchristmasLib/FormatterState.js';
import * as PragmaticLib from './starlightchristmasLib/PragmaticLib.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const INIT_LINES = JSON.parse(fs.readFileSync(path.join(here, 'starlight-christmas-init.json'), 'utf8'));
const INIT = Object.fromEntries(INIT_LINES.map((line) => {
  const i = line.indexOf('=');
  return i < 0 ? [line, ''] : [line.slice(0, i), line.slice(i + 1)];
}));
const nowMs = () => Date.now();
const REQUIRED_PRAGMATIC_EXPORTS = ['SlotSettings','Server','Loader','Log','WinPermission','SpinDispenser','SpinState','SpinResult','FreeSpinState','BuyFreeSpinsState','FormatterState'];
for (const name of REQUIRED_PRAGMATIC_EXPORTS) {
  if (!PragmaticLib[name]) throw new Error(`PragmaticLib missing required export: ${name}`);
}
const n = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};
const fmt = (value) => String(Math.round((n(value) + Number.EPSILON) * 100) / 100);
const splitInts = (value) => String(value || '').split(',').map((x) => Number.parseInt(x.trim(), 10)).filter(Number.isFinite);
const formString = (value) => String(value ?? '');
const parseBody = (body) => {
  if (typeof body === 'string') return Object.fromEntries(new URLSearchParams(body));
  return body || {};
};
function response(res, fields) {
  res.status(200).type('text/plain; charset=utf-8').send(fields.filter((x) => x !== undefined && x !== null).join('&'));
}
function baseFields(balance, data = {}) {
  return [
    'accm=cp', 'acci=0', `accv=${data.accv ?? 0}`, `balance=${fmt(balance)}`,
    `index=${data.index ?? 1}`, `balance_cash=${fmt(balance)}`, `reel_set=${data.reelSet ?? 0}`,
    'balance_bonus=0.00', `na=${data.na ?? 's'}`, `bl=${data.bl ?? 0}`, `stime=${nowMs()}`,
    `sa=${(data.sa || [4,10,8,8,6,11]).join(',')}`, `sb=${(data.sb || [11,3,7,5,9,10]).join(',')}`,
    'sh=5', `c=${data.bet ?? INIT.defc ?? '0.01'}`, 'sver=5', `counter=${data.counter ?? 2}`,
    `l=${data.lines ?? 20}`, `s=${(data.symbols || splitInts(INIT.def_s)).join(',')}`, `w=${fmt(data.win ?? 0)}`
  ];
}
function makeInit(balance, state) {
  // Start with the reference init data, then merge any persisted state without
  // leaving duplicate protocol keys. Some HTML5 builds read the first matching
  // key while others read the last one; duplicates can leave the active reel
  // set index inconsistent with the parsed reel sets.
  const lines = [...INIT_LINES];
  if (Array.isArray(state?.serverState)) lines.push(...state.serverState);
  lines.push(`stime=${nowMs()}`, `balance=${fmt(balance)}`, `balance_cash=${fmt(balance)}`);

  // Ensure the initial screen and active reel set are always valid, even when
  // a session contains stale serverState from an earlier failed initialization.
  const activeReels = String(INIT.reel_set0 || '').split('~');
  if (activeReels.length < 6 || activeReels.slice(0, 6).some((reel) => !reel.trim())) {
    throw new Error('StarlightChristmas init data is missing one or more reel strips.');
  }
  lines.push(
    `s=${INIT.def_s}`,
    `sa=${INIT.def_sa || '4,10,8,8,6,11'}`,
    `sb=${INIT.def_sb || '11,3,7,5,9,10'}`,
    'bl=0',
    `c=${INIT.defc || '0.01'}`,
    `l=${INIT.l || '20'}`,
    'n_reel_set=0',
    'reel_set=0'
  );
  for (let reelIndex = 0; reelIndex < 6; reelIndex++) {
    lines.push(`reel${reelIndex}=${activeReels[reelIndex]}`);
  }

  // Deduplicate key=value fields deterministically, preserving the final
  // intended value for each key. This keeps reel_set_size/reel_set0..7 intact
  // while ensuring stale session fields cannot override the active reel index.
  const values = new Map();
  const passthrough = [];
  for (const line of lines) {
    const text = String(line);
    const i = text.indexOf('=');
    if (i < 0) passthrough.push(text);
    else values.set(text.slice(0, i), text.slice(i + 1));
  }
  return LoaderLib.build([...passthrough, ...[...values].map(([key, value]) => `${key}=${value}`)]);
}
function getReels(reelSet, gameSettings = {}) {
  const configured = gameSettings[`reelSet${reelSet}`];
  const raw = (typeof configured === 'string' && configured.trim()) || INIT[`reel_set${reelSet}`] || INIT.reel_set0;
  return raw.split('~').map((part) => part.split(',').map((x) => Number.parseInt(x, 10)).filter(Number.isFinite));
}
function spinArea(reelSet, previousState, gameSettings = {}) {
  const reels = getReels(reelSet, gameSettings);
  const columns = [];
  const after = [];
  const below = [];
  for (const reel of reels) {
    if (!reel.length) throw new Error('Reel strip is empty in PHP reference data.');
    const start = Math.floor(Math.random() * reel.length);
    const looped = reel.concat(reel.slice(0, 10));
    const visible = Array.from({length: 5}, (_, i) => looped[(start + i) % looped.length]);
    columns.push(visible);
    after.push(looped[(start - 1 + looped.length) % looped.length]);
    below.push(visible[visible.length - 1]);
  }
  if (previousState && ['Respin','FirstRespin'].includes(previousState.State) && Array.isArray(previousState.SlotArea)) {
    const prior = previousState.SlotArea;
    const winSymbols = [...new Set((previousState.WinLines || []).map((x) => Number(x.WinSymbol)))];
    const priorColumns = Array.from({length: 6}, (_, col) =>
      Array.from({length: 5}, (_, row) => prior[row * 6 + col]).filter((sym) => !winSymbols.includes(Number(sym)))
    );
    for (let col = 0; col < 6; col++) {
      const need = 5 - priorColumns[col].length;
      if (need > 0) priorColumns[col] = columns[col].slice(5 - need).concat(priorColumns[col]);
      columns[col] = priorColumns[col].slice(0, 5);
    }
    for (let col = 0; col < 6; col++) {
      below[col] = columns[col][4];
    }
  }
  const slotArea = [];
  for (let row = 0; row < 5; row++) for (let col = 0; col < 6; col++) slotArea.push(columns[col][row]);
  return {SlotArea: slotArea, SymbolsAfter: after, SymbolsBelow: below};
}
function getWins(slotArea, bet, gameSettings = {}) {
  const table = String(gameSettings.paytable || INIT.paytable || '').split(';').map((row) => row.split(',').map(Number));
  const counts = new Map();
  slotArea.forEach((sym) => counts.set(Number(sym), (counts.get(Number(sym)) || 0) + 1));
  const wins = [];
  let total = 0;
  for (const [symbol, count] of counts.entries()) {
    const row = table[symbol] || [];
    const amount = n(row[row.length - count], 0) * bet;
    const pay = Math.round((amount + Number.EPSILON) * 100) / 100;
    if (pay > 0) {
      const positions = [];
      slotArea.forEach((s, i) => { if (Number(s) === symbol) positions.push(i); });
      wins.push({WinSymbol: symbol, CountSymbols: count, Pay: pay, Positions: positions});
      total += pay;
    }
  }
  return {TotalWin: Math.round((total + Number.EPSILON) * 100) / 100, WinLines: wins};
}
function positionsToServer(winLines) {
  return FormatterStateLib.positionsToServer(winLines);
}
function scatterInfo(slotArea, bet, state, gameSettings = {}) {
  const scatters = slotArea.map((s, i) => Number(s) === n(gameSettings.scatterSymbol, 1) ? i : -1).filter((i) => i >= 0);
  if (!scatters.length) return null;
  const settingsNeed = n(gameSettings.settingsNeedFs, n(INIT.settings_needfs, 4));
  const settingsFs = n(gameSettings.settingsFs, n(INIT.settings_fs, 15));
  if (isFreeGameSpinActive(state)) {
    if (scatters.length >= n(gameSettings.settingsNeedAddFs, n(INIT.settings_needaddfs, 3))) return {add: n(gameSettings.settingsAddFs, n(INIT.settings_addfs, 5))};
    return null;
  }
  if (scatters.length < settingsNeed) return null;
  const scatterTable = (typeof gameSettings.scatterPayTable === 'string' && gameSettings.scatterPayTable.trim() ? gameSettings.scatterPayTable : String(INIT.scatters || '').split('~')[1] || '').split(',').reverse().map(Number) || [];
  const pay = Math.round((n(scatterTable[scatters.length - 1], 0) * bet + Number.EPSILON) * 100) / 100;
  return pay > 0 ? {FreeSpins: settingsFs, Pay: pay, ScatterPositions: scatters, Scatter: n(gameSettings.scatterSymbol, 1)} : null;
}

function multiplierConfig(gameSettings = {}) {
  const raw = String(INIT.prm || '12~2,3,4,5,6,8,10,12,15,20,25,50,100,250,500').split(';')[0].split('~');
  return {
    // Admin configuration takes precedence; legacy RTP.G6 values remain fallback.
    symbol: n(gameSettings.multiplierSymbol, n(raw[0], 12)),
    values: (typeof gameSettings.multiplierValues === 'string' && gameSettings.multiplierValues.trim()
      ? gameSettings.multiplierValues : (raw[1] || '2,3,4,5,6,8,10,12,15,20,25,50,100,250,500'))
      .split(',').map((v) => n(v, 0)).filter((v) => v > 0)
  };
}
export function isFreeGameSpinActive(state = {}) {
  const current = Number(state?.FreeSpinNumber || 0);
  const total = Number(state?.FreeSpins || 0);
  // LastFreeSpin describes the feature's final boundary in some legacy states;
  // it must not disable the currently numbered final spin before that spin ends.
  return Number.isFinite(current) && Number.isFinite(total) && current > 0 && total > 0 && current <= total;
}

export function settleFreeGameTumble({sessionTotal=0, tumbleWin=0, multiplier=0, maxPayout=Infinity, enforceMax=true}={}) {
  const session = Math.max(0, n(sessionTotal, 0));
  const base = Math.max(0, n(tumbleWin, 0));
  const mult = Math.max(0, n(multiplier, 0));
  const rawPayout = mult > 0 ? base * mult : base;
  const remaining = enforceMax ? Math.max(0, n(maxPayout, Infinity) - Math.max(0, session - base)) : Infinity;
  const paidTumbleWin = Math.round((Math.min(rawPayout, remaining) + Number.EPSILON) * 100) / 100;
  const priorSessionWin = Math.max(0, session - base);
  const totalWin = Math.round((priorSessionWin + paidTumbleWin + Number.EPSILON) * 100) / 100;
  return {paidTumbleWin, totalWin, multiplierWin:mult > 0 ? paidTumbleWin : 0, maxWinReached:enforceMax && totalWin >= n(maxPayout, Infinity) - 0.000001};
}

function findMultipliers(slotArea, previousState, isFreeSpin, gameSettings = {}) {
  // Multiplier symbols are rendered in both base game and Free Spins.
  // As in the PHP reference, their accumulated payout effect is handled separately
  // and only applied at the end of a Free Spins tumble chain.
  const config = multiplierConfig(gameSettings);
  const previous = Array.isArray(previousState?.Multipliers) ? previousState.Multipliers : [];
  const byReel = new Map(previous.map((m) => [Number(m.Reel), Number(m.Multiplier)]));
  const found = [];
  // SlotArea is row-major (six symbols per row); PHP traverses each reel bottom-up.
  for (let reel = 0; reel < 6; reel++) {
    for (let row = 4; row >= 0; row--) {
      const position = row * 6 + reel;
      if (Number(slotArea[position]) !== config.symbol) continue;
      const multiplier = byReel.has(reel)
        ? byReel.get(reel)
        : config.values[Math.floor(Math.random() * config.values.length)] || 2;
      found.push({Symbol: config.symbol, Position: position, Multiplier: multiplier, Reel: reel});
    }
  }
  return found;
}
function serializeMultipliers(multipliers) {
  if (!multipliers?.length) return [];
  const groups = multipliers.map((m) => `${m.Symbol}~${m.Position}~${m.Multiplier}`);
  return [`rmul=${groups.join(';')}`];
}

export function shouldResolveQueuedFeature({stateName='Spin', isTumble=false, winTotal=0, hasPendingFeature=false}={}) {
  // A tumble's final response changes persisted State to LastRespin. The
  // following request is therefore not `isTumble`, but it still must resolve
  // a scatter feature queued during that tumble chain.
  return hasPendingFeature && Number(winTotal) === 0 &&
    (Boolean(isTumble) || stateName === 'LastRespin');
}

export function shouldCloseSpinRound({featureFinished=false, queuedFeatureNotice=false, freeSpinRound=false, stateName='Spin', isTumble=false, winTotal=0}={}) {
  // A completed feature always closes. A queued feature notice only closes
  // the base-game round; a retrigger notice inside an active Free Game must
  // not send na=c or the client can remain stuck before the next free spin.
  if (featureFinished) return true;
  if (queuedFeatureNotice && !freeSpinRound) return true;
  const freeGameStillRunning = freeSpinRound && !featureFinished;
  return !freeGameStillRunning && (stateName === 'LastRespin' || (isTumble && Number(winTotal) === 0));
}

function serverStateFrom(state) {
  return Array.isArray(state?.serverState) ? state.serverState : [];
}
function buildSpinResponse(balance, args, state, slot, win, newState, options = {}) {
  const bet = n(args.c, 0.01);
  const lines = n(args.l, 20);
  const index = n(args.index, 1);
  const counter = n(args.counter, 2);
  const bl = n(args.bl, 0);
  const reelSet = options.reelSet ?? 0;
  const totalWin = n(newState.TotalWin, win.TotalWin);
  const base = [
    `tw=${fmt(totalWin)}`, 'prg_m=wm', `balance=${fmt(balance)}`, 'prg=1', 'accm=cp', 'acci=0', 'accv=0', `index=${index}`,
    `balance_cash=${fmt(balance)}`, `reel_set=${reelSet}`, 'balance_bonus=0.00', `na=${options.na || 's'}`,
    `bl=${bl}`, `stime=${nowMs()}`, `sa=${slot.SymbolsAfter.join(',')}`, `sb=${slot.SymbolsBelow.join(',')}`,
    'sh=5', `c=${fmt(bet)}`, 'sver=5', `counter=${counter}`, `l=${fmt(lines)}`,
    `s=${slot.SlotArea.join(',')}`, `w=${fmt(win.TotalWin)}`
  ];
  if (win.TotalWin > 0) {
    base.push(...positionsToServer(win.WinLines));
    if (options.firstTumble) {
      // PHP LogAndServer reports the current tumble-chain win here, not the
      // cumulative Free Game/session total carried by `tw`.
      const tumbleWin = n(newState.TumbleWin, win.TotalWin);
      base.push('rs=mc', `rs_p=0`, 'rs_c=1', 'rs_m=1', `tmb_win=${fmt(tumbleWin)}`, `tmb_res=${fmt(tumbleWin)}`);
    } else if (options.tumble) {
      const tumbleWin = n(newState.TumbleWin, win.TotalWin);
      base.push(`rs_p=${n(state?.Respin,0)+1}`, 'rs_c=1', 'rs_m=1', `tmb_win=${fmt(tumbleWin)}`, `tmb_res=${fmt(tumbleWin)}`, `rs_win=${fmt(n(newState.RespinWin, tumbleWin))}`);
    }
  }
  if (options.lastTumble) {
    // A LastRespin completes only the current tumble chain. It must not close
    // the whole round when free spins remain. `options.na` was calculated from
    // the persisted FreeSpinNumber/FreeSpins counters by shouldCloseSpinRound.
    // In particular, forcing na=c here ends a 15-spin feature after its first
    // winning spin because every tumble chain ends with a LastRespin response.
    const tumbleWin = n(state?.TumbleWin, n(state?.TotalWin, 0));
    // Keep the final tumble display scoped to this tumble chain. `tw` above
    // remains the cumulative spin/Free Game total, as in the PHP response.
    base.push(`rs_t=${n(state?.Respin,0)+1}`, `rs_win=${fmt(n(state?.RespinWin, tumbleWin))}`, `tmb_res=${fmt(tumbleWin)}`, `tmb_win=${fmt(tumbleWin)}`);
  }
  if (options.freeState) {
    const fs = options.freeState;
    if (fs.last) {
      // Match the PHP protocol: the counter is one past the final played spin
      // when the game sends the end-of-feature notification.
      const completedSpins = Math.max(0, n(fs.number, 1) - 1);
      // Match the PHP reference: final-feature fields are protocol markers,
      // not a second win amount to classify as a Big Win. The accumulated
      // Free Game total remains in the existing `tw`/session summary path.
      base.push('fsmul_total=1', 'fswin_total=0.00',
        `fs_total=${completedSpins}`, 'fsres_total=0.00',
        'fs_bought=10', 'puri=0');
    } else {
      base.push('fsmul=1', `fsmax=${fs.max}`, 'fswin=0.00',
        `fs=${fs.number}`, 'fsres=0.00');
    }
  }
  if (options.scatter?.add) {
    // PHP FreeSpin::check + LogAndServer::getResult use fsmore to trigger
    // the "additional free spins awarded" notice.
    base.push(`fsmore=${n(options.scatter.add, 0)}`);
  } else if (options.scatter?.FreeSpins) {
    // A naturally triggered feature must use the same notification fields as
    // the PHP implementation; it is not the Buy Free Spins path.
    base.push('fs_bought=10', 'puri=0', 'purtr=1');
    base.push(`psym=${options.scatter.Scatter || 1}~${fmt(options.scatter.Pay || 0)}~${(options.scatter.ScatterPositions || []).join(',')}`);
  } else if (options.scatter) {
    base.push(`psym=${options.scatter.Scatter || 1}~${fmt(options.scatter.Pay || 0)}~${(options.scatter.ScatterPositions || []).join(',')}`);
  }
  return base.join('&');
}
async function loadSession(query, sessionId, userId) {
  const [rows] = await query('SELECT session_id,user_id,state_json FROM game_sessions WHERE session_id=? LIMIT 1', [sessionId]);
  if (rows.length) {
    if (Number(rows[0].user_id) !== Number(userId)) throw Object.assign(new Error('Game session does not belong to this account.'), {status: 403});
    let state = {};
    try { state = JSON.parse(rows[0].state_json || '{}'); } catch {}
    return state;
  }
  const initial = {};
  await query('INSERT INTO game_sessions(session_id,user_id,state_json) VALUES(?,?,?)', [sessionId,userId,JSON.stringify(initial)]);
  return initial;
}
async function saveSession(query, sessionId, userId, state) {
  await query('INSERT INTO game_sessions(session_id,user_id,state_json) VALUES(?,?,?) ON DUPLICATE KEY UPDATE state_json=VALUES(state_json),updated_at=CURRENT_TIMESTAMP', [sessionId,userId,JSON.stringify(state)]);
}
export function installStarlightChristmasServer(app, {pool, query, optionalAuth, asyncRoute}) {
  const ensureTables = query(`
    CREATE TABLE IF NOT EXISTS game_sessions (
      session_id VARCHAR(80) PRIMARY KEY,
      user_id BIGINT UNSIGNED NOT NULL,
      state_json LONGTEXT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_game_sessions_user (user_id),
      CONSTRAINT fk_game_session_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB
  `).catch((e) => { console.error('Could not initialize game_sessions table:', e.message); });
  query(`
    CREATE TABLE IF NOT EXISTS game_rounds (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      session_id VARCHAR(80) NOT NULL,
      user_id BIGINT UNSIGNED NOT NULL,
      action VARCHAR(32) NOT NULL,
      bet DECIMAL(18,2) NOT NULL DEFAULT 0,
      win DECIMAL(18,2) NOT NULL DEFAULT 0,
      balance_after DECIMAL(18,2) NOT NULL DEFAULT 0,
      payload_json LONGTEXT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_game_rounds_user (user_id,created_at),
      INDEX idx_game_rounds_session (session_id),
      CONSTRAINT fk_game_round_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB
  `).catch((e) => { console.error('Could not initialize game_rounds table:', e.message); });
  const DEFAULT_GAME_SETTINGS = {
    enabled: true, currency: 'USD',
    minCoinBet: 0.01, maxCoinBet: 5,
    allowedCoinBets: [0.01,0.02,0.05,0.10,0.25,0.50,1,2,5],
    lines: 20, buyFreeSpinsMultiplier: 100, maxWinMultiplier: 5000,
    targetRtp: 96.5, doubleChanceEnabled: true,
    settingsNeedFs: 4, settingsFs: 15, settingsNeedAddFs: 3, settingsAddFs: 5,
    scatterSymbol: 1, multiplierSymbol: 12, multiplierValues: '2,3,4,5,6,8,10,12,15,20,25,50,100,250,500',
    reelSetRegular: 0, reelSetDoubleChance: 2, reelSetFreeSpin: 1,
    paytable: null, reelSet0: null, reelSet1: null, reelSet2: null,
    scatterPayTable: null, maxWinEnforced: true,
    rtpMode: 'configured_target', jackpotPercent: 0
  };
  const ensureGameSettings = query(`
    CREATE TABLE IF NOT EXISTS slot_game_settings (
      game_key VARCHAR(120) PRIMARY KEY,
      settings_json JSON NOT NULL,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB
  `).then(async () => {
    await query('INSERT IGNORE INTO slot_game_settings(game_key,settings_json) VALUES(?,?)',
      ['gates-of-olympus', JSON.stringify(DEFAULT_GAME_SETTINGS)]);
  }).catch((e) => { console.error('Could not initialize slot_game_settings:', e.message); });

  const ensureJackpotTable = query(`
    CREATE TABLE IF NOT EXISTS slot_jackpot_pools (
      game_key VARCHAR(120) PRIMARY KEY,
      balance DECIMAL(18,2) NOT NULL DEFAULT 0.00,
      contributed_total DECIMAL(18,2) NOT NULL DEFAULT 0.00,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB
  `).then(() => query('INSERT IGNORE INTO slot_jackpot_pools(game_key,balance,contributed_total) VALUES(?,?,?)',['gates-of-olympus',0,0]))
    .catch((e) => { console.error('Could not initialize slot_jackpot_pools:', e.message); });
  const parseSettings = (raw) => {
    if (typeof raw === 'string') { try { return JSON.parse(raw); } catch { return {}; } }
    return raw && typeof raw === 'object' ? raw : {};
  };
  const getSettings = async (key, seed = true) => {
    await ensureGameSettings;
    const [rows] = await pool.execute('SELECT settings_json FROM slot_game_settings WHERE game_key=? LIMIT 1', [key]);
    if (!rows.length && seed) {
      const defaults = {...DEFAULT_GAME_SETTINGS};
      await pool.execute('INSERT IGNORE INTO slot_game_settings(game_key,settings_json) VALUES(?,?)',[key,JSON.stringify(defaults)]);
      return defaults;
    }
    return {...DEFAULT_GAME_SETTINGS, ...parseSettings(rows[0]?.settings_json), currency:'USD'};
  };
  const isAdminRequest = async (req, res) => {
    if (!req.auth?.id) { res.status(401).json({error:'Login required'}); return false; }
    const [admins] = await pool.execute("SELECT id FROM users WHERE id=? AND role='admin' AND status='active'", [req.auth.id]);
    if (!admins.length) { res.status(403).json({error:'Admin only'}); return false; }
    return true;
  };
  const normalizeSettings = (input, current) => {
    const next = {...current};
    const booleanKeys = ['enabled','doubleChanceEnabled','maxWinEnforced'];
    for (const key of booleanKeys) if (input[key] !== undefined) {
      if (typeof input[key] !== 'boolean') throw new Error(`Invalid ${key}`);
      next[key] = input[key];
    }
    const numericRanges = {
      minCoinBet:[0.01,10000], maxCoinBet:[0.01,1000000],
      buyFreeSpinsMultiplier:[1,10000], maxWinMultiplier:[1,1000000],
      targetRtp:[1,99.99], jackpotPercent:[0,10], lines:[1,100],
      settingsNeedFs:[3,30], settingsFs:[1,1000], settingsNeedAddFs:[3,30], settingsAddFs:[1,1000],
      scatterSymbol:[0,100], multiplierSymbol:[0,100],
      reelSetRegular:[0,8], reelSetDoubleChance:[0,8], reelSetFreeSpin:[0,8]
    };
    for (const [key,[min,max]] of Object.entries(numericRanges)) if (input[key] !== undefined) {
      const value = Number(input[key]);
      if (!Number.isFinite(value) || value < min || value > max) throw new Error(`Invalid ${key}`);
      next[key] = value;
    }
    if (input.allowedCoinBets !== undefined) {
      if (!Array.isArray(input.allowedCoinBets) || !input.allowedCoinBets.length || input.allowedCoinBets.length > 100 ||
          input.allowedCoinBets.some(v => !Number.isFinite(Number(v)) || Number(v) < 0.01 || Number(v) > 10000))
        throw new Error('Invalid allowedCoinBets');
      next.allowedCoinBets = [...new Set(input.allowedCoinBets.map(v=>Math.round(Number(v)*100)/100))].sort((a,b)=>a-b);
    }
    for (const key of ['paytable','reelSet0','reelSet1','reelSet2','scatterPayTable']) if (input[key] !== undefined) {
      if (input[key] !== null && (typeof input[key] !== 'string' || input[key].length > 20000)) throw new Error(`Invalid ${key}`);
      next[key] = input[key];
    }
    if (input.multiplierValues !== undefined) {
      if (typeof input.multiplierValues !== 'string' || input.multiplierValues.length > 500) throw new Error('Invalid multiplierValues');
      const values = input.multiplierValues.split(',').map(v => Number(v.trim()));
      if (!values.length || values.length > 100 || values.some(v => !Number.isFinite(v) || v < 1 || v > 100000)) throw new Error('multiplierValues must be comma-separated numbers between 1 and 100000');
      next.multiplierValues = [...new Set(values)].join(',');
    }
    if (input.rtpMode !== undefined) {
      if (!['configured_target','report_only'].includes(input.rtpMode)) throw new Error('Invalid rtpMode');
      next.rtpMode = input.rtpMode;
    }
    next.currency = 'USD';
    if (next.minCoinBet > next.maxCoinBet) throw new Error('minCoinBet cannot exceed maxCoinBet');
    if (!next.allowedCoinBets.some(v=>v>=next.minCoinBet&&v<=next.maxCoinBet)) throw new Error('allowedCoinBets must include at least one bet within min/max range');
    return next;
  };
  app.get('/api/game-settings/:gameKey', optionalAuth, asyncRoute(async (req,res) => {
    const key = String(req.params.gameKey || '').toLowerCase();
    if (!/^[a-z0-9][a-z0-9-]{1,119}$/.test(key)) return res.status(400).json({error:'Invalid game key'});
    const settings = await getSettings(key);
    // Do not expose raw reel strips or paytable data on public settings endpoint.
    const {paytable,reelSet0,reelSet1,reelSet2,scatterPayTable,...publicSettings} = settings;
    res.json({settings:publicSettings});
  }));
  app.get('/api/admin/games/:gameKey/settings', optionalAuth, asyncRoute(async (req,res) => {
    if (!await isAdminRequest(req,res)) return;
    const key = String(req.params.gameKey || '').toLowerCase();
    if (!/^[a-z0-9][a-z0-9-]{1,119}$/.test(key)) return res.status(400).json({error:'Invalid game key'});
    const [known] = await pool.execute('SELECT slug,title FROM games WHERE slug=? LIMIT 1',[key]);
    if (!known.length && key !== 'gates-of-olympus') return res.status(404).json({error:'Game not found in catalog'});
    const settings = await getSettings(key);
    const [meta] = await pool.execute('SELECT updated_at FROM slot_game_settings WHERE game_key=?',[key]);
    res.json({game:{slug:key,title:known[0]?.title || 'Gates of Olympus'},settings,updated_at:meta[0]?.updated_at || null});
  }));
  app.patch('/api/admin/games/:gameKey/settings', optionalAuth, asyncRoute(async (req,res) => {
    if (!await isAdminRequest(req,res)) return;
    const key = String(req.params.gameKey || '').toLowerCase();
    if (!/^[a-z0-9][a-z0-9-]{1,119}$/.test(key)) return res.status(400).json({error:'Invalid game key'});
    const [known] = await pool.execute('SELECT slug FROM games WHERE slug=? LIMIT 1',[key]);
    if (!known.length && key !== 'gates-of-olympus') return res.status(404).json({error:'Game not found in catalog'});
    const current = await getSettings(key);
    let next;
    try { next = normalizeSettings(req.body || {}, current); }
    catch(e) { return res.status(400).json({error:e.message}); }
    await pool.execute('INSERT INTO slot_game_settings(game_key,settings_json) VALUES(?,?) ON DUPLICATE KEY UPDATE settings_json=VALUES(settings_json)',
      [key,JSON.stringify(next)]);
    res.json({settings:next,message:'Game settings saved'});
  }));
  app.get('/api/game-settings/starlight-christmas', optionalAuth, asyncRoute(async (req,res) => {
    const settings = await getSettings('starlight-christmas');
    const {paytable,reelSet0,reelSet1,reelSet2,scatterPayTable,...publicSettings} = settings;
    res.json({settings:publicSettings});
  }));
  app.get('/api/admin/game-settings/starlight-christmas', optionalAuth, asyncRoute(async (req,res) => {
    if (!await isAdminRequest(req,res)) return;
    const settings = await getSettings('starlight-christmas');
    const [meta] = await pool.execute('SELECT updated_at FROM slot_game_settings WHERE game_key=?',['starlight-christmas']);
    res.json({settings,updated_at:meta[0]?.updated_at || null});
  }));
  app.patch('/api/admin/game-settings/starlight-christmas', optionalAuth, asyncRoute(async (req,res) => {
    if (!await isAdminRequest(req,res)) return;
    const current = await getSettings('starlight-christmas');
    let next;
    try { next = normalizeSettings(req.body || {}, current); }
    catch(e) { return res.status(400).json({error:e.message}); }
    await pool.execute('INSERT INTO slot_game_settings(game_key,settings_json) VALUES(?,?) ON DUPLICATE KEY UPDATE settings_json=VALUES(settings_json)',
      [JSON.stringify(next),'starlight-christmas']);
    res.json({settings:next,message:'Game settings saved'});
  }));

  app.get('/api/admin/games/:gameKey/jackpot', optionalAuth, asyncRoute(async (req,res) => {
    if (!await isAdminRequest(req,res)) return;
    const key = String(req.params.gameKey || '').toLowerCase();
    await ensureJackpotTable;
    const [rows] = await pool.execute('SELECT game_key,balance,contributed_total,updated_at FROM slot_jackpot_pools WHERE game_key=? LIMIT 1',[key]);
    res.json({jackpot:rows[0] || {game_key:key,balance:'0.00',contributed_total:'0.00',updated_at:null}});
  }));

  app.post(['/game/StarlightChristmas/server', '/game/StarlightChristmasM/server'], optionalAuth, asyncRoute(async (req, res) => {
    await ensureTables;
    if (!req.auth?.id) return response(res, ['responseEvent=error','responseType=','serverResponse=invalid login']);
    const body = parseBody(req.body);
    const action = formString(body.action);
    const sessionId = String(req.query.sessionId || body.sessionId || '').trim();
    if (!sessionId || sessionId === 'null' || sessionId.length > 80) {
      return response(res, ['responseEvent=error','responseType=','serverResponse=invalid session']);
    }
    const [users] = await pool.execute("SELECT id,status FROM users WHERE id=? LIMIT 1", [req.auth.id]);
    if (!users.length || users[0].status !== 'active') return response(res, ['responseEvent=error','responseType=','serverResponse=invalid login']);
    const [walletRows] = await pool.execute('SELECT balance,currency FROM wallets WHERE user_id=? LIMIT 1', [req.auth.id]);
    if (!walletRows.length) return response(res, ['responseEvent=error','responseType=','serverResponse=wallet unavailable']);
    let state = await loadSession(pool.execute.bind(pool), sessionId, req.auth.id).catch(async (e) => {
      if (e.status === 403) throw e;
      const [rows] = await pool.execute('SELECT state_json FROM game_sessions WHERE session_id=? LIMIT 1', [sessionId]);
      if (rows.length) return JSON.parse(rows[0].state_json || '{}');
      throw e;
    });
    const balance = n(walletRows[0].balance);
    state = new LogLib(state).getLog() || {};
    const index = n(body.index, 1);
    const counter = n(body.counter, 2);
    if (action === 'doInit') {
      await saveSession(pool.execute.bind(pool), sessionId, req.auth.id, {...state, lastAction:'doInit'});
      return res.status(200).type('text/plain; charset=utf-8').send(makeInit(balance, state));
    }
    if (action === 'settings') {
      return res.status(200).type('text/plain; charset=utf-8').send(ServerLib.settingsResponse());
    }
    if (action === 'update') {
      return response(res, ServerLib.updateResponse(fmt(balance), index, counter).split('&'));
    }
    if (action === 'doCollect') {
      const win = n(state.pendingCollect, 0);
      if (win > 0) {
        const conn = await pool.getConnection();
        try {
          await conn.beginTransaction();
          const [locked] = await conn.execute('SELECT balance FROM wallets WHERE user_id=? FOR UPDATE', [req.auth.id]);
          if (!locked.length) throw new Error('Wallet not found');
          await conn.execute('UPDATE wallets SET balance=balance+? WHERE user_id=?', [win, req.auth.id]);
          const [updated] = await conn.execute('SELECT balance FROM wallets WHERE user_id=?', [req.auth.id]);
          await conn.execute('INSERT INTO game_rounds(session_id,user_id,action,bet,win,balance_after,payload_json) VALUES(?,?,?,?,?,?,?)',
            [sessionId,req.auth.id,'doCollect',0,win,updated[0].balance,JSON.stringify({state})]);
          await conn.commit();
          // Some game clients send doCollect after a tumble response even when
          // the Free Game feature still has spins remaining. The old unconditional
          // reset erased FreeSpinNumber/FreeSpins here, so the next request became
          // a normal manual spin. Keep the feature counters until the final spin
          // has actually advanced beyond FreeSpins.
          const freeGameContinues = hasRemainingFreeSpins(state);
          state = preserveFreeSpinsAfterCollect(state);
          await saveSession(pool.execute.bind(pool),sessionId,req.auth.id,state);
          const collectResponse = [`balance=${fmt(updated[0].balance)}`,`index=${index}`,`balance_cash=${fmt(updated[0].balance)}`,'balance_bonus=0.00','na=s',`stime=${nowMs()}`,'sver=5',`counter=${counter}`];
          if (freeGameContinues) {
            collectResponse.push('fsmul=1', `fsmax=${Number(state.FreeSpins)}`, 'fswin=0.00', `fs=${Number(state.FreeSpinNumber)}`, 'fsres=0.00');
          }
          return response(res, collectResponse);
        } catch(e) { await conn.rollback(); throw e; } finally { conn.release(); }
      }
      return response(res,[`balance=${fmt(balance)}`,`index=${index}`,`balance_cash=${fmt(balance)}`,'balance_bonus=0.00','na=s',`stime=${nowMs()}`,'sver=5',`counter=${counter}`]);
    }
    if (action !== 'doSpin') return response(res, ['error=0','description=OK']);

    // Load persisted settings for every spin. These values were previously
    // referenced below without declaring gameSettings, causing a runtime error.
    await ensureGameSettings;
    const [gameSettingsRows] = await pool.execute(
      'SELECT settings_json FROM slot_game_settings WHERE game_key=? LIMIT 1',
      ['gates-of-olympus']
    );
    let storedGameSettings = gameSettingsRows[0]?.settings_json || {};
    if (typeof storedGameSettings === 'string') {
      try { storedGameSettings = JSON.parse(storedGameSettings); }
      catch { storedGameSettings = {}; }
    }
    const gameSettings = {
      minCoinBet: 0.01, maxCoinBet: 5,
      allowedCoinBets: [0.01,0.02,0.05,0.10,0.25,0.50,1,2,5],
      lines: 20, buyFreeSpinsMultiplier: 100, maxWinMultiplier: 5000,
      settingsNeedFs: n(INIT.settings_needfs,4), settingsFs: n(INIT.settings_fs,15),
      settingsNeedAddFs: n(INIT.settings_needaddfs,3), settingsAddFs: n(INIT.settings_addfs,5),
      scatterSymbol: 1, reelSetRegular: 0, reelSetDoubleChance: 2, reelSetFreeSpin: 1,
      maxWinEnforced: true, enabled: true, currency:'USD',
      ...(storedGameSettings && typeof storedGameSettings === 'object' ? storedGameSettings : {})
    };
    if (gameSettings.enabled === false) {
      return response(res, ['responseEvent=error','responseType=','serverResponse=game disabled']);
    }

    const bet = Math.round(n(body.c, n(INIT.defc, 0.01)) * 100) / 100;
    const lines = Math.max(1, n(gameSettings.lines, 20));
    const allowedBets = Array.isArray(gameSettings.allowedCoinBets) ? gameSettings.allowedCoinBets.map(v=>Math.round(Number(v)*100)/100) : [];
    if (bet < n(gameSettings.minCoinBet,0.01) || bet > n(gameSettings.maxCoinBet,5) ||
        (allowedBets.length && !allowedBets.some(v=>Math.abs(v-bet)<0.001))) {
      return response(res,['responseEvent=error','responseType=','serverResponse=invalid bet']);
    }
    if (n(body.bl,0)!==0 && gameSettings.doubleChanceEnabled===false) {
      return response(res,['responseEvent=error','responseType=','serverResponse=double chance disabled']);
    }
    const buyFs = formString(body.pur) === '0';
    const slotSettingsRuntime = new SlotSettingsLib('gates-of-olympus', req.auth.id, {settings: gameSettings});
    slotSettingsRuntime.user = {balance};
    slotSettingsRuntime.Balance = balance;
    const isFreeSpin = isFreeGameSpinActive(state);
    const isTumble = Boolean(state.State === 'FirstRespin' || state.State === 'Respin');
    // Buy-Free-Spins is a one-time action at the start of the purchased round.
    // The `pur=0` field may remain in follow-up tumble requests, but must not
    // re-place scatters or restart the purchase logic during the cascade.
    const isBuyFsStart = buyFs && !isTumble && !isFreeSpin;
    const doubleChanceFactor = n(body.bl,0)!==0 ? 1.25 : 1;
    const stake = isFreeSpin || isTumble ? 0 : Math.round((bet * lines * doubleChanceFactor * (buyFs ? n(gameSettings.buyFreeSpinsMultiplier,100) : 1) + Number.EPSILON) * 100) / 100;
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const [lockedWallet] = await conn.execute('SELECT balance FROM wallets WHERE user_id=? FOR UPDATE', [req.auth.id]);
      if (!lockedWallet.length) throw new Error('Wallet not found');
      let currentBalance = n(lockedWallet[0].balance);
      if (currentBalance < stake) {
        await conn.rollback();
        return response(res,['responseEvent=error','responseType=','serverResponse=not enough money']);
      }
      if (stake > 0) {
        await conn.execute('UPDATE wallets SET balance=balance-? WHERE user_id=?', [stake, req.auth.id]);
        currentBalance = Math.round((currentBalance - stake + Number.EPSILON) * 100) / 100;
      }
      // PHP Jackpots::toJP contributes bet * percent/100 to the jackpot pool.
      // No jackpot-trigger/payout rule exists in the supplied PHP backend, so this
      // implements the source-defined accumulation only and never invents a trigger.
      if (stake > 0 && n(gameSettings.jackpotPercent, 0) > 0) {
        await ensureJackpotTable;
        const contribution = Math.round((stake * n(gameSettings.jackpotPercent, 0) / 100 + Number.EPSILON) * 100) / 100;
        if (contribution > 0) {
          await conn.execute(
            'INSERT INTO slot_jackpot_pools(game_key,balance,contributed_total) VALUES(?,?,?) ON DUPLICATE KEY UPDATE balance=balance+VALUES(balance),contributed_total=contributed_total+VALUES(contributed_total)',
            ['gates-of-olympus', contribution, contribution]
          );
        }
      }
      const reelSet = (isFreeGameSpinActive(state) && n(state.FreeSpinNumber,0) > 1)
        ? n(gameSettings.reelSetFreeSpin,1)
        : (n(body.bl, 0) !== 0 ? n(gameSettings.reelSetDoubleChance,2) : n(gameSettings.reelSetRegular,0));
      const slot = spinArea(reelSet, isTumble ? state : null, gameSettings);
      if (isBuyFsStart) {
        BuyFreeSpinsStateLib.prepare(slot, {
          ...gameSettings,
          scatterSymbol: n(gameSettings.scatterSymbol, 1),
          settingsNeedFs: n(gameSettings.settingsNeedFs, n(INIT.settings_needfs, 4)),
        });
      }
      // A Buy Free Spins trigger screen (and any tumble chain started by that
      // screen) must not contain, animate, collect, or calculate multiplier
      // symbols. Sanitize the actual slot payload before wins/tumble state are
      // calculated, not just the final display response.
      const suppressBuyFsMultipliers = isBuyFsStart || state.SuppressBuyFsMultipliers === true;
      if (suppressBuyFsMultipliers) {
        const multiplierSymbol = n(gameSettings.multiplierSymbol, 12);
        const scatterSymbol = n(gameSettings.scatterSymbol, 1);
        const replacement = (slot.SlotArea || []).find((value) =>
          Number(value) !== multiplierSymbol && Number(value) !== scatterSymbol
        ) ?? 3;
        const stripMultipliers = (values) => Array.isArray(values)
          ? values.map((value) => Number(value) === multiplierSymbol ? replacement : value)
          : values;
        slot.SlotArea = stripMultipliers(slot.SlotArea);
        slot.SymbolsAfter = stripMultipliers(slot.SymbolsAfter);
        slot.SymbolsBelow = stripMultipliers(slot.SymbolsBelow);
      }
      const win = getWins(slot.SlotArea,bet,gameSettings);
      const freeSpinRound = isFreeGameSpinActive(state);
      // Base-game multipliers belong to the current tumble chain only.
      // Never reuse multiplier values from a completed previous paid spin.
      const multiplierHistory = (freeSpinRound || isTumble) ? state : {};
      // A purchased Free Spins feature is represented by its forced-scatter trigger screen.
      // Do not activate/display multiplier symbols on that purchase-trigger screen only;
      // regular spins, natural scatter triggers, and all Free Spins rounds keep existing behavior.
      const currentMultipliers = suppressBuyFsMultipliers
        ? []
        : findMultipliers(slot.SlotArea, multiplierHistory, freeSpinRound, gameSettings);
      const priorPrgSum = n(state.PrgSum, 0);
      // The PHP implementation adds PrgSum only once, when the tumble chain
      // reaches LastRespin. Do not add the same visible multiplier on every tumble.
      const currentPrg = currentMultipliers.reduce((sum, item) => sum + n(item.Multiplier), 0);
      // Keep multipliers already collected during this Free Game tumble chain.
      // A lightning orb may disappear from the visible board on the next tumble;
      // that must not reset the accumulated total to zero. A new multiplier on
      // the same reel replaces that reel's current value rather than double-counting it.
      const accumulatedByReel = new Map(
        ((freeSpinRound || isTumble) && Array.isArray(state.Multipliers) ? state.Multipliers : [])
          .map((item) => [Number(item.Reel), item])
      );
      for (const item of currentMultipliers) {
        accumulatedByReel.set(Number(item.Reel), item);
      }
      const accumulatedMultipliers = [...accumulatedByReel.values()];
      const maxPayout = Math.round((bet * lines * n(gameSettings.maxWinMultiplier,5000) + Number.EPSILON)*100)/100;
      if (gameSettings.maxWinEnforced !== false && win.TotalWin > maxPayout) {
        const ratio = maxPayout / win.TotalWin;
        win.WinLines = win.WinLines.map(line => ({...line, Pay:Math.round(line.Pay*ratio*100)/100}));
        win.TotalWin = Math.round(win.WinLines.reduce((sum,line)=>sum+line.Pay,0)*100)/100;
      }
      // Always inspect scatters, including screens that also start a tumble.
      // The PHP client can keep the scatter symbols visible while the winning
      // symbols tumble away, so feature triggers must survive the whole chain.
      let scatter = scatterInfo(slot.SlotArea, bet, isBuyFsStart ? {} : state, gameSettings);
      let newState = {...state, SlotArea:slot.SlotArea, SymbolsAfter:slot.SymbolsAfter, SymbolsBelow:slot.SymbolsBelow, Index:index, Counter:counter, Bet:bet, Lines:lines, DoubleChance:n(body.bl,0), ReelSet:reelSet};
      if (suppressBuyFsMultipliers && win.TotalWin > 0) newState.SuppressBuyFsMultipliers = true;
      else delete newState.SuppressBuyFsMultipliers;
      if (freeSpinRound || (!freeSpinRound && (isTumble || win.TotalWin > 0))) {
        newState.Multipliers = accumulatedMultipliers;
        // Free Game commits PrgSum at chain end. Base game keeps only the
        // multiplier symbols collected in this paid spin's tumble chain.
        newState.PrgSum = freeSpinRound ? priorPrgSum : 0;
      } else if (!freeSpinRound) {
        newState.Multipliers = [];
        newState.PrgSum = 0;
      }
      const priorTumbleWin = isTumble ? n(state.TumbleWin, n(state.TotalWin,0)) : 0;
      const priorGameTotal = freeSpinRound ? n(state.TotalWin,0) : 0;
      const previousTotal = isTumble ? priorTumbleWin : 0;
      let triggeredFeature = null;
      if (win.TotalWin > 0) {
        const isFirst = !isTumble;
        const chainTotal = Math.round((priorTumbleWin + win.TotalWin + Number.EPSILON)*100)/100;
        const totalWin = Math.round(((freeSpinRound ? priorGameTotal : 0) + chainTotal + Number.EPSILON)*100)/100;
        const pendingCollect = Math.round(((freeSpinRound ? n(state.pendingCollect,0) : 0) + win.TotalWin + Number.EPSILON)*100)/100;
        newState = {...newState, State:isFirst?'FirstRespin':'Respin', Respin:isFirst?0:n(state.Respin,0)+1, RespinWin:Math.round((n(state.RespinWin,0)+win.TotalWin)*100)/100, TumbleWin:chainTotal, TotalWin:totalWin, Win:win.TotalWin, WinLines:win.WinLines, pendingCollect};
        // A scatter trigger may coexist with an ordinary symbol win. Queue it
        // until the tumble chain is complete; otherwise the next response loses
        // the feature notice and the client waits forever for Free Game.
        if (scatter && (scatter.FreeSpins || scatter.add)) {
          newState.PendingFeatureTrigger = {
            ...scatter,
            source: isBuyFsStart ? 'buyFreeSpins' : (scatter.add ? 'freeSpinRetrigger' : 'scatter')
          };
        } else if (state.PendingFeatureTrigger) {
          newState.PendingFeatureTrigger = state.PendingFeatureTrigger;
        }
        if (isFreeGameSpinActive(state)) {
          // PHP LogAndServer increments the free-spin counter on a fresh spin/LastRespin,
          // but keeps it unchanged while the same tumble chain continues.
          // PHP increments the free-spin number only after a completed spin
          // (State=Spin/LastRespin). A winning tumble chain keeps the same number.
          newState.FreeSpinNumber = n(state.FreeSpinNumber, 0);
          newState.FreeSpins = n(state.FreeSpins,15);
          newState.FreeState = newState.FreeSpinNumber <= newState.FreeSpins ? 'FreeSpin':'LastFreeSpin';
        }
      } else if (isTumble) {
        newState = {...newState, State:'LastRespin', TumbleWin:priorTumbleWin, TotalWin:Math.round(((freeSpinRound ? priorGameTotal : 0) + priorTumbleWin + Number.EPSILON)*100)/100, Win:0, WinLines:[], Respin:n(state.Respin,0)+1, RespinWin:n(state.RespinWin,0), pendingCollect:Math.round(((freeSpinRound ? n(state.pendingCollect,0) : 0) + Number.EPSILON)*100)/100};
        if (isFreeGameSpinActive(state)) {
          newState.FreeSpinNumber = n(state.FreeSpinNumber,0) + 1;
          newState.FreeSpins = n(state.FreeSpins,15);
          newState.FreeState = newState.FreeSpinNumber <= newState.FreeSpins ? 'FreeSpin' : 'LastFreeSpin';
        }
      } else if (scatter?.FreeSpins) {
        const accumulated = freeSpinRound ? n(state.TotalWin,0) : 0;
        const pending = freeSpinRound ? n(state.pendingCollect,0) : 0;
        newState = {...newState, State:'Spin', TumbleWin:0, FreeState:'FirstFreeSpin', FreeSpins:scatter.FreeSpins, FreeSpinNumber:1, FSPay:scatter.Pay, Scatter:1, ScatterPositions:scatter.ScatterPositions, TotalWin:Math.round((accumulated+scatter.Pay)*100)/100, Win:0, WinLines:[], pendingCollect:Math.round((pending+scatter.Pay)*100)/100};
      } else if (scatter?.add) {
        newState = {...newState, State:'Spin', TumbleWin:0, FreeSpins:n(state.FreeSpins,15)+scatter.add, FreeSpinNumber:n(state.FreeSpinNumber,0)+1, FreeState:'AddFreeSpin', TotalWin:n(state.TotalWin,0), Win:0, WinLines:[], pendingCollect:n(state.pendingCollect,0)};
      } else {
        newState = {...newState, State:'Spin', TumbleWin:0, TotalWin:freeSpinRound ? n(state.TotalWin,0) : 0, Win:0, WinLines:[], Respin:0, RespinWin:0, pendingCollect:freeSpinRound ? n(state.pendingCollect,0) : 0};
        if (freeSpinRound) {
          newState.FreeSpinNumber = n(state.FreeSpinNumber,0)+1;
          newState.FreeSpins = n(state.FreeSpins,15);
          newState.FreeState = newState.FreeSpinNumber <= newState.FreeSpins ? 'FreeSpin':'LastFreeSpin';
          newState.pendingCollect = n(state.pendingCollect,0);
          newState.TotalWin = n(state.TotalWin,0);
        }
      }
      // Resolve a queued scatter feature only after the tumble chain has
      // emitted its final (zero-win) response. This covers both purchased
      // Free Spins (4 scatters) and retriggers inside Free Spins (3 scatters).
      if (shouldResolveQueuedFeature({
        stateName: state.State,
        isTumble,
        winTotal: win.TotalWin,
        hasPendingFeature: Boolean(state.PendingFeatureTrigger)
      })) {
        const queued = state.PendingFeatureTrigger;
        if (queued.FreeSpins) {
          const priorTotal = n(newState.TotalWin, 0);
          const priorPending = n(newState.pendingCollect, 0);
          const scatterPay = n(queued.Pay, 0);
          newState = {
            ...newState,
            State: 'Spin',
            FreeState: 'FirstFreeSpin',
            FreeSpins: n(queued.FreeSpins, n(gameSettings.settingsFs, 15)),
            FreeSpinNumber: 1,
            FSPay: scatterPay,
            Scatter: n(queued.Scatter, n(gameSettings.scatterSymbol, 1)),
            ScatterPositions: queued.ScatterPositions || [],
            TotalWin: Math.round((priorTotal + scatterPay + Number.EPSILON) * 100) / 100,
            pendingCollect: Math.round((priorPending + scatterPay + Number.EPSILON) * 100) / 100,
            Win: 0,
            WinLines: [],
            PendingFeatureTrigger: null
          };
          triggeredFeature = queued;
        } else if (queued.add) {
          // The current Free Spin has just completed in the LastRespin branch.
          // Add spins to the feature total without restarting its counter.
          newState = {
            ...newState,
            State: 'Spin',
            FreeSpins: n(newState.FreeSpins, n(state.FreeSpins, 15)) + n(queued.add, 0),
            FreeSpinNumber: Math.max(1, n(newState.FreeSpinNumber, n(state.FreeSpinNumber, 1))),
            FreeState: 'AddFreeSpin',
            TotalWin: n(newState.TotalWin, n(state.TotalWin, 0)),
            pendingCollect: n(newState.pendingCollect, n(state.pendingCollect, 0)),
            Win: 0,
            WinLines: [],
            PendingFeatureTrigger: null
          };
          triggeredFeature = queued;
        }
      } else if (!isTumble && win.TotalWin === 0 && scatter && (scatter.FreeSpins || scatter.add)) {
        // Clear stale queued state if a prior request was interrupted, and
        // make the feature transition explicit on a no-tumble result.
        triggeredFeature = scatter;
        newState.PendingFeatureTrigger = null;
      }
      // PHP applies the accumulated Free Spins multipliers when the tumble chain ends.
      // Keep the unmultiplied tumble total in tmb_res; apply the sum of multiplier values once.
      const tumbleEnded = isTumble && win.TotalWin === 0;
      if (tumbleEnded) delete newState.SuppressBuyFsMultipliers;
      let multiplierWin = 0;
      let maxWinReached = false;
      if (freeSpinRound && tumbleEnded) {
        // Match PHP LogAndServer: settle the whole tumble chain once, then
        // enforce the 5000x total-bet cap against the complete Free Game total,
        // not merely against this tumble's raw payout.
        const baseTumbleWin = Math.max(0, priorTumbleWin);
        const finalPrgSum = priorPrgSum + currentPrg;
        const settled = settleFreeGameTumble({
          sessionTotal:n(state.TotalWin, priorTumbleWin),
          tumbleWin:baseTumbleWin,
          multiplier:finalPrgSum,
          maxPayout,
          enforceMax:gameSettings.maxWinEnforced !== false
        });
        multiplierWin = settled.multiplierWin;
        const previousPending = n(state.pendingCollect, previousTotal);
        newState.TotalWin = settled.totalWin;
        newState.pendingCollect = Math.round((Math.max(0, previousPending - baseTumbleWin) + settled.paidTumbleWin + Number.EPSILON) * 100) / 100;
        if (finalPrgSum > 0) newState.MultWin = settled.paidTumbleWin;
        maxWinReached = settled.maxWinReached;
        // Commit only once at chain end, so subsequent free spins don't reset
        // or double-count the same multiplier values.
        newState.PrgSum = finalPrgSum;
      } else if (!freeSpinRound && tumbleEnded) {
        // Base-game multiplier values are fixed when first collected and are
        // summed once at the end of the tumble chain, never rerolled per tumble.
        const baseTumbleWin = Math.max(0, priorTumbleWin);
        const chainMultiplier = accumulatedMultipliers.reduce(
          (sum, item) => sum + Math.max(0, n(item.Multiplier, 0)), 0
        );
        const settled = settleFreeGameTumble({
          sessionTotal: 0,
          tumbleWin: baseTumbleWin,
          multiplier: chainMultiplier,
          maxPayout,
          enforceMax: gameSettings.maxWinEnforced !== false
        });
        multiplierWin = settled.multiplierWin;
        newState.TotalWin = settled.totalWin;
        newState.TumbleWin = settled.paidTumbleWin;
        newState.pendingCollect = settled.paidTumbleWin;
        newState.MultWin = chainMultiplier > 0 ? settled.paidTumbleWin : 0;
        newState.Multipliers = accumulatedMultipliers;
        newState.PrgSum = chainMultiplier;
      }
      // Reaching the feature cap ends the Free Game immediately after the
      // current tumble chain settles. Preserve the final total and use the
      // existing end-of-feature response markers; do not start another spin.
      if (freeSpinRound && gameSettings.maxWinEnforced !== false &&
          n(newState.TotalWin, 0) >= maxPayout - 0.000001 &&
          (newState.State === 'Spin' || newState.State === 'LastRespin')) {
        maxWinReached = true;
      }
      if (maxWinReached && freeSpinRound) {
        newState.FreeSpins = Math.max(1, n(newState.FreeSpins, n(state.FreeSpins, 15)));
        newState.FreeSpinNumber = newState.FreeSpins + 1;
        newState.FreeState = 'LastFreeSpin';
        newState.PendingFeatureTrigger = null;
        triggeredFeature = null;
      }
      const classifiedState = SpinDispenserLib.getSpin(slot.SlotArea, index, counter, bet, lines, n(body.bl,0), reelSet, win, state, req.auth, scatter);
      const phpStateName = SpinStateLib.initial(state, win);
      const normalizedResult = SpinResultLib.normalize({slotArea:slot, win, log:newState, server:[]});
      // Host DB owns wallet/house-bank policy; compatibility check uses a non-restrictive bank to avoid changing payout behavior.
      const permission = WinPermissionLib.winCheck(scatter, buyFs ? '0' : null, {bonus:Number.MAX_SAFE_INTEGER, slots:Number.MAX_SAFE_INTEGER}, newState, win.TotalWin, currentMultipliers, state);
      newState.PhpCompat = {classifiedState: classifiedState?.State || 'Spin', state: phpStateName, normalizedWin: normalizedResult.win, configuredBet: slotSettingsRuntime.AllBet, permission: permission === false ? 'denied-by-php-policy' : 'allowed'};
      if (isFreeGameSpinActive(newState)) {
        const fsState = FreeSpinStateLib.advance({...newState, FreeSpinNumber: Math.max(0, Number(newState.FreeSpinNumber) - 1)}, true);
        newState.PhpCompat.freeSpinState = fsState.FreeState;
      }
      const freeState = newState.FreeSpinNumber ? {
        number:newState.FreeSpinNumber,
        max:newState.FreeSpins||15,
        last:newState.FreeState==='LastFreeSpin',
        totalWin:n(newState.TotalWin,0)
      } : null;
      // A completed tumble chain ends the current spin, not the entire Free
      // Games feature. Keep the client in the feature while free spins remain.
      // A base-game tumble that triggers Free Games must still close its base
      // round so the client can transition into the Free Games notice.
      const featureFinished = newState.FreeState === 'LastFreeSpin' &&
        n(newState.FreeSpinNumber,0) > n(newState.FreeSpins,0);
      const queuedFeatureNotice = Boolean(triggeredFeature && (triggeredFeature.FreeSpins || triggeredFeature.add));
      const shouldCloseCurrentRound = shouldCloseSpinRound({
        featureFinished,
        queuedFeatureNotice,
        freeSpinRound,
        stateName: newState.State,
        isTumble,
        winTotal: win.TotalWin
      });
      // Keep a defensive display filter for the Buy Free Spins trigger screen.
      // The actual slot and tumble payload have already been sanitized above, so
      // this is only a final guard against legacy response formatting.
      const responseSlot = isBuyFsStart
        ? {
            ...slot,
            SlotArea: slot.SlotArea.map((symbol) =>
              Number(symbol) === n(gameSettings.multiplierSymbol, 12)
                ? (slot.SlotArea.find((candidate) => {
                    const value = Number(candidate);
                    return value !== n(gameSettings.multiplierSymbol, 12) && value !== n(gameSettings.scatterSymbol, 1);
                  }) ?? 3)
                : symbol
            )
          }
        : slot;
      let responseText = buildSpinResponse(currentBalance,{...body,index,counter},state,responseSlot,win,newState,{
        reelSet, na:shouldCloseCurrentRound?'c':'s', firstTumble:win.TotalWin>0&&!isTumble,
        tumble:win.TotalWin>0&&isTumble,lastTumble:win.TotalWin===0&&isTumble,freeState,scatter:maxWinReached ? null : (triggeredFeature || (win.TotalWin===0 ? scatter : null))
      });
      const multiplierResponse = serializeMultipliers(currentMultipliers);
      // Match the PHP LogAndServer protocol: accv reflects PrgSum only.
      // Do not derive it from state.Multipliers, which may contain multiplier
      // entries retained from earlier tumble screens and would inflate the
      // visual TOTAL MULTIPLIER meter before the chain is committed.
      const responseAccv = n(newState.PrgSum, 0);
      if (currentMultipliers.length) {
        // Match PHP LogAndServer: replace the base prg=1 field with the sum
        // of multipliers visible on this response, never append a duplicate prg.
        const visiblePrg = currentMultipliers.reduce((sum, item) => sum + n(item.Multiplier, 0), 0);
        responseText = responseText.replace(/(?:^|&)prg=1(?=&|$)/, (match) =>
          match.startsWith('&') ? `&prg=${visiblePrg}` : `prg=${visiblePrg}`
        );
      }
      if (multiplierResponse.length) {
        responseText += '&' + multiplierResponse.join('&');
      }
      if (freeSpinRound || responseAccv > 0) {
        responseText = responseText.replace(/(?:^|&)accv=[^&]*/, (match) =>
          match.startsWith('&') ? `&accv=${responseAccv}` : `accv=${responseAccv}`
        );
      }
      if (multiplierWin > 0) {
        responseText = responseText.replace(/(?:^|&)fswin=0\.00/g, (m) => m.startsWith('&') ? `&fswin=${fmt(multiplierWin)}` : `fswin=${fmt(multiplierWin)}`);
        responseText = responseText.replace(/(?:^|&)fsres=0\.00/g, (m) => m.startsWith('&') ? `&fsres=${fmt(multiplierWin)}` : `fsres=${fmt(multiplierWin)}`);
      }
      await conn.execute('INSERT INTO game_rounds(session_id,user_id,action,bet,win,balance_after,payload_json) VALUES(?,?,?,?,?,?,?)',
        [sessionId,req.auth.id,'doSpin',stake,win.TotalWin,currentBalance,JSON.stringify({request:body,slot,win,state:newState})]);
      await conn.commit();
      await saveSession(pool.execute.bind(pool),sessionId,req.auth.id,newState);
      return res.status(200).type('text/plain; charset=utf-8').send(responseText);
    } catch(e) {
      await conn.rollback();
      throw e;
    } finally { conn.release(); }
  }));

  // Legacy mobile/desktop HTML5 clients send telemetry to the provider stats URL.
  // Keep this endpoint local to avoid hard-coded https://localhost connection failures.
  app.post([
    '/games/StarlightChristmasM/gs2c/stats.do',
    '/games/StarlightChristmas/gs2c/stats.do'
  ], (req, res) => {
    res.status(200).type('text/plain; charset=utf-8').send('OK');
  });
}
