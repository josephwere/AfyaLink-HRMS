useEffect(() => {
  apiFetch("/api/kpis/hospital")
    .then(r => r.json())
    .then(setKpis);
}, []);

<div className="card">
  <h3>Hospital KPIs</h3>
  <p>Total Encounters: {kpis.totalEncounters}</p>
  <p>Completion Rate: {kpis.completionRate.toFixed(1)}%</p>
  <p>Revenue: KES {kpis.revenue}</p>
</div>
