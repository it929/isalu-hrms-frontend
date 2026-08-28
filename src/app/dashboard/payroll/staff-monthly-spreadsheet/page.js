"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { 
  FileSpreadsheet, 
  Printer, 
  Search, 
  Calendar, 
  User, 
  Building2, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Download, 
  X, 
  Eye, 
  CreditCard,
  Layers,
  ChevronDown,
  TrendingUp,
  TrendingDown,
  Wallet,
  PiggyBank,
  ShoppingBag,
  HeartPulse
} from 'lucide-react';
import NairaSign from '@/components/ui/NairaSign';
import styles from './page.module.css';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api/nextjs';

const AVAILABLE_YEARS = [
  2020, 2021, 2022, 2023, 2024, 2025, 2026, 2027, 2028, 2029, 2030
];

function getUserId() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('hrms_user') || sessionStorage.getItem('hrms_user');
    if (raw) {
      const parsed = JSON.parse(raw);
      return parsed?.id || parsed?.userId || parsed?.ID || null;
    }
    return localStorage.getItem('user_id') || sessionStorage.getItem('user_id') || null;
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

export default function StaffMonthlySpreadsheetPage() {
  const [loading, setLoading] = useState(false);
  const [staffLoading, setStaffLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [toast, setToast] = useState(null);
  const [mounted, setMounted] = useState(false);

  // Staff & Permissions State
  const [staffList, setStaffList] = useState([]);
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [canSelectStaff, setCanSelectStaff] = useState(false);
  const [userCtx, setUserCtx] = useState(null);

  // Autocomplete Dropdown State
  const [dropdownSearch, setDropdownSearch] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);

  // Filter Controls
  const currentYear = new Date().getFullYear();
  const [fromYear, setFromYear] = useState(2025);
  const [toYear, setToYear] = useState(2026);

  // Spreadsheet Data State
  const [spreadsheetData, setSpreadsheetData] = useState(null);

  // Modal State
  const [breakdownModal, setBreakdownModal] = useState(null);

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  // Fetch staff list for dropdown
  const fetchStaffList = useCallback(async () => {
    setStaffLoading(true);
    try {
      const headers = buildHeaders();
      const res = await axios.get(`${API_BASE}/payroll/salary-breakdown/staff`, { headers });
      if (res.data.status === 'success') {
        const staffData = res.data.data || [];
        setStaffList(staffData);
        setCanSelectStaff(!!res.data.can_generate_all_staff || !!res.data.is_hod);
        setUserCtx(res.data);

        // If staff cannot select others, pre-select the first (their own) record
        if ((!res.data.can_generate_all_staff && !res.data.is_hod) && staffData.length > 0) {
          const selfStaff = staffData[0];
          setSelectedStaff(selfStaff);
          setDropdownSearch(selfStaff.name);
        } else if (staffData.length > 0 && !selectedStaff) {
          // Pre-select first staff for convenience
          setSelectedStaff(staffData[0]);
          setDropdownSearch(staffData[0].name);
        }
      }
    } catch (err) {
      console.error('Failed to fetch staff list:', err);
    } finally {
      setStaffLoading(false);
    }
  }, [selectedStaff]);

  // Load Spreadsheet Data
  const fetchSpreadsheet = useCallback(async (staffId = null, fYear = null, tYear = null) => {
    const sId = staffId || selectedStaff?.id;
    if (!sId) {
      showToast('Please select a staff member.', 'error');
      return;
    }

    const fromY = fYear || fromYear;
    const toY = tYear || toYear;

    setLoading(true);
    try {
      const headers = buildHeaders();
      const res = await axios.get(
        `${API_BASE}/payroll/staff-spreadsheet?staff_id=${sId}&from_year=${fromY}&to_year=${toY}`,
        { headers }
      );

      if (res.data.status === 'success') {
        setSpreadsheetData(res.data);
      } else {
        showToast(res.data.message || 'Failed to load spreadsheet data.', 'error');
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Error fetching staff monthly spreadsheet.';
      showToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  }, [selectedStaff, fromYear, toYear, showToast]);

  useEffect(() => {
    fetchStaffList();
    setMounted(true);
  }, [fetchStaffList]);

  // Auto-fetch spreadsheet when staff is selected on initial mount
  useEffect(() => {
    if (selectedStaff?.id && !spreadsheetData) {
      fetchSpreadsheet(selectedStaff.id, fromYear, toYear);
    }
  }, [selectedStaff, spreadsheetData, fromYear, toYear, fetchSpreadsheet]);

  // Handle Outside Click for Dropdown
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
        if (selectedStaff) {
          setDropdownSearch(selectedStaff.name);
        }
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [selectedStaff]);

  // Filter staff list: If search is blank OR equals currently selected staff name, show all staff!
  const isSearchMatchingSelected = selectedStaff && dropdownSearch.trim().toLowerCase() === selectedStaff.name?.trim().toLowerCase();
  
  const filteredStaff = (dropdownSearch.trim() === '' || isSearchMatchingSelected)
    ? staffList
    : staffList.filter(s => {
        const q = dropdownSearch.toLowerCase().trim();
        const nameMatch = s.name ? String(s.name).toLowerCase().includes(q) : false;
        const idMatch = s.id ? String(s.id).toLowerCase().includes(q) : false;
        const fileMatch = s.file_no ? String(s.file_no).toLowerCase().includes(q) : false;
        return nameMatch || idMatch || fileMatch;
      });

  const handleSelectStaff = (staff) => {
    setSelectedStaff(staff);
    setDropdownSearch(staff.name);
    setShowDropdown(false);
    fetchSpreadsheet(staff.id, fromYear, toYear);
  };

  // Export to CSV
  const handleExportCsv = async () => {
    if (!selectedStaff?.id) {
      showToast('Please select a staff member first.', 'error');
      return;
    }

    setExporting(true);
    try {
      const headers = buildHeaders();
      const res = await axios.get(
        `${API_BASE}/payroll/staff-spreadsheet/export?staff_id=${selectedStaff.id}&from_year=${fromYear}&to_year=${toYear}`,
        {
          headers,
          responseType: 'blob'
        }
      );

      const filename = `Staff_Monthly_Spreadsheet_${selectedStaff.file_no || selectedStaff.id}_${fromYear}_${toYear}.csv`;
      const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      showToast('Spreadsheet downloaded successfully!');
    } catch (err) {
      showToast('Failed to export spreadsheet.', 'error');
    } finally {
      setExporting(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const openBreakdownModal = (monthRow) => {
    if (monthRow?.full_breakdown) {
      setBreakdownModal(monthRow.full_breakdown);
    }
  };

  const staff = spreadsheetData?.staff || null;

  return (
    <div className={styles.container}>
      {/* Toast */}
      {toast && (
        <div className={`${styles.toast} ${toast.type === 'success' ? styles.toastSuccess : styles.toastError}`}>
          {toast.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header */}
      <div className={styles.header}>
        <div className={styles.titleArea}>
          <h1 className={styles.title}>
            <FileSpreadsheet size={24} style={{ color: '#3b82f6' }} />
            Staff Monthly Payroll Spreadsheet
          </h1>
          <p className={styles.subtitle}>
            Annual and multi-year monthly salary spreadsheet analysis for individual staff members.
          </p>
        </div>

        <div className={styles.headerActions}>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnSecondary}`}
            onClick={handlePrint}
          >
            <Printer size={16} />
            Print
          </button>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnSuccess}`}
            onClick={handleExportCsv}
            disabled={exporting || !spreadsheetData}
          >
            {exporting ? <Loader2 size={16} className={styles.spinner} /> : <Download size={16} />}
            Download Spreadsheet (.csv)
          </button>
        </div>
      </div>

      {/* Filter Controls Card */}
      <div className={`${styles.card} ${styles.filterCard} ${styles.noPrint}`}>
        <div className={styles.cardHeader}>
          <h2 className={styles.cardTitle}>
            <Calendar size={18} style={{ color: '#3b82f6' }} />
            Spreadsheet Filters & Range
          </h2>
        </div>

        <div className={styles.cardBody}>
          <div className={styles.filterGrid}>
            {/* Staff Selector */}
            {/* Staff Search Autocomplete */}
            <div className={styles.formGroup} ref={dropdownRef}>
              <label className={styles.label}>Select Staff Member *</label>
              <div className={styles.inputGroup}>
                <User className={styles.inputIcon} size={16} />
                <input
                  type="text"
                  className={`${styles.input} ${styles.inputWithIcon} ${!canSelectStaff ? styles.readonly : ''}`}
                  placeholder={!canSelectStaff ? "Readonly employee view" : "Type staff name or ID..."}
                  value={dropdownSearch}
                  onChange={(e) => {
                    setDropdownSearch(e.target.value);
                    setShowDropdown(true);
                  }}
                  onFocus={(e) => {
                    if (canSelectStaff) {
                      setShowDropdown(true);
                      e.target.select();
                    }
                  }}
                  onClick={() => {
                    if (canSelectStaff) {
                      setShowDropdown(true);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      if (filteredStaff.length > 0) {
                        handleSelectStaff(filteredStaff[0]);
                      }
                    }
                  }}
                  disabled={!canSelectStaff}
                  autoComplete="off"
                />

                {canSelectStaff && (
                  <div style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', gap: '4px', zIndex: 5 }}>
                    {dropdownSearch && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDropdownSearch('');
                          setShowDropdown(true);
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#94a3b8',
                          cursor: 'pointer',
                          padding: '2px',
                          display: 'flex',
                          alignItems: 'center'
                        }}
                        title="Clear search"
                      >
                        <X size={14} />
                      </button>
                    )}
                    <button
                      type="button"
                      className={styles.inputRightBtn}
                      style={{ position: 'static', transform: 'none' }}
                      onClick={() => setShowDropdown(!showDropdown)}
                      title={showDropdown ? "Close menu" : "Open staff list"}
                    >
                      <ChevronDown size={16} style={{ transform: showDropdown ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease' }} />
                    </button>
                  </div>
                )}
              </div>

              {showDropdown && canSelectStaff && (
                <ul className={styles.dropdownList}>
                  {filteredStaff.length > 0 ? (
                    filteredStaff.map((s) => {
                      const isSelected = selectedStaff?.id === s.id;
                      return (
                        <li
                          key={s.id}
                          className={`${styles.dropdownItem} ${isSelected ? styles.dropdownItemSelected : ''}`}
                          onClick={() => handleSelectStaff(s)}
                        >
                          <div className={styles.dropdownItemMain}>
                            <span className={styles.dropdownStaffName}>
                              {s.name}
                            </span>
                            <div className={styles.dropdownItemMeta}>
                              <span className={styles.dropdownMetaPill}>ID: {s.id}</span>
                              {s.department && (
                                <span style={{ color: '#475569' }}>• {s.department}</span>
                              )}
                            </div>
                          </div>
                          {isSelected && (
                            <CheckCircle2 size={16} style={{ color: '#4f46e5', flexShrink: 0 }} />
                          )}
                        </li>
                      );
                    })
                  ) : (
                    <li className={styles.dropdownEmpty}>No matching staff found</li>
                  )}
                </ul>
              )}
            </div>

            {/* From Year */}
            <div className={styles.formGroup}>
              <label className={styles.label}>From Year</label>
              <div className={styles.inputGroup}>
                <Calendar className={styles.inputIcon} size={16} />
                <select
                  className={`${styles.input} ${styles.inputWithIcon}`}
                  value={fromYear}
                  onChange={(e) => setFromYear(Number(e.target.value))}
                >
                  {AVAILABLE_YEARS.map(yr => (
                    <option key={yr} value={yr}>{yr}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* To Year */}
            <div className={styles.formGroup}>
              <label className={styles.label}>To Year</label>
              <div className={styles.inputGroup}>
                <Calendar className={styles.inputIcon} size={16} />
                <select
                  className={`${styles.input} ${styles.inputWithIcon}`}
                  value={toYear}
                  onChange={(e) => setToYear(Number(e.target.value))}
                >
                  {AVAILABLE_YEARS.map(yr => (
                    <option key={yr} value={yr}>{yr}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Submit / Load Button */}
            <div>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnPrimary}`}
                onClick={() => fetchSpreadsheet(selectedStaff?.id, fromYear, toYear)}
                disabled={loading || staffLoading || !selectedStaff}
                style={{ width: '100%', height: '42px', justifyContent: 'center' }}
              >
                {loading ? (
                  <>
                    <Loader2 size={16} className={styles.spinner} />
                    Loading…
                  </>
                ) : (
                  <>
                    <FileSpreadsheet size={16} />
                    Load Spreadsheet
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Staff Profile Banner */}
      {staff && (
        <div className={styles.staffBanner}>
          <div className={styles.staffBannerLeft}>
            <div className={styles.staffAvatar}>
              {staff.name ? staff.name.charAt(0).toUpperCase() : 'S'}
            </div>
            <div>
              <h3 className={styles.staffName}>{staff.name}</h3>
              <div className={styles.staffMeta}>
                <span className={styles.staffMetaTag}>ID: {staff.id}</span>
                <span><Building2 size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} /> {staff.department}</span>
                <span>• {staff.designation}</span>
              </div>
            </div>
          </div>

          <div className={styles.staffBannerRight}>
            <div className={styles.bannerStat}>
              <span className={styles.bannerStatLabel}>Bank & Account</span>
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#f8fafc' }}>
                {staff.bank_name || 'N/A'} - {staff.account_number || 'N/A'}
              </span>
            </div>
            <div className={styles.bannerStat}>
              <span className={styles.bannerStatLabel}>Spreadsheet Period</span>
              <span className={styles.bannerStatValue}>
                {spreadsheetData.from_year} – {spreadsheetData.to_year}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Main Multi-Year Spreadsheet Content */}
      {loading ? (
        <div className={styles.card} style={{ padding: '4rem', textAlign: 'center' }}>
          <Loader2 size={36} className={styles.spinner} style={{ margin: '0 auto 1rem', color: '#3b82f6' }} />
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', margin: 0 }}>
            Generating comprehensive monthly spreadsheet for {selectedStaff?.name || 'staff'} ({fromYear} – {toYear})…
          </p>
        </div>
      ) : spreadsheetData?.years?.length > 0 ? (
        <>
          {spreadsheetData.years.map((yearObj) => (
            <div key={yearObj.year} className={styles.yearSection}>
              {/* Year Header */}
              <div className={styles.yearSectionHeader}>
                <h3 className={styles.yearSectionTitle}>
                  <Calendar size={20} style={{ color: '#3b82f6' }} />
                  <span>{yearObj.year} Payroll Year</span>
                  <span className={styles.yearBadge}>January – December</span>
                </h3>
              </div>

              {/* Table Container */}
              <div className={styles.tableContainer}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th className={styles.actionCell}>Action</th>
                      <th>Month</th>
                      <th style={{ textAlign: 'right' }}>Basic (₦)</th>
                      <th style={{ textAlign: 'right' }}>Housing (₦)</th>
                      <th style={{ textAlign: 'right' }}>Transport (₦)</th>
                      <th style={{ textAlign: 'right' }}>Medical (₦)</th>
                      <th style={{ textAlign: 'right' }}>Utility (₦)</th>
                      <th style={{ textAlign: 'right' }}>Meal (₦)</th>
                      <th style={{ textAlign: 'right' }}>Variable (₦)</th>
                      <th style={{ textAlign: 'right' }}>Gross Pay (₦)</th>
                      <th style={{ textAlign: 'right' }}>Declared Sal. (₦)</th>
                      <th style={{ textAlign: 'right' }}>PAYE Tax (₦)</th>
                      <th style={{ textAlign: 'right' }}>Pension (₦)</th>
                      <th style={{ textAlign: 'right' }}>Retention (₦)</th>
                      <th style={{ textAlign: 'right' }}>IOU (₦)</th>
                      <th style={{ textAlign: 'right' }}>Med. Loan (₦)</th>
                      <th style={{ textAlign: 'right' }}>Coop. Loan (₦)</th>
                      <th style={{ textAlign: 'right' }}>Coop. Sav. (₦)</th>
                      <th style={{ textAlign: 'right' }}>Asset Fin. (₦)</th>
                      <th style={{ textAlign: 'right' }}>Surcharges (₦)</th>
                      <th style={{ textAlign: 'right' }}>Absence Pen. (₦)</th>
                      <th style={{ textAlign: 'right' }}>LOA Ded. (₦)</th>
                      <th style={{ textAlign: 'right' }}>Loan (₦)</th>
                      <th style={{ textAlign: 'right' }}>Other Ded. (₦)</th>
                      <th style={{ textAlign: 'right' }}>Total Ded. (₦)</th>
                      <th style={{ textAlign: 'right' }}>Net Pay (₦)</th>
                      <th style={{ textAlign: 'center' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {yearObj.months.map((mRow) => (
                      <tr key={mRow.month_num}>
                        {/* Action: Breakdown button */}
                        <td className={styles.actionCell}>
                          <button
                            type="button"
                            className={styles.breakdownBtn}
                            onClick={() => openBreakdownModal(mRow)}
                            title="View itemized breakdown modal"
                          >
                            <Eye size={13} style={{ color: '#2563eb' }} />
                            Breakdown
                          </button>
                        </td>

                        {/* Clickable Month Name */}
                        <td 
                          className={styles.monthCell}
                          onClick={() => openBreakdownModal(mRow)}
                          title="Click to view detailed breakdown modal"
                        >
                          {mRow.month_name}
                        </td>

                        <td className={styles.amountCol}>{fmt(mRow.basic)}</td>
                        <td className={styles.amountCol}>{fmt(mRow.housing)}</td>
                        <td className={styles.amountCol}>{fmt(mRow.transport)}</td>
                        <td className={styles.amountCol}>{fmt(mRow.medical)}</td>
                        <td className={styles.amountCol}>{fmt(mRow.utility)}</td>
                        <td className={styles.amountCol}>{fmt(mRow.meal)}</td>
                        <td className={styles.amountCol}>{fmt(mRow.variable_allowances)}</td>
                        <td className={styles.grossCol}>{fmt(mRow.total_gross || mRow.gross_salary)}</td>
                        <td className={styles.amountCol}>{fmt(mRow.declare_salary)}</td>
                        <td className={styles.deductCol}>{fmt(mRow.paye_tax)}</td>
                        <td className={styles.deductCol}>{fmt(mRow.pension)}</td>
                        <td className={styles.deductCol}>{fmt(mRow.retention)}</td>
                        <td className={styles.deductCol}>{fmt(mRow.iou)}</td>
                        <td className={styles.deductCol}>{fmt(mRow.medical_loan)}</td>
                        <td className={styles.deductCol}>{fmt(mRow.coop_loan)}</td>
                        <td className={styles.deductCol}>{fmt(mRow.coop_savings)}</td>
                        <td className={styles.deductCol}>{fmt(mRow.coop_asset_finance)}</td>
                        <td className={styles.deductCol}>{fmt(mRow.surcharges || mRow.surcharge)}</td>
                        <td className={styles.deductCol}>{fmt(mRow.absence_penalty)}</td>
                        <td className={styles.deductCol}>{fmt(mRow.leave_of_absence)}</td>
                        <td className={styles.deductCol}>{fmt(mRow.regular_loan)}</td>
                        <td className={styles.deductCol}>{fmt(mRow.other_deductions)}</td>
                        <td className={styles.deductCol} style={{ fontWeight: 700 }}>{fmt(mRow.total_deductions)}</td>
                        <td className={styles.netCol}>{fmt(mRow.net_pay)}</td>
                        <td style={{ textAlign: 'center' }}>
                          <span className={`${styles.statusBadge} ${
                            mRow.status === 'Not Employed' ? styles.statusNotEmployed :
                            mRow.status === 'Not Computed' ? styles.statusNotComputed :
                            mRow.status === 'Upcoming' ? styles.statusUpcoming :
                            mRow.is_computed ? styles.statusComputed : styles.statusEstimate
                          }`}>
                            {mRow.status === 'Not Employed' ? 'Not Employed' : 
                             mRow.status === 'Not Computed' ? 'Not Computed' : 
                             mRow.status === 'Upcoming' ? 'Upcoming' : 
                             (mRow.is_computed ? 'Computed' : 'Estimate')}
                          </span>
                        </td>
                      </tr>
                    ))}

                    {/* Year Total Row (Summing all 12 months) */}
                    <tr className={styles.totalRow}>
                      <td className={styles.actionCell}>—</td>
                      <td className={styles.totalRowLabel}>TOTAL ({yearObj.year})</td>
                      <td className={styles.amountCol}>{fmt(yearObj.year_totals.basic)}</td>
                      <td className={styles.amountCol}>{fmt(yearObj.year_totals.housing)}</td>
                      <td className={styles.amountCol}>{fmt(yearObj.year_totals.transport)}</td>
                      <td className={styles.amountCol}>{fmt(yearObj.year_totals.medical)}</td>
                      <td className={styles.amountCol}>{fmt(yearObj.year_totals.utility)}</td>
                      <td className={styles.amountCol}>{fmt(yearObj.year_totals.meal)}</td>
                      <td className={styles.amountCol}>{fmt(yearObj.year_totals.variable_allowances)}</td>
                      <td className={styles.grossCol}>{fmt(yearObj.year_totals.total_gross || yearObj.year_totals.gross_salary)}</td>
                      <td className={styles.amountCol}>{fmt(yearObj.year_totals.declare_salary)}</td>
                      <td className={styles.deductCol}>{fmt(yearObj.year_totals.paye_tax)}</td>
                      <td className={styles.deductCol}>{fmt(yearObj.year_totals.pension)}</td>
                      <td className={styles.deductCol}>{fmt(yearObj.year_totals.retention)}</td>
                      <td className={styles.deductCol}>{fmt(yearObj.year_totals.iou)}</td>
                      <td className={styles.deductCol}>{fmt(yearObj.year_totals.medical_loan)}</td>
                      <td className={styles.deductCol}>{fmt(yearObj.year_totals.coop_loan)}</td>
                      <td className={styles.deductCol}>{fmt(yearObj.year_totals.coop_savings)}</td>
                      <td className={styles.deductCol}>{fmt(yearObj.year_totals.coop_asset_finance)}</td>
                      <td className={styles.deductCol}>{fmt(yearObj.year_totals.surcharges || yearObj.year_totals.surcharge)}</td>
                      <td className={styles.deductCol}>{fmt(yearObj.year_totals.absence_penalty)}</td>
                      <td className={styles.deductCol}>{fmt(yearObj.year_totals.leave_of_absence)}</td>
                      <td className={styles.deductCol}>{fmt(yearObj.year_totals.regular_loan)}</td>
                      <td className={styles.deductCol}>{fmt(yearObj.year_totals.other_deductions)}</td>
                      <td className={styles.deductCol} style={{ fontWeight: 800 }}>{fmt(yearObj.year_totals.total_deductions)}</td>
                      <td className={styles.netCol} style={{ fontSize: '0.9rem' }}>{fmt(yearObj.year_totals.net_pay)}</td>
                      <td style={{ textAlign: 'center' }}>—</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          ))}

          {/* Grand Multi-Year Summary Card (if range spans multiple years) */}
          {spreadsheetData.years.length > 1 && spreadsheetData.grand_totals && (
            <div className={styles.grandTotalsCard}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Layers size={20} style={{ color: '#38bdf8' }} />
                  Grand Cumulative Total ({spreadsheetData.from_year} – {spreadsheetData.to_year})
                </h3>
                <span style={{ fontSize: '0.8rem', color: '#94a3b8', background: 'rgba(255, 255, 255, 0.1)', padding: '0.2rem 0.6rem', borderRadius: '6px' }}>
                  {spreadsheetData.years.length * 12} Total Months
                </span>
              </div>

              <div className={styles.grandTotalsGrid}>
                <div className={styles.grandStatItem}>
                  <span className={styles.grandStatLabel}>Total Basic Salary</span>
                  <span className={styles.grandStatValue} style={{ color: '#ffffff' }}>
                    <NairaSign size={16} />
                    {fmt(spreadsheetData.grand_totals.basic)}
                  </span>
                </div>

                <div className={styles.grandStatItem}>
                  <span className={styles.grandStatLabel}>Total Gross Salary</span>
                  <span className={styles.grandStatValue} style={{ color: '#38bdf8' }}>
                    <NairaSign size={16} />
                    {fmt(spreadsheetData.grand_totals.gross_salary)}
                  </span>
                </div>

                <div className={styles.grandStatItem}>
                  <span className={styles.grandStatLabel}>Total PAYE Tax</span>
                  <span className={styles.grandStatValue} style={{ color: '#f87171' }}>
                    <NairaSign size={16} />
                    {fmt(spreadsheetData.grand_totals.paye_tax)}
                  </span>
                </div>

                <div className={styles.grandStatItem}>
                  <span className={styles.grandStatLabel}>Total Pension</span>
                  <span className={styles.grandStatValue} style={{ color: '#f87171' }}>
                    <NairaSign size={16} />
                    {fmt(spreadsheetData.grand_totals.pension)}
                  </span>
                </div>

                <div className={styles.grandStatItem}>
                  <span className={styles.grandStatLabel}>Total Deductions</span>
                  <span className={styles.grandStatValue} style={{ color: '#ef4444' }}>
                    <NairaSign size={16} />
                    {fmt(spreadsheetData.grand_totals.total_deductions)}
                  </span>
                </div>

                <div className={styles.grandStatItem}>
                  <span className={styles.grandStatLabel}>Total Net Pay</span>
                  <span className={styles.grandStatValue} style={{ color: '#4ade80' }}>
                    <NairaSign size={16} />
                    {fmt(spreadsheetData.grand_totals.net_pay)}
                  </span>
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className={styles.card} style={{ padding: '3rem', textAlign: 'center' }}>
          <AlertCircle size={32} style={{ color: '#94a3b8', margin: '0 auto 0.75rem' }} />
          <p style={{ color: 'var(--text-secondary)', margin: 0 }}>
            No spreadsheet data found. Please select a staff member and click <strong>Load Spreadsheet</strong>.
          </p>
        </div>
      )}

      {/* ═══════════════ SALARY BREAKDOWN MODAL ═══════════════ */}
      {breakdownModal && (
        <div className={styles.modalOverlay} onClick={() => setBreakdownModal(null)}>
          <div className={styles.modalBox} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div>
                <h3 className={styles.modalTitle}>
                  Salary Breakdown – {breakdownModal.period}
                </h3>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  {breakdownModal.staff?.name} ({breakdownModal.staff?.department} • {breakdownModal.staff?.designation})
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setBreakdownModal(null)}
                className={styles.modalCloseBtn}
              >
                <X size={20} />
              </button>
            </div>

            <div className={styles.modalBody}>
              {/* Top 3 KPI Banners */}
              <div className={styles.modalKpiRow}>
                {/* 1. Total Gross Salary */}
                <div className={styles.kpiCardHorizontal}>
                  <div className={`${styles.kpiIconWrap} ${styles.kpiIconGross}`}>
                    <TrendingUp size={24} />
                  </div>
                  <div className={styles.kpiInfo}>
                    <span className={styles.kpiLabel}>Total Gross Salary</span>
                    <span className={styles.kpiValueGross}>
                      ₦{fmt(breakdownModal.summary?.gross_pay)}
                    </span>
                  </div>
                </div>

                {/* 2. Total Monthly Deductions */}
                <div className={styles.kpiCardHorizontal}>
                  <div className={`${styles.kpiIconWrap} ${styles.kpiIconDeductions}`}>
                    <TrendingDown size={24} />
                  </div>
                  <div className={styles.kpiInfo}>
                    <span className={styles.kpiLabel}>Total Monthly Deductions</span>
                    <span className={styles.kpiValueDeductions}>
                      - ₦{fmt(breakdownModal.summary?.total_deductions)}
                    </span>
                  </div>
                </div>

                {/* 3. Estimated Net Take-Home Pay */}
                <div className={styles.kpiCardHorizontal}>
                  <div className={`${styles.kpiIconWrap} ${styles.kpiIconNet}`}>
                    <NairaSign size={22} />
                  </div>
                  <div className={styles.kpiInfo}>
                    <span className={styles.kpiLabel}>Estimated Net Take-Home Pay</span>
                    <span className={styles.kpiValueNet}>
                      ₦{fmt(breakdownModal.summary?.net_pay)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Two Column Breakdown Grid */}
              <div className={styles.breakdownGrid}>
                {/* Earnings List */}
                <div className={styles.breakdownCard}>
                  <div className={`${styles.breakdownCardHeader} ${styles.breakdownCardHeaderEarnings}`}>
                    <span>Earnings & Allowances</span>
                    <NairaSign size={15} />
                  </div>
                  <ul className={styles.breakdownList}>
                    <li className={styles.breakdownListItem}>
                      <span>Basic Salary</span>
                      <strong>₦{fmt(breakdownModal.earnings?.basic_salary)}</strong>
                    </li>
                    <li className={styles.breakdownListItem}>
                      <span>Housing Allowance</span>
                      <strong>₦{fmt(breakdownModal.earnings?.housing_allowance)}</strong>
                    </li>
                    <li className={styles.breakdownListItem}>
                      <span>Transport Allowance</span>
                      <strong>₦{fmt(breakdownModal.earnings?.transport_allowance)}</strong>
                    </li>
                    <li className={styles.breakdownListItem}>
                      <span>Medical Allowance</span>
                      <strong>₦{fmt(breakdownModal.earnings?.medical_allowance)}</strong>
                    </li>
                    <li className={styles.breakdownListItem}>
                      <span>Utility Allowance</span>
                      <strong>₦{fmt(breakdownModal.earnings?.utility_allowance)}</strong>
                    </li>
                    <li className={styles.breakdownListItem}>
                      <span>Meal Allowance</span>
                      <strong>₦{fmt(breakdownModal.earnings?.meal_allowance)}</strong>
                    </li>
                    {breakdownModal.earnings?.earning_variables && breakdownModal.earnings.earning_variables.map((ev, idx) => (
                      <li key={`ev-${idx}`} className={styles.breakdownListItem}>
                        <span>{ev.name || 'Variable Allowance'}</span>
                        <strong>₦{fmt(ev.amount)}</strong>
                      </li>
                    ))}
                    <li className={styles.breakdownListItem} style={{ background: 'var(--bg-subtle)', fontWeight: 700 }}>
                      <span>Total Gross Salary</span>
                      <span style={{ color: '#0284c7', fontWeight: 800 }}>
                        ₦{fmt(breakdownModal.earnings?.gross_salary || breakdownModal.earnings?.gross_pay)}
                      </span>
                    </li>
                  </ul>
                </div>

                {/* Deductions List */}
                <div className={styles.breakdownCard}>
                  <div className={`${styles.breakdownCardHeader} ${styles.breakdownCardHeaderDeductions}`}>
                    <span>Deductions & Recoveries</span>
                    <NairaSign size={15} />
                  </div>
                  <ul className={styles.breakdownList}>
                    <li className={styles.breakdownListItem}>
                      <span>PAYE Tax (Progressive Act 2026)</span>
                      <strong style={{ color: '#dc2626' }}>₦{fmt(breakdownModal.deductions?.paye_tax?.amount)}</strong>
                    </li>
                    <li className={styles.breakdownListItem}>
                      <span>Employee Pension (8%)</span>
                      <strong style={{ color: '#dc2626' }}>₦{fmt(breakdownModal.deductions?.pension?.amount)}</strong>
                    </li>
                    {breakdownModal.deductions?.retention?.amount > 0 && (
                      <li className={styles.breakdownListItem}>
                        <span>Staff Retention (5%)</span>
                        <strong style={{ color: '#dc2626' }}>₦{fmt(breakdownModal.deductions?.retention?.amount)}</strong>
                      </li>
                    )}
                    {breakdownModal.deductions?.iou?.amount > 0 && (
                      <li className={styles.breakdownListItem}>
                        <span>IOU / Salary Advance</span>
                        <strong style={{ color: '#dc2626' }}>₦{fmt(breakdownModal.deductions?.iou?.amount)}</strong>
                      </li>
                    )}
                    {breakdownModal.deductions?.regular_loan?.amount > 0 && (
                      <li className={styles.breakdownListItem}>
                        <span>Employee Loan Repayment</span>
                        <strong style={{ color: '#dc2626' }}>₦{fmt(breakdownModal.deductions?.regular_loan?.amount)}</strong>
                      </li>
                    )}
                    {breakdownModal.deductions?.medical_loan?.amount > 0 && (
                      <li className={styles.breakdownListItem}>
                        <span>Medical Loan Repayment</span>
                        <strong style={{ color: '#dc2626' }}>₦{fmt(breakdownModal.deductions?.medical_loan?.amount)}</strong>
                      </li>
                    )}
                    {breakdownModal.deductions?.coop_loan?.amount > 0 && (
                      <li className={styles.breakdownListItem}>
                        <span>Cooperative Loan Repayment</span>
                        <strong style={{ color: '#dc2626' }}>₦{fmt(breakdownModal.deductions?.coop_loan?.amount)}</strong>
                      </li>
                    )}
                    {breakdownModal.deductions?.coop_savings?.amount > 0 && (
                      <li className={styles.breakdownListItem}>
                        <span>Cooperative Monthly Savings</span>
                        <strong style={{ color: '#dc2626' }}>₦{fmt(breakdownModal.deductions?.coop_savings?.amount)}</strong>
                      </li>
                    )}
                    {breakdownModal.deductions?.leave_of_absence?.amount > 0 && (
                      <li className={styles.breakdownListItem}>
                        <span>Leave of Absence ({breakdownModal.deductions?.leave_of_absence?.days_absent} Unpaid Days)</span>
                        <strong style={{ color: '#dc2626' }}>₦{fmt(breakdownModal.deductions?.leave_of_absence?.amount)}</strong>
                      </li>
                    )}
                    {breakdownModal.deductions?.mid_month_adjustment?.amount > 0 && (
                      <li className={styles.breakdownListItem}>
                        <span>Mid-Month Appointment Adjustment</span>
                        <strong style={{ color: '#dc2626' }}>₦{fmt(breakdownModal.deductions?.mid_month_adjustment?.amount)}</strong>
                      </li>
                    )}
                    <li className={styles.breakdownListItem} style={{ background: 'var(--bg-subtle)', fontWeight: 700 }}>
                      <span>Total Deductions</span>
                      <span style={{ color: '#dc2626' }}>-₦{fmt(breakdownModal.deductions?.total_deductions)}</span>
                    </li>
                  </ul>
                </div>
              </div>

              {/* Standalone Non-Gross Additions (Allowances & Bonuses) */}
              {((breakdownModal.earnings?.custom_allowances && breakdownModal.earnings.custom_allowances.length > 0) ||
                (breakdownModal.earnings?.bonuses && breakdownModal.earnings.bonuses.length > 0) ||
                (breakdownModal.earnings?.total_additions > 0)) && (
                <div className={styles.breakdownCard} style={{ border: '1px solid #bfdbfe', background: '#f8fafc' }}>
                  <div className={styles.breakdownCardHeader} style={{ background: '#eff6ff', color: '#1e40af', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <TrendingUp size={16} style={{ color: '#2563eb' }} />
                      Standalone Additions (Non-Gross Allowances & Bonuses)
                    </span>
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#2563eb' }}>
                      Total Additions: +₦{fmt(breakdownModal.earnings?.total_additions)}
                    </span>
                  </div>
                  <ul className={styles.breakdownList}>
                    {breakdownModal.earnings?.custom_allowances && breakdownModal.earnings.custom_allowances.map((ca, idx) => (
                      <li key={`ca-${idx}`} className={styles.breakdownListItem} style={{ background: '#ffffff' }}>
                        <div>
                          <span style={{ fontWeight: 600, color: '#0f172a', display: 'block' }}>{ca.title}</span>
                          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                            {ca.frequency === 'one_time' ? 'One-Time Allowance' : 'Recurring Allowance'}
                          </span>
                        </div>
                        <strong style={{ color: '#059669', fontSize: '0.95rem' }}>+₦{fmt(ca.amount)}</strong>
                      </li>
                    ))}
                    {breakdownModal.earnings?.bonuses && breakdownModal.earnings.bonuses.map((b, idx) => (
                      <li key={`b-${idx}`} className={styles.breakdownListItem} style={{ background: '#ffffff' }}>
                        <div>
                          <span style={{ fontWeight: 600, color: '#0f172a', display: 'block' }}>{b.title}</span>
                          <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                            {b.frequency === 'one_time' ? 'One-Time Bonus' : 'Recurring Bonus'}
                          </span>
                        </div>
                        <strong style={{ color: '#d97706', fontSize: '0.95rem' }}>+₦{fmt(b.amount)}</strong>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Savings & Outstanding Balances Summary Card */}
              <div className={styles.balancesOverviewCard}>
                <div className={styles.balancesOverviewHeader}>
                  <h3 className={styles.balancesOverviewTitle}>
                    <PiggyBank size={20} style={{ color: '#059669' }} />
                    <span>Savings & Outstanding Balances Summary</span>
                  </h3>
                  <span className={styles.balancesOverviewSub}>
                    Real-time snapshot of cooperative savings accumulation & active loan balances
                  </span>
                </div>

                <div className={styles.balancesOverviewGrid}>
                  {/* 1. Cooperative Savings Balance */}
                  <div className={`${styles.overviewCardItem} ${styles.overviewCardSavings}`}>
                    <div className={`${styles.overviewIconWrap} ${styles.overviewIconSavings}`}>
                      <Wallet size={22} />
                    </div>
                    <div className={styles.overviewItemInfo}>
                      <div className={styles.overviewItemLabel}>Cooperative Savings Balance</div>
                      <div className={styles.overviewItemValueSavings}>
                        ₦{fmt(breakdownModal.deductions?.coop_savings?.balance_remaining ?? breakdownModal.balances?.coop_savings_balance ?? 0)}
                      </div>
                      <div className={styles.overviewItemDetail}>
                        {breakdownModal.deductions?.coop_savings?.amount > 0 ? (
                          <span style={{ color: '#047857', fontWeight: 600 }}>
                            + ₦{fmt(breakdownModal.deductions.coop_savings.amount)}/mo deduction
                          </span>
                        ) : (
                          <span>Cumulative savings balance</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 2. Cooperative Loan Balance */}
                  <div className={styles.overviewCardItem}>
                    <div className={`${styles.overviewIconWrap} ${styles.overviewIconLoan}`}>
                      <CreditCard size={22} />
                    </div>
                    <div className={styles.overviewItemInfo}>
                      <div className={styles.overviewItemLabel}>Cooperative Loan Balance</div>
                      <div className={styles.overviewItemValue}>
                        ₦{fmt(breakdownModal.deductions?.coop_loan?.balance_remaining ?? breakdownModal.balances?.coop_loan_balance ?? 0)}
                      </div>
                      <div className={styles.overviewItemDetail}>
                        {breakdownModal.deductions?.coop_loan?.amount > 0 ? (
                          <span>- ₦{fmt(breakdownModal.deductions.coop_loan.amount)}/mo repayment</span>
                        ) : (
                          <span>No active coop loan balance</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 3. Coop Asset Finance Balance */}
                  <div className={styles.overviewCardItem}>
                    <div className={`${styles.overviewIconWrap} ${styles.overviewIconAsset}`}>
                      <ShoppingBag size={22} />
                    </div>
                    <div className={styles.overviewItemInfo}>
                      <div className={styles.overviewItemLabel}>Coop Asset Finance Balance</div>
                      <div className={styles.overviewItemValue}>
                        ₦{fmt(breakdownModal.deductions?.coop_asset_finance?.balance_remaining ?? breakdownModal.balances?.coop_asset_finance_balance ?? 0)}
                      </div>
                      <div className={styles.overviewItemDetail}>
                        {breakdownModal.deductions?.coop_asset_finance?.amount > 0 ? (
                          <span>- ₦{fmt(breakdownModal.deductions.coop_asset_finance.amount)}/mo deduction</span>
                        ) : (
                          <span>No active asset finance</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 4. Medical Loan Balance */}
                  <div className={styles.overviewCardItem}>
                    <div className={`${styles.overviewIconWrap} ${styles.overviewIconMedical}`}>
                      <HeartPulse size={22} />
                    </div>
                    <div className={styles.overviewItemInfo}>
                      <div className={styles.overviewItemLabel}>Medical Loan Balance</div>
                      <div className={styles.overviewItemValue}>
                        ₦{fmt(breakdownModal.deductions?.medical_loan?.balance_remaining ?? breakdownModal.balances?.medical_loan_balance ?? 0)}
                      </div>
                      <div className={styles.overviewItemDetail}>
                        {breakdownModal.deductions?.medical_loan?.amount > 0 ? (
                          <span>- ₦{fmt(breakdownModal.deductions.medical_loan.amount)}/mo deduction</span>
                        ) : (
                          <span>No active medical loan</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bank & Payment Info Box */}
              <div style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '0.75rem 1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem', fontSize: '0.8rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>
                  <CreditCard size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} />
                  Disbursement Bank: <strong>{breakdownModal.staff?.bank_name || 'N/A'}</strong> | Acc: <strong>{breakdownModal.staff?.account_number || 'N/A'}</strong>
                </span>
                <span style={{ color: 'var(--text-secondary)' }}>
                  RSA PIN: <strong>{breakdownModal.staff?.rsa_pin || 'N/A'}</strong>
                </span>
              </div>
            </div>

            <div className={styles.modalFooter}>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnSecondary}`}
                onClick={() => setBreakdownModal(null)}
              >
                Close
              </button>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnPrimary}`}
                onClick={handlePrint}
              >
                <Printer size={16} />
                Print Breakdown
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
