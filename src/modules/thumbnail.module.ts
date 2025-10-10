import { ITenant } from '../interfaces/ITenant'
import { UPLOAD_PATH } from '../env'
import fs from 'fs'
import { v4 as uuidv4 } from 'uuid'

export class ThumbnailModule {
  private async getUploadDir(tenant: ITenant): Promise<string> {
    const dir = `${UPLOAD_PATH}/${tenant.uuid}/whatsapp/thumbnail`
    //create if not exists
    if (!fs.existsSync(dir)) {
      await fs.promises.mkdir(dir, { recursive: true })
    }
    return dir
  }

  async uploadMediaFile(jpegThumbnail: string, tenant: ITenant): Promise<string> {
    const dir = await this.getUploadDir(tenant)
    const fileName = `${uuidv4()}.jpg`
    const filePath = `${dir}/${fileName}`
    await fs.promises.writeFile(filePath, jpegThumbnail, 'base64')
    return filePath.replace(UPLOAD_PATH + '/', '')
  }
}
