import { useCallback, useState } from "react";
import { verifyAdminUser } from "../services/authApi";

export function useAdminVerifyUser() {
  const [userId, setUserId] = useState("");
  const [msg, setMsg] = useState("");

  const handleVerify = useCallback(async () => {
    try {
      await verifyAdminUser(userId);
      setMsg("✅ User verified successfully");
    } catch (err) {
      setMsg(err.message);
    }
  }, [userId]);

  return { userId, setUserId, msg, handleVerify };
}

export default useAdminVerifyUser;
