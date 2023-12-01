function getDaysFrom1Jan(time)
{
    let year = time.getFullYear();
    let first_january = new Date(year, 0, 1);
    let delta = (time - first_january) / (1000 * 60 * 60 * 24);
    return delta;
}

function getEventsInFrameArray( events, frameSize )
{
    let eventNumInFrame = Array(365).fill(0);

    let sortedEvents = events.toSorted( (a, b) =>
    {
        let deltaA = getDaysFrom1Jan(a.time);
        let deltaB = getDaysFrom1Jan(b.time);
        if(deltaA>deltaB) return  1;
        if(deltaA<deltaB) return -1;
        return 0;
    });

    let j=0;
    for(let i=0; i<365; i++)
    {
        while(j<sortedEvents.length && getDaysFrom1Jan(sortedEvents[j].time)<i) j++;
        if(j == sortedEvents.length) break;

        let k=j;
        while(k<sortedEvents.length && getDaysFrom1Jan(sortedEvents[k].time)<i+frameSize) k++;
        if(k==sortedEvents.length)
        {
            while(k<2*sortedEvents.length && getDaysFrom1Jan(sortedEvents[k-sortedEvents.length].time)+365<i+frameSize) k++;
        }

        eventNumInFrame[i] = k-j;
    }

    let max = Math.max(...eventNumInFrame);

    return eventNumInFrame.map((el) => el/max);
}

function generateSpeciesStatDetail( card, speciesMap )
{
    let frame = 3*7;

    let obsNumInNextWeek = getEventsInFrameArray( card.observations, frame );

    let obsNumInNextWeekNormalized = [];

    const detail_div = document.getElementById("detail_div");
    detail_div.innerHTML = card.name + ' (' + card.lat_name + ')';

    let deltaGraphCanvas = document.createElement("canvas");
    detail_div.appendChild( deltaGraphCanvas );

    let scattered_data = []; //obsNumInNextWeek.map( (el) => { i++; return {x:i, y:el}; } );
    for(let i = 0; i<obsNumInNextWeek.length; i++)
    {
        scattered_data[i] = {x:i, y:obsNumInNextWeek[ Math.trunc(365 + i - frame/2)%365 ]};
    }

    let i = 0;
    let scattered_data1 = getEventsInFrameArray( card.observations, 1 ).map( (el) => { i++; return {x:i, y:el}; } );

    new Chart(deltaGraphCanvas, {
        type: 'scatter',
        data: {
          datasets: [{
            label: '#',
            data: scattered_data,
            borderWidth: 3,
            pointStyle : false,
            showLine: true,

          },{
            label: '#',
            data: scattered_data1,
            borderWidth: 1,
            pointStyle : false,
            showLine: true,

          }]
        },
        options: {
          scales: {
            x: {
                max: 365,
                ticks: {
                    /*
                    callback: function(label, index, labels) {
                        return '1';
                    },
                    */
                     stepSize: 30
                 },
            }
          },
        }
      });
}

function getKnownYears( speciesMap, startingFrom )
{
    var knownYearsUnsorted = new Set();

    speciesMap.forEach( (card, key) =>
    {
        card.observations.forEach( (obs) =>
        {
            let year = obs.time.getFullYear();
            if(year>=startingFrom) knownYearsUnsorted.add( year );

        });
    } );

    const knownYears = new Set([...knownYearsUnsorted].sort());
    return knownYears;
}

function countObservationsPerMonth( observations )
{
    let months = Array(12).fill(0);

    observations.forEach((obs) =>
    {
        months[obs.time.getMonth()]++;
    });

    return months;
}

