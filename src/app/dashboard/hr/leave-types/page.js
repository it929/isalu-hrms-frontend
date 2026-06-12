"use client";

import { useState, useEffect, useCallback } from 'react';
import { getCache, setCache, hasCache } from '../../../../utils/dataCache';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { 
  Plus, 
  Edit2, 
  Trash2, 
  Loader2, 
  CheckCircle2, 
  XCircle, 
  Calendar,
  AlertCircle
} from 'lucide-react';
import styles from './page.module.css';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api/nextjs';

export default function LeaveTypesPage() {
  const cachedData = getCache('leave-types');
  const [leaveTypes, setLeaveTypes] = useState(cachedData || []);
  const [loading, setLoading] = useState(!cachedData);
  const [saving, setSaving] = useState(false);
  const [editId, setEditId] = useState(null);
  const [confirmModal, setConfirmModal] = useState({ open: false, id: null, name: '' });
  
  const [formData, setFormData] = useState({
    leave: '',
    days: ''
  });

  const [toast, setToast] = useState(null);

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  }, []);

  const fetchLeaveTypes = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/hr/leave-types`);
      if (res.data.status === 'success') {
        const data = res.data.data || [];
        setLeaveTypes(data);
        setCache('leave-types', data);
      } else {
        showToast(res.data.message || 'Failed to fetch leave types.', 'error');
      }
    } catch (err) {
      showToast('An error occurred while loading leave types.', 'error');
      console.error(err);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (!cachedData) {
      fetchLeaveTypes();
    }
  }, [fetchLeaveTypes, cachedData]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleEdit = (item) => {
    setEditId(item.id);
    setFormData({
      leave: item.leaveType,
      days: item.days
    });
  };

  const handleCancelEdit = () => {
    setEditId(null);
    setFormData({
      leave: '',
      days: ''
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.leave || !formData.days) {
      showToast('Please fill in all fields.', 'error');
      return;
    }

    setSaving(true);
    try {
      if (editId) {
        // Update
        const res = await axios.put(`${API_BASE}/hr/leave-types/${editId}`, formData);
        if (res.data.status === 'success') {
          showToast(res.data.message || 'Leave type updated successfully.', 'success');
          handleCancelEdit();
          fetchLeaveTypes(true);
        } else {
          showToast(res.data.message || 'Failed to update leave type.', 'error');
        }
      } else {
        // Create
        const res = await axios.post(`${API_BASE}/hr/leave-types`, formData);
        if (res.data.status === 'success') {
          showToast(res.data.message || 'Leave type added successfully.', 'success');
          setFormData({ leave: '', days: '' });
          fetchLeaveTypes(true);
        } else {
          showToast(res.data.message || 'Failed to add leave type.', 'error');
        }
      }
    } catch (err) {
      const errMsg = err.response?.data?.message || 'An error occurred while saving.';
      showToast(errMsg, 'error');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteClick = (item) => {
    setConfirmModal({ open: true, id: item.id, name: item.leaveType });
  };

  const handleConfirmDelete = async () => {
    const id = confirmModal.id;
    setConfirmModal({ open: false, id: null, name: '' });

    try {
      const res = await axios.delete(`${API_BASE}/hr/leave-types/${id}`);
      if (res.data.status === 'success') {
        showToast(res.data.message || 'Leave type deleted successfully.', 'success');
        if (editId === id) {
          handleCancelEdit();
        }
        fetchLeaveTypes(true);
      } else {
        showToast(res.data.message || 'Failed to delete leave type.', 'error');
      }
    } catch (err) {
      showToast('An error occurred while deleting the leave type.', 'error');
      console.error(err);
    }
  };


  return (
    <motion.div 
      className={styles.container}
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className={styles.header}>
        <h1>Leave Type Management</h1>
        <p>Define and manage various types of leaves and their eligible durations.</p>
      </div>

      <div className={styles.layoutGrid}>
        {/* Form Card */}
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>
            {editId ? 'Edit Leave Type' : 'Create Leave Type'}
          </h2>
          
          <form className={styles.form} onSubmit={handleSubmit}>
            <div className={styles.formGroup}>
              <label htmlFor="leave" className={styles.label}>Leave Type Name</label>
              <input
                type="text"
                id="leave"
                name="leave"
                className={styles.input}
                placeholder="e.g. Annual Leave"
                value={formData.leave}
                onChange={handleInputChange}
                required
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="days" className={styles.label}>Number of Days</label>
              <input
                type="number"
                id="days"
                name="days"
                className={styles.input}
                placeholder="e.g. 30"
                min="1"
                value={formData.days}
                onChange={handleInputChange}
                required
              />
            </div>

            <div className={styles.buttonGroup}>
              {editId && (
                <button 
                  type="button" 
                  className={styles.cancelBtn}
                  onClick={handleCancelEdit}
                >
                  Cancel
                </button>
              )}
              <button 
                type="submit" 
                className={styles.submitBtn}
                disabled={saving}
              >
                {saving ? (
                  <>
                    <Loader2 size={16} className={styles.spinner} />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    {editId ? <Edit2 size={16} /> : <Plus size={16} />}
                    <span>{editId ? 'Update' : 'Create'}</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* List Card */}
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Defined Leave Types</h2>

          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th style={{ width: '60px' }}>S/N</th>
                  <th>Leave Type Name</th>
                  <th>Days</th>
                  <th style={{ width: '100px', textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'center', padding: '3rem 0' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', color: 'var(--secondary)' }}>
                        <Loader2 className={styles.spinner} size={24} />
                        <span style={{ fontSize: '0.9rem' }}>Loading leave types...</span>
                      </div>
                    </td>
                  </tr>
                ) : leaveTypes.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'center', padding: '3rem 0' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', color: 'var(--secondary)' }}>
                        <Calendar size={36} strokeWidth={1.5} />
                        <span>No leave types have been defined yet.</span>
                      </div>
                    </td>
                  </tr>
                ) : (
                  leaveTypes.map((item, index) => (
                    <tr key={item.id}>
                      <td>{index + 1}</td>
                      <td style={{ fontWeight: '500' }}>{item.leaveType}</td>
                      <td>{item.days} days</td>
                      <td>
                        <div className={styles.actions}>
                          <button
                            className={`${styles.actionBtn} ${styles.editBtn}`}
                            title="Edit"
                            onClick={() => handleEdit(item)}
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            className={`${styles.actionBtn} ${styles.deleteBtn}`}
                            title="Delete"
                            onClick={() => handleDeleteClick(item)}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {confirmModal.open && (
          <motion.div
            className={styles.modalOverlay}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setConfirmModal({ open: false, id: null, name: '' })}
          >
            <motion.div
              className={styles.modalBox}
              initial={{ opacity: 0, scale: 0.9, y: -20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: -20 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className={styles.modalIcon}>
                <Trash2 size={28} />
              </div>
              <h3 className={styles.modalTitle}>Delete Leave Type</h3>
              <p className={styles.modalMessage}>
                Are you sure you want to delete <strong>&ldquo;{confirmModal.name}&rdquo;</strong>?
                This action cannot be undone.
              </p>
              <div className={styles.modalActions}>
                <button
                  className={styles.modalCancelBtn}
                  onClick={() => setConfirmModal({ open: false, id: null, name: '' })}
                >
                  Cancel
                </button>
                <button
                  className={styles.modalDeleteBtn}
                  onClick={handleConfirmDelete}
                >
                  <Trash2 size={15} />
                  Delete
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div 
            className={`${styles.toast} ${toast.type === 'error' ? styles.toastError : styles.toastSuccess}`}
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
          >
            {toast.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
            <span style={{ fontSize: '0.85rem', fontWeight: '500' }}>{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
