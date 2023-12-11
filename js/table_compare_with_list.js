function generateSpeciesSummaryTable( speciesMap, compareSpeciesMap, monthsFilter )
{
    speciesMap.forEach((card) =>
    {
        if(monthsFilter!= -1)
        {
            card.observations = card.observations.filter((obs) => obs.time.getMonth() == monthsFilter);
            card.total_observed = card.observations.length;

            card.total_research = 0;
            card.observations.forEach((obs) => {if(obs.is_research) card.total_research++;})
        }
    });

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
