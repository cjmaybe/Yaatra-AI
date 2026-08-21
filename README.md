# Yaatra — AI Travel Companion 🧭

Yaatra is a modern, fully functional, mobile-responsive travel application designed for exploring destinations, generating personalized day-by-day itineraries with AI, managing trips & budgets, and navigating real places with interactive maps.

Built for seamless deployment on **Vercel** with a high-performance **Supabase (PostgreSQL)** database and authentication backend.

---

## 🌟 Key Features

1. **🤖 Yaatra AI Travel Assistant & Itinerary Generator**
   - Interactive floating AI companion mascot with multi-turn chat powered by Groq LLaMA 3.3.
   - Structured day-by-day itinerary planner with budget breakdowns, route estimations, and driving times.
   - Dual-mode planning: 8-step wizard or natural-language conversational trip generation.

2. **📸 Real-Time Verified Image Engine (Google Maps & Places Fallbacks)**
   - Curated high-resolution travel photography for major Indian destinations, heritage sites, cuisines, stays, and vehicles.
   - Dynamic real-time image resolution via `/api/image` with automatic category fallback handlers preventing broken images.

3. **🗺️ Interactive Explore & Nearby Discovery**
   - Live Leaflet map with OpenStreetMap tiles and custom category pins (Food, Hotels, Sights, Healthcare, Transport).
   - Real-time GPS location detection (via Geolocation API & Nominatim reverse geocoding).
   - Turn-by-turn route calculations via OSRM with driving distance and time.
   - Instant filtering by category, distance, and price range.

4. **⚡ Supabase Database & Authentication**
   - Cloud synchronization for user profiles, saved itineraries, expenses, and favourite places.
   - Email/Password authentication, Google OAuth, and password reset flows.
   - Seamless dual-mode: automatic cloud sync when authenticated, graceful local storage fallback for offline and guest sessions.
   - Row-Level Security (RLS) policies protecting each user's private data.

5. **🧰 Smart Travel Toolkit**
   - **Live Weather Forecast**: Current temperatures, humidity, wind, and 5-day forecasts via Open-Meteo.
   - **Live Currency Converter**: Real-time conversion rates across INR, USD, EUR, GBP, AED, SGD, and AUD.
   - **Travel Translator & Phrasebook**: Instant phrase translations across English, Tamil, Hindi, Kannada, Malayalam, and Telugu.
   - **Lens OCR Scanner**: Camera snap and image upload for reading signs, menus, and landmark placards.
   - **Travel Calendar**: Visual month-view schedule plotting trips by day.
   - **Vehicle Rental Hub**: Rates and specifications for scooters, cruiser bikes, hatchbacks, SUVs, and tempo travellers.
   - **Expense Tracker**: Linked to trip budgets with real-time budget limit alerts and category breakdown.
   - **Emergency SOS Hub**: Quick dialing for 112 / 108, GPS location sharing, and 24/7 nearby emergency hospitals.

6. **📱 Fully Mobile-Responsive Design**
   - Fixed mobile bottom navigation (Home, Explore, Plan, Trips, Tools, Profile).
   - Touch-optimized controls, fast load times, and PWA manifest support.

---

## 🚀 Quick Start (Local Development)

### 1. Prerequisites
- Node.js (v18 or higher)
- npm

### 2. Installation
```bash
git clone <your-repo-url>
cd yaatra-complete
npm install
```

### 3. Environment Configuration
Copy the example environment file:
```bash
cp .env.example .env
```
Edit `.env` and configure your API keys:
```env
PORT=3000

# Supabase (Database & Authentication)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_key_here

# Groq AI (Yaatra AI Assistant)
GROQ_API_KEY=gsk_your_groq_api_key_here
GROQ_MODEL=llama-3.3-70b-versatile

# Google Maps / Vision API (Optional for Google Static Maps & Lens OCR)
GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here
GOOGLE_VISION_API_KEY=your_google_vision_api_key_here

# Currency Exchange (Optional)
CURRENCY_API_KEY=your_exchangerate_api_key_here
```

