"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import Link from 'next/link';
import { 
  Users, 
  Search, 
  Loader2, 
  FileText, 
  AlertCircle, 
  CheckCircle2, 
  Trash2, 
  Plus, 
  Settings, 
  Calendar, 
  TrendingUp, 
  Activity, 
  ArrowRight, 
  DollarSign, 
  Clock, 
  UserCheck, 
  Sparkles,
  ExternalLink,
  Receipt,
  Info
} from 'lucide-react';
import NairaSign from '@/components/ui/NairaSign';
import styles from '../apply-coop-loan/page.module.css';

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

// Client-side helper matching backend deduction tier logic
function calculateProjectedDeduction(balance) {
  const num = parseFloat(balance);
  if (isNaN(num) || num <= 0) return { deduction: 0, duration: 0 };

  let deduction = 0;
  if (num < 5000) {
    deduction = num;
  } else if (num >= 5000 && num <= 10000) {
    deduction = 5000;
  } else if (num > 10000 && num <= 30000) {
    deduction = 10000;
  } else if (num > 30000 && num <= 60000) {
    deduction = 15000;
  } else if (num > 60000 && num <= 120000) {
    deduction = 20000;
  } else if (num > 120000 && num <= 160000) {
    deduction = 25000;
  } else if (num > 160000 && num <= 300000) {
    deduction = 30000;
  } else if (num > 300000 && num <= 600000) {
    deduction = 35000;
  } else {
    deduction = 50000;
  }

  let tempBal = num;
  let durationMonths = 0;
  while (tempBal > 0) {
    let currentDeduct = 0;
    if (tempBal < 5000) {
      currentDeduct = tempBal;
    } else if (tempBal >= 5000 && tempBal <= 10000) {
      currentDeduct = 5000;
    } else if (tempBal > 10000 && tempBal <= 30000) {
      currentDeduct = 10000;
    } else if (tempBal > 30000 && tempBal <= 60000) {
      currentDeduct = 15000;
    } else if (tempBal > 60000 && tempBal <= 120000) {
      currentDeduct = 20000;
    } else if (tempBal > 120000 && tempBal <= 160000) {
      currentDeduct = 25000;
    } else if (tempBal > 160000 && tempBal <= 300000) {
      currentDeduct = 30000;
    } else if (tempBal > 300000 && tempBal <= 600000) {
      currentDeduct = 35000;
    } else {
      currentDeduct = 50000;
    }

    if (currentDeduct <= 0) break;
    tempBal -= currentDeduct;
    durationMonths++;
    if (durationMonths > 1000) break;
  }

  return { deduction, duration: durationMonths };
}

