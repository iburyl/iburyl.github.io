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

function getAudioContext(arrayBuffer)
{
    const dataView = new DataView(arrayBuffer);

    let audioContext;
    const fmtSectionOffset = findChunk('fmt ', dataView);
    const dataSectionOffset = findChunk('data', dataView);
    if(fmtSectionOffset != -1 && dataSectionOffset != -1)
    {
        format = dataView.getUint16(fmtSectionOffset + 8, true);
        numChannels = dataView.getUint16(fmtSectionOffset + 8 + 2, true);
        sampleRate = dataView.getUint32(fmtSectionOffset + 8 + 4, true);
        bitsPerSample = dataView.getUint16(fmtSectionOffset + 8 + 14, true);

        console.log('Sampling rate:', sampleRate, 'Hz');
        console.log('numChannels', numChannels);
        console.log('Format:', (format==1)?'PCM':(format==3)?'Floating-point':'unknown' + format);
        console.log('Bits per sample:', bitsPerSample);

        dataSize = dataView.getUint32(dataSectionOffset + 4, true);

        durationSeconds = dataSize / (sampleRate * numChannels * (bitsPerSample / 8));

        console.log('Duration:', durationSeconds, 's');

        audioContext = new window.OfflineAudioContext({numberOfChannels:numChannels, length:dataSize, sampleRate: sampleRate});
    }
    else
    {
        audioContext = new window.AudioContext();
    }

    return audioContext;
}

