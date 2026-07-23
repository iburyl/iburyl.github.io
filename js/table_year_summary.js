

// Helper function to get taxonomy level index from taxDetail array
function getTaxonomyLevelIndex(taxonomyLevel) {
    const levelMap = {
        'kingdom': 0,
        'class': 1,
        'order': 2,
        'family': 3
    };
    return levelMap[taxonomyLevel] || 3; // Default to family if invalid
}

// Helper function to get genus from scientific name or taxon card
function getGenus(main_inat_card, scientificName) {
    // If the card is already at genus level, return its name
    if (main_inat_card && main_inat_card.rank === 'genus') {
        return main_inat_card.name;
    }
    // Otherwise, extract genus (first word) from scientific name
    if (scientificName && scientificName.length > 0) {
        return scientificName.split(' ')[0];
    }
    return '';
}

// Helper function to create a title with copy functionality
function createTitleWithCopy(titleText, titleId, getHtmlContentFunc) {
    const titleElement = document.createElement("h2");
    titleElement.id = titleId;
    
    const textSpan = document.createElement("span");
    textSpan.innerHTML = titleText;
    
    const copySpan = document.createElement("span");
    copySpan.innerHTML = " (copy)";
    copySpan.style.cursor = 'pointer';
    copySpan.title = 'Click to copy HTML';
    copySpan.style.fontSize = '0.8em';
    copySpan.onclick = function() {
        const htmlContent = getHtmlContentFunc();
        if (htmlContent) {
            navigator.clipboard.writeText(htmlContent).then(() => {
                const originalText = copySpan.innerHTML;
                copySpan.innerHTML = " ✓";
                setTimeout(() => {
                    copySpan.innerHTML = originalText;
                }, 1000);
            }).catch(err => {
                console.error('Failed to copy: ', err);
                alert('Failed to copy HTML to clipboard');
            });
        }
    };
    
    titleElement.appendChild(textSpan);
    titleElement.appendChild(copySpan);
    return titleElement;
}

// Helper function to remove ancestor higher-rank taxa from the normalization map
// This prevents double-counting when we have both higher-rank and more specific observations
function removeAncestorsFromMap(inat_card, taxIdMapCache, tax_normalization_map) {
    let removed_ancestors = [];
    if (inat_card.ancestor_ids) {
        inat_card.ancestor_ids.forEach(ancestor_id => {
            ancestor_id = Number(ancestor_id);

            if (tax_normalization_map.has(ancestor_id)) {
                let ancestor_card = taxIdMapCache.get(ancestor_id);
                if (ancestor_card && ancestor_card.rank_level > inat_card.rank_level) {
                    tax_normalization_map.delete(ancestor_id);
                    removed_ancestors.push(ancestor_card.name);
                }
            }
        });
    }
    return removed_ancestors;
}

// Helper function to find species-level ancestor (rank_level == 10)
function findSpeciesAncestor(inat_card, taxIdMapCache) {
    if (!inat_card.ancestor_ids) return null;
    
    for (let ancestor_id of inat_card.ancestor_ids) {
        ancestor_id = Number(ancestor_id);
        if (taxIdMapCache.has(ancestor_id)) {
            let ancestor_card = taxIdMapCache.get(ancestor_id);
            if (ancestor_card.rank_level === 10) {
                return ancestor_id;
            }
        }
    }
    return null;
}

// Helper function to check if any observation is a child of given tax_id with lower rank_level
function hasChildrenWithLowerRank(parent_tax_id, parent_rank_level, all_tax_cards) {
    for (let [tax_id, inat_card] of all_tax_cards) {
        if (inat_card.rank_level < parent_rank_level && 
            inat_card.ancestor_ids && 
            inat_card.ancestor_ids.includes(parent_tax_id)) {
            return true;
        }
    }
    return false;
}

