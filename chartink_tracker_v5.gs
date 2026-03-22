// =============================================================================
// CHARTINK MULTI-SCAN TRACKER — Google Apps Script v5.0
// =============================================================================
// CHANGES FROM v4:
//  [NEW] installRecurringTrigger() — sets a FIXED every-10-min trigger that
//        survives crashes, timeouts and sheet closes. Call ONCE from the menu.
//  [NEW] showTriggerStatus() — shows all active triggers in a popup
//  [IMPROVED] runAllScans() skips silently outside market hours — no noise
//  [REMOVED] self-scheduling one-shot pattern (unreliable, breaks on crash)
//  [FIX] Chartink rate-limit retry + session refresh every 3 scans (from v4)
//  [FIX] getUi() try/catch everywhere (from v3)
//  [FIX] Weekend / past-close guard (from v2)
// =============================================================================

// ─────────────────────────────────────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────────────────────────────────────
const CONFIG = {

  SCANS: {
    "S1 Ultra Daily":     `( {cash} (
        latest close > latest ema( close , 10 ) and
        latest ema( close , 10 ) > latest ema( close , 20 ) and
        latest ema( close , 20 ) > latest ema( close , 50 ) and
        latest ema( close , 50 ) > latest ema( close , 200 ) and
        latest rsi( 14 ) > 57 and latest rsi( 14 ) < 68 and
        latest macd line( 26 , 12 , 9 ) > latest macd signal( 26 , 12 , 9 ) and
        latest macd line( 26 , 12 , 9 ) > 0 and
        latest volume > latest ema( volume , 20 ) * 1.5 and
        latest close > 1 day ago high and latest close > 100
      ) )`,
    "S2 Weekly EMA":      `( {cash} (
        weekly close > weekly ema( close , 10 ) and
        weekly ema( close , 10 ) > weekly ema( close , 20 ) and
        weekly ema( close , 20 ) > weekly ema( close , 50 ) and
        weekly rsi( 14 ) > 55 and weekly rsi( 14 ) < 70 and
        weekly macd line( 26 , 12 , 9 ) > weekly macd signal( 26 , 12 , 9 ) and
        weekly macd line( 26 , 12 , 9 ) > 0 and
        latest close > latest ema( close , 20 ) and
        latest ema( close , 20 ) > latest ema( close , 50 ) and
        latest ema( close , 50 ) > latest ema( close , 200 ) and
        latest rsi( 14 ) > 55 and latest rsi( 14 ) < 70 and
        latest volume > latest ema( volume , 20 ) * 1.3 and latest close > 100
      ) )`,
    "S3 52W Breakout":    `( {cash} (
        latest close >= latest max( 252 , high ) and
        latest ema( close , 20 ) > latest ema( close , 50 ) and
        latest ema( close , 50 ) > latest ema( close , 200 ) and
        latest rsi( 14 ) > 55 and latest rsi( 14 ) < 75 and
        latest macd line( 26 , 12 , 9 ) > latest macd signal( 26 , 12 , 9 ) and
        latest volume > latest ema( volume , 20 ) * 2 and
        weekly close > weekly ema( close , 20 ) and
        weekly rsi( 14 ) > 55 and latest close > 100
      ) )`,
    "S4 ADX Supertrend":  `( {cash} (
        latest close > latest supertrend( 10 , 3 ) and latest adx( 14 ) > 25 and
        latest close > latest ema( close , 20 ) and
        latest ema( close , 20 ) > latest ema( close , 50 ) and
        latest ema( close , 50 ) > latest ema( close , 200 ) and
        latest rsi( 14 ) > 55 and latest rsi( 14 ) < 70 and
        latest macd line( 26 , 12 , 9 ) > latest macd signal( 26 , 12 , 9 ) and
        latest macd line( 26 , 12 , 9 ) > 0 and
        latest volume > latest ema( volume , 20 ) * 1.5 and
        weekly close > weekly ema( close , 20 ) and
        weekly rsi( 14 ) > 55 and latest close > 100
      ) )`,
    "S5A GOD DailyWeekly":`( {cash} (
        latest close > latest supertrend( 10 , 3 ) and latest adx( 14 ) > 25 and
        latest close > latest ema( close , 10 ) and
        latest ema( close , 10 ) > latest ema( close , 20 ) and
        latest ema( close , 20 ) > latest ema( close , 50 ) and
        latest ema( close , 50 ) > latest ema( close , 200 ) and
        latest rsi( 14 ) > 57 and latest rsi( 14 ) < 68 and
        latest macd line( 26 , 12 , 9 ) > latest macd signal( 26 , 12 , 9 ) and
        latest macd line( 26 , 12 , 9 ) > 0 and
        latest volume > latest ema( volume , 20 ) * 1.5 and
        latest close > 1 day ago high and
        weekly close > weekly ema( close , 10 ) and
        weekly ema( close , 10 ) > weekly ema( close , 20 ) and
        weekly ema( close , 20 ) > weekly ema( close , 50 ) and
        weekly rsi( 14 ) > 55 and weekly rsi( 14 ) < 70 and
        weekly macd line( 26 , 12 , 9 ) > weekly macd signal( 26 , 12 , 9 ) and
        latest close > 100
      ) )`,
    "S5B GOD DailyMonthly":`( {cash} (
        latest close > latest ema( close , 20 ) and
        latest ema( close , 20 ) > latest ema( close , 50 ) and
        latest ema( close , 50 ) > latest ema( close , 200 ) and
        latest rsi( 14 ) > 55 and latest rsi( 14 ) < 75 and
        latest macd line( 26 , 12 , 9 ) > latest macd signal( 26 , 12 , 9 ) and
        latest volume > latest ema( volume , 20 ) and
        monthly close > monthly ema( close , 10 ) and
        monthly close > monthly ema( close , 20 ) and latest close > 100
      ) )`,
  },

  SCAN_COLORS: {
    "S1 Ultra Daily":      "#E8F5E9",
    "S2 Weekly EMA":       "#E3F2FD",
    "S3 52W Breakout":     "#FFF8E1",
    "S4 ADX Supertrend":   "#F3E5F5",
    "S5A GOD DailyWeekly": "#FCE4EC",
    "S5B GOD DailyMonthly":"#E0F7FA",
  },

  YF_SUFFIX:   ".NS",
  ALERT_EMAIL: "your@email.com",

  MARKET_START_HOUR:   9,
  MARKET_START_MINUTE: 15,   // NSE actually opens at 9:15
  MARKET_END_HOUR:    15,
  MARKET_END_MINUTE:  30,

  ACTIVE_DATE_RANGES: [],    // [] = normal Mon–Fri mode

  // ── Trigger ────────────────────────────────────────────────────────────
  // Valid GAS values: 1, 5, 10, 15, 30
  TRIGGER_INTERVAL_MINUTES: 10,

  // ── Chartink rate-limit settings ───────────────────────────────────────
  SCAN_SLEEP_MS:         3000,
  SCAN_RETRY_MAX:        3,
  SCAN_RETRY_BASE_MS:    3000,
  SCAN_JITTER_MS:        500,
  SESSION_REFRESH_EVERY: 3,

  SIGNAL_PROFILE: "balanced",

  DASHBOARD_SHEET:     "📊 Dashboard",
  PRICE_HISTORY_SHEET: "📈 Price History",
  GOD_MODE_SHEET:      "★ GOD MODE",
  LOG_SHEET:           "🗒️ Log",

  MAX_LOG_ROWS: 500,
  MAX_RUN_MS:   5 * 60 * 1000,
};

// ─────────────────────────────────────────────────────────────────────────────
// SIGNAL PROFILES
// ─────────────────────────────────────────────────────────────────────────────
const SIGNAL_PROFILES = {
  conservative: { ADX_STRONG:25, ADX_WEAK:18, VOL_RATIO_HIGH:1.5,  DIST_52W_HIGH_MAX:2,
                  BREAKOUT_20D_MIN:0.75, RSI_OVERSOLD:30, RSI_NEUTRAL_MIN:45,
                  RSI_BULLISH_MIN:55, RSI_OVERBOUGHT:78, MACD_ZERO_TOL_PCT:0.00005 },
  balanced:     { ADX_STRONG:20, ADX_WEAK:16, VOL_RATIO_HIGH:1.25, DIST_52W_HIGH_MAX:3,
                  BREAKOUT_20D_MIN:0.25, RSI_OVERSOLD:32, RSI_NEUTRAL_MIN:45,
                  RSI_BULLISH_MIN:52, RSI_OVERBOUGHT:78, MACD_ZERO_TOL_PCT:0.00005 },
  aggressive:   { ADX_STRONG:18, ADX_WEAK:14, VOL_RATIO_HIGH:1.1,  DIST_52W_HIGH_MAX:5,
                  BREAKOUT_20D_MIN:0,    RSI_OVERSOLD:35, RSI_NEUTRAL_MIN:42,
                  RSI_BULLISH_MIN:50, RSI_OVERBOUGHT:80, MACD_ZERO_TOL_PCT:0.00005 },
};
const SIGNAL_PROFILE_KEY = "signalProfile";
const NO_SYMBOL_SENTINEL = "~NOFOUND";

