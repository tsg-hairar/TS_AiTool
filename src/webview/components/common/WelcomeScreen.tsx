// ===================================================
// WelcomeScreen -- מסך ברוכים הבאים למשתמשים חדשים
// ===================================================
// 4 שלבים: ברכה + שפה, חיבור, סוכנים, מוכן!
// עיצוב מרשים עם אנימציות, confetti, ו-RTL מלא
// ===================================================

import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useApp } from '../../state/AppContext';
import { BUILT_IN_AGENTS, BUILT_IN_WORKFLOWS, TIMEOUTS } from '../../../shared/constants';
import type { AgentId } from '../../../shared/types';
import { getDirection } from '../../i18n';

// -------------------------------------------------
// Constants
// -------------------------------------------------
const TOTAL_STEPS = 4;

const AGENT_IDS: AgentId[] = [
  'manager', 'architect', 'developer', 'qa', 'designer', 'security', 'writer',
];

// -------------------------------------------------
// Confetti Particle
// -------------------------------------------------
interface Particle {
  id: number;
  x: number;
  y: number;
  size: number;
  color: string;
  rotation: number;
  velocityX: number;
  velocityY: number;
  rotationSpeed: number;
  opacity: number;
  shape: 'circle' | 'square' | 'triangle';
}

const CONFETTI_COLORS = [
  '#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ec4899',
  '#06b6d4', '#ef4444', '#6366f1', '#14b8a6', '#f97316',
];

function createParticles(count: number): Particle[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    x: 50 + (Math.random() - 0.5) * 20,
    y: 30 + (Math.random() - 0.5) * 10,
    size: 4 + Math.random() * 6,
    color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
    rotation: Math.random() * 360,
    velocityX: (Math.random() - 0.5) * 8,
    velocityY: -3 - Math.random() * 5,
    rotationSpeed: (Math.random() - 0.5) * 12,
    opacity: 1,
    shape: (['circle', 'square', 'triangle'] as const)[Math.floor(Math.random() * 3)],
  }));
}

// -------------------------------------------------
// ConfettiCanvas Component
// -------------------------------------------------
function ConfettiCanvas({ active }: { active: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const particlesRef = useRef<Particle[]>([]);

  useEffect(() => {
    if (!active) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = canvas.offsetWidth * 2;
    canvas.height = canvas.offsetHeight * 2;
    ctx.scale(2, 2);

    particlesRef.current = createParticles(60);

    const w = canvas.offsetWidth;
    const h = canvas.offsetHeight;
    const gravity = 0.12;
    const drag = 0.98;

    function draw() {
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, w, h);

      let alive = false;
      for (const p of particlesRef.current) {
        if (p.opacity <= 0) continue;
        alive = true;

        p.velocityY += gravity;
        p.velocityX *= drag;
        p.x += p.velocityX * 0.5;
        p.y += p.velocityY * 0.5;
        p.rotation += p.rotationSpeed;

        if (p.y > 100) {
          p.opacity -= 0.015;
        }

        const px = (p.x / 100) * w;
        const py = (p.y / 100) * h;

        ctx.save();
        ctx.translate(px, py);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.globalAlpha = Math.max(0, p.opacity);
        ctx.fillStyle = p.color;

        if (p.shape === 'circle') {
          ctx.beginPath();
          ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
          ctx.fill();
        } else if (p.shape === 'square') {
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        } else {
          ctx.beginPath();
          ctx.moveTo(0, -p.size / 2);
          ctx.lineTo(p.size / 2, p.size / 2);
          ctx.lineTo(-p.size / 2, p.size / 2);
          ctx.closePath();
          ctx.fill();
        }

        ctx.restore();
      }

      if (alive) {
        animFrameRef.current = requestAnimationFrame(draw);
      }
    }

    animFrameRef.current = requestAnimationFrame(draw);

    return () => {
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
    };
  }, [active]);

  if (!active) return null;

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 z-20 pointer-events-none"
      style={{ width: '100%', height: '100%' }}
      aria-hidden="true"
    />
  );
}

// -------------------------------------------------
// Sparkle SVG for last step
// -------------------------------------------------
function SparkleIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M8 0l1.5 5.5L16 8l-6.5 2.5L8 16l-1.5-5.5L0 8l6.5-2.5z" />
    </svg>
  );
}

