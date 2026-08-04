"use client";

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import axios from 'axios';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Search, Users, FileText, CheckCircle, XCircle, ExternalLink, RefreshCw } from 'lucide-react';
import styles from './page.module.css';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api/nextjs';
const STORAGE_BASE = process.env.NEXT_PUBLIC_STORAGE_URL || 'http://127.0.0.1:8000/storage';

const getFileUrl = (doc) => {
  if (!doc) return '#';
  if (typeof doc !== 'string') return '#';
  
  if (doc.includes('/api/nextjs/uploads/')) {
    const relativePath = doc.substring(doc.indexOf('/api/nextjs/uploads/'));
    const apiBaseUrl = API_BASE.endsWith('/api/nextjs') ? API_BASE.substring(0, API_BASE.length - 11) : API_BASE;
    return `${apiBaseUrl}${relativePath}`;
  }
  
  if (doc.startsWith('http://') || doc.startsWith('https://') || doc.startsWith('data:')) {
    return doc;
  }
  
  return `${STORAGE_BASE}/${doc}`;
};

export default function EducationStatusReport() {
  const router = useRouter();
  const [data, setData] = useState({ uploaded: [], not_uploaded: [] });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState('not_uploaded'); // 'not_uploaded' or 'uploaded'

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/hr/documentation/reports/education-status`);
      if (res.data && res.data.status === 'success') {
        setData({
          uploaded: res.data.uploaded || [],
          not_uploaded: res.data.not_uploaded || []
        });
      }
    } catch (err) {
      console.error('Failed to fetch education status report:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Statistics
  const totalStaff = data.uploaded.length + data.not_uploaded.length;
  const uploadedCount = data.uploaded.length;
  const notUploadedCount = data.not_uploaded.length;
  const completionRate = totalStaff > 0 ? Math.round((uploadedCount / totalStaff) * 100) : 0;

  // Filter current active list
  const currentList = activeTab === 'uploaded' ? data.uploaded : data.not_uploaded;
  const filteredList = currentList.filter(s => {
    const q = search.toLowerCase();
    if (!q) return true;
    const fullName = [s.title, s.surname, s.first_name, s.othernames].filter(Boolean).join(' ').toLowerCase();
    return (
      fullName.includes(q) ||
      String(s.id).toLowerCase().includes(q) ||
      s.department?.toLowerCase().includes(q) ||
      s.designation?.toLowerCase().includes(q)
    );
  });

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      {/* Header */}
      <div className={styles.pageHeader}>
        <div className={styles.pageHeaderLeft}>
          <div className={styles.pageTitleContainer}>
            <button className={styles.backBtn} onClick={() => router.back()} title="Go Back">
              <ArrowLeft size={18} />
            </button>
            <h1 className={styles.pageTitle}>Education Files Upload Status</h1>
          </div>
          <p className={styles.pageSubtitle}>Report tracking staff who have uploaded certificates versus those pending.</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className={styles.statsRow}>
        <div className={`premium-card ${styles.statCard}`}>
          <div className={styles.statIcon} style={{ background: 'rgba(59, 130, 246, 0.1)', color: 'var(--primary)' }}>
            <Users size={22} />
          </div>
          <div>
            <p className={styles.statValue}>{totalStaff}</p>
            <p className={styles.statLabel}>Total Staff</p>
          </div>
        </div>

        <div className={`premium-card ${styles.statCard}`}>
          <div className={styles.statIcon} style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10b981' }}>
            <CheckCircle size={22} />
          </div>
          <div>
            <p className={styles.statValue}>{uploadedCount}</p>
            <p className={styles.statLabel}>Uploaded Certificate</p>
          </div>
        </div>

        <div className={`premium-card ${styles.statCard}`}>
          <div className={styles.statIcon} style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}>
            <XCircle size={22} />
          </div>
          <div>
            <p className={styles.statValue}>{notUploadedCount}</p>
            <p className={styles.statLabel}>Pending Upload</p>
          </div>
        </div>

        <div className={`premium-card ${styles.statCard}`}>
          <div className={styles.statIcon} style={{ background: 'rgba(124, 58, 237, 0.1)', color: '#7c3aed' }}>
            <FileText size={22} />
          </div>
          <div>
            <p className={styles.statValue}>{completionRate}%</p>
            <p className={styles.statLabel}>Completion Rate</p>
          </div>
        </div>
      </div>

      {/* Main content table card */}
      <div className={`premium-card ${styles.mainCard}`}>
        <div className={styles.cardHeader}>
          <div className={styles.tabsContainer}>
            <button
              onClick={() => setActiveTab('not_uploaded')}
              className={`${styles.tabBtn} ${activeTab === 'not_uploaded' ? styles.activeTabBtn : ''}`}
            >
              <XCircle size={16} />
              <span>Not Uploaded ({notUploadedCount})</span>
            </button>
            <button
              onClick={() => setActiveTab('uploaded')}
              className={`${styles.tabBtn} ${activeTab === 'uploaded' ? styles.activeTabBtn : ''}`}
            >
              <CheckCircle size={16} />
              <span>Uploaded ({uploadedCount})</span>
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button
              onClick={fetchData}
              title="Refresh Report"
              style={{
                background: 'transparent',
                border: '1px solid var(--border, #e2e8f0)',
                borderRadius: '0.5rem',
                padding: '0.6rem',
                color: 'var(--text-main, #334155)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s',
              }}
            >
              <RefreshCw size={16} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            </button>
            <div className={styles.searchWrap}>
              <Search size={16} className={styles.searchIcon} />
              <input
                type="text"
                placeholder="Search staff..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className={styles.searchInput}
              />
            </div>
          </div>
        </div>

        <div className={styles.tableScroll}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th style={{ width: '60px' }}>S/N</th>
                <th style={{ width: '120px' }}>Staff ID</th>
                <th>Full Name</th>
                <th>Department</th>
                <th>Designation</th>
                {activeTab === 'uploaded' && <th>Education Certificates</th>}
                <th style={{ width: '100px' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={activeTab === 'uploaded' ? 7 : 6} className={styles.loadingSpinnerWrap}>
                    <div className={styles.spinner}></div>
                    <p>Loading education status report...</p>
                  </td>
                </tr>
              ) : filteredList.length === 0 ? (
                <tr>
                  <td colSpan={activeTab === 'uploaded' ? 7 : 6} className={styles.emptyRow}>
                    {search ? 'No staff found matching search criteria' : 'No records in this category'}
                  </td>
                </tr>
              ) : (
                filteredList.map((s, i) => (
                  <tr key={s.id || i} className={styles.tableRow}>
                    <td>{i + 1}</td>
                    <td>{s.id || '—'}</td>
                    <td className={styles.nameCell}>
                      {[s.title, s.surname, s.first_name, s.othernames].filter(Boolean).join(' ')}
                    </td>
                    <td>{s.department || '—'}</td>
                    <td>{s.designation || '—'}</td>
                    {activeTab === 'uploaded' && (
                      <td>
                        <div className={styles.docsGrid}>
                          {s.education_files && s.education_files.length > 0 ? (
                            s.education_files.map((edu, idx) => (
                              <div key={edu.id || idx} className={styles.docItem}>
                                <span className={styles.eduCategory}>
                                  {edu.category || edu.degreequalification || 'Certificate'}:
                                </span>
                                {edu.document ? (
                                  <a
                                    href={getFileUrl(edu.document)}
                                    target="_blank"
                                    rel="noreferrer"
                                    className={styles.fileBadge}
                                  >
                                    View File <ExternalLink size={12} />
                                  </a>
                                ) : (
                                  <span style={{ color: 'var(--secondary)' }}>None</span>
                                )}
                              </div>
                            ))
                          ) : (
                            <span style={{ color: 'var(--secondary)' }}>No file attached</span>
                          )}
                        </div>
                      </td>
                    )}
                    <td>
                      <Link
                        href={`/dashboard/hr/employees/documentation/${s.id}?step=4`}
                        className="btn-text"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '0.25rem',
                          color: 'var(--primary)',
                          fontWeight: '600',
                          textDecoration: 'none',
                          fontSize: '0.85rem'
                        }}
                        title="Update Education Documentation"
                      >
                        Update
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {filteredList.length > 0 && (
          <p className={styles.countNote}>
            Showing <strong>{filteredList.length}</strong> of <strong>{currentList.length}</strong> records
          </p>
        )}
      </div>
    </motion.div>
  );
}
