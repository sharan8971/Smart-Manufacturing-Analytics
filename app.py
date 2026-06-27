"""
Smart Manufacturing Analytics Dashboard
MongoDB Atlas + Streamlit Cloud
"""

import streamlit as st
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
from pymongo import MongoClient
from datetime import datetime
import warnings
warnings.filterwarnings("ignore")

# ─────────────────────────────────────────────
# Page config
# ─────────────────────────────────────────────
st.set_page_config(
    page_title="Manufacturing Analytics",
    page_icon="🏭",
    layout="wide",
    initial_sidebar_state="expanded"
)

# ─────────────────────────────────────────────
# MongoDB Connection (uses Streamlit Secrets)
# ─────────────────────────────────────────────
@st.cache_resource
def get_db():
    """Connect to MongoDB Atlas using credentials from st.secrets."""
    uri = st.secrets["mongodb"]["uri"]
    client = MongoClient(uri, serverSelectionTimeoutMS=5000)
    db = client[st.secrets["mongodb"]["db_name"]]
    return db

@st.cache_data(ttl=300)   # cache query results for 5 minutes
def load_all_records():
    db = get_db()
    col = db["production_records"]
    docs = list(col.find({}, {"_id": 0}))
    df = pd.json_normalize(docs)
    # Flatten nested keys produced by json_normalize
    df.columns = [c.replace(".", "_") for c in df.columns]
    if "schedule_production_date" in df.columns:
        df["production_date"] = pd.to_datetime(df["schedule_production_date"])
    elif "production_date" in df.columns:
        df["production_date"] = pd.to_datetime(df["production_date"])
    return df

# ─────────────────────────────────────────────
# Aggregation helpers (run in MongoDB)
# ─────────────────────────────────────────────
@st.cache_data(ttl=300)
def kpi_summary():
    db = get_db()
    col = db["production_records"]
    pipeline = [
        {"$facet": {
            "overall": [{"$group": {
                "_id": None,
                "total_records":    {"$sum": 1},
                "total_units":      {"$sum": "$production.units_produced"},
                "total_defective":  {"$sum": "$production.defective_units"},
                "avg_quality":      {"$avg": "$quality.quality_score"},
                "avg_oee":          {"$avg": "$kpis.oee_percent"},
                "avg_energy":       {"$avg": "$resources.energy_consumption_kwh"},
                "avg_downtime":     {"$avg": "$resources.downtime_minutes"},
            }}],
            "by_plant": [{"$group": {
                "_id":          "$plant_id",
                "avg_quality":  {"$avg": "$quality.quality_score"},
                "avg_oee":      {"$avg": "$kpis.oee_percent"},
                "total_units":  {"$sum": "$production.units_produced"},
                "avg_defect":   {"$avg": "$production.defect_rate_pct"},
            }}, {"$sort": {"_id": 1}}],
            "by_shift": [{"$group": {
                "_id":          "$schedule.shift",
                "avg_quality":  {"$avg": "$quality.quality_score"},
                "avg_oee":      {"$avg": "$kpis.oee_percent"},
                "total_units":  {"$sum": "$production.units_produced"},
            }}, {"$sort": {"_id": 1}}],
            "by_product": [{"$group": {
                "_id":          "$product_type",
                "avg_quality":  {"$avg": "$quality.quality_score"},
                "total_units":  {"$sum": "$production.units_produced"},
                "avg_defect":   {"$avg": "$production.defect_rate_pct"},
            }}, {"$sort": {"_id": 1}}],
        }}
    ]
    result = list(col.aggregate(pipeline))
    return result[0] if result else {}

@st.cache_data(ttl=300)
def quality_distribution():
    db = get_db()
    col = db["production_records"]
    pipeline = [
        {"$bucket": {
            "groupBy": "$quality.quality_score",
            "boundaries": [0, 60, 70, 80, 90, 95, 101],
            "default": "Other",
            "output": {"count": {"$sum": 1}, "avg_oee": {"$avg": "$kpis.oee_percent"}}
        }}
    ]
    return list(col.aggregate(pipeline))

