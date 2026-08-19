"use client";

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, AlertCircle, CheckCircle2, UserCheck, Shield, Calendar, ToggleLeft, ToggleRight, Building2, User } from 'lucide-react';
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

const HR_APPROVAL_OPTIONS = [
  { id: 'hr_approve_leave', label: 'HR Leave & LOA Approvals' },
  { id: 'hr_approve_loan', label: 'HR Loan & Coop Loan Approvals' },
  { id: 'hr_approve_iou', label: 'HR IOU / Salary Advance Approvals' },
  { id: 'hr_approve_refund', label: 'HR Refund Approvals' },
  { id: 'hr_approve_resignation', label: 'HR Resignation Approvals' },
  { id: 'hr_approve_appraisal', label: 'HR Staff Appraisal Approvals' },
];

const FINANCE_APPROVAL_OPTIONS = [
  { id: 'finance_approve_iou', label: 'Finance IOU / Salary Advance Approvals' },
  { id: 'finance_approve_loan', label: 'Finance Loan & Coop Loan Approvals' },
  { id: 'finance_approve_refund', label: 'Finance Refund Approvals' },
  { id: 'finance_approve_payroll', label: 'Finance Payroll Authorization & Disbursement' },
  { id: 'finance_approve_resignation', label: 'Finance Resignation Approvals' },
];

const AUDIT_APPROVAL_OPTIONS = [
  { id: 'audit_approve_iou', label: 'Audit IOU / Salary Advance Approvals' },
  { id: 'audit_approve_loan', label: 'Audit Loan & Coop Loan Approvals' },
  { id: 'audit_approve_refund', label: 'Audit Refund Approvals' },
  { id: 'audit_approve_payroll', label: 'Audit Payroll Verification & Audits' },
  { id: 'audit_approve_resignation', label: 'Audit Resignation Approvals' },
];

const HOD_APPROVAL_OPTIONS = [
  { id: 'approve_leave', label: 'HOD Leave & LOA Approvals' },
  { id: 'approve_iou', label: 'HOD IOU Approvals' },
  { id: 'approve_refund', label: 'HOD Refund Approvals' },
  { id: 'approve_resignation', label: 'HOD Resignation Approvals' },
  { id: 'approve_loan', label: 'HOD Loan Approvals' },
];

