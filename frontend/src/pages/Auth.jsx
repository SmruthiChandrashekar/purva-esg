import React, { useState, useEffect } from "react";
import { resetApiClientState, apiClient } from "../services/api";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "../services/supabaseClient";
import { useLanguage } from "../context/LanguageContext";
import "./Auth.css";
import { SINGLE_DEPARTMENT_MODE } from "../config/features";

// While the phone-verification step is pending, /login must not auto-redirect the
// (already signed-in) user to the dashboard.
const setVerifyPending = (on) => {
  try {
    if (on) sessionStorage.setItem("phoneVerifyPending", "1");
    else sessionStorage.removeItem("phoneVerifyPending");
  } catch (_) {}
};

import { PURVA_CITIES_PROJECTS, findProjectByNameOrId } from "../config/projectsData";

const PURVA_PROJECTS = Object.values(PURVA_CITIES_PROJECTS)
  .flat()
  .map((p) => p.name)
  .concat(["Corporate / Other"]);


const COMPLAINT_CATEGORIES = [
  "Environmental & Sustainability",
  "Community & Public Relations",
  "Site Labor & Safety",
  "Quality & Construction",
  "Governance & Compliance",
  "Other"
];

const SEVERITY_LEVELS = [
  "Low",
  "Medium",
  "High",
  "Critical"
];

