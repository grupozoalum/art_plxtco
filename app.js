/* ═══════════════════════════════════════════════════════════════
   ARTE PLATAXCO — Tienda en línea (app.js)
   Firebase v12 · Firestore en tiempo real · Auth de clientes
   Todas las colecciones usan el prefijo "ap_" para no mezclarse
   con las colecciones de pruebas que ya existen en el proyecto.
═══════════════════════════════════════════════════════════════ */
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-app.js";
import {
  getFirestore, collection, doc, onSnapshot, query, orderBy, where,
  setDoc, getDoc, updateDoc, deleteDoc, serverTimestamp, Timestamp, getCountFromServer
} from "https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js";
import {
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  onAuthStateChanged, signOut, updateProfile
} from "https://www.gstatic.com/firebasejs/12.10.0/firebase-auth.js";

/* ── CONFIGURACIÓN ───────────────────────────────────────────── */
const firebaseConfig = {
  apiKey: "AIzaSyAnq1OZavOTquMPyLs_etqA0qystCd7rMI",
  authDomain: "oracles-99bc3.firebaseapp.com",
  projectId: "oracles-99bc3",
  storageBucket: "oracles-99bc3.firebasestorage.app",
  messagingSenderId: "785165056789",
  appId: "1:785165056789:web:65de548f1e14331f0d871c",
  measurementId: "G-RZTQGQZ361"
};

// Colecciones propias de ARTE PLATAXCO
const COL = {
  productos: "ap_productos",
  clientes:  "ap_clientes",
  config:    "ap_config",
  banners:   "ap_banners",
  resenas:   "ap_resenas",
  pedidos:   "ap_pedidos",
  presencia: "ap_presencia"
};

// Datos de contacto de la tienda (cámbialos aquí)
const TIENDA = {
  whatsapp:  "525548588680",       // solo dígitos, con lada de país
  telefono:  "+525548588680",
  instagram: "",                   // ej. "https://www.instagram.com/arteplataxco/"  (vacío = se oculta)
  facebook:  "",                   // ej. "https://www.facebook.com/arteplataxco"   (vacío = se oculta)
  cupon:     "PLATAXCO15",
  cuponPct:  0.15
};

const app  = initializeApp(firebaseConfig);
const db   = getFirestore(app);
const auth = getAuth(app);

/* ── UTILIDADES ──────────────────────────────────────────────── */
const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const money = n => "$" + Number(n || 0).toLocaleString("es-MX", { maximumFractionDigits: 2 }) + " MXN";
const waLink = txt => `https://wa.me/${TIENDA.whatsapp}${txt ? "?text=" + encodeURIComponent(txt) : ""}`;
const PLACEHOLDER = "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"><rect width="400" height="400" fill="#0d0d0f"/><text x="200" y="210" fill="#2a2a2a" font-family="serif" font-size="28" text-anchor="middle">PLATAXCO</text></svg>');
const mainImg = p => (Array.isArray(p.imagenes) && p.imagenes[0]) || p.imageUrl || PLACEHOLDER;
const isSold  = p => (Number(p.cantidad) || 0) <= 0 && p.porPedido !== true;
const tags    = p => p.etiquetas || {};

window.notify = msg => {
  const n = $("#notif"); n.textContent = msg; n.style.transform = "translateX(0)";
  clearTimeout(n._t); n._t = setTimeout(() => { n.style.transform = "translateX(160%)"; }, 3000);
};

/* ── CONTACTO ────────────────────────────────────────────────── */
$$("[data-wa]").forEach(a => a.href = waLink());
$("#soc-tel").href = "tel:" + TIENDA.telefono;
[["#soc-ig", TIENDA.instagram], ["#soc-fb", TIENDA.facebook]].forEach(([id, url]) => {
  const el = $(id); if (url) el.href = url; else el.remove();
});
$("#year").textContent = new Date().getFullYear();

/* ═══════════════════════════════════════════════════════════════
   TEMAS ESTACIONALES (el admin lo cambia desde el ERP)
═══════════════════════════════════════════════════════════════ */
const TEMAS = {
  INVIERNO:{subtitle:'Colección Invierno &nbsp;·&nbsp; Elegancia Helada',bar:'❄️ COLECCIÓN INVIERNO — PIEZAS EXCLUSIVAS · JOYERÍA HELADA DE LUJO · ENVÍO GRATIS DESDE $1,500 MXN',fx:'snow',rgb:[168,216,234]},
  PRIMAVERA:{subtitle:'Colección Primavera &nbsp;·&nbsp; Flores de Lujo',bar:'🌸 COLECCIÓN PRIMAVERA — PIEZAS EN FLOR · JOYERÍA EXCLUSIVA · ENVÍO GRATIS DESDE $1,500 MXN',fx:'petals',rgb:[249,168,212]},
  '14_DE_FEBRERO':{subtitle:'San Valentín &nbsp;·&nbsp; Joyas para el Amor',bar:'💝 SAN VALENTÍN — EL REGALO PERFECTO · JOYAS DE AMOR · ENVÍO A TODO MÉXICO',fx:'hearts',rgb:[255,77,125]},
  '10_DE_MAYO':{subtitle:'Día de las Madres &nbsp;·&nbsp; Para Mamá con Amor',bar:'👩 DÍA DE LAS MADRES — EL MEJOR REGALO · JOYAS PARA MAMÁ · ENVÍO GRATIS DESDE $1,500 MXN',fx:'petals',rgb:[251,191,36]},
  '15_DE_SEPTIEMBRE':{subtitle:'Fiestas Patrias &nbsp;·&nbsp; Orgullo Mexicano',bar:'🇲🇽 FIESTAS PATRIAS — COLECCIÓN ESPECIAL · JOYERÍA MEXICANA DE LUJO · ENVÍO A TODO MÉXICO',fx:'sparkles',rgb:[34,197,94]},
  VERANO:{subtitle:'Colección Verano &nbsp;·&nbsp; Brilla con Estilo',bar:'☀️ COLECCIÓN VERANO — BRILLA BAJO EL SOL · JOYERÍA EXCLUSIVA · ENVÍO GRATIS DESDE $1,500 MXN',fx:'suns',rgb:[251,146,60]},
  'FIN_DE_AÑO':{subtitle:'Fin de Año &nbsp;·&nbsp; Brillo de Celebración',bar:'🎆 FIN DE AÑO — CIERRA EL AÑO CON LUJO · JOYAS EXCLUSIVAS · ENVÍO A TODO MÉXICO',fx:'sparkles',rgb:[192,132,252]},
  BLACK_FRIDAY:{subtitle:'Black Friday &nbsp;·&nbsp; Lujo a Tu Alcance',bar:'🖤 BLACK FRIDAY — OFERTAS EXCLUSIVAS · DESCUENTOS EN JOYERÍA · ENVÍO GRATIS DESDE $1,500 MXN',fx:'sparkles',rgb:[229,229,229]},
  BUEN_FIN:{subtitle:'Buen Fin &nbsp;·&nbsp; Joyas con Precio Especial',bar:'🛍️ BUEN FIN — APROVECHA LAS OFERTAS · JOYERÍA DE LUJO CON DESCUENTO · ENVÍO GRATIS DESDE $1,500 MXN',fx:'sparkles',rgb:[52,211,153]},
  DIA_DE_REYES:{subtitle:'Día de Reyes &nbsp;·&nbsp; Magia y Lujo',bar:'👑 DÍA DE REYES MAGOS — REGALOS MÁGICOS · JOYAS EXCLUSIVAS · ENVÍO A TODO MÉXICO',fx:'sparkles',rgb:[96,165,250]}
};
const BAR_DEFAULT = $("#bar-a").innerHTML;
const SUB_DEFAULT = $("#hero-sub").innerHTML;

