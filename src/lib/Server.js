/**
 * Server helper functions
 */


/**
 * Server Constants
 *
 * @type {{maxMoneyMultiplayer: number, minSecurityLevelOffset: number}}
 */
export const SERVER = {
    // don't use this ram to run attack scripts
    homeReservedRam: 8,
    // used to decide if hack action=weaken
    // if (bestTarget.securityLevel > bestTarget.minSecurityLevel + settings.minSecurityLevelOffset) action = 'weaken'
    minSecurityLevelOffset: 1,
    // used to decide if hack action=grow
    // if (bestTarget.money < bestTarget.moneyMax * settings.maxMoneyMultiplayer) action = 'grow'
    maxMoneyMultiplayer: 0.9,
    // the name prefixed to purchased servers
    purchasedServerName: 'homenet',
    // the max number of servers you can have in your farm
    maxPurchasedServers: 25 + 1, // +1 for home
    // Don't attempt to buy any new servers if we're under this utilization
    utilizationTarget: 0.05,
    // the max server ram you can buy (it's a petabyte) as an exponent (power of 2)
    maxRamExponent: 20,
    // the min server ram you will buy
    minRamExponent: 1,
    // hack scripts
    hackScripts: [
        '/hacks/hack.js',
        '/hacks/grow.js',
        '/hacks/weaken.js',
        '/hacks/check.js',
        '/hacks/share.js',
    ],
    // servers with a backdoor bonus, usually a faction invite
    // https://bitburner.readthedocs.io/en/latest/basicgameplay/factions.html
    backdoorHostnames: [
        'CSEC',          // CyberSec
        'avmnite-02h',   // NiteSec
        'I.I.I.I',       // The Black Hand
        'run4theh111z',  // Bitrunners
        'fulcrumassets', // Fulcrum Secret Technologies (also needs 250k reputation with the Corporation)
        'w0r1d_d43m0n',  // reboot...
    ],
    // controls how far to upgrade hacknet servers
    hacknetMaxPayoffTime: 60 * 60 * 4,  // in seconds
    // controls how far to upgrade hacknet servers
    hacknetMaxSpend: 0,
}

/**
 * Gets all servers in the network.
 *
 * @param {NS} ns
 * @return {Server[]}
 */
export function getServers(ns) {
    const servers = []
    for (const hostname of scanAll(ns)) {
        const server = ns.getServer(hostname)
        if (server.hostname === 'home') {
            server.ramUsed += SERVER.homeReservedRam
        }
        servers.push(server)
    }
    return servers
}

/**
 * Gets all server hostnames in the network.
 *
 * @param {NS} ns
 * @return {string[]}
 */
export function scanAll(ns) {
    const servers = []
    const spider = ['home']
    while (spider.length > 0) {
        const hostname = spider.pop()
        for (const scanned of ns.scan(hostname)) {
            if (!servers.includes(scanned)) {
                spider.push(scanned)
            }
        }
        servers.push(hostname)
    }
    return servers
}


/**
 * Gets routes to all servers in the network.
 *
 * @param {NS} ns
 * @return {Object} key/value of hostname/route
 */
export function getRoutes(ns) {
    const spider = ['home']
    const routes = {home: ['home']}
    while (spider.length > 0) {
        const hostname = spider.pop()
        for (const scanned of ns.scan(hostname)) {
            if (!routes[scanned]) {
                spider.push(scanned)
                routes[scanned] = routes[hostname].slice()
                routes[scanned].push(scanned)
            }
        }
    }
    return routes
}

/**
 * Gets all hackable target servers, ensuring they are rooted prepped.
 *
 * @param {NS} ns
 * @param {Server[]} servers
 * @return {Server[]}
 */
export function getHackTargetServers(ns, servers) {
    return servers
        .filter(s => s.hasAdminRights && s.moneyMax > 0)
        .filter(s => s.hackDifficulty <= s.minDifficulty + SERVER.minSecurityLevelOffset
            && s.moneyAvailable >= s.moneyMax * SERVER.maxMoneyMultiplayer)
}

/**
 * Gets all hackable target servers, only the ones not prepped, ensuring they are rooted.
 *
 * @param {NS} ns
 * @param {Server[]} servers
 * @return {Server[]}
 */
export function getPrepTargetServers(ns, servers) {
    return servers
        .filter(s => s.hasAdminRights && s.moneyMax > 0)
        .filter(s => s.hackDifficulty > s.minDifficulty + SERVER.minSecurityLevelOffset
            || s.moneyAvailable < s.moneyMax * SERVER.maxMoneyMultiplayer)
}

/**
 * Gets all servers we can run scripts on.
 *
 * @param {NS} ns
 * @param {Server[]} servers
 * @return {Server[]}
 */
export function getHackingServers(ns, servers) {
    return servers
        .filter(s => s.hasAdminRights)
        .sort((a, b) => b.maxRam - a.maxRam) // sort by ram
}

/**
 * Gets all hackable target servers, only the ones not prepped, ensuring they are rooted.
 *
 * @param {NS} ns
 * @param {Server[]} servers
 * @return {Server[]}
 */
export function getOwnedServers(ns, servers) {
    return servers
        .filter(s => s.purchasedByPlayer)
        .sort((a, b) => b.maxRam - a.maxRam)
}

/**
 * Gets the RAM available on a list of servers.
 *
 * @param {NS} ns
 * @param {Server[]} servers
 * @return {Number}
 */
export function getFreeRam(ns, servers) {
    return servers
        .map(s => s.maxRam - s.ramUsed)
        .reduce((prev, next) => prev + next)
}

/**
 * Gets the total (max) RAM on a list of servers.
 * @param {NS} ns
 * @param {Server[]} servers
 * @return {Number}
 */
export function getTotalRam(ns, servers) {
    return servers
        .map(s => s.maxRam)
        .reduce((prev, next) => prev + next)
}

/**
 * Gets the RAM available to run hacking threads on a list of servers.
 *
 * @param {NS} ns
 * @param {Server[]} servers
 * @param {number} ram per thread in GB
 * @return {Number}
 */
export function getFreeThreads(ns, servers, ram) {
    return servers
        .map(s => Math.floor((s.maxRam - s.ramUsed) / ram))
        .reduce((prev, next) => prev + next)
}

/**
 * Gets the total (max) RAM to run hacking threads on a list of servers.
 * @param {NS} ns
 * @param {Server[]} servers
 * @param {number} ram per thread in GB
 * @return {Number}
 */
export function getTotalThreads(ns, servers, ram) {
    return servers
        .map(s => Math.floor(s.maxRam / ram))
        .reduce((prev, next) => prev + next)
}

/**
 * Gets the cracks used to gain root access
 *
 * @param {NS} ns
 * @return {Object[]}
 */
export function getCracks(ns) {
    const cracks = []
    const c = [
        {
            method: 'brutessh',
            file: 'BruteSSH.exe',
            cost: 500000,
        },
        {
            method: 'ftpcrack',
            file: 'FTPCrack.exe',
            cost: 1500000,
        },
        {
            method: 'relaysmtp',
            file: 'relaySMTP.exe',
            cost: 5000000,
        },
        {
            method: 'httpworm',
            file: 'HTTPWorm.exe',
            cost: 30000000,
        },
        {
            method: 'sqlinject',
            file: 'SQLInject.exe',
            cost: 250000000,
        },
    ]
    for (const crack of c) {
        crack.owned = ns.fileExists(crack.file)
        cracks.push(crack)
    }
    return cracks
}

