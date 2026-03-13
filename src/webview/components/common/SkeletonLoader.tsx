// ===================================================
// SkeletonLoader — שלד טעינה עם אנימציית shimmer
// ===================================================
// קומפוננטה גנרית להצגת placeholder בזמן טעינה
// תומך ב-RTL, משתני צבע של VS Code, ומספר וריאנטים
// ===================================================

import React from 'react';

// -------------------------------------------------
// Props
// -------------------------------------------------
interface SkeletonProps {
  /** סוג השלד */
  variant: 'text' | 'card' | 'message' | 'circle' | 'button';
  /** רוחב — ברירת מחדל 100% */
  width?: string;
  /** גובה — ברירת מחדל לפי variant */
  height?: string;
  /** מספר שורות (רלוונטי רק ל-text) */
  lines?: number;
  /** className נוסף */
  className?: string;
}

// -------------------------------------------------
// בסיס — בלוק shimmer בודד
// -------------------------------------------------
function ShimmerBlock({
  width = '100%',
  height = '12px',
  borderRadius = '4px',
  className = '',
}: {
  width?: string;
  height?: string;
  borderRadius?: string;
  className?: string;
}) {
  return (
    <div
      className={`skeleton-shimmer ${className}`}
      style={{
        width,
        height,
        borderRadius,
        minHeight: height,
      }}
    />
  );
}

// -------------------------------------------------
// SkeletonLoader — קומפוננטה ראשית
// -------------------------------------------------
export function SkeletonLoader({
  variant,
  width,
  height,
  lines = 3,
  className = '',
}: SkeletonProps) {
  switch (variant) {
    case 'text':
      return (
        <div className={`flex flex-col gap-2 ${className}`} style={{ width }}>
          {Array.from({ length: lines }).map((_, i) => (
            <ShimmerBlock
              key={i}
              width={i === lines - 1 ? '60%' : '100%'}
              height={height ?? '12px'}
            />
          ))}
        </div>
      );

    case 'circle':
      return (
        <ShimmerBlock
          width={width ?? '40px'}
          height={height ?? '40px'}
          borderRadius="50%"
          className={className}
        />
      );

    case 'button':
      return (
        <ShimmerBlock
          width={width ?? '80px'}
          height={height ?? '32px'}
          borderRadius="6px"
          className={className}
        />
      );

    case 'card':
      return (
        <div
          className={`rounded-lg p-4 ${className}`}
          style={{
            width,
            border: '1px solid var(--vscode-panel-border, rgba(255, 255, 255, 0.1))',
            background: 'rgba(255, 255, 255, 0.03)',
          }}
        >
          <div className="flex items-start gap-3">
            <ShimmerBlock width="40px" height="40px" borderRadius="50%" />
            <div className="flex-1 flex flex-col gap-2">
              <ShimmerBlock width="60%" height="14px" />
              <ShimmerBlock width="90%" height="10px" />
              <ShimmerBlock width="40%" height="10px" />
            </div>
          </div>
        </div>
      );

    case 'message':
      return (
        <div className={`mb-3 ${className}`} style={{ width }}>
          <div className="flex items-center gap-2 mb-1">
            <ShimmerBlock width="16px" height="16px" borderRadius="50%" />
            <ShimmerBlock width="50px" height="10px" />
            <ShimmerBlock width="35px" height="10px" />
          </div>
          <div
            className="rounded-lg px-3 py-2"
            style={{ background: 'rgba(255, 255, 255, 0.05)' }}
          >
            <div className="flex flex-col gap-2">
              <ShimmerBlock width="95%" height="12px" />
              <ShimmerBlock width="80%" height="12px" />
              <ShimmerBlock width="55%" height="12px" />
            </div>
          </div>
        </div>
      );

    default:
      return null;
  }
}

