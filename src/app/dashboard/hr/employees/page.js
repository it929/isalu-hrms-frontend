"use client";

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import axios from 'axios';
import Link from 'next/link';
import { UserPlus, Search, Eye, Users, FileText, X, Edit, RefreshCw } from 'lucide-react';
import styles from './page.module.css';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api/nextjs';
const STORAGE_BASE = process.env.NEXT_PUBLIC_STORAGE_URL || 'http://127.0.0.1:8000/storage';

// ── In-Memory Client Cache ───────────────────────────────────────────────────
export default function EmployeeRecords() {
  const [staffList, setStaffList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchStaff = useCallback((silent = false) => {
    if (!silent) setLoading(true);
    const cacheKey = 'hrms_employee_records_cache';

    axios.get(`${API_BASE}/hr/add-staff/list`)
      .then(res => {
        const staff = res.data.staff || [];
        setStaffList(staff);
        if (typeof window !== 'undefined') {
          sessionStorage.setItem(cacheKey, JSON.stringify(staff));
        }
      })
      .catch(() => {
        setStaffList([]);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    const cacheKey = 'hrms_employee_records_cache';
    let hasCache = false;
    if (typeof window !== 'undefined') {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          if (parsed && parsed.length > 0) {
            setStaffList(parsed);
            setLoading(false);
            hasCache = true;
          }
        } catch (e) {
          console.error('Failed to parse cached staff list', e);
        }
      }
    }
    fetchStaff(hasCache);
  }, [fetchStaff]);

  const [activeStaffProfile, setActiveStaffProfile] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalTab, setModalTab] = useState('personal');
  const [fetchingProfile, setFetchingProfile] = useState(false);

  const openProfileModal = async (staffId) => {
    setIsModalOpen(true);
    setFetchingProfile(true);
    setModalTab('personal');
    try {
      const res = await axios.get(`${API_BASE}/hr/documentation/${staffId}/profile`);
      if (res.data && res.data.status === 'success') {
        setActiveStaffProfile(res.data);
      } else {
        setActiveStaffProfile(null);
      }
    } catch (err) {
      console.error(err);
      setActiveStaffProfile(null);
    } finally {
      setFetchingProfile(false);
    }
  };

  const staffId = activeStaffProfile?.staffFullDetails?.staffID || activeStaffProfile?.staffFullDetails?.ID;

  const filtered = staffList.filter(s => {
    const q = search.toLowerCase();
    if (!q) return true;
    return (
      s.surname?.toLowerCase()?.includes(q) ||
      s.first_name?.toLowerCase()?.includes(q) ||
      s.email?.toLowerCase()?.includes(q) ||
      s.pf_num?.toLowerCase()?.includes(q) ||
      s.designation?.toLowerCase()?.includes(q) ||
      s.department?.toLowerCase()?.includes(q)
    );
  });

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      {/* ── Header ── */}
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Employee Records</h1>
          <p className={styles.pageSubtitle}>View and manage all administrative staff in the system.</p>
        </div>
        <Link href="/dashboard/hr/employees/add" className={styles.addBtn}>
          <UserPlus size={18} />
          <span>Add New Staff</span>
        </Link>
      </div>

      {/* ── Stats Row ── */}
      <div className={styles.statsRow}>
        <div className={`premium-card ${styles.statCard}`}>
          <div className={styles.statIcon} style={{ background: 'rgba(59,130,246,0.1)', color: 'var(--primary)' }}>
            <Users size={22} />
          </div>
          <div>
            <p className={styles.statValue}>{staffList.length}</p>
            <p className={styles.statLabel}>Total Staff</p>
          </div>
        </div>
        <div className={`premium-card ${styles.statCard}`}>
          <div className={styles.statIcon} style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981' }}>
            <Users size={22} />
          </div>
          <div>
            <p className={styles.statValue}>{staffList.filter(s => s.gender === 'Male').length}</p>
            <p className={styles.statLabel}>Male Staff</p>
          </div>
        </div>
        <div className={`premium-card ${styles.statCard}`}>
          <div className={styles.statIcon} style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b' }}>
            <Users size={22} />
          </div>
          <div>
            <p className={styles.statValue}>{staffList.filter(s => s.gender === 'Female').length}</p>
            <p className={styles.statLabel}>Female Staff</p>
          </div>
        </div>
      </div>

      {/* ── Table Card ── */}
      <div className={`premium-card ${styles.tableCard}`}>
        <div className={styles.tableHeader}>
          <h2>Staff List</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button
              onClick={() => fetchStaff()}
              title="Refresh Records"
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
                placeholder="Search by name, PF No., dept…"
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
                <th>S/N</th>
                <th>Full Name</th>
                <th>Date of Birth</th>
                <th>Gender</th>
                <th>Marital Status</th>
                <th>DATE OF APPOINTMENT</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className={styles.emptyRow}>Loading staff records…</td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className={styles.emptyRow}>
                    {search ? 'No results match your search.' : 'No staff records found. Click "Add New Staff" to get started.'}
                  </td>
                </tr>
              ) : (
                filtered.map((s, i) => (
                  <motion.tr
                    key={i}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className={styles.tableRow}
                  >
                    <td>{i + 1}</td>
                    <td className={styles.nameCell}>
                      {[s.title, s.surname, s.first_name, s.othernames].filter(Boolean).join(' ')}
                    </td>
                    <td>{s.dob || '—'}</td>
                    <td>
                      <span className={`${styles.genderTag} ${s.gender === 'Female' ? styles.female : styles.male}`}>
                        {s.gender || '—'}
                      </span>
                    </td>
                    <td>{s.maritalstatus || '—'}</td>
                    <td>{s.doj || '—'}</td>
                    <td>
                      <div className={styles.actionGroup}>
                        {s.progress_regID >= 18 ? (
                          <button
                            className={styles.viewBtn}
                            title="View Staff Record"
                            onClick={() => openProfileModal(s.id)}
                          >
                            <Users size={15} />
                          </button>
                        ) : (
                          <Link
                            href={`/dashboard/hr/employees/documentation/${s.id}`}
                            className={styles.docBtn}
                            title={`Continue Documentation (Step ${s.progress_regID || 0}/18)`}
                          >
                            <FileText size={15} />
                          </Link>
                        )}
                      </div>
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {filtered.length > 0 && (
          <p className={styles.countNote}>
            Showing <strong>{filtered.length}</strong> of <strong>{staffList.length}</strong> records
          </p>
        )}
      </div>

      {/* ── Profile Details Modal ── */}
      {isModalOpen && (
        <div className={styles.modalOverlay} onClick={() => setIsModalOpen(false)}>
          <div className={styles.modalContent} onClick={e => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h2>Staff Profile Record</h2>
              <button className={styles.closeBtn} onClick={() => setIsModalOpen(false)}>
                <X size={20} />
              </button>
            </div>

            {fetchingProfile ? (
              <div className={styles.modalLoading}>
                <div className={styles.spinner}></div>
                <p>Fetching profile details...</p>
              </div>
            ) : !activeStaffProfile ? (
              <div className={styles.modalLoading}>
                <p>Failed to load profile record or record not found.</p>
              </div>
            ) : (
              <div className={styles.modalBody}>
                {/* Modal Sidebar */}
                <div className={styles.modalSidebar}>
                  <button
                    className={`${styles.tabLink} ${modalTab === 'personal' ? styles.tabLinkActive : ''}`}
                    onClick={() => setModalTab('personal')}
                  >
                    Personal Info & Spouse
                  </button>
                  <button
                    className={`${styles.tabLink} ${modalTab === 'employment' ? styles.tabLinkActive : ''}`}
                    onClick={() => setModalTab('employment')}
                  >
                    Employment & Salary
                  </button>
                  <button
                    className={`${styles.tabLink} ${modalTab === 'education' ? styles.tabLinkActive : ''}`}
                    onClick={() => setModalTab('education')}
                  >
                    Education History
                  </button>
                  <button
                    className={`${styles.tabLink} ${modalTab === 'service' ? styles.tabLinkActive : ''}`}
                    onClick={() => setModalTab('service')}
                  >
                    Service History
                  </button>
                  <button
                    className={`${styles.tabLink} ${modalTab === 'censures' ? styles.tabLinkActive : ''}`}
                    onClick={() => setModalTab('censures')}
                  >
                    Censures & Leave
                  </button>
                  <button
                    className={`${styles.tabLink} ${modalTab === 'attachments' ? styles.tabLinkActive : ''}`}
                    onClick={() => setModalTab('attachments')}
                  >
                    Attachments
                  </button>
                </div>

                {/* Tab Content */}
                <div className={styles.tabContent}>
                  {modalTab === 'personal' && (
                    <>
                      {/* Avatar section */}
                      <div className={styles.profilePicSection}>
                        <img
                          src={
                            activeStaffProfile.staffFullDetails?.passport_url ||
                            (activeStaffProfile.fileNoImage !== 'default.png'
                              ? `${API_BASE.replace('/api/nextjs', '')}/passport/${activeStaffProfile.fileNoImage}`
                              : '/default-avatar.png')
                          }
                          alt="Passport"
                          className={styles.profileAvatar}
                          onError={(e) => {
                            e.target.src = '/default-avatar.png';
                          }}
                        />
                        <div className={styles.profileMeta}>
                          <h3>
                            {[
                              activeStaffProfile.staffFullDetails?.title,
                              activeStaffProfile.staffFullDetails?.surname,
                              activeStaffProfile.staffFullDetails?.first_name,
                              activeStaffProfile.staffFullDetails?.othernames
                            ]
                              .filter(Boolean)
                              .join(' ')}
                          </h3>
                          <p>File No: {activeStaffProfile.staffFullDetails?.fileNo || '—'}</p>
                        </div>
                      </div>

                      <div className={styles.sectionHeader} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>Bio-Data</span>
                        <Link href={`/dashboard/hr/employees/documentation/${staffId}?step=1`} target="_blank" className={styles.editSectionBtn} title="Edit Bio-Data">
                          <Edit size={16} />
                        </Link>
                      </div>
                      <div className={styles.detailGrid}>
                        <div className={styles.detailItem}>
                          <div className={styles.detailLabel}>Gender</div>
                          <div className={styles.detailVal}>{activeStaffProfile.staffFullDetails?.gender || '—'}</div>
                        </div>
                        <div className={styles.detailItem}>
                          <div className={styles.detailLabel}>Date of Birth</div>
                          <div className={styles.detailVal}>{activeStaffProfile.staffFullDetails?.dob || '—'}</div>
                        </div>
                        <div className={styles.detailItem}>
                          <div className={styles.detailLabel}>Place of Birth</div>
                          <div className={styles.detailVal}>
                            {activeStaffProfile.staffFullDetails?.place_of_birth_name ||
                              activeStaffProfile.staffFullDetails?.placeofbirth ||
                              '—'}
                          </div>
                        </div>
                        <div className={styles.detailItem}>
                          <div className={styles.detailLabel}>Phone</div>
                          <div className={styles.detailVal}>{activeStaffProfile.staffFullDetails?.phone || '—'}</div>
                        </div>
                        <div className={styles.detailItem}>
                          <div className={styles.detailLabel}>Email</div>
                          <div className={styles.detailVal}>{activeStaffProfile.staffFullDetails?.email || '—'}</div>
                        </div>
                        <div className={styles.detailItem}>
                          <div className={styles.detailLabel}>Marital Status</div>
                          <div className={styles.detailVal}>{activeStaffProfile.staffFullDetails?.maritalstatus || '—'}</div>
                        </div>
                        <div className={styles.detailItem}>
                          <div className={styles.detailLabel}>State of Origin</div>
                          <div className={styles.detailVal}>{activeStaffProfile.staffFullDetails?.State || '—'}</div>
                        </div>
                        <div className={styles.detailItem}>
                          <div className={styles.detailLabel}>Nationality</div>
                          <div className={styles.detailVal}>{activeStaffProfile.staffFullDetails?.nationality || '—'}</div>
                        </div>
                        <div className={styles.detailItem} style={{ gridColumn: 'span 2' }}>
                          <div className={styles.detailLabel}>Home Address</div>
                          <div className={styles.detailVal}>{activeStaffProfile.staffFullDetails?.home_address || '—'}</div>
                        </div>
                      </div>

                      {/* Spouse details */}
                      <div className={styles.sectionHeader} style={{ marginTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>Particulars of Spouse</span>
                        <Link href={`/dashboard/hr/employees/documentation/${staffId}?step=5`} target="_blank" className={styles.editSectionBtn} title="Edit Spouse Details">
                          <Edit size={16} />
                        </Link>
                      </div>
                      {activeStaffProfile.wifeDetails && activeStaffProfile.wifeDetails.length > 0 ? (
                        <table className={styles.subTable}>
                          <thead>
                            <tr>
                              <th>Name</th>
                              <th>Date of Birth</th>
                              <th>Marriage Date</th>
                            </tr>
                          </thead>
                          <tbody>
                            {activeStaffProfile.wifeDetails.map((w, idx) => (
                              <tr key={idx}>
                                <td>{w.wifename}</td>
                                <td>{w.wifedateofbirth}</td>
                                <td>{w.dateofmarriage}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <p style={{ fontSize: '0.85rem', color: 'var(--secondary)' }}>No spouse records found.</p>
                      )}

                      {/* Next of Kin */}
                      <div className={styles.sectionHeader} style={{ marginTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>Next of Kin</span>
                        <Link href={`/dashboard/hr/employees/documentation/${staffId}?step=6`} target="_blank" className={styles.editSectionBtn} title="Edit Next of Kin">
                          <Edit size={16} />
                        </Link>
                      </div>
                      {activeStaffProfile.nextOfKin && activeStaffProfile.nextOfKin.length > 0 ? (
                        <table className={styles.subTable}>
                          <thead>
                            <tr>
                              <th>Name</th>
                              <th>Address</th>
                              <th>Relationship</th>
                              <th>Phone No.</th>
                            </tr>
                          </thead>
                          <tbody>
                            {activeStaffProfile.nextOfKin.map((n, idx) => (
                              <tr key={idx}>
                                <td>{n.fullname}</td>
                                <td>{n.address}</td>
                                <td>{n.relationship}</td>
                                <td>{n.phoneno}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <p style={{ fontSize: '0.85rem', color: 'var(--secondary)' }}>No Next of Kin records found.</p>
                      )}

                      {/* Children details */}
                      <div className={styles.sectionHeader} style={{ marginTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>Particulars of Children</span>
                        <Link href={`/dashboard/hr/employees/documentation/${staffId}?step=7`} target="_blank" className={styles.editSectionBtn} title="Edit Children Particulars">
                          <Edit size={16} />
                        </Link>
                      </div>
                      {activeStaffProfile.children && activeStaffProfile.children.length > 0 ? (
                        <table className={styles.subTable}>
                          <thead>
                            <tr>
                              <th>Name</th>
                              <th>Sex</th>
                              <th>Date of Birth</th>
                            </tr>
                          </thead>
                          <tbody>
                            {activeStaffProfile.children.map((c, idx) => (
                              <tr key={idx}>
                                <td>{c.fullname}</td>
                                <td>{c.gender_name || c.gender}</td>
                                <td>{c.dateofbirth}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <p style={{ fontSize: '0.85rem', color: 'var(--secondary)' }}>No children records found.</p>
                      )}
                    </>
                  )}

                  {modalTab === 'employment' && (
                    <>
                      <div className={styles.sectionHeader} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>Employment Information</span>
                        <Link href={`/dashboard/hr/employees/documentation/${staffId}?step=1`} target="_blank" className={styles.editSectionBtn} title="Edit Employment Info">
                          <Edit size={16} />
                        </Link>
                      </div>
                      <div className={styles.detailGrid}>
                        <div className={styles.detailItem}>
                          <div className={styles.detailLabel}>Designation</div>
                          <div className={styles.detailVal}>{activeStaffProfile.staffFullDetails?.designation || '—'}</div>
                        </div>
                        <div className={styles.detailItem}>
                          <div className={styles.detailLabel}>Department</div>
                          <div className={styles.detailVal}>{activeStaffProfile.staffFullDetails?.department || '—'}</div>
                        </div>
                        <div className={styles.detailItem}>
                          <div className={styles.detailLabel}>Date of Appointment</div>
                          <div className={styles.detailVal}>{activeStaffProfile.staffFullDetails?.doj || '—'}</div>
                        </div>
                        <div className={styles.detailItem}>
                          <div className={styles.detailLabel}>Incremental Date</div>
                          <div className={styles.detailVal}>{activeStaffProfile.staffFullDetails?.incremental_date || '—'}</div>
                        </div>
                      </div>

                      <div className={styles.sectionHeader} style={{ marginTop: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>Salary & Bank Details</span>
                        <Link href={`/dashboard/hr/employees/documentation/${staffId}?step=10`} target="_blank" className={styles.editSectionBtn} title="Edit Salary & Bank Details">
                          <Edit size={16} />
                        </Link>
                      </div>
                      <div className={styles.detailGrid}>
                        <div className={styles.detailItem}>
                          <div className={styles.detailLabel}>Bank Name</div>
                          <div className={styles.detailVal}>{activeStaffProfile.staffFullDetails?.bank || '—'}</div>
                        </div>
                        <div className={styles.detailItem}>
                          <div className={styles.detailLabel}>Account Number</div>
                          <div className={styles.detailVal}>{activeStaffProfile.staffFullDetails?.AccNo || '—'}</div>
                        </div>
                        <div className={styles.detailItem}>
                          <div className={styles.detailLabel}>Bank Branch</div>
                          <div className={styles.detailVal}>{activeStaffProfile.staffFullDetails?.bank_branch || '—'}</div>
                        </div>
                        <div className={styles.detailItem}>
                          <div className={styles.detailLabel}>NHF Number</div>
                          <div className={styles.detailVal}>{activeStaffProfile.staffFullDetails?.nhfNo || '—'}</div>
                        </div>
                      </div>
                    </>
                  )}

                  {modalTab === 'education' && (
                    <>
                      <div className={styles.sectionHeader} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>Education History</span>
                        <Link href={`/dashboard/hr/employees/documentation/${staffId}?step=4`} target="_blank" className={styles.editSectionBtn} title="Edit Education History">
                          <Edit size={16} />
                        </Link>
                      </div>
                      {activeStaffProfile.education && activeStaffProfile.education.length > 0 ? (
                        <table className={styles.subTable}>
                          <thead>
                            <tr>
                              <th>Qualifications</th>
                              <th>Schools Attended</th>
                              <th>From</th>
                              <th>To</th>
                              <th>Certificates</th>
                              <th>Certificate File</th>
                            </tr>
                          </thead>
                          <tbody>
                            {activeStaffProfile.education.map((e, idx) => (
                              <tr key={idx}>
                                <td>{e.degreequalification}</td>
                                <td>{e.schoolattended}</td>
                                <td>{e.schoolfrom}</td>
                                <td>{e.schoolto}</td>
                                <td>{e.certificateheld}</td>
                                <td>
                                  {e.document ? (
                                    <a
                                      href={(e.document.startsWith('data:') || e.document.startsWith('http')) ? e.document : `${STORAGE_BASE}/${e.document}`}
                                      target="_blank"
                                      rel="noreferrer"
                                      style={{
                                        color: 'var(--primary)',
                                        textDecoration: 'underline',
                                        fontWeight: '600',
                                      }}
                                    >
                                      View File
                                    </a>
                                  ) : (
                                    <span style={{ color: 'var(--secondary)' }}>None</span>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <p style={{ fontSize: '0.85rem', color: 'var(--secondary)' }}>No education records found.</p>
                      )}
                    </>
                  )}

                  {modalTab === 'service' && (
                    <>
                      <div className={styles.sectionHeader} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>Previous Service Records</span>
                        <Link href={`/dashboard/hr/employees/documentation/${staffId}?step=8`} target="_blank" className={styles.editSectionBtn} title="Edit Previous Service Records">
                          <Edit size={16} />
                        </Link>
                      </div>
                      {activeStaffProfile.previousService && activeStaffProfile.previousService.length > 0 ? (
                        <table className={styles.subTable}>
                          <thead>
                            <tr>
                              <th>Employer</th>
                              <th>From</th>
                              <th>To</th>
                              <th>Previous Pay</th>
                              <th>File Ref.</th>
                            </tr>
                          </thead>
                          <tbody>
                            {activeStaffProfile.previousService.map((p, idx) => (
                              <tr key={idx}>
                                <td>{p.previousSchudule}</td>
                                <td>{p.fromDate}</td>
                                <td>{p.toDate}</td>
                                <td>₦{Number(p.totalPreviousPay || 0).toLocaleString()}</td>
                                <td>{p.filePageRef}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <p style={{ fontSize: '0.85rem', color: 'var(--secondary)' }}>No previous service records found.</p>
                      )}

                      <div className={styles.sectionHeader} style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>Service in the Forces</span>
                        <Link href={`/dashboard/hr/employees/documentation/${staffId}?step=12`} target="_blank" className={styles.editSectionBtn} title="Edit Service in the Forces">
                          <Edit size={16} />
                        </Link>
                      </div>
                      {activeStaffProfile.detailsService && activeStaffProfile.detailsService.length > 0 ? (
                        <table className={styles.subTable}>
                          <thead>
                            <tr>
                              <th>Arm of Service</th>
                              <th>Service Number</th>
                              <th>Last Unit</th>
                              <th>Reason for Leaving</th>
                            </tr>
                          </thead>
                          <tbody>
                            {activeStaffProfile.detailsService.map((d, idx) => (
                              <tr key={idx}>
                                <td>{d.armOfservice}</td>
                                <td>{d.serviceNumber}</td>
                                <td>{d.lastUnit}</td>
                                <td>{d.reasonForLeaving}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <p style={{ fontSize: '0.85rem', color: 'var(--secondary)' }}>No forces service records found.</p>
                      )}
                    </>
                  )}

                  {modalTab === 'censures' && (
                    <>
                      <div className={styles.sectionHeader}>Leave Records</div>
                      {activeStaffProfile.tourLeaveRecord && activeStaffProfile.tourLeaveRecord.length > 0 ? (
                        <table className={styles.subTable}>
                          <thead>
                            <tr>
                              <th>Leave Type</th>
                              <th>From</th>
                              <th>To</th>
                              <th>Days</th>
                            </tr>
                          </thead>
                          <tbody>
                            {activeStaffProfile.tourLeaveRecord.map((l, idx) => (
                              <tr key={idx}>
                                <td>{l.typeleave}</td>
                                <td>{l.leavefrom}</td>
                                <td>{l.leaveto}</td>
                                <td>{l.numberday}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <p style={{ fontSize: '0.85rem', color: 'var(--secondary)' }}>No leave records found.</p>
                      )}

                      <div className={styles.sectionHeader} style={{ marginTop: '1.5rem' }}>Censures & Recommendations</div>
                      {activeStaffProfile.censure && activeStaffProfile.censure.length > 0 ? (
                        <table className={styles.subTable}>
                          <thead>
                            <tr>
                              <th>Authority</th>
                              <th>Nature</th>
                              <th>Date</th>
                            </tr>
                          </thead>
                          <tbody>
                            {activeStaffProfile.censure.map((c, idx) => (
                              <tr key={idx}>
                                <td>{c.authority}</td>
                                <td>{c.nature}</td>
                                <td>{c.censureDate}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <p style={{ fontSize: '0.85rem', color: 'var(--secondary)' }}>No censures or recommendations found.</p>
                      )}
                    </>
                  )}

                  {modalTab === 'attachments' && (
                    <>
                      <div className={styles.sectionHeader} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>Staff Attachments & Uploaded Documents</span>
                        <Link href={`/dashboard/hr/employees/documentation/${staffId}?step=9`} target="_blank" className={styles.editSectionBtn} title="Edit Attachments">
                          <Edit size={16} />
                        </Link>
                      </div>
                      {activeStaffProfile.attachments && activeStaffProfile.attachments.length > 0 ? (
                        <table className={styles.subTable}>
                          <thead>
                            <tr>
                              <th>Document Description</th>
                              <th>View Document</th>
                            </tr>
                          </thead>
                          <tbody>
                            {activeStaffProfile.attachments.map((a, idx) => (
                              <tr key={idx}>
                                <td>{a.filedesc}</td>
                                <td>
                                  <a
                                    href={a.filepath}
                                    target="_blank"
                                    rel="noreferrer"
                                    style={{
                                      color: 'var(--primary)',
                                      textDecoration: 'underline',
                                      fontWeight: '600',
                                    }}
                                  >
                                    View File
                                  </a>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <p style={{ fontSize: '0.85rem', color: 'var(--secondary)' }}>No documents uploaded for this staff member.</p>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </motion.div>
  );
}
