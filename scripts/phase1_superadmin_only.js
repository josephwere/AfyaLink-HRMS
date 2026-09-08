(async ()=>{
  try{
    const apiBase = 'http://127.0.0.1:5000';
    const fetch = global.fetch || (await import('node-fetch')).default;
    const fs = await import('fs/promises');
    const outFile = '/tmp/afya_phase1_accounts.json';

    const doFetch = async (path, opts={}) => {
      const res = await fetch(`${apiBase}${path}`, opts).catch(e=>({ error: String(e) }));
      if (res && res.error) return res;
      const text = await res.text().catch(()=>null);
      let body = null;
      try{ body = text ? JSON.parse(text) : null }catch(e){ body = text }
      return { status: res.status, body };
    };

    console.log('Login as super@afya.demo');
    const login = await doFetch('/api/auth/login', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ identifier:'super@afya.demo', password:'AfyaDemo@2026!' }) });
    console.log('login result', login.status);
    if (!login || login.status !== 200 || !login.body || !login.body.accessToken) {
      console.error('Login failed', login); process.exit(2);
    }
    const token = login.body.accessToken;

    console.log('Listing hospitals via super-admin endpoint');
    const hospitals = await doFetch('/api/super-admin/hospitals?limit=50', { method:'GET', headers:{ Authorization:`Bearer ${token}` } });
    console.log('hospitals status', hospitals.status);
    let hospital = null;
    if (hospitals && hospitals.body && Array.isArray(hospitals.body.items)) {
      hospital = hospitals.body.items.find(h=> (h.name||'').toLowerCase().includes('afyalink') || (h.name||'').toLowerCase().includes('demo')) || hospitals.body.items[0];
    }
    if (!hospital) {
      console.log('Fallback: listing /api/hospitals');
      const h2 = await doFetch('/api/hospitals?limit=50', { method:'GET', headers:{ Authorization:`Bearer ${token}` } });
      if (h2 && h2.body && Array.isArray(h2.items)) hospital = h2.items.find(h=> (h.name||'').toLowerCase().includes('afyalink') || (h.name||'').toLowerCase().includes('demo')) || h2.items[0];
    }

    if (!hospital) { console.error('No hospital found to register admin under'); process.exit(3); }
    const hospitalId = hospital._id || hospital.id;
    console.log('Selected hospital:', hospitalId, hospital.name);

    console.log('Registering Hospital Admin via /api/super-admin/register-hospital-admin');
    const adminEmail = 'hospital.admin+auto@afyalink.demo';
    const adminBody = { name:'Hospital Admin Auto', email: adminEmail, password:'AfyaDemo@2026!', hospitalId };
    const reg = await doFetch('/api/super-admin/register-hospital-admin', { method:'POST', headers:{ Authorization:`Bearer ${token}`, 'Content-Type':'application/json' }, body: JSON.stringify(adminBody) });
    console.log('register status', reg.status);
    console.log(JSON.stringify(reg.body, null, 2));

    if (!reg || reg.status < 200 || reg.status >= 300) { console.error('Failed to register hospital admin'); process.exit(4); }

    const result = { superAdmin: { email:'super@afya.demo' }, hospital: { id:hospitalId, name: hospital.name }, hospitalAdmin: { email: adminEmail, password: 'AfyaDemo@2026!' } };
    await fs.writeFile(outFile, JSON.stringify(result, null,2), 'utf8');
    console.log('Saved created accounts to', outFile);
    process.exit(0);
  }catch(e){ console.error('Error', e); process.exit(1); }
})();