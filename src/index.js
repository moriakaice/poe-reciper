const fs = require('fs')
const axios = require('axios')
require('dotenv').config()

const settings = {
  realm: process.env.REALM || 'pc',
  league: process.env.LEAGUE || 'Standard',
  accountName: process.env.ACCOUNT_NAME,
  poeSessId: process.env.POESESSID,
}

if (!settings.accountName || !settings.poeSessId) {
  throw new Error(
    `Both account name and PoE Session ID need to be set up. Current values: account name: ${settings.accountName}, session id: ${settings.poeSessId}`
  )
}

let axiosInstance
const Axios = () => {
  if (!axiosInstance) {
    axiosInstance = axios.create({
      baseURL: 'https://www.pathofexile.com',
      timeout: 1000,
      headers: { 'User-Agent': `poe-reciper/${process.env.npm_package_version}` },
    })
  }

  return axiosInstance
}

const getCharacters = async () => {
  const url = `/character-window/get-characters?accountName=${settings.accountName}`

  const res = await Axios().get(url)

  const { status, data } = res

  if (status === 200) {
    return data
  } else {
    console.error(`[getCharacters()] ERROR: Response status: ${status}`)
    throw new Error(`[getCharacters()] ERROR: Response status: ${status}`)
  }
}

const main = async () => {
  const characters = await getCharacters()

  console.log(characters)
}

main().then()
