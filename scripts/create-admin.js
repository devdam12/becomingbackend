require('dotenv').config({quiet:true});
const readline = require('node:readline/promises');
const { randomUUID } = require('node:crypto');
const { openDatabase } = require('../src/db');
const { hashPassword } = require('../src/auth');
(async()=>{
  const input = readline.createInterface({input:process.stdin,output:process.stdout});
  const email = (await input.question('Admin email: ')).trim().toLowerCase();
  // Read the password from stdin without echoing it or storing it in command history.
  input.close();
  process.stdout.write('Password (at least 14 characters, hidden): ');
  const password = await new Promise(resolve=>{
    let value='';
    if(process.stdin.isTTY) process.stdin.setRawMode(true);
    process.stdin.resume();
    const listener = chunk=>{ for(const c of chunk.toString()) {
      if(c==='\u0003') process.exit(1);
      if(c==='\r'||c==='\n') {process.stdin.off('data',listener);if(process.stdin.isTTY)process.stdin.setRawMode(false);process.stdin.pause();resolve(value);return;}
      if(c==='\u007f'||c==='\b') value=value.slice(0,-1); else value+=c;
    }};
    process.stdin.on('data',listener);
  });
  console.log();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||password.length<14||password.length>256) throw new Error('Use a valid email and a password of 14–256 characters.');
  const connection = await openDatabase();
  try { await connection.db.collection('admins').insertOne({_id:randomUUID(),email,password_hash:await hashPassword(password),role:'admin'}); }
  finally { await connection.close(); }
  console.log('Administrator created. Sign in at /admin/login.');
})().catch(()=>{console.error('Could not create administrator. Check input, database access, and whether the account already exists.');process.exitCode=1;});
