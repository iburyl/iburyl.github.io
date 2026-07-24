// Taxonomy cache and helpers for the date range report.
//
// Owns its own IndexedDB store ("inat_report_tax_cache") so it never touches the
// databases or code used by the rest of the site. Observed taxa arrive for free
// with the observations; their ancestors (order / family / genus names) are
// fetched once and persisted, so repeat runs are cheap.

window.IR = window.IR || {};

(function (IR) {
    const DB_NAME = 'inat_report_tax_cache';
    const STORE = 'taxa';

    function openDb() {
        return new Promise((resolve, reject) => {
            const req = indexedDB.open(DB_NAME, 1);
            req.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(STORE)) {
                    db.createObjectStore(STORE, { keyPath: 'id' });
                }
            };
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }

    async function loadAll() {
        const db = await openDb();
        return new Promise((resolve, reject) => {
            const map = new Map();
            const cursor = db.transaction(STORE, 'readonly').objectStore(STORE).openCursor();
            cursor.onsuccess = (e) => {
                const c = e.target.result;
                if (c) { map.set(c.value.id, c.value); c.continue(); }
                else resolve(map);
            };
            cursor.onerror = () => reject(cursor.error);
        });
    }

    async function saveMany(cards) {
        if (!cards.length) return;
        const db = await openDb();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE, 'readwrite');
            const store = tx.objectStore(STORE);
            cards.forEach((c) => store.put(c));
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        });
    }

    // Normalize a raw API taxon object into a stored card.
    function toCard(t) {
        return {
            id: Number(t.id),
            name: t.name || '',
            rank: t.rank || '',
            rank_level: t.rank_level,
            ancestor_ids: (t.ancestor_ids || []).map(Number),
            preferred_common_name: t.preferred_common_name || '',
        };
    }

    // Build the full tax_id -> card cache for a set of observed taxa: load what
    // we have, add the observed taxa, then fetch any missing ancestors. Ancestor
    // chains are full paths to root, so one pass resolves ancestors-of-ancestors.
    IR.buildTaxonomy = async function (rawTaxa, statusFn) {
        const cache = await loadAll();

        const newObserved = [];
        rawTaxa.forEach((t) => {
            if (t && t.id && !cache.has(Number(t.id))) {
                const card = toCard(t);
                cache.set(card.id, card);
                newObserved.push(card);
            }
        });
        await saveMany(newObserved);

        const missing = new Set();
        cache.forEach((card) => {
            (card.ancestor_ids || []).forEach((a) => {
                if (!cache.has(a)) missing.add(a);
            });
        });

        const ids = Array.from(missing);
        const fetched = [];
        for (let i = 0; i < ids.length; i += 30) {
            const batch = ids.slice(i, i + 30);
            if (statusFn) statusFn('Fetching taxonomy\u2026 ' + i + ' of ' + ids.length);
            try {
                const cards = await IR.fetchTaxaByIds(batch);
                cards.forEach((c) => {
                    if (!cache.has(c.id)) { cache.set(c.id, c); fetched.push(c); }
                });
            } catch (e) {
                console.error('Ancestor fetch failed', e);
            }
            await IR.sleep(60);
        }
        await saveMany(fetched);

        return cache;
    };

    // Standard-rank ancestry (plus the taxon itself), keyed by rank name.
    IR.getLineage = function (card, cache) {
        const lineage = {
            kingdom: '', phylum: '', class: '', order: '',
            family: '', genus: '', species: '',
        };
        if (!card) return lineage;
        const consider = (c) => {
            if (c && c.rank && Object.prototype.hasOwnProperty.call(lineage, c.rank)) {
                lineage[c.rank] = c.name;
            }
        };
        (card.ancestor_ids || []).forEach((id) => consider(cache.get(Number(id))));
        consider(card);
        return lineage;
    };

    // Group name for a taxon at a chosen level (kingdom/class/order/family/genus).
    IR.getGroupName = function (card, level, cache, latName) {
        if (!card) return '';
        if (level === 'genus') {
            if (card.rank === 'genus') return card.name;
            const lineage = IR.getLineage(card, cache);
            if (lineage.genus) return lineage.genus;
            return (latName || '').split(' ')[0] || '';
        }
        return IR.getLineage(card, cache)[level] || '';
    };

    // Map each observed taxon_id to the id it should be counted as:
    //   - species (rank_level 10) -> itself
    //   - below species -> its species ancestor (subspecies collapse into species)
    //   - above species observed directly -> itself, but ONLY if nothing finer was
    //     observed under it; a coarse ID whose descendants were also observed is
    //     "covered" and dropped (so it isn't miscounted as a distinct/new taxon)
    // Taxa not present in the returned map are excluded from all taxon counts.
    IR.buildNormalizationMap = function (observations, cache) {
        const map = new Map();

        // Unique observed taxa.
        const observed = new Set();
        observations.forEach((obs) => observed.add(Number(obs.taxon_id)));

        // Every ancestor of an observed taxon has an observed descendant of
        // strictly lower rank, so an observation identified only to that coarser
        // taxon is already represented by finer ones.
        const covered = new Set();
        observed.forEach((t) => {
            const card = cache.get(t);
            if (card) (card.ancestor_ids || []).forEach((a) => covered.add(Number(a)));
        });

        observed.forEach((t) => {
            const card = cache.get(t);
            if (!card) return;
            const rl = card.rank_level;

            if (typeof rl === 'number' && rl < 10) {
                let speciesId = null;
                (card.ancestor_ids || []).forEach((aid) => {
                    const ac = cache.get(Number(aid));
                    if (ac && ac.rank_level === 10) speciesId = Number(aid);
                });
                map.set(t, speciesId !== null ? speciesId : t);
            } else if (typeof rl === 'number' && rl > 10) {
                if (!covered.has(t)) map.set(t, t);
                // else: coarse ID covered by finer observations -> excluded
            } else {
                map.set(t, t);
            }
        });
        return map;
    };

    // Normalized taxon id for an observation, or null when uncached.
    IR.normalizedId = function (obs, normMap) {
        const t = Number(obs.taxon_id);
        return normMap.has(t) ? normMap.get(t) : null;
    };
})(window.IR);
