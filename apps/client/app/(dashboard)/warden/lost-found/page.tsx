'use client';
import { Search } from 'lucide-react';

import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { PageShell } from '@/components/ui/PageShell';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { createClient } from '@/lib/supabase/client';
import { useApi } from '@/hooks/useApi';
import { useRouter } from 'next/navigation';
import { LostAndFound } from '@/types';
import { ui, panel, buttonGhost, container } from '@/lib/ui';

export default function WardenLostFound() {
  const [activeTab, setActiveTab] = useState('All');
  const [items, setItems] = useState<LostAndFound[]>([]);
  const [message, setMessage] = useState('');
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);

  const { apiGet, apiPatch } = useApi();
  const router = useRouter();
  const supabase = createClient();

  const fetchItems = async (currentPage = 1) => {
    try {
      const res = await apiGet(`/api/v1/lost-found?page=${currentPage}&limit=20`);
      if (res.success) {
        if (currentPage === 1) {
          setItems(res.data || []);
        } else {
          setItems((prev) => [...prev, ...(res.data || [])]);
        }
        setHasNext(res.pagination?.hasNext || false);
      }
    } catch {
      // Silently fail
    }
  };

  useEffect(() => {
    fetchItems(1);
  }, []);

  const handleClaim = async (id: string) => {
    try {
      const res = await apiPatch(`/api/v1/lost-found/${id}/claim`, {});
      if (res.success) {
        setMessage('Item marked as claimed');
        fetchItems();
        setTimeout(() => setMessage(''), 3000);
      }
    } catch {
      // Silently fail
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const getStatusVariant = (status: string) => {
    if (status === 'claimed') {return 'success';}
    if (status === 'lost') {return 'danger';}
    return 'warning';
  };

  const filteredItems = items.filter((i) => {
    if (activeTab === 'All') {return true;}
    return i.status.toLowerCase() === activeTab.toLowerCase();
  });

  return (
    <PageShell>
      <PageHeader title="Lost & Found" showBack onSignOut={handleSignOut} />

      <div style={container}>
        {message && (
          <div
            style={{
              marginBottom: '20px',
              padding: '12px 16px',
              background: 'rgba(74,222,128,0.1)',
              border: '0.5px solid rgba(74,222,128,0.25)',
              borderRadius: ui.radiusXs,
              color: ui.green,
              fontSize: '13px',
              fontWeight: 500,
            }}
          >
            {message}
          </div>
        )}

        {/* Tabs */}
        <div
          style={{
            display: 'flex',
            gap: '6px',
            marginBottom: '24px',
            borderBottom: ui.border,
            paddingBottom: '2px',
            overflowX: 'auto',
          }}
        >
          {['All', 'Lost', 'Found', 'Claimed'].map((tab) => {
            const active = activeTab === tab;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                style={{
                  padding: '8px 14px',
                  fontSize: '13px',
                  fontWeight: 500,
                  whiteSpace: 'nowrap',
                  background: active ? 'rgba(124,92,252,0.12)' : 'transparent',
                  border: active ? '0.5px solid rgba(124,92,252,0.3)' : '0.5px solid transparent',
                  borderRadius: ui.radiusXs,
                  color: active ? ui.text : ui.textMuted,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  if (!active) {e.currentTarget.style.color = ui.textSoft;}
                }}
                onMouseLeave={(e) => {
                  if (!active) {e.currentTarget.style.color = ui.textMuted;}
                }}
              >
                {tab}
              </button>
            );
          })}
        </div>

        {/* Table */}
        <div style={{ ...panel, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: ui.border }}>
                  {['Item Name', 'Description', 'Status', 'Location', 'Reported By', 'Date', 'Actions'].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: '12px 18px',
                        textAlign: 'left',
                        fontSize: '11px',
                        fontWeight: 500,
                        color: ui.textMuted,
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={7}>
                      <EmptyState
                        message={`No ${activeTab !== 'All' ? activeTab.toLowerCase() : ''} items found`}
                        icon={<Search strokeWidth={1.5} />}
                      />
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item) => (
                    <tr
                      key={item.id}
                      className="row-hover"
                      style={{ borderBottom: '0.5px solid rgba(255,255,255,0.04)' }}
                    >
                      <td style={{ padding: '12px 18px', color: ui.text, fontWeight: 500 }}>{item.item_name}</td>
                      <td
                        style={{
                          padding: '12px 18px',
                          color: ui.textSoft,
                          maxWidth: '150px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                        title={item.description}
                      >
                        {item.description}
                      </td>
                      <td style={{ padding: '12px 18px' }}>
                        <Badge variant={getStatusVariant(item.status)}>{item.status.toUpperCase()}</Badge>
                      </td>
                      <td style={{ padding: '12px 18px', color: ui.textSoft }}>{item.location_found || '-'}</td>
                      <td style={{ padding: '12px 18px', color: ui.textMuted }}>
                        {(item as unknown as { students?: { profiles?: { full_name?: string } } })
                          .students?.profiles?.full_name || 'Unknown'}
                      </td>
                      <td style={{ padding: '12px 18px', color: ui.textMuted, whiteSpace: 'nowrap' }}>
                        {new Date(item.created_at).toLocaleDateString()}
                      </td>
                      <td style={{ padding: '12px 18px' }}>
                        {item.status !== 'claimed' && (
                          <button
                            onClick={() => handleClaim(item.id)}
                            style={{
                              background: 'rgba(74,222,128,0.12)',
                              border: '0.5px solid rgba(74,222,128,0.25)',
                              color: ui.green,
                              borderRadius: ui.radiusXs,
                              padding: '6px 12px',
                              fontSize: '12px',
                              fontWeight: 500,
                              cursor: 'pointer',
                              transition: 'all 0.2s',
                              whiteSpace: 'nowrap',
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(74,222,128,0.2)')}
                            onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(74,222,128,0.12)')}
                          >
                            Mark Claimed
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {hasNext && (
          <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'center' }}>
            <button
              onClick={() => {
                const nextPage = page + 1;
                setPage(nextPage);
                fetchItems(nextPage);
              }}
              className="btn-ghost"
              style={buttonGhost}
            >
              Load more
            </button>
          </div>
        )}
      </div>
    </PageShell>
  );
}