// -------------------------------------------------
// ProjectCardSkeleton — שלד כרטיס פרויקט
// -------------------------------------------------
// מחקה את מבנה ProjectCard: עיגול בריאות, כותרת, תיאור, תגיות
// -------------------------------------------------
export function ProjectCardSkeleton({ className = '' }: { className?: string }) {
  return (
    <div
      className={`card animate-fade-in ${className}`}
      style={{ borderRightWidth: 3, borderRightColor: 'rgba(255, 255, 255, 0.1)' }}
    >
      <div className="flex items-start justify-between">
        {/* מידע ראשי */}
        <div className="flex-1 min-w-0">
          {/* אייקון + שם */}
          <div className="flex items-center gap-2 mb-1">
            <ShimmerBlock width="24px" height="24px" borderRadius="4px" />
            <ShimmerBlock width="120px" height="14px" />
          </div>

          {/* תיאור */}
          <ShimmerBlock width="80%" height="10px" className="mb-2" />

          {/* Tech Stack tags */}
          <div className="flex flex-wrap gap-1 mb-2">
            <ShimmerBlock width="48px" height="18px" borderRadius="4px" />
            <ShimmerBlock width="56px" height="18px" borderRadius="4px" />
            <ShimmerBlock width="40px" height="18px" borderRadius="4px" />
            <ShimmerBlock width="52px" height="18px" borderRadius="4px" />
          </div>

          {/* סטטיסטיקות */}
          <div className="flex items-center gap-3">
            <ShimmerBlock width="55px" height="10px" />
            <ShimmerBlock width="75px" height="10px" />
          </div>
        </div>

        {/* ציון בריאות */}
        <div className="flex flex-col items-center gap-1 mr-3">
          <ShimmerBlock width="40px" height="40px" borderRadius="50%" />
        </div>
      </div>
    </div>
  );
}

// -------------------------------------------------
// MessageSkeleton — שלד הודעת צ'אט
// -------------------------------------------------
// מחקה את מבנה MessageBubble: אווטאר, שם, ושורות טקסט
// isUser מחליף צד (RTL) ומשנה צבע
// -------------------------------------------------
export function MessageSkeleton({
  isUser = false,
  className = '',
}: {
  isUser?: boolean;
  className?: string;
}) {
  return (
    <div className={`mb-3 ${className}`}>
      {/* כותרת */}
      <div className="flex items-center gap-2 mb-1">
        <ShimmerBlock width="16px" height="16px" borderRadius="50%" />
        <ShimmerBlock width={isUser ? '30px' : '45px'} height="10px" />
        <ShimmerBlock width="35px" height="10px" />
      </div>

      {/* תוכן ההודעה */}
      <div
        className={`rounded-lg px-3 py-2 ${isUser ? 'mr-4' : 'ml-4'}`}
        style={{
          background: isUser
            ? 'rgba(59, 130, 246, 0.1)'
            : 'rgba(255, 255, 255, 0.05)',
          borderRight: isUser ? '2px solid rgba(59, 130, 246, 0.3)' : undefined,
          borderLeft: !isUser ? '2px solid rgba(102, 102, 102, 0.3)' : undefined,
        }}
      >
        <div className="flex flex-col gap-2">
          {isUser ? (
            <>
              <ShimmerBlock width="85%" height="12px" />
              <ShimmerBlock width="50%" height="12px" />
            </>
          ) : (
            <>
              <ShimmerBlock width="95%" height="12px" />
              <ShimmerBlock width="88%" height="12px" />
              <ShimmerBlock width="72%" height="12px" />
              <ShimmerBlock width="40%" height="12px" />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// -------------------------------------------------
// ConversationListSkeleton — שלד רשימת שיחות
// -------------------------------------------------
// מחקה רשימת שיחות בסיידבר: אייקון + שורות טקסט
// -------------------------------------------------
export function ConversationListSkeleton({
  count = 5,
  className = '',
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-2 px-3 py-2 rounded-md"
          style={{
            background: 'rgba(255, 255, 255, 0.03)',
            animationDelay: `${i * 100}ms`,
          }}
        >
          {/* אייקון */}
          <ShimmerBlock width="16px" height="16px" borderRadius="4px" />

          {/* טקסט */}
          <div className="flex-1 flex flex-col gap-1.5">
            <ShimmerBlock
              width={`${70 - i * 5}%`}
              height="11px"
            />
            <ShimmerBlock
              width={`${45 - i * 3}%`}
              height="9px"
            />
          </div>
        </div>
      ))}
    </div>
  );
}
