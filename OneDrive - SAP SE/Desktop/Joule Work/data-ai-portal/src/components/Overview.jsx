import React, { useState, useEffect, useContext, useRef, useMemo } from 'react';
import { JourneysCtx } from '../contexts';
import { api } from '../lib/api';
import { getChart } from '../lib/chartSetup';
import { Loader } from './primitives';

export function KPISummaryWidget({ stats }) {
  const [cfg, setCfg] = useState(null);
  useEffect(() => {
    api.get('/config/kpi_config').then(r => { if (r.ok && r.data) setCfg(r.data); }).catch(() => {});
  }, []);
  if (!cfg || !stats) return null;

  const t = cfg.targets?.portfolio || {};
  const pct = (a, tgt) => tgt > 0 ? Math.min(200, Math.round(a / tgt * 100)) : null;
  const trafficColor = p => p == null ? 'var(--muted)' : p >= 80 ? '#107e3e' : p >= 50 ? '#e9730c' : '#bb0000';
  const trafficLabel = p => p == null ? '—' : p >= 80 ? 'On Track' : p >= 50 ? 'At Risk' : 'Behind';

  const items = [
    { label:'Bookings',  actual: stats.totalBookings  || 0, target: t.bookings,   fmt: v => v.toLocaleString() },
    { label:'Revenue',   actual: stats.totalRevenue   || 0, target: t.revenueEur, fmt: v => `€${v.toLocaleString()}` },
    { label:'Customers', actual: stats.totalCustomers || 0, target: t.customers,  fmt: v => v.toLocaleString() },
  ];
  const pcts       = items.map(i => pct(i.actual, i.target)).filter(p => p != null);
  const overallPct = pcts.length > 0 ? Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length) : null;

  return (
    <div className="card" style={{ marginBottom:18 }}>
      <div className="card-hdr" style={{ justifyContent:'space-between' }}>
        <span>🎯 {cfg.period} KPI Progress</span>
        {overallPct != null && (
          <span style={{ fontSize:11, fontWeight:700, padding:'2px 10px', borderRadius:10,
            background: overallPct >= 80 ? '#e8f5e9' : overallPct >= 50 ? '#fff3e0' : '#ffebee',
            color: trafficColor(overallPct) }}>
            Avg {overallPct}% · {trafficLabel(overallPct)}
          </span>
        )}
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3, 1fr)' }}>
        {items.map((item, i) => {
          const p = pct(item.actual, item.target);
          return (
            <div key={item.label} style={{ padding:'14px 18px', borderRight: i < 2 ? '1px solid var(--border)' : 'none' }}>
              <div style={{ fontSize:10, fontWeight:700, color:'var(--muted)', textTransform:'uppercase', marginBottom:4 }}>{item.label}</div>
              <div style={{ fontSize:18, fontWeight:800, color:'var(--heading)', marginBottom:4 }}>{item.fmt(item.actual)}</div>
              {item.target ? (
                <>
                  <div style={{ background:'var(--border)', borderRadius:3, height:4, margin:'6px 0' }}>
                    <div style={{ background: trafficColor(p), height:4, borderRadius:3, width:`${Math.min(100,p||0)}%`, transition:'width 0.5s' }} />
                  </div>
                  <div style={{ fontSize:10, fontWeight:700, color: trafficColor(p) }}>{p}% · {trafficLabel(p)}</div>
                  <div style={{ fontSize:9, color:'var(--muted)' }}>Target: {item.fmt(item.target)}</div>
                </>
              ) : (
                <div style={{ fontSize:10, color:'var(--muted)', fontStyle:'italic', marginTop:4 }}>Set target in Analytics → KPIs</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function PortfolioHealthDoughnut({ stats }) {
  const canvasRef = useRef(null);
  const chartRef  = useRef(null);

  useEffect(() => {
    if (!stats) return;
    const total = (stats.active || 0) + (stats.coming || 0) + (stats.retiring || 0);
    (async () => {
      const Chart = await getChart();
      if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; }
      if (!canvasRef.current) return;
      chartRef.current = new Chart(canvasRef.current, {
        type: 'doughnut',
        data: {
          labels: ['Active', 'Upcoming', 'Retiring'],
          datasets: [{
            data: [stats.active || 0, stats.coming || 0, stats.retiring || 0],
            backgroundColor: ['#107e3e', '#0070b1', '#bb0000'],
            borderWidth: 2,
            borderColor: 'var(--card)',
            hoverOffset: 8,
          }],
        },
        options: {
          responsive: false,
          maintainAspectRatio: false,
          cutout: '70%',
          plugins: {
            datalabels: { display: false },
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: ctx => ` ${ctx.label}: ${ctx.raw} (${total > 0 ? Math.round(ctx.raw / total * 100) : 0}%)`,
              },
            },
          },
        },
      });
    })();
    return () => { if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; } };
  }, [stats]);

  if (!stats) return null;

  const total = (stats.active || 0) + (stats.coming || 0) + (stats.retiring || 0);
  const segments = [
    { label: 'Active',    value: stats.active   || 0, color: '#107e3e' },
    { label: 'Upcoming',  value: stats.coming   || 0, color: '#0070b1' },
    { label: 'Retiring',  value: stats.retiring || 0, color: '#bb0000' },
  ];
  const retirePct = total > 0 ? (stats.retiring || 0) / total : 0;
  const healthy = retirePct <= 0.2;

  return (
    <div className="card" style={{ padding: 18, marginBottom: 18 }}>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 3 }}>Portfolio Health</div>
        <div style={{ fontSize: 11, color: 'var(--muted)' }}>Mix of Active, Upcoming and Retiring services. Badge turns red when &gt;20% of the portfolio is retiring.</div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
        <div style={{ position: 'relative', width: 180, height: 180, flexShrink: 0 }}>
          <canvas ref={canvasRef} width={180} height={180} />
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
            <div style={{ fontSize: 34, fontWeight: 800, color: 'var(--heading)', lineHeight: 1 }}>{stats.total}</div>
            <div style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase', marginTop: 3 }}>Total</div>
          </div>
        </div>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {segments.map(seg => {
            const pct = total > 0 ? Math.round(seg.value / total * 100) : 0;
            return (
              <div key={seg.label}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, fontWeight: 600, color: 'var(--text)', marginBottom: 3 }}>
                  <span style={{ color: seg.color }}>{seg.label}</span>
                  <span>{seg.value} <span style={{ color: 'var(--muted)', fontWeight: 400 }}>({pct}%)</span></span>
                </div>
                <div style={{ background: 'var(--border)', borderRadius: 3, height: 5 }}>
                  <div style={{ background: seg.color, width: `${pct}%`, height: 5, borderRadius: 3, transition: 'width .5s' }} />
                </div>
              </div>
            );
          })}
          <div style={{ marginTop: 6 }}>
            <span style={{
              fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 10,
              background: healthy ? '#e8f5e9' : '#ffebee',
              color: healthy ? '#107e3e' : '#bb0000',
            }}>
              {healthy ? '✓ Portfolio Healthy' : '⚠ High Retirement Rate'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function RevenueRiskGauge({ stats }) {
  const canvasRef = useRef(null);
  const chartRef  = useRef(null);

  if (!stats) return null;

  const riskPct = (stats.totalRevenue || 0) > 0
    ? Math.round((stats.retirementRevenue || 0) / (stats.totalRevenue || 1) * 100)
    : 0;
  const barColor = riskPct > 20 ? '#bb0000' : riskPct > 10 ? '#e9730c' : '#f0ab00';
  const retiring = stats.retiring || 0;

  useEffect(() => {
    (async () => {
      const Chart = await getChart();
      if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; }
      if (!canvasRef.current) return;
      chartRef.current = new Chart(canvasRef.current, {
        type: 'doughnut',
        data: {
          labels: ['At Risk', 'Safe'],
          datasets: [{
            data: [riskPct, 100 - riskPct],
            backgroundColor: [barColor, '#e5e7eb'],
            borderWidth: 0,
          }],
        },
        options: {
          responsive: false,
          maintainAspectRatio: false,
          rotation: -90,
          circumference: 180,
          cutout: '75%',
          plugins: {
            datalabels: { display: false },
            legend: { display: false },
            tooltip: { enabled: false },
          },
        },
      });
    })();
    return () => { if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; } };
  }, [stats]);

  const statusLabel = riskPct > 20 ? 'High Risk' : riskPct > 10 ? 'Monitor' : 'Low Risk';
  const statusBg    = riskPct > 20 ? '#ffebee' : riskPct > 10 ? '#fff3e0' : '#e8f5e9';

  return (
    <div className="card" style={{ padding: 18, display: 'flex', alignItems: 'center', gap: 20, marginBottom: 18 }}>
      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 10 }}>
          Revenue at Risk
        </div>
        <div style={{ position: 'relative', width: 180, height: 100, flexShrink: 0 }}>
          <canvas ref={canvasRef} width={180} height={100} />
          <div style={{ position: 'absolute', bottom: 0, width: '100%', textAlign: 'center', pointerEvents: 'none' }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: barColor, lineHeight: 1 }}>{riskPct}%</div>
            <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>Revenue at Risk</div>
          </div>
        </div>
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: barColor, marginBottom: 4 }}>
          €{(stats.retirementRevenue || 0).toLocaleString()}
        </div>
        <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 12 }}>
          across {retiring} retiring SKU{retiring !== 1 ? 's' : ''}
        </div>
        <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 10, background: statusBg, color: barColor }}>
          {statusLabel}
        </span>
      </div>
    </div>
  );
}

