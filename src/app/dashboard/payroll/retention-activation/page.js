"use client";

import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  Users,
  UserCheck,
  UserX,
  Search,
  Loader2,
  FileText,
  AlertCircle,
  CheckCircle2,
  UploadCloud,
  Download,
  AlertTriangle,
  Landmark,
  ShieldCheck,
  ShieldAlert,
  Check,
  X,
  Edit2,
  Printer,
} from 'lucide-react';
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

export default function RetentionActivationPage() {
  // Navigation & UI States
  const [activeTab, setActiveTab] = useState('manual'); // 'manual' | 'bulk'
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [toast, setToast] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [warnings, setWarnings] = useState([]);

  // Data States
  const [staffRecords, setStaffRecords] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [staffStatusFilter, setStaffStatusFilter] = useState('all'); // 'all' | 'active' | 'inactive'
  const [selectedIds, setSelectedIds] = useState([]);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isAdminStaff, setIsAdminStaff] = useState(false);
  const [isFinanceStaff, setIsFinanceStaff] = useState(false);

  // Edit Deducted Months Modal State
  const [editingStaff, setEditingStaff] = useState(null);
  const [editMonths, setEditMonths] = useState(0);
  const [editStartMonth, setEditStartMonth] = useState('');
  const [updatingMonths, setUpdatingMonths] = useState(false);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState('10');

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, itemsPerPage, staffStatusFilter]);

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 6000);
  }, []);

  // Fetch initial data
  const fetchData = useCallback(async (silent = false) => {
    const cacheKey = 'hrms_retention_act_cache_v2';
    if (!silent && typeof window !== 'undefined') {
      try {
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && (parsed.length === 0 || parsed[0]?.staff_status !== undefined)) {
            setStaffRecords(parsed);
          }
        }
      } catch (err) {
        console.error('Failed to parse cached retention data:', err);
      }
    }

    if (!silent) setLoading(true);
    const headers = buildHeaders();
    try {
      const res = await axios.get(`${API_BASE}/payroll/retention-activation`, { headers });
      if (res.data.status === 'success') {
        const freshData = res.data.data || [];
        setStaffRecords(freshData);
        setIsSuperAdmin(Boolean(res.data.isSuperAdmin));
        setIsAdminStaff(Boolean(res.data.isAdminStaff));
        setIsFinanceStaff(Boolean(res.data.isFinanceStaff));
        if (typeof window !== 'undefined') {
          sessionStorage.setItem(cacheKey, JSON.stringify(freshData));
        }
      }
    } catch (err) {
      showToast('Failed to retrieve retention status list.', 'error');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [showToast]);

  // Use deferred loading
  useEffect(() => {
    let hasCache = false;
    if (typeof window !== 'undefined') {
      const cached = sessionStorage.getItem('hrms_retention_act_cache_v2');
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && (parsed.length === 0 || parsed[0]?.staff_status !== undefined)) {
            hasCache = true;
          }
        } catch { /* ignore */ }
      }
    }
    if (!hasCache) {
      const timer = setTimeout(() => {
        fetchData();
      }, 50);
      return () => clearTimeout(timer);
    } else {
      const cached = sessionStorage.getItem('hrms_retention_act_cache_v2');
      if (cached) {
        try {
          setStaffRecords(JSON.parse(cached));
        } catch { /* ignore */ }
      }
      fetchData(true);
    }
  }, [fetchData]);

  const canManageRetention = isSuperAdmin || isAdminStaff || isFinanceStaff;

  // Handle Toggle Retention Status
  const handleToggleRetention = async (staffId, currentStatus) => {
    if (saving) return;

    if (!canManageRetention) {
      showToast('Permission denied: Only Super Administrators and HR Head are authorized to activate and deactivate staff retention.', 'warning');
      return;
    }

    const newStatus = currentStatus === 1 ? 0 : 1;

    // Optimistic UI update
    const originalRecords = [...staffRecords];
    setStaffRecords(prev =>
      prev.map(r => r.id === staffId ? { ...r, reten_act: newStatus } : r)
    );

    setSaving(true);
    const headers = buildHeaders();
    try {
      const res = await axios.post(`${API_BASE}/payroll/retention-activation/toggle`, {
        staff_id: staffId,
        reten_act: newStatus
      }, { headers });

      if (res.data.status === 'success') {
        showToast(res.data.message || 'Retention status updated successfully.');
        fetchData(true); // silent refresh
      } else {
        setStaffRecords(originalRecords); // rollback
        showToast(res.data.message || 'Failed to update retention status.', 'error');
      }
    } catch (err) {
      setStaffRecords(originalRecords); // rollback
      showToast(err.response?.data?.message || 'Server error updating status.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleOpenEditModal = (row) => {
    setEditingStaff(row);
    const existingMonths = (row.num_rente_months !== null && row.num_rente_months !== undefined && row.num_rente_months !== '')
      ? Number(row.num_rente_months)
      : (row.monthly_retention > 0 ? Math.round((Number(row.total_retention_deducted) || 0) / Number(row.monthly_retention)) : 0);
    setEditMonths(Math.min(20, Math.max(0, existingMonths)));
    setEditStartMonth(row.activation_date ? row.activation_date.slice(0, 7) : '');
  };

  const handleSaveMonths = async (e) => {
    e?.preventDefault();
    if (!editingStaff) return;

    if (!canManageRetention) {
      showToast('Permission denied: Only Super Administrators, HR Head, and Finance Head are authorized to update retention deducted months.', 'warning');
      return;
    }

    const monthsNum = parseInt(editMonths, 10);
    if (isNaN(monthsNum) || monthsNum < 0 || monthsNum > 20) {
      showToast('Please enter a valid number of months between 0 and 20.', 'error');
      return;
    }

    setUpdatingMonths(true);
    try {
      const res = await axios.post(`${API_BASE}/payroll/retention-activation/update-months`, {
        staff_id: editingStaff.id,
        num_rente_months: monthsNum,
        start_month: editStartMonth || null,
      }, {
        headers: buildHeaders()
      });

      if (res.data.status === 'success') {
        showToast(res.data.message || 'Deducted months updated successfully.');
        setEditingStaff(null);
        fetchData(true);
      } else {
        showToast(res.data.message || 'Failed to update deducted months.', 'error');
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Server error updating deducted months.', 'error');
    } finally {
      setUpdatingMonths(false);
    }
  };

  // Handle Bulk Toggle Retention Status
  const handleBulkToggleRetention = async (targetStatus) => {
    if (selectedIds.length === 0 || saving) return;

    if (!canManageRetention) {
      showToast('Permission denied: Only Super Administrators and HR Head are authorized to bulk activate and deactivate staff retention.', 'warning');
      return;
    }

    setSaving(true);
    // Optimistic UI update
    const originalRecords = [...staffRecords];
    setStaffRecords(prev =>
      prev.map(r => selectedIds.includes(r.id) ? { ...r, reten_act: targetStatus } : r)
    );

    const headers = buildHeaders();
    try {
      const res = await axios.post(`${API_BASE}/payroll/retention-activation/bulk-toggle`, {
        staff_ids: selectedIds,
        reten_act: targetStatus
      }, { headers });

      if (res.data.status === 'success') {
        showToast(res.data.message || `Successfully ${targetStatus === 1 ? 'activated' : 'deactivated'} retention for ${selectedIds.length} staff.`);
        setSelectedIds([]);
        fetchData(true); // silent refresh
      } else {
        setStaffRecords(originalRecords); // rollback
        showToast(res.data.message || 'Bulk update failed.', 'error');
      }
    } catch (err) {
      setStaffRecords(originalRecords); // rollback
      showToast(err.response?.data?.message || 'Server error during bulk update.', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Drag and drop event handlers
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = async (e) => {
    if (e.target.files && e.target.files[0]) {
      await handleFileUpload(e.target.files[0]);
    }
  };

  // File upload processing
  const handleFileUpload = async (file) => {
    if (!file) return;

    if (!canManageRetention) {
      showToast('Permission denied: Only Super Administrators and HR Head are authorized to import staff retention.', 'warning');
      return;
    }

    const fileType = file.name.split('.').pop().toLowerCase();
    if (!['xlsx', 'xls', 'csv'].includes(fileType)) {
      showToast('Invalid file format. Please upload Excel (.xlsx, .xls) or CSV.', 'error');
      return;
    }

    const maxSizeBytes = 5 * 1024 * 1024; // 5MB limit
    if (file.size > maxSizeBytes) {
      showToast('File size is too large. Maximum allowed size is 5MB.', 'error');
      return;
    }

    setUploading(true);
    setWarnings([]);

    const formData = new FormData();
    formData.append('excel_file', file);

    try {
      const res = await axios.post(`${API_BASE}/payroll/retention-activation/import`, formData, {
        headers: {
          ...buildHeaders(),
          'Content-Type': 'multipart/form-data',
        }
      });

      if (res.data.status === 'success') {
        showToast(res.data.message || 'Spreadsheet processed successfully.');
        if (res.data.warnings && res.data.warnings.length > 0) {
          setWarnings(res.data.warnings);
          setTimeout(() => setWarnings([]), 30000);
        }
        fetchData(true); // refresh table silently
      } else {
        showToast(res.data.message || 'Import failed.', 'error');
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Server error importing file.', 'error');
    } finally {
      setUploading(false);
    }
  };

  // Download template helper
  const handleDownloadTemplate = () => {
    const headers = [
      'staffId',
      'first_salary',
      'total_deducted',
      'balance_to_be_deducted'
    ];
    const sampleRow = [
      '1',
      '200000.00',
      '20000.00',
      '180000.00'
    ];
    const csvContent = "data:text/csv;charset=utf-8,"
      + [headers.join(','), sampleRow.join(',')].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "retention_activation_template.csv");
    document.body.appendChild(link);
    link.click();
    link.remove();
    showToast('Downloaded Excel template CSV!');
  };


  // Calculate staff status counts
  const countAllStaff = staffRecords.length;
  const countActiveStaff = staffRecords.filter(r => Number(r.staff_status !== undefined ? r.staff_status : 1) === 1).length;
  const countInactiveStaff = staffRecords.filter(r => Number(r.staff_status) === 0).length;

  // Filtered staff list
  const filteredRecords = staffRecords.filter(r => {
    const staffStatusNum = Number(r.staff_status !== undefined ? r.staff_status : 1);
    if (staffStatusFilter === 'active' && staffStatusNum !== 1) {
      return false;
    }
    if (staffStatusFilter === 'inactive' && staffStatusNum !== 0) {
      return false;
    }

    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return r.name?.toLowerCase().includes(q) ||
      r.fileNo?.toLowerCase().includes(q) ||
      String(r.id).includes(q);
  });

  // Statistics
  const totalPersonnel = staffRecords.length;
  const activeRetentionCount = staffRecords.filter(r => r.reten_act === 1).length;
  const inactiveRetentionCount = totalPersonnel - activeRetentionCount;
  const totalRetentionDeducted = staffRecords.reduce((acc, r) => acc + (parseFloat(r.total_retention_deducted) || 0), 0);

  // Filtered statistics for reports
  const filteredActiveStaffCount = filteredRecords.filter(r => Number(r.staff_status !== undefined ? r.staff_status : 1) === 1).length;
  const filteredInactiveStaffCount = filteredRecords.filter(r => Number(r.staff_status) === 0).length;
  const filteredActiveRetentionCount = filteredRecords.filter(r => r.reten_act === 1).length;
  const filteredInactiveRetentionCount = filteredRecords.filter(r => r.reten_act !== 1).length;
  const filteredTotalGrossSalary = filteredRecords.reduce((acc, r) => acc + (parseFloat(r.gross_salary) || 0), 0);
  const filteredTotalMonthlyRetention = filteredRecords.reduce((acc, r) => acc + (parseFloat(r.monthly_retention) || 0), 0);
  const filteredTotalRetentionDeducted = filteredRecords.reduce((acc, r) => acc + (parseFloat(r.total_retention_deducted) || 0), 0);

  // CSV Export Function
  const exportToCSV = () => {
    if (filteredRecords.length === 0) {
      showToast('No staff records available to export.', 'error');
      return;
    }

    const headers = [
      'S/N',
      'Staff ID',
      'Staff Name',
      'Staff Status',
      'File No',
      'Department',
      'First Gross Salary (NGN)',
      'Monthly Retention 5% (NGN)',
      'Retention Status',
      'Total Deducted (NGN)',
      'Deducted Months',
      'Remaining Months'
    ];

    const rows = filteredRecords.map((r, i) => [
      i + 1,
      r.id || '',
      `"${(r.name || '').replace(/"/g, '""')}"`,
      Number(r.staff_status) === 0 ? 'Inactive Staff' : 'Active Staff',
      `"${(r.fileNo || '').replace(/"/g, '""')}"`,
      `"${(r.department || 'N/A').replace(/"/g, '""')}"`,
      parseFloat(r.gross_salary) || 0,
      parseFloat(r.monthly_retention) || 0,
      r.reten_act === 1 ? 'Active' : 'Inactive',
      parseFloat(r.total_retention_deducted) || 0,
      r.deducted_months ?? 0,
      r.remaining_months ?? 0
    ]);

    const csvData = [headers.join(','), ...rows.map(e => e.join(','))].join('\r\n');
    const blob = new Blob(['\uFEFF' + csvData], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    const dateStr = new Date().toISOString().split('T')[0];
    const statusSuffix = staffStatusFilter === 'active' ? '_active_staff' : staffStatusFilter === 'inactive' ? '_inactive_staff' : '_all_staff';
    link.setAttribute('download', `staff_retention_activation${statusSuffix}_${dateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast(`Exported ${filteredRecords.length} staff retention record(s) to CSV.`);
  };

  // Print Statement / Report
  const handlePrint = () => {
    if (filteredRecords.length === 0) {
      showToast('No records available to print.', 'error');
      return;
    }
    window.print();
  };

  // Pagination calculation
  const totalPages = itemsPerPage === 'all'
    ? 1
    : Math.ceil(filteredRecords.length / parseInt(itemsPerPage, 10)) || 1;
  const paginatedRecords = itemsPerPage === 'all'
    ? filteredRecords
    : filteredRecords.slice(
        (currentPage - 1) * parseInt(itemsPerPage, 10),
        currentPage * parseInt(itemsPerPage, 10)
      );

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        .retentionPrintArea {
          display: none;
        }

        @media print {
          @page {
            size: landscape;
            margin: 8mm 6mm 10mm 6mm;
          }

          html, body {
            background: #ffffff !important;
            color: #000000 !important;
            margin: 0 !important;
            padding: 0 !important;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          /* Hide screen UI */
          .screen-content,
          aside,
          nav,
          header,
          footer,
          button,
          form,
          .no-print {
            display: none !important;
            visibility: hidden !important;
          }

          /* Show Print Layout */
          .retentionPrintArea {
            display: block !important;
            visibility: visible !important;
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            color: #000000 !important;
            z-index: 99999 !important;
          }

          .retentionPrintArea * {
            visibility: visible !important;
          }
        }
      `}} />

      <div className={`${styles.container} screen-content`}>
        {/* Toast Feedback */}
        {toast && (
          <div className={`${styles.toast} ${toast.type === 'success' ? styles.toastSuccess : styles.toastError}`}>
            {toast.type === 'success' ? (
              <CheckCircle2 size={18} className={styles.toastSuccessIcon} />
            ) : (
              <AlertCircle size={18} className={styles.toastErrorIcon} />
            )}
            <span>{toast.message}</span>
          </div>
        )}

        {/* Page Header */}
        <div className={styles.header}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', width: '100%' }}>
            <div>
              <h1 style={{ margin: 0 }}>Staff Retention Activation</h1>
              <p style={{ margin: '4px 0 0' }}>Manage and configure retention deduction status for active personnel individually or in bulk via spreadsheet imports.</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={exportToCSV}
                disabled={filteredRecords.length === 0}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  padding: '0.45rem 0.85rem',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#334155',
                  fontSize: '0.85rem',
                  fontWeight: 500,
                  cursor: filteredRecords.length === 0 ? 'not-allowed' : 'pointer',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                }}
                title="Export Configurations to CSV"
              >
                <Download size={16} />
                <span>Export CSV ({filteredRecords.length})</span>
              </button>
              <button
                type="button"
                onClick={handlePrint}
                disabled={filteredRecords.length === 0}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  padding: '0.45rem 0.85rem',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#334155',
                  fontSize: '0.85rem',
                  fontWeight: 500,
                  cursor: filteredRecords.length === 0 ? 'not-allowed' : 'pointer',
                  boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
                }}
                title="Print Staff Retention Report"
              >
                <Printer size={16} />
                <span>Print ({filteredRecords.length})</span>
              </button>
            </div>
          </div>
        </div>

      {/* Tabs */}
      <div className={styles.tabs}>
        <button
          className={`${styles.tabBtn} ${activeTab === 'manual' ? styles.activeTabBtn : ''}`}
          onClick={() => setActiveTab('manual')}
        >
          <Users size={16} />
          Manual Retention Setup
        </button>
        <button
          className={`${styles.tabBtn} ${activeTab === 'bulk' ? styles.activeTabBtn : ''}`}
          onClick={() => setActiveTab('bulk')}
        >
          <UploadCloud size={16} />
          Bulk Upload Spreadsheet
        </button>
      </div>

      {/* Stats Widgets */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: 'linear-gradient(135deg,#6366f1,#4f46e5)' }}>
            <Users size={22} color="#fff" />
          </div>
          <div className={styles.statInfo}>
            <div className={styles.statLabel}>Total Staff</div>
            <div className={styles.statValue}>{totalPersonnel.toLocaleString()}</div>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: 'linear-gradient(135deg,#10b981,#059669)' }}>
            <ShieldCheck size={22} color="#fff" />
          </div>
          <div className={styles.statInfo}>
            <div className={styles.statLabel}>Retention Active</div>
            <div className={styles.statValue}>{activeRetentionCount.toLocaleString()}</div>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: 'linear-gradient(135deg,#ef4444,#dc2626)' }}>
            <ShieldAlert size={22} color="#fff" />
          </div>
          <div className={styles.statInfo}>
            <div className={styles.statLabel}>Retention Inactive</div>
            <div className={styles.statValue}>{inactiveRetentionCount.toLocaleString()}</div>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)' }}>
            <Landmark size={22} color="#fff" />
          </div>
          <div className={styles.statInfo}>
            <div className={styles.statLabel}>Total Deducted (₦)</div>
            <div className={styles.statValue}>
              ₦{totalRetentionDeducted.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
        </div>
      </div>

      {/* Tab Panels */}
      {activeTab === 'manual' ? (
        <div className={styles.tableCard}>
            <div className={styles.tableHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                <h2 className={styles.tableTitle}>
                  <FileText size={18} />
                  Personnel Retention Registry
                </h2>
                {selectedIds.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => handleBulkToggleRetention(1)}
                      disabled={saving}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        padding: '0.4rem 0.85rem',
                        borderRadius: '8px',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        border: 'none',
                        background: '#10b981',
                        color: '#fff',
                        cursor: 'pointer',
                      }}
                      title="Activate retention for all selected staff"
                    >
                      <Check size={14} />
                      Bulk Activate ({selectedIds.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => handleBulkToggleRetention(0)}
                      disabled={saving}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        padding: '0.4rem 0.85rem',
                        borderRadius: '8px',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        border: 'none',
                        background: '#fee2e2',
                        color: '#b91c1c',
                        cursor: 'pointer',
                      }}
                      title="Deactivate retention for all selected staff"
                    >
                      <X size={14} />
                      Bulk Deactivate ({selectedIds.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedIds([])}
                      disabled={saving}
                      style={{
                        padding: '0.4rem 0.6rem',
                        borderRadius: '8px',
                        fontSize: '0.75rem',
                        fontWeight: 500,
                        border: '1px solid var(--border, #e2e8f0)',
                        background: 'transparent',
                        color: 'var(--text-secondary, #64748b)',
                        cursor: 'pointer',
                      }}
                    >
                      Clear
                    </button>
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                <div className={styles.tableSearch}>
                  <Search size={16} className={styles.tableSearchIcon} />
                  <input
                    type="text"
                    placeholder="Search by staff name, ID or file no..."
                    className={styles.tableSearchInput}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', color: 'var(--text-secondary, #64748b)' }}>
                  <span style={{ fontWeight: 500 }}>Show:</span>
                  <select
                    value={itemsPerPage}
                    onChange={(e) => {
                      setItemsPerPage(e.target.value);
                      setCurrentPage(1);
                    }}
                    style={{
                      padding: '0.4rem 0.5rem',
                      borderRadius: '6px',
                      border: '1px solid var(--border, #e2e8f0)',
                      background: 'var(--bg-primary, #fff)',
                      color: 'var(--text-primary, #1e293b)',
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      outline: 'none',
                    }}
                  >
                    <option value="10">10 records</option>
                    <option value="20">20 records</option>
                    <option value="30">30 records</option>
                    <option value="40">40 records</option>
                    <option value="50">50 records</option>
                    <option value="100">100 records</option>
                    <option value="all">All Records</option>
                  </select>
                </div>
                <button
                  type="button"
                  onClick={exportToCSV}
                  disabled={filteredRecords.length === 0}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    padding: '0.4rem 0.75rem',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    color: '#334155',
                    fontSize: '0.825rem',
                    fontWeight: 500,
                    cursor: filteredRecords.length === 0 ? 'not-allowed' : 'pointer',
                  }}
                  title="Export Configurations to CSV"
                >
                  <Download size={15} />
                  <span>Export CSV</span>
                </button>
                <button
                  type="button"
                  onClick={handlePrint}
                  disabled={filteredRecords.length === 0}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    padding: '0.4rem 0.75rem',
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    background: '#ffffff',
                    color: '#334155',
                    fontSize: '0.825rem',
                    fontWeight: 500,
                    cursor: filteredRecords.length === 0 ? 'not-allowed' : 'pointer',
                  }}
                  title="Print Staff Retention Report"
                >
                  <Printer size={15} />
                  <span>Print</span>
                </button>
              </div>
            </div>

            {/* Staff Status Toggle Filters */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.85rem 1.25rem',
              backgroundColor: '#f8fafc',
              borderBottom: '1px solid var(--border, #e2e8f0)',
              flexWrap: 'wrap',
              gap: '0.75rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.825rem', fontWeight: 600, color: '#475569', marginRight: '0.25rem' }}>
                  Staff Filter:
                </span>

                {/* Toggle: All Active & Inactive Staff */}
                <button
                  type="button"
                  onClick={() => { setStaffStatusFilter('all'); setCurrentPage(1); }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                    padding: '0.42rem 0.9rem',
                    borderRadius: '8px',
                    fontSize: '0.825rem',
                    fontWeight: staffStatusFilter === 'all' ? 600 : 500,
                    border: staffStatusFilter === 'all' ? '1.5px solid var(--primary, #3b82f6)' : '1px solid #cbd5e1',
                    backgroundColor: staffStatusFilter === 'all' ? 'var(--primary, #3b82f6)' : '#ffffff',
                    color: staffStatusFilter === 'all' ? '#ffffff' : '#334155',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    boxShadow: staffStatusFilter === 'all' ? '0 1px 3px rgba(59, 130, 246, 0.3)' : '0 1px 2px rgba(0,0,0,0.04)'
                  }}
                  title="View all staff (Active and Inactive)"
                >
                  <Users size={15} />
                  <span>All (Active & Inactive Staff)</span>
                  <span style={{
                    marginLeft: '4px',
                    padding: '1px 6px',
                    borderRadius: '9999px',
                    fontSize: '0.725rem',
                    fontWeight: 600,
                    backgroundColor: staffStatusFilter === 'all' ? 'rgba(255,255,255,0.25)' : '#f1f5f9',
                    color: staffStatusFilter === 'all' ? '#ffffff' : '#64748b'
                  }}>
                    {countAllStaff}
                  </span>
                </button>

                {/* Toggle: Active Staff */}
                <button
                  type="button"
                  onClick={() => { setStaffStatusFilter('active'); setCurrentPage(1); }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                    padding: '0.42rem 0.9rem',
                    borderRadius: '8px',
                    fontSize: '0.825rem',
                    fontWeight: staffStatusFilter === 'active' ? 600 : 500,
                    border: staffStatusFilter === 'active' ? '1.5px solid #059669' : '1px solid #cbd5e1',
                    backgroundColor: staffStatusFilter === 'active' ? '#059669' : '#ffffff',
                    color: staffStatusFilter === 'active' ? '#ffffff' : '#334155',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    boxShadow: staffStatusFilter === 'active' ? '0 1px 3px rgba(5, 150, 105, 0.3)' : '0 1px 2px rgba(0,0,0,0.04)'
                  }}
                  title="Toggle to view Active Staff"
                >
                  <UserCheck size={15} />
                  <span>Active Staff</span>
                  <span style={{
                    marginLeft: '4px',
                    padding: '1px 6px',
                    borderRadius: '9999px',
                    fontSize: '0.725rem',
                    fontWeight: 600,
                    backgroundColor: staffStatusFilter === 'active' ? 'rgba(255,255,255,0.25)' : '#ecfdf5',
                    color: staffStatusFilter === 'active' ? '#ffffff' : '#059669'
                  }}>
                    {countActiveStaff}
                  </span>
                </button>

                {/* Toggle: Inactive Staff */}
                <button
                  type="button"
                  onClick={() => { setStaffStatusFilter('inactive'); setCurrentPage(1); }}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                    padding: '0.42rem 0.9rem',
                    borderRadius: '8px',
                    fontSize: '0.825rem',
                    fontWeight: staffStatusFilter === 'inactive' ? 600 : 500,
                    border: staffStatusFilter === 'inactive' ? '1.5px solid #dc2626' : '1px solid #cbd5e1',
                    backgroundColor: staffStatusFilter === 'inactive' ? '#dc2626' : '#ffffff',
                    color: staffStatusFilter === 'inactive' ? '#ffffff' : '#334155',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    boxShadow: staffStatusFilter === 'inactive' ? '0 1px 3px rgba(220, 38, 38, 0.3)' : '0 1px 2px rgba(0,0,0,0.04)'
                  }}
                  title="Toggle to view Inactive Staff"
                >
                  <UserX size={15} />
                  <span>Inactive Staff</span>
                  <span style={{
                    marginLeft: '4px',
                    padding: '1px 6px',
                    borderRadius: '9999px',
                    fontSize: '0.725rem',
                    fontWeight: 600,
                    backgroundColor: staffStatusFilter === 'inactive' ? 'rgba(255,255,255,0.25)' : '#fef2f2',
                    color: staffStatusFilter === 'inactive' ? '#ffffff' : '#dc2626'
                  }}>
                    {countInactiveStaff}
                  </span>
                </button>
              </div>

              <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                Showing <strong>{filteredRecords.length}</strong> of <strong>{countAllStaff}</strong> staff
                {staffStatusFilter !== 'all' && (
                  <span style={{ marginLeft: '4px', fontWeight: 600, color: staffStatusFilter === 'active' ? '#059669' : '#dc2626' }}>
                    ({staffStatusFilter === 'active' ? 'Active staff only' : 'Inactive staff only'})
                  </span>
                )}
              </div>
            </div>

            <div className={styles.tableWrapper}>
              {loading ? (
                <div className={styles.loadingState}>
                  <Loader2 size={40} className={styles.spinner} />
                  <span>Fetching personnel records...</span>
                </div>
              ) : paginatedRecords.length > 0 ? (
                <>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th style={{ width: '40px', textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                            checked={
                              paginatedRecords.length > 0 &&
                              paginatedRecords.every(r => selectedIds.includes(r.id))
                            }
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedIds(prev => {
                                  const next = [...prev];
                                  paginatedRecords.forEach(r => {
                                    if (!next.includes(r.id)) next.push(r.id);
                                  });
                                  return next;
                                });
                              } else {
                                const pageIds = paginatedRecords.map(r => r.id);
                                setSelectedIds(prev => prev.filter(id => !pageIds.includes(id)));
                              }
                            }}
                          />
                        </th>
                        <th>Staff ID</th>
                        <th>Staff Name</th>
                        <th>First Gross Salary (₦)</th>
                        <th>Monthly Retention (5%)</th>
                        <th>Status</th>
                        <th>Total Deducted (₦)</th>
                        <th>Remaining Months</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedRecords.map((row) => (
                        <tr key={row.id}>
                          <td style={{ textAlign: 'center' }}>
                            <input
                              type="checkbox"
                              style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                              checked={selectedIds.includes(row.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedIds(prev => [...prev, row.id]);
                                } else {
                                  setSelectedIds(prev => prev.filter(id => id !== row.id));
                                }
                              }}
                            />
                          </td>
                          <td className={styles.tdPrimary}>{row.id}</td>
                          <td style={{ fontWeight: 600 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                              <span>{row.name}</span>
                              {Number(row.staff_status) === 0 && (
                                <span
                                  title="Inactive Staff"
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    padding: '1px 6px',
                                    borderRadius: '9999px',
                                    fontSize: '0.68rem',
                                    fontWeight: 600,
                                    backgroundColor: '#fee2e2',
                                    color: '#dc2626',
                                    border: '1px solid #fca5a5',
                                    lineHeight: 1.2
                                  }}
                                >
                                  Inactive Staff
                                </span>
                              )}
                            </div>
                          </td>
                          <td>
                            {row.gross_salary > 0
                              ? `₦${row.gross_salary.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                              : '₦0.00'
                            }
                          </td>
                          <td style={{ color: '#2563eb', fontWeight: 600 }}>
                            {row.monthly_retention > 0
                              ? `₦${row.monthly_retention.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                              : '₦0.00'
                            }
                          </td>
                          <td>
                            {row.reten_act === 1 ? (
                              <span className={`${styles.badge} ${styles.badgeActive}`}>Active</span>
                            ) : (
                              <span className={`${styles.badge} ${styles.badgeInactive}`}>Inactive</span>
                            )}
                          </td>
                          <td>
                            <div style={{ fontWeight: 600, color: (row.total_retention_deducted > 0) ? 'var(--text-primary)' : 'var(--text-secondary, #64748b)' }}>
                              {row.total_retention_deducted > 0
                                ? `₦${Number(row.total_retention_deducted).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                : '₦0.00'
                              }
                            </div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary, #64748b)' }}>
                              {row.num_rente_months || 0} of 20 mos
                            </div>
                          </td>
                          <td>
                            {row.reten_act === 1 ? (
                              <div>
                                <span style={{ fontWeight: 600, color: row.remaining_months === 0 ? '#10b981' : 'var(--text-primary)' }}>
                                  {row.remaining_months !== undefined ? `${row.remaining_months} mos` : '—'}
                                </span>
                                {row.remaining_months > 0 && row.monthly_retention > 0 && (
                                  <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary, #64748b)', display: 'block' }}>
                                    (₦{(row.remaining_months * row.monthly_retention).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} left)
                                  </span>
                                )}
                                {row.remaining_months === 0 && (
                                  <span style={{ fontSize: '0.72rem', color: '#10b981', display: 'block', fontWeight: 600 }}>
                                    Completed (20/20)
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary, #94a3b8)' }}>
                                Not Active
                              </span>
                            )}
                          </td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                              <button
                                type="button"
                                className={styles.btnEditMonths}
                                onClick={() => {
                                  if (canManageRetention) {
                                    handleOpenEditModal(row);
                                  } else {
                                    showToast('Permission denied: Only Super Administrators, HR Head, and Finance Head are authorized to update retention deducted months.', 'warning');
                                  }
                                }}
                                disabled={!canManageRetention}
                                title={canManageRetention ? "Edit Deducted Retention Months" : "Super Admin, HR Head, and Finance Head only"}
                                style={!canManageRetention ? { opacity: 0.6, cursor: 'not-allowed' } : {}}
                              >
                                <Edit2 size={12} />
                                Edit Months
                              </button>
                              {row.reten_act === 1 ? (
                                <button
                                  type="button"
                                  className={`${styles.actionBtn} ${styles.btnDeactivate}`}
                                  onClick={() => handleToggleRetention(row.id, 1)}
                                  disabled={saving || !canManageRetention}
                                  title={canManageRetention ? "Deactivate Retention" : "Super Admin and HR Head only"}
                                  style={!canManageRetention ? { opacity: 0.6, cursor: 'not-allowed' } : {}}
                                >
                                  Deactivate
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  className={`${styles.actionBtn} ${styles.btnActivate}`}
                                  onClick={() => handleToggleRetention(row.id, 0)}
                                  disabled={saving || !canManageRetention}
                                  title={canManageRetention ? "Activate Retention" : "Super Admin and HR Head only"}
                                  style={!canManageRetention ? { opacity: 0.6, cursor: 'not-allowed' } : {}}
                                >
                                  Activate
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* Pagination Footer */}
                  <div className={styles.pagination}>
                    <span className={styles.paginationText}>
                      Showing {filteredRecords.length === 0 ? 0 : (itemsPerPage === 'all' ? 1 : (currentPage - 1) * parseInt(itemsPerPage, 10) + 1)} to {itemsPerPage === 'all' ? filteredRecords.length : Math.min(currentPage * parseInt(itemsPerPage, 10), filteredRecords.length)} of {filteredRecords.length} records {itemsPerPage !== 'all' && totalPages > 1 && `(Page ${currentPage} of ${totalPages})`}
                    </span>
                    {itemsPerPage !== 'all' && totalPages > 1 && (
                      <div className={styles.paginationButtons}>
                        <button
                          type="button"
                          className={`${styles.btn} ${styles.btnSecondary}`}
                          disabled={currentPage === 1}
                          onClick={() => setCurrentPage(1)}
                        >
                          First
                        </button>
                        <button
                          type="button"
                          className={`${styles.btn} ${styles.btnSecondary}`}
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
                              style={{ minWidth: '28px' }}
                              onClick={() => setCurrentPage(pageNum)}
                            >
                              {pageNum}
                            </button>
                          );
                        })}

                        <button
                          type="button"
                          className={`${styles.btn} ${styles.btnSecondary}`}
                          disabled={currentPage === totalPages}
                          onClick={() => setCurrentPage(c => Math.min(totalPages, c + 1))}
                        >
                          Next
                        </button>
                        <button
                          type="button"
                          className={`${styles.btn} ${styles.btnSecondary}`}
                          disabled={currentPage === totalPages}
                          onClick={() => setCurrentPage(totalPages)}
                        >
                          Last
                        </button>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className={styles.emptyState}>
                  <FileText size={48} />
                  <h3>No Staff Records Found</h3>
                  <p>Try refining your search terms or verify that active staff records exist.</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className={styles.formCard}>
            <h2 className={styles.cardTitle}>Spreadsheet Retention Import</h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.25rem', marginTop: '-0.75rem' }}>
              Upload an Excel file (.xlsx, .xls) or CSV template listing Staff IDs to activate retention for multiple staff members simultaneously.
            </p>

            {/* Drag & Drop Area */}
            <div
              className={`${styles.uploadZone} ${dragActive ? styles.uploadZoneActive : ''}`}
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              onClick={() => document.getElementById('bulk-retention-input').click()}
            >
              <input
                type="file"
                id="bulk-retention-input"
                className={styles.fileInput}
                accept=".xlsx,.xls,.csv"
                onChange={handleFileChange}
              />
              {uploading ? (
                <Loader2 size={48} className={styles.spinner} />
              ) : (
                <UploadCloud size={48} />
              )}
              <div>
                <p className={styles.uploadZoneTitle}>
                  {uploading ? 'Analyzing spreadsheet...' : 'Drag & drop Excel or CSV file here'}
                </p>
                <p className={styles.uploadZoneDesc}>
                  {!uploading && 'or click to browse local files (Supports .xlsx, .xls, .csv)'}
                </p>
              </div>
            </div>

            {/* Template Download Option */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
              <button
                type="button"
                className={styles.btnDownloadTemplate}
                onClick={handleDownloadTemplate}
              >
                <Download size={14} />
                Download CSV Column Template
              </button>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                Required columns: <strong>staffId, first_salary, total_deducted, balance_to_be_deducted</strong> (use <code>-</code> or <code>0</code> in balance if retention is completed)
              </span>
            </div>

            {/* Warnings Alerts */}
            {warnings.length > 0 && (
              <div className={styles.warningCard}>
                <h4>
                  <AlertTriangle size={16} style={{ verticalAlign: 'middle', marginRight: '0.35rem' }} />
                  Import completed with some warnings:
                </h4>
                <ul className={styles.warningList}>
                  {warnings.map((warn, i) => (
                    <li key={i}>{warn}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

      {/* Edit Deducted Months Modal */}
      {editingStaff && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalBox}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>
                <Edit2 size={18} style={{ color: 'var(--primary)' }} />
                Adjust Retention Deducted Months
              </h3>
              <button
                type="button"
                className={styles.modalClose}
                onClick={() => setEditingStaff(null)}
                disabled={updatingMonths}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveMonths}>
              <div className={styles.modalBody}>
                {/* Staff Summary */}
                <div className={styles.staffSummaryCard}>
                  <div className={styles.staffSummaryName}>{editingStaff.name}</div>
                  <div className={styles.staffSummaryMeta}>
                    <span>Staff ID: <strong>{editingStaff.id}</strong></span>
                    <span>First Gross: <strong>₦{editingStaff.gross_salary ? editingStaff.gross_salary.toLocaleString('en-NG', { minimumFractionDigits: 2 }) : '0.00'}</strong></span>
                  </div>
                  <div className={styles.staffSummaryMeta}>
                    <span>Monthly 5%: <strong>₦{editingStaff.monthly_retention ? editingStaff.monthly_retention.toLocaleString('en-NG', { minimumFractionDigits: 2 }) : '0.00'}</strong></span>
                    <span>Target: <strong>₦{editingStaff.total_retention_target ? editingStaff.total_retention_target.toLocaleString('en-NG', { minimumFractionDigits: 2 }) : '0.00'}</strong></span>
                  </div>
                </div>

                {/* Deducted Months Input */}
                <div className={styles.formGroup}>
                  <label className={styles.label}>
                    Deducted Months (0 to 20 Months) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="20"
                    className={styles.input}
                    value={editMonths}
                    onChange={(e) => setEditMonths(Math.min(20, Math.max(0, parseInt(e.target.value || 0, 10))))}
                    required
                  />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    Set the number of monthly retention deductions already completed for this employee.
                  </span>
                </div>

                {/* Start Month */}
                <div className={styles.formGroup}>
                  <label className={styles.label}>
                    Activation / Start Month (Optional)
                  </label>
                  <input
                    type="month"
                    className={styles.input}
                    value={editStartMonth}
                    onChange={(e) => setEditStartMonth(e.target.value)}
                  />
                </div>

                {/* Real-time Calculation Preview */}
                <div className={styles.previewGrid}>
                  <div className={styles.previewItem}>
                    <span className={styles.previewLabel}>Calculated Deducted</span>
                    <span className={styles.previewValue}>
                      ₦{((parseInt(editMonths || 0, 10)) * (editingStaff.monthly_retention || 0)).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className={styles.previewItem}>
                    <span className={styles.previewLabel}>Remaining Months</span>
                    <span className={styles.previewValue} style={{ color: (20 - parseInt(editMonths || 0, 10)) === 0 ? '#16a34a' : '#14532d' }}>
                      {Math.max(0, 20 - parseInt(editMonths || 0, 10))} of 20 mos {(20 - parseInt(editMonths || 0, 10)) === 0 ? '✓ Completed' : ''}
                    </span>
                  </div>
                </div>
              </div>

              <div className={styles.modalFooter}>
                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnSecondary}`}
                  onClick={() => setEditingStaff(null)}
                  disabled={updatingMonths}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`${styles.btn} ${styles.btnPrimary}`}
                  disabled={updatingMonths}
                  style={{ padding: '0.5rem 1.1rem', fontSize: '0.85rem' }}
                >
                  {updatingMonths ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>

    {/* Printable Report View (Visible only during window.print()) */}
    <div className="retentionPrintArea">
      <div style={{ paddingBottom: '10px', borderBottom: '2px solid #0f172a', marginBottom: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{ margin: 0, fontSize: '15pt', fontWeight: '800', textTransform: 'uppercase', color: '#0f172a', letterSpacing: '0.5px' }}>
              ISALU HOSPITALS LIMITED
            </h1>
            <h2 style={{ margin: '3px 0 0', fontSize: '11pt', fontWeight: '700', color: '#334155' }}>
              STAFF RETENTION ACTIVATION & DEDUCTION DIRECTORY
            </h2>
            <p style={{ margin: '2px 0 0', fontSize: '8pt', color: '#64748b' }}>
              Official record of staff retention activation status, salary base, monthly retention (5%), and total accumulated deductions
            </p>
          </div>
          <div style={{ textAlign: 'right', fontSize: '8pt', color: '#475569', lineHeight: 1.4 }}>
            <div><strong>Generated:</strong> {new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
            <div><strong>Staff Filter:</strong> {staffStatusFilter === 'active' ? 'Active Staff Only' : staffStatusFilter === 'inactive' ? 'Inactive Staff Only' : 'All Staff (Active & Inactive)'}</div>
            {searchQuery.trim() && <div><strong>Search:</strong> "{searchQuery.trim()}"</div>}
            <div><strong>Total Records:</strong> {filteredRecords.length}</div>
          </div>
        </div>

        {/* Metrics Summary Banner */}
        <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px 16px', marginTop: '10px', padding: '6px 10px', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '4px', fontSize: '8pt' }}>
          <div>Total Staff: <strong>{countAllStaff}</strong></div>
          <div>Active Staff: <strong style={{ color: '#059669' }}>{filteredActiveStaffCount}</strong></div>
          <div>Inactive Staff: <strong style={{ color: '#dc2626' }}>{filteredInactiveStaffCount}</strong></div>
          <div>Active Retention: <strong style={{ color: '#059669' }}>{filteredActiveRetentionCount}</strong></div>
          <div>Inactive Retention: <strong style={{ color: '#64748b' }}>{filteredInactiveRetentionCount}</strong></div>
          <div>Total Gross Salaries: <strong>₦{filteredTotalGrossSalary.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></div>
          <div>Total Monthly Retention (5%): <strong>₦{filteredTotalMonthlyRetention.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></div>
          <div>Total Accumulated Deductions: <strong style={{ color: '#059669' }}>₦{filteredTotalRetentionDeducted.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></div>
        </div>
      </div>

      {/* Printable Data Table */}
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '8pt', textAlign: 'left' }}>
        <thead>
          <tr style={{ background: '#0f172a', color: '#ffffff' }}>
            <th style={{ padding: '6px 8px', border: '1px solid #334155', textAlign: 'center', width: '30px' }}>S/N</th>
            <th style={{ padding: '6px 8px', border: '1px solid #334155', width: '65px' }}>Staff ID</th>
            <th style={{ padding: '6px 8px', border: '1px solid #334155' }}>Staff Name</th>
            <th style={{ padding: '6px 8px', border: '1px solid #334155', textAlign: 'center', width: '70px' }}>Staff Status</th>
            <th style={{ padding: '6px 8px', border: '1px solid #334155' }}>Department</th>
            <th style={{ padding: '6px 8px', border: '1px solid #334155', textAlign: 'right' }}>First Gross Salary</th>
            <th style={{ padding: '6px 8px', border: '1px solid #334155', textAlign: 'right' }}>Monthly Retention (5%)</th>
            <th style={{ padding: '6px 8px', border: '1px solid #334155', textAlign: 'center' }}>Retention Status</th>
            <th style={{ padding: '6px 8px', border: '1px solid #334155', textAlign: 'right' }}>Total Deducted</th>
            <th style={{ padding: '6px 8px', border: '1px solid #334155', textAlign: 'center' }}>Deducted / Remaining</th>
          </tr>
        </thead>
        <tbody>
          {filteredRecords.map((row, idx) => (
            <tr key={row.id} style={{ background: idx % 2 === 0 ? '#ffffff' : '#f8fafc' }}>
              <td style={{ padding: '5px 8px', border: '1px solid #cbd5e1', textAlign: 'center' }}>{idx + 1}</td>
              <td style={{ padding: '5px 8px', border: '1px solid #cbd5e1', fontWeight: '600' }}>{row.id}</td>
              <td style={{ padding: '5px 8px', border: '1px solid #cbd5e1', fontWeight: '500' }}>{row.name}</td>
              <td style={{ padding: '5px 8px', border: '1px solid #cbd5e1', textAlign: 'center', fontWeight: '600', color: Number(row.staff_status) === 0 ? '#dc2626' : '#059669' }}>
                {Number(row.staff_status) === 0 ? 'Inactive' : 'Active'}
              </td>
              <td style={{ padding: '5px 8px', border: '1px solid #cbd5e1' }}>{row.department || 'N/A'}</td>
              <td style={{ padding: '5px 8px', border: '1px solid #cbd5e1', textAlign: 'right' }}>
                ₦{parseFloat(row.gross_salary || 0).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </td>
              <td style={{ padding: '5px 8px', border: '1px solid #cbd5e1', textAlign: 'right' }}>
                ₦{parseFloat(row.monthly_retention || 0).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </td>
              <td style={{ padding: '5px 8px', border: '1px solid #cbd5e1', textAlign: 'center', fontWeight: '600', color: row.reten_act === 1 ? '#059669' : '#dc2626' }}>
                {row.reten_act === 1 ? 'Active' : 'Inactive'}
              </td>
              <td style={{ padding: '5px 8px', border: '1px solid #cbd5e1', textAlign: 'right', fontWeight: '600' }}>
                ₦{parseFloat(row.total_retention_deducted || 0).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </td>
              <td style={{ padding: '5px 8px', border: '1px solid #cbd5e1', textAlign: 'center' }}>
                {row.deducted_months ?? 0} / {row.remaining_months ?? 0} mos
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr style={{ background: '#f1f5f9', fontWeight: '700' }}>
            <td colSpan={5} style={{ padding: '6px 8px', border: '1px solid #cbd5e1', textAlign: 'right' }}>TOTAL:</td>
            <td style={{ padding: '6px 8px', border: '1px solid #cbd5e1', textAlign: 'right' }}>
              ₦{filteredTotalGrossSalary.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </td>
            <td style={{ padding: '6px 8px', border: '1px solid #cbd5e1', textAlign: 'right' }}>
              ₦{filteredTotalMonthlyRetention.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </td>
            <td style={{ padding: '6px 8px', border: '1px solid #cbd5e1' }}></td>
            <td style={{ padding: '6px 8px', border: '1px solid #cbd5e1', textAlign: 'right' }}>
              ₦{filteredTotalRetentionDeducted.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </td>
            <td style={{ padding: '6px 8px', border: '1px solid #cbd5e1' }}></td>
          </tr>
        </tfoot>
      </table>

      {/* Print Footer */}
      <div style={{ marginTop: '14px', paddingTop: '8px', borderTop: '1px solid #cbd5e1', display: 'flex', justifyContent: 'space-between', fontSize: '7.5pt', color: '#64748b' }}>
        <div>Isalu Hospitals Limited &bull; Human Resources & Payroll System</div>
        <div>Confidential &bull; Page 1 of 1</div>
      </div>
    </div>
  </>
  );
}
