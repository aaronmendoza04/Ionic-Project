import React, { useState, useEffect } from 'react';
import { IonContent, IonPage, IonToast, IonSpinner } from '@ionic/react';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { QRCodeCanvas } from 'qrcode.react';
import {
  Ship, Camera as CameraIcon, Send, CheckCircle2, Clock,
  XCircle, Navigation, Copy, Sparkles, Truck, Package, Building2, User
} from 'lucide-react';
import { supabase } from '../lib/supabase';

const Tab1: React.FC = () => {
  const [driverName, setDriverName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [plateNumber, setPlateNumber] = useState('');
  const [cargoSummary, setCargoSummary] = useState('');
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const [loading, setLoading] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [myAppointments, setMyAppointments] = useState<any[]>([]);

  const fetchAppointments = async () => {
    const { data } = await supabase
      .from('appointments')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setMyAppointments(data);
  };

  useEffect(() => {
    fetchAppointments();
    const channel = supabase
      .channel('driver-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, () => {
        fetchAppointments();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const takePhoto = async () => {
    try {
      const image = await Camera.getPhoto({
        quality: 80,
        allowEditing: false,
        resultType: CameraResultType.Uri,
        source: CameraSource.Prompt
      });

      if (image.webPath) {
        setPhotoPreview(image.webPath);
        const response = await fetch(image.webPath);
        const blob = await response.blob();
        setPhotoBlob(blob);
      }
    } catch (error) {
      console.log('Camera cancelled', error);
    }
  };

  const handleSubmit = async () => {
    if (!driverName || !companyName || !plateNumber || !cargoSummary) {
      setToastMsg('Please complete all required manifest fields.');
      return;
    }

    setLoading(true);
    let manifestUrl = null;

    try {
      if (photoBlob) {
        const fileName = `manifest_${Date.now()}.jpg`;
        const { error: uploadError } = await supabase.storage
          .from('manifests')
          .upload(fileName, photoBlob, { contentType: 'image/jpeg' });

        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage
          .from('manifests')
          .getPublicUrl(fileName);

        manifestUrl = publicUrlData.publicUrl;
      }

      const { error } = await supabase.from('appointments').insert([
        {
          driver_name: driverName,
          company_name: companyName,
          plate_number: plateNumber.toUpperCase(),
          cargo_summary: cargoSummary,
          manifest_photo_url: manifestUrl,
          status: 'pending'
        }
      ]);

      if (error) throw error;

      setToastMsg('Freight clearance transmitted to Port Authority!');
      setDriverName('');
      setCompanyName('');
      setPlateNumber('');
      setCargoSummary('');
      setPhotoPreview(null);
      setPhotoBlob(null);
    } catch (err: any) {
      setToastMsg(err.message || 'Submission failed.');
    } finally {
      setLoading(false);
    }
  };

  const copyPassId = (id: string) => {
    navigator.clipboard.writeText(id);
    setToastMsg('Pass ID copied! Ready to paste in Gate Scanner.');
  };

  const renderStatusPill = (status: string) => {
    switch (status) {
      case 'approved':
        return <span className="status-pill status-approved"><CheckCircle2 size={13} /> Cleared • Show QR</span>;
      case 'inside':
        return <span className="status-pill status-inside"><Navigation size={13} /> Inside Terminal</span>;
      case 'rejected':
        return <span className="status-pill status-rejected"><XCircle size={13} /> Rejected</span>;
      default:
        return <span className="status-pill status-pending"><Clock size={13} /> Awaiting Review</span>;
    }
  };

  return (
    <IonPage>
      <IonContent fullscreen>
        <div className="port-container">
          {/* Sleek Hero Header */}
          <div className="animate-enter" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#38bdf8', fontSize: '12px', fontWeight: 700, letterSpacing: '1px' }}>
                <Ship size={15} /> MARITIME LOGISTICS PORTAL
              </div>
              <h1 style={{ margin: '4px 0 0', fontSize: '26px', fontWeight: 800, letterSpacing: '-0.5px' }}>
                PortPass <span style={{ color: '#38bdf8' }}>Driver</span>
              </h1>
            </div>
            <div style={{ background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '6px 12px', borderRadius: '999px', fontSize: '11px', fontWeight: 600, color: '#34d399', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span className="live-dot" /> Live Sync
            </div>
          </div>

          {/* Glass Registration Card */}
          <div className="glass-card animate-enter">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
              <div style={{ background: 'rgba(14, 165, 233, 0.15)', padding: '10px', borderRadius: '12px', color: '#38bdf8' }}>
                <Sparkles size={20} />
              </div>
              <div>
                <h2 style={{ margin: 0, fontSize: '17px', fontWeight: 700 }}>Request Freight Clearance</h2>
                <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#94a3b8' }}>Submit manifest for instant QR gate issuance</p>
              </div>
            </div>

            <div className="modern-field">
              <label><User size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} /> Driver Full Name</label>
              <input className="modern-input" value={driverName} onChange={e => setDriverName(e.target.value)} placeholder="e.g. Aaron Mendoza" />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div className="modern-field">
                <label><Building2 size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} /> Fleet Company</label>
                <input className="modern-input" value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="Mindoro Freight" />
              </div>
              <div className="modern-field">
                <label><Truck size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} /> Plate Number</label>
                <input className="modern-input" style={{ fontFamily: 'JetBrains Mono, monospace', textTransform: 'uppercase' }} value={plateNumber} onChange={e => setPlateNumber(e.target.value)} placeholder="NBI-4021" />
              </div>
            </div>

            <div className="modern-field">
              <label><Package size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} /> Cargo Manifest Summary</label>
              <textarea className="modern-input" rows={2} value={cargoSummary} onChange={e => setCargoSummary(e.target.value)} placeholder="e.g. 200 Sacks of Agricultural Produce • Container #44" />
            </div>

            <div style={{ marginBottom: '18px' }}>
              <button type="button" className="btn-outline-glass" onClick={takePhoto}>
                <CameraIcon size={17} />
                {photoPreview ? 'Replace Cargo Manifest Photo' : 'Snap / Upload Bill of Lading Photo'}
              </button>

              {photoPreview && (
                <div style={{ marginTop: '12px', position: 'relative', borderRadius: '14px', overflow: 'hidden', border: '1px solid rgba(56, 189, 248, 0.3)' }}>
                  <img src={photoPreview} alt="Manifest Preview" style={{ width: '100%', maxHeight: '190px', objectFit: 'cover', display: 'block' }} />
                </div>
              )}
            </div>

            <button type="button" className="btn-glow" onClick={handleSubmit} disabled={loading}>
              {loading ? <IonSpinner name="crescent" /> : <><Send size={17} /> Transmit Clearance Request</>}
            </button>
          </div>

          {/* Digital Gate Passes Feed */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '28px 4px 14px' }}>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: '#94a3b8' }}>
              Active Digital Passes ({myAppointments.length})
            </h3>
          </div>

          {myAppointments.map((apt, idx) => (
            <div key={apt.id} className="glass-card animate-enter" style={{ animationDelay: `${idx * 0.06}s` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                <div>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                    {apt.company_name}
                  </span>
                  <h3 style={{ margin: '4px 0 0', fontSize: '22px', fontWeight: 800, fontFamily: 'JetBrains Mono, monospace' }}>
                    {apt.plate_number}
                  </h3>
                </div>
                {renderStatusPill(apt.status)}
              </div>

              <div style={{ fontSize: '13px', color: '#cbd5e1', display: 'grid', gap: '4px' }}>
                <div><strong style={{ color: '#64748b' }}>Operator:</strong> {apt.driver_name}</div>
                <div><strong style={{ color: '#64748b' }}>Declaration:</strong> {apt.cargo_summary}</div>
              </div>

              {(apt.status === 'approved' || apt.status === 'inside') && (
                <div className="qr-boarding-pass">
                  <div style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '1.5px', color: '#0ea5e9', marginBottom: '10px' }}>
                    PORT AUTHORITY E-GATE PASS
                  </div>
                  <QRCodeCanvas value={apt.id} size={170} style={{ margin: '0 auto' }} />
                  <div style={{ marginTop: '12px', padding: '8px 12px', background: '#e2e8f0', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '11px', fontWeight: 700, color: '#334155', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {apt.id}
                    </span>
                    <button
                      onClick={() => copyPassId(apt.id)}
                      style={{ background: '#0f172a', color: '#fff', border: 'none', borderRadius: '7px', padding: '5px 10px', fontSize: '11px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}
                    >
                      <Copy size={12} /> Copy ID
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        <IonToast isOpen={!!toastMsg} message={toastMsg} duration={2800} position="top" onDidDismiss={() => setToastMsg('')} />
      </IonContent>
    </IonPage>
  );
};

export default Tab1;