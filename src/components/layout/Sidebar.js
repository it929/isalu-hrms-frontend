"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from '../../contexts/SessionContext';
import { useSidebar } from '../../contexts/SidebarContext';
import { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  LayoutDashboard, 
  Users, 
  Settings, 
  ShieldCheck, 
  Briefcase,
  LogOut,
  ChevronDown,
  UserCircle,
  CalendarDays,
  TrendingUp,
  FileText,
  BookOpen,
  GraduationCap,
  Building2,
  ClipboardList,
  HeartPulse,
  Landmark,
  MapPin,
  ArrowRightLeft,
  Lock,
  Layers,
  Loader2,
  Sparkles,
} from 'lucide-react';
import NairaSign from '../ui/NairaSign';
import styles from './Sidebar.module.css';

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

function getModuleIcon(name) {
  const lower = name.toLowerCase();
  if (lower.includes('payroll') || lower.includes('salary')) return <NairaSign size={20} />;
  if (lower.includes('hr') || lower.includes('human') || lower.includes('employee')) return <Users size={20} />;
  if (lower.includes('role') || lower.includes('permission') || lower.includes('security') || lower.includes('assign')) return <ShieldCheck size={20} />;
  if (lower.includes('procure')) return <ClipboardList size={20} />;
  if (lower.includes('fund') || lower.includes('budget')) return <Landmark size={20} />;
  return <Layers size={20} />;
}

function getSubModuleIcon(name) {
  const lower = name.toLowerCase();
  if (lower.includes('resignation')) return <LogOut size={16} />;
  if (lower.includes('pension') || lower.includes('retention') || lower.includes('tax')) return <Landmark size={16} />;
  if (lower.includes('loan') || lower.includes('iou') || lower.includes('salary') || lower.includes('deduct') || lower.includes('refund')) return <NairaSign size={16} />;
  if (lower.includes('active') || lower.includes('date') || lower.includes('leave') || lower.includes('loa') || lower.includes('calendar')) return <CalendarDays size={16} />;
  if (lower.includes('setup') || lower.includes('control') || lower.includes('variable') || lower.includes('configure') || lower.includes('settings')) return <Settings size={16} />;
  if (lower.includes('record') || lower.includes('employee') || lower.includes('user') || lower.includes('profile')) return <UserCircle size={16} />;
  if (lower.includes('dept') || lower.includes('unit') || lower.includes('division') || lower.includes('office')) return <Building2 size={16} />;
  if (lower.includes('lga') || lower.includes('state') || lower.includes('map') || lower.includes('location')) return <MapPin size={16} />;
  return <Layers size={16} />;
}

