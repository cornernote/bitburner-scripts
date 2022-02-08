/**
 * Global helper functions
 */


import {getCracks} from "./Server";

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
    const keys = hook0.innerText.split('\n')
    const values = hook1.innerText.split('\n')
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
    hook0.innerText = Object.keys(hud).join('\n')
    hook1.innerText = Object.values(hud).join('\n')
}

/**
 * Create a Grid View display of the provided objects
 *
 * @param  {Object[]} objects Array of data objects
 * @return {string}
 */
export function listView(objects) {
    if (!objects.length) {
        return '-> 0 rows'
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
    let output = '|'
    for (const cell in headers) {
        output += `${''.padEnd(widths[cell] + 2, '=')}|`
    }

    // Write headers
    output += '\n|'
    for (const cell in headers) {
        output += ` ${headers[cell].toString().padEnd(widths[cell], ' ')} |`
    }

    // Write separator
    output += '\n|'
    for (const cell in headers) {
        output += `${''.padEnd(widths[cell] + 2, '=')}|`
    }

    // Write rows
    for (const row in columns) {
        output += '\n|'
        for (const cell in columns[row]) {
            if (align[cell] === 'left') {
                output += ` ${columns[row][cell].toString().padEnd(widths[cell], ' ')} |`
            } else {
                output += ` ${columns[row][cell].toString().padStart(widths[cell], ' ')} |`
            }
        }
    }

    // Write separator
    output += '\n|'
    for (const cell in headers) {
        output += `${''.padEnd(widths[cell] + 2, '=')}|`
    }

    // Write row count
    output += '\n-> ' + columns.length.toString() + ' rows'

    output += '\n'
    return output
}


/**
 * Create a Detail View display of the provided object
 *
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
    let output = '|'
    output += `${''.padEnd(widths.headers + 2, '=')}|`
    output += `${''.padEnd(widths.columns + 2, '=')}|`

    // Write output
    output += '\n'
    for (const cell in headers) {
        output += '|'
        output += ` ${headers[cell].toString().padEnd(widths.headers, ' ')} |`
        output += ` ${columns[cell].toString().padEnd(widths.columns, ' ')} |`
        output += '\n'
    }

    // Write separator
    output += '|'
    output += `${''.padEnd(widths.headers + 2, '=')}|`
    output += `${''.padEnd(widths.columns + 2, '=')}|`
    output += '\n'

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

/**
 * Convert CSV to Array
 *
 * @param csv
 * @returns {*[]}
 */
export function convertCSVtoArray(csv) {
    const lines = csv.split('\n')
    const array = []
    const headers = lines[0].split(',')
    for (let i = 1; i < lines.length; i++) {
        const obj = {};
        const line = lines[i].split(',')
        for (let j = 0; j < headers.length; j++) {
            obj[headers[j]] = line[j]
        }
        array.push(obj);
    }
    return array
}

/**
 * Buys the TOR router with player interaction.
 *
 * @param {NS} ns
 */
export async function buyTor(ns) {
    const doc = eval('document')
    // click City
    for (const el of doc.querySelectorAll('p')) {
        if (el.textContent.includes('City')) {
            el.click()
        }
    }
    await ns.sleep(1000)
    // click Alpha Enterprises
    for (const el of doc.querySelectorAll('span')) {
        if (el.ariaLabel && el.ariaLabel.includes('Alpha Enterprises')) {
            el.click()
        }
    }
    await ns.sleep(1000)
    // click TOR Router
    for (const el of doc.querySelectorAll('button')) {
        if (el.textContent.includes('TOR Router')) {
            el.click()
        }
    }
    await ns.sleep(1000)
    // click Terminal
    for (const el of doc.querySelectorAll('p')) {
        if (el.textContent.includes('Terminal')) {
            el.click()
        }
    }
    await ns.sleep(1000)
}