// Helper function to build tax normalization map for a specific year
function buildTaxNormalizationMap(observations, taxIdMapCache, taxLatNameMapCache) {
    let tax_normalization_map = new Map();
    let unknown_tax = 0;
    
    // First pass: collect all tax_ids and their rank levels
    let all_tax_cards = new Map();

    observations.forEach(obs => {
        const taxon_id = Number(obs.taxon_id);
        
        if(all_tax_cards.has(taxon_id)) {unknown_tax++; return;}
        
        let tax_details = getTaxDetailsFromId(taxon_id, false, taxIdMapCache);
        
        if(typeof tax_details == "undefined") {unknown_tax++; return;}
        
        all_tax_cards.set(taxon_id, tax_details);
    });

    // Sort taxa by rank_level (descending: higher ranks first, then species, then subspecies)
    // This ensures that when we add species, we can remove their higher-rank ancestors
    const sorted_tax_entries = Array.from(all_tax_cards.entries()).sort((a, b) => {
        return b[1].rank_level - a[1].rank_level; // Higher rank_level first
    });
    
    // Second pass: build normalization map (processing in descending rank_level order)
    sorted_tax_entries.forEach(([tax_id, inat_card]) => {
        // Ensure tax_id is a number
        tax_id = Number(tax_id);
        
        if (inat_card.rank_level === 10) {            

            // Species level - map to itself
            tax_normalization_map.set(tax_id, tax_id);
            
            // Remove any ancestor higher-rank taxa from the map
            removeAncestorsFromMap(inat_card, taxIdMapCache, tax_normalization_map);
        }
        else if (inat_card.rank_level < 10) {
            // Below species level (subspecies, variety, etc.) - find species ancestor
            let species_ancestor_id = findSpeciesAncestor(inat_card, taxIdMapCache);
            if (species_ancestor_id) {
                let ancestor_card = taxIdMapCache.get(species_ancestor_id);
                tax_normalization_map.set(tax_id, species_ancestor_id);
                
                // Remove any ancestor higher-rank taxa from the map
                removeAncestorsFromMap(ancestor_card, taxIdMapCache, tax_normalization_map);
            }
        }
        else {
            // Above species level (genus, family, order, etc.)
            // Check if there are any children with lower rank_level
            if (hasChildrenWithLowerRank(tax_id, inat_card.rank_level, all_tax_cards)) {
                // Has children - ignore this tax
            } else {
                // No children - map to itself
                tax_normalization_map.set(tax_id, tax_id);
                
                // Remove any ancestor higher-rank taxa from the map
                removeAncestorsFromMap(inat_card, taxIdMapCache, tax_normalization_map);
            }
        }
    });
    
    return tax_normalization_map;
}

async function generateYearSummaryReport( observations, speciesMap, targetYear, projectName, taxonomyLevel)
{
    targetYear = parseInt(targetYear);

    let taxIdMapCache = await getTaxIdMapCache();
    let taxLatNameMapCache = taxIdMap2taxLatNameMap(taxIdMapCache);

    // Clear main report div
    const main_report_div = document.getElementById("main_report_div");
    if (main_report_div) {
        main_report_div.innerHTML = '';
    }
    
    // Generate all tables
    generateSummaryStatsTable(targetYear, observations, taxIdMapCache, taxLatNameMapCache, projectName);
    generateTopObserversTable(targetYear, observations, taxIdMapCache, taxLatNameMapCache);
    generateTopObserversPerTaxonomyTable(targetYear, taxonomyLevel, observations, taxIdMapCache, taxLatNameMapCache);
    generateMissingSpeciesTable(targetYear, taxonomyLevel, observations, taxIdMapCache, taxLatNameMapCache);
    generateNewSpeciesTable(targetYear, taxonomyLevel, observations, taxIdMapCache, taxLatNameMapCache);
}

