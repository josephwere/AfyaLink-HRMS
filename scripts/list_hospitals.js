(async ()=>{
  try{
    const apiBase = 'http://127.0.0.1:5000';
    const fetch = global.fetch || (await import('node-fetch')).default;
    const r = await fetch(`${apiBase}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ identifier: 'super@afya.demo', password: 'AfyaDemo@2026!' }) });
    const b = await r.json();
    if (!b.accessToken) return console.error('login failed', b);
    const t = b.accessToken;
    const h = await fetch(`${apiBase}/api/super-admin/hospitals?limit=100`, { headers: { Authorization: `Bearer ${t}` } });
    const hb = await h.json();
    if (!hb || !Array.isArray(hb.items)) return console.error('no hospitals', hb);
    hb.items.forEach(x=> console.log(`${x.name || ''} || ${ (x.verification && x.verification.status) || 'UNVERIFIED'} || ${x._id || x.id}`));
  }catch(e){ console.error(e); process.exit(1); }
})();