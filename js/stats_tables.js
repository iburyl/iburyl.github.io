function getDaysFrom1Jan(time)
{
    let year = time.getFullYear();
    let first_january = new Date(year, 0, 1);
    let delta = (time - first_january) / (1000 * 60 * 60 * 24);
    return delta;
}

function getKnownYears( card, startingFrom )
{
    var knownYearsUnsorted = new Set();

    card.observations.forEach( (obs) =>
    {
        let year = obs.time.getFullYear();
        if(year>=startingFrom) knownYearsUnsorted.add( year );

    });

    const knownYears = new Set([...knownYearsUnsorted].sort());
    return knownYears;
}

function getAllKnownYears( speciesMap, startingFrom )
{
    var knownYearsUnsorted = new Set();

    speciesMap.forEach( (card, key) =>
    {
        let cardYears = getKnownYears( card, startingFrom );
        cardYears.forEach((year) => {knownYearsUnsorted.add( year );});
    } );

    const knownYears = new Set([...knownYearsUnsorted].sort());
    return knownYears;
}

function getObservationsPerDay( events, year )
{
    let days = Array(366).fill(0);

    events.forEach((obs) =>
    {
        if(typeof year !== "undefined" && obs.time.getFullYear() != year) return;

        days[Math.trunc(getDaysFrom1Jan(obs.time))]++;
    });

    return days;
}

function getMovingAverage( eventsPerDay, halfFrame )
{
    const length = eventsPerDay.length;
    let eventNumInFrame = Array(length).fill(0);

    for(let i=0; i<length; i++)
    {
        for(let j=-halfFrame ; j<=halfFrame ; j++)
        {
            eventNumInFrame[i] += eventsPerDay[(length + i + j)%length] * (1+halfFrame-Math.abs(j))/(1+halfFrame);
        }
    }

    return eventNumInFrame;
}

function normalize(eventsPerDay)
{
    let max = Math.max(...eventsPerDay);
    return eventsPerDay.map((el) => el/max)
}

function getScatterYearDaysGraph( datasets, canvas )
{
    let data_datasets = [];
    datasets.forEach( (dataset) =>
    {
        let i = 0;
        let scattered; 

        if(typeof dataset.interval === "undefined" || dataset.interval == false)
        {
            scattered = dataset.values.map( (el) => { i++; return {x:i, y:el}; } );
        }
        else
        {
            let value = 1;
            if(typeof dataset.value !== "undefined")
            {
                value = dataset.value;
            }

            let left  = (dataset.values[0] + 366)%366;
            let right = (dataset.values[1])%366;
            
            if( left<=right )
                scattered = [ {x:0, y:0}, {x:left, y:0}, {x:left, y:value}, {x:right, y:value}, {x:right, y:0}, {x:365, y:0}]; 
            else
                scattered = [ {x:0, y:value}, {x:right, y:value}, {x:right, y:0}, {x:left, y:0}, {x:left, y:value}, {x:365, y:value}]; 
        }

        data_datasets.push({
            label: dataset.label,
            data: scattered,
            borderWidth: (typeof dataset.borderWidth === "undefined") ? 1 : dataset.borderWidth,
            pointStyle : false,
            showLine: true,
        });
    } );

    let chart = new Chart(canvas,
        {
            type: 'scatter',
            data: { datasets: data_datasets },
            options: {
              scales: {
                x: {
                    max: 365,
                    ticks: {
                        callback: function(label, index, labels) {
                            const Months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
                            
                            return Months[index%12];
                        },
                         stepSize: 365/12
                     },
                }
              },
            }
        });
    return chart;
}

