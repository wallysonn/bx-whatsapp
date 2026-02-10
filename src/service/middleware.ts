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
  const tenant: ITenant = JSON.parse(tenantData)

  console.log('middleware tenant', tenant)
  ;(req as any).tenant = tenant

  next()
}