@st.cache_data(ttl=300)
def top_operators(n=10):
    db = get_db()
    col = db["production_records"]
    pipeline = [
        {"$group": {
            "_id":          "$operator_id",
            "avg_quality":  {"$avg": "$quality.quality_score"},
            "avg_oee":      {"$avg": "$kpis.oee_percent"},
            "avg_defect":   {"$avg": "$production.defect_rate_pct"},
            "total_units":  {"$sum": "$production.units_produced"},
            "records":      {"$sum": 1}
        }},
        {"$sort": {"avg_quality": -1}},
        {"$limit": n}
    ]
    return list(col.aggregate(pipeline))

@st.cache_data(ttl=300)
def energy_trend():
    db = get_db()
    col = db["production_records"]
    pipeline = [
        {"$group": {
            "_id": {
                "year":  {"$year": "$schedule.production_date"},
                "month": {"$month": "$schedule.production_date"},
                "week":  {"$isoWeek": "$schedule.production_date"},
            },
            "avg_energy": {"$avg": "$resources.energy_consumption_kwh"},
            "avg_oee":    {"$avg": "$kpis.oee_percent"},
            "count":      {"$sum": 1}
        }},
        {"$sort": {"_id.year": 1, "_id.month": 1, "_id.week": 1}},
        {"$limit": 20}
    ]
    return list(col.aggregate(pipeline))

@st.cache_data(ttl=300)
def downtime_heatmap():
    db = get_db()
    col = db["production_records"]
    pipeline = [
        {"$group": {
            "_id": {"plant": "$plant_id", "shift": "$schedule.shift"},
            "avg_downtime": {"$avg": "$resources.downtime_minutes"},
        }}
    ]
    return list(col.aggregate(pipeline))

# ─────────────────────────────────────────────
# Sidebar
# ─────────────────────────────────────────────
with st.sidebar:
    st.image("https://img.icons8.com/color/96/factory.png", width=60)
    st.title("Manufacturing\nAnalytics")
    st.markdown("---")

    # ── Data Source Selector ──────────────────
    st.subheader("📂 Data Source")
    data_source = st.radio("Choose source", ["☁️ MongoDB Atlas", "📄 Upload CSV"])

    uploaded_csv = None
    if data_source == "📄 Upload CSV":
        uploaded_csv = st.file_uploader(
            "Upload your Manufacturing CSV",
            type=["csv"],
            help="Upload Manufacturing_Dataset.csv"
        )
        if uploaded_csv:
            st.success(f"✅ {uploaded_csv.name} loaded!")
        else:
            st.info("👆 Upload a CSV file to get started")

    st.markdown("---")

    page = st.radio("Navigate", [
        "📊 KPI Dashboard",
        "🏭 Plant & Shift Analysis",
        "🔧 Machine & OEE",
        "👷 Operator Leaderboard",
        "⚡ Energy & Downtime",
        "🔍 Data Explorer",
    ])

    st.markdown("---")
    st.caption(f"Data source: {'CSV Upload' if data_source == '📄 Upload CSV' else 'MongoDB Atlas'}")
    if st.button("🔄 Refresh Data"):
        st.cache_data.clear()
        st.rerun()

# ─────────────────────────────────────────────
# Data loading — MongoDB OR CSV
# ─────────────────────────────────────────────
def load_csv(file) -> pd.DataFrame:
    """Load and normalise an uploaded CSV file."""
    df = pd.read_csv(file, parse_dates=["Production_Date"] if "Production_Date" in pd.read_csv(file, nrows=0).columns else [])
    # Lowercase + snake_case column names so the rest of the app works
    df.columns = [c.strip().lower().replace(" ", "_") for c in df.columns]
    return df

