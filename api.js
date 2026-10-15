/**
 * PrestoPronto, versión 1.2
 * Archivo: api.js (capa intermedia de comunicación; va en la raíz del sitio, junto a las carpetas consola y sitio)
 * Autor: Luis Leyton-Johns | ORCID 0000-0002-4462-403X | linkedin.com/in/luis-leyton-johns
 *
 * Regla: las pantallas nunca llaman al servidor directamente; todo pasa por este archivo.
 * Al migrar a la arquitectura definitiva se reescribe solo este archivo.
 *
 * CONFIGURACIÓN: pega aquí, una sola vez, la URL de la implementación de Apps Script (termina en /exec).
 */
const PP_URL_SERVIDOR = 'https://script.google.com/macros/s/AKfycbwAsJWpjmqTMjXj1KLHcUfUCTSMPaG-ETdR--lrFrAJCyqC0zKej5zpTztBDZDNFeqB/exec';

const PP_API = (function () {
  'use strict';

  let URL_SERVIDOR = PP_URL_SERVIDOR;
  let AMBIENTE = 'general';
  let alExpirar = null;

  /* ---------- Almacenamiento de la sesión (en este navegador) ---------- */
  const clave = function () { return 'pp_token_' + AMBIENTE; };
  function leer(store, k) { try { return window[store].getItem(k); } catch (e) { return null; } }
  function escribir(store, k, v) { try { if (v) window[store].setItem(k, v); else window[store].removeItem(k); } catch (e) { /* sin almacenamiento */ } }

  /** La sesión de soporte vive solo en la pestaña donde se abrió; la normal, en el navegador. */
  function token() { return leer('sessionStorage', clave()) || leer('localStorage', clave()) || ''; }
  function guardarToken(t, soloPestana) {
    if (soloPestana) escribir('sessionStorage', clave(), t);
    else { escribir('sessionStorage', clave(), null); escribir('localStorage', clave(), t); }
  }
  function borrarToken() { escribir('sessionStorage', clave(), null); escribir('localStorage', clave(), null); }

  async function llamar(accion, datos) {
    if (!URL_SERVIDOR) throw new Error('Falta configurar la URL del sistema en el archivo api.js.');
    let r;
    try {
      r = await fetch(URL_SERVIDOR, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ accion: accion, datos: datos || {}, token: token() })
      });
    } catch (e) {
      throw new Error('No hay conexión con el sistema. Revisa tu internet.');
    }
    let j;
    try { j = await r.json(); }
    catch (e) { throw new Error('El sistema no respondió correctamente. Intenta de nuevo en un momento.'); }
    if (!j.ok) {
      const err = new Error(j.error || 'Error desconocido.');
      err.codigo = j.codigo || '';
      if (err.codigo === 'SESION') { borrarToken(); if (alExpirar) alExpirar(err.message); }
      throw err;
    }
    return j.data;
  }

  return {
    /** Cada pantalla se identifica: 'consola', 'sitio', 'gestion', 'cocina', 'despacho' o 'web'. */
    iniciar: function (opciones) {
      const o = opciones || {};
      AMBIENTE = o.ambiente || 'general';
      if (o.url) URL_SERVIDOR = o.url;
      alExpirar = o.alExpirar || null;
      // Sesión de soporte abierta desde la Consola: se toma una vez y queda solo en esta pestaña
      const pendiente = leer('localStorage', 'pp_soporte_pendiente');
      if (AMBIENTE === 'sitio' && pendiente) {
        escribir('localStorage', 'pp_soporte_pendiente', null);
        guardarToken(pendiente, true);
      }
    },
    tieneSesion: function () { return !!token(); },
    configurado: function () { return !!URL_SERVIDOR; },

    /* ---------- Sesión ---------- */
    ingresar: async function (email, clave) {
      const p = await llamar('login', { email: email, clave: clave });
      guardarToken(p.token, false);
      return p;
    },
    ingresarConPin: async function (negocio, pin) {
      const p = await llamar('loginPin', { negocio: negocio, pin: pin });
      guardarToken(p.token, false);
      return p;
    },
    perfil: function () { return llamar('perfil'); },
    cambiarClave: function (actual, nueva) { return llamar('cambiarClave', { actual: actual, nueva: nueva }); },
    salir: async function () {
      try { await llamar('cerrarSesion'); } catch (e) { /* igual se borra localmente */ }
      borrarToken();
    },

    /* ---------- Administrador del sitio ---------- */
    obtenerCatalogo: function () { return llamar('catalogo'); },
    guardarProducto: function (producto) { return llamar('guardarProducto', { producto: producto }); },
    cambiarDisponible: function (productoId, disponible) { return llamar('cambiarDisponible', { producto_id: productoId, disponible: disponible }); },
    eliminarProducto: function (productoId) { return llamar('eliminarProducto', { producto_id: productoId }); },
    subirFoto: function (productoId, base64, mime) { return llamar('subirFoto', { producto_id: productoId, base64: base64, mime: mime || 'image/jpeg' }); },
    guardarCategoria: function (categoria, esNueva) { return llamar('guardarCategoria', { categoria: categoria, nueva: !!esNueva }); },
    eliminarCategoria: function (categoriaId) { return llamar('eliminarCategoria', { categoria_id: categoriaId }); },
    guardarSubcategoria: function (subcategoria, esNueva) { return llamar('guardarSubcategoria', { subcategoria: subcategoria, nueva: !!esNueva }); },
    eliminarSubcategoria: function (subcategoriaId) { return llamar('eliminarSubcategoria', { subcategoria_id: subcategoriaId }); },
    /** hojas: { Categorias, Subcategorias, Productos, Variantes }; opciones: { simular, desactivarAusentes } */
    importarCatalogo: function (hojas, opciones) {
      const o = opciones || {};
      return llamar('importar', { hojas: hojas, simular: !!o.simular, desactivarAusentes: !!o.desactivarAusentes });
    },

    /* ---------- Consola PrestoPronto ---------- */
    resumenConsola: function () { return llamar('consolaResumen'); },
    listarNegocios: function () { return llamar('listarNegocios'); },
    obtenerNegocio: function (negocioId) { return llamar('obtenerNegocio', { negocio_id: negocioId }); },
    crearNegocio: function (negocio, dueno) { return llamar('crearNegocio', { negocio: negocio, dueno: dueno }); },
    guardarNegocio: function (negocio) { return llamar('guardarNegocio', { negocio: negocio }); },
    cambiarEstadoNegocio: function (negocioId, estado, motivo) { return llamar('cambiarEstadoNegocio', { negocio_id: negocioId, estado: estado, motivo: motivo }); },
    cambiarPlan: function (negocioId, plan, tarifa) { return llamar('cambiarPlan', { negocio_id: negocioId, plan: plan, tarifa_mensual: tarifa }); },
    crearUsuario: function (usuario) { return llamar('crearUsuario', { usuario: usuario }); },
    actualizarUsuario: function (usuario) { return llamar('actualizarUsuario', { usuario: usuario }); },
    restablecerAcceso: function (usuarioId) { return llamar('restablecerAcceso', { usuario_id: usuarioId }); },
    cerrarSesionesUsuario: function (usuarioId) { return llamar('cerrarSesionesUsuario', { usuario_id: usuarioId }); },
    registrarPago: function (pago) { return llamar('registrarPago', { pago: pago }); },
    anularPago: function (pagoId, motivo) { return llamar('anularPago', { pago_id: pagoId, motivo: motivo }); },
    registrarConsumo: function (consumo) { return llamar('registrarConsumo', { consumo: consumo }); },
    listarEquipo: function () { return llamar('listarEquipo'); },
    bitacora: function (filtros) { return llamar('bitacora', filtros || {}); },
    /** Pide una sesión de soporte; la pantalla abre después el Administrador del sitio en otra pestaña. */
    entrarComoNegocio: async function (negocioId) {
      const r = await llamar('entrarComoNegocio', { negocio_id: negocioId });
      escribir('localStorage', 'pp_soporte_pendiente', r.token);
      return r.negocio;
    },

    /* ---------- Público (web del negocio) ---------- */
    obtenerCartaPublica: function (negocio) { return llamar('carta', { negocio: negocio }); }
  };
})();
