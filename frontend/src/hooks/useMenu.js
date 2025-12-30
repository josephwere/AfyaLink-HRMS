import { useEffect, useState } from "react";
import axios from "../utils/axios";

export function useMenu() {
  const [menu, setMenu] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadMenu = async () => {
      try {
        const { data } = await axios.get("/menu");
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
