import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthProvider";

const ProtectedRoute = ({ children, allowGuest = false }) => {
  const { user, loading } = useAuth();
  const location = useLocation();
  const isGuest = sessionStorage.getItem("isGuest") === "true";

  if (loading) return <div>Loading...</div>;

  if (!user && !(allowGuest && isGuest)) {
    // Keep the query string (e.g. ?project=...) and remember the page, so login brings them back
    const params = new URLSearchParams(location.search);
    params.set("next", location.pathname + location.search);
    return <Navigate to={`/login?${params}`} replace />;
  }

  return children;
};

export default ProtectedRoute;