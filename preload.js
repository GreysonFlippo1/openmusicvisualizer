// All the Node.js APIs are available in the preload process.
// It has the same sandbox as a Chrome extension.
const { ipcRenderer } = require('electron');

const userPreferences = {
  colorCycle: true,
  primary_color: 'white',
  secondary_color: 'white',
  max_height: 100,
  smoothingTimeConstant: 0,
  fftUni: 8192,
  barWidth: 12,
  barSpacing: 2,
};

let barAmnt = 0;
let vizReady = 0;

let mediaElement = {};

function drawBars() {
  let barAmntTemp = 0;
  for (let i = 0; i < window.innerWidth + userPreferences.barSpacing + (userPreferences.barWidth / 2); i += (userPreferences.barWidth + userPreferences.barSpacing)) { barAmntTemp++; }
  if (barAmntTemp > barAmnt) {
    for (let i = 0; i < barAmntTemp; i++) {
      if (barAmntTemp > barAmnt) {
        const bars = document.createElement('div');
        bars.setAttribute('id', 'bar' + i);
        bars.classList.add('bars');
        document.body.appendChild(bars);
      }
      document.getElementById('bar' + i).style.left = (userPreferences.barWidth + userPreferences.barSpacing) * (i - 1) + 'px';
      document.getElementById('bar' + i).style.backgroundColor = userPreferences.primary_color;
    }
  } else {
    for (let i = barAmntTemp; i < barAmnt; i++) {
      document.getElementById('bar' + i).remove();
    }
  }

  barAmnt = barAmntTemp;
  vizReady = barAmnt;
}

function removeBars() {
  for (let i = 0; i < barAmnt; i++) {
    document.getElementById('bar' + i).remove();
  }
  barAmnt = 0;
  vizReady = barAmnt;
}

function setAudioSource(stream) {

  const audioCtx = new AudioContext();
  const analyser = audioCtx.createAnalyser();
  analyser.smoothingTimeConstant = userPreferences.smoothingTimeConstant;
  const source = audioCtx.createMediaStreamSource(stream);
  source.connect(analyser);
  analyser.connect(audioCtx.destination);
  analyser.fftSize = userPreferences.fftUni;
  const frequencyData = new Uint8Array(analyser.frequencyBinCount);
  const bufferLength = analyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);

  mediaElement = {
    node: stream,
    attached: true,
    audioCtx,
    analyser,
    frequencyData,
    bufferLength,
    dataArray,
  };
}

let red = 255;
let green = 0;
let blue = 0;

function cycleColor() {
  if (red == 255) {
    if (blue > 0) { blue--; } else { green++; }
  }

  if (green == 255) {
    if (red > 0) { red--; } else { blue++; }
  }

  if (blue == 255) {
    if (green > 0) { green--; } else { red++; }
  }
  return 'rgb(' + red + ',' + green + ',' + blue + ')';
}

let currentVisualizer = 'none'

function barVis() {
  if(mediaElement.analyser) {
    mediaElement.analyser.getByteFrequencyData(mediaElement.frequencyData);
    const barColor = userPreferences.colorCycle ? cycleColor() : userPreferences.primary_color;
    for (let i = 0; i < barAmnt; i++) {
      if (vizReady == barAmnt) {
        const bar = document.getElementById('bar' + i)
        const formula = Math.ceil(Math.pow(i, 1.25));
        const frequencyData = mediaElement.frequencyData[formula];
        const pop = ((frequencyData * frequencyData * frequencyData) / (255 * 255 * 255)) * (window.innerHeight * 0.50) * (userPreferences.max_height / 100);
        bar.style.height = pop + 'px';
        bar.style.backgroundColor = barColor;
      }
    }
  }
}

