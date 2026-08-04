"use client";

import { useState, useEffect } from 'react';
import { useSession } from '../../contexts/SessionContext';
import { useSidebar } from '../../contexts/SidebarContext';
import ThemeToggle from './ThemeToggle';
import { Bell, User, Menu, KeyRound, LogOut, ChevronDown } from 'lucide-react';
import styles from './Navbar.module.css';

import Link from 'next/link';

export default function Navbar() {
  const { user, activeRole, logout } = useSession();
  const { toggleSidebar } = useSidebar();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // Close dropdown on window click if open
  useEffect(() => {
    if (!dropdownOpen) return;
    const handleClose = () => setDropdownOpen(false);
    window.addEventListener('click', handleClose);
    return () => window.removeEventListener('click', handleClose);
  }, [dropdownOpen]);

  return (
    <header className={styles.navbar}>
      <div className={styles.left}>
        <button className={styles.menuBtn} onClick={toggleSidebar}>
          <Menu size={20} />
        </button>
        <h2 className={styles.title}>Isalu HRMS</h2>
      </div>

      <div className={styles.right}>
        <ThemeToggle />
        <button className={styles.iconBtn}>
          <Bell size={20} />
        </button>
        <div 
          className={styles.userInfo}
          onClick={(e) => {
            e.stopPropagation();
            setDropdownOpen(!dropdownOpen);
          }}
          style={{ cursor: 'pointer', position: 'relative' }}
        >
          <div className={styles.avatarWrapper}>
            <div className={styles.avatar}>
              {user?.passport_url ? (
                <img
                  src={
                    user.passport_url.startsWith('http') || user.passport_url.startsWith('data:')
                      ? user.passport_url
                      : `${process.env.NEXT_PUBLIC_STORAGE_URL || 'http://127.0.0.1:8000/storage'}/${user.passport_url}`
                  }
                  alt="User Passport"
                  className={styles.avatarImg}
                />
              ) : (
                <User size={20} />
              )}
            </div>
          </div>
          <div className={styles.details}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <span className={styles.name}>
                {user?.user_type?.toLowerCase() === 'technical' ? 'Super Admin' : (user?.name || 'Guest')}
              </span>
              <ChevronDown size={14} style={{ transform: dropdownOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', color: 'var(--navbar-color)' }} />
            </div>
            {/* <span className={styles.role}>{activeRole?.name || 'No Role'}</span> */}
          </div>

          {dropdownOpen && (
            <div className={styles.dropdownMenu} onClick={(e) => e.stopPropagation()}>
              <Link href="/dashboard/settings/edit-account" className={styles.dropdownItem} onClick={() => setDropdownOpen(false)}>
                <KeyRound size={14} />
                Change Password
              </Link>
              <button 
                onClick={() => {
                  setDropdownOpen(false);
                  logout();
                }} 
                className={styles.dropdownItem}
                style={{ background: 'none', border: 'none', width: '100%', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}
              >
                <LogOut size={14} />
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
