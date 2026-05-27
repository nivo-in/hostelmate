/**
 * @file apps/client/components/ui/AiAnalysisCard.tsx
 * Shared client component for layout renders and user interaction flows.
 */

'use client';

import { useState } from 'react';
import { useApi } from '@/hooks/useApi';

/**
 * Props for the AiAnalysisCard component.
 */
interface AiAnalysisCardProps {
  /** The category of data to analyze */
  type: 'complaints' | 'leaves' | 'visitors' | 'mess';
  /** Secondary highlight/border hex color code */
  themeColor?: string;
  /** Secondary highlight/border RGB string (e.g. '124,92,252') for transparency calculations */
  themeRgb?: string;
}

/**
 * AI-powered dashboard analytics card.
 * Triggers backend semantic analysis/summarisation of complaints, leaves, visitor traffic,
 * or mess ratings, and displays structured summary and bulleted insights.
 */
export function AiAnalysisCard({ type, themeColor = '#a78bfa', themeRgb = '167,139,250' }: AiAnalysisCardProps) {
  const [data, setData] = useState<{ summary: string; insights: string[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const { apiGet } = useApi();

  const analyze = async () => {
    setLoading(true);
    try {
      const res = await apiGet(`/api/v1/ai/analysis/${type}`);
      if (res.success) {
        setData(res.data);
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="glass-card"
      style={{
        padding: '20px 24px',
        border: `0.5px solid rgba(${themeRgb}, 0.25)`,
        borderRadius: '16px',
        background: 'rgba(255,255,255,0.02)',
        boxShadow: `inset 0 1px 0 rgba(${themeRgb}, 0.1), 0 4px 24px rgba(0,0,0,0.15)`,
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        transition: 'all 0.3s ease'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 style={{ fontSize: '15px', fontWeight: 500, color: '#ffffff', margin: 0, textTransform: 'capitalize', letterSpacing: '-0.3px' }}>
          AI Insights: {type}
        </h3>
        <button
          onClick={analyze}
          disabled={loading}
          style={{
            padding: '6px 12px',
            borderRadius: '8px',
            background: `rgba(${themeRgb}, 0.1)`,
            color: themeColor,
            fontSize: '12px',
            fontWeight: 500,
            border: `0.5px solid rgba(${themeRgb}, 0.3)`,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            opacity: loading ? 0.6 : 1
          }}
          onMouseEnter={(e) => {
            if (!loading) {
              e.currentTarget.style.background = `rgba(${themeRgb}, 0.18)`;
              e.currentTarget.style.borderColor = `rgba(${themeRgb}, 0.55)`;
            }
          }}
          onMouseLeave={(e) => {
            if (!loading) {
              e.currentTarget.style.background = `rgba(${themeRgb}, 0.1)`;
              e.currentTarget.style.borderColor = `rgba(${themeRgb}, 0.3)`;
            }
          }}
        >
          {loading ? 'Analyzing…' : 'Generate Summary'}
        </button>
      </div>

      {data ? (
        <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.75)', lineHeight: 1.6 }}>
          <p style={{ margin: '0 0 12px 0' }}>{data.summary}</p>
          <ul style={{ paddingLeft: '18px', margin: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {data.insights.map((insight, i) => (
              <li key={i} style={{ color: 'rgba(255,255,255,0.65)' }}>{insight}</li>
            ))}
          </ul>
        </div>
      ) : (
        <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.3)', margin: 0 }}>
          Click the button above to run real-time semantic analysis on recent {type} entries.
        </p>
      )}
    </div>
  );
}