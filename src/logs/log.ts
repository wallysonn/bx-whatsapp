import fs from 'fs'
import path from 'path'
import util from 'util'
import { dateStr, nowStrPt } from '../utils/date'

const logFile = () => {
  let filename = `${dateStr()}.log`
  let logDir = __dirname + '/history'

  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir)
  }

  return fs.createWriteStream(path.join(logDir, filename), {
    flags: 'a',
  })
}

const logStdout = process.stdout

const formatArgs = (...args: any[]) => {
  return args.map(arg => {
    if (typeof arg === 'object' && arg !== null) {
      try {
        return JSON.stringify(arg, null, 2)
      } catch (error) {
        // Fallback para objetos circulares
        return util.inspect(arg, { depth: null, colors: false })
      }
    }
    return String(arg)
  }).join(' ')
}

console.log = (...args) => {
  let currentLogFile: fs.WriteStream = logFile()
  const formattedMessage = formatArgs(...args)
  currentLogFile.write(nowStrPt() + ' - ' + formattedMessage + '\n')
  logStdout.write(util.format(...args) + '\n')
  currentLogFile.end()
}
