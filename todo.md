# Meta Ads Cyberpunk Dashboard - TODO

## Foundation
- [x] Cyberpunk theme (index.css): dark bg #0A0A1A, neon pink + electric blue, Orbitron + Space Grotesk fonts, neon glow
- [x] Database schema (all tables in Drizzle)
- [x] Apply migration SQL
- [x] DashboardLayout sidebar with all nav items + cyberpunk style
- [x] App.tsx routes wiring

## Backend - Core
- [x] metaAdsService.ts (Meta Graph API calls: insights, breakdowns, region, hourly, age/gender, device, creative)
- [x] db.ts helpers for all tables (incl. cache tables)
- [x] Meta API error parser (token expiry codes)
- [x] tRPC router: token management (save, test, history, revoke)
- [x] tRPC router: dashboard (syncLive, getOverview, % change vs previous period)
- [x] tRPC router: campaigns (list, detail, adsets, ads)
- [x] tRPC router: ads table (evaluateAds, signal lights, benchmarks)

## Backend - AI
- [x] aiAds.recommendToClose (LLM analyze ads to close/monitor/keep)
- [x] aiAds.analyzeForNewCreative + analyzeForNewCampaign
- [x] aiAds.generateAdImage (image gen from reference)
- [x] aiAds.uploadProductImage (S3)
- [x] aiAds.saveDraft / getDrafts / deleteDraft
- [x] AI Recommendations router (overall analysis Thai markdown)

## Backend - Analytics
- [x] geoRouter (getRegionInsights + aiAnalyze)
- [x] creativeRouter (getCreativeInsights with video retention)
- [x] audienceRouter (age/gender, device, region + AI)
- [x] daypartingRouter (hourly insights 7x24 + schedules CRUD + AI)
- [x] audienceQualityRouter (quality score, buyers vs chatters, funnel + AI)
- [x] abTestRouter (compare 2 ads/campaigns + AI winner + history)

## Backend - Tools & Automation
- [x] breakeven router (cost items CRUD + calc)
- [x] weeklyReportRouter (generate + history + manual trigger)
- [x] autoPauseRouter (rules CRUD + logs)
- [x] scheduleRouter (settings + job logs)
- [x] Heartbeat cron handlers (/api/scheduled/*)

## Frontend - Pages
- [x] DashboardPage (KPI cards, trend charts, date preset, sync, % change)
- [x] TokenManagementPage (Settings)
- [x] CampaignsPage (3-level table + signal + bulk pause/resume)
- [x] AdsEvaluationPage (thumbnails, signal lights, benchmark, AI recommend)
- [x] AIRecommendationsPage (AiInsights)
- [x] BreakevenPage
- [x] AiCreatorPage (AI ad creator) + AiDraftsPage
- [x] AbTestPage (with PDF export)
- [x] Automation Page (weekly report + auto-pause + schedule + logs)
- [x] GeoHeatmapPage (Thailand map)
- [x] CreativePerformancePage
- [x] AudienceInsightsPage
- [x] DaypartingPage (7x24 heatmap + schedule editor)
- [x] AudienceQualityPage

## Components
- [x] ThailandMap.tsx (SVG choropleth heatmap)
- [x] KpiCard, SignalLight, shared cyber components (cyber.tsx, AiPanel.tsx)

## Testing & Delivery
- [x] Vitest tests for key logic (metrics, breakeven, z-test) - 20/20 pass
- [x] Build check (tsc + vite build) - pass
- [x] Dev server running, OAuth flow verified
- [x] AbTest PDF export (jspdf + autotable)
- [ ] Checkpoint + deliver
