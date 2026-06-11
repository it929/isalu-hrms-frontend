"use client";

import { useSession } from '../../contexts/SessionContext';
import { useSidebar } from '../../contexts/SidebarContext';
import ThemeToggle from './ThemeToggle';
import { Bell, User, Menu } from 'lucide-react';
import styles from './Navbar.module.css';

export default function Navbar() {
  const { user, activeRole } = useSession();
  const { toggleSidebar } = useSidebar();

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
        <div className={styles.userInfo}>
          <div className={styles.avatar}>
            <User size={20} />
          </div>
          <div className={styles.details}>
            <span className={styles.name}>
              {user?.user_type?.toLowerCase() === 'technical' ? 'Super Admin' : (user?.name || 'Guest')}
            </span>
            {/* <span className={styles.role}>{activeRole?.name || 'No Role'}</span> */}
          </div>
        </div>
      </div>
    </header>
  );
}
