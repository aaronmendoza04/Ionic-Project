import React, { useState } from 'react';
import { IonContent, IonPage, IonToast } from '@ionic/react';
import { BarcodeScanner } from '@capacitor-mlkit/barcode-scanning';
import { QrCode, ScanLine, ShieldAlert, CheckCircle2, Search, ArrowRightCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

const Tab3: React.FC = () => {
  const [passIdInput, setPassIdInput] = useState('');
  const [scannedApt, setScannedApt] = useState<any | null>(null);
  const [toastMsg, setToastMsg] = useState('');

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
      setToastMsg('Native camera active on Android APK. Use Pass ID verification below on browser.');
    }
  };

  const markTruckEntered = async () => {
    if (!scannedApt) return;
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('appointments')
      .update({ status: 'inside', entry_time: now })
      .eq('id', scannedApt.id)
      .select()
      .single();

    if (!error && data) {
      setScannedApt(data);
      setToastMsg(`Gate Barrier Opened for ${data.plate_number}!`);
    }
  };

  return (
    <IonPage>
      <IonContent fullscreen>
        <div className="port-container">
          <div className="animate-enter" style={{ marginBottom: '22px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#38bdf8', fontSize: '12px', fontWeight: 700, letterSpacing: '1px' }}>
              <ScanLine size={15} /> SECURITY CHECKPOINT TERMINAL
            </div>
            <h1 style={{ margin: '4px 0 0', fontSize: '26px', fontWeight: 800 }}>
              Gate <span style={{ color: '#38bdf8' }}>Scanner</span>
            </h1>
          </div>

          {/* Animated Laser Viewfinder Card */}
          <div className="glass-card animate-enter" style={{ textAlign: 'center' }}>
            <div className="scanner-frame">
              <div className="scanner-laser" />
              <QrCode size={76} color="#38bdf8" style={{ opacity: 0.8 }} />
            </div>

            <button className="btn-glow" onClick={startCameraScan} style={{ marginBottom: '20px' }}>
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
          </div>

          {/* Scanned Truck Verification Result */}
          {scannedApt && (
            <div className="glass-card animate-enter" style={{ borderColor: scannedApt.status === 'approved' ? '#10b981' : '#38bdf8' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <div>
                  <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 700 }}>VERIFIED VEHICLE</span>
                  <h2 style={{ margin: '2px 0 0', fontSize: '24px', fontWeight: 800, fontFamily: 'JetBrains Mono, monospace' }}>
                    {scannedApt.plate_number}
                  </h2>
                </div>
                <span className={`status-pill status-${scannedApt.status}`}>{scannedApt.status}</span>
              </div>

              <div style={{ fontSize: '13px', color: '#cbd5e1', display: 'grid', gap: '6px', marginBottom: '18px' }}>
                <div><strong>Driver:</strong> {scannedApt.driver_name}</div>
                <div><strong>Company:</strong> {scannedApt.company_name}</div>
                <div><strong>Cargo:</strong> {scannedApt.cargo_summary}</div>
              </div>

              {scannedApt.status === 'approved' ? (
                <button
                  onClick={markTruckEntered}
                  className="btn-glow"
                  style={{ background: 'linear-gradient(135deg, #10b981, #059669)', boxShadow: '0 10px 25px -5px rgba(16, 185, 129, 0.5)' }}
                >
                  <ArrowRightCircle size={19} /> Authorize Terminal Entry
                </button>
              ) : scannedApt.status === 'inside' ? (
                <div style={{ padding: '12px', borderRadius: '12px', background: 'rgba(14, 165, 233, 0.12)', color: '#38bdf8', fontWeight: 700, fontSize: '13px', textAlign: 'center' }}>
                  <CheckCircle2 size={16} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
                  Vehicle Already Logged Inside Terminal
                </div>
              ) : (
                <div style={{ padding: '12px', borderRadius: '12px', background: 'rgba(239, 68, 68, 0.12)', color: '#f87171', fontWeight: 700, fontSize: '13px', textAlign: 'center' }}>
                  <ShieldAlert size={16} style={{ verticalAlign: 'middle', marginRight: '6px' }} />
                  Hold Gate! Clearance Not Yet Approved
                </div>
              )}
            </div>
          )}
        </div>

        <IonToast isOpen={!!toastMsg} message={toastMsg} duration={2800} position="top" onDidDismiss={() => setToastMsg('')} />
      </IonContent>
    </IonPage>
  );
};

export default Tab3;