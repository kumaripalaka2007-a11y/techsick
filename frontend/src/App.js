import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { BrowserRouter, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { ArrowUpRight, Briefcase, Check, ChevronRight, Code2, Copy, Download, Dumbbell, ExternalLink, FileText, Instagram, Linkedin, LogOut, MapPin, Menu, Palette, Play, Scale, Shirt, Sparkles, Users, UtensilsCrossed, X, Zap } from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { toast, Toaster } from "sonner";
import "@/App.css";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const sample = { profile: { username: "glossier", fullName: "Glossier", biography: "Beauty products inspired by real life. Shop the latest drops ↓", externalUrl: "https://glossier.com", followersCount: 2800000, postsCount: 1942, verified: true, isBusinessAccount: true, profilePicUrl: "https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=160&q=80" }, intelligence: { classification: "B2C E-Commerce", pillars: ["Organic skincare", "Serum", "Vegan beauty"], email: "hello@glossier.com", whatsapp: null, landing_page: "https://glossier.com", lead_score: 88, fit_label: "HIGH FIT", rationale: "Strong product-led content and clear conversion path.", signals: ["Verified business", "High-intent bio", "Retail-ready link"], niche_category: "Beauty & Skincare", niche_archetype: "Beauty DTC Brand", sub_niches: ["#SkincareRoutine", "#CleanBeauty", "#VeganBeauty"], palette: ["#f472b6", "#c084fc", "#fda4af", "#fef3c7"], visual_style_tags: ["Minimalist", "Pastel", "UGC-driven"], consistency_score: 86, hook_archetypes: [{ name: "Problem-Solution", share: 40 }, { name: "Storytelling", share: 35 }, { name: "Promotional", share: 25 }], content_mix: [{ label: "Tutorials", pct: 45 }, { label: "Reviews", pct: 30 }, { label: "Lifestyle", pct: 25 }], audience: { age_range: "18-34", interests: ["Skincare", "Wellness", "Self-care"], gender_split: { female: 78, male: 22 } }, buyer_persona: { demographics: "Women 18-34, urban, digitally native", pain_points: ["Sensitive skin concerns", "Ingredient transparency", "Routine simplicity"], buying_intent: "High — shops product drops directly from the bio link" }, sponsorship_readiness: "High", collab_fit_score: 91, pitch: "Hi Glossier team — love how your recent tutorials turn real skin routines into such approachable content. We help beauty brands convert engaged audiences into repeat customers with AI-driven profile intelligence: we spotted that your strongest hooks are problem-solution stories, and there's a clear opportunity to package that into creator collabs. Would a quick 15-minute walkthrough of what your audience signals reveal be useful this week?" }, analytics: { cadence_label: "5.1 posts/week", last_post_days_ago: 2, avg_likes: 42000, avg_comments: 380, engagement_rate: 1.51, comment_like_ratio: 0.9, owner_reply_rate: 4, consistency_score: 88, consistency_status: "Highly Consistent", consistency_note: "Steady multi-weekly posting with no gaps over 5 days.", engagement_tier: "Above Average", community_pulse: "High Trust & Questions", responsiveness: "Active Responder", location: { city: "New York", state: "NY", country: "United States", flag: "🇺🇸", confidence: "Medium" } } };
const Pill = ({ children, className = "" }) => <span className={`pill ${className}`} data-testid="insight-pill">{children}</span>;
const download = (text, type, name) => { const blob = new Blob([text], { type }); const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; a.click(); };
const copyText = async (text, label) => { try { await navigator.clipboard.writeText(text); toast.success(`${label} copied to clipboard`); } catch { toast.error("Copy failed — clipboard unavailable."); } };
const fmt = (n) => (n == null ? "—" : n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}K` : `${n}`);

const avatarSrc = (url) => {
  if (!url) return null;
  if (/scontent|cdninstagram|fbcdn|instagram\./.test(url)) return `${API}/proxy-image?url=${encodeURIComponent(url)}`;
  return url;
};

function Avatar({ url, name, size = 45 }) {
  const [failed, setFailed] = useState(false);
  const src = avatarSrc(url);
  if (!src || failed) {
    const initials = (name || "?").replace(/^@/, "").slice(0, 2).toUpperCase();
    return <div className="avatar-fallback" style={{ width: size, height: size }} data-testid="avatar-fallback">{initials}</div>;
  }
  return <img src={src} alt="Profile avatar" referrerPolicy="no-referrer" crossOrigin="anonymous" onError={() => setFailed(true)} data-testid="profile-avatar" style={{ width: size, height: size }} />;
}

const NICHE_THEMES = {
  "Tech & Dev": { gradient: "linear-gradient(120deg,#0ea5e9,#8b5cf6)", icon: Code2 },
  "Fitness & Wellness": { gradient: "linear-gradient(120deg,#f97316,#ec4899)", icon: Dumbbell },
  "Fashion & Lifestyle": { gradient: "linear-gradient(120deg,#d946ef,#f43f5e)", icon: Shirt },
  "Food & Local Business": { gradient: "linear-gradient(120deg,#f59e0b,#fb7185)", icon: UtensilsCrossed },
  "Creator & Art": { gradient: "linear-gradient(120deg,#22d3ee,#a855f7,#ec4899)", icon: Palette },
  "SaaS & B2B": { gradient: "linear-gradient(120deg,#6366f1,#00f5ff)", icon: Briefcase },
  "Beauty & Skincare": { gradient: "linear-gradient(120deg,#f472b6,#c084fc)", icon: Sparkles },
  Other: { gradient: "linear-gradient(120deg,#475569,#00f5ff)", icon: Zap },
};
const themeFor = (cat) => NICHE_THEMES[cat] || NICHE_THEMES.Other;

const exportReport = (data) => {
  const p = data.profile || {}; const i = data.intelligence || {};
  const win = window.open("", "_blank");
  if (!win) { toast.error("Allow pop-ups to download the report."); return; }
  const swatches = (i.palette || []).map((c) => `<span style="display:inline-block;width:46px;height:46px;background:${c};margin-right:8px;border-radius:6px;vertical-align:middle"></span>`).join("");
  win.document.write(`<html><head><title>TECH SICK Brand Health Audit — @${p.username || "profile"}</title><style>body{font-family:Georgia,serif;color:#111;max-width:680px;margin:40px auto;padding:0 20px}h1{font-size:26px;margin:0}h2{font-size:13px;text-transform:uppercase;letter-spacing:.12em;color:#666;margin:28px 0 8px;border-bottom:1px solid #ddd;padding-bottom:6px}p,li{font-size:13px;line-height:1.6}.meta{color:#666;font-size:12px}.scores{display:flex;gap:28px}.scores div{text-align:center}.scores strong{display:block;font-size:30px}.tag{display:inline-block;border:1px solid #999;border-radius:20px;padding:3px 10px;font-size:11px;margin:2px}.foot{margin-top:36px;font-size:11px;color:#888;border-top:1px solid #ddd;padding-top:10px}</style></head><body><h1>Brand Health Audit — @${p.username || "profile"}</h1><p class="meta">${p.fullName || ""} · ${i.niche_archetype || i.classification || ""} · Generated by TECH SICK on ${new Date().toLocaleDateString()}</p><div class="scores"><div><strong>${i.lead_score ?? "—"}</strong>Lead fit</div><div><strong>${i.consistency_score ?? "—"}</strong>Consistency</div><div><strong>${i.collab_fit_score ?? "—"}</strong>Collab fit</div><div><strong>${i.sponsorship_readiness || "—"}</strong>Sponsorship</div></div><h2>Classification & Pillars</h2><p>${i.classification || "—"}</p>${(i.pillars || []).map((t) => `<span class="tag">${t}</span>`).join("")}<h2>Visual Identity</h2><p>${swatches}</p><p>${(i.visual_style_tags || []).join(" · ")}</p><h2>Audience Snapshot</h2><p>Age ${i.audience?.age_range || "—"} · Interests: ${(i.audience?.interests || []).join(", ")} · Split: ${i.audience?.gender_split?.female ?? "—"}% F / ${i.audience?.gender_split?.male ?? "—"}% M</p><h2>Buyer Persona</h2><p>${i.buyer_persona?.demographics || "—"}</p><ul>${(i.buyer_persona?.pain_points || []).map((x) => `<li>${x}</li>`).join("")}</ul><p><b>Buying intent:</b> ${i.buyer_persona?.buying_intent || "—"}</p><h2>Analyst Rationale</h2><p>${i.rationale || "—"}</p><div class="foot">Developed by Team TECH SICK · contact@techsick.ai · Public data only</div></body></html>`);
  win.document.close(); win.focus(); setTimeout(() => win.print(), 400);
};

function AuthCallback() {
  const navigate = useNavigate();
  const hasProcessed = useRef(false);
  useEffect(() => {
    if (hasProcessed.current) return;
    hasProcessed.current = true;
    const sessionId = window.location.hash.split("session_id=")[1]?.split("&")[0];
    axios.post(`${API}/auth/session`, { session_id: sessionId }, { withCredentials: true })
      .then(({ data }) => { toast.success(`Welcome, ${data.name}`); navigate("/", { replace: true, state: { user: data } }); })
      .catch(() => { toast.error("Sign-in failed. Please try again."); navigate("/", { replace: true }); });
  }, [navigate]);
  return <div className="auth-callback" data-testid="auth-callback-screen"><span className="spinner light" />SIGNING YOU IN</div>;
}

function PitchModal({ pitch, onClose }) {
  return <div className="modal-overlay" onClick={onClose} data-testid="pitch-modal"><div className="modal-card" onClick={(e) => e.stopPropagation()}><div className="modal-head"><h3>AI Outreach Pitch</h3><button onClick={onClose} data-testid="pitch-close-button"><X size={16} /></button></div><p className="pitch-text" data-testid="pitch-text">{pitch}</p><button className="action-btn primary-action" onClick={() => copyText(pitch, "Pitch")} data-testid="pitch-copy-button"><Copy size={14} /> Copy pitch</button></div></div>;
}

function NicheBanner({ intel }) {
  const theme = themeFor(intel.niche_category); const Icon = theme.icon;
  return <div className="niche-banner" style={{ background: theme.gradient }} data-testid="niche-hero-banner"><div className="niche-left"><div className="niche-badge" data-testid="niche-archetype-badge"><Icon size={15} /> {intel.niche_archetype || "Emerging Creator"}</div><div className="niche-subs" data-testid="sub-niche-tags">{(intel.sub_niches || []).map((t) => <span key={t}>{t}</span>)}</div></div><div className="niche-right"><label>BRAND CONSISTENCY</label><strong data-testid="consistency-score">{intel.consistency_score ?? 82}<small>/100</small></strong></div></div>;
}

function DonutCard({ intel }) {
  const mix = intel.content_mix || sample.intelligence.content_mix;
  const colors = intel.palette?.length >= 3 ? intel.palette : ["#00f5ff", "#a855f7", "#ec4899", "#f59e0b"];
  return <div className="widget-card" data-testid="content-pillars-donut"><label>CONTENT PILLARS MIX</label><ResponsiveContainer width="100%" height={150}><PieChart><Pie data={mix} dataKey="pct" nameKey="label" innerRadius={44} outerRadius={66} paddingAngle={3} stroke="none">{mix.map((entry, idx) => <Cell key={entry.label} fill={colors[idx % colors.length]} />)}</Pie><Tooltip contentStyle={{ background: "#0b111e", border: "1px solid rgba(255,255,255,.12)", fontSize: 11 }} /></PieChart></ResponsiveContainer><div className="donut-legend">{mix.map((m, idx) => <div key={m.label}><span style={{ background: colors[idx % colors.length] }} />{m.label}<b>{m.pct}%</b></div>)}</div></div>;
}

function HooksCard({ intel }) {
  const hooks = intel.hook_archetypes || sample.intelligence.hook_archetypes;
  return <div className="widget-card" data-testid="hook-archetypes-card"><label>HOOK ARCHETYPES</label>{hooks.map((h) => <div className="hook-row" key={h.name}><div className="hook-top"><span>{h.name}</span><b>{h.share}%</b></div><div className="hook-track"><div className="hook-fill" style={{ width: `${h.share}%` }} /></div></div>)}<div className="style-tags">{(intel.visual_style_tags || []).map((t) => <Pill key={t}>{t}</Pill>)}</div></div>;
}

function PaletteCard({ intel }) {
  return <div className="widget-card" data-testid="palette-swatches"><label>BRAND PALETTE</label><div className="palette-row">{(intel.palette || sample.intelligence.palette).map((c) => <div className="palette-swatch" key={c}><i style={{ background: c }} /><span>{c}</span></div>)}</div></div>;
}

function AudienceCard({ intel }) {
  const aud = intel.audience || sample.intelligence.audience; const f = aud.gender_split?.female ?? 50; const m = aud.gender_split?.male ?? 50;
  return <div className="widget-card" data-testid="audience-snapshot"><label>TARGET AUDIENCE SNAPSHOT</label><div className="badge-row"><span className="aud-badge" data-testid="audience-age"><Users size={12} /> {aud.age_range}</span>{(aud.interests || []).map((x) => <span className="aud-badge" key={x}>{x}</span>)}</div><div className="gender-bar" data-testid="gender-split-bar"><span className="f" style={{ width: `${f}%` }} /><span className="m" style={{ width: `${m}%` }} /></div><div className="gender-labels"><span>{f}% FEMALE</span><span>{m}% MALE</span></div></div>;
}

function PersonaCard({ intel }) {
  const persona = intel.buyer_persona || sample.intelligence.buyer_persona;
  return <div className="widget-card persona-card" data-testid="buyer-persona-card"><label>AI BUYER PERSONA</label><p>{persona.demographics}</p><ul>{(persona.pain_points || []).map((x) => <li key={x}>{x}</li>)}</ul><span className="intent-tag" data-testid="buying-intent">{persona.buying_intent}</span></div>;
}

function CollabCard({ intel }) {
  const score = intel.collab_fit_score ?? 80; const ready = (intel.sponsorship_readiness || "Medium").toLowerCase();
  return <div className="widget-card" data-testid="collab-fit-card"><label>MONETIZATION & COLLAB FIT</label><span className="collab-score" data-testid="collab-fit-score">{score}<small style={{ fontSize: 13, color: "#8f9bb0" }}>/100</small></span><div className="progress-track" data-testid="collab-fit-bar"><div className="progress-fill" style={{ width: `${score}%` }} /></div><span className={`readiness-pill readiness-${ready}`} data-testid="sponsorship-readiness">{intel.sponsorship_readiness || "Medium"} SPONSORSHIP READINESS</span></div>;
}

function AnalyticsSection({ analytics }) {
  const a = analytics || {};
  const loc = a.location || {};
  const statusColor = a.consistency_status === "Highly Consistent" ? "#60e6a4" : a.consistency_status === "Inactive" ? "#f47d91" : "#fbbf24";
  const tierClass = ["Exceptional", "Above Average"].includes(a.engagement_tier) ? "high" : a.engagement_tier === "Below Average" ? "low" : "medium";
  const confClass = (loc.confidence || "Low").toLowerCase();
  return <div className="widgets-grid" data-testid="community-consistency-card"><div className="widget-card" data-testid="consistency-gauge-card"><label>POSTING CONSISTENCY</label><div className="score-ring small" style={{ "--score": `${(a.consistency_score || 0) * 3.6}deg`, "--scoreColor": statusColor }}><div><strong data-testid="consistency-gauge">{a.consistency_score ?? "—"}</strong><small>/100</small></div></div><div className="status-badge" style={{ color: statusColor }} title={a.consistency_note || ""} data-testid="consistency-status-badge"><span className="dot" style={{ background: statusColor }} />{a.consistency_status || "Unknown"}</div><div className="cadence-label" data-testid="cadence-label">{a.cadence_label || "Unknown"}{a.last_post_days_ago != null ? ` · last post ${a.last_post_days_ago}d ago` : ""}</div>{a.consistency_note && <p className="note">{a.consistency_note}</p>}</div><div className="widget-card" data-testid="audience-connection-card"><label>AUDIENCE CONNECTION</label><div className="engage-head"><span className="collab-score" data-testid="engagement-rate">{a.engagement_rate ?? "—"}<small style={{ fontSize: 13, color: "#8f9bb0" }}>%</small></span><span className={`readiness-pill readiness-${tierClass}`} data-testid="engagement-tier">{a.engagement_tier || "Unknown"}</span></div><div className="metric-lines"><div><span>Avg likes / post</span><b>{fmt(a.avg_likes)}</b></div><div><span>Avg comments / post</span><b>{fmt(a.avg_comments)}</b></div><div><span>Comment-to-like ratio</span><b data-testid="comment-like-ratio">{a.comment_like_ratio != null ? `${a.comment_like_ratio}%` : "—"}</b></div></div><div className="style-tags"><span data-testid="community-pulse"><Pill className="cyan">{a.community_pulse || "No signal"}</Pill></span><span data-testid="responsiveness-indicator"><Pill>{a.responsiveness || "Unknown"}</Pill></span></div></div><div className="widget-card" data-testid="location-card"><label>SMART LOCATION</label><div className="loc-line" data-testid="location-badge"><MapPin size={16} />{[loc.city, loc.state, loc.country].filter(Boolean).join(", ") || "Not detected"} {loc.flag || ""}</div><span className={`readiness-pill readiness-${confClass}`} data-testid="location-confidence">{(loc.confidence || "Low").toUpperCase()} CONFIDENCE</span>{loc.city && <p className="note">Aggregated from bio, external links and recent post geotags.</p>}</div></div>;
}

function ComparePanel({ entries }) {
  const grid = { gridTemplateColumns: `1fr repeat(${entries.length}, 1.2fr)` };
  const num = (v) => (typeof v === "number" ? v : -1);
  const metrics = [["Lead score", (d) => d.intelligence.lead_score], ["Brand consistency", (d) => d.intelligence.consistency_score], ["Collab fit", (d) => d.intelligence.collab_fit_score], ["Followers", (d) => d.profile.followersCount], ["Total posts", (d) => d.profile.postsCount]];
  const textRows = [["Niche", (d) => d.intelligence.niche_archetype || "—"], ["Sponsorship", (d) => d.intelligence.sponsorship_readiness || "—"], ["Top themes", (d) => (d.intelligence.pillars || []).join(", ")]];
  return <div className="compare-panel" data-testid="comparison-panel"><div className="compare-head" style={grid}><span>METRIC</span>{entries.map((d, i) => <span key={d.profile.username} data-testid={`compare-handle-${i}`}>@{d.profile.username}</span>)}</div>{metrics.map(([label, get]) => { const vals = entries.map(get); const best = Math.max(...vals.map(num)); return <div className="compare-line" style={grid} key={label}><span>{label}</span>{vals.map((v, i) => <span key={entries[i].profile.username} className={num(v) === best && num(v) > -1 ? "win" : ""}>{fmt(v)}</span>)}</div>; })}{textRows.map(([label, get]) => <div className="compare-line" style={grid} key={label}><span>{label}</span>{entries.map((d) => <span key={d.profile.username}>{get(d)}</span>)}</div>)}</div>;
}

function ProfileCard({ data, onPitch, onCompare }) {
  const p = data.profile || sample.profile; const intel = data.intelligence || sample.intelligence; const score = intel.lead_score || 88;
  const csvRow = `${p.username || ""},${intel.classification || ""},${score},${intel.email || ""},${intel.landing_page || ""},${intel.niche_archetype || ""},${intel.collab_fit_score ?? ""}`;
  return <section id="live-analyzer" className="section analyzer-section" data-testid="profile-intelligence-dashboard"><div className="section-kicker"><span className="eyebrow-dot" /> LIVE PROFILE INTELLIGENCE <span className="live-dot" data-testid="analysis-live-indicator" /></div><div className="analyzer-head"><div><h2>From public signal<br /><em>to clear next move.</em></h2><p>Structured context your growth team can actually act on.</p></div><span className="mono-label">RUN / 007</span></div><div className="dashboard-card glass-card"><div className="profile-top"><div className="avatar-ring story-ring"><Avatar url={p.profile_pic_url || p.profilePicUrlHD || p.profilePicUrl} name={p.username || "glossier"} size={50} /></div><div className="profile-identity"><div className="handle" data-testid="profile-handle">@{p.username || "glossier"} {p.verified && <Check size={15} className="verified" />}</div><div className="fullname" data-testid="profile-full-name">{p.fullName || "Public profile"}</div>{(data.analytics || sample.analytics)?.location?.city && <span className="loc-mini" data-testid="location-badge-mini"><MapPin size={11} /> {[(data.analytics || sample.analytics).location.city, (data.analytics || sample.analytics).location.country].filter(Boolean).join(", ")} {(data.analytics || sample.analytics).location.flag}</span>}<p data-testid="profile-biography">{p.biography || "No public bio returned."}</p></div><Pill className="cyan">{intel.classification || "B2C E-Commerce"}</Pill></div><NicheBanner intel={intel} /><div className="dashboard-grid"><div className="intel-block"><label>PRODUCT & CONTENT PILLARS</label><div className="tag-cloud">{(intel.pillars || sample.intelligence.pillars).map((tag) => <Pill key={tag}>{tag}</Pill>)}</div><label className="mt">PARSED CONTACTS</label><div className="contact-list"><div><span className="contact-icon">@</span><span data-testid="profile-email">{intel.email || "Not found"}</span></div><div><span className="contact-icon">↗</span><a href={intel.landing_page || "#"} target="_blank" rel="noreferrer" data-testid="profile-landing-page">{intel.landing_page || "No link resolved"}</a></div></div></div><div className="score-block"><label>LEAD FIT SCORE</label><div className="score-ring" style={{ "--score": `${score * 3.6}deg` }}><div><strong data-testid="lead-score">{score}</strong><small>/ 100</small></div></div><div className="fit-label" data-testid="lead-fit-label">{intel.fit_label || "HIGH FIT"}</div><p>{intel.rationale || sample.intelligence.rationale}</p></div></div><div className="widgets-grid"><DonutCard intel={intel} /><HooksCard intel={intel} /><PaletteCard intel={intel} /><AudienceCard intel={intel} /><PersonaCard intel={intel} /><CollabCard intel={intel} /></div><AnalyticsSection analytics={data.analytics || sample.analytics} /><div className="dashboard-actions"><button className="action-btn" onClick={() => download(JSON.stringify(data, null, 2), "application/json", "tech-sick-profile.json")} data-testid="export-json-button"><Code2 size={16} /> Export JSON</button><button className="action-btn" onClick={() => download(`handle,classification,lead_score,email,landing_page,niche,collab_fit\n${csvRow}`, "text/csv", "tech-sick-profile.csv")} data-testid="export-csv-button"><Download size={16} /> Download CSV</button><button className="action-btn" onClick={() => copyText(`handle\tclassification\tlead_score\temail\tlanding_page\tniche\tcollab_fit\n${csvRow.replace(/,/g, "\t")}`, "Airtable/Notion row")} data-testid="copy-crm-tsv-button"><Copy size={14} /> Copy for Airtable/Notion</button><button className="action-btn" onClick={() => copyText(csvRow, "CRM CSV row")} data-testid="copy-crm-csv-button"><Copy size={14} /> Copy CSV row</button><button className="action-btn" onClick={() => exportReport(data)} data-testid="report-export-button"><FileText size={16} /> Report PDF</button><button className="action-btn" onClick={onCompare} data-testid="compare-toggle-button"><Scale size={15} /> Compare</button><button className="action-btn" onClick={onPitch} data-testid="pitch-button"><Sparkles size={15} /> AI Pitch</button><button className="action-btn primary-action" onClick={() => toast.success("CRM delivery queue is ready for your webhook")} data-testid="push-crm-button"><Zap size={16} /> Push to CRM <ArrowUpRight size={14} /></button></div></div></section>;
}

function Home() {
  const location = useLocation();
  const [url, setUrl] = useState(""); const [result, setResult] = useState(sample); const [loading, setLoading] = useState(false); const [mobileOpen, setMobileOpen] = useState(false); const [codeTab, setCodeTab] = useState("JSON OUTPUT");
  const [user, setUser] = useState(location.state?.user || null); const [authChecked, setAuthChecked] = useState(false);
  const [pitchOpen, setPitchOpen] = useState(false); const [compareOpen, setCompareOpen] = useState(false);
  const [urlB, setUrlB] = useState(""); const [competitors, setCompetitors] = useState([]); const [loadingB, setLoadingB] = useState(false);
  const authCheckedOnce = useRef(false);
  useEffect(() => {
    if (authCheckedOnce.current) return;
    authCheckedOnce.current = true;
    if (location.state?.user) { setAuthChecked(true); return; }
    axios.get(`${API}/auth/me`, { withCredentials: true }).then(({ data }) => setUser(data)).catch(() => {}).finally(() => setAuthChecked(true));
  }, [location.state]);
  // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
  const signIn = () => {
    const redirectUrl = window.location.origin;
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };
  const logout = async () => {
    try { await axios.post(`${API}/auth/logout`, {}, { withCredentials: true }); } catch { /* session already cleared */ }
    setUser(null); toast.success("Signed out");
  };
  const runAnalysis = async (target) => {
    const { data } = await axios.post(`${API}/analyze`, { profile_url: target }, { withCredentials: true });
    return data;
  };
  const guardAuth = () => {
    if (!authChecked) return false;
    if (!user) { toast("Sign in with Google to run a live analysis."); signIn(); return false; }
    return true;
  };
  const analyze = async () => {
    if (!url.trim()) { toast.error("Enter a public Instagram profile URL or handle first."); return; }
    if (!guardAuth()) return;
    setLoading(true);
    try {
      const data = await runAnalysis(url);
      setResult(data); setCompetitors([]); toast.success("Profile intelligence ready");
      document.getElementById("live-analyzer")?.scrollIntoView({ behavior: "smooth" });
    } catch (error) {
      if (error.response?.status === 401) { setUser(null); toast.error("Session expired — please sign in again."); }
      else toast.error(error.response?.data?.detail || "The live analyzer could not reach the public profile.");
    } finally { setLoading(false); }
  };
  const analyzeCompetitor = async () => {
    if (!urlB.trim()) { toast.error("Enter a competitor handle to compare."); return; }
    if (competitors.length >= 3) { toast.error("Batch compare supports up to 3 competitors at once."); return; }
    if (!guardAuth()) return;
    setLoadingB(true);
    try {
      const data = await runAnalysis(urlB);
      if (data.profile.username === result.profile?.username || competitors.some((c) => c.profile.username === data.profile.username)) {
        toast.error("That profile is already in the comparison.");
      } else {
        setCompetitors([...competitors, data]); setUrlB(""); toast.success(`@${data.profile.username} added to comparison`);
      }
    } catch (error) {
      if (error.response?.status === 401) { setUser(null); toast.error("Session expired — please sign in again."); }
      else toast.error(error.response?.data?.detail || "Could not analyze the competitor profile.");
    } finally { setLoadingB(false); }
  };
  return <div className="app-shell"><div className="ambient ambient-one" /><div className="ambient ambient-two" /><nav className="nav" data-testid="main-navigation"><a href="#top" className="brand" data-testid="brand-link"><span className="brand-mark">TS</span><span>TECH SICK</span></a><span className="brand-badge">NEXT-GEN SOCIAL INTELLIGENCE</span><div className={`nav-links ${mobileOpen ? "open" : ""}`}><a href="#features" data-testid="features-nav-link">Features</a><a href="#architecture" data-testid="architecture-nav-link">Architecture</a><a href="#live-analyzer" data-testid="analyzer-nav-link">Live Analyzer</a><a href="#schema" data-testid="schema-nav-link">Schema</a><a href="#roadmap" data-testid="roadmap-nav-link">Roadmap</a></div>{user ? <div className="user-chip" data-testid="user-chip">{user.picture && <img src={user.picture} alt="User avatar" />}<span data-testid="user-name">{user.name?.split(" ")[0]}</span><button onClick={logout} title="Sign out" data-testid="sign-out-button"><LogOut size={14} /></button></div> : <button className="signin-btn" onClick={signIn} data-testid="google-sign-in-button">Sign in</button>}<button className="nav-cta" onClick={() => (user ? document.getElementById("analyzer-input")?.focus() : signIn())} data-testid="launch-mvp-button">Launch MVP <ArrowUpRight size={16} /></button><button className="mobile-menu" onClick={() => setMobileOpen(!mobileOpen)} data-testid="mobile-menu-button">{mobileOpen ? <X /> : <Menu />}</button></nav><main id="top"><section className="hero section"><div className="hero-copy"><div className="hero-kicker"><span># AI/ML</span><i>•</i><span># WEB AUTOMATION</span><i>•</i><span># SOCIAL ANALYTICS</span></div><h1 data-testid="hero-heading">Turn public profiles<br />into <span>growth signals.</span></h1><p className="hero-subtitle" data-testid="hero-subtitle">Automated public profile harvesting transformed into high-precision commercial intelligence using contextual LLM reasoning.</p><div className="analyze-form glass-card"><Instagram size={20} className="form-icon" /><input id="analyzer-input" value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => e.key === "Enter" && analyze()} placeholder="Enter profile URL or handle" data-testid="profile-url-input" /><button onClick={analyze} disabled={loading} data-testid="analyze-profile-button">{loading ? <><span className="spinner" /> ANALYZING</> : <>ANALYZE PROFILE <ArrowUpRight size={16} /></>}</button></div><div className="quick-row"><span>TRY A SIGNAL:</span>{["@glossier", "@notionhq", "@allbirds"].map((x) => <button key={x} onClick={() => setUrl(x)} data-testid={`quick-demo-${x.slice(1)}`}>{x}</button>)}</div></div><div className="hero-visual"><div className="visual-orbit orbit-a" /><div className="visual-orbit orbit-b" /><div className="signal-card glass-card"><div className="signal-card-head"><span className="status"><span className="live-dot" /> LIVE SIGNAL</span><span className="mono-label">0.42 SEC</span></div><div className="mini-profile"><img src={sample.profile.profilePicUrl} alt="Sample brand" /><div><strong>@glossier</strong><span>Beauty / DTC / Verified</span></div><Pill className="cyan">88 FIT</Pill></div><div className="signal-lines"><div><span>Business intent</span><b>High</b></div><div><span>Content clarity</span><b>92%</b></div><div><span>Conversion path</span><b>Resolved</b></div></div><div className="sparkline"><span /><span /><span /><span /><span /><span /><span /><span /><span /></div></div><div className="float-tag tag-one"><Sparkles size={14} /> CONTEXTUAL AI</div><div className="float-tag tag-two"><span className="mini-dot" /> PUBLIC DATA ONLY</div></div></section><section id="features" className="section feature-section"><div className="section-heading"><div><div className="section-kicker">THE SIGNAL GAP</div><h2>Less scrolling.<br /><em>More knowing.</em></h2></div><p>Teams lose hours translating messy social context into a spreadsheet. TECH SICK turns that gap into a repeatable intelligence layer.</p></div><div className="comparison-grid"><div className="comparison-card problem"><div className="card-index">01 / THE OLD WAY</div><h3>Social data is loud.<br />Signal is buried.</h3>{["Unstructured captions, emojis & link-in-bio mazes", "15+ minutes of manual research per handle", "Vanity metrics without commercial context"].map((x) => <div className="bullet" key={x}><X size={14} />{x}</div>)}</div><div className="comparison-card solution"><div className="card-index">02 / THE TECH SICK WAY</div><h3>One profile in.<br /><span>One clear play out.</span></h3>{["Public metadata & links unrolled automatically", "LLM semantic parsing with grounded reasoning", "CRM-ready JSON and CSV outputs"].map((x) => <div className="bullet" key={x}><Check size={14} />{x}</div>)}</div></div></section><ProfileCard data={result} onPitch={() => setPitchOpen(true)} onCompare={() => setCompareOpen(!compareOpen)} />{compareOpen && <section className="section compare-section" data-testid="compare-section"><div className="section-kicker"><span className="eyebrow-dot" /> HEAD-TO-HEAD · UP TO 4 PROFILES</div><div className="compare-row glass-card"><Scale size={18} className="form-icon" /><input value={urlB} onChange={(e) => setUrlB(e.target.value)} onKeyDown={(e) => e.key === "Enter" && analyzeCompetitor()} placeholder="Add a competitor URL or handle (e.g., @competitor)" data-testid="compare-url-input" /><button className="nav-cta" onClick={analyzeCompetitor} disabled={loadingB} data-testid="compare-analyze-button">{loadingB ? <><span className="spinner" /> ANALYZING</> : <>ADD <ArrowUpRight size={14} /></>}</button></div>{competitors.length > 0 && <div className="compare-chips" data-testid="compare-chips">{competitors.map((c) => <span className="compare-chip" key={c.profile.username}>@{c.profile.username}<button onClick={() => setCompetitors(competitors.filter((x) => x.profile.username !== c.profile.username))} data-testid={`compare-remove-${c.profile.username}`}><X size={12} /></button></span>)}</div>}{competitors.length > 0 && <ComparePanel entries={[result, ...competitors]} />}</section>}<section id="architecture" className="section architecture-section"><div className="section-heading"><div><div className="section-kicker">UNDER THE HOOD</div><h2>Signal in.<br /><em>Intelligence out.</em></h2></div><p>A focused pipeline designed to move from public URL to decision-ready context.</p></div><div className="pipeline">{[["01", "Input layer", "Next.js · Tailwind · FastAPI", "URL → normalized profile"], ["02", "Data scraping", "Apify public actor", "Bio · links · metrics"], ["03", "Context engine", "Gemini 3 Flash", "Classify · score · explain"], ["04", "Export engine", "JSON · CSV · CRM", "Ready for your stack"]].map(([n, title, tech, desc], idx) => <div className="pipeline-step" key={n} data-testid={`pipeline-step-${n}`}><span className="step-no">{n}</span><div><h3>{title}</h3><b>{tech}</b><p>{desc}</p></div>{idx < 3 && <ChevronRight className="pipeline-arrow" />}</div>)}</div></section><section id="schema" className="section code-section"><div className="code-intro"><div className="section-kicker">BUILT FOR BUILDERS</div><h2>Bring the signal<br /><em>with you.</em></h2><p>Every run returns clean, documented output that fits right into your workflow.</p></div><div className="code-window"><div className="code-tabs">{["JSON OUTPUT", "FASTAPI ROUTE"].map((x) => <button className={codeTab === x ? "active" : ""} onClick={() => setCodeTab(x)} key={x} data-testid={`code-tab-${x.toLowerCase().replace(" ", "-")}`}>{x}</button>)}<span><Play size={12} /> LIVE</span></div><pre data-testid="code-preview">{codeTab === "JSON OUTPUT" ? '{\n  "handle": "@glossier",\n  "classification": "B2C E-Commerce",\n  "pillars": ["Organic skincare", "Serum"],\n  "lead_score": 88,\n  "fit_label": "HIGH FIT",\n  "landing_page": "glossier.com"\n}' : '@router.post("/analyze")\nasync def analyze_profile(input):\n    profile = await apify.details(input.url)\n    return await gemini.classify(profile)'}</pre></div></section><section id="roadmap" className="section roadmap-section"><div className="section-kicker">WHAT’S NEXT</div><h2>Built for the <em>long read.</em></h2><div className="roadmap-grid">{[["NOW", "MVP", "Public bio scraping · link unrolling · Gemini JSON · CSV export", true], ["NEXT", "PHASE 02", "Reels audio transcription · visual tags · growth analytics", false], ["LATER", "PHASE 03", "HubSpot · Salesforce · Zapier · API marketplace", false]].map(([label, title, desc, active]) => <div className={`roadmap-item ${active ? "active" : ""}`} key={title}><span>{label}</span><h3>{title}</h3><p>{desc}</p><ArrowUpRight size={18} /></div>)}</div></section></main><footer className="footer"><div><a href="#top" className="brand"><span className="brand-mark">TS</span><span>TECH SICK</span></a><p>Developed by Team TECH SICK<br /><a href="mailto:contact@techsick.ai">contact@techsick.ai</a></p></div><div className="footer-right"><span>PUBLIC DATA. CLEARER MOVES.</span><div><a href="#schema" data-testid="footer-docs-link">Docs <ExternalLink size={14} /></a><a href="https://linkedin.com" data-testid="footer-linkedin-link">LinkedIn <Linkedin size={14} /></a></div></div></footer>{pitchOpen && <PitchModal pitch={(result.intelligence || sample.intelligence).pitch || sample.intelligence.pitch} onClose={() => setPitchOpen(false)} />}</div>;
}

function AppRouter() {
  const location = useLocation();
  if (location.hash?.includes("session_id=")) return <AuthCallback />;
  return <Routes><Route path="*" element={<Home />} /></Routes>;
}

export default function App() {
  return <BrowserRouter><Toaster theme="dark" position="bottom-right" /><AppRouter /></BrowserRouter>;
}