def compute_kpi_from_df(df: pd.DataFrame) -> dict:
    """Replicate the MongoDB $facet KPI pipeline using pandas."""

    # detect column names flexibly
    def col(keywords):
        for k in keywords:
            match = next((c for c in df.columns if k in c), None)
            if match:
                return match
        return None

    units_col    = col(["units_produced"])
    defect_col   = col(["defective_units"])
    quality_col  = col(["quality_score"])
    oee_col      = col(["oee"])
    energy_col   = col(["energy"])
    downtime_col = col(["downtime"])
    plant_col    = col(["plant_id"])
    shift_col    = col(["shift"])
    product_col  = col(["product_type"])

    overall = {
        "total_records":   len(df),
        "total_units":     int(df[units_col].sum())    if units_col    else 0,
        "total_defective": int(df[defect_col].sum())   if defect_col   else 0,
        "avg_quality":     float(df[quality_col].mean()) if quality_col else 0,
        "avg_oee":         float(df[oee_col].mean())   if oee_col      else 0,
        "avg_energy":      float(df[energy_col].mean()) if energy_col  else 0,
        "avg_downtime":    float(df[downtime_col].mean()) if downtime_col else 0,
    }

    def group(by_col, metrics):
        if not by_col or by_col not in df.columns:
            return []
        agg = {}
        for name, src, fn in metrics:
            if src and src in df.columns:
                agg[name] = (src, fn)
        if not agg:
            return []
        g = df.groupby(by_col).agg(**{k: v for k, v in agg.items()}).reset_index()
        g.rename(columns={by_col: "_id"}, inplace=True)
        return g.to_dict("records")

    by_plant   = group(plant_col,   [("avg_quality","quality_score" if quality_col else None,"mean"),
                                      ("avg_oee", oee_col,"mean"),
                                      ("total_units", units_col,"sum"),
                                      ("avg_defect", defect_col,"mean")])
    by_shift   = group(shift_col,   [("avg_quality", quality_col,"mean"),
                                      ("avg_oee", oee_col,"mean"),
                                      ("total_units", units_col,"sum")])
    by_product = group(product_col, [("avg_quality", quality_col,"mean"),
                                      ("total_units", units_col,"sum"),
                                      ("avg_defect", defect_col,"mean")])

    return {"overall": [overall], "by_plant": by_plant,
            "by_shift": by_shift, "by_product": by_product}

# ── Decide which path to use ──────────────────
using_csv = (data_source == "📄 Upload CSV")

if using_csv:
    if uploaded_csv is None:
        st.title("🏭 Smart Manufacturing Analytics")
        st.info("👈 Upload your **Manufacturing_Dataset.csv** in the sidebar to get started.")
        st.markdown("**Expected columns in your CSV:**")
        st.code("Production_ID, Plant_ID, Machine_ID, Operator_ID, Product_Type, Shift,\n"
                "Production_Date, Units_Produced, Defective_Units, Quality_Score,\n"
                "Energy_Consumption_kWh, Downtime_Minutes, ...")
        st.stop()
    # Load CSV once and cache in session state
    if "csv_df" not in st.session_state or st.session_state.get("csv_name") != uploaded_csv.name:
        st.session_state.csv_df  = load_csv(uploaded_csv)
        st.session_state.csv_name = uploaded_csv.name
    csv_df = st.session_state.csv_df
else:
    # MongoDB path — test connection
    try:
        db = get_db()
        db.command("ping")
    except Exception as e:
        st.error(f"❌ Cannot connect to MongoDB Atlas: {e}")
        st.info("Switch to **📄 Upload CSV** in the sidebar to use the dashboard without MongoDB, "
                "or fix your secrets (see below).")
        st.code(
            '[mongodb]\n'
            'uri     = "mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority"\n'
            'db_name = "manufacturing_db"'
        )
        st.stop()

