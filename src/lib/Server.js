/**
 * Server helper functions
 */


/**
 * Server Constants
 *
 * @type {{maxMoneyMultiplayer: number, minSecurityLevelOffset: number}}
 */
export const SERVER = {
    // used to decide if hack action=weaken
    // if (bestTarget.securityLevel > bestTarget.minSecurityLevel + settings.minSecurityLevelOffset) action = 'weaken'
    minSecurityLevelOffset: 1,
    // used to decide if hack action=grow
    // if (bestTarget.money < bestTarget.moneyMax * settings.maxMoneyMultiplayer) action = 'grow'
    maxMoneyMultiplayer: 0.9,
    // the name prefixed to purchased servers
    purchasedServerName: 'homenet',
    // the max number of servers you can have in your farm
    maxPurchasedServers: 25,
    // Don't attempt to buy any new servers if we're under this utilization
    utilizationTarget: 0.05,
    // the max server ram you can buy (it's a petabyte) as an exponent (power of 2)
    maxRamExponent: 20,
    // the min server ram you will buy
    minRamExponent: 1,
}

/**
 * Gets all servers in the network.
 *
 * @param {NS} ns
 * @return {[Server]}
 */
export function getServers(ns) {
    const servers = []
    for (const hostname of scanAll(ns)) {
        servers.push(ns.getServer(hostname))
    }
    return servers
}

/**
 * Gets all server hostnames in the network.
 *
 * @param {NS} ns
 * @return {[String]}
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
 * Gets all hackable target servers, ensuring they are rooted prepped.
 *
 * @param {NS} ns
 * @param {[Server]} servers
 * @return {[Server]}
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
 * @param {[Server]} servers
 * @return {[Server]}
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
 * @param {[Server]} servers
 * @return {[Server]}
 */
export function getHackingServers(ns, servers) {
    return servers
        .filter(s => s.hasAdminRights)
        .sort((a, b) => b.maxRam - a.maxRam)
}

/**
 * Gets all hackable target servers, only the ones not prepped, ensuring they are rooted.
 *
 * @param {NS} ns
 * @param {[Server]} servers
 * @return {[Server]}
 */
export function getOwnedServers(ns, servers) {
    return servers
        .filter(s => s.hostname.startsWith(SERVER.purchasedServerName))
        .sort((a, b) => b.maxRam - a.maxRam)
}

/**
 * Gets the RAM available on a list of servers.
 *
 * @param {NS} ns
 * @param {[Server]} servers
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
 * @param {[Server]} servers
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
 * @param {[Server]} servers
 * @return {Number}
 */
export function getFreeThreads(ns, servers) {
    return servers
        .map(s => Math.floor((s.maxRam - s.ramUsed) / 1.75))
        .reduce((prev, next) => prev + next)
}

/**
 * Gets the total (max) RAM to run hacking threads on a list of servers.
 * @param {NS} ns
 * @param {[Server]} servers
 * @return {Number}
 */
export function getTotalThreads(ns, servers) {
    return servers
        .map(s => Math.floor(s.maxRam / 1.75))
        .reduce((prev, next) => prev + next)
}
