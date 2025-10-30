// ===== UTILIDADES =====
const currency = (n) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0 }).format(n);
const formatDate = (iso) => iso ? new Date(iso).toLocaleDateString('es-CO') : '';
const formatDateTime = (iso) => iso ? new Date(iso).toLocaleString('es-CO') : '';
const today = () => new Date().toISOString().split('T')[0];

// Estado compartido del panel
let notificaciones = [];
let actividadReciente = [];
let alertas = [];



// Función para actualizar las estadísticas del dashboard
async function actualizarEstadisticas() {
    try {
        const stats = await API.get('/api/dashboard/stats');
        document.getElementById('pedidos-hoy').textContent = stats.pedidos_hoy;
        document.getElementById('reservas-hoy').textContent = stats.reservas_hoy;
        document.getElementById('ventas-hoy').textContent = currency(stats.ventas_hoy);
        document.getElementById('mesas-ocupadas').textContent = `${stats.mesas_ocupadas}/${stats.total_mesas}`;
    } catch (error) {
        console.error('Error al actualizar estadísticas:', error);
    }
}

// Función para actualizar el indicador de conexión
function actualizarEstadoConexion(conectado) {
    const indicator = document.getElementById('connectionStatus');
    if (indicator) {
        const dot = indicator.querySelector('.status-dot');
        const text = indicator.querySelector('.status-text');
        
        dot.classList.toggle('connected', conectado);
        text.textContent = conectado ? 'Conectado' : 'Desconectado';
    }
}

// Configurar eventos WebSocket
function configurarWebSocket() {
    // Eventos de conexión
    boodFoodSocket.on('connect', () => {
        actualizarEstadoConexion(true);
    });

    boodFoodSocket.on('disconnect', () => {
        actualizarEstadoConexion(false);
    });

    // Eventos de pedidos
    boodFoodSocket.on('pedido_recibido', (data) => {
        agregarActividad({
            tipo: 'pedido',
            mensaje: `Nuevo pedido #${data.pedido.id}`,
            tiempo: new Date(),
            datos: data.pedido
        });
        actualizarEstadisticas();
    });

    boodFoodSocket.on('estado_pedido_actualizado', (data) => {
        agregarActividad({
            tipo: 'pedido',
            mensaje: `Pedido #${data.pedido_id} actualizado a ${data.estado}`,
            tiempo: new Date(),
            datos: data
        });
        if (currentView === 'pedidos') renderView();
    });

    // Eventos de reservas
    boodFoodSocket.on('nueva_reserva', (data) => {
        agregarActividad({
            tipo: 'reserva',
            mensaje: `Nueva reserva para ${data.fecha}`,
            tiempo: new Date(),
            datos: data
        });
        actualizarEstadisticas();
    });

    // Eventos de inventario
    boodFoodSocket.on('stock_bajo', (data) => {
        agregarAlerta({
            tipo: 'warning',
            mensaje: `Stock bajo de ${data.item}: ${data.cantidad} ${data.unidad}`,
            tiempo: new Date(),
            datos: data
        });
    });

    // Eventos de mesas
    boodFoodSocket.on('estado_mesa_actualizado', (data) => {
        if (currentView === 'mesas') renderView();
        actualizarEstadisticas();
    });
}

// Gestión de actividad reciente
function agregarActividad(actividad) {
    actividadReciente.unshift(actividad);
    actividadReciente = actividadReciente.slice(0, 50); // Mantener solo las últimas 50 actividades
    actualizarListaActividad();
}

function actualizarListaActividad() {
    const lista = document.getElementById('lista-actividad');
    if (!lista) return;

    lista.innerHTML = actividadReciente.map(act => `
        <li class="activity-item">
            <div class="activity-icon ${act.tipo}">${getActivityIcon(act.tipo)}</div>
            <div class="activity-content">
                <div class="activity-title">${act.mensaje}</div>
                <div class="activity-time">${formatDateTime(act.tiempo)}</div>
            </div>
        </li>
    `).join('');
}

// Gestión de alertas
function agregarAlerta(alerta) {
    alertas.unshift(alerta);
    alertas = alertas.slice(0, 20); // Mantener solo las últimas 20 alertas
    actualizarListaAlertas();
    actualizarContadorNotificaciones();
}

