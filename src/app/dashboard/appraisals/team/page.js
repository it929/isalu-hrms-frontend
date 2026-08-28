"use client";

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, 
  TrendingUp, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Search, 
  Filter, 
  Eye, 
  X, 
  Send, 
  RotateCcw, 
  Save, 
  Award,
  Sparkles,
  ChevronRight
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

export default function TeamAppraisalsPage() {
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [teamList, setTeamList] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Modal / Assessment State
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [formDetail, setFormDetail] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);
  
  // Appraiser Inputs
  const [appraiserScores, setAppraiserScores] = useState({});
  const [strengths, setStrengths] = useState('');
  const [growthAreas, setGrowthAreas] = useState('');
  const [recommendationType, setRecommendationType] = useState('none');
  const [recommendationDetails, setRecommendationDetails] = useState('');
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const loadTeamQueue = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/appraisals/team-queue`, { headers: buildHeaders() });
      if (res.data.status === 'success') {
        setTeamList(res.data.data || []);
      }
    } catch (err) {
      console.error('Failed to load team queue', err);
      showToast('Failed to load team appraisals', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTeamQueue();
  }, []);

  const openEvaluationModal = async (submission) => {
    setSelectedSubmission(submission);
    setModalLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/appraisals/form/${submission.id}`, { headers: buildHeaders() });
      if (res.data.status === 'success') {
        const { submission: fullSub, categories } = res.data;
        setFormDetail({ submission: fullSub, categories });
        setStrengths(fullSub.appraiser_strengths || '');
        setGrowthAreas(fullSub.appraiser_areas_for_growth || '');
        setRecommendationType(fullSub.recommendation_type || 'none');
        setRecommendationDetails(fullSub.recommendation_details || '');

        const initScores = {};
        categories.forEach(cat => {
          cat.items.forEach(item => {
            initScores[item.id] = {
              appraiser_score: item.appraiser_score !== null ? item.appraiser_score : (item.self_score !== null ? item.self_score : ''),
              appraiser_comment: item.appraiser_comment || '',
            };
          });
        });
        setAppraiserScores(initScores);
      }
    } catch (err) {
      console.error('Failed to open form detail', err);
      showToast('Error opening appraisal evaluation', 'error');
    } finally {
      setModalLoading(false);
    }
  };

  // Compute live Appraiser score
  const computeAppraiserPercentage = () => {
    if (!formDetail) return 0;
    let totalWeightedScore = 0;
    let totalWeight = 0;

    formDetail.categories.forEach(cat => {
      cat.items.forEach(item => {
        const score = appraiserScores[item.id]?.appraiser_score;
        const weight = parseFloat(item.weight) || 1;
        const maxScore = item.max_score || 5;

        if (score !== '' && score !== undefined && score !== null) {
          totalWeightedScore += (parseFloat(score) / maxScore) * weight;
          totalWeight += weight;
        }
      });
    });

    if (totalWeight === 0) return 0;
    return Math.round((totalWeightedScore / totalWeight) * 100);
  };

  const getGrade = (pct) => {
    if (pct >= 80) return 'A (Exceptional)';
    if (pct >= 70) return 'B (Exceeds)';
    if (pct >= 50) return 'C (Meets)';
    return 'D (Unsatisfactory)';
  };

  const handleSaveAppraiserReview = async (isSubmit = false) => {
    if (!selectedSubmission) return;

    if (isSubmit) {
      // Ensure all items are scored
      let missingCount = 0;
      formDetail.categories.forEach(cat => {
        cat.items.forEach(item => {
          if (!appraiserScores[item.id]?.appraiser_score) missingCount++;
        });
      });

      if (missingCount > 0) {
        showToast(`Please score all metrics before submitting to HR (${missingCount} remaining).`, 'error');
        return;
      }
    }

    setSubmitting(true);
    try {
      const scoresPayload = Object.entries(appraiserScores).map(([criteria_item_id, val]) => ({
        criteria_item_id: parseInt(criteria_item_id, 10),
        appraiser_score: val.appraiser_score !== '' ? parseFloat(val.appraiser_score) : null,
        appraiser_comment: val.appraiser_comment || null,
      }));

      const res = await axios.post(
        `${API_BASE}/appraisals/form/${selectedSubmission.id}/save-appraiser`,
        {
          is_submit: isSubmit,
          appraiser_strengths: strengths,
          appraiser_areas_for_growth: growthAreas,
          recommendation_type: recommendationType,
          recommendation_details: recommendationDetails,
          scores: scoresPayload,
        },
        { headers: buildHeaders() }
      );

      if (res.data.status === 'success') {
        showToast(res.data.message);
        setSelectedSubmission(null);
        loadTeamQueue();
      }
    } catch (err) {
      console.error('Appraiser save error', err);
      showToast(err.response?.data?.message || 'Error submitting review', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReturnToStaff = async () => {
    if (!selectedSubmission) return;
    const reason = prompt('Please enter the reason for returning this appraisal to the employee:');
    if (!reason) return;

    setSubmitting(true);
    try {
      const res = await axios.post(
        `${API_BASE}/appraisals/form/${selectedSubmission.id}/return-to-staff`,
        { reason },
        { headers: buildHeaders() }
      );
      if (res.data.status === 'success') {
        showToast('Appraisal returned to employee for revision.');
        setSelectedSubmission(null);
        loadTeamQueue();
      }
    } catch (err) {
      showToast('Failed to return appraisal', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredTeam = teamList.filter(item => {
    const fullName = `${item.staff_surname || ''} ${item.staff_firstname || ''}`.toLowerCase();
    const fileNo = (item.staff_file_no || '').toLowerCase();
    const matchesSearch = fullName.includes(searchTerm.toLowerCase()) || fileNo.includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalAssigned = teamList.length;
  const readyForReview = teamList.filter(t => t.status === 'pending_appraiser').length;
  const pendingSelf = teamList.filter(t => t.status === 'pending_self_review').length;
  const completed = teamList.filter(t => ['pending_hr_review', 'approved', 'acknowledged'].includes(t.status)).length;
  const livePct = computeAppraiserPercentage();

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Staff Appraisals (Appraiser Evaluation Hub)</h1>
        <p className={styles.subtitle}>
          Review and score your team's self-evaluations, provide feedback, and recommend merit increments or training.
        </p>
      </div>

      {/* Metrics Header */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: '#2563eb' }}>
            <Users size={24} />
          </div>
          <div className={styles.statInfo}>
            <h4>{totalAssigned}</h4>
            <p>Total Team Members</p>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: '#4f46e5' }}>
            <Sparkles size={24} />
          </div>
          <div className={styles.statInfo}>
            <h4>{readyForReview}</h4>
            <p>Ready for Appraiser</p>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: '#d97706' }}>
            <RotateCcw size={24} />
          </div>
          <div className={styles.statInfo}>
            <h4>{pendingSelf}</h4>
            <p>Pending Self-Review</p>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIcon} style={{ background: '#16a34a' }}>
            <CheckCircle2 size={24} />
          </div>
          <div className={styles.statInfo}>
            <h4>{completed}</h4>
            <p>Reviewed / Completed</p>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className={styles.filterCard}>
        <div className={styles.searchBox}>
          <Search size={18} color="#94a3b8" />
          <input
            type="text"
            placeholder="Search by staff name or file number..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <Filter size={18} color="#64748b" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className={styles.filterSelect}
          >
            <option value="all">All Submission Statuses</option>
            <option value="pending_self_review">Pending Self-Review</option>
            <option value="pending_appraiser">Ready for Appraiser Review</option>
            <option value="pending_hr_review">Submitted to HR</option>
            <option value="approved">Approved</option>
          </select>
        </div>
      </div>

      {/* Team Table */}
      <div className={styles.tableCard}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Staff Member</th>
              <th>Department</th>
              <th>Review Cycle</th>
              <th>Self-Score</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '3rem' }}>
                  <Loader2 size={28} className="animate-spin text-blue-600" style={{ margin: '0 auto' }} />
                </td>
              </tr>
            ) : filteredTeam.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '3rem', color: '#64748b' }}>
                  No team member appraisal submissions found matching your filters.
                </td>
              </tr>
            ) : (
              filteredTeam.map((item) => (
                <tr key={item.id}>
                  <td>
                    <div className={styles.staffName}>{item.staff_surname} {item.staff_firstname}</div>
                    <div className={styles.staffMeta}>{item.staff_file_no} • {item.designation_name || 'Staff'}</div>
                  </td>
                  <td>{item.department_name || 'General'}</td>
                  <td>{item.period_title}</td>
                  <td>
                    {item.self_total_score !== null ? (
                      <span style={{ fontWeight: '700', color: '#2563eb' }}>{item.self_total_score}%</span>
                    ) : (
                      <span style={{ color: '#94a3b8' }}>—</span>
                    )}
                  </td>
                  <td>
                    <span className={`${styles.statusBadge} ${
                      item.status === 'pending_self_review' ? styles.badgePendingSelf :
                      item.status === 'pending_appraiser' ? styles.badgeReadyAppraiser :
                      item.status === 'pending_hr_review' ? styles.badgePendingHr :
                      styles.badgeApproved
                    }`}>
                      {item.status.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      type="button"
                      onClick={() => openEvaluationModal(item)}
                      className={styles.actionBtn}
                    >
                      <Eye size={14} />
                      {item.status === 'pending_appraiser' ? 'Evaluate & Score' : 'View Record'}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Side-by-Side Scoring Matrix Modal */}
      <AnimatePresence>
        {selectedSubmission && (
          <div className={styles.modalBackdrop}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={styles.modalContent}
            >
              <div className={styles.modalHeader}>
                <div>
                  <h2>Appraisal Assessment: {formDetail?.submission?.staff_surname} {formDetail?.submission?.staff_firstname}</h2>
                  <p style={{ fontSize: '0.85rem', color: '#64748b', margin: 0 }}>
                    {formDetail?.submission?.staff_file_no} • {formDetail?.submission?.department_name} • {formDetail?.submission?.period_title}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedSubmission(null)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer' }}
                >
                  <X size={24} color="#64748b" />
                </button>
              </div>

              {modalLoading ? (
                <div style={{ textAlign: 'center', padding: '4rem' }}>
                  <Loader2 size={32} className="animate-spin text-blue-600" style={{ margin: '0 auto' }} />
                </div>
              ) : (
                <div className={styles.modalBody}>
                  {/* Score Live Bar */}
                  <div style={{ background: '#eff6ff', padding: '1rem 1.25rem', borderRadius: '0.75rem', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <span style={{ fontWeight: '700', color: '#1e40af' }}>Appraiser Weighted Score:</span>
                      <p style={{ margin: 0, fontSize: '0.8rem', color: '#3b82f6' }}>Calculated dynamically based on category weights</p>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '1.5rem', fontWeight: '800', color: '#1d4ed8' }}>{livePct}%</span>
                      <span style={{ display: 'block', fontSize: '0.75rem', fontWeight: '700', color: '#4338ca' }}>Grade: {getGrade(livePct)}</span>
                    </div>
                  </div>

                  {/* Questionnaire Side by Side */}
                  <div className={styles.sideBySideHeader}>
                    <span>Performance Metric & Description</span>
                    <span>Employee Self-Score & Remarks</span>
                    <span>Appraiser Score (1-5) & Comments</span>
                  </div>

                  {formDetail?.categories?.map(cat => (
                    <div key={cat.id} style={{ marginBottom: '1.5rem' }}>
                      <div style={{ background: '#f1f5f9', padding: '0.6rem 1rem', borderRadius: '0.4rem', fontWeight: '700', fontSize: '0.85rem', color: '#334155' }}>
                        {cat.name} (Weight: {cat.weight}%)
                      </div>

                      {cat.items?.map(item => {
                        const currentAppr = appraiserScores[item.id] || { appraiser_score: '', appraiser_comment: '' };
                        return (
                          <div key={item.id} className={styles.criteriaRow}>
                            <div>
                              <div style={{ fontWeight: '600', color: '#1e293b' }}>{item.title}</div>
                              <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{item.description}</div>
                            </div>

                            <div className={styles.selfScoreBox}>
                              <div style={{ fontWeight: '700', color: '#2563eb' }}>
                                Rating: {item.self_score !== null ? `${item.self_score} / 5` : 'Not scored'}
                              </div>
                              <div style={{ fontSize: '0.75rem', color: '#475569', marginTop: '0.25rem' }}>
                                {item.self_comment ? `"${item.self_comment}"` : 'No remarks provided.'}
                              </div>
                            </div>

                            <div className={styles.appraiserInputBox}>
                              <select
                                value={currentAppr.appraiser_score}
                                onChange={(e) => setAppraiserScores(prev => ({
                                  ...prev,
                                  [item.id]: { ...prev[item.id], appraiser_score: e.target.value }
                                }))}
                                className={styles.scoreSelect}
                              >
                                <option value="">Select Score (1-5)</option>
                                <option value="5">5 - Exceptional</option>
                                <option value="4">4 - Exceeds Standards</option>
                                <option value="3">3 - Meets Standards</option>
                                <option value="2">2 - Needs Growth</option>
                                <option value="1">1 - Unsatisfactory</option>
                              </select>

                              <input
                                type="text"
                                placeholder="Appraiser remarks..."
                                value={currentAppr.appraiser_comment}
                                onChange={(e) => setAppraiserScores(prev => ({
                                  ...prev,
                                  [item.id]: { ...prev[item.id], appraiser_comment: e.target.value }
                                }))}
                                style={{ padding: '0.4rem 0.6rem', border: '1px solid #cbd5e1', borderRadius: '0.4rem', fontSize: '0.8rem' }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))}

                  {/* Qualitative Feedback & Promotion Recommendations */}
                  <div style={{ marginTop: '2rem', borderTop: '1px solid #e2e8f0', paddingTop: '1.5rem' }}>
                    <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: '#1e293b', marginBottom: '1rem' }}>
                      Appraiser Qualitative Remarks & Action Recommendations
                    </h3>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.4rem', color: '#475569' }}>
                          Demonstrated Strengths & Commendations:
                        </label>
                        <textarea
                          placeholder="Highlight areas where the staff member excelled..."
                          value={strengths}
                          onChange={(e) => setStrengths(e.target.value)}
                          style={{ width: '100%', padding: '0.6rem', border: '1px solid #cbd5e1', borderRadius: '0.5rem', minHeight: '80px' }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.4rem', color: '#475569' }}>
                          Areas for Growth & Improvement (PIP):
                        </label>
                        <textarea
                          placeholder="Identify specific performance gaps or focus areas..."
                          value={growthAreas}
                          onChange={(e) => setGrowthAreas(e.target.value)}
                          style={{ width: '100%', padding: '0.6rem', border: '1px solid #cbd5e1', borderRadius: '0.5rem', minHeight: '80px' }}
                        />
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '1rem' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.4rem', color: '#475569' }}>
                          Recommendation to HR:
                        </label>
                        <select
                          value={recommendationType}
                          onChange={(e) => setRecommendationType(e.target.value)}
                          className={styles.filterSelect}
                          style={{ width: '100%' }}
                        >
                          <option value="none">No Specific Action</option>
                          <option value="increment">Merit Salary Increment</option>
                          <option value="promotion">Promotion to Next Level</option>
                          <option value="confirmation">Probation Confirmation</option>
                          <option value="pip">Performance Improvement Plan (PIP)</option>
                          <option value="training">Sponsored Training / Certification</option>
                        </select>
                      </div>

                      <div>
                        <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: '600', marginBottom: '0.4rem', color: '#475569' }}>
                          Recommendation Details / Proposed Increment %:
                        </label>
                        <input
                          type="text"
                          placeholder="e.g. Recommend 5-10% salary step increment or promotion to Senior Officer..."
                          value={recommendationDetails}
                          onChange={(e) => setRecommendationDetails(e.target.value)}
                          style={{ width: '100%', padding: '0.55rem', border: '1px solid #cbd5e1', borderRadius: '0.5rem' }}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className={styles.modalFooter}>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleReturnToStaff}
                  style={{ padding: '0.65rem 1.25rem', background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', fontWeight: '600', borderRadius: '0.5rem', cursor: 'pointer' }}
                >
                  Return to Staff for Revision
                </button>

                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => handleSaveAppraiserReview(false)}
                  style={{ padding: '0.65rem 1.25rem', background: '#ffffff', border: '1px solid #cbd5e1', color: '#475569', fontWeight: '600', borderRadius: '0.5rem', cursor: 'pointer' }}
                >
                  <Save size={16} /> Save Draft
                </button>

                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => handleSaveAppraiserReview(true)}
                  style={{ padding: '0.65rem 1.5rem', background: '#2563eb', border: 'none', color: '#ffffff', fontWeight: '600', borderRadius: '0.5rem', cursor: 'pointer' }}
                >
                  {submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                  Submit to HR for Calibration
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Toast Notification */}
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
