import os
import yfinance as yf
import numpy as np
import pandas as pd
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class PortfolioRequest(BaseModel):
    tickers: list[str]
    risk_free_rate: float = 0.02

CACHE_FILE = "market_cache.csv"

@app.post("/api/frontier")
def calculate_frontier(req: PortfolioRequest):
    # 1. Fetch data & implement local caching fallback
    tickers_to_fetch = list(set(req.tickers + ['^GSPC'])) # Add S&P 500 for Beta
    try:
        data = yf.download(tickers_to_fetch, period="max")["Close"]
        # Handle single ticker edge case
        if isinstance(data, pd.Series):
            data = data.to_frame(name=tickers_to_fetch[0])
        data.to_csv(CACHE_FILE)
    except Exception:
        if os.path.exists(CACHE_FILE):
            data = pd.read_csv(CACHE_FILE, index_col=0, parse_dates=True)
        else:
            return {"error": "Failed to download data and no local cache available."}
    
    # Clean data (align dates to the shortest asset history)
    data = data.dropna(axis=1, how='all').dropna()
    valid_tickers = [t for t in req.tickers if t in data.columns]
    
    if len(valid_tickers) < 2 or '^GSPC' not in data.columns:
        return {"error": "Insufficient valid data."}
        
    returns = data.pct_change().dropna()
    market_returns = returns['^GSPC']
    asset_returns = returns[valid_tickers]
    
    mean_returns = asset_returns.mean() * 252
    cov_matrix = asset_returns.cov() * 252
    
    # 2. Extract Individual Asset Profiles for plotting
    individual_assets = []
    for t in valid_tickers:
        individual_assets.append({
            "ticker": t,
            "return": float(mean_returns[t] * 100),
            "risk": float(np.sqrt(cov_matrix.loc[t, t]) * 100)
        })

    # 3. Simulate Portfolios and Ratios
    results = []
    market_var = market_returns.var() * 252
    cov_with_market = asset_returns.apply(lambda x: x.cov(market_returns)) * 252

    for _ in range(1500):
        weights = np.random.random(len(valid_tickers))
        weights /= np.sum(weights)
        
        p_return = np.sum(mean_returns * weights)
        p_risk = np.sqrt(np.dot(weights.T, np.dot(cov_matrix, weights)))
        
        # Sharpe
        sharpe = (p_return - req.risk_free_rate) / p_risk if p_risk > 0 else 0
        
        # Sortino
        p_returns_daily = asset_returns.dot(weights)
        downside_diff = np.minimum(0, p_returns_daily)
        downside_risk = np.sqrt(np.mean(downside_diff**2)) * np.sqrt(252)
        sortino = (p_return - req.risk_free_rate) / downside_risk if downside_risk > 0 else 0
        
        # Treynor
        p_beta = np.sum(weights * cov_with_market) / market_var
        treynor = (p_return - req.risk_free_rate) / p_beta if p_beta != 0 else 0
        
        # Calmar
        cum_returns = (1 + p_returns_daily).cumprod()
        running_max = cum_returns.cummax()
        drawdowns = (cum_returns - running_max) / running_max
        max_drawdown = abs(drawdowns.min())
        calmar = p_return / max_drawdown if max_drawdown > 0 else 0
        
        results.append({
            "return": float(p_return * 100),
            "risk": float(p_risk * 100),
            "sharpe": float(sharpe),
            "sortino": float(sortino),
            "treynor": float(treynor),
            "calmar": float(calmar),
            "weights": {t: float(w) for t, w in zip(valid_tickers, weights)}
        })
        
    # 4. Identify Optimal Portfolios
    optimal = [
        {**max(results, key=lambda x: x["sharpe"]), "label": "Max Sharpe", "color": "#facc15"},
        {**max(results, key=lambda x: x["sortino"]), "label": "Max Sortino", "color": "#4ade80"},
        {**max(results, key=lambda x: x["treynor"]), "label": "Max Treynor", "color": "#c084fc"},
        {**max(results, key=lambda x: x["calmar"]), "label": "Max Calmar", "color": "#f87171"}
    ]
    
    return {
        "portfolios": results,
        "optimal": optimal,
        "assets": individual_assets
    }