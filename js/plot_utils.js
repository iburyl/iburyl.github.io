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
