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
  const isIframe = typeof window !== 'undefined' && window.self !== window.top;

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

  // Active ELM327 Bluetooth/BLE & ZS-040 Serial connection variables
  const [btStatus, setBtStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'virtual'>('virtual');
  const [pairedDevice, setPairedDevice] = useState<any>(null);
  const [serialPort, setSerialPort] = useState<any>(null);
  const [connectionType, setConnectionType] = useState<'none' | 'ble' | 'serial'>('none');
  const [btError, setBtError] = useState<string>('');
  const [serialBaudRate, setSerialBaudRate] = useState<number>(38400); // ZS-040 default baud options: 9600, 38400, 115200
  const [serialParserMode, setSerialParserMode] = useState<'csv' | 'crome-binary' | 'any-text'>('csv');
  const [receivedLines, setReceivedLines] = useState<{ timestamp: number; ascii: string; hex: string; parsedOk: boolean }[]>([]);

  // Telemetry Auto-Tuning/Scanner Wizard state
  const [autoTuneState, setAutoTuneState] = useState<{
    status: 'idle' | 'scanning' | 'success' | 'failed';
    currentBaud: number;
    currentParser: 'csv' | 'crome-binary' | 'any-text';
    stage: number;
    totalStages: number;
    log: string[];
    bytesReceived: number;
    framesParsed: number;
  }>({
    status: 'idle',
    currentBaud: 38400,
    currentParser: 'crome-binary',
    stage: 0,
    totalStages: 0,
    log: [],
    bytesReceived: 0,
    framesParsed: 0,
  });

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
      // Prompt Chrome BLE Bluetooth scanner with maximum visibility
      const device = await nav.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [
          '0000ffe0-0000-1000-8000-00805f9b34fb', // LELink, Carista, standard BLE OBDII interface serial
          '0000ffe1-0000-1000-8000-00805f9b34fb', // Standard HM-10/HM-11/Vgate standard BLE modules
          '000018f0-0000-1000-8000-00805f9b34fb', // Alternative BLE profiles for diagnostics
          '00001101-0000-1000-8000-00805f9b34fb', // Standard SPP (Serial Port Profile) reference
          'generic_access',
          'device_information'
        ]
      });

      setPairedDevice(device);
      const server = await device.gatt?.connect();
      setBtStatus('connected');
      setConnectionType('ble');
      
      device.addEventListener('gattserverdisconnected', () => {
        setBtStatus('virtual');
        setPairedDevice(null);
        setConnectionType('none');
      });

    } catch (err: any) {
      console.warn('Bluetooth pairing skipped/denied:', err);
      
      // Detailed error messages based on diagnostic context
      let friendlyError = '';
      if (err.name === 'NotFoundError') {
        friendlyError = 'No se seleccionó ningún dispositivo Bluetooth o se canceló la búsqueda. Asegúrate de activar el GPS/Ubicación en tu Android (Chrome lo requiere para escanear Bluetooth) y que tu adaptador esté encendido.';
      } else if (err.name === 'SecurityError') {
        friendlyError = 'Error de seguridad al acceder al Bluetooth. Intenta abrir esta app en una pestaña nueva o un entorno HTTPS seguro certificado para habilitar permisos.';
      } else {
        friendlyError = `No se detectó el chip ECU: ${err.message || 'Error de conexión'}. Si usas un adaptador OBD2 antiguo Bluetooth 2.0/SSP (No-BLE) como el HC-05 (ZS-040), recuerda usar el nuevo botón azul "Conectar Serial ZS-040" que mapea el puerto COM virtual directamente en Chrome.`;
      }
      
      setBtError(friendlyError);
      // Fallback safe mode
      setBtStatus('virtual');
    }
  };

  // Setup persistent read loop for incoming serial packets
  const setupPersistentReader = (port: any, activeBaudRate: number, activeParserMode: string) => {
    // Setup async loops to read incoming streams
    const reader = port.readable.getReader();

    let isWriteActive = true;
    (async () => {
      while (isWriteActive) {
        if (activeParserMode === 'crome-binary' && port?.writable) {
          try {
            const writer = port.writable.getWriter();
            await writer.write(new Uint8Array([0x20]));
            writer.releaseLock();
          } catch (writeErr) {
            console.warn('Error in serial write loop:', writeErr);
          }
        }
        await new Promise((resolve) => setTimeout(resolve, 100)); // 10Hz request timing is perfect for Honda ECUs
      }
    })();

    (async () => {
      const textDecoder = new TextDecoder('utf-8', { fatal: false });
      let textBuffer = '';
      let byteBuffer: number[] = [];
      let currentReader = reader;
      let errorStreak = 0;

      while (true) {
        try {
          const { value, done } = await currentReader.read();
          if (done) {
            console.warn("Serial reader stream closed (done).");
            break;
          }
          errorStreak = 0; // Reset consecutive errors on successful read

          if (value) {
            const uint8 = value as Uint8Array;
            
            // 1. Generate Hex String representation for raw sniffer console
            const hexVal = Array.from(uint8, (b) => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
            let asciiVal = '';
            try {
              asciiVal = textDecoder.decode(uint8).replace(/[\x00-\x1F\x7F]/g, '.');
            } catch (_) {
              asciiVal = 'Binary Data';
            }

            // Append to real-time telemetry console State
            setReceivedLines((prev) => {
              const updated = [
                { timestamp: Date.now(), ascii: asciiVal, hex: hexVal, parsedOk: false },
                ...prev,
              ];
              return updated.slice(0, 35); // Keep last 35 logs for high performance
            });

            // 2. Binary Protocol Decoder (Crome QD3/QD2 binary frames)
            if (activeParserMode === 'crome-binary') {
              for (let i = 0; i < uint8.length; i++) {
                byteBuffer.push(uint8[i]);
              }

              // Determine packet size dynamically (QD3 is 16 bytes, QD2 is 20 bytes)
              let frameLength = 16;
              if (byteBuffer.length >= 20) {
                if (byteBuffer.length >= 32) {
                  const rpmAt16 = byteBuffer[17] * 256 + byteBuffer[16];
                  const rpmAt20 = byteBuffer.length >= 22 ? (byteBuffer[21] * 256 + byteBuffer[20]) : 0;
                  
                  const rpmAt16Valid = rpmAt16 >= 0 && rpmAt16 < 11000;
                  const rpmAt20Valid = rpmAt20 >= 0 && rpmAt20 < 11000;
                  
                  if (rpmAt20Valid && !rpmAt16Valid) {
                    frameLength = 20;
                  } else if (rpmAt16Valid && !rpmAt20Valid) {
                    frameLength = 16;
                  } else {
                    if (uint8.length % 20 === 0) frameLength = 20;
                    else if (uint8.length % 16 === 0) frameLength = 16;
                  }
                } else if (uint8.length === 20 || uint8.length === 40) {
                  frameLength = 20;
                }
              }

              // Auto-align: Look for a clean frame alignment offset if we have junk leading bytes
              if (byteBuffer.length >= frameLength) {
                let syncOffset = -1;
                for (let i = 0; i <= byteBuffer.length - frameLength; i++) {
                  const testLow = byteBuffer[i + 0];
                  const testHigh = byteBuffer[i + 1];
                  const testRpm = (testHigh * 256 + testLow);
                  
                  const testSpeed = byteBuffer[i + 2];
                  const testTpsRaw = byteBuffer[i + 3];
                  const testTps = Math.round((testTpsRaw * 100) / 255);
                  const testEctRaw = byteBuffer[i + 5];
                  const testIatRaw = byteBuffer[i + 6];

                  const rpmValid = testRpm >= 0 && testRpm < 11000;
                  const speedValid = testSpeed >= 0 && testSpeed <= 300;
                  const tpsValid = testTps >= 0 && testTps <= 100;
                  const ectValid = testEctRaw !== undefined && testEctRaw > 10 && testEctRaw < 240;
                  const iatValid = testIatRaw !== undefined && testIatRaw > 10 && testIatRaw < 240;

                  if (rpmValid && speedValid && tpsValid && ectValid && iatValid) {
                    syncOffset = i;
                    break;
                  }
                }

                if (syncOffset > 0) {
                  // Toss away leading unaligned bytes so the buffer aligns perfectly to packet boundaries!
                  byteBuffer = byteBuffer.slice(syncOffset);
                } else if (syncOffset === -1 && byteBuffer.length > 96) {
                  // No perfect alignment found after 96 bytes - pop a byte to maintain throughput
                  byteBuffer = byteBuffer.slice(1);
                }
              }

              while (byteBuffer.length >= frameLength) {
                const rLow = byteBuffer[0];
                const rHigh = byteBuffer[1];
                let parsedRpm = (rHigh * 256 + rLow);
                if (parsedRpm > 12000) parsedRpm = Math.round(parsedRpm / 10);
                if (parsedRpm < 0 || isNaN(parsedRpm)) parsedRpm = 0;

                const parsedSpeed = byteBuffer[2];
                const parsedTps = Math.round((byteBuffer[3] * 100) / 255);
                const parsedMap = byteBuffer[4] * 10; // mbar index
                const parsedEct = Math.max(0, Math.min(130, byteBuffer[5] - 40));
                const parsedIat = Math.max(0, Math.min(90, byteBuffer[6] - 40));
                
                const injLow = byteBuffer[7];
                const injHigh = byteBuffer[8];
                const parsedInjector = Number(((injHigh * 256 + injLow) / 100).toFixed(2));

                // Extract and map remaining PIDs securely
                const rawO2 = byteBuffer[9];
                const parsedAfr = (rawO2 && rawO2 > 0) ? Number((10.0 + (rawO2 / 255) * 10.0).toFixed(2)) : 14.7;

                const rawSpark = byteBuffer[10];
                const parsedSpark = (rawSpark && rawSpark <= 120) ? Number((rawSpark / 2).toFixed(1)) : 16.5;

                const rawVoltage = byteBuffer[12];
                const parsedVoltage = (rawVoltage && rawVoltage > 80 && rawVoltage < 180) ? Number((rawVoltage / 10).toFixed(1)) : 14.1;

                // Derive turbo boost pressure and relative engine load percentage from MAP index
                const computedBoost = Number(((parsedMap - 1013) * 0.0145037735).toFixed(1));
                const computedLoad = Math.round(Math.max(5, Math.min(100, (parsedMap / 1013) * 100)));

                setData(prev => ({
                  ...prev,
                  rpm: parsedRpm,
                  speed: parsedSpeed,
                  throttle: parsedTps,
                  map: parsedMap,
                  coolantTemp: parsedEct,
                  intakeTemp: parsedIat,
                  injector: isNaN(parsedInjector) || parsedInjector > 25 ? 1.8 : parsedInjector,
                  afr: parsedAfr,
                  sparkAdvance: parsedSpark,
                  voltage: parsedVoltage,
                  boost: computedBoost,
                  engineLoad: computedLoad,
                  timestamp: Date.now()
                }));

                // Slip calculated frameLength out of the pipeline buffer
                byteBuffer = byteBuffer.slice(frameLength);
                
                setReceivedLines(prev => {
                  if (prev.length > 0) {
                    const first = { ...prev[0], parsedOk: true };
                    return [first, ...prev.slice(1)];
                  }
                  return prev;
                });
              }
            } else {
              // 3. ASCII Text Protocol Decoders (CSV or direct parameters logger)
              const text = textDecoder.decode(uint8);
              textBuffer += text;
              const lines = textBuffer.split('\n');
              textBuffer = lines.pop() || ''; // keep the last partial line

              for (const line of lines) {
                const clean = line.trim();
                if (!clean) continue;

                let isParsed = false;
                
                // Option A: Comma-separated CSV format: "RPM,ECT,SPEED,TPS,MAP,INJ"
                if (clean.includes(',')) {
                  const parts = clean.split(',');
                  if (parts.length >= 3) {
                    const r = parseInt(parts[0], 10);
                    const ect = parseFloat(parts[1]);
                    const spd = parseInt(parts[2], 10);
                    const tps = parts[3] ? parseFloat(parts[3]) : undefined;
                    const mbar = parts[4] ? parseInt(parts[4], 10) : undefined;
                    const inj = parts[5] ? parseFloat(parts[5]) : undefined;

                    setData(prev => ({
                      ...prev,
                      rpm: isNaN(r) ? prev.rpm : r,
                      coolantTemp: isNaN(ect) ? prev.coolantTemp : ect,
                      speed: isNaN(spd) ? prev.speed : spd,
                      throttle: tps !== undefined && !isNaN(tps) ? tps : prev.throttle,
                      map: mbar !== undefined && !isNaN(mbar) ? mbar : prev.map,
                      injector: inj !== undefined && !isNaN(inj) ? inj : prev.injector,
                      timestamp: Date.now()
                    }));
                    isParsed = true;
                  }
                } else {
                  // Option B: Key-Value standard string pairs like "RPM=3200", "TPS=45"
                  const equalsIdx = clean.indexOf('=');
                  if (equalsIdx !== -1) {
                    const key = clean.substring(0, equalsIdx).trim().toUpperCase();
                    const valStr = clean.substring(equalsIdx + 1).trim();
                    const val = parseFloat(valStr);
                    if (!isNaN(val)) {
                      setData(prev => {
                        const updated = { ...prev };
                        if (key === 'RPM') updated.rpm = val;
                        else if (key === 'ECT' || key === 'TEMP') updated.coolantTemp = val;
                        else if (key === 'SPD' || key === 'SPEED') updated.speed = val;
                        else if (key === 'TPS') updated.throttle = val;
                        else if (key === 'MAP') updated.map = val;
                        else if (key === 'INJ' || key === 'INJECTOR') updated.injector = val;
                        return updated;
                      });
                      isParsed = true;
                    }
                  }
                }

                if (isParsed) {
                  setReceivedLines(prev => {
                    if (prev.length > 0) {
                      const first = { ...prev[0], parsedOk: true };
                      return [first, ...prev.slice(1)];
                    }
                    return prev;
                  });
                }
              }
            }
          }
        } catch (readErr: any) {
          errorStreak++;
          console.warn(`Error de lectura en flujo Serial USB/BT (racha: ${errorStreak}):`, readErr);
          
          if (errorStreak >= 10) {
            console.error("Demasiados errores de lectura consecutivos. Abortando bucle.");
            break;
          }
          
          // Self-healing: release current read lock, wait 300ms, and attempt to fetch a new reader
          try {
            currentReader.releaseLock();
          } catch (_) {}
          
          await new Promise(resolve => setTimeout(resolve, 300));
          
          try {
            if (port?.readable) {
              currentReader = port.readable.getReader();
            } else {
              break;
            }
          } catch (getReaderErr) {
            console.error("No se pudo obtener nuevo lector tras error de racha:", getReaderErr);
            break;
          }
        }
      }

      isWriteActive = false;
      try {
        currentReader.releaseLock();
      } catch (_) {}
    })();
  };

  // Web Serial connection logic (for ZS-040 Classic Bluetooth paired as standard COM port, or USB adapter)
  const handleConnectSerial = async () => {
    setBtError('');
    const nav: any = navigator;
    if (!nav.serial) {
      setBtError('Tu navegador actual o este entorno de vista previa no admite el API Web Serial directamente. Por favor, asegúrate de hacer clic en "Abrir en Pestaña Nueva" para usar tu COM port de ZS-040.');
      return;
    }

    setBtStatus('connecting');
    setReceivedLines([]);

    try {
      const port = await nav.serial.requestPort();
      // Honda OBD1 Datalogging (Crome QD3) speed is user-selected serialBaudRate
      await port.open({ baudRate: serialBaudRate });
      setSerialPort(port);
      setBtStatus('connected');
      setConnectionType('serial');
      setBtError('');

      // Launch persistent data reader
      setupPersistentReader(port, serialBaudRate, serialParserMode);

    } catch (err: any) {
      console.warn('Conexión serial no completada:', err);
      setBtError(`Error al abrir puerto COM serial del ZS-040: ${err.message || 'Se canceló la selección'}. Si ya emparejaste el HC-05 en tu computadora, ve a Configuración de Bluetooth -> "Más opciones de Bluetooth" -> Pestaña "Puertos COM" para ver qué puerto COM es el de Sintonización Saliente.`);
      setBtStatus('virtual');
    }
  };

  // Sintonizador Inteligente Automático de Señales
  const handleStartAutoTuning = async () => {
    setBtError('');
    const nav: any = navigator;
    if (!nav.serial) {
      setBtError('Tu navegador o este entorno en iFrame no admite la sintonización Web Serial directamente. Por favor presiona primero "Abrir en Pestaña Nueva" para darle permisos al COM port.');
      return;
    }

    // List of configurations to test in sequence
    const scanConfigurations: { baud: number; parser: 'csv' | 'crome-binary' | 'any-text'; label: string }[] = [
      { baud: 38400, parser: 'crome-binary', label: 'Honda Crome QD3 OBD1 (38400 bps - Binario)' },
      { baud: 38400, parser: 'csv', label: 'Sintonización ASCII CSV (38400 bps - Texto)' },
      { baud: 9600, parser: 'csv', label: 'Económico Arduino / ASCII CSV (9600 bps - Texto)' },
      { baud: 9600, parser: 'any-text', label: 'ASCII pares de valor RPM=X (9600 bps - Texto)' },
      { baud: 115200, parser: 'crome-binary', label: 'Honda Crome Alta Velocidad (115200 bps - Binario)' },
      { baud: 4800, parser: 'crome-binary', label: 'Honda Standard Nep tune/QD2 (4800 bps - Binario)' }
    ];

    let port: any = null;
    try {
      port = await nav.serial.requestPort();
    } catch (portErr: any) {
      console.warn('Selección de puerto cancelada:', portErr);
      setBtError('Sintonización cancelada: No se seleccionó ningún puerto COM.');
      return;
    }

    setBtStatus('connecting');
    setConnectionType('serial');
    setAutoTuneState({
      status: 'scanning',
      currentBaud: 38400,
      currentParser: 'crome-binary',
      stage: 1,
      totalStages: scanConfigurations.length,
      log: [
        '🔌 Puerto seleccionado. Iniciando barrido osciloscópico de baudios...',
        '⚠️ RECUERDA: La llave de la moto/carro debe estar en contacto (Switch ON) y el chip ZS-040 alimentado.'
      ],
      bytesReceived: 0,
      framesParsed: 0
    });

    let successConfig: typeof scanConfigurations[number] | null = null;
    let keepPortOpen = false;

    // Loop through each combination
    for (let index = 0; index < scanConfigurations.length; index++) {
      const config = scanConfigurations[index];
      const { baud, parser, label } = config;
      keepPortOpen = false; // Reset for this channel sweep trial

      setAutoTuneState(prev => ({
        ...prev,
        status: 'scanning',
        stage: index + 1,
        currentBaud: baud,
        currentParser: parser,
        bytesReceived: 0,
        framesParsed: 0,
        log: [...prev.log, `⚡ Sintonizando canal ${index + 1}/${scanConfigurations.length}: Probando ${label}...`]
      }));

      try {
        await port.open({ baudRate: baud });
      } catch (openErr: any) {
        setAutoTuneState(prev => ({
          ...prev,
          log: [...prev.log, `   ❌ Canal bloqueado: No se pudo abrir velocidad a ${baud} bps (${openErr.message || 'ocupado'}).`]
        }));
        continue;
      }

      // Check for incoming packet streaming activity during 5.0 seconds
      const reader = port.readable.getReader();
      const textDecoder = new TextDecoder('utf-8', { fatal: false });
      let bytesCount = 0;
      let validFramesCount = 0;
      let textBuffer = '';
      let byteBuffer: number[] = [];

      // Actively send OBD1 query byte to trigger standard ECU streaming
      let testWriteActive = true;
      if (parser === 'crome-binary' && port.writable) {
        (async () => {
          while (testWriteActive) {
            try {
              const writer = port.writable.getWriter();
              await writer.write(new Uint8Array([0x20]));
              writer.releaseLock();
            } catch (_) {}
            await new Promise((resolve) => setTimeout(resolve, 60));
          }
        })();
      }

      const startTime = Date.now();
      const duration = 5000; // 5.0 seconds test window

      try {
        while (Date.now() - startTime < duration) {
          // Non-blocking timeout-guarded read (resolves if idle for more than 1000ms)
          const timeoutPromise = new Promise<{ value: undefined; done: boolean }>((resolve) => 
            setTimeout(() => resolve({ value: undefined, done: true }), 1000)
          );
          
          const result = await Promise.race([
            reader.read(),
            timeoutPromise
          ]);
          
          if (result.done || !result.value) {
            break;
          }

          const value = result.value;

          if (value) {
            const uint8 = value as Uint8Array;
            bytesCount += uint8.length;

            if (parser === 'crome-binary') {
              for (let i = 0; i < uint8.length; i++) {
                byteBuffer.push(uint8[i]);
              }

              // Determine packet size dynamically in trial (QD3 is 16 bytes, QD2 is 20 bytes)
              let frameLength = 16;
              if (byteBuffer.length >= 20) {
                if (byteBuffer.length >= 32) {
                  const rpmAt16 = byteBuffer[17] * 256 + byteBuffer[16];
                  const rpmAt20 = byteBuffer.length >= 22 ? (byteBuffer[21] * 256 + byteBuffer[20]) : 0;
                  
                  const rpmAt16Valid = rpmAt16 >= 0 && rpmAt16 < 11000;
                  const rpmAt20Valid = rpmAt20 >= 0 && rpmAt20 < 11000;
                  
                  if (rpmAt20Valid && !rpmAt16Valid) {
                    frameLength = 20;
                  } else if (rpmAt16Valid && !rpmAt20Valid) {
                    frameLength = 16;
                  } else {
                    if (uint8.length % 20 === 0) frameLength = 20;
                    else if (uint8.length % 16 === 0) frameLength = 16;
                  }
                } else if (uint8.length === 20 || uint8.length === 40) {
                  frameLength = 20;
                }
              }

              // Auto-align: Look for a clean frame alignment offset if we have junk leading bytes
              if (byteBuffer.length >= frameLength) {
                let syncOffset = -1;
                for (let i = 0; i <= byteBuffer.length - frameLength; i++) {
                  const testLow = byteBuffer[i + 0];
                  const testHigh = byteBuffer[i + 1];
                  const testRpm = (testHigh * 256 + testLow);
                  
                  const testSpeed = byteBuffer[i + 2];
                  const testTpsRaw = byteBuffer[i + 3];
                  const testTps = Math.round((testTpsRaw * 100) / 255);
                  const testEctRaw = byteBuffer[i + 5];
                  const testIatRaw = byteBuffer[i + 6];

                  const rpmValid = testRpm >= 0 && testRpm < 11000;
                  const speedValid = testSpeed >= 0 && testSpeed <= 300;
                  const tpsValid = testTps >= 0 && testTps <= 100;
                  const ectValid = testEctRaw !== undefined && testEctRaw > 10 && testEctRaw < 240;
                  const iatValid = testIatRaw !== undefined && testIatRaw > 10 && testIatRaw < 240;

                  if (rpmValid && speedValid && tpsValid && ectValid && iatValid) {
                    syncOffset = i;
                    break;
                  }
                }

                if (syncOffset > 0) {
                  byteBuffer = byteBuffer.slice(syncOffset);
                } else if (syncOffset === -1 && byteBuffer.length > 96) {
                  byteBuffer = byteBuffer.slice(1);
                }
              }

              while (byteBuffer.length >= frameLength) {
                const rLow = byteBuffer[0];
                const rHigh = byteBuffer[1];
                let parsedRpm = rHigh * 256 + rLow;
                if (parsedRpm > 12000) parsedRpm = Math.round(parsedRpm / 10);
                if (parsedRpm < 0 || isNaN(parsedRpm)) parsedRpm = 0;
                
                const parsedSpeed = byteBuffer[2];
                const parsedTps = Math.round((byteBuffer[3] * 100) / 255);
                const parsedMap = byteBuffer[4] * 10;
                const parsedEct = Math.max(0, Math.min(130, byteBuffer[5] - 40));
                const parsedIat = Math.max(0, Math.min(90, byteBuffer[6] - 40));
                
                const injLow = byteBuffer[7];
                const injHigh = byteBuffer[8];
                const parsedInjector = Number(((injHigh * 256 + injLow) / 100).toFixed(2));

                const rawO2 = byteBuffer[9];
                const parsedAfr = (rawO2 && rawO2 > 0) ? Number((10.0 + (rawO2 / 255) * 10.0).toFixed(2)) : 14.7;

                const rawSpark = byteBuffer[10];
                const parsedSpark = (rawSpark && rawSpark <= 120) ? Number((rawSpark / 2).toFixed(1)) : 16.5;

                const rawVoltage = byteBuffer[12];
                const parsedVoltage = (rawVoltage && rawVoltage > 80 && rawVoltage < 180) ? Number((rawVoltage / 10).toFixed(1)) : 14.1;

                const computedBoost = Number(((parsedMap - 1013) * 0.0145037735).toFixed(1));
                const computedLoad = Math.round(Math.max(5, Math.min(100, (parsedMap / 1013) * 100)));
                
                // RPM === 0 is valid for a connected engine that is currently off!
                // Plausibility check
                if (parsedRpm >= 0 && parsedRpm < 11000 && parsedTps >= 0 && parsedTps <= 100 && parsedSpeed <= 300) {
                  validFramesCount++;
                  
                  // Instantly pipe real bytes to the dashboard as living telemetry!
                  setData(prev => ({
                    ...prev,
                    rpm: parsedRpm,
                    speed: parsedSpeed,
                    throttle: parsedTps,
                    map: parsedMap,
                    coolantTemp: parsedEct,
                    intakeTemp: parsedIat,
                    injector: isNaN(parsedInjector) || parsedInjector > 25 ? 1.8 : parsedInjector,
                    afr: parsedAfr,
                    sparkAdvance: parsedSpark,
                    voltage: parsedVoltage,
                    boost: computedBoost,
                    engineLoad: computedLoad,
                    timestamp: Date.now()
                  }));
                }
                byteBuffer = byteBuffer.slice(frameLength);
              }
            } else {
              // Text parser
              const text = textDecoder.decode(uint8);
              textBuffer += text;
              const lines = textBuffer.split('\n');
              textBuffer = lines.pop() || '';

              for (const line of lines) {
                const clean = line.trim();
                if (!clean) continue;

                if (parser === 'csv' && clean.includes(',')) {
                  const parts = clean.split(',');
                  if (parts.length >= 3) {
                    const r = parseInt(parts[0], 10);
                    if (!isNaN(r) && r >= 0 && r < 12000) {
                      validFramesCount++;
                    }
                  }
                } else if (parser === 'any-text' && clean.includes('=')) {
                  if (clean.toUpperCase().includes('RPM') || clean.toUpperCase().includes('TPS')) {
                    validFramesCount++;
                  }
                }
              }
            }

            // Real-time update to the logging hook
            setAutoTuneState(prev => ({
              ...prev,
              bytesReceived: bytesCount,
              framesParsed: validFramesCount
            }));

            // If we've got at least 3 perfectly decoded frames, lock on early!
            if (validFramesCount >= 3) {
              keepPortOpen = true; // DO NOT CLOSE trailing success port
              break;
            }
          }
        }
      } catch (readErr) {
        console.warn('Read trial error:', readErr);
      } finally {
        testWriteActive = false;
        reader.releaseLock();
        if (!keepPortOpen) {
          await port.close();
        }
      }

      setAutoTuneState(prev => ({
        ...prev,
        log: [...prev.log, `   📊 Resultados: Recibidos ${bytesCount} bytes, con ${validFramesCount} registros decodificados con éxito.`]
      }));

      if (bytesCount > 0 && validFramesCount >= 2) {
        successConfig = { baud, parser, label };
        keepPortOpen = true; // Protect port close transition!
        break;
      }
    }

    if (successConfig) {
      const { baud, parser, label } = successConfig;
      setSerialBaudRate(baud);
      setSerialParserMode(parser);

      setAutoTuneState(prev => ({
        ...prev,
        status: 'success',
        log: [
          ...prev.log,
          `🎯 ¡CONEXIÓN PERFECTA! Encontrado protocolo compatible.`,
          `🚀 Fijando velocidad a ${baud} bps con sintonizador "${parser}".`
        ]
      }));

      // Directly pipe persistent reader onto already-open active channel port! No closing needed.
      try {
        setSerialPort(port);
        setBtStatus('connected');
        setBtError('');
        setupPersistentReader(port, baud, parser);
      } catch (reopenErr: any) {
        setBtError(`Error al preparar el flujo sintonizado: ${reopenErr.message}`);
        setBtStatus('virtual');
      }

    } else {
      setAutoTuneState(prev => ({
        ...prev,
        status: 'failed',
        log: [
          ...prev.log,
          '❌ No se pudo encontrar un decodificador que entienda los datos entrantes.',
          '💡 INSTRUCCIONES FÍSICAS DE EDWIN BIKES:',
          '1. ¿Se desconecta al cerrar el Swich de la llave? ¡Totalmente normal! Al apagar el switch, la ECU pierde la corriente de 12V y el chip se apaga. SIEMPRE debes tener el switch abierto (Ignición en ON) para sintonizar.',
          '2. Cruce de Cables: Comprueba que el pin TX del Bluetooth ZS-040 vaya al cable RX de la ECU (computadora de moto) y el pin RX del Bluetooth vaya al pin TX de la ECU.',
          '3. Compartir Tierra (GND): Asegúrate de soldar un cable entre el pin GND (negativo) del chip ZS-040 y el GND metálico del chasis o de la ECU para estabilizar el voltaje de señal.'
        ]
      }));
      setBtStatus('virtual');
    }
  };

  const handleDisconnect = async () => {
    if (pairedDevice && pairedDevice.gatt?.connected) {
      pairedDevice.gatt.disconnect();
    }
    if (serialPort) {
      try {
        await serialPort.close();
      } catch (err) {
        console.error('Error cerrando puerto serial:', err);
      }
    }
    setPairedDevice(null);
    setSerialPort(null);
    setConnectionType('none');
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

            {/* Web Bluetooth & Serial triggers */}
            {btStatus === 'connected' ? (
              <button
                onClick={handleDisconnect}
                className="px-3.5 py-1.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-black text-[10px] uppercase tracking-wider rounded-lg flex items-center gap-1 cursor-pointer hover:bg-emerald-500/20"
              >
                <div className="h-1.5 w-1.5 bg-emerald-400 rounded-full animate-ping mr-0.5" />
                ECU: {connectionType === 'serial' ? 'Puerto Serial Mapeado (ZS-040/HC-05)' : (pairedDevice?.name || 'OBDII BLE')} • DESCONECTAR
              </button>
            ) : btStatus === 'connecting' ? (
              <button
                disabled
                className="px-3.5 py-1.5 bg-slate-800 border border-slate-700 text-gray-400 font-black text-[10px] uppercase tracking-wider rounded-lg flex items-center gap-1 animate-pulse"
              >
                Conectando...
              </button>
            ) : (
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={handleConnectBluetooth}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-black text-[10px] uppercase tracking-wider rounded-lg flex items-center gap-1 transition-all shadow-lg shadow-blue-500/10 cursor-pointer"
                  title="Para escáneres BLE modernos"
                >
                  <Bluetooth size={12} /> ESCANEAR BLE
                </button>
                <button
                  onClick={handleConnectSerial}
                  className="px-3 py-1.5 bg-slate-900 border border-white/[0.1] hover:bg-slate-800 text-white font-black text-[10px] uppercase tracking-wider rounded-lg flex items-center gap-1 transition-all cursor-pointer"
                  title="Para módulos Bluetooth Classic (ZS-040) - Configuración Manual"
                >
                  📟 MANUAL (ZS-040)
                </button>
                <button
                  onClick={handleStartAutoTuning}
                  className="px-3 py-1.5 bg-gradient-to-r from-cyan-400 to-emerald-400 hover:from-cyan-300 hover:to-emerald-300 text-black font-black text-[10px] uppercase tracking-wider rounded-lg flex items-center gap-1.5 transition-all shadow-lg shadow-cyan-500/10 cursor-pointer animate-pulse"
                  title="Escáner Inteligente: Busca automáticamente velocidades y protocolos para sincronizar con el motor"
                >
                  ⚡ AUTO-SINTONIZAR (RECOMENDADO)
                </button>
              </div>
            )}

            {btStatus === 'virtual' && (
              <span className="text-[9px] font-mono font-bold text-gray-400 uppercase bg-slate-900 border border-white/[0.04] px-2 py-1.5 rounded-lg">
                MODO SIMULADO
              </span>
            )}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl mx-auto w-full p-4 md:p-6 flex flex-col gap-6">
        
        {/* Iframe detection bluetooth warning banner */}
        {isIframe && (
          <div className="bg-gradient-to-r from-blue-950 via-[#071329] to-slate-950 border border-blue-500/30 p-4.5 rounded-2xl shadow-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 max-w-5xl mx-auto w-full">
            <div className="flex gap-3 items-start">
              <div className="p-2 bg-blue-500/10 border border-blue-500/20 rounded-xl text-blue-400 shrink-0 mt-0.5">
                <Bluetooth className="animate-pulse" size={18} />
              </div>
              <div>
                <span className="text-xs font-black uppercase tracking-wider text-[#00f0ff] block">
                  Modo de Vista Previa Detectado (Iframe)
                </span>
                <p className="text-xs text-gray-300 mt-1 leading-relaxed max-w-2xl">
                  Para seguridad de los usuarios, los navegadores modernos (como Google Chrome) **prohíben estrictamente** escanear/conectar dispositivos Bluetooth cuando una aplicación se ejecuta dentro de un recuadro (iFrame). Para conectar el chip OBD2 de tu carro, abre la aplicación directamente en una pestaña externa segura.
                </p>
              </div>
            </div>
            <a
              href={typeof window !== 'undefined' ? window.location.href : '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-[#ff7700] hover:bg-[#ff8811] text-black text-xs font-black uppercase tracking-widest rounded-xl transition shadow-lg shadow-orange-500/10 flex items-center gap-2 shrink-0 self-stretch sm:self-auto text-center justify-center"
            >
              <Smartphone size={13} /> Abrir en Pestaña Nueva
            </a>
          </div>
        )}

        {/* Connection errors fallback banner */}
        {btError && (
          <div className="bg-amber-500/5 border border-amber-500/15 p-4.5 rounded-2xl shadow-lg flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 max-w-5xl mx-auto w-full">
            <div className="flex flex-col gap-1">
              <span className="text-xs font-black uppercase tracking-widest text-amber-500">
                Alerta de Interfaz OBD2
              </span>
              <span className="text-xs text-amber-200 leading-relaxed font-medium">{btError}</span>
            </div>
            {btError.includes('SecurityError') || isIframe ? (
              <a
                href={typeof window !== 'undefined' ? window.location.href : '#'}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black text-xs font-black uppercase tracking-widest rounded-xl transition shadow-md shrink-0 self-stretch sm:self-auto text-center justify-center"
              >
                Abrir Pestaña Segura
              </a>
            ) : (
              <button
                onClick={() => setBtError('')}
                className="text-gray-400 hover:text-white font-bold ml-2 text-[10px] uppercase font-sans border border-slate-800 px-3 py-1.5 rounded-xl shrink-0 self-stretch sm:self-auto"
              >
                Cerrar Aviso
              </button>
            )}
          </div>
        )}

        {/* SMART TELEMETRY AUTO-TUNING / SCANNED SIGNAL WIZARD */}
        {autoTuneState.status !== 'idle' && (
          <div className="bg-[#0b1320] border-2 border-cyan-400/40 p-6 rounded-3xl shadow-2xl max-w-5xl mx-auto w-full text-white transition-all">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-5 pb-4 border-b border-white/[0.08]">
              <div className="flex items-center gap-3">
                <span className="p-2.5 bg-cyan-400/10 border border-cyan-400/20 text-cyan-400 rounded-2xl flex items-center justify-center">
                  <Cpu size={22} className="shrink-0 animate-pulse" />
                </span>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wider text-cyan-300 flex items-center gap-2">
                    🔧 Asistente de Sintonización de Portadora (Sintonizador Inteligente)
                    {autoTuneState.status === 'scanning' && <span className="h-2 w-2 rounded-full bg-amber-400 animate-ping" />}
                  </h3>
                  <p className="text-[10px] text-gray-400 font-mono mt-0.5">
                    Análisis de coherencia eléctrica e interpretación de bytes en el chip ZS-040 en tiempo real.
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <span className={`px-2.5 py-1 text-[9px] font-black uppercase tracking-wider rounded-md ${
                  autoTuneState.status === 'scanning' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                  autoTuneState.status === 'success' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 animate-bounce' :
                  'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                }`}>
                  {autoTuneState.status === 'scanning' ? 'Buscando Señal...' :
                   autoTuneState.status === 'success' ? 'Sintonizado!' : 'Señal no Sintonizada'}
                </span>
                <button
                  onClick={() => setAutoTuneState(prev => ({ ...prev, status: 'idle' }))}
                  className="text-gray-400 hover:text-white font-black text-xs px-2 py-0.5 rounded border border-white/[0.08] cursor-pointer"
                >
                  ✕
                </button>
              </div>
            </div>

            {/* Living Waveform / Progress Tracker */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
              
              {/* Box 1: Samped channels progress */}
              <div className="bg-slate-950 p-4 rounded-xl border border-white/[0.04] flex flex-col justify-between">
                <span className="text-[9px] font-mono text-gray-500 font-extrabold uppercase tracking-widest block">Canal de Barrido</span>
                <div className="my-2.5">
                  <div className="flex justify-between text-xs font-mono mb-1 font-bold">
                    <span>Progreso del Escáner</span>
                    <span className="text-cyan-400">{autoTuneState.stage} / {autoTuneState.totalStages}</span>
                  </div>
                  <div className="w-full bg-slate-900 rounded-full h-2 overflow-hidden border border-white/[0.06]">
                    <div 
                      className="bg-cyan-400 h-full rounded-full transition-all duration-300"
                      style={{ width: `${autoTuneState.totalStages > 0 ? (autoTuneState.stage / autoTuneState.totalStages) * 100 : 0}%` }}
                    />
                  </div>
                </div>
                <span className="text-[10px] font-mono text-gray-405 block mt-0.5">
                  Probando a: <strong className="text-white font-mono">{autoTuneState.currentBaud} bps</strong>
                </span>
              </div>

              {/* Box 2: Bytes Sniffer */}
              <div className="bg-slate-950 p-4 rounded-xl border border-white/[0.04] flex flex-col justify-between">
                <span className="text-[9px] font-mono text-gray-500 font-extrabold uppercase tracking-widest block">Recepción de Voltaje (Bytes)</span>
                <div className="flex items-baseline gap-2 my-1">
                  <span className={`text-2xl font-black font-mono ${autoTuneState.bytesReceived > 0 ? 'text-emerald-400' : 'text-rose-450'}`}>
                    {autoTuneState.bytesReceived}
                  </span>
                  <span className="text-[10px] font-mono text-gray-500 font-medium">bytes leídos</span>
                </div>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className={`h-2 w-2 rounded-full ${autoTuneState.bytesReceived > 0 ? 'bg-emerald-400 animate-ping' : 'bg-rose-500'}`} />
                  <span className="text-[10px] font-mono text-gray-400">
                    {autoTuneState.bytesReceived > 0 ? 'Flujo de datos activo' : 'Esperando pulsos en RX...'}
                  </span>
                </div>
              </div>

              {/* Box 3: Decodificación Coherente */}
              <div className="bg-slate-950 p-4 rounded-xl border border-white/[0.04] flex flex-col justify-between">
                <span className="text-[9px] font-mono text-gray-500 font-extrabold uppercase tracking-widest block">Sincronía de Datos</span>
                <div className="flex items-baseline gap-2 my-1">
                  <span className={`text-2xl font-black font-mono ${autoTuneState.framesParsed > 0 ? 'text-[#39FF14]' : 'text-gray-600'}`}>
                    {autoTuneState.framesParsed}
                  </span>
                  <span className="text-[10px] font-mono text-gray-500 font-medium">tramas / seg OK</span>
                </div>
                <span className="text-[10px] font-sans font-bold text-gray-400 block mt-0.5">
                  Formato activo: <strong className="text-cyan-400 uppercase font-mono">{autoTuneState.currentParser}</strong>
                </span>
              </div>

            </div>

            {/* Rolling Oscilloscope Logger Terminal */}
            <div className="bg-black/95 p-4 rounded-2xl border border-white/[0.08] font-mono text-xs mb-5">
              <span className="text-[9px] text-[#ff7700] uppercase font-black tracking-widest block mb-1.5">Historial del Escáner de Sintonización:</span>
              <div className="h-[140px] overflow-y-auto flex flex-col gap-1 pr-2 scrollbar-thin">
                {autoTuneState.log.map((line, i) => (
                  <div key={i} className="text-[11px] leading-relaxed text-gray-300">
                    {line.startsWith('   ❌') ? <span className="text-red-400">{line}</span> :
                     line.startsWith('🎯') ? <span className="text-[#39FF14] font-black">{line}</span> :
                     line.startsWith('⚡') ? <span className="text-amber-400">{line}</span> :
                     line.startsWith('🔋') ? <span className="text-cyan-400">{line}</span> :
                     line.startsWith('💡') ? <span className="text-yellow-400 font-semibold">{line}</span> :
                     <span>{line}</span>}
                  </div>
                ))}
              </div>
            </div>

            {/* Quick action helper buttons bottom */}
            <div className="flex flex-wrap gap-2 justify-end border-t border-white/[0.06] pt-4">
              {autoTuneState.status === 'failed' && (
                <button
                  onClick={handleStartAutoTuning}
                  className="px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black text-xs font-black uppercase tracking-wider rounded-xl transition cursor-pointer"
                >
                  🔄 Volver a Escanear
                </button>
              )}
              <button
                onClick={() => setAutoTuneState(prev => ({ ...prev, status: 'idle' }))}
                className="px-4 py-2 bg-slate-900 border border-white/[0.08] hover:bg-slate-800 text-xs text-gray-300 font-bold uppercase rounded-xl transition cursor-pointer"
              >
                Cerrar Asistente
              </button>
            </div>
          </div>
        )}

        {/* REAL-TIME HARDWARE DATA LOGGER AND PROTOCOLS DEBUG DOCK */}
        {(connectionType !== 'none' || receivedLines.length > 0) && (
          <div className="bg-[#0b0e14] border border-[#00f0ff]/20 p-5 rounded-2xl shadow-xl max-w-5xl mx-auto w-full text-white">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4 pb-4 border-b border-white/[0.04]">
              <div>
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-cyan-400 animate-ping" />
                  <h3 className="text-xs font-black uppercase tracking-wider text-cyan-400">
                    🔧 Consola de Diagnóstico de Enlace Serial en Vivo (EDWIN BIKES)
                  </h3>
                </div>
                <p className="text-[10px] text-gray-400 font-mono mt-1">
                  Inspección directa de bytes entrantes del chip ZS-040 a la velocidad seleccionada.
                </p>
              </div>
              
              {/* Controls for Baud Rate and Parser Style */}
              <div className="flex flex-wrap gap-2.5 items-center">
                {/* Baud selection */}
                <div className="flex flex-col gap-1">
                  <span className="text-[9px] font-mono text-gray-500 font-black uppercase">Velocidad (Baud Rate):</span>
                  <select
                    value={serialBaudRate}
                    onChange={(e) => {
                      const newBaud = parseInt(e.target.value, 10);
                      setSerialBaudRate(newBaud);
                      if (serialPort) {
                        handleDisconnect();
                        setBtError(`Velocidad cambiada a ${newBaud} bps. Por favor haz clic en "CONECTAR SERIAL" nuevamente para iniciar con el nuevo Baud Rate.`);
                      }
                    }}
                    className="bg-slate-900 border border-white/[0.1] text-xs text-white px-2.5 py-1 rounded focus:outline-none focus:border-cyan-400"
                  >
                    <option value={4800}>4800 bps (Honda standard OBD1)</option>
                    <option value={9600}>9600 bps (ZS-040 default)</option>
                    <option value={19200}>19200 bps</option>
                    <option value={38400}>38400 bps (Crome standard)</option>
                    <option value={57600}>57600 bps</option>
                    <option value={115200}>115200 bps (Fast BT/USB)</option>
                  </select>
                </div>

                {/* Parser selection */}
                <div className="flex flex-col gap-1">
                  <span className="text-[9px] font-mono text-gray-500 font-black uppercase">Modo Decodificador:</span>
                  <select
                    value={serialParserMode}
                    onChange={(e: any) => setSerialParserMode(e.target.value)}
                    className="bg-slate-900 border border-white/[0.1] text-xs text-white px-2.5 py-1 rounded focus:outline-none focus:border-cyan-400"
                  >
                    <option value="csv">ASCII CSV ("RPM,TEMP,SPEED,TPS...")</option>
                    <option value="any-text">Texto Libre ("RPM=1200" o similar)</option>
                    <option value="crome-binary">Honda Crome OBD1 Binary (QD3)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Smart diagnosis feedback based on received state and characters */}
            <div className="p-3.5 rounded-xl bg-slate-950 border border-white/[0.04] mb-4 text-xs">
              <span className="font-extrabold text-[#ff7700] uppercase tracking-wider block text-[10px] mb-1">
                Análisis de Conexión en Vivo:
              </span>
              {receivedLines.length === 0 ? (
                <p className="text-gray-400 leading-relaxed font-mono text-[11px]">
                  Esperando bytes... Si ya elegiste el puerto COM pero no ves movimiento de datos abajo, verifica que:
                  <br />• El cable de transmisión TX de tu chip ZS-040 esté conectado al pin RX de la computadora ECU, y el pin RX de ZS-040 al cable TX de la ECU.
                  <br />• La ECU esté alimentada (carro/moto en ON/contacto).
                  <br />• El módulo Bluetooth ZS-040 esté parpadeando establemente indicando transmisión.
                </p>
              ) : (
                <div className="font-mono text-[11px] leading-relaxed">
                  {/* If we have lines but parse is failing */}
                  {!receivedLines.some(l => l.parsedOk) ? (
                    <div className="text-amber-400">
                      <p className="font-bold">⚠️ ADVERTENCIA: Se están recibiendo datos pero ningún decodificador los ha podido interpretar.</p>
                      <p className="text-gray-300 mt-1">
                        Si los bytes que ves abajo son caracteres extraños como <code className="bg-black px-1.5 py-0.5 rounded text-red-400 font-mono">00 00 FF</code> o puntos continuos <code className="bg-black px-1.5 py-0.5 rounded text-red-000">......</code>, lo más probable es que la <strong>Velocidad (Baud Rate)</strong> sea incorrecta. Por favor prueba cambiando la velocidad anterior de <span className="font-black text-white bg-slate-800 px-1 rounded">{serialBaudRate}</span> a <span className="font-black text-[#00f0ff] bg-slate-800 px-1 rounded">9600</span> o <span className="font-black text-[#00f0ff] bg-slate-850 px-1.5 py-0.5 rounded">115200</span> para sintonizar la honda portadora.
                      </p>
                    </div>
                  ) : (
                    <div className="text-emerald-400 font-extrabold flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                      <span>¡ÉXITO! Los paquetes entrantes están siendo decodificados correctamente de forma continua.</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Live Data Terminal Monitor Grid */}
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between items-center text-[10px] uppercase font-mono text-gray-400 px-1">
                <span>Último Datos del Monitor Serial (Max 8 líneas)</span>
                <button
                  onClick={() => setReceivedLines([])}
                  className="hover:text-white border border-slate-800 hover:border-slate-700 bg-slate-900 leading-none px-2 py-1 rounded cursor-pointer"
                >
                  Limpiar Consola
                </button>
              </div>

              <div className="bg-black/80 rounded-xl p-3 border border-white/[0.06] font-mono text-[11px] h-[160px] overflow-y-auto flex flex-col gap-1">
                {receivedLines.length === 0 ? (
                  <span className="text-gray-600 italic">No hay datos en el buffer de entrada de puerto serial...</span>
                ) : (
                  receivedLines.slice(0, 8).map((line, index) => (
                    <div key={index} className="flex flex-col sm:flex-row justify-between items-start border-b border-white/[0.02] py-1 gap-2 last:border-0 hover:bg-slate-900/40 px-1 rounded transition">
                      <div className="flex gap-2 shrink-0">
                        <span className="text-gray-500">[{new Date(line.timestamp).toLocaleTimeString()}]</span>
                        <span className="text-cyan-500 font-bold shrink-0">HEX:</span>
                        <span className="text-gray-300 select-all truncate max-w-xs md:max-w-md font-mono" title={line.hex}>
                          {line.hex}
                        </span>
                      </div>
                      <div className="flex gap-2 text-right">
                        <span className="text-yellow-600 font-bold">ASCII:</span>
                        <span className="text-[#39FF14] inline-block max-w-[120px] truncate font-mono" title={line.ascii}>
                          {line.ascii}
                        </span>
                        <span>
                          {line.parsedOk ? (
                            <span className="bg-emerald-500/10 text-emerald-300 text-[9px] border border-emerald-500/20 px-1.5 py-0.2 rounded font-sans font-black">
                              OK
                            </span>
                          ) : (
                            <span className="bg-gray-800/40 text-gray-500 text-[9px] px-1.5 py-0.2 rounded font-sans">
                              RAW
                            </span>
                          )}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
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
