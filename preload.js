// All the Node.js APIs are available in the preload process.
// It has the same sandbox as a Chrome extension.
const { ipcRenderer } = require('electron')

const userPreferences = {
  color_cycle: true,
  primary_color: 'white',
  secondary_color: 'white',
  tall_bars: true,
  rounded_bars: true,
  boosted_audio: false,
  smoothingTimeConstant: 0,
  fftUni: 8192,
  barWidth: 12,
  barSpacing: 2
}

let mediaElement = {}

function setAudioSource (stream) {
  const audioCtx = new AudioContext()
  const analyser = audioCtx.createAnalyser()
  analyser.smoothingTimeConstant = userPreferences.smoothingTimeConstant
  const source = audioCtx.createMediaStreamSource(stream)
  source.connect(analyser)
  analyser.connect(audioCtx.destination)
  analyser.fftSize = userPreferences.fftUni
  const frequencyData = new Uint8Array(analyser.frequencyBinCount)
  const bufferLength = analyser.frequencyBinCount
  const dataArray = new Uint8Array(bufferLength)

  mediaElement = {
    node: stream,
    attached: true,
    audioCtx,
    analyser,
    frequencyData,
    bufferLength,
    dataArray
  }
}

let red = 255
let green = 0
let blue = 0

const redPhase = (colors, increment) => {
  if (colors.blue > 0) {
    colors.blue -= increment
    if (colors.blue < 0) {
      colors.green = 0 - colors.blue
      colors.blue = 0
    }
  } else {
    colors.green += increment
    if (colors.green > 255) {
      colors.red = 255 - (colors.green - 255)
      colors.green = 255
    }
  }

  return colors
}

const greenPhase = (colors, increment) => {
  if (colors.red > 0) {
    colors.red -= increment
    if (colors.red < 0) {
      colors.blue = 0 - colors.red
      colors.red = 0
    }
  } else {
    colors.blue += increment
    if (colors.blue > 255) {
      colors.green = 255 - (colors.blue - 255)
      colors.blue = 255
    }
  }

  return colors
}

const bluePhase = (colors, increment) => {
  if (colors.green > 0) {
    colors.green -= increment
    if (colors.green < 0) {
      colors.red = 0 - colors.green
      colors.green = 0
    }
  } else {
    colors.red += increment
    if (colors.red > 255) {
      colors.blue = 255 - (colors.red - 255)
      colors.red = 255
    }
  }

  return colors
}

function cycleColor (update = false, increment = 1) {
  increment = Math.ceil(increment)

  let colors = {
    red,
    green,
    blue
  }

  if (colors.red === 255) {
    colors = redPhase(colors, increment)
  } else if (colors.green === 255) {
    colors = greenPhase(colors, increment)
  } else if (colors.blue === 255) {
    colors = bluePhase(colors, increment)
  }

  if (update) {
    red = colors.red
    green = colors.green
    blue = colors.blue
  }

  return 'rgb(' + colors.red + ',' + colors.green + ',' + colors.blue + ')'
}

let currentVisualizer = 'none'

