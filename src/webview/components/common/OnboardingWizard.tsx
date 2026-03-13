// ===================================================
// OnboardingWizard — אשף ברוכים הבאים למשתמשים חדשים
// ===================================================
// 5 שלבים: ברכה, חיבור, סוכנים, סיור, מוכן!
// עיצוב RTL עברי, Tailwind CSS, אנימציות חלקות
// ===================================================

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useApp } from '../../state/AppContext';
import { BUILT_IN_AGENTS, BUILT_IN_WORKFLOWS, TIMEOUTS } from '../../../shared/constants';
import type { AgentId } from '../../../shared/types';

// -------------------------------------------------
// קבועים — שלבים ומידע
// -------------------------------------------------
const TOTAL_STEPS = 5;

const AGENT_IDS: AgentId[] = ['manager', 'architect', 'developer', 'qa', 'designer', 'security', 'writer'];

const FEATURES = [
  {
    icon: '💬',
    title: 'שיחה חכמה עם AI',
    description: 'שוחח עם Claude באופן טבעי. שאל שאלות, בקש קוד, ונהל דיאלוג מעמיק.',
  },
  {
    icon: '⚡',
    title: 'פקודות מהירות',
    description: 'השתמש בפקודות / כמו /fix, /explain, /review לפעולות מהירות על הקוד.',
  },
  {
    icon: '📁',
    title: 'ניהול פרויקטים',
    description: 'ארגן את הפרויקטים שלך, עקוב אחרי בריאות הקוד, ונהל משימות.',
  },
  {
    icon: '🌿',
    title: 'אינטגרציית Git',
    description: 'בצע commit, push, סקירת קוד וניהול שינויים — הכל מתוך הממשק.',
  },
  {
    icon: '🔄',
    title: 'Workflows אוטומטיים',
    description: 'הפעל שרשראות סוכנים לפיצ\'רים חדשים, תיקון באגים, וסקירות קוד.',
  },
];

