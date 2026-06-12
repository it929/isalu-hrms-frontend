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

export default function UnitPage() {
  const cachedData = getCache('unit');
  const [loading, setLoading] = useState(!cachedData);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  const [departmentList, setDepartmentList] = useState(cachedData?.DepartmentList || []);
  const [unitList, setUnitList] = useState(cachedData?.UnitList || []);
  
  // Filter state for table listing
  const [filterDept, setFilterDept] = useState('');

  // Form & Edit states
  const [editId, setEditId] = useState(null);
  const [formData, setFormData] = useState({
    department: '',
    unit: ''
  });

  // Confirm delete modal state
  const [confirmModal, setConfirmModal] = useState({ open: false, item: null });

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/hr/basic/unit`, { headers: buildHeaders() });
      if (res.data.status === 'success') {
        const data = {
          DepartmentList: res.data.DepartmentList || [],
          UnitList: res.data.UnitList || []
        };
        setCache('unit', data);
        setDepartmentList(data.DepartmentList);
        setUnitList(data.UnitList);
      } else {
        showToast(res.data.message || 'Failed to load unit data.', 'error');
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

  const handleEdit = (item) => {
    setEditId(item.unitID);
    setFormData({
      department: item.departmentID || '',
      unit: item.unit
    });
  };

  const handleCancelEdit = () => {
    setEditId(null);
    setFormData({
      department: '',
      unit: ''
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const { unit, department } = formData;
    if (!unit) return showToast('Please enter a unit name.', 'warning');
    if (!department) return showToast('Please select a department.', 'warning');

    setSaving(true);
    try {
      let res;
      if (editId) {
        // Edit Unit
        const payload = {
          PostID: editId,
          unit: unit.toUpperCase(),
          DeptID: department
        };
        res = await axios.post(`${API_BASE}/hr/basic/unit/edit`, payload, { headers: buildHeaders() });
      } else {
        // Add Unit
        const payload = {
          unit: unit.toUpperCase(),
          department
        };
        res = await axios.post(`${API_BASE}/hr/basic/unit`, payload, { headers: buildHeaders() });
      }

      if (res.data.status === 'success') {
        showToast(res.data.message || `Unit ${editId ? 'updated' : 'added'} successfully.`, 'success');
        handleCancelEdit();
        fetchData(true);
      } else {
        showToast(res.data.message || `Failed to ${editId ? 'update' : 'add'} unit.`, 'error');
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Server error while saving.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteClick = (item) => {
    setConfirmModal({ open: true, item });
  };

  const handleConfirmDelete = async () => {
    const item = confirmModal.item;
    setConfirmModal({ open: false, item: null });

    try {
      const payload = {
        PostID: item.unitID
      };
      const res = await axios.post(`${API_BASE}/hr/basic/unit/delete`, payload, { headers: buildHeaders() });
      if (res.data.status === 'success') {
        showToast('Unit deleted successfully.', 'success');
        if (editId === item.unitID) {
          handleCancelEdit();
        }
        fetchData(true);
      } else {
        showToast(res.data.message || 'Failed to delete unit.', 'error');
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Server error while deleting.', 'error');
    }
  };



  // Filter unit list client side based on department filter dropdown
  const filteredUnits = filterDept
    ? unitList.filter(u => String(u.departmentID) === String(filterDept))
    : unitList;

  return (
    <motion.div 
      className={styles.container}
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className={styles.header}>
        <h1><Building2 size={26} style={{ strokeWidth: 2.2 }} /> Unit Setup</h1>
        <p>Manage and structure operational units within departments.</p>
      </div>

      <div className={styles.layoutGrid}>
        {/* Form Card */}
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>
            {editId ? 'Edit Unit' : 'Add Unit'}
          </h2>
          
          <form className={styles.form} onSubmit={handleSubmit}>
            <div className={styles.formGroup}>
              <label htmlFor="department" className={styles.label}>Department</label>
              <select 
                id="department"
                name="department"
                className={styles.input} 
                value={formData.department} 
                onChange={handleInputChange}
                required
                disabled={loading}
              >
                <option value="">{loading ? '-- Loading Departments... --' : '-- Select Department --'}</option>
                {!loading && departmentList.map((d) => (
                  <option key={d.id} value={d.id}>{d.department}</option>
                ))}
              </select>
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="unit" className={styles.label}>Unit Name</label>
              <input 
                type="text" 
                id="unit"
                name="unit"
                className={styles.input} 
                placeholder="Input Unit name" 
                value={formData.unit}
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <h2 className={styles.cardTitle} style={{ margin: 0, borderBottom: 'none', padding: 0 }}>Unit List</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <label htmlFor="filterDept" style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--secondary)' }}>Filter Department:</label>
              <select
                id="filterDept"
                className={styles.input}
                style={{ width: '200px', padding: '0.4rem 0.6rem' }}
                value={filterDept}
                onChange={(e) => setFilterDept(e.target.value)}
                disabled={loading}
              >
                <option value="">{loading ? 'Loading...' : 'All Departments'}</option>
                {!loading && departmentList.map((d) => (
                  <option key={d.id} value={d.id}>{d.department}</option>
                ))}
              </select>
            </div>
          </div>
          <div className={styles.tableWrapper}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th style={{ width: '60px' }}>S/N</th>
                  <th>Department</th>
                  <th>Unit</th>
                  <th style={{ width: '120px', textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'center', padding: '3rem 0' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', color: 'var(--secondary)' }}>
                        <Loader2 className={styles.spinner} size={24} />
                        <span style={{ fontSize: '0.9rem' }}>Loading units...</span>
                      </div>
                    </td>
                  </tr>
                ) : filteredUnits.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'center', padding: '3rem 0' }}>
                      No units found.
                    </td>
                  </tr>
                ) : (
                  filteredUnits.map((item, index) => (
                    <tr key={item.unitID}>
                      <td>{index + 1}</td>
                      <td>{item.department || 'N/A'}</td>
                      <td style={{ fontWeight: '500' }}>{item.unit}</td>
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
            onClick={() => setConfirmModal({ open: false, item: null })}
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
              <h3 className={styles.modalTitle}>Delete Unit</h3>
              <p className={styles.modalMessage}>
                Are you sure you want to delete unit <strong>&ldquo;{confirmModal.item?.unit}&rdquo;</strong>?
                This action cannot be undone.
              </p>
              <div className={styles.modalActions}>
                <button
                  className={styles.modalCancelBtn}
                  onClick={() => setConfirmModal({ open: false, item: null })}
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
