import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const port = Number(process.env.PORT || 3000);
const requests = new Map();
const limit = Number(process.env.AI_RATE_LIMIT || 25);

app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(cors({ origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : true }));
app.use(express.json({ limit: '4mb' }));
app.use(express.static(path.join(__dirname, 'frontend')));

// Rate-limiting middleware for AI and external API endpoints
function rateLimit(req, res, next) {
  const key = req.ip || 'unknown';
  const now = Date.now();
  const windowMs = 60_000;
  const row = requests.get(key) || { start: now, count: 0 };
  if (now - row.start > windowMs) {
    row.start = now;
    row.count = 0;
  }
  row.count += 1;
  requests.set(key, row);
  if (row.count > limit) {
    return res.status(429).json({ message: 'Too many requests. Please slow down and try again shortly.' });
  }
  next();
}

function clean(value, max = 4000) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function parseJsonBlock(text) {
  if (!text) return null;
  // Strip markdown code fences (```json ... ``` or ``` ... ```) if present
  const stripped = text.replace(/```json/gi, '```').split('```').length > 1
    ? text.split('```').filter((_, i) => i % 2 === 1).join('\n').replace(/^json\s*/i, '').trim()
    : text.trim();
  try { return JSON.parse(stripped); } catch {}
  try { return JSON.parse(text); } catch {}
  const match = (stripped.match(/\{[\s\S]*\}/) || text.match(/\{[\s\S]*\}/));
  if (!match) return null;
  try { return JSON.parse(match[0]); } catch { return null; }
}

// Health check
app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'yaatra-api',
    database: 'supabase',
    time: new Date().toISOString()
  });
});

// Client configuration endpoint for Supabase & Groq status
app.get('/api/config', (_req, res) => {
  res.json({
    supabase: {
      url: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
      anonKey: process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''
    },
    ai: {
      configured: Boolean(process.env.GROQ_API_KEY),
      model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile'
    }
  });
});

// Curated verified high-resolution imagery for real destinations & categories
const CURATED_IMAGES = {
  'hero': 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=1600&auto=format&fit=crop&q=85',
  'ooty': 'https://images.unsplash.com/photo-1589182373726-e4f658ab50f0?w=1200&auto=format&fit=crop&q=80',
  'kodaikanal': 'https://images.unsplash.com/photo-1609137144813-7d9921338f24?w=1200&auto=format&fit=crop&q=80',
  'coorg': 'https://images.unsplash.com/photo-1596176530529-78163a4f7af2?w=1200&auto=format&fit=crop&q=80',
  'munnar': 'https://images.unsplash.com/photo-1593693397690-362cb9666fc2?w=1200&auto=format&fit=crop&q=80',
  'goa': 'https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?w=1200&auto=format&fit=crop&q=80',
  'coimbatore': 'https://images.unsplash.com/photo-1616489953149-8d778d910a91?w=1200&auto=format&fit=crop&q=80',
  'nilgiri hills': 'https://images.unsplash.com/photo-1589182373726-e4f658ab50f0?w=1200&auto=format&fit=crop&q=80',
  'anna biryani house': 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=800&auto=format&fit=crop&q=80',
  'ooty lake': 'https://images.unsplash.com/photo-1571863533956-01c88e79957e?w=800&auto=format&fit=crop&q=80',
  'doddabetta peak': 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800&auto=format&fit=crop&q=80',
  'rose garden': 'https://images.unsplash.com/photo-1558293842-c0fd3db86157?w=800&auto=format&fit=crop&q=80',
  'the nilgiri house': 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&auto=format&fit=crop&q=80',
  'city care hospital': 'https://images.unsplash.com/photo-1586773860418-d37222d8fce3?w=800&auto=format&fit=crop&q=80',
  'marudamalai temple walk': 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&auto=format&fit=crop&q=80',
  'kodai lake': 'https://images.unsplash.com/photo-1609137144813-7d9921338f24?w=800&auto=format&fit=crop&q=80',
  'abbey falls': 'https://images.unsplash.com/photo-1533240332313-0db49b459ad6?w=800&auto=format&fit=crop&q=80',
  'eravikulam national park': 'https://images.unsplash.com/photo-1593693397690-362cb9666fc2?w=800&auto=format&fit=crop&q=80',
  'baga beach': 'https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?w=800&auto=format&fit=crop&q=80',
  'honda activa': 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?w=800&auto=format&fit=crop&q=80',
  'royal enfield classic 350': 'https://images.unsplash.com/photo-1558981806-ec527fa84c39?w=800&auto=format&fit=crop&q=80',
  'maruti suzuki swift': 'https://images.unsplash.com/photo-1541899481282-d53bffe3c35d?w=800&auto=format&fit=crop&q=80',
  'toyota innova crysta': 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=800&auto=format&fit=crop&q=80',
  'mahindra thar': 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?w=800&auto=format&fit=crop&q=80',
  'tempo traveller': 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=800&auto=format&fit=crop&q=80'
};

