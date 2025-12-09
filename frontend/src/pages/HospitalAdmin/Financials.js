import React, {useEffect, useState} from 'react';
import API from '../../utils/api';
export default function Financials(){
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({patient:'', items:[{description:'Consultation', amount:50}]});
  useEffect(()=> fetch(),[]);
  const fetch = ()=> API.get('/financials').then(r=>setItems(r.data)).catch(()=>{});
  const create = async ()=> { await API.post('/financials', form); fetch(); };
  const pay = async (id)=> { const amount = prompt('Amount to pay', '0'); if(!amount) return; await API.post('/financials/'+id+'/pay', { amount: Number(amount), method: 'Card', reference: 'WEB' }); fetch(); };
  const claim = async (id)=> { const provider = prompt('Provider', 'NHIF'); await API.post('/financials/'+id+'/claim', { provider }); fetch(); };
  return (<div>
    <h3>Financials</h3>
    <div style={{display:'flex',gap:12}}>
      <div style={{flex:1}}>
        <input placeholder="Patient ID" value={form.patient} onChange={e=>setForm({...form, patient:e.target.value})} />
        <button onClick={create}>Create Invoice</button>
      </div>
      <div style={{flex:2}}>
        <table><thead><tr><th>Invoice</th><th>Patient</th><th>Total</th><th>Status</th><th>Actions</th></tr></thead>
        <tbody>{items.map(it=> <tr key={it._id}><td>{it.invoiceNumber}</td><td>{it.patient?.firstName || it.patient}</td><td>{it.total}</td><td>{it.status}</td>
        <td><button onClick={()=>pay(it._id)}>Pay</button><button onClick={()=>claim(it._id)}>Claim</button></td></tr>)}</tbody></table>
      </div>
    </div>
  </div>);
}