let _stopFX = false, _fxTimers = [];
function clearFX() { _stopFX = true; _fxTimers.forEach(clearTimeout); _fxTimers = []; $$(".sp").forEach(e => e.remove()); }
function launchFX(tipo, rgb) {
  _stopFX = false;
  const layer = $("#sp-layer"); if (!layer) return;
  const mobile = window.innerWidth <= 768;
  const C = { snow:{ch:['❄','❅','❆','*','·'],n:16}, petals:{ch:['🌸','✿','❀','🌷'],n:12}, hearts:{ch:['❤','💖','♥','💗'],n:14}, suns:{ch:['☀','✦','◉','◎'],n:9}, sparkles:{ch:['✦','✧','⋆','★','✵'],n:16,sparkle:true} };
  const cfg = C[tipo] || C.sparkles;
  const n = mobile ? Math.ceil(cfg.n / 2) : cfg.n; // menos partículas en teléfono
  function spawn() {
    if (_stopFX) return;
    const el = document.createElement("span"); el.className = "sp" + (cfg.sparkle ? " sparkle" : "");
    el.textContent = cfg.ch[Math.floor(Math.random() * cfg.ch.length)];
    const dur = cfg.sparkle ? 4 + Math.random() * 8 : 8 + Math.random() * 10;
    const delay = Math.random() * dur, size = .5 + Math.random() * .85, left = Math.random() * 100;
    const top = cfg.sparkle ? Math.random() * 100 : null;
    el.style.cssText = `left:${left}vw;${top !== null ? `top:${top}vh;` : ""}font-size:${size}rem;animation-duration:${dur}s;animation-delay:-${delay}s;color:rgba(${rgb[0]},${rgb[1]},${rgb[2]},.72);`;
    layer.appendChild(el);
    _fxTimers.push(setTimeout(() => { el.remove(); if (!_stopFX) spawn(); }, (dur + delay + .5) * 1000));
  }
  for (let i = 0; i < n; i++) _fxTimers.push(setTimeout(spawn, i * 220));
}
function applyTheme(key) {
  document.body.className = document.body.className.replace(/t-\S+/g, "").trim();
  clearFX();
  const t = TEMAS[key];
  if (!t) { // sin tema → valores originales
    ["bar-a", "bar-b"].forEach(id => $("#" + id).innerHTML = BAR_DEFAULT);
    $("#hero-sub").innerHTML = SUB_DEFAULT; window._tRGB = null; return;
  }
  document.body.classList.add("t-" + key);
  const html = `<span>${t.bar}</span><span class="bar-sep">◆</span><span>${t.bar}</span><span class="bar-sep">◆</span>`;
  ["bar-a", "bar-b"].forEach(id => $("#" + id).innerHTML = html);
  $("#hero-sub").innerHTML = t.subtitle;
  window._tRGB = t.rgb;
  setTimeout(() => launchFX(t.fx, t.rgb), 400);
}
onSnapshot(doc(db, COL.config, "tematica"), snap => applyTheme(snap.exists() ? snap.data().tema : null), () => {});

/* ═══════════════════════════════════════════════════════════════
   CARRUSEL DE BANNERS (ap_banners)
═══════════════════════════════════════════════════════════════ */
let cImgs = [], cIdx = 0, cTimer = null; const cInt = 5500;
const cTrack = $("#carousel-track"), cProgBar = $("#cprogbar");
const aPrev = $("#cprev"), aNext = $("#cnext"), promoSec = $("#promo-sec");

function buildCarousel(imgs) {
  clearInterval(cTimer); cIdx = 0;
  cTrack.style.transform = "translateX(0)";
  if (!imgs.length) { promoSec.classList.remove("active"); return; }
  promoSec.classList.add("active"); cImgs = imgs;
  cTrack.innerHTML = imgs.map((img, i) => `
    <div class="carousel-slide${i === 0 ? " active" : ""}">
      <img src="${esc(img.url)}" alt="${esc(img.titulo || "Promoción")}" loading="${i === 0 ? "eager" : "lazy"}">
      <div class="slide-overlay"></div>
      <div class="slide-content"><div class="slide-title">${esc(img.titulo || "")}</div>
      <a href="#catalogo" class="slide-cta">Ver colección <i class="fa-solid fa-arrow-right" style="font-size:7px"></i></a></div>
    </div>`).join("");
  const dotsEl = $("#cdots"); dotsEl.innerHTML = "";
  if (imgs.length <= 1) { aPrev.classList.add("hidden"); aNext.classList.add("hidden"); cProgBar.parentElement.style.display = "none"; return; }
  cProgBar.parentElement.style.display = "";
  imgs.forEach((_, i) => { const d = document.createElement("button"); d.className = "c-dot" + (i === 0 ? " on" : ""); d.setAttribute("aria-label", "Banner " + (i + 1)); d.onclick = () => { goSlide(i); startCarousel(); }; dotsEl.appendChild(d); });
  aPrev.classList.remove("hidden"); aNext.classList.remove("hidden"); startCarousel();
}
function goSlide(idx) {
  const slides = $$(".carousel-slide", cTrack), dots = $$(".c-dot");
  slides[cIdx]?.classList.remove("active"); dots[cIdx]?.classList.remove("on");
  cIdx = (idx + cImgs.length) % cImgs.length;
  cTrack.style.transform = `translateX(-${cIdx * 100}%)`;
  slides[cIdx]?.classList.add("active"); dots[cIdx]?.classList.add("on");
  resetProg();
}
function startCarousel() { clearInterval(cTimer); cTimer = setInterval(() => goSlide(cIdx + 1), cInt); resetProg(); }
function resetProg() { cProgBar.style.transition = "none"; cProgBar.style.width = "0%"; requestAnimationFrame(() => requestAnimationFrame(() => { cProgBar.style.transition = `width ${cInt}ms linear`; cProgBar.style.width = "100%"; })); }
aPrev.onclick = () => { goSlide(cIdx - 1); startCarousel(); };
aNext.onclick = () => { goSlide(cIdx + 1); startCarousel(); };
const cBox = $("#carousel-box");
cBox.addEventListener("mouseenter", () => { clearInterval(cTimer); cProgBar.style.transition = "none"; });
cBox.addEventListener("mouseleave", () => { if (cImgs.length > 1) startCarousel(); });
let touchX = 0;
cBox.addEventListener("touchstart", e => { touchX = e.touches[0].clientX; }, { passive: true });
cBox.addEventListener("touchend", e => { const dx = touchX - e.changedTouches[0].clientX; if (Math.abs(dx) > 38 && cImgs.length > 1) { goSlide(cIdx + (dx > 0 ? 1 : -1)); startCarousel(); } });
onSnapshot(query(collection(db, COL.banners), orderBy("creadoEn", "desc")), snap => {
  buildCarousel(snap.docs.map(d => d.data()).filter(b => b.activo !== false && b.url).map(b => ({ url: b.url, titulo: b.titulo || "" })));
}, () => buildCarousel([]));

