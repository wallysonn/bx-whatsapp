import express from 'express'
import { ITenant } from '../interfaces/ITenant'

export default function (req: express.Request, res: express.Response, next: express.NextFunction) {
  const isWaba: boolean = (req.headers['x-waba'] || (undefined as any)) === 'true'
  if (isWaba) {
    ;(req as any).waba = true
    return next()
  }

  if (req.hostname !== 'localhost') {
    console.log('Forbidden for this host', req.headers, req.params, req.query, req.hostname)
    res.status(403).send({
      message: 'Forbidden'
    })
    return
  }

  const tenantData: string | undefined = req.headers['x-tenant-data'] || (undefined as any)
  if (!tenantData) {
    return res.status(401).json({ message: 'authentication failed. Tenant not found' })
  }

  let tenant: ITenant
  try {
    // Decodifica de base64 se estiver codificado
    const decodedData = Buffer.from(tenantData, 'base64').toString('utf-8')
    tenant = JSON.parse(decodedData)
  } catch (error) {
    // Fallback para caso o gateway ainda não esteja enviando em base64
    tenant = JSON.parse(tenantData)
  }

  console.log('middleware tenant', tenant)
  ;(req as any).tenant = tenant

  next()
}