// ===================================================
// WelcomeScreen -- Main Component
// ===================================================
export function WelcomeScreen() {
  const { dispatch, sendMessage } = useApp();
  const { t, i18n } = useTranslation();

  const [currentStep, setCurrentStep] = useState(0);
  const [direction, setDirection] = useState<'next' | 'prev'>('next');
  const [selectedLang, setSelectedLang] = useState<'he' | 'en'>(
    (i18n.language as 'he' | 'en') || 'he',
  );
  const [connectionMode, setConnectionMode] = useState<'cli' | 'api'>('cli');
  const [apiKey, setApiKey] = useState('');
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [dontShowAgain, setDontShowAgain] = useState(true);
  const [hoveredAgent, setHoveredAgent] = useState<AgentId | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const testTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  // Trigger confetti on last step
  useEffect(() => {
    if (currentStep === TOTAL_STEPS - 1) {
      const timer = setTimeout(() => setShowConfetti(true), 300);
      return () => clearTimeout(timer);
    } else {
      setShowConfetti(false);
    }
  }, [currentStep]);

  // --- Navigation ---
  const goNext = useCallback(() => {
    if (currentStep < TOTAL_STEPS - 1) {
      setDirection('next');
      setCurrentStep((prev) => prev + 1);
    }
  }, [currentStep]);

  const goPrev = useCallback(() => {
    if (currentStep > 0) {
      setDirection('prev');
      setCurrentStep((prev) => prev - 1);
    }
  }, [currentStep]);

  const goToStep = useCallback(
    (step: number) => {
      setDirection(step > currentStep ? 'next' : 'prev');
      setCurrentStep(step);
    },
    [currentStep],
  );

  // --- Language change ---
  const handleLangChange = useCallback(
    (lang: 'he' | 'en') => {
      setSelectedLang(lang);
      i18n.changeLanguage(lang);
      sendMessage({ type: 'updateSettings', payload: { language: lang } });
    },
    [i18n, sendMessage],
  );

  // --- Complete / Skip ---
  const handleComplete = useCallback(() => {
    if (connectionMode === 'api' && apiKey) {
      sendMessage({ type: 'storeApiKey', payload: { apiKey } });
    }
    if (dontShowAgain) {
      sendMessage({ type: 'completeOnboarding' });
    }
    dispatch({ type: 'SET_ONBOARDING_SEEN', payload: true });
    dispatch({ type: 'SET_VIEW', payload: 'projects' });
  }, [connectionMode, apiKey, dontShowAgain, dispatch, sendMessage]);

  const handleSkip = useCallback(() => {
    sendMessage({ type: 'completeOnboarding' });
    dispatch({ type: 'SET_ONBOARDING_SEEN', payload: true });
    dispatch({ type: 'SET_VIEW', payload: 'projects' });
  }, [dispatch, sendMessage]);

  // Keyboard navigation (must be after callback declarations)
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const isRtl = getDirection(i18n.language) === 'rtl';

      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        const nextKey = isRtl ? 'ArrowLeft' : 'ArrowRight';
        const prevKey = isRtl ? 'ArrowRight' : 'ArrowLeft';

        if (e.key === nextKey && currentStep < TOTAL_STEPS - 1) {
          e.preventDefault();
          goNext();
        } else if (e.key === prevKey && currentStep > 0) {
          e.preventDefault();
          goPrev();
        }
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (currentStep < TOTAL_STEPS - 1) {
          goNext();
        } else {
          handleComplete();
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handleSkip();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentStep, i18n.language, goNext, goPrev, handleComplete, handleSkip]);

  // Cleanup test connection timers on unmount
  useEffect(() => {
    return () => {
      testTimersRef.current.forEach(clearTimeout);
      testTimersRef.current = [];
    };
  }, []);

  // --- Test connection ---
  const handleTestConnection = useCallback(() => {
    // Clear any previous test timers
    testTimersRef.current.forEach(clearTimeout);
    testTimersRef.current = [];

    setTestStatus('testing');
    sendMessage({ type: 'sendMessage', payload: { content: '/doctor' } });
    const t1 = setTimeout(() => {
      setTestStatus('success');
      const t2 = setTimeout(() => setTestStatus('idle'), TIMEOUTS.TEST_STATUS_RESET_MS);
      testTimersRef.current.push(t2);
    }, TIMEOUTS.TEST_CONNECTION_MS);
    testTimersRef.current.push(t1);
  }, [sendMessage]);

  // --- Quick actions from last step ---
  const handleQuickAction = useCallback(
    (action: 'chat' | 'project' | 'settings') => {
      sendMessage({ type: 'completeOnboarding' });
      dispatch({ type: 'SET_ONBOARDING_SEEN', payload: true });
      switch (action) {
        case 'chat':
          dispatch({ type: 'SET_VIEW', payload: 'chat' });
          break;
        case 'project':
          dispatch({ type: 'SET_VIEW', payload: 'projects' });
          break;
        case 'settings':
          dispatch({ type: 'SET_VIEW', payload: 'settings' });
          break;
      }
    },
    [dispatch, sendMessage],
  );

  const slideClass =
    direction === 'next' ? 'welcome-slide-next' : 'welcome-slide-prev';

  const isRtl = getDirection(i18n.language) === 'rtl';

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden"
      style={{ background: 'var(--vscode-editor-background)' }}
      dir={isRtl ? 'rtl' : 'ltr'}
      role="dialog"
      aria-modal="true"
      aria-label={t('welcome.ariaLabel')}
    >
      {/* Decorative background orbs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
        <div className="welcome-orb welcome-orb-1" />
        <div className="welcome-orb welcome-orb-2" />
        <div className="welcome-orb welcome-orb-3" />
        {/* Grid pattern */}
        <div className="welcome-grid-pattern" />
      </div>

      {/* Confetti on last step */}
      <ConfettiCanvas active={showConfetti} />

      {/* Progress dots */}
      <div
        className="relative z-10 flex items-center gap-2.5 mb-8"
        role="tablist"
        aria-label={t('welcome.progressLabel')}
      >
        {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
          <button
            key={i}
            role="tab"
            aria-selected={i === currentStep}
            aria-label={t('welcome.stepOf', { step: i + 1, total: TOTAL_STEPS })}
            className={`welcome-dot transition-all duration-300 rounded-full cursor-pointer ${
              i === currentStep
                ? 'w-10 h-3 welcome-dot-active'
                : i < currentStep
                  ? 'w-3 h-3 welcome-dot-completed'
                  : 'w-3 h-3 welcome-dot-pending'
            }`}
            onClick={() => goToStep(i)}
          />
        ))}
      </div>

      {/* Content area */}
      <div
        className="relative z-10 w-full max-w-lg px-6"
        style={{ minHeight: '440px' }}
      >
        <div key={currentStep} className={slideClass}>
          {currentStep === 0 && (
            <StepWelcome
              selectedLang={selectedLang}
              onLangChange={handleLangChange}
              onNext={goNext}
            />
          )}
          {currentStep === 1 && (
            <StepConnection
              mode={connectionMode}
              onModeChange={setConnectionMode}
              apiKey={apiKey}
              onApiKeyChange={setApiKey}
              testStatus={testStatus}
              onTestConnection={handleTestConnection}
            />
          )}
          {currentStep === 2 && (
            <StepAgents
              hoveredAgent={hoveredAgent}
              onHoverAgent={setHoveredAgent}
            />
          )}
          {currentStep === 3 && (
            <StepReady
              dontShowAgain={dontShowAgain}
              onDontShowChange={setDontShowAgain}
              onQuickAction={handleQuickAction}
            />
          )}
        </div>
      </div>

      {/* Navigation buttons */}
      <div className="relative z-10 flex items-center justify-between w-full max-w-lg px-6 mt-8">
        {/* Back button */}
        <div style={{ minWidth: '80px' }}>
          {currentStep > 0 ? (
            <button
              className="welcome-btn-ghost text-sm flex items-center gap-1.5"
              onClick={goPrev}
              aria-label={t('welcome.prevStep')}
            >
              {isRtl ? (
                <>
                  <span className="text-xs opacity-60">{'\u203A'}</span>
                  {t('welcome.prev')}
                </>
              ) : (
                <>
                  <span className="text-xs opacity-60">{'\u2039'}</span>
                  {t('welcome.prev')}
                </>
              )}
            </button>
          ) : (
            <div />
          )}
        </div>

        {/* Skip */}
        {currentStep < TOTAL_STEPS - 1 && (
          <button
            className="text-xs opacity-30 hover:opacity-60 transition-opacity duration-200"
            onClick={handleSkip}
            aria-label={t('welcome.skip')}
          >
            {t('welcome.skip')}
          </button>
        )}

        {/* Next / Finish */}
        <div style={{ minWidth: '80px', textAlign: isRtl ? 'left' : 'right' }}>
          {currentStep < TOTAL_STEPS - 1 ? (
            <button
              className="welcome-btn-primary text-sm flex items-center gap-1.5"
              onClick={goNext}
              aria-label={t('welcome.nextStep')}
            >
              {t('welcome.next')}
              {isRtl ? (
                <span className="text-xs">{'\u2039'}</span>
              ) : (
                <span className="text-xs">{'\u203A'}</span>
              )}
            </button>
          ) : (
            <button
              className="welcome-btn-primary text-sm flex items-center gap-2 welcome-btn-glow"
              onClick={handleComplete}
              aria-label={t('welcome.finishLabel')}
            >
              <SparkleIcon className="w-3.5 h-3.5 welcome-sparkle-spin" />
              {t('welcome.finish')}
            </button>
          )}
        </div>
      </div>

      {/* Keyboard hints */}
      <div className="relative z-10 mt-5 text-[10px] opacity-20 flex items-center gap-4">
        <span>
          <kbd className="welcome-kbd">{'\u2190'}</kbd>
          <kbd className="welcome-kbd">{'\u2192'}</kbd>{' '}
          {t('welcome.kbdNav')}
        </span>
        <span>
          <kbd className="welcome-kbd">Enter</kbd> {t('welcome.kbdNext')}
        </span>
        <span>
          <kbd className="welcome-kbd">Esc</kbd> {t('welcome.kbdSkip')}
        </span>
      </div>
    </div>
  );
}

