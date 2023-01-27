/**
 * Global helper functions
 */


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
        terminalInput[handler].onKeyDown({key: 'Enter', preventDefault: () => null})
        //terminalInput[handler].onKeyDown({keyCode: 13, preventDefault: () => null})
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
