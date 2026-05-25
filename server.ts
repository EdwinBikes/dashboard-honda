/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Initialize Gemini if key exists
  let ai: GoogleGenAI | null = null;
  if (process.env.GEMINI_API_KEY) {
    ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }

  // API Route for Gemini analysis
  app.post('/api/gemini/analyze', async (req, res) => {
    try {
      const { logs, activeDtcCodes } = req.body;

      if (!ai) {
        return res.status(500).json({
          error: 'Servicio de Diagnóstico con IA no inicializado. Asegúrate de configurar la variable de entorno GEMINI_API_KEY en Configuración.'
        });
      }

      const prompt = `
        Actúa como un Ingeniero Automotriz experto, Especialista en Telemetría Electrónica de Motores, Tuning y Diagnóstico OBD2 / ECU.
        Analiza detalladamente los siguientes datos de telemetría en tiempo real de la ECU del carro para ofrecer un reporte experto en español:

        CÓDIGOS DE ERROR ACTIVOS (DTC - Diagnostic Trouble Codes):
        ${activeDtcCodes && activeDtcCodes.length > 0 
          ? activeDtcCodes.map((dtc: any) => `- [${dtc.code}] ${dtc.system}: ${dtc.description} (Nivel de gravedad: ${dtc.severity})`).join('\n')
          : 'Ningún código de error (DTC) activo detectado en la ECU.'}

        DATOS ESTADÍSTICOS DE LA TELEMETRÍA (Logs de Motor):
        - RPM Promedio: ${logs?.avgRpm || 'N/A'} (RPM Máximo alcanzado: ${logs?.maxRpm || 'N/A'} RPM)
        - Temperatura de Refrigerante Máxima (ECT): ${logs?.maxCoolant || 'N/A'} °C
        - Presión Máxima de Boost/Múltiple (MAP): ${logs?.maxBoost || 'N/A'} psi/bar
        - Relación Aire-Combustible Promedio (AFR): ${logs?.avgAfr || '14.7'}
        - Temperatura Máxima del Aire de Admisión (IAT): ${logs?.maxIntakeTemp || 'N/A'} °C
        - Carga Máxima del Motor Calculada: ${logs?.maxLoad || 'N/A'} %
        - Voltaje de Batería Promedio: ${logs?.avgVoltage || 'N/A'} V

        DATOS RECIENTES DE TELEMETRÍA DEL REGISTRO (LOG):
        ${JSON.stringify(logs?.points || [])}

        Por favor, redacta un reporte exhaustivo e interactivo en español, estructurado de la siguiente forma utilizando Markdown limpio:

        ### 📋 Reporte de Salud del Motor
        * Ofrece un veredicto general (Excelente, Con precauciones, Alertas Críticas).
        * Advierte con precisión si algún valor se sale de rango (temperatura de motor > 105°C indica recalentamiento, mezcla AFR < 11.5 o > 15.8 bajo carga, alternador entregando menos de 13.2V o más de 14.8V).
        * Explica posibles riesgos a corto y largo plazo según el estado actual detectado.

        ### ⚠️ Análisis Diagnóstico de DTCs
        * Si hay códigos de fallas, da una explicación técnica profunda y simplificada de por qué la ECU los disparó.
        * Enumera los componentes físicos específicos que podrían causar este comportamiento (p. ej., fuga de vacío para mezcla pobre, sensor MAF sucio, desgaste del sensor de O2, etc.).

        ### 🏎️ Evaluación de Rendimiento & Curvas de Tuning
        * Explica cómo se comporta el retraso del turbo (Turbo Lag), la respuesta de la mariposa de aceleración (TPS) y la coordinación del avance de encendido respecto a las RPM del motor.
        * Ofrece tips detallados de afinamiento (tuning) automotriz para mejorar la potencia, reducir el retraso o mejorar la eficiencia de combustible del automóvil bajo un tren de potencia óptimo.

        ### 🛠️ Plan de Acción Recomendado (Paso a Paso)
        * Describe las acciones inmediatas ordenadas por prioridad para resolver problemas o mejorar el rendimiento del coche. Incluye herramientas básicas sugeridas para el diagnóstico.

        Mantén un lenguaje apasionante para entusiastas de los autos y mecánicos, altamente profesional, técnico pero claro. Usa viñetas estilizadas y no menciones configuraciones internas de la API ni del servidor.
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: prompt,
      });

      res.json({ analysis: response.text });
    } catch (error: any) {
      console.error('Gemini analysis error:', error);
      res.status(500).json({ error: error.message || 'Error al procesar el diagnóstico con IA.' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