function barVis () {
  const canvas = document.getElementById('canvas1')
  const canvasCtx = canvas.getContext('2d', { alpha: false })
  const dpr = window.devicePixelRatio
  const rect = canvas.getBoundingClientRect()
  const WIDTH = rect.width
  const HEIGHT = rect.height
  canvas.width = rect.width * dpr
  canvas.height = rect.height * dpr
  canvasCtx.scale(dpr, dpr)
  canvasCtx.clearRect(0, 0, WIDTH, HEIGHT)
  canvasCtx.fillStyle = 'rgba(0, 0, 0, 0)'
  canvasCtx.fillRect(0, 0, WIDTH, HEIGHT)

  if (mediaElement.analyser) {
    mediaElement.analyser.getByteFrequencyData(mediaElement.frequencyData)
    const borderRadius = userPreferences.rounded_bars ? '6' : '0'
    const barAmnt = (WIDTH / (userPreferences.barWidth + userPreferences.barSpacing)) + 1

    const gradient = canvasCtx.createLinearGradient(0, 0, WIDTH, 0)
    gradient.addColorStop(0, cycleColor(true))
    gradient.addColorStop(1, cycleColor(false, 100))

    for (let i = 0; i < barAmnt; i++) {
      const formula = Math.ceil(Math.pow(i, 1.25))
      const frequencyData = mediaElement.frequencyData[formula]
      let pop = ((frequencyData * frequencyData * frequencyData) / (255 * 255 * 255)) * (HEIGHT * 0.50) * (userPreferences.boosted_audio ? 2 : 1) * (userPreferences.tall_bars ? 2 : 1)
      if (userPreferences.rounded_bars && pop < 12) {
        pop = 12
      }
      canvasCtx.beginPath()
      canvasCtx.roundRect(
        (userPreferences.barWidth + userPreferences.barSpacing) * (i - 1), // x
        currentVisualizer === 'centeredBars' ? ((HEIGHT * 0.5) - (pop * 0.5)) : (HEIGHT - pop), // y
        userPreferences.barWidth, // width
        pop, // height
        borderRadius // border radius
      )

      canvasCtx.fillStyle = userPreferences.color_cycle ? gradient : userPreferences.primary_color
      canvasCtx.fill()
    }
  }
  if (currentVisualizer === 'bars' || currentVisualizer === 'centeredBars') { window.requestAnimationFrame(barVis) }
}

function waveVis () {
  const canvas = document.getElementById('canvas1')
  const canvasCtx = canvas.getContext('2d', { alpha: false })
  const dpr = window.devicePixelRatio
  const rect = canvas.getBoundingClientRect()
  const WIDTH = rect.width
  const HEIGHT = rect.height
  canvas.width = rect.width * dpr
  canvas.height = rect.height * dpr
  canvasCtx.scale(dpr, dpr)

  mediaElement.analyser.getByteTimeDomainData(mediaElement.dataArray)
  canvasCtx.clearRect(0, 0, WIDTH, HEIGHT)
  canvasCtx.fillStyle = 'rgba(0, 0, 0, 0)'
  canvasCtx.fillRect(0, 0, WIDTH, HEIGHT)

  const gradient = canvasCtx.createLinearGradient(0, 0, WIDTH, 0)
  gradient.addColorStop(0, cycleColor(true))
  gradient.addColorStop(1, cycleColor(false, 100))

  canvasCtx.strokeStyle = userPreferences.color_cycle ? gradient : userPreferences.primary_color
  canvasCtx.lineWidth = 3000 / HEIGHT
  canvasCtx.shadowColor = '#000'
  canvasCtx.shadowBlur = 1
  canvasCtx.shadowOffsetX = 0
  canvasCtx.shadowOffsetY = 0
  if (currentVisualizer === 'circle') { canvasCtx.lineWidth = 3 }
  canvasCtx.beginPath()
  const sliceWidth = WIDTH / mediaElement.bufferLength * 4
  const radius1 = HEIGHT / 4
  let x = 0
  let lastx = WIDTH / 2 + radius1
  let lasty = HEIGHT / 2

  for (let i = mediaElement.bufferLength / 2; i < mediaElement.bufferLength; i++) {
    const v = (((mediaElement.dataArray[i] / 128.0) - 1) * (userPreferences.boosted_audio ? 2 : 1)) + 1
    const radius2 = radius1 + (v * v * 150) * (HEIGHT / 1500)
    const y = v * HEIGHT / 2
    if (currentVisualizer === 'circle') {
      canvasCtx.lineTo((WIDTH / 2) + radius2 * Math.cos(i * (2 * Math.PI) / mediaElement.bufferLength * 2), (HEIGHT / 2) + radius2 * Math.sin(i * (2 * Math.PI) / mediaElement.bufferLength * 2) * -1)
    } else {
      canvasCtx.lineTo(x, y)
    }
    lastx = (WIDTH / 2) + radius2 * Math.cos(i * (2 * Math.PI) / mediaElement.bufferLength)
    lasty = (HEIGHT / 2) + radius2 * Math.sin(i * (2 * Math.PI) / mediaElement.bufferLength) * -1
    x += sliceWidth
  }
  if (currentVisualizer === 'circle') { canvasCtx.lineTo(lastx, lasty) }
  canvasCtx.stroke()
  if (currentVisualizer === 'wave' || currentVisualizer === 'circle') { window.requestAnimationFrame(waveVis) }
}

