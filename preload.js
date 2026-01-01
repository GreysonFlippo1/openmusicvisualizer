// All the Node.js APIs are available in the preload process.
// It has the same sandbox as a Chrome extension.
const { ipcRenderer } = require('electron')

let userPreferences = {
  color_cycle: true,
  primary_color: 'white',
  secondary_color: 'white',
  tall_bars: true,
  rounded_bars: true,
  boosted_audio: false,
  smoothingTimeConstant: 0.7,
  fftUni: 8192,
  barWidth: 12,
  barSpacing: 2,
  settingsLoaded: false,
  smoothing: true,
  currentVisualizer: 'none',
}

let mediaElement = {}

function setAudioSource (stream) {
  const audioCtx = new AudioContext()
  const analyser = audioCtx.createAnalyser()
  analyser.smoothingTimeConstant = userPreferences.smoothing ? 0.7 : 0
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

  changeVisualizer(userPreferences.currentVisualizer)
}

const setSmoothing = (time) => {
  mediaElement.analyser.smoothingTimeConstant = time
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

function cycleColor (update = false, increment = 1, alpha = 1) {
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

  return 'rgba(' + colors.red + ',' + colors.green + ',' + colors.blue + ',' + alpha + ')'
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
  canvasCtx.lineWidth = 2
  canvasCtx.shadowColor = '#000'
  canvasCtx.shadowBlur = 1
  canvasCtx.shadowOffsetX = 0
  canvasCtx.shadowOffsetY = 0
  if (currentVisualizer === 'circle') { canvasCtx.lineWidth = 3 }
  canvasCtx.beginPath()
  const sliceWidth = (WIDTH / mediaElement.bufferLength) * 4
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
      lastx = (WIDTH / 2) + radius2 * Math.cos(i * (2 * Math.PI) / mediaElement.bufferLength)
      lasty = (HEIGHT / 2) + radius2 * Math.sin(i * (2 * Math.PI) / mediaElement.bufferLength) * -1
    } else {
      canvasCtx.lineTo(x, y)
    }
    x += sliceWidth
  }
  if (currentVisualizer === 'circle') { canvasCtx.lineTo(lastx, lasty) }
  canvasCtx.stroke()
  if (currentVisualizer === 'wave' || currentVisualizer === 'circle') { window.requestAnimationFrame(waveVis) }
}

function concentricCirclesVis () {
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

  if (userPreferences.color_cycle) {
    buildVisualizerBGRGB(canvasCtx, WIDTH, HEIGHT)
  }

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
      canvasCtx.arc(WIDTH / 2, HEIGHT / 2, ((frequencyData * frequencyData) / (255 * 255)) * maxSize * (userPreferences.boosted_audio ? 2 : 1), 0, 2 * Math.PI, true)
      canvasCtx.stroke()
    }
  }
  buildVisualizerStripes(canvasCtx, WIDTH, HEIGHT, 2)
  if (currentVisualizer === 'concentricCircles') { window.requestAnimationFrame(concentricCirclesVis) }
}

const bubbeProperties = [
  {
    color: '54, 54, 165',
    location: [0, 0],
    destination: [0, 0],
    size: 400
  },
  {
    color: '181, 30, 30',
    location: [0, 0],
    destination: [0, 0],
    size: 280
  },
  {
    color: '122, 122, 53',
    location: [0, 0],
    destination: [0, 0],
    size: 280
  },
  {
    color: '105, 31, 62',
    location: [0, 0],
    destination: [0, 0],
    size: 200
  },
  {
    color: '65, 112, 112',
    location: [0, 0],
    destination: [0, 0],
    size: 100
  },
  {
    color: '72, 40, 92',
    location: [0, 0],
    destination: [0, 0],
    size: 180
  }
]

