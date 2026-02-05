import StaticMaps, { AddMarkerOptions } from 'staticmaps'
import path from 'path'

export class GeolocationUtils {
  static async getThumbnailByCoordinates(latitude: number, longitude: number): Promise<string> {
    try {
      const lat = Number(latitude)
      const lon = Number(longitude)

      if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        return ''
      }

      console.log('Gerando thumbnail para coordenadas:', lat, lon)

      const map = new StaticMaps({
        width: 600,
        height: 400
      })

      const marker: AddMarkerOptions = {
        coord: [lon, lat],
        offsetX: 24,
        offsetY: 48,
        width: 48,
        height: 48,
        img: path.join(__dirname, '../icons/location-pin.png')
      }

      map.addMarker(marker)

      await map.render([lon, lat])

      const buffer = await map.image.buffer('image/png', { quality: 60 })

      return buffer.toString('base64')
    } catch (err) {
      console.log('erro no geocodificação', err)
      return ''
    }
  }
}
