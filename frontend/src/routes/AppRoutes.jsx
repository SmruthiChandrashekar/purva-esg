import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useParams } from "react-router-dom";
import { LanguageProvider } from "../context/LanguageContext";
import { AuthProvider, useAuth } from "../context/AuthProvider";
import Layout from "../layout/Layout";
import ProtectedRoute from "./ProtectedRoute";
import PostLoginLanding from "./PostLoginLanding";
import { SINGLE_DEPARTMENT_MODE } from "../config/features";
import { nextFromLocation } from "../utils/returnTo";

const Index = lazy(() => import("../pages/Index"));
const Track = lazy(() => import("../pages/Track"));
const Help = lazy(() => import("../pages/Help"));
const Auth = lazy(() => import("../pages/Auth"));
const LodgeSelection = lazy(() => import("../pages/LodgeSelection"));
const LodgeInternal = lazy(() => import("../pages/LodgeInternal"));
const LodgeContract = lazy(() => import("../pages/LodgeContract"));
const LodgeExternal = lazy(() => import("../pages/LodgeExternal"));
const Dashboard = lazy(() => import("../pages/Dashboard"));
const AdminLogin = lazy(() => import("../pages/AdminLogin"));
const AdminDashboard = lazy(() => import("../pages/AdminDashboard"));
const SuperAdminPortal = lazy(() => import("../pages/SuperAdminPortal"));
const SetPassword = lazy(() => import("../pages/SetPassword"));
const PolicyAssistant = lazy(() => import("../pages/PolicyAssistant"));
const Profile = lazy(() => import("../pages/Profile"));
const StakeholderHub = lazy(() => import("../pages/StakeholderHub"));

// Redirect that keeps the query string (e.g. ?project=...) from the project pages.
const RedirectKeepSearch = ({ to }) => {
  const { search } = useLocation();
  return <Navigate to={`${to}${search}`} replace />;
};

// Old links to the retired Puravankara website simulation: a project page now opens the
// complaint flow with that project pre-selected; every other simulation page goes home.
const OldProjectPage = () => {
  const { projectId } = useParams();
  return <Navigate to={`/lodge-selection?project=${encodeURIComponent(projectId || "")}`} replace />;
};

const PageLoader = () => (
  <div className="d-flex justify-content-center align-items-center" style={{ minHeight: "60vh" }}>
    <div className="spinner-border text-primary" role="status"></div>
  </div>
);

const MainRoutes = () => {
  const { user, isAdmin, isSuperAdmin, loading } = useAuth();
  const isAuthenticated = !!user;

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center vh-100">
        <div className="spinner-border text-primary" role="status"></div>
      </div>
    );
  }

  // Dynamic root element
  const getRootElement = () => {
    if (isAdmin) return <AdminDashboard />;
    if (isAuthenticated) return <StakeholderHub />;
    return <Index />;
  };

  return (
    <Layout>
      <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* The portal is the front door (the QR code points here) */}
        <Route path="/" element={getRootElement()} />
        <Route path="/grm" element={getRootElement()} />
        
        {/* Protected User Routes */}
        {/* Public: anyone with a tracking ID (including guests) can follow a complaint */}
        <Route path="/track" element={<Track />} />
        <Route path="/lodge-selection" element={SINGLE_DEPARTMENT_MODE ? <RedirectKeepSearch to="/lodge-external" /> : isAdmin ? <Navigate to="/admin/dashboard" replace /> : <ProtectedRoute><LodgeSelection /></ProtectedRoute>} />
        <Route path="/lodge-internal" element={SINGLE_DEPARTMENT_MODE ? <RedirectKeepSearch to="/lodge-external" /> : isAdmin ? <Navigate to="/admin/dashboard" replace /> : <ProtectedRoute><LodgeInternal /></ProtectedRoute>} />
        <Route path="/lodge-contract" element={SINGLE_DEPARTMENT_MODE ? <RedirectKeepSearch to="/lodge-external" /> : isAdmin ? <Navigate to="/admin/dashboard" replace /> : <ProtectedRoute><LodgeContract /></ProtectedRoute>} />
        <Route path="/lodge-external" element={isAdmin ? <Navigate to="/admin/dashboard" replace /> : <ProtectedRoute><LodgeExternal /></ProtectedRoute>} />
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />

        {/* Public Routes */}
        {/* Retired website simulation: keep old links working */}
        <Route path="/residential/bengaluru/:projectId" element={<OldProjectPage />} />
        <Route path="/residential/*" element={<Navigate to="/" replace />} />
        <Route path="/bengaluru" element={<Navigate to="/" replace />} />
        <Route path="/purva" element={<Navigate to="/" replace />} />
        <Route path="/simulation" element={<Navigate to="/" replace />} />
        <Route path="/assistant" element={<PolicyAssistant />} />
        <Route path="/help" element={<Help />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/login" element={isAuthenticated && !isAdmin && !window.location.search.includes("message=") && !sessionStorage.getItem("phoneVerifyPending") ? <Navigate to={nextFromLocation() || "/grm"} replace /> : <Auth />} />
        <Route path="/register" element={<Auth />} />

        {/* Admin Routes */}
        <Route path="/admin" element={isAdmin ? <Navigate to="/admin/dashboard" replace /> : <AdminLogin />} />
        <Route path="/admin/login" element={isAdmin ? <Navigate to="/admin/dashboard" replace /> : <AdminLogin />} />
        <Route path="/admin/dashboard" element={isAdmin ? <AdminDashboard /> : <Navigate to="/admin/login" replace />} />
        <Route path="/set-password" element={<SetPassword />} />
        <Route path="/admin/portal" element={isSuperAdmin ? <SuperAdminPortal /> : (isAdmin ? <Navigate to="/admin/dashboard" replace /> : <Navigate to="/admin/login" replace />)} />
      </Routes>
      </Suspense>
    </Layout>
  );
};

const AppRoutes = () => {
  return (
    <LanguageProvider>
      <AuthProvider>
        <BrowserRouter>
          <MainRoutes />
        </BrowserRouter>
      </AuthProvider>
    </LanguageProvider>
  );
};

export default AppRoutes;