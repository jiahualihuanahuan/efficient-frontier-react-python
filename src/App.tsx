import { useState, useEffect } from 'react';
import { 
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  BarChart, Bar, Cell, YAxis as BarYAxis, XAxis as BarXAxis, LabelList
} from 'recharts';

const ASSET_COLORS = ['#38bdf8', '#818cf8', '#c084fc', '#f472b6', '#fb923c', '#4ade80', '#facc15'];

export default function EfficientFrontierApp() {
  // 1. Updated Defaults
  const [tickers, setTickers] = useState("SPY, QQQ, GLD, BTC-USD");
  const [maxVol, setMaxVol] = useState<number>(18);
  
  const [apiData, setApiData] = useState<{portfolios: any[], optimal: any[], assets: any[]}>({ portfolios: [], optimal: [], assets: [] });
  const [loading, setLoading] = useState(false);
  const [selectedPortfolio, setSelectedPortfolio] = useState<any>(null);

  // Asset Class Combinations
  const presetPortfolios = [
    { label: "Default Mix", value: "SPY, QQQ, GLD, BTC-USD" },
    { label: "All-Weather", value: "SPY, TLT, GLD, DBC" },
    { label: "Tech & Crypto", value: "QQQ, ARKK, BTC-USD, ETH-USD" },
    { label: "High Yield", value: "JEPI, SCHD, O, VNQ" }
  ];

  // 2. Auto-run on load
  useEffect(() => {
    calculateFrontier(tickers);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Modified to accept direct ticker strings so preset buttons fire immediately
  const calculateFrontier = async (targetTickers = tickers) => {
    setLoading(true);
    setSelectedPortfolio(null);
    const tickerList = targetTickers.split(',').map(t => t.trim()).filter(Boolean);
    
    try {
      const res = await fetch("http://localhost:8000/api/frontier", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tickers: tickerList })
      });
      const data = await res.json();
      setApiData(data);
    } catch (error) {
      console.error("Failed to fetch frontier data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handlePresetClick = (presetValue: string) => {
    setTickers(presetValue);
    calculateFrontier(presetValue);
  };

  const getWeightData = () => {
    if (!selectedPortfolio) return [];
    return Object.entries(selectedPortfolio.weights)
      .map(([name, weight]) => ({ name, value: (weight as number) * 100 }))
      .sort((a, b) => b.value - a.value);
  };

  // 3. Custom Label Renderer to prevent overlap
  const renderStaggeredLabel = (props: any) => {
    const { x, y, value } = props;
    let dx = 0;
    let dy = 0;

    // Push optimal labels in different directions to avoid clustering
    if (value === "Max Sharpe") { dy = -15; }
    else if (value === "Max Sortino") { dy = 15; }
    else if (value === "Max Treynor") { dx = 45; dy = 5; }
    else if (value === "Max Calmar") { dx = -45; dy = 5; }
    else { dy = -15; } // Default upward shift for single asset tickers

    return (
      <text 
        x={x + dx} 
        y={y + dy} 
        fill={value.includes("Max") ? "#e2e8f0" : "#ffffff"} 
        fontSize={11} 
        textAnchor="middle" 
        fontWeight={value.includes("Max") ? "normal" : "bold"}
      >
        {value}
      </text>
    );
  };

  const filteredPortfolios = apiData.portfolios.filter(p => p.risk <= maxVol);
  const filteredOptimal = apiData.optimal.filter(p => p.risk <= maxVol);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-4 md:p-8 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        
        <div className="space-y-1">
          <h1 className="text-3xl font-extrabold text-white">Advanced PM Simulator</h1>
          <p className="text-slate-400 text-sm">
            Evaluating Max Sharpe, Sortino, Treynor, and Calmar ratios.
          </p>
        </div>

        {/* Controls */}
        <div className="bg-slate-800 border border-slate-700 p-5 rounded-2xl shadow-lg space-y-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <label className="block text-xs font-semibold text-slate-400 mb-2">Tickers (S&P 500 used for Beta automatically)</label>
              <input 
                type="text" 
                value={tickers}
                onChange={(e) => setTickers(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 px-4 py-2.5 rounded-xl text-slate-100 focus:ring-1 focus:ring-blue-500"
              />
            </div>
            
            <div className="flex-1">
              <label className="block text-xs font-semibold text-slate-400 mb-2">Max Volatility Filter: {maxVol}%</label>
              <input 
                type="range" 
                min="5" 
                max="80" 
                value={maxVol}
                onChange={(e) => setMaxVol(Number(e.target.value))}
                className="w-full mt-2 accent-blue-500 cursor-pointer"
              />
            </div>

            <div className="flex items-end">
              <button 
                onClick={() => calculateFrontier(tickers)}
                disabled={loading}
                className="w-full md:w-auto bg-blue-600 hover:bg-blue-500 text-white font-semibold px-8 py-2.5 rounded-xl disabled:opacity-50 transition-colors"
              >
                {loading ? "Simulating..." : "Run Simulation"}
              </button>
            </div>
          </div>

          {/* Preset Buttons */}
          <div className="pt-2 flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-slate-400 mr-2">Asset Classes:</span>
            {presetPortfolios.map((preset, idx) => (
              <button
                key={idx}
                onClick={() => handlePresetClick(preset.value)}
                disabled={loading}
                className="text-xs bg-slate-700/50 hover:bg-slate-600 text-slate-300 px-3 py-1.5 rounded-lg border border-slate-600 transition-colors disabled:opacity-50"
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {/* Main Dashboard */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-slate-800 border border-slate-700 p-5 rounded-2xl h-[600px] flex flex-col">
            <h2 className="text-sm font-semibold text-slate-200 mb-4">Risk vs. Expected Return</h2>
            
            {apiData.portfolios.length === 0 ? (
              <div className="flex-1 flex items-center justify-center text-slate-500 border-2 border-dashed border-slate-700 rounded-xl">
                {loading ? "Fetching historical data..." : "Run simulation to map frontier."}
              </div>
            ) : (
              <div className="flex-1 min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                  <ScatterChart margin={{ top: 20, right: 40, bottom: 20, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.6} />
                    <XAxis type="number" dataKey="risk" name="Volatility" unit="%" stroke="#94a3b8" />
                    <YAxis type="number" dataKey="return" name="Return" unit="%" stroke="#94a3b8" />
                    <RechartsTooltip cursor={{ strokeDasharray: '3 3' }} />
                    
                    {/* The Cloud */}
                    <Scatter data={filteredPortfolios} fill="#38bdf8" opacity={0.3} onClick={(node) => setSelectedPortfolio(node)} className="cursor-crosshair" />
                    
                    {/* Individual Assets */}
                    <Scatter data={apiData.assets} fill="#ffffff" onClick={(node) => setSelectedPortfolio(node)} className="cursor-pointer">
                      <LabelList dataKey="ticker" content={renderStaggeredLabel} />
                    </Scatter>

                    {/* Optimal Portfolios */}
                    <Scatter data={filteredOptimal} onClick={(node) => setSelectedPortfolio(node)} className="cursor-pointer">
                      {filteredOptimal.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                      <LabelList dataKey="label" content={renderStaggeredLabel} />
                    </Scatter>
                  </ScatterChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Breakdown Section */}
          <div className="bg-slate-800 border border-slate-700 p-5 rounded-2xl flex flex-col h-[600px]">
             <h2 className="text-sm font-semibold text-slate-200 mb-4">Asset Allocation</h2>
             {!selectedPortfolio ? (
               <div className="flex-1 flex items-center justify-center text-slate-500 border-2 border-dashed border-slate-700 rounded-xl p-4 text-center">
                 Click a dot (cloud, asset, or optimal tag) to view weights.
               </div>
             ) : (
               <div className="flex-1 flex flex-col">
                 <div className="bg-slate-900 rounded-xl p-4 border border-slate-700 mb-4">
                   <p className="text-xs text-slate-400">Selected Point: <span className="text-white font-bold">{selectedPortfolio.label || selectedPortfolio.ticker || 'Custom Portfolio'}</span></p>
                   <div className="flex justify-between mt-2 font-mono text-sm">
                     <p className="text-blue-400">Ret: {selectedPortfolio.return?.toFixed(2)}%</p>
                     <p className="text-purple-400">Risk: {selectedPortfolio.risk?.toFixed(2)}%</p>
                   </div>
                 </div>
                 <div className="flex-1 min-h-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={getWeightData()} layout="vertical" margin={{ top: 0, right: 20, bottom: 0, left: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#334155" opacity={0.5} />
                      <BarXAxis type="number" unit="%" stroke="#94a3b8" />
                      <BarYAxis dataKey="name" type="category" stroke="#94a3b8" width={50} />
                      <RechartsTooltip />
                      <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                        {getWeightData().map((_, i) => <Cell key={i} fill={ASSET_COLORS[i % ASSET_COLORS.length]} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                 </div>
               </div>
             )}
          </div>
        </div>
      </div>
    </div>
  );
}