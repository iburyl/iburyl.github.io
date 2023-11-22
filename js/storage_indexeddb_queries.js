let db;

const openRequest = window.indexedDB.open("tax_id_cache", 1);

openRequest.addEventListener("error", () =>
  console.error("Database failed to open"),
);

openRequest.addEventListener("success", () => {
  db = openRequest.result;

  console.log("Database opened successfully");
});

openRequest.addEventListener("upgradeneeded", (e) => {
  db = e.target.result;

  const objectStore = db.createObjectStore("tax_id_cache", {
    keyPath: "id",
    autoIncrement: false,
  });

  objectStore.createIndex("card", "card", { unique: false });

  console.log("Database setup complete");
});

async function getTaxIdMapCache()
{
    let taxIdMapCache = new Map();
    const objectStore = db.transaction("tax_id_cache").objectStore("tax_id_cache");

    await new Promise((resolve, reject) => 
    {
        console.log("Started reading taxIdMapCache from DB...");
        objectStore.openCursor().addEventListener("success", (e) => {
            const cursor = e.target.result;

            if (cursor)
            {
                taxIdMapCache.set(cursor.value.id, cursor.value.card);

                cursor.continue();
            }
            else
            {
                console.log("taxIdMapCache was read from DB");
                resolve();
            }
        });
    });

    return taxIdMapCache;
}

async function startTaxIdMapCacheUpdate(taxIdMapCache)
{
    const transaction = db.transaction(["tax_id_cache"], "readwrite");
    const objectStore = transaction.objectStore("tax_id_cache");

    return {transaction:transaction, objectStore:objectStore, taxIdMapCache:taxIdMapCache};
}


async function finalizeTaxIdMapCacheUpdate(transactionData)
{
    await new Promise((resolve, reject) => 
    {
        transactionData.transaction.addEventListener("complete", () =>
        {
            console.log("Transaction completed: database modification finished.");
            resolve();
        });

        transactionData.transaction.addEventListener("error", () =>
        {
            console.log("Transaction not opened due to error");
            reject();
        });

    });

    return transactionData.taxIdMapCache;
}

async function addCardToTaxIdMapCache(transactionData, inat_tax_card)
{
    if( !transactionData.taxIdMapCache.has(inat_tax_card.id) )
    {
        transactionData.taxIdMapCache.set(inat_tax_card.id, inat_tax_card);

        transactionData.objectStore.put({id: inat_tax_card.id, card: inat_tax_card});
    }
}
