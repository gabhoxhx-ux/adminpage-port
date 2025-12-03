// Initialize Supabase client
let supabase;
let currentUser = null;

// Activity log storage
let activityLog = [];

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    if (!validateConfig()) {
        showToast('Error de Configuración', 'Por favor actualiza config.js con tus credenciales de Supabase', 'error');
        return;
    }

    // Initialize Supabase
    supabase = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
    console.log('✅ Supabase client initialized');

    // Load stats
    initAuth().then(loadStats);

    // Event listeners
    document.getElementById('refreshStatsBtn').addEventListener('click', () => {
        const btn = document.getElementById('refreshStatsBtn');
        btn.classList.add('spinning');
        loadStats().finally(() => btn.classList.remove('spinning'));
    });

    document.getElementById('importBtn').addEventListener('click', () => {
        document.getElementById('csvFileInput').click();
    });

    document.getElementById('csvFileInput').addEventListener('change', handleFileSelect);
    document.getElementById('updateViewBtn').addEventListener('click', guard(updateSheetView));
    document.getElementById('recalculateBtn').addEventListener('click', guard(recalculateBenefits));
    document.getElementById('closeProgressBtn').addEventListener('click', () => {
        document.getElementById('progressSection').style.display = 'none';
    });

    // Auth events
    document.getElementById('authBtn').addEventListener('click', openAuthModal);
    document.getElementById('closeAuthModal').addEventListener('click', closeAuthModal);
    document.getElementById('authForm').addEventListener('submit', handleLogin);
    document.getElementById('logoutBtn').addEventListener('click', handleLogout);
});

// ============================================
// AUTH MANAGEMENT
// ============================================

async function initAuth() {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        setUser(session?.user || null);

        // Listen for auth state changes
        supabase.auth.onAuthStateChange((event, sess) => {
            setUser(sess?.user || null);
        });
    } catch (err) {
        console.error('Auth init error', err);
    }
}

function setUser(user) {
    currentUser = user;
    const authBtn = document.getElementById('authBtn');
    const loginBtn = document.getElementById('loginBtn');
    const logoutBtn = document.getElementById('logoutBtn');
    const hint = document.getElementById('authHint');

    if (user) {
        authBtn.title = 'Cuenta';
        hint.textContent = `Conectado como ${user.email}`;
        loginBtn.style.display = 'none';
        logoutBtn.style.display = 'inline-flex';
        // Enable actions by default when logged in
        toggleActions(true);
    } else {
        authBtn.title = 'Iniciar sesión';
        hint.textContent = 'Solo personal autorizado.';
        loginBtn.style.display = 'inline-flex';
        logoutBtn.style.display = 'none';
        // Disable admin actions until login
        toggleActions(false);
    }
}

function toggleActions(enabled) {
    document.getElementById('importBtn').disabled = !enabled;
    document.getElementById('updateViewBtn').disabled = !enabled;
    document.getElementById('recalculateBtn').disabled = !enabled;
}

function openAuthModal() {
    document.getElementById('authModal').style.display = 'flex';
}

function closeAuthModal() {
    document.getElementById('authModal').style.display = 'none';
}

async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    const btn = document.getElementById('loginBtn');
    const original = btn.innerHTML;
    try {
        btn.disabled = true;
        btn.innerHTML = '<span class="spinning" style="display:inline-block">🔄</span> Iniciando...';

        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;

        showToast('Bienvenido', `Autenticado como ${data.user.email}`, 'success');
        closeAuthModal();
    } catch (error) {
        console.error('Login error:', error);
        showToast('Error de Acceso', error.message || 'No se pudo iniciar sesión', 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = original;
    }
}

async function handleLogout() {
    try {
        await supabase.auth.signOut();
        showToast('Sesión cerrada', 'Has cerrado sesión correctamente', 'info');
        closeAuthModal();
    } catch (error) {
        console.error('Logout error:', error);
        showToast('Error', 'No se pudo cerrar sesión', 'error');
    }
}

function guard(fn) {
    return async (...args) => {
        if (!currentUser) {
            showToast('Acceso requerido', 'Inicia sesión para continuar', 'error');
            openAuthModal();
            return;
        }
        return fn(...args);
    };
}

// ============================================
// STATS DASHBOARD
// ============================================