function waveVis() {
  const canvasCtx = document.getElementById('canvas1').getContext('2d');
  const WIDTH = window.innerWidth;
  const HEIGHT = window.innerHeight;
    mediaElement.analyser.getByteTimeDomainData(mediaElement.dataArray);
    canvasCtx.width = WIDTH;
    canvasCtx.height = HEIGHT;
    canvasCtx.fillStyle = 'rgba(0, 0, 0, 1)';
    canvasCtx.fillRect(0, 0, WIDTH, HEIGHT);
    canvasCtx.strokeStyle = userPreferences.colorCycle ? cycleColor() : userPreferences.primary_color;
    canvasCtx.lineWidth = 3000 / window.innerHeight;
    canvasCtx.shadowColor = '#000';
    canvasCtx.shadowBlur = 1;
    canvasCtx.shadowOffsetX = 0;
    canvasCtx.shadowOffsetY = 0;
    if (currentVisualizer === 'circle') { canvasCtx.lineWidth = 3; }
    canvasCtx.beginPath();
    const sliceWidth = WIDTH / mediaElement.bufferLength * 4;
    const radius1 = HEIGHT / 4;
    let x = 0;
    let lastx = WIDTH / 2 + radius1;
    let lasty = HEIGHT / 2;

    for (let i = mediaElement.bufferLength / 2; i < mediaElement.bufferLength; i++) {
      const v = (((mediaElement.dataArray[i] / 128.0) - 1) * (userPreferences.max_height / 100)) + 1;
      const radius2 = radius1 + (v * v * 150) * (HEIGHT / 1500);
      const y = v * HEIGHT / 2;
      if (currentVisualizer === 'circle') {
          canvasCtx.lineTo((WIDTH / 2) + radius2 * Math.cos(i * (2 * Math.PI) / mediaElement.bufferLength * 2), (HEIGHT / 2) + radius2 * Math.sin(i * (2 * Math.PI) / mediaElement.bufferLength * 2) * -1);
      } else {
          canvasCtx.lineTo(x, y);
      }
      lastx = (WIDTH / 2) + radius2 * Math.cos(i * (2 * Math.PI) / mediaElement.bufferLength);
      lasty = (HEIGHT / 2) + radius2 * Math.sin(i * (2 * Math.PI) / mediaElement.bufferLength) * -1;
      x += sliceWidth;
    }
    if (currentVisualizer === 'circle') { canvasCtx.lineTo(lastx, lasty); }
    canvasCtx.stroke();
    if (currentVisualizer === 'wave' || currentVisualizer === 'circle') { window.requestAnimationFrame(waveVis); }
}

const constraints = {
  audio: {
    deviceId: '61be88311892ec5aabc55b75980476318c0f810a084962ae146da188f196020f',
  },
};

navigator.mediaDevices.getUserMedia(constraints)
  .then((mediaStream) => {
    console.log(mediaStream.getAudioTracks()[0])
    setAudioSource(mediaStream)
  })
  .catch((err) => {
    console.error(`${err.name}: ${err.message}`);
  });


navigator.mediaDevices.enumerateDevices().then((e) => {
  console.log(e)
  }).catch((err) => {
  console.error(`${err.name}: ${err.message}`);
});

let runBarVisualizer;
let drawBarsUpdate;

const setBarVisualizer = () => {
  if (currentVisualizer !== 'bars') {
    document.getElementById('canvas1').style.display = 'none'
    drawBars()
    runBarVisualizer = setInterval(barVis, 17)
    drawBarsUpdate = setInterval(drawBars, 500)
  }
}

const setWaveVisualizer = () => {
  if (currentVisualizer !== 'wave' && currentVisualizer !== 'circle') {
    document.getElementById('canvas1').style.display = 'block'
    if (currentVisualizer === 'bars') {
      clearInterval(drawBarsUpdate)
      clearInterval(runBarVisualizer)
      removeBars()
    }
    window.requestAnimationFrame(waveVis)
  }
}

ipcRenderer.on('changeVisualizer', function (event, args) {
  const visualizerType = args[0]
  switch (visualizerType) {
    case 'bars':
      setBarVisualizer()
      break
    case 'wave':
      setWaveVisualizer()
      break
    case 'circle':
      setWaveVisualizer()
      break
    default:
      break
  }
  currentVisualizer = visualizerType
});

function updateGUI() {
  document.getElementById('canvas1').setAttribute('height', window.innerHeight);
  document.getElementById('canvas1').setAttribute('width', window.innerWidth);
}

window.addEventListener('DOMContentLoaded', () => {
  setBarVisualizer()
  currentVisualizer = 'bars'
  setInterval(updateGUI, 250);
})
