import { useEffect, useState } from "react";
import { fetchMenu, makeMenuCacheKey, readMenuCache, writeMenuCache } from "../services/menuApi";

export function useMenu() {
  const [menu, setMenu] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadMenu = async () => {
      const token = localStorage.getItem("token");
      if (!token) {
        setMenu([]);
        setLoading(false);
        return;
      }

      let cacheKey = "";
      try {
        const storedUser = JSON.parse(localStorage.getItem("user") || "null");
        const roleOverride = localStorage.getItem("role_override") || "";
        cacheKey = makeMenuCacheKey({
          userId: storedUser?.id,
          role: storedUser?.role,
          viewRole: roleOverride,
        });
        const cached = readMenuCache(cacheKey);
        if (cached) {
          setMenu(cached);
          setLoading(false);
        }
      } catch {
        // ignore cache parse errors
      }

      try {
        const data = await fetchMenu();
        const next = data.menu || [];
        setMenu(next);
        writeMenuCache(cacheKey, next);
      } catch (err) {
        console.error("Menu load failed", err);
        setMenu([]);
      } finally {
        setLoading(false);
      }
    };

    loadMenu();
  }, []);

  return { menu, loading };
}
