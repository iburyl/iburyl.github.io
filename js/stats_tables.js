function generateArrivalStatsTable( speciesMap )
{
    var knownYearsUnsorted = new Set();

    speciesMap.forEach( (card, key) =>
    {
        card.observations.forEach( (obs) =>
        {
            let year = obs.time.getFullYear();
            if(year>2012) knownYearsUnsorted.add( year );

        });
    } );

    const knownYears = new Set([...knownYearsUnsorted].sort());

    const table_years = document.getElementById("table_years");
    table_years.innerHTML = '';

    table_years.appendChild(createTr(['latin', 'common', ...knownYears]));

    speciesMap.forEach( (card, key) =>
    {
        let yearsMap = new Map();

        card.observations.forEach( (obs) =>
        {
            let year = obs.time.getFullYear();

            let first_january = new Date(year, 0, 1);

            let delta = (obs.time - first_january) / (1000 * 60 * 60 * 24);

            if( !yearsMap.has(year) )
            {
                let stat_card = { observations_number: 1, arrival: delta, departure: delta };
                yearsMap.set(year, stat_card);
            }
            else
            {
                let stat_card = yearsMap.get(year);
                stat_card.observations_number++;

                stat_card.arrival   = Math.min(stat_card.arrival,   delta);
                stat_card.departure = Math.max(stat_card.departure, delta);
            }
        });

        let cols = [];
        
        knownYears.forEach( (year) =>
        {
            if( yearsMap.has(year) )
            {
                stat_card = yearsMap.get(year);

                if( stat_card.observations_number > 10 )
                {
                    let value = '';
                    if(stat_card.arrival < 30) value += 'J';
                    if(stat_card.departure > 365-30) value += 'D';
                    if(value == '')
                    {
                        value = Math.trunc(stat_card.arrival)+' - '+Math.trunc(stat_card.departure);
                    }
                    cols.push(value);
                }
                else
                {
                    //cols.push('('+Math.trunc(stat_card.arrival)+')');
                    cols.push('-');
                }
            }
            else
            {
                cols.push('.');
            }
        } );

        table_years.appendChild(createTr([card.lat_name, card.name, ...cols]));
    } );


}
