import { Axios } from 'axios'
import http from '../api/http'

export class Provider {

  //o que todo provider precisa ter
  protected clientHttp: Axios

  constructor() {
    this.clientHttp = http
  }

}
