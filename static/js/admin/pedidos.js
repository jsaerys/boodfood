// static/js/admin/pedidos.js

// Cargar contenido de pedidos
async function cargarPedidos() {
  try {
    const pedidos = await API.get('/api/pedidos');
    
    let html = `
      <div class="filters-bar" style="margin-bottom: 20px; display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
        <select id="filter-tipo-pedido" onchange="window.filtrarPedidos()">
          <option value="todos">Todos los tipos</option>
          <option value="mesa">Mesa</option>
          <option value="domicilio">Domicilio</option>
        </select>
        <select id="filter-estado-pedido" onchange="window.filtrarPedidos()">
          <option value="todos">Todos los estados</option>
          <option value="pendiente">Pendiente</option>
          <option value="preparando">Preparando</option>
          <option value="enviado">Enviado</option>
          <option value="entregado">Entregado</option>
          <option value="cancelado">Cancelado</option>
          <option value="rechazado">Rechazado</option>
        </select>
        <input type="date" id="filter-fecha-pedido" onchange="window.filtrarPedidos()">
        <button class="secondary" onclick="window.cargarPedidos()">🔄 Actualizar</button>
        <span style="margin-left: auto; font-weight: bold;">Total: ${pedidos.length} pedidos</span>
      </div>
      <div style="overflow-x: auto;">
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Código</th>
            <th>Tipo</th>
            <th>Cliente/Mesa</th>
            <th>Teléfono</th>
            <th>Dirección</th>
            <th>Total</th>
            <th>Método Pago</th>
            <th>Estado</th>
            <th>Fecha</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody id="tbody-pedidos">
    `;
    
    pedidos.forEach(p => {
      // Determinar tipo de pedido
      const tipo = p.direccion_entrega ? 'domicilio' : 'mesa';
      const tipoBadge = tipo === 'domicilio' ? 'badge-info' : 'badge-secondary';
      
      // Cliente o mesa
      const clienteInfo = tipo === 'mesa' ? 
        `Mesa ${p.mesa_id || 'N/A'}` : 
        (p.nombre_receptor || 'Cliente');
      
      // Teléfono
      const telefono = p.telefono_contacto || 'N/A';
      
      // Dirección (solo para domicilios)
      const direccion = tipo === 'domicilio' ? 
        (p.direccion_entrega ? p.direccion_entrega.substring(0, 30) + '...' : 'N/A') : 
        '-';
      
      // Color del estado
      const estadoColor = {
        'pendiente': 'badge-warning',
        'preparando': 'badge-info',
        'enviado': 'badge-primary',
        'entregado': 'badge-success',
        'cancelado': 'badge-danger',
        'rechazado': 'badge-danger'
      }[p.estado] || 'badge-secondary';
      
      html += `
        <tr data-tipo="${tipo}" data-estado="${p.estado}" data-fecha="${p.fecha_pedido ? p.fecha_pedido.split('T')[0] : ''}">
          <td>${p.id}</td>
          <td><strong>${p.codigo_pedido || 'PED' + p.id}</strong></td>
          <td><span class="badge ${tipoBadge}">${tipo === 'domicilio' ? '🏠 Domicilio' : '🍽️ Mesa'}</span></td>
          <td>${clienteInfo}</td>
          <td>${telefono}</td>
          <td title="${p.direccion_entrega || ''}">${direccion}</td>
          <td><strong>${currency(p.total)}</strong></td>
          <td>${(p.metodo_pago || 'efectivo').toUpperCase()}</td>
          <td>
            <select onchange="window.actualizarEstadoPedido(${p.id}, this.value)" class="estado-select ${estadoColor}">
              <option value="pendiente" ${p.estado === 'pendiente' ? 'selected' : ''}>⏳ Pendiente</option>
              <option value="preparando" ${p.estado === 'preparando' ? 'selected' : ''}>👨‍🍳 Preparando</option>
              <option value="enviado" ${p.estado === 'enviado' ? 'selected' : ''}>🚚 Enviado</option>
              <option value="entregado" ${p.estado === 'entregado' ? 'selected' : ''}>✅ Entregado</option>
              <option value="cancelado" ${p.estado === 'cancelado' ? 'selected' : ''}>❌ Cancelado</option>
              <option value="rechazado" ${p.estado === 'rechazado' ? 'selected' : ''}>🚫 Rechazado</option>
            </select>
          </td>
          <td>${formatDateTime(p.fecha_pedido)}</td>
          <td>
            <button class="ghost small" onclick="window.verDetallesPedido(${p.id})" title="Ver detalles">👁️</button>
            <button class="ghost small" onclick="window.imprimirPedido(${p.id})" title="Imprimir">🖨️</button>
          </td>
        </tr>
      `;
    });
    
    html += '</tbody></table></div>';
    document.getElementById('tabla-pedidos').innerHTML = html;
    
  } catch (err) {
    console.error('Error:', err);
    document.getElementById('tabla-pedidos').innerHTML = 
      `<p class="error" style="color:red">Error al cargar pedidos: ${err.message}</p>`;
  }
}

