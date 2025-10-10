import * as fns from 'date-fns'
process.env.TZ = 'America/Sao_Paulo'
export const now = () => new Date()
export const nowStr = (format = 'yyyy-MM-dd HH:mm:ss') =>
  fns.format(now(), format)
export const nowStrPt = () => nowStr('dd/MM/yyyy HH:mm:ss')
export const dateStr = (format = 'yyyy-MM-dd') => fns.format(now(), format)
export const secondsToTime = (seconds: number) => {
  const hour = Math.floor(seconds / 3600)
  const minute = Math.floor((seconds % 3600) / 60)
  const second = Math.floor((seconds % 3600) % 60)
  //str pad
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${pad(hour)}:${pad(minute)}:${pad(second)}`
}
export const diffInTimes = (
  date1: string | Date,
  date2: string | Date
): string => secondsToTime(diffInSeconds(date1, date2))

export const diffInSeconds = (
  date1: string | Date,
  date2: string | Date
): number => {
  if (typeof date1 === 'string') date1 = new Date(date1)
  if (typeof date2 === 'string') date2 = new Date(date2)
  return fns.differenceInSeconds(date1, date2)
}

export { fns }
