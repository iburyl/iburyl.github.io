async function fetchAsync (url) {
    let response = await fetch(url);
    let data = await response.json();
    return data;
};

function createThead(trArray) {
  let thead = document.createElement("thead");
  trArray.forEach((tr) => thead.appendChild(tr));
  return thead;
}

function createTr(tdArray, trClass) {
  let tr = document.createElement("tr");

  if(typeof trClass !== "undefined")
  {
    tr.setAttribute('class', trClass);
  }

  for (var i = 0; i < tdArray.length; i++) {
      let td = document.createElement("td");
      
      if( tdArray[i] instanceof HTMLElement )
      {
          td.appendChild( tdArray[i] );
      }
      else if( Array.isArray(tdArray[i]) )
      {
          td.setAttribute(tdArray[i][0], tdArray[i][1]);

          if( tdArray[i][2] instanceof HTMLElement )
          {
            td.appendChild( tdArray[i][2] );
          }
          else
          {
            td.innerHTML = tdArray[i][2];
          }
      }
      else
      {
          td.innerHTML = tdArray[i];
      }
      
      tr.appendChild( td );
  }

  return tr;
}

function addSorting( table, headerRowNum )
{
    // Column sorting block
    const getCellValue = (tr, idx) => {
        let data = tr.children[idx].getAttribute('data-sorting');
        if(data !== null && data !== '') return data;
        return tr.children[idx].innerText || tr.children[idx].textContent;
    };

    const comparer = (idx, asc) => (a, b) => ((v1, v2) => 
        v1 !== '' && v2 !== '' && !isNaN(v1) && !isNaN(v2) ? v1 - v2 : v1.toString().localeCompare(v2)
        )(getCellValue(asc ? a : b, idx), getCellValue(asc ? b : a, idx));

    // do the work...
    table.querySelector('tr:nth-child('+headerRowNum+')').querySelectorAll('td').forEach(td => td.addEventListener('click', (() =>
    {
        Array.from(table.querySelectorAll('tr:nth-child(n+'+(headerRowNum+1)+')'))
            .sort(comparer(Array.from(td.parentNode.children).indexOf(td), this.asc = !this.asc))
            .forEach(tr => table.appendChild(tr) );
    })));
}

function getSpan() {return document.createElement("span");}
        
