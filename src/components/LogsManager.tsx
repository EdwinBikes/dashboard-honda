/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { OBDData, LogEntry } from '../types';
import { Play, Square, Trash2, Download, FileText, Activity, Layers, ArrowUpRight, TrendingUp, ChevronDown, ChevronUp } from 'lucide-react';

interface LogsManagerProps {
  logs: LogEntry[];
  setLogs: (logs: LogEntry[] | ((prev: LogEntry[]) => LogEntry[])) => void;
  isLogging: boolean;
  setIsLogging: (v: boolean) => void;
  currentLogData: OBDData[];
  setCurrentLogData: (v: OBDData[] | ((prev: OBDData[]) => OBDData[])) => void;
  activeData: OBDData;
}

export default function LogsManager({ logs, setLogs, isLogging, setIsLogging, currentLogData, setCurrentLogData, activeData }: LogsManagerProps) {
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);
  const [activeParamTab, setActiveParamTab] = useState<'rpm-boost' | 'temp-iat' | 'tps-load'>('rpm-boost');

  const startLogging = () => {
    setIsLogging(true);
    setCurrentLogData([activeData]);
  };

  const stopLogging = () => {
    setIsLogging(false);
    if (currentLogData.length < 3) {
      alert('La sesión de registro es demasiado corta, intenta registrar al menos algunos segundos de telemetría.');
      setCurrentLogData([]);
      return;
    }

    const duration = Math.round((currentLogData[currentLogData.length - 1].timestamp - currentLogData[0].timestamp) / 1000);
    const newEntry: LogEntry = {
      id: Math.random().toString(36).substring(2, 9),
      name: `Registro Telemetría #${logs.length + 1} (${new Date().toLocaleTimeString()})`,
      date: new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }),
      duration: duration > 0 ? duration : 1,
      dataPoints: [...currentLogData]
    };

    const updated = [newEntry, ...logs];
    setLogs(updated);
    localStorage.setItem('ecu_logs_recorded', JSON.stringify(updated));
    setCurrentLogData([]);
  };

  const deleteLog = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('¿Eliminar de forma permanente este registro de telemetría de la memoria del dispositivo?')) {
      const next = logs.filter(l => l.id !== id);
      setLogs(next);
      localStorage.setItem('ecu_logs_recorded', JSON.stringify(next));
      if (selectedLogId === id) setSelectedLogId(null);
    }
  };

  const clearLogs = () => {
    if (confirm('¿Borrar absolutamente todos los registros guardados?')) {
      setLogs([]);
      localStorage.removeItem('ecu_logs_recorded');
      setSelectedLogId(null);
    }
  };

  const exportCSV = (log: LogEntry, e: React.MouseEvent) => {
    e.stopPropagation();
    const headers = ['Tiempo(ms)', 'RPM', 'Temp_ECT(C)', 'Velocidad(kmh)', 'Carga_Motor(%)', 'Mariposa_TPS(%)', 'Boost_PSI', 'Temp_IAT(C)', 'Spark_Adv', 'Voltaje_V', 'Aire_Comb_AFR'];
    const rows = log.dataPoints.map((p, idx) => {
      const timeOffset = p.timestamp - log.dataPoints[0].timestamp;
      return [
        timeOffset,
        p.rpm,
        p.coolantTemp,
        p.speed,
        p.engineLoad,
        p.throttle,
        p.boost,
        p.intakeTemp,
        p.sparkAdvance,
        p.voltage,
        p.afr
      ].join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${log.name.toLowerCase().replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const selectedLog = logs.find(l => l.id === selectedLogId);

  // SVG customized plot mathematics
  const renderCustomSVGChart = (log: LogEntry) => {
    const pts = log.dataPoints;
    const width = 800;
    const height = 240;
    const padding = 40;

    const maxPoints = pts.length;
    
    // Choose parameters to plot based on tab
    let param1: 'rpm' | 'coolantTemp' | 'throttle' = 'rpm';
    let label1 = 'RPM';
    let color1 = '#00f0ff';
    let maxVal1 = Math.max(...pts.map(p => Number(p[param1] ?? 0)), 4000);
    let minVal1 = 0;

    let param2: 'boost' | 'intakeTemp' | 'engineLoad' = 'boost';
    let label2 = 'Pre - Boost';
    let color2 = '#ff003c';
    let maxVal2 = Math.max(...pts.map(p => Number(p[param2] ?? 0)), 10);
    // boost can be negative (vacuum)
    let minVal2 = Math.min(...pts.map(p => Number(p[param2] ?? 0)), -10);

    if (activeParamTab === 'temp-iat') {
      param1 = 'coolantTemp';
      label1 = 'ECT Temp (°C)';
      color1 = '#ff8800';
      maxVal1 = Math.max(...pts.map(p => p.coolantTemp), 100);
      minVal1 = 0;

      param2 = 'intakeTemp';
      label2 = 'IAT Temp (°C)';
      color2 = '#00ff55';
      maxVal2 = Math.max(...pts.map(p => p.intakeTemp), 50);
      minVal2 = 0;
    } else if (activeParamTab === 'tps-load') {
      param1 = 'throttle';
      label1 = 'TPS / Mariposa (%)';
      color1 = '#eab308';
      maxVal1 = 100;
      minVal1 = 0;

      param2 = 'engineLoad';
      label2 = 'Carga Motor (%)';
      color2 = '#a855f7';
      maxVal2 = 100;
      minVal2 = 0;
    }

    const getX = (index: number) => {
      return padding + (index / (maxPoints - 1)) * (width - padding * 2);
    };

    const getY1 = (value: number) => {
      const scale = (height - padding * 2) / (maxVal1 - minVal1);
      return height - padding - (value - minVal1) * scale;
    };

    const getY2 = (value: number) => {
      const scale = (height - padding * 2) / (maxVal2 - minVal2);
      return height - padding - (value - minVal2) * scale;
    };

    // Calculate paths
    let pathD1 = '';
    let pathD2 = '';

    pts.forEach((p, index) => {
      const x = getX(index);
      const y1 = getY1(Number(p[param1]));
      const y2 = getY2(Number(p[param2]));

      if (index === 0) {
        pathD1 = `M ${x} ${y1}`;
        pathD2 = `M ${x} ${y2}`;
      } else {
        pathD1 += ` L ${x} ${y1}`;
        pathD2 += ` L ${x} ${y2}`;
      }
    });

    return (
      <div className="bg-slate-950/80 p-4 border border-slate-800 rounded-xl relative overflow-hidden">
        {/* Param Toggle Tabs */}
        <div className="flex gap-2 mb-3 border-b border-slate-900 pb-2 text-xs">
          <button
            onClick={() => setActiveParamTab('rpm-boost')}
            className={`px-3 py-1 rounded-md font-bold uppercase ${
              activeParamTab === 'rpm-boost' ? 'bg-slate-800 text-[#00f0ff]' : 'text-gray-400 hover:text-white'
            }`}
          >
            RPM vs Boost
          </button>
          <button
            onClick={() => setActiveParamTab('temp-iat')}
            className={`px-3 py-1 rounded-md font-bold uppercase ${
              activeParamTab === 'temp-iat' ? 'bg-slate-800 text-orange-400' : 'text-gray-400 hover:text-white'
            }`}
          >
            ECT vs IAT Temp
          </button>
          <button
            onClick={() => setActiveParamTab('tps-load')}
            className={`px-3 py-1 rounded-md font-bold uppercase ${
              activeParamTab === 'tps-load' ? 'bg-slate-800 text-yellow-400' : 'text-gray-400 hover:text-white'
            }`}
          >
            TPS vs Carga %
          </button>
        </div>

        {/* Legend */}
        <div className="flex gap-5 text-xs font-mono font-bold mb-4">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-1 rounded" style={{ backgroundColor: color1 }} />
            <span className="text-gray-300">{label1} (Min: {minVal1.toFixed(0)}, Max: {maxVal1.toFixed(0)})</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-1 rounded" style={{ backgroundColor: color2 }} />
            <span className="text-gray-300">{label2} (Min: {minVal2.toFixed(1)}, Max: {maxVal2.toFixed(1)})</span>
          </div>
        </div>

        {/* SVG Drawing Canvas */}
        <div className="w-full overflow-x-auto">
          <svg className="w-full min-w-[700px] h-64 select-none">
            {/* Draw Horizontal Grid Lines */}
            {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
              const y = padding + ratio * (height - padding * 2);
              const gridVal1 = maxVal1 - ratio * (maxVal1 - minVal1);
              const gridVal2 = maxVal2 - ratio * (maxVal2 - minVal2);

              return (
                <g key={i} className="opacity-30">
                  <line x1={padding} y1={y} x2={width - padding} y2={y} stroke="#334155" strokeWidth="1" strokeDasharray="4 2" />
                  {/* Left Parameter Axis text */}
                  <text x={padding - 6} y={y + 3} textAnchor="end" fill={color1} className="text-[10px] font-mono font-extrabold">
                    {Math.round(gridVal1)}
                  </text>
                  {/* Right Parameter Axis text */}
                  <text x={width - padding + 6} y={y + 3} textAnchor="start" fill={color2} className="text-[10px] font-mono font-extrabold">
                    {gridVal2.toFixed(1)}
                  </text>
                </g>
              );
            })}

            {/* Time labels axis at bottom */}
            <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#334155" strokeWidth="1" />
            
            <g className="opacity-40">
              {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
                const x = padding + ratio * (width - padding * 2);
                const timeStr = `${Math.round(ratio * log.duration)}s`;
                return (
                  <g key={i}>
                    <line x1={x} y1={height - padding} x2={x} y2={height - padding + 5} stroke="#64748b" strokeWidth="1" />
                    <text x={x} y={height - padding + 16} textAnchor="middle" fill="#94a3b8" className="text-[9px] font-mono leading-none">
                      {timeStr}
                    </text>
                  </g>
                );
              })}
            </g>

            {/* Plot Lines */}
            <path d={pathD1} fill="transparent" stroke={color1} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d={pathD2} fill="transparent" stroke={color2} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-slate-950 p-4 md:p-6 border border-white/[0.04] rounded-2xl max-w-5xl mx-auto w-full text-white flex flex-col gap-6">
      
      {/* Logger Recorder Controller */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-900/60 p-4 rounded-xl border border-white/[0.02]">
        <div>
          <h3 className="text-sm font-black uppercase tracking-widest text-[#00f0ff] flex items-center gap-1.5">
            <Activity className={isLogging ? 'text-red-500 animate-pulse' : 'text-gray-400'} size={16} /> Grabadora de Logs en Tiempo Real
          </h3>
          <p className="text-xs text-gray-400 mt-1">
            Guarda flujos enteros de telemetría de motor directamente en la memoria local (IndexedDB) para realizar diagnósticos.
          </p>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto shrink-0">
          {isLogging ? (
            <div className="flex items-center gap-3 w-full justify-between md:justify-end">
              <span className="text-xs font-mono font-bold text-red-400 animate-pulse">
                REGISTRANDO MUESTRAS: <span className="underline font-black">{currentLogData.length}</span> pts
              </span>
              <button
                onClick={stopLogging}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 rounded-lg text-xs font-black uppercase tracking-wider flex items-center gap-1.5 text-white shadow-lg shadow-red-500/10"
              >
                <Square size={13} fill="currentColor" /> Detener y Guardar
              </button>
            </div>
          ) : (
            <button
              onClick={startLogging}
              className="px-5 py-2.5 bg-cyan-500 hover:bg-cyan-400 rounded-lg text-xs font-black text-black uppercase tracking-widest flex items-center gap-1.5 w-full md:w-auto justify-center shadow-lg shadow-cyan-500/20"
            >
              <Play size={13} fill="currentColor" /> Grabar Telemetría
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* LOGS HISTORICAL LIST - 5 Cols */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          <div className="flex justify-between items-center bg-[#090F1E]/30 p-2 px-3 rounded-lg border border-blue-500/[0.06]">
            <span className="text-xs font-black uppercase tracking-widest text-blue-400">
              Registros Almacenados ({logs.length})
            </span>
            {logs.length > 0 && (
              <button
                onClick={clearLogs}
                className="text-gray-500 hover:text-red-400 text-[10px] font-bold uppercase transition"
              >
                Eliminar Todo
              </button>
            )}
          </div>

          {logs.length === 0 ? (
            <div className="p-8 text-center border border-dashed border-slate-800 rounded-xl bg-slate-900/10 text-gray-500">
              <FileText className="mx-auto mb-2 opacity-25" size={32} />
              <span className="text-xs font-bold uppercase block mb-1">Cero Historial</span>
              No hay logs guardados. Presiona Grabación anterior para iniciar un viaje.
            </div>
          ) : (
            <div className="flex flex-col gap-2 max-h-[400px] overflow-y-auto pr-1">
              {logs.map((log) => {
                const maxRpmVal = Math.max(...log.dataPoints.map(p => p.rpm));
                const maxCoolantVal = Math.max(...log.dataPoints.map(p => p.coolantTemp));
                const maxBoostVal = Math.max(...log.dataPoints.map(p => p.boost));
                const isSelected = selectedLogId === log.id;

                return (
                  <div
                    key={log.id}
                    onClick={() => setSelectedLogId(isSelected ? null : log.id)}
                    className={`p-3.5 rounded-xl border text-left cursor-pointer transition select-none ${
                      isSelected
                        ? 'bg-[#090F1E] border-cyan-500/60 shadow-lg shadow-cyan-500/5'
                        : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex flex-col">
                        <span className="text-xs font-black uppercase text-gray-200 leading-snug line-clamp-1">{log.name}</span>
                        <span className="text-[10px] text-gray-500 font-bold font-sans mt-0.5">{log.date} | Duración: {log.duration}s</span>
                      </div>
                      
                      {/* Delete / Download direct buttons */}
                      <div className="flex items-center gap-1 shrink-0 ml-2">
                        <button
                          onClick={(e) => exportCSV(log, e)}
                          className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-gray-400 hover:text-cyan-400"
                          title="Exportar a Archivo CSV para Excel/KTuner"
                        >
                          <Download size={11} />
                        </button>
                        <button
                          onClick={(e) => deleteLog(log.id, e)}
                          className="p-1.5 rounded bg-slate-800 hover:bg-red-500/20 text-gray-500 hover:text-red-400"
                          title="Eliminar de memoria"
                        >
                          <Trash2 size={11} />
                        </button>
                      </div>
                    </div>

                    {/* Show mini summary telemetry tags */}
                    <div className="grid grid-cols-3 gap-1.5 mt-2.5 pt-2 border-t border-slate-800">
                      <div className="bg-slate-950 p-1 rounded text-center">
                        <span className="text-[8px] text-gray-500 uppercase block leading-none font-bold">RPM Máx</span>
                        <span className="text-[10px] font-mono text-cyan-400 font-extrabold">{maxRpmVal}</span>
                      </div>
                      <div className="bg-slate-950 p-1 rounded text-center">
                        <span className="text-[8px] text-gray-500 uppercase block leading-none font-bold">Temp ECT</span>
                        <span className="text-[10px] font-mono text-amber-500 font-extrabold">{maxCoolantVal}°C</span>
                      </div>
                      <div className="bg-slate-950 p-1 rounded text-center">
                        <span className="text-[8px] text-gray-500 uppercase block leading-none font-bold">Boost Máx</span>
                        <span className="text-[10px] font-mono text-red-400 font-extrabold">{maxBoostVal.toFixed(1)}p</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* LOG VIEWER CHART BOARD - 7 Cols */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4.5 min-h-[432px] flex flex-col justify-center">
            {selectedLog ? (
              <div className="flex flex-col gap-4">
                <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                  <div>
                    <h4 className="text-sm font-black uppercase text-cyan-400">{selectedLog.name}</h4>
                    <span className="text-[10px] text-gray-400 mt-0.5 block font-bold">Análisis temporal de curvas de rendimiento obtenido por ECU</span>
                  </div>
                  
                  <div className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1 rounded text-[10px] font-mono font-bold border border-slate-800">
                    <TrendingUp size={11} className="text-[#00f0ff]" /> {selectedLog.dataPoints.length} Muestras
                  </div>
                </div>

                {/* Plot component */}
                {renderCustomSVGChart(selectedLog)}

                {/* Complete numeric values array info */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                  <div className="bg-slate-950 p-2 rounded-lg border border-slate-800">
                    <span className="text-[9px] text-gray-500 uppercase block font-bold mb-1">Promedio RPM</span>
                    <span className="font-mono text-cyan-400 font-black">
                      {Math.round(selectedLog.dataPoints.reduce((s, p) => s + p.rpm, 0) / selectedLog.dataPoints.length)} rpm
                    </span>
                  </div>
                  <div className="bg-slate-950 p-2 rounded-lg border border-slate-800">
                    <span className="text-[9px] text-gray-500 uppercase block font-bold mb-1">ECT de Motor Prom</span>
                    <span className="font-mono text-amber-400 font-black">
                      {(selectedLog.dataPoints.reduce((s, p) => s + p.coolantTemp, 0) / selectedLog.dataPoints.length).toFixed(1)} °C
                    </span>
                  </div>
                  <div className="bg-slate-950 p-2 rounded-lg border border-slate-800">
                    <span className="text-[9px] text-gray-500 uppercase block font-bold mb-1">Voltaje Batería</span>
                    <span className="font-mono text-indigo-400 font-black">
                      {(selectedLog.dataPoints.reduce((s, p) => s + p.voltage, 0) / selectedLog.dataPoints.length).toFixed(1)} V
                    </span>
                  </div>
                  <div className="bg-slate-950 p-2 rounded-lg border border-slate-800">
                    <span className="text-[9px] text-gray-500 uppercase block font-bold mb-1">Mezcla AFR Prom</span>
                    <span className="font-mono text-emerald-400 font-black">
                      {(selectedLog.dataPoints.reduce((s, p) => s + p.afr, 0) / selectedLog.dataPoints.length).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center text-gray-500 p-8">
                <Activity className="mx-auto mb-3 opacity-25 text-[#00f0ff]" size={42} />
                <span className="text-xs font-bold uppercase block text-gray-400 mb-1">Graficador de Curvas de Telemetría</span>
                Selecciona cualquier registro de la lista de la izquierda para desplegar y analizar detalladamente el gráfico de datos de sensores.
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
