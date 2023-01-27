import {
    getCracks,
    getHackingServers,
    getHackTargetServers,
    getPrepTargetServers,
    getRoutes,
    getServers,
    scanAll
} from "./lib/Server";
import {convertCSVtoArray, detailView, formatDelay, formatMoney, formatRam, listView} from "./lib/Helper";
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
    return ['player', 'servers', 'purchased', 'rooted', 'rootable', 'locked', 'files', 'stats', 'targets', 'rep'].concat(data.servers)
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
        ns.tprint('Help:\n' + helpInfo(ns))
        return
    }

    if (scanAll(ns).includes(args['_'][0])) {
        ns.tprint(args['_'][0] + ':\n' + serverInfo(ns, args['_'][0]))
        return
    }
    switch (args['_'][0]) {
        case 'player':
            ns.tprint('Player:\n' + playerInfo(ns))
            break
        case 'servers':
            ns.tprint('Servers:\n' + serversInfo(ns, args['_'][1]))
            break
        case 'purchased':
            ns.tprint('Purchased Servers:\n' + purchasedServersInfo(ns))
            break
        case 'rooted':
            ns.tprint('Rooted Servers:\n' + rootedServersInfo(ns))
            break
        case 'rootable':
            ns.tprint('Rootable Servers:\n' + rootableServersInfo(ns))
            break
        case 'locked':
            ns.tprint('Locked Servers:\n' + lockedServersInfo(ns))
            break
        case 'files':
            ns.tprint('Files:\n' + filesInfo(ns))
            break
        case 'stats':
            ns.tprint('Stats:\n' + statsInfo(ns))
            break
        case 'targets':
            ns.tprint('Targets:\n' + targetsInfo(ns))
            break
        case 'rep':
            ns.tprint('Rep:\n' + repInfo(ns, args['_'][1] ? args['_'][1] : '150'))
            break
        default:
            ns.tprint('Unknown command, Help:\n' + helpInfo(ns))
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
        `USAGE: run ${scriptName} [type] [option]`,
        '',
        'TYPES:',
        '- player',
        '- servers',
        '- purchased',
        '- rooted',
        '- rootable',
        '- locked',
        '- [hostname]',
        '- files',
        '  - option=filename',
        '- rep',
        '  - option=favor',
        '',
        'Examples:',
        `> run ${scriptName} player`,
        `> run ${scriptName} rooted`,
        `> run ${scriptName} n00dles`,
        `> run ${scriptName} rep 100000`,
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
 * Information about the Purchased Servers
 *
 * @param {NS} ns
 */
function purchasedServersInfo(ns) {
    const servers = getServers(ns).filter(s => s.purchasedByPlayer)
    return listView(servers.map(s => {
        return {
            hostname: s.hostname,
            'ram (used)': `${formatRam(ns, s.maxRam)}${s.ramUsed ? ' (' + formatRam(ns, s.ramUsed) + ')' : ''}`,
        }
    }))
}


/**
 * Information about the Rooted Servers
 *
 * @param {NS} ns
 */
function rootedServersInfo(ns) {
    const servers = getServers(ns).filter(s => s.hasAdminRights && !s.purchasedByPlayer)
    return listView(servers.map(s => {
        return {
            hostname: s.hostname,
            backdoor: s.backdoorInstalled,
            difficulty: `${ns.nFormat(s.hackDifficulty, '0a')}${s.minDifficulty < s.hackDifficulty ? ' > ' + ns.nFormat(s.minDifficulty, '0a') : ''}`,
            money: `${formatMoney(ns, s.moneyAvailable)}${s.moneyAvailable < s.moneyMax ? ' < ' + formatMoney(ns, s.moneyMax) : ''}`,
            'ram (used)': `${formatRam(ns, s.maxRam)}${s.ramUsed ? ' (' + formatRam(ns, s.ramUsed) + ')' : ''}`,
        }
    }))
}


/**
 * Information about the Rootable Servers
 *
 * @param {NS} ns
 */
function rootableServersInfo(ns) {
    const servers = getServers(ns).filter(s => !s.hasAdminRights
        && s.requiredHackingSkill <= ns.getPlayer().hacking
        && s.numOpenPortsRequired <= getCracks(ns).filter(c => c.owned).length)
    return listView(servers.map(s => {
        return {
            hostname: s.hostname,
            admin: `level=${s.requiredHackingSkill} ports=${s.numOpenPortsRequired}`,
            backdoor: s.backdoorInstalled,
            difficulty: `${ns.nFormat(s.hackDifficulty, '0a')}${s.minDifficulty < s.hackDifficulty ? ' > ' + ns.nFormat(s.minDifficulty, '0a') : ''}`,
            money: `${formatMoney(ns, s.moneyAvailable)}${s.moneyAvailable < s.moneyMax ? ' < ' + formatMoney(ns, s.moneyMax) : ''}`,
            'ram (used)': `${formatRam(ns, s.maxRam)}${s.ramUsed ? ' (' + formatRam(ns, s.ramUsed) + ')' : ''}`,
        }
    }))
}


/**
 * Information about the Locked Servers
 *
 * @param {NS} ns
 */
function lockedServersInfo(ns) {
    const servers = getServers(ns).filter(s => !s.hasAdminRights)
    return listView(servers.map(s => {
        return {
            hostname: s.hostname,
            admin: `level=${s.requiredHackingSkill} ports=${s.numOpenPortsRequired}`,
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
    const hackOutput = listView(hackAttacks.map(a => {
        return {
            target: a.target,
            time: formatDelay(a.time),
            cycle: ns.nFormat(a.info.cycleValue, '$0.0a'),
            batch: ns.nFormat(a.info.cycleValue * a.cycles, '$0.0a'),
            active: ns.nFormat(a.activePercent, '0.0%'),
            take: ns.nFormat(a.info.hackedPercent, '0.00%'),
            grow: ns.nFormat(a.info.growthRequired, '0.00%'),
            cycles: a.cycles,
            threads: `${ns.nFormat(a.cycleThreads, '0a')} ${Object.values(a.parts).map(p => p.threads).join('|')}`,
            total: ns.nFormat(a.cycleThreads * a.cycles, '0a'),
            value: ns.nFormat(a.value, '0.0a'),
        }
    }))
    const prepOutput = listView(prepAttacks.map(a => {
        return {
            target: a.target,
            time: formatDelay(a.time),
            threads: `${ns.nFormat(a.cycleThreads, '0a')} ${Object.values(a.parts).map(p => p.threads).join('|')}`,
        }
    }))
    return '\nHack Targets:\n' + hackOutput + '\nPrep Targets:\n' + prepOutput
}

/**
 *
 * @param {NS} ns
 * @param {number} favor
 * @returns {string}
 */
function repInfo(ns, favor) {
    return 'You need ' + ns.nFormat(repNeededForFavor(favor), '0.0a') + ' total reputation with a faction or company' + ' to get to ' + favor + ' favor.'
}

/**
 * Returns how much reputation you need in total with a faction or company to reach the favor favorTarget.
 *
 * (as of v0.37.1, the constants are the same for factions and companies)
 * formula adapted from Faction.js/getFavorGain(), Company.js/getFavorGain() and Constants.js:
 * https://github.com/danielyxie/bitburner/blob/master/src/Faction.js
 *
 * @author sschmidTU
 */
function repNeededForFavor(targetFavor) {
    const reputationToFavorBase = 500
    const reputationToFavorMult = 1.02
    let favorGain = 0
    let rep = 0
    let reqdRep = reputationToFavorBase
    while (favorGain < targetFavor) {
        rep += reqdRep
        ++favorGain
        reqdRep *= reputationToFavorMult
    }
    return rep
}
