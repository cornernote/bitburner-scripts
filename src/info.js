import {
    filterHackingServers,
    filterLockedServers,
    filterPurchasedServers,
    filterRootableServers,
    filterRootedServers,
    filterTargetServers,
    getFreeRam,
    getFreeThreads,
    getRoutes,
    getTotalRam,
    getTotalThreads,
    getUsedRam,
    getUsedThreads,
    scanAll
} from './lib/Server';
import {
    formatDelay,
    formatDelays,
    formatMoney,
    formatNumber,
    formatPercent,
    formatRam,
    formatServerListItem
} from './lib/Format';
import {detailView, listView} from './lib/TermView';
import {attackDelays, fitThreads, getAttackDetails, getCracks, TargetSettings} from './lib/Target';
import {getPlayerRemote, getServerRemote, getServersRemote} from './lib/Remote';
import {repNeededForFavor} from "./lib/Faction";

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
    return [
        'player',
        'cracks',
        'servers',
        'purchased',
        'rooted',
        'rootable',
        'locked',
        'targets',
        'files',
        'mem',
        'rep',
        //'stats',
    ].concat(data.servers)
}

/**
 * Info
 * Displays information about the game.
 *
 * @param {NS} ns
 */
export async function main(ns) {
    // disable logs
    ns.disableLog('ALL')

    // load command arguments
    const args = ns.flags(argsSchema)

    // no command: load help
    if (!args['_'][0]) {
        ns.tprint('Help:\n' + helpInfo(ns, []))
        return
    }

    // command: server (eg n00dles)
    if (scanAll(ns.scan).includes(args['_'][0])) {
        ns.tprint(await serverInfo(ns, args['_'][0], args['_'][1]))
        return
    }
    // other commands (eg player)
    switch (args['_'][0]) {
        case 'help':
            ns.tprint(helpInfo(ns, args['_']))
            break
        case 'player':
            ns.tprint(await playerInfo(ns))
            break
        case 'cracks':
            ns.tprint(await cracksInfo(ns))
            break
        case 'servers':
            ns.tprint(await serversInfo(ns, args['_'][1]))
            break
        case 'purchased':
            ns.tprint(await purchasedServersInfo(ns))
            break
        case 'rooted':
            ns.tprint(await rootedServersInfo(ns))
            break
        case 'rootable':
            ns.tprint(await rootableServersInfo(ns))
            break
        case 'locked':
            ns.tprint(await lockedServersInfo(ns))
            break
        case 'targets':
            ns.tprint(await targetsInfo(ns, args['_'][1]))
            break
        case 'files':
            ns.tprint(await filesInfo(ns))
            break
        case 'mem':
            ns.tprint(await memInfo(ns))
            break
        case 'rep':
            ns.tprint(await repInfo(ns, args['_'][1] || '150'))
            break
        // case 'stats':
        //     ns.tprint('Stats:\n' + statsInfo(ns))
        //     break
        default:
            ns.tprint('Unknown command, Help:\n' + helpInfo(ns, []))
            break
    }
}

/**
 * Help information
 *
 * @param {NS} ns
 * @param {Array} args
 */
