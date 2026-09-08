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
    if (!login || login.status !== 200 || !login.body || !login.body.accessToken) { console.error('Login failed', login); process.exit(2); }
    const token = login.body.accessToken;

    console.log('Listing hospitals');
    const hospitals = await doFetch('/api/super-admin/hospitals?limit=50', { method:'GET', headers:{ Authorization:`Bearer ${token}` } });
    if (!hospitals || !hospitals.body || !Array.isArray(hospitals.body.items) || hospitals.body.items.length===0) { console.error('No hospitals found', hospitals); process.exit(3); }
    let hospital = hospitals.body.items.find(h=> (h.name||'').toLowerCase().includes('afyalink') || (h.name||'').toLowerCase().includes('demo')) || hospitals.body.items[0];
    const hospitalId = hospital._id || hospital.id;
    console.log('Selected hospital:', hospitalId, hospital.name, 'verification:', (hospital.verification && hospital.verification.status) || 'UNVERIFIED');

    if (!hospital.verification || hospital.verification.status !== 'VERIFIED') {
      console.log('Approving hospital verification via system-admin review endpoint');
      const review = await doFetch(`/api/system-admin/hospital-verification/${hospitalId}/review`, { method:'PATCH', headers:{ Authorization:`Bearer ${token}`, 'Content-Type':'application/json' }, body: JSON.stringify({ decision: 'APPROVE', reviewNotes: 'Auto-approved for local verification during testing.' }) });
      console.log('review status', review.status);
      if (!review || review.status <200 || review.status>=300) { console.error('Failed to approve hospital', review); process.exit(4); }
      hospital = review.body && review.body.hospital ? review.body.hospital : (review.body && review.body.hospital ? review.body.hospital : hospital);
      console.log('Hospital approved:', (hospital.verification && hospital.verification.status) || 'UNKNOWN');
    } else {
      console.log('Hospital already verified');
    }

    console.log('Registering Hospital Admin');
    const adminEmail = 'hospital.admin+auto@afyalink.demo';
    const adminBody = { name:'Hospital Admin Auto', email: adminEmail, password:'AfyaDemo@2026!', hospitalId };
    const reg = await doFetch('/api/super-admin/register-hospital-admin', { method:'POST', headers:{ Authorization:`Bearer ${token}`, 'Content-Type':'application/json' }, body: JSON.stringify(adminBody) });
    console.log('register status', reg.status);
    console.log(JSON.stringify(reg.body, null, 2));
    if (!reg || reg.status<200 || reg.status>=300) { console.error('Failed to register hospital admin', reg); process.exit(5); }

    const result = { superAdmin: { email:'super@afya.demo' }, hospital: { id:hospitalId, name: hospital.name }, hospitalAdmin: { email: adminEmail, password: 'AfyaDemo@2026!' } };
    await fs.writeFile(outFile, JSON.stringify(result, null,2), 'utf8');
    console.log('Saved created accounts to', outFile);
    process.exit(0);
  }catch(e){ console.error('Error', e); process.exit(1); }
})();