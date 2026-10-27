import jwt from 'jsonwebtoken';
export const cookieOptions={httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/',maxAge:7*24*60*60*1000};
export function signUser(user){return jwt.sign({sub:user.id,role:user.role},process.env.SESSION_SECRET,{expiresIn:'7d',issuer:'zyvalle-bet'});}
export function requireAuth(req,res,next){try{const token=req.cookies?.zy_session;if(!token)return res.status(401).json({error:'Please sign in first.'});const data=jwt.verify(token,process.env.SESSION_SECRET,{issuer:'zyvalle-bet'});req.auth={id:Number(data.sub),role:data.role};next();}catch{return res.status(401).json({error:'Your session is invalid or has expired.'});}}
export function requireAdmin(req,res,next){if(req.auth?.role!=='admin')return res.status(403).json({error:'Administrator access is required.'});next();}

export function optionalAuth(req,res,next){
  try{
    const token=req.cookies?.zy_session;
    if(!token){req.auth=null;return next();}
    const data=jwt.verify(token,process.env.SESSION_SECRET,{issuer:'zyvalle-bet'});
    req.auth={id:Number(data.sub),role:data.role};
  }catch{req.auth=null;}
  next();
}