function bubbleVis () {
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
    const circleAmount = 6
    for (let i = 0; i < circleAmount; i++) {
      const formula = Math.ceil(Math.pow(i, 4))
      const frequencyData = mediaElement.frequencyData[formula]

      const bubbleCoords = bubbeProperties[i].location
      // set initial bubble properties
      if (bubbleCoords[0] === 0 && bubbleCoords[1] === 0) {
        bubbleCoords[0] = Math.floor(WIDTH * Math.random())
        bubbleCoords[1] = Math.floor(HEIGHT * Math.random())
      }
      if (!bubbeProperties[i].size) {
        bubbeProperties[i].size = Math.floor(200 * Math.random()) + 100
      }

      const sensitivity = 50
      const explodeSize = 200

      const pop = (sensitivity * (frequencyData / 255)) * (userPreferences.boosted_audio ? 2 : 1)

      // explosion
      if ((frequencyData / 255) > 0.5 && !bubbeProperties[i].explode) {
        // start explode
        bubbeProperties[i].explode = bubbeProperties[i].size + sensitivity
      } else if (bubbeProperties[i].explode) {
        bubbeProperties[i].explode += 6
        const opacity = (1 - (bubbeProperties[i].explode / (bubbeProperties[i].size + sensitivity + explodeSize))) * 3
        const bubbleSize = bubbeProperties[i].explode
        const fillGradient = canvasCtx.createRadialGradient(bubbleCoords[0], bubbleCoords[1], 5, bubbleCoords[0], bubbleCoords[1], bubbleSize)
        fillGradient.addColorStop(0, 'rgba(0,0,0,0)')
        fillGradient.addColorStop(1, `rgba(${bubbeProperties[i].color},${opacity / 2})`)

        canvasCtx.strokeStyle = `rgba(${bubbeProperties[i].color},${opacity})`
        canvasCtx.lineWidth = 5
        canvasCtx.fillStyle = fillGradient
        canvasCtx.beginPath()
        canvasCtx.arc(bubbleCoords[0], bubbleCoords[1], bubbleSize, 0, 2 * Math.PI, true)
        canvasCtx.fill()
        canvasCtx.stroke()
        if (bubbeProperties[i].explode >= bubbeProperties[i].size + sensitivity + explodeSize) {
          bubbeProperties[i].explode = undefined
        }
      }

      const bubbleSize = bubbeProperties[i].size + pop
      const fillGradient = canvasCtx.createRadialGradient(bubbleCoords[0], bubbleCoords[1], 5, bubbleCoords[0], bubbleCoords[1], bubbleSize)
      fillGradient.addColorStop(0, 'rgba(0,0,0,0)')
      fillGradient.addColorStop(1, `rgb(${bubbeProperties[i].color}, 0.5)`)

      canvasCtx.strokeStyle = `rgb(${bubbeProperties[i].color})`
      canvasCtx.lineWidth = 5
      canvasCtx.fillStyle = fillGradient
      canvasCtx.beginPath()
      canvasCtx.arc(bubbleCoords[0], bubbleCoords[1], bubbleSize, 0, 2 * Math.PI, true)
      canvasCtx.fill()
      canvasCtx.stroke()

      // move the bubbles
      const bubbleDestination = bubbeProperties[i].destination
      const compareCoord0 = Math.round(bubbleCoords[0])
      const compareCoord1 = Math.round(bubbleCoords[1])
      if ((bubbleDestination[0] === 0 && bubbleDestination[1] === 0) || compareCoord0 === bubbleDestination[0] || compareCoord1 === bubbleDestination[1]) {
        // get new destination
        bubbleDestination[0] = Math.round((Math.random() * (WIDTH + 200)) - 100)
        bubbleDestination[1] = Math.round((Math.random() * (HEIGHT + 200)) - 100)
      } else {
        const speed = Math.min(1 - (bubbleSize / 810), 0.1)
        if (bubbleCoords[0] < bubbleDestination[0]) {
          bubbleCoords[0] += speed
        } else {
          bubbleCoords[0] -= speed
        }
        if (bubbleCoords[1] < bubbleDestination[1]) {
          bubbleCoords[1] += speed
        } else {
          bubbleCoords[1] -= speed
        }
      }
    }
  }

  buildVisualizerFGRed(canvasCtx, WIDTH, HEIGHT)
  buildVisualizerStripes(canvasCtx, WIDTH, HEIGHT)

  if (currentVisualizer === 'bubbles') { window.requestAnimationFrame(bubbleVis) }
}

