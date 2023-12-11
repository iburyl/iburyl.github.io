function CSV2Observations(string)
{
    const CSVarrays = CSVToArray(string);
    
    var headers = CSVarrays[0];
    CSVarrays.shift();

    const knownHeaderName = [ "user_login",  "url", "time_observed_at", "scientific_name", "common_name", "quality_grade", "observed_on", "id", "latitude", "longitude", "created_at"];
    let   knownHeaderIdx  = [];
    
    for (let i = 0; i < headers.length; i++) {
        for (let j = 0; j < knownHeaderName.length; j++) {
            if(headers[i] == knownHeaderName[j]) {
                knownHeaderIdx[j] = i;
            }
        }
    }
    const i_user_login   =knownHeaderIdx[0];
    const i_url          =knownHeaderIdx[1];
    const i_time_observed=knownHeaderIdx[2];
    const i_lat_name     =knownHeaderIdx[3];
    const i_lang_name    =knownHeaderIdx[4];
    const i_quality_grade=knownHeaderIdx[5];
    const i_observed_on  =knownHeaderIdx[6];
    const i_id           =knownHeaderIdx[7];
    const i_geo_lat      =knownHeaderIdx[8];
    const i_geo_long     =knownHeaderIdx[9];
    const i_time_uploaded=knownHeaderIdx[10];
    console.log(knownHeaderIdx);

    let observations = [];

    console.log('Total observations: ' + CSVarrays.length);

    for(let i = 0; i < CSVarrays.length; i++) {
        const values = CSVarrays[i];

        let lat_name = values[i_lat_name];
        let observed_time;
        if(values[i_time_observed] != '')
        {
            observed_time = new Date(values[i_time_observed]);
        }
        else if(values[i_observed_on] != '')
        {
            observed_time = new Date(values[i_observed_on]);
        }
        else
        {
            continue;
        }

        if(values.length == 1)
        {
            break;
        }
        if(values.length != headers.length)
        {
            console.log(values);
            console.log("broken line");
            continue;
        }
        
        if( values[i_quality_grade] == "casual" ) continue;

        let lat_name_split = lat_name.split(" ");
        
        let is_identified = (lat_name_split.length >= 2);
        if(!is_identified) continue;

        let is_hybrid = false;
        if( (lat_name_split.length == 3 && lat_name_split[1].length == 1) || lat_name_split.length > 3 )
        {
            is_hybrid = true;
        }
        
        let is_ssp = false;

        if(lat_name_split.length > 2 && !is_hybrid)
        {
            is_ssp = true;
            lat_name = lat_name_split[0] + ' ' + lat_name_split[1]; // remove subspecies
        }

        let is_research = (values[i_quality_grade] == "research");

        let obs = {
            obs_id: values[i_id],
            user_id: values[i_user_login],
            name: values[i_lang_name],
            lat_name_sp: lat_name,
            lat_name: values[i_lat_name],
            time: observed_time,
            upload_time: new Date(values[i_time_uploaded]),
            url: values[i_url],
            is_research: is_research,
            is_ssp: is_ssp,
            is_hybrid: is_hybrid,
            geo_lat: values[i_geo_lat],
            geo_long: values[i_geo_long],
        };

        if (is_ssp)
        {
            obs.lat_name_ssp = Array.from(lat_name_split[0])[0] + '.' + Array.from(lat_name_split[1])[0] + '. ' + lat_name_split[2];
        }

        observations.push(obs);
    }

    return observations;
}

function CSV2Checklist(string)
{
    const CSVarrays = CSVToArray(string);
    
    var headers = CSVarrays[0];
    CSVarrays.shift();

    const knownHeaderName = ["scientific_name"];
    let   knownHeaderIdx  = [];
    
    for (let i = 0; i < headers.length; i++) {
        for (let j = 0; j < knownHeaderName.length; j++) {
            if(headers[i].includes(knownHeaderName[j])) {
                knownHeaderIdx[j] = i;
            }
        }
    }
    const i_lat_name     =knownHeaderIdx[0];
    console.log(knownHeaderIdx);

    let entries = new Map();

    for(let i = 0; i < CSVarrays.length; i++) {
        const values = CSVarrays[i];

        let lat_name = values[i_lat_name];

        if( typeof lat_name === "undefined" || lat_name == "" ) continue;

        let entry = {
            lat_name: lat_name,
        };

        entries.set(lat_name, entry);
    }

    return entries;
}

function Observations2SpeciesMap(observations)
{
    const speciesMap = new Map();

    observations.forEach((obs) => {
        
        let card;
        
        if( !speciesMap.has(obs.lat_name_sp) )
        {
            card = {
                lat_name: obs.lat_name_sp,
                name: obs.name,
                total_observed: 0,
                total_research: 0,
                first_observed: obs,
                last_observed:  obs,
                ssps: new Map(),
                observations: new Array(),
                total_by_month: [0,0,0, 0,0,0, 0,0,0, 0,0,0]
            };

            speciesMap.set(obs.lat_name_sp, card);
        }
        else
        {
            card = speciesMap.get(obs.lat_name_sp);
        }

        card.observations.push( obs );
        card.total_observed += 1;
        card.total_research += (obs.is_research)?1:0;
        card.total_by_month[obs.time.getMonth()] += 1;

        if( !obs.is_hybrid && !obs.is_ssp && card.name != obs.name )
        {
            card.name = obs.name;
        }

        let time = obs.time;
        
        if( time < card.first_observed.time )
        {
            card.first_observed = obs;
        }

        if( time > card.last_observed.time )
        {
            card.last_observed = obs;
        }

        if( obs.is_research )
        {
            if( typeof card.first_research === "undefined" || obs.time < card.first_research.time )
            {
                card.first_research = obs;
            }
        }

        if( obs.is_ssp )
        {
            if( card.ssps.has(obs.lat_name_ssp) )
            {
                num = card.ssps.get(obs.lat_name_ssp);
                num += 1;
                card.ssps.set(obs.lat_name_ssp, num);
            }
            else
            {
                card.ssps.set(obs.lat_name_ssp, 1);
            }
        }
    } );

    console.log('Total species: ' + speciesMap.size);

    return speciesMap;
}
