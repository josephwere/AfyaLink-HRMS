import React, {useEffect, useState} from 'react';
import API from '../utils/api';
import { useSocket } from '../utils/socket';

export default function Notifications(){
  const [items, setItems] = useState([]);
  const socket = useSocket();
  useEffect(()=>{ 
    API.get('/notifications').then(r=>setItems(r.data)).catch(()=>{});
  },[]);
  useEffect(()=>{
    if (!socket) return;
    socket.on('invoiceCreated', (data)=> setItems(i=>[...i,{title:'Invoice', body:'New invoice created', meta:data}]));
    socket.on('paymentRecorded', (data)=> setItems(i=>[...i,{title:'Payment', body:'Payment recorded', meta:data}]));
    socket.on('labResult', (data)=> setItems(i=>[...i,{title:'Lab', body:'Lab result available', meta:data}]));
    return ()=>{ socket.off('invoiceCreated'); socket.off('paymentRecorded'); socket.off('labResult'); }
  },[socket]);
  return (
    <div className="card">
      <h4>Notifications</h4>
      <ul>
        {items.map((n,idx)=> <li key={idx}><strong>{n.title}</strong> - {n.body || (n.meta && n.meta.test)}</li>)}
      </ul>
    </div>
  );
}
