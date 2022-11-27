
// Modules to control application life and create native browser window
const { app, BrowserWindow, Menu, ipcMain } = require('electron')
const path = require('path')

const isMac = process.platform === 'darwin'

const template = [
   ...(isMac ? [{
      label: app.name,
      submenu: [
         {
            label: 'Settings'
         },
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
         },
         {
            type: 'separator'
         },
         {
            label: 'Visualizer',
            submenu: [
            {
               label: 'Bars',
               click: () => {
                  changeVisualizer('bars')
               }
            },
            {
               label: 'Wave',
               click: () => {
                  changeVisualizer('wave')
               }
            },
            {
               label: 'Circle',
               click: () => {
                  changeVisualizer('circle')
               }
            }
         ]
         },
         {
            type: 'separator'
         },
         {
            role: 'togglefullscreen'
         }
      ]
   },

   {
      label: 'Options',
      submenu: [
         {
            label: 'Option1'
         },
         {
            label: 'Option2'
         }
      ]
   },

   {
      role: 'window',
      submenu: [
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

const changeVisualizer = (type) => {
  contents.send('changeVisualizer', [type])
}

const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    title: 'Open Music Visualizer',
   //  transparent: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js')
    },
  })

  contents = mainWindow.webContents

  contents.on('did-finish-load', () => {
    contents.setAudioMuted(true)
  })

  const menu = Menu.buildFromTemplate(template)
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