/* ═══════════════════════════════════════════════════════════════
   OBSERVADORES (fade-in de tarjetas y secciones)
═══════════════════════════════════════════════════════════════ */
const cardIO = new IntersectionObserver(entries => {
  entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add("shown"); cardIO.unobserve(e.target); } });
}, { threshold: .1, rootMargin: "0px 0px -30px 0px" });
const revIO = new IntersectionObserver(entries => {
  entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add("in"); revIO.unobserve(e.target); } });
}, { threshold: .1, rootMargin: "0px 0px -36px 0px" });
$$(".reveal").forEach(el => revIO.observe(el));
$$(".arch-card").forEach((el, i) => { el.style.transitionDelay = `${i * 0.07}s`; });

/* ═══════════════════════════════════════════════════════════════
   CATÁLOGO EN TIEMPO REAL (ap_productos)
═══════════════════════════════════════════════════════════════ */
const PRODS = new Map();   // id → producto
let curFilter = "todos";
const grid = $("#products-grid");

function categoryOf(p) {
  if (p.categoria) return String(p.categoria).toLowerCase();
  const n = String(p.nombre || "").toLowerCase();
  if (n.includes("conjunto") || n.includes("set")) return "conjuntos";
  if (n.includes("anillo")) return "anillos";
  if (n.includes("pulso") || n.includes("pulsera") || n.includes("brazalete") || n.includes("esclava")) return "pulsos";
  if (n.includes("cadena") || n.includes("collar")) return "cadenas";
  if (n.includes("arete") || n.includes("arracada")) return "aretes";
  if (n.includes("dije")) return "dijes";
  return "otros";
}
function badgesHtml(p, cls) {
  const t = tags(p); if (isSold(p)) return "";
  const map = cls === "card"
    ? [["promocion", "promo", "Promoción"], ["nuevo", "nuevo", "Nuevo"], ["edicionLimitada", "limited", "Edición Limitada"], ["piezaUnica", "unique", "Pieza Única"], ["masVendido", "best", "Más Vendido"]]
    : [["promocion", "pro", "Promoción"], ["nuevo", "nue", "Nuevo"], ["edicionLimitada", "lim", "Edición Limitada"], ["piezaUnica", "uni", "Pieza Única"], ["masVendido", "top", "Más Vendido"]];
  return map.filter(([k]) => t[k]).map(([, c, label]) => cls === "card" ? `<div class="mkbadge ${c}">${label}</div>` : `<span class="mbadge ${c}">${label}</span>`).join("");
}
function priceHtml(p, big) {
  const sold = isSold(p);
  const hasOld = p.precioAnterior && Number(p.precioAnterior) > Number(p.precio) && !sold;
  return big
    ? `<div class="modal-price-row">${hasOld ? `<span class="modal-price-old">$${Number(p.precioAnterior).toLocaleString("es-MX")}</span>` : ""}<span class="modal-price-now">${money(p.precio)}</span></div>`
    : `<div class="col-price">${hasOld ? `<span class="col-price-old">$${Number(p.precioAnterior).toLocaleString("es-MX")}</span>` : ""}<span class="col-price-now">${money(p.precio)}</span></div>`;
}

function renderGrid() {
  const list = [...PRODS.values()];
  if (!list.length) { grid.innerHTML = `<div class="grid-empty">Muy pronto nuevas piezas</div>`; return; }
  grid.innerHTML = "";
  list.forEach(p => {
    const sold = isSold(p), pp = p.porPedido === true && (Number(p.cantidad) || 0) <= 0;
    const sBadge = sold ? "Agotado" : pp ? "Bajo Pedido" : "Disponible";
    const sSty = sold ? "background:#c62828;color:#fff" : pp ? "background:rgba(0,229,255,.1);color:#18ffff;border:1px solid rgba(0,229,255,.26)" : "background:#10B981;color:#fff";
    const meta = [];
    if (p.pesoGramos) meta.push(`<span><i class="fa-solid fa-scale-balanced"></i>${esc(p.pesoGramos)} g</span>`);
    if (!sold && !pp && Number(p.cantidad) > 1) meta.push(`<span><i class="fa-solid fa-cubes"></i>${Number(p.cantidad)} disponibles</span>`);
    const card = document.createElement("div");
    card.className = "col-card"; card.dataset.cat = categoryOf(p); card.dataset.id = p.id;
    card.innerHTML = `
      <div class="col-badges">${badgesHtml(p, "card")}</div>
      <div class="col-status" style="${sSty}">${sBadge}</div>
      <div class="col-img" style="background-image:url('${esc(mainImg(p))}');${sold ? "filter:grayscale(100%) brightness(.4)" : ""}"></div>
      <div class="col-overlay">
        <div class="col-name">${esc(p.nombre)}</div>
        <div class="col-mat">${esc(p.material || "Joyería Exclusiva")}</div>
        ${meta.length ? `<div class="col-meta">${meta.join("")}</div>` : ""}
        ${priceHtml(p)}
        <span class="col-link"><i class="fa-solid fa-expand" style="font-size:8px"></i> Ver detalles</span>
      </div>`;
    card.addEventListener("click", () => openQV(p.id));
    grid.appendChild(card);
    cardIO.observe(card);
  });
  applyFilter(curFilter);
  const precios = list.filter(p => !isSold(p) && Number(p.precio) > 0).map(p => Number(p.precio));
  if (precios.length) $("#hero-min").textContent = money(Math.min(...precios));
}
function applyFilter(val) {
  curFilter = val;
  $$(".f-btn").forEach(b => b.classList.toggle("on", b.dataset.f === val));
  $$(".col-card").forEach(c => { c.style.display = (val !== "todos" && c.dataset.cat !== val) ? "none" : ""; });
}
$$(".f-btn").forEach(btn => btn.addEventListener("click", e => applyFilter(e.currentTarget.dataset.f)));