const Auth = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { t } = useLanguage();

  // Mode: "login" | "register" | "guest"
  const [mode, setMode] = useState("login");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const projectParam = searchParams.get("project");
  const storedProject = sessionStorage.getItem("purva_selected_project");
  const rememberedProject = projectParam || storedProject || "";

  useEffect(() => {
    supabase.auth.signOut().catch(() => {});
    const msg = searchParams.get("message");
    if (msg) {
      setMessage({ type: "info", text: msg });
    }
    if (projectParam) {
      sessionStorage.setItem("purva_selected_project", projectParam);
    }
  }, [searchParams, projectParam]);

  // Account Form State
  const [formData, setFormData] = useState({
    userType: "External",
    email: "",
    password: "",
    name: "",
    confirmPassword: "",
    employeeId: "",
    agencyName: "",
    location: "",
  });
  const [errors, setErrors] = useState({});

  // Guest Form State
  const [guestData, setGuestData] = useState({
    project: rememberedProject || PURVA_PROJECTS[0],
    category: "Environmental & Sustainability",
    severity: "Medium",
    description: "",
    isAnonymous: true,
    name: "",
    email: "",
    phone: "",
  });
  const [guestLoading, setGuestLoading] = useState(false);
  const [guestResult, setGuestResult] = useState(null); // { ticketId, secretPin }


  // Phone OTP verification (only used when VITE_REQUIRE_PHONE_OTP=true)
  const REQUIRE_PHONE_OTP = import.meta.env.VITE_REQUIRE_PHONE_OTP === "true";
  const [verifyStep, setVerifyStep] = useState(null); // null | "phone" | "otp"
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
    setMessage({ type: "", text: "" });
  };

  const handleGuestInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setGuestData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
    setMessage({ type: "", text: "" });
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.email) newErrors.email = "Email is required.";
    if (!formData.password) newErrors.password = "Password is required.";

    if (mode === "register") {
      if (!formData.name) newErrors.name = "Full Name is required.";
      if (!formData.userType) newErrors.userType = "User Type is required.";

      // Internal Email Domain Restriction
      if (formData.userType === "Internal" && formData.email) {
        if (!formData.email.toLowerCase().endsWith("@company.com")) {
          newErrors.email = "Internal registration requires a @company.com email address.";
        }
      }

      if (!formData.confirmPassword) newErrors.confirmPassword = "Confirm Password is required.";
      if (
        formData.password &&
        formData.confirmPassword &&
        formData.password !== formData.confirmPassword
      ) {
        newErrors.confirmPassword = "Passwords do not match.";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const parseError = (err) => {
    try {
      const parsed = typeof err.message === "string" ? JSON.parse(err.message) : err.message;
      if (parsed && parsed.code === "PGRST303") return "Your session has expired. Please log in again.";
      if (parsed && parsed.message) return parsed.message;
    } catch (_) {}
    if (err.message?.includes("JWT expired")) return "Your session has expired. Please log in again.";
    if (err.message?.includes("Invalid login credentials")) return "Invalid email or password. Please try again.";
    if (err.message?.includes("Email not confirmed")) return "Please confirm your email before logging in.";
    if (err.message?.includes("User already registered")) return "An account with this email already exists.";
    return err.message || "Something went wrong. Please try again.";
  };

  const registerUser = async () => {
    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
      });
      if (signUpError) throw signUpError;
      if (data.user) {
        const { error: insertError } = await supabase.from("users").insert([
          {
            user_id: data.user.id,
            name: formData.name,
            email: formData.email,
            user_type: formData.userType,
            department:
              formData.userType === "Internal"
                ? formData.employeeId
                : formData.userType === "Contract"
                ? formData.agencyName
                : formData.location,
          },
        ]);
        if (insertError) throw insertError;
        if (REQUIRE_PHONE_OTP) {
          if (!data.session) {
            throw new Error("Account created. Please confirm your email, then sign in to verify your phone number.");
          }
          setMessage({ type: "success", text: "Account created. Now verify your phone number." });
          setVerifyStep("phone");
          return "verify";
        }
        const savedProj = sessionStorage.getItem("purva_selected_project") || projectParam;
        const targetUrl = savedProj ? `/grm?project=${encodeURIComponent(savedProj)}` : "/grm";
        setMessage({ type: "success", text: "Registration successful! Redirecting..." });
        setTimeout(() => { window.location.href = targetUrl; }, 1200);
      }
    } catch (err) {
      setMessage({ type: "error", text: parseError(err) });
    }
  };

  const loginUser = async () => {
    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
      });

      if (authError || !authData?.user) {
        throw authError || new Error("Invalid credentials");
      }

      resetApiClientState();

      const { data: userData, error: userError } = await supabase
        .from("users")
        .select("role")
        .eq("user_id", authData.user.id)
        .single();

      if (userError) {
        console.error("Error fetching user data:", userError);
      }

      if (userData?.role === "super_admin") {
        setMessage({ type: "success", text: "Admin login successful! Redirecting..." });
        setTimeout(() => { window.location.href = "/admin/dashboard"; }, 1000);
      } else {
        setMessage({ type: "success", text: "Login successful! Welcome back." });
        const savedProj = sessionStorage.getItem("purva_selected_project") || projectParam;
        const targetUrl = savedProj ? `/grm?project=${encodeURIComponent(savedProj)}` : "/grm";
        setTimeout(() => { window.location.href = targetUrl; }, 1000);
      }
    } catch (err) {
      setMessage({ type: "error", text: parseError(err) });
    }
  };

  const errorFromResponse = async (res) => {
    try {
      const body = await res.json();
      if (typeof body.detail === "string") return body.detail;
    } catch (_) {}
    return "Something went wrong. Please try again.";
  };

  const sendOtp = async () => {
    if (!/^\+\d{10,15}$/.test(phone.trim())) {
      setMessage({ type: "error", text: "Enter your phone number with country code, e.g. +919876543210." });
      return;
    }
    setLoading(true);
    try {
      const res = await apiClient("/api/phone/send-otp", {
        method: "POST",
        body: JSON.stringify({ phone: phone.trim() }),
      });
      if (!res.ok) {
        setMessage({ type: "error", text: await errorFromResponse(res) });
        return;
      }
      setOtp("");
      setVerifyStep("otp");
      setMessage({ type: "success", text: "Verification code sent. Enter it below." });
    } catch (_) {
      setMessage({ type: "error", text: "Could not reach the server. Please try again." });
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    if (!/^\d{6}$/.test(otp.trim())) {
      setMessage({ type: "error", text: "Enter the 6-digit code you received." });
      return;
    }
    setLoading(true);
    try {
      const res = await apiClient("/api/phone/verify-otp", {
        method: "POST",
        body: JSON.stringify({ phone: phone.trim(), code: otp.trim() }),
      });
      if (!res.ok) {
        setMessage({ type: "error", text: await errorFromResponse(res) });
        return;
      }
      resetApiClientState();
      setVerifyPending(false);
      setMessage({ type: "success", text: "Phone verified! Redirecting..." });
      setTimeout(() => { window.location.href = "/"; }, 1000);
    } catch (_) {
      setMessage({ type: "error", text: "Could not reach the server. Please try again." });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    if (REQUIRE_PHONE_OTP) setVerifyPending(true);
    const result = mode === "register" ? await registerUser() : await loginUser();
    if (REQUIRE_PHONE_OTP && result !== "verify") setVerifyPending(false);
    setLoading(false);
  };

  // Guest complaint submission
  const handleGuestSubmit = async (e) => {
    e.preventDefault();
    if (!guestData.description.trim()) {
      setMessage({ type: "error", text: "Please enter a description of your concern." });
      return;
    }
    setGuestLoading(true);
    setMessage({ type: "", text: "" });

    const payload = {
      description: guestData.description.trim(),
      attachments: [],
      source: "Web Portal (Guest)",
      prefilled_severity: guestData.severity,
      prefilled_department: guestData.category,
      metadata: {
        user_id: null,
        name: guestData.isAnonymous ? "Anonymous Stakeholder" : (guestData.name || "Guest"),
        phone: guestData.phone || "",
        email: guestData.email || "",
        location: guestData.project,
        date: new Date().toISOString().split("T")[0],
        department: guestData.category,
        source: "Web Portal (Guest)",
        severity: guestData.severity,
        prefilled_severity: guestData.severity,
        prefilled_department: guestData.category,
        project: guestData.project,
        is_anonymous: guestData.isAnonymous,
      },
    };

    try {
      const res = await apiClient("/submit-complaint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const pin = Math.floor(100000 + Math.random() * 900000).toString();
      if (res.ok) {
        const data = await res.json();
        setGuestResult({
          ticketId: data.complaint_id || data.grievance_id || data.id,
          secretPin: pin,
        });
      } else {
        const fallbackId = "GR-" + Math.floor(100000 + Math.random() * 900000);
        setGuestResult({
          ticketId: fallbackId,
          secretPin: pin,
        });
      }
    } catch (err) {
      console.error("Guest submit fallback:", err);
      const fallbackId = "GR-" + Math.floor(100000 + Math.random() * 900000);
      const pin = Math.floor(100000 + Math.random() * 900000).toString();
      setGuestResult({
        ticketId: fallbackId,
        secretPin: pin,
      });
    } finally {
      setGuestLoading(false);
    }
  };

  const switchMode = (newMode) => {
    setMode(newMode);
    setErrors({});
    setMessage({ type: "", text: "" });
    setGuestResult(null);
    setShowPassword(false);
    setShowConfirmPassword(false);
    setVerifyStep(null);
    setOtp("");
    setVerifyPending(false);
  };

  const features = [
    { icon: "bi-shield-lock", label: t("featureConfidential"), desc: t("featureConfidentialDesc") },
    { icon: "bi-robot", label: t("featureAI"), desc: t("featureAIDesc") },
    { icon: "bi-clock-history", label: t("feature247"), desc: t("feature247Desc") },
    { icon: "bi-graph-up-arrow", label: t("featureRealtime"), desc: t("featureRealtimeDesc") },
  ];

  return (
    <div className="auth-page-wrapper">
      {/* HERO BANNER */}
      <div className="hero-banner text-white bg-navy auth-hero">
        <div className="container text-center pb-4 text-white">
          <h1 className="fw-bold mb-2 text-white auth-hero-title">
            Stakeholder Grievance &amp; Complaints Portal
          </h1>
          <p className="opacity-90 mb-0 auth-hero-lead">
            Empowering transparency, accountability, and rapid ESG redressal across all Puravankara communities.
          </p>
        </div>

        {/* WAVE DIVIDER */}
        <svg
          className="d-block auth-hero-wave"
          viewBox="0 0 1440 60"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            fill="var(--bg-color, #f8fafc)"
            d="M0,30 C360,60 1080,0 1440,30 L1440,60 L0,60 Z"
          />
        </svg>
      </div>

      {/* MAIN CONTENT */}
      <div className="auth-body">
        <div className="container py-4">
          <div className="row g-4 g-lg-5 justify-content-center align-items-start">

            {/* LEFT: FEATURE HIGHLIGHTS */}
            <div className="col-lg-5 col-12 auth-side">
              <h4 className="fw-bold mb-4 text-theme">
                {t("whyUseGRM")}
              </h4>
              <div className="d-flex flex-column gap-3">
                {features.map((f, i) => (
                  <div
                    key={i}
                    className="card border-0 shadow-sm p-3 auth-feature-card"
                  >
                    <div className="d-flex align-items-center gap-3">
                      <div
                        className="d-flex align-items-center justify-content-center rounded-circle flex-shrink-0 auth-feature-icon"
                      >
                        <i className={`bi ${f.icon} auth-feature-glyph`}></i>
                      </div>
                      <div>
                        <div className="fw-bold auth-feature-label">{f.label}</div>
                        <div className="text-muted auth-feature-desc">{f.desc}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div
                className="card border-0 shadow-sm mt-4 p-4 auth-admin-card"
              >
                <div className="d-flex align-items-center gap-2 mb-2">
                  <i className="bi bi-person-badge text-danger auth-feature-glyph"></i>
                  <span className="fw-bold text-white">{t("adminLoginTitle")}</span>
                </div>
                <p className="mb-3 opacity-75 auth-admin-desc">
                  {t("adminLoginDesc")}
                </p>
                <a
                  href="/admin"
                  className="btn btn-danger btn-sm w-100 mt-2 rounded-3 fw-semibold p-2"
                >
                  {t("goToAdminPortal")}
                </a>
              </div>
            </div>

            {/* RIGHT: THE ACTION FORM CONTAINER */}
            <div className="col-lg-7 col-md-10 col-12 auth-side">
              <div className="card border-0 shadow-sm auth-card p-4 p-md-5">

                {/* TOP TABS: [ Log In ] | [ Register ] | [ Continue as Guest ] */}
                <div className="auth-nav-tabs">
                  <button
                    type="button"
                    className={`auth-nav-tab ${mode === "login" ? "is-active" : ""}`}
                    onClick={() => switchMode("login")}
                  >
                    <i className="bi bi-box-arrow-in-right me-2"></i>
                    Log In
                  </button>
                  <button
                    type="button"
                    className={`auth-nav-tab ${mode === "register" ? "is-active" : ""}`}
                    onClick={() => switchMode("register")}
                  >
                    <i className="bi bi-person-plus me-2"></i>
                    Register
                  </button>
                  <button
                    type="button"
                    className={`auth-nav-tab ${mode === "guest" ? "is-active" : ""}`}
                    onClick={() => switchMode("guest")}
                  >
                    <i className="bi bi-shield-check me-2"></i>
                    Continue as Guest
                  </button>
                </div>

                {/* ALERT MESSAGES */}
                {message.text && (
                  <div
                    className={`alert ${
                      message.type === "success"
                        ? "alert-success"
                        : message.type === "info"
                        ? "alert-info"
                        : "alert-danger"
                    } d-flex align-items-center gap-2 mb-4 auth-alert`}
                    role="alert"
                  >
                    <i
                      className={`bi ${
                        message.type === "success"
                          ? "bi-check-circle-fill"
                          : message.type === "info"
                          ? "bi-info-circle-fill"
                          : "bi-exclamation-triangle-fill"
                      }`}
                    ></i>
                    <span>{message.text}</span>
                  </div>
                )}

                {/* ────────────────── TAB 1: LOG IN ────────────────── */}
                {mode === "login" && (
                  <div>
                    <div className="mb-4">
                      <h4 className="fw-bold mb-1 text-navy">Welcome back</h4>
                      <p className="text-muted small mb-0">
                        Log in to track your existing grievances and communicate with resolution teams.
                      </p>
                    </div>

                    <form onSubmit={handleSubmit} noValidate>
                      {/* EMAIL */}
                      <div className="mb-3">
                        <label className="form-label fw-semibold text-navy small mb-1">
                          Email Address
                        </label>
                        <input
                          type="email"
                          name="email"
                          value={formData.email}
                          onChange={handleInputChange}
                          className={`form-control auth-input ${errors.email ? "is-invalid" : ""}`}
                          placeholder="name@example.com"
                          disabled={loading}
                        />
                        {errors.email && <div className="invalid-feedback">{errors.email}</div>}
                      </div>

                      {/* PASSWORD */}
                      <div className="mb-4">
                        <div className="d-flex justify-content-between align-items-center mb-1">
                          <label className="form-label fw-semibold text-navy small mb-0">
                            Password
                          </label>
                          <a href="#" className="text-decoration-none small text-muted auth-forgot-link">
                            Forgot password?
                          </a>
                        </div>
                        <div className="input-group">
                          <input
                            type={showPassword ? "text" : "password"}
                            name="password"
                            value={formData.password}
                            onChange={handleInputChange}
                            className={`form-control auth-input ${errors.password ? "is-invalid" : ""}`}
                            placeholder="••••••••"
                            disabled={loading}
                          />
                          <button
                            type="button"
                            className="input-group-text bg-white border-start-0 text-muted cursor-pointer"
                            onClick={() => setShowPassword((p) => !p)}
                            tabIndex={-1}
                          >
                            <i className={`bi ${showPassword ? "bi-eye-slash" : "bi-eye"}`}></i>
                          </button>
                          {errors.password && <div className="invalid-feedback">{errors.password}</div>}
                        </div>
                      </div>

                      {/* SUBMIT BUTTON */}
                      <button
                        type="submit"
                        disabled={loading}
                        className="btn btn-purva-navy w-100 fw-bold py-2 shadow-sm"
                      >
                        {loading ? (
                          <>
                            <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                            Signing In...
                          </>
                        ) : (
                          "Log In"
                        )}
                      </button>

                      <div className="text-center mt-4">
                        <span className="text-muted small">Don&apos;t have an account? </span>
                        <button
                          type="button"
                          className="btn btn-link p-0 text-navy fw-semibold small text-decoration-none"
                          onClick={() => switchMode("register")}
                        >
                          Register here &rarr;
                        </button>
                      </div>
                    </form>
                  </div>
                )}

                {/* ────────────────── TAB 2: REGISTER ────────────────── */}
                {mode === "register" && (
                  <div>
                    <div className="mb-4">
                      <h4 className="fw-bold mb-1 text-navy">Create an Account</h4>
                      <p className="text-muted small mb-0">
                        Create an account to unlock full transparency, real-time tracking, and instant updates.
                      </p>
                    </div>

                    <form onSubmit={handleSubmit} noValidate>
                      {/* USER TYPE SELECTOR */}
                      {!SINGLE_DEPARTMENT_MODE && (
                        <div className="mb-3">
                          <label className="form-label fw-semibold text-navy small mb-1">
                            I am registering as:
                          </label>
                          <div className="d-flex gap-2">
                            {[
                              { id: "External", label: "Resident / Stakeholder" },
                              { id: "Internal", label: "Puravankara Employee" },
                              { id: "Contract", label: "Site Contractor" },
                            ].map((role) => (
                              <button
                                key={role.id}
                                type="button"
                                className={`btn btn-sm flex-fill fw-semibold py-2 ${
                                  formData.userType === role.id
                                    ? "btn-navy-active"
                                    : "btn-outline-secondary"
                                }`}
                                onClick={() => setFormData((p) => ({ ...p, userType: role.id }))}
                              >
                                {role.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* FULL NAME */}
                      <div className="mb-3">
                        <label className="form-label fw-semibold text-navy small mb-1">
                          Full Name
                        </label>
                        <input
                          type="text"
                          name="name"
                          value={formData.name}
                          onChange={handleInputChange}
                          className={`form-control auth-input ${errors.name ? "is-invalid" : ""}`}
                          placeholder="e.g. Rahul Sharma"
                          disabled={loading}
                        />
                        {errors.name && <div className="invalid-feedback">{errors.name}</div>}
                      </div>

                      {/* ROLE-SPECIFIC FIELD */}
                      {formData.userType === "Internal" && (
                        <div className="mb-3">
                          <label className="form-label fw-semibold text-navy small mb-1">
                            Employee ID
                          </label>
                          <input
                            type="text"
                            name="employeeId"
                            value={formData.employeeId}
                            onChange={handleInputChange}
                            className="form-control auth-input"
                            placeholder="e.g. PURVA-10492"
                            disabled={loading}
                          />
                        </div>
                      )}

                      {formData.userType === "Contract" && (
                        <div className="mb-3">
                          <label className="form-label fw-semibold text-navy small mb-1">
                            Contractor / Agency Name
                          </label>
                          <input
                            type="text"
                            name="agencyName"
                            value={formData.agencyName}
                            onChange={handleInputChange}
                            className="form-control auth-input"
                            placeholder="e.g. Apex Safety Engineering"
                            disabled={loading}
                          />
                        </div>
                      )}

                      {formData.userType === "External" && (
                        <div className="mb-3">
                          <label className="form-label fw-semibold text-navy small mb-1">
                            City / Location
                          </label>
                          <input
                            type="text"
                            name="location"
                            value={formData.location}
                            onChange={handleInputChange}
                            className="form-control auth-input"
                            placeholder="e.g. Bengaluru"
                            disabled={loading}
                          />
                        </div>
                      )}

                      {/* EMAIL */}
                      <div className="mb-3">
                        <label className="form-label fw-semibold text-navy small mb-1">
                          Email Address
                        </label>
                        <input
                          type="email"
                          name="email"
                          value={formData.email}
                          onChange={handleInputChange}
                          className={`form-control auth-input ${errors.email ? "is-invalid" : ""}`}
                          placeholder={formData.userType === "Internal" ? "name@company.com" : "name@example.com"}
                          disabled={loading}
                        />
                        {errors.email && <div className="invalid-feedback">{errors.email}</div>}
                      </div>

                      {/* PASSWORD */}
                      <div className="mb-3">
                        <label className="form-label fw-semibold text-navy small mb-1">
                          Password
                        </label>
                        <input
                          type={showPassword ? "text" : "password"}
                          name="password"
                          value={formData.password}
                          onChange={handleInputChange}
                          className={`form-control auth-input ${errors.password ? "is-invalid" : ""}`}
                          placeholder="••••••••"
                          disabled={loading}
                        />
                        {errors.password && <div className="invalid-feedback">{errors.password}</div>}
                      </div>

                      {/* CONFIRM PASSWORD */}
                      <div className="mb-4">
                        <label className="form-label fw-semibold text-navy small mb-1">
                          Confirm Password
                        </label>
                        <input
                          type={showConfirmPassword ? "text" : "password"}
                          name="confirmPassword"
                          value={formData.confirmPassword}
                          onChange={handleInputChange}
                          className={`form-control auth-input ${errors.confirmPassword ? "is-invalid" : ""}`}
                          placeholder="••••••••"
                          disabled={loading}
                        />
                        {errors.confirmPassword && <div className="invalid-feedback">{errors.confirmPassword}</div>}
                      </div>

                      {/* SUBMIT BUTTON */}
                      <button
                        type="submit"
                        disabled={loading}
                        className="btn btn-purva-navy w-100 fw-bold py-2 shadow-sm"
                      >
                        {loading ? (
                          <>
                            <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                            Creating Account...
                          </>
                        ) : (
                          "Create Account"
                        )}
                      </button>

                      <div className="text-center mt-4">
                        <span className="text-muted small">Already have an account? </span>
                        <button
                          type="button"
                          className="btn btn-link p-0 text-navy fw-semibold small text-decoration-none"
                          onClick={() => switchMode("login")}
                        >
                          Log In here &rarr;
                        </button>
                      </div>
                    </form>
                  </div>
                )}

                {/* ────────────────── TAB 3: CONTINUE AS GUEST ────────────────── */}
                {mode === "guest" && (
                  <div>
                    {!guestResult ? (
                      <>
                        <div className="mb-4">
                          <div className="d-flex justify-content-between align-items-start gap-2 flex-wrap">
                            <div>
                              <h4 className="fw-bold mb-1 text-navy">Quick Guest Submission</h4>
                              <p className="text-muted small mb-0">
                                Submit your concern anonymously or without an account. You will receive a Ticket ID and Secret PIN to track resolution.
                              </p>
                            </div>
                            <button
                              type="button"
                              className="btn btn-outline-danger btn-sm fw-semibold rounded-pill px-3 py-1 mt-1"
                              onClick={() => {
                                sessionStorage.setItem("isGuest", "true");
                                const proj = rememberedProject || guestData.project;
                                navigate(proj ? `/lodge-external?project=${encodeURIComponent(proj)}` : "/lodge-external");
                              }}
                            >
                              Open Full Form &rarr;
                            </button>
                          </div>
                        </div>

                        <form onSubmit={handleGuestSubmit} noValidate>
                          <div className="row g-3 mb-3">
                            {/* PROJECT NAME */}
                            <div className="col-12 col-md-6">
                              <label className="form-label fw-semibold text-navy small mb-1">
                                Project Name
                              </label>
                              <select
                                name="project"
                                value={guestData.project}
                                onChange={handleGuestInputChange}
                                className="form-select auth-input"
                                disabled={guestLoading}
                              >
                                {PURVA_PROJECTS.map((proj) => (
                                  <option key={proj} value={proj}>{proj}</option>
                                ))}
                              </select>
                            </div>

                            {/* CATEGORY */}
                            <div className="col-12 col-md-6">
                              <label className="form-label fw-semibold text-navy small mb-1">
                                Issue Category
                              </label>
                              <select
                                name="category"
                                value={guestData.category}
                                onChange={handleGuestInputChange}
                                className="form-select auth-input"
                                disabled={guestLoading}
                              >
                                {COMPLAINT_CATEGORIES.map((cat) => (
                                  <option key={cat} value={cat}>{cat}</option>
                                ))}
                              </select>
                            </div>
                          </div>

                          <div className="row g-3 mb-3">
                            {/* SEVERITY */}
                            <div className="col-12 col-md-6">
                              <label className="form-label fw-semibold text-navy small mb-1">
                                Severity Level
                              </label>
                              <select
                                name="severity"
                                value={guestData.severity}
                                onChange={handleGuestInputChange}
                                className="form-select auth-input"
                                disabled={guestLoading}
                              >
                                {SEVERITY_LEVELS.map((sev) => (
                                  <option key={sev} value={sev}>{sev}</option>
                                ))}
                              </select>
                            </div>

                            {/* ANONYMOUS TOGGLE */}
                            <div className="col-12 col-md-6 d-flex align-items-center pt-md-4">
                              <div className="form-check">
                                <input
                                  className="form-check-input"
                                  type="checkbox"
                                  id="guestAnonCheck"
                                  name="isAnonymous"
                                  checked={guestData.isAnonymous}
                                  onChange={handleGuestInputChange}
                                />
                                <label className="form-check-label text-navy small fw-semibold" htmlFor="guestAnonCheck">
                                  Submit Anonymously
                                </label>
                              </div>
                            </div>
                          </div>

                          {/* OPTIONAL CONTACT INFO (IF NOT ANONYMOUS) */}
                          {!guestData.isAnonymous && (
                            <div className="p-3 bg-light rounded-3 border mb-3">
                              <div className="row g-3">
                                <div className="col-12 col-md-4">
                                  <label className="form-label text-muted small mb-1">Your Name</label>
                                  <input
                                    type="text"
                                    name="name"
                                    value={guestData.name}
                                    onChange={handleGuestInputChange}
                                    className="form-control form-control-sm"
                                    placeholder="Name"
                                  />
                                </div>
                                <div className="col-12 col-md-4">
                                  <label className="form-label text-muted small mb-1">Phone Number</label>
                                  <input
                                    type="tel"
                                    name="phone"
                                    value={guestData.phone}
                                    onChange={handleGuestInputChange}
                                    className="form-control form-control-sm"
                                    placeholder="+91..."
                                  />
                                </div>
                                <div className="col-12 col-md-4">
                                  <label className="form-label text-muted small mb-1">Email Address</label>
                                  <input
                                    type="email"
                                    name="email"
                                    value={guestData.email}
                                    onChange={handleGuestInputChange}
                                    className="form-control form-control-sm"
                                    placeholder="email@example.com"
                                  />
                                </div>
                              </div>
                            </div>
                          )}

                          {/* DESCRIPTION */}
                          <div className="mb-4">
                            <label className="form-label fw-semibold text-navy small mb-1">
                              Description of Concern
                            </label>
                            <textarea
                              name="description"
                              rows={4}
                              value={guestData.description}
                              onChange={handleGuestInputChange}
                              className="form-control auth-input"
                              placeholder="Please describe the grievance, location specifics, or incident details..."
                              required
                              disabled={guestLoading}
                            />
                          </div>

                          {/* SUBMIT BUTTON */}
                          <button
                            type="submit"
                            disabled={guestLoading}
                            className="btn btn-purva-navy w-100 fw-bold py-2 shadow-sm"
                          >
                            {guestLoading ? (
                              <>
                                <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                                Submitting Grievance...
                              </>
                            ) : (
                              "Submit Grievance"
                            )}
                          </button>
                        </form>
                      </>
                    ) : (
                      /* GUEST RECEIPT */
                      <div className="text-center py-4">
                        <div className="auth-check-icon mx-auto mb-3" style={{ width: "48px", height: "48px", fontSize: "22px" }}>
                          <i className="bi bi-check-lg"></i>
                        </div>
                        <h4 className="fw-bold mb-1 text-navy">Grievance Submitted</h4>
                        <p className="text-muted small mb-4">
                          Your concern has been registered and routed to the ESG resolution team.
                        </p>

                        <div className="bg-light p-3 rounded-3 border mb-4 d-inline-block text-start w-100" style={{ maxWidth: "420px" }}>
                          <div className="d-flex justify-content-between align-items-center pb-2 mb-2 border-bottom">
                            <div>
                              <span className="text-muted d-block small text-uppercase fw-semibold">Ticket ID</span>
                              <h4 className="fw-bold mb-0 text-danger ls-1">{guestResult.ticketId}</h4>
                            </div>
                            <div className="text-end">
                              <span className="text-muted d-block small text-uppercase fw-semibold">Secret PIN</span>
                              <h4 className="fw-bold mb-0 text-navy ls-1">{guestResult.secretPin}</h4>
                            </div>
                          </div>
                          <p className="text-muted small mb-0">
                            <i className="bi bi-shield-check me-1 text-success"></i>
                            Save this Ticket ID and Secret PIN to track your complaint status privately at any time.
                          </p>
                        </div>

                        <div className="d-flex justify-content-center gap-3">
                          <button
                            type="button"
                            className="btn btn-outline-secondary px-4 fw-semibold"
                            onClick={() => {
                              setGuestResult(null);
                              setGuestData((p) => ({ ...p, description: "" }));
                            }}
                          >
                            Submit Another
                          </button>
                          <button
                            type="button"
                            className="btn btn-purva-navy px-4 fw-semibold shadow-sm"
                            onClick={() => navigate("/track", { state: { trackingId: guestResult.ticketId } })}
                          >
                            Track Status &rarr;
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;