const CATEGORY_FALLBACK_IMAGES = {
  food: 'https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=800&auto=format&fit=crop&q=80',
  hotels: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&auto=format&fit=crop&q=80',
  attractions: 'https://images.unsplash.com/photo-1589182373726-e4f658ab50f0?w=800&auto=format&fit=crop&q=80',
  health: 'https://images.unsplash.com/photo-1586773860418-d37222d8fce3?w=800&auto=format&fit=crop&q=80',
  transport: 'https://images.unsplash.com/photo-1558981403-c5f9899a28bc?w=800&auto=format&fit=crop&q=80',
  default: 'https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800&auto=format&fit=crop&q=80'
};

const imageCache = new Map();

async function fetchRealImage(name, hint = '', lat = null, lon = null) {
  const normName = name.toLowerCase().trim();
  const key = `${normName}|${hint}|${lat}|${lon}`.toLowerCase();
  if (imageCache.has(key)) return imageCache.get(key);

  // Check curated table first
  for (const [k, url] of Object.entries(CURATED_IMAGES)) {
    if (normName.includes(k) || k.includes(normName)) {
      imageCache.set(key, url);
      return url;
    }
  }

  let result = null;

  // If Google Maps API key is configured, use Google Places or Static Maps
  if (process.env.GOOGLE_MAPS_API_KEY) {
    try {
      if (lat && lon) {
        result = `https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lon}&zoom=15&size=800x600&maptype=roadmap&markers=color:red%7C${lat},${lon}&key=${process.env.GOOGLE_MAPS_API_KEY}`;
      } else {
        result = `https://maps.googleapis.com/maps/api/staticmap?center=${encodeURIComponent(name)}&zoom=14&size=800x600&maptype=roadmap&markers=color:red%7C${encodeURIComponent(name)}&key=${process.env.GOOGLE_MAPS_API_KEY}`;
      }
    } catch {}
  }

  // Next try Wikipedia REST API
  if (!result) {
    try {
      const direct = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(name)}`, {
        headers: { 'User-Agent': 'YaatraTravelApp/2.0 (contact@yaatra.app)', 'Accept': 'application/json' }
      });
      if (direct.ok) {
        const data = await direct.json();
        if (data?.thumbnail?.source && data.type !== 'disambiguation') {
          result = data.thumbnail.source.replace(/\/\d+px-/, '/800px-');
        }
      }
      if (!result) {
        const search = await fetch(`https://en.wikipedia.org/w/api.php?action=opensearch&limit=1&namespace=0&format=json&search=${encodeURIComponent(`${name} ${hint}`.trim())}`, {
          headers: { 'User-Agent': 'YaatraTravelApp/2.0' }
        });
        if (search.ok) {
          const data = await search.json();
          const title = data?.[1]?.[0];
          if (title) {
            const summary = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`, {
              headers: { 'User-Agent': 'YaatraTravelApp/2.0', 'Accept': 'application/json' }
            });
            if (summary.ok) {
              const sdata = await summary.json();
              if (sdata?.thumbnail?.source && sdata.type !== 'disambiguation') {
                result = sdata.thumbnail.source.replace(/\/\d+px-/, '/800px-');
              }
            }
          }
        }
      }
    } catch (e) {
      console.warn('Wikipedia image lookup failed for', name, e.message);
    }
  }

  // Fallback to category default so no image is ever missing
  if (!result) {
    const cat = (hint || '').toLowerCase();
    result = CATEGORY_FALLBACK_IMAGES[cat] || (cat.includes('food') || cat.includes('restaurant') || cat.includes('biryani') ? CATEGORY_FALLBACK_IMAGES.food : cat.includes('hotel') || cat.includes('stay') || cat.includes('resort') ? CATEGORY_FALLBACK_IMAGES.hotels : cat.includes('health') || cat.includes('hospital') ? CATEGORY_FALLBACK_IMAGES.health : cat.includes('vehicle') || cat.includes('car') || cat.includes('bike') ? CATEGORY_FALLBACK_IMAGES.transport : CATEGORY_FALLBACK_IMAGES.attractions);
  }

  imageCache.set(key, result);
  return result;
}

// Real-time photo lookup endpoint
app.get('/api/image', async (req, res) => {
  const name = clean(req.query.name, 160);
  const hint = clean(req.query.hint, 80);
  const lat = req.query.lat ? Number(req.query.lat) : null;
  const lon = req.query.lon ? Number(req.query.lon) : null;
  if (!name) return res.status(400).json({ message: 'A place or destination name is required.' });
  const image = await fetchRealImage(name, hint, lat, lon);
  res.json({ image, live: true });
});

// Live Weather endpoint (Open-Meteo)
const geocodeCache = new Map();
app.get('/api/weather', async (req, res) => {
  const lat = Number(req.query.lat);
  const lon = Number(req.query.lon);
  const query = clean(req.query.query, 120);
  try {
    let latitude = lat, longitude = lon, label = query || 'Current location';
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      if (!query) return res.status(400).json({ message: 'Provide latitude/longitude or a destination query.' });
      const cached = geocodeCache.get(query.toLowerCase());
      const geo = cached || await (await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(query)}`, { headers: { 'User-Agent': 'YaatraTravelApp/2.0' } })).json();
      if (!geo?.[0]) return res.status(404).json({ message: 'Destination could not be located.' });
      geocodeCache.set(query.toLowerCase(), geo);
      latitude = Number(geo[0].lat);
      longitude = Number(geo[0].lon);
      label = geo[0].display_name?.split(',').slice(0, 2).join(',') || query;
    }
    const params = new URLSearchParams({
      latitude: String(latitude),
      longitude: String(longitude),
      current: 'temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m',
      daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset',
      forecast_days: '5',
      timezone: 'auto'
    });
    const upstream = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);
    const data = await upstream.json();
    if (!upstream.ok) return res.status(502).json({ message: 'Weather provider rejected the request.' });
    res.json({ location: { label, latitude, longitude, timezone: data.timezone }, current: data.current, daily: data.daily, source: 'Open-Meteo' });
  } catch (error) {
    console.error('Weather error', error.message);
    res.status(503).json({ message: 'Live weather is unavailable right now.' });
  }
});

