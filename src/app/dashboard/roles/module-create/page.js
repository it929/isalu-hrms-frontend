"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import {
  ShieldAlert,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Edit2,
  ChevronLeft,
  ChevronRight,
  Layers,
  Plus,
} from 'lucide-react';
import styles from '../create/page.module.css';

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

const LINK_TYPE_OPTIONS = [
  { value: 'HR', label: 'HR' },
  { value: 'FINANCE', label: 'FINANCE' },
  { value: 'PAYROLL', label: 'PAYROLL' },
  { value: 'PROCUREMENT', label: 'PROCUREMENT' },
  { value: 'STORE', label: 'STORE INVENTORY' },
];

function CustomSelect({ options, value, onChange, placeholder, disabled }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);
  const selectedOption = options.find(opt => opt.value === value);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', zIndex: isOpen ? 1000 : 1 }}>
      <button
        type="button"
        className={styles.formControl}
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          cursor: disabled ? 'not-allowed' : 'pointer',
          textAlign: 'left',
          width: '100%',
        }}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
      >
        <span>{selectedOption ? selectedOption.label : (placeholder || 'Select...')}</span>
        <span style={{ fontSize: '0.75rem', color: '#9ca3af', transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▼</span>
      </button>

      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            background: '#1f2937',
            border: '1px solid #374151',
            borderRadius: '8px',
            marginTop: '0.25rem',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.3)',
            zIndex: 1001,
            maxHeight: '280px',
            overflowY: 'auto',
          }}
        >
          {options.map((opt) => (
            <div
              key={opt.value}
              style={{
                padding: '0.65rem 0.85rem',
                cursor: 'pointer',
                color: '#f3f4f6',
                background: value === opt.value ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
                transition: 'background 0.2s',
              }}
              onMouseEnter={(e) => {
                if (value !== opt.value) {
                  e.target.style.background = 'rgba(255, 255, 255, 0.05)';
                }
              }}
              onMouseLeave={(e) => {
                e.target.style.background = value === opt.value ? 'rgba(59, 130, 246, 0.2)' : 'transparent';
              }}
              onClick={() => {
                onChange(opt.value);
                setIsOpen(false);
              }}
            >
              {opt.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function getPaginationRange(currentPage, lastPage) {
  const delta = 1;
  const range = [];
  const rangeWithDots = [];
  let l;

  for (let i = 1; i <= lastPage; i++) {
    if (i === 1 || i === lastPage || (i >= currentPage - delta && i <= currentPage + delta)) {
      range.push(i);
    }
  }

  for (let i of range) {
    if (l) {
      if (i - l === 2) {
        rangeWithDots.push(l + 1);
      } else if (i - l > 2) {
        rangeWithDots.push('...');
      }
    }
    rangeWithDots.push(i);
    l = i;
  }

  return rangeWithDots;
}

export default function CreateModulePage() {
  // Loading & Toast states
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [toast, setToast] = useState(null);

  // Modules list & pagination states
  const [modules, setModules] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const perPage = 10; // paginated list matching blade pagination links

  // Form states
  const [moduleName, setModuleName] = useState('');
  const [rank, setRank] = useState('');
  const [linkType, setLinkType] = useState('');
  const [formError, setFormError] = useState('');

  // Edit Modal states
  const [editModule, setEditModule] = useState(null); // { moduleID, modulename, module_rank, link_type }
  const [editModuleName, setEditModuleName] = useState('');
  const [editRank, setEditRank] = useState('');
  const [editLinkType, setEditLinkType] = useState('');
  const [editFormError, setEditFormError] = useState('');

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4500);
  }, []);

  const clearModulesCache = useCallback(() => {
    if (typeof window !== 'undefined') {
      Object.keys(sessionStorage).forEach(key => {
        if (key.startsWith('hrms_module_create_modules_cache_')) {
          sessionStorage.removeItem(key);
        }
      });
    }
  }, []);

  // Fetch modules list
  const fetchModules = useCallback(async (pageNum = 1, silent = false) => {
    const cacheKey = `hrms_module_create_modules_cache_${pageNum}`;
    let hasCache = false;
    if (!silent) {
      if (typeof window !== 'undefined') {
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
          const resData = JSON.parse(cached);
          setModules(resData.data || []);
          setTotal(resData.total || 0);
          setPage(resData.page || 1);
          setLastPage(resData.lastPage || 1);
          hasCache = true;
        }
      }
      if (!hasCache) setLoading(true);
    }

    const headers = buildHeaders();
    try {
      const response = await axios.get(`${API_BASE}/modules`, {
        params: { page: pageNum, perPage },
        headers
      });
      if (response.data.status === 'success') {
        setModules(response.data.data || []);
        setTotal(response.data.total || 0);
        setPage(response.data.page || 1);
        setLastPage(response.data.lastPage || 1);
        if (typeof window !== 'undefined') {
          sessionStorage.setItem(cacheKey, JSON.stringify(response.data));
        }
      } else {
        showToast(response.data.message || 'Failed to fetch modules.', 'error');
      }
    } catch (err) {
      console.error('Error fetching modules:', err);
      showToast(err.response?.data?.message || 'Error connecting to the server.', 'error');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    let hasCache = false;
    if (typeof window !== 'undefined') {
      hasCache = !!sessionStorage.getItem(`hrms_module_create_modules_cache_1`);
    }
    if (hasCache) {
      const cached = sessionStorage.getItem(`hrms_module_create_modules_cache_1`);
      if (cached) {
        const resData = JSON.parse(cached);
        setModules(resData.data || []);
        setTotal(resData.total || 0);
        setPage(resData.page || 1);
        setLastPage(resData.lastPage || 1);
      }
    }
    fetchModules(1, hasCache);
  }, [fetchModules]);

  const validateForm = (name, rk, type) => {
    const regex = /^[a-zA-Z0-9,.!?\-)\( ]*$/;
    if (!name.trim()) return 'Module name is required.';
    if (!regex.test(name)) return 'Module name contains invalid characters.';
    if (!rk) return 'Rank is required.';
    if (!type) return 'Module For is required.';
    return '';
  };

  // Handle Create Form Submit
  const handleAddModuleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    const error = validateForm(moduleName, rank, linkType);
    if (error) {
      setFormError(error);
      return;
    }

    setSaving(true);
    const headers = buildHeaders();
    try {
      const response = await axios.post(`${API_BASE}/modules`, {
        moduleName: moduleName.trim(),
        rank: parseInt(rank, 10),
        link_type: linkType
      }, { headers });

      if (response.data.status === 'success') {
        showToast(response.data.message || 'Module Created Successfully', 'success');
        setModuleName('');
        setRank('');
        setLinkType('');
        clearModulesCache();
        fetchModules(1, true); // reload first page silently
      } else {
        setFormError(response.data.message || 'Failed to create module.');
      }
    } catch (err) {
      console.error('Error creating module:', err);
      const validationErrors = err.response?.data?.errors;
      if (validationErrors && validationErrors.moduleName) {
        setFormError(validationErrors.moduleName[0]);
      } else {
        setFormError(err.response?.data?.message || 'An error occurred.');
      }
    } finally {
      setSaving(false);
    }
  };

  // Open Edit Modal
  const openEditModal = (mod) => {
    setEditModule(mod);
    setEditModuleName(mod.modulename);
    setEditRank(mod.module_rank);
    setEditLinkType(mod.link_type);
    setEditFormError('');
  };

  // Close Edit Modal
  const closeEditModal = () => {
    setEditModule(null);
    setEditModuleName('');
    setEditRank('');
    setEditLinkType('');
    setEditFormError('');
  };

  // Handle Edit Submit
  const handleEditModuleSubmit = async (e) => {
    e.preventDefault();
    setEditFormError('');

    const error = validateForm(editModuleName, editRank, editLinkType);
    if (error) {
      setEditFormError(error);
      return;
    }

    setUpdating(true);
    const headers = buildHeaders();
    try {
      const response = await axios.post(`${API_BASE}/modules/update/${editModule.moduleID}`, {
        name: editModuleName.trim(),
        rank: parseInt(editRank, 10),
        link_type: editLinkType
      }, { headers });

      if (response.data.status === 'success') {
        showToast(response.data.message || 'Module Successfully Updated', 'success');
        closeEditModal();
        fetchModules(page);
      } else {
        setEditFormError(response.data.message || 'Failed to update module.');
      }
    } catch (err) {
      console.error('Error updating module:', err);
      const validationErrors = err.response?.data?.errors;
      if (validationErrors && validationErrors.name) {
        setEditFormError(validationErrors.name[0]);
      } else {
        setEditFormError(err.response?.data?.message || 'An error occurred.');
      }
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className={styles.container}>
      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            className={`${styles.toast} ${toast.type === 'success' ? styles.toastSuccess : styles.toastError}`}
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
          >
            {toast.type === 'success' ? <CheckCircle2 size={18} /> : <ShieldAlert size={18} />}
            <span>{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className={styles.header}>
        <h1>Add New Module</h1>
        <p>Register new system features and display ordering modules</p>
      </div>

      {/* Grid Layout */}
      <div className={styles.dashboardGrid}>
        
        {/* Create Module Card */}
        <div className={styles.panel}>
          <div className={styles.panelHeading}>
            <h3 className={styles.panelTitle}>
              <Plus size={18} /> Create System Module
            </h3>
          </div>
          <div className={styles.panelBody}>
            <form onSubmit={handleAddModuleSubmit} className={styles.formHorizontal}>
              
              <div className={styles.formGroup}>
                <label htmlFor="moduleName">Module Name</label>
                <input
                  id="moduleName"
                  type="text"
                  className={styles.formControl}
                  placeholder="e.g. Employee Self Service"
                  value={moduleName}
                  onChange={(e) => setModuleName(e.target.value)}
                  disabled={saving}
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="rank">Rank</label>
                <input
                  id="rank"
                  type="number"
                  className={styles.formControl}
                  placeholder="e.g. 1"
                  value={rank}
                  onChange={(e) => setRank(e.target.value)}
                  disabled={saving}
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="linkType">Module For</label>
                <CustomSelect
                  options={LINK_TYPE_OPTIONS}
                  value={linkType}
                  onChange={setLinkType}
                  placeholder="Select..."
                  disabled={saving}
                />
              </div>

              {formError && (
                <p style={{ color: '#f87171', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <AlertCircle size={14} /> {formError}
                </p>
              )}

              <div className={styles.formActions}>
                <button
                  type="submit"
                  className={styles.btnSubmit}
                  disabled={saving}
                >
                  {saving && <Loader2 size={16} className={styles.spinner} />}
                  {saving ? 'Saving…' : 'Add Module'}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Modules Table Card */}
        <div className={styles.panel}>
          <div className={styles.panelHeading}>
            <h3 className={styles.panelTitle}>
              <Layers size={18} /> All Modules
            </h3>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Total: {total} modules
            </span>
          </div>
          <div className={styles.panelBody}>
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th style={{ width: '80px' }}>S/N</th>
                    <th>Module Name</th>
                    <th>Module For</th>
                    <th>Rank</th>
                    <th style={{ width: '100px', textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && !modules.length ? (
                    <tr>
                      <td colSpan="5" style={{ textAlign: 'center', padding: '3rem 1rem' }}>
                        <Loader2 size={32} className={styles.spinner} style={{ margin: '0 auto 1rem' }} />
                        <span style={{ color: 'var(--text-secondary)' }}>Loading modules…</span>
                      </td>
                    </tr>
                  ) : !modules.length ? (
                    <tr>
                      <td colSpan="5" style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-secondary)' }}>
                        No modules configured.
                      </td>
                    </tr>
                  ) : (
                    modules.map((item, idx) => {
                      const serialNumber = ((page - 1) * perPage) + idx + 1;
                      return (
                        <tr key={item.moduleID}>
                          <td>{serialNumber}</td>
                          <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                            {item.modulename.toUpperCase()}
                          </td>
                          <td>
                            <span style={{ background: '#374151', color: '#f3f4f6', padding: '0.2rem 0.5rem', borderRadius: '4px', fontSize: '0.8rem', fontWeight: 600 }}>
                              {item.link_type}
                            </span>
                          </td>
                          <td>{item.module_rank}</td>
                          <td style={{ textAlign: 'center' }}>
                            <button
                              type="button"
                              className={styles.actionBtn}
                              title="Edit Module"
                              onClick={() => openEditModal(item)}
                            >
                              <Edit2 size={16} />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {lastPage > 1 && (
              <div className={styles.pagination}>
                <span className={styles.paginationInfo}>
                  Showing {((page - 1) * perPage) + 1}–{Math.min(page * perPage, total)} of {total} entries
                </span>
                <div className={styles.paginationControls}>
                  <button
                    className={styles.pageBtn}
                    disabled={page <= 1 || loading}
                    onClick={() => fetchModules(page - 1)}
                  >
                    <ChevronLeft size={16} />
                  </button>
                  {getPaginationRange(page, lastPage).map((pg, index) => {
                    if (pg === '...') {
                      return (
                        <span key={`dots-${index}`} style={{ padding: '0 0.5rem', color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', fontSize: '0.9rem' }}>
                          ...
                        </span>
                      );
                    }
                    return (
                      <button
                        key={pg}
                        className={`${styles.pageBtn} ${pg === page ? styles.pageBtnActive : ''}`}
                        disabled={loading}
                        onClick={() => fetchModules(pg)}
                      >
                        {pg}
                      </button>
                    );
                  })}
                  <button
                    className={styles.pageBtn}
                    disabled={page >= lastPage || loading}
                    onClick={() => fetchModules(page + 1)}
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Edit Module Modal */}
      <AnimatePresence>
        {editModule && (
          <div className={styles.modalBackdrop}>
            <motion.div
              className={styles.modal}
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
            >
              <div className={styles.panelTitle}>
                <Edit2 size={18} /> Update Module
              </div>
              <form onSubmit={handleEditModuleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '0.5rem' }}>
                
                <div className={styles.formGroup}>
                  <label htmlFor="editModuleName">Module Name</label>
                  <input
                    id="editModuleName"
                    type="text"
                    className={styles.formControl}
                    value={editModuleName}
                    onChange={(e) => setEditModuleName(e.target.value)}
                    disabled={updating}
                    required
                  />
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="editRank">Rank</label>
                  <input
                    id="editRank"
                    type="number"
                    className={styles.formControl}
                    value={editRank}
                    onChange={(e) => setEditRank(e.target.value)}
                    disabled={updating}
                    required
                  />
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="editLinkType">Module For</label>
                  <CustomSelect
                    options={LINK_TYPE_OPTIONS}
                    value={editLinkType}
                    onChange={setEditLinkType}
                    placeholder="Select..."
                    disabled={updating}
                  />
                </div>

                {editFormError && (
                  <p style={{ color: '#f87171', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    <AlertCircle size={14} /> {editFormError}
                  </p>
                )}

                <div className={styles.formActions}>
                  <button
                    type="button"
                    className={styles.btnCancel}
                    onClick={closeEditModal}
                    disabled={updating}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className={styles.btnSubmit}
                    disabled={updating}
                  >
                    {updating && <Loader2 size={16} className={styles.spinner} />}
                    {updating ? 'Saving…' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