// Funciones globales
window.actualizarEstadoPedido = async (pedidoId, estado) => {
  try {
    await API.put(`/api/pedidos/${pedidoId}/estado`, { estado });
    showToast('✅ Estado actualizado correctamente', 'success');
    cargarPedidos();
  } catch (err) {
    showToast('❌ Error: ' + (err.message || 'No se pudo actualizar'), 'error');
  }
};

window.verDetallesPedido = async (pedidoId) => {
  try {
    const pedido = await API.get(`/api/pedidos/${pedidoId}`);
    
    // Determinar tipo
    const tipo = pedido.direccion_entrega ? 'domicilio' : 'mesa';
    const tipoIcon = tipo === 'domicilio' ? '🏠' : '🍽️';
    const tipoText = tipo === 'domicilio' ? 'Domicilio' : 'En Mesa';
    
    const modalHTML = `
      <div id="modal-detalle-pedido" class="modal-overlay">
        <div class="modal-content" style="max-width: 700px; max-height: 85vh; overflow-y: auto;">
          <span class="close-modal" onclick="document.getElementById('modal-detalle-pedido').remove()">&times;</span>
          <h2>${tipoIcon} Pedido #${pedido.codigo_pedido || pedido.id}</h2>
          
          <div class="pedido-detalle" style="margin-top: 20px;">
            <!-- Información General -->
            <div class="info-section">
              <h3>📋 Información General</h3>
              <div class="info-row">
                <strong>Tipo:</strong> <span class="badge badge-${tipo === 'domicilio' ? 'info' : 'secondary'}">${tipoText}</span>
              </div>
              <div class="info-row">
                <strong>Estado:</strong> <span class="badge badge-${pedido.estado}">${pedido.estado}</span>
              </div>
              <div class="info-row">
                <strong>Método de Pago:</strong> ${(pedido.metodo_pago || 'efectivo').toUpperCase()}
              </div>
              <div class="info-row">
                <strong>Fecha Pedido:</strong> ${formatDateTime(pedido.fecha_pedido)}
              </div>
              ${pedido.fecha_preparacion ? `<div class="info-row"><strong>Inicio Preparación:</strong> ${formatDateTime(pedido.fecha_preparacion)}</div>` : ''}
              ${pedido.fecha_envio ? `<div class="info-row"><strong>Envío:</strong> ${formatDateTime(pedido.fecha_envio)}</div>` : ''}
              ${pedido.fecha_entrega ? `<div class="info-row"><strong>Entrega:</strong> ${formatDateTime(pedido.fecha_entrega)}</div>` : ''}
            </div>
            
            <!-- Información del Cliente/Mesa -->
            <div class="info-section" style="margin-top: 20px;">
              <h3>👤 Información del ${tipo === 'domicilio' ? 'Cliente' : 'Mesa'}</h3>
              ${tipo === 'domicilio' ? `
                <div class="info-row">
                  <strong>Nombre:</strong> ${pedido.nombre_receptor || 'N/A'}
                </div>
                <div class="info-row">
                  <strong>Teléfono:</strong> ${pedido.telefono_contacto || 'N/A'}
                </div>
                <div class="info-row">
                  <strong>Dirección:</strong> 
                  <div style="margin-top: 5px; padding: 10px; background: #f5f5f5; border-radius: 4px;">
                    ${pedido.direccion_entrega || 'N/A'}
                  </div>
                </div>
                ${pedido.instrucciones_entrega ? `
                  <div class="info-row">
                    <strong>Instrucciones:</strong>
                    <div style="margin-top: 5px; padding: 10px; background: #fff3cd; border-radius: 4px;">
                      ${pedido.instrucciones_entrega}
                    </div>
                  </div>
                ` : ''}
              ` : `
                <div class="info-row">
                  <strong>Mesa:</strong> Mesa #${pedido.mesa_id || 'N/A'}
                </div>
              `}
            </div>
            
            <!-- Items del Pedido -->
            <div class="info-section" style="margin-top: 20px;">
              <h3>🍽️ Items del Pedido</h3>
              <table style="width: 100%; margin-top: 10px;">
                <thead>
                  <tr>
                    <th style="text-align: left;">Producto</th>
                    <th style="text-align: center;">Cant.</th>
                    <th style="text-align: right;">Precio Unit.</th>
                    <th style="text-align: right;">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  ${(pedido.items || []).map(item => `
                    <tr>
                      <td>
                        <strong>${item.nombre_item}</strong>
                        ${item.descripcion_item ? `<br><small style="color: #666;">${item.descripcion_item}</small>` : ''}
                      </td>
                      <td style="text-align: center;">${item.cantidad}</td>
                      <td style="text-align: right;">${currency(item.precio_unitario)}</td>
                      <td style="text-align: right;"><strong>${currency(item.subtotal)}</strong></td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
            
            <!-- Totales -->
            <div class="pedido-total" style="margin-top: 20px; padding: 15px; background: #f8f9fa; border-radius: 8px;">
              <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                <span>Subtotal:</span>
                <span>${currency(pedido.subtotal || pedido.total)}</span>
              </div>
              ${pedido.impuestos ? `
                <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                  <span>Impuestos:</span>
                  <span>${currency(pedido.impuestos)}</span>
                </div>
              ` : ''}
              ${pedido.costo_envio ? `
                <div style="display: flex; justify-content: space-between; margin-bottom: 10px;">
                  <span>Costo de envío:</span>
                  <span>${currency(pedido.costo_envio)}</span>
                </div>
              ` : ''}
              ${pedido.descuento ? `
                <div style="display: flex; justify-content: space-between; margin-bottom: 10px; color: green;">
                  <span>Descuento:</span>
                  <span>-${currency(pedido.descuento)}</span>
                </div>
              ` : ''}
              <div style="display: flex; justify-content: space-between; font-size: 20px; font-weight: bold; border-top: 2px solid #ddd; padding-top: 10px; margin-top: 10px;">
                <span>TOTAL:</span>
                <span style="color: #28a745;">${currency(pedido.total)}</span>
              </div>
            </div>
          </div>
          
          <div class="actions" style="margin-top: 20px; display: flex; gap: 10px; justify-content: flex-end;">
            <button class="ghost" onclick="document.getElementById('modal-detalle-pedido').remove()">Cerrar</button>
            <button class="primary" onclick="window.imprimirPedido(${pedidoId})">🖨️ Imprimir</button>
            ${pedido.estado !== 'entregado' && pedido.estado !== 'cancelado' ? `
              <button class="success" onclick="window.actualizarEstadoPedido(${pedidoId}, 'entregado'); document.getElementById('modal-detalle-pedido').remove();">✅ Marcar Entregado</button>
            ` : ''}
          </div>
        </div>
      </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
  } catch (err) {
    showToast('❌ Error al cargar detalles: ' + err.message, 'error');
  }
};

