async function generateChecklistTable( speciesMap, checklistMap )
{
    let taxIdMapCache = await getTaxIdMapCache();
    let taxLatNameMapCache = taxIdMap2taxLatNameMap(taxIdMapCache);
    
    const table_years = document.getElementById("table_years");
    table_years.innerHTML = '';

    let download_array = [];

    table_years.appendChild(createTr(
               ['', ['colspan',8,'tax data'], ['colspan',4,'all years'],['colspan',3,'last observation']]));

    
    table_years.appendChild(createTr(
               ['#', 'class','order','family','checklist latin','iNats id', 'en','ru','iNats obs', 'obs', 'rsch','ssps','freq','year', 'ref', 'user']));

    download_array.push(['#', 'class','order','family','checklist latin','iNats id', 'en','ru','iNats obs', 'obs', 'rsch','ssps', 'year', 'ref', 'user']);
    
    let i = 1;
    checklistMap.forEach( (entry, lat_name) =>
    {
        let taxDetail = [getSpan(),getSpan(),getSpan(),getSpan(),getSpan(),getSpan(),getSpan(),getSpan(),getSpan()];

        let main_inat_card = fillMainTaxDetails(lat_name, taxDetail, taxLatNameMapCache, taxIdMapCache);

        if(typeof main_inat_card !== "undefined")
        {
            fillAncestorTaxDetails(main_inat_card, taxDetail, taxIdMapCache);
        }

        let taxDetailNamePrefix = [taxDetail[1], taxDetail[2], taxDetail[3]];
        let taxDetailNamePostfix = [taxDetail[7], taxDetail[5], taxDetail[6], taxDetail[8]];

        if( speciesMap.has( lat_name ) )
        {
            let card = speciesMap.get( lat_name );

            let cardSummary = getCardTdSummary( card );

            let tdFileds = [i, ...taxDetailNamePrefix, cardSummary[1], ...taxDetailNamePostfix, ...cardSummary.slice(2), ...getObsTdSummary( card.last_observed )];

            table_years.appendChild( createTr( tdFileds ) );

            download_array.push([...tdFileds.slice(0,12), ...tdFileds.slice(13)]);
        }
        else
        {
            let tdFileds = [i, ...taxDetailNamePrefix, lat_name, ...taxDetailNamePostfix, '','','','','','',''];

            table_years.appendChild( createTr( tdFileds, 'grey'  ) );

            download_array.push([...tdFileds.slice(0,12), ...tdFileds.slice(13)]);
        }

        i++;
    } );
    
    addSorting( table_years, 2 );

    return download_array;
}
