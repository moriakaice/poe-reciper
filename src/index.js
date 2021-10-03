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

const sleep = async (ms) => new Promise((resolve) => setTimeout(resolve, ms))

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
      headers: { 'User-Agent': `poe-reciper/${process.env.npm_package_version}`, cookie: 'POESESSID=' + settings.poeSessId },
    })
  }

  return axiosInstance
}

const get = async (url) => {
  const cachedData = cache.get(url)

  if (cachedData) {
    return cachedData
  }

  await sleep(100)

  const { status, data } = await Axios().get(url)

  if (status === 200 && !data.error) {
    cache.set(url, data)
    return data
  } else {
    const errorMessage = (data && data.error && data.error.message && data.error.message) || ''

    console.error(`[get] Error while trying to obtain ${url}. ${errorMessage}`)
    throw new Error(`[get] Error while trying to obtain ${url}. ${errorMessage}`)
  }
}

const recipes = {
  // https://www.poewiki.net/wiki/Glassblower%27s_Bauble#Obtaining
  glassblowersBauble: (charactersInventory, tabs) => {
    const flaskFilter = (item) =>
      item.typeLine && item.typeLine.includes('Flask') && item.properties && item.properties.find((property) => property.name === 'Quality')

    const formatFlask = (flask) => {
      if (flask.inventoryId === 'MainInventory') {
        return {
          typeLine: flask.typeLine,
          tabIndex: 'Inventory',
          tabName: flask.characterName,
          search: `+${flask.quality}%`,
        }
      }

      return {
        typeLine: flask.typeLine,
        tabIndex: flask.tabIndex,
        tabName: flask.tabName,
        search: `+${flask.quality}%`,
      }
    }

    const getSmallestFlaskQuality = (flasks) => {
      return flasks[flasks.length - 1].quality
    }

    const getFlaskQualitySum = (flasks) => flasks.reduce((acc, curr) => acc + curr.quality, 0)

    const checkRestOfFlasks = (flasks, flasksUsed) => {
      if (!flasks.length) {
        return false
      }

      const currentQualitySum = getFlaskQualitySum(flasksUsed)

      const smallestFlaskQuality = getSmallestFlaskQuality(flasks)
      if (currentQualitySum + flasks[0].quality === 40) {
        return flasksUsed.concat(flasks[0])
      } else {
        if (currentQualitySum + flasks[0].quality + smallestFlaskQuality <= 40) {
          return checkRestOfFlasks(flasks.slice(1), flasksUsed.concat([flasks[0]]))
        }

        flasksUsed.pop()
        return checkRestOfFlasks(flasks.slice(1), flasksUsed.concat([flasks[0]]))
      }
    }

    let flasks = []

    Object.keys(charactersInventory).forEach((character) => (flasks = flasks.concat(charactersInventory[character].filter(flaskFilter))))
    Object.keys(tabs).forEach((tabIndex) => (flasks = flasks.concat(tabs[tabIndex].filter(flaskFilter))))

    flasks = flasks.map((flask) => ({
      ...flask,
      quality: parseInt(flask.properties.find((property) => property.name === 'Quality').values[0][0].replace(/^[0-9]/, ''), 10),
    }))

    const baublers = []
    let run = flasks.length

    while (run) {
      const currentFlask = flasks.shift()
      const flasksUsed = [currentFlask]

      if (currentFlask.quality === 20 && flask.frameType === 0) {
        baublers.push([formatFlask(currentFlask)])
      } else {
        const baubleFlasks = checkRestOfFlasks(flasks, flasksUsed)

        if (baubleFlasks && getFlaskQualitySum(baubleFlasks) === 40) {
          baublers.push(baubleFlasks.map(formatFlask))
          baubleFlasks.forEach((flask) => {
            const index = flasks.indexOf(flask)

            if (index > -1) {
              flasks.splice(index, 1)
            }
          })
        }
      }

      run = flasks.length
    }

    if (baublers.length) {
      console.log(`Found items to convert to Glassblower's Bauble recipe`)
      console.log(JSON.stringify(baublers, null, 2))
    } else {
      console.warn(`Nothing found for Glassblower's Bauble recipe`)
    }
  },
}

const getCharacters = async () => {
  const url = `/character-window/get-characters?accountName=${settings.accountName}`

  return (await get(url)).filter((character) => character.league === settings.league)
}

const getCharacterInventory = async (characterName) => {
  const url = `/character-window/get-items?character=${encodeURIComponent(characterName)}`

  return (await get(url)).items
}

const getTabsList = async () => {
  const url = `/character-window/get-stash-items?accountName=${settings.accountName}&realm=${settings.realm}&league=${settings.league}&tabs=1&tabIndex=0`

  return (await get(url)).tabs
}

const getTabItems = async (tabIndex) => {
  const url = `/character-window/get-stash-items?accountName=${settings.accountName}&realm=${settings.realm}&league=${settings.league}&tabs=0&tabIndex=${tabIndex}`

  return (await get(url)).items
}

const main = async () => {
  const characters = await getCharacters()
  const charactersInventory = {}
  const tabs = {}

  for (let i = 0; i < characters.length; i++) {
    const characterName = characters[i].name

    const characterInventory = await getCharacterInventory(characterName)
    charactersInventory[characterName] = characterInventory.filter((item) => item.inventoryId === 'MainInventory').map((item) => ({ ...item, characterName }))
  }

  const tabsList = await getTabsList()

  for (let i = 0; i < tabsList.length; i++) {
    const tabIndex = tabsList[i].i
    tabs[i] = (await getTabItems(tabIndex)).map((item) => ({ ...item, tabIndex, tabName: tabsList[i].n }))
  }

  Object.keys(settings.recipes)
    .filter((recipe) => settings.recipes[recipe])
    .filter((recipe) => recipes[recipe])
    .forEach((recipe) => {
      recipes[recipe](charactersInventory, tabs)
    })
}

main().then()
