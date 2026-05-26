/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { Smartphone, Tablet, Bluetooth, Settings, HelpCircle, HardDrive, Cpu, AlertCircle, Info } from 'lucide-react';

export default function InstructionsPWA() {
  const [activeSegment, setActiveSegment] = useState<'pwa' | 'bt' | 'obd2'>('pwa');

  return (
    <div className="bg-slate-950 p-4 md:p-6 border border-white/[0.04] rounded-2xl max-w-4xl mx-auto w-full text-white flex flex-col gap-6">
      
      {/* Intro Question Block */}
      <div className="bg-gradient-to-tr from-[#090F1E] to-blue-950/20 border border-blue-500/20 p-5 rounded-xl flex flex-col md:flex-row gap-4 items-start md:items-center">
        <Smartphone className="text-[#00f0ff] animate-pulse shrink-0" size={32} />
        <div>
          <h2 className="text-lg font-black uppercase text-white tracking-widest leading-snug">
            ¿Es posible usar esta App en Celulares y Tabletas Android?
          </h2>
          <p className="text-sm text-blue-200 mt-1 leading-relaxed">
            <strong>¡Sí, absolutamente!</strong> Esta aplicación está construida utilizando estándares web de última generación como <strong>Progressive Web App (PWA)</strong> lo que significa que puedes instalarla directamente en tu celular o tableta Android como si fuera una APK nativa, con soporte 100% responsivo y capacidades offline.
          </p>
        </div>
      </div>

      {/* Selector Tabs */}
      <div className="grid grid-cols-3 gap-2 p-1.5 bg-slate-900 rounded-xl">
        <button
          onClick={() => setActiveSegment('pwa')}
          className={`py-2 px-3 rounded-lg text-xs font-black uppercase tracking-wider transition flex items-center justify-center gap-1.5 ${
            activeSegment === 'pwa' ? 'bg-[#ff7700] text-black shadow-lg shadow-[#ff7700]/15' : 'text-gray-400 hover:text-white'
          }`}
        >
          <Smartphone size={13} /> Instalar en Android (PWA)
        </button>
        <button
          onClick={() => setActiveSegment('bt')}
          className={`py-2 px-3 rounded-lg text-xs font-black uppercase tracking-wider transition flex items-center justify-center gap-1.5 ${
            activeSegment === 'bt' ? 'bg-[#ff7700] text-black shadow-lg shadow-[#ff7700]/15' : 'text-gray-400 hover:text-white'
          }`}
        >
          <Bluetooth size={13} /> Conectar Bluetooth Chip / ECU
        </button>
        <button
          onClick={() => setActiveSegment('obd2')}
          className={`py-2 px-3 rounded-lg text-xs font-black uppercase tracking-wider transition flex items-center justify-center gap-1.5 ${
            activeSegment === 'obd2' ? 'bg-[#ff7700] text-black shadow-lg shadow-[#ff7700]/15' : 'text-gray-400 hover:text-white'
          }`}
        >
          <Cpu size={13} /> Protocolos OBD-II y ELM327
        </button>
      </div>

      {/* Screen Content - PWA Installation instructions */}
      {activeSegment === 'pwa' && (
        <div className="flex flex-col gap-4 bg-slate-900/40 p-5 rounded-xl border border-slate-900/60 leading-relaxed text-sm">
          <h3 className="text-sm font-black uppercase tracking-wider text-[#ff7700] mb-2 flex items-center gap-1.5">
            <Smartphone size={17} /> Pasos para Instalar en Celular / Tableta Android:
          </h3>
          <p className="text-gray-300">
            Al no requerir descargas pesadas desde Google Play Store, puedes instalar y lanzar la aplicación de manera fluida usando el navegador Chrome en Android:
          </p>

          <ol className="list-decimal list-inside space-y-3.5 mt-2 pl-1 text-gray-300">
            <li>
              Abre el navegador <strong>Google Chrome</strong> en tu celular o tableta.
            </li>
            <li>
              Navega a la URL compartida de tu aplicación: 
              <br />
              <code className="text-xs bg-black p-1 px-2 rounded border border-white/[0.08] text-cyan-400 block mt-1.5 select-all overflow-x-auto whitespace-nowrap">
                {window.location.origin}
              </code>
            </li>
            <li>
              Presiona el botón de los <strong>tres puntos verticales (Menú)</strong> en la esquina superior derecha de Chrome.
            </li>
            <li>
              Selecciona la opción <strong>&quot;Agregar a la pantalla principal&quot;</strong> o <strong>&quot;Instalar Aplicación&quot;</strong>.
            </li>
            <li>
              ¡Listo! Ahora tendrás un ícono de acceso directo premium OBD2 en tu pantalla de inicio Android. Al abrirlo, se desplegará en <strong>Pantalla Completa</strong>, ocultando las barras del navegador web, para convertirse en un tablero de carreras inmersivo para montar en el cluster o consola central de tu carro.
            </li>
          </ol>

          <div className="bg-cyan-500/5 border border-cyan-500/10 p-3.5 rounded mt-3 flex gap-2.5 items-start">
            <Tablet className="text-cyan-400 shrink-0 mt-0.5" size={17} />
            <div className="text-xs text-cyan-100">
              <strong>Tip de Carrera:</strong> Si usas una tableta Android de 7 o 10 pulgadas empotrada en el panel del coche, actívale la rotación automática para visualizar el modo <strong>Fórmula KTuner</strong> de forma horizontal en un soporte rígido.
            </div>
          </div>
        </div>
      )}

      {/* Bluetooth Setup information */}
      {activeSegment === 'bt' && (
        <div className="flex flex-col gap-4 bg-slate-900/40 p-5 rounded-xl border border-slate-900/60 leading-relaxed text-sm">
          <h3 className="text-sm font-black uppercase tracking-wider text-[#ff7700] mb-2 flex items-center gap-1.5">
            <Bluetooth size={17} /> Conectando la ECU por Web Serial o Web Bluetooth:
          </h3>
          <p className="text-gray-300">
            Los adaptadores OBD o chips Bluetooth varían en su tipo de transmisión. Dependiendo de tu hardware, sigue la guía adecuada:
          </p>

          <div className="p-4 bg-cyan-950/40 border border-[#00f0ff]/20 rounded-xl mb-2">
            <h4 className="font-extrabold uppercase text-xs text-[#00f0ff] flex items-center gap-1.5 mb-2">
              📟 Opción A: Módulo ZS-040 (HC-05 / HC-06 / Bluetooth Classic)
            </h4>
            <p className="text-xs text-gray-300 leading-relaxed mb-3">
              Módulos como el <strong>ZS-040 / HC-05</strong> son dispositivos de <strong>Bluetooth Clásico (SPP)</strong>. Google Chrome no permite buscarlos con Web Bluetooth directamente. Sin embargo, puedes conectarlos mapeándolos como un puerto serial virtual usando nuestra función <strong>Web Serial API</strong>:
            </p>
            <ol className="list-decimal list-inside space-y-2 text-xs text-gray-300 pl-1">
              <li>
                <strong>Paso 1:</strong> Vincula y empareja el Bluetooth de tu ZS-040/HC-05 con la configuración de Bluetooth nativa de tu computadora o celular Android (el PIN por defecto usualmente es <code className="bg-black/60 px-1.5 py-0.5 rounded text-amber-500 font-mono">1234</code> o <code className="bg-black/60 px-1.5 py-0.5 rounded text-amber-500 font-mono">0000</code>).
              </li>
              <li>
                <strong>Paso 2:</strong> Al emparejarse, tu sistema operativo creará un <strong>puerto COM virtual de salida (COM Port)</strong>.
              </li>
              <li>
                <strong>Paso 3:</strong> Presiona el botón azul brillante <strong>&quot;CONECTAR SERIAL (ZS-040)&quot;</strong> arriba en el encabezado de esta App.
              </li>
              <li>
                <strong>Paso 4:</strong> Selecciona el puerto COM correspondiente a tu módulo en la lista de Chrome y haz clic en <strong>Conectar</strong>. ¡La sintonización en vivo a 38400 bps se activará de inmediato!
              </li>
            </ol>
          </div>

          <div className="p-4 bg-blue-950/30 border border-blue-500/20 rounded-xl">
            <h4 className="font-extrabold uppercase text-xs text-blue-400 flex items-center gap-1.5 mb-2">
              🌐 Opción B: Escáneres OBD2 BLE (Bluetooth Low Energy)
            </h4>
            <ol className="list-decimal list-inside space-y-2 text-xs text-gray-300 pl-1">
              <li>
                Conecta tu adaptador físico BLE OBDII al puerto de diagnóstico de tu vehículo/moto.
              </li>
              <li>
                Pon el vehículo en contacto/encendido.
              </li>
              <li>
                Presiona el botón <strong>&quot;ESCANEAR BLE&quot;</strong> en la pestaña superior de esta aplicación.
              </li>
              <li>
                Selecciona tu adaptador de la lista emergente y presiona <strong>Vincular</strong>.
              </li>
            </ol>
          </div>

          <div className="bg-amber-500/5 border border-amber-500/10 p-4 rounded-lg mt-2 font-sans">
            <div className="flex items-center gap-2 mb-1.5">
              <AlertCircle size={15} className="text-amber-500" />
              <span className="text-xs font-black uppercase text-amber-500 tracking-wider">Compatibilidad de Chip y Velocidad Baud</span>
            </div>
            <p className="text-xs text-gray-400">
              Para Honda OBD1 (P28 con Crome QD3 datalogging), el módulo <strong>ZS-040</strong> transmite los bytes a una velocidad predeterminada de <strong>38400 bps</strong>. Nuestra interfaz de Web Serial abre el flujo de datos optimizado para recibir los PIDs de RPM, TPS, MAP e inyector en tiempo real con latencia ultra baja.
            </p>
          </div>
        </div>
      )}

      {/* OBD-II / ELM327 Protocols info */}
      {activeSegment === 'obd2' && (
        <div className="flex flex-col gap-4 bg-slate-900/40 p-5 rounded-xl border border-slate-900/60 leading-relaxed text-sm">
          <h3 className="text-sm font-black uppercase tracking-wider text-[#ff7700] mb-2 flex items-center gap-1.5">
            <Cpu size={17} /> Protocolos Técnicos Soportados y ELM327:
          </h3>
          <p className="text-gray-300">
            El chip ELM327 traduce las señales eléctricas de los buses del auto (CAN, K-Line, etc.) en texto simple ASCII que nuestra app lee y decodifica por Bluetooth en milisegundos.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
            <div className="bg-slate-950 p-4 rounded-lg border border-slate-800">
              <span className="text-xs font-black uppercase text-cyan-400 block mb-1">PIDs Estándares Solicitados:</span>
              <ul className="text-xs font-mono space-y-1 text-gray-400">
                <li>• 010C : RPM del Motor (RPM)</li>
                <li>• 010D : Velocidad del Carro (Speed)</li>
                <li>• 0105 : Coolant Engine Temperature (ECT)</li>
                <li>• 010B : Presión de Boost / MAP</li>
                <li>• 010F : Intake Air Temperature (IAT)</li>
                <li>• 0111 : Mariposa Aceleradora / TPS</li>
                <li>• 0114 : Sonda Lambda / AFR</li>
              </ul>
            </div>
            
            <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 flex flex-col justify-between">
              <div>
                <span className="text-xs font-black uppercase text-cyan-400 block mb-1">Protocolos Automotrices:</span>
                <p className="text-xs text-gray-400">
                  Soporta la autodetección de protocolos mediante el protocolo CAN Bus de alta velocidad de 500kbaudios (SAE J1939, ISO 15765-4, KWP2000), garantizando compatibilidad con vehículos Honda, Toyota, Nissan, General Motors, Ford, VAG y más.
                </p>
              </div>
              
              <div className="flex items-center gap-1.5 text-[10px] text-gray-500 font-bold border-t border-slate-900 pt-2 mt-2">
                <Info size={11} className="text-gray-400" /> Registros de Logs guardados en formato CSV legible por sintonizadores de KTuner.
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
