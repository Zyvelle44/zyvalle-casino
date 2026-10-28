import { createGameSessionLock } from './sessionLock.js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomInt } from 'node:crypto';

const here = path.dirname(fileURLToPath(import.meta.url));
const REELS_FILE = path.join(here, 'aztecGemsDeluxeLib', 'reels.txt');
const PAYTABLE = Object.freeze({
  2: [0, 0, 0, 25, 0, 0],
  3: [0, 0, 0, 20, 0, 0],
  4: [0, 0, 0, 15, 0, 0],
  5: [0, 0, 0, 12, 0, 0],
  6: [0, 0, 0, 10, 0, 0],
  7: [0, 0, 0, 8, 0, 0],
  8: [0, 0, 0, 5, 0, 0],
  9: [0, 0, 0, 2, 0, 0]
});
const SYMBOL_GAME = Object.freeze([2, 3, 4, 5, 6, 7, 8, 9]);
const BETS = Object.freeze([0.01, 0.02, 0.05, 0.10, 0.25, 0.50, 1, 2, 5]);
const MULTIPLIER_WEIGHTS = Object.freeze([1,1,1,1,2,2,2,2,3,3,3,3,5,5,5,10,10,15,15]);
const MULTIPLIERS = Object.freeze([1, 2, 3, 5, 10, 15]);
const LINES = Object.freeze([[2,2,2], [1,1,1], [3,3,3], [1,2,3], [3,2,1]]);
const POSITION_INDEX = Object.freeze([[0,3,6], [1,4,7], [2,5,8]]);
const cents = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;
const num = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};
const money = (value) => cents(value).toFixed(2);
const now = () => Date.now();
const randomIndex = (length) => randomInt(Math.max(1, length));
const choose = (items) => items[randomIndex(items.length)];
const formBody = (req) => {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') return Object.fromEntries(new URLSearchParams(req.body));
  return {};
};
const asReels = (value) => Array.isArray(value) && value.length === 3 &&
  value.every((r) => r && Array.isArray(r.rows) && r.rows.length >= 4 && Number.isFinite(Number(r.previous)))
  ? value.map((r) => ({ previous: Number(r.previous), rows: r.rows.slice(0, 4).map(Number), start: num(r.start) }))
  : null;

function readReels() {
  const strips = {};
  for (const line of fs.readFileSync(REELS_FILE, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*(reelStrip[1-3])\s*=\s*(.*?)\s*$/);
    if (match) strips[match[1]] = match[2].split(',').map((part) => Number(part.trim())).filter(Number.isFinite);
  }
  for (let index = 1; index <= 3; index++) {
    if (!strips[`reelStrip${index}`]?.length) throw new Error(`AztecGemsDeluxe reelStrip${index} is empty`);
  }
  return [strips.reelStrip1, strips.reelStrip2, strips.reelStrip3];
}
const REEL_STRIPS = readReels();