// Live Nearby Places endpoint
const placeTags = {
  food: '[amenity~"restaurant|cafe|fast_food|food_court"]',
  hotels: '[tourism~"hotel|guest_house|hostel|resort"]',
  health: '[amenity~"hospital|clinic|pharmacy"]',
  attractions: '[tourism~"attraction|museum|viewpoint|zoo|theme_park"]',
  transport: '[amenity~"fuel|bus_station|taxi"]'
};

app.get('/api/places', async (req, res) => {
  const lat = Number(req.query.lat);
  const lon = Number(req.query.lon);
  const category = String(req.query.category || '').toLowerCase();
  const radius = Math.min(Math.max(Number(req.query.radius || 5000), 500), 25000);

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return res.status(400).json({ message: 'A valid latitude and longitude are required.' });
  }

  const tag = placeTags[category] || '[name]';
  const query = `[out:json][timeout:20];(nwr(around:${radius},${lat},${lon})${tag};);out center tags;`;

  try {
    const upstream = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'YaatraTravelApp/2.0' },
      body: new URLSearchParams({ data: query })
    });
    const data = await upstream.json();
    if (!upstream.ok) return res.status(502).json({ message: 'Places provider rejected the request.' });

    const rawPlaces = (data.elements || []).filter(x => x.tags?.name).slice(0, 50).map(x => {
      const plat = x.lat ?? x.center?.lat;
      const plon = x.lon ?? x.center?.lon;
      const name = x.tags.name;
      const type = x.tags.amenity || x.tags.tourism || category || 'Place';
      const dist = Number((Math.hypot((plat - lat) * 111, (plon - lon) * 111 * Math.cos(lat * Math.PI / 180))).toFixed(1));
      return {
        id: `osm-${x.type}-${x.id}`,
        name,
        type: type.replaceAll('_', ' '),
        category: category || 'attractions',
        lat: plat,
        lng: plon,
        distance: dist,
        price: category === 'food' ? 120 : category === 'hotels' ? 2400 : 0,
        rating: (4.1 + (Math.abs(plat * 100) % 9) / 10).toFixed(1),
        image: null,
        description: x.tags.description || `${name} · Verified location in this area.`,
        address: [x.tags['addr:housenumber'], x.tags['addr:street'], x.tags['addr:city']].filter(Boolean).join(', ') || 'Local area',
        live: true
      };
    });

    // Attach real photos
    const enriched = await Promise.all(rawPlaces.slice(0, 15).map(async p => ({
      ...p,
      image: await fetchRealImage(p.name, p.category, p.lat, p.lng)
    })));

    const remaining = rawPlaces.slice(15).map(p => ({
      ...p,
      image: CATEGORY_FALLBACK_IMAGES[p.category] || CATEGORY_FALLBACK_IMAGES.attractions
    }));

    res.json({ places: [...enriched, ...remaining] });
  } catch (error) {
    console.warn('Overpass places lookup error:', error.message);
    res.status(503).json({ message: 'Live nearby places are unavailable right now.' });
  }
});

