"use client";

import Image from "next/image";
import { ChangeEvent, FormEvent, ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getApiUrl } from "@/lib/api";

type Role = "farmer" | "admin";

type User = {
  id: number;
  name: string;
  email: string;
  role: Role;
  farmName: string | null;
  location: string | null;
  preferredLanguage: string;
};

type DashboardData = {
  stats: {
    totalScans: number;
    healthyCrops: number;
    diseasedCrops: number;
    healthyRate: number;
    averageConfidence: number;
    openIssues: number;
  };
  diseaseStats: Array<{ label: string; count: number; percentage: number }>;
  cropStats: Array<{ label: string; count: number; percentage: number }>;
  riskCounts: { low: number; medium: number; high: number };
  recentUploads: HistoryItem[];
};

type Disease = {
  id: number;
  crop: string;
  name: string;
  slug: string;
  severityDefault: string;
  description: string;
  symptoms: string;
  cause: string;
  riskFactors: string;
  imageHints: string | null;
  organicTreatment: string | null;
  chemicalTreatment: string | null;
  preventionTips: string | null;
  scoutingTips: string | null;
  weatherRisk: string | null;
  createdAt: string;
};

type HistoryItem = {
  id: number;
  userId?: number;
  farmerName?: string;
  crop: string;
  prediction: string;
  confidence: number;
  severity: string;
  fieldLocation: string | null;
  notes: string | null;
  weatherRisk: string;
  status: string;
  imagePath: string;
  createdAt: string;
  diseaseDescription?: string | null;
  symptoms?: string | null;
  cause?: string | null;
  organicTreatment?: string | null;
  chemicalTreatment?: string | null;
  preventionTips?: string | null;
  description?: string;
  model?: string;
};

type ManagedUser = User & {
  scanCount: number;
  createdAt: string;
  lastLoginAt: string | null;
};

type PredictResult = {
  prediction: HistoryItem;
  disease: Disease | null;
  recommendation: {
    symptoms: string | null;
    cause: string | null;
    organicTreatment: string | null;
    chemicalTreatment: string | null;
    preventionTips: string | null;
    scoutingTips: string | null;
    weatherRisk: string | null;
  } | null;
};

type View = "dashboard" | "scan" | "history" | "diseases" | "admin";

const crops = ["Tomato", "Potato", "Pepper", "Corn", "Apple", "Grape"];
const severities = ["Low", "Medium", "High", "Critical"];
const statuses = ["Open", "In Review", "Resolved"];

const emptyDiseaseForm = {
  crop: "Tomato",
  name: "",
  severityDefault: "Medium",
  description: "",
  symptoms: "",
  cause: "",
  riskFactors: "",
  imageHints: "",
  organicTreatment: "",
  chemicalTreatment: "",
  preventionTips: "",
  scoutingTips: "",
  weatherRisk: "",
};

const translations = {
  en: {
    dashboard: "Dashboard",
    scan: "New scan",
    history: "History",
    diseases: "Disease DB",
    admin: "Admin",
  },
  es: {
    dashboard: "Panel",
    scan: "Nuevo análisis",
    history: "Historial",
    diseases: "Enfermedades",
    admin: "Admin",
  },
};

