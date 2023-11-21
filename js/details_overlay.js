function generateSpeciesDetail( card )
{
    let monthsN = [0,0,0, 0,0,0, 0,0,0, 0,0,0]; 
    let yearsMap = new Map();

    card.observations.forEach(( obs ) => 
    {
        monthsN[ obs.time.getMonth() ] += 1;

        let year = obs.time.getFullYear();
        let year_value = 1;

        if( yearsMap.has(year) )
        {
            year_value = yearsMap.get(year) + 1;
        }

        yearsMap.set(year, year_value);
    } );

    yearsMap = new Map([...yearsMap].sort());

    const detail_div = document.getElementById("detail_div");
    detail_div.innerHTML = card.name + ' (' + card.lat_name + ')';

    let monthGraphCanvas = document.createElement("canvas");
    detail_div.appendChild( monthGraphCanvas );

    detail_div.appendChild( document.createElement("br") );

    let yearGraphCanvas = document.createElement("canvas");
    detail_div.appendChild( yearGraphCanvas );

    new Chart(monthGraphCanvas, {
        type: 'bar',
        data: {
          labels: ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'],
          datasets: [{
            label: '#',
            data: monthsN,
            borderWidth: 1
          }]
        },
        options: {
          scales: {
            y: { beginAtZero: true }
          }
        }
      });

    new Chart(yearGraphCanvas, {
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

}
