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
  Trash2,
  ChevronLeft,
  ChevronRight,
  Layers,
  Plus,
  Filter,
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

// Custom Select component matching updated premium look and click-outside capability
function CustomSelect({ options, value, onChange, placeholder, disabled }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);
  const selectedOption = options.find(opt => String(opt.value) === String(value));

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
                background: String(value) === String(opt.value) ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
                transition: 'background 0.2s',
              }}
              onMouseEnter={(e) => {
                if (String(value) !== String(opt.value)) {
                  e.target.style.background = 'rgba(255, 255, 255, 0.05)';
                }
              }}
              onMouseLeave={(e) => {
                e.target.style.background = String(value) === String(opt.value) ? 'rgba(59, 130, 246, 0.2)' : 'transparent';
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

export default function CreateSubModulePage() {
  // Loading & Toast states
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState(null);

  // Parent modules list (for select lists)
  const [modules, setModules] = useState([]);

  // Submodules list & pagination states
  const [submodules, setSubmodules] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const perPage = 10;

  // Filter state
  const [selectedFilterModule, setSelectedFilterModule] = useState('');

  // Create Form states
  const [selectedModule, setSelectedModule] = useState('');
  const [subModuleName, setSubModuleName] = useState('');
  const [route, setRoute] = useState('');
  const [rank, setRank] = useState('');
  const [formError, setFormError] = useState('');

  // Edit Modal states
  const [editSubModule, setEditSubModule] = useState(null); // { submoduleID, moduleID, submodulename, route, sub_module_rank }
  const [editModuleId, setEditModuleId] = useState('');
  const [editSubModuleName, setEditSubModuleName] = useState('');
  const [editRoute, setEditRoute] = useState('');
  const [editRank, setEditRank] = useState('');
  const [editFormError, setEditFormError] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4500);
  }, []);

  const clearSubModulesCache = useCallback(() => {
    if (typeof window !== 'undefined') {
      Object.keys(sessionStorage).forEach(key => {
        if (key.startsWith('hrms_submodule_create_')) {
          sessionStorage.removeItem(key);
        }
      });
    }
  }, []);

  // Fetch parent modules
  const fetchModules = async (silent = false) => {
    const cacheKey = 'hrms_submodule_create_modules_cache';
    if (!silent && typeof window !== 'undefined') {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        setModules(JSON.parse(cached));
      }
    }
    try {
      const response = await axios.get(`${API_BASE}/modules`, {
        params: { perPage: 1000 },
        headers: buildHeaders()
      });
      if (response.data.status === 'success') {
        const mapped = (response.data.data || []).map(m => ({
          value: m.moduleID,
          label: `${m.modulename.toUpperCase()} (${m.link_type} MODULE)`
        }));
        setModules(mapped);
        if (typeof window !== 'undefined') {
          sessionStorage.setItem(cacheKey, JSON.stringify(mapped));
        }
      }
    } catch (err) {
      console.error('Error fetching modules:', err);
    }
  };

  // Fetch submodules list
  const fetchSubModules = useCallback(async (pageNum = 1, filterModId = '', silent = false) => {
    const cacheKey = `hrms_submodule_create_submodules_cache_${filterModId || 'all'}_${pageNum}`;
    let hasCache = false;
    if (!silent) {
      if (typeof window !== 'undefined') {
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
          const resData = JSON.parse(cached);
          setSubmodules(resData.data || []);
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
      const response = await axios.get(`${API_BASE}/submodules`, {
        params: { page: pageNum, perPage, moduleID: filterModId },
        headers
      });
      if (response.data.status === 'success') {
        setSubmodules(response.data.data || []);
        setTotal(response.data.total || 0);
        setPage(response.data.page || 1);
        setLastPage(response.data.lastPage || 1);
        if (typeof window !== 'undefined') {
          sessionStorage.setItem(cacheKey, JSON.stringify(response.data));
        }
      } else {
        showToast(response.data.message || 'Failed to fetch submodules.', 'error');
      }
    } catch (err) {
      console.error('Error fetching submodules:', err);
      showToast(err.response?.data?.message || 'Error connecting to the server.', 'error');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [showToast]);

  // Load modules on mount
  useEffect(() => {
    let hasCache = false;
    if (typeof window !== 'undefined') {
      hasCache = !!sessionStorage.getItem('hrms_submodule_create_modules_cache');
    }
    if (hasCache) {
      const cached = sessionStorage.getItem('hrms_submodule_create_modules_cache');
      if (cached) {
        setModules(JSON.parse(cached));
      }
    }
    fetchModules(hasCache);
  }, []);

  // Sync submodule fetching when filter module ID changes or page loads
  useEffect(() => {
    const cacheKey = `hrms_submodule_create_submodules_cache_${selectedFilterModule || 'all'}_1`;
    let hasCache = false;
    if (typeof window !== 'undefined') {
      hasCache = !!sessionStorage.getItem(cacheKey);
    }
    if (hasCache) {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        const resData = JSON.parse(cached);
        setSubmodules(resData.data || []);
        setTotal(resData.total || 0);
        setPage(resData.page || 1);
        setLastPage(resData.lastPage || 1);
      }
    }
    fetchSubModules(1, selectedFilterModule, hasCache);
  }, [selectedFilterModule, fetchSubModules]);

  // Regex constraint check matching legacy validations: /^[a-zA-Z0-9,.!?\-)\( ]*$/
  const validateSubModuleName = (name) => {
    const regex = /^[a-zA-Z0-9,.!?\-)\( ]*$/;
    if (!name.trim()) {
      return 'Submodule name is required.';
    }
    if (!regex.test(name)) {
      return 'Submodule name contains invalid characters.';
    }
    if (name.length > 1000) {
      return 'Submodule name must not exceed 1000 characters.';
    }
    return '';
  };

  // Handle Form submit (Add Submodule)
  const handleAddSubModuleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!selectedModule) {
      setFormError('Please select a parent module.');
      return;
    }

    const nameError = validateSubModuleName(subModuleName);
    if (nameError) {
      setFormError(nameError);
      return;
    }

    if (!route.trim()) {
      setFormError('Route is required.');
      return;
    }

    setSaving(true);
    const headers = buildHeaders();
    try {
      const response = await axios.post(`${API_BASE}/submodules`, {
        moduleID: Number(selectedModule),
        subModuleName: subModuleName.trim(),
        route: route.trim(),
        rank: rank ? Number(rank) : 0,
      }, { headers });

      if (response.data.status === 'success') {
        showToast(response.data.message || 'Sub Module Created Successfully', 'success');
        setSubModuleName('');
        setRoute('');
        setRank('');
        setSelectedModule('');
        clearSubModulesCache();
        fetchSubModules(1, selectedFilterModule, true); // reload list silently
      } else {
        setFormError(response.data.message || 'Failed to create submodule.');
      }
    } catch (err) {
      console.error('Error creating submodule:', err);
      const validationErrors = err.response?.data?.errors;
      if (validationErrors && validationErrors.subModuleName) {
        setFormError(validationErrors.subModuleName[0]);
      } else if (validationErrors && validationErrors.route) {
        setFormError(validationErrors.route[0]);
      } else {
        setFormError(err.response?.data?.message || 'An error occurred while creating the submodule.');
      }
    } finally {
      setSaving(false);
    }
  };

  // Open Edit Modal
  const openEditModal = (sub) => {
    setEditSubModule(sub);
    setEditModuleId(sub.moduleID);
    setEditSubModuleName(sub.submodulename);
    setEditRoute(sub.route);
    setEditRank(sub.sub_module_rank);
    setEditFormError('');
    setShowDeleteConfirm(false);
  };

  // Close Edit Modal
  const closeEditModal = () => {
    setEditSubModule(null);
    setEditModuleId('');
    setEditSubModuleName('');
    setEditRoute('');
    setEditRank('');
    setEditFormError('');
    setShowDeleteConfirm(false);
  };

  // Handle Edit Submit
  const handleEditSubModuleSubmit = async (e) => {
    e.preventDefault();
    setEditFormError('');

    if (!editModuleId) {
      setEditFormError('Please select a parent module.');
      return;
    }

    const nameError = validateSubModuleName(editSubModuleName);
    if (nameError) {
      setEditFormError(nameError);
      return;
    }

    if (!editRoute.trim()) {
      setEditFormError('Route is required.');
      return;
    }

    if (editRank === '') {
      setEditFormError('Rank is required.');
      return;
    }

    setUpdating(true);
    const headers = buildHeaders();
    try {
      const response = await axios.post(`${API_BASE}/submodules/update/${editSubModule.submoduleID}`, {
        moduleID: Number(editModuleId),
        subModuleName: editSubModuleName.trim(),
        route: editRoute.trim(),
        rank: Number(editRank),
      }, { headers });

      if (response.data.status === 'success') {
        showToast(response.data.message || 'SubModule Successfully Updated', 'success');
        closeEditModal();
        clearSubModulesCache();
        fetchSubModules(page, selectedFilterModule, true); // reload current page silently
      } else {
        setEditFormError(response.data.message || 'Failed to update submodule.');
      }
    } catch (err) {
      console.error('Error updating submodule:', err);
      const validationErrors = err.response?.data?.errors;
      if (validationErrors && validationErrors.subModuleName) {
        setEditFormError(validationErrors.subModuleName[0]);
      } else if (validationErrors && validationErrors.route) {
        setEditFormError(validationErrors.route[0]);
      } else {
        setEditFormError(err.response?.data?.message || 'An error occurred while updating the submodule.');
      }
    } finally {
      setUpdating(false);
    }
  };

  // Handle Delete Submodule
  const handleDeleteSubModule = async () => {
    setDeleting(true);
    setEditFormError('');
    const headers = buildHeaders();
    try {
      const response = await axios.post(`${API_BASE}/submodules/delete/${editSubModule.submoduleID}`, {}, { headers });
      if (response.data.status === 'success') {
        showToast(response.data.message || 'Sub-module Successfully Deleted', 'success');
        closeEditModal();
        clearSubModulesCache();
        fetchSubModules(1, selectedFilterModule, true); // reload first page silently
      } else {
        setEditFormError(response.data.message || 'Failed to delete submodule.');
      }
    } catch (err) {
      console.error('Error deleting submodule:', err);
      setEditFormError(err.response?.data?.message || 'An error occurred during deletion.');
    } finally {
      setDeleting(false);
    }
  };

  const filterOptions = [
    { value: '', label: 'ALL MODULES' },
    ...modules
  ];

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
        <h1>Add New Sub-Module</h1>
        <p>Configure sub-features, Ordering Ranks, and Link paths under modules</p>
      </div>

      {/* Grid Layout */}
      <div className={styles.dashboardGrid}>
        
        {/* Create Sub-Module Card */}
        <div className={styles.panel}>
          <div className={styles.panelHeading}>
            <h3 className={styles.panelTitle}>
              <Plus size={18} /> Create Sub Module
            </h3>
          </div>
          <div className={styles.panelBody}>
            <form onSubmit={handleAddSubModuleSubmit} className={styles.formHorizontal}>
              
              <div className={styles.formGroup}>
                <label>Select Parent Module</label>
                <CustomSelect
                  options={modules}
                  value={selectedModule}
                  onChange={setSelectedModule}
                  placeholder="Choose parent module..."
                  disabled={saving}
                />
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="subModuleName">Sub Module Name</label>
                <input
                  id="subModuleName"
                  type="text"
                  className={styles.formControl}
                  placeholder="e.g. Add Employee Status"
                  value={subModuleName}
                  onChange={(e) => setSubModuleName(e.target.value)}
                  disabled={saving}
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="route">Route Path</label>
                <input
                  id="route"
                  type="text"
                  className={styles.formControl}
                  placeholder="e.g. hr/staff-status"
                  value={route}
                  onChange={(e) => setRoute(e.target.value)}
                  disabled={saving}
                  required
                />
              </div>

              <div className={styles.formGroup}>
                <label htmlFor="rank">Display Rank (Optional)</label>
                <input
                  id="rank"
                  type="number"
                  className={styles.formControl}
                  placeholder="e.g. 1"
                  value={rank}
                  onChange={(e) => setRank(e.target.value)}
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
                  {saving ? 'Saving…' : 'Add Sub-Module'}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Sub-Modules Table Card */}
        <div className={styles.panel}>
          <div className={styles.panelHeading} style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 className={styles.panelTitle}>
              <Layers size={18} /> All Sub-Modules
            </h3>
            
            {/* Filter Module selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: '320px' }}>
              <Filter size={16} style={{ color: 'var(--text-secondary)' }} />
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>Filter:</span>
              <CustomSelect
                options={filterOptions}
                value={selectedFilterModule}
                onChange={setSelectedFilterModule}
                placeholder="All Modules"
              />
            </div>
          </div>
          <div className={styles.panelBody}>
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th style={{ width: '80px' }}>S/N</th>
                    <th>Parent Module</th>
                    <th>Sub Module Name</th>
                    <th>Route</th>
                    <th style={{ width: '100px' }}>Rank</th>
                    <th>Date Created</th>
                    <th style={{ width: '100px', textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && !submodules.length ? (
                    <tr>
                      <td colSpan="7" style={{ textAlign: 'center', padding: '3rem 1rem' }}>
                        <Loader2 size={32} className={styles.spinner} style={{ margin: '0 auto 1rem' }} />
                        <span style={{ color: 'var(--text-secondary)' }}>Loading submodules list…</span>
                      </td>
                    </tr>
                  ) : !submodules.length ? (
                    <tr>
                      <td colSpan="7" style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-secondary)' }}>
                        No sub-modules found matching the active filter.
                      </td>
                    </tr>
                  ) : (
                    submodules.map((item, idx) => {
                      const serialNumber = ((page - 1) * perPage) + idx + 1;
                      return (
                        <tr key={item.submoduleID}>
                          <td>{serialNumber}</td>
                          <td style={{ color: 'var(--primary, #3b82f6)', fontWeight: 500 }}>
                            {item.modulename.toUpperCase()}
                          </td>
                          <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                            {item.submodulename.toUpperCase()}
                          </td>
                          <td>
                            <code style={{ background: 'rgba(255, 255, 255, 0.05)', padding: '0.2rem 0.4rem', borderRadius: '4px', fontSize: '0.85rem' }}>
                              /{item.route}
                            </code>
                          </td>
                          <td>{item.sub_module_rank}</td>
                          <td>
                            {item.created_at ? new Date(item.created_at).toLocaleDateString() : '—'}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <button
                              type="button"
                              className={styles.actionBtn}
                              title="Edit Sub Module"
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
                    onClick={() => fetchSubModules(page - 1, selectedFilterModule)}
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
                        onClick={() => fetchSubModules(pg, selectedFilterModule)}
                      >
                        {pg}
                      </button>
                    );
                  })}
                  <button
                    className={styles.pageBtn}
                    disabled={page >= lastPage || loading}
                    onClick={() => fetchSubModules(page + 1, selectedFilterModule)}
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Edit Submodule Modal */}
      <AnimatePresence>
        {editSubModule && (
          <div className={styles.modalBackdrop}>
            <motion.div
              className={styles.modal}
              style={{ maxWidth: '550px' }}
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
            >
              <div className={styles.panelTitle} style={{ justifyContent: 'space-between', width: '100%' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Edit2 size={18} /> Update Sub Module
                </span>
                
                {/* Delete button triggering confirmation prompt */}
                {!showDeleteConfirm && (
                  <button
                    type="button"
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#f87171',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.25rem',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                    }}
                    onClick={() => setShowDeleteConfirm(true)}
                  >
                    <Trash2 size={16} /> Delete
                  </button>
                )}
              </div>

              {/* Confirm deletion block */}
              {showDeleteConfirm && (
                <div
                  style={{
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px dashed #ef4444',
                    borderRadius: '8px',
                    padding: '1rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem',
                    marginTop: '0.25rem',
                  }}
                >
                  <p style={{ margin: 0, fontSize: '0.9rem', color: '#fca5a5', fontWeight: 500 }}>
                    Are you sure you want to delete this submodule? This will also clean up all role permission mapping relations.
                  </p>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                    <button
                      type="button"
                      className={styles.btnCancel}
                      style={{ padding: '0.4rem 1rem', fontSize: '0.85rem' }}
                      onClick={() => setShowDeleteConfirm(false)}
                      disabled={deleting}
                    >
                      No, Keep it
                    </button>
                    <button
                      type="button"
                      style={{
                        background: '#ef4444',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '0.4rem 1.25rem',
                        fontSize: '0.85rem',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                      }}
                      onClick={handleDeleteSubModule}
                      disabled={deleting}
                    >
                      {deleting ? 'Deleting…' : 'Yes, Delete'}
                    </button>
                  </div>
                </div>
              )}

              <form onSubmit={handleEditSubModuleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '0.5rem' }}>
                
                <div className={styles.formGroup}>
                  <label>Select Parent Module</label>
                  <CustomSelect
                    options={modules}
                    value={editModuleId}
                    onChange={setEditModuleId}
                    placeholder="Choose parent module..."
                    disabled={updating || deleting}
                  />
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="editSubModuleName">Sub Module Name</label>
                  <input
                    id="editSubModuleName"
                    type="text"
                    className={styles.formControl}
                    value={editSubModuleName}
                    onChange={(e) => setEditSubModuleName(e.target.value)}
                    disabled={updating || deleting}
                    required
                  />
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="editRoute">Route Path</label>
                  <input
                    id="editRoute"
                    type="text"
                    className={styles.formControl}
                    value={editRoute}
                    onChange={(e) => setEditRoute(e.target.value)}
                    disabled={updating || deleting}
                    required
                  />
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="editRank">Display Rank</label>
                  <input
                    id="editRank"
                    type="number"
                    className={styles.formControl}
                    value={editRank}
                    onChange={(e) => setEditRank(e.target.value)}
                    disabled={updating || deleting}
                    required
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
                    disabled={updating || deleting}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className={styles.btnSubmit}
                    disabled={updating || deleting}
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
