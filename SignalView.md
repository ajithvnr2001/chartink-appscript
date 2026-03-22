# 📊 SignalView — Signal Engine Deep Dive

> Complete reference for the 13-tier signal classification system used in
> Chartink Multi-Scan Tracker v5. Covers tier definitions, thresholds,
> signal profiles, color coding, and the exact decision logic.

---

## Table of Contents

1. [Why a Signal Engine](#why-a-signal-engine)
2. [Input Indicators](#input-indicators)
3. [Signal Profiles](#signal-profiles)
4. [The 13 Signal Tiers](#the-13-signal-tiers)
5. [Decision Tree (Full Logic)](#decision-tree-full-logic)
6. [Color Reference](#color-reference)
7. [Indicator Calculations](#indicator-calculations)
8. [Reading Signals in Context](#reading-signals-in-context)
9. [Switching Profiles](#switching-profiles)
10. [Edge Cases & Guards](#edge-cases--guards)

---

## Why a Signal Engine

The Chartink scans tell you **which stocks match a filter** — they don't tell you
**what to do with them**. A stock can appear in S1 (Ultra Daily) today but be
overbought, have weak trend strength, or be below its 200 MA.

The signal engine reads 10 technical indicators fetched from Yahoo Finance and
produces one human-readable, color-coded action tier per stock per run. It is
NOT a trading system — it is a structured summary of current technical posture.

---

## Input Indicators

The signal engine receives these computed values for each stock:

| Input | Source | What It Measures |
|---|---|---|
| `price` | Yahoo close | Current price |
| `ma20` | SMA(20) | Short-term trend direction |
| `ma50` | SMA(50) | Medium-term trend direction |
| `ma200` | SMA(200) | Long-term trend direction / bull-bear line |
| `rsi` | RSI(14) | Momentum / overbought / oversold |
| `adx` | ADX(14) | Trend strength (not direction) |
| `volRatio` | Vol ÷ EMA(Vol,20) | Volume conviction |
| `macdLine` | EMA12 − EMA26 | Momentum direction |
| `macdHist` | MACD − Signal | Momentum acceleration |
| `dist52wHigh` | (52wHigh − close)/52wHigh × 100 | Proximity to resistance/breakout |
| `breakout20dPct` | (close − 20dHigh)/20dHigh × 100 | Recent breakout strength |

All values are computed locally from Yahoo Finance 3-year OHLCV data.
No indicator is fetched from an external API.

---

## Signal Profiles

Three profiles control the **thresholds** used in every signal decision.
Switch at any time from the Scanner menu — takes effect on the next run.

### Threshold Comparison Table

| Threshold | Conservative | Balanced | Aggressive |
|---|---|---|---|
| ADX Strong (trend confirmed) | ≥ 25 | ≥ 20 | ≥ 18 |
| ADX Weak (trend too weak) | < 18 | < 16 | < 14 |
| Vol Ratio High (volume spike) | ≥ 1.5× | ≥ 1.25× | ≥ 1.1× |
| RSI Oversold | ≤ 30 | ≤ 32 | ≤ 35 |
| RSI Neutral Min | ≥ 45 | ≥ 45 | ≥ 42 |
| RSI Bullish Min | ≥ 55 | ≥ 52 | ≥ 50 |
| RSI Overbought | ≥ 78 | ≥ 78 | ≥ 80 |
| 52W High Dist Max (near high) | ≤ 2% | ≤ 3% | ≤ 5% |
| 20D Breakout Min | ≥ 0.75% | ≥ 0.25% | ≥ 0% |
| MACD Zero Tolerance | 0.005% | 0.005% | 0.005% |

### Which Profile to Use

**Conservative** — Use when capital at risk is higher, when market is choppy,
or when you want fewer but higher-quality entries. Requires stronger ADX,
tighter RSI, bigger volume spike.

**Balanced** — Recommended default. Works well in trending markets.
Catches most good setups without too much noise.

**Aggressive** — Use in strong bull markets when you want early entries.
More signals, but higher proportion of false signals. Requires active monitoring.

---

## The 13 Signal Tiers

Listed from highest conviction (top) to most bearish (bottom).

---

### 🚀 BREAKOUT BUY

**The rarest and strongest signal.**

```
Requires ALL of:
  ✅ Perfect bull stack: price > MA20 > MA50 > MA200 (all 4 rising)
  ✅ Near 52-week high (within threshold, e.g. 3% for Balanced)
     OR 20-day breakout confirmed
  ✅ Volume spike above threshold (e.g. 1.25× for Balanced)
  ✅ MACD line positive OR MACD histogram positive OR breakout confirmed
  ✅ ADX above strong threshold (e.g. ≥ 20 for Balanced) OR ADX not available
```

**What it means:**
Stock is at or near a multi-month resistance level, breaking out with
strong volume and trend momentum confirmed across all indicators.
Classic "stage 2 breakout" setup.

**Typical action:** High-priority watchlist. Consider entry with tight stop
below recent consolidation. Volume confirmation is key.

---

### 🚀 STRONG BUY (Pullback)

```
Requires:
  ✅ Perfect bull stack (price > MA20 > MA50 > MA200)
  ✅ RSI oversold (≤ threshold, e.g. ≤ 32 for Balanced)
  ✅ ADX strong OR ADX unavailable
  ✅ MACD bullish OR high volume OR 20D breakout
```

**What it means:**
A high-quality stock in a strong uptrend that has pulled back enough
for RSI to reach oversold territory. These are often the best risk/reward
entries — buying a dip in a bull trend.

**Typical action:** Ideal entry zone. Stop loss below MA50 or recent swing low.

---

### 🚀 STRONG BUY

```
Requires:
  ✅ Perfect bull stack (price > MA20 > MA50 > MA200)
  ✅ RSI in bullish zone (e.g. 52–77 for Balanced)
  ✅ ADX strong OR ADX unavailable
  ✅ MACD bullish OR high volume OR 20D breakout
```

**What it means:**
Stock is in a strong uptrend with momentum in the ideal RSI zone.
No pullback to wait for — trend is live and indicators confirm.

**Typical action:** Valid entry. Trail stop loss with MA20.

---

### ✅ BUY

**Two paths to this signal:**

**Path 1 — Perfect stack, neutral RSI:**
```
  ✅ Perfect bull stack (price > MA20 > MA50 > MA200)
  ✅ RSI in neutral zone (e.g. 45–51 for Balanced) OR RSI unavailable
  ✅ MACD bullish OR high volume OR 20D breakout
```

**Path 2 — Partial stack, strong trend:**
```
  ✅ price > MA20 > MA50 (MA200 not required)
  ✅ ADX not weak
  ✅ MACD bullish OR high volume OR 20D breakout
```

**What it means:**
Solid setup but either MA200 alignment is missing, RSI hasn't reached
the bullish zone yet, or trend strength is moderate. Still actionable.

**Typical action:** Consider entry with smaller position. Add on confirmation.

---

### 🟡 BUY (Overbought — trail SL)

```
  ✅ Perfect bull stack (price > MA20 > MA50 > MA200)
  ⚠️ RSI overbought (≥ threshold, e.g. ≥ 78)
```

**What it means:**
Strong uptrend but momentum is stretched. Risk of short-term pullback.
Existing holders should tighten stop losses. New entries risky.

**Typical action:** If already holding — trail stop aggressively.
If watching — wait for RSI to cool below 70 before entering.

---

### 🟡 HOLD (Overbought — watch)

```
  ✅ price > MA20 > MA50 (no MA200 requirement)
  ⚠️ RSI overbought
```

**What it means:**
Partial trend alignment with overbought momentum.
The trend is real but the stock needs to digest recent gains.

**Typical action:** Hold with tight stop. Not an entry point.

---

### 🟡 HOLD (Weak Trend)

```
  ✅ price > MA20 > MA50 (partial bull stack)
  ❌ ADX below weak threshold (choppy / ranging)
  (regardless of MACD / volume)
```

**What it means:**
Price is above short/medium MAs but the move lacks conviction.
ADX says the market is trending weakly — could be consolidation
before a bigger move either way.

**Typical action:** Watch and wait. Set an alert for ADX crossing above
your threshold. Not a new entry.

---

### ⏸️ HOLD (Pullback)

```
  ✅ price above MA50 (medium term intact)
  ❌ price below MA20 (short-term trend broken)
  ✅ MACD line positive OR MACD histogram positive
```

**What it means:**
Stock is pulling back within a larger uptrend. The medium-term structure
is intact (above MA50) and MACD still shows positive momentum.
Likely a normal correction.

**Typical action:** Existing holders — hold. Potential buyers — watch
for price to reclaim MA20 as entry trigger.

---

### ⏸️ HOLD (Oversold — possible bounce)

```
  ✅ price above MA50 (medium term intact)
  ❌ price below MA20
  ✅ RSI oversold
```

**What it means:**
Similar to Pullback HOLD but momentum has reached oversold.
Bounce candidates. Risk is medium-term trend breaks if MA50 fails.

**Typical action:** Speculative bounce play only. Strict stop below MA50.

---

### ⏸️ HOLD

```
  ✅ price above MA50
  ❌ price below MA20
  (no MACD / volume / RSI qualifiers met)
```

**What it means:**
In between — not strong enough to buy, not broken enough to sell.
Medium-term uptrend exists but short-term is weak.

**Typical action:** Hold current position. No new entries.

---

### ⚠️ SELL (Oversold — watch reversal)

```
  ✅ Full bear stack: price < MA20 < MA50 < MA200 (or no MA200)
  ✅ RSI oversold
  ✅ MACD histogram positive (deceleration of downtrend) OR MACD not bearish
```

**What it means:**
Stock is in a downtrend but has become oversold and downside momentum
is decelerating. Could be near a bottom / reversal.

**Typical action:** Exit or reduce position. For speculative reversal traders —
watch for price to reclaim MA20 as confirmation.

---

### 🔴 SELL

**Two paths:**

**Path 1 — Perfect bear stack:**
```
  ✅ price < MA20 < MA50 < MA200
  (RSI not oversold OR MACD still bearish)
```

**Path 2 — Below both MAs:**
```
  ❌ price below MA20
  ❌ price below MA50
  (not full bear stack required)
```

**What it means:**
Clear downtrend. No reason to hold. Risk of further deterioration.

**Typical action:** Exit. Do not average down.

---

### ⚠️ WEAK (Oversold — possible bounce)

```
  ❌ price below MA50
  ✅ RSI oversold
  (not a full bear stack)
```

**What it means:**
Below medium-term MA but oversold. Between HOLD and SELL territory.
Some stocks in this state are bottoming, many continue lower.

**Typical action:** Weak hold at best. Consider reducing exposure.

---

### ⚪ Insufficient Data

```
  price or ma20 or ma50 is null / NaN / zero
```

**What it means:**
Yahoo Finance returned insufficient history for calculation.
Common for newly listed stocks, very illiquid stocks, or after
corporate actions that reset price history.

**Typical action:** Verify the stock manually on Yahoo Finance or TradingView.

---

## Decision Tree (Full Logic)

```
calcSignal(price, ma20, ma50, ma200, rsi, adx, volRatio, macdLine, macdHist, dist52wHigh, breakout20dPct)
    │
    ├── price / ma20 / ma50 missing or NaN?
    │       └── ⚪ Insufficient Data
    │
    ├── Compute boolean flags:
    │   above20     = price > ma20
    │   above50     = price > ma50
    │   above200    = price > ma200 (if ma200 available)
    │   overbought  = rsi >= RSI_OVERBOUGHT
    │   oversold    = rsi <= RSI_OVERSOLD
    │   bullish     = RSI_BULLISH_MIN <= rsi < RSI_OVERBOUGHT
    │   neutral     = RSI_NEUTRAL_MIN <= rsi < RSI_BULLISH_MIN
    │   trendStrong = adx >= ADX_STRONG
    │   trendWeak   = adx < ADX_WEAK
    │   highVol     = volRatio >= VOL_RATIO_HIGH
    │   macdBull    = macdLine > tol
    │   macdBear    = macdLine < -tol
    │   macdAccel   = macdHist > tol
    │   near52      = dist52wHigh <= DIST_52W_HIGH_MAX
    │   brk         = breakout20dPct >= BREAKOUT_20D_MIN
    │
    ├── Compute stack flags:
    │   stackBull   = above20 AND above50 AND ma20 > ma50
    │   stackBear   = !above20 AND !above50 AND ma20 < ma50
    │   perfectBull = stackBull AND above200 AND ma200 < ma50
    │   perfectBear = stackBear AND (!ma200 OR !above200)
    │
    ├── Compute confirmation flags:
    │   bullConf    = macdBull OR highVol OR brk OR (no macd AND no vol data)
    │   sBullConf   = (trendStrong OR no adx) AND bullConf
    │
    ├── TIER CHECK (order matters — first match wins):
    │
    │   1. perfectBull AND (near52 OR brk) AND highVol
    │      AND (macdBull OR macdAccel OR brk OR no macd)
    │      AND (trendStrong OR no adx)
    │         → 🚀 BREAKOUT BUY
    │
    │   2. perfectBull AND oversold AND sBullConf
    │         → 🚀 STRONG BUY (Pullback)
    │
    │   3. perfectBull AND bullish AND sBullConf
    │         → 🚀 STRONG BUY
    │
    │   4. perfectBull AND (neutral OR no rsi) AND bullConf
    │         → ✅ BUY
    │
    │   5. perfectBull AND overbought
    │         → 🟡 BUY (Overbought — trail SL)
    │
    │   6. stackBull AND overbought
    │         → 🟡 HOLD (Overbought — watch)
    │
    │   7. stackBull AND bullConf AND NOT trendWeak
    │         → ✅ BUY
    │
    │   8. stackBull (any other condition)
    │         → 🟡 HOLD (Weak Trend)
    │
    │   9. !above20 AND above50 AND (macdBull OR macdAccel)
    │         → ⏸️ HOLD (Pullback)
    │
    │  10. !above20 AND above50 AND oversold
    │         → ⏸️ HOLD (Oversold — possible bounce)
    │
    │  11. !above20 AND above50 (other)
    │         → ⏸️ HOLD
    │
    │  12. perfectBear AND oversold AND (macdAccel OR NOT macdBear)
    │         → ⚠️ SELL (Oversold — watch reversal)
    │
    │  13. perfectBear
    │         → 🔴 SELL
    │
    │  14. !above50 AND oversold
    │         → ⚠️ WEAK (Oversold — possible bounce)
    │
    │  15. !above20 AND !above50
    │         → 🔴 SELL
    │
    └── Default (above50, below20, ambiguous):
           → ⏸️ HOLD
```

---

## Color Reference

Each signal tier has a distinct background and font color in the spreadsheet:

| Signal | Background | Font | Hex BG | Hex Font |
|---|---|---|---|---|
| 🚀 BREAKOUT BUY | Deep Purple | White | `#6A1B9A` | `#FFFFFF` |
| 🚀 STRONG BUY (Pullback) | Dark Teal | White | `#00695C` | `#FFFFFF` |
| 🚀 STRONG BUY | Dark Green | White | `#1B5E20` | `#FFFFFF` |
| ✅ BUY | Medium Green | White | `#4CAF50` | `#FFFFFF` |
| 🟡 BUY (Overbought) | Light Green | Dark Green | `#A5D6A7` | `#1B5E20` |
| 🟡 HOLD (Overbought) | Amber | Dark Brown | `#FFE082` | `#BF360C` |
| 🟡 HOLD (Weak Trend) | Light Orange | Dark Orange | `#FFF3E0` | `#E65100` |
| ⏸️ HOLD (Pullback) | Light Teal | Dark Teal | `#B2DFDB` | `#004D40` |
| ⏸️ HOLD (Oversold) | Light Teal | Dark Teal | `#B2DFDB` | `#004D40` |
| ⏸️ HOLD | Light Yellow | Amber | `#FFF9C4` | `#F57F17` |
| ⚠️ SELL (Oversold) | Salmon | White | `#FF8A65` | `#FFFFFF` |
| 🔴 SELL | Red | White | `#F44336` | `#FFFFFF` |
| ⚠️ WEAK | Peach | Dark Brown | `#FFCCBC` | `#BF360C` |
| ⚪ Insufficient Data | Light Grey | Steel | `#ECEFF1` | `#546E7A` |

---

## Indicator Calculations

### RSI(14) — Wilder's Smoothing

```
1. Compute daily changes: ch[i] = close[i] - close[i-1]
2. Separate into gains (g) and losses (l)
3. Initial avg gain = sum(gains[0..13]) / 14
   Initial avg loss = sum(losses[0..13]) / 14
4. Smoothed (Wilder's):
   avgGain[i] = (avgGain[i-1] × 13 + gain[i]) / 14
   avgLoss[i] = (avgLoss[i-1] × 13 + loss[i]) / 14
5. RS = avgGain / avgLoss
   RSI = 100 - (100 / (1 + RS))
```

Special case: avgLoss = 0 → RSI = 100

---

### ADX(14) — Wilder's Method

```
1. For each bar:
   +DM = high[i] - high[i-1]  (if positive and > -DM, else 0)
   -DM = low[i-1] - low[i]    (if positive and > +DM, else 0)
   TR  = max(high-low, |high-prev_close|, |low-prev_close|)

2. Smooth over 14 periods (Wilder's):
   TR14[i]  = TR14[i-1]  - (TR14[i-1]/14)  + TR[i]
   +DM14[i] = +DM14[i-1] - (+DM14[i-1]/14) + +DM[i]
   -DM14[i] = -DM14[i-1] - (-DM14[i-1]/14) + -DM[i]

3. +DI14 = 100 × (+DM14 / TR14)
   -DI14 = 100 × (-DM14 / TR14)

4. DX = 100 × |+DI14 - -DI14| / (+DI14 + -DI14)

5. ADX = Wilder's smooth of DX over 14 periods
```

ADX measures **trend strength only**, not direction.
ADX < 20: ranging/choppy. ADX 20–25: emerging trend. ADX > 25: strong trend.

---

### MACD(12, 26, 9)

```
1. fastEMA  = EMA(close, 12)
2. slowEMA  = EMA(close, 26)
3. macdLine = fastEMA - slowEMA
4. signal   = EMA(macdLine, 9)
5. histogram = macdLine - signal
```

EMA uses standard formula: `EMA[i] = ((close[i] - EMA[i-1]) × k) + EMA[i-1]`
where `k = 2 / (period + 1)`

MACD line > 0 = bullish momentum overall.
MACD histogram > 0 = momentum accelerating upward.

---

### Volume Ratio

```
volRatio = currentVolume / mean(volume[-20..-1])
```

Live session guard: if today's data is partial (market still open),
use yesterday's volume as current instead of today's partial volume.

volRatio > 1.25 (Balanced): Above-average volume — institutional activity likely.
volRatio > 2.0: Exceptional volume — watch for breakout or breakdown.

---

### 52-Week High Distance

```
high52w = max(high[-252..now])
dist52wHigh = (high52w - close) / high52w × 100
```

0% = at the 52-week high (breakout zone).
> 3% = below recent resistance.
> 20% = deep correction territory.

---

### 20-Day Breakout %

```
high20d = max(high[-21..-1])   ← excludes today
breakout20dPct = (close - high20d) / high20d × 100
```

Positive = stock closed above prior 20-day high (breakout confirmed).
Negative = stock is below recent 20-day high (no breakout).

---

## Reading Signals in Context

### Signal vs Scan Tab

A stock can appear in S1 (strong momentum scan) but show **⏸️ HOLD** signal.
This means:
- The Chartink scan caught it based on real-time/daily closing prices
- But Yahoo Finance technicals show a weakening setup (e.g., below MA20)
- Common during intraday reversals or when scans use slightly different data timing

**Rule:** The signal is computed from Yahoo's end-of-day data.
Chartink uses NSE real-time prices. On the same day, they can differ.

---

### Multiple Scan Matches (Scans Matched column)

A stock appearing in 3+ scans is called **High Conviction**.

| Scans Matched | Label | Confidence |
|---|---|---|
| 1/6 | Single scan | Normal — validate before acting |
| 2/6 | Dual scan | Moderate conviction |
| 3/6 | High Conviction | Strong — multiple timeframes agree |
| 4–5/6 | Very High Conviction | Very strong — investigate immediately |
| 6/6 | Maximum | Near-impossible in practice |

GOD MODE (S5A + S5B match) = minimum 2/6 by definition,
but GOD MODE stocks usually also appear in S1 or S4, giving 3–4/6.

---

### Signal Reliability by Market Condition

| Market | Most Reliable Signals | Least Reliable |
|---|---|---|
| Strong bull trend | 🚀 STRONG BUY, ✅ BUY | ⏸️ HOLD (many false holds) |
| Sideways/ranging | ⏸️ HOLD, 🟡 HOLD (Weak) | 🚀 BREAKOUT BUY (false breakouts) |
| Correction | ⚠️ SELL (Oversold), 🔴 SELL | ✅ BUY (catching falling knives) |
| Early recovery | 🚀 STRONG BUY (Pullback) | all others |

During sideways markets, consider switching to **Conservative profile**
to reduce noise signals.

---

## Switching Profiles

From the Scanner menu:
```
📈 Scanner → 📊 Conservative Profile
📈 Scanner → 📊 Balanced Profile      ← default
📈 Scanner → 📊 Aggressive Profile
```

The selected profile is stored in GAS Script Properties.
It persists across runs. Changing it takes effect immediately on the next
`calcSignal()` call — no re-fetch needed.

To check the current profile, look at which menu item you last clicked.
There's no display indicator in the sheet (future improvement).

---

## Edge Cases & Guards

### Missing MA200

When fewer than 200 days of data are available (new listings, data gaps):
- `ma200` is `null`
- `above200` is forced `false`
- `perfectBull` requires `ma200 < ma50` — cannot be achieved without MA200
- Stock falls back to `stackBull` checks (partial BUY / HOLD territory)
- Never produces a false 🚀 signal without MA200 confirmation

### Missing RSI / ADX / MACD

All indicators are individually null-checked. If unavailable:
- `hasRsi = false` → RSI-based conditions are skipped
- `hasAdx = false` → ADX gates pass (treated as "not weak")
- `hasMl = false` / `hasMh = false` → MACD gates default to permissive

The logic is designed so that **missing data defaults to the less-restrictive
path, not the more-bullish one**. A stock with no MACD still needs
high volume OR breakout to confirm.

### MACD Zero Tolerance

```javascript
const tol = Math.max(1e-6, Math.abs(price) × MACD_ZERO_TOL_PCT);
macdBull = macdLine > tol;   // not just > 0
macdBear = macdLine < -tol;
```

Prevents noise around zero from flipping signals on flat MACD.
For a ₹1000 stock with `MACD_ZERO_TOL_PCT = 0.00005`:
- tol = 1000 × 0.00005 = 0.05
- MACD must be > 0.05 to be "bullish"

This prevents the signal from flipping on ₹0.001 MACD moves.

### Insufficient Data Guard

```javascript
if (!price || !ma20 || !ma50 || isNaN(price) || isNaN(ma20) || isNaN(ma50))
  return "⚪ Insufficient Data";
```

Checked before any other logic. A stock with broken data never
produces a buy or sell signal — only the neutral grey indicator.
