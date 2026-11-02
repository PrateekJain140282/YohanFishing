import React, { useState, useEffect, useCallback, useRef, useContext } from "react";
import { JourneysCtx } from "../contexts";
import { api, fmtDate } from "../lib/api";
import { getChart } from "../lib/chartSetup";
import { STATUS_C, ACTION_C } from "../constants";
import { Pill, Loader, ErrState } from "./primitives";
import { useToast } from "../contexts";

/* ─── Performance Tab ────────────────────────────────────────── */
export function WhatIfPanel() {
  const [services, setServices]   = useState([]);
  const [scenario, setScenario]   = useState('realistic');
  useEffect(() => {
    api.get('/services?limit=500').then(r => setServices((r.data || []).filter(s => s.status && s.status.toLowerCase().includes('retir')))).catch(() => {});
  }, []);
  if (!services.length) return (
    <div style={{ fontSize:11, color:'var(--muted)', fontStyle:'italic' }}>No retiring services found — what-if analysis will appear here once retirements are scheduled.</div>
  );
  const totalAtRisk = services.reduce((a, s) => a + (s.revenueEur || 0), 0);
  const rates = { worst: 0, realistic: 0.25, optimistic: 0.5 };
  const replaced = Math.round(totalAtRisk * (rates[scenario] || 0));
  const netLoss  = totalAtRisk - replaced;
  return (
    <div style={{ borderTop:'1px solid var(--border)', paddingTop:14 }}>
      <div style={{ fontSize:11, fontWeight:700, color:'var(--heading)', marginBottom:10 }}>💡 What-If: Retirement Impact</div>
      <div style={{ display:'flex', gap:10, alignItems:'center', flexWrap:'wrap', marginBottom:12 }}>
        <span style={{ fontSize:11, color:'var(--muted)' }}>Replacement scenario:</span>
        {[['worst','0% replaced (worst case)'],['realistic','25% replaced (realistic)'],['optimistic','50% replaced (optimistic)']].map(([v, lbl]) => (
          <button key={v} onClick={() => setScenario(v)}
            style={{ fontSize:11, padding:'4px 10px', borderRadius:4, border:'1px solid var(--border)', cursor:'pointer',
                     background: scenario===v ? '#0070b1' : 'var(--surface)', color: scenario===v ? '#fff' : 'var(--text)', fontWeight: scenario===v ? 700 : 400 }}>
            {lbl}
          </button>
        ))}
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(130px, 1fr))', gap:10 }}>
        <div style={{ padding:'10px 14px', background:'#bb000010', borderRadius:'var(--r-sm)', borderLeft:'3px solid #bb0000' }}>
          <div style={{ fontSize:10, fontWeight:700, color:'#bb0000' }}>REVENUE AT RISK</div>
          <div style={{ fontSize:20, fontWeight:800, color:'#bb0000', margin:'3px 0 1px' }}>€{totalAtRisk.toLocaleString()}</div>
          <div style={{ fontSize:10, color:'var(--muted)' }}>{services.length} retiring services</div>
        </div>
        <div style={{ padding:'10px 14px', background:'#107e3e10', borderRadius:'var(--r-sm)', borderLeft:'3px solid #107e3e' }}>
          <div style={{ fontSize:10, fontWeight:700, color:'#107e3e' }}>REPLACEMENT REVENUE</div>
          <div style={{ fontSize:20, fontWeight:800, color:'#107e3e', margin:'3px 0 1px' }}>€{replaced.toLocaleString()}</div>
          <div style={{ fontSize:10, color:'var(--muted)' }}>{Math.round((rates[scenario]||0)*100)}% of at-risk revenue</div>
        </div>
        <div style={{ padding:'10px 14px', background: netLoss > 0 ? '#e9730c10' : '#107e3e10', borderRadius:'var(--r-sm)', borderLeft:`3px solid ${netLoss > 0 ? '#e9730c' : '#107e3e'}` }}>
          <div style={{ fontSize:10, fontWeight:700, color: netLoss > 0 ? '#e9730c' : '#107e3e' }}>NET PORTFOLIO IMPACT</div>
          <div style={{ fontSize:20, fontWeight:800, color: netLoss > 0 ? '#e9730c' : '#107e3e', margin:'3px 0 1px' }}>-€{netLoss.toLocaleString()}</div>
          <div style={{ fontSize:10, color:'var(--muted)' }}>Estimated gap to fill</div>
        </div>
      </div>
    </div>
  );
}