# ─────────────────────────────────────────────
# PAGE 1 — KPI Dashboard
# ─────────────────────────────────────────────
if page == "📊 KPI Dashboard":
    st.title("🏭 Smart Manufacturing — KPI Dashboard")
    st.caption(f"{'CSV Upload' if using_csv else 'Live MongoDB Atlas'} · Refreshed: {datetime.now().strftime('%H:%M:%S')}")

    data = compute_kpi_from_df(csv_df) if using_csv else kpi_summary()
    ov   = data.get("overall", [{}])[0]

    # KPI Metric Cards
    c1, c2, c3, c4, c5 = st.columns(5)
    c1.metric("Total Records",     f"{ov.get('total_records', 0):,}")
    c2.metric("Units Produced",    f"{ov.get('total_units', 0):,}")
    c3.metric("Avg Quality Score", f"{ov.get('avg_quality', 0):.1f}")
    c4.metric("Avg OEE %",         f"{ov.get('avg_oee', 0):.1f}%")
    c5.metric("Avg Downtime (min)",f"{ov.get('avg_downtime', 0):.1f}")

    defect_pct = (ov.get("total_defective", 0) / ov.get("total_units", 1)) * 100
    st.markdown(f"**Overall Defect Rate:** `{defect_pct:.2f}%`  |  "
                f"**Avg Energy/Record:** `{ov.get('avg_energy', 0):.1f} kWh`")

    st.divider()
    col1, col2 = st.columns(2)

    # Quality by Product Type
    by_product = pd.DataFrame(data.get("by_product", []))
    if not by_product.empty:
        by_product.rename(columns={"_id": "Product Type"}, inplace=True)
        fig = px.bar(by_product, x="Product Type", y="avg_quality",
                     color="avg_defect", color_continuous_scale="RdYlGn_r",
                     title="Avg Quality Score by Product Type",
                     labels={"avg_quality": "Avg Quality", "avg_defect": "Defect %"})
        col1.plotly_chart(fig, use_container_width=True)

    # Quality Distribution Histogram
    qdist = quality_distribution()
    if qdist:
        labels = ["<60 Critical", "60-70 Poor", "70-80 Fair", "80-90 Good", "90-95 V.Good", "95+ Excellent"]
        counts = [d.get("count", 0) for d in qdist]
        colors = ["#d32f2f","#f57c00","#fbc02d","#388e3c","#1976d2","#6a1b9a"]
        fig2 = go.Figure(go.Bar(
            x=labels[:len(counts)], y=counts,
            marker_color=colors[:len(counts)],
            text=counts, textposition="outside"
        ))
        fig2.update_layout(title="Quality Score Distribution", xaxis_title="Band", yaxis_title="Count")
        col2.plotly_chart(fig2, use_container_width=True)

