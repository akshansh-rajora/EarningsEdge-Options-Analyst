import { Router } from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = Router();

const AVAILABLE_TICKERS = (process.env.AVAILABLE_TICKERS || "AAPL,DIS,FMC,KO,ORA").split(",").map(s => s.trim().toUpperCase());

function loadCSVData(): Map<string, Array<{ date: string; price: number }>> {
  // Try several candidate locations for the CSV file so the app works when run from project root
  // Priority:
  // 1. process.env.CSV_FILENAME (absolute or relative)
  // 2. project-root ./2526ADFTcourseworkData.csv (provided dataset)
  // 3. project-root ./from.csv
  // 4. __dirname ./from.csv
  // 5. __dirname ./data.csv
  const candidates: string[] = [];
  if (process.env.CSV_FILENAME) candidates.push(process.env.CSV_FILENAME);
  candidates.push(path.join(process.cwd(), "2526ADFTcourseworkData.csv"));
  candidates.push(path.join(process.cwd(), "from.csv"));
  candidates.push(path.join(__dirname, process.env.CSV_FILENAME || "from.csv"));
  candidates.push(path.join(__dirname, "data.csv"));

  let csvPath: string | null = null;
  for (const c of candidates) {
    if (!c) continue;
    // If candidate is absolute and exists, use it
    if (path.isAbsolute(c) && fs.existsSync(c)) {
      csvPath = c;
      break;
    }
    // Try as given (may be relative to CWD)
    const asGiven = path.join(process.cwd(), c);
    if (fs.existsSync(asGiven)) { csvPath = asGiven; break; }
    // Try relative to this file's directory
    const asLocal = path.join(__dirname, c);
    if (fs.existsSync(asLocal)) { csvPath = asLocal; break; }
    // Also try the candidate itself (in case it was already a path resolved by env)
    if (fs.existsSync(c)) { csvPath = c; break; }
  }

  if (!csvPath) {
    throw new Error(`CSV file not found. Tried candidates: ${candidates.join(" | ")}`);
  }

  const content = fs.readFileSync(csvPath, "utf-8");
  const lines = content.trim().split(/\r?\n/);
  if (lines.length === 0) return new Map();
  const headers = lines[0].split(",").map(h => h.trim().toUpperCase());
  
  const tickerData = new Map<string, Array<{ date: string; price: number }>>();
  
  // Initialize data arrays only for allowed tickers
  for (let i = 1; i < headers.length; i++) {
    const hdr = headers[i];
    if (AVAILABLE_TICKERS.includes(hdr)) {
      tickerData.set(hdr, []);
    }
  }
  
  // Parse data rows and only keep allowed tickers
  for (let i = 1; i < lines.length; i++) {
    // split on commas but tolerate extra whitespace
    const values = lines[i].split(",");
    const date = values[0];
    
    for (let j = 1; j < headers.length; j++) {
      const ticker = headers[j];
      if (!AVAILABLE_TICKERS.includes(ticker)) continue; // ignore columns not in allowed list
      const priceStr = values[j];
      
      if (priceStr && priceStr.trim() !== "") {
        const price = parseFloat(priceStr);
        if (!isNaN(price)) {
          tickerData.get(ticker)?.push({ date, price });
        }
      }
    }
  }
  
  return tickerData;
}

function calcHV(closes: number[], window = 20): number {
  if (closes.length < window + 1) return 0;
  const slice = closes.slice(-window - 1);
  const returns: number[] = [];
  for (let i = 1; i < slice.length; i++) {
    returns.push(Math.log(slice[i] / slice[i - 1]));
  }
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((a, b) => a + (b - mean) ** 2, 0) / (returns.length - 1);
  return parseFloat((Math.sqrt(variance * 252) * 100).toFixed(1));
}

function calcHVRank(closes: number[]): { hv30: number; hvRank: number } {
  if (closes.length < 31) return { hv30: 0, hvRank: 0 };
  const windows: number[] = [];
  for (let i = 30; i <= closes.length; i++) {
    windows.push(calcHV(closes.slice(0, i), 20));
  }
  const hv30 = windows[windows.length - 1];
  const sorted = [...windows].sort((a, b) => a - b);
  const rank = Math.round((sorted.indexOf(hv30) / (sorted.length - 1)) * 100);
  return { hv30, hvRank: rank };
}

