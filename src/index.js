const fs = require('fs')
const axios = require('axios')
const crypto = require('crypto')
require('dotenv').config()

const settings = {
  realm: process.env.REALM || 'pc',
  league: process.env.LEAGUE || 'Standard',
  accountName: process.env.ACCOUNT_NAME,
  poeSessId: process.env.POESESSID,
  recipes: {
    glassblowersBauble: process.env.GLASSBLOWERS_BAUBLE_ENABLED || false,
  },
  cacheLife: +process.env.CACHE_LIFE || 5 * 60 * 1000,
}

if (!settings.accountName || !settings.poeSessId) {
  throw new Error(
    `Both account name and PoE Session ID need to be set up. Current values: account name: ${settings.accountName}, session id: ${settings.poeSessId}`
  )
}

const cache = {
  get: (url) => {
    const filename = `${__dirname}/../cache/${crypto.createHash('md5').update(url).digest('hex')}.json`

    if (fs.existsSync(filename)) {
      const cache = JSON.parse(fs.readFileSync(filename))

      if (cache && cache.lastUpdated && cache.lastUpdated > new Date().getTime() - settings.cacheLife) {
        return cache.data
      }
    }

    return false
  },
  set: (url, data) => {
    const filename = `${__dirname}/../cache/${crypto.createHash('md5').update(url).digest('hex')}.json`

    fs.writeFileSync(
      filename,
      JSON.stringify(
        {
          lastUpdated: new Date().getTime(),
          data,
        },
        null,
        2
      ),
      'utf-8'
    )
  },
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

const get = async (url) => {
  const cachedData = cache.get(url)

  if (cachedData) {
    return cachedData
  }

  const { status, data } = await Axios().get(url)

  if (status === 200) {
    cache.set(url, data)
    return data
  } else {
    console.error(`[get] Error while trying to obtain ${url}`)
    throw new Error(`[get] Error while trying to obtain ${url}`)
  }
}

const getCharacters = async () => {
  const url = `/character-window/get-characters?accountName=${settings.accountName}`

  return await get(url)
}

const main = async () => {
  const characters = await getCharacters()

  console.log(characters)
}

main().then()
