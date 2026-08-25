"use client";

import { useState, useEffect, useCallback } from 'react';
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
  const [selectedIds, setSelectedIds] = useState([]);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState('10');

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, itemsPerPage]);

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 6000);
  }, []);

  // Fetch initial data
  const fetchData = useCallback(async (silent = false) => {
    const cacheKey = 'hrms_retention_act_cache';
    if (!silent && typeof window !== 'undefined') {
      try {
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
          setStaffRecords(JSON.parse(cached));
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
      hasCache = !!sessionStorage.getItem('hrms_retention_act_cache');
    }
    if (!hasCache) {
      const timer = setTimeout(() => {
        fetchData();
      }, 50);
      return () => clearTimeout(timer);
    } else {
      const cached = sessionStorage.getItem('hrms_retention_act_cache');
      if (cached) {
        setStaffRecords(JSON.parse(cached));
      }
      fetchData(true);
    }
  }, [fetchData]);

  // Handle Toggle Retention Status
  const handleToggleRetention = async (staffId, currentStatus) => {
    if (saving) return;

    const newStatus = currentStatus === 1 ? 0 : 1;

    // Only super admin can manually deactivate retention
    if (newStatus === 0 && !isSuperAdmin) {
      showToast('Permission denied: Only Super Administrators are authorized to manually deactivate staff retention.', 'warning');
      return;
    }

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

  // Handle Bulk Toggle Retention Status
  const handleBulkToggleRetention = async (targetStatus) => {
    if (selectedIds.length === 0 || saving) return;

    // Only super admin can manually deactivate retention
    if (targetStatus === 0 && !isSuperAdmin) {
      showToast('Permission denied: Only Super Administrators are authorized to manually deactivate staff retention.', 'warning');
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


  // Filtered staff list
  const filteredRecords = staffRecords.filter(r =>
    r.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.fileNo?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    String(r.id).includes(searchQuery)
  );

  // Statistics
  const totalPersonnel = staffRecords.length;
  const activeRetentionCount = staffRecords.filter(r => r.reten_act === 1).length;
  const inactiveRetentionCount = totalPersonnel - activeRetentionCount;
  const totalRetentionDeducted = staffRecords.reduce((acc, r) => acc + (parseFloat(r.total_retention_deducted) || 0), 0);

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
    <div className={styles.container}>
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
        <h1>Staff Retention Activation</h1>
        <p>Manage and configure retention deduction status for active personnel individually or in bulk via spreadsheet imports.</p>
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
                        <th>Basic Salary (₦)</th>
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
                          <td style={{ fontWeight: 600 }}>{row.name}</td>
                          <td>
                            {row.basic_salary > 0
                              ? `₦${row.basic_salary.toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
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
                            {row.reten_act === 1 ? (
                              <button
                                type="button"
                                className={`${styles.actionBtn} ${styles.btnDeactivate}`}
                                onClick={() => handleToggleRetention(row.id, 1)}
                                disabled={saving}
                              >
                                Deactivate
                              </button>
                            ) : (
                              <button
                                type="button"
                                className={`${styles.actionBtn} ${styles.btnActivate}`}
                                onClick={() => handleToggleRetention(row.id, 0)}
                                disabled={saving}
                              >
                                Activate
                              </button>
                            )}
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
    </div>
  );
}
