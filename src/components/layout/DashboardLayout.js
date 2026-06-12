"use client";

import Navbar from './Navbar';
import Sidebar from './Sidebar';
import { SidebarProvider, useSidebar } from '@/contexts/SidebarContext';
import styles from './DashboardLayout.module.css';

function LayoutContent({ children }) {
  const { isCollapsed } = useSidebar();
  
  return (
    <div className={`${styles.layout} ${isCollapsed ? styles.collapsed : ''}`}>
      <Navbar />
      <div className={styles.mainContainer}>
        <Sidebar />
        <main className={`${styles.content} hide-scrollbar`}>
          <div className={styles.pageWrapper}>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

export default function DashboardLayout({ children }) {
  return (
    <SidebarProvider>
      <LayoutContent>{children}</LayoutContent>
    </SidebarProvider>
  );
}
