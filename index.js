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
}

const buildTemplate = [
  ...(isMac ? [{
    label: app.name,
    submenu: [
      // {
      //    label: 'Change Audio Source',
      //    click: () => {
      //       changeAudioSource()
      //    },
      // },
      // {
      //    label: 'Preferences'
      // },
      // {
      //    type: 'separator'
      // },
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
            click: () => {
              changeVisualizer('bars')
            }
          },
          {
            label: 'Centered Bars',
            click: () => {
              changeVisualizer('centeredBars')
            }
          },
          {
            label: 'Wiggly Waveform',
            click: () => {
              changeVisualizer('wave')
            }
          },
          {
            label: 'Circular Waveform',
            click: () => {
              changeVisualizer('circle')
            }
          },
          {
            label: 'Concentric Circles',
            click: () => {
              changeVisualizer('concentricCircles')
            }
          },
          {
            label: 'Bubbles',
            click: () => {
              changeVisualizer('bubbles')
            }
          }
        ]
      },
      ...(isMac ? [{
        label: 'Change Audio Source',
        click: () => {
          changeAudioSource()
        }
      }] : []),
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

ipcMain.handle('save-user-data', async (event, fileName, json) => {
  const path = app.getPath('userData')
  try {
    fs.writeFileSync(`${path}/${fileName}`, json, 'utf-8')
  } catch (e) {
    return e
  }
  return 'success'
})

const changeVisualizer = (type) => {
  contents.send('changeVisualizer', [type])
}

const changeAudioSource = () => {
  contents.send('changeAudioSource', [true, isMac])
}

const initAudio = () => {
  contents.send('initAudio', [true, isMac])
}

const changeSettings = () => {
  contents.send('changeSettings', Object.keys(settings).map(setting => settings[setting]))

  const menu = Menu.buildFromTemplate(buildTemplate)

  Object.keys(settings).forEach(key => {
    // console.log('updating key: ', key, settings[key])
    menu.getMenuItemById(key).checked = !!settings[key]
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
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js')
    }
  })

  if (!isMac) {
    desktopCapturer.getSources({ types: ['window', 'screen'] }).then(async sources => {
      for (const source of sources) {
        if (source.name === 'Electron') {
          mainWindow.webContents.send('SET_SOURCE', source.id)
          return
        }
      }
    })
  }

  contents = mainWindow.webContents

  initAudio()
  const menu = Menu.buildFromTemplate(buildTemplate)

  contents.on('did-finish-load', () => {
    contents.setAudioMuted(true)
    const path = app.getPath('userData')
    // console.log(path)
    fs.readFile(`${path}/user-settings.json`, 'utf8', function (err, data) {
      if (err) {
        fs.writeFileSync(`${path}/user-settings.json`, '{}', 'utf-8')
        contents.send('userSettings', {})
      } else {
        const json = JSON.parse(data)
        Object.keys(settings).forEach(key => {
          settings[key] = json[key] ?? settings[key]
          menu.getMenuItemById(key).checked = json[key] ?? settings[key]
        })
        contents.send('userSettings', json)
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
