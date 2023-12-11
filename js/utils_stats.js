function getDaysFrom1Jan(time)
{
    let year = time.getFullYear();
    let first_january = new Date(year, 0, 1);
    let delta = (time - first_january) / (1000 * 60 * 60 * 24);
    return delta;
}

function getDayStringFromDayShift(index, year)
{
    if(typeof year === "undefined") year = 2000;

    const Months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

    let date = new Date(year,0,1);
    date.setDate(date.getDate() + index);

    return date.getDate()+' '+Months[date.getMonth()];
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


