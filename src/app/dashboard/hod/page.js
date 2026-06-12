"use client";

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { UserCheck, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
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

export default function HODAssignments() {
  const [departments, setDepartments] = useState([]);
  const [hods, setHods] = useState([]);
  const [staff, setStaff] = useState([]);
  
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedStaff, setSelectedStaff] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [staffLoading, setStaffLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4500);
  };

  // Load departments and HOD assignments
  const loadData = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/hod-assignments`, { headers: buildHeaders() });
      if (res.data.status === 'success') {
        setDepartments(res.data.departments || []);
        setHods(res.data.hods || []);
      } else {
        showToast('Failed to load HOD assignments.', 'error');
      }
    } catch (err) {
      showToast('Error fetching data from server.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Fetch staff when department selection changes
  useEffect(() => {
    if (!selectedDept) {
      setStaff([]);
      setSelectedStaff('');
      return;
    }

    const fetchStaff = async () => {
      setStaffLoading(true);
      try {
        const res = await axios.get(`${API_BASE}/staff-by-department/${selectedDept}`, { headers: buildHeaders() });
        if (res.data.status === 'success') {
          setStaff(res.data.staff || []);
          setSelectedStaff('');
        } else {
          showToast('Failed to load department staff.', 'error');
        }
      } catch (err) {
        showToast('Error loading staff for selected department.', 'error');
      } finally {
        setStaffLoading(false);
      }
    };

    fetchStaff();
  }, [selectedDept]);

  // Handle assign submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedDept || !selectedStaff) {
      showToast('Please select both department and staff.', 'error');
      return;
    }

    setSubmitting(true);
    try {
      const res = await axios.post(
        `${API_BASE}/assign-hod`,
        { department_id: selectedDept, user_id: selectedStaff },
        { headers: buildHeaders() }
      );

      if (res.data.status === 'success') {
        showToast(res.data.message || 'HOD assigned successfully!', 'success');
        setSelectedDept('');
        setSelectedStaff('');
        loadData(); // Reload list
      } else {
        showToast(res.data.message || 'Failed to assign HOD.', 'error');
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Error occurred while assigning HOD.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ color: 'var(--primary)', marginBottom: '0.5rem' }}>HOD Assignments</h1>
        <p style={{ color: 'var(--secondary)' }}>Assign Head of Department roles to specific users.</p>
      </div>

      {/* Assign HOD Form */}
      <div className="premium-card" style={{ marginBottom: '2rem' }}>
        <h3 style={{ marginBottom: '1.5rem', fontWeight: 'bold' }}>Assign HOD</h3>
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem', alignItems: 'end' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Select Department</label>
              <select
                value={selectedDept}
                onChange={(e) => setSelectedDept(e.target.value)}
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
                <option value="">-- Select Department --</option>
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.department}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Select Staff to be HOD</label>
              <select
                value={selectedStaff}
                onChange={(e) => setSelectedStaff(e.target.value)}
                disabled={staffLoading || !selectedDept}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  borderRadius: 'var(--radius)',
                  border: '1px solid var(--border)',
                  background: 'var(--background)',
                  color: 'var(--foreground)',
                  opacity: (!selectedDept || staffLoading) ? 0.6 : 1
                }}
                required
              >
                {staffLoading ? (
                  <option>Loading staff...</option>
                ) : (
                  <>
                    <option value="">-- Select Staff --</option>
                    {staff.map((s) => (
                      <option key={s.ID} value={s.ID}>
                        {s.surname} {s.first_name} {s.othernames || ''}
                      </option>
                    ))}
                  </>
                )}
              </select>
            </div>

            <div>
              <button
                type="submit"
                className="premium-btn"
                disabled={submitting || !selectedDept || !selectedStaff}
                style={{
                  width: '100%',
                  padding: '0.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem'
                }}
              >
                {submitting ? (
                  <Loader2 size={16} className="spinner" />
                ) : (
                  <UserCheck size={16} />
                )}
                {submitting ? 'Assigning...' : 'Assign'}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* HODs List Table */}
      <div className="premium-card">
        <h3 style={{ marginBottom: '1.5rem', fontWeight: 'bold' }}>Current Heads of Department</h3>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
            <Loader2 size={32} className="spinner" style={{ color: 'var(--primary)' }} />
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border)', color: 'var(--secondary)' }}>
                  <th style={{ padding: '1rem' }}>Department Name</th>
                  <th style={{ padding: '1rem' }}>Head of Department</th>
                </tr>
              </thead>
              <tbody>
                {hods.length === 0 ? (
                  <tr>
                    <td colSpan="2" style={{ padding: '2rem', textAlign: 'center', color: '#ef4444' }}>
                      No HODs Assigned Yet
                    </td>
                  </tr>
                ) : (
                  hods.map((hod) => (
                    <tr key={hod.department_id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '1rem', fontWeight: '500' }}>{hod.department_name}</td>
                      <td style={{ padding: '1rem' }}>
                        {hod.surname ? (
                          <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: '500' }}>
                            <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem' }}>
                              {hod.surname.charAt(0)}
                            </div>
                            {hod.surname} {hod.first_name} {hod.othernames || ''}
                          </span>
                        ) : (
                          <span style={{ color: '#ef4444', fontSize: '0.875rem' }}>No HOD Assigned</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
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