document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('wavFile');
    const canvas = document.getElementById('spectrogramCanvas');
    const processButton = document.getElementById('processButton');
    const audioElement = document.getElementById('audioPlayer');
    const ctx = canvas.getContext('2d');

    // Set canvas size
    canvas.width = 1600;
    canvas.height = 400;

    let max = 0;
    let energy = [];

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

            //const audioContext = new window.OfflineAudioContext({sampleRate: targetSampleRate});
            let audioContext = getAudioContext(arrayBuffer);

            //const arrayBuffer = await file.arrayBuffer();
            const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
            
            // Generate spectrogram
            generateSpectrogram(audioBuffer, audioContext);
        } catch (error) {
            console.error('Error processing audio:', error);
            alert('Error processing audio file');
        }
        
    });

    function generateSpectrogram(audioBuffer, audioContext) {
        //const fftSize = 256*2;
        const fftSize = 256*8;
        const hopSize = fftSize / 4;
        //const hopSize = fftSize / 64;
        //const fftSize = 256;
        //const hopSize = fftSize / 32;
        const sampleRate = audioBuffer.sampleRate;
        const channelData = audioBuffer.getChannelData(0);
        
        // Create analyzer node
        const analyzer = new AnalyserNode(audioContext, {
            fftSize: fftSize,
            smoothingTimeConstant: 0
        });

        console.log('audioBuffer.sampleRate', audioBuffer.sampleRate)
        console.log('time in seconds', channelData.length / audioBuffer.sampleRate)

        // Process audio data in chunks
        let spectrogramData = [];
        let energy = [];
        for (let i = 0; i < channelData.length; i += hopSize) {
            const chunk = channelData.slice(i, i + fftSize);
            if (chunk.length < fftSize) break;

            const f = new FFT(fftSize);
            const out = f.createComplexArray();
            f.realTransform(out, chunk);

            //spectrogramData.push(out.slice(0, fftSize/2));
            spectrogramData.push(out);

            let frameEnergy = 0;
            for(j=0;j<analyzer.frequencyBinCount;j++)
            {
                out[j] = Math.abs(out[j]);
                //frameEnergy += out[j] * out[j];
                frameEnergy += out[j];
                max = Math.max(out[j], max);
            }

            energy.push(frameEnergy);
        }

        // Draw spectrogram with axes
        drawSpectrogram(spectrogramData, audioBuffer.duration, sampleRate, energy);
    }

    function drawSpectrogram(data, duration, sampleRate, energy) {
        // Constants for axis drawing
        const AXIS_Y_PADDING = 50;
        const AXIS_X_PADDING = 30;
        const TICK_LENGTH = 5;
        const LABEL_PADDING = 5;

        const width = canvas.width;
        const height = canvas.height;
        const numFrames = data.length;
        const numBins = data[0].length;

        // Clear canvas
        ctx.clearRect(0, 0, width, height);

        // Calculate spectrogram dimensions
        const spectrogramWidth = width - AXIS_Y_PADDING;
        const spectrogramHeight = height - AXIS_X_PADDING;
        const spectrogramX = AXIS_Y_PADDING;
        const spectrogramY = 0;

        // Draw axes
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 1;
        
        // X-axis
        ctx.beginPath();
        ctx.moveTo(spectrogramX, spectrogramHeight);
        ctx.lineTo(width, spectrogramHeight);
        ctx.stroke();

        // Y-axis
        ctx.beginPath();
        ctx.moveTo(spectrogramX, 0);
        ctx.lineTo(spectrogramX, spectrogramHeight);
        ctx.stroke();

        // Draw time ticks and labels
        const numTimeTicks = 10;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.font = '10px Arial';
        ctx.fillStyle = `#000`;

        for (let i = 0; i <= numTimeTicks; i++) {
            const x = spectrogramX + (i / numTimeTicks) * spectrogramWidth;
            const time = (i / numTimeTicks) * duration;
            
            // Draw tick
            ctx.beginPath();
            ctx.moveTo(x, spectrogramHeight);
            ctx.lineTo(x, spectrogramHeight + TICK_LENGTH);
            ctx.stroke();

            // Draw label
            ctx.fillText(time.toFixed(2) + 's', x, spectrogramHeight + TICK_LENGTH + LABEL_PADDING);
        }

        // Draw frequency ticks and labels
        const maxFreq = sampleRate / 2; // Nyquist frequency
        const numFreqTicks = 8;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';

        for (let i = 0; i <= numFreqTicks; i++) {
            const y = spectrogramHeight - (i / numFreqTicks) * spectrogramHeight;
            const freq = (i / numFreqTicks) * maxFreq;
            
            // Draw tick
            ctx.beginPath();
            ctx.moveTo(spectrogramX - TICK_LENGTH, y);
            ctx.lineTo(spectrogramX, y);
            ctx.stroke();

            // Draw label
            ctx.fillText((freq / 1000).toFixed(0) + 'kHz', spectrogramX - TICK_LENGTH - LABEL_PADDING, y);
        }

        let frameMask = new Array(numFrames);
        let maskMap   = new Array(numFrames);

        const hideFrames = false;

        if(hideFrames)
        {
            let sortedEnergy = energy.toSorted(function(a,b) { return a - b;});
            let maxSilence = sortedEnergy[Math.floor(numFrames*0.1)];

            maxSilence += 10;
            minWindow = 50;

            for(let x=0; x<numFrames; x++)
            {
                if(energy[x] < maxSilence)
                {
                    frameMask[x] = 0;
                }
                else
                {
                    let xx;
                    for(xx=Math.max(x-minWindow,0); xx<Math.min(x+minWindow,numFrames); xx++)
                    {
                        frameMask[xx] = 1;
                    }
                    x = xx;
                }
            }
        }
        else
        {
            frameMask.fill(1);
        }

        let validFrames = 0;
        for(let x=0; x<numFrames; x++)
        {
            if(frameMask[x])
            {
                maskMap[validFrames] = x;
                validFrames++;
            }
        }

        console.log('validFrames: ', validFrames, ' of ', numFrames);


        // Draw spectrogram
        const framesPerPixel = Math.max(Math.floor(numFrames / spectrogramWidth), 1);
        const validFramesPerPixel = Math.max(Math.floor(validFrames / spectrogramWidth), 1);
        const binsPerPixel = Math.max(Math.floor((numBins/2) / spectrogramHeight), 1);

        for(let x=0; x<spectrogramWidth; x++) {
            for(let y=0; y<spectrogramHeight; y++) {
                let firstValidFrame = Math.floor(x * validFrames / spectrogramWidth);
                let firstBin = Math.floor(y * (numBins/2) / spectrogramHeight);

                let firstFrame = maskMap[firstValidFrame];

                if(y==0) console.log(firstValidFrame, firstFrame, framesPerPixel, validFramesPerPixel, numFrames);

                let value = data[firstFrame][firstBin];

                if(validFramesPerPixel > 1)
                {
                    for(let xx=0; xx<framesPerPixel; xx++) {
                        for(let yy=0; yy<binsPerPixel; yy++) {
                            value = Math.max(value, data[firstFrame + xx][firstBin + yy]);
                        }
                    }
                }

                let normalizedValue = Math.log(value);
                let minLog = -5;
                if(normalizedValue < minLog) normalizedValue = minLog;
                normalizedValue = (normalizedValue - minLog) / (Math.log(max) - minLog);

                const colorValue = 255 - Math.floor(normalizedValue * 255);
                ctx.fillStyle = `rgb(${colorValue}, ${colorValue}, ${colorValue})`;
                ctx.fillRect(x+spectrogramX, (spectrogramHeight-y)+spectrogramY, 1, 1);
            }
        }
    }
}); 