async function loadStats() {
    try {
        // Total Employees
        const { count: employeeCount, error: empError } = await supabase
            .from('employees')
            .select('*', { count: 'exact', head: true })
            .eq('activo', true);

        if (empError) throw empError;
        document.getElementById('totalEmployees').textContent = employeeCount || 0;

        // Total Deliveries
        const { count: deliveryCount, error: delError } = await supabase
            .from('benefit_deliveries')
            .select('*', { count: 'exact', head: true });

        if (delError) throw delError;
        document.getElementById('totalDeliveries').textContent = deliveryCount || 0;

        // Total Poderes
        const { count: poderCount, error: podError } = await supabase
            .from('poder_simple')
            .select('*', { count: 'exact', head: true });

        if (podError) throw podError;
        document.getElementById('totalPoderes').textContent = poderCount || 0;

        // Last Sync (from sync_logs)
        const { data: lastSyncData, error: syncError } = await supabase
            .from('sync_logs')
            .select('sync_timestamp, status')
            .order('sync_timestamp', { ascending: false })
            .limit(1)
            .single();

        if (!syncError && lastSyncData) {
            const syncDate = new Date(lastSyncData.sync_timestamp);
            const timeAgo = getTimeAgo(syncDate);
            document.getElementById('lastSync').textContent = timeAgo;
            document.getElementById('syncStatus').textContent = 
                lastSyncData.status === 'success' ? '✅ Sistema actualizado' : '⚠️ Error en última sincronización';
        } else {
            document.getElementById('lastSync').textContent = 'Nunca';
            document.getElementById('syncStatus').textContent = 'No hay sincronizaciones';
        }

        console.log('✅ Stats loaded successfully');
    } catch (error) {
        console.error('Error loading stats:', error);
        showToast('Error', 'No se pudieron cargar las estadísticas', 'error');
    }
}

// ============================================
// CSV IMPORT
// ============================================

function handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Show file info
    const fileInfo = document.getElementById('fileInfo');
    const fileName = document.getElementById('fileName');
    const fileSize = document.getElementById('fileSize');
    
    fileName.textContent = file.name;
    fileSize.textContent = `(${formatFileSize(file.size)})`;
    fileInfo.style.display = 'flex';

    // Process CSV
    processCSV(file);
}

async function processCSV(file) {
    try {
        showToast('Procesando', 'Leyendo archivo CSV...', 'info');

        const text = await file.text();
        const lines = text.split('\n').filter(line => line.trim());

        if (lines.length < 2) {
            throw new Error('El archivo CSV está vacío o no tiene datos');
        }

        // Parse header
        const headers = lines[0].split(',').map(h => h.trim().toUpperCase());
        
        // Find column indices
        const cedulaIdx = findColumnIndex(headers, ['CEDULA', 'RUT', 'CI']);
        const nombreIdx = findColumnIndex(headers, ['NOMBRE', 'NOMBRES']);
        const apellidoIdx = findColumnIndex(headers, ['APELLIDO', 'APELLIDOS']);
        const cargoIdx = findColumnIndex(headers, ['CARGO', 'PUESTO', 'POSICION']);
        const tipoContratoIdx = findColumnIndex(headers, ['TIPO_CONTRATO', 'TIPOCONTRATO', 'CONTRATO']);
        const fechaIngresoIdx = findColumnIndex(headers, ['FECHA_INGRESO', 'FECHAINGRESO', 'INGRESO']);

        if (cedulaIdx === -1 || nombreIdx === -1 || apellidoIdx === -1) {
            throw new Error('El archivo CSV debe contener al menos las columnas: CEDULA, NOMBRE, APELLIDO');
        }

        // Parse employees
        const employees = [];
        for (let i = 1; i < lines.length; i++) {
            const values = lines[i].split(',').map(v => v.trim());
            if (values.length < 3) continue;

            const employee = {
                cedula: values[cedulaIdx],
                nombre: values[nombreIdx],
                apellido: values[apellidoIdx],
                cargo: cargoIdx !== -1 ? values[cargoIdx] : null,
                tipo_contrato: tipoContratoIdx !== -1 ? values[tipoContratoIdx] : 'indefinido',
                fecha_ingreso: fechaIngresoIdx !== -1 ? values[fechaIngresoIdx] : null
            };

            if (employee.cedula && employee.nombre && employee.apellido) {
                employees.push(employee);
            }
        }

        if (employees.length === 0) {
            throw new Error('No se encontraron empleados válidos en el archivo CSV');
        }

        console.log(`📋 Parsed ${employees.length} employees from CSV`);
        showToast('Archivo Procesado', `Se encontraron ${employees.length} empleados`, 'success');

        // Start import
        await importEmployees(employees);

    } catch (error) {
        console.error('Error processing CSV:', error);
        showToast('Error', error.message, 'error');
        
        // Hide file info on error
        document.getElementById('fileInfo').style.display = 'none';
        document.getElementById('csvFileInput').value = '';
    }
}