export function PortfolioSparkline() {
  const canvasRef = useRef(null);
  const chartRef  = useRef(null);

  useEffect(() => {
    api.get('/audit?limit=200').then(async r => {
      const entries = r.data || [];
      if (!entries.length) return;

      const weekMap = {};
      const now = new Date();
      for (let w = 7; w >= 0; w--) {
        const d = new Date(now);
        d.setDate(d.getDate() - w * 7);
        const key = `W${Math.ceil(d.getDate()/7)} ${d.toLocaleString('en',{month:'short'})}`;
        weekMap[key] = 0;
      }
      entries.forEach(e => {
        const d = new Date(e.changedAt);
        if (isNaN(d)) return;
        const ageDays = Math.floor((now - d) / 86400000);
        if (ageDays > 56) return;
        const weekIdx = Math.floor(ageDays / 7);
        const ref = new Date(now);
        ref.setDate(ref.getDate() - weekIdx * 7);
        const key = `W${Math.ceil(ref.getDate()/7)} ${ref.toLocaleString('en',{month:'short'})}`;
        if (weekMap[key] !== undefined) weekMap[key]++;
      });

      const labels = Object.keys(weekMap);
      const data   = Object.values(weekMap);
      if (!canvasRef.current) return;
      const Chart = await getChart();
      if (!canvasRef.current) return;
      if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; }
      chartRef.current = new Chart(canvasRef.current, {
        type: 'bar',
        data: {
          labels,
          datasets: [{
            data,
            backgroundColor: data.map((v,i) => i === data.length-1 ? '#0070b1' : '#0070b155'),
            borderRadius: 3,
          }]
        },
        options: {
          responsive: true, maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            datalabels: { display: false },
            tooltip: { callbacks: { label: i => ` ${i.raw} change${i.raw!==1?'s':''}` } },
          },
          scales: {
            x: { grid:{ display:false }, ticks:{ font:{size:9}, color:'#999' } },
            y: { grid:{ color:'rgba(0,0,0,.05)' }, ticks:{ font:{size:9}, stepSize:1 }, beginAtZero:true },
          }
        }
      });
    }).catch(() => {});
    return () => { if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; } };
  }, []);

  return (
    <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:'var(--r)', padding:'14px 18px', marginBottom:16 }}>
      <div style={{ fontSize:11, fontWeight:700, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:10 }}>Portfolio Changes — Last 8 Weeks</div>
      <div style={{ height:80 }}>
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
}

