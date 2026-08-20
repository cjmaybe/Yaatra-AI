import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const port = Number(process.env.PORT || 3000);
const requests = new Map();
const limit = Number(process.env.AI_RATE_LIMIT || 20);

app.use(helmet({contentSecurityPolicy:false}));
app.use(cors({origin:process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : true}));
app.use(express.json({limit:'2mb'}));
app.use(express.static(path.join(__dirname, 'frontend')));

function rateLimit(req, res, next){
  const key = req.ip || 'unknown';
  const now = Date.now();
  const windowMs = 60_000;
  const row = requests.get(key) || {start:now, count:0};
  if(now - row.start > windowMs){ row.start = now; row.count = 0; }
  row.count += 1; requests.set(key, row);
  if(row.count > limit) return res.status(429).json({message:'Too many requests. Please try again shortly.'});
  next();
}
function clean(value, max=4000){ return typeof value === 'string' ? value.trim().slice(0,max) : ''; }
function providerMessage(status){
  return ({401:'Yaatra AI authentication failed. Check the Groq API key.',403:'Yaatra AI access was denied.',429:'Yaatra AI rate limit reached. Please try again shortly.',500:'Yaatra AI is temporarily unavailable.'})[status] || 'Yaatra AI request failed.';
}
function buildSystemPrompt(context={}, requested=''){ return `You are Yaatra, a careful travel companion. Answer with practical, concise guidance. Never invent real businesses, ratings, prices, addresses, opening hours, emergency contacts, or live availability. Mark estimates clearly. For itinerary requests return valid JSON only with type, destination, days, and budget fields. Context: ${JSON.stringify(context)}. User request: ${requested}`; }
function demoReply(message){ return `Yaatra is currently in fallback mode because the live AI service is not configured or reachable. I can still help with the sample directory, trip budgeting, local planning, and offline phrasebook. Your request was: “${message.slice(0,240)}”`; }
function parseJsonBlock(text){ try{return JSON.parse(text);}catch{} const match=text.match(/\{[\s\S]*\}/); if(!match)return null; try{return JSON.parse(match[0]);}catch{return null;} }

app.get('/api/health', (_req,res)=>res.json({ok:true, service:'yaatra-api', time:new Date().toISOString()}));

// Firebase web configuration is public by design; private service credentials stay server-side.
app.get('/api/config', (_req,res)=>res.json({firebase:{apiKey:process.env.FIREBASE_API_KEY || '',authDomain:process.env.FIREBASE_AUTH_DOMAIN || '',projectId:process.env.FIREBASE_PROJECT_ID || '',storageBucket:process.env.FIREBASE_STORAGE_BUCKET || '',messagingSenderId:process.env.FIREBASE_MESSAGING_SENDER_ID || '',appId:process.env.FIREBASE_APP_ID || ''}}));

const geocodeCache = new Map();
const imageCache = new Map();
// Looks up a genuine photo for a real place/thing via Wikipedia's public REST API
// (no key required). Returns null (never a fake/unrelated stock photo) if nothing
// relevant is found, so the frontend can fall back to a clearly-labeled placeholder.
async function fetchRealImage(name, hint=''){
  const key = `${name}|${hint}`.toLowerCase();
  if(imageCache.has(key)) return imageCache.get(key);
  let result = null;
  try{
    const direct = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(name)}`, {headers:{'User-Agent':'YaatraTravelApp/1.0','Accept':'application/json'}});
    if(direct.ok){
      const data = await direct.json();
      if(data?.thumbnail?.source && data.type !== 'disambiguation') result = data.thumbnail.source.replace(/\/\d+px-/, '/800px-');
    }
    if(!result){
      const search = await fetch(`https://en.wikipedia.org/w/api.php?action=opensearch&limit=1&namespace=0&format=json&search=${encodeURIComponent(`${name} ${hint}`.trim())}`, {headers:{'User-Agent':'YaatraTravelApp/1.0'}});
      if(search.ok){
        const data = await search.json();
        const title = data?.[1]?.[0];
        if(title){
          const summary = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`, {headers:{'User-Agent':'YaatraTravelApp/1.0','Accept':'application/json'}});
          if(summary.ok){
            const sdata = await summary.json();
            if(sdata?.thumbnail?.source && sdata.type !== 'disambiguation') result = sdata.thumbnail.source.replace(/\/\d+px-/, '/800px-');
          }
        }
      }
    }
  }catch(error){ console.error('Image lookup error', error.message); }
  imageCache.set(key, result);
  return result;
}
async function withRealImages(items, limit=12){
  const head = items.slice(0, limit);
  const tail = items.slice(limit).map(x=>({...x, image:null}));
  const resolved = await Promise.all(head.map(async x=>({...x, image: await fetchRealImage(x.name, x.type || x.category || '')})));
  return [...resolved, ...tail];
}

// Real photo for a single named place/thing (destinations, vehicles, hero art).
app.get('/api/image', async (req,res)=>{
  const name = clean(req.query.name, 160);
  const hint = clean(req.query.hint, 60);
  if(!name) return res.status(400).json({message:'A name is required.'});
  const image = await fetchRealImage(name, hint);
  res.json({image, live:Boolean(image)});
});

app.get('/api/weather', async (req,res)=>{
  const lat = Number(req.query.lat); const lon = Number(req.query.lon); const query = clean(req.query.query, 120);
  try{
    let latitude = lat, longitude = lon, label = query || 'Current location';
    if(!Number.isFinite(latitude) || !Number.isFinite(longitude)){
      if(!query) return res.status(400).json({message:'Provide latitude/longitude or a destination query.'});
      const cached = geocodeCache.get(query.toLowerCase());
      const geo = cached || await (await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(query)}`,{headers:{'User-Agent':'YaatraTravelApp/1.0'}})).json();
      if(!geo?.[0]) return res.status(404).json({message:'Destination could not be located.'});
      geocodeCache.set(query.toLowerCase(), geo); latitude=Number(geo[0].lat); longitude=Number(geo[0].lon); label=geo[0].display_name?.split(',').slice(0,2).join(',') || query;
    }
    const params = new URLSearchParams({latitude:String(latitude),longitude:String(longitude),current:'temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m',daily:'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset',forecast_days:'5',timezone:'auto'});
    const upstream = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
    const data = await upstream.json(); if(!upstream.ok) return res.status(502).json({message:'Weather provider rejected the request.'});
    res.json({location:{label,latitude,longitude,timezone:data.timezone},current:data.current,daily:data.daily,source:'Open-Meteo'});
  }catch(error){ console.error('Weather error',error.message); res.status(503).json({message:'Live weather is unavailable right now.'}); }
});