# ─────────────────────────────────────────────
# PAGE 2 — Plant & Shift Analysis
# ─────────────────────────────────────────────
elif page == "🏭 Plant & Shift Analysis":
    st.title("🏭 Plant & Shift Analysis")

    data = compute_kpi_from_df(csv_df) if using_csv else kpi_summary()

    col1, col2 = st.columns(2)

    # By Plant
    by_plant = pd.DataFrame(data.get("by_plant", []))
    if not by_plant.empty:
        by_plant.rename(columns={"_id": "Plant"}, inplace=True)
        by_plant["Plant"] = "Plant " + by_plant["Plant"].astype(str)

        fig = px.bar(by_plant, x="Plant", y=["avg_quality", "avg_oee"],
                     barmode="group", title="Quality & OEE by Plant",
                     labels={"value": "Score", "variable": "Metric"})
        col1.plotly_chart(fig, use_container_width=True)

        fig2 = px.scatter(by_plant, x="avg_oee", y="avg_defect",
                          size="total_units", color="Plant",
                          title="OEE vs Defect Rate (bubble = units produced)",
                          labels={"avg_oee": "Avg OEE %", "avg_defect": "Avg Defect %"})
        col2.plotly_chart(fig2, use_container_width=True)

    st.divider()

    # By Shift
    by_shift = pd.DataFrame(data.get("by_shift", []))
    if not by_shift.empty:
        by_shift.rename(columns={"_id": "Shift"}, inplace=True)
        col3, col4 = st.columns(2)

        fig3 = px.pie(by_shift, names="Shift", values="total_units",
                      title="Units Produced by Shift", hole=0.4)
        col3.plotly_chart(fig3, use_container_width=True)

        fig4 = px.bar(by_shift, x="Shift", y="avg_quality",
                      color="avg_oee", color_continuous_scale="Blues",
                      title="Quality Score by Shift",
                      labels={"avg_quality": "Avg Quality", "avg_oee": "OEE %"})
        col4.plotly_chart(fig4, use_container_width=True)

    # Downtime Heatmap
    st.subheader("⏱️ Downtime Heatmap — Plant × Shift")
    hm_raw = downtime_heatmap()
    if hm_raw:
        hm_df = pd.DataFrame([
            {"Plant": f"Plant {d['_id']['plant']}",
             "Shift": d["_id"]["shift"],
             "Avg Downtime (min)": round(d["avg_downtime"], 1)}
            for d in hm_raw if d["_id"].get("plant") and d["_id"].get("shift")
        ])
        if not hm_df.empty:
            pivot = hm_df.pivot(index="Plant", columns="Shift", values="Avg Downtime (min)")
            fig5 = px.imshow(pivot, color_continuous_scale="YlOrRd",
                             title="Avg Downtime per Plant × Shift (minutes)",
                             text_auto=True)
            st.plotly_chart(fig5, use_container_width=True)

# ─────────────────────────────────────────────
# PAGE 3 — Machine & OEE
# ─────────────────────────────────────────────
elif page == "🔧 Machine & OEE":
    st.title("🔧 Machine Performance & OEE")

    df = csv_df.copy() if using_csv else load_all_records()

    # Detect column name variants
    oee_col      = next((c for c in df.columns if "oee" in c.lower()), None)
    machine_col  = next((c for c in df.columns if "machine" in c.lower()), None)
    plant_col    = next((c for c in df.columns if "plant" in c.lower()), None)
    quality_col  = next((c for c in df.columns if "quality_score" in c.lower()), None)
    downtime_col = next((c for c in df.columns if "downtime" in c.lower()), None)

    plant_filter = st.selectbox(
        "Filter by Plant",
        ["All"] + sorted(df[plant_col].unique().tolist()) if plant_col else ["All"]
    )
    if plant_filter != "All" and plant_col:
        df = df[df[plant_col] == int(plant_filter)]

    if machine_col and oee_col:
        machine_summary = df.groupby(machine_col).agg(
            avg_oee=(oee_col, "mean"),
            avg_quality=(quality_col, "mean") if quality_col else (oee_col, "count"),
            avg_downtime=(downtime_col, "mean") if downtime_col else (oee_col, "count"),
            records=(oee_col, "count")
        ).reset_index().sort_values("avg_oee", ascending=False)

        col1, col2 = st.columns(2)

        fig = px.bar(machine_summary.head(15), x=machine_col, y="avg_oee",
                     color="avg_oee", color_continuous_scale="RdYlGn",
                     title="Top 15 Machines by OEE %",
                     labels={oee_col: "OEE %", machine_col: "Machine ID"})
        col1.plotly_chart(fig, use_container_width=True)

        fig2 = px.scatter(machine_summary, x="avg_oee", y="avg_downtime",
                          size="records", color="avg_quality",
                          color_continuous_scale="RdYlGn",
                          title="OEE vs Downtime by Machine",
                          labels={"avg_oee": "Avg OEE %", "avg_downtime": "Avg Downtime (min)",
                                  "avg_quality": "Avg Quality"})
        col2.plotly_chart(fig2, use_container_width=True)

        st.subheader("Machine Ranking Table")
        machine_summary["oee_class"] = machine_summary["avg_oee"].apply(
            lambda x: "🌟 World-Class" if x >= 85 else ("✅ Good" if x >= 70 else ("⚠️ Average" if x >= 60 else "❌ Poor"))
        )
        st.dataframe(machine_summary.round(2), use_container_width=True, height=300)

