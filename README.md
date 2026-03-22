# 📈 Chartink Multi-Scan Tracker — Google Apps Script

> Fully automated NSE stock screener built on Google Sheets + Apps Script.
> Runs 6 Chartink scans every 10 minutes during market hours, enriches results
> with Yahoo Finance technicals, and surfaces GOD MODE stocks that appear across
> all three timeframes (Daily + Weekly + Monthly).

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [File Structure](#file-structure)
4. [Sheets Layout](#sheets-layout)
5. [Quick Start](#quick-start)
6. [Configuration Reference](#configuration-reference)
7. [Scan Definitions](#scan-definitions)
8. [Trigger System](#trigger-system)
9. [Chartink API — How It Works](#chartink-api--how-it-works)
10. [Yahoo Finance Integration](#yahoo-finance-integration)
11. [Column Reference](#column-reference)
12. [GOD MODE Logic](#god-mode-logic)
13. [Email Alerts](#email-alerts)
14. [Signal Profiles](#signal-profiles)
15. [Rate Limiting & Retry Logic](#rate-limiting--retry-logic)
16. [Version History](#version-history)
17. [Troubleshooting](#troubleshooting)
18. [FAQ](#faq)

---

## Overview

This tool automates the entire workflow of:

1. Hitting Chartink's screener API with 6 custom scan clauses
2. De-duplicating results and tracking first-capture vs current status
3. Fetching 3 years of daily OHLCV from Yahoo Finance for every matched stock
4. Computing RSI(14), ADX(14), MACD(12,26,9), EMA stack, volume ratio, 52W distance,
   20-day breakout percentage — all in-script without any paid data provider
5. Assigning one of 13 signal tiers (from 🚀 BREAKOUT BUY to 🔴 SELL)
6. Writing a timestamped snapshot to Price History for trend tracking
7. Sending email alerts when GOD MODE stocks appear or new stocks are captured

The entire system runs on a **fixed recurring GAS trigger** — no server, no cron job,
no paid infrastructure. Total running cost: ₹0.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│              Google Cloud (Apps Script Runtime)             │
│                                                             │
│  ⏰ Time Trigger (every 10 min)                             │
│       │                                                     │
│       ▼                                                     │
│  runAllScans()                                              │
│       │                                                     │
│       ├── Schedule Guard (weekday? 9:15–15:30 IST?)         │
│       │       └── NO  → silent skip, return                 │
│       │       └── YES → continue                            │
│       │                                                     │
│       └── _doRun("AUTO")                                    │
│               │                                             │
│               ├── fetchChartinkSession()  ──► chartink.com  │
│               │       └── GET /screener/ → XSRF token       │
│               │                                             │
│               ├── callChartinkScan() × 6  ──► chartink.com  │
│               │       └── POST /screener/process            │
│               │           (with retry + session refresh)    │
│               │                                             │
│               ├── fetchYahooHistory() × N ──► yahoo.com     │
│               │       └── /v8/finance/chart/{sym}.NS        │
│               │           3-year daily OHLCV                │
│               │                                             │
│               ├── calcSignal() for each stock               │
│               │                                             │
│               ├── Write to scan tabs                        │
│               ├── Write to Price History                    │
│               ├── Write to GOD MODE sheet                   │
│               ├── Write to Dashboard                        │
│               └── sendEmailAlert() if needed                │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
              Google Sheets (your spreadsheet)
```

---

## File Structure

```
chartink_tracker_v5.gs       ← single-file Apps Script (paste into editor)
README.md                    ← this file
SignalView.md                ← signal engine deep-dive
```

Everything lives in one `.gs` file. No npm, no bundler, no dependencies.

---

## Sheets Layout

| Sheet Name | Tab Color | Purpose |
|---|---|---|
| 📊 Dashboard | — | Real-time summary: GOD MODE, High Conviction, all scan counts |
| ★ GOD MODE | — | Stocks appearing in both S5A and S5B simultaneously |
| 🗒️ Log | — | Timestamped execution log (last 500 entries) |
| 📈 Price History | — | Append-only snapshot log for trend tracking |
| S1 Ultra Daily | Green | Scan 1 results + full technicals |
| S2 Weekly EMA | Blue | Scan 2 results + full technicals |
| S3 52W Breakout | Yellow | Scan 3 results + full technicals |
| S4 ADX Supertrend | Purple | Scan 4 results + full technicals |
| S5A GOD DailyWeekly | Pink | Scan 5A results + full technicals |
| S5B GOD DailyMonthly | Cyan | Scan 5B results + full technicals |

### Per-Scan Sheet Columns (34 columns)

See [Column Reference](#column-reference) for full details.

---

## Quick Start

### Step 1 — Open Apps Script Editor

In your Google Sheet:
```
Extensions → Apps Script
```

### Step 2 — Paste the Script

- Select All (Ctrl+A) in the editor
- Delete everything
- Paste the full contents of `chartink_tracker_v5.gs`
- Save (Ctrl+S)

### Step 3 — Set Your Email

In CONFIG at the top of the file:
```javascript
ALERT_EMAIL: "your@gmail.com",
```

### Step 4 — Setup Sheets

Reload your Google Sheet, then:
```
📈 Scanner → ⚙️ Setup All Sheets
```
This creates all 10 tabs with correct headers and formatting.

### Step 5 — Test the Connection

```
📈 Scanner → 🧪 Test All Scans (No Schedule)
```
This runs all 6 Chartink scans + Yahoo Finance fetch bypassing market hours check.
Verify all 6 scans return data (no ❌ errors).

### Step 6 — Install the Trigger (ONCE ONLY)

```
📈 Scanner → 📌 Install Recurring Trigger
```

This installs a permanent every-10-minute trigger in Google's cloud.
**You never need to do this again.**

### Step 7 — Verify

Open Apps Script editor → left sidebar → ⏰ Triggers icon.
You should see:
```
runAllScans | Time-driven | Every 10 minutes
```

**Done.** From tomorrow (Mon–Fri), the scanner runs automatically from 9:15 AM to 3:30 PM IST.

---

## Configuration Reference

All settings are in the `CONFIG` object at the top of the script.

### Market Hours

```javascript
MARKET_START_HOUR:   9,
MARKET_START_MINUTE: 15,   // NSE opens 9:15 AM IST
MARKET_END_HOUR:    15,
MARKET_END_MINUTE:  30,    // Safe cutoff before 3:30 PM close
```

### Trigger Interval

```javascript
TRIGGER_INTERVAL_MINUTES: 10,
// Valid GAS values: 1, 5, 10, 15, 30
// 10 minutes = 39 runs on a full trading day
```

### Active Date Ranges (Optional)

```javascript
ACTIVE_DATE_RANGES: [],
// [] = normal Mon–Fri mode (recommended)

// To restrict to specific dates only:
ACTIVE_DATE_RANGES: [
  { from: "2026-04-01", to: "2026-04-30" },  // April only
]
```

### Chartink Rate-Limit Settings

```javascript
SCAN_SLEEP_MS:         3000,  // sleep between each scan (ms)
SCAN_RETRY_MAX:        3,     // max retry attempts per scan
SCAN_RETRY_BASE_MS:    3000,  // backoff: 3s → 6s → 12s
SCAN_JITTER_MS:        500,   // ±500ms random jitter
SESSION_REFRESH_EVERY: 3,     // refresh XSRF token every N scans
```

### Performance Limits

```javascript
MAX_RUN_MS:   5 * 60 * 1000,  // 5 min hard timeout (GAS limit is 6 min)
MAX_LOG_ROWS: 500,             // auto-truncates old log entries
```

### Yahoo Finance

```javascript
YF_SUFFIX: ".NS",   // NSE suffix; .BO tried as fallback for BSE stocks
```

---

## Scan Definitions

### S1 — Ultra Daily Momentum

**What it finds:** Stocks in a perfect EMA stack (10 > 20 > 50 > 200) on daily timeframe
with RSI in the 57–68 sweet spot, MACD bullish, volume spike 1.5× average,
and price above the prior day's high.

**Best for:** Intraday momentum, breakout entries on the day

**Key filters:**
- EMA 10 > EMA 20 > EMA 50 > EMA 200
- RSI(14) between 57 and 68
- MACD line > MACD signal AND MACD line > 0
- Volume > 1.5× 20-day avg volume
- Close > prior day high
- Price > ₹100

---

### S2 — Weekly EMA Alignment

**What it finds:** Stocks where BOTH weekly AND daily EMA stacks are aligned bullishly,
RSI in bullish zone on both timeframes, MACD positive on weekly.

**Best for:** Swing trades (3–15 day holds), higher-quality setups

**Key filters:**
- Weekly: EMA 10 > 20 > 50, RSI 55–70, MACD bullish
- Daily: EMA 20 > 50 > 200, RSI 55–70
- Volume > 1.3× average
- Price > ₹100

---

### S3 — 52-Week Breakout

**What it finds:** Stocks at or above their 52-week high with bullish trend
and exceptional volume (2× average). Pure breakout scan.

**Best for:** Trend-following, momentum continuation

**Key filters:**
- Close >= max(252-day high) — at or above 52W high
- EMA 20 > 50 > 200 (daily)
- RSI 55–75
- Volume > 2× average
- Weekly close > weekly EMA 20
- Price > ₹100

---

### S4 — ADX + Supertrend Confirmation

**What it finds:** Stocks where the Supertrend indicator is bullish AND ADX > 25
(strong trend), full EMA alignment on both daily + weekly.

**Best for:** Strong-trend entries with confirmation, avoids weak/choppy setups

**Key filters:**
- Close > Supertrend(10,3)
- ADX(14) > 25
- EMA 20 > 50 > 200 (daily)
- RSI 55–70
- MACD bullish + above zero
- Volume > 1.5×
- Weekly close > weekly EMA 20

---

### S5A — GOD MODE Daily + Weekly

**What it finds:** The strictest daily scan PLUS weekly confirmation.
Requires Supertrend bullish, ADX > 25, full EMA stack on BOTH timeframes,
RSI in tight 57–68 zone, price above prior day's high.

**Best for:** Highest-probability setups, positional trades

**Key filters:**
- All S4 filters +
- Close > prior day high (daily breakout)
- Weekly EMA 10 > 20 > 50
- Weekly RSI 55–70
- Weekly MACD bullish

---

### S5B — GOD MODE Daily + Monthly

**What it finds:** Daily EMA alignment confirmed by monthly timeframe —
monthly close above monthly EMA 10 AND 20.

**Best for:** Long-term entries with macro tailwind

**Key filters:**
- Daily EMA 20 > 50 > 200
- RSI 55–75
- MACD bullish
- Volume > average
- Monthly close > monthly EMA 10
- Monthly close > monthly EMA 20

---

### ★ GOD MODE = S5A ∩ S5B

Stocks that appear in **both** S5A AND S5B simultaneously.
Daily + Weekly + Monthly all aligned. Rarest and highest-conviction setup.

```javascript
const godMode = [...s5aSet].filter(s => s5bSet.has(s));
```

---

## Trigger System

### How the Trigger Works

```
installRecurringTrigger()
    │
    └── ScriptApp.newTrigger("runAllScans")
              .timeBased()
              .everyMinutes(10)
              .create();
              └── Stored in Google's cloud infrastructure
                  NOT in your script or spreadsheet
```

### Lifecycle of a Single Trigger Fire

```
Google fires runAllScans() at e.g. 10:30:00 AM IST
    │
    ├── getRunScheduleStatus()
    │       Weekend?        → return (done in < 1 sec)
    │       Before 9:15?   → return (done in < 1 sec)
    │       After 15:30?   → return (done in < 1 sec)
    │       ✅ In window    → continue
    │
    ├── ensureSystemSheets() — create any missing sheets
    │
    └── _doRun("AUTO")
            ├── ~43 seconds for 6 scans + Yahoo
            ├── writes to 6 scan tabs + Dashboard + GOD MODE + Log
            └── email if new stocks / GOD MODE found
```

### What Survives

| Scenario | Trigger survives? |
|---|---|
| Spreadsheet closed | ✅ Yes |
| Browser closed | ✅ Yes |
| Laptop off | ✅ Yes |
| Script runtime error | ✅ Yes — next fire starts fresh |
| 6-min GAS timeout | ✅ Yes — MAX_RUN_MS guard exits cleanly before limit |
| `stopAllTriggers()` called | ❌ No — re-run installRecurringTrigger() |
| GAS quota exceeded | ❌ Temporarily paused — resumes next day |

### GAS Daily Quotas (Free Account)

| Resource | Limit |
|---|---|
| Script runtime | 6 min/execution, 90 min/day |
| URL Fetch calls | 20,000/day |
| Email sends | 100/day |
| Trigger executions | Unlimited |

On a full trading day (39 runs × ~45s each) = ~29 minutes total. Well within limit.

---

## Chartink API — How It Works

Chartink uses Laravel's CSRF protection. Every POST to `/screener/process`
requires a valid XSRF token obtained from a prior GET to `/screener/`.

### Step 1 — Fetch Session (GET)

```
GET https://chartink.com/screener/
Response headers include:
  Set-Cookie: XSRF-TOKEN=eyJpdiI6....; Path=/; SameSite=Lax
  Set-Cookie: chartink_session=eyJpdiI6...; HttpOnly
```

The script extracts both cookies and the decoded XSRF token value.

### Step 2 — POST Scan

```
POST https://chartink.com/screener/process
Headers:
  X-XSRF-TOKEN: <decoded token>
  Cookie: XSRF-TOKEN=<encoded>; chartink_session=<session>
  X-Requested-With: XMLHttpRequest
  Content-Type: application/x-www-form-urlencoded
Body:
  scan_clause=( {cash} ( ... ) )
```

Response:
```json
{
  "data": [
    { "nsecode": "RELIANCE", "name": "Reliance Industries", "close": "1250.5", "per_chg": "1.2", "volume": "5000000" },
    ...
  ]
}
```

### Why No Login Required

All scan clauses use `{cash}` universe which is publicly accessible.
The XSRF token is **anti-CSRF protection, not authentication**.
No Chartink account needed.

### Token Expiry

The XSRF token is valid for the duration of a session (~60 seconds of inactivity).
v5 mitigates this by:
- Refreshing the session every 3 scans proactively
- Refreshing before each retry attempt if a scan fails

---

## Yahoo Finance Integration

For each stock symbol, the script fetches 3 years of daily OHLCV data.

### Endpoint

```
https://query2.finance.yahoo.com/v8/finance/chart/{SYMBOL}.NS?range=3y&interval=1d
```

Falls back to `query1.finance.yahoo.com` and `.BO` suffix for BSE stocks.

### What's Computed Locally

All technical indicators are calculated from raw price/volume arrays in pure JavaScript.
No TA-Lib, no paid API.

| Indicator | Periods | Function |
|---|---|---|
| Moving Average | 20, 50, 200 | `calcMA()` |
| RSI | 14 | `calcRSI()` — Wilder's smoothing |
| EMA | Any | `calcEMA()` — standard exponential |
| MACD | 12, 26, 9 | `calcMACD()` |
| ADX | 14 | `calcADX()` — Wilder's smoothing with +DI/-DI |
| Volume Ratio | 20-day avg | `calcVolumeRatio()` |
| 52W High Distance | 252 days | `calcDistanceFromHigh()` |
| 20D Breakout % | 20 days | `calcBreakoutPct()` |
| Return periods | 1D/1W/1M/3M/6M/1Y/2Y/3Y | `periodReturn()` |
| Avg returns | Weekly/Monthly/3M/6M/1Y | `avgPeriodReturn()` |

### Live Session Volume Handling

During market hours (9:15–15:30), Yahoo returns the **current day's partial volume**
which would skew the volume ratio. The script detects this and uses the prior day's
volume for the ratio calculation:

```javascript
if (live && rows[ci].ts) {
  const latestDate  = new Date(rows[ci].ts * 1000).toLocaleDateString("en-IN", ...);
  const todayDate   = new Date().toLocaleDateString("en-IN", ...);
  if (latestDate === todayDate) ci--;  // use yesterday's volume
}
```

---

## Column Reference

Each scan sheet has 34 columns (A through AH):

| # | Column | Description |
|---|---|---|
| A | Symbol | NSE ticker (e.g. RELIANCE) |
| B | Name | Full company name |
| C | First Captured | Date/time first seen in this scan |
| D | Last Seen | Date/time last seen in this scan |
| E | In Scan? | ✅ = in today's scan, ⬜ = not today |
| F | Capture Price ₹ | Price when first captured |
| G | Current Price ₹ | Latest close from Yahoo Finance |
| H | Since Capture % | Return from capture price to now |
| I | 1D % | 1-day return |
| J | 1W % | 5-day return |
| K | 1M % | 21-day return |
| L | 3M % | 63-day return |
| M | 6M % | 126-day return |
| N | 1Y % | 252-day return |
| O | 2Y % | 504-day return |
| P | 3Y % | 756-day return |
| Q | Avg Weekly % | Average weekly return (52 weeks) |
| R | Avg Monthly % | Average monthly return (24 months) |
| S | Avg 3M % | Average 3-month return |
| T | Avg 6M % | Average 6-month return |
| U | Avg 1Y % | Average annual return |
| V | RSI(14) | Relative Strength Index, 14 period |
| W | MA20 | 20-day simple moving average |
| X | MA50 | 50-day simple moving average |
| Y | MA200 | 200-day simple moving average |
| Z | Signal | One of 13 signal tiers (see SignalView.md) |
| AA | Last Updated | Timestamp of last Yahoo fetch |
| AB | ADX(14) | Average Directional Index |
| AC | Vol Ratio(20) | Current vol ÷ 20-day avg vol |
| AD | MACD Line | MACD line value (EMA12 − EMA26) |
| AE | MACD Hist | Histogram (MACD line − signal line) |
| AF | 52W High Dist % | % below 52-week high |
| AG | 20D Breakout % | % above 20-day high (negative = below) |
| AH | Scans Matched | How many of 6 scans this stock appears in |

### Conditional Formatting

- **Return columns (H–U, AG):** Green background for positive, red for negative
- **Signal column (Z):** Color-coded by tier (see SignalView.md)
- **New entries:** Yellow background (clears after first Yahoo update)

---

## GOD MODE Logic

```javascript
// S5A = stocks passing Daily + Weekly alignment
// S5B = stocks passing Daily + Monthly alignment
// GOD MODE = intersection of both

const s5aSet  = new Set(allResults["S5A GOD DailyWeekly"].map(s => s.nsecode));
const s5bSet  = new Set(allResults["S5B GOD DailyMonthly"].map(s => s.nsecode));
const godMode = [...s5aSet].filter(s => s5bSet.has(s));
```

A GOD MODE stock has confirmed bullish alignment on **three timeframes simultaneously**:
- Daily (via both S5A and S5B)
- Weekly (via S5A)
- Monthly (via S5B)

These are the highest-quality setups produced by the system.
The GOD MODE sheet and Dashboard section are updated every run.

---

## Email Alerts

An email is sent when running in AUTO mode (trigger-fired, not TEST) if either:
- One or more GOD MODE stocks are found
- New stocks are added to any scan sheet

### Sample Subject
```
📈 Chartink: 2 GOD MODE | 5 High Conviction [23-Mar-2026 10:20:15]
```

### Sample Body
```
CHARTINK SCREENER ALERT
23-Mar-2026 10:20:15

★ GOD MODE:
CENTUM
COALINDIA

HIGH CONVICTION:
CENTUM(5/6), COALINDIA(4/6), POWERINDIA(3/6)

NEW STOCKS:
S1 Ultra Daily: ACUTAAS, SBIN
S4 ADX Supertrend: CENTUM

Open your sheet for full details.
```

---

## Signal Profiles

Three profiles control how aggressively signals are assigned.
Switch via the Scanner menu.

| Profile | ADX Strong | RSI Bullish Min | Vol Ratio | Best For |
|---|---|---|---|---|
| Conservative | 25 | 55 | 1.5× | Lower risk, fewer signals |
| Balanced | 20 | 52 | 1.25× | Default — recommended |
| Aggressive | 18 | 50 | 1.1× | More signals, higher noise |

See **SignalView.md** for the complete 13-tier signal logic.

---

## Rate Limiting & Retry Logic

Chartink blocks requests after ~3 rapid POSTs with the same token.

### v5 Three-Layer Defence

**Layer 1 — Base sleep**
```
3000ms between every scan (was 1500ms in v3)
```

**Layer 2 — Proactive token refresh**
```
Every 3rd scan → GET /screener/ → fresh XSRF token
Prevents token aging out mid-run
```

**Layer 3 — Retry with exponential backoff**
```
Attempt 1 fails → wait 3s  + refresh token → retry
Attempt 2 fails → wait 6s  + refresh token → retry
Attempt 3 fails → wait 12s + refresh token → retry
All 3 fail      → log ❌ and move on to next scan
```

**Jitter** (±500ms random) is added to every sleep to avoid thundering herd
if multiple runs overlap near the boundary.

---

## Version History

| Version | Key Changes |
|---|---|
| v1 | Initial release — basic Chartink fetch + sheet write |
| v2 | Weekend guard in trigger, `_doRun()` shared core |
| v3 | `getUi()` try/catch everywhere — fixed editor Run crashes |
| v4 | Rate-limit fix: 3s sleep, retry logic, session refresh every 3 scans |
| v5 | **Permanent recurring trigger** (`everyMinutes(10)`), `installRecurringTrigger()`, `showTriggerStatus()`, removed fragile one-shot chain |

---

## Troubleshooting

### ❌ "Address unavailable" on S4/S5A/S5B

**Cause:** Chartink rate-limiting — token stale after 3 scans.
**Fix:** v5 handles this automatically. If still happening, increase `SCAN_SLEEP_MS` to 4000.

### ❌ "XSRF token not found"

**Cause:** Chartink changed their cookie structure, or the GET request was blocked.
**Fix:** Run `testRunAllScans()` to see detailed error. Try increasing `Utilities.sleep()` at session fetch.

### ⚠️ "No Data" signal for some stocks

**Cause:** Yahoo Finance doesn't have data for that symbol (delisted, BSE-only, etc.)
**Fix:** Normal — the script logs it and moves on. BSE stocks auto-retry with `.BO` suffix.

### ⏱️ Run times out before all stocks updated

**Cause:** Too many stocks across scans; Yahoo is slow.
**Fix:** The 5-minute guard exits cleanly. Remaining stocks update on the next 10-min run.

### 📋 Trigger not firing

**Cause:** Trigger was deleted (manually or via `stopAllTriggers()`).
**Fix:** Scanner → 📌 Install Recurring Trigger

### 📧 No email received

**Cause:** 1) `ALERT_EMAIL` not set, 2) Only fires when new stocks or GOD MODE found, 3) Gmail spam folder.
**Fix:** Check Config, check spam, verify by running a test during market hours.

---

## FAQ

**Q: Do I need a Chartink account?**
A: No. All scans use the public `{cash}` universe. No login required.

**Q: Does it trade automatically?**
A: No. It only reads and displays data. All trade decisions are manual.

**Q: What happens on market holidays?**
A: Chartink returns 0 results (or stale data). The script runs but writes 0 stocks — no harm done. Add dates to `ACTIVE_DATE_RANGES` to skip holidays explicitly.

**Q: Can I add my own scans?**
A: Yes. Add to the `SCANS` object in CONFIG with any valid Chartink scan clause.

**Q: Can I change the scan interval to 5 minutes?**
A: Yes. Set `TRIGGER_INTERVAL_MINUTES: 5`, stop the old trigger, reinstall.

**Q: Why does Price History grow large?**
A: Every run appends a row per stock per scan (~50–100 rows/run). After 1 month of trading days = ~80,000 rows. Use `clearPriceHistory()` periodically or add a date-based cleanup.

**Q: GOD MODE shows "None today" every day — is that normal?**
A: Yes. GOD MODE requires perfect 3-timeframe alignment which is rare. Expect 0–5 stocks on most days.
