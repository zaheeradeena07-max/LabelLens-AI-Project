
import { useEffect, useRef, useState } from "react";
import "./App.css";

const configuredApiBase = import.meta.env.VITE_API_BASE_URL?.replace(/\/+$/, "");
const API_BASE = configuredApiBase
  ? (configuredApiBase.endsWith("/api") ? configuredApiBase : `${configuredApiBase}/api`)
  : "/api";
const ALLERGENS = ["Peanuts", "Tree nuts", "Milk/dairy", "Eggs", "Soy", "Wheat", "Gluten", "Sesame", "Fish", "Shellfish"];
const DIETARY_PREFERENCES = ["Vegetarian", "Vegan", "Lactose-free", "Gluten-free"];
const emptyProfile = { allergens: [], otherAllergens: [], dietaryPreferences: [], customRestrictions: [], avoidIngredients: [], notes: "" };

function AuthScreen({ mode, setMode, onSubmit, busy, error }) {
  const registering = mode === "register";
  return <main className="auth-screen"><form className="auth-card" onSubmit={onSubmit}>
    <span className="brand-mark">L.</span><p className="eyebrow">LABEL LENS AI</p>
    <h1>{registering ? "Create your account" : "Welcome back"}</h1>
    <p>Save your food profile and get label checks tailored to your preferences.</p>
    {registering && <label>Your name<input name="name" autoComplete="name" required maxLength="100" /></label>}
    <label>Email<input name="email" type="email" autoComplete="email" required /></label>
    <label>Password<input name="password" type="password" autoComplete={registering ? "new-password" : "current-password"} minLength="8" maxLength="72" required /></label>
    {error && <p className="feedback-message error-message" role="alert">{error}</p>}
    <button className="primary-button" type="submit" disabled={busy}>{busy ? "Please wait…" : registering ? "Create account" : "Log in"}</button>
    <button className="text-button" type="button" onClick={() => setMode(registering ? "login" : "register")}>
      {registering ? "Already have an account? Log in" : "New to LabelLens? Create an account"}
    </button>
  </form></main>;
}

function ProfilePanel({ user, profile, setProfile, search, setSearch, onSave, saving, message }) {
  const [otherAllergensInput, setOtherAllergensInput] = useState((profile.otherAllergens || []).join(", "));
  const [restrictionsInput, setRestrictionsInput] = useState((profile.customRestrictions || []).join(", "));
  const [avoidInput, setAvoidInput] = useState((profile.avoidIngredients || []).join(", "));
  const toggle = (field, value) => setProfile((current) => ({
    ...current,
    [field]: current[field].includes(value) ? current[field].filter((item) => item !== value) : [...current[field], value],
  }));
  const listFrom = (value) => value.split(",").map((item) => item.trim()).filter(Boolean);
  return <section className="profile-page section-lavender">
    <div className="profile-heading"><div><p className="eyebrow">YOUR ACCOUNT</p><h1>{user.name}'s food profile</h1><p>{user.email}</p></div></div>
    <form className="profile-card" onSubmit={(event) => { event.preventDefault(); onSave(); }}>
      <section><h2>Allergens</h2><p>Select only allergens you have explicitly declared. These are checked separately from dietary preferences.</p>
        <label className="profile-search">Search allergens<input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find an allergen" /></label>
        <div className="profile-check-grid">{ALLERGENS.filter((item) => item.toLowerCase().includes(search.toLowerCase())).map((item) => <label className="profile-check" key={item}><input type="checkbox" checked={profile.allergens.includes(item)} onChange={() => toggle("allergens", item)} />{item}</label>)}</div>
        <label>Other allergens, separated by commas<input value={otherAllergensInput} onChange={(event) => { setOtherAllergensInput(event.target.value); setProfile((current) => ({ ...current, otherAllergens: listFrom(event.target.value) })); }} placeholder="e.g. mustard" /></label>
      </section>
      <section><h2>Dietary preferences</h2><p>These are compared with readable ingredient text. They are not allergy declarations.</p>
        <div className="profile-check-grid">{DIETARY_PREFERENCES.map((item) => <label className="profile-check" key={item}><input type="checkbox" checked={profile.dietaryPreferences.includes(item)} onChange={() => toggle("dietaryPreferences", item)} />{item}</label>)}</div>
        <label>Custom restrictions, separated by commas<input value={restrictionsInput} onChange={(event) => { setRestrictionsInput(event.target.value); setProfile((current) => ({ ...current, customRestrictions: listFrom(event.target.value) })); }} placeholder="e.g. no pork" /></label>
        <label>Ingredients you prefer to avoid<input value={avoidInput} onChange={(event) => { setAvoidInput(event.target.value); setProfile((current) => ({ ...current, avoidIngredients: listFrom(event.target.value) })); }} placeholder="e.g. palm oil, artificial colors" /></label>
      </section>
      <section><h2>Notes</h2><label>Optional notes<textarea maxLength="1000" rows="3" value={profile.notes || ""} onChange={(event) => setProfile((current) => ({ ...current, notes: event.target.value }))} placeholder="Anything else you want to remember" /></label></section>
      {message && <p className="profile-save-message" role="status">{message}</p>}
      <button className="primary-button" disabled={saving}>{saving ? "Saving…" : "Save food profile"}</button>
    </form>
  </section>;
}