// ─────────────────────────────────────────────────────────────────────────────
// COLUMN MAPS
// ─────────────────────────────────────────────────────────────────────────────
const C = {
  SYMBOL:0, NAME:1, FIRST_CAPTURED:2, LAST_SEEN:3, IN_SCAN:4,
  CAPTURE_PRICE:5, CURRENT_PRICE:6, RET_CAPTURE:7,
  RET_1D:8, RET_1W:9, RET_1M:10, RET_3M:11, RET_6M:12, RET_1Y:13, RET_2Y:14, RET_3Y:15,
  AVG_WEEKLY:16, AVG_MONTHLY:17, AVG_3M:18, AVG_6M:19, AVG_1Y:20,
  RSI14:21, MA20:22, MA50:23, MA200:24,
  SIGNAL:25, LAST_UPDATED:26,
  ADX14:27, VOL_RATIO20:28, MACD_LINE:29, MACD_HIST:30,
  DIST_52W_HIGH:31, BREAKOUT_20D:32, SCANS_COUNT:33,
  _COUNT:34,
};
const HEADERS = [
  "Symbol","Name","First Captured","Last Seen","In Scan?",
  "Capture Price ₹","Current Price ₹","Since Capture %",
  "1D %","1W %","1M %","3M %","6M %","1Y %","2Y %","3Y %",
  "Avg Weekly %","Avg Monthly %","Avg 3M %","Avg 6M %","Avg 1Y %",
  "RSI(14)","MA20","MA50","MA200",
  "Signal","Last Updated","ADX(14)","Vol Ratio(20)","MACD Line","MACD Hist",
  "52W High Dist %","20D Breakout %","Scans Matched",
];
const H = {
  SNAPSHOT_AT:0, SCAN_NAME:1, SYMBOL:2, NAME:3, IN_SCAN:4,
  CAPTURE_PRICE:5, CURRENT_PRICE:6, RET_CAPTURE:7,
  RET_1D:8, RET_1W:9, RET_1M:10, RET_3M:11, RET_6M:12, RET_1Y:13,
  RSI14:14, ADX14:15, VOL_RATIO20:16, MACD_LINE:17, MACD_HIST:18,
  DIST_52W_HIGH:19, BREAKOUT_20D:20, SIGNAL:21, SCANS_COUNT:22,
  _COUNT:23,
};
const PRICE_HISTORY_HEADERS = [
  "Snapshot At","Scan Name","Symbol","Name","In Scan?",
  "Capture Price ₹","Current Price ₹","Since Capture %",
  "1D %","1W %","1M %","3M %","6M %","1Y %",
  "RSI(14)","ADX(14)","Vol Ratio(20)","MACD Line","MACD Hist",
  "52W High Dist %","20D Breakout %","Signal","Scans Matched",
];
const RETURN_COLS = [
  C.RET_CAPTURE,C.RET_1D,C.RET_1W,C.RET_1M,C.RET_3M,C.RET_6M,
  C.RET_1Y,C.RET_2Y,C.RET_3Y,C.AVG_WEEKLY,C.AVG_MONTHLY,
  C.AVG_3M,C.AVG_6M,C.AVG_1Y,C.BREAKOUT_20D,
];
const PRICE_COLS = [C.CAPTURE_PRICE,C.CURRENT_PRICE,C.MA20,C.MA50,C.MA200];

// =============================================================================
// MENU
// =============================================================================
function onOpen() {
  SpreadsheetApp.getUi().createMenu("📈 Scanner")
    .addItem("▶ Run Now (Manual)",           "runAllScans")
    .addItem("🧪 Test All Scans (No Schedule)","testRunAllScans")
    .addItem("🔬 Test Yahoo (RELIANCE)",      "testYahooFetch")
    .addSeparator()
    .addItem("⚙️ Setup All Sheets",           "setupAllSheets")
    .addSeparator()
    .addItem("📌 Install Recurring Trigger",  "installRecurringTrigger")
    .addItem("📋 Show Trigger Status",        "showTriggerStatus")
    .addItem("⏹ Stop All Triggers",          "stopAllTriggers")
    .addSeparator()
    .addItem("📊 Conservative Profile",       "setConservativeProfile")
    .addItem("📊 Balanced Profile",           "setBalancedProfile")
    .addItem("📊 Aggressive Profile",         "setAggressiveProfile")
    .addSeparator()
    .addItem("🗑 Clear Price History",        "clearPriceHistory")
    .addToUi();
}

// =============================================================================
// TRIGGER MANAGEMENT  ← THE CORE FIX IN v5
// =============================================================================

/**
 * installRecurringTrigger()
 * ─────────────────────────
 * Call this ONCE from the menu after pasting the script.
 * Creates a FIXED every-10-min time-based trigger for runAllScans().
 *
 * How it works:
 *  • GAS fires runAllScans() every 10 minutes, 24×7
 *  • runAllScans() checks market hours + weekday at the TOP
 *  • If outside hours → logs "⏭ Skipped" and returns immediately (< 1 sec)
 *  • If inside hours → runs all 6 scans + Yahoo + Dashboard
 *
 * You NEVER need to re-run this unless you call stopAllTriggers().
 * The trigger persists even when the spreadsheet is closed.
 */
function installRecurringTrigger() {
  // Delete any old runAllScans triggers first
  deleteTriggersByHandler("runAllScans");

  // Valid everyMinutes values in GAS: 1, 5, 10, 15, 30
  const validMins = [1, 5, 10, 15, 30];
  const iv = validMins.reduce((p, c) =>
    Math.abs(c - CONFIG.TRIGGER_INTERVAL_MINUTES) < Math.abs(p - CONFIG.TRIGGER_INTERVAL_MINUTES) ? c : p
  );

  ScriptApp.newTrigger("runAllScans")
    .timeBased()
    .everyMinutes(iv)
    .create();

  const msg =
    "✅ Recurring trigger installed!\n\n" +
    "• Fires every: " + iv + " minutes (24×7)\n" +
    "• runAllScans() skips automatically outside market hours\n" +
    "• Market window: Mon–Fri " +
      CONFIG.MARKET_START_HOUR + ":" + String(CONFIG.MARKET_START_MINUTE).padStart(2,"0") +
      " – " +
      CONFIG.MARKET_END_HOUR   + ":" + String(CONFIG.MARKET_END_MINUTE  ).padStart(2,"0") +
      " IST\n\n" +
    "You can verify in:\n" +
    "Apps Script editor → ⏰ Triggers (left sidebar)";

  Logger.log(msg.replace(/\n/g," | "));
  try { SpreadsheetApp.getUi().alert(msg); } catch(_) {}
}

/**
 * showTriggerStatus()
 * ────────────────────
 * Shows all active project triggers in a popup.
 */
function showTriggerStatus() {
  const triggers = ScriptApp.getProjectTriggers();
  if (!triggers.length) {
    try { SpreadsheetApp.getUi().alert("⚠️ No triggers installed.\n\nGo to: Scanner → 📌 Install Recurring Trigger"); } catch(_) {}
    return;
  }
  const lines = triggers.map(t => {
    const type = t.getTriggerSource() === ScriptApp.TriggerSource.CLOCK ? "⏰ Time" : "📄 Sheet";
    return type + " → " + t.getHandlerFunction() + " (" + t.getUniqueId().slice(0,8) + ")";
  });
  const msg = "Active Triggers (" + triggers.length + "):\n\n" + lines.join("\n");
  Logger.log(msg);
  try { SpreadsheetApp.getUi().alert(msg); } catch(_) {}
}

