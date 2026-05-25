/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { OBDData, DTC } from '../types';
import { Play, Pause, RotateCcw, Flame, CheckCircle2, AlertTriangle, Zap } from 'lucide-react';

interface DriveSimulatorProps {
  data: OBDData;
  setData: (data: OBDData | ((prev: OBDData) => OBDData)) => void;
  activeDtcCodes: DTC[];
  setActiveDtcCodes: (dtc: DTC[] | ((prev: DTC[]) => DTC[])) => void;
  isLogging: boolean;
}

// Available OBD DTC codes standard set for simulation
const DEMO_DTC_CODES: DTC[] = [
  { code: 'P0113', description: 'Voltaje alto en sensor de temperatura del aire de admisión (IAT)', system: 'Motor', severity: 'Media' },
  { code: 'P0118', description: 'Circuito de sensor de temperatura del refrigerante alto (ECT)', system: 'Motor', severity: 'Alta' },
  { code: 'P0234', description: 'Condición de sobrepresión del turbocargador (Overboost)', system: 'Motor', severity: 'Alta' },
  { code: 'P0171', description: 'Sistema demasiado pobre - Banco 1 (Fuga de Vacío o inyectores tapados)', system: 'Emisiones', severity: 'Media' },
  { code: 'P0300', description: 'Detección de falla de encendido en cilindro aleatorio (Misfire)', system: 'Motor', severity: 'Alta' },
  { code: 'P0562', description: 'Voltaje del sistema demasiado bajo (Alternador o Batería)', system: 'Eléctrico', severity: 'Baja' },
];

