function generateSpeciesStatDetail( card )
{
    let halfFrame = 14;

    let category = getCategory( card );
    let category_raw_boxes = getCategory( card, false );

    const detail_div = document.getElementById("detail_div");
    detail_div.innerHTML = '';

    let title = document.createElement("div");
    let name = document.createElement("div");
    let close = document.createElement("div");
    title.appendChild( name );
    title.appendChild( close );
    detail_div.appendChild( title );
    title.setAttribute('class', 'title');
    name.setAttribute('class', 'name');
    name.innerHTML = card.name + ' (' + card.lat_name + ')';
    close.innerHTML = '[x]';

    close.addEventListener("click", (event) =>
    {
        event.preventDefault();
        detail_div.innerHTML = '';
    });

    let deltaGraphCanvas = document.createElement("canvas");
    detail_div.appendChild( deltaGraphCanvas );

    let knownYears = getKnownYears( card, 2013 );

    detail_div.appendChild( document.createElement("br") );
    detail_div.appendChild( document.createElement("br") );

    let table;
    if(typeof category.boxes !== "undefined")
    {
        table = document.createElement("table");
        detail_div.appendChild(table);

        detail_div.appendChild( document.createElement("br") );
        detail_div.appendChild( document.createElement("br") );
    }

    let additional_chart_div = document.createElement("div");
    detail_div.appendChild( additional_chart_div );

    detail_div.appendChild( document.createElement("br") );
    detail_div.appendChild( document.createElement("br") );

    let additional_chart_canvas = document.createElement("canvas");
    detail_div.appendChild( additional_chart_canvas );

    let boxGraphs   = [];
    let boxGraphsRaw= [];

    if(typeof category.boxes !== "undefined")
    {
        boxGraphs    = category          .boxes.map((box) => {return {label:'box', values: [box.left, box.right], interval:true, value:0.5, borderWidth:5};});
        boxGraphsRaw = category_raw_boxes.boxes.map((box) => {return {label:'box', values: [box.left, box.right], interval:true, value:0.25, borderWidth:3};});
    }

    getScatterYearDaysGraph( [
        {label:'average', values: normalize(getMovingAverage( getObservationsPerDay(card.observations), halfFrame )), borderWidth:3},
        {label:'count', values: normalize(getObservationsPerDay( card.observations ))},
        ...boxGraphs, ...boxGraphsRaw,
    ], deltaGraphCanvas);
    
    if(typeof category.boxes !== "undefined")
    {
        table.appendChild(createTr(['from', 'to', 'length', 'count', 'ratio']));

        function addBoxes(boxes)
        {
            boxes.forEach((box) =>
            {
                let ratio = box.rangeTotal/card.observations.length;
                ratio = Math.round(ratio*100)/100;
                table.appendChild(createTr([getDayStringFromDayShift(box.left), getDayStringFromDayShift(box.right), box.right-box.left, box.rangeTotal, ratio]));
            });
        }
        

        addBoxes( category.boxes.toSorted((a,b) => {if(a.left > b.left) return +1; else return -1;}) );
        

        if(category.boxes.length != category_raw_boxes.boxes.length)
        {
            table.appendChild(createTr(['', '', '', '', '']));

            addBoxes( category_raw_boxes.boxes.toSorted((a,b) => {if(a.left > b.left) return +1; else return -1;}) );
        }

    }

    let additionalChart;
    
    knownYears.forEach((year) =>
    {
        let span = document.createElement("span");
        span.innerHTML = year;

        span.addEventListener("click", (event) =>
        {
            event.preventDefault();

            if(typeof additionalChart !== "undefined") additionalChart.destroy();

            additionalChart = getScatterYearDaysGraph( [{label:year, values: getObservationsPerDay( card.observations, year )}], additional_chart_canvas);
        });
        
        additional_chart_div.appendChild( span );
        let space = document.createElement("span");
        space.innerHTML = ' ';
        additional_chart_div.appendChild( space );
    });

    {
        let span = document.createElement("span");
        span.innerHTML = 'over years';
        additional_chart_div.appendChild( document.createElement("br") );
        additional_chart_div.appendChild( span );

        span.addEventListener("click", (event) =>
        {
            let yearsMap = new Map();
        
            card.observations.forEach(( obs ) => 
            {
                let year = obs.time.getFullYear();
                let year_value = 1;
        
                if( yearsMap.has(year) )
                {
                    year_value = yearsMap.get(year) + 1;
                }
        
                yearsMap.set(year, year_value);
            } );

            yearsMap = new Map([...yearsMap].sort());
        
            if(typeof additionalChart !== "undefined") additionalChart.destroy();

            additionalChart = new Chart(additional_chart_canvas, {
                type: 'bar',
                data: {
                  labels: [ ...yearsMap.keys() ],
                  datasets: [{
                    label: '#',
                    data: [ ...yearsMap.values() ],
                    borderWidth: 1
                  }]
                },
                options: {
                  scales: {
                    y: { beginAtZero: true }
                  }
                }
              });
            });
    }
}
