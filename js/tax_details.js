// Taxonomy lookup for a list of taxa taken from a CSV column.
//
// Self-contained: this file does not depend on any other script in this
// repository. Everything hangs off the global `TD` namespace.

window.TD = window.TD || {};

(function (TD) {
    const API = 'https://api.inaturalist.org/v1';
    // The multi-id taxa endpoint pages at 30 results, so ids are asked for in
    // groups of 30 and names one at a time.
    const ID_BATCH = 30;
    const REQUEST_GAP_MS = 350;

    const cache = new Map();        // taxon id -> card as delivered by the API
    const nameLookups = new Map();  // lowercased query -> taxon id or null

    TD.COLUMNS = [
        { key: 'input', label: 'input' },
        { key: 'kingdom', label: 'kingdom' },
        { key: 'class', label: 'class' },
        { key: 'order', label: 'order' },
        { key: 'superfamily', label: 'superfamily' },
        { key: 'family', label: 'family' },
        { key: 'subfamily', label: 'subfamily' },
        { key: 'species', label: 'species' },
        { key: 'english_name', label: 'english name' },
        { key: 'russian_name', label: 'russian name' },
        { key: 'id', label: 'id' },
        { key: 'observations', label: 'observations' },
        { key: 'rank', label: 'rank' },
        { key: 'note', label: 'note' },
    ];

    const LINEAGE_RANKS = [
        'kingdom', 'phylum', 'class', 'order',
        'superfamily', 'family', 'subfamily', 'genus', 'species',
    ];

    function sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    // GET + JSON with retry/backoff. Transient failures (network error, 429,
    // 5xx) are retried so a single hiccup doesn't throw away a long run;
    // 429 honours the Retry-After header. Other 4xx fail fast.
    async function fetchJson(url, retries) {
        if (typeof retries !== 'number') retries = 4;
        let attempt = 0;
        while (true) {
            let response;
            try {
                response = await fetch(url);
            } catch (networkErr) {
                if (attempt >= retries) throw networkErr;
                await sleep(Math.min(15000, 500 * Math.pow(2, attempt)));
                attempt++;
                continue;
            }

            if (response.ok) return response.json();

            const retryable = response.status === 429 || response.status >= 500;
            if (!retryable || attempt >= retries) {
                throw new Error('HTTP ' + response.status + ' for ' + url);
            }

            let waitMs = Math.min(15000, 500 * Math.pow(2, attempt));
            const retryAfter = parseFloat(response.headers.get('retry-after'));
            if (!isNaN(retryAfter)) waitMs = Math.max(waitMs, retryAfter * 1000);
            await sleep(waitMs);
            attempt++;
        }
    }

    TD.isTaxonId = function (value) {
        return /^\d+$/.test(String(value || '').trim());
    };

    // ---------------------------------------------------------------- CSV ---

    // Pick the delimiter used by the header line: comma, semicolon or tab.
    TD.detectDelimiter = function (text) {
        const line = (text || '').split(/\r?\n/)[0] || '';
        const counts = [',', ';', '\t'].map((d) => ({
            d: d, n: line.split(d).length - 1,
        }));
        counts.sort((a, b) => b.n - a.n);
        return counts[0].n > 0 ? counts[0].d : ',';
    };

    TD.parseCsv = function (text, delimiter) {
        const rows = [];
        let row = [];
        let field = '';
        let quoted = false;
        let i = 0;

        // Strip a UTF-8 BOM so the first header name stays clean.
        if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);

        function endField() { row.push(field); field = ''; }
        function endRow() { endField(); rows.push(row); row = []; }

        while (i < text.length) {
            const c = text[i];
            if (quoted) {
                if (c === '"') {
                    if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
                    quoted = false; i++; continue;
                }
                field += c; i++; continue;
            }
            if (c === '"' && field === '') { quoted = true; i++; continue; }
            if (c === delimiter) { endField(); i++; continue; }
            if (c === '\r') { endRow(); i += text[i + 1] === '\n' ? 2 : 1; continue; }
            if (c === '\n') { endRow(); i++; continue; }
            field += c; i++;
        }
        if (field !== '' || row.length) endRow();

        return rows.filter((r) => r.some((v) => String(v).trim() !== ''));
    };

    TD.toCsv = function (rows) {
        return rows.map((row) => row.map((value) => {
            const text = value === null || typeof value === 'undefined' ? '' : String(value);
            return /["\n\r,;\t]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
        }).join(',')).join('\r\n') + '\r\n';
    };

    // ---------------------------------------------------------- API access ---

    function remember(card) {
        if (card && card.id) cache.set(Number(card.id), card);
    }

    async function fetchByIds(ids) {
        if (!ids.length) return;
        const data = await fetchJson(`${API}/taxa/${ids.join(',')}?locale=ru`);
        (data.results || []).forEach(remember);
    }

    // Resolve a name to a taxon id. Exact (case-insensitive) matches win;
    // otherwise the most observed candidate is taken as a fuzzy match.
    async function fetchByName(name) {
        const params = new URLSearchParams({
            q: name,
            is_active: 'true',
            order: 'desc',
            order_by: 'observations_count',
            per_page: '10',
            locale: 'ru',
        });
        const data = await fetchJson(`${API}/taxa?${params.toString().replace(/\+/g, '%20')}`);
        const results = data.results || [];
        results.forEach(remember);

        const wanted = name.toLowerCase();
        const exact = results.filter((t) => (t.name || '').toLowerCase() === wanted);
        if (exact.length) {
            // Several ranks can share a name; the finest one is the useful one.
            exact.sort((a, b) => (a.rank_level || 999) - (b.rank_level || 999));
            return { id: Number(exact[0].id), fuzzy: false };
        }
        if (results.length) return { id: Number(results[0].id), fuzzy: true };
        return { id: null, fuzzy: false };
    }

    // ------------------------------------------------------------ lineage ---

    function lineageOf(card) {
        const lineage = {};
        LINEAGE_RANKS.forEach((r) => { lineage[r] = ''; });

        const consider = (c) => {
            if (c && c.rank && Object.prototype.hasOwnProperty.call(lineage, c.rank)) {
                lineage[c.rank] = c.name || '';
            }
        };
        (card.ancestor_ids || []).forEach((id) => consider(cache.get(Number(id))));
        consider(card);
        return lineage;
    }

    // iNaturalist answers `preferred_common_name` in the requested locale but
    // falls back to English when the taxon has no Russian name, so only names
    // that actually carry Cyrillic are accepted as Russian.
    function commonNames(card) {
        const preferred = card.preferred_common_name || '';
        const english = card.english_common_name ||
            (/[\u0400-\u04FF]/.test(preferred) ? '' : preferred);
        const russian = /[\u0400-\u04FF]/.test(preferred) ? preferred : '';
        return { english, russian };
    }

    TD.rowForTaxon = function (input, id, note) {
        const row = { input: input, note: note || '' };
        TD.COLUMNS.forEach((c) => { if (!(c.key in row)) row[c.key] = ''; });

        const card = id === null ? null : cache.get(Number(id));
        if (!card) {
            row.note = row.note || 'not found';
            return row;
        }

        const lineage = lineageOf(card);
        const names = commonNames(card);

        row.kingdom = lineage.kingdom;
        row.class = lineage.class;
        row.order = lineage.order;
        row.superfamily = lineage.superfamily;
        row.family = lineage.family;
        row.subfamily = lineage.subfamily;
        row.species = lineage.species;
        row.english_name = names.english;
        row.russian_name = names.russian;
        row.id = card.id;
        row.observations = typeof card.observations_count === 'number' ? card.observations_count : '';
        row.rank = card.rank || '';
        return row;
    };

    // ---------------------------------------------------------------- run ---

    // Look every distinct input value up, then fill in the ancestors they need.
    // Returns a Map of input value -> { id, fuzzy } .
    TD.resolve = async function (values, statusFn) {
        const unique = Array.from(new Set(values.map((v) => String(v).trim()).filter(Boolean)));
        const resolved = new Map();

        const ids = [];
        const names = [];
        unique.forEach((v) => (TD.isTaxonId(v) ? ids : names).push(v));

        let done = 0;
        const report = () => {
            if (statusFn) statusFn('Looking taxa up\u2026 ' + done + ' of ' + unique.length);
        };
        report();

        for (let i = 0; i < ids.length; i += ID_BATCH) {
            const batch = ids.slice(i, i + ID_BATCH);
            try {
                await fetchByIds(batch.map(Number));
            } catch (e) {
                // Unknown ids are simply absent from the answer, so a failure
                // here is the request itself; the batch stays unresolved.
                console.error('Id lookup failed', e);
            }
            batch.forEach((v) => {
                resolved.set(v, { id: cache.has(Number(v)) ? Number(v) : null, fuzzy: false });
            });
            done += batch.length;
            report();
            if (i + ID_BATCH < ids.length) await sleep(REQUEST_GAP_MS);
        }

        for (let i = 0; i < names.length; i++) {
            const name = names[i];
            const key = name.toLowerCase();
            if (!nameLookups.has(key)) {
                try {
                    nameLookups.set(key, await fetchByName(name));
                } catch (e) {
                    console.error('Lookup failed for ' + name, e);
                    nameLookups.set(key, { id: null, fuzzy: false });
                }
                if (i + 1 < names.length) await sleep(REQUEST_GAP_MS);
            }
            resolved.set(name, nameLookups.get(key));
            done++;
            report();
        }

        await fetchMissingAncestors(statusFn);
        return resolved;
    };

    // Ancestor id lists are full paths to the root, so a single pass over the
    // taxa we already hold resolves every rank we can report on.
    async function fetchMissingAncestors(statusFn) {
        const missing = new Set();
        cache.forEach((card) => {
            (card.ancestor_ids || []).forEach((a) => {
                if (!cache.has(Number(a))) missing.add(Number(a));
            });
        });

        const ids = Array.from(missing);
        for (let i = 0; i < ids.length; i += ID_BATCH) {
            if (statusFn) statusFn('Fetching taxonomy\u2026 ' + i + ' of ' + ids.length);
            try {
                await fetchByIds(ids.slice(i, i + ID_BATCH));
            } catch (e) {
                console.error('Ancestor fetch failed', e);
            }
            if (i + ID_BATCH < ids.length) await sleep(REQUEST_GAP_MS);
        }
    }
})(window.TD);
