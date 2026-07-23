function getCardTdSummary( card )
{
    let name = card.name;
    let lat_name = document.createElement("span");

    lat_name.addEventListener("click", (event) => {
        generateSpeciesStatDetail( card );
    });

    lat_name.innerHTML = card.lat_name;
    let total    = card.total_observed;
    let research = card.total_research;

    let ssps_text = '';
    if( card.ssps.size > 0 )
    {
        card.ssps.forEach( (num, ssp) => 
        {
            ssps_text += ssp + ' - ' + num + '<br/>';
        });
    }

    let div = document.createElement("div");
    div.setAttribute('class','freq');

    let monthLetter = ['J','F','M','A','M','J','J','A','S','O','N','D'];
    let maxMonth = Math.max(...card.total_by_month);

    for(let i=0; i<12; i++)
    {
        let span = document.createElement("span");
        span.style.opacity = card.total_by_month[i]/maxMonth;
        span.innerHTML = monthLetter[i];
        div.appendChild( span );
    }

    return [name, lat_name, total, research, ssps_text, div];
}

function getObsTdSummary( obs, showUploadTime )
{
    if(typeof showUploadTime=== "undefined") showUploadTime=false;

    if(typeof obs !== "undefined")
    {
        let url  = obs.url;
        let href = `<a href='${url}'>link</a>`;
        let user = obs.user_id;
        let time = (showUploadTime)?obs.upload_time:obs.time;
        let date = time.getFullYear()+'-'+(time.getMonth()+1)+'-'+time.getDate();
        return [date,href,user];
    }
    else
    {
        return ['none','',''];
    }
}

function getTaxIdFromName(lat_name, taxLatNameMapCache)
{
    if(!taxLatNameMapCache.has(lat_name)) return;

    const inat_cards = taxLatNameMapCache.get(lat_name);

    let main_inat_card;
    let lowest_rank_card = inat_cards[0];

    for(let j=0; j<inat_cards.length; j++)
    {
        if(inat_cards[j].rank_level < lowest_rank_card.rank_level)
        {
            lowest_rank_card = inat_cards[j];
        }

        // assuming that they are sorted from higher to lower observations,
        // which makes first found - most likely to be the main one
        if(inat_cards[j].rank_level <= 10)
        {
            main_inat_card = inat_cards[j];    
            break;
        }
    }

    if(typeof main_inat_card === "undefined") main_inat_card = lowest_rank_card;        

    return main_inat_card.id;
}

function getTaxDetailsFromId(tax_id, fill_ancestor_details, taxIdMapCache)
{
    if(typeof tax_id == 'string') tax_id = Number(tax_id);

    if(!taxIdMapCache.has(tax_id)) return;
    
    const main_inat_card = taxIdMapCache.get(tax_id);

    /* ranks are: 70 (kingdom), 60 (phylum), 50 (class), 40 (order), 30 (family), 20 (genus), 10 (species), 5 (subspecies) */

    let en_name = '';
    let ru_name = '';

    if(main_inat_card.locale == 'en' && main_inat_card.preferred_common_name)
    {
        en_name = main_inat_card.preferred_common_name;
    }
    else if(typeof main_inat_card.english_common_name !== "undefined")
    {
        en_name = main_inat_card.english_common_name;
    }
    else if(main_inat_card.rank_level > 10 && main_inat_card.preferred_common_name)
    {
        // branch for old chached data
        en_name = main_inat_card.preferred_common_name;
    }

    if(main_inat_card.locale === 'ru' && main_inat_card.preferred_common_name)
    {
        ru_name = main_inat_card.preferred_common_name;
    }
    else if(main_inat_card.rank_level <= 10 && main_inat_card.preferred_common_name)
    {
        // branch for old chached data
        ru_name = main_inat_card.preferred_common_name;
    }

    const tax_details = {
        id: tax_id,
        rank: main_inat_card.rank,
        rank_level: main_inat_card.rank_level,
        lat_name: main_inat_card.name,
        en_name: en_name,
        ru_name: ru_name,
        inat_tax_url: 'https://www.inaturalist.org/taxa/' + main_inat_card.id,
        observations_count: main_inat_card.observations_count,
        ancestor_details:
        {
            kingdom: { lat_name: null, id: null }, 
            phylum: { lat_name: null, id: null }, 
            class: { lat_name: null, id: null }, 
            order: { lat_name: null, id: null }, 
            family: { lat_name: null, id: null }, 
            genus: { lat_name: null, id: null }, 
            species: { lat_name: null, id: null }, 
            subspecies: { lat_name: null, id: null }, 
        },
        all_ancestors_found: false,
    };

    if(!fill_ancestor_details) return tax_details;

    const all_ids = [...main_inat_card.ancestor_ids, tax_id];

    let everything_found = true;
    
    all_ids.ancestor_ids.forEach((ancestor_id) =>
    {
        if(taxIdMapCache.has(ancestor_id))
        {
            const ancestor_card = taxIdMapCache.get(ancestor_id);

            if(ancestor_card.rank_level == 70) tax_details.ancestor_details.kingdom = { lat_name: ancestor_card.name, id: ancestor_card.id };
            if(ancestor_card.rank_level == 50) tax_details.ancestor_details.phylum = { lat_name: ancestor_card.name, id: ancestor_card.id };
            if(ancestor_card.rank_level == 40) tax_details.ancestor_details.class = { lat_name: ancestor_card.name, id: ancestor_card.id };
            if(ancestor_card.rank_level == 30) tax_details.ancestor_details.order = { lat_name: ancestor_card.name, id: ancestor_card.id };
            if(ancestor_card.rank_level == 20) tax_details.ancestor_details.family = { lat_name: ancestor_card.name, id: ancestor_card.id };
            if(ancestor_card.rank_level == 10) tax_details.ancestor_details.species = { lat_name: ancestor_card.name, id: ancestor_card.id };
            if(ancestor_card.rank_level == 5)  tax_details.ancestor_details.subspecies = { lat_name: ancestor_card.name, id: ancestor_card.id };
        }
        else
        {
            everything_found = false;
        }
    } );

    tax_details.all_ancestors_found = everything_found;

    return tax_details;
}

