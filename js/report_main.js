// Date range report: table builders + orchestration.
//
// The report treats the chosen date range as the subject and everything before
// it as the baseline; observations after the range are never fetched (d2 bounds
// the query). Depends only on the other IR.* modules.

window.IR = window.IR || {};

(function (IR) {
    function bucketStats(observations, inBucket, normMap) {
        const stats = {
            observations: 0, research: 0,
            observers: new Set(), species: new Set(), speciesResearch: new Set(),
        };
        observations.forEach((obs) => {
            if (!inBucket(obs)) return;
            stats.observations++;
            if (obs.is_research) stats.research++;
            if (obs.observer) stats.observers.add(obs.observer);
            const sp = IR.normalizedId(obs, normMap);
            if (sp !== null) {
                stats.species.add(sp);
                if (obs.is_research) stats.speciesResearch.add(sp);
            }
        });
        return stats;
    }

    function summarySection(target, observations, d1, d2, slug, normMap, isBefore, inRange) {
        const before = bucketStats(observations, isBefore, normMap);
        const range = bucketStats(observations, inRange, normMap);

        const cumSpecies = new Set(before.species);
        range.species.forEach((s) => cumSpecies.add(s));
        const cumObservers = new Set(before.observers);
        range.observers.forEach((o) => cumObservers.add(o));

        const dp = d1.split('-').map(Number);
        const dayBefore = new Date(Date.UTC(dp[0], dp[1] - 1, dp[2] - 1)).toISOString().slice(0, 10);
        const base = 'https://www.inaturalist.org/observations?project_id=' + slug;
        const beforeHead = slug ? IR.link(base + '&d2=' + dayBefore + '&verifiable=any', 'before ' + d1) : 'before ' + d1;
        const rangeHead = slug ? IR.link(base + '&d1=' + d1 + '&d2=' + d2 + '&verifiable=any', d1 + ' \u2192 ' + d2) : d1 + ' \u2192 ' + d2;

        const table = IR.table(
            ['', beforeHead, rangeHead, 'total \u2264 ' + d2],
            [
                ['Total observations', before.observations, range.observations, before.observations + range.observations],
                ['Research grade observations', before.research, range.research, before.research + range.research],
                ['Species observed', before.species.size, range.species.size, cumSpecies.size],
                ['Species (research grade)', before.speciesResearch.size, range.speciesResearch.size, ''],
                ['Observers', before.observers.size, range.observers.size, cumObservers.size],
            ]);

        target.appendChild(IR.titleWithCopy('Summary statistics', () => table.outerHTML));
        target.appendChild(table);
    }

    function topObserversSection(target, observations, normMap, isBefore, inRange) {
        const inRangeMap = new Map();  // login -> { species:Set, obs }
        const beforeMap = new Map();   // login -> Set species

        observations.forEach((obs) => {
            if (!obs.observer) return;
            const sp = IR.normalizedId(obs, normMap);
            if (inRange(obs)) {
                if (!inRangeMap.has(obs.observer)) inRangeMap.set(obs.observer, { species: new Set(), obs: 0 });
                const rec = inRangeMap.get(obs.observer);
                rec.obs++;
                if (sp !== null) rec.species.add(sp);
            } else if (isBefore(obs)) {
                if (!beforeMap.has(obs.observer)) beforeMap.set(obs.observer, new Set());
                if (sp !== null) beforeMap.get(obs.observer).add(sp);
            }
        });

        const list = Array.from(inRangeMap.entries()).map(([login, rec]) => ({
            login,
            species: rec.species.size,
            obs: rec.obs,
            speciesBefore: beforeMap.has(login) ? beforeMap.get(login).size : 0,
            isNew: !beforeMap.has(login),
        })).sort((a, b) => (b.species - a.species) || (b.obs - a.obs));

        const rows = list.slice(0, 15).map((rec, i) => [
            i + 1, '@' + rec.login, rec.species, rec.obs, rec.speciesBefore,
            rec.isNew ? 'new to project' : '',
        ]);

        const table = IR.table(
            ['', 'observer', 'species in range', 'observations in range', 'species before', ''],
            rows);

        target.appendChild(IR.titleWithCopy('Top observers in range', () => table.outerHTML));
        target.appendChild(table);
    }

    function topObserverPerTaxonomySection(target, observations, level, normMap, inRange, cache) {
        const byTaxon = new Map(); // groupName -> Map<login, Set<species>>

        observations.forEach((obs) => {
            if (!inRange(obs) || !obs.observer) return;
            const sp = IR.normalizedId(obs, normMap);
            if (sp === null) return;

            const name = IR.getGroupName(cache.get(Number(obs.taxon_id)), level, cache, obs.lat_name);
            if (!name) return;

            if (!byTaxon.has(name)) byTaxon.set(name, new Map());
            const perObserver = byTaxon.get(name);
            if (!perObserver.has(obs.observer)) perObserver.set(obs.observer, new Set());
            perObserver.get(obs.observer).add(sp);
        });

        const rows = [];
        byTaxon.forEach((perObserver, name) => {
            let top = null, max = 0;
            perObserver.forEach((set, login) => {
                if (set.size > max) { max = set.size; top = login; }
            });
            if (top) rows.push([name, '@' + top, max]);
        });
        rows.sort((a, b) => String(a[0]).localeCompare(String(b[0])));

        const levelCap = level.charAt(0).toUpperCase() + level.slice(1);
        const table = IR.table([levelCap, 'top observer', 'species'], rows);

        target.appendChild(IR.titleWithCopy('Top observer per ' + level + ' in range', () => table.outerHTML));
        target.appendChild(table);
    }

    // Render species items ({ obs }) grouped by taxonomy level, one table per group.
    function renderSpeciesGroups(target, items, level, cache, dateHeader, groupClass) {
        const groups = new Map();
        items.forEach((item) => {
            const card = cache.get(Number(item.obs.taxon_id));
            const lineage = IR.getLineage(card, cache);
            const name = IR.getGroupName(card, level, cache, item.obs.lat_name);
            if (!name) return;
            item.sortKey = [lineage.order || '', lineage.family || '', item.obs.lat_name || ''];
            if (!groups.has(name)) groups.set(name, []);
            groups.get(name).push(item);
        });

        Array.from(groups.keys()).sort((a, b) => a.localeCompare(b)).forEach((name) => {
            const groupItems = groups.get(name).sort((a, b) =>
                a.sortKey[0].localeCompare(b.sortKey[0]) ||
                a.sortKey[1].localeCompare(b.sortKey[1]) ||
                a.sortKey[2].localeCompare(b.sortKey[2]));

            target.appendChild(IR.el('h3', { text: name }));

            const rows = groupItems.map(({ obs }) => [
                IR.image(obs.image_url, obs.url, 75),
                obs.lat_name,
                obs.observed_on,
                '@' + obs.observer,
                obs.is_research ? '' : 'to be confirmed',
            ]);
            target.appendChild(IR.table(
                ['observation', 'scientific name', dateHeader, 'observer', 'comment'],
                rows, groupClass));
        });
    }

    function newSpeciesSection(target, observations, level, normMap, inRange, cache) {
        // First-ever observation per normalized taxon across everything fetched.
        const first = new Map();
        observations.forEach((obs) => {
            const sp = IR.normalizedId(obs, normMap);
            if (sp === null) return;
            const cur = first.get(sp);
            if (!cur || obs.observed_on < cur.observed_on) first.set(sp, obs);
        });

        const items = [];
        first.forEach((obs) => { if (inRange(obs)) items.push({ obs }); });

        target.appendChild(IR.titleWithCopy(
            'New species in range (' + items.length + ' species)',
            () => IR.collectGroupsHtml(target, 'report-new-species')));

        renderSpeciesGroups(target, items, level, cache, 'first seen', 'report-new-species');
    }

    function missingSpeciesSection(target, observations, level, normMap, inRange, isBefore, cache) {
        // Taxa seen before the range but not within it; show the last prior sighting.
        const seenInRange = new Set();
        const lastBefore = new Map();
        observations.forEach((obs) => {
            const sp = IR.normalizedId(obs, normMap);
            if (sp === null) return;
            if (inRange(obs)) {
                seenInRange.add(sp);
            } else if (isBefore(obs)) {
                const cur = lastBefore.get(sp);
                if (!cur || obs.observed_on > cur.observed_on) lastBefore.set(sp, obs);
            }
        });

        const items = [];
        lastBefore.forEach((obs, sp) => { if (!seenInRange.has(sp)) items.push({ obs }); });

        target.appendChild(IR.titleWithCopy(
            'Species not observed in range (' + items.length + ' previously seen species missing)',
            () => IR.collectGroupsHtml(target, 'report-missing-species')));

        renderSpeciesGroups(target, items, level, cache, 'last seen', 'report-missing-species');
    }

    IR.generateReport = function (observations, d1, d2, slug, level, cache, target) {
        const normMap = IR.buildNormalizationMap(observations, cache);
        target.innerHTML = '';

        // observed_on is 'YYYY-MM-DD', so string comparison is chronological.
        const inRange = (o) => o.observed_on >= d1 && o.observed_on <= d2;
        const isBefore = (o) => o.observed_on < d1;

        summarySection(target, observations, d1, d2, slug, normMap, isBefore, inRange);
        topObserversSection(target, observations, normMap, isBefore, inRange);
        topObserverPerTaxonomySection(target, observations, level, normMap, inRange, cache);
        newSpeciesSection(target, observations, level, normMap, inRange, cache);
        missingSpeciesSection(target, observations, level, normMap, inRange, isBefore, cache);
    };

    // End-to-end: fetch -> cache taxonomy -> render. Returns observation count.
    IR.generateProjectRangeReport = async function (opts) {
        const { slug, d1, d2, level, statusFn, target } = opts;

        statusFn('Fetching observations\u2026');
        const { observations, rawTaxa } = await IR.fetchProjectObservations(slug, d2, statusFn);
        if (!observations.length) throw new Error('No observations found for this project up to ' + d2 + '.');

        statusFn('Fetching taxonomy\u2026 (' + observations.length + ' observations)');
        const cache = await IR.buildTaxonomy(rawTaxa, statusFn);

        statusFn('Building report\u2026');
        IR.generateReport(observations, d1, d2, slug, level, cache, target);

        return observations.length;
    };
})(window.IR);