# ─────────────────────────────────────────────
# PAGE 4 — Operator Leaderboard
# ─────────────────────────────────────────────
elif page == "👷 Operator Leaderboard":
    st.title("👷 Operator Performance Leaderboard")

    n = st.slider("Show top N operators", 5, 50, 10)

    if using_csv:
        df = csv_df.copy()
        op_col  = next((c for c in df.columns if "operator" in c), None)
        q_col   = next((c for c in df.columns if "quality_score" in c), None)
        oee_col = next((c for c in df.columns if "oee" in c), None)
        def_col = next((c for c in df.columns if "defective" in c), None)
        u_col   = next((c for c in df.columns if "units_produced" in c), None)
        if op_col:
            agg = {k: v for k, v in {
                "avg_quality": (q_col, "mean") if q_col else None,
                "avg_oee":     (oee_col, "mean") if oee_col else None,
                "avg_defect":  (def_col, "mean") if def_col else None,
                "total_units": (u_col, "sum") if u_col else None,
                "records":     (op_col, "count"),
            }.items() if v}
            ops_raw = df.groupby(op_col).agg(**agg).reset_index()\
                        .sort_values("avg_quality" if "avg_quality" in agg else "records", ascending=False)\
                        .head(n)
            ops_raw.rename(columns={op_col: "_id"}, inplace=True)
            ops = ops_raw.to_dict("records")
        else:
            ops = []
    else:
        ops = top_operators(n)

    if ops:
        ops_df = pd.DataFrame(ops).rename(columns={
            "_id": "Operator ID", "avg_quality": "Avg Quality",
            "avg_oee": "Avg OEE %", "avg_defect": "Avg Defect %",
            "total_units": "Total Units", "records": "Records"
        })
        ops_df["Rank"] = range(1, len(ops_df) + 1)
        ops_df = ops_df[["Rank","Operator ID","Avg Quality","Avg OEE %","Avg Defect %","Total Units","Records"]]

        col1, col2 = st.columns(2)
        fig = px.bar(ops_df, x="Operator ID", y="Avg Quality",
                     color="Avg Defect %", color_continuous_scale="RdYlGn_r",
                     title=f"Top {n} Operators — Quality Score",
                     text=ops_df["Avg Quality"].round(1))
        fig.update_traces(textposition="outside")
        col1.plotly_chart(fig, use_container_width=True)

        fig2 = px.scatter(ops_df, x="Avg OEE %", y="Avg Quality",
                          size="Total Units", color="Avg Defect %",
                          color_continuous_scale="RdYlGn_r",
                          hover_name="Operator ID",
                          title="OEE vs Quality (bubble = units produced)")
        col2.plotly_chart(fig2, use_container_width=True)

        st.dataframe(ops_df.round(2), use_container_width=True)

