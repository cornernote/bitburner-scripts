import {
    getCracks,
    getHackingServers,
    getHackTargetServers,
    getPrepTargetServers,
    getRoutes,
    getServers
} from "./lib/Server";
import {convertCSVtoArray, detailView, formatDelay, formatMoney, formatRam, formatTime, listView} from "./lib/Helpers";
import {getBestHackAttacks, getBestPrepAttacks} from "./lib/Attack";

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
        return ['all', 'purchased', 'rooted', 'rootable', 'locked']
    }
    return ['player', 'servers', 'server', 'files', 'stats', 'targets']
}


/**
 * Entry point
 *
 * @param {NS} ns
 */
export async function main(ns) {
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
        case 'stats':
            ns.tprintf(statsInfo(ns))
            break
        case 'targets':
            ns.tprintf(targetsInfo(ns))
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
        '  - entity=[all|purchased|rooted|rootable|locked]',
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
    if (group === 'locked') {
        servers = servers.filter(s => !s.hasAdminRights)
    }
    return listView(servers.map(s => {
        return {
            hostname: s.hostname,
            //purchased: s.purchasedByPlayer,
            admin: s.hasAdminRights ? s.hasAdminRights : `level=${s.requiredHackingSkill} ports=${s.numOpenPortsRequired}`,
            backdoor: s.backdoorInstalled,
            difficulty: `${ns.nFormat(s.hackDifficulty, '0a')}${s.minDifficulty < s.hackDifficulty ? ' > ' + ns.nFormat(s.minDifficulty, '0a') : ''}`,
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
    const r = getRoutes(ns)
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
    server.route = r[server.hostname] ? r[server.hostname].join(' > ') : ''
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

/**
 * Information about attack stats
 *
 * @param ns
 * @returns {string}
 */
function statsInfo(ns) {
    const stats = convertCSVtoArray(ns.read('/data/port-stats.csv.txt'))
        .filter(s => s.type !== 'check')
        .sort((a, b) => a.finish - b.finish)
    return listView(stats.map(s => {
        return {
            target: s.target,
            type: s.type.substr(0, 4),
            host: s.host + ' x' + s.threads,
            start: s.start - s.estStart,
            delay: Math.round(s.delay - s.estDelay),
            time: Math.round(s.time - s.estTime),
            finish: Math.round(s.finish - s.estFinish),
        }
    }))
}

/**
 * Information about attack targets
 *
 * @param {NS} ns
 * @returns {string}
 */
function targetsInfo(ns) {
    const player = ns.getPlayer()
    const servers = getServers(ns)
    const cores = 1 // assume we won't run on home, or home has 1 core
    const hackingServers = getHackingServers(ns, servers).map(s => {
        s.ramUsed = 0 // assume no ram used
        return s
    })
    const hackTargetServers = getHackTargetServers(ns, servers)
    const hackAttacks = getBestHackAttacks(ns, player, hackTargetServers, hackingServers, cores)
    const prepTargetServers = getPrepTargetServers(ns, servers)
    const prepAttacks = getBestPrepAttacks(ns, player, prepTargetServers, hackingServers, cores)
    // const prepAttack = getBestPrepAttack(ns, player, prepTargetServers, hackingServers, cores)
    // const bestPrepAttack = prepAttack ? formatAttack(ns, prepAttack, 'prep') : ''

    return [
        `SERVERS`,
        `${servers.map(s => s.hostname).join(', ')}`,
        '',
        `HACKS`,
        `${hackTargetServers.map(s => s.hostname).join(', ')}`,
        `${hackAttacks.map(a => [
            `hack ${a.target}: ${formatDelay(a.time)}`,
            `${ns.nFormat(a.info.cycleValue, '$0.0a')}/cycle ${ns.nFormat(a.info.cycleValue * a.cycles, '$0.0a')}/batch`,
            `on=${ns.nFormat(a.activePercent, '0.0%')}% take=${ns.nFormat(a.info.hackedPercent, '0.00%')}% grow=${ns.nFormat(a.info.growthRequired, '0.00%')}%`,
            `threads=${a.cycles}x ${ns.nFormat(a.cycleThreads, '0a')} ${Object.values(a.parts).map(p => p.threads).join('|')} (${ns.nFormat(a.cycleThreads * a.cycles, '0a')} total)`,
        ].join(' | ')).join('\n')}`,
        '',
        `PREPS`,
        `${prepTargetServers.map(s => s.hostname).join(', ')}`,
        `${prepAttacks.map(a => [
            `prep ${a.target}: ${formatDelay(a.time)}`,
            `threads=${ns.nFormat(a.cycleThreads, '0a')} ${Object.values(a.parts).map(p => p.threads).join('|')}`
        ].join(' | ')).join('\n')}`,
    ].join('\n')
}
