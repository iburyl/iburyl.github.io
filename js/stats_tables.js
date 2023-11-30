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
    let total = Array(365).fill(0);
    speciesMap.forEach((card) => 
    {
        let subtotal = getEventsInFrameArray( card.observations, frame );

        for(let i=0;i<subtotal.length;i++)
        {
            total[i] += subtotal[i];
        }
        
    });

    let obsNumInNextWeek = getEventsInFrameArray( card.observations, frame );

    let obsNumInNextWeekNormalized = [];

    for(let i=0;i<obsNumInNextWeek.length;i++)
    {
        obsNumInNextWeekNormalized[i] = obsNumInNextWeek[i] / total[i];
    }

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
        scattered_data[i] = {x:i, y:obsNumInNextWeek[ Math.trunc(365 + i - frame/2)%365 ]};
    }

    let i = 0;
    let scattered_data1 = getEventsInFrameArray( card.observations, 1 ).map( (el) => { i++; return {x:i, y:el}; } );

    let j = 0;
    let scattered_data2 = obsNumInNextWeekNormalized.map( (el) => { j++; return {x:j, y:el}; } );

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

    new Chart(deltaGraphCanvas2, {
        type: 'scatter',
        data: {
          datasets: [{
            label: '#',
            data: scattered_data2,
            borderWidth: 3,
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

        let lat_name = document.createElement("span");

        lat_name.addEventListener("click", (event) => {
            generateSpeciesStatDetail( card, speciesMap );
        });

        lat_name.innerHTML = card.lat_name;

        table_years.appendChild(createTr([lat_name, card.name, ...cols]));
    } );


}
