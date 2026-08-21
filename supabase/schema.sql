-- =====================================================================
-- YAATRA TRAVEL APP — SUPABASE DATABASE SCHEMA
-- Execute this script in your Supabase Project SQL Editor
-- (https://supabase.com/dashboard/project/_/sql)
-- =====================================================================

-- 1. Create PROFILES table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  name TEXT,
  avatar_url TEXT,
  home_location TEXT DEFAULT 'Coimbatore',
  preferences JSONB DEFAULT '{"interests": ["Nature", "Food"], "budgetStyle": "Comfort", "travelStyle": "Relaxed"}'::JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create TRIPS table
CREATE TABLE IF NOT EXISTS public.trips (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trip_name TEXT NOT NULL,
  destination TEXT NOT NULL,
  start_location TEXT DEFAULT 'Coimbatore',
  start_date TEXT,
  end_date TEXT,
  travelers INTEGER DEFAULT 2,
  budget NUMERIC DEFAULT 15000,
  interests TEXT,
  accommodation TEXT DEFAULT 'Comfort',
  transport TEXT DEFAULT 'Car',
  itinerary JSONB DEFAULT '[]'::JSONB,
  budget_breakdown JSONB DEFAULT '{}'::JSONB,
  route JSONB,
  source TEXT DEFAULT 'yaatra',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Create EXPENSES table
CREATE TABLE IF NOT EXISTS public.expenses (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  trip_id TEXT NOT NULL,
  category TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Create FAVOURITES table
CREATE TABLE IF NOT EXISTS public.favourites (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  place_id TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT,
  category TEXT,
  price NUMERIC DEFAULT 0,
  rating NUMERIC,
  distance NUMERIC,
  image TEXT,
  address TEXT,
  description TEXT,
  lat NUMERIC,
  lng NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security (RLS) on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favourites ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

DROP POLICY IF EXISTS "Users can view own trips" ON public.trips;
DROP POLICY IF EXISTS "Users can insert own trips" ON public.trips;
DROP POLICY IF EXISTS "Users can update own trips" ON public.trips;
DROP POLICY IF EXISTS "Users can delete own trips" ON public.trips;

DROP POLICY IF EXISTS "Users can view own expenses" ON public.expenses;
DROP POLICY IF EXISTS "Users can insert own expenses" ON public.expenses;
DROP POLICY IF EXISTS "Users can delete own expenses" ON public.expenses;

DROP POLICY IF EXISTS "Users can view own favourites" ON public.favourites;
DROP POLICY IF EXISTS "Users can insert own favourites" ON public.favourites;
DROP POLICY IF EXISTS "Users can delete own favourites" ON public.favourites;

-- RLS Policies for Profiles
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- RLS Policies for Trips
CREATE POLICY "Users can view own trips"
  ON public.trips FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own trips"
  ON public.trips FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own trips"
  ON public.trips FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own trips"
  ON public.trips FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for Expenses
CREATE POLICY "Users can view own expenses"
  ON public.expenses FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own expenses"
  ON public.expenses FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own expenses"
  ON public.expenses FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for Favourites
CREATE POLICY "Users can view own favourites"
  ON public.favourites FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own favourites"
  ON public.favourites FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own favourites"
  ON public.favourites FOR DELETE
  USING (auth.uid() = user_id);

-- Auto create profile on auth signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture', '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

CREATE INDEX IF NOT EXISTS trips_user_id_idx ON public.trips(user_id);
CREATE INDEX IF NOT EXISTS expenses_trip_id_idx ON public.expenses(trip_id);
CREATE INDEX IF NOT EXISTS expenses_user_id_idx ON public.expenses(user_id);
CREATE INDEX IF NOT EXISTS favourites_user_id_idx ON public.favourites(user_id);


-- Universal accessibility extension for Yaatra.
create table if not exists public.accessibility_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  preferences jsonb not null default '[]'::jsonb,
  custom_preferences text not null default '',
  updated_at timestamptz not null default now()
);
create table if not exists public.accessibility_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  place_name text,
  category text not null,
  description text not null,
  photo_url text,
  latitude double precision not null,
  longitude double precision not null,
  evidence text not null default 'user_reported',
  confirmations integer not null default 0,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists accessibility_reports_geo_idx on public.accessibility_reports(latitude, longitude);
create table if not exists public.accessibility_verifications (
  report_id uuid references public.accessibility_reports(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (report_id, user_id)
);
alter table public.accessibility_profiles enable row level security;
alter table public.accessibility_reports enable row level security;
alter table public.accessibility_verifications enable row level security;
drop policy if exists "Users manage own accessibility profile" on public.accessibility_profiles;
create policy "Users manage own accessibility profile" on public.accessibility_profiles for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Anyone can view accessibility reports" on public.accessibility_reports;
create policy "Anyone can view accessibility reports" on public.accessibility_reports for select using (true);
drop policy if exists "Signed in users can report accessibility" on public.accessibility_reports;
create policy "Signed in users can report accessibility" on public.accessibility_reports for insert with check (auth.uid() = user_id);
drop policy if exists "Users can verify accessibility reports" on public.accessibility_verifications;
create policy "Users can verify accessibility reports" on public.accessibility_verifications for insert with check (auth.uid() = user_id);