function stopAllTriggers() {
  const count = ScriptApp.getProjectTriggers().length;
  ScriptApp.getProjectTriggers().forEach(t => ScriptApp.deleteTrigger(t));
  try { SpreadsheetApp.getUi().alert("⏹ Stopped " + count + " trigger(s).\n\nTo restart: Scanner → 📌 Install Recurring Trigger"); } catch(_) {}
}

function deleteTriggersByHandler(name) {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === name)
    .forEach(t => ScriptApp.deleteTrigger(t));
}

// =============================================================================
// MAIN ENTRY — called by the recurring trigger every 10 min
// =============================================================================
function runAllScans() {
  const ss       = SpreadsheetApp.getActiveSpreadsheet();
  const schedule = getRunScheduleStatus();
  if (!schedule.isLiveWindow) {
    // Silent skip outside market hours — no log spam
    Logger.log("⏭ Skipped — " + schedule.reason);
    return;
  }
  ensureSystemSheets(ss);
  log(ss, "▶ AUTO RUN STARTED — " + fmtIST(new Date()));
  _doRun(ss, "AUTO");
}

// =============================================================================
// TEST RUN — bypasses schedule, works from editor + sheet menu
// =============================================================================
function testRunAllScans() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ensureSystemSheets(ss);
  log(ss, "🧪 TEST RUN STARTED — schedule checks BYPASSED — " + fmtIST(new Date()));
  const result = _doRun(ss, "TEST");
  try {
    SpreadsheetApp.getUi().alert(
      "✅ Test Run Complete!\n\n"
      + "⏱ Time: "                 + result.elapsed       + "s\n"
      + "📊 Scans run: "            + result.scanCount      + "\n"
      + "📈 Unique stocks: "        + result.uniqueStocks   + "\n"
      + "🔥 High Conviction (3+): " + result.highConviction + "\n"
      + "★ GOD MODE: "              + (result.godMode.length ? result.godMode.join(", ") : "none") + "\n\n"
      + "Check the Log sheet and scan tabs for full details."
    );
  } catch (_) {
    Logger.log("ℹ️ Popup skipped (run from editor) — check Log sheet for results");
  }
}

// =============================================================================
// CORE RUN LOGIC
// =============================================================================
function _doRun(ss, mode) {
  const RUN_START    = Date.now();
  const allResults   = {};
  const globalSymMap = {};
  const scanNames    = Object.keys(CONFIG.SCANS);

  // ── 1. Initial Chartink session ──────────────────────────────────────────
  let session = null;
  try {
    session = fetchChartinkSession();
    log(ss, "  Chartink session OK — token: " + session.token.slice(0,12) + "…");
  } catch(e) {
    log(ss, "❌ Chartink session failed: " + e.message);
    return { elapsed:"0", scanCount:0, uniqueStocks:0, highConviction:0, godMode:[] };
  }

  // ── 2. Run scans with retry + proactive session refresh ──────────────────
  for (let si = 0; si < scanNames.length; si++) {
    if (isTimedOut(RUN_START)) { log(ss, "⏱ Timeout — skipping remaining scans"); break; }

    const scanName = scanNames[si];
    const clause   = CONFIG.SCANS[scanName];

    // Proactively refresh session every N scans
    if (si > 0 && si % CONFIG.SESSION_REFRESH_EVERY === 0) {
      try {
        session = fetchChartinkSession();
        log(ss, "  🔄 Session refreshed at scan " + (si+1) + " — token: " + session.token.slice(0,12) + "…");
      } catch(e) {
        log(ss, "  ⚠️ Session refresh failed: " + e.message);
      }
    }

    if (si > 0) Utilities.sleep(CONFIG.SCAN_SLEEP_MS + jitter());

    // Retry loop
    let stocks = null, lastErr = "";
    for (let attempt = 1; attempt <= CONFIG.SCAN_RETRY_MAX; attempt++) {
      try {
        stocks = callChartinkScan(clause, session.token, session.cookieHeader);
        break;
      } catch(e) {
        lastErr = e.message;
        log(ss, "  ⚠️ " + scanName + " attempt " + attempt + "/" + CONFIG.SCAN_RETRY_MAX + ": " + lastErr);
        if (attempt < CONFIG.SCAN_RETRY_MAX) {
          const backoffMs = CONFIG.SCAN_RETRY_BASE_MS * Math.pow(2, attempt-1) + jitter();
          log(ss, "  🔁 Retrying in " + (backoffMs/1000).toFixed(1) + "s — refreshing session…");
          Utilities.sleep(backoffMs);
          try {
            session = fetchChartinkSession();
            log(ss, "  🔄 Session refreshed for retry — token: " + session.token.slice(0,12) + "…");
          } catch(re) {
            log(ss, "  ⚠️ Session refresh on retry failed: " + re.message);
          }
        }
      }
    }

    if (stocks === null) {
      log(ss, "  ❌ " + scanName + ": all retries exhausted — " + lastErr);
      allResults[scanName] = [];
    } else {
      allResults[scanName] = stocks;
      stocks.forEach(s => { globalSymMap[s.nsecode] = (globalSymMap[s.nsecode]||0) + 1; });
      log(ss, "  ✅ " + scanName + ": " + stocks.length + " stocks"
             + (stocks.length ? " — e.g. " + stocks.slice(0,3).map(s=>s.nsecode).join(", ") : ""));
    }
  }

  // ── 3. GOD MODE (S5A ∩ S5B) ─────────────────────────────────────────────
  const s5aSet  = new Set((allResults["S5A GOD DailyWeekly"]  || []).map(s => s.nsecode));
  const s5bSet  = new Set((allResults["S5B GOD DailyMonthly"] || []).map(s => s.nsecode));
  const godMode = [...s5aSet].filter(s => s5bSet.has(s));
  log(ss, "★ GOD MODE: " + (godMode.length ? godMode.join(", ") : "none"));

  // ── 4. Per-scan sheets + Yahoo ────────────────────────────────────────────
  const allNewStocks = [];
  for (const [scanName, stocks] of Object.entries(allResults)) {
    if (isTimedOut(RUN_START)) { log(ss, "⏱ Timeout — skipping performance updates"); break; }
    try {
      const newOnes = processScanSheet(ss, scanName, stocks, globalSymMap, RUN_START);
      if (newOnes.length) allNewStocks.push({ scan: scanName, stocks: newOnes });
    } catch(e) {
      log(ss, "  ❌ processScanSheet [" + scanName + "]: " + e.message);
    }
  }

  // ── 5. GOD MODE sheet + Dashboard ────────────────────────────────────────
  updateGodModeSheet(ss, godMode, allResults, globalSymMap);
  if (!isTimedOut(RUN_START)) updateDashboard(ss, allResults, globalSymMap, godMode);

  // ── 6. Email (AUTO only) ─────────────────────────────────────────────────
  if (mode !== "TEST" && CONFIG.ALERT_EMAIL &&
      (godMode.length > 0 || allNewStocks.length > 0)) {
    try { sendEmailAlert(godMode, allNewStocks, globalSymMap); } catch(_) {}
  }

  const elapsed      = msToSec(Date.now() - RUN_START);
  const hcCount      = Object.values(globalSymMap).filter(c => c >= 3).length;
  const uniqueStocks = Object.keys(globalSymMap).length;
  log(ss, (mode==="TEST"?"🧪":"✅") + " " + mode + " complete — "
         + elapsed + "s | stocks: " + uniqueStocks
         + " | GOD MODE: " + godMode.length + " | HC: " + hcCount);
  return { elapsed, scanCount: Object.keys(allResults).length, uniqueStocks, highConviction:hcCount, godMode };
}

function jitter() {
  return Math.floor(Math.random() * CONFIG.SCAN_JITTER_MS * 2) - CONFIG.SCAN_JITTER_MS;
}

