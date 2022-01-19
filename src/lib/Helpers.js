/**
 * Global helper functions
 */


/**
 * Format RAM as string
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
 * Format a delay and end time
 *
 * @param delay time in milliseconds
 * @param end time in milliseconds
 * @returns {string}
 */
export function formatDelays(delay, end) {
    return this.formatDelay(delay) + '-' + this.formatDelay(end)
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
    let hours = Math.floor(Math.abs(value) / 60 / 60),
        minutes = Math.floor((Math.abs(value) - (hours * 60 * 60)) / 60),
        seconds = Math.round(Math.abs(value) - (hours * 60 * 60) - (minutes * 60))
    return (value < 0 ? '-' : '')
        + (hours ? hours + ':' : '')
        + minutes
        + ':' + (seconds < 10 ? '0' + seconds : seconds)
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
 *
 * @param {Object} update - the KEY/VALUE pair to update
 * EG: {'Money':'100','Health':'10/10'}
 */
export function updateHUD(update) {
    const doc = eval('document')
    const hook0 = doc.getElementById('overview-extra-hook-0')
    const hook1 = doc.getElementById('overview-extra-hook-1')
    const keys = hook0.innerText.split("\n")
    const values = hook1.innerText.split("\n")
    const hud = {}
    for (let i = 0; i < keys.length; i++) {
        if (keys[i]) {
            hud[keys[i]] = values[i]
        }
    }
    for (const [k, v] of Object.entries(update)) {
        hud[k] = v
    }
    hook0.innerText = Object.keys(hud).join("\n")
    hook1.innerText = Object.values(hud).join("\n")
}


/**
 * Formats the attack so it can be printed.
 *
 * @param {NS} ns
 * @param {[Attack]} attacks
 * @param {String} type
 * @return {String}
 */
export function formatAttacks(ns, attacks, type) {
    const output = []
    for (const attack of attacks) {
        output.push(formatAttack(ns, attack, type))
    }
    return output.join('\n')
}


/**
 * Formats the attack so it can be printed.
 *
 * @param {NS} ns
 * @param {Attack} attack
 * @param {String} type
 * @return {String}
 */
export function formatAttack(ns, attack, type) {
    const output = [
        `${formatTime()}: ${type} ${attack.target}: ${ns.nFormat(attack.time / 1000, '00:00:00')} x${attack.cycles}`,
        //`value: ${attack.hackValue}`,
        `${ns.nFormat(attack.info.hackTotalPerSecond, '$0.0a')}/s (${ns.nFormat(attack.info.averageValuePerThreadPerSecond, '$0.0a')}/t/s)`,
        `on=${ns.nFormat(attack.info.activePercent, '0.0%')} take=~${ns.nFormat(attack.info.hackPercent, '0.00%')}=${ns.nFormat(attack.info.hackedPercent, '0.00%')}`,
        `ht ${ns.nFormat(attack.info.cycleThreads, '0a')} ${[attack.parts.h.threads, attack.parts.hw.threads, attack.parts.g.threads, attack.parts.gw.threads].join('|')} (${ns.nFormat(attack.info.attackThreads, '0a')} total)`,
    ]
    if (attack.info.prepThreads) {
        output.push(`pt ${ns.nFormat(attack.info.prepThreads, '0a')} ${[attack.parts.pw.threads, attack.parts.pg.threads, attack.parts.pgw.threads].join('|')}`)
    }
    return output.join(' | ')
}