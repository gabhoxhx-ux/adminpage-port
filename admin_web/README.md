# Panel de Administración - Beneficios Guardias

Panel web profesional para administrar el sistema de beneficios de empleados.

## 🎯 Características

### 📊 Dashboard de Estadísticas
- Total de empleados activos
- Entregas de beneficios realizadas
- Poderes simples registrados
- Estado de última sincronización

### 📤 Importación de Nómina
- Subir archivo CSV con empleados
- Auto-detección de columnas (CEDULA, NOMBRE, APELLIDO, CARGO, etc.)
- Importación por lotes a Supabase
- Progreso en tiempo real con contador
- Log de errores detallado

### 🔄 Sincronización con Google Sheets
- Actualizar vista de nómina en Google Sheets
- Mantener Sheets como vista de solo lectura

### ⚙️ Recálculo de Beneficios
- Regenerar automáticamente beneficios para todos los empleados
- Útil después de importar nueva nómina o cambiar catálogo

### 📝 Registro de Actividad
- Log de todas las operaciones realizadas
- Timestamps con formato legible
- Iconos de estado (éxito, error, info)

## 🚀 Instalación

### 1. Configurar Credenciales

Edita `config.js` y reemplaza los valores:

```javascript
const CONFIG = {
    SUPABASE_URL: 'https://tu-proyecto.supabase.co',
    SUPABASE_ANON_KEY: 'tu-anon-key-aquí',
    APPS_SCRIPT_URL: 'https://script.google.com/macros/s/XXXXX/exec' // Opcional
};
```

### 2. Formato del CSV

El archivo CSV debe tener al menos estas columnas (el orden no importa):

```csv
CEDULA,NOMBRE,APELLIDO,CARGO,TIPO_CONTRATO,FECHA_INGRESO
1234567-8,Juan,Pérez,Guardia,indefinido,2024-01-15
9876543-2,María,González,Supervisor,plazo_fijo,2024-02-01
```

**Columnas requeridas:**
- `CEDULA` (o RUT, CI)
- `NOMBRE` (o NOMBRES)
- `APELLIDO` (o APELLIDOS)

**Columnas opcionales:**
- `CARGO` (o PUESTO, POSICION)
- `TIPO_CONTRATO` (o TIPOCONTRATO, CONTRATO) - default: "indefinido"
- `FECHA_INGRESO` (o FECHAINGRESO, INGRESO) - formato: YYYY-MM-DD

### 3. Requisitos de Base de Datos

Asegúrate de haber ejecutado las migraciones en Supabase:

- `migrations/002_migrate_to_supabase_first.sql` - Schema principal
- `migrations/003_auto_create_benefits.sql` - Trigger para auto-crear beneficios

Funciones RPC requeridas:
- `import_employee(p_cedula, p_nombre, p_apellido, p_cargo, p_tipo_contrato, p_fecha_ingreso)`
- `recalculate_all_employee_benefits()`

## 📦 Deployment

### Opción 1: GitHub Pages (Recomendado)

1. Sube los archivos a un repositorio de GitHub
2. Ve a Settings → Pages
3. Selecciona la rama y carpeta (`admin_web`)
4. Tu panel estará disponible en: `https://tu-usuario.github.io/tu-repo/`

### Opción 2: Vercel

```bash
# Instalar Vercel CLI
npm i -g vercel

# Desde la carpeta admin_web
cd admin_web
vercel
```

Sigue las instrucciones. Tu panel estará en `https://tu-proyecto.vercel.app`

### Opción 3: Netlify

1. Arrastra la carpeta `admin_web` a [Netlify Drop](https://app.netlify.com/drop)
2. ¡Listo! Tu panel está en línea

### Opción 4: Servidor Propio

Simplemente sube los archivos a tu servidor web (Apache, Nginx, etc.)

```bash
# Copiar archivos
scp -r admin_web/* user@servidor:/var/www/html/admin/
```

## 🔒 Seguridad

### Recomendaciones:

1. **Protección con contraseña**: Usa HTTP Basic Auth en tu servidor

   Apache (`.htaccess`):
   ```apache
   AuthType Basic
   AuthName "Administración"
   AuthUserFile /ruta/.htpasswd
   Require valid-user
   ```

   Nginx:
   ```nginx
   location /admin {
       auth_basic "Administración";
       auth_basic_user_file /etc/nginx/.htpasswd;
   }
   ```

2. **Restricción por IP**: Solo permite acceso desde IPs de la oficina

3. **URL secreta**: No compartas el link del panel públicamente

4. **Supabase RLS**: Asegúrate de tener Row Level Security habilitado en las tablas sensibles

## 🎨 Personalización

### Cambiar colores

Edita `styles.css`, sección `:root`:

```css
:root {
    --primary: #3B82F6;     /* Color principal */
    --secondary: #10B981;   /* Color secundario */
    --tertiary: #8B5CF6;    /* Color terciario */
}
```

### Cambiar logo

Reemplaza el SVG en `index.html` línea 17:

```html
<svg width="32" height="32" viewBox="0 0 32 32">
    <!-- Tu logo aquí -->
</svg>
```

## 🐛 Troubleshooting

### "Supabase configuration is not set"
- Verifica que actualizaste `config.js` con tus credenciales reales

### "No se pudieron cargar las estadísticas"
- Verifica que la URL de Supabase es correcta
- Verifica que el Anon Key tiene los permisos necesarios
- Revisa la consola del navegador (F12) para ver errores

### Errores al importar CSV
- Verifica que el archivo tiene las columnas: CEDULA, NOMBRE, APELLIDO
- Verifica que ejecutaste las migraciones SQL en Supabase
- Verifica que existe la función RPC `import_employee`

### "Apps Script URL no configurada"
- La sincronización con Google Sheets es opcional
- Si no la necesitas, simplemente no uses el botón "Actualizar Vista"

## 📱 Responsive

El panel es completamente responsive y funciona en:
- Desktop (recomendado para CSV upload)
- Tablet
- Mobile (visualización de stats)

## 🔄 Flujo de Trabajo Completo

1. **HR prepara CSV** con empleados de la quincena/mes
2. **Admin abre panel web** (`https://tu-dominio.com/admin`)
3. **Sube CSV** mediante botón "Importar Nómina"
4. **Sistema importa** empleados uno por uno (progreso en tiempo real)
5. **Trigger automático** crea beneficios PENDING para cada empleado
6. **Admin revisa stats** y log de actividad
7. **Opcional**: Actualiza vista en Google Sheets
8. **Listo**: Empleados disponibles en app móvil

## 📚 Tecnologías

- HTML5 / CSS3 / Vanilla JavaScript
- [Supabase JS SDK](https://github.com/supabase/supabase-js) v2
- Google Fonts (Inter)
- Sin frameworks - ultra ligero (~50KB total)

## 📄 Licencia

Parte del proyecto Beneficios Guardias Flutter.

---

**¿Preguntas?** Revisa la documentación del proyecto principal o contacta al equipo de desarrollo.