function actualizarListaAlertas() {
    const lista = document.getElementById('lista-alertas');
    if (!lista) return;

    lista.innerHTML = alertas.map(alerta => `
        <li class="alert-item ${alerta.tipo}">
            <div class="alert-content">
                <div class="alert-message">${alerta.mensaje}</div>
                <div class="alert-time">${formatDateTime(alerta.tiempo)}</div>
            </div>
        </li>
    `).join('');
}

function actualizarContadorNotificaciones() {
    const contador = document.getElementById('notificationsCount');
    if (contador) {
        const total = alertas.length;
        contador.textContent = total;
        contador.style.display = total > 0 ? 'flex' : 'none';
    }
}

// (Duplicado eliminado)

// ===== API CLIENTE =====
const API = {
  async get(url) {
    const res = await fetch(`/admin${url}`);
    if (!res.ok) throw new Error(`Error ${res.status}: ${await res.text()}`);
    return res.json();
  },
  
  async post(url, data) {
    const res = await fetch(`/admin${url}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error(`Error ${res.status}: ${await res.text()}`);
    return res.json();
  },
  
  async put(url, data) {
    const res = await fetch(`/admin${url}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error(`Error ${res.status}: ${await res.text()}`);
    return res.json();
  },
  
  async del(url) {
    const res = await fetch(`/admin${url}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(`Error ${res.status}: ${await res.text()}`);
    return res.json();
  }
};

// ===== ESTADO GLOBAL =====
let currentView = 'dashboard';

// ===== NAVEGACIÓN =====
function setActiveView(view) {
  currentView = view;
  document.getElementById('view-title').textContent = 
    view === 'dashboard' ? 'Panel Principal' :
    view === 'pedidos' ? 'Pedidos' :
    view === 'reservas' ? 'Reservas' :
    view === 'usuarios' ? 'Usuarios' :
    view === 'inventario' ? 'Inventario' :
    view === 'menu' ? 'Menú' :  // ← Agrega esta línea
    view;
  
  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === view);
  });
  renderView();
}

// ===== RENDERIZADO MODULAR =====
async function renderView() {
  const viewEl = document.getElementById('view');
  viewEl.innerHTML = '<div class="card"><div class="card-body">Cargando...</div></div>';

  try {
    const module = await loadModule(currentView);
    if (module) {
      await module.init();
    } else {
      viewEl.innerHTML = '<p>Vista no disponible</p>';
    }
  } catch (err) {
    console.error(err);
    viewEl.innerHTML = `<div class="card"><div class="card-body"><p class="error" style="color:red">Error: ${err.message}</p></div></div>`;
  }
}

// Cargar módulo dinámicamente
async function loadModule(view) {
  const htmlPath = `/admin/${view}-content`;
  const jsPath = `/static/js/admin/${view}.js`;

  // Cargar HTML
  let htmlRes;
  try {
    htmlRes = await fetch(htmlPath);
  } catch (err) {
    console.warn(`No hay HTML para ${view}, se usará vista por defecto`);
    return null;
  }
  if (!htmlRes.ok) return null;
  const html = await htmlRes.text();
  document.getElementById('view').innerHTML = html;

  // Cargar JS solo si no está cargado
  const loadedFlag = `${view}ModuleLoaded`;
  if (!window[loadedFlag]) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = jsPath;
      script.onload = () => {
        window[loadedFlag] = true;
        const moduleName = view.charAt(0).toUpperCase() + view.slice(1);
        const module = window[moduleName];
        if (module && typeof module.init === 'function') {
          resolve(module);
        } else {
          resolve({ init: () => console.log(`${moduleName} no tiene init()`) });
        }
      };
      script.onerror = () => reject(new Error(`No se pudo cargar ${jsPath}`));
      document.head.appendChild(script);
    });
  } else {
    const moduleName = view.charAt(0).toUpperCase() + view.slice(1);
    return window[moduleName] || { init: () => {} };
  }
}

// ===== DASHBOARD =====
async function renderDashboard() {
  const [pedidos, reservas, usuarios] = await Promise.all([
    API.get('/api/pedidos'),
    API.get('/api/reservas'),
    API.get('/api/usuarios/lista')
  ]);
  
  const pendientes = pedidos.filter(p => p.estado === 'pendiente').length;
  const reservasHoy = reservas.filter(r => r.fecha === today()).length;
  
  return `
    <div class="grid-2">
      <div class="card">
        <div class="card-header"><strong>📊 Resumen General</strong></div>
        <div class="card-body">
          <p><strong>Usuarios:</strong> ${usuarios.length}</p>
          <p><strong>Pedidos:</strong> ${pedidos.length} (Pendientes: ${pendientes})</p>
          <p><strong>Reservas:</strong> ${reservas.length} (Hoy: ${reservasHoy})</p>
        </div>
      </div>
    </div>
    
    <div class="grid-2">
      <div class="card">
        <div class="card-header"><strong>🛒 Últimos Pedidos</strong></div>
        <div class="card-body">
          <table>
            <thead><tr><th>ID</th><th>Total</th><th>Estado</th><th>Fecha</th></tr></thead>
            <tbody>
              ${pedidos.slice(0, 5).map(p => `
                <tr>
                  <td>${p.id}</td>
                  <td>${currency(p.total)}</td>
                  <td><span class="tag status-${p.estado}">${p.estado}</span></td>
                  <td>${formatDate(p.fecha_pedido)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
      
      <div class="card">
        <div class="card-header"><strong>📅 Próximas Reservas</strong></div>
        <div class="card-body">
          <table>
            <thead><tr><th>ID</th><th>Personas</th><th>Fecha</th><th>Estado</th></tr></thead>
            <tbody>
              ${reservas.slice(0, 5).map(r => `
                <tr>
                  <td>${r.id}</td>
                  <td>${r.numero_personas}</td>
                  <td>${r.fecha} ${r.hora}</td>
                  <td><span class="tag status-${r.estado}">${r.estado}</span></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

// ===== USUARIOS =====
async function renderUsuarios() {
  const usuarios = await API.get('/api/usuarios/lista');
  
  const formHTML = `
    <div class="card">
      <div class="card-header"><strong>➕ Crear Nuevo Usuario</strong></div>
      <div class="card-body">
        <div class="row">
          <div><label>Nombre</label><input type="text" id="new-user-nombre" placeholder="Nombre" required></div>
          <div><label>Apellido</label><input type="text" id="new-user-apellido" placeholder="Apellido"></div>
          <div><label>Email</label><input type="email" id="new-user-email" placeholder="email@ejemplo.com" required></div>
          <div><label>Rol</label>
            <select id="new-user-rol">
              <option value="cliente">Cliente</option>
              <option value="mesero">Mesero</option>
              <option value="cocinero">Cocinero</option>
              <option value="cajero">Cajero</option>
              <option value="admin">Admin</option>
            </select>
          </div>
        </div>
        <button class="primary" onclick="window.crearUsuario()">Crear Usuario</button>
      </div>
    </div>
  `;
  
  const tableHTML = `
    <div class="card">
      <div class="card-header"><strong>👥 Usuarios (${usuarios.length})</strong></div>
      <div class="card-body">
        <table>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Email</th>
              <th>Rol</th>
              <th>Activo</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            ${usuarios.map(u => `
              <tr>
                <td>${u.nombre} ${u.apellido || ''}</td>
                <td>${u.email}</td>
                <td>
                  <select onchange="window.cambiarRol(${u.id}, this.value)" ${u.id === window.currentUserId ? 'disabled' : ''}>
                    <option value="cliente" ${u.rol === 'cliente' ? 'selected' : ''}>Cliente</option>
                    <option value="mesero" ${u.rol === 'mesero' ? 'selected' : ''}>Mesero</option>
                    <option value="cocinero" ${u.rol === 'cocinero' ? 'selected' : ''}>Cocinero</option>
                    <option value="cajero" ${u.rol === 'cajero' ? 'selected' : ''}>Cajero</option>
                    <option value="admin" ${u.rol === 'admin' ? 'selected' : ''}>Admin</option>
                  </select>
                </td>
                <td>${u.activo ? '✅' : '❌'}</td>
                <td>
                  ${u.id !== window.currentUserId ? 
                    `<button class="ghost" onclick="window.eliminarUsuario(${u.id})">Eliminar</button>` : 
                    '<span style="color:gray">—</span>'}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
  
  return formHTML + tableHTML;
}

// ===== PEDIDOS =====
async function renderPedidos() {
  const pedidos = await API.get('/api/pedidos');
  
  const tableHTML = `
    <div class="card">
      <div class="card-header"><strong>📋 Todos los Pedidos (${pedidos.length})</strong></div>
      <div class="card-body">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Mesa</th>
              <th>Cliente</th>
              <th>Total</th>
              <th>Estado</th>
              <th>Fecha</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            ${pedidos.map(p => `
              <tr>
                <td>${p.id}</td>
                <td>${p.mesa_id || 'Delivery'}</td>
                <td>${p.usuario_id}</td>
                <td>${currency(p.total)}</td>
                <td>
                  <select onchange="window.actualizarEstadoPedido(${p.id}, this.value)">
                    <option value="pendiente" ${p.estado === 'pendiente' ? 'selected' : ''}>Pendiente</option>
                    <option value="preparando" ${p.estado === 'preparando' ? 'selected' : ''}>Preparando</option>
                    <option value="enviado" ${p.estado === 'enviado' ? 'selected' : ''}>Enviado</option>
                    <option value="entregado" ${p.estado === 'entregado' ? 'selected' : ''}>Entregado</option>
                    <option value="cancelado" ${p.estado === 'cancelado' ? 'selected' : ''}>Cancelado</option>
                    <option value="rechazado" ${p.estado === 'rechazado' ? 'selected' : ''}>Rechazado</option>
                  </select>
                </td>
                <td>${formatDateTime(p.fecha_pedido)}</td>
                <td><button class="ghost" onclick="window.verPedido(${p.id})">Ver</button></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
  
  return tableHTML;
}

// ===== RESERVAS =====
async function renderReservas() {
  const reservas = await API.get('/api/reservas');
  
  const formHTML = `
    <div class="card">
      <div class="card-header"><strong>➕ Crear Nueva Reserva</strong></div>
      <div class="card-body">
        <div class="row">
          <div><label>Fecha</label><input type="date" id="new-reserva-fecha" value="${today()}" required></div>
          <div><label>Hora</label><input type="time" id="new-reserva-hora" value="19:00" required></div>
          <div><label>Personas</label><input type="number" id="new-reserva-personas" min="1" value="2" required></div>
          <div><label>Nombre</label><input type="text" id="new-reserva-nombre" placeholder="Nombre del cliente"></div>
          <div><label>Email</label><input type="email" id="new-reserva-email" placeholder="email@ejemplo.com"></div>
          <div><label>Teléfono</label><input type="text" id="new-reserva-telefono" placeholder="3101234567"></div>
          <div><label>Zona</label>
            <select id="new-reserva-zona">
              <option value="interior">Interior</option>
              <option value="terraza">Terraza</option>
              <option value="vip">VIP</option>
              <option value="privada">Privada</option>
            </select>
          </div>
        </div>
        <button class="primary" onclick="window.crearReserva()">Crear Reserva</button>
      </div>
    </div>
  `;
  
  const tableHTML = `
    <div class="card">
      <div class="card-header"><strong>📅 Todas las Reservas (${reservas.length})</strong></div>
      <div class="card-body">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Personas</th>
              <th>Fecha</th>
              <th>Estado</th>
              <th>Mesa</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            ${reservas.map(r => `
              <tr>
                <td>${r.id}</td>
                <td>${r.numero_personas}</td>
                <td>${r.fecha} ${r.hora}</td>
                <td>
                  <select onchange="window.actualizarEstadoReserva(${r.id}, this.value)">
                    <option value="pendiente" ${r.estado === 'pendiente' ? 'selected' : ''}>Pendiente</option>
                    <option value="confirmada" ${r.estado === 'confirmada' ? 'selected' : ''}>Confirmada</option>
                    <option value="cancelada" ${r.estado === 'cancelada' ? 'selected' : ''}>Cancelada</option>
                    <option value="completada" ${r.estado === 'completada' ? 'selected' : ''}>Completada</option>
                    <option value="no_asistio" ${r.estado === 'no_asistio' ? 'selected' : ''}>No Asistió</option>
                  </select>
                </td>
                <td>${r.mesa_asignada || '-'}</td>
                <td><button class="ghost" onclick="window.verReserva(${r.id})">Ver</button></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
  
  return formHTML + tableHTML;
}

// ===== INVENTARIO =====
async function renderInventario() {
  const items = await API.get('/api/inventario/lista');
  
  const formHTML = `
    <div class="card">
      <div class="card-header"><strong>➕ Nuevo Item de Inventario</strong></div>
      <div class="card-body">
        <div class="row">
          <div><label>Nombre</label><input type="text" id="new-inventario-nombre" placeholder="Nombre del item" required></div>
          <div><label>Cantidad</label><input type="number" id="new-inventario-cantidad" min="0" step="0.01" value="0" required></div>
          <div><label>Unidad</label><input type="text" id="new-inventario-unidad" placeholder="kg, unidades, etc." required></div>
          <div><label>Stock Mínimo</label><input type="number" id="new-inventario-minimo" min="0" step="0.01" value="0"></div>
        </div>
        <button class="primary" onclick="window.crearInventarioItem()">Crear Item</button>
      </div>
    </div>
  `;
  
  const tableHTML = `
    <div class="card">
      <div class="card-header"><strong>📦 Inventario (${items.length} items)</strong></div>
      <div class="card-body">
        <table>
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Cantidad</th>
              <th>Unidad</th>
              <th>Stock Mínimo</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            ${items.map(i => `
              <tr>
                <td>${i.nombre}</td>
                <td>${i.cantidad}</td>
                <td>${i.unidad}</td>
                <td>${i.stock_minimo}</td>
                <td>
                  <button class="ghost" onclick="window.registrarEntrada(${i.id})">+ Entrada</button>
                  <button class="ghost" onclick="window.registrarSalida(${i.id})">- Salida</button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
  
  return formHTML + tableHTML;
}

// ===== MENÚ =====

async function renderMenu() {
  try {
    const response = await fetch('/admin/menu-content');
    const html = await response.text();
    return html;
  } catch (err) {
    return `<div class="card"><div class="card-body"><p class="error">Error al cargar el menú</p></div></div>`;
  }
}

// ===== MESAS =====
async function renderMesas() {
  return `
    <div class="card">
      <div class="card-header"><strong>🪑 Gestión de Mesas</strong></div>
      <div class="card-body">
        <p>Funcionalidad en desarrollo. Usa el formulario para crear mesas.</p>
        <div class="row">
          <div><label>Número</label><input type="number" id="new-mesa-numero" min="1" placeholder="Número de mesa"></div>
          <div><label>Capacidad</label><input type="number" id="new-mesa-capacidad" min="1" placeholder="Personas"></div>
          <div><label>Tipo</label>
            <select id="new-mesa-tipo">
              <option value="interior">Interior</option>
              <option value="terraza">Terraza</option>
              <option value="vip">VIP</option>
            </select>
          </div>
        </div>
        <button class="primary" onclick="alert('Función en desarrollo')">Crear Mesa</button>
      </div>
    </div>
  `;
}

// ===== FUNCIONES GLOBALES =====
window.crearUsuario = async () => {
  try {
    const data = {
      nombre: document.getElementById('new-user-nombre').value,
      apellido: document.getElementById('new-user-apellido').value,
      email: document.getElementById('new-user-email').value,
      rol: document.getElementById('new-user-rol').value
    };
    
    if (!data.nombre || !data.email) {
      alert('Nombre y email son requeridos');
      return;
    }
    
    await API.post('/api/usuarios/crear', data);
    alert('✅ Usuario creado exitosamente');
    document.getElementById('new-user-nombre').value = '';
    document.getElementById('new-user-apellido').value = '';
    document.getElementById('new-user-email').value = '';
    renderView();
  } catch (err) {
    alert('❌ Error: ' + (err.message || 'No se pudo crear el usuario'));
  }
};

// Crear item
window.crearMenuItem = async () => {
  try {
    const data = {
      nombre: document.getElementById('new-menu-nombre').value,
      precio: parseFloat(document.getElementById('new-menu-precio').value),
      categoria_id: document.getElementById('new-menu-categoria').value || null,
      descripcion: document.getElementById('new-menu-descripcion').value,
      disponible: document.getElementById('new-menu-disponible').value === 'true'
    };
    
    if (!data.nombre || !data.precio) {
      alert('Nombre y precio son requeridos');
      return;
    }
    
    await API.post('/api/menu/crear', data);
    alert('✅ Item creado exitosamente');
    
    // Limpiar formulario
    document.getElementById('new-menu-nombre').value = '';
    document.getElementById('new-menu-precio').value = '';
    document.getElementById('new-menu-categoria').value = '';
    document.getElementById('new-menu-descripcion').value = '';
    document.getElementById('new-menu-disponible').value = 'true';
    
    renderView();
  } catch (err) {
    alert('❌ Error: ' + (err.message || 'No se pudo crear el item'));
  }
};

// Eliminar item
window.eliminarMenuItem = async (id) => {
  if (!confirm('⚠️ ¿Eliminar este item del menú? Esta acción no se puede deshacer.')) return;
  try {
    await API.del(`/api/menu/${id}`);
    alert('✅ Item eliminado exitosamente');
    renderView();
  } catch (err) {
    alert('❌ Error: ' + (err.message || 'No se pudo eliminar el item'));
  }
};

// Editar item - abre modal
window.editarMenuItem = (id, item) => {
  // Crear modal de edición
  const modalHTML = `
    <div id="modal-editar-menu" class="modal-overlay" style="display: flex;">
      <div class="modal-content" style="max-width: 600px; width: 90%;">
        <span class="close-modal" onclick="document.getElementById('modal-editar-menu').remove()">&times;</span>
        <h2>Editar Item del Menú</h2>
        <form id="form-editar-menu">
          <input type="hidden" id="edit-menu-id" value="${item.id}">
          <div class="row">
            <div><label>Nombre</label><input type="text" id="edit-menu-nombre" value="${item.nombre}" required></div>
            <div><label>Precio</label><input type="number" id="edit-menu-precio" min="0" step="0.01" value="${item.precio}" required></div>
          </div>
          <div class="row">
            <div><label>Categoría</label>
              <select id="edit-menu-categoria">
                <option value="">-- Sin categoría --</option>
                <!-- Categorías se cargarán dinámicamente -->
              </select>
            </div>
            <div><label>Disponible</label>
              <select id="edit-menu-disponible">
                <option value="true" ${item.disponible ? 'selected' : ''}>Sí</option>
                <option value="false" ${!item.disponible ? 'selected' : ''}>No</option>
              </select>
            </div>
          </div>
          <div class="row">
            <div><label>Descripción</label><textarea id="edit-menu-descripcion" rows="2">${item.descripcion || ''}</textarea></div>
          </div>
          <div class="actions">
            <button type="submit" class="primary">Guardar Cambios</button>
            <button type="button" class="ghost" onclick="document.getElementById('modal-editar-menu').remove()">Cancelar</button>
          </div>
        </form>
      </div>
    </div>
  `;
  
  // Agregar modal al body
  document.body.insertAdjacentHTML('beforeend', modalHTML);
  
  // Cargar categorías en el select
  API.get('/api/categorias/lista').then(categorias => {
    const select = document.getElementById('edit-menu-categoria');
    select.innerHTML = '<option value="">-- Sin categoría --</option>';
    categorias.forEach(cat => {
      const option = document.createElement('option');
      option.value = cat.id;
      option.textContent = cat.nombre;
      if (cat.id == item.categoria_id) {
        option.selected = true;
      }
      select.appendChild(option);
    });
  }).catch(err => {
    console.error('Error cargando categorías:', err);
  });
  
  // Manejar envío del formulario
  document.getElementById('form-editar-menu').onsubmit = async (e) => {
    e.preventDefault();
    
    try {
      const data = {
        nombre: document.getElementById('edit-menu-nombre').value,
        precio: parseFloat(document.getElementById('edit-menu-precio').value),
        categoria_id: document.getElementById('edit-menu-categoria').value || null,
        descripcion: document.getElementById('edit-menu-descripcion').value,
        disponible: document.getElementById('edit-menu-disponible').value === 'true'
      };
      
      await API.put(`/api/menu/${id}/actualizar`, data);
      alert('✅ Item actualizado exitosamente');
      document.getElementById('modal-editar-menu').remove();
      renderView();
    } catch (err) {
      alert('❌ Error: ' + (err.message || 'No se pudo actualizar el item'));
    }
  };
};

window.eliminarMenuItem = async (id) => {
  if (!confirm('¿Eliminar este item del menú?')) return;
  try {
    await API.del(`/api/menu/${id}`);
    alert('✅ Item eliminado');
    renderView();
  } catch (err) {
    alert('❌ Error: ' + (err.message || 'No se pudo eliminar el item'));
  }
};

window.editarMenuItem = async (id) => {
  alert('Función de edición en desarrollo. ID: ' + id);
  // Aquí implementarías un modal de edición
};

window.cambiarRol = async (id, rol) => {
  try {
    await API.put(`/api/usuario/${id}/rol`, { rol });
    alert('✅ Rol actualizado');
  } catch (err) {
    alert('❌ Error: ' + (err.message || 'No se pudo actualizar el rol'));
  }
};

window.eliminarUsuario = async (id) => {
  if (!confirm('⚠️ ¿Eliminar usuario? Esta acción no se puede deshacer.')) return;
  try {
    await API.del(`/api/usuario/${id}`);
    alert('✅ Usuario eliminado');
    renderView();
  } catch (err) {
    alert('❌ Error: ' + (err.message || 'No se pudo eliminar el usuario'));
  }
};

window.actualizarEstadoPedido = async (id, estado) => {
  try {
    await API.put(`/api/pedido/${id}/actualizar`, { estado });
    alert('✅ Estado del pedido actualizado');
  } catch (err) {
    alert('❌ Error: ' + (err.message || 'No se pudo actualizar'));
  }
};

window.crearReserva = async () => {
  try {
    const data = {
      fecha: document.getElementById('new-reserva-fecha').value,
      hora: document.getElementById('new-reserva-hora').value,
      numero_personas: parseInt(document.getElementById('new-reserva-personas').value),
      nombre_reserva: document.getElementById('new-reserva-nombre').value,
      email_reserva: document.getElementById('new-reserva-email').value,
      telefono_reserva: document.getElementById('new-reserva-telefono').value,
      zona_mesa: document.getElementById('new-reserva-zona').value
    };
    
    if (!data.fecha || !data.hora || !data.numero_personas) {
      alert('Fecha, hora y número de personas son requeridos');
      return;
    }
    
    await API.post('/api/reservas/crear', data);
    alert('✅ Reserva creada exitosamente');
    // Limpiar formulario
    document.getElementById('new-reserva-personas').value = '2';
    document.getElementById('new-reserva-nombre').value = '';
    document.getElementById('new-reserva-email').value = '';
    document.getElementById('new-reserva-telefono').value = '';
    renderView();
  } catch (err) {
    alert('❌ Error: ' + (err.message || 'No se pudo crear la reserva'));
  }
};

window.actualizarEstadoReserva = async (id, estado) => {
  try {
    await API.put(`/api/reserva/${id}/actualizar`, { estado });
    alert('✅ Estado de la reserva actualizado');
  } catch (err) {
    alert('❌ Error: ' + (err.message || 'No se pudo actualizar'));
  }
};

window.crearInventarioItem = async () => {
  try {
    const data = {
      nombre: document.getElementById('new-inventario-nombre').value,
      cantidad: parseFloat(document.getElementById('new-inventario-cantidad').value),
      unidad: document.getElementById('new-inventario-unidad').value,
      stock_minimo: parseFloat(document.getElementById('new-inventario-minimo').value || 0)
    };
    
    if (!data.nombre || !data.unidad) {
      alert('Nombre y unidad son requeridos');
      return;
    }
    
    await API.post('/api/inventario/crear', data);
    alert('✅ Item de inventario creado');
    document.getElementById('new-inventario-nombre').value = '';
    document.getElementById('new-inventario-cantidad').value = '0';
    document.getElementById('new-inventario-unidad').value = '';
    document.getElementById('new-inventario-minimo').value = '0';
    renderView();
  } catch (err) {
    alert('❌ Error: ' + (err.message || 'No se pudo crear el item'));
  }
};

window.registrarEntrada = async (itemId) => {
  const cantidad = prompt('¿Cantidad de entrada?');
  if (cantidad && !isNaN(cantidad)) {
    try {
      await API.post(`/api/inventario/${itemId}/movimiento`, {
        tipo: 'entrada',
        cantidad: parseFloat(cantidad)
      });
      alert('✅ Entrada registrada');
      renderView();
    } catch (err) {
      alert('❌ Error: ' + (err.message || 'No se pudo registrar la entrada'));
    }
  }
};

window.registrarSalida = async (itemId) => {
  const cantidad = prompt('¿Cantidad de salida?');
  if (cantidad && !isNaN(cantidad)) {
    try {
      await API.post(`/api/inventario/${itemId}/movimiento`, {
        tipo: 'salida',
        cantidad: parseFloat(cantidad)
      });
      alert('✅ Salida registrada');
      renderView();
    } catch (err) {
      alert('❌ Error: ' + (err.message || 'No se pudo registrar la salida'));
    }
  }
};

// ===== INICIALIZACIÓN =====
document.addEventListener('DOMContentLoaded', () => {
  // Configurar navegación
  document.querySelectorAll('.nav-item[data-view]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      setActiveView(e.currentTarget.dataset.view);
    });
  });

  // Inicializar WebSocket
  configurarWebSocket();
    
  // Cargar datos iniciales
  cargarDatosIniciales();
    
  // Cargar vista inicial
  setActiveView('dashboard');

  // Actualizar estadísticas cada 5 minutos
  setInterval(actualizarEstadisticas, 5 * 60 * 1000);
});

async function cargarDatosIniciales() {
  try {
    // Cargar actividad reciente
    const actividad = await API.get('/api/dashboard/actividad');
    actividadReciente = actividad;
    actualizarListaActividad();

    // Cargar alertas
    const alertasIniciales = await API.get('/api/dashboard/alertas');
    alertas = alertasIniciales;
    actualizarListaAlertas();
    actualizarContadorNotificaciones();

    // Cargar estadísticas iniciales
    actualizarEstadisticas();
  } catch (error) {
    console.error('Error al cargar datos iniciales:', error);
    BoodFood.mostrarNotificacion('Error al cargar datos iniciales', 'error');
  }
}

function getActivityIcon(tipo) {
  switch (tipo) {
    case 'pedido': return '🛍️';
    case 'reserva': return '📅';
    case 'inventario': return '📦';
    case 'usuario': return '👤';
    case 'mesa': return '🪑';
    default: return '📝';
  }
}

window.gestionarReceta = async (menuItemId, nombrePlato) => {
  const inventario = await API.get('/api/inventario/lista');
  const recetasActuales = []; // Cargar recetas actuales si las tienes
  
  let html = `
    <div class="card">
      <div class="card-header"><strong>🧂 Ingredientes para: ${nombrePlato}</strong></div>
      <div class="card-body">
        <p>Agrega los ingredientes necesarios para este plato:</p>
        <div class="row">
          <div>
            <label>Ingrediente</label>
            <select id="receta-ingrediente">
              <option value="">-- Seleccionar --</option>
              ${inventario.map(item => `<option value="${item.id}">${item.nombre}</option>`).join('')}
            </select>
          </div>
          <div>
            <label>Cantidad por unidad</label>
            <input type="number" id="receta-cantidad" min="0" step="0.01" placeholder="0.00">
          </div>
        </div>
        <button class="primary" onclick="window.agregarIngredienteReceta(${menuItemId})">Agregar Ingrediente</button>
        
        <h4>Ingredientes actuales:</h4>
        <div id="lista-ingredientes">
          <!-- Lista de ingredientes actuales -->
        </div>
      </div>
    </div>
  `;
  
  document.getElementById('view').innerHTML = html;
};
