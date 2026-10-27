import 'dotenv/config';
import express from 'express'; import multer from 'multer'; import path from 'node:path'; import fs from 'node:fs'; import cors from 'cors'; import helmet from 'helmet'; import cookieParser from 'cookie-parser'; import rateLimit from 'express-rate-limit'; import bcrypt from 'bcryptjs'; import {z} from 'zod';
import {pool,query} from './db.js'; import {cookieOptions,signUser,requireAuth,requireAdmin,optionalAuth} from './security.js';
import {installGatesOfOlympusServer} from './game/gatesOfOlympus.js';
import {installStarlightPrincessServer} from './game/starlightPrincess.js';
import {installStarlightChristmasServer} from './game/starlightChristmas.js';
import {installAztecGemsDeluxeServer} from './game/aztecGemsDeluxe.js';
const app=express();
const bannerDir=path.resolve('uploads','banners'); fs.mkdirSync(bannerDir,{recursive:true});
const bannerUpload=multer({storage:multer.diskStorage({destination:(req,file,cb)=>cb(null,bannerDir),filename:(req,file,cb)=>cb(null,Date.now()+'-'+Math.random().toString(36).slice(2,10)+path.extname(file.originalname).toLowerCase())}),limits:{fileSize:8*1024*1024},fileFilter:(req,file,cb)=>cb(null,['image/jpeg','image/png','image/webp'].includes(file.mimetype))});
app.use('/uploads/banners',express.static(bannerDir,{fallthrough:false,maxAge:'1d'}));
app.disable('x-powered-by'); app.use(helmet({crossOriginResourcePolicy:{policy:'cross-origin'}})); app.use(cors({origin:process.env.CLIENT_ORIGIN||'http://localhost:5173',credentials:true})); app.use(express.json({limit:'32kb'})); app.use(express.urlencoded({extended:false,limit:'64kb'})); app.use(cookieParser());
app.use('/api/auth',rateLimit({windowMs:15*60*1000,limit:30,standardHeaders:true,legacyHeaders:false}));
const asyncRoute=fn=>(req,res,next)=>Promise.resolve(fn(req,res,next)).catch(next);
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
app.post('/api/admin/banners',requireAuth,requireAdmin,bannerUpload.single('image'),asyncRoute(async(req,res)=>{if(!req.file)return res.status(400).json({error:'Choose a JPG, PNG, or WEBP image up to 8 MB.'});const link=String(req.body.link_url||'').trim();if(link&&!/^https?:\/\//i.test(link)&&!link.startsWith('/')){fs.unlinkSync(req.file.path);return res.status(400).json({error:'Destination URL must be http(s) or an internal path starting with /.'});}const publicOrigin=(process.env.PUBLIC_API_ORIGIN||`http://localhost:${Number(process.env.PORT||4000)}`).replace(/\/$/,'');const imageUrl=`${publicOrigin}/uploads/banners/${req.file.filename}`;const result=await query('INSERT INTO banners(image_url,link_url,active,sort_order) VALUES(?,?,1,0)',[imageUrl,link||null]);res.status(201).json({id:result.insertId,image_url:imageUrl,link_url:link||null,message:'Banner uploaded successfully.'});}));
app.patch('/api/admin/banners/:id',requireAuth,requireAdmin,asyncRoute(async(req,res)=>{const v=z.object({active:z.boolean().optional(),link_url:z.string().max(500).nullable().optional(),sort_order:z.number().int().min(0).max(9999).optional()}).strict().safeParse(req.body);if(!v.success||!Object.keys(v.data||{}).length)return res.status(400).json({error:'Banner changes are invalid.'});const keys=Object.keys(v.data);await query(`UPDATE banners SET ${keys.map(k=>`${k}=?`).join(',')} WHERE id=?`,[...keys.map(k=>v.data[k]===true?1:v.data[k]===false?0:v.data[k]),Number(req.params.id)]);res.json({message:'Banner updated.'});}));
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
app.post('/api/wallet/deposit-request',requireAuth,asyncRoute(async(req,res)=>{await ensureDepositMethods();const v=z.object({amount:z.number().min(1).max(100000),method_id:z.number().int().positive(),note:z.string().max(240).optional()}).safeParse(req.body);if(!v.success)return res.status(400).json({error:'Enter a deposit amount between $1.00 and $100,000.00.'});const methods=await query('SELECT id,name,enabled FROM deposit_methods WHERE id=? LIMIT 1',[v.data.method_id]);const method=methods[0];if(!method||!Number(method.enabled))return res.status(400).json({error:'This deposit method is currently disabled. Please choose another method.'});const amount=Math.round(v.data.amount*100)/100;const ref='DEP-'+Date.now().toString(36).toUpperCase()+'-'+Math.random().toString(36).slice(2,7).toUpperCase();const note=[`Method: ${method.name}`,String(v.data.note||'').trim()].filter(Boolean).join(' | ').slice(0,240);await query("INSERT INTO transactions(user_id,reference,type,amount,status,note) VALUES(?,?,'deposit',?,'pending',?)",[req.auth.id,ref,amount,note||'Manual deposit awaiting admin verification']);res.status(201).json({message:'Deposit request submitted. Your USD wallet will be credited after admin approval.',reference:ref});}));
app.post('/api/wallet/withdraw-request',requireAuth,asyncRoute(async(req,res)=>{const v=z.object({amount:z.number().min(1).max(100000),note:z.string().trim().min(4).max(240)}).safeParse(req.body);if(!v.success)return res.status(400).json({error:'Enter a withdrawal amount between $1.00 and $100,000.00 and valid destination details.'});const amount=Math.round(v.data.amount*100)/100;const conn=await pool.getConnection();try{await conn.beginTransaction();const [ws]=await conn.execute('SELECT balance FROM wallets WHERE user_id=? FOR UPDATE',[req.auth.id]);if(!ws[0]||Number(ws[0].balance)+1e-9<amount){await conn.rollback();return res.status(400).json({error:'Insufficient wallet balance.'});}await conn.execute('UPDATE wallets SET balance=balance-? WHERE user_id=?',[amount,req.auth.id]);const ref='WDR-'+Date.now().toString(36).toUpperCase()+'-'+Math.random().toString(36).slice(2,6).toUpperCase();await conn.execute("INSERT INTO transactions(user_id,reference,type,amount,status,note) VALUES(?,?,'withdrawal',?,'pending',?)",[req.auth.id,ref,amount,v.data.note]);await conn.commit();res.status(201).json({message:'Withdrawal request submitted and reserved from your wallet pending admin review.',reference:ref});}catch(e){await conn.rollback();throw e;}finally{conn.release();}}));
app.get('/api/admin/summary',requireAuth,requireAdmin,asyncRoute(async(req,res)=>{const [users]=await query('SELECT COUNT(*) total FROM users');const [pending]=await query("SELECT COUNT(*) total FROM transactions WHERE status='pending'");const [wallets]=await query('SELECT COALESCE(SUM(balance),0) total FROM wallets');const [tx]=await query('SELECT COUNT(*) total FROM transactions');res.json({users:users.total,pending:pending.total,walletBalance:wallets.total,transactions:tx.total});}));
app.get('/api/admin/transactions',requireAuth,requireAdmin,asyncRoute(async(req,res)=>{const rows=await query('SELECT t.id,t.reference,t.type,t.amount,t.status,t.note,t.created_at,u.name,u.email FROM transactions t JOIN users u ON u.id=t.user_id ORDER BY t.id DESC LIMIT 200');res.json({transactions:rows});}));
app.post('/api/admin/transactions/:id/review',requireAuth,requireAdmin,asyncRoute(async(req,res)=>{const v=z.object({decision:z.enum(['approve','reject']),note:z.string().max(240).optional()}).safeParse(req.body);if(!v.success)return res.status(400).json({error:'Invalid decision.'});const conn=await pool.getConnection();try{await conn.beginTransaction();const [rows]=await conn.execute('SELECT * FROM transactions WHERE id=? FOR UPDATE',[Number(req.params.id)]);const t=rows[0];if(!t||t.status!=='pending'){await conn.rollback();return res.status(409).json({error:'Transaction not found or already processed.'});}if(v.data.decision==='approve'&&t.type==='deposit')await conn.execute('UPDATE wallets SET balance=balance+? WHERE user_id=?',[t.amount,t.user_id]);if(v.data.decision==='reject'&&t.type==='withdrawal')await conn.execute('UPDATE wallets SET balance=balance+? WHERE user_id=?',[t.amount,t.user_id]);const status=v.data.decision==='approve'?'approved':'rejected';await conn.execute('UPDATE transactions SET status=?,review_note=?,reviewed_by=?,reviewed_at=NOW() WHERE id=?',[status,v.data.note||null,req.auth.id,t.id]);await conn.commit();res.json({message:`Transaksi ${status}.`});}catch(e){await conn.rollback();throw e;}finally{conn.release();}}));
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

app.use((err,req,res,next)=>{console.error(err);if(err.code==='ER_DUP_ENTRY')return res.status(409).json({error:'This data is already in use.'});res.status(500).json({error:process.env.NODE_ENV==='production'?'A server error occurred.':'Server error. Check the API logs.'});});
const port=Number(process.env.PORT||4000);app.listen(port,()=>console.log(`Zyvalle Bet API running at http://localhost:${port}`));