function generateSpeciesStatDetail( card, speciesMap )
{
    let halfFrame = 14;

    const detail_div = document.getElementById("detail_div");
    detail_div.innerHTML = card.name + ' (' + card.lat_name + ')';

    let deltaGraphCanvas = document.createElement("canvas");
    detail_div.appendChild( deltaGraphCanvas );

    const category = getCategory( card.observations );

    let boxGraphs = category.boxes.map((box) => {return {label:'#', values: [box.left, box.right], interval:true, value:0.5, borderWidth:5};});

    getScatterYearDaysGraph( [
        {label:'#', values: normalize(getMovingAverage( getObservationsPerDay(card.observations), halfFrame )), borderWidth:3},
        {label:'#', values: normalize(getObservationsPerDay( card.observations ))},
        ...boxGraphs,
    ], deltaGraphCanvas);
    
    let knownYears = getKnownYears( card, 2013 );

    detail_div.appendChild( document.createElement("br") );
    detail_div.appendChild( document.createElement("br") );

    let years_div = document.createElement("div");
    detail_div.appendChild( years_div );

    detail_div.appendChild( document.createElement("br") );
    detail_div.appendChild( document.createElement("br") );

    let deltaGraphCanvas2 = document.createElement("canvas");
    detail_div.appendChild( deltaGraphCanvas2 );

    let yearChart;
    
    knownYears.forEach((year) =>
    {
        let span = document.createElement("span");
        span.innerHTML = year;

        span.addEventListener("click", (event) =>
        {
            event.preventDefault();

            if(typeof yearChart !== "undefined") yearChart.destroy();

            yearChart = getScatterYearDaysGraph( [{label:year, values: getObservationsPerDay( card.observations, year )}], deltaGraphCanvas2);
        });
        
        years_div.appendChild( span );
        let space = document.createElement("span");
        space.innerHTML = ' ';
        years_div.appendChild( space );
    });
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

function getDailyMaxBoxElement( values, averValues, halfFrame, targetTotal )
{
    let length = values.length;

    let maxValue=0;
    let maxValueIdx=0;
    let minAverValue=averValues[0];
    for(let i=0; i<values.length; i++)
    {
        if(values[i]>maxValue)
        {
            maxValue=values[i];
            maxValueIdx=i;
        }
        if(averValues[i]<minAverValue)
        {
            minAverValue = averValues[i];
        }
    }

    let rangeTotal=maxValue;
    let leftIndex=maxValueIdx;
    let rightIndex=maxValueIdx;

    // extend range back
    while(1)
    {
        if(rightIndex - leftIndex == length-1) break;

        let leftCorrectedIndex = (length + leftIndex - 1)%length;
        let leftValue = values[leftCorrectedIndex];

        if(averValues[leftCorrectedIndex] > 0.05)
        {
            rangeTotal += leftValue;
            leftIndex--;
        }
        else break;
    }
    while(1)
    {
        if(rightIndex - leftIndex == length-1) break;

        let rightCorrectedIndex = (length + rightIndex + 1)%length;
        let rightValue = values[rightCorrectedIndex];

        if(averValues[rightCorrectedIndex] > 0.05)
        {
            rangeTotal += rightValue;
            rightIndex++;
        }
        else break;
    }

    while(1)
    {
        if(leftIndex == rightIndex) break;

        let leftCorrectedIndex = (length + leftIndex + 1)%length;
        let leftValue = values[leftCorrectedIndex];

        if(values[leftCorrectedIndex]==0)
        {
            rangeTotal -= leftValue;
            leftIndex++;
        }
        else break;
    }
    while(1)
    {
        if(leftIndex == rightIndex) break;

        let rightCorrectedIndex = (length + rightIndex - 1)%length;
        let rightValue = values[rightCorrectedIndex];

        if(values[rightCorrectedIndex]==0)
        {
            rangeTotal -= rightValue;
            rightIndex--;
        }
        else break;
    }

    return {left:leftIndex, right:rightIndex, rangeTotal:rangeTotal};
}

function forEachValueInBox( values, box, func )
{
    for(let i=0; i<values.length; i++)
    {
        let in_box = false;

        in_box = in_box || (i >= box.left && i <= box.right);
        in_box = in_box || (box.left<0 && i >= (box.left + values.length));
        in_box = in_box || (box.right>=values.length && i <= (box.right - values.length));

        if(in_box)
        {
            values[i] = func(values[i]);
        }
    }
}

function getDailyMaxBoxArray( events, targetTotal )
{
    const halfFrame = 14;

    let values = getObservationsPerDay( events );
    let averValues = normalize(getMovingAverage( values, halfFrame ));

    let sum = 0;

    values.forEach((value) => sum+=value);

    let covered = 0;

    let boxes = [];

    while(covered < targetTotal && boxes.length < 4)
    {
        let box = getDailyMaxBoxElement( values, averValues, halfFrame, targetTotal );
        covered += box.rangeTotal;

        boxes.push(box);

        forEachValueInBox( values, box, ()=>0);
        forEachValueInBox( averValues, box, ()=>0);
    }

    return boxes;
}

let verbose = false;

function joinBoxes( dayBoxes, observations )
{
    let values = getObservationsPerDay( observations );
    const year_length = values.length;
    while(1)
    {
        let changed=false;

        for(let i=0; i<dayBoxes.length; i++)
        {
            for(let j=0; j<dayBoxes.length; j++)
            {
                if(i==j) continue;

                let new_box;

                let i_left = dayBoxes[i].left;
                let j_left = dayBoxes[j].left;
                let i_right = dayBoxes[i].right;
                let j_right = dayBoxes[j].right;

                if( j_left - i_right > 0 && j_left - i_right < 30 )
                {
                    // if there are several little boxes in the range of 30
                    // some of them may get skipped
                    new_box = {left:i_left, right:j_right};
                }
                else if( j_right >= year_length && i_left-(j_right-year_length) > 0  && i_left-(j_right-year_length) < 30)
                {
                    new_box = {left:j_left, right:i_right+year_length};
                }
                else if( i_left < 0 && (i_left+year_length)-j_right > 0  && (i_left+year_length)-j_right < 30)
                {
                    new_box = {left:j_left, right:i_right+year_length};
                }

                if(typeof new_box !== "undefined")
                {
                    new_box.rangeTotal = 0;

                    forEachValueInBox( values, new_box, (val)=>{new_box.rangeTotal+=val; return val;});

                    let new_boxes = [];

                    new_boxes.push(new_box);
                    dayBoxes.forEach( (val, index) => { if(index != i && index != j) new_boxes.push(val); } )
                    dayBoxes = new_boxes;

                    changed = true;
                    break;
                }
            }

            if(changed) break;
        }

        if(!changed) break;
    } 

    return dayBoxes;
}


function getCategory( observations )
{
    if( observations.length < 50 )
    {
        return {category:'.'};
    }

    let dayBoxes = getDailyMaxBoxArray( observations, observations.length * 0.95 );
    dayBoxes = joinBoxes( dayBoxes, observations );
    dayBoxes.sort((a,b) => { if(a.rangeTotal > b.rangeTotal) return -1; else return +1; });

    let firstRate = dayBoxes[0].rangeTotal/observations.length;

    let secondRate = 0;
    if(dayBoxes.length>1) secondRate = dayBoxes[1].rangeTotal/observations.length;

    let thirdRate = 0;
    if(dayBoxes.length>2) thirdRate = dayBoxes[2].rangeTotal/observations.length;

    let sumOfBoxesLengths = 0;
    dayBoxes.forEach((box)=>{sumOfBoxesLengths += box.right-box.left});

    let category = '.';
    if( sumOfBoxesLengths > 366 - dayBoxes.length*45 )
    {
        category = 'All year';

        if(dayBoxes.length>1)
        {
            category += ' almost';
        }
    }
    else
    {
        if(secondRate > 0.1 && (firstRate+secondRate)>0.8 && secondRate > thirdRate*2)
        {
            category = 'Passthrough';

            if(firstRate+secondRate < 0.9 || dayBoxes.length>2)
            {
                category += ' probably';
            }
        }
        else
        {
            category = 'Seasonal';

            if(firstRate < 0.9)
            {
                category += ' noisy';
            }
        }
    }

    return {category:category, boxes: dayBoxes, };
}

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

function getExactDepatureIndex(year, category, timeline, getDateIndex, timelineObs)
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

        let category = getCategory( card.observations );
        
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

            let depatureIdx = getExactDepatureIndex(firstYear+i, category, timeline, getDateIndex);

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
            generateSpeciesStatDetail( card, speciesMap, category );
        });

        span.innerHTML = category.category;

        let main_cols = [card.lat_name, card.name, card.total_observed, span];

        if(category.category.startsWith('Seasonal')) table_migratory.appendChild(createTr([...main_cols,
            ['data-sorting',category.boxes[0].left,getDayStringFromIndex(category.boxes[0].left)],
            ['data-sorting',category.boxes[0].right,getDayStringFromIndex(category.boxes[0].right)],
            ...year_cols]));
        else if(category.category.startsWith('Passthrough'))
        {
            let boxes = [category.boxes[0],category.boxes[1]].sort((a,b)=>{if(a.left > b.left) return +1; else return -1;});

            table_passthrough.appendChild(createTr([...main_cols,
                ['data-sorting',boxes[0].left,getDayStringFromIndex(boxes[0].left)],
                ['data-sorting',boxes[0].right,getDayStringFromIndex(boxes[0].right)],
                ['data-sorting',boxes[1].left,getDayStringFromIndex(boxes[1].left)],
                ['data-sorting',boxes[1].right,getDayStringFromIndex(boxes[1].right)],
                ...year_cols]));
        }
        else if(category.category.startsWith('All year')) table_allyear.appendChild(createTr([...main_cols,
            ['data-sorting',category.boxes[0].left,getDayStringFromIndex(category.boxes[0].left)],
            ['data-sorting',category.boxes[0].right,getDayStringFromIndex(category.boxes[0].right)],
            ]));
        else table_unknown.appendChild(createTr([card.lat_name, card.name, card.total_observed]));
    } );

    addSorting( table_migratory, 1 );
    addSorting( table_passthrough, 1 );
    addSorting( table_allyear, 1 );
    addSorting( table_unknown, 1 );
}
