import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "../services/supabaseClient";
import { useAuth } from "../context/AuthProvider";

/**
 * Landing for a signed-in (non-admin) user: dashboard if they already have
 * grievances, otherwise the Purva policy assistant.
 */
const PostLoginLanding = () => {
  const { user } = useAuth();
  const [target, setTarget] = useState(null);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from("grievances")
      .select("grievance_id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .then(({ count, error }) => {
        if (cancelled) return;
        // On error fall back to the dashboard, which shows its own error state.
        setTarget(error || count > 0 ? "/dashboard" : "/assistant");
      });
    return () => { cancelled = true; };
  }, [user.id]);

  if (!target) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: "60vh" }}>
        <div className="spinner-border text-primary" role="status"></div>
      </div>
    );
  }
  return <Navigate to={target} replace />;
};

export default PostLoginLanding;