function fillTaxSpans(tax_details, taxSpans)
{
    if(typeof tax_details === "undefined") return;

    function ifNotNull(value) { return (typeof value !== "undefined" && value !== null) ? value : ''; }

    taxSpans[0].innerHTML = ifNotNull(tax_details.ancestor_details.kingdom.lat_name);
    taxSpans[1].innerHTML = ifNotNull(tax_details.ancestor_details.class.lat_name);
    taxSpans[2].innerHTML = ifNotNull(tax_details.ancestor_details.order.lat_name);
    taxSpans[3].innerHTML = ifNotNull(tax_details.ancestor_details.family.lat_name);

    // that is species or lower latin name
    taxSpans[4].innerHTML = (tax_details.rank_level <= 10) ? tax_details.lat_name : '';
    taxSpans[5].innerHTML = tax_details.en_name;
    taxSpans[6].innerHTML = tax_details.ru_name;
    taxSpans[7].innerHTML = `<a href="${tax_details.inat_tax_url}">${tax_details.id}</a>`;
    taxSpans[8].innerHTML = tax_details.observations_count;
    
    if(typeof taxSpans[9] !== "undefined") taxSpans[9].innerHTML = tax_details.rank + ' (' + tax_details.rank_level + ')';

    return tax_details;
}

////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////

function fillAncestorTaxDetails(main_inat_card, taxDetail, taxIdMapCache)
{
    let query_ids = '';

    if(main_inat_card.rank == 'kingdom') taxDetail[0].innerHTML = main_inat_card.name;
    if(main_inat_card.rank == 'class')   taxDetail[1].innerHTML = main_inat_card.name;
    if(main_inat_card.rank == 'order')   taxDetail[2].innerHTML = main_inat_card.name;
    if(main_inat_card.rank == 'family')  taxDetail[3].innerHTML = main_inat_card.name;

    main_inat_card.ancestor_ids.forEach((ancestor_id) =>
    {
        if(taxIdMapCache.has(ancestor_id))
        {
            let ancestor_card = taxIdMapCache.get(ancestor_id);

            if(ancestor_card.rank == 'kingdom') taxDetail[0].innerHTML = ancestor_card.name;
            if(ancestor_card.rank == 'class')   taxDetail[1].innerHTML = ancestor_card.name;
            if(ancestor_card.rank == 'order')   taxDetail[2].innerHTML = ancestor_card.name;
            if(ancestor_card.rank == 'family')  taxDetail[3].innerHTML = ancestor_card.name;
        }
    } );

    let everything_found =
        (taxDetail[0].innerHTML.length > 0 || main_inat_card.rank_level >= 70) &&
        (taxDetail[1].innerHTML.length > 0 || main_inat_card.rank_level >= 50) &&
        (taxDetail[2].innerHTML.length > 0 || main_inat_card.rank_level >= 40) &&
        (taxDetail[3].innerHTML.length > 0 || main_inat_card.rank_level >= 30) &&
        true;

    return everything_found;
}

function fillMainTaxDetails(lat_name, taxDetail, taxLatNameMapCache, taxIdMapCache)
{
    const tax_id = getTaxIdFromName(lat_name, taxLatNameMapCache);
    if(typeof tax_id === "undefined") return;

    const tax_details = getTaxDetailsFromId(tax_id, false, taxIdMapCache);
    if(typeof tax_details === "undefined") return;

    fillTaxSpans(tax_details, taxSpans);

    return tax_details.inat_card;
}

function fillMainTaxDetailsEx(lat_name, tax_id, taxDetail, taxLatNameMapCache, taxIdMapCache)
{
    const tax_details = getTaxDetailsFromId(tax_id, false, taxIdMapCache);
    if(typeof tax_details === "undefined") return;

    fillTaxSpans(tax_details, taxDetail);

    return tax_details.inat_card;
}

////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////

function taxIdMap2taxLatNameMap(taxIdMapCache)
{
    let taxLatNameMapCache = new Map();
    taxIdMapCache.forEach( (id_entry, id) =>
    {
        let named_entries = [];
        if( taxLatNameMapCache.has( id_entry.name ) )
        {
            named_entries = taxLatNameMapCache.get( id_entry.name );
        }

        named_entries.push( id_entry );
        taxLatNameMapCache.set( id_entry.name, named_entries )
    } );

    return taxLatNameMapCache;
}

function updateTaxLatNameMapCache(taxLatNameMapCache, inat_tax_card)
{
    const lat_name = inat_tax_card.name;
    
    let named_entries = [];

    if( taxLatNameMapCache.has( lat_name ) )
    {
        named_entries = taxLatNameMapCache.get( lat_name );
    }

    const same_card_idx = named_entries.findIndex(card => card.id == inat_tax_card.id);
    if(same_card_idx != -1)
    {
        named_entries[same_card_idx] = inat_tax_card;
    }
    else
    {
        named_entries.push( inat_tax_card );
    }

    taxLatNameMapCache.set( lat_name, named_entries );
}