onSnapshot(query(collection(db, COL.productos), orderBy("creadoEn", "desc")), snap => {
  PRODS.clear();
  snap.forEach(d => { const p = { id: d.id, ...d.data() }; if (p.visible !== false) PRODS.set(d.id, p); });
  renderGrid();
  loadArchImgs([...PRODS.values()]);
  syncCartWithStock();
}, err => { console.error(err); grid.innerHTML = `<div class="grid-empty">No se pudo cargar la colección</div>`; });

/* ── QUICK VIEW ─────────────────────────────────────────────── */
function openQV(id) {
  const p = PRODS.get(id); if (!p) return;
  const sold = isSold(p);
  const imgs = (Array.isArray(p.imagenes) && p.imagenes.length ? p.imagenes : [mainImg(p)]);
  let couponHint = "";
  if (!sold && window._coupon.active && !window._coupon.used) {
    const d = Math.round(p.precio * (1 - TIENDA.cuponPct));
    couponHint = `<div class="coupon-hint show"><i class="fa-solid fa-tag" style="color:var(--green)"></i><div><div style="font-size:8px;color:var(--green);letter-spacing:2px;font-weight:700;text-transform:uppercase">Cupón ${TIENDA.cupon} activo</div><div style="font-size:12px;color:var(--txt);margin-top:2px">Pagas: <strong style="color:var(--ta)">${money(d)}</strong> <span style="font-size:9px;color:#555">con 15% OFF</span></div></div></div>`;
  }
  const specs = [];
  if (p.material) specs.push(["Material", p.material]);
  if (p.pesoGramos) specs.push(["Peso", p.pesoGramos + " g"]);
  if (!sold) specs.push(["Disponibles", (Number(p.cantidad) || 0) > 0 ? Number(p.cantidad) : "Bajo pedido"]);
  const badges = badgesHtml(p, "modal");
  const actionBtn = sold
    ? `<button class="btn-cart" style="background:#111;color:#333;animation:none;cursor:not-allowed" disabled><i class="fa-solid fa-lock"></i> Agotado</button>`
    : `<button class="btn-cart" id="qvAdd"><i class="fa-solid fa-cart-plus"></i> Agregar al Carrito</button>`;
  const directWa = !sold ? `<a href="${waLink(`💎 Hola, me interesa:\n\n*${p.nombre}*\nPrecio: ${money(p.precio)}\n${p.material ? "Material: " + p.material + "\n" : ""}${p.pesoGramos ? "Peso: " + p.pesoGramos + " g\n" : ""}\n¿Está disponible?`)}" target="_blank" rel="noopener" class="btn-wa-direct"><i class="fa-brands fa-whatsapp"></i> Preguntar por esta pieza</a>` : "";
  $("#qvBody").innerHTML = `
    <div class="modal-img">
      <img id="qvMain" src="${esc(imgs[0])}" alt="${esc(p.nombre)}" ${sold ? 'style="filter:grayscale(100%);opacity:.5"' : ""}>
      ${imgs.length > 1 ? `<div class="modal-thumbs">${imgs.map((u, i) => `<img src="${esc(u)}" data-i="${i}" class="${i === 0 ? "on" : ""}" alt="">`).join("")}</div>` : ""}
    </div>
    <div class="modal-info">
      ${badges ? `<div class="modal-badges">${badges}</div>` : ""}
      <h3>${esc(p.nombre)}</h3>
      <div class="modal-material">${esc(p.material || "Joyería Exclusiva")}</div>
      ${priceHtml(p, true)}${couponHint}
      ${specs.length ? `<div class="modal-specs">${specs.map(([k, v]) => `<div class="spec"><small>${k}</small><b>${esc(v)}</b></div>`).join("")}</div>` : ""}
      <p class="modal-desc">${esc(p.descripcion || "Una pieza magistral diseñada para resaltar tu elegancia. Perfecta para ocasiones especiales o como regalo inolvidable.")}</p>
      <div style="margin-top:6px">${actionBtn}${directWa}${!sold ? '<p class="modal-trust"><i class="fa-solid fa-shield-alt"></i> Compra segura · Envío a todo México</p>' : ""}</div>
    </div>`;
  $$(".modal-thumbs img").forEach(t => t.addEventListener("click", () => {
    $("#qvMain").src = imgs[+t.dataset.i]; $$(".modal-thumbs img").forEach(x => x.classList.toggle("on", x === t));
  }));
  $("#qvAdd")?.addEventListener("click", () => addCart(p.id));
  openModal($("#qvModal"));
}
$("#qvClose").onclick = () => closeModal($("#qvModal"));

/* ── ARQUETIPOS: imágenes reales de la colección ─────────────── */
let archRotTimer = null;
function loadArchImgs(prods) {
  const withImg = prods.filter(p => /^(https?:|data:image)/.test(mainImg(p)) && mainImg(p) !== PLACEHOLDER);
  const divs = $$("[data-abi]");
  clearInterval(archRotTimer);
  if (!withImg.length || !divs.length) return;
  const shuffle = a => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
  function assign(list, first) {
    divs.forEach((div, i) => {
      const prod = list[i % list.length]; const url = mainImg(prod);
      const card = div.closest(".arch-card"); if (card) card._prodId = prod.id;
      if (!first) div.classList.remove("loaded");
      const img = new Image();
      img.onload = () => setTimeout(() => { div.style.backgroundImage = `url('${url}')`; div.classList.add("loaded"); }, first ? i * 80 + 40 : 480);
      img.src = url;
    });
  }
  assign(shuffle(withImg), true);
  archRotTimer = setInterval(() => { if (!document.hidden) assign(shuffle(withImg), false); }, 8000);
}
$$(".arch-card").forEach(card => card.addEventListener("click", () => {
  $("#catalogo").scrollIntoView({ behavior: "smooth" });
  if (card._prodId) setTimeout(() => openQV(card._prodId), 700);
}));

/* ═══════════════════════════════════════════════════════════════
   CUENTAS DE CLIENTE (ap_clientes) + CUPÓN
═══════════════════════════════════════════════════════════════ */
const authModal = $("#authModal"), profileModal = $("#profileModal");
let currentUser = null;
window._coupon = { active: false, used: false, code: TIENDA.cupon };
let profName = "";