// =============================================================================
// CHARTINK API
// =============================================================================
function fetchChartinkSession() {
  const resp = UrlFetchApp.fetch("https://chartink.com/screener/", {
    method:"get", followRedirects:true, muteHttpExceptions:true,
    headers:{"User-Agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
  });
  let cookieArr = resp.getAllHeaders()["Set-Cookie"] || [];
  if (!Array.isArray(cookieArr)) cookieArr = [cookieArr];
  let xsrf = "", parts = [];
  cookieArr.forEach(c => {
    parts.push(c.split(";")[0]);
    if (c.includes("XSRF-TOKEN="))
      xsrf = decodeURIComponent(c.split("XSRF-TOKEN=")[1].split(";")[0]);
  });
  if (!xsrf) throw new Error("XSRF token not found in response cookies");
  return { token: xsrf, cookieHeader: parts.join("; ") };
}

function callChartinkScan(clause, token, cookieHeader) {
  const resp = UrlFetchApp.fetch("https://chartink.com/screener/process", {
    method:"post", muteHttpExceptions:true,
    headers:{
      "Referer":          "https://chartink.com/screener/",
      "X-XSRF-TOKEN":     token,
      "X-Requested-With": "XMLHttpRequest",
      "Content-Type":     "application/x-www-form-urlencoded",
      "Cookie":           cookieHeader,
      "User-Agent":       "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
    },
    payload: "scan_clause=" + encodeURIComponent(clause)
  });
  if (resp.getResponseCode() !== 200)
    throw new Error("HTTP " + resp.getResponseCode() + " from Chartink");
  const json = JSON.parse(resp.getContentText());
  if (json.scan_error) throw new Error("Chartink: " + json.scan_error);
  return json.data || [];
}

// =============================================================================
// PROCESS ONE SCAN SHEET
// =============================================================================
function processScanSheet(ss, scanName, stocks, globalSymMap, RUN_START) {
  const sheet   = getOrCreateScanSheet(ss, scanName);
  const lastRow = sheet.getLastRow();
  const nowStr  = fmtIST(new Date());
  const existingMap = {};
  if (lastRow >= 2) {
    sheet.getRange(2,1,lastRow-1,C._COUNT).getValues().forEach((row,i) => {
      const sym = String(row[C.SYMBOL]||"").trim();
      if (sym) existingMap[sym] = {rowIdx:i+2, capturePrice:row[C.CAPTURE_PRICE]};
    });
  }
  if (lastRow >= 2)
    sheet.getRange(2,C.IN_SCAN+1,lastRow-1,1).setValues(Array.from({length:lastRow-1},()=>["⬜"]));
  const newStocks=[], lastSeenUpd=[], inScanUpd=[];
  for (const s of stocks) {
    const sym = String(s.nsecode||"").trim();
    if (!sym) continue;
    if (existingMap[sym]) {
      lastSeenUpd.push({rowIdx:existingMap[sym].rowIdx, value:nowStr});
      inScanUpd.push(  {rowIdx:existingMap[sym].rowIdx, value:"✅"});
    } else {
      const nr = sheet.getLastRow()+1;
      const row = buildEmptyRow(s, nowStr, globalSymMap[sym]||1);
      sheet.getRange(nr,1,1,C._COUNT).setValues([row]).setBackground("#FFEB3B");
      existingMap[sym] = {rowIdx:nr, capturePrice:""};
      newStocks.push(s);
    }
  }
  batchWriteCol(sheet, lastSeenUpd, C.LAST_SEEN+1, lastRow);
  batchWriteCol(sheet, inScanUpd,   C.IN_SCAN  +1, lastRow);
  if (!isTimedOut(RUN_START)) updateSheetPerformance(ss, sheet, scanName, globalSymMap, RUN_START);
  return newStocks;
}

function buildEmptyRow(s, nowStr, scanCount) {
  const row = new Array(C._COUNT).fill("");
  row[C.SYMBOL]         = String(s.nsecode||"").trim();
  row[C.NAME]           = String(s.name   ||"").trim();
  row[C.FIRST_CAPTURED] = nowStr;
  row[C.LAST_SEEN]      = nowStr;
  row[C.IN_SCAN]        = "✅";
  row[C.SCANS_COUNT]    = scanCount||1;
  return row;
}

// =============================================================================
// YAHOO FINANCE PERFORMANCE UPDATE
// =============================================================================
function updateSheetPerformance(ss, sheet, scanName, globalSymMap, RUN_START) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;
  const allData    = sheet.getRange(2,1,lastRow-1,C._COUNT).getValues();
  const updated    = allData.map(r=>r.slice());
  const firstFetch = [], histRows = [];
  for (let idx=0; idx<allData.length; idx++) {
    if (isTimedOut(RUN_START)) { log(ss,"⏱ Yahoo stopped at row "+(idx+2)); break; }
    const row = allData[idx];
    const sym = String(row[C.SYMBOL]||"").trim();
    if (!sym||sym===NO_SYMBOL_SENTINEL) continue;
    try {
      const hist = normalizeHistory(fetchYahooHistory(sym));
      if (!hist||hist.closes.length<5) { updated[idx][C.SIGNAL]="⚠️ No Data"; continue; }
      const closes=hist.closes,n=closes.length,current=closes[n-1];
      if (!current||isNaN(current)||current<=0) { updated[idx][C.SIGNAL]="⚠️ Bad Price"; continue; }
      const hadCapture=row[C.CAPTURE_PRICE]!==""&&Number(row[C.CAPTURE_PRICE])>0;
      if (!hadCapture) { updated[idx][C.CAPTURE_PRICE]=roundN(current,2); firstFetch.push(idx); }
      const capPrice=Number(updated[idx][C.CAPTURE_PRICE]);
      updated[idx][C.CURRENT_PRICE]=roundN(current,2);
      updated[idx][C.RET_CAPTURE]=capPrice>0?pct((current-capPrice)/capPrice*100):"";
      updated[idx][C.RET_1D] =pct(periodReturn(closes,n,1));
      updated[idx][C.RET_1W] =pct(periodReturn(closes,n,5));
      updated[idx][C.RET_1M] =pct(periodReturn(closes,n,21));
      updated[idx][C.RET_3M] =pct(periodReturn(closes,n,63));
      updated[idx][C.RET_6M] =pct(periodReturn(closes,n,126));
      updated[idx][C.RET_1Y] =pct(periodReturn(closes,n,252));
      updated[idx][C.RET_2Y] =pct(periodReturn(closes,n,504));
      updated[idx][C.RET_3Y] =pct(periodReturn(closes,n,756));
      updated[idx][C.AVG_WEEKLY] =pct(avgPeriodReturn(closes,5,252));
      updated[idx][C.AVG_MONTHLY]=pct(avgPeriodReturn(closes,21,504));
      updated[idx][C.AVG_3M]    =pct(avgPeriodReturn(closes,63,n));
      updated[idx][C.AVG_6M]    =pct(avgPeriodReturn(closes,126,n));
      updated[idx][C.AVG_1Y]    =pct(avgPeriodReturn(closes,252,n));
      const ma20=calcMA(closes,20),ma50=calcMA(closes,50),ma200=calcMA(closes,200);
      const rsi=calcRSI(closes,14),adx=calcADX(hist.highs,hist.lows,closes,14);
      const volR=calcVolumeRatio(hist.volumes,20,hist.timestamps);
      const macd=calcMACD(closes,12,26,9);
      const d52=calcDistanceFromHigh(hist.highs,closes,252),brk=calcBreakoutPct(hist.highs,closes,20);
      updated[idx][C.MA20]        =roundN(ma20,2);
      updated[idx][C.MA50]        =roundN(ma50,2);
      updated[idx][C.MA200]       =roundN(ma200,2);
      updated[idx][C.RSI14]       =roundN(rsi,1);
      updated[idx][C.ADX14]       =roundN(adx,1);
      updated[idx][C.VOL_RATIO20] =roundN(volR,2);
      updated[idx][C.MACD_LINE]   =roundN(macd.macdLine,2);
      updated[idx][C.MACD_HIST]   =roundN(macd.histogram,2);
      updated[idx][C.DIST_52W_HIGH]=pct(d52);
      updated[idx][C.BREAKOUT_20D] =pct(brk);
      updated[idx][C.SCANS_COUNT] =globalSymMap[sym]||updated[idx][C.SCANS_COUNT]||1;
      updated[idx][C.SIGNAL]      =calcSignal({price:current,ma20,ma50,ma200,rsi,adx,
                                               volRatio:volR,macdLine:macd.macdLine,
                                               macdHist:macd.histogram,
                                               dist52wHigh:d52,breakout20dPct:brk});
      updated[idx][C.LAST_UPDATED]=fmtIST(new Date());
      histRows.push(buildHistoryRow(scanName,updated[idx],globalSymMap[sym]||1));
      Utilities.sleep(350);
    } catch(e) {
      log(ss,"  ⚠️ "+sym+": "+e.message);
      updated[idx][C.SIGNAL]="⚠️ Error";
    }
  }
  sheet.getRange(2,1,updated.length,C._COUNT).setValues(updated);
  applyBatchFormatting(sheet,updated,firstFetch);
  if (histRows.length>0) appendHistoryRows(ss,histRows);
}

