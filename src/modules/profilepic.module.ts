import { ITenant } from '../interfaces/ITenant'
import { UPLOAD_PATH } from '../env'
import fs from 'fs'
import { http } from '../api/http'
import path from 'path'

export class ProfilepicModule {
  private async getUploadDir(tenant: ITenant): Promise<string> {
    const dir = `${UPLOAD_PATH}/${tenant.uuid}/whatsapp/profilepic`
    //create if not exists
    if (!fs.existsSync(dir)) {
      await fs.promises.mkdir(dir, { recursive: true })
    }
    return dir
  }

  async uploadMediaFile(profilePic: string, filename: string, tenant: ITenant): Promise<string> {
    const response = await http.get(profilePic, {
      responseType: 'arraybuffer',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        Accept: 'image/webp,image/apng,image/*,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache'
      },
      timeout: 30000 // 30 segundos de timeout
    })

    let extension = '.jpg' // padrão

    const dir = await this.getUploadDir(tenant)
    const fileName = `${filename}${extension}`
    const filePath = `${dir}/${fileName}`

    //devolve o arquivo se ele já existir
    if (fs.existsSync(filePath)) {
      return filePath.replace(UPLOAD_PATH + '/', '')
    }

    try {
      const urlPath = new URL(profilePic).pathname
      const urlExtension = path.extname(urlPath.split('?')[0]) // Remove query params
      if (urlExtension && ['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(urlExtension.toLowerCase())) {
        extension = urlExtension.toLowerCase()
      }
    } catch (urlError) {
      // Se falhar ao parsear URL, usar content-type
      const contentType = response.headers['content-type']
      if (contentType) {
        if (contentType.includes('jpeg')) extension = '.jpg'
        else if (contentType.includes('png')) extension = '.png'
        else if (contentType.includes('webp')) extension = '.webp'
        else if (contentType.includes('gif')) extension = '.gif'
      }
    }

    await fs.promises.writeFile(filePath, response.data)

    return filePath.replace(UPLOAD_PATH + '/', '')
  }
}