function openModal(m) { m.classList.add("open"); document.body.style.overflow = "hidden"; }
function closeModal(m) { m.classList.remove("open"); if (!$(".modal.open") && !$("#cartSide").classList.contains("open")) document.body.style.overflow = ""; }
window.addEventListener("click", e => { ["qvModal", "authModal", "profileModal"].forEach(id => { const el = $("#" + id); if (e.target === el) closeModal(el); }); });
document.addEventListener("keydown", e => { if (e.key === "Escape") { $$(".modal.open").forEach(closeModal); closeCart(); $("#exitPopup").classList.remove("show"); } });

$("#loginBtn").onclick = () => currentUser ? openProfile() : openModal(authModal);
$("#authClose").onclick = () => closeModal(authModal);
$("#profileClose").onclick = () => closeModal(profileModal);
function authTab(login) {
  $("#tLogin").classList.toggle("on", login); $("#tReg").classList.toggle("on", !login);
  $("#loginForm").classList.toggle("on", login); $("#regForm").classList.toggle("on", !login);
}
$("#tLogin").onclick = () => authTab(true);
$("#tReg").onclick = () => authTab(false);

function openProfile() { updateProfileUI(); openModal(profileModal); }
function updateProfileUI() {
  const box = $("#profCouponBox"), status = $("#profCouponStatus"), desc = $("#profCouponDesc"), copyBtn = $("#profCopyBtn");
  $("#profCouponCode").textContent = window._coupon.code;
  if (window._coupon.used) { status.innerHTML = '<div class="status-used"><i class="fa-solid fa-circle-check"></i> Cupón utilizado</div>'; desc.textContent = "15% aplicado en tu primera compra"; copyBtn.style.display = "none"; box.style.opacity = ".5"; }
  else if (window._coupon.active) { status.innerHTML = '<div class="status-active"><i class="fa-solid fa-tag"></i> Cupón activo — 15% OFF</div>'; desc.textContent = "15% de descuento en tu primera compra"; copyBtn.style.display = "inline-block"; box.style.opacity = "1"; }
  else { status.innerHTML = '<div style="font-size:8px;color:var(--txt3);letter-spacing:2px;text-transform:uppercase;margin-bottom:7px;">Sin cupón</div>'; desc.textContent = "No tienes cupones activos"; copyBtn.style.display = "none"; box.style.opacity = ".4"; }
}
$("#profCopyBtn").onclick = () => {
  const done = () => window.notify("¡Código copiado! " + TIENDA.cupon + " 📋");
  if (navigator.clipboard?.writeText) navigator.clipboard.writeText(TIENDA.cupon).then(done).catch(() => window.prompt("Copia tu código:", TIENDA.cupon));
  else window.prompt("Copia tu código:", TIENDA.cupon);
};

function updateExitState() {
  const g = $("#exitGuest"), a = $("#exitActive"), u = $("#exitUsed");
  const first = (profName || "").split(" ")[0];
  g.style.display = a.style.display = u.style.display = "none";
  if (!currentUser) g.style.display = "block";
  else if (window._coupon.active && !window._coupon.used) { a.style.display = "block"; $("#exitActiveGreet").textContent = "¡Hola" + (first ? ", " + first : "") + "!"; $("#exitCode").textContent = TIENDA.cupon; }
  else { u.style.display = "block"; $("#exitUsedGreet").textContent = "¡Hola" + (first ? ", " + first : "") + "!"; }
}

async function doRegister(name, email, password) {
  const uc = await createUserWithEmailAndPassword(auth, email, password);
  try { await updateProfile(uc.user, { displayName: name }); } catch (e) {}
  await setDoc(doc(db, COL.clientes, uc.user.uid), {
    nombre: name, correo: email, creadoEn: serverTimestamp(),
    carrito: cartItems, cuponActivo: true, cuponUsado: false, cupon: TIENDA.cupon
  });
  window._coupon = { active: true, used: false, code: TIENDA.cupon }; profName = name;
  window.notify("¡Bienvenido, " + name + "! Tu cupón " + TIENDA.cupon + " está activo 🎁");
}
const authErr = err => err.code === "auth/email-already-in-use" ? "Este correo ya está registrado."
  : err.code === "auth/weak-password" ? "La contraseña debe tener al menos 6 caracteres."
  : err.code === "auth/invalid-email" ? "Correo no válido." : "Error al crear cuenta.";

$("#regForm").addEventListener("submit", async e => {
  e.preventDefault();
  try { await doRegister($("#regName").value.trim(), $("#regEmail").value.trim(), $("#regPass").value); closeModal(authModal); setTimeout(openProfile, 500); }
  catch (err) { window.notify(authErr(err)); }
});
$("#loginForm").addEventListener("submit", e => {
  e.preventDefault();
  signInWithEmailAndPassword(auth, $("#loginEmail").value.trim(), $("#loginPass").value)
    .then(() => { window.notify("¡Bienvenido de vuelta! 💎"); closeModal(authModal); })
    .catch(() => window.notify("Usuario o contraseña incorrectos."));
});
$("#btnLogout").onclick = () => signOut(auth).then(() => { closeModal(profileModal); window.notify("Sesión cerrada."); });

onAuthStateChanged(auth, async user => {
  currentUser = user || null;
  const icon = $("#userIcon");
  if (user) {
    icon.className = "fa-solid fa-user-check"; icon.style.color = "#10B981";
    try {
      const snap = await getDoc(doc(db, COL.clientes, user.uid));
      if (snap.exists()) {
        const d = snap.data();
        profName = d.nombre || user.displayName || "";
        window._coupon = { active: !!d.cuponActivo, used: !!d.cuponUsado, code: d.cupon || TIENDA.cupon };
        // une el carrito de invitado con el guardado en la cuenta
        const saved = Array.isArray(d.carrito) ? d.carrito : [];
        const merged = [...saved];
        cartItems.forEach(it => { if (!merged.find(m => m.id === it.id)) merged.push(it); });
        cartItems = merged;
      } else {
        // cuenta creada desde otro sitio del mismo proyecto: se le da su ficha en ap_clientes
        profName = user.displayName || "";
        await setDoc(doc(db, COL.clientes, user.uid), { nombre: profName, correo: user.email, creadoEn: serverTimestamp(), carrito: cartItems, cuponActivo: true, cuponUsado: false, cupon: TIENDA.cupon }, { merge: true });
        window._coupon = { active: true, used: false, code: TIENDA.cupon };
      }
    } catch (e) { console.warn(e); }
    $("#profName").textContent = profName || "Cliente VIP";
    $("#profEmail").textContent = user.email || "";
    localStorage.removeItem("apCart");
    saveCart();
  } else {
    icon.className = "fa-solid fa-user"; icon.style.color = "var(--ta)";
    window._coupon = { active: false, used: false, code: TIENDA.cupon }; couponSel = false; profName = "";
    cartItems = readLocalCart();
    updateCart(); renderCart();
  }
  updateExitState(); updateProfileUI();
});

