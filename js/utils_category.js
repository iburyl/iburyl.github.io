function getDailyMaxBoxElement( values, averValues, halfFrame, targetTotal )
{
    let length = values.length;

    let maxAverValue=0;
    let maxAverValueIdx=0;
    for(let i=0; i<averValues.length; i++)
    {
        if(averValues[i]>maxAverValue)
        {
            maxAverValue=averValues[i];
            maxAverValueIdx=i;
        }
    }

    let rangeTotal=values[maxAverValueIdx];
    let leftIndex=maxAverValueIdx;
    let rightIndex=maxAverValueIdx;

    // extend range back
    while(1)
    {
        if(rightIndex - leftIndex == length-1) break;

        let leftCorrectedIndex = (length + leftIndex - 1)%length;
        let leftValue = values[leftCorrectedIndex];

        if(averValues[leftCorrectedIndex] > 0.05)
        {
            rangeTotal += leftValue;
            leftIndex--;
        }
        else break;
    }
    while(1)
    {
        if(rightIndex - leftIndex == length-1) break;

        let rightCorrectedIndex = (length + rightIndex + 1)%length;
        let rightValue = values[rightCorrectedIndex];

        if(averValues[rightCorrectedIndex] > 0.05)
        {
            rangeTotal += rightValue;
            rightIndex++;
        }
        else break;
    }

    while(1)
    {
        if(leftIndex == rightIndex) break;

        let leftCorrectedIndex = (length + leftIndex + 1)%length;
        let leftValue = values[leftCorrectedIndex];

        if(values[leftCorrectedIndex]==0)
        {
            rangeTotal -= leftValue;
            leftIndex++;
        }
        else break;
    }
    while(1)
    {
        if(leftIndex == rightIndex) break;

        let rightCorrectedIndex = (length + rightIndex - 1)%length;
        let rightValue = values[rightCorrectedIndex];

        if(values[rightCorrectedIndex]==0)
        {
            rangeTotal -= rightValue;
            rightIndex--;
        }
        else break;
    }

    return {left:leftIndex, right:rightIndex, rangeTotal:rangeTotal};
}

function forEachValueInBox( values, box, func )
{
    for(let i=0; i<values.length; i++)
    {
        let in_box = false;

        in_box = in_box || (i >= box.left && i <= box.right);
        in_box = in_box || (box.left<0 && i >= (box.left + values.length));
        in_box = in_box || (box.right>=values.length && i <= (box.right - values.length));

        if(in_box)
        {
            values[i] = func(values[i]);
        }
    }
}

function getDailyMaxBoxArray( events, targetTotal )
{
    const halfFrame = 14;

    let values = getObservationsPerDay( events );
    let averValues = normalize(getMovingAverage( values, halfFrame ));

    let sum = 0;

    values.forEach((value) => sum+=value);

    let covered = 0;

    let boxes = [];

    while(covered < targetTotal && boxes.length < 4)
    {
        let box = getDailyMaxBoxElement( values, averValues, halfFrame, targetTotal );
        covered += box.rangeTotal;

        boxes.push(box);

        forEachValueInBox( values, box, ()=>0);
        averValues = normalize(getMovingAverage( values, halfFrame ));
        //forEachValueInBox( averValues, box, ()=>0);
    }

    return boxes;
}

let verbose = false;

function joinBoxes( dayBoxes, observations )
{
    let values = getObservationsPerDay( observations );
    const year_length = values.length;

    while(1)
    {
        let changed=false;

        if(verbose) console.log(dayBoxes);

        for(let i=0; i<dayBoxes.length; i++)
        {
            for(let j=0; j<dayBoxes.length; j++)
            {
                if(i==j) continue;

                let new_box;

                let i_left = dayBoxes[i].left;
                let j_left = dayBoxes[j].left;
                let i_right = dayBoxes[i].right;
                let j_right = dayBoxes[j].right;

                if( j_left - i_right > 0 && j_left - i_right < 30 )
                {
                    // if there are several little boxes in the range of 30
                    // some of them may get skipped
                    new_box = {left:i_left, right:j_right};
                }
                else if( j_right >= year_length && i_left-(j_right-year_length) >= 0  && i_left-(j_right-year_length) < 30)
                {
                    new_box = {left:j_left, right:i_right+year_length};
                }
                else if( i_left < 0 && (i_left+year_length)-j_right >= 0  && (i_left+year_length)-j_right < 30)
                {
                    new_box = {left:j_left, right:i_right+year_length};
                }

                if(verbose) console.log([i,j, j_right >= year_length, i_left-(j_right-year_length)]);
                if(verbose) console.log([i,j, i_left < 0, (i_left+year_length)-j_right]);


                if(typeof new_box !== "undefined")
                {
                    new_box.rangeTotal = 0;

                    forEachValueInBox( values, new_box, (val)=>{new_box.rangeTotal+=val; return val;});

                    let new_boxes = [];

                    new_boxes.push(new_box);
                    dayBoxes.forEach( (val, index) => { if(index != i && index != j) new_boxes.push(val); } )
                    dayBoxes = new_boxes;

                    changed = true;
                    break;
                }
            }

            if(changed) break;
        }

        if(!changed) break;
    } 

    return dayBoxes;
}

function getCategory( card )
{
    let observations = card.observations;

    if( observations.length < 10 )
    {
        return {category:'no data'};
    }

    let dayBoxes = getDailyMaxBoxArray( observations, observations.length * 0.95 );
    dayBoxes = joinBoxes( dayBoxes, observations );
    dayBoxes.sort((a,b) => { if(a.rangeTotal > b.rangeTotal) return -1; else return +1; });

    let firstRate = dayBoxes[0].rangeTotal/observations.length;

    let secondRate = 0;
    if(dayBoxes.length>1) secondRate = dayBoxes[1].rangeTotal/observations.length;

    let thirdRate = 0;
    if(dayBoxes.length>2) thirdRate = dayBoxes[2].rangeTotal/observations.length;

    let sumOfBoxesLengths = 0;
    dayBoxes.forEach((box)=>{sumOfBoxesLengths += box.right-box.left});

    let category = 'unclear';
    if( observations.length < 50 && dayBoxes.length>1)
    {
    }
    else if( sumOfBoxesLengths > 366 - dayBoxes.length*45 )
    {
        category = 'All year';

        if(dayBoxes.length>1)
        {
            category += ' almost';
        }
    }
    else if(secondRate > 0.1 && (firstRate+secondRate)>0.8 && secondRate > thirdRate*2)
    {
        category = 'Passthrough';

        if(firstRate+secondRate < 0.9 || dayBoxes.length>2)
        {
            category += ' probably';
        }
    }
    else
    {
        category = 'Seasonal';

        if(firstRate < 0.9 /* || secondRate>0.025*/)
        {
            category += ' rough';
        }
        else if(dayBoxes.length > 1)
        {
            category += ' noisy';
        }
    }

    return {category:category, boxes: dayBoxes, };
}
