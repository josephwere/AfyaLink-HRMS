(async ()=>{
  try{
    const apiBase = 'http://127.0.0.1:5000';
    const fetch = global.fetch || (await import('node-fetch')).default;

    const doFetch = async (path, opts={}) => {
      const r = await fetch(`${apiBase}${path}`, opts);
      const text = await r.text();
      let body = null;
      try{ body = text ? JSON.parse(text) : null }catch(e){ body = text }
      return { status: r.status, body };
    };

    console.log('login...');
    const login = await doFetch('/api/auth/login', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ identifier: 'super@afya.demo', password: 'AfyaDemo@2026!' }) });
    console.log('login:', JSON.stringify(login, null, 2));
    if (login.status !== 200 || !login.body || !login.body.accessToken) return process.exit(1);
    const token = login.body.accessToken;

    console.log('list hospitals...');
    const h = await doFetch('/api/super-admin/hospitals?limit=50', { method:'GET', headers:{ Authorization: `Bearer ${token}` } });
    console.log('hospitals:', JSON.stringify(h, null, 2));
    let hospital = null;
    if (h && h.body && Array.isArray(h.body.items)) hospital = h.body.items.find(x=> (x.name||'').toLowerCase().includes('afya'));
    if (!hospital) {
      const h2 = await doFetch('/api/hospitals?limit=50', { method:'GET', headers:{ Authorization: `Bearer ${token}` } });
      console.log('hospitals_fallback:', JSON.stringify(h2, null, 2));
      if (h2 && h2.items && Array.isArray(h2.items)) hospital = h2.items.find(x=> (x.name||'').toLowerCase().includes('afya'));
    }

    if (!hospital) { console.error('No hospital found'); return process.exit(1); }
    const hospitalId = hospital._id || hospital.id;
    console.log('selected hospital', hospitalId, hospital.name);

    console.log('create branch...');
    const branch = await doFetch('/api/branches', { method:'POST', headers:{ Authorization:`Bearer ${token}`, 'Content-Type':'application/json' }, body: JSON.stringify({ hospitalId, name:'AfyaLink Demo - West Wing', location:'Demo Wing' }) });
    console.log('branch:', JSON.stringify(branch, null,2));

    console.log('register hospital admin...');
    const admin = await doFetch('/api/super-admin/register-hospital-admin', { method:'POST', headers:{ Authorization:`Bearer ${token}`, 'Content-Type':'application/json' }, body: JSON.stringify({ name:'Hospital Admin Auto', email:'hospital.admin+auto@afyalink.demo', password:'AfyaDemo@2026!', hospitalId }) });
    console.log('admin:', JSON.stringify(admin, null,2));

    const staffRoles = [ { name:'Demo CFO', email:'cfo+auto@afyalink.demo', role:'CFO' }, { name:'Demo Finance Manager', email:'finance.manager+auto@afyalink.demo', role:'FINANCE_MANAGER' }, { name:'Demo Accountant', email:'accountant+auto@afyalink.demo', role:'ACCOUNTANT' } ];
    for (const r of staffRoles) {
      console.log('create staff', r.email);
      const res = await doFetch('/api/hospital-admin/register-staff', { method:'POST', headers:{ Authorization:`Bearer ${token}`, 'Content-Type':'application/json' }, body: JSON.stringify({ name:r.name, email:r.email, password:'AfyaDemo@2026!', role: r.role, hospitalId }) });
      console.log('staff result', JSON.stringify(res, null,2));
    }

    console.log('done');
  }catch(e){ console.error('error', e); process.exit(1); }
})();