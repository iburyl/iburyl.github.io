function generateEbirdFetchingTable(ebird_key, ebird_region)
{
    const table_years = document.getElementById("table_years");
    table_years.innerHTML = '';
    const ebirdDownloadSpan = document.getElementById("ebirdDownload");
    ebirdDownloadSpan.innerHTML = '';

    let ebird_list = '';
    fetchAsync('https://api.ebird.org/v2/product/spplist/'+ebird_region+'?key='+ebird_key).then(async (data) =>
    {
        data.forEach((name) =>
        {
            if(ebird_list != '') ebird_list += ',';
            ebird_list += name;
        });
    })
    .then(async () =>
    {
        return fetchAsync('https://api.ebird.org/v2/ref/taxonomy/ebird?key='+ebird_key+'&locale=ru&fmt=json&species='+ebird_list);
    })
    .then(async (data) =>
    {
        table_years.appendChild(createTr(['#','ebird Tax id', 'latin name', 'ru name']));

        let arrayData = [];
        arrayData.push([ '#','ebird Tax id', 'scientific_name', 'ebird ru name']);
        
        let i = 1;
        data.forEach((card) =>
        {
            table_years.appendChild(createTr([ i, card.speciesCode, card.sciName, card.comName ]));

            arrayData.push([ i, card.speciesCode, card.sciName, card.comName ]);

            i++;
        });

        const csvString = ArrayToCSV(arrayData);

        var blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });

        const ebirdDownloadSpan = document.getElementById("ebirdDownload");
        var ebirdDownloadA = document.createElement("a");

        const now = new Date();
        const dateString = now.getFullYear() + '-' + (now.getMonth()+1) + '-' + now.getDate();

        var url = URL.createObjectURL(blob);
        ebirdDownloadA.setAttribute("href", url);
        ebirdDownloadA.setAttribute("download", 'ebird-checklist-'+ebird_region+'-'+dateString+'.csv');
        ebirdDownloadA.innerHTML = 'download';
        ebirdDownloadSpan.appendChild(ebirdDownloadA);

    });
       
    document.getElementById("instruction").innerHTML = '';
    document.getElementById("description_tr").innerHTML = '';
}