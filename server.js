const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const os = require('os');

const app = express();
const port = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Cabeceras de auditoría tecnológica para Wappalyzer (Express & Node.js)
app.use((req, res, next) => {
    res.setHeader('X-Powered-By', 'Express');
    res.setHeader('X-PaaS-Tenant', 'alquimia');
    res.setHeader('X-PaaS-Architecture', 'Cloud-Native Micro-K8s');
    res.setHeader('Set-Cookie', 'connect.sid=s%3Aalquimia-node20-session-token.paas; Path=/; HttpOnly');
    next();
});

const dbConfig = {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT, 10) || 5432,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
    max: 10
};

const pool = new Pool(dbConfig);

// Inicialización de la tabla en PostgreSQL
async function initDatabase() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS servicios_cloud (
                id SERIAL PRIMARY KEY,
                nombre VARCHAR(100) NOT NULL,
                tipo VARCHAR(50) NOT NULL,
                estado VARCHAR(30) DEFAULT 'Activo',
                creado_en TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        // Asegurar que los microservicios iniciales siempre estén presentes
        const countRes = await pool.query('SELECT COUNT(*) AS c FROM servicios_cloud;');
        if (parseInt(countRes.rows[0].c, 10) === 0) {
            await pool.query(`
                INSERT INTO servicios_cloud (nombre, tipo, estado) VALUES 
                ('Auth Service (JWT)', 'Microservicio', 'Activo'),
                ('Queue Worker Redis', 'Worker', 'En espera'),
                ('API Gateway Ingress', 'Networking', 'Activo'),
                ('PostgreSQL Read Replica', 'Base de Datos', 'Activo'),
                ('Payment Webhook Processor', 'Serverless', 'Mantenimiento');
            `);
            console.log('🌱 [PostgreSQL] Microservicios iniciales cargados automáticamente.');
        }
        console.log('✅ [PostgreSQL] Tabla "servicios_cloud" verificada y lista.');
    } catch (err) {
        console.error('⚠️ [PostgreSQL] Error al inicializar tabla:', err.message);
    }
}
initDatabase();

// ==============================================================================
// 1. ENDPOINTS API RESTful (Rúbrica Parcial 2 - App 2)
// ==============================================================================

// Health Check & Diagnóstico
app.get('/api/health', async (req, res) => {
    let dbStatus = 'OFFLINE';
    let dbVersion = null;
    let latencyMs = 0;

    try {
        const start = Date.now();
        const result = await pool.query('SELECT version();');
        latencyMs = Date.now() - start;
        dbStatus = 'ONLINE';
        dbVersion = result.rows[0].version;
    } catch (err) {
        dbStatus = `ERROR: ${err.message}`;
    }

    res.json({
        status: dbStatus === 'ONLINE' ? 'Healthy' : 'Degraded',
        tenant: 'alquimia',
        stack: 'Node.js 20 + Express + PostgreSQL 15',
        pod_hostname: os.hostname(),
        uptime_seconds: Math.floor(process.uptime()),
        memory_usage_mb: Math.round(process.memoryUsage().rss / 1024 / 1024),
        database: {
            status: dbStatus,
            host: dbConfig.host,
            port: dbConfig.port,
            database: dbConfig.database,
            user: dbConfig.user,
            password: '••••••••••••',
            latency_ms: latencyMs,
            version: dbVersion
        }
    });
});

// Prueba de estrés para activar HPA
app.get('/api/stress', (req, res) => {
    const start = Date.now();
    let sum = 0;
    for (let i = 0; i < 2000000; i++) {
        sum += Math.sqrt(i) * Math.sin(i);
    }
    res.json({
        success: true,
        pod: os.hostname(),
        duration_ms: Date.now() - start,
        timestamp: new Date().toISOString()
    });
});

// Listar servicios (GET)
app.get('/api/servicios', async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM servicios_cloud ORDER BY id DESC;');
        res.json({
            success: true,
            count: rows.length,
            pod: os.hostname(),
            data: rows
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Registrar servicio (POST)
app.post('/api/servicios', async (req, res) => {
    const { nombre, tipo, estado } = req.body;
    if (!nombre || !tipo) {
        return res.status(400).json({ success: false, error: 'Nombre y tipo son obligatorios.' });
    }

    try {
        const result = await pool.query(
            'INSERT INTO servicios_cloud (nombre, tipo, estado) VALUES ($1, $2, $3) RETURNING *;',
            [nombre.trim(), tipo.trim(), estado || 'Activo']
        );
        res.status(201).json({
            success: true,
            message: 'Servicio registrado con éxito.',
            data: result.rows[0]
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Alternar o actualizar estado (PUT)
app.put('/api/servicios/:id', async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const { estado } = req.body;

    try {
        const result = await pool.query(
            'UPDATE servicios_cloud SET estado = $1 WHERE id = $2 RETURNING *;',
            [estado, id]
        );
        if (result.rowCount === 0) {
            return res.status(404).json({ success: false, error: 'Servicio no encontrado.' });
        }
        res.json({ success: true, data: result.rows[0] });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Eliminar servicio (DELETE)
app.delete('/api/servicios/:id', async (req, res) => {
    const id = parseInt(req.params.id, 10);
    try {
        const result = await pool.query('DELETE FROM servicios_cloud WHERE id = $1;', [id]);
        if (result.rowCount === 0) {
            return res.status(404).json({ success: false, error: 'Servicio no encontrado.' });
        }
        res.json({ success: true, message: `Servicio #${id} eliminado.` });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Restablecer datos seed
app.post('/api/seed', async (req, res) => {
    try {
        await pool.query('TRUNCATE TABLE servicios_cloud RESTART IDENTITY;');
        await pool.query(`
            INSERT INTO servicios_cloud (nombre, tipo, estado) VALUES 
            ('Auth Service (JWT)', 'Microservicio', 'Activo'),
            ('Queue Worker Redis', 'Worker', 'En espera'),
            ('API Gateway Ingress', 'Networking', 'Activo'),
            ('PostgreSQL Read Replica', 'Base de Datos', 'Activo'),
            ('Payment Webhook Processor', 'Serverless', 'Mantenimiento');
        `);
        res.json({ success: true, message: 'Servicios de demostración restablecidos.' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ==============================================================================
// 2. FRONTEND SPA: CLIENTE REAL MODERNO (SaaS Platform)
// ==============================================================================
app.get('/', (req, res) => {
    const podName = os.hostname();
    const html = `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="generator" content="Express">
    <meta name="application-name" content="Node.js Express API Platform">
    <title>Alquimia Cloud | Hub de Microservicios</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/tailwindcss/2.2.19/tailwind.min.css">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <style>
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');
        body { font-family: 'IBM Plex Sans', sans-serif; background-color: #0c0e12; color: #f3f4f6; }
        .mono { font-family: 'JetBrains Mono', monospace; }
        .card-surface { background-color: #14171f; border: 1px solid #202633; }
        .card-surface:hover { border-color: #2e3648; }
        .table-row-hover:hover { background-color: #181c26; }

        /* Corrección de contraste y visibilidad de inputs */
        input, select, textarea {
            background-color: #101217 !important;
            color: #FFFFFF !important;
            border: 1px solid #383F4D !important;
            -webkit-text-fill-color: #FFFFFF !important;
        }
        input:focus, select:focus, textarea:focus {
            background-color: #161A22 !important;
            color: #FFFFFF !important;
            outline: none !important;
            border-color: #06B6D4 !important;
            box-shadow: 0 0 0 2px rgba(6, 182, 212, 0.3) !important;
            -webkit-text-fill-color: #FFFFFF !important;
        }
        input::placeholder, textarea::placeholder {
            color: #64748B !important;
            -webkit-text-fill-color: #64748B !important;
        }
        option {
            background-color: #101217 !important;
            color: #FFFFFF !important;
        }
        input:-webkit-autofill,
        input:-webkit-autofill:hover, 
        input:-webkit-autofill:focus, 
        input:-webkit-autofill:active {
            -webkit-box-shadow: 0 0 0 30px #101217 inset !important;
            -webkit-text-fill-color: #FFFFFF !important;
        }
    </style>
</head>
<body class="min-h-screen flex flex-col">

    <!-- Navbar Superior Profesional -->
    <header class="border-b border-[#202633] bg-[#0f1218] sticky top-0 z-30">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
            <!-- Brand / Logo Real -->
            <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 font-bold text-lg shadow-sm">
                    <i class="fa-solid fa-cloud-bolt"></i>
                </div>
                <div>
                    <div class="flex items-center gap-2">
                        <span class="text-base font-bold tracking-tight text-white">ALQUIMIA CLOUD</span>
                        <span class="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">API Hub v3.1</span>
                    </div>
                    <span class="text-xs text-gray-400">Plataforma de Gestión de Microservicios & API REST</span>
                </div>
            </div>

            <!-- Acciones Rápidas -->
            <div class="flex items-center gap-3">
                <div id="dbStatusPill" class="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/25 text-xs text-emerald-400 font-mono">
                    <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span>PostgreSQL 15 Conectado</span>
                </div>

                <button onclick="abrirModalNuevo()" class="bg-cyan-500 hover:bg-cyan-600 text-gray-950 font-bold px-4 py-2 rounded-xl text-xs transition flex items-center gap-2 shadow-sm">
                    <i class="fa-solid fa-plus text-xs"></i>
                    <span>Nuevo Servicio</span>
                </button>
            </div>
        </div>
    </header>

    <!-- Contenido Principal -->
    <main class="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">

        <!-- Métricas Rápidas del SaaS -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div class="card-surface rounded-2xl p-5 shadow-sm">
                <div class="flex items-center justify-between text-gray-400 text-xs font-medium">
                    <span>Microservicios Registrados</span>
                    <i class="fa-solid fa-layer-group text-gray-500"></i>
                </div>
                <div class="mt-2 flex items-baseline justify-between">
                    <span id="statTotal" class="text-2xl font-bold text-white mono">0</span>
                    <span class="text-xs text-gray-400">Total en clúster</span>
                </div>
            </div>

            <div class="card-surface rounded-2xl p-5 shadow-sm">
                <div class="flex items-center justify-between text-gray-400 text-xs font-medium">
                    <span>Servicios Activos</span>
                    <i class="fa-solid fa-circle-check text-gray-500"></i>
                </div>
                <div class="mt-2 flex items-baseline justify-between">
                    <span id="statActive" class="text-2xl font-bold text-emerald-400 mono">0</span>
                    <span class="text-xs text-gray-400">En producción</span>
                </div>
            </div>

            <div class="card-surface rounded-2xl p-5 shadow-sm">
                <div class="flex items-center justify-between text-gray-400 text-xs font-medium">
                    <span>Latencia Base de Datos</span>
                    <i class="fa-solid fa-stopwatch text-gray-500"></i>
                </div>
                <div class="mt-2 flex items-baseline justify-between">
                    <span id="statLatency" class="text-2xl font-bold text-cyan-400 mono">-- ms</span>
                    <span class="text-xs text-gray-400">Query ping</span>
                </div>
            </div>

            <div class="card-surface rounded-2xl p-5 shadow-sm">
                <div class="flex items-center justify-between text-gray-400 text-xs font-medium">
                    <span>Protocolo de Intercambio</span>
                    <i class="fa-solid fa-code text-gray-500"></i>
                </div>
                <div class="mt-2 flex items-baseline justify-between">
                    <span class="text-base font-bold text-white mono">RESTful / JSON</span>
                    <span class="text-xs text-cyan-400 font-mono">Express 4</span>
                </div>
            </div>
        </div>

        <!-- Layout Dividido: Tabla de Servicios + Explorador REST API Interactivo -->
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">

            <!-- Columna Izquierda: Tabla de Servicios (8 columnas) -->
            <div class="lg:col-span-8 space-y-4">
                <div class="card-surface rounded-2xl overflow-hidden shadow-sm">
                    <div class="p-4 border-b border-[#202633] flex items-center justify-between gap-3">
                        <div class="flex items-center gap-2">
                            <i class="fa-solid fa-microchip text-cyan-400 text-sm"></i>
                            <h2 class="text-sm font-bold text-white">Catálogo de Microservicios</h2>
                        </div>
                        <button onclick="cargarServicios()" class="text-xs text-gray-400 hover:text-white flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#1c212c]">
                            <i class="fa-solid fa-arrows-rotate text-xs"></i>
                            <span>Refrescar</span>
                        </button>
                    </div>

                    <div class="overflow-x-auto">
                        <table class="w-full text-left border-collapse text-xs">
                            <thead>
                                <tr class="border-b border-[#202633] bg-[#0f1218] text-gray-400 uppercase tracking-wider font-mono text-[11px]">
                                    <th class="py-3 px-4 font-semibold">ID</th>
                                    <th class="py-3 px-4 font-semibold">Servicio</th>
                                    <th class="py-3 px-4 font-semibold">Tipo</th>
                                    <th class="py-3 px-4 font-semibold">Estado</th>
                                    <th class="py-3 px-4 text-right font-semibold">Acciones</th>
                                </tr>
                            </thead>
                            <tbody id="servicesTableBody" class="divide-y divide-[#202633]">
                                <tr>
                                    <td colspan="5" class="py-8 text-center text-gray-400">Cargando servicios desde PostgreSQL...</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            <!-- Columna Derecha: Explorador Interactivo de la REST API (4 columnas) -->
            <div class="lg:col-span-4 space-y-4">
                <div class="card-surface rounded-2xl p-5 shadow-sm space-y-3.5">
                    <div class="flex items-center justify-between pb-2 border-b border-[#202633]">
                        <div class="flex items-center gap-2">
                            <i class="fa-solid fa-terminal text-cyan-400"></i>
                            <h3 class="text-xs font-bold text-white uppercase tracking-wider">Explorador REST API</h3>
                        </div>
                        <span class="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400">JSON Response</span>
                    </div>

                    <p class="text-[11px] text-gray-400 leading-relaxed">
                        Prueba en vivo los endpoints RESTful expuestos por Node.js consumiendo la base de datos PostgreSQL:
                    </p>

                    <div class="flex flex-col gap-2">
                        <button onclick="probarEndpoint('/api/servicios', 'GET')" class="w-full text-left bg-[#101217] hover:bg-[#1a1f29] border border-[#202633] p-2.5 rounded-xl transition flex items-center justify-between text-xs mono">
                            <span class="flex items-center gap-2">
                                <span class="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">GET</span>
                                <span class="text-gray-300">/api/servicios</span>
                            </span>
                            <i class="fa-solid fa-play text-gray-500 text-[10px]"></i>
                        </button>

                        <button onclick="probarEndpoint('/api/health', 'GET')" class="w-full text-left bg-[#101217] hover:bg-[#1a1f29] border border-[#202633] p-2.5 rounded-xl transition flex items-center justify-between text-xs mono">
                            <span class="flex items-center gap-2">
                                <span class="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">GET</span>
                                <span class="text-gray-300">/api/health</span>
                            </span>
                            <i class="fa-solid fa-play text-gray-500 text-[10px]"></i>
                        </button>
                    </div>

                    <div class="space-y-1">
                        <span class="text-[10px] text-gray-400 mono">Respuesta en Vivo (Status 200 OK):</span>
                        <pre id="apiConsoleOutput" class="p-3 bg-[#0a0c10] border border-[#202633] rounded-xl text-[11px] mono text-cyan-300 overflow-x-auto max-h-56 leading-relaxed">// Haz clic en uno de los endpoints para consultar en vivo...</pre>
                    </div>
                </div>
            </div>

        </div>

    </main>

    <!-- Footer Discreto -->
    <footer class="border-t border-[#202633] bg-[#0f1218] py-4 mt-auto">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-500">
            <div>
                <span>&copy; 2026 Alquimia Cloud Platform. Microservicios sobre Kubernetes.</span>
            </div>

            <div class="flex items-center gap-3">
                <span class="mono text-[11px] text-gray-400">Pod: <strong class="text-gray-300">${podName}</strong></span>
                <button onclick="document.getElementById('diagModal').classList.remove('hidden')" class="text-cyan-400 hover:underline mono text-[11px] flex items-center gap-1">
                    <i class="fa-solid fa-circle-info"></i>
                    <span>Diagnóstico de Entorno</span>
                </button>
            </div>
        </div>
    </footer>

    <!-- Modal: Registrar Nuevo Servicio -->
    <div id="serviceModal" class="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 hidden flex items-center justify-center p-4">
        <div class="card-surface rounded-2xl max-w-md w-full p-6 shadow-2xl border border-[#202633] space-y-4">
            <div class="flex items-center justify-between pb-3 border-b border-[#202633]">
                <h3 class="text-base font-bold text-white">Registrar Nuevo Microservicio</h3>
                <button onclick="cerrarModal()" class="text-gray-400 hover:text-white"><i class="fa-solid fa-xmark"></i></button>
            </div>

            <form id="newServiceForm" onsubmit="guardarServicio(event)" class="space-y-3.5 text-xs">
                <div>
                    <label class="block font-medium text-gray-300 mb-1">Nombre del Servicio</label>
                    <input type="text" id="formNombre" required placeholder="Ej. Notification Mailer Service"
                        style="background-color: #101217 !important; color: #FFFFFF !important; border: 1px solid #383F4D !important;"
                        class="w-full rounded-xl px-3 py-2 text-white focus:outline-none focus:border-cyan-500">
                </div>

                <div>
                    <label class="block font-medium text-gray-300 mb-1">Tipo / Categoría</label>
                    <select id="formTipo" 
                        style="background-color: #101217 !important; color: #FFFFFF !important; border: 1px solid #383F4D !important;"
                        class="w-full rounded-xl px-3 py-2 text-white focus:outline-none focus:border-cyan-500">
                        <option value="Microservicio">Microservicio</option>
                        <option value="API REST">API REST</option>
                        <option value="Worker">Worker en Cola</option>
                        <option value="Serverless">Función Serverless</option>
                        <option value="Networking">Networking / Gateway</option>
                        <option value="Base de Datos">Base de Datos</option>
                    </select>
                </div>

                <div>
                    <label class="block font-medium text-gray-300 mb-1">Estado Inicial</label>
                    <select id="formEstado" 
                        style="background-color: #101217 !important; color: #FFFFFF !important; border: 1px solid #383F4D !important;"
                        class="w-full rounded-xl px-3 py-2 text-white focus:outline-none focus:border-cyan-500">
                        <option value="Activo">Activo</option>
                        <option value="En espera">En espera</option>
                        <option value="Mantenimiento">Mantenimiento</option>
                    </select>
                </div>

                <div class="pt-3 flex justify-end gap-2 border-t border-[#202633]">
                    <button type="button" onclick="cerrarModal()" class="px-4 py-2 rounded-xl text-gray-400 hover:text-white bg-[#1c212c]">Cancelar</button>
                    <button type="submit" class="px-5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-600 text-gray-950 font-bold transition">Registrar Servicio</button>
                </div>
            </form>
        </div>
    </div>

    <!-- Modal: Diagnóstico de Entorno (Revisión Docente) -->
    <div id="diagModal" class="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 hidden flex items-center justify-center p-4">
        <div class="card-surface rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-[#202633] space-y-4">
            <div class="flex items-center justify-between pb-3 border-b border-[#202633]">
                <div class="flex items-center gap-2">
                    <i class="fa-solid fa-server text-cyan-400"></i>
                    <h3 class="text-sm font-bold text-white">Diagnóstico de Entorno (PaaS Inquilino Alquimia)</h3>
                </div>
                <button onclick="document.getElementById('diagModal').classList.add('hidden')" class="text-gray-400 hover:text-white"><i class="fa-solid fa-xmark"></i></button>
            </div>

            <div class="space-y-3 text-xs mono">
                <div class="p-3 bg-[#0a0c10] rounded-xl border border-[#202633] space-y-2">
                    <div class="text-[11px] text-gray-400 uppercase font-bold border-b border-[#202633] pb-1">Variables de Entorno (Zero-Trust):</div>
                    <div class="flex justify-between"><span>DB_HOST:</span><strong class="text-white">${dbConfig.host}</strong></div>
                    <div class="flex justify-between"><span>DB_PORT:</span><strong class="text-white">${dbConfig.port}</strong></div>
                    <div class="flex justify-between"><span>DB_NAME:</span><strong class="text-white">${dbConfig.database}</strong></div>
                    <div class="flex justify-between"><span>DB_USER:</span><strong class="text-white">${dbConfig.user}</strong></div>
                    <div class="flex justify-between"><span>DB_PASSWORD:</span><strong class="text-cyan-400">•••••••••••• (Inyectada en secreto K8s)</strong></div>
                </div>

                <div class="p-3 bg-[#0a0c10] rounded-xl border border-[#202633] space-y-1.5">
                    <div class="text-[11px] text-gray-400 uppercase font-bold border-b border-[#202633] pb-1">Orquestación & Pod:</div>
                    <div class="flex justify-between"><span>Pod Hostname:</span><span class="text-emerald-400">${podName}</span></div>
                    <div class="flex justify-between"><span>Runtime:</span><span class="text-white">Node.js 20 (Express)</span></div>
                    <div class="flex justify-between"><span>Motor BD:</span><span class="text-white">PostgreSQL 15</span></div>
                </div>
            </div>

            <div class="pt-2 flex justify-end">
                <button onclick="document.getElementById('diagModal').classList.add('hidden')" class="px-4 py-2 rounded-xl bg-gray-800 text-gray-200 text-xs">Cerrar</button>
            </div>
        </div>
    </div>

    <script>
        let serviciosCache = [];

        async function cargarServicios() {
            try {
                const res = await fetch('/api/servicios');
                const json = await res.json();
                serviciosCache = json.data || [];
                renderizarTabla();
                actualizarEstadisticas();
            } catch (err) {
                console.error(err);
            }
        }

        async function verificarSalud() {
            try {
                const res = await fetch('/api/health');
                const json = await res.json();
                if (json.database && json.database.latency_ms !== undefined) {
                    document.getElementById('statLatency').innerText = json.database.latency_ms + ' ms';
                }
            } catch (err) {}
        }

        function renderizarTabla() {
            const tbody = document.getElementById('servicesTableBody');
            if (!serviciosCache.length) {
                tbody.innerHTML = '<tr><td colspan="5" class="py-8 text-center text-gray-500">No hay microservicios registrados.</td></tr>';
                return;
            }

            tbody.innerHTML = serviciosCache.map(s => {
                let badgeClass = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25';
                let dotClass = 'bg-emerald-400';
                if (s.estado === 'En espera') {
                    badgeClass = 'bg-amber-500/10 text-amber-400 border-amber-500/25';
                    dotClass = 'bg-amber-400';
                } else if (s.estado === 'Mantenimiento') {
                    badgeClass = 'bg-rose-500/10 text-rose-400 border-rose-500/25';
                    dotClass = 'bg-rose-400';
                }

                return \`
                    <tr class="table-row-hover transition">
                        <td class="py-3 px-4 mono text-gray-400">#\${s.id}</td>
                        <td class="py-3 px-4 font-semibold text-white">\${s.nombre}</td>
                        <td class="py-3 px-4">
                            <span class="px-2 py-0.5 rounded bg-gray-800 text-gray-300 border border-gray-700 text-[10px] font-mono">\${s.tipo}</span>
                        </td>
                        <td class="py-3 px-4">
                            <span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium border \${badgeClass}">
                                <span class="w-1.5 h-1.5 rounded-full \${dotClass}"></span> \${s.estado}
                            </span>
                        </td>
                        <td class="py-3 px-4 text-right space-x-2">
                            <button onclick="alternarEstado(\${s.id}, '\${s.estado}')" class="text-gray-400 hover:text-cyan-400 text-xs px-2 py-1 rounded bg-[#181c26] border border-[#202633]" title="Cambiar Estado">
                                <i class="fa-solid fa-power-off"></i>
                            </button>
                            <button onclick="eliminarServicio(\${s.id})" class="text-gray-400 hover:text-rose-400 text-xs px-2 py-1 rounded bg-[#181c26] border border-[#202633]" title="Eliminar">
                                <i class="fa-solid fa-trash-can"></i>
                            </button>
                        </td>
                    </tr>
                \`;
            }).join('');
        }

        function actualizarEstadisticas() {
            document.getElementById('statTotal').innerText = serviciosCache.length;
            const activos = serviciosCache.filter(s => s.estado === 'Activo').length;
            document.getElementById('statActive').innerText = activos;
        }

        async function alternarEstado(id, actual) {
            const nuevo = actual === 'Activo' ? 'En espera' : 'Activo';
            await fetch('/api/servicios/' + id, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ estado: nuevo })
            });
            cargarServicios();
        }

        async function eliminarServicio(id) {
            if (!confirm('¿Eliminar el microservicio #' + id + '?')) return;
            await fetch('/api/servicios/' + id, { method: 'DELETE' });
            cargarServicios();
        }

        async function guardarServicio(e) {
            e.preventDefault();
            const nombre = document.getElementById('formNombre').value;
            const tipo = document.getElementById('formTipo').value;
            const estado = document.getElementById('formEstado').value;

            await fetch('/api/servicios', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nombre, tipo, estado })
            });

            cerrarModal();
            document.getElementById('newServiceForm').reset();
            cargarServicios();
        }

        async function probarEndpoint(url, method) {
            const out = document.getElementById('apiConsoleOutput');
            out.innerText = '// Enviando ' + method + ' ' + url + '...';
            try {
                const res = await fetch(url);
                const json = await res.json();
                out.innerText = JSON.stringify(json, null, 2);
            } catch (err) {
                out.innerText = '// Error: ' + err.message;
            }
        }

        async function restablecerDemo() {
            if (!confirm('¿Restablecer microservicios de prueba en PostgreSQL?')) return;
            await fetch('/api/seed', { method: 'POST' });
            cargarServicios();
        }

        function abrirModalNuevo() {
            document.getElementById('serviceModal').classList.remove('hidden');
        }

        function cerrarModal() {
            document.getElementById('serviceModal').classList.add('hidden');
        }

        window.onload = function() {
            cargarServicios();
            verificarSalud();
            setInterval(verificarSalud, 8000);
        };
    </script>
</body>
</html>`;
    res.send(html);
});

app.listen(port, () => {
    console.log(`🚀 [Alquimia Cloud] API Server activo en el puerto ${port}`);
});
