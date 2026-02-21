import { useEffect, useState } from "react";
import { fetchMenu } from "../services/menuApi";

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

      try {
        const data = await fetchMenu();
        setMenu(data.menu || []);
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