export default function Sidebar() {
  const pathname = usePathname();
  const { logout } = useSession();
  const { isCollapsed, setIsCollapsed } = useSidebar();

  const getSubmodulesList = (submodules) => {
    if (!submodules) return [];
    return Array.isArray(submodules) ? submodules : Object.values(submodules);
  };
  
  const [sidebarData, setSidebarData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isHod, setIsHod] = useState(false);
  const [isActualHod, setIsActualHod] = useState(false);
  const [isHr, setIsHr] = useState(false);
  const [openDropdowns, setOpenDropdowns] = useState({});
  const [rolesOpen, setRolesOpen] = useState(pathname.startsWith('/dashboard/roles'));

  const isRolesActive = pathname.startsWith('/dashboard/roles');

  // Auto-collapse sidebar on mobile when navigating pages
  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth <= 768) {
      setIsCollapsed(true);
    }
  }, [pathname, setIsCollapsed]);

  const handleLogout = () => {
    logout();
    window.location.href = '/';
  };

  const topMenuItems = [
    { name: 'Dashboard', path: '/dashboard', icon: <LayoutDashboard size={20} /> },
  ];

  const bottomMenuItems = [];

  const rolesSubModules = [
    { name: 'Add Role',    path: '/dashboard/roles/create', icon: <ShieldCheck size={16} /> },
    { name: 'View Roles',  path: '/dashboard/roles/viewroles', icon: <ShieldCheck size={16} /> },
    { name: 'Add Module',  path: '/dashboard/roles/module-create', icon: <Layers size={16} /> },
    { name: 'Add Sub Module', path: '/dashboard/roles/submodule-create', icon: <Layers size={16} /> },
    { name: 'Assign Module', path: '/dashboard/roles/assign', icon: <Layers size={16} /> },
    { name: 'Assign User', path: '/dashboard/roles/assign-user', icon: <Users size={16} /> },
  ];

  // Fetch sidebar data
  useEffect(() => {
    const userId = getUserId();
    const cacheKey = userId ? `hrms_sidebar_links_cache_${userId}` : null;
    let hasCache = false;

    if (cacheKey && typeof window !== 'undefined') {
      try {
        const cached = sessionStorage.getItem(cacheKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          setSidebarData(parsed.sidebar || []);
          setIsAdmin(!!parsed.is_admin);
          setIsHod(!!parsed.is_hod);
          setIsActualHod(!!parsed.is_actual_hod);
          setIsHr(!!parsed.is_hr);
          setLoading(false);
          hasCache = true;
        }
      } catch (e) {
        console.error('Failed to parse cached sidebar links', e);
      }
    }

    async function loadSidebar() {
      const uid = getUserId();
      if (!uid) {
        setSidebarData([]);
        setLoading(false);
        return;
      }

      if (!hasCache) {
        setLoading(true);
      }
      const headers = buildHeaders();
      try {
        const res = await axios.get(`${API_BASE}/sidebar-links`, { headers });
        if (res.data.status === 'success') {
          setSidebarData(res.data.sidebar || []);
          setIsAdmin(!!res.data.is_admin);
          setIsHod(!!res.data.is_hod);
          setIsActualHod(!!res.data.is_actual_hod);
          setIsHr(!!res.data.is_hr);
          if (cacheKey && typeof window !== 'undefined') {
            sessionStorage.setItem(cacheKey, JSON.stringify({
              sidebar: res.data.sidebar || [],
              is_admin: !!res.data.is_admin,
              is_hod: !!res.data.is_hod,
              is_actual_hod: !!res.data.is_actual_hod,
              is_hr: !!res.data.is_hr
            }));
          }
        }
      } catch (err) {
        console.error('Failed to load sidebar links:', err);
      } finally {
        setLoading(false);
      }
    }
    loadSidebar();
  }, []);

  // Auto-expand active module based on current pathname
  useEffect(() => {
    if (sidebarData.length > 0) {
      const newOpen = {};
      sidebarData.forEach(mod => {
        const hasActiveSub = getSubmodulesList(mod.submodules).some(sub => pathname === sub.path);
        if (hasActiveSub) {
          newOpen[mod.moduleID] = true;
        }
      });
      setOpenDropdowns(prev => ({ ...prev, ...newOpen }));
    }
  }, [pathname, sidebarData]);

  const toggleDropdown = (moduleID) => {
    setOpenDropdowns(prev => ({
      ...prev,
      [moduleID]: !prev[moduleID]
    }));
  };

  // Group modules by link_type
  const groupedModules = {};
  sidebarData.forEach(item => {
    if (item.moduleID === 56 || getSubmodulesList(item.submodules).some(s => s.path?.includes('dashboard/roles/reports'))) {
      return;
    }
    const type = item.link_type != null ? String(item.link_type).toUpperCase() : 'GENERAL';
    if (!groupedModules[type]) {
      groupedModules[type] = [];
    }
    groupedModules[type].push(item);
  });

  const hasAiAnalyst = isAdmin || sidebarData.some(m => getSubmodulesList(m.submodules).some(s => s.path?.includes('ai-analyst')));
  const hasDocGen = isAdmin || sidebarData.some(m => getSubmodulesList(m.submodules).some(s => s.path?.includes('document-generator')));
  const hasReports = isAdmin || sidebarData.some(m => m.moduleID === 56 || getSubmodulesList(m.submodules).some(s => s.path?.includes('dashboard/roles/reports')));
  const hasRoleMgmt = isAdmin || sidebarData.some(m => m.moduleID === 'security_roles' || getSubmodulesList(m.submodules).some(s => s.id === 999));
  const hasSecurityGroup = hasAiAnalyst || hasDocGen || hasReports || hasRoleMgmt;

  return (
    <aside className={`${styles.sidebar} ${isCollapsed ? styles.collapsed : ''}`}>
      <nav className={styles.nav}>
        <ul className={styles.menuList}>
          {/* Top items */}
          {topMenuItems.map((item) => {
            const isActive = pathname === item.path;
            return (
              <li key={item.path}>
                <Link href={item.path} className={`${styles.menuItem} ${isActive ? styles.active : ''}`}>
                  <span className={styles.icon}>{item.icon}</span>
                  <span className={styles.text}>{item.name}</span>
                </Link>
              </li>
            );
          })}

          {/* Dynamic Groups & Modules */}
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem 1rem' }}>
              <Loader2 size={24} className={styles.spinner} />
            </div>
          ) : (
            Object.entries(groupedModules).map(([linkType, mods]) => (
              <div key={linkType} className={styles.groupContainer}>
                {!isCollapsed && (
                  <div className={styles.groupHeader}>
                    {linkType}
                  </div>
                )}
                <ul className={styles.groupList}>
                  {mods.map((mod) => {
                    const isOpen = !!openDropdowns[mod.moduleID];
                    const subList = getSubmodulesList(mod.submodules);
                    const hasActiveSub = subList.some(sub => pathname === sub.path);
                    return (
                      <li key={mod.moduleID}>
                        <button
                          className={`${styles.menuItem} ${styles.menuItemBtn} ${hasActiveSub ? styles.active : ''}`}
                          onClick={() => toggleDropdown(mod.moduleID)}
                          aria-expanded={isOpen}
                        >
                          <span className={styles.icon}>{getModuleIcon(mod.modulename)}</span>
                          <span className={styles.text}>{mod.modulename}</span>
                          <span className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ''}`}>
                            <ChevronDown size={16} />
                          </span>
                        </button>
 
                        <div className={`${styles.subMenu} ${isOpen ? styles.subMenuOpen : ''}`}>
                          <ul className={styles.subMenuList}>
                            {subList.map((sub) => {
                              const isSubActive = pathname === sub.path;
                              return (
                                <li key={sub.path}>
                                  <Link
                                    href={sub.path}
                                    className={`${styles.subMenuItem} ${isSubActive ? styles.subMenuItemActive : ''}`}
                                  >
                                    <span className={styles.subIcon}>{getSubModuleIcon(sub.name)}</span>
                                    <span>{sub.name}</span>
                                  </Link>
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))
          )}
 
          {/* SECURITY & ROLES section - renders AI Analyst, AI Document Generator, Role Management and Reports */}
          {hasSecurityGroup && !loading && (
            <div className={styles.groupContainer}>
              {!isCollapsed && (
                <div className={styles.groupHeader}>
                  SECURITY & ROLES
                </div>
              )}
              <ul className={styles.groupList}>
                {hasAiAnalyst && (
                  <li>
                    <Link
                      href="/dashboard/hr/ai-analyst"
                      className={`${styles.menuItem} ${pathname === '/dashboard/hr/ai-analyst' ? styles.active : ''}`}
                    >
                      <span className={styles.icon}><Sparkles size={20} style={{ color: '#3b82f6' }} /></span>
                      <span className={styles.text}>Ask AI Data Analyst</span>
                    </Link>
                  </li>
                )}

                {hasDocGen && (
                  <li>
                    <Link
                      href="/dashboard/hr/document-generator"
                      className={`${styles.menuItem} ${pathname === '/dashboard/hr/document-generator' ? styles.active : ''}`}
                    >
                      <span className={styles.icon}><Sparkles size={20} style={{ color: '#10b981' }} /></span>
                      <span className={styles.text}>AI Document Generator</span>
                    </Link>
                  </li>
                )}

                {hasRoleMgmt && (
                  <li>
                    <button
                      className={`${styles.menuItem} ${styles.menuItemBtn} ${(isRolesActive && pathname !== '/dashboard/roles/reports') ? styles.active : ''}`}
                      onClick={() => setRolesOpen((prev) => !prev)}
                      aria-expanded={rolesOpen}
                    >
                      <span className={styles.icon}><ShieldCheck size={20} /></span>
                      <span className={styles.text}>Role Management</span>
                      <span className={`${styles.chevron} ${rolesOpen ? styles.chevronOpen : ''}`}>
                        <ChevronDown size={16} />
                      </span>
                    </button>
 
                    <div className={`${styles.subMenu} ${rolesOpen ? styles.subMenuOpen : ''}`}>
                      <ul className={styles.subMenuList}>
                        {rolesSubModules
                          .filter((sub) => {
                            if (isAdmin) return true;
                            if (sub.path === '/dashboard/roles/assign-user') {
                              return sidebarData.some(m => getSubmodulesList(m.submodules).some(s => s.id === 999));
                            }
                            return false;
                          })
                          .map((sub) => {
                            const isSubActive = pathname === sub.path;
                            return (
                              <li key={sub.path}>
                                <Link
                                  href={sub.path}
                                  className={`${styles.subMenuItem} ${isSubActive ? styles.subMenuItemActive : ''}`}
                                >
                                  <span className={styles.subIcon}>{sub.icon}</span>
                                  <span>{sub.name}</span>
                                </Link>
                              </li>
                            );
                          })}
                      </ul>
                    </div>
                  </li>
                )}

                {hasReports && (
                  <li>
                    <Link
                      href="/dashboard/roles/reports"
                      className={`${styles.menuItem} ${pathname === '/dashboard/roles/reports' ? styles.active : ''}`}
                    >
                      <span className={styles.icon}><FileText size={20} /></span>
                      <span className={styles.text}>Reports</span>
                    </Link>
                  </li>
                )}
              </ul>
            </div>
          )}

          {/* HOD Menu - visible only to actual HODs (not delegated staff) */}
          {isActualHod && !loading && (
            <div className={styles.groupContainer}>
              {!isCollapsed && (
                <div className={styles.groupHeader}>
                  HOD PANEL
                </div>
              )}
              <ul className={styles.groupList}>
                <li>
                  <Link
                    href="/dashboard/hod/delegation"
                    className={`${styles.menuItem} ${pathname === '/dashboard/hod/delegation' ? styles.active : ''}`}
                  >
                    <span className={styles.icon}><ShieldCheck size={20} /></span>
                    <span className={styles.text}>Role Delegation</span>
                  </Link>
                </li>
              </ul>
            </div>
          )}




          {/* Bottom items */}
          {bottomMenuItems.map((item) => {
            const isActive = pathname === item.path || pathname.startsWith(`${item.path}/`);
            return (
              <li key={item.path}>
                <Link href={item.path} className={`${styles.menuItem} ${isActive ? styles.active : ''}`}>
                  <span className={styles.icon}>{item.icon}</span>
                  <span className={styles.text}>{item.name}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      
      <div className={styles.footer}>
        <button onClick={handleLogout} className={styles.logoutBtn}>
          <LogOut size={20} />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}