// Function to generate the summary statistics table (5 years)
function generateSummaryStatsTable(targetYear, observations, taxIdMapCache, taxLatNameMapCache, projectName) {
    // Build a list of 5 years (targetYear and 4 previous years)
    let years = [];
    for (let i = 4; i >= 0; i--) {
        years.push(targetYear - i);
    }
    
    const yearStats = years.map(year => {
        // Filter observations for this year
        const year_observations = observations.filter(obs => obs.time.getFullYear() === year);
        
        // Build tax normalization map for this specific year
        const tax_normalization_map = buildTaxNormalizationMap(year_observations, taxIdMapCache, taxLatNameMapCache);
        
        const stats = {
            year: year,
            totalObservations: 0,
            totalResearchGrade: 0,
            observers: new Set(),
            speciesObserved: new Set(),
            speciesResearchGrade: new Set()
        };
        
        // Go through all observations for this year
        year_observations.forEach(obs => {
            // Count observation
            stats.totalObservations++;
            
            // Track observer
            if (obs.user_id) {
                stats.observers.add(obs.user_id);
            }
            
            // Track research grade
            if (obs.is_research) {
                stats.totalResearchGrade++;
            }
            
            // Normalize tax_id to species level using the normalization map
            if (obs.taxon_id) {
                const taxon_id = Number(obs.taxon_id);
                if (tax_normalization_map.has(taxon_id)) {
                    const normalized_tax_id = tax_normalization_map.get(taxon_id);
                    
                    // Add to species observed set (using normalized tax_id)
                    stats.speciesObserved.add(normalized_tax_id);
                    
                    // Add to research grade species if this is a research grade observation
                    if (obs.is_research) {
                        stats.speciesResearchGrade.add(normalized_tax_id);
                    }
                }
                // else: tax_id not in normalization map (higher rank with children) - skip from species count
            }
        });
        
        return {
            year: stats.year,
            totalObservations: stats.totalObservations,
            totalResearchGrade: stats.totalResearchGrade,
            observers: stats.observers,
            totalSpeciesObserved: stats.speciesObserved.size,
            totalSpeciesResearchGrade: stats.speciesResearchGrade.size
        };
    });
    
    // Reverse the yearStats array to show most recent year first
    yearStats.reverse();
    
    // Create the table
    const table_years = document.createElement("table");
    
    // Create title with copy functionality
    const title_summary = createTitleWithCopy(
        `Summary Statistics (${years[0]}-${years[years.length-1]})`,
        "summary_title",
        () => table_years.outerHTML
    );
    
    // Create header row with years as links (if projectName is provided)
    const headerRow = ['', ...yearStats.map(stat => {
        const year = stat.year;
        if (projectName && projectName.trim() !== '') {
            const url = `https://www.inaturalist.org/observations?d1=${year}-01-01&d2=${year}-12-31&project_id=${projectName}&verifiable=any`;
            return `<a href="${url}" target="_blank">${year}</a>`;
        } else {
            return year;
        }
    })];
    table_years.appendChild(createThead([createTr(headerRow)]));
    
    // Create rows for each statistic
    const statRows = [
        ['Total Observations', ...yearStats.map(stat => stat.totalObservations)],
        ['Research Grade Observations', ...yearStats.map(stat => stat.totalResearchGrade)],
        ['Species Observed', ...yearStats.map(stat => stat.totalSpeciesObserved)],
        ['Species (Research Grade)', ...yearStats.map(stat => stat.totalSpeciesResearchGrade)],
        ['Observers', ...yearStats.map(stat => stat.observers.size)],
    ];
    
    statRows.forEach(rowData => {
        table_years.appendChild(createTr(rowData));
    });
    
    // Append to main report div
    const main_report_div = document.getElementById("main_report_div");
    if (main_report_div) {
        main_report_div.appendChild(title_summary);
        main_report_div.appendChild(table_years);
    }
}
    
