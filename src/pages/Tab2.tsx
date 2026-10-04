import React, { useState, useEffect } from 'react';
import { IonContent, IonPage } from '@ionic/react';
import { ShieldCheck, Check, X, Clock, Truck, Navigation, FileImage, Activity } from 'lucide-react';
import { supabase } from '../lib/supabase';

const Tab2: React.FC = () => {
  const [appointments, setAppointments] = useState<any[]>([]);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'inside'>('all');

  const loadAppointments = async () => {
    const { data } = await supabase
      .from('appointments')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setAppointments(data);
  };

  useEffect(() => {
    loadAppointments();
    const channel = supabase
      .channel('admin-dashboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, () => {
        loadAppointments();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const updateStatus = async (id: string, newStatus: string) => {
    await supabase.from('appointments').update({ status: newStatus }).eq('id', id);
  };

  const pendingCount = appointments.filter(a => a.status === 'pending').length;
  const approvedCount = appointments.filter(a => a.status === 'approved').length;
  const insideCount = appointments.filter(a => a.status === 'inside').length;

  const filteredList = filter === 'all' ? appointments : appointments.filter(a => a.status === filter);

  return (
    <IonPage>
      <IonContent fullscreen>
        <div className="port-container">
          {/* Command Header */}
          <div className="animate-enter" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '22px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#34d399', fontSize: '12px', fontWeight: 700, letterSpacing: '1px' }}>
                <Activity size={15} /> TERMINAL OPERATIONS CENTER
              </div>
              <h1 style={{ margin: '4px 0 0', fontSize: '26px', fontWeight: 800 }}>
                Admin <span style={{ color: '#38bdf8' }}>Command Hub</span>
              </h1>
            </div>
          </div>

          {/* KPI Bento Grid */}
          <div className="animate-enter" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '22px' }}>
            <div className="glass-card" style={{ padding: '16px', marginBottom: 0, borderLeft: '3px solid #f59e0b' }}>
              <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 700 }}>PENDING</div>
              <div style={{ fontSize: '28px', fontWeight: 800, color: '#fbbf24', marginTop: '4px' }}>{pendingCount}</div>
            </div>
            <div className="glass-card" style={{ padding: '16px', marginBottom: 0, borderLeft: '3px solid #10b981' }}>
              <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 700 }}>CLEARED</div>
              <div style={{ fontSize: '28px', fontWeight: 800, color: '#34d399', marginTop: '4px' }}>{approvedCount}</div>
            </div>
            <div className="glass-card" style={{ padding: '16px', marginBottom: 0, borderLeft: '3px solid #0ea5e9' }}>
              <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 700 }}>IN TERMINAL</div>
              <div style={{ fontSize: '28px', fontWeight: 800, color: '#38bdf8', marginTop: '4px' }}>{insideCount}</div>
            </div>
          </div>

          {/* Interactive Filter Pills */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '18px', overflowX: 'auto', paddingBottom: '4px' }}>
            {(['all', 'pending', 'approved', 'inside'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                style={{
                  background: filter === tab ? '#0ea5e9' : 'rgba(15, 23, 42, 0.7)',
                  color: filter === tab ? '#fff' : '#94a3b8',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '999px',
                  padding: '8px 16px',
                  fontSize: '12px',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Live Manifest Queue */}
          {filteredList.map((apt, idx) => (
            <div key={apt.id} className="glass-card animate-enter" style={{ animationDelay: `${idx * 0.05}s` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ background: 'rgba(56, 189, 248, 0.12)', padding: '10px', borderRadius: '12px', color: '#38bdf8' }}>
                    <Truck size={20} />
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>{apt.company_name}</div>
                    <div style={{ fontSize: '19px', fontWeight: 800, fontFamily: 'JetBrains Mono, monospace' }}>{apt.plate_number}</div>
                  </div>
                </div>
                <span className={`status-pill status-${apt.status}`}>{apt.status}</span>
              </div>

              <div style={{ background: 'rgba(6, 11, 20, 0.55)', borderRadius: '12px', padding: '12px', fontSize: '13px', marginBottom: '14px' }}>
                <div><strong style={{ color: '#64748b' }}>Driver:</strong> {apt.driver_name}</div>
                <div style={{ marginTop: '4px' }}><strong style={{ color: '#64748b' }}>Cargo:</strong> {apt.cargo_summary}</div>
                {apt.entry_time && (
                  <div style={{ marginTop: '6px', color: '#38bdf8', fontWeight: 600 }}>
                    <Clock size={13} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
                    Gate Check-In: {new Date(apt.entry_time).toLocaleTimeString()}
                  </div>
                )}
              </div>

              {apt.manifest_photo_url && (
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600, marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <FileImage size={13} /> Attached Manifest Document
                  </div>
                  <img
                    src={apt.manifest_photo_url}
                    alt="Manifest"
                    style={{ width: '100%', maxHeight: '220px', objectFit: 'cover', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}
                  />
                </div>
              )}

              {apt.status === 'pending' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '10px' }}>
                  <button
                    onClick={() => updateStatus(apt.id, 'approved')}
                    style={{ background: 'linear-gradient(135deg, #10b981, #059669)', color: '#fff', border: 'none', borderRadius: '12px', padding: '13px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', cursor: 'pointer', boxShadow: '0 8px 20px -5px rgba(16, 185, 129, 0.5)' }}
                  >
                    <Check size={17} /> Issue Gate QR
                  </button>
                  <button
                    onClick={() => updateStatus(apt.id, 'rejected')}
                    style={{ background: 'rgba(239, 68, 68, 0.12)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.35)', borderRadius: '12px', padding: '13px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', cursor: 'pointer' }}
                  >
                    <X size={17} /> Reject
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </IonContent>
    </IonPage>
  );
};

export default Tab2;