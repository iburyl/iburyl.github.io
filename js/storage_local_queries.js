async function getTaxIdMapCache()
{
    let taxIdMapCache = localStorage.getItem("taxIdMapCache");
    if(taxIdMapCache === null)
    {
        taxIdMapCache = new Map();
    }
    else
    {
        taxIdMapCache = JSON.parse(taxIdMapCache, mapReviver);
    }

    return taxIdMapCache;
}

async function startTaxIdMapCacheUpdate(taxIdMapCache)
{
    return taxIdMapCache;
}


async function finalizeTaxIdMapCacheUpdate(taxIdMapCache)
{
    localStorage.setItem("taxIdMapCache", JSON.stringify(taxIdMapCache, mapReplacer));
    return taxIdMapCache;
}

async function addCardToTaxIdMapCache(taxIdMapCache, inat_tax_card)
{
    if( !taxIdMapCache.has(inat_tax_card.id) )
    {
        taxIdMapCache.set(inat_tax_card.id, inat_tax_card);
    }
}
