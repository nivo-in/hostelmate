'use client';

import { useState } from 'react';
import { useApi } from '@/hooks/useApi';

interface AiAnalysisCardProps {
  type: 'complaints' | 'leaves' | 'visitors' | 'mess';
  themeColor?: string;
  themeRgb?: string;
}

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
    <div style={{ padding: 16, border: `1px solid rgba(${themeRgb}, 0.2)`, borderRadius: 12, background: 'rgba(0,0,0,0.2)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, color: '#fff' }}>AI Analysis: {type}</h3>
        <button 
          onClick={analyze}
          disabled={loading}
          style={{ padding: '6px 12px', borderRadius: 6, background: `rgba(${themeRgb}, 0.1)`, color: themeColor, fontSize: 13, border: `1px solid rgba(${themeRgb}, 0.3)` }}
        >
          {loading ? 'Analyzing...' : 'Analyze Now'}
        </button>
      </div>
      
      {data ? (
        <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)' }}>
          <p style={{ marginBottom: 12 }}>{data.summary}</p>
          <ul style={{ paddingLeft: 20 }}>
            {data.insights.map((insight, i) => (
              <li key={i} style={{ marginBottom: 4 }}>{insight}</li>
            ))}
          </ul>
        </div>
      ) : (
        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>Click analyze to generate insights.</p>
      )}
    </div>
  );
}