"use client";

import { useState, useEffect, useCallback } from 'react';
import { getCache, setCache, hasCache, clearCache } from '../../../../utils/dataCache';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import {
  MapPin,
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

export default function LgaCoveredPage() {
  const cachedData = getCache('lga_states');
  const [loading, setLoading] = useState(!cachedData);
  const [loadingLgas, setLoadingLgas] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  const [stateList, setStateList] = useState(cachedData || []);
  const [lgaList, setLgaList] = useState([]);
  const [selectedState, setSelectedState] = useState('');
  
  // Form states
  const [editItem, setEditItem] = useState(null);
  const [formData, setFormData] = useState({
    state: '',
    localGovernmentArea: '',
    lgaChange: ''
  });

  // Confirm delete modal state
  const [confirmModal, setConfirmModal] = useState({ open: false, item: null });

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  // Fetch initial state list
  const fetchStates = useCallback(async () => {
    const hasCacheData = hasCache('lga_states');
    if (hasCacheData) {
      const cached = getCache('lga_states');
      if (cached) {
        setStateList(cached);
        return;
      }
    }
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/hr/lga/covered`, { headers: buildHeaders() });
      if (res.data.status === 'success') {
        const list = res.data.StateList || [];
        setCache('lga_states', list);
        setStateList(list);
      } else {
        showToast(res.data.message || 'Failed to load states.', 'error');
      }
    } catch (err) {
      showToast('Failed to connect to server.', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  // Fetch LGAs for selected state
  const fetchLgas = useCallback(async (stateId) => {
    if (!stateId) {
      setLgaList([]);
      return;
    }
    const cacheKey = `lga_list_${stateId}`;
    const cachedLgas = getCache(cacheKey);
    if (cachedLgas) {
      setLgaList(cachedLgas);
      return;
    }
    
    setLoadingLgas(true);
    try {
      const res = await axios.get(`${API_BASE}/hr/lga/covered?stateID=${stateId}`, { headers: buildHeaders() });
      if (res.data.status === 'success') {
        const list = res.data.LgaList || [];
        setCache(cacheKey, list);
        setLgaList(list);
      } else {
        showToast(res.data.message || 'Failed to load LGAs.', 'error');
      }
    } catch (err) {
      showToast('Failed to load LGAs from server.', 'error');
    } finally {
      setLoadingLgas(false);
    }
  }, [showToast]);

  useEffect(() => {
    const hasCacheData = hasCache('lga_states');
    if (!hasCacheData) {
      fetchStates();
    }
  }, [fetchStates]);

  // Fetch LGAs when selectedState changes
  useEffect(() => {
    fetchLgas(selectedState);
    // Autofill add form's state with current selectedState filter
    setFormData(prev => ({
      ...prev,
      state: selectedState
    }));
  }, [selectedState, fetchLgas]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleEditClick = (item) => {
    setEditItem(item);
    setFormData(prev => ({
      ...prev,
      lgaChange: item.lga
    }));
  };

  const handleCancelEdit = () => {
    setEditItem(null);
    setFormData(prev => ({
      ...prev,
      lgaChange: ''
    }));
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    const { state, localGovernmentArea } = formData;
    if (!state) return showToast('Please select a state.', 'warning');
    if (!localGovernmentArea) return showToast('Please enter a Local Government Area.', 'warning');

    setSaving(true);
    try {
      const payload = {
        state,
        localGovernmentArea
      };
      const res = await axios.post(`${API_BASE}/hr/lga/covered/add`, payload, { headers: buildHeaders() });
      if (res.data.status === 'success') {
        showToast(res.data.message || 'Local Government Area successfully added.', 'success');
        // Clear LGA input
        setFormData(prev => ({ ...prev, localGovernmentArea: '' }));
        // Clear cache
        clearCache(`lga_list_${state}`);
        // Change selected state filter to match added state
        setSelectedState(state);
        // Refresh list
        fetchLgas(state);
      } else {
        showToast(res.data.message || 'Failed to add Local Government Area.', 'error');
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Server error occurred while adding.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    const { lgaChange } = formData;
    if (!lgaChange) return showToast('Please enter a Local Government Area name.', 'warning');

    setSaving(true);
    try {
      const payload = {
        lgaid: editItem.lgaId,
        lgaChange: lgaChange
      };
      const res = await axios.post(`${API_BASE}/hr/lga/covered/edit`, payload, { headers: buildHeaders() });
      if (res.data.status === 'success') {
        showToast(res.data.message || 'Local Government Area successfully updated.', 'success');
        clearCache(`lga_list_${selectedState}`);
        handleCancelEdit();
        fetchLgas(selectedState);
      } else {
        showToast(res.data.message || 'Failed to update Local Government Area.', 'error');
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Server error occurred while updating.', 'error');
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
      const res = await axios.post(`${API_BASE}/hr/lga/covered/remove/${item.lgaId}`, {}, { headers: buildHeaders() });
      if (res.data.status === 'success') {
        showToast('Local Government Area successfully deleted.', 'success');
        clearCache(`lga_list_${selectedState}`);
        fetchLgas(selectedState);
      } else {
        showToast(res.data.message || 'Failed to delete Local Government Area.', 'error');
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Cannot delete LGA because a staff is still assigned to it.', 'error');
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
        <h1><MapPin size={26} style={{ strokeWidth: 2.2 }} /> LGA Covered Setup</h1>
        <p>Manage and register Local Government Areas covered for geographical assignments.</p>
      </div>

      <div className={styles.layoutGrid}>
        {/* Form Card */}
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>
            Add New Local Government
          </h2>
          
          <form className={styles.form} onSubmit={handleAddSubmit}>
            <div className={styles.formGroup}>
              <label htmlFor="state" className={styles.label}>State</label>
              <select 
                id="state"
                name="state"
                className={styles.input} 
                value={formData.state} 
                onChange={handleInputChange}
                required
                disabled={loading}
              >
                <option value="">{loading ? '-- Loading States... --' : '- Select State -'}</option>
                {!loading && stateList.map((s) => (
                  <option key={s.StateID} value={s.StateID}>{s.State}</option>
                ))}
              </select>
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="localGovernmentArea" className={styles.label}>Local Government Area</label>
              <input 
                type="text" 
                id="localGovernmentArea"
                name="localGovernmentArea"
                className={styles.input} 
                placeholder="Enter Local Government Area" 
                value={formData.localGovernmentArea}
                onChange={handleInputChange}
                required
              />
            </div>
            
            <div className={styles.buttonGroup}>
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
                    <Plus size={16} />
                    <span>Add New</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* List Card */}
        <div className={styles.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <h2 className={styles.cardTitle} style={{ margin: 0, borderBottom: 'none', padding: 0 }}>Local Government List</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <label htmlFor="filterState" style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--secondary)' }}>Select State:</label>
              <select
                id="filterState"
                className={styles.input}
                style={{ width: '200px', padding: '0.4rem 0.6rem' }}
                value={selectedState}
                onChange={(e) => setSelectedState(e.target.value)}
                disabled={loading}
              >
                <option value="">{loading ? 'Loading...' : '-- Choose State --'}</option>
                {!loading && stateList.map((s) => (
                  <option key={s.StateID} value={s.StateID}>{s.State}</option>
                ))}
              </select>
            </div>
          </div>
          <div className={styles.tableWrapper}>
            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3rem 0', gap: '0.5rem' }}>
                <Loader2 className={styles.spinner} size={24} style={{ color: 'var(--primary)' }} />
                <p style={{ fontSize: '0.85rem', color: 'var(--secondary)' }}>Loading data...</p>
              </div>
            ) : loadingLgas ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3rem 0', gap: '0.5rem' }}>
                <Loader2 className={styles.spinner} size={24} style={{ color: 'var(--primary)' }} />
                <p style={{ fontSize: '0.85rem', color: 'var(--secondary)' }}>Loading LGAs...</p>
              </div>
            ) : !selectedState ? (
              <div className={styles.emptyState}>
                Please select a state to view the covered Local Government Areas.
              </div>
            ) : lgaList.length === 0 ? (
              <div className={styles.emptyState}>
                No Local Government Areas found under the selected state.
              </div>
            ) : (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th style={{ width: '60px' }}>S/N</th>
                    <th>Name</th>
                    <th style={{ width: '120px', textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {lgaList.map((item, index) => (
                    <tr key={item.lgaId}>
                      <td>{index + 1}</td>
                      <td style={{ fontWeight: '500' }}>{item.lga}</td>
                      <td>
                        <div className={styles.actions}>
                          <button
                            className={`${styles.actionBtn} ${styles.editBtn}`}
                            title="Edit"
                            onClick={() => handleEditClick(item)}
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
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      <AnimatePresence>
        {editItem && (
          <div className={styles.modalOverlay} onClick={handleCancelEdit}>
            <div className={styles.modalBox} onClick={(e) => e.stopPropagation()}>
              <h3 className={styles.modalTitle} style={{ borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem', marginBottom: '1.25rem', textAlign: 'left' }}>
                Edit Local Government Area
              </h3>
              <form onSubmit={handleEditSubmit} className={styles.form}>
                <div className={styles.formGroup} style={{ textAlign: 'left' }}>
                  <label htmlFor="lgaChange" className={styles.label}>LGA Name</label>
                  <input
                    type="text"
                    id="lgaChange"
                    name="lgaChange"
                    className={styles.input}
                    value={formData.lgaChange}
                    onChange={handleInputChange}
                    required
                  />
                </div>
                <div className={styles.modalActions} style={{ justifyContent: 'flex-end', marginTop: '1rem' }}>
                  <button
                    type="button"
                    className={styles.modalCancelBtn}
                    onClick={handleCancelEdit}
                  >
                    Close
                  </button>
                  <button
                    type="submit"
                    className={styles.submitBtn}
                    style={{ flex: 'none', padding: '0.65rem 1.5rem' }}
                    disabled={saving}
                  >
                    {saving ? (
                      <>
                        <Loader2 size={16} className={styles.spinner} />
                        <span>Saving...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={16} />
                        <span>Save changes</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {confirmModal.open && (
          <div
            className={styles.modalOverlay}
            onClick={() => setConfirmModal({ open: false, item: null })}
          >
            <div
              className={styles.modalBox}
              onClick={(e) => e.stopPropagation()}
            >
              <div className={styles.modalIcon}>
                <Trash2 size={28} />
              </div>
              <h3 className={styles.modalTitle}>Delete Local Government</h3>
              <p className={styles.modalMessage}>
                Are you sure you want to delete Local Government Area <strong>&ldquo;{confirmModal.item?.lga}&rdquo;</strong>?
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
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <div 
            className={`${styles.toast} ${
              toast.type === 'error' ? styles.toastError : 
              toast.type === 'warning' ? styles.toastWarning : 
              styles.toastSuccess
            }`}
          >
            {toast.type === 'error' ? <XCircle size={18} /> : 
             toast.type === 'warning' ? <AlertCircle size={18} /> : 
             <CheckCircle2 size={18} />}
            <span style={{ fontSize: '0.85rem', fontWeight: '500' }}>{toast.message}</span>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