const buildVisualizerFGRed = (canvasCtx, WIDTH, HEIGHT) => {
  const bgGradient1 = canvasCtx.createLinearGradient(0, 0, WIDTH, 0)
  bgGradient1.addColorStop(0, 'rgba(255, 100, 0, 0.7)')
  bgGradient1.addColorStop(0.5, 'rgba(0,0,0,0)')
  bgGradient1.addColorStop(1, 'rgba(255, 100, 0, 0.4)')

  canvasCtx.beginPath()
  canvasCtx.rect(0, 0, WIDTH, HEIGHT)
  canvasCtx.fillStyle = bgGradient1
  canvasCtx.fill()

  const bgGradient2 = canvasCtx.createLinearGradient(0, 0, 0, HEIGHT)
  bgGradient2.addColorStop(0, 'rgba(255, 0, 0, 0.5)')
  bgGradient2.addColorStop(0.5, 'rgba(0,0,0,0)')
  bgGradient2.addColorStop(1, 'rgba(0, 0, 0, 0.3)')

  canvasCtx.beginPath()
  canvasCtx.rect(0, 0, WIDTH, HEIGHT)
  canvasCtx.fillStyle = bgGradient2
  canvasCtx.fill()
}

const buildVisualizerBGRGB = (canvasCtx, WIDTH, HEIGHT) => {
  const bgGradient1 = canvasCtx.createLinearGradient(0, 0, WIDTH, 0)
  bgGradient1.addColorStop(0, cycleColor(false))
  bgGradient1.addColorStop(0.5, 'rgba(0,0,0,0)')
  bgGradient1.addColorStop(1, cycleColor(false, 100))

  canvasCtx.beginPath()
  canvasCtx.rect(0, 0, WIDTH, HEIGHT)
  canvasCtx.fillStyle = bgGradient1
  canvasCtx.fill()

  const bgGradient2 = canvasCtx.createLinearGradient(0, 0, 0, HEIGHT)
  bgGradient2.addColorStop(0, cycleColor(false, 200))
  bgGradient2.addColorStop(0.5, 'rgba(0,0,0,0)')
  bgGradient2.addColorStop(1, cycleColor(false, 200))

  canvasCtx.beginPath()
  canvasCtx.rect(0, 0, WIDTH, HEIGHT)
  canvasCtx.fillStyle = bgGradient2
  canvasCtx.fill()

  canvasCtx.beginPath()
  canvasCtx.rect(0, 0, WIDTH, HEIGHT)
  canvasCtx.fillStyle = 'rgba(0, 0, 0, 0.6)'
  canvasCtx.fill()
}

const buildVisualizerStripes = (canvasCtx, WIDTH, HEIGHT, stripeSize = 3) => {
  const pinstripeSize = stripeSize
  canvasCtx.strokeStyle = 'rgba(0, 0, 0, 0.4)'
  canvasCtx.lineWidth = pinstripeSize

  for (let i = 0; i < HEIGHT; i += (pinstripeSize * 2)) {
    canvasCtx.beginPath()
    canvasCtx.moveTo(0, i)
    canvasCtx.lineTo(WIDTH, i)
    canvasCtx.stroke()
  }
}

ipcRenderer.on('initAudio', function (event, args) {
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
})

const setBarVisualizer = () => {
  if (currentVisualizer !== 'bars' && currentVisualizer !== 'centeredBars') {
    window.requestAnimationFrame(barVis)
  }
}

const setWaveVisualizer = () => {
  if (currentVisualizer !== 'wave' && currentVisualizer !== 'circle') {
    window.requestAnimationFrame(waveVis)
  }
}

const setConcentricCircles = () => {
  if (currentVisualizer !== 'concentricCircles') {
    window.requestAnimationFrame(concentricCirclesVis)
  }
}

const setBubbleVisualizer = () => {
  if (currentVisualizer !== 'bubbles') {
    window.requestAnimationFrame(bubbleVis)
  }
}

const changeVisualizer = (type) => {
  switch (type) {
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
  currentVisualizer = type
}

ipcRenderer.on('changeSettings', function (event, data) {
  console.log(data)
  Object.keys(data).forEach(key => {
    userPreferences[key] = data[key]
  })

  if (mediaElement.attached) {
    setSmoothing(userPreferences.smoothing ? 0.7 : 0)
    changeVisualizer(userPreferences.currentVisualizer)
  }
})

// const saveUserData = () => {
//   const jsonData = JSON.stringify(userPreferences)
//   ipcRenderer.invoke('save-user-data', 'user-settings.json', jsonData).then(
//       result => {
//         // console.log('preferences saved...')
//       }
//   )
// }

function updateGUI () {
  document.getElementById('canvas1').setAttribute('height', window.innerHeight)
  document.getElementById('canvas1').setAttribute('width', window.innerWidth)
}

window.addEventListener('DOMContentLoaded', () => {
  updateGUI()
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

  if (keysPressed.includes(escapeKey)) {
  }
}

function keyReleased (e) {
  keysPressed.pop()
}