function concentricCirclesViz () {
  const canvas = document.getElementById('canvas1')
  const canvasCtx = canvas.getContext('2d', { alpha: false })
  const dpr = window.devicePixelRatio
  const rect = canvas.getBoundingClientRect()
  const WIDTH = rect.width
  const HEIGHT = rect.height
  canvas.width = rect.width * dpr
  canvas.height = rect.height * dpr
  canvasCtx.scale(dpr, dpr)

  canvasCtx.clearRect(0, 0, WIDTH, HEIGHT)
  canvasCtx.fillStyle = 'rgba(0, 0, 0, 0)'
  canvasCtx.fillRect(0, 0, WIDTH, HEIGHT)

  const gradient = canvasCtx.createRadialGradient(WIDTH / 2, HEIGHT / 2, 5, WIDTH / 2, HEIGHT / 2, HEIGHT / 3)
  gradient.addColorStop(0, cycleColor(true))
  gradient.addColorStop(1, cycleColor(false, 200))

  if (mediaElement.analyser) {
    mediaElement.analyser.getByteFrequencyData(mediaElement.frequencyData)
    const circleAmount = 8
    const largestCircle = 12
    const maxSize = HEIGHT / 2
    for (let i = 0; i < circleAmount; i++) {
      const formula = Math.ceil(Math.pow(i, 2.5))
      const frequencyData = mediaElement.frequencyData[formula]
      const circleColor = userPreferences.color_cycle ? gradient : userPreferences.primary_color
      canvasCtx.strokeStyle = circleColor
      canvasCtx.lineWidth = largestCircle - ((largestCircle * i) / circleAmount)
      canvasCtx.beginPath()
      canvasCtx.arc(WIDTH / 2, HEIGHT / 2, ((frequencyData * frequencyData) / (255 * 255)) * maxSize, 0, 2 * Math.PI, true)
      canvasCtx.stroke()
    }
  }
  if (currentVisualizer === 'concentricCircles') { window.requestAnimationFrame(concentricCirclesViz) }
}

// function bubbleVis () {

// }

const constraints = {
  audio: {
    // deviceId: '61be88311892ec5aabc55b75980476318c0f810a084962ae146da188f196020f',
    deviceId: 'default',
    kind: 'audioinput'
  }
}

ipcRenderer.on('initAudio', function (event, args) {
  const isMac = args[1]

  if (isMac) {
    navigator.mediaDevices.enumerateDevices().then((devices) => {
      constraints.audio.deviceId = devices[0].deviceId
      constraints.audio.kind = devices[0].kind
    }).catch((err) => {
      console.error(`${err.name}: ${err.message}`)
    })

    navigator.mediaDevices.getUserMedia(constraints)
      .then((mediaStream) => {
        setAudioSource(mediaStream)
      })
      .catch((err) => {
        console.error(`${err.name}: ${err.message}`)
      })
  } else {
    const winConstraints = {
      audio: {
        mandatory: {
          chromeMediaSource: 'desktop'
        }
      },
      video: {
        mandatory: {
          chromeMediaSource: 'desktop'
        }
      }
    }
    navigator.mediaDevices.getUserMedia(winConstraints)
      .then((mediaStream) => {
        setAudioSource(mediaStream)
      })
      .catch((err) => {
        console.error(`${err.name}: ${err.message}`)
      })
  }
})

const setBarVisualizer = () => {
  window.requestAnimationFrame(barVis)
}

const setWaveVisualizer = () => {
  window.requestAnimationFrame(waveVis)
}

const setConcentricCircles = () => {
  window.requestAnimationFrame(concentricCirclesViz)
}

const setBubbleVisualizer = () => {
  // window.requestAnimationFrame(bubbleViz)
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
    case 'concentricCircles':
      setConcentricCircles()
      break
    case 'bubbles':
      setBubbleVisualizer()
      break
    default:
      break
  }
  currentVisualizer = visualizerType
})

