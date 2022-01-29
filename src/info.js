import {getCracks, getServers, scanAll} from "./lib/Server";
import {detailView, formatMoney, formatRam, listView} from "./lib/Helpers";

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
    if (args[0] === 'server') {
        return data.servers
    }
    if (args[0] === 'servers') {
        return ['all', 'purchased', 'rooted', 'rootable']
    }
    return ['player', 'servers', 'server', 'files']
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
            ns.tprintf(serversInfo(ns, args['_'][1]))
            break
        case 'server':
            ns.tprintf(serverInfo(ns, args['_'][1] ? args['_'][1] : 'home'))
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
        '- servers',
        '  - entity=[all|purchased|rooted|rootable]',
        '- server',
        '  - entity=hostname',
        '- files',
        '  - entity=filename',
        '',
        'Examples:',
        `> run ${scriptName} player`,
        `> run ${scriptName} servers rooted`,
        `> run ${scriptName} server n00dles`,
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
 * @param {string} group
 */
function serversInfo(ns, group) {
    let servers = getServers(ns)
    if (group === 'purchased') {
        servers = servers.filter(s => s.purchasedByPlayer)
    }
    if (group === 'rooted') {
        servers = servers.filter(s => s.hasAdminRights && !s.purchasedByPlayer)
    }
    if (group === 'rootable') {
        servers = servers.filter(s => !s.hasAdminRights
            && s.requiredHackingSkill <= ns.getPlayer().hacking
            && s.numOpenPortsRequired <= getCracks(ns).filter(c => c.owned).length)
    }
    return listView(servers.map(s => {
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
    return listView(ns.ls('home').map(f => {
        return {
            filename: f,
            ramCost: ns.getScriptRam(f, 'home'),
        }
    }))
}