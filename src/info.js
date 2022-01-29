import {getServers, scanAll} from "./lib/Server";
import {detailView, formatMoney, formatRam, gridView} from "./lib/Helpers";

/**
 * Command options
 */
const argsSchema = [
    ['help', false],
]

/**
 * Command auto-complete
 * @param {Object} data
 * @param {*} args
 */
export function autocomplete(data, args) {
    data.flags(argsSchema)
    if (args[0] === 'servers') {
        return data.servers
    }
    return ['player', 'servers', 'files']
}


/**
 * Entry point
 *
 * @param {NS} ns
 */
export async function main(ns) {
    // get some stuff ready
    ns.disableLog('ALL')
    const args = ns.flags(argsSchema)
    if (!args['_'][0]) {
        ns.tprintf(helpInfo(ns))
    }
    switch (args['_'][0]) {
        case 'player':
            ns.tprintf(playerInfo(ns))
            break
        case 'servers':
            if (args['_'][1]) {
                ns.tprintf(serverInfo(ns, args['_'][1]))
            } else {
                ns.tprintf(serversInfo(ns))
            }
            break
        case 'files':
            ns.tprintf(filesInfo(ns))
            break
        default:
            ns.tprintf(helpInfo(ns))
            break
    }
}


/**
 * Help information
 *
 * @param {NS} ns
 */
function helpInfo(ns) {
    const scriptName = ns.getScriptName()
    return [
        'Displays information about the game.',
        '',
        `USAGE: run ${scriptName} [type] [entity]`,
        '',
        'TYPES:',
        '- player',
        '- server',
        '  - entity=hostname',
        '- files',
        '  - entity=filename',
        '',
        'Examples:',
        `> run ${scriptName} player`,
        `> run ${scriptName} servers n00dles`,
    ].join("\n")
}


/**
 * Information about the Player
 *
 * @param {NS} ns
 */
function playerInfo(ns) {
    const player = {}
    const p = ns.getPlayer()
    for (let [k, v] of Object.entries(p)) {
        switch (k) {
            case 'money':
                v = formatMoney(ns, v)
                break
        }
        player[k] = v
    }
    return detailView(player)
}

/**
 * Information about the Servers
 *
 * @param {NS} ns
 */
function serversInfo(ns) {
    return gridView(getServers(ns).map(s => {
        return {
            hostname: s.hostname,
            //purchased: s.purchasedByPlayer,
            admin: s.hasAdminRights ? s.hasAdminRights : `${s.openPortCount} / ${s.numOpenPortsRequired}`,
            backdoor: s.backdoorInstalled,
            difficulty: `${s.hackDifficulty}${s.minDifficulty < s.hackDifficulty ? ' > ' + s.minDifficulty : ''}`,
            money: `${formatMoney(ns, s.moneyAvailable)}${s.moneyAvailable < s.moneyMax ? ' < ' + formatMoney(ns, s.moneyMax) : ''}`,
            'ram (used)': `${formatRam(ns, s.maxRam)}${s.ramUsed ? ' (' + formatRam(ns, s.ramUsed) + ')' : ''}`,
        }
    }))
}

/**
 * Information about a Server
 *
 * @param {NS} ns
 * @param {string} hostname
 */
function serverInfo(ns, hostname) {
    const server = {}
    const s = ns.getServer(hostname)
    for (let [k, v] of Object.entries(s)) {
        switch (k) {
            case 'moneyMax':
            case 'moneyAvailable':
                v = formatMoney(ns, v)
                break
            case 'ramUsed':
            case 'maxRam':
                v = formatRam(ns, v)
                break
        }
        server[k] = v
    }
    return detailView(server)
}


/**
 * Information about the Files
 *
 * @param {NS} ns
 */
function filesInfo(ns) {
    return gridView(ns.ls('home').map(f => {
        return {
            filename: f,
            ramCost: ns.getScriptRam(f, 'home'),
        }
    }))
}