// Function to generate the top observers table (target year vs previous year)
function generateTopObserversTable(targetYear, observations, taxIdMapCache, taxLatNameMapCache) {
    // Create top observers table for target year vs previous years
    const currentYear = parseInt(targetYear);
    const previousYear = currentYear - 1;
    const twoYearsAgo = currentYear - 2;
    
    // Build normalization maps for all three years
    const obsCurrent = observations.filter(obs => obs.time.getFullYear() === currentYear);
    const obsPrevious = observations.filter(obs => obs.time.getFullYear() === previousYear);
    const obsTwoYearsAgo = observations.filter(obs => obs.time.getFullYear() === twoYearsAgo);
    const taxMapCurrent = buildTaxNormalizationMap(obsCurrent, taxIdMapCache, taxLatNameMapCache);
    const taxMapPrevious = buildTaxNormalizationMap(obsPrevious, taxIdMapCache, taxLatNameMapCache);
    const taxMapTwoYearsAgo = buildTaxNormalizationMap(obsTwoYearsAgo, taxIdMapCache, taxLatNameMapCache);
    
    // Calculate observer stats for current year
    const observersCurrent = new Map();
    obsCurrent.forEach(obs => {
        if (!obs.user_id) return;
        
        if (!observersCurrent.has(obs.user_id)) {
            observersCurrent.set(obs.user_id, {
                name: obs.user_id,
                species: new Set(),
                observations: 0
            });
        }
        
        const observerData = observersCurrent.get(obs.user_id);
        observerData.observations++;
        
        if (obs.taxon_id) {
            const taxon_id = Number(obs.taxon_id);
            if (taxMapCurrent.has(taxon_id)) {
                const normalized_tax_id = taxMapCurrent.get(taxon_id);
                observerData.species.add(normalized_tax_id);
            }
        }
    });
    
    // Calculate observer stats for previous year (species only)
    const observersPrevious = new Map();
    obsPrevious.forEach(obs => {
        if (!obs.user_id) return;
        
        if (!observersPrevious.has(obs.user_id)) {
            observersPrevious.set(obs.user_id, {
                name: obs.user_id,
                species: new Set()
            });
        }
        
        const observerData = observersPrevious.get(obs.user_id);
        
        if (obs.taxon_id) {
            const taxon_id = Number(obs.taxon_id);
            if (taxMapPrevious.has(taxon_id)) {
                const normalized_tax_id = taxMapPrevious.get(taxon_id);
                observerData.species.add(normalized_tax_id);
            }
        }
    });
    
    // Calculate observer stats for two years ago (species only)
    const observersTwoYearsAgo = new Map();
    obsTwoYearsAgo.forEach(obs => {
        if (!obs.user_id) return;
        
        if (!observersTwoYearsAgo.has(obs.user_id)) {
            observersTwoYearsAgo.set(obs.user_id, {
                name: obs.user_id,
                species: new Set()
            });
        }
        
        const observerData = observersTwoYearsAgo.get(obs.user_id);
        
        if (obs.taxon_id) {
            const taxon_id = Number(obs.taxon_id);
            if (taxMapTwoYearsAgo.has(taxon_id)) {
                const normalized_tax_id = taxMapTwoYearsAgo.get(taxon_id);
                observerData.species.add(normalized_tax_id);
            }
        }
    });
    
    // Convert to arrays and sort by species count, then by observations
    const observerListCurrent = Array.from(observersCurrent.values()).map(obs => ({
        name: obs.name,
        species: obs.species.size,
        observations: obs.observations
    })).sort((a, b) => {
        if (b.species !== a.species) {
            return b.species - a.species;
        }
        return b.observations - a.observations;
    });
    
    // Create species count maps for previous years
    const previousYearSpeciesMap = new Map();
    observersPrevious.forEach((obs, name) => {
        previousYearSpeciesMap.set(name, obs.species.size);
    });
    
    const twoYearsAgoSpeciesMap = new Map();
    observersTwoYearsAgo.forEach((obs, name) => {
        twoYearsAgoSpeciesMap.set(name, obs.species.size);
    });
    
    // Get top 10 from current year
    const top10Current = observerListCurrent.slice(0, 12);
    
    // Create observers table
    const table_observers = document.createElement("table");
    
    const title_observers = createTitleWithCopy(
        `Top Observers in ${currentYear}`,
        "observers_title",
        () => table_observers.outerHTML
    );
    
    // Add header
    table_observers.appendChild(createThead([createTr([
        '', 
        'Observer', 
        `Species in ${currentYear}`, 
        `Species in ${previousYear}`,
        `Species in ${twoYearsAgo}`
    ])]));
    
    // Add rows
    top10Current.forEach((obs, index) => {
        const positionCurrent = index + 1;
        
        // Get species count for previous years
        const speciesPrevious = previousYearSpeciesMap.has(obs.name) 
            ? previousYearSpeciesMap.get(obs.name) 
            : '-';
        const speciesTwoYearsAgo = twoYearsAgoSpeciesMap.has(obs.name) 
            ? twoYearsAgoSpeciesMap.get(obs.name) 
            : '-';
        
        table_observers.appendChild(createTr([
            positionCurrent,
            '@' + obs.name,
            obs.species,
            speciesPrevious,
            speciesTwoYearsAgo,
        ]));
    });
    
    // Append to main report div
    const main_report_div = document.getElementById("main_report_div");
    if (main_report_div) {
        main_report_div.appendChild(title_observers);
        main_report_div.appendChild(table_observers);
    }
}

