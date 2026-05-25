/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { LogEntry, DTC, OBDData } from '../types';
import { Cpu, AlertTriangle, Play, Sparkles, Wand2, RefreshCw, FileText, CheckCircle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface DiagnosticsAssistantProps {
  logs: LogEntry[];
  activeDtcCodes: DTC[];
  currentEngineData: OBDData;
}

export default function DiagnosticsAssistant({ logs, activeDtcCodes, currentEngineData }: DiagnosticsAssistantProps) {
  const [selectedLogId, setSelectedLogId] = useState<string>('current-realtime');
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState(0);
  const [analysisReport, setAnalysisReport] = useState<string>('');
  const [error, setError] = useState<string>('');

  const loadingSteps = [
    'Estableciendo canal de servicio con la ECU...',
    'Extrayendo datos de sensores OBD-II en tiempo real...',
    'Consultando tabla de códigos de error DTC activos...',
    'Analizando curvas de mezcla de aire-combustible (AFR)...',
    'Evaluando pérdidas de presión de turbo y avance de chispa...',
    'Generando informe de diagnóstico predictivo con Inteligencia Artificial...',
  ];

  const triggerDiagnostic = async () => {
    setLoading(true);
    setError('');
    setAnalysisReport('');
    setLoadingStep(0);

    // Increment loading steps sequentially to simulate a highly technical workflow
    const stepInterval = setInterval(() => {
      setLoadingStep((prev) => {
        if (prev < loadingSteps.length - 1) {
          return prev + 1;
        } else {
          clearInterval(stepInterval);
          return prev;
        }
      });
    }, 1200);

    let logsPayload: any = null;

    if (selectedLogId === 'current-realtime') {
      // Create a small mock list of standard recent data points from active monitor
      logsPayload = {
        avgRpm: currentEngineData.rpm,
        maxRpm: currentEngineData.rpm,
        maxCoolant: currentEngineData.coolantTemp,
        maxBoost: currentEngineData.boost,
        avgAfr: currentEngineData.afr,
        maxIntakeTemp: currentEngineData.intakeTemp,
        maxLoad: currentEngineData.engineLoad,
        avgVoltage: currentEngineData.voltage,
        points: [currentEngineData]
      };
    } else {
      const log = logs.find(l => l.id === selectedLogId);
      if (log) {
        const pts = log.dataPoints;
        const avgRpm = Math.round(pts.reduce((s, p) => s + p.rpm, 0) / pts.length);
        const maxRpm = Math.max(...pts.map(p => p.rpm));
        const maxCoolant = Math.max(...pts.map(p => p.coolantTemp));
        const maxBoost = Math.max(...pts.map(p => p.boost));
        const avgAfr = Number((pts.reduce((s, p) => s + p.afr, 0) / pts.length).toFixed(2));
        const maxIntakeTemp = Math.max(...pts.map(p => p.intakeTemp));
        const maxLoad = Math.max(...pts.map(p => p.engineLoad));
        const avgVoltage = Number((pts.reduce((s, p) => s + p.voltage, 0) / pts.length).toFixed(1));

        // Send a representative sample to fit within token guidelines safely
        const sampleRate = Math.max(1, Math.floor(pts.length / 10)); // sample 10 points
        const sampledPoints = pts.filter((_, idx) => idx % sampleRate === 0).map(p => ({
          rpm: p.rpm,
          speed: p.speed,
          boost: p.boost,
          coolantTemp: p.coolantTemp,
          afr: p.afr,
          engineLoad: p.engineLoad,
          throttle: p.throttle,
          sparkAdvance: p.sparkAdvance
        }));

        logsPayload = {
          avgRpm,
          maxRpm,
          maxCoolant,
          maxBoost,
          avgAfr,
          maxIntakeTemp,
          maxLoad,
          avgVoltage,
          points: sampledPoints
        };
      }
    }

    try {
      const response = await fetch('/api/gemini/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          logs: logsPayload,
          activeDtcCodes,
        }),
      });

      clearInterval(stepInterval);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Fallo de comunicación del servicio de diagnóstico.');
      }

      setAnalysisReport(data.analysis || 'No se obtuvo un reporte.');
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Error al conectar con la API de IA.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-950 p-4 md:p-6 border border-white/[0.04] rounded-2xl max-w-5xl mx-auto w-full text-white flex flex-col gap-6">
      
      {/* Intro Header */}
      <div className="border-b border-white/[0.04] pb-4">
        <h2 className="text-xl font-black uppercase tracking-wider text-[#00f0ff] flex items-center gap-1.5">
          <Cpu className="animate-pulse" size={19} /> Asistente de Diagnóstico con IA
        </h2>
        <p className="text-xs text-gray-400 mt-1">
          Utiliza Gemini AI para analizar códigos de falla (DTC), mezclas y termodinámica del motor.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* SETTINGS PANEL - 1 Col */}
        <div className="md:col-span-1 bg-slate-900/60 p-4 rounded-xl border border-slate-800 flex flex-col gap-4">
          <span className="text-xs font-black tracking-widest text-blue-400 uppercase block">
            Configuración de Diagnóstico
          </span>

          <div className="flex flex-col gap-3">
            <div>
              <label className="text-xs font-bold text-gray-400 block mb-1">Origen de Datos:</label>
              <select
                value={selectedLogId}
                onChange={(e) => setSelectedLogId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 focus:border-[#00f0ff] p-2 rounded text-xs text-white font-bold outline-none"
              >
                <option value="current-realtime">Telemetría en Vivo (Actual)</option>
                {logs.map((log) => (
                  <option key={log.id} value={log.id}>
                    {log.name} ({log.duration}s registrados)
                  </option>
                ))}
              </select>
            </div>

            {/* Quick stats summarizing current state to diagnostic */}
            <div className="bg-slate-950 p-3 rounded border border-slate-900/40 text-[11px] flex flex-col gap-2">
              <span className="text-gray-500 font-bold uppercase tracking-wider block">Estadísticas de Carga</span>
              
              <div className="flex justify-between font-mono">
                <span className="text-gray-400">Códigos Activos:</span>
                <span className={activeDtcCodes.length > 0 ? 'text-red-400 font-bold' : 'text-emerald-400 font-bold'}>
                  {activeDtcCodes.length} DTC
                </span>
              </div>
              <div className="flex justify-between font-mono">
                <span className="text-gray-400">RPM:</span>
                <span className="text-[#00f0ff]">{currentEngineData.rpm} rpm</span>
              </div>
              <div className="flex justify-between font-mono">
                <span className="text-gray-400">Presión Boost:</span>
                <span className="text-red-400">{currentEngineData.boost} psi</span>
              </div>
              <div className="flex justify-between font-mono">
                <span className="text-gray-400">Temp Motor ECT:</span>
                <span className="text-amber-500">{currentEngineData.coolantTemp} °C</span>
              </div>
            </div>

            {/* RUN ACTION TRIGGER */}
            <button
              onClick={triggerDiagnostic}
              disabled={loading}
              className={`w-full py-2.5 rounded-xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${
                loading
                  ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                  : 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-black shadow-lg shadow-cyan-500/20'
              }`}
            >
              {loading ? (
                <>
                  <RefreshCw className="animate-spin" size={14} /> Analizando...
                </>
              ) : (
                <>
                  <Sparkles size={14} /> Solicitar Diagnóstico
                </>
              )}
            </button>
          </div>
        </div>

        {/* RESULTS SCREEN - 2 Cols */}
        <div className="md:col-span-2 min-h-[300px] flex flex-col">
          
          {loading && (
            <div className="flex-1 flex flex-col items-center justify-center p-8 bg-slate-900/40 border border-slate-800 rounded-xl text-center">
              <div className="relative w-16 h-16 mb-4 flex items-center justify-center">
                {/* Visual orbital loader */}
                <span className="absolute animate-ping inline-flex h-12 w-12 rounded-full bg-cyan-400 opacity-20"></span>
                <Sparkles size={28} className="text-[#00f0ff] animate-pulse" />
              </div>
              <h4 className="text-sm font-black uppercase text-gray-200 tracking-wide mb-1">
                Procesando Telemetría con Inteligencia Artificial
              </h4>
              <p className="text-xs text-cyan-400 transition-all font-mono">
                {loadingSteps[loadingStep]}
              </p>
            </div>
          )}

          {error && (
            <div className="flex-1 p-6 bg-red-500/5 border border-red-500/20 rounded-xl flex flex-col gap-3 justify-center items-center text-center">
              <AlertTriangle className="text-red-500" size={36} />
              <div>
                <span className="text-sm font-black uppercase text-red-400 block mb-1">Error de Diagnóstico Automotriz</span>
                <p className="text-xs text-gray-300 max-w-sm">{error}</p>
              </div>
              <button
                onClick={triggerDiagnostic}
                className="mt-2 text-xs font-bold text-white bg-red-600 hover:bg-red-500 px-4 py-2 rounded-lg"
              >
                Reintentar Análisis
              </button>
            </div>
          )}

          {!loading && !error && !analysisReport && (
            <div className="flex-1 p-8 text-center border border-dashed border-slate-800 rounded-xl bg-slate-900/10 flex flex-col justify-center items-center">
              <Wand2 className="mb-3 text-[#00f0ff]/40 animate-pulse" size={38} />
              <h4 className="text-sm font-black uppercase text-gray-300 tracking-wider mb-2">
                Listo para Escanear
              </h4>
              <p className="text-xs text-gray-500 max-w-sm leading-relaxed">
                Selecciona la fuente de datos (telemetría actual o un log de viaje guardado en el dispositivo) y genera un diagnóstico experto instantáneo de fallas y afinamiento con el motor de IA de Google Gemini.
              </p>
            </div>
          )}

          {!loading && !error && analysisReport && (
            <div className="flex-1 bg-slate-900/40 border border-slate-800 rounded-xl p-5 md:p-6 overflow-y-auto max-h-[500px] text-gray-200">
              
              <div className="flex items-center gap-2 border-b border-slate-800 pb-3 mb-4 text-xs font-bold font-mono text-emerald-400">
                <CheckCircle size={14} /> Reporte de Diagnóstico con IA Generado Exitosamente
              </div>

              {/* MD Render container */}
              <div className="markdown-body text-sm leading-relaxed text-gray-300 space-y-4 prose prose-invert prose-cyan max-w-none">
                <ReactMarkdown>{analysisReport}</ReactMarkdown>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
