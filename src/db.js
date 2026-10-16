const { MongoClient } = require('mongodb');
const dns = require('node:dns');
const {registrationValidator}=require('./schema');

function configureMongoDns() {
  const servers = (process.env.MONGODB_DNS_SERVERS || '1.1.1.1,8.8.8.8')
    .split(',')
    .map(server => server.trim())
    .filter(Boolean);
  if (servers.length) dns.setServers(servers);
}

async function openDatabase(uri = process.env.mongoURL || process.env.MONGODB_URI, name = process.env.MONGODB_DB || 'becoming_conference') {
  if (!uri) throw new Error('Configure mongoURL or MONGODB_URI on the server.');
  configureMongoDns();
  const client = new MongoClient(uri, { serverSelectionTimeoutMS:10000, maxPoolSize:10 });
  try {
    await client.connect();
    const db = client.db(name);
    const existing=await db.listCollections({name:'registrations'}).next();
    if(!existing){
      try{await db.createCollection('registrations',{validator:registrationValidator,validationLevel:'strict'});}
      catch(error){if(error.code!==48)throw error;}
    }else if(existing.options?.validator?.$jsonSchema?.required?.includes('consent_version') && (!existing.options.validator.$jsonSchema.properties?.dob || !existing.options.validator.$jsonSchema.properties?.age)){
      // Extend this application's older validators without deleting age-only or DOB-only records.
      const schema=structuredClone(registrationValidator.$jsonSchema);
      schema.required=schema.required.filter(key=>!['age','dob'].includes(key));
      schema.anyOf=[{required:['age']},{required:['dob']}];
      schema.properties.dob={bsonType:'string'};
      await db.command({collMod:'registrations',validator:{$jsonSchema:schema},validationLevel:'strict'});
    }
    await Promise.all([
      db.collection('registrations').createIndex({email:1},{unique:true}),
      db.collection('registrations').createIndex({id:1},{unique:true}),
      db.collection('registrations').createIndex({created_at:-1,id:1}),
      db.collection('admins').createIndex({email:1},{unique:true}),
      db.collection('sessions').createIndex({expires_at:1},{expireAfterSeconds:0})
    ]);
    return { db, close:()=>client.close() };
  } catch (error) {await client.close();throw error;}
}
module.exports = { openDatabase };
