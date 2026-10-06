import React, { useState, useEffect } from 'react';
import { IonContent, IonPage, IonToast } from '@ionic/react';
import {
  Check, X, Clock, Truck, Activity, Search, LogOut, Eye,
  Users, Anchor, FileSpreadsheet, Ship, Scale, Phone, MapPin,
  Download, Megaphone, Database, Receipt, ShieldCheck
} from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Tab2Props {
  onLogout: () => void;
}

const BERTH_OPTIONS = [
  'Pier 1 • RoRo Ramp A',
  'Pier 2 • Bulk Freight Dock',
  'Pier 3 • Cold Chain & Perishables',
  'South Wharf • Heavy Container Bay'
];

const Tab2: React.FC<Tab2Props> = ({ onLogout }) => {
  const [appointments, setAppointments] = useState<any[]>([]);
  const [vessels, setVessels] = useState<any[]>([]);
  const [activeModule, setActiveModule] = useState<'queue' | 'vessels' | 'drivers' | 'berths' | 'broadcast' | 'ledger'>('queue');
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'inside' | 'completed'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [berthSelections, setBerthSelections] = useState<Record<string, string>>({});
  const [noteInputs, setNoteInputs] = useState<Record<string, string>>({});
  const [advTitle, setAdvTitle] = useState('PPA TERMINAL OPERATIONS BULLETIN');
  const [advMessage, setAdvMessage] = useState('');
  const [advSeverity, setAdvSeverity] = useState('info');
  const [toastMsg, setToastMsg] = useState('');

  const loadAll = async () => {
    const { data } = await supabase.from('appointments').select('*').order('created_at', { ascending: false });
    if (data) setAppointments(data);

    const { data: vData } = await supabase.from('vessel_schedules').select('*').order('created_at', { ascending: true });
    if (vData) setVessels(vData);
  };

  useEffect(() => {
    loadAll();
    const channel = supabase
      .channel('admin-dashboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, loadAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vessel_schedules' }, loadAll)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleDecision = async (id: string, newStatus: string) => {
    const chosenBerth = berthSelections[id] || 'Pier 1 • RoRo Ramp A';
    const adminNote = noteInputs[id] || (newStatus === 'approved' ? 'Tariff & Manifest verified. Proceed to assigned berth.' : 'Manifest documentation incomplete.');

    await supabase
      .from('appointments')
      .update({
        status: newStatus,
        assigned_berth: chosenBerth,
        admin_notes: adminNote
      })
      .eq('id', id);

    setToastMsg(`Vehicle clearance updated to ${newStatus.toUpperCase()} (${chosenBerth})`);
  };

  const updateVesselStatus = async (id: string, status: string) => {
    await supabase.from('vessel_schedules').update({ status }).eq('id', id);
    setToastMsg(`Updated vessel status to: ${status}`);
    loadAll();
  };

  const publishAdvisory = async () => {
    if (!advMessage.trim()) {
      setToastMsg('Please enter an advisory message to broadcast.');
      return;
    }
    await supabase.from('port_advisories').update({ active: false }).eq('active', true);
    await supabase.from('port_advisories').insert([
      { title: advTitle, message: advMessage, severity: advSeverity, active: true }
    ]);
    setAdvMessage('');
    setToastMsg('Live Terminal Advisory broadcasted to all Driver & Guard devices!');
  };

  // 1-Click Demo Data Seeder for Presentation
  const seedDemoTraffic = async () => {
    const demoRows = [
      {
        driver_name: 'Aaron Mendoza',
        driver_phone: '0917-882-1044',
        company_name: 'Mindoro Island Agro-Freight',
        plate_number: 'NDA-8841',
        truck_type: 'Reefer Cold-Chain Truck',
        container_seal: 'SEAL-90214',
        origin_port: 'Calapan Port, Oriental Mindoro',
        destination_port: 'Batangas International Port',
        priority_level: 'Perishable',
        reefer_temp_c: -2,
        cargo_category: 'Agricultural / Perishable Goods',
        cargo_weight_tons: 12.5,
        vessel_name: 'MV Starlite Calapan',
        assigned_berth: 'Pier 3 • Cold Chain & Perishables',
        cargo_summary: '320 Crates of Export-Grade Mindoro Calamansi & Frozen Tuna',
        port_fee_php: 2762,
        payment_status: 'Paid (e-Wallet)',
        or_number: 'OR-PPA-774120',
        status: 'pending'
      },
      {
        driver_name: 'Mateo Robles',
        driver_phone: '0918-334-9910',
        company_name: 'Southern Luzon Heavy Logistics',
        plate_number: 'CBF-3092',
        truck_type: '40ft Container Trailer',
        container_seal: 'SEAL-44109',
        origin_port: 'Pinamalayan Maritime Terminal',
        destination_port: 'Batangas International Port',
        priority_level: 'Express',
        cargo_category: 'Containerized Commercial Freight',
        cargo_weight_tons: 22.0,
        vessel_name: 'MV FastCat M14',
        assigned_berth: 'Pier 1 • RoRo Ramp A',
        cargo_summary: 'Sealed 40ft High-Cube Container • Solar Inverter Equipment',
        port_fee_php: 3680,
        payment_status: 'Paid (Corporate Account)',
        or_number: 'OR-PPA-774121',
        status: 'approved'
      },
      {
        driver_name: 'carlo evangelista',
        driver_phone: '0920-119-4821',
        company_name: 'Halcon Builders Supply',
        plate_number: ' NBO-5519',
        truck_type: '10-Wheeler Wing Van',
        container_seal: 'SEAL-71820',
        origin_port: 'Calapan Port, Oriental Mindoro',
        destination_port: 'Batangas International Port',
        priority_level: 'Standard',
        cargo_category: 'Construction & Heavy Equipment',
        cargo_weight_tons: 16.0,
        vessel_name: 'MV Montenegro Santa Clara',
        assigned_berth: 'Pier 2 • Bulk Freight Dock',
        cargo_summary: '400 Bags of Portland Cement & Structural Steel Rebars',
        port_fee_php: 2140,
        payment_status: 'Paid (e-Wallet)',
        or_number: 'OR-PPA-774122',
        actual_weighbridge_tons: 16.2,
        safety_verified: true,
        entry_time: new Date(Date.now() - 42 * 60000).toISOString(),
        status: 'inside'
      }
    ];

    await supabase.from('appointments').insert(demoRows);
    setToastMsg('Injected 3 realistic Mindoro port freight records!');
    loadAll();
  };

  const exportCsvReport = () => {
    const headers = ['Pass_ID', 'OR_Number', 'Plate_Number', 'Truck_Type', 'Seal', 'Driver_Name', 'Company', 'Vessel', 'Priority', 'Declared_Tons', 'Weighbridge_Tons', 'Fee_PHP', 'Berth', 'Status', 'Entry_Time', 'Exit_Time'];
    const rows = appointments.map(a => [
      a.id,
      a.or_number || 'OR-PPA',
      a.plate_number,
      `"${a.truck_type || '10-Wheeler'}"`,
      a.container_seal || 'N/A',
      `"${a.driver_name}"`,
      `"${a.company_name}"`,
      `"${a.vessel_name || 'MV Starlite'}"`,
      a.priority_level || 'Standard',
      a.cargo_weight_tons || 5,
      a.actual_weighbridge_tons || '',
      a.port_fee_php || 1450,
      `"${a.assigned_berth || 'Pier 1'}"`,
      a.status,
      a.entry_time ? new Date(a.entry_time).toISOString() : '',
      a.exit_time ? new Date(a.exit_time).toISOString() : ''
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `PPA_PortPass_MasterLedger_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setToastMsg('Exported master CSV financial & gate ledger!');
  };

  const pendingCount = appointments.filter(a => a.status === 'pending').length;
  const approvedCount = appointments.filter(a => a.status === 'approved').length;
  const insideCount = appointments.filter(a => a.status === 'inside').length;
  const completedCount = appointments.filter(a => a.status === 'completed').length;
  const totalTonnage = appointments.reduce((sum, a) => sum + (Number(a.cargo_weight_tons) || 0), 0);
  const totalRevenuePhp = appointments
    .filter(a => a.status !== 'rejected')
    .reduce((sum, a) => sum + (Number(a.port_fee_php) || 1450), 0);

  const driverDirectory = Object.values(
    appointments.reduce((acc: Record<string, any>, apt) => {
      const key = apt.driver_name.trim().toLowerCase();
      if (!acc[key]) {
        acc[key] = {
          name: apt.driver_name,
          phone: apt.driver_phone || '0917-555-0192',
          company: apt.company_name,
          plates: new Set([apt.plate_number]),
          totalTrips: 0,
          completedTrips: 0,
          totalTons: 0,
          totalFees: 0
        };
      }
      acc[key].plates.add(apt.plate_number);
      acc[key].totalTrips += 1;
      if (apt.status === 'completed') acc[key].completedTrips += 1;
      acc[key].totalTons += Number(apt.cargo_weight_tons) || 0;
      acc[key].totalFees += Number(apt.port_fee_php) || 1450;
      return acc;
    }, {})
  );

  const filteredList = appointments.filter(a => {
    const matchesTab = filter === 'all' || a.status === filter;
    const matchesSearch =
      a.plate_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.driver_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.company_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (a.container_seal || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (a.vessel_name || '').toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTab && matchesSearch;
  });

  return (
    <IonPage>
      <IonContent fullscreen>
        <div className="admin-wide-container">
          {/* Widescreen Command Header */}
          <div className="animate-enter" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '22px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#34d399', fontSize: '12px', fontWeight: 700, letterSpacing: '1px' }}>
                <Activity size={15} /> PPA TERMINAL OPERATIONS CENTER • ENTERPRISE CONSOLE
              </div>
              <h1 style={{ margin: '4px 0 0', fontSize: '28px', fontWeight: 800 }}>
                PortPass <span style={{ color: '#38bdf8' }}>Admin Command</span>
              </h1>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              <button
                onClick={seedDemoTraffic}
                style={{ background: 'rgba(56, 189, 248, 0.14)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.35)', borderRadius: '999px', padding: '8px 14px', fontSize: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
              >
                <Database size={14} /> Seed Sample Port Traffic
              </button>
              <button
                onClick={exportCsvReport}
                style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.4)', borderRadius: '999px', padding: '8px 14px', fontSize: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
              >
                <Download size={14} /> Export CSV Ledger
              </button>
              <button className="role-logout-btn" onClick={onLogout}>
                <LogOut size={14} /> Exit Admin
              </button>
            </div>
          </div>

          {/* 6-Column KPI Bento Grid (Including PPA Tariff Revenue) */}
          <div className="animate-enter" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(145px, 1fr))', gap: '12px', marginBottom: '22px' }}>
            <div className="glass-card" style={{ padding: '15px', marginBottom: 0, borderLeft: '4px solid #f59e0b' }}>
              <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 700 }}>PENDING QUEUE</div>
              <div style={{ fontSize: '26px', fontWeight: 800, color: '#fbbf24', marginTop: '4px' }}>{pendingCount}</div>
            </div>
            <div className="glass-card" style={{ padding: '15px', marginBottom: 0, borderLeft: '4px solid #10b981' }}>
              <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 700 }}>CLEARED PASSES</div>
              <div style={{ fontSize: '26px', fontWeight: 800, color: '#34d399', marginTop: '4px' }}>{approvedCount}</div>
            </div>
            <div className="glass-card" style={{ padding: '15px', marginBottom: 0, borderLeft: '4px solid #0ea5e9' }}>
              <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 700 }}>DOCKED IN PORT</div>
              <div style={{ fontSize: '26px', fontWeight: 800, color: '#38bdf8', marginTop: '4px' }}>{insideCount}</div>
            </div>
            <div className="glass-card" style={{ padding: '15px', marginBottom: 0, borderLeft: '4px solid #a855f7' }}>
              <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 700 }}>DEPARTED TRIPS</div>
              <div style={{ fontSize: '26px', fontWeight: 800, color: '#c084fc', marginTop: '4px' }}>{completedCount}</div>
            </div>
            <div className="glass-card" style={{ padding: '15px', marginBottom: 0, borderLeft: '4px solid #ec4899' }}>
              <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 700 }}>CARGO TONNAGE</div>
              <div style={{ fontSize: '26px', fontWeight: 800, color: '#f472b6', marginTop: '4px' }}>{totalTonnage.toFixed(1)}t</div>
            </div>
            <div className="glass-card" style={{ padding: '15px', marginBottom: 0, borderLeft: '4px solid #22c55e' }}>
              <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 700 }}>PPA TARIFF REVENUE</div>
              <div style={{ fontSize: '22px', fontWeight: 800, color: '#4ade80', marginTop: '6px' }}>₱{totalRevenuePhp.toLocaleString()}</div>
            </div>
          </div>

          {/* 6-Module Enterprise Navigation Bar */}
          <div className="sub-nav-bar animate-enter">
            <button className={`sub-nav-btn ${activeModule === 'queue' ? 'active' : ''}`} onClick={() => setActiveModule('queue')}>
              <Truck size={14} /> Clearance Queue ({appointments.length})
            </button>
            <button className={`sub-nav-btn ${activeModule === 'vessels' ? 'active' : ''}`} onClick={() => setActiveModule('vessels')}>
              <Ship size={14} /> RoRo Vessel Control
            </button>
            <button className={`sub-nav-btn ${activeModule === 'berths' ? 'active' : ''}`} onClick={() => setActiveModule('berths')}>
              <Anchor size={14} /> Berth Telemetry
            </button>
            <button className={`sub-nav-btn ${activeModule === 'drivers' ? 'active' : ''}`} onClick={() => setActiveModule('drivers')}>
              <Users size={14} /> Fleet Directory ({driverDirectory.length})
            </button>
            <button className={`sub-nav-btn ${activeModule === 'broadcast' ? 'active' : ''}`} onClick={() => setActiveModule('broadcast')}>
              <Megaphone size={14} /> Port Advisories
            </button>
            <button className={`sub-nav-btn ${activeModule === 'ledger' ? 'active' : ''}`} onClick={() => setActiveModule('ledger')}>
              <FileSpreadsheet size={14} /> Master Audit Ledger
            </button>
          </div>

          {/* MODULE 1: CLEARANCE QUEUE */}
          {activeModule === 'queue' && (
            <>
              <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '14px', marginBottom: '20px' }}>
                <div style={{ display: 'flex', gap: '8px', overflowX: 'auto' }}>
                  {(['all', 'pending', 'approved', 'inside', 'completed'] as const).map(tab => (
                    <button
                      key={tab}
                      onClick={() => setFilter(tab)}
                      style={{
                        background: filter === tab ? '#0ea5e9' : 'rgba(15, 23, 42, 0.75)',
                        color: filter === tab ? '#fff' : '#94a3b8',
                        border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: '999px',
                        padding: '8px 15px',
                        fontSize: '12px',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        cursor: 'pointer'
                      }}
                    >
                      {tab}
                    </button>
                  ))}
                </div>

                <div style={{ position: 'relative', minWidth: '260px', flex: '1', maxWidth: '380px' }}>
                  <Search size={16} color="#64748b" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
                  <input
                    className="modern-input"
                    style={{ paddingLeft: '38px', paddingTop: '10px', paddingBottom: '10px' }}
                    placeholder="Search plate, seal #, driver, vessel..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>

              <div className="admin-cards-grid">
                {filteredList.map((apt, idx) => (
                  <div key={apt.id} className="glass-card animate-enter" style={{ marginBottom: 0, animationDelay: `${idx * 0.04}s` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ background: 'rgba(56, 189, 248, 0.12)', padding: '10px', borderRadius: '12px', color: '#38bdf8' }}>
                          <Truck size={20} />
                        </div>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>{apt.company_name}</span>
                            <span className={`priority-badge priority-${apt.priority_level || 'Standard'}`}>{apt.priority_level || 'Standard'}</span>
                          </div>
                          <div style={{ fontSize: '20px', fontWeight: 800, fontFamily: 'JetBrains Mono, monospace' }}>{apt.plate_number}</div>
                        </div>
                      </div>
                      <span className={`status-pill status-${apt.status}`}>{apt.status}</span>
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
                      <span className="meta-tag"><Ship size={12} color="#38bdf8" /> {apt.vessel_name || 'MV Starlite'}</span>
                      <span className="meta-tag"><Scale size={12} color="#fbbf24" /> {apt.cargo_weight_tons || 5}t {apt.actual_weighbridge_tons ? `• Scale: ${apt.actual_weighbridge_tons}t` : ''}</span>
                      <span className="meta-tag"><Receipt size={12} color="#34d399" /> ₱{Number(apt.port_fee_php || 1450).toLocaleString()} ({apt.or_number || 'PAID'})</span>
                      {apt.container_seal && <span className="meta-tag"><ShieldCheck size={12} color="#c084fc" /> {apt.container_seal}</span>}
                      {apt.assigned_berth && <span className="meta-tag" style={{ color: '#38bdf8' }}><MapPin size={12} /> {apt.assigned_berth}</span>}
                    </div>

                    <div style={{ background: 'rgba(6, 11, 20, 0.55)', borderRadius: '12px', padding: '12px', fontSize: '13px', marginBottom: '14px' }}>
                      <div><strong style={{ color: '#64748b' }}>Driver:</strong> {apt.driver_name} ({apt.driver_phone || '0917-555-0192'}) • {apt.truck_type || '10-Wheeler'}</div>
                      <div style={{ marginTop: '4px' }}><strong style={{ color: '#64748b' }}>Route:</strong> {apt.origin_port || 'Calapan'} ➔ {apt.destination_port || 'Batangas'}</div>
                      <div style={{ marginTop: '4px' }}><strong style={{ color: '#64748b' }}>Manifest:</strong> {apt.cargo_summary}</div>
                    </div>

                    {apt.manifest_photo_url && (
                      <div style={{ marginBottom: '14px', position: 'relative' }}>
                        <img
                          src={apt.manifest_photo_url}
                          alt="Manifest"
                          onClick={() => setPreviewImage(apt.manifest_photo_url)}
                          style={{ width: '100%', height: '150px', objectFit: 'cover', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer' }}
                        />
                        <button
                          onClick={() => setPreviewImage(apt.manifest_photo_url)}
                          style={{ position: 'absolute', bottom: '10px', right: '10px', background: 'rgba(6, 11, 20, 0.85)', color: '#38bdf8', border: '1px solid rgba(56,189,248,0.4)', borderRadius: '8px', padding: '6px 10px', fontSize: '11px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer' }}
                        >
                          <Eye size={13} /> Inspect Bill of Lading
                        </button>
                      </div>
                    )}

                    {apt.status === 'pending' && (
                      <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '14px' }}>
                        <div className="modern-field" style={{ marginBottom: '10px' }}>
                          <label>Assign Terminal Berth / Pier Gate</label>
                          <select
                            className="modern-input"
                            style={{ padding: '10px 12px', fontSize: '13px' }}
                            value={berthSelections[apt.id] || apt.assigned_berth || 'Pier 1 • RoRo Ramp A'}
                            onChange={e => setBerthSelections({ ...berthSelections, [apt.id]: e.target.value })}
                          >
                            {BERTH_OPTIONS.map(b => <option key={b} value={b}>{b}</option>)}
                          </select>
                        </div>

                        <div className="modern-field" style={{ marginBottom: '12px' }}>
                          <label>Port Authority Clearance Remarks</label>
                          <input
                            className="modern-input"
                            style={{ padding: '10px 12px', fontSize: '13px' }}
                            placeholder="Optional instructions or rejection reason..."
                            value={noteInputs[apt.id] || ''}
                            onChange={e => setNoteInputs({ ...noteInputs, [apt.id]: e.target.value })}
                          />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '10px' }}>
                          <button
                            onClick={() => handleDecision(apt.id, 'approved')}
                            style={{ background: 'linear-gradient(135deg, #10b981, #059669)', color: '#fff', border: 'none', borderRadius: '12px', padding: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', cursor: 'pointer' }}
                          >
                            <Check size={17} /> Approve & Issue QR
                          </button>
                          <button
                            onClick={() => handleDecision(apt.id, 'rejected')}
                            style={{ background: 'rgba(239, 68, 68, 0.12)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.35)', borderRadius: '12px', padding: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', cursor: 'pointer' }}
                          >
                            <X size={17} /> Reject
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          {/* MODULE 2: RORO VESSEL SCHEDULE CONTROL */}
          {activeModule === 'vessels' && (
            <div className="admin-cards-grid animate-enter">
              {vessels.map(v => {
                const bookedTrucks = appointments.filter(a => a.vessel_name === v.vessel_name && a.status !== 'rejected').length;
                return (
                  <div key={v.id} className="glass-card" style={{ marginBottom: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <span style={{ fontSize: '11px', color: '#38bdf8', fontWeight: 700 }}>{v.route}</span>
                        <h3 style={{ margin: '4px 0', fontSize: '20px', fontWeight: 800 }}>{v.vessel_name}</h3>
                        <div style={{ fontSize: '12px', color: '#94a3b8' }}>{v.berth} • ETD: {v.etd}</div>
                      </div>
                      <span className={`status-pill ${v.status.includes('Delayed') ? 'status-rejected' : v.status.includes('Boarding') ? 'status-approved' : 'status-inside'}`}>
                        {v.status}
                      </span>
                    </div>

                    <div style={{ margin: '14px 0', fontSize: '12px', color: '#cbd5e1' }}>
                      Manifested Rolling Cargo: <strong>{bookedTrucks} / {v.max_trucks} Trucks</strong>
                    </div>

                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {['Boarding Now', 'On Schedule', 'Delayed - Weather', 'Departed Pier'].map(st => (
                        <button
                          key={st}
                          onClick={() => updateVesselStatus(v.id, st)}
                          style={{
                            background: v.status === st ? '#0ea5e9' : 'rgba(6, 11, 20, 0.7)',
                            color: v.status === st ? '#fff' : '#94a3b8',
                            border: '1px solid rgba(255,255,255,0.08)',
                            borderRadius: '8px',
                            padding: '6px 10px',
                            fontSize: '11px',
                            fontWeight: 700,
                            cursor: 'pointer'
                          }}
                        >
                          {st}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* MODULE 3: PIER & BERTH CAPACITY TELEMETRY */}
          {activeModule === 'berths' && (
            <div className="admin-cards-grid animate-enter">
              {BERTH_OPTIONS.map((berth, i) => {
                const dockedHere = appointments.filter(a => a.status === 'inside' && (a.assigned_berth || 'Pier 1 • RoRo Ramp A') === berth);
                const enRouteHere = appointments.filter(a => a.status === 'approved' && (a.assigned_berth || 'Pier 1 • RoRo Ramp A') === berth);
                const maxCapacity = 10;
                const occupancyPct = Math.min(100, Math.round((dockedHere.length / maxCapacity) * 100));

                return (
                  <div key={i} className="glass-card" style={{ marginBottom: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <span style={{ fontSize: '11px', color: '#38bdf8', fontWeight: 700 }}>TERMINAL SECTOR {i + 1}</span>
                        <h3 style={{ margin: '4px 0 0', fontSize: '18px', fontWeight: 800 }}>{berth}</h3>
                      </div>
                      <span className="status-pill status-inside">{dockedHere.length} / {maxCapacity} Trucks</span>
                    </div>

                    <div className="berth-progress-track">
                      <div
                        className="berth-progress-fill"
                        style={{
                          width: `${Math.max(8, occupancyPct)}%`,
                          background: occupancyPct > 80 ? '#ef4444' : '#0ea5e9'
                        }}
                      />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#94a3b8', marginTop: '10px', marginBottom: '14px' }}>
                      <span>Currently Docked: <strong style={{ color: '#fff' }}>{dockedHere.length}</strong></span>
                      <span>Cleared En-Route: <strong style={{ color: '#34d399' }}>{enRouteHere.length}</strong></span>
                    </div>

                    <div style={{ fontSize: '12px', color: '#cbd5e1', background: 'rgba(6, 11, 20, 0.55)', padding: '10px 12px', borderRadius: '10px' }}>
                      <strong>Active Plates in Sector: </strong>
                      {dockedHere.length === 0 ? (
                        <span style={{ color: '#64748b' }}>No vehicles currently docked</span>
                      ) : (
                        dockedHere.map(a => a.plate_number).join(', ')
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* MODULE 4: REGISTERED DRIVERS & FLEET DIRECTORY */}
          {activeModule === 'drivers' && (
            <div className="glass-card animate-enter">
              <h3 style={{ margin: '0 0 6px', fontSize: '18px', fontWeight: 800 }}>Registered Port Drivers & Trucking Directory</h3>
              <p style={{ margin: '0 0 18px', fontSize: '12px', color: '#94a3b8' }}>
                Automatically indexed from verified freight declarations, carrier manifests, and PPA tariff payments
              </p>

              <div className="port-table-wrapper">
                <table className="port-table">
                  <thead>
                    <tr>
                      <th>Driver Name</th>
                      <th>Contact</th>
                      <th>Shipping Company</th>
                      <th>Registered Plates</th>
                      <th>Total Bookings</th>
                      <th>Total Tonnage</th>
                      <th>Total PPA Fees Paid</th>
                    </tr>
                  </thead>
                  <tbody>
                    {driverDirectory.map((d: any, i: number) => (
                      <tr key={i}>
                        <td style={{ fontWeight: 700, color: '#fff' }}>{d.name}</td>
                        <td>{d.phone}</td>
                        <td><span style={{ color: '#38bdf8', fontWeight: 600 }}>{d.company}</span></td>
                        <td style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '12px' }}>
                          {Array.from(d.plates).join(', ')}
                        </td>
                        <td>{d.totalTrips}</td>
                        <td style={{ fontWeight: 700, color: '#c084fc' }}>{d.totalTons.toFixed(1)}t</td>
                        <td style={{ fontWeight: 700, color: '#34d399' }}>₱{d.totalFees.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* MODULE 5: PORT-WIDE COAST GUARD & WEATHER BROADCAST */}
          {activeModule === 'broadcast' && (
            <div className="glass-card animate-enter" style={{ maxWidth: '680px' }}>
              <h3 style={{ margin: '0 0 6px', fontSize: '18px', fontWeight: 800 }}>Broadcast Terminal & Weather Advisory</h3>
              <p style={{ margin: '0 0 18px', fontSize: '12px', color: '#94a3b8' }}>
                Push a real-time banner alert to all Driver and Gate Guard mobile devices
              </p>

              <div className="modern-field">
                <label>Bulletin Header Title</label>
                <input className="modern-input" value={advTitle} onChange={e => setAdvTitle(e.target.value)} />
              </div>

              <div className="modern-field">
                <label>Alert Severity Level</label>
                <select className="modern-input" value={advSeverity} onChange={e => setAdvSeverity(e.target.value)}>
                  <option value="info">Standard Maritime Bulletin (Blue)</option>
                  <option value="warning">Port Congestion / Crane Maintenance (Amber)</option>
                  <option value="danger">Coast Guard Gale Warning / Suspension (Red)</option>
                </select>
              </div>

              <div className="modern-field">
                <label>Broadcast Message</label>
                <textarea
                  className="modern-input"
                  rows={3}
                  value={advMessage}
                  onChange={e => setAdvMessage(e.target.value)}
                  placeholder="e.g. MV Starlite Calapan is now boarding at Pier 1 Ramp A. All cleared trucks proceed to Weighbridge #2."
                />
              </div>

              <button className="btn-glow" onClick={publishAdvisory}>
                <Megaphone size={17} /> Broadcast Live Alert to All Terminals
              </button>
            </div>
          )}

          {/* MODULE 6: MASTER TRANSACTION AUDIT LEDGER */}
          {activeModule === 'ledger' && (
            <div className="glass-card animate-enter">
              <h3 style={{ margin: '0 0 14px', fontSize: '18px', fontWeight: 800 }}>Master Gate & Financial Transaction Ledger</h3>
              <div className="port-table-wrapper">
                <table className="port-table">
                  <thead>
                    <tr>
                      <th>Plate & Seal</th>
                      <th>Driver / Company</th>
                      <th>Vessel & Berth</th>
                      <th>Declared vs. Scale</th>
                      <th>PPA Tariff OR</th>
                      <th>Status</th>
                      <th>Entry / Exit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {appointments.map(apt => (
                      <tr key={apt.id}>
                        <td>
                          <div style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 800, color: '#38bdf8' }}>{apt.plate_number}</div>
                          <div style={{ fontSize: '11px', color: '#94a3b8' }}>{apt.container_seal || 'SEAL-8842'}</div>
                        </td>
                        <td>
                          <div style={{ fontWeight: 700 }}>{apt.driver_name}</div>
                          <div style={{ fontSize: '11px', color: '#94a3b8' }}>{apt.company_name}</div>
                        </td>
                        <td>
                          <div>{apt.vessel_name || 'MV Starlite'}</div>
                          <div style={{ fontSize: '11px', color: '#38bdf8' }}>{apt.assigned_berth || 'Pier 1'}</div>
                        </td>
                        <td>
                          <div>Declared: {apt.cargo_weight_tons || 5}t</div>
                          <div style={{ fontSize: '11px', color: '#fbbf24' }}>
                            Scale: {apt.actual_weighbridge_tons ? `${apt.actual_weighbridge_tons}t` : 'Pending'}
                          </div>
                        </td>
                        <td>
                          <div style={{ fontWeight: 700, color: '#34d399' }}>₱{Number(apt.port_fee_php || 1450).toLocaleString()}</div>
                          <div style={{ fontSize: '11px', color: '#94a3b8' }}>{apt.or_number || 'OR-PPA'}</div>
                        </td>
                        <td><span className={`status-pill status-${apt.status}`}>{apt.status}</span></td>
                        <td style={{ fontSize: '11px' }}>
                          <div>In: {apt.entry_time ? new Date(apt.entry_time).toLocaleTimeString() : '—'}</div>
                          <div>Out: {apt.exit_time ? new Date(apt.exit_time).toLocaleTimeString() : '—'}</div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Fullscreen Document Lightbox Modal */}
        {previewImage && (
          <div
            onClick={() => setPreviewImage(null)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(6, 11, 20, 0.92)', backdropFilter: 'blur(10px)', zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px' }}
          >
            <img src={previewImage} alt="Full Manifest" style={{ maxWidth: '92%', maxHeight: '80vh', borderRadius: '16px', border: '1px solid rgba(56,189,248,0.4)' }} />
            <button className="btn-glow" style={{ maxWidth: '220px', marginTop: '18px' }} onClick={() => setPreviewImage(null)}>
              Close Document Preview
            </button>
          </div>
        )}

        <IonToast isOpen={!!toastMsg} message={toastMsg} duration={2800} position="top" onDidDismiss={() => setToastMsg('')} />
      </IonContent>
    </IonPage>
  );
};

export default Tab2;