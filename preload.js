// All the Node.js APIs are available in the preload process.
// It has the same sandbox as a Chrome extension.
const { ipcRenderer } = require('electron');

const userPreferences = {
  colorCycle: true,
  primary_color: 'white',
  secondary_color: 'white',
  tall_bars: true,
  boosted_audio: false,
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
        const pop = ((frequencyData * frequencyData * frequencyData) / (255 * 255 * 255)) * (window.innerHeight * 0.50) * (userPreferences.boosted_audio ? 2 : 1) * (userPreferences.tall_bars ? 2 : 1);
        bar.style.height = pop + 'px';
        bar.style.bottom = currentVisualizer === 'centeredBars' ? ((window.innerHeight * 0.5) - (pop * 0.5)) + 'px' : 0;
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
      const v = (((mediaElement.dataArray[i] / 128.0) - 1) * (userPreferences.boosted_audio ? 2 : 1)) + 1;
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
    // deviceId: '61be88311892ec5aabc55b75980476318c0f810a084962ae146da188f196020f',
    deviceId: 'default',
    kind: 'audioinput'
  },
};

navigator.mediaDevices.enumerateDevices().then((devices) => {
  constraints.audio.deviceId = devices[0].deviceId
  constraints.audio.kind = devices[0].kind
  }).catch((err) => {
  console.error(`${err.name}: ${err.message}`);
});

navigator.mediaDevices.getUserMedia(constraints)
  .then((mediaStream) => {
    setAudioSource(mediaStream)
  })
  .catch((err) => {
    console.error(`${err.name}: ${err.message}`);
  });

let runBarVisualizer;
let drawBarsUpdate;

const setBarVisualizer = () => {
  if (currentVisualizer !== 'bars' && currentVisualizer !== 'centeredBars') {
    document.getElementById('canvas1').style.display = 'none'
    drawBars()
    runBarVisualizer = setInterval(barVis, 17)
    drawBarsUpdate = setInterval(drawBars, 500)
  }
}

const setWaveVisualizer = () => {
  if (currentVisualizer !== 'wave' && currentVisualizer !== 'circle') {
    document.getElementById('canvas1').style.display = 'block'
    if (currentVisualizer === 'bars' || currentVisualizer === 'centeredBars') {
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
    case 'centeredBars':
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

ipcRenderer.on('changeAudioSource', function (event, args) {
  toggleSettingsMenu()
});

ipcRenderer.on('changeSettings', function (event, args) {
  userPreferences.tall_bars = args[0]
  userPreferences.boosted_audio = args[1]
});

const toggleSettingsMenu = () => {
  if (document.getElementById('settingsPanel').style.display !== 'block') {
    document.getElementById('settingsPanel').style.display = 'block'
    navigator.mediaDevices.enumerateDevices().then((e) => {
      if (e.length) {
        const list = document.getElementById('settingsList')
        while (list.firstChild) {
          list.removeChild(list.firstChild);
        }
        e.forEach((device, i) => {
          list.appendChild(document.createElement('li')).id = device.kind + device.deviceId
          document.getElementById(device.kind + device.deviceId).innerText = `${device.kind === 'audioinput' ? '🎙️ — ' : '🔈 — '} ${device.label}`
          document.getElementById(device.kind + device.deviceId).onclick = () => {changeSource(device)}
          if (device.kind + device.deviceId === constraints.audio.kind + constraints.audio.deviceId) {
            document.getElementById(device.kind + device.deviceId).style.color = '#0099ff'
          }
        })
      }
      //else show there are no inputs
      }).catch((err) => {
      console.error(`${err.name}: ${err.message}`);
    });
  } else {
    document.getElementById('settingsPanel').style.display = 'none'
  }
}

const changeSource = (device) => {
  //may need to consider if source no longer exists
  document.getElementById(constraints.audio.kind + constraints.audio.deviceId).style.color = '#fff'
  constraints.audio.deviceId = device.deviceId
  constraints.audio.kind = device.kind
  document.getElementById(constraints.audio.kind + constraints.audio.deviceId).style.color = '#0099ff'
  navigator.mediaDevices.getUserMedia(constraints)
  .then((mediaStream) => {
    setAudioSource(mediaStream)
  })
  .catch((err) => {
    console.error(`${err.name}: ${err.message}`);
  });
}

function updateGUI() {
  document.getElementById('canvas1').setAttribute('height', window.innerHeight);
  document.getElementById('canvas1').setAttribute('width', window.innerWidth);
}

window.addEventListener('DOMContentLoaded', () => {
  setBarVisualizer()
  currentVisualizer = 'centeredBars'
  setInterval(updateGUI, 250);

  document.getElementById('settingsPanel').onclick = (e) => {
    if(e.target.id === 'settingsPanel') {
      toggleSettingsMenu()
    }
  }
})

const keysPressed = [];

document.onkeydown = keyPressed;
document.onkeyup = keyReleased;

function keyPressed(e) {

  const secondaryKey = 17; // control
  // let openVisualizerKey = 86; // v
  const openVisualizerKey = 113; // f2
  const escapeKey = 27;
  // eslint-disable-next-line no-unused-vars
  const devKey = 192; // `

  const viz1Key = 49; // 1
  const viz2Key = 50; // 2
  const viz3Key = 51; // 3
  // const viz4Key = 52; // 4


  if (keysPressed.length == 0 || keysPressed[keysPressed.length - 1] != e.keyCode) {
    keysPressed.push(e.keyCode);
  }

  // if (keysPressed.includes(openVisualizerKey)) {
  //   toggleSettings();
  // }

  if (keysPressed.includes(secondaryKey) && keysPressed.includes(viz1Key)) {
    setActiveVisualizer(0);
  }

  if (keysPressed.includes(secondaryKey) && keysPressed.includes(viz2Key)) {
    setActiveVisualizer(1);
  }

  if (keysPressed.includes(secondaryKey) && keysPressed.includes(viz3Key)) {
    setActiveVisualizer(2);
  }

  if (keysPressed.includes(escapeKey) && document.getElementById('settingsPanel').style.display === 'block') {
    toggleSettingsMenu();
  }

}

function keyReleased(e) {
  keysPressed.pop();
}
