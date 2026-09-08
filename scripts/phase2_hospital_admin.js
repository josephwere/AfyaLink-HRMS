(async ()=>{
  try{
    const apiBase = 'http://127.0.0.1:5000';
    const fetch = global.fetch || (await import('node-fetch')).default;
    const fs = await import('fs/promises');
    const outFile = '/tmp/afya_phase2_accounts.json';

    const doFetch = async (path, opts={}) => {
      const res = await fetch(`${apiBase}${path}`, opts).catch(e=>({ error: String(e) }));
      if (res && res.error) return res;
      const text = await res.text().catch(()=>null);
      let body = null;
      try{ body = text ? JSON.parse(text) : null }catch(e){ body = text }
      return { status: res.status, body };
    };

    console.log('Login as Hospital Admin');
    const login = await doFetch('/api/auth/login', { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ identifier:'hospital.admin+auto@afyalink.demo', password:'AfyaDemo@2026!' }) });
    if (!login || login.status !== 200 || !login.body || !login.body.accessToken) { console.error('Login failed', login); process.exit(2); }
    const token = login.body.accessToken;
    const hospitalId = login.body.user && (login.body.user.hospital || login.body.user.hospitalId);
    console.log('hospital id from login', hospitalId || 'none');

    const result = { hospitalAdmin: { email:'hospital.admin+auto@afyalink.demo', password:'AfyaDemo@2026!' }, hospitalId };

    console.log('Creating branch');
    const branch = await doFetch('/api/branches', { method:'POST', headers:{ Authorization:`Bearer ${token}`, 'Content-Type':'application/json' }, body: JSON.stringify({ name:'Main Branch', location:'Nairobi', hospitalId }) });
    console.log('branch status', branch.status); console.log(JSON.stringify(branch.body, null, 2));
    result.branch = branch.body && branch.body.data ? { id: branch.body.data._id, name: branch.body.data.name } : null;

    console.log('Creating wards');
    const wards = ['General Ward', 'ICU', 'Maternity Ward'];
    for (const name of wards) {
      const res = await doFetch('/api/beds/wards', { method:'POST', headers:{ Authorization:`Bearer ${token}`, 'Content-Type':'application/json' }, body: JSON.stringify({ name, type:'GENERAL', department:'General', capacity:10 }) });
      console.log(name, res.status); console.log(JSON.stringify(res.body, null, 2));
    }

    console.log('Creating beds');
    for (const ward of wards) {
      const res = await doFetch('/api/beds', { method:'POST', headers:{ Authorization:`Bearer ${token}`, 'Content-Type':'application/json' }, body: JSON.stringify({ ward, number: `BED-${ward.toUpperCase().slice(0,2)}-01` }) });
      console.log(ward, res.status); console.log(JSON.stringify(res.body, null, 2));
    }

    const staffRoles = [
      { name:'Demo CFO', email:'cfo+auto@afyalink.demo', role:'cfo' },
      { name:'Demo Finance Manager', email:'finance.manager+auto@afyalink.demo', role:'finance_manager' },
      { name:'Demo Accountant', email:'accountant+auto@afyalink.demo', role:'accountant' },
      { name:'Demo Cashier', email:'cashier+auto@afyalink.demo', role:'cashier' },
      { name:'Demo HR Manager', email:'hr.manager+auto@afyalink.demo', role:'hr_manager' },
      { name:'Demo Receptionist', email:'receptionist+auto@afyalink.demo', role:'receptionist' },
      { name:'Demo Doctor', email:'doctor+auto@afyalink.demo', role:'doctor' },
      { name:'Demo Nurse', email:'nurse+auto@afyalink.demo', role:'nurse' },
      { name:'Demo Pharmacist', email:'pharmacist+auto@afyalink.demo', role:'pharmacist' },
      { name:'Demo Laboratory Technician', email:'lab.tech+auto@afyalink.demo', role:'labtech' }
    ];

    console.log('Registering staff');
    const createdStaff = [];
    for (const s of staffRoles) {
      const res = await doFetch('/api/hospital-admin/register-staff', { method:'POST', headers:{ Authorization:`Bearer ${token}`, 'Content-Type':'application/json' }, body: JSON.stringify({ name:s.name, email:s.email, password:'AfyaDemo@2026!', role:s.role, department:'Finance' }) });
      console.log('staff', s.email, res.status); console.log(JSON.stringify(res.body, null, 2));
      createdStaff.push({ email:s.email, role:s.role, status:res.status, body:res.body });
    }

    result.staff = createdStaff;
    await fs.writeFile(outFile, JSON.stringify(result, null, 2), 'utf8');
    console.log('Saved Phase 2 accounts to', outFile);
    process.exit(0);
  }catch(e){ console.error(e); process.exit(1); }
})();