// ===================================================
// ErrorBoundary — לכידת שגיאות רינדור
// ===================================================
// Class component שתופס שגיאות בעץ הקומפוננטות
// מציג UI ידידותי עם אפשרות לנסות שוב
// משתמש ב-i18next ישירות (class component לא תומך ב-hooks)
// ===================================================

import React from 'react';
import i18n from '../../i18n';

// -------------------------------------------------
// Props & State
// -------------------------------------------------
interface ErrorBoundaryProps {
  children: React.ReactNode;
  /** הודעת fallback מותאמת — מוצגת מתחת לכותרת הראשית */
  fallbackMessage?: string;
  /** callback נוסף כשמתרחשת שגיאה */
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  /** האם פרטי השגיאה מוצגים */
  showDetails: boolean;
}

// -------------------------------------------------
// ErrorBoundary Component
// -------------------------------------------------
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      showDetails: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // לוג לקונסול — שימושי לדיבאג
    console.error('[ErrorBoundary] Error caught:', error);
    console.error('[ErrorBoundary] Component Stack:', errorInfo.componentStack);

    // callback חיצוני אם סופק
    this.props.onError?.(error, errorInfo);
  }

  /** איפוס מצב השגיאה — מאפשר לנסות שוב */
  handleReset = (): void => {
    this.setState({ hasError: false, error: null, showDetails: false });
  };

  /** הצגה/הסתרה של פרטי השגיאה */
  toggleDetails = (): void => {
    this.setState((prev) => ({ showDetails: !prev.showDetails }));
  };

  render(): React.ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const { error, showDetails } = this.state;
    const { fallbackMessage } = this.props;
    const t = i18n.t.bind(i18n);

    return (
      <div
        className="flex flex-col items-center justify-center p-6 m-4 rounded-lg animate-fade-in"
        dir="auto"
        style={{
          background: 'var(--vscode-inputValidation-errorBackground, #5a1d1d)',
          border: '1px solid var(--vscode-inputValidation-errorBorder, #be1100)',
        }}
      >
        {/* אייקון שגיאה */}
        <div className="text-4xl mb-3" aria-hidden="true">
          &#9888;
        </div>

        {/* כותרת ראשית */}
        <h2
          className="text-base font-semibold mb-1"
          style={{ color: 'var(--vscode-errorForeground, #f48771)' }}
        >
          {t('errorBoundary.title')}
        </h2>

        {/* הודעת fallback מותאמת */}
        {fallbackMessage && (
          <p className="text-xs opacity-70 mb-3 text-center max-w-xs">
            {fallbackMessage}
          </p>
        )}

        {/* כפתור "נסה שוב" */}
        <button
          className="btn-primary px-4 py-1.5 text-sm mb-3"
          onClick={this.handleReset}
        >
          {t('errorBoundary.retry')}
        </button>

        {/* פרטי שגיאה — מתקפל */}
        <div className="w-full max-w-md">
          <button
            className="btn-ghost text-xs opacity-60 hover:opacity-100 w-full text-center"
            onClick={this.toggleDetails}
          >
            {showDetails ? t('errorBoundary.hideDetails') : t('errorBoundary.showDetails')}
          </button>

          {showDetails && error && (
            <div
              className="mt-2 p-3 rounded text-xs font-mono overflow-auto max-h-40"
              dir="ltr"
              style={{
                background: 'rgba(0, 0, 0, 0.3)',
                border: '1px solid var(--vscode-panel-border)',
                color: 'var(--vscode-editor-foreground)',
              }}
            >
              <div className="font-semibold mb-1">{error.name}: {error.message}</div>
              {error.stack && (
                <pre className="whitespace-pre-wrap opacity-60 text-[10px] leading-relaxed">
                  {error.stack}
                </pre>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }
}
