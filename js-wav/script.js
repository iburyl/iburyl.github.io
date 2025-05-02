/* Joseph M. Szewczak, 2010
The benefits of full-spectrum data for analyzing bat echolocation calls.
https://sonobat.com/wp-content/uploads/2014/02/presentation.pdf

Oisin Mac Aodha, et. al., 2018    
Bat detective-Deep learning tools for bat acoustic signal detection
https://pmc.ncbi.nlm.nih.gov/articles/PMC5843167/
*/

const tableLine = (name, value) => {return '<tr><td>' + name + '</td><td>' + value + '</td></tr>';};

document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('wavFile');
    const timeCanvas = document.getElementById('timeCanvas');
    const mainCanvas = document.getElementById('mainCanvas');
    const processButton = document.getElementById('processButton');
    const audioElement = document.getElementById('audioPlayer');
    const ctx = mainCanvas.getContext('2d');
    const infoDiv = document.getElementById('info');
    const statsDiv = document.getElementById('stats');
    const findPeakButton = document.getElementById('find_peak');

    // Create tooltip element
    const tooltip = document.createElement('div');
    tooltip.style.position = 'absolute';
    tooltip.style.display = 'none';
    tooltip.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
    tooltip.style.color = 'white';
    tooltip.style.padding = '5px 10px';
    tooltip.style.borderRadius = '4px';
    tooltip.style.fontSize = '12px';
    tooltip.style.pointerEvents = 'none';
    tooltip.style.zIndex = '1000';
    document.body.appendChild(tooltip);

    // Add mouse move handler for tooltip
    mainCanvas.addEventListener('mousemove', (e) => {
        if (!sharedSpecCanvasWindow || !sharedSignalWindow) return;

        const rect = mainCanvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Check if mouse is within the spectrogram area
        if (x >= sharedSpecCanvasWindow.x &&
            x <= sharedSpecCanvasWindow.x + sharedSpecCanvasWindow.width &&
            y >= sharedSpecCanvasWindow.y - sharedSpecCanvasWindow.height &&
            y <= sharedSpecCanvasWindow.y) {
            
            // Calculate time and frequency
            const time = sharedSignalWindow.start + 
                ((x - sharedSpecCanvasWindow.x) / sharedSpecCanvasWindow.width) * sharedSignalWindow.duration;
            
            const freqRange = sharedSignalWindow.maxFreq - sharedSignalWindow.minFreq;
            const freq = sharedSignalWindow.minFreq + 
                ((sharedSpecCanvasWindow.y - y) / sharedSpecCanvasWindow.height) * freqRange;

            // Update tooltip position and content
            tooltip.style.display = 'block';
            tooltip.style.left = (e.clientX + 10) + 'px';
            tooltip.style.top = (e.clientY + 10) + 'px';
            tooltip.textContent = `Time: ${time.toFixed(4)}s, Freq: ${freq.toFixed(1)}kHz`;
        } else {
            tooltip.style.display = 'none';
        }
    });

    mainCanvas.addEventListener('mouseleave', () => {
        tooltip.style.display = 'none';
    });

    const paramFFT = document.getElementById('fft');
    const paramHop = document.getElementById('hop');
    const paramMinE= document.getElementById('min_e');
    const paramKaiserBeta = document.getElementById('kaiser_beta');
    const paramStart= document.getElementById('start');
    const paramStop= document.getElementById('stop');
    const paramMinFreq= document.getElementById('min_freq');
    const paramMaxFreq= document.getElementById('max_freq');
    
    // Set canvas size
    mainCanvas.width = 1600;
    mainCanvas.height = 400;

    let sharedImage;
    let sharedSpecCanvasWindow;
    let sharedSignalWindow;

    audioElement.addEventListener('timeupdate', () => {
        ctx.putImageData(sharedImage, 0, 0);

        ctx.strokeStyle = '#000';
        ctx.lineWidth = 1;

        const currentTime = audioElement.currentTime;
        const duration = sharedSignalWindow.duration;

        let currentX = Math.floor(sharedSpecCanvasWindow.width / duration * (currentTime-sharedSignalWindow.start)) + sharedSpecCanvasWindow.x;

        ctx.beginPath();
        ctx.moveTo(currentX, sharedSpecCanvasWindow.y);
        ctx.lineTo(currentX, sharedSpecCanvasWindow.y - sharedSpecCanvasWindow.height);
        ctx.stroke();

        if(currentTime > sharedSignalWindow.start + sharedSignalWindow.duration)
        {
            audioElement.pause();
            audioElement.currentTime = sharedSignalWindow.start;
        }
    });

    
    function zeroFFT() {
        paramFFT.value = "";
        paramHop.value = "";
    }

    paramStart.addEventListener('change', function() {zeroFFT();} );
    paramStop.addEventListener('change', function() {zeroFFT();} );
    paramMinFreq.addEventListener('change', function() {zeroFFT();} );
    paramMaxFreq.addEventListener('change', function() {zeroFFT();} );
    
    function getUserParams(sampleRate, duration)
    {
        if(paramStart.value == "") paramStart.value = 0;
        if(paramStop.value == "") paramStop.value = duration - Number(paramStart.value);
        if(paramMinFreq.value == "") paramMinFreq.value = 0;
        if(paramMaxFreq.value == "") paramMaxFreq.value = sampleRate / 1000 / 2;

        let userStart =    Number(paramStart.value);
        let userStop  =    Number(paramStop.value);
        let userDuration = Math.min(userStop - userStart, duration);
        let userMinFreq =  Number(paramMinFreq.value);
        let userMaxFreq =  Number(paramMaxFreq.value);
        let userFreqDiff = userMaxFreq - userMinFreq;

        const signalWindow = {start: userStart, duration: userDuration, minFreq: userMinFreq, maxFreq: userMaxFreq};

        let pixelWidth = mainCanvas.width;
        let userPoints = userDuration * sampleRate;

        //const targetFFT = Math.sqrt((sampleRate*sampleRate * mainCanvas.height / mainCanvas.width * userDuration / userFreqDiff)) / 10;
        const targetFFT = Math.sqrt((sampleRate*sampleRate * 400 / 1600 * userDuration / userFreqDiff)) / 10;
        const targetFFT2based = Math.pow(2, Math.round(Math.log2(targetFFT)));
        const defaultFFT = Math.max(Math.min(targetFFT2based, 4096), 128);
        
        if(paramFFT.value == "") paramFFT.value = defaultFFT;
        if(paramHop.value == "") paramHop.value = Math.ceil(userPoints/pixelWidth/5);
        if(paramMinE.value == "") paramMinE.value = -5;
        if(paramKaiserBeta.value == "") paramKaiserBeta.value = 10;

        const fftSize = Number(paramFFT.value);
        let hopSize   = Number(paramHop.value);
        const minE    = Number(paramMinE.value);
        const kaiserBeta = Number(paramKaiserBeta.value);

        statsDiv.innerHTML =
            '<table>' +
            tableLine('Estimated FFT size:', targetFFT2based ) + 
            '</table>';

        return {
            signalWindow: {start: userStart, stop: userStop, duration: userDuration, minFreq: userMinFreq, maxFreq: userMaxFreq, freqDiff: userFreqDiff},
            params: {fftSize: fftSize, hopSize: hopSize, minE: minE, kaiserBeta: kaiserBeta}
            };
    }
    
    fileInput.addEventListener('change', function() {
        zeroFFT();
        paramMinE.value = "";
        paramKaiserBeta.value = "";
        paramStart.value = "";
        paramStop.value = "";
        paramMinFreq.value = "";
        paramMaxFreq.value = "";
    });

    processButton.addEventListener('click', async () => {
        const file = fileInput.files[0];
        if (!file) {
            alert('Please select a WAV file first');
            return;
        }

        try {
            const audioURL = URL.createObjectURL(file);
            document.getElementById('audioPlayer').src = audioURL;

            const arrayBuffer = await file.arrayBuffer();

            let {audioContext, info} = getAudioContext(arrayBuffer, infoDiv);
            const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

            let summary = '<table>';
            if(info.duration) summary += tableLine('Duration:', info.duration.toFixed(2) + 's');
            if(info.sampleRate) summary += tableLine('Sampling rate:', (info.sampleRate/1000).toFixed(0) + 'KHz');
            if(info.dataFormat) summary += tableLine('Data format:', info.dataFormat);
            if(info.bitsPerSample) summary += tableLine('Bits per sample:', info.bitsPerSample);
            if(info.numChannels) summary += tableLine('Channels:', info.numChannels);
            summary += '</table>';

            infoDiv.innerHTML = summary;

            const sampleRate = audioBuffer.sampleRate;
            const duration   = audioBuffer.duration;

            const {signalWindow, params} = getUserParams(sampleRate, duration);

            // Generate spectrogram
            const {specData, timeData, freqData} = generateSpectrogram(params.fftSize, params.hopSize, signalWindow, sampleRate, params.kaiserBeta, audioBuffer, audioContext);

            // Draw spectrogram with axes
            const {image, specCanvasWindow} = drawSpectrogram(specData, timeData, freqData, sampleRate, signalWindow, params.minE, ctx);

            sharedImage = image;
            sharedSpecCanvasWindow = specCanvasWindow;
            sharedSignalWindow = signalWindow;

            audioElement.currentTime = signalWindow.start;
        } 
        catch (error) {
            console.error('Error processing audio:');
            console.error(error);
            alert('Error processing audio file');
        }
    });

    findPeakButton.addEventListener('click', function () {
        
        const {specData, timeData, freqData} = generateSpectrogram(fftSize, hopSize, signalWindow, sampleRate, kaiserBeta, audioBuffer, audioContext);
        
        /*
        try {
        } 
        catch (error) {
            console.error('Error processing audio:');
            console.error(error);
            alert('Some Error');
        }
        */
    });
}); 
