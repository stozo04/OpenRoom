/**
 * MysteryApp — cooperative murder-mystery Vibe app.
 *
 * Steven (human) + Kayley (AI) play detectives together. Neither knows the
 * killer. A GM subprocess at ws://localhost:5182 holds the LOCKED truth.
 *
 * This component:
 *   - renders the case dossier (suspects / locations / evidence / chat)
 *   - dispatches 5 action types to the GM via useGMSocket
 *   - listens for CharacterAppActions forwarded from Kayley's brain
 *     (via vibeContainerMock) and pipes them to the same GM pathway so both
 *     detectives investigate through the same door
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Search, ScrollText, MapPin, Users, Gavel, X } from 'lucide-react';
import { initVibeApp, AppLifecycle } from '@gui/vibe-container';
import {
  reportAction,
  reportLifecycle,
  useAgentActionListener,
  generateId,
  type CharacterAppAction,
} from '@/lib';
import styles from './index.module.scss';
import {
  ACTION_COLLECT_EVIDENCE,
  ACTION_EXAMINE_LOCATION,
  ACTION_INTERROGATE,
  ACTION_MAKE_ACCUSATION,
  ACTION_READ_DOSSIER,
  MYSTERY_ACTIONS,
} from './actions/constants';
import { useGMSocket } from './hooks/useGMSocket';
import { LOCATIONS, SCENARIO_TAGLINE, SCENARIO_TITLE, SUSPECTS, VICTIM_NAME, VICTIM_ROLE } from './scenario';
import type {
  AccusationPayload,
  ChatEntry,
  EvidenceItem,
  LocationId,
  MysteryActionResponse,
  SuspectDemeanor,
  SuspectId,
} from './types';

// ============ Constants ============
const APP_ID = 17;
const APP_NAME = 'MysteryApp';

// ============ Helpers ============
function appendChat(prev: ChatEntry[], entry: Omit<ChatEntry, 'id' | 'ts'>): ChatEntry[] {
  return [...prev, { ...entry, id: generateId(), ts: Date.now() }];
}

function mergeEvidence(prev: EvidenceItem[], incoming: EvidenceItem[] | undefined): EvidenceItem[] {
  if (!incoming || incoming.length === 0) return prev;
  const seen = new Set(prev.map((e) => e.id));
  const additions = incoming.filter((e) => e && e.id && !seen.has(e.id));
  return additions.length === 0 ? prev : [...prev, ...additions];
}

function mergeDemeanor(
  prev: Partial<Record<SuspectId, SuspectDemeanor>>,
  incoming: Partial<Record<SuspectId, SuspectDemeanor>> | undefined,
): Partial<Record<SuspectId, SuspectDemeanor>> {
  if (!incoming) return prev;
  return { ...prev, ...incoming };
}

// ============ Main Component ============
const MysteryApp: React.FC = () => {
  const [chat, setChat] = useState<ChatEntry[]>([
    {
      id: 'intro',
      kind: 'system',
      text: 'The party is still loud downstairs. Marcus is still dead upstairs. Start investigating.',
      ts: Date.now(),
    },
  ]);
  const [evidence, setEvidence] = useState<EvidenceItem[]>([]);
  const [demeanor, setDemeanor] = useState<Partial<Record<SuspectId, SuspectDemeanor>>>({});
  const [gameOver, setGameOver] = useState<MysteryActionResponse['game_over'] | null>(null);
  const [accuseOpen, setAccuseOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const chatScrollRef = useRef<HTMLDivElement>(null);
  const { status, lastError, sendAction } = useGMSocket();

  // Auto-scroll chat
  useEffect(() => {
    const el = chatScrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chat]);

  // ===== Core dispatch =====
  const dispatchMysteryAction = useCallback(
    async (action_type: string, params: Record<string, string>, label: string) => {
      setChat((prev) =>
        appendChat(prev, { kind: 'action', text: label }),
      );
      setBusy(true);
      try {
        const response = await sendAction({ action_type, params });
        if (response.error) {
          setChat((prev) =>
            appendChat(prev, { kind: 'error', text: 'GM: ' + response.error }),
          );
          return 'error: ' + response.error;
        }
        if (response.narrative) {
          setChat((prev) =>
            appendChat(prev, { kind: 'narrative', text: response.narrative }),
          );
        }
        if (response.evidence_unlocked?.length) {
          setEvidence((prev) => mergeEvidence(prev, response.evidence_unlocked));
        }
        if (response.suspect_demeanor) {
          setDemeanor((prev) => mergeDemeanor(prev, response.suspect_demeanor));
        }
        if (response.game_over) {
          setGameOver(response.game_over);
        }
        return 'success';
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn('[MysteryApp] action failed:', action_type, msg);
        setChat((prev) =>
          appendChat(prev, { kind: 'error', text: 'Action failed: ' + msg }),
        );
        return 'error: ' + msg;
      } finally {
        setBusy(false);
      }
    },
    [sendAction],
  );

  // ===== User-triggered actions =====
  const handleInterrogate = useCallback(
    (suspect: SuspectId) => {
      const name = SUSPECTS.find((s) => s.id === suspect)?.name ?? suspect;
      void dispatchMysteryAction(
        ACTION_INTERROGATE,
        { suspect_id: suspect },
        'You press ' + name + ' for answers.',
      );
      reportAction(APP_ID, ACTION_INTERROGATE, { suspect_id: suspect });
    },
    [dispatchMysteryAction],
  );

  const handleExamine = useCallback(
    (loc: LocationId) => {
      const name = LOCATIONS.find((l) => l.id === loc)?.name ?? loc;
      void dispatchMysteryAction(
        ACTION_EXAMINE_LOCATION,
        { location_id: loc },
        'You examine ' + name + '.',
      );
      reportAction(APP_ID, ACTION_EXAMINE_LOCATION, { location_id: loc });
    },
    [dispatchMysteryAction],
  );

  const handleDossier = useCallback(
    (suspect: SuspectId) => {
      const name = SUSPECTS.find((s) => s.id === suspect)?.name ?? suspect;
      void dispatchMysteryAction(
        ACTION_READ_DOSSIER,
        { suspect_id: suspect },
        'You open the dossier on ' + name + '.',
      );
      reportAction(APP_ID, ACTION_READ_DOSSIER, { suspect_id: suspect });
    },
    [dispatchMysteryAction],
  );

  const handleCollect = useCallback(
    (evidence_id: string) => {
      void dispatchMysteryAction(
        ACTION_COLLECT_EVIDENCE,
        { evidence_id },
        'You bag the evidence: ' + evidence_id,
      );
      reportAction(APP_ID, ACTION_COLLECT_EVIDENCE, { evidence_id });
    },
    [dispatchMysteryAction],
  );

  const handleAccuse = useCallback(
    (payload: AccusationPayload) => {
      const name = SUSPECTS.find((s) => s.id === payload.killer_id)?.name ?? payload.killer_id;
      void dispatchMysteryAction(
        ACTION_MAKE_ACCUSATION,
        {
          killer_id: payload.killer_id,
          motive: payload.motive,
          weapon: payload.weapon,
          method: payload.method,
        },
        'You accuse ' + name + '.',
      );
      reportAction(APP_ID, ACTION_MAKE_ACCUSATION, {
        killer_id: payload.killer_id,
        motive: payload.motive,
        weapon: payload.weapon,
        method: payload.method,
      });
      setAccuseOpen(false);
    },
    [dispatchMysteryAction],
  );

  // ===== Agent (Kayley) dispatched actions =====
  const handleAgentAction = useCallback(
    async (action: CharacterAppAction): Promise<string> => {
      const t = action.action_type;
      if (!MYSTERY_ACTIONS.includes(t as (typeof MYSTERY_ACTIONS)[number])) {
        return 'error: unknown action_type ' + t;
      }
      const params = (action.params || {}) as Record<string, string>;
      const label =
        'Kayley → ' +
        t +
        (Object.keys(params).length ? ' ' + JSON.stringify(params) : '');
      return dispatchMysteryAction(t, params, label);
    },
    [dispatchMysteryAction],
  );
  useAgentActionListener(APP_ID, handleAgentAction);

  // ===== Lifecycle handshake =====
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        reportLifecycle(AppLifecycle.LOADING);
        const mgr = await initVibeApp({
          id: APP_ID,
          url: window.location.href,
          type: 'game',
          name: APP_NAME,
          windowStyle: { width: 960, height: 680 },
        });
        mgr.handshake({
          id: APP_ID,
          url: window.location.href,
          type: 'game',
          name: APP_NAME,
          windowStyle: { width: 960, height: 680 },
        });
        reportLifecycle(AppLifecycle.DOM_READY);
        if (cancelled) return;
        reportLifecycle(AppLifecycle.LOADED);
        mgr.ready();
      } catch (err) {
        if (!cancelled) {
          console.error('[MysteryApp] init failed:', err);
          reportLifecycle(AppLifecycle.ERROR, String(err));
        }
      }
    })();
    return () => {
      cancelled = true;
      reportLifecycle(AppLifecycle.UNLOADING);
      reportLifecycle(AppLifecycle.DESTROYED);
    };
  }, []);

  // ===== Derived =====
  const statusDot = useMemo(() => {
    if (status === 'open') return { color: '#22c55e', label: 'GM connected' };
    if (status === 'connecting') return { color: '#FAEA5F', label: 'Connecting to GM…' };
    if (status === 'error') return { color: '#ef4444', label: 'GM unreachable' };
    return { color: '#888', label: 'GM disconnected' };
  }, [status]);

  // ============ Render ============
  return (
    <div className={styles.mystery}>
      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.caseLabel}>CASE FILE</div>
          <h1 className={styles.title}>{SCENARIO_TITLE}</h1>
          <p className={styles.tagline}>{SCENARIO_TAGLINE}</p>
          <div className={styles.victim}>
            Victim: <strong>{VICTIM_NAME}</strong> — {VICTIM_ROLE}
          </div>
        </div>
        <div className={styles.headerRight}>
          <div className={styles.statusRow}>
            <span className={styles.statusDot} style={{ background: statusDot.color }} />
            <span>{statusDot.label}</span>
          </div>
          {lastError && <div className={styles.errorText}>{lastError}</div>}
          <button
            type="button"
            className={styles.accuseButton}
            disabled={busy || !!gameOver || status !== 'open'}
            onClick={() => setAccuseOpen(true)}
          >
            <Gavel size={16} /> Make Accusation
          </button>
        </div>
      </header>

      <div className={styles.body}>
        {/* Left column: suspects + locations */}
        <aside className={styles.leftCol}>
          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <Users size={16} />
              <span>Suspects</span>
            </div>
            <div className={styles.suspectGrid}>
              {SUSPECTS.map((s) => {
                const mood = demeanor[s.id];
                return (
                  <div key={s.id} className={styles.suspectCard}>
                    <div className={styles.headshot} aria-label={s.name + ' portrait placeholder'}>
                      {s.name
                        .split(' ')
                        .map((w) => w[0])
                        .slice(0, 2)
                        .join('')}
                    </div>
                    <div className={styles.suspectName}>{s.name}</div>
                    <div className={styles.suspectRole}>{s.role}</div>
                    <div className={styles.suspectBlurb}>{s.blurb}</div>
                    {mood && <div className={styles.demeanorChip}>{mood}</div>}
                    <div className={styles.suspectActions}>
                      <button
                        type="button"
                        disabled={busy || !!gameOver || status !== 'open'}
                        onClick={() => handleDossier(s.id)}
                      >
                        <ScrollText size={12} /> Dossier
                      </button>
                      <button
                        type="button"
                        disabled={busy || !!gameOver || status !== 'open'}
                        onClick={() => handleInterrogate(s.id)}
                      >
                        <Search size={12} /> Interrogate
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <MapPin size={16} />
              <span>Locations</span>
            </div>
            <ul className={styles.locationList}>
              {LOCATIONS.map((loc) => (
                <li key={loc.id}>
                  <button
                    type="button"
                    className={styles.locationBtn}
                    disabled={busy || !!gameOver || status !== 'open'}
                    onClick={() => handleExamine(loc.id)}
                  >
                    <div className={styles.locationName}>{loc.name}</div>
                    <div className={styles.locationHint}>{loc.hint}</div>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </aside>

        {/* Middle: interrogation chat */}
        <section className={styles.chatPanel}>
          <div className={styles.panelHeader}>
            <Search size={16} />
            <span>Investigation Log</span>
          </div>
          <div className={styles.chatScroll} ref={chatScrollRef}>
            {chat.map((entry) => (
              <div key={entry.id} className={styles['chat_' + entry.kind]}>
                {entry.text}
              </div>
            ))}
            {busy && <div className={styles.chat_system}>GM is thinking…</div>}
          </div>
        </section>

        {/* Right column: evidence board */}
        <aside className={styles.evidenceCol}>
          <div className={styles.panelHeader}>
            <ScrollText size={16} />
            <span>Evidence Board</span>
          </div>
          {evidence.length === 0 ? (
            <div className={styles.emptyEvidence}>
              No evidence collected yet. Examine locations and interrogate suspects.
            </div>
          ) : (
            <ul className={styles.evidenceList}>
              {evidence.map((ev) => (
                <li key={ev.id} className={styles.evidenceItem}>
                  <div className={styles.evidenceId}>{ev.id}</div>
                  <div className={styles.evidenceDesc}>{ev.description}</div>
                  {ev.source && <div className={styles.evidenceSource}>Source: {ev.source}</div>}
                  <button
                    type="button"
                    className={styles.evidenceCollect}
                    disabled={busy || !!gameOver || status !== 'open'}
                    onClick={() => handleCollect(ev.id)}
                  >
                    Collect
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>

      {accuseOpen && (
        <AccusationModal
          onClose={() => setAccuseOpen(false)}
          onSubmit={handleAccuse}
          disabled={busy}
        />
      )}

      {gameOver && (
        <GameOverModal gameOver={gameOver} onClose={() => setGameOver(null)} />
      )}
    </div>
  );
};

// ============ Accusation Modal ============
const AccusationModal: React.FC<{
  onClose: () => void;
  onSubmit: (payload: AccusationPayload) => void;
  disabled: boolean;
}> = ({ onClose, onSubmit, disabled }) => {
  const [killerId, setKillerId] = useState<SuspectId>(SUSPECTS[0].id);
  const [motive, setMotive] = useState('');
  const [weapon, setWeapon] = useState('');
  const [method, setMethod] = useState('');

  const canSubmit = motive.trim() && weapon.trim() && method.trim() && !disabled;

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2>Formal Accusation</h2>
          <button type="button" className={styles.modalClose} onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <p className={styles.modalSubtitle}>
          One shot. Be specific about motive, weapon, and method.
        </p>
        <label className={styles.field}>
          <span>Killer</span>
          <select
            value={killerId}
            onChange={(e) => setKillerId(e.target.value as SuspectId)}
          >
            {SUSPECTS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} — {s.role}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.field}>
          <span>Motive</span>
          <input
            type="text"
            value={motive}
            onChange={(e) => setMotive(e.target.value)}
            placeholder="e.g. financial ruin from the Series C dilution"
          />
        </label>
        <label className={styles.field}>
          <span>Weapon</span>
          <input
            type="text"
            value={weapon}
            onChange={(e) => setWeapon(e.target.value)}
            placeholder="e.g. fentanyl-laced whiskey"
          />
        </label>
        <label className={styles.field}>
          <span>Method</span>
          <textarea
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            rows={3}
            placeholder="Exactly how and when was it done?"
          />
        </label>
        <div className={styles.modalActions}>
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className={styles.modalPrimary}
            disabled={!canSubmit}
            onClick={() =>
              onSubmit({ killer_id: killerId, motive: motive.trim(), weapon: weapon.trim(), method: method.trim() })
            }
          >
            Accuse
          </button>
        </div>
      </div>
    </div>
  );
};

// ============ Game Over Modal ============
const GameOverModal: React.FC<{
  gameOver: NonNullable<MysteryActionResponse['game_over']>;
  onClose: () => void;
}> = ({ gameOver, onClose }) => {
  const verdictClass = gameOver.correct ? styles.verdictWin : styles.verdictLose;
  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2 className={verdictClass}>
            {gameOver.correct ? 'CASE CLOSED' : 'WRONG CALL'}
          </h2>
          <button type="button" className={styles.modalClose} onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <p className={styles.reveal}>{gameOver.reveal}</p>
        <div className={styles.solutionBlock}>
          <div>
            <strong>Killer:</strong>{' '}
            {SUSPECTS.find((s) => s.id === gameOver.solution.killer_id)?.name ??
              gameOver.solution.killer_id}
          </div>
          <div>
            <strong>Motive:</strong> {gameOver.solution.motive}
          </div>
          <div>
            <strong>Weapon:</strong> {gameOver.solution.weapon}
          </div>
          <div>
            <strong>Method:</strong> {gameOver.solution.method}
          </div>
        </div>
        {!gameOver.correct && (
          <div className={styles.hint}>
            <AlertTriangle size={14} /> Reopen the case file and keep digging.
          </div>
        )}
      </div>
    </div>
  );
};

export default MysteryApp;
