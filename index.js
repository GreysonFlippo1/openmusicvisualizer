/* eslint-disable multiline-ternary */

// Modules to control application life and create native browser window
const { app, BrowserWindow, Menu, ipcMain, desktopCapturer } = require('electron')
const path = require('path')
const fs = require('fs')

const isMac = process.platform === 'darwin'

const settings = {
  tall_bars: true,
  boosted_audio: false,
  rounded_bars: true,
  color_cycle: true,
  smoothing: true,
  currentVisualizer: 'none'
}

const buildTemplate = [
  ...(isMac ? [{
    label: app.name,
    submenu: [
      {
        role: 'quit',
        label: 'Quit Open Music Visualizer'
      }
    ]
  }] : []),
  {
    label: 'View',
    submenu: [
      {
        role: 'reload'
      },
      {
        role: 'toggledevtools'
      }
    ]
  },

  {
    label: 'Options',
    submenu: [
      {
        label: 'Visualizer Type',
        submenu: [
          {
            label: 'Bouncy Bars',
            id: 'bars',
            type: 'checkbox',
            checked: settings.currentVisualizer === 'bars',
            click: () => {
              changeVisualizer('bars')
            }
          },
          {
            label: 'Centered Bars',
            id: 'centeredBars',
            type: 'checkbox',
            checked: settings.currentVisualizer === 'centeredBars',
            click: () => {
              changeVisualizer('centeredBars')
            }
          },
          {
            label: 'Wiggly Waveform',
            id: 'wave',
            type: 'checkbox',
            checked: settings.currentVisualizer === 'wave',
            click: () => {
              changeVisualizer('wave')
            }
          },
          {
            label: 'Circular Waveform',
            id: 'circle',
            type: 'checkbox',
            checked: settings.currentVisualizer === 'circle',
            click: () => {
              changeVisualizer('circle')
            }
          },
          {
            label: 'Concentric Circles',
            id: 'concentricCircles',
            type: 'checkbox',
            checked: settings.currentVisualizer === 'concentricCircles',
            click: () => {
              changeVisualizer('concentricCircles')
            }
          },
          {
            label: 'Bubbles',
            id: 'bubbles',
            type: 'checkbox',
            checked: settings.currentVisualizer === 'bubbles',
            click: () => {
              changeVisualizer('bubbles')
            }
          }
        ]
      },
      {
        type: 'separator'
      },
      {
        label: 'Boost Input Signal',
        id: 'boosted_audio',
        type: 'checkbox',
        checked: settings.boosted_audio,
        click: () => {
          settings.boosted_audio = !settings.boosted_audio
          changeSettings()
        }
      },
      {
        label: 'Smoothing',
        id: 'smoothing',
        type: 'checkbox',
        checked: settings.smoothing,
        click: () => {
          settings.smoothing = !settings.smoothing
          changeSettings()
        }
      },
      {
        label: 'Color Cycle',
        id: 'color_cycle',
        type: 'checkbox',
        checked: settings.color_cycle,
        click: () => {
          settings.color_cycle = !settings.color_cycle
          changeSettings()
        }
      },
      {
        type: 'separator'
      },
      {
        label: 'Extra Tall Bars',
        id: 'tall_bars',
        type: 'checkbox',
        checked: settings.tall_bars,
        click: () => {
          settings.tall_bars = !settings.tall_bars
          changeSettings()
        }
      },
      {
        label: 'Rounded Bars',
        id: 'rounded_bars',
        type: 'checkbox',
        checked: settings.rounded_bars,
        click: () => {
          settings.rounded_bars = !settings.rounded_bars
          changeSettings()
        }
      }
    ]
  },

  {
    role: 'window',
    submenu: [
      {
        role: 'togglefullscreen'
      },
      {
        role: 'minimize'
      },
      {
        role: 'close'
      }
    ]
  },

  {
    role: 'help',
    submenu: [
      {
        label: 'Learn More'
      }
    ]
  }
]

let contents

// ipcMain.handle('save-user-data', async (event, fileName, json) => {
//   const path = app.getPath('userData')
//   try {
//     fs.writeFileSync(`${path}/${fileName}`, json, 'utf-8')
//   } catch (e) {
//     return e
//   }
//   return 'success'
// })

const changeVisualizer = (type) => {
  settings.currentVisualizer = type
  // contents.send('changeVisualizer', [type])
  changeSettings()
}

const initAudio = () => {
  contents.send('initAudio', [true, isMac])
}

const changeSettings = () => {
  contents.send('changeSettings', settings)
  updateMenu(settings)


  const path = app.getPath('userData')
  const fileName = 'user-settings.json'
  const json = JSON.stringify(settings)

  try {
    fs.writeFileSync(`${path}/${fileName}`, json, 'utf-8')
  } catch (e) {
    return e
  }
  return 'success'

}

const updateMenu = (preferences) => {
  const menu = Menu.buildFromTemplate(buildTemplate)

  Object.keys(preferences).forEach(key => {
    // console.log('updating key: ', key, preferences[key])
    if (key == 'currentVisualizer'){
      const value = preferences[key]
      menu.getMenuItemById(value).checked = preferences[key] == value
    } else {
      // bools
      menu.getMenuItemById(key).checked = !!preferences[key]
    } 
  })

  Menu.setApplicationMenu(menu)
}

const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    title: 'Open Music Visualizer',
    // transparent: true,
    // titleBarStyle: 'hiddenInset',
    // frame: false,
    // autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js')
    }
  })

  desktopCapturer.getSources({ types: ['window', 'screen'] }).then(async sources => {
    for (const source of sources) {
      if (source.name === 'Electron') {
        mainWindow.webContents.send('SET_SOURCE', source.id)
        return
      }
    }
  })

  contents = mainWindow.webContents

  initAudio()
  const menu = Menu.buildFromTemplate(buildTemplate)

  contents.on('did-finish-load', () => {
    contents.setAudioMuted(true)
    const path = app.getPath('userData')
    // console.log(path)
    fs.readFile(`${path}/user-settings.json`, 'utf8', function (err, json) {
      if (err) {
        fs.writeFileSync(`${path}/user-settings.json`, '{}', 'utf-8')
        contents.send('changeSettings', {})
      } else {
        const data = JSON.parse(json)
        Object.keys(settings).forEach(key => {
          settings[key] = data[key] ?? settings[key]
          // menu.getMenuItemById(key).checked = json[key] ?? settings[key]
        })
        if (isMac) {
          updateMenu(settings)
        } else {
          setTimeout(() => {updateMenu(settings)}, 100)
        }
        contents.send('changeSettings', data)
      }
    })
  })

  Menu.setApplicationMenu(menu)

  // and load the index.html of the app.
  mainWindow.loadFile('index.html')

  // Open the DevTools.
  // mainWindow.webContents.openDevTools()
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
