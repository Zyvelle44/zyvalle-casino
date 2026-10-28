import 'dotenv/config';
import { randomBytes, randomUUID } from 'node:crypto';
import {assertRuntimeConfig} from './config.js';
import express from 'express'; import multer from 'multer'; import path from 'node:path'; import fs from 'node:fs'; import cors from 'cors'; import helmet from 'helmet'; import cookieParser from 'cookie-parser'; import rateLimit from 'express-rate-limit'; import bcrypt from 'bcryptjs'; import {z} from 'zod';
import {pool,query} from './db.js'; import {cookieOptions,signUser,requireAuth,requireAdmin,optionalAuth,csrfProtection} from './security.js';
import {installGatesOfOlympusServer} from './game/gatesOfOlympus.js';
import {installStarlightPrincessServer} from './game/starlightPrincess.js';
import {installStarlightChristmasServer} from './game/starlightChristmas.js';
import {installAztecGemsDeluxeServer} from './game/aztecGemsDeluxe.js';
assertRuntimeConfig();
const app=express();
const bannerDir=path.resolve('uploads','banners'); fs.mkdirSync(bannerDir,{recursive:true});
const bannerUpload=multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 10, fieldSize: 16 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = new Set(['image/jpeg', 'image/png', 'image/webp']);
    if (!allowed.has(file.mimetype)) return cb(new Error('Only JPG, PNG, or WEBP images are allowed.'));
    cb(null, true);
  },
});
function detectImage(buffer) {
  if (!Buffer.isBuffer(buffer)) return null;
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return { ext: '.jpg', mime: 'image/jpeg' };
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return { ext: '.png', mime: 'image/png' };
  if (buffer.length >= 12 && buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return { ext: '.webp', mime: 'image/webp' };
  return null;
}
function validBannerLink(value) {
  if (!value) return true;
  if (/[\\\\\u0000-\u001f\u007f]/.test(value) || value.startsWith('//')) return false;
  if (value.startsWith('/')) return true;
  try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) && Boolean(url.hostname); } catch { return false; }
}
app.use('/uploads/banners',express.static(bannerDir,{fallthrough:false,maxAge:'1d'}));
app.disable('x-powered-by');
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({
  origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'X-CSRF-Token', 'Idempotency-Key'],
}));
app.use(express.json({ limit: '32kb', strict: true }));
app.use(express.urlencoded({ extended: false, limit: '32kb', parameterLimit: 100 }));
app.use(cookieParser());

const apiLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 300, standardHeaders: true, legacyHeaders: false });
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 12, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many authentication attempts. Try again later.' } });
const adminLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 120, standardHeaders: true, legacyHeaders: false });
const gameLimiter = rateLimit({ windowMs: 60 * 1000, limit: 120, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many game requests. Please slow down.' } });
app.use('/api', apiLimiter);
app.use('/api/auth', authLimiter);
app.use('/api/admin', adminLimiter);
app.use('/game', gameLimiter);

app.get('/api/auth/csrf', (req, res) => {
  const token = randomBytes(32).toString('base64url');
  res.cookie('zy_csrf', token, {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 2 * 60 * 60 * 1000,
  });
  res.set('Cache-Control', 'no-store');
  res.json({ csrfToken: token });
});
app.use('/api', csrfProtection);

const asyncRoute=fn=>(req,res,next)=>Promise.resolve(fn(req,res,next)).catch(next);
const moneySchema = z.number().finite().min(1).max(100000).refine(
  value => Math.abs(value * 100 - Math.round(value * 100)) < 1e-7,
  'Amount must have no more than two decimal places.',
);
function amountToCents(value) { return Math.round(value * 100); }
function centsToAmount(cents) { return (cents / 100).toFixed(2); }
function makeReference(prefix) { return `${prefix}-${randomUUID().replaceAll('-', '').toUpperCase()}`; }
function getIdempotencyKey(req) {
  const key = String(req.get('Idempotency-Key') || '').trim();
  return /^[A-Za-z0-9._:-]{16,100}$/.test(key) ? key : null;
}
async function findIdempotentTransaction(conn, userId, key, type, amountCents) {
  if (!key) return null;
  const [rows] = await conn.execute(
    'SELECT id,reference,type,amount,status FROM transactions WHERE user_id=? AND idempotency_key=? LIMIT 1',
    [userId, key],
  );
  if (!rows.length) return null;
  if (rows[0].type !== type || amountToCents(Number(rows[0].amount)) !== amountCents) {
    const error = new Error('Idempotency key was already used for a different request.');
    error.statusCode = 409;
    throw error;
  }
  return rows[0];
}
async function insertLedger(conn, { userId, transactionId = null, entryType, amount, balanceAfter, actorUserId = null, idempotencyKey = null }) {
  await conn.execute(
    `INSERT INTO wallet_ledger
      (user_id, transaction_id, entry_type, amount, balance_after, actor_user_id, idempotency_key)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [userId, transactionId, entryType, amount, balanceAfter, actorUserId, idempotencyKey],
  );
}

async function getUser(id){const rows=await query('SELECT id,name,email,role,status,created_at FROM users WHERE id=? LIMIT 1',[id]);return rows[0]||null;}
let depositMethodsReady;
async function ensureDepositMethods(){
  if(!depositMethodsReady){
    depositMethodsReady=(async()=>{
      await query(`CREATE TABLE IF NOT EXISTS deposit_methods (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        method_key VARCHAR(40) NOT NULL UNIQUE,
        name VARCHAR(100) NOT NULL,
        enabled TINYINT(1) NOT NULL DEFAULT 0,
        instructions TEXT NULL,
        payment_details TEXT NULL,
        sort_order INT NOT NULL DEFAULT 0,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB`);
      await query("INSERT IGNORE INTO deposit_methods(method_key,name,enabled,instructions,payment_details,sort_order) VALUES ('crypto_manual','Crypto Payment (Manual)',0,'Send the exact USD amount to the wallet address shown below. Include your transaction hash in the deposit note. Admin approval is required.','',1),('bank_transfer_manual','Bank Transfer (Manual)',0,'Transfer the exact USD amount to the account shown below. Add your transfer reference in the deposit note. Admin approval is required.','',2)");
    })();
  }
  try{await depositMethodsReady;}catch(error){depositMethodsReady=null;throw error;}
}
let catalogGameSettingsReady;
async function ensureCatalogGameSettings(){
  if(!catalogGameSettingsReady){
    catalogGameSettingsReady=(async()=>{
      await query(`CREATE TABLE IF NOT EXISTS slot_game_settings (
        game_key VARCHAR(120) PRIMARY KEY,
        settings_json JSON NOT NULL,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB`);
      await query(`INSERT IGNORE INTO slot_game_settings(game_key,settings_json)
        SELECT g.slug, JSON_OBJECT(
          'enabled', TRUE, 'currency', 'USD', 'minCoinBet', 0.01, 'maxCoinBet', 5,
          'allowedCoinBets', JSON_ARRAY(0.01,0.02,0.05,0.10,0.25,0.50,1,2,5),
          'lines', 20, 'buyFreeSpinsMultiplier', 100, 'maxWinMultiplier', 5000,
          'targetRtp', 96.5, 'doubleChanceEnabled', TRUE, 'maxWinEnforced', TRUE,
          'rtpMode', 'configured_target',
          'engineSupported', IF(
            REGEXP_REPLACE(REGEXP_REPLACE(LOWER(g.title),'[^a-z0-9]',''),'tm$','') IN ('gatesofolympus','starlightprincess','starlightchristmas','aztecgemsdeluxe')
            AND LOWER(g.slug) NOT REGEXP '(1000|xmas|dice|superscatter|pachi|megaways)', TRUE, FALSE)
        ) FROM games g`);
      // Keep the capability flag in sync with exact database titles while preserving every other saved setting.
      await query(`UPDATE slot_game_settings s JOIN games g ON g.slug=s.game_key
        SET s.settings_json=JSON_SET(s.settings_json,'$.engineSupported', IF(
          REGEXP_REPLACE(REGEXP_REPLACE(LOWER(g.title),'[^a-z0-9]',''),'tm$','') IN ('gatesofolympus','starlightprincess','starlightchristmas','aztecgemsdeluxe')
          AND LOWER(g.slug) NOT REGEXP '(1000|xmas|dice|superscatter|pachi|megaways)', TRUE, FALSE))`);
    })();
  }
  try{await catalogGameSettingsReady;}catch(error){catalogGameSettingsReady=null;throw error;}
}
let gameHistoryReady;
async function ensureGameHistory(){
  if(!gameHistoryReady){
    gameHistoryReady=(async()=>{
      await query(`CREATE TABLE IF NOT EXISTS game_play_history (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        user_id BIGINT UNSIGNED NOT NULL,
        game_id BIGINT UNSIGNED NULL,
        session_id VARCHAR(80) NOT NULL,
        slug VARCHAR(120) NOT NULL,
        title VARCHAR(160) NOT NULL,
        provider VARCHAR(100) NOT NULL DEFAULT 'Unknown provider',
        started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_game_play_user_started(user_id,started_at),
        INDEX idx_game_play_session(session_id),
        CONSTRAINT fk_game_play_user FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB`);
      await query(`CREATE TABLE IF NOT EXISTS game_rounds (
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
      ) ENGINE=InnoDB`);
    })();
  }
  try{await gameHistoryReady;}catch(error){gameHistoryReady=null;throw error;}
}
app.get('/api/health',asyncRoute(async(req,res)=>{await query('SELECT 1');res.json({status:'ok',service:'Zyvalle Bet API'});}));
app.get('/api/banners',asyncRoute(async(req,res)=>{const rows=await query("SELECT id,image_url,link_url,sort_order FROM banners WHERE active=1 ORDER BY sort_order ASC,id DESC");res.json({banners:rows});}));
app.get('/api/admin/banners',requireAuth,requireAdmin,asyncRoute(async(req,res)=>{res.json({banners:await query('SELECT id,image_url,link_url,active,sort_order,created_at FROM banners ORDER BY sort_order ASC,id DESC')});}));
app.post('/api/admin/banners', requireAuth, requireAdmin, bannerUpload.single('image'), asyncRoute(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Choose a JPG, PNG, or WEBP image up to 5 MB.' });
  const link = String(req.body.link_url || '').trim();
  if (!validBannerLink(link)) return res.status(400).json({ error: 'Destination URL is invalid.' });
  const image = detectImage(req.file.buffer);
  if (!image || image.mime !== req.file.mimetype) return res.status(400).json({ error: 'The uploaded file is not a valid JPG, PNG, or WEBP image.' });
  const filename = `${randomBytes(24).toString('hex')}${image.ext}`;
  const target = path.join(bannerDir, filename);
  await fs.promises.writeFile(target, req.file.buffer, { flag: 'wx', mode: 0o640 });
  try {
    const publicOrigin = (process.env.PUBLIC_API_ORIGIN || `http://localhost:${Number(process.env.PORT || 4000)}`).replace(/\/$/, '');
    const imageUrl = `${publicOrigin}/uploads/banners/${filename}`;
    const result = await query('INSERT INTO banners(image_url,link_url,active,sort_order) VALUES(?,?,1,0)', [imageUrl, link || null]);
    res.status(201).json({ id: result.insertId, image_url: imageUrl, link_url: link || null, message: 'Banner uploaded successfully.' });
  } catch (error) {
    await fs.promises.unlink(target).catch(() => {});
    throw error;
  }
}));
app.patch('/api/admin/banners/:id', requireAuth, requireAdmin, asyncRoute(async (req, res) => {
  const v = z.object({ active: z.boolean().optional(), link_url: z.string().max(500).nullable().optional(), sort_order: z.number().int().min(0).max(9999).optional() }).strict().safeParse(req.body);
  const id = Number(req.params.id);
  if (!v.success || !Object.keys(v.data || {}).length || !Number.isSafeInteger(id) || id < 1) return res.status(400).json({ error: 'Banner changes are invalid.' });
  if (Object.hasOwn(v.data, 'link_url') && v.data.link_url !== null && !validBannerLink(v.data.link_url.trim())) return res.status(400).json({ error: 'Destination URL is invalid.' });
  const keys = Object.keys(v.data);
  const result = await query(`UPDATE banners SET ${keys.map(k => `${k}=?`).join(',')} WHERE id=?`, [...keys.map(k => k === 'active' ? (v.data[k] ? 1 : 0) : v.data[k]), id]);
  if (!result.affectedRows) return res.status(404).json({ error: 'Banner not found.' });
  res.json({ message: 'Banner updated.' });
}));
app.delete('/api/admin/banners/:id',requireAuth,requireAdmin,asyncRoute(async(req,res)=>{const rows=await query('SELECT image_url FROM banners WHERE id=?',[Number(req.params.id)]);if(!rows.length)return res.status(404).json({error:'Banner not found.'});await query('DELETE FROM banners WHERE id=?',[Number(req.params.id)]);const filename=path.basename(new URL(rows[0].image_url).pathname);const target=path.join(bannerDir,filename);if(target.startsWith(bannerDir)&&fs.existsSync(target))fs.unlinkSync(target);res.json({message:'Banner deleted.'});}));
app.get('/api/games',asyncRoute(async(req,res)=>{await ensureCatalogGameSettings();const category=String(req.query.category||'').slice(0,40);const provider=String(req.query.provider||'').slice(0,100);const q=String(req.query.q||'').slice(0,80);const featured=req.query.featured==='1';const where=["g.status='active'","g.title LIKE ?","(p.active=1 OR p.name IS NULL)"];const params=[`%${q}%`];if(category&&category!=='Lobby'){where.push('g.category=?');params.push(category);}if(provider&&provider!=='All Providers'){where.push('g.provider=?');params.push(provider);}if(featured)where.push('g.featured=1');const limit=featured?500:2000;const rows=await query(`SELECT g.id,g.slug,g.title,g.provider,g.category,g.image_path,g.status,g.featured,g.is_new,CAST(JSON_UNQUOTE(COALESCE(JSON_EXTRACT(s.settings_json,'$.targetRtp'),JSON_EXTRACT(s.settings_json,'$.rtp'),JSON_EXTRACT(s.settings_json,'$.rtpPercent'))) AS DECIMAL(5,2)) AS rtp_percent,CAST(JSON_UNQUOTE(JSON_EXTRACT(s.settings_json,'$.enabled')) AS UNSIGNED) AS settings_enabled,CAST(JSON_UNQUOTE(JSON_EXTRACT(s.settings_json,'$.engineSupported')) AS UNSIGNED) AS engine_supported FROM games g LEFT JOIN providers p ON p.name=g.provider LEFT JOIN slot_game_settings s ON s.game_key=g.slug WHERE ${where.join(' AND ')} ORDER BY g.featured DESC,g.title ASC LIMIT ${limit}`,params);const seen=new Set();const uniqueRows=rows.filter(g=>{const key=[String(g.title||'').trim().toLocaleLowerCase().replace(/[^a-z0-9]+/g,''),String(g.provider||'').trim().toLocaleLowerCase().replace(/[^a-z0-9]+/g,'')].join('::');if(!key||seen.has(key))return false;seen.add(key);return true;});res.json({games:uniqueRows});}));
app.get('/api/providers',asyncRoute(async(req,res)=>{const rows=await query("SELECT p.name AS provider,p.logo_path,p.active,COUNT(CASE WHEN g.status='active' THEN 1 END) AS game_count FROM providers p JOIN games g ON g.provider=p.name AND g.status='active' WHERE p.active=1 GROUP BY p.name,p.logo_path,p.active HAVING COUNT(g.id)>0 ORDER BY p.name ASC");res.json({providers:rows});}));
app.get('/api/admin/games',requireAuth,requireAdmin,asyncRoute(async(req,res)=>{await ensureCatalogGameSettings();res.json({games:await query(`SELECT g.id,g.slug,g.title,g.provider,g.category,g.image_path,g.status,g.featured,g.is_new,CAST(JSON_UNQUOTE(COALESCE(JSON_EXTRACT(s.settings_json,'$.targetRtp'),JSON_EXTRACT(s.settings_json,'$.rtp'),JSON_EXTRACT(s.settings_json,'$.rtpPercent'))) AS DECIMAL(5,2)) AS rtp_percent,CAST(JSON_UNQUOTE(JSON_EXTRACT(s.settings_json,'$.enabled')) AS UNSIGNED) AS settings_enabled,CAST(JSON_UNQUOTE(JSON_EXTRACT(s.settings_json,'$.engineSupported')) AS UNSIGNED) AS engine_supported FROM games g LEFT JOIN slot_game_settings s ON s.game_key=g.slug ORDER BY g.title ASC LIMIT 2000`)});}));
app.get('/api/admin/providers',requireAuth,requireAdmin,asyncRoute(async(req,res)=>{res.json({providers:await query("SELECT p.name AS provider,p.logo_path,p.active,COUNT(g.id) AS game_count FROM providers p LEFT JOIN games g ON g.provider=p.name GROUP BY p.name,p.logo_path,p.active ORDER BY p.name ASC")});}));
app.patch('/api/admin/providers/:name',requireAuth,requireAdmin,asyncRoute(async(req,res)=>{const v=z.object({active:z.boolean()}).strict().safeParse(req.body);const name=String(req.params.name||'').trim();if(!v.success||!name||name.length>100)return res.status(400).json({error:'Invalid provider status.'});const result=await query('UPDATE providers SET active=? WHERE name=?',[v.data.active?1:0,name]);if(!result.affectedRows)return res.status(404).json({error:'Provider not found.'});res.json({message:'Provider status updated.'});}));
app.patch('/api/admin/games/:id',requireAuth,requireAdmin,asyncRoute(async(req,res)=>{const schema=z.object({title:z.string().trim().min(1).max(160).optional(),provider:z.string().trim().min(1).max(100).optional(),category:z.enum(['Slots','Table Games','Game Shows']).optional(),image_path:z.string().trim().max(255).optional(),status:z.enum(['active','hidden']).optional(),featured:z.boolean().optional(),is_new:z.boolean().optional()}).strict();const v=schema.safeParse(req.body);if(!v.success||Object.keys(v.data||{}).length===0)return res.status(400).json({error:'Game changes are invalid.'});const id=Number(req.params.id);const conn=await pool.getConnection();try{await conn.beginTransaction();const [found]=await conn.execute('SELECT id FROM games WHERE id=? FOR UPDATE',[id]);if(!found.length){await conn.rollback();return res.status(404).json({error:'Game not found.'});}const fields=Object.keys(v.data);const values=fields.map(k=>k==='featured'?(v.data[k]?1:0):v.data[k]);await conn.execute(`UPDATE games SET ${fields.map(k=>`${k}=?`).join(',')} WHERE id=?`,[...values,id]);if(v.data.provider)await conn.execute('INSERT IGNORE INTO providers(name,active) VALUES(?,1)',[v.data.provider]);await conn.commit();res.json({message:'Game updated successfully.'});}catch(e){await conn.rollback();throw e;}finally{conn.release();}}));
app.post('/api/auth/register',asyncRoute(async(req,res)=>{const schema=z.object({name:z.string().trim().min(2).max(60),email:z.string().trim().email().max(190),password:z.string().min(10).max(72)});const v=schema.safeParse(req.body);if(!v.success)return res.status(400).json({error:'A name, valid email, and password of at least 10 characters are required.'});const email=v.data.email.toLowerCase();const exists=await query('SELECT id FROM users WHERE email=?',[email]);if(exists.length)return res.status(409).json({error:'Email is already registered.'});const hash=await bcrypt.hash(v.data.password,12);const conn=await pool.getConnection();try{await conn.beginTransaction();const [u]=await conn.execute(`INSERT INTO users(name,email,password_hash,role,status) VALUES(?,?,?,'user','active')`,[v.data.name,email,hash]);await conn.execute(
  'INSERT INTO wallets(user_id, balance, currency) VALUES(?, 0, ?)',
  [u.insertId, 'USD']
);await conn.commit();const user=await getUser(u.insertId);res.cookie('zy_session',signUser(user),cookieOptions).status(201).json({user});}catch(e){await conn.rollback();throw e;}finally{conn.release();}}));
app.post('/api/auth/login',asyncRoute(async(req,res)=>{const v=z.object({email:z.string().email().max(190),password:z.string().min(1).max(72)}).safeParse(req.body);if(!v.success)return res.status(400).json({error:'Invalid email or password.'});const rows=await query('SELECT id,password_hash,role,status FROM users WHERE email=? LIMIT 1',[v.data.email.toLowerCase()]);const u=rows[0];if(!u||u.status!=='active'||!(await bcrypt.compare(v.data.password,u.password_hash)))return res.status(401).json({error:'Incorrect email or password.'});const user=await getUser(u.id);res.cookie('zy_session',signUser(user),cookieOptions).json({user});}));
app.post('/api/auth/logout',(req,res)=>res.clearCookie('zy_session',{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/'}).json({ok:true}));
app.get('/api/auth/me',optionalAuth,asyncRoute(async(req,res)=>{if(!req.auth)return res.json({authenticated:false,user:null,wallet:{balance:0,currency:'USD'}});const user=await getUser(req.auth.id);if(!user||user.status!=='active'){res.clearCookie('zy_session',{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/'});return res.json({authenticated:false,user:null,wallet:{balance:0,currency:'USD'}});}const rows=await query('SELECT balance,currency FROM wallets WHERE user_id=?',[user.id]);res.json({authenticated:true,user,wallet:rows[0]||{balance:0,currency:'USD'}});}));
app.get('/api/deposit-methods',asyncRoute(async(req,res)=>{await ensureDepositMethods();const methods=await query('SELECT id,method_key,name,enabled,instructions,payment_details,sort_order FROM deposit_methods WHERE enabled=1 ORDER BY sort_order,id');res.json({methods:methods.map(m=>({...m,enabled:!!Number(m.enabled)}))});}));
app.get('/api/admin/deposit-methods',requireAuth,requireAdmin,asyncRoute(async(req,res)=>{await ensureDepositMethods();const methods=await query('SELECT id,method_key,name,enabled,instructions,payment_details,sort_order,updated_at FROM deposit_methods ORDER BY sort_order,id');res.json({methods:methods.map(m=>({...m,enabled:!!Number(m.enabled)}))});}));
app.patch('/api/admin/deposit-methods/:id',requireAuth,requireAdmin,asyncRoute(async(req,res)=>{await ensureDepositMethods();const schema=z.object({enabled:z.boolean().optional(),instructions:z.string().max(3000).optional(),payment_details:z.string().max(3000).optional(),name:z.string().trim().min(2).max(100).optional(),sort_order:z.number().int().min(0).max(9999).optional()}).strict();const v=schema.safeParse(req.body);if(!v.success||!Object.keys(v.data||{}).length)return res.status(400).json({error:'Deposit method settings are invalid.'});const fields=Object.keys(v.data);const values=fields.map(k=>typeof v.data[k]==='boolean'?(v.data[k]?1:0):v.data[k]);const result=await query(`UPDATE deposit_methods SET ${fields.map(k=>`${k}=?`).join(',')} WHERE id=?`,[...values,Number(req.params.id)]);if(!result.affectedRows)return res.status(404).json({error:'Deposit method not found.'});res.json({message:'Deposit method settings saved.'});}));
app.get('/api/wallet',requireAuth,asyncRoute(async(req,res)=>{const rows=await query('SELECT balance,currency,updated_at FROM wallets WHERE user_id=?',[req.auth.id]);res.json({wallet:rows[0]||{balance:0,currency:'USD'}});}));
app.get('/api/transactions',requireAuth,asyncRoute(async(req,res)=>{const rows=await query('SELECT id,reference,type,amount,status,note,created_at FROM transactions WHERE user_id=? ORDER BY id DESC LIMIT 100',[req.auth.id]);res.json({transactions:rows});}));
app.get('/api/wallet/ledger',requireAuth,asyncRoute(async(req,res)=>{const rows=await query('SELECT id,transaction_id,entry_type,amount,balance_after,created_at FROM wallet_ledger WHERE user_id=? ORDER BY id DESC LIMIT 100',[req.auth.id]);res.set('Cache-Control','no-store');res.json({entries:rows});}));
app.post('/api/wallet/deposit-request',requireAuth,asyncRoute(async(req,res)=>{
  await ensureDepositMethods();
  const v=z.object({amount:moneySchema,method_id:z.number().int().positive(),note:z.string().max(240).optional()}).strict().safeParse(req.body);
  if(!v.success)return res.status(400).json({error:'Enter a deposit amount between $1.00 and $100,000.00 with no more than two decimal places.'});
  const amountCents=amountToCents(v.data.amount);
  const amount=centsToAmount(amountCents);
  const key=getIdempotencyKey(req);
  const conn=await pool.getConnection();
  try{
    await conn.beginTransaction();
    if(key){
      const prior=await findIdempotentTransaction(conn,req.auth.id,key,'deposit',amountCents);
      if(prior){await conn.commit();return res.status(200).json({message:'Deposit request already submitted.',reference:prior.reference,status:prior.status,idempotent:true});}
    }
    const [methods]=await conn.execute('SELECT id,name,enabled FROM deposit_methods WHERE id=? LIMIT 1 FOR UPDATE',[v.data.method_id]);
    const method=methods[0];
    if(!method||!Number(method.enabled)){await conn.rollback();return res.status(400).json({error:'This deposit method is currently disabled. Please choose another method.'});}
    const ref=makeReference('DEP');
    const note=[`Method: ${method.name}`,String(v.data.note||'').trim()].filter(Boolean).join(' | ').slice(0,240);
    await conn.execute("INSERT INTO transactions(user_id,reference,type,amount,status,note,idempotency_key) VALUES(?,?,'deposit',?,'pending',?,?)",[req.auth.id,ref,amount,note||'Manual deposit awaiting admin verification',key]);
    await conn.commit();
    res.status(201).json({message:'Deposit request submitted. Your USD wallet will be credited after admin approval.',reference:ref,status:'pending'});
  }catch(e){await conn.rollback();if(e.code==='ER_DUP_ENTRY'&&key){const [prior]=await pool.execute('SELECT reference,status,type,amount FROM transactions WHERE user_id=? AND idempotency_key=? LIMIT 1',[req.auth.id,key]);if(prior.length&&prior[0].type==='deposit'&&amountToCents(Number(prior[0].amount))===amountCents)return res.status(200).json({message:'Deposit request already submitted.',reference:prior[0].reference,status:prior[0].status,idempotent:true});}throw e;}finally{conn.release();}
}));
app.post('/api/wallet/withdraw-request',requireAuth,asyncRoute(async(req,res)=>{
  const v=z.object({amount:moneySchema,note:z.string().trim().min(4).max(240)}).strict().safeParse(req.body);
  if(!v.success)return res.status(400).json({error:'Enter a withdrawal amount between $1.00 and $100,000.00 with no more than two decimal places, and valid destination details.'});
  const amountCents=amountToCents(v.data.amount);
  const amount=centsToAmount(amountCents);
  const key=getIdempotencyKey(req);
  const conn=await pool.getConnection();
  try{
    await conn.beginTransaction();
    if(key){
      const prior=await findIdempotentTransaction(conn,req.auth.id,key,'withdrawal',amountCents);
      if(prior){await conn.commit();return res.status(200).json({message:'Withdrawal request already submitted.',reference:prior.reference,status:prior.status,idempotent:true});}
    }
    const [ws]=await conn.execute('SELECT balance FROM wallets WHERE user_id=? FOR UPDATE',[req.auth.id]);
    if(!ws[0]||Number(ws[0].balance)<Number(amount)){await conn.rollback();return res.status(400).json({error:'Insufficient wallet balance.'});}
    const [debit]=await conn.execute('UPDATE wallets SET balance=balance-? WHERE user_id=? AND balance>=?',[amount,req.auth.id,amount]);
    if(debit.affectedRows!==1){await conn.rollback();return res.status(400).json({error:'Insufficient wallet balance.'});}
    const [afterRows]=await conn.execute('SELECT balance FROM wallets WHERE user_id=?',[req.auth.id]);
    const ref=makeReference('WDR');
    const [inserted]=await conn.execute("INSERT INTO transactions(user_id,reference,type,amount,status,note,idempotency_key) VALUES(?,?,'withdrawal',?,'pending',?,?)",[req.auth.id,ref,amount,v.data.note,key]);
    await insertLedger(conn,{userId:req.auth.id,transactionId:inserted.insertId,entryType:'withdrawal_reserve',amount:`-${amount}`,balanceAfter:afterRows[0].balance,actorUserId:req.auth.id,idempotencyKey:key});
    await conn.commit();
    res.status(201).json({message:'Withdrawal request submitted and reserved from your wallet pending admin review.',reference:ref,status:'pending'});
  }catch(e){await conn.rollback();if(e.code==='ER_DUP_ENTRY'&&key){const [prior]=await pool.execute('SELECT reference,status,type,amount FROM transactions WHERE user_id=? AND idempotency_key=? LIMIT 1',[req.auth.id,key]);if(prior.length&&prior[0].type==='withdrawal'&&amountToCents(Number(prior[0].amount))===amountCents)return res.status(200).json({message:'Withdrawal request already submitted.',reference:prior[0].reference,status:prior[0].status,idempotent:true});}throw e;}finally{conn.release();}
}));
app.get('/api/admin/summary',requireAuth,requireAdmin,asyncRoute(async(req,res)=>{const [users]=await query('SELECT COUNT(*) total FROM users');const [pending]=await query("SELECT COUNT(*) total FROM transactions WHERE status='pending'");const [wallets]=await query('SELECT COALESCE(SUM(balance),0) total FROM wallets');const [tx]=await query('SELECT COUNT(*) total FROM transactions');res.json({users:users.total,pending:pending.total,walletBalance:wallets.total,transactions:tx.total});}));
app.get('/api/admin/transactions',requireAuth,requireAdmin,asyncRoute(async(req,res)=>{const rows=await query('SELECT t.id,t.reference,t.type,t.amount,t.status,t.note,t.created_at,u.name,u.email FROM transactions t JOIN users u ON u.id=t.user_id ORDER BY t.id DESC LIMIT 200');res.json({transactions:rows});}));
app.post('/api/admin/transactions/:id/review',requireAuth,requireAdmin,asyncRoute(async(req,res)=>{
  const v=z.object({decision:z.enum(['approve','reject']),note:z.string().max(240).optional()}).strict().safeParse(req.body);
  const id=Number(req.params.id);
  if(!v.success||!Number.isSafeInteger(id)||id<1)return res.status(400).json({error:'Invalid transaction review request.'});
  const conn=await pool.getConnection();
  try{
    await conn.beginTransaction();
    const [rows]=await conn.execute('SELECT * FROM transactions WHERE id=? FOR UPDATE',[id]);
    const t=rows[0];
    if(!t||t.status!=='pending'){await conn.rollback();return res.status(409).json({error:'Transaction not found or already processed.'});}
    const [walletRows]=await conn.execute('SELECT balance FROM wallets WHERE user_id=? FOR UPDATE',[t.user_id]);
    if(!walletRows[0]){await conn.rollback();return res.status(409).json({error:'Wallet not found for this transaction.'});}
    let balanceAfter=Number(walletRows[0].balance);
    const amount=centsToAmount(amountToCents(Number(t.amount)));
    if(v.data.decision==='approve'&&t.type==='deposit'){
      await conn.execute('UPDATE wallets SET balance=balance+? WHERE user_id=?',[amount,t.user_id]);
      const [updated]=await conn.execute('SELECT balance FROM wallets WHERE user_id=?',[t.user_id]);
      balanceAfter=updated[0].balance;
      await insertLedger(conn,{userId:t.user_id,transactionId:t.id,entryType:'deposit_credit',amount,balanceAfter,actorUserId:req.auth.id});
    } else if(v.data.decision==='reject'&&t.type==='withdrawal'){
      await conn.execute('UPDATE wallets SET balance=balance+? WHERE user_id=?',[amount,t.user_id]);
      const [updated]=await conn.execute('SELECT balance FROM wallets WHERE user_id=?',[t.user_id]);
      balanceAfter=updated[0].balance;
      await insertLedger(conn,{userId:t.user_id,transactionId:t.id,entryType:'withdrawal_refund',amount,balanceAfter,actorUserId:req.auth.id});
    }
    const status=v.data.decision==='approve'?'approved':'rejected';
    await conn.execute('UPDATE transactions SET status=?,review_note=?,reviewed_by=?,reviewed_at=NOW() WHERE id=?',[status,v.data.note||null,req.auth.id,t.id]);
    await conn.commit();
    res.json({message:`Transaksi ${status}.`});
  }catch(e){await conn.rollback();throw e;}finally{conn.release();}
}));
app.get('/api/admin/users',requireAuth,requireAdmin,asyncRoute(async(req,res)=>{res.json({users:await query('SELECT u.id,u.name,u.email,u.role,u.status,u.created_at,w.balance FROM users u LEFT JOIN wallets w ON w.user_id=u.id ORDER BY u.id DESC LIMIT 200')});}));
app.patch('/api/admin/users/:id/status',requireAuth,requireAdmin,asyncRoute(async(req,res)=>{const v=z.object({status:z.enum(['active','suspended'])}).safeParse(req.body);if(!v.success)return res.status(400).json({error:'Invalid status.'});if(Number(req.params.id)===req.auth.id&&v.data.status==='suspended')return res.status(400).json({error:'An administrator cannot suspend their own account.'});await query('UPDATE users SET status=? WHERE id=?',[v.data.status,Number(req.params.id)]);res.json({message:'Account status updated.'});}));

app.post('/api/game-history',requireAuth,asyncRoute(async(req,res)=>{
  await ensureGameHistory();
  const v=z.object({session_id:z.string().trim().min(1).max(80),game_id:z.number().int().positive().nullable().optional(),slug:z.string().trim().min(1).max(120),title:z.string().trim().min(1).max(160),provider:z.string().trim().max(100).optional()}).strict().safeParse(req.body);
  if(!v.success)return res.status(400).json({error:'Game session details are invalid.'});
  const [existing]=await pool.execute('SELECT id FROM game_play_history WHERE session_id=? AND user_id=? LIMIT 1',[v.data.session_id,req.auth.id]);
  if(!existing.length){
    await query('INSERT INTO game_play_history(user_id,game_id,session_id,slug,title,provider) VALUES(?,?,?,?,?,?)',[req.auth.id,v.data.game_id||null,v.data.session_id,v.data.slug,v.data.title,v.data.provider||'Unknown provider']);
  }
  res.status(201).json({message:'Game session recorded.'});
}));
app.get('/api/game-history',requireAuth,asyncRoute(async(req,res)=>{
  await ensureGameHistory();
  const history=await query(`SELECT h.id,h.session_id,h.slug,h.title,h.provider,h.started_at AS last_played_at,
    1 AS session_count,COALESCE(r.round_count,0) AS round_count,COALESCE(r.total_bet,0) AS total_bet,COALESCE(r.total_win,0) AS total_win
    FROM game_play_history h LEFT JOIN (
      SELECT session_id,user_id,COUNT(*) AS round_count,COALESCE(SUM(bet),0) AS total_bet,COALESCE(SUM(win),0) AS total_win
      FROM game_rounds WHERE action='doSpin' GROUP BY session_id,user_id
    ) r ON r.session_id=h.session_id AND r.user_id=h.user_id
    WHERE h.user_id=? ORDER BY h.started_at DESC,h.id DESC LIMIT 100`,[req.auth.id]);
  res.json({history});
}));
app.get('/api/admin/game-history',requireAuth,requireAdmin,asyncRoute(async(req,res)=>{
  await ensureGameHistory();
  const history=await query(`SELECT h.id,h.session_id,h.slug,h.title,h.provider,h.started_at AS last_played_at,u.name,u.email,
    1 AS session_count,COALESCE(r.round_count,0) AS round_count,COALESCE(r.total_bet,0) AS total_bet,COALESCE(r.total_win,0) AS total_win
    FROM game_play_history h JOIN users u ON u.id=h.user_id LEFT JOIN (
      SELECT session_id,user_id,COUNT(*) AS round_count,COALESCE(SUM(bet),0) AS total_bet,COALESCE(SUM(win),0) AS total_win
      FROM game_rounds WHERE action='doSpin' GROUP BY session_id,user_id
    ) r ON r.session_id=h.session_id AND r.user_id=h.user_id
    ORDER BY h.started_at DESC,h.id DESC LIMIT 200`);
  res.json({history});
}));
app.get('/api/favorites',requireAuth,asyncRoute(async(req,res)=>{const rows=await query('SELECT game_id FROM user_favorites WHERE user_id=? ORDER BY created_at DESC',[req.auth.id]);res.json({favorites:rows});}));
app.post('/api/favorites',requireAuth,asyncRoute(async(req,res)=>{const v=z.object({game_id:z.number().int().positive()}).safeParse(req.body);if(!v.success)return res.status(400).json({error:'Invalid game.'});const games=await query("SELECT id FROM games WHERE id=? AND status='active' LIMIT 1",[v.data.game_id]);if(!games.length)return res.status(404).json({error:'Game not found or inactive.'});await query('INSERT IGNORE INTO user_favorites(user_id,game_id) VALUES(?,?)',[req.auth.id,v.data.game_id]);res.status(201).json({message:'Game added to favorites.'});}));
app.delete('/api/favorites/:gameId',requireAuth,asyncRoute(async(req,res)=>{const id=Number(req.params.gameId);if(!Number.isSafeInteger(id)||id<1)return res.status(400).json({error:'Invalid game ID.'});await query('DELETE FROM user_favorites WHERE user_id=? AND game_id=?',[req.auth.id,id]);res.json({message:'Game removed from favorites.'});}));

installGatesOfOlympusServer(app,{pool,query,optionalAuth,asyncRoute});
installStarlightPrincessServer(app,{pool,query,optionalAuth,asyncRoute});
installStarlightChristmasServer(app,{pool,query,optionalAuth,asyncRoute});
installAztecGemsDeluxeServer(app,{pool,optionalAuth,asyncRoute});

app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  if (Number.isInteger(err.statusCode) && err.statusCode >= 400 && err.statusCode < 500) return res.status(err.statusCode).json({ error: err.message });
  if (err instanceof multer.MulterError) {
    const message = err.code === 'LIMIT_FILE_SIZE'
      ? 'Image exceeds the 5 MB upload limit.'
      : 'Upload request is invalid.';
    return res.status(400).json({ error: message });
  }
  if (err.message === 'Only JPG, PNG, or WEBP images are allowed.') {
    return res.status(400).json({ error: err.message });
  }
  if (err.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'This data is already in use.' });
  // Keep stack traces and database details in server logs only.
  console.error('[api-error]', { name: err.name, code: err.code, message: err.message, path: req.path, method: req.method });
  res.status(500).json({ error: 'A server error occurred.' });
});
const port=Number(process.env.PORT||4000);app.listen(port,()=>console.log(`Zyvalle Bet API running at http://localhost:${port}`));
