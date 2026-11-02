import React, { useState, useRef, useEffect } from "react";
import { api } from "../lib/api";
import { CAT, STATUS_C, ACTION_C } from "../constants";
import { Pill, Loader, ErrState } from "./primitives";
import { getChart } from "../lib/chartSetup";

/* ─── Scenario Search ────────────────────────────────────────── */
export function ScenarioSearch({ onSelect }) {
  const [q, setQ]           = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr]       = useState('');

  const search = async () => {
    if (!q.trim()) return;
    setLoading(true); setErr(''); setResult(null);
    try {
      const r = await api.post('/scenario-search', { query: q });
      if (r.ok) setResult(r.data);
      else setErr(r.message || r.error || 'Search failed.');
    } catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  };

  const examples = [
    'Customer migrating BW on HANA to BDC',
    'Client wants to improve data quality before S/4 go-live',
    'New SAP implementation — greenfield Datasphere',
    'Customer doing M&A needing data consolidation',
  ];

  return (
    <div>
      <div className="scenario-box">
        <div style={{ fontSize:13, fontWeight:700, color:'var(--heading)', marginBottom:6 }}>
          🔍 Describe a customer situation and I'll match the right services
        </div>
        <div style={{ fontSize:11, color:'var(--muted)', marginBottom:14 }}>
          Powered by SAP Services MCP — requires MCP_TOKEN to be configured
        </div>
        <div className="scenario-input-row">
          <input
            value={q} onChange={e => setQ(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && search()}
            placeholder="e.g. Customer migrating SAP BW to SAP Business Data Cloud…"
          />
          <button className="sbtn primary" onClick={search} disabled={loading || !q.trim()}>
            {loading ? '⟳ Searching…' : '🔍 Find Services'}
          </button>
        </div>
        <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
          {examples.map(ex => (
            <span key={ex} onClick={() => { setQ(ex); }}
              style={{ fontSize:10, padding:'3px 10px', border:'1px solid var(--border)', borderRadius:20, cursor:'pointer', background:q===ex?'var(--blue)':'var(--surface)', color:q===ex?'#fff':'var(--muted)', transition:'all .15s' }}>
              {ex}
            </span>
          ))}
        </div>
      </div>

      {err && <ErrState message={err.includes('not configured') ? '⚡ MCP_TOKEN not set — scenario search requires a live MCP connection. Set it via cf set-env and redeploy.' : err} />}
      {loading && <Loader />}

      {result && (
        <div>
          {result.answer && (
            <div className="scenario-answer">{result.answer}</div>
          )}
          {result.matchedServices && result.matchedServices.length > 0 && (
            <div>
              <div style={{ fontSize:12, fontWeight:700, color:'var(--heading)', marginBottom:10 }}>
                ✅ {result.matchedServices.length} matching service{result.matchedServices.length > 1 ? 's' : ''} in your portfolio:
              </div>
              <div className="scenario-hits">
                {result.matchedServices.map(s => (
                  <div key={s.sku} className="scenario-hit" onClick={() => onSelect(s)}>
                    <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:6 }}>
                      <a href={`${CAT}${s.sku}`} target="_blank" rel="noreferrer" className="sku-link" onClick={e => e.stopPropagation()}>#{s.sku}</a>
                      <Pill text={s.status} colorMap={STATUS_C} />
                    </div>
                    <div className="scenario-hit-name">{s.name}</div>
                    <div className="scenario-hit-meta">{s.journey} · {s.deliveryMethod || 'Remote'}{s.priceEur ? ` · €${Number(s.priceEur).toLocaleString()}` : ''}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {result.matchedServices && result.matchedServices.length === 0 && result.skusFound && result.skusFound.length > 0 && (
            <div className="notice orange">MCP found {result.skusFound.length} SKU(s) but none are in your local portfolio: {result.skusFound.join(', ')}. Consider adding them via ➕ Add Service.</div>
          )}
          {result.rawText && (
            <div style={{ marginTop:16 }}>
              <div style={{ fontSize:10, fontWeight:700, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.6px', marginBottom:6 }}>Full MCP Response</div>
              <div style={{ fontSize:11, color:'var(--text)', background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--r-sm)', padding:'10px 14px', maxHeight:220, overflowY:'auto', whiteSpace:'pre-wrap', lineHeight:1.6 }}>{result.rawText}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Service Radar Chart ─────────────────────────────────────── */
function ServiceRadarChart({ services }) {
  const canvasRef = useRef(null);
  const chartRef  = useRef(null);

  useEffect(() => {
    if (!services || services.length < 2) return;
    (async () => {
      const Chart = await getChart();
      if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; }
      if (!canvasRef.current) return;

      const maxBookings  = Math.max(...services.map(s => s.bookings  || 0), 1);
      const maxRevenue   = Math.max(...services.map(s => s.revenueEur|| 0), 1);
      const maxPrice     = Math.max(...services.map(s => s.priceEur  || 0), 1);
      const maxCustomers = Math.max(...services.map(s => s.customers || 0), 1);
      const readiness = s =>
        s.status === 'Active'                      ? 100 :
        (s.status || '').includes('Coming')        ?  60 :
        (s.status || '').includes('Retiring')      ?  20 : 40;

      const colors = ['#0070b1','#107e3e','#e9730c','#7b5ea7','#f0ab00'];

      chartRef.current = new Chart(canvasRef.current, {
        type: 'radar',
        data: {
          labels: ['Bookings', 'Revenue', 'Price', 'Customers', 'Readiness'],
          datasets: services.map((svc, i) => {
            const c = colors[i % colors.length];
            const label = (svc.name || svc.sku || '').substring(0, 22) +
              ((svc.name || '').length > 22 ? '…' : '');
            return {
              label,
              data: [
                Math.round((svc.bookings  || 0) / maxBookings  * 100),
                Math.round((svc.revenueEur|| 0) / maxRevenue   * 100),
                Math.round((svc.priceEur  || 0) / maxPrice     * 100),
                Math.round((svc.customers || 0) / maxCustomers * 100),
                readiness(svc),
              ],
              backgroundColor:    c + '22',
              borderColor:        c,
              borderWidth:        2,
              pointBackgroundColor: c,
              pointRadius:        4,
            };
          }),
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            r: {
              beginAtZero: true,
              max: 100,
              ticks:       { display: false, stepSize: 25 },
              grid:        { color: 'rgba(0,0,0,0.07)' },
              angleLines:  { color: 'rgba(0,0,0,0.08)' },
              pointLabels: { font: { size: 11, weight: '600' }, color: 'var(--text)' },
            },
          },
          plugins: {
            datalabels: { display: false },
            legend: {
              position: 'bottom',
              labels: { boxWidth: 12, font: { size: 11 }, padding: 16 },
            },
            tooltip: {
              callbacks: {
                label: ctx => ` ${ctx.dataset.label}: ${ctx.raw}/100`,
              },
            },
          },
        },
      });
    })();
    return () => { if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; } };
  }, [services]);

  if (!services || services.length < 2) {
    return (
      <div className="notice blue" style={{ marginBottom: 16 }}>
        Select at least 2 services to compare
      </div>
    );
  }

  return (
    <div className="card" style={{ marginBottom: 16, padding: '16px 18px' }}>
      <div className="card-hdr" style={{ marginBottom: 2 }}>⚖️ Service Comparison</div>
      <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 12 }}>
        Normalised 0–100 across selected services
      </div>
      <div style={{ height: 300, position: 'relative' }}>
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
}

/* ─── Compare Tab ────────────────────────────────────────────── */
export function CompareTab({ selected, onClear, onRemove, onSelect }) {
  if (!selected || selected.length === 0) return (
    <div style={{ textAlign:'center', padding:'60px 20px', color:'var(--muted)' }}>
      <div style={{ fontSize:32, marginBottom:12 }}>⚖️</div>
      <div style={{ fontSize:14, fontWeight:700, color:'var(--heading)', marginBottom:6 }}>No services selected for comparison</div>
      <div style={{ fontSize:12 }}>Go to the <strong>Service Catalog</strong>, tick the checkbox on 2–4 services, then click <strong>Compare Selected</strong>.</div>
    </div>
  );

  const FIELDS = [
    { label:'Journey',       key: s => s.journey },
    { label:'Status',        key: s => <Pill text={s.status} colorMap={STATUS_C} /> },
    { label:'Action',        key: s => <Pill text={s.action} colorMap={ACTION_C} /> },
    { label:'Delivery',      key: s => s.deliveryMethod || '—' },
    { label:'Engagement',    key: s => s.engagementType || '—' },
    { label:'Price (EUR)',   key: s => s.priceEur != null ? `€${Number(s.priceEur).toLocaleString()}` : '—' },
    { label:'Bookings',      key: s => s.bookings > 0 ? s.bookings : '—' },
    { label:'Revenue',       key: s => s.revenueEur > 0 ? `€${Number(s.revenueEur).toLocaleString()}` : '—' },
    { label:'Customers',     key: s => s.customers > 0 ? s.customers : '—' },
    { label:'Team Profile',  key: s => s.teamProfile || '—' },
    { label:'Scope',         key: s => <div style={{ fontSize:10, lineHeight:1.5, maxWidth:200 }}>{(s.scope||'—').substring(0,120)}{s.scope&&s.scope.length>120?'…':''}</div> },
  ];

  return (
    <div>
      <div className="compare-toolbar">
        <div className="compare-hint">Comparing <strong>{selected.length}</strong> service{selected.length>1?'s':''}</div>
        <button className="sbtn ghost" style={{ fontSize:11 }} onClick={onClear}>✕ Clear All</button>
      </div>
      {selected.length >= 2 && <ServiceRadarChart services={selected} />}
      <div className="card">
        <div className="compare-table-wrap">
          <table className="compare-tbl">
            <thead>
              <tr>
                <th style={{ width:110 }}>Field</th>
                {selected.map(s => (
                  <th key={s.sku}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:6 }}>
                      <div>
                        <div style={{ fontWeight:700 }}>{s.name.length > 30 ? s.name.substring(0,30)+'…' : s.name}</div>
                        <div style={{ fontSize:9, opacity:.7, marginTop:2 }}>#{s.sku}</div>
                      </div>
                      <button onClick={() => onRemove(s.sku)} style={{ background:'rgba(255,255,255,.2)', border:'none', color:'#fff', cursor:'pointer', borderRadius:4, padding:'1px 6px', fontSize:12 }}>✕</button>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {FIELDS.map(f => (
                <tr key={f.label}>
                  <td className="row-label">{f.label}</td>
                  {selected.map(s => <td key={s.sku}>{f.key(s)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}


/* ─── Coverage Heatmap ───────────────────────────────────────── */
function CoverageHeatmap({ missingServices = [] }) {
  const statBucket = s => {
    const st = (s.status || '').toLowerCase();
    if (st.includes('active'))                         return 'Active';
    if (st.includes('coming') || st.includes('upcoming')) return 'Upcoming';
    if (st.includes('retiring'))                       return 'Retiring';
    return 'Other';
  };

  const journeys = [...new Set(missingServices.map(s => s.journey || 'Unknown'))].filter(Boolean).sort();
  const buckets  = ['Active', 'Upcoming', 'Retiring', 'Other'];

  if (journeys.length === 0) return null;

  const matrix = {};
  journeys.forEach(j => { matrix[j] = {}; buckets.forEach(b => { matrix[j][b] = 0; }); });
  missingServices.forEach(s => {
    const j = s.journey || 'Unknown';
    const b = statBucket(s);
    if (matrix[j]) matrix[j][b] = (matrix[j][b] || 0) + 1;
  });

  const maxCount = Math.max(...journeys.flatMap(j => buckets.map(b => matrix[j][b])), 1);
  const cellColor = count => {
    if (count === 0) return 'var(--surface)';
    const intensity = Math.min(count / maxCount, 1);
    return `rgba(187, 0, 0, ${0.15 + intensity * 0.7})`;
  };

  return (
    <div className="card" style={{ padding: '16px 18px', marginBottom: 16 }}>
      <div className="card-hdr" style={{ marginBottom: 14 }}>🗺️ Gap Map — Missing Services by Journey &amp; Status</div>
      <div style={{ overflowX: 'auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: `160px repeat(${buckets.length}, 1fr)`, gap: 4, minWidth: 360 }}>
          {/* Header row */}
          <div />
          {buckets.map(b => (
            <div key={b} style={{ fontSize: 10, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'center', padding: '4px 0' }}>{b}</div>
          ))}
          {/* Data rows */}
          {journeys.map(j => (
            <React.Fragment key={j}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text)', padding: '8px 4px 8px 0', lineHeight: 1.3, display: 'flex', alignItems: 'center' }}>{j}</div>
              {buckets.map(b => {
                const count = matrix[j][b];
                return (
                  <div key={j + b} style={{
                    background:    cellColor(count),
                    borderRadius:  4,
                    padding:       '8px 4px',
                    textAlign:     'center',
                    fontSize:      count > 0 ? 14 : 11,
                    fontWeight:    count > 0 ? 700 : 400,
                    color:         count > 0 ? (count / maxCount > 0.5 ? '#fff' : '#bb0000') : 'var(--muted)',
                    border:        '1px solid var(--border)',
                    transition:    'background 0.2s',
                    minHeight:     36,
                    display:       'flex',
                    alignItems:    'center',
                    justifyContent:'center',
                  }}>
                    {count > 0 ? count : '–'}
                  </div>
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </div>
      <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 10 }}>Darker red = more gaps. Counts show services in the SAP catalog not yet in your portfolio.</div>
    </div>
  );
}

/* ─── Gap Analysis ───────────────────────────────────────────── */
export function GapAnalysis() {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const run = async () => {
    setLoading(true); setErr(''); setResult(null);
    try {
      const r = await api.get('/gap-analysis');
      if (r.ok) setResult(r.data);
      else setErr(r.message || 'Gap analysis requires MCP_TOKEN to be configured.');
    } catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div>
      <div className="notice blue" style={{ marginBottom:16 }}>
        Gap Analysis queries the full SAP Services MCP catalog and compares it against your portfolio — showing which service areas you cover and which ones are missing.
        Requires <strong>MCP_TOKEN</strong> to be set.
      </div>
      <button className="sbtn primary" onClick={run} disabled={loading}>{loading ? '⟳ Running…' : '▶ Run Gap Analysis'}</button>

      {err && <div className="notice orange" style={{ marginTop:16 }}>
        {err.includes('MCP') || err.includes('not configured')
          ? '🔴 MCP_TOKEN not configured. Set it via cf set-env data-ai-ps-portal MCP_TOKEN <token> and redeploy.'
          : `⚠️ ${err}`}
      </div>}

      {loading && <Loader />}

      {result && (
        <div style={{ marginTop:20 }}>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, marginBottom:20 }}>
            <div className="kpi g"><div className="kl">Covered</div><div className="kv">{result.covered || 0}</div><div className="ks">In your portfolio</div></div>
            <div className="kpi r"><div className="kl">Missing</div><div className="kv">{result.missing || 0}</div><div className="ks">In MCP but not yours</div></div>
            <div className="kpi"><div className="kl">Coverage</div><div className="kv">{result.coveragePct || 0}%</div><div className="ks">Of relevant catalog</div></div>
          </div>
          <CoverageHeatmap missingServices={result.missingServices || []} />
          {result.rawText && (
            <div style={{ fontSize:11, color:'var(--text)', background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--r-sm)', padding:'10px 14px', maxHeight:200, overflowY:'auto', whiteSpace:'pre-wrap', lineHeight:1.6 }}>{result.rawText}</div>
          )}
        </div>
      )}

      <div style={{ marginTop:24 }}>
        <div className="notice orange">
          🔴 <strong>CRM pipeline data not connected.</strong> A full gap analysis could also show revenue potential of uncovered areas if Sales Cloud data were available.
        </div>
      </div>
    </div>
  );
}