function getCategory( observations )
{
    if( observations.length < 50 )
    {
        return {category:'.', monthsPresent:'.', fromText:'.', toText:'.'};
    }

    let totalPerMonth = countObservationsPerMonth( observations );
    let total = 0;
    totalPerMonth.forEach( (monthObs) => { total+=monthObs; } )

    let maxMonth=0;
    let maxMonthIdx=0;
    for(let i=0; i<totalPerMonth.length; i++)
    {
        if(totalPerMonth[i]>maxMonth)
        {
            maxMonth=totalPerMonth[i];
            maxMonthIdx=i;
        }
    }

    let rangeTotal=maxMonth;
    let leftIndex=maxMonthIdx;
    let rightIndex=maxMonthIdx;

    const targetTotal = total*0.95;

    while( rangeTotal < targetTotal )
    {
        let earlierIndex = (12 + leftIndex - 1)%12;
        let laterIndex   = (rightIndex + 1)%12;

        let earlierValue = totalPerMonth[earlierIndex];
        let laterValue = totalPerMonth[laterIndex];

        let earlierDelta = maxMonthIdx-leftIndex;
        let laterDelta = rightIndex-maxMonthIdx;

        if(earlierValue > laterValue)
        {
            rangeTotal += earlierValue;
            leftIndex--;
        }
        else if(earlierValue < laterValue)
        {
            rangeTotal += laterValue;
            rightIndex++;
        } else if(earlierDelta > laterDelta)
        {
            rangeTotal += laterValue;
            rightIndex++;
        } else
        {
            rangeTotal += earlierValue;
            leftIndex--;
        }
    }

    // trim range
    while(1)
    {
        let leftCorrectedIndex = (12 + leftIndex)%12;
        let rightCorrectedIndex = (rightIndex)%12;

        let leftValue = totalPerMonth[leftCorrectedIndex];
        let rightValue = totalPerMonth[rightCorrectedIndex];

        if(leftValue > rightValue)
        {
            if(rangeTotal - rightValue > targetTotal)
            {
                rangeTotal -= rightValue;
                rightIndex--;
            }
            else
            {
                break;
            }
        }
        else
        {
            if(rangeTotal - leftValue > targetTotal)
            {
                rangeTotal -= leftValue;
                leftIndex++;
            }
            else
            {
                break;
            }
        }
    }

    const Months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

    let category = '.';
    if( rightIndex-leftIndex > 8 )
    {
        category = 'All year';
    }
    else
    {
        category = 'Migratory';
    }

    return {category:category, monthsPresent:rightIndex-leftIndex, from: (12+leftIndex)%12, to: (rightIndex)%12, fromText: Months[(12+leftIndex)%12], toText: Months[(rightIndex)%12]};
}

function generateMigrationStatsTable( speciesMap )
{
    const knownYears = [...getKnownYears( speciesMap, 2013 )];

    const table_migratory = document.getElementById("table_migratory");
    table_migratory.innerHTML = '';
    table_migratory.appendChild(createTr(['latin', 'common', 'observations', 'category', 'months present', 'from', 'to', ...knownYears]));

    const table_allyear = document.getElementById("table_allyear");
    table_allyear.innerHTML = '';
    table_allyear.appendChild(createTr(['latin', 'common', 'observations', 'category', 'months<br>with most<br>observations', 'from', 'to']));

    const table_unknown = document.getElementById("table_unknown");
    table_unknown.innerHTML = '';
    table_unknown.appendChild(createTr(['latin', 'common', 'observations']));

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

        let category = getCategory( card.observations );

        let arrivals = Array(lifetimeYears).fill(-500);
        let firstObservations = Array(lifetimeYears);
        let comment  = Array(lifetimeYears).fill('-');
        
        for(let i=0; i<years.length; i++)
        {
            if(years[i] < 10) {comment[i] = '.'; continue}

            let jan1st = new Date(Date.UTC(i+firstYear));
            let yearStartIdx = getDateIndex(jan1st);

            let firstGuess = new Date(i+firstYear, category.from, 1);
            let startSearch = new Date(firstGuess - 45 * ticksPerDay);
            let startSearchIdx = getDateIndex(startSearch);
            if(startSearchIdx < 0) continue;

            for(let j=0; j<90; j++)
            {
                if( timeline[startSearchIdx + j] == 0 ) continue;
                if(j < 15) {comment[i] = 'noisy'; break}

                let days = (startSearchIdx+j)-yearStartIdx;

                let date = new Date(jan1st);
                date.setDate(date.getDate() +  days);
                arrivals[i] = date;
                firstObservations[i] = timelineObs[startSearchIdx + j][0];

                break;
            }
        }

        let year_cols = [];
        const Months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

        for(let i=0; i<years.length; i++)
        {
            if(arrivals[i] != -500)
            {
                year_cols.push(['data-sorting',arrivals[i].valueOf(),
                    '<a href="'+ firstObservations[i].url +'">'+ arrivals[i].getDate() + ' ' + Months[arrivals[i].getMonth()] + '</a>']);
            }
            else year_cols.push(comment[i]);
        }
        
        let span = document.createElement("span");

        span.addEventListener("click", (event) => {
            generateSpeciesStatDetail( card, speciesMap );
        });

        span.innerHTML = category.category;

        let main_cols = [card.lat_name, card.name, card.total_observed, span, category.monthsPresent,
                                         ['data-sorting',category.from,category.fromText],
                                         ['data-sorting',category.to,category.toText]];

        if(category.category == 'Migratory') table_migratory.appendChild(createTr([...main_cols, ...year_cols]));
        else if(category.category == 'All year') table_allyear.appendChild(createTr([...main_cols]));
        else table_unknown.appendChild(createTr([card.lat_name, card.name, card.total_observed]));
    } );

    addSorting( table_migratory, 1 );
    addSorting( table_allyear, 1 );
    addSorting( table_unknown, 1 );
}
