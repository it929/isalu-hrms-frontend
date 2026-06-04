"use client";

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import {
  Settings,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Edit2,
  Trash2,
  FileText,
  AlertTriangle,
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

export default function LoanTypesPage() {
  // UI & Loading States
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  // Data States
  const [types, setTypes] = useState([]);

  // Form Fields
  const [editTypeId, setEditTypeId] = useState(null);
  const [typeName, setTypeName] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4500);
  }, []);

  // Fetch loan types list
  const fetchTypes = useCallback(async (silent = false) => {
    const cacheKey = 'hrms_loan_types_cache';
    let hasCache = false;
    if (typeof window !== 'undefined') {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        setTypes(JSON.parse(cached));
        hasCache = true;
      }
    }

    if (!silent && !hasCache) setLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/payroll/loans/types`, {
        headers: buildHeaders(),
      });
      if (res.data.status === 'success') {
        const freshData = res.data.data || [];
        setTypes(freshData);
        if (typeof window !== 'undefined') {
          sessionStorage.setItem(cacheKey, JSON.stringify(freshData));
        }
      }
    } catch (err) {
      showToast('Failed to retrieve loan types.', 'error');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    let hasCache = false;
    if (typeof window !== 'undefined') {
      hasCache = !!sessionStorage.getItem('hrms_loan_types_cache');
    }
    const timer = setTimeout(() => {
      if (!hasCache) {
        fetchTypes();
      } else {
        const cached = sessionStorage.getItem('hrms_loan_types_cache');
        if (cached) {
          setTypes(JSON.parse(cached));
        }
      }
    }, 50);
    return () => clearTimeout(timer);
  }, [fetchTypes]);

  const handleClearForm = () => {
    setEditTypeId(null);
    setTypeName('');
  };

  // Submit loan type form
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!typeName.trim()) {
      showToast('Please enter a valid loan type name.', 'error');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        id: editTypeId,
        name: typeName.trim(),
      };

      const res = await axios.post(`${API_BASE}/payroll/loans/types`, payload, {
        headers: buildHeaders()
      });

      if (res.data.status === 'success') {
        showToast(res.data.message || 'Loan type saved successfully.');
        handleClearForm();
        fetchTypes(true); // Silent refetch in-place
      } else {
        showToast(res.data.message || 'Failed to save loan type.', 'error');
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Server error saving record.', 'error');
    } finally {
      setSaving(false);
    }
  };

  // Edit action
  const handleEdit = (type) => {
    setEditTypeId(type.id);
    setTypeName(type.name);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Delete action (trigger confirm modal)
  const handleDelete = (id) => {
    setConfirmDeleteId(id);
  };

  // Confirm delete action
  const handleConfirmDelete = async (id) => {
    try {
      const res = await axios.delete(`${API_BASE}/payroll/loans/types/${id}`, {
        headers: buildHeaders()
      });

      if (res.data.status === 'success') {
        showToast(res.data.message || 'Loan type deleted successfully.');
        fetchTypes(true); // Silent refetch in-place
      } else {
        showToast(res.data.message || 'Failed to delete loan type.', 'error');
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Server error deleting record.', 'error');
    } finally {
      setConfirmDeleteId(null);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Loan Types Configuration</h1>
        <p className={styles.subtitle}>Configure and manage employee loan classification parameters used across payroll models.</p>
      </div>

      {/* Main Grid: Form Left, List Right */}
      <div className={styles.mainGrid}>
        
        {/* Form Column */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>{editTypeId ? 'Edit Loan Type' : 'Create Loan Type'}</h2>
          </div>
          <div className={styles.cardBody}>
            <form onSubmit={handleSubmit}>
              <div className={styles.formGroup}>
                <label className={styles.label}>Loan Type Name *</label>
                <input
                  type="text"
                  className={styles.input}
                  placeholder="e.g. Visa Loan"
                  value={typeName}
                  onChange={(e) => setTypeName(e.target.value)}
                />
              </div>

              <div className={styles.formActions}>
                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnSecondary}`}
                  onClick={handleClearForm}
                  disabled={saving}
                >
                  Clear
                </button>
                <button
                  type="submit"
                  className={`${styles.btn} ${styles.btnPrimary}`}
                  disabled={saving}
                >
                  {saving && <Loader2 size={16} className="animate-spin" />}
                  {editTypeId ? 'Update Type' : 'Save Type'}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* List Column */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>Configured Loan Types</h2>
          </div>
          <div className={styles.tableContainer}>
            {loading ? (
              <div className={styles.emptyState}>
                <Loader2 size={32} className="animate-spin" style={{ margin: '0 auto 0.75rem', color: 'var(--primary)' }} />
                <div>Loading configurations...</div>
              </div>
            ) : types.length > 0 ? (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Loan Type</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {types.map((type) => (
                    <tr key={type.id}>
                      <td>
                        <span className={styles.typeName}>{type.name}</span>
                      </td>
                      <td>
                        <div className={styles.rowActions}>
                          <button
                            className={`${styles.actionBtn} ${styles.actionBtnEdit}`}
                            title="Edit Loan Type"
                            onClick={() => handleEdit(type)}
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            className={`${styles.actionBtn} ${styles.actionBtnDelete}`}
                            title="Delete Loan Type"
                            onClick={() => handleDelete(type.id)}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className={styles.emptyState}>
                <FileText size={32} className={styles.emptyIcon} />
                <div>No custom loan types configured yet.</div>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Custom Confirm Delete Modal */}
      <AnimatePresence>
        {confirmDeleteId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={styles.modalOverlay}
            onClick={() => setConfirmDeleteId(null)}
          >
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 20, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 350 }}
              className={styles.modalCard}
              onClick={(e) => e.stopPropagation()}
            >
              <div className={styles.modalHeader}>
                <div className={styles.modalIcon}>
                  <AlertTriangle size={20} />
                </div>
                <h3 className={styles.modalTitle}>Confirm Delete</h3>
              </div>
              <div className={styles.modalBody}>
                Are you sure you want to delete the loan type <strong>&ldquo;{types.find(t => t.id === confirmDeleteId)?.name}&rdquo;</strong>? This action cannot be undone.
              </div>
              <div className={styles.modalActions}>
                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnSecondary}`}
                  onClick={() => setConfirmDeleteId(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnDanger}`}
                  onClick={() => handleConfirmDelete(confirmDeleteId)}
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className={`${styles.toast} ${toast.type === 'error' ? styles.toastError : styles.toastSuccess}`}
          >
            {toast.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
            <span>{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