/* ═══════════════════════════════════════════════════════════════
   CARRITO (con cantidades, respeta el stock real)
═══════════════════════════════════════════════════════════════ */
let cartItems = readLocalCart(), couponSel = false;
function readLocalCart() { try { return JSON.parse(localStorage.getItem("apCart")) || []; } catch { return []; } }
function maxQty(item) {
  const p = PRODS.get(item.id);
  if (!p) return item.qty || 1;
  const stock = Number(p.cantidad) || 0;
  return p.porPedido ? Math.max(stock, 10) : stock;
}
function syncCartWithStock() {
  let changed = false;
  cartItems.forEach(it => {
    const p = PRODS.get(it.id); if (!p) return;
    if (it.precio !== Number(p.precio)) { it.precio = Number(p.precio); changed = true; }
    const m = maxQty(it); if (m > 0 && it.qty > m) { it.qty = m; changed = true; }
  });
  if (changed) saveCart(); else { updateCart(); renderCart(); }
}
async function saveCart() {
  if (currentUser) { try { await setDoc(doc(db, COL.clientes, currentUser.uid), { carrito: cartItems }, { merge: true }); } catch (e) {} }
  else { try { localStorage.setItem("apCart", JSON.stringify(cartItems)); } catch (e) {} }
  updateCart(); renderCart();
}
function updateCart() {
  const b = $("#cartBadge"), n = cartItems.reduce((s, i) => s + (i.qty || 1), 0);
  b.style.display = n > 0 ? "flex" : "none"; b.textContent = n;
}
function addCart(id) {
  const p = PRODS.get(id); if (!p || isSold(p)) return;
  const ex = cartItems.find(i => i.id === id);
  if (ex) {
    if (ex.qty >= maxQty(ex)) { window.notify("Ya tienes todas las piezas disponibles de esta joya"); return; }
    ex.qty++;
  } else {
    cartItems.push({ id, nombre: p.nombre, precio: Number(p.precio), imageUrl: mainImg(p), qty: 1, esPP: p.porPedido === true && (Number(p.cantidad) || 0) <= 0 });
  }
  saveCart(); window.notify("¡Agregado al carrito! 🛒"); closeModal($("#qvModal")); openCart();
}
function changeQty(idx, d) {
  const it = cartItems[idx]; if (!it) return;
  const next = (it.qty || 1) + d;
  if (next <= 0) cartItems.splice(idx, 1);
  else if (next > maxQty(it)) { window.notify("No hay más piezas disponibles"); return; }
  else it.qty = next;
  saveCart();
}
function toggleCoupon() {
  const cs = window._coupon; if (!cs.active || cs.used) return;
  couponSel = !couponSel; renderCart();
  if (couponSel) window.notify("Cupón " + cs.code + " aplicado 🎁 −15%");
}
function totals() {
  const sub = cartItems.reduce((s, i) => s + i.precio * (i.qty || 1), 0);
  const apD = couponSel && window._coupon.active && !window._coupon.used;
  const disc = apD ? Math.round(sub * TIENDA.cuponPct) : 0;
  return { sub, disc, total: sub - disc, apD };
}
function renderCart() {
  const cont = $("#cartItems"), tot = $("#cartTotals");
  if (!cartItems.length) {
    cont.innerHTML = `<div class="empty-msg"><i class="fa-solid fa-bag-shopping" style="font-size:2.2rem;margin-bottom:12px;opacity:.22;color:var(--ta);display:block"></i>Tu carrito está vacío</div>`;
    tot.innerHTML = `<div class="cart-total"><span>Total</span><span>$0 MXN</span></div>`; return;
  }
  let html = "", hasPP = false;
  cartItems.forEach((it, i) => {
    if (it.esPP) hasPP = true;
    html += `<div class="c-item">
      <img src="${esc(it.imageUrl || PLACEHOLDER)}" alt="${esc(it.nombre)}">
      <div class="c-item-det">
        <span class="c-item-name">${esc(it.nombre)}</span>
        <span class="c-item-price">${money(it.precio)}</span>
        ${it.esPP ? '<span style="color:#18ffff;font-size:8px;margin-top:2px;font-weight:700;letter-spacing:1px;"><i class="fa-solid fa-clock"></i> Bajo pedido</span>' : ""}
        <div class="c-qty"><button data-q="${i}" data-d="-1" aria-label="Quitar uno">−</button><span>${it.qty || 1}</span><button data-q="${i}" data-d="1" aria-label="Agregar uno">+</button></div>
      </div>
      <button class="c-remove" data-rm="${i}" aria-label="Eliminar"><i class="fa-solid fa-xmark"></i></button>
    </div>`;
  });
  if (hasPP) html += `<div class="cart-warn"><i class="fa-solid fa-circle-info"></i><p>Contiene piezas <strong>Bajo Pedido</strong>. Tardan 15–20 días hábiles.</p></div>`;
  const cs = window._coupon, hasAct = cs.active && !cs.used, hasUsed = cs.used;
  if (hasAct || hasUsed) {
    html += `<div style="margin-top:8px"><div class="coup-ttl"><i class="fa-solid fa-ticket" style="margin-right:5px;color:var(--ta);opacity:.5"></i>Mis cupones</div>
      <div class="coup-card ${hasAct && couponSel ? "sel" : ""} ${hasUsed ? "used" : ""}" id="coupCard"><div class="coup-chk"><i class="fa-solid fa-check"></i></div>
      <div style="flex:1;min-width:0"><div class="coup-code">${esc(cs.code)}</div><div class="coup-dsc">15% de descuento · Primera compra</div>${hasUsed ? '<span style="font-size:8px;color:var(--txt3);letter-spacing:1px;text-transform:uppercase">Ya utilizado</span>' : ""}</div>
      <div class="coup-pct">−15%</div></div></div>`;
  }
  cont.innerHTML = html;
  $$("[data-q]", cont).forEach(b => b.onclick = () => changeQty(+b.dataset.q, +b.dataset.d));
  $$("[data-rm]", cont).forEach(b => b.onclick = () => { cartItems.splice(+b.dataset.rm, 1); saveCart(); });
  $("#coupCard")?.addEventListener("click", toggleCoupon);
  const t = totals();
  tot.innerHTML = `<div class="cart-subtotal"><span>Subtotal</span><span>${money(t.sub)}</span></div>`
    + (t.apD ? `<div class="cart-disc"><span><i class="fa-solid fa-tag"></i> ${esc(cs.code)} (−15%)</span><span>−${money(t.disc)}</span></div>` : "")
    + `<div class="cart-total"><span>Total</span><span>${money(t.total)}</span></div>`;
}
function openCart() { $("#cartSide").classList.add("open"); $("#cartOverlay").style.display = "block"; document.body.style.overflow = "hidden"; renderCart(); }
function closeCart() { $("#cartSide").classList.remove("open"); $("#cartOverlay").style.display = "none"; if (!$(".modal.open")) document.body.style.overflow = ""; }
$("#cartBtn").onclick = e => { e.preventDefault(); openCart(); };
$("#closeCart").onclick = closeCart;
$("#cartOverlay").onclick = closeCart;

