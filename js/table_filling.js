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
