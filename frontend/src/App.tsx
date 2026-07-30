import { useState, useRef, useEffect } from "react";
import { analyzeTicker, AVAILABLE_TICKERS_LIST } from "./analysis";

const VERDICT_STYLES: Record<string, { bg: string; accent: string; icon: string }> = {
  "STRONG BUY STRADDLE": { bg: "#0F1F1A", accent: "#22C55E", icon: "↑↑" },
  "BUY STRADDLE":        { bg: "#0F1A26", accent: "#6EE7B7", icon: "↑"  },
  "BUY STRANGLE":        { bg: "#0F1A26", accent: "#6EE7B7", icon: "↗"  },
  "SELL PREMIUM":        { bg: "#241A0A", accent: "#FBBF24", icon: "↓"  },
  "SELL IRON CONDOR":    { bg: "#241A0A", accent: "#FBBF24", icon: "↔"  },
  "AVOID":               { bg: "#240A0A", accent: "#F87171", icon: "✕"  },
  "NEUTRAL":             { bg: "#1A1226", accent: "#A78BFA", icon: "—"  },
};

type AnalysisResult = {
  ticker: string;
  company_name?: string;
  sector?: string;
  current_price?: string;
  day_change?: string;
  next_earnings?: string;
  verdict?: string;
  confidence?: number;
  data_quality?: string;
  scores?: {
    iv_setup?: number;
    expected_move_gap?: number;
    analyst_sentiment?: number;
    historical_edge?: number;
    timing_risk?: number;
  };
  data?: {
    iv_rank?: string;
    iv_percentile?: string;
    hv_30?: string;
    expected_move_pct?: string;
    avg_historical_move?: string;
    move_gap?: string;
    straddle_cost_pct?: string;
    analyst_eps_estimate?: string;
    beat_rate?: string;
    avg_beat_magnitude?: string;
    recent_revisions?: string;
  };
  strategy?: {
    recommended?: string;
    entry_timing?: string;
    max_risk?: string;
    break_even_up?: string;
    break_even_down?: string;
  };
  risks?: string[];
  brief?: string;
};

type View = "idle" | "loading" | "result" | "error";

const STEPS = [
  "Loading historical price data",
  "Computing historical volatility rank",
  "Running AI analysis on data",
  "Generating trade brief",
];