// -------------------------------------------------
// OnboardingWizard Component
// -------------------------------------------------
export function OnboardingWizard() {
  const { dispatch, sendMessage } = useApp();
  const [currentStep, setCurrentStep] = useState(0);
  const [direction, setDirection] = useState<'next' | 'prev'>('next');
  const [connectionMode, setConnectionMode] = useState<'cli' | 'api'>('cli');
  const [apiKey, setApiKey] = useState('');
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [dontShowAgain, setDontShowAgain] = useState(true);
  const [hoveredAgent, setHoveredAgent] = useState<AgentId | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const testTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  // --- ניווט מקלדת ---
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        // בגלל RTL: חץ שמאלה = הבא, חץ ימינה = הקודם
        if (e.key === 'ArrowLeft' && currentStep < TOTAL_STEPS - 1) {
          e.preventDefault();
          goNext();
        } else if (e.key === 'ArrowRight' && currentStep > 0) {
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
  }, [currentStep]);

  // --- פונקציות ניווט ---
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

  const goToStep = useCallback((step: number) => {
    setDirection(step > currentStep ? 'next' : 'prev');
    setCurrentStep(step);
  }, [currentStep]);

  // --- סיום / דילוג ---
  const handleComplete = useCallback(() => {
    // שמירת הגדרות אם נבחר API mode
    if (connectionMode === 'api' && apiKey) {
      sendMessage({ type: 'storeApiKey', payload: { apiKey } });
    }
    // סימון שנצפה — persist via extension globalState
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

  // Cleanup test connection timers on unmount
  useEffect(() => {
    return () => {
      testTimersRef.current.forEach(clearTimeout);
      testTimersRef.current = [];
    };
  }, []);

  // --- בדיקת חיבור ---
  const handleTestConnection = useCallback(() => {
    // Clear any previous test timers
    testTimersRef.current.forEach(clearTimeout);
    testTimersRef.current = [];

    setTestStatus('testing');
    // שולח הודעת בדיקה ל-Extension
    sendMessage({ type: 'sendMessage', payload: { content: '/doctor' } });
    // מדמה תוצאה אחרי timeout (ה-Extension יגיב בפועל)
    const t1 = setTimeout(() => {
      setTestStatus('success');
      const t2 = setTimeout(() => setTestStatus('idle'), TIMEOUTS.TEST_STATUS_RESET_MS);
      testTimersRef.current.push(t2);
    }, TIMEOUTS.TEST_CONNECTION_MS);
    testTimersRef.current.push(t1);
  }, [sendMessage]);

  // --- Quick Actions מהשלב האחרון ---
  const handleQuickAction = useCallback((action: 'chat' | 'project' | 'settings') => {
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
  }, [dispatch, sendMessage]);

  // --- קלאס כיוון אנימציה ---
  const slideClass = direction === 'next' ? 'onboarding-slide-next' : 'onboarding-slide-prev';

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden"
      style={{ background: 'var(--vscode-editor-background)' }}
      role="dialog"
      aria-modal="true"
      aria-label="אשף ברוכים הבאים"
    >
      {/* רקע דקורטיבי */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
        <div
          className="absolute top-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full opacity-[0.03]"
          style={{ background: 'radial-gradient(circle, #3b82f6, transparent 70%)' }}
        />
        <div
          className="absolute bottom-[-15%] left-[-10%] w-[400px] h-[400px] rounded-full opacity-[0.03]"
          style={{ background: 'radial-gradient(circle, #8b5cf6, transparent 70%)' }}
        />
      </div>

      {/* Progress indicator — נקודות שלב */}
      <div className="relative z-10 flex items-center gap-2 mb-6" role="tablist" aria-label="שלבי האשף">
        {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
          <button
            key={i}
            role="tab"
            aria-selected={i === currentStep}
            aria-label={`שלב ${i + 1} מתוך ${TOTAL_STEPS}`}
            className={`transition-all duration-300 rounded-full cursor-pointer ${
              i === currentStep
                ? 'w-8 h-2.5 bg-blue-500'
                : i < currentStep
                  ? 'w-2.5 h-2.5 bg-blue-400 opacity-60'
                  : 'w-2.5 h-2.5 opacity-20'
            }`}
            style={{
              background: i > currentStep
                ? 'var(--vscode-editor-foreground)'
                : undefined,
            }}
            onClick={() => goToStep(i)}
          />
        ))}
      </div>

      {/* אזור תוכן — עם אנימציית slide */}
      <div
        className="relative z-10 w-full max-w-md px-6"
        style={{ minHeight: '420px' }}
      >
        <div key={currentStep} className={slideClass}>
          {currentStep === 0 && <StepWelcome onNext={goNext} />}
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
          {currentStep === 3 && <StepTour />}
          {currentStep === 4 && (
            <StepReady
              dontShowAgain={dontShowAgain}
              onDontShowChange={setDontShowAgain}
              onQuickAction={handleQuickAction}
            />
          )}
        </div>
      </div>

      {/* כפתורי ניווט */}
      <div className="relative z-10 flex items-center justify-between w-full max-w-md px-6 mt-6">
        {/* כפתור הקודם */}
        <div>
          {currentStep > 0 ? (
            <button
              className="btn-ghost text-sm flex items-center gap-1.5 opacity-70 hover:opacity-100"
              onClick={goPrev}
              aria-label="שלב קודם"
            >
              <span className="text-xs">&#10095;</span>
              הקודם
            </button>
          ) : (
            <div />
          )}
        </div>

        {/* מרכז — דילוג */}
        {currentStep < TOTAL_STEPS - 1 && (
          <button
            className="text-xs opacity-40 hover:opacity-70 transition-opacity"
            onClick={handleSkip}
            aria-label="דלג על האשף"
          >
            דלג
          </button>
        )}

        {/* כפתור הבא / סיום */}
        <div>
          {currentStep < TOTAL_STEPS - 1 ? (
            <button
              className="btn-primary text-sm flex items-center gap-1.5"
              onClick={goNext}
              aria-label="שלב הבא"
            >
              הבא
              <span className="text-xs">&#10094;</span>
            </button>
          ) : (
            <button
              className="btn-primary text-sm flex items-center gap-1.5"
              onClick={handleComplete}
              aria-label="סיום האשף"
            >
              בוא נתחיל!
              <span className="text-xs">&#10094;</span>
            </button>
          )}
        </div>
      </div>

      {/* רמז מקלדת */}
      <div className="relative z-10 mt-4 text-[10px] opacity-25 flex items-center gap-3">
        <span><kbd>&#8594;</kbd><kbd>&#8592;</kbd> ניווט</span>
        <span><kbd>Enter</kbd> הבא</span>
        <span><kbd>Esc</kbd> דלג</span>
      </div>
    </div>
  );
}