const features = [
  {
    number: "01",
    title: "Ingredient Insight",
    description:
      "Understand what's inside your food with a simpler breakdown of ingredients.",
    icon: "✳",
    color: "peach",
  },
  {
    number: "02",
    title: "Nutrition at a Glance",
    description:
      "Explore calories, sugar, protein, fats, and other nutritional information.",
    icon: "◉",
    color: "blue",
  },
  {
    number: "03",
    title: "Allergen Awareness",
    description:
      "Identify declared allergens and ingredients that may need your attention.",
    icon: "✳",
    color: "lavender",
  },
  {
    number: "04",
    title: "Smarter Food Choices",
    description:
      "Compare label information with your preferences and dietary needs.",
    icon: "↗",
    color: "yellow",
  },
];

const preferences = DIETARY_PREFERENCES;

function App() {
  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const cameraStreamRef = useRef(null);
  const cameraRequestRef = useRef(0);
  const [user, setUser] = useState(null);
  const [csrfToken, setCsrfToken] = useState("");
  const [authMode, setAuthMode] = useState("login");
  const [authLoading, setAuthLoading] = useState(true);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState("");
  const [profile, setProfile] = useState(emptyProfile);
  const [profileSearch, setProfileSearch] = useState("");
  const [profilePage, setProfilePage] = useState(false);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMessage, setProfileMessage] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [preview, setPreview] = useState("");
  const preferencesSelected = profile.dietaryPreferences;
  const [scanStatus, setScanStatus] = useState("idle");
  const [error, setError] = useState("");
  const [analysis, setAnalysis] = useState(null);
  const [cameraState, setCameraState] = useState("closed");
  const [cameraError, setCameraError] = useState("");
  const [captureBusy, setCaptureBusy] = useState(false);
  const [captureSource, setCaptureSource] = useState("upload");

  useEffect(() => {
    if (cameraState === "live" && videoRef.current && cameraStreamRef.current) {
      videoRef.current.srcObject = cameraStreamRef.current;
      videoRef.current.play().catch(() => setCameraError("The camera preview could not start. Please try again."));
    }
  }, [cameraState]);

  useEffect(() => () => {
    cameraRequestRef.current += 1;
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  useEffect(() => {
    fetch(`${API_BASE}/auth/me`, { credentials: "include" })
      .then(async (response) => response.ok ? response.json() : null)
      .then((result) => {
        if (result?.user) {
          setUser(result.user);
          setProfile({ ...emptyProfile, ...(result.user.dietaryProfile || {}) });
          setCsrfToken(result.csrfToken || "");
        }
      })
      .catch(() => {})
      .finally(() => setAuthLoading(false));
  }, []);

  async function handleAuthSubmit(event) {
    event.preventDefault();
    setAuthBusy(true); setAuthError("");
    const form = new FormData(event.currentTarget);
    const endpoint = authMode === "register" ? "register" : "login";
    try {
      const response = await fetch(`${API_BASE}/auth/${endpoint}`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.get("name"), email: form.get("email"), password: form.get("password") }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.msg || "Could not sign in. Try again.");
      setUser(result.user); setProfile({ ...emptyProfile, ...(result.user.dietaryProfile || {}) });
      setCsrfToken(result.csrfToken || ""); setProfilePage(false);
    } catch (error) { setAuthError(error.message || "Could not reach the account service."); }
    finally { setAuthBusy(false); }
  }

  async function handleLogout() {
    stopCamera();
    try { await fetch(`${API_BASE}/auth/logout`, { method: "POST", credentials: "include" }); }
    finally {
      setUser(null); setCsrfToken(""); setProfile(emptyProfile); setProfilePage(false); setAnalysis(null); setScanStatus("idle"); setAuthMode("login");
      if (preview) URL.revokeObjectURL(preview);
      setPreview(""); setSelectedFile(null);
    }
  }

  async function saveProfile() {
    setProfileSaving(true); setProfileMessage("");
    try {
      const response = await fetch(`${API_BASE}/auth/profile`, {
        method: "PUT", credentials: "include", headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken }, body: JSON.stringify(profile),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.msg || "Could not save your profile.");
      setUser(result.user); setProfile({ ...emptyProfile, ...(result.user.dietaryProfile || {}) });
      setProfileMessage("Your food profile is saved to your account.");
    } catch (error) { setProfileMessage(error.message || "Could not reach the profile service."); }
    finally { setProfileSaving(false); }
  }

  if (authLoading) return <main className="auth-screen"><p role="status">Loading your account…</p></main>;
  if (!user) return <AuthScreen mode={authMode} setMode={(mode) => { setAuthMode(mode); setAuthError(""); }} onSubmit={handleAuthSubmit} busy={authBusy} error={authError} />;

  function handleFileChange(event) {
    const file = event.target.files?.[0];

    if (!file) return;

    setError("");
    setScanStatus("idle");
    setAnalysis(null);

    if (!file.type.startsWith("image/")) {
      setError("Please select an image file.");
      event.target.value = "";
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("Your image must be 5 MB or smaller.");
      event.target.value = "";
      return;
    }

    if (preview) URL.revokeObjectURL(preview);

    setSelectedFile(file);
    setPreview(URL.createObjectURL(file));
    setCaptureSource("upload");
  }

  function stopCamera() {
    cameraRequestRef.current += 1;
    cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
    cameraStreamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraState("closed");
  }

  async function startCamera() {
    setCameraError("");
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setCameraError("Camera access requires a supported browser on HTTPS or localhost. You can upload an image instead.");
      return;
    }
    const requestId = ++cameraRequestRef.current;
    setCameraState("opening");
    try {
      cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      });
      if (cameraRequestRef.current !== requestId) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      cameraStreamRef.current = stream;
      setCameraState("live");
    } catch (cameraFailure) {
      if (cameraRequestRef.current !== requestId) return;
      setCameraState("closed");
      if (cameraFailure.name === "NotAllowedError" || cameraFailure.name === "PermissionDeniedError") {
        setCameraError("Camera permission was denied. Allow camera access in your browser settings or upload an image.");
      } else if (cameraFailure.name === "NotFoundError" || cameraFailure.name === "DevicesNotFoundError") {
        setCameraError("No camera was found on this device. You can upload an image instead.");
      } else if (cameraFailure.name === "NotReadableError" || cameraFailure.name === "TrackStartError") {
        setCameraError("The camera is unavailable or being used by another app. Close that app and try again.");
      } else {
        setCameraError("The camera could not be opened. Check your browser permissions or upload an image instead.");
      }
    }
  }

  async function capturePhoto() {
    const video = videoRef.current;
    if (!video?.videoWidth || !video?.videoHeight) {
      setCameraError("The camera is still starting. Wait for the preview, then try Capture again.");
      return;
    }
    setCaptureBusy(true);
    setCameraError("");
    try {
      const nativeWidth = video.videoWidth;
      const nativeHeight = video.videoHeight;
      let scale = Math.min(1, 2560 / Math.max(nativeWidth, nativeHeight));
      let blob = null;
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(nativeWidth * scale));
        canvas.height = Math.max(1, Math.round(nativeHeight * scale));
        const context = canvas.getContext("2d");
        if (!context) throw new Error("This browser could not prepare the camera image.");
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", attempt === 0 ? 0.92 : 0.82));
        if (!blob) throw new Error("The camera image could not be captured. Please try again.");
        if (blob.size <= 5 * 1024 * 1024) break;
        blob = null;
        scale *= 0.82;
      }
      if (!blob) throw new Error("This photo is too large to analyze. Move closer to the label and retake it.");
      if (preview) URL.revokeObjectURL(preview);
      setSelectedFile(new File([blob], `labellens-camera-${Date.now()}.jpg`, { type: "image/jpeg" }));
      setPreview(URL.createObjectURL(blob));
      setCaptureSource("camera");
      setAnalysis(null); setError(""); setScanStatus("idle");
      stopCamera();
    } catch (captureFailure) {
      setCameraError(captureFailure.message || "Could not capture this frame. Please try again.");
    } finally { setCaptureBusy(false); }
  }

  function removeImage() {
    if (preview) URL.revokeObjectURL(preview);

    setSelectedFile(null);
    setPreview("");
    setScanStatus("idle");
    setError("");
    setAnalysis(null);
    setCaptureSource("upload");

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function retakePhoto() {
    removeImage();
    startCamera();
  }

  function togglePreference(preference) {
    setProfile((current) => ({ ...current, dietaryPreferences: current.dietaryPreferences.includes(preference)
      ? current.dietaryPreferences.filter((item) => item !== preference)
      : [...current.dietaryPreferences, preference] }));
    setProfileMessage("Unsaved changes — save them in your profile to use them in scans.");
  }

  async function handleScan() {
    if (!selectedFile) {
      setError("Upload a food-label image before starting your scan.");
      return;
    }

    setError("");
    setScanStatus("loading");
    setAnalysis(null);
    try {
      const body = new FormData();
      body.append("image", selectedFile);
      const response = await fetch(`${API_BASE}/upload`, {
        method: "POST", credentials: "include", headers: { "X-CSRF-Token": csrfToken }, body,
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || result.msg || `Analysis failed (${response.status}).`);
      setAnalysis(result);
      setScanStatus("complete");
    } catch (err) {
      setError(err.message || "Could not reach the analysis service. Check the backend connection and try again.");
      setScanStatus("error");
    }
  }

  function scrollToScanner() {
    if (profilePage) {
      setProfilePage(false);
      requestAnimationFrame(() => requestAnimationFrame(() => document.getElementById("scanner")?.scrollIntoView({ behavior: "smooth" })));
    } else document.getElementById("scanner")?.scrollIntoView({ behavior: "smooth" });
  }

  return (
    <div className="site-shell">
      <header className="topbar">
        <a className="brand" href="#home" aria-label="LabelLens AI home">
          <span className="brand-mark">L.</span>
          <span>LabelLens <span className="brand-ai">AI</span></span>
        </a>

        <nav className="navigation" aria-label="Main navigation">
          <a href="#about">About</a>
          <a href="#features">Features</a>
          <a href="#preferences">Your preferences</a>
        </nav>

        <div className="account-actions">
          <button className="text-button" onClick={() => setProfilePage((current) => !current)}>{profilePage ? "Dashboard" : "My profile"}</button>
          <button className="text-button" onClick={handleLogout}>Log out</button>
          <button className="nav-cta" onClick={scrollToScanner}>Scan a label <span>↗</span></button>
        </div>
      </header>

      {profilePage && <ProfilePanel user={user} profile={profile} setProfile={setProfile} search={profileSearch} setSearch={setProfileSearch} onSave={saveProfile} saving={profileSaving} message={profileMessage} />}
      <main hidden={profilePage}>
        <section className="hero section-peach" id="home">
          <div className="hero-copy">
            <p className="eyebrow">A FRESH PERSPECTIVE ON FOOD</p>
            <h1>
              Know what
              <br />
              you <em>eat.</em>
            </h1>
            <p className="hero-description">
              Food labels, without the confusion. Discover ingredients,
              understand nutrition, and make informed food choices.
            </p>
            <button className="primary-button" onClick={scrollToScanner}>
              Explore your food <span>↗</span>
            </button>
            <p className="micro-copy">
              YOUR FOOD. YOUR CHOICE. MORE CLARITY.
            </p>
          </div>

          <div className="hero-visual">
            <div className="hero-image-frame">
              <img
                src="/images/hero-food.jpg"
                alt="Fresh ingredients arranged for a healthy meal"
                onError={(event) => {
                  event.currentTarget.style.display = "none";
                }}
              />
              <div className="hero-image-placeholder">
                <span>Fresh choices</span>
                <span className="placeholder-fruit">◒ ✳ ◉</span>
              </div>
            </div>

            <div className="floating-note note-top">
              <span className="note-icon">✳</span>
              <span>
                <strong>Read beyond</strong>
                <small>the front of the pack</small>
              </span>
            </div>

            <div className="floating-note note-bottom">
              <span className="note-icon green-icon">✓</span>
              <span>
                <strong>Make it clearer</strong>
                <small>One label at a time</small>
              </span>
            </div>

            <span className="hero-stamp">GOOD FOOD<br />STARTS HERE</span>
          </div>

          <span className="hero-side-label">THE LABEL EDITION — 001</span>
        </section>

        <section className="intro section-cream" id="about">
          <div className="intro-heading">
            <p className="eyebrow">A LITTLE MORE CLARITY</p>
            <h2>
              Your food label,
              <br />
              <em>decoded.</em>
            </h2>
          </div>

          <div className="intro-content">
            <p>
              Ever picked up a product and wondered what all those ingredients
              actually mean? LabelLens AI helps you explore the information
              already printed on food packaging in a way that's easier to
              understand.
            </p>
            <a href="#features" className="text-link">
              Get to know LabelLens <span>↗</span>
            </a>
          </div>

          <div className="intro-gallery">
            <div className="gallery-image gallery-image-one">
              <img
                src="/images/nutrition-food.jpg"
                alt="Food ingredients and nutrition inspiration"
                onError={(event) => {
                  event.currentTarget.style.display = "none";
                }}
              />
              <span className="gallery-fallback">Eat with curiosity.</span>
            </div>

            <div className="gallery-caption">
              <span>LESS GUESSWORK</span>
              <span>MORE UNDERSTANDING ↗</span>
            </div>
          </div>
        </section>

        <section className="scanner-section section-blue" id="scanner">
          <div className="section-heading">
            <div>
              <p className="eyebrow">YOUR PERSONAL LABEL READER</p>
              <h2>
                Scan. Learn.
                <br />
                <em>Choose.</em>
              </h2>
            </div>
            <span className="section-number">01 / THE SCANNER</span>
          </div>

          <div className="scanner-layout">
            <div className="upload-panel">
              <div className="upload-panel-top">
                <span className="tiny-label">LABEL SCANNER</span>
                <span className="status-dot">● {cameraState === "live" ? "CAMERA LIVE" : cameraState === "opening" ? "OPENING CAMERA" : "READY"}</span>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                hidden
                aria-label="Choose a food-label image"
              />

              {cameraState === "live" ? (
                <div className="camera-stage">
                  <video ref={videoRef} className="camera-preview" autoPlay muted playsInline aria-label="Live camera preview of the food label" />
                  <p className="camera-hint">Hold the label steady and fill the frame with the text.</p>
                  <div className="camera-controls">
                    <button className="primary-button" type="button" onClick={capturePhoto} disabled={captureBusy}>{captureBusy ? "Preparing photo…" : "Capture Photo"}</button>
                    <button className="remove-button" type="button" onClick={() => { stopCamera(); setCameraError(""); }}>Cancel</button>
                  </div>
                </div>
              ) : cameraState === "opening" ? (
                <div className="camera-opening" role="status"><span className="loading-spinner" aria-hidden="true" /> Waiting for camera access…<button className="remove-button" type="button" onClick={() => { stopCamera(); setCameraError(""); }}>Cancel</button></div>
              ) : preview ? (
                <div className="preview-area">
                  <img
                    src={preview}
                    alt="Preview of the selected food label"
                    className="image-preview"
                  />
                  {captureSource === "camera"
                    ? <button className="remove-button" type="button" onClick={retakePhoto}>Retake Photo</button>
                    : <button className="remove-button" type="button" onClick={removeImage}>Remove image ×</button>}
                </div>
              ) : (
                <div className="upload-options">
                  <button className="upload-dropzone" type="button" onClick={() => fileInputRef.current?.click()}>
                    <span className="upload-icon">＋</span>
                    <strong>Upload an image</strong>
                    <span>Choose a clear photo of the ingredients or nutrition label.</span>
                    <span className="upload-action">Upload Image ↗</span>
                  </button>
                  <button className="camera-launch" type="button" onClick={startCamera}>
                    <span className="camera-icon" aria-hidden="true">◎</span>
                    <strong>Scan with Camera</strong>
                    <span>Open your camera and capture the label.</span>
                    <span className="upload-action">Use camera ↗</span>
                  </button>
                </div>
              )}

              {cameraError && <p className="feedback-message error-message" role="alert">{cameraError}</p>}

              <div className="upload-footer">
                <span>JPG · PNG · WEBP</span>
                <span>MAXIMUM 5 MB</span>
              </div>

              {error && (
                <p className="feedback-message error-message" role="alert">
                  {error}
                </p>
              )}

              <button
                className="primary-button scan-button"
                onClick={handleScan}
                disabled={!selectedFile || scanStatus === "loading"}
              >
                {scanStatus === "loading" ? "Analyzing label…" : captureSource === "camera" ? "Analyze Label" : "Start label scan"} <span>↗</span>
              </button>

              {scanStatus === "loading" && (
                <div className="feedback-message info-message" role="status" aria-live="polite">
                  <span className="loading-spinner" aria-hidden="true" /> Reading visible label text…
                </div>
              )}
              {analysis && (
                <div className="feedback-message info-message" role="status">
                  <strong>{analysis.status === "uncertain" ? "Some label text is uncertain" : analysis.analysis?.productName || "Label analysis"}</strong>
                  <p>{analysis.message}</p>
                  <div className="analysis-results">
                    <section><h4>Detected ingredients</h4>
                      {analysis.analysis?.detectedIngredients?.length ? <ul>{analysis.analysis.detectedIngredients.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}</ul> : <p>Unable to read an ingredient list reliably.</p>}
                      {analysis.analysis?.ingredientText && <details><summary>Extracted ingredient text</summary><p>{analysis.analysis.ingredientText}</p></details>}
                    </section>
                    <section><h4>Nutrition</h4><p><strong>Serving size:</strong> {analysis.analysis?.nutrition?.servingSize || "Not found in readable label text"}</p>
                      {[ ["calories", "Calories"], ["protein", "Protein"], ["total carbohydrate", "Carbohydrates"], ["total fat", "Fat"], ["total sugars", "Sugar"], ["sodium", "Sodium"] ].map(([key, label]) => <p key={key}><strong>{label}:</strong> {analysis.analysis?.nutrition?.values?.[key] || "Not found in readable label text"}</p>)}
                      {Object.entries(analysis.analysis?.nutrition?.values || {}).filter(([key]) => !["serving size", "calories", "protein", "total carbohydrate", "total fat", "total sugars", "sodium"].includes(key)).map(([key, value]) => <p key={key}><strong>{key}:</strong> {value || "unclear"}</p>)}</section>
                    <section><h4>Personal allergen matches</h4>{analysis.analysis?.allergenMatches?.length ? analysis.analysis.allergenMatches.map((item, index) => <p key={`${item.allergen}-${index}`}><strong>{item.allergen} · {item.status.replaceAll("_", " ")}</strong>: “{item.evidence}” ({item.source}). {item.note}</p>) : <p>{analysis.analysis?.ingredientText ? "No matching declared allergen detected in the readable text. This does not prove the food is allergen-free." : "Unable to determine allergen matches because ingredients were not readable."}</p>}</section>
                    <section><h4>Precautionary statements</h4>{analysis.analysis?.precautionaryStatements?.length ? analysis.analysis.precautionaryStatements.map((item, index) => <p key={index}>{item}</p>) : <p>No precautionary statement read.</p>}</section>
                    {analysis.analysis?.dietaryConflicts?.length > 0 && <section><h4>Dietary preference checks</h4>{analysis.analysis.dietaryConflicts.map((item, index) => <p key={`${item.preference}-${index}`}><strong>{item.preference} · {item.status.replaceAll("_", " ")}</strong>: {item.evidence}</p>)}</section>}
                    <section><h4>Summary</h4><p>{(analysis.analysis?.summary || "unable_to_determine").replaceAll("_", " ")}</p>{analysis.analysis?.limitations?.map((item, index) => <p key={index}>{item}</p>)}</section>
                    <details><summary>Extracted label text · OCR confidence {Math.round(analysis.confidence || 0)}%</summary><pre>{analysis.extractedText || "No readable text"}</pre></details>
                  </div>
                  <p className="analysis-note">OCR can misread small print. No match does not guarantee a food is safe for you. Confirm all details on the original package.</p>
                </div>
              )}
            </div>

            <div className="scanner-side">
              <p className="eyebrow">WHAT YOU'LL EXPLORE</p>
              <h3>Small print.<br /><em>Big picture.</em></h3>

              {features.slice(0, 3).map((feature) => (
                <div className="scanner-feature" key={feature.number}>
                  <span>{feature.number}</span>
                  <div>
                    <h4>{feature.title}</h4>
                    <p>{feature.description}</p>
                  </div>
                  <span className="feature-arrow">↗</span>
                </div>
              ))}

              <p className="disclaimer">
                LabelLens AI supports informed food choices. Always check the
                original packaging for allergen and dietary information.
              </p>
            </div>
          </div>
        </section>

        <section className="features-section section-lime" id="features">
          <div className="section-heading">
            <div>
              <p className="eyebrow">A CLOSER LOOK AT YOUR FOOD</p>
              <h2>
                The details
                <br />
                <em>matter.</em>
              </h2>
            </div>
            <span className="section-number">02 / THE DETAILS</span>
          </div>

          <div className="feature-grid">
            {features.map((feature) => (
              <article
                className={`feature-card card-${feature.color}`}
                key={feature.number}
              >
                <div className="feature-card-top">
                  <span>{feature.number}</span>
                  <span className="feature-card-icon">{feature.icon}</span>
                </div>
                <h3>{feature.title}</h3>
                <p>{feature.description}</p>
                <a href="#scanner" aria-label={`Explore ${feature.title}`}>
                  Explore feature <span>↗</span>
                </a>
              </article>
            ))}
          </div>

          <div className="feature-bottom-note">
            <span>INFORMATION THAT MAKES SENSE.</span>
            <span>DESIGNED AROUND YOUR EVERYDAY CHOICES.</span>
          </div>
        </section>

        <section className="preferences-section section-lavender" id="preferences">
          <div className="preferences-copy">
            <p className="eyebrow">MADE FOR YOUR WAY OF EATING</p>
            <h2>
              Your needs.
              <br />
              <em>Your choices.</em>
            </h2>
            <p>These saved preferences are compared with ingredients the scanner can read. Allergens are managed separately in your profile.</p>
          </div>

          <div className="preferences-panel">
            <div className="preferences-panel-heading">
              <span>MY FOOD PREFERENCES</span>
              <span>{String(preferencesSelected.length).padStart(2, "0")} SELECTED</span>
            </div>

            <div className="preference-options">
              {preferences.map((preference) => {
                const active = preferencesSelected.includes(preference);

                return (
                  <button
                    key={preference}
                    className={`preference-chip ${active ? "selected" : ""}`}
                    onClick={() => togglePreference(preference)}
                    aria-pressed={active}
                  >
                    <span>{active ? "✓" : "+"}</span>
                    {preference}
                  </button>
                );
              })}
            </div>

            <p className="preference-note">
              {preferencesSelected.length
                ? `Selected: ${preferencesSelected.join(", ")}`
                : "Choose one or more preferences to personalise your experience."}
            </p>

            <button
              className="primary-button preference-scan-button"
              onClick={() => setProfilePage(true)}
            >
              Edit full food profile <span>↗</span>
            </button>
            <button className="text-button" onClick={saveProfile} disabled={profileSaving}>{profileSaving ? "Saving…" : "Save preference changes"}</button>
          </div>
        </section>

        <section className="how-section section-cream">
          <div className="how-intro">
            <p className="eyebrow">THREE SIMPLE STEPS</p>
            <h2>
              A better way
              <br />
              to <em>read food.</em>
            </h2>
          </div>

          <div className="steps-list">
            <div className="step-item">
              <span>01</span>
              <div>
                <h3>Pick your product</h3>
                <p>Choose a clear image of the food label.</p>
              </div>
              <span className="step-symbol">↗</span>
            </div>
            <div className="step-item">
              <span>02</span>
              <div>
                <h3>Explore the details</h3>
                <p>Review ingredient and nutrition information when analysis is connected.</p>
              </div>
              <span className="step-symbol">↗</span>
            </div>
            <div className="step-item">
              <span>03</span>
              <div>
                <h3>Choose with confidence</h3>
                <p>Use label information alongside your own needs and preferences.</p>
              </div>
              <span className="step-symbol">↗</span>
            </div>
          </div>
        </section>

        <section className="closing-banner section-peach">
          <p className="eyebrow">A SMALL CHANGE IN HOW YOU SHOP</p>
          <h2>
            Get to know
            <br />
            what you <em>eat.</em>
          </h2>
          <button className="primary-button" onClick={scrollToScanner}>
            Let's scan a label <span>↗</span>
          </button>
          <span className="closing-decoration">L.</span>
        </section>
      </main>

      <footer className="footer">
        <a className="brand footer-brand" href="#home">
          <span className="brand-mark">L.</span>
          <span>LabelLens <span className="brand-ai">AI</span></span>
        </a>

        <p>Understand your food. Make informed choices.</p>

        <div className="footer-links">
          <a href="#about">About</a>
          <a href="#features">Features</a>
          <a href="#scanner">Scanner</a>
          <a href="#preferences">Preferences</a>
        </div>

        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} LabelLens AI</span>
          <a href="#home">BACK TO TOP ↑</a>
        </div>
      </footer>
    </div>
  );
}

export default App;