// Function to generate top observers per taxonomy level table
async function generateTopObserversPerTaxonomyTable(targetYear, taxonomyLevel, observations, taxIdMapCache, taxLatNameMapCache) {
    targetYear = parseInt(targetYear);
    
    // Build tax normalization map for target year
    const targetYearObservations = observations.filter(obs => obs.time.getFullYear() === targetYear);
    const tax_normalization_map = buildTaxNormalizationMap(targetYearObservations, taxIdMapCache, taxLatNameMapCache);
    
    // Collect all taxonomy groups and their observers
    const taxonomyObservers = new Map(); // Map<taxonomyName, Map<observer, Set<species>>>
    
    targetYearObservations.forEach(obs => {
        if (!obs.taxon_id) return;
        
        const taxon_id = Number(obs.taxon_id);
        
        if (!tax_normalization_map.has(taxon_id)) return;
        
        const normalized_tax_id = tax_normalization_map.get(taxon_id);
        
        // Get taxonomy details
        let taxDetail = [getSpan(),getSpan(),getSpan(),getSpan(),getSpan(),getSpan(),getSpan(),getSpan(),getSpan()];
        let main_inat_card = fillMainTaxDetailsEx(obs.lat_name, obs.taxon_id, taxDetail, taxLatNameMapCache, taxIdMapCache);
        
        if(typeof main_inat_card === "undefined") return;
        
        fillAncestorTaxDetails(main_inat_card, taxDetail, taxIdMapCache);
        
        // Get the taxonomy name based on the specified level
        let taxonomyName = '';
        if (taxonomyLevel === 'genus') {
            taxonomyName = getGenus(main_inat_card, obs.lat_name);
        } else {
            const levelIndex = getTaxonomyLevelIndex(taxonomyLevel);
            taxonomyName = taxDetail[levelIndex].innerHTML;
        }
        
        if (!taxonomyName || taxonomyName === '') return;
        
        // Initialize taxonomy group if needed
        if (!taxonomyObservers.has(taxonomyName)) {
            taxonomyObservers.set(taxonomyName, new Map());
        }
        
        const observersInTaxonomy = taxonomyObservers.get(taxonomyName);
        const observer = obs.user_id;
        
        // Initialize observer if needed
        if (!observersInTaxonomy.has(observer)) {
            observersInTaxonomy.set(observer, new Set());
        }
        
        // Add species to observer's set
        observersInTaxonomy.get(observer).add(normalized_tax_id);
    });
    
    // Build table data: for each taxonomy, find the observer with most species
    const tableData = [];
    
    taxonomyObservers.forEach((observersMap, taxonomyName) => {
        // Find observer with maximum species in this taxonomy
        let topObserver = null;
        let maxSpecies = 0;
        
        observersMap.forEach((speciesSet, observer) => {
            if (speciesSet.size > maxSpecies) {
                maxSpecies = speciesSet.size;
                topObserver = observer;
            }
        });
        
        if (topObserver) {
            tableData.push({
                taxonomy: taxonomyName,
                taxon_id: taxon_id,
                observer: topObserver,
                species: maxSpecies
            });
        }
    });
    
    // Sort by taxonomy name
    tableData.sort((a, b) => a.taxonomy.localeCompare(b.taxonomy));
    
    // Create title
    const taxonomyLevelCapitalized = taxonomyLevel.charAt(0).toUpperCase() + taxonomyLevel.slice(1);
    const table_taxonomy_observers = document.createElement("table");
    
    const title_taxonomy_observers = createTitleWithCopy(
        `Top Observer per ${taxonomyLevelCapitalized} in ${targetYear}`,
        "taxonomy_observers_title",
        () => table_taxonomy_observers.outerHTML
    );
    
    // Add table header
    table_taxonomy_observers.appendChild(createThead([createTr([
        taxonomyLevelCapitalized,
        'top observer',
        'species'
    ])]));
    
    // Add rows
    tableData.forEach(item => {
        const tdFields = [
            item.taxonomy,
            '@' + item.observer,
            `<a href='https://www.inaturalist.org/observations?d1=${targetYear}-01-01&d2=${targetYear}-12-31&project_id=moths-of-oregon&taxon_id=${item.taxon_id}&user_id=${item.observer}' target='_blank'>${item.species}</a>`
        ];
        
        table_taxonomy_observers.appendChild(createTr(tdFields));
    });
    
    // Append to main report div
    const main_report_div = document.getElementById("main_report_div");
    if (main_report_div) {
        main_report_div.appendChild(title_taxonomy_observers);
        main_report_div.appendChild(table_taxonomy_observers);
    }
}