window.imprimirPedido = async (pedidoId) => {
  try {
    const pedido = await API.get(`/api/pedidos/${pedidoId}`);
    
    // Crear ventana de impresión
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    
    const tipo = pedido.direccion_entrega ? 'domicilio' : 'mesa';
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Pedido #${pedido.codigo_pedido || pedido.id}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            padding: 20px;
            max-width: 800px;
            margin: 0 auto;
          }
          .header {
            text-align: center;
            border-bottom: 2px solid #333;
            padding-bottom: 20px;
            margin-bottom: 20px;
          }
          .header h1 {
            margin: 0;
            color: #333;
          }
          .info-section {
            margin: 20px 0;
            padding: 15px;
            background: #f9f9f9;
            border-radius: 5px;
          }
          .info-row {
            margin: 10px 0;
            display: flex;
            justify-content: space-between;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
          }
          th, td {
            border: 1px solid #ddd;
            padding: 12px;
            text-align: left;
          }
          th {
            background-color: #333;
            color: white;
          }
          .total-section {
            margin-top: 20px;
            text-align: right;
            font-size: 18px;
          }
          .total-section .grand-total {
            font-size: 24px;
            font-weight: bold;
            color: #28a745;
            margin-top: 15px;
            padding-top: 15px;
            border-top: 2px solid #333;
          }
          @media print {
            body {
              padding: 0;
            }
            .no-print {
              display: none;
            }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>🍽️ BOODFOOD - Pedido #${pedido.codigo_pedido || pedido.id}</h1>
          <p>Tipo: <strong>${tipo === 'domicilio' ? '🏠 DOMICILIO' : '🍽️ MESA'}</strong></p>
          <p>Fecha: ${formatDateTime(pedido.fecha_pedido)}</p>
        </div>
        
        <div class="info-section">
          <h2>📋 Estado del Pedido</h2>
          <div class="info-row">
            <span>Estado:</span>
            <strong>${pedido.estado.toUpperCase()}</strong>
          </div>
          <div class="info-row">
            <span>Método de Pago:</span>
            <strong>${(pedido.metodo_pago || 'efectivo').toUpperCase()}</strong>
          </div>
        </div>
        
        <div class="info-section">
          <h2>� Información del ${tipo === 'domicilio' ? 'Cliente' : 'Mesa'}</h2>
          ${tipo === 'domicilio' ? `
            <div class="info-row">
              <span>Nombre:</span>
              <strong>${pedido.nombre_receptor || 'N/A'}</strong>
            </div>
            <div class="info-row">
              <span>Teléfono:</span>
              <strong>${pedido.telefono_contacto || 'N/A'}</strong>
            </div>
            <div class="info-row" style="display: block;">
              <span>Dirección de Entrega:</span>
              <p style="margin: 10px 0; padding: 10px; background: white; border-radius: 4px;">
                ${pedido.direccion_entrega || 'N/A'}
              </p>
            </div>
            ${pedido.instrucciones_entrega ? `
              <div class="info-row" style="display: block;">
                <span>Instrucciones:</span>
                <p style="margin: 10px 0; padding: 10px; background: #fff3cd; border-radius: 4px;">
                  ${pedido.instrucciones_entrega}
                </p>
              </div>
            ` : ''}
          ` : `
            <div class="info-row">
              <span>Mesa:</span>
              <strong>Mesa #${pedido.mesa_id || 'N/A'}</strong>
            </div>
          `}
        </div>
        
        <h2>🍽️ Items del Pedido</h2>
        <table>
          <thead>
            <tr>
              <th>Producto</th>
              <th style="text-align: center;">Cant.</th>
              <th style="text-align: right;">Precio Unit.</th>
              <th style="text-align: right;">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            ${(pedido.items || []).map(item => `
              <tr>
                <td>
                  <strong>${item.nombre_item}</strong>
                  ${item.descripcion_item ? `<br><small style="color: #666;">${item.descripcion_item}</small>` : ''}
                </td>
                <td style="text-align: center;">${item.cantidad}</td>
                <td style="text-align: right;">${currency(item.precio_unitario)}</td>
                <td style="text-align: right;"><strong>${currency(item.subtotal)}</strong></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        
        <div class="total-section">
          <div>Subtotal: <strong>${currency(pedido.subtotal || pedido.total)}</strong></div>
          ${pedido.impuestos ? `<div>Impuestos: <strong>${currency(pedido.impuestos)}</strong></div>` : ''}
          ${pedido.costo_envio ? `<div>Costo de envío: <strong>${currency(pedido.costo_envio)}</strong></div>` : ''}
          ${pedido.descuento ? `<div style="color: green;">Descuento: <strong>-${currency(pedido.descuento)}</strong></div>` : ''}
          <div class="grand-total">TOTAL: ${currency(pedido.total)}</div>
        </div>
        
        <div style="margin-top: 40px; text-align: center; color: #666;">
          <p>¡Gracias por su pedido!</p>
          <p>www.boodfood.com</p>
        </div>
        
        <div class="no-print" style="margin-top: 30px; text-align: center;">
          <button onclick="window.print()" style="padding: 10px 30px; font-size: 16px; cursor: pointer;">
            🖨️ Imprimir
          </button>
          <button onclick="window.close()" style="padding: 10px 30px; font-size: 16px; cursor: pointer; margin-left: 10px;">
            Cerrar
          </button>
        </div>
      </body>
      </html>
    `);
    
    printWindow.document.close();
    
  } catch (err) {
    showToast('❌ Error al imprimir: ' + err.message, 'error');
  }
};

window.filtrarPedidos = () => {
  const tipoFilter = document.getElementById('filter-tipo-pedido').value;
  const estadoFilter = document.getElementById('filter-estado-pedido').value;
  const fechaFilter = document.getElementById('filter-fecha-pedido').value;
  
  const rows = document.querySelectorAll('#tbody-pedidos tr');
  
  rows.forEach(row => {
    let mostrar = true;
    
    if (tipoFilter !== 'todos' && row.dataset.tipo !== tipoFilter) {
      mostrar = false;
    }
    
    if (estadoFilter !== 'todos' && row.dataset.estado !== estadoFilter) {
      mostrar = false;
    }
    
    // Filtro de fecha (simplificado)
    // En producción, deberías comparar con la fecha real del pedido
    
    row.style.display = mostrar ? '' : 'none';
  });
};

// Función de toast para notificaciones
function showToast(message, type = 'info') {
  if (typeof Toastify !== 'undefined') {
    Toastify({
      text: message,
      duration: 3000,
      gravity: "top",
      position: "right",
      backgroundColor: type === 'success' ? '#4caf50' : type === 'error' ? '#f44336' : '#2196f3',
    }).showToast();
  } else {
    alert(message);
  }
}

// Inicialización del módulo
window.pedidosModuleLoaded = true;
cargarPedidos();
