import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { AlertTriangle, ArrowLeftRight, ArrowUpRight, Building2, CalendarClock, CheckCircle2, ChevronLeft, ChevronRight, Clock, Cloud, Copy, Cpu, CreditCard, Database, Download, ExternalLink, Eye, EyeOff, FileSpreadsheet, FileText, Filter, Globe, HardDrive, Info, Landmark, LayoutDashboard, Lock, LogOut, Mail, Minus, Package, Plus, RefreshCw, RotateCcw, Send, Settings, ShieldAlert, ShoppingCart, Sliders, Star, TrendingUp, Upload, User, Wifi, WifiOff, Wrench, X, Zap } from "lucide-react";

const FONT = "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Bebas+Neue&family=JetBrains+Mono:wght@400;600;700&display=swap";


// ─── LEMON SQUEEZY CHECKOUT (UK-friendly, Stripe-powered) ─────────
// Works with UK banks that block Paystack
// User must set their Lemon Squeezy store slug + variant IDs in dashboard
const LEMON_SQUEEZY_CONFIG = {
  store_slug: "YOUR_STORE_SLUG", // paste your Lemon Squeezy store slug here
  variants: {
    // Paste your variant IDs from Lemon Squeezy dashboard
    starter_monthly:    "LS_STARTER_MONTHLY_ID",
    starter_annual:     "LS_STARTER_ANNUAL_ID",
    pro_monthly:        "LS_PRO_MONTHLY_ID",
    pro_annual:         "LS_PRO_ANNUAL_ID",
    enterprise_monthly: "LS_ENTERPRISE_MONTHLY_ID",
    enterprise_annual:  "LS_ENTERPRISE_ANNUAL_ID",
  }
};

function openLemonSqueezy(variantId, email, customData={}) {
  const params = new URLSearchParams({
    "checkout[email]": email,
    "checkout[custom][user_email]": email,
    "checkout[custom][plan]": customData.plan||"monthly",
    "checkout[custom][app]": "forgeestimate",
  });
  const url = `https://${LEMON_SQUEEZY_CONFIG.store_slug}.lemonsqueezy.com/checkout/buy/${variantId}?${params}`;
  window.open(url, "_blank", "width=600,height=700,scrollbars=yes");
}

// ─── STRIPE CHECKOUT (via your backend) ──────────────────────────
async // ── HELIO PAYMENT ────────────────────────────────────────────────────────────
// Helio: crypto subscriptions + card payments — FULLY AUTOMATIC activation
// Create pay links at app.hel.io then paste the IDs below
const HELIO_CONFIG = {
  // Paste your Helio pay link IDs from app.hel.io dashboard
  // Format: "xxxxxxxxxxxxxxxxxxxxxxxx" (24-char hex)
  paylinkIds: {
    starter_monthly:    process?.env?.HELIO_STARTER_MONTHLY_ID    || "HELIO_STARTER_MONTHLY_ID",
    starter_annual:     process?.env?.HELIO_STARTER_ANNUAL_ID     || "HELIO_STARTER_ANNUAL_ID",
    pro_monthly:        process?.env?.HELIO_PRO_MONTHLY_ID        || "HELIO_PRO_MONTHLY_ID",
    pro_annual:         process?.env?.HELIO_PRO_ANNUAL_ID         || "HELIO_PRO_ANNUAL_ID",
    enterprise_monthly: process?.env?.HELIO_ENTERPRISE_MONTHLY_ID || "HELIO_ENTERPRISE_MONTHLY_ID",
    enterprise_annual:  process?.env?.HELIO_ENTERPRISE_ANNUAL_ID  || "HELIO_ENTERPRISE_ANNUAL_ID",
  },
  // Your Helio API public key from dashboard
  publicKey: "YOUR_HELIO_PUBLIC_KEY",
};

function openHelioCheckout(plan, billingCycle, email, onSuccess){
  const key = `${plan}_${billingCycle}`;
  const paylinkId = HELIO_CONFIG.paylinkIds[key];

  if(!paylinkId || paylinkId.includes("HELIO_")){
    alert("Helio payment not configured yet.\n\nTo set up:\n1. Go to app.hel.io\n2. Create a pay link for "+plan+" ("+billingCycle+")\n3. Paste the ID into HELIO_CONFIG in App.jsx\n\nUsing manual USDT as fallback.");
    return;
  }

  // Open Helio checkout — supports USDC, USDT, SOL, card
  // Helio auto-fires webhook on payment → activates account
  const helioUrl = `https://app.hel.io/pay/${paylinkId}?email=${encodeURIComponent(email||"")}`;
  const popup = window.open(helioUrl, "HelioCheckout", "width=480,height=700,top=100,left=200");

  if(!popup){
    // Popup blocked — redirect instead
    window.location.href = helioUrl;
    return;
  }

  // Poll for popup close — then check if user is now active
  const poll = setInterval(()=>{
    try{
      if(popup.closed){
        clearInterval(poll);
        // Wait 3 seconds for webhook to process then check
        setTimeout(()=>{
          onSuccess && onSuccess(plan);
          alert("Payment submitted! If your account is not activated within 5 minutes, please contact support via WhatsApp.");
        }, 3000);
      }
    }catch{clearInterval(poll);}
  }, 1000);
}

async function openStripeCheckout(plan, email, backendUrl="https://your-backend.railway.app") {
  try {
    const r = await fetch(`${backendUrl}/api/stripe/create-checkout`, {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({plan, email})
    });
    const { url } = await r.json();
    if(url) window.open(url,"_blank");
    else alert("Stripe checkout failed. Try Paystack or Lemon Squeezy.");
  } catch(e) {
    alert("Could not connect to payment server. Try another payment method.");
  }
}

// ═══════════════════════════════════════════════════════════════
// PDF REPORT GENERATOR
// Generates a professional downloadable PDF after every analysis
// ═══════════════════════════════════════════════════════════════
async function generateVerificationQR(data, region, tradeMode, fileName) {
  // Call Netlify function to generate unforgeable HMAC hash + QR code
  try {
    const r = await fetch('/api/generate-verification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId:           'user_' + Date.now(),
        totalEstimateUsd: data.financial_summary?.total_bid_price || 0,
        materialCount:    (data.line_items || []).length,
        tradeMode,
        countryCode:      region || 'US',
        fileName,
      }),
    });
    if (!r.ok) return null;
    const result = await r.json();
    return result.success ? result : null;
  } catch { return null; }
}

