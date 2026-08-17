'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { 
  TrendingUp, 
  Users, 
  Building2, 
  DollarSign, 
  FileSpreadsheet, 
  Upload, 
  Download, 
  Search, 
  RefreshCw, 
  RotateCcw, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Percent, 
  ChevronRight,
  ArrowUpRight,
  Sparkles
} from 'lucide-react';
import styles from './page.module.css';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost/isalu/Isalu%20HRMS/public/api/nextjs';

function getUserId() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('user_id') || sessionStorage.getItem('user_id') || '1';
}

function buildHeaders() {
  const userId = getUserId();
  return {
    'Content-Type': 'application/json',
    'X-User-Id': userId || '1',
  };
}

const formatCurrency = (val) => {
  if (val === null || val === undefined || val === '') return '0.00';
  const num = typeof val === 'number' ? val : parseFloat(String(val).replace(/,/g, ''));
  if (isNaN(num)) return '0.00';
  return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const formatNumberWithCommas = (val) => {
  if (val === null || val === undefined || val === '') return '';
  const strVal = String(val).replace(/,/g, '');
  const parts = strVal.split('.');
  const integerPart = parts[0].replace(/\D/g, '');
  if (!integerPart && parts.length === 1) return '';
  
  const formattedInteger = integerPart ? Number(integerPart).toLocaleString('en-US') : '0';
  if (parts.length > 1) {
    const decimalPart = parts[1].replace(/\D/g, '').slice(0, 2);
    return `${formattedInteger}.${decimalPart}`;
  }
  return formattedInteger;
};

const parseCleanNumber = (val) => {
  if (!val && val !== 0) return 0;
  const clean = String(val).replace(/,/g, '');
  const parsed = parseFloat(clean);
  return isNaN(parsed) ? 0 : parsed;
};

export default function SalaryIncrementPage() {
  // Tabs: 'single' | 'bulk' | 'upload'
  const [activeTab, setActiveTab] = useState('single');

  // Loading States
  const [loadingStaff, setLoadingStaff] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [exportingHistory, setExportingHistory] = useState(false);

  // Staff & Departments Data
  const [staffList, setStaffList] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [overviewStats, setOverviewStats] = useState({ total_staff: 0, total_payroll: 0 });

  // Single Staff Form State
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [staffSearchQuery, setStaffSearchQuery] = useState('');
  const [showStaffDropdown, setShowStaffDropdown] = useState(false);
  const dropdownRef = useRef(null);

  const [singleMode, setSingleMode] = useState('percentage'); // 'percentage' | 'fixed_amount' | 'new_gross'
  const [percentageInput, setPercentageInput] = useState('10');
  const [fixedAmountInput, setFixedAmountInput] = useState('');
  const [newGrossInput, setNewGrossInput] = useState('');
  const [effectiveDate, setEffectiveDate] = useState(new Date().toISOString().split('T')[0]);
  const [reason, setReason] = useState('');

  // Bulk Form State
  const [bulkTarget, setBulkTarget] = useState('all'); // 'all' | 'department'
  const [bulkDeptId, setBulkDeptId] = useState('');
  const [bulkMode, setBulkMode] = useState('percentage'); // 'percentage' | 'fixed_amount'
  const [bulkPercentage, setBulkPercentage] = useState('10');
  const [bulkAmount, setBulkAmount] = useState('');
  const [bulkEffectiveDate, setBulkEffectiveDate] = useState(new Date().toISOString().split('T')[0]);
  const [bulkReason, setBulkReason] = useState('');

  // File Upload State
  const [dragActive, setDragActive] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadWarnings, setUploadWarnings] = useState([]);

  // History State
  const [historyRecords, setHistoryRecords] = useState([]);
  const [historyPagination, setHistoryPagination] = useState({ current_page: 1, last_page: 1, total: 0 });
  const [historySummary, setHistorySummary] = useState({ total_increments: 0, total_increase_amount: 0 });
  const [historySearch, setHistorySearch] = useState('');
  const [historyDeptFilter, setHistoryDeptFilter] = useState('');
  const [historyPage, setHistoryPage] = useState(1);

  // Revert Modal State
  const [revertTarget, setRevertTarget] = useState(null);
  const [reverting, setReverting] = useState(false);

  // Toast Notification
  const [toast, setToast] = useState(null);

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 6000);
  }, []);

  // Fetch initial staff and departments
  const fetchStaffData = useCallback(async () => {
    setLoadingStaff(true);
    try {
      const res = await axios.get(`${API_BASE}/payroll/salary-increments/staff`, {
        headers: buildHeaders(),
      });
      if (res.data.status === 'success') {
        setStaffList(res.data.data.staff || []);
        setDepartments(res.data.data.departments || []);
        setOverviewStats({
          total_staff: res.data.data.total_staff || 0,
          total_payroll: res.data.data.total_payroll || 0,
        });
      }
    } catch (err) {
      showToast('Failed to load staff list.', 'error');
    } finally {
      setLoadingStaff(false);
    }
  }, [showToast]);

  // Fetch increment history
  const fetchHistory = useCallback(async (page = 1) => {
    setLoadingHistory(true);
    try {
      const params = new URLSearchParams();
      params.append('page', page);
      if (historySearch) params.append('search', historySearch);
      if (historyDeptFilter) params.append('department_id', historyDeptFilter);

      const res = await axios.get(`${API_BASE}/payroll/salary-increments/history?${params.toString()}`, {
        headers: buildHeaders(),
      });
      if (res.data.status === 'success') {
        setHistoryRecords(res.data.data || []);
        setHistoryPagination(res.data.pagination || { current_page: 1, last_page: 1, total: 0 });
        setHistorySummary(res.data.summary || { total_increments: 0, total_increase_amount: 0 });
      }
    } catch (err) {
      showToast('Failed to load increment history.', 'error');
    } finally {
      setLoadingHistory(false);
    }
  }, [historySearch, historyDeptFilter, showToast]);

  useEffect(() => {
    fetchStaffData();
    fetchHistory(1);
  }, [fetchStaffData, fetchHistory]);

  // Click outside listener for dropdown
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowStaffDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Filter staff list
  const filteredStaffList = staffList.filter(s =>
    s.name.toLowerCase().includes(staffSearchQuery.toLowerCase()) ||
    String(s.id).includes(staffSearchQuery)
  );

  const handleSelectStaff = (staff) => {
    setSelectedStaff(staff);
    setStaffSearchQuery(staff.name);
    setShowStaffDropdown(false);

    // Default the direct new gross to current gross
    if (staff.current_gross > 0) {
      setNewGrossInput(formatNumberWithCommas(staff.current_gross));
    } else {
      setNewGrossInput('');
    }
  };

  // Calculate Single Staff Projected New Gross
  const calculateSingleProjectedGross = () => {
    if (!selectedStaff) return 0;
    const current = selectedStaff.current_gross || 0;

    if (singleMode === 'percentage') {
      const p = parseFloat(percentageInput) || 0;
      return current * (1 + (p / 100));
    } else if (singleMode === 'fixed_amount') {
      const amt = parseCleanNumber(fixedAmountInput);
      return current + amt;
    } else { // new_gross
      return parseCleanNumber(newGrossInput);
    }
  };

  const projectedSingleGross = calculateSingleProjectedGross();
  const singleDifference = selectedStaff ? projectedSingleGross - selectedStaff.current_gross : 0;
  const singlePercentDiff = (selectedStaff && selectedStaff.current_gross > 0)
    ? ((singleDifference / selectedStaff.current_gross) * 100).toFixed(1)
    : 0;

  // Allowance preview breakdown (20% Basic, 20% Housing, 10% Transport, 10% Medical, 20% Utility, 20% Meal)
  const previewBreakdown = {
    basic: round2(projectedSingleGross * 0.20),
    housing: round2(projectedSingleGross * 0.20),
    transport: round2(projectedSingleGross * 0.10),
    medical: round2(projectedSingleGross * 0.10),
    utility: round2(projectedSingleGross * 0.20),
    meal: round2(projectedSingleGross * 0.20),
  };

  function round2(num) {
    return Math.round((num + Number.EPSILON) * 100) / 100;
  }

  // Handle Single Staff Increment Submit
  const handleSingleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedStaff) {
      showToast('Please select a staff member.', 'error');
      return;
    }

    if (projectedSingleGross <= 0) {
      showToast('Projected new gross salary must be greater than 0.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        staff_id: selectedStaff.id,
        increment_type: singleMode,
        percentage: singleMode === 'percentage' ? parseFloat(percentageInput) : null,
        amount: singleMode === 'fixed_amount' ? parseCleanNumber(fixedAmountInput) : null,
        new_gross: singleMode === 'new_gross' ? parseCleanNumber(newGrossInput) : null,
        effective_date: effectiveDate,
        reason: reason || 'Individual salary increment adjustment',
      };

      const res = await axios.post(`${API_BASE}/payroll/salary-increments/single`, payload, {
        headers: buildHeaders(),
      });

      if (res.data.status === 'success') {
        showToast(res.data.message || 'Salary increment saved successfully!');
        setSelectedStaff(null);
        setStaffSearchQuery('');
        setReason('');
        fetchStaffData();
        fetchHistory(1);
      } else {
        showToast(res.data.message || 'Failed to apply increment.', 'error');
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Server error applying increment.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Bulk calculation
  const bulkFilteredStaff = bulkTarget === 'department' && bulkDeptId
    ? staffList.filter(s => String(s.department_id) === String(bulkDeptId))
    : staffList;

  const currentBulkPayroll = bulkFilteredStaff.reduce((sum, s) => sum + (s.current_gross || 0), 0);
  const projectedBulkPayroll = bulkFilteredStaff.reduce((sum, s) => {
    const cur = s.current_gross || 0;
    if (bulkMode === 'percentage') {
      const p = parseFloat(bulkPercentage) || 0;
      return sum + (cur * (1 + (p / 100)));
    } else {
      const amt = parseCleanNumber(bulkAmount);
      return sum + (cur + amt);
    }
  }, 0);

  const bulkTotalIncrease = projectedBulkPayroll - currentBulkPayroll;

  // Handle Bulk Submit
  const handleBulkSubmit = async (e) => {
    e.preventDefault();
    if (bulkFilteredStaff.length === 0) {
      showToast('No active staff found for the selected criteria.', 'error');
      return;
    }

    if (bulkMode === 'percentage' && (!bulkPercentage || parseFloat(bulkPercentage) <= 0)) {
      showToast('Please enter a valid percentage increase.', 'error');
      return;
    }

    if (bulkMode === 'fixed_amount' && (!bulkAmount || parseCleanNumber(bulkAmount) <= 0)) {
      showToast('Please enter a valid fixed increase amount.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        target_type: bulkTarget,
        department_id: bulkTarget === 'department' ? bulkDeptId : null,
        increment_type: bulkMode,
        percentage: bulkMode === 'percentage' ? parseFloat(bulkPercentage) : null,
        amount: bulkMode === 'fixed_amount' ? parseCleanNumber(bulkAmount) : null,
        effective_date: bulkEffectiveDate,
        reason: bulkReason || `Bulk ${bulkMode} increment across ${bulkTarget}`,
      };

      const res = await axios.post(`${API_BASE}/payroll/salary-increments/bulk`, payload, {
        headers: buildHeaders(),
      });

      if (res.data.status === 'success') {
        showToast(res.data.message || 'Bulk increment processed successfully!');
        setBulkReason('');
        fetchStaffData();
        fetchHistory(1);
      } else {
        showToast(res.data.message || 'Bulk increment failed.', 'error');
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Server error processing bulk increment.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Drag & Drop Upload
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setUploadFile(e.dataTransfer.files[0]);
    }
  };

  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!uploadFile) {
      showToast('Please select an Excel or CSV file.', 'error');
      return;
    }

    setSubmitting(true);
    setUploadWarnings([]);
    const formData = new FormData();
    formData.append('file', uploadFile);

    try {
      const res = await axios.post(`${API_BASE}/payroll/salary-increments/upload`, formData, {
        headers: {
          ...buildHeaders(),
          'Content-Type': 'multipart/form-data',
        }
      });

      if (res.data.status === 'success') {
        showToast(res.data.message || 'Spreadsheet import complete!');
        if (res.data.warnings && res.data.warnings.length > 0) {
          setUploadWarnings(res.data.warnings);
        }
        setUploadFile(null);
        fetchStaffData();
        fetchHistory(1);
      } else {
        showToast(res.data.message || 'Upload failed.', 'error');
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Server error uploading spreadsheet.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Revert Increment
  const handleConfirmRevert = async () => {
    if (!revertTarget) return;
    setReverting(true);
    try {
      const res = await axios.post(`${API_BASE}/payroll/salary-increments/revert`, {
        increment_id: revertTarget.id,
      }, {
        headers: buildHeaders(),
      });

      if (res.data.status === 'success') {
        showToast(res.data.message || 'Salary increment reverted successfully!');
        setRevertTarget(null);
        fetchStaffData();
        fetchHistory(historyPagination.current_page);
      } else {
        showToast(res.data.message || 'Failed to revert salary.', 'error');
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Server error reverting increment.', 'error');
    } finally {
      setReverting(false);
    }
  };

  // Export History to Excel
  const handleExportHistoryExcel = async () => {
    setExportingHistory(true);
    try {
      const params = new URLSearchParams();
      if (historySearch) params.append('search', historySearch);
      if (historyDeptFilter) params.append('department_id', historyDeptFilter);

      const res = await axios.get(`${API_BASE}/payroll/salary-increments/export?${params.toString()}`, {
        headers: buildHeaders(),
        responseType: 'blob',
      });

      const blob = new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const filename = `Salary_Increments_Audit_${new Date().toISOString().split('T')[0]}.xlsx`;

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        try {
          link.remove();
          window.URL.revokeObjectURL(url);
        } catch { /* ignore */ }
      }, 150);

      showToast('Salary increment audit spreadsheet exported!', 'success');
    } catch (err) {
      showToast('Failed to export history spreadsheet.', 'error');
    } finally {
      setExportingHistory(false);
    }
  };

  return (
    <div className={styles.container}>
      {/* Toast alert */}
      {toast && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 9999,
          padding: '0.85rem 1.25rem',
          borderRadius: '0.5rem',
          background: toast.type === 'error' ? '#dc2626' : '#059669',
          color: '#ffffff',
          fontWeight: 600,
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          {toast.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header */}
      <div className={styles.header}>
        <div className={styles.titleSection}>
          <h1>
            <TrendingUp size={28} className={styles.titleIcon} />
            Salary Increment Management
          </h1>
          <p className={styles.subtitle}>
            Adjust staff gross salaries individually, across departments, or in bulk via spreadsheet with full audit logs.
          </p>
        </div>
        <div className={styles.headerActions}>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnOutline}`}
            onClick={() => { fetchStaffData(); fetchHistory(1); }}
            disabled={loadingStaff || loadingHistory}
          >
            <RefreshCw size={16} className={loadingStaff || loadingHistory ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* KPI Overview Cards */}
      <div className={styles.kpiGrid}>
        <div className={styles.kpiCard}>
          <div className={`${styles.kpiIconWrapper} ${styles.kpiIconBlue}`}>
            <Users size={22} />
          </div>
          <div>
            <div className={styles.kpiLabel}>Active Personnel</div>
            <div className={styles.kpiValue}>{overviewStats.total_staff} Staff</div>
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={`${styles.kpiIconWrapper} ${styles.kpiIconGreen}`}>
            <DollarSign size={22} />
          </div>
          <div>
            <div className={styles.kpiLabel}>Current Total Payroll</div>
            <div className={styles.kpiValue}>₦{formatCurrency(overviewStats.total_payroll)}</div>
          </div>
        </div>

        <div className={styles.kpiCard}>
          <div className={`${styles.kpiIconWrapper} ${styles.kpiIconPurple}`}>
            <Sparkles size={22} />
          </div>
          <div>
            <div className={styles.kpiLabel}>Total Increments Applied</div>
            <div className={styles.kpiValue}>{historySummary.total_increments} Records</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className={styles.tabsContainer}>
        <button
          type="button"
          className={`${styles.tabBtn} ${activeTab === 'single' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('single')}
        >
          <TrendingUp size={16} />
          Single Staff Increment
        </button>

        <button
          type="button"
          className={`${styles.tabBtn} ${activeTab === 'bulk' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('bulk')}
        >
          <Users size={16} />
          Bulk / Department Increment
        </button>

        <button
          type="button"
          className={`${styles.tabBtn} ${activeTab === 'upload' ? styles.tabBtnActive : ''}`}
          onClick={() => setActiveTab('upload')}
        >
          <FileSpreadsheet size={16} />
          Spreadsheet Import
        </button>
      </div>

      {/* TAB 1: Single Staff Increment */}
      {activeTab === 'single' && (
        <div className={styles.formCard}>
          <div className={styles.cardHeader}>
            <div>
              <h2 className={styles.cardTitle}>Single Employee Salary Adjustment</h2>
              <p className={styles.cardDesc}>Select an employee and set a percentage increment, fixed monthly bump, or new gross salary.</p>
            </div>
          </div>

          <form onSubmit={handleSingleSubmit}>
            <div className={styles.formGrid}>
              {/* Staff Search Autocomplete */}
              <div className={styles.formGroup} ref={dropdownRef}>
                <label className={styles.formLabel}>Select Employee *</label>
                <input
                  type="text"
                  className={styles.formInput}
                  placeholder="Search staff by name or ID..."
                  value={staffSearchQuery}
                  onChange={(e) => {
                    setStaffSearchQuery(e.target.value);
                    setShowStaffDropdown(true);
                  }}
                  onFocus={() => setShowStaffDropdown(true)}
                  required
                />

                {showStaffDropdown && (
                  <div className={styles.dropdownMenu}>
                    {filteredStaffList.length > 0 ? (
                      filteredStaffList.map(s => (
                        <div
                          key={s.id}
                          className={styles.dropdownItem}
                          onClick={() => handleSelectStaff(s)}
                        >
                          <strong>{s.name}</strong> <span style={{ color: '#64748b', fontSize: '0.8rem' }}>(ID: {s.id} • {s.department})</span>
                        </div>
                      ))
                    ) : (
                      <div className={styles.dropdownItem} style={{ color: '#64748b' }}>
                        No matching staff found
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Effective Date */}
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Effective Date</label>
                <input
                  type="date"
                  className={styles.formInput}
                  value={effectiveDate}
                  onChange={(e) => setEffectiveDate(e.target.value)}
                  required
                />
              </div>

              {/* Reason / Remarks */}
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Reason / Remarks</label>
                <input
                  type="text"
                  className={styles.formInput}
                  placeholder="e.g. Annual appraisal, promotion, wage review..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </div>
            </div>

            {/* Increment Mode Radio */}
            <label className={styles.formLabel} style={{ marginBottom: '0.5rem', display: 'block' }}>
              Adjustment Method
            </label>
            <div className={styles.radioGroup}>
              <div
                className={`${styles.radioOption} ${singleMode === 'percentage' ? styles.radioOptionSelected : ''}`}
                onClick={() => setSingleMode('percentage')}
              >
                <Percent size={16} />
                Percentage Increase (%)
              </div>

              <div
                className={`${styles.radioOption} ${singleMode === 'fixed_amount' ? styles.radioOptionSelected : ''}`}
                onClick={() => setSingleMode('fixed_amount')}
              >
                <DollarSign size={16} />
                Fixed Monthly Increase (₦)
              </div>

              <div
                className={`${styles.radioOption} ${singleMode === 'new_gross' ? styles.radioOptionSelected : ''}`}
                onClick={() => setSingleMode('new_gross')}
              >
                <TrendingUp size={16} />
                Direct New Gross Salary (₦)
              </div>
            </div>

            {/* Dynamic Inputs Based on Mode */}
            <div style={{ maxWidth: '400px', marginBottom: '1.5rem' }}>
              {singleMode === 'percentage' && (
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Increase Percentage (%) *</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    className={styles.formInput}
                    placeholder="e.g. 10, 15, 20"
                    value={percentageInput}
                    onChange={(e) => setPercentageInput(e.target.value)}
                    required
                  />
                </div>
              )}

              {singleMode === 'fixed_amount' && (
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Fixed Amount Bump (₦) *</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    className={styles.formInput}
                    placeholder="e.g. 50,000"
                    value={fixedAmountInput}
                    onChange={(e) => setFixedAmountInput(formatNumberWithCommas(e.target.value))}
                    required
                  />
                </div>
              )}

              {singleMode === 'new_gross' && (
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>New Total Gross Salary (₦) *</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    className={styles.formInput}
                    placeholder="e.g. 1,600,000"
                    value={newGrossInput}
                    onChange={(e) => setNewGrossInput(formatNumberWithCommas(e.target.value))}
                    required
                  />
                </div>
              )}
            </div>

            {/* Real-Time Preview Impact Card */}
            {selectedStaff && (
              <div className={styles.previewBox}>
                <div className={styles.previewHeader}>
                  <div className={styles.previewTitle}>
                    <ArrowUpRight size={18} />
                    Projected Salary & Breakdown Preview
                  </div>
                  {singleDifference > 0 && (
                    <div className={styles.previewBadge}>
                      +₦{formatCurrency(singleDifference)} ({singlePercentDiff}%)
                    </div>
                  )}
                </div>

                <div className={styles.comparisonRow}>
                  <div className={styles.comparisonItem}>
                    <div className={styles.comparisonLabel}>Current Gross Salary</div>
                    <div className={styles.comparisonValue} style={{ color: '#64748b' }}>
                      ₦{formatCurrency(selectedStaff.current_gross)}
                    </div>
                  </div>

                  <div className={styles.comparisonItem} style={{ borderColor: '#86efac' }}>
                    <div className={styles.comparisonLabel}>Projected New Gross</div>
                    <div className={styles.comparisonValue} style={{ color: '#059669' }}>
                      ₦{formatCurrency(projectedSingleGross)}
                    </div>
                  </div>

                  <div className={styles.comparisonItem}>
                    <div className={styles.comparisonLabel}>Department / Designation</div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#1e293b' }}>
                      {selectedStaff.department} • {selectedStaff.designation}
                    </div>
                  </div>
                </div>

                {/* Allowance Itemized Grid */}
                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569', marginBottom: '0.4rem' }}>
                  AUTOMATIC ALLOWANCE SPLIT (100%):
                </div>
                <div className={styles.breakdownPillGrid}>
                  <div className={styles.breakdownPill}>
                    <span className={styles.pillLabel}>Basic (20%):</span>
                    <span className={styles.pillValue}>₦{formatCurrency(previewBreakdown.basic)}</span>
                  </div>
                  <div className={styles.breakdownPill}>
                    <span className={styles.pillLabel}>Housing (20%):</span>
                    <span className={styles.pillValue}>₦{formatCurrency(previewBreakdown.housing)}</span>
                  </div>
                  <div className={styles.breakdownPill}>
                    <span className={styles.pillLabel}>Transport (10%):</span>
                    <span className={styles.pillValue}>₦{formatCurrency(previewBreakdown.transport)}</span>
                  </div>
                  <div className={styles.breakdownPill}>
                    <span className={styles.pillLabel}>Medical (10%):</span>
                    <span className={styles.pillValue}>₦{formatCurrency(previewBreakdown.medical)}</span>
                  </div>
                  <div className={styles.breakdownPill}>
                    <span className={styles.pillLabel}>Utility (20%):</span>
                    <span className={styles.pillValue}>₦{formatCurrency(previewBreakdown.utility)}</span>
                  </div>
                  <div className={styles.breakdownPill}>
                    <span className={styles.pillLabel}>Meal (20%):</span>
                    <span className={styles.pillValue}>₦{formatCurrency(previewBreakdown.meal)}</span>
                  </div>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button
                type="submit"
                className={`${styles.btn} ${styles.btnPrimary}`}
                disabled={submitting || !selectedStaff}
              >
                {submitting ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                {submitting ? 'Applying Increment...' : 'Apply Salary Increment'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TAB 2: Bulk / Department Increment */}
      {activeTab === 'bulk' && (
        <div className={styles.formCard}>
          <div className={styles.cardHeader}>
            <div>
              <h2 className={styles.cardTitle}>Bulk / Department Salary Increment</h2>
              <p className={styles.cardDesc}>Apply a uniform percentage increase or fixed amount across all active staff or a selected department.</p>
            </div>
          </div>

          <form onSubmit={handleBulkSubmit}>
            <div className={styles.formGrid}>
              {/* Target Audience */}
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Target Scope *</label>
                <select
                  className={styles.formSelect}
                  value={bulkTarget}
                  onChange={(e) => setBulkTarget(e.target.value)}
                >
                  <option value="all">All Active Staff ({staffList.length} Personnel)</option>
                  <option value="department">Specific Department</option>
                </select>
              </div>

              {/* Department Selector (if target === 'department') */}
              {bulkTarget === 'department' && (
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Select Department *</label>
                  <select
                    className={styles.formSelect}
                    value={bulkDeptId}
                    onChange={(e) => setBulkDeptId(e.target.value)}
                    required
                  >
                    <option value="">-- Choose Department --</option>
                    {departments.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Effective Date */}
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Effective Date</label>
                <input
                  type="date"
                  className={styles.formInput}
                  value={bulkEffectiveDate}
                  onChange={(e) => setBulkEffectiveDate(e.target.value)}
                  required
                />
              </div>

              {/* Reason / Remarks */}
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Reason / Remarks</label>
                <input
                  type="text"
                  className={styles.formInput}
                  placeholder="e.g. General cost of living adjustment..."
                  value={bulkReason}
                  onChange={(e) => setBulkReason(e.target.value)}
                />
              </div>
            </div>

            {/* Increment Mode Radio */}
            <label className={styles.formLabel} style={{ marginBottom: '0.5rem', display: 'block' }}>
              Adjustment Method
            </label>
            <div className={styles.radioGroup}>
              <div
                className={`${styles.radioOption} ${bulkMode === 'percentage' ? styles.radioOptionSelected : ''}`}
                onClick={() => setBulkMode('percentage')}
              >
                <Percent size={16} />
                Percentage Increase (%)
              </div>

              <div
                className={`${styles.radioOption} ${bulkMode === 'fixed_amount' ? styles.radioOptionSelected : ''}`}
                onClick={() => setBulkMode('fixed_amount')}
              >
                <DollarSign size={16} />
                Fixed Monthly Bump (₦)
              </div>
            </div>

            <div style={{ maxWidth: '400px', marginBottom: '1.5rem' }}>
              {bulkMode === 'percentage' ? (
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Percentage Increase (%) *</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    className={styles.formInput}
                    placeholder="e.g. 10"
                    value={bulkPercentage}
                    onChange={(e) => setBulkPercentage(e.target.value)}
                    required
                  />
                </div>
              ) : (
                <div className={styles.formGroup}>
                  <label className={styles.formLabel}>Fixed Amount Bump (₦) *</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    className={styles.formInput}
                    placeholder="e.g. 20,000"
                    value={bulkAmount}
                    onChange={(e) => setBulkAmount(formatNumberWithCommas(e.target.value))}
                    required
                  />
                </div>
              )}
            </div>

            {/* Impact Analysis Card */}
            <div className={styles.previewBox}>
              <div className={styles.previewHeader}>
                <div className={styles.previewTitle}>
                  <Building2 size={18} />
                  Bulk Impact Projection Analysis
                </div>
                <div className={styles.previewBadge}>
                  {bulkFilteredStaff.length} Staff Affected
                </div>
              </div>

              <div className={styles.comparisonRow}>
                <div className={styles.comparisonItem}>
                  <div className={styles.comparisonLabel}>Current Monthly Payroll</div>
                  <div className={styles.comparisonValue} style={{ color: '#64748b' }}>
                    ₦{formatCurrency(currentBulkPayroll)}
                  </div>
                </div>

                <div className={styles.comparisonItem} style={{ borderColor: '#86efac' }}>
                  <div className={styles.comparisonLabel}>Projected New Monthly Payroll</div>
                  <div className={styles.comparisonValue} style={{ color: '#059669' }}>
                    ₦{formatCurrency(projectedBulkPayroll)}
                  </div>
                </div>

                <div className={styles.comparisonItem} style={{ borderColor: '#bae6fd' }}>
                  <div className={styles.comparisonLabel}>Monthly Cost Increase</div>
                  <div className={styles.comparisonValue} style={{ color: '#0284c7' }}>
                    +₦{formatCurrency(bulkTotalIncrease)}
                  </div>
                </div>
              </div>
            </div>

            <button
              type="submit"
              className={`${styles.btn} ${styles.btnPrimary}`}
              disabled={submitting || bulkFilteredStaff.length === 0}
            >
              {submitting ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
              {submitting ? 'Applying Bulk Increment...' : `Apply Bulk Increment (${bulkFilteredStaff.length} Staff)`}
            </button>
          </form>
        </div>
      )}

      {/* TAB 3: Spreadsheet Bulk Import */}
      {activeTab === 'upload' && (
        <div className={styles.formCard}>
          <div className={styles.cardHeader}>
            <div>
              <h2 className={styles.cardTitle}>Spreadsheet Bulk Import</h2>
              <p className={styles.cardDesc}>Upload an Excel (.xlsx, .xls) or CSV file with employee IDs, increment percentages, or new gross amounts.</p>
            </div>
          </div>

          <form onSubmit={handleUploadSubmit}>
            <div
              className={`${styles.uploadZone} ${dragActive ? styles.uploadZoneActive : ''}`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => document.getElementById('file-upload-input').click()}
            >
              <Upload size={36} className={styles.uploadIcon} />
              <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)', marginBottom: '0.25rem' }}>
                {uploadFile ? uploadFile.name : 'Click to select or drag and drop your spreadsheet here'}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Supported formats: .xlsx, .xls, .csv (Max 5MB)
              </div>
              <input
                id="file-upload-input"
                type="file"
                accept=".xlsx,.xls,.csv"
                style={{ display: 'none' }}
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    setUploadFile(e.target.files[0]);
                  }
                }}
              />
            </div>

            {uploadWarnings.length > 0 && (
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', padding: '1rem', borderRadius: '0.5rem', marginBottom: '1.25rem' }}>
                <div style={{ fontWeight: 700, color: '#991b1b', marginBottom: '0.5rem' }}>Import Warnings:</div>
                <ul style={{ margin: 0, paddingLeft: '1.2rem', color: '#b91c1c', fontSize: '0.85rem' }}>
                  {uploadWarnings.map((w, i) => <li key={i}>{w}</li>)}
                </ul>
              </div>
            )}

            <button
              type="submit"
              className={`${styles.btn} ${styles.btnPrimary}`}
              disabled={submitting || !uploadFile}
            >
              {submitting ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
              {submitting ? 'Uploading & Processing...' : 'Process Spreadsheet Import'}
            </button>
          </form>
        </div>
      )}

      {/* Bottom Section: Increment Audit Trail & Activity Log */}
      <div className={styles.historyCard}>
        <div className={styles.tableToolbar}>
          <div>
            <h2 className={styles.cardTitle}>Salary Increment Audit History</h2>
            <p className={styles.cardDesc}>Complete history of staff wage adjustments and audit trail.</p>
          </div>

          <div className={styles.tableFilters}>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                className={styles.formInput}
                placeholder="Search staff or reason..."
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                style={{ paddingLeft: '2rem', width: '220px' }}
              />
              <Search size={14} style={{ position: 'absolute', left: '0.7rem', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            </div>

            <select
              className={styles.formSelect}
              value={historyDeptFilter}
              onChange={(e) => setHistoryDeptFilter(e.target.value)}
              style={{ width: '180px' }}
            >
              <option value="">All Departments</option>
              {departments.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>

            <button
              type="button"
              className={`${styles.btn} ${styles.btnSuccess}`}
              onClick={handleExportHistoryExcel}
              disabled={exportingHistory || historyRecords.length === 0}
            >
              {exportingHistory ? <Loader2 size={16} className="animate-spin" /> : <FileSpreadsheet size={16} />}
              Export to Excel (.xlsx)
            </button>
          </div>
        </div>

        {/* History Table */}
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>ID</th>
                <th>Staff Name</th>
                <th>Department</th>
                <th>Adjustment Type</th>
                <th className={styles.tdMoney}>Previous Gross (₦)</th>
                <th className={styles.tdMoney}>New Gross (₦)</th>
                <th className={styles.tdIncrease}>Increase (₦)</th>
                <th>Effective Date</th>
                <th>Reason / Remarks</th>
                <th>Applied By</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {loadingHistory ? (
                <tr>
                  <td colSpan={12} style={{ textAlign: 'center', padding: '2rem' }}>
                    <Loader2 size={24} className="animate-spin" style={{ margin: '0 auto', color: '#0284c7' }} />
                  </td>
                </tr>
              ) : historyRecords.length > 0 ? (
                historyRecords.map(r => (
                  <tr key={r.id}>
                    <td style={{ fontWeight: 600 }}>#{r.id}</td>
                    <td>
                      <strong>{r.staff_name}</strong>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>ID: {r.staff_id}</div>
                    </td>
                    <td>{r.department || 'General'}</td>
                    <td>
                      <span style={{ textTransform: 'capitalize', fontWeight: 600, color: '#0284c7' }}>
                        {r.increment_type?.replace('_', ' ')}
                        {r.percentage ? ` (${r.percentage}%)` : ''}
                      </span>
                    </td>
                    <td className={styles.tdMoney}>{formatCurrency(r.previous_gross_salary)}</td>
                    <td className={styles.tdMoney} style={{ fontWeight: 700 }}>{formatCurrency(r.new_gross_salary)}</td>
                    <td className={styles.tdIncrease}>+₦{formatCurrency(r.increase_amount)}</td>
                    <td>{r.effective_date || '—'}</td>
                    <td style={{ maxWidth: '200px', whiteSpace: 'normal', fontSize: '0.8rem' }}>{r.reason || '—'}</td>
                    <td>{r.created_by_name || 'Admin'}</td>
                    <td>
                      <span className={r.status === 'applied' ? styles.badgeApplied : styles.badgeReverted}>
                        {r.status === 'applied' ? 'Active' : 'Reverted'}
                      </span>
                    </td>
                    <td>
                      {r.status === 'applied' && (
                        <button
                          type="button"
                          className={`${styles.btn} ${styles.btnOutline}`}
                          style={{ padding: '0.35rem 0.65rem', fontSize: '0.75rem', color: '#dc2626' }}
                          onClick={() => setRevertTarget(r)}
                        >
                          <RotateCcw size={12} />
                          Revert
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={12} style={{ textAlign: 'center', padding: '2rem', color: '#64748b' }}>
                    No salary increment records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {historyPagination.last_page > 1 && (
          <div className={styles.pagination}>
            <div>
              Showing page <strong>{historyPagination.current_page}</strong> of <strong>{historyPagination.last_page}</strong> ({historyPagination.total} total records)
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnOutline}`}
                disabled={historyPagination.current_page <= 1}
                onClick={() => {
                  const p = historyPagination.current_page - 1;
                  setHistoryPage(p);
                  fetchHistory(p);
                }}
              >
                Previous
              </button>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnOutline}`}
                disabled={historyPagination.current_page >= historyPagination.last_page}
                onClick={() => {
                  const p = historyPagination.current_page + 1;
                  setHistoryPage(p);
                  fetchHistory(p);
                }}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Revert Confirmation Modal */}
      {revertTarget && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalContent}>
            <h3 className={styles.modalTitle}>Revert Salary Increment?</h3>
            <p style={{ fontSize: '0.88rem', color: '#475569', lineHeight: 1.5 }}>
              Are you sure you want to revert the salary increment for <strong>{revertTarget.staff_name}</strong>?
            </p>
            <div style={{ background: '#f8fafc', padding: '0.85rem', borderRadius: '0.5rem', border: '1px solid #e2e8f0', margin: '1rem 0' }}>
              <div style={{ fontSize: '0.82rem', color: '#64748b' }}>Current Gross: <strong>₦{formatCurrency(revertTarget.new_gross_salary)}</strong></div>
              <div style={{ fontSize: '0.82rem', color: '#059669', marginTop: '0.25rem' }}>Restored Gross: <strong>₦{formatCurrency(revertTarget.previous_gross_salary)}</strong></div>
            </div>

            <div className={styles.modalActions}>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnOutline}`}
                onClick={() => setRevertTarget(null)}
                disabled={reverting}
              >
                Cancel
              </button>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnDanger}`}
                onClick={handleConfirmRevert}
                disabled={reverting}
              >
                {reverting ? <Loader2 size={16} className="animate-spin" /> : <RotateCcw size={16} />}
                {reverting ? 'Reverting...' : 'Confirm Revert'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
