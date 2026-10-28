import mysql from 'mysql2/promise';
import 'dotenv/config';

const connectionConfig = {
  host: process.env.DATABASE_HOST || '127.0.0.1',
  port: Number(process.env.DATABASE_PORT || 3306),
  user: process.env.DATABASE_USER || 'root',
  password: process.env.DATABASE_PASSWORD || '',
  database: process.env.DATABASE_NAME || 'zyvalle_bet',
  waitForConnections: true,
  decimalNumbers: true,
  timezone: 'Z',
  charset: 'utf8mb4',
};

export const pool = mysql.createPool({ ...connectionConfig, connectionLimit: 10 });

// MySQL GET_LOCK holds a connection for the lifetime of a game request.
// Keep lock connections separate so concurrent games cannot exhaust the main
// pool while waiting for their own wallet/session transactions.
export const gameLockPool = mysql.createPool({ ...connectionConfig, connectionLimit: 5 });

export async function query(sql, params = []) {
  const [rows] = await pool.execute(sql, params);
  return rows;
}