function makeReels() {
  return REEL_STRIPS.map((strip) => {
    // PHP GameReel::GetReelStrips() chooses 0..count(strip)-3 inclusive.
    const start = randomInt(Math.max(1, strip.length - 2));
    const at = (offset) => strip[(start + offset + strip.length) % strip.length];
    return { previous: at(-1), rows: [at(0), at(1), at(2), at(3)], start };
  });
}
function visibleSymbols(reels) {
  // The PHP response sends row-major order: reel1/reel2/reel3 for each row.
  return [0,1,2].flatMap((row) => reels.map((reel) => reel.rows[row]));
}
function chooseMultiplier() {
  // Weighted multiplier strip copied from Server.php ($mplReel).
  return choose(MULTIPLIER_WEIGHTS);
}
function makeSpin(reels, coinBet) {
  // Mirrors Server.php's five-line loop: it tests every configured symbol,
  // keeps the highest matching paytable result for each line, and increments
  // the protocol line counter whenever a better symbol result replaces it.
  const multiplier = chooseMultiplier();
  const lineFields = [];
  let totalWin = 0;
  let protocolLineNumber = 0;

  for (let lineIndex = 0; lineIndex < LINES.length; lineIndex++) {
    const line = LINES[lineIndex];
    const symbols = line.map((row, reelIndex) => reels[reelIndex].rows[row - 1]);
    let lineWin = 0;
    let winningField = '';

    for (const symbol of SYMBOL_GAME) {
      if (!symbols.every((current) => current === symbol || current === 2)) continue;
      const candidate = cents(num(PAYTABLE[symbol]?.[3]) * coinBet * multiplier);
      if (lineWin < candidate) {
        lineWin = candidate;
        const positions = line.map((row, reelIndex) => POSITION_INDEX[reelIndex][row - 1]);
        winningField = `l${protocolLineNumber}=${lineIndex}~${money(lineWin)}~${positions.join('~')}`;
        protocolLineNumber++;
      }
    }

    if (lineWin > 0 && winningField) {
      lineFields.push(winningField);
      totalWin = cents(totalWin + lineWin);
    }
  }

  return { multiplier, multiplierIndex: MULTIPLIERS.indexOf(multiplier), totalWin: cents(totalWin), lineFields, reels };
}
function errorPayload(res, type, message, status = 400) {
  return res.status(status).type('text/plain; charset=utf-8').send(JSON.stringify({
    responseEvent: 'error', responseType: type || '', serverResponse: message
  }));
}
function responseText(res, fields) {
  return res.status(200).type('text/plain; charset=utf-8').send(fields.filter((value) => value !== undefined && value !== null).join('&'));
}
function initResponse(balance, state) {
  const reels = asReels(state.lastReels) || makeReels();
  const bet = BETS[0];
  return [
    'def_s=7,4,9,7,4,9,7,4,9',
    `balance=${money(balance)}`,
    'cfgs=1',
    `reel1=${REEL_STRIPS[1].join(',')}`,
    'ver=2',
    `reel0=${REEL_STRIPS[0].join(',')}`,
    'index=1',
    `balance_cash=${money(balance)}`,
    'def_sb=4,4,4',
    'def_sa=8,8,8',
    `reel2=${REEL_STRIPS[2].join(',')}`,
    'balance_bonus=0.00',
    'na=s',
    'aw=3',
    'scatters=1~0,0,0~0,0,0~1,1,1',
    'gmb=0,0,0',
    'rt=d',
    'base_aw=m~1;m~2;m~3;m~5;m~10;m~15',
    `stime=${now()}`,
    'sa=8,8,8',
    'sb=4,4,4',
    `sc=${BETS.join(',')}`,
    `defc=${BETS[0]}`,
    'def_aw=3',
    'sh=3',
    'wilds=2~25,0,0~1,1,1',
    'bonuses=0',
    'fsbonus=',
    `c=${bet}`,
    'sver=5',
    'counter=2',
    'paytable=0,0,0;0,0,0;0,0,0;20,0,0;15,0,0;12,0,0;10,0,0;8,0,0;5,0,0;2,0,0',
    'l=5',
    'rtp=96.52',
    `s=${visibleSymbols(reels).join(',')}`,
    'awt=6rl'
  ].join('&');
}
function updateResponse(balance, body) {
  return [
    `balance=${money(balance)}`,
    `index=${num(body.index, 1)}`,
    `balance_cash=${money(balance)}`,
    'balance_bonus=0.00',
    'na=s',
    `stime=${now()}`,
    'sver=5',
    `counter=${num(body.counter, 2)}`
  ].join('&');
}
function spinResponse(balance, body, spin) {
  const reels = spin.reels;
  return [
    'com=5,5',
    `tw=${money(spin.totalWin)}`,
    `balance=${money(balance)}`,
    'index=3',
    `balance_cash=${money(balance)}`,
    'balance_bonus=0.00',
    'na=c',
    `aw=${spin.multiplierIndex}`,
    ...spin.lineFields,
    `stime=${now()}`,
    `sa=${reels.map((reel) => reel.rows[3]).join(',')}`,
    `sb=${reels.map((reel) => reel.previous).join(',')}`,
    'sh=3',
    // Server.php hardcodes c=0.01 and counter=6 in its spin response.
    'c=0.01',
    'sver=5',
    'counter=6',
    'l=5',
    `s=${visibleSymbols(reels).join(',')}`,
    `w=${money(spin.totalWin)}`,
    `gwm=${spin.multiplier}`,
    'awt=6rl'
  ].join('&');
}
function cardRank(rank) {
  return ({11:'J',12:'Q',13:'K',14:'A'})[rank] || String(rank);
}
function randomCardString(rank) {
  return `${cardRank(rank)}${choose(['C','S','D','H'])}`;
}
function dealerCardResponse(state) {
  const dealerCard = randomInt(2, 15);
  state.dealerCard = dealerCard;
  return JSON.stringify({ responseEvent: 'gamble5DealerCard', serverResponse: { dealerCard: randomCardString(dealerCard) } });
}
function gambleCardsResponse(state, body, balanceBefore) {
  const dealerCard = num(state.dealerCard);
  const totalWin = cents(Math.max(0, num(state.totalWin, 0)));
  const choice = Math.trunc(num(body.gambleChoice, 2)) - 2;
  if (dealerCard < 2 || dealerCard > 14) return { error: 'invalid gamble state' };
  if (!(totalWin > 0)) return { error: 'no win available to gamble' };
  if (choice < 0 || choice > 3) return { error: 'invalid gamble choice' };

  // PHP uses rand(1, $WinGamble); the referenced project does not include
  // the Laravel game's "rezerv" setting, so the default chance is 1 in 2.
  const winsChance = randomInt(2) === 0;
  const userCard = winsChance ? randomInt(dealerCard, 15) : randomInt(2, dealerCard + 1);
  let gambleWin = 0;
  let nextTotalWin = totalWin;
  let gambleState = 'draw';
  if (dealerCard < userCard) {
    gambleWin = totalWin;
    nextTotalWin = cents(totalWin * 2);
    gambleState = 'win';
  } else if (userCard < dealerCard) {
    gambleWin = -totalWin;
    nextTotalWin = 0;
    gambleState = 'lose';
  } else {
    gambleWin = totalWin;
    gambleState = 'draw';
  }
  // PHP has already credited the spin win. Gambling then adds, removes, or
  // leaves that credited amount according to gambleWin.
  const cards = [randomInt(2,15), randomInt(2,15), randomInt(2,15), randomInt(2,15)];
  cards[choice] = userCard;
  state.totalWin = nextTotalWin;
  state.dealerCard = null;
  const afterBalance = cents(balanceBefore + (gambleWin !== totalWin || gambleState === 'win' ? gambleWin : 0));
  return {
    balance: afterBalance,
    gambleWin,
    response: JSON.stringify({
      responseEvent: 'gambleResult',
      deb: randomCardString(userCard),
      serverResponse: {
        dealerCard, playerCards: cards.map(randomCardString), gambleState,
        totalWin: nextTotalWin, afterBalance, Balance: balanceBefore
      }
    })
  };
}
function colourGambleResponse(state, body, balanceBefore) {
  const totalWin = cents(Math.max(0, num(state.totalWin, 0)));
  if (!(totalWin > 0)) return { error: 'no win available to gamble' };
  const choice = String(body.gambleChoice || '').toLowerCase();
  if (!['red','black'].includes(choice)) return { error: 'invalid gamble choice' };
  const win = randomInt(2) === 0;
  const gambleWin = win ? totalWin : -totalWin;
  const nextTotalWin = win ? cents(totalWin * 2) : 0;
  const dealerCard = win
    ? choose(choice === 'red' ? ['D','H'] : ['C','S'])
    : choose(choice === 'red' ? ['C','S'] : ['D','H']);
  state.totalWin = nextTotalWin;
  const afterBalance = cents(balanceBefore + gambleWin);
  return {
    balance: afterBalance,
    gambleWin,
    response: JSON.stringify({
      responseEvent: 'gambleResult',
      serverResponse: { dealerCard, gambleState: win ? 'win' : 'lose', totalWin: nextTotalWin, afterBalance, Balance: balanceBefore }
    })
  };
}

async function ensureGameTables(pool) {
  await pool.execute(`
    CREATE TABLE IF NOT EXISTS game_sessions (
      session_id VARCHAR(80) PRIMARY KEY,
      user_id BIGINT UNSIGNED NOT NULL,
      state_json LONGTEXT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_game_sessions_user (user_id),
      CONSTRAINT fk_game_session_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB
  `);
  await pool.execute(`
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
  `);
}
async function lockSession(conn, sessionId, userId) {
  await conn.execute(
    'INSERT IGNORE INTO game_sessions(session_id,user_id,state_json) VALUES(?,?,?)',
    [sessionId, userId, JSON.stringify({ totalWin: 0, dealerCard: null })]
  );
  const [rows] = await conn.execute('SELECT user_id,state_json FROM game_sessions WHERE session_id=? FOR UPDATE', [sessionId]);
  if (!rows.length) throw new Error('Could not create game session');
  if (Number(rows[0].user_id) !== Number(userId)) {
    const error = new Error('Game session does not belong to this account.');
    error.status = 403;
    throw error;
  }
  let state = {};
  try { state = JSON.parse(rows[0].state_json || '{}'); } catch { state = {}; }
  if (!state || typeof state !== 'object' || Array.isArray(state)) state = {};
  state.totalWin = cents(Math.max(0, num(state.totalWin, 0)));
  if (!Number.isInteger(Number(state.dealerCard)) || Number(state.dealerCard) < 2 || Number(state.dealerCard) > 14) {
    state.dealerCard = null;
  } else {
    state.dealerCard = Number(state.dealerCard);
  }
  return state;
}
async function saveSession(conn, sessionId, userId, state) {
  await conn.execute(
    'UPDATE game_sessions SET state_json=? WHERE session_id=? AND user_id=?',
    [JSON.stringify(state), sessionId, userId]
  );
}
async function logRound(conn, sessionId, userId, action, bet, win, balance, payload) {
  await conn.execute(
    'INSERT INTO game_rounds(session_id,user_id,action,bet,win,balance_after,payload_json) VALUES(?,?,?,?,?,?,?)',
    [sessionId, userId, action, money(bet), money(win), money(balance), JSON.stringify(payload || {})]
  );
}