export default function App() {
  const [view, setView] = useState<View>("idle");
  const [ticker, setTicker] = useState("");
  const [currentTicker, setCurrentTicker] = useState("");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [activeStep, setActiveStep] = useState(0);
  const [briefDisplayed, setBriefDisplayed] = useState("");
  const stepTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const briefTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function clearTimers() {
    if (stepTimer.current) clearInterval(stepTimer.current);
    if (briefTimer.current) clearInterval(briefTimer.current);
  }

  useEffect(() => () => clearTimers(), []);

  function startLoading(t: string) {
    clearTimers();
    setCurrentTicker(t);
    setActiveStep(0);
    setView("loading");
    let si = 0;
    stepTimer.current = setInterval(() => {
      si++;
      if (si < STEPS.length) setActiveStep(si);
      else clearInterval(stepTimer.current!);
    }, 1800);
  }

  async function runAnalysis(t: string) {
    startLoading(t);
    try {
      const data = await analyzeTicker(t) as AnalysisResult;
      clearTimers();
      setTimeout(() => {
        setResult(data);
        setView("result");
        streamBrief(data.brief ?? "");
      }, 400);
    } catch (err: unknown) {
      clearTimers();
      setErrorMsg(err instanceof Error ? err.message : String(err));
      setView("error");
    }
  }

  function streamBrief(brief: string) {
    setBriefDisplayed("");
    let ci = 0;
    briefTimer.current = setInterval(() => {
      ci += 4;
      if (ci >= brief.length) {
        setBriefDisplayed(brief);
        clearInterval(briefTimer.current!);
      } else {
        setBriefDisplayed(brief.slice(0, ci));
      }
    }, 20);
  }

  function handleStart() {
    const t = ticker.trim().toUpperCase();
    if (!t) return;
    if (!AVAILABLE_TICKERS_LIST.includes(t)) {
      setErrorMsg(`Ticker ${t} is not available. Available: ${AVAILABLE_TICKERS_LIST.join(', ')}`);
      setView("error");
      return;
    }
    runAnalysis(t);
  }

  function quickRun(t: string) {
    setTicker(t);
    runAnalysis(t);
  }

  function resetApp() {
    clearTimers();
    setView("idle");
    setTicker("");
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  const vs = result
    ? (VERDICT_STYLES[
        Object.keys(VERDICT_STYLES).find((k) =>
          (result.verdict ?? "").toUpperCase().includes(k)
        ) ?? "NEUTRAL"
      ])
    : VERDICT_STYLES["NEUTRAL"];

  const sc = result?.scores ?? {};
  const dm = result?.data ?? {};
  const st = result?.strategy ?? {};

  const scoreMap: [string, number | undefined][] = [
    ["IV / HV Setup", sc.iv_setup],
    ["Move Gap", sc.expected_move_gap],
    ["Analyst Sentiment", sc.analyst_sentiment],
    ["Historical Edge", sc.historical_edge],
    ["Timing Risk", sc.timing_risk],
  ];

  const dataRows: [string, string | undefined, string][] = [
    ["HV Rank", dm.iv_rank, "neu"],
    ["IV Percentile", dm.iv_percentile, "neu"],
    ["30-Day HV", dm.hv_30, "neu"],
    ["Expected Move", dm.expected_move_pct, "neu"],
    ["Hist. Avg Move", dm.avg_historical_move, "up"],
    ["Move Gap", dm.move_gap, (dm.move_gap ?? "").toLowerCase().includes("under") ? "up" : "down"],
    ["EPS Estimate", dm.analyst_eps_estimate, "neu"],
    ["Beat Rate", dm.beat_rate, "up"],
  ];

  const stratItems: [string, string | undefined, string][] = [
    ["STRATEGY", st.recommended, "#6EE7B7"],
    ["ENTRY", st.entry_timing, "#FBBF24"],
    ["B/E UP", st.break_even_up, "#22C55E"],
    ["B/E DOWN", st.break_even_down, "#22C55E"],
    ["MAX RISK", st.max_risk, "#F87171"],
  ];

  const isLive = result?.data_quality?.includes("LIVE");

  return (
    <div style={{ background: "#080C18", color: "#F0F4FF", fontFamily: "'DM Sans', sans-serif", minHeight: "100vh" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=DM+Sans:wght@300;400;500;600&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        .run-btn:hover:not(:disabled) { background: #4ADE80 !important; transform: translateY(-1px); }
        .run-btn:disabled { opacity: .35; cursor: not-allowed; }
        .chip:hover { border-color: #6EE7B7 !important; color: #6EE7B7 !important; background: #0D2520 !important; }
        .ghost-btn:hover { border-color: #F0F4FF !important; color: #F0F4FF !important; }
        .ghost-btn-teal:hover { border-color: #6EE7B7 !important; background: #6EE7B711 !important; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeUp { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
        @keyframes blink { 50% { opacity: 0; } }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.5} }
        .result-view { animation: fadeUp .4s ease; }
        .cursor { display: inline-block; width: 8px; height: 14px; background: #6EE7B7; vertical-align: middle; margin-left: 2px; animation: blink 1s step-end infinite; }
        .live-badge { animation: pulse 2s ease-in-out infinite; }
        @media(max-width:600px) { .grid2 { grid-template-columns: 1fr !important; } }
      `}</style>

      {/* HEADER */}
      <header style={{ background: "#050810", borderBottom: "1px solid #1E2540", padding: "14px 28px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 18, fontWeight: 700, color: "#6EE7B7" }}>
            Earnings<span style={{ color: "#F0F4FF" }}>Edge</span>
          </div>
          <div style={{ background: "#22C55E22", border: "1px solid #22C55E55", borderRadius: 4, padding: "2px 8px", fontFamily: "'Space Mono', monospace", fontSize: 9, color: "#22C55E", letterSpacing: 1 }}>
            LIVE DATA
          </div>
        </div>
        <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 10, color: "#6B7280", letterSpacing: 2 }}>AI OPTIONS ANALYST · HISTORICAL DATA (2013-2022)</div>
      </header>

      <main style={{ maxWidth: 880, margin: "0 auto", padding: "48px 24px 80px" }}>

        {/* IDLE VIEW */}
        {view === "idle" && (
          <div>
            <div style={{ textAlign: "center", marginBottom: 48 }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#22C55E11", border: "1px solid #22C55E33", borderRadius: 20, padding: "6px 16px", marginBottom: 20 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22C55E", display: "inline-block" }} className="live-badge" />
                <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 10, color: "#22C55E", letterSpacing: 2 }}>HISTORICAL DATA (2013-2022)</span>
              </div>
              <h1 style={{ fontSize: 40, fontWeight: 600, lineHeight: 1.2, marginBottom: 14 }}>
                Historical data.<br /><span style={{ color: "#6EE7B7" }}>AI analysis.</span>
              </h1>
              <p style={{ fontSize: 15, color: "#6B7280", maxWidth: 500, margin: "0 auto", lineHeight: 1.75 }}>
                Historical price data (2013-2022) for 5 stocks with volatility analysis — analysed by AI for your earnings play decision.
              </p>
            </div>

            <div
              style={{ background: "#0E1325", border: "1px solid #2A3050", borderRadius: 14, padding: "8px 8px 8px 22px", display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}
              onFocus={e => (e.currentTarget.style.borderColor = "#6EE7B7")}
              onBlur={e => (e.currentTarget.style.borderColor = "#2A3050")}>
              <input
                ref={inputRef}
                type="text"
                value={ticker}
                onChange={e => setTicker(e.target.value.toUpperCase().slice(0, 6))}
                onKeyDown={e => { if (e.key === "Enter" && ticker.trim()) handleStart(); }}
                placeholder={AVAILABLE_TICKERS_LIST.join(', ') + '...'}
                maxLength={6}
                autoComplete="off"
                spellCheck={false}
                style={{ background: "transparent", border: "none", outline: "none", fontFamily: "'Space Mono', monospace", fontSize: 26, fontWeight: 700, color: "#F0F4FF", flex: 1, letterSpacing: 3, textTransform: "uppercase", minWidth: 0 }}
              />
              <button
                className="run-btn"
                onClick={handleStart}
                disabled={!ticker.trim()}
                style={{ background: "#22C55E", border: "none", borderRadius: 10, padding: "14px 28px", fontFamily: "'Space Mono', monospace", fontSize: 13, fontWeight: 700, color: "#060A14", cursor: "pointer", letterSpacing: 1, transition: "all .15s", whiteSpace: "nowrap", flexShrink: 0 }}>
                ANALYSE →
              </button>
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center", marginBottom: 24 }}>
              <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, color: "#6B7280", letterSpacing: 1, alignSelf: "center" }}>AVAILABLE:</span>
              {AVAILABLE_TICKERS_LIST.map(t => (
                <button key={t} className="chip" onClick={() => quickRun(t)}
                  style={{ background: "#0E1325", border: "1px solid #2A3050", borderRadius: 20, padding: "6px 16px", fontFamily: "'Space Mono', monospace", fontSize: 11, color: "#6B7280", cursor: "pointer", transition: "all .15s", letterSpacing: 1 }}>
                  {t}
                </button>
              ))}
            </div>

            {/* What's real vs AI */}
            <div style={{ background: "#0E1325", border: "1px solid #2A3050", borderRadius: 12, padding: "18px 22px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div>
                <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 10, color: "#22C55E", letterSpacing: 2, marginBottom: 10 }}>LIVE FROM POLYGON.IO</div>
                {["Current price & volume", "180-day price history", "Historical volatility rank", "Options chain IV (if available)"].map(s => (
                  <div key={s} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#9CA3AF", marginBottom: 6 }}>
                    <span style={{ color: "#22C55E", fontSize: 11 }}>✓</span>{s}
                  </div>
                ))}
              </div>
              <div>
                <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 10, color: "#A78BFA", letterSpacing: 2, marginBottom: 10 }}>AI FROM CLAUDE</div>
                {["Earnings date estimate", "Analyst EPS consensus", "Historical beat rate", "Trade strategy & brief"].map(s => (
                  <div key={s} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#9CA3AF", marginBottom: 6 }}>
                    <span style={{ color: "#A78BFA", fontSize: 11 }}>◆</span>{s}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* LOADING VIEW */}
        {view === "loading" && (
          <div style={{ textAlign: "center", padding: "60px 20px" }}>
            <div style={{ width: 44, height: 44, border: "2px solid #1E2540", borderTopColor: "#6EE7B7", borderRadius: "50%", animation: "spin .8s linear infinite", margin: "0 auto 20px" }} />
            <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 13, color: "#6EE7B7", letterSpacing: 2, marginBottom: 24 }}>
              FETCHING LIVE DATA · {currentTicker}
            </div>
            <ul style={{ listStyle: "none", display: "inline-flex", flexDirection: "column", gap: 12, textAlign: "left" }}>
              {STEPS.map((s, i) => (
                <li key={i} style={{ fontFamily: "'Space Mono', monospace", fontSize: 12, display: "flex", alignItems: "center", gap: 12, transition: "color .3s", color: i < activeStep ? "#2A3050" : i === activeStep ? "#6EE7B7" : "#6B7280", textDecoration: i < activeStep ? "line-through" : "none" }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "currentColor", flexShrink: 0 }} />
                  {s}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* RESULT VIEW */}
        {view === "result" && result && (
          <div className="result-view">
            {/* Top bar */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 18 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span style={{ fontFamily: "'Space Mono', monospace", background: "#1E2540", color: "#6EE7B7", borderRadius: 6, padding: "4px 12px", fontSize: 14, fontWeight: 700, letterSpacing: 2 }}>{result.ticker}</span>
                <span style={{ fontSize: 14, color: "#9CA3AF" }}>{result.company_name}</span>
                <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, color: "#2A3050" }}>{result.sector ? `· ${result.sector}` : ""}</span>
                {isLive && (
                  <span style={{ background: "#22C55E11", border: "1px solid #22C55E33", borderRadius: 4, padding: "2px 8px", fontFamily: "'Space Mono', monospace", fontSize: 9, color: "#22C55E", letterSpacing: 1 }}>
                    LIVE DATA
                  </span>
                )}
              </div>
              <div style={{ textAlign: "right" }}>
                {result.current_price && <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 16, fontWeight: 700, color: "#F0F4FF" }}>{result.current_price}</div>}
                {result.day_change && (
                  <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, color: (result.day_change ?? "").startsWith("+") ? "#22C55E" : "#F87171" }}>
                    {result.day_change} TODAY
                  </div>
                )}
                {result.next_earnings && <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 10, color: "#6B7280", letterSpacing: 1, marginTop: 2 }}>EARNINGS: {result.next_earnings}</div>}
              </div>
            </div>

            {/* Verdict banner */}
            <div style={{ background: vs.bg, border: `1px solid ${vs.accent}33`, borderRadius: 14, padding: "22px 26px", marginBottom: 18, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
                <div style={{ width: 52, height: 52, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", background: `${vs.accent}22`, color: vs.accent, fontFamily: "'Space Mono', monospace", fontSize: 22, fontWeight: 700 }}>
                  {vs.icon}
                </div>
                <div>
                  <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 10, letterSpacing: 2, color: vs.accent, opacity: .7, marginBottom: 5 }}>VERDICT</div>
                  <div style={{ fontSize: 24, fontWeight: 600, lineHeight: 1.1, color: vs.accent }}>{result.verdict}</div>
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 38, fontWeight: 700, lineHeight: 1, color: vs.accent }}>{result.confidence ?? 0}%</div>
                <div style={{ fontSize: 11, opacity: .6, letterSpacing: 1, marginTop: 2, color: vs.accent }}>CONFIDENCE</div>
              </div>
            </div>

            {/* Grid */}
            <div className="grid2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
              <div style={{ background: "#0E1325", border: "1px solid #1E2540", borderRadius: 12, padding: "18px 20px" }}>
                <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 10, letterSpacing: 2, color: "#6B7280", marginBottom: 14 }}>AI SCORING</div>
                {scoreMap.map(([label, val]) => {
                  const v = val ?? 0;
                  const col = v >= 75 ? "#22C55E" : v >= 50 ? "#FBBF24" : "#F87171";
                  return (
                    <div key={label} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                      <div style={{ fontSize: 12, color: "#6B7280", minWidth: 140, flexShrink: 0 }}>{label}</div>
                      <div style={{ flex: 1, height: 5, background: "#1E2540", borderRadius: 3, overflow: "hidden" }}>
                        <div style={{ width: `${v}%`, height: "100%", background: col, borderRadius: 3, transition: "width 0.8s ease" }} />
                      </div>
                      <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, fontWeight: 700, minWidth: 30, textAlign: "right", color: col }}>{v}</div>
                    </div>
                  );
                })}
              </div>
              <div style={{ background: "#0E1325", border: "1px solid #1E2540", borderRadius: 12, padding: "18px 20px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                  <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 10, letterSpacing: 2, color: "#6B7280" }}>MARKET DATA</div>
                  <span style={{ background: "#22C55E11", border: "1px solid #22C55E33", borderRadius: 3, padding: "1px 6px", fontFamily: "'Space Mono', monospace", fontSize: 8, color: "#22C55E", letterSpacing: 1 }}>LIVE</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  {dataRows.map(([k, v, cls]) => (
                    <div key={k}>
                      <div style={{ fontSize: 11, color: "#6B7280", marginBottom: 3 }}>{k}</div>
                      <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 12, fontWeight: 700, color: cls === "up" ? "#22C55E" : cls === "down" ? "#F87171" : "#FBBF24" }}>{v ?? "—"}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Strategy */}
            <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
              {stratItems.map(([lbl, val, col]) => (
                <div key={lbl} style={{ background: `${col}0D`, border: `1px solid ${col}33`, borderRadius: 10, padding: "12px 16px", flex: 1, minWidth: 130 }}>
                  <div style={{ fontSize: 10, letterSpacing: 1, color: `${col}99`, marginBottom: 5 }}>{lbl}</div>
                  <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 12, fontWeight: 700, color: col }}>{val ?? "—"}</div>
                </div>
              ))}
            </div>

            {/* Brief */}
            <div style={{ background: "#0E1325", border: "1px solid #1E2540", borderRadius: 12, padding: "22px 24px", marginBottom: 16 }}>
              <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 10, letterSpacing: 2, color: "#6B7280", marginBottom: 14 }}>AI ANALYSIS BRIEF · GROUNDED IN LIVE DATA</div>
              <div style={{ fontSize: 14, lineHeight: 1.85, color: "#C4CBD8", whiteSpace: "pre-wrap" }}>
                {briefDisplayed}
                {briefDisplayed.length < (result.brief ?? "").length && <span className="cursor" />}
              </div>
            </div>

            {/* Risks */}
            {(result.risks ?? []).length > 0 && (
              <div style={{ background: "#0E1325", border: "1px solid #1E2540", borderRadius: 12, padding: "18px 20px", marginBottom: 16 }}>
                <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 10, letterSpacing: 2, color: "#6B7280", marginBottom: 14 }}>KEY RISKS</div>
                {(result.risks ?? []).map((r, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 13, color: "#C4CBD8", marginBottom: 8 }}>
                    <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 12, color: "#F87171", flexShrink: 0, marginTop: 1 }}>!</span>
                    {r}
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 8 }}>
              <button className="ghost-btn" onClick={resetApp}
                style={{ background: "transparent", border: "1px solid #2A3050", borderRadius: 8, padding: "10px 20px", fontFamily: "'Space Mono', monospace", fontSize: 11, color: "#6B7280", cursor: "pointer", letterSpacing: 1, transition: "all .15s" }}>
                ← NEW ANALYSIS
              </button>
              <button className="ghost-btn ghost-btn-teal" onClick={() => runAnalysis(currentTicker)}
                style={{ background: "transparent", border: "1px solid #6EE7B744", borderRadius: 8, padding: "10px 20px", fontFamily: "'Space Mono', monospace", fontSize: 11, color: "#6EE7B7", cursor: "pointer", letterSpacing: 1, transition: "all .15s" }}>
                ↻ RE-RUN {currentTicker}
              </button>
            </div>
          </div>
        )}

        {/* ERROR VIEW */}
        {view === "error" && (
          <div>
            <div style={{ background: "#1A0808", border: "1px solid #F87171", borderRadius: 12, padding: 22, color: "#FCA5A5", fontSize: 14, lineHeight: 1.7, marginBottom: 16 }}>
              <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, color: "#F87171", letterSpacing: 2, marginBottom: 8 }}>ANALYSIS FAILED</div>
              {errorMsg}
            </div>
            <button className="ghost-btn" onClick={resetApp}
              style={{ background: "transparent", border: "1px solid #2A3050", borderRadius: 8, padding: "10px 20px", fontFamily: "'Space Mono', monospace", fontSize: 11, color: "#6B7280", cursor: "pointer", letterSpacing: 1, transition: "all .15s" }}>
              ← TRY AGAIN
            </button>
          </div>
        )}

      </main>

      <footer style={{ borderTop: "1px solid #1E2540", textAlign: "center", padding: 16, fontFamily: "'Space Mono', monospace", fontSize: 10, color: "#2A3050", letterSpacing: 1 }}>
        EARNINGSEDGE · LIVE DATA BY POLYGON.IO · AI BY CLAUDE · EDUCATIONAL USE ONLY · NOT FINANCIAL ADVICE
      </footer>
    </div>
  );
}