// =============================================================================
// YAHOO FINANCE
// =============================================================================
function fetchYahooHistory(symbol) {
  if (!symbol||symbol===NO_SYMBOL_SENTINEL) return null;
  const isBse=symbol.startsWith("BSE:"),rawTick=isBse?symbol.slice(4):symbol;
  const suffixes=isBse?[".BO"]:[CONFIG.YF_SUFFIX,".BO"];
  const opts={method:"GET",headers:{"User-Agent":"Mozilla/5.0 (compatible; GAS/1.0)"},muteHttpExceptions:true};
  for (const sfx of suffixes) {
    const ticker=encodeURIComponent(rawTick+sfx);
    const path="/v8/finance/chart/"+ticker+"?range=3y&interval=1d";
    for (const host of ["query2","query1"]) {
      try {
        const resp=UrlFetchApp.fetch("https://"+host+".finance.yahoo.com"+path,opts);
        if (resp.getResponseCode()!==200) continue;
        const result=JSON.parse(resp.getContentText())?.chart?.result?.[0];
        if (!result) continue;
        const q=result.indicators?.quote?.[0]||{};
        return{closes:toNum(q.close||[]),highs:toNum(q.high||[]),
               lows:toNum(q.low||[]),volumes:toNum(q.volume||[]),
               timestamps:result.timestamp||[]};
      } catch(_) {}
    }
  }
  return null;
}
function normalizeHistory(h){
  if(!h||!h.closes||!h.closes.length)return null;
  let end=h.closes.length;
  while(end>0&&isNaN(h.closes[end-1]))end--;
  if(!end)return null;
  const align=arr=>{const a=[];for(let i=0;i<end;i++){const v=arr?arr[i]:null;a.push(v==null?NaN:Number(v));}return a;};
  return{closes:h.closes.slice(0,end),highs:align(h.highs),lows:align(h.lows),
         volumes:align(h.volumes),timestamps:(h.timestamps||[]).slice(0,end)};
}
function toNum(arr){return(arr||[]).map(v=>v==null?NaN:Number(v));}

// =============================================================================
// CALCULATIONS
// =============================================================================
function periodReturn(closes,n,periods){
  if(n<=periods)return null;
  const p=closes[n-1-periods],c=closes[n-1];
  if(isNaN(p)||isNaN(c)||p===0)return null;
  return((c-p)/p)*100;
}
function avgPeriodReturn(closes,period,lookback){
  const start=Math.max(0,closes.length-lookback),slice=closes.slice(start),n=slice.length;
  if(n<period*2)return null;
  const rets=[];
  for(let i=period;i<n;i+=period){const s=slice[i-period],e=slice[i];if(isNaN(s)||isNaN(e)||s===0)continue;rets.push(((e-s)/s)*100);}
  return rets.length?rets.reduce((a,b)=>a+b,0)/rets.length:null;
}
function calcMA(closes,period){
  const n=closes.length;if(n<period)return null;
  const sl=closes.slice(n-period).filter(v=>!isNaN(v));
  if(sl.length<Math.ceil(period*0.8))return null;
  return sl.reduce((a,b)=>a+b,0)/sl.length;
}
function calcRSI(closes,period){
  const ch=[];
  for(let i=1;i<closes.length;i++){if(!isNaN(closes[i-1])&&!isNaN(closes[i]))ch.push(closes[i]-closes[i-1]);}
  if(ch.length<period+1)return null;
  let ag=0,al=0;
  for(let i=0;i<period;i++){if(ch[i]>0)ag+=ch[i];else al-=ch[i];}
  ag/=period;al/=period;
  for(let i=period;i<ch.length;i++){const g=ch[i]>0?ch[i]:0,l=ch[i]<0?-ch[i]:0;ag=(ag*(period-1)+g)/period;al=(al*(period-1)+l)/period;}
  if(al===0)return 100;
  return 100-100/(1+ag/al);
}
function calcEMA(values,period){
  if(!values||values.length<period)return[];
  const ema=new Array(values.length).fill(null);let sum=0;
  for(let i=0;i<period;i++){const v=Number(values[i]);if(isNaN(v))return[];sum+=v;}
  ema[period-1]=sum/period;const k=2/(period+1);
  for(let i=period;i<values.length;i++){const v=Number(values[i]);if(isNaN(v))return[];ema[i]=((v-ema[i-1])*k)+ema[i-1];}
  return ema;
}
function calcMACD(closes,fp,sp,sigp){
  const vals=closes.filter(v=>!isNaN(v));
  if(vals.length<sp+sigp)return{macdLine:null,signalLine:null,histogram:null};
  const fast=calcEMA(vals,fp),slow=calcEMA(vals,sp),ms=[];
  for(let i=0;i<vals.length;i++){if(fast[i]!=null&&slow[i]!=null)ms.push(fast[i]-slow[i]);}
  if(!ms.length)return{macdLine:null,signalLine:null,histogram:null};
  const sig=calcEMA(ms,sigp),ml=ms[ms.length-1],sl=lastValid(sig);
  return{macdLine:ml,signalLine:sl,histogram:sl==null?null:ml-sl};
}
function calcVolumeRatio(volumes,period,timestamps){
  const rows=[];
  for(let i=0;i<volumes.length;i++){const v=Number(volumes[i]);if(!isNaN(v)&&v>0)rows.push({v,ts:timestamps&&timestamps[i]?Number(timestamps[i]):null});}
  if(rows.length<period+1)return null;
  let ci=rows.length-1;
  const ist=new Date(new Date().toLocaleString("en-US",{timeZone:"Asia/Kolkata"}));
  const hh=ist.getHours(),mm=ist.getMinutes();
  const live=(hh>CONFIG.MARKET_START_HOUR||(hh===CONFIG.MARKET_START_HOUR&&mm>=CONFIG.MARKET_START_MINUTE))&&
             (hh<CONFIG.MARKET_END_HOUR  ||(hh===CONFIG.MARKET_END_HOUR  &&mm<=CONFIG.MARKET_END_MINUTE));
  if(live&&rows[ci].ts){
    const ld=new Date(rows[ci].ts*1000).toLocaleDateString("en-IN",{timeZone:"Asia/Kolkata"});
    const td=new Date().toLocaleDateString("en-IN",{timeZone:"Asia/Kolkata"});
    if(ld===td)ci--;
  }
  if(ci<period)return null;
  const cur=rows[ci].v,avg=rows.slice(ci-period,ci).reduce((a,r)=>a+r.v,0)/period;
  return avg>0?cur/avg:null;
}
function calcDistanceFromHigh(highs,closes,lookback){
  const rows=[];
  for(let i=0;i<closes.length;i++){if(!isNaN(highs[i])&&!isNaN(closes[i]))rows.push({h:highs[i],c:closes[i]});}
  if(!rows.length)return null;
  const sl=rows.slice(-Math.min(rows.length,lookback)),cur=sl[sl.length-1].c,hi=Math.max(...sl.map(r=>r.h));
  if(isNaN(cur)||isNaN(hi)||hi<=0)return null;
  return((hi-cur)/hi)*100;
}
function calcBreakoutPct(highs,closes,lookback){
  const rows=[];
  for(let i=0;i<closes.length;i++){if(!isNaN(highs[i])&&!isNaN(closes[i]))rows.push({h:highs[i],c:closes[i]});}
  if(rows.length<lookback+1)return null;
  const cur=rows[rows.length-1].c,bl=Math.max(...rows.slice(rows.length-lookback-1,rows.length-1).map(r=>r.h));
  if(isNaN(cur)||isNaN(bl)||bl<=0)return null;
  return((cur-bl)/bl)*100;
}
function calcADX(highs,lows,closes,period){
  const rows=[];
  for(let i=0;i<closes.length;i++){if(!isNaN(highs[i])&&!isNaN(lows[i])&&!isNaN(closes[i]))rows.push({h:highs[i],l:lows[i],c:closes[i]});}
  if(rows.length<period*2)return null;
  const trs=[],pDMs=[],mDMs=[];
  for(let i=1;i<rows.length;i++){
    const pv=rows[i-1],cv=rows[i],up=cv.h-pv.h,dn=pv.l-cv.l;
    pDMs.push(up>dn&&up>0?up:0);mDMs.push(dn>up&&dn>0?dn:0);
    trs.push(Math.max(cv.h-cv.l,Math.abs(cv.h-pv.c),Math.abs(cv.l-pv.c)));
  }
  if(trs.length<period*2-1)return null;
  let tr=sumArr(trs.slice(0,period)),pd=sumArr(pDMs.slice(0,period)),md=sumArr(mDMs.slice(0,period));
  const dxs=[];
  for(let i=period-1;i<trs.length;i++){
    if(i>period-1){tr=tr-(tr/period)+trs[i];pd=pd-(pd/period)+pDMs[i];md=md-(md/period)+mDMs[i];}
    const pdi=tr===0?0:100*(pd/tr),mdi=tr===0?0:100*(md/tr),den=pdi+mdi;
    dxs.push(den===0?0:100*Math.abs(pdi-mdi)/den);
  }
  if(dxs.length<period)return null;
  let adx=sumArr(dxs.slice(0,period))/period;
  for(let i=period;i<dxs.length;i++)adx=((adx*(period-1))+dxs[i])/period;
  return adx;
}
function lastValid(arr){for(let i=arr.length-1;i>=0;i--){const v=arr[i];if(v!=null&&!isNaN(v))return v;}return null;}
function sumArr(arr){return arr.reduce((s,v)=>s+v,0);}
function roundN(v,n){if(v==null||isNaN(v))return "";return Math.round(v*Math.pow(10,n))/Math.pow(10,n);}
function pct(v){if(v==null||isNaN(v))return "";return Math.round(v*100)/100;}

