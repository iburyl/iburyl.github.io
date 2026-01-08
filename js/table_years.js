async function generateYearsTable( speciesMap, showUploadTime)
{
    let once = false;

    let taxIdMapCache = await getTaxIdMapCache();
    let taxLatNameMapCache = taxIdMap2taxLatNameMap(taxIdMapCache);

    if(typeof showUploadTime=== "undefined") showUploadTime=false;

    const speciesYearsMap = new Map();

    speciesMap.forEach( (card, key) =>
    {
        let year = card.first_observed.time.getFullYear();

        if( !speciesYearsMap.has(year) )
        {
            speciesYearsMap.set(year, []);
        }

        speciesYearsMap.get(year).push(card);
    } );

    const speciesYearsMapSorted = new Map([...speciesYearsMap].sort());

    {
        const table_years = document.getElementById("table_years");
        table_years.innerHTML = '';

        table_years.appendChild(createThead(
            [createTr(
               [['rowspan',2,'year'], ['colspan',2,'number of species'], ['colspan',4,'tax'], ['colspan',3,'names'], ['colspan',3,'all years'],
                ['colspan',3,'first observation'],
                ['colspan',3,'first research grade if different']]),
            createTr(
               ['cumulative', 'this year', 'kingdom','class','order','family','english','common', 'latin (clickable)', 'obs', 'rsch','ssps',
                'date', 'ref', 'user', 'date', 'ref', 'user'])]));

        let cumulative = 0;
        speciesYearsMapSorted.forEach( (cards, year) =>
        {
            const export_div = document.createElement("div");
            export_div.id = "export_div_" + year;
            export_div.innerHTML = '';

            cumulative += cards.length;

            let first = true;

            cards.sort((a,b) =>
            {
                let taxDetailA = [getSpan(),getSpan(),getSpan(),getSpan(),getSpan(),getSpan(),getSpan(),getSpan(),getSpan()];
                let taxDetailB = [getSpan(),getSpan(),getSpan(),getSpan(),getSpan(),getSpan(),getSpan(),getSpan(),getSpan()];
                let main_inat_cardA = fillMainTaxDetails(a.lat_name, taxDetailA, taxLatNameMapCache, taxIdMapCache);
                let main_inat_cardB = fillMainTaxDetails(b.lat_name, taxDetailB, taxLatNameMapCache, taxIdMapCache);
                if(typeof main_inat_cardA !== "undefined")
                {
                    fillAncestorTaxDetails(main_inat_cardA, taxDetailA, taxIdMapCache);
                }
                if(typeof main_inat_cardB !== "undefined")
                {
                    fillAncestorTaxDetails(main_inat_cardB, taxDetailB, taxIdMapCache);
                }
                if(taxDetailA[2].innerHTML < taxDetailB[2].innerHTML) return -1;
                if(taxDetailA[2].innerHTML > taxDetailB[2].innerHTML) return +1;
                if(taxDetailA[3].innerHTML < taxDetailB[3].innerHTML) return -1;
                if(taxDetailA[3].innerHTML > taxDetailB[3].innerHTML) return +1;
                if(taxDetailA[5].innerHTML < taxDetailB[5].innerHTML) return -1;

                if(a.first_observed.time > b.first_observed.time) return +1; else return -1;
            });

            let exportSpan = getSpan();
            exportSpan.innerHTML = year;
            exportSpan.style.cursor = 'pointer';
            exportSpan.title = 'Click to copy table HTML';
            exportSpan.onclick = function() {
                const htmlContent = export_div.innerHTML;
                navigator.clipboard.writeText(htmlContent).then(() => {
                    const originalText = exportSpan.innerHTML;
                    exportSpan.innerHTML = '✓ ' + originalText;
                    setTimeout(() => {
                        exportSpan.innerHTML = originalText;
                    }, 1000);
                }).catch(err => {
                    console.error('Failed to copy: ', err);
                    alert('Failed to copy table HTML to clipboard');
                });
            };

            let family = 'unknown';
            let export_table = '';

            function addFamilyToExport()
            {
                if(family === 'unknown') return;

                let export_tble_prefix = document.createElement("span");
                export_tble_prefix.innerHTML = 'Family: ' + family;

                export_div.appendChild(export_tble_prefix);
                export_div.innerHTML += '\n';
                export_div.appendChild(export_table);
                export_div.innerHTML += '\n';
            }
            
            cards.forEach( (card) => 
            {
                let taxDetail = [getSpan(),getSpan(),getSpan(),getSpan(),getSpan(),getSpan(),getSpan(),getSpan(),getSpan()];
                let main_inat_card = fillMainTaxDetails(card.lat_name, taxDetail, taxLatNameMapCache, taxIdMapCache);
                if(typeof main_inat_card !== "undefined")
                {
                    fillAncestorTaxDetails(main_inat_card, taxDetail, taxIdMapCache);
                }

                if(!once) {once = true; card.first_observed;}
            
        
                let tdFirstObserved = getObsTdSummary( card.first_observed, showUploadTime );
                let tdFirstResearch = getObsTdSummary( card.first_research, showUploadTime );
                if( tdFirstObserved[1] == tdFirstResearch[1] ) tdFirstResearch = ['&larr;','',''];

                let tdFileds = [taxDetail[0].innerHTML, taxDetail[1].innerHTML, taxDetail[2].innerHTML, taxDetail[3].innerHTML, taxDetail[5].innerHTML,
                                ...getCardTdSummary( card ).slice(0,-1), ...tdFirstObserved /*.splice(1)*/, ...tdFirstResearch ];
                
                let image_url = card.first_observed.image_url;
                let image_tag = '';
                if(image_url !== '')
                {
                    image_tag = `<a href='${card.first_observed.url}'><img src='${image_url}' alt='image' width='100'></a>`;
                }
                else image_tag = tdFirstObserved[1];
                let export_tdFileds = [image_tag, getCardTdSummary( card )[1], tdFirstObserved[0], '@' + tdFirstObserved[2], (tdFirstResearch[0] == '&larr;')?'':'to be confirmed' ];

                if(family !== taxDetail[3].innerHTML)
                {
                    addFamilyToExport();

                    family = taxDetail[3].innerHTML;

                    export_table = document.createElement("table");
                    export_table.id = "export_table_" + year;
                    export_table.innerHTML = '';
                    export_table.appendChild(createThead([createTr(['observation', 'scientific name', 'date', 'observer', 'comments'])]));
                }
    
                if(first)
                {
                    let prefixTdFiled = [['rowspan',cards.length, exportSpan], ['rowspan', cards.length, cumulative], ['rowspan', cards.length, cards.length]];
                    tdFileds = prefixTdFiled.concat(tdFileds);
                }

                table_years.appendChild( createTr( tdFileds ) );

                export_table.appendChild( createTr( export_tdFileds ) );
               
                first = false;
            } );

            addFamilyToExport();
        } );
    }
}
