import mysql from 'mysql2/promise';
import 'dotenv/config';
export const pool = mysql.createPool({host:process.env.DATABASE_HOST||'127.0.0.1',port:Number(process.env.DATABASE_PORT||3306),user:process.env.DATABASE_USER||'root',password:process.env.DATABASE_PASSWORD||'',database:process.env.DATABASE_NAME||'zyvalle_bet',waitForConnections:true,connectionLimit:10,decimalNumbers:true,timezone:'Z',charset:'utf8mb4'});
export async function query(sql, params=[]){const [rows]=await pool.execute(sql,params);return rows;}