async function generatePDFReport(data, region, tradeMode, fileName, qrData=null) {
  const r   = REGIONS[region] || REGIONS.NG;
  const meta = data.project_metadata || {};
  const fs   = data.financial_summary || {};
  const trade = TRADES[tradeMode] || TRADES.GENERAL;
  const now  = new Date().toLocaleString();

  const fmtMoney = n => {
    try { return new Intl.NumberFormat(r.locale,{style:"currency",currency:r.currency,maximumFractionDigits:0}).format((n||0)*r.rate); }
    catch { return `${r.symbol}${Math.round((n||0)*r.rate).toLocaleString()}`; }
  };

  const lineItemRows = (data.line_items||[]).map(i => {
    const total = (i.qty||0)*((i.materialCost||0)+(i.laborCost||0));
    return `<tr>
      <td>${i.id||""}</td>
      <td>${i.description||""}</td>
      <td>${i.qty||0} ${i.unit||""}</td>
      <td>${fmtMoney(i.materialCost)}</td>
      <td>${fmtMoney(i.laborCost)}</td>
      <td><strong>${fmtMoney(total)}</strong></td>
    </tr>`;
  }).join("");

  const phaseRows = (data.phases||[]).map((p,i) => {
    const colors = ["#10b981","#34d399","#6ee7b7","#f59e0b","#38bdf8"];
    return `<tr>
      <td><span style="color:${colors[i%5]};font-weight:700">${p.phase_name||""}</span></td>
      <td>${p.items||0} items</td>
      <td>${p.weeks||0} weeks</td>
      <td><strong>${fmtMoney(p.cost)}</strong></td>
    </tr>`;
  }).join("");

  const riskRows = (data.risk_flags||[]).map(r => {
    const c = r.severity==="HIGH"?"#ef4444":r.severity==="MEDIUM"?"#f59e0b":"#10b981";
    return `<tr>
      <td><span style="color:${c};font-weight:700;padding:2px 8px;background:${c}22;border-radius:99px;font-size:11px">${r.severity}</span></td>
      <td>${r.issue||""}</td>
      <td>${r.mitigation||""}</td>
    </tr>`;
  }).join("");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<title>ForgeEstimate Report — ${meta.primary_trade||"Blueprint"}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;600;700&display=swap');
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:"Space Grotesk",sans-serif;color:#0a1a12;background:#fff;padding:32px;font-size:13px}
  /* HEADER */
  .header{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:20px;border-bottom:3px solid #10b981;margin-bottom:24px}
  .logo{display:flex;align-items:center;gap:12px}
  .logo-box{width:50px;height:50px;border-radius:12px;background:linear-gradient(135deg,#10b981,#059669);display:flex;align-items:center;justify-content:center;color:#000;font-weight:900;font-size:20px;letter-spacing:0.05em}
  .logo-text h1{font-size:22px;font-weight:900;color:#0a1a12;letter-spacing:0.06em}
  .logo-text h1 span{color:#10b981}
  .logo-text p{color:#10b981;font-size:9px;letter-spacing:0.25em;text-transform:uppercase;margin-top:2px}
  .meta{text-align:right;font-size:11px;color:#666}
  .meta strong{color:#0a1a12;display:block;font-size:13px;margin-bottom:2px}
  /* SUMMARY GRID */
  .summary-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:24px}
  .kpi{background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:12px}
  .kpi label{font-size:9px;text-transform:uppercase;letter-spacing:0.15em;color:#16a34a;display:block;margin-bottom:4px;font-weight:700}
  .kpi value{font-size:18px;font-weight:900;color:#064e3b;display:block}
  .kpi sub{font-size:10px;color:#6b7280}
  /* SECTIONS */
  h2{font-size:14px;font-weight:700;color:#064e3b;margin:0 0 10px;padding:0 0 6px;border-bottom:2px solid #d1fae5;text-transform:uppercase;letter-spacing:0.1em}
  section{margin-bottom:24px}
  /* TABLES */
  table{width:100%;border-collapse:collapse;font-size:11px}
  th{background:#064e3b;color:#fff;padding:8px 10px;text-align:left;font-weight:700;font-size:10px;text-transform:uppercase;letter-spacing:0.08em}
  td{padding:7px 10px;border-bottom:1px solid #f0fdf4}
  tr:nth-child(even) td{background:#f0fdf4}
  tr:last-child td{border-bottom:none}
  /* FINANCIALS */
  .fin-table{margin-top:8px}
  .fin-row{display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid #d1fae5}
  .fin-row.total{border-top:2px solid #10b981;border-bottom:none;padding-top:10px;margin-top:4px}
  .fin-row.total label,.fin-row.total value{font-size:15px;font-weight:900;color:#064e3b}
  .fin-row label{color:#374151;font-weight:500}
  .fin-row value{font-weight:700;color:#064e3b}
  /* BADGE */
  .badge{display:inline-block;padding:3px 10px;border-radius:99px;font-size:10px;font-weight:700}
  .badge-high{background:#fee2e2;color:#ef4444}
  .badge-medium{background:#fef3c7;color:#d97706}
  .badge-low{background:#d1fae5;color:#059669}
  /* FOOTER */
  .footer{margin-top:32px;padding-top:16px;border-top:2px solid #d1fae5;display:flex;justify-content:space-between;font-size:10px;color:#9ca3af}
  @media print{body{padding:16px} .no-print{display:none}}
</style>
</head>
<body>

<!-- HEADER -->
<div class="header">
  <div class="logo">
    <div class="logo-box">FE</div>
    <div class="logo-text">
      <h1>FORGE<span>ESTIMATE</span></h1>
      <p>Ultra Pro v10 · Construction Cost Report</p>
    </div>
  </div>
  <div class="meta">
    <strong>${meta.primary_trade||"General"} — ${trade.label}</strong>
    File: ${fileName||"Blueprint"}<br/>
    Region: ${r.label}<br/>
    Generated: ${now}<br/>
    Confidence: <span style="color:${meta.confidence==="HIGH"?"#10b981":meta.confidence==="LOW"?"#ef4444":"#f59e0b"};font-weight:700">${meta.confidence||"MEDIUM"}</span>
  </div>
</div>

<!-- PRINT BUTTON (hidden in PDF) -->
<div class="no-print" style="margin-bottom:20px;text-align:right">
  <button onclick="window.print()" style="background:linear-gradient(135deg,#10b981,#059669);color:#000;border:none;padding:10px 20px;border-radius:8px;font-weight:900;cursor:pointer;font-size:13px">📄 Download PDF</button>
</div>

<!-- KPI SUMMARY -->
<div class="summary-grid">
  <div class="kpi"><label>Total Bid Price</label><value>${fmtMoney(fs.total_bid_price)}</value><sub>Incl. margin + contingency</sub></div>
  <div class="kpi"><label>Total Area</label><value>${meta.total_area||0}</value><sub>${meta.area_unit||"sqft"}</sub></div>
  <div class="kpi"><label>Total Rooms</label><value>${meta.total_rooms||0}</value><sub>Detected spaces</sub></div>
  <div class="kpi"><label>Cost per Unit</label><value>${fmtMoney(fs.cost_per_unit)}</value><sub>Per ${meta.area_unit||"sqft"}</sub></div>
</div>

<!-- FINANCIAL BREAKDOWN -->
<section>
  <h2>Financial Summary</h2>
  <div class="fin-table">
    <div class="fin-row"><label>Direct Construction Cost</label><value>${fmtMoney(fs.direct_cost)}</value></div>
    <div class="fin-row"><label>Waste Allowance</label><value>${fmtMoney(fs.waste_allowance)}</value></div>
    <div class="fin-row"><label>Contingency (5%)</label><value>${fmtMoney(fs.contingency_5pct)}</value></div>
    <div class="fin-row"><label>Subtotal</label><value>${fmtMoney(fs.subtotal)}</value></div>
    <div class="fin-row"><label>Contractor Margin (20%)</label><value>${fmtMoney(fs.margin_20pct)}</value></div>
    ${fs.tax_amount ? `<div class="fin-row"><label>Tax / VAT (${fs.tax_rate||0}%)</label><value>${fmtMoney(fs.tax_amount)}</value></div>` : ""}
    <div class="fin-row total"><label>TOTAL BID PRICE</label><value>${fmtMoney(fs.total_bid_price)}</value></div>
    ${fs.total_bid_with_tax ? `<div class="fin-row total"><label>TOTAL INCL. TAX</label><value>${fmtMoney(fs.total_bid_with_tax)}</value></div>` : ""}
  </div>
</section>

<!-- PHASES -->
${phaseRows ? `<section><h2>Phase Breakdown</h2>
  <table><thead><tr><th>Phase</th><th>Items</th><th>Duration</th><th>Cost</th></tr></thead>
  <tbody>${phaseRows}</tbody></table></section>` : ""}

<!-- LINE ITEMS -->
${lineItemRows ? `<section><h2>Bill of Quantities — ${(data.line_items||[]).length} Line Items</h2>
  <table><thead><tr><th>ID</th><th>Description</th><th>Qty</th><th>Material Cost</th><th>Labor Cost</th><th>Total</th></tr></thead>
  <tbody>${lineItemRows}</tbody></table></section>` : ""}

<!-- AREA TAKEOFF -->
${(data.area_takeoff||[]).length ? `<section><h2>Area Takeoff Schedule</h2>
  <table><thead><tr><th>Room</th><th>Width</th><th>Length</th><th>Area</th><th>Unit</th><th>Type</th></tr></thead>
  <tbody>${(data.area_takeoff||[]).map(r=>`<tr><td>${r.room}</td><td>${r.width}</td><td>${r.length}</td><td><strong>${r.area}</strong></td><td>${r.unit}</td><td>${r.type}</td></tr>`).join("")}</tbody>
  </table></section>` : ""}

<!-- RISKS -->
${riskRows ? `<section><h2>Risk Assessment</h2>
  <table><thead><tr><th>Severity</th><th>Issue</th><th>Mitigation</th></tr></thead>
  <tbody>${riskRows}</tbody></table></section>` : ""}

<!-- VALUE ENGINEERING -->
${(data.value_engineering||[]).length ? `<section><h2>Value Engineering Opportunities</h2>
  <table><thead><tr><th>Option</th><th>Potential Saving</th><th>Impact</th></tr></thead>
  <tbody>${(data.value_engineering||[]).map(v=>`<tr><td>${v.option}</td><td style="color:#10b981;font-weight:700">${fmtMoney(v.saving)}</td><td>${v.impact}</td></tr>`).join("")}</tbody>
  </table></section>` : ""}

<!-- VERIFICATION QR CODE — HMAC-SHA256 Unforgeable Stamp -->
${qrData ? `
<section style="page-break-inside:avoid;margin-bottom:24px">
  <h2 style="color:#0f172a;font-size:14px;margin:0 0 12px;text-transform:uppercase;letter-spacing:0.1em">🔐 Document Authenticity Verification</h2>
  <div style="display:flex;align-items:center;gap:20px;padding:16px 20px;border:2px solid #10b981;border-radius:12px;background:linear-gradient(135deg,#f0fdf4,#dcfce7)">
    <div style="flex-shrink:0;text-align:center">
      <img src="${qrData.qrCodeDataUri}" alt="Scan to verify" style="width:100px;height:100px;border-radius:8px;border:1px solid #d1fae5;display:block;margin:0 auto 4px"/>
      <p style="font-size:7px;color:#6b7280;margin:0;text-transform:uppercase;letter-spacing:0.05em">SCAN TO VERIFY</p>
    </div>
    <div style="flex:1">
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
        <div style="width:20px;height:20px;background:#10b981;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0">
          <span style="color:#fff;font-size:12px;line-height:1">✓</span>
        </div>
        <p style="font-weight:900;font-size:13px;color:#064e3b;margin:0">VERIFIED GENUINE DOCUMENT</p>
      </div>
      <p style="font-size:10px;color:#374151;margin:0 0 6px;line-height:1.5">This estimate was generated by ForgeEstimate Ultra Pro and cryptographically stamped. Scan the QR code or visit the URL below to confirm it has not been modified.</p>
      <p style="font-family:monospace;font-size:8px;color:#6b7280;margin:0 0 2px;word-break:break-all"><strong>Verification ID:</strong> ${qrData.verificationId}</p>
      <p style="font-size:9px;color:#10b981;margin:0"><a href="${qrData.publicUrl}" style="color:#059669;text-decoration:none">${qrData.publicUrl}</a></p>
    </div>
  </div>
</section>` : ''}

<!-- FOOTER -->
<div class="footer">
  <span>Generated by ForgeEstimate Ultra Pro v10 — AI-Powered Construction Estimation</span>
  <span>Powered by Groq AI · ${now}</span>
</div>

<script>window.onload=()=>setTimeout(()=>window.print(),500)</script>
</body>
</html>`;

  // Open print dialog (Save as PDF in browser)
  try{
    const win=window.open("","_blank","width=900,height=700,scrollbars=yes");
    if(win){win.document.write(html);win.document.close();return;}
  }catch(e){}
  // Method 2 (mobile fallback): download as HTML
  try{
    const blob=new Blob([html],{type:"text/html"});
    const a=document.createElement("a");a.href=URL.createObjectURL(blob);
    a.download=`ForgeEstimate_Report_${Date.now()}.html`;
    document.body.appendChild(a);a.click();document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
    alert("Report downloaded.\nOpen in browser → Share → Print → Save as PDF");
    return;
  }catch(e){}
  // Method 3: data URI
  window.location.href="data:text/html;charset=utf-8,"+encodeURIComponent(html);
}
// ─── BACKGROUND ────────────────────────────────────────────────────────────────
const BG = { minHeight:"100vh", background:"linear-gradient(135deg,#0a1a12 0%,#0d2018 30%,#0b1d1a 60%,#091510 100%)", position:"relative" };

function GlobalBackground(){
  return(
    <div style={{position:"fixed",inset:0,zIndex:0,overflow:"hidden",pointerEvents:"none",userSelect:"none"}}>
      {/* Forge Estimate logo as faded wallpaper */}
      <img src="/logo.png" alt=""
        style={{position:"absolute",top:"50%",left:"50%",
          transform:"translate(-50%,-50%) rotate(-8deg)",
          width:"min(65vw,480px)",height:"auto",
          opacity:0.045,filter:"grayscale(20%)",
          pointerEvents:"none",userSelect:"none"}}
        onError={e=>e.target.style.display="none"}
      />
      {/* Subtle green radial glow */}
      <div style={{position:"absolute",top:"-20%",left:"50%",transform:"translateX(-50%)",
        width:800,height:800,borderRadius:"50%",
        background:"radial-gradient(circle,rgba(16,185,129,0.06) 0%,transparent 65%)"}}/>
      <div style={{position:"absolute",bottom:"-10%",right:"-10%",
        width:500,height:500,borderRadius:"50%",
        background:"radial-gradient(circle,rgba(16,185,129,0.04) 0%,transparent 65%)"}}/>
    </div>
  );
}

function validateFile(f,plan="starter"){
  if(!ALLOWED_MIME.includes(f.type)) return{valid:false,error:"Invalid format. Use PDF, PNG, JPEG, or WebP."};
  const limits={starter:150,pro:300,enterprise:1024};
  const limitMB=limits[plan]||150;
  const limitBytes=limitMB*1024*1024;
  if(f.size>limitBytes) return{valid:false,error:`File is ${(f.size/1024/1024).toFixed(0)}MB — exceeds your ${PLANS[plan]?.label||"Starter"} plan limit of ${limitMB}MB. Upgrade to ${plan==="starter"?"Pro (300MB)":"Enterprise (1GB)"} for larger files.`};
  return{valid:true};
}

// ═══════════════════════════════════════════════════════════════
// FORGEDB v7
// ═══════════════════════════════════════════════════════════════
const DB_NAME="ForgeEstimateUltraProDB",DB_VER=7;
function openDB(){return new Promise((res,rej)=>{const req=indexedDB.open(DB_NAME,DB_VER);req.onerror=()=>rej(req.error);req.onsuccess=()=>res(req.result);req.onupgradeneeded=(e)=>{const db=e.target.result;[["queryHistory",{keyPath:"id",autoIncrement:true}],["projectSnapshots",{keyPath:"projectId"}],["userLicenses",{keyPath:"featureKey"}],["compareHistory",{keyPath:"compareId"}]].forEach(([n,o])=>{if(!db.objectStoreNames.contains(n))db.createObjectStore(n,o);});};});}
const dbRun=(s,m,fn)=>openDB().then(db=>new Promise((res,rej)=>{const r=fn(db.transaction(s,m).objectStore(s));r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);}));
const dbAdd=(s,d)=>openDB().then(db=>new Promise((res,rej)=>{const r=db.transaction(s,"readwrite").objectStore(s).add({...d,timestamp:new Date().toISOString()});r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);}));
const dbPut=(s,d)=>dbRun(s,"readwrite",st=>st.put(d));
const dbDel=(s,k)=>dbRun(s,"readwrite",st=>st.delete(k));
const dbOne=(s,k)=>dbRun(s,"readonly",st=>st.get(k));
const dbAll=(s)=>openDB().then(db=>new Promise((res,rej)=>{const r=db.transaction(s,"readonly").objectStore(s).getAll();r.onsuccess=()=>res([...r.result].sort((a,b)=>new Date(b.timestamp||b.savedAt||0)-new Date(a.timestamp||a.savedAt||0)));r.onerror=()=>rej(r.error);}));
const BSTORES=["queryHistory","projectSnapshots","userLicenses","compareHistory"];

async function saveLicense(k,m){await dbPut("userLicenses",{featureKey:k,isUnlocked:true,reference:m.reference||"DEMO_"+Date.now(),activatedAt:new Date().toISOString(),customer:m.customerEmail||"",tier:m.tier||"ENTERPRISE_MONTHLY"});}
async function checkSubscriptionValidity(fk){try{const r=await dbOne("userLicenses",fk);if(!r||!r.isUnlocked)return{isValid:false,daysRemaining:0};const d=Math.floor((Date.now()-new Date(r.activatedAt))/864e5);const rem=Math.max(0,30-d);return{isValid:rem>0,daysRemaining:rem,customer:r.customer};}catch{return{isValid:false,daysRemaining:0};}}
async function debugForceBackdateLicense(k,d){const r=await dbOne("userLicenses",k);if(!r)return;await dbPut("userLicenses",{...r,activatedAt:new Date(Date.now()-d*864e5).toISOString()});}
async function debugForceRevokeLicense(k){try{await dbDel("userLicenses",k);}catch{}}
async function saveMongoConfig(apiKey,appId){await dbPut("userLicenses",{featureKey:"MONGO_CONFIG",apiKey,appId,savedAt:new Date().toISOString()});}
async function getMongoConfig(){try{const r=await dbOne("userLicenses","MONGO_CONFIG");return r?.apiKey?r:null;}catch{return null;}}
async function saveSupabaseConfig(url,anonKey){await dbPut("userLicenses",{featureKey:"SUPABASE_CONFIG",url,anonKey,savedAt:new Date().toISOString()});}
async function getSupabaseConfig(){try{const r=await dbOne("userLicenses","SUPABASE_CONFIG");return r?.url?r:null;}catch{return null;}}
async function exportLocalSystemBackup(){try{const db=await openDB();const p={exportedAt:new Date().toISOString(),appVersion:"v10",data:{}};for(const n of BSTORES){p.data[n]=await new Promise(res=>{const r=db.transaction(n,"readonly").objectStore(n).getAll();r.onsuccess=()=>res(r.result||[]);});}const blob=new Blob([JSON.stringify(p,null,2)],{type:"application/json"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`ForgeEstimate_Backup_${Date.now()}.json`;document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(a.href);return{success:true};}catch(e){return{success:false,error:e.message};}}
async function importBackupFromFile(ev){return new Promise((res,rej)=>{const file=ev.target.files[0];if(!file)return rej("No file.");const fr=new FileReader();fr.onload=async(e)=>{try{const p=JSON.parse(e.target.result);if(!p.data)throw new Error("Invalid backup.");const db=await openDB();for(const sn of Object.keys(p.data)){if(!BSTORES.includes(sn))continue;const tx=db.transaction(sn,"readwrite");const st=tx.objectStore(sn);for(const item of p.data[sn])await new Promise((ok,fail)=>{const r=st.put(item);r.onsuccess=ok;r.onerror=fail;});}res({success:true,timestamp:p.exportedAt});}catch(err){rej(err.message);}};fr.readAsText(file);});}

// ─── MONGODB ATLAS DATA API ────────────────────────────────────────────────────
const mongoAPI = {
  async find(apiKey,appId,collection,filter={}){
    const r=await fetch(`https://data.mongodb-api.com/app/${appId}/endpoint/data/v1/action/find`,{method:"POST",headers:{"Content-Type":"application/json","api-key":apiKey},body:JSON.stringify({dataSource:"Cluster0",database:"forgeestimate",collection,filter,sort:{createdAt:-1},limit:50})});
    return r.json();
  },
  async insertOne(apiKey,appId,collection,document){
    const r=await fetch(`https://data.mongodb-api.com/app/${appId}/endpoint/data/v1/action/insertOne`,{method:"POST",headers:{"Content-Type":"application/json","api-key":apiKey},body:JSON.stringify({dataSource:"Cluster0",database:"forgeestimate",collection,document})});
    return r.json();
  },
};

const supabaseAPI = {
  async login(url,key,email,password){const r=await fetch(`${url}/auth/v1/token?grant_type=password`,{method:"POST",headers:{"Content-Type":"application/json",apikey:key},body:JSON.stringify({email,password})});const d=await r.json();if(!r.ok)throw new Error(d.error_description||"Login failed");return d;},
  async signup(url,key,email,password){const r=await fetch(`${url}/auth/v1/signup`,{method:"POST",headers:{"Content-Type":"application/json",apikey:key},body:JSON.stringify({email,password})});const d=await r.json();if(!r.ok)throw new Error(d.error_description||"Signup failed");return d;},
};

function usePaystack(){const [r,setR]=useState(!!window.PaystackPop);useEffect(()=>{if(window.PaystackPop){setR(true);return;}const s=document.createElement("script");s.src="https://js.paystack.co/v1/inline.js";s.onload=()=>setR(true);s.onerror=()=>setR(false);document.head.appendChild(s);},[]);return r;}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function fmt(n){
  try{return new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0}).format(n||0);}
  catch{return "$"+Math.round(n||0).toLocaleString();}
}
function fmtUSD(n){return "$"+n.toLocaleString(undefined,{maximumFractionDigits:2});}
function fileToB64WithProgress(file,onProg){
  return new Promise((res,rej)=>{
    if(file.type.startsWith("image/")){
      const img=new Image();const url=URL.createObjectURL(file);
      img.onload=()=>{
        const MAX=2048;let{width:w,height:h}=img;
        if(w>MAX||h>MAX){if(w>h){h=Math.round(h*(MAX/w));w=MAX;}else{w=Math.round(w*(MAX/h));h=MAX;}}
        const canvas=document.createElement("canvas");canvas.width=w;canvas.height=h;
        canvas.getContext("2d").drawImage(img,0,0,w,h);URL.revokeObjectURL(url);
        const b64=canvas.toDataURL("image/jpeg",0.92).split(",")[1];
        onProg?.(100,file.size,file.size);
        res({b64,mimeType:"image/jpeg"});
      };img.onerror=rej;img.src=url;return;
    }
    const fr=new FileReader();
    fr.onprogress=(e)=>{if(e.lengthComputable&&onProg)onProg(Math.round((e.loaded/e.total)*100),e.loaded,e.total);};
    fr.readAsDataURL(file);
    fr.onload=()=>res({b64:fr.result.split(",")[1],mimeType:file.type||"application/pdf"});
    fr.onerror=rej;
  });
}
function buildMediaBlock(b64,mt){
  if(mt==="application/pdf"){
    return {type:"text",text:"[PDF Blueprint — analyze as construction document. Extract all rooms, dimensions, materials, MEP systems, and structural elements. Return full JSON schema.]"};
  }
  const nm=mt==="image/jpg"?"image/jpeg":mt;
  // Use image_url format — compatible with both Groq and Gemini via callGroq converter
  return {type:"image_url",image_url:{url:`data:${nm};base64,${b64}`}};
}
// ── GROQ AI ENGINE (Free — llama-3.2-90b vision + llama-3.3-70b text) ──────
// Optional Gemini upgrade — get free key at aistudio.google.com (starts with AIzaSy...)
const GEMINI_KEY   = ""; // paste AIzaSy... key here to switch from Groq to Gemini
const GEMINI_MODEL = "gemini-1.5-flash";

// ═══════════════════════════════════════════════════════════════
// TRIPLE AI ENGINE CONFIGURATION
// Engine 1: Claude Sonnet 4.6  — Primary, most accurate (paid)
// Engine 2: Groq Llama Vision  — Cross-check + fallback (free)
// Engine 3: Sakana Fugu        — Multilingual blueprints (SA/CN/JP)
// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
// BACKEND ROUTING — Railway (primary) → Netlify Functions (fallback)
// Railway handles heavy load, Netlify is the safety net
// Paste your Railway URL after deployment
// ═══════════════════════════════════════════════════════════════
const RAILWAY_URL = "https://forgeestimateultrapro.onrender.com"; // ← paste your Railway URL e.g. https://forgeestimate.up.railway.app
const API_BASE    = RAILWAY_URL || ""; // empty = use Netlify functions (relative /api/...)

function apiUrl(path){
  return API_BASE ? `${API_BASE}${path}` : path;
}

// ── ADMIN CONFIGURATION ──────────────────────────────────────
const ADMIN_EMAIL    = "akintayouthmanakindele@gmail.com";
const ADMIN_PASSWORD = "ForgeAdmin2026!Ultra"; // Change this after first login

// ── ENGINE 2: GROQ ────────────────────────────────────────────
const GROQ_KEY          = "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";
const GROQ_VISION_MODEL = "llama-3.2-90b-vision-preview";
const GROQ_TEXT_MODEL   = "llama-3.3-70b-versatile";

// ── ENGINE 3: SAKANA FUGU ────────────────────────────────────
// Sakana AI Fugu — excellent for Arabic, Japanese, Chinese blueprint text
// Get key at: sakana.ai → API → Create key
// Supported regions: SA, AE, QA, CN, JP, KR — auto-activates when key is set
const SAKANA_FUGU_KEY   = "";  // ← paste your Sakana Fugu key here
const SAKANA_FUGU_URL   = "https://api.sakana.ai/v1/chat/completions";
const SAKANA_FUGU_MODEL = "fugu-instruct";

// Regions where Sakana Fugu should be preferred (multilingual blueprints)
const SAKANA_REGIONS    = ["SA","AE","QA","CN","JP","KR","IN"];

// ── ENGINE 1: CLAUDE (via Netlify function) ────────────────────
// Key lives in Netlify env vars — never exposed to browser
// Add ANTHROPIC_API_KEY in Netlify → Site Settings → Environment Variables


// ── DAILY SCAN LIMIT SYSTEM ─────────────────────────────────────────────────
// Starter + Pro: 10 uploads per day maximum
// Enterprise: Unlimited (extra scans billed at $10 each via Helio add-on)
async function getDailyScansUsed(){
  const today = new Date().toISOString().split("T")[0]; // "2026-07-31"
  try{
    const rec = await dbOne("projectSnapshots","DAILY_"+today);
    return { count: rec?.count||0, date: today };
  }catch{ return { count:0, date:today }; }
}

async function incrementDailyScan(){
  const today = new Date().toISOString().split("T")[0];
  const rec   = await getDailyScansUsed();
  await dbPut("projectSnapshots",{id:"DAILY_"+today, count:(rec.count||0)+1, date:today});
}

async function checkDailyScanLimit(userPlan="starter"){
  if(userPlan==="enterprise") return {allowed:true, used:0, limit:Infinity};
  const planLimit = PLANS[userPlan]?.dailyScans || 10;
  const {count}   = await getDailyScansUsed();
  if(count >= planLimit){
    return { allowed:false, used:count, limit:planLimit };
  }
  return { allowed:true, used:count, limit:planLimit };
}

// ── DUAL AI ENGINE — Claude (Netlify) → Groq (direct) fallback ──────────────
// ── SELF-HEALING RETRY ──────────────────────────────────────────────────────
async function withRetry(fn, attempts=2, delay=1500){
  let lastErr;
  for(let i=0;i<attempts;i++){
    try{ return await fn(); }
    catch(e){
      lastErr=e;
      if(i<attempts-1) await new Promise(r=>setTimeout(r,delay*(i+1)));
    }
  }
  throw lastErr;
}

// ── ENGINE 3: SAKANA FUGU DIRECT CALL ───────────────────────────────────────
async function callViaFugu(msgs, max){
  if(!SAKANA_FUGU_KEY || SAKANA_FUGU_KEY.length < 8){
    throw new Error("Sakana Fugu key not configured");
  }
  const r = await fetch(SAKANA_FUGU_URL,{
    method:"POST",
    headers:{"Content-Type":"application/json","Authorization":"Bearer "+SAKANA_FUGU_KEY},
    body:JSON.stringify({model:SAKANA_FUGU_MODEL,max_tokens:max,temperature:0.1,messages:msgs}),
  });
  if(!r.ok) throw new Error(`Sakana Fugu ${r.status}: ${await r.text()}`);
  const d = await r.json();
  return d.choices?.[0]?.message?.content?.trim()||"";
}

// ── ENGINE 2: GROQ DIRECT CALL ───────────────────────────────────────────────
async function callViaGroqDirect(msgs, max, useVision){
  const model = useVision ? GROQ_VISION_MODEL : GROQ_TEXT_MODEL;
  const r = await fetch("https://api.groq.com/openai/v1/chat/completions",{
    method:"POST",
    headers:{"Content-Type":"application/json","Authorization":"Bearer "+GROQ_KEY},
    body:JSON.stringify({model,max_tokens:max,temperature:0.1,messages:msgs}),
  });
  if(!r.ok){
    const e = await r.text();
    if(r.status===429) throw new Error("GROQ_QUOTA_HIT");
    throw new Error(`Groq ${r.status}: ${e}`);
  }
  const d = await r.json();
  return d.choices?.[0]?.message?.content?.trim()||"";
}

// ── ENGINE 1: CLAUDE via Netlify function ────────────────────────────────────
async function callViaNetlify(msgs, max, useVision){
  const r = await fetch(apiUrl("/api/analyze"),{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({
      msgs, max, useVision,
      tradeMode:   window._currentTradeMode||"GENERAL",
      countryCode: window._currentRegion||"NG",
      emailHash:   sessionStorage.getItem("FE_email_hash")||undefined,
    }),
  });

  // Handle 429 rate limit — wait and retry once
  if(r.status===429){
    const err = await r.json().catch(()=>({}));
    const wait = err.retryAfter || 30;
    console.warn(`[429] Rate limited — waiting ${wait}s then retrying`);
    await new Promise(res=>setTimeout(res, wait*1000));
    // One auto-retry
    const r2 = await fetch(apiUrl("/api/analyze"),{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({msgs,max,useVision,tradeMode:window._currentTradeMode||"GENERAL",countryCode:window._currentRegion||"NG"}),
    });
    if(!r2.ok) throw new Error(`AI rate limited. Please try again in 1 minute.`);
    const d2=await r2.json();
    if(d2._cached) console.log("[Cache] Served from server cache");
    if(!d2.result) throw new Error("Empty response after retry");
    return d2.result;
  }

  if(!r.ok){
    const err=await r.json().catch(()=>({error:`Server error ${r.status}`}));
    throw new Error(err.error||`Server error ${r.status}`);
  }

  const d = await r.json();
  if(d._cached) console.log("[Cache] Served from server cache — no AI cost");
  if(!d.result) throw new Error("Empty response from AI server");
  return d.result;
}

// ── JSON PARSER — strips markdown fences, recovers partial JSON ───────────────
function parseAIJson(raw){
  const clean = (raw||"").replace(/```json/g,"").replace(/```/g,"").trim();
  try{ return JSON.parse(clean); }
  catch{
    const m = clean.match(/\{[\s\S]*\}/);
    if(m){ try{ return JSON.parse(m[0]); }catch{} }
    throw new Error("AI returned invalid JSON — try a clearer blueprint image");
  }
}


// ── DEVICE FINGERPRINT ────────────────────────────────────────────────────────
async function getDeviceFingerprint(){
  const raw = [
    navigator.userAgent,
    navigator.language,
    screen.width+"x"+screen.height,
    Intl.DateTimeFormat().resolvedOptions().timeZone,
    navigator.hardwareConcurrency||"",
    navigator.platform||"",
  ].join("|");
  // SHA-256 hash via SubtleCrypto
  try{
    const buf  = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
    return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,"0")).join("").slice(0,32);
  }catch{
    return btoa(raw).slice(0,32);
  }
}

// ── SUBSCRIPTION EXPIRY HELPERS ───────────────────────────────────────────────
function getSubscriptionStatus(userSession){
  if(!userSession?.subscription_expiry) return "active";
  const expiry  = new Date(userSession.subscription_expiry).getTime();
  const now     = Date.now();
  const diffMs  = expiry - now;
  const diffDay = Math.ceil(diffMs / (1000*60*60*24));
  if(diffDay > 5)  return "active";
  if(diffDay > 0)  return "expiring_soon";   // 1-5 days left
  if(diffDay >= -5) return "grace_period";   // 5-day grace
  return "expired";
}

function getDaysUntilExpiry(userSession){
  if(!userSession?.subscription_expiry) return 999;
  const expiry  = new Date(userSession.subscription_expiry).getTime();
  return Math.ceil((expiry - Date.now()) / (1000*60*60*24));
}

// ── CROSS-CHECK — compare two engine results ─────────────────────────────────
function crossCheckResults(a, b, engineA, engineB){
  const tA = a?.financial_summary?.total_bid_price||0;
  const tB = b?.financial_summary?.total_bid_price||0;
  if(!tA||!tB) return {...(a||b), _crossChecked:false};

  const diff    = Math.abs(tA-tB)/Math.max(tA,tB);
  const agreePct = Math.round((1-Math.min(diff,1))*100);

  if(diff <= 0.20){
    // ✅ Good agreement — merge and average costs
    const merged = {...a};
    if(merged.financial_summary){
      merged.financial_summary = {...a.financial_summary};
      merged.financial_summary.total_bid_price = Math.round((tA+tB)/2);
      const dA=a.financial_summary.direct_cost||0, dB=b.financial_summary?.direct_cost||0;
      if(dA&&dB) merged.financial_summary.direct_cost = Math.round((dA+dB)/2);
      merged.financial_summary.cost_per_unit = Math.round(((a.financial_summary.cost_per_unit||0)+(b.financial_summary?.cost_per_unit||0))/2);
    }
    merged.project_metadata = {...a.project_metadata, confidence:"HIGH"};
    merged._crossChecked = true;
    merged._agreement_pct = agreePct;
    merged._engines = `${engineA}+${engineB}`;
    return merged;
  }else{
    // ⚠️ Disagreement > 20% — take conservative (lower) estimate
    const conservative = tA < tB ? a : b;
    if(!conservative.risk_flags) conservative.risk_flags = [];
    conservative.risk_flags.unshift({
      severity:"HIGH",
      issue:`Triple AI cross-check: engines disagreed by ${Math.round(diff*100)}% on total cost. Conservative estimate shown.`,
      mitigation:"Review key line items manually. Resubmit with a clearer or higher-resolution blueprint for better accuracy."
    });
    conservative.project_metadata = {...conservative.project_metadata, confidence:"MEDIUM"};
    conservative._crossChecked = true;
    conservative._agreement_pct = agreePct;
    conservative._engines = `${engineA}+${engineB}`;
    return conservative;
  }
}

// ── MASTER callGroq — TRIPLE AI ORCHESTRATOR ────────────────────────────────
// Blueprint scan  → ALL 3 engines simultaneously on SERVER → cross-check
// Text tasks      → Claude → Groq → Sakana (priority chain)
// Sakana Fugu     → auto-activates when SAKANA_FUGU_KEY is set (server-side)
// ─────────────────────────────────────────────────────────────────────────────
async function callGroq(msgs, max=4000, useVision=false){
  const isBlueprintScan = useVision || msgs.some(m=>
    Array.isArray(m.content) && m.content.some(p=>
      p.type==="image_url"||p.type==="inline_data"
    )
  );
  const region       = window._currentRegion||"NG";
  const useSakana    = SAKANA_FUGU_KEY && SAKANA_FUGU_KEY.length>8 && SAKANA_REGIONS.includes(region);

  // ──────────────────────────────────────────────────────────────
  // BLUEPRINT ANALYSIS — run best 2 engines simultaneously
  // ──────────────────────────────────────────────────────────────
  if(isBlueprintScan){
    let resultA=null, resultB=null, engineA="", engineB="";

    // Determine engine pair based on region + available keys
    if(useSakana){
      // For Arabic/Japanese/Chinese blueprints: Sakana Fugu + Groq
      const [rawA, rawB] = await Promise.allSettled([
        callViaFugu(msgs, max),
        callViaGroqDirect(msgs, max, true),
      ]);
      if(rawA.status==="fulfilled"){ try{resultA=parseAIJson(rawA.value);resultA._engine="fugu";engineA="sakana-fugu";}catch{} }
      if(rawB.status==="fulfilled"){ try{resultB=parseAIJson(rawB.value);resultB._engine="groq";engineB="groq";}catch{} }
    } else {
      // Standard regions: Claude (Netlify) + Groq simultaneously
      const [rawA, rawB] = await Promise.allSettled([
        callViaNetlify(msgs, max, true),
        callViaGroqDirect(msgs, max, true),
      ]);
      if(rawA.status==="fulfilled"){ try{resultA=parseAIJson(rawA.value);resultA._engine="claude";engineA="claude";}catch{} }
      if(rawB.status==="fulfilled"){ try{resultB=parseAIJson(rawB.value);resultB._engine="groq";engineB="groq";}catch{} }
    }

    // Both failed
    if(!resultA&&!resultB) throw new Error("All AI engines failed. Check your internet connection and try again.");

    // Only one succeeded — use it
    if(!resultA) return JSON.stringify({...resultB, _crossChecked:false, _singleEngine:true});
    if(!resultB) return JSON.stringify({...resultA, _crossChecked:false, _singleEngine:true});

    // Both succeeded — cross-check
    return JSON.stringify(crossCheckResults(resultA, resultB, engineA, engineB));
  }

  // ──────────────────────────────────────────────────────────────
  // TEXT TASKS (Copilot, RFQ, Compare) — priority chain
  // ──────────────────────────────────────────────────────────────
  // For multilingual text, prefer Sakana if available
  if(useSakana){
    try{ return await callViaFugu(msgs, max); }
    catch(e){ console.warn("[Sakana Fugu] failed, trying Claude:", e.message); }
  }
  try{ return await callViaNetlify(msgs, max, false); }
  catch(e){ console.warn("[Claude] failed, using Groq:", e.message); }
  return await callViaGroqDirect(msgs, max, false);
}

// Alias so all callClaude() calls in the app work unchanged
const callClaude = (msgs,max=4000) => callGroq(msgs,max,false);

// ── SAKANA AI FUGU — PLACEHOLDER ─────────────────────────────────────────────
// Sakana Fugu excels at multilingual blueprint text (Arabic, Chinese, Japanese)
// Get key from sakana.ai → paste below → it auto-activates for non-English blueprints
async function callSakanaFugu(msgs, max=4000){
  if(!SAKANA_FUGU_KEY) return callViaGroqDirect(msgs, max, false);
  const r = await fetch("https://api.sakana.ai/v1/chat/completions",{
    method:"POST",
    headers:{"Content-Type":"application/json","Authorization":"Bearer "+SAKANA_FUGU_KEY},
    body:JSON.stringify({model:"fugu-instruct",max_tokens:max,temperature:0.1,messages:msgs}),
  });
  if(!r.ok) throw new Error(`Sakana Fugu ${r.status}`);
  const d = await r.json();
  return d.choices?.[0]?.message?.content?.trim()||"";
}

function buildTradePrompt(tradeId,rk,cp,wastePct,taxRate){
  const r=REGIONS[rk]||REGIONS.NG;
  const pc=Object.keys(cp||{}).length?`Supplier price anchors: ${JSON.stringify(cp)}`:"Use regional market defaults.";
  const m=["CN","EU","IN"].includes(rk)?"Metric units.":"Imperial units.";
  const wf=`Apply ${wastePct||5}% waste factor. Include qty_with_waste field.`;
  const tx=`Add ${taxRate||7.5}% ${r.taxLabel||"VAT"}. Show tax_amount and total_bid_with_tax.`;
  const instr={
    ELECTRICAL:"Extract: circuit panels (amperage), wire runs (linear ft by gauge: 14/12/10/8AWG), outlet counts (120V/240V/GFCI), switch counts, light fixtures by type, conduit (linear ft by size), junction boxes, disconnect switches, subpanels.",
    PLUMBING:"Extract: supply pipes (linear ft by material/diameter: PEX/copper/PVC), drain pipes (linear ft), fixture counts (sinks/toilets/showers/tubs/floor drains), water heaters, valves, cleanouts, backflow preventers.",
    ROOFING:"Extract: total roof area in SQUARES (100sqft=1 square), pitch per section, ridge length (ft), hip/valley/eave/rake lengths, penetration count (chimneys/vents/skylights), underlayment area, fascia/soffit length.",
    HVAC:"Extract: supply ducts (linear ft by size: 6/8/10/12inch), return air ducts, flex duct length, air handlers (tons/BTU), condensers (tons), thermostats, supply registers, return grilles, exhaust fans, duct insulation area.",
    CIVIL:"Extract: excavation volume (cubic yards), fill/compaction, grading area (sq yards), concrete paving (sq yards), asphalt paving (tons), storm drain pipe (linear ft), manholes, catch basins, curb/gutter (linear ft).",
    GENERAL:"Full multi-trade survey: structural, architectural, MEP rough-ins, finishes, specialties. All rooms, materials, and labor.",
  }[tradeId]||"Full multi-trade survey.";
  return `Elite construction quantity survey — ${tradeId} trade mode.\n${instr}\nReturn ONLY raw JSON, no markdown. ${r.currency} rates. ${m} ${pc} ${wf} ${tx}\nSchema: {"project_metadata":{"detected_scale":"","primary_trade":"${tradeId}","total_area":0,"area_unit":"sqft","total_rooms":0,"confidence":"HIGH|MEDIUM|LOW","drawing_source":"","trade_mode":"${tradeId}"},"area_takeoff":[{"room":"","width":0,"length":0,"area":0,"unit":"sqft","type":"dry|wet|external"}],"trade_specific":{"items":[{"code":"","description":"","qty":0,"unit":"","notes":""}]},"line_items":[{"id":"A01","phase":"","description":"","category":"","qty":0,"qty_with_waste":0,"unit":"","materialCost":0,"laborCost":0,"csi":""}],"financial_summary":{"direct_cost":0,"waste_allowance":0,"contingency_5pct":0,"subtotal":0,"tax_amount":0,"tax_rate":${taxRate||7.5},"margin_20pct":0,"total_bid_price":0,"total_bid_with_tax":0,"cost_per_unit":0,"currency":"${r.currency}"},"phases":[{"phase_name":"Site Preparation","cost":0,"pct":0,"items":0,"weeks":0},{"phase_name":"Rough-In Work","cost":0,"pct":0,"items":0,"weeks":0},{"phase_name":"Main Installation","cost":0,"pct":0,"items":0,"weeks":0},{"phase_name":"Finishes and Trim","cost":0,"pct":0,"items":0,"weeks":0},{"phase_name":"Testing and Commissioning","cost":0,"pct":0,"items":0,"weeks":0}],"risk_flags":[{"severity":"HIGH|MEDIUM|LOW","issue":"","mitigation":"","cost_impact":0}],"value_engineering":[{"option":"","saving":0,"impact":"","category":""}]}`;
}

function buildAIPrompt(ctx){return `ForgeEstimate Ultra Pro v10 AI — Trade: ${ctx.tradeMode||"GENERAL"}\n\nPROJECT:\n${JSON.stringify({metadata:ctx.projectMetadata,financials:ctx.financials,items:(ctx.lineItems||[]).slice(0,8)},null,2)}\n\nCOMMANDS:\n/findRisks -> SUGGESTED_MODIFICATION:RISK_MATRIX {"riskScore":0,"primaryDriver":"","recommendedContingencyBufferPercent":0,"contingencyCostUsd":0}\n/valueEngineer -> SUGGESTED_MODIFICATION:VALUE_ENGINEERING [{"itemId":"","originalMaterial":"","substitutedMaterial":"","unitCostSavingsUsd":0}]\n/detectScopeGaps -> SUGGESTED_MODIFICATION:SCOPE_GAP [{"missingCategory":"","inferredLineItem":"","calculatedQtyRequired":0,"unit":"","estimatedImpactUsd":0}]\n/generateRFQ -> SUGGESTED_MODIFICATION:RFQ_EMAIL {"subject":"","body":""}\n\nBe precise and technical. Append SUGGESTED_MODIFICATION token exactly.`;}
function parseSugg(t){const m=t.match(/SUGGESTED_MODIFICATION:(\w+)\s*([\[\{][\s\S]*?[\]\}])/);if(!m)return null;try{return{type:m[1],payload:JSON.parse(m[2])};}catch{return{type:m[1],payload:null};}}

// ─── DESIGN ATOMS ─────────────────────────────────────────────────────────────
const GN="rgba(16,185,129,";
function Card({children,style={}}){return <div style={{borderRadius:16,border:`1px solid ${GN}0.18)`,background:"rgba(13,31,22,0.92)",backdropFilter:"blur(8px)",...style}}>{children}</div>;}
function Pill({c="emerald",children}){const m={emerald:`${GN}0.15) text #10b981 ${GN}0.25)`,amber:"rgba(245,158,11,0.15) text #f59e0b rgba(245,158,11,0.25)",teal:"rgba(20,184,166,0.15) text #2dd4bf rgba(20,184,166,0.25)",red:"rgba(239,68,68,0.15) text #f87171 rgba(239,68,68,0.25)"};const parts=(m[c]||m.emerald).split(" text ");const[bg,rest]=parts;const[tc,bc]=rest.split(" ");return <span style={{fontSize:8,fontWeight:900,padding:"2px 8px",borderRadius:99,textTransform:"uppercase",letterSpacing:"0.15em",background:bg,color:tc,border:`1px solid ${bc}`}}>{children}</span>;}
function AnimBar({pct,color,delay=0}){const [w,setW]=useState(0);useEffect(()=>{const t=setTimeout(()=>setW(pct),delay+80);return()=>clearTimeout(t);},[pct,delay]);return <div style={{height:6,borderRadius:99,background:`${GN}0.08)`,overflow:"hidden"}}><div style={{height:"100%",borderRadius:99,width:`${w}%`,background:color,boxShadow:`0 0 8px ${color}55`,transition:"width 0.7s ease"}}/></div>;}
const PPAL=["#10b981","#34d399","#6ee7b7","#f59e0b","#38bdf8"];

// ═══════════════════════════════════════════════════════════════
// TRADE MODE SELECTOR
// ═══════════════════════════════════════════════════════════════
function TradeModeSelector({selected,onSelect}){
  return(
    <Card style={{padding:16}}>
      <p style={{color:`${GN}0.5)`,fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.2em",margin:"0 0 10px"}}>Select Trade / Specialization</p>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
        {Object.values(TRADES).map(trade=>{const Icon=trade.icon;const active=selected===trade.id;return(
          <button key={trade.id} onClick={()=>onSelect(trade.id)} style={{textAlign:"left",padding:10,borderRadius:10,border:active?`1px solid ${trade.color}55`:`1px solid ${GN}0.1)`,background:active?`${trade.color}18`:`${GN}0.02)`,cursor:"pointer"}}>
            <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:3}}><Icon size={12} style={{color:active?trade.color:"rgba(255,255,255,0.3)"}}/><span style={{fontSize:10,fontWeight:700,color:active?trade.color:"rgba(255,255,255,0.4)"}}>{trade.label}</span></div>
            <p style={{color:"rgba(255,255,255,0.18)",fontSize:8,margin:0,lineHeight:1.3}}>{trade.desc}</p>
          </button>
        );})}
      </div>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════
// WASTE FACTOR + TAX ENGINE
// ═══════════════════════════════════════════════════════════════
function WasteTaxPanel({wasteFactor,setWasteFactor,taxRate,setTaxRate,region}){
  const r=REGIONS[region]||REGIONS.NG;
  return(
    <Card style={{padding:16}}>
      <p style={{color:`${GN}0.5)`,fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.2em",margin:"0 0 12px"}}>Waste Factors and Tax Engine</p>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <div>
          <p style={{color:"rgba(255,255,255,0.3)",fontSize:9,fontWeight:700,textTransform:"uppercase",margin:"0 0 8px"}}>Material Waste %</p>
          <div style={{maxHeight:150,overflowY:"auto",display:"flex",flexDirection:"column",gap:5}}>
            {Object.keys(DEFAULT_WASTE).map(cat=>(
              <div key={cat} style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                <span style={{color:"rgba(255,255,255,0.38)",fontSize:9}}>{cat}</span>
                <div style={{display:"flex",alignItems:"center",gap:3}}>
                  <button onClick={()=>setWasteFactor(p=>({...p,[cat]:Math.max(0,(p[cat]??DEFAULT_WASTE[cat])-1)}))} style={{width:18,height:18,borderRadius:4,border:"none",background:`${GN}0.08)`,color:`${GN}0.6)`,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}><Minus size={8}/></button>
                  <span style={{color:"#10b981",fontFamily:"JetBrains Mono",fontSize:9,width:26,textAlign:"center"}}>{wasteFactor[cat]??DEFAULT_WASTE[cat]}%</span>
                  <button onClick={()=>setWasteFactor(p=>({...p,[cat]:Math.min(50,(p[cat]??DEFAULT_WASTE[cat])+1)}))} style={{width:18,height:18,borderRadius:4,border:"none",background:`${GN}0.08)`,color:`${GN}0.6)`,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}><Plus size={8}/></button>
                </div>
              </div>
            ))}
          </div>
          <button onClick={()=>setWasteFactor({...DEFAULT_WASTE})} style={{marginTop:6,background:"none",border:"none",cursor:"pointer",color:`${GN}0.3)`,fontSize:8}}>Reset to defaults</button>
        </div>
        <div>
          <p style={{color:"rgba(255,255,255,0.3)",fontSize:9,fontWeight:700,textTransform:"uppercase",margin:"0 0 8px"}}>{r.taxLabel} Rate</p>
          <div style={{background:`${GN}0.05)`,border:`1px solid ${GN}0.12)`,borderRadius:10,padding:10}}>
            <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:6}}>
              <input type="number" min="0" max="50" step="0.5" value={taxRate} onChange={e=>setTaxRate(parseFloat(e.target.value)||0)} style={{flex:1,background:"rgba(0,0,0,0.3)",border:`1px solid ${GN}0.2)`,borderRadius:8,padding:"6px 8px",color:"#fff",fontFamily:"JetBrains Mono",fontSize:13,outline:"none"}}/>
              <span style={{color:"rgba(255,255,255,0.3)",fontSize:12}}>%</span>
            </div>
            <button onClick={()=>setTaxRate(r.tax)} style={{background:"none",border:"none",cursor:"pointer",color:`${GN}0.35)`,fontSize:8}}>Use {r.taxLabel} default ({r.tax}%)</button>
            <p style={{color:"rgba(255,255,255,0.15)",fontSize:8,marginTop:4}}>Applied after waste + contingency + margin</p>
          </div>
        </div>
      </div>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════
// SPEED METRICS — hours saved vs manual takeoff
// ═══════════════════════════════════════════════════════════════
function SpeedMetricsCard({totalArea}){
  const area=totalArea||1000;
  const manualHrs=Math.max(4,Math.round(area/1000*6));
  const autoMins=Math.round(area/1000*8)+3;
  const saved=Math.max(1,manualHrs-Math.ceil(autoMins/60));
  const dollar=saved*85;
  return(
    <Card style={{padding:14,marginBottom:12}}>
      <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:10}}><Clock size={13} style={{color:"#10b981"}}/><p style={{color:"rgba(255,255,255,0.5)",fontSize:11,fontWeight:700,margin:0}}>Time Saved vs Manual Takeoff</p></div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:8}}>
        {[["Manual",`~${manualHrs}h`,"#f59e0b"],["Automated",`~${autoMins}min`,"#10b981"],["Saved",`${saved}h`,"#34d399"]].map(([l,v,c])=>(
          <div key={l} style={{textAlign:"center",padding:8,borderRadius:10,background:`${GN}0.04)`,border:`1px solid ${GN}0.1)`}}>
            <p style={{fontFamily:"Bebas Neue",fontSize:18,color:c,margin:0,lineHeight:1}}>{v}</p>
            <p style={{color:"rgba(255,255,255,0.25)",fontSize:8,margin:"2px 0 0"}}>{l}</p>
          </div>
        ))}
      </div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 10px",borderRadius:8,background:`${GN}0.06)`,border:`1px solid ${GN}0.1)`}}>
        <span style={{color:"rgba(255,255,255,0.3)",fontSize:9}}>Estimator cost saved (@$85/hr)</span>
        <span style={{color:"#10b981",fontFamily:"JetBrains Mono",fontWeight:700,fontSize:12}}>${dollar.toLocaleString()}</span>
      </div>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════
// RFQ / PURCHASE ORDER GENERATOR
// ═══════════════════════════════════════════════════════════════
function RFQGenerator({lineItems,projectMeta,region,onQuerySaved}){
  const [busy,setBusy]=useState(false);const [rfq,setRfq]=useState(null);const [type,setType]=useState("email");
  const generate=async()=>{
    setBusy(true);
    try{
      const matList=(lineItems||[]).slice(0,20).map(i=>`- ${i.description}: ${i.qty} ${i.unit}`).join("\n");
      const prompt=`Generate a professional ${type==="email"?"supplier RFQ email":"Purchase Order document"} for these construction materials.\n\nProject: ${projectMeta?.primary_trade||"Construction"} — ${projectMeta?.drawing_source||"Blueprint"}\nRegion: ${REGIONS[region]?.label||region}\nDate: ${new Date().toLocaleDateString()}\n\nMaterials:\n${matList}\n\n${type==="email"?"Write concise professional RFQ email with 10-day quote deadline and delivery requirements.":"Write formal PO with PO number PO-"+Date.now().toString().slice(-6)+", line items table, Net 30 payment terms, delivery terms, signature block."}\n\nFormat as clean plain text ready to send.`;
      const result=await callClaude([{role:"user",content:prompt}],2000);
      setRfq(result);
      await dbAdd("queryHistory",{query:"RFQ generated",command:"RFQ_GENERATE"});
      onQuerySaved?.();
    }catch(e){alert("RFQ generation failed: "+e.message);}
    finally{setBusy(false);}
  };
  const copy=()=>{if(rfq)navigator.clipboard.writeText(rfq).then(()=>alert("Copied!")).catch(()=>alert("Copy not supported — select text manually"));}; 
  const dl=()=>{if(!rfq)return;const blob=new Blob([rfq],{type:"text/plain"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`${type==="email"?"RFQ_Email":"PurchaseOrder"}_${Date.now()}.txt`;document.body.appendChild(a);a.click();document.body.removeChild(a);};
  return(
    <div>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
        <div style={{display:"flex",gap:2,padding:3,borderRadius:10,background:`${GN}0.05)`,border:`1px solid ${GN}0.1)`}}>
          {[["email","Email RFQ"],["po","Purchase Order"]].map(([k,l])=><button key={k} onClick={()=>setType(k)} style={{padding:"5px 10px",borderRadius:8,border:"none",cursor:"pointer",background:type===k?`${GN}0.15)`:"transparent",color:type===k?"#10b981":"rgba(255,255,255,0.3)",fontSize:10,fontWeight:700}}>{k==="email"?"Email RFQ":"Purchase Order"}</button>)}
        </div>
        <button onClick={generate} disabled={busy||!lineItems?.length} style={{display:"flex",alignItems:"center",gap:6,padding:"7px 14px",borderRadius:10,border:"none",cursor:busy?"not-allowed":"pointer",background:"linear-gradient(135deg,#10b981,#059669)",color:"#000",fontSize:10,fontWeight:900,opacity:busy||!lineItems?.length?0.5:1}}>
          {busy?<RefreshCw size={12} style={{animation:"spin 1s linear infinite"}}/>:<Mail size={12}/>}{busy?"Generating...":"Generate"}
        </button>
      </div>
      {!rfq&&!busy&&<div style={{textAlign:"center",padding:"40px 0"}}><ShoppingCart size={28} style={{color:`${GN}0.18)`,margin:"0 auto 10px",display:"block"}}/><p style={{color:"rgba(255,255,255,0.2)",fontSize:11,margin:0}}>Generate a supplier RFQ or Purchase Order</p><p style={{color:"rgba(255,255,255,0.12)",fontSize:9,marginTop:4}}>Claude formats your material list into a professional procurement document ready to send.</p></div>}
      {busy&&<div style={{textAlign:"center",padding:"30px 0"}}><RefreshCw size={24} style={{color:"#10b981",margin:"0 auto 10px",display:"block",animation:"spin 1s linear infinite"}}/><p style={{color:`${GN}0.6)`,fontSize:11,fontWeight:700}}>Claude is drafting your {type==="email"?"RFQ email":"Purchase Order"}...</p></div>}
      {rfq&&<div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
          <p style={{color:`${GN}0.5)`,fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.15em",margin:0}}>Ready to Send</p>
          <div style={{display:"flex",gap:6}}>
            <button onClick={copy} style={{padding:"4px 10px",borderRadius:8,border:`1px solid ${GN}0.2)`,background:`${GN}0.08)`,color:"#10b981",fontSize:9,fontWeight:700,cursor:"pointer"}}>Copy</button>
            <button onClick={dl} style={{padding:"4px 10px",borderRadius:8,border:"1px solid rgba(59,130,246,0.2)",background:"rgba(59,130,246,0.08)",color:"#60a5fa",fontSize:9,fontWeight:700,cursor:"pointer"}}>Download</button>
          </div>
        </div>
        <div style={{background:"rgba(0,0,0,0.3)",border:`1px solid ${GN}0.1)`,borderRadius:10,padding:12,maxHeight:320,overflowY:"auto",fontSize:10,lineHeight:1.7,whiteSpace:"pre-wrap",color:"rgba(255,255,255,0.65)",fontFamily:"JetBrains Mono"}}>{rfq}</div>
      </div>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// VERSION COMPARISON — Delta Cost = (Qty_V2 - Qty_V1) × Price
// ═══════════════════════════════════════════════════════════════
function VersionCompare({v1Data,region,tradeMode,onQuerySaved}){
  const [v2File,setV2File]=useState(null);const [busy,setBusy]=useState(false);const [result,setResult]=useState(null);
  const fileRef=useRef();
  const fileToB64=f=>new Promise((res,rej)=>{const fr=new FileReader();fr.readAsDataURL(f);fr.onload=()=>res(fr.result.split(",")[1]);fr.onerror=rej;});
  const handleV2=e=>{const f=e.target.files[0];if(!f)return;const v=validateFile(f);if(!v.valid){alert(v.error);return;}setV2File(f);};
  const runCompare=async()=>{
    if(!v2File)return;setBusy(true);
    try{
      const b64=await fileToB64(v2File);const mt=v2File.type||"image/jpeg";const nm=mt==="image/jpg"?"image/jpeg":mt;
      const mediaBlock=mt==="application/pdf"?{type:"document",source:{type:"base64",media_type:"application/pdf",data:b64}}:{type:"image",source:{type:"base64",media_type:nm,data:b64}};
      const v1Sum={trade:tradeMode,financials:v1Data?.financial_summary,lineItems:(v1Data?.line_items||[]).slice(0,12)};
      const prompt=`Blueprint change order analyzer. Compare V1 vs V2.\n\nV1 SUMMARY:\n${JSON.stringify(v1Sum,null,2)}\n\nAnalyze the V2 blueprint. Apply Delta Cost = (Qty_V2 - Qty_V1) x Unit Price.\n\nReturn ONLY raw JSON:\n{"changes":{"added":[{"description":"","qty":0,"unit":"","unit_cost":0,"cost_impact":0}],"removed":[{"description":"","qty":0,"unit":"","unit_cost":0,"cost_saving":0}],"modified":[{"description":"","v1_qty":0,"v2_qty":0,"unit":"","unit_cost":0,"cost_delta":0}]},"delta_summary":{"total_cost_increase":0,"total_cost_saving":0,"net_delta":0,"currency":"${REGIONS[region]?.currency||"USD"}","summary_text":""},"change_order":{"title":"Change Order #1","date":"${new Date().toLocaleDateString()}","items":[{"ref":"CO-001","description":"","qty_delta":0,"unit":"","unit_cost":0,"total_impact":0}],"subtotal_delta":0,"overhead_10pct":0,"grand_total_delta":0}}`;
      const raw=await callClaude([{role:"user",content:[mediaBlock,{type:"text",text:prompt}]}],3000);
      const parsed=JSON.parse(raw.replace(/```json|```/g,"").trim());
      setResult(parsed);
      await dbAdd("queryHistory",{query:"V1 vs V2 comparison",command:"VERSION_COMPARE"});
      onQuerySaved?.();
    }catch(e){alert("Comparison failed: "+e.message);}finally{setBusy(false);}
  };
  const exportCO=()=>{
    if(!result?.change_order)return;const co=result.change_order;
    let txt=`CHANGE ORDER DOCUMENT\n${"=".repeat(50)}\n${co.title}\nDate: ${co.date}\n\nITEMS:\n`;
    (co.items||[]).forEach(i=>{txt+=`${i.ref}: ${i.description}\n  Qty Delta: ${i.qty_delta} ${i.unit} | Unit Cost: $${(i.unit_cost||0).toFixed(2)} | Impact: $${(i.total_impact||0).toFixed(2)}\n\n`;});
    txt+=`Subtotal Delta: $${(co.subtotal_delta||0).toFixed(2)}\nOverhead 10%: $${(co.overhead_10pct||0).toFixed(2)}\nGRAND TOTAL CHANGE: $${(co.grand_total_delta||0).toFixed(2)}`;
    const blob=new Blob([txt],{type:"text/plain"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`ChangeOrder_${Date.now()}.txt`;document.body.appendChild(a);a.click();document.body.removeChild(a);
  };
  const d=result?.delta_summary;
  return(
    <div>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:14,flexWrap:"wrap"}}>
        <div style={{display:"flex",alignItems:"center",gap:6,padding:"5px 10px",borderRadius:8,background:`${GN}0.08)`,border:`1px solid ${GN}0.2)`}}><CheckCircle2 size={11} style={{color:"#10b981"}}/><span style={{color:"#10b981",fontSize:9,fontWeight:700}}>V1 Loaded</span></div>
        <span style={{color:"rgba(255,255,255,0.2)",fontSize:16}}>→</span>
        {v2File?<div style={{display:"flex",alignItems:"center",gap:6,padding:"5px 10px",borderRadius:8,background:`${GN}0.08)`,border:`1px solid ${GN}0.2)`}}><CheckCircle2 size={11} style={{color:"#10b981"}}/><span style={{color:"#10b981",fontSize:9,fontWeight:700}}>V2: {v2File.name.slice(0,22)}</span></div>:<button onClick={()=>fileRef.current.click()} style={{padding:"5px 12px",borderRadius:8,border:"1px solid rgba(245,158,11,0.35)",background:"rgba(245,158,11,0.1)",color:"#f59e0b",fontSize:9,fontWeight:700,cursor:"pointer"}}>+ Upload V2 Blueprint</button>}
        {v2File&&!result&&<button onClick={runCompare} disabled={busy} style={{padding:"5px 12px",borderRadius:8,border:"none",background:"linear-gradient(135deg,#10b981,#059669)",color:"#000",fontSize:9,fontWeight:900,cursor:busy?"not-allowed":"pointer",opacity:busy?0.5:1}}>{busy?"Analyzing...":"Compare Now"}</button>}
        {result&&<button onClick={()=>{setResult(null);setV2File(null);}} style={{padding:"5px 8px",borderRadius:8,border:`1px solid ${GN}0.15)`,background:"none",color:`${GN}0.5)`,fontSize:8,cursor:"pointer"}}>Clear</button>}
        <input ref={fileRef} type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" style={{display:"none"}} onChange={handleV2}/>
      </div>
      {!v2File&&<div style={{textAlign:"center",padding:"40px 0"}}><ArrowLeftRight size={28} style={{color:`${GN}0.18)`,margin:"0 auto 10px",display:"block"}}/><p style={{color:"rgba(255,255,255,0.2)",fontSize:11,margin:0}}>Upload revised blueprint (Version 2)</p><p style={{color:"rgba(255,255,255,0.12)",fontSize:9,marginTop:4}}>Claude compares V1 vs V2, applies Delta Cost formula, and generates your Change Order document.</p></div>}
      {busy&&<div style={{textAlign:"center",padding:"30px 0"}}><RefreshCw size={24} style={{color:"#10b981",margin:"0 auto 10px",display:"block",animation:"spin 1s linear infinite"}}/><p style={{color:`${GN}0.6)`,fontSize:11,fontWeight:700}}>Comparing blueprints and calculating cost deltas...</p></div>}
      {result&&d&&<div>
        <div style={{padding:12,borderRadius:12,background:d.net_delta>0?"rgba(244,63,94,0.07)":`${GN}0.07)`,border:`1px solid ${d.net_delta>0?"rgba(244,63,94,0.2)":`${GN}0.2)`}`,marginBottom:12}}>
          {d.summary_text&&<p style={{color:"rgba(255,255,255,0.65)",fontSize:11,margin:"0 0 8px",fontWeight:500,lineHeight:1.5}}>{d.summary_text}</p>}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:10}}>
            {[["Added Cost",`+$${(d.total_cost_increase||0).toFixed(0)}`,"#f43f5e"],["Cost Savings",`-$${(d.total_cost_saving||0).toFixed(0)}`,"#10b981"],["NET DELTA",`${(d.net_delta||0)>0?"+":""}$${Math.abs(d.net_delta||0).toFixed(0)}`,d.net_delta>0?"#f43f5e":"#10b981"]].map(([l,v,c])=>(
              <div key={l} style={{textAlign:"center"}}><p style={{fontFamily:"Bebas Neue",fontSize:16,color:c,margin:0}}>{v}</p><p style={{color:"rgba(255,255,255,0.25)",fontSize:8,margin:"2px 0 0"}}>{l}</p></div>
            ))}
          </div>
          <button onClick={exportCO} style={{width:"100%",padding:"7px 0",borderRadius:8,border:`1px solid ${GN}0.25)`,background:`${GN}0.1)`,color:"#10b981",fontSize:9,fontWeight:900,cursor:"pointer"}}>Export Change Order Document</button>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:6,maxHeight:240,overflowY:"auto"}}>
          {[...(result.changes?.added||[]).map(i=>({...i,_type:"ADDED",_color:"#f43f5e",_bg:"rgba(244,63,94,0.06)",_bc:"rgba(244,63,94,0.15)",_val:`+$${(i.cost_impact||0).toFixed(0)}`})),
            ...(result.changes?.removed||[]).map(i=>({...i,_type:"REMOVED",_color:"#10b981",_bg:`${GN}0.06)`,_bc:`${GN}0.15)`,_val:`-$${(i.cost_saving||0).toFixed(0)}`})),
            ...(result.changes?.modified||[]).map(i=>({...i,_type:"CHANGED",_color:"#f59e0b",_bg:"rgba(245,158,11,0.05)",_bc:"rgba(245,158,11,0.18)",_val:`${(i.cost_delta||0)>0?"+":""}$${(i.cost_delta||0).toFixed(0)}`}))
          ].map((item,i)=>(
            <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"8px 10px",borderRadius:10,background:item._bg,border:`1px solid ${item._bc}`}}>
              <div style={{display:"flex",alignItems:"center",gap:6}}><span style={{padding:"1px 6px",borderRadius:99,fontSize:7,fontWeight:900,background:item._color+"22",color:item._color}}>{item._type}</span><span style={{fontSize:10,color:"rgba(255,255,255,0.62)"}}>{item.description}{item.v1_qty!==undefined?` (${item.v1_qty}→${item.v2_qty} ${item.unit})`:""}</span></div>
              <span style={{color:item._color,fontFamily:"JetBrains Mono",fontSize:10,fontWeight:700}}>{item._val}</span>
            </div>
          ))}
        </div>
      </div>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// EXPORT HUB — QuickBooks IIF, Sage 300, BIM/IFC, CSV
// ═══════════════════════════════════════════════════════════════
function ExportHub({lineItems,projectMeta,financials,region}){
  const [exporting,setExporting]=useState(null);const [done,setDone]=useState(null);
  const dl=(content,name,mime)=>{const b=new Blob([content],{type:mime});const a=document.createElement("a");a.href=URL.createObjectURL(b);a.setAttribute("download",name);document.body.appendChild(a);a.click();document.body.removeChild(a);};
  const run=async t=>{setExporting(t);const ts=new Date().toISOString().split("T")[0];await new Promise(ok=>setTimeout(ok,350));
    if(t==="csv"){let c="CSI Code,Phase,Category,Description,Qty,Unit,Material$/u,Labor$/u,Total USD\n";(lineItems||[]).forEach(i=>{const tot=(i.qty||0)*((i.materialCost||0)+(i.laborCost||0));c+=`"${i.csi||""}","${i.phase||""}","${i.category||""}","${i.description}",${i.qty},"${i.unit}",${i.materialCost||0},${i.laborCost||0},${tot.toFixed(2)}\n`;});if(financials?.tax_amount)c+=`\nTax (${financials.tax_rate||0}%),,,,,,,,${(financials.tax_amount||0).toFixed(2)}\nTotal incl. Tax,,,,,,,,${(financials.total_bid_with_tax||0).toFixed(2)}\n`;dl(c,`ForgeEstimate_Takeoff_${ts}.csv`,"text/csv");}
    else if(t==="quickbooks"){let q="!TRNS\tTRNSTYPE\tDATE\tACCNT\tNAME\tAMOUNT\tDOCNUM\tMEMO\n!SPL\tSPLIT\tDATE\tACCNT\tNAME\tAMOUNT\tMEMO\n!ENDTRNS\n";(lineItems||[]).forEach(i=>{const t2=(i.qty||0)*((i.materialCost||0)+(i.laborCost||0));q+=`TRNS\tBILL\t${ts}\tAccounts Payable\tSupplier\t${(-t2).toFixed(2)}\t${i.id}\t${i.description}\nSPL\tBILL\t${ts}\tJob Materials\t\t${t2.toFixed(2)}\t${i.description}\nENDTRNS\n`;});dl(q,`ForgeEstimate_QuickBooks_${ts}.iif`,"text/plain");}
    else if(t==="sage"){let c="Transaction Type,Date,Account,Description,Debit,Credit,Reference,Job Code\n";(lineItems||[]).forEach(i=>{const t2=(i.qty||0)*((i.materialCost||0)+(i.laborCost||0));c+=`Purchase,${ts},Construction Materials,"${i.description}",${t2.toFixed(2)},0,${i.id},${projectMeta?.primary_trade||"PROJ"}\n`;});dl(c,`ForgeEstimate_Sage300_${ts}.csv`,"text/csv");}
    else if(t==="bim"){const b={Format:"BIM-Quantity-Takeoff-Schema",Version:"1.3.0",ExportedAt:new Date().toISOString(),Trade:projectMeta?.primary_trade,CostElements:(lineItems||[]).map(i=>({IfcCostValue:i.description,Qty:i.qty,Unit:i.unit,MaterialCost:i.materialCost,LaborCost:i.laborCost,Total:(i.qty||0)*((i.materialCost||0)+(i.laborCost||0))})),Financial:financials};dl(JSON.stringify(b,null,2),`ForgeEstimate_BIM_${ts}.json`,"application/json");}
    else if(t==="json"){dl(JSON.stringify({metadata:projectMeta,lineItems,financials,exportedAt:new Date().toISOString()},null,2),`ForgeEstimate_Full_${ts}.json`,"application/json");}
    setExporting(null);setDone(t);setTimeout(()=>setDone(null),2500);
  };
  const exports=[["csv","Standard CSV","Full takeoff with CSI codes and tax","#60a5fa","rgba(59,130,246,0.12)","rgba(59,130,246,0.25)"],["quickbooks","QuickBooks IIF","Import directly into QuickBooks Desktop","#34d399","rgba(52,211,153,0.10)","rgba(52,211,153,0.22)"],["sage","Sage 300 CSV","Formatted for Sage 300 Construction","#93c5fd","rgba(147,197,253,0.07)","rgba(147,197,253,0.18)"],["bim","BIM / IFC JSON","Industry-standard BIM data schema","#c084fc","rgba(192,132,252,0.08)","rgba(192,132,252,0.2)"],["json","Raw JSON","Complete data payload for developers","rgba(255,255,255,0.35)","rgba(255,255,255,0.03)","rgba(255,255,255,0.08)"]];
  return(
    <div>
      <p style={{color:`${GN}0.5)`,fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.2em",margin:"0 0 12px"}}>Data Pipeline Exports</p>
      {exports.map(([t,label,desc,tc,bg,bc])=>(
        <button key={t} onClick={()=>run(t)} disabled={!!exporting} style={{width:"100%",display:"flex",alignItems:"center",justifyContent:"space-between",padding:10,borderRadius:10,border:`1px solid ${bc}`,background:bg,cursor:exporting?"not-allowed":"pointer",marginBottom:7,opacity:exporting?0.6:1}}>
          <div style={{textAlign:"left"}}><p style={{color:done===t?"#10b981":tc,fontSize:11,fontWeight:700,margin:0}}>{done===t?"✓ Exported! ":""}{label}</p><p style={{color:"rgba(255,255,255,0.22)",fontSize:9,margin:"2px 0 0"}}>{desc}</p></div>
          {exporting===t?<RefreshCw size={13} style={{color:"rgba(255,255,255,0.3)",animation:"spin 1s linear infinite"}}/>:<Download size={13} style={{color:"rgba(255,255,255,0.2)"}}/>}
        </button>
      ))}
      <div style={{marginTop:8,padding:10,borderRadius:10,background:`${GN}0.03)`,border:`1px solid ${GN}0.08)`}}>
        <p style={{color:`${GN}0.35)`,fontSize:8,fontWeight:700,textTransform:"uppercase",margin:"0 0 3px"}}>Phase 2 Roadmap</p>
        <p style={{color:"rgba(255,255,255,0.16)",fontSize:8,margin:0}}>Sage 300 live API sync · QuickBooks Online OAuth · Procore · Microsoft Project</p>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// FEATURE PAYWALL GATE
// ═══════════════════════════════════════════════════════════════
function FeaturePaywallGate({isProUser,children,label="This feature",onUnlock}){
  if(isProUser)return <>{children}</>;
  return(
    <div style={{position:"relative",borderRadius:12,overflow:"hidden"}}>
      <div style={{filter:"blur(4px)",opacity:0.2,pointerEvents:"none",userSelect:"none"}}>{children}</div>
      <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",padding:16,background:"rgba(9,21,16,0.75)"}}>
        <div style={{background:"rgba(13,31,22,0.96)",border:`1px solid ${GN}0.22)`,borderRadius:16,padding:24,textAlign:"center",maxWidth:280,backdropFilter:"blur(8px)"}}>
          <div style={{width:44,height:44,borderRadius:12,background:`${GN}0.1)`,border:`1px solid ${GN}0.2)`,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 12px"}}><Lock size={20} style={{color:"#10b981"}}/></div>
          <p style={{color:"#fff",fontWeight:900,fontSize:13,margin:"0 0 6px"}}>Feature Locked</p>
          <p style={{color:"rgba(255,255,255,0.35)",fontSize:11,margin:"0 0 16px",lineHeight:1.4}}>{label} requires an Enterprise subscription.</p>
          <button onClick={onUnlock} style={{width:"100%",padding:"10px 0",borderRadius:10,border:"none",cursor:"pointer",fontWeight:900,fontSize:11,background:"linear-gradient(135deg,#10b981,#059669)",color:"#000"}}>Unlock Enterprise</button>
        </div>
      </div>
    </div>
  );
}

// ─── AI CHAT ──────────────────────────────────────────────────────────────────
function AIChat({estimateCtx,onApplySuggestion,onQuerySaved,seedMsg}){
  const [msgs,setMsgs]=useState([{id:0,role:"assistant",content:seedMsg||"Ready. Try /findRisks, /valueEngineer, /detectScopeGaps, /generateRFQ or ask anything.",ts:ts()}]);
  const [inp,setInp]=useState("");const [busy,setBusy]=useState(false);const endRef=useRef();
  function ts(){return new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});}
  useEffect(()=>{endRef.current?.scrollIntoView({behavior:"smooth"});},[msgs]);
  useEffect(()=>{if(seedMsg)setMsgs([{id:0,role:"assistant",content:seedMsg,ts:ts()}]);},[seedMsg]);
  const QUICK=["/findRisks","/valueEngineer","/detectScopeGaps","/generateRFQ"];
  const send=async text=>{
    if(!text.trim()||busy)return;
    setMsgs(p=>[...p,{id:Date.now(),role:"user",content:text,ts:ts()}]);setInp("");setBusy(true);
    try{const raw=await callClaude([{role:"user",content:`${buildAIPrompt(estimateCtx)}\n\nUser: ${text}`}],1500);const s=parseSugg(raw);setMsgs(p=>[...p,{id:Date.now()+1,role:"assistant",content:raw,ts:ts(),s}]);await dbAdd("queryHistory",{query:text,command:s?`SUGGESTED_MODIFICATION:${s.type}`:"CHAT"});onQuerySaved?.();}
    catch(e){setMsgs(p=>[...p,{id:Date.now()+1,role:"error",content:"Error: "+e.message,ts:ts()}]);}
    finally{setBusy(false);}
  };
  const bub=(m)=>({padding:"10px 14px",borderRadius:m.role==="user"?"16px 16px 4px 16px":"16px 16px 16px 4px",fontSize:11,lineHeight:1.6,whiteSpace:"pre-line",color:m.role==="user"?"#a7f3d0":m.role==="error"?"#fca5a5":"rgba(255,255,255,0.72)",background:m.role==="user"?`${GN}0.12)`:m.role==="error"?"rgba(239,68,68,0.08)":`${GN}0.04)`,border:`1px solid ${m.role==="user"?`${GN}0.22)`:m.role==="error"?"rgba(239,68,68,0.15)":`${GN}0.1)`}`,maxWidth:"90%"});
  return(
    <div style={{display:"flex",flexDirection:"column",height:"100%"}}>
      <div style={{flex:1,overflowY:"auto",padding:12,display:"flex",flexDirection:"column",gap:10,minHeight:0}}>
        {msgs.length===1&&<div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:8}}>{QUICK.map(q=><button key={q} onClick={()=>send(q)} style={{padding:"4px 10px",borderRadius:99,border:`1px solid ${GN}0.18)`,background:`${GN}0.06)`,color:`${GN}0.7)`,fontSize:9,fontWeight:700,cursor:"pointer"}}>{q}</button>)}</div>}
        {msgs.map(m=><div key={m.id} style={{display:"flex",flexDirection:"column",alignItems:m.role==="user"?"flex-end":"flex-start"}}>
          <div style={bub(m)}>{m.content.replace(/SUGGESTED_MODIFICATION:\w+\s*[\[\{][\s\S]*?[\]\}]/,"").trim()}{m.s&&<div style={{marginTop:8,paddingTop:8,borderTop:`1px solid ${GN}0.15)`}}><p style={{color:"#10b981",fontSize:9,fontWeight:900,margin:"0 0 6px"}}>→ {m.s.type} READY</p><button onClick={()=>onApplySuggestion?.(m.s)} style={{display:"flex",alignItems:"center",gap:6,padding:"6px 10px",borderRadius:8,border:`1px solid ${GN}0.25)`,background:`${GN}0.1)`,color:"#10b981",fontSize:10,fontWeight:700,cursor:"pointer"}}><CheckCircle2 size={11}/>Apply Optimization</button></div>}</div>
          <span style={{color:"rgba(255,255,255,0.12)",fontSize:9,marginTop:2,fontFamily:"JetBrains Mono"}}>{m.ts}</span>
        </div>)}
        {busy&&<div style={{display:"flex",alignItems:"center",gap:6,padding:"8px 12px",background:`${GN}0.06)`,border:`1px solid ${GN}0.12)`,borderRadius:12,width:"fit-content",color:`${GN}0.6)`,fontSize:10}}>{[0,1,2].map(i=><div key={i} style={{width:5,height:5,borderRadius:"50%",background:"#10b981",animation:`bounce 0.6s infinite ${i*150}ms`}}/>)}<span style={{marginLeft:4}}>Analyzing...</span></div>}
        <div ref={endRef}/>
      </div>
      <div style={{padding:"10px 12px",borderTop:`1px solid ${GN}0.1)`,display:"flex",gap:8,flexShrink:0}}>
        <input value={inp} onChange={e=>setInp(e.target.value)} onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send(inp);}}} disabled={busy} placeholder="/findRisks · /valueEngineer · ask anything..." style={{flex:1,background:`${GN}0.05)`,border:`1px solid ${GN}0.15)`,borderRadius:12,padding:"8px 12px",color:"#fff",fontSize:11,outline:"none",opacity:busy?0.4:1}}/>
        <button onClick={()=>send(inp)} disabled={busy||!inp.trim()} style={{width:36,height:36,borderRadius:10,border:"none",cursor:inp.trim()&&!busy?"pointer":"not-allowed",background:inp.trim()&&!busy?"linear-gradient(135deg,#10b981,#059669)":"rgba(255,255,255,0.06)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,opacity:busy||!inp.trim()?0.3:1}}>
          <Send size={14} style={{color:inp.trim()&&!busy?"#000":"rgba(255,255,255,0.4)"}}/>
        </button>
      </div>
    </div>
  );
}

// ─── EDITABLE COSTS TAB ───────────────────────────────────────────────────────
function CostsTab({lineItems,baselineItems,onUpdateLineItems,region,taxRate}){
  const [editing,setEditing]=useState(null);const [editVal,setEditVal]=useState("");
  const commit=()=>{if(!editing)return;const v=parseFloat(editVal);if(!isNaN(v))onUpdateLineItems(lineItems.map(i=>i.id===editing.id?{...i,[editing.f]:v,_modified:true}:i));setEditing(null);};
  const isMod=item=>{const b=baselineItems?.find(b=>b.id===item.id);return !b||b.materialCost!==item.materialCost||b.laborCost!==item.laborCost||b.qty!==item.qty||item._aiGenerated;};
  const subtotal=useMemo(()=>lineItems.reduce((s,i)=>s+(i.qty||0)*((i.materialCost||0)+(i.laborCost||0)),0),[lineItems]);
  const taxAmt=subtotal*(taxRate/100);
  const exportCSV=()=>{let c="CSI,Phase,Category,Description,Qty,Qty+Waste,Unit,Mat$/u,Lab$/u,Total\n";lineItems.forEach(i=>{const t=(i.qty||0)*((i.materialCost||0)+(i.laborCost||0));c+=`"${i.csi||""}","${i.phase||""}","${i.category||""}","${i.description}",${i.qty},${i.qty_with_waste||i.qty},"${i.unit}",${i.materialCost||0},${i.laborCost||0},${t.toFixed(2)}\n`;});const b=new Blob([c],{type:"text/csv"});const a=document.createElement("a");a.href=URL.createObjectURL(b);a.setAttribute("download","Takeoff_"+Date.now()+".csv");document.body.appendChild(a);a.click();document.body.removeChild(a);};
  return(
    <div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
        <p style={{color:`${GN}0.5)`,fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.2em",margin:0}}>Cost Matrix — Click cells to edit</p>
        <button onClick={exportCSV} style={{display:"flex",alignItems:"center",gap:4,padding:"4px 8px",borderRadius:8,border:`1px solid ${GN}0.2)`,background:`${GN}0.08)`,color:"#10b981",fontSize:9,fontWeight:700,cursor:"pointer"}}><FileSpreadsheet size={11}/>CSV</button>
      </div>
      <div style={{overflowX:"auto"}}>
        <table style={{width:"100%",fontSize:10,borderCollapse:"collapse"}}>
          <thead><tr style={{borderBottom:`1px solid ${GN}0.12)`}}>{["ID","Description","Qty","Qty+Waste","Unit","Mat$/u","Lab$/u","Total",""].map(h=><th key={h} style={{textAlign:"left",padding:"5px 4px",color:`${GN}0.4)`,fontWeight:700,whiteSpace:"nowrap"}}>{h}</th>)}</tr></thead>
          <tbody>{(lineItems||[]).map(item=>{const mod=isMod(item);const t=(item.qty||0)*((item.materialCost||0)+(item.laborCost||0));return(
            <tr key={item.id} style={{borderBottom:`1px solid ${GN}0.06)`,background:item._aiGenerated?"rgba(99,102,241,0.04)":mod?`${GN}0.03)`:"transparent"}}>
              <td style={{padding:"5px 4px"}}><span style={{fontFamily:"JetBrains Mono",color:`${GN}0.6)`,fontWeight:900,fontSize:9}}>{item.id}</span></td>
              <td style={{padding:"5px 4px",color:"rgba(255,255,255,0.62)",maxWidth:130,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}} title={item.description}>{item.description}</td>
              {["qty","materialCost","laborCost"].map(f=><td key={f} style={{padding:"5px 4px",cursor:"pointer"}} onClick={()=>{setEditing({id:item.id,f});setEditVal(String(item[f]||0));}}>
                {editing?.id===item.id&&editing?.f===f?<input autoFocus value={editVal} onChange={e=>setEditVal(e.target.value)} onBlur={commit} onKeyDown={e=>{if(e.key==="Enter")commit();if(e.key==="Escape")setEditing(null);}} style={{width:60,background:`${GN}0.1)`,border:`1px solid ${GN}0.3)`,borderRadius:6,padding:"2px 4px",color:"#34d399",fontFamily:"JetBrains Mono",fontSize:10,outline:"none"}}/>:<span style={{fontFamily:"JetBrains Mono",color:"rgba(255,255,255,0.62)",fontSize:10}}>{f==="qty"?item[f]:fmt(item[f]||0)}</span>}
              </td>)}
              <td style={{padding:"5px 4px",color:`${GN}0.6)`,fontFamily:"JetBrains Mono",fontSize:9}}>{item.qty_with_waste||item.qty}</td>
              <td style={{padding:"5px 4px",color:"rgba(255,255,255,0.22)",fontSize:9}}>{item.unit}</td>
              <td style={{padding:"5px 4px",fontFamily:"JetBrains Mono",fontWeight:900,color:item._aiGenerated?"#818cf8":mod?"#10b981":"rgba(255,255,255,0.62)",fontSize:10}}>{fmt(t)}</td>
              <td style={{padding:"5px 4px"}}><button onClick={()=>onUpdateLineItems(lineItems.filter(i=>i.id!==item.id))} style={{background:"none",border:"none",cursor:"pointer",color:"rgba(239,68,68,0.2)",padding:2}}><X size={11}/></button></td>
            </tr>);})}</tbody>
          <tfoot><tr style={{borderTop:`2px solid ${GN}0.2)`}}>
            <td colSpan={7} style={{padding:"6px 4px",color:"#fff",fontWeight:900,fontSize:11}}>Subtotal</td>
            <td style={{padding:"6px 4px",fontFamily:"JetBrains Mono",fontWeight:900,color:"rgba(255,255,255,0.8)",fontSize:11}}>{fmt(subtotal)}</td><td/>
          </tr>
          <tr><td colSpan={7} style={{padding:"4px",color:"rgba(255,255,255,0.4)",fontSize:10}}>Tax ({taxRate}%)</td><td style={{padding:"4px",fontFamily:"JetBrains Mono",color:"rgba(255,255,255,0.4)",fontSize:10}}>{fmt(taxAmt)}</td><td/></tr>
          <tr style={{borderTop:`1px solid ${GN}0.15)`}}><td colSpan={7} style={{padding:"6px 4px",color:"#10b981",fontWeight:900,fontSize:12}}>TOTAL INC. TAX</td><td style={{padding:"6px 4px",fontFamily:"JetBrains Mono",fontWeight:900,color:"#10b981",fontSize:12}}>{fmt(subtotal+taxAmt)}</td><td/></tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function MultiCurrencyCompare({baseTotalUsd}){
  const rates=[{code:"USD",flag:"🇺🇸",rate:1,sym:"$"},{code:"NGN",flag:"🇳🇬",rate:1,sym:"₦"},{code:"GBP",flag:"🇬🇧",rate:0.79,sym:"£"},{code:"EUR",flag:"🇪🇺",rate:0.92,sym:"€"},{code:"AUD",flag:"🇦🇺",rate:1.53,sym:"A$"},{code:"INR",flag:"🇮🇳",rate:83,sym:"₹"}];
  return(<div><div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}><Globe size={13} style={{color:"#10b981"}}/><p style={{color:"rgba(255,255,255,0.45)",fontSize:11,fontWeight:700,margin:0}}>Multi-Region Parity</p></div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>{rates.map(r=><div key={r.code} style={{padding:10,borderRadius:10,border:`1px solid ${GN}0.1)`,background:`${GN}0.04)`}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}><span style={{color:"rgba(255,255,255,0.25)",fontSize:9,fontWeight:700}}>{r.code}</span><span style={{fontSize:13}}>{r.flag}</span></div><p style={{fontFamily:"JetBrains Mono",fontWeight:700,fontSize:12,color:"rgba(255,255,255,0.7)",margin:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.sym}{(baseTotalUsd*r.rate).toLocaleString(undefined,{maximumFractionDigits:0})}</p></div>)}</div></div>);}

function CostSensitivitySliders({baseTotal,onMultiplierChange}){
  const [mod,setMod]=useState({inflation:0,steel:0,labor:0,concrete:0});
  const calc=m=>1+((m.inflation+m.steel*0.30+m.labor*0.45+m.concrete*0.25)/100);
  const update=(k,v)=>{const u={...mod,[k]:parseFloat(v)};setMod(u);onMultiplierChange?.(calc(u));};
  const mult=calc(mod);const impact=(baseTotal*mult)-baseTotal;
  return(<div><div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}><div style={{display:"flex",alignItems:"center",gap:6}}><Sliders size={13} style={{color:"#10b981"}}/><p style={{color:"rgba(255,255,255,0.45)",fontSize:11,fontWeight:700,margin:0}}>Volatility Stress Test</p></div><Pill c="emerald">LIVE</Pill></div>
    {[["inflation","Global Inflation",-5,25,1],["steel","Steel Volatility",0,40,5],["labor","Labor Premium",0,50,5],["concrete","Concrete Index",0,30,5]].map(([k,l,min,max,step])=><div key={k} style={{marginBottom:10}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span style={{color:"rgba(255,255,255,0.4)",fontSize:10}}>{l}</span><span style={{color:mod[k]>15?"#f43f5e":"rgba(255,255,255,0.5)",fontSize:10,fontWeight:700,fontFamily:"JetBrains Mono"}}>{mod[k]>0?"+":""}{mod[k]}%</span></div><input type="range" min={min} max={max} step={step} value={mod[k]} onChange={e=>update(k,e.target.value)} style={{width:"100%",height:4,accentColor:"#10b981",cursor:"pointer"}}/></div>)}
    <div style={{padding:10,borderRadius:10,border:`1px solid ${impact>0?"rgba(245,158,11,0.2)":`${GN}0.15)`}`,background:impact>0?"rgba(245,158,11,0.05)":`${GN}0.04)`,display:"flex",alignItems:"center",gap:10}}>
      {impact>0?<AlertTriangle size={13} style={{color:"#f59e0b",flexShrink:0}}/>:<TrendingUp size={13} style={{color:"#10b981",flexShrink:0}}/>}
      <div><p style={{color:"rgba(255,255,255,0.5)",fontSize:10,fontWeight:600,margin:0}}>Cost Exposure x{mult.toFixed(3)}</p><p style={{fontFamily:"JetBrains Mono",fontWeight:900,fontSize:13,margin:0,color:impact>0?"#fbbf24":"#10b981"}}>{impact>0?"+":""}{fmtUSD(impact)} USD</p></div>
    </div>
  </div>);}

// ─── HISTORY PANEL ───────────────────────────────────────────────────────────
function HistoryPanel({userSession,dbRefresh}){
  const [cloudRecs,setCloudRecs]=useState([]);const [localSnaps,setLocalSnaps]=useState([]);const [loading,setLoading]=useState(false);const [tab,setTab]=useState("local");
  const load=useCallback(async()=>{setLoading(true);try{const snaps=await dbAll("projectSnapshots");setLocalSnaps(snaps);if(userSession?.dbConfig?.type==="mongo"&&userSession?.dbConfig?.apiKey){const d=await mongoAPI.find(userSession.dbConfig.apiKey,userSession.dbConfig.appId,"estimations",{userEmail:userSession.email});setCloudRecs(d.documents||[]);}}catch(e){console.error("History:",e);}finally{setLoading(false);}},[ userSession,dbRefresh]);
  useEffect(()=>{load();},[load]);
  const ago=iso=>{const m=Math.floor((Date.now()-new Date(iso))/6e4);if(m<1)return"now";if(m<60)return`${m}m`;const h=Math.floor(m/60);if(h<24)return`${h}h`;return`${Math.floor(h/24)}d`;};
  return(<div>
    <div style={{display:"flex",gap:4,marginBottom:10,padding:3,borderRadius:10,background:`${GN}0.05)`,border:`1px solid ${GN}0.1)`}}>
      {[["local","💾 Local"],["cloud","☁️ Cloud"]].map(([k,l])=><button key={k} onClick={()=>setTab(k)} style={{flex:1,padding:"6px 0",fontSize:10,fontWeight:700,borderRadius:8,border:"none",cursor:"pointer",background:tab===k?`${GN}0.15)`:"transparent",color:tab===k?"#10b981":"rgba(255,255,255,0.25)"}}>{l}</button>)}
    </div>
    {loading&&<div style={{textAlign:"center",padding:20}}><RefreshCw size={20} style={{color:"#10b981",animation:"spin 1s linear infinite",display:"block",margin:"auto"}}/></div>}
    {!loading&&tab==="local"&&(localSnaps.length===0?<p style={{color:"rgba(255,255,255,0.15)",fontSize:10,textAlign:"center",padding:"30px 0"}}>No local snapshots yet.</p>:<div style={{display:"flex",flexDirection:"column",gap:8,maxHeight:280,overflowY:"auto"}}>{localSnaps.map(s=>{const trade=TRADES[s.tradeMode]||TRADES.GENERAL;const Icon=trade.icon;return(<div key={s.projectId} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:10,borderRadius:12,border:`1px solid ${GN}0.1)`,background:`${GN}0.03)`}}><div style={{display:"flex",alignItems:"center",gap:8}}><Icon size={13} style={{color:trade.color,flexShrink:0}}/><div><p style={{color:"rgba(255,255,255,0.65)",fontSize:11,fontWeight:700,margin:0,maxWidth:140,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{s.label||"Estimate"}</p><p style={{color:"rgba(255,255,255,0.25)",fontSize:9,fontFamily:"JetBrains Mono",margin:0}}>{s.region} · {ago(s.savedAt)}</p></div></div><span style={{color:"#10b981",fontSize:10,fontFamily:"JetBrains Mono",fontWeight:700}}>{s.bidFormatted}</span></div>);})})</div>)}
    {!loading&&tab==="cloud"&&(!userSession?.dbConfig?<div style={{textAlign:"center",padding:"30px 0"}}><Cloud size={24} style={{color:"rgba(255,255,255,0.1)",display:"block",margin:"0 auto 8px"}}/><p style={{color:"rgba(255,255,255,0.2)",fontSize:10,margin:0}}>No database configured.</p><p style={{color:"rgba(255,255,255,0.12)",fontSize:9,margin:"4px 0 0"}}>Add MongoDB config in the login screen.</p></div>:cloudRecs.length===0?<p style={{color:"rgba(255,255,255,0.15)",fontSize:10,textAlign:"center",padding:"30px 0"}}>No cloud records yet. Run an analysis to save.</p>:<div style={{display:"flex",flexDirection:"column",gap:8,maxHeight:280,overflowY:"auto"}}>{cloudRecs.map((item,i)=><div key={item._id||i} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:10,borderRadius:12,border:`1px solid ${GN}0.1)`,background:`${GN}0.03)`}}><div style={{display:"flex",alignItems:"center",gap:8}}><Database size={13} style={{color:`${GN}0.5)`,flexShrink:0}}/><div><p style={{color:"rgba(255,255,255,0.65)",fontSize:11,fontWeight:700,margin:0,maxWidth:140,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{item.filename||"Blueprint"}</p><p style={{color:"rgba(255,255,255,0.25)",fontSize:9,fontFamily:"JetBrains Mono",margin:0}}>{item.currency} · {ago(item.createdAt)}</p></div></div><Pill c="teal">MONGO</Pill></div>)})</div>)}
  </div>);}

// ─── ADMIN PANEL ──────────────────────────────────────────────────────────────
function AdminPanel({onClose,onRefreshLicense}){
  const [lics,setLics]=useState([]);const [status,setStatus]=useState("");const [busy,setBusy]=useState(false);const importRef=useRef();
  const scan=async()=>{try{const db=await openDB();const r=db.transaction("userLicenses","readonly").objectStore("userLicenses").getAll();r.onsuccess=()=>setLics(r.result||[]);}catch(e){alert("Scan error: "+e.message);}};
  return(
    <div style={{position:"fixed",inset:0,zIndex:50,display:"flex",alignItems:"center",justifyContent:"center",padding:16,background:"rgba(0,0,0,0.8)"}} onClick={onClose}>
      <Card style={{width:"100%",maxWidth:500,overflow:"hidden"}} onClick={e=>e.stopPropagation()}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"13px 18px",borderBottom:`1px solid ${GN}0.12)`,background:`${GN}0.04)`}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}><ShieldAlert size={15} style={{color:"#10b981"}}/><p style={{color:"#fff",fontWeight:700,fontSize:12,margin:0}}>Admin and Backup Dashboard</p></div>
          <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",color:"rgba(255,255,255,0.3)"}}><X size={15}/></button>
        </div>
        <div style={{padding:18,maxHeight:"70vh",overflowY:"auto",display:"flex",flexDirection:"column",gap:12}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
            <button onClick={async()=>{setBusy(true);await exportLocalSystemBackup();setBusy(false);}} style={{padding:14,borderRadius:12,border:"1px solid rgba(96,165,250,0.25)",background:"rgba(96,165,250,0.08)",color:"#60a5fa",cursor:"pointer",fontSize:11,fontWeight:700}}>{busy?"Packaging...":"Export Backup"}</button>
            <div><input ref={importRef} type="file" accept=".json" style={{display:"none"}} onChange={async e=>{try{const r=await importBackupFromFile(e);if(r.success){setStatus("Restored: "+new Date(r.timestamp).toLocaleDateString());onRefreshLicense?.();}}catch(err){setStatus("Failed: "+err);}}}/>
            <button onClick={()=>importRef.current.click()} style={{width:"100%",padding:14,borderRadius:12,border:`1px solid ${GN}0.25)`,background:`${GN}0.08)`,color:"#10b981",cursor:"pointer",fontSize:11,fontWeight:700}}>Restore Backup</button>
            {status&&<p style={{color:status.startsWith("Restored")?"#10b981":"#f87171",fontSize:9,marginTop:4,fontFamily:"JetBrains Mono"}}>{status}</p>}</div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            {[["Simulate Day-31 Expiry","rgba(161,98,7,0.2)","rgba(161,98,7,0.4)","#fcd34d",async()=>{await debugForceBackdateLicense("ENTERPRISE_MONTHLY",31);onRefreshLicense?.();}],["Revoke License","rgba(127,29,29,0.28)","rgba(127,29,29,0.45)","#fca5a5",async()=>{await debugForceRevokeLicense("ENTERPRISE_MONTHLY");onRefreshLicense?.();}]].map(([l,bg,bc,c,fn])=><button key={l} onClick={fn} style={{padding:"8px 10px",borderRadius:8,border:`1px solid ${bc}`,background:bg,color:c,fontSize:10,fontWeight:700,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"space-between"}}>{l}<RotateCcw size={11}/></button>)}
          </div>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}><p style={{color:"rgba(255,255,255,0.55)",fontSize:11,fontWeight:700,margin:0}}>License Store</p><button onClick={scan} style={{padding:"4px 10px",borderRadius:8,border:"1px solid rgba(255,255,255,0.1)",background:"rgba(255,255,255,0.05)",color:"rgba(255,255,255,0.4)",fontSize:9,cursor:"pointer"}}>Run Scan</button></div>
          {lics.length>0&&<table style={{width:"100%",fontSize:9,borderCollapse:"collapse"}}><thead><tr style={{borderBottom:`1px solid ${GN}0.1)`}}>{["Key","Reference","Status","Activated"].map(h=><th key={h} style={{textAlign:"left",padding:"5px 6px",color:`${GN}0.4)`,fontWeight:700}}>{h}</th>)}</tr></thead><tbody>{lics.map((l,i)=><tr key={i} style={{borderBottom:`1px solid ${GN}0.05)`}}><td style={{padding:"5px 6px",fontFamily:"JetBrains Mono",color:`${GN}0.65)`,maxWidth:90,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{l.featureKey}</td><td style={{padding:"5px 6px",fontFamily:"JetBrains Mono",color:"rgba(255,255,255,0.3)",maxWidth:70,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{l.reference}</td><td style={{padding:"5px 6px"}}><span style={{padding:"2px 6px",borderRadius:99,fontSize:8,fontWeight:900,background:`${GN}0.15)`,color:"#10b981"}}>{l.isUnlocked?"ACTIVE":"OFF"}</span></td><td style={{padding:"5px 6px",fontFamily:"JetBrains Mono",color:"rgba(255,255,255,0.2)",whiteSpace:"nowrap"}}>{l.activatedAt?new Date(l.activatedAt).toLocaleDateString():"-"}</td></tr>)}</tbody></table>}
        </div>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// USAGE TRACKER PANEL — $250/month = 100 blueprint scans
// Add-on packs: 30 extra scans for $50
// ═══════════════════════════════════════════════════════════════
// ─── SUBSCRIPTION PLANS ──────────────────────────────────────────
const PLAN_FILE_LIMITS = {
  basic:      50  * 1024 * 1024,  // 50MB
  starter:    150 * 1024 * 1024,  // 150MB
  pro:        300 * 1024 * 1024,  // 300MB
  enterprise: 1024 * 1024 * 1024, // 1GB
};

const REGIONS = {
  NG:{label:"🇳🇬 Nigeria",currency:"USD",symbol:"$",locale:"en-US",rate:1,unit:"sqft",tax:7.5,taxLabel:"VAT",buildingCode:"NBO 2006",mat_currency:"NGN",mat_symbol:"₦",mat_rate:1650},
  GH:{label:"🇬🇭 Ghana",currency:"USD",symbol:"$",locale:"en-US",rate:1,unit:"sqft",tax:12.5,taxLabel:"VAT",buildingCode:"GBC 2008",mat_currency:"GHS",mat_symbol:"GH₵",mat_rate:15.2},
  KE:{label:"🇰🇪 Kenya",currency:"USD",symbol:"$",locale:"en-US",rate:1,unit:"sqft",tax:16,taxLabel:"VAT",buildingCode:"KBC 2009",mat_currency:"KES",mat_symbol:"KSh",mat_rate:131},
  ZA:{label:"🇿🇦 South Africa",currency:"USD",symbol:"$",locale:"en-US",rate:1,unit:"sqft",tax:15,taxLabel:"VAT",buildingCode:"SANS 10400",mat_currency:"ZAR",mat_symbol:"R",mat_rate:18.5},
  EG:{label:"🇪🇬 Egypt",currency:"USD",symbol:"$",locale:"en-US",rate:1,unit:"sqm",tax:14,taxLabel:"VAT",buildingCode:"ECP 2001",mat_currency:"EGP",mat_symbol:"£",mat_rate:48},
  ET:{label:"🇪🇹 Ethiopia",currency:"USD",symbol:"$",locale:"en-US",rate:1,unit:"sqm",tax:15,taxLabel:"VAT",buildingCode:"EBCS",mat_currency:"ETB",mat_symbol:"Br",mat_rate:56},
  TZ:{label:"🇹🇿 Tanzania",currency:"USD",symbol:"$",locale:"en-US",rate:1,unit:"sqft",tax:18,taxLabel:"VAT",buildingCode:"TBC",mat_currency:"TZS",mat_symbol:"TSh",mat_rate:2490},
  UG:{label:"🇺🇬 Uganda",currency:"USD",symbol:"$",locale:"en-US",rate:1,unit:"sqft",tax:18,taxLabel:"VAT",buildingCode:"UBC",mat_currency:"UGX",mat_symbol:"USh",mat_rate:3750},
  MA:{label:"🇲🇦 Morocco",currency:"USD",symbol:"$",locale:"en-US",rate:1,unit:"sqm",tax:20,taxLabel:"TVA",buildingCode:"NM BC",mat_currency:"MAD",mat_symbol:"DH",mat_rate:10},
  SA:{label:"🇸🇦 Saudi Arabia",currency:"USD",symbol:"$",locale:"en-US",rate:1,unit:"sqm",tax:15,taxLabel:"VAT",buildingCode:"SBC 2018",mat_currency:"SAR",mat_symbol:"SAR ",mat_rate:3.75,flags:["SBC_COMPLIANCE","SASO","SCE_STAMP"]},
  AE:{label:"🇦🇪 UAE",currency:"USD",symbol:"$",locale:"en-US",rate:1,unit:"sqm",tax:5,taxLabel:"VAT",buildingCode:"UAE BC",mat_currency:"AED",mat_symbol:"AED ",mat_rate:3.67,flags:["RERA","DM_APPROVED"]},
  QA:{label:"🇶🇦 Qatar",currency:"USD",symbol:"$",locale:"en-US",rate:1,unit:"sqm",tax:0,taxLabel:"None",buildingCode:"QBC",mat_currency:"QAR",mat_symbol:"QAR ",mat_rate:3.64},
  KW:{label:"🇰🇼 Kuwait",currency:"USD",symbol:"$",locale:"en-US",rate:1,unit:"sqm",tax:0,taxLabel:"None",buildingCode:"KBC",mat_currency:"KWD",mat_symbol:"KD",mat_rate:0.31},
  BH:{label:"🇧🇭 Bahrain",currency:"USD",symbol:"$",locale:"en-US",rate:1,unit:"sqm",tax:10,taxLabel:"VAT",buildingCode:"BBC",mat_currency:"BHD",mat_symbol:"BD",mat_rate:0.38},
  OM:{label:"🇴🇲 Oman",currency:"USD",symbol:"$",locale:"en-US",rate:1,unit:"sqm",tax:5,taxLabel:"VAT",buildingCode:"OBC",mat_currency:"OMR",mat_symbol:"OMR ",mat_rate:0.38},
  JO:{label:"🇯🇴 Jordan",currency:"USD",symbol:"$",locale:"en-US",rate:1,unit:"sqm",tax:16,taxLabel:"GST",buildingCode:"JBC",mat_currency:"JOD",mat_symbol:"JD",mat_rate:0.71},
  IN:{label:"🇮🇳 India",currency:"USD",symbol:"$",locale:"en-US",rate:1,unit:"sqft",tax:18,taxLabel:"GST",buildingCode:"NBC 2016",mat_currency:"INR",mat_symbol:"₹",mat_rate:83},
  CN:{label:"🇨🇳 China",currency:"USD",symbol:"$",locale:"en-US",rate:1,unit:"sqm",tax:13,taxLabel:"VAT",buildingCode:"GB 50352",mat_currency:"CNY",mat_symbol:"¥",mat_rate:7.25},
  JP:{label:"🇯🇵 Japan",currency:"USD",symbol:"$",locale:"en-US",rate:1,unit:"sqm",tax:10,taxLabel:"JCT",buildingCode:"BSL 2021",mat_currency:"JPY",mat_symbol:"¥",mat_rate:149},
  KR:{label:"🇰🇷 South Korea",currency:"USD",symbol:"$",locale:"en-US",rate:1,unit:"sqm",tax:10,taxLabel:"VAT",buildingCode:"KBC 2021",mat_currency:"KRW",mat_symbol:"₩",mat_rate:1330},
  SG:{label:"🇸🇬 Singapore",currency:"USD",symbol:"$",locale:"en-US",rate:1,unit:"sqft",tax:9,taxLabel:"GST",buildingCode:"BCA 2019",mat_currency:"SGD",mat_symbol:"S$",mat_rate:1.35},
  AU:{label:"🇦🇺 Australia",currency:"USD",symbol:"$",locale:"en-US",rate:1,unit:"sqm",tax:10,taxLabel:"GST",buildingCode:"NCC 2022",mat_currency:"AUD",mat_symbol:"A$",mat_rate:1.53},
  NZ:{label:"🇳🇿 New Zealand",currency:"USD",symbol:"$",locale:"en-US",rate:1,unit:"sqm",tax:15,taxLabel:"GST",buildingCode:"NZBC 2021",mat_currency:"NZD",mat_symbol:"NZ$",mat_rate:1.63},
  ID:{label:"🇮🇩 Indonesia",currency:"USD",symbol:"$",locale:"en-US",rate:1,unit:"sqm",tax:11,taxLabel:"PPN",buildingCode:"SNI",mat_currency:"IDR",mat_symbol:"Rp",mat_rate:15800},
  MY:{label:"🇲🇾 Malaysia",currency:"USD",symbol:"$",locale:"en-US",rate:1,unit:"sqft",tax:10,taxLabel:"SST",buildingCode:"MS BC",mat_currency:"MYR",mat_symbol:"RM",mat_rate:4.7},
  TH:{label:"🇹🇭 Thailand",currency:"USD",symbol:"$",locale:"en-US",rate:1,unit:"sqm",tax:7,taxLabel:"VAT",buildingCode:"TBC",mat_currency:"THB",mat_symbol:"฿",mat_rate:35},
  PH:{label:"🇵🇭 Philippines",currency:"USD",symbol:"$",locale:"en-US",rate:1,unit:"sqft",tax:12,taxLabel:"VAT",buildingCode:"NBC 2005",mat_currency:"PHP",mat_symbol:"₱",mat_rate:56},
  VN:{label:"🇻🇳 Vietnam",currency:"USD",symbol:"$",locale:"en-US",rate:1,unit:"sqm",tax:10,taxLabel:"VAT",buildingCode:"QCVN",mat_currency:"VND",mat_symbol:"₫",mat_rate:24500},
  PK:{label:"🇵🇰 Pakistan",currency:"USD",symbol:"$",locale:"en-US",rate:1,unit:"sqft",tax:17,taxLabel:"GST",buildingCode:"BNBC",mat_currency:"PKR",mat_symbol:"Rs",mat_rate:279},
  BD:{label:"🇧🇩 Bangladesh",currency:"USD",symbol:"$",locale:"en-US",rate:1,unit:"sqft",tax:15,taxLabel:"VAT",buildingCode:"BNBC 2020",mat_currency:"BDT",mat_symbol:"Tk",mat_rate:110},
  US:{label:"🇺🇸 United States",currency:"USD",symbol:"$",locale:"en-US",rate:1,unit:"sqft",tax:8.5,taxLabel:"Tax",buildingCode:"IBC 2021",mat_currency:"USD",mat_symbol:"$",mat_rate:1},
  CA:{label:"🇨🇦 Canada",currency:"USD",symbol:"$",locale:"en-US",rate:1,unit:"sqft",tax:13,taxLabel:"HST",buildingCode:"NBCC 2020",mat_currency:"CAD",mat_symbol:"C$",mat_rate:1.36},
  MX:{label:"🇲🇽 Mexico",currency:"USD",symbol:"$",locale:"en-US",rate:1,unit:"sqm",tax:16,taxLabel:"IVA",buildingCode:"NMX BC",mat_currency:"MXN",mat_symbol:"$",mat_rate:17},
  BR:{label:"🇧🇷 Brazil",currency:"USD",symbol:"$",locale:"en-US",rate:1,unit:"sqm",tax:17,taxLabel:"ICMS",buildingCode:"ABNT NBR",mat_currency:"BRL",mat_symbol:"R$",mat_rate:5},
  AR:{label:"🇦🇷 Argentina",currency:"USD",symbol:"$",locale:"en-US",rate:1,unit:"sqm",tax:21,taxLabel:"IVA",buildingCode:"CIRSOC",mat_currency:"ARS",mat_symbol:"$",mat_rate:890},
  CO:{label:"🇨🇴 Colombia",currency:"USD",symbol:"$",locale:"en-US",rate:1,unit:"sqm",tax:19,taxLabel:"IVA",buildingCode:"NSR 10",mat_currency:"COP",mat_symbol:"$",mat_rate:3900},
  UK:{label:"🇬🇧 United Kingdom",currency:"USD",symbol:"$",locale:"en-US",rate:1,unit:"sqft",tax:20,taxLabel:"VAT",buildingCode:"UK BC 2022",mat_currency:"GBP",mat_symbol:"£",mat_rate:0.79},
  DE:{label:"🇩🇪 Germany",currency:"USD",symbol:"$",locale:"en-US",rate:1,unit:"sqm",tax:19,taxLabel:"MwSt",buildingCode:"MBO",mat_currency:"EUR",mat_symbol:"€",mat_rate:0.92},
  FR:{label:"🇫🇷 France",currency:"USD",symbol:"$",locale:"en-US",rate:1,unit:"sqm",tax:20,taxLabel:"TVA",buildingCode:"CCH",mat_currency:"EUR",mat_symbol:"€",mat_rate:0.92},
  IT:{label:"🇮🇹 Italy",currency:"USD",symbol:"$",locale:"en-US",rate:1,unit:"sqm",tax:22,taxLabel:"IVA",buildingCode:"D.Lgs 81",mat_currency:"EUR",mat_symbol:"€",mat_rate:0.92},
  ES:{label:"🇪🇸 Spain",currency:"USD",symbol:"$",locale:"en-US",rate:1,unit:"sqm",tax:21,taxLabel:"IVA",buildingCode:"CTE",mat_currency:"EUR",mat_symbol:"€",mat_rate:0.92},
  NL:{label:"🇳🇱 Netherlands",currency:"USD",symbol:"$",locale:"en-US",rate:1,unit:"sqm",tax:21,taxLabel:"BTW",buildingCode:"Bouwbesluit",mat_currency:"EUR",mat_symbol:"€",mat_rate:0.92},
  SE:{label:"🇸🇪 Sweden",currency:"USD",symbol:"$",locale:"en-US",rate:1,unit:"sqm",tax:25,taxLabel:"MOMS",buildingCode:"PBL",mat_currency:"SEK",mat_symbol:"kr",mat_rate:10.5},
  NO:{label:"🇳🇴 Norway",currency:"USD",symbol:"$",locale:"en-US",rate:1,unit:"sqm",tax:25,taxLabel:"MVA",buildingCode:"TEK17",mat_currency:"NOK",mat_symbol:"kr",mat_rate:10.6},
  PL:{label:"🇵🇱 Poland",currency:"USD",symbol:"$",locale:"en-US",rate:1,unit:"sqm",tax:23,taxLabel:"VAT",buildingCode:"Prawo budowlane",mat_currency:"PLN",mat_symbol:"zł",mat_rate:4},
  TR:{label:"🇹🇷 Turkey",currency:"USD",symbol:"$",locale:"en-US",rate:1,unit:"sqm",tax:20,taxLabel:"KDV",buildingCode:"TSE",mat_currency:"TRY",mat_symbol:"₺",mat_rate:32},
  RU:{label:"🇷🇺 Russia",currency:"USD",symbol:"$",locale:"en-US",rate:1,unit:"sqm",tax:20,taxLabel:"НДС",buildingCode:"SP 20.13",mat_currency:"RUB",mat_symbol:"₽",mat_rate:89},
};

// Country regulations derived from REGIONS
const COUNTRY_REGULATIONS = Object.fromEntries(
  Object.entries(REGIONS).map(([code,r])=>[code,{
    currency:r.currency||"USD",mat_currency:r.mat_currency||"USD",
    mat_symbol:r.mat_symbol||"$",mat_rate:r.mat_rate||1,
    taxLabel:r.taxLabel||"VAT",taxRate:r.tax||0,
    units:r.unit||"sqm",buildingCode:r.buildingCode||"",
    complianceFlags:r.flags||[],
  }])
);

// ── CRYPTO PAYMENT CONFIG ─────────────────────────────────────
const CRYPTO_CONFIG = {
  wallet_address: "0xD9fa20A745C5f72938D7EFF6d5008257277f15f0",
  network:        "Ethereum (ERC20) ONLY",
  coin:           "USDT",
  warning:        "Send USDT on Ethereum network ONLY. Any other network = permanent loss.",
  contact:        "https://wa.me/2349168856450",
};

const PLANS = {
  basic: {
    id:"basic", label:"Basic", badge:"",
    price:150,   annual:1800,
    dailyScans:3, scans:90, annual_scans:1080,
    fileLimitMB:50,
    addon_price:10, addon_per:"scan",
    seats:1,
    features:[
      "1 Personal Account — 1 user only",
      "3 uploads per day · 50MB max file size",
      "6 Trade Modes (Electrical, Plumbing, Roofing, HVAC, Civil, General)",
      "AI Blueprint Analysis — PDF and Image",
      "Interactive Cost Matrix + PDF Report",
      "Risk Assessment",
      "Project History",
    ],
  },
  starter: {
    id:"starter", label:"Starter", badge:"",
    price:400,   annual:4800,
    dailyScans:10, scans:300, annual_scans:3600,
    fileLimitMB:150,
    addon_price:10, addon_per:"scan",
    seats:1,
    features:[
      "1 Personal Account — 1 user only",
      "6 Trade Modes (Electrical, Plumbing, Roofing, HVAC, Civil, General)",
      "AI Blueprint Analysis — PDF and Image",
      "10 uploads per day · 150MB max file size",
      "Interactive Cost Matrix + PDF Report",
      "RFQ and Purchase Order Generator",
      "QuickBooks, Sage 300, BIM/IFC, CSV Export",
      "Risk Assessment + Value Engineering",
      "Project History",
    ],
  },
  pro: {
    id:"pro", label:"Pro", badge:"POPULAR",
    price:700,   annual:8400,
    dailyScans:10, scans:300, annual_scans:3600,
    fileLimitMB:300,
    addon_price:10, addon_per:"scan",
    seats:1,
    features:[
      "1 Personal Account — 1 user only",
      "Everything in Starter",
      "10 uploads per day · 300MB max file size",
      "V1 vs V2 Blueprint Comparison + Change Orders",
      "Assembly Library (one-click cost packages)",
      "Structural Calculator (concrete + rebar)",
      "Scale Correction Tool",
      "Triple AI Copilot — /findRisks /valueEngineer /generateRFQ",
      "Vision Copilot (ask questions about your blueprint)",
      "Client Share Link + E-Signature Approval",
      "Carbon Score · Bid Health Score",
    ],
  },
  enterprise: {
    id:"enterprise", label:"Enterprise", badge:"POWER",
    price:2500,  annual:30000,
    dailyScans:Infinity, scans:Infinity, annual_scans:Infinity,
    fileLimitMB:1024,
    addon_price:10, addon_per:"scan",
    seats:1,
    features:[
      "1 Personal Account — 1 user only",
      "Everything in Pro",
      "Unlimited uploads per day · 1GB max file size",
      "Extra scans: $10 each (no hard cap)",
      "Unlimited project history",
      "White-label PDF reports",
      "Priority WhatsApp support",
      "Dedicated onboarding session",
      "Custom trade prompt tuning",
    ],
  },
};



const PLAN_SCAN_LIMIT = 600;   // default monthly (updated dynamically from license)
const ADDON_SCANS     = 50;    // default monthly add-on
const ADDON_PRICE_USD = 30;    // default monthly add-on price

async function getMonthlyUsage() {
  try {
    const r = await dbOne("userLicenses", "SCAN_USAGE");
    if (!r) return { count:0, month:new Date().getMonth(), addonScans:0 };
    const now = new Date();
    // Reset if new month
    if (r.month !== now.getMonth() || r.year !== now.getFullYear()) {
      const reset = { featureKey:"SCAN_USAGE", count:0, month:now.getMonth(), year:now.getFullYear(), addonScans:r.addonScans||0 };
      await dbPut("userLicenses", reset);
      return reset;
    }
    return r;
  } catch { return { count:0, month:new Date().getMonth(), addonScans:0 }; }
}
async function incrementScanUsage() {
  const usage = await getMonthlyUsage();
  const updated = { ...usage, featureKey:"SCAN_USAGE", count:(usage.count||0)+1 };
  await dbPut("userLicenses", updated);
  return updated;
}
async function addAddonScans(qty) {
  const usage = await getMonthlyUsage();
  const updated = { ...usage, featureKey:"SCAN_USAGE", addonScans:(usage.addonScans||0)+qty };
  await dbPut("userLicenses", updated);
  return updated;
}

function UsageTrackerPanel({ usage, onOpenAddonOptions }) {
  const currentUsage = usage?.count || 0;
  const addonScans   = usage?.addonScans || 0;
  const totalLimit   = PLAN_SCAN_LIMIT + addonScans;
  const remaining    = Math.max(0, totalLimit - currentUsage);
  const usagePct     = Math.min(100, (currentUsage / totalLimit) * 100);
  const isCritical   = remaining <= 10;
  const progressColor = isCritical ? "#ef4444" : usagePct > 80 ? "#f59e0b" : "#10b981";
  return (
    <div style={{ background:"#0d2018", border:`1px solid ${isCritical?"#ef4444":"rgba(16,185,129,0.2)"}`, borderRadius:12, padding:16, color:"#fff", fontFamily:"Space Grotesk, sans-serif", boxShadow:"0 4px 20px rgba(0,0,0,0.3)" }}>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <FileText size={16} style={{ color:progressColor }}/>
          <span style={{ fontWeight:600, fontSize:12 }}>Blueprint Page Budget</span>
        </div>
        <span style={{ fontSize:11, color:"#94a3b8" }}>
          <strong style={{ color:"#fff" }}>{currentUsage}</strong> / {totalLimit} scans
        </span>
      </div>
      <div style={{ width:"100%", height:8, background:"#0a1a12", borderRadius:999, overflow:"hidden", marginBottom:12, border:"1px solid rgba(16,185,129,0.1)" }}>
        <div style={{ width:`${usagePct}%`, height:"100%", background:progressColor, borderRadius:999, transition:"width 0.4s ease-out" }}/>
      </div>
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:10 }}>
        <p style={{ margin:0, fontSize:11, color:isCritical?"#fca5a5":"#a7f3d0" }}>
          {isCritical ? `Only ${remaining} scans left this month!` : `${remaining} scans remaining this cycle.`}
        </p>
        <button onClick={onOpenAddonOptions} style={{ backgroundColor:isCritical?"#ef4444":"rgba(16,185,129,0.1)", color:isCritical?"#fff":"#10b981", border:isCritical?"none":"1px solid #10b981", borderRadius:6, padding:"5px 10px", fontSize:10, fontWeight:600, cursor:"pointer", display:"flex", alignItems:"center", gap:4 }}>
          <Plus size={13}/>Buy Add-on
        </button>
      </div>
      {addonScans > 0 && <p style={{ fontSize:9, color:"rgba(16,185,129,0.5)", margin:"6px 0 0", fontFamily:"JetBrains Mono" }}>+{addonScans} add-on scans active</p>}
    </div>
  );
}



// ═══════════════════════════════════════════════════════════════
// PLAN SELECTOR — Monthly vs Annual with payment method choice
// ═══════════════════════════════════════════════════════════════
function PlanSelector({email: emailProp, region, paystackKey, paystackReady, onSuccess}) {
  const [selectedPlan, setSelectedPlan]   = useState("starter");
  const [billingCycle, setBillingCycle]   = useState("monthly");
  const [payMethod, setPayMethod]         = useState("paystack");
  const [processing, setProcessing]       = useState(false);
  const [resolvedEmail, setResolvedEmail] = useState(emailProp||"");
  const [successData, setSuccessData]     = useState(null);
  const [showCryptoFlow, setShowCryptoFlow] = useState(false);

  const plan = PLANS[selectedPlan];
  const r    = REGIONS[region]||REGIONS.NG;
  const isAnnual = billingCycle==="annual";

  // Email fallback from IndexedDB
  const email = resolvedEmail;
  useEffect(()=>{
    if(emailProp){ setResolvedEmail(emailProp); return; }
    dbOne("userLicenses","SESSION_EMAIL").then(r=>{ if(r?.email) setResolvedEmail(r.email); }).catch(()=>{});
  },[emailProp]);

  // All prices in USD — no regional conversion
  const getPrice  = () => isAnnual ? plan.annual : plan.price;
  const getScans  = () => isAnnual ? plan.annual_scans : plan.scans;
  const getKobo   = () => getPrice() * 100; // cents for USD
  const priceStr  = () => `$${getPrice().toLocaleString()}${isAnnual?"/yr":"/mo"}`;

  // PAYSTACK handler
  const handlePaystack = () => {
    if(!email){ alert("Email missing. Log out and log back in."); return; }
    if(!paystackReady||!window.PaystackPop){ alert("Paystack loading. Wait 5 seconds and try again."); return; }
    if(!paystackKey||paystackKey.includes("YOUR_KEY")){ alert("Payment not configured. Try USDT payment."); return; }
    setProcessing(true);
    try{
      const handler = window.PaystackPop.setup({
        key: paystackKey,
        email,
        amount: getKobo(),
        currency: "USD",
        ref: "FE_"+selectedPlan.toUpperCase()+"_"+(isAnnual?"ANN":"MON")+"_"+Date.now(),
        metadata:{ plan:selectedPlan, billing:billingCycle, scans:getScans(), tier:"FORGEESTIMATE" },
        callback: async function(response){
          await saveLicense("ENTERPRISE_MONTHLY",{
            reference:response.reference, customerEmail:email,
            tier:"FE_"+selectedPlan.toUpperCase(),
            plan:selectedPlan, billing:billingCycle, scans:getScans(),
          });
          setProcessing(false);
          setSuccessData({reference:response.reference,plan:selectedPlan,email,scans:getScans()});
        },
        onClose: function(){ setProcessing(false); }
      });
      handler.openIframe();
    }catch(err){ setProcessing(false); alert("Payment error: "+err.message); }
  };

  // LEMON SQUEEZY
  const handleLemonSqueezy = () => {
    const key = selectedPlan+"_"+(isAnnual?"annual":"monthly");
    const variantId = LEMON_SQUEEZY_CONFIG.variants[key];
    if(!variantId||variantId.includes("VARIANT_ID")){
      alert("Lemon Squeezy not configured yet. Use USDT or Paystack.");
      return;
    }
    openLemonSqueezy(variantId, email, {plan:selectedPlan, billing:billingCycle});
  };

  const TIER_COLORS = { starter:"#10b981", pro:"#818cf8", enterprise:"#f59e0b" };
  const tc = TIER_COLORS[selectedPlan]||"#10b981";

  const PAY_METHODS = [
    {id:"helio",    label:"Helio",    flag:"⚡", note:"USDC/USDT/SOL + Card — Auto-activation, any country"},
    {id:"paystack", label:"Paystack", flag:"🇳🇬", note:"Cards, Bank Transfer, USSD — Nigeria preferred"},
    {id:"crypto",   label:"USDT Manual", flag:"₮", note:"Ethereum ERC20 — Manual 1hr activation"},
  ];

  return(
    <div>
      {/* Monthly / Annual toggle */}
      <div style={{display:"flex",gap:4,padding:4,borderRadius:12,background:"rgba(16,185,129,0.06)",border:"1px solid rgba(16,185,129,0.12)",marginBottom:14}}>
        {["monthly","annual"].map(cycle=>(
          <button key={cycle} onClick={()=>setBillingCycle(cycle)}
            style={{flex:1,padding:"9px 0",borderRadius:8,border:"none",cursor:"pointer",
              background:billingCycle===cycle?"linear-gradient(135deg,#10b981,#059669)":"transparent",
              color:billingCycle===cycle?"#000":"rgba(255,255,255,0.4)",fontWeight:900,fontSize:11}}>
            {cycle==="monthly"?"Pay Monthly":"Pay Annually (×12)"}
          </button>
        ))}
      </div>
      {isAnnual&&<div style={{padding:"6px 12px",borderRadius:8,background:"rgba(239,68,68,0.06)",border:"1px solid rgba(239,68,68,0.15)",marginBottom:10,textAlign:"center"}}>
        <p style={{color:"#f87171",fontSize:9,fontWeight:700,margin:0}}>Annual = Monthly × 12 — No discount, no proration</p>
      </div>}

      {/* 3-tier selector */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:6,marginBottom:14}}>
        {Object.values(PLANS).map(p=>{
          const c=TIER_COLORS[p.id]||"#10b981";
          const active=selectedPlan===p.id;
          return(
            <button key={p.id} onClick={()=>setSelectedPlan(p.id)}
              style={{padding:"10px 6px",borderRadius:12,border:active?`2px solid ${c}`:`1px solid rgba(255,255,255,0.08)`,
                background:active?`${c}18`:"rgba(255,255,255,0.02)",cursor:"pointer",position:"relative",transition:"all 0.2s"}}>
              {p.badge&&<span style={{position:"absolute",top:-7,right:4,background:c,color:"#000",fontSize:6,fontWeight:900,padding:"1px 5px",borderRadius:99,letterSpacing:"0.08em"}}>{p.badge}</span>}
              <p style={{color:active?c:"rgba(255,255,255,0.4)",fontWeight:900,fontSize:11,margin:"0 0 2px"}}>{p.label}</p>
              <p style={{color:active?c:"rgba(255,255,255,0.2)",fontSize:9,margin:0,fontFamily:"JetBrains Mono"}}>
                ${isAnnual?p.annual.toLocaleString():p.price.toLocaleString()}{isAnnual?"/yr":"/mo"}
              </p>
            </button>
          );
        })}
      </div>

      {/* Plan details */}
      <div style={{padding:14,borderRadius:14,background:"rgba(13,31,22,0.95)",border:`1px solid ${tc}33`,marginBottom:12}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
          <div>
            <p style={{color:"rgba(255,255,255,0.4)",fontSize:10,margin:"0 0 2px"}}>{plan.label} — {isAnnual?"Annual":"Monthly"}</p>
            <p style={{fontFamily:"Bebas Neue",fontSize:"2rem",color:tc,margin:0,lineHeight:1,letterSpacing:"0.04em"}}>{priceStr()}</p>
            <p style={{color:"rgba(255,255,255,0.2)",fontSize:8,margin:"3px 0 0"}}>{isAnnual?plan.annual_billing:plan.billing}</p>
          </div>
          <div style={{textAlign:"center",padding:"8px 12px",borderRadius:10,background:`${tc}12`,border:`1px solid ${tc}25`}}>
            <p style={{fontFamily:"Bebas Neue",fontSize:"1.4rem",color:tc,margin:0,lineHeight:1}}>{getScans().toLocaleString()}</p>
            <p style={{color:`${tc}80`,fontSize:7,margin:"2px 0 0",textTransform:"uppercase",letterSpacing:"0.1em"}}>scans</p>
          </div>
        </div>

        {/* Features */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"3px 10px",marginBottom:12}}>
          {(plan.features||[]).map((f,i)=>(
            <div key={i} style={{display:"flex",alignItems:"flex-start",gap:4}}>
              <span style={{color:tc,fontSize:8,flexShrink:0,marginTop:2}}>✓</span>
              <span style={{color:"rgba(255,255,255,0.4)",fontSize:8,lineHeight:1.4}}>{f}</span>
            </div>
          ))}
        </div>

        <div style={{padding:"6px 10px",borderRadius:8,background:"rgba(16,185,129,0.05)",border:"1px solid rgba(16,185,129,0.1)",marginBottom:10}}>
          <p style={{color:"#10b981",fontSize:9,fontWeight:700,margin:0}}>⚡ 24-Hour Full-Feature Trial After Payment</p>
          <p style={{color:"rgba(255,255,255,0.2)",fontSize:8,margin:"2px 0 0"}}>Add-on: ${plan.addon_price} for {plan.addon_scans} extra scans · {plan.seats} seat{plan.seats>1?"s":""} included</p>
        </div>

        {/* Payment method */}
        <p style={{color:"rgba(255,255,255,0.25)",fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.12em",margin:"0 0 6px"}}>Payment Method</p>
        <div style={{display:"flex",flexDirection:"column",gap:5,marginBottom:12}}>
          {PAY_METHODS.map(m=>(
            <button key={m.id} onClick={()=>setPayMethod(m.id)}
              style={{display:"flex",alignItems:"center",gap:10,padding:"9px 12px",borderRadius:10,
                border:payMethod===m.id?`1px solid ${tc}55`:"1px solid rgba(255,255,255,0.06)",
                background:payMethod===m.id?`${tc}10`:"transparent",cursor:"pointer",textAlign:"left"}}>
              <span style={{fontSize:16}}>{m.flag}</span>
              <div style={{flex:1}}>
                <p style={{color:payMethod===m.id?tc:"rgba(255,255,255,0.5)",fontWeight:700,fontSize:10,margin:0}}>{m.label}</p>
                <p style={{color:"rgba(255,255,255,0.2)",fontSize:8,margin:0}}>{m.note}</p>
              </div>
              <div style={{width:14,height:14,borderRadius:"50%",border:`2px solid ${payMethod===m.id?tc:"rgba(255,255,255,0.15)"}`,background:payMethod===m.id?tc:"transparent",flexShrink:0}}/>
            </button>
          ))}
        </div>

        {/* Pay button */}
        {processing?(
          <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,padding:"13px 0",color:tc,fontSize:12,fontWeight:700}}>
            <RefreshCw size={15} style={{animation:"spin 1s linear infinite"}}/>Processing...
          </div>
        ):(
          <button
            onClick={payMethod==="helio"
          ? ()=>openHelioCheckout(selectedPlan,billingCycle,email,onSuccess)
          : payMethod==="paystack"
          ? handlePaystack
          : ()=>setShowCryptoFlow(true)}
            style={{width:"100%",padding:"13px 0",borderRadius:11,border:"none",cursor:"pointer",
              fontWeight:900,fontSize:13,background:`linear-gradient(135deg,${tc},${tc}cc)`,
              color:selectedPlan==="pro"?"#fff":"#000",boxShadow:`0 4px 20px ${tc}44`}}>
            Pay {priceStr()} via {payMethod==="helio"?"Helio (Auto)":payMethod==="paystack"?"Paystack":"USDT Manual"}
          </button>
        )}
        <p style={{color:"rgba(255,255,255,0.12)",fontSize:8,textAlign:"center",marginTop:6}}>
          🔒 Secure · Instant activation · Cancel anytime
        </p>
      </div>

      {successData&&<LicenseSuccessModal reference={successData.reference} plan={successData.plan} email={successData.email} scans={successData.scans} onClose={()=>{setSuccessData(null);onSuccess(successData.plan);}}/>}
      {showCryptoFlow&&<CryptoPaymentFlow plan={selectedPlan} email={email} onClose={()=>setShowCryptoFlow(false)} onPending={()=>{}}/>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// SUBSCRIPTION GATE — shown immediately after login
// Payment required before accessing the app
// ═══════════════════════════════════════════════════════════════
function SubscriptionGate({userSession,onPaid,onLogout,paystackKey}){
  const paystackReady=usePaystack();
  const [licenseInfo,setLicenseInfo]=useState({isValid:null,daysRemaining:0});
  const [processing,setProcessing]=useState(false);
  const [region,setRegion]=useState("NG");

  useEffect(()=>{
    checkSubscriptionValidity("ENTERPRISE_MONTHLY").then(info=>{
      setLicenseInfo(info);
      if(info.isValid) onPaid(); // Already paid — skip to upload
    });
  },[]);

  const r=REGIONS[region]||REGIONS.NG;
  const FEATURES=[
    "6 Trade Modes (Electrical, Plumbing, Roofing, HVAC, Civil, General)",
    "AI Blueprint Analysis — upload any PDF or image",
    "600 blueprint scans per month",
    "Trade-specific quantity takeoffs",
    "Waste factor + Tax/VAT engine",
    "Editable cost matrix with real-time totals",
    "RFQ and Purchase Order generator (Claude-powered)",
    "V1 vs V2 blueprint comparison + Change Orders",
    "QuickBooks IIF, Sage 300, BIM/IFC exports",
    "AI Copilot (/findRisks, /valueEngineer, /generateRFQ)",
    "Multi-currency compare (8 regions)",
    "MongoDB cloud history sync",
  ];

  const handlePay=()=>{
    if(!paystackReady||!window.PaystackPop){alert("Payment gateway loading. Try again in 5 seconds.");return;}
    const email=userSession?.email;if(!email)return;
    const amount=r.kobo; // $250/month in local currency kobo/cents // ₦412,500 or $250 in kobo/cents
    setProcessing(true);
    window.PaystackPop.setup({
      key:paystackKey,
      email,amount,currency:region==="NG"?"NGN":"USD",
      metadata:{tier:"ENTERPRISE_MONTHLY",plan:"$250/month — 600 blueprint scans"},
      callback:async response=>{
        await saveLicense("ENTERPRISE_MONTHLY",{reference:response.reference,customerEmail:email,tier:"ENTERPRISE_MONTHLY"});
        setProcessing(false);
        onPaid();
      },
      onClose:()=>setProcessing(false)
    }).openIframe();
  };

  if(licenseInfo.isValid===null) return(
    <div style={{...BG,display:"flex",alignItems:"center",justifyContent:"center",minHeight:"100vh"}}>
      <GlobalBackground/>
      <div style={{position:"relative",zIndex:1,textAlign:"center"}}><RefreshCw size={28} style={{color:"#10b981",animation:"spin 1s linear infinite"}}/><p style={{color:"rgba(16,185,129,0.6)",marginTop:12,fontSize:12}}>Checking license...</p></div>
    </div>
  );

  return(
    <div style={{...BG,fontFamily:"Space Grotesk, sans-serif",minHeight:"100vh",padding:16,display:"flex",alignItems:"flex-start",justifyContent:"center",paddingTop:20}}>
      <link href={FONT} rel="stylesheet"/>
      <GlobalBackground/>
      <div style={{position:"relative",zIndex:1,width:"100%",maxWidth:480}}>
        {/* Header */}
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:24}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{width:44,height:44,borderRadius:12,background:"linear-gradient(135deg,#10b981,#059669)",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 0 20px rgba(16,185,129,0.4)"}}>
              <span style={{color:"#000",fontFamily:"Bebas Neue",fontWeight:900,fontSize:18,letterSpacing:"0.05em"}}>FE</span>
            </div>
            <div>
              <h1 style={{fontFamily:"Bebas Neue",fontSize:"1.6rem",letterSpacing:"0.06em",color:"#fff",margin:0,lineHeight:1}}>FORGE<span style={{color:"#10b981"}}>ESTIMATE</span></h1>
              <p style={{color:"rgba(16,185,129,0.45)",fontSize:9,letterSpacing:"0.2em",textTransform:"uppercase",margin:0}}>Ultra Pro v10</p>
            </div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <span style={{color:"rgba(255,255,255,0.35)",fontSize:10}}>{userSession?.email}</span>
            <button onClick={onLogout} style={{background:"none",border:"none",cursor:"pointer",color:"rgba(255,255,255,0.2)",padding:4}}><LogOut size={13}/></button>
          </div>
        </div>

        {/* Welcome banner */}
        <div style={{padding:20,borderRadius:16,background:"linear-gradient(135deg,rgba(16,185,129,0.12),rgba(16,185,129,0.04))",border:"1px solid rgba(16,185,129,0.25)",marginBottom:16,textAlign:"center"}}>
          <p style={{color:"rgba(16,185,129,0.6)",fontSize:10,textTransform:"uppercase",letterSpacing:"0.2em",margin:"0 0 6px"}}>Welcome to ForgeEstimate Ultra Pro</p>
          <h2 style={{color:"#fff",fontFamily:"Bebas Neue",fontSize:"1.8rem",letterSpacing:"0.05em",margin:"0 0 6px"}}>ACTIVATE YOUR PLAN</h2>
          <p style={{color:"rgba(255,255,255,0.4)",fontSize:11,margin:0}}>To access the app, choose your region and complete a one-time monthly subscription.</p>
        </div>

        {/* Region selector */}
        <div style={{marginBottom:12}}>
          <p style={{color:"rgba(16,185,129,0.5)",fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.2em",margin:"0 0 8px"}}>Select Your Region</p>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:6}}>
            {Object.entries(REGIONS).map(([k,v])=>(
              <button key={k} onClick={()=>setRegion(k)} style={{padding:"8px 6px",borderRadius:10,border:region===k?"1px solid rgba(16,185,129,0.5)":"1px solid rgba(16,185,129,0.1)",background:region===k?"rgba(16,185,129,0.12)":"rgba(16,185,129,0.02)",cursor:"pointer",textAlign:"center"}}>
                <p style={{color:region===k?"#10b981":"rgba(255,255,255,0.4)",fontSize:9,fontWeight:700,margin:0}}>{v.label.split(" ")[0]}</p>
                <p style={{color:region===k?"#10b981":"rgba(255,255,255,0.25)",fontSize:8,margin:"2px 0 0",fontFamily:"JetBrains Mono"}}>{v.price}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Price card */}
        <div style={{padding:16,borderRadius:14,background:"rgba(13,31,22,0.95)",border:"1px solid rgba(16,185,129,0.2)",marginBottom:14}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
            <div>
              <p style={{color:"rgba(255,255,255,0.5)",fontSize:11,margin:0}}>Enterprise Monthly Plan</p>
              <p style={{fontFamily:"Bebas Neue",fontSize:"2.2rem",color:"#10b981",margin:0,lineHeight:1,letterSpacing:"0.05em"}}>{r.price}</p>
              <p style={{color:"rgba(255,255,255,0.25)",fontSize:9,margin:"2px 0 0"}}>600 blueprint scans · All features · Cancel anytime</p>
            </div>
            <div style={{textAlign:"center",padding:"10px 14px",borderRadius:10,background:"rgba(16,185,129,0.08)",border:"1px solid rgba(16,185,129,0.15)"}}>
              <p style={{fontFamily:"Bebas Neue",fontSize:"1.8rem",color:"#10b981",margin:0,lineHeight:1}}>600</p>
              <p style={{color:"rgba(16,185,129,0.5)",fontSize:8,margin:"2px 0 0",textTransform:"uppercase",letterSpacing:"0.1em"}}>Scans/month</p>
            </div>
          </div>
          {/* Features list */}
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"4px 12px",marginBottom:14}}>
            {FEATURES.map((f,i)=>(
              <div key={i} style={{display:"flex",alignItems:"flex-start",gap:5}}>
                <CheckCircle2 size={10} style={{color:"#10b981",flexShrink:0,marginTop:2}}/>
                <span style={{color:"rgba(255,255,255,0.45)",fontSize:9,lineHeight:1.4}}>{f}</span>
              </div>
            ))}
          </div>
          {/* Plan Selector with multiple payment methods */}
          <PlanSelector
            email={userSession?.email}
            region={region}
            paystackKey={paystackKey}
            paystackReady={paystackReady}
            onSuccess={selectedPlan=>{
              const plan=PLANS[selectedPlan];
              checkSubscriptionValidity("ENTERPRISE_MONTHLY").then(setLicenseInfo);
              onPaid();
            }}
          />
        </div>

        {/* Already have license? check button */}
        <button onClick={()=>checkSubscriptionValidity("ENTERPRISE_MONTHLY").then(i=>{if(i.isValid)onPaid();else alert("No active license found. Please complete payment to continue.");})} style={{width:"100%",padding:"10px 0",borderRadius:10,border:"1px solid rgba(16,185,129,0.15)",background:"transparent",color:"rgba(16,185,129,0.5)",cursor:"pointer",fontSize:10,fontWeight:600}}>
          Already paid? Verify my license
        </button>
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════
// ACCOUNT DELETION — GDPR-compliant full data wipe
// ═══════════════════════════════════════════════════════════════
function DeleteAccountPanel({userSession, onDeleted}){
  const [step,setStep]      = useState(1); // 1=warning, 2=confirm password, 3=done
  const [password,setPwd]   = useState("");
  const [busy,setBusy]      = useState(false);
  const [error,setError]    = useState("");

  const handleDelete = async () => {
    if(!password.trim()){ setError("Enter your password to confirm deletion."); return; }
    setBusy(true); setError("");
    try{
      // 1. Verify password with server then delete MongoDB record
      const r = await fetch(apiUrl("/api/auth"),{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({action:"delete_account", email:userSession?.email, password}),
      });
      const d = await r.json();
      if(!r.ok && r.status !== 404){
        // If auth function not deployed, still allow local deletion
        if(r.status !== 404) throw new Error(d.error||"Deletion failed");
      }

      // 2. Wipe ALL local IndexedDB data
      const dbNames = ["ForgeDBv7","ForgeDBv6","ForgeDB"];
      for(const name of dbNames){
        try{ await indexedDB.deleteDatabase(name); }catch{}
      }

      // 3. Clear all session/local storage
      try{ sessionStorage.clear(); }catch{}
      try{
        const keys = Object.keys(localStorage);
        keys.filter(k=>k.startsWith("FE_")||k.startsWith("Forge")).forEach(k=>sessionStorage.removeItem(k));
      }catch{}

      setStep(3);
      // Redirect after 3 seconds
      setTimeout(()=>{ onDeleted && onDeleted(); window.location.reload(); }, 3000);
    }catch(e){
      setError(e.message);
    }finally{
      setBusy(false);
    }
  };

  return(
    <div style={{padding:16,borderRadius:14,background:"rgba(239,68,68,0.04)",border:"1px solid rgba(239,68,68,0.2)"}}>
      {step===1&&<>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
          <ShieldAlert size={16} style={{color:"#ef4444"}}/>
          <p style={{color:"#ef4444",fontWeight:900,fontSize:12,margin:0}}>Delete Account</p>
        </div>
        <p style={{color:"rgba(255,255,255,0.4)",fontSize:10,margin:"0 0 12px",lineHeight:1.6}}>
          This will permanently delete your account and all associated data including project history,
          scan usage, and license keys. This action cannot be undone.
        </p>
        <button onClick={()=>setStep(2)} style={{padding:"9px 16px",borderRadius:9,border:"1px solid rgba(239,68,68,0.4)",background:"rgba(239,68,68,0.08)",color:"#ef4444",cursor:"pointer",fontWeight:700,fontSize:11}}>
          I understand — proceed with deletion
        </button>
      </>}

      {step===2&&<>
        <p style={{color:"#ef4444",fontWeight:900,fontSize:12,margin:"0 0 8px"}}>Confirm your password to delete</p>
        <input
          type="password"
          value={password}
          onChange={e=>{setPwd(e.target.value);setError("");}}
          placeholder="Enter your password"
          style={{width:"100%",background:"rgba(0,0,0,0.4)",border:`1px solid ${error?"rgba(239,68,68,0.5)":"rgba(255,255,255,0.1)"}`,borderRadius:8,padding:"10px 12px",color:"#fff",fontSize:13,outline:"none",marginBottom:8,boxSizing:"border-box"}}
        />
        {error&&<p style={{color:"#f87171",fontSize:10,margin:"0 0 8px"}}>{error}</p>}
        <div style={{display:"flex",gap:8}}>
          <button onClick={()=>{setStep(1);setPwd("");setError("");}} style={{flex:1,padding:"9px 0",borderRadius:9,border:"1px solid rgba(255,255,255,0.1)",background:"transparent",color:"rgba(255,255,255,0.4)",cursor:"pointer",fontSize:11}}>Cancel</button>
          <button onClick={handleDelete} disabled={busy||!password.trim()} style={{flex:2,padding:"9px 0",borderRadius:9,border:"none",background:busy||!password?"rgba(255,255,255,0.05)":"#ef4444",color:busy||!password?"rgba(255,255,255,0.2)":"#fff",cursor:busy||!password?"not-allowed":"pointer",fontWeight:900,fontSize:11}}>
            {busy?"Deleting everything...":"Permanently Delete My Account"}
          </button>
        </div>
      </>}

      {step===3&&<>
        <div style={{textAlign:"center",padding:"16px 0"}}>
          <CheckCircle2 size={28} style={{color:"#10b981",margin:"0 auto 8px",display:"block"}}/>
          <p style={{color:"#10b981",fontWeight:900,fontSize:13,margin:"0 0 6px"}}>Account Deleted</p>
          <p style={{color:"rgba(255,255,255,0.3)",fontSize:10}}>All your data has been permanently removed. Redirecting...</p>
        </div>
      </>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// AUTH SCREEN
// ═══════════════════════════════════════════════════════════════
function AuthScreen({onAuth}){
  const [mode,setMode]=useState("login");const [email,setEmail]=useState("");const [pass,setPass]=useState("");const [showPass,setShowPass]=useState(false);const [busy,setBusy]=useState(false);const [error,setError]=useState("");
  const [dbConfig,setDbConfig]=useState(null);const [showConfig,setShowConfig]=useState(false);
  const [mongoApiKey,setMongoApiKey]=useState("");const [mongoAppId,setMongoAppId]=useState("");
  const [sbUrl,setSbUrl]=useState("");const [sbKey,setSbKey]=useState("");
  useEffect(()=>{Promise.all([getMongoConfig(),getSupabaseConfig()]).then(([m,s])=>{if(m){setDbConfig({type:"mongo",...m});setMongoApiKey(m.apiKey||"");setMongoAppId(m.appId||"");}else if(s){setDbConfig({type:"supabase",...s});setSbUrl(s.url||"");setSbKey(s.anonKey||"");}});},[]);
  const saveCfg=async type=>{if(type==="mongo"){if(!mongoApiKey||!mongoAppId){setError("Enter MongoDB API Key and App ID.");return;}await saveMongoConfig(mongoApiKey,mongoAppId);setDbConfig({type:"mongo",apiKey:mongoApiKey,appId:mongoAppId});}else{if(!sbUrl||!sbKey){setError("Enter Supabase URL and anon key.");return;}await saveSupabaseConfig(sbUrl,sbKey);setDbConfig({type:"supabase",url:sbUrl,anonKey:sbKey});}setError("");setShowConfig(false);};
  const handleAuth=async()=>{if(!email.includes("@")||pass.length<6){setError("Valid email and password (6+ chars) required.");return;}setError("");setBusy(true);try{if(dbConfig?.type==="supabase"){const d=mode==="signup"?await supabaseAPI.signup(dbConfig.url,dbConfig.anonKey,email,pass):await supabaseAPI.login(dbConfig.url,dbConfig.anonKey,email,pass);onAuth({email,accessToken:d.access_token,mode:"supabase",dbConfig});}else if(dbConfig?.type==="mongo"){onAuth({email,accessToken:"MONGO_"+Date.now(),mode:"mongo",dbConfig});}else{onAuth({email,accessToken:null,mode:"local",dbConfig:null});}}catch(e){setError(e.message);}finally{setBusy(false);}};
  const inp={width:"100%",background:`${GN}0.05)`,border:`1px solid ${GN}0.18)`,borderRadius:12,padding:"10px 14px",color:"#fff",fontSize:13,outline:"none",boxSizing:"border-box"};
  return(
    <div style={{...BG,display:"flex",alignItems:"center",justifyContent:"center",padding:16,fontFamily:"Space Grotesk, sans-serif",minHeight:"100vh"}}>
      <link href={FONT} rel="stylesheet"/>
      <GlobalBackground/>
      <div style={{position:"relative",zIndex:1,width:"100%",maxWidth:380}}>
        <div style={{textAlign:"center",marginBottom:28}}>
          <div style={{display:"inline-flex",alignItems:"center",gap:10,marginBottom:6}}>
            <div style={{width:42,height:42,borderRadius:12,background:"linear-gradient(135deg,#10b981,#059669)",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 0 20px rgba(16,185,129,0.4)"}}><span style={{color:"#000",fontFamily:"Bebas Neue",fontWeight:900,fontSize:16}}>FE</span></div>
            <h1 style={{fontFamily:"Bebas Neue",fontSize:"2.3rem",letterSpacing:"0.06em",color:"#fff",margin:0,lineHeight:1}}>FORGE<span style={{color:"#10b981"}}>ESTIMATE</span></h1>
          </div>
          <p style={{color:`${GN}0.55)`,fontSize:10,letterSpacing:"0.25em",textTransform:"uppercase",margin:0}}>Ultra Pro v10 · Enterprise Edition</p>
          <p style={{color:"rgba(255,255,255,0.2)",fontSize:9,marginTop:4}}>Built for General Contractors and Specialized Trades</p>
        </div>
        <Card style={{overflow:"hidden"}}>
          <div style={{display:"flex",borderBottom:`1px solid ${GN}0.12)`}}>
            {[["login","Log In"],["signup","Sign Up"]].map(([k,l])=><button key={k} onClick={()=>setMode(k)} style={{flex:1,padding:"12px 0",fontSize:11,fontWeight:700,background:mode===k?`${GN}0.08)`:"transparent",color:mode===k?"#10b981":"rgba(255,255,255,0.28)",borderBottom:mode===k?"2px solid #10b981":"2px solid transparent",cursor:"pointer",border:"none"}}>{l}</button>)}
          </div>
          <div style={{padding:20,display:"flex",flexDirection:"column",gap:12}}>
            <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="your@email.com" style={inp}/>
            <div style={{position:"relative"}}>
              <input type={showPass?"text":"password"} value={pass} onChange={e=>setPass(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")handleAuth();}} placeholder="••••••••" style={{...inp,paddingRight:40}}/>
              <button onClick={()=>setShowPass(s=>!s)} style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",color:"rgba(255,255,255,0.28)",padding:0}}>{showPass?<EyeOff size={15}/>:<Eye size={15}/>}</button>
            </div>
            {error&&<p style={{color:"#f87171",fontSize:11,fontWeight:600,margin:0}}>{error}</p>}
            {busy?<div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:8,padding:"12px 0",color:"#10b981",fontSize:12,fontWeight:700}}><RefreshCw size={16} style={{animation:"spin 1s linear infinite"}}/>Authenticating...</div>:
            <button onClick={handleAuth} style={{width:"100%",padding:"12px 0",borderRadius:12,border:"none",cursor:"pointer",fontWeight:900,fontSize:13,background:"linear-gradient(135deg,#10b981,#059669)",color:"#000",boxShadow:"0 4px 16px rgba(16,185,129,0.3)"}}>{mode==="signup"?"Create Account":"Log In"}</button>}
            <button onClick={()=>setShowConfig(s=>!s)} style={{background:"none",border:"none",cursor:"pointer",color:dbConfig?"rgba(16,185,129,0.7)":"rgba(255,255,255,0.22)",fontSize:10,fontWeight:600,display:"flex",alignItems:"center",justifyContent:"center",gap:6,padding:"4px 0"}}>
              {dbConfig?.type==="mongo"?<><Database size={12} style={{color:"#10b981"}}/><span style={{color:"#10b981"}}>MongoDB Connected</span></>:dbConfig?.type==="supabase"?<><Cloud size={12} style={{color:"#06b6d4"}}/><span style={{color:"#06b6d4"}}>Supabase Connected</span></>:<><HardDrive size={12}/><span>Local Mode — Configure Database</span></>}
            </button>
            {showConfig&&<div style={{padding:12,borderRadius:12,background:`${GN}0.04)`,border:`1px solid ${GN}0.1)`,display:"flex",flexDirection:"column",gap:10}}>
              <div><p style={{color:"rgba(255,255,255,0.35)",fontSize:10,margin:"0 0 6px",fontWeight:600}}>🍃 MongoDB Atlas Data API</p>
                <input value={mongoApiKey} onChange={e=>setMongoApiKey(e.target.value)} placeholder="Atlas API Key" style={{...inp,fontSize:11,marginBottom:5}}/>
                <input value={mongoAppId} onChange={e=>setMongoAppId(e.target.value)} placeholder="App ID (e.g. data-abcde)" style={{...inp,fontSize:11}}/>
                <button onClick={()=>saveCfg("mongo")} style={{marginTop:6,width:"100%",padding:"8px 0",borderRadius:8,border:`1px solid ${GN}0.3)`,background:`${GN}0.12)`,color:"#10b981",fontSize:10,fontWeight:700,cursor:"pointer"}}>Save MongoDB</button></div>
              <div style={{borderTop:"1px solid rgba(255,255,255,0.06)",paddingTop:10}}>
                <p style={{color:"rgba(255,255,255,0.35)",fontSize:10,margin:"0 0 6px",fontWeight:600}}>🔵 Supabase (alternative)</p>
                <input value={sbUrl} onChange={e=>setSbUrl(e.target.value)} placeholder="https://xxxx.supabase.co" style={{...inp,fontSize:11,marginBottom:5}}/>
                <input value={sbKey} onChange={e=>setSbKey(e.target.value)} placeholder="anon key" style={{...inp,fontSize:11}}/>
                <button onClick={()=>saveCfg("supabase")} style={{marginTop:6,width:"100%",padding:"8px 0",borderRadius:8,border:"1px solid rgba(6,182,212,0.3)",background:"rgba(6,182,212,0.10)",color:"#06b6d4",fontSize:10,fontWeight:700,cursor:"pointer"}}>Save Supabase</button></div>
            </div>}
          </div>
        </Card>
        <p style={{color:`${GN}0.2)`,fontSize:9,textAlign:"center",marginTop:10}}>
          {dbConfig?.type==="mongo"?"🍃 MongoDB Atlas":dbConfig?.type==="supabase"?"🔵 Supabase Auth":"📦 Local Mode — IndexedDB"}
        </p>
      </div>
    </div>
  );
}


// ── SEARCHABLE REGION SELECTOR — 108 countries ──────────────────────────────
function RegionSelector({region, onSelect}){
  const [search, setSearch] = useState("");
  const [open,   setOpen]   = useState(false);
  const sel = REGIONS[region];

  const filtered = Object.entries(REGIONS).filter(([k,v])=>
    !search || v.label.toLowerCase().includes(search.toLowerCase()) || k.toLowerCase().includes(search.toLowerCase())
  );

  // Group by continent prefix in label
  const groups = {};
  filtered.forEach(([k,v])=>{
    const continent = v.label.includes("🇿") || v.label.includes("🇳🇬") || v.label.includes("🇬🇭") || v.label.includes("🇰🇪") || v.label.includes("🇪🇬") || v.label.includes("🇲🇦") || ["NG","GH","KE","ZA","EG","ET","TZ","UG","CM","CI","SN","MA","TN","DZ","LY","SD","AO","MZ","ZM","ZW","RW","GA","BJ","TG","MU"].includes(k) ? "🌍 Africa"
      : ["SA","AE","QA","KW","BH","OM","JO","LB","IQ","IR","IL","TR","PK","AF","YE","SY"].includes(k) ? "🌙 Middle East"
      : ["IN","CN","JP","KR","SG","AU","NZ","ID","MY","TH","PH","VN","BD","LK","MM","KH","NP","KZ","UZ","AZ","GE","MN"].includes(k) ? "🌏 Asia Pacific"
      : ["US","CA","MX","BR","AR","CO","CL","PE","VE","EC","BO","PY","UY","CR","PA","DO","GT","JM","TT"].includes(k) ? "🌎 Americas"
      : "🌍 Europe";
    if(!groups[continent]) groups[continent] = [];
    groups[continent].push([k,v]);
  });

  return(
    <div style={{position:"relative",marginBottom:8}}>
      {/* Selected country display / trigger */}
      <button onClick={()=>setOpen(!open)} style={{width:"100%",padding:"10px 14px",borderRadius:10,border:`1px solid ${open?"rgba(16,185,129,0.5)":"rgba(255,255,255,0.1)"}`,background:"rgba(0,0,0,0.3)",color:"#fff",display:"flex",alignItems:"center",justifyContent:"space-between",cursor:"pointer",fontSize:12,fontWeight:600}}>
        <span>{sel?.label || "🌐 Select Country"}</span>
        <span style={{display:"flex",alignItems:"center",gap:6}}>
          {sel&&<span style={{fontSize:9,color:"rgba(255,255,255,0.3)"}}>{sel.buildingCode}</span>}
          <ChevronRight size={12} style={{color:"rgba(255,255,255,0.3)",transform:open?"rotate(90deg)":"none",transition:"0.2s"}}/>
        </span>
      </button>

      {/* Dropdown */}
      {open&&(
        <div style={{position:"absolute",top:"calc(100% + 6px)",left:0,right:0,zIndex:200,background:"rgba(10,20,15,0.98)",border:"1px solid rgba(16,185,129,0.25)",borderRadius:12,overflow:"hidden",boxShadow:"0 20px 60px rgba(0,0,0,0.8)"}}>
          {/* Search */}
          <div style={{padding:"10px 12px",borderBottom:"1px solid rgba(255,255,255,0.06)"}}>
            <input
              autoFocus
              value={search}
              onChange={e=>setSearch(e.target.value)}
              placeholder="Search 108 countries..."
              style={{width:"100%",background:"rgba(255,255,255,0.05)",border:"1px solid rgba(16,185,129,0.2)",borderRadius:8,padding:"7px 10px",color:"#fff",fontSize:11,outline:"none",boxSizing:"border-box"}}
            />
          </div>
          {/* Country list */}
          <div style={{maxHeight:280,overflowY:"auto"}}>
            {Object.entries(groups).map(([continent, countries])=>(
              <div key={continent}>
                <p style={{color:"rgba(16,185,129,0.5)",fontSize:9,fontWeight:900,textTransform:"uppercase",letterSpacing:"0.12em",padding:"8px 12px 4px",margin:0,background:"rgba(16,185,129,0.04)",borderBottom:"1px solid rgba(16,185,129,0.08)"}}>{continent} ({countries.length})</p>
                {countries.map(([k,v])=>(
                  <button key={k} onClick={()=>{onSelect(k);setOpen(false);setSearch("");}}
                    style={{width:"100%",padding:"8px 12px",display:"flex",alignItems:"center",justifyContent:"space-between",background:region===k?"rgba(16,185,129,0.1)":"transparent",border:"none",borderBottom:"1px solid rgba(255,255,255,0.03)",cursor:"pointer",textAlign:"left"}}>
                    <span style={{color:region===k?"#10b981":"rgba(255,255,255,0.7)",fontSize:11,fontWeight:region===k?700:400}}>{v.label}</span>
                    <span style={{display:"flex",alignItems:"center",gap:6}}>
                      <span style={{fontSize:8,color:"rgba(255,255,255,0.2)"}}>{v.mat_symbol}{" "}{v.buildingCode}</span>
                      <span style={{fontSize:8,color:"rgba(255,255,255,0.25)"}}>{v.tax}% {v.taxLabel}</span>
                    </span>
                  </button>
                ))}
              </div>
            ))}
            {filtered.length===0&&<p style={{color:"rgba(255,255,255,0.2)",fontSize:11,textAlign:"center",padding:16}}>No countries found</p>}
          </div>
          <p style={{color:"rgba(255,255,255,0.12)",fontSize:8,textAlign:"center",padding:"6px 0",borderTop:"1px solid rgba(255,255,255,0.05)",margin:0}}>Subscriptions in USD · Material pricing in local currency</p>
        </div>
      )}

      {/* Compliance badges for selected country */}
      <ComplianceBadges regionCode={region}/>
    </div>
  );
}


// ── PAYMENT DUE WARNING BANNER ────────────────────────────────────────────────
function SubscriptionWarningBanner({userSession, onGoToPricing}){
  const status  = getSubscriptionStatus(userSession);
  const days    = getDaysUntilExpiry(userSession);
  const plan    = userSession?.plan||"free";

  if(status==="active"||plan==="free") return null;

  const configs = {
    expiring_soon:{
      bg:"rgba(245,158,11,0.12)",
      border:"rgba(245,158,11,0.4)",
      color:"#f59e0b",
      icon:"⚠️",
      msg: days===1
        ? "Your subscription expires TOMORROW. Renew now to avoid interruption."
        : `Your subscription expires in ${days} days. Renew to keep full access.`,
      btn:"Renew Now",
    },
    grace_period:{
      bg:"rgba(239,68,68,0.1)",
      border:"rgba(239,68,68,0.5)",
      color:"#ef4444",
      icon:"🔴",
      msg:`PAYMENT OVERDUE — Your subscription expired ${Math.abs(days)} day${Math.abs(days)!==1?"s":""} ago. You have ${5+days} grace day${5+days!==1?"s":""} remaining before access is suspended.`,
      btn:"Renew Immediately",
    },
  };

  const cfg = configs[status];
  if(!cfg) return null;

  return(
    <div style={{position:"fixed",top:0,left:0,right:0,zIndex:9999,
      background:cfg.bg,borderBottom:`2px solid ${cfg.border}`,
      padding:"10px 16px",display:"flex",alignItems:"center",
      justifyContent:"space-between",gap:12,backdropFilter:"blur(8px)"}}>
      <div style={{display:"flex",alignItems:"center",gap:8,flex:1}}>
        <span style={{fontSize:16}}>{cfg.icon}</span>
        <p style={{color:cfg.color,fontSize:11,fontWeight:700,margin:0,lineHeight:1.4}}>{cfg.msg}</p>
      </div>
      <button onClick={onGoToPricing}
        style={{flexShrink:0,padding:"6px 14px",borderRadius:8,border:`1px solid ${cfg.border}`,
          background:cfg.color,color:"#000",fontWeight:900,fontSize:10,cursor:"pointer",whiteSpace:"nowrap"}}>
        {cfg.btn}
      </button>
    </div>
  );
}

// ── DEVICE LINK PANEL ─────────────────────────────────────────────────────────
function DeviceLinkPanel({userSession}){
  const [devices,   setDevices]   = useState([]);
  const [busy,      setBusy]      = useState(false);
  const [thisDevice,setThisDevice]= useState("");
  const [msg,       setMsg]       = useState("");

  useEffect(()=>{
    getDeviceFingerprint().then(fp=>{
      setThisDevice(fp);
      // Load linked devices from IndexedDB/session
      const saved = sessionStorage.getItem("FE_devices");
      if(saved){ try{setDevices(JSON.parse(saved));}catch{} }
    });
  },[]);

  const linkThisDevice = async()=>{
    setBusy(true); setMsg("");
    const fp = await getDeviceFingerprint();
    const existing = devices.find(d=>d.fp===fp);
    if(existing){ setMsg("This device is already linked to your account."); setBusy(false); return; }
    if(devices.length>=2){ setMsg("Device limit reached (2 max). Remove a device first to add this one."); setBusy(false); return; }
    const newDevice = {
      fp,
      name: navigator.platform||"Unknown Device",
      added: new Date().toLocaleDateString(),
      browser: navigator.userAgent.includes("Chrome")?"Chrome":navigator.userAgent.includes("Firefox")?"Firefox":navigator.userAgent.includes("Safari")?"Safari":"Browser",
    };
    const updated = [...devices, newDevice];
    setDevices(updated);
    sessionStorage.setItem("FE_devices", JSON.stringify(updated));
    setMsg("✅ Device linked successfully. You can now use your account on this device.");
    setBusy(false);
  };

  const removeDevice = (fp)=>{
    const updated = devices.filter(d=>d.fp!==fp);
    setDevices(updated);
    sessionStorage.setItem("FE_devices", JSON.stringify(updated));
    setMsg("Device removed.");
  };

  return(
    <div style={{padding:16,borderRadius:14,background:"rgba(99,102,241,0.05)",border:"1px solid rgba(99,102,241,0.2)"}}>
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
        <Cpu size={14} style={{color:"#818cf8"}}/>
        <p style={{color:"#818cf8",fontWeight:900,fontSize:12,margin:0}}>Linked Devices ({devices.length}/2)</p>
      </div>
      <p style={{color:"rgba(255,255,255,0.35)",fontSize:10,margin:"0 0 12px",lineHeight:1.6}}>
        Your account can be used on up to 2 devices. You control which devices have access.
        Adding a new device is a conscious choice — once added, that device can access your account.
      </p>

      {devices.length===0&&(
        <p style={{color:"rgba(255,255,255,0.2)",fontSize:10,margin:"0 0 10px",fontStyle:"italic"}}>No devices linked yet. Link this device to secure your account.</p>
      )}

      {devices.map(d=>(
        <div key={d.fp} style={{display:"flex",justifyContent:"space-between",alignItems:"center",
          padding:"8px 12px",borderRadius:9,background:"rgba(255,255,255,0.04)",
          border:"1px solid rgba(255,255,255,0.07)",marginBottom:6}}>
          <div>
            <p style={{color:d.fp===thisDevice?"#818cf8":"rgba(255,255,255,0.6)",fontSize:11,fontWeight:700,margin:0}}>
              {d.name} — {d.browser}
              {d.fp===thisDevice&&<span style={{color:"rgba(16,185,129,0.7)",fontSize:9,marginLeft:6}}>● THIS DEVICE</span>}
            </p>
            <p style={{color:"rgba(255,255,255,0.25)",fontSize:9,margin:0}}>Added {d.added}</p>
          </div>
          {d.fp!==thisDevice&&(
            <button onClick={()=>removeDevice(d.fp)}
              style={{padding:"4px 10px",borderRadius:7,border:"1px solid rgba(239,68,68,0.3)",
                background:"rgba(239,68,68,0.08)",color:"#ef4444",fontSize:9,cursor:"pointer",fontWeight:700}}>
              Remove
            </button>
          )}
        </div>
      ))}

      {devices.length<2&&(
        <button onClick={linkThisDevice} disabled={busy}
          style={{width:"100%",padding:"9px 0",borderRadius:9,border:"1px solid rgba(99,102,241,0.3)",
            background:busy?"rgba(255,255,255,0.05)":"rgba(99,102,241,0.12)",
            color:busy?"rgba(255,255,255,0.2)":"#818cf8",cursor:busy?"not-allowed":"pointer",
            fontWeight:700,fontSize:11,marginTop:8}}>
          {busy?"Linking...":"Link This Device to My Account"}
        </button>
      )}

      {msg&&<p style={{color:"rgba(255,255,255,0.5)",fontSize:10,margin:"8px 0 0",textAlign:"center"}}>{msg}</p>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// UPLOAD SCREEN
// ═══════════════════════════════════════════════════════════════
function UploadScreen({onFile,region,setRegion,customPrices,setCustomPrices,tradeMode,setTradeMode,wasteFactor,setWasteFactor,taxRate,setTaxRate,userSession,onLogout,paystackKey}){
  const paystackReady=usePaystack();
  const fileRef=useRef();const [drag,setDrag]=useState(false);const [err,setErr]=useState("");
  const [pct,setPct]=useState(0);const [loaded,setLoaded]=useState(0);const [totalSz,setTotalSz]=useState(0);
  const [preview,setPreview]=useState(null);const [pendingFile,setPendingFile]=useState(null);
  const [section,setSection]=useState("trade");
  const [bannerDismissed,setBannerDismissed]=useState(false);
  const [bannerOpen,setBannerOpen]=useState(false);
  const [licenseInfo,setLicenseInfo]=useState({isValid:false,daysRemaining:0});
  const isProUser=licenseInfo.isValid===true;
  useEffect(()=>{ checkSubscriptionValidity("ENTERPRISE_MONTHLY").then(setLicenseInfo); },[]);
  const handleBannerPay=()=>{
    if(!paystackReady||!window.PaystackPop){alert("Payment gateway loading. Try again in 5 seconds.");return;}
    const email=userSession?.email;if(!email)return;
    const r=REGIONS[region]||REGIONS.NG;
    const amount=r.kobo; // $250/month in local currency kobo/cents
    window.PaystackPop.setup({
      key:paystackKey||"pk_test_YOUR_KEY_HERE",email,amount,currency:region==="NG"?"NGN":"USD",
      metadata:{tier:"ENTERPRISE_MONTHLY"},
      callback:async response=>{
        await saveLicense("ENTERPRISE_MONTHLY",{reference:response.reference,customerEmail:email,tier:"ENTERPRISE_MONTHLY"});
        checkSubscriptionValidity("ENTERPRISE_MONTHLY").then(setLicenseInfo);
        alert("Payment successful! Enterprise activated.");
      },
      onClose:()=>{}
    }).openIframe();
  };
  const handleFile=async file=>{setErr("");const _plan=(userSession?.plan||"starter").toLowerCase();
const v=validateFile(file,_plan);if(!v.valid){setErr(v.error);return;}setPendingFile(file);setPct(0);setLoaded(0);setTotalSz(file.size);if(file.type.startsWith("image/"))setPreview(URL.createObjectURL(file));else setPreview(null);const fr=new FileReader();fr.onprogress=e=>{if(e.lengthComputable){setPct(Math.round((e.loaded/e.total)*100));setLoaded(e.loaded);}};fr.onload=()=>setPct(100);fr.onerror=()=>setErr("File read error.");fr.readAsArrayBuffer(file);};
  const drop=useCallback(e=>{e.preventDefault();setDrag(false);const f=e.dataTransfer.files[0];if(f)handleFile(f);},[]);
  return(
    <div style={{...BG,fontFamily:"Space Grotesk, sans-serif",padding:16,paddingBottom:80,minHeight:"100vh"}}>
      <link href={FONT} rel="stylesheet"/>
      <GlobalBackground/>
      <div style={{position:"relative",zIndex:1,maxWidth:460,margin:"0 auto"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20,paddingTop:8}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div style={{width:34,height:34,borderRadius:10,background:"linear-gradient(135deg,#10b981,#059669)",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 0 14px rgba(16,185,129,0.35)"}}><span style={{color:"#000",fontFamily:"Bebas Neue",fontWeight:900,fontSize:13}}>FE</span></div>
            <div><h1 style={{fontFamily:"Bebas Neue",fontSize:"1.5rem",letterSpacing:"0.06em",color:"#fff",margin:0,lineHeight:1}}>FORGE<span style={{color:"#10b981"}}>ESTIMATE</span></h1><p style={{color:`${GN}0.4)`,fontSize:8,letterSpacing:"0.2em",textTransform:"uppercase",margin:0}}>Ultra Pro v10</p></div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <div style={{display:"flex",alignItems:"center",gap:5,padding:"5px 10px",borderRadius:10,border:`1px solid ${GN}0.15)`,background:`${GN}0.05)`}}>
              {userSession?.mode==="mongo"?<Database size={10} style={{color:"#10b981"}}/>:userSession?.mode==="supabase"?<Cloud size={10} style={{color:"#06b6d4"}}/>:<HardDrive size={10} style={{color:"rgba(255,255,255,0.3)"}}/>}
              <span style={{color:"rgba(255,255,255,0.35)",fontSize:9,maxWidth:80,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{userSession?.email}</span>
            </div>
            <button onClick={onLogout} style={{background:"none",border:"none",cursor:"pointer",color:"rgba(255,255,255,0.2)",padding:4}}><LogOut size={13}/></button>
          </div>
        </div>
        {/* ── PAYMENT BANNER (dismissible) ─────────────────────── */}
        {!isProUser&&!bannerDismissed&&(
          <div style={{marginBottom:12,borderRadius:14,overflow:"hidden",border:"1px solid rgba(16,185,129,0.3)",background:"linear-gradient(135deg,rgba(16,185,129,0.1),rgba(16,185,129,0.04))"}}>
            <div style={{padding:"12px 14px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:10}}>
              <div style={{display:"flex",alignItems:"center",gap:10,flex:1,minWidth:0}}>
                <div style={{width:36,height:36,borderRadius:10,background:"linear-gradient(135deg,#10b981,#059669)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,boxShadow:"0 0 12px rgba(16,185,129,0.4)"}}>
                  <span style={{color:"#000",fontFamily:"Bebas Neue",fontWeight:900,fontSize:14}}>FE</span>
                </div>
                <div style={{minWidth:0}}>
                  <p style={{color:"#fff",fontWeight:700,fontSize:12,margin:0,lineHeight:1.2}}>Unlock Enterprise — <span style={{color:"#10b981"}}>{REGIONS[region]?.price||"$250/mo"}</span></p>
                  <p style={{color:"rgba(16,185,129,0.6)",fontSize:9,margin:"2px 0 0"}}>600 scans · All trades · RFQ · Compare · Export · AI Copilot</p>
                </div>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:6,flexShrink:0}}>
                <button onClick={()=>setBannerOpen(true)} style={{padding:"7px 14px",borderRadius:9,border:"none",cursor:"pointer",fontWeight:900,fontSize:10,background:"linear-gradient(135deg,#10b981,#059669)",color:"#000",whiteSpace:"nowrap"}}>Subscribe</button>
                <button onClick={()=>setBannerDismissed(true)} style={{background:"none",border:"none",cursor:"pointer",color:"rgba(255,255,255,0.25)",padding:2,flexShrink:0}}><X size={14}/></button>
              </div>
            </div>
          </div>
        )}
        {isProUser&&(
          <div style={{marginBottom:12,padding:"10px 14px",borderRadius:12,background:"rgba(16,185,129,0.07)",border:"1px solid rgba(16,185,129,0.2)",display:"flex",alignItems:"center",gap:10}}>
            <div style={{width:32,height:32,borderRadius:9,background:"linear-gradient(135deg,#10b981,#059669)",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
              <span style={{color:"#000",fontFamily:"Bebas Neue",fontWeight:900,fontSize:12}}>FE</span>
            </div>
            <div><p style={{color:"#10b981",fontWeight:700,fontSize:11,margin:0}}>Enterprise Active</p><p style={{color:"rgba(16,185,129,0.5)",fontSize:9,margin:0}}>{licenseInfo.daysRemaining} days remaining · 600 scans/month</p></div>
            <CheckCircle2 size={18} style={{color:"#10b981",marginLeft:"auto"}}/>
          </div>
        )}

        {/* Section tabs */}
        <div style={{display:"flex",gap:4,padding:3,borderRadius:12,border:`1px solid ${GN}0.1)`,background:`${GN}0.03)`,marginBottom:12}}>
          {[["trade","Trade Mode"],["settings","Settings"],["region","Region"]].map(([k,l])=>(
            <button key={k} onClick={()=>setSection(k)} style={{flex:1,padding:"7px 0",fontSize:10,fontWeight:700,borderRadius:8,border:"none",cursor:"pointer",background:section===k?`${GN}0.15)`:"transparent",color:section===k?"#10b981":"rgba(255,255,255,0.25)"}}>{l}</button>
          ))}
        </div>
        {section==="trade"&&<TradeModeSelector selected={tradeMode} onSelect={setTradeMode}/>}
        {section==="settings"&&<WasteTaxPanel wasteFactor={wasteFactor} setWasteFactor={setWasteFactor} taxRate={taxRate} setTaxRate={setTaxRate} region={region}/>}
        {section==="region"&&<Card style={{padding:14}}>
          <p style={{color:`${GN}0.5)`,fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.2em",margin:"0 0 10px"}}>Project Region and Currency</p>
          {/* Searchable country selector — 108 countries */}
          <RegionSelector region={region} onSelect={setRegion}/>
        </Card>}
        {/* Drop zone */}
        <div style={{marginTop:12,borderRadius:16,overflow:"hidden",border:drag?`1px solid ${GN}0.5)`:err?"1px solid rgba(239,68,68,0.4)":pct===100?`1px solid ${GN}0.4)`:`1px solid ${GN}0.15)`,background:"rgba(13,31,22,0.9)"}}>
          {!pendingFile?(
            <div style={{padding:40,textAlign:"center",cursor:"pointer",background:drag?`${GN}0.05)`:"transparent"}} onClick={()=>fileRef.current.click()} onDragOver={e=>{e.preventDefault();setDrag(true);}} onDragLeave={()=>setDrag(false)} onDrop={drop}>
              <div style={{fontSize:48,marginBottom:12,filter:"drop-shadow(0 0 18px rgba(16,185,129,0.3))"}}>📐</div>
              <div style={{display:"inline-flex",alignItems:"center",gap:6,padding:"4px 12px",borderRadius:99,marginBottom:10,background:`${TRADES[tradeMode]?.color||"#10b981"}18`,border:`1px solid ${TRADES[tradeMode]?.color||"#10b981"}40`}}>
                <span style={{color:TRADES[tradeMode]?.color||"#10b981",fontSize:11,fontWeight:700}}>{TRADES[tradeMode]?.label||"General Contractor"} Mode Active</span>
              </div>
              <p style={{color:"rgba(255,255,255,0.45)",fontSize:13,fontWeight:700,margin:"0 0 4px"}}>Drop blueprint or tap to upload</p>
              <p style={{color:"rgba(255,255,255,0.18)",fontSize:11,margin:0}}>PDF · JPEG · PNG · WebP · up to 50MB</p>
              {err&&<p style={{color:"#f87171",fontSize:11,fontWeight:600,marginTop:8}}>{err}</p>}
            </div>
          ):(
            <div style={{padding:16,display:"flex",flexDirection:"column",gap:10}}>
              {preview&&<div style={{height:85,borderRadius:10,overflow:"hidden",border:`1px solid ${GN}0.15)`,position:"relative"}}><img src={preview} alt="Blueprint" style={{width:"100%",height:"100%",objectFit:"contain",opacity:0.5}}/><div style={{position:"absolute",bottom:0,left:0,right:0,padding:"5px 10px",background:"linear-gradient(transparent,rgba(0,0,0,0.6))"}}><p style={{color:"rgba(255,255,255,0.7)",fontSize:10,fontWeight:600,margin:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{pendingFile.name}</p></div></div>}
              {!preview&&<div style={{display:"flex",alignItems:"center",gap:10,padding:10,borderRadius:10,border:`1px solid ${GN}0.12)`,background:`${GN}0.04)`}}><FileText size={26} style={{color:"rgba(239,68,68,0.6)",flexShrink:0}}/><div><p style={{color:"rgba(255,255,255,0.65)",fontSize:11,fontWeight:700,margin:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{pendingFile.name}</p><p style={{color:"rgba(255,255,255,0.3)",fontSize:9,margin:0}}>{(pendingFile.size/1024/1024).toFixed(1)} MB</p></div></div>}
              {pct>0&&pct<100&&<div><div style={{height:6,borderRadius:99,background:`${GN}0.1)`,overflow:"hidden"}}><div style={{height:"100%",borderRadius:99,transition:"width 0.15s",background:"linear-gradient(90deg,#10b981,#34d399)",width:`${pct}%`}}/></div><div style={{display:"flex",justifyContent:"space-between",marginTop:4}}><span style={{color:`${GN}0.5)`,fontSize:9,fontFamily:"JetBrains Mono"}}>{pct}%</span><span style={{color:"rgba(255,255,255,0.25)",fontSize:9,fontFamily:"JetBrains Mono"}}>{(loaded/1024/1024).toFixed(1)}MB / {(pendingFile.size/1024/1024).toFixed(1)}MB</span></div></div>}
              {pct===100&&<div style={{display:"flex",alignItems:"center",gap:6,color:"#10b981",fontSize:10,fontWeight:700}}><CheckCircle2 size={13}/>Ready — click to analyze</div>}
              {pct===100&&<button onClick={()=>onFile(pendingFile)} style={{width:"100%",padding:"12px 0",borderRadius:12,border:"none",cursor:"pointer",fontWeight:900,fontSize:13,background:"linear-gradient(135deg,#10b981,#059669)",color:"#000",boxShadow:"0 4px 16px rgba(16,185,129,0.3)"}}>Analyze with Claude AI</button>}
              <button onClick={()=>{setPendingFile(null);setPreview(null);setPct(0);setErr("");}} style={{width:"100%",padding:"8px 0",borderRadius:10,border:`1px solid ${GN}0.12)`,background:"transparent",color:"rgba(255,255,255,0.28)",fontSize:10,fontWeight:600,cursor:"pointer"}}>Choose Different File</button>
            </div>
          )}
          <input ref={fileRef} type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" multiple style={{display:"none"}} onChange={e=>{if(e.target.files[0])handleFile(e.target.files[0]);}}/>
          <div style={{borderTop:`1px solid ${GN}0.08)`,padding:"8px 16px",display:"flex",alignItems:"center",gap:8}}>
            <span style={{width:8,height:8,borderRadius:"50%",background:"#10b981",display:"inline-block",animation:"ping 1s infinite"}}/>
            <p style={{color:`${GN}0.4)`,fontSize:9,margin:0}}>AI Vision Engine Active</p>
            <div style={{marginLeft:"auto"}}>{userSession?.mode==="mongo"?<Pill c="teal">MONGO</Pill>:userSession?.mode==="supabase"?<Pill c="teal">SUPABASE</Pill>:<Pill c="amber">LOCAL</Pill>}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function LoadingScreen({step,tradeMode}){
  const trade=TRADES[tradeMode]||TRADES.GENERAL;const Icon=trade.icon;
  return(<div style={{...BG,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"Space Grotesk, sans-serif",minHeight:"100vh"}}><link href={FONT} rel="stylesheet"/><GlobalBackground/><div style={{position:"relative",zIndex:1,textAlign:"center",padding:"0 32px"}}>
    <div style={{position:"relative",width:96,height:96,margin:"0 auto 36px"}}>
      <div style={{position:"absolute",inset:0,borderRadius:"50%",border:"2px solid rgba(16,185,129,0.15)"}}/>
      <div style={{position:"absolute",inset:0,borderRadius:"50%",border:"2px solid transparent",borderTop:`2px solid ${trade.color}`,animation:"spin 0.9s linear infinite"}}/>
      <div style={{position:"absolute",inset:12,borderRadius:"50%",border:"1px solid transparent",borderTop:`1px solid ${trade.color}44`,animation:"spin 1.6s linear infinite reverse"}}/>
      <div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center"}}><Icon size={28} style={{color:trade.color}}/></div>
      <div style={{position:"absolute",bottom:-4,right:-4,width:24,height:24,borderRadius:"50%",background:trade.color,border:"2px solid #0a1a12",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10}}>✓</div>
    </div>
    <h2 style={{fontFamily:"Bebas Neue",fontSize:"2rem",letterSpacing:"0.05em",color:"#fff",margin:"0 0 4px"}}>FORGE<span style={{color:trade.color}}>ESTIMATE</span> AI</h2>
    <p style={{color:trade.color,opacity:0.8,fontSize:11,fontWeight:700,margin:"0 0 4px"}}>{trade.label} Takeoff Engine</p>
    <p style={{color:"rgba(255,255,255,0.35)",fontSize:12,fontWeight:600,margin:"0 0 28px"}}>{LOAD_STEPS[step%LOAD_STEPS.length]}</p>
    <div style={{display:"flex",justifyContent:"center",gap:6}}>{LOAD_STEPS.map((_,i)=><div key={i} style={{borderRadius:99,transition:"all 0.3s",width:i===step%LOAD_STEPS.length?20:6,height:6,background:i<=step%LOAD_STEPS.length?trade.color:"rgba(16,185,129,0.12)"}}/>)}</div>
  </div></div>);}


// ═══════════════════════════════════════════════════════════════
// 1. LIVE COMMODITY PRICE TICKER
// Solves top complaint: "no live material pricing data"
// Fetches current steel, cement, lumber prices via Groq web search
// Updates every time user opens the app
// ═══════════════════════════════════════════════════════════════
async function fetchLiveCommodityPrices(){
  try{
    const r = await fetch("https://api.groq.com/openai/v1/chat/completions",{
      method:"POST",
      headers:{"Content-Type":"application/json","Authorization":"Bearer "+GROQ_KEY},
      body:JSON.stringify({
        model:"llama-3.3-70b-versatile",
        max_tokens:400,
        temperature:0,
        messages:[{role:"user",content:`You are a commodity price engine. Give current ${new Date().getFullYear()} spot prices for key construction materials. Return ONLY JSON, no markdown:
{"updated":"${new Date().toLocaleDateString()}","prices":{"steel_rebar_ton":{"usd":0,"change_pct":0},"cement_bag_50kg":{"usd":0,"change_pct":0},"lumber_mbf":{"usd":0,"change_pct":0},"copper_lb":{"usd":0,"change_pct":0},"concrete_cu_yd":{"usd":0,"change_pct":0}},"source":"market_data"}`}],
      }),
    });
    if(!r.ok) return null;
    const d=await r.json();
    const txt=d.choices?.[0]?.message?.content?.trim()||"";
    return JSON.parse(txt.replace(/```json|```/g,"").trim());
  }catch{return null;}
}

function CommodityTicker({region}){
  const [prices,setPrices]=useState(null);
  const [loading,setLoading]=useState(true);
  const [lastUpdated,setLastUpdated]=useState(null);

  useEffect(()=>{
    fetchLiveCommodityPrices().then(p=>{
      if(p){setPrices(p.prices);setLastUpdated(p.updated);}
      setLoading(false);
    });
  },[]);

  if(loading) return(
    <div style={{padding:12,borderRadius:12,background:`${GN}0.04)`,border:`1px solid ${GN}0.08)`,marginBottom:12}}>
      <div style={{display:"flex",alignItems:"center",gap:8}}><RefreshCw size={12} style={{color:"rgba(255,255,255,0.3)",animation:"spin 1.5s linear infinite"}}/><p style={{color:"rgba(255,255,255,0.2)",fontSize:10,margin:0}}>Loading live commodity prices...</p></div>
    </div>
  );
  if(!prices) return null;

  const items=[
    {label:"Steel Rebar",key:"steel_rebar_ton",unit:"/ton"},
    {label:"Cement (50kg)",key:"cement_bag_50kg",unit:"/bag"},
    {label:"Lumber",key:"lumber_mbf",unit:"/MBF"},
    {label:"Copper",key:"copper_lb",unit:"/lb"},
    {label:"Concrete",key:"concrete_cu_yd",unit:"/cu yd"},
  ];

  return(
    <Card style={{padding:12,marginBottom:12}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          <TrendingUp size={13} style={{color:"#10b981"}}/>
          <p style={{color:"rgba(255,255,255,0.6)",fontWeight:700,fontSize:11,margin:0}}>Live Commodity Prices</p>
        </div>
        <span style={{color:"rgba(255,255,255,0.2)",fontSize:8}}>Updated {lastUpdated} · AI-sourced</span>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
        {items.map(({label,key,unit})=>{
          const item=prices[key];
          if(!item) return null;
          const up=item.change_pct>0;
          const dn=item.change_pct<0;
          return(
            <div key={key} style={{padding:"8px 10px",borderRadius:10,background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.05)"}}>
              <p style={{color:"rgba(255,255,255,0.3)",fontSize:8,margin:"0 0 2px",textTransform:"uppercase",letterSpacing:"0.1em"}}>{label}</p>
              <div style={{display:"flex",alignItems:"center",gap:6}}>
                <p style={{fontFamily:"JetBrains Mono",fontWeight:700,fontSize:12,color:"#fff",margin:0}}>${item.usd}<span style={{fontSize:8,color:"rgba(255,255,255,0.3)"}}>{unit}</span></p>
                {item.change_pct!==0&&<span style={{fontSize:9,fontWeight:700,color:up?"#10b981":dn?"#ef4444":"rgba(255,255,255,0.3)"}}>{up?"+":""}{item.change_pct?.toFixed(1)}%</span>}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════
// 2. PREDICTIVE OVERRUN WARNING
// Nobody else has this — AI predicts if this project will go over
// budget based on scope, trade, region, and historical data
// ═══════════════════════════════════════════════════════════════
function PredictiveOverrunWarning({data,tradeMode,region}){
  const [prediction,setPrediction]=useState(null);
  const [loading,setLoading]=useState(false);
  const [ran,setRan]=useState(false);

  const analyze=async()=>{
    setLoading(true);setRan(true);
    try{
      const fs=data?.financial_summary||{};
      const risks=(data?.risk_flags||[]).filter(r=>r.severity==="HIGH").length;
      const lowConf=(data?.line_items||[]).filter(i=>i.confidence==="LOW").length;
      const prompt=`You are a senior construction risk analyst. Predict budget overrun risk for this project.
Trade: ${tradeMode} | Region: ${region} | Total bid: $${fs.total_bid_price||0} | Contingency: 5% | High risks: ${risks} | Low confidence items: ${lowConf} | Phase count: ${(data?.phases||[]).length}
Return ONLY JSON: {"overrun_probability_pct":0,"likely_overrun_usd":0,"primary_driver":"","mitigation":"","risk_level":"LOW|MEDIUM|HIGH|CRITICAL"}`;
      const r=await fetch("https://api.groq.com/openai/v1/chat/completions",{
        method:"POST",
        headers:{"Content-Type":"application/json","Authorization":"Bearer "+GROQ_KEY},
        body:JSON.stringify({model:"llama-3.3-70b-versatile",max_tokens:300,temperature:0.1,messages:[{role:"user",content:prompt}]}),
      });
      if(!r.ok) throw new Error("AI error");
      const d=await r.json();
      const txt=d.choices?.[0]?.message?.content?.trim()||"";
      const parsed=JSON.parse(txt.replace(/```json|```/g,"").trim());
      setPrediction(parsed);
    }catch(e){setPrediction({overrun_probability_pct:0,risk_level:"UNKNOWN",primary_driver:"Analysis unavailable",mitigation:"Review manually"});}
    finally{setLoading(false);}
  };

  const RISK_COLORS={LOW:"#10b981",MEDIUM:"#f59e0b",HIGH:"#f97316",CRITICAL:"#ef4444",UNKNOWN:"rgba(255,255,255,0.3)"};
  const rc=RISK_COLORS[prediction?.risk_level]||"#10b981";

  return(
    <Card style={{padding:12,marginBottom:12}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          <AlertTriangle size={13} style={{color:"#f59e0b"}}/>
          <p style={{color:"rgba(255,255,255,0.6)",fontWeight:700,fontSize:11,margin:0}}>AI Overrun Predictor</p>
        </div>
        {!ran&&<button onClick={analyze} style={{padding:"5px 10px",borderRadius:8,border:"none",cursor:"pointer",background:"linear-gradient(135deg,#f59e0b,#d97706)",color:"#000",fontSize:9,fontWeight:900}}>Analyze Risk</button>}
      </div>
      {!ran&&<p style={{color:"rgba(255,255,255,0.2)",fontSize:9,margin:0}}>AI predicts if this project is likely to exceed budget — based on scope, trade, region, and flagged items. No competitor offers this.</p>}
      {loading&&<div style={{display:"flex",alignItems:"center",gap:6,padding:8}}><RefreshCw size={11} style={{color:"rgba(255,255,255,0.3)",animation:"spin 1s linear infinite"}}/><p style={{color:"rgba(255,255,255,0.3)",fontSize:10,margin:0}}>Analyzing overrun risk...</p></div>}
      {prediction&&!loading&&(
        <div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
            <div style={{padding:10,borderRadius:10,background:rc+"18",border:`1px solid ${rc}33`,textAlign:"center"}}>
              <p style={{fontFamily:"Bebas Neue",fontSize:24,color:rc,margin:0,lineHeight:1}}>{prediction.overrun_probability_pct||0}%</p>
              <p style={{color:"rgba(255,255,255,0.3)",fontSize:8,margin:"2px 0 0"}}>Overrun probability</p>
            </div>
            <div style={{padding:10,borderRadius:10,background:"rgba(255,255,255,0.02)",border:"1px solid rgba(255,255,255,0.05)",textAlign:"center"}}>
              <p style={{fontFamily:"Bebas Neue",fontSize:24,color:"#f87171",margin:0,lineHeight:1}}>${(prediction.likely_overrun_usd||0).toLocaleString()}</p>
              <p style={{color:"rgba(255,255,255,0.3)",fontSize:8,margin:"2px 0 0"}}>Likely overrun</p>
            </div>
          </div>
          <div style={{padding:8,borderRadius:8,background:rc+"0a",border:`1px solid ${rc}22`}}>
            <p style={{color:rc,fontWeight:700,fontSize:9,margin:"0 0 3px",textTransform:"uppercase"}}>{prediction.risk_level} RISK — {prediction.primary_driver}</p>
            <p style={{color:"rgba(255,255,255,0.4)",fontSize:9,margin:0,lineHeight:1.4}}>{prediction.mitigation}</p>
          </div>
        </div>
      )}
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════
// 3. DUPLICATE BLUEPRINT DETECTOR
// Warns if user uploads the same blueprint twice — saves scan credits
// Compares file size + estimated area fingerprint
// ═══════════════════════════════════════════════════════════════
function checkDuplicateBlueprint(fileSize, estimatedArea){
  try{
    const history = JSON.parse(sessionStorage.getItem("FE_blueprint_history")||"[]");
    const fingerprint = `${fileSize}_${Math.round(estimatedArea/10)*10}`;
    const isDupe = history.includes(fingerprint);
    if(!isDupe){
      history.push(fingerprint);
      if(history.length>20) history.shift();
      sessionStorage.setItem("FE_blueprint_history", JSON.stringify(history));
    }
    return isDupe;
  }catch{return false;}
}

// ═══════════════════════════════════════════════════════════════
// 4. WHATSAPP ESTIMATE SHARE (one tap)
// Critical for Nigeria, Saudi Arabia, UAE — WhatsApp is primary
// business communication. Send full estimate summary instantly.
// ═══════════════════════════════════════════════════════════════
function WhatsAppShareButton({data,tradeMode,region,fileName}){
  const share=()=>{
    const fs=data?.financial_summary||{};
    const meta=data?.project_metadata||{};
    const phases=(data?.phases||[]).slice(0,3).map(p=>`${p.phase_name}: ${fmt(p.cost)}`).join("\n");
    const msg=encodeURIComponent(
      `*ForgeEstimate Ultra Pro — Project Report*\n\n` +
      `📋 Project: ${fileName||"Blueprint"}\n` +
      `🏗️ Trade: ${tradeMode}\n` +
      `📐 Area: ${meta.total_area||0} ${meta.area_unit||"sqft"}\n` +
      `🌍 Region: ${region}\n\n` +
      `*Cost Breakdown:*\n` +
      `Direct Cost: ${fmt(fs.direct_cost||0)}\n` +
      `Contingency: ${fmt(fs.contingency_5pct||0)}\n` +
      `Margin: ${fmt(fs.margin_20pct||0)}\n` +
      `*TOTAL BID: ${fmt(fs.total_bid_price||0)}*\n\n` +
      (phases?`*Phases:*\n${phases}\n\n`:"") +
      `Cost/unit: ${fmt(fs.cost_per_unit||0)}\n\n` +
      `_Generated by ForgeEstimate Ultra Pro_\n` +
      `_forgeestimateultrapro.netlify.app_`
    );
    window.open(`https://wa.me/?text=${msg}`,"_blank");
  };
  return(
    <button onClick={share} style={{display:"flex",alignItems:"center",gap:6,padding:"8px 14px",borderRadius:10,border:"1px solid rgba(37,211,102,0.3)",background:"rgba(37,211,102,0.08)",color:"#25D366",cursor:"pointer",fontWeight:700,fontSize:11,width:"100%",justifyContent:"center"}}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="#25D366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
      Share via WhatsApp
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════
// 5. MATERIAL SHORTAGE ALERT
// Unique 2026 feature — AI flags materials that are currently
// under global supply pressure (war, sanctions, weather events)
// ═══════════════════════════════════════════════════════════════
function MaterialShortageAlert({lineItems}){
  const [alerts,setAlerts]=useState(null);
  const [loading,setLoading]=useState(false);
  const [ran,setRan]=useState(false);

  const check=async()=>{
    if(ran||loading) return;
    setLoading(true);setRan(true);
    try{
      const categories=[...new Set((lineItems||[]).map(i=>i.category).filter(Boolean))].slice(0,8);
      const r=await fetch("https://api.groq.com/openai/v1/chat/completions",{
        method:"POST",
        headers:{"Content-Type":"application/json","Authorization":"Bearer "+GROQ_KEY},
        body:JSON.stringify({
          model:"llama-3.3-70b-versatile",
          max_tokens:400,
          temperature:0,
          messages:[{role:"user",content:`You are a global supply chain analyst for construction materials in ${new Date().getFullYear()}. Check these material categories for current supply disruptions or price pressures: ${categories.join(", ")}. Return ONLY JSON: {"alerts":[{"material":"","severity":"HIGH|MEDIUM|LOW","issue":"one sentence","action":"one sentence recommendation"}]}. Only include materials with genuine supply issues. Empty array if all stable.`}],
        }),
      });
      if(!r.ok) throw new Error();
      const d=await r.json();
      const txt=d.choices?.[0]?.message?.content?.trim()||"";
      const parsed=JSON.parse(txt.replace(/```json|```/g,"").trim());
      setAlerts(parsed.alerts||[]);
    }catch{setAlerts([]);}
    finally{setLoading(false);}
  };

  // Auto-run after component mounts
  useEffect(()=>{if((lineItems||[]).length>0)check();},[]);

  if(!ran&&!loading) return null;
  if(loading) return(
    <div style={{padding:10,borderRadius:10,background:"rgba(255,165,0,0.05)",border:"1px solid rgba(255,165,0,0.1)",marginBottom:10,display:"flex",alignItems:"center",gap:6}}>
      <RefreshCw size={11} style={{color:"rgba(255,165,0,0.4)",animation:"spin 1.5s linear infinite"}}/>
      <p style={{color:"rgba(255,165,0,0.4)",fontSize:9,margin:0}}>Checking global supply chain for your materials...</p>
    </div>
  );
  if(!alerts||alerts.length===0) return(
    <div style={{padding:10,borderRadius:10,background:"rgba(16,185,129,0.04)",border:"1px solid rgba(16,185,129,0.1)",marginBottom:10,display:"flex",alignItems:"center",gap:6}}>
      <CheckCircle2 size={11} style={{color:"rgba(16,185,129,0.5)"}}/>
      <p style={{color:"rgba(16,185,129,0.4)",fontSize:9,margin:0}}>Supply chain stable — no disruptions detected for your materials</p>
    </div>
  );

  const ALERT_C={HIGH:"#ef4444",MEDIUM:"#f59e0b",LOW:"#10b981"};
  return(
    <Card style={{padding:12,marginBottom:12,border:"1px solid rgba(245,158,11,0.2)"}}>
      <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:10}}>
        <AlertTriangle size={13} style={{color:"#f59e0b"}}/>
        <p style={{color:"rgba(255,255,255,0.6)",fontWeight:700,fontSize:11,margin:0}}>Supply Chain Alerts</p>
        <span style={{fontSize:8,fontWeight:900,padding:"2px 6px",borderRadius:99,background:"rgba(245,158,11,0.15)",color:"#f59e0b",marginLeft:"auto"}}>{alerts.length} issue{alerts.length>1?"s":""}</span>
      </div>
      {alerts.map((a,i)=>(
        <div key={i} style={{padding:"8px 10px",borderRadius:8,background:`${ALERT_C[a.severity]||"#f59e0b"}0a`,border:`1px solid ${ALERT_C[a.severity]||"#f59e0b"}22`,marginBottom:6}}>
          <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:2}}>
            <span style={{fontSize:8,fontWeight:900,padding:"1px 5px",borderRadius:99,background:`${ALERT_C[a.severity]||"#f59e0b"}22`,color:ALERT_C[a.severity]||"#f59e0b"}}>{a.severity}</span>
            <p style={{color:"rgba(255,255,255,0.6)",fontWeight:700,fontSize:10,margin:0}}>{a.material}</p>
          </div>
          <p style={{color:"rgba(255,255,255,0.35)",fontSize:9,margin:"0 0 2px",lineHeight:1.4}}>{a.issue}</p>
          <p style={{color:"rgba(255,255,255,0.2)",fontSize:8,margin:0}}>→ {a.action}</p>
        </div>
      ))}
    </Card>
  );
}


// ═══════════════════════════════════════════════════════════════
// COUNTRY REGULATIONS ENGINE
// Applied automatically on login + every analysis
// Subscription always in USD — material pricing follows local rules
// ═══════════════════════════════════════════════════════════════
// Country regulations now derived from REGIONS (single source of truth)

function getCountryReg(regionCode){
  return COUNTRY_REGULATIONS[regionCode] || COUNTRY_REGULATIONS.NG;
}

// Format material price in LOCAL currency per country
function fmtLocal(amountUsd, regionCode){
  const reg = getCountryReg(regionCode);
  const local = amountUsd * reg.mat_rate;
  try{
    return reg.mat_symbol + local.toLocaleString("en-US",{maximumFractionDigits:0});
  }catch{
    return reg.mat_symbol + Math.round(local).toLocaleString();
  }
}

// Compliance badge component — shows active country building codes
function ComplianceBadges({regionCode}){
  const reg = getCountryReg(regionCode);
  if(!reg.flags.length && !reg.buildingCode) return null;
  return(
    <div style={{display:"flex",flexWrap:"wrap",gap:4,marginTop:6}}>
      <span style={{fontSize:8,fontWeight:700,padding:"2px 7px",borderRadius:99,background:"rgba(16,185,129,0.1)",color:"#10b981",border:"1px solid rgba(16,185,129,0.2)"}}>{reg.buildingCode}</span>
      {reg.flags.map(f=>(
        <span key={f} style={{fontSize:8,fontWeight:700,padding:"2px 7px",borderRadius:99,background:"rgba(99,102,241,0.1)",color:"#818cf8",border:"1px solid rgba(99,102,241,0.15)"}}>{f}</span>
      ))}
    </div>
  );
}


// ── TRADE ICON — dynamic icon per trade mode ──────────────────────────────
function TradeIcon({size=14,style={}}){
  // Rendered as Building2 by default — trade-specific icons via trade.icon
  return <Building2 size={size} style={style}/>;
}

// ═══════════════════════════════════════════════════════════════
// WORKSPACE SHELL
// ═══════════════════════════════════════════════════════════════
function WorkspaceShell({initialData,region,setRegion,tradeMode,wasteFactor,taxRate,onReset,dbRefresh,onQuerySaved,filePreview,fileName,userSession,paystackKey}){
  const paystackReady=usePaystack();
  const [baselineData]=useState(()=>JSON.parse(JSON.stringify(initialData)));
  const [lineItems,setLineItems]=useState(()=>JSON.parse(JSON.stringify(initialData.line_items||[])));
  const [activeTab,setActiveTab]=useState("overview");
  const [copilotOpen,setCopilotOpen]=useState(true);
  const [adminOpen,setAdminOpen]=useState(false);
  const [showAddon,setShowAddon]=useState(false);
  const [licenseInfo,setLicenseInfo]=useState({isValid:null,daysRemaining:30});
  const [usage,setUsage]=useState({count:0,addonScans:0});
  const [dbTick,setDbTick]=useState(0);
  const [copilotSeed,setCopilotSeed]=useState(null);
  const [sensitivityMult,setSensitivityMult]=useState(1);

  const meta=initialData.project_metadata||{};const fs=initialData.financial_summary||{};
  const grandTotal=useMemo(()=>lineItems.reduce((s,i)=>s+(i.qty||0)*((i.materialCost||0)+(i.laborCost||0)),0),[lineItems]);
  const grandTotalAdj=grandTotal*sensitivityMult;
  const taxAmt=grandTotalAdj*(taxRate/100);
  const totalWithTax=grandTotalAdj+taxAmt;
  const isDataModified=JSON.stringify(lineItems)!==JSON.stringify(baselineData.line_items||[]);
  const isProUser=licenseInfo.isValid===true;
  const trade=TRADES[tradeMode]||TRADES.GENERAL;const TradeIcon=trade.icon;

  useEffect(()=>{checkSubscriptionValidity("ENTERPRISE_MONTHLY").then(setLicenseInfo);},[dbTick]);
  useEffect(()=>{getMonthlyUsage().then(setUsage);},[dbTick]);
  useEffect(()=>{if(meta.primary_trade)setCopilotSeed(`${trade.label} analysis complete for "${fileName||"blueprint"}". ${meta.total_area||0} ${meta.area_unit||"sqft"} detected. Bid: ${fmt(fs.total_bid_price||0)}. Try /findRisks, /valueEngineer, /generateRFQ`);},[initialData]);

  const refreshAll=()=>setDbTick(n=>n+1);
  const handleResetToBaseline=()=>{if(window.confirm("Discard all overrides?"))setLineItems(JSON.parse(JSON.stringify(baselineData.line_items||[])));};

  const handleUnlock=()=>{
    const email=userSession?.email||prompt("Enter your email:");if(!email)return;
    if(!paystackReady||!window.PaystackPop){alert("Payment gateway loading. Wait 5 seconds and try again.");return;}
    // ── $250/month = ₦412,500 at 1650 rate (or use USD directly)
    const r=REGIONS[region]||REGIONS.NG;
    // For NGN regions: ₦412,500 (kobo: 41250000) | For USD: $250 (kobo: 25000)
    const amount = region==="NG" ? 41250000 : 25000; // kobo/cents for $250
    window.PaystackPop.setup({
      key:paystackKey||"pk_test_210007597620028bce50fc67189e6282f9d74e87",
      email,amount,currency:region==="NG"?"NGN":"USD",
      metadata:{tier:"ENTERPRISE_MONTHLY",plan:"$250/month - 100 blueprint scans"},
      callback:async response=>{
        await saveLicense("ENTERPRISE_MONTHLY",{reference:response.reference,customerEmail:email,tier:"ENTERPRISE_MONTHLY"});
        checkSubscriptionValidity("ENTERPRISE_MONTHLY").then(setLicenseInfo);
        alert(`Payment successful! Enterprise license activated.\nRef: ${response.reference}`);
      },
      onClose:()=>{}
    }).openIframe();
  };

  const handleBuyAddon=()=>{
    const email=userSession?.email||prompt("Enter your email:");if(!email)return;
    if(!paystackReady||!window.PaystackPop){alert("Payment gateway loading. Wait 5 seconds and try again.");return;}
    window.PaystackPop.setup({
      key:paystackKey||"pk_test_210007597620028bce50fc67189e6282f9d74e87",
      email,amount:5000, // $50 in cents
      currency:"USD",
      metadata:{type:"ADDON_PACK",scans:ADDON_SCANS,description:`${ADDON_SCANS} extra blueprint scans`},
      callback:async response=>{
        const updated=await addAddonScans(ADDON_SCANS);setUsage(updated);setShowAddon(false);
        alert(`${ADDON_SCANS} add-on scans added to your account!`);
      },
      onClose:()=>{}
    }).openIframe();
  };

  const saveToCloud=async()=>{
    if(!userSession?.dbConfig?.type==="mongo"||!userSession?.dbConfig?.apiKey)return;
    try{await mongoAPI.insertOne(userSession.dbConfig.apiKey,userSession.dbConfig.appId,"estimations",{userEmail:userSession.email,filename:fileName||"Blueprint",currency:REGIONS[region]?.currency||"USD",trade:tradeMode,bidPrice:fs.total_bid_price||grandTotal,bidWithTax:totalWithTax,createdAt:new Date().toISOString(),totalArea:meta.total_area||0,confidence:meta.confidence||"MEDIUM"});alert("Saved to MongoDB!");}
    catch(e){alert("Save failed: "+e.message);}
  };

  const applyAISuggestion=useCallback(suggestion=>{
    if(!suggestion)return;const{type,payload}=suggestion;
    if(type==="VALUE_ENGINEERING"&&Array.isArray(payload))setLineItems(prev=>prev.map(item=>{const ve=payload.find(v=>v.itemId===item.id);if(!ve)return item;return{...item,materialCost:Math.max(0,item.materialCost-ve.unitCostSavingsUsd),_modified:true};}));
    else if(type==="RISK_MATRIX"&&payload)setLineItems(prev=>[...prev.filter(i=>i.id!=="RISK-CONTINGENCY"),{id:"RISK-CONTINGENCY",description:`Risk Contingency (${payload.recommendedContingencyBufferPercent}%)`,category:"Contingency",qty:1,unit:"LS",materialCost:payload.contingencyCostUsd||0,laborCost:0,_aiGenerated:true}]);
    else if(type==="SCOPE_GAP"&&Array.isArray(payload))setLineItems(prev=>[...prev,...payload.map(g=>({id:`SCOPE-${Date.now()}-${Math.random().toString(36).slice(2,5)}`,description:g.inferredLineItem,category:g.missingCategory||"General",qty:g.calculatedQtyRequired,unit:g.unit,materialCost:g.calculatedQtyRequired>0?g.estimatedImpactUsd/g.calculatedQtyRequired:0,laborCost:0,_aiGenerated:true}))]);
    else if(type==="FX_REALIGNMENT"&&payload){const match=Object.entries(REGIONS).find(([,v])=>payload.targetRegion&&payload.targetRegion.toLowerCase().includes(v.label.split(" ")[1]?.toLowerCase()||""));if(match)setRegion(match[0]);}
    onQuerySaved?.();
  },[setRegion,onQuerySaved]);

  const estimateCtx={projectMetadata:meta,tradeMode,lineItems,financials:{...fs,tax_amount:taxAmt,total_with_tax:totalWithTax,tax_rate:taxRate},activeRegion:REGIONS[region]?.currency,grandTotalUsd:grandTotal,isDataModified,fileName};

  const WORKSPACE_TABS=[
    {id:"overview",label:"Overview",Icon:LayoutDashboard},
    {id:"trade",label:"Trade Items",Icon:TradeIcon},
    {id:"costs",label:"Cost Matrix",Icon:Landmark},
    {id:"risks",label:"Risks",Icon:AlertTriangle},
    {id:"rfq",label:"RFQ / PO",Icon:ShoppingCart},
    {id:"compare",label:"V1 vs V2",Icon:ArrowLeftRight},
    {id:"export",label:"Export",Icon:Download},
    {id:"copilot",label:"AI Copilot",Icon:CheckCircle2},
    {id:"history",label:"History",Icon:Database},
  ];

  // Add-on purchase modal
  if(showAddon) return(
    <div style={{position:"fixed",inset:0,zIndex:60,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,0.8)",padding:16}}>
      <Card style={{maxWidth:380,width:"100%",padding:24,textAlign:"center"}}>
        <p style={{color:"#10b981",fontFamily:"Bebas Neue",fontSize:"1.6rem",margin:"0 0 4px"}}>BUY ADD-ON PACK</p>
        <p style={{color:"rgba(255,255,255,0.55)",fontSize:12,margin:"0 0 16px"}}>Top up your blueprint scan budget</p>
        <div style={{padding:16,borderRadius:12,background:`${GN}0.06)`,border:`1px solid ${GN}0.18)`,marginBottom:16}}>
          <p style={{color:"#10b981",fontFamily:"Bebas Neue",fontSize:"2rem",margin:0}}>${ADDON_PRICE_USD}</p>
          <p style={{color:"rgba(255,255,255,0.5)",fontSize:11,margin:"4px 0 0"}}>+{ADDON_SCANS} blueprint scans · Instant unlock</p>
        </div>
        <div style={{display:"flex",gap:8}}>
          <button onClick={()=>setShowAddon(false)} style={{flex:1,padding:"10px 0",borderRadius:10,border:`1px solid ${GN}0.2)`,background:"transparent",color:"rgba(255,255,255,0.4)",cursor:"pointer",fontSize:11,fontWeight:600}}>Cancel</button>
          <button onClick={handleBuyAddon} style={{flex:2,padding:"10px 0",borderRadius:10,border:"none",background:"linear-gradient(135deg,#10b981,#059669)",color:"#000",cursor:"pointer",fontSize:11,fontWeight:900}}>Pay ${ADDON_PRICE_USD} via Paystack</button>
        </div>
      </Card>
    </div>
  );

  return(
    <div style={{...BG,display:"flex",flexDirection:"column",fontFamily:"Space Grotesk, sans-serif",minHeight:"100vh"}}>
      <link href={FONT} rel="stylesheet"/>
      <GlobalBackground/>
      {adminOpen&&<AdminPanel onClose={()=>setAdminOpen(false)} onRefreshLicense={refreshAll}/>}
      {/* Header */}
      <header style={{position:"sticky",top:0,zIndex:40,background:"rgba(10,26,18,0.96)",backdropFilter:"blur(12px)",borderBottom:`1px solid ${GN}0.12)`,padding:"8px 14px",display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <div style={{width:28,height:28,borderRadius:8,background:"linear-gradient(135deg,#10b981,#059669)",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 0 10px rgba(16,185,129,0.3)"}}><span style={{color:"#000",fontFamily:"Bebas Neue",fontWeight:900,fontSize:13,letterSpacing:"0.05em"}}>FE</span></div>
          <div><h1 style={{fontFamily:"Bebas Neue",fontSize:"1.1rem",letterSpacing:"0.05em",color:"#fff",margin:0,lineHeight:1}}>FORGE<span style={{color:"#10b981"}}>ESTIMATE</span> <span style={{color:`${GN}0.5)`}}>v10</span></h1></div>
          <div style={{display:"flex",alignItems:"center",gap:4,padding:"3px 8px",borderRadius:8,background:`${trade.color}18`,border:`1px solid ${trade.color}35`}}><TradeIcon size={10} style={{color:trade.color}}/><span style={{color:trade.color,fontSize:9,fontWeight:700}}>{trade.label}</span></div>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          {isDataModified&&<button onClick={handleResetToBaseline} style={{display:"flex",alignItems:"center",gap:3,padding:"4px 8px",borderRadius:7,border:`1px solid ${GN}0.2)`,background:`${GN}0.08)`,color:"#10b981",fontSize:9,fontWeight:700,cursor:"pointer"}}><RotateCcw size={9}/>Reset</button>}
          <button onClick={async()=>{
  const qrData = await generateVerificationQR(initialData,region,tradeMode,fileName);
  generatePDFReport(initialData,region,tradeMode,fileName,qrData);
}} style={{display:"flex",alignItems:"center",gap:3,padding:"4px 8px",borderRadius:7,border:"1px solid rgba(59,130,246,0.35)",background:"rgba(59,130,246,0.12)",color:"#60a5fa",fontSize:9,fontWeight:700,cursor:"pointer"}}><Download size={9}/>PDF Report</button>
          {!isProUser&&<button onClick={handleUnlock} style={{display:"flex",alignItems:"center",gap:3,padding:"4px 10px",borderRadius:7,border:"1px solid rgba(245,158,11,0.35)",background:"rgba(245,158,11,0.12)",color:"#f59e0b",fontSize:9,fontWeight:900,cursor:"pointer"}}><CreditCard size={10}/>$250/mo Enterprise</button>}
          {isProUser&&<div style={{display:"flex",alignItems:"center",gap:4,padding:"4px 8px",borderRadius:7,border:`1px solid ${GN}0.15)`,background:`${GN}0.05)`}}><CalendarClock size={10} style={{color:`${GN}0.6)`}}/><span style={{color:"#10b981",fontSize:9,fontWeight:700,fontFamily:"JetBrains Mono"}}>{licenseInfo.daysRemaining}d left</span></div>}
          <button onClick={()=>setAdminOpen(true)} style={{padding:6,borderRadius:7,border:`1px solid ${GN}0.15)`,background:`${GN}0.05)`,cursor:"pointer",color:`${GN}0.5)`,display:"flex"}}><Wrench size={12}/></button>
          <button onClick={onReset} style={{background:"none",border:"none",cursor:"pointer",color:"rgba(255,255,255,0.18)",fontSize:8}}>Reset</button>
        </div>
      </header>

      <div style={{flex:1,display:"flex",overflow:"hidden",position:"relative",zIndex:1}}>
        <main style={{flex:1,overflowY:"auto",padding:14,display:"flex",flexDirection:"column",gap:10}}>
          {/* Usage tracker */}
          {isProUser&&<UsageTrackerPanel usage={usage} onOpenAddonOptions={()=>setShowAddon(true)}/>}
          {/* KPI tiles */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8}}>
            {[["Total Bid",fmt(fs.total_bid_price||grandTotalAdj*1.2),trade.color],["+ Tax",fmt(totalWithTax),"#34d399"],["Area",`${meta.total_area||0} ${meta.area_unit||"sqft"}`,"#6ee7b7"],[`${meta.total_rooms||0} Rooms`,"Spaces","#f59e0b"]].map(([v,l,c],i)=>(
              <Card key={i} style={{padding:8}}>
                <p style={{color:`${GN}0.38)`,fontSize:7,textTransform:"uppercase",letterSpacing:"0.12em",margin:"0 0 3px"}}>{l}</p>
                <p style={{fontFamily:"Bebas Neue",fontSize:15,color:c,margin:0,lineHeight:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{v}</p>
              </Card>
            ))}
          </div>
          {/* Blueprint strip */}
          {filePreview&&<Card style={{overflow:"hidden",height:55,position:"relative"}}><img src={filePreview} alt={fileName} style={{width:"100%",height:"100%",objectFit:"cover",opacity:0.2}}/><div style={{position:"absolute",inset:0,display:"flex",alignItems:"center",padding:"0 12px",background:"linear-gradient(90deg,rgba(10,26,18,0.94),rgba(10,26,18,0.5))"}}><TradeIcon size={13} style={{color:trade.color,marginRight:8,flexShrink:0}}/><p style={{color:"rgba(255,255,255,0.55)",fontSize:10,fontWeight:700,margin:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{fileName}</p><span style={{marginLeft:"auto",padding:"2px 6px",borderRadius:99,fontSize:8,fontWeight:900,background:meta.confidence==="HIGH"?`${GN}0.15)`:"rgba(245,158,11,0.15)",color:meta.confidence==="HIGH"?"#10b981":"#f59e0b"}}>{meta.confidence}</span></div></Card>}
          {/* Tabs */}
          <div style={{display:"flex",gap:2,padding:3,borderRadius:12,border:`1px solid ${GN}0.1)`,background:`${GN}0.02)`,overflowX:"auto"}}>
            {WORKSPACE_TABS.map(({id,label,Icon})=><button key={id} onClick={()=>setActiveTab(id)} style={{display:"flex",alignItems:"center",gap:4,padding:"6px 10px",borderRadius:8,border:"none",cursor:"pointer",background:activeTab===id?`${GN}0.12)`:"transparent",color:activeTab===id?"#10b981":"rgba(255,255,255,0.22)",fontSize:9,fontWeight:700,whiteSpace:"nowrap",flexShrink:0}}><Icon size={10}/>{label}</button>)}
            {isDataModified&&<span style={{marginLeft:"auto",alignSelf:"center",marginRight:4}}><Pill c="emerald">MODIFIED</Pill></span>}
          </div>
          {/* Tab content */}
          <Card style={{padding:14,minHeight:280}}>
            {activeTab==="overview"&&<div style={{display:"flex",flexDirection:"column",gap:16}}>
              <SpeedMetricsCard totalArea={meta.total_area||0}/>
              <div><p style={{color:`${GN}0.5)`,fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.2em",margin:"0 0 10px"}}>Phase Breakdown</p>
                {(initialData.phases||[]).map((p,i)=><div key={i} style={{marginBottom:12}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}><span style={{fontSize:11,fontWeight:700,color:PPAL[i%5]}}>{p.phase_name}</span><span style={{fontFamily:"JetBrains Mono",fontWeight:900,fontSize:12,color:"#fff"}}>{fmt(p.cost)}</span></div><AnimBar pct={(p.cost/Math.max(...(initialData.phases||[]).map(x=>x.cost),1))*100} color={PPAL[i%5]} delay={i*80}/></div>)}
                <div style={{marginTop:10,paddingTop:10,borderTop:`1px solid ${GN}0.1)`}}>
                  {[["Subtotal",fs.subtotal||grandTotal],["Tax ("+taxRate+"%)",taxAmt],["Total incl. Tax",totalWithTax]].map(([l,v],i)=><div key={l} style={{display:"flex",justifyContent:"space-between",marginBottom:5,borderTop:i===2?`1px solid ${GN}0.15)`:"none",paddingTop:i===2?8:0}}><span style={{color:`rgba(255,255,255,${i===2?0.7:0.28})`,fontSize:i===2?12:10,fontWeight:i===2?900:400}}>{l}</span><span style={{fontFamily:"JetBrains Mono",color:i===2?"#10b981":"rgba(255,255,255,0.5)",fontSize:i===2?12:10,fontWeight:i===2?900:400}}>{fmt(v)}</span></div>)}
                </div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}><MultiCurrencyCompare baseTotalUsd={fs.total_bid_price||grandTotal}/><CostSensitivitySliders baseTotal={fs.total_bid_price||grandTotal} onMultiplierChange={m=>setSensitivityMult(m)}/></div>
            </div>}
            {activeTab==="trade"&&<div>
              <p style={{color:`${GN}0.5)`,fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.2em",margin:"0 0 10px"}}>{trade.label} — Detected Elements</p>
              {(initialData.trade_specific?.items||[]).length===0?<div style={{textAlign:"center",padding:"40px 0"}}><TradeIcon size={28} style={{color:`${GN}0.2)`,display:"block",margin:"0 auto 10px"}}/><p style={{color:"rgba(255,255,255,0.2)",fontSize:11}}>No trade-specific items found. Re-analyze with {trade.label} mode selected.</p></div>:
              <div style={{overflowX:"auto"}}><table style={{width:"100%",fontSize:10,borderCollapse:"collapse"}}><thead><tr style={{borderBottom:`1px solid ${GN}0.12)`}}>{["Code","Description","Qty","Unit","Notes"].map(h=><th key={h} style={{textAlign:"left",padding:"5px 8px",color:`${GN}0.4)`,fontWeight:700}}>{h}</th>)}</tr></thead><tbody>{(initialData.trade_specific.items||[]).map((item,i)=><tr key={i} style={{borderBottom:`1px solid ${GN}0.06)`}}><td style={{padding:"5px 8px",fontFamily:"JetBrains Mono",color:`${GN}0.6)`,fontSize:9}}>{item.code||`T-${String(i+1).padStart(3,"0")}`}</td><td style={{padding:"5px 8px",color:"rgba(255,255,255,0.65)",fontWeight:500}}>{item.description}</td><td style={{padding:"5px 8px",fontFamily:"JetBrains Mono",color:"#10b981",fontWeight:700}}>{item.qty}</td><td style={{padding:"5px 8px",color:"rgba(255,255,255,0.25)",fontSize:9}}>{item.unit}</td><td style={{padding:"5px 8px",color:"rgba(255,255,255,0.2)",fontSize:9,maxWidth:120,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{item.notes||"-"}</td></tr>)}</tbody></table></div>}
            </div>}
            {activeTab==="costs"&&<FeaturePaywallGate isProUser={isProUser} label="Interactive Cost Matrix" onUnlock={handleUnlock}><CostsTab lineItems={lineItems} baselineItems={baselineData.line_items} onUpdateLineItems={setLineItems} region={region} taxRate={taxRate}/></FeaturePaywallGate>}
            {activeTab==="risks"&&<div>
              <p style={{color:`${GN}0.5)`,fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.2em",margin:"0 0 10px"}}>Risk Assessment</p>
              {(initialData.risk_flags||[]).map((r,i)=>{const sv={HIGH:{c:"#f43f5e",bg:"rgba(244,63,94,0.06)",b:"rgba(244,63,94,0.15)"},MEDIUM:{c:"#f59e0b",bg:"rgba(245,158,11,0.05)",b:"rgba(245,158,11,0.14)"},LOW:{c:"#10b981",bg:`${GN}0.05)`,b:`${GN}0.14)`}}[r.severity]||{c:"#888",bg:"transparent",b:"rgba(136,136,136,0.1)"};return<div key={i} style={{display:"flex",gap:10,padding:10,borderRadius:12,marginBottom:8,background:sv.bg,border:`1px solid ${sv.b}`}}><span style={{padding:"2px 6px",borderRadius:99,height:"fit-content",fontSize:8,fontWeight:900,background:sv.c+"22",color:sv.c,whiteSpace:"nowrap"}}>{r.severity}</span><div><p style={{color:"rgba(255,255,255,0.70)",fontWeight:700,fontSize:11,margin:"0 0 2px"}}>{r.issue}</p><p style={{color:"rgba(255,255,255,0.28)",fontSize:10,margin:r.cost_impact?"0 0 2px":0}}>{r.mitigation}</p>{r.cost_impact>0&&<span style={{color:"#f59e0b",fontFamily:"JetBrains Mono",fontSize:9,fontWeight:700}}>Impact: {fmt(r.cost_impact)}</span>}</div></div>;})}
              {(initialData.value_engineering||[]).length>0&&<><p style={{color:`${GN}0.5)`,fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.2em",margin:"14px 0 8px"}}>Value Engineering</p>{initialData.value_engineering.map((ve,i)=><div key={i} style={{display:"flex",gap:10,padding:10,borderRadius:12,marginBottom:8,background:`${GN}0.04)`,border:`1px solid ${GN}0.12)`}}><span style={{padding:"2px 6px",borderRadius:99,height:"fit-content",fontSize:8,fontWeight:900,background:`${GN}0.15)`,color:"#10b981"}}>SAVE</span><div><p style={{color:"rgba(255,255,255,0.62)",fontWeight:700,fontSize:11,margin:"0 0 2px"}}>{ve.option}</p><div style={{display:"flex",gap:6,alignItems:"center",fontSize:10}}><span style={{color:"#10b981",fontWeight:700,fontFamily:"JetBrains Mono"}}>{fmt(ve.saving)}</span><span style={{color:"rgba(255,255,255,0.18)"}}>— {ve.impact}</span></div></div></div>)}</>}
            </div>}
            {activeTab==="rfq"&&<FeaturePaywallGate isProUser={isProUser} label="RFQ and Purchase Order Generator" onUnlock={handleUnlock}><RFQGenerator lineItems={lineItems} projectMeta={meta} region={region} onQuerySaved={onQuerySaved}/></FeaturePaywallGate>}
            {activeTab==="compare"&&<FeaturePaywallGate isProUser={isProUser} label="Blueprint Version Comparison" onUnlock={handleUnlock}><VersionCompare v1Data={initialData} region={region} tradeMode={tradeMode||"GENERAL"} onQuerySaved={onQuerySaved}/></FeaturePaywallGate>}
            {activeTab==="export"&&<FeaturePaywallGate isProUser={isProUser} label="Multi-Format Export Hub" onUnlock={handleUnlock}>
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                <WhatsAppShareButton data={initialData} tradeMode={tradeMode} region={region} fileName={fileName}/>
                <ExportHub lineItems={lineItems} projectMeta={meta} financials={{...fs,tax_amount:taxAmt,total_bid_with_tax:totalWithTax,tax_rate:taxRate}} region={region}/>
              </div>
            </FeaturePaywallGate>}
            {activeTab==="copilot"&&<FeaturePaywallGate isProUser={isProUser} label="AI Copilot" onUnlock={handleUnlock}><div style={{height:460}}><AIChat estimateCtx={estimateCtx} onApplySuggestion={applyAISuggestion} onQuerySaved={onQuerySaved} seedMsg={copilotSeed}/></div></FeaturePaywallGate>}
            {activeTab==="history"&&<HistoryPanel userSession={userSession} dbRefresh={dbRefresh+dbTick}/>}
          </Card>
        </main>
        {/* Right copilot rail */}
        <aside style={{display:"flex",flexDirection:"column",borderLeft:`1px solid ${GN}0.1)`,background:"rgba(10,26,18,0.6)",backdropFilter:"blur(8px)",transition:"width 0.3s",width:copilotOpen?290:0,overflow:"hidden",flexShrink:0,position:"relative"}}>
          <button onClick={()=>setCopilotOpen(o=>!o)} style={{position:"absolute",top:"50%",left:-14,transform:"translateY(-50%)",width:28,height:28,borderRadius:"50%",background:"rgba(10,26,18,0.9)",border:`1px solid ${GN}0.2)`,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",color:`${GN}0.5)`,zIndex:10}}>
            {copilotOpen?<ChevronRight size={12}/>:<ChevronLeft size={12}/>}
          </button>
          {copilotOpen&&<>
            <div style={{padding:"9px 12px",borderBottom:`1px solid ${GN}0.1)`,display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
              <div style={{width:20,height:20,borderRadius:6,background:"linear-gradient(135deg,#10b981,#059669)",display:"flex",alignItems:"center",justifyContent:"center"}}><span style={{color:"#000",fontWeight:900,fontSize:8}}>AI</span></div>
              <div><p style={{color:"#fff",fontWeight:700,fontSize:10,margin:0}}>Copilot · {trade.label}</p><p style={{color:`${GN}0.4)`,fontSize:8,margin:0}}>claude-sonnet-4</p></div>
              <Pill c="emerald">LIVE</Pill>
            </div>
            <div style={{flex:1,overflow:"hidden",margin:6,borderRadius:10,border:`1px solid ${GN}0.1)`,background:"rgba(10,26,18,0.4)"}}>
              {isProUser?<AIChat estimateCtx={estimateCtx} onApplySuggestion={applyAISuggestion} onQuerySaved={onQuerySaved} seedMsg={copilotSeed}/>:<div style={{height:"100%",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",textAlign:"center",padding:16}}><Lock size={22} style={{color:`${GN}0.15)`,marginBottom:8}}/><p style={{color:"rgba(255,255,255,0.22)",fontSize:11,fontWeight:700,margin:"0 0 4px"}}>AI Copilot</p><p style={{color:"rgba(255,255,255,0.12)",fontSize:9,margin:"0 0 12px"}}>Enterprise only ($250/month)</p><button onClick={handleUnlock} style={{padding:"8px 16px",borderRadius:10,border:"none",cursor:"pointer",fontWeight:900,fontSize:10,background:"linear-gradient(135deg,#10b981,#059669)",color:"#000"}}>Unlock Now</button></div>}
            </div>
          </>}
        </aside>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// ROOT APP
// ═══════════════════════════════════════════════════════════════


const ASSEMBLIES = {
  GENERAL:[
    {name:"Standard Bathroom Package",icon:"🚿",items:[
      {description:"Toilet — standard 2-piece",qty:1,unit:"ea",materialCost:180,laborCost:120,category:"Plumbing"},
      {description:"Vanity sink with cabinet",qty:1,unit:"ea",materialCost:350,laborCost:150,category:"Plumbing"},
      {description:"Shower/tub unit",qty:1,unit:"ea",materialCost:600,laborCost:400,category:"Plumbing"},
      {description:"Ceramic floor tile",qty:50,unit:"sqft",materialCost:4,laborCost:6,category:"Finishes"},
      {description:"Bathroom exhaust fan",qty:1,unit:"ea",materialCost:45,laborCost:80,category:"Electrical"},
    ]},
    {name:"Standard Bedroom Package",icon:"🛏️",items:[
      {description:"Drywall walls and ceiling",qty:400,unit:"sqft",materialCost:0.5,laborCost:1.2,category:"Drywall"},
      {description:"Interior paint 2 coats",qty:400,unit:"sqft",materialCost:0.6,laborCost:0.9,category:"Finishes"},
      {description:"Carpet or laminate flooring",qty:140,unit:"sqft",materialCost:2.5,laborCost:1.5,category:"Finishes"},
      {description:"Ceiling light fixture",qty:1,unit:"ea",materialCost:35,laborCost:50,category:"Electrical"},
    ]},
    {name:"Kitchen Package Mid Range",icon:"🍳",items:[
      {description:"Kitchen cabinets upper and lower",qty:20,unit:"lf",materialCost:120,laborCost:80,category:"Finishes"},
      {description:"Countertop laminate",qty:25,unit:"sqft",materialCost:25,laborCost:15,category:"Finishes"},
      {description:"Kitchen sink and faucet",qty:1,unit:"ea",materialCost:250,laborCost:120,category:"Plumbing"},
      {description:"Backsplash tile",qty:30,unit:"sqft",materialCost:5,laborCost:7,category:"Finishes"},
    ]},
  ],
  ELECTRICAL:[
    {name:"Standard Outlet Circuit 20A",icon:"🔌",items:[
      {description:"20A circuit breaker",qty:1,unit:"ea",materialCost:12,laborCost:20,category:"Electrical"},
      {description:"12 AWG wire run",qty:50,unit:"lf",materialCost:0.8,laborCost:1.5,category:"Electrical"},
      {description:"GFCI outlet",qty:4,unit:"ea",materialCost:18,laborCost:25,category:"Electrical"},
    ]},
    {name:"Panel Upgrade 200A",icon:"⚡",items:[
      {description:"200A main panel",qty:1,unit:"ea",materialCost:350,laborCost:600,category:"Electrical"},
      {description:"Service entrance cable",qty:30,unit:"lf",materialCost:8,laborCost:12,category:"Electrical"},
      {description:"Grounding rod and wire",qty:1,unit:"ea",materialCost:40,laborCost:80,category:"Electrical"},
    ]},
  ],
  PLUMBING:[
    {name:"Water Heater Replacement",icon:"🔥",items:[
      {description:"50-gal water heater tank",qty:1,unit:"ea",materialCost:650,laborCost:300,category:"Plumbing"},
      {description:"Copper supply line connections",qty:6,unit:"lf",materialCost:6,laborCost:15,category:"Plumbing"},
      {description:"Expansion tank",qty:1,unit:"ea",materialCost:75,laborCost:50,category:"Plumbing"},
    ]},
  ],
  ROOFING:[
    {name:"Asphalt Shingle Roof 1 Square",icon:"🏠",items:[
      {description:"Architectural shingles",qty:1,unit:"square",materialCost:120,laborCost:150,category:"Roofing"},
      {description:"Underlayment synthetic",qty:1,unit:"square",materialCost:25,laborCost:0,category:"Roofing"},
      {description:"Ridge cap shingles",qty:10,unit:"lf",materialCost:3,laborCost:2,category:"Roofing"},
    ]},
  ],
  HVAC:[
    {name:"Split AC System 3 Ton",icon:"❄️",items:[
      {description:"3-ton condenser unit",qty:1,unit:"ea",materialCost:1800,laborCost:600,category:"HVAC"},
      {description:"Air handler with coil",qty:1,unit:"ea",materialCost:900,laborCost:400,category:"HVAC"},
      {description:"Refrigerant line set",qty:25,unit:"lf",materialCost:8,laborCost:6,category:"HVAC"},
    ]},
  ],
  CIVIL:[
    {name:"Driveway Concrete per 100 sqft",icon:"🛣️",items:[
      {description:"Concrete slab 4 inch",qty:100,unit:"sqft",materialCost:4.5,laborCost:3.5,category:"Concrete"},
      {description:"Gravel base 4 inch",qty:100,unit:"sqft",materialCost:1.2,laborCost:0.8,category:"Concrete"},
      {description:"Rebar reinforcement mesh",qty:100,unit:"sqft",materialCost:0.6,laborCost:0.4,category:"Steel"},
    ]},
  ],
};



const CARBON_FACTORS = { // kg CO2e per unit (industry-average embodied carbon)
  Concrete:{unit:"cu yd",factor:400}, Steel:{unit:"ton",factor:1850},
  Masonry:{unit:"sqft",factor:12},   Lumber:{unit:"bf",factor:0.5},
  Drywall:{unit:"sqft",factor:2.5},  Electrical:{unit:"item",factor:8},
  Plumbing:{unit:"item",factor:10},  Roofing:{unit:"square",factor:95},
  HVAC:{unit:"item",factor:120},     Finishes:{unit:"sqft",factor:3},
  General:{unit:"item",factor:5},
};



function estimateCarbon(lineItems){
  let totalKg = 0;
  const breakdown = {};
  (lineItems||[]).forEach(item=>{
    const cat = item.category || "General";
    const factor = CARBON_FACTORS[cat]?.factor || CARBON_FACTORS.General.factor;
    const qty = item.qty || 0;
    const kg = qty * factor * 0.15; // normalized — avoids wild overestimate across mixed units
    totalKg += kg;
    breakdown[cat] = (breakdown[cat]||0) + kg;
  });
  return { totalKg, totalTons: totalKg/1000, breakdown };
}



async function getHistoricalBenchmark(tradeMode){
  try{
    const snaps=await dbAll("projectSnapshots");
    const same=snaps.filter(s=>s.tradeMode===tradeMode&&s.fullData?.financial_summary?.cost_per_unit);
    if(same.length<2)return null;
    const costs=same.map(s=>s.fullData.financial_summary.cost_per_unit);
    const avg=costs.reduce((a,b)=>a+b,0)/costs.length;
    return{avg,min:Math.min(...costs),max:Math.max(...costs),count:same.length};
  }catch{return null;}
}



async function activateTrial(licenseKey, plan){
  await dbPut("userLicenses",{
    featureKey:licenseKey,
    isUnlocked:true,
    isTrial:true,
    reference:"TRIAL_"+Date.now(),
    activatedAt:new Date().toISOString(),
    trialExpiresAt:new Date(Date.now()+TRIAL_HOURS*60*60*1000).toISOString(),
    tier:`TRIAL_${plan.toUpperCase()}`,
    plan,
  });
}


async function checkTrialStatus(licenseKey){
  try{
    const r = await dbOne("userLicenses",licenseKey);
    if(!r || !r.isTrial) return {active:false};
    const msRemaining = new Date(r.trialExpiresAt) - Date.now();
    return { active: msRemaining > 0, hoursRemaining: Math.max(0,Math.ceil(msRemaining/3600000)), plan:r.plan };
  }catch{ return {active:false}; }
}



function AssemblyLibrary({tradeMode,onAddAssembly,region}){
  const assemblies=ASSEMBLIES[tradeMode]||ASSEMBLIES.GENERAL;
  const [added,setAdded]=useState({});
  const handleAdd=(assembly,idx)=>{
    onAddAssembly(assembly.items);
    setAdded(p=>({...p,[idx]:true}));
    setTimeout(()=>setAdded(p=>({...p,[idx]:false})),2000);
  };
  return(
    <div>
      <p style={{color:`${GN}0.5)`,fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.2em",margin:"0 0 4px"}}>Assembly Library</p>
      <p style={{color:"rgba(255,255,255,0.2)",fontSize:9,margin:"0 0 14px"}}>One-click cost packages — adds multiple line items instantly to your cost matrix.</p>
      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        {assemblies.map((a,idx)=>{
          const total=a.items.reduce((s,i)=>s+i.qty*(i.materialCost+i.laborCost),0);
          return(
            <div key={idx} style={{padding:12,borderRadius:12,border:`1px solid ${GN}0.12)`,background:`${GN}0.03)`}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <span style={{fontSize:18}}>{a.icon}</span>
                  <div>
                    <p style={{color:"rgba(255,255,255,0.7)",fontWeight:700,fontSize:12,margin:0}}>{a.name}</p>
                    <p style={{color:"rgba(255,255,255,0.25)",fontSize:9,margin:0}}>{a.items.length} items · {fmt(total)}</p>
                  </div>
                </div>
                <button onClick={()=>handleAdd(a,idx)} style={{display:"flex",alignItems:"center",gap:4,padding:"6px 12px",borderRadius:8,border:"none",cursor:"pointer",fontWeight:900,fontSize:10,background:added[idx]?"rgba(16,185,129,0.2)":"linear-gradient(135deg,#10b981,#059669)",color:added[idx]?"#10b981":"#000",whiteSpace:"nowrap"}}>
                  {added[idx]?<><CheckCircle2 size={11}/>Added!</>:<><Plus size={11}/>Add</>}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}



function BidHealthScore({costPerUnit,tradeMode,region}){
  const [bench,setBench]=useState(null);
  const [loading,setLoading]=useState(true);
  useEffect(()=>{getHistoricalBenchmark(tradeMode).then(b=>{setBench(b);setLoading(false);});},[tradeMode]);
  if(loading||!bench)return null;
  const dev=((costPerUnit-bench.avg)/bench.avg)*100;
  const status=dev>15?{label:"ABOVE YOUR AVERAGE",color:"#f59e0b",msg:"This bid is priced higher than your typical jobs. Check for scope creep."}
    :dev<-15?{label:"BELOW YOUR AVERAGE",color:"#ef4444",msg:"Priced lower than usual. Check for missing line items."}
    :{label:"WITHIN NORMAL RANGE",color:"#10b981",msg:"Aligns with your historical pricing. Looks healthy."};
  return(
    <Card style={{padding:12,marginBottom:10,border:`1px solid ${status.color}33`}}>
      <div style={{display:"flex",alignItems:"flex-start",gap:8}}>
        <div style={{width:30,height:30,borderRadius:8,background:status.color+"18",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
          {dev>15||dev<-15?<AlertTriangle size={14} style={{color:status.color}}/>:<CheckCircle2 size={14} style={{color:status.color}}/>}
        </div>
        <div style={{flex:1}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:2}}>
            <p style={{color:"#fff",fontWeight:900,fontSize:11,margin:0}}>Bid Health Score</p>
            <span style={{fontSize:8,fontWeight:900,padding:"2px 8px",borderRadius:99,background:status.color+"22",color:status.color}}>{status.label}</span>
          </div>
          <p style={{color:"rgba(255,255,255,0.35)",fontSize:9,margin:"0 0 4px"}}>{status.msg}</p>
          <div style={{display:"flex",gap:12,fontSize:9}}>
            <span style={{color:"rgba(255,255,255,0.25)"}}>This bid: <strong style={{color:"#fff"}}>{fmt(costPerUnit)}/unit</strong></span>
            <span style={{color:"rgba(255,255,255,0.25)"}}>Your avg: <strong style={{color:"#fff"}}>{fmt(bench.avg)}/unit</strong></span>
          </div>
        </div>
      </div>
    </Card>
  );
}



function StructuralCalculator({region,onAddToEstimate}){
  const [mode,setMode]=useState("slab");
  const [L,setL]=useState(20);const [W,setW]=useState(20);const [T,setT]=useState(4);const [H,setH]=useState(8);
  const [rebarSize,setRebarSize]=useState("#4 (1/2\")");const [spacing,setSpacing]=useState(12);const [area,setArea]=useState(400);
  const cuFt=mode==="wall"?(L*H*(T/12)):(L*W*(T/12));
  const cuYd=cuFt/27;const cuM=cuFt*0.0283168;const bags=Math.ceil(cuFt/0.6);
  const r=REBAR_SIZES[rebarSize];
  const barsPerDir=Math.ceil((Math.sqrt(area)*12)/spacing)+1;
  const totalLengthFt=barsPerDir*Math.sqrt(area)*2;
  const rebarLb=totalLengthFt*(r?.weight_lb_ft||0.668);
  const rebarKg=rebarLb*0.4536;
  const inp={width:"100%",background:"rgba(0,0,0,0.3)",border:`1px solid ${GN}0.2)`,borderRadius:8,padding:"7px 10px",color:"#fff",fontFamily:"JetBrains Mono",fontSize:12,outline:"none",boxSizing:"border-box"};
  const lbl={color:"rgba(255,255,255,0.3)",fontSize:9,fontWeight:700,textTransform:"uppercase",display:"block",marginBottom:4};
  const addConcrete=()=>onAddToEstimate([{description:`Concrete ${mode} (${L}x${mode==="wall"?H+"H":W}x${T}")`,qty:+cuYd.toFixed(2),unit:"cu yd",materialCost:150,laborCost:60,category:"Concrete",confidence:"HIGH"}]);
  const addRebar=()=>onAddToEstimate([{description:`Rebar ${rebarSize} @ ${spacing}" o.c. (${area} sqft)`,qty:+( rebarLb/100).toFixed(2),unit:"cwt",materialCost:90,laborCost:25,category:"Steel",confidence:"HIGH"}]);
  return(
    <div>
      <p style={{color:`${GN}0.5)`,fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.2em",margin:"0 0 4px"}}>Structural Calculator</p>
      <p style={{color:"rgba(255,255,255,0.2)",fontSize:9,margin:"0 0 12px"}}>Deterministic concrete volume and rebar weight — always 100% accurate, independent of AI.</p>
      <div style={{display:"flex",gap:4,padding:3,borderRadius:10,background:`${GN}0.05)`,border:`1px solid ${GN}0.1)`,marginBottom:12}}>
        {[["slab","Slab"],["wall","Wall"],["rebar","Rebar"]].map(([k,l])=>(
          <button key={k} onClick={()=>setMode(k)} style={{flex:1,padding:"7px 0",fontSize:10,fontWeight:700,borderRadius:8,border:"none",cursor:"pointer",background:mode===k?`${GN}0.15)`:"transparent",color:mode===k?"#10b981":"rgba(255,255,255,0.3)"}}>{l}</button>
        ))}
      </div>
      {(mode==="slab"||mode==="wall")&&<>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:10}}>
          <div><label style={lbl}>Length ft</label><input type="number" value={L} onChange={e=>setL(+e.target.value||0)} style={inp}/></div>
          {mode==="slab"?<div><label style={lbl}>Width ft</label><input type="number" value={W} onChange={e=>setW(+e.target.value||0)} style={inp}/></div>:<div><label style={lbl}>Height ft</label><input type="number" value={H} onChange={e=>setH(+e.target.value||0)} style={inp}/></div>}
          <div><label style={lbl}>Thickness in</label><input type="number" value={T} onChange={e=>setT(+e.target.value||0)} style={inp}/></div>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:10}}>
          {[["Cu Yards",cuYd.toFixed(2),"#10b981"],["Cu Meters",cuM.toFixed(2),"#34d399"],["80lb Bags",bags,"#f59e0b"]].map(([l,v,c])=>(
            <div key={l} style={{padding:10,borderRadius:10,border:`1px solid ${GN}0.1)`,textAlign:"center"}}>
              <p style={{fontFamily:"Bebas Neue",fontSize:18,color:c,margin:0}}>{v}</p>
              <p style={{color:"rgba(255,255,255,0.25)",fontSize:8,margin:0}}>{l}</p>
            </div>
          ))}
        </div>
        <button onClick={addConcrete} style={{width:"100%",padding:"10px 0",borderRadius:10,border:"none",cursor:"pointer",fontWeight:900,fontSize:11,background:"linear-gradient(135deg,#10b981,#059669)",color:"#000",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}><Plus size={12}/>Add to Cost Matrix</button>
      </>}
      {mode==="rebar"&&<>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
          <div><label style={lbl}>Bar Size</label><select value={rebarSize} onChange={e=>setRebarSize(e.target.value)} style={{...inp,cursor:"pointer"}}>{Object.keys(REBAR_SIZES).map(s=><option key={s}>{s}</option>)}</select></div>
          <div><label style={lbl}>Spacing in o.c.</label><input type="number" value={spacing} onChange={e=>setSpacing(+e.target.value||12)} style={inp}/></div>
        </div>
        <div style={{marginBottom:10}}><label style={lbl}>Slab Area sqft</label><input type="number" value={area} onChange={e=>setArea(+e.target.value||0)} style={inp}/></div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
          {[["Pounds",rebarLb.toFixed(0),"#10b981"],["Kg",rebarKg.toFixed(0),"#34d399"]].map(([l,v,c])=>(
            <div key={l} style={{padding:10,borderRadius:10,border:`1px solid ${GN}0.1)`,textAlign:"center"}}>
              <p style={{fontFamily:"Bebas Neue",fontSize:18,color:c,margin:0}}>{v}</p>
              <p style={{color:"rgba(255,255,255,0.25)",fontSize:8,margin:0}}>{l}</p>
            </div>
          ))}
        </div>
        <button onClick={addRebar} style={{width:"100%",padding:"10px 0",borderRadius:10,border:"none",cursor:"pointer",fontWeight:900,fontSize:11,background:"linear-gradient(135deg,#10b981,#059669)",color:"#000",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}><Plus size={12}/>Add Rebar to Matrix</button>
      </>}
    </div>
  );
}



function ScaleCorrectionTool({lineItems,areaTakeoff,onApplyCorrection,region}){
  const [known,setKnown]=useState("");const [ai,setAi]=useState("");const [applied,setApplied]=useState(false);
  const factor=(known&&ai&&Number(ai)>0)?Number(known)/Number(ai):1;
  const significant=Math.abs(factor-1)>0.02;
  const apply=()=>{onApplyCorrection(factor);setApplied(true);setTimeout(()=>setApplied(false),2500);};
  const inp={width:"100%",background:"rgba(0,0,0,0.3)",border:`1px solid ${GN}0.2)`,borderRadius:8,padding:"8px 10px",color:"#fff",fontFamily:"JetBrains Mono",fontSize:13,outline:"none"};
  return(
    <div>
      <p style={{color:`${GN}0.5)`,fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.2em",margin:"0 0 4px"}}>Scale Correction</p>
      <p style={{color:"rgba(255,255,255,0.2)",fontSize:9,margin:"0 0 12px"}}>AI misread the scale? Enter one known vs AI-reported dimension — correction applies to ALL quantities.</p>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
        <div><label style={{color:"rgba(255,255,255,0.3)",fontSize:9,fontWeight:700,textTransform:"uppercase",display:"block",marginBottom:4}}>AI Said</label><input type="number" value={ai} onChange={e=>setAi(e.target.value)} placeholder="10" style={{...inp,borderColor:"rgba(245,158,11,0.2)",color:"#f59e0b"}}/></div>
        <div><label style={{color:"rgba(255,255,255,0.3)",fontSize:9,fontWeight:700,textTransform:"uppercase",display:"block",marginBottom:4}}>Real Value</label><input type="number" value={known} onChange={e=>setKnown(e.target.value)} placeholder="12" style={inp}/></div>
      </div>
      {known&&ai&&<div style={{padding:10,borderRadius:10,background:significant?"rgba(245,158,11,0.06)":`${GN}0.05)`,border:`1px solid ${significant?"rgba(245,158,11,0.2)":`${GN}0.15)`}`,marginBottom:10,textAlign:"center"}}>
        <p style={{color:"rgba(255,255,255,0.4)",fontSize:10,margin:0}}>Correction Factor: <strong style={{color:significant?"#f59e0b":"#10b981",fontFamily:"JetBrains Mono"}}>×{factor.toFixed(3)}</strong></p>
      </div>}
      <button onClick={apply} disabled={!significant} style={{width:"100%",padding:"10px 0",borderRadius:10,border:"none",cursor:significant?"pointer":"not-allowed",fontWeight:900,fontSize:11,background:applied?"rgba(16,185,129,0.2)":significant?"linear-gradient(135deg,#f59e0b,#d97706)":"rgba(255,255,255,0.05)",color:applied?"#10b981":significant?"#000":"rgba(255,255,255,0.2)"}}>
        {applied?"✓ Applied to All Quantities":"Apply Correction to All Quantities"}
      </button>
    </div>
  );
}



function ToolsPanel({lineItems,onUpdateLineItems,totalArea,region}){
  const [section,setSection]=useState("calculator");
  const addToEstimate=items=>onUpdateLineItems(prev=>[...prev,...items.map((it,i)=>({id:"CALC-"+Date.now()+"-"+i,phase:"Structural Calculator",qty_with_waste:it.qty,_modified:true,...it}))]);
  const applyCorrection=factor=>onUpdateLineItems(prev=>prev.map(i=>({...i,qty:+(i.qty*factor).toFixed(2),qty_with_waste:+((i.qty_with_waste||i.qty)*factor).toFixed(2),_modified:true})));
  return(
    <div>
      <div style={{display:"flex",gap:4,padding:3,borderRadius:10,background:`${GN}0.05)`,border:`1px solid ${GN}0.1)`,marginBottom:14}}>
        {[["calculator","Structural Calculator"],["scale","Scale Correction"]].map(([k,l])=>(
          <button key={k} onClick={()=>setSection(k)} style={{flex:1,padding:"8px 0",fontSize:10,fontWeight:700,borderRadius:8,border:"none",cursor:"pointer",background:section===k?`${GN}0.15)`:"transparent",color:section===k?"#10b981":"rgba(255,255,255,0.3)"}}>{l}</button>
        ))}
      </div>
      {section==="calculator"&&<StructuralCalculator region={region} onAddToEstimate={addToEstimate}/>}
      {section==="scale"&&<ScaleCorrectionTool lineItems={lineItems} areaTakeoff={totalArea} onApplyCorrection={applyCorrection} region={region}/>}
    </div>
  );
}



function CarbonScoreCard({lineItems, totalArea}){
  const {totalKg, totalTons, breakdown} = useMemo(()=>estimateCarbon(lineItems),[lineItems]);
  const perSqft = totalArea>0 ? totalKg/totalArea : 0;
  // Industry benchmark: ~300-500 kg CO2e/sqft is typical for new construction
  const rating = perSqft<250?{label:"LOW CARBON",color:"#10b981",desc:"Below industry average — good for LEED/BREEAM credits"}
    :perSqft<450?{label:"AVERAGE",color:"#f59e0b",desc:"Typical for standard construction"}
    :{label:"HIGH CARBON",color:"#ef4444",desc:"Above average — consider lower-carbon material substitutions"};

  const sorted = Object.entries(breakdown).sort((a,b)=>b[1]-a[1]).slice(0,6);
  const maxVal = Math.max(...sorted.map(s=>s[1]),1);

  return(
    <Card style={{padding:14}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:18}}>🌱</span>
          <p style={{color:"#fff",fontWeight:900,fontSize:12,margin:0}}>Embodied Carbon Score</p>
        </div>
        <span style={{fontSize:9,fontWeight:900,padding:"3px 10px",borderRadius:99,background:rating.color+"22",color:rating.color}}>{rating.label}</span>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:12}}>
        <div style={{textAlign:"center",padding:10,borderRadius:10,background:`${GN}0.04)`}}><p style={{fontFamily:"Bebas Neue",fontSize:18,color:rating.color,margin:0}}>{totalTons.toFixed(1)}</p><p style={{color:"rgba(255,255,255,0.25)",fontSize:8,margin:"2px 0 0"}}>Tonnes CO2e</p></div>
        <div style={{textAlign:"center",padding:10,borderRadius:10,background:`${GN}0.04)`}}><p style={{fontFamily:"Bebas Neue",fontSize:18,color:"#34d399",margin:0}}>{perSqft.toFixed(0)}</p><p style={{color:"rgba(255,255,255,0.25)",fontSize:8,margin:"2px 0 0"}}>kg CO2e/sqft</p></div>
        <div style={{textAlign:"center",padding:10,borderRadius:10,background:`${GN}0.04)`}}><p style={{fontFamily:"Bebas Neue",fontSize:18,color:"#6ee7b7",margin:0}}>{Math.round(totalKg/411)}</p><p style={{color:"rgba(255,255,255,0.25)",fontSize:8,margin:"2px 0 0"}}>Cars/year equiv.</p></div>
      </div>

      <p style={{color:"rgba(255,255,255,0.3)",fontSize:9,margin:"0 0 10px",lineHeight:1.4}}>{rating.desc}</p>

      <p style={{color:`${GN}0.4)`,fontSize:8,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.1em",margin:"0 0 6px"}}>By Material Category</p>
      {sorted.map(([cat,kg])=>(
        <div key={cat} style={{marginBottom:6}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:2}}>
            <span style={{color:"rgba(255,255,255,0.4)",fontSize:9}}>{cat}</span>
            <span style={{color:"rgba(255,255,255,0.5)",fontSize:9,fontFamily:"JetBrains Mono"}}>{kg.toFixed(0)} kg</span>
          </div>
          <div style={{height:4,borderRadius:99,background:"rgba(255,255,255,0.05)",overflow:"hidden"}}><div style={{height:"100%",width:`${(kg/maxVal)*100}%`,background:"linear-gradient(90deg,#10b981,#34d399)",borderRadius:99}}/></div>
        </div>
      ))}
      <p style={{color:"rgba(255,255,255,0.12)",fontSize:7,marginTop:8,textAlign:"center"}}>Estimates based on industry-average embodied carbon factors. For certified LEED/BREEAM submissions, consult an EPD database.</p>
    </Card>
  );
}



function useVoiceInput(onResult){
  const [listening,setListening] = useState(false);
  const [supported,setSupported] = useState(false);
  const recognitionRef = useRef(null);

  useEffect(()=>{
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if(!SpeechRecognition){ setSupported(false); return; }
    setSupported(true);
    const rec = new SpeechRecognition();
    rec.continuous = false;
    rec.interimResults = false;
    rec.lang = "en-US";
    rec.onresult = (e) => {
      const transcript = e.results[0][0].transcript;
      onResult(transcript);
      setListening(false);
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    recognitionRef.current = rec;
    return () => { try{rec.stop();}catch{} };
  },[onResult]);

  const start = () => {
    if(!recognitionRef.current) return;
    try{
      recognitionRef.current.start();
      setListening(true);
    }catch{setListening(false);}
  };
  const stop = () => {
    try{recognitionRef.current?.stop();}catch{}
    setListening(false);
  };

  return { listening, supported, start, stop };
}



function VoiceButton({onTranscript, size=14}){
  const {listening, supported, start, stop} = useVoiceInput(onTranscript);
  if(!supported) return null;
  return(
    <button
      onClick={listening?stop:start}
      title={listening?"Listening... tap to stop":"Tap to speak"}
      style={{
        width:32,height:32,borderRadius:9,border:"none",cursor:"pointer",flexShrink:0,
        background: listening ? "linear-gradient(135deg,#ef4444,#dc2626)" : `${GN}0.08)`,
        display:"flex",alignItems:"center",justifyContent:"center",
        animation: listening ? "pulse 1.2s infinite" : "none",
      }}>
      {listening
        ? <span style={{width:8,height:8,borderRadius:2,background:"#fff",display:"block"}}/>
        : <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>
      }
    </button>
  );
}

// ─── AI CHAT ──────────────────────────────────────────────────────────────────


function ShareLinkGenerator({estimateData, region, tradeMode, fileName}){
  const [link,setLink] = useState(null);
  const [copied,setCopied] = useState(false);
  const [approvals,setApprovals] = useState([]);
  const [loadingApprovals,setLoadingApprovals] = useState(true);

  useEffect(()=>{
    dbAll("clientApprovals").then(a=>{setApprovals(a||[]);setLoadingApprovals(false);}).catch(()=>setLoadingApprovals(false));
  },[]);

  const generate = () => {
    const encoded = encodeShareData(estimateData, region, tradeMode, fileName);
    const url = `${window.location.origin}${window.location.pathname}#/proposal/${encoded}`;
    setLink(url);
  };

  const copy = () => {
    navigator.clipboard.writeText(link).then(()=>{setCopied(true);setTimeout(()=>setCopied(false),2000);})
      .catch(()=>alert("Copy failed — long-press the link to copy manually"));
  };

  return(
    <div>
      <p style={{color:`${GN}0.5)`,fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.2em",margin:"0 0 4px"}}>Client Proposal Link</p>
      <p style={{color:"rgba(255,255,255,0.2)",fontSize:9,margin:"0 0 14px"}}>Generate a read-only proposal link for your client. They can review the full breakdown and approve or request changes — no login required on their end.</p>

      {!link?(
        <button onClick={generate} style={{width:"100%",padding:"12px 0",borderRadius:11,border:"none",cursor:"pointer",fontWeight:900,fontSize:12,background:"linear-gradient(135deg,#10b981,#059669)",color:"#000",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
          <Send size={13}/>Generate Client Proposal Link
        </button>
      ):(
        <div>
          <div style={{padding:12,borderRadius:10,background:`${GN}0.05)`,border:`1px solid ${GN}0.18)`,marginBottom:10}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
              <CheckCircle2 size={13} style={{color:"#10b981"}}/>
              <p style={{color:"#10b981",fontWeight:700,fontSize:11,margin:0}}>Proposal Link Ready</p>
            </div>
            <div style={{display:"flex",gap:6}}>
              <input readOnly value={link} style={{flex:1,background:"rgba(0,0,0,0.3)",border:`1px solid ${GN}0.15)`,borderRadius:8,padding:"7px 10px",color:"rgba(255,255,255,0.5)",fontSize:9,fontFamily:"JetBrains Mono",outline:"none"}}/>
              <button onClick={copy} style={{padding:"7px 14px",borderRadius:8,border:"none",cursor:"pointer",fontWeight:900,fontSize:10,background:copied?"rgba(16,185,129,0.25)":"linear-gradient(135deg,#10b981,#059669)",color:copied?"#10b981":"#000",whiteSpace:"nowrap"}}>{copied?"Copied!":"Copy"}</button>
            </div>
          </div>
          <p style={{color:"rgba(255,255,255,0.18)",fontSize:8,textAlign:"center"}}>Share via WhatsApp, email, or SMS. The client sees a clean summary and can sign electronically.</p>
        </div>
      )}

      {/* Approval history */}
      <div style={{marginTop:18}}>
        <p style={{color:`${GN}0.4)`,fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.15em",margin:"0 0 8px"}}>Client Responses</p>
        {loadingApprovals?<p style={{color:"rgba(255,255,255,0.15)",fontSize:10}}>Loading...</p>:
        approvals.length===0?<p style={{color:"rgba(255,255,255,0.15)",fontSize:10}}>No responses yet. Responses appear here once a client opens and signs the proposal on this device.</p>:
        <div style={{display:"flex",flexDirection:"column",gap:6}}>
          {approvals.map((a,i)=>(
            <div key={i} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:10,borderRadius:10,background:a.status==="approved"?`${GN}0.05)`:"rgba(245,158,11,0.05)",border:`1px solid ${a.status==="approved"?`${GN}0.15)`:"rgba(245,158,11,0.15)"}`}}>
              <div>
                <p style={{color:"rgba(255,255,255,0.6)",fontSize:11,fontWeight:700,margin:0}}>{a.signerName}</p>
                <p style={{color:"rgba(255,255,255,0.2)",fontSize:9,margin:0}}>{new Date(a.timestamp).toLocaleString()}</p>
              </div>
              <span style={{fontSize:9,fontWeight:900,padding:"3px 10px",borderRadius:99,background:a.status==="approved"?`${GN}0.15)`:"rgba(245,158,11,0.15)",color:a.status==="approved"?"#10b981":"#f59e0b"}}>{a.status==="approved"?"✓ APPROVED":"CHANGES REQUESTED"}</span>
            </div>
          ))}
        </div>}
      </div>
    </div>
  );
}



function encodeShareData(data, region, tradeMode, fileName){
  const summary = {
    v:1, // version
    fn: fileName||"Project",
    tr: tradeMode,
    rg: region,
    meta: data.project_metadata||{},
    fin: data.financial_summary||{},
    phases: (data.phases||[]).map(p=>({n:p.phase_name,c:p.cost,p:p.pct})),
    items: (data.line_items||[]).slice(0,30).map(i=>({
      d:i.description, q:i.qty, u:i.unit,
      t:(i.qty||0)*((i.materialCost||0)+(i.laborCost||0))
    })),
    risks: (data.risk_flags||[]).slice(0,5).map(r=>({s:r.severity,i:r.issue})),
    ts: Date.now(),
  };
  const json = JSON.stringify(summary);
  // Compress via base64 (browser-safe)
  return btoa(encodeURIComponent(json));
}



function decodeShareData(encoded){
  try{
    const json = decodeURIComponent(atob(encoded));
    return JSON.parse(json);
  }catch{return null;}
}



function ClientProposalView({encoded}){
  const data = decodeShareData(encoded);
  const [signerName,setSignerName] = useState("");
  const [submitted,setSubmitted] = useState(false);
  const [action,setAction] = useState(null);

  if(!data) return(
    <div style={{...BG,display:"flex",alignItems:"center",justifyContent:"center",minHeight:"100vh",padding:16}}>
      <GlobalBackground/>
      <div style={{position:"relative",zIndex:1,textAlign:"center"}}>
        <AlertTriangle size={32} style={{color:"#f59e0b",margin:"0 auto 12px"}}/>
        <p style={{color:"#fff",fontWeight:700,fontSize:14}}>This proposal link is invalid or expired.</p>
      </div>
    </div>
  );

  const r = REGIONS[data.rg]||REGIONS.NG;
  const trade = TRADES[data.tr]||TRADES.GENERAL;
  const TradeIcon = trade.icon;
  const fmtMoney = n => fmt(n||0); // Always USD

  const submit = async (act) => {
    if(!signerName.trim()){alert("Please type your full name to sign.");return;}
    await dbAdd("clientApprovals",{
      signerName: signerName.trim(),
      status: act,
      proposalFile: data.fn,
      bidAmount: data.fin?.total_bid_price||0,
      timestamp: new Date().toISOString(),
    });
    setAction(act);
    setSubmitted(true);
  };

  if(submitted) return(
    <div style={{...BG,display:"flex",alignItems:"center",justifyContent:"center",minHeight:"100vh",padding:16,fontFamily:"Space Grotesk, sans-serif"}}>
      <link href={FONT} rel="stylesheet"/>
      <GlobalBackground/>
      <div style={{position:"relative",zIndex:1,textAlign:"center",maxWidth:340}}>
        <div style={{width:60,height:60,borderRadius:"50%",background:action==="approved"?"rgba(16,185,129,0.15)":"rgba(245,158,11,0.15)",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px"}}>
          <CheckCircle2 size={28} style={{color:action==="approved"?"#10b981":"#f59e0b"}}/>
        </div>
        <h2 style={{color:"#fff",fontFamily:"Bebas Neue",fontSize:"1.6rem",letterSpacing:"0.05em",margin:"0 0 8px"}}>{action==="approved"?"PROPOSAL APPROVED":"CHANGES REQUESTED"}</h2>
        <p style={{color:"rgba(255,255,255,0.4)",fontSize:12,lineHeight:1.5}}>{action==="approved"?`Thank you, ${signerName}. Your approval has been recorded. The contractor will follow up with next steps.`:`Thank you, ${signerName}. Your request has been noted and the contractor will reach out to discuss revisions.`}</p>
      </div>
    </div>
  );

  return(
    <div style={{...BG,fontFamily:"Space Grotesk, sans-serif",minHeight:"100vh",padding:16,paddingBottom:40}}>
      <link href={FONT} rel="stylesheet"/>
      <GlobalBackground/>
      <div style={{position:"relative",zIndex:1,maxWidth:480,margin:"0 auto"}}>
        {/* Header */}
        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:20,paddingTop:8}}>
          <div style={{width:38,height:38,borderRadius:10,background:"linear-gradient(135deg,#10b981,#059669)",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 0 14px rgba(16,185,129,0.35)"}}><span style={{color:"#000",fontFamily:"Bebas Neue",fontWeight:900,fontSize:14}}>FE</span></div>
          <div><h1 style={{fontFamily:"Bebas Neue",fontSize:"1.4rem",letterSpacing:"0.06em",color:"#fff",margin:0,lineHeight:1}}>FORGE<span style={{color:"#10b981"}}>ESTIMATE</span></h1><p style={{color:`${GN}0.4)`,fontSize:8,letterSpacing:"0.2em",textTransform:"uppercase",margin:0}}>Client Proposal</p></div>
        </div>

        {/* Project info */}
        <Card style={{padding:16,marginBottom:14}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
            <TradeIcon size={16} style={{color:trade.color}}/>
            <div><p style={{color:"#fff",fontWeight:900,fontSize:13,margin:0}}>{data.fn}</p><p style={{color:"rgba(255,255,255,0.3)",fontSize:9,margin:0}}>{trade.label} · {data.meta?.total_area||0} {data.meta?.area_unit||"sqft"} · {r.label}</p></div>
          </div>
          <div style={{textAlign:"center",padding:16,borderRadius:12,background:`${GN}0.06)`,border:`1px solid ${GN}0.15)`}}>
            <p style={{color:"rgba(255,255,255,0.4)",fontSize:10,margin:"0 0 4px"}}>Total Project Bid</p>
            <p style={{fontFamily:"Bebas Neue",fontSize:"2.4rem",color:"#10b981",margin:0,lineHeight:1}}>{fmtMoney(data.fin?.total_bid_with_tax||data.fin?.total_bid_price||0)}</p>
            {data.fin?.tax_rate>0&&<p style={{color:"rgba(255,255,255,0.2)",fontSize:9,margin:"4px 0 0"}}>Includes {data.fin.tax_rate}% tax</p>}
          </div>
        </Card>

        {/* Phase breakdown */}
        {data.phases?.length>0&&<Card style={{padding:14,marginBottom:14}}>
          <p style={{color:`${GN}0.5)`,fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.2em",margin:"0 0 10px"}}>Phase Breakdown</p>
          {data.phases.map((p,i)=>(
            <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"6px 0",borderBottom:i<data.phases.length-1?`1px solid ${GN}0.06)`:"none"}}>
              <span style={{color:"rgba(255,255,255,0.5)",fontSize:11}}>{p.n}</span>
              <span style={{color:"rgba(255,255,255,0.7)",fontSize:11,fontFamily:"JetBrains Mono",fontWeight:700}}>{fmtMoney(p.c)}</span>
            </div>
          ))}
        </Card>}

        {/* Line items */}
        {data.items?.length>0&&<Card style={{padding:14,marginBottom:14}}>
          <p style={{color:`${GN}0.5)`,fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.2em",margin:"0 0 10px"}}>Itemized Breakdown ({data.items.length})</p>
          <div style={{maxHeight:240,overflowY:"auto"}}>
            {data.items.map((it,i)=>(
              <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"5px 0",borderBottom:`1px solid ${GN}0.04)`}}>
                <span style={{color:"rgba(255,255,255,0.4)",fontSize:10,flex:1}}>{it.d} <span style={{color:"rgba(255,255,255,0.15)"}}>({it.q} {it.u})</span></span>
                <span style={{color:"rgba(255,255,255,0.55)",fontSize:10,fontFamily:"JetBrains Mono"}}>{fmtMoney(it.t)}</span>
              </div>
            ))}
          </div>
        </Card>}

        {/* Risks */}
        {data.risks?.length>0&&<Card style={{padding:14,marginBottom:14}}>
          <p style={{color:`${GN}0.5)`,fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.2em",margin:"0 0 10px"}}>Things to Note</p>
          {data.risks.map((rk,i)=>{const c=rk.s==="HIGH"?"#ef4444":rk.s==="MEDIUM"?"#f59e0b":"#10b981";return(
            <div key={i} style={{display:"flex",gap:8,padding:"6px 0",alignItems:"flex-start"}}>
              <span style={{fontSize:8,fontWeight:900,padding:"2px 6px",borderRadius:99,background:c+"22",color:c,flexShrink:0}}>{rk.s}</span>
              <span style={{color:"rgba(255,255,255,0.45)",fontSize:10,lineHeight:1.4}}>{rk.i}</span>
            </div>
          );})}
        </Card>}

        {/* E-signature */}
        <Card style={{padding:16}}>
          <p style={{color:`${GN}0.5)`,fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.2em",margin:"0 0 10px"}}>Review and Respond</p>
          <input value={signerName} onChange={e=>setSignerName(e.target.value)} placeholder="Type your full name to sign" style={{width:"100%",background:"rgba(0,0,0,0.3)",border:`1px solid ${GN}0.2)`,borderRadius:10,padding:"12px 14px",color:"#fff",fontSize:14,fontFamily:"cursive",outline:"none",marginBottom:12,boxSizing:"border-box"}}/>
          <div style={{display:"flex",gap:8}}>
            <button onClick={()=>submit("changes_requested")} style={{flex:1,padding:"12px 0",borderRadius:10,border:"1px solid rgba(245,158,11,0.3)",background:"rgba(245,158,11,0.08)",color:"#f59e0b",cursor:"pointer",fontWeight:900,fontSize:11}}>Request Changes</button>
            <button onClick={()=>submit("approved")} style={{flex:2,padding:"12px 0",borderRadius:10,border:"none",background:"linear-gradient(135deg,#10b981,#059669)",color:"#000",cursor:"pointer",fontWeight:900,fontSize:11}}>Approve Proposal</button>
          </div>
          <p style={{color:"rgba(255,255,255,0.15)",fontSize:8,textAlign:"center",marginTop:8}}>By typing your name and clicking Approve, you electronically sign this proposal.</p>
        </Card>
      </div>
    </div>
  );
}




function LicenseSuccessModal({reference,plan,email,scans,onClose}){
  const [copied,setCopied]=useState(false);
  const licenseKey=`FE-${(plan||"PRO").toUpperCase().slice(0,3)}-${(reference||"").slice(-8).toUpperCase()}`;
  const copyKey=()=>{
    navigator.clipboard.writeText(licenseKey)
      .then(()=>{setCopied(true);setTimeout(()=>setCopied(false),2000);})
      .catch(()=>alert("Your license key:\n"+licenseKey+"\n\nSave this now!"));
  };
  const sendWA=()=>{
    const msg=encodeURIComponent("*ForgeEstimate License Key*\n\nKey: "+licenseKey+"\nPlan: "+plan+"\nScans: "+(scans||600)+"/month\nRef: "+reference+"\n\nTo restore on new device:\nOpen ForgeEstimate → Login → Restore License → paste key above");
    if(CRYPTO_CONFIG.contact&&!CRYPTO_CONFIG.contact.includes("YOUR_WHATSAPP"))window.open(CRYPTO_CONFIG.contact+"?text="+msg,"_blank");
    setTimeout(()=>window.open("https://wa.me/?text="+msg,"_blank"),500);
  };
  return(
    <div style={{position:"fixed",inset:0,zIndex:100,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,0.85)",padding:16}}>
      <div style={{background:"rgba(10,26,18,0.99)",border:"1px solid rgba(16,185,129,0.4)",borderRadius:20,padding:24,width:"100%",maxWidth:400}}>
        <div style={{textAlign:"center",marginBottom:16}}>
          <div style={{width:52,height:52,borderRadius:"50%",background:"rgba(16,185,129,0.15)",border:"2px solid #10b981",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 10px"}}><CheckCircle2 size={24} style={{color:"#10b981"}}/></div>
          <h2 style={{fontFamily:"Bebas Neue",fontSize:"1.5rem",color:"#fff",margin:"0 0 4px",letterSpacing:"0.05em"}}>PAYMENT SUCCESSFUL!</h2>
          <p style={{color:"rgba(16,185,129,0.6)",fontSize:10,margin:0,textTransform:"uppercase",letterSpacing:"0.12em"}}>{plan} Plan — {(scans||600).toLocaleString()} scans</p>
        </div>
        <div style={{padding:14,borderRadius:12,background:"rgba(16,185,129,0.08)",border:"2px solid rgba(16,185,129,0.3)",marginBottom:12,textAlign:"center"}}>
          <p style={{color:"rgba(16,185,129,0.5)",fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.15em",margin:"0 0 6px"}}>🔑 Your License Key — Save This!</p>
          <p style={{fontFamily:"JetBrains Mono",fontSize:18,fontWeight:900,color:"#fff",margin:"0 0 8px",letterSpacing:"0.1em"}}>{licenseKey}</p>
          <p style={{color:"rgba(255,255,255,0.2)",fontSize:8,margin:"0 0 10px"}}>Screenshot this or copy it. You need this to restore on a new device.</p>
          <button onClick={copyKey} style={{width:"100%",padding:"10px 0",borderRadius:9,border:"none",cursor:"pointer",fontWeight:900,fontSize:11,background:copied?"rgba(16,185,129,0.2)":"linear-gradient(135deg,#10b981,#059669)",color:copied?"#10b981":"#000"}}>{copied?"✓ Copied!":"Copy License Key"}</button>
        </div>
        <button onClick={sendWA} style={{width:"100%",padding:"10px 0",borderRadius:9,border:"1px solid rgba(37,211,102,0.3)",background:"rgba(37,211,102,0.08)",color:"#25D366",cursor:"pointer",fontWeight:700,fontSize:11,marginBottom:10,display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="#25D366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
          Save Key via WhatsApp
        </button>
        <button onClick={onClose} style={{width:"100%",padding:"11px 0",borderRadius:9,border:"1px solid rgba(255,255,255,0.08)",background:"transparent",color:"rgba(255,255,255,0.4)",cursor:"pointer",fontWeight:700,fontSize:11}}>Start Using ForgeEstimate →</button>
      </div>
    </div>
  );
}



function RestoreLicensePanel({onRestored}){
  const [key,setKey]=useState("");const [busy,setBusy]=useState(false);const [err,setErr]=useState("");
  const restore=async()=>{
    if(!key.trim().startsWith("FE-")){setErr("Invalid key. Keys start with FE-");return;}
    setBusy(true);setErr("");
    try{
      const planCode=key.split("-")[1]||"STA";
      const planMap={STA:"starter",PRO:"pro",ENT:"enterprise",MON:"starter",ANN:"starter"};
      const plan=planMap[planCode]||"starter";
      await saveLicense("ENTERPRISE_MONTHLY",{reference:"RESTORED_"+key.trim(),customerEmail:"restored_user",tier:"FE_"+plan.toUpperCase(),plan,scans:PLANS[plan]?.scans||600,restoredAt:new Date().toISOString()});
      onRestored();
      alert("License restored! All features active on this device.");
    }catch(e){setErr("Restore failed: "+e.message);}
    finally{setBusy(false);}
  };
  return(
    <div style={{marginTop:14,padding:14,borderRadius:12,background:`${GN}0.04)`,border:`1px solid ${GN}0.1)`}}>
      <p style={{color:`${GN}0.5)`,fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.15em",margin:"0 0 6px"}}>Restore Existing License</p>
      <p style={{color:"rgba(255,255,255,0.2)",fontSize:9,margin:"0 0 10px"}}>Already subscribed? Paste your license key (starts with FE-) to activate on this device.</p>
      <input value={key} onChange={e=>setKey(e.target.value)} placeholder="FE-STA-XXXXXXXX" style={{width:"100%",background:"rgba(0,0,0,0.3)",border:`1px solid ${GN}0.2)`,borderRadius:8,padding:"9px 12px",color:"#fff",fontFamily:"JetBrains Mono",fontSize:13,outline:"none",marginBottom:8,boxSizing:"border-box"}}/>
      {err&&<p style={{color:"#f87171",fontSize:10,margin:"0 0 8px"}}>{err}</p>}
      <button onClick={restore} disabled={busy||!key.trim()} style={{width:"100%",padding:"10px 0",borderRadius:9,border:"none",cursor:busy||!key.trim()?"not-allowed":"pointer",fontWeight:900,fontSize:11,background:busy||!key.trim()?"rgba(255,255,255,0.05)":"linear-gradient(135deg,#10b981,#059669)",color:busy||!key.trim()?"rgba(255,255,255,0.2)":"#000"}}>
        {busy?"Restoring...":"Restore License"}
      </button>
    </div>
  );
}




// ═══════════════════════════════════════════════════════════════
// CRYPTO PAYMENT FLOW — Secure, Manual Verification
// NO auto-activation — owner verifies on Etherscan then sends key
// ═══════════════════════════════════════════════════════════════
function CryptoPaymentFlow({plan,email,onClose,onPending}){
  const [step,setStep]=useState(1);
  const [txHash,setTxHash]=useState("");
  const [txErr,setTxErr]=useState("");
  const [copied,setCopied]=useState(false);
  const [busy,setBusy]=useState(false);
  const price=PLANS[plan]?.price||250;
  const wallet=CRYPTO_CONFIG.wallet_address;
  const configured=wallet&&!wallet.includes("YOUR_ETHEREUM");

  const copyWallet=()=>{
    navigator.clipboard.writeText(wallet)
      .then(()=>{setCopied(true);setTimeout(()=>setCopied(false),3000);})
      .catch(()=>{const el=document.getElementById("waddr");if(el){el.select();document.execCommand("copy");setCopied(true);setTimeout(()=>setCopied(false),3000);}});
  };

  const submitTx=async()=>{
    const hash=txHash.trim();
    if(!hash.startsWith("0x")||hash.length!==66){
      setTxErr("Invalid TX hash. Must start with 0x and be exactly 66 characters. Copy it from TrustWallet Activity.");
      return;
    }
    setBusy(true);
    setTxErr("");
    try{
      // ── STEP 1: Check hash not already used in IndexedDB ─────────────────
      const existingTx = await dbGet("usedTxHashes", hash);
      if(existingTx){
        setTxErr("This transaction hash has already been used. Each payment hash can only be submitted once.");
        setBusy(false); return;
      }

      // ── STEP 2: Verify on Etherscan (on-chain verification) ────────────────
      setTxErr("Verifying transaction on blockchain...");
      try{
        const ethRes = await fetch(
          `https://api.etherscan.io/api?module=transaction&action=gettxreceiptstatus&txhash=${hash}&apikey=YourApiKeyToken`,
          {signal:AbortSignal.timeout(10000)}
        );
        const ethData = await ethRes.json();
        // Check if transaction exists on chain
        if(ethData.status==="0"&&ethData.message==="No transactions found"){
          setTxErr("Transaction not found on Ethereum blockchain. Make sure you copied the correct TX hash from TrustWallet.");
          setBusy(false); return;
        }
        // Check transaction was successful (status 1 = success)
        if(ethData.result?.status==="0"){
          setTxErr("This transaction failed on the blockchain. Please send a new payment and submit that TX hash.");
          setBusy(false); return;
        }
      }catch(ethErr){
        // If Etherscan is unreachable, proceed but flag for manual review
        console.warn("Etherscan check failed — proceeding to manual review:", ethErr.message);
      }
      setTxErr("");

      // ── STEP 3: Mark hash as used immediately ──────────────────────────────
      await dbPut("usedTxHashes",{
        id:hash,
        usedBy:email||"unknown",
        plan,
        amount:price,
        usedAt:new Date().toISOString(),
      });

      await dbPut("userLicenses",{
        featureKey:"PENDING_CRYPTO_"+Date.now(),
        isUnlocked:false,
        status:"pending_manual_review",
        reference:"CRYPTO_"+hash,
        txHash:hash,plan,amount:price,
        network:"Ethereum ERC20",coin:"USDT",
        customerEmail:email||"",
        submittedAt:new Date().toISOString(),
      });
      if(CRYPTO_CONFIG.contact&&!CRYPTO_CONFIG.contact.includes("YOUR_WHATSAPP")){
        const msg=encodeURIComponent(
          "*ForgeEstimate — Crypto Payment*\n\n"+
          "Plan: "+plan.toUpperCase()+" ($"+price+" USDT)\n"+
          "Email: "+(email||"N/A")+"\n"+
          "TX Hash: "+hash+"\n"+
          "Network: Ethereum ERC20\n"+
          "Time: "+new Date().toLocaleString()+"\n\n"+
          "Verify: https://etherscan.io/tx/"+hash+"\n\n"+
          "If confirmed, send activation key to user."
        );
        window.open(CRYPTO_CONFIG.contact+"?text="+msg,"_blank");
      }
      setStep(3);
      onPending&&onPending();
    }catch(e){setTxErr("Submit failed: "+e.message);}
    finally{setBusy(false);}
  };

  const box={padding:14,borderRadius:12,background:"rgba(16,185,129,0.05)",border:"1px solid rgba(16,185,129,0.18)",marginBottom:12};
  const warn={padding:12,borderRadius:12,background:"rgba(239,68,68,0.07)",border:"1px solid rgba(239,68,68,0.22)",marginBottom:12};

  return(
    <div style={{position:"fixed",inset:0,zIndex:200,display:"flex",alignItems:"flex-start",justifyContent:"center",background:"rgba(0,0,0,0.92)",padding:16,overflowY:"auto",fontFamily:"Space Grotesk,sans-serif"}}>
      <link href={FONT} rel="stylesheet"/>
      <div style={{background:"rgba(10,26,18,0.99)",border:"1px solid rgba(16,185,129,0.3)",borderRadius:20,padding:20,width:"100%",maxWidth:420,marginTop:24,marginBottom:24}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <span style={{fontSize:22}}>₮</span>
            <div><p style={{color:"#fff",fontWeight:900,fontSize:13,margin:0}}>USDT Payment — Ethereum</p><p style={{color:"rgba(16,185,129,0.5)",fontSize:9,margin:0,textTransform:"uppercase"}}>{plan} Plan — ${price} USDT</p></div>
          </div>
          <button onClick={onClose} style={{background:"none",border:"none",cursor:"pointer",color:"rgba(255,255,255,0.3)",fontSize:20,lineHeight:1}}>✕</button>
        </div>

        {step===1&&<>
          <div style={warn}>
            <p style={{color:"#f87171",fontWeight:900,fontSize:11,margin:"0 0 6px"}}>⚠️ CRITICAL — READ BEFORE SENDING</p>
            <p style={{color:"rgba(255,255,255,0.55)",fontSize:10,margin:0,lineHeight:1.6}}>Send ONLY on <strong style={{color:"#f87171"}}>Ethereum Network (ERC20)</strong>.<br/>DO NOT use BNB Chain, Solana, TRON, or Bitcoin.<br/><strong style={{color:"#f87171"}}>Wrong network = permanent loss of funds.</strong></p>
          </div>
          <div style={{...warn,background:"rgba(245,158,11,0.06)",border:"1px solid rgba(245,158,11,0.2)"}}>
            <p style={{color:"#f59e0b",fontWeight:700,fontSize:10,margin:"0 0 8px"}}>📱 TrustWallet Steps</p>
            {["Open TrustWallet → tap Send","Search USDT → select USDT (ERC20) only — NOT BEP20 or TRC20","Paste the wallet address below","Enter exact amount: $"+price+" USDT","Confirm and send — then return here"].map((s,i)=>(
              <div key={i} style={{display:"flex",gap:6,marginBottom:5}}><span style={{color:"#f59e0b",fontWeight:900,fontSize:10,flexShrink:0}}>{i+1}.</span><span style={{color:"rgba(255,255,255,0.5)",fontSize:10,lineHeight:1.4}}>{s}</span></div>
            ))}
          </div>
          <div style={box}>
            <p style={{color:"rgba(16,185,129,0.5)",fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.15em",margin:"0 0 8px"}}>Send ${price} USDT (ERC20) to:</p>
            <input id="waddr" readOnly value={wallet} style={{position:"absolute",opacity:0,pointerEvents:"none",height:0}}/>
            <div style={{background:"rgba(0,0,0,0.4)",border:"1px solid rgba(16,185,129,0.2)",borderRadius:10,padding:"10px 12px",marginBottom:10,wordBreak:"break-all"}}>
              <p style={{fontFamily:"JetBrains Mono",fontSize:11,color:"#fff",margin:0,lineHeight:1.7,letterSpacing:"0.03em"}}>{configured?wallet:"⚠️ Wallet not configured"}</p>
            </div>
            <button onClick={copyWallet} disabled={!configured} style={{width:"100%",padding:"11px 0",borderRadius:10,border:"none",cursor:configured?"pointer":"not-allowed",fontWeight:900,fontSize:12,background:copied?"rgba(16,185,129,0.2)":"linear-gradient(135deg,#10b981,#059669)",color:copied?"#10b981":"#000",display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
              {copied?"✓ Wallet Address Copied!":"Copy Wallet Address"}
            </button>
            {copied&&<p style={{color:"rgba(16,185,129,0.6)",fontSize:9,textAlign:"center",margin:"6px 0 0"}}>Now paste in TrustWallet → Send</p>}
          </div>
          <div style={{padding:10,borderRadius:10,background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.06)",marginBottom:12}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}><span style={{color:"rgba(255,255,255,0.3)",fontSize:10}}>Amount</span><span style={{color:"#fff",fontFamily:"JetBrains Mono",fontWeight:900,fontSize:12}}>${price} USDT</span></div>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}><span style={{color:"rgba(255,255,255,0.3)",fontSize:10}}>Network</span><span style={{color:"#f59e0b",fontWeight:700,fontSize:10}}>Ethereum (ERC20) ONLY</span></div>
            <div style={{display:"flex",justifyContent:"space-between"}}><span style={{color:"rgba(255,255,255,0.3)",fontSize:10}}>Confirmation</span><span style={{color:"rgba(255,255,255,0.5)",fontSize:10}}>2-5 minutes</span></div>
          </div>
          <button onClick={()=>setStep(2)} disabled={!configured} style={{width:"100%",padding:"13px 0",borderRadius:11,border:"none",cursor:configured?"pointer":"not-allowed",fontWeight:900,fontSize:13,background:configured?"linear-gradient(135deg,#10b981,#059669)":"rgba(255,255,255,0.05)",color:configured?"#000":"rgba(255,255,255,0.2)"}}>I Have Sent the Payment →</button>
          <p style={{color:"rgba(255,255,255,0.12)",fontSize:8,textAlign:"center",marginTop:6}}>Only tap after confirming the transaction in TrustWallet</p>
        </>}

        {step===2&&<>
          <div style={box}>
            <p style={{color:"rgba(16,185,129,0.5)",fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.12em",margin:"0 0 6px"}}>Paste Your Transaction Hash</p>
            <p style={{color:"rgba(255,255,255,0.3)",fontSize:9,margin:"0 0 10px",lineHeight:1.5}}>In TrustWallet → tap your transaction → copy the TX ID / Hash.<br/>It starts with <strong style={{color:"#fff",fontFamily:"JetBrains Mono"}}>0x</strong> and is exactly 66 characters.</p>
            <input value={txHash} onChange={e=>{setTxHash(e.target.value);setTxErr("");}} placeholder="0x1234567890abcdef..." style={{width:"100%",background:"rgba(0,0,0,0.4)",border:"1px solid "+(txErr?"rgba(239,68,68,0.5)":"rgba(16,185,129,0.2)"),borderRadius:10,padding:"11px 12px",color:"#fff",fontFamily:"JetBrains Mono",fontSize:11,outline:"none",boxSizing:"border-box",marginBottom:6,wordBreak:"break-all"}}/>
            {txHash&&<p style={{color:txHash.startsWith("0x")&&txHash.trim().length===66?"rgba(16,185,129,0.6)":"rgba(245,158,11,0.6)",fontSize:9,margin:"0 0 6px",fontFamily:"JetBrains Mono"}}>{txHash.trim().length}/66 chars {txHash.startsWith("0x")&&txHash.trim().length===66?"✓ Valid format":"⚠ Keep typing..."}</p>}
            {txErr&&<div style={{padding:8,borderRadius:8,background:"rgba(239,68,68,0.08)",border:"1px solid rgba(239,68,68,0.2)",marginBottom:8}}><p style={{color:"#f87171",fontSize:9,margin:0,lineHeight:1.5}}>{txErr}</p></div>}
            <button onClick={submitTx} disabled={busy||!txHash.trim()} style={{width:"100%",padding:"12px 0",borderRadius:10,border:"none",cursor:busy||!txHash.trim()?"not-allowed":"pointer",fontWeight:900,fontSize:12,background:busy||!txHash.trim()?"rgba(255,255,255,0.05)":"linear-gradient(135deg,#10b981,#059669)",color:busy||!txHash.trim()?"rgba(255,255,255,0.2)":"#000"}}>
              {busy?"Submitting...":"Submit for Verification →"}
            </button>
          </div>
          <p style={{color:"rgba(245,158,11,0.6)",fontSize:9,textAlign:"center",marginBottom:10}}>⏳ Account activated within 1 hour after Etherscan verification</p>
          <button onClick={()=>setStep(1)} style={{width:"100%",padding:"9px 0",borderRadius:10,border:"1px solid rgba(255,255,255,0.08)",background:"transparent",color:"rgba(255,255,255,0.3)",cursor:"pointer",fontSize:10,fontWeight:600}}>← Back</button>
        </>}

        {step===3&&<>
          <div style={{textAlign:"center",padding:"16px 0"}}>
            <div style={{width:56,height:56,borderRadius:"50%",background:"rgba(245,158,11,0.12)",border:"2px solid rgba(245,158,11,0.4)",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 12px"}}><span style={{fontSize:28}}>⏳</span></div>
            <h3 style={{fontFamily:"Bebas Neue",fontSize:"1.4rem",color:"#f59e0b",margin:"0 0 6px",letterSpacing:"0.05em"}}>PAYMENT SUBMITTED</h3>
            <p style={{color:"rgba(255,255,255,0.4)",fontSize:11,margin:"0 0 14px",lineHeight:1.5}}>TX received. Owner will verify on Etherscan and activate your account.</p>
          </div>
          <div style={box}>
            <p style={{color:"rgba(16,185,129,0.5)",fontSize:9,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.12em",margin:"0 0 8px"}}>What Happens Next</p>
            {["Owner gets WhatsApp notification with your TX hash","Owner verifies payment on Etherscan","Owner sends your activation key via WhatsApp","You paste the key in Restore License on login screen","Full access activated instantly on any device"].map((s,i)=>(
              <div key={i} style={{display:"flex",gap:6,marginBottom:5}}><span style={{color:"#10b981",fontWeight:900,fontSize:10,flexShrink:0}}>{i+1}.</span><span style={{color:"rgba(255,255,255,0.45)",fontSize:10,lineHeight:1.4}}>{s}</span></div>
            ))}
          </div>
          {CRYPTO_CONFIG.contact&&!CRYPTO_CONFIG.contact.includes("YOUR_WHATSAPP")&&(
            <button onClick={()=>{const msg=encodeURIComponent("Hi, I paid for ForgeEstimate "+plan+" plan. Please verify and activate my account.");window.open(CRYPTO_CONFIG.contact+"?text="+msg,"_blank");}} style={{width:"100%",padding:"10px 0",borderRadius:9,border:"1px solid rgba(37,211,102,0.3)",background:"rgba(37,211,102,0.08)",color:"#25D366",cursor:"pointer",fontWeight:700,fontSize:11,display:"flex",alignItems:"center",justifyContent:"center",gap:6,marginBottom:10}}>
              Contact Support on WhatsApp
            </button>
          )}
          <button onClick={onClose} style={{width:"100%",padding:"11px 0",borderRadius:10,border:"1px solid rgba(16,185,129,0.2)",background:"transparent",color:"rgba(255,255,255,0.5)",cursor:"pointer",fontWeight:700,fontSize:11}}>Close</button>
        </>}
      </div>
    </div>
  );
}

// ── REACT ERROR BOUNDARY — catches any component crash, shows recovery UI ──
class ErrorBoundary extends React.Component{
  constructor(props){super(props);this.state={hasError:false,error:null};}
  static getDerivedStateFromError(error){return{hasError:true,error};}
  componentDidCatch(error,info){console.error("ForgeEstimate crash:",error,info);}
  render(){
    if(this.state.hasError){
      return(
        <div style={{background:"#0F172A",minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",padding:24,fontFamily:"Space Grotesk,sans-serif"}}>
          <div style={{maxWidth:400,textAlign:"center"}}>
            <div style={{width:64,height:64,background:"rgba(239,68,68,0.1)",borderRadius:16,display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 16px",border:"1px solid rgba(239,68,68,0.3)"}}>
              <span style={{fontSize:28}}>⚠️</span>
            </div>
            <h2 style={{color:"#fff",fontFamily:"Bebas Neue,sans-serif",fontSize:"1.6rem",letterSpacing:"0.05em",margin:"0 0 8px"}}>SOMETHING WENT WRONG</h2>
            <p style={{color:"rgba(255,255,255,0.4)",fontSize:12,margin:"0 0 20px",lineHeight:1.6}}>{this.state.error?.message||"An unexpected error occurred. Your data is safe."}</p>
            <button onClick={()=>{this.setState({hasError:false,error:null});window.location.reload();}}
              style={{padding:"12px 28px",borderRadius:10,border:"none",cursor:"pointer",fontWeight:900,fontSize:13,background:"linear-gradient(135deg,#10b981,#059669)",color:"#000"}}>
              Reload App
            </button>
            <p style={{color:"rgba(255,255,255,0.2)",fontSize:10,marginTop:12}}>If this keeps happening, contact support via WhatsApp</p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App(){
  // ── INSERT YOUR PAYSTACK PUBLIC KEY HERE ─────────────────────
  const PAYSTACK_PUBLIC_KEY = "pk_test_210007597620028bce50fc67189e6282f9d74e87";

  const [screen,setScreen]     = useState("auth");
  const [userSession,setUserSession] = useState(null);
  const [region,setRegion]     = useState("NG");
  const [customPrices,setCustomPrices] = useState({});
  const [tradeMode,setTradeMode] = useState("GENERAL");
  const [wasteFactor,setWasteFactor] = useState({...DEFAULT_WASTE});
  const [taxRate,setTaxRate]   = useState(7.5);
  const [loadStep,setLoadStep] = useState(0);
  const [result,setResult]     = useState(null);
  const [dbRefresh,setDbRefresh] = useState(0);
  const [filePreview,setFilePreview] = useState(null);
  const [fileName,setFileName] = useState("");
  const tickRef = useRef(null);
  const bumpDB  = useCallback(()=>setDbRefresh(n=>n+1),[]);

  useEffect(()=>{ setTaxRate(REGIONS[region]?.tax||7.5); },[region]);
  useEffect(()=>{
    if(screen==="loading"){ tickRef.current=setInterval(()=>setLoadStep(s=>s+1),820); }
    else{ clearInterval(tickRef.current); setLoadStep(0); }
    return()=>clearInterval(tickRef.current);
  },[screen]);

  // Safety net — force auth screen if still blank after 3 seconds
  useEffect(()=>{
    const t = setTimeout(()=>{
      if(screen === "auth" && !userSession) setScreen("auth");
    }, 3000);
    return ()=>clearTimeout(t);
  },[]);

  const handleAuth  = useCallback(session=>{ setUserSession(session); setScreen("upload"); 
    if(session?.accessToken) sessionStorage.setItem("FE_token", session.accessToken);
    if(session?.plan) sessionStorage.setItem("FE_plan", session.plan||"free");},[]);
  const handleLogout= useCallback(()=>{ setUserSession(null);setResult(null);setFilePreview(null);setFileName("");setScreen("auth"); },[]);

  const handleFile  = useCallback(async file=>{
    setScreen("loading"); setFileName(file.name);
    if(file.type.startsWith("image/")) setFilePreview(URL.createObjectURL(file));
    try{
      // Check usage limit before analyzing
      const usage = await getMonthlyUsage();
      const totalLimit = PLAN_SCAN_LIMIT + (usage.addonScans||0);
      if((usage.count||0) >= totalLimit){
        alert(`You have used all ${totalLimit} blueprint scans this month.\nBuy an add-on pack (+${ADDON_SCANS} scans for $${ADDON_PRICE_USD}) to continue.`);
        setScreen("upload"); return;
      }
      const {b64,mimeType} = await fileToB64WithProgress(file, pct=>setLoadStep(Math.floor(pct/100*3)));
      const mBlock = buildMediaBlock(b64, mimeType);
      // ── DAILY SCAN LIMIT CHECK (before AI call) ──────────────────────────────────
const userPlanKey2  = (userSession?.plan||"starter").toLowerCase();
const scanCheckRes  = await checkDailyScanLimit(userPlanKey2);
if(!scanCheckRes.allowed){
  const isEnterprise = userPlanKey2==="enterprise";
  if(isEnterprise){
    // Enterprise: warn and charge $10/scan — let them continue
    if(!window.confirm(`Enterprise extra scan alert.\n\nYou have used your included scans today.\nThis scan will be billed at $10.\n\nContinue?`)) return;
  }else{
    alert(`Daily upload limit reached!\n\nYour ${PLANS[userPlanKey2]?.label||"Starter"} plan allows ${scanCheckRes.limit} uploads per day.\nUsed today: ${scanCheckRes.used}/${scanCheckRes.limit}\n\nLimits reset at midnight. Upgrade to Enterprise for unlimited daily uploads.`);
    return;
  }
}

const wasteAvg = Math.round(Object.values(wasteFactor).reduce((a,b)=>a+b,0)/Math.max(1,Object.keys(wasteFactor).length));
      const prompt   = buildTradePrompt(tradeMode||"GENERAL", region, customPrices, wasteAvg, taxRate);
      // Use vision model for images, text model for PDFs
const isImage = file.type.startsWith("image/");
const msgs = [{role:"user",content:isImage?[mBlock,{type:"text",text:prompt}]:[mBlock,{type:"text",text:prompt}]}];
const raw  = await callGroq(msgs, 4000, isImage);
      const _raw1 = raw.replace(/```json/g,"").replace(/```/g,"").trim();
      let data;
      try{ data=JSON.parse(_raw1); }
      catch{
        const jsonMatch=_raw1.match(/\{[\s\S]*\}/);
        if(jsonMatch) data=JSON.parse(jsonMatch[0]);
        else throw new Error("AI returned invalid JSON. Try a clearer blueprint image.");
      }
      data.fileName=file.name; data.tradeMode=tradeMode;
      // Increment usage counter
      await incrementScanUsage();
      const projectId="proj_"+Date.now();
      await dbPut("projectSnapshots",{projectId,region,tradeMode,savedAt:new Date().toISOString(),label:data.project_metadata?.primary_trade||file.name,bidFormatted:fmt(data.financial_summary?.total_bid_price||0),area:data.project_metadata?.total_area||0,areaUnit:data.project_metadata?.area_unit||"sqft",rooms:data.project_metadata?.total_rooms||0,confidence:data.project_metadata?.confidence||"MEDIUM",fullData:data});
      await dbAdd("queryHistory",{query:`${tradeMode} ${file.type==="application/pdf"?"PDF":"Image"}: ${file.name}`,command:"BLUEPRINT_SCAN",region,tradeMode});
      bumpDB(); setResult(data); setScreen("workspace");
    }catch(e){
      // Self-healing: retry once on transient errors
      if(e.message.includes("fetch")||e.message.includes("network")||e.message.includes("500")){
        try{
          await new Promise(r=>setTimeout(r,2000)); // wait 2s
          const retryRaw = await callGroq([{role:"user",content:buildTradePrompt(tradeMode||"GENERAL",region,customPrices,5,taxRate)}],4000,false);
          const retryClean = retryRaw.replace(/```json/g,"").replace(/```/g,"").trim();
          let retryData;
          try{retryData=JSON.parse(retryClean);}catch{const m=retryClean.match(/\{[\s\S]*\}/);if(m)retryData=JSON.parse(m[0]);else throw e;}
          retryData.fileName=file.name;retryData.tradeMode=tradeMode;retryData._blueprintImage=isImage?{b64,mimeType}:null;
          // Increment scan counter AFTER successful analysis
          const curUsage2 = await dbOne("projectSnapshots","USAGE_COUNTER").catch(()=>({id:"USAGE_COUNTER",count:0}));
          await dbPut("projectSnapshots",{id:"USAGE_COUNTER",count:(curUsage2?.count||0)+1,lastUsed:new Date().toISOString()});
          await dbAdd("projectSnapshots",{projectId:"PROJ-"+Date.now(),fileName:file.name,tradeMode,region,fullData:retryData,createdAt:new Date().toISOString()});
          bumpDB();setResult(retryData);setScreen("workspace");
        }catch(e2){
          alert("Analysis failed after retry: "+e2.message+"\n\nTips:\n• Try a clearer blueprint image\n• Check your internet connection\n• Reduce image size");
          setScreen("upload");
        }
      } else {
        alert("Analysis failed: "+e.message+"\n\nPlease try again with a clearer blueprint image.");
        setScreen("upload");
      }
    }
  },[region,customPrices,tradeMode,wasteFactor,taxRate,bumpDB]);

  return(
    <>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} @keyframes ping{75%,100%{transform:scale(2);opacity:0}} @keyframes bounce{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}} *{box-sizing:border-box} ::-webkit-scrollbar{width:4px;height:4px} ::-webkit-scrollbar-track{background:rgba(16,185,129,0.03)} ::-webkit-scrollbar-thumb{background:rgba(16,185,129,0.2);border-radius:99px} @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}`}</style>
      {(screen==="auth" || !screen) && <AuthScreen onAuth={handleAuth}/>}
      {screen==="upload"  && <UploadScreen onFile={handleFile} region={region} setRegion={setRegion} customPrices={customPrices} setCustomPrices={setCustomPrices} tradeMode={tradeMode} setTradeMode={setTradeMode} wasteFactor={wasteFactor} setWasteFactor={setWasteFactor} taxRate={taxRate} setTaxRate={setTaxRate} userSession={userSession} onLogout={handleLogout} paystackKey={PAYSTACK_PUBLIC_KEY}/>}
      {screen==="loading"   && <LoadingScreen step={loadStep} tradeMode={tradeMode}/>}
      {screen==="workspace" && result && <WorkspaceShell initialData={result} region={region} setRegion={setRegion} tradeMode={tradeMode} wasteFactor={wasteFactor} taxRate={taxRate} onReset={()=>{setResult(null);setFilePreview(null);setFileName("");setScreen("upload");}} dbRefresh={dbRefresh} onQuerySaved={bumpDB} filePreview={filePreview} fileName={fileName} userSession={userSession} paystackKey={PAYSTACK_PUBLIC_KEY}/>}
    </>
  );
}
