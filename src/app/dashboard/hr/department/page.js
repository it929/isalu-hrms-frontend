"use client";

import { useState, useEffect, useCallback } from 'react';
import { getCache, setCache, hasCache } from '../../../../utils/dataCache';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import {
  Building2,
  Plus,
  Edit2,
  Trash2,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertCircle
} from 'lucide-react';
import styles from './page.module.css';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api/nextjs';

function getUserId() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('hrms_user');
    if (raw) {
      const user = JSON.parse(raw);
      return user?.id ?? null;
    }
  } catch { /* ignore */ }
  return null;
}

function buildHeaders() {
  const uid = getUserId();
  return uid ? { 'X-User-Id': uid } : {};
}

export default function DepartmentPage() {
  const cachedData = getCache('department');
  const [loading, setLoading] = useState(!cachedData);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  const [courtList, setCourtList] = useState(cachedData?.CourtList || []);
  const [departmentList, setDepartmentList] = useState(cachedData?.DepartmentList || []);
  const [courtInfo, setCourtInfo] = useState(cachedData?.CourtInfo || { courtstatus: 1 });

  // Form & Edit states
  const [editId, setEditId] = useState(null);
  const [formData, setFormData] = useState({
    department: ''
  });

  // Confirm delete modal state
  const [confirmModal, setConfirmModal] = useState({ open: false, id: null, name: '' });

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/hr/basic/section`, { headers: buildHeaders() });
      if (res.data.status === 'success') {
        const data = {
          CourtList: res.data.CourtList || [],
          DepartmentList: res.data.DepartmentList || [],
          CourtInfo: res.data.CourtInfo || { courtstatus: 1 }
        };
        setCache('department', data);
        setCourtList(data.CourtList);
        setDepartmentList(data.DepartmentList);
        setCourtInfo(data.CourtInfo);
      } else {
        showToast(res.data.message || 'Failed to load data.', 'error');
      }
    } catch (err) {
      showToast('Failed to connect to server.', 'error');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (!cachedData) {
      fetchData();
    }
  }, [fetchData, cachedData]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleEdit = (dept) => {
    setEditId(dept.id);
    setFormData({
      department: dept.department
    });
  };

  const handleCancelEdit = () => {
    setEditId(null);
    setFormData({
      department: ''
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const { department } = formData;
    if (!department) return showToast('Please enter a department name.', 'warning');

    setSaving(true);
    try {
      let res;
      const payload = {
        department,
        court: courtInfo?.courtid || (courtList.length > 0 ? courtList[0].id : '')
      };

      if (editId) {
        // Edit Department
        payload.editid = editId;
        res = await axios.post(`${API_BASE}/hr/basic/section`, payload, { headers: buildHeaders() });
      } else {
        // Add Department
        payload.add = true;
        res = await axios.post(`${API_BASE}/hr/basic/section`, payload, { headers: buildHeaders() });
      }

      if (res.data.status === 'success') {
        showToast(res.data.message || `Department ${editId ? 'updated' : 'added'} successfully.`, 'success');
        handleCancelEdit();
        fetchData(true);
      } else {
        showToast(res.data.message || `Failed to ${editId ? 'update' : 'add'} department.`, 'error');
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Server error occurred while saving.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteClick = (dept) => {
    setConfirmModal({ open: true, id: dept.id, name: dept.department });
  };

  const handleConfirmDelete = async () => {
    const id = confirmModal.id;
    setConfirmModal({ open: false, id: null, name: '' });

    try {
      const payload = { delcode: id };
      const res = await axios.post(`${API_BASE}/hr/basic/section`, payload, { headers: buildHeaders() });
      if (res.data.status === 'success') {
        showToast('Department deleted successfully.', 'success');
        if (editId === id) {
          handleCancelEdit();
        }
        fetchData(true);
      } else {
        showToast(res.data.message || 'Failed to delete department.', 'error');
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Server error while deleting.', 'error');
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
        <h1><Building2 size={26} style={{ strokeWidth: 2.2 }} /> Department Setup</h1>
        <p>Manage company departments and sections.</p>
      </div>

      <div className={styles.layoutGrid}>
        {/* Form Card */}
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>
            {editId ? 'Edit Department' : 'Add Department'}
          </h2>
          
          <form className={styles.form} onSubmit={handleSubmit}>
            
            <div className={styles.formGroup}>
              <label htmlFor="department" className={styles.label}>Department Name</label>
              <input 
                type="text" 
                id="department"
                name="department"
                className={styles.input} 
                placeholder="Enter department name" 
                value={formData.department}
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
          <h2 className={styles.cardTitle}>Department List</h2>
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th style={{ width: '60px' }}>S/N</th>
                  <th>Department</th>
                  <th style={{ width: '120px', textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={3} style={{ textAlign: 'center', padding: '3rem 0' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', color: 'var(--secondary)' }}>
                        <Loader2 className={styles.spinner} size={24} />
                        <span style={{ fontSize: '0.9rem' }}>Loading departments...</span>
                      </div>
                    </td>
                  </tr>
                ) : departmentList.length === 0 ? (
                  <tr>
                    <td colSpan={3} style={{ textAlign: 'center', padding: '3rem 0' }}>
                      No departments found.
                    </td>
                  </tr>
                ) : (
                  departmentList.map((dept, index) => (
                    <tr key={dept.id}>
                      <td>{index + 1}</td>
                      <td style={{ fontWeight: '500' }}>{dept.department}</td>
                      <td>
                        <div className={styles.actions}>
                          <button
                            className={`${styles.actionBtn} ${styles.editBtn}`}
                            title="Edit"
                            onClick={() => handleEdit(dept)}
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            className={`${styles.actionBtn} ${styles.deleteBtn}`}
                            title="Delete"
                            onClick={() => handleDeleteClick(dept)}
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
              <h3 className={styles.modalTitle}>Delete Department</h3>
              <p className={styles.modalMessage}>
                Are you sure you want to delete department <strong>&ldquo;{confirmModal.name}&rdquo;</strong>?
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
            className={`${styles.toast} ${
              toast.type === 'error' ? styles.toastError : 
              toast.type === 'warning' ? styles.toastWarning : 
              styles.toastSuccess
            }`}
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
          >
            {toast.type === 'error' ? <XCircle size={18} /> : 
             toast.type === 'warning' ? <AlertCircle size={18} /> : 
             <CheckCircle2 size={18} />}
            <span style={{ fontSize: '0.85rem', fontWeight: '500' }}>{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
