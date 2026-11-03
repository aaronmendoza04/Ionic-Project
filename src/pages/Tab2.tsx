import React, { useState, useEffect } from 'react';
import { IonContent, IonPage, IonToast } from '@ionic/react';
import {
  Check, X, Truck, Activity, Search, LogOut, Eye,
  Ship, Scale, MapPin, Grid, Radar, Users, Anchor, FileSpreadsheet, Download, Megaphone, AlertTriangle
} from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Tab2Props {
  staffName: string;
  onLogout: () => void;
}

const BERTH_OPTIONS = ['Pier 1 | RoRo Ramp A', 'Pier 2 | Bulk Freight Dock', 'Pier 3 | Cold Chain & Perishables', 'South Wharf | Heavy Container Bay'];
const DEFAULT_MAIN_BERTH = BERTH_OPTIONS[0];

const YARD_SLOTS_PER_LANE = 5;
const DECK_SLOTS_PER_LANE = 6;
const YARD_CAPACITY = 20; 
const DEFAULT_DECK_CAPACITY = 30; 
const MAX_GRID_SLOTS = 60; 

type MatrixMode = 'yard' | 'deck';

interface SlotHold {
  slotId: string;
  lane: string;
  slot: number;
  mode: MatrixMode;
  target: string;
}

const buildLanes = (capacity: number, perLane: number): { lane: string; slots: number[] }[] => {
  const lanes: { lane: string; slots: number[] }[] = [];
  let remaining = Math.max(1, capacity);
  let laneIndex = 0;
  while (remaining > 0) {
    const count = Math.min(perLane, remaining);
    lanes.push({ lane: String.fromCharCode(65 + laneIndex), slots: Array.from({ length: count }, (_, i) => i + 1) });
    remaining -= count;
    laneIndex += 1;
  }
  return lanes;
};

const slotLabel = (lane: string, slot: number) => `Lane ${lane} - Slot ${slot}`;