export default function MedicalLoanEntryPage() {
  // Loading & Toast States
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [mounted, setMounted] = useState(false);

  // Data States
  const [staffList, setStaffList] = useState([]);
  const [entries, setEntries] = useState([]);
  const [summary, setSummary] = useState({
    total_disbursed: 0,
    total_entries: 0,
    total_outstanding: 0,
    active_staff_count: 0,
  });

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [monthFilter, setMonthFilter] = useState('');

  // Dropdown Autocomplete Staff State
  const [dropdownSearch, setDropdownSearch] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState(null);
  const dropdownRef = useRef(null);

  // Selected Staff Balance & Live Simulation State
  const [staffBalanceInfo, setStaffBalanceInfo] = useState(null);
  const [loadingStaffInfo, setLoadingStaffInfo] = useState(false);

  // Form Fields
  const [loanDate, setLoanDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');

  // Modal States
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Client-side pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState('10');

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, monthFilter, itemsPerPage]);

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4500);
  }, []);

  // Fetch static staff list
  const fetchStaffData = useCallback(async () => {
    const cacheKeyStaff = 'hrms_coop_loans_staff_cache';
    if (typeof window !== 'undefined') {
      const cachedStaff = sessionStorage.getItem(cacheKeyStaff);
      if (cachedStaff) {
        setStaffList(JSON.parse(cachedStaff));
        return;
      }
    }
    const headers = buildHeaders();
    try {
      const staffRes = await axios.get(`${API_BASE}/payroll/coop-loans/staff`, { headers });
      if (staffRes.data.status === 'success') {
        const freshStaff = staffRes.data.data || [];
        setStaffList(freshStaff);
        if (typeof window !== 'undefined') {
          sessionStorage.setItem(cacheKeyStaff, JSON.stringify(freshStaff));
        }
      }
    } catch (err) {
      console.error('Failed to retrieve staff list:', err);
    }
  }, []);

  // Fetch medical loan entries history & summary
  const fetchEntries = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    const headers = buildHeaders();
    try {
      const res = await axios.get(`${API_BASE}/payroll/medical-loan-entries`, { headers });
      if (res.data.status === 'success') {
        setEntries(res.data.data || []);
        if (res.data.summary) {
          setSummary(res.data.summary);
        }
      }
    } catch (err) {
      showToast('Failed to retrieve medical loan entries.', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  // Fetch individual staff's current medical loan balance
  const fetchStaffBalanceInfo = useCallback(async (staffId) => {
    setLoadingStaffInfo(true);
    try {
      const headers = buildHeaders();
      const res = await axios.get(`${API_BASE}/payroll/medical-loan-entries/staff-balance/${staffId}`, { headers });
      if (res.data.status === 'success') {
        setStaffBalanceInfo(res.data);
      } else {
        setStaffBalanceInfo(null);
      }
    } catch (err) {
      console.error('Failed to fetch staff medical loan balance:', err);
      setStaffBalanceInfo(null);
    } finally {
      setLoadingStaffInfo(false);
    }
  }, []);

  useEffect(() => {
    fetchStaffData();
    fetchEntries();
    setMounted(true);
  }, [fetchStaffData, fetchEntries]);

  // Staff dropdown selection effect
  useEffect(() => {
    if (selectedStaff) {
      fetchStaffBalanceInfo(selectedStaff.id);
    } else {
      setStaffBalanceInfo(null);
    }
  }, [selectedStaff, fetchStaffBalanceInfo]);

  // Click outside listener for staff dropdown
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelectStaff = (staff) => {
    setSelectedStaff(staff);
    setDropdownSearch(staff.name);
    setShowDropdown(false);
  };

  const handleClearForm = () => {
    setSelectedStaff(null);
    setDropdownSearch('');
    setStaffBalanceInfo(null);
    setAmount('');
    setReason('');
    const today = new Date();
    setLoanDate(today.toISOString().split('T')[0]);
  };

  // Submit new medical loan entry
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedStaff) {
      showToast('Please select a staff member.', 'error');
      return;
    }

    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) {
      showToast('Please enter a valid loan amount.', 'error');
      return;
    }

    if (!loanDate) {
      showToast('Please specify the loan disbursement date.', 'error');
      return;
    }

    if (!reason.trim()) {
      showToast('Please provide a reason / medical purpose for the loan.', 'error');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        staffId: selectedStaff.id,
        loan_date: loanDate,
        amount: amt,
        reason: reason.trim(),
      };

      const res = await axios.post(`${API_BASE}/payroll/medical-loan-entries`, payload, {
        headers: buildHeaders()
      });

      if (res.data.status === 'success') {
        showToast(res.data.message || 'Medical loan entry recorded and deduction setup updated successfully.');
        handleClearForm();
        fetchEntries(true);
      } else {
        showToast(res.data.message || 'Failed to record entry.', 'error');
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Server error recording medical loan entry.', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Delete entry and roll back balance
  const handleDelete = (entry) => {
    setConfirmDelete(entry);
  };

  const handleConfirmDelete = async () => {
    if (!confirmDelete) return;
    setActionLoading(true);
    try {
      const res = await axios.delete(`${API_BASE}/payroll/medical-loan-entries/${confirmDelete.id}`, {
        headers: buildHeaders()
      });
      if (res.data.status === 'success') {
        showToast(res.data.message || 'Entry deleted and balance adjusted successfully.');
        fetchEntries(true);
        if (selectedStaff && selectedStaff.id === confirmDelete.staffId) {
          fetchStaffBalanceInfo(selectedStaff.id);
        }
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Server error deleting entry.', 'error');
    } finally {
      setActionLoading(false);
      setConfirmDelete(null);
    }
  };

  // Quick amount chip helper
  const handleQuickAmount = (val) => {
    setAmount(val.toString());
  };

  const filteredStaff = dropdownSearch.trim() === ''
    ? staffList
    : staffList.filter(s =>
        s.name.toLowerCase().includes(dropdownSearch.toLowerCase()) ||
        String(s.id).includes(dropdownSearch) ||
        (s.fileNo && String(s.fileNo).toLowerCase().includes(dropdownSearch.toLowerCase()))
      );

  const filteredEntries = entries.filter(e => {
    if (monthFilter && !e.loan_date?.startsWith(monthFilter)) {
      return false;
    }
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      e.name?.toLowerCase().includes(q) ||
      String(e.staffId).includes(q) ||
      String(e.fileNo || '').toLowerCase().includes(q) ||
      e.reason?.toLowerCase().includes(q)
    );
  });

  const totalPages = itemsPerPage === 'all'
    ? 1
    : Math.ceil(filteredEntries.length / parseInt(itemsPerPage, 10)) || 1;
  const paginatedEntries = itemsPerPage === 'all'
    ? filteredEntries
    : filteredEntries.slice(
        (currentPage - 1) * parseInt(itemsPerPage, 10),
        currentPage * parseInt(itemsPerPage, 10)
      );

  // Live calculation values
  const currentBalance = staffBalanceInfo?.current_setup?.balance_remaining || 0;
  const currentDeduction = staffBalanceInfo?.current_setup?.monthly_deduction || 0;
  const parsedAmt = parseFloat(amount) || 0;
  const projectedBalance = currentBalance + parsedAmt;
  const projectedCalc = calculateProjectedDeduction(projectedBalance);

  if (!mounted) {
    return (
      <div className={styles.container} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '300px' }}>
        <Loader2 size={32} className="animate-spin" style={{ color: 'var(--primary)' }} />
      </div>
    );
  }

  return (
    <div className={styles.container} style={{ maxWidth: '1200px' }}>
      {/* Header */}
      <div className={styles.header} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 className={styles.title} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Activity size={28} style={{ color: '#ec4899' }} />
            Medical Loan Entry
          </h1>
          <p className={styles.subtitle}>
            Record monthly medical loans taken by staff. Entered amounts automatically add to the employee&apos;s remaining balance and recalculate their monthly payroll deduction schedule.
          </p>
        </div>
        <Link 
          href="/dashboard/payroll/medical-loan-deduction-setup"
          className={`${styles.btn} ${styles.btnSecondary}`}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}
        >
          <Settings size={16} />
          <span>View Deduction Setup Matrix</span>
          <ExternalLink size={14} />
        </Link>
      </div>

      {/* KPI Stats Grid */}
      <div className={styles.statsGrid} style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', marginBottom: '1.75rem' }}>
        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: 'rgba(236, 72, 153, 0.12)', color: '#ec4899' }}>
            <NairaSign size={22} />
          </div>
          <div className={styles.statInfo}>
            <span className={styles.statLabel}>Total Disbursed</span>
            <span className={styles.statValue} style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
              <NairaSign size={16} /> {fmt(summary.total_disbursed)}
            </span>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: 'rgba(239, 68, 68, 0.12)', color: '#ef4444' }}>
            <TrendingUp size={22} />
          </div>
          <div className={styles.statInfo}>
            <span className={styles.statLabel}>Outstanding Balance</span>
            <span className={styles.statValue} style={{ display: 'flex', alignItems: 'center', gap: '3px', color: '#ef4444' }}>
              <NairaSign size={16} /> {fmt(summary.total_outstanding)}
            </span>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: 'rgba(59, 130, 246, 0.12)', color: '#3b82f6' }}>
            <Receipt size={22} />
          </div>
          <div className={styles.statInfo}>
            <span className={styles.statLabel}>Total Entries</span>
            <span className={styles.statValue}>{summary.total_entries} Entries</span>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: 'rgba(16, 185, 129, 0.12)', color: '#10b981' }}>
            <UserCheck size={22} />
          </div>
          <div className={styles.statInfo}>
            <span className={styles.statLabel}>Active Staff with Loans</span>
            <span className={styles.statValue}>{summary.active_staff_count} Staff</span>
          </div>
        </div>
      </div>

      {/* Main Form & Dynamic Calculation Section */}
      <div className={styles.card} style={{ marginBottom: '2rem' }}>
        <div className={styles.cardHeader} style={{ background: 'linear-gradient(to right, rgba(236, 72, 153, 0.05), transparent)' }}>
          <h2 className={styles.cardTitle} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Plus size={18} style={{ color: '#ec4899' }} />
            New Medical Loan Entry
          </h2>
          <span style={{ fontSize: '0.8rem', color: '#64748b' }}>Interest-Free Staff Medical Advance</span>
        </div>
        <div className={styles.cardBody}>
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 0.8fr)', gap: '1.75rem' }}>
              {/* Left Column: Form Controls */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {/* Autocomplete Staff Search */}
                <div className={styles.formGroup} ref={dropdownRef}>
                  <label className={styles.label}>Select Staff Member *</label>
                  <div className={styles.dropdownContainer}>
                    <input
                      type="text"
                      className={styles.input}
                      placeholder="Type staff name, ID, or file number..."
                      value={dropdownSearch}
                      onChange={(e) => {
                        setDropdownSearch(e.target.value);
                        setShowDropdown(true);
                        if (selectedStaff && e.target.value !== selectedStaff.name) {
                          setSelectedStaff(null);
                        }
                      }}
                      onFocus={() => setShowDropdown(true)}
                    />
                    {showDropdown && (
                      <ul className={styles.dropdownList}>
                        {filteredStaff.length > 0 ? (
                          filteredStaff.map((staff) => (
                            <li
                              key={staff.id}
                              className={styles.dropdownItem}
                              onClick={() => handleSelectStaff(staff)}
                            >
                              <span className={styles.staffName}>{staff.name}</span>
                              <span className={styles.dropdownItemSub}>ID: {staff.id} {staff.fileNo ? `| File: ${staff.fileNo}` : ''}</span>
                            </li>
                          ))
                        ) : (
                          <li className={styles.dropdownEmpty}>No matching active staff members</li>
                        )}
                      </ul>
                    )}
                  </div>
                </div>

                {/* Date Taken & Amount Row */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  {/* Disbursement Date */}
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Date Loan Taken *</label>
                    <div className={styles.inputGroup}>
                      <input
                        type="date"
                        className={styles.input}
                        value={loanDate}
                        onChange={(e) => setLoanDate(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  {/* Loan Amount */}
                  <div className={styles.formGroup}>
                    <label className={styles.label}>Loan Amount (₦) *</label>
                    <div className={styles.inputGroup}>
                      <NairaSign size={16} className={styles.inputIcon} />
                      <input
                        type="number"
                        step="0.01"
                        min="1"
                        className={`${styles.input} ${styles.inputWithIcon}`}
                        placeholder="e.g. 50000"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* Quick Amount Suggestion Chips */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500 }}>Quick Presets:</span>
                  {[10000, 20000, 30000, 50000, 100000, 150000].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => handleQuickAmount(val)}
                      style={{
                        padding: '0.25rem 0.6rem',
                        fontSize: '0.75rem',
                        borderRadius: '6px',
                        border: '1px solid var(--border)',
                        background: parsedAmt === val ? 'rgba(236, 72, 153, 0.15)' : 'var(--surface)',
                        color: parsedAmt === val ? '#ec4899' : 'var(--text-secondary)',
                        cursor: 'pointer',
                        fontWeight: parsedAmt === val ? 600 : 400,
                        transition: 'all 0.15s ease'
                      }}
                    >
                      ₦{fmt(val)}
                    </button>
                  ))}
                </div>

                {/* Reason / Medical Purpose */}
                <div className={styles.formGroup}>
                  <label className={styles.label}>Reason / Medical Purpose *</label>
                  <textarea
                    className={styles.input}
                    rows={3}
                    placeholder="Specify the medical diagnosis, hospital, pharmacy prescription, or emergency purpose..."
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    required
                    style={{ resize: 'vertical' }}
                  />
                </div>

                {/* Form Action Buttons */}
                <div className={styles.formActions} style={{ marginTop: '0.5rem', display: 'flex', gap: '0.75rem' }}>
                  <button type="button" className={`${styles.btn} ${styles.btnSecondary}`} onClick={handleClearForm}>
                    Clear
                  </button>
                  <button 
                    type="submit" 
                    className={`${styles.btn} ${styles.btnPrimary}`} 
                    disabled={saving || !selectedStaff}
                    style={{ background: 'linear-gradient(135deg, #ec4899 0%, #db2777 100%)', borderColor: '#db2777', flexGrow: 1 }}
                  >
                    {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                    Record Medical Loan Entry
                  </button>
                </div>
              </div>

              {/* Right Column: Live Dynamic Balance & Deduction Card */}
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div 
                  style={{
                    background: 'var(--surface-hover, rgba(255, 255, 255, 0.03))',
                    border: '1px solid var(--border)',
                    borderRadius: '12px',
                    padding: '1.25rem',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-primary)' }}>
                        <Sparkles size={16} style={{ color: '#ec4899' }} />
                        Live Deduction & Balance Preview
                      </span>
                      {selectedStaff && (
                        <span style={{ fontSize: '0.75rem', background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', padding: '2px 8px', borderRadius: '12px', fontWeight: 500 }}>
                          ID: {selectedStaff.id}
                        </span>
                      )}
                    </div>

                    {!selectedStaff ? (
                      <div style={{ textAlign: 'center', padding: '2rem 1rem', color: '#64748b', fontSize: '0.85rem' }}>
                        <Info size={28} style={{ margin: '0 auto 0.5rem auto', opacity: 0.6 }} />
                        Select a staff member from the left to view their current balance and projected deduction changes.
                      </div>
                    ) : loadingStaffInfo ? (
                      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '2.5rem 0' }}>
                        <Loader2 size={24} className="animate-spin" style={{ color: '#ec4899' }} />
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        {/* Staff Brief Header */}
                        <div style={{ padding: '0.6rem 0.8rem', background: 'rgba(0,0,0,0.1)', borderRadius: '8px', fontSize: '0.825rem' }}>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{selectedStaff.name}</div>
                          <div style={{ color: '#64748b', fontSize: '0.75rem' }}>
                            {staffBalanceInfo?.staff?.department || 'Department N/A'} {selectedStaff.fileNo ? `• File: ${selectedStaff.fileNo}` : ''}
                          </div>
                        </div>

                        {/* Current Outstanding Balance */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', borderBottom: '1px dashed var(--border)' }}>
                          <span style={{ fontSize: '0.825rem', color: '#94a3b8' }}>Current Loan Balance:</span>
                          <span style={{ fontWeight: 600, color: currentBalance > 0 ? '#f59e0b' : '#10b981', display: 'flex', alignItems: 'center', gap: '2px', fontSize: '0.9rem' }}>
                            <NairaSign size={14} /> {fmt(currentBalance)}
                          </span>
                        </div>

                        {/* Current Monthly Deduction */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', borderBottom: '1px dashed var(--border)' }}>
                          <span style={{ fontSize: '0.825rem', color: '#94a3b8' }}>Current Monthly Deduction:</span>
                          <span style={{ fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '2px', fontSize: '0.9rem' }}>
                            <NairaSign size={14} /> {fmt(currentDeduction)} / month
                          </span>
                        </div>

                        {/* Added Amount */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0', borderBottom: '1px dashed var(--border)' }}>
                          <span style={{ fontSize: '0.825rem', color: '#ec4899', fontWeight: 500 }}>+ Medical Loan Added:</span>
                          <span style={{ fontWeight: 700, color: '#ec4899', display: 'flex', alignItems: 'center', gap: '2px', fontSize: '0.95rem' }}>
                            + <NairaSign size={14} /> {fmt(parsedAmt)}
                          </span>
                        </div>

                        {/* Resulting New Balance Box */}
                        <motion.div 
                          initial={{ scale: 0.98 }}
                          animate={{ scale: 1 }}
                          style={{
                            background: 'linear-gradient(135deg, rgba(236, 72, 153, 0.12) 0%, rgba(147, 51, 234, 0.12) 100%)',
                            border: '1px solid rgba(236, 72, 153, 0.3)',
                            borderRadius: '10px',
                            padding: '1rem',
                            marginTop: '0.25rem',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                            <span style={{ fontSize: '0.8rem', color: '#cbd5e1', fontWeight: 500 }}>New Total Balance:</span>
                            <span style={{ fontSize: '1.15rem', fontWeight: 700, color: '#f472b6', display: 'flex', alignItems: 'center', gap: '3px' }}>
                              <NairaSign size={16} /> {fmt(projectedBalance)}
                            </span>
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                            <span style={{ fontSize: '0.8rem', color: '#cbd5e1', fontWeight: 500 }}>New Monthly Deduction:</span>
                            <span style={{ fontSize: '1rem', fontWeight: 700, color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '3px' }}>
                              <NairaSign size={15} /> {fmt(projectedCalc.deduction)} / month
                            </span>
                          </div>

                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.1)', fontSize: '0.75rem', color: '#94a3b8' }}>
                            <span>Estimated Duration:</span>
                            <span style={{ fontWeight: 600, color: '#e2e8f0' }}>{projectedCalc.duration} Months</span>
                          </div>
                        </motion.div>
                      </div>
                    )}
                  </div>

                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '1rem', lineHeight: '1.3' }}>
                    💡 <em>Monthly deductions are automatically calculated according to medical loan repayment tiers and deducted during payroll compute.</em>
                  </div>
                </div>
              </div>
            </div>
          </form>
        </div>
      </div>

      {/* Entries History Table Card */}
      <div className={styles.card}>
        <div className={styles.cardHeader} style={{ flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h2 className={styles.cardTitle}>Medical Loan Entries History</h2>
            <p style={{ fontSize: '0.8rem', color: '#64748b', margin: '2px 0 0 0' }}>Log of all staff medical loans disbursed</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <input
              type="month"
              className={styles.input}
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
              style={{ width: 'auto', padding: '0.4rem 0.6rem', fontSize: '0.8rem' }}
              title="Filter by month"
            />
            {monthFilter && (
              <button
                type="button"
                className={`${styles.btn} ${styles.btnSecondary}`}
                style={{ padding: '0.4rem 0.6rem', fontSize: '0.75rem' }}
                onClick={() => setMonthFilter('')}
              >
                Clear Month
              </button>
            )}
          </div>
        </div>

        <div className={styles.searchBar}>
          <div className={styles.searchInputWrapper}>
            <Search size={18} className={styles.inputIcon} />
            <input
              type="text"
              className={`${styles.input} ${styles.inputWithIcon}`}
              placeholder="Search entries by staff name, ID, file number, or reason..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className={styles.perPageGroup}>
            <span className={styles.perPageLabel}>Show:</span>
            <select
              className={styles.perPageSelect}
              value={itemsPerPage}
              onChange={(e) => {
                setItemsPerPage(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="10">10 records</option>
              <option value="20">20 records</option>
              <option value="30">30 records</option>
              <option value="50">50 records</option>
              <option value="100">100 records</option>
              <option value="all">All Records</option>
            </select>
          </div>
        </div>

        <div className={styles.cardBody} style={{ padding: 0 }}>
          {loading ? (
            <div className={styles.emptyState}>
              <Loader2 size={32} className="animate-spin emptyIcon" />
              <p>Retrieving entries history...</p>
            </div>
          ) : paginatedEntries.length > 0 ? (
            <div className={styles.tableContainer}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Staff Information</th>
                    <th>Department</th>
                    <th>Date Taken</th>
                    <th>Reason / Purpose</th>
                    <th>Amount Taken</th>
                    <th>Balance (Before → After)</th>
                    <th>Monthly Deduction</th>
                    <th>Recorded By</th>
                    <th style={{ textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedEntries.map((e) => (
                    <tr key={e.id}>
                      <td>
                        <div className={styles.staffCell}>
                          <span className={styles.staffName}>{e.name}</span>
                          <span className={styles.staffFile}>ID: {e.staffId} {e.fileNo ? `| File: ${e.fileNo}` : ''}</span>
                        </div>
                      </td>
                      <td>{e.department || 'N/A'}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Calendar size={13} style={{ color: '#64748b' }} />
                          {e.loan_date}
                        </span>
                      </td>
                      <td style={{ maxWidth: '220px' }} title={e.reason}>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                          {e.reason}
                        </span>
                      </td>
                      <td style={{ fontWeight: 600, color: '#ec4899', whiteSpace: 'nowrap' }}>
                        ₦{fmt(e.amount)}
                      </td>
                      <td style={{ whiteSpace: 'nowrap', fontSize: '0.825rem' }}>
                        <span style={{ color: '#94a3b8' }}>₦{fmt(e.balance_before)}</span>
                        <span style={{ margin: '0 4px', color: '#64748b' }}>→</span>
                        <span style={{ fontWeight: 600, color: '#10b981' }}>₦{fmt(e.balance_after)}</span>
                      </td>
                      <td style={{ whiteSpace: 'nowrap', fontWeight: 600, color: '#0284c7' }}>
                        ₦{fmt(e.monthly_deduction)}
                        <span style={{ fontSize: '0.75rem', fontWeight: 400, color: '#64748b', marginLeft: '3px' }}>/mo</span>
                      </td>
                      <td style={{ fontSize: '0.8rem', color: '#64748b' }}>
                        {e.creator_name}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          type="button"
                          className={`${styles.actionBtn} ${styles.actionBtnDelete}`}
                          onClick={() => handleDelete(e)}
                          title="Delete Entry and Revert Balance"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className={styles.emptyState}>
              <FileText size={32} className={styles.emptyIcon} />
              <p>No medical loan entries found.</p>
            </div>
          )}

          {/* Pagination */}
          {filteredEntries.length > 0 && (
            <div className={styles.pagination}>
              <span className={styles.paginationText}>
                Showing {filteredEntries.length === 0 ? 0 : (itemsPerPage === 'all' ? 1 : (currentPage - 1) * parseInt(itemsPerPage, 10) + 1)} to {itemsPerPage === 'all' ? filteredEntries.length : Math.min(currentPage * parseInt(itemsPerPage, 10), filteredEntries.length)} of {filteredEntries.length} entries {itemsPerPage !== 'all' && totalPages > 1 && `(Page ${currentPage} of ${totalPages})`}
              </span>
              {itemsPerPage !== 'all' && totalPages > 1 && (
                <div className={styles.paginationButtons}>
                  <button
                    type="button"
                    className={`${styles.btn} ${styles.btnSecondary}`}
                    style={{ padding: '0.375rem 0.75rem', fontSize: '0.75rem' }}
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(1)}
                  >
                    First
                  </button>
                  <button
                    type="button"
                    className={`${styles.btn} ${styles.btnSecondary}`}
                    style={{ padding: '0.375rem 0.75rem', fontSize: '0.75rem' }}
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(c => Math.max(1, c - 1))}
                  >
                    Prev
                  </button>

                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }
                    return (
                      <button
                        key={pageNum}
                        type="button"
                        className={`${styles.btn} ${currentPage === pageNum ? styles.btnPrimary : styles.btnSecondary}`}
                        style={{ minWidth: '30px', padding: '0.375rem 0.5rem', fontSize: '0.75rem' }}
                        onClick={() => setCurrentPage(pageNum)}
                      >
                        {pageNum}
                      </button>
                    );
                  })}

                  <button
                    type="button"
                    className={`${styles.btn} ${styles.btnSecondary}`}
                    style={{ padding: '0.375rem 0.75rem', fontSize: '0.75rem' }}
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(c => Math.min(totalPages, c + 1))}
                  >
                    Next
                  </button>
                  <button
                    type="button"
                    className={`${styles.btn} ${styles.btnSecondary}`}
                    style={{ padding: '0.375rem 0.75rem', fontSize: '0.75rem' }}
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(totalPages)}
                  >
                    Last
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Confirmation Modal */}
      {confirmDelete && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalBox}>
            <div className={styles.confirmBox}>
              <div className={`${styles.confirmIcon} ${styles.confirmIconRed}`}>
                <AlertCircle size={32} />
              </div>
              <h3 className={styles.cardTitle} style={{ marginBottom: '0.5rem' }}>
                Delete Medical Loan Entry
              </h3>
              <p className={styles.confirmMsg}>
                Are you sure you want to delete this medical loan entry of <strong>₦{fmt(confirmDelete.amount)}</strong> for <strong>{confirmDelete.name}</strong>?
                <br />
                <span style={{ fontSize: '0.8rem', color: '#f59e0b', display: 'block', marginTop: '0.5rem' }}>
                  ⚠️ Deleting this entry will automatically subtract ₦{fmt(confirmDelete.amount)} from the staff member&apos;s remaining deduction balance and adjust their monthly deduction.
                </span>
              </p>
              <div className={styles.confirmActions}>
                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnSecondary}`}
                  onClick={() => setConfirmDelete(null)}
                  disabled={actionLoading}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className={`${styles.confirmActionBtn} ${styles.dangerBtn}`}
                  onClick={handleConfirmDelete}
                  disabled={actionLoading}
                >
                  {actionLoading ? <Loader2 size={16} className="animate-spin" /> : 'Yes, Delete & Revert Balance'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div className={`${styles.toast} ${toast.type === 'error' ? styles.toastError : styles.toastSuccess}`}>
          {toast.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
}