export function RecentActivity() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get('/audit?limit=5')
      .then(r => setItems(r.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return null;
  if (!items.length) return null;

  const fmtTime = ts => {
    if (!ts) return '';
    const d = new Date(ts);
    const now = new Date();
    const diffMs = now - d;
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 60) return diffMin <= 1 ? 'just now' : `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    return d.toLocaleDateString(undefined, { month:'short', day:'numeric' });
  };

  return (
    <div style={{ background:'var(--card)', border:'1px solid var(--border)', borderRadius:'var(--r)', padding:'14px 18px', marginBottom:16 }}>
      <div style={{ fontSize:11, fontWeight:700, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:10 }}>Recent Activity</div>
      <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
        {items.map((item, i) => (
          <div key={i} style={{ display:'flex', alignItems:'baseline', gap:8, fontSize:12 }}>
            <span style={{ color:'var(--muted)', fontSize:10, flexShrink:0, width:56 }}>{fmtTime(item.changedAt)}</span>
            <span style={{ color:'var(--blue)', fontWeight:600, flexShrink:0 }}>#{item.sku}</span>
            <span style={{ color:'var(--text)' }}><span style={{ fontWeight:600 }}>{item.field}</span>: {item.oldVal ? <><span style={{ color:'var(--red)', textDecoration:'line-through' }}>{String(item.oldVal).slice(0,20)}</span> → </> : ''}<span style={{ color:'var(--green)' }}>{String(item.newVal||'').slice(0,30)}</span></span>
            <span style={{ color:'var(--muted)', fontSize:10, marginLeft:'auto', flexShrink:0 }}>by {item.changedBy || '—'}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PortfolioScorecard({ stats }) {
  if (!stats) return null;
  const total = Math.max(stats.total || 1, 1);
  const priced = Object.values(stats.byJourneyPriced || {}).reduce((a, j) => a + (j.priced || 0), 0);
  const byJ = stats.byJourney || {};
  const allJourneyNames     = Object.keys(byJ);
  const wellCoveredJourneys = allJourneyNames.filter(j => (byJ[j] || 0) >= 2).length;

  const completeness = Math.round(priced / total * 100);
  const coverage     = allJourneyNames.length > 0
    ? Math.round(wellCoveredJourneys / allJourneyNames.length * 100)
    : 0;
  const financial    = stats.totalRevenue > 0 && stats.totalBookings > 0
    ? Math.min(100, 50 + Math.round(Math.log10(stats.totalBookings + 1) * 15))
    : stats.totalRevenue > 0 ? 30 : 0;
  const retirePct    = (stats.retiring / total) * 100;
  const retRevPct    = stats.totalRevenue > 0 ? (stats.retirementRevenue / stats.totalRevenue) * 100 : retirePct;
  const risk         = Math.max(0, Math.round(100 - retirePct * 0.5 - retRevPct * 0.5));
  const readiness    = Math.min(100, Math.round(((stats.coming || 0) / Math.max(stats.retiring, 1)) * 50 + 30));
  const overall      = Math.round((completeness + coverage + financial + risk + readiness) / 5);

  const scoreColor = overall >= 80 ? '#107e3e' : overall >= 60 ? '#e9730c' : '#bb0000';
  const scoreLabel = overall >= 80 ? 'Healthy' : overall >= 60 ? 'Needs Attention' : 'At Risk';

  const dimList = [
    { label:'Completeness', value:completeness, color:'#0070b1', hint:`${priced} of ${total} services have pricing data` },
    { label:'Coverage',     value:coverage,     color:'#107e3e', hint:`${wellCoveredJourneys} of ${allJourneyNames.length} journey areas have ≥2 services` },
    { label:'Financial',    value:financial,    color:'#f0ab00', hint:`€${(stats.totalRevenue||0).toLocaleString()} total revenue, ${(stats.totalBookings||0).toLocaleString()} bookings tracked` },
    { label:'Risk Score',   value:risk,         color:risk < 60 ? '#bb0000' : risk < 80 ? '#e9730c' : '#107e3e', hint:`€${(stats.retirementRevenue||0).toLocaleString()} revenue at risk (retiring SKUs)` },
    { label:'Readiness',    value:readiness,    color:'#7b5ea7', hint:`${stats.coming||0} upcoming services vs ${stats.retiring||0} retiring` },
  ];

  return (
    <div style={{ background:'var(--card)', borderRadius:'var(--r)', boxShadow:'var(--sh)', padding:'20px 24px', marginBottom:20 }}>
      <div style={{ marginBottom: 16 }}>
        <div className="card-hdr" style={{ marginBottom: 3 }}>📊 Portfolio Score</div>
        <div style={{ fontSize: 11, color: 'var(--muted)' }}>Composite score across Completeness, Coverage, Financial health, Risk and Readiness. Update KPI targets in Settings → Data.</div>
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:24, flexWrap:'wrap' }}>
        <div style={{ textAlign:'center', minWidth:100, flexShrink:0 }}>
          <div style={{ fontSize:52, fontWeight:800, color:scoreColor, lineHeight:1 }}>{overall}</div>
          <div style={{ fontSize:10, fontWeight:700, color:scoreColor, textTransform:'uppercase', letterSpacing:.5, marginTop:3 }}>{scoreLabel}</div>
          <div style={{ fontSize:10, color:'var(--muted)', marginTop:4 }}>Portfolio Score</div>
        </div>
        <div style={{ flex:1, display:'flex', flexDirection:'column', gap:10, minWidth:0 }}>
          {dimList.map(d => (
            <div key={d.label} title={d.hint} style={{ display:'flex', alignItems:'center', gap:10, cursor:'default' }}>
              <div style={{ fontSize:11, fontWeight:600, color:'var(--text)', width:105, flexShrink:0 }}>{d.label}</div>
              <div style={{ flex:1, background:'var(--surface)', borderRadius:4, height:7, overflow:'hidden' }}>
                <div style={{ width:`${d.value}%`, height:'100%', background:d.color, borderRadius:4, transition:'width .7s ease' }} />
              </div>
              <div style={{ fontSize:12, fontWeight:700, color:d.color, width:34, textAlign:'right', flexShrink:0 }}>{d.value}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function AIAdvisorPanel({ stats, services }) {
  const [open, setOpen] = useState(true);
  const recs = React.useMemo(() => {
    if (!stats || !services) return [];
    const all = [];
    const total = stats.total || 0;
    const priced = Object.values(stats.byJourneyPriced || {}).reduce((a, j) => a + (j.priced || 0), 0);
    const unpricedCount = total - priced;
    if (unpricedCount > 0) {
      all.push({ level:'warn', icon:'💰', title:`${unpricedCount} service${unpricedCount !== 1 ? 's' : ''} without pricing`, body:`Services with no price are invisible to deal-desk. Open each SKU → Pricing tab to pull live data from MCP.` });
    }
    const byJ = stats.byJourney || {};
    const thinJourneys = Object.entries(byJ).filter(([, c]) => c === 1).map(([j]) => j);
    if (thinJourneys.length > 0) {
      all.push({ level:'warn', icon:'🗂️', title:`${thinJourneys.length} journey${thinJourneys.length !== 1 ? 's' : ''} with only 1 service`, body:`${thinJourneys.join(', ')} — single-service journeys give customers no choice and create coverage risk.` });
    }
    const retirers = services.filter(s => s.status && s.status.toLowerCase().includes('retir') && s.revenueEur > 0);
    const noSuccessor = retirers.filter(s => !(s.notes || '').match(/\(\d{7,9}\)/));
    if (noSuccessor.length > 0) {
      const revAtRisk = noSuccessor.reduce((a, s) => a + (s.revenueEur || 0), 0);
      all.push({ level:'crit', icon:'🚨', title:`${noSuccessor.length} retiring service${noSuccessor.length !== 1 ? 's' : ''} without a successor`, body:`€${revAtRisk.toLocaleString()} revenue with no migration path identified. Add successor SKU in notes as (XXXXXXX).` });
    }
    const noOwner = services.filter(s => !s.owner || s.owner.trim() === '');
    if (noOwner.length > 5) {
      all.push({ level:'info', icon:'👤', title:`${noOwner.length} services without an owner`, body:`Unowned services have no accountability. Assign owners to improve governance and enable "My Portfolio" filtering.` });
    }
    if (stats.totalBookings === 0 && total > 0) {
      all.push({ level:'info', icon:'📊', title:'No performance data tracked yet', body:'Import a CSV on the Performance tab to unlock revenue tracking, trend charts, and health scoring.' });
    }
    const upcoming = stats.coming || 0;
    const retiring = stats.retiring || 0;
    if (retiring > 0 && upcoming < retiring * 0.5) {
      all.push({ level:'warn', icon:'📉', title:'Upcoming pipeline behind retirement pace', body:`Only ${upcoming} upcoming vs ${retiring} retiring — portfolio will shrink unless new services are added.` });
    }
    return all.slice(0, 5);
  }, [stats, services]);

  if (!recs.length) return null;

  const levelColor = { crit:'#bb0000', warn:'#e9730c', info:'#0070b1' };

  return (
    <div style={{ background:'var(--card)', borderRadius:'var(--r)', boxShadow:'var(--sh)', marginBottom:20, overflow:'hidden' }}>
      <div style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 18px', borderBottom: open ? '1px solid var(--border)' : 'none', cursor:'pointer' }} onClick={() => setOpen(o => !o)}>
        <span style={{ fontSize:14 }}>🔔</span>
        <span style={{ fontWeight:700, color:'var(--heading)', fontSize:13 }}>Portfolio Advisor</span>
        <span style={{ fontSize:11, background:'#bb000018', color:'#bb0000', fontWeight:700, padding:'2px 8px', borderRadius:10, marginLeft:4 }}>{recs.length} items need attention</span>
        <span style={{ marginLeft:'auto', fontSize:12, color:'var(--muted)' }}>{open ? '▲' : '▼'}</span>
      </div>
      {open && (
        <div style={{ padding:'12px 18px', display:'flex', flexDirection:'column', gap:10 }}>
          {recs.map((r, i) => (
            <div key={i} style={{ display:'flex', gap:12, padding:'10px 14px', borderRadius:'var(--r-sm)', background:'var(--surface)', borderLeft:`3px solid ${levelColor[r.level] || '#0070b1'}` }}>
              <span style={{ fontSize:16, flexShrink:0, marginTop:1 }}>{r.icon}</span>
              <div>
                <div style={{ fontWeight:700, fontSize:12, color:'var(--text)', marginBottom:2 }}>{r.title}</div>
                <div style={{ fontSize:11, color:'var(--muted)', lineHeight:1.6 }}>{r.body}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RetirementTimeline({ retDates, sortedDates }) {
  const canvasRef = useRef(null);
  const chartRef  = useRef(null);

  useEffect(() => {
    if (!sortedDates.length) return;
    (async () => {
      const Chart = await getChart();
      if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; }
      if (!canvasRef.current) return;
      chartRef.current = new Chart(canvasRef.current, {
        type: 'bar',
        data: {
          labels: sortedDates,
          datasets: [{
            label: 'SKUs retiring',
            data: sortedDates.map(d => retDates[d]),
            backgroundColor: sortedDates.map((d, i) => i === 0 ? '#bb0000' : '#e9730c'),
            borderRadius: 4,
            borderSkipped: false,
          }],
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            datalabels: {
              display: true,
              color: '#fff',
              font: { weight: 'bold', size: 12 },
              formatter: v => `${v} SKU${v !== 1 ? 's' : ''}`,
              anchor: 'center',
              align: 'center',
            },
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: ctx => ` ${ctx.raw} service${ctx.raw !== 1 ? 's' : ''} retiring`,
              },
            },
          },
          scales: {
            x: { display: false, grid: { display: false } },
            y: { grid: { display: false }, ticks: { font: { size: 12, weight: 'bold' } } },
          },
        },
      });
    })();
    return () => { if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; } };
  }, [retDates, sortedDates]);

  if (!sortedDates.length) return null;

  const totalRetiring = Object.values(retDates).reduce((a, b) => a + b, 0);
  const months = { Jan:0, Feb:1, Mar:2, Apr:3, May:4, Jun:5, Jul:6, Aug:7, Sep:8, Oct:9, Nov:10, Dec:11 };
  const daysUntil = dateStr => {
    const [m, y] = (dateStr || '').split(' ');
    if (!y) return null;
    const target = new Date(parseInt(y), months[m] || 0, 1);
    return Math.ceil((target - Date.now()) / 86400000);
  };
  const firstDays = daysUntil(sortedDates[0]);
  const firstDaysLabel = firstDays === null ? null
    : firstDays > 0 ? `${firstDays} days away`
    : firstDays === 0 ? 'Today'
    : `${Math.abs(firstDays)} days ago`;

  return (
    <div className="card" style={{ padding: 16, marginBottom: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--heading)', marginBottom: 4 }}>
        📅 Retirement Schedule — {totalRetiring} SKUs
      </div>
      {firstDaysLabel && (
        <div style={{ fontSize: 11, color: firstDays !== null && firstDays < 120 ? '#bb0000' : 'var(--muted)', marginBottom: 12 }}>
          First deadline ({sortedDates[0]}): {firstDaysLabel}
        </div>
      )}
      <div style={{ height: Math.max(80, sortedDates.length * 48), position: 'relative' }}>
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
}

export function Overview({ stats, onDrillDown }) {
  const { journeyNames: JOURNEYS } = useContext(JourneysCtx) || {};
  const drillRef = useRef(onDrillDown);
  useEffect(() => { drillRef.current = onDrillDown; });
  const [advisorSvcs, setAdvisorSvcs] = useState([]);
  const [activityOpen, setActivityOpen] = useState(false);
  const [recentChanges, setRecentChanges] = useState([]);
  const [dates, setDates] = useState(null);
  useEffect(() => { api.get('/services?limit=500').then(r => setAdvisorSvcs(r.data || [])).catch(() => {}); }, []);
  useEffect(() => { api.get('/audit?limit=3').then(r => setRecentChanges(r.data || [])).catch(() => {}); }, []);
  useEffect(() => { api.get('/config/portfolio_dates').then(r => { if (r.ok && r.data) setDates(r.data); }).catch(() => {}); }, []);

  if (!stats) return <Loader />;

  const retDates = stats.byRetirementDate || {};
  const sortedRetDates = Object.keys(retDates).sort((a, b) => {
    const months = {Jan:1,Feb:2,Mar:3,Apr:4,May:5,Jun:6,Jul:7,Aug:8,Sep:9,Oct:10,Nov:11,Dec:12};
    const parse = d => { const [m,y]=(d||'').split(' '); return (parseInt(y)||0)*100+(months[m]||0); };
    return parse(a) - parse(b);
  });
  const totalRetiring = Object.values(retDates).reduce((a,b)=>a+b,0);
  const daysUntil = dateStr => {
    const [m, y] = (dateStr||'').split(' ');
    const months = {Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11};
    if (!y) return null;
    const target = new Date(parseInt(y), months[m]||0, 1);
    const diff = Math.ceil((target - Date.now()) / 86400000);
    return diff;
  };

  return (
    <div>
      <div className="kpi-row">
        <div className="kpi" onClick={() => onDrillDown?.({ statusContains:'', _ts:Date.now() })}>
          <div className="kl">Total Portfolio</div><div className="kv">{stats.total}</div><div className="ks">Services across {(JOURNEYS||[]).filter(j => (stats.byJourney||{})[j]).length} journeys ↗</div>
        </div>
        <div className="kpi g" onClick={() => onDrillDown?.({ statusContains:'Active', _ts:Date.now() })}>
          <div className="kl">Active</div><div className="kv">{stats.active}</div><div className="ks">Available to book today ↗</div>
        </div>
        <div className="kpi o" onClick={() => onDrillDown?.({ statusContains:'Upcoming', _ts:Date.now() })}>
          <div className="kl">Upcoming</div><div className="kv">{stats.coming}</div><div className="ks">{(dates?.upcomingNote || 'New offerings') + ' ↗'}</div>
        </div>
        <div className="kpi r" onClick={() => onDrillDown?.({ statusContains:'Retiring', _ts:Date.now() })}>
          <div className="kl">Retiring</div><div className="kv">{stats.retiring}</div><div className="ks">{(dates?.retiringNote || 'Phasing out') + ' ↗'}</div>
        </div>
        <div className="kpi gd" onClick={() => onDrillDown?.({ statusContains:'Retiring', _ts:Date.now() })}>
          <div className="kl">Revenue at Risk</div>
          <div className="kv">€{(stats.retirementRevenue || 0).toLocaleString()}</div>
          <div className="ks">Tracked on retiring SKUs ↗</div>
        </div>
      </div>

      <PortfolioHealthDoughnut stats={stats} />

      <KPISummaryWidget stats={stats} />

      <RevenueRiskGauge stats={stats} />

      <RetirementTimeline retDates={retDates} sortedDates={sortedRetDates} />

      <AIAdvisorPanel stats={stats} services={advisorSvcs} />
      <PortfolioScorecard stats={stats} />

      {recentChanges.length > 0 && (
        <div className="card" style={{ marginTop:16, padding:'12px 16px' }}>
          <div style={{ fontSize:11, fontWeight:700, color:'var(--muted)', textTransform:'uppercase', letterSpacing:.3, marginBottom:10 }}>Recent Changes</div>
          {recentChanges.map((c, i) => {
            const ago = (() => {
              const diff = Date.now() - new Date(c.ts).getTime();
              const mins = Math.round(diff / 60000);
              if (mins < 60) return `${mins}m ago`;
              const hrs = Math.round(diff / 3600000);
              if (hrs < 24) return `${hrs}h ago`;
              return `${Math.round(diff / 86400000)}d ago`;
            })();
            return (
              <div key={i} style={{ display:'flex', alignItems:'center', gap:8, padding:'5px 0', borderBottom: i < recentChanges.length-1 ? '1px solid var(--border)' : 'none' }}>
                <span style={{ fontSize:16, flexShrink:0 }}>{c.action==='create'?'➕':c.action==='delete'?'🗑️':'✏️'}</span>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:12, fontWeight:600, color:'var(--heading)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    {c.name || c.sku}
                  </div>
                  <div style={{ fontSize:10, color:'var(--muted)' }}>
                    {c.action} · {c.changedBy || 'system'}
                  </div>
                </div>
                <span style={{ fontSize:10, color:'var(--muted)', flexShrink:0 }}>{ago}</span>
              </div>
            );
          })}
        </div>
      )}

      <div className="card" style={{ marginTop:16 }}>
        <div className="card-hdr" style={{ cursor:'pointer', justifyContent:'space-between' }}
          onClick={() => setActivityOpen(o => !o)}>
          <span>📋 Portfolio Activity</span>
          <span style={{ fontSize:11, color:'var(--muted)', fontWeight:400 }}>{activityOpen ? '▲ hide' : '▼ show'}</span>
        </div>
        {activityOpen && (
          <div style={{ padding:'0 0 8px' }}>
            <RecentActivity />
            <PortfolioSparkline />
          </div>
        )}
      </div>
    </div>
  );
}