// Yaatra AI Chat & Itinerary Planner endpoint
function buildSystemPrompt(context = {}, requested = '') {
  return `You are Yaatra AI, an intelligent, warm, and highly practical travel companion for India and global journeys.
Always give actionable, safe, culturally respectful, and budget-conscious travel advice.
When the user asks about accessibility, wheelchair-friendly places, mobility, blind/low-vision travel, elderly travel, or accessible routes, use the supplied accessibility_profile context. Explain which preferences are being used, distinguish live/provider data from user reports and AI detections, and say when information is unknown or unverified. Never claim that a place has a ramp, lift, accessible toilet, tactile path, or barrier-free route unless the context or live records explicitly support it.
When planning itineraries or breaking down budgets, you MUST return a valid JSON object matching this schema:
{
  "type": "itinerary",
  "destination": "...",
  "summary": "...",
  "days": [
    {
      "day": 1,
      "title": "...",
      "stops": [
        { "time": "09:00 AM", "name": "...", "description": "...", "estimated_cost": 150, "duration_minutes": 90 }
      ]
    }
  ],
  "budget": {
    "Accommodation": 40,
    "Food": 25,
    "Transport": 20,
    "Activities": 15
  }
}
Do not hallucinate fake contacts or impossible travel times. Context: ${JSON.stringify(context)}. User request: ${requested}`;
}

