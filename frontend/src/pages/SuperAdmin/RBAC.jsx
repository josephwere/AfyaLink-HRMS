import React, {useEffect, useState} from 'react';
import { apiFetch } from '../../utils/apiFetch';
export default function RBAC(){
  const [users, setUsers] = useState([]);
  useEffect(() => {
    loadUsers();
  }, []);
  const loadUsers = async () => {
    try {
      const data = await apiFetch('/api/users');
      setUsers(Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : []);
    } catch {
      setUsers([]);
    }
  };
  const changeRole = async (id)=> {
    const role = prompt('New role (SuperAdmin,HospitalAdmin,Doctor,Nurse,LabTech,Patient)');
    if(!role) return;
    await apiFetch('/api/users/'+id, { method: 'PATCH', body: { role } });
    await loadUsers();
  };
  return (<div>
    <h3>Role Management</h3>
    <table><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Action</th></tr></thead>
    <tbody>{users.map(u=> <tr key={u._id}><td>{u.name}</td><td>{u.email}</td><td>{u.role}</td><td><button type="button" onClick={()=>changeRole(u._id)}>Change</button></td></tr>)}</tbody></table>
  </div>);
}
