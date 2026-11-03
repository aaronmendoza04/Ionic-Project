import React, { useState, useEffect } from 'react';
import { IonContent, IonPage, IonToast } from '@ionic/react';
import { BarcodeScanner } from '@capacitor-mlkit/barcode-scanning';
import {
  QrCode, ScanLine, ShieldAlert, CheckCircle2, Search,
  ArrowRightCircle, LogOut, Timer, Ship, MapPin, History, ShieldCheck, Radar
} from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Tab3Props {
  staffName: string;
  onLogout: () => void;
}

const Tab3: React.FC<Tab3Props> = ({ staffName, onLogout }) => {
  const [passIdInput, setPassIdInput] = useState('');
  const [scannedApt, setScannedApt] = useState<any | null>(null);
  const [guardRemark, setGuardRemark] = useState('');
  const [checks, setChecks] = useState({ sealMatch: true, brakesTires: true, driverPpe: true });
  const [recentLogs, setRecentLogs] = useState<any[]>([]);
  const [toastMsg, setToastMsg] = useState('');

  const fetchGateActivity = async () => {
    const { data } = await supabase.from('appointments').select('*').in('status', ['approved', 'inside', 'completed']).order('created_at', { ascending: false }).limit(10);
    if (data) setRecentLogs(data);
  };

  useEffect(() => {
    fetchGateActivity();
    const channel = supabase.channel('guard-feed').on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, fetchGateActivity).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const verifyPassId = async (idToVerify: string) => {
    const cleanId = idToVerify.trim();
    if (!cleanId) return;
    const { data, error } = await supabase.from('appointments').select('*').eq('id', cleanId).single();
    if (error || !data) { 
      setToastMsg('Unrecognized Gate Pass ID!'); 
      setScannedApt(null); 
    } else {
      setScannedApt(data);
      setGuardRemark(data.guard_notes || 'Container seal intact | Safety checklist passed');
    }
  };

  const startCameraScan = async () => {
    try {
      const { barcodes } = await BarcodeScanner.scan();
      if (barcodes.length > 0 && barcodes[0].rawValue) { 
        setPassIdInput(barcodes[0].rawValue); 
        verifyPassId(barcodes[0].rawValue); 
      }
    } catch { 
      setToastMsg('Native camera active on Android APK. Use Quick-Select or UUID box on browser.'); 
    }
  };

  const markTruckEntered = async () => {
    if (!scannedApt) return;
    if (!Object.values(checks).every(Boolean)) { 
      setToastMsg('Complete all 3 Physical Safety checks before opening gate!'); 
      return; 
    }
    const { data, error } = await supabase.from('appointments').update({
      status: 'inside', entry_time: new Date().toISOString(), is_approaching: false, safety_verified: true, guard_notes: guardRemark
    }).eq('id', scannedApt.id).select().single();
    if (!error && data) { 
      setScannedApt(data); 
      fetchGateActivity(); 
      setToastMsg(`ENTRY LOGGED: Barrier opened for ${data.plate_number}!`); 
    }
  };

  const markTruckExited = async () => {
    if (!scannedApt) return;
    const { data, error } = await supabase.from('appointments').update({ 
      status: 'completed', exit_time: new Date().toISOString(), guard_notes: guardRemark 
    }).eq('id', scannedApt.id).select().single();
    if (!error && data) { 
      setScannedApt(data); 
      fetchGateActivity(); 
      setToastMsg(`DEPARTURE LOGGED: ${data.plate_number} has exited!`); 
    }
  };

  const approachingTrucks = recentLogs.filter(a => a.is_approaching && a.status === 'approved');
  const quickSelectCandidates = recentLogs.filter(a => (a.status === 'approved' && !a.is_approaching) || a.status === 'inside').slice(0, 5);

  return (
    <IonPage>
      <IonContent fullscreen>
        <div className="port-container">
          <div className="animate-enter" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '22px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#38bdf8', fontSize: '12px', fontWeight: 700 }}>
                <ScanLine size={15} /> SECURITY TERMINAL
              </div>
              <h1 style={{ margin: '4px 0 0', fontSize: '26px', fontWeight: 800 }}>Gate <span style={{ color: '#38bdf8' }}>Scanner</span></h1>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
                <ShieldCheck size={13} /> Officer: <strong style={{ color: '#f8fafc' }}>{staffName}</strong>
              </div>
            </div>
            <button className="role-logout-btn" onClick={onLogout}><LogOut size={13} /> Logout</button>
          </div>

          {approachingTrucks.length > 0 && (
            <div className="glass-card animate-enter" style={{ borderColor: '#eab308', background: 'rgba(234, 179, 8, 0.1)', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#eab308', fontWeight: 800, fontSize: '14px', marginBottom: '12px', textTransform: 'uppercase' }}>
                <Radar size={18} className="status-approaching" style={{ borderRadius: '50%', padding: '2px' }} /> Incoming Geofence Alerts
              </div>
              <div style={{ display: 'grid', gap: '8px' }}>
                {approachingTrucks.map(c => (
                  <button key={c.id} onClick={() => { setPassIdInput(c.id); verifyPassId(c.id); }} style={{ background: '#1e293b', border: '1px solid #eab308', color: '#fde047', borderRadius: '10px', padding: '10px', fontSize: '14px', fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', cursor: 'pointer', display: 'flex', justifyContent: 'space-between' }}>
                    <span>{c.plate_number}</span> <span>Tap to Inspect ➔</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="glass-card animate-enter" style={{ textAlign: 'center' }}>
            <div className="scanner-frame"><div className="scanner-laser" /><QrCode size={76} color="#38bdf8" style={{ opacity: 0.8 }} /></div>
            <button className="btn-glow" onClick={startCameraScan} style={{ marginBottom: '18px' }}><ScanLine size={18} /> Launch Optical Scanner</button>

            <div className="modern-field" style={{ textAlign: 'left', marginBottom: '12px' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input className="modern-input" style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '12px' }} value={passIdInput} onChange={e => setPassIdInput(e.target.value)} placeholder="Paste Pass ID..." />
                <button onClick={() => verifyPassId(passIdInput)} style={{ background: '#1e293b', color: '#38bdf8', border: '1px solid rgba(56,189,248,0.35)', borderRadius: '14px', padding: '0 18px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}><Search size={16} /> Verify</button>
              </div>
            </div>

            {quickSelectCandidates.length > 0 && (
              <div style={{ textAlign: 'left', marginTop: '14px' }}>
                <div style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '8px' }}>Other Active Vehicles:</div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {quickSelectCandidates.map(c => (
                    <button key={c.id} onClick={() => { setPassIdInput(c.id); verifyPassId(c.id); }} style={{ background: 'rgba(14, 165, 233, 0.12)', border: '1px solid rgba(56, 189, 248, 0.35)', color: '#38bdf8', borderRadius: '8px', padding: '6px 10px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>
                      {c.plate_number}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {scannedApt && (
            <div className="glass-card animate-enter" style={{ borderColor: '#38bdf8' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div>
                  <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 700 }}>VERIFIED VEHICLE</span>
                  <h2 style={{ margin: '2px 0 0', fontSize: '24px', fontWeight: 800, fontFamily: 'JetBrains Mono, monospace' }}>{scannedApt.plate_number}</h2>
                </div>
                <span className={`status-pill status-${scannedApt.status}`}>{scannedApt.status}</span>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
                <span className="meta-tag"><Ship size={12} color="#38bdf8" /> {scannedApt.vessel_name}</span>
                <span className="meta-tag"><ShieldCheck size={12} color="#c084fc" /> {scannedApt.container_seal}</span>
                {scannedApt.assigned_slot && <span className="meta-tag"><MapPin size={12} color="#34d399" /> {scannedApt.assigned_berth} (Slot {scannedApt.assigned_slot})</span>}
              </div>

              {scannedApt.status === 'approved' && (
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '8px' }}>Security & Safety Checklist:</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '8px' }}>
                    <div className={`check-item ${checks.sealMatch ? 'checked' : ''}`} onClick={() => setChecks({ ...checks, sealMatch: !checks.sealMatch })}><CheckCircle2 size={15} /> Seal #{scannedApt.container_seal} Intact</div>
                    <div className={`check-item ${checks.brakesTires ? 'checked' : ''}`} onClick={() => setChecks({ ...checks, brakesTires: !checks.brakesTires })}><CheckCircle2 size={15} /> Brakes & Tires Passed</div>
                    <div className={`check-item ${checks.driverPpe ? 'checked' : ''}`} onClick={() => setChecks({ ...checks, driverPpe: !checks.driverPpe })}><CheckCircle2 size={15} /> Driver PPE Verified</div>
                  </div>
                </div>
              )}

              {(scannedApt.status === 'approved' || scannedApt.status === 'inside') && (
                <div className="modern-field" style={{ marginBottom: '14px' }}>
                  <label>Checkpoint Officer Inspection Log</label>
                  <input className="modern-input" value={guardRemark} onChange={e => setGuardRemark(e.target.value)} />
                </div>
              )}

              {scannedApt.status === 'approved' ? (
                <button onClick={markTruckEntered} className="btn-glow" style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}><ArrowRightCircle size={19} /> 1st Scan: Open Entry Gate</button>
              ) : scannedApt.status === 'inside' ? (
                <button onClick={markTruckExited} className="btn-glow" style={{ background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)' }}><Timer size={19} /> 2nd Scan: Log Exit</button>
              ) : scannedApt.status === 'completed' ? (
                <div style={{ padding: '12px', borderRadius: '12px', background: 'rgba(139, 92, 246, 0.14)', color: '#c084fc', fontWeight: 700, fontSize: '13px', textAlign: 'center' }}><CheckCircle2 size={16} style={{ verticalAlign: 'middle', marginRight: '6px' }} /> Trip Completed</div>
              ) : (
                <div style={{ padding: '12px', borderRadius: '12px', background: 'rgba(239, 68, 68, 0.12)', color: '#f87171', fontWeight: 700, fontSize: '13px', textAlign: 'center' }}><ShieldAlert size={16} style={{ verticalAlign: 'middle', marginRight: '6px' }} /> Clearance Not Approved</div>
              )}
            </div>
          )}

          <div className="glass-card animate-enter">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}><History size={17} color="#38bdf8" /><h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800 }}>Recent Gate Log</h3></div>
            {recentLogs.filter(l => l.entry_time).length === 0 ? (
              <div style={{ fontSize: '12px', color: '#64748b', textAlign: 'center', padding: '12px' }}>No vehicles scanned today.</div>
            ) : (
              <div style={{ display: 'grid', gap: '10px' }}>
                {recentLogs.filter(l => l.entry_time).map(log => (
                  <div key={log.id} style={{ background: 'rgba(6, 11, 20, 0.6)', padding: '10px 14px', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div>
                      <div style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 800, fontSize: '14px', color: '#fff' }}>{log.plate_number} <span style={{ fontSize: '11px', color: '#38bdf8', fontWeight: 600 }}> | {log.assigned_berth || 'Pier 1'}</span></div>
                      <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>In: {new Date(log.entry_time).toLocaleTimeString()} {log.exit_time ? ` | Out: ${new Date(log.exit_time).toLocaleTimeString()}` : ' (In Dock)'}</div>
                    </div>
                    <span className={`status-pill status-${log.status}`}>{log.status}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
        <IonToast isOpen={!!toastMsg} message={toastMsg} duration={2800} position="top" onDidDismiss={() => setToastMsg('')} />
      </IonContent>
    </IonPage>
  );
};
export default Tab3;