// Function to generate the new species table (species first observed in target year)
async function generateNewSpeciesTable(targetYear, taxonomyLevel, observations, taxIdMapCache, taxLatNameMapCache) {
    targetYear = parseInt(targetYear);
    
    // Build tax normalization map over all years
    const tax_normalization_map = buildTaxNormalizationMap(observations, taxIdMapCache, taxLatNameMapCache);
    
    // Find first observation for each normalized species (across all years)
    const speciesFirstObservation = new Map();
    
    observations.forEach(obs => {
        if (!obs.taxon_id) return;
        
        const taxon_id = Number(obs.taxon_id);
        
        // Try to normalize
        if (tax_normalization_map.has(taxon_id)) {
            const normalized_tax_id = tax_normalization_map.get(taxon_id);
            
            if (!speciesFirstObservation.has(normalized_tax_id)) {
                speciesFirstObservation.set(normalized_tax_id, obs);
            } else {
                const current_first_obs = speciesFirstObservation.get(normalized_tax_id);
                if (obs.time < current_first_obs.time) {
                    speciesFirstObservation.set(normalized_tax_id, obs);
                }
            }
        }
    });
    
    // Filter species that were first observed in target year
    const newSpeciesObservations = [];
    speciesFirstObservation.forEach((obs, tax_id) => {
        if (obs.time.getFullYear() === targetYear) {
            newSpeciesObservations.push({
                normalized_tax_id: tax_id,
                observation: obs
            });
        }
    });
    
    // Sort by taxonomy (order, family, species name, date)
    newSpeciesObservations.sort((a, b) => {
                let taxDetailA = [getSpan(),getSpan(),getSpan(),getSpan(),getSpan(),getSpan(),getSpan(),getSpan(),getSpan()];
                let taxDetailB = [getSpan(),getSpan(),getSpan(),getSpan(),getSpan(),getSpan(),getSpan(),getSpan(),getSpan()];
        
        let main_inat_cardA = fillMainTaxDetailsEx(a.observation.lat_name, a.observation.taxon_id, taxDetailA, taxLatNameMapCache, taxIdMapCache);
        let main_inat_cardB = fillMainTaxDetailsEx(b.observation.lat_name, b.observation.taxon_id, taxDetailB, taxLatNameMapCache, taxIdMapCache);
        
        if(typeof main_inat_cardA !== "undefined") {
                    fillAncestorTaxDetails(main_inat_cardA, taxDetailA, taxIdMapCache);
                }
        if(typeof main_inat_cardB !== "undefined") {
                    fillAncestorTaxDetails(main_inat_cardB, taxDetailB, taxIdMapCache);
                }
        
                if(taxDetailA[2].innerHTML < taxDetailB[2].innerHTML) return -1;
                if(taxDetailA[2].innerHTML > taxDetailB[2].innerHTML) return +1;
                if(taxDetailA[3].innerHTML < taxDetailB[3].innerHTML) return -1;
                if(taxDetailA[3].innerHTML > taxDetailB[3].innerHTML) return +1;
                if(taxDetailA[5].innerHTML < taxDetailB[5].innerHTML) return -1;
        if(taxDetailA[5].innerHTML > taxDetailB[5].innerHTML) return +1;
        
        if(a.observation.time > b.observation.time) return +1; 
        else return -1;
    });
    
    // Create title with copy functionality
    const title_new_species = createTitleWithCopy(
        `New Species in ${targetYear} (${newSpeciesObservations.length} species)`,
        "new_species_title",
        () => {
            // Collect all family tables
            const familyTables = document.querySelectorAll('.table_new_species_family');
            let allTablesHtml = '';
            familyTables.forEach(table => {
                // Find the h3 before this table
                let h3 = table.previousElementSibling;
                if (h3 && h3.tagName === 'H3') {
                    allTablesHtml += h3.outerHTML + '\n';
                }
                allTablesHtml += table.outerHTML + '\n';
            });
            return allTablesHtml || null;
        }
    );
    
    // Group observations by taxonomy level
    const taxonomyGroups = new Map();
    
    newSpeciesObservations.forEach(item => {
        const obs = item.observation;
        
        let taxDetail = [getSpan(),getSpan(),getSpan(),getSpan(),getSpan(),getSpan(),getSpan(),getSpan(),getSpan()];
        let main_inat_card = fillMainTaxDetailsEx(obs.lat_name, obs.taxon_id, taxDetail, taxLatNameMapCache, taxIdMapCache);
        
        if(typeof main_inat_card !== "undefined") {
            fillAncestorTaxDetails(main_inat_card, taxDetail, taxIdMapCache);
        }
        
        // Get the taxonomy name based on the specified level
        let taxonomyName = '';
        if (taxonomyLevel === 'genus') {
            taxonomyName = getGenus(main_inat_card, obs.lat_name);
        } else {
            const levelIndex = getTaxonomyLevelIndex(taxonomyLevel);
            taxonomyName = taxDetail[levelIndex].innerHTML;
        }
        
        if (taxonomyName && taxonomyName !== '') {
            if (!taxonomyGroups.has(taxonomyName)) {
                taxonomyGroups.set(taxonomyName, []);
            }
            taxonomyGroups.get(taxonomyName).push({ item, taxDetail });
        }
    });
    
    // Append to main report div
    const main_report_div = document.getElementById("main_report_div");
    if (main_report_div) {
        main_report_div.appendChild(title_new_species);
        
        // Create a separate table for each taxonomy group
        taxonomyGroups.forEach((speciesInGroup, taxonomyName) => {
            // Create taxonomy group header
            const groupHeader = document.createElement("h3");
            groupHeader.innerHTML = taxonomyName;
            main_report_div.appendChild(groupHeader);
            
            // Create table for this taxonomy group
            const table_group = document.createElement("table");
            table_group.className = "table_new_species_family";
            
            // Add table header
            table_group.appendChild(createThead([createTr(
                ['observation', 'scientific name', 'date', 'observer', 'comment' ]
            )]));
            
            // Add species rows
            speciesInGroup.forEach(({ item, taxDetail }) => {
                const obs = item.observation;
                
                // Get observation details
                let image_tag = '';
                if(obs.image_url && obs.image_url !== '') {
                    image_tag = `<a href='${obs.url}'><img src='${obs.image_url}' alt='image' width='100'></a>`;
                }
                
                let date = obs.time.toISOString().split('T')[0];
                let observer = '@' + obs.user_id;
                
                // Species row
                const tdFields = [
                    image_tag,
                    obs.lat_name,
                    date,
                    observer,
                    obs.is_research ? '' : 'to be confirmed'
                ];
                
                table_group.appendChild(createTr(tdFields));
            });
            
            main_report_div.appendChild(table_group);
        });
    }
}

