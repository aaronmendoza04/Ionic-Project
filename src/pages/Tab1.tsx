import React, { useState, useEffect } from 'react';
import { IonContent, IonPage, IonToast, IonSpinner } from '@ionic/react';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { QRCodeCanvas } from 'qrcode.react';
import {
  Ship, Camera as CameraIcon, Send, CheckCircle2, Clock,
  XCircle, Navigation, Copy, Sparkles, Truck, Package, Building2,
  User, LogOut, Download, CheckCheck, Phone, Scale, Anchor, History,
  Trash2, MapPin, MessageSquare, AlertTriangle, Receipt, Thermometer, Printer, ShieldCheck
} from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Tab1Props {
  currentDriver: string;
  onLogout: () => void;
}

const TRUCK_RATES: Record<string, number> = {
  '6-Wheeler Closed Van': 650,
  '10-Wheeler Wing Van': 1100,
  '40ft Container Trailer': 1850,
  'Reefer Cold-Chain Truck': 1550,
  'Heavy Tanker / Bulk Carrier': 2100
};

const Tab1: React.FC<Tab1Props> = ({ currentDriver, onLogout }) => {
  const [subTab, setSubTab] = useState<'book' | 'active' | 'vessels' | 'history'>('book');
  const [driverName, setDriverName] = useState(currentDriver || '');
  const [driverPhone, setDriverPhone] = useState('0917-555-0192');
  const [companyName, setCompanyName] = useState('');
  const [plateNumber, setPlateNumber] = useState('');
  const [truckType, setTruckType] = useState('10-Wheeler Wing Van');
  const [containerSeal, setContainerSeal] = useState(`SEAL-${Math.floor(10000 + Math.random() * 90000)}`);
  const [originPort, setOriginPort] = useState('Calapan Port, Oriental Mindoro');
  const [destinationPort, setDestinationPort] = useState('Batangas International Port');
  const [priorityLevel, setPriorityLevel] = useState('Standard');
  const [reeferTemp, setReeferTemp] = useState('-4');
  const [cargoCategory, setCargoCategory] = useState('RoRo Vehicle / Rolling Cargo');
  const [cargoWeight, setCargoWeight] = useState('8.5');
  const [vesselName, setVesselName] = useState('MV Starlite Calapan');
  const [cargoSummary, setCargoSummary] = useState('');
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const [loading, setLoading] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [myAppointments, setMyAppointments] = useState<any[]>([]);
  const [vessels, setVessels] = useState<any[]>([]);
  const [advisory, setAdvisory] = useState<any | null>(null);

  // Live PPA Tariff Calculation
  const baseTruckFee = TRUCK_RATES[truckType] || 1100;
  const weightTonsNum = parseFloat(cargoWeight) || 0;
  const wharfageFee = Math.round(weightTonsNum * 65);
  const specialSurcharge =
    priorityLevel === 'Hazmat' ? 750 :
    priorityLevel === 'Perishable' || priorityLevel === 'Express' ? 400 : 0;
  const computedTotalPhp = baseTruckFee + wharfageFee + specialSurcharge;

  const fetchAllData = async () => {
    let query = supabase.from('appointments').select('*').order('created_at', { ascending: false });
    if (currentDriver) {
      query = query.ilike('driver_name', `%${currentDriver}%`);
    }
    const { data: aptData } = await query;
    if (aptData) setMyAppointments(aptData);

    const { data: vData } = await supabase.from('vessel_schedules').select('*').order('created_at', { ascending: true });
    if (vData) setVessels(vData);

    const { data: advData } = await supabase
      .from('port_advisories')
      .select('*')
      .eq('active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    setAdvisory(advData || null);
  };

  useEffect(() => {
    fetchAllData();
    const channel = supabase
      .channel('driver-live-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, fetchAllData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vessel_schedules' }, fetchAllData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'port_advisories' }, fetchAllData)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentDriver]);

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

        const { data: publicUrlData } = supabase.storage.from('manifests').getPublicUrl(fileName);
        manifestUrl = publicUrlData.publicUrl;
      }

      const generatedOr = `OR-PPA-${Math.floor(100000 + Math.random() * 900000)}`;

      const { error } = await supabase.from('appointments').insert([
        {
          driver_name: driverName,
          driver_phone: driverPhone,
          company_name: companyName,
          plate_number: plateNumber.toUpperCase(),
          truck_type: truckType,
          container_seal: containerSeal.toUpperCase(),
          origin_port: originPort,
          destination_port: destinationPort,
          priority_level: priorityLevel,
          reefer_temp_c: cargoCategory.includes('Perishable') ? parseFloat(reeferTemp) : null,
          cargo_category: cargoCategory,
          cargo_weight_tons: weightTonsNum || 5.0,
          vessel_name: vesselName,
          cargo_summary: cargoSummary,
          manifest_photo_url: manifestUrl,
          port_fee_php: computedTotalPhp,
          payment_status: 'Paid (e-Wallet)',
          or_number: generatedOr,
          status: 'pending'
        }
      ]);

      if (error) throw error;

      setToastMsg(`Manifest & Tariff (${generatedOr}) transmitted! Switching to Active Passes...`);
      setCompanyName('');
      setPlateNumber('');
      setCargoSummary('');
      setContainerSeal(`SEAL-${Math.floor(10000 + Math.random() * 90000)}`);
      setPhotoPreview(null);
      setPhotoBlob(null);
      setSubTab('active');
    } catch (err: any) {
      setToastMsg(err.message || 'Submission failed.');
    } finally {
      setLoading(false);
    }
  };

  const cancelPendingBooking = async (id: string) => {
    await supabase.from('appointments').delete().eq('id', id);
    setToastMsg('Pending appointment cancelled.');
    fetchAllData();
  };

  const copyPassId = (id: string) => {
    navigator.clipboard.writeText(id);
    setToastMsg('Pass ID copied to clipboard!');
  };

  const downloadQrTicket = (id: string, plate: string) => {
    const canvas = document.getElementById(`qr-${id}`) as HTMLCanvasElement;
    if (!canvas) return;
    const pngUrl = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.href = pngUrl;
    link.download = `PortPass-${plate}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setToastMsg(`Saved PortPass-${plate}.png for offline gate access!`);
  };

  const printOfficialPermit = (apt: any) => {
    const win = window.open('', '_blank', 'width=720,height=800');
    if (!win) return;
    win.document.write(`
      <html>
        <head>
          <title>PPA Gate Permit - ${apt.plate_number}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 32px; color: #0f172a; }
            .box { border: 2px solid #0f172a; padding: 24px; border-radius: 12px; }
            h1 { margin: 0 0 6px; font-size: 22px; }
            .sub { color: #475569; font-size: 12px; font-weight: bold; letter-spacing: 1px; margin-bottom: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 16px; }
            td, th { border: 1px solid #cbd5e1; padding: 10px; font-size: 13px; text-align: left; }
            .footer { margin-top: 24px; font-size: 11px; color: #64748b; text-align: center; }
          </style>
        </head>
        <body>
          <div class="box">
            <div class="sub">REPUBLIC OF THE PHILIPPINES • PHILIPPINE PORTS AUTHORITY</div>
            <h1>OFFICIAL DIGITAL FREIGHT GATE PASS & TARIFF RECEIPT</h1>
            <p><strong>Pass UUID:</strong> ${apt.id} &nbsp;|&nbsp; <strong>OR Number:</strong> ${apt.or_number || 'OR-PPA-99201'}</p>
            <table>
              <tr><th>Vehicle Plate</th><td><strong>${apt.plate_number}</strong> (${apt.truck_type || '10-Wheeler'})</td><th>Clearance Status</th><td>${apt.status.toUpperCase()}</td></tr>
              <tr><th>Driver Name</th><td>${apt.driver_name} (${apt.driver_phone || 'N/A'})</td><th>Shipping Company</th><td>${apt.company_name}</td></tr>
              <tr><th>Assigned Vessel</th><td>${apt.vessel_name || 'MV Starlite'}</td><th>Assigned Berth</th><td>${apt.assigned_berth || 'Pier 1'}</td></tr>
              <tr><th>Route</th><td>${apt.origin_port || 'Calapan'} ➔ ${apt.destination_port || 'Batangas'}</td><th>Container Seal</th><td>${apt.container_seal || 'N/A'}</td></tr>
              <tr><th>Cargo Classification</th><td>${apt.cargo_category} (${apt.cargo_weight_tons} Tons)</td><th>PPA Tariff Paid</th><td><strong>PHP ${Number(apt.port_fee_php || 1450).toLocaleString()}</strong> (${apt.payment_status || 'Paid'})</td></tr>
              <tr><th>Manifest Summary</th><td colspan="3">${apt.cargo_summary}</td></tr>
            </table>
            <div class="footer">Generated via PortPass OS • Present this permit or QR code at the PPA Terminal Security Gate</div>
          </div>
          <script>window.print();</script>
        </body>
      </html>
    `);
    win.document.close();
  };

  const activePasses = myAppointments.filter(a => a.status === 'pending' || a.status === 'approved' || a.status === 'inside');
  const pastHistory = myAppointments.filter(a => a.status === 'completed' || a.status === 'rejected');
  const totalTonnage = myAppointments
    .filter(a => a.status === 'completed' || a.status === 'inside')
    .reduce((sum, a) => sum + (Number(a.cargo_weight_tons) || 0), 0);

  const renderStatusPill = (status: string) => {
    switch (status) {
      case 'approved':
        return <span className="status-pill status-approved"><CheckCircle2 size={13} /> Cleared • Show QR</span>;
      case 'inside':
        return <span className="status-pill status-inside"><Navigation size={13} /> Docked Inside</span>;
      case 'completed':
        return <span className="status-pill status-completed"><CheckCheck size={13} /> Trip Completed</span>;
      case 'rejected':
        return <span className="status-pill status-rejected"><XCircle size={13} /> Rejected</span>;
      default:
        return <span className="status-pill status-pending"><Clock size={13} /> Awaiting Review</span>;
    }
  };

  const render5StageStepper = (status: string) => {
    const stageMap: Record<string, number> = { pending: 2, approved: 3, inside: 4, completed: 5, rejected: 1 };
    const currentStep = stageMap[status] || 2;
    const labels = ['Filed', 'Tariff Paid', 'QR Issued', 'In Dock', 'Departed'];
    return (
      <div className="stepper-row">
        {labels.map((label, index) => {
          const stepNum = index + 1;
          const cls = stepNum < currentStep ? 'done' : stepNum === currentStep ? 'current' : '';
          return (
            <div key={label} className={`step-node ${cls}`}>
              <div className="step-dot">{stepNum < currentStep ? '✓' : stepNum}</div>
              <span>{label}</span>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <IonPage>
      <IonContent fullscreen>
        <div className="port-container">
          {/* Sleek Hero Header */}
          <div className="animate-enter" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#38bdf8', fontSize: '11px', fontWeight: 700, letterSpacing: '1px' }}>
                <Ship size={14} /> OPERATOR: {currentDriver.toUpperCase()}
              </div>
              <h1 style={{ margin: '4px 0 0', fontSize: '25px', fontWeight: 800 }}>
                PortPass <span style={{ color: '#38bdf8' }}>Driver Hub</span>
              </h1>
            </div>
            <button className="role-logout-btn" onClick={onLogout}>
              <LogOut size={13} /> Switch Role
            </button>
          </div>

          {/* Live Terminal Broadcast Advisory Banner */}
          {advisory && (
            <div className={`advisory-banner advisory-${advisory.severity || 'info'}`}>
              <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <div style={{ fontWeight: 800, letterSpacing: '0.6px', textTransform: 'uppercase', fontSize: '11px' }}>
                  {advisory.title}
                </div>
                <div style={{ marginTop: '2px' }}>{advisory.message}</div>
              </div>
            </div>
          )}

          {/* Driver Personal Telemetry Summary */}
          <div className="animate-enter" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '18px' }}>
            <div className="glass-card" style={{ padding: '12px', marginBottom: 0, textAlign: 'center' }}>
              <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 700 }}>ACTIVE PASSES</div>
              <div style={{ fontSize: '22px', fontWeight: 800, color: '#38bdf8', marginTop: '2px' }}>{activePasses.length}</div>
            </div>
            <div className="glass-card" style={{ padding: '12px', marginBottom: 0, textAlign: 'center' }}>
              <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 700 }}>COMPLETED TRIPS</div>
              <div style={{ fontSize: '22px', fontWeight: 800, color: '#34d399', marginTop: '2px' }}>
                {myAppointments.filter(a => a.status === 'completed').length}
              </div>
            </div>
            <div className="glass-card" style={{ padding: '12px', marginBottom: 0, textAlign: 'center' }}>
              <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 700 }}>HAULED TONNAGE</div>
              <div style={{ fontSize: '22px', fontWeight: 800, color: '#c084fc', marginTop: '2px' }}>{totalTonnage.toFixed(1)}t</div>
            </div>
          </div>

          {/* 4-View Sub-Navigation */}
          <div className="sub-nav-bar animate-enter">
            <button className={`sub-nav-btn ${subTab === 'book' ? 'active' : ''}`} onClick={() => setSubTab('book')}>
              <Sparkles size={14} /> New Booking
            </button>
            <button className={`sub-nav-btn ${subTab === 'active' ? 'active' : ''}`} onClick={() => setSubTab('active')}>
              <Navigation size={14} /> Active ({activePasses.length})
            </button>
            <button className={`sub-nav-btn ${subTab === 'vessels' ? 'active' : ''}`} onClick={() => setSubTab('vessels')}>
              <Ship size={14} /> Vessel Board
            </button>
            <button className={`sub-nav-btn ${subTab === 'history' ? 'active' : ''}`} onClick={() => setSubTab('history')}>
              <History size={14} /> History ({pastHistory.length})
            </button>
          </div>

          {/* VIEW 1: NEW FREIGHT BOOKING FORM */}
          {subTab === 'book' && (
            <div className="glass-card animate-enter">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                <div style={{ background: 'rgba(14, 165, 233, 0.15)', padding: '10px', borderRadius: '12px', color: '#38bdf8' }}>
                  <Anchor size={20} />
                </div>
                <div>
                  <h2 style={{ margin: 0, fontSize: '17px', fontWeight: 700 }}>Register Maritime Freight Manifest</h2>
                  <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#94a3b8' }}>Complete vessel, seal, axle configuration, and tariff assessment</p>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '12px' }}>
                <div className="modern-field">
                  <label><User size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} /> Driver Name</label>
                  <input className="modern-input" value={driverName} onChange={e => setDriverName(e.target.value)} placeholder="Aaron Mendoza" />
                </div>
                <div className="modern-field">
                  <label><Phone size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} /> Contact Mobile</label>
                  <input className="modern-input" value={driverPhone} onChange={e => setDriverPhone(e.target.value)} placeholder="0917-XXX-XXXX" />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '12px' }}>
                <div className="modern-field">
                  <label><Building2 size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} /> Logistics Company</label>
                  <input className="modern-input" value={companyName} onChange={e => setCompanyName(e.target.value)} placeholder="Mindoro Freight Corp" />
                </div>
                <div className="modern-field">
                  <label><Truck size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} /> Plate Number</label>
                  <input className="modern-input" style={{ fontFamily: 'JetBrains Mono, monospace', textTransform: 'uppercase' }} value={plateNumber} onChange={e => setPlateNumber(e.target.value)} placeholder="NBI-4021" />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '12px' }}>
                <div className="modern-field">
                  <label>Truck Axle / Body Configuration</label>
                  <select className="modern-input" value={truckType} onChange={e => setTruckType(e.target.value)}>
                    {Object.keys(TRUCK_RATES).map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="modern-field">
                  <label><ShieldCheck size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} /> Container Seal #</label>
                  <input className="modern-input" style={{ fontFamily: 'JetBrains Mono, monospace' }} value={containerSeal} onChange={e => setContainerSeal(e.target.value)} />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div className="modern-field">
                  <label>Origin Terminal</label>
                  <select className="modern-input" value={originPort} onChange={e => setOriginPort(e.target.value)}>
                    <option value="Calapan Port, Oriental Mindoro">Calapan Port, Mindoro</option>
                    <option value="Pinamalayan Maritime Terminal">Pinamalayan Port, Mindoro</option>
                    <option value="Roxas Dangay Port, Mindoro">Roxas Dangay Port</option>
                  </select>
                </div>
                <div className="modern-field">
                  <label>Destination Port</label>
                  <select className="modern-input" value={destinationPort} onChange={e => setDestinationPort(e.target.value)}>
                    <option value="Batangas International Port">Batangas International Port</option>
                    <option value="Manila North Harbor Pier 4">Manila North Harbor</option>
                    <option value="Caticlan / Odiongan Pier">Caticlan / Odiongan Pier</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 0.8fr 0.9fr', gap: '10px' }}>
                <div className="modern-field">
                  <label><Package size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} /> Cargo Class</label>
                  <select className="modern-input" value={cargoCategory} onChange={e => setCargoCategory(e.target.value)}>
                    <option value="RoRo Vehicle / Rolling Cargo">RoRo Rolling Cargo</option>
                    <option value="Agricultural / Perishable Goods">Perishable / Cold Chain</option>
                    <option value="Containerized Commercial Freight">Containerized Freight</option>
                    <option value="Construction & Heavy Equipment">Construction & Heavy</option>
                    <option value="Hazardous / Fuel Tanker">Hazardous / Fuel</option>
                  </select>
                </div>
                <div className="modern-field">
                  <label><Scale size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} /> Weight (t)</label>
                  <input type="number" step="0.5" className="modern-input" value={cargoWeight} onChange={e => setCargoWeight(e.target.value)} />
                </div>
                <div className="modern-field">
                  <label>Priority Lane</label>
                  <select className="modern-input" value={priorityLevel} onChange={e => setPriorityLevel(e.target.value)}>
                    <option value="Standard">Standard</option>
                    <option value="Perishable">Perishable Express</option>
                    <option value="Express">VIP Express</option>
                    <option value="Hazmat">Hazmat Escort</option>
                  </select>
                </div>
              </div>

              {cargoCategory.includes('Perishable') && (
                <div className="modern-field">
                  <label><Thermometer size={12} style={{ marginRight: '4px', verticalAlign: 'middle', color: '#38bdf8' }} /> Reefer Container Target Temperature (°C)</label>
                  <input type="number" className="modern-input" value={reeferTemp} onChange={e => setReeferTemp(e.target.value)} placeholder="-4 °C" />
                </div>
              )}

              <div className="modern-field">
                <label><Ship size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} /> Assigned RoRo Vessel / Ship</label>
                <select className="modern-input" value={vesselName} onChange={e => setVesselName(e.target.value)}>
                  {vessels.length > 0 ? (
                    vessels.map(v => <option key={v.id} value={v.vessel_name}>{v.vessel_name} ({v.etd} • {v.status})</option>)
                  ) : (
                    <>
                      <option value="MV Starlite Calapan">MV Starlite Calapan (14:30 HRS)</option>
                      <option value="MV FastCat M14">MV FastCat M14 (16:00 HRS)</option>
                    </>
                  )}
                </select>
              </div>

              <div className="modern-field">
                <label>Detailed Bill of Lading / Itemized Manifest</label>
                <textarea className="modern-input" rows={2} value={cargoSummary} onChange={e => setCargoSummary(e.target.value)} placeholder="e.g. 200 Crates of Mindoro Calamansi & Rice • Sealed Container" />
              </div>

              {/* Automated PPA Port Tariff Assessment Box */}
              <div className="tariff-box">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '11px', fontWeight: 800, color: '#38bdf8', letterSpacing: '0.8px' }}>
                    <Receipt size={13} style={{ verticalAlign: 'middle', marginRight: '5px' }} />
                    PPA AUTOMATED TARIFF & WHARFAGE ASSESSMENT
                  </span>
                  <span className="status-pill status-approved" style={{ fontSize: '10px', padding: '3px 8px' }}>e-Wallet Auto-Debit</span>
                </div>
                <div style={{ fontSize: '12px', color: '#94a3b8', display: 'grid', gap: '4px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Terminal Vehicle Fee ({truckType}):</span>
                    <strong style={{ color: '#e2e8f0' }}>₱{baseTruckFee.toLocaleString()}.00</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Wharfage & Arrastre ({weightTonsNum}t × ₱65/t):</span>
                    <strong style={{ color: '#e2e8f0' }}>₱{wharfageFee.toLocaleString()}.00</strong>
                  </div>
                  {specialSurcharge > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#fbbf24' }}>
                      <span>Priority / Special Handling Surcharge ({priorityLevel}):</span>
                      <strong>₱{specialSurcharge.toLocaleString()}.00</strong>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '6px', marginTop: '4px', fontSize: '15px', fontWeight: 800, color: '#34d399' }}>
                    <span>Total Assessed Port Fee:</span>
                    <span>₱{computedTotalPhp.toLocaleString()}.00 PHP</span>
                  </div>
                </div>
              </div>

              <div style={{ marginBottom: '18px' }}>
                <button type="button" className="btn-outline-glass" onClick={takePhoto}>
                  <CameraIcon size={17} />
                  {photoPreview ? 'Replace Cargo Manifest Photo' : 'Attach Official Bill of Lading / Receipt Photo'}
                </button>

                {photoPreview && (
                  <div style={{ marginTop: '12px', borderRadius: '14px', overflow: 'hidden', border: '1px solid rgba(56, 189, 248, 0.3)' }}>
                    <img src={photoPreview} alt="Manifest Preview" style={{ width: '100%', maxHeight: '190px', objectFit: 'cover', display: 'block' }} />
                  </div>
                )}
              </div>

              <button type="button" className="btn-glow" onClick={handleSubmit} disabled={loading}>
                {loading ? <IonSpinner name="crescent" /> : <><Send size={17} /> Pay ₱{computedTotalPhp.toLocaleString()} & Transmit Request</>}
              </button>
            </div>
          )}

          {/* VIEW 2: LIVE RORO VESSEL SCHEDULE BOARD */}
          {subTab === 'vessels' && (
            <div className="animate-enter">
              {vessels.map((v, i) => {
                const bookedCount = myAppointments.filter(a => a.vessel_name === v.vessel_name).length;
                return (
                  <div key={v.id || i} className="glass-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <span style={{ fontSize: '11px', color: '#38bdf8', fontWeight: 700 }}>{v.route}</span>
                        <h3 style={{ margin: '4px 0', fontSize: '20px', fontWeight: 800 }}>{v.vessel_name}</h3>
                      </div>
                      <span className={`status-pill ${v.status.includes('Delayed') ? 'status-rejected' : v.status.includes('Boarding') ? 'status-approved' : 'status-inside'}`}>
                        {v.status}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '10px' }}>
                      <span className="meta-tag"><Clock size={12} color="#fbbf24" /> ETD: {v.etd}</span>
                      <span className="meta-tag"><MapPin size={12} color="#38bdf8" /> {v.berth}</span>
                      <span className="meta-tag"><Truck size={12} color="#34d399" /> Deck Capacity: {v.max_trucks} Trucks</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* VIEW 3 & 4: ACTIVE PASSES OR PAST TRANSACTION HISTORY */}
          {(subTab === 'active' || subTab === 'history') && (
            <>
              {(subTab === 'active' ? activePasses : pastHistory).length === 0 ? (
                <div className="glass-card animate-enter" style={{ textAlign: 'center', padding: '40px 20px', color: '#64748b' }}>
                  <Ship size={40} style={{ opacity: 0.4, marginBottom: '10px' }} />
                  <div style={{ fontWeight: 700, fontSize: '15px', color: '#94a3b8' }}>
                    {subTab === 'active' ? 'No Active Gate Passes' : 'No Past Trip Transactions Yet'}
                  </div>
                </div>
              ) : (
                (subTab === 'active' ? activePasses : pastHistory).map((apt, idx) => (
                  <div key={apt.id} className="glass-card animate-enter" style={{ animationDelay: `${idx * 0.05}s` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '11px', fontWeight: 700, color: '#38bdf8', textTransform: 'uppercase' }}>
                            {apt.company_name}
                          </span>
                          <span className={`priority-badge priority-${apt.priority_level || 'Standard'}`}>
                            {apt.priority_level || 'Standard'}
                          </span>
                        </div>
                        <h3 style={{ margin: '4px 0 0', fontSize: '22px', fontWeight: 800, fontFamily: 'JetBrains Mono, monospace' }}>
                          {apt.plate_number}
                        </h3>
                      </div>
                      {renderStatusPill(apt.status)}
                    </div>

                    {/* 5-Stage Shipment Progress Bar */}
                    {render5StageStepper(apt.status)}

                    {/* Rich Maritime Tags */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
                      <span className="meta-tag"><Ship size={12} color="#38bdf8" /> {apt.vessel_name || 'MV Starlite'}</span>
                      <span className="meta-tag"><Scale size={12} color="#fbbf24" /> {apt.cargo_weight_tons || 5}t {apt.actual_weighbridge_tons ? `(Scale: ${apt.actual_weighbridge_tons}t)` : ''}</span>
                      <span className="meta-tag"><Receipt size={12} color="#34d399" /> ₱{Number(apt.port_fee_php || 1450).toLocaleString()} • {apt.or_number || 'PAID'}</span>
                      {apt.container_seal && <span className="meta-tag"><ShieldCheck size={12} color="#c084fc" /> {apt.container_seal}</span>}
                      {apt.assigned_berth && (
                        <span className="meta-tag" style={{ borderColor: 'rgba(56,189,248,0.4)', color: '#38bdf8' }}>
                          <MapPin size={12} /> {apt.assigned_berth}
                        </span>
                      )}
                    </div>

                    <div style={{ fontSize: '13px', color: '#cbd5e1', display: 'grid', gap: '4px', background: 'rgba(6, 11, 20, 0.5)', padding: '12px', borderRadius: '12px' }}>
                      <div><strong style={{ color: '#64748b' }}>Route:</strong> {apt.origin_port || 'Calapan'} ➔ {apt.destination_port || 'Batangas'}</div>
                      <div><strong style={{ color: '#64748b' }}>Manifest:</strong> {apt.cargo_summary}</div>
                      {apt.admin_notes && (
                        <div style={{ marginTop: '6px', padding: '8px', background: 'rgba(56, 189, 248, 0.1)', borderRadius: '8px', color: '#bae6fd', fontSize: '12px' }}>
                          <MessageSquare size={12} style={{ verticalAlign: 'middle', marginRight: '5px' }} />
                          <strong>Port Authority Remark:</strong> {apt.admin_notes}
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                      <button
                        onClick={() => printOfficialPermit(apt)}
                        style={{ flex: 1, background: 'rgba(56, 189, 248, 0.1)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.35)', borderRadius: '11px', padding: '9px', fontSize: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', cursor: 'pointer' }}
                      >
                        <Printer size={14} /> Print Official Permit & OR
                      </button>

                      {apt.status === 'pending' && (
                        <button
                          onClick={() => cancelPendingBooking(apt.id)}
                          style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '11px', padding: '9px 14px', fontSize: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}
                        >
                          <Trash2 size={14} /> Cancel
                        </button>
                      )}
                    </div>

                    {(apt.status === 'approved' || apt.status === 'inside') && (
                      <div className="qr-boarding-pass">
                        <div style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '1.5px', color: '#0ea5e9', marginBottom: '4px' }}>
                          {apt.status === 'inside' ? 'SCAN AT EXIT GATE UPON DEPARTURE' : 'PPA AUTHORIZED E-GATE PASS'}
                        </div>
                        <div style={{ fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '10px' }}>
                          Proceed to: {apt.assigned_berth || 'Pier 1 • RoRo Ramp A'}
                        </div>

                        <QRCodeCanvas id={`qr-${apt.id}`} value={apt.id} size={175} includeMargin={true} style={{ margin: '0 auto', borderRadius: '8px' }} />

                        <div style={{ marginTop: '12px', padding: '8px 12px', background: '#e2e8f0', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                          <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '11px', fontWeight: 700, color: '#334155', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {apt.id}
                          </span>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button
                              onClick={() => copyPassId(apt.id)}
                              style={{ background: '#334155', color: '#fff', border: 'none', borderRadius: '7px', padding: '6px 10px', fontSize: '11px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}
                            >
                              <Copy size={12} /> Copy
                            </button>
                            <button
                              onClick={() => downloadQrTicket(apt.id, apt.plate_number)}
                              style={{ background: '#0ea5e9', color: '#fff', border: 'none', borderRadius: '7px', padding: '6px 10px', fontSize: '11px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}
                            >
                              <Download size={12} /> Save PNG
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </>
          )}
        </div>

        <IonToast isOpen={!!toastMsg} message={toastMsg} duration={2800} position="top" onDidDismiss={() => setToastMsg('')} />
      </IonContent>
    </IonPage>
  );
};

export default Tab1;