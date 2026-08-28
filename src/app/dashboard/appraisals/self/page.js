"use client";

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  TrendingUp, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Save, 
  Send, 
  Clock, 
  User, 
  Award, 
  FileText,
  Calendar,
  Sparkles
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

const RATING_RUBRIC = [
  { val: 1, label: 'Unsatisfactory', desc: 'Fails to meet minimum expectations' },
  { val: 2, label: 'Needs Growth', desc: 'Inconsistently meets standards' },
  { val: 3, label: 'Meets Standards', desc: 'Consistently meets all requirements' },
  { val: 4, label: 'Exceeds Standards', desc: 'Regularly exceeds expectations' },
  { val: 5, label: 'Exceptional', desc: 'Consistently role-model performance' },
];

export default function MyAppraisalsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [activeList, setActiveList] = useState([]);
  const [selectedSubmission, setSelectedSubmission] = useState(null);
  const [formData, setFormData] = useState({
    categories: [],
    submission: null,
  });

  // Self Reflections
  const [accomplishments, setAccomplishments] = useState('');
  const [challenges, setChallenges] = useState('');
  const [trainingNeeds, setTrainingNeeds] = useState('');
  const [staffFeedback, setStaffFeedback] = useState('');
  const [scores, setScores] = useState({}); // { [criteria_item_id]: { self_score, self_comment } }
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const loadMySubmissions = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/appraisals/my-active`, { headers: buildHeaders() });
      if (res.data.status === 'success') {
        setActiveList(res.data.data || []);
        if (res.data.data?.length > 0) {
          loadFormDetail(res.data.data[0].id);
        } else {
          setLoading(false);
        }
      }
    } catch (err) {
      console.error('Failed to load my appraisals', err);
      showToast(err.response?.data?.message || 'Failed to load appraisal records', 'error');
      setLoading(false);
    }
  };

  const loadFormDetail = async (submissionId) => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/appraisals/form/${submissionId}`, { headers: buildHeaders() });
      if (res.data.status === 'success') {
        const { submission, categories } = res.data;
        setSelectedSubmission(submission);
        setFormData({ submission, categories });
        setAccomplishments(submission.staff_key_accomplishments || '');
        setChallenges(submission.staff_challenges || '');
        setTrainingNeeds(submission.staff_training_needs || '');
        setStaffFeedback(submission.staff_feedback || '');

        const initialScores = {};
        categories.forEach(cat => {
          cat.items.forEach(item => {
            initialScores[item.id] = {
              self_score: item.self_score !== null ? item.self_score : '',
              self_comment: item.self_comment || '',
            };
          });
        });
        setScores(initialScores);
      }
    } catch (err) {
      console.error('Failed to load form details', err);
      showToast('Failed to load appraisal questionnaire', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMySubmissions();
  }, []);

  const handleScoreSelect = (itemId, val) => {
    if (selectedSubmission?.status !== 'pending_self_review') return;
    setScores(prev => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        self_score: val
      }
    }));
  };

  const handleCommentChange = (itemId, comment) => {
    if (selectedSubmission?.status !== 'pending_self_review') return;
    setScores(prev => ({
      ...prev,
      [itemId]: {
        ...prev[itemId],
        self_comment: comment
      }
    }));
  };

  // Compute live score percentage
  const computeLivePercentage = () => {
    let totalWeightedScore = 0;
    let totalWeight = 0;

    formData.categories.forEach(cat => {
      cat.items.forEach(item => {
        const itemScore = scores[item.id]?.self_score;
        const itemWeight = parseFloat(item.weight) || 1;
        const maxScore = item.max_score || 5;

        if (itemScore !== '' && itemScore !== undefined && itemScore !== null) {
          totalWeightedScore += (parseFloat(itemScore) / maxScore) * itemWeight;
          totalWeight += itemWeight;
        }
      });
    });

    if (totalWeight === 0) return 0;
    return Math.round((totalWeightedScore / totalWeight) * 100);
  };

  const handleSave = async (isSubmit = false) => {
    if (!selectedSubmission) return;

    if (isSubmit) {
      // Validate all items scored
      let missingCount = 0;
      formData.categories.forEach(cat => {
        cat.items.forEach(item => {
          if (!scores[item.id]?.self_score) missingCount++;
        });
      });

      if (missingCount > 0) {
        showToast(`Please provide a rating for all criteria before submitting (${missingCount} remaining).`, 'error');
        return;
      }
    }

    if (isSubmit) setSubmitting(true);
    else setSaving(true);

    try {
      const scoresPayload = Object.entries(scores).map(([criteria_item_id, val]) => ({
        criteria_item_id: parseInt(criteria_item_id, 10),
        self_score: val.self_score !== '' ? parseFloat(val.self_score) : null,
        self_comment: val.self_comment || null,
      }));

      const res = await axios.post(
        `${API_BASE}/appraisals/form/${selectedSubmission.id}/save-self`,
        {
          is_submit: isSubmit,
          staff_key_accomplishments: accomplishments,
          staff_challenges: challenges,
          staff_training_needs: trainingNeeds,
          scores: scoresPayload,
        },
        { headers: buildHeaders() }
      );

      if (res.data.status === 'success') {
        showToast(res.data.message);
        loadFormDetail(selectedSubmission.id);
      }
    } catch (err) {
      console.error('Save error', err);
      showToast(err.response?.data?.message || 'Error saving self review', 'error');
    } finally {
      setSaving(false);
      setSubmitting(false);
    }
  };

  const handleAcknowledge = async () => {
    if (!selectedSubmission) return;
    setSaving(true);
    try {
      const res = await axios.post(
        `${API_BASE}/appraisals/form/${selectedSubmission.id}/acknowledge`,
        { staff_feedback: staffFeedback },
        { headers: buildHeaders() }
      );
      if (res.data.status === 'success') {
        showToast('Appraisal acknowledgment recorded successfully.');
        loadFormDetail(selectedSubmission.id);
      }
    } catch (err) {
      showToast('Failed to acknowledge appraisal', 'error');
    } finally {
      setSaving(false);
    }
  };

  const livePercent = computeLivePercentage();
  const isEditable = selectedSubmission?.status === 'pending_self_review';

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>My Self-Appraisal Portal</h1>
        <p className={styles.subtitle}>
          Evaluate your performance against agreed key metrics, highlight accomplishments, and align on growth goals.
        </p>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '4rem' }}>
          <Loader2 size={36} className="animate-spin text-blue-600" style={{ margin: '0 auto' }} />
          <p style={{ marginTop: '1rem', color: '#64748b' }}>Loading your appraisal questionnaire...</p>
        </div>
      ) : activeList.length === 0 ? (
        <div className={`${styles.card} ${styles.emptyState}`}>
          <FileText size={48} />
          <h3>No Active Appraisal Cycle</h3>
          <p>You do not currently have any active performance appraisal cycles assigned to you.</p>
        </div>
      ) : (
        <>
          {/* Top Banner with Cycle Status */}
          <div className={styles.bannerCard}>
            <div className={styles.bannerInfo}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                <TrendingUp size={24} />
                <h3>{selectedSubmission?.period_title || 'Performance Review Cycle'}</h3>
              </div>
              <p>Template: {selectedSubmission?.template_title} • Department: {selectedSubmission?.department_name || 'Staff'}</p>
            </div>

            <div className={styles.bannerMeta}>
              <div className={styles.metaItem}>
                <span className={styles.metaLabel}>Self-Review Deadline</span>
                <span className={styles.metaValue}>{selectedSubmission?.self_review_deadline || 'Open'}</span>
              </div>
              <div className={styles.metaItem}>
                <span className={styles.metaLabel}>Assigned Appraiser</span>
                <span className={styles.metaValue}>
                  {selectedSubmission?.appraiser_surname ? `${selectedSubmission.appraiser_surname} ${selectedSubmission.appraiser_firstname}` : 'Head of Department'}
                </span>
              </div>
              <div className={styles.metaItem}>
                <span className={styles.metaLabel}>Status</span>
                <span className={styles.metaValue} style={{ textTransform: 'capitalize' }}>
                  {selectedSubmission?.status?.replace(/_/g, ' ')}
                </span>
              </div>
            </div>
          </div>

          {/* Real-time score indicator */}
          <div className={styles.scoreMeter}>
            <div>
              <span className={styles.scoreLabel}>Self-Evaluation Score (Weighted):</span>
              <p style={{ fontSize: '0.8rem', color: '#64748b', margin: 0 }}>
                {isEditable ? 'Calculates dynamically as you rate each performance metric' : 'Final self-appraisal submission score'}
              </p>
            </div>
            <div className={styles.scoreValue}>
              {isEditable ? `${livePercent}%` : `${selectedSubmission?.self_total_score || 0}%`}
            </div>
          </div>

          {/* Criteria Categories Accordion */}
          {formData.categories.map((category) => (
            <div key={category.id} className={styles.categoryBlock}>
              <div className={styles.categoryHeader}>
                <span className={styles.categoryTitle}>{category.name}</span>
                <span className={styles.categoryWeight}>Weight: {category.weight}%</span>
              </div>

              <div className={styles.criteriaList}>
                {category.items.map((item) => {
                  const currentScore = scores[item.id]?.self_score;
                  const currentComment = scores[item.id]?.self_comment || '';

                  return (
                    <div key={item.id} className={styles.criteriaItem}>
                      <div className={styles.itemHeader}>
                        <div>
                          <div className={styles.itemTitle}>{item.title}</div>
                          {item.description && <div className={styles.itemDesc}>{item.description}</div>}
                        </div>
                      </div>

                      {/* 1-5 Rating Rubric Scale */}
                      <div className={styles.ratingScale}>
                        {RATING_RUBRIC.map((rubric) => {
                          const isSelected = currentScore == rubric.val;
                          return (
                            <button
                              key={rubric.val}
                              type="button"
                              disabled={!isEditable}
                              onClick={() => handleScoreSelect(item.id, rubric.val)}
                              className={`${styles.ratingBtn} ${isSelected ? styles.selected : ''}`}
                            >
                              <span className={styles.ratingNumber}>{rubric.val}</span>
                              <span className={styles.ratingText}>{rubric.label}</span>
                            </button>
                          );
                        })}
                      </div>

                      {/* Item-specific comment */}
                      <input
                        type="text"
                        disabled={!isEditable}
                        placeholder="Add specific examples or accomplishments for this metric..."
                        value={currentComment}
                        onChange={(e) => handleCommentChange(item.id, e.target.value)}
                        className={styles.commentInput}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Qualitative Self-Reflection Card */}
          <div className={`${styles.card} ${styles.sectionBlock}`}>
            <h3 className={styles.sectionTitle}>Qualitative Self-Assessment & Goals</h3>

            <div className={styles.formGroup}>
              <label className={styles.label}>1. Key Accomplishments & Significant Contributions</label>
              <textarea
                disabled={!isEditable}
                placeholder="Detail your major achievements, successful projects, and positive impact during this period..."
                value={accomplishments}
                onChange={(e) => setAccomplishments(e.target.value)}
                className={styles.textarea}
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>2. Challenges Encountered & Support Needed</label>
              <textarea
                disabled={!isEditable}
                placeholder="Highlight any operational bottlenecks, resource constraints, or challenges you navigated..."
                value={challenges}
                onChange={(e) => setChallenges(e.target.value)}
                className={styles.textarea}
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>3. Proposed Training, Skills & Professional Development Needs</label>
              <textarea
                disabled={!isEditable}
                placeholder="List technical or clinical training programs, workshops, or certifications you wish to pursue..."
                value={trainingNeeds}
                onChange={(e) => setTrainingNeeds(e.target.value)}
                className={styles.textarea}
              />
            </div>

            {/* Actions for Submission */}
            {isEditable && (
              <div className={styles.actionFooter}>
                <button
                  type="button"
                  disabled={saving || submitting}
                  onClick={() => handleSave(false)}
                  className={styles.btnSecondary}
                >
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                  Save as Draft
                </button>

                <button
                  type="button"
                  disabled={saving || submitting}
                  onClick={() => handleSave(true)}
                  className={styles.btnPrimary}
                >
                  {submitting ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                  Submit to Appraiser
                </button>
              </div>
            )}

            {/* If Approved, Employee Acknowledgment Banner */}
            {selectedSubmission?.status === 'approved' && (
              <div style={{ marginTop: '2rem', padding: '1.5rem', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '0.75rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#166534', fontWeight: '700', marginBottom: '0.5rem' }}>
                  <CheckCircle2 size={20} />
                  Appraisal Approved by Management! (Grade: {selectedSubmission?.performance_grade})
                </div>
                <p style={{ fontSize: '0.9rem', color: '#374151', marginBottom: '1rem' }}>
                  HR Remarks: {selectedSubmission?.hr_comments || 'Approved with satisfactory grade.'}
                </p>

                <div className={styles.formGroup}>
                  <label className={styles.label}>Employee Final Remarks / Feedback (Optional):</label>
                  <input
                    type="text"
                    placeholder="Enter your comments before final acknowledgment..."
                    value={staffFeedback}
                    onChange={(e) => setStaffFeedback(e.target.value)}
                    className={styles.commentInput}
                  />
                </div>

                <button
                  type="button"
                  disabled={saving}
                  onClick={handleAcknowledge}
                  className={styles.btnPrimary}
                  style={{ background: '#16a34a', marginTop: '0.75rem' }}
                >
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                  Sign & Acknowledge Appraisal
                </button>
              </div>
            )}
          </div>
        </>
      )}

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
