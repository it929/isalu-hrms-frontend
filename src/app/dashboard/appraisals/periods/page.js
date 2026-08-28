"use client";

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Calendar, 
  Plus, 
  Send, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  X, 
  TrendingUp, 
  Users, 
  Clock, 
  ShieldAlert,
  Play
} from 'lucide-react';
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

export default function AppraisalPeriodsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dispatchingId, setDispatchingId] = useState(null);
  const [periods, setPeriods] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [toast, setToast] = useState(null);

  // New Cycle Form
  const [title, setTitle] = useState('');
  const [reviewType, setReviewType] = useState('annual');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selfDeadline, setSelfDeadline] = useState('');
  const [appraiserDeadline, setAppraiserDeadline] = useState('');
  const [description, setDescription] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [autoDispatch, setAutoDispatch] = useState(true);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const [pRes, tRes] = await Promise.all([
        axios.get(`${API_BASE}/appraisals/periods`, { headers: buildHeaders() }),
        axios.get(`${API_BASE}/appraisals/templates`, { headers: buildHeaders() }),
      ]);

      if (pRes.data.status === 'success') setPeriods(pRes.data.data || []);
      if (tRes.data.status === 'success') setTemplates(tRes.data.data || []);
    } catch (err) {
      console.error('Error loading periods', err);
      showToast('Failed to load appraisal cycles', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateCycle = async () => {
    if (!title || !startDate || !endDate || !selfDeadline || !appraiserDeadline) {
      showToast('Please fill in all cycle dates and title', 'error');
      return;
    }

    setSaving(true);
    try {
      const res = await axios.post(
        `${API_BASE}/appraisals/periods`,
        {
          title,
          review_type: reviewType,
          start_date: startDate,
          end_date: endDate,
          self_review_deadline: selfDeadline,
          appraiser_review_deadline: appraiserDeadline,
          description,
          template_id: selectedTemplateId || null,
          auto_dispatch: autoDispatch,
        },
        { headers: buildHeaders() }
      );

      if (res.data.status === 'success') {
        showToast('Appraisal review cycle launched successfully.');
        setShowModal(false);
        loadData();
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to create review cycle', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDispatch = async (periodId) => {
    const confirmDispatch = confirm('Are you sure you want to initialize appraisal forms for all active staff for this cycle?');
    if (!confirmDispatch) return;

    setDispatchingId(periodId);
    try {
      const res = await axios.post(
        `${API_BASE}/appraisals/periods/${periodId}/dispatch`,
        {},
        { headers: buildHeaders() }
      );

      if (res.data.status === 'success') {
        showToast(res.data.message);
        loadData();
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Dispatch failed', 'error');
    } finally {
      setDispatchingId(null);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Appraisal Review Cycles</h1>
          <p className={styles.subtitle}>
            Schedule annual, mid-year, and probationary review periods, define evaluation deadlines, and dispatch questionnaires.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowModal(true)}
          className={styles.btnNew}
        >
          <Plus size={18} />
          Launch New Review Cycle
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '4rem' }}>
          <Loader2 size={32} className="animate-spin text-blue-600" style={{ margin: '0 auto' }} />
        </div>
      ) : periods.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem', color: '#64748b', background: '#ffffff', borderRadius: '1rem', border: '1px solid #e2e8f0' }}>
          <Calendar size={48} color="#94a3b8" style={{ marginBottom: '1rem' }} />
          <h3>No Appraisal Cycles Found</h3>
          <p>Launch your first organization-wide review cycle to begin employee assessments.</p>
        </div>
      ) : (
        periods.map((period) => (
          <div key={period.id} className={styles.cycleCard}>
            <div className={styles.cycleTop}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <Calendar size={22} color="#2563eb" />
                  <h3 className={styles.cycleTitle}>{period.title}</h3>
                  <span style={{ fontSize: '0.75rem', fontWeight: '700', padding: '0.2rem 0.6rem', borderRadius: '1rem', background: period.status === 'active' ? '#dcfce7' : '#f1f5f9', color: period.status === 'active' ? '#15803d' : '#64748b', textTransform: 'capitalize' }}>
                    {period.status}
                  </span>
                </div>
                <div className={styles.cycleType}>Review Type: {period.review_type} • {period.description || 'All Hospital Staff'}</div>
              </div>

              <div>
                <button
                  type="button"
                  disabled={dispatchingId === period.id}
                  onClick={() => handleDispatch(period.id)}
                  className={styles.btnDispatch}
                >
                  {dispatchingId === period.id ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
                  Re-Dispatch / Add New Staff
                </button>
              </div>
            </div>

            {/* Progress Metrics */}
            <div className={styles.progressGrid}>
              <div className={styles.progressStat}>
                <h5>{period.stats?.total_assigned || 0}</h5>
                <p>Forms Dispatched</p>
              </div>
              <div className={styles.progressStat}>
                <h5 style={{ color: '#2563eb' }}>{period.stats?.self_submitted || 0}</h5>
                <p>Self-Reviews Completed</p>
              </div>
              <div className={styles.progressStat}>
                <h5 style={{ color: '#4f46e5' }}>{period.stats?.appraiser_completed || 0}</h5>
                <p>Appraiser Evaluated</p>
              </div>
              <div className={styles.progressStat}>
                <h5 style={{ color: '#16a34a' }}>{period.stats?.approved || 0}</h5>
                <p>HR Approved & Calibrated</p>
              </div>
            </div>

            <div className={styles.cycleDates}>
              <span><strong>Evaluation Window:</strong> {period.start_date} to {period.end_date}</span>
              <span><strong>Self-Review Due:</strong> {period.self_review_deadline}</span>
              <span><strong>Appraiser Due:</strong> {period.appraiser_review_deadline}</span>
            </div>
          </div>
        ))
      )}

      {/* Launch Cycle Modal */}
      <AnimatePresence>
        {showModal && (
          <div className={styles.modalBackdrop}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={styles.modalContent}
            >
              <div className={styles.modalHeader}>
                <h2 style={{ margin: 0, fontSize: '1.35rem', fontWeight: '700' }}>Launch Appraisal Review Cycle</h2>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  <X size={24} color="#64748b" />
                </button>
              </div>

              <div className={styles.modalBody}>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Cycle Title:</label>
                  <input
                    type="text"
                    placeholder="e.g. 2026 Annual Staff Performance Appraisal"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className={styles.input}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                  <div>
                    <label className={styles.label}>Review Cycle Type:</label>
                    <select
                      value={reviewType}
                      onChange={(e) => setReviewType(e.target.value)}
                      className={styles.input}
                    >
                      <option value="annual">Annual Review</option>
                      <option value="mid_year">Mid-Year Review</option>
                      <option value="quarterly">Quarterly Review</option>
                      <option value="probation">Probationary Review</option>
                    </select>
                  </div>

                  <div>
                    <label className={styles.label}>Default Template:</label>
                    <select
                      value={selectedTemplateId}
                      onChange={(e) => setSelectedTemplateId(e.target.value)}
                      className={styles.input}
                    >
                      <option value="">Default Standard Template</option>
                      {templates.map(t => (
                        <option key={t.id} value={t.id}>{t.title}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                  <div>
                    <label className={styles.label}>Period Start Date:</label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className={styles.input}
                    />
                  </div>
                  <div>
                    <label className={styles.label}>Period End Date:</label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className={styles.input}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
                  <div>
                    <label className={styles.label}>Self-Review Submission Deadline:</label>
                    <input
                      type="date"
                      value={selfDeadline}
                      onChange={(e) => setSelfDeadline(e.target.value)}
                      className={styles.input}
                    />
                  </div>
                  <div>
                    <label className={styles.label}>Appraiser Evaluation Deadline:</label>
                    <input
                      type="date"
                      value={appraiserDeadline}
                      onChange={(e) => setAppraiserDeadline(e.target.value)}
                      className={styles.input}
                    />
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                  <input
                    type="checkbox"
                    id="autoDispatch"
                    checked={autoDispatch}
                    onChange={(e) => setAutoDispatch(e.target.checked)}
                    style={{ width: '18px', height: '18px' }}
                  />
                  <label htmlFor="autoDispatch" style={{ fontSize: '0.85rem', color: '#334155', cursor: 'pointer' }}>
                    <strong>Auto-Dispatch:</strong> Automatically generate appraisal forms for all active staff upon creation.
                  </label>
                </div>
              </div>

              <div className={styles.modalFooter}>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  style={{ padding: '0.65rem 1.25rem', background: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '0.5rem', fontWeight: '600', cursor: 'pointer' }}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  disabled={saving}
                  onClick={handleCreateCycle}
                  className={styles.btnNew}
                >
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                  Launch Review Cycle
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