### 4. Database Setup (Supabase)
1. Log in to [Supabase Dashboard](https://supabase.com/dashboard) and create a new project.
2. Go to the **SQL Editor** in your Supabase dashboard.
3. Open `supabase/schema.sql` from this repository, copy its contents, paste them into the SQL Editor, and click **Run**.
4. Retrieve your **Project URL** and **Anon Key** from `Project Settings -> API` and paste them into your `.env` file.

### 5. Run the Server
```bash
npm start
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🌐 Deploying to Vercel

This repository is pre-configured with `vercel.json` and `@vercel/node` serverless routing.

### Step-by-Step Vercel Deployment:

1. **Push your repository to GitHub / GitLab / Bitbucket**.
2. **Import into Vercel**:
   - Go to [vercel.com/new](https://vercel.com/new).
   - Select your repository.
3. **Configure Environment Variables in Vercel**:
   Under **Project Settings -> Environment Variables**, add:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `GROQ_API_KEY`
   - `GOOGLE_MAPS_API_KEY` (Optional)
   - `GOOGLE_VISION_API_KEY` (Optional)
   - `CURRENCY_API_KEY` (Optional)
4. **Deploy**:
   - Click **Deploy**. Vercel will build and serve your static frontend and serverless API endpoints instantly.

---

## 📁 Project Structure

```
yaatra-complete/
├── api/
│   └── index.js             # Vercel Serverless Function entry point
├── frontend/
│   ├── index.html           # Main Single-Page Application (HTML5, Tailwind, Leaflet, Supabase)
│   ├── manifest.json        # PWA Web App Manifest
│   └── sw.js                # Offline Service Worker cache
├── supabase/
│   └── schema.sql           # Complete Supabase PostgreSQL DDL, RLS policies, and triggers
├── server.js                # Express backend with AI, Weather, Image, Currency & Translation APIs
├── vercel.json              # Vercel routing and serverless function configuration
├── package.json             # Node dependencies (@supabase/supabase-js, express, cors, dotenv)
├── .env.example             # Example environment template
└── README.md                # Documentation and setup guide
```

---

## 🛡️ Security & Privacy

- **Row-Level Security (RLS)**: Users can only view and modify their own trips, expenses, and favourites.
- **Server-Side API Key Protection**: Provider keys (`GROQ_API_KEY`, `GOOGLE_VISION_API_KEY`, etc.) remain safely protected on the backend server and are never exposed to the client.
- **Graceful Fallbacks**: If external third-party services are unreachable or unconfigured, the app falls back to offline dictionaries, local storage, and high-resolution photo fallbacks without disrupting the user experience.

## Universal Accessibility Upgrade

Yaatra now includes an integrated accessibility layer that preserves the existing travel planner, live map, authentication, tools, and AI companion. The new **Accessibility Map** combines OpenStreetMap accessibility tags with Yaatra community reports and clearly labels records as **Verified**, **User reported**, **AI detected**, or **Unknown**. When a provider is unavailable, the interface falls back to session reports and does not invent accessibility information.

The **Accessibility Profile** supports wheelchair users, limited mobility, blind or low-vision travellers, elderly travellers, and custom preferences. The profile is stored locally for guests and synchronized to Supabase for signed-in users. Accessible routing uses live geocoding and OSRM walking routes, then explains which profile preferences were applied and warns that temporary barriers and individual facility conditions still require verification.

The **AI Accessibility Scanner** accepts an uploaded or camera-captured image. When `GOOGLE_VISION_API_KEY` is configured, the server sends the image to Google Vision label/object detection and returns only matching accessibility findings with confidence values. Without that key, the product explicitly reports that scanning is unavailable rather than creating a result. Reports support a category, description, GPS location, optional photo metadata, and verification/upvotes; two session confirmations promote a report to `verified` in the demo fallback, while signed-in users can sync report and verification records to Supabase.

### Supabase migration

Run the appended section of `supabase/schema.sql` after the existing schema. It creates `accessibility_profiles`, `accessibility_reports`, and `accessibility_verifications` with row-level security. Existing Yaatra tables and policies are preserved.

### Optional AI scanning configuration

```env
GOOGLE_VISION_API_KEY=your_google_vision_api_key_here
```

The existing `GROQ_API_KEY` continues to power Yaatra AI. Accessibility profile context is now included in AI requests, and natural-language prompts such as “Find wheelchair accessible places near me” and “Give me a wheelchair-friendly route to the railway station” open the relevant integrated flows.