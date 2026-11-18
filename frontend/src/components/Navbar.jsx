import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useLanguage } from "../context/LanguageContext";
import { useAuth } from "../context/AuthProvider";
import ThemeToggle from "./ThemeToggle";
import NotificationDropdown from "./NotificationDropdown";
import "./Navbar.css";

// The bar only shows the first name; long full names pushed Logout off the screen.
// The full name is in the tooltip and on the profile page.
const firstName = (name) => (name || "").trim().split(/\s+/)[0] || "";

function Navbar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { language, setLanguage, t } = useLanguage();
  const { user, userDetails, isAdmin, isSuperAdmin, logout } = useAuth();
  // The mobile menu remembers the path it was opened on, so navigating closes it
  const [menuOpenOn, setMenuOpenOn] = useState(null);
  const menuOpen = menuOpenOn === location.pathname;
  const setMenuOpen = (open) => setMenuOpenOn(open ? location.pathname : null);
  const navRef = useRef(null);

  // Close on Escape, on a tap outside the navbar, or when growing back to desktop width
  useEffect(() => {
    if (!menuOpen) return undefined;
    const onKey = (e) => { if (e.key === "Escape") setMenuOpen(false); };
    const onPointer = (e) => {
      if (navRef.current && !navRef.current.contains(e.target)) setMenuOpen(false);
    };
    const mq = window.matchMedia("(min-width: 1200px)");
    const onMq = (e) => { if (e.matches) setMenuOpen(false); };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    mq.addEventListener("change", onMq);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
      mq.removeEventListener("change", onMq);
    };
  }, [menuOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const handleAdminLogout = async () => {
    await logout();
    navigate("/admin/login");
  };

  return (
    <nav ref={navRef} className={`navbar navbar-expand-xl shadow-sm site-navbar${menuOpen ? " is-menu-open" : ""}`}>
      <div className="container">

        {/* LOGO */}
        <Link className="navbar-brand d-flex align-items-center text-decoration-none" to="/">
          <img src="/purvankaraimg.png" alt="Puravankara" className="navbar-brand-logo object-fit-contain" />
          <span className="text-accent fw-extrabold ls-1 brand-mark">GRM</span>
        </Link>

        {/* NAV LINKS */}
        <div className="ms-auto d-flex align-items-center nav-shell">

          {/* On desktop this wrapper is display:contents, so its children sit inline in the bar.
              Below 992px it becomes the slide-down menu panel. */}
          <div id="site-nav-menu" className={`nav-menu${menuOpen ? " is-open" : ""}`}>
          <div className="nav-menu-inner">
          <div className="nav-menu-links">

          <Link
            to="/assistant"
            className={`me-4 text-decoration-none d-flex align-items-center gap-2 nav-assistant-link${location.pathname === "/assistant" ? " is-active" : ""}`}
          >
            {/* Purva mini avatar */}
            <span className="purva-nav-avatar d-inline-flex rounded-circle overflow-hidden flex-shrink-0">
              <img className="w-100 h-100 object-fit-contain" src="/purva-logo.svg" alt="Purva" />
            </span>
            <span>Purva</span>
            <span className="d-inline-block rounded-circle nav-live-dot"></span>
          </Link>

          <Link to={user ? "/grm" : "/"} className={`me-4 text-decoration-none nav-link-custom ${location.pathname === "/grm" || location.pathname === "/" ? "is-active" : ""}`}>
            {t("home")}
          </Link>

          {user && (
            <Link to="/dashboard" className={`me-4 text-decoration-none nav-link-custom ${location.pathname === "/dashboard" ? "is-active" : ""}`}>
              {t("dashboard")}
            </Link>
          )}

          <Link to="/track" className="me-4 text-decoration-none nav-link-custom">
            {t("trackStatus")}
          </Link>

          <Link to="/help" className="me-4 text-decoration-none nav-link-custom">
            {t("help")}
          </Link>

          {isSuperAdmin && (
            <Link to="/admin/portal" className="me-4 text-decoration-none nav-link-custom fw-bold nav-link-portal">
              <i className="bi bi-shield-lock me-1"></i>Staff & Security
            </Link>
          )}

          </div>

          <div className="nav-menu-tail">
          {/* Phones: the theme switch moves here so the bar has room */}
          <div className="nav-theme-in-menu">
            <span>Dark mode</span>
            <ThemeToggle />
          </div>
          {/* LANGUAGE DROPDOWN */}
          <select
            className="form-select form-select-sm me-4 shadow-none cursor-pointer nav-lang-select"
            aria-label="Language Selection"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
          >
            <option value="English">English</option>
            <option value="Hindi">Hindi</option>
            <option value="Kannada">Kannada</option>
          </select>

          {/* AUTH BUTTON — Admin or User */}
          {isAdmin ? (
            // Admin is logged in
            <div className="d-flex align-items-center">
              <Link 
                to="/profile" 
                className="me-3 d-flex align-items-center text-decoration-none p-1 rounded-pill nav-profile-link"
                title="View Admin Profile"
              >
                {userDetails?.avatar_url ? (
                  <img
                    src={userDetails.avatar_url}
                    alt={userDetails.name || "Admin"}
                    className="rounded-circle me-2 shadow-sm object-fit-cover nav-avatar-admin"
                  />
                ) : (
                  <div
                    className="rounded-circle d-flex align-items-center justify-content-center text-white me-2 shadow-sm fw-bold nav-avatar-admin-fallback"
                  >
                    {userDetails?.name ? userDetails.name.charAt(0).toUpperCase() : "A"}
                  </div>
                )}
                <span className="fs-14 text-theme-muted">
                  <span className="text-heading fw-bold" title={userDetails?.name || "Admin"}>{firstName(userDetails?.name) || "Admin"}</span>
                </span>
              </Link>
              <button onClick={handleAdminLogout} className="btn btn-outline-danger px-3 fw-semibold fs-14">
                {t("logout")}
              </button>
            </div>
          ) : user ? (
            // Regular user logged in
            <div className="d-flex align-items-center">
              <Link 
                to="/profile" 
                className="me-3 d-flex align-items-center text-decoration-none p-1 rounded-pill nav-profile-link"
                title="View My Profile"
              >
                {userDetails?.avatar_url ? (
                  <img
                    src={userDetails.avatar_url}
                    alt={userDetails.name || "User"}
                    className="rounded-circle me-2 shadow-sm object-fit-cover nav-avatar-user"
                  />
                ) : (
                  <div
                    className="rounded-circle d-flex align-items-center justify-content-center text-white me-2 shadow-sm fw-bold nav-avatar-user-fallback"
                  >
                    {userDetails?.name ? userDetails.name.charAt(0).toUpperCase() : "U"}
                  </div>
                )}
                <span className="text-theme-muted nav-greeting">
                  <span className="text-heading fw-semibold" title={userDetails?.name || "User"}>{firstName(userDetails?.name) || "User"}</span>
                </span>
              </Link>
              <button onClick={handleLogout} className="btn btn-outline-danger btn-sm px-3 fw-semibold nav-logout">
                {t("logout")}
              </button>
            </div>
          ) : (
            // No one logged in
            <Link to="/login" className="btn btn-danger px-4">
              {t("login")}
            </Link>
          )}
          </div>
          </div>
          </div>

          {/* File a complaint, theme toggle and bell stay in the bar at every width */}
          <div className="nav-quick d-flex align-items-center">
            {/* FILE A COMPLAINT: always in the bar so first-time visitors find it */}
            {!isAdmin && !location.pathname.startsWith("/lodge") && (
              <div>
                <Link to="/lodge-selection" className="btn btn-danger btn-sm fw-semibold nav-file-btn" aria-label="File a complaint">
                  <i className="bi bi-pencil-square" aria-hidden="true"></i>
                  <span className="nav-file-label-full">File a complaint</span>
                  <span className="nav-file-label-short">File</span>
                </Link>
              </div>
            )}

            {/* THEME TOGGLE (in the menu instead on phones) */}
            <div className="nav-theme-in-bar">
              <ThemeToggle />
            </div>

            {/* NOTIFICATION BELL */}
            {user && (
              <div>
                <NotificationDropdown />
              </div>
            )}
          </div>

          {/* MOBILE MENU TOGGLE */}
          <button
            type="button"
            className={`nav-toggle d-xl-none${menuOpen ? " is-open" : ""}`}
            aria-controls="site-nav-menu"
            aria-expanded={menuOpen}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <span></span>
            <span></span>
            <span></span>
          </button>

        </div>

      </div>
    </nav>
  );
}

export default Navbar;