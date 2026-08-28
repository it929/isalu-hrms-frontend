"use client";

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FileText, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  X, 
  Layers, 
  Sliders,
  ChevronDown,
  ChevronUp
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

export default function AppraisalSetupPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [toast, setToast] = useState(null);

  // New Template Form State
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [passingScore, setPassingScore] = useState(60);
  const [categories, setCategories] = useState([
    {
      name: 'Key Job Deliverables & KPIs',
      weight: 40,
      items: [
        { title: 'Quality of Deliverables', description: 'Accuracy and high standard of output' },
        { title: 'Timely Execution', description: 'Meets deadlines and operational commitments' }
      ]
    },
    {
      name: 'Core Values & Collaboration',
      weight: 30,
      items: [
        { title: 'Teamwork & Communication', description: 'Works well with cross-functional teams' },
        { title: 'Professional Conduct & Ethics', description: 'High integrity, punctuality, and compliance' }
      ]
    },
    {
      name: 'Initiative & Problem Solving',
      weight: 30,
      items: [
        { title: 'Continuous Improvement', description: 'Proactively identifies and resolves bottlenecks' }
      ]
    }
  ]);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/appraisals/templates`, { headers: buildHeaders() });
      if (res.data.status === 'success') {
        setTemplates(res.data.data || []);
      }
    } catch (err) {
      console.error('Failed to load templates', err);
      showToast('Failed to load appraisal templates', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  const handleAddCategory = () => {
    setCategories(prev => [
      ...prev,
      {
        name: 'New Performance Category',
        weight: 10,
        items: [{ title: 'Criteria Title', description: 'Describe the expectation...' }]
      }
    ]);
  };

  const handleRemoveCategory = (catIdx) => {
    setCategories(prev => prev.filter((_, idx) => idx !== catIdx));
  };

  const handleAddItem = (catIdx) => {
    setCategories(prev => {
      const updated = [...prev];
      updated[catIdx].items.push({ title: 'New KPI Item', description: 'Describe what is evaluated...' });
      return updated;
    });
  };

  const handleRemoveItem = (catIdx, itemIdx) => {
    setCategories(prev => {
      const updated = [...prev];
      updated[catIdx].items = updated[catIdx].items.filter((_, idx) => idx !== itemIdx);
      return updated;
    });
  };

  const handleSaveTemplate = async () => {
    if (!title.trim()) {
      showToast('Template title is required', 'error');
      return;
    }

    const totalWeight = categories.reduce((sum, c) => sum + (parseFloat(c.weight) || 0), 0);
    if (totalWeight !== 100) {
      showToast(`Category weights must sum to exactly 100% (currently ${totalWeight}%).`, 'error');
      return;
    }

    setSaving(true);
    try {
      const res = await axios.post(
        `${API_BASE}/appraisals/templates`,
        {
          title,
          description,
          passing_score: passingScore,
          categories,
        },
        { headers: buildHeaders() }
      );

      if (res.data.status === 'success') {
        showToast('Appraisal template created successfully.');
        setShowModal(false);
        loadTemplates();
      }
    } catch (err) {
      showToast(err.response?.data?.message || 'Failed to create template', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Appraisal Setup & Templates</h1>
          <p className={styles.subtitle}>
            Design custom performance appraisal templates with weighted KPI categories, measurable rubrics, and scoring benchmarks.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowModal(true)}
          className={styles.btnNew}
        >
          <Plus size={18} />
          Create New Template
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '4rem' }}>
          <Loader2 size={32} className="animate-spin text-blue-600" style={{ margin: '0 auto' }} />
        </div>
      ) : templates.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '4rem', color: '#64748b', background: '#ffffff', borderRadius: '1rem', border: '1px solid #e2e8f0' }}>
          <FileText size={48} color="#94a3b8" style={{ marginBottom: '1rem' }} />
          <h3>No Templates Found</h3>
          <p>Create your first organizational performance evaluation template to get started.</p>
        </div>
      ) : (
        templates.map((tpl) => (
          <div key={tpl.id} className={styles.templateCard}>
            <div className={styles.templateHeader}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '700', color: '#1e293b' }}>
                  {tpl.title}
                </h3>
                <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: '#64748b' }}>
                  {tpl.description || 'Standard Performance Evaluation Questionnaire'}
                </p>
              </div>

              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: '700', color: '#2563eb', background: '#eff6ff', padding: '0.35rem 0.75rem', borderRadius: '1rem' }}>
                  Passing Score: {tpl.passing_score}%
                </span>
                <span style={{ fontSize: '0.85rem', fontWeight: '600', color: '#16a34a', background: '#dcfce7', padding: '0.35rem 0.75rem', borderRadius: '1rem' }}>
                  Active
                </span>
              </div>
            </div>

            <div className={styles.templateBody}>
              {tpl.categories?.map((cat) => (
                <div key={cat.id} className={styles.categoryCard}>
                  <div className={styles.categoryHeader}>
                    <span style={{ fontWeight: '700', color: '#1e293b' }}>{cat.name}</span>
                    <span style={{ fontSize: '0.75rem', fontWeight: '700', background: '#f1f5f9', padding: '0.25rem 0.6rem', borderRadius: '0.4rem', color: '#475569' }}>
                      Weight: {cat.weight}%
                    </span>
                  </div>

                  <div>
                    {cat.items?.map((item) => (
                      <div key={item.id} className={styles.itemRow}>
                        <div style={{ fontWeight: '600', color: '#334155' }}>• {item.title}</div>
                        {item.description && (
                          <div style={{ fontSize: '0.8rem', color: '#64748b', marginLeft: '0.85rem' }}>
                            {item.description}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      {/* Create Template Modal */}
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
                <h2 style={{ margin: 0, fontSize: '1.35rem', fontWeight: '700' }}>Create Performance Template</h2>
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
                  <label className={styles.label}>Template Title:</label>
                  <input
                    type="text"
                    placeholder="e.g. Clinical Staff Annual Appraisal, Administrative Staff Review"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className={styles.input}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
                  <div>
                    <label className={styles.label}>Description:</label>
                    <input
                      type="text"
                      placeholder="Brief overview of evaluation scope..."
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      className={styles.input}
                    />
                  </div>

                  <div>
                    <label className={styles.label}>Passing Benchmark (%):</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={passingScore}
                      onChange={(e) => setPassingScore(e.target.value)}
                      className={styles.input}
                    />
                  </div>
                </div>

                {/* Categories & Items Builder */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: '#1e293b', margin: 0 }}>
                    KPI Categories & Weight Allocations
                  </h3>
                  <button
                    type="button"
                    onClick={handleAddCategory}
                    style={{ padding: '0.4rem 0.8rem', background: '#eff6ff', border: '1px solid #bfdbfe', color: '#2563eb', fontWeight: '600', borderRadius: '0.4rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                  >
                    <Plus size={14} /> Add Category
                  </button>
                </div>

                {categories.map((cat, catIdx) => (
                  <div key={catIdx} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '0.75rem', padding: '1rem', marginBottom: '1.25rem' }}>
                    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '0.75rem' }}>
                      <input
                        type="text"
                        placeholder="Category Name"
                        value={cat.name}
                        onChange={(e) => {
                          const val = e.target.value;
                          setCategories(prev => {
                            const u = [...prev];
                            u[catIdx].name = val;
                            return u;
                          });
                        }}
                        style={{ flex: 1, padding: '0.5rem 0.75rem', border: '1px solid #cbd5e1', borderRadius: '0.4rem', fontWeight: '700' }}
                      />

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: '600', color: '#475569' }}>Weight %:</span>
                        <input
                          type="number"
                          min="1"
                          max="100"
                          value={cat.weight}
                          onChange={(e) => {
                            const val = e.target.value;
                            setCategories(prev => {
                              const u = [...prev];
                              u[catIdx].weight = val;
                              return u;
                            });
                          }}
                          style={{ width: '70px', padding: '0.5rem', border: '1px solid #cbd5e1', borderRadius: '0.4rem', fontWeight: '700' }}
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveCategory(catIdx)}
                        style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer' }}
                        title="Remove Category"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>

                    {/* Criteria items */}
                    <div style={{ marginLeft: '1rem', borderLeft: '2px solid #cbd5e1', paddingLeft: '1rem' }}>
                      {cat.items.map((item, itemIdx) => (
                        <div key={itemIdx} style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '0.5rem' }}>
                          <input
                            type="text"
                            placeholder="Criteria Title"
                            value={item.title}
                            onChange={(e) => {
                              const val = e.target.value;
                              setCategories(prev => {
                                const u = [...prev];
                                u[catIdx].items[itemIdx].title = val;
                                return u;
                              });
                            }}
                            style={{ flex: 1, padding: '0.4rem 0.6rem', border: '1px solid #cbd5e1', borderRadius: '0.4rem', fontSize: '0.85rem' }}
                          />

                          <input
                            type="text"
                            placeholder="Description / Expectation"
                            value={item.description}
                            onChange={(e) => {
                              const val = e.target.value;
                              setCategories(prev => {
                                const u = [...prev];
                                u[catIdx].items[itemIdx].description = val;
                                return u;
                              });
                            }}
                            style={{ flex: 2, padding: '0.4rem 0.6rem', border: '1px solid #cbd5e1', borderRadius: '0.4rem', fontSize: '0.85rem' }}
                          />

                          <button
                            type="button"
                            onClick={() => handleRemoveItem(catIdx, itemIdx)}
                            style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
                          >
                            <X size={16} />
                          </button>
                        </div>
                      ))}

                      <button
                        type="button"
                        onClick={() => handleAddItem(catIdx)}
                        style={{ padding: '0.25rem 0.6rem', background: '#ffffff', border: '1px dashed #cbd5e1', borderRadius: '0.35rem', fontSize: '0.75rem', fontWeight: '600', color: '#475569', cursor: 'pointer', marginTop: '0.35rem' }}
                      >
                        + Add Metric Item
                      </button>
                    </div>
                  </div>
                ))}
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
                  onClick={handleSaveTemplate}
                  className={styles.btnNew}
                >
                  {saving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                  Save & Publish Template
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