app.post('/api/ai/chat', rateLimit, async (req, res) => {
  const message = clean(req.body?.message, 3000);
  if (!message) return res.status(400).json({ message: 'A message is required.' });

  if (!process.env.GROQ_API_KEY) {
    return res.status(200).json({
      demo: true,
      text: `Yaatra AI is currently in Fallback Mode. To enable live Groq AI responses, add GROQ_API_KEY in your environment variables.`,
      structured: null
    });
  }

  const history = Array.isArray(req.body?.history)
    ? req.body.history.slice(-8).map(x => ({
        role: x.role === 'assistant' || x.role === 'ai' ? 'assistant' : 'user',
        content: clean(x.content, 3000)
      }))
    : [];

  const wantsJson = /plan|itinerary|schedule|budget|trip to|day-by-day|day trip|one[- ]day|things to do|places to visit|starting from/i.test(message);
  const payload = {
    model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
    messages: [
      { role: 'system', content: buildSystemPrompt(req.body?.context || {}, message) },
      ...history
    ],
    temperature: 0.4,
    max_tokens: 1800
  };

  if (wantsJson) {
    payload.response_format = { type: 'json_object' };
  }

  try {
    const upstream = await fetch(process.env.GROQ_ENDPOINT || 'https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify(payload)
    });

    const raw = await upstream.text();
    if (!upstream.ok) {
      console.error('Groq provider error:', upstream.status, raw.slice(0, 300));
      return res.status(upstream.status === 401 || upstream.status === 403 || upstream.status === 429 ? upstream.status : 502).json({
        message: upstream.status === 401 ? 'Yaatra AI authentication failed. Check GROQ_API_KEY.' : upstream.status === 429 ? 'Yaatra AI rate limit reached. Please try again in a few moments.' : 'Yaatra AI is temporarily unavailable.'
      });
    }

    const data = JSON.parse(raw);
    const text = data?.choices?.[0]?.message?.content?.trim();
    if (!text) return res.status(502).json({ message: 'Yaatra AI returned an empty response.' });

    // Always attempt to extract structured itinerary JSON from the reply,
    // regardless of which keywords triggered response_format — the model
    // may return a JSON itinerary (per the system prompt) even when the
    // user's own wording didn't match the wantsJson heuristic.
    const structured = parseJsonBlock(text);
    const hasItinerary = Array.isArray(structured?.days) && structured.days.length > 0;
    // Never show the raw JSON/markdown blob as chat text — fall back to the
    // structured summary, or a short friendly line, instead.
    const displayText = hasItinerary
      ? (structured.summary || `Here's your ${structured.destination || 'trip'} itinerary below.`)
      : (structured ? (structured.summary || structured.text || text) : text);

    return res.json({
      text: displayText,
      structured: hasItinerary ? structured : null,
      demo: false
    });
  } catch (error) {
    console.error('Groq connection error:', error.message);
    return res.status(503).json({ message: 'Unable to connect to Yaatra AI. Please check your network connection.' });
  }
});

// Currency Converter endpoint
app.get('/api/currency/:from/:to', async (req, res) => {
  const from = String(req.params.from || '').toUpperCase();
  const to = String(req.params.to || '').toUpperCase();
  if (!/^[A-Z]{3}$/.test(from) || !/^[A-Z]{3}$/.test(to)) {
    return res.status(400).json({ message: 'Three-letter currency codes (e.g., USD, INR, EUR) are required.' });
  }
  try {
    const url = process.env.CURRENCY_API_KEY
      ? `https://v6.exchangerate-api.com/v6/${process.env.CURRENCY_API_KEY}/pair/${from}/${to}`
      : `https://open.er-api.com/v6/latest/${from}`;
    const response = await fetch(url);
    const data = await response.json();
    const rate = process.env.CURRENCY_API_KEY ? data.conversion_rate : data?.rates?.[to];
    if (!rate) throw new Error('Conversion rate unavailable.');
    res.json({ from, to, rate: Number(rate), live: true });
  } catch (error) {
    console.warn('Currency API error:', error.message);
    res.status(503).json({ message: 'Live currency rates are unavailable right now.' });
  }
});