// =============================================================================
// SIGNAL ENGINE (13 tiers)
// =============================================================================
function getSignalSettings(){
  const stored=PropertiesService.getScriptProperties().getProperty(SIGNAL_PROFILE_KEY);
  const key=(stored&&SIGNAL_PROFILES[stored])?stored:CONFIG.SIGNAL_PROFILE;
  return SIGNAL_PROFILES[key]||SIGNAL_PROFILES.balanced;
}
function setConservativeProfile(){PropertiesService.getScriptProperties().setProperty(SIGNAL_PROFILE_KEY,"conservative");}
function setBalancedProfile()    {PropertiesService.getScriptProperties().setProperty(SIGNAL_PROFILE_KEY,"balanced");}
function setAggressiveProfile()  {PropertiesService.getScriptProperties().setProperty(SIGNAL_PROFILE_KEY,"aggressive");}

function calcSignal(m){
  const s=getSignalSettings();
  const{price,ma20,ma50,ma200,rsi,adx,volRatio,macdLine,macdHist,dist52wHigh,breakout20dPct}=m;
  if(!price||!ma20||!ma50||isNaN(price)||isNaN(ma20)||isNaN(ma50))return "⚪ Insufficient Data";
  const above20=price>ma20,above50=price>ma50;
  const hasMa200=ma200!=null&&!isNaN(ma200)&&ma200>0,above200=hasMa200?price>ma200:false;
  const hasRsi=rsi!=null&&!isNaN(rsi);
  const overbought=hasRsi&&rsi>=s.RSI_OVERBOUGHT,oversold=hasRsi&&rsi<=s.RSI_OVERSOLD;
  const bullish=hasRsi&&rsi>=s.RSI_BULLISH_MIN&&rsi<s.RSI_OVERBOUGHT;
  const neutral=hasRsi&&rsi>=s.RSI_NEUTRAL_MIN&&rsi<s.RSI_BULLISH_MIN;
  const hasAdx=adx!=null&&!isNaN(adx);
  const trendStrong=hasAdx&&adx>=s.ADX_STRONG,trendWeak=hasAdx&&adx<s.ADX_WEAK;
  const hasVol=volRatio!=null&&!isNaN(volRatio),highVol=hasVol&&volRatio>=s.VOL_RATIO_HIGH;
  const tol=Math.max(1e-6,Math.abs(price)*s.MACD_ZERO_TOL_PCT);
  const hasMl=macdLine!=null&&!isNaN(macdLine),hasMh=macdHist!=null&&!isNaN(macdHist);
  const macdBull=hasMl&&macdLine>tol,macdBear=hasMl&&macdLine<-tol,macdAccel=hasMh&&macdHist>tol;
  const near52=dist52wHigh!=null&&!isNaN(dist52wHigh)&&dist52wHigh<=s.DIST_52W_HIGH_MAX;
  const brk=breakout20dPct!=null&&!isNaN(breakout20dPct)&&breakout20dPct>=s.BREAKOUT_20D_MIN;
  const stackBull=above20&&above50&&(ma20>ma50),stackBear=!above20&&!above50&&(ma20<ma50);
  const perfectBull=hasMa200&&stackBull&&above200&&(ma200<ma50);
  const perfectBear=stackBear&&(!hasMa200||!above200);
  const bullConf=macdBull||highVol||brk||(!hasMl&&!hasVol);
  const sBullConf=(trendStrong||!hasAdx)&&bullConf;
  if(perfectBull&&(near52||brk)&&highVol&&(macdBull||macdAccel||brk||!hasMl)&&(trendStrong||!hasAdx))return "🚀 BREAKOUT BUY";
  if(perfectBull&&oversold&&sBullConf)          return "🚀 STRONG BUY (Pullback)";
  if(perfectBull&&bullish&&sBullConf)           return "🚀 STRONG BUY";
  if(perfectBull&&(neutral||!hasRsi)&&bullConf) return "✅ BUY";
  if(perfectBull&&overbought)                   return "🟡 BUY (Overbought — trail SL)";
  if(stackBull&&overbought)                     return "🟡 HOLD (Overbought — watch)";
  if(stackBull&&bullConf&&!trendWeak)           return "✅ BUY";
  if(stackBull)                                 return "🟡 HOLD (Weak Trend)";
  if(!above20&&above50&&(macdBull||macdAccel))  return "⏸️ HOLD (Pullback)";
  if(!above20&&above50&&oversold)               return "⏸️ HOLD (Oversold — possible bounce)";
  if(!above20&&above50)                         return "⏸️ HOLD";
  if(perfectBear&&oversold&&(macdAccel||!macdBear))return "⚠️ SELL (Oversold — watch reversal)";
  if(perfectBear)                               return "🔴 SELL";
  if(!above50&&oversold)                        return "⚠️ WEAK (Oversold — possible bounce)";
  if(!above20&&!above50)                        return "🔴 SELL";
  return "⏸️ HOLD";
}

// =============================================================================
// FORMATTING
// =============================================================================
function applyBatchFormatting(sheet,data,firstFetch){
  if(!data.length)return;
  const bgs=[],fonts=[];
  data.forEach(row=>{const[bg,fc]=signalColor(String(row[C.SIGNAL]||""));bgs.push([bg]);fonts.push([fc]);});
  const rng=sheet.getRange(2,C.SIGNAL+1,data.length,1);
  rng.setBackgrounds(bgs);rng.setFontColors(fonts);
  firstFetch.forEach(idx=>sheet.getRange(idx+2,1,1,C._COUNT).setBackground(null));
}
function signalColor(sig){
  if(sig.includes("BREAKOUT BUY"))     return["#6A1B9A","#FFFFFF"];
  if(sig.includes("STRONG BUY (Pull")) return["#00695C","#FFFFFF"];
  if(sig.includes("STRONG BUY"))       return["#1B5E20","#FFFFFF"];
  if(sig.includes("✅ BUY"))           return["#4CAF50","#FFFFFF"];
  if(sig.includes("BUY (Overbought"))  return["#A5D6A7","#1B5E20"];
  if(sig.includes("HOLD (Overbought")) return["#FFE082","#BF360C"];
  if(sig.includes("HOLD (Weak"))       return["#FFF3E0","#E65100"];
  if(sig.includes("HOLD (Pull"))       return["#B2DFDB","#004D40"];
  if(sig.includes("HOLD (Oversold"))   return["#B2DFDB","#004D40"];
  if(sig.includes("⏸️ HOLD"))          return["#FFF9C4","#F57F17"];
  if(sig.includes("SELL (Oversold"))   return["#FF8A65","#FFFFFF"];
  if(sig.includes("🔴 SELL"))          return["#F44336","#FFFFFF"];
  if(sig.includes("WEAK"))             return["#FFCCBC","#BF360C"];
  return["#ECEFF1","#546E7A"];
}
function applyReturnConditionalFmt(sheet){
  const maxRow=Math.max(sheet.getLastRow(),2);
  sheet.clearConditionalFormatRules();
  const rules=[];
  RETURN_COLS.forEach(col=>{
    const rng=sheet.getRange(2,col+1,maxRow-1,1);
    rules.push(SpreadsheetApp.newConditionalFormatRule().whenNumberGreaterThan(0).setBackground("#E8F5E9").setFontColor("#1B5E20").setRanges([rng]).build());
    rules.push(SpreadsheetApp.newConditionalFormatRule().whenNumberLessThan(0).setBackground("#FFEBEE").setFontColor("#C62828").setRanges([rng]).build());
  });
  sheet.setConditionalFormatRules(rules);
}

