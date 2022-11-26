// All the Node.js APIs are available in the preload process.
// It has the same sandbox as a Chrome extension.
const { ipcRenderer } = require('electron');

const userPreferences = {
  colorCycle: true,
  primary_color: 'white',
  secondary_color: 'white',
  max_height: 200,
  smoothingTimeConstant: 0,
  fftUni: 16384,
  barWidth: 12,
  barSpacing: 2,
};

let barAmnt = 0;
let vizReady = 0;

let mediaElement = {};
//                         bar, wav , cir , amb ,
const visualizerToggles = [false, false, false, false];
// const visualizerToggleFunctions = [toggleBarVis, toggleWaveViz, toggleCircleViz, toggleAmbienceViz];
let visualizerToggleButtons = [];

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

function barVis() {
  mediaElement.analyser.getByteFrequencyData(mediaElement.frequencyData);
  const barColor = userPreferences.colorCycle ? cycleColor() : userPreferences.primary_color;
  for (let i = 0; i < barAmnt; i++) {
    if (vizReady == barAmnt) {
      const bar = document.getElementById('bar' + i)
      const formula = Math.ceil(Math.pow(i, 1.25));
      const frequencyData = mediaElement.frequencyData[formula];
      const pop = ((frequencyData * frequencyData * frequencyData) / (255 * 255 * 255)) * (window.innerHeight * 0.30) * (userPreferences.max_height / 100);
      bar.style.height = pop + 'px';
      bar.style.backgroundColor = barColor;
    }
  }
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
  if (!runBarVisualizer) {
    drawBars()
    runBarVisualizer = setInterval(barVis, 17);
    drawBarsUpdate = setInterval(drawBars, 500);
  }
}

ipcRenderer.on('changeVisualizer', function (event, args) {
  const visualizerType = args[0]
  switch (visualizerType) {
    case 'bars':
      setBarVisualizer()
      break
    case 'wave':
      break
    default:
      break
  }
});

window.addEventListener('DOMContentLoaded', () => {
  setBarVisualizer()
})