/* Checkout: registra el pedido en ap_pedidos (lo ve el ERP) y abre WhatsApp.
   La ventana se abre en el mismo toque para que Safari iOS no la bloquee. */
$("#checkoutBtn").onclick = () => {
  if (!cartItems.length) { window.notify("Tu carrito está vacío"); return; }
  const t = totals(), cs = window._coupon;
  const ref = doc(collection(db, COL.pedidos));          // id generado localmente
  const folio = ref.id.slice(0, 6).toUpperCase();
  let msg = `💎 *NUEVO PEDIDO — ARTE PLATAXCO*\nFolio: *${folio}*\n\nHola, me interesa encargar:\n\n`;
  cartItems.forEach((it, i) => { msg += `${i + 1}. *${it.nombre}*${it.esPP ? " _(Bajo pedido)_" : ""} × ${it.qty || 1} — ${money(it.precio * (it.qty || 1))}\n`; });
  msg += t.apD
    ? `\n💳 *SUBTOTAL: ${money(t.sub)}*\n🎁 *CUPÓN ${cs.code}: −${money(t.disc)} (15% OFF)*\n✅ *TOTAL FINAL: ${money(t.total)}*\n\n¿Me confirman disponibilidad? 🙏`
    : `\n💳 *TOTAL: ${money(t.sub)}*\n\n¿Me confirman disponibilidad para transferir? 🙏`;
  const w = window.open(waLink(msg), "_blank");
  if (!w) location.href = waLink(msg);

  setDoc(ref, {
    folio, estado: "pendiente", canal: "tienda",
    items: cartItems.map(it => ({ productoId: it.id, nombre: it.nombre, precio: it.precio, cantidad: it.qty || 1 })),
    subtotal: t.sub, descuento: t.disc, total: t.total, cupon: t.apD ? cs.code : null,
    clienteUid: currentUser?.uid || null, clienteNombre: profName || null, clienteCorreo: currentUser?.email || null,
    creadoEn: serverTimestamp()
  }).catch(e => console.warn("pedido no registrado", e));

  if (t.apD && currentUser) {
    updateDoc(doc(db, COL.clientes, currentUser.uid), { cuponUsado: true, cuponActivo: false, cuponUsadoEn: serverTimestamp() })
      .then(() => { window._coupon.used = true; window._coupon.active = false; couponSel = false; renderCart(); updateExitState(); })
      .catch(() => {});
  }
};

/* ═══════════════════════════════════════════════════════════════
   RESEÑAS REALES (ap_resenas, las captura el admin)
═══════════════════════════════════════════════════════════════ */
let revPool = [], revTimer = null;
const starsH = n => `<span class="t-stars">${"★".repeat(n)}${n < 5 ? `<span style="color:#1e1e1e">${"★".repeat(5 - n)}</span>` : ""}</span>`;
const fmtDate = ts => { const d = ts?.toDate ? ts.toDate() : ts ? new Date(ts) : null; return d && !isNaN(d) ? d.toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" }) : ""; };
const buildRev = r => `${starsH(Math.max(1, Math.min(5, Number(r.estrellas) || 5)))}<p class="t-txt">"${esc(r.texto)}"</p>
  <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:4px;margin-top:12px"><span class="t-name">— ${esc(r.nombre)}</span><span style="font-size:8px;color:#444;letter-spacing:1px">${fmtDate(r.fecha || r.creadoEn)}</span></div>
  ${r.verificada ? '<div class="t-verified"><i class="fa-solid fa-circle-check"></i> Compra verificada</div>' : ""}`;
function renderReviews() {
  clearTimeout(revTimer);
  const sec = $("#testimonials"), gridEl = $("#t-grid");
  if (!revPool.length) { sec.classList.add("empty"); return; }
  sec.classList.remove("empty");
  const show = revPool.slice(0, 3);
  gridEl.innerHTML = show.map(r => `<div class="t-card">${buildRev(r)}</div>`).join("");
  if (revPool.length <= 3) return;
  let next = 3;
  const cards = $$(".t-card", gridEl);
  const rotate = () => {
    const card = cards[next % cards.length], r = revPool[next % revPool.length]; next++;
    card.style.cssText = "opacity:0;transform:translateY(7px);transition:opacity .5s ease,transform .5s ease";
    setTimeout(() => { card.innerHTML = buildRev(r); card.style.cssText = "opacity:1;transform:translateY(0);transition:opacity .6s ease,transform .6s ease"; revTimer = setTimeout(rotate, 6500); }, 480);
  };
  revTimer = setTimeout(rotate, 6500);
}
onSnapshot(query(collection(db, COL.resenas), orderBy("creadoEn", "desc")), snap => {
  revPool = snap.docs.map(d => d.data()).filter(r => r.visible !== false && r.texto);
  renderReviews();
}, () => {});

/* ═══════════════════════════════════════════════════════════════
   VISITANTES EN LÍNEA (conteo real con latido cada 60 s)
═══════════════════════════════════════════════════════════════ */
(function presence() {
  let sid; try { sid = sessionStorage.getItem("apSid"); if (!sid) { sid = Math.random().toString(36).slice(2) + Date.now().toString(36); sessionStorage.setItem("apSid", sid); } } catch { sid = Math.random().toString(36).slice(2); }
  const ref = doc(db, COL.presencia, sid), pill = $("#live-pill"), el = $("#dcount");
  const beat = () => setDoc(ref, { ts: serverTimestamp() }).catch(() => {});
  const count = async () => {
    try {
      const q = query(collection(db, COL.presencia), where("ts", ">", Timestamp.fromMillis(Date.now() - 120000)));
      const n = (await getCountFromServer(q)).data().count;
      if (n >= 2) { el.style.opacity = ".1"; setTimeout(() => { el.textContent = n; el.style.opacity = "1"; }, 300); pill.classList.add("on"); }
      else pill.classList.remove("on");
    } catch { pill.classList.remove("on"); }
  };
  const tick = () => { if (!document.hidden) { beat(); setTimeout(count, 1500); } };
  tick(); setInterval(tick, 60000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) tick(); });
  window.addEventListener("pagehide", () => { deleteDoc(ref).catch(() => {}); });
})();

