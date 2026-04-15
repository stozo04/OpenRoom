import React, { useEffect } from 'react';
import { initVibeApp, AppLifecycle } from '@gui/vibe-container';
import { reportLifecycle, fetchVibeInfo } from '@/lib';
import { BookOpen } from 'lucide-react';
import styles from './index.module.scss';

// ============ Constants ============
const APP_ID = 15;

// ============ Main Component ============
const BookWriter: React.FC = () => {
  useEffect(() => {
    const init = async () => {
      try {
        reportLifecycle(AppLifecycle.LOADING);
        const manager = await initVibeApp({
          id: APP_ID,
          url: window.location.href,
          type: 'page',
          name: 'BookWriter',
          windowStyle: { width: 880, height: 600 },
        });
        manager.handshake({
          id: APP_ID,
          url: window.location.href,
          type: 'page',
          name: 'BookWriter',
          windowStyle: { width: 880, height: 600 },
        });
        reportLifecycle(AppLifecycle.DOM_READY);

        try {
          await fetchVibeInfo();
        } catch (err) {
          console.warn('[BookWriter] fetchVibeInfo failed:', err);
        }

        reportLifecycle(AppLifecycle.LOADED);
        manager.ready();
      } catch (err) {
        console.error('[BookWriter] Init error:', err);
        reportLifecycle(AppLifecycle.ERROR, String(err));
      }
    };
    init();
    return () => {
      reportLifecycle(AppLifecycle.UNLOADING);
      reportLifecycle(AppLifecycle.DESTROYED);
    };
  }, []);

  return (
    <div className={styles.bookwriter}>
      <div className={styles.placeholder}>
        <BookOpen size={64} style={{ opacity: 0.3 }} />
        <div className={styles.title}>Book Writer</div>
        <p className={styles.subtitle}>coming soon</p>
      </div>
    </div>
  );
};

export default BookWriter;
