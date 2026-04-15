import React, { useEffect } from 'react';
import { initVibeApp, AppLifecycle } from '@gui/vibe-container';
import { reportLifecycle, fetchVibeInfo } from '@/lib';
import { Heart } from 'lucide-react';
import styles from './index.module.scss';

// ============ Constants ============
const APP_ID = 16;

// ============ Main Component ============
const MemoryVault: React.FC = () => {
  useEffect(() => {
    const init = async () => {
      try {
        reportLifecycle(AppLifecycle.LOADING);
        const manager = await initVibeApp({
          id: APP_ID,
          url: window.location.href,
          type: 'page',
          name: 'MemoryVault',
          windowStyle: { width: 880, height: 600 },
        });
        manager.handshake({
          id: APP_ID,
          url: window.location.href,
          type: 'page',
          name: 'MemoryVault',
          windowStyle: { width: 880, height: 600 },
        });
        reportLifecycle(AppLifecycle.DOM_READY);

        try {
          await fetchVibeInfo();
        } catch (err) {
          console.warn('[MemoryVault] fetchVibeInfo failed:', err);
        }

        reportLifecycle(AppLifecycle.LOADED);
        manager.ready();
      } catch (err) {
        console.error('[MemoryVault] Init error:', err);
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
    <div className={styles.memoryvault}>
      <div className={styles.placeholder}>
        <Heart size={64} style={{ opacity: 0.3 }} />
        <div className={styles.title}>Memory Vault</div>
        <p className={styles.subtitle}>coming soon</p>
      </div>
    </div>
  );
};

export default MemoryVault;
