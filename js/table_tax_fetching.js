async function queryAncestors(main_inat_card, taxIdMapCache)
{
    let query_ids = '';

    main_inat_card.ancestor_ids.forEach((ancestor_id) =>
    {
        if(!taxIdMapCache.has(ancestor_id))
        {
            if(query_ids !== '')
            {
                query_ids += ',';
            }
            query_ids += ancestor_id;
        }
    } );

    if(query_ids === '') return;

    return fetchAsync('https://api.inaturalist.org/v1/taxa/'+query_ids).then(async (data) =>
    {
        console.log("Ancestors query done");

        let transaction = await startTaxIdMapCacheUpdate(taxIdMapCache);
        let promises = [];
        
        data.results.forEach((inat_tax_card) =>
        {
            promises.push( addCardToTaxIdMapCache(transaction, inat_tax_card) );
        });

        await Promise.all( promises );
        await finalizeTaxIdMapCacheUpdate(transaction);
    });
}

async function generateChecklistFetchingTable( checklistMap )
{
    const table_years = document.getElementById("table_years");
    table_years.innerHTML = '';

    let fetch = getSpan();
    fetch.innerHTML = 'fetch';

    table_years.appendChild(createTr(
               [['rowspan',2,'#'], 'name',['rowspan',2,fetch],['colspan',9,'iNats tax']]));

    table_years.appendChild(createTr(
               ['latin', 'kingdom','class','order','family','species','name','ru name','id','obs']));

    let taxIdMapCache = await getTaxIdMapCache();
    let taxLatNameMapCache = taxIdMap2taxLatNameMap(taxIdMapCache);

    let all_buttons = [];

    let i = 1;
    checklistMap.forEach( (entry, lat_name) =>
    {
        let button = document.createElement("span");
        all_buttons.push( button );

        let taxDetail = [getSpan(),getSpan(),getSpan(),getSpan(),getSpan(),getSpan(),getSpan(),getSpan(),getSpan()];

        let tdFileds = [i, "<a href='https://www.inaturalist.org/search?q="+lat_name.replace(' ','%20')+"'>"+lat_name+"</a>",button,...taxDetail];

        table_years.appendChild( createTr( tdFileds ) );

        i++;

        if(lat_name.split(' ').length < 2) return;

        if(!taxLatNameMapCache.has(lat_name))
        {
            button.innerHTML = 'click';
        }
        else
        {
            let main_inat_card = fillMainTaxDetails(lat_name, taxDetail, taxLatNameMapCache, taxIdMapCache);

            if(typeof main_inat_card != "undefined")
            {
                let found = fillAncestorTaxDetails(main_inat_card, taxDetail, taxIdMapCache);

                if(!found)
                {
                    button.innerHTML = 'click';
                }
            }
            else
            {
                button.innerHTML = 'click';
            }
        }
        
        button.addEventListener("click", (event) => {
            console.log("Fetching: " + lat_name);
            const params = new URLSearchParams({
                q: lat_name,
                is_active: true,
                order: 'desc',
                order_by: 'observations_count',
            });

            fetchAsync('https://api.inaturalist.org/v1/taxa?locale=ru&'+params.toString().replaceAll('+','%20')).then(async (data) =>
            {
                console.log("Main query done");
                let named_entries = [];

                let transaction = await startTaxIdMapCacheUpdate(taxIdMapCache);
                let promises = [];
                
                data.results.forEach((inat_tax_card) =>
                {
                    if( inat_tax_card.name == lat_name )
                    {
                        promises.push( addCardToTaxIdMapCache(transaction, inat_tax_card) );
                        
                        if( taxLatNameMapCache.has( lat_name ) )
                        {
                            named_entries = taxLatNameMapCache.get( lat_name );
                        }

                        named_entries.push( inat_tax_card );
                        taxLatNameMapCache.set( lat_name, named_entries );
                    }
                });

                await Promise.all( promises );

                await finalizeTaxIdMapCacheUpdate(transaction);

                let main_inat_card = fillMainTaxDetails(lat_name, taxDetail, taxLatNameMapCache, taxIdMapCache);

                if(typeof main_inat_card != "undefined")
                {
                    let found = fillAncestorTaxDetails(main_inat_card, taxDetail, taxIdMapCache);
                    if(!found)
                    {
                        await queryAncestors(main_inat_card, taxIdMapCache);
                        fillAncestorTaxDetails(main_inat_card, taxDetail, taxIdMapCache);
                    }
                }

                button.remove();
            });
        });
    } );

    fetch.addEventListener("click", (event) => {
        console.log('Clicking started...');
        let j=0;
        let intervalId;
        function clicker()
        {
            while( j < all_buttons.length && all_buttons[j].innerHTML != 'click' ) j++;
            if(j == all_buttons.length)
            {
                clearInterval(intervalId);
                console.log('Clicking finished');
                return;
            }
            if( all_buttons[j].innerHTML == 'click' )
            {
                console.log('Click...');
                all_buttons[j].click();
            }
            j++;
        }
        intervalId = setInterval(clicker, 2000);
    });
}
