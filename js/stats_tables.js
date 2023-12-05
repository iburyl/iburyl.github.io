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

    detail_div.appendChild( document.createElement("br") );

    let deltaGraphCanvas2 = document.createElement("canvas");
    detail_div.appendChild( deltaGraphCanvas2 );

    let scattered_data = []; //obsNumInNextWeek.map( (el) => { i++; return {x:i, y:el}; } );
    for(let i = 0; i<obsNumInNextWeek.length; i++)
    {
        let date = new Date(Date.UTC(2000));
        date.setDate(date.getDate() + i);

        scattered_data[i] = {x:i, y:obsNumInNextWeek[ Math.trunc(365 + i - frame/2)%365 ]};
    }

    let i = 0;
    let scattered_data1 = getEventsInFrameArray( card.observations, 1 ).map( (el) => { i++; return {x:i, y:el}; } );

    new Chart(deltaGraphCanvas, {
        type: 'scatter',
        labels: [{x:0, y:'0'}, {x:100, y:'100'}],
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
                    callback: function(label, index, labels) {
                        const Months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
                        
                        return Months[index%12];
                    },
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

function getLastKnownDate( speciesMap )
{
    let last;
    
    var knownYearsUnsorted = new Set();

    speciesMap.forEach( (card, key) =>
    {
        card.observations.forEach( (obs) =>
        {
            if(typeof last === "undefined") last = obs.time;
            else
            {
                if(last - obs.time < 0) last = obs.time;
            }
        });
    } );

    return last;
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

    return {category:category, monthsPresent:(rightIndex-leftIndex)+1, from: (12+leftIndex)%12, to: (rightIndex)%12, fromText: Months[(12+leftIndex)%12], toText: Months[(rightIndex)%12]};
}

function getExactArrivalIndex(year, category, timeline, getDateIndex)
{
    let firstGuess = new Date(year, category.from, 1);
    let startSearchIdx = getDateIndex(firstGuess)-45;
    if(startSearchIdx < 0) return -1; // out of range

    for(let j=0; j<90; j++)
    {
        if( startSearchIdx + j == timeline.length) return -1; // out of range
        if( timeline[startSearchIdx + j] == 0 ) continue;
        if(j < 15) return -2; // noisy - unreliable result

        return startSearchIdx + j;
    }
}

function getStatArrivalIndex(year, category, timeline, getDateIndex)
{
    let firstGuess = new Date(year, category.from, 1);
    let startSearchIdx = getDateIndex(firstGuess)-45;
    if(startSearchIdx < 0) return -1; // out of range

    const frame = 7;

    let moving_average = Array(90).fill(0);
    let data           = Array(90).fill(0);
    for(let j=0; j<90; j++)
    {
        for(let k=0; k<frame; k++)
        {
            if( startSearchIdx + j + k == timeline.length) break;
            moving_average[j] += timeline[startSearchIdx + j + k];
            data[j] = timeline[startSearchIdx + j];
        }
    }

    let average_target = Math.max(moving_average[0], 1) * 2;
    for(let j=0; j<90; j++)
    {
        if( moving_average[j] > average_target && timeline[startSearchIdx + j] > 0)
        {
            return startSearchIdx + j;
        }
    }

    return -2; // noisy - unreliable result
}

function getExactDepatureIndex(arrivalIdx, category, timeline, getDateIndex)
{
    let minDuration      = Math.trunc((category.monthsPresent-1)*(365/12));
    let extendedDuration = Math.trunc((category.monthsPresent+3)*(365/12));

    let zeroDaysCount = 0;

    for(let i=minDuration; i<extendedDuration; i++)
    {
        if(arrivalIdx + i> timeline.length) return -1; // can be made better

        if( timeline[arrivalIdx+i] != 0 ) zeroDaysCount=0; else zeroDaysCount++;

        if(zeroDaysCount == 45)
        {
            return arrivalIdx + i - zeroDaysCount;
        }
    }

    return -2; // noisy - unreliable result
}


function getStatDepatureIndex(arrivalIdx, category, timeline, getDateIndex)
{
    if(arrivalIdx + 365 > timeline.length) return -1; // can be made better

    let expectedDuration = (category.monthsPresent+2)*30;

    let totalYear = 0;
    let expectedTotal = 0;

    for(let i=0; i<365; i++) totalYear += timeline[arrivalIdx+i];
    for(let i=0; i<expectedDuration; i++) expectedTotal += timeline[arrivalIdx+i];

    let currentTotal = 0;

    for(let i=0; i<365; i++)
    {
        currentTotal += timeline[arrivalIdx+i];
        if(currentTotal > expectedTotal * 0.95)
        {
            if(currentTotal < totalYear * 0.9)
            {
                return -1;
            }

            return arrivalIdx + i;
        }
    }

    return -2; // noisy - unreliable result
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
    const lastKnownDate = getLastKnownDate(speciesMap);
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
            {                                  let i = getDateIndex(obs.time);
                timeline[i]++;
                timelineObs[i].push(obs);

                years[obs.time.getFullYear()-firstYear]++;
            }
        });

        let category = getCategory( card.observations );

        let arrivals  = Array(lifetimeYears).fill(-500);
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
            else if(arrivalIdx == -2)
            {
                comment[i] == 'noisy';
                arrivalIdx = getStatArrivalIndex(firstYear+i, category, timeline, getDateIndex);

                if(arrivalIdx >= 0) arrivals[i] = getIndexDate(arrivalIdx);
            }

            let depatureIdx;

            if(arrivalIdx >= 0)
            {
                depatureIdx = getExactDepatureIndex(arrivalIdx, category, timeline, getDateIndex);

                if(depatureIdx > 0)
                {
                    depatures[i] = getIndexDate(depatureIdx);
                    lastObservations[i] = timelineObs[depatureIdx][0];
                }
                else if(depatureIdx == -2)
                {
                    depatureIdx = getStatDepatureIndex(arrivalIdx, category, timeline, getDateIndex);

                    if(depatureIdx >= 0) depatures[i] = getIndexDate(depatureIdx);
                }
            }

        }

        let year_cols = [];
        const Months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

        for(let i=0; i<years.length; i++)
        {
            if(arrivals[i] != -500)
            {
                let text = '';
                if(typeof firstObservations[i] !== "undefined")
                {
                    text += '<a href="'+ firstObservations[i].url +'">'+ arrivals[i].getDate() + ' ' + Months[arrivals[i].getMonth()] + '</a>';
                }
                else
                {
                    text += '~'+ arrivals[i].getDate() + ' ' + Months[arrivals[i].getMonth()];
                }

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
                else
                {
                    text += '?';
                }

                year_cols.push(['data-sorting',arrivals[i].valueOf(),text]);
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
