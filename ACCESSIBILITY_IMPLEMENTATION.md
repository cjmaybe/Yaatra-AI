# Yaatra Accessibility Platform Upgrade

## Implemented

Yaatra was upgraded in place without removing its existing travel planning, maps, GPS, authentication, Supabase synchronization, AI assistant, OCR, tools, expenses, trips, and emergency flows.

The new accessibility hub adds profile preferences for wheelchair users, limited mobility, blind or low vision, elderly travellers, and custom needs. It adds an OpenStreetMap-backed accessibility map, session and Supabase-backed community reports, report verification/upvotes, evidence labels, accessible-place records, accessibility score fields, live OSRM walking route calculation with profile-aware guidance, photo reporting, and an optional Google Vision accessibility scanner. Accessibility requests are also recognized by Yaatra AI quick commands and the full AI prompt now receives the saved accessibility profile while enforcing an explicit no-invention policy.

## Evidence policy

The interface distinguishes `verified`, `user_reported`, `ai_detected`, and `unknown`. Provider failures degrade to known session reports and an explicit unavailable/unknown message rather than fabricated accessibility claims. Route output includes a live provider result plus a warning that ramps, lifts, stairs, construction, and temporary barriers still require verification at the destination.

## Supabase changes

The appended section of `supabase/schema.sql` adds `accessibility_profiles`, `accessibility_reports`, and `accessibility_verifications`, with indexes and row-level security policies. Signed-in profiles and reports synchronize through the existing Supabase session; guests use local storage and the in-process fallback.

## Verification completed

The upgraded server passed `node --check server.js`. Browser verification confirmed the existing Yaatra home and navigation plus the new Accessibility Map hub render together, and the browser console is free of accessibility-feature JavaScript errors. Smoke tests covered health, report validation, report creation, two-step verification promotion, OSRM wheelchair route calculation, AI-scanner unconfigured behavior, and graceful accessibility-map provider fallback.

## Optional configuration

Set `GOOGLE_VISION_API_KEY` to enable AI image analysis. Keep the existing `GROQ_API_KEY` configured to enable live Yaatra AI responses. Apply the appended Supabase SQL in the project SQL editor before enabling cloud-synced accessibility reports and profiles.
