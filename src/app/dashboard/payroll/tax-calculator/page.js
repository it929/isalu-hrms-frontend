"use client";

import { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { 
  Calculator, 
  TrendingUp, 
  Percent, 
  ShieldCheck, 
  Printer, 
  Copy, 
  Check, 
  Search, 
  Layers, 
  Sparkles, 
  Info, 
  CheckCircle2, 
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Landmark,
  Zap,
  CalendarDays,
  FileCheck
} from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts';
import NairaSign from '@/components/ui/NairaSign';
import styles from './page.module.css';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api/nextjs';

function getUserId() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('hrms_user');
    if (raw) return JSON.parse(raw)?.id ?? null;
  } catch { /* ignore */ }
  return null;
}

function buildHeaders() {
  const uid = getUserId();
  return uid ? { 'X-User-Id': uid } : {};
}

function fmt(n) {
  const num = parseFloat(n);
  if (isNaN(num)) return '0.00';
  return num.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Preset Nigerian Salary Benchmarks
const PRESETS = [
  { label: '₦70k Min. Wage', monthlyGross: 70000 },
  { label: '₦150k Junior', monthlyGross: 150000 },
  { label: '₦350k Officer', monthlyGross: 350000 },
  { label: '₦750k Senior', monthlyGross: 750000 },
  { label: '₦1.5M Manager', monthlyGross: 1500000 },
  { label: '₦3.0M Director', monthlyGross: 3000000 },
  { label: '₦5.0M Exec', monthlyGross: 5000000 },
];

export default function NigeriaTaxCalculatorPage() {
  // Calculation Frequency & Input Mode
  const [period, setPeriod] = useState('monthly'); // 'monthly' | 'annual'
  const [inputMode, setInputMode] = useState('quick'); // 'quick' | 'itemized'

  // Quick Mode Inputs
  const [quickGross, setQuickGross] = useState(350000);

  // Itemized Compensation Inputs (Monthly amounts)
  const [basic, setBasic] = useState(140000);
  const [housing, setHousing] = useState(70000);
  const [transport, setTransport] = useState(52500);
  const [medical, setMedical] = useState(35000);
  const [utility, setUtility] = useState(26250);
  const [meal, setMeal] = useState(17500);
  const [otherAllowances, setOtherAllowances] = useState(8750);

  // Deductions & Relief Settings
  const [pensionActive, setPensionActive] = useState(true);
  const [pensionRate, setPensionRate] = useState(8); // 8%
  const [nhfActive, setNhfActive] = useState(false);
  const [nhfRate, setNhfRate] = useState(2.5); // 2.5%
  const [nhisActive, setNhisActive] = useState(false);
  const [nhisAmount, setNhisAmount] = useState(0); // Monthly NHIS
  const [lifeAssurance, setLifeAssurance] = useState(0); // Monthly Life Assurance
  const [showDeductionSettings, setShowDeductionSettings] = useState(true);

  // Staff Autocomplete Data
  const [staffList, setStaffList] = useState([]);
  const [staffSearch, setStaffSearch] = useState('');
  const [showStaffDropdown, setShowStaffDropdown] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState(null);
  const dropdownRef = useRef(null);

  // UI States
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Fetch Staff List for quick structure loading
  useEffect(() => {
    async function loadStaff() {
      try {
        const res = await axios.get(`${API_BASE}/payroll/salary-structures/staff`, { headers: buildHeaders() });
        if (res.data.status === 'success') {
          setStaffList(res.data.data || []);
        }
      } catch (e) {
        // Silent fallback
      }
    }
    loadStaff();
  }, []);

  // Dropdown outside click handler
  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowStaffDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Load staff structure when clicked
  const handleSelectStaff = async (staff) => {
    setSelectedStaff(staff);
    setStaffSearch(staff.label || `${staff.name} (${staff.id})`);
    setShowStaffDropdown(false);

    try {
      // Fetch staff salary structure & declared salary
      const res = await axios.get(`${API_BASE}/payroll/salary-structures/${staff.id}`, { headers: buildHeaders() });
      if (res.data.status === 'success' && res.data.data) {
        const s = res.data.data;
        setInputMode('itemized');
        setBasic(parseFloat(s.basic || 0));
        setHousing(parseFloat(s.housing || 0));
        setTransport(parseFloat(s.transport || 0));
        setMedical(parseFloat(s.medical || 0));
        setUtility(parseFloat(s.utility || 0));
        setMeal(parseFloat(s.meal || 0));
        setOtherAllowances(parseFloat(s.other || 0));
        if (s.pension_active !== undefined) setPensionActive(Boolean(s.pension_active));
        showToast(`Loaded salary breakdown for ${staff.name}`);
      } else {
        // If no explicit structure, check declared salary
        const decRes = await axios.get(`${API_BASE}/payroll/declare-salary`, { headers: buildHeaders() });
        if (decRes.data.status === 'success') {
          const rec = (decRes.data.data || []).find(r => r.staffId === staff.id);
          if (rec && rec.declare_salary) {
            setInputMode('quick');
            setQuickGross(parseFloat(rec.declare_salary));
            showToast(`Loaded declared salary for ${staff.name}`);
          }
        }
      }
    } catch (e) {
      showToast(`Using existing values for ${staff.name}`);
    }
  };

  const handleClearStaff = () => {
    setSelectedStaff(null);
    setStaffSearch('');
  };

  // --- CALCULATION ENGINE (NIGERIA NEW TAX REFORM LAW) ---
  const calculations = useMemo(() => {
    // 1. Determine Monthly Gross
    let monthlyGross = 0;
    let pensionableMonthlyBase = 0;

    if (inputMode === 'quick') {
      monthlyGross = period === 'monthly' ? parseFloat(quickGross || 0) : parseFloat(quickGross || 0) / 12;
      pensionableMonthlyBase = monthlyGross * 0.5; // Standard 50% proxy when itemized components not separated
    } else {
      const b = parseFloat(basic || 0);
      const h = parseFloat(housing || 0);
      const t = parseFloat(transport || 0);
      const m = parseFloat(medical || 0);
      const u = parseFloat(utility || 0);
      const me = parseFloat(meal || 0);
      const o = parseFloat(otherAllowances || 0);

      monthlyGross = b + h + t + m + u + me + o;
      pensionableMonthlyBase = b + h + t; // Statutory pension base = Basic + Housing + Transport
    }

    const annualGross = monthlyGross * 12;

    // 2. Allowable Statutory Deductions & Reliefs
    const monthlyPension = pensionActive ? pensionableMonthlyBase * (parseFloat(pensionRate || 0) / 100) : 0;
    const annualPension = monthlyPension * 12;

    const monthlyNhf = nhfActive ? (inputMode === 'itemized' ? parseFloat(basic || 0) : monthlyGross * 0.4) * (parseFloat(nhfRate || 0) / 100) : 0;
    const annualNhf = monthlyNhf * 12;

    const monthlyNhis = nhisActive ? parseFloat(nhisAmount || 0) : 0;
    const annualNhis = monthlyNhis * 12;

    const monthlyLife = parseFloat(lifeAssurance || 0);
    const annualLife = monthlyLife * 12;

    const totalMonthlyStatutoryRelief = monthlyPension + monthlyNhf + monthlyNhis + monthlyLife;
    const totalAnnualStatutoryRelief = annualPension + annualNhf + annualNhis + annualLife;

    // 3. Taxable Income Calculation
    // Taxable Income = Annual Gross - Allowable Statutory Deductions
    const newAnnualTaxable = Math.max(0, annualGross - totalAnnualStatutoryRelief);

    // 4. Progressive Tax Bands (2025/2026 Tax Reform Law)
    const newBandsBreakdown = [
      { name: 'First ₦800,000 (Tax Free)', range: '₦0 – ₦800,000', cap: 800000, rate: 0, class: styles.rate0, taxableInBand: 0, taxAccrued: 0 },
      { name: 'Next ₦2,200,000', range: '₦800,001 – ₦3,000,000', cap: 2200000, rate: 0.15, class: styles.rate15, taxableInBand: 0, taxAccrued: 0 },
      { name: 'Next ₦9,000,000', range: '₦3,000,001 – ₦12,000,000', cap: 9000000, rate: 0.18, class: styles.rate18, taxableInBand: 0, taxAccrued: 0 },
      { name: 'Next ₦13,000,000', range: '₦12,000,001 – ₦25,000,000', cap: 13000000, rate: 0.21, class: styles.rate21, taxableInBand: 0, taxAccrued: 0 },
      { name: 'Next ₦25,000,000', range: '₦25,000,001 – ₦50,000,000', cap: 25000000, rate: 0.23, class: styles.rate23, taxableInBand: 0, taxAccrued: 0 },
      { name: 'Above ₦50,000,000', range: 'Over ₦50,000,000', cap: Infinity, rate: 0.25, class: styles.rate25, taxableInBand: 0, taxAccrued: 0 },
    ];

    let remainingTaxable = newAnnualTaxable;
    let newAnnualTax = 0;

    for (let i = 0; i < newBandsBreakdown.length; i++) {
      if (remainingTaxable <= 0) break;
      const band = newBandsBreakdown[i];
      const chunk = Math.min(remainingTaxable, band.cap);
      const tax = chunk * band.rate;
      band.taxableInBand = chunk;
      band.taxAccrued = tax;
      newAnnualTax += tax;
      remainingTaxable -= chunk;
    }

    const newMonthlyTax = newAnnualTax / 12;
    const totalMonthlyDeductions = newMonthlyTax + totalMonthlyStatutoryRelief;
    const totalAnnualDeductions = totalMonthlyDeductions * 12;

    const newMonthlyNetPay = monthlyGross - totalMonthlyDeductions;
    const newAnnualNetPay = newMonthlyNetPay * 12;
    const newEffectiveTaxRate = annualGross > 0 ? (newAnnualTax / annualGross) * 100 : 0;

    return {
      monthlyGross,
      annualGross,
      monthlyPension,
      annualPension,
      monthlyNhf,
      annualNhf,
      monthlyNhis,
      annualNhis,
      monthlyLife,
      annualLife,
      totalMonthlyStatutoryRelief,
      totalAnnualStatutoryRelief,
      totalMonthlyDeductions,
      totalAnnualDeductions,

      // Itemized values (if in itemized mode)
      itemized: {
        basic: parseFloat(basic || 0),
        housing: parseFloat(housing || 0),
        transport: parseFloat(transport || 0),
        medical: parseFloat(medical || 0),
        utility: parseFloat(utility || 0),
        meal: parseFloat(meal || 0),
        other: parseFloat(otherAllowances || 0),
      },

      // New Tax Law Results
      newAnnualTaxable,
      newAnnualTax,
      newMonthlyTax,
      newMonthlyNetPay,
      newAnnualNetPay,
      newEffectiveTaxRate,
      newBandsBreakdown,
    };
  }, [
    period,
    inputMode,
    quickGross,
    basic,
    housing,
    transport,
    medical,
    utility,
    meal,
    otherAllowances,
    pensionActive,
    pensionRate,
    nhfActive,
    nhfRate,
    nhisActive,
    nhisAmount,
    lifeAssurance
  ]);

  // Chart data for visual salary allocation
  const chartData = useMemo(() => [
    { name: 'Net Take-Home', amount: calculations.newMonthlyNetPay, color: '#10b981' },
    { name: 'PAYE Tax (New Law)', amount: calculations.newMonthlyTax, color: '#ef4444' },
    { name: 'Pension (8%)', amount: calculations.monthlyPension, color: '#3b82f6' },
    { name: 'Other Allowable Deductions', amount: calculations.totalMonthlyStatutoryRelief - calculations.monthlyPension, color: '#f59e0b' },
  ].filter(d => d.amount > 0), [calculations]);

  // Copy Summary to Clipboard
  const handleCopySummary = () => {
    const text = `
NIGERIA NEW TAX LAW COMPUTATION STATEMENT (Isalu HRMS)
--------------------------------------------------------
Staff Name / ID: ${selectedStaff ? selectedStaff.name + ' (' + selectedStaff.id + ')' : 'General Simulation'}
Calculation Date: ${new Date().toLocaleDateString('en-GB')}
Statutory Framework: Nigeria Tax Reform & Economic Stabilization Act (2025/2026)

COMPENSATION & STATUTORY DETAILS:
• Monthly Gross Salary: ₦${fmt(calculations.monthlyGross)} (Annual: ₦${fmt(calculations.annualGross)})
• Statutory Deductions & Reliefs: ₦${fmt(calculations.totalMonthlyStatutoryRelief)}/mo (Annual: ₦${fmt(calculations.totalAnnualStatutoryRelief)})
• Tax-Exempt Base: First ₦800,000 per annum @ 0%
• Annual Taxable Base: ₦${fmt(calculations.newAnnualTaxable)}

PAYE TAX & TAKE-HOME SALARY:
• Monthly PAYE Tax: ₦${fmt(calculations.newMonthlyTax)}
• Annual PAYE Tax: ₦${fmt(calculations.newAnnualTax)}
• Monthly Net Take-Home Pay: ₦${fmt(calculations.newMonthlyNetPay)}
• Annual Net Take-Home Pay: ₦${fmt(calculations.newAnnualNetPay)}
• Effective Tax Rate: ${calculations.newEffectiveTaxRate.toFixed(2)}%
--------------------------------------------------------
Generated from Isalu HRMS Tax Computation Engine
    `.trim();

    navigator.clipboard.writeText(text);
    setCopied(true);
    showToast('Computation summary copied to clipboard!');
    setTimeout(() => setCopied(false), 2500);
  };

  const handlePrint = () => {
    window.print();
  };

  const currentDateFormatted = new Date().toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  const filteredStaff = staffSearch.trim() === ''
    ? staffList.slice(0, 10)
    : staffList.filter(s => 
        (s.name && s.name.toLowerCase().includes(staffSearch.toLowerCase())) ||
        String(s.id).includes(staffSearch)
      ).slice(0, 10);

  return (
    <div className={styles.container}>
      
      {/* ═══════════════════════════════════════════════════════════════
          ─── SCREEN INTERACTIVE UI (HIDDEN ON PRINT) ───
          ═══════════════════════════════════════════════════════════════ */}
      <div className={styles.screenOnly}>
        
        {/* Toast Notification */}
        <AnimatePresence>
          {toast && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className={`${styles.toast} ${toast.type === 'error' ? styles.toastError : styles.toastSuccess}`}
            >
              {toast.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
              <span>{toast.message}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Page Header */}
        <div className={styles.header}>
          <div className={styles.headerTitleArea}>
            <h1>
              <Calculator size={28} className={styles.calcIcon} color="#2563eb" />
              Nigeria New Tax Law Calculator
              <span className={styles.lawBadge}>2025/2026 Reform</span>
            </h1>
            <p>
              Compute employee PAYE Personal Income Tax, statutory reliefs, and net take-home pay based exclusively on Nigeria&apos;s new progressive tax reform law.
            </p>
          </div>

          <div className={styles.headerActions}>
            <button onClick={handleCopySummary} className={styles.headerBtn} title="Copy breakdown summary to clipboard">
              {copied ? <Check size={16} color="#10b981" /> : <Copy size={16} />}
              {copied ? 'Copied' : 'Copy Summary'}
            </button>
            <button onClick={handlePrint} className={`${styles.headerBtn} ${styles.primaryHeaderBtn}`} title="Print official A4 portrait slip">
              <Printer size={16} />
              Print Portrait Slip
            </button>
          </div>
        </div>

        {/* Quick Salary Benchmarks Toolbar */}
        <div className={styles.presetsBar}>
          <span className={styles.presetsLabel}>
            <Zap size={15} color="#f59e0b" />
            Quick Benchmarks:
          </span>
          <div className={styles.presetChips}>
            {PRESETS.map((p, idx) => (
              <button
                key={idx}
                className={styles.presetChip}
                onClick={() => {
                  setInputMode('quick');
                  setPeriod('monthly');
                  setQuickGross(p.monthlyGross);
                  setSelectedStaff(null);
                  setStaffSearch('');
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Main Two-Column Grid */}
        <div className={styles.mainGrid}>
          
          {/* Left Column: Calculation Controls & Form */}
          <div className={styles.inputCard}>
            <div className={styles.cardHeader}>
              <h2>
                <Layers size={18} color="#3b82f6" />
                Salary & Relief Inputs
              </h2>
              <div className={styles.togglePills}>
                <button 
                  className={`${styles.togglePill} ${period === 'monthly' ? styles.togglePillActive : ''}`}
                  onClick={() => setPeriod('monthly')}
                >
                  Monthly
                </button>
                <button 
                  className={`${styles.togglePill} ${period === 'annual' ? styles.togglePillActive : ''}`}
                  onClick={() => setPeriod('annual')}
                >
                  Annual
                </button>
              </div>
            </div>

            {/* Mode Switcher */}
            <div className={styles.modeTabs}>
              <button
                className={`${styles.modeTab} ${inputMode === 'quick' ? styles.modeTabActive : ''}`}
                onClick={() => setInputMode('quick')}
              >
                Quick Gross Salary
              </button>
              <button
                className={`${styles.modeTab} ${inputMode === 'itemized' ? styles.modeTabActive : ''}`}
                onClick={() => setInputMode('itemized')}
              >
                Itemized Components
              </button>
            </div>

            {/* Staff Autocomplete Lookup */}
            <div className={styles.staffSelectBox} ref={dropdownRef}>
              <label className={styles.formLabel}>
                <span>Load Employee Structure</span>
                <span className={styles.formLabelSub}>Optional Autofill</span>
              </label>
              <div className={styles.staffInputWrapper}>
                <Search size={16} className={styles.staffIcon} />
                <input
                  type="text"
                  placeholder="Search staff name or ID..."
                  value={staffSearch}
                  onFocus={() => setShowStaffDropdown(true)}
                  onChange={(e) => {
                    setStaffSearch(e.target.value);
                    setShowStaffDropdown(true);
                  }}
                  className={styles.staffInput}
                />
                {selectedStaff && (
                  <button className={styles.clearStaffBtn} onClick={handleClearStaff} title="Clear selected staff">
                    ✕
                  </button>
                )}
              </div>

              {showStaffDropdown && filteredStaff.length > 0 && (
                <ul className={styles.staffDropdown}>
                  {filteredStaff.map((staff) => (
                    <li
                      key={staff.id}
                      className={styles.staffItem}
                      onClick={() => handleSelectStaff(staff)}
                    >
                      <span className={styles.staffItemName}>{staff.name}</span>
                      <span className={styles.staffItemMeta}>ID: {staff.id} • {staff.department || 'Staff'}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Quick Gross Input Form */}
            {inputMode === 'quick' ? (
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>
                  <span>{period === 'monthly' ? 'Monthly Gross Earnings' : 'Annual Gross Earnings'}</span>
                  <span className={styles.formLabelSub}>Total compensation before tax</span>
                </label>
                <div className={styles.inputPrefixWrapper}>
                  <span className={styles.inputPrefix}>₦</span>
                  <input
                    type="number"
                    min="0"
                    step="1000"
                    value={quickGross}
                    onChange={(e) => setQuickGross(parseFloat(e.target.value) || 0)}
                    className={styles.currencyInput}
                  />
                </div>
                <input
                  type="range"
                  min="30000"
                  max={period === 'monthly' ? 5000000 : 60000000}
                  step={period === 'monthly' ? 10000 : 100000}
                  value={quickGross}
                  onChange={(e) => setQuickGross(parseFloat(e.target.value) || 0)}
                  className={styles.rangeSlider}
                />
              </div>
            ) : (
              /* Itemized Breakdown Inputs */
              <div className={styles.detailedGrid}>
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Basic Salary</label>
                  <div className={styles.inputPrefixWrapper}>
                    <span className={styles.inputPrefix}>₦</span>
                    <input
                      type="number"
                      min="0"
                      value={basic}
                      onChange={(e) => setBasic(parseFloat(e.target.value) || 0)}
                      className={styles.currencyInput}
                    />
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Housing</label>
                  <div className={styles.inputPrefixWrapper}>
                    <span className={styles.inputPrefix}>₦</span>
                    <input
                      type="number"
                      min="0"
                      value={housing}
                      onChange={(e) => setHousing(parseFloat(e.target.value) || 0)}
                      className={styles.currencyInput}
                    />
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Transport</label>
                  <div className={styles.inputPrefixWrapper}>
                    <span className={styles.inputPrefix}>₦</span>
                    <input
                      type="number"
                      min="0"
                      value={transport}
                      onChange={(e) => setTransport(parseFloat(e.target.value) || 0)}
                      className={styles.currencyInput}
                    />
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Medical</label>
                  <div className={styles.inputPrefixWrapper}>
                    <span className={styles.inputPrefix}>₦</span>
                    <input
                      type="number"
                      min="0"
                      value={medical}
                      onChange={(e) => setMedical(parseFloat(e.target.value) || 0)}
                      className={styles.currencyInput}
                    />
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Utility</label>
                  <div className={styles.inputPrefixWrapper}>
                    <span className={styles.inputPrefix}>₦</span>
                    <input
                      type="number"
                      min="0"
                      value={utility}
                      onChange={(e) => setUtility(parseFloat(e.target.value) || 0)}
                      className={styles.currencyInput}
                    />
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Meal Allowance</label>
                  <div className={styles.inputPrefixWrapper}>
                    <span className={styles.inputPrefix}>₦</span>
                    <input
                      type="number"
                      min="0"
                      value={meal}
                      onChange={(e) => setMeal(parseFloat(e.target.value) || 0)}
                      className={styles.currencyInput}
                    />
                  </div>
                </div>

                <div className={`${styles.formGroup} ${styles.detailedGridFull}`}>
                  <label className={styles.formLabel}>Other Allowances</label>
                  <div className={styles.inputPrefixWrapper}>
                    <span className={styles.inputPrefix}>₦</span>
                    <input
                      type="number"
                      min="0"
                      value={otherAllowances}
                      onChange={(e) => setOtherAllowances(parseFloat(e.target.value) || 0)}
                      className={styles.currencyInput}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Statutory Relieves & Deductions Accordion */}
            <div className={styles.deductionsSection}>
              <div className={styles.sectionHeading} onClick={() => setShowDeductionSettings(!showDeductionSettings)}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                  <ShieldCheck size={16} color="#10b981" />
                  Statutory Deductions & Reliefs
                </span>
                {showDeductionSettings ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </div>

              {showDeductionSettings && (
                <div>
                  {/* Pension Contribution */}
                  <div className={styles.deductionItem}>
                    <div className={styles.deductionLabelBox}>
                      <span className={styles.deductionTitle}>Pension Contribution (8%)</span>
                      <span className={styles.deductionHint}>Tax-exempt statutory pension fund deduction</span>
                    </div>
                    <label className={styles.toggleSwitch}>
                      <input
                        type="checkbox"
                        checked={pensionActive}
                        onChange={(e) => setPensionActive(e.target.checked)}
                      />
                      <span className={styles.sliderRound}></span>
                    </label>
                  </div>

                  {/* NHF */}
                  <div className={styles.deductionItem}>
                    <div className={styles.deductionLabelBox}>
                      <span className={styles.deductionTitle}>National Housing Fund (2.5%)</span>
                      <span className={styles.deductionHint}>NHF statutory contribution relief</span>
                    </div>
                    <label className={styles.toggleSwitch}>
                      <input
                        type="checkbox"
                        checked={nhfActive}
                        onChange={(e) => setNhfActive(e.target.checked)}
                      />
                      <span className={styles.sliderRound}></span>
                    </label>
                  </div>

                  {/* NHIS */}
                  <div className={styles.deductionItem}>
                    <div className={styles.deductionLabelBox}>
                      <span className={styles.deductionTitle}>Health Insurance (NHIS)</span>
                      <span className={styles.deductionHint}>National Health Insurance Scheme</span>
                    </div>
                    <label className={styles.toggleSwitch}>
                      <input
                        type="checkbox"
                        checked={nhisActive}
                        onChange={(e) => setNhisActive(e.target.checked)}
                      />
                      <span className={styles.sliderRound}></span>
                    </label>
                  </div>

                  {/* Life Assurance / Voluntary Pension */}
                  <div className={styles.formGroup} style={{ marginTop: '0.85rem' }}>
                    <label className={styles.formLabel}>
                      <span>Monthly Life Assurance / Voluntary Relief</span>
                      <span className={styles.formLabelSub}>Allowable deduction</span>
                    </label>
                    <div className={styles.inputPrefixWrapper}>
                      <span className={styles.inputPrefix}>₦</span>
                      <input
                        type="number"
                        min="0"
                        value={lifeAssurance}
                        onChange={(e) => setLifeAssurance(parseFloat(e.target.value) || 0)}
                        className={styles.currencyInput}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Results & Analysis */}
          <div className={styles.resultsCol}>
            
            {/* Main Take-Home Pay Banner */}
            <div className={styles.summaryBanner}>
              <div className={styles.bannerTop}>
                <div>
                  <div className={styles.bannerSub}>Net Take-Home Salary (New Tax Reform)</div>
                  <div className={styles.bannerNetPay}>
                    <NairaSign size={32} />
                    {fmt(calculations.newMonthlyNetPay)}
                    <span className={styles.bannerPeriod}>/month</span>
                  </div>
                </div>

                <div className={styles.savingsBadge}>
                  <Sparkles size={16} />
                  <span>Tax-Exempt Base: ₦800k @ 0%</span>
                </div>
              </div>

              <div className={styles.bannerMetricsGrid}>
                <div className={styles.bannerMetric}>
                  <span className={styles.metricLabel}>Monthly PAYE Tax</span>
                  <span className={styles.metricVal} style={{ color: '#fca5a5' }}>
                    ₦{fmt(calculations.newMonthlyTax)}
                  </span>
                </div>
                <div className={styles.bannerMetric}>
                  <span className={styles.metricLabel}>Effective Tax Rate</span>
                  <span className={styles.metricVal} style={{ color: '#93c5fd' }}>
                    {calculations.newEffectiveTaxRate.toFixed(2)}%
                  </span>
                </div>
                <div className={styles.bannerMetric}>
                  <span className={styles.metricLabel}>Annual Take-Home</span>
                  <span className={styles.metricVal}>
                    ₦{fmt(calculations.newAnnualNetPay)}
                  </span>
                </div>
                <div className={styles.bannerMetric}>
                  <span className={styles.metricLabel}>Total Reliefs/Deduct.</span>
                  <span className={styles.metricVal} style={{ color: '#86efac' }}>
                    ₦{fmt(calculations.totalMonthlyStatutoryRelief)}
                  </span>
                </div>
              </div>
            </div>

            {/* Monthly and Annual Summary Cards Grid */}
            <div className={styles.comparisonGrid}>
              
              {/* Monthly Overview Card */}
              <div className={`${styles.compareCard} ${styles.newLawCard}`}>
                <div className={styles.compareHead}>
                  <div className={styles.compareTitle}>
                    <CalendarDays size={18} color="#10b981" />
                    Monthly Compensation Breakdown
                  </div>
                  <span className={styles.tagNew}>Monthly Basis</span>
                </div>

                <div className={styles.compareRows}>
                  <div className={styles.compareRow}>
                    <span className={styles.compareRowLabel}>Gross Monthly Pay:</span>
                    <span className={styles.compareRowVal}>₦{fmt(calculations.monthlyGross)}</span>
                  </div>
                  <div className={styles.compareRow}>
                    <span className={styles.compareRowLabel}>Pension Contribution (8%):</span>
                    <span className={styles.compareRowVal}>₦{fmt(calculations.monthlyPension)}</span>
                  </div>
                  <div className={styles.compareRow}>
                    <span className={styles.compareRowLabel}>NHF / NHIS / Life Relief:</span>
                    <span className={styles.compareRowVal}>₦{fmt(calculations.totalMonthlyStatutoryRelief - calculations.monthlyPension)}</span>
                  </div>
                  <div className={styles.compareRow}>
                    <span className={styles.compareRowLabel}>Monthly PAYE Tax:</span>
                    <span className={`${styles.compareRowVal} ${styles.taxRowVal}`}>₦{fmt(calculations.newMonthlyTax)}</span>
                  </div>
                  <div className={styles.compareRow}>
                    <span className={styles.compareRowLabel}>Total Monthly Deductions:</span>
                    <span className={styles.compareRowVal} style={{ color: '#ef4444', fontWeight: 700 }}>₦{fmt(calculations.totalMonthlyDeductions)}</span>
                  </div>
                  <div className={styles.compareRow} style={{ borderTop: '1px solid var(--border)', paddingTop: '0.4rem' }}>
                    <span className={styles.compareRowLabel} style={{ fontWeight: 700 }}>Net Take-Home Salary:</span>
                    <span className={`${styles.compareRowVal} ${styles.netRowVal}`} style={{ fontSize: '1.05rem' }}>₦{fmt(calculations.newMonthlyNetPay)}</span>
                  </div>
                </div>
              </div>

              {/* Annualized Overview Card */}
              <div className={`${styles.compareCard} ${styles.annualCard}`}>
                <div className={styles.compareHead}>
                  <div className={styles.compareTitle}>
                    <Landmark size={18} color="#3b82f6" />
                    Annualized Tax Schedule
                  </div>
                  <span className={styles.tagAnnual}>Annual Basis</span>
                </div>

                <div className={styles.compareRows}>
                  <div className={styles.compareRow}>
                    <span className={styles.compareRowLabel}>Annual Gross Earnings:</span>
                    <span className={styles.compareRowVal}>₦{fmt(calculations.annualGross)}</span>
                  </div>
                  <div className={styles.compareRow}>
                    <span className={styles.compareRowLabel}>Total Annual Reliefs:</span>
                    <span className={styles.compareRowVal} style={{ color: '#10b981' }}>-₦{fmt(calculations.totalAnnualStatutoryRelief)}</span>
                  </div>
                  <div className={styles.compareRow}>
                    <span className={styles.compareRowLabel}>Annual Taxable Base:</span>
                    <span className={styles.compareRowVal} style={{ fontWeight: 700 }}>₦{fmt(calculations.newAnnualTaxable)}</span>
                  </div>
                  <div className={styles.compareRow}>
                    <span className={styles.compareRowLabel}>Annual PAYE Tax Payable:</span>
                    <span className={`${styles.compareRowVal} ${styles.taxRowVal}`}>₦{fmt(calculations.newAnnualTax)}</span>
                  </div>
                  <div className={styles.compareRow}>
                    <span className={styles.compareRowLabel}>Effective Tax Rate (%):</span>
                    <span className={styles.compareRowVal} style={{ color: '#2563eb', fontWeight: 700 }}>{calculations.newEffectiveTaxRate.toFixed(2)}%</span>
                  </div>
                  <div className={styles.compareRow} style={{ borderTop: '1px solid var(--border)', paddingTop: '0.4rem' }}>
                    <span className={styles.compareRowLabel} style={{ fontWeight: 700 }}>Annual Take-Home:</span>
                    <span className={`${styles.compareRowVal} ${styles.netRowVal}`} style={{ fontSize: '1.05rem' }}>₦{fmt(calculations.newAnnualNetPay)}</span>
                  </div>
                </div>
              </div>

            </div>

            {/* Progressive Tax Bands Breakdown Table */}
            <div className={styles.bandsCard}>
              <div className={styles.compareHead}>
                <div className={styles.compareTitle}>
                  <Percent size={18} color="#3b82f6" />
                  Progressive Tax Bands Breakdown (2025/2026 Reform)
                </div>
                <span className={styles.formLabelSub}>Statutory Brackets</span>
              </div>

              <table className={styles.bandsTable}>
                <thead>
                  <tr>
                    <th>Tax Band Range</th>
                    <th>Rate</th>
                    <th>Taxable in Band</th>
                    <th style={{ textAlign: 'right' }}>Tax Accrued</th>
                  </tr>
                </thead>
                <tbody>
                  {calculations.newBandsBreakdown.map((band, i) => (
                    <tr key={i}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{band.name}</div>
                        <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>{band.range}</div>
                      </td>
                      <td>
                        <span className={`${styles.bandRateBadge} ${band.class}`}>
                          {(band.rate * 100).toFixed(0)}%
                        </span>
                      </td>
                      <td>₦{fmt(band.taxableInBand)}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600, color: band.taxAccrued > 0 ? '#ef4444' : 'var(--text-secondary)' }}>
                        ₦{fmt(band.taxAccrued)}
                      </td>
                    </tr>
                  ))}
                  <tr style={{ fontWeight: 700, background: 'color-mix(in srgb, var(--foreground) 3%, transparent)' }}>
                    <td colSpan="3">Total Annual PAYE Tax Accrued:</td>
                    <td style={{ textAlign: 'right', color: '#ef4444', fontSize: '0.95rem' }}>
                      ₦{fmt(calculations.newAnnualTax)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Salary Distribution Visualizer */}
            <div className={styles.visualCard}>
              <div className={styles.compareHead}>
                <div className={styles.compareTitle}>
                  <TrendingUp size={18} color="#10b981" />
                  Monthly Gross Income Distribution
                </div>
                <span className={styles.formLabelSub}>Allocation Percentage</span>
              </div>

              <div className={styles.chartContainer}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} layout="vertical" margin={{ top: 10, right: 30, left: 130, bottom: 5 }}>
                    <XAxis type="number" tickFormatter={(val) => `₦${(val / 1000).toFixed(0)}k`} />
                    <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 12 }} />
                    <Tooltip 
                      formatter={(value) => [`₦${fmt(value)}`, 'Amount']}
                      contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px' }}
                    />
                    <Bar dataKey="amount" radius={[0, 6, 6, 0]}>
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Policy Highlights & Info Box */}
            <div className={styles.infoBox}>
              <div className={styles.infoTitle}>
                <Info size={18} />
                Key Rules of Nigeria&apos;s New Tax Reform Law
              </div>
              <ul className={styles.infoList}>
                <li>
                  <strong>₦800,000 Tax-Free Threshold:</strong> The first ₦800,000 earned per annum (₦66,666.67/month) attracts 0% tax, directly shielding minimum wage and low-income earners from PAYE.
                </li>
                <li>
                  <strong>Progressive Rate Scaling:</strong> Middle-income earners enjoy lower effective tax rates (15% on ₦800k–₦3m, 18% on ₦3m–₦12m), while high-net-worth individuals contribute up to 25% on income exceeding ₦50 million.
                </li>
                <li>
                  <strong>Allowable Deductions:</strong> Direct allowable statutory deductions include Employee Pension Contribution (8%), National Housing Fund (2.5%), Health Insurance (NHIS), and Life Assurance premiums.
                </li>
              </ul>
            </div>

          </div>

        </div>

      </div>


      {/* ═══════════════════════════════════════════════════════════════
          ─── DEDICATED A4 PORTRAIT PRINTABLE STATEMENT ───
          (Matches [class*="printableArea"] in globals.css)
          ═══════════════════════════════════════════════════════════════ */}
      <div className={`${styles.printableArea} printableArea`}>
        <div className={styles.printSheet}>
          
          {/* Header */}
          <div className={styles.printDocHeader}>
            <div>
              <h2 className={styles.printOrgName}>ISALU HOSPITALS LIMITED</h2>
              <p className={styles.printOrgSubtitle}>Human Resource & Payroll Management System</p>
            </div>
            <div className={styles.printDocTitleBox}>
              <h3 className={styles.printDocTitle}>PAYE TAX COMPUTATION STATEMENT</h3>
              <p className={styles.printDocStatute}>Nigeria Tax Reform & Economic Stabilization Act (2025/2026)</p>
            </div>
          </div>

          {/* Metadata Grid */}
          <div className={styles.printMetaGrid}>
            <div className={styles.printMetaItem}>
              <span className={styles.printMetaLabel}>Employee Name</span>
              <span className={styles.printMetaValue}>{selectedStaff ? selectedStaff.name : 'Simulated Compensation Profile'}</span>
            </div>
            <div className={styles.printMetaItem}>
              <span className={styles.printMetaLabel}>Staff ID / Department</span>
              <span className={styles.printMetaValue}>{selectedStaff ? `${selectedStaff.id} • ${selectedStaff.department || 'Payroll'}` : 'General / Simulation'}</span>
            </div>
            <div className={styles.printMetaItem}>
              <span className={styles.printMetaLabel}>Calculation Basis</span>
              <span className={styles.printMetaValue}>{period === 'monthly' ? 'Monthly Emoluments' : 'Annualized Gross'}</span>
            </div>
            <div className={styles.printMetaItem}>
              <span className={styles.printMetaLabel}>Date Generated</span>
              <span className={styles.printMetaValue}>{currentDateFormatted}</span>
            </div>
          </div>

          {/* Two-column Compensation & Statutory Relief Breakdown */}
          <div className={styles.printTwoColGrid}>
            {/* Earnings Breakdown */}
            <div>
              <div className={styles.printSectionHeading}>Gross Earnings Structure</div>
              <table className={styles.printTable}>
                <tbody>
                  {inputMode === 'itemized' ? (
                    <>
                      <tr><td>Basic Salary</td><td style={{ textAlign: 'right' }}>₦{fmt(calculations.itemized.basic)}</td></tr>
                      <tr><td>Housing Allowance</td><td style={{ textAlign: 'right' }}>₦{fmt(calculations.itemized.housing)}</td></tr>
                      <tr><td>Transport Allowance</td><td style={{ textAlign: 'right' }}>₦{fmt(calculations.itemized.transport)}</td></tr>
                      <tr><td>Medical Allowance</td><td style={{ textAlign: 'right' }}>₦{fmt(calculations.itemized.medical)}</td></tr>
                      <tr><td>Utility & Meal Allowance</td><td style={{ textAlign: 'right' }}>₦{fmt(calculations.itemized.utility + calculations.itemized.meal)}</td></tr>
                      <tr><td>Other Allowances</td><td style={{ textAlign: 'right' }}>₦{fmt(calculations.itemized.other)}</td></tr>
                    </>
                  ) : (
                    <tr><td>Gross Earnings (Direct)</td><td style={{ textAlign: 'right' }}>₦{fmt(calculations.monthlyGross)}</td></tr>
                  )}
                  <tr className={styles.printTableTotalRow}>
                    <td>Total Monthly Gross</td>
                    <td style={{ textAlign: 'right', color: '#1e3a8a' }}>₦{fmt(calculations.monthlyGross)}</td>
                  </tr>
                  <tr className={styles.printTableTotalRow}>
                    <td>Total Annualized Gross</td>
                    <td style={{ textAlign: 'right', color: '#1e3a8a' }}>₦{fmt(calculations.annualGross)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Allowable Deductions & Taxable Income */}
            <div>
              <div className={styles.printSectionHeading}>Allowable Statutory Reliefs</div>
              <table className={styles.printTable}>
                <tbody>
                  <tr>
                    <td>Pension Contribution (8%)</td>
                    <td style={{ textAlign: 'right' }}>{pensionActive ? `₦${fmt(calculations.monthlyPension)}` : 'Exempt / Inactive'}</td>
                  </tr>
                  <tr>
                    <td>National Housing Fund (NHF 2.5%)</td>
                    <td style={{ textAlign: 'right' }}>{nhfActive ? `₦${fmt(calculations.monthlyNhf)}` : 'Inactive'}</td>
                  </tr>
                  <tr>
                    <td>Health Insurance (NHIS)</td>
                    <td style={{ textAlign: 'right' }}>{nhisActive ? `₦${fmt(calculations.monthlyNhis)}` : 'Inactive'}</td>
                  </tr>
                  <tr>
                    <td>Life Assurance / Voluntary Relief</td>
                    <td style={{ textAlign: 'right' }}>₦{fmt(calculations.monthlyLife)}</td>
                  </tr>
                  <tr className={styles.printTableTotalRow}>
                    <td>Total Monthly Reliefs</td>
                    <td style={{ textAlign: 'right', color: '#047857' }}>₦{fmt(calculations.totalMonthlyStatutoryRelief)}</td>
                  </tr>
                  <tr className={styles.printTableTotalRow}>
                    <td>Annual Taxable Base</td>
                    <td style={{ textAlign: 'right', color: '#1e3a8a' }}>₦{fmt(calculations.newAnnualTaxable)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Progressive PAYE Bands Table */}
          <div className={styles.printSectionHeading}>New Progressive Tax Bands Schedule (2025/2026 Reform Act)</div>
          <table className={styles.printTable}>
            <thead>
              <tr>
                <th>Band Description</th>
                <th>Threshold Range</th>
                <th>Statutory Rate</th>
                <th>Taxable Portion in Band</th>
                <th style={{ textAlign: 'right' }}>Tax Accrued (₦)</th>
              </tr>
            </thead>
            <tbody>
              {calculations.newBandsBreakdown.map((band, idx) => (
                <tr key={idx}>
                  <td style={{ fontWeight: 600 }}>{band.name}</td>
                  <td>{band.range}</td>
                  <td>{(band.rate * 100).toFixed(0)}%</td>
                  <td>₦{fmt(band.taxableInBand)}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600, color: band.taxAccrued > 0 ? '#b91c1c' : '#4b5563' }}>
                    ₦{fmt(band.taxAccrued)}
                  </td>
                </tr>
              ))}
              <tr className={styles.printTableTotalRow}>
                <td colSpan="4" style={{ textTransform: 'uppercase' }}>Total Annual PAYE Tax Accrued:</td>
                <td style={{ textAlign: 'right', color: '#b91c1c', fontSize: '0.84rem' }}>
                  ₦{fmt(calculations.newAnnualTax)}
                </td>
              </tr>
            </tbody>
          </table>

          {/* Executive Net Take-Home Summary Highlight Box */}
          <div className={styles.printSummaryBox}>
            <div className={styles.printSummaryItem}>
              <span className={styles.printSummaryLabel}>Monthly Gross Pay</span>
              <span className={styles.printSummaryValue}>₦{fmt(calculations.monthlyGross)}</span>
            </div>
            <div className={styles.printSummaryItem}>
              <span className={styles.printSummaryLabel}>Monthly PAYE Tax</span>
              <span className={styles.printSummaryValue} style={{ color: '#b91c1c' }}>₦{fmt(calculations.newMonthlyTax)}</span>
            </div>
            <div className={styles.printSummaryItem}>
              <span className={styles.printSummaryLabel}>Monthly Pension/Relief</span>
              <span className={styles.printSummaryValue}>₦{fmt(calculations.totalMonthlyStatutoryRelief)}</span>
            </div>
            <div className={styles.printSummaryItem}>
              <span className={styles.printSummaryLabel}>Net Take-Home Pay</span>
              <span className={styles.printSummaryValue} style={{ color: '#047857' }}>₦{fmt(calculations.newMonthlyNetPay)}</span>
            </div>
          </div>

          {/* Signatures & Certification Block */}
          <div className={styles.printSignaturesGrid}>
            <div className={styles.printSignatureBox}>
              <div className={styles.printSignatureLine}></div>
              <span className={styles.printSignatureRole}>Prepared By: Payroll / Tax Officer</span>
              <span className={styles.printSignatureDate}>Signature & Date</span>
            </div>
            <div className={styles.printSignatureBox}>
              <div className={styles.printSignatureLine}></div>
              <span className={styles.printSignatureRole}>Verified & Authorized By: Head of Finance / HR</span>
              <span className={styles.printSignatureDate}>Signature & Date</span>
            </div>
          </div>

          {/* Footer Disclaimer */}
          <p className={styles.printDisclaimer}>
            This document is generated automatically by the Isalu HRMS Tax Computation Engine. All computation figures comply with statutory guidelines issued under the Nigeria Tax Reform / Economic Stabilization Act.
          </p>

        </div>
      </div>

    </div>
  );
}
