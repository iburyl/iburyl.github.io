function getExactArrivalIndex(year, category, timeline, getDateIndex)
{
    if(typeof category.boxes === "undefined") return -2;

    let boxes = category.boxes.toSorted((a,b) => {if(a.left > b.left) return +1; else return -1;});

    let arrival_shift = (boxes[0].left + 366)%366;

    let firstGuess = new Date(year,0,1);
    firstGuess.setDate(firstGuess.getDate() + arrival_shift);

    let startSearchIdx = getDateIndex(firstGuess)-45;
    if(startSearchIdx < 0) return -1; // out of range

    for(let j=0; j<90; j++)
    {
        if( startSearchIdx + j == timeline.length) return -1; // out of range
        if( timeline[startSearchIdx + j] == 0 ) continue;
        if(j < 15) return -2; // noisy - unreliable result

        return startSearchIdx + j;
    }

    return -1;
}

function getExactDepatureIndex(year, category, timeline, getDateIndex, card)
{
    if(typeof category.boxes === "undefined") return -2;

    let boxes = category.boxes.toSorted((a,b) => {if(a.left > b.left) return +1; else return -1;});
    let lastBox = boxes[boxes.length-1];

    let arrival_shift = (boxes[0].left + 366)%366;

    let firstGuess = new Date(year,0,1);
    firstGuess.setDate(firstGuess.getDate() + arrival_shift);
    firstGuess.setDate(firstGuess.getDate() + (lastBox.right - boxes[0].left));

    let startSearchIdx = getDateIndex(firstGuess)-45;

    if(startSearchIdx < 0) return -1; // out of range

    let zeroDaysCount = -1;
    let searchDistance = 30*4;

    for(let i=0; i<searchDistance; i++)
    {
        if(startSearchIdx + i> timeline.length) return -1; // can be made better

        if( timeline[startSearchIdx + i] != 0 ) zeroDaysCount=0; else zeroDaysCount++;

        if(zeroDaysCount == 45 && zeroDaysCount != i)
        {
            return startSearchIdx + i - zeroDaysCount;
        }
    }

    if(zeroDaysCount+1 != searchDistance) return -2;

    for(let i=0; i<searchDistance; i++)
    {
        if(startSearchIdx - i < 0) return -1; // can be made better

        if( timeline[startSearchIdx - i] != 0 )
        {
            return startSearchIdx - i;
        }
    }

    return -2; // noisy - unreliable result
}

