const AVAILABLE_TICKERS = ["AAPL", "DIS", "FMC", "KO", "ORA"];

const companyInfo: Record<string, { name: string; sector: string }> = {
  "AAPL": { name: "Apple Inc.", sector: "Technology" },
  "DIS": { name: "The Walt Disney Company", sector: "Entertainment" },
  "FMC": { name: "FMC Corporation", sector: "Chemicals" },
  "KO": { name: "The Coca-Cola Company", sector: "Consumer Goods" },
  "ORA": { name: "Ormat Technologies", sector: "Energy" }
};

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

async function loadCSVData(): Promise<Map<string, Array<{ date: string; price: number }>>> {
  const response = await fetch('/data.csv');
  const content = await response.text();
  const lines = content.trim().split(/\r?\n/);
  if (lines.length === 0) return new Map();
  const headers = lines[0].split(",").map(h => h.trim().toUpperCase());
  
  const tickerData = new Map<string, Array<{ date: string; price: number }>>();
  
  for (let i = 1; i < headers.length; i++) {
    const hdr = headers[i];
    if (AVAILABLE_TICKERS.includes(hdr)) {
      tickerData.set(hdr, []);
    }
  }
  
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(",");
    const date = values[0];
    
    for (let j = 1; j < headers.length; j++) {
      const ticker = headers[j];
      if (!AVAILABLE_TICKERS.includes(ticker)) continue;
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

export async function analyzeTicker(ticker: string): Promise<any> {
  const t = ticker.trim().toUpperCase();
  
  if (!AVAILABLE_TICKERS.includes(t)) {
    throw new Error(`Ticker ${t} not available. Available tickers: ${AVAILABLE_TICKERS.join(", ")}`);
  }

  const csvData = await loadCSVData();
  const tickerHistory = csvData.get(t);

  if (!tickerHistory || tickerHistory.length === 0) {
    throw new Error(`No data found for ticker ${t}`);
  }

  const recentHistory = tickerHistory.slice(-180);
  const closes = recentHistory.map(d => d.price);
  
  const lastDataPoint = recentHistory[recentHistory.length - 1];
  const prevDataPoint = recentHistory[recentHistory.length - 2];
  const currentPrice = lastDataPoint.price;
  const dayChangePct = prevDataPoint 
    ? ((currentPrice - prevDataPoint.price) / prevDataPoint.price) * 100 
    : 0;

  const companyName = companyInfo[t]?.name || t;
  const sector = companyInfo[t]?.sector || "Unknown";

  const { hv30, hvRank } = calcHVRank(closes);

  const daysToExp = 7;
  const expectedMovePct = closes.length > 0
    ? parseFloat(((hv30 / 100) * Math.sqrt(daysToExp / 252) * 100).toFixed(1))
    : 0;

  const bigMoves = closes.length > 1
    ? closes.slice(1).filter((c, i) => Math.abs((c - closes[i]) / closes[i]) > 0.04).length
    : 0;

  const analysis = {
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
      expected_move_gap: Math.round(Math.max(0, Math.min(100, (expectedMovePct / (hv30 || 1)) * 100))),
      analyst_sentiment: 50,
      historical_edge: Math.min(100, bigMoves * 10),
      timing_risk: 50
    },
    data: {
      iv_rank: `${hvRank}/100 (HV rank)` ,
      iv_percentile: `${hvRank}%`,
      hv_30: `${hv30}%`,
      expected_move_pct: `±${expectedMovePct}%`,
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
      break_even_up: `$${(currentPrice * (1 + expectedMovePct / 100)).toFixed(2)}`,
      break_even_down: `$${(currentPrice * (1 - expectedMovePct / 100)).toFixed(2)}`
    },
    risks: ["Estimates only - no live IV", "Market events can invalidate expectation", "Historical data may not reflect current conditions"],
    brief: `Using CSV historical data (2013-2022), price $${currentPrice.toFixed(2)}, HV30 ${hv30}%, HV rank ${hvRank}/100, expected weekly move ±${expectedMovePct}%. ${bigMoves} large daily moves observed in last 180 days. Combine with company earnings history to decide strategy.`
  };

  return analysis;
}

export const AVAILABLE_TICKERS_LIST = AVAILABLE_TICKERS;
