import { useState } from "react";
import axios from "axios";

export default function App() {
  const [tickers, setTickers] = useState("Saudi Aramco, 2010.SR, The Saudi National Bank");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const fetchBatch = async () => {
    setLoading(true); setErr(""); setRows([]);

    // Allow company names OR tickers; split on commas and trim
    const rawTokens = tickers.split(",").map(s => s.trim()).filter(Boolean);

    if (rawTokens.length === 0) {
      setLoading(false);
      setErr("Enter one or more tickers or company names, separated by commas.");
      return;
    }

    try {
      const qs = encodeURIComponent(rawTokens.join(","));
      const url = `http://localhost:5000/api/stocks?tickers=${qs}`;
      const { data } = await axios.get(url);
      const clean = (data?.results || []).map(r => ({
        query: r.query,      // exactly what you typed
        name: r.name,        // company name
        symbol: r.symbol,    // resolved ticker (e.g., 2222.SR)
        price: r.price,
        eps: r.eps,
        pe: r.peRatio,
        roe: r.roe,
        ok: r.ok,
        error: r.error || null,
      }));
      setRows(clean); // keep original order
    } catch (e) {
      setErr(e?.response?.data?.error || e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      maxWidth: 1200,
      margin: "40px auto",
      fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
      fontSize: 18,
      lineHeight: 1.5
    }}>
      <h1 style={{ fontSize: 34, marginBottom: 6 }}>Saudi Stocks — P/E & ROE</h1>
      <p style={{ color: "#909090", marginTop: 0 }}>
        Type tickers <i>or</i> company names, separated by commas.
      </p>

      <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
        <input
          value={tickers}
          onChange={(e) => setTickers(e.target.value)}
          placeholder="e.g., Saudi Aramco, 2010.SR, The Saudi National Bank"
          style={{
            flex: 1,
            padding: "14px 16px",
            borderRadius: 12,
            border: "1px solid #bbb",
            fontSize: 18
          }}
        />
        <button
          onClick={fetchBatch}
          style={{
            padding: "14px 20px",
            borderRadius: 12,
            fontSize: 18,
            cursor: "pointer",
            border: "1px solid #bbb",
            background: "#1f1f1f"
          }}
        >
          Get Data
        </button>
      </div>

      {loading && <p style={{ marginTop: 16 }}>Loading…</p>}
      {err && <p style={{ marginTop: 16, color: "crimson" }}>{String(err)}</p>}

      {rows.length > 0 && (
        <div style={{ marginTop: 24, overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "2px solid #444" }}>
                <th style={th}>You typed</th>
                <th style={th}>Name</th>
                <th style={th}>Ticker</th>
                <th style={th}>Price</th>
                <th style={th}>EPS (TTM)</th>
                <th style={th}>P/E</th>
                <th style={th}>ROE</th>
                <th style={th}>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.query + ":" + (r.symbol || i)} style={{ background: i % 2 ? "rgba(255,255,255,0.03)" : "transparent" }}>
                  <td style={td}>{r.query}</td>
                  <td style={td}>{r.name || "—"}</td>
                  <td style={td}>{r.symbol || "—"}</td>
                  <td style={td}>{num(r.price)}</td>
                  <td style={td}>{num(r.eps)}</td>
                  <td style={td}>{num(r.pe)}</td>
                  <td style={td}>{pct(r.roe)}</td>
                  <td style={{ ...td, color: r.ok ? "#38b000" : "crimson" }}>
                    {r.ok ? "ok" : (r.error || "error")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p style={{ color: "#777", fontSize: 14, marginTop: 12 }}>
            Order matches your input. Missing values shown as “—”.
          </p>
        </div>
      )}
    </div>
  );
}

const th = { padding: "14px 12px", fontWeight: 700, fontSize: 18 };
const td = { padding: "12px 12px", fontSize: 18 };

function num(v) { return Number.isFinite(v) ? v.toFixed(2) : "—"; }
function pct(v) { return Number.isFinite(v) ? v.toFixed(2) + "%" : "—"; }