function helpInfo(ns, args) {
    const scriptName = ns.getScriptName()
    const aliasName = scriptName.substring(0, scriptName.length - 3)

    if (scanAll(ns.scan).includes(args[1])) {
        return [
            '',
            `Displays information about the ${args[1]} server.`,
            '',
            `USAGE: ${aliasName} ${args[1]} [fraction]`,
        ].join("\n")
    }
    switch (args[1]) {
        case 'player':
            return [
                '',
                'Displays information about the player.',
                '',
                `USAGE: ${aliasName} player`,
            ].join("\n")
        case 'cracks':
            return [
                '',
                'Displays information about software cracks.',
                '',
                `USAGE: ${aliasName} servers`,
            ].join("\n")
        case 'servers':
            return [
                '',
                'Displays information about all servers in the network.',
                '',
                `USAGE: ${aliasName} servers`,
            ].join("\n")
        case 'purchased':
            return [
                '',
                'Displays information about your owned servers.',
                '',
                `USAGE: ${aliasName} purchased`,
            ].join("\n")
        case 'rooted':
            return [
                '',
                'Displays information about rooted servers.',
                '',
                `USAGE: ${aliasName} rooted`,
            ].join("\n")
        case 'rootable':
            return [
                '',
                'Displays information about rootable servers.',
                '',
                `USAGE: ${aliasName} rootable`,
            ].join("\n")
        case 'locked':
            return [
                '',
                'Displays information about locked servers.',
                '',
                `USAGE: ${aliasName} locked`,
            ].join("\n")
        case 'targets':
            return [
                '',
                'Displays information about target servers.',
                '',
                `USAGE: ${aliasName} targets [fraction]`,
            ].join("\n")
        case 'files':
            return [
                '',
                'Displays information about files.',
                '',
                `USAGE: ${aliasName} files`,
            ].join("\n")
        case 'mem':
            return [
                '',
                'Displays information about memory usage.',
                '',
                `USAGE: ${aliasName} mem`,
            ].join("\n")
        case 'rep':
            return [
                '',
                'Displays information about faction rep.',
                '',
                `USAGE: ${aliasName} rep [favor]`,
            ].join("\n")
            break
        // case 'stats':
        //     ns.tprint('Stats:\n' + statsInfo(ns))
        //     break
    }

    return [
        '',
        'Displays information about the game.',
        '',
        `ALIAS: alias ${aliasName}="run ${scriptName}"`,
        `USAGE: ${aliasName} [action] [option]`,
        '',
        'ACTIONS:',
        '- player',
        '- cracks',
        '- servers',
        '- purchased',
        '- rooted',
        '- rootable',
        '- locked',
        '- targets [fraction]',
        '- [hostname]',
        '- files',
        '- mem',
        '- rep [favor]',
        //'- stats',
        '',
        'Examples:',
        `> ${aliasName} player`,
        `> ${aliasName} rooted`,
        `> ${aliasName} n00dles`,
        `> ${aliasName} targets 50`,
        `> ${aliasName} rep 150`,
    ].join("\n")
}

/**
 * Information about the Player
 *
 * @param {NS} ns
 * @returns {Promise<string>}
 */
async function playerInfo(ns) {
    const player = await getPlayerRemote(ns)
    const p = {}
    for (let [k, v] of Object.entries(player)) {
        let multiRow = false
        switch (k) {
            case 'money':
                v = formatMoney(ns, v)
                break
            case 'totalPlaytime':
            case 'playtimeSinceLastAug':
            case 'playtimeSinceLastBitnode':
                v = formatDelay(v)
                break
            case 'hp':
            case 'skills':
            case 'exp':
            case 'mults':
            case 'jobs':
                if (Object.entries(v).length) {
                    multiRow = true
                }
                break
        }
        if (multiRow) {
            for (let [kk, vv] of Object.entries(v)) {
                p[k + '.' + kk] = vv;
            }
        } else {
            p[k] = v
        }
    }

    return '\nPlayer:\n'
        + detailView(p)
}

/**
 * Information about Cracks
 *
 * @param {NS} ns
 * @param {string} group
 * @returns {Promise<string>}
 */
async function cracksInfo(ns, group) {
    const cracks = getCracks(ns.fileExists)

    return '\nCracks:\n'
        + listView(cracks)
}

/**
 * Information about the Servers
 *
 * @param {NS} ns
 * @param {string} group
 * @returns {Promise<string>}
 */
async function serversInfo(ns, group) {
    const player = await getPlayerRemote(ns)
    const cracks = getCracks(ns.fileExists)
    const ownedCracks = cracks.filter(c => c.owned)
    const servers = await getServersRemote(ns)

    return '\nServers:\n'
        + listView(servers.map(s => formatServerListItem(ns, s, player.skills.hacking, ownedCracks.length)))
}

/**
 * Information about the Purchased Servers
 *
 * @param {NS} ns
 * @returns {Promise<string>}
 */
async function purchasedServersInfo(ns) {
    const servers = await getServersRemote(ns)
    const purchasedServers = filterPurchasedServers(servers)

    return '\nPurchased Servers (our own servers):\n'
        + listView(purchasedServers.map(s => {
            return {
                hostname: s.hostname,
                'ram (free)': `${formatRam(ns, s.maxRam)} (${formatRam(ns, s.maxRam - s.ramUsed)})`,
                'threads (free)': `${formatNumber(ns, Math.floor(s.maxRam / 1.75))} (${formatNumber(ns, Math.floor((s.maxRam - s.ramUsed) / 1.75))})`,
            }
        }))
}

/**
 * Information about the Rooted Servers
 *
 * @param {NS} ns
 * @returns {Promise<string>}
 */
async function rootedServersInfo(ns) {
    const player = await getPlayerRemote(ns)
    const cracks = getCracks(ns.fileExists)
    const ownedCracks = cracks.filter(c => c.owned)
    const servers = await getServersRemote(ns)
    const rootedServers = filterRootedServers(servers)

    return '\nRooted Servers (already have root access):\n'
        + listView(rootedServers.map(s => formatServerListItem(ns, s, player.skills.hacking, ownedCracks.length)))
}

