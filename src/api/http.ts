import axios from 'axios'

const http = axios.create({
  maxBodyLength: Infinity,
})

export default http
export { http }
