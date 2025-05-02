function generateSpectrogram(fftSize, hopSize, signalWindow, sampleRate, kaiserBeta, audioBuffer, audioContext) {
    const channelData = audioBuffer.getChannelData(0);
    
    // Process audio data in chunks
    let spectrogramData = [];
    let energy = [];
    let maxSpectrogramValue = 0;

    let start = Math.floor(signalWindow.start * sampleRate);
    let stop  = Math.min(Math.floor((signalWindow.start + signalWindow.duration) * sampleRate) + fftSize, channelData.length);

    const beta = kaiserBeta;
    const window = (beta>=0)?kaiserWindow(fftSize, beta):[];

    const numBins = fftSize+1;
    const binsPerKHz = numBins/sampleRate*1000;        
    const firstBin = Math.floor(signalWindow.minFreq * binsPerKHz);
    const lastBin = Math.min(firstBin + Math.floor((signalWindow.maxFreq - signalWindow.minFreq) * binsPerKHz), numBins);

    let minInTime;
    let maxInTime;

    let peakFreq = new Array(numBins);

    for (let i = start; i < stop; i += hopSize) {
        const chunk = channelData.slice(i, i + fftSize);
        if (chunk.length < fftSize) break;

        if(beta>=0) for(let j = 0; j < fftSize; j++) chunk[j] *= window[j];

        const f = new FFT(fftSize);
        const out = f.createComplexArray();
        f.realTransform(out, chunk);

        const magnitude = new Array(numBins);

        let frameEnergy = 0;
        for(j=0;j<fftSize;j++)
        {
            magnitude[j] = Math.sqrt(out[j*2]*out[j*2] + out[j*2+1]*out[j*2+1]);

            peakFreq[j] = (i == start)?magnitude[j]:Math.max(magnitude[j], peakFreq[j]);
        }

        for(j=firstBin;j<lastBin;j++)
        {
            frameEnergy += magnitude[j]; //
            maxSpectrogramValue = Math.max(magnitude[j], maxSpectrogramValue);
        }

        spectrogramData.push(magnitude);
        energy.push(frameEnergy);

        minInTime = (i == start)?frameEnergy:Math.min(minInTime, frameEnergy);
        maxInTime = (i == start)?frameEnergy:Math.max(maxInTime, frameEnergy);
    }

    let minInFreq;
    let maxInFreq;

    for(j=firstBin;j<lastBin;j++)
    {
        minInFreq = (j==firstBin)?peakFreq[j]:Math.min(minInFreq, peakFreq[j]);
        maxInFreq = (j==firstBin)?peakFreq[j]:Math.max(maxInFreq, peakFreq[j]);
    }

    return {
        specData:{data: spectrogramData, maxValue: maxSpectrogramValue},
        timeData:{data: energy, minValue: minInTime, maxValue: maxInTime},
        freqData:{data: peakFreq, minValue:minInFreq, maxValue:maxInFreq}};
}
