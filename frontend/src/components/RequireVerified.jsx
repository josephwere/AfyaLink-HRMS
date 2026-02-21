import { useAuth } from "../utils/auth";

export default function RequireVerified({ children }) {
  const { user } = useAuth();

  if (!user) return null;

  if (!user.emailVerified) {
    return (
      <div style={{ opacity: 0.6, pointerEvents: "none" }}>
        {children}
      </div>
    );
  }

  return children;
}