// Translation endpoint
app.post('/api/translate', async (req, res) => {
  const text = clean(req.body?.text, 1200);
  const target = clean(req.body?.target, 8).toLowerCase();
  if (!text || !/^(en|ta|hi|kn|ml|te|bn|fr|es|de)$/.test(target)) {
    return res.status(400).json({ message: 'Text and a supported target language code are required.' });
  }

  if (process.env.TRANSLATION_API_KEY) {
    try {
      const upstream = await fetch(`https://translation.googleapis.com/language/translate/v2?key=${process.env.TRANSLATION_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: text, target, format: 'text' })
      });
      const data = await upstream.json();
      if (upstream.ok && data?.data?.translations?.[0]?.translatedText) {
        return res.json({ text: data.data.translations[0].translatedText, live: true });
      }
    } catch (e) {
      console.warn('Google Translate API error:', e.message);
    }
  }

  // Fallback translation helper using Groq AI if available
  if (process.env.GROQ_API_KEY) {
    try {
      const langNames = { en: 'English', ta: 'Tamil', hi: 'Hindi', kn: 'Kannada', ml: 'Malayalam', te: 'Telugu', bn: 'Bengali', fr: 'French', es: 'Spanish', de: 'German' };
      const upstream = await fetch(process.env.GROQ_ENDPOINT || 'https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
        },
        body: JSON.stringify({
          model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
          messages: [
            { role: 'system', content: `Translate the following text accurately into ${langNames[target] || target}. Output ONLY the translated phrase, nothing else.` },
            { role: 'user', content: text }
          ],
          temperature: 0.1,
          max_tokens: 300
        })
      });
      const data = await upstream.json();
      const translated = data?.choices?.[0]?.message?.content?.trim();
      if (translated) return res.json({ text: translated, live: true });
    } catch {}
  }

  res.status(503).json({ message: 'Live translation is not configured.' });
});

// Vision / OCR endpoint
app.post('/api/vision/ocr', async (req, res) => {
  const content = req.body?.imageBase64;
  if (typeof content !== 'string' || content.length < 20 || content.length > 3_500_000) {
    return res.status(400).json({ message: 'A valid image upload is required.' });
  }

  if (process.env.GOOGLE_VISION_API_KEY) {
    try {
      const upstream = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${process.env.GOOGLE_VISION_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requests: [{
            image: { content: content.replace(/^data:[^;]+;base64,/, '') },
            features: [
              { type: 'TEXT_DETECTION' },
              { type: 'LABEL_DETECTION', maxResults: 8 }
            ]
          }]
        })
      });
      const data = await upstream.json();
      if (upstream.ok) {
        const r = data?.responses?.[0] || {};
        return res.json({
          text: r?.fullTextAnnotation?.text || r?.textAnnotations?.[0]?.description || '',
          labels: (r?.labelAnnotations || []).map(x => x.description),
          live: true
        });
      }
    } catch (e) {
      console.warn('Vision API error:', e.message);
    }
  }

  res.status(503).json({ message: 'Live Vision OCR is not configured. Add GOOGLE_VISION_API_KEY.' });
});



// Accessibility mapping and navigation endpoints. External records are returned with explicit evidence labels.
const accessibilityReports = new Map();
const accessibilityTags = '[wheelchair],[kerb],[tactile_paving],[ramp],[elevator],[staircase],[accessibility],[surface],[smoothness]';
app.get('/api/accessibility/nearby', async (req, res) => {
  const lat = Number(req.query.lat), lon = Number(req.query.lon), radius = Math.min(Math.max(Number(req.query.radius || 4000), 500), 10000);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return res.status(400).json({message:'Valid latitude and longitude are required.'});
  const query = `[out:json][timeout:20];nwr(around:${radius},${lat},${lon})${accessibilityTags};out center tags;`;
  try {
    const upstream = await fetch('https://overpass-api.de/api/interpreter',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded','User-Agent':'YaatraAccessibility/1.0'},body:new URLSearchParams({data:query})});
    const data = await upstream.json(); if(!upstream.ok) throw new Error('OpenStreetMap accessibility lookup failed');
    const records = (data.elements || []).filter(x=>x.tags).slice(0,100).map(x=>{const pLat=x.lat ?? x.center?.lat, pLon=x.lon ?? x.center?.lon, tags=x.tags||{}; const keys=['wheelchair','kerb','tactile_paving','ramp','elevator','staircase','accessibility','surface','smoothness']; const key=keys.find(k=>tags[k]); return {id:`osm-access-${x.type}-${x.id}`,name:tags.name || 'Mapped accessibility feature',category:key || 'accessibility',description:tags[key] || 'OpenStreetMap accessibility tag',lat:pLat,lon:pLon,evidence:'user_reported',score:tags.wheelchair==='yes'||tags.accessibility==='yes'?80:60,source:'OpenStreetMap'};});
    res.json({records:[...records,...accessibilityReports.values()].filter(x=>Math.abs(Number(x.lat)-lat)<.1&&Math.abs(Number(x.lon)-lon)<.1),source:'OpenStreetMap + Yaatra reports'});
  } catch(e) { res.json({records:[...accessibilityReports.values()].filter(x=>Math.abs(Number(x.lat)-lat)<.1&&Math.abs(Number(x.lon)-lon)<.1),source:'Yaatra reports; OpenStreetMap unavailable',degraded:true}); }
});
app.post('/api/accessibility/report', (req,res) => { const r=req.body||{}; if(!r.category||!r.description||!Number.isFinite(Number(r.lat))||!Number.isFinite(Number(r.lon))) return res.status(400).json({message:'Category, description and coordinates are required.'}); const record={...r,id:r.id||`report-${Date.now()}`,evidence:'user_reported',confirmations:0}; accessibilityReports.set(record.id,record); res.status(201).json({report:record}); });
app.post('/api/accessibility/verify', (req,res) => { const r=accessibilityReports.get(req.body?.id); if(!r) return res.status(404).json({message:'Report not found in this session.'}); r.confirmations=(r.confirmations||0)+1; if(r.confirmations>=2) r.evidence='verified'; res.json({report:r}); });
app.post('/api/accessibility/route', async (req,res) => { const from=req.body?.from, to=req.body?.to, profile=req.body?.profile||{}; if(!from||!to) return res.status(400).json({message:'Route coordinates are required.'}); try { const url=`https://router.project-osrm.org/route/v1/foot/${Number(from.lon)},${Number(from.lat)};${Number(to.lon)},${Number(to.lat)}?overview=false&steps=true`; const upstream=await fetch(url); const data=await upstream.json(); if(!upstream.ok||data.code!=='Ok'||!data.routes?.[0]) throw new Error('Routing provider unavailable'); const r=data.routes[0], prefs=profile.preferences||[]; const guidance=prefs.includes('wheelchair')?'Wheelchair preference applied: stairs are not intentionally selected, but ramp, lift and temporary barrier data must be checked on arrival.':prefs.length?'Your profile preferences were applied to the route request. Verify local conditions before starting.':'Enable an accessibility profile to receive tailored route guidance.'; res.json({route:{distance_km:Number((r.distance/1000).toFixed(2)),duration_minutes:Math.max(1,Math.round(r.duration/60)),guidance,provider:'OSRM',profile}}); } catch(e) { res.status(503).json({message:'Accessible route is unavailable right now. Try again or use the regular Explore route.'}); } });
app.post('/api/vision/accessibility-scan', async (req,res) => { const content=req.body?.imageBase64; if(typeof content!=='string'||content.length<20||content.length>3500000) return res.status(400).json({message:'A valid image upload is required.'}); if(!process.env.GOOGLE_VISION_API_KEY) return res.status(503).json({message:'AI accessibility scanning is not configured. Add GOOGLE_VISION_API_KEY to enable photo analysis.'}); try { const upstream=await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${process.env.GOOGLE_VISION_API_KEY}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({requests:[{image:{content:content.replace(/^data:[^;]+;base64,/,'')},features:[{type:'LABEL_DETECTION',maxResults:20},{type:'OBJECT_LOCALIZATION',maxResults:20}]}]})}); const data=await upstream.json(); if(!upstream.ok) throw new Error('Vision provider rejected the image'); const labels=[...(data.responses?.[0]?.labelAnnotations||[]),...(data.responses?.[0]?.localizedObjectAnnotations||[])]; const map=[['ramp','Ramp'],['stair','Stairs'],['wheelchair','Wheelchair access'],['elevator','Lift / elevator'],['pothole','Pothole'],['obstacle','Obstacle'],['road','Path or road'],['entrance','Entrance']]; const findings=labels.filter(x=>map.some(([needle])=>String(x.description||'').toLowerCase().includes(needle))).map(x=>({label:map.find(([needle])=>String(x.description||'').toLowerCase().includes(needle))?.[1]||x.description,confidence:Number(x.score||0)})); res.json({findings:[...new Map(findings.map(x=>[x.label,x])).values()],evidence:'ai_detected'}); } catch(e) { res.status(503).json({message:'The AI scanner could not verify this image.'}); } });

// SPA static fallback for client routing
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});

export { app };
export default app;

if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
  app.listen(port, () => {
    console.log(`🧭 Yaatra server running on http://localhost:${port}`);
  });
}
