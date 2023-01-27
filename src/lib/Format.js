/**
 * Format helper functions
 */

/**
 * Format Number as string
 *
 * @param {NS} ns
 * @param number
 * @returns {string}
 */
export function formatNumber(ns, number) {
    return ns.nFormat(number, '0.0a')
}

/**
 * Format Money as string
 *
 * @param {NS} ns
 * @param money
 * @returns {string}
 */
export function formatMoney(ns, money) {
    return ns.nFormat(money, '$0.0a')
}

/**
 * Format RAM as string
 *
 * @param {NS} ns
 * @param gb
 * @returns {string}
 */
export function formatRam(ns, gb) {
    return ns.nFormat(gb * 1000 * 1000 * 1000, '0.0b')
}

/**
 * Format Percentage as string
 *
 * @param {NS} ns
 * @param {number} percent
 * @returns {string}
 */
export function formatPercent(ns, percent) {
    return ns.nFormat(percent, '0%')
}

/**
 * Format a delay and end time
 *
 * @param delay time to delay the command in milliseconds
 * @param time time to run the command in milliseconds
 * @returns {string}
 */
export function formatDelays(delay, time) {
    return formatDelay(delay) + ' - ' + formatDelay(delay + time)
}

/**
 * Format a delay in MM:SS
 * Allows negative times (nsFormat didn't work)
 *
 * @param value time in milliseconds
 * @returns {string}
 */
export function formatDelay(value) {
    value = value / 1000
    const hours = Math.floor(Math.abs(value) / 60 / 60),
        minutes = Math.floor((Math.abs(value) - (hours * 60 * 60)) / 60),
        seconds = Math.floor(Math.abs(value) - (hours * 60 * 60) - (minutes * 60)),
        milliseconds = Math.round(Math.abs(value * 1000) - (hours * 60 * 60 * 1000) - (minutes * 60 * 1000) - (seconds * 1000))
    return (value < 0 ? '-' : '')
        + (hours ? hours + ':' : '')
        + minutes
        + ':' + seconds.toString().padStart(2, '0')
        + '.'
        + milliseconds.toString().padStart(4, '0')
}

/**
 * Format a delay and end time
 *
 * @param delay time in milliseconds
 * @param end time in milliseconds
 * @returns {string}
 */
export function formatTimes(delay, end) {
    return this.formatTime(delay) + '-' + this.formatTime(end)
}

/**
 * Format a locale time in HH:MM:SS
 *
 * @param value time in milliseconds
 * @returns {string}
 */
export function formatTime(value = 0) {
    if (!value) {
        value = new Date().getTime()
    }
    return new Date(value).toLocaleTimeString()
}

/**
 * Parse data to a standard format for listing
 *
 * @param {NS} ns
 * @param {Server} server
 * @param {int} playerHacking
 * @param {int} ownedCrackCount
 * @return {Object}
 */
export function formatServerListItem(ns, server, playerHacking, ownedCrackCount) {
    return {
        hostname: server.hostname,
        admin: formatAdminRequirement(server, playerHacking, ownedCrackCount)
            + (server.backdoorInstalled ? ' + BACKDOOR' : '')
            + (server.purchasedByPlayer ? ' + PURCHASED' : ''),
        security: `${ns.nFormat(server.hackDifficulty, '0a')}${server.minDifficulty < server.hackDifficulty ? ' > ' + ns.nFormat(server.minDifficulty, '0a') : ''}`,
        money: `${formatMoney(ns, server.moneyAvailable)}${server.moneyAvailable < server.moneyMax ? ' < ' + formatMoney(ns, server.moneyMax) : ''}`,
        'ram (used)': `${formatRam(ns, server.maxRam)}${server.ramUsed ? ' (' + formatRam(ns, server.ramUsed) + ')' : ''}`,
    }
}

/**
 * Format the server admin field
 *
 * @param {Server} server
 * @param {int} playerHacking
 * @param {int} ownedCrackCount
 * @return {string}
 */
export function formatAdminRequirement(server, playerHacking, ownedCrackCount) {
    if (server.hasAdminRights) {
        return 'ADMIN'
    }
    const needs = [];
    if (server.numOpenPortsRequired > ownedCrackCount) {
        needs.push(`SOFTWARE(${server.numOpenPortsRequired})`)
    }
    if (server.requiredHackingSkill > playerHacking) {
        needs.push(`SKILL(${server.requiredHackingSkill})`)
    }
    return needs.length ? needs.join(' + ') : 'ROOTABLE'
}