function findColumnIndex(headers, possibleNames) {
    for (const name of possibleNames) {
        const idx = headers.indexOf(name);
        if (idx !== -1) return idx;
    }
    return -1;
}

async function importEmployees(employees) {
    // Show progress section
    const progressSection = document.getElementById('progressSection');
    progressSection.style.display = 'block';
    progressSection.scrollIntoView({ behavior: 'smooth' });

    const progressBar = document.getElementById('progressBar');
    const progressText = document.getElementById('progressText');
    const importedCountEl = document.getElementById('importedCount');
    const errorCountEl = document.getElementById('errorCount');
    const errorLog = document.getElementById('errorLog');
    const errorList = document.getElementById('errorList');

    let imported = 0;
    let errors = 0;
    const errorMessages = [];

    // Reset
    progressBar.style.width = '0%';
    importedCountEl.textContent = '0';
    errorCountEl.textContent = '0';
    errorLog.style.display = 'none';
    errorList.innerHTML = '';

    for (let i = 0; i < employees.length; i++) {
        const employee = employees[i];
        const progress = ((i + 1) / employees.length) * 100;

        progressBar.style.width = `${progress}%`;
        progressText.textContent = `Importando empleado ${i + 1} de ${employees.length}: ${employee.nombre} ${employee.apellido}`;

        try {
            // Call Supabase RPC function import_employee
            const { data, error } = await supabase.rpc('import_employee', {
                p_cedula: employee.cedula,
                p_nombre: employee.nombre,
                p_apellido: employee.apellido,
                p_cargo: employee.cargo,
                p_tipo_contrato: employee.tipo_contrato,
                p_fecha_ingreso: employee.fecha_ingreso
            });

            if (error) throw error;

            imported++;
            importedCountEl.textContent = imported;

        } catch (error) {
            console.error(`Error importing ${employee.cedula}:`, error);
            errors++;
            errorCountEl.textContent = errors;
            errorMessages.push(`${employee.cedula} - ${employee.nombre} ${employee.apellido}: ${error.message}`);
        }

        // Small delay to prevent overwhelming the API
        await new Promise(resolve => setTimeout(resolve, 50));
    }

    // Show errors if any
    if (errors > 0) {
        errorLog.style.display = 'block';
        errorMessages.forEach(msg => {
            const li = document.createElement('li');
            li.textContent = msg;
            errorList.appendChild(li);
        });
    }

    // Update progress title
    document.getElementById('progressTitle').textContent = 'Importación Completa';
    progressText.textContent = `Proceso finalizado. ${imported} empleados importados, ${errors} errores.`;

    // Log activity
    addActivityLog('success', 'Importación de Nómina', 
        `Se importaron ${imported} empleados con ${errors} errores`);

    // Refresh stats
    loadStats();

    // Show toast
    if (errors === 0) {
        showToast('Importación Completa', `${imported} empleados importados exitosamente`, 'success');
    } else {
        showToast('Importación con Errores', `${imported} importados, ${errors} errores`, 'error');
    }

    // Reset file input
    document.getElementById('csvFileInput').value = '';
}

// ============================================
// UPDATE SHEET VIEW
// ============================================

