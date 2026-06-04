"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import {
  ShieldAlert,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Lock,
  Layers,
  Save,
  CheckSquare,
  Square,
  ShieldAlert as ShieldIcon
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

// Custom Select trigger dropdown matching style and z-index context
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

export default function AssignModuleRolePage() {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  // Lists
  const [roles, setRoles] = useState([]);
  const [submodules, setSubmodules] = useState([]);
  const [assignedIds, setAssignedIds] = useState([]);

  // Selections
  const [selectedRole, setSelectedRole] = useState('');
  const [formError, setFormError] = useState('');

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4500);
  }, []);

  const clearAssignmentsCache = useCallback(() => {
    if (typeof window !== 'undefined') {
      Object.keys(sessionStorage).forEach(key => {
        if (key.startsWith('hrms_assign_module_')) {
          sessionStorage.removeItem(key);
        }
      });
    }
  }, []);

  // Fetch metadata (roles and submodules list)
  const fetchMetadata = useCallback(async (silent = false) => {
    const cacheKey = 'hrms_assign_module_metadata_cache';
    let hasCache = false;
    if (!silent && typeof window !== 'undefined') {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        const data = JSON.parse(cached);
        setRoles((data.roles || []).map(r => ({ value: r.roleID, label: r.rolename.toUpperCase() })));
        setSubmodules(data.submodules || []);
        hasCache = true;
      }
    }
    if (!hasCache && !silent) setLoading(true);

    const headers = buildHeaders();
    try {
      const response = await axios.get(`${API_BASE}/assign-module/metadata`, { headers });
      if (response.data.status === 'success') {
        setRoles((response.data.roles || []).map(r => ({ value: r.roleID, label: r.rolename.toUpperCase() })));
        setSubmodules(response.data.submodules || []);
        if (typeof window !== 'undefined') {
          sessionStorage.setItem(cacheKey, JSON.stringify(response.data));
        }
      } else {
        showToast(response.data.message || 'Failed to load metadata.', 'error');
      }
    } catch (err) {
      console.error('Error loading metadata:', err);
      showToast('Error connecting to the server.', 'error');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [showToast]);

  // Fetch current role assignments
  const fetchAssignments = useCallback(async (roleID, silent = false) => {
    if (!roleID) {
      setAssignedIds([]);
      return;
    }
    const cacheKey = `hrms_assign_module_assignments_cache_${roleID}`;
    let hasCache = false;
    if (!silent && typeof window !== 'undefined') {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        setAssignedIds(JSON.parse(cached));
        hasCache = true;
      }
    }

    const headers = buildHeaders();
    try {
      const response = await axios.get(`${API_BASE}/assign-module/assignments/${roleID}`, { headers });
      if (response.data.status === 'success') {
        const assignments = response.data.assignments || [];
        setAssignedIds(assignments);
        if (typeof window !== 'undefined') {
          sessionStorage.setItem(cacheKey, JSON.stringify(assignments));
        }
      } else {
        showToast(response.data.message || 'Failed to load assignments.', 'error');
      }
    } catch (err) {
      console.error('Error fetching assignments:', err);
      showToast('Error fetching active role assignments.', 'error');
    }
  }, [showToast]);

  // Load metadata on mount
  useEffect(() => {
    let hasCache = false;
    if (typeof window !== 'undefined') {
      hasCache = !!sessionStorage.getItem('hrms_assign_module_metadata_cache');
    }
    if (hasCache) {
      const cached = sessionStorage.getItem('hrms_assign_module_metadata_cache');
      if (cached) {
        const data = JSON.parse(cached);
        setRoles((data.roles || []).map(r => ({ value: r.roleID, label: r.rolename.toUpperCase() })));
        setSubmodules(data.submodules || []);
      }
    }
    fetchMetadata(hasCache);
  }, [fetchMetadata]);

  // Load assignments when selected role changes
  useEffect(() => {
    if (selectedRole) {
      const cacheKey = `hrms_assign_module_assignments_cache_${selectedRole}`;
      let hasCache = false;
      if (typeof window !== 'undefined') {
        hasCache = !!sessionStorage.getItem(cacheKey);
      }
      if (hasCache) {
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
          setAssignedIds(JSON.parse(cached));
        }
      }
      fetchAssignments(selectedRole, hasCache);
    } else {
      setAssignedIds([]);
    }
  }, [selectedRole, fetchAssignments]);

  // Handle single checkbox toggle
  const handleCheckboxToggle = (submoduleID) => {
    setAssignedIds(prev => {
      if (prev.includes(submoduleID)) {
        return prev.filter(id => id !== submoduleID);
      } else {
        return [...prev, submoduleID];
      }
    });
  };

  // Group submodules by parent module ID
  const groupedModules = {};
  submodules.forEach(item => {
    if (!groupedModules[item.moduleID]) {
      groupedModules[item.moduleID] = {
        moduleID: item.moduleID,
        modulename: item.modulename,
        link_type: item.link_type,
        items: []
      };
    }
    groupedModules[item.moduleID].items.push(item);
  });
  const groupedList = Object.values(groupedModules);

  // Group helpers: Select All
  const handleSelectAllInModule = (moduleItem) => {
    const itemIds = moduleItem.items.map(item => item.submoduleID);
    setAssignedIds(prev => {
      const filtered = prev.filter(id => !itemIds.includes(id));
      return [...filtered, ...itemIds];
    });
  };

  // Group helpers: Deselect All
  const handleDeselectAllInModule = (moduleItem) => {
    const itemIds = moduleItem.items.map(item => item.submoduleID);
    setAssignedIds(prev => prev.filter(id => !itemIds.includes(id)));
  };

  // Submit assignments change to backend
  const handleAssignSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!selectedRole) {
      setFormError('Please select a user role.');
      return;
    }

    setSaving(true);
    const headers = buildHeaders();
    try {
      const response = await axios.post(`${API_BASE}/assign-module/assign`, {
        roleID: Number(selectedRole),
        submoduleIDs: assignedIds,
      }, { headers });

      if (response.data.status === 'success') {
        showToast(response.data.message || 'Module Assigned Successfully', 'success');
        clearAssignmentsCache();
        fetchAssignments(selectedRole, true); // reload silently
      } else {
        setFormError(response.data.message || 'Failed to save assignments.');
      }
    } catch (err) {
      console.error('Error saving assignments:', err);
      setFormError(err.response?.data?.message || 'An error occurred while saving assignments.');
    } finally {
      setSaving(false);
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
        <h1>Assign Module to Role</h1>
        <p>Set operational permissions and submodule accessibility for system user roles</p>
      </div>

      <form onSubmit={handleAssignSubmit} className={styles.dashboardGrid}>
        
        {/* Left Side: Role Selection & Save panel */}
        <div className={styles.panel}>
          <div className={styles.panelHeading}>
            <h3 className={styles.panelTitle}>
              <Lock size={18} /> Configure Role
            </h3>
          </div>
          <div className={styles.panelBody} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div className={styles.formGroup}>
              <label>Select Target Role</label>
              <CustomSelect
                options={roles}
                value={selectedRole}
                onChange={setSelectedRole}
                placeholder="Choose user role..."
                disabled={loading || saving}
              />
            </div>

            {formError && (
              <p style={{ color: '#f87171', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.25rem', margin: 0 }}>
                <AlertCircle size={14} /> {formError}
              </p>
            )}

            <div style={{ marginTop: '0.5rem' }}>
              <button
                type="submit"
                className={styles.btnSubmit}
                style={{ width: '100%', padding: '0.75rem 1rem' }}
                disabled={loading || saving || !selectedRole}
              >
                {saving ? (
                  <Loader2 size={18} className={styles.spinner} />
                ) : (
                  <Save size={18} />
                )}
                {saving ? 'Saving Assignments…' : 'Save Assignments'}
              </button>
            </div>

            <div style={{
              background: 'rgba(59, 130, 246, 0.05)',
              border: '1px solid rgba(59, 130, 246, 0.15)',
              borderRadius: '8px',
              padding: '0.85rem',
              marginTop: '0.5rem',
            }}>
              <h5 style={{ margin: '0 0 0.5rem', fontSize: '0.85rem', fontWeight: 600, color: 'var(--primary, #3b82f6)' }}>Instructions:</h5>
              <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.8rem', color: 'var(--text-secondary, #9ca3af)', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <li>Select a role to pull its current accessibility mappings.</li>
                <li>Check submodules to grant navigation access.</li>
                <li>Uncheck submodules to revoke permissions.</li>
                <li>Click <strong>Save Assignments</strong> to apply mapping changes.</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Right Side: Checkbox Matrix */}
        <div className={styles.panel}>
          <div className={styles.panelHeading} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 className={styles.panelTitle}>
              <Layers size={18} /> Submodules Accessibility Matrix
            </h3>
            {selectedRole && (
              <span style={{ fontSize: '0.85rem', color: 'var(--primary, #3b82f6)', fontWeight: 600 }}>
                Selected: {assignedIds.length} submodules
              </span>
            )}
          </div>
          <div className={styles.panelBody} style={{ minHeight: '300px' }}>
            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '260px', gap: '1rem' }}>
                <Loader2 size={40} className={styles.spinner} />
                <span style={{ color: 'var(--text-secondary)' }}>Loading system modules metadata…</span>
              </div>
            ) : !selectedRole ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '260px', gap: '0.75rem', color: 'var(--text-secondary)' }}>
                <ShieldIcon size={40} style={{ opacity: 0.5 }} />
                <span>Please select a role on the left to display permission options.</span>
              </div>
            ) : !groupedList.length ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '260px', color: 'var(--text-secondary)' }}>
                No active submodules configured in the system.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {groupedList.map(moduleItem => {
                  const allSelected = moduleItem.items.every(item => assignedIds.includes(item.submoduleID));
                  const noneSelected = moduleItem.items.every(item => !assignedIds.includes(item.submoduleID));

                  return (
                    <div
                      key={moduleItem.moduleID}
                      style={{
                        border: '1px solid var(--border-color, #374151)',
                        borderRadius: '8px',
                        background: 'rgba(255, 255, 255, 0.01)',
                        overflow: 'hidden',
                      }}
                    >
                      {/* Module group header */}
                      <div
                        style={{
                          background: 'rgba(255, 255, 255, 0.03)',
                          borderBottom: '1px solid var(--border-color, #374151)',
                          padding: '0.75rem 1rem',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          flexWrap: 'wrap',
                          gap: '0.5rem',
                        }}
                      >
                        <span style={{ fontWeight: 'bold', fontSize: '0.9rem', color: '#f3f4f6' }}>
                          <span style={{ color: 'var(--primary, #3b82f6)', fontSize: '0.8rem', marginRight: '0.35rem' }}>[{moduleItem.link_type}]</span>
                          {moduleItem.modulename.toUpperCase()}
                        </span>
                        
                        {/* Select All / Deselect All toggles */}
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button
                            type="button"
                            style={{
                              background: 'transparent',
                              border: '1px solid #4b5563',
                              borderRadius: '4px',
                              padding: '0.2rem 0.6rem',
                              fontSize: '0.75rem',
                              color: '#9ca3af',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                            }}
                            onClick={() => handleSelectAllInModule(moduleItem)}
                          >
                            <CheckSquare size={12} /> Select All
                          </button>
                          <button
                            type="button"
                            style={{
                              background: 'transparent',
                              border: '1px solid #4b5563',
                              borderRadius: '4px',
                              padding: '0.2rem 0.6rem',
                              fontSize: '0.75rem',
                              color: '#9ca3af',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                            }}
                            onClick={() => handleDeselectAllInModule(moduleItem)}
                          >
                            <Square size={12} /> Clear
                          </button>
                        </div>
                      </div>

                      {/* Submodule list grid */}
                      <div
                        style={{
                          padding: '1rem',
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                          gap: '1rem',
                        }}
                      >
                        {moduleItem.items.map(sub => {
                          const checked = assignedIds.includes(sub.submoduleID);
                          return (
                            <label
                              key={sub.submoduleID}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.65rem',
                                cursor: 'pointer',
                                padding: '0.5rem 0.75rem',
                                borderRadius: '6px',
                                background: checked ? 'rgba(59, 130, 246, 0.05)' : 'transparent',
                                border: checked ? '1px solid rgba(59, 130, 246, 0.2)' : '1px solid transparent',
                                transition: 'all 0.2s',
                              }}
                              onMouseEnter={(e) => {
                                if (!checked) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)';
                              }}
                              onMouseLeave={(e) => {
                                if (!checked) e.currentTarget.style.background = 'transparent';
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => handleCheckboxToggle(sub.submoduleID)}
                                style={{
                                  width: '16px',
                                  height: '16px',
                                  cursor: 'pointer',
                                }}
                              />
                              <span style={{ fontSize: '0.85rem', fontWeight: checked ? '600' : '500', color: checked ? '#f3f4f6' : '#9ca3af' }}>
                                {sub.submodulename.toUpperCase()}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

      </form>
    </div>
  );
}
