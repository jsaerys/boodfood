// static/js/admin/dashboard.js

// El contenido del dashboard ya está en dashboard_content.html
// Este archivo se carga para marcar que el módulo está listo

window.dashboardModuleLoaded = true;

// Actualizar estadísticas cada 30 segundos
setInterval(() => {
  if (window.currentView === 'dashboard') {
    // Recargar la vista completa para actualizar datos
    const scriptContent = document.querySelector('#dashboard script');
    if (scriptContent) {
      eval(scriptContent.textContent);
    }
  }
}, 30000);

console.log('✅ Módulo Dashboard cargado');
