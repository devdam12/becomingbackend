require('dotenv').config({quiet:true});
const { openDatabase } = require('./db');
const { createApp } = require('./app');
(async()=>{
  const connection = await openDatabase();
  const server = createApp(connection.db).listen(process.env.PORT || 4000,()=>console.log(`Conference API running on port ${process.env.PORT || 4000}`));
  for (const signal of ['SIGINT','SIGTERM']) process.on(signal,()=>server.close(async()=>{await connection.close();process.exit(0);}));
})().catch(error=>{
  // Only report known categories; driver messages may contain private connection details.
  const code=error.code || error.cause?.code;
  if(['ETIMEOUT','ENOTFOUND','EAI_AGAIN','ECONNREFUSED'].includes(code))console.error(`Backend could not start: MongoDB network/DNS connection failed (${code}). Verify Atlas DNS resolution, network access, and its IP access list. The API is not listening.`);
  else if(error.message === 'Configure mongoURL or MONGODB_URI on the server.') console.error('Backend could not start: MONGODB_URI or mongoURL is missing. Configure the Render environment variable before deploying.');
  else if(error.message?.startsWith('Production requires ')) console.error(`Backend could not start: ${error.message}. Check the Render production environment variables.`);
  else console.error(`Backend could not start: ${error.name || 'UnknownError'}${code ? ` (${code})` : ''}. Check MongoDB credentials, database permissions, indexes, and server configuration.`);
  process.exitCode=1;
});