// =============================================================================
// SHEET MANAGEMENT
// =============================================================================
function getOrCreateScanSheet(ss,scanName){
  let sh=ss.getSheetByName(scanName);
  if(!sh)sh=ss.insertSheet(scanName);
  if(CONFIG.SCAN_COLORS[scanName])sh.setTabColor(CONFIG.SCAN_COLORS[scanName]);
  ensureScanSheetSchema(sh);return sh;
}
function ensureScanSheetSchema(sh){
  if(sh.getMaxColumns()<HEADERS.length)sh.insertColumnsAfter(sh.getMaxColumns(),HEADERS.length-sh.getMaxColumns());
  const cur=sh.getRange(1,1,1,HEADERS.length).getValues()[0];
  if(HEADERS.some((h,i)=>cur[i]!==h))writeScanHeaders(sh);
}
function writeScanHeaders(sh){
  if(sh.getMaxColumns()<HEADERS.length)sh.insertColumnsAfter(sh.getMaxColumns(),HEADERS.length-sh.getMaxColumns());
  const r=sh.getRange(1,1,1,HEADERS.length);
  r.setValues([HEADERS]);
  r.setBackground("#1A237E").setFontColor("#FFFFFF").setFontWeight("bold").setFontSize(10).setWrap(true);
  sh.setFrozenRows(1);sh.setFrozenColumns(2);
  [80,160,110,110,75,95,95,90,60,60,60,60,60,60,60,60,90,90,80,80,80,70,80,80,80,170,125,70,85,85,85,95,95,80]
    .forEach((w,i)=>{if(i<HEADERS.length)sh.setColumnWidth(i+1,w);});
  const fr=Math.max(sh.getMaxRows()-1,1000);
  RETURN_COLS.forEach(c=>sh.getRange(2,c+1,fr,1).setNumberFormat("0.00"));
  PRICE_COLS.forEach(c=>sh.getRange(2,c+1,fr,1).setNumberFormat("₹#,##0.00"));
  [C.RSI14,C.ADX14].forEach(c=>sh.getRange(2,c+1,fr,1).setNumberFormat("0.0"));
  [C.VOL_RATIO20,C.MACD_LINE,C.MACD_HIST,C.DIST_52W_HIGH,C.BREAKOUT_20D]
    .forEach(c=>sh.getRange(2,c+1,fr,1).setNumberFormat("0.00"));
  applyReturnConditionalFmt(sh);
}
function ensureSystemSheets(ss){
  [CONFIG.DASHBOARD_SHEET,CONFIG.PRICE_HISTORY_SHEET,CONFIG.GOD_MODE_SHEET,CONFIG.LOG_SHEET]
    .forEach(name=>{if(!ss.getSheetByName(name))ss.insertSheet(name);});
  const ph=ss.getSheetByName(CONFIG.PRICE_HISTORY_SHEET);
  if(ph){
    if(ph.getMaxColumns()<PRICE_HISTORY_HEADERS.length)
      ph.insertColumnsAfter(ph.getMaxColumns(),PRICE_HISTORY_HEADERS.length-ph.getMaxColumns());
    const cur=ph.getRange(1,1,1,PRICE_HISTORY_HEADERS.length).getValues()[0];
    if(PRICE_HISTORY_HEADERS.some((h,i)=>cur[i]!==h)){
      ph.getRange(1,1,1,PRICE_HISTORY_HEADERS.length).setValues([PRICE_HISTORY_HEADERS])
        .setBackground("#004D40").setFontColor("#FFFFFF").setFontWeight("bold");
      ph.setFrozenRows(1);
    }
  }
}
function appendHistoryRows(ss,rows){
  if(!rows||!rows.length)return;
  const sh=ss.getSheetByName(CONFIG.PRICE_HISTORY_SHEET);
  if(!sh)return;
  const sr=sh.getLastRow()+1;
  if(sh.getMaxRows()<sr+rows.length)sh.insertRowsAfter(sh.getMaxRows(),rows.length);
  sh.getRange(sr,1,rows.length,H._COUNT).setValues(rows);
}
function buildHistoryRow(scanName,row,scanCount){
  return[
    fmtIST(new Date()),scanName,row[C.SYMBOL],row[C.NAME],row[C.IN_SCAN],
    row[C.CAPTURE_PRICE]||"",row[C.CURRENT_PRICE]||"",row[C.RET_CAPTURE]||"",
    row[C.RET_1D]||"",row[C.RET_1W]||"",row[C.RET_1M]||"",
    row[C.RET_3M]||"",row[C.RET_6M]||"",row[C.RET_1Y]||"",
    row[C.RSI14]||"",row[C.ADX14]||"",row[C.VOL_RATIO20]||"",
    row[C.MACD_LINE]||"",row[C.MACD_HIST]||"",
    row[C.DIST_52W_HIGH]||"",row[C.BREAKOUT_20D]||"",
    row[C.SIGNAL]||"",scanCount||1,
  ];
}
function batchWriteCol(sheet,updates,colNum,lastRow){
  if(!updates.length||lastRow<2)return;
  const nr=lastRow-1,rng=sheet.getRange(2,colNum,nr,1),vals=rng.getValues();
  updates.forEach(({rowIdx,value})=>{const i=rowIdx-2;if(i>=0&&i<vals.length)vals[i][0]=value;});
  rng.setValues(vals);
}

// =============================================================================
// GOD MODE SHEET
// =============================================================================
function updateGodModeSheet(ss,godMode,allResults,globalSymMap){
  const sh=ss.getSheetByName(CONFIG.GOD_MODE_SHEET);if(!sh)return;
  sh.clearContents();sh.clearFormats();
  const hdrs=["Symbol","Name","Close ₹","Chng %","Scans Matched","Status","Captured At"];
  sh.getRange(1,1,1,hdrs.length).setValues([hdrs]).setBackground("#B71C1C").setFontColor("#FFF").setFontWeight("bold");
  sh.setFrozenRows(1);
  if(!godMode.length){sh.getRange(2,1).setValue("No GOD MODE stocks today.").setFontColor("#888");return;}
  const s5a=allResults["S5A GOD DailyWeekly"]||[];
  godMode.forEach((sym,ri)=>{
    const s=s5a.find(x=>x.nsecode===sym);if(!s)return;
    sh.getRange(ri+2,1,1,hdrs.length)
      .setValues([[s.nsecode,s.name,parseFloat(s.close)||"",parseFloat(s.per_chg)||"",
                   (globalSymMap[sym]||1)+"/6","★ GOD MODE",fmtIST(new Date())]])
      .setBackground("#FFF9C4");
  });
  [100,250,90,80,110,140,130].forEach((w,i)=>sh.setColumnWidth(i+1,w));
}

