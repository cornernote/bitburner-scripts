/**
 * Server helper functions
 */


import {TargetSettings} from './lib/Target';

/**
 * Server Settings
 *
 * @type {{maxPurchasedServers: number, purchasedServerName: string, backdoorHostnames: string[], maxRamExponent: number, hacknetMaxPayoffTime: number, homeReservedRam: number, remoteHostReservedRam: number, hacknetMaxSpend: number, minRamExponent: number}}
 */
export const ServerSettings = {
    // don't use this ram to run attack scripts
    homeReservedRam: 16,
    remoteHostReservedRam: 4,
    // the name prefixed to purchased servers
    purchasedServerName: 'homenet',
    // the max number of servers you can have in your farm
    maxPurchasedServers: 25 + 1, // +1 for home
    //// Don't attempt to buy any new servers if we're under this utilization
    //utilizationTarget: 0.05,
    // the max server ram you can buy (it's a petabyte) as an exponent (power of 2)
    maxRamExponent: 20,
    // the min server ram you will buy
    minRamExponent: 1,
    // controls how far to upgrade hacknet servers
    hacknetMaxPayoffTime: 60 * 60 * 4,  // in seconds
    // controls how far to upgrade hacknet servers
    hacknetMaxSpend: 0,
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
}

/**
 * Gets all servers in the network.
 *
 * @param {function} scanWrap wrapper for `ns.scan(hostname)`
 * @param {function} getServerWrap wrapper for `ns.getServer(hostname)`
 * @return {Server[]}
 */
export function getServers(scanWrap, getServerWrap) {
    const servers = []
    for (const hostname of scanAll(scanWrap)) {
        const server = getServerWrap(hostname)
        if (server.hostname === 'home') {
            server.ramUsed = Math.min(ServerSettings.homeReservedRam + server.ramUsed, server.maxRam)
        }
        servers.push(server)
    }
    return servers
}

/**
 * Gets all server hostnames in the network.
 *
 * @param {function} scanWrap wrapper for `ns.scan(hostname)`
 * @return {string[]}
 */
export function scanAll(scanWrap) {
    const servers = []
    const spider = ['home']
    while (spider.length > 0) {
        const hostname = spider.pop()
        for (const scanned of scanWrap(hostname)) {
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
 * @param {function} scanWrap
 * @return {Object} key/value of hostname/route
 */
export function getRoutes(scanWrap) {
    const spider = ['home']
    const routes = {home: ['home']}
    while (spider.length > 0) {
        const hostname = spider.pop()
        for (const scanned of scanWrap(hostname)) {
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
 * Gets all player purchased servers.
 *
 * @param {Server[]} servers
 * @return {Server[]}
 */
export function filterPurchasedServers(servers) {
    return servers
        .filter(s => s.purchasedByPlayer)
}

/**
 * Gets all rooted servers.
 *
 * @param {Server[]} servers
 * @return {Server[]}
 */
export function filterRootedServers(servers) {
    return servers
        .filter(s => s.hasAdminRights && !s.purchasedByPlayer)
}

/**
 * Gets all rootable servers.
 *
 * @param {Server[]} servers
 * @param {int} playerHacking
 * @param {int} ownedCrackCount
 * @return {Server[]}
 */
export function filterRootableServers(servers, playerHacking, ownedCrackCount) {
    return servers
        .filter(s => !s.hasAdminRights
            && s.requiredHackingSkill <= playerHacking
            && s.numOpenPortsRequired <= ownedCrackCount)
}

/**
 * Gets all locked servers.
 *
 * @param {Server[]} servers
 * @return {Server[]}
 */
export function filterLockedServers(servers) {
    return servers
        .filter(s => !s.hasAdminRights)
}

/**
 * Gets all target servers.
 *
 * @param {Server[]} servers
 * @return {Server[]}
 */
export function filterTargetServers(servers) {
    return servers
        .filter(s => s.hasAdminRights && s.moneyMax > 0)
}

/**
 * Gets all hackable target servers, ensuring they are rooted prepped.
 *
 * @param {Server[]} servers
 * @return {Server[]}
 */
export function filterHackTargetServers(servers) {
    return filterTargetServers(servers)
        .filter(s => s.hackDifficulty <= s.minDifficulty + TargetSettings.minSecurityLevelOffset
            && s.moneyAvailable >= s.moneyMax * TargetSettings.maxMoneyMultiplayer)
}

/**
 * Gets all hackable target servers, only the ones not prepped, ensuring they are rooted.
 *
 * @param {Server[]} servers
 * @return {Server[]}
 */
export function filterPrepTargetServers(servers) {
    return filterTargetServers(servers)
        .filter(s => s.hackDifficulty > s.minDifficulty + TargetSettings.minSecurityLevelOffset
            || s.moneyAvailable < s.moneyMax * TargetSettings.maxMoneyMultiplayer)
}

/**
 * Gets all servers we can run scripts on.
 *
 * @param {Server[]} servers
 * @return {Server[]}
 */
export function filterHackingServers(servers) {
    return servers
        .filter(s => s.hasAdminRights)
        .sort((a, b) => (b.maxRam - b.ramUsed) - (a.maxRam - a.ramUsed)) // sort by free ram
}

/**
 * Gets all hackable target servers, only the ones not prepped, ensuring they are rooted.
 *
 * @param {Server[]} servers
 * @return {Server[]}
 */
export function filterOwnedServers(servers) {
    return servers
        .filter(s => s.purchasedByPlayer)
        .sort((a, b) => b.maxRam - a.maxRam)
}

/**
 * Gets the RAM available on a list of servers.
 *
 * @param {Server[]} servers
 * @return {Number}
 */
export function getFreeRam(servers) {
    return servers
        .map(s => s.maxRam - s.ramUsed)
        .reduce((prev, next) => prev + next)
}


/**
 * Gets the RAM used on a list of servers.
 *
 * @param {Server[]} servers
 * @return {Number}
 */
export function getUsedRam(servers) {
    return servers
        .map(s => s.ramUsed)
        .reduce((prev, next) => prev + next)
}

/**
 * Gets the total (max) RAM on a list of servers.
 * @param {Server[]} servers
 * @return {Number}
 */
export function getTotalRam(servers) {
    return servers
        .map(s => s.maxRam)
        .reduce((prev, next) => prev + next)
}

/**
 * Gets the RAM available to run hacking threads on a list of servers.
 *
 * @param {Server[]} servers
 * @param {number} ramPerThread per thread in GB
 * @return {Number}
 */
export function getFreeThreads(servers, ramPerThread) {
    return servers
        .map(s => Math.floor((s.maxRam - s.ramUsed) / ramPerThread))
        .reduce((prev, next) => prev + next)
}

/**
 * Gets the used RAM to run hacking threads on a list of servers.
 * @param {Server[]} servers
 * @param {number} ramPerThread per thread in GB
 * @return {Number}
 */
export function getUsedThreads(servers, ramPerThread) {
    return servers
        .map(s => Math.floor(s.ramUsed / ramPerThread))
        .reduce((prev, next) => prev + next)
}

/**
 * Gets the total (max) RAM to run hacking threads on a list of servers.
 * @param {Server[]} servers
 * @param {number} ramPerThread per thread in GB
 * @return {Number}
 */
export function getTotalThreads(servers, ramPerThread) {
    return servers
        .map(s => Math.floor(s.maxRam / ramPerThread))
        .reduce((prev, next) => prev + next)
}