# ─────────────────────────────────────────────
# PAGE 5 — Energy & Downtime
# ─────────────────────────────────────────────
elif page == "⚡ Energy & Downtime":
    st.title("⚡ Energy Consumption & Downtime Trends")

    if using_csv:
        df = csv_df.copy()
        date_col   = next((c for c in df.columns if "date" in c), None)
        energy_col = next((c for c in df.columns if "energy" in c), None)
        oee_col    = next((c for c in df.columns if "oee" in c), None)
        if date_col:
            df[date_col] = pd.to_datetime(df[date_col])
            df["week"] = df[date_col].dt.strftime("%Y-W%V")
            grp_cols = {"Records": (date_col, "count")}
            if energy_col: grp_cols["Avg Energy (kWh)"] = (energy_col, "mean")
            if oee_col:    grp_cols["Avg OEE %"]        = (oee_col,    "mean")
            trend_df = df.groupby("week").agg(**grp_cols).reset_index().rename(columns={"week": "Week"})
            if "Avg Energy (kWh)" in trend_df:
                fig = px.line(trend_df, x="Week", y="Avg Energy (kWh)", markers=True,
                              title="Weekly Avg Energy Consumption (kWh)")
                st.plotly_chart(fig, use_container_width=True)
            if "Avg OEE %" in trend_df:
                fig2 = px.area(trend_df, x="Week", y="Avg OEE %",
                               title="Weekly OEE % Trend", color_discrete_sequence=["#1976d2"])
                st.plotly_chart(fig2, use_container_width=True)
    else:
        trend = energy_trend()
        if trend:
            trend_df = pd.DataFrame([{
                "Week": f"{d['_id']['year']}-W{d['_id'].get('week', 0):02d}",
                "Avg Energy (kWh)": round(d["avg_energy"], 2),
                "Avg OEE %": round(d["avg_oee"], 1),
                "Records": d["count"]
            } for d in trend])
            fig = px.line(trend_df, x="Week", y="Avg Energy (kWh)", markers=True,
                          title="Weekly Avg Energy Consumption (kWh)")
            st.plotly_chart(fig, use_container_width=True)
            fig2 = px.area(trend_df, x="Week", y="Avg OEE %",
                           title="Weekly OEE % Trend", color_discrete_sequence=["#1976d2"])
            st.plotly_chart(fig2, use_container_width=True)

    # Histograms — same for both sources
    df2 = csv_df.copy() if using_csv else load_all_records()
    energy_col   = next((c for c in df2.columns if "energy" in c.lower()), None)
    downtime_col = next((c for c in df2.columns if "downtime" in c.lower()), None)

    col1, col2 = st.columns(2)
    if energy_col:
        fig3 = px.histogram(df2, x=energy_col, nbins=30,
                            title="Energy Consumption Distribution",
                            labels={energy_col: "kWh"}, color_discrete_sequence=["#f57c00"])
        col1.plotly_chart(fig3, use_container_width=True)
    if downtime_col:
        fig4 = px.histogram(df2, x=downtime_col, nbins=30,
                            title="Downtime Distribution",
                            labels={downtime_col: "Minutes"}, color_discrete_sequence=["#d32f2f"])
        col2.plotly_chart(fig4, use_container_width=True)

# ─────────────────────────────────────────────
# PAGE 6 — Data Explorer
# ─────────────────────────────────────────────
elif page == "🔍 Data Explorer":
    st.title("🔍 Data Explorer")

    df = csv_df.copy() if using_csv else load_all_records()
    st.caption(f"{len(df):,} total records loaded from MongoDB")

    col1, col2, col3 = st.columns(3)
    shift_col   = next((c for c in df.columns if c in ["shift","schedule_shift"]), None)
    plant_col   = next((c for c in df.columns if "plant" in c.lower()), None)
    product_col = next((c for c in df.columns if "product" in c.lower()), None)

    if shift_col:
        shifts = col1.multiselect("Shift", sorted(df[shift_col].dropna().unique()), default=None)
    if plant_col:
        plants = col2.multiselect("Plant ID", sorted(df[plant_col].dropna().unique()), default=None)
    if product_col:
        products = col3.multiselect("Product Type", sorted(df[product_col].dropna().unique()), default=None)

    filtered = df.copy()
    if shift_col and shifts:
        filtered = filtered[filtered[shift_col].isin(shifts)]
    if plant_col and plants:
        filtered = filtered[filtered[plant_col].isin(plants)]
    if product_col and products:
        filtered = filtered[filtered[product_col].isin(products)]

    st.write(f"Showing **{len(filtered):,}** records")
    st.dataframe(filtered.head(500), use_container_width=True, height=400)

    # Download
    csv = filtered.to_csv(index=False).encode("utf-8")
    st.download_button("⬇️ Download filtered CSV", csv,
                       "manufacturing_filtered.csv", "text/csv")
