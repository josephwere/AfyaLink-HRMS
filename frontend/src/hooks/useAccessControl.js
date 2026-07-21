import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  getDelegationScope,
  getUserDelegatedPermissions,
  saveUserDelegatedPermissions,
} from "../services/delegatedPermissionsApi";

export function useAccessControl() {
  const [searchParams] = useSearchParams();
  const permissionsRef = useRef(null);
  const [q, setQ] = useState(() => searchParams.get("q") || "");
  const [scope, setScope] = useState({
    actorRole: "",
    manageableRoles: [],
    users: [],
    permissionsCatalog: [],
  });
  const [selectedUserId, setSelectedUserId] = useState(() => searchParams.get("userId") || "");
  const [checked, setChecked] = useState({});
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const loadScope = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getDelegationScope({ q });
      setScope((prev) => ({ ...prev, ...(data || {}) }));
      if (!selectedUserId && data?.users?.length) {
        setSelectedUserId(String(data.users[0]._id));
      }
    } catch (err) {
      setMessage(err?.message || "Failed to load access scope");
    } finally {
      setLoading(false);
    }
  }, [q, selectedUserId]);

  useEffect(() => {
    void loadScope();
  }, [loadScope]);

  useEffect(() => {
    const id = setTimeout(() => {
      void loadScope();
    }, 250);
    return () => clearTimeout(id);
  }, [loadScope]);

  useEffect(() => {
    if (!selectedUserId) return;
    let isMounted = true;
    const loadPermissions = async () => {
      setBusy(true);
      try {
        const data = await Promise.resolve(getUserDelegatedPermissions(selectedUserId));
        if (!isMounted) return;
        const targetRole = String(data?.target?.role || "").toUpperCase();
        const next = {};
        for (const item of scope.permissionsCatalog || []) {
          const roles = Array.isArray(item.roles) ? item.roles : [];
          next[item.permissionKey] = roles.includes(targetRole);
        }
        for (const grant of data?.grants || []) {
          const key = grant?.permissionKey;
          if (!key) continue;
          next[key] = grant?.effect === "ALLOW";
        }
        setChecked(next);
      } catch {
        if (isMounted) setChecked({});
      } finally {
        if (isMounted) setBusy(false);
      }
    };

    void loadPermissions();
    return () => {
      isMounted = false;
    };
  }, [selectedUserId, scope.permissionsCatalog]);

  const catalogBySection = useMemo(() => {
    const map = new Map();
    for (const item of scope.permissionsCatalog || []) {
      const section = item.section || "General";
      const arr = map.get(section) || [];
      arr.push(item);
      map.set(section, arr);
    }
    return Array.from(map.entries());
  }, [scope.permissionsCatalog]);

  const onSave = useCallback(async () => {
    if (!selectedUserId) return;
    setBusy(true);
    setMessage("");
    try {
      const grants = Object.entries(checked).map(([permissionKey, allowed]) => ({
        permissionKey,
        action: "VIEW",
        effect: allowed ? "ALLOW" : "DENY",
      }));
      await saveUserDelegatedPermissions(selectedUserId, grants);
      setMessage("Access permissions updated successfully.");
    } catch (err) {
      setMessage(err?.message || "Failed to save permissions");
    } finally {
      setBusy(false);
    }
  }, [checked, selectedUserId]);

  return {
    permissionsRef,
    q,
    setQ,
    scope,
    selectedUserId,
    setSelectedUserId,
    checked,
    setChecked,
    busy,
    loading,
    message,
    setMessage,
    catalogBySection,
    loadScope,
    onSave,
  };
}

export default useAccessControl;
