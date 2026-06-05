"use client";

import { useState, useEffect, useCallback } from 'react';
import { getCache, setCache } from '../../../../utils/dataCache';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import {
  Users,
  UserCheck,
  ArrowRightLeft,
  Save,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertCircle,
  Building2,
  FileText
} from 'lucide-react';
import CustomSelect from '../../../../components/ui/CustomSelect';
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

export default function StaffStatusPage() {
  const cachedData = getCache('staff-status');
  const [activeTab, setActiveTab] = useState('update'); // 'update' or 'pending'
  const [loading, setLoading] = useState(!cachedData);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState(null);

  // Metadata
  const [staffList, setStaffList] = useState(cachedData?.staffList || []);
  const [divisions, setDivisions] = useState(cachedData?.divisions || []);
  const [curDivision, setCurDivision] = useState(cachedData?.curDivision || '');
  
  // Update State
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [staffDetails, setStaffDetails] = useState(null);
  const [newStatus, setNewStatus] = useState('');

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4500);
  }, []);

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/hr/staff-status`, { headers: buildHeaders() });
      if (res.data.status === 'success') {
        const staffOpts = res.data.staffList.map(s => ({
          id: s.ID,
          name: `${s.surname} ${s.first_name} ${s.othernames || ''}`.trim()
        }));
        const divOpts = res.data.divisions.map(d => ({
          id: d.divisionID,
          name: d.division
        }));
        const cachePayload = {
          staffList: staffOpts,
          divisions: divOpts,
          curDivision: res.data.curDivision
        };
        setCache('staff-status', cachePayload);
        setStaffList(staffOpts);
        setDivisions(divOpts);
        setCurDivision(res.data.curDivision);
      } else {
        showToast(res.data.message || 'Failed to load metadata.', 'error');
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

  // When a staff is selected from the dropdown, fetch details
  useEffect(() => {
    if (!selectedStaffId) {
      setStaffDetails(null);
      return;
    }
    const fetchStaffDetails = async () => {
      try {
        const res = await axios.post(`${API_BASE}/hr/staff-status/find-staff`, { staffName: selectedStaffId }, { headers: buildHeaders() });
        if (res.data.status === 'success') {
          setStaffDetails(res.data.data);
        }
      } catch (err) {
        showToast('Failed to fetch staff details.', 'error');
      }
    };
    fetchStaffDetails();
  }, [selectedStaffId, showToast]);

  const handleUpdateSubmit = async (e) => {
    e.preventDefault();
    if (!staffDetails) return showToast('Please select a staff member.', 'warning');
    if (!newStatus) return showToast('Please select a new status.', 'warning');

    setSubmitting(true);
    try {
      const payload = {
        fileNo: staffDetails.fileNo || staffDetails.ID,
        action: 'Update Staff Record',
        staffStatus: newStatus
      };

      const res = await axios.post(`${API_BASE}/hr/staff-status/update`, payload, { headers: buildHeaders() });
      
      if (res.data.status === 'success') {
        if (typeof window !== 'undefined') {
          sessionStorage.removeItem('hrms_employee_records_cache');
        }
        showToast(res.data.message, 'success');
        setSelectedStaffId('');
        setStaffDetails(null);
        setNewStatus('');
      } else {
        showToast(res.data.message || 'Update failed.', 'error');
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Server error during update.', 'error');
    } finally {
      setSubmitting(false);
    }
  };



  const statusOptions = [
    { id: 'active service', name: 'Active Service' },
    { id: 'contract service', name: 'Contract Service' },
    { id: 'dismissal', name: 'Dismissal' },
    { id: 'maternity leave', name: 'Maternity Leave' },
    { id: 'study leave', name: 'Study Leave' },
    { id: 'resignation', name: 'Resignation' },
    { id: 'retirement', name: 'Retirement' },
    { id: 'temporary suspension', name: 'Temporary Suspension' },
    { id: 'deceased', name: 'Deceased' },
    { id: 'termination', name: 'Termination' }
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={styles.container}>
      <div className={styles.header}>
        <h1>Update Staff Status</h1>
        <p>Manage employee operational status.</p>
      </div>



      <AnimatePresence mode="wait">
          <motion.div key="update" initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -10, opacity: 0 }}>
            <div className={styles.card}>
              <h2 className={styles.cardTitle}><Users size={20} /> Select Staff</h2>
              <div style={{ maxWidth: '400px', marginBottom: '2rem' }}>
                <CustomSelect
                  name="staffName"
                  label="Search Staff"
                  options={staffList}
                  value={selectedStaffId}
                  onChange={(e) => setSelectedStaffId(e.target.value)}
                  placeholder={loading ? "Loading staff data..." : "Type to search..."}
                  disabled={loading}
                />
              </div>

              {staffDetails && (
                <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }}>
                  <div className={styles.infoGrid}>
                    <div className={styles.infoItem}>
                      <span className={styles.infoLabel}><FileText size={14} style={{display:'inline', marginRight:'4px'}}/> File Number</span>
                      <span className={styles.infoValue}>{staffDetails.fileNo}</span>
                    </div>
                    <div className={styles.infoItem}>
                      <span className={styles.infoLabel}><Building2 size={14} style={{display:'inline', marginRight:'4px'}}/> Company</span>
                      <span className={styles.infoValue}>{staffDetails.divisionName || 'N/A'}</span>
                    </div>
                    <div className={styles.infoItem}>
                      <span className={styles.infoLabel}>Status Value</span>
                      <span className={styles.infoValue} style={{textTransform: 'capitalize'}}>{staffDetails.status_value}</span>
                    </div>
                    <div className={styles.infoItem}>
                      <span className={styles.infoLabel}>System Status</span>
                      <span className={`${styles.badge} ${staffDetails.staff_status === 1 ? styles.badgeActive : styles.badgeInactive}`}>
                        {staffDetails.staff_status === 1 ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>

                  <form onSubmit={handleUpdateSubmit} style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border)' }}>
                    <div className={styles.formGrid}>
                        <div className={styles.formGroup}>
                          <CustomSelect
                            name="staffStatus"
                            label="New Staff Status"
                            options={statusOptions}
                            value={newStatus}
                            onChange={(e) => setNewStatus(e.target.value)}
                            placeholder="Select new status..."
                            searchable={false}
                          />
                        </div>
                    </div>

                    <button type="submit" className={styles.btnSubmit} disabled={submitting}>
                      {submitting ? <Loader2 size={18} className={styles.spinner} /> : <Save size={18} />}
                      Update Staff Record
                    </button>
                  </form>
                </motion.div>
              )}
            </div>
          </motion.div>

      </AnimatePresence>

      <AnimatePresence>
        {toast && (
          <motion.div
            className={`${styles.toast} ${
              toast.type === 'success' ? styles.toastSuccess : 
              toast.type === 'warning' ? styles.toastWarning : styles.toastError
            }`}
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
          >
            {toast.type === 'success' ? <CheckCircle2 size={20} className={styles.toastSuccessIcon} /> : 
             toast.type === 'warning' ? <AlertCircle size={20} style={{color: '#f59e0b'}}/> :
             <AlertCircle size={20} className={styles.toastErrorIcon} />}
            <span>{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