export default function DriveSimulator({ data, setData, activeDtcCodes, setActiveDtcCodes, isLogging }: DriveSimulatorProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isAutoLap, setIsAutoLap] = useState(false);
  const [autoSeconds, setAutoSeconds] = useState(0);

  // Manual values state
  const [accelThrottle, setAccelThrottle] = useState(0);

  // Manage Auto Lap track playback simulation
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isPlaying) {
      timer = setInterval(() => {
        setAutoSeconds(prev => prev + 0.1);
      }, 100);
    }
    return () => clearInterval(timer);
  }, [isPlaying]);

  // Compute telemetry based on simulation state
  useEffect(() => {
    if (!isPlaying) return;

    if (isAutoLap) {
      // Simulate continuous hot lap cycle on a race track
      const cycle = autoSeconds % 20; // 20-second mock lap segment
      let simulatedRpm = 1000;
      let simulatedSpeed = 0;
      let simulatedLoad = 15;
      let simulatedBoost = -12.0;
      let simulatedTps = 0;
      let simulatedAfr = 14.7;

      if (cycle < 4) { // Launch / Heavy Acceleration Phase
        simulatedTps = 95;
        simulatedLoad = 90;
        simulatedRpm = 1200 + (cycle * 1300); // 1.2k -> 6.4k RPM
        simulatedSpeed = Math.round(cycle * 30); // 0 -> 120 km/h
        simulatedBoost = -2.0 + (cycle * 5.5); // vacuum -> +20psi boost
        simulatedAfr = 11.8; // Rich engine mix under load
      } else if (cycle < 5) { // Gear shift pause (dump valve dumps boost!)
        simulatedTps = 5;
        simulatedLoad = 10;
        simulatedRpm = 3800;
        simulatedSpeed = 120;
        simulatedBoost = -8.0; // Blowoff valve dump pressure
        simulatedAfr = 15.5; // momentarily lean
      } else if (cycle < 10) { // High Speed Back straightaway pull
        simulatedTps = 100;
        simulatedLoad = 98;
        simulatedRpm = 4000 + ((cycle - 5) * 650); // 4.0k -> 7.25k RPM redline
        simulatedSpeed = Math.round(120 + ((cycle - 5) * 18)); // 120 -> 210 km/h
        simulatedBoost = 22.5; // Max stable target tuner boost!
        simulatedAfr = 11.2; // optimal safe rich target AFR under boost
      } else if (cycle < 13) { // High Temp braking cornering phase
        simulatedTps = 0;
        simulatedLoad = 5;
        simulatedRpm = 2500;
        simulatedSpeed = Math.round(210 - ((cycle - 10) * 45)); // Heavy brakes 210 -> 75 km/h
        simulatedBoost = -14.2; // deep throttle vacuum
        simulatedAfr = 17.0; // Fuel cut deceleration lean spike (DFCO)
      } else { // Moderate throttle exit corner acceleration
        simulatedTps = 45;
        simulatedLoad = 50;
        simulatedRpm = 2800 + ((cycle - 13) * 350); // 2.8k -> 5.2k RPM
        simulatedSpeed = Math.round(75 + ((cycle - 13) * 12));
        simulatedBoost = 6.0; // low boost response back on gas
        simulatedAfr = 13.5;
      }

      // Add simple temperature updates over long runs
      setData(prev => {
        const tempIncrease = simulatedLoad > 70 ? 0.12 : -0.06;
        const newTemp = Math.max(82, Math.min(115, prev.coolantTemp + tempIncrease));
        const newIat = Math.max(28, Math.min(65, prev.intakeTemp + (simulatedBoost > 12 ? 0.3 : -0.15)));
        
        let spark = 15;
        if (simulatedTps < 10) spark = 32; // decelerating spark advance
        else if (simulatedBoost > 10) spark = 12 - (simulatedBoost * 0.4); // pull timing under boost to avoid knock!
        else spark = 22 + (simulatedRpm / 1100);

        const rawInjector = 1.3 + (simulatedLoad * 0.08) * (simulatedRpm / 2200);
        const finalInjector = Number(Math.max(1.0, Math.min(24.0, rawInjector)).toFixed(2));
        const finalMap = Math.round((simulatedBoost / 0.01450377) + 1013);

        return {
          timestamp: Date.now(),
          rpm: Math.round(simulatedRpm),
          coolantTemp: Number(newTemp.toFixed(1)),
          speed: Math.round(simulatedSpeed),
          engineLoad: Math.round(simulatedLoad),
          throttle: Math.round(simulatedTps),
          boost: Number(simulatedBoost.toFixed(1)),
          intakeTemp: Number(newIat.toFixed(1)),
          sparkAdvance: Number(spark.toFixed(1)),
          voltage: Number((13.8 + Math.sin(autoSeconds * 0.2) * 0.2).toFixed(1)),
          afr: Number(simulatedAfr.toFixed(2)),
          injector: finalInjector,
          map: finalMap,
        };
      });
    } else {
      // Manual Sliders Driver Simulation logic
      setData(prev => {
        const targetRpm = 850 + (accelThrottle * 68); // 850 idle -> 7650 Redline max
        const rpmDeltas = targetRpm - prev.rpm;
        const currentRpm = Math.round(prev.rpm + (rpmDeltas * 0.25)); // Smooth RPM response

        const targetSpeed = Math.round(accelThrottle * 2.2); // 0 -> 220 km/h
        const currentSpeed = Math.round(prev.speed + (targetSpeed - prev.speed) * 0.08);

        // Boost follows throttle and RPM
        let targetBoost = -14.7;
        if (accelThrottle > 10) {
          // vacuum rises to positive boost proportional to gas throttle position
          targetBoost = -12.0 + (accelThrottle * 0.38);
        }
        const currentBoost = Number((prev.boost + (targetBoost - prev.boost) * 0.18).toFixed(1));

        // AFR rich when accelerating, lean when decelerating, stable idle at 14.7
        let targetAfr = 14.7;
        if (accelThrottle > 75) targetAfr = 11.9; // Rich on floor WOT
        else if (accelThrottle > 30) targetAfr = 13.2; // partial throttle acceleration
        else if (accelThrottle === 0 && currentRpm > 1200) targetAfr = 17.5; // Decel Fuel cutoff

        const currentAfr = Number((prev.afr + (targetAfr - prev.afr) * 0.2).toFixed(2));

        // Spark timing
        const spark = accelThrottle > 80 ? 14 : Math.round(24 + (currentRpm / 2500));

        // Heat builds based on throttle
        const heatShift = accelThrottle > 60 ? 0.05 : -0.02;
        const currentTemp = Math.max(86, Math.min(108, prev.coolantTemp + heatShift));

        const rawInjector = 1.3 + (accelThrottle * 0.08) * (currentRpm / 2200);
        const finalInjector = Number(Math.max(1.0, Math.min(24.0, rawInjector)).toFixed(2));
        const finalMap = Math.round((currentBoost / 0.01450377) + 1013);

        return {
          timestamp: Date.now(),
          rpm: currentRpm,
          coolantTemp: Number(currentTemp.toFixed(1)),
          speed: currentSpeed,
          engineLoad: Math.round(accelThrottle * 0.9 + 5),
          throttle: Math.round(accelThrottle),
          boost: currentBoost,
          intakeTemp: Math.max(30, Math.min(52, prev.intakeTemp + (currentBoost > 8 ? 0.05 : -0.02))),
          sparkAdvance: spark,
          voltage: Number((14.1 - (accelThrottle > 80 ? 0.4 : 0)).toFixed(1)), // minor voltage drop under peak current
          afr: currentAfr,
          injector: finalInjector,
          map: finalMap,
        };
      });
    }
  }, [isPlaying, autoSeconds, isAutoLap, accelThrottle]);

  const toggleDtc = (dtc: DTC) => {
    setActiveDtcCodes(prev => {
      const exists = prev.some(d => d.code === dtc.code);
      if (exists) {
        return prev.filter(d => d.code !== dtc.code);
      } else {
        return [...prev, dtc];
      }
    });
  };

  const clearAllDtcs = () => {
    setActiveDtcCodes([]);
  };

  return (
    <div className="bg-slate-950 p-4 md:p-6 border border-white/[0.04] rounded-2xl max-w-5xl mx-auto w-full text-white flex flex-col gap-6">
      <div className="flex flex-col md:flex-row justify-between md:items-center gap-4 border-b border-white/[0.04] pb-4">
        <div>
          <h2 className="text-xl font-black uppercase tracking-wider text-[#00f0ff] flex items-center gap-1.5">
            <Zap className="animate-pulse" size={19} /> Simulador Activo de Telemetría
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            Simula un flujo en tiempo real de códigos OBD2 y telemetría de motor para probar tu tablero.
          </p>
        </div>
        
        {/* Playback Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setIsPlaying(!isPlaying);
              if (isAutoLap && !isPlaying) {
                // reset lap when launching
                setAutoSeconds(0);
              }
            }}
            className={`px-5 py-2 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 transition-all ${
              isPlaying
                ? 'bg-amber-500 text-black hover:bg-amber-400'
                : 'bg-emerald-500 text-black shadow-lg shadow-emerald-500/20 hover:bg-emerald-400'
            }`}
          >
            {isPlaying ? (
              <>
                <Pause size={14} /> Pausar Simulación
              </>
            ) : (
              <>
                <Play size={14} /> Iniciar Generador
              </>
            )}
          </button>
          
          <button
            onClick={() => {
              setIsPlaying(false);
              setIsAutoLap(false);
              setAutoSeconds(0);
              setData({
                timestamp: Date.now(),
                rpm: 850,
                coolantTemp: 84,
                speed: 0,
                engineLoad: 12,
                throttle: 0,
                boost: -11.5,
                intakeTemp: 32,
                sparkAdvance: 18,
                voltage: 14.1,
                afr: 14.7,
                injector: 1.8,
                map: 220,
              });
            }}
            className="p-2.5 bg-slate-800 border border-slate-700 rounded-xl text-gray-400 hover:text-white"
            title="Restablecer valores de fábrica"
          >
            <RotateCcw size={15} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* SIMULATOR MODE SELECTOR */}
        <div className="flex flex-col gap-5 bg-[#090F1E]/50 border border-blue-500/[0.08] p-4.5 rounded-xl">
          <span className="text-xs font-black tracking-widest uppercase text-blue-400 mb-2 block">
            Seleccionar Tipo de Prueba
          </span>
          
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => {
                setIsAutoLap(false);
                setAccelThrottle(0);
              }}
              className={`p-3 rounded-lg border text-left flex flex-col gap-1 transition-all ${
                !isAutoLap
                  ? 'bg-blue-500/10 border-blue-500 text-blue-300'
                  : 'bg-slate-900 border-slate-800 text-gray-500 hover:border-slate-700'
              }`}
            >
              <span className="text-xs font-black uppercase tracking-wider">Marcación Manual</span>
              <span className="text-[10px] text-gray-400">Controla el acelerador de forma manual con barra de rango.</span>
            </button>
            
            <button
              onClick={() => {
                setIsAutoLap(true);
                if (!isPlaying) setIsPlaying(true);
                setAutoSeconds(0);
              }}
              className={`p-3 rounded-lg border text-left flex flex-col gap-1 transition-all ${
                isAutoLap
                  ? 'bg-blue-500/10 border-blue-500 text-blue-300'
                  : 'bg-slate-900 border-slate-800 text-gray-500 hover:border-slate-700'
              }`}
            >
              <span className="text-xs font-black uppercase tracking-wider flex items-center gap-1.5">
                <Flame size={11} className="text-orange-400 animate-pulse" /> Lap de Redline
              </span>
              <span className="text-[10px] text-gray-400">Genera cambios automáticos, presión y ciclos de pista en circuito.</span>
            </button>
          </div>

          {/* MANUAL SIMULATION RANGES */}
          {!isAutoLap ? (
            <div className="flex flex-col gap-4 mt-2 bg-slate-900/40 p-3 rounded-lg border border-white/[0.02]">
              <div>
                <div className="flex justify-between items-center text-xs font-bold font-sans text-gray-300 mb-1">
                  <span>Presión de Aceleración / TPS:</span>
                  <span className="font-mono text-emerald-400 font-extrabold">{accelThrottle}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={accelThrottle}
                  onChange={(e) => {
                    setAccelThrottle(Number(e.target.value));
                    if (!isPlaying) setIsPlaying(true);
                  }}
                  className="w-full accent-[#00f0ff] bg-slate-800 rounded-lg h-1.5 outline-none cursor-pointer"
                />
                <div className="flex justify-between text-[9px] text-gray-500 mt-1 font-mono font-bold">
                  <span>Ralentí (0%)</span>
                  <span>Acelerador a Fondo (100% WOT)</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-slate-900/60 p-4 rounded-lg border border-slate-800 text-center font-mono text-xs">
              <span className="text-gray-400 block mb-1">Duración del Circuito Activo:</span>
              <span className="text-2xl font-black text-blue-400 leading-none">
                {autoSeconds.toFixed(1)}s
              </span>
              <div className="flex justify-center items-center gap-3 mt-3">
                <span className="text-[10px] uppercase text-gray-500 font-sans tracking-widest font-bold">
                  Punto del Circuito:
                </span>
                <span className="text-xs font-black text-amber-500 font-sans uppercase">
                  {autoSeconds % 20 < 4 ? 'ARRANQUE Y BOOST MAX' :
                   autoSeconds % 20 < 5 ? 'CAMBIO DE MARCHA (DUMP)' :
                   autoSeconds % 20 < 10 ? 'RECTA DE ALTA VELOCIDAD REDLINE' :
                   autoSeconds % 20 < 13 ? 'DESACELERACIÓN / CURVA CERRADA' :
                   'SALIDA DE CURVA Y RE-ACELERACIÓN'}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* OBD-II CHECK ENGINE FAULT CODES GENERATOR (DTC) */}
        <div className="flex flex-col gap-4 bg-slate-900/60 border border-slate-800 p-4.5 rounded-xl">
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs font-black tracking-widest uppercase text-red-500">
              Inyectar Códigos de Falla (DTC)
            </span>
            {activeDtcCodes.length > 0 && (
              <button
                onClick={clearAllDtcs}
                className="text-[10px] font-black uppercase text-red-400 border border-red-500/25 px-2 py-1 rounded bg-red-500/5 hover:bg-red-500/10"
              >
                Limpiar Códigos
              </button>
            )}
          </div>

          <p className="text-[11px] text-gray-400">
            Presiona cualquier bot para inyectar una falla eléctrica o mecánica en la ECU virtual. Luego podrás analizar la falla con nuestro asistente de IA.
          </p>

          <div className="grid grid-cols-2 gap-2 mt-1">
            {DEMO_DTC_CODES.map((dtc) => {
              const isActive = activeDtcCodes.some(d => d.code === dtc.code);
              return (
                <button
                  key={dtc.code}
                  onClick={() => toggleDtc(dtc)}
                  className={`p-2 rounded text-left border flex items-center justify-between transition-all ${
                    isActive
                      ? 'bg-red-500/10 border-red-500/60 text-red-300 font-bold'
                      : 'bg-slate-950 border-slate-800 text-gray-400 hover:border-slate-700'
                  }`}
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[11px] font-mono tracking-wider font-extrabold flex items-center gap-1">
                      {isActive && <AlertTriangle size={10} className="text-red-500 animate-bounce" />} {dtc.code}
                    </span>
                    <span className="text-[9px] text-gray-500 line-clamp-1">{dtc.description}</span>
                  </div>
                  <span className={`text-[8px] px-1 py-0.5 rounded uppercase font-black font-sans ${
                    dtc.severity === 'Alta' ? 'bg-red-500/20 text-red-500' :
                    dtc.severity === 'Media' ? 'bg-yellow-500/20 text-yellow-500' :
                    'bg-blue-500/20 text-blue-500'
                  }`}>
                    {dtc.severity}
                  </span>
                </button>
              );
            })}
          </div>

          {activeDtcCodes.length > 0 ? (
            <div className="bg-red-500/5 p-2.5 rounded border border-red-500/20 flex gap-2.5 items-center mt-1 animate-pulse">
              <AlertTriangle className="text-red-500 shrink-0" size={17} />
              <div className="text-[11px]">
                <span className="text-red-400 font-black uppercase block leading-none mb-0.5">Testigo MIL (Check Engine) Activo</span>
                 Hay <span className="font-bold underline">{activeDtcCodes.length} falla(s)</span> registradas en la memoria de la ECU virtual.
              </div>
            </div>
          ) : (
            <div className="bg-emerald-500/5 p-2.5 rounded border border-emerald-500/20 flex gap-2.5 items-center mt-1 text-emerald-400 text-xs">
              <CheckCircle2 size={16} />
              <div>
                <span className="font-bold block leading-none">ECU Status: OK</span>
                No hay códigos de falla DTC activos.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
