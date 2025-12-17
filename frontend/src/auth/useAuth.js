import { useEffect, useState } from "react";
import { apiFetch } from "../api/client";
import { UserSchema } from "../api/schemas/user";

export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch("/auth/me")
      .then((u) => {
        UserSchema.safeParse(u);
        setUser(u);
      })
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  return { user, loading };
}