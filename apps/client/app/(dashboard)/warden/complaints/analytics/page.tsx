'use client'

import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { useApi } from '@/hooks/useApi';
import { useRouter } from 'next/navigation';

export default function ComplaintsAnalytics() {
  const [stats, setStats] = useState<{
    by_category: Record<string, number>;
    by_status: Record<string, number>;
    by_urgency: Record<string, number>;
    average_resolution_time_hours: number;
  } | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<{
    patterns: Array<{
      issue: string;
      frequency: string;
      recommendation: string;
      priority: 'high' | 'medium' | 'low';
    }>;
    summary: string;
  } | null>(null);
  const [loadingAi, setLoadingAi] = useState(false);
  
  const { apiGet } = useApi();
  const router = useRouter();

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await apiGet('/api/complaints/stats');
        if (res.success) setStats(res.data);
      } catch {
      }
    };
    fetchStats();
  }, []);

  const generateAiAnalysis = async () => {
    setLoadingAi(true);
    try {
      const res = await apiGet('/api/complaints/analytics');
      if (res.success) setAiAnalysis(res.data);
    } catch {
    } finally {
      setLoadingAi(false);
    }
  };

  const categories = ['electrical', 'plumbing', 'furniture', 'cleaning', 'other'];
  const colors = { electrical: 'bg-yellow-500', plumbing: 'bg-blue-500', furniture: 'bg-green-500', cleaning: 'bg-teal-500', other: 'bg-gray-500' };

  const totalComplaints = stats ? Object.values(stats.by_category).reduce((a: number, b: number) => a + b, 0) : 0;

  return (
    <div className="min-h-screen bg-white px-6 py-10 max-w-4xl mx-auto">
      <div className="flex justify-between items-start mb-6">
        <PageHeader title="Complaint Analytics" showBack />
      </div>
      
      {/* SECTION 1 — Stats Row */}
      {stats && (
        <div className="grid grid-cols-4 gap-4 mb-8">
          <div className="p-4 border border-gray-100 rounded-xl bg-gray-50 text-center">
            <div className="text-2xl font-semibold text-gray-900">{totalComplaints}</div>
            <div className="text-xs text-gray-500">Total</div>
          </div>
          <div className="p-4 border border-gray-100 rounded-xl bg-gray-50 text-center">
            <div className="text-2xl font-semibold text-gray-900">{stats.by_status.open || 0}</div>
            <div className="text-xs text-gray-500">Open</div>
          </div>
          <div className="p-4 border border-gray-100 rounded-xl bg-gray-50 text-center">
            <div className="text-2xl font-semibold text-gray-900">{stats.by_status.in_progress || 0}</div>
            <div className="text-xs text-gray-500">In Progress</div>
          </div>
          <div className="p-4 border border-gray-100 rounded-xl bg-gray-50 text-center">
            <div className="text-2xl font-semibold text-gray-900">{stats.by_status.resolved || 0}</div>
            <div className="text-xs text-gray-500">Resolved</div>
          </div>
        </div>
      )}

      {/* SECTION 2 — Category Breakdown */}
      {stats && (
        <div className="mb-10 p-6 border border-gray-100 rounded-xl bg-white">
          <h2 className="text-lg font-medium text-gray-900 mb-6">Category Breakdown</h2>
          <div className="space-y-4">
            {categories.map(cat => {
              const count = stats.by_category[cat] || 0;
              const percentage = totalComplaints ? Math.round((count / totalComplaints) * 100) : 0;
              return (
                <div key={cat}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="capitalize text-gray-700">{cat}</span>
                    <span className="text-gray-500">{count} ({percentage}%)</span>
                  </div>
                  <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                    <div className={`h-2 rounded-full ${colors[cat as keyof typeof colors]}`} style={{ width: `${percentage}%` }}></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SECTION 3 — AI Maintenance Insights */}
      <div className="p-6 border border-gray-100 rounded-xl bg-white">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-medium text-gray-900">🤖 AI Maintenance Insights</h2>
          {!aiAnalysis && (
            <button 
              onClick={generateAiAnalysis} 
              disabled={loadingAi}
              className="bg-gray-900 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-700 transition-colors disabled:opacity-50"
            >
              {loadingAi ? 'Analyzing complaint patterns...' : 'Generate AI Analysis'}
            </button>
          )}
        </div>

        {aiAnalysis && (
          <div>
            <p className="text-sm text-gray-600 mb-6">{aiAnalysis.summary}</p>
            <div className="space-y-4">
              {aiAnalysis.patterns.map((pattern: {
                issue: string;
                frequency: string;
                recommendation: string;
                priority: 'high' | 'medium' | 'low';
              }, idx: number) => (
                <div key={idx} className="p-4 border border-gray-100 rounded-xl bg-gray-50">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-medium text-gray-900 text-sm">{pattern.issue}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${pattern.priority === 'high' ? 'bg-red-100 text-red-700' : pattern.priority === 'medium' ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>
                      {pattern.priority} priority
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 mb-2">Frequency: {pattern.frequency}</div>
                  <div className="text-xs text-gray-700 bg-white p-3 rounded border border-gray-100">
                    <span className="font-medium text-gray-900">Recommendation:</span> {pattern.recommendation}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
