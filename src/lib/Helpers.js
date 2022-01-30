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
 * @param {Boolean} replace
 */
export function updateHUD(update, replace = false) {
    const doc = eval('document')
    const hook0 = doc.getElementById('overview-extra-hook-0')
    const hook1 = doc.getElementById('overview-extra-hook-1')
    const keys = hook0.innerText.split("\n")
    const values = hook1.innerText.split("\n")
    const hud = {}
    if (!replace) {
        for (let i = 0; i < keys.length; i++) {
            if (keys[i]) {
                hud[keys[i]] = values[i]
            }
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
 * @param {string} type
 * @return {string}
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

/**
 * Create a Grid View display of the provided objects
 * @param  {Object[]} objects Array of data objects
 * @return {string}
 */
export function listView(objects) {
    if (!objects.length) {
        return "\n-> " + columns.length.toString() + ' rows'
    }

    // Build header array
    const headers = Object.keys(objects[0])

    // Build column arrays
    const columns = objects.map(o => Object.values(o).map(p => formatProperty(p)))

    // Calculate widths
    const widths = []
    for (const cell in headers) {
        widths[cell] = columns.map(o => o[cell])
            .concat([headers[cell]])
            .map(s => s.toString().length)
            .reduce((a, b) => a > b ? a : b)
    }

    // Calculate alignment
    const align = []
    for (const cell in headers) {
        align[cell] = typeof columns[0][cell] === 'number' ? 'right' : 'left'
    }

    // Write separator
    let output = "|"
    for (const cell in headers) {
        output += `${"".padEnd(widths[cell] + 2, "=")}|`
    }

    // Write headers
    output += "\n|"
    for (const cell in headers) {
        output += ` ${headers[cell].toString().padEnd(widths[cell], " ")} |`
    }

    // Write separator
    output += "\n|"
    for (const cell in headers) {
        output += `${"".padEnd(widths[cell] + 2, "=")}|`
    }

    // Write rows
    for (const row in columns) {
        output += "\n|"
        for (const cell in columns[row]) {
            if (align[cell] === 'left') {
                output += ` ${columns[row][cell].toString().padEnd(widths[cell], " ")} |`
            } else {
                output += ` ${columns[row][cell].toString().padStart(widths[cell], " ")} |`
            }
        }
    }

    // Write separator
    output += "\n|"
    for (const cell in headers) {
        output += `${"".padEnd(widths[cell] + 2, "=")}|`
    }

    // Write row count
    output += "\n-> " + columns.length.toString() + ' rows'

    output += "\n"
    return output
}


/**
 * Create a Detail View display of the provided object
 * @param  {Object} object Data object
 */
export function detailView(object) {

    // Build header array
    const headers = Object.keys(object)

    // Build column arrays
    const columns = Object.values(object).map(p => formatProperty(p))

    // Calculate widths
    const widths = {
        headers: headers.map(s => s.toString().length).reduce((a, b) => a > b ? a : b),
        columns: columns.map(s => s.toString().length).reduce((a, b) => a > b ? a : b),
    }

    // Write separator
    let output = "|"
    output += `${"".padEnd(widths.headers + 2, "=")}|`
    output += `${"".padEnd(widths.columns + 2, "=")}|`

    // Write output
    output += "\n"
    for (const cell in headers) {
        output += "|"
        output += ` ${headers[cell].toString().padEnd(widths.headers, " ")} |`
        output += ` ${columns[cell].toString().padEnd(widths.columns, " ")} |`
        output += "\n"
    }

    // Write separator
    output += "|"
    output += `${"".padEnd(widths.headers + 2, "=")}|`
    output += `${"".padEnd(widths.columns + 2, "=")}|`
    output += "\n"

    return output
}

/**
 * Format anything to a string or a number, for gridView()/detailView()
 *
 * @param {*} property
 * @return {string|number}
 */
export function formatProperty(property) {
    if (typeof property === 'string' || typeof property === 'number') {
        return property
    }
    if (typeof property === 'boolean') {
        return property ? 'Y' : 'N'
    }
    if (property) {
        return JSON.stringify(property)
    }
    return ''
}

/**
 * Hacky way to run a terminal command
 *
 * @param message
 * @return HTMLInputElement
 */
export function terminalCommand(message) {
    const terminalInput = globalThis['document'].getElementById('terminal-input')
    if (terminalInput) {
        terminalInput.value = message
        const handler = Object.keys(terminalInput)[1]
        terminalInput[handler].onChange({target: terminalInput})
        terminalInput[handler].onKeyDown({keyCode: 13, preventDefault: () => null})
        return terminalInput
    }
}