async function updateSheetView() {
    const btn = document.getElementById('updateViewBtn');
    const originalText = btn.innerHTML;

    try {
        btn.disabled = true;
        btn.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="spinning">
                <polyline points="23 4 23 10 17 10"/>
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
            </svg>
            Actualizando...
        `;

        if (!CONFIG.APPS_SCRIPT_URL || CONFIG.APPS_SCRIPT_URL === 'YOUR_APPS_SCRIPT_DEPLOYMENT_URL_HERE') {
            throw new Error('Apps Script URL no configurada en config.js');
        }

        const response = await fetch(`${CONFIG.APPS_SCRIPT_URL}?action=updateview`, {
            method: 'GET',
            mode: 'no-cors' // Apps Script requires this
        });

        // Note: no-cors mode doesn't allow reading response, so we assume success
        addActivityLog('success', 'Vista Actualizada', 'Google Sheets sincronizado con Supabase');
        showToast('Éxito', 'Vista de nómina actualizada en Google Sheets', 'success');

        // Log sync
        await supabase.from('sync_logs').insert({
            sync_type: 'sheet_update',
            status: 'success',
            sync_timestamp: new Date().toISOString()
        });

        loadStats();

    } catch (error) {
        console.error('Error updating sheet view:', error);
        addActivityLog('error', 'Error al Actualizar Vista', error.message);
        showToast('Error', error.message, 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

// ============================================
// RECALCULATE BENEFITS
// ============================================

async function recalculateBenefits() {
    const btn = document.getElementById('recalculateBtn');
    const originalText = btn.innerHTML;

    try {
        btn.disabled = true;
        btn.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="spinning">
                <polyline points="1 4 1 10 7 10"/>
                <polyline points="23 20 23 14 17 14"/>
                <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/>
            </svg>
            Recalculando...
        `;

        // Call Supabase RPC function
        const { data, error } = await supabase.rpc('recalculate_all_employee_benefits');

        if (error) throw error;

        const empleadosProcesados = data?.empleados_procesados || 0;
        const beneficiosCreados = data?.beneficios_creados || 0;

        addActivityLog('success', 'Beneficios Recalculados', 
            `${empleadosProcesados} empleados procesados, ${beneficiosCreados} beneficios creados`);
        
        showToast('Éxito', `Recalculados: ${empleadosProcesados} empleados, ${beneficiosCreados} beneficios`, 'success');
        
        loadStats();

    } catch (error) {
        console.error('Error recalculating benefits:', error);
        addActivityLog('error', 'Error al Recalcular', error.message);
        showToast('Error', error.message, 'error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

// ============================================
// ACTIVITY LOG
// ============================================

function addActivityLog(type, title, description) {
    const logItem = {
        type,
        title,
        description,
        timestamp: new Date()
    };

    activityLog.unshift(logItem);
    
    // Keep only last 50 items
    if (activityLog.length > 50) {
        activityLog = activityLog.slice(0, 50);
    }

    renderActivityLog();
}

function renderActivityLog() {
    const logContainer = document.getElementById('activityLog');
    
    if (activityLog.length === 0) {
        logContainer.innerHTML = `
            <div class="log-empty">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                    <line x1="16" y1="13" x2="8" y2="13"/>
                    <line x1="16" y1="17" x2="8" y2="17"/>
                    <polyline points="10 9 9 9 8 9"/>
                </svg>
                <p>No hay actividad reciente</p>
            </div>
        `;
        return;
    }

    const html = activityLog.map(log => {
        const iconClass = log.type === 'success' ? 'success' : log.type === 'error' ? 'error' : 'info';
        const icon = log.type === 'success' 
            ? '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>'
            : log.type === 'error'
            ? '<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>'
            : '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>';

        return `
            <div class="log-item">
                <div class="log-icon ${iconClass}">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        ${icon}
                    </svg>
                </div>
                <div class="log-content">
                    <p class="log-title">${log.title}</p>
                    <p class="log-description">${log.description}</p>
                    <p class="log-time">${getTimeAgo(log.timestamp)}</p>
                </div>
            </div>
        `;
    }).join('');

    logContainer.innerHTML = html;
}

// ============================================
// TOAST NOTIFICATIONS
// ============================================

function showToast(title, message, type = 'info') {
    const container = document.getElementById('toastContainer');
    
    const icon = type === 'success'
        ? '<path d="M20 6L9 17l-5-5"/>'
        : type === 'error'
        ? '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>'
        : '<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>';

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <div class="toast-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                ${icon}
            </svg>
        </div>
        <div class="toast-content">
            <p class="toast-title">${title}</p>
            <p class="toast-message">${message}</p>
        </div>
    `;

    container.appendChild(toast);

    // Auto remove after 5 seconds
    setTimeout(() => {
        toast.style.animation = 'slideIn 0.3s ease-out reverse';
        setTimeout(() => toast.remove(), 300);
    }, 5000);
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function getTimeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);
    
    const intervals = {
        año: 31536000,
        mes: 2592000,
        semana: 604800,
        día: 86400,
        hora: 3600,
        minuto: 60
    };

    for (const [name, value] of Object.entries(intervals)) {
        const interval = Math.floor(seconds / value);
        if (interval >= 1) {
            return `Hace ${interval} ${name}${interval > 1 ? (name === 'mes' ? 'es' : 's') : ''}`;
        }
    }

    return 'Justo ahora';
}
