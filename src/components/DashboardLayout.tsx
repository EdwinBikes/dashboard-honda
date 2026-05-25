/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { OBDData, CustomWidget, DashboardTheme } from '../types';
import { Settings, Check, LayoutGrid, Plus, Trash2, Edit2, Play, AlertOctagon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

// Define gorgeous dashboard themes
export const THEMES: DashboardTheme[] = [
  {
    id: 'cyberpunk',
    name: 'Cyber Neon Blue',
    bgClass: 'bg-black text-blue-400',
    cardClass: 'bg-[#090F1E] border border-blue-500/30 rounded-lg shadow-lg shadow-blue-500/10',
    accentColor: '#00f0ff',
    textColor: 'text-blue-400',
    glowClass: 'shadow-[0_0_15px_rgba(0,240,255,0.4)]',
  },
  {
    id: 'racing-red',
    name: 'Glow Racing Red',
    bgClass: 'bg-black text-red-400',
    cardClass: 'bg-[#120505] border border-red-500/30 rounded-lg shadow-lg shadow-red-500/5',
    accentColor: '#ff2a2a',
    textColor: 'text-red-400',
    glowClass: 'shadow-[0_0_15px_rgba(255,42,42,0.4)]',
  },
  {
    id: 'acid-green',
    name: 'Stealth Acid Green',
    bgClass: 'bg-[#040804] text-[#39FF14]',
    cardClass: 'bg-[#060D06] border border-[#39FF14]/30 rounded-lg shadow-lg shadow-[#39FF14]/5',
    accentColor: '#39FF14',
    textColor: 'text-[#39FF14]',
    glowClass: 'shadow-[0_0_15px_rgba(57,255,20,0.4)]',
  },
  {
    id: 'carbon-orange',
    name: 'Carbon Neon Orange',
    bgClass: 'bg-gray-950 text-orange-400',
    cardClass: 'bg-[#1A1005] border border-orange-500/30 rounded-lg shadow-lg shadow-orange-500/5',
    accentColor: '#ff7700',
    textColor: 'text-orange-400',
    glowClass: 'shadow-[0_0_15px_rgba(255,119,0,0.4)]',
  }
];

// Default Widgets Configuration
const DEFAULT_WIDGETS: CustomWidget[] = [
  { id: '1', type: 'gauge-bar', pid: 'rpm', label: 'RPM', min: 0, max: 8000, unit: 'rpm', warnThreshold: 6200, criticalThreshold: 7200, visible: true },
  { id: '2', type: 'gauge-round', pid: 'boost', label: 'PRESIÓN TURBO (BOOST)', min: -14.7, max: 25, unit: 'psi', warnThreshold: 18, criticalThreshold: 22, visible: true },
  { id: '3', type: 'numeric', pid: 'coolantTemp', label: 'TEMP. REFRIGERANTE (ECT)', min: 0, max: 130, unit: '°C', warnThreshold: 98, criticalThreshold: 108, visible: true },
  { id: '4', type: 'numeric', pid: 'speed', label: 'VELOCIDAD', min: 0, max: 240, unit: 'km/h', warnThreshold: 120, criticalThreshold: 160, visible: true },
  { id: '5', type: 'gauge-round', pid: 'throttle', label: 'MARIPOSA ACELERACIÓN (TPS)', min: 0, max: 100, unit: '%', visible: true },
  { id: '6', type: 'numeric', pid: 'engineLoad', label: 'CARGA MOTOR', min: 0, max: 100, unit: '%', visible: true },
  { id: '7', type: 'numeric', pid: 'afr', label: 'AIRE-COMBUSTIBLE (AFR)', min: 10, max: 20, unit: 'ratio', warnThreshold: 15.5, criticalThreshold: 16.5, visible: true },
  { id: '8', type: 'numeric', pid: 'voltage', label: 'VOLTAJE BATERÍA', min: 9, max: 16, unit: 'V', warnThreshold: 11.5, criticalThreshold: 11.0, visible: true },
];

interface DashboardLayoutProps {
  data: OBDData;
  activeDtcCodes: any[];
}

export default function DashboardLayout({ data, activeDtcCodes }: DashboardLayoutProps) {
  // Theme & Layout state
  const [selectedTheme, setSelectedTheme] = useState<DashboardTheme>(THEMES[0]);
  const [widgets, setWidgets] = useState<CustomWidget[]>(() => {
    const saved = localStorage.getItem('ecu_widgets');
    return saved ? JSON.parse(saved) : DEFAULT_WIDGETS;
  });
  const [currentPreset, setCurrentPreset] = useState<'tuner' | 'compact' | 'circular' | 'crome-qd3'>('crome-qd3');
  
  // Customization modal toggles
  const [isEditing, setIsEditing] = useState(false);
  const [editingWidget, setEditingWidget] = useState<CustomWidget | null>(null);

  const saveWidgets = (newWidgets: CustomWidget[]) => {
    setWidgets(newWidgets);
    localStorage.setItem('ecu_widgets', JSON.stringify(newWidgets));
  };

  const updateWidgetValue = (id: string, updates: Partial<CustomWidget>) => {
    const next = widgets.map(w => w.id === id ? { ...w, ...updates } as CustomWidget : w);
    saveWidgets(next);
    if (editingWidget && editingWidget.id === id) {
      setEditingWidget({ ...editingWidget, ...updates } as CustomWidget);
    }
  };

  const resetWidgets = () => {
    if (confirm('¿Restaurar diseño de fábrica de KTuner?')) {
      saveWidgets(DEFAULT_WIDGETS);
    }
  };

  // Shift light rendering helper based on RPM
  const getShiftLightColor = (rpm: number) => {
    if (rpm < 4000) return 'off';
    if (rpm < 5200) return 'green';
    if (rpm < 6400) return 'yellow';
    return 'red-flash';
  };

  // Mini circular gauge SVG renderer
  const CircularGaugeSVG = ({ widget }: { widget: CustomWidget }) => {
    const val = Number(data[widget.pid] ?? 0);
    const range = widget.max - widget.min;
    const percentage = Math.max(0, Math.min(100, ((val - widget.min) / range) * 100));
    
    // Circle math
    const radius = 50;
    const stroke = 6;
    const normalizedRadius = radius - stroke * 2;
    const circumference = normalizedRadius * 2 * Math.PI;
    const strokeDashoffset = circumference - (percentage / 100) * circumference;

    const isWarn = widget.warnThreshold && val >= widget.warnThreshold;
    const isCritical = widget.criticalThreshold && val >= widget.criticalThreshold;
    let currentColor = selectedTheme.accentColor;
    if (isCritical) currentColor = '#ff1100';
    else if (isWarn) currentColor = '#ff8800';

    return (
      <div className="flex flex-col items-center justify-center p-3 h-full">
        <div className="relative w-28 h-28 flex items-center justify-center">
          {/* SVG Ring */}
          <svg className="absolute w-28 h-28 transform -rotate-90">
            {/* Background circle */}
            <circle
              stroke="#1E293B"
              fill="transparent"
              strokeWidth={stroke}
              r={normalizedRadius}
              cx={radius + stroke}
              cy={radius + stroke}
            />
            {/* Progress circle */}
            <motion.circle
              stroke={currentColor}
              fill="transparent"
              strokeWidth={stroke}
              strokeDasharray={circumference + ' ' + circumference}
              style={{ strokeDashoffset }}
              r={normalizedRadius}
              cx={radius + stroke}
              cy={radius + stroke}
              transition={{ type: 'spring', stiffness: 60, damping: 15 }}
            />
          </svg>
          
          {/* Inner Text */}
          <div className="text-center z-10">
            <span className="text-2xl font-black tracking-tight block leading-none font-mono">
              {widget.pid === 'boost' ? val.toFixed(1) : Math.round(val)}
            </span>
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">
              {widget.unit}
            </span>
          </div>

          {/* Warning Flag */}
          {isWarn && (
            <div className="absolute top-0 right-0 animate-pulse text-red-500">
              <AlertOctagon size={16} />
            </div>
          )}
        </div>
        <span className="text-[11px] font-bold text-gray-300 tracking-wider text-center mt-2 uppercase font-sans">
          {widget.label}
        </span>
      </div>
    );
  };

  const LinearBarGauge = ({ widget }: { widget: CustomWidget }) => {
    const val = Number(data[widget.pid] ?? 0);
    const range = widget.max - widget.min;
    const percentage = Math.max(0, Math.min(100, ((val - widget.min) / range) * 100));

    const isWarn = widget.warnThreshold && val >= widget.warnThreshold;
    const isCritical = widget.criticalThreshold && val >= widget.criticalThreshold;
    let barColorClass = 'bg-accent';
    if (isCritical) barColorClass = 'bg-red-500 animate-pulse';
    else if (isWarn) barColorClass = 'bg-yellow-500';

    return (
      <div className="p-4 w-full h-full flex flex-col justify-between">
        <div className="flex justify-between items-end mb-1">
          <span className="text-xs font-black tracking-widest text-gray-400 uppercase">{widget.label}</span>
          <span className="text-3xl font-black font-mono leading-none">
            {Math.round(val)} <span className="text-xs uppercase text-gray-500">{widget.unit}</span>
          </span>
        </div>
        
        {/* Custom TunerView Style RPM segmented sweep bar */}
        <div className="relative h-6 w-full bg-slate-900 border border-slate-800 rounded flex gap-0.5 overflow-hidden p-0.5">
          {Array.from({ length: 24 }).map((_, i) => {
            const stepThreshold = widget.min + (range * (i / 23));
            const isActive = val >= stepThreshold;
            
            let blockColor = selectedTheme.accentColor;
            if (stepThreshold >= (widget.criticalThreshold || 100000)) {
              blockColor = '#ff1100';
            } else if (stepThreshold >= (widget.warnThreshold || 100000)) {
              blockColor = '#eab308';
            }

            return (
              <div
                key={i}
                className="flex-1 h-full rounded-sm transition-all duration-75"
                style={{
                  backgroundColor: isActive ? blockColor : '#0f172a',
                  opacity: isActive ? 1 : 0.3,
                  boxShadow: isActive ? `0 0 6px ${blockColor}aa` : 'none'
                }}
              />
            );
          })}
        </div>

        <div className="flex justify-between text-[10px] font-mono font-bold text-gray-500 mt-1">
          <span>{widget.min}</span>
          {widget.warnThreshold && <span className="text-yellow-600">Alerta: {widget.warnThreshold}</span>}
          <span>{widget.max}</span>
        </div>
      </div>
    );
  };

  const NumericWidget = ({ widget }: { widget: CustomWidget }) => {
    const val = Number(data[widget.pid] ?? 0);
    const isWarn = widget.warnThreshold && val >= widget.warnThreshold;
    const isCritical = widget.criticalThreshold && val >= widget.criticalThreshold;
    
    let textStyleClass = widget.color || selectedTheme.textColor;
    if (isCritical) textStyleClass = 'text-red-500 font-extrabold animate-pulse';
    else if (isWarn) textStyleClass = 'text-yellow-500 font-bold';

    return (
      <div className="p-4 flex flex-col justify-between h-full relative overflow-hidden">
        {isCritical && (
          <div className="absolute top-0 left-0 w-full h-1 bg-red-500 animate-pulse" />
        )}
        <div className="text-[11px] font-black tracking-widest text-gray-400 uppercase border-b border-white/[0.04] pb-1">
          {widget.label}
        </div>
        <div className="flex items-baseline justify-between mt-2">
          <span className={`text-4xl font-extrabold font-mono leading-none tracking-tight ${textStyleClass}`}>
            {widget.pid === 'voltage' || widget.pid === 'afr' || widget.pid === 'sparkAdvance'
              ? val.toFixed(1)
              : Math.round(val)}
          </span>
          <span className="text-xs font-bold text-gray-500 uppercase tracking-widest pl-1">{widget.unit}</span>
        </div>
        
        {/* Underbar warning label */}
        <div className="flex justify-between items-center mt-1 text-[9px] font-mono font-bold text-gray-500">
          <span>Min: {widget.min} | Max: {widget.max}</span>
          {isCritical ? (
            <span className="text-red-500 font-black animate-pulse flex items-center gap-0.5">
              <AlertOctagon size={8} /> CRÍTICO
            </span>
          ) : isWarn ? (
            <span className="text-yellow-500 font-black">ALERTA</span>
          ) : null}
        </div>
      </div>
    );
  };

  return (
    <div className={`p-4 md:p-6 w-full ${selectedTheme.bgClass} flex flex-col gap-6 font-sans`}>
      {/* LED Segment Shift Lights (KTuner-style tuner LED sweep indicator) */}
      <div className="relative w-full max-w-2xl mx-auto bg-slate-950 p-2.5 rounded-xl border border-white/[0.08] shadow-inner">
        <div className="flex justify-between items-center mb-1 px-1">
          <span className="text-[10px] uppercase tracking-widest font-black text-gray-500 font-mono">Sweeper de RPM</span>
          <div className="h-2 w-2 rounded-full duration-500" style={{ backgroundColor: activeDtcCodes.length > 0 ? '#ef4444' : '#10b981' }} />
        </div>
        {/* Lights */}
        <div className="grid grid-cols-10 gap-1.5 md:gap-2.5">
          {Array.from({ length: 10 }).map((_, i) => {
            const rpmFraction = data.rpm;
            const threshold = i * 750 + 1000;
            const isActive = rpmFraction >= threshold;
            
            // LED Colors matching a professional drag shift bar tracker
            let colorHex = '#1e293b'; 
            if (isActive) {
              if (i < 4) colorHex = '#22c55e'; // Green stable
              else if (i < 8) colorHex = '#eab308'; // Yellow prep
              else colorHex = '#ef4444'; // Red shift light flash
            }

            return (
              <div key={i} className="flex flex-col items-center">
                <div
                  className={`w-full h-3 md:h-4.5 rounded transition-all duration-100 ${
                    isActive && i >= 8 ? 'animate-pulse scale-105 shadow-[0_0_10px_#ef4444]' : ''
                  }`}
                  style={{
                    backgroundColor: colorHex,
                    boxShadow: isActive ? `0 0 12px ${colorHex}` : 'none'
                  }}
                />
                <span className="text-[8px] mt-1 font-mono font-black text-gray-600">{(threshold / 1000).toFixed(1)}k</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Toolbar controls (Change theme, customize, restore structure) */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/60 backdrop-blur border border-white/[0.04] p-3 rounded-xl max-w-5xl mx-auto w-full">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5 mr-2">
            <LayoutGrid size={13} /> Presentaciones:
          </span>
          <button
            onClick={() => setCurrentPreset('crome-qd3')}
            className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition ${
              currentPreset === 'crome-qd3' ? 'bg-[#ff7700] text-black shadow-lg shadow-[#ff7700]/30 font-extrabold' : 'bg-slate-800 text-gray-300 hover:bg-slate-700'
            }`}
          >
            📟 Crome QD3 Datalog
          </button>
          <button
            onClick={() => setCurrentPreset('tuner')}
            className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition ${
              currentPreset === 'tuner' ? 'bg-[#00f0ff] text-black shadow-lg shadow-[#00f0ff]/30' : 'bg-slate-800 text-gray-300 hover:bg-slate-700'
            }`}
          >
            Fórmula KTuner
          </button>
          <button
            onClick={() => setCurrentPreset('compact')}
            className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition ${
              currentPreset === 'compact' ? 'bg-[#00f0ff] text-black shadow-lg shadow-[#00f0ff]/30' : 'bg-slate-800 text-gray-300 hover:bg-slate-700'
            }`}
          >
            Grilla compacta
          </button>
          <button
            onClick={() => setCurrentPreset('circular')}
            className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition ${
              currentPreset === 'circular' ? 'bg-[#00f0ff] text-black shadow-lg shadow-[#00f0ff]/30' : 'bg-slate-800 text-gray-300 hover:bg-slate-700'
            }`}
          >
            Diales Circulares
          </button>
        </div>

        <div className="flex items-center gap-2">
          {/* Theme selector */}
          <div className="flex items-center gap-1">
            {THEMES.map(theme => (
              <button
                key={theme.id}
                title={theme.name}
                onClick={() => setSelectedTheme(theme)}
                className={`w-6 h-6 rounded-full border-2 transition transform hover:scale-110 flex items-center justify-center`}
                style={{
                  backgroundColor: theme.accentColor === '#39FF14' ? '#39FF14' : theme.accentColor,
                  borderColor: selectedTheme.id === theme.id ? '#ffffff' : 'transparent',
                }}
              >
                {selectedTheme.id === theme.id && <Check size={10} className="text-black font-black" />}
              </button>
            ))}
          </div>

          <div className="border-l border-white/[0.08] h-6 mx-1" />

          {/* Customize Mode button */}
          <button
            onClick={() => setIsEditing(!isEditing)}
            className={`px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider flex items-center gap-1 transition ${
              isEditing ? 'bg-red-500 text-white animate-pulse' : 'bg-slate-800 text-gray-300 hover:bg-slate-700'
            }`}
          >
            <Settings size={13} /> {isEditing ? 'Salir de Edición' : 'Editar Widgets'}
          </button>

          {isEditing && (
            <button
              onClick={resetWidgets}
              className="text-xs font-bold text-red-400 bg-red-400/10 border border-red-400/25 px-2.5 py-1.5 rounded-lg hover:bg-red-400/20"
            >
              Restablecer
            </button>
          )}
        </div>
      </div>

      {/* MAIN Dashboard Panel */}
      <div className="max-w-5xl mx-auto w-full min-h-[460px]">
        {currentPreset === 'tuner' && (
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {/* Massive Primary RPM Segment */}
            <div className={`md:col-span-3 lg:col-span-4 ${selectedTheme.cardClass} flex items-center justify-center`}>
              {widgets.find(w => w.pid === 'rpm')?.visible && (
                <div className="w-full relative">
                  {isEditing && (
                    <button
                      onClick={() => setEditingWidget(widgets.find(w => w.pid === 'rpm') || null)}
                      className="absolute top-2 right-2 bg-slate-850 p-1.5 rounded border border-white/20 text-white z-20"
                    >
                      <Edit2 size={11} />
                    </button>
                  )}
                  <LinearBarGauge widget={widgets.find(w => w.pid === 'rpm')!} />
                </div>
              )}
            </div>

            {/* Next primary side-by-side circular elements */}
            <div className="md:col-span-1 grid grid-cols-2 gap-4">
              {widgets.find(w => w.pid === 'boost')?.visible && (
                <div className={`${selectedTheme.cardClass} relative`}>
                  {isEditing && (
                    <button
                      onClick={() => setEditingWidget(widgets.find(w => w.pid === 'boost') || null)}
                      className="absolute top-1.5 right-1.5 bg-slate-850 p-1 rounded border border-white/20 text-white z-20"
                    >
                      <Edit2 size={10} />
                    </button>
                  )}
                  <CircularGaugeSVG widget={widgets.find(w => w.pid === 'boost')!} />
                </div>
              )}
              {widgets.find(w => w.pid === 'throttle')?.visible && (
                <div className={`${selectedTheme.cardClass} relative`}>
                  {isEditing && (
                    <button
                      onClick={() => setEditingWidget(widgets.find(w => w.pid === 'throttle') || null)}
                      className="absolute top-1.5 right-1.5 bg-slate-850 p-1 rounded border border-white/20 text-white z-20"
                    >
                      <Edit2 size={10} />
                    </button>
                  )}
                  <CircularGaugeSVG widget={widgets.find(w => w.pid === 'throttle')!} />
                </div>
              )}
            </div>

            {/* Other key readouts */}
            <div className="md:col-span-2 lg:col-span-3 grid grid-cols-2 sm:grid-cols-3 gap-4">
              {widgets.filter(w => w.pid !== 'rpm' && w.pid !== 'boost' && w.pid !== 'throttle' && w.visible).map(widget => (
                <div key={widget.id} className={`${selectedTheme.cardClass} relative`}>
                  {isEditing && (
                    <button
                      onClick={() => setEditingWidget(widget)}
                      className="absolute top-1.5 right-1.5 bg-slate-850 p-1 rounded border border-white/20 text-white z-20"
                    >
                      <Edit2 size={10} />
                    </button>
                  )}
                  <NumericWidget widget={widget} />
                </div>
              ))}
            </div>
          </div>
        )}

        {currentPreset === 'compact' && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {widgets.filter(w => w.visible).map(widget => (
              <div key={widget.id} className={`${selectedTheme.cardClass} relative`}>
                {isEditing && (
                  <button
                    onClick={() => setEditingWidget(widget)}
                    className="absolute top-1.5 right-1.5 bg-slate-850 p-1 rounded border border-white/20 text-white z-20"
                  >
                    <Edit2 size={10} />
                  </button>
                )}
                <NumericWidget widget={widget} />
              </div>
            ))}
          </div>
        )}

        {currentPreset === 'circular' && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {widgets.filter(w => w.visible).map(widget => (
              <div key={widget.id} className={`${selectedTheme.cardClass} relative`}>
                {isEditing && (
                  <button
                    onClick={() => setEditingWidget(widget)}
                    className="absolute top-1.5 right-1.5 bg-slate-850 p-1 rounded border border-white/20 text-white z-20"
                  >
                    <Edit2 size={10} />
                  </button>
                )}
                {/* Fallback to circular or standard circle gauge for visual satisfaction */}
                {widget.pid === 'rpm' || widget.pid === 'boost' || widget.pid === 'speed' || widget.pid === 'throttle' ? (
                  <CircularGaugeSVG widget={widget} />
                ) : (
                  <NumericWidget widget={widget} />
                )}
              </div>
            ))}
          </div>
        )}

        {/* CROME QD3 DATALOGGER VIEW */}
        {currentPreset === 'crome-qd3' && (
          <div className="flex flex-col gap-5 max-w-5xl mx-auto w-full text-white">
            
            {/* Header / Protocol Status */}
            <div className="bg-[#0f0e0a]/90 border border-amber-500/20 p-4 rounded-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-lg shadow-amber-500/5">
              <div className="flex items-center gap-3">
                <div className="h-4.5 w-4.5 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
                  <span className="h-2 w-2 rounded-full bg-amber-500 animate-ping" />
                </div>
                <div>
                  <h3 className="text-xs font-black uppercase tracking-wider text-amber-500">
                    Sintonización Activa: Crome QD3 Protocol v3.2
                  </h3>
                  <p className="text-[10px] text-gray-400 font-mono mt-0.5">
                    Honda OBD1 Real-Time Serial Link • Frames Rx: {(Math.floor(Date.now() / 150) % 9999).toString().padStart(4, '0')} • Latencia: 14ms
                  </p>
                </div>
              </div>
              <div className="flex gap-3 text-[10px] font-mono">
                <span className="bg-slate-900 border border-white/[0.04] px-2.5 py-1 rounded text-emerald-400 font-black">
                  BAUD: 38400bps
                </span>
                <span className="bg-slate-900 border border-white/[0.04] px-2.5 py-1 rounded text-[#00f0ff] font-black">
                  ESTADO: ONLINE
                </span>
              </div>
            </div>

            {/* Quick Engine Status Sweep Lamps (LED Strip) */}
            <div className="bg-[#0b0e14] border border-white/[0.04] p-3 rounded-xl flex items-center justify-between gap-4 font-mono text-[10px]">
              <span className="text-gray-500 font-black uppercase tracking-widest text-[9px]">Sincronización PIDs Crome</span>
              <div className="flex flex-wrap gap-2">
                {['RPM', 'SPEED', 'ECT', 'IAT', 'MAP', 'O2', 'TPS', 'BAT', 'IGN', 'INJ'].map((p, idx) => (
                  <span key={idx} className="bg-slate-950 border border-amber-500/20 text-amber-400 font-bold px-2 py-0.5 rounded text-[9px] flex items-center gap-1 shadow shadow-amber-950/20">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> {p}
                  </span>
                ))}
              </div>
            </div>

            {/* Primary Bento Datalog Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              
              {/* 1. RPM CARD (Massive layout) */}
              <div className="bg-[#06080e] border border-blue-500/20 p-4.5 rounded-xl shadow-md lg:col-span-2 flex flex-col justify-between min-h-[140px]">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest block">
                      1. REVOLUCIONES POR MINUTO
                    </span>
                    <span className="text-xs text-gray-500 font-bold uppercase mt-0.5 block">
                      ENGINE SPEED (RPM)
                    </span>
                  </div>
                  <span className="text-xs font-mono font-bold bg-blue-500/10 px-2.5 py-1 rounded text-[#00f0ff]">
                    PID C0F1
                  </span>
                </div>
                
                <div className="flex items-baseline justify-between my-3">
                  <span className="text-5xl font-extrabold font-mono text-white tracking-widest animate-pulse">
                    {data.rpm}
                  </span>
                  <span className="text-sm font-black text-gray-400 font-mono">rpm</span>
                </div>

                {/* Simulated RPM Bar graph */}
                <div className="w-full bg-slate-950 h-2.5 rounded border border-white/[0.06] overflow-hidden">
                  <div 
                    className="bg-gradient-to-r from-cyan-400 via-orange-400 to-red-600 h-full transition-all duration-150"
                    style={{ width: `${Math.min(100, (data.rpm / 8500) * 100)}%` }}
                  />
                </div>
              </div>

              {/* 2. INJECTOR PULSE WIDTH (Crucial Crome metric) */}
              <div className="bg-[#0a0f0a] border border-emerald-500/20 p-4.5 rounded-xl shadow-md flex flex-col justify-between min-h-[140px]">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest block">
                      10. PULSO DE INYECTOR
                    </span>
                    <span className="text-xs text-gray-500 font-bold uppercase mt-0.5 block">
                      INJECTOR PULSE (INJ)
                    </span>
                  </div>
                  <span className="text-xs font-mono font-bold bg-emerald-500/10 px-2.5 py-1 rounded text-emerald-400">
                    ms
                  </span>
                </div>
                
                <div className="flex items-baseline justify-between my-2">
                  <span className="text-4xl font-extrabold font-mono text-emerald-300">
                    {data.injector ? data.injector.toFixed(2) : '1.80'}
                  </span>
                  <span className="text-xs text-emerald-500 font-mono font-bold">milisegundos</span>
                </div>

                {/* Estimated Injector Duty Cycle calculation: (RPM * Pulso_ms) / 1200 */}
                <div className="bg-slate-950 p-2 rounded border border-slate-900 flex justify-between text-[10px] font-mono">
                  <span className="text-gray-500">DUTY CYCLE PROYECTADO:</span>
                  <span className="text-emerald-400 font-bold">
                    {((data.rpm * (data.injector || 1.8)) / 1200).toFixed(1)}%
                  </span>
                </div>
              </div>

              {/* 3. MANIFOLD ABSOLUTE PRESSURE (MAP) */}
              <div className="bg-[#0f0b07] border border-amber-500/20 p-4.5 rounded-xl shadow-md flex flex-col justify-between">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest block">
                      5. PRESIÓN ABSOLUTA (MAP)
                    </span>
                    <span className="text-xs text-gray-500 font-bold uppercase mt-0.5 block">
                      MANIFOLD ATMOSPHERE
                    </span>
                  </div>
                  <span className="text-xs font-mono font-bold bg-amber-500/10 px-2 py-0.5 rounded text-amber-400">
                    {data.map ? data.map : '220'} mbar
                  </span>
                </div>

                <div className="my-3">
                  <div className="flex justify-between items-baseline mb-1">
                    <span className="text-3xl font-extrabold font-mono text-amber-300">
                      {(data.map ? data.map / 100 : 2.2).toFixed(2)}
                    </span>
                    <span className="text-xs text-gray-400 font-bold font-mono">Bar Absoluto</span>
                  </div>
                  <span className="text-[10px] font-mono text-gray-500 block">
                    Lectura Turbo Boost: <span className="text-red-400 font-bold">{data.boost.toFixed(1)} psi</span>
                  </span>
                </div>

                <div className="w-full bg-slate-950 h-2 rounded-full overflow-hidden">
                  <div 
                    className="bg-amber-500 h-full"
                    style={{ width: `${Math.min(100, ((data.map || 220) / 2500) * 100)}%` }}
                  />
                </div>
              </div>

              {/* 4. THROTTLE POSITION (TPS) */}
              <div className="bg-[#090b14] border border-white/[0.04] p-4.5 rounded-xl flex flex-col justify-between">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[10px] font-black text-gray-300 uppercase tracking-widest block">
                      7. POSICIÓN DE ACELERADOR
                    </span>
                    <span className="text-xs text-gray-500 font-bold uppercase mt-0.5 block">
                      THROTTLE POSITION (TPS)
                    </span>
                  </div>
                  <span className="text-[10px] text-[#00f0ff] font-mono font-bold">% Angle</span>
                </div>

                <div className="my-2.5">
                  <span className="text-4xl font-extrabold font-mono text-white">
                    {data.throttle}
                  </span>
                  <span className="text-sm font-bold text-gray-500 font-mono pl-1">%</span>
                </div>

                {/* Real-time bar graph TPS */}
                <div className="flex items-center gap-1 bg-slate-950 p-1 rounded font-mono text-[9px]">
                  <span className="text-gray-500">TPS:</span>
                  <div className="flex-1 bg-slate-900 h-2 rounded overflow-hidden">
                    <div className="bg-[#00f0ff] h-full" style={{ width: `${data.throttle}%` }} />
                  </div>
                  <span className="text-[#00f0ff] font-bold">{data.throttle === 100 ? 'WOT' : 'PART'}</span>
                </div>
              </div>

              {/* 5. OXYGEN SENSOR & MIX (O2 / AFR) */}
              <div className="bg-[#0d0912] border border-purple-500/15 p-4.5 rounded-xl flex flex-col justify-between">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[10px] font-black text-purple-400 uppercase tracking-widest block">
                      6. SENSOR DE OXÍGENO (O2)
                    </span>
                    <span className="text-xs text-gray-500 font-bold mt-0.5 block">
                      AIR-FUEL LAMBDA SENSOR
                    </span>
                  </div>
                  <span className="text-[10px] bg-purple-500/10 text-purple-400 px-2 py-0.5 rounded font-mono">
                    Voltaje
                  </span>
                </div>

                <div className="my-2 text-center sm:text-left">
                  <div className="flex items-baseline justify-between">
                    <span className="text-3xl font-black font-mono text-purple-300">
                      {((18.0 - data.afr) / 8.0).toFixed(2)} V
                    </span>
                    <span className="text-sm font-extrabold text-[#39FF14] font-mono">
                      {data.afr.toFixed(2)} AFR
                    </span>
                  </div>
                  <span className="text-[9px] text-gray-500 font-mono block mt-1">
                    {data.afr < 12.5 ? '🔴 MEZCLA RICA (Heavy Load Target)' : data.afr > 15.0 ? '🔵 MEZCLA POBRE (Fuel Savings)' : '🟢 RELACIÓN ESTEQUIOMÉTRICA'}
                  </span>
                </div>

                {/* Range bar Rich/Lean */}
                <div className="grid grid-cols-3 text-center text-[8px] font-mono text-gray-650 pt-1.5 border-t border-white/[0.04]">
                  <span className={data.afr < 13.0 ? 'text-orange-400 font-bold' : ''}>RICH</span>
                  <span className={data.afr >= 13.0 && data.afr <= 15.0 ? 'text-emerald-400 font-bold' : ''}>STOICH</span>
                  <span className={data.afr > 15.0 ? 'text-blue-400 font-bold' : ''}>LEAN</span>
                </div>
              </div>

              {/* 6. ENGINE COOLANT TEMP (ECT) */}
              <div className="bg-[#0c0505] border border-red-500/10 p-4.5 rounded-xl flex flex-col justify-between">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[10px] font-black text-red-400 uppercase tracking-widest block">
                      3. TEMP. REFRIGERANTE
                    </span>
                    <span className="text-xs text-gray-400 font-bold mt-0.5 block">
                      COOLANT TEMP (ECT)
                    </span>
                  </div>
                  <span className="text-[10px] text-red-500 font-mono font-bold">°C</span>
                </div>

                <div className="my-3 flex items-baseline justify-between">
                  <span className="text-4xl font-extrabold font-mono text-red-300">
                    {Math.round(data.coolantTemp)}
                  </span>
                  <span className="text-xs font-mono font-bold text-gray-500">
                    {data.coolantTemp > 98 ? '⚠️ CALENTE' : 'SOPORTE NORMAL'}
                  </span>
                </div>

                <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden">
                  <div 
                    className="bg-red-500 h-full"
                    style={{ width: `${Math.min(100, (data.coolantTemp / 125) * 100)}%` }}
                  />
                </div>
              </div>

              {/* 7. INTAKE AIR TEMPERATURE (IAT) */}
              <div className="bg-[#090b0d] border border-white/[0.04] p-4.5 rounded-xl flex flex-col justify-between">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[10px] font-black text-gray-300 uppercase tracking-widest block">
                      4. TEMP. EN ADMISIÓN
                    </span>
                    <span className="text-xs text-gray-500 font-bold mt-0.5 block">
                      INTAKE AIR TEMP (IAT)
                    </span>
                  </div>
                  <span className="text-[10px] text-cyan-400 font-mono font-bold">°C</span>
                </div>

                <div className="my-2.5">
                  <span className="text-4.5xl font-black font-mono text-cyan-200">
                    {Math.round(data.intakeTemp)}
                  </span>
                  <span className="text-xs text-gray-500 font-mono font-bold pl-1.5">°C Atmosfera</span>
                </div>

                <div className="text-[9px] font-mono bg-slate-950 p-1.5 rounded border border-white/[0.02] text-gray-400 flex justify-between">
                  <span>DENSIDAD DE CARGA ACUMULADA:</span>
                  <span className="text-cyan-400 font-bold">100% ÓPTIMA</span>
                </div>
              </div>

              {/* 8. IGNITION TIMING (IGN) */}
              <div className="bg-[#0a0d14] border border-sky-500/10 p-4.5 rounded-xl flex flex-col justify-between">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[10px] font-black text-sky-450 uppercase tracking-widest block">
                      9. AVANCE DE ENCENDIDO
                    </span>
                    <span className="text-xs text-gray-550 font-bold mt-0.5 block">
                      IGNITION ADVANCE (IGN)
                    </span>
                  </div>
                  <span className="text-[10px] text-sky-400 font-mono font-bold">DEG</span>
                </div>

                <div className="my-2 flex items-baseline justify-between">
                  <span className="text-4xl font-extrabold font-mono text-sky-300">
                    {data.sparkAdvance.toFixed(1)}°
                  </span>
                  <span className="text-xs text-gray-500 font-mono font-black">BTDC</span>
                </div>

                <div className="w-full bg-slate-950 h-1 rounded-full overflow-hidden">
                  <div 
                    className="bg-sky-500 h-full"
                    style={{ width: `${Math.min(100, ((data.sparkAdvance + 10) / 60) * 100)}%` }}
                  />
                </div>
              </div>

              {/* 9. BATTERY VOLTAGE (BAT) */}
              <div className="bg-[#100e0a]/40 border border-[#ffaa00]/10 p-4.5 rounded-xl flex flex-col justify-between">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest block">
                      8. VOLTAJE BATERÍA
                    </span>
                    <span className="text-xs text-gray-500 font-bold mt-0.5 block">
                      ECU SYSTEM VOLTS (BAT)
                    </span>
                  </div>
                  <span className="text-[10px] text-yellow-500 font-mono font-bold">Voltios</span>
                </div>

                <div className="my-3 flex items-baseline justify-between">
                  <span className="text-4xl font-extrabold font-mono text-yellow-300 animate-pulse">
                    {data.voltage.toFixed(1)}
                  </span>
                  <span className="text-xs font-mono font-bold text-gray-500">
                    {data.voltage > 13.5 ? 'CARGA ALTERNADOR' : 'ESTADO ESTÁTICO'}
                  </span>
                </div>

                <div className="bg-slate-950 text-[10px] py-1 text-center font-mono rounded text-yellow-600 border border-yellow-900/30">
                  ESTABILIZADOR COCKPIT CORRIENTE: OK
                </div>
              </div>

              {/* 10. VEHICLE SPEED */}
              <div className="bg-[#05090f] border border-cyan-500/10 p-4.5 rounded-xl flex flex-col justify-between">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[10px] font-black text-cyan-400 uppercase tracking-widest block">
                      2. VELOCIDAD VEHÍCULO
                    </span>
                    <span className="text-xs text-gray-500 font-bold mt-0.5 block">
                      VEHICLE SPEED (VSS)
                    </span>
                  </div>
                  <span className="text-[10px] text-cyan-400 font-mono font-bold">km/h</span>
                </div>

                <div className="my-2 text-center sm:text-left">
                  <span className="text-4.5xl font-black font-mono text-cyan-300">
                    {data.speed}
                  </span>
                  <span className="text-xs font-mono text-gray-500 pl-1.5">KM/H REAL-TIME</span>
                </div>

                <div className="bg-slate-950 p-1 rounded border border-white/[0.02] text-center text-[9px] font-mono text-gray-400">
                  MARCHA: {data.rpm < 1200 ? 'N (Idle)' : data.speed < 40 ? '1-2' : data.speed < 80 ? '3' : '4-5'}
                </div>
              </div>

            </div>
          </div>
        )}
      </div>

      {/* Widget Customizer Modal Panel */}
      <AnimatePresence>
        {isEditing && editingWidget && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-slate-700 p-6 rounded-xl w-full max-w-md text-white shadow-2xl relative"
            >
              <h2 className="text-lg font-black tracking-wider uppercase mb-4 text-[#00f0ff] flex items-center gap-1.5">
                <Settings size={18} /> Personalizar: {editingWidget.label}
              </h2>
              
              <div className="flex flex-col gap-4">
                {/* Labels */}
                <div>
                  <label className="text-xs font-bold text-gray-400 block mb-1">Título de Widget</label>
                  <input
                    type="text"
                    value={editingWidget.label}
                    onChange={(e) => updateWidgetValue(editingWidget.id, { label: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 p-2 rounded text-sm font-bold text-white uppercase focus:border-blue-500 font-sans"
                  />
                </div>

                {/* Min / Max bounds */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-gray-400 block mb-1">Mínimo</label>
                    <input
                      type="number"
                      value={editingWidget.min}
                      onChange={(e) => updateWidgetValue(editingWidget.id, { min: Number(e.target.value) })}
                      className="w-full bg-slate-800 border border-slate-700 p-2 rounded text-sm font-mono text-white focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-400 block mb-1">Máximo</label>
                    <input
                      type="number"
                      value={editingWidget.max}
                      onChange={(e) => updateWidgetValue(editingWidget.id, { max: Number(e.target.value) })}
                      className="w-full bg-slate-800 border border-slate-700 p-2 rounded text-sm font-mono text-white focus:border-blue-500"
                    />
                  </div>
                </div>

                {/* Warning thresholds */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-yellow-500 block mb-1">Alerta Alerta (Low Warning)</label>
                    <input
                      type="number"
                      value={editingWidget.warnThreshold || ''}
                      placeholder="Sin aviso"
                      onChange={(e) => updateWidgetValue(editingWidget.id, { warnThreshold: e.target.value ? Number(e.target.value) : undefined })}
                      className="w-full bg-slate-800 border border-slate-700 p-2 rounded text-sm font-mono text-white focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-red-500 block mb-1">Punto Crítico (Redline Alert)</label>
                    <input
                      type="number"
                      value={editingWidget.criticalThreshold || ''}
                      placeholder="Sin aviso"
                      onChange={(e) => updateWidgetValue(editingWidget.id, { criticalThreshold: e.target.value ? Number(e.target.value) : undefined })}
                      className="w-full bg-slate-800 border border-slate-700 p-2 rounded text-sm font-mono text-white focus:border-blue-500"
                    />
                  </div>
                </div>

                {/* Visibilidad Switch */}
                <div className="flex items-center justify-between border-t border-slate-800 pt-4 mt-2">
                  <span className="text-sm font-bold text-gray-300">Habilitar Widget</span>
                  <button
                    onClick={() => updateWidgetValue(editingWidget.id, { visible: !editingWidget.visible })}
                    className={`px-3 py-1.5 rounded font-black text-xs uppercase tracking-wider transition ${
                      editingWidget.visible
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                        : 'bg-red-500/20 text-red-400 border border-red-500/40'
                    }`}
                  >
                    {editingWidget.visible ? 'Visible' : 'Oculto'}
                  </button>
                </div>
              </div>

              <button
                onClick={() => setEditingWidget(null)}
                className="w-full mt-6 bg-[#00f0ff] hover:bg-[#00f0ff]/80 text-black font-black text-xs uppercase tracking-widest py-2.5 rounded transition"
              >
                Cerrar y Guardar
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
