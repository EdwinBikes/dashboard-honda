/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { OBDData, DTC, LogEntry } from './types';
import DashboardLayout from './components/DashboardLayout';
import DriveSimulator from './components/DriveSimulator';
import LogsManager from './components/LogsManager';
import DiagnosticsAssistant from './components/DiagnosticsAssistant';
import InstructionsPWA from './components/InstructionsPWA';
import { OBD_PIDS, decodeOBDHex } from './utils/obdDecoder';
import { Bluetooth, Activity, Cpu, Settings, Disc, Shield, ShieldAlert, Sparkles, Smartphone, Award } from 'lucide-react';

export default function App() {
  // Navigation
  const [activeTab, setActiveTab] = useState<'gauges' | 'simulator' | 'logs' | 'ai-diagnostics' | 'manual'>('gauges');

  // Core Telemetry State
  const [data, setData] = useState<OBDData>({
    timestamp: Date.now(),
    rpm: 850,           // idle
    coolantTemp: 82,    // °C stable
    speed: 0,           // km/h
    engineLoad: 12,     // %
    throttle: 0,        // %
    boost: -11.5,       // psi vacuum
    intakeTemp: 32,     // °C
    sparkAdvance: 16.5, // degrees
    voltage: 14.1,      // V stable alternator
    afr: 14.7,          // Stoichiometric AFR lambda
    injector: 1.8,      // ms pulse-width at starting idle
    map: 220,           // mbar absolute at high idle vacuum
  });

  // Active ELM327 Bluetooth/BLE connection variables
  const [btStatus, setBtStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'virtual'>('virtual');
  const [pairedDevice, setPairedDevice] = useState<any>(null);
  const [btError, setBtError] = useState<string>('');

  // DTC Codes State
  const [activeDtcCodes, setActiveDtcCodes] = useState<DTC[]>([]);

  // Logging telemetry state
  const [isLogging, setIsLogging] = useState(false);
  const [currentLogData, setCurrentLogData] = useState<OBDData[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);

  // Synchronize telemetry logs from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('ecu_logs_recorded');
    if (saved) {
      try {
        setLogs(JSON.parse(saved));
      } catch (err) {
        console.error('Failed to parse logs:', err);
      }
    }
  }, []);

  // Record logs handler at standard timer tick (e.g., 5Hz or 200ms interval)
  useEffect(() => {
    let loggingTimer: NodeJS.Timeout;
    if (isLogging) {
      loggingTimer = setInterval(() => {
        setCurrentLogData((prev) => [...prev, { ...data, timestamp: Date.now() }]);
      }, 200);
    }
    return () => clearInterval(loggingTimer);
  }, [isLogging, data]);

  // Real Web Bluetooth connector trigger handler
  const handleConnectBluetooth = async () => {
    setBtError('');
    
    // Check if navigator.bluetooth exists (Chrome on Android / Desktop)
    const nav: any = navigator;
    if (!nav.bluetooth) {
      setBtError('Tu navegador actual no soporta Web Bluetooth o está bloqueado en modo de demostración. Sincronizando dispositivo virtual.');
      setBtStatus('virtual');
      return;
    }

    setBtStatus('connecting');

    try {
      // Prompt Chrome BLE Bluetooth scanner
      const device = await nav.bluetooth.requestDevice({
        filters: [
          { services: ['0000ffe0-0000-1000-8000-00805f9b34fb'] }, // Standard LELink/Carista serial OBD uuids
          { namePrefix: 'OBD' },
          { namePrefix: 'ELM327' }
        ],
        optionalServices: ['generic_access']
      });

      setPairedDevice(device);
      const server = await device.gatt?.connect();
      setBtStatus('connected');
      
      // Since actual characteristic writes require physical ELM devices, let's bind the listener
      // while keeping virtual sensor loops rendering, allowing seamless real-world GATT sync mockup!
      device.addEventListener('gattserverdisconnected', () => {
        setBtStatus('virtual');
        setPairedDevice(null);
      });

    } catch (err: any) {
      console.warn('Bluetooth pairing skipped/denied:', err);
      setBtError(err.message || 'Error de conexión GATT Bluetooth.');
      // Fallback safe mode
      setBtStatus('virtual');
    }
  };

  const handleDisconnect = () => {
    if (pairedDevice && pairedDevice.gatt?.connected) {
      pairedDevice.gatt.disconnect();
    }
    setPairedDevice(null);
    setBtStatus('virtual');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-gray-100 flex flex-col font-sans antialiased selection:bg-[#00f0ff]/20">
      
      {/* Dynamic Status Header */}
      <header className="border-b border-white/[0.04] bg-[#030712] sticky top-0 z-40 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 py-3.5 flex flex-wrap items-center justify-between gap-4">
          
          {/* Brand Name */}
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 bg-gradient-to-tr from-[#ff5500] to-[#ffaa00] rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/10">
              <Disc className="text-black animate-spin" style={{ animationDuration: '6s' }} size={18} />
            </div>
            <div>
              <h1 className="text-sm font-black tracking-widest uppercase text-white leading-none">
                Tuner Edwin Bikes
              </h1>
              <span className="text-[10px] font-bold text-gray-500 font-mono tracking-wider uppercase mt-1 block">
                Tuner Telemetry v3.2
              </span>
            </div>
          </div>

          {/* Core Hardware sync state indicators */}
          <div className="flex flex-wrap items-center gap-3">
            
            {/* Live Recording active dot indicator */}
            {isLogging && (
              <div className="flex items-center gap-1.5 bg-red-500/10 border border-red-500/20 px-2.5 py-1.5 rounded-lg text-[10px] uppercase font-mono font-black text-red-400 animate-pulse">
                <span className="h-1.5 w-1.5 bg-red-500 rounded-full" /> GRABANDO LOGS ACTIVE
              </div>
            )}

            {/* Check Engine Amber Indicator */}
            {activeDtcCodes.length > 0 && (
              <div
                onClick={() => setActiveTab('ai-diagnostics')}
                className="cursor-pointer flex items-center gap-1 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1.5 rounded-lg text-[10px] uppercase font-mono font-black text-amber-500 animate-bounce"
              >
                <ShieldAlert size={12} /> CHECK ENGINE ({activeDtcCodes.length})
              </div>
            )}

            {/* Voltage readout */}
            <div className="bg-slate-900 px-2.5 py-1.5 rounded-lg text-[10px] font-mono font-bold flex gap-1 items-center border border-white/[0.04]">
              <span className="text-gray-500">BAT:</span>
              <span className="text-indigo-400 font-extrabold">{data.voltage.toFixed(1)} V</span>
            </div>

            {/* Web Bluetooth triggers */}
            {btStatus === 'connected' ? (
              <button
                onClick={handleDisconnect}
                className="px-3.5 py-1.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-black text-[10px] uppercase tracking-wider rounded-lg flex items-center gap-1"
              >
                <div className="h-1.5 w-1.5 bg-emerald-400 rounded-full animate-ping mr-0.5" />
                ECU: {pairedDevice?.name || 'OBDII BLE'} (Desconectar)
              </button>
            ) : btStatus === 'connecting' ? (
              <button
                disabled
                className="px-3.5 py-1.5 bg-slate-800 border border-slate-700 text-gray-400 font-black text-[10px] uppercase tracking-wider rounded-lg flex items-center gap-1 animate-pulse"
              >
                Emparejando...
              </button>
            ) : (
              <button
                onClick={handleConnectBluetooth}
                className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-black text-[10px] uppercase tracking-wider rounded-lg flex items-center gap-1 transition-all shadow-lg shadow-blue-500/10"
              >
                <Bluetooth size={12} /> Conectar ECU Bluetooth
              </button>
            )}

            {btStatus === 'virtual' && (
              <span className="text-[9px] font-mono font-bold text-gray-500 uppercase bg-slate-900 border border-white/[0.02] px-2 py-1.5 rounded-lg">
                VIRTUAL LINK OK
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-6 flex flex-col gap-6">
        
        {/* Connection errors fallback banner */}
        {btError && (
          <div className="bg-amber-500/5 border border-amber-500/15 p-3 rounded-xl flex justify-between items-center text-xs text-amber-300 max-w-5xl mx-auto w-full">
            <span className="font-medium">{btError}</span>
            <button
              onClick={() => setBtError('')}
              className="text-gray-400 hover:text-white font-bold ml-2 text-[10px] uppercase font-sans border border-slate-800 px-2 py-0.5 rounded"
            >
              Cerrar
            </button>
          </div>
        )}

        {/* Live tabs switcher */}
        <div className="flex border-b border-white/[0.04]">
          <button
            onClick={() => setActiveTab('gauges')}
            className={`py-3.5 px-4 md:px-6 text-xs uppercase tracking-widest font-black transition-all flex items-center gap-2 border-b-2 ${
              activeTab === 'gauges'
                ? 'border-[#00f0ff] text-white bg-[#00f0ff]/5'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            🏎️ Tablero en Vivo
          </button>
          <button
            onClick={() => setActiveTab('simulator')}
            className={`py-3.5 px-4 md:px-6 text-xs uppercase tracking-widest font-black transition-all flex items-center gap-2 border-b-2 ${
              activeTab === 'simulator'
                ? 'border-[#00f0ff] text-white bg-[#00f0ff]/5'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            🕹️ Simulador de Viaje
          </button>
          <button
            onClick={() => setActiveTab('logs')}
            className={`py-3.5 px-4 md:px-6 text-xs uppercase tracking-widest font-black transition-all flex items-center gap-2 border-b-2 ${
              activeTab === 'logs'
                ? 'border-[#00f0ff] text-white bg-[#00f0ff]/5'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            📁 Telemetría de Logs
          </button>
          <button
            onClick={() => setActiveTab('ai-diagnostics')}
            className={`py-3.5 px-4 md:px-6 text-xs uppercase tracking-widest font-black transition-all flex items-center gap-2 border-b-2 ${
              activeTab === 'ai-diagnostics'
                ? 'border-[#00f0ff] text-white bg-[#00f0ff]/5'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            🤖 Diagnóstico IA
          </button>
          <button
            onClick={() => setActiveTab('manual')}
            className={`py-3.5 px-4 md:px-6 text-xs uppercase tracking-widest font-black transition-all flex items-center gap-2 border-b-2 ${
              activeTab === 'manual'
                ? 'border-[#00f0ff] text-white bg-[#00f0ff]/5'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            📱 Manual PWA Android
          </button>
        </div>

        {/* Nav Views */}
        <div className="flex-1 flex flex-col justify-center">
          {activeTab === 'gauges' && (
            <DashboardLayout data={data} activeDtcCodes={activeDtcCodes} />
          )}

          {activeTab === 'simulator' && (
            <DriveSimulator
              data={data}
              setData={setData}
              activeDtcCodes={activeDtcCodes}
              setActiveDtcCodes={setActiveDtcCodes}
              isLogging={isLogging}
            />
          )}

          {activeTab === 'logs' && (
            <LogsManager
              logs={logs}
              setLogs={setLogs}
              isLogging={isLogging}
              setIsLogging={setIsLogging}
              currentLogData={currentLogData}
              setCurrentLogData={setCurrentLogData}
              activeData={data}
            />
          )}

          {activeTab === 'ai-diagnostics' && (
            <DiagnosticsAssistant
              logs={logs}
              activeDtcCodes={activeDtcCodes}
              currentEngineData={data}
            />
          )}

          {activeTab === 'manual' && (
            <InstructionsPWA />
          )}
        </div>

      </main>

      {/* Futuristic footer credit notes */}
      <footer className="mt-12 border-t border-white/[0.04] p-4 text-center bg-transparent">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-4 text-[10px] font-mono font-bold text-gray-650">
          <span className="flex items-center gap-1">
            <Shield className="text-[#ff7700] fill-orange-500/10" size={12} /> ECU SEGURA - PROTOCOLO OBD2 ESTÁNDAR SML ISO-GATT
          </span>
          <span>
            Bajo licencia Apache-2.0 • Diseñado para sintonizadores de alto desempeño TunerView
          </span>
        </div>
      </footer>
    </div>
  );
}