export function installAztecGemsDeluxeServer(app, { pool, gameLockPool, optionalAuth, asyncRoute }) {
  const sessionLock = createGameSessionLock(gameLockPool || pool, {
    // This engine intentionally derives a stable session when the HTML5 client
    // sends sessionId=null; match the exact session ID used by the handler.
    resolveSessionId: (req) => {
      const requested = String(req.query?.sessionId ?? req.body?.sessionId ?? '').trim();
      if (requested && requested.toLowerCase() !== 'null') return requested;
      return req.auth?.id ? `aztec-gems-deluxe-user-${req.auth.id}` : '';
    },
  });
  let tablesReady;
  const ensureTablesOnce = () => {
    if (!tablesReady) tablesReady = ensureGameTables(pool).catch((error) => {
      tablesReady = null;
      throw error;
    });
    return tablesReady;
  };

  app.post(['/game/AztecGemsDeluxe/server', '/game/AztecGemsDeluxeM/server'], optionalAuth, sessionLock, asyncRoute(async (req, res) => {
    const body = formBody(req);
    const action = String(body.action || body.slotEvent || '').trim();
    if (!action) return res.status(200).type('text/plain; charset=utf-8').send('');
    const userId = Number(req.auth?.id);
    if (!Number.isSafeInteger(userId) || userId < 1) return errorPayload(res, action, 'invalid login', 401);

    // The supplied PHP Server.php does not require a client sessionId:
    // it binds game state to the authenticated user. The HTML5 client in this
    // project can call the endpoint with sessionId=null, so use a stable,
    // game-scoped server session for that case instead of rejecting doInit.
    const requestedSessionId = String(req.query.sessionId || body.sessionId || '').trim();
    const sessionId = (!requestedSessionId || requestedSessionId.toLowerCase() === 'null')
      ? `aztec-gems-deluxe-user-${userId}`
      : requestedSessionId;
    if (sessionId.length > 80) return errorPayload(res, action, 'invalid session', 400);

    await ensureTablesOnce();
    const [users] = await pool.execute("SELECT id,status FROM users WHERE id=? LIMIT 1", [userId]);
    if (!users.length || users[0].status !== 'active') return errorPayload(res, action, 'invalid login', 401);

    if (action === 'freespin') {
      // The supplied PHP SlotSettings.php explicitly sets slotBonus=false and
      // Server.php sets $scatter='NONE'; free spins are not enabled in this reference.
      return errorPayload(res, action, 'invalid bonus state', 400);
    }

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const state = await lockSession(conn, sessionId, userId);
      const [walletRows] = await conn.execute('SELECT balance,currency FROM wallets WHERE user_id=? FOR UPDATE', [userId]);
      if (!walletRows.length) {
        await conn.rollback();
        return errorPayload(res, action, 'wallet unavailable', 400);
      }
      let balance = cents(walletRows[0].balance);
      const initialBalance = balance;

      if (action === 'doInit') {
        if (!asReels(state.lastReels)) state.lastReels = makeReels();
        await saveSession(conn, sessionId, userId, state);
        await conn.commit();
        return responseText(res, [initResponse(balance, state)]);
      }

      if (action === 'update') {
        // Server.php returns this legacy JSON error envelope for `update`.
        await conn.commit();
        return res.status(200).type('text/plain; charset=utf-8').send(JSON.stringify({
          responseEvent: 'error', responseType: action, serverResponse: money(balance)
        }));
      }
      if (action === 'reloadBalance') {
        await conn.commit();
        return responseText(res, [updateResponse(balance, body)]);
      }

      if (action === 'doCollect') {
        // PHP doCollect is display-only: the spin win is credited during doSpin.
        await logRound(conn, sessionId, userId, action, 0, 0, balance, { totalWin: num(state.totalWin) });
        await saveSession(conn, sessionId, userId, state);
        await conn.commit();
        return responseText(res, [
          `balance=${money(balance)}`, 'index=5', `balance_cash=${money(balance)}`,
          'balance_bonus=0.00', 'na=s', `stime=${now()}`, 'sver=5', 'counter=10'
        ]);
      }

      if (action === 'gamble5GetDealerCard') {
        const response = dealerCardResponse(state);
        await saveSession(conn, sessionId, userId, state);
        await conn.commit();
        return res.status(200).type('text/plain; charset=utf-8').send(response);
      }

      if (action === 'gamble5GetUserCards' || action === 'slotGamble') {
        const result = action === 'gamble5GetUserCards'
          ? gambleCardsResponse(state, body, balance)
          : colourGambleResponse(state, body, balance);
        if (result.error) {
          await conn.rollback();
          return errorPayload(res, action, result.error, 400);
        }
        balance = cents(result.balance);
        await conn.execute('UPDATE wallets SET balance=? WHERE user_id=?', [money(balance), userId]);
        await saveSession(conn, sessionId, userId, state);
        await logRound(conn, sessionId, userId, action, 0, result.gambleWin, balance, { request: body, response: result.response, state });
        await conn.commit();
        return res.status(200).type('text/plain; charset=utf-8').send(result.response);
      }

      if (action !== 'doSpin') {
        await conn.commit();
        return responseText(res, ['error=0&description=OK']);
      }

      const rawCoinBet = body.c ?? body.slotBet;
      const coinBet = num(rawCoinBet, 0);
      const stake = cents(coinBet * 5);
      if (rawCoinBet === undefined || rawCoinBet === null || String(rawCoinBet).trim() === '' ||
          !Number.isFinite(Number(rawCoinBet)) || !(coinBet > 0 && coinBet <= 5) || !(stake > 0)) {
        await conn.rollback();
        return errorPayload(res, action, 'invalid bet state', 400);
      }
      if (balance + 1e-9 < stake) {
        await conn.rollback();
        return errorPayload(res, action, 'invalid balance', 400);
      }

      balance = cents(balance - stake);
      const reels = makeReels();
      const spin = makeSpin(reels, coinBet);
      balance = cents(balance + spin.totalWin);
      await conn.execute('UPDATE wallets SET balance=? WHERE user_id=?', [money(balance), userId]);
      state.totalWin = spin.totalWin;
      state.dealerCard = null;
      state.lastBet = coinBet;
      state.lastReels = reels;
      state.lastAction = 'doSpin';
      state.lastSpinAt = now();
      state.counter = 6;
      await saveSession(conn, sessionId, userId, state);
      await logRound(conn, sessionId, userId, action, stake, spin.totalWin, balance, {
        request: body,
        spin: { multiplier: spin.multiplier, lineFields: spin.lineFields, totalWin: spin.totalWin, reels },
        balanceBefore: initialBalance,
        balanceAfter: balance
      });
      await conn.commit();
      return responseText(res, [spinResponse(balance, body, spin)]);
    } catch (error) {
      try { await conn.rollback(); } catch {}
      if (error.status === 403) return errorPayload(res, action, error.message, 403);
      throw error;
    } finally {
      conn.release();
    }
  }));
}
