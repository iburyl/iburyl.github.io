function generateProjectFetchingTable(project_id)
{
    const table_years = document.getElementById("table_years");
    table_years.innerHTML = '';

    fetchAsync('https://api.inaturalist.org/v1/projects/'+project_id).then(async (data) =>
    {
        console.log(data);

        let i = 1;
        table_years.appendChild(createTr(['#','inats id', 'latin name', 'english name']));

        let taxIdMapCache = await getTaxIdMapCache();

        data.results[0].project_observation_rules.forEach((rule) =>
        {
            if(rule.operator == 'in_taxon?')
            {
                if(rule.operand_type == 'Taxon')
                {
                    let id = rule.operand_id;

                    if(taxIdMapCache.has(id))
                    {
                        let card = taxIdMapCache.get(id);
                        table_years.appendChild(createTr([i,id,card.name,card.english_common_name]));
                    }
                    else
                    {
                        table_years.appendChild(createTr([i,id,'','']));
                    }

                    i++;
                }
                else
                {
                    console.error('unknown operand type: ' + rule.operand_type);
                }
            }
        });
    });
}