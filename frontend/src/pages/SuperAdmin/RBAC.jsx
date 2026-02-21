import React, {useEffect, useState} from 'react';
import API from '../../utils/api';
export default function RBAC(){
  const [users, setUsers] = useState([]);
  useEffect(()=> fetch(),[]);
  const fetch = ()=> API.get('/users').then(r=>setUsers(r.data)).catch(()=>{});
  const changeRole = async (id)=> {
    const role = prompt('New role (SuperAdmin,HospitalAdmin,Doctor,Nurse,LabTech,Patient)');
    if(!role) return;
    await API.patch('/users/'+id, { role });
    fetch();
  };
  return (<div>
    <h3>Role Management</h3>
    <table><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Action</th></tr></thead>
    <tbody>{users.map(u=> <tr key={u._id}><td>{u.name}</td><td>{u.email}</td><td>{u.role}</td><td><button onClick={()=>changeRole(u._id)}>Change</button></td></tr>)}</tbody></table>
  </div>);
}