/**
 * Information about the Rootable Servers
 *
 * @param {NS} ns
 * @returns {Promise<string>}
 */
async function rootableServersInfo(ns) {
    const player = await getPlayerRemote(ns)
    const cracks = getCracks(ns.fileExists)
    const ownedCracks = cracks.filter(c => c.owned)
    const servers = await getServersRemote(ns)
    const rootableServers = filterRootableServers(servers, player.skills.hacking, ownedCracks.length)

    return '\nRootable Servers (can gain root access):\n'
        + listView(rootableServers.map(s => formatServerListItem(ns, s, player.skills.hacking, ownedCracks.length)))
}

/**
 * Information about the Locked Servers
 *
 * @param {NS} ns
 * @returns {Promise<string>}
 */
async function lockedServersInfo(ns) {
    const player = await getPlayerRemote(ns)
    const cracks = getCracks(ns.fileExists)
    const ownedCracks = cracks.filter(c => c.owned)
    const servers = await getServersRemote(ns)
    const lockedServers = filterLockedServers(servers)

    return '\nLocked Servers (no root access):\n'
        + listView(lockedServers.map(s => formatServerListItem(ns, s, player.skills.hacking, ownedCracks.length)))
}


/**
 * Information about attack targets
 *
 * @param {NS} ns
 * @param {number} hackFraction
 * @returns {Promise<string>}
 */
async function targetsInfo(ns, hackFraction) {
    hackFraction = hackFraction ? hackFraction : TargetSettings.hackFraction
    const servers = await getServersRemote(ns)
    const targetServers = filterTargetServers(servers)
    const serverList = targetServers
        .map(server => {
            const attackDetails = getAttackDetails(server, hackFraction, ns.hackAnalyze, ns.growthAnalyze, ns.getHackTime, ns.getGrowTime, ns.getWeakenTime)
            return {
                hostname: server.hostname,
                '$avail': formatMoney(ns, server.moneyAvailable) + ' ' + formatPercent(ns, server.moneyAvailable / server.moneyMax),
                'security': formatNumber(ns, server.hackDifficulty) + ':' + formatNumber(ns, server.minDifficulty),
                'H.type': attackDetails.type === 'hack' ? 'hack' : 'prep',
                'H.money': formatMoney(ns, attackDetails.moneyPerHack),
                'H.time': formatDelay(attackDelays(server.hostname, ns.getHackTime, ns.getGrowTime, ns.getWeakenTime).times.w),
                //'P.threads': formatNumber(ns, attackDetails.threadsPerPrep),
                //'H.threads': formatNumber(ns, attackDetails.hackThreadsCount),
                'P.th*min': formatNumber(ns, attackDetails.threadsPerPrep * attackDetails.minsPerHack),
                'H.th*min': formatNumber(ns, attackDetails.hackThreadsCount * attackDetails.minsPerHack),
                '$/th': formatMoney(ns, attackDetails.moneyPerHack / attackDetails.hackThreadsCount),
                '$/min': formatMoney(ns, attackDetails.moneyPerHack / attackDetails.minsPerHack),
                '$/th/min': formatMoney(ns, attackDetails.moneyPerHack / attackDetails.hackThreadsCount / attackDetails.minsPerHack),
                sort: attackDetails.moneyPerHack / attackDetails.hackThreadsCount / attackDetails.minsPerHack,
            }
        })
        .sort((a, b) => {
            return b.sort - a.sort
        })
        .map(server => {
            delete server.sort
            return server
        });

    return `\nTarget Servers (hack ${formatPercent(ns, hackFraction)}):\n`
        + listView(serverList)
}

/**
 * Information about a Server
 *
 * @param {NS} ns
 * @param {string} hostname
 * @param {number} hackFraction
 * @returns {Promise<string>}
 */
