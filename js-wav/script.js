/* Joseph M. Szewczak, 2010
The benefits of full-spectrum data for analyzing bat echolocation calls.
https://sonobat.com/wp-content/uploads/2014/02/presentation.pdf

Oisin Mac Aodha, et. al., 2018    
Bat detective-Deep learning tools for bat acoustic signal detection
https://pmc.ncbi.nlm.nih.gov/articles/PMC5843167/
*/

function findChunk(name, dataView) {
    let offset = 12;
    while (offset < dataView.byteLength) {
        const chunkID = String.fromCharCode(
            dataView.getUint8(offset),
            dataView.getUint8(offset + 1),
            dataView.getUint8(offset + 2),
            dataView.getUint8(offset + 3)
        );
        const chunkSize = dataView.getUint32(offset + 4, true);

        if (chunkID === name) {
            return offset; // start of "fmt " chunk
        }
        offset += 8 + chunkSize + (chunkSize % 2); // align to even
    }
    return -1;
}

function getAudioContext(arrayBuffer, infoDiv)
{
    const dataView = new DataView(arrayBuffer);

    let audioContext;
    let summary = '';
    const fmtSectionOffset = findChunk('fmt ', dataView);
    const dataSectionOffset = findChunk('data', dataView);
    if(fmtSectionOffset != -1 && dataSectionOffset != -1)
    {
        format = dataView.getUint16(fmtSectionOffset + 8, true);
        numChannels = dataView.getUint16(fmtSectionOffset + 8 + 2, true);
            sampleRate = dataView.getUint32(fmtSectionOffset + 8 + 4, true);
        bitsPerSample = dataView.getUint16(fmtSectionOffset + 8 + 14, true);
     
        dataSize = dataView.getUint32(dataSectionOffset + 4, true);

        durationSeconds = dataSize / (sampleRate * numChannels * (bitsPerSample / 8));

        const pre = '<tr><td>';
        const mid = '</td><td>';
        const post= '</td></tr>';

        const addLine = (name, value) => {return '<tr><td>' + name + '</td><td>' + value + '</td></tr>';};

        summary = summary +
            '<table>' +
            addLine('Duration:', durationSeconds.toFixed(2) + 's') + 
            addLine('Sampling rate:', (sampleRate/1000).toFixed(0) + 'KHz') + 
            addLine('Data format:', (format==1)?'PCM':(format==3)?'Floating-point':'unknown') + 
            addLine('Bits per sample:', bitsPerSample) + 
            addLine('Channels:', numChannels) + 
            '</table>';

        audioContext = new window.OfflineAudioContext({numberOfChannels:numChannels, length:dataSize, sampleRate: sampleRate});

    }
    else
    {
        audioContext = new window.AudioContext();
    }

    infoDiv.innerHTML = summary + infoDiv.innerHTML;

    return audioContext;
}