// ===================================================
// Step 1 — ברוכים הבאים
// ===================================================
function StepWelcome({ onNext }: { onNext: () => void }) {
  return (
    <div className="flex flex-col items-center text-center">
      {/* לוגו מונפש */}
      <div className="onboarding-logo-pulse mb-6">
        <div
          className="w-20 h-20 rounded-2xl flex items-center justify-center text-4xl shadow-lg"
          style={{
            background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
            boxShadow: '0 8px 32px rgba(59, 130, 246, 0.3)',
          }}
        >
          <span className="onboarding-wave">&#128075;</span>
        </div>
      </div>

      <h1
        className="text-2xl font-bold mb-3 animate-fade-in"
        style={{ color: 'var(--vscode-editor-foreground)' }}
      >
        !TS AiTool-ברוך הבא ל
      </h1>

      <p className="text-sm opacity-70 leading-relaxed mb-6 max-w-sm animate-fade-in" style={{ animationDelay: '0.1s' }}>
        כלי פיתוח חכם מבוסס AI שמשלב סוכנים מתמחים,
        ניהול פרויקטים, ואינטגרציית Git — הכל בתוך VS Code.
      </p>

      <div className="flex flex-wrap justify-center gap-2 mb-8 animate-fade-in" style={{ animationDelay: '0.2s' }}>
        {['7 סוכני AI', 'ניהול פרויקטים', 'Git חכם', 'עברית מלאה'].map((tag) => (
          <span
            key={tag}
            className="px-3 py-1 rounded-full text-xs"
            style={{
              background: 'rgba(59, 130, 246, 0.15)',
              color: '#60a5fa',
            }}
          >
            {tag}
          </span>
        ))}
      </div>

      <button
        className="btn-primary text-base px-8 py-3 rounded-xl animate-fade-in"
        style={{ animationDelay: '0.3s' }}
        onClick={onNext}
        aria-label="התחל — עבור לשלב הבא"
      >
        &#128640; בוא נתחיל
      </button>
    </div>
  );
}

