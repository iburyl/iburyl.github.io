function createTr(tdArray, trClass) {
  let tr = document.createElement("tr");

  if(typeof trClass !== "undefined")
  {
    tr.setAttribute('class', trClass);
  }

  for (var i = 0; i < tdArray.length; i++) {
      let td = document.createElement("td");
      
      if( tdArray[i] instanceof HTMLElement )
      {
          td.appendChild( tdArray[i] );
      }
      else if( Array.isArray(tdArray[i]) )
      {
          td.setAttribute(tdArray[i][0], tdArray[i][1]);
          td.innerHTML = tdArray[i][2];
      }
      else
      {
          td.innerHTML = tdArray[i];
      }
      
      tr.appendChild( td );
  }

  return tr;
}

function getCardTdSummary( card )
{
    let name = card.name;
    let lat_name = document.createElement("span");

    lat_name.addEventListener("click", (event) => {
        generateSpeciesDetail( card );
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

function getObsTdSummary( obs )
{
    if(typeof obs !== "undefined")
    {
    
        let url  = obs.url;
        let href = `<a href='${url}'>link</a>`;
        let user = obs.user_id;
        let year = obs.time.getFullYear();
        return [year,href,user];
    }
    else
    {
        return ['none','',''];
    }
}

function generateYearsTable( speciesMap )
{
    const speciesYearsMap = new Map();

    speciesMap.forEach( (value, key) =>
    {
        const card = value;
        let year = card.first_observed.time.getFullYear();

        if( !speciesYearsMap.has(year) )
        {
            speciesYearsMap.set(year, []);
        }

        speciesYearsMap.get(year).push(value);
    } );

    const speciesYearsMapSorted = new Map([...speciesYearsMap].sort());

    {
        const instruction = document.getElementById("instruction");
        instruction.innerHTML = '';
        const table_years = document.getElementById("table_years");
        table_years.innerHTML = '';

        table_years.appendChild(createTr(
                   [['rowspan',2,'year'], ['colspan',2,'number of species'], ['colspan',2,'names'], ['colspan',4,'all years'],
                    ['colspan',2,'first observation'],
                    ['colspan',3,'first research grade if different']]));

        table_years.appendChild(createTr(
                   ['cumulative', 'this year', 'common', 'latin (clickable)', 'obs', 'rsch','ssps', 'freq',
                    'ref', 'user', 'year', 'ref', 'user']));

        let cumulative = 0;
        speciesYearsMapSorted.forEach( (cards, year) =>
        {
            cumulative += cards.length;

            let first = true;

            cards.forEach( (card) => 
            {
                let tdFirstObserved = getObsTdSummary( card.first_observed );
                let tdFirstResearch = getObsTdSummary( card.first_research );
                if( tdFirstObserved[1] == tdFirstResearch[1] ) tdFirstResearch = ['&larr;','',''];

                let tdFileds = [...getCardTdSummary( card ), ...tdFirstObserved.splice(1), ...tdFirstResearch ];
                
                if(first)
                {
                    let prefixTdFiled = [['rowspan',cards.length, year], ['rowspan', cards.length, cumulative], ['rowspan', cards.length, cards.length]];
                    tdFileds = prefixTdFiled.concat(tdFileds);
                }

                table_years.appendChild( createTr( tdFileds ) );
                
                first = false;
            } );
        } );
    }
}

function generateSpeciesSummaryTable( speciesMap, compareSpeciesMap )
{
    const speciesMapSorted = new Map([...speciesMap].sort((a, b) => {
        if( a[1].total_observed > b[1].total_observed ) return -1;
        if( a[1].total_observed < b[1].total_observed ) return  1;
        return 0;
    }));

    const compareSpeciesMapSorted = new Map([...compareSpeciesMap].sort((a, b) => {
        if( a[1].total_observed > b[1].total_observed ) return -1;
        if( a[1].total_observed < b[1].total_observed ) return  1;
        return 0;
    }));

    {
        const instruction = document.getElementById("instruction");
        instruction.innerHTML = '';
        const table_years = document.getElementById("table_years");
        table_years.innerHTML = '';

        table_years.appendChild(createTr(
                   [['rowspan',2,'#'], ['colspan',2,'names'], ['colspan',4,'all years'],
                    ['colspan',3,'last observation'],
                    ['colspan',4,'last observation in compared list']
                    
                    ]));

        table_years.appendChild(createTr(
                   ['common', 'latin (clickable)', 'obs', 'rsch','ssps','freq',
                    'year', 'ref', 'user', 'all', 'year', 'ref', 'user']));

        
        let i = 1;
        speciesMapSorted.forEach( (card, key) =>
        {
            let tdFileds = [i, ...getCardTdSummary( card ), ...getObsTdSummary( card.last_observed )];
            
            if( compareSpeciesMapSorted.has( card.lat_name ) )
            {
                let alt_card = compareSpeciesMapSorted.get( card.lat_name );
                tdFileds.push(alt_card.total_observed, ...getObsTdSummary( alt_card.last_observed ));

                compareSpeciesMapSorted.delete( card.lat_name )
            
                table_years.appendChild( createTr( tdFileds ) );
            }
            else
            {
                tdFileds.push('','','','');

                table_years.appendChild( createTr( tdFileds, 'grey' ) );
            }

            i++;
        } );

        i = 1;
        compareSpeciesMapSorted.forEach( (card, key) =>
        {
            let tdFileds = [i, ...getCardTdSummary( card ).slice(0,-4), ['colspan',7,'none'],card.total_observed, ...getObsTdSummary( card.last_observed )];
            
            table_years.appendChild( createTr( tdFileds ) );

            i++;
        } );
    }
}

function generateChecklistTable( speciesMap, checklistMap )
{
    {
        const instruction = document.getElementById("instruction");
        instruction.innerHTML = '';
        const table_years = document.getElementById("table_years");
        table_years.innerHTML = '';

        table_years.appendChild(createTr(
                   [['rowspan',2,'#'], ['colspan',2,'names'], ['colspan',4,'all years'],['colspan',3,'last observation']]));

        table_years.appendChild(createTr(
                   ['common', 'latin (clickable)', 'obs', 'rsch','ssps','freq'],'year', 'ref', 'user'));

        
        let i = 1;
        checklistMap.forEach( (entry, lat_name) =>
        {
            if( speciesMap.has( lat_name ) )
            {
                let card = speciesMap.get( lat_name );

                let tdFileds = [i, ...getCardTdSummary( card ), ...getObsTdSummary( card.last_observed )];

                table_years.appendChild( createTr( tdFileds ) );
            }
            else
            {
                let tdFileds = [i, entry.name, "<a href='https://www.inaturalist.org/search?q="+lat_name.replace(' ','%20')+"'>"+lat_name+"</a>", '','','','','','',''];

                table_years.appendChild( createTr( tdFileds, 'grey'  ) );
            }

            i++;
        } );
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

function fillMainTaxDetails(inat_cards, taxDetail, taxIdMapCache)
{
    let main_inat_card;

    for(let j=0; j<inat_cards.length; j++)
    {
        if(inat_cards[j].rank == 'species')
        {
            main_inat_card = inat_cards[j];

            break;
        }
    }

    if(typeof main_inat_card === "undefined") return;

    taxDetail[4].innerHTML = main_inat_card.name;
    if(typeof main_inat_card.preferred_common_name !== "undefined") taxDetail[5].innerHTML = main_inat_card.preferred_common_name;
    taxDetail[6].innerHTML = main_inat_card.id;

    return main_inat_card;
}

async function generateChecklistForTaxTable( checklistMap )
{
    const instruction = document.getElementById("instruction");
    instruction.innerHTML = '';
    const table_years = document.getElementById("table_years");
    table_years.innerHTML = '';

    table_years.appendChild(createTr(
               [['rowspan',2,'#'], ['colspan',2,'names'],['rowspan',2,'fetch item'],['colspan',7,'iNats tax']]));

    table_years.appendChild(createTr(
               ['common', 'latin', 'kingdom','class','order','family','species','name','id']));

    let taxIdMapCache = await getTaxIdMapCache();

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

    let i = 1;
    checklistMap.forEach( (entry, lat_name) =>
    {
        let button = document.createElement("span");

        function getSpan() {return document.createElement("span");}
        
        let taxDetail = [getSpan(),getSpan(),getSpan(),getSpan(),getSpan(),getSpan(),getSpan()];

        let tdFileds = [i, entry.name, "<a href='https://www.inaturalist.org/search?q="+lat_name.replace(' ','%20')+"'>"+lat_name+"</a>",button,...taxDetail];

        table_years.appendChild( createTr( tdFileds ) );

        i++;

        if(lat_name.split(' ').length < 2) return;

        if(!taxLatNameMapCache.has(lat_name))
        {
            button.innerHTML = 'click';
        }
        else
        {
            let inat_cards = taxLatNameMapCache.get(lat_name);

            let main_inat_card = fillMainTaxDetails(inat_cards, taxDetail, taxIdMapCache);

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
            const params = new URLSearchParams({
                q: lat_name,
                is_active: true,
                order: 'desc',
                order_by: 'observations_count',
            });

            fetchAsync('https://api.inaturalist.org/v1/taxa?'+params.toString().replaceAll('+','%20')).then(async (data) =>
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

                let main_inat_card = fillMainTaxDetails(named_entries, taxDetail, taxIdMapCache);

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
}