/* ═══════════════════════════════════════════════════════════════
   UI GENERAL: partículas, nav, menú, popup de salida
═══════════════════════════════════════════════════════════════ */
// Partículas — solo escritorio con mouse
(function () {
  const canvas = $("#particles-canvas");
  const isTouch = window.innerWidth <= 768 || (window.matchMedia && window.matchMedia("(hover:none)").matches);
  if (!canvas || isTouch || window.matchMedia("(prefers-reduced-motion: reduce)").matches) { if (canvas) canvas.style.display = "none"; return; }
  const ctx = canvas.getContext("2d", { alpha: true });
  let W = 0, H = 0;
  const resize = () => { W = canvas.width = canvas.offsetWidth; H = canvas.height = canvas.offsetHeight; };
  resize();
  if ("ResizeObserver" in window) new ResizeObserver(resize).observe(canvas.parentElement); else window.addEventListener("resize", resize);
  const pts = Array.from({ length: 45 }, () => ({ x: Math.random() * (W || 1200), y: Math.random() * (H || 700), r: .25 + Math.random() * 1.1, vx: (Math.random() - .5) * .12, vy: (Math.random() - .5) * .1, a: .07 + Math.random() * .44, ph: Math.random() * Math.PI * 2 }));
  let raf;
  function draw() {
    ctx.clearRect(0, 0, W, H);
    const c = window._tRGB || [212, 175, 55];
    for (const p of pts) {
      p.x += p.vx; p.y += p.vy; p.ph += .009;
      if (p.x < 0) p.x = W; else if (p.x > W) p.x = 0;
      if (p.y < 0) p.y = H; else if (p.y > H) p.y = 0;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.283);
      ctx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},${p.a * (.42 + .58 * Math.sin(p.ph))})`; ctx.fill();
    }
    raf = requestAnimationFrame(draw);
  }
  draw();
  document.addEventListener("visibilitychange", () => { if (document.hidden) cancelAnimationFrame(raf); else raf = requestAnimationFrame(draw); });
})();

// Nav al hacer scroll
let navTick = false;
const SECTIONS = ["hero", "arquetipos", "como-comprar", "catalogo", "contacto"];
window.addEventListener("scroll", () => {
  if (navTick) return; navTick = true;
  requestAnimationFrame(() => {
    const y = window.scrollY;
    $("#mainNav").classList.toggle("scrolled", y > 50);
    let cur = "";
    SECTIONS.forEach(id => { const el = document.getElementById(id); if (el && y >= el.offsetTop - 160) cur = id; });
    $$(".nav-links a").forEach(a => { const h = a.getAttribute("href"); a.classList.toggle("active", (h === "index.html" && cur === "hero") || h === "#" + cur); });
    navTick = false;
  });
}, { passive: true });

// Menú hamburguesa
(function () {
  const btn = $("#hamburger"), links = $("#navLinks");
  btn.addEventListener("click", () => { btn.classList.toggle("open"); links.classList.toggle("open"); });
  $$("a", links).forEach(a => a.addEventListener("click", () => { btn.classList.remove("open"); links.classList.remove("open"); }));
})();

// Scroll suave (Safari antiguo no lo hace con CSS)
$$('a[href^="#"]').forEach(a => a.addEventListener("click", function (e) {
  const h = this.getAttribute("href"); if (h.length < 2) return;
  const t = document.querySelector(h); if (t) { e.preventDefault(); t.scrollIntoView({ behavior: "smooth" }); }
}));
$("#scrollCue").addEventListener("click", () => $("#arquetipos").scrollIntoView({ behavior: "smooth" }));

// Popup de salida
(function () {
  const popup = $("#exitPopup");
  let shown = false; const KEY = "ap_exit_v1";
  let last = null; try { last = localStorage.getItem(KEY); } catch {}
  const can = !last || (Date.now() - parseInt(last, 10)) > 86400000;
  const show = () => {
    if (shown || !can || $(".modal.open") || $("#cartSide").classList.contains("open")) return;
    shown = true; try { localStorage.setItem(KEY, Date.now()); } catch {}
    updateExitState(); popup.classList.add("show");
  };
  const close = () => popup.classList.remove("show");
  ["#exitClose", "#exitSkip", "#exitActiveClose", "#exitUsedClose", "#exitActiveCta", "#exitUsedCta"].forEach(id => $(id).addEventListener("click", close));
  popup.addEventListener("click", e => { if (e.target === popup) close(); });

  const ptR = $("#ptReg"), ptL = $("#ptLog"), pfR = $("#pfReg"), pfL = $("#pfLog");
  ptR.onclick = () => { ptR.classList.add("on"); ptL.classList.remove("on"); pfR.style.display = "flex"; pfL.style.display = "none"; };
  ptL.onclick = () => { ptL.classList.add("on"); ptR.classList.remove("on"); pfL.style.display = "flex"; pfR.style.display = "none"; };

  pfR.addEventListener("submit", async e => {
    e.preventDefault();
    const btn = $("#prBtn"); btn.disabled = true; btn.textContent = "Creando cuenta...";
    try { await doRegister($("#prName").value.trim(), $("#prEmail").value.trim(), $("#prPass").value); pfR.reset(); updateExitState(); }
    catch (err) { window.notify(authErr(err)); }
    btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-gift"></i> Crear cuenta y obtener 15%';
  });
  pfL.addEventListener("submit", async e => {
    e.preventDefault();
    const btn = $("#plBtn"); btn.disabled = true; btn.textContent = "Iniciando...";
    try { await signInWithEmailAndPassword(auth, $("#plEmail").value.trim(), $("#plPass").value); window.notify("¡Bienvenido de vuelta! 💎"); pfL.reset(); close(); }
    catch { window.notify("Correo o contraseña incorrectos."); }
    btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-arrow-right-to-bracket"></i> Iniciar sesión';
  });

  document.addEventListener("mouseleave", e => { if (e.clientY < 18) show(); });
  let lastY = window.scrollY, sTick = false;
  window.addEventListener("scroll", () => {
    if (sTick) return; sTick = true;
    requestAnimationFrame(() => { const d = lastY - window.scrollY; if (d > 70 && window.scrollY < 280) show(); lastY = window.scrollY; sTick = false; });
  }, { passive: true });
  setTimeout(show, 44000);
})();
