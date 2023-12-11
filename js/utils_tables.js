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
        taxDetail[0].innerHTML.length > 0 &&
        taxDetail[1].innerHTML.length > 0 &&
        taxDetail[2].innerHTML.length > 0 &&
        taxDetail[3].innerHTML.length > 0 &&
        true;

    return everything_found;
}

function fillMainTaxDetails(lat_name, taxDetail, taxLatNameMapCache, taxIdMapCache)
{
    if(!taxLatNameMapCache.has(lat_name)) return;

    let inat_cards = taxLatNameMapCache.get(lat_name);

    let main_inat_card;
    for(let j=0; j<inat_cards.length; j++)
    {
        if(inat_cards[j].rank_level <= 10)
        {
            main_inat_card = inat_cards[j];

            break;
        }
    }

    if(typeof main_inat_card === "undefined") return;

    taxDetail[4].innerHTML = main_inat_card.name;
    if(typeof main_inat_card.english_common_name !== "undefined") taxDetail[5].innerHTML = main_inat_card.english_common_name;
    if(typeof main_inat_card.preferred_common_name !== "undefined") taxDetail[6].innerHTML = main_inat_card.preferred_common_name;
    taxDetail[7].innerHTML = '<a href="https://www.inaturalist.org/taxa/' + main_inat_card.id + '">' + main_inat_card.id + '</a>';
    taxDetail[8].innerHTML = main_inat_card.observations_count;

    return main_inat_card;
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
