require('dotenv').config();
const express = require('express');
const cors = require('cors');
const yahooFinance = require('yahoo-finance2').default;

const allowedOrigins = [
  "http://localhost:5173",                       
  "https://saudi-stocks-frontend.onrender.com"   
];

const app = express();

// --- Multi-origin CORS (supports localhost + Netlify later) ---
const allowed = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

app.use(cors({
  origin(origin, cb) {
    // allow server-to-server/no-origin requests and any listed origin
    if (!origin || allowed.includes(origin)) return cb(null, true);
    return cb(new Error('CORS: not allowed'));
  },
  credentials: true
}));

app.use(express.json());

// ---------------- Utilities ----------------
const TICKER_RE = /^[A-Z0-9.-]{2,10}$/i;

// Resolve a user query (ticker OR company name) to a ticker symbol, preferring .SR
async function resolveToSymbol(query) {
  const q = (query || '').trim();

  if (TICKER_RE.test(q)) {
    return q.includes('.') ? q.toUpperCase() : `${q.toUpperCase()}.SR`;
  }

  const search = await yahooFinance.search(q, { newsCount: 0 });
  const quotes = Array.isArray(search?.quotes) ? search.quotes : [];

  const sr = quotes.find(x => x.symbol?.toUpperCase().endsWith('.SR'));
  if (sr?.symbol) return sr.symbol.toUpperCase();

  const sau = quotes.find(x => (x.exchange || x.exchangeDisplay || '').toUpperCase().includes('SAU'));
  if (sau?.symbol) {
    const sym = sau.symbol.toUpperCase();
    return sym.endsWith('.SR') ? sym : `${sym}.SR`;
  }

  const first = quotes.find(x => x.symbol);
  if (first?.symbol) {
    const sym = first.symbol.toUpperCase();
    return sym.endsWith('.SR') ? sym : `${sym}.SR`;
  }

  return null;
}

// Fetch core metrics for a given symbol
async function fetchFromYahoo(rawTicker) {
  const symbol = rawTicker.includes('.') ? rawTicker : `${rawTicker}.SR`;

  const data = await yahooFinance.quoteSummary(symbol, {
    modules: [
      'price',
      'summaryDetail',
      'financialData',
      'defaultKeyStatistics',
      'incomeStatementHistory',
      'balanceSheetHistory'
    ]
  });

  const name = data?.price?.longName || data?.price?.shortName || symbol;

  // Price
  let price = null;
  if (data?.price?.regularMarketPrice != null && isFinite(data.price.regularMarketPrice)) {
    price = data.price.regularMarketPrice;
  } else if (data?.financialData?.currentPrice != null) {
    price = data.financialData.currentPrice;
  }

  // EPS (TTM)
  let eps = null;
  if (data?.defaultKeyStatistics?.trailingEps != null) {
    eps = data.defaultKeyStatistics.trailingEps;
  } else if (data?.financialData?.epsTrailingTwelveMonths != null) {
    eps = data.financialData.epsTrailingTwelveMonths;
  }

  // P/E
  let peRatio = null;
  if (data?.summaryDetail?.trailingPE != null && isFinite(data.summaryDetail.trailingPE)) {
    peRatio = data.summaryDetail.trailingPE;
  } else if (price && eps) {
    peRatio = price / eps;
  }

  // ROE (fraction -> percentage)
  let roeFrac = null;
  if (data?.financialData?.returnOnEquity != null) {
    roeFrac = data.financialData.returnOnEquity;
  } else {
    const ni = data?.incomeStatementHistory?.incomeStatementHistory?.[0]?.netIncome ?? null;
    const eq = data?.balanceSheetHistory?.balanceSheetStatements?.[0]?.totalStockholderEquity ?? null;
    if (typeof ni === 'number' && typeof eq === 'number' && eq !== 0) roeFrac = ni / eq;
  }
  const roe = (typeof roeFrac === 'number' && isFinite(roeFrac)) ? roeFrac * 100 : null;

  return { symbol, name, price, eps, peRatio, roe };
}

// ---------------- Routes ----------------
app.get('/api/health', (_req, res) => res.json({ ok: true, msg: 'Backend is running' }));

// Accepts ticker OR company name
app.get('/api/stock/:q', async (req, res) => {
  try {
    const q = req.params.q;
    const symbol = await resolveToSymbol(q);
    if (!symbol) return res.status(404).json({ error: `Could not resolve '${q}' to a ticker` });

    const result = await fetchFromYahoo(symbol);
    res.json({ ok: true, query: q, ...result });
  } catch (e) {
    console.error('single error', e?.message || e);
    res.status(500).json({ error: 'Failed to fetch stock data' });
  }
});

// Batch: /api/stocks?tickers=q1,q2,...
app.get('/api/stocks', async (req, res) => {
  try {
    const raw = (req.query.tickers || '').trim();
    if (!raw) return res.status(400).json({ error: 'Provide ?tickers=2222,Saudi Aramco,1180.SR' });

    const list = raw.split(',').map(s => s.trim()).filter(Boolean).slice(0, 25);

    const results = [];
    for (const q of list) {
      try {
        const symbol = await resolveToSymbol(q);
        if (!symbol) {
          results.push({ ok: false, query: q, symbol: null, error: 'unresolved' });
          continue;
        }
        const r = await fetchFromYahoo(symbol);
        results.push({ ok: true, query: q, ...r });
      } catch (_e) {
        results.push({ ok: false, query: q, symbol: null, error: 'fetch_failed' });
      }
    }

    res.json({ count: results.length, results });
  } catch (e) {
    console.error('batch error', e?.message || e);
    res.status(500).json({ error: 'batch_failed' });
  }
});

const port = process.env.PORT || 5000;
app.listen(port, () => console.log(`Backend running on http://localhost:${port}`));