// =============================================================================
// DASHBOARD
// =============================================================================
function updateDashboard(ss,allResults,globalSymMap,godMode){
  const sh=ss.getSheetByName(CONFIG.DASHBOARD_SHEET);if(!sh)return;
  sh.clearContents();sh.clearFormats();
  let r=1;
  const hdr=(text,bg,fg)=>{sh.getRange(r,1,1,8).merge().setValue(text).setBackground(bg||"#333").setFontColor(fg||"#FFF").setFontWeight("bold").setFontSize(11);r++;};
  const rowHdr=(cols,bg)=>{sh.getRange(r,1,1,cols.length).setValues([cols]).setFontWeight("bold").setBackground(bg||"#E0E0E0");r++;};
  const dataRow=(vals,bg)=>{sh.getRange(r,1,1,vals.length).setValues([vals]);if(bg)sh.getRange(r,1,1,vals.length).setBackground(bg);r++;};
  sh.getRange(r,1,1,8).merge().setValue("CHARTINK BULLISH SCREENER  |  "+fmtIST(new Date())).setBackground("#1A237E").setFontColor("#FFF").setFontWeight("bold").setFontSize(12);r++;r++;
  hdr("★ GOD MODE — All 3 Timeframes  ("+godMode.length+" stocks)","#B71C1C");
  if(godMode.length){
    rowHdr(["Symbol","Name","Close ₹","Chng %","Scans","Status"],"#FFD700");
    const s5a=allResults["S5A GOD DailyWeekly"]||[];
    godMode.forEach(sym=>{const s=s5a.find(x=>x.nsecode===sym);if(s)dataRow([s.nsecode,s.name,parseFloat(s.close)||"",parseFloat(s.per_chg)||"",(globalSymMap[sym]||1)+"/6","★ GOD MODE"],"#FFF9C4");});
  } else {sh.getRange(r,1).setValue("None today").setFontColor("#888");r++;}r++;
  const hc=Object.entries(globalSymMap).filter(([,c])=>c>=3).sort(([,a],[,b])=>b-a);
  hdr("HIGH CONVICTION — 3+ Scans ("+hc.length+" stocks)","#1B5E20");
  if(hc.length){
    rowHdr(["Symbol","Name","Close ₹","Chng %","Scans Matched"],"#A5D6A7");
    hc.forEach(([sym,cnt])=>{const flat=Object.values(allResults).flat(),s=flat.find(x=>x.nsecode===sym);if(s)dataRow([s.nsecode,s.name,parseFloat(s.close)||"",parseFloat(s.per_chg)||"",cnt+"/6"],"#E8F5E9");});
  } else {sh.getRange(r,1).setValue("None today").setFontColor("#888");r++;}r++;
  for(const[name,stocks]of Object.entries(allResults)){
    hdr(name+"  ("+stocks.length+" stocks)","#37474F");
    if(!stocks.length){sh.getRange(r,1).setValue("No matches").setFontColor("#AAA");r++;}
    else{rowHdr(["Symbol","Name","Close ₹","Chng %","Volume"]);stocks.forEach(s=>dataRow([s.nsecode,s.name,parseFloat(s.close)||"",parseFloat(s.per_chg)||"",parseInt(s.volume)||""]));}
    r++;
  }
  [110,280,100,90,110,140,110].forEach((w,i)=>sh.setColumnWidth(i+1,w));
}

// =============================================================================
// EMAIL ALERT
// =============================================================================
function sendEmailAlert(godMode,allNewStocks,globalSymMap){
  const ts=fmtIST(new Date());
  const hc=Object.entries(globalSymMap).filter(([,c])=>c>=3).sort(([,a],[,b])=>b-a).map(([s,c])=>s+"("+c+"/6)");
  const subject="📈 Chartink: "+godMode.length+" GOD MODE | "+hc.length+" HC ["+ts+"]";
  let body="CHARTINK SCREENER ALERT\n"+ts+"\n\n";
  if(godMode.length)     body+="★ GOD MODE:\n"+godMode.join("\n")+"\n\n";
  if(hc.length)          body+="HIGH CONVICTION:\n"+hc.join("\n")+"\n\n";
  if(allNewStocks.length)body+="NEW STOCKS:\n"+allNewStocks.map(({scan,stocks})=>scan+": "+stocks.map(s=>s.nsecode).join(", ")).join("\n")+"\n";
  body+="\nOpen your sheet for full details.";
  MailApp.sendEmail({to:CONFIG.ALERT_EMAIL,subject,body});
}

// =============================================================================
// SCHEDULE CHECK
// =============================================================================
function getRunScheduleStatus(){
  const ist=new Date(new Date().toLocaleString("en-US",{timeZone:"Asia/Kolkata"}));
  const day=ist.getDay(),h=ist.getHours(),m=ist.getMinutes();
  const nowVal=h*60+m,startVal=CONFIG.MARKET_START_HOUR*60+CONFIG.MARKET_START_MINUTE,endVal=CONFIG.MARKET_END_HOUR*60+CONFIG.MARKET_END_MINUTE;
  if(CONFIG.ACTIVE_DATE_RANGES&&CONFIG.ACTIVE_DATE_RANGES.length>0){
    const today=Utilities.formatDate(ist,"Asia/Kolkata","yyyy-MM-dd");
    const inRange=CONFIG.ACTIVE_DATE_RANGES.some(r=>today>=r.from&&today<=r.to);
    if(!inRange)return{isLiveWindow:false,reason:"Outside configured date ranges"};
  } else {
    if(day===0||day===6)return{isLiveWindow:false,reason:"Weekend"};
  }
  if(nowVal<startVal)return{isLiveWindow:false,reason:"Before market open"};
  if(nowVal>endVal)  return{isLiveWindow:false,reason:"After market close"};
  return{isLiveWindow:true};
}

// =============================================================================
// UTILS
// =============================================================================
function isTimedOut(start){return Date.now()-start>=CONFIG.MAX_RUN_MS;}
function msToSec(ms){return(ms/1000).toFixed(1);}
function log(ss,msg){
  Logger.log(msg);
  const sh=ss.getSheetByName(CONFIG.LOG_SHEET);if(!sh)return;
  sh.appendRow([fmtIST(new Date()),msg]);
  const lr=sh.getLastRow();
  if(lr>CONFIG.MAX_LOG_ROWS+1)sh.deleteRows(2,lr-CONFIG.MAX_LOG_ROWS-1);
}
function fmtIST(d){return Utilities.formatDate(d,"Asia/Kolkata","dd-MMM-yyyy HH:mm:ss");}

// =============================================================================
// SETUP + HELPERS
// =============================================================================
function setupAllSheets(){
  const ss=SpreadsheetApp.getActiveSpreadsheet();
  ensureSystemSheets(ss);
  Object.keys(CONFIG.SCANS).forEach(name=>getOrCreateScanSheet(ss,name));
  try{SpreadsheetApp.getUi().alert("✅ Setup complete!\n\nAll scan tabs + system sheets created.\n\nNEXT STEPS:\n1. Scanner → 🧪 Test All Scans (verify connection)\n2. Scanner → 📌 Install Recurring Trigger (start automation)");}
  catch(_){Logger.log("Setup complete.");}
}
function clearPriceHistory(){
  const ui=SpreadsheetApp.getUi();
  if(ui.alert("Clear history?","Deletes all Price History rows. Cannot be undone.",ui.ButtonSet.YES_NO)===ui.Button.YES){
    const sh=SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CONFIG.PRICE_HISTORY_SHEET);
    if(sh&&sh.getLastRow()>1)sh.deleteRows(2,sh.getLastRow()-1);
    ui.alert("Price history cleared.");
  }
}
function testYahooFetch(){
  const sym="RELIANCE";
  const hist=normalizeHistory(fetchYahooHistory(sym));
  if(!hist){Logger.log("❌ No data for "+sym+CONFIG.YF_SUFFIX);return;}
  const closes=hist.closes,n=closes.length,cur=closes[n-1];
  const ma20=calcMA(closes,20),ma50=calcMA(closes,50),ma200=calcMA(closes,200);
  const rsi=calcRSI(closes,14),adx=calcADX(hist.highs,hist.lows,closes,14);
  const volR=calcVolumeRatio(hist.volumes,20,hist.timestamps);
  const macd=calcMACD(closes,12,26,9);
  const d52=calcDistanceFromHigh(hist.highs,closes,252),brk=calcBreakoutPct(hist.highs,closes,20);
  Logger.log("✅ "+sym+" | "+n+" days | ₹"+roundN(cur,2));
  Logger.log("   1D:"+pct(periodReturn(closes,n,1))+"% 1W:"+pct(periodReturn(closes,n,5))+"% 1M:"+pct(periodReturn(closes,n,21))+"%");
  Logger.log("   MA20:"+roundN(ma20,2)+" MA50:"+roundN(ma50,2)+" MA200:"+roundN(ma200,2));
  Logger.log("   RSI:"+roundN(rsi,1)+" ADX:"+roundN(adx,1)+" VolRatio:"+roundN(volR,2)+"x");
  Logger.log("   MACD:"+roundN(macd.macdLine,2)+" Hist:"+roundN(macd.histogram,2));
  Logger.log("   52W Dist:"+pct(d52)+"% 20D Breakout:"+pct(brk)+"%");
  Logger.log("   Signal: "+calcSignal({price:cur,ma20,ma50,ma200,rsi,adx,volRatio:volR,
    macdLine:macd.macdLine,macdHist:macd.histogram,dist52wHigh:d52,breakout20dPct:brk}));
}
