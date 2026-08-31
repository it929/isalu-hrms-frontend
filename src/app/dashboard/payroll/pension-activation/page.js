"use client";

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import {
  Users,
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
  CheckSquare,
  Square,
  RotateCcw
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

export default function PensionActivationPage() {
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
  const [selectedIds, setSelectedIds] = useState([]);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState('10');

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4500);
  }, []);

  // Fetch initial data
  const fetchData = useCallback(async (silent = false) => {
    const cacheKey = 'hrms_pension_act_cache';
    if (!silent && typeof window !== 'undefined') {
      try {
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
          setStaffRecords(JSON.parse(cached));
        }
      } catch (err) {
        console.error('Failed to parse cached pension data:', err);
      }
    }

    if (!silent) setLoading(true);
    const headers = buildHeaders();
    try {
      const res = await axios.get(`${API_BASE}/payroll/pension-activation`, { headers });
      if (res.data.status === 'success') {
        const freshData = res.data.data || [];
        setStaffRecords(freshData);
        if (typeof window !== 'undefined') {
          sessionStorage.setItem(cacheKey, JSON.stringify(freshData));
        }
      }
    } catch (err) {
      showToast('Failed to retrieve pension status list.', 'error');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [showToast]);

  // Use deferred loading to prevent React 19 / Next 16 eslint rule warnings
  useEffect(() => {
    let hasCache = false;
    if (typeof window !== 'undefined') {
      hasCache = !!sessionStorage.getItem('hrms_pension_act_cache');
    }
    if (!hasCache) {
      const timer = setTimeout(() => {
        fetchData();
      }, 50);
      return () => clearTimeout(timer);
    } else {
      const cached = sessionStorage.getItem('hrms_pension_act_cache');
      if (cached) {
        setStaffRecords(JSON.parse(cached));
      }
    }
  }, [fetchData]);

  // Handle Toggle Pension Status (Single)
  const handleTogglePension = async (staffId, currentStatus) => {
    if (saving) return;

    const newStatus = currentStatus === 1 ? 0 : 1;

    // Optimistic UI update
    const originalRecords = [...staffRecords];
    setStaffRecords(prev =>
      prev.map(r => r.id === staffId ? { ...r, pen_act: newStatus } : r)
    );

    setSaving(true);
    const headers = buildHeaders();
    try {
      const res = await axios.post(`${API_BASE}/payroll/pension-activation/toggle`, {
        staff_id: staffId,
        pen_act: newStatus
      }, { headers });

      if (res.data.status === 'success') {
        showToast(res.data.message || 'Pension status updated successfully.');
        fetchData(true); // silent refresh
      } else {
        setStaffRecords(originalRecords); // rollback
        showToast(res.data.message || 'Failed to update pension status.', 'error');
      }
    } catch (err) {
      setStaffRecords(originalRecords); // rollback
      showToast(err.response?.data?.message || 'Server error updating status.', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Handle Bulk Toggle Pension Status
  const handleBulkTogglePension = async (targetStatus) => {
    if (selectedIds.length === 0 || saving) return;

    setSaving(true);
    // Optimistic UI update
    const originalRecords = [...staffRecords];
    setStaffRecords(prev =>
      prev.map(r => selectedIds.includes(r.id) ? { ...r, pen_act: targetStatus } : r)
    );

    const headers = buildHeaders();
    try {
      const res = await axios.post(`${API_BASE}/payroll/pension-activation/bulk-toggle`, {
        staff_ids: selectedIds,
        pen_act: targetStatus
      }, { headers });

      if (res.data.status === 'success') {
        showToast(res.data.message || `Successfully ${targetStatus === 1 ? 'activated' : 'deactivated'} pension for ${selectedIds.length} staff.`);
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

  // Selection handlers
  const handleSelectRow = (staffId) => {
    setSelectedIds(prev =>
      prev.includes(staffId) ? prev.filter(id => id !== staffId) : [...prev, staffId]
    );
  };

  const handleSelectAllVisible = (pageIds) => {
    const allSelected = pageIds.every(id => selectedIds.includes(id));
    if (allSelected) {
      setSelectedIds(prev => prev.filter(id => !pageIds.includes(id)));
    } else {
      setSelectedIds(prev => Array.from(new Set([...prev, ...pageIds])));
    }
  };

  const handleSelectByStatus = (status) => {
    if (status === 'all') {
      setSelectedIds(filteredRecords.map(r => r.id));
    } else if (status === 'active') {
      setSelectedIds(filteredRecords.filter(r => r.pen_act === 1).map(r => r.id));
    } else if (status === 'inactive') {
      setSelectedIds(filteredRecords.filter(r => r.pen_act === 0).map(r => r.id));
    } else if (status === 'none') {
      setSelectedIds([]);
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
      const res = await axios.post(`${API_BASE}/payroll/pension-activation/import`, formData, {
        headers: {
          ...buildHeaders(),
          'Content-Type': 'multipart/form-data',
        }
      });

      if (res.data.status === 'success') {
        showToast(res.data.message || 'Spreadsheet processed successfully.');
        if (res.data.warnings && res.data.warnings.length > 0) {
          setWarnings(res.data.warnings);
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
    const headers = ['staffId'];
    const sampleRow = ['1'];
    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), sampleRow.join(',')].join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "pension_activation_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Downloaded Excel template CSV!');
  };

  // Filtered staff list
  const filteredRecords = staffRecords.filter(r =>
    r.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.fileNo?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    String(r.id).includes(searchQuery)
  );

  // Statistics
  const totalPersonnel = staffRecords.length;
  const activePensionCount = staffRecords.filter(r => r.pen_act === 1).length;
  const inactivePensionCount = totalPersonnel - activePensionCount;

  // Pagination calculations
  const totalPages = itemsPerPage === 'all'
    ? 1
    : Math.ceil(filteredRecords.length / parseInt(itemsPerPage, 10)) || 1;
  const startIndex = (currentPage - 1) * parseInt(itemsPerPage, 10);
  const paginatedRecords = itemsPerPage === 'all'
    ? filteredRecords
    : filteredRecords.slice(startIndex, startIndex + parseInt(itemsPerPage, 10));

  const pageStaffIds = paginatedRecords.map(r => r.id);
  const isAllPageSelected = pageStaffIds.length > 0 && pageStaffIds.every(id => selectedIds.includes(id));
  const isSomePageSelected = pageStaffIds.some(id => selectedIds.includes(id)) && !isAllPageSelected;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className={styles.container}
    >
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
        <h1>Staff Pension Activation</h1>
        <p>Manage and configure pension status for active personnel individually or in bulk via checkbox selections and spreadsheet imports.</p>
      </div>

      {/* Tabs */}
      <div className={styles.tabs}>
        <button
          className={`${styles.tabBtn} ${activeTab === 'manual' ? styles.activeTabBtn : ''}`}
          onClick={() => {
            setActiveTab('manual');
            setCurrentPage(1);
          }}
        >
          <Users size={16} />
          Manual & Bulk Pension Setup
        </button>
        <button
          className={`${styles.tabBtn} ${activeTab === 'bulk' ? styles.activeTabBtn : ''}`}
          onClick={() => setActiveTab('bulk')}
        >
          <UploadCloud size={16} />
          Spreadsheet Import
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
            <div className={styles.statLabel}>Pension Active</div>
            <div className={styles.statValue}>{activePensionCount.toLocaleString()}</div>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: 'linear-gradient(135deg,#ef4444,#dc2626)' }}>
            <ShieldAlert size={22} color="#fff" />
          </div>
          <div className={styles.statInfo}>
            <div className={styles.statLabel}>Pension Inactive</div>
            <div className={styles.statValue}>{inactivePensionCount.toLocaleString()}</div>
          </div>
        </div>
      </div>

      {/* Tab Panels */}
      <AnimatePresence mode="wait">
        {activeTab === 'manual' ? (
          <motion.div
            key="manual"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            transition={{ duration: 0.2 }}
            className={styles.tableCard}
          >
            {/* Table Header & Search Controls */}
            <div className={styles.tableHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                <h2 className={styles.tableTitle}>
                  <FileText size={18} />
                  Personnel Pension Registry
                </h2>

                {/* Bulk Action Controls */}
                {selectedIds.length > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      onClick={() => handleBulkTogglePension(1)}
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
                        transition: 'opacity 0.2s',
                      }}
                      title="Activate pension for all selected staff"
                    >
                      <Check size={14} />
                      Bulk Activate ({selectedIds.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => handleBulkTogglePension(0)}
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
                        transition: 'opacity 0.2s',
                      }}
                      title="Deactivate pension for all selected staff"
                    >
                      <X size={14} />
                      Bulk Deactivate ({selectedIds.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedIds([])}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.35rem',
                        padding: '0.4rem 0.65rem',
                        borderRadius: '8px',
                        fontSize: '0.75rem',
                        border: '1px solid var(--border)',
                        background: 'transparent',
                        color: 'var(--text-secondary)',
                        cursor: 'pointer',
                      }}
                    >
                      <RotateCcw size={12} />
                      Clear ({selectedIds.length})
                    </button>
                  </div>
                )}
              </div>

              <div className={styles.tableControls}>
                <div className={styles.tableSearch}>
                  <Search size={16} className={styles.tableSearchIcon} />
                  <input
                    type="text"
                    placeholder="Search by name or Staff ID..."
                    className={styles.tableSearchInput}
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setCurrentPage(1);
                    }}
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
            </div>

            {/* Quick Selection Presets Bar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 1.5rem', background: 'color-mix(in srgb, var(--bg) 50%, transparent)', borderBottom: '1px solid var(--border)', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>Quick Selection:</span>
              <button
                type="button"
                onClick={() => handleSelectByStatus('all')}
                style={{
                  fontSize: '0.75rem',
                  padding: '0.2rem 0.5rem',
                  borderRadius: '6px',
                  border: '1px solid var(--border)',
                  background: 'var(--surface)',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                }}
              >
                Select All Filtered ({filteredRecords.length})
              </button>
              <button
                type="button"
                onClick={() => handleSelectByStatus('inactive')}
                style={{
                  fontSize: '0.75rem',
                  padding: '0.2rem 0.5rem',
                  borderRadius: '6px',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  background: 'rgba(239, 68, 68, 0.05)',
                  color: '#ef4444',
                  cursor: 'pointer',
                }}
              >
                Select Inactive ({inactivePensionCount})
              </button>
              <button
                type="button"
                onClick={() => handleSelectByStatus('active')}
                style={{
                  fontSize: '0.75rem',
                  padding: '0.2rem 0.5rem',
                  borderRadius: '6px',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  background: 'rgba(16, 185, 129, 0.05)',
                  color: '#10b981',
                  cursor: 'pointer',
                }}
              >
                Select Active ({activePensionCount})
              </button>
              {selectedIds.length > 0 && (
                <button
                  type="button"
                  onClick={() => handleSelectByStatus('none')}
                  style={{
                    fontSize: '0.75rem',
                    padding: '0.2rem 0.5rem',
                    borderRadius: '6px',
                    border: '1px solid var(--border)',
                    background: 'transparent',
                    color: '#64748b',
                    cursor: 'pointer',
                  }}
                >
                  Deselect All
                </button>
              )}
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
                            checked={isAllPageSelected}
                            ref={input => {
                              if (input) input.indeterminate = isSomePageSelected;
                            }}
                            onChange={() => handleSelectAllVisible(pageStaffIds)}
                            style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                            title="Select all on this page"
                          />
                        </th>
                        <th>Staff ID</th>
                        <th>Staff Name</th>
                        <th>Salary (₦)</th>
                        <th>Pension Status</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedRecords.map((row) => {
                        const isSelected = selectedIds.includes(row.id);
                        return (
                          <tr 
                            key={row.id} 
                            style={{ 
                              background: isSelected ? 'rgba(99, 102, 241, 0.05)' : 'transparent',
                              transition: 'background 0.15s ease'
                            }}
                          >
                            <td style={{ textAlign: 'center' }}>
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => handleSelectRow(row.id)}
                                style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                              />
                            </td>
                            <td className={styles.tdPrimary}>#{row.id}</td>
                            <td style={{ fontWeight: 600 }}>
                              {row.name}
                            </td>
                            <td>
                              {row.basic_salary > 0 
                                ? `₦${row.basic_salary.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                : '₦0.00'
                              }
                            </td>
                            <td>
                              {row.pen_act === 1 ? (
                                <span className={`${styles.badge} ${styles.badgeActive}`}>Active</span>
                              ) : (
                                <span className={`${styles.badge} ${styles.badgeInactive}`}>Inactive</span>
                              )}
                            </td>
                            <td>
                              {row.pen_act === 1 ? (
                                <button
                                  type="button"
                                  className={`${styles.actionBtn} ${styles.btnDeactivate}`}
                                  onClick={() => handleTogglePension(row.id, 1)}
                                  disabled={saving}
                                >
                                  Deactivate
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  className={`${styles.actionBtn} ${styles.btnActivate}`}
                                  onClick={() => handleTogglePension(row.id, 0)}
                                  disabled={saving}
                                >
                                  Activate
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  {/* Client Pagination */}
                  <div className={styles.pagination}>
                    <span className={styles.paginationText}>
                      Showing {filteredRecords.length === 0 ? 0 : startIndex + 1} to {itemsPerPage === 'all' ? filteredRecords.length : Math.min(filteredRecords.length, startIndex + parseInt(itemsPerPage, 10))} of {filteredRecords.length} records {itemsPerPage !== 'all' && totalPages > 1 && `(Page ${currentPage} of ${totalPages})`}
                    </span>
                    {itemsPerPage !== 'all' && totalPages > 1 && (
                      <div className={styles.paginationButtons}>
                        <button
                          type="button"
                          className={styles.btnSecondary}
                          style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                          disabled={currentPage === 1}
                          onClick={() => setCurrentPage(1)}
                        >
                          First
                        </button>
                        <button
                          type="button"
                          className={styles.btnSecondary}
                          style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                          disabled={currentPage === 1}
                          onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
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
                              className={currentPage === pageNum ? styles.btnActivate : styles.btnSecondary}
                              style={{ minWidth: '32px', padding: '0.4rem 0.6rem', fontSize: '0.8rem' }}
                              onClick={() => setCurrentPage(pageNum)}
                            >
                              {pageNum}
                            </button>
                          );
                        })}

                        <button
                          type="button"
                          className={styles.btnSecondary}
                          style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                          disabled={currentPage === totalPages}
                          onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                        >
                          Next
                        </button>
                        <button
                          type="button"
                          className={styles.btnSecondary}
                          style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
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
          </motion.div>
        ) : (
          <motion.div
            key="bulk"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.2 }}
            className={styles.formCard}
          >
            <h2 className={styles.cardTitle}>Spreadsheet Pension Import</h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.25rem', marginTop: '-0.75rem' }}>
              Upload an Excel file (.xlsx, .xls) or CSV template listing Staff IDs to activate pension for multiple staff members simultaneously.
            </p>

            {/* Drag & Drop Area */}
            <div
              className={`${styles.uploadZone} ${dragActive ? styles.uploadZoneActive : ''}`}
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              onClick={() => document.getElementById('bulk-pension-input').click()}
            >
              <input
                id="bulk-pension-input"
                type="file"
                className={styles.fileInput}
                accept=".xlsx,.xls,.csv"
                onChange={handleFileChange}
              />
              <UploadCloud size={48} />
              <div>
                <p className={styles.uploadZoneTitle}>
                  {uploading ? 'Processing spreadsheet...' : 'Click to browse or drag & drop spreadsheet here'}
                </p>
                <p className={styles.uploadZoneDesc}>
                  Supported formats: Excel (.xlsx, .xls) and CSV (.csv) — Max 5MB
                </p>
              </div>
            </div>

            {/* Download Template & Instructions */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
              <button
                type="button"
                className={styles.btnDownloadTemplate}
                onClick={handleDownloadTemplate}
              >
                <Download size={14} />
                Download CSV Import Template
              </button>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Template only requires the <strong>staffId</strong> column.
              </span>
            </div>

            {/* Warnings Log Area */}
            {warnings.length > 0 && (
              <div className={styles.warningCard} style={{ marginTop: '1.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                  <AlertTriangle size={16} />
                  <h4>Import Notice ({warnings.length} issues)</h4>
                </div>
                <ul className={styles.warningList}>
                  {warnings.map((w, index) => (
                    <li key={index}>{w}</li>
                  ))}
                </ul>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
