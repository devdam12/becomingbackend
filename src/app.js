const express = require('express');
const helmet = require('helmet');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const {isIP}=require('node:net');
const { randomBytes, randomUUID } = require('node:crypto');
const { registrationSchema, validDate } = require('./validation');
const { verifyPassword, hashPassword, tokenHash } = require('./auth');
const csv = require('./csv');
const {registrationAge}=require('./age');

function createApp(db, options = {}) {
  const app = express();
  const production = options.production ?? process.env.NODE_ENV === 'production';
  const origin = options.origin || process.env.APP_ORIGIN || 'http://localhost:3000';
  const proxySecret = options.proxySecret ?? process.env.API_PROXY_SECRET;
  if (production && !origin.startsWith('https://')) throw new Error('Production requires an HTTPS APP_ORIGIN');
  if (production && (!proxySecret || proxySecret.length<32)) throw new Error('Production requires API_PROXY_SECRET with at least 32 characters');
  if (process.env.TRUST_PROXY === '1') app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(helmet({ strictTransportSecurity: production ? undefined : false, contentSecurityPolicy: { directives: { upgradeInsecureRequests: production ? [] : null } } }));
  app.use(express.json({ limit:'12kb' }));
  app.use('/api', (req,res,next) => {
    res.set('Cache-Control','no-store');
    if(proxySecret && req.get('x-conference-proxy')!==proxySecret)return res.status(403).json({message:'Use the conference website to access this service.'});
    if(proxySecret && isIP(req.get('x-conference-client-ip')||''))req.conferenceClientIp=req.get('x-conference-client-ip');
    if (!['GET','HEAD'].includes(req.method) && (req.get('origin') !== origin || !req.is('application/json'))) return res.status(403).json({message:'Request origin or content type is not allowed.'});
    next();
  });
  const limiter = limit => rateLimit({windowMs:15*60*1000,limit,keyGenerator:req=>ipKeyGenerator(req.conferenceClientIp || req.ip || '127.0.0.1'),standardHeaders:'draft-8',legacyHeaders:false,message:{message:'Too many attempts. Please try again in 15 minutes.'}});
  const registrations = db.collection('registrations');
  const admins = db.collection('admins');
  const sessions = db.collection('sessions');
  app.post('/api/registrations',limiter(options.registrationLimit || 20),async(req,res)=>{
    const result = registrationSchema.safeParse(req.body);
    if (!result.success) return res.status(422).json({message:'Please check the highlighted fields.',errors:result.error.flatten().fieldErrors});
    const {consent:_consent,...d} = result.data;
    const id = randomUUID(); const now = new Date().toISOString();
    try {
      await registrations.insertOne({...d,id,created_at:now,status:'registered',consent_role:d.age<18?'guardian':'attendee',consent_version:'2026-10-16-age-v2',consent_at:now});
      res.status(201).json({id,message:'Your registration details have been received.'});
    } catch (err) {
      if (err.code === 11000 && (err.keyPattern?.email || err.keyValue?.email)) return res.status(409).json({message:'A registration already exists for this email address. Contact the organizer through the channel that shared this link to request a correction.',errors:{email:['This email address is already registered.']}});
      res.status(503).json({message:'Registration is temporarily unavailable. Your details have not been confirmed; please try again.'});
    }
  });
  let dummyHash;
  app.post('/api/admin/login',limiter(10),async(req,res)=>{
    const {email,password} = req.body || {};
    if (typeof email !== 'string' || typeof password !== 'string' || password.length>256 || email.length>254) return res.status(400).json({message:'Enter your email and password.'});
    const admin = await admins.findOne({email:email.trim().toLowerCase()});
    dummyHash ||= await hashPassword(randomBytes(32).toString('hex'));
    const valid = await verifyPassword(password,admin?.password_hash || dummyHash);
    if (!valid || !admin || admin.role!=='admin') return res.status(401).json({message:'Email or password is incorrect.'});
    const token = randomBytes(32).toString('hex');
    await sessions.insertOne({_id:tokenHash(token),admin_id:admin._id,expires_at:new Date(Date.now()+8*60*60*1000)});
    res.cookie('conference_session',token,{httpOnly:true,secure:production,sameSite:'strict',maxAge:8*60*60*1000,path:'/'}).json({message:'Signed in.'});
  });
  async function authorize(req,res,next) {
    const token = req.headers.cookie?.split(';').map(s=>s.trim()).find(s=>s.startsWith('conference_session='))?.slice('conference_session='.length);
    const session = token && await sessions.findOne({_id:tokenHash(token),expires_at:{$gt:new Date()}});
    if (!session) return res.status(401).json({message:'Please sign in to continue.'});
    const admin = await admins.findOne({_id:session.admin_id});
    if (!admin || admin.role!=='admin') return res.status(403).json({message:'Administrator access required.'});
    req.sessionToken=token;next();
  }
  app.post('/api/admin/logout',authorize,async(req,res)=>{
    await sessions.deleteOne({_id:tokenHash(req.sessionToken)});
    res.clearCookie('conference_session',{path:'/',httpOnly:true,sameSite:'strict',secure:production}).json({message:'Signed out.'});
  });
  app.get('/api/admin/registrations/export',authorize,async(req,res,next)=>{
    const cursor = registrations.find({},{projection:{_id:0}}).sort({created_at:1,id:1}).batchSize(250);
    try {
      // Fetch first batch before committing response headers, so database failures return JSON.
      const first = await cursor.next();
      res.set({'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="the-becoming-conference-registrations-2026-12-04.csv"'});
      res.write('\uFEFF'+csv.row(csv.headers));
      if (first) res.write(csv.row(csv.fields.map(f=>f==='age'?registrationAge(first):first[f])));
      for await (const record of cursor) {
        if (res.destroyed) break;
        if (!res.write(csv.row(csv.fields.map(f=>f==='age'?registrationAge(record):record[f])))) await new Promise(resolve=>{
          const done=()=>{res.off('drain',done);res.off('close',done);resolve();};
          res.once('drain',done);res.once('close',done);
        });
      }
      res.end();
    } catch(err) {next(err);} finally {await cursor.close();}
  });
  app.get('/api/admin/registrations',authorize,async(req,res)=>{
    const page=Math.max(1,Math.min(1000000,parseInt(req.query.page,10)||1));
    const q=String(req.query.q||'').slice(0,200);
    const date=String(req.query.date||'');
    if(date && !validDate(date)) return res.status(400).json({message:'Enter a valid registration date.'});
    const escaped=q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    const filter = q ? {$or:['full_name','email','school'].map(field=>({[field]:{$regex:escaped,$options:'i'}}))} : {};
    if(date) filter.created_at={$gte:date,$lt:new Date(Date.parse(date)+86400000).toISOString().slice(0,10)};
    const projection={_id:0,id:1,full_name:1,email:1,whatsapp:1,school:1,gender:1,created_at:1,status:1};
    const [total,filtered,records]=await Promise.all([registrations.countDocuments({}),registrations.countDocuments(filter),registrations.find(filter,{projection}).sort({created_at:-1,id:1}).skip((page-1)*20).limit(20).toArray()]);
    res.json({total,filtered,page,pageSize:20,records});
  });
  app.get('/api/admin/registrations/:id',authorize,async(req,res)=>{
    const record=await registrations.findOne({id:req.params.id},{projection:{_id:0}});
    if(!record) return res.status(404).json({message:'Registration not found.'});
    res.json({...record,age:registrationAge(record)});
  });
  app.get('/api/admin/session',authorize,(req,res)=>res.json({authenticated:true,role:'admin'}));
  app.get('/api/health',(req,res)=>res.json({status:'ok'}));
  app.use((req,res)=>res.status(404).json({message:'Page not found.'}));
  app.use((err,req,res,_next)=>{
    if(res.headersSent) return res.destroy();
    res.status(err.type==='entity.parse.failed'?400:err.type==='entity.too.large'?413:503).json({message:'The request could not be completed. Please try again.'});
  });
  return app;
}
module.exports={createApp};
