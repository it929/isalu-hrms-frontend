"use client";

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, AlertCircle, CheckCircle2, UserCheck, Shield, Calendar, ToggleLeft, ToggleRight } from 'lucide-react';
import axios from 'axios';

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

const PERMISSION_OPTIONS = [
  { id: 'approve_leave', label: 'Leave Approvals' },
  { id: 'approve_iou', label: 'IOU Approvals' },
  { id: 'approve_refund', label: 'Refund Approvals' },
  { id: 'approve_resignation', label: 'Resignation Approvals' },
  { id: 'approve_loan', label: 'Loan Approvals' },
];

export default function HODRoleDelegation() {
  const [staff, setStaff] = useState([]);
  const [delegations, setDelegations] = useState([]);
  const [selectedStaff, setSelectedStaff] = useState('');
  const [selectedPermissions, setSelectedPermissions] = useState([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [togglingId, setTogglingId] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/hod-delegations`, { headers: buildHeaders() });
      if (res.data.status === 'success') {
        setStaff(res.data.staff || []);
        setDelegations(res.data.delegations || []);
      } else {
        showToast('Failed to load delegation data.', 'error');
      }
    } catch (err) {
      showToast('Error loading delegation data from server.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handlePermissionChange = (permId) => {
    setSelectedPermissions(prev =>
      prev.includes(permId)
        ? prev.filter(p => p !== permId)
        : [...prev, permId]
    );
  };

  const handleToggleAllPermissions = () => {
    if (selectedPermissions.length === PERMISSION_OPTIONS.length) {
      setSelectedPermissions([]);
    } else {
      setSelectedPermissions(PERMISSION_OPTIONS.map(p => p.id));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedStaff) {
      showToast('Please select a staff member.', 'error');
      return;
    }
    if (selectedPermissions.length === 0) {
      showToast('Please select at least one permission to delegate.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        delegate_staff_id: parseInt(selectedStaff),
        permissions: selectedPermissions,
        start_date: startDate || null,
        end_date: endDate || null,
      };

      const res = await axios.post(`${API_BASE}/hod-delegations`, payload, { headers: buildHeaders() });
      if (res.data.status === 'success') {
        showToast(res.data.message || 'Role delegated successfully!', 'success');
        // Reset form
        setSelectedStaff('');
        setSelectedPermissions([]);
        setStartDate('');
        setEndDate('');
        // Reload list
        loadData();
      } else {
        showToast(res.data.message || 'Failed to delegate role.', 'error');
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Error occurred during role delegation.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (id) => {
    setTogglingId(id);
    try {
      const res = await axios.post(`${API_BASE}/hod-delegations/toggle/${id}`, {}, { headers: buildHeaders() });
      if (res.data.status === 'success') {
        showToast(res.data.message || 'Delegation status updated!', 'success');
        loadData();
      } else {
        showToast('Failed to update delegation status.', 'error');
      }
    } catch (err) {
      showToast('Error updating delegation status.', 'error');
    } finally {
      setTogglingId(null);
    }
  };

  const getPermissionLabel = (permId) => {
    return PERMISSION_OPTIONS.find(p => p.id === permId)?.label || permId;
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      {/* Page Header */}
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ color: 'var(--primary)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Shield size={28} />
          Role Delegation
        </h1>
        <p style={{ color: 'var(--secondary)' }}>
          Temporarily or permanently delegate parts of your HOD authority to trusted staff members in your department.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '2rem', alignItems: 'start' }}>
        {/* Delegation Form */}
        <div className="premium-card">
          <h3 style={{ marginBottom: '1.5rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <UserCheck size={20} style={{ color: 'var(--primary)' }} />
            New Role Delegation
          </h3>
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              
              {/* Select Staff */}
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Select Delegate Staff</label>
                <select
                  value={selectedStaff}
                  onChange={(e) => setSelectedStaff(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    borderRadius: 'var(--radius)',
                    border: '1px solid var(--border)',
                    background: 'var(--background)',
                    color: 'var(--foreground)'
                  }}
                  required
                >
                  <option value="">-- Select Department Staff --</option>
                  {staff.map((s) => (
                    <option key={s.ID} value={s.ID}>
                      {s.surname} {s.first_name} {s.othernames || ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Permissions Checklist */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <label style={{ fontWeight: '500' }}>Delegated Actions</label>
                  <button
                    type="button"
                    onClick={handleToggleAllPermissions}
                    style={{ fontSize: '0.8rem', color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: '600' }}
                  >
                    {selectedPermissions.length === PERMISSION_OPTIONS.length ? 'Clear All' : 'Select All'}
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', border: '1px solid var(--border)', padding: '1rem', borderRadius: 'var(--radius)', background: 'rgba(0,0,0,0.02)' }}>
                  {PERMISSION_OPTIONS.map((perm) => (
                    <label key={perm.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', fontSize: '0.9rem' }}>
                      <input
                        type="checkbox"
                        checked={selectedPermissions.includes(perm.id)}
                        onChange={() => handlePermissionChange(perm.id)}
                        style={{ width: '16px', height: '16px', accentColor: 'var(--primary)' }}
                      />
                      <span>{perm.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Dates */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', fontSize: '0.85rem' }}>Start Date (Optional)</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      borderRadius: 'var(--radius)',
                      border: '1px solid var(--border)',
                      background: 'var(--background)',
                      color: 'var(--foreground)'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500', fontSize: '0.85rem' }}>End Date (Optional)</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    min={startDate}
                    style={{
                      width: '100%',
                      padding: '0.75rem',
                      borderRadius: 'var(--radius)',
                      border: '1px solid var(--border)',
                      background: 'var(--background)',
                      color: 'var(--foreground)'
                    }}
                  />
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                className="premium-btn"
                disabled={submitting || !selectedStaff || selectedPermissions.length === 0}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  marginTop: '0.5rem'
                }}
              >
                {submitting ? (
                  <Loader2 size={18} className="spinner" />
                ) : (
                  <UserCheck size={18} />
                )}
                {submitting ? 'Delegating...' : 'Delegate Role'}
              </button>

            </div>
          </form>
        </div>

        {/* Delegations History / Active List */}
        <div className="premium-card" style={{ flexGrow: 2 }}>
          <h3 style={{ marginBottom: '1.5rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Calendar size={20} style={{ color: 'var(--primary)' }} />
            Delegation History & Scope
          </h3>

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '3rem' }}>
              <Loader2 size={36} className="spinner" style={{ color: 'var(--primary)' }} />
            </div>
          ) : delegations.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--secondary)' }}>
              No delegations recorded yet. Use the form on the left to delegate a role.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '500px' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border)', color: 'var(--secondary)', fontSize: '0.85rem' }}>
                    <th style={{ padding: '0.75rem' }}>Delegate Name</th>
                    <th style={{ padding: '0.75rem' }}>Delegated Actions</th>
                    <th style={{ padding: '0.75rem' }}>Active Dates</th>
                    <th style={{ padding: '0.75rem' }}>Status</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {delegations.map((del) => {
                    const decodedPermissions = JSON.parse(del.permissions) || [];
                    const isDateActive = () => {
                      if (del.status !== 'active') return false;
                      const today = new Date().toISOString().split('T')[0];
                      if (del.start_date && del.start_date > today) return false;
                      if (del.end_date && del.end_date < today) return false;
                      return true;
                    };
                    const isActive = isDateActive();

                    return (
                      <tr key={del.id} style={{ borderBottom: '1px solid var(--border)', fontSize: '0.9rem' }}>
                        <td style={{ padding: '1rem 0.75rem', fontWeight: '500' }}>
                          {del.surname} {del.first_name}
                        </td>
                        <td style={{ padding: '1rem 0.75rem' }}>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                            {decodedPermissions.map(p => (
                              <span key={p} style={{
                                fontSize: '0.75rem',
                                padding: '0.15rem 0.4rem',
                                borderRadius: '4px',
                                background: 'rgba(99, 102, 241, 0.1)',
                                color: 'var(--primary)',
                                fontWeight: '500'
                              }}>
                                {getPermissionLabel(p)}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td style={{ padding: '1rem 0.75rem', color: 'var(--secondary)', fontSize: '0.8rem' }}>
                          {del.start_date || 'No Start'} → {del.end_date || 'No End'}
                        </td>
                        <td style={{ padding: '1rem 0.75rem' }}>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.25rem',
                            fontSize: '0.8rem',
                            fontWeight: '600',
                            padding: '0.2rem 0.5rem',
                            borderRadius: '20px',
                            background: isActive ? '#d1fae5' : '#fee2e2',
                            color: isActive ? '#065f46' : '#991b1b'
                          }}>
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: isActive ? '#10b981' : '#ef4444' }}></span>
                            {isActive ? 'Active' : del.status === 'active' ? 'Scheduled' : 'Inactive'}
                          </span>
                        </td>
                        <td style={{ padding: '1rem 0.75rem', textAlign: 'right' }}>
                          <button
                            onClick={() => handleToggleStatus(del.id)}
                            disabled={togglingId === del.id}
                            style={{
                              border: 'none',
                              background: 'none',
                              cursor: 'pointer',
                              color: del.status === 'active' ? '#ef4444' : '#10b981',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                              fontWeight: '600',
                              fontSize: '0.8rem'
                            }}
                          >
                            {togglingId === del.id ? (
                              <Loader2 size={16} className="spinner" />
                            ) : del.status === 'active' ? (
                              <>
                                <ToggleRight size={20} />
                                Deactivate
                              </>
                            ) : (
                              <>
                                <ToggleLeft size={20} />
                                Activate
                              </>
                            )}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            style={{
              position: 'fixed',
              bottom: '24px',
              right: '24px',
              padding: '1rem 1.5rem',
              borderRadius: '8px',
              background: toast.type === 'success' ? '#10b981' : '#ef4444',
              color: 'white',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              zIndex: 9999
            }}
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
          >
            {toast.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
            <span>{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
