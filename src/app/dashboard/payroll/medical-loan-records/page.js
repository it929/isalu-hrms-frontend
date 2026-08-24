"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import Link from 'next/link';
import { 
  Activity, 
  Calendar, 
  Search, 
  Filter, 
  Loader2, 
  FileText, 
  Printer, 
  Download, 
  RefreshCw, 
  User, 
  CheckCircle2, 
  ArrowRight, 
  Clock, 
  ExternalLink, 
  X, 
  ChevronDown, 
  Receipt, 
  TrendingUp, 
  AlertCircle,
  Sparkles,
  Info
} from 'lucide-react';
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

function formatDate(dStr) {
  if (!dStr) return '—';
  try {
    const d = new Date(dStr);
    if (isNaN(d.getTime())) return dStr;
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return dStr;
  }
}

export default function MedicalLoanRecordsPage() {
  // Loading & Toast States
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [mounted, setMounted] = useState(false);

  // User Context State
  const [userCtx, setUserCtx] = useState({
    isSuperAdmin: false,
    isHod: false,
    isAdminStaff: false,
    isAuditStaff: false,
    isFinanceStaff: false,
    employee: null,
  });

  // Data States
  const [staffList, setStaffList] = useState([]);
  const [records, setRecords] = useState([]);
  const [staffSetup, setStaffSetup] = useState(null);
  const [summary, setSummary] = useState({
    total_disbursed: 0,
    total_entries: 0,
    total_outstanding: 0,
    active_staff_count: 0,
  });

  // Date Range & Search Filter States
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activePreset, setActivePreset] = useState('all');

  // Staff Autocomplete Dropdown State (for privileged users)
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [staffDropdownSearch, setStaffDropdownSearch] = useState('');
  const [showStaffDropdown, setShowStaffDropdown] = useState(false);
  const dropdownRef = useRef(null);

  // View Record Modal State
  const [viewRecord, setViewRecord] = useState(null);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState('10');

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4500);
  }, []);

  // Fetch staff list for admin dropdown
  const fetchStaffList = useCallback(async () => {
    const cacheKey = 'hrms_medical_loan_staff_cache';
    if (typeof window !== 'undefined') {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        try {
          setStaffList(JSON.parse(cached));
          return;
        } catch { /* ignore */ }
      }
    }

    try {
      const headers = buildHeaders();
      const res = await axios.get(`${API_BASE}/payroll/medical-loan-entries/staff-balance/0`, { headers }).catch(() => null);
      // If direct staff list endpoint exists in apply-loan, fallback
      const staffRes = await axios.get(`${API_BASE}/payroll/apply-loan`, { headers });
      if (staffRes.data?.staff) {
        setStaffList(staffRes.data.staff);
        if (typeof window !== 'undefined') {
          sessionStorage.setItem(cacheKey, JSON.stringify(staffRes.data.staff));
        }
      }
    } catch {
      // ignore
    }
  }, []);

  // Fetch Medical Loan Records from Backend
  const fetchRecords = useCallback(async (customFrom = fromDate, customTo = toDate, customStaffId = selectedStaff?.id) => {
    setLoading(true);
    try {
      const headers = buildHeaders();
      const params = {};
      if (customFrom) params.from_date = customFrom;
      if (customTo) params.to_date = customTo;
      if (customStaffId) params.staffId = customStaffId;

      const res = await axios.get(`${API_BASE}/payroll/medical-loan-entries`, {
        headers,
        params,
      });

      if (res.data.status === 'success') {
        setRecords(res.data.data || []);
        setSummary(res.data.summary || {
          total_disbursed: 0,
          total_entries: 0,
          total_outstanding: 0,
          active_staff_count: 0,
        });
        setStaffSetup(res.data.staff_setup || null);
        const isUserPrivileged = !!res.data.isPrivileged;
        setUserCtx({
          isSuperAdmin: !!res.data.isSuperAdmin,
          isHod: !!res.data.isHod,
          isAdminStaff: !!res.data.isAdminStaff,
          isAuditStaff: !!res.data.isAuditStaff,
          isFinanceStaff: !!res.data.isFinanceStaff,
          isPrivileged: isUserPrivileged,
          employee: res.data.employee || null,
        });

        // Only privileged users (Super Admin, HR Head, Audit Head, Finance Head) need staff list for the selector
        if (isUserPrivileged) {
          fetchStaffList();
        }
      }
    } catch (err) {
      console.error('Failed to load medical loan records:', err);
      showToast('Failed to retrieve medical loan records.', 'error');
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate, selectedStaff, showToast, fetchStaffList]);

  // Initial Load
  useEffect(() => {
    setMounted(true);
    fetchRecords();
  }, [fetchRecords]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowStaffDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle Preset Date Filter
  const applyPreset = (preset) => {
    setActivePreset(preset);
    const now = new Date();
    let from = '';
    let to = '';

    if (preset === 'today') {
      from = now.toISOString().split('T')[0];
      to = from;
    } else if (preset === 'this_month') {
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, '0');
      from = `${y}-${m}-01`;
      const lastDay = new Date(y, now.getMonth() + 1, 0).getDate();
      to = `${y}-${m}-${String(lastDay).padStart(2, '0')}`;
    } else if (preset === 'last_30_days') {
      const past = new Date();
      past.setDate(past.getDate() - 30);
      from = past.toISOString().split('T')[0];
      to = now.toISOString().split('T')[0];
    } else if (preset === 'this_year') {
      const y = now.getFullYear();
      from = `${y}-01-01`;
      to = `${y}-12-31`;
    } else if (preset === 'last_year') {
      const y = now.getFullYear() - 1;
      from = `${y}-01-01`;
      to = `${y}-12-31`;
    } else {
      // 'all'
      from = '';
      to = '';
    }

    setFromDate(from);
    setToDate(to);
    fetchRecords(from, to, selectedStaff?.id);
  };

  // Reset all filters
  const resetFilters = () => {
    setFromDate('');
    setToDate('');
    setSearchQuery('');
    setActivePreset('all');
    setSelectedStaff(null);
    setStaffDropdownSearch('');
    fetchRecords('', '', null);
  };

  // Filter client-side by keyword
  const filteredRecords = records.filter((r) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const nameMatch = r.name ? r.name.toLowerCase().includes(q) : false;
    const fileMatch = r.fileNo ? r.fileNo.toLowerCase().includes(q) : false;
    const reasonMatch = r.reason ? r.reason.toLowerCase().includes(q) : false;
    const dateMatch = r.loan_date ? r.loan_date.includes(q) : false;
    const amountMatch = String(r.amount).includes(q);
    const creatorMatch = r.creator_name ? r.creator_name.toLowerCase().includes(q) : false;
    return nameMatch || fileMatch || reasonMatch || dateMatch || amountMatch || creatorMatch;
  });

  // Client-side pagination
  const totalPages = itemsPerPage === 'all'
    ? 1
    : Math.ceil(filteredRecords.length / parseInt(itemsPerPage, 10)) || 1;
  const paginatedRecords = itemsPerPage === 'all'
    ? filteredRecords
    : filteredRecords.slice(
        (currentPage - 1) * parseInt(itemsPerPage, 10),
        currentPage * parseInt(itemsPerPage, 10)
      );

  // Privileged check (Super Admin, HR Head, Audit Head, Finance Head)
  const isPrivileged = !!userCtx.isPrivileged;

  // Filtered staff list for dropdown
  const filteredStaffDropdown = staffList.filter((s) => {
    if (!staffDropdownSearch.trim()) return true;
    const q = staffDropdownSearch.toLowerCase();
    const name = s.name ? s.name.toLowerCase() : '';
    const file = s.fileNo ? s.fileNo.toLowerCase() : '';
    const dept = s.department ? s.department.toLowerCase() : '';
    return name.includes(q) || file.includes(q) || dept.includes(q);
  });

  // Export to CSV
  const exportToCSV = () => {
    if (records.length === 0) {
      showToast('No records to export.', 'error');
      return;
    }

    const headers = ['S/N', 'Loan Date', 'Staff Name', 'File No', 'Department', 'Loan Amount (NGN)', 'Balance Before (NGN)', 'Balance After (NGN)', 'Monthly Deduction (NGN)', 'Duration (Months)', 'Reason', 'Recorded By', 'Created At'];
    const rows = records.map((r, i) => [
      i + 1,
      r.loan_date,
      `"${(r.name || '').replace(/"/g, '""')}"`,
      r.fileNo || '',
      `"${(r.department || '').replace(/"/g, '""')}"`,
      r.amount,
      r.balance_before,
      r.balance_after,
      r.monthly_deduction,
      r.duration_months,
      `"${(r.reason || '').replace(/"/g, '""')}"`,
      `"${(r.creator_name || '').replace(/"/g, '""')}"`,
      r.created_at || ''
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `medical_loan_records_${fromDate || 'all'}_to_${toDate || 'all'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Print Statement
  const handlePrint = () => {
    window.print();
  };

  if (!mounted) {
    return (
      <div className={styles.container} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '300px' }}>
        <Loader2 size={32} className="animate-spin" style={{ color: 'var(--primary)' }} />
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            style={{
              position: 'fixed',
              top: '20px',
              right: '20px',
              zIndex: 1000,
              padding: '12px 20px',
              borderRadius: '8px',
              background: toast.type === 'error' ? '#ef4444' : '#10b981',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              fontWeight: 500,
              fontSize: '0.875rem',
            }}
          >
            {toast.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
            <span>{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>
            <Activity size={28} style={{ color: '#ec4899' }} />
            {isPrivileged ? 'Medical Loan Records' : 'My Medical Loan Records'}
          </h1>
          <p className={styles.subtitle}>
            {isPrivileged 
              ? 'View and search all staff medical loan disbursement statements, cumulative loan history, and repayment deduction balances from date to date.'
              : 'View your personal medical loan disbursements, repayment history, and deduction balances from date to date.'}
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
          {isPrivileged && (
            <Link 
              href="/dashboard/payroll/medical-loan-entry"
              className={`${styles.btn} ${styles.btnPrimary}`}
              style={{ fontSize: '0.85rem' }}
            >
              <Activity size={16} />
              <span>Record Loan Entry</span>
            </Link>
          )}

          <button 
            type="button"
            onClick={exportToCSV}
            className={`${styles.btn} ${styles.btnSecondary}`}
            style={{ fontSize: '0.85rem' }}
            title="Export Records to CSV"
          >
            <Download size={16} />
            <span>Export CSV</span>
          </button>

          <button 
            type="button"
            onClick={handlePrint}
            className={`${styles.btn} ${styles.btnSecondary}`}
            style={{ fontSize: '0.85rem' }}
            title="Print Statement"
          >
            <Printer size={16} />
            <span>Print</span>
          </button>

          <button 
            type="button"
            onClick={() => fetchRecords(fromDate, toDate, selectedStaff?.id)}
            disabled={loading}
            className={`${styles.btn} ${styles.btnSecondary} ${styles.btnIcon}`}
            title="Refresh Data"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Viewing Context Banner */}
      {selectedStaff ? (
        <div style={{ 
          background: 'rgba(236, 72, 153, 0.08)', 
          border: '1px solid rgba(236, 72, 153, 0.25)', 
          borderRadius: '10px', 
          padding: '0.75rem 1.25rem', 
          marginBottom: '1.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.5rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <User size={18} style={{ color: '#ec4899' }} />
            <span style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>
              Showing Statement for: <strong style={{ color: '#ec4899' }}>{selectedStaff.name}</strong> ({selectedStaff.fileNo || 'No File No.'}) — <em>{selectedStaff.department || 'No Dept'}</em>
            </span>
          </div>
          <button 
            type="button"
            onClick={() => {
              setSelectedStaff(null);
              setStaffDropdownSearch('');
              fetchRecords(fromDate, toDate, null);
            }}
            className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSm}`}
          >
            <X size={14} />
            <span>Show All Staff</span>
          </button>
        </div>
      ) : !isPrivileged && userCtx.employee ? (
        <div style={{ 
          background: 'rgba(59, 130, 246, 0.08)', 
          border: '1px solid rgba(59, 130, 246, 0.2)', 
          borderRadius: '10px', 
          padding: '0.75rem 1.25rem', 
          marginBottom: '1.5rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <Info size={18} style={{ color: '#3b82f6' }} />
          <span style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>
            Personal Medical Loan Statement for: <strong>{userCtx.employee.surname} {userCtx.employee.first_name} {userCtx.employee.othernames}</strong> ({userCtx.employee.fileNo})
          </span>
        </div>
      ) : null}

      {/* KPI Stats Grid */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: 'rgba(236, 72, 153, 0.12)', color: '#ec4899' }}>
            <NairaSign size={24} />
          </div>
          <div className={styles.statInfo}>
            <span className={styles.statLabel}>
              {fromDate || toDate ? 'Disbursed in Period' : 'Total Medical Loans'}
            </span>
            <span className={styles.statValue}>
              <NairaSign size={16} /> {fmt(summary.total_disbursed)}
            </span>
            <span className={styles.statSub}>
              {summary.total_entries} {summary.total_entries === 1 ? 'disbursement' : 'disbursements'}
            </span>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: 'rgba(239, 68, 68, 0.12)', color: '#ef4444' }}>
            <TrendingUp size={24} />
          </div>
          <div className={styles.statInfo}>
            <span className={styles.statLabel}>Outstanding Balance</span>
            <span className={styles.statValue} style={{ color: '#ef4444' }}>
              <NairaSign size={16} /> {fmt(summary.total_outstanding)}
            </span>
            <span className={styles.statSub}>
              {staffSetup?.is_active ? 'Active deduction plan' : 'Current unpaid balance'}
            </span>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: 'rgba(16, 185, 129, 0.12)', color: '#10b981' }}>
            <Clock size={24} />
          </div>
          <div className={styles.statInfo}>
            <span className={styles.statLabel}>Active Monthly Deduction</span>
            <span className={styles.statValue} style={{ color: '#10b981' }}>
              <NairaSign size={16} /> {fmt(staffSetup?.monthly_deduction || (records[0]?.monthly_deduction || 0))}
            </span>
            <span className={styles.statSub}>
              {staffSetup?.duration_months ? `Duration: ~${staffSetup.duration_months} months` : 'Per payroll compute'}
            </span>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: 'rgba(59, 130, 246, 0.12)', color: '#3b82f6' }}>
            <Receipt size={24} />
          </div>
          <div className={styles.statInfo}>
            <span className={styles.statLabel}>Total Entries</span>
            <span className={styles.statValue}>
              {summary.total_entries} Records
            </span>
            <span className={styles.statSub}>
              {isPrivileged && !selectedStaff ? `${summary.active_staff_count} active staff` : 'Disbursement history'}
            </span>
          </div>
        </div>
      </div>

      {/* Filter Card: Date-to-Date and Search Toolbar */}
      <div className={styles.filterCard}>
        <div className={styles.filterHeader}>
          <div className={styles.filterHeading}>
            <Filter size={18} style={{ color: '#ec4899' }} />
            <span>Search & Date Filter</span>
          </div>

          {/* Quick Date Presets */}
          <div className={styles.presetGroup}>
            <button 
              type="button" 
              onClick={() => applyPreset('all')} 
              className={`${styles.presetBtn} ${activePreset === 'all' ? styles.presetBtnActive : ''}`}
            >
              All Time
            </button>
            <button 
              type="button" 
              onClick={() => applyPreset('this_month')} 
              className={`${styles.presetBtn} ${activePreset === 'this_month' ? styles.presetBtnActive : ''}`}
            >
              This Month
            </button>
            <button 
              type="button" 
              onClick={() => applyPreset('last_30_days')} 
              className={`${styles.presetBtn} ${activePreset === 'last_30_days' ? styles.presetBtnActive : ''}`}
            >
              Last 30 Days
            </button>
            <button 
              type="button" 
              onClick={() => applyPreset('this_year')} 
              className={`${styles.presetBtn} ${activePreset === 'this_year' ? styles.presetBtnActive : ''}`}
            >
              This Year
            </button>
            <button 
              type="button" 
              onClick={() => applyPreset('last_year')} 
              className={`${styles.presetBtn} ${activePreset === 'last_year' ? styles.presetBtnActive : ''}`}
            >
              Last Year
            </button>
          </div>
        </div>

        <div className={styles.filterGrid}>
          {/* From Date */}
          <div className={styles.formGroup}>
            <label className={styles.label}>
              <Calendar size={14} style={{ color: 'var(--text-secondary)' }} />
              From Date
            </label>
            <input 
              type="date"
              value={fromDate}
              onChange={(e) => {
                setFromDate(e.target.value);
                setActivePreset('custom');
              }}
              className={styles.input}
            />
          </div>

          {/* To Date */}
          <div className={styles.formGroup}>
            <label className={styles.label}>
              <Calendar size={14} style={{ color: 'var(--text-secondary)' }} />
              To Date
            </label>
            <input 
              type="date"
              value={toDate}
              onChange={(e) => {
                setToDate(e.target.value);
                setActivePreset('custom');
              }}
              className={styles.input}
            />
          </div>

          {/* Privileged Staff Autocomplete Selector */}
          {isPrivileged && (
            <div className={styles.formGroup} ref={dropdownRef}>
              <label className={styles.label}>
                <User size={14} style={{ color: 'var(--text-secondary)' }} />
                Filter by Staff
              </label>
              <div className={styles.dropdownWrapper}>
                <div 
                  onClick={() => setShowStaffDropdown(!showStaffDropdown)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.55rem 0.75rem',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                    background: 'var(--surface)',
                    color: selectedStaff ? 'var(--text-primary)' : 'var(--text-secondary)',
                    fontSize: '0.875rem',
                    cursor: 'pointer',
                  }}
                >
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {selectedStaff ? `${selectedStaff.name} (${selectedStaff.fileNo})` : 'All Staff Members'}
                  </span>
                  <ChevronDown size={16} />
                </div>

                {showStaffDropdown && (
                  <div className={styles.dropdownList}>
                    <div style={{ padding: '0.35rem 0.35rem 0.5rem' }}>
                      <input 
                        type="text"
                        placeholder="Search staff name or file no..."
                        value={staffDropdownSearch}
                        onChange={(e) => setStaffDropdownSearch(e.target.value)}
                        className={styles.input}
                        style={{ fontSize: '0.8rem', padding: '0.4rem 0.6rem' }}
                        autoFocus
                      />
                    </div>
                    <div 
                      className={`${styles.dropdownItem} ${!selectedStaff ? styles.dropdownItemSelected : ''}`}
                      onClick={() => {
                        setSelectedStaff(null);
                        setShowStaffDropdown(false);
                        fetchRecords(fromDate, toDate, null);
                      }}
                    >
                      <span>All Staff Members</span>
                    </div>
                    {filteredStaffDropdown.map((s) => (
                      <div 
                        key={s.id}
                        className={`${styles.dropdownItem} ${selectedStaff?.id === s.id ? styles.dropdownItemSelected : ''}`}
                        onClick={() => {
                          setSelectedStaff(s);
                          setShowStaffDropdown(false);
                          fetchRecords(fromDate, toDate, s.id);
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 500 }}>{s.name}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                            {s.fileNo} • {s.department || 'No Dept'}
                          </div>
                        </div>
                      </div>
                    ))}
                    {filteredStaffDropdown.length === 0 && (
                      <div style={{ padding: '0.75rem', textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        No staff found
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Keyword Search */}
          <div className={styles.formGroup}>
            <label className={styles.label}>
              <Search size={14} style={{ color: 'var(--text-secondary)' }} />
              Keyword Search
            </label>
            <input 
              type="text"
              placeholder="Search reason, amount, staff..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={styles.input}
            />
          </div>
        </div>

        {/* Filter Action Buttons */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '0.5rem', marginTop: '1.25rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border)' }}>
          <button 
            type="button"
            onClick={resetFilters}
            className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSm}`}
          >
            <X size={14} />
            <span>Reset Filters</span>
          </button>

          <button 
            type="button"
            onClick={() => fetchRecords(fromDate, toDate, selectedStaff?.id)}
            disabled={loading}
            className={`${styles.btn} ${styles.btnPrimary} ${styles.btnSm}`}
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
            <span>Apply Filter</span>
          </button>
        </div>
      </div>

      {/* Medical Loan Records Table Card */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h2 className={styles.cardTitle}>
            <Receipt size={18} style={{ color: '#ec4899' }} />
            <span>Medical Loan Disbursement Statement</span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 400 }}>
              ({filteredRecords.length} {filteredRecords.length === 1 ? 'record' : 'records'})
            </span>
          </h2>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              <span>Show:</span>
              <select
                value={itemsPerPage}
                onChange={(e) => {
                  setItemsPerPage(e.target.value);
                  setCurrentPage(1);
                }}
                className={styles.input}
                style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem', width: 'auto' }}
              >
                <option value="10">10</option>
                <option value="25">25</option>
                <option value="50">50</option>
                <option value="all">All</option>
              </select>
            </div>
          </div>
        </div>

        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th style={{ width: '40px' }}>#</th>
                <th>Loan Date</th>
                {isPrivileged && !selectedStaff && <th>Staff Member</th>}
                <th className={styles.tdNum}>Loan Amount</th>
                <th className={styles.tdNum}>Bal. Before</th>
                <th className={styles.tdNum}>Bal. After</th>
                <th className={styles.tdNum}>Monthly Deduction</th>
                <th>Duration</th>
                <th>Purpose / Reason</th>
                <th>Disbursed By</th>
                <th style={{ textAlign: 'center' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={isPrivileged && !selectedStaff ? 11 : 10} style={{ textAlign: 'center', padding: '3rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem' }}>
                      <Loader2 size={28} className="animate-spin" style={{ color: '#ec4899' }} />
                      <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Loading medical loan records...</span>
                    </div>
                  </td>
                </tr>
              ) : paginatedRecords.length === 0 ? (
                <tr>
                  <td colSpan={isPrivileged && !selectedStaff ? 11 : 10} style={{ textAlign: 'center', padding: '3rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                      <FileText size={36} style={{ color: 'var(--text-secondary)', opacity: 0.4 }} />
                      <p style={{ margin: 0, fontWeight: 600, color: 'var(--text-primary)' }}>No medical loan records found</p>
                      <p style={{ margin: 0, fontSize: '0.825rem', color: 'var(--text-secondary)' }}>
                        {fromDate || toDate ? 'Try adjusting your date range filter or search term.' : 'No medical loans have been recorded yet.'}
                      </p>
                      {(fromDate || toDate || searchQuery || selectedStaff) && (
                        <button 
                          type="button" 
                          onClick={resetFilters} 
                          className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSm}`}
                          style={{ marginTop: '0.5rem' }}
                        >
                          Clear Filters
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedRecords.map((row, idx) => {
                  const sNo = itemsPerPage === 'all' ? idx + 1 : (currentPage - 1) * parseInt(itemsPerPage, 10) + idx + 1;
                  return (
                    <tr key={row.id}>
                      <td style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{sNo}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <Calendar size={13} style={{ color: '#ec4899' }} />
                          {formatDate(row.loan_date)}
                        </div>
                      </td>

                      {isPrivileged && !selectedStaff && (
                        <td>
                          <div>
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{row.name}</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                              {row.fileNo} • {row.department || 'General'}
                            </div>
                          </div>
                        </td>
                      )}

                      <td className={styles.tdNum}>
                        <span style={{ color: '#ec4899', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                          <NairaSign size={13} /> {fmt(row.amount)}
                        </span>
                      </td>

                      <td className={styles.tdNum} style={{ color: 'var(--text-secondary)' }}>
                        ₦{fmt(row.balance_before)}
                      </td>

                      <td className={styles.tdNum} style={{ color: '#ef4444', fontWeight: 600 }}>
                        ₦{fmt(row.balance_after)}
                      </td>

                      <td className={styles.tdNum} style={{ color: '#10b981', fontWeight: 600 }}>
                        ₦{fmt(row.monthly_deduction)}
                      </td>

                      <td>
                        <span className={`${styles.badge} ${styles.badgePink}`}>
                          {row.duration_months} {row.duration_months === 1 ? 'month' : 'months'}
                        </span>
                      </td>

                      <td style={{ maxWidth: '240px' }}>
                        <div style={{ 
                          whiteSpace: 'nowrap', 
                          overflow: 'hidden', 
                          textOverflow: 'ellipsis',
                          fontSize: '0.85rem' 
                        }} title={row.reason}>
                          {row.reason}
                        </div>
                      </td>

                      <td style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                        {row.creator_name}
                      </td>

                      <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                        <button
                          type="button"
                          onClick={() => setViewRecord(row)}
                          className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSm}`}
                          title="View Statement Breakdown"
                        >
                          <FileText size={14} />
                          <span>Details</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            padding: '1rem 1.5rem', 
            borderTop: '1px solid var(--border)',
            flexWrap: 'wrap',
            gap: '0.75rem'
          }}>
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
              Showing {Math.min(filteredRecords.length, (currentPage - 1) * parseInt(itemsPerPage, 10) + 1)} to {Math.min(filteredRecords.length, currentPage * parseInt(itemsPerPage, 10))} of {filteredRecords.length} records
            </span>

            <div style={{ display: 'flex', gap: '0.35rem' }}>
              <button
                type="button"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSm}`}
              >
                Previous
              </button>

              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => {
                // Limit pagination buttons if too many
                if (totalPages > 7 && Math.abs(p - currentPage) > 2 && p !== 1 && p !== totalPages) {
                  return null;
                }
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setCurrentPage(p)}
                    className={`${styles.btn} ${p === currentPage ? styles.btnPrimary : styles.btnSecondary} ${styles.btnSm}`}
                    style={{ minWidth: '32px' }}
                  >
                    {p}
                  </button>
                );
              })}

              <button
                type="button"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className={`${styles.btn} ${styles.btnSecondary} ${styles.btnSm}`}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Record Detail Modal */}
      <AnimatePresence>
        {viewRecord && (
          <div className={styles.modalOverlay} onClick={() => setViewRecord(null)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={styles.modalContent}
              onClick={(e) => e.stopPropagation()}
            >
              <div className={styles.modalHeader}>
                <h3 className={styles.modalTitle}>
                  <Receipt size={20} style={{ color: '#ec4899' }} />
                  Medical Loan Disbursement Slip
                </h3>
                <button
                  type="button"
                  onClick={() => setViewRecord(null)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)' }}
                >
                  <X size={20} />
                </button>
              </div>

              <div className={styles.modalBody}>
                {/* Staff Summary Box */}
                <div style={{ 
                  background: 'var(--bg-hover, rgba(0,0,0,0.03))', 
                  borderRadius: '10px', 
                  padding: '1rem',
                  border: '1px solid var(--border)'
                }}>
                  <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {viewRecord.name}
                  </div>
                  <div style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', marginTop: '3px' }}>
                    File No: <strong>{viewRecord.fileNo}</strong> • Department: <strong>{viewRecord.department || 'General'}</strong>
                  </div>
                </div>

                {/* Details Breakdown */}
                <div>
                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>Disbursement Date:</span>
                    <span className={styles.detailValue}>{formatDate(viewRecord.loan_date)}</span>
                  </div>

                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>Medical Loan Added:</span>
                    <span className={styles.detailValue} style={{ color: '#ec4899', fontSize: '1.05rem' }}>
                      <NairaSign size={14} /> {fmt(viewRecord.amount)}
                    </span>
                  </div>

                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>Previous Balance:</span>
                    <span className={styles.detailValue}>₦{fmt(viewRecord.balance_before)}</span>
                  </div>

                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>New Total Balance Remaining:</span>
                    <span className={styles.detailValue} style={{ color: '#ef4444' }}>
                      ₦{fmt(viewRecord.balance_after)}
                    </span>
                  </div>

                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>Monthly Payroll Deduction:</span>
                    <span className={styles.detailValue} style={{ color: '#10b981' }}>
                      ₦{fmt(viewRecord.monthly_deduction)} / month
                    </span>
                  </div>

                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>Repayment Duration:</span>
                    <span className={styles.detailValue}>{viewRecord.duration_months} Months</span>
                  </div>

                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>Processed By:</span>
                    <span className={styles.detailValue}>{viewRecord.creator_name}</span>
                  </div>

                  <div className={styles.detailRow}>
                    <span className={styles.detailLabel}>System Timestamp:</span>
                    <span className={styles.detailValue} style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      {viewRecord.created_at || '—'}
                    </span>
                  </div>
                </div>

                {/* Reason Box */}
                <div>
                  <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-primary)', display: 'block', marginBottom: '0.35rem' }}>
                    Reason / Diagnosis / Notes:
                  </label>
                  <div style={{ 
                    background: 'var(--bg-hover, rgba(0,0,0,0.02))', 
                    border: '1px solid var(--border)', 
                    borderRadius: '8px', 
                    padding: '0.75rem', 
                    fontSize: '0.875rem',
                    color: 'var(--text-primary)',
                    lineHeight: 1.4
                  }}>
                    {viewRecord.reason}
                  </div>
                </div>
              </div>

              <div className={styles.modalFooter}>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className={`${styles.btn} ${styles.btnSecondary}`}
                >
                  <Printer size={16} />
                  <span>Print Slip</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewRecord(null)}
                  className={`${styles.btn} ${styles.btnPrimary}`}
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