function classNames(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function formatDate(value?: string | null) {
  if (!value) return "Never";
  return new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function severityClass(severity: string) {
  const normalized = severity.toLowerCase();
  if (normalized === "critical") return "bg-rose-100 text-rose-700 ring-rose-200";
  if (normalized === "high") return "bg-orange-100 text-orange-700 ring-orange-200";
  if (normalized === "medium") return "bg-amber-100 text-amber-700 ring-amber-200";
  return "bg-emerald-100 text-emerald-700 ring-emerald-200";
}

function riskClass(risk: string) {
  if (risk === "High") return "bg-red-50 text-red-700";
  if (risk === "Medium") return "bg-yellow-50 text-yellow-700";
  return "bg-green-50 text-green-700";
}

function StatCard({ label, value, helper, tone }: { label: string; value: string | number; helper: string; tone: string }) {
  return (
    <div className="rounded-3xl border border-white/70 bg-white/90 p-5 shadow-sm backdrop-blur">
      <div className={classNames("mb-4 inline-flex rounded-2xl px-3 py-2 text-lg", tone)}>{helper}</div>
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-black tracking-tight text-slate-950">{value}</p>
    </div>
  );
}

function Badge({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <span className={classNames("inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ring-1", className)}>{children}</span>;
}

function EmptyState({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-dashed border-slate-300 bg-white/70 p-10 text-center">
      <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-emerald-100 text-2xl">🌱</div>
      <h3 className="text-lg font-black text-slate-950">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">{body}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

function LoadingPanel({ label }: { label: string }) {
  return (
    <div className="rounded-3xl bg-white p-8 shadow-sm">
      <div className="flex items-center gap-3 text-sm font-bold text-slate-600">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
        {label}
      </div>
      <div className="mt-6 grid gap-3">
        <div className="h-4 w-3/4 animate-pulse rounded bg-slate-100" />
        <div className="h-4 w-1/2 animate-pulse rounded bg-slate-100" />
        <div className="h-24 animate-pulse rounded-2xl bg-slate-100" />
      </div>
    </div>
  );
}

export default function PestScoutingApp() {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authForm, setAuthForm] = useState({ name: "", email: "farmer@demo.com", password: "password123", farmName: "", location: "", preferredLanguage: "en" });
  const [view, setView] = useState<View>("dashboard");
  const [booting, setBooting] = useState(true);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [diseases, setDiseases] = useState<Disease[]>([]);
  const [managedUsers, setManagedUsers] = useState<ManagedUser[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [scanForm, setScanForm] = useState({ crop: "Tomato", fieldLocation: "", notes: "" });
  const [predicting, setPredicting] = useState(false);
  const [predictionResult, setPredictionResult] = useState<PredictResult | null>(null);
  const [filters, setFilters] = useState({ search: "", crop: "All", severity: "All", status: "All" });
  const [diseaseForm, setDiseaseForm] = useState(emptyDiseaseForm);
  const [editingDiseaseId, setEditingDiseaseId] = useState<number | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const previewUrlRef = useRef<string | null>(null);

  const language = user?.preferredLanguage === "es" ? "es" : "en";
  const labels = translations[language];

  const showToast = useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 3200);
  }, []);

  const clearPreview = useCallback(() => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
    }
    previewUrlRef.current = null;
    setPreviewUrl(null);
  }, []);

  const api = async <T,>(path: string, options: RequestInit = {}) => {
    const response = await fetch(getApiUrl(path), {
      ...options,
      headers: {
        ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
      },
    });
    const data = (await response.json().catch(() => ({}))) as T & { error?: string };
    if (!response.ok) throw new Error(data.error || "Request failed");
    return data;
  };

  const loadAll = useCallback(async (nextToken?: string, nextUser?: User | null) => {
    const activeToken = nextToken ?? token;
    if (!activeToken && !nextUser) return;
    setLoading(true);
    try {
      const authHeaders = { Authorization: `Bearer ${activeToken}` };
      const [dashboardResponse, historyResponse, diseaseResponse] = await Promise.all([
        fetch(getApiUrl("/api/dashboard"), { headers: authHeaders }).then((res) => res.json()),
        fetch(getApiUrl("/api/history"), { headers: authHeaders }).then((res) => res.json()),
        fetch(getApiUrl("/api/diseases"), { headers: authHeaders }).then((res) => res.json()),
      ]);
      setDashboard(dashboardResponse);
      setHistory(historyResponse.history || []);
      setDiseases(diseaseResponse.diseases || []);

      const activeUser = nextUser || user;
      if (activeUser?.role === "admin") {
        const usersResponse = await fetch("/api/users", { headers: authHeaders }).then((res) => res.json());
        setManagedUsers(usersResponse.users || []);
      } else {
        setManagedUsers([]);
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Unable to load workspace");
    } finally {
      setLoading(false);
    }
  }, [showToast, token, user]);

  useEffect(() => {
    const restore = async () => {
      const stored = window.localStorage.getItem("pest-scout-token");
      if (!stored) {
        setBooting(false);
        return;
      }
      try {
        const response = await fetch("/api/me", { headers: { Authorization: `Bearer ${stored}` } });
        if (!response.ok) throw new Error("Session expired");
        const data = (await response.json()) as { user: User };
        setToken(stored);
        setUser(data.user);
        setScanForm((current) => ({ ...current, fieldLocation: data.user.location || "" }));
        await loadAll(stored, data.user);
      } catch {
        window.localStorage.removeItem("pest-scout-token");
      } finally {
        setBooting(false);
      }
    };
    void restore();
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, [loadAll]);

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
    };
  }, []);

  const filteredHistory = useMemo(() => {
    const search = filters.search.toLowerCase();
    return history.filter((item) => {
      const haystack = `${item.crop} ${item.prediction} ${item.fieldLocation || ""} ${item.notes || ""} ${item.farmerName || ""}`.toLowerCase();
      return (
        (!search || haystack.includes(search)) &&
        (filters.crop === "All" || item.crop === filters.crop) &&
        (filters.severity === "All" || item.severity === filters.severity) &&
        (filters.status === "All" || item.status === filters.status)
      );
    });
  }, [filters, history]);

  const handleAuth = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    try {
      const endpoint = authMode === "login" ? "/api/login" : "/api/register";
      const data = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(authForm),
      }).then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Authentication failed");
        return payload as { token: string; user: User };
      });
      setToken(data.token);
      setUser(data.user);
      window.localStorage.setItem("pest-scout-token", data.token);
      setScanForm((current) => ({ ...current, fieldLocation: data.user.location || "" }));
      showToast(`Welcome, ${data.user.name}`);
      await loadAll(data.token, data.user);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    window.localStorage.removeItem("pest-scout-token");
    setToken(null);
    setUser(null);
    setDashboard(null);
    setHistory([]);
    setDiseases([]);
    setManagedUsers([]);
    setPredictionResult(null);
    clearPreview();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    setCameraActive(false);
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      showToast("Please choose a valid crop leaf image.");
      return;
    }
    clearPreview();
    const nextUrl = URL.createObjectURL(file);
    previewUrlRef.current = nextUrl;
    setPreviewUrl(nextUrl);
    setSelectedFile(file);
    setPredictionResult(null);
  };

  const startCamera = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      showToast("Camera capture is not supported by this browser.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;
      setCameraActive(true);
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch {
      showToast("Unable to access camera. Check browser permissions.");
    }
  };

  const captureFrame = async () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
    if (!blob) return;
    clearPreview();
    const capturedFile = new File([blob], `camera-scout-${Date.now()}.jpg`, { type: "image/jpeg" });
    const nextUrl = URL.createObjectURL(capturedFile);
    previewUrlRef.current = nextUrl;
    setPreviewUrl(nextUrl);
    setSelectedFile(capturedFile);
    showToast("Camera frame captured for analysis.");
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraActive(false);
  };

  const submitPrediction = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedFile) {
      showToast("Upload or capture a crop leaf image first.");
      return;
    }
    const formData = new FormData();
    formData.append("image", selectedFile);
    formData.append("crop", scanForm.crop);
    formData.append("fieldLocation", scanForm.fieldLocation);
    formData.append("notes", scanForm.notes);
    setPredicting(true);
    try {
      const data = await api<PredictResult>("/api/predict", { method: "POST", body: formData });
      setPredictionResult(data);
      setHistory((current) => [{ ...data.prediction, farmerName: user?.name }, ...current]);
      setSelectedFile(null);
      clearPreview();
      setScanForm((current) => ({ ...current, notes: "" }));
      await loadAll();
      showToast("Scan complete. Recommendation generated.");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Prediction failed");
    } finally {
      setPredicting(false);
    }
  };

  const updateHistoryStatus = async (item: HistoryItem, status: string) => {
    const previous = history;
    setHistory((current) => current.map((entry) => (entry.id === item.id ? { ...entry, status } : entry)));
    try {
      await api(`/api/history/${item.id}`, { method: "PUT", body: JSON.stringify({ status, notes: item.notes }) });
      await loadAll();
    } catch (error) {
      setHistory(previous);
      showToast(error instanceof Error ? error.message : "Unable to update status");
    }
  };

  const deleteHistory = async (id: number) => {
    const previous = history;
    setHistory((current) => current.filter((item) => item.id !== id));
    try {
      await api(`/api/history/${id}`, { method: "DELETE" });
      await loadAll();
      showToast("History item deleted.");
    } catch (error) {
      setHistory(previous);
      showToast(error instanceof Error ? error.message : "Unable to delete history item");
    }
  };

  const saveDisease = async (event: FormEvent) => {
    event.preventDefault();
    const method = editingDiseaseId ? "PUT" : "POST";
    const endpoint = editingDiseaseId ? `/api/diseases/${editingDiseaseId}` : "/api/diseases";
    try {
      const response = await api<{ disease?: Disease; ok?: boolean }>(endpoint, { method, body: JSON.stringify(diseaseForm) });
      if (response.disease) setDiseases((current) => [response.disease!, ...current]);
      setDiseaseForm(emptyDiseaseForm);
      setEditingDiseaseId(null);
      await loadAll();
      showToast(editingDiseaseId ? "Disease updated." : "Disease added.");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Unable to save disease");
    }
  };

  const editDisease = (disease: Disease) => {
    setEditingDiseaseId(disease.id);
    setDiseaseForm({
      crop: disease.crop,
      name: disease.name,
      severityDefault: disease.severityDefault,
      description: disease.description,
      symptoms: disease.symptoms,
      cause: disease.cause,
      riskFactors: disease.riskFactors,
      imageHints: disease.imageHints || "",
      organicTreatment: disease.organicTreatment || "",
      chemicalTreatment: disease.chemicalTreatment || "",
      preventionTips: disease.preventionTips || "",
      scoutingTips: disease.scoutingTips || "",
      weatherRisk: disease.weatherRisk || "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const deleteDisease = async (id: number) => {
    const previous = diseases;
    setDiseases((current) => current.filter((item) => item.id !== id));
    try {
      await api(`/api/diseases/${id}`, { method: "DELETE" });
      showToast("Disease record deleted.");
    } catch (error) {
      setDiseases(previous);
      showToast(error instanceof Error ? error.message : "Unable to delete disease");
    }
  };

  const updateManagedUser = async (managedUser: ManagedUser, nextRole: Role) => {
    const previous = managedUsers;
    setManagedUsers((current) => current.map((item) => (item.id === managedUser.id ? { ...item, role: nextRole } : item)));
    try {
      await api(`/api/users/${managedUser.id}`, {
        method: "PUT",
        body: JSON.stringify({ ...managedUser, role: nextRole }),
      });
      showToast("User role updated.");
    } catch (error) {
      setManagedUsers(previous);
      showToast(error instanceof Error ? error.message : "Unable to update user");
    }
  };

  const deleteManagedUser = async (id: number) => {
    const previous = managedUsers;
    setManagedUsers((current) => current.filter((item) => item.id !== id));
    try {
      await api(`/api/users/${id}`, { method: "DELETE" });
      showToast("User deleted.");
    } catch (error) {
      setManagedUsers(previous);
      showToast(error instanceof Error ? error.message : "Unable to delete user");
    }
  };

  const downloadReport = (item: HistoryItem) => {
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>Scouting Report #${item.id}</title><style>body{font-family:Arial,sans-serif;margin:40px;color:#0f172a}h1{color:#047857}.card{border:1px solid #cbd5e1;border-radius:16px;padding:20px;margin:16px 0}.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}.label{font-size:12px;color:#64748b;text-transform:uppercase}.value{font-weight:700}</style></head><body><h1>Pest and Disease Scouting Report</h1><div class="card"><div class="grid"><p><span class="label">Crop</span><br><span class="value">${item.crop}</span></p><p><span class="label">Prediction</span><br><span class="value">${item.prediction}</span></p><p><span class="label">Confidence</span><br><span class="value">${item.confidence}%</span></p><p><span class="label">Severity</span><br><span class="value">${item.severity}</span></p><p><span class="label">Location</span><br><span class="value">${item.fieldLocation || "Not recorded"}</span></p><p><span class="label">Date</span><br><span class="value">${formatDate(item.createdAt)}</span></p></div></div><div class="card"><h2>Recommendations</h2><p><b>Symptoms:</b> ${item.symptoms || "Review the disease database for detailed symptoms."}</p><p><b>Cause:</b> ${item.cause || "Cause details unavailable."}</p><p><b>Organic treatment:</b> ${item.organicTreatment || "Use sanitation and approved biological controls."}</p><p><b>Chemical treatment:</b> ${item.chemicalTreatment || "Follow locally registered product labels."}</p><p><b>Prevention:</b> ${item.preventionTips || "Scout weekly and reduce leaf wetness."}</p></div><script>window.print()</script></body></html>`;
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `scouting-report-${item.id}.html`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (booting) {
    return (
      <main className="grid min-h-screen place-items-center bg-[radial-gradient(circle_at_top_left,#bbf7d0,transparent_35%),linear-gradient(135deg,#f8fafc,#ecfdf5)] p-6">
        <LoadingPanel label="Bootstrapping pest scouting workspace..." />
      </main>
    );
  }

  if (!user) {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,#bbf7d0,transparent_30%),linear-gradient(135deg,#f8fafc,#ecfdf5_55%,#f0fdf4)] px-5 py-8 text-slate-900">
        {toast ? <div className="fixed right-5 top-5 z-50 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-bold text-white shadow-2xl">{toast}</div> : null}
        <section className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div className="rounded-[2rem] border border-white/70 bg-white/75 p-8 shadow-2xl shadow-emerald-950/10 backdrop-blur md:p-12">
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-4 py-2 text-sm font-black text-emerald-700 ring-1 ring-emerald-200">🌿 ML-based crop health intelligence</div>
            <h1 className="mt-6 max-w-4xl text-4xl font-black tracking-tight text-slate-950 md:text-6xl">
              Pest and Disease Scouting System for modern farmers
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-650">
              Upload crop leaf images, get instant disease predictions with confidence, store scouting history, and receive actionable organic, chemical, and prevention recommendations.
            </p>
            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {["🌿 Detect pests and diseases using Machine Learning.", "📸 Upload or capture crop leaf images instantly.", "🤖 Predict diseases with confidence scores.", "💊 Provide treatment and prevention recommendations.", "📊 Track scouting history and analytics.", "📍 Record field location for inspections.", "🔐 Secure JWT authentication and roles.", "📄 Generate downloadable scouting reports."].map((feature) => (
                <div key={feature} className="rounded-2xl bg-white/90 p-4 text-sm font-bold text-slate-700 shadow-sm">{feature}</div>
              ))}
            </div>
          </div>

          <form onSubmit={handleAuth} className="rounded-[2rem] border border-white/80 bg-white p-6 shadow-2xl shadow-emerald-950/10 md:p-8">
            <div className="mb-6 flex rounded-2xl bg-slate-100 p-1 text-sm font-black">
              <button type="button" onClick={() => setAuthMode("login")} className={classNames("flex-1 rounded-xl px-4 py-3", authMode === "login" && "bg-white text-emerald-700 shadow")}>Login</button>
              <button type="button" onClick={() => setAuthMode("register")} className={classNames("flex-1 rounded-xl px-4 py-3", authMode === "register" && "bg-white text-emerald-700 shadow")}>Register</button>
            </div>
            <h2 className="text-2xl font-black text-slate-950">{authMode === "login" ? "Welcome back" : "Create farmer account"}</h2>
            <p className="mt-2 text-sm text-slate-500">Demo farmer: farmer@demo.com / password123 · Admin: admin@demo.com / admin123</p>
            <div className="mt-6 grid gap-4">
              {authMode === "register" ? (
                <>
                  <input className="rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-emerald-500" placeholder="Full name" value={authForm.name} onChange={(event) => setAuthForm({ ...authForm, name: event.target.value })} />
                  <input className="rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-emerald-500" placeholder="Farm name" value={authForm.farmName} onChange={(event) => setAuthForm({ ...authForm, farmName: event.target.value })} />
                  <input className="rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-emerald-500" placeholder="Field location" value={authForm.location} onChange={(event) => setAuthForm({ ...authForm, location: event.target.value })} />
                </>
              ) : null}
              <input className="rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-emerald-500" type="email" placeholder="Email" value={authForm.email} onChange={(event) => setAuthForm({ ...authForm, email: event.target.value })} />
              <input className="rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-emerald-500" type="password" placeholder="Password" value={authForm.password} onChange={(event) => setAuthForm({ ...authForm, password: event.target.value })} />
              {authMode === "register" ? (
                <select className="rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-emerald-500" value={authForm.preferredLanguage} onChange={(event) => setAuthForm({ ...authForm, preferredLanguage: event.target.value })}>
                  <option value="en">English</option>
                  <option value="es">Español</option>
                </select>
              ) : null}
            </div>
            <button disabled={loading} className="mt-6 w-full rounded-2xl bg-emerald-600 px-5 py-4 font-black text-white shadow-lg shadow-emerald-600/25 transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60">
              {loading ? "Please wait..." : authMode === "login" ? "Sign in securely" : "Create account"}
            </button>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <button type="button" className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-black text-slate-700" onClick={() => setAuthForm({ ...authForm, email: "farmer@demo.com", password: "password123" })}>Use farmer demo</button>
              <button type="button" className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-black text-slate-700" onClick={() => setAuthForm({ ...authForm, email: "admin@demo.com", password: "admin123" })}>Use admin demo</button>
            </div>
          </form>
        </section>
      </main>
    );
  }

  const navItems: Array<{ id: View; label: string; icon: string; adminOnly?: boolean }> = [
    { id: "dashboard", label: labels.dashboard, icon: "📊" },
    { id: "scan", label: labels.scan, icon: "📸" },
    { id: "history", label: labels.history, icon: "🧾" },
    { id: "diseases", label: labels.diseases, icon: "🧬" },
    { id: "admin", label: labels.admin, icon: "🛡️", adminOnly: true },
  ];

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,#dcfce7,transparent_28%),linear-gradient(135deg,#f8fafc,#eefbf3_60%,#f8fafc)] text-slate-900">
      {toast ? <div className="fixed right-5 top-5 z-50 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-bold text-white shadow-2xl">{toast}</div> : null}
      <div className="mx-auto flex max-w-[1600px] flex-col gap-5 p-4 lg:flex-row lg:p-6">
        <aside className="lg:sticky lg:top-6 lg:h-[calc(100vh-3rem)] lg:w-80">
          <div className="flex h-full flex-col rounded-[2rem] border border-white/80 bg-slate-950 p-5 text-white shadow-2xl shadow-slate-950/20">
            <div className="flex items-center gap-3">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-400 text-2xl">🌿</div>
              <div>
                <p className="text-sm font-black uppercase tracking-wide text-emerald-200">Pest Scout</p>
                <p className="text-xs text-slate-300">ML crop health system</p>
              </div>
            </div>
            <nav className="mt-8 grid gap-2">
              {navItems.filter((item) => !item.adminOnly || user.role === "admin").map((item) => (
                <button key={item.id} onClick={() => setView(item.id)} className={classNames("flex items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-black transition", view === item.id ? "bg-white text-slate-950 shadow" : "text-slate-300 hover:bg-white/10 hover:text-white")}>                  
                  <span>{item.icon}</span>
                  {item.label}
                </button>
              ))}
            </nav>
            <div className="mt-auto rounded-3xl bg-white/10 p-4">
              <p className="font-black">{user.name}</p>
              <p className="mt-1 text-xs text-slate-300">{user.email}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge className="bg-emerald-300/15 text-emerald-100 ring-emerald-300/30">{user.role}</Badge>
                <Badge className="bg-white/10 text-slate-100 ring-white/15">{user.preferredLanguage.toUpperCase()}</Badge>
              </div>
              <button onClick={logout} className="mt-4 w-full rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-950">Sign out</button>
            </div>
          </div>
        </aside>

        <section className="min-w-0 flex-1">
          <header className="mb-5 rounded-[2rem] border border-white/80 bg-white/80 p-5 shadow-sm backdrop-blur md:p-7">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm font-black uppercase tracking-wide text-emerald-700">Production scouting workspace</p>
                <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 md:text-5xl">{navItems.find((item) => item.id === view)?.label}</h1>
                <p className="mt-2 text-sm text-slate-600">{user.farmName || "Farm"} · {user.location || "Location not set"}</p>
              </div>
              <button onClick={() => void loadAll()} className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 shadow-sm hover:border-emerald-300">Refresh data</button>
            </div>
          </header>

          {loading && !dashboard ? <LoadingPanel label="Loading scouting data..." /> : null}
          {view === "dashboard" && dashboard ? (
            <div className="grid gap-5">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
                <StatCard label="Total scans" value={dashboard.stats.totalScans} helper="📸" tone="bg-emerald-100" />
                <StatCard label="Healthy crops" value={dashboard.stats.healthyCrops} helper="🌱" tone="bg-green-100" />
                <StatCard label="Diseased crops" value={dashboard.stats.diseasedCrops} helper="🦠" tone="bg-orange-100" />
                <StatCard label="Avg confidence" value={`${dashboard.stats.averageConfidence}%`} helper="🤖" tone="bg-indigo-100" />
                <StatCard label="Open issues" value={dashboard.stats.openIssues} helper="⚠️" tone="bg-rose-100" />
              </div>
              <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
                <div className="rounded-[2rem] bg-white p-6 shadow-sm">
                  <h2 className="text-xl font-black text-slate-950">Disease statistics</h2>
                  <div className="mt-5 grid gap-4">
                    {dashboard.diseaseStats.length ? dashboard.diseaseStats.map((item) => (
                      <div key={item.label}>
                        <div className="mb-2 flex items-center justify-between text-sm font-bold"><span>{item.label}</span><span>{item.count} scans · {item.percentage}%</span></div>
                        <div className="h-3 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-500" style={{ width: `${item.percentage}%` }} /></div>
                      </div>
                    )) : <EmptyState title="No scans yet" body="Upload a crop leaf image to start building analytics." />}
                  </div>
                </div>
                <div className="rounded-[2rem] bg-white p-6 shadow-sm">
                  <h2 className="text-xl font-black text-slate-950">Weather-based risk</h2>
                  <div className="mt-5 grid grid-cols-3 gap-3 text-center">
                    <div className="rounded-2xl bg-green-50 p-4"><p className="text-2xl font-black text-green-700">{dashboard.riskCounts.low}</p><p className="text-xs font-bold text-green-700">Low</p></div>
                    <div className="rounded-2xl bg-yellow-50 p-4"><p className="text-2xl font-black text-yellow-700">{dashboard.riskCounts.medium}</p><p className="text-xs font-bold text-yellow-700">Medium</p></div>
                    <div className="rounded-2xl bg-red-50 p-4"><p className="text-2xl font-black text-red-700">{dashboard.riskCounts.high}</p><p className="text-xs font-bold text-red-700">High</p></div>
                  </div>
                  <h3 className="mt-6 text-sm font-black uppercase text-slate-500">Crop coverage</h3>
                  <div className="mt-3 flex flex-wrap gap-2">{dashboard.cropStats.map((item) => <Badge key={item.label} className="bg-slate-100 text-slate-700 ring-slate-200">{item.label}: {item.count}</Badge>)}</div>
                </div>
              </div>
              <div className="rounded-[2rem] bg-white p-6 shadow-sm">
                <div className="mb-5 flex items-center justify-between"><h2 className="text-xl font-black text-slate-950">Recent uploads</h2><button onClick={() => setView("history")} className="text-sm font-black text-emerald-700">View all</button></div>
                <HistoryGrid items={dashboard.recentUploads} onDelete={deleteHistory} onStatus={updateHistoryStatus} onReport={downloadReport} compact />
              </div>
            </div>
          ) : null}

          {view === "scan" ? (
            <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
              <form onSubmit={submitPrediction} className="rounded-[2rem] bg-white p-6 shadow-sm">
                <h2 className="text-2xl font-black text-slate-950">Upload crop leaf image</h2>
                <p className="mt-2 text-sm text-slate-600">Supported formats: JPG, PNG, WEBP. Images are stored in the uploads folder and tied to your account.</p>
                <label className="mt-6 grid cursor-pointer place-items-center rounded-3xl border-2 border-dashed border-emerald-200 bg-emerald-50/60 p-8 text-center transition hover:bg-emerald-50">
                  <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleFileChange} />
                  <span className="text-4xl">📸</span>
                  <span className="mt-3 font-black text-slate-950">Choose leaf image</span>
                  <span className="mt-1 text-sm text-slate-500">or use real-time camera capture below</span>
                </label>
                {previewUrl ? <div className="mt-5 overflow-hidden rounded-3xl"><Image src={previewUrl} alt="Leaf preview" width={1200} height={800} className="h-64 w-full object-cover" unoptimized /></div> : null}
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <select className="rounded-2xl border border-slate-200 px-4 py-3" value={scanForm.crop} onChange={(event) => setScanForm({ ...scanForm, crop: event.target.value })}>{crops.map((crop) => <option key={crop}>{crop}</option>)}</select>
                  <input className="rounded-2xl border border-slate-200 px-4 py-3" placeholder="Field location" value={scanForm.fieldLocation} onChange={(event) => setScanForm({ ...scanForm, fieldLocation: event.target.value })} />
                </div>
                <textarea className="mt-4 min-h-24 w-full rounded-2xl border border-slate-200 px-4 py-3" placeholder="Inspection notes" value={scanForm.notes} onChange={(event) => setScanForm({ ...scanForm, notes: event.target.value })} />
                <button disabled={predicting} className="mt-5 w-full rounded-2xl bg-emerald-600 px-5 py-4 font-black text-white shadow-lg shadow-emerald-600/20 disabled:opacity-60">{predicting ? "Analyzing image..." : "Predict disease and save scan"}</button>
              </form>
              <div className="grid gap-5">
                <div className="rounded-[2rem] bg-slate-950 p-6 text-white shadow-sm">
                  <div className="flex items-center justify-between"><h2 className="text-xl font-black">Real-time camera capture</h2><Badge className="bg-white/10 text-white ring-white/20">Optional</Badge></div>
                  <video ref={videoRef} autoPlay playsInline muted className={classNames("mt-5 aspect-video w-full rounded-3xl bg-slate-900 object-cover", !cameraActive && "hidden")} />
                  {!cameraActive ? <div className="mt-5 grid aspect-video place-items-center rounded-3xl bg-white/10 text-center text-sm text-slate-300">Start camera to capture a field image.</div> : null}
                  <div className="mt-4 flex flex-wrap gap-3">
                    <button type="button" onClick={startCamera} className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-950">Start camera</button>
                    <button type="button" onClick={captureFrame} className="rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-black text-white">Capture</button>
                    <button type="button" onClick={stopCamera} className="rounded-2xl bg-white/10 px-4 py-3 text-sm font-black text-white">Stop</button>
                  </div>
                </div>
                {predictionResult ? (
                  <div className="rounded-[2rem] bg-white p-6 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm font-black uppercase text-emerald-700">Prediction result</p><h2 className="mt-1 text-3xl font-black text-slate-950">{predictionResult.prediction.prediction}</h2></div><Badge className={severityClass(predictionResult.prediction.severity)}>{predictionResult.prediction.severity}</Badge></div>
                    <div className="mt-5 grid gap-3 sm:grid-cols-3"><div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-bold text-slate-500">Confidence</p><p className="text-2xl font-black">{predictionResult.prediction.confidence}%</p></div><div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-bold text-slate-500">Crop</p><p className="text-2xl font-black">{predictionResult.prediction.crop}</p></div><div className={classNames("rounded-2xl p-4", riskClass(predictionResult.prediction.weatherRisk))}><p className="text-xs font-bold">Weather risk</p><p className="text-2xl font-black">{predictionResult.prediction.weatherRisk}</p></div></div>
                    <p className="mt-4 text-sm leading-6 text-slate-600">{predictionResult.prediction.description}</p>
                    {predictionResult.recommendation ? <RecommendationPanel recommendation={predictionResult.recommendation} /> : null}
                  </div>
                ) : <EmptyState title="No prediction yet" body="Upload or capture a crop leaf image to see disease name, confidence, severity, and recommendations." />}
              </div>
            </div>
          ) : null}

          {view === "history" ? (
            <div className="grid gap-5">
              <div className="rounded-[2rem] bg-white p-5 shadow-sm">
                <div className="grid gap-3 md:grid-cols-4">
                  <input className="rounded-2xl border border-slate-200 px-4 py-3" placeholder="Search history" value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} />
                  <select className="rounded-2xl border border-slate-200 px-4 py-3" value={filters.crop} onChange={(event) => setFilters({ ...filters, crop: event.target.value })}><option>All</option>{crops.map((crop) => <option key={crop}>{crop}</option>)}</select>
                  <select className="rounded-2xl border border-slate-200 px-4 py-3" value={filters.severity} onChange={(event) => setFilters({ ...filters, severity: event.target.value })}><option>All</option>{severities.map((severity) => <option key={severity}>{severity}</option>)}</select>
                  <select className="rounded-2xl border border-slate-200 px-4 py-3" value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}><option>All</option>{statuses.map((status) => <option key={status}>{status}</option>)}</select>
                </div>
              </div>
              <HistoryGrid items={filteredHistory} onDelete={deleteHistory} onStatus={updateHistoryStatus} onReport={downloadReport} />
            </div>
          ) : null}

          {view === "diseases" ? (
            <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
              {user.role === "admin" ? (
                <form onSubmit={saveDisease} className="rounded-[2rem] bg-white p-6 shadow-sm">
                  <h2 className="text-2xl font-black text-slate-950">{editingDiseaseId ? "Edit disease" : "Upload new disease information"}</h2>
                  <div className="mt-5 grid gap-3 sm:grid-cols-2"><select className="rounded-2xl border border-slate-200 px-4 py-3" value={diseaseForm.crop} onChange={(event) => setDiseaseForm({ ...diseaseForm, crop: event.target.value })}>{crops.map((crop) => <option key={crop}>{crop}</option>)}</select><input className="rounded-2xl border border-slate-200 px-4 py-3" placeholder="Disease name" value={diseaseForm.name} onChange={(event) => setDiseaseForm({ ...diseaseForm, name: event.target.value })} /></div>
                  <select className="mt-3 w-full rounded-2xl border border-slate-200 px-4 py-3" value={diseaseForm.severityDefault} onChange={(event) => setDiseaseForm({ ...diseaseForm, severityDefault: event.target.value })}>{severities.map((severity) => <option key={severity}>{severity}</option>)}</select>
                  {(["description", "symptoms", "cause", "riskFactors", "organicTreatment", "chemicalTreatment", "preventionTips", "scoutingTips", "weatherRisk"] as const).map((field) => <textarea key={field} className="mt-3 min-h-20 w-full rounded-2xl border border-slate-200 px-4 py-3" placeholder={field.replace(/([A-Z])/g, " $1")} value={diseaseForm[field]} onChange={(event) => setDiseaseForm({ ...diseaseForm, [field]: event.target.value })} />)}
                  <div className="mt-4 flex gap-3"><button className="rounded-2xl bg-emerald-600 px-5 py-3 font-black text-white">Save disease</button>{editingDiseaseId ? <button type="button" onClick={() => { setEditingDiseaseId(null); setDiseaseForm(emptyDiseaseForm); }} className="rounded-2xl border border-slate-200 px-5 py-3 font-black">Cancel</button> : null}</div>
                </form>
              ) : <EmptyState title="Disease database" body="Farmers can browse approved disease records and recommendations. Admins can add or update records." />}
              <div className="grid gap-4">
                {diseases.map((disease) => (
                  <article key={disease.id} className="rounded-[2rem] bg-white p-5 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm font-black uppercase text-emerald-700">{disease.crop}</p><h3 className="text-2xl font-black text-slate-950">{disease.name}</h3></div><Badge className={severityClass(disease.severityDefault)}>{disease.severityDefault}</Badge></div>
                    <p className="mt-3 text-sm leading-6 text-slate-600">{disease.description}</p>
                    <div className="mt-4 grid gap-3 md:grid-cols-2"><div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-black uppercase text-slate-500">Symptoms</p><p className="mt-1 text-sm text-slate-700">{disease.symptoms}</p></div><div className="rounded-2xl bg-slate-50 p-4"><p className="text-xs font-black uppercase text-slate-500">Cause</p><p className="mt-1 text-sm text-slate-700">{disease.cause}</p></div></div>
                    {user.role === "admin" ? <div className="mt-4 flex gap-3"><button onClick={() => editDisease(disease)} className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-black">Edit</button><button onClick={() => void deleteDisease(disease.id)} className="rounded-2xl bg-rose-50 px-4 py-2 text-sm font-black text-rose-700">Delete</button></div> : null}
                  </article>
                ))}
              </div>
            </div>
          ) : null}

          {view === "admin" && user.role === "admin" ? (
            <div className="grid gap-5">
              <div className="rounded-[2rem] bg-white p-6 shadow-sm"><h2 className="text-2xl font-black text-slate-950">Analytics overview</h2><p className="mt-2 text-slate-600">Admin analytics include all farmers, diseases, scan status, and open high-risk issues.</p><div className="mt-5 grid gap-4 sm:grid-cols-3"><StatCard label="Managed users" value={managedUsers.length} helper="👨‍🌾" tone="bg-blue-100" /><StatCard label="Disease records" value={diseases.length} helper="🧬" tone="bg-purple-100" /><StatCard label="All scans" value={dashboard?.stats.totalScans || 0} helper="📈" tone="bg-emerald-100" /></div></div>
              <div className="overflow-hidden rounded-[2rem] bg-white shadow-sm"><div className="border-b border-slate-100 p-6"><h2 className="text-2xl font-black text-slate-950">Manage users</h2></div><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-5 py-4">User</th><th className="px-5 py-4">Farm</th><th className="px-5 py-4">Role</th><th className="px-5 py-4">Scans</th><th className="px-5 py-4">Last login</th><th className="px-5 py-4">Actions</th></tr></thead><tbody>{managedUsers.map((managedUser) => <tr key={managedUser.id} className="border-t border-slate-100"><td className="px-5 py-4"><p className="font-black text-slate-950">{managedUser.name}</p><p className="text-slate-500">{managedUser.email}</p></td><td className="px-5 py-4">{managedUser.farmName || "—"}</td><td className="px-5 py-4"><select className="rounded-xl border border-slate-200 px-3 py-2" value={managedUser.role} onChange={(event) => void updateManagedUser(managedUser, event.target.value as Role)}><option value="farmer">farmer</option><option value="admin">admin</option></select></td><td className="px-5 py-4 font-black">{managedUser.scanCount}</td><td className="px-5 py-4">{formatDate(managedUser.lastLoginAt)}</td><td className="px-5 py-4"><button disabled={managedUser.id === user.id} onClick={() => void deleteManagedUser(managedUser.id)} className="rounded-xl bg-rose-50 px-3 py-2 font-black text-rose-700 disabled:opacity-40">Delete</button></td></tr>)}</tbody></table></div></div>
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}

function RecommendationPanel({ recommendation }: { recommendation: NonNullable<PredictResult["recommendation"]> }) {
  const entries = [
    ["Symptoms", recommendation.symptoms],
    ["Cause", recommendation.cause],
    ["Organic treatment", recommendation.organicTreatment],
    ["Chemical treatment", recommendation.chemicalTreatment],
    ["Prevention tips", recommendation.preventionTips],
    ["Scouting tips", recommendation.scoutingTips],
  ];
  return (
    <div className="mt-5 grid gap-3">
      {entries.map(([label, value]) => (
        <div key={label} className="rounded-2xl bg-emerald-50 p-4">
          <p className="text-xs font-black uppercase text-emerald-700">{label}</p>
          <p className="mt-1 text-sm leading-6 text-slate-700">{value || "Details are pending in the disease database."}</p>
        </div>
      ))}
    </div>
  );
}

function HistoryGrid({ items, onDelete, onStatus, onReport, compact = false }: { items: HistoryItem[]; onDelete: (id: number) => void; onStatus: (item: HistoryItem, status: string) => void; onReport: (item: HistoryItem) => void; compact?: boolean }) {
  if (!items.length) return <EmptyState title="No scouting records found" body="Try changing filters or upload a new crop image to create a prediction history record." />;
  return (
    <div className={classNames("grid gap-4", compact ? "xl:grid-cols-3" : "xl:grid-cols-2")}> 
      {items.map((item) => (
        <article key={item.id} className="overflow-hidden rounded-[2rem] bg-white shadow-sm ring-1 ring-slate-100">
          <div className="grid gap-0 sm:grid-cols-[180px_1fr]">
            <div className="h-52 bg-emerald-50 sm:h-full"><Image src={item.imagePath} alt={`${item.crop} ${item.prediction}`} width={600} height={400} className="h-full w-full object-cover" unoptimized onError={(event) => { const target = event.currentTarget as HTMLImageElement; target.style.display = "none"; }} /></div>
            <div className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-wide text-emerald-700">{item.crop} · {formatDate(item.createdAt)}</p><h3 className="mt-1 text-2xl font-black text-slate-950">{item.prediction}</h3>{item.farmerName ? <p className="mt-1 text-xs text-slate-500">Scout: {item.farmerName}</p> : null}</div><Badge className={severityClass(item.severity)}>{item.severity}</Badge></div>
              <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs font-bold"><div className="rounded-2xl bg-slate-50 p-3"><p className="text-slate-500">Confidence</p><p className="text-lg font-black text-slate-950">{item.confidence}%</p></div><div className={classNames("rounded-2xl p-3", riskClass(item.weatherRisk))}><p>Risk</p><p className="text-lg font-black">{item.weatherRisk}</p></div><div className="rounded-2xl bg-slate-50 p-3"><p className="text-slate-500">Status</p><p className="text-lg font-black text-slate-950">{item.status}</p></div></div>
              <p className="mt-4 text-sm text-slate-600">📍 {item.fieldLocation || "Location not recorded"}</p>
              {item.notes ? <p className="mt-2 text-sm text-slate-600">📝 {item.notes}</p> : null}
              <div className="mt-4 flex flex-wrap gap-2"><select value={item.status} onChange={(event) => onStatus(item, event.target.value)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold">{statuses.map((status) => <option key={status}>{status}</option>)}</select><button onClick={() => onReport(item)} className="rounded-xl bg-emerald-50 px-3 py-2 text-sm font-black text-emerald-700">Report</button><button onClick={() => onDelete(item.id)} className="rounded-xl bg-rose-50 px-3 py-2 text-sm font-black text-rose-700">Delete</button></div>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}
