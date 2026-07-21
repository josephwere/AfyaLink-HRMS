import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "../utils/apiFetch";

export function useRBAC() {
  const [users, setUsers] = useState([]);
  const [selected, setSelected] = useState(null);
  const [role, setRole] = useState("");
  const [msg, setMsg] = useState("");

  const loadUsers = useCallback(async () => {
    try {
      const data = await apiFetch("/api/users");
      setUsers(Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : []);
    } catch {
      setUsers([]);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const changeRole = useCallback(async () => {
    if (!selected || !role) return;
    await apiFetch(`/api/users/${selected._id}`, { method: "PATCH", body: { role } });
    setMsg(`Updated ${selected.name || selected.email} to ${role}.`);
    await loadUsers();
    setSelected(null);
  }, [loadUsers, role, selected]);

  return { users, selected, setSelected, role, setRole, msg, setMsg, loadUsers, changeRole };
}

export default useRBAC;
