require('dotenv').config({quiet:true});
const {randomUUID}=require('node:crypto');
const {openDatabase}=require('../src/db');
const {hashPassword,verifyPassword}=require('../src/auth');
async function readPassword(){
  process.stdout.write('Admin password (hidden): ');
  if(process.stdin.isTTY)process.stdin.setRawMode(true);
  process.stdin.resume();
  return new Promise(resolve=>{
    let value='';
    const listener=chunk=>{for(const c of chunk.toString()){
      if(c==='\u0003')process.exit(1);
      if(c==='\r'||c==='\n'){process.stdin.off('data',listener);if(process.stdin.isTTY)process.stdin.setRawMode(false);process.stdin.pause();process.stdout.write('\n');resolve(value);return;}
      if(c==='\u007f'||c==='\b')value=value.slice(0,-1);else value+=c;
    }};
    process.stdin.on('data',listener);
  });
}
(async()=>{
  const email=String(process.argv[2]||'').trim().toLowerCase();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new Error('Invalid admin email.');
  const password=await readPassword();
  if(password.length<8||password.length>256)throw new Error('Password must contain 8–256 characters.');
  const password_hash=await hashPassword(password);
  const connection=await openDatabase();
  try{
    await connection.db.collection('admins').updateOne({email},{$set:{password_hash,role:'admin'},$setOnInsert:{_id:randomUUID()}},{upsert:true});
    const admin=await connection.db.collection('admins').findOne({email});
    await connection.db.collection('sessions').deleteMany({admin_id:admin._id});
    if(!await verifyPassword(password,admin.password_hash))throw new Error('Password verification failed.');
    console.log('Administrator saved to MongoDB and password hash verified. Previous sessions revoked.');
  }finally{await connection.close();}
})().catch(error=>{console.error('Administrator was not confirmed in MongoDB. Check connectivity and database permissions.',error.code ? `Code: ${error.code}` : '');process.exitCode=1;});
