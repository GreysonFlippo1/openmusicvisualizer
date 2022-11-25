
const userPreferences = {
    colorCycle: true,
    auto_connect: true,
    primary_color: 'white',
    secondary_color: 'white',
    max_height: 100,
    smoothingTimeConstant: 0,
    fftUni: 16384,
    barWidth: 12,
    barSpacing: 2,
};

let barAmnt = 0;
let vizReady = 0;

const mediaElements = [];
//                         bar, wav , cir , amb ,
const visualizerToggles = [false, false, false, false];
// const visualizerToggleFunctions = [toggleBarVis, toggleWaveViz, toggleCircleViz, toggleAmbienceViz];
let visualizerToggleButtons = [];

let runBarVisualizer;
let drawBarsUpdate;

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

window.addEventListener('DOMContentLoaded', () => {
    drawBars()
    console.log(barAmnt)
})