async function serverInfo(ns, hostname, hackFraction) {
    hackFraction = hackFraction ? hackFraction : TargetSettings.hackFraction
    const server = await getServerRemote(ns, hostname)
    const servers = await getServersRemote(ns)
    const routes = getRoutes(ns.scan)
    const attackDetails = getAttackDetails(server, hackFraction, ns.hackAnalyze, ns.growthAnalyze, ns.getHackTime, ns.getGrowTime, ns.getWeakenTime)
    const freeThreads = getFreeThreads(filterHackingServers(servers), 1.7)

    server.route = routes[server.hostname] ? routes[server.hostname].join(' > ') : ''

    server['hack.type'] = attackDetails.type
    server['hack.percent'] = formatPercent(ns, hackFraction)
    server['hack.money'] = formatMoney(ns, attackDetails.moneyPerHack)
    server['hack.time'] = formatDelay(attackDetails.delays.time)
    server['hack.threads'] = Object.values(attackDetails.hackThreads).join('·')
    server['hack.threads.fit'] = Object.values(fitThreads(server, 'hack', attackDetails.hackThreads, freeThreads, false, ns.hackAnalyze, ns.growthAnalyze)).join('·')
    server['hack.th'] = formatNumber(ns, attackDetails.hackThreadsCount)
    server['hack.th*min'] = formatNumber(ns, attackDetails.hackThreadsCount * attackDetails.minsPerHack)
    server['hack.$/th'] = formatMoney(ns, attackDetails.moneyPerHack / attackDetails.hackThreadsCount)
    server['hack.$/min'] = formatMoney(ns, attackDetails.moneyPerHack / attackDetails.minsPerHack)
    server['hack.$/th/min'] = formatMoney(ns, attackDetails.moneyPerHack / attackDetails.hackThreadsCount / attackDetails.minsPerHack)

    if (attackDetails.type === 'prep') {
        server['prep.threads'] = Object.values(attackDetails.prepThreads).join('·')
        server['prep.threads.fit'] = Object.values(fitThreads(server, 'prep', attackDetails.prepThreads, freeThreads, false, ns.hackAnalyze, ns.growthAnalyze)).join('·')
        server['prep.th'] = formatNumber(ns, attackDetails.threadsPerPrep)
        server['prep.th*min'] = formatNumber(ns, attackDetails.hackThreadsCount * attackDetails.minsPerHack)
    }

    server['time.hack'] = formatDelays(attackDetails.delays.h, attackDetails.delays.times.h)
    server['time.hackWeaken'] = formatDelays(attackDetails.delays.w, attackDetails.delays.times.w)
    server['time.grow'] = formatDelays(attackDetails.delays.g, attackDetails.delays.times.g)
    server['time.growWeaken'] = formatDelays(attackDetails.delays.gw, attackDetails.delays.times.w)

    for (let [k, v] of Object.entries(server)) {
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

    return `\nServer ${server.hostname}:\n`
        + detailView(server)
}

/**
 * Information about the Files
 *
 * @param {NS} ns
 * @returns {Promise<string>}
 */
async function filesInfo(ns) {
    return '\nFiles:\n'
        + listView(ns.ls('home').map(f => {
            return {
                filename: f, ramCost: ns.getScriptRam(f, 'home'),
            }
        }))
}

/**
 * Information about memory usage
 *
 * @param {NS} ns
 * @returns {Promise<string>}
 */
async function memInfo(ns) {
    const servers = await getServersRemote(ns)
    const hackingServers = filterHackingServers(servers)
    const ramPerThread = 1.75

    return '\nMemory:\n'
        + detailView({
                totalMemory: formatRam(ns, getTotalRam(hackingServers)),
                usedMemory: formatRam(ns, getUsedRam(hackingServers)),
                freeMemory: formatRam(ns, getFreeRam(hackingServers)),
                totalThreads: getTotalThreads(hackingServers, ramPerThread),
                usedThreads: getUsedThreads(hackingServers, ramPerThread),
                freeThreads: getFreeThreads(hackingServers, ramPerThread),
            }
        )
}

/**
 * Information about faction rep needed for favor.
 *
 * @param {NS} ns
 * @param {number} favor
 * @returns {string}
 */
async function repInfo(ns, favor) {
    return '\nRep:\n'
        + 'You need ' + formatNumber(ns, repNeededForFavor(favor)) + ' total reputation with a faction or company' + ' to get to ' + favor + ' favor.'
}

// /**
//  * Information about attack stats
//  *
//  * @param ns
//  * @returns {string}
//  */
// function statsInfo(ns) {
//     const stats = convertCSVtoArray(ns.read('/data/port-stats.csv.txt'))
//         .filter(s => s.type !== 'check')
//         .sort((a, b) => a.finish - b.finish)
//     return listView(stats.map(s => {
//         return {
//             target: s.target,
//             type: s.type.substr(0, 4),
//             host: s.host + ' x' + s.threads,
//             start: s.start - s.estStart,
//             delay: Math.round(s.delay - s.estDelay),
//             time: Math.round(s.time - s.estTime),
//             finish: Math.round(s.finish - s.estFinish),
//         }
//     }))
// }
