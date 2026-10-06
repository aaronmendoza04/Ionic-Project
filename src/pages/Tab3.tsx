import React, { useState, useEffect } from 'react';
import { IonContent, IonPage, IonToast } from '@ionic/react';
import { BarcodeScanner } from '@capacitor-mlkit/barcode-scanning';
import {
  QrCode, ScanLine, ShieldAlert, CheckCircle2, Search,
  ArrowRightCircle, LogOut, Timer, Ship, Scale, MapPin, History, ShieldCheck, AlertTriangle
} from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Tab3Props {
  onLogout: () => void;
}

const Tab3: React.FC<Tab3Props> = ({ onLogout }) => {
  const [passIdInput, setPassIdInput] = useState('');
  const [scannedApt, setScannedApt] = useState<any | null>(null);
  const [weighbridgeReading, setWeighbridgeReading] = useState('');
  const [guardRemark, setGuardRemark] = useState('');
  const [checks, setChecks] = useState({
    sealMatch: true,
    brakesTires: true,
    driverPpe: true,
    tariffPaid: true
  });
  const [recentLogs, setRecentLogs] = useState<any[]>([]);
  const [toastMsg, setToastMsg] = useState('');

  const fetchGateActivity = async () => {
    const { data } = await supabase
      .from('appointments')
      .select('*')
      .in('status', ['approved', 'inside', 'completed'])
      .order('created_at', { ascending: false })
      .limit(10);
    if (data) setRecentLogs(data);
  };

  useEffect(() => {
    fetchGateActivity();
    const channel = supabase
      .channel('guard-feed')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, fetchGateActivity)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const verifyPassId = async (idToVerify: string) => {
    const cleanId = idToVerify.trim();
    if (!cleanId) return;

    const { data, error } = await supabase
      .from('appointments')
      .select('*')
      .eq('id', cleanId)
      .single();

    if (error || !data) {
      setToastMsg('Unrecognized Gate Pass ID!');
      setScannedApt(null);
    } else {
      setScannedApt(data);
      setWeighbridgeReading(String(data.actual_weighbridge_tons || data.cargo_weight_tons || '8.5'));
      setGuardRemark(data.guard_notes || 'Container seal intact • Weighbridge verified');
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
    const allChecked = Object.values(checks).every(Boolean);
    if (!allChecked) {
      setToastMsg('Complete all 4 Mandatory Safety & Seal Inspection checks before opening gate!');
      return;
    }

    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('appointments')
      .update({
        status: 'inside',
        entry_time: now,
        actual_weighbridge_tons: parseFloat(weighbridgeReading) || scannedApt.cargo_weight_tons,
        safety_verified: true,
        guard_notes: guardRemark
      })
      .eq('id', scannedApt.id)
      .select()
      .single();

    if (!error && data) {
      setScannedApt(data);
      fetchGateActivity();
      setToastMsg(`ENTRY LOGGED: Gate barrier opened for ${data.plate_number}!`);
    }
  };

  const markTruckExited = async () => {
    if (!scannedApt) return;
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('appointments')
      .update({ status: 'completed', exit_time: now, guard_notes: guardRemark })
      .eq('id', scannedApt.id)
      .select()
      .single();

    if (!error && data) {
      setScannedApt(data);
      fetchGateActivity();
      setToastMsg(`DEPARTURE LOGGED: ${data.plate_number} has exited the port!`);
    }
  };

  const declaredWeight = Number(scannedApt?.cargo_weight_tons) || 5;
  const actualWeight = parseFloat(weighbridgeReading) || declaredWeight;
  const weightDiffPct = Math.abs(((actualWeight - declaredWeight) / declaredWeight) * 100);
  const isOverweightAlert = weightDiffPct > 10;

  const quickSelectCandidates = recentLogs.filter(a => a.status === 'approved' || a.status === 'inside');

  return (
    <IonPage>
      <IonContent fullscreen>
        <div className="port-container">
          <div className="animate-enter" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '22px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#38bdf8', fontSize: '12px', fontWeight: 700, letterSpacing: '1px' }}>
                <ScanLine size={15} /> WEIGHBRIDGE & CHECKPOINT TERMINAL
              </div>
              <h1 style={{ margin: '4px 0 0', fontSize: '26px', fontWeight: 800 }}>
                Gate <span style={{ color: '#38bdf8' }}>Scanner</span>
              </h1>
            </div>
            <button className="role-logout-btn" onClick={onLogout}>
              <LogOut size={13} /> Switch Role
            </button>
          </div>

          {/* Animated Laser Viewfinder Card */}
          <div className="glass-card animate-enter" style={{ textAlign: 'center' }}>
            <div className="scanner-frame">
              <div className="scanner-laser" />
              <QrCode size={76} color="#38bdf8" style={{ opacity: 0.8 }} />
            </div>

            <button className="btn-glow" onClick={startCameraScan} style={{ marginBottom: '18px' }}>
              <ScanLine size={18} /> Launch Optical QR Scanner
            </button>

            <div className="modern-field" style={{ textAlign: 'left', marginBottom: '12px' }}>
              <label>Manual Gate Pass UUID Lookup</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  className="modern-input"
                  style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '12px' }}
                  value={passIdInput}
                  onChange={e => setPassIdInput(e.target.value)}
                  placeholder="Paste copied Pass ID here..."
                />
                <button
                  onClick={() => verifyPassId(passIdInput)}
                  style={{ background: '#1e293b', color: '#38bdf8', border: '1px solid rgba(56,189,248,0.35)', borderRadius: '14px', padding: '0 18px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Search size={16} /> Verify
                </button>
              </div>
            </div>

            {quickSelectCandidates.length > 0 && (
              <div style={{ textAlign: 'left', marginTop: '14px' }}>
                <div style={{ fontSize: '10px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '8px' }}>
                  Quick-Inspect Vehicles Approaching Gate:
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {quickSelectCandidates.map(c => (
                    <button
                      key={c.id}
                      onClick={() => { setPassIdInput(c.id); verifyPassId(c.id); }}
                      style={{
                        background: 'rgba(14, 165, 233, 0.12)',
                        border: '1px solid rgba(56, 189, 248, 0.35)',
                        color: '#38bdf8',
                        borderRadius: '10px',
                        padding: '6px 10px',
                        fontSize: '11px',
                        fontWeight: 700,
                        fontFamily: 'JetBrains Mono, monospace',
                        cursor: 'pointer'
                      }}
                    >
                      {c.plate_number} ({c.status === 'approved' ? 'Entering' : 'Inside'})
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Scanned Truck Verification & Weighbridge Module */}
          {scannedApt && (
            <div className="glass-card animate-enter" style={{ borderColor: '#38bdf8' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div>
                  <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 700 }}>VERIFIED VEHICLE MANIFEST</span>
                  <h2 style={{ margin: '2px 0 0', fontSize: '24px', fontWeight: 800, fontFamily: 'JetBrains Mono, monospace' }}>
                    {scannedApt.plate_number}
                  </h2>
                </div>
                <span className={`status-pill status-${scannedApt.status}`}>{scannedApt.status}</span>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
                <span className="meta-tag"><Ship size={12} color="#38bdf8" /> {scannedApt.vessel_name || 'MV Starlite'}</span>
                <span className="meta-tag"><Scale size={12} color="#fbbf24" /> Declared: {declaredWeight}t</span>
                <span className="meta-tag"><ShieldCheck size={12} color="#c084fc" /> {scannedApt.container_seal || 'SEAL-8842'}</span>
                <span className="meta-tag"><MapPin size={12} color="#34d399" /> {scannedApt.assigned_berth || 'Pier 1'}</span>
              </div>

              {/* Weighbridge Calibration Module */}
              {scannedApt.status === 'approved' && (
                <div style={{ background: 'rgba(6, 11, 20, 0.7)', padding: '14px', borderRadius: '14px', marginBottom: '14px', border: isOverweightAlert ? '1px solid #ef4444' : '1px solid rgba(255,255,255,0.08)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 800, color: '#fbbf24', textTransform: 'uppercase' }}>
                      <Scale size={13} style={{ verticalAlign: 'middle', marginRight: '5px' }} />
                      Weighbridge Axle Scale Reading (Tons)
                    </span>
                    <span style={{ fontSize: '11px', fontWeight: 700, color: isOverweightAlert ? '#f87171' : '#34d399' }}>
                      Variance: {weightDiffPct.toFixed(1)}%
                    </span>
                  </div>
                  <input
                    type="number"
                    step="0.1"
                    className="modern-input"
                    value={weighbridgeReading}
                    onChange={e => setWeighbridgeReading(e.target.value)}
                  />
                  {isOverweightAlert && (
                    <div style={{ marginTop: '8px', color: '#f87171', fontSize: '11px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <AlertTriangle size={14} /> DISCREPANCY ALERT: Scale differs from declared manifest by &gt;10%!
                    </div>
                  )}
                </div>
              )}

              {/* 4-Point Physical Safety & Seal Checklist */}
              {scannedApt.status === 'approved' && (
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '8px' }}>
                    Mandatory PPA Security & Safety Checklist:
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <div className={`check-item ${checks.sealMatch ? 'checked' : ''}`} onClick={() => setChecks({ ...checks, sealMatch: !checks.sealMatch })}>
                      <CheckCircle2 size={15} /> Seal #{scannedApt.container_seal || '8842'} Intact
                    </div>
                    <div className={`check-item ${checks.brakesTires ? 'checked' : ''}`} onClick={() => setChecks({ ...checks, brakesTires: !checks.brakesTires })}>
                      <CheckCircle2 size={15} /> Brakes & Tires Passed
                    </div>
                    <div className={`check-item ${checks.driverPpe ? 'checked' : ''}`} onClick={() => setChecks({ ...checks, driverPpe: !checks.driverPpe })}>
                      <CheckCircle2 size={15} /> Driver Vest & Hardhat
                    </div>
                    <div className={`check-item ${checks.tariffPaid ? 'checked' : ''}`} onClick={() => setChecks({ ...checks, tariffPaid: !checks.tariffPaid })}>
                      <CheckCircle2 size={15} /> Tariff OR Verified
                    </div>
                  </div>
                </div>
              )}

              {(scannedApt.status === 'approved' || scannedApt.status === 'inside') && (
                <div className="modern-field" style={{ marginBottom: '14px' }}>
                  <label>Checkpoint Officer Inspection Log</label>
                  <input
                    className="modern-input"
                    value={guardRemark}
                    onChange={e => setGuardRemark(e.target.value)}
                  />
                </div>
              )}

              {scannedApt.status === 'approved' ? (
                <button
                  onClick={markTruckEntered}
                  className="btn-glow"
                  style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}
                >
                  <ArrowRightCircle size={19} /> 1st Scan: Verify Scale & Open Entry Gate
                </button>
              ) : scannedApt.status === 'inside' ? (
                <button
                  onClick={markTruckExited}
                  className="btn-glow"
                  style={{ background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)' }}
                >
                  <Timer size={19} /> 2nd Scan: Log Terminal Departure (Exit)
                </button>
              ) : scannedApt.status === 'completed' ? (
                <div style={{ padding: '12px', borderRadius: '12px', background: 'rgba(139, 92, 246, 0.14)', color: '#c084fc', fontWeight: 700, fontSize: '13px', textAlign: 'center' }}>
                  <CheckCircle2 size={16} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
                  Trip Completed • Vehicle Has Departed Port
                </div>
              ) : (
                <div style={{ padding: '12px', borderRadius: '12px', background: 'rgba(239, 68, 68, 0.12)', color: '#f87171', fontWeight: 700, fontSize: '13px', textAlign: 'center' }}>
                  <ShieldAlert size={16} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
                  Hold Gate! Clearance Not Yet Approved
                </div>
              )}
            </div>
          )}

          {/* Recent Checkpoint Activity Log */}
          <div className="glass-card animate-enter">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <History size={17} color="#38bdf8" />
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800 }}>Recent Gate & Weighbridge Log</h3>
            </div>

            {recentLogs.filter(l => l.entry_time).length === 0 ? (
              <div style={{ fontSize: '12px', color: '#64748b', textAlign: 'center', padding: '12px' }}>
                No vehicles have been scanned at the gate yet today.
              </div>
            ) : (
              <div style={{ display: 'grid', gap: '10px' }}>
                {recentLogs.filter(l => l.entry_time).map(log => (
                  <div
                    key={log.id}
                    style={{ background: 'rgba(6, 11, 20, 0.6)', padding: '10px 14px', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid rgba(255,255,255,0.05)' }}
                  >
                    <div>
                      <div style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 800, fontSize: '14px', color: '#fff' }}>
                        {log.plate_number} <span style={{ fontSize: '11px', color: '#38bdf8', fontWeight: 600 }}>• {log.assigned_berth || 'Pier 1'}</span>
                      </div>
                      <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                        Scale: {log.actual_weighbridge_tons || log.cargo_weight_tons}t • In: {new Date(log.entry_time).toLocaleTimeString()}
                        {log.exit_time ? ` → Out: ${new Date(log.exit_time).toLocaleTimeString()}` : ' (In Dock)'}
                      </div>
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