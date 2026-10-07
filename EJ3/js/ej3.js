$(document).ready(function () {

    // ===== Configuración TheSportsDB (claves de prueba gratuitas) =====
    // Si una clave está limitada o falla, se prueba automáticamente con la siguiente.
    const CLAVES = ["3", "1"];
    const BASE = k => "https://www.thesportsdb.com/api/v1/json/" + k + "/";
    const LIGA = "American Major League Soccer";

    let equipos = [];            // todos los equipos de la MLS
    let jugadores = [];          // lista actual de jugadores (sin filtrar)
    let cache = {};              // plantillas ya descargadas por idTeam
    const modal = new bootstrap.Modal('#modalDetalle');

    // ---------- Utilidades ----------
    function api(endpoint) {
        const d = $.Deferred();
        (async function () {
            for (const k of CLAVES) {
                try { d.resolve(await $.getJSON(BASE(k) + endpoint)); return; }
                catch (e) { console.warn("Falló la clave " + k + " en " + endpoint, e.status || e); }
            }
            d.reject();
        })();
        return d.promise();
    }
    function esc(t) { return $('<div>').text(t == null ? '' : t).html(); }
    function img(url, size) { return url ? url + (size || '') : ''; }
    function cargando(on) { $('#spinnerCarga').toggleClass('d-none', !on); }
    function estado(msg) { $('#estado').text(msg); }
    function errorApi() {
        cargando(false);
        estado('No se pudo consultar la API. Revisa tu conexión o espera un minuto (la clave gratuita tiene límite de peticiones).');
    }
    

    // ---------- Navegación entre vistas ----------
    $('#tabs button').on('click', function () {
        $('#tabs button').removeClass('active'); $(this).addClass('active');
        const v = $(this).data('vista');
        $('#vistaEquipos').toggleClass('d-none', v !== 'equipos');
        $('#vistaJugadores').toggleClass('d-none', v !== 'jugadores');
    });

    // ---------- 1. EQUIPOS ----------
    // La clave gratuita solo devuelve 10 equipos por liga, así que completamos
    // el resto buscando por nombre (searchteams.php no tiene ese límite).
    const CLUBES_MLS = ["Atlanta United", "Austin FC", "CF Montréal", "Charlotte FC", "Chicago Fire", "Colorado Rapids",
        "Columbus Crew", "D.C. United", "FC Cincinnati", "FC Dallas", "Houston Dynamo", "Inter Miami", "LA Galaxy",
        "Los Angeles FC", "Minnesota United", "Nashville SC", "New England Revolution", "New York City FC",
        "New York Red Bulls", "Orlando City", "Philadelphia Union", "Portland Timbers", "Real Salt Lake",
        "San Diego FC", "San Jose Earthquakes", "Seattle Sounders", "Sporting Kansas City", "St. Louis City",
        "Toronto FC", "Vancouver Whitecaps"];
    const clave = t => t.toLowerCase().replace(/[^a-z]/g, '');

    function buscarEquipoPorNombre(nombre) {
        const d = $.Deferred();
        api('searchteams.php?t=' + encodeURIComponent(nombre)).done(function (r) {
            const lista = r.teams || [];
            d.resolve(lista.find(t => /Major League Soccer/i.test(t.strLeague || '')) || null);
        }).fail(() => d.resolve(null));
        return d.promise();
    }

    function ordenarYPintar() {
        equipos.sort((a, b) => a.strTeam.localeCompare(b.strTeam));
        pintarEquipos(equipos);
    }

    const spinnerEquipos = '<div class="col-12 text-center my-5"><div class="spinner-border text-danger"></div>' +
        '<p class="estado mt-2" id="msgEquipos">Cargando equipos…</p></div>';

    async function cargarEquipos() {
        $('#gridEquipos').html(spinnerEquipos);
        try {
            const r = await api('search_all_teams.php?l=' + encodeURIComponent(LIGA));
            equipos = r.teams || [];
        } catch (e) { equipos = []; }
        console.log("Equipos devueltos por la liga:", equipos.length);
        if (equipos.length) ordenarYPintar();

        // Buscamos los clubes que la API gratuita no devolvió
        const tengo = equipos.map(e => clave(e.strTeam));
        const faltan = CLUBES_MLS.filter(n => !tengo.some(t => t.includes(clave(n)) || clave(n).includes(t)));
        for (let i = 0; i < faltan.length; i++) {
            $('#msgEquipos').text('Cargando equipos… ' + (i + 1) + ' de ' + faltan.length);
            const t = await buscarEquipoPorNombre(faltan[i]);
            if (t && !equipos.some(e => e.idTeam === t.idTeam)) { equipos.push(t); ordenarYPintar(); }
            await new Promise(r => setTimeout(r, 400));
        }
        if (!equipos.length) {
            $('#gridEquipos').html('<div class="col-12"><p class="estado">No se pudieron cargar los equipos. ' +
                'Puede ser el límite de peticiones de la API gratuita: espera un minuto y reintenta.</p>' +
                '<button id="btnReintentar" class="btn btn-mls">Reintentar</button></div>');
        }
    }
    $('#gridEquipos').on('click', '#btnReintentar', cargarEquipos);

    function pintarEquipos(lista) {
        if (!lista.length) { $('#gridEquipos').html('<p class="estado col-12">Ningún equipo coincide con tu búsqueda.</p>'); return; }
        $('#gridEquipos').html(lista.map(e =>
            '<div class="col"><div class="team-card" tabindex="0" data-id="' + e.idTeam + '">' +
            '<img src="' + img(e.strBadge || e.strTeamBadge, '/small') + '" alt="Escudo de ' + esc(e.strTeam) + '">' +
            '<h3>' + esc(e.strTeam) + '</h3><small>' + esc(e.strStadium || '') + '</small></div></div>').join(''));
    }

    $('#filtroEquipo').on('input', function () {
        const q = $(this).val().toLowerCase();
        pintarEquipos(equipos.filter(e => e.strTeam.toLowerCase().includes(q)));
    });

    $('#gridEquipos').on('click keypress', '.team-card', function (ev) {
        if (ev.type === 'keypress' && ev.key !== 'Enter') return;
        abrirEquipo($(this).data('id'));
    });

    function abrirEquipo(id) {
        const e = equipos.find(x => x.idTeam == id);
        $('#modalTitulo').text(e.strTeam);
        $('#modalCuerpo').html(
            '<div class="row g-4"><div class="col-md-4 text-center">' +
            '<img class="detalle-img" src="' + img(e.strBadge || e.strTeamBadge) + '" alt="">' +
            '</div><div class="col-md-8">' +
            '<div class="row"><div class="col-6"><p class="dato">Estadio</p><p>' + esc(e.strStadium || '—') + '</p></div>' +
            '<div class="col-6"><p class="dato">Ciudad</p><p>' + esc(e.strLocation || '—') + '</p></div>' +
            '<div class="col-6"><p class="dato">Fundado</p><p>' + esc(e.intFormedYear || '—') + '</p></div>' +
            '<div class="col-6"><p class="dato">Capacidad</p><p>' + esc(e.intStadiumCapacity || '—') + '</p></div></div>' +
            '<div class="descr">' + esc(e.strDescriptionEN || '') + '</div></div></div>' +
            '<h3 class="mt-4">Plantilla</h3><div id="plantillaModal" class="row row-cols-1 row-cols-md-2 g-1"><div class="col"><div class="spinner-border spinner-border-sm text-danger"></div></div></div>');
        modal.show();
        obtenerPlantilla(id).done(function (lista) {
            $('#plantillaModal').html(lista.length ? lista.map(j =>
                '<div class="col"><div class="mini" data-jid="' + j.idPlayer + '">' +
                '<img src="' + img(j.strCutout || j.strThumb, '/tiny') + '" alt="">' +
                '<div><strong>' + esc(j.strPlayer) + '</strong><br><small class="text-secondary">' +
                esc(j.strPosition || '') + ' · ' + esc(j.strNationality || '') + '</small></div></div></div>').join('')
                : '<div class="col text-secondary">La API gratuita no devolvió jugadores para este equipo.</div>');
        });
    }

    $('#modalCuerpo').on('click', '.mini', function () {
        const j = jugadoresConocidos().find(x => x.idPlayer == $(this).data('jid'));
        if (j) detalleJugador(j);
    });

    // ---------- 2. JUGADORES (balldontlie) ----------
    // Pega aquí tu API key de balldontlie (app.balldontlie.io). 
    const BDL_KEY = "TU-API-KEY";
    const BDL = "https://api.balldontlie.io/mls/v1/";
    const esperar = ms => new Promise(r => setTimeout(r, ms));
    const hayKey = () => BDL_KEY.indexOf('PEGA') !== 0;
    const norm = n => clave(n).replace('losangelesfc', 'lafc');
    let equiposBDL = [];

    // La API gratuita permite 5 peticiones por minuto: guardamos resultados 24 h en el navegador
    function guardar(k, v) { try { localStorage.setItem('mls_' + k, JSON.stringify({ t: Date.now(), v: v })); } catch (e) {} }
    function leer(k) {
        try { const o = JSON.parse(localStorage.getItem('mls_' + k)); if (o && Date.now() - o.t < 864e5) return o.v; } catch (e) {}
        return null;
    }

    async function pedirBDL(ruta, intento) {
        intento = intento || 0;
        try { return await $.ajax({ url: BDL + ruta, headers: { Authorization: BDL_KEY } }); }
        catch (e) {
            if (e.status === 429 && intento < 4) {
                estado('Límite de la API (5 por minuto). Esperando 15 s…');
                await esperar(15000);
                return pedirBDL(ruta, intento + 1);
            }
            throw e;
        }
    }

    const nombreEquipo = id => { const t = equiposBDL.find(e => e.id == id); return t ? t.name : ''; };
    function base(p) {
        return { _fuente: 'bdl', strPlayer: p.display_name || ((p.first_name || '') + ' ' + (p.last_name || '')).trim(),
            strNationality: p.citizenship || '', dateBorn: p.date_of_birth || '', strHeight: p.height || '',
            strWeight: p.weight || '', strSide: p.preferred_foot || '', _age: p.age || '' };
    }
    const deRoster = x => Object.assign(base(x.player || {}), { idPlayer: 'b' + (x.player || {}).id,
        strPosition: x.position || '', strNumber: x.jersey_number || '', strTeam: nombreEquipo(x.team_id) });
    const dePlayer = p => Object.assign(base(p), { idPlayer: 'b' + p.id, strPosition: '',
        strTeam: nombreEquipo((p.team_ids || [])[0]) });

    async function rosterBDL(teamId) {
        const c = leer('roster_' + teamId); if (c) return c;
        const r = await pedirBDL('rosters?team_id=' + teamId);
        const lista = (r.data || []).filter(x => x.is_active !== false).map(deRoster);
        guardar('roster_' + teamId, lista);
        return lista;
    }

    async function cargarEquiposBDL() {
        if (!hayKey()) { estado('Falta tu API key de balldontlie: pégala en BDL_KEY dentro de ej3.js.'); return; }
        try {
            equiposBDL = leer('teams') || (await pedirBDL('teams')).data || [];
            guardar('teams', equiposBDL);
        } catch (e) { estado('No se pudo conectar con balldontlie (' + (e.status || 'sin conexión') + '). Revisa tu API key.'); return; }
        equiposBDL.sort((a, b) => a.name.localeCompare(b.name));
        $('#selectEquipo').html('<option value="">Elegir equipo…</option>' +
            equiposBDL.map(t => '<option value="' + t.id + '">' + esc(t.name) + '</option>').join(''));
    }

    // Plantilla para la ventana de un equipo (pestaña Equipos)
    function obtenerPlantilla(id) {
        const d = $.Deferred();
        if (cache[id]) { d.resolve(cache[id]); return d.promise(); }
        const eq = equipos.find(e => e.idTeam == id);
        const t = eq && equiposBDL.find(b => norm(b.name).includes(norm(eq.strTeam)) || norm(eq.strTeam).includes(norm(b.name)));
        if (!t) { // respaldo: TheSportsDB (máximo ~10 jugadores)
            api('lookup_all_players.php?id=' + id).done(r => d.resolve(cache[id] = r.player || [])).fail(() => d.resolve([]));
        } else rosterBDL(t.id).then(l => d.resolve(cache[id] = l)).catch(() => d.resolve([]));
        return d.promise();
    }
    const jugadoresConocidos = () => [].concat(jugadores, ...Object.values(cache));

    // Búsqueda que sigue los filtros: nombre y equipo se piden a la API; país y posición filtran lo cargado
    async function buscar() {
        if (!hayKey()) { estado('Falta tu API key de balldontlie: pégala en BDL_KEY dentro de ej3.js.'); return; }
        const nombre = $('#inputBuscador').val().trim(), equipo = $('#selectEquipo').val();
        if (!nombre && !equipo) { estado('Escribe un nombre o elige un equipo. Para ver toda la liga usa "Toda la liga".'); return; }
        cargando(true); $('#contenedorTarjetas').html(''); estado(''); jugadores = [];
        try {
            if (equipo) {
                jugadores = await rosterBDL(equipo);
                if (nombre) jugadores = jugadores.filter(j => clave(j.strPlayer).includes(clave(nombre)));
            } else {
                const r = await pedirBDL('players?per_page=100&search=' + encodeURIComponent(nombre));
                jugadores = (r.data || []).map(dePlayer);
            }
        } catch (e) { cargando(false); estado('Error al consultar balldontlie (' + (e.status || 'sin conexión') + ').'); return; }
        cargando(false); actualizarFiltros(); pintarJugadores();
    }
    $('#btnBuscar').on('click', buscar);
    $('#inputBuscador').on('keypress', e => { if (e.key === 'Enter') buscar(); });
    $('#selectEquipo').on('change', buscar);

    // Toda la liga: plantillas actuales de todos los equipos (la primera vez tarda por el límite de la API)
    $('#btnTodos').on('click', async function () {
        if (!hayKey() || !equiposBDL.length) { estado('Falta tu API key de balldontlie o no se pudo conectar.'); return; }
        const btn = $(this).prop('disabled', true);
        $('#selectEquipo').val(''); jugadores = []; cargando(true);
        try {
            for (let i = 0; i < equiposBDL.length; i++) {
                const t = equiposBDL[i], enCache = !!leer('roster_' + t.id);
                jugadores = jugadores.concat(await rosterBDL(t.id));
                actualizarFiltros(); pintarJugadores();
                if (i < equiposBDL.length - 1) {
                    estado(jugadores.length + ' jugadores · plantilla ' + (i + 1) + ' de ' + equiposBDL.length + ' (' + t.name + ')');
                    if (!enCache) await esperar(12500);
                }
            }
            pintarJugadores();
        } catch (e) { estado('Error al consultar balldontlie (' + (e.status || 'sin conexión') + ').'); }
        cargando(false); btn.prop('disabled', false);
    });

    function actualizarFiltros() {
        const llenar = (sel, campo, vacio) => {
            const previo = $(sel).val();
            const vals = [...new Set(jugadores.map(j => j[campo]).filter(Boolean))].sort();
            $(sel).html('<option value="">' + vacio + '</option>' + vals.map(v => '<option>' + esc(v) + '</option>').join(''));
            if (vals.includes(previo)) $(sel).val(previo);
        };
        llenar('#selectPais', 'strNationality', 'Todas');
        llenar('#selectPos', 'strPosition', 'Todas');
    }
    $('#selectPais, #selectPos').on('change', pintarJugadores);

    function pintarJugadores() {
        const pais = $('#selectPais').val(), pos = $('#selectPos').val(), MAX = 150;
        const lista = jugadores.filter(j => (!pais || j.strNationality === pais) && (!pos || j.strPosition === pos));
        estado(lista.length ? lista.length + ' jugador' + (lista.length > 1 ? 'es' : '') + ' encontrado' + (lista.length > 1 ? 's' : '') +
                              (lista.length > MAX ? ' (mostrando los primeros ' + MAX + ', usa los filtros para acotar)' : '')
                            : 'No hay jugadores con esos filtros.');
        $('#contenedorTarjetas').html(lista.slice(0, MAX).map(j => {
            const foto = j.strCutout || j.strThumb;
            return '<div class="col"><div class="player-card" tabindex="0" data-jid="' + j.idPlayer + '">' +
                (foto ? '<div class="foto"><img loading="lazy" src="' + img(foto, '/medium') + '" alt="' + esc(j.strPlayer) + '"></div>'
                      : '<div class="foto sin">' + esc((j.strPlayer || '?').charAt(0)) + '</div>') +
                '<div class="info"><h5>' + esc(j.strPlayer) + '</h5>' +
                (j.strPosition ? '<span class="chip pos">' + esc(j.strPosition) + '</span>' : '') +
                '<span class="chip">' + esc(j.strNationality || 'Sin nacionalidad') + '</span>' +
                (j.strTeam ? '<span class="chip">' + esc(j.strTeam) + '</span>' : '') + '</div></div></div>';
        }).join(''));
        // Con listas cortas (equipo o búsqueda) pedimos las fotos poco a poco
        encolarFotos(lista.length <= 60 ? lista : []);
    }

    // ---------- Fotos desde TheSportsDB (balldontlie no trae fotos) ----------
    const sinAcentos = t => (t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    let colaFotos = [], corriendoFotos = false;

    async function buscarFoto(j) {
        const k = 'foto_' + j.idPlayer, c = leer(k);
        if (c) return c.cutout || c.thumb || c.desc ? c : null;   // c = {} significa "sin foto" (ya consultado)
        let res = null;
        try {
            const r = await api('searchplayers.php?p=' + encodeURIComponent(sinAcentos(j.strPlayer)));
            const nombre = clave(sinAcentos(j.strPlayer)), apellido = clave(sinAcentos(j.strPlayer).split(' ').pop());
            const lista = (r.player || []).filter(m => !m.strSport || m.strSport === 'Soccer');
            const m = lista.find(x => clave(sinAcentos(x.strPlayer)) === nombre) ||
                      lista.find(x => clave(sinAcentos(x.strPlayer)).endsWith(apellido) && clave(x.strNationality || '') === clave(j.strNationality || ''));
            if (m && (m.strCutout || m.strThumb || m.strDescriptionEN))
                res = { cutout: m.strCutout || '', thumb: m.strThumb || '', desc: m.strDescriptionEN || '' };
        } catch (e) { return null; }
        guardar(k, res || {});
        j._pidioApi = true;
        return res;
    }

    async function procesarFotos() {
        corriendoFotos = true;
        while (colaFotos.length) {
            const j = colaFotos.shift();
            const f = await buscarFoto(j);
            if (f && (f.cutout || f.thumb)) {
                j.strCutout = f.cutout; j.strThumb = f.thumb;
                $('.player-card[data-jid="' + j.idPlayer + '"] .foto').removeClass('sin')
                    .html('<img loading="lazy" src="' + img(f.cutout || f.thumb, '/medium') + '" alt="' + esc(j.strPlayer) + '">');
            }
            if (j._pidioApi) { j._pidioApi = false; await esperar(2200); }   // límite: 30 peticiones por minuto
        }
        corriendoFotos = false;
    }

    function encolarFotos(lista) {
        colaFotos = lista.filter(j => j._fuente === 'bdl' && !j.strCutout && !j.strThumb);
        if (!corriendoFotos) procesarFotos();
    }

    $('#contenedorTarjetas').on('click keypress', '.player-card', function (ev) {
        if (ev.type === 'keypress' && ev.key !== 'Enter') return;
        const j = jugadores.find(x => x.idPlayer == $(this).data('jid'));
        if (j) detalleJugador(j);
    });

    function detalleJugador(j) {
        $('#modalTitulo').text(j.strPlayer);
        const d = (t, v) => '<div class="col-6"><p class="dato">' + t + '</p><p>' + esc(v || '—') + '</p></div>';
        $('#modalCuerpo').html(
            '<div class="row g-4"><div class="col-md-4 text-center"><div id="fotoDetalle">' +
            (j.strCutout || j.strThumb ? '<img class="detalle-img" src="' + img(j.strCutout || j.strThumb) + '" alt="">' : '') +
            '</div></div><div class="col-md-8"><div class="row">' +
            d('Equipo', j.strTeam) + d('Posición', j.strPosition) + d('Nacionalidad', j.strNationality) +
            d('Dorsal', j.strNumber) + d('Edad', j._age) + d('Nacimiento', j.dateBorn) +
            d('Altura', j.strHeight) + d('Peso', j.strWeight) + d('Pie hábil', j.strSide) +
            '</div><div class="descr" id="descJugador"></div></div></div>');
        modal.show();
        if (j._fuente === 'bdl') {
            buscarFoto(j).then(function (f) {
                if (!f) return;
                if (f.cutout || f.thumb) $('#fotoDetalle').html('<img class="detalle-img" src="' + img(f.cutout || f.thumb) + '" alt="">');
                if (f.desc) $('#descJugador').text(f.desc);
            });
        }
    }

    cargarEquipos();
    cargarEquiposBDL();
});