// Dashboard.jsx — Smart Manufacturing Analytics Dashboard
// M.Tech Project — MongoDB + React

import { useState, useEffect, useCallback } from "react";
import {
  BarChart, Bar, LineChart, Line, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis, ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  Cell, PieChart, Pie
} from "recharts";

// ─────────────────────────────────────────────
// Mock data (mirrors what MongoDB aggregation returns)
// ─────────────────────────────────────────────
const MOCK_SUMMARY = {
  overall: {
    total_records: 1500,
    total_units: 357420,
    total_defective: 13284,
    avg_quality_score: 85.4,
    avg_oee: 52.3,
    avg_energy: 257.8,
    avg_downtime: 24.6,
    total_energy: 386700,
    overall_defect_pct: "3.72"
  },
  by_plant: [
    { _id: 1, avg_quality: 85.1, avg_oee: 51.8, total_units: 71240, total_defective: 2680 },
    { _id: 2, avg_quality: 86.2, avg_oee: 53.1, total_units: 70980, total_defective: 2540 },
    { _id: 3, avg_quality: 84.7, avg_oee: 51.2, total_units: 71820, total_defective: 2760 },
    { _id: 4, avg_quality: 85.9, avg_oee: 52.9, total_units: 71160, total_defective: 2620 },
    { _id: 5, avg_quality: 85.3, avg_oee: 52.7, total_units: 72220, total_defective: 2684 },
  ],
  by_shift: [
    { _id: "Morning", avg_quality: 86.1, avg_oee: 53.2, count: 501 },
    { _id: "Evening", avg_quality: 85.5, avg_oee: 52.6, count: 498 },
    { _id: "Night",   avg_quality: 84.7, avg_oee: 51.3, count: 501 },
  ],
  by_product: [
    { _id: "A", avg_defect_rate: 3.5, total_units: 90210, avg_quality: 86.1 },
    { _id: "B", avg_defect_rate: 3.8, total_units: 88940, avg_quality: 85.2 },
    { _id: "C", avg_defect_rate: 3.6, total_units: 89670, avg_quality: 85.7 },
    { _id: "D", avg_defect_rate: 4.0, total_units: 88600, avg_quality: 84.6 },
  ]
};

const MOCK_OEE = [
  { _id: 101, plant_id: 1, avg_oee: 68.4, avg_availability: 0.92, avg_performance: 0.81, avg_quality_rate: 0.92, oee_rank: 1, oee_class: "Good" },
  { _id: 115, plant_id: 3, avg_oee: 64.1, avg_availability: 0.89, avg_performance: 0.79, avg_quality_rate: 0.91, oee_rank: 2, oee_class: "Good" },
  { _id: 128, plant_id: 2, avg_oee: 61.2, avg_availability: 0.87, avg_performance: 0.77, avg_quality_rate: 0.91, oee_rank: 3, oee_class: "Average" },
  { _id: 134, plant_id: 5, avg_oee: 58.7, avg_availability: 0.85, avg_performance: 0.75, avg_quality_rate: 0.92, oee_rank: 4, oee_class: "Average" },
  { _id: 142, plant_id: 4, avg_oee: 55.3, avg_availability: 0.83, avg_performance: 0.73, avg_quality_rate: 0.91, oee_rank: 5, oee_class: "Average" },
  { _id: 109, plant_id: 1, avg_oee: 51.8, avg_availability: 0.80, avg_performance: 0.71, avg_quality_rate: 0.91, oee_rank: 6, oee_class: "Average" },
  { _id: 123, plant_id: 2, avg_oee: 48.2, avg_availability: 0.78, avg_performance: 0.68, avg_quality_rate: 0.91, oee_rank: 7, oee_class: "Poor" },
  { _id: 137, plant_id: 3, avg_oee: 44.6, avg_availability: 0.75, avg_performance: 0.65, avg_quality_rate: 0.92, oee_rank: 8, oee_class: "Poor" },
];

const MOCK_DEFECT = {
  by_plant: [
    { _id: 1, avg_defect_rate: 3.5, total_defective: 2680, total_units: 71240 },
    { _id: 2, avg_defect_rate: 3.6, total_defective: 2540, total_units: 70980 },
    { _id: 3, avg_defect_rate: 3.8, total_defective: 2760, total_units: 71820 },
    { _id: 4, avg_defect_rate: 3.7, total_defective: 2620, total_units: 71160 },
    { _id: 5, avg_defect_rate: 3.9, total_defective: 2684, total_units: 72220 },
  ],
  by_shift: [
    { _id: "Morning", avg_defect_rate: 3.4, total_defective: 4320 },
    { _id: "Evening", avg_defect_rate: 3.7, total_defective: 4580 },
    { _id: "Night",   avg_defect_rate: 4.1, total_defective: 4384 },
  ]
};