document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('wavFile');
    const canvas = document.getElementById('spectrogramCanvas');
    const processButton = document.getElementById('processButton');
    const audioElement = document.getElementById('audioPlayer');
    const ctx = canvas.getContext('2d');
    const infoDiv = document.getElementById('info');


    const paramFFT = document.getElementById('fft');
    const paramHop = document.getElementById('hop');
    const paramMinE= document.getElementById('min_e');
    const paramKaiserBeta = document.getElementById('kaiser_beta');
    const paramStart= document.getElementById('start');
    const paramStop= document.getElementById('stop');
    const paramMinFreq= document.getElementById('min_freq');
    const paramMaxFreq= document.getElementById('max_freq');
    
    // Set canvas size
    canvas.width = 1600;
    canvas.height = 400;

    let sharedImage;
    let sharedCanvasWindow;
    let sharedDuration;

    audioElement.addEventListener('timeupdate', () => {
        ctx.putImageData(sharedImage, 0, 0);

        ctx.strokeStyle = '#000';
        ctx.lineWidth = 1;

        let currentTime = audioElement.currentTime;

        let currentX = Math.floor(sharedCanvasWindow.width / sharedDuration * currentTime) + sharedCanvasWindow.x;

        ctx.beginPath();
        ctx.moveTo(currentX, 0);
        ctx.lineTo(currentX, sharedCanvasWindow.height);
        ctx.stroke();
    });

    fileInput.addEventListener('change', function() {
        paramFFT.value = "";
        paramHop.value = "";
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

            infoDiv.innerHTML = '';

            const arrayBuffer = await file.arrayBuffer();

            let audioContext = getAudioContext(arrayBuffer, infoDiv);

            const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

            const sampleRate = audioBuffer.sampleRate;
            const duration   = audioBuffer.duration;
            console.log('audioBuffer.sampleRate', audioBuffer.sampleRate)
            console.log('time in seconds', duration)

            sharedDuration = duration;

            //const fftSize = 2048;
            if(paramFFT.value == "") paramFFT.value = 2048;
            if(paramHop.value == "") paramHop.value = 2048/4;
            if(paramMinE.value == "") paramMinE.value = -5;
            if(paramKaiserBeta.value == "") paramKaiserBeta.value = 10;
            if(paramStart.value == "") paramStart.value = 0;
            if(paramStop.value == "") paramStop.value = duration - Number(paramStart.value);
            if(paramMinFreq.value == "") paramMinFreq.value = 0;
            if(paramMaxFreq.value == "") paramMaxFreq.value = sampleRate/2;

            const fftSize = Number(paramFFT.value);
            let hopSize   = Number(paramHop.value);
            const minE    = Number(paramMinE.value);
            const kaiserBeta = Number(paramKaiserBeta.value);
            let userStart =    Number(paramStart.value);
            let userDuration = Math.min(Number(paramStop.value) - Number(paramStart.value), duration);
            let userMinFreq =  Number(paramMinFreq.value);
            let userMaxFreq =  Number(paramMaxFreq.value);

            const signalWindow = {start: userStart, duration: userDuration, minFreq: userMinFreq, maxFreq: userMaxFreq};

            //console.log(fftSize, hopSize, minE);
            //console.log('number of hops', (sampleRate * duration) / hopSize);            
            //if( (sampleRate * duration) / hopSize < 1000 ) hopSize = Math.ceil( (sampleRate * duration) / 2000 );
            //console.log('hopSize', hopSize);

            // Generate spectrogram
            const {spectrogramData, maxSpectrogramValue, energyData} = generateSpectrogram(fftSize, hopSize, signalWindow, sampleRate, kaiserBeta, audioBuffer, audioContext);

            // Draw spectrogram with axes
            const {image, canvasWindow} = drawSpectrogram(spectrogramData, maxSpectrogramValue, signalWindow, minE, ctx);

            sharedImage = image;
            sharedCanvasWindow = canvasWindow;

        } 
        catch (error) {
            console.error('Error processing audio:');
            console.error(error);
            alert('Error processing audio file');
        }
        
    });

    function kaiserWindow(N, beta) {
        /* https://en.wikipedia.org/wiki/Kaiser_window */
        function besselI0(x) {
            let sum = 1.0;
            let y = x * x / 4.0;
            let t = y;
            for (let i = 1; t > 1e-8 * sum; i++) {
                sum += t;
                t *= y / (i * i);
            }
            return sum;
        }

        const window = new Array(N);
        const denom = besselI0(beta);
        const halfN = (N - 1) / 2;
    
        for (let n = 0; n < N; n++) {
            let ratio = (n - halfN) / halfN;
            let arg = beta * Math.sqrt(1 - ratio * ratio);
            window[n] = besselI0(arg) / denom;
        }

        return window;
    }

    function generateSpectrogram(fftSize, hopSize, signalWindow, sampleRate, kaiserBeta, audioBuffer, audioContext) {
        const channelData = audioBuffer.getChannelData(0);
        
        // Process audio data in chunks
        let spectrogramData = [];
        let energy = [];
        let maxSpectrogramValue = 0;

        let start = Math.floor(signalWindow.start * sampleRate);
        let stop  = Math.min(Math.floor((signalWindow.start + signalWindow.duration) * sampleRate) + fftSize, channelData.length);

        const beta = kaiserBeta;
        const window = kaiserWindow(fftSize, beta);

        for (let i = start; i < stop; i += hopSize) {
            const chunk = channelData.slice(i, i + fftSize);
            if (chunk.length < fftSize) break;

            for(let j = 0; j < fftSize; j++) chunk[j] *= window[j];

            const f = new FFT(fftSize);
            const out = f.createComplexArray();
            f.realTransform(out, chunk);

            spectrogramData.push(out);

            let frameEnergy = 0;
            for(j=0;j<fftSize;j++)
            {
                out[j] = Math.abs(out[j]);
                //frameEnergy += out[j] * out[j];
                frameEnergy += out[j];
                maxSpectrogramValue = Math.max(out[j], maxSpectrogramValue);
            }

            energy.push(frameEnergy);
        }

        return {spectrogramData: spectrogramData, maxSpectrogramValue: maxSpectrogramValue, energyData: energy};
    }

    function drawSpectrogramWindow(firstFrame, lastFrame, firstBin, lastBin, canvasWindow, data, maxSpectrogramValue, minE, ctx) {
        let numFrames = lastFrame - firstFrame;
        let numBins   = lastBin - firstBin;

        // Draw spectrogram
        const framesPerPixel = Math.max(Math.floor(numFrames / canvasWindow.width), 1);
        const binsPerPixel = Math.max(Math.floor(numBins / canvasWindow.height), 1);

        for(let x=0; x<canvasWindow.width; x++) {
            for(let y=0; y<canvasWindow.height; y++) {
                let firstPixelFrame = firstFrame + Math.floor(x * numFrames / canvasWindow.width);
                let firstPixelBin = firstBin + Math.floor(y * numBins / canvasWindow.height);

                let value = data[firstPixelFrame][firstPixelBin];

                if(framesPerPixel > 1)
                {
                    for(let xx=0; xx<framesPerPixel; xx++) {
                        for(let yy=0; yy<binsPerPixel; yy++) {
                            value = Math.max(value, data[firstPixelFrame + xx][firstPixelBin + yy]);
                        }
                    }
                }

                let normalizedValue = Math.log(value);
                let minLog = minE;
                if(normalizedValue < minLog) normalizedValue = minLog;
                normalizedValue = (normalizedValue - minLog) / (Math.log(maxSpectrogramValue) - minLog);

                const colorValue = 255 - Math.floor(normalizedValue * 255);
                ctx.fillStyle = `rgb(${colorValue}, ${colorValue}, ${colorValue})`;
                ctx.fillRect(canvasWindow.x+x, canvasWindow.y-y, 1, 1);
            }
        }
    }

    function drawTimeAxisX(signalWindow, canvasWindow, tickLen, labelPadding, ctx) {
        // X-axis
        ctx.beginPath();
        ctx.moveTo(canvasWindow.x, canvasWindow.y);
        ctx.lineTo(canvasWindow.x + canvasWindow.width, canvasWindow.y);
        ctx.stroke();

        // Draw time ticks and labels
        const numTimeTicks = 10;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';

        for (let i = 0; i <= numTimeTicks; i++) {
            const x = canvasWindow.x + (i / numTimeTicks) * canvasWindow.width;
            const time = signalWindow.start + (i / numTimeTicks) * signalWindow.duration;
            
            // Draw tick
            ctx.beginPath();
            ctx.moveTo(x, canvasWindow.y);
            ctx.lineTo(x, canvasWindow.y + tickLen);
            ctx.stroke();

            // Draw label
            ctx.fillText(time.toFixed(3) + 's', x, canvasWindow.y + tickLen + labelPadding);
        }
    }

    function drawFreqAxisY(maxFreq, canvasWindow, tickLen, labelPadding, ctx) {
        // Y-axis
        ctx.beginPath();
        ctx.moveTo(canvasWindow.x, 0);
        ctx.lineTo(canvasWindow.x, canvasWindow.height);
        ctx.stroke();

        // Draw frequency ticks and labels
        const numFreqTicks = 8;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';

        for (let i = 0; i <= numFreqTicks; i++) {
            const y = canvasWindow.height - (i / numFreqTicks) * canvasWindow.height;
            const freq = (i / numFreqTicks) * maxFreq;
            
            // Draw tick
            ctx.beginPath();
            ctx.moveTo(canvasWindow.x - tickLen, y);
            ctx.lineTo(canvasWindow.x, y);
            ctx.stroke();

            // Draw label
            ctx.fillText((freq / 1000).toFixed(0) + 'kHz', canvasWindow.x - tickLen - labelPadding, y);
        }
    }

    function drawSpectrogram(data, maxSpectrogramValue, signalWindow, minE, ctx) {
        const duration = signalWindow.duration;
        const sampleRate = signalWindow.maxFreq - signalWindow.minFreq;

        // Constants for axis drawing
        const AXIS_Y_PADDING = 50;
        const AXIS_X_PADDING = 30;
        const TICK_LENGTH = 5;
        const LABEL_PADDING = 5;

        const width = canvas.width;
        const height = canvas.height;
        const numFrames = data.length;
        const numBins = data[0].length;

        // Calculate spectrogram dimensions
        const spectrogramWidth = width - AXIS_Y_PADDING;
        const spectrogramHeight = height - AXIS_X_PADDING;
        const spectrogramX = AXIS_Y_PADDING;
        const spectrogramY = spectrogramHeight;

        let canvasWindow = {x: spectrogramX, y:spectrogramY, width:spectrogramWidth, height:spectrogramHeight};

        // Clear canvas
        ctx.clearRect(0, 0, width, height);

        drawSpectrogramWindow(0, numFrames, 0, numBins/2, canvasWindow, data, maxSpectrogramValue, minE, ctx);

        // Draw axes
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 1;
                
        ctx.font = '10px Arial';
        ctx.fillStyle = `#000`;

        drawTimeAxisX(signalWindow, canvasWindow, TICK_LENGTH, LABEL_PADDING, ctx);

        const maxFreq = sampleRate / 2; // Nyquist frequency

        drawFreqAxisY(maxFreq, canvasWindow, TICK_LENGTH, LABEL_PADDING, ctx);

        return {image: ctx.getImageData(0, 0, width, height), canvasWindow: canvasWindow};
    }
}); 
