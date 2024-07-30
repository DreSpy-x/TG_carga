from flask import Flask, request, render_template, jsonify
import numpy as np
import scipy.io.wavfile
from scipy.signal import butter, lfilter, spectrogram

app = Flask(__name__)

@app.route('/')
def index():
    return render_template('index.html')

def butter_bandpass(lowcut, highcut, fs, order=5):
    nyq = 0.5 * fs
    low = lowcut / nyq
    high = highcut / nyq
    b, a = butter(order, [low, high], btype='band')
    return b, a

def butter_bandpass_filter(data, lowcut, highcut, fs, order=5):
    b, a = butter_bandpass(lowcut, highcut, fs, order=order)
    y = lfilter(b, a, data)
    return y

def normalize_audio(data):
    max_val = np.max(np.abs(data))
    if max_val == 0:
        return data  # Avoid division by zero
    return data / max_val

def spectral_subtraction(Sxx, alpha=4):
    noise_estimate = np.mean(Sxx[:, :10], axis=1)  # Asumiendo que las primeras 10 columnas son ruido
    noise_subtracted = Sxx - alpha * noise_estimate[:, np.newaxis]
    noise_subtracted[noise_subtracted < 0] = 1e-10  # Asegurar no tener valores negativos o cero
    return noise_subtracted

@app.route('/upload', methods=['POST'])
def upload():
    try:
        file = request.files['file']
        if not file:
            return jsonify({'error': 'No file provided'})

        # Read the audio file
        rate, data = scipy.io.wavfile.read(file)
        if len(data.shape) > 1:
            data = data[:, 0]  # Use only the first channel if it's stereo

        # Apply a bandpass filter
        data_filtered = butter_bandpass_filter(data, 300, 3400, rate)

        # Normalize the filtered audio data
        data_normalized = normalize_audio(data_filtered)

        # Generate oscillogram data
        times = np.linspace(0, len(data_normalized) / rate, num=len(data_normalized))
        oscilogram = data_normalized.tolist()

        # Generate spectrogram data
        f, t, Sxx = spectrogram(data_normalized, fs=rate, nperseg=256, noverlap=128)
        Sxx_denoised = spectral_subtraction(Sxx)  # Aplicar reducción de ruido espectral
        spectrogram_dB = 10 * np.log10(Sxx_denoised + 1e-10)  # Convert power to dB

        # Prepare JSON data
        result = {
            'times': times.tolist(),
            'oscilogram': oscilogram,
            'frequencies': f.tolist(),
            'spectrogram': spectrogram_dB.tolist(),
            'time_bins': t.tolist()
        }
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e)})

if __name__ == '__main__':
    app.run(debug=True)
