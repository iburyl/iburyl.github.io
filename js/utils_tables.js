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

/**
 * ranks are: 70 (kingdom), 60 (phylum), 50 (class), 40 (order), 30 (family), 20 (genus), 10 (species), 5 (subspecies)
 */

    let everything_found =
        (taxDetail[0].innerHTML.length > 0 || main_inat_card.rank_level >= 70) &&
        (taxDetail[1].innerHTML.length > 0 || main_inat_card.rank_level >= 50) &&
        (taxDetail[2].innerHTML.length > 0 || main_inat_card.rank_level >= 40) &&
        (taxDetail[3].innerHTML.length > 0 || main_inat_card.rank_level >= 30) &&
        true;

    return everything_found;
}

function fillMainTaxDetailsEx(lat_name, known_tax_id, taxDetail, taxLatNameMapCache, taxIdMapCache)
{
    if(typeof known_tax_id == 'string') known_tax_id = Number(known_tax_id);

    let main_inat_card;

    if(known_tax_id && taxIdMapCache.has(known_tax_id))
    {
        const inat_card_by_id = taxIdMapCache.get(known_tax_id);
        if(inat_card_by_id.name == lat_name)
        {
            main_inat_card = inat_card_by_id;
        }
    }

    if(typeof main_inat_card === "undefined")
    {
        if(!taxLatNameMapCache.has(lat_name)) return;

        const inat_cards = taxLatNameMapCache.get(lat_name);

        let lowest_rank_card = inat_cards[0];

        for(let j=0; j<inat_cards.length; j++)
        {
            if(inat_cards[j].rank_level < lowest_rank_card.rank_level)
            {
                lowest_rank_card = inat_cards[j];
            }

            if(inat_cards[j].rank_level <= 10)
            {
                main_inat_card = inat_cards[j];
    
                break;
            }
        }

        if(typeof main_inat_card === "undefined") main_inat_card = lowest_rank_card;
    }

    if(typeof main_inat_card === "undefined") return;

/**
 * ranks are: 70 (kingdom), 60 (phylum), 50 (class), 40 (order), 30 (family), 20 (genus), 10 (species), 5 (subspecies)
 */

    let en_name ='';
    let ru_name ='';

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

    taxDetail[4].innerHTML = (main_inat_card.rank_level <= 10) ? main_inat_card.name : '';
    taxDetail[5].innerHTML = en_name;
    taxDetail[6].innerHTML = ru_name;
    taxDetail[7].innerHTML = '<a href="https://www.inaturalist.org/taxa/' + main_inat_card.id + '">' + main_inat_card.id + '</a>';
    taxDetail[8].innerHTML = main_inat_card.observations_count;
    
    if(typeof taxDetail[9] !== "undefined") taxDetail[9].innerHTML = main_inat_card.rank + ' (' + main_inat_card.rank_level + ')';

    return main_inat_card;
}


function fillMainTaxDetails(lat_name, taxDetail, taxLatNameMapCache, taxIdMapCache)
{
    let undefined;
    return fillMainTaxDetailsEx(lat_name, undefined, taxDetail, taxLatNameMapCache, taxIdMapCache);
}

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
