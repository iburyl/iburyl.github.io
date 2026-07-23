// iNaturalist API access + small shared utilities for the date range report.
//
// Self-contained: this file (and its siblings report_taxonomy.js,
// report_render.js, report_main.js) do not depend on any other scripts in this
// repository. Everything hangs off the global `IR` namespace.

window.IR = window.IR || {};

(function (IR) {
    const API = 'https://api.inaturalist.org';

    // Only the fields the report needs. The v2 endpoint honours field selection,
    // which keeps an 80k+ project response to a few tens of MB instead of the
    // gigabytes the v1 default payload would produce.
    const OBS_FIELDS = [
        'id', 'uri', 'observed_on', 'quality_grade',
        'user.login',
        'taxon.id', 'taxon.name', 'taxon.rank', 'taxon.rank_level',
        'taxon.ancestor_ids', 'taxon.preferred_common_name',
        'photos.url',
    ].join(',');

    const TAXA_FIELDS = [
        'id', 'name', 'rank', 'rank_level', 'ancestor_ids', 'preferred_common_name',
    ].join(',');

    IR.sleep = function (ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    };

    IR.formatDate = function (date) {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    };

    // Accepts a full project URL or a bare slug / numeric id.
    IR.parseProjectSlug = function (text) {
        text = (text || '').trim();
        const m = text.match(/projects\/([^\/?#\s]+)/i);
        return m ? m[1] : text;
    };

    // GET + JSON with retry/backoff. Transient failures (network error, 429,
    // 5xx) are retried so a single hiccup doesn't throw away a long multi-page
    // pull; 429 honours the Retry-After header. 4xx (other than 429) fail fast.
    async function fetchJson(url, retries) {
        if (typeof retries !== 'number') retries = 4;
        let attempt = 0;
        while (true) {
            let response;
            try {
                response = await fetch(url);
            } catch (networkErr) {
                if (attempt >= retries) throw networkErr;
                await IR.sleep(Math.min(15000, 500 * Math.pow(2, attempt)));
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
            await IR.sleep(waitMs);
            attempt++;
        }
    }
    IR.fetchJson = fetchJson;

    // Turn one raw v2 observation into the lightweight model used downstream.
    function toObservation(o) {
        if (!o.observed_on || !o.taxon || !o.taxon.id) return null;

        let image_url = '';
        if (o.photos && o.photos.length && o.photos[0].url) image_url = o.photos[0].url;

        return {
            id: o.id,
            observer: o.user ? o.user.login : '',
            taxon_id: Number(o.taxon.id),
            lat_name: o.taxon.name || '',
            common_name: o.taxon.preferred_common_name || '',
            observed_on: o.observed_on,                 // 'YYYY-MM-DD' (string compares chronologically)
            url: (o.uri || '').replace('http://', 'https://'),
            is_research: o.quality_grade === 'research',
            image_url: image_url,
        };
    }

    // Fetch every verifiable observation of a project with observation date <= d2.
    // Uses id_above pagination so it works past the API's 10k page-window limit.
    // Returns { observations, rawTaxa } where rawTaxa are the taxon objects as
    // delivered by the API (used to seed the taxonomy cache for free).
    IR.fetchProjectObservations = async function (projectSlug, d2, statusFn) {
        const observations = [];
        const rawTaxa = [];
        const per_page = 200;
        // Gap between page requests. With ~0.3-0.5s network latency this keeps the
        // rate comfortably under the API's limits over an 80k+ project (~400 pages).
        const PAGE_DELAY_MS = 350;
        let id_above = 0;
        let total = null;
        let fetched = 0;   // raw rows seen (drives progress even when some are skipped)

        while (true) {
            const url = `${API}/v2/observations?project_id=${encodeURIComponent(projectSlug)}` +
                `&d2=${d2}&verifiable=true&order=asc&order_by=id&per_page=${per_page}` +
                `&id_above=${id_above}&fields=${OBS_FIELDS}`;

            const data = await fetchJson(url);
            // With id_above pagination total_results is the count *remaining above*
            // the current id (it shrinks each page), so the grand total is only the
            // value from the first request (id_above === 0).
            if (total === null && typeof data.total_results === 'number') total = data.total_results;
            if (!data.results || !data.results.length) break;

            data.results.forEach((o) => {
                const obs = toObservation(o);
                if (obs) {
                    observations.push(obs);
                    rawTaxa.push(o.taxon);
                }
            });

            fetched += data.results.length;
            id_above = data.results[data.results.length - 1].id;

            if (statusFn) {
                const pct = total ? ' (' + Math.min(100, Math.round(fetched / total * 100)) + '%)' : '';
                statusFn('Fetching observations\u2026 ' + fetched +
                    (total !== null ? ' of ~' + total : '') + pct);
            }

            if (data.results.length < per_page) break;
            await IR.sleep(PAGE_DELAY_MS);
        }

        return { observations, rawTaxa };
    };

    // Fetch a batch of taxa by id (used to resolve ancestor names). Returns
    // normalized cards { id, name, rank, rank_level, ancestor_ids, preferred_common_name }.
    IR.fetchTaxaByIds = async function (ids) {
        if (!ids.length) return [];
        const url = `${API}/v2/taxa/${ids.join(',')}?fields=${TAXA_FIELDS}`;
        const data = await fetchJson(url);
        return (data.results || []).map((t) => ({
            id: Number(t.id),
            name: t.name || '',
            rank: t.rank || '',
            rank_level: t.rank_level,
            ancestor_ids: (t.ancestor_ids || []).map(Number),
            preferred_common_name: t.preferred_common_name || '',
        }));
    };
})(window.IR);