const MOCK_ENERGY = [
  { period: "2025-1", avg_energy: 258.4, total_energy: 31200, energy_per_unit: 0.87 },
  { period: "2025-2", avg_energy: 255.1, total_energy: 28900, energy_per_unit: 0.85 },
  { period: "2025-3", avg_energy: 261.3, total_energy: 32400, energy_per_unit: 0.89 },
  { period: "2025-4", avg_energy: 254.8, total_energy: 30800, energy_per_unit: 0.84 },
  { period: "2025-5", avg_energy: 259.7, total_energy: 31600, energy_per_unit: 0.88 },
  { period: "2025-6", avg_energy: 256.2, total_energy: 30200, energy_per_unit: 0.86 },
];

const MOCK_OPERATORS = [
  { _id: 1024, avg_quality: 94.2, avg_oee: 64.1, avg_defect_rate: 2.1, total_units: 8420, performance_score: 57.6, rank: 1 },
  { _id: 1087, avg_quality: 93.1, avg_oee: 63.2, avg_defect_rate: 2.3, total_units: 7980, performance_score: 56.8, rank: 2 },
  { _id: 1042, avg_quality: 92.4, avg_oee: 62.8, avg_defect_rate: 2.5, total_units: 8100, performance_score: 56.0, rank: 3 },
  { _id: 1063, avg_quality: 91.8, avg_oee: 61.5, avg_defect_rate: 2.7, total_units: 7640, performance_score: 55.1, rank: 4 },
  { _id: 1055, avg_quality: 91.2, avg_oee: 60.9, avg_defect_rate: 2.9, total_units: 7820, performance_score: 54.5, rank: 5 },
];

const QUALITY_DIST = [
  { _id: 0,  label: "Critical (<60)",   count: 32,  avg_oee: 38.2 },
  { _id: 60, label: "Poor (60-70)",     count: 87,  avg_oee: 44.1 },
  { _id: 70, label: "Fair (70-80)",     count: 198, avg_oee: 49.7 },
  { _id: 80, label: "Good (80-90)",     count: 612, avg_oee: 53.2 },
  { _id: 90, label: "Very Good (90-95)",count: 401, avg_oee: 57.8 },
  { _id: 95, label: "Excellent (95+)",  count: 170, avg_oee: 62.4 },
];

// ─────────────────────────────────────────────
// Color palette
// ─────────────────────────────────────────────
const COLORS = {
  primary:   "#6366f1",
  success:   "#10b981",
  warning:   "#f59e0b",
  danger:    "#ef4444",
  info:      "#3b82f6",
  purple:    "#8b5cf6",
  teal:      "#14b8a6",
  orange:    "#f97316",
};
const PLANT_COLORS = ["#6366f1","#10b981","#f59e0b","#3b82f6","#8b5cf6"];
const OEE_COLOR = { "World-Class": "#10b981", "Good": "#6366f1", "Average": "#f59e0b", "Poor": "#ef4444" };

// ─────────────────────────────────────────────
// KPI Card
// ─────────────────────────────────────────────
function KPICard({ title, value, unit, sub, color, icon }) {
  return (
    <div style={{
      background: "linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)",
      border: `1px solid ${color}40`,
      borderRadius: 14, padding: "18px 22px",
      display: "flex", flexDirection: "column", gap: 6,
      boxShadow: `0 4px 24px ${color}15`
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ color: "#94a3b8", fontSize: 12, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase" }}>{title}</span>
        <span style={{ fontSize: 22 }}>{icon}</span>
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
        <span style={{ color, fontSize: 30, fontWeight: 800 }}>{value}</span>
        {unit && <span style={{ color: "#64748b", fontSize: 14 }}>{unit}</span>}
      </div>
      {sub && <span style={{ color: "#64748b", fontSize: 12 }}>{sub}</span>}
    </div>
  );
}

// ─────────────────────────────────────────────
// Section Header
// ─────────────────────────────────────────────
function SectionHeader({ title, badge }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
      <h3 style={{ margin: 0, color: "#e2e8f0", fontSize: 15, fontWeight: 700 }}>{title}</h3>
      {badge && <span style={{ background: "#6366f120", color: "#818cf8", fontSize: 11, padding: "2px 8px", borderRadius: 20, fontWeight: 600 }}>{badge}</span>}
    </div>
  );
}

// ─────────────────────────────────────────────
// Sidebar Nav
// ─────────────────────────────────────────────
const TABS = [
  { id: "overview",    label: "Overview",      icon: "📊" },
  { id: "quality",     label: "Quality",       icon: "🏆" },
  { id: "oee",         label: "OEE & Machines",icon: "⚙️" },
  { id: "defects",     label: "Defect Analysis",icon: "🔍" },
  { id: "energy",      label: "Energy Trend",  icon: "⚡" },
  { id: "operators",   label: "Operators",     icon: "👷" },
];

// ─────────────────────────────────────────────
// Main Dashboard
// ─────────────────────────────────────────────
export default function Dashboard() {
  const [activeTab, setActiveTab] = useState("overview");
  const [summary]    = useState(MOCK_SUMMARY);
  const [oeeData]    = useState(MOCK_OEE);
  const [defect]     = useState(MOCK_DEFECT);
  const [energy]     = useState(MOCK_ENERGY);
  const [operators]  = useState(MOCK_OPERATORS);
  const [qualDist]   = useState(QUALITY_DIST);

  const s = summary.overall;

  const styles = {
    root: { display: "flex", minHeight: "100vh", background: "#0f172a", fontFamily: "'Inter', sans-serif", color: "#e2e8f0" },
    sidebar: { width: 220, background: "#1e293b", borderRight: "1px solid #334155", padding: "24px 0", flexShrink: 0 },
    sidebarTitle: { padding: "0 20px 24px", borderBottom: "1px solid #334155", marginBottom: 16 },
    navItem: (active) => ({
      display: "flex", alignItems: "center", gap: 10,
      padding: "10px 20px", cursor: "pointer",
      background: active ? "#6366f120" : "transparent",
      borderRight: active ? "3px solid #6366f1" : "3px solid transparent",
      color: active ? "#818cf8" : "#94a3b8",
      fontWeight: active ? 700 : 400, fontSize: 13,
      transition: "all 0.15s"
    }),
    main: { flex: 1, padding: 28, overflowY: "auto" },
    grid2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 },
    grid3: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 20 },
    card: { background: "#1e293b", border: "1px solid #334155", borderRadius: 14, padding: 20 },
  };

  return (
    <div style={styles.root}>
      {/* Sidebar */}
      <div style={styles.sidebar}>
        <div style={styles.sidebarTitle}>
          <div style={{ fontSize: 16, fontWeight: 800, color: "#e2e8f0" }}>🏭 ManuDB</div>
          <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>M.Tech Analytics Project</div>
        </div>
        {TABS.map(t => (
          <div key={t.id} style={styles.navItem(activeTab === t.id)} onClick={() => setActiveTab(t.id)}>
            <span>{t.icon}</span> {t.label}
          </div>
        ))}
        <div style={{ padding: "24px 20px 0", borderTop: "1px solid #334155", marginTop: 16 }}>
          <div style={{ fontSize: 11, color: "#475569" }}>MongoDB Collections</div>
          {["production_records", "alerts"].map(c => (
            <div key={c} style={{ fontSize: 11, color: "#64748b", padding: "4px 0", display: "flex", gap: 6, alignItems: "center" }}>
              <span style={{ color: "#10b981" }}>●</span> {c}
            </div>
          ))}
        </div>
      </div>

      {/* Main */}
      <div style={styles.main}>
        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ margin: 0, color: "#f1f5f9", fontSize: 22, fontWeight: 800 }}>
            {TABS.find(t => t.id === activeTab)?.icon} {TABS.find(t => t.id === activeTab)?.label}
          </h2>
          <p style={{ color: "#64748b", margin: "4px 0 0", fontSize: 13 }}>
            Smart Manufacturing Analytics · 1,500 production records · 5 plants · MongoDB Aggregation Pipelines
          </p>
        </div>

        {/* ── OVERVIEW ── */}
        {activeTab === "overview" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* KPI row */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
              <KPICard title="Total Units"      value={s.total_units.toLocaleString()} color={COLORS.primary}  icon="🔩" sub="Across all plants" />
              <KPICard title="Avg Quality"      value={s.avg_quality_score.toFixed(1)} unit="/100" color={COLORS.success} icon="✅" sub="Quality score" />
              <KPICard title="Avg OEE"          value={s.avg_oee.toFixed(1)} unit="%" color={COLORS.info}    icon="⚙️" sub="Overall Equipment Effectiveness" />
              <KPICard title="Defect Rate"      value={s.overall_defect_pct} unit="%" color={COLORS.danger}   icon="⚠️" sub={`${s.total_defective.toLocaleString()} defective units`} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
              <KPICard title="Avg Energy"       value={s.avg_energy.toFixed(1)} unit="kWh" color={COLORS.warning} icon="⚡" />
              <KPICard title="Avg Downtime"     value={s.avg_downtime.toFixed(1)} unit="min" color={COLORS.orange} icon="🔧" />
              <KPICard title="Total Records"    value={s.total_records.toLocaleString()} color={COLORS.teal} icon="📋" sub="Production entries in MongoDB" />
            </div>

            {/* Plant performance */}
            <div style={styles.card}>
              <SectionHeader title="Quality Score & OEE by Plant" badge="$group + $facet pipeline" />
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={summary.by_plant.map(p => ({ name: `Plant ${p._id}`, Quality: +p.avg_quality.toFixed(1), OEE: +p.avg_oee.toFixed(1) }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 12 }} />
                  <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} domain={[0, 100]} />
                  <Tooltip contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8 }} />
                  <Legend />
                  <Bar dataKey="Quality" fill={COLORS.primary} radius={[4,4,0,0]} />
                  <Bar dataKey="OEE"     fill={COLORS.info}    radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Shift + Product */}
            <div style={styles.grid2}>
              <div style={styles.card}>
                <SectionHeader title="Production by Shift" badge="$group pipeline" />
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={summary.by_shift} dataKey="count" nameKey="_id" cx="50%" cy="50%" outerRadius={75} label={({_id, count}) => `${_id}: ${count}`}>
                      {summary.by_shift.map((_, i) => <Cell key={i} fill={Object.values(COLORS)[i]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: "#1e293b", border: "1px solid #334155" }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div style={styles.card}>
                <SectionHeader title="Defect Rate by Product Type" badge="$group pipeline" />
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={summary.by_product.map(p => ({ name: `Type ${p._id}`, Defect: +p.avg_defect_rate.toFixed(2), Quality: +p.avg_quality.toFixed(1) }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 12 }} />
                    <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} />
                    <Tooltip contentStyle={{ background: "#1e293b", border: "1px solid #334155" }} />
                    <Bar dataKey="Defect" fill={COLORS.danger} radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {/* ── QUALITY ── */}
        {activeTab === "quality" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={styles.card}>
              <SectionHeader title="Quality Score Distribution" badge="$bucket pipeline" />
              <div style={{ marginBottom: 10, color: "#64748b", fontSize: 12 }}>
                MongoDB <code style={{ color: "#818cf8" }}>$bucket</code> operator groups records into quality bands
              </div>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={qualDist}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="label" tick={{ fill: "#94a3b8", fontSize: 11 }} />
                  <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} />
                  <Tooltip contentStyle={{ background: "#1e293b", border: "1px solid #334155" }}
                    formatter={(v, n) => [v, n === "count" ? "Records" : "Avg OEE %"]} />
                  <Legend />
                  <Bar dataKey="count"   name="Records" fill={COLORS.primary} radius={[4,4,0,0]} />
                  <Bar dataKey="avg_oee" name="Avg OEE %" fill={COLORS.teal} radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div style={styles.grid2}>
              <div style={styles.card}>
                <SectionHeader title="Quality by Shift" badge="$group pipeline" />
                <ResponsiveContainer width="100%" height={220}>
                  <RadarChart data={summary.by_shift.map(s => ({ shift: s._id, quality: s.avg_quality, oee: s.avg_oee }))}>
                    <PolarGrid stroke="#334155" />
                    <PolarAngleAxis dataKey="shift" tick={{ fill: "#94a3b8", fontSize: 12 }} />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: "#64748b", fontSize: 10 }} />
                    <Radar name="Quality" dataKey="quality" stroke={COLORS.primary} fill={COLORS.primary} fillOpacity={0.3} />
                    <Radar name="OEE" dataKey="oee" stroke={COLORS.success} fill={COLORS.success} fillOpacity={0.2} />
                    <Legend />
                    <Tooltip contentStyle={{ background: "#1e293b", border: "1px solid #334155" }} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
              <div style={styles.card}>
                <SectionHeader title="Quality Scores by Plant" badge="$group pipeline" />
                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 8 }}>
                  {summary.by_plant.map(p => (
                    <div key={p._id}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                        <span style={{ color: "#94a3b8", fontSize: 13 }}>Plant {p._id}</span>
                        <span style={{ color: COLORS.primary, fontWeight: 700, fontSize: 13 }}>{p.avg_quality.toFixed(1)}</span>
                      </div>
                      <div style={{ height: 8, background: "#334155", borderRadius: 4, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${p.avg_quality}%`, background: `linear-gradient(90deg, ${COLORS.primary}, ${COLORS.success})`, borderRadius: 4 }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── OEE ── */}
        {activeTab === "oee" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={styles.card}>
              <SectionHeader title="OEE by Machine (Top 8)" badge="$setWindowFields + $rank" />
              <div style={{ color: "#64748b", fontSize: 12, marginBottom: 12 }}>
                <code style={{ color: "#818cf8" }}>$setWindowFields</code> with <code style={{ color: "#818cf8" }}>$rank</code> window function assigns machine rank
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={oeeData.map(m => ({ name: `M-${m._id}`, OEE: +m.avg_oee.toFixed(1), plant: m.plant_id, class: m.oee_class }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 12 }} />
                  <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} domain={[0, 80]} />
                  <Tooltip contentStyle={{ background: "#1e293b", border: "1px solid #334155" }}
                    formatter={(v, n, props) => [v + "%", `OEE (Plant ${props.payload.plant}, ${props.payload.class})`]} />
                  <Bar dataKey="OEE" radius={[4,4,0,0]}>
                    {oeeData.map((m, i) => <Cell key={i} fill={OEE_COLOR[m.oee_class] || COLORS.primary} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div style={{ display: "flex", gap: 16, marginTop: 12 }}>
                {Object.entries(OEE_COLOR).map(([k, v]) => (
                  <div key={k} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ width: 10, height: 10, borderRadius: 2, background: v }} />
                    <span style={{ color: "#94a3b8", fontSize: 11 }}>{k}</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={styles.card}>
              <SectionHeader title="OEE Component Breakdown" badge="Availability × Performance × Quality" />
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={oeeData.slice(0, 6).map(m => ({
                  name: `M-${m._id}`,
                  Availability: +(m.avg_availability * 100).toFixed(1),
                  Performance:  +(m.avg_performance * 100).toFixed(1),
                  Quality:      +(m.avg_quality_rate * 100).toFixed(1),
                }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 12 }} />
                  <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} domain={[0, 100]} />
                  <Tooltip contentStyle={{ background: "#1e293b", border: "1px solid #334155" }} />
                  <Legend />
                  <Bar dataKey="Availability" fill={COLORS.success} stackId="a" />
                  <Bar dataKey="Performance"  fill={COLORS.info}    stackId="b" />
                  <Bar dataKey="Quality"      fill={COLORS.primary} stackId="c" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* ── DEFECTS ── */}
        {activeTab === "defects" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={styles.grid2}>
              <div style={styles.card}>
                <SectionHeader title="Defect Rate by Plant" badge="$facet pipeline" />
                <ResponsiveContainer width="100%" height={230}>
                  <BarChart data={defect.by_plant.map(p => ({ name: `Plant ${p._id}`, Rate: +p.avg_defect_rate.toFixed(2) }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 12 }} />
                    <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} />
                    <Tooltip contentStyle={{ background: "#1e293b", border: "1px solid #334155" }} formatter={v => [`${v}%`, "Defect Rate"]} />
                    <Bar dataKey="Rate" fill={COLORS.danger} radius={[4,4,0,0]}>
                      {defect.by_plant.map((p, i) => <Cell key={i} fill={p.avg_defect_rate > 3.7 ? COLORS.danger : COLORS.warning} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div style={styles.card}>
                <SectionHeader title="Defect Rate by Shift" badge="$facet pipeline" />
                <ResponsiveContainer width="100%" height={230}>
                  <BarChart data={defect.by_shift.map(s => ({ name: s._id, Rate: +s.avg_defect_rate.toFixed(2) }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 12 }} />
                    <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} />
                    <Tooltip contentStyle={{ background: "#1e293b", border: "1px solid #334155" }} formatter={v => [`${v}%`, "Defect Rate"]} />
                    <Bar dataKey="Rate" fill={COLORS.orange} radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div style={styles.card}>
              <SectionHeader title="Key Insight: Night Shift Has Highest Defect Rate" />
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
                {defect.by_shift.map(s => (
                  <div key={s._id} style={{ background: "#0f172a", borderRadius: 10, padding: 16, textAlign: "center" }}>
                    <div style={{ fontSize: 24 }}>{s._id === "Morning" ? "🌅" : s._id === "Evening" ? "🌇" : "🌙"}</div>
                    <div style={{ color: "#94a3b8", fontSize: 13, marginTop: 6 }}>{s._id} Shift</div>
                    <div style={{ color: COLORS.danger, fontSize: 26, fontWeight: 800 }}>{s.avg_defect_rate.toFixed(1)}%</div>
                    <div style={{ color: "#64748b", fontSize: 12 }}>{s.total_defective.toLocaleString()} defective units</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── ENERGY ── */}
        {activeTab === "energy" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={styles.card}>
              <SectionHeader title="Monthly Energy Consumption Trend" badge="$group by year+month" />
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={energy.map(e => ({ period: e.period, "Avg kWh": +e.avg_energy.toFixed(1), "Per Unit": +(e.energy_per_unit * 100).toFixed(2) }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="period" tick={{ fill: "#94a3b8", fontSize: 12 }} />
                  <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} />
                  <Tooltip contentStyle={{ background: "#1e293b", border: "1px solid #334155" }} />
                  <Legend />
                  <Line type="monotone" dataKey="Avg kWh" stroke={COLORS.warning} strokeWidth={2} dot={{ r: 4 }} />
                  <Line type="monotone" dataKey="Per Unit" stroke={COLORS.teal} strokeWidth={2} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
              {energy.map(e => (
                <div key={e.period} style={{ ...styles.card, textAlign: "center" }}>
                  <div style={{ color: "#64748b", fontSize: 12 }}>{e.period}</div>
                  <div style={{ color: COLORS.warning, fontSize: 22, fontWeight: 800 }}>{e.avg_energy.toFixed(1)}</div>
                  <div style={{ color: "#64748b", fontSize: 11 }}>avg kWh/batch</div>
                  <div style={{ color: COLORS.teal, fontSize: 14, marginTop: 4 }}>{e.total_energy.toLocaleString()} total</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── OPERATORS ── */}
        {activeTab === "operators" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={styles.card}>
              <SectionHeader title="Operator Performance Leaderboard" badge="$rank + composite score" />
              <div style={{ color: "#64748b", fontSize: 12, marginBottom: 14 }}>
                Score = (avg_quality × 0.4) + (avg_oee × 0.4) − (avg_defect × 0.2) — computed via MongoDB <code style={{ color: "#818cf8" }}>$addFields</code>
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #334155" }}>
                    {["Rank","Operator ID","Quality Score","OEE %","Defect Rate","Total Units","Score"].map(h => (
                      <th key={h} style={{ color: "#64748b", fontSize: 11, fontWeight: 600, padding: "8px 12px", textAlign: "left", textTransform: "uppercase", letterSpacing: 0.5 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {operators.map((op, i) => (
                    <tr key={op._id} style={{ borderBottom: "1px solid #1e2d3d", background: i % 2 === 0 ? "transparent" : "#ffffff05" }}>
                      <td style={{ padding: "10px 12px" }}>
                        <span style={{ background: i === 0 ? "#f59e0b20" : "#334155", color: i === 0 ? "#f59e0b" : "#94a3b8", padding: "2px 8px", borderRadius: 20, fontSize: 12, fontWeight: 700 }}>
                          {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${op.rank}`}
                        </span>
                      </td>
                      <td style={{ padding: "10px 12px", color: "#e2e8f0", fontWeight: 600 }}>OP-{op._id}</td>
                      <td style={{ padding: "10px 12px", color: COLORS.success }}>{op.avg_quality.toFixed(1)}</td>
                      <td style={{ padding: "10px 12px", color: COLORS.info }}>{op.avg_oee.toFixed(1)}%</td>
                      <td style={{ padding: "10px 12px", color: COLORS.danger }}>{op.avg_defect_rate.toFixed(1)}%</td>
                      <td style={{ padding: "10px 12px", color: "#94a3b8" }}>{op.total_units.toLocaleString()}</td>
                      <td style={{ padding: "10px 12px", color: COLORS.primary, fontWeight: 700 }}>{op.performance_score.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