const Tab2: React.FC<Tab2Props> = ({ staffName, onLogout }) => {
  const [appointments, setAppointments] = useState<any[]>([]);
  const [vessels, setVessels] = useState<any[]>([]);
  const [activeModule, setActiveModule] = useState<'queue' | 'vessels' | 'drivers' | 'berths' | 'broadcast' | 'ledger'>('queue');
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'inside' | 'completed'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  
  const [matrixMode, setMatrixMode] = useState<MatrixMode>('yard');
  const [activeBerthForMatrix, setActiveBerthForMatrix] = useState(DEFAULT_MAIN_BERTH);
  const [activeVesselForMatrix, setActiveVesselForMatrix] = useState('MV Starlite Calapan');
  const [selectedSlotForApt, setSelectedSlotForApt] = useState<Record<string, SlotHold>>({});
  
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
    const channel = supabase.channel('admin-dashboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, loadAll)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vessel_schedules' }, loadAll)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    if (vessels.length > 0) {
      setActiveVesselForMatrix(prev => (vessels.some(v => v.vessel_name === prev) ? prev : vessels[0].vessel_name));
    }
  }, [vessels]);

  const inMatrixScope = (a: any, mode: MatrixMode, target: string) => mode === 'deck'
    ? a.vessel_name === target
    : (a.assigned_berth || DEFAULT_MAIN_BERTH) === target;

  const getMatrixCapacity = (mode: MatrixMode, target: string) => {
    if (mode === 'yard') return YARD_CAPACITY;
    const vessel = vessels.find(v => v.vessel_name === target);
    return Math.min(Number(vessel?.max_trucks) || DEFAULT_DECK_CAPACITY, MAX_GRID_SLOTS);
  };

  const handleDecision = async (id: string, newStatus: string) => {
    const hold = selectedSlotForApt[id];
    if (newStatus === 'approved' && !hold) {
      setToastMsg('Error: Please select an empty bay on the allocation matrix before approving.');
      return;
    }

    let assignedBerth = activeBerthForMatrix;
    let adminNotes = newStatus === 'rejected' ? 'Manifest rejected by Port Authority.' : '';

    if (newStatus === 'approved' && hold) {
      const capacity = getMatrixCapacity(hold.mode, hold.target);
      const committed = appointments.filter(a =>
        a.id !== id && (a.status === 'approved' || a.status === 'inside') && inMatrixScope(a, hold.mode, hold.target)
      ).length;

      if (committed >= capacity) {
        setToastMsg(`OVERBOOKING PREVENTED: ${hold.target} is already at ${committed}/${capacity} capacity.`);
        return;
      }
      assignedBerth = hold.mode === 'yard'
        ? hold.target
        : (vessels.find(v => v.vessel_name === hold.target)?.berth || hold.target);
      adminNotes = `Proceed to ${assignedBerth} | ${slotLabel(hold.lane, hold.slot)}${hold.mode === 'deck' ? ` | Vessel Deck (${hold.target})` : ''}`;
    }

    await supabase.from('appointments').update({
      status: newStatus,
      assigned_berth: newStatus === 'approved' ? assignedBerth : null,
      assigned_slot: newStatus === 'approved' && hold ? hold.slotId : null,
      admin_notes: adminNotes
    }).eq('id', id);

    setToastMsg(newStatus === 'approved'
      ? `Approved | routed to ${slotLabel(hold!.lane, hold!.slot)} at ${assignedBerth}`
      : 'Manifest rejected.');
  };

  const isPaidStatus = (status: any) => {
    const v = String(status || '').toLowerCase();
    return v.includes('paid') && !v.includes('unpaid') && !v.includes('pending');
  };

  const approvePayment = async (apt: any) => {
    const ref = apt.or_number || `OR-PPA-${Math.floor(100000 + Math.random() * 900000)}`;
    await supabase.from('appointments').update({ payment_status: 'Paid (Gcash)', or_number: ref }).eq('id', apt.id);
    setToastMsg(`Payment approved for ${apt.plate_number}. Ref: ${ref}`);
    loadAll();
  };

  const renderAllocationMatrix = (apt: any) => {
    const mode = matrixMode;
    const target = mode === 'yard' ? activeBerthForMatrix : activeVesselForMatrix;
    const capacity = getMatrixCapacity(mode, target);
    const scopeApts = appointments.filter(a => inMatrixScope(a, mode, target));
    const committed = scopeApts.filter(a => a.status === 'approved' || a.status === 'inside').length;
    
    const selfHold = selectedSlotForApt[apt.id];
    const heldByOthers = Object.entries(selectedSlotForApt).filter(([aptId, h]) => aptId !== apt.id && h.mode === mode && h.target === target).length;
    
    const available = capacity - committed - heldByOthers;
    const isFull = available <= 0;
    const lanes = buildLanes(capacity, mode === 'yard' ? YARD_SLOTS_PER_LANE : DECK_SLOTS_PER_LANE);
    const pct = Math.min(100, Math.round((committed / capacity) * 100));

    // Weight-balance (RoRo deck): port (left) vs starboard (right) tonnage.
    const incomingWeight = Number(apt.cargo_weight_tons) || 5;
    let leftWeight = 0;
    let rightWeight = 0;
    if (mode === 'deck') {
      scopeApts.filter(a => (a.status === 'approved' || a.status === 'inside') && a.assigned_slot).forEach(a => {
        const num = parseInt(String(a.assigned_slot).replace(/[^0-9]/g, ''), 10) || 0;
        const w = Number(a.cargo_weight_tons) || 5;
        if (num <= 3) leftWeight += w; else rightWeight += w;
      });
    }
    const isBalanceLocked = (slotNum: number) => {
      if (mode !== 'deck') return false;
      const self = slotNum <= 3 ? leftWeight : rightWeight;
      const other = slotNum <= 3 ? rightWeight : leftWeight;
      const currentDiff = Math.abs(leftWeight - rightWeight);
      const newSelf = self + incomingWeight;
      const newDiff = Math.abs(newSelf - other);
      const total = newSelf + other;
      const allowed = Math.max(5, total * 0.25);
      // Allow placements that improve (or keep) balance; lock only if they worsen it beyond tolerance.
      if (newDiff <= currentDiff) return false;
      return newDiff > allowed;
    };

    const pickSlot = (lane: string, slot: number) => {
      const slotId = `${lane}${slot}`;
      if (isFull && slotId !== selfHold?.slotId) {
        setToastMsg(`CAPACITY LOCK: ${target} is full (${committed}/${capacity}). Overbooking prevented.`);
        return;
      }
      if (isBalanceLocked(slot)) {
        setToastMsg(`BALANCE LOCK: this side is too heavy; slot unavailable to keep the vessel trimmed.`);
        return;
      }
      setSelectedSlotForApt(prev => ({ ...prev, [apt.id]: { slotId, lane, slot, mode, target } }));
    };

    return (
      <div className="modern-field" style={{ marginBottom: '10px' }}>
        <label><Grid size={13} style={{ verticalAlign: 'middle', marginRight: '4px' }} /> Interactive Terminal Yard &amp; RoRo Deck Matrix</label>
        <div className="matrix-mode-toggle">
          <button type="button" className={mode === 'yard' ? 'active' : ''} onClick={() => setMatrixMode('yard')}>
            <MapPin size={13} /> Terminal Yard
          </button>
          <button type="button" className={mode === 'deck' ? 'active' : ''} onClick={() => setMatrixMode('deck')}>
            <Ship size={13} /> RoRo Vessel Deck
          </button>
        </div>

        {mode === 'yard' ? (
          <select className="modern-input" value={activeBerthForMatrix} onChange={e => setActiveBerthForMatrix(e.target.value)} style={{ padding: '8px 12px', fontSize: '12px', marginBottom: '8px' }}>
            {BERTH_OPTIONS.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
        ) : (
          <select className="modern-input" value={activeVesselForMatrix} onChange={e => setActiveVesselForMatrix(e.target.value)} style={{ padding: '8px 12px', fontSize: '12px', marginBottom: '8px' }}>
            {vessels.length > 0
              ? vessels.map(v => <option key={v.id} value={v.vessel_name}>{v.vessel_name} | {v.route || 'RoRo Route'} ({v.max_trucks || DEFAULT_DECK_CAPACITY} slots)</option>)
              : <option value="MV Starlite Calapan">MV Starlite Calapan (30 slots)</option>}
          </select>
        )}

        <div className="matrix-capacity">
          <div>
            <span>{mode === 'deck' ? 'VESSEL DECK LOAD' : 'YARD BAY OCCUPANCY'}</span>
            <strong style={{ color: isFull ? '#f87171' : '#34d399' }}>{committed} / {capacity} {mode === 'deck' ? 'Trucks' : 'Bays'}</strong>
          </div>
          <div className="berth-progress-track">
            <div className="berth-progress-fill" style={{ width: `${Math.max(4, pct)}%`, background: pct >= 80 ? '#ef4444' : '#0ea5e9' }} />
          </div>
          {mode === 'deck' && (
            <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '6px', display: 'flex', justifyContent: 'space-between' }}>
              <span>Port (Left): <strong style={{ color: '#38bdf8' }}>{leftWeight.toFixed(1)}t</strong></span>
              <span>Starboard (Right): <strong style={{ color: '#38bdf8' }}>{rightWeight.toFixed(1)}t</strong></span>
              <span style={{ color: Math.abs(leftWeight - rightWeight) > 5 ? '#f87171' : '#34d399', fontWeight: 700 }}>
                {Math.abs(leftWeight - rightWeight) > 5 ? 'IMBALANCED' : 'BALANCED'}
              </span>
            </div>
          )}
        </div>

        {isFull && (
          <div className="matrix-overbook-banner">
            <AlertTriangle size={14} /> AT MAXIMUM CAPACITY - new allocations are blocked to prevent vessel overbooking.
          </div>
        )}

        <div className="matrix-container">
          <div style={{ fontSize: '10px', display: 'flex', justifyContent: 'space-between', color: '#94a3b8', marginBottom: '4px', textTransform: 'uppercase', fontWeight: 800 }}>
            <span>{mode === 'deck' ? 'Front / Ship Ramp' : 'Gate In / Front'}</span>
            <span>{mode === 'deck' ? 'Aft / Rear' : 'Berth / Dock'}</span>
          </div>
          {lanes.map(row => (
            <div key={row.lane} className="matrix-row">
              <div className="matrix-lane-label">{row.lane}</div>
              {row.slots.map(slot => {
                const slotId = `${row.lane}${slot}`;
                const isOccupied = scopeApts.some(a => a.assigned_slot === slotId && (a.status === 'approved' || a.status === 'inside'));
                const isHeldByOther = Object.entries(selectedSlotForApt).some(([aptId, h]) => aptId !== apt.id && h.slotId === slotId && h.mode === mode && h.target === target);
                const isSelected = selfHold?.slotId === slotId && selfHold?.mode === mode && selfHold?.target === target;
                const balanceLocked = isBalanceLocked(slot);
                const cls = isOccupied ? 'slot-occupied' : isHeldByOther ? 'slot-held' : isSelected ? 'slot-selected' : (isFull || balanceLocked) ? 'slot-locked' : 'slot-empty';

                return (
                  <div
                    key={slotId}
                    className={`matrix-slot ${cls}`}
                    title={slotLabel(row.lane, slot)}
                    onClick={() => { if (!isOccupied && !isHeldByOther && !balanceLocked) pickSlot(row.lane, slot); else if (balanceLocked) setToastMsg('BALANCE LOCK: this side is too heavy; slot unavailable to keep the vessel trimmed.'); }}
                  >
                    {slot}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        <div className="matrix-legend">
          <span><i className="legend-dot" style={{ background: 'rgba(16,185,129,0.6)' }} /> Empty</span>
          <span><i className="legend-dot" style={{ background: '#0ea5e9' }} /> Your Pick</span>
          <span><i className="legend-dot" style={{ background: 'rgba(245,158,11,0.75)' }} /> Held (Pending)</span>
          <span><i className="legend-dot" style={{ background: 'rgba(239,68,68,0.75)' }} /> Occupied</span>
        </div>

        {selfHold && (
          <div style={{ fontSize: '11px', color: '#38bdf8', fontWeight: 700, marginTop: '8px' }}>
            <MapPin size={12} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
            Locked: {selfHold.target} | {slotLabel(selfHold.lane, selfHold.slot)}
          </div>
        )}
      </div>
    );
  };

  const updateVesselStatus = async (id: string, status: string) => {
    await supabase.from('vessel_schedules').update({ status }).eq('id', id);
    setToastMsg(`Updated vessel status to: ${status}`);
    loadAll();
  };

  const publishAdvisory = async () => {
    if (!advMessage.trim()) return setToastMsg('Please enter an advisory message.');
    await supabase.from('port_advisories').update({ active: false }).eq('active', true);
    await supabase.from('port_advisories').insert([{ title: advTitle, message: advMessage, severity: advSeverity, active: true }]);
    setAdvMessage(''); setToastMsg('Advisory broadcasted to all devices!');
  };

  const exportCsvReport = () => {
    const headers = ['Pass ID', 'Plate Number', 'Truck Type', 'Seal', 'Driver Name', 'Company', 'Vessel', 'Declared Tons', 'Berth', 'Slot', 'Status', 'Entry Time', 'Exit Time'];
    const rows = appointments.map(a => [
      a.id, a.plate_number, `"${a.truck_type || '10-Wheeler'}"`, a.container_seal || 'N/A', `"${a.driver_name}"`, `"${a.company_name}"`,
      `"${a.vessel_name}"`, a.cargo_weight_tons || 5, `"${a.assigned_berth || ''}"`, a.assigned_slot || '', a.status,
      a.entry_time ? new Date(a.entry_time).toISOString() : '', a.exit_time ? new Date(a.exit_time).toISOString() : ''
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const link = document.createElement('a'); link.href = encodeURI(csvContent); link.download = `PortPass_MasterLedger.csv`;
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
    setToastMsg('Exported CSV ledger!');
  };

  const approachingCount = appointments.filter(a => a.is_approaching && a.status === 'approved').length;
  const pendingCount = appointments.filter(a => a.status === 'pending').length;
  const approvedCount = appointments.filter(a => a.status === 'approved').length;
  const insideCount = appointments.filter(a => a.status === 'inside').length;
  const completedCount = appointments.filter(a => a.status === 'completed').length;
  const totalTonnage = appointments.reduce((sum, a) => sum + (Number(a.cargo_weight_tons) || 0), 0);

  const driverDirectory = Object.values(appointments.reduce((acc: Record<string, any>, apt) => {
    const key = apt.driver_name.trim().toLowerCase();
    if (!acc[key]) { acc[key] = { name: apt.driver_name, phone: apt.driver_phone, company: apt.company_name, plates: new Set([apt.plate_number]), totalTrips: 0, completedTrips: 0, totalTons: 0 }; }
    acc[key].plates.add(apt.plate_number); acc[key].totalTrips += 1;
    if (apt.status === 'completed') acc[key].completedTrips += 1;
    acc[key].totalTons += Number(apt.cargo_weight_tons) || 0;
    return acc;
  }, {}));

  const filteredList = appointments.filter(a => {
    const matchesTab = filter === 'all' || a.status === filter;
    const matchesSearch = a.plate_number.toLowerCase().includes(searchQuery.toLowerCase()) || a.company_name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTab && matchesSearch;
  });

  return (
    <IonPage>
      <IonContent fullscreen>
        <div className="admin-wide-container">
          <div className="animate-enter" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '22px', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#34d399', fontSize: '12px', fontWeight: 700 }}>
                <Activity size={15} /> PPA TERMINAL COMMAND
              </div>
              <h1 style={{ margin: '4px 0 0', fontSize: '28px', fontWeight: 800 }}>PortPass <span style={{ color: '#38bdf8' }}>Admin</span></h1>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
                <Users size={13} /> Signed in as <strong style={{ color: '#f8fafc' }}>{staffName}</strong>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              <button onClick={exportCsvReport} style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.4)', borderRadius: '999px', padding: '8px 14px', fontSize: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}><Download size={14} /> Export CSV</button>
              <button className="role-logout-btn" onClick={onLogout}><LogOut size={14} /> Logout</button>
            </div>
          </div>

          <div className="animate-enter" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '22px' }}>
            <div className="glass-card" style={{ padding: '15px', marginBottom: 0, borderLeft: '4px solid #f59e0b' }}>
              <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 700 }}>PENDING QUEUE</div>
              <div style={{ fontSize: '26px', fontWeight: 800, color: '#fbbf24', marginTop: '4px' }}>{pendingCount}</div>
            </div>
            <div className="glass-card" style={{ padding: '15px', marginBottom: 0, borderLeft: '4px solid #eab308' }}>
              <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 700 }}>APPROACHING GATE</div>
              <div style={{ fontSize: '26px', fontWeight: 800, color: '#eab308', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                {approachingCount} {approachingCount > 0 && <span className="gps-radar-ring"></span>}
              </div>
            </div>
            <div className="glass-card" style={{ padding: '15px', marginBottom: 0, borderLeft: '4px solid #10b981' }}>
              <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 700 }}>CLEARED PASSES</div>
              <div style={{ fontSize: '26px', fontWeight: 800, color: '#34d399', marginTop: '4px' }}>{approvedCount}</div>
            </div>
            <div className="glass-card" style={{ padding: '15px', marginBottom: 0, borderLeft: '4px solid #0ea5e9' }}>
              <div style={{ fontSize: '10px', color: '#94a3b8', fontWeight: 700 }}>DOCKED IN PIER</div>
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
          </div>

          <div className="sub-nav-bar animate-enter">
            <button className={`sub-nav-btn ${activeModule === 'queue' ? 'active' : ''}`} onClick={() => setActiveModule('queue')}><Truck size={14} /> Queue ({appointments.length})</button>
            <button className={`sub-nav-btn ${activeModule === 'vessels' ? 'active' : ''}`} onClick={() => setActiveModule('vessels')}><Ship size={14} /> Vessel Control</button>
            <button className={`sub-nav-btn ${activeModule === 'berths' ? 'active' : ''}`} onClick={() => setActiveModule('berths')}><Anchor size={14} /> Berth Telemetry</button>
            <button className={`sub-nav-btn ${activeModule === 'drivers' ? 'active' : ''}`} onClick={() => setActiveModule('drivers')}><Users size={14} /> Fleet Directory</button>
            <button className={`sub-nav-btn ${activeModule === 'broadcast' ? 'active' : ''}`} onClick={() => setActiveModule('broadcast')}><Megaphone size={14} /> Advisories</button>
            <button className={`sub-nav-btn ${activeModule === 'ledger' ? 'active' : ''}`} onClick={() => setActiveModule('ledger')}><FileSpreadsheet size={14} /> Master Ledger</button>
          </div>

          {activeModule === 'queue' && (
            <>
              <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '14px', marginBottom: '20px' }}>
                <div style={{ display: 'flex', gap: '8px', overflowX: 'auto' }}>
                  {(['all', 'pending', 'approved', 'inside', 'completed'] as const).map(tab => (
                    <button key={tab} onClick={() => setFilter(tab)} style={{ background: filter === tab ? '#0ea5e9' : 'rgba(15, 23, 42, 0.75)', color: filter === tab ? '#fff' : '#94a3b8', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '999px', padding: '8px 15px', fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', cursor: 'pointer' }}>{tab}</button>
                  ))}
                </div>
                <div style={{ position: 'relative', minWidth: '260px', flex: '1', maxWidth: '380px' }}>
                  <Search size={16} color="#64748b" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
                  <input className="modern-input" style={{ paddingLeft: '38px', paddingTop: '10px', paddingBottom: '10px' }} placeholder="Search plate or company..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                </div>
              </div>

              <div className="admin-cards-grid">
                {filteredList.map((apt, idx) => (
                  <div key={apt.id} className="glass-card animate-enter" style={{ marginBottom: 0, animationDelay: `${idx * 0.04}s`, borderColor: apt.is_approaching ? '#eab308' : 'rgba(255,255,255,0.08)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ background: 'rgba(56, 189, 248, 0.12)', padding: '10px', borderRadius: '12px', color: '#38bdf8' }}><Truck size={20} /></div>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>{apt.company_name}</span>
                            <span className={`priority-badge priority-${apt.priority_level || 'Standard'}`}>{apt.priority_level || 'Standard'}</span>
                          </div>
                          <div style={{ fontSize: '20px', fontWeight: 800, fontFamily: 'JetBrains Mono, monospace' }}>{apt.plate_number}</div>
                        </div>
                      </div>
                      {apt.is_approaching && apt.status === 'approved' ? (
                        <span className="status-pill status-approaching"><Radar size={13} /> Approaching</span>
                      ) : (
                        <span className={`status-pill status-${apt.status}`}>{apt.status}</span>
                      )}
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
                      <span className="meta-tag"><Ship size={12} color="#38bdf8" /> {apt.vessel_name}</span>
                      <span className="meta-tag"><Scale size={12} color="#fbbf24" /> {apt.cargo_weight_tons}t</span>
                      <span className="meta-tag" style={{ color: isPaidStatus(apt.payment_status) ? '#34d399' : '#fbbf24' }}>PHP {apt.port_fee_php || 0} | {apt.payment_status || 'Unpaid'}</span>
                      {apt.assigned_slot && <span className="meta-tag" style={{ color: '#38bdf8' }}><MapPin size={12} /> {apt.assigned_berth} (Slot {apt.assigned_slot})</span>}
                    </div>

                    <div style={{ background: 'rgba(6, 11, 20, 0.55)', borderRadius: '12px', padding: '12px', fontSize: '13px', marginBottom: '14px' }}>
                      <div><strong style={{ color: '#64748b' }}>Driver:</strong> {apt.driver_name} | {apt.truck_type}</div>
                      <div style={{ marginTop: '4px' }}><strong style={{ color: '#64748b' }}>Manifest:</strong> {apt.cargo_summary}</div>
                    </div>

                    {apt.manifest_photo_url && (
                      <div style={{ marginBottom: '14px', position: 'relative' }}>
                        <img src={apt.manifest_photo_url} alt="Manifest" onClick={() => setPreviewImage(apt.manifest_photo_url)} style={{ width: '100%', height: '150px', objectFit: 'cover', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer' }} />
                        <button onClick={() => setPreviewImage(apt.manifest_photo_url)} style={{ position: 'absolute', bottom: '10px', right: '10px', background: 'rgba(6, 11, 20, 0.85)', color: '#38bdf8', border: '1px solid rgba(56,189,248,0.4)', borderRadius: '8px', padding: '6px 10px', fontSize: '11px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <Eye size={13} /> Inspect Document
                        </button>
                      </div>
                    )}

                    {apt.status === 'pending' && (
                      <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '14px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', fontSize: '12px' }}>
                          <span style={{ color: '#94a3b8', fontWeight: 700 }}>PAYMENT</span>
                          <span style={{ fontWeight: 700, color: isPaidStatus(apt.payment_status) ? '#34d399' : '#fbbf24' }}>
                            {apt.payment_status || 'Unpaid'} {apt.port_fee_php ? `| PHP ${Number(apt.port_fee_php).toLocaleString()}` : ''}
                          </span>
                        </div>
                        {!isPaidStatus(apt.payment_status) && (
                          <button onClick={() => approvePayment(apt)} style={{ width: '100%', marginBottom: '10px', background: 'rgba(56, 189, 248, 0.14)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.35)', borderRadius: '12px', padding: '10px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                            <Check size={16} /> Approve Payment (Gcash Sandbox)
                          </button>
                        )}
                        {renderAllocationMatrix(apt)}
                        <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '10px', marginTop: '14px' }}>
                          <button onClick={() => handleDecision(apt.id, 'approved')} disabled={!isPaidStatus(apt.payment_status)} style={{ background: isPaidStatus(apt.payment_status) ? 'linear-gradient(135deg, #10b981, #059669)' : 'rgba(100,116,139,0.3)', color: '#fff', border: 'none', borderRadius: '12px', padding: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', opacity: isPaidStatus(apt.payment_status) ? 1 : 0.6, cursor: isPaidStatus(apt.payment_status) ? 'pointer' : 'not-allowed' }}>
                            <Check size={17} /> Allocate Slot & Approve
                          </button>
                          <button onClick={() => handleDecision(apt.id, 'rejected')} style={{ background: 'rgba(239, 68, 68, 0.12)', color: '#f87171', border: '1px solid rgba(239, 68, 68, 0.35)', borderRadius: '12px', padding: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                            <X size={17} /> Reject
                          </button>
                        </div>
                        {!isPaidStatus(apt.payment_status) && (
                          <div style={{ marginTop: '8px', fontSize: '11px', color: '#fbbf24', textAlign: 'center' }}>Approve payment first to continue processing.</div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          {activeModule === 'vessels' && (
            <div className="admin-cards-grid animate-enter">
              {vessels.map(v => {
                const maxDeck = Math.min(Number(v.max_trucks) || DEFAULT_DECK_CAPACITY, MAX_GRID_SLOTS);
                const pendingTrucks = appointments.filter(a => a.vessel_name === v.vessel_name && a.status === 'pending').length;
                const bookedTrucks = appointments.filter(a => a.vessel_name === v.vessel_name && (a.status === 'approved' || a.status === 'inside')).length;
                const deckFull = bookedTrucks >= maxDeck;
                const pct = Math.min(100, Math.round((bookedTrucks / maxDeck) * 100));

                return (
                  <div key={v.id} className="glass-card" style={{ marginBottom: 0, borderColor: deckFull ? 'rgba(239,68,68,0.45)' : 'rgba(255,255,255,0.08)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <span style={{ fontSize: '11px', color: '#38bdf8', fontWeight: 700 }}>{v.route}</span>
                        <h3 style={{ margin: '4px 0', fontSize: '20px', fontWeight: 800 }}>{v.vessel_name}</h3>
                        <div style={{ fontSize: '12px', color: '#94a3b8' }}>{v.berth} | ETD: {v.etd}</div>
                      </div>
                      <span className={`status-pill ${v.status.includes('Delayed') ? 'status-rejected' : v.status.includes('Boarding') ? 'status-approved' : 'status-inside'}`}>{v.status}</span>
                    </div>

                    <div style={{ marginTop: '14px', fontSize: '12px', color: '#cbd5e1', display: 'flex', justifyContent: 'space-between' }}>
                      <span>Deck Allocation: <strong>{bookedTrucks} / {maxDeck} Trucks</strong></span>
                      <span style={{ color: '#94a3b8' }}>{pendingTrucks} pending</span>
                    </div>
                    <div className="berth-progress-track">
                      <div className="berth-progress-fill" style={{ width: `${Math.max(4, pct)}%`, background: deckFull ? '#ef4444' : pct >= 80 ? '#f59e0b' : '#0ea5e9' }} />
                    </div>

                    {deckFull && (
                      <div className="matrix-overbook-banner" style={{ margin: '12px 0 0' }}>
                        <AlertTriangle size={14} /> DECK FULL - allocation matrix locks further bookings.
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '14px' }}>
                      {['Boarding Now', 'On Schedule', 'Delayed - Weather', 'Departed Pier'].map(st => (
                        <button key={st} onClick={() => updateVesselStatus(v.id, st)} style={{ background: v.status === st ? '#0ea5e9' : 'rgba(6, 11, 20, 0.7)', color: v.status === st ? '#fff' : '#94a3b8', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '6px 10px', fontSize: '11px', fontWeight: 700 }}>{st}</button>
                      ))}
                      <button onClick={() => { setMatrixMode('deck'); setActiveVesselForMatrix(v.vessel_name); setActiveModule('queue'); setFilter('pending'); }} style={{ background: 'rgba(56, 189, 248, 0.14)', color: '#38bdf8', border: '1px solid rgba(56, 189, 248, 0.35)', borderRadius: '8px', padding: '6px 10px', fontSize: '11px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <Grid size={12} /> Open Deck Matrix
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {activeModule === 'berths' && (
            <div className="admin-cards-grid animate-enter">
              {BERTH_OPTIONS.map((berth, i) => {
                const dockedHere = appointments.filter(a => a.status === 'inside' && (a.assigned_berth || 'Pier 1 | RoRo Ramp A') === berth);
                const enRouteHere = appointments.filter(a => a.status === 'approved' && (a.assigned_berth || 'Pier 1 | RoRo Ramp A') === berth);
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
                    <div className="berth-progress-track"><div className="berth-progress-fill" style={{ width: `${Math.max(8, occupancyPct)}%`, background: occupancyPct > 80 ? '#ef4444' : '#0ea5e9' }} /></div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#94a3b8', marginTop: '10px', marginBottom: '14px' }}>
                      <span>Docked: <strong style={{ color: '#fff' }}>{dockedHere.length}</strong></span>
                      <span>En-Route: <strong style={{ color: '#34d399' }}>{enRouteHere.length}</strong></span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {activeModule === 'drivers' && (
            <div className="glass-card animate-enter">
              <h3 style={{ margin: '0 0 6px', fontSize: '18px', fontWeight: 800 }}>Registered Port Fleet Directory</h3>
              <div className="port-table-wrapper">
                <table className="port-table">
                  <thead><tr><th>Driver Name</th><th>Contact</th><th>Company</th><th>Plates</th><th>Total Bookings</th><th>Total Tonnage</th></tr></thead>
                  <tbody>
                    {driverDirectory.map((d: any, i: number) => (
                      <tr key={i}>
                        <td style={{ fontWeight: 700, color: '#fff' }}>{d.name}</td><td>{d.phone}</td>
                        <td><span style={{ color: '#38bdf8', fontWeight: 600 }}>{d.company}</span></td>
                        <td style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '12px' }}>{Array.from(d.plates).join(', ')}</td>
                        <td>{d.totalTrips}</td><td style={{ fontWeight: 700, color: '#c084fc' }}>{d.totalTons.toFixed(1)}t</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeModule === 'broadcast' && (
            <div className="glass-card animate-enter" style={{ maxWidth: '680px' }}>
              <h3 style={{ margin: '0 0 6px', fontSize: '18px', fontWeight: 800 }}>Broadcast Terminal Advisory</h3>
              <div className="modern-field"><label>Bulletin Title</label><input className="modern-input" value={advTitle} onChange={e => setAdvTitle(e.target.value)} /></div>
              <div className="modern-field">
                <label>Severity Level</label>
                <select className="modern-input" value={advSeverity} onChange={e => setAdvSeverity(e.target.value)}>
                  <option value="info">Standard Bulletin (Blue)</option><option value="warning">Congestion / Maintenance (Amber)</option><option value="danger">Gale Warning (Red)</option>
                </select>
              </div>
              <div className="modern-field"><label>Message</label><textarea className="modern-input" rows={3} value={advMessage} onChange={e => setAdvMessage(e.target.value)} /></div>
              <button className="btn-glow" onClick={publishAdvisory}><Megaphone size={17} /> Broadcast Live Alert</button>
            </div>
          )}

          {activeModule === 'ledger' && (
            <div className="glass-card animate-enter">
              <h3 style={{ margin: '0 0 14px', fontSize: '18px', fontWeight: 800 }}>Master Gate Transaction Ledger</h3>
              <div className="port-table-wrapper">
                <table className="port-table">
                  <thead><tr><th>Plate & Seal</th><th>Driver / Company</th><th>Vessel & Berth</th><th>Weight</th><th>Status</th><th>Entry / Exit</th></tr></thead>
                  <tbody>
                    {appointments.map(apt => (
                      <tr key={apt.id}>
                        <td><div style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 800, color: '#38bdf8' }}>{apt.plate_number}</div><div style={{ fontSize: '11px', color: '#94a3b8' }}>{apt.container_seal}</div></td>
                        <td><div style={{ fontWeight: 700 }}>{apt.driver_name}</div><div style={{ fontSize: '11px', color: '#94a3b8' }}>{apt.company_name}</div></td>
                        <td><div>{apt.vessel_name}</div><div style={{ fontSize: '11px', color: '#38bdf8' }}>{apt.assigned_berth} (Slot {apt.assigned_slot || 'N/A'})</div></td>
                        <td>{apt.cargo_weight_tons || 5}t</td>
                        <td><span className={`status-pill status-${apt.status}`}>{apt.status}</span></td>
                        <td style={{ fontSize: '11px' }}><div>In: {apt.entry_time ? new Date(apt.entry_time).toLocaleTimeString() : ' '}</div><div>Out: {apt.exit_time ? new Date(apt.exit_time).toLocaleTimeString() : ' '}</div></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>

        {previewImage && (
          <div onClick={() => setPreviewImage(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(6, 11, 20, 0.92)', backdropFilter: 'blur(10px)', zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
            <img src={previewImage} alt="Full Manifest" style={{ maxWidth: '92%', maxHeight: '80vh', borderRadius: '16px', border: '1px solid rgba(56,189,248,0.4)' }} />
            <button className="btn-glow" style={{ maxWidth: '220px', marginTop: '18px' }} onClick={() => setPreviewImage(null)}>Close Preview</button>
          </div>
        )}
        <IonToast isOpen={!!toastMsg} message={toastMsg} duration={2800} position="top" onDidDismiss={() => setToastMsg('')} />
      </IonContent>
    </IonPage>
  );
};
export default Tab2;