export default function HODRoleDelegation() {
  const [roleInfo, setRoleInfo] = useState({
    isHrHead: false,
    isFinanceHead: false,
    isAuditHead: false,
    isHod: false,
    isSuperAdmin: false,
    departmentName: '',
  });

  const [staff, setStaff] = useState([]);
  const [delegations, setDelegations] = useState([]);
  const [assignedSubmodules, setAssignedSubmodules] = useState([]);
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
        setAssignedSubmodules(res.data.assignedSubmodules || []);
        setRoleInfo({
          isHrHead: !!res.data.isHrHead,
          isFinanceHead: !!res.data.isFinanceHead,
          isAuditHead: !!res.data.isAuditHead,
          isHod: !!res.data.isHod,
          isSuperAdmin: !!res.data.isSuperAdmin,
          departmentName: res.data.departmentName || '',
        });
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

  // Get active approval options based on user role
  const getActiveApprovalSections = () => {
    const sections = [];

    if (roleInfo.isHrHead || roleInfo.isSuperAdmin) {
      sections.push({
        title: 'HR HEAD Approval Roles',
        badge: 'HR Executive Authority',
        options: HR_APPROVAL_OPTIONS
      });
    }

    if (roleInfo.isFinanceHead || roleInfo.isSuperAdmin) {
      sections.push({
        title: 'FINANCE HEAD Approval Roles',
        badge: 'Finance Executive Authority',
        options: FINANCE_APPROVAL_OPTIONS
      });
    }

    if (roleInfo.isAuditHead || roleInfo.isSuperAdmin) {
      sections.push({
        title: 'AUDIT HEAD Approval Roles',
        badge: 'Audit & Compliance Authority',
        options: AUDIT_APPROVAL_OPTIONS
      });
    }

    // If HOD or Head of a department or Super Admin, always show HOD Approval Roles
    if (roleInfo.isHod || roleInfo.isHrHead || roleInfo.isFinanceHead || roleInfo.isAuditHead || roleInfo.isSuperAdmin) {
      sections.push({
        title: 'HOD Approval Roles',
        badge: 'Department HOD Authority',
        options: HOD_APPROVAL_OPTIONS
      });
    }

    return sections;
  };

  const activeApprovalSections = getActiveApprovalSections();

  const handleToggleAllPermissions = () => {
    const allSectionOptionIds = activeApprovalSections.flatMap(s => s.options.map(o => o.id));
    const allSubmoduleIds = assignedSubmodules.map(s => s.submoduleID);
    const allIds = [...allSectionOptionIds, ...allSubmoduleIds];

    if (selectedPermissions.length === allIds.length && allIds.length > 0) {
      setSelectedPermissions([]);
    } else {
      setSelectedPermissions(allIds);
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
    const allOpts = [
      ...HR_APPROVAL_OPTIONS,
      ...FINANCE_APPROVAL_OPTIONS,
      ...AUDIT_APPROVAL_OPTIONS,
      ...HOD_APPROVAL_OPTIONS,
    ];
    const opt = allOpts.find(a => a.id === permId);
    if (opt) return opt.label;

    const id = parseInt(permId);
    const sub = assignedSubmodules.find(s => s.submoduleID === id);
    return sub ? `${sub.modulename} > ${sub.submodulename}` : `Submodule #${permId}`;
  };

  // Group other submodules by module name
  const groupedSubmodules = assignedSubmodules.reduce((acc, sub) => {
    const key = sub.modulename || 'General';
    if (!acc[key]) acc[key] = [];
    acc[key].push(sub);
    return acc;
  }, {});

  const getHeadshipTitle = () => {
    if (roleInfo.isSuperAdmin) return 'Super Administrator';
    const titles = [];
    if (roleInfo.isHrHead) titles.push('HR Head');
    if (roleInfo.isFinanceHead) titles.push('Finance Head');
    if (roleInfo.isAuditHead) titles.push('Audit Head');
    if (roleInfo.isHod) titles.push('HOD');
    return titles.length > 0 ? titles.join(' & ') : 'Department Head';
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      {/* Page Header */}
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h1 style={{ color: 'var(--primary)', marginBottom: '0.35rem', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <Shield size={28} />
              Role Delegation
            </h1>
            <p style={{ color: 'var(--secondary)', fontSize: '0.95rem' }}>
              Temporarily or permanently delegate your authority to trusted staff members in your department.
            </p>
          </div>
          {(roleInfo.departmentName || getHeadshipTitle()) && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
              background: 'var(--card-bg, #ffffff)',
              border: '1px solid var(--border)',
              padding: '0.5rem 1rem',
              borderRadius: '8px',
              fontSize: '0.85rem'
            }}>
              <Building2 size={16} style={{ color: 'var(--primary)' }} />
              <div>
                <strong style={{ color: 'var(--foreground)' }}>{roleInfo.departmentName || 'Administration'}</strong>
                <span style={{ color: 'var(--secondary)', marginLeft: '0.4rem' }}>({getHeadshipTitle()})</span>
              </div>
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '2rem', alignItems: 'start' }}>
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
                <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                  Select Delegate Staff {roleInfo.departmentName ? `(${roleInfo.departmentName})` : ''}
                </label>
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
                  <option value="">-- Select Staff from Your Department --</option>
                  {staff.map((s) => (
                    <option key={s.ID} value={s.ID}>
                      {s.staffId || s.ID ? `[ID: ${s.staffId || s.ID}] ` : ''}{s.surname} {s.first_name} {s.othernames || ''}
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
                    Select / Clear All
                  </button>
                </div>
                
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1.25rem',
                  border: '1px solid var(--border)',
                  padding: '1rem',
                  borderRadius: 'var(--radius)',
                  background: 'rgba(0,0,0,0.02)',
                  maxHeight: '400px',
                  overflowY: 'auto'
                }}>
                  
                  {/* Dynamic Head Approval Role Sections */}
                  {activeApprovalSections.map((section, sIdx) => (
                    <div key={sIdx} style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                      <div style={{
                        fontSize: '0.8rem',
                        fontWeight: 'bold',
                        color: 'var(--primary)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        borderBottom: '1px solid var(--border)',
                        paddingBottom: '0.35rem'
                      }}>
                        <span>{section.title}</span>
                        <span style={{ fontSize: '0.7rem', padding: '0.1rem 0.4rem', borderRadius: '4px', background: 'rgba(99, 102, 241, 0.1)', color: 'var(--primary)' }}>
                          {section.badge}
                        </span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem', paddingLeft: '0.5rem' }}>
                        {section.options.map((opt) => (
                          <label key={opt.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', fontSize: '0.9rem' }}>
                            <input
                              type="checkbox"
                              checked={selectedPermissions.includes(opt.id)}
                              onChange={() => handlePermissionChange(opt.id)}
                              style={{ width: '16px', height: '16px', accentColor: 'var(--primary)' }}
                            />
                            <span style={{ fontWeight: '500' }}>{opt.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}

                  {/* Assigned System Modules & Submodules */}
                  {Object.keys(groupedSubmodules).length > 0 && (
                    <div style={{ marginTop: '0.5rem' }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: 'bold', color: 'var(--secondary)', textTransform: 'uppercase', marginBottom: '0.5rem' }}>
                        System Module Permissions
                      </div>
                      {Object.keys(groupedSubmodules).map((moduleName) => (
                        <div key={moduleName} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '0.75rem' }}>
                          <div style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--foreground)' }}>
                            {moduleName}
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', paddingLeft: '0.5rem' }}>
                            {groupedSubmodules[moduleName].map((sub) => (
                              <label key={sub.submoduleID} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer', fontSize: '0.85rem' }}>
                                <input
                                  type="checkbox"
                                  checked={selectedPermissions.includes(sub.submoduleID)}
                                  onChange={() => handlePermissionChange(sub.submoduleID)}
                                  style={{ width: '16px', height: '16px', accentColor: 'var(--primary)' }}
                                />
                                <span>{sub.submodulename}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

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
                    let decodedPermissions = [];
                    try {
                      decodedPermissions = typeof del.permissions === 'string' ? JSON.parse(del.permissions) : (del.permissions || []);
                    } catch {
                      decodedPermissions = [];
                    }

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
                          <div>{del.surname} {del.first_name} {del.othernames || ''}</div>
                          {(del.staffId || del.delegate_staff_id) && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--secondary)' }}>Staff ID: #{del.staffId || del.delegate_staff_id}</div>
                          )}
                        </td>
                        <td style={{ padding: '1rem 0.75rem' }}>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                            {decodedPermissions.map((p, pIdx) => (
                              <span key={pIdx} style={{
                                fontSize: '0.75rem',
                                padding: '0.2rem 0.5rem',
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
                        <td style={{ padding: '1rem 0.75rem', color: 'var(--secondary)', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
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
