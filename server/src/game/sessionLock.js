import { createHash } from 'node:crypto';

/**
 * Serialize all game protocol actions for one session across Node.js processes.
 * MySQL named locks are connection-scoped, so the dedicated connection is kept
 * until the response finishes. A short wait avoids consuming a connection for
 * long periods when the client sends duplicate requests concurrently.
 */
export function createGameSessionLock(pool, { waitSeconds = 2, resolveSessionId } = {}) {
  return async function gameSessionLock(req, res, next) {
    const raw = typeof resolveSessionId === 'function'
      ? resolveSessionId(req)
      : (req.query?.sessionId ?? req.body?.sessionId);
    const sessionId = typeof raw === 'string' ? raw.trim() : '';
    if (!sessionId || sessionId.toLowerCase() === 'null' || sessionId.length > 80) return next();

    const lockName = `zyvalle:game:${createHash('sha256').update(sessionId).digest('hex').slice(0, 48)}`;
    let conn;
    let acquired = false;
    let released = false;

    const release = async () => {
      if (released) return;
      released = true;
      if (!conn) return;
      try {
        if (acquired) await conn.execute('SELECT RELEASE_LOCK(?)', [lockName]);
      } catch {
        // Closing/releasing the connection also releases MySQL named locks.
      } finally {
        conn.release();
      }
    };

    try {
      conn = await pool.getConnection();
      const [rows] = await conn.execute('SELECT GET_LOCK(?, ?) AS acquired', [lockName, waitSeconds]);
      acquired = Number(rows?.[0]?.acquired) === 1;
      if (!acquired) {
        conn.release();
        conn = null;
        return res.status(409).type('text/plain; charset=utf-8')
          .send('responseEvent=error&responseType=&serverResponse=game session busy');
      }
      res.once('finish', release);
      res.once('close', release);
      return next();
    } catch (error) {
      if (conn) {
        try { conn.release(); } catch {}
      }
      return next(error);
    }
  };
}
