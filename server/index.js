const express = require('express');
const http = require('node:http');
const path = require('node:path');
const crypto = require('node:crypto');
const { Server } = require('socket.io');

function equal(a, b) {
  return typeof a === 'string' && typeof b === 'string' && crypto.timingSafeEqual(crypto.createHash('sha256').update(a).digest(), crypto.createHash('sha256').update(b).digest());
}
function normalizeDevice(value) {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  return /^\+?[\d ()-]+$/.test(trimmed) ? trimmed.replace(/[ ()-]/g, '') : trimmed;
}
function createTracker({ adminToken, devices = {} } = {}) {
  if (typeof adminToken !== 'string' || adminToken.length < 32) throw Error('GPS_ADMIN_TOKEN must have at least 32 characters');
  if (!devices || Array.isArray(devices) || typeof devices !== 'object') throw Error('GPS_DEVICE_TOKENS must be an object');
  if (Object.values(devices).some(t => typeof t !== 'string' || t.length < 32 || equal(t, adminToken))) throw Error('Device tokens must differ from the admin token and have at least 32 characters');
  if (new Set(Object.values(devices)).size !== Object.keys(devices).length) throw Error('Use a different token for each device');
  const app = express(), server = http.createServer(app), io = new Server(server), locations = new Map();
  app.use((_req,res,next)=>{res.set('Cache-Control','no-store');res.set('Referrer-Policy','no-referrer');res.set('X-Content-Type-Options','nosniff');next();});
  app.use(express.json({limit:'8kb'}));
  const bearer = req => req.headers.authorization?.replace(/^Bearer /,'');
  const admin = (req,res,next) => equal(bearer(req),adminToken) ? next() : res.status(401).json({error:'Administrator login required'});
  app.get('/',(_req,res)=>res.sendFile(path.resolve(__dirname,'../dashboard/index.html')));
  app.get('/phone',(_req,res)=>res.redirect('/'));
  app.get('/phone-client.js',(_req,res)=>res.sendFile(path.resolve(__dirname,'../mobile/client.js')));
  app.use('/leaflet', express.static(path.resolve(__dirname, 'node_modules/leaflet/dist')));
  app.get('/dashboard-map.js',(_req,res)=>res.sendFile(path.resolve(__dirname,'../dashboard/map.js')));
  app.get('/health',(_req,res)=>res.json({status:'ok'}));
  app.get('/locations',admin,(_req,res)=>res.json({devices:[...locations.values()]}));
  const deviceAuth = (req,res,next) => {
    req.body = req.body || {};
    req.body.device_name = normalizeDevice(req.body.device_name);
    if (!Object.hasOwn(devices,req.body.device_name)||!equal(bearer(req),devices[req.body.device_name])) return res.status(401).json({error:'Device login required'});
    next();
  };
  app.post('/device-auth',deviceAuth,(_req,res)=>res.json({ok:true}));
  app.post('/gps',deviceAuth,(req,res)=>{
    const {device_name,latitude,longitude,accuracy=null,altitude=null,speed=null}=req.body||{};
    if (!Number.isFinite(latitude)||Math.abs(latitude)>90||!Number.isFinite(longitude)||Math.abs(longitude)>180||[accuracy,altitude,speed].some(x=>x!==null&&!Number.isFinite(x))||(accuracy!==null&&accuracy<0)||(speed!==null&&speed<0)) return res.status(400).json({error:'Invalid coordinates or telemetry'});
    const location={device_name,latitude,longitude,accuracy,altitude,speed,timestamp:new Date().toISOString()};
    locations.set(device_name,location);io.emit('location_update',location);res.json({ok:true,location});
  });
  app.delete('/locations/:device',admin,(req,res)=>{locations.delete(req.params.device);res.json({ok:true});});
  io.use((socket,next)=>equal(socket.handshake.auth?.token,adminToken)?next():next(Error('Administrator login required')));
  io.on('connection',socket=>socket.emit('snapshot',[...locations.values()]));
  app.use((err,_req,res,_next)=>res.status(err.type==='entity.too.large'?413:400).json({error:'Invalid request'}));
  return {app,server,io};
}
if(require.main===module){
  const devices=JSON.parse(process.env.GPS_DEVICE_TOKENS||'{}');
  const {server}=createTracker({adminToken:process.env.GPS_ADMIN_TOKEN,devices});
  const port=process.env.PORT||3001;
  server.listen(port,'127.0.0.1',()=>console.log(`GPS Tracker: http://127.0.0.1:${port}; phone page: /phone. Other devices require authenticated HTTPS hosting.`));
}
module.exports={createTracker};