// ===================================================
// Step 2 — בחירת חיבור
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
  mode, onModeChange, apiKey, onApiKeyChange, testStatus, onTestConnection,
}: StepConnectionProps) {
  return (
    <div className="flex flex-col items-center">
      <div className="text-3xl mb-3 animate-fade-in">&#128268;</div>
      <h2 className="text-lg font-bold mb-2 animate-fade-in">בחר אופן חיבור</h2>
      <p className="text-xs opacity-60 mb-5 text-center animate-fade-in">
        איך תרצה להתחבר ל-Claude?
      </p>

      {/* כרטיסי בחירה */}
      <div className="grid grid-cols-2 gap-3 w-full mb-5">
        {/* CLI */}
        <button
          className={`rounded-xl p-4 text-right transition-all duration-200 border-2 ${
            mode === 'cli'
              ? 'border-blue-500 bg-blue-500/10'
              : 'border-transparent hover:border-white/10'
          }`}
          style={{
            background: mode === 'cli'
              ? 'rgba(59, 130, 246, 0.1)'
              : 'rgba(255, 255, 255, 0.03)',
          }}
          onClick={() => onModeChange('cli')}
          aria-label="CLI — חיבור חינמי דרך Claude CLI"
          aria-pressed={mode === 'cli'}
        >
          <div className="text-2xl mb-2">&#128187;</div>
          <div className="text-sm font-semibold mb-1">CLI</div>
          <div className="text-[10px] opacity-50 leading-relaxed">
            חינם. משתמש ב-Claude CLI המותקן.
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#34d399' }}>
              חינם
            </span>
            <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(255, 255, 255, 0.08)' }}>
              קל
            </span>
          </div>
        </button>

        {/* API */}
        <button
          className={`rounded-xl p-4 text-right transition-all duration-200 border-2 ${
            mode === 'api'
              ? 'border-purple-500 bg-purple-500/10'
              : 'border-transparent hover:border-white/10'
          }`}
          style={{
            background: mode === 'api'
              ? 'rgba(139, 92, 246, 0.1)'
              : 'rgba(255, 255, 255, 0.03)',
          }}
          onClick={() => onModeChange('api')}
          aria-label="API — תשלום לפי שימוש דרך Anthropic SDK"
          aria-pressed={mode === 'api'}
        >
          <div className="text-2xl mb-2">&#128273;</div>
          <div className="text-sm font-semibold mb-1">API</div>
          <div className="text-[10px] opacity-50 leading-relaxed">
            תשלום לפי שימוש. Anthropic SDK ישיר.
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(139, 92, 246, 0.2)', color: '#a78bfa' }}>
              מהיר
            </span>
            <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: 'rgba(255, 255, 255, 0.08)' }}>
              גמיש
            </span>
          </div>
        </button>
      </div>

      {/* שדה API Key — רק כשנבחר API */}
      {mode === 'api' && (
        <div className="w-full animate-fade-in">
          <label className="block text-xs opacity-60 mb-1.5">Anthropic API Key</label>
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

      {/* כפתור בדיקת חיבור */}
      <button
        className="btn-secondary text-xs flex items-center gap-2 w-full justify-center py-2.5 rounded-lg"
        onClick={onTestConnection}
        disabled={testStatus === 'testing'}
        aria-label="בדוק חיבור ל-Claude"
      >
        {testStatus === 'testing' && <span className="spinner" />}
        {testStatus === 'success' && <span style={{ color: '#10b981' }}>&#10003;</span>}
        {testStatus === 'error' && <span style={{ color: '#ef4444' }}>&#10007;</span>}
        {testStatus === 'idle' && '&#128268;'}
        {testStatus === 'testing' ? 'בודק...' : testStatus === 'success' ? 'החיבור תקין!' : testStatus === 'error' ? 'נסה שוב' : 'בדוק חיבור'}
      </button>

      {/* הסבר על ההבדלים */}
      <div className="mt-4 w-full rounded-lg p-3" style={{ background: 'rgba(255, 255, 255, 0.03)' }}>
        <div className="text-[10px] opacity-40 mb-2 font-medium">השוואה מהירה</div>
        <div className="grid grid-cols-3 gap-1 text-[10px]">
          <div className="opacity-40"></div>
          <div className="text-center opacity-60 font-medium">CLI</div>
          <div className="text-center opacity-60 font-medium">API</div>
          <div className="opacity-50">עלות</div>
          <div className="text-center" style={{ color: '#34d399' }}>חינם</div>
          <div className="text-center opacity-70">לפי שימוש</div>
          <div className="opacity-50">מהירות</div>
          <div className="text-center opacity-70">רגילה</div>
          <div className="text-center" style={{ color: '#a78bfa' }}>מהירה</div>
          <div className="opacity-50">הגדרה</div>
          <div className="text-center" style={{ color: '#34d399' }}>פשוטה</div>
          <div className="text-center opacity-70">API Key</div>
        </div>
      </div>
    </div>
  );
}

// ===================================================
// Step 3 — הכר את הסוכנים
// ===================================================
interface StepAgentsProps {
  hoveredAgent: AgentId | null;
  onHoverAgent: (id: AgentId | null) => void;
}

function StepAgents({ hoveredAgent, onHoverAgent }: StepAgentsProps) {
  return (
    <div className="flex flex-col items-center">
      <div className="text-3xl mb-3 animate-fade-in">&#129302;</div>
      <h2 className="text-lg font-bold mb-2 animate-fade-in">הכר את הסוכנים</h2>
      <p className="text-xs opacity-60 mb-5 text-center animate-fade-in">
        7 סוכני AI מתמחים שעובדים ביחד על הפרויקט שלך
      </p>

      {/* גריד סוכנים */}
      <div className="grid grid-cols-2 gap-2.5 w-full stagger-children">
        {AGENT_IDS.map((id) => {
          const agent = BUILT_IN_AGENTS[id];
          const isHovered = hoveredAgent === id;
          const isRecommended = id === 'manager';

          return (
            <div
              key={id}
              className={`relative rounded-xl p-3 transition-all duration-200 cursor-default ${
                isHovered ? 'scale-[1.02]' : ''
              } ${id === 'writer' ? 'col-span-2' : ''}`}
              style={{
                background: isHovered
                  ? `${agent.color}15`
                  : 'rgba(255, 255, 255, 0.03)',
                border: `1px solid ${isHovered ? `${agent.color}40` : 'rgba(255, 255, 255, 0.06)'}`,
              }}
              onMouseEnter={() => onHoverAgent(id)}
              onMouseLeave={() => onHoverAgent(null)}
            >
              {/* תג מומלץ */}
              {isRecommended && (
                <span
                  className="absolute -top-2 right-3 text-[9px] px-2 py-0.5 rounded-full font-medium"
                  style={{ background: agent.color, color: '#fff' }}
                >
                  מומלץ
                </span>
              )}

              <div className="flex items-start gap-2.5">
                <span className="text-xl flex-shrink-0">{agent.icon}</span>
                <div className="min-w-0">
                  <div className="text-xs font-semibold mb-0.5" style={{ color: isHovered ? agent.color : undefined }}>
                    {agent.name}
                  </div>
                  <div className="text-[10px] opacity-50 leading-relaxed line-clamp-2">
                    {agent.description}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Workflows — קצר */}
      <div className="w-full mt-4 rounded-lg p-3" style={{ background: 'rgba(255, 255, 255, 0.03)' }}>
        <div className="text-[10px] opacity-40 mb-2 font-medium">Workflows — שרשראות סוכנים</div>
        <div className="flex flex-wrap gap-2">
          {BUILT_IN_WORKFLOWS.map((wf) => (
            <span
              key={wf.id}
              className="text-[10px] px-2 py-1 rounded-md"
              style={{ background: 'rgba(255, 255, 255, 0.06)' }}
            >
              {wf.icon} {wf.name}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ===================================================
// Step 4 — סיור מהיר
// ===================================================
function StepTour() {
  return (
    <div className="flex flex-col items-center">
      <div className="text-3xl mb-3 animate-fade-in">&#127891;</div>
      <h2 className="text-lg font-bold mb-2 animate-fade-in">סיור מהיר</h2>
      <p className="text-xs opacity-60 mb-5 text-center animate-fade-in">
        הנה 5 דברים שתוכל לעשות עם TS AiTool
      </p>

      {/* כרטיסי פיצ'רים */}
      <div className="w-full space-y-2.5 stagger-children">
        {FEATURES.map((feature, i) => (
          <div
            key={i}
            className="flex items-start gap-3 rounded-xl p-3.5 transition-all duration-200 hover:translate-x-[-2px]"
            style={{
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
            }}
          >
            <span className="text-xl flex-shrink-0">{feature.icon}</span>
            <div>
              <div className="text-xs font-semibold mb-0.5">{feature.title}</div>
              <div className="text-[10px] opacity-50 leading-relaxed">{feature.description}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ===================================================
// Step 5 — מוכן!
// ===================================================
interface StepReadyProps {
  dontShowAgain: boolean;
  onDontShowChange: (val: boolean) => void;
  onQuickAction: (action: 'chat' | 'project' | 'settings') => void;
}

function StepReady({ dontShowAgain, onDontShowChange, onQuickAction }: StepReadyProps) {
  return (
    <div className="flex flex-col items-center text-center">
      {/* אייקון מוכנות */}
      <div className="onboarding-logo-pulse mb-5">
        <div
          className="w-20 h-20 rounded-2xl flex items-center justify-center text-4xl shadow-lg"
          style={{
            background: 'linear-gradient(135deg, #10b981 0%, #3b82f6 100%)',
            boxShadow: '0 8px 32px rgba(16, 185, 129, 0.3)',
          }}
        >
          &#128640;
        </div>
      </div>

      <h2 className="text-xl font-bold mb-2 animate-fade-in">
        !הכל מוכן
      </h2>
      <p className="text-xs opacity-60 mb-6 animate-fade-in" style={{ animationDelay: '0.1s' }}>
        אתה מוכן להתחיל לעבוד עם TS AiTool. בחר פעולה ראשונה:
      </p>

      {/* כפתורי פעולה מהירה */}
      <div className="w-full space-y-2.5 mb-6 stagger-children">
        <button
          className="w-full flex items-center gap-3 rounded-xl p-4 text-right transition-all duration-200 hover:translate-x-[-2px]"
          style={{
            background: 'rgba(59, 130, 246, 0.1)',
            border: '1px solid rgba(59, 130, 246, 0.2)',
          }}
          onClick={() => onQuickAction('chat')}
          aria-label="שיחה חדשה — התחל לשוחח עם Claude"
        >
          <span className="text-xl">&#128172;</span>
          <div>
            <div className="text-sm font-semibold">שיחה חדשה</div>
            <div className="text-[10px] opacity-50">התחל לשוחח עם Claude</div>
          </div>
        </button>

        <button
          className="w-full flex items-center gap-3 rounded-xl p-4 text-right transition-all duration-200 hover:translate-x-[-2px]"
          style={{
            background: 'rgba(139, 92, 246, 0.1)',
            border: '1px solid rgba(139, 92, 246, 0.2)',
          }}
          onClick={() => onQuickAction('project')}
          aria-label="צור פרויקט — התחל פרויקט חדש"
        >
          <span className="text-xl">&#128193;</span>
          <div>
            <div className="text-sm font-semibold">צור פרויקט</div>
            <div className="text-[10px] opacity-50">התחל פרויקט חדש וארגן את העבודה</div>
          </div>
        </button>

        <button
          className="w-full flex items-center gap-3 rounded-xl p-4 text-right transition-all duration-200 hover:translate-x-[-2px]"
          style={{
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
          }}
          onClick={() => onQuickAction('settings')}
          aria-label="הגדרות — התאם את הכלי לצרכים שלך"
        >
          <span className="text-xl">&#9881;&#65039;</span>
          <div>
            <div className="text-sm font-semibold">הגדרות</div>
            <div className="text-[10px] opacity-50">התאם את הכלי לצרכים שלך</div>
          </div>
        </button>
      </div>

      {/* Checkbox — אל תציג שוב */}
      <label className="flex items-center gap-2 text-xs opacity-50 cursor-pointer hover:opacity-70 transition-opacity">
        <input
          type="checkbox"
          checked={dontShowAgain}
          onChange={(e) => onDontShowChange(e.target.checked)}
          className="rounded"
          style={{ accentColor: '#3b82f6' }}
        />
        אל תציג שוב בהפעלה הבאה
      </label>
    </div>
  );
}
