"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { Users, Search, Loader2, FileText, AlertCircle, CheckCircle2, Edit2, Trash2, Plus, X, Calendar, Info, Check } from 'lucide-react';
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

function calculateLastDay(dateStr) {
  if (!dateStr) return '';
  try {
    const parts = dateStr.split('-');
    if (parts.length !== 3) return '';
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    const date = new Date(year, month, day);
    date.setDate(date.getDate() + 30);
    
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  } catch {
    return '';
  }
}

export default function ApplyResignationPage() {
  // Loading & Toast States
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [mounted, setMounted] = useState(false);

  // Data States
  const [staffList, setStaffList] = useState([]);
  const [records, setRecords] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Dropdown Autocomplete Staff State
  const [dropdownSearch, setDropdownSearch] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState(null);
  const dropdownRef = useRef(null);

  // User Context State
  const [userCtx, setUserCtx] = useState({
    isSuperAdmin: false,
    isAdminStaff: false,
    isFinanceStaff: false,
    isAuditStaff: false,
    isHod: false,
    employee: null,
  });

  // Modal States
  const [confirmDelete, setConfirmDelete] = useState(null); // id of record to delete
  const [actionLoading, setActionLoading] = useState(false);
  const [detailRecord, setDetailRecord] = useState(null); // record for detailed view modal
  
  // Approval Modal State
  const [approvalModal, setApprovalModal] = useState({
    show: false,
    recordId: null,
    level: '', // 'HOD', 'Finance', 'HR'
    action: '', // 'approve', 'reject'
    remarks: '',
  });

  // Form Fields
  const [editId, setEditId] = useState(null);
  const [resignationDate, setResignationDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [reason, setReason] = useState('');

  // Client-side pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4500);
  }, []);

  // Fetch staff list for dropdown
  const fetchStaffData = useCallback(async () => {
    const headers = buildHeaders();
    try {
      const res = await axios.get(`${API_BASE}/payroll/resignations/staff`, { headers });
      if (res.data.status === 'success') {
        setStaffList(res.data.data || []);
      }
    } catch (err) {
      console.error('Failed to load staff list:', err);
    }
  }, []);

  // Fetch submitted resignations list
  const fetchRecords = useCallback(async (silent = false) => {
    if (!silent) {
      setLoading(true);
    }

    const headers = buildHeaders();
    try {
      const res = await axios.get(`${API_BASE}/payroll/resignations`, { headers });
      if (res.data.status === 'success') {
        setRecords(res.data.data || []);
        setUserCtx({
          isSuperAdmin: res.data.isSuperAdmin || false,
          isAdminStaff: res.data.isAdminStaff || false,
          isFinanceStaff: res.data.isFinanceStaff || false,
          isAuditStaff: res.data.isAuditStaff || false,
          isHod: res.data.isHod || false,
          employee: res.data.employee || null,
        });
      }
    } catch (err) {
      showToast('Failed to retrieve resignation records.', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    fetchStaffData();
    fetchRecords(false);
    setMounted(true);
  }, [fetchStaffData, fetchRecords]);

  // Click outside dropdown handler
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
        if (selectedStaff) {
          setDropdownSearch(selectedStaff.name);
        } else {
          setDropdownSearch('');
        }
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [selectedStaff]);

  // Determine if active user can select other staff members (Only Super Admin)
  const canSelectStaff = userCtx.isSuperAdmin || 
    (mounted && typeof window !== 'undefined' && (() => {
      try {
        const role = JSON.parse(localStorage.getItem('hrms_role'));
        const roleName = role?.name?.toLowerCase() || '';
        return roleName === 'super admin' || roleName === 'super administrator';
      } catch {
        return false;
      }
    })());

  // Prepopulate staff selection if user is not Admin/SuperAdmin
  useEffect(() => {
    const currentEmployee = userCtx.employee;

    if (!canSelectStaff && currentEmployee) {
      const empId = currentEmployee.ID ?? currentEmployee.id;
      const rawName = `${currentEmployee.surname || ''} ${currentEmployee.first_name || ''} ${currentEmployee.othernames || ''}`;
      const fullName = currentEmployee.name || rawName.replace(/\s+/g, ' ').trim();

      const matchingStaff = staffList.find(s => String(s.id) === String(empId));
      if (matchingStaff) {
        setSelectedStaff(matchingStaff);
        setDropdownSearch(matchingStaff.name);
      } else {
        setSelectedStaff({
          id: empId,
          name: fullName,
          fileNo: currentEmployee.fileNo || '',
        });
        setDropdownSearch(fullName);
      }
    }
  }, [staffList, userCtx, canSelectStaff]);

  // Filter staff list for dropdown autocomplete
  const filteredStaff = dropdownSearch.trim() === ''
    ? staffList
    : staffList.filter(s => {
        const q = dropdownSearch.toLowerCase();
        const nameMatch = s.name ? String(s.name).toLowerCase().includes(q) : false;
        const idMatch = s.id ? String(s.id).toLowerCase().includes(q) : false;
        return nameMatch || idMatch;
      });

  const handleSelectStaff = (staff) => {
    setSelectedStaff(staff);
    setDropdownSearch(staff.name);
    setShowDropdown(false);
  };

  const handleClearForm = () => {
    setEditId(null);
    const currentEmployee = userCtx.employee;

    if (!canSelectStaff && currentEmployee) {
      const empId = currentEmployee.ID ?? currentEmployee.id;
      const matchingStaff = staffList.find(s => String(s.id) === String(empId));
      if (matchingStaff) {
        setSelectedStaff(matchingStaff);
        setDropdownSearch(matchingStaff.name);
      }
    } else {
      setSelectedStaff(null);
      setDropdownSearch('');
    }

    setResignationDate(new Date().toISOString().split('T')[0]);
    setReason('');
  };

  // Submit/Apply for Resignation
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedStaff) {
      showToast('Please select a staff member.', 'error');
      return;
    }
    if (!resignationDate) {
      showToast('Please select the resignation date.', 'error');
      return;
    }
    if (!reason.trim()) {
      showToast('Please provide a reason for resignation.', 'error');
      return;
    }

    setSaving(true);
    const headers = buildHeaders();
    const payload = {
      id: editId,
      staff_id: selectedStaff.id,
      reason: reason.trim(),
      resignation_date: resignationDate,
    };

    try {
      const res = await axios.post(`${API_BASE}/payroll/resignations`, payload, { headers });
      if (res.data.status === 'success') {
        showToast(res.data.message || 'Resignation request saved successfully.');
        handleClearForm();
        fetchRecords(true); // silent refresh
      } else {
        showToast(res.data.message || 'An error occurred.', 'error');
      }
    } catch (err) {
      const msg = err.response?.data?.message ?? 'Failed to save resignation request.';
      showToast(msg, 'error');
    } finally {
      setSaving(false);
    }
  };

  // Pre-fill fields for editing
  const handleEdit = (record) => {
    setEditId(record.id);

    const matchingStaff = staffList.find(s => s.id === record.staff_id);
    if (matchingStaff) {
      setSelectedStaff(matchingStaff);
      setDropdownSearch(matchingStaff.name);
    } else {
      const staffObj = {
        id: record.staff_id,
        name: record.name || `${record.surname} ${record.first_name}`,
        fileNo: record.fileNo || '',
      };
      setSelectedStaff(staffObj);
      setDropdownSearch(staffObj.name);
    }

    setResignationDate(record.resignation_date);
    setReason(record.reason || '');
  };

  // Delete Trigger & Deletion
  const handleDeleteTrigger = (id) => {
    setConfirmDelete(id);
  };

  const handleDeleteConfirm = async () => {
    const id = confirmDelete;
    if (!id) return;

    setActionLoading(true);
    // Optimistic delete
    const originalRecords = [...records];
    setRecords(records.filter(r => r.id !== id));

    const headers = buildHeaders();
    try {
      const res = await axios.delete(`${API_BASE}/payroll/resignations/${id}`, { headers });
      if (res.data.status === 'success') {
        showToast('Resignation request deleted successfully.');
        setConfirmDelete(null);
        fetchRecords(true); // silent sync
      } else {
        setRecords(originalRecords); // rollback
        showToast(res.data.message || 'Deletion failed.', 'error');
      }
    } catch (err) {
      setRecords(originalRecords); // rollback
      showToast('Failed to delete resignation request.', 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Approval Process Triggers & Submission
  const handleApprovalAction = (recordId, level, action) => {
    setApprovalModal({
      show: true,
      recordId,
      level,
      action,
      remarks: '',
    });
  };

  const handleApprovalSubmit = async () => {
    const { recordId, level, action, remarks } = approvalModal;
    if (!recordId) return;

    setActionLoading(true);

    // Optimistic UI Update: immediately reflect change in the table row
    const originalRecords = [...records];
    setRecords(prevRecords =>
      prevRecords.map(r => {
        if (r.id === recordId) {
          const updated = { ...r };
          if (action === 'approve') {
            if (level === 'HOD') updated.hod_status = 1;
            if (level === 'HR') {
              updated.admin_status = 1;
              updated.status = 1; // overall approved
            }
          } else {
            if (level === 'HOD') {
              updated.hod_status = 2;
              updated.status = 2; // overall rejected
            }
            if (level === 'HR') {
              updated.admin_status = 2;
              updated.status = 2; // overall rejected
            }
          }
          return updated;
        }
        return r;
      })
    );

    const headers = buildHeaders();
    const actionUrl = `${API_BASE}/payroll/resignations/${level.toLowerCase()}-${action}/${recordId}?remarks=${encodeURIComponent(remarks)}`;

    try {
      const res = await axios.get(actionUrl, { headers });
      if (res.data.status === 'success') {
        showToast(res.data.message || `Resignation request successfully ${action === 'approve' ? 'approved' : 'rejected'}.`);
        setApprovalModal({ show: false, recordId: null, level: '', action: '', remarks: '' });
        fetchRecords(true);
      } else {
        setRecords(originalRecords); // rollback
        showToast(res.data.message || 'Approval action failed.', 'error');
      }
    } catch (err) {
      setRecords(originalRecords); // rollback
      const msg = err.response?.data?.message ?? 'Failed to process resignation action.';
      showToast(msg, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  // Filter and paginated records
  const filteredRecords = records.filter(r => {
    if (selectedStaff && String(r.staff_id) !== String(selectedStaff.id)) {
      return false;
    }
    return (
      r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.staff_id && r.staff_id.toString().includes(searchQuery)) ||
      r.reason.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.department && r.department.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  });

  const totalPages = Math.ceil(filteredRecords.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedRecords = filteredRecords.slice(startIndex, startIndex + itemsPerPage);

  const isFormDisabled = !canSelectStaff && selectedStaff && String(selectedStaff.id) !== String(userCtx.employee?.ID ?? userCtx.employee?.id);

  // Helper check to determine if a tier approval button should show
  const canRecommendHOD = (row) => {
    if (row.status !== 0 || row.hod_status !== 0) return false;
    if (canSelectStaff) return true;
    if (userCtx.isHod && userCtx.employee) {
      const empId = userCtx.employee.ID ?? userCtx.employee.id;
      return row.department === userCtx.employee.department || String(row.staff_id) === String(empId);
    }
    return false;
  };

  const canRecommendHR = (row) => {
    if (row.status !== 0 || row.hod_status !== 1 || row.admin_status !== 0) return false;
    return canSelectStaff;
  };

  // Helper for overall application status badge mapping
  const getOverallBadge = (status) => {
    if (status === 1) return <span className={`${styles.badge} ${styles.badgeApproved}`}>Approved</span>;
    if (status === 2) return <span className={`${styles.badge} ${styles.badgeRejected}`}>Rejected</span>;
    return <span className={`${styles.badge} ${styles.badgePending}`}>Pending</span>;
  };

  // Helper for tier status representation
  const getTierBadge = (status, type) => {
    const label = type === 'hod' ? 'HOD' : 'HR';
    const badgeStyle = type === 'hod' ? styles.badgeHodApproved : styles.badgeHrApproved;
    if (status === 1) {
      return (
        <span className={styles.tierBadgeItem}>
          <span className={styles.tierLabel}>{label}:</span>
          <span className={`${styles.badge} ${badgeStyle}`} style={{ padding: '0.1rem 0.4rem', fontSize: '0.68rem' }}>Approved</span>
        </span>
      );
    }
    if (status === 2) {
      return (
        <span className={styles.tierBadgeItem}>
          <span className={styles.tierLabel}>{label}:</span>
          <span className={`${styles.badge} ${styles.badgeRejected}`} style={{ padding: '0.1rem 0.4rem', fontSize: '0.68rem' }}>Rejected</span>
        </span>
      );
    }
    return (
      <span className={styles.tierBadgeItem}>
        <span className={styles.tierLabel}>{label}:</span>
        <span className={`${styles.badge} ${styles.badgePending}`} style={{ padding: '0.1rem 0.4rem', fontSize: '0.68rem' }}>Pending</span>
      </span>
    );
  };

  return (
    <div className={styles.container}>
      {/* Toast Alert */}
      {toast && (
        <div className={`${styles.toast} ${toast.type === 'success' ? styles.toastSuccess : styles.toastError}`}>
          {toast.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header */}
      <div className={styles.header}>
        <h1 className={styles.title}>Apply for Resignation</h1>
        <p className={styles.subtitle}>Submit staff resignation request for processing and tiered approvals.</p>
      </div>

      {/* Form Card */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h2 className={styles.cardTitle}>
            {editId ? 'Modify Resignation Request' : 'New Resignation Request'}
          </h2>
        </div>

        <div className={styles.cardBody}>
          <form onSubmit={handleSubmit}>
            <div className={styles.formGrid}>
              
              {/* Select Staff (Autocomplete Dropdown) */}
              <div className={styles.formGroup}>
                <label className={styles.label}>Select Staff Member *</label>
                <div className={styles.dropdownContainer} ref={dropdownRef}>
                  <div className={styles.inputGroup}>
                    <Users className={styles.inputIcon} size={16} />
                    <input
                      type="text"
                      className={`${styles.input} ${styles.inputWithIcon} ${!canSelectStaff ? styles.readonly : ''}`}
                      placeholder={!canSelectStaff ? "Readonly employee context" : "Search staff by name or staff ID..."}
                      value={dropdownSearch}
                      onChange={(e) => {
                        setDropdownSearch(e.target.value);
                        setShowDropdown(true);
                        setSelectedStaff(null);
                      }}
                      onFocus={() => {
                        if (canSelectStaff) {
                          setShowDropdown(true);
                          setDropdownSearch('');
                        }
                      }}
                      disabled={!canSelectStaff}
                    />
                  </div>

                  {showDropdown && canSelectStaff && filteredStaff.length > 0 && (
                    <ul className={styles.dropdownList}>
                      {filteredStaff.map((staff) => (
                        <li
                          key={staff.id}
                          className={styles.dropdownItem}
                          onClick={() => handleSelectStaff(staff)}
                        >
                          <span className={styles.staffName}>{staff.name}</span>
                          <span className={styles.dropdownItemSub}>Staff ID: {staff.id}</span>
                        </li>
                      ))}
                    </ul>
                  )}

                  {showDropdown && canSelectStaff && filteredStaff.length === 0 && (
                    <div className={styles.dropdownList}>
                      <div className={styles.dropdownEmpty}>No active staff records found</div>
                    </div>
                  )}
                </div>
              </div>

              {/* Resignation Date */}
              <div className={styles.formGroup}>
                <label className={styles.label}>Resignation Date *</label>
                <div className={styles.inputGroup}>
                  <Calendar className={styles.inputIcon} size={16} />
                  <input
                    type="date"
                    className={`${styles.input} ${styles.inputWithIcon}`}
                    value={resignationDate}
                    onChange={(e) => setResignationDate(e.target.value)}
                    disabled={isFormDisabled}
                  />
                </div>
                {resignationDate && (
                  <span className={styles.helperText}>
                    Notice Period: 30 Days | Last Day: <strong>{calculateLastDay(resignationDate)}</strong>
                  </span>
                )}
              </div>

              {/* Reason Description */}
              <div className={`${styles.formGroup} ${styles.formGroupFull}`}>
                <label className={styles.label}>Reason for Resignation *</label>
                <textarea
                  className={styles.input}
                  rows={3}
                  placeholder="Provide details or reasons for this resignation request..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  disabled={isFormDisabled}
                />
              </div>

            </div>

            {/* Actions buttons */}
            {!isFormDisabled && (
              <div className={styles.formActions}>
                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnSecondary}`}
                  onClick={handleClearForm}
                  disabled={saving}
                >
                  Clear Fields
                </button>
                <button
                  type="submit"
                  className={`${styles.btn} ${styles.btnPrimary}`}
                  disabled={saving}
                >
                  {saving ? (
                    <>
                      <Loader2 className={styles.loadingSpinner} size={16} />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Plus size={16} />
                      {editId ? 'Update Request' : 'Submit Request'}
                    </>
                  )}
                </button>
              </div>
            )}
          </form>
        </div>
      </div>

      {/* Directory Records List */}
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h2 className={styles.cardTitle}>Resignation Registry</h2>
        </div>

        {/* Search tool */}
        <div className={styles.searchBar}>
          <div className={styles.searchInputWrapper}>
            <Search className={styles.searchIcon} />
            <input
              type="text"
              placeholder="Search registry by staff, reason..."
              className={styles.searchInput}
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
            />
          </div>
        </div>

        {/* List Table */}
        <div className={styles.tableContainer}>
          {loading ? (
            <div className={styles.emptyState}>
              <Loader2 className={styles.loadingSpinner} size={28} />
              <p style={{ marginTop: '0.75rem' }}>Synchronizing resignation records...</p>
            </div>
          ) : paginatedRecords.length === 0 ? (
            <div className={styles.emptyState}>
              <FileText className={styles.emptyIcon} size={32} />
              <p>No matching resignation records found.</p>
            </div>
          ) : (
            <>
               <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Staff Profile</th>
                    <th>Dept.</th>
                    <th>Resignation Date</th>
                    <th>Last Day</th>
                    <th>Status</th>
                    <th>Approval Statuses</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedRecords.map((row) => {
                    const rowPending = row.status === 0;
                    const empId = userCtx.employee ? (userCtx.employee.ID ?? userCtx.employee.id) : null;
                    const isOwnRow = empId && String(row.staff_id) === String(empId);
                    const canEditRow = rowPending && (canSelectStaff || isOwnRow);
                    const canDeleteRow = rowPending && (canSelectStaff || isOwnRow);

                    return (
                      <tr key={row.id}>
                        <td>
                          <div className={styles.staffCell}>
                            <span className={styles.staffName}>{row.name}</span>
                            <span className={styles.staffFile}>Staff ID: {row.staff_id}</span>
                          </div>
                        </td>
                        <td>{row.department || '—'}</td>
                        <td>{row.resignation_date}</td>
                        <td style={{ fontWeight: 500, color: 'var(--primary, #3b82f6)' }}>
                          {calculateLastDay(row.resignation_date)}
                        </td>
                        <td>{getOverallBadge(row.status)}</td>
                        <td>
                          <div className={styles.tierBadgeContainer}>
                            {getTierBadge(row.hod_status, 'hod')}
                            {getTierBadge(row.admin_status, 'hr')}
                          </div>
                        </td>
                        <td>
                          <div className={styles.actionGroup}>
                            {/* View details */}
                            <button
                              type="button"
                              className={`${styles.iconBtn} ${styles.viewBtn}`}
                              title="View details"
                              onClick={() => setDetailRecord(row)}
                            >
                              <Info size={16} />
                            </button>

                            {/* Edit pending */}
                            {canEditRow && (
                              <button
                                type="button"
                                className={`${styles.iconBtn} ${styles.editBtn}`}
                                title="Edit application"
                                onClick={() => handleEdit(row)}
                              >
                                <Edit2 size={16} />
                              </button>
                            )}

                            {/* Delete pending */}
                            {canDeleteRow && (
                              <button
                                type="button"
                                className={`${styles.iconBtn} ${styles.deleteBtn}`}
                                title="Delete application"
                                onClick={() => handleDeleteTrigger(row.id)}
                              >
                                <Trash2 size={16} />
                              </button>
                            )}

                            {/* HOD Approvals */}
                            {canRecommendHOD(row) && (
                              <div style={{ display: 'flex', gap: '0.2rem' }}>
                                <button
                                  type="button"
                                  className={`${styles.iconBtn} ${styles.approveBtn}`}
                                  title="HOD Approve"
                                  onClick={() => handleApprovalAction(row.id, 'HOD', 'approve')}
                                >
                                  <Check size={16} />
                                </button>
                                <button
                                  type="button"
                                  className={`${styles.iconBtn} ${styles.rejectBtn}`}
                                  title="HOD Reject"
                                  onClick={() => handleApprovalAction(row.id, 'HOD', 'reject')}
                                >
                                  <X size={16} />
                                </button>
                              </div>
                            )}

                            {/* HR Approvals */}
                            {canRecommendHR(row) && (
                              <div style={{ display: 'flex', gap: '0.2rem' }}>
                                <button
                                  type="button"
                                  className={`${styles.iconBtn} ${styles.approveBtn}`}
                                  title="HR Approve"
                                  onClick={() => handleApprovalAction(row.id, 'HR', 'approve')}
                                >
                                  <Check size={16} />
                                </button>
                                <button
                                  type="button"
                                  className={`${styles.iconBtn} ${styles.rejectBtn}`}
                                  title="HR Reject"
                                  onClick={() => handleApprovalAction(row.id, 'HR', 'reject')}
                                >
                                  <X size={16} />
                                </button>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Client side Pagination controls */}
              {totalPages > 1 && (
                <div className={styles.pagination}>
                  <span className={styles.paginationText}>
                    Showing page {currentPage} of {totalPages} ({filteredRecords.length} records total)
                  </span>
                  <div className={styles.paginationButtons}>
                    <button
                      className={`${styles.btn} ${styles.btnSecondary}`}
                      style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem' }}
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                    >
                      Prev
                    </button>
                    <button
                      className={`${styles.btn} ${styles.btnSecondary}`}
                      style={{ padding: '0.35rem 0.75rem', fontSize: '0.78rem' }}
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                      disabled={currentPage === totalPages}
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Confirmation Dialog Modal */}
      {confirmDelete && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalBox} style={{ maxWidth: '400px' }}>
            <div className={styles.confirmBox}>
              <div className={`${styles.confirmIcon} ${styles.confirmIconRed}`}>
                <Trash2 size={32} />
              </div>
              <h3 className={styles.cardTitle} style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>
                Delete Request?
              </h3>
              <p className={styles.confirmMsg}>
                Are you sure you want to delete this pending resignation request? This action is permanent and cannot be undone.
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
                  onClick={handleDeleteConfirm}
                  disabled={actionLoading}
                >
                  {actionLoading ? <Loader2 className={styles.loadingSpinner} size={16} /> : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Detailed Request View Modal */}
      <AnimatePresence>
        {detailRecord && (
          <div className={styles.modalOverlay} onClick={() => setDetailRecord(null)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className={styles.modalBox}
              onClick={(e) => e.stopPropagation()}
            >
              <div className={styles.modalHeader}>
                <h3 className={styles.modalTitle}>Resignation Request Details</h3>
                <button className={styles.modalClose} onClick={() => setDetailRecord(null)}>
                  <X size={18} />
                </button>
              </div>
              <div className={styles.modalBody}>
                <div className={styles.detailGrid}>
                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>Staff Member</span>
                    <span className={styles.detailValue}>{detailRecord.name}</span>
                  </div>
                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>Staff ID</span>
                    <span className={styles.detailValue}>{detailRecord.staff_id}</span>
                  </div>
                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>Department</span>
                    <span className={styles.detailValue}>{detailRecord.department || '—'}</span>
                  </div>
                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>Resignation Date</span>
                    <span className={styles.detailValue}>{detailRecord.resignation_date}</span>
                  </div>
                  <div className={styles.detailItem}>
                    <span className={styles.detailLabel}>Last Day of Work</span>
                    <span className={styles.detailValue} style={{ color: 'var(--primary, #3b82f6)', fontWeight: 600 }}>
                      {calculateLastDay(detailRecord.resignation_date)}
                    </span>
                  </div>
                  <div className={styles.detailItemFull}>
                    <span className={styles.detailLabel}>Overall Status</span>
                    <span className={styles.detailValue}>{getOverallBadge(detailRecord.status)}</span>
                  </div>
                  <div className={styles.detailItemFull} style={{ borderTop: '1px dashed var(--border)', paddingTop: '0.75rem' }}>
                    <span className={styles.detailLabel}>Reason / Explanation</span>
                    <span className={styles.detailValue} style={{ whiteSpace: 'pre-wrap', fontWeight: 400 }}>
                      {detailRecord.reason}
                    </span>
                  </div>
                  
                  {/* Approval Trail */}
                  <div className={styles.detailItemFull} style={{ borderTop: '1px dashed var(--border)', paddingTop: '0.75rem' }}>
                    <span className={styles.detailLabel} style={{ marginBottom: '0.5rem' }}>Recommendation Trail</span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem' }}>
                        <span>HOD Approval:</span>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                          <span style={{ fontWeight: 600 }}>
                            {detailRecord.hod_status === 1 ? 'Approved' : detailRecord.hod_status === 2 ? 'Rejected' : 'Pending'}
                          </span>
                          {detailRecord.hod_name && (
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                              By {detailRecord.hod_name} on {detailRecord.hod_date?.split(' ')[0]}
                            </span>
                          )}
                        </div>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem' }}>
                        <span>HR Admin Approval:</span>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                          <span style={{ fontWeight: 600 }}>
                            {detailRecord.admin_status === 1 ? 'Approved' : detailRecord.admin_status === 2 ? 'Rejected' : 'Pending'}
                          </span>
                          {detailRecord.admin_name && (
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                              By {detailRecord.admin_name} on {detailRecord.admin_date?.split(' ')[0]}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {detailRecord.remarks && (
                    <div className={styles.detailItemFull} style={{ borderTop: '1px dashed var(--border)', paddingTop: '0.75rem' }}>
                      <span className={styles.detailLabel}>Approver Remarks</span>
                      <span className={styles.detailValue} style={{ fontWeight: 400, fontStyle: 'italic' }}>
                        "{detailRecord.remarks}"
                      </span>
                    </div>
                  )}
                </div>
              </div>
              <div className={styles.modalFooter}>
                <button className={styles.modalCloseBtn} onClick={() => setDetailRecord(null)}>
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Approval Recommendation / Remarks Modal */}
      {approvalModal.show && (
        <div className={styles.modalOverlay}>
          <div className={styles.modalBox} style={{ maxWidth: '440px' }}>
            <div className={styles.modalHeader}>
              <h3 className={styles.modalTitle}>
                {approvalModal.action === 'approve' ? 'Approve' : 'Reject'} Resignation Request ({approvalModal.level})
              </h3>
              <button className={styles.modalClose} onClick={() => setApprovalModal({ show: false, recordId: null, level: '', action: '', remarks: '' })}>
                <X size={18} />
              </button>
            </div>
            <div className={styles.modalBody}>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: 0 }}>
                Please specify any additional remarks or notes for this action.
              </p>
              <textarea
                className={styles.modalTextarea}
                placeholder="Enter remarks..."
                value={approvalModal.remarks}
                onChange={(e) => setApprovalModal({ ...approvalModal, remarks: e.target.value })}
              />
            </div>
            <div className={styles.modalFooter} style={{ gap: '0.5rem' }}>
              <button
                type="button"
                className={styles.modalCloseBtn}
                onClick={() => setApprovalModal({ show: false, recordId: null, level: '', action: '', remarks: '' })}
                disabled={actionLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                className={`${styles.confirmActionBtn} ${approvalModal.action === 'approve' ? styles.successBtn : styles.dangerBtn}`}
                onClick={handleApprovalSubmit}
                disabled={actionLoading}
              >
                {actionLoading ? (
                  <Loader2 className={styles.loadingSpinner} size={16} />
                ) : (
                  approvalModal.action === 'approve' ? 'Confirm Approval' : 'Confirm Rejection'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