// Function to generate the missing species table (species observed in last 3 years but not in target year)
async function generateMissingSpeciesTable(targetYear, taxonomyLevel, observations, taxIdMapCache, taxLatNameMapCache) {
    targetYear = parseInt(targetYear);
    
    // Build tax normalization map over all years (global)
    const tax_normalization_map = buildTaxNormalizationMap(observations, taxIdMapCache, taxLatNameMapCache);
    
    // Get species observed in each year
    const speciesInYear = new Map(); // year -> Set of normalized tax_ids
    
    observations.forEach(obs => {
        const year = obs.time.getFullYear();
        if (obs.taxon_id) {
            const taxon_id = Number(obs.taxon_id);
            if (tax_normalization_map.has(taxon_id)) {
                const normalized_tax_id = tax_normalization_map.get(taxon_id);
                
                if (!speciesInYear.has(year)) {
                    speciesInYear.set(year, new Set());
                }
                speciesInYear.get(year).add(normalized_tax_id);
            }
        }
    });
    
    // Get species from each of the last 3 years
    const year1 = targetYear - 1;
    const year2 = targetYear - 2;
    const year3 = targetYear - 3;
    
    const speciesInYear1 = speciesInYear.get(year1) || new Set();
    const speciesInYear2 = speciesInYear.get(year2) || new Set();
    const speciesInYear3 = speciesInYear.get(year3) || new Set();
    
    // Find species that were in ALL 3 previous years (intersection)
    const speciesInAllPrevious3Years = new Set();
    speciesInYear1.forEach(tax_id => {
        if (speciesInYear2.has(tax_id) && speciesInYear3.has(tax_id)) {
            speciesInAllPrevious3Years.add(tax_id);
        }
    });
    
    // Get species in target year
    const speciesInTargetYear = speciesInYear.get(targetYear) || new Set();
    
    // Find species that are in ALL 3 previous years but NOT in target year
    const missingSpecies = [];
    speciesInAllPrevious3Years.forEach(tax_id => {
        if (!speciesInTargetYear.has(tax_id)) {
            // Get the last observation of this species before target year
            let lastObs = null;
            observations.forEach(obs => {
                if (obs.time.getFullYear() < targetYear && obs.taxon_id) {
                    const taxon_id = Number(obs.taxon_id);
                    if (tax_normalization_map.has(taxon_id)) {
                        const normalized_tax_id = tax_normalization_map.get(taxon_id);
                        if (normalized_tax_id === tax_id) {
                            if (!lastObs || obs.time > lastObs.time) {
                                lastObs = obs;
                            }
                        }
                    }
                }
            });
            
            if (lastObs) {
                missingSpecies.push({
                    normalized_tax_id: tax_id,
                    lastObservation: lastObs
                });
            }
        }
    });
    
    // Sort by taxonomy (order, family, species name)
    missingSpecies.sort((a, b) => {
        let taxDetailA = [getSpan(),getSpan(),getSpan(),getSpan(),getSpan(),getSpan(),getSpan(),getSpan(),getSpan()];
        let taxDetailB = [getSpan(),getSpan(),getSpan(),getSpan(),getSpan(),getSpan(),getSpan(),getSpan(),getSpan()];
        
        let main_inat_cardA = fillMainTaxDetailsEx(a.lastObservation.lat_name, a.lastObservation.taxon_id, taxDetailA, taxLatNameMapCache, taxIdMapCache);
        let main_inat_cardB = fillMainTaxDetailsEx(b.lastObservation.lat_name, b.lastObservation.taxon_id, taxDetailB, taxLatNameMapCache, taxIdMapCache);
        
        if(typeof main_inat_cardA !== "undefined") {
            fillAncestorTaxDetails(main_inat_cardA, taxDetailA, taxIdMapCache);
        }
        if(typeof main_inat_cardB !== "undefined") {
            fillAncestorTaxDetails(main_inat_cardB, taxDetailB, taxIdMapCache);
        }
        
        if(taxDetailA[2].innerHTML < taxDetailB[2].innerHTML) return -1;
        if(taxDetailA[2].innerHTML > taxDetailB[2].innerHTML) return +1;
        if(taxDetailA[3].innerHTML < taxDetailB[3].innerHTML) return -1;
        if(taxDetailA[3].innerHTML > taxDetailB[3].innerHTML) return +1;
        if(taxDetailA[5].innerHTML < taxDetailB[5].innerHTML) return -1;
        if(taxDetailA[5].innerHTML > taxDetailB[5].innerHTML) return +1;
        
        return 0;
    });
    
    // Create title with copy functionality
    const title_missing_species = createTitleWithCopy(
        `Species Not Observed in ${targetYear} (${missingSpecies.length} species found in each of previous 3 years)`,
        "missing_species_title",
        () => {
            // Collect all family tables
            const familyTables = document.querySelectorAll('.table_missing_species_family');
            let allTablesHtml = '';
            familyTables.forEach(table => {
                // Find the h3 before this table
                let h3 = table.previousElementSibling;
                if (h3 && h3.tagName === 'H3') {
                    allTablesHtml += h3.outerHTML + '\n';
                }
                allTablesHtml += table.outerHTML + '\n';
            });
            return allTablesHtml || null;
        }
    );
    
    // Group observations by taxonomy level
    const taxonomyGroups = new Map();
    
    missingSpecies.forEach(item => {
        const obs = item.lastObservation;
        
        let taxDetail = [getSpan(),getSpan(),getSpan(),getSpan(),getSpan(),getSpan(),getSpan(),getSpan(),getSpan()];
        let main_inat_card = fillMainTaxDetailsEx(obs.lat_name, obs.taxon_id, taxDetail, taxLatNameMapCache, taxIdMapCache);
        
        if(typeof main_inat_card !== "undefined") {
            fillAncestorTaxDetails(main_inat_card, taxDetail, taxIdMapCache);
        }
        
        // Get the taxonomy name based on the specified level
        let taxonomyName = '';
        if (taxonomyLevel === 'genus') {
            taxonomyName = getGenus(main_inat_card, obs.lat_name);
        } else {
            const levelIndex = getTaxonomyLevelIndex(taxonomyLevel);
            taxonomyName = taxDetail[levelIndex].innerHTML;
        }
        
        if (taxonomyName && taxonomyName !== '') {
            if (!taxonomyGroups.has(taxonomyName)) {
                taxonomyGroups.set(taxonomyName, []);
            }
            taxonomyGroups.get(taxonomyName).push({ item, taxDetail });
        }
    });
    
    // Append to main report div
    const main_report_div = document.getElementById("main_report_div");
    if (main_report_div) {
        main_report_div.appendChild(title_missing_species);
        
        // Create a separate table for each taxonomy group
        taxonomyGroups.forEach((speciesInGroup, taxonomyName) => {
            // Create taxonomy group header
            const groupHeader = document.createElement("h3");
            groupHeader.innerHTML = taxonomyName;
            main_report_div.appendChild(groupHeader);
            
            // Create table for this taxonomy group
            const table_group = document.createElement("table");
            table_group.className = "table_missing_species_family";
            
            // Add table header
            table_group.appendChild(createThead([createTr(
                ['observation', 'scientific name', 'last seen', 'observer', 'comment' ]
            )]));
            
            // Add species rows
            speciesInGroup.forEach(({ item, taxDetail }) => {
                const obs = item.lastObservation;
                
                // Get observation details
                let image_tag = '';
                if(obs.image_url && obs.image_url !== '') {
                    image_tag = `<a href='${obs.url}'><img src='${obs.image_url}' alt='image' width='100'></a>`;
                }
                
                let date = obs.time.toISOString().split('T')[0];
                let observer = '@' + obs.user_id;
                
                // Species row
                const tdFields = [
                    image_tag,
                    obs.lat_name,
                    date,
                    observer,
                    obs.is_research ? '' : 'to be confirmed'
                ];
                
                table_group.appendChild(createTr(tdFields));
            });
            
            main_report_div.appendChild(table_group);
        });
    }
}