ipcRenderer.on('changeAudioSource', function (event, args) {
  toggleSettingsMenu()
})

ipcRenderer.on('changeSettings', function (event, args) {
  userPreferences.tall_bars = args[0]
  userPreferences.boosted_audio = args[1]
  userPreferences.rounded_bars = args[2]
  userPreferences.color_cycle = args[3]
})

const toggleSettingsMenu = (isMac) => {
  if (document.getElementById('settingsPanel').style.display !== 'block') {
    document.getElementById('settingsPanel').style.display = 'block'
    navigator.mediaDevices.enumerateDevices().then((e) => {
      if (e.length) {
        const list = document.getElementById('settingsList')
        while (list.firstChild) {
          list.removeChild(list.firstChild)
        }
        e.forEach((device, i) => {
          list.appendChild(document.createElement('li')).id = device.kind + device.deviceId
          document.getElementById(device.kind + device.deviceId).innerText = `${device.kind === 'audioinput' ? '🎙️ — ' : '🔈 — '} ${device.label}`
          document.getElementById(device.kind + device.deviceId).onclick = () => { changeSource(device) }
          if (device.kind + device.deviceId === constraints.audio.kind + constraints.audio.deviceId) {
            document.getElementById(device.kind + device.deviceId).style.color = '#0099ff'
          }
        })
      }
      // else show there are no inputs
    }).catch((err) => {
      console.error(`${err.name}: ${err.message}`)
    })
  } else {
    document.getElementById('settingsPanel').style.display = 'none'
  }
}

const changeSource = (device) => {
  // may need to consider if source no longer exists
  document.getElementById(constraints.audio.kind + constraints.audio.deviceId).style.color = '#fff'
  constraints.audio.deviceId = device.deviceId
  constraints.audio.kind = device.kind
  document.getElementById(constraints.audio.kind + constraints.audio.deviceId).style.color = '#0099ff'
  navigator.mediaDevices.getUserMedia(constraints)
    .then((mediaStream) => {
      setAudioSource(mediaStream)
    })
    .catch((err) => {
      console.error(`${err.name}: ${err.message}`)
    })
}

function updateGUI () {
  document.getElementById('canvas1').setAttribute('height', window.innerHeight)
  document.getElementById('canvas1').setAttribute('width', window.innerWidth)
}

window.addEventListener('DOMContentLoaded', () => {
  updateGUI()
  setBarVisualizer()
  currentVisualizer = 'centeredBars'
  // setConcentricCircles()
  // currentVisualizer = 'concentricCircles'
  setInterval(updateGUI, 250)

  document.getElementById('settingsPanel').onclick = (e) => {
    if (e.target.id === 'settingsPanel') {
      toggleSettingsMenu()
    }
  }
})

const keysPressed = []

document.onkeydown = keyPressed
document.onkeyup = keyReleased

function keyPressed (e) {
  const secondaryKey = 17 // control
  // let openVisualizerKey = 86; // v
  // const openVisualizerKey = 113 // f2
  const escapeKey = 27
  // eslint-disable-next-line no-unused-vars
  const devKey = 192 // `

  const viz1Key = 49 // 1
  const viz2Key = 50 // 2
  const viz3Key = 51 // 3
  // const viz4Key = 52; // 4

  if (keysPressed.length === 0 || keysPressed[keysPressed.length - 1] !== e.keyCode) {
    keysPressed.push(e.keyCode)
  }

  // if (keysPressed.includes(openVisualizerKey)) {
  //   toggleSettings();
  // }

  if (keysPressed.includes(secondaryKey) && keysPressed.includes(viz1Key)) {
    // setActiveVisualizer(0)
  }

  if (keysPressed.includes(secondaryKey) && keysPressed.includes(viz2Key)) {
    // setActiveVisualizer(1)
  }

  if (keysPressed.includes(secondaryKey) && keysPressed.includes(viz3Key)) {
    // setActiveVisualizer(2)
  }

  if (keysPressed.includes(escapeKey) && document.getElementById('settingsPanel').style.display === 'block') {
    toggleSettingsMenu()
  }
}

function keyReleased (e) {
  keysPressed.pop()
}
