import React, { useState, useEffect } from 'react';
import { IonApp, IonPage, IonContent, setupIonicReact } from '@ionic/react';
import { Ship, Truck, ShieldCheck, ScanLine, Lock, User, ArrowRight } from 'lucide-react';
import Tab1 from './pages/Tab1';
import Tab2 from './pages/Tab2';
import Tab3 from './pages/Tab3';

/* Core CSS required for Ionic components to work properly */
import '@ionic/react/css/core.css';
import '@ionic/react/css/normalize.css';
import '@ionic/react/css/structure.css';
import '@ionic/react/css/typography.css';
import '@ionic/react/css/padding.css';
import '@ionic/react/css/float-elements.css';
import '@ionic/react/css/text-alignment.css';
import '@ionic/react/css/text-transformation.css';
import '@ionic/react/css/flex-utils.css';
import '@ionic/react/css/display.css';
import '@ionic/react/css/palettes/dark.system.css';

import './theme/variables.css';

setupIonicReact();

const App: React.FC = () => {
  const [role, setRole] = useState<'driver' | 'guard' | 'admin' | null>(null);
  const [selectedTab, setSelectedTab] = useState<'driver' | 'guard' | 'admin'>('driver');
  const [driverName, setDriverName] = useState('');
  const [pin, setPin] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const savedRole = localStorage.getItem('portpass_role') as any;
    const savedName = localStorage.getItem('portpass_driver_name') || '';
    if (savedRole) {
      setRole(savedRole);
      setDriverName(savedName);
    }
  }, []);

  const handleLogin = () => {
    setErrorMsg('');
    if (selectedTab === 'driver') {
      if (!driverName.trim()) {
        setErrorMsg('Please enter your full name to access your driver passes.');
        return;
      }
      localStorage.setItem('portpass_role', 'driver');
      localStorage.setItem('portpass_driver_name', driverName.trim());
      setRole('driver');
    } else if (selectedTab === 'guard') {
      if (pin !== '1234') {
        setErrorMsg('Invalid Security Guard PIN (Demo PIN: 1234)');
        return;
      }
      localStorage.setItem('portpass_role', 'guard');
      setRole('guard');
    } else if (selectedTab === 'admin') {
      if (pin !== '9999') {
        setErrorMsg('Invalid Port Admin PIN (Demo PIN: 9999)');
        return;
      }
      localStorage.setItem('portpass_role', 'admin');
      setRole('admin');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('portpass_role');
    setRole(null);
    setPin('');
    setErrorMsg('');
  };

  return (
    <IonApp>
      {!role ? (
        <IonPage>
          <IonContent fullscreen>
            <div className="port-container" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: '92vh' }}>
              <div className="glass-card animate-enter" style={{ padding: '30px 24px' }}>
                <div style={{ textAlign: 'center', marginBottom: '26px' }}>
                  <div style={{ width: '56px', height: '56px', borderRadius: '18px', background: 'rgba(14, 165, 233, 0.15)', border: '1px solid rgba(56, 189, 248, 0.35)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#38bdf8', marginBottom: '12px' }}>
                    <Ship size={28} />
                  </div>
                  <div style={{ fontSize: '11px', fontWeight: 800, color: '#38bdf8', letterSpacing: '1.5px' }}>
                    PHILIPPINE PORTS AUTHORITY
                  </div>
                  <h1 style={{ margin: '4px 0 6px', fontSize: '28px', fontWeight: 800 }}>
                    PortPass <span style={{ color: '#38bdf8' }}>OS</span>
                  </h1>
                  <p style={{ margin: 0, fontSize: '13px', color: '#94a3b8' }}>
                    Select your terminal clearance role to continue
                  </p>
                </div>

                {/* Role Selector Cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '22px' }}>
                  {[
                    { id: 'driver', label: 'Driver', icon: <Truck size={20} />, desc: 'Mobile Pass' },
                    { id: 'guard', label: 'Gate Guard', icon: <ScanLine size={20} />, desc: 'QR Scanner' },
                    { id: 'admin', label: 'Port Admin', icon: <ShieldCheck size={20} />, desc: 'Web Hub' }
                  ].map((item) => (
                    <div
                      key={item.id}
                      onClick={() => { setSelectedTab(item.id as any); setErrorMsg(''); }}
                      style={{
                        background: selectedTab === item.id ? 'rgba(14, 165, 233, 0.18)' : 'rgba(6, 11, 20, 0.65)',
                        border: selectedTab === item.id ? '1.5px solid #38bdf8' : '1.5px solid rgba(255,255,255,0.07)',
                        borderRadius: '16px',
                        padding: '14px 8px',
                        textAlign: 'center',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <div style={{ color: selectedTab === item.id ? '#38bdf8' : '#64748b', marginBottom: '6px', display: 'flex', justifyContent: 'center' }}>
                        {item.icon}
                      </div>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: selectedTab === item.id ? '#fff' : '#cbd5e1' }}>
                        {item.label}
                      </div>
                      <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>{item.desc}</div>
                    </div>
                  ))}
                </div>

                {/* Dynamic Role Inputs */}
                {selectedTab === 'driver' ? (
                  <div className="modern-field">
                    <label><User size={12} style={{ verticalAlign: 'middle', marginRight: '4px' }} /> Registered Driver Name</label>
                    <input
                      className="modern-input"
                      value={driverName}
                      onChange={e => setDriverName(e.target.value)}
                      placeholder="e.g. Aaron Mendoza"
                    />
                  </div>
                ) : (
                  <div className="modern-field">
                    <label>
                      <Lock size={12} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
                      {selectedTab === 'guard' ? 'Checkpoint Guard PIN (Demo: 1234)' : 'Port Admin Master PIN (Demo: 9999)'}
                    </label>
                    <input
                      type="password"
                      className="modern-input"
                      style={{ fontFamily: 'JetBrains Mono, monospace', letterSpacing: '4px' }}
                      value={pin}
                      onChange={e => setPin(e.target.value)}
                      placeholder="••••"
                    />
                  </div>
                )}

                {errorMsg && (
                  <div style={{ background: 'rgba(239, 68, 68, 0.14)', border: '1px solid rgba(239, 68, 68, 0.35)', color: '#f87171', padding: '10px 14px', borderRadius: '12px', fontSize: '12px', fontWeight: 600, marginBottom: '16px', textAlign: 'center' }}>
                    {errorMsg}
                  </div>
                )}

                <button className="btn-glow" onClick={handleLogin}>
                  Enter {selectedTab === 'driver' ? 'Driver Portal' : selectedTab === 'guard' ? 'Scanner Terminal' : 'Admin Command Center'}
                  <ArrowRight size={17} />
                </button>
              </div>
            </div>
          </IonContent>
        </IonPage>
      ) : role === 'driver' ? (
        <Tab1 currentDriver={driverName} onLogout={handleLogout} />
      ) : role === 'admin' ? (
        <Tab2 onLogout={handleLogout} />
      ) : (
        <Tab3 onLogout={handleLogout} />
      )}
    </IonApp>
  );
};

export default App;