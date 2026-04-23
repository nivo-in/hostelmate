'use client';

import { useEffect, useState } from 'react';
import { PageShell } from '@/components/ui/PageShell';
import { Reveal } from '@/components/ui/Reveal';
import { createClient } from '@/lib/supabase/client';
import { Profile } from '@/types';
import { Phone, Mail, MapPin, Clock, ShieldCheck } from 'lucide-react';

export default function ParentContact() {
  const supabase = createClient();
  const [warden, setWarden] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchWarden = async () => {
      try {
        const { data } = await supabase
          .from('staff')
          .select('*, profiles(*)')
          .eq('role', 'warden')
          .limit(1)
          .single();

        if (data?.profiles) {
          setWarden(data.profiles);
        }
      } catch {
        // Silently fail
      } finally {
        setLoading(false);
      }
    };

    fetchWarden();
  }, [supabase]);

  return (
    <PageShell title="Contact Warden" subtitle="Direct contact channels for hostel administration & emergency support">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>
        <Reveal>
          <div style={{
            background: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(255,255,255,0.07)',
            borderRadius: '16px', padding: '24px', position: 'relative', overflow: 'hidden',
            backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(251,146,60,0.1)', border: '0.5px solid rgba(251,146,60,0.25)', color: '#fb923c', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ShieldCheck size={18} />
              </div>
              <div>
                <h2 style={{ fontSize: '15px', fontWeight: 500, color: '#ffffff', margin: 0 }}>Chief Warden Details</h2>
                <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.35)', margin: '2px 0 0 0' }}>Official hostel administration contact</p>
              </div>
            </div>

            {loading ? (
              <div style={{ padding: '24px', textAlign: 'center', fontSize: '13px', color: 'rgba(255,255,255,0.4)' }}>
                Loading warden details...
              </div>
            ) : warden ? (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '20px' }}>
                  <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(255,255,255,0.12)', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', fontWeight: 600 }}>
                    {warden.full_name?.[0] ?? 'W'}
                  </div>
                  <div>
                    <h3 style={{ fontSize: '16px', fontWeight: 500, color: '#ffffff', margin: 0 }}>{warden.full_name}</h3>
                    <p style={{ fontSize: '12px', color: '#fb923c', margin: '2px 0 0 0', fontWeight: 500 }}>Chief Hostel Warden</p>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
                  {warden.email && (
                    <a href={`mailto:${warden.email}`} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: 'rgba(255,255,255,0.8)', textDecoration: 'none' }}>
                      <Mail size={16} color="rgba(255,255,255,0.4)" />
                      {warden.email}
                    </a>
                  )}
                  {warden.phone && (
                    <a href={`tel:${warden.phone}`} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', color: 'rgba(255,255,255,0.8)', textDecoration: 'none' }}>
                      <Phone size={16} color="rgba(255,255,255,0.4)" />
                      {warden.phone}
                    </a>
                  )}
                </div>

                {warden.phone && (
                  <a
                    href={`tel:${warden.phone}`}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                      width: '100%', padding: '12px 16px', borderRadius: '12px',
                      background: 'rgba(251,146,60,0.15)', border: '0.5px solid rgba(251,146,60,0.35)',
                      color: '#fb923c', fontWeight: 500, fontSize: '13px', textDecoration: 'none',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <Phone size={16} /> Call Warden Now
                  </a>
                )}
              </div>
            ) : (
              <div style={{ padding: '20px', textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: '13px' }}>
                Warden details have not been configured yet.
              </div>
            )}
          </div>
        </Reveal>

        <Reveal delay={60}>
          <div style={{
            background: 'rgba(255,255,255,0.03)', border: '0.5px solid rgba(255,255,255,0.07)',
            borderRadius: '16px', padding: '24px',
            backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)'
          }}>
            <h3 style={{ fontSize: '15px', fontWeight: 500, color: '#ffffff', margin: '0 0 16px 0' }}>Hostel Office & Location</h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '13px', color: 'rgba(255,255,255,0.7)' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                <MapPin size={16} color="#60a5fa" style={{ marginTop: '2px', flexShrink: 0 }} />
                <div>
                  <strong style={{ color: '#ffffff', display: 'block', marginBottom: '2px' }}>Campus Address</strong>
                  Hostel Management Office, Block B, Main University Campus
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                <Clock size={16} color="#4ade80" style={{ marginTop: '2px', flexShrink: 0 }} />
                <div>
                  <strong style={{ color: '#ffffff', display: 'block', marginBottom: '2px' }}>Office Visiting Hours</strong>
                  09:00 AM – 06:00 PM (Monday to Saturday)
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </PageShell>
  );
}