// ===================================================
// Step 1 -- Welcome + Language Selection
// ===================================================
interface StepWelcomeProps {
  selectedLang: 'he' | 'en';
  onLangChange: (lang: 'he' | 'en') => void;
  onNext: () => void;
}

function StepWelcome({ selectedLang, onLangChange, onNext }: StepWelcomeProps) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col items-center text-center">
      {/* Animated logo */}
      <div className="welcome-logo-float mb-6">
        <div className="welcome-logo-container">
          <div className="welcome-logo-ring" />
          <div className="welcome-logo">
            <span className="welcome-wave-hand">{'\uD83D\uDC4B'}</span>
          </div>
        </div>
      </div>

      <h1 className="text-2xl font-bold mb-3 welcome-fade-up">
        {t('welcome.title')}
      </h1>

      <p
        className="text-sm opacity-60 leading-relaxed mb-6 max-w-sm welcome-fade-up"
        style={{ animationDelay: '0.1s' }}
      >
        {t('welcome.subtitle')}
      </p>

      {/* Feature tags */}
      <div
        className="flex flex-wrap justify-center gap-2 mb-8 welcome-fade-up"
        style={{ animationDelay: '0.15s' }}
      >
        {[
          t('welcome.tag7Agents'),
          t('welcome.tagProjectMgmt'),
          t('welcome.tagSmartGit'),
          t('welcome.tagFullHebrew'),
        ].map((tag) => (
          <span key={tag} className="welcome-tag">
            {tag}
          </span>
        ))}
      </div>

      {/* Language selection */}
      <div
        className="w-full max-w-xs mb-6 welcome-fade-up"
        style={{ animationDelay: '0.2s' }}
      >
        <p className="text-xs opacity-40 mb-3">{t('welcome.chooseLang')}</p>
        <div className="grid grid-cols-2 gap-3">
          <button
            className={`welcome-lang-card ${selectedLang === 'he' ? 'welcome-lang-active' : ''}`}
            onClick={() => onLangChange('he')}
            aria-label="עברית — Hebrew"
            aria-pressed={selectedLang === 'he'}
          >
            <span className="text-lg mb-1">{'🇮🇱'}</span>
            <span className="text-sm font-medium">{'\u05E2\u05D1\u05E8\u05D9\u05EA'}</span>
            <span className="text-[10px] opacity-40">Hebrew</span>
          </button>

          <button
            className={`welcome-lang-card ${selectedLang === 'en' ? 'welcome-lang-active' : ''}`}
            onClick={() => onLangChange('en')}
            aria-label="English"
            aria-pressed={selectedLang === 'en'}
          >
            <span className="text-lg mb-1">{'🇺🇸'}</span>
            <span className="text-sm font-medium">English</span>
            <span className="text-[10px] opacity-40">{'English'}</span>
          </button>
        </div>
      </div>

      {/* Start button */}
      <button
        className="welcome-btn-primary text-base px-10 py-3.5 rounded-xl welcome-fade-up welcome-btn-glow"
        style={{ animationDelay: '0.3s' }}
        onClick={onNext}
        aria-label={t('welcome.letsStart')}
      >
        {'\uD83D\uDE80'} {t('welcome.letsStart')}
      </button>
    </div>
  );
}

// ===================================================
// Step 2 -- Connection Setup
// ===================================================
interface StepConnectionProps {
  mode: 'cli' | 'api';
  onModeChange: (mode: 'cli' | 'api') => void;
  apiKey: string;
  onApiKeyChange: (key: string) => void;
  testStatus: 'idle' | 'testing' | 'success' | 'error';
  onTestConnection: () => void;
}

function StepConnection({
  mode,
  onModeChange,
  apiKey,
  onApiKeyChange,
  testStatus,
  onTestConnection,
}: StepConnectionProps) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col items-center">
      <div className="text-3xl mb-3 welcome-fade-up">{'\uD83D\uDD0C'}</div>
      <h2 className="text-xl font-bold mb-2 welcome-fade-up">
        {t('welcome.connectionTitle')}
      </h2>
      <p className="text-xs opacity-50 mb-6 text-center welcome-fade-up">
        {t('welcome.connectionDesc')}
      </p>

      {/* Mode selection cards */}
      <div className="grid grid-cols-2 gap-3 w-full mb-5">
        {/* CLI card */}
        <button
          className={`welcome-mode-card ${mode === 'cli' ? 'welcome-mode-active-blue' : ''}`}
          onClick={() => onModeChange('cli')}
          aria-label={t('welcome.cliLabel') + ' — ' + t('welcome.cliDesc')}
          aria-pressed={mode === 'cli'}
        >
          <div className="text-2xl mb-2">{'\uD83D\uDCBB'}</div>
          <div className="text-sm font-semibold mb-1">{t('welcome.cliLabel')}</div>
          <div className="text-[10px] opacity-45 leading-relaxed">
            {t('welcome.cliDesc')}
          </div>
          <div className="mt-2.5 flex flex-wrap gap-1">
            <span className="welcome-badge-green">{t('welcome.badgeFree')}</span>
            <span className="welcome-badge-neutral">{t('welcome.badgeEasy')}</span>
          </div>
        </button>

        {/* API card */}
        <button
          className={`welcome-mode-card ${mode === 'api' ? 'welcome-mode-active-purple' : ''}`}
          onClick={() => onModeChange('api')}
          aria-label={t('welcome.apiLabel') + ' — ' + t('welcome.apiDesc')}
          aria-pressed={mode === 'api'}
        >
          <div className="text-2xl mb-2">{'\uD83D\uDD11'}</div>
          <div className="text-sm font-semibold mb-1">{t('welcome.apiLabel')}</div>
          <div className="text-[10px] opacity-45 leading-relaxed">
            {t('welcome.apiDesc')}
          </div>
          <div className="mt-2.5 flex flex-wrap gap-1">
            <span className="welcome-badge-purple">{t('welcome.badgeFast')}</span>
            <span className="welcome-badge-neutral">{t('welcome.badgeFlexible')}</span>
          </div>
        </button>
      </div>

      {/* API Key input */}
      {mode === 'api' && (
        <div className="w-full welcome-fade-up">
          <label className="block text-xs opacity-50 mb-1.5">
            {t('welcome.apiKeyLabel')}
          </label>
          <input
            type="password"
            className="input-field text-sm mb-3"
            placeholder="sk-ant-..."
            value={apiKey}
            onChange={(e) => onApiKeyChange(e.target.value)}
            dir="ltr"
            autoComplete="off"
          />
        </div>
      )}

      {/* Test connection button */}
      <button
        className="welcome-btn-test w-full"
        onClick={onTestConnection}
        disabled={testStatus === 'testing'}
        aria-label={t('welcome.testConnection')}
      >
        {testStatus === 'testing' && <span className="spinner" />}
        {testStatus === 'success' && (
          <span style={{ color: '#10b981' }}>{'\u2713'}</span>
        )}
        {testStatus === 'error' && (
          <span style={{ color: '#ef4444' }}>{'\u2717'}</span>
        )}
        {testStatus === 'idle' && <span>{'\uD83D\uDD0C'}</span>}
        <span>
          {testStatus === 'testing'
            ? t('welcome.testTesting')
            : testStatus === 'success'
              ? t('welcome.testSuccess')
              : testStatus === 'error'
                ? t('welcome.testRetry')
                : t('welcome.testConnection')}
        </span>
      </button>

      {/* Comparison table */}
      <div className="mt-5 w-full welcome-comparison-box">
        <div className="text-[10px] opacity-35 mb-2.5 font-medium">
          {t('welcome.quickComparison')}
        </div>
        <div className="grid grid-cols-3 gap-1 text-[10px]">
          <div className="opacity-35" />
          <div className="text-center opacity-55 font-semibold">CLI</div>
          <div className="text-center opacity-55 font-semibold">API</div>

          <div className="opacity-45">{t('welcome.compareCost')}</div>
          <div className="text-center" style={{ color: '#34d399' }}>
            {t('welcome.compareFree')}
          </div>
          <div className="text-center opacity-60">{t('welcome.comparePayPerUse')}</div>

          <div className="opacity-45">{t('welcome.compareSpeed')}</div>
          <div className="text-center opacity-60">{t('welcome.compareNormal')}</div>
          <div className="text-center" style={{ color: '#a78bfa' }}>
            {t('welcome.compareFast')}
          </div>

          <div className="opacity-45">{t('welcome.compareSetup')}</div>
          <div className="text-center" style={{ color: '#34d399' }}>
            {t('welcome.compareSimple')}
          </div>
          <div className="text-center opacity-60">{t('welcome.compareApiKey')}</div>
        </div>
      </div>
    </div>
  );
}

// ===================================================
// Step 3 -- Meet the Agents
// ===================================================
interface StepAgentsProps {
  hoveredAgent: AgentId | null;
  onHoverAgent: (id: AgentId | null) => void;
}

function StepAgents({ hoveredAgent, onHoverAgent }: StepAgentsProps) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col items-center">
      <div className="text-3xl mb-3 welcome-fade-up">{'\uD83E\uDD16'}</div>
      <h2 className="text-xl font-bold mb-2 welcome-fade-up">
        {t('welcome.agentsTitle')}
      </h2>
      <p className="text-xs opacity-50 mb-5 text-center welcome-fade-up">
        {t('welcome.agentsDesc')}
      </p>

      {/* Agents grid */}
      <div className="grid grid-cols-2 gap-2.5 w-full stagger-children">
        {AGENT_IDS.map((id) => {
          const agent = BUILT_IN_AGENTS[id];
          const isHovered = hoveredAgent === id;
          const isRecommended = id === 'manager';

          return (
            <div
              key={id}
              className={`welcome-agent-card ${isHovered ? 'welcome-agent-hovered' : ''} ${
                id === 'writer' ? 'col-span-2' : ''
              }`}
              style={{
                '--agent-color': agent.color,
                background: isHovered
                  ? `${agent.color}12`
                  : 'rgba(255, 255, 255, 0.025)',
                borderColor: isHovered
                  ? `${agent.color}40`
                  : 'rgba(255, 255, 255, 0.06)',
              } as React.CSSProperties}
              onMouseEnter={() => onHoverAgent(id)}
              onMouseLeave={() => onHoverAgent(null)}
            >
              {isRecommended && (
                <span
                  className="welcome-agent-recommended"
                  style={{ background: agent.color }}
                >
                  {t('welcome.recommended')}
                </span>
              )}

              <div className="flex items-start gap-2.5">
                <span className="text-xl flex-shrink-0">{agent.icon}</span>
                <div className="min-w-0">
                  <div
                    className="text-xs font-semibold mb-0.5 transition-colors duration-200"
                    style={{ color: isHovered ? agent.color : undefined }}
                  >
                    {agent.name}
                  </div>
                  <div className="text-[10px] opacity-45 leading-relaxed line-clamp-2">
                    {agent.description}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Workflows preview */}
      <div className="w-full mt-4 welcome-comparison-box">
        <div className="text-[10px] opacity-35 mb-2 font-medium">
          {t('welcome.workflowsLabel')}
        </div>
        <div className="flex flex-wrap gap-2">
          {BUILT_IN_WORKFLOWS.map((wf) => (
            <span key={wf.id} className="welcome-workflow-chip">
              {wf.icon} {wf.name}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ===================================================
// Step 4 -- Ready!
// ===================================================
interface StepReadyProps {
  dontShowAgain: boolean;
  onDontShowChange: (val: boolean) => void;
  onQuickAction: (action: 'chat' | 'project' | 'settings') => void;
}

function StepReady({
  dontShowAgain,
  onDontShowChange,
  onQuickAction,
}: StepReadyProps) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col items-center text-center">
      {/* Animated success icon */}
      <div className="welcome-logo-float mb-5">
        <div className="welcome-ready-icon">
          <span className="text-4xl">{'\uD83D\uDE80'}</span>
        </div>
      </div>

      {/* Sparkles around title */}
      <div className="relative welcome-fade-up">
        <SparkleIcon className="absolute -top-2 -right-6 text-yellow-400 welcome-sparkle-float opacity-60" />
        <SparkleIcon className="absolute -top-1 -left-5 text-blue-400 welcome-sparkle-float-delay opacity-40" />
        <h2 className="text-2xl font-bold mb-2">
          {t('welcome.readyTitle')}
        </h2>
      </div>

      <p
        className="text-sm opacity-50 mb-6 welcome-fade-up"
        style={{ animationDelay: '0.1s' }}
      >
        {t('welcome.readyDesc')}
      </p>

      {/* Quick action buttons */}
      <div className="w-full space-y-2.5 mb-6 stagger-children">
        <button
          className="welcome-action-card welcome-action-blue"
          onClick={() => onQuickAction('chat')}
          aria-label={t('welcome.actionChat') + ' — ' + t('welcome.actionChatDesc')}
        >
          <span className="text-xl">{'\uD83D\uDCAC'}</span>
          <div className="text-start">
            <div className="text-sm font-semibold">{t('welcome.actionChat')}</div>
            <div className="text-[10px] opacity-45">
              {t('welcome.actionChatDesc')}
            </div>
          </div>
        </button>

        <button
          className="welcome-action-card welcome-action-purple"
          onClick={() => onQuickAction('project')}
          aria-label={t('welcome.actionProject') + ' — ' + t('welcome.actionProjectDesc')}
        >
          <span className="text-xl">{'\uD83D\uDCC1'}</span>
          <div className="text-start">
            <div className="text-sm font-semibold">
              {t('welcome.actionProject')}
            </div>
            <div className="text-[10px] opacity-45">
              {t('welcome.actionProjectDesc')}
            </div>
          </div>
        </button>

        <button
          className="welcome-action-card welcome-action-neutral"
          onClick={() => onQuickAction('settings')}
          aria-label={t('welcome.actionSettings') + ' — ' + t('welcome.actionSettingsDesc')}
        >
          <span className="text-xl">{'\u2699\uFE0F'}</span>
          <div className="text-start">
            <div className="text-sm font-semibold">
              {t('welcome.actionSettings')}
            </div>
            <div className="text-[10px] opacity-45">
              {t('welcome.actionSettingsDesc')}
            </div>
          </div>
        </button>
      </div>

      {/* Don't show again */}
      <label className="flex items-center gap-2 text-xs opacity-40 cursor-pointer hover:opacity-60 transition-opacity duration-200">
        <input
          type="checkbox"
          checked={dontShowAgain}
          onChange={(e) => onDontShowChange(e.target.checked)}
          className="rounded"
          style={{ accentColor: '#3b82f6' }}
        />
        {t('welcome.dontShowAgain')}
      </label>
    </div>
  );
}