const placeTags={food:'[amenity~"restaurant|cafe|fast_food|food_court"]',hotels:'[tourism~"hotel|guest_house|hostel|resort"]',health:'[amenity~"hospital|clinic|pharmacy"]',attractions:'[tourism~"attraction|museum|viewpoint|zoo|theme_park"]',transport:'[amenity~"fuel|bus_station|taxi"]'};
app.get('/api/places', async (req,res)=>{
  const lat=Number(req.query.lat), lon=Number(req.query.lon), category=String(req.query.category||'').toLowerCase(); const radius=Math.min(Math.max(Number(req.query.radius||5000),500),20000);
  if(!Number.isFinite(lat)||!Number.isFinite(lon)) return res.status(400).json({message:'A valid latitude and longitude are required.'});
  const tag=placeTags[category] || '[name]';
  const query=`[out:json][timeout:20];(nwr(around:${radius},${lat},${lon})${tag};);out center tags;`;
  try{
    const upstream=await fetch('https://overpass-api.de/api/interpreter',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded','User-Agent':'YaatraTravelApp/1.0'},body:new URLSearchParams({data:query})});
    const data=await upstream.json(); if(!upstream.ok) return res.status(502).json({message:'Places provider rejected the request.'});
    const places=(data.elements||[]).filter(x=>x.tags?.name).slice(0,60).map((x,i)=>{const plat=x.lat ?? x.center?.lat, plon=x.lon ?? x.center?.lon; const name=x.tags.name; const type=x.tags.amenity||x.tags.tourism||category||'Place'; return {id:`osm-${x.type}-${x.id}`,name,type:type.replaceAll('_',' '),category,lat:plat,lng:plon,distance:Number((Math.hypot((plat-lat)*111,(plon-lon)*111*Math.cos(lat*Math.PI/180))).toFixed(1)),price:0,rating:null,image:null,description:x.tags.description||`${name} · verified OpenStreetMap listing`,address:[x.tags['addr:housenumber'],x.tags['addr:street'],x.tags['addr:city']].filter(Boolean).join(', '),live:true};});
    // Attach a genuine photo (Wikipedia) for the nearest results only, so the
    // response stays fast; further-away results fall back to a placeholder icon.
    res.json({places: await withRealImages(places, 12)});
  }catch(error){console.error('Places error',error.message);res.status(503).json({message:'Live nearby places are unavailable right now.'});}
});

app.post('/api/ai/chat', rateLimit, async (req,res)=>{
  const message = clean(req.body?.message, 2000);
  if(!message) return res.status(400).json({message:'A message is required.'});
  if(!process.env.GROQ_API_KEY) return res.status(503).json({message:'Live Yaatra AI is not configured.', demo:true, text:demoReply(message)});
  const history = Array.isArray(req.body?.history) ? req.body.history.slice(-12).map(x=>({role:x.role==='assistant'?'assistant':'user',content:clean(x.content,3000)})) : [];
  const wantsJson = /plan|itinerary|trip|day-by-day|schedule/i.test(message);
  const payload = {model:process.env.GROQ_MODEL || 'llama-3.3-70b-versatile', messages:[{role:'system',content:buildSystemPrompt(req.body?.context || {}, message)}, ...history], temperature:0.35, max_tokens:1200};
  if(wantsJson) payload.response_format = {type:'json_object'};
  try{
    const upstream = await fetch(process.env.GROQ_ENDPOINT || 'https://api.groq.com/openai/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${process.env.GROQ_API_KEY}`},body:JSON.stringify(payload)});
    const raw = await upstream.text();
    if(!upstream.ok){ console.error('Groq provider error', upstream.status, raw.slice(0,500)); return res.status(upstream.status === 401 || upstream.status === 403 || upstream.status === 429 ? upstream.status : 502).json({message:providerMessage(upstream.status)}); }
    const data = JSON.parse(raw); const text = data?.choices?.[0]?.message?.content?.trim();
    if(!text) return res.status(502).json({message:'Yaatra AI returned an empty response.'});
    const structured = wantsJson ? parseJsonBlock(text) : null;
    if(wantsJson && !structured) return res.status(502).json({message:'Yaatra AI returned an invalid itinerary. Please retry.'});
    return res.json({text:wantsJson ? (structured.summary || 'Itinerary generated.') : text, structured, demo:false});
  }catch(error){ console.error('Groq network error', error.message); return res.status(503).json({message:'Unable to connect to Yaatra AI.'}); }
});

app.get('/api/currency/:from/:to', async (req,res)=>{
  const from = String(req.params.from || '').toUpperCase(); const to = String(req.params.to || '').toUpperCase();
  if(!/^[A-Z]{3}$/.test(from) || !/^[A-Z]{3}$/.test(to)) return res.status(400).json({message:'Use three-letter currency codes.'});
  try{
    const url = process.env.CURRENCY_API_KEY ? `https://v6.exchangerate-api.com/v6/${process.env.CURRENCY_API_KEY}/pair/${from}/${to}` : `https://open.er-api.com/v6/latest/${from}`;
    const data = await (await fetch(url)).json(); const rate = process.env.CURRENCY_API_KEY ? data.conversion_rate : data?.rates?.[to];
    if(!rate) throw new Error('rate unavailable'); res.json({from,to,rate:Number(rate),live:Boolean(process.env.CURRENCY_API_KEY)});
  }catch(error){ console.error('Currency error', error.message); res.status(503).json({message:'Live currency rates are unavailable. Please retry shortly.'}); }
});

app.post('/api/translate', async (req,res)=>{
  const text = clean(req.body?.text, 1200); const target = clean(req.body?.target, 8).toLowerCase();
  if(!text || !/^(en|ta|hi|kn|ml)$/.test(target)) return res.status(400).json({message:'Text and a supported target language are required.'});
  if(!process.env.TRANSLATION_API_KEY) return res.status(503).json({message:'Live translation is not configured.', demo:true});
  try{
    const upstream = await fetch(`https://translation.googleapis.com/language/translate/v2?key=${process.env.TRANSLATION_API_KEY}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({q:text,target,format:'text'})});
    const data = await upstream.json(); if(!upstream.ok) return res.status(502).json({message:'Translation service rejected the request.'});
    res.json({text:data?.data?.translations?.[0]?.translatedText || '',live:true});
  }catch(error){ console.error('Translation error', error.message); res.status(503).json({message:'Unable to connect to translation service.'}); }
});

app.post('/api/vision/ocr', async (req,res)=>{
  const content = req.body?.imageBase64; if(typeof content !== 'string' || content.length < 20 || content.length > 1_500_000) return res.status(400).json({message:'A valid image upload is required.'});
  if(!process.env.GOOGLE_VISION_API_KEY) return res.status(503).json({message:'Live OCR is not configured.', demo:true});
  try{
    const upstream = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${process.env.GOOGLE_VISION_API_KEY}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({requests:[{image:{content:content.replace(/^data:[^;]+;base64,/,'')},features:[{type:'TEXT_DETECTION'},{type:'LABEL_DETECTION',maxResults:8}]}]})});
    const data = await upstream.json(); if(!upstream.ok) return res.status(502).json({message:'Vision service rejected the request.'});
    const r=data?.responses?.[0] || {}; res.json({text:r?.fullTextAnnotation?.text || r?.textAnnotations?.[0]?.description || '',labels:(r?.labelAnnotations||[]).map(x=>x.description),live:true});
  }catch(error){ console.error('Vision error', error.message); res.status(503).json({message:'Unable to connect to vision service.'}); }
});

app.get('*', (_req,res)=>res.sendFile(path.join(__dirname,'frontend','index.html')));
export {app};
if(process.env.FIREBASE_FUNCTIONS !== 'true') app.listen(port,()=>console.log(`Yaatra running on http://localhost:${port}`));
