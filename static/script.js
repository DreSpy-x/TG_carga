let globalData = null;  // Almacenar datos globalmente para reutilización en actualizaciones de gráficos
let player = null;  // Almacenar el reproductor de audio globalmente

function uploadAudio() {
    const fileInput = document.getElementById('audioFile');
    const file = fileInput.files[0];
    const formData = new FormData();
    formData.append('file', file);

    fetch('/upload', {
        method: 'POST',
        body: formData,
    }).then(response => response.json())
      .then(data => {
          if (data.error) {
              throw new Error(data.error);
          }
          globalData = data;  // Almacenar datos globalmente
          plotCompleteOscilogram(data.times, data.oscilogram);
          plotCompleteSpectrogram(data.time_bins, data.frequencies, data.spectrogram);
          setupAudioPlayer(file);
      }).catch(error => console.error('Error:', error));
}

function setupAudioPlayer(file) {
    if (player) {
        player.pause();
        player.src = '';
    }

    player = document.getElementById('audioPlayer');
    player.src = URL.createObjectURL(file);
    player.style.display = 'block';
    player.onloadedmetadata = () => {
        player.currentTime = player.duration;  // Posicionar al final
    };
    player.onplay = () => {
        player.currentTime = 0;  // Volver al principio al reproducir
        updateGraphs(player);
    };
    player.ontimeupdate = () => updateGraphs(player);
}

function plotCompleteOscilogram(times, oscilogram) {
    const trace = {
        x: times,
        y: oscilogram,
        mode: 'lines',
        name: 'Oscilogram'
    };
    const layout = {
        title: 'Oscilogram',
        xaxis: { title: 'Time (s)' },
        yaxis: { title: 'Amplitude' }
    };
    Plotly.newPlot('oscilogram', [trace], layout);
}

function plotCompleteSpectrogram(time_bins, frequencies, spectrogram) {
    const data = {
        x: time_bins,
        y: frequencies,
        z: spectrogram,
        type: 'heatmap',
        colorscale: 'Jet',
    };
    const layout = {
        title: 'Spectrogram',
        xaxis: { title: 'Time (s)' },
        yaxis: { title: 'Frequency (Hz)', autorange: false, range: [100, 4000] },
        aspectratio: {x: 1, y: 1}
    };
    Plotly.newPlot('spectrogram', [data], layout);
}

function updateGraphs(player) {
    const currentTime = player.currentTime;
    const totalDuration = player.duration;
    const currentSampleIndex = Math.floor((currentTime / totalDuration) * globalData.times.length);

    // Actualizar el oscilograma para mostrar solo hasta el tiempo actual
    const newOscilogramTrace = {
        x: globalData.times.slice(0, currentSampleIndex),
        y: globalData.oscilogram.slice(0, currentSampleIndex),
        mode: 'lines',
        name: 'Oscilogram'
    };

    Plotly.react('oscilogram', [newOscilogramTrace], {
        title: 'Oscilogram',
        xaxis: { title: 'Time (s)' },
        yaxis: { title: 'Amplitude' }
    });

    // Para el espectrograma, debemos calcular qué porción mostrar basado en el tiempo actual
    const maxTimeIndex = globalData.time_bins.findIndex(t => t > currentTime);
    const newSpectrogramData = {
        x: globalData.time_bins.slice(0, maxTimeIndex),
        y: globalData.frequencies,
        z: globalData.spectrogram.map(row => row.slice(0, maxTimeIndex)),
        type: 'heatmap',
        colorscale: 'Jet',
    };

    Plotly.react('spectrogram', [newSpectrogramData], {
        title: 'Spectrogram',
        xaxis: { title: 'Time (s)' },
        yaxis: { title: 'Frequency (Hz)', autorange: false, range: [100, 4000] },
        aspectratio: {x: 1, y: 1}
    });
}