function generateMigrationStatsTable( speciesMap )
{
    const knownYears = [...getAllKnownYears( speciesMap, 2013 )];

    const table_migratory = document.getElementById("table_migratory");
    table_migratory.innerHTML = '';
    table_migratory.appendChild(createTr(['latin', 'common', 'observations', 'category', 'from', 'to', ...knownYears]));

    const table_passthrough = document.getElementById("table_passthrough");
    table_passthrough.innerHTML = '';
    table_passthrough.appendChild(createTr(['latin', 'common', 'observations', 'category', 'from', 'to', 'from', 'to', ...knownYears]));

    const table_allyear = document.getElementById("table_allyear");
    table_allyear.innerHTML = '';
    table_allyear.appendChild(createTr(['latin', 'common', 'observations', 'category', 'from', 'to']));

    const table_unknown = document.getElementById("table_unknown");
    table_unknown.innerHTML = '';
    table_unknown.appendChild(createTr(['latin', 'common', 'observations', 'category']));

    const firstYear = knownYears[0];
    const now = new Date();
    const beggining = new Date(Date.UTC(firstYear));
    const ticksPerDay = 1000 * 60 * 60 * 24;
    const lifetimeLength = Math.trunc((now-beggining)/ticksPerDay) + 1;
    const lifetimeYears = now.getFullYear() - firstYear + 1;

    function getDateIndex(date)
    {
        return Math.trunc((date - beggining)/ticksPerDay);
    }

    function getIndexDate(index)
    {
        let date = new Date(beggining);
        date.setDate(date.getDate() +  index);
        return date;
    }

    const Months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

    function getDayStringFromIndex(index)
    {
        let date = getIndexDate(index);
        return date.getDate()+' '+Months[date.getMonth()];
    }

    speciesMap.forEach( (card, key) =>
    {
        let timelineObs = Array(lifetimeLength).fill(0);
        let timeline = Array(lifetimeLength).fill(0);
        let years    = Array(lifetimeYears).fill(0);

        for(let i=0; i<timelineObs.length; i++) timelineObs[i] = [];
        
        card.observations.forEach( (obs) =>
        {
            if(obs.time > beggining)
            {
                let i = getDateIndex(obs.time);
                timeline[i]++;
                timelineObs[i].push(obs);

                years[obs.time.getFullYear()-firstYear]++;
            }
        });

        let category = getCategory( card );
        
        let arrivals  = Array(lifetimeYears);
        let depatures = Array(lifetimeYears);
        let firstObservations = Array(lifetimeYears);
        let lastObservations = Array(lifetimeYears);
        let comment  = Array(lifetimeYears).fill('-');
        
        for(let i=0; i<years.length; i++)
        {
            if(years[i] < 10) {comment[i] = '.'; continue}

            let jan1st = new Date(Date.UTC(i+firstYear));
            let yearStartIdx = getDateIndex(jan1st);

            let arrivalIdx = getExactArrivalIndex(firstYear+i, category, timeline, getDateIndex);
            if(arrivalIdx==-1) continue;

            if(arrivalIdx>=0)
            {
                arrivals[i] = getIndexDate(arrivalIdx);
                firstObservations[i] = timelineObs[arrivalIdx][0];
            }

            let depatureIdx = getExactDepatureIndex(firstYear+i, category, timeline, getDateIndex, card);

            if(depatureIdx > 0)
            {
                depatures[i] = getIndexDate(depatureIdx);
                lastObservations[i] = timelineObs[depatureIdx][0];
            }
        }

        let year_cols = [];

        for(let i=0; i<years.length; i++)
        {
            let text = '';
            let sort = 0;

            if(typeof arrivals[i] !== "undefined" )
            {
                sort = arrivals[i].valueOf();

                if(typeof firstObservations[i] !== "undefined")
                {
                    text += '<a href="'+ firstObservations[i].url +'">'+ arrivals[i].getDate() + ' ' + Months[arrivals[i].getMonth()] + '</a>';
                }
                else
                {
                    text += '~'+ arrivals[i].getDate() + ' ' + Months[arrivals[i].getMonth()];
                }
            }
            else text += '?';


            text += '<br>';

            if(typeof depatures[i] !== "undefined")
            {
                if(typeof lastObservations[i] !== "undefined")
                {
                    text += '<a href="'+ lastObservations[i].url +'">'+ depatures[i].getDate() + ' ' + Months[depatures[i].getMonth()] + '</a>';
                }
                else
                {
                    text += '~'+ depatures[i].getDate() + ' ' + Months[depatures[i].getMonth()];
                }
            }
            else text += '?';

            if(text != '?<br>?') year_cols.push(['data-sorting',sort,text]);
            else year_cols.push(comment[i]);
        }
        
        let span = document.createElement("span");

        span.addEventListener("click", (event) => {
            generateSpeciesStatDetail( card );
        });

        span.innerHTML = category.category;

        let main_cols = [card.lat_name, card.name, card.total_observed, span];

        if(category.category.startsWith('Seasonal')) table_migratory.appendChild(createTr([...main_cols,
            ['data-sorting',category.boxes[0].left,getDayStringFromDayShift(category.boxes[0].left)],
            ['data-sorting',category.boxes[0].right,getDayStringFromDayShift(category.boxes[0].right)],
            ...year_cols]));
        else if(category.category.startsWith('Passthrough'))
        {
            let boxes = [category.boxes[0],category.boxes[1]].sort((a,b)=>{if(a.left > b.left) return +1; else return -1;});

            table_passthrough.appendChild(createTr([...main_cols,
                ['data-sorting',boxes[0].left,getDayStringFromDayShift(boxes[0].left)],
                ['data-sorting',boxes[0].right,getDayStringFromDayShift(boxes[0].right)],
                ['data-sorting',boxes[1].left,getDayStringFromDayShift(boxes[1].left)],
                ['data-sorting',boxes[1].right,getDayStringFromDayShift(boxes[1].right)],
                ...year_cols]));
        }
        else if(category.category.startsWith('All year')) table_allyear.appendChild(createTr([...main_cols,
            ['data-sorting',category.boxes[0].left,getDayStringFromDayShift(category.boxes[0].left)],
            ['data-sorting',category.boxes[0].right,getDayStringFromDayShift(category.boxes[0].right)],
            ]));
        else table_unknown.appendChild(createTr(main_cols));
    } );

    addSorting( table_migratory, 1 );
    addSorting( table_passthrough, 1 );
    addSorting( table_allyear, 1 );
    addSorting( table_unknown, 1 );
}
