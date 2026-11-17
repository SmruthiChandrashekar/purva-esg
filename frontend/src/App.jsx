import React from "react";
import AppRoutes from "./routes/AppRoutes";
import OfflineBanner from "./components/OfflineBanner";
import { isNewVersionError, reloadOnceForNewVersion } from "./utils/newVersionReload";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null, updating: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error, updating: isNewVersionError(error) };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Global Error Caught:", error, errorInfo);
    // Old tab after a new deploy: reload once to get the new version
    if (isNewVersionError(error) && reloadOnceForNewVersion()) return;
    this.setState({ errorInfo, updating: false });
  }

  render() {
    if (this.state.hasError && this.state.updating) {
      return (
        <div role="status" style={{ minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px", fontFamily: "sans-serif", color: "#142841", textAlign: "center" }}>
          Updating to the latest version…
        </div>
      );
    }
    if (this.state.hasError) {
      return (
        <div style={{ padding: "40px", fontFamily: "sans-serif", maxWidth: "800px", margin: "40px auto", backgroundColor: "#fff", border: "1px solid #fee2e2", borderRadius: "12px", boxShadow: "0 4px 20px rgba(0,0,0,0.1)" }}>
          <h2 style={{ color: "#b91c1c", marginBottom: "12px" }}>Application Error Encountered</h2>
          <p style={{ color: "#374151", marginBottom: "16px" }}>The following error was caught by the Error Boundary:</p>
          <pre style={{ backgroundColor: "#fef2f2", color: "#991b1b", padding: "16px", borderRadius: "8px", overflowX: "auto", fontSize: "14px", whiteSpace: "pre-wrap" }}>
            {this.state.error?.toString()}
          </pre>
          {this.state.errorInfo?.componentStack && (
            <details style={{ marginTop: "16px" }}>
              <summary style={{ cursor: "pointer", color: "#6b7280" }}>Component Stack</summary>
              <pre style={{ backgroundColor: "#f3f4f6", padding: "12px", borderRadius: "6px", fontSize: "12px", overflowX: "auto", whiteSpace: "pre-wrap" }}>
                {this.state.errorInfo.componentStack}
              </pre>
            </details>
          )}
          <button
            onClick={() => window.location.reload()}
            style={{ marginTop: "20px", padding: "10px 20px", backgroundColor: "#0284c7", color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer", fontWeight: 600 }}
          >
            Reload Page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function App() {
  return (
    <ErrorBoundary>
      <OfflineBanner />
      <AppRoutes />
    </ErrorBoundary>
  );
}

export default App;