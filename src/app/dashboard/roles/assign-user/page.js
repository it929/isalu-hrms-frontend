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
  Users,
  Save,
  Search,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
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
          {options.length === 0 ? (
            <div style={{ padding: '0.65rem 0.85rem', color: '#9ca3af', fontSize: '0.9rem' }}>No options available</div>
          ) : (
            options.map((opt) => (
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
            ))
          )}
        </div>
      )}
    </div>
  );
}

// Sliding window pagination range helper
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

export default function AssignUserRolePage() {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  // Lists
  const [roles, setRoles] = useState([]);
  const [users, setUsers] = useState([]);
  const [assignments, setAssignments] = useState([]);

  // Selections
  const [selectedUser, setSelectedUser] = useState('');
  const [selectedRole, setSelectedRole] = useState('');
  const [formError, setFormError] = useState('');

  // Search and Pagination
  const [searchVal, setSearchVal] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const perPage = 20;

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4500);
  }, []);

  const clearUserAssignCache = useCallback(() => {
    if (typeof window !== 'undefined') {
      Object.keys(sessionStorage).forEach(key => {
        if (key.startsWith('hrms_user_assign_')) {
          sessionStorage.removeItem(key);
        }
      });
    }
  }, []);

  // Fetch metadata (roles and users lists)
  const fetchMetadata = useCallback(async (silent = false) => {
    const cacheKey = 'hrms_user_assign_metadata_cache';
    let hasCache = false;
    if (!silent && typeof window !== 'undefined') {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        const data = JSON.parse(cached);
        setRoles((data.roles || []).map(r => ({ value: r.roleID, label: r.rolename.toUpperCase() })));
        setUsers((data.users || []).map(u => ({ value: u.id, label: `${u.name.toUpperCase()} (${u.username})` })));
        hasCache = true;
      }
    }
    if (!hasCache && !silent) setLoading(true);

    const headers = buildHeaders();
    try {
      const response = await axios.get(`${API_BASE}/user-assign/metadata`, { headers });
      if (response.data.status === 'success') {
        setRoles((response.data.roles || []).map(r => ({ value: r.roleID, label: r.rolename.toUpperCase() })));
        setUsers((response.data.users || []).map(u => ({ value: u.id, label: `${u.name.toUpperCase()} (${u.username})` })));
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

  // Fetch paginated assignments list
  const fetchAssignments = useCallback(async (currentPage = 1, query = '', silent = false) => {
    const cacheKey = `hrms_user_assign_assignments_cache_${query || 'all'}_${currentPage}`;
    let hasCache = false;
    if (!silent && typeof window !== 'undefined') {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        const resData = JSON.parse(cached);
        setAssignments(resData.data || []);
        setTotalPages(resData.lastPage || 1);
        setTotalRecords(resData.total || 0);
        hasCache = true;
      }
    }

    let setTableLoading = false;
    if (!hasCache && !silent) {
      setTableLoading = true;
      setLoading(true);
    }

    const headers = buildHeaders();
    try {
      const response = await axios.get(`${API_BASE}/user-assign/assignments`, {
        params: {
          page: currentPage,
          perPage,
          search: query
        },
        headers
      });

      if (response.data.status === 'success') {
        setAssignments(response.data.data || []);
        setTotalPages(response.data.lastPage || 1);
        setTotalRecords(response.data.total || 0);
        if (typeof window !== 'undefined') {
          sessionStorage.setItem(cacheKey, JSON.stringify(response.data));
        }
      } else {
        showToast(response.data.message || 'Failed to load assignments.', 'error');
      }
    } catch (err) {
      console.error('Error fetching assignments:', err);
      showToast('Error fetching user assignments list.', 'error');
    } finally {
      if (setTableLoading) setLoading(false);
    }
  }, [showToast]);

  // Initial load metadata
  useEffect(() => {
    let hasCache = false;
    if (typeof window !== 'undefined') {
      hasCache = !!sessionStorage.getItem('hrms_user_assign_metadata_cache');
    }
    if (hasCache) {
      const cached = sessionStorage.getItem('hrms_user_assign_metadata_cache');
      if (cached) {
        const data = JSON.parse(cached);
        setRoles((data.roles || []).map(r => ({ value: r.roleID, label: r.rolename.toUpperCase() })));
        setUsers((data.users || []).map(u => ({ value: u.id, label: `${u.name.toUpperCase()} (${u.username})` })));
      }
    }
    fetchMetadata(hasCache);
  }, [fetchMetadata]);

  // Sync/Fetch assignments when page or searchQuery changes
  useEffect(() => {
    const cacheKey = `hrms_user_assign_assignments_cache_${searchQuery || 'all'}_${page}`;
    let hasCache = false;
    if (typeof window !== 'undefined') {
      hasCache = !!sessionStorage.getItem(cacheKey);
    }
    if (hasCache) {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        const resData = JSON.parse(cached);
        setAssignments(resData.data || []);
        setTotalPages(resData.lastPage || 1);
        setTotalRecords(resData.total || 0);
      }
    }
    fetchAssignments(page, searchQuery, hasCache);
  }, [page, searchQuery, fetchAssignments]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    setSearchQuery(searchVal);
  };

  const handleSearchClear = () => {
    setSearchVal('');
    setSearchQuery('');
    setPage(1);
  };

  // Submit new assignment
  const handleAssignSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!selectedUser) {
      setFormError('Please select a user.');
      return;
    }

    if (!selectedRole) {
      setFormError('Please select a role.');
      return;
    }

    setSaving(true);
    const headers = buildHeaders();
    try {
      const response = await axios.post(`${API_BASE}/user-assign/assign`, {
        userID: Number(selectedUser),
        roleID: Number(selectedRole),
      }, { headers });

      if (response.data.status === 'success') {
        showToast(response.data.message || 'User assigned to role successfully!', 'success');
        setSelectedUser('');
        setSelectedRole('');
        clearUserAssignCache();
        fetchAssignments(1, searchQuery, true); // Reload silently and go to first page
      } else {
        setFormError(response.data.message || 'Failed to assign user.');
      }
    } catch (err) {
      console.error('Error assigning user:', err);
      setFormError(err.response?.data?.message || 'An error occurred while assigning user.');
    } finally {
      setSaving(false);
    }
  };

  const paginationRange = getPaginationRange(page, totalPages);

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
        <h1>Assign User to Role</h1>
        <p>Map non-technical staff users to administrative and operational security roles</p>
      </div>

      <div className={styles.dashboardGrid}>
        
        {/* Left Side: Assign User Form Panel */}
        <div className={styles.panel}>
          <div className={styles.panelHeading}>
            <h3 className={styles.panelTitle}>
              <Lock size={18} /> Configure Mappings
            </h3>
          </div>
          <div className={styles.panelBody}>
            <form onSubmit={handleAssignSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              
              <div className={styles.formGroup}>
                <label>Select User</label>
                <CustomSelect
                  options={users}
                  value={selectedUser}
                  onChange={setSelectedUser}
                  placeholder="Choose user account..."
                  disabled={loading || saving}
                />
              </div>

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
                  disabled={loading || saving || !selectedUser || !selectedRole}
                >
                  {saving ? (
                    <Loader2 size={18} className={styles.spinner} />
                  ) : (
                    <Save size={18} />
                  )}
                  {saving ? 'Saving Mappings…' : 'ASSIGN USER'}
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
                  <li>Select a user to map.</li>
                  <li>Choose the target role you want to grant the user.</li>
                  <li>Users can only have one assigned role. Submitting a new role updates their existing mapping.</li>
                  <li>Click <strong>ASSIGN USER</strong> to save changes.</li>
                </ul>
              </div>
            </form>
          </div>
        </div>

        {/* Right Side: Assigned Users Table Panel */}
        <div className={styles.panel}>
          <div className={styles.panelHeading} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
            <h3 className={styles.panelTitle}>
              <Users size={18} /> Assigned Users Mappings List
            </h3>
            {totalRecords > 0 && (
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary, #9ca3af)' }}>
                Total: <strong>{totalRecords}</strong> mappings
              </span>
            )}
          </div>
          <div className={styles.panelBody} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            
            {/* Search Filter Panel */}
            <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '0.5rem' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <input
                  type="text"
                  placeholder="Search user name, username, or role..."
                  value={searchVal}
                  onChange={(e) => setSearchVal(e.target.value)}
                  className={styles.formControl}
                  style={{ paddingLeft: '2.25rem' }}
                />
                <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
              </div>
              <button type="submit" className={styles.btnSubmit} style={{ padding: '0.5rem 1rem', background: '#3b82f6' }}>
                Search
              </button>
              {(searchQuery || searchVal) && (
                <button
                  type="button"
                  onClick={handleSearchClear}
                  className={styles.btnCancel}
                  style={{ padding: '0.5rem 0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  title="Reset Search"
                >
                  <RotateCcw size={16} />
                </button>
              )}
            </form>

            {/* List Table wrapper */}
            <div className={styles.tableWrapper}>
              {loading ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '260px', gap: '1rem' }}>
                  <Loader2 size={40} className={styles.spinner} />
                  <span style={{ color: 'var(--text-secondary)' }}>Loading assignments...</span>
                </div>
              ) : assignments.length === 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '260px', gap: '0.75rem', color: 'var(--text-secondary)' }}>
                  <ShieldIcon size={40} style={{ opacity: 0.5 }} />
                  <span>No user assignments found.</span>
                </div>
              ) : (
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th style={{ width: '60px' }}>S/N</th>
                      <th>Name</th>
                      <th>Username</th>
                      <th>Role</th>
                      <th>Date Assigned</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assignments.map((item, index) => (
                      <tr key={item.assignuserID}>
                        <td>{((page - 1) * perPage) + index + 1}</td>
                        <td style={{ fontWeight: 'bold' }}>{item.name.toUpperCase()}</td>
                        <td>{item.username}</td>
                        <td>
                          <span style={{
                            background: 'rgba(59, 130, 246, 0.1)',
                            border: '1px solid rgba(59, 130, 246, 0.2)',
                            borderRadius: '4px',
                            padding: '0.2rem 0.4rem',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            color: '#60a5fa'
                          }}>
                            {item.rolename.toUpperCase()}
                          </span>
                        </td>
                        <td style={{ color: '#9ca3af', fontSize: '0.85rem' }}>
                          {item.created_at ? new Date(item.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : 'N/A'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Pagination Controls */}
            {!loading && totalPages > 1 && (
              <div className={styles.pagination}>
                <span className={styles.paginationInfo}>
                  Showing page {page} of {totalPages}
                </span>
                <div className={styles.paginationControls}>
                  <button
                    type="button"
                    className={styles.pageBtn}
                    onClick={() => setPage(prev => Math.max(1, prev - 1))}
                    disabled={page === 1}
                  >
                    <ChevronLeft size={16} />
                  </button>

                  {paginationRange.map((p, idx) => (
                    <button
                      key={idx}
                      type="button"
                      className={`${styles.pageBtn} ${p === page ? styles.pageBtnActive : ''}`}
                      onClick={() => typeof p === 'number' && setPage(p)}
                      disabled={p === '...'}
                    >
                      {p}
                    </button>
                  ))}

                  <button
                    type="button"
                    className={styles.pageBtn}
                    onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}
                    disabled={page === totalPages}
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
