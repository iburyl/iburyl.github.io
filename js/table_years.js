function generateYearsTable( speciesMap, showUploadTime)
{
    if(typeof showUploadTime=== "undefined") showUploadTime=false;

    const speciesYearsMap = new Map();

    speciesMap.forEach( (card, key) =>
    {
        let year = card.first_observed.time.getFullYear();

        if( !speciesYearsMap.has(year) )
        {
            speciesYearsMap.set(year, []);
        }

        speciesYearsMap.get(year).push(card);
    } );

    const speciesYearsMapSorted = new Map([...speciesYearsMap].sort());

    {
        const table_years = document.getElementById("table_years");
        table_years.innerHTML = '';

        table_years.appendChild(createThead(
            [createTr(
                   [['rowspan',2,'year'], ['colspan',2,'number of species'], ['colspan',2,'names'], ['colspan',3,'all years'],
                    ['colspan',3,'first observation'],
                    ['colspan',3,'first research grade if different']]),
             createTr(
                   ['cumulative', 'this year', 'common', 'latin (clickable)', 'obs', 'rsch','ssps', 'date',
                    'ref', 'user', 'date', 'ref', 'user'])]));

        let cumulative = 0;
        speciesYearsMapSorted.forEach( (cards, year) =>
        {
            cumulative += cards.length;

            let first = true;

            cards.sort((a,b) => {if(a.first_observed.time > b.first_observed.time) return +1; else return -1;});

            cards.forEach( (card) => 
            {
                let tdFirstObserved = getObsTdSummary( card.first_observed, showUploadTime );
                let tdFirstResearch = getObsTdSummary( card.first_research, showUploadTime );
                if( tdFirstObserved[1] == tdFirstResearch[1] ) tdFirstResearch = ['&larr;','',''];

                let tdFileds = [...getCardTdSummary( card ).slice(0,-1), ...tdFirstObserved /*.splice(1)*/, ...tdFirstResearch ];
                
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