export function ScheduleCard() {
  const [freq,            setFreq]            = useState('off');
  const [schedTime,       setSchedTime]       = useState('08:00');
  const [dow,             setDow]             = useState(1);
  const [dom,             setDom]             = useState(1);
  const [saving,          setSaving]          = useState(false);
  const [scheduleStatus,  setScheduleStatus]  = useState('');
  const [currentSchedule, setCurrentSchedule] = useState(null);
  const toast = useToast();

  const SCHED_DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

  useEffect(() => {
    api.get('/schedule').then(r => {
      if (r.ok && r.data && r.data.freq) {
        setCurrentSchedule(r.data);
        setFreq(r.data.freq);
        setSchedTime(r.data.time || '08:00');
        setDow(r.data.dow ?? 1);
        setDom(r.data.dom || 1);
      }
    }).catch(() => {});
  }, []);

  const saveSchedule = async () => {
    setSaving(true); setScheduleStatus('');
    try {
      const r = await api.put('/schedule', { freq, time: schedTime, dow: Number(dow), dom: Number(dom) });
      if (r.ok) {
        setCurrentSchedule({ freq, time: schedTime, dow: Number(dow), dom: Number(dom) });
        setScheduleStatus(freq === 'off'
          ? '✅ Automatic snapshots disabled.'
          : `✅ Scheduled: ${freq} at ${schedTime} UTC`);
        toast.success('Schedule saved.');
      } else {
        setScheduleStatus('❌ ' + (r.error || 'Failed to save schedule'));
      }
    } catch (e) { setScheduleStatus('❌ ' + e.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="card" style={{ marginBottom:18 }}>
      <div className="card-hdr" style={{ justifyContent:'space-between' }}>
        <span>⏰ Automatic Snapshot Schedule</span>
        {currentSchedule && currentSchedule.freq !== 'off' && (
          <span style={{ fontSize:11, color:'var(--muted)', fontWeight:400 }}>
            Active: {currentSchedule.freq} at {currentSchedule.time} UTC
            {currentSchedule.freq==='weekly'  && ` • ${SCHED_DAYS[currentSchedule.dow??1]}s`}
            {currentSchedule.freq==='monthly' && ` • ${currentSchedule.dom}th of month`}
          </span>
        )}
      </div>
      <div style={{ padding:16 }}>
        <div style={{ display:'flex', gap:10, alignItems:'flex-end', flexWrap:'wrap', marginBottom:12 }}>
          <label style={{ display:'block' }}>
            <div style={{ fontSize:10, fontWeight:700, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.4px', marginBottom:4 }}>Frequency</div>
            <select value={freq} onChange={e => setFreq(e.target.value)}
              style={{ padding:'5px 8px', fontSize:12, border:'1px solid var(--border)', borderRadius:4, background:'var(--surface)', color:'var(--text)' }}>
              <option value="off">Off (manual only)</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </label>
          {freq !== 'off' && (<>
            <label style={{ display:'block' }}>
              <div style={{ fontSize:10, fontWeight:700, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.4px', marginBottom:4 }}>Time (UTC)</div>
              <input type="time" value={schedTime} onChange={e => setSchedTime(e.target.value)}
                style={{ padding:'5px 8px', fontSize:12, border:'1px solid var(--border)', borderRadius:4, background:'var(--surface)', color:'var(--text)' }} />
            </label>
            {freq === 'weekly' && (
              <label style={{ display:'block' }}>
                <div style={{ fontSize:10, fontWeight:700, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.4px', marginBottom:4 }}>Day of Week</div>
                <select value={dow} onChange={e => setDow(Number(e.target.value))}
                  style={{ padding:'5px 8px', fontSize:12, border:'1px solid var(--border)', borderRadius:4, background:'var(--surface)', color:'var(--text)' }}>
                  {SCHED_DAYS.map((d,i) => <option key={d} value={i}>{d}</option>)}
                </select>
              </label>
            )}
            {freq === 'monthly' && (
              <label style={{ display:'block' }}>
                <div style={{ fontSize:10, fontWeight:700, color:'var(--muted)', textTransform:'uppercase', letterSpacing:'.4px', marginBottom:4 }}>Day of Month</div>
                <input type="number" min="1" max="28" value={dom} onChange={e => setDom(Number(e.target.value))}
                  style={{ padding:'5px 8px', fontSize:12, border:'1px solid var(--border)', borderRadius:4, background:'var(--surface)', color:'var(--text)', width:70 }} />
              </label>
            )}
          </>)}
          <button className="sbtn primary" style={{ fontSize:11, padding:'6px 14px' }} onClick={saveSchedule} disabled={saving}>
            {saving ? 'Saving…' : '💾 Save Schedule'}
          </button>
        </div>
        {scheduleStatus && (
          <div className={'notice '+(scheduleStatus.startsWith('✅') ? 'blue' : 'red')} style={{ marginBottom:10, fontSize:12 }}>
            {scheduleStatus}
          </div>
        )}
        <div style={{ fontSize:11, color:'var(--muted)' }}>
          Snapshots capture bookings, revenue and customer totals for all services. Configure frequency here; take manual snapshots in the Trends tab.
        </div>
      </div>
    </div>
  );
}

export function SnapshotSection() {
  const [snaps,   setSnaps]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [taking,  setTaking]  = useState(false);
  const [note,    setNote]    = useState('');
  const chartRef  = useRef(null);
  const chartInst = useRef(null);
  const toast     = useToast();

  const load = async () => {
    setLoading(true);
    try { const r = await api.get('/snapshots?limit=12'); setSnaps(r.data || []); } catch (_) {}
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!snaps || snaps.length < 2) return;
    let active = true;
    const labels   = snaps.map(s => s.snapDate ? String(s.snapDate).substring(0,10) : '');
    const hasRev   = snaps.some(s => (s.revenueEur || 0) > 0);
    const datasets = [
      { label:'Bookings',  data:snaps.map(s=>s.bookings||0),  borderColor:'#0070b1', backgroundColor:'#0070b118', tension:.4, yAxisID:'y', pointRadius:3 },
      { label:'Customers', data:snaps.map(s=>s.customers||0), borderColor:'#e9730c', backgroundColor:'#e9730c18', tension:.4, yAxisID:'y', pointRadius:3 },
    ];
    if (hasRev) {
      datasets.push({
        label: 'Revenue (€k)',
        data: snaps.map(s => Math.round((s.revenueEur || 0) / 1000)),
        borderColor: '#107e3e',
        backgroundColor: '#107e3e22',
        tension: 0.3,
        yAxisID: 'y2',
        pointRadius: 3,
      });
    }
    getChart().then(Chart => {
      if (!active || !chartRef.current) return;
      if (chartInst.current) { chartInst.current.destroy(); chartInst.current = null; }
      chartInst.current = new Chart(chartRef.current, {
        type: 'line',
        data: { labels, datasets },
        options: {
          responsive:true, maintainAspectRatio:false,
          plugins:{ legend:{position:'top',labels:{font:{size:11}}}, datalabels:{display:false} },
          scales:{
            x:{ grid:{display:false}, ticks:{font:{size:10}} },
            y:{ grid:{color:'#f0f0f0'}, ticks:{font:{size:10}} },
            ...(hasRev ? {
              y2: {
                position: 'right',
                display: true,
                grid: { drawOnChartArea: false },
                ticks: { callback: v => `€${v}k`, font: { size: 10 } },
              }
            } : {}),
          },
        }
      });
    });
    return () => {
      active = false;
      if (chartInst.current) { chartInst.current.destroy(); chartInst.current = null; }
    };
  }, [snaps]);

  const takeSnapshot = async () => {
    setTaking(true);
    try {
      const r = await api.post('/snapshots', { note });
      if (r.ok) { toast.success('Snapshot saved.'); setNote(''); load(); }
      else toast.error(r.error || 'Snapshot failed.');
    } catch (e) { toast.error(e.message); }
    finally { setTaking(false); }
  };

  if (loading) return <Loader />;

  return (
    <>
      <div className="card" style={{ marginBottom:18 }}>
        <div className="card-hdr" style={{ justifyContent:'space-between' }}>
          <span>📈 Portfolio Trend (Snapshots)</span>
          <div style={{ display:'flex', gap:6, alignItems:'center' }}>
            <input value={note} onChange={e => setNote(e.target.value)} placeholder="Note (optional)"
              style={{ fontSize:11, padding:'4px 8px', border:'1px solid var(--border)', borderRadius:4, width:160 }} />
            <button className="sbtn primary" style={{ fontSize:11, padding:'5px 12px' }} onClick={takeSnapshot} disabled={taking}>
              {taking ? 'Saving…' : '📸 Take Snapshot'}
            </button>
          </div>
        </div>
        <div style={{ padding:16 }}>
          {snaps.length < 2
            ? <div style={{ textAlign:'center', padding:'24px', color:'var(--muted)', fontSize:12, fontStyle:'italic' }}>
                Take at least 2 snapshots to see a trend. Use the "📸 Take Snapshot" button above.
              </div>
            : <div style={{ height:180 }}><canvas ref={chartRef} /></div>
          }
        </div>
      </div>

      {/* ── Revenue Forecast & What-If ──────────────────────────── */}
      {snaps.length >= 2 && (() => {
        const vals = snaps.map(s => s.bookings || 0).filter(v => v > 0);
        const revVals = snaps.map(s => s.revenueEur || 0);
        const hasRev = revVals.some(v => v > 0);
        if (!vals.length) return null;
        const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
        const last = vals[vals.length - 1];
        const delta = vals.length >= 2 ? (last - vals[0]) / (vals.length - 1) : 0;
        const proj3  = Math.max(0, Math.round(last + delta * 3));
        const proj6  = Math.max(0, Math.round(last + delta * 6));
        const trend  = delta > 0 ? '↑ Growing' : delta < 0 ? '↓ Declining' : '→ Flat';
        const tColor = delta > 0 ? '#107e3e' : delta < 0 ? '#bb0000' : '#6a6d73';
        const lastRev = revVals[revVals.length - 1] || 0;
        const revDelta = revVals.length >= 2 ? (lastRev - revVals[0]) / (revVals.length - 1) : 0;
        return (
          <div className="card" style={{ marginBottom:18 }}>
            <div className="card-hdr">📈 Revenue Forecast & What-If</div>
            <div style={{ padding:16 }}>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(140px, 1fr))', gap:12, marginBottom:16 }}>
                <div style={{ textAlign:'center', padding:'10px', background:'var(--surface)', borderRadius:'var(--r-sm)' }}>
                  <div style={{ fontSize:10, fontWeight:700, color:'var(--muted)', textTransform:'uppercase' }}>Trend</div>
                  <div style={{ fontSize:18, fontWeight:800, color:tColor }}>{trend}</div>
                  <div style={{ fontSize:10, color:'var(--muted)' }}>±{Math.abs(Math.round(delta))} bookings / period</div>
                </div>
                <div style={{ textAlign:'center', padding:'10px', background:'var(--surface)', borderRadius:'var(--r-sm)' }}>
                  <div style={{ fontSize:10, fontWeight:700, color:'var(--muted)', textTransform:'uppercase' }}>Proj. +3 Periods</div>
                  <div style={{ fontSize:18, fontWeight:800, color:'var(--heading)' }}>{proj3.toLocaleString()}</div>
                  <div style={{ fontSize:10, color:'var(--muted)' }}>Bookings (linear model)</div>
                </div>
                <div style={{ textAlign:'center', padding:'10px', background:'var(--surface)', borderRadius:'var(--r-sm)' }}>
                  <div style={{ fontSize:10, fontWeight:700, color:'var(--muted)', textTransform:'uppercase' }}>Proj. +6 Periods</div>
                  <div style={{ fontSize:18, fontWeight:800, color:'var(--heading)' }}>{proj6.toLocaleString()}</div>
                  <div style={{ fontSize:10, color:'var(--muted)' }}>Bookings (linear model)</div>
                </div>
                {hasRev && (
                  <div style={{ textAlign:'center', padding:'10px', background:'var(--surface)', borderRadius:'var(--r-sm)' }}>
                    <div style={{ fontSize:10, fontWeight:700, color:'var(--muted)', textTransform:'uppercase' }}>Rev. +6 Periods</div>
                    <div style={{ fontSize:18, fontWeight:800, color:'var(--heading)' }}>€{Math.max(0, Math.round(lastRev + revDelta * 6)).toLocaleString()}</div>
                    <div style={{ fontSize:10, color:'var(--muted)' }}>Revenue projection</div>
                  </div>
                )}
              </div>
              <WhatIfPanel />
            </div>
          </div>
        );
      })()}

      <ScheduleCard />
    </>
  );
}
export function EditableNum({ value, onChange, fmtFn, placeholder, width }) {
  const [editing, setEditing] = useState(false);
  const [local,   setLocal]   = useState('');
  const ref = useRef();

  useEffect(() => { if (editing && ref.current) ref.current.select(); }, [editing]);

  const start  = () => { setLocal(value != null ? String(value) : ''); setEditing(true); };
  const commit = () => { onChange(local); setEditing(false); };

  if (editing) return (
    <input ref={ref} type="number" value={local}
      onChange={e => setLocal(e.target.value)}
      onBlur={commit}
      onKeyDown={e => { if (e.key==='Enter') commit(); if (e.key==='Escape') setEditing(false); }}
      style={{ width: width||90, padding:'5px 10px', border:'2px solid var(--blue)', borderRadius:6,
               fontSize:13, fontWeight:700, textAlign:'center', background:'var(--bg)', color:'var(--text)',
               outline:'none', boxSizing:'border-box' }} />
  );

  return (
    <div onClick={start} title="Click to edit"
      style={{ display:'inline-flex', alignItems:'center', gap:3, padding:'5px 12px',
               borderRadius:6, border:'1.5px dashed var(--border)', cursor:'pointer',
               background:'var(--surface)', transition:'border-color .12s',
               minWidth: width||90, justifyContent:'center', userSelect:'none' }}
      onMouseEnter={e => e.currentTarget.style.borderColor='var(--blue)'}
      onMouseLeave={e => e.currentTarget.style.borderColor='var(--border)'}>
      <span style={{ fontSize:13, fontWeight:700, color:'var(--heading)' }}>
        {value != null && value !== 0
          ? fmtFn(value)
          : <em style={{ color:'var(--muted)', fontSize:11, fontWeight:400 }}>{placeholder||'—'}</em>}
      </span>
      <span style={{ fontSize:8, color:'var(--muted)', opacity:.5, lineHeight:1 }}>✎</span>
    </div>
  );
}

export function PlanSection() {
  const { journeyNames: JOURNEYS, JOURNEY_C } = useContext(JourneysCtx) || {};
  const [cfg,    setCfg]    = useState(null);
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  useEffect(() => {
    api.get('/config/kpi_config')
      .then(r => setCfg((r.ok && r.data) ? r.data : { targets:{}, forecast:{} }))
      .catch(() => setCfg({ targets:{}, forecast:{} }));
  }, []);

  const save = async () => {
    setSaving(true);
    const prevCfg = cfg;
    try {
      await api.put('/config/kpi_config', cfg);
      api.post('/audit', { sku:'plan', field:'kpi_config',
        oldValue: JSON.stringify(prevCfg), newValue: JSON.stringify(cfg) }).catch(() => {});
      toast.success('Plan saved.');
    }
    catch (e) { toast.error('Save failed: ' + e.message); }
    finally { setSaving(false); }
  };

  const setPort  = (k, v) => setCfg(c => ({ ...c, targets:  { ...c.targets,  portfolio: { ...(c.targets?.portfolio ||{}), [k]: Number(v)||0 } } }));
  const setFcPort= (k, v) => setCfg(c => ({ ...c, forecast: { ...c.forecast, portfolio: { ...(c.forecast?.portfolio||{}), [k]: Number(v)||0 } } }));
  const setJPlan = (j, v) => setCfg(c => ({ ...c, targets:  { ...c.targets,  byJourney: { ...(c.targets?.byJourney ||{}), [j]: { ...(c.targets?.byJourney?.[j]||{}),  revenueEur: Number(v)||0 } } } }));
  const setJFc   = (j, v) => setCfg(c => ({ ...c, forecast: { ...c.forecast, byJourney: { ...(c.forecast?.byJourney||{}), [j]: { ...(c.forecast?.byJourney?.[j]||{}), revenueEur: Number(v)||0 } } } }));

  if (!cfg) return <div style={{ padding:24, color:'var(--muted)', fontSize:13 }}>Loading plan…</div>;

  const fmtRev  = v => v >= 1e6 ? `€${(v/1e6).toFixed(1)}M` : v >= 1e3 ? `€${(v/1e3).toFixed(0)}k` : `€${v}`;
  const fmtCnt  = v => v.toLocaleString();

  const portAOP = cfg.targets?.portfolio  || {};
  const portFc  = cfg.forecast?.portfolio || {};
  const journeyPlanSum = JOURNEYS.reduce((s, j) => s + (cfg.targets?.byJourney?.[j]?.revenueEur || 0), 0);
  const journeyFcSum   = JOURNEYS.reduce((s, j) => s + (cfg.forecast?.byJourney?.[j]?.revenueEur || 0), 0);
  const planGap  = (portAOP.revenueEur || 0) - journeyPlanSum;
  const planOK   = portAOP.revenueEur > 0 ? Math.abs(planGap) < 100 : null;
  const fcGap    = (portFc.revenueEur  || 0) - journeyFcSum;
  const fcOK     = portFc.revenueEur  > 0 ? Math.abs(fcGap)  < 100 : null;
  const maxJourneyPlan = Math.max(...JOURNEYS.map(j => cfg.targets?.byJourney?.[j]?.revenueEur||0), 1);

  const METRICS = [
    { key:'bookings',   icon:'📦', label:'Bookings',   fmtFn:fmtCnt, w:90  },
    { key:'revenueEur', icon:'💰', label:'Revenue',    fmtFn:fmtRev, w:100 },
    { key:'customers',  icon:'👥', label:'Customers',  fmtFn:fmtCnt, w:90  },
  ];

  return (
    <div className="card" style={{ marginBottom:18 }}>
      <div className="card-hdr" style={{ justifyContent:'space-between' }}>
        <span>📋 Annual Operating Plan (AOP)</span>
        <span style={{ fontSize:10, color:'var(--muted)', fontWeight:400 }}>Click any value to edit</span>
      </div>
      <div style={{ padding:16 }}>

        {/* Period */}
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:20 }}>
          <span style={{ fontSize:11, fontWeight:700, color:'var(--muted)', textTransform:'uppercase', minWidth:44 }}>Period</span>
          <input value={cfg.period||''} onChange={e => setCfg(c => ({...c, period:e.target.value}))}
            placeholder="e.g. FY2026"
            style={{ width:140, padding:'5px 10px', border:'1.5px dashed var(--border)', borderRadius:6,
                     fontSize:12, fontWeight:700, background:'var(--surface)', color:'var(--text)' }} />
        </div>

        {/* Portfolio grid */}
        <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:10, padding:'14px 16px', marginBottom:20 }}>
          <div style={{ display:'grid', gridTemplateColumns:'140px 1fr 1fr 1fr', gap:10, marginBottom:4 }}>
            <div />
            {METRICS.map(m => (
              <div key={m.key} style={{ textAlign:'center', fontSize:10, fontWeight:700, color:'var(--muted)', textTransform:'uppercase', letterSpacing:.4 }}>
                {m.icon} {m.label}
              </div>
            ))}
          </div>
          {[
            { label:'Portfolio AOP',      hint:'the annual target',           key:'targets',  setter:setPort  },
            { label:'Portfolio Forecast', hint:'current best estimate',       key:'forecast', setter:setFcPort },
          ].map(row => (
            <div key={row.key} style={{ display:'grid', gridTemplateColumns:'140px 1fr 1fr 1fr', gap:10, alignItems:'center',
              borderTop:'1px solid var(--border)', paddingTop:10, marginTop:10 }}>
              <div>
                <div style={{ fontSize:12, fontWeight:700, color:'var(--heading)' }}>
                  {row.key==='targets' ? '🎯' : '📈'} {row.label}
                </div>
                <div style={{ fontSize:9, color:'var(--muted)' }}>{row.hint}</div>
              </div>
              {METRICS.map(m => (
                <div key={m.key} style={{ display:'flex', justifyContent:'center' }}>
                  <EditableNum
                    value={cfg[row.key]?.portfolio?.[m.key] || null}
                    onChange={v => row.setter(m.key, v)}
                    fmtFn={m.fmtFn}
                    placeholder="tap to set"
                    width={m.w}
                  />
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Journey revenue plan */}
        <div style={{ fontWeight:700, fontSize:12, color:'var(--heading)', marginBottom:4 }}>Revenue Plan by Journey</div>
        <div style={{ fontSize:10, color:'var(--muted)', marginBottom:12 }}>
          Journey plans should sum to the Portfolio AOP revenue. Forecast is your current best estimate per journey.
        </div>

        {JOURNEYS.map(j => {
          const jPlan = cfg.targets?.byJourney?.[j]?.revenueEur  || 0;
          const jFc   = cfg.forecast?.byJourney?.[j]?.revenueEur || 0;
          const barW  = maxJourneyPlan > 0 ? Math.round(jPlan / maxJourneyPlan * 100) : 0;
          const fcW   = maxJourneyPlan > 0 ? Math.round(jFc  / maxJourneyPlan * 100) : 0;
          return (
            <div key={j} style={{ display:'grid', gridTemplateColumns:'1fr auto auto', gap:12, alignItems:'center',
              padding:'10px 0', borderBottom:'1px solid var(--border)' }}>
              <div>
                <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:6 }}>
                  <span style={{ width:10, height:10, borderRadius:2, background:JOURNEY_C[j]||'var(--blue)', display:'inline-block', flexShrink:0 }} />
                  <span style={{ fontSize:12, fontWeight:600, color:'var(--heading)' }}>{j}</span>
                </div>
                {/* Dual bar */}
                <div style={{ position:'relative', height:6, background:'var(--border)', borderRadius:3, overflow:'visible' }}>
                  <div style={{ position:'absolute', left:0, top:0, height:'100%', width:`${barW}%`,
                    background:JOURNEY_C[j]||'var(--blue)', borderRadius:3, opacity:.3 }} />
                  {jFc > 0 && <div style={{ position:'absolute', left:0, top:0, height:'100%', width:`${fcW}%`,
                    background:JOURNEY_C[j]||'var(--blue)', borderRadius:3 }} />}
                </div>
                {jFc > 0 && jPlan > 0 && (
                  <div style={{ fontSize:9, color:'var(--muted)', marginTop:3 }}>
                    Forecast {Math.round(jFc/jPlan*100)}% of plan
                  </div>
                )}
              </div>
              <div style={{ textAlign:'right' }}>
                <div style={{ fontSize:9, color:'var(--muted)', textTransform:'uppercase', marginBottom:3 }}>AOP</div>
                <EditableNum value={jPlan||null} onChange={v=>setJPlan(j,v)} fmtFn={fmtRev} placeholder="set" width={90} />
              </div>
              <div style={{ textAlign:'right' }}>
                <div style={{ fontSize:9, color:'var(--muted)', textTransform:'uppercase', marginBottom:3 }}>Forecast</div>
                <EditableNum value={jFc||null} onChange={v=>setJFc(j,v)} fmtFn={fmtRev} placeholder="optional" width={90} />
              </div>
            </div>
          );
        })}

        {/* Σ total */}
        <div style={{ display:'flex', alignItems:'center', gap:10, paddingTop:10, marginTop:2 }}>
          <span style={{ fontSize:12, fontWeight:700, color:'var(--heading)', flex:1 }}>Σ Total AOP Revenue</span>
          <span style={{ fontSize:13, fontWeight:800,
            color: planOK===true ? '#107e3e' : planOK===false ? '#bb0000' : 'var(--text)' }}>
            €{journeyPlanSum.toLocaleString()}
          </span>
          {planOK===true  && <span style={{ fontSize:10, fontWeight:700, color:'#107e3e', background:'#e8f5e9', padding:'2px 8px', borderRadius:10 }}>✓ matches AOP</span>}
          {planOK===false && <span style={{ fontSize:10, fontWeight:700, color:'#bb0000', background:'#ffebee', padding:'2px 8px', borderRadius:10 }}>
            {planGap > 0 ? `⚠ €${planGap.toLocaleString()} under` : `⚠ €${Math.abs(planGap).toLocaleString()} over`}
          </span>}
        </div>
        {journeyFcSum > 0 && (
          <div style={{ display:'flex', alignItems:'center', gap:10, paddingTop:6, marginTop:4, borderTop:'1px dashed var(--border)' }}>
            <span style={{ fontSize:11, color:'var(--muted)', flex:1 }}>Σ Total Forecast Revenue</span>
            <span style={{ fontSize:12, fontWeight:700,
              color: fcOK===true ? '#107e3e' : fcOK===false ? '#e9730c' : 'var(--text)' }}>
              €{journeyFcSum.toLocaleString()}
            </span>
            {fcOK===true  && <span style={{ fontSize:10, fontWeight:600, color:'#107e3e', background:'#e8f5e9', padding:'2px 8px', borderRadius:10 }}>✓ matches forecast</span>}
            {fcOK===false && <span style={{ fontSize:10, fontWeight:600, color:'#e9730c', background:'#fff3e0', padding:'2px 8px', borderRadius:10 }}>
              {fcGap > 0 ? `⚠ €${fcGap.toLocaleString()} under` : `⚠ €${Math.abs(fcGap).toLocaleString()} over`}
            </span>}
          </div>
        )}

        <div style={{ marginTop:16 }}>
          <button className="sbtn primary" style={{ fontSize:11 }} onClick={save} disabled={saving}>
            {saving ? 'Saving…' : '💾 Save Plan'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Fallback used when /config/kpi_config has not been seeded yet.
// Hoisted to module level so it is a stable reference (not recreated on every render).
const DEFAULT_CFG = {
  period: 'FY2026',
  targets:  { portfolio:{ bookings:180, revenueEur:3600000, customers:80  },
              byJourney:{ 'New Implementation':{revenueEur:960000}, 'System Conversion':{revenueEur:1440000},
                          'Expansion & Tuning':{revenueEur:540000}, 'DMLT Cross Services':{revenueEur:540000},
                          'System Migration / PEX':{revenueEur:120000} } },
  forecast: { portfolio:{ bookings:155, revenueEur:3100000, customers:68 },
              byJourney:{ 'New Implementation':{revenueEur:810000}, 'System Conversion':{revenueEur:1220000},
                          'Expansion & Tuning':{revenueEur:455000}, 'DMLT Cross Services':{revenueEur:455000},
                          'System Migration / PEX':{revenueEur:160000} } },
};
function JourneyBarChart({ cfg, stats, journeyNames, JOURNEY_C }) {
  const chartRef  = useRef(null);
  const chartInst = useRef(null);

  useEffect(() => {
    if (!journeyNames || journeyNames.length === 0) return;
    let active = true;
    const shortLabels = journeyNames.map(j => j.split(' ')[0]);
    const datasets = [
      {
        label: 'Plan',
        data: journeyNames.map(j => cfg?.targets?.byJourney?.[j]?.revenueEur || 0),
        backgroundColor: '#c8c8c8',
        borderRadius: 4,
      },
      {
        label: 'Forecast',
        data: journeyNames.map(j => cfg?.forecast?.byJourney?.[j]?.revenueEur || 0),
        backgroundColor: '#4fa3e3',
        borderRadius: 4,
      },
      {
        label: 'Actuals',
        data: journeyNames.map(j => stats?.byJourneyRevenue?.[j] || 0),
        backgroundColor: journeyNames.map(j => JOURNEY_C?.[j] || '#6a6d73'),
        borderRadius: 4,
      },
    ];
    getChart().then(Chart => {
      if (!active || !chartRef.current) return;
      if (chartInst.current) { chartInst.current.destroy(); chartInst.current = null; }
      chartInst.current = new Chart(chartRef.current, {
        type: 'bar',
        data: { labels: shortLabels, datasets },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'top', labels: { boxWidth: 12, font: { size: 11 } } },
            datalabels: { display: false },
            tooltip: {
              callbacks: {
                label: ctx => ` ${ctx.dataset.label}: €${(ctx.raw || 0).toLocaleString()}`,
              },
            },
          },
          scales: {
            x: { grid: { display: false } },
            y: {
              ticks: {
                callback: v => v >= 1000000
                  ? `€${(v / 1000000).toFixed(1)}M`
                  : `€${(v / 1000).toFixed(0)}k`,
              },
            },
          },
        },
      });
    });
    return () => {
      active = false;
      if (chartInst.current) { chartInst.current.destroy(); chartInst.current = null; }
    };
  }, [cfg, stats, journeyNames, JOURNEY_C]);

  return (
    <div className="card" style={{ marginBottom: 18 }}>
      <div className="card-hdr">Revenue by Journey — Plan vs Forecast vs Actuals</div>
      <div style={{ padding: '10px 16px 14px' }}>
        <div style={{ height: 280 }}><canvas ref={chartRef} /></div>
      </div>
    </div>
  );
}

function LeaderboardChart({ ranked, metric, getVal, fmtVal }) {
  const chartRef  = useRef(null);
  const chartInst = useRef(null);

  useEffect(() => {
    if (!ranked || ranked.length === 0) return;
    let active = true;
    getChart().then(Chart => {
      if (!active || !chartRef.current) return;
      if (chartInst.current) { chartInst.current.destroy(); chartInst.current = null; }
      chartInst.current = new Chart(chartRef.current, {
        type: 'bar',
        data: {
          labels: ranked.map(s => s.name?.substring(0, 28) || s.sku),
          datasets: [{
            data: ranked.map(s => getVal(s)),
            backgroundColor: '#0070b1cc',
            borderRadius: 3,
            borderSkipped: false,
          }],
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            datalabels: { display: false },
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: ctx => ` ${fmtVal(ranked[ctx.dataIndex])}`,
              },
            },
          },
          scales: {
            x: {
              grid: { color: 'rgba(0,0,0,0.06)' },
              ticks: {
                callback: v => v >= 1000000
                  ? `€${(v / 1000000).toFixed(1)}M`
                  : `€${(v / 1000).toFixed(0)}k`,
              },
            },
            y: { grid: { display: false } },
          },
        },
      });
    });
    return () => {
      active = false;
      if (chartInst.current) { chartInst.current.destroy(); chartInst.current = null; }
    };
  }, [ranked, metric]);

  const containerHeight = Math.max(180, ranked.length * 36);
  return <div style={{ height: containerHeight }}><canvas ref={chartRef} /></div>;
}

export function AnalyticsOverview({ stats, services, onDrillDown, pdfModalTrigger }) {
  const { journeyNames, JOURNEY_C } = useContext(JourneysCtx) || {};
  const toast = useToast();
  const [cfg,         setCfg]         = useState(null);
  const [metric,      setMetric]      = useState('bookings');
  const [snaps,       setSnaps]       = useState([]);
  const [alertCfg,    setAlertCfg]    = useState(null);
  const [pdfLoading,  setPdfLoading]  = useState(false);
  const [pdfModal,    setPdfModal]    = useState(false);
  const [pdfTitle,    setPdfTitle]    = useState('');
  const [pdfSections, setPdfSections] = useState({ kpi:true, journeys:true, counts:true });
  const [pdfJourneyF, setPdfJourneyF] = useState(null);

  useEffect(() => {
    api.get('/snapshots?limit=2').then(r => setSnaps(r.data || [])).catch(() => {});
  }, []);

  useEffect(() => {
    api.get('/config/alert_thresholds')
      .then(r => setAlertCfg(r.ok && r.data ? r.data : {}))
      .catch(() => setAlertCfg({}));
  }, []);

  useEffect(() => {
    if (pdfModalTrigger > 0 && cfg) {
      setPdfTitle(cfg?.period ? `${cfg.period} Performance Summary` : 'Portfolio Performance Summary');
      setPdfJourneyF(f => f || (stats?.byJourney ? Object.fromEntries(Object.keys(stats.byJourney).map(k => [k, true])) : null));
      setPdfModal(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdfModalTrigger, cfg]);


  useEffect(() => {
    api.get('/config/kpi_config')
      .then(r => setCfg(r.ok && r.data ? r.data : DEFAULT_CFG))
      .catch(() => setCfg(DEFAULT_CFG));
  }, []);

  const pct          = (a, t) => t > 0 ? Math.min(200, Math.round(a / t * 100)) : null;
  const trafficColor = p => p == null ? 'var(--muted)' : p >= 80 ? '#107e3e' : p >= 50 ? '#e9730c' : '#bb0000';
  const trafficLabel = p => p == null ? '—' : p >= 80 ? 'On Track' : p >= 50 ? 'At Risk' : 'Behind';
  const trafficBg    = p => p == null ? 'transparent' : p >= 80 ? '#e8f5e9' : p >= 50 ? '#fff3e0' : '#ffebee';
  const ragColor     = p => p == null ? 'var(--muted)' : p >= 90 ? '#107e3e' : p >= 70 ? '#e9730c' : '#bb0000';

  const handlePdfExport = async (opts = {}) => {
    setPdfLoading(true);
    setPdfModal(false);
    try {
      const blob = await api.blob('/export/pdf', {
        stats,
        title: opts.title || `${cfg?.period || 'FY'} Performance Summary`,
        options: { sections: opts.sections, journeyFilter: opts.journeyFilter },
      });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url; a.download = 'PS-Portfolio-Summary.pdf'; a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      toast.error('PDF export failed: ' + e.message);
    } finally {
      setPdfLoading(false);
    }
  };

  const getVal = s => metric === 'revenue' ? (s.revenueEur||0) : metric === 'customers' ? (s.customers||0) : (s.bookings||0);
  const fmtVal = s => metric === 'revenue' ? `€${(s.revenueEur||0).toLocaleString()}` : (metric==='customers' ? s.customers||0 : s.bookings||0);
  const ranked = [...services].filter(s => getVal(s)>0).sort((a,b)=>getVal(b)-getVal(a)).slice(0,10);
  const maxVal = ranked.length > 0 ? Math.max(getVal(ranked[0]),1) : 1;

  if (!cfg) return (
    <div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:24 }}>
        {[1,2,3,4].map(i => (
          <div key={i} className="card" style={{ padding:'16px 18px', minHeight:130 }}>
            <div style={{ width:28, height:28, borderRadius:4, background:'var(--border)', marginBottom:10 }} />
            <div style={{ width:'60%', height:10, background:'var(--border)', borderRadius:4, marginBottom:8 }} />
            <div style={{ width:'80%', height:22, background:'var(--border)', borderRadius:4, marginBottom:6 }} />
            <div style={{ width:'40%', height:8,  background:'var(--border)', borderRadius:4 }} />
          </div>
        ))}
      </div>
      <div className="ch-row">
        <div className="card" style={{ flex:2, padding:20 }}>
          {[1,2,3,4,5].map(i => (
            <div key={i} style={{ marginBottom:16 }}>
              <div style={{ width:'50%', height:10, background:'var(--border)', borderRadius:4, marginBottom:6 }} />
              <div style={{ height:8, background:'var(--border)', borderRadius:4 }} />
            </div>
          ))}
        </div>
        <div className="card" style={{ flex:1, padding:20 }}>
          {[1,2,3,4,5].map(i => (
            <div key={i} style={{ height:28, background:'var(--border)', borderRadius:4, marginBottom:10 }} />
          ))}
        </div>
      </div>
    </div>
  );

  const aop  = cfg.targets?.portfolio  || {};
  const fc   = cfg.forecast?.portfolio || {};
  const actuals = { bookings:stats?.totalBookings||0, revenueEur:stats?.totalRevenue||0, customers:stats?.totalCustomers||0 };
  const avgDeal = actuals.bookings > 0 ? Math.round(actuals.revenueEur / actuals.bookings) : 0;

  const JOURNEYS_ORDERED = journeyNames || [];
  const journeyActuals   = stats?.byJourneyRevenue       || {};
  const journeyPlans     = cfg.targets?.byJourney        || {};
  const journeyForecasts = cfg.forecast?.byJourney       || {};
  const journeyPlanSum   = JOURNEYS_ORDERED.reduce((s,j)=>s+(journeyPlans[j]?.revenueEur||0),0);
  const planMatchGap     = aop.revenueEur > 0 ? aop.revenueEur - journeyPlanSum : null;

  const kpis = [
    { key:'bookings',   icon:'📦', label:'FY Bookings',      actual:actuals.bookings,   aop:aop.bookings,   fc:fc.bookings,   fmt:v=>v.toLocaleString(),      sub:'engagements signed'    },
    { key:'revenueEur', icon:'💰', label:'FY Revenue',       actual:actuals.revenueEur, aop:aop.revenueEur, fc:fc.revenueEur, fmt:v=>`€${v.toLocaleString()}`, sub:'revenue delivered'     },
    { key:'customers',  icon:'👥', label:'Customers Served', actual:actuals.customers,  aop:aop.customers,  fc:fc.customers,  fmt:v=>v.toLocaleString(),      sub:'unique customers'      },
    { key:'avgDeal',    icon:'📈', label:'Avg Deal Size',    actual:avgDeal,            aop:null,           fc:null,          fmt:v=>`€${v.toLocaleString()}`, sub:'revenue per booking'   },
  ];

  return (
    <div>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
        <div>
          <span style={{ fontWeight:700, fontSize:15, color:'var(--heading)' }}>{cfg.period} Performance</span>
          <span style={{ marginLeft:10, fontSize:11, color:'var(--muted)' }}>
            Edit plan in Manage → AOP · Actuals update when services data changes
          </span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
          {stats?.lastRefresh && (
            <span style={{ fontSize:10, color:'var(--muted)', background:'var(--surface)', padding:'3px 10px', borderRadius:10, border:'1px solid var(--border)', whiteSpace:'nowrap' }}>
              🕐 As of {new Date(stats.lastRefresh).toLocaleString()}
            </span>
          )}
          <button onClick={() => {
              setPdfTitle(cfg?.period ? `${cfg.period} Performance Summary` : 'Portfolio Performance Summary');
              if (!pdfJourneyF) {
                const jkeys = Object.keys(stats?.byJourney || {});
                if (jkeys.length) setPdfJourneyF(Object.fromEntries(jkeys.map(k => [k, true])));
              }
              setPdfModal(true);
            }} disabled={pdfLoading} style={{
            fontSize:11, padding:'4px 10px', borderRadius:6, border:'1px solid var(--border)',
            background:'var(--surface)', color:'var(--text)', cursor: pdfLoading ? 'wait' : 'pointer',
            display:'flex', alignItems:'center', gap:5, whiteSpace:'nowrap',
          }}>
            {pdfLoading ? '⏳ Generating…' : '📄 Export PDF'}
          </button>
        </div>
      </div>

      {/* Stale data banner */}
      {stats?.lastRefresh && (Date.now() - new Date(stats.lastRefresh).getTime() > 86400000) && (
        <div className="notice amber" style={{ marginBottom:14 }}>
          ⚠ Data may be outdated — last refreshed {new Date(stats.lastRefresh).toLocaleString()}. Trigger a refresh in <strong>Settings → Refresh Now</strong>.
        </div>
      )}

      {/* ── KPI tiles ─────────────────────────────────────────────────── */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:24 }}>
        {kpis.map(k => {
          const p       = pct(k.actual, k.aop);
          const fcPct   = pct(k.fc, k.aop);
          const latestSnap = snaps[0];
          const snapVal    = latestSnap ? latestSnap[k.key] : null;
          const delta      = snapVal != null && snapVal > 0 ? k.actual - snapVal : null;
          const deltaPct   = delta != null ? delta / snapVal * 100 : null;
          return (
            <div key={k.key} className="card" style={{ padding:'16px 18px' }}>
              <div style={{ fontSize:18, marginBottom:6 }}>{k.icon}</div>
              <div style={{ fontSize:10, fontWeight:700, color:'var(--muted)', textTransform:'uppercase', letterSpacing:.3, marginBottom:10 }}>{k.label}</div>

              {/* 3-number block */}
              <div style={{ display:'grid', gridTemplateColumns:'68px 1fr', rowGap:4, marginBottom:10, fontSize:11 }}>
                {k.aop ? (
                  <>
                    <span style={{ color:'var(--muted)' }}>Plan</span>
                    <span style={{ fontWeight:600, color:'var(--text)' }}>{k.fmt(k.aop)}</span>
                    {k.fc > 0 && <>
                      <span style={{ color:'var(--muted)' }}>Forecast</span>
                      <span style={{ color:'var(--text)' }}>
                        {k.fmt(k.fc)}
                        {fcPct != null && <em style={{ color:'var(--muted)', fontSize:9, marginLeft:4 }}>({fcPct}% of plan)</em>}
                      </span>
                    </>}
                    <span style={{ color:'var(--muted)', paddingTop:4, borderTop:'1px solid var(--border)' }}>Actuals</span>
                    <span style={{ fontSize:18, fontWeight:800, color:trafficColor(p), letterSpacing:'-.5px', paddingTop:4, borderTop:'1px solid var(--border)' }}>
                      {k.fmt(k.actual)}
                    </span>
                  </>
                ) : (
                  <>
                    <span style={{ color:'var(--muted)' }}>Actuals</span>
                    <span style={{ fontSize:18, fontWeight:800, color:'var(--heading)', letterSpacing:'-.5px' }}>{k.fmt(k.actual)}</span>
                  </>
                )}
              </div>

              {/* Attainment bar + badge */}
              {k.aop ? (
                <>
                  <div style={{ background:'var(--border)', borderRadius:4, height:5, marginBottom:7 }}>
                    <div style={{ background:trafficColor(p), height:5, borderRadius:4, width:`${Math.min(100,p||0)}%`, transition:'width 0.5s ease' }} />
                  </div>
                  <span style={{ fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:10, background:trafficBg(p), color:trafficColor(p) }}>
                    {p}% attainment · {trafficLabel(p)}
                  </span>
                </>
              ) : (
                <div style={{ fontSize:9, color:'var(--muted)', fontStyle:'italic' }}>
                  {k.aop === null ? 'derived metric — no target' : 'Set targets in Manage Plan to track attainment →'}
                </div>
              )}
              <div style={{ fontSize:9, color:'var(--muted)', marginTop:6 }}>{k.sub}</div>
              {deltaPct != null && (
                <div style={{ fontSize:10, marginTop:5, display:'flex', alignItems:'center', gap:4 }}>
                  <span style={{ fontWeight:700, color: delta > 0 ? '#107e3e' : delta < 0 ? '#bb0000' : 'var(--muted)' }}>
                    {delta > 0 ? '▲' : delta < 0 ? '▼' : '◆'} {Math.abs(deltaPct).toFixed(1)}%
                  </span>
                  <span style={{ color:'var(--muted)' }}>vs snapshot</span>
                </div>
              )}
              {deltaPct == null && k.aop > 0 && (
                <div style={{ fontSize:9, color:'var(--muted)', fontStyle:'italic', marginTop:5 }}>
                  Take a snapshot to see trends over time
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Empty-state notice */}
      {actuals.revenueEur === 0 && actuals.bookings === 0 && actuals.customers === 0 && (
        <div className="notice blue" style={{ marginBottom:20 }}>
          📊 No actuals recorded yet — add performance data in <strong>Catalog → Edit Service</strong>.
        </div>
      )}

      {/* Alert banner — shown when actuals fall below configured thresholds */}
      {alertCfg && (() => {
        const alerts = [];
        if (alertCfg.bookings_min_pct && aop.bookings > 0 && pct(actuals.bookings, aop.bookings) < alertCfg.bookings_min_pct)
          alerts.push(`Bookings at ${pct(actuals.bookings, aop.bookings)}% of AOP (threshold: ${alertCfg.bookings_min_pct}%)`);
        if (alertCfg.revenue_min_pct && aop.revenueEur > 0 && pct(actuals.revenueEur, aop.revenueEur) < alertCfg.revenue_min_pct)
          alerts.push(`Revenue at ${pct(actuals.revenueEur, aop.revenueEur)}% of AOP (threshold: ${alertCfg.revenue_min_pct}%)`);
        if (alertCfg.customers_min_pct && aop.customers > 0 && pct(actuals.customers, aop.customers) < alertCfg.customers_min_pct)
          alerts.push(`Customers at ${pct(actuals.customers, aop.customers)}% of AOP (threshold: ${alertCfg.customers_min_pct}%)`);
        if (!alerts.length) return null;
        return (
          <div className="notice red" style={{ marginBottom:16 }}>
            <strong>⚠ Performance Alerts</strong>
            <ul style={{ margin:'4px 0 0', paddingLeft:18, fontSize:11 }}>
              {alerts.map((a,i) => <li key={i}>{a}</li>)}
            </ul>
          </div>
        );
      })()}

      {/* ── Journey bar chart ─────────────────────────────────────────── */}
      <JourneyBarChart cfg={cfg} stats={stats} journeyNames={journeyNames || []} JOURNEY_C={JOURNEY_C || {}} />

      {/* ── Leaderboard ──────────────────────────────────────────────── */}
      <div className="ch-row" style={{ alignItems:'stretch', marginBottom:0 }}>

        {/* Service Leaderboard */}
        <div className="card" style={{ flex:1 }}>
          <div className="card-hdr" style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8 }}>
            <span>Leaderboard</span>
            <div style={{ display:'flex', gap:3 }}>
              {[['bookings','Bkgs'],['revenue','Rev'],['customers','Cust']].map(([m,l]) => (
                <button key={m} onClick={() => setMetric(m)} style={{
                  fontSize:10, padding:'2px 7px', borderRadius:4, border:'1px solid var(--border)', cursor:'pointer',
                  background: metric===m ? 'var(--blue)' : 'transparent',
                  color: metric===m ? '#fff' : 'var(--text)', fontWeight: metric===m ? 700 : 400,
                }}>{l}</button>
              ))}
            </div>
          </div>
          <div style={{ padding:'4px 16px 14px' }}>
            {ranked.length === 0 ? (
              <div style={{ color:'var(--muted)', fontSize:12, fontStyle:'italic', padding:'20px 0', textAlign:'center' }}>
                No {metric} data yet.
              </div>
            ) : (
              <LeaderboardChart ranked={ranked} metric={metric} getVal={getVal} fmtVal={fmtVal} />
            )}
          </div>
        </div>
      </div>

      {/* ── PDF Export Modal ─────────────────────────────────────────────── */}
      {pdfModal && (
        <div className="modal-backdrop" onClick={() => setPdfModal(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth:440, padding:24 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:18 }}>
              <span style={{ fontWeight:700, fontSize:14, color:'var(--heading)' }}>📄 Export PDF</span>
              <button onClick={() => setPdfModal(false)} style={{ background:'none', border:'none', cursor:'pointer', fontSize:18, color:'var(--muted)', lineHeight:1 }}>✕</button>
            </div>

            {/* Title */}
            <label style={{ display:'block', marginBottom:14 }}>
              <div style={{ fontSize:11, fontWeight:600, color:'var(--muted)', marginBottom:5 }}>Report Title</div>
              <input
                value={pdfTitle}
                onChange={e => setPdfTitle(e.target.value)}
                style={{ width:'100%', padding:'6px 10px', borderRadius:6, border:'1px solid var(--border)', background:'var(--surface)', color:'var(--text)', fontSize:12, boxSizing:'border-box' }}
              />
            </label>

            {/* Section toggles */}
            <div style={{ marginBottom:14 }}>
              <div style={{ fontSize:11, fontWeight:600, color:'var(--muted)', marginBottom:6 }}>Sections</div>
              {[
                { key:'kpi',      label:'KPI Summary — Bookings, Revenue, Customers vs. AOP' },
                { key:'journeys', label:'Journey Breakdown — Revenue by journey' },
                { key:'counts',   label:'Portfolio Counts — total / active / retiring / upcoming' },
              ].map(({ key, label }) => (
                <label key={key} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:7, cursor:'pointer', fontSize:12 }}>
                  <input
                    type="checkbox"
                    checked={!!pdfSections[key]}
                    onChange={e => setPdfSections(s => ({ ...s, [key]: e.target.checked }))}
                  />
                  {label}
                </label>
              ))}
            </div>

            {/* Journey filter — only shown when Journey section is on */}
            {pdfSections.journeys && pdfJourneyF && Object.keys(pdfJourneyF).length > 0 && (
              <div style={{ marginBottom:18, paddingTop:10, borderTop:'1px solid var(--border)' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                  <span style={{ fontSize:11, fontWeight:600, color:'var(--muted)' }}>Journeys to include</span>
                  <span style={{ display:'flex', gap:10 }}>
                    <button onClick={() => setPdfJourneyF(f => Object.fromEntries(Object.keys(f).map(k => [k, true])))}
                      style={{ fontSize:10, background:'none', border:'none', cursor:'pointer', color:'var(--blue)', padding:0 }}>All</button>
                    <button onClick={() => setPdfJourneyF(f => Object.fromEntries(Object.keys(f).map(k => [k, false])))}
                      style={{ fontSize:10, background:'none', border:'none', cursor:'pointer', color:'var(--muted)', padding:0 }}>None</button>
                  </span>
                </div>
                {Object.keys(pdfJourneyF).map(j => (
                  <label key={j} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:5, cursor:'pointer', fontSize:12 }}>
                    <input
                      type="checkbox"
                      checked={!!pdfJourneyF[j]}
                      onChange={e => setPdfJourneyF(f => ({ ...f, [j]: e.target.checked }))}
                    />
                    {j}
                  </label>
                ))}
              </div>
            )}

            {/* Actions */}
            <div style={{ display:'flex', justifyContent:'flex-end', gap:8, paddingTop:4 }}>
              <button onClick={() => setPdfModal(false)}
                style={{ padding:'6px 14px', borderRadius:6, border:'1px solid var(--border)', background:'none', color:'var(--text)', cursor:'pointer', fontSize:12 }}>
                Cancel
              </button>
              <button
                onClick={() => handlePdfExport({
                  title: pdfTitle,
                  sections: pdfSections,
                  journeyFilter: pdfJourneyF ? Object.keys(pdfJourneyF).filter(k => pdfJourneyF[k]) : null,
                })}
                style={{ padding:'6px 16px', borderRadius:6, border:'none', background:'#0070b1', color:'white', cursor:'pointer', fontSize:12, fontWeight:600 }}
              >
                Generate PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}




export function AuditLog() {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    api.get('/audit?limit=50').then(r => setEntries(r.data || [])).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const fmtVal = v => {
    if (!v) return <em style={{ color:'var(--muted)' }}>—</em>;
    try {
      const obj = JSON.parse(v);
      if (obj && typeof obj === 'object') {
        const p = obj.targets?.portfolio || {};
        const fc = obj.forecast?.portfolio || {};
        return (
          <span style={{ fontSize:10 }}>
            {obj.period && <><strong>{obj.period}</strong> · </>}
            AOP: {p.revenueEur ? `€${(p.revenueEur/1e6).toFixed(1)}M / ${p.bookings||0} bkgs / ${p.customers||0} cust` : '—'}
            {fc.revenueEur ? ` · Fcst: €${(fc.revenueEur/1e6).toFixed(1)}M` : ''}
          </span>
        );
      }
    } catch (_) {}
    return <span style={{ fontSize:10 }}>{String(v).slice(0, 60)}{v.length > 60 ? '…' : ''}</span>;
  };

  return (
    <div className="card" style={{ marginBottom:18 }}>
      <div className="card-hdr" style={{ justifyContent:'space-between' }}>
        <span>📜 Plan Change Audit Trail</span>
        <button onClick={load} style={{ fontSize:11, padding:'3px 10px', border:'1px solid var(--border)', borderRadius:4, cursor:'pointer', background:'var(--surface)', color:'var(--text)' }}>
          ↻ Refresh
        </button>
      </div>
      <div style={{ padding:'0 16px 16px' }}>
        {loading ? (
          <div style={{ padding:20, color:'var(--muted)', fontSize:12, textAlign:'center' }}>Loading…</div>
        ) : entries.length === 0 ? (
          <div style={{ padding:20, color:'var(--muted)', fontSize:12, textAlign:'center', fontStyle:'italic' }}>
            No audit entries yet — save a plan to start logging changes.
          </div>
        ) : (
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:11 }}>
            <thead>
              <tr style={{ borderBottom:'2px solid var(--border)' }}>
                {['When','Changed by','Field','Before','After'].map(h => (
                  <th key={h} style={{ padding:'8px 6px', textAlign:'left', fontWeight:700, color:'var(--muted)', fontSize:10, textTransform:'uppercase', letterSpacing:.3 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {entries.map((e, i) => (
                <tr key={e.id || i} style={{ borderBottom:'1px solid var(--border)', background: i%2===0 ? 'transparent' : 'var(--surface)' }}>
                  <td style={{ padding:'7px 6px', whiteSpace:'nowrap', color:'var(--muted)' }}>
                    {e.changedAt ? new Date(e.changedAt).toLocaleString() : '—'}
                  </td>
                  <td style={{ padding:'7px 6px', color:'var(--heading)', fontWeight:600 }}>{e.changedBy || 'ui'}</td>
                  <td style={{ padding:'7px 6px' }}><code style={{ fontSize:10 }}>{e.field}</code></td>
                  <td style={{ padding:'7px 6px', maxWidth:240 }}>{fmtVal(e.oldValue)}</td>
                  <td style={{ padding:'7px 6px', maxWidth:240 }}>{fmtVal(e.newValue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export function PerformanceTab({ stats, onSelect, onDrillDown, pdfModalTrigger }) {
  const [services, setServices] = useState([]);
  const [err,      setErr]      = useState('');
  const [view,     setView]     = useState('overview');

  const reload = () => api.get('/services').then(r => setServices(r.data || [])).catch(e => setErr(e.message));
  useEffect(() => { reload(); }, []);
  useEffect(() => { if (pdfModalTrigger > 0) setView('overview'); }, [pdfModalTrigger]);

  if (err) return <ErrState message={err} />;

  return (
    <div>
      {/* Sub-tab toggle */}
      <div className="view-toggle" style={{ marginBottom:20 }}>
        {[['overview','Overview'],['trends','Trends'],['manage','Manage'],['audit','Audit']].map(([id, label]) => (
          <button key={id} className={`view-tab-btn${view===id?' active':''}`} onClick={() => setView(id)}>{label}</button>
        ))}
      </div>

      {/* ── Overview ─────────────────────────────────────── */}
      {view === 'overview' && <AnalyticsOverview stats={stats} services={services} onDrillDown={onDrillDown} pdfModalTrigger={pdfModalTrigger} />}

      {/* ── Trends ───────────────────────────────────────── */}
      {view === 'trends' && <SnapshotSection />}

      {/* ── Manage ───────────────────────────────────────── */}
      {view === 'manage' && (
        <div>
          <ScheduleCard />
          <PlanSection />
        </div>
      )}

      {/* ── Audit ────────────────────────────────────────── */}
      {view === 'audit' && <AuditLog />}
    </div>
  );
}

