const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const os = require('os');

const app = express();
const port = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Cabeceras de auditoría tecnológica para Wappalyzer
app.use((req, res, next) => {
    res.setHeader('X-Powered-By', 'Express / Node.js 20');
    res.setHeader('X-PaaS-Tenant', 'alquimia');
    res.setHeader('X-PaaS-Architecture', 'Cloud-Native Micro-K8s');
    next();
});

const dbConfig = {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT, 10),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
    max: 10
};

const pool = new Pool(dbConfig);

// Inicialización de la tabla en PostgreSQL si no existe
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
        console.log('✅ [PostgreSQL] Tabla "servicios_cloud" verificada y lista.');
    } catch (err) {
        console.error('⚠️ [PostgreSQL] Error al inicializar tabla:', err.message);
    }
}
initDatabase();

// ==============================================================================
// 1. ENDPOINTS API RESTful (Rúbrica Parcial 2 - App 2)
// ==============================================================================

// Health Check & Diagnóstico de Infraestructura
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

// Listar todos los servicios cloud (GET)
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

// Crear nuevo servicio cloud (POST)
app.post('/api/servicios', async (req, res) => {
    const { nombre, tipo, estado } = req.body;
    if (!nombre || !tipo) {
        return res.status(400).json({ success: false, error: 'Los campos nombre y tipo son obligatorios.' });
    }

    try {
        const query = 'INSERT INTO servicios_cloud (nombre, tipo, estado) VALUES ($1, $2, $3) RETURNING *;';
        const values = [nombre.trim(), tipo.trim(), (estado || 'Activo').trim()];
        const { rows } = await pool.query(query, values);
        res.status(201).json({
            success: true,
            message: 'Servicio registrado exitosamente.',
            data: rows[0]
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Actualizar servicio cloud (PUT)
app.put('/api/servicios/:id', async (req, res) => {
    const id = parseInt(req.params.id, 10);
    const { nombre, tipo, estado } = req.body;

    if (isNaN(id) || !nombre || !tipo) {
        return res.status(400).json({ success: false, error: 'Parámetros inválidos.' });
    }

    try {
        const query = 'UPDATE servicios_cloud SET nombre = $1, tipo = $2, estado = $3 WHERE id = $4 RETURNING *;';
        const values = [nombre.trim(), tipo.trim(), (estado || 'Activo').trim(), id];
        const { rows } = await pool.query(query, values);

        if (rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Servicio no encontrado.' });
        }

        res.json({
            success: true,
            message: 'Servicio actualizado correctamente.',
            data: rows[0]
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Eliminar servicio cloud (DELETE)
app.delete('/api/servicios/:id', async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
        return res.status(400).json({ success: false, error: 'ID inválido.' });
    }

    try {
        const { rowCount } = await pool.query('DELETE FROM servicios_cloud WHERE id = $1;', [id]);
        if (rowCount === 0) {
            return res.status(404).json({ success: false, error: 'Servicio no encontrado.' });
        }
        res.json({
            success: true,
            message: `Servicio #${id} eliminado correctamente.`
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Poblado de demostración inicial (POST /api/servicios/seed)
app.post('/api/servicios/seed', async (req, res) => {
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
// 2. FRONTEND SPA MODERNO (Consumo de la API RESTful en vivo)
// ==============================================================================
app.get('/', (req, res) => {
    const podName = os.hostname();
    const html = `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>PaaS App 2 | Node.js REST API + PostgreSQL</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
    <style>
        body { font-family: 'IBM Plex Sans', sans-serif; background-color: #121417; color: #F5E9E7; }
        .mono { font-family: 'JetBrains Mono', monospace; }
        .card-glass { background-color: #181b20; border: 1px solid #282d37; }
        .badge-pill { display: inline-flex; align-items: center; gap: 0.35rem; padding: 0.15rem 0.6rem; border-radius: 9999px; font-size: 0.72rem; font-family: 'JetBrains Mono', monospace; }
    </style>
</head>
<body class="min-h-screen p-4 sm:p-6 lg:p-8">

    <div class="max-w-6xl mx-auto space-y-6">

        <!-- Top Header & Banner de Gobernanza PaaS -->
        <header class="card-glass rounded-2xl p-5 sm:p-6 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div class="flex items-center gap-4">
                <div class="w-12 h-12 rounded-xl bg-[#8A9DB1]/20 border border-[#8A9DB1]/40 flex items-center justify-center text-[#8A9DB1] text-2xl">
                    <i class="fa-brands fa-node-js"></i>
                </div>
                <div>
                    <div class="flex items-center gap-2">
                        <h1 class="text-xl sm:text-2xl font-bold tracking-tight text-white">Catálogo de Microservicios Cloud</h1>
                        <span class="badge-pill bg-[#8A9DB1]/20 text-[#8A9DB1] border border-[#8A9DB1]/30">Stack Moderno #2</span>
                    </div>
                    <p class="text-xs text-[#C1C0C2] mt-0.5">API RESTful en Node.js 20 (Express) conectada a PostgreSQL 15 administrada en PaaS (Tenant: <span class="mono text-white font-semibold">alquimia</span>)</p>
                </div>
            </div>

            <!-- Auditoría Pod & Réplicas en vivo -->
            <div class="flex items-center gap-2 w-full md:w-auto justify-end">
                <div class="card-glass px-3 py-2 rounded-xl text-right">
                    <span class="block text-[10px] text-[#C1C0C2] uppercase mono">Pod Kubernetes</span>
                    <span class="mono text-xs font-semibold text-[#ECC5C6] truncate max-w-[200px] block" title="${podName}">
                        <i class="fa-solid fa-cube text-[10px] mr-1"></i>${podName}
                    </span>
                </div>
                <div class="card-glass px-3 py-2 rounded-xl text-right">
                    <span class="block text-[10px] text-[#C1C0C2] uppercase mono">PostgreSQL 15</span>
                    <span id="dbBadge" class="badge-pill bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span> ONLINE
                    </span>
                </div>
            </div>
        </header>

        <!-- Banner de Variables de Entorno (Evidencia para Rúbrica) -->
        <section class="card-glass rounded-2xl p-4 sm:p-5 text-xs">
            <div class="flex items-center justify-between mb-3 border-b border-[#282d37] pb-2">
                <span class="font-bold text-[#C1C0C2] uppercase tracking-wider mono flex items-center gap-2">
                    <i class="fa-solid fa-shield-halved text-[#8A9DB1]"></i> Bóveda de Variables de Entorno Seguras (12-Factor App)
                </span>
                <span class="text-[11px] text-[#8A9DB1] mono">Sin credenciales expuestas en repositorio Git</span>
            </div>
            <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mono">
                <div class="bg-[#121417] p-2.5 rounded-lg border border-[#282d37]">
                    <span class="text-[10px] text-[#C1C0C2] block">DB_HOST</span>
                    <span class="text-white font-semibold truncate block" title="${dbConfig.host}">${dbConfig.host}</span>
                </div>
                <div class="bg-[#121417] p-2.5 rounded-lg border border-[#282d37]">
                    <span class="text-[10px] text-[#C1C0C2] block">DB_PORT</span>
                    <span class="text-white font-semibold block">${dbConfig.port}</span>
                </div>
                <div class="bg-[#121417] p-2.5 rounded-lg border border-[#282d37]">
                    <span class="text-[10px] text-[#C1C0C2] block">DB_NAME</span>
                    <span class="text-white font-semibold block">${dbConfig.database}</span>
                </div>
                <div class="bg-[#121417] p-2.5 rounded-lg border border-[#282d37]">
                    <span class="text-[10px] text-[#C1C0C2] block">DB_USER</span>
                    <span class="text-white font-semibold block">${dbConfig.user}</span>
                </div>
                <div class="bg-[#121417] p-2.5 rounded-lg border border-[#282d37]">
                    <span class="text-[10px] text-[#C1C0C2] block">DB_PASSWORD</span>
                    <span class="text-[#ECC5C6] font-semibold block">••••••••••••</span>
                </div>
                <div class="bg-[#121417] p-2.5 rounded-lg border border-[#282d37]">
                    <span class="text-[10px] text-[#C1C0C2] block">PORT</span>
                    <span class="text-[#8A9DB1] font-semibold block">${port}</span>
                </div>
            </div>
        </section>

        <!-- Barra de Herramientas y Acciones API -->
        <div class="card-glass rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div class="flex items-center gap-2">
                <button onclick="cargarServicios()" class="bg-[#181b20] hover:bg-[#282d37] border border-[#282d37] px-3.5 py-2 rounded-xl text-xs mono font-semibold flex items-center gap-1.5 transition">
                    <i class="fa-solid fa-rotate text-[#8A9DB1]"></i> Refrescar API
                </button>
                <button onclick="toggleJsonView()" class="bg-[#181b20] hover:bg-[#282d37] text-[#C1C0C2] border border-[#282d37] px-3.5 py-2 rounded-xl text-xs mono flex items-center gap-1.5 transition">
                    <i class="fa-solid fa-code text-[#ECC5C6]"></i> Inspeccionar JSON REST
                </button>
            </div>

            <div class="flex items-center gap-2 w-full sm:w-auto justify-end">
                <button onclick="restablecerSeed()" class="bg-[#181b20] hover:bg-[#282d37] text-[#C1C0C2] border border-[#282d37] px-3.5 py-2 rounded-xl text-xs mono flex items-center gap-1.5 transition">
                    <i class="fa-solid fa-rotate-left"></i> Restablecer Seed
                </button>
                <button onclick="abrirModalCrear()" class="bg-[#8A9DB1] hover:bg-[#9ab0c5] text-[#121417] font-bold px-4 py-2 rounded-xl text-xs mono flex items-center gap-2 shadow-sm transition">
                    <i class="fa-solid fa-plus"></i> Nuevo Servicio REST
                </button>
            </div>
        </div>

        <!-- Visor de Payload JSON en Vivo (Ocultable) -->
        <div id="jsonContainer" class="card-glass rounded-2xl p-4 hidden">
            <div class="flex items-center justify-between pb-2 mb-2 border-b border-[#282d37]">
                <span class="mono text-xs font-bold text-[#ECC5C6] flex items-center gap-2">
                    <i class="fa-solid fa-terminal"></i> Salida Cruda de la API (GET /api/servicios)
                </span>
                <span class="mono text-[10px] text-[#C1C0C2]">Content-Type: application/json</span>
            </div>
            <pre id="jsonViewer" class="mono text-xs bg-[#121417] p-3 rounded-xl border border-[#282d37] overflow-x-auto text-[#8A9DB1] max-h-60"></pre>
        </div>

        <!-- Tabla de Microservicios -->
        <div class="card-glass rounded-2xl overflow-hidden shadow-xl">
            <div class="overflow-x-auto">
                <table class="w-full text-left text-sm">
                    <thead class="bg-[#121417] text-[#C1C0C2] uppercase text-[11px] mono border-b border-[#282d37]">
                        <tr>
                            <th class="py-3.5 px-4 font-semibold">ID</th>
                            <th class="py-3.5 px-4 font-semibold">Microservicio / Recurso</th>
                            <th class="py-3.5 px-4 font-semibold">Tipo</th>
                            <th class="py-3.5 px-4 font-semibold">Estado</th>
                            <th class="py-3.5 px-4 font-semibold">Registrado</th>
                            <th class="py-3.5 px-4 font-semibold text-right">Acciones REST</th>
                        </tr>
                    </thead>
                    <tbody id="serviciosTbody" class="divide-y divide-[#282d37]/60">
                        <tr>
                            <td colspan="6" class="py-8 text-center text-[#C1C0C2] mono">
                                <i class="fa-solid fa-spinner fa-spin mr-2"></i> Cargando microservicios desde PostgreSQL...
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </div>

        <!-- Footer Informativo para el Parcial -->
        <footer class="text-center text-xs text-[#C1C0C2] pt-4 border-t border-[#282d37]/50 mono">
            Informática en la Nube • Parcial 2 (Cómputo 2) • Aplicación 2 (Stack Moderno Node.js 20 + PostgreSQL 15)
        </footer>

    </div>

    <!-- Modal Crear Servicio -->
    <div id="modalCrear" class="fixed inset-0 bg-black/70 backdrop-blur-sm hidden flex items-center justify-center p-4 z-50">
        <div class="card-glass rounded-2xl max-w-md w-full p-6 shadow-2xl border border-[#282d37] space-y-4">
            <div class="flex items-center justify-between border-b border-[#282d37] pb-3">
                <h3 class="text-base font-bold text-white flex items-center gap-2">
                    <i class="fa-solid fa-plus-circle text-[#8A9DB1]"></i> Registrar Microservicio en PostgreSQL
                </h3>
                <button onclick="cerrarModal('modalCrear')" class="text-[#C1C0C2] hover:text-white">&times;</button>
            </div>
            <form id="formCrear" onsubmit="guardarServicio(event)" class="space-y-3 text-xs">
                <div>
                    <label class="block text-[#C1C0C2] mono uppercase mb-1">Nombre del Servicio / API</label>
                    <input type="text" id="crear_nombre" required placeholder="Ej: Notification Worker (SNS)" class="w-full bg-[#121417] border border-[#282d37] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#8A9DB1]">
                </div>
                <div>
                    <label class="block text-[#C1C0C2] mono uppercase mb-1">Tipo de Servicio</label>
                    <select id="crear_tipo" class="w-full bg-[#121417] border border-[#282d37] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#8A9DB1]">
                        <option value="Microservicio">Microservicio REST</option>
                        <option value="Worker">Worker en Cola</option>
                        <option value="Networking">API Gateway / Ingress</option>
                        <option value="Base de Datos">Base de Datos / Cache</option>
                        <option value="Serverless">Función Serverless</option>
                    </select>
                </div>
                <div>
                    <label class="block text-[#C1C0C2] mono uppercase mb-1">Estado</label>
                    <select id="crear_estado" class="w-full bg-[#121417] border border-[#282d37] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#8A9DB1]">
                        <option value="Activo">Activo</option>
                        <option value="En espera">En espera</option>
                        <option value="Mantenimiento">Mantenimiento</option>
                    </select>
                </div>
                <div class="flex justify-end gap-2 pt-2">
                    <button type="button" onclick="cerrarModal('modalCrear')" class="px-4 py-2 rounded-xl border border-[#282d37] text-[#C1C0C2] hover:bg-[#282d37]">Cancelar</button>
                    <button type="submit" class="px-4 py-2 rounded-xl bg-[#8A9DB1] hover:bg-[#9ab0c5] text-[#121417] font-bold">Crear Servicio</button>
                </div>
            </form>
        </div>
    </div>

    <!-- Modal Editar Servicio -->
    <div id="modalEditar" class="fixed inset-0 bg-black/70 backdrop-blur-sm hidden flex items-center justify-center p-4 z-50">
        <div class="card-glass rounded-2xl max-w-md w-full p-6 shadow-2xl border border-[#282d37] space-y-4">
            <div class="flex items-center justify-between border-b border-[#282d37] pb-3">
                <h3 class="text-base font-bold text-white flex items-center gap-2">
                    <i class="fa-solid fa-pen-to-square text-[#ECC5C6]"></i> Modificar Microservicio
                </h3>
                <button onclick="cerrarModal('modalEditar')" class="text-[#C1C0C2] hover:text-white">&times;</button>
            </div>
            <form id="formEditar" onsubmit="actualizarServicio(event)" class="space-y-3 text-xs">
                <input type="hidden" id="edit_id">
                <div>
                    <label class="block text-[#C1C0C2] mono uppercase mb-1">Nombre del Servicio / API</label>
                    <input type="text" id="edit_nombre" required class="w-full bg-[#121417] border border-[#282d37] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#ECC5C6]">
                </div>
                <div>
                    <label class="block text-[#C1C0C2] mono uppercase mb-1">Tipo de Servicio</label>
                    <select id="edit_tipo" class="w-full bg-[#121417] border border-[#282d37] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#ECC5C6]">
                        <option value="Microservicio">Microservicio REST</option>
                        <option value="Worker">Worker en Cola</option>
                        <option value="Networking">API Gateway / Ingress</option>
                        <option value="Base de Datos">Base de Datos / Cache</option>
                        <option value="Serverless">Función Serverless</option>
                    </select>
                </div>
                <div>
                    <label class="block text-[#C1C0C2] mono uppercase mb-1">Estado</label>
                    <select id="edit_estado" class="w-full bg-[#121417] border border-[#282d37] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-[#ECC5C6]">
                        <option value="Activo">Activo</option>
                        <option value="En espera">En espera</option>
                        <option value="Mantenimiento">Mantenimiento</option>
                    </select>
                </div>
                <div class="flex justify-end gap-2 pt-2">
                    <button type="button" onclick="cerrarModal('modalEditar')" class="px-4 py-2 rounded-xl border border-[#282d37] text-[#C1C0C2] hover:bg-[#282d37]">Cancelar</button>
                    <button type="submit" class="px-4 py-2 rounded-xl bg-[#ECC5C6] hover:bg-[#ffd9da] text-[#121417] font-bold">Guardar Cambios</button>
                </div>
            </form>
        </div>
    </div>

    <script>
        let serviciosActuales = [];

        async function cargarServicios() {
            try {
                const res = await fetch('/api/servicios');
                const json = await res.json();
                serviciosActuales = json.data || [];
                document.getElementById('jsonViewer').innerText = JSON.stringify(json, null, 2);
                renderizarTabla();
            } catch (err) {
                document.getElementById('serviciosTbody').innerHTML = \`
                    <tr><td colspan="6" class="py-8 text-center text-rose-400 mono">
                        Error al consultar /api/servicios: \${err.message}
                    </td></tr>\`;
            }
        }

        function renderizarTabla() {
            const tbody = document.getElementById('serviciosTbody');
            if (serviciosActuales.length === 0) {
                tbody.innerHTML = \`
                    <tr><td colspan="6" class="py-8 text-center text-[#C1C0C2] mono">
                        No hay servicios registrados en la base de datos PostgreSQL.
                    </td></tr>\`;
                return;
            }

            tbody.innerHTML = serviciosActuales.map(s => {
                let badgeClass = 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30';
                if (s.estado === 'En espera') badgeClass = 'bg-amber-500/20 text-amber-400 border border-amber-500/30';
                if (s.estado === 'Mantenimiento') badgeClass = 'bg-rose-500/20 text-rose-400 border border-rose-500/30';

                return \`
                    <tr class="hover:bg-[#1c2026] transition">
                        <td class="py-3 px-4 mono text-xs text-[#C1C0C2]">#\${s.id}</td>
                        <td class="py-3 px-4 font-semibold text-white">\${s.nombre}</td>
                        <td class="py-3 px-4">
                            <span class="badge-pill bg-[#282d37] text-[#8A9DB1] border border-[#282d37]/80">\${s.tipo}</span>
                        </td>
                        <td class="py-3 px-4">
                            <span class="badge-pill \${badgeClass}">\${s.estado}</span>
                        </td>
                        <td class="py-3 px-4 mono text-xs text-[#C1C0C2]">\${(s.creado_en || '').substring(0, 16)}</td>
                        <td class="py-3 px-4 text-right">
                            <div class="flex items-center justify-end gap-1.5">
                                <button onclick="abrirModalEditar(\${s.id})" class="bg-[#121417] hover:bg-[#282d37] text-[#8A9DB1] p-1.5 rounded-lg border border-[#282d37] transition" title="Editar">
                                    <i class="fa-solid fa-pen-to-square text-xs"></i>
                                </button>
                                <button onclick="eliminarServicio(\${s.id})" class="bg-[#121417] hover:bg-rose-950/50 text-rose-400 p-1.5 rounded-lg border border-[#282d37] transition" title="Eliminar">
                                    <i class="fa-solid fa-trash-can text-xs"></i>
                                </button>
                            </div>
                        </td>
                    </tr>
                \`;
            }).join('');
        }

        async function guardarServicio(e) {
            e.preventDefault();
            const data = {
                nombre: document.getElementById('crear_nombre').value,
                tipo: document.getElementById('crear_tipo').value,
                estado: document.getElementById('crear_estado').value
            };
            await fetch('/api/servicios', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            cerrarModal('modalCrear');
            document.getElementById('formCrear').reset();
            cargarServicios();
        }

        function abrirModalEditar(id) {
            const s = serviciosActuales.find(x => x.id === id);
            if (!s) return;
            document.getElementById('edit_id').value = s.id;
            document.getElementById('edit_nombre').value = s.nombre;
            document.getElementById('edit_tipo').value = s.tipo;
            document.getElementById('edit_estado').value = s.estado;
            document.getElementById('modalEditar').classList.remove('hidden');
        }

        async function actualizarServicio(e) {
            e.preventDefault();
            const id = document.getElementById('edit_id').value;
            const data = {
                nombre: document.getElementById('edit_nombre').value,
                tipo: document.getElementById('edit_tipo').value,
                estado: document.getElementById('edit_estado').value
            };
            await fetch(\`/api/servicios/\${id}\`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            cerrarModal('modalEditar');
            cargarServicios();
        }

        async function eliminarServicio(id) {
            if (!confirm(\`¿Confirma eliminar el microservicio #\${id}?\`)) return;
            await fetch(\`/api/servicios/\${id}\`, { method: 'DELETE' });
            cargarServicios();
        }

        async function restablecerSeed() {
            if (!confirm('¿Restablecer microservicios al seed inicial?')) return;
            await fetch('/api/servicios/seed', { method: 'POST' });
            cargarServicios();
        }

        function toggleJsonView() {
            document.getElementById('jsonContainer').classList.toggle('hidden');
        }

        function abrirModalCrear() {
            document.getElementById('modalCrear').classList.remove('hidden');
        }

        function cerrarModal(id) {
            document.getElementById(id).classList.add('hidden');
        }

        // Carga inicial
        cargarServicios();
    </script>
</body>
</html>`;
    res.send(html);
});

app.listen(port, () => {
    console.log(`🚀 [PaaS Node API] Servidor activo escuchando en http://0.0.0.0:${port}`);
});
