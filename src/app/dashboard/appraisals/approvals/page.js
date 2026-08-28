"use client";

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ShieldCheck, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Search, 
  Filter, 
  TrendingUp, 
  Award, 
  RotateCcw, 
  X, 
  Sparkles,
  ArrowRight,
  Send
} from 'lucide-react';
import NairaSign from '../../../../components/ui/NairaSign';
import axios from 'axios';
import styles from './page.module.css';

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

export default function HRCalibrationApprovalsPage() {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submissions, setSubmissions] = useState([]);
  const [stats, setStats] = useState({ total: 0, grade_A: 0, grade_B: 0, grade_C: 0, grade_D: 0, average_score: 0 });
  const [searchTerm, setSearchTerm] = useState('');
  const [gradeFilter, setGradeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Calibration Modal
  const [selectedSub, setSelectedSub] = useState(null);
  const [calibratedScore, setCalibratedScore] = useState('');
  const [hrComments, setHrComments] = useState('');
  const [recommendationType, setRecommendationType] = useState('');
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const loadModerationData = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/appraisals/moderation-list`, { headers: buildHeaders() });
      if (res.data.status === 'success') {
        setSubmissions(res.data.data || []);
        setStats(res.data.stats || {});
      }
    } catch (err) {
      console.error('Moderation fetch error', err);
      showToast('Failed to load appraisal moderation data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadModerationData();
  }, []);

  const openCalibration = (item) => {
    setSelectedSub(item);
    setCalibratedScore(item.final_weighted_score || item.appraiser_total_score || '');
    setHrComments(item.hr_comments || '');
    setRecommendationType(item.recommendation_type || 'none');
  };

  const handleModerate = async (action) => {
    if (!selectedSub) return;
    setSubmitting(true);
    try {
      const res = await axios.post(
        `${API_BASE}/appraisals/form/${selectedSub.id}/calibrate`,
        {
          action,
          final_weighted_score: calibratedScore,
          hr_comments: hrComments,
          recommendation_type: recommendationType,
        },
        { headers: buildHeaders() }
      );

      if (res.data.status === 'success') {
        showToast(res.data.message);
        setSelectedSub(null);
        loadModerationData();
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Error calibrating appraisal', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handlePushAction = async (sub, actionType) => {
    const confirmPush = confirm(`Are you sure you want to push this ${actionType} recommendation directly into the HR system?`);
    if (!confirmPush) return;

    try {
      const res = await axios.post(
        `${API_BASE}/appraisals/form/${sub.id}/push-action`,
        { action_type: actionType },
        { headers: buildHeaders() }
      );
      if (res.data.status === 'success') {
        showToast(res.data.message);
        loadModerationData();
      }
    } catch (err) {
      showToast('Failed to push action', 'error');
    }
  };

  const filtered = submissions.filter(item => {
    const name = `${item.staff_surname} ${item.staff_firstname}`.toLowerCase();
    const fileNo = (item.staff_file_no || '').toLowerCase();
    const dept = (item.department_name || '').toLowerCase();
    const matchesSearch = name.includes(searchTerm.toLowerCase()) || fileNo.includes(searchTerm.toLowerCase()) || dept.includes(searchTerm.toLowerCase());
    const matchesGrade = gradeFilter === 'all' || (item.performance_grade && item.performance_grade.startsWith(gradeFilter));
    const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
    return matchesSearch && matchesGrade && matchesStatus;
  });

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>HR Calibration & Approvals Hub</h1>
        <p className={styles.subtitle}>
          Moderate department evaluations, adjust calibration curves, and push approved merit recommendations to Payroll & Records.
        </p>
      </div>

      {/* Bell Curve / Stats Summary */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <h4 style={{ color: '#2563eb' }}>{stats.total}</h4>
          <p>Total Staff Appraised</p>
        </div>
        <div className={styles.statCard}>
          <h4 style={{ color: '#16a34a' }}>{stats.grade_A}</h4>
          <p>Grade A (Exceptional 80%+)</p>
        </div>
        <div className={styles.statCard}>
          <h4 style={{ color: '#4f46e5' }}>{stats.grade_B}</h4>
          <p>Grade B (Exceeds 70-79%)</p>
        </div>
        <div className={styles.statCard}>
          <h4 style={{ color: '#d97706' }}>{stats.grade_C}</h4>
          <p>Grade C (Meets 50-69%)</p>
        </div>
        <div className={styles.statCard}>
          <h4 style={{ color: '#dc2626' }}>{stats.grade_D}</h4>
          <p>Grade D (Below 50% / PIP)</p>
        </div>
        <div className={styles.statCard}>
          <h4 style={{ color: '#0f172a' }}>{stats.average_score}%</h4>
          <p>Hospital Average Score</p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className={styles.filterCard}>
        <div className={styles.searchBox}>
          <Search size={18} color="#94a3b8" />
          <input
            type="text"
            placeholder="Search by staff name, file number, or department..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <select
            value={gradeFilter}
            onChange={(e) => setGradeFilter(e.target.value)}
            className={styles.filterSelect}
          >
            <option value="all">All Performance Grades</option>
            <option value="A">Grade A (80%+)</option>
            <option value="B">Grade B (70-79%)</option>
            <option value="C">Grade C (50-69%)</option>
            <option value="D">Grade D (&lt;50%)</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className={styles.filterSelect}
          >
            <option value="all">All Submission Statuses</option>
            <option value="pending_hr_review">Pending HR Moderation</option>
            <option value="approved">Approved</option>
            <option value="acknowledged">Acknowledged by Staff</option>
          </select>
        </div>
      </div>

      {/* Submissions Table */}
      <div className={styles.tableCard}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Staff Member</th>
              <th>Department</th>
              <th>Appraiser</th>
              <th>Final Score</th>
              <th>Grade</th>
              <th>Recommendation</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '3rem' }}>
                  <Loader2 size={28} className="animate-spin text-blue-600" style={{ margin: '0 auto' }} />
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
                  No appraisal records found matching your filters.
                </td>
              </tr>
            ) : (
              filtered.map((item) => (
                <tr key={item.id}>
                  <td>
                    <div style={{ fontWeight: '600', color: '#1e293b' }}>{item.staff_surname} {item.staff_firstname}</div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{item.staff_file_no}</div>
                  </td>
                  <td>{item.department_name || '—'}</td>
                  <td>
                    {item.appraiser_surname ? `${item.appraiser_surname} ${item.appraiser_firstname}` : '—'}
                  </td>
                  <td>
                    <span style={{ fontWeight: '800', color: '#2563eb' }}>
                      {item.final_weighted_score !== null ? `${item.final_weighted_score}%` : (item.appraiser_total_score ? `${item.appraiser_total_score}%` : '—')}
                    </span>
                  </td>
                  <td>
                    {item.performance_grade ? (
                      <span className={`${styles.gradeBadge} ${
                        item.performance_grade.startsWith('A') ? styles.gradeA :
                        item.performance_grade.startsWith('B') ? styles.gradeB :
                        item.performance_grade.startsWith('C') ? styles.gradeC :
                        styles.gradeD
                      }`}>
                        {item.performance_grade}
                      </span>
                    ) : '—'}
                  </td>
                  <td>
                    <span style={{ fontSize: '0.8rem', fontWeight: '600', textTransform: 'capitalize', color: '#475569' }}>
                      {item.recommendation_type !== 'none' ? item.recommendation_type : 'None'}
                    </span>
                  </td>
                  <td>
                    <span className={styles.statusBadge} style={{
                      background: item.status === 'approved' || item.status === 'acknowledged' ? '#dcfce7' : '#fef3c7',
                      color: item.status === 'approved' || item.status === 'acknowledged' ? '#166534' : '#92400e'
                    }}>
                      {item.status.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      type="button"
                      onClick={() => openCalibration(item)}
                      className={styles.btnCalibrate}
                    >
                      <ShieldCheck size={14} />
                      Calibrate & Approve
                    </button>

                    {item.status === 'approved' && item.recommendation_type === 'increment' && (
                      <button
                        type="button"
                        onClick={() => handlePushAction(item, 'increment')}
                        className={styles.btnPushAction}
                        title="Push to Salary Increment Module"
                      >
                        <NairaSign size={14} />
                        Push Increment
                      </button>
                    )}

                    {item.status === 'approved' && item.performance_grade?.startsWith('A') && (
                      <button
                        type="button"
                        onClick={() => handlePushAction(item, 'commendation')}
                        className={styles.btnPushAction}
                        style={{ background: '#6366f1' }}
                        title="Push to Commendation Register"
                      >
                        <Award size={14} />
                        Commend
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Moderation & Calibration Modal */}
      <AnimatePresence>
        {selectedSub && (
          <div className={styles.modalBackdrop}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={styles.modalContent}
            >
              <div className={styles.modalHeader}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '1.35rem', fontWeight: '700' }}>
                    HR Moderation: {selectedSub.staff_surname} {selectedSub.staff_firstname}
                  </h2>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: '#64748b' }}>
                    File No: {selectedSub.staff_file_no} • Department: {selectedSub.department_name}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedSub(null)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  <X size={24} color="#64748b" />
                </button>
              </div>

              <div className={styles.modalBody}>
                {/* Summary Score Card */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', background: '#f8fafc', padding: '1.25rem', borderRadius: '0.75rem', marginBottom: '1.5rem' }}>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>Staff Self-Rating:</span>
                    <span style={{ fontSize: '1.25rem', fontWeight: '800', color: '#2563eb' }}>{selectedSub.self_total_score || '—'}%</span>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>Appraiser Raw Score:</span>
                    <span style={{ fontSize: '1.25rem', fontWeight: '800', color: '#4f46e5' }}>{selectedSub.appraiser_total_score || '—'}%</span>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>Appraiser Recommendation:</span>
                    <span style={{ fontSize: '0.95rem', fontWeight: '700', color: '#1e293b', textTransform: 'capitalize' }}>
                      {selectedSub.recommendation_type || 'None'}
                    </span>
                  </div>
                </div>

                {/* Qualitative Highlights */}
                <div style={{ marginBottom: '1.5rem', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '0.75rem', padding: '1rem' }}>
                  <div style={{ marginBottom: '0.75rem' }}>
                    <strong style={{ fontSize: '0.85rem', color: '#1e293b' }}>Staff Accomplishments: </strong>
                    <span style={{ fontSize: '0.85rem', color: '#475569' }}>{selectedSub.staff_key_accomplishments || 'None listed.'}</span>
                  </div>
                  <div style={{ marginBottom: '0.75rem' }}>
                    <strong style={{ fontSize: '0.85rem', color: '#1e293b' }}>Appraiser Commendations & Strengths: </strong>
                    <span style={{ fontSize: '0.85rem', color: '#475569' }}>{selectedSub.appraiser_strengths || 'None listed.'}</span>
                  </div>
                  <div>
                    <strong style={{ fontSize: '0.85rem', color: '#1e293b' }}>Areas for Growth / PIP: </strong>
                    <span style={{ fontSize: '0.85rem', color: '#475569' }}>{selectedSub.appraiser_areas_for_growth || 'None listed.'}</span>
                  </div>
                </div>

                {/* Calibration Inputs */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.4rem', color: '#334155' }}>
                      Calibrated Final Weighted Score (0 - 100%):
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={calibratedScore}
                      onChange={(e) => setCalibratedScore(e.target.value)}
                      style={{ width: '100%', padding: '0.6rem', border: '1px solid #cbd5e1', borderRadius: '0.5rem', fontWeight: '700' }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.4rem', color: '#334155' }}>
                      Approved Action / Recommendation:
                    </label>
                    <select
                      value={recommendationType}
                      onChange={(e) => setRecommendationType(e.target.value)}
                      style={{ width: '100%', padding: '0.6rem', border: '1px solid #cbd5e1', borderRadius: '0.5rem' }}
                    >
                      <option value="none">No Specific Action</option>
                      <option value="increment">Merit Salary Increment</option>
                      <option value="promotion">Promotion to Next Level</option>
                      <option value="confirmation">Probation Confirmation</option>
                      <option value="pip">Performance Improvement Plan</option>
                      <option value="training">Sponsored Training</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.4rem', color: '#334155' }}>
                    HR Calibration Comments / Committee Minutes:
                  </label>
                  <textarea
                    placeholder="Enter HR moderation rationale, committee recommendations, or audit notes..."
                    value={hrComments}
                    onChange={(e) => setHrComments(e.target.value)}
                    style={{ width: '100%', padding: '0.6rem', border: '1px solid #cbd5e1', borderRadius: '0.5rem', minHeight: '80px' }}
                  />
                </div>
              </div>

              <div className={styles.modalFooter}>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => handleModerate('reject')}
                  style={{ padding: '0.65rem 1.25rem', background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', fontWeight: '600', borderRadius: '0.5rem', cursor: 'pointer' }}
                >
                  Return to Appraiser for Correction
                </button>

                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => handleModerate('approve')}
                  style={{ padding: '0.65rem 1.5rem', background: '#16a34a', border: 'none', color: '#ffffff', fontWeight: '600', borderRadius: '0.5rem', cursor: 'pointer' }}
                >
                  {submitting ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                  Calibrate & Final Approve
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className={`${styles.toast} ${toast.type === 'error' ? styles.toastError : styles.toastSuccess}`}
          >
            {toast.type === 'error' ? <AlertCircle size={20} /> : <CheckCircle2 size={20} />}
            <span>{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