router.post("/analyse", async (req, res) => {
  const { ticker } = req.body as { ticker?: string };
  if (!ticker || typeof ticker !== "string" || !ticker.trim()) {
    res.status(400).json({ error: "ticker is required" });
    return;
  }

  const t = ticker.trim().toUpperCase();

  // Validate ticker is available in CSV
  if (!AVAILABLE_TICKERS.includes(t)) {
    res.status(400).json({ error: `Ticker ${t} not available. Available tickers: ${AVAILABLE_TICKERS.join(", ")}` });
    return;
  }

  try {
    // Load CSV data
    const csvData = loadCSVData();
    const tickerHistory = csvData.get(t);

    if (!tickerHistory || tickerHistory.length === 0) {
      res.status(404).json({ error: `No data found for ticker ${t}` });
      return;
    }

    // Get last 180 days of data (or all if less than 180)
    const recentHistory = tickerHistory.slice(-180);
    const closes = recentHistory.map(d => d.price);
    
    // Get current price and previous day's price
    const lastDataPoint = recentHistory[recentHistory.length - 1];
    const prevDataPoint = recentHistory[recentHistory.length - 2];
    const currentPrice = lastDataPoint.price;
    const dayChangePct = prevDataPoint 
      ? ((currentPrice - prevDataPoint.price) / prevDataPoint.price) * 100 
      : 0;
    const lastBarDate = lastDataPoint.date;
    const high52w = closes.length > 0 ? Math.max(...closes) : 0;
    const low52w = closes.length > 0 ? Math.min(...closes) : 0;

    // Company info (hardcoded for the 5 stocks)
    const companyInfo: Record<string, { name: string; sector: string }> = {
      "AAPL": { name: "Apple Inc.", sector: "Technology" },
      "DIS": { name: "The Walt Disney Company", sector: "Entertainment" },
      "FMC": { name: "FMC Corporation", sector: "Chemicals" },
      "KO": { name: "The Coca-Cola Company", sector: "Consumer Goods" },
      "ORA": { name: "Ormat Technologies", sector: "Energy" }
    };
    const companyName = companyInfo[t]?.name || t;
    const sector = companyInfo[t]?.sector || "Unknown";
    const marketCap = 0; // Not available in CSV

    // Calculate historical volatility as proxy for IV
    const { hv30, hvRank } = calcHVRank(closes);

    // Expected move from HV (simplified: HV * sqrt(days/252) * price)
    const daysToExp = 7;
    const expectedMovePct = closes.length > 0
      ? parseFloat(((hv30 / 100) * Math.sqrt(daysToExp / 252) * 100).toFixed(1))
      : 0;

    // Historical earnings reactions (approximate from large daily moves)
    const bigMoves = closes.length > 1
      ? closes.slice(1).filter((c, i) => Math.abs((c - closes[i]) / closes[i]) > 0.04).length
      : 0;

    // Generate deterministic analysis based on CSV data (no AI required)
    const estimatedExpectedMove = expectedMovePct;
    const analysis: any = {
      ticker: t,
      company_name: companyName,
      sector,
      current_price: `$${currentPrice.toFixed(2)}`,
      day_change: `${dayChangePct >= 0 ? "+" : ""}${dayChangePct.toFixed(2)}%`,
      next_earnings: "Unknown (historical data only)",
      verdict: hvRank > 60 ? "BUY STRADDLE" : (hvRank < 30 ? "SELL PREMIUM" : "NEUTRAL"),
      confidence: Math.max(40, Math.min(90, hvRank)),
      data_quality: "HISTORICAL PRICE + HV PROXY",
      scores: {
        iv_setup: hvRank,
        expected_move_gap: Math.round(Math.max(0, Math.min(100, (estimatedExpectedMove / (hv30 || 1)) * 100))),
        analyst_sentiment: 50,
        historical_edge: Math.min(100, bigMoves * 10),
        timing_risk: 50
      },
      data: {
        iv_rank: `${hvRank}/100 (HV rank)` ,
        iv_percentile: `${hvRank}%`,
        hv_30: `${hv30}%`,
        expected_move_pct: `±${estimatedExpectedMove}%`,
        avg_historical_move: "N/A",
        move_gap: "N/A",
        straddle_cost_pct: `~${hv30}%`,
        analyst_eps_estimate: "N/A",
        beat_rate: "N/A",
        avg_beat_magnitude: "N/A",
        recent_revisions: "N/A"
      },
      strategy: {
        recommended: hvRank > 60 ? "Long straddle" : (hvRank < 30 ? "Sell premium" : "Wait"),
        entry_timing: "Before earnings (if confident)",
        max_risk: "$ defined by option prices",
        break_even_up: `$${(currentPrice * (1 + estimatedExpectedMove / 100)).toFixed(2)}`,
        break_even_down: `$${(currentPrice * (1 - estimatedExpectedMove / 100)).toFixed(2)}`
      },
      risks: ["Estimates only - no live IV", "Market events can invalidate expectation", "Historical data may not reflect current conditions"],
      brief: `Using CSV historical data (2013-2022), price $${currentPrice.toFixed(2)}, HV30 ${hv30}%, HV rank ${hvRank}/100, expected weekly move ±${estimatedExpectedMove}%. ${bigMoves} large daily moves observed in last 180 days. Combine with company earnings history to decide strategy.`
    };

    res.json(analysis);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    req.log.error({ err }, "EarningsEdge analyse error");
    res.status(500).json({ error: msg });
  }
});

export default router;
