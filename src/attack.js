import {
    filterHackingServers,
    filterOwnedServers,
    filterRootableServers,
    filterTargetServers,
    getFreeThreads,
    getTotalRam,
    ServerSettings
} from './lib/Server';
import {
    attackThreadsCount,
    buildAttack,
    getAttackDetails,
    getCracks,
    launchAttack,
    TargetSettings,
} from './lib/Target';
import {listView} from './lib/TermView';
import {formatDelays, formatMoney, formatPercent, formatRam} from './lib/Format';
import {
    deleteServerRemote,
    getPlayerRemote,
    getPurchasedServerCostRemote,
    getServerRemote,
    getServersRemote, infectRemote,
    killAllRemote,
    purchaseServerRemote
} from './lib/Remote';
import {terminalCommand} from './lib/Helper';

/**
 * Command options
 */
const argsSchema = [
    ['help', false],
    ['once', false],
    ['percent', 0.2],
    ['force', false],
    ['no-buy', false],
]

/**
 * Command auto-complete
 * @param {Object} data
 * @param {*} args
 */
export function autocomplete(data, args) {
    data.flags(argsSchema)
    return data.servers
}

/**
 * Attack
 * Hack money from targets.
 *
 * @param {NS} ns
 */
export async function main(ns) {
    // disable logs
    ns.disableLog('ALL')

    // load command arguments
    const args = ns.flags(argsSchema)

    // load help
    if (args['help'] || args['_'][0] === 'help') {
        ns.tprint('Help:\n' + helpInfo(ns, []))
        return
    }

    // work, sleep, repeat
    do {
        if (!args['no-buy']) {
            await buyCracks(ns)
        }
        await runCracks(ns)
        if (!args['no-buy']) {
            await buyServers(ns)
        }
        await runAttack(ns, args['_'][0], args['percent'], args['force'])

        await ns.sleep(1000)
    } while (!args.once)
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

    return [
        '',
        'Launches an attack on a server.',
        '',
        `ALIAS: alias ${aliasName}="run ${scriptName}"`,
        `USAGE: ${aliasName} [target] [--once=false] [--percent=0.2] [--force=false] [--no-buy=false]`,
        '',
        'Examples:',
        `> ${aliasName} n00dles`,
        `> ${aliasName} --force`,
    ].join("\n")
}

async function buyCracks(ns) {
    const player = await getPlayerRemote(ns)
    const cracks = getCracks(ns.fileExists)

    // recommend the player buy the tor router
    if (!ns.hasTorRouter() && player.money > 200000) {
        ns.tprint('\n' + [
            '============================',
            '|| ⛔ Tor Router Required ||',
            '============================',
            '',
            `You should buy the TOR Router at City > alpha ent.`
        ].join('\n') + '\n')
    }

    // buy unowned cracks
    else {
        const unownedCracks = cracks.filter(c => c.cost && !c.owned)
        if (unownedCracks.length) {
            ns.tprint('\n' + [
                '======================',
                '|| 💰 Buying Cracks ||',
                '======================',
            ].join('\n'))
        }
        for (const crack of unownedCracks) {
            if (player.money > crack.cost) {
                ns.tprint(`Purchasing ${crack.file}`)
                player.money -= crack.cost
                await terminalCommand('connect darkweb')
                await terminalCommand(`buy ${crack.file}`)
                await terminalCommand('home')
            }
        }
    }

}

/**
 * Run owned port hacks on rootable servers.
 *
 * @param ns
 * @return {Promise<void>}
 */
async function runCracks(ns) {
    const player = await getPlayerRemote(ns)
    const cracks = getCracks(ns.fileExists)
    const ownedCracks = cracks.filter(c => c.owned)
    const servers = await getServersRemote(ns)
    const rootableServers = filterRootableServers(servers, player.skills.hacking, ownedCracks.length)
    if (rootableServers.length) {
        ns.tprint('\n' + [
            '=======================',
            '|| 💣 Running Cracks ||',
            '=======================',
            '',
            `About to run cracks on ${rootableServers.map(s => s.hostname).join('\n > ')}...`
        ].join('\n') + '\n')
        rootableServers.map(s => s.hostname).forEach(hostname => {
            for (const crack of ownedCracks) {
                ns[crack.method](hostname)
            }
            ns.nuke(hostname)
        })
    }

    function countedTowardsMemory(ns) {
        ns.brutessh('')
        ns.ftpcrack('')
        ns.relaysmtp('')
        ns.httpworm('')
        ns.sqlinject('')
    }
}


/**
 * Manage purchased servers.
 *
 * @param {NS} ns
 * @returns {Promise<boolean>} false if we cannot purchase any more servers
 */
async function buyServers(ns) {
    const servers = await getServersRemote(ns)
    const purchasedServers = filterOwnedServers(servers)
    const totalMaxRam = purchasedServers.length
        ? getTotalRam(purchasedServers)
        : 0

    // Check for other reasons not to go ahead with the purchase
    const prefix = 'tried to buy server, but '
    const player = await getPlayerRemote(ns)
    const budget = player.money

    // Determine the most ram we can buy with this money
    let exponentLevel
    for (exponentLevel = 1; exponentLevel < ServerSettings.maxRamExponent; exponentLevel++) {
        if (await getPurchasedServerCostRemote(ns, Math.pow(2, exponentLevel + 1)) > budget) {
            break
        }
    }
    const maxRamPossibleToBuy = Math.pow(2, exponentLevel)

    // Abort if we don't have enough money
    const cost = await getPurchasedServerCostRemote(ns, maxRamPossibleToBuy)
    if (budget < cost) {
        ns.tprint(prefix + 'budget ' + formatMoney(ns, budget) + ' is less than ' + formatMoney(ns, cost) + ' for ' + formatRam(ns, maxRamPossibleToBuy))
        return true
    }

    if (exponentLevel < ServerSettings.maxRamExponent) {
        // Abort if purchasing this server wouldn't improve our total RAM by more than 10% (ensures we buy in meaningful increments)
        if (maxRamPossibleToBuy / totalMaxRam < 0.1) {
            ns.tprint(prefix + 'the most RAM we can buy (' + formatRam(ns, maxRamPossibleToBuy) + ') is less than 10% of total available RAM ' + formatRam(ns, totalMaxRam) + ')')
            return true
        }
    }

    // check compared to current purchased servers
    let maxPurchasableServerRam = Math.pow(2, ServerSettings.maxRamExponent)
    let worstServerName = null
    let worstServerRam = maxPurchasableServerRam
    let bestServerName = null
    let bestServerRam = 0
    for (const server of purchasedServers.filter(s => s.hostname !== 'home')) {
        if (server.maxRam < worstServerRam) {
            worstServerName = server.hostname
            worstServerRam = server.maxRam
        }
        if (server.maxRam >= bestServerRam) {
            bestServerName = server.hostname
            bestServerRam = server.maxRam
        }
    }

    // Abort if our worst previously-purchased server is better than the one we're looking to buy (ensures we buy in sane increments of capacity)
    if (worstServerName != null && maxRamPossibleToBuy < worstServerRam) {
        ns.tprint(prefix + 'the most RAM we can buy (' + formatRam(ns, maxRamPossibleToBuy) +
            ') is less than our worst purchased server ' + worstServerName + '\'s RAM ' + formatRam(ns, worstServerRam))
        return true
    }
    // Only buy new servers as good as or better than our best bought server (anything less is considered a regression in value)
    if (bestServerRam != null && maxRamPossibleToBuy < bestServerRam) {
        ns.tprint(prefix + 'the most RAM we can buy (' + formatRam(ns, maxRamPossibleToBuy) +
            ') is less than our previously purchased server ' + bestServerName + " RAM " + formatRam(ns, bestServerRam))
        return true
    }

    // if we're at capacity, check to see if we can do better than the current worst purchased server. If so, delete it to make room.
    if (purchasedServers.length >= ServerSettings.maxPurchasedServers) {
        if (worstServerRam === maxPurchasableServerRam) {
            ns.tprint('All purchasable servers are maxed.')
            return false
        }

        // It's only worth deleting our old server if the new server will be 16x bigger or more (or if it's the biggest we can buy)
        if (exponentLevel === ServerSettings.maxRamExponent || worstServerRam * 16 <= maxRamPossibleToBuy) {
            await killAllRemote(ns, worstServerName)
            if (await deleteServerRemote(ns, worstServerName)) {
                ns.tprint(`deleted server ${worstServerName} (${formatRam(ns, worstServerRam)} RAM) ` +
                    `to make room for a new ${formatRam(ns, maxRamPossibleToBuy)} Server.`)
            } else {
                ns.tprint(`WARNING: failed to delete server ${worstServerName} (${formatRam(ns, worstServerRam)} RAM), perhaps it is running scripts?`)
            }
            return true
        } else {
            ns.tprint(`${prefix}the most RAM we can buy (${formatRam(ns, maxRamPossibleToBuy)}) is less than 16x the RAM ` +
                `of the server it must delete to make room: ${worstServerName} (${formatRam(ns, worstServerRam)} RAM)`)
            return true
        }
    }

    const purchasedServer = await purchaseServerRemote(ns, ServerSettings.purchasedServerName, maxRamPossibleToBuy)
    if (purchasedServer) {
        ns.tprint('Purchased a new server ' + purchasedServer + ' with ' + formatRam(ns, maxRamPossibleToBuy) + ' RAM for ' + formatMoney(ns, cost))
    } else {
        ns.tprint(prefix + `Could not purchase a server with ${formatRam(ns, maxRamPossibleToBuy)} RAM for ${formatMoney(ns, cost)} ` +
            `with a budget of ${formatMoney(ns, budget)}. This is either a bug, or we in a SF.9`)
    }
    return true

}

/**
 * @param {NS} ns
 * @param {string} targetHostname
 * @param {number} hackFraction between 0 and 1
 * @param {boolean} forceMoneyHack
 */
async function runAttack(ns, targetHostname, hackFraction, forceMoneyHack) {
    hackFraction = hackFraction || TargetSettings.hackFraction

    const player = await getPlayerRemote(ns)
    const servers = await getServersRemote(ns)
    const hackingServers = filterHackingServers(servers)

    // force money hack if we have a small network
    const freeThreads = getFreeThreads(hackingServers, 1.75)
    if (freeThreads < 1000 || player.money < 50000000) { // TODO make these variables
        forceMoneyHack = true
    }

    // copy hack scripts to hackingServers (using n00dles)
    for (const hostname of hackingServers.map(s => s.hostname)) {
        await infectRemote(ns, hostname);
    }

    // choose target
    let targetServer = await chooseTarget(ns, servers, targetHostname, hackFraction, forceMoneyHack)

    // if we can't find a forced hack then do a normal hack (prep)
    if (!targetServer && forceMoneyHack) {
        forceMoneyHack = false
        targetServer = await chooseTarget(ns, servers, targetHostname, hackFraction, forceMoneyHack)
    }

    // attack!
    await attackServer(ns, hackingServers, targetServer, hackFraction, forceMoneyHack)
}

/**
 * Choose the best target server to attack.
 *
 * @param {NS} ns
 * @param {Server[]} servers
 * @param {string} targetHostname
 * @param {number} hackFraction between 0 and 1
 * @param {boolean} forceMoneyHack
 * @return {Promise<Server>}
 */
async function chooseTarget(ns, servers, targetHostname, hackFraction, forceMoneyHack) {
    if (targetHostname) {
        return await getServerRemote(ns, targetHostname)
    }
    const targetServers = filterTargetServers(servers)
        .sort((a, b) => {
            a.attackDetails = getAttackDetails(a, hackFraction, ns.hackAnalyze, ns.growthAnalyze, ns.getHackTime, ns.getGrowTime, ns.getWeakenTime)
            b.attackDetails = getAttackDetails(b, hackFraction, ns.hackAnalyze, ns.growthAnalyze, ns.getHackTime, ns.getGrowTime, ns.getWeakenTime)
            a.sort = a.attackDetails.moneyPerHack / a.attackDetails.hackThreadsCount / a.attackDetails.minsPerHack
            b.sort = b.attackDetails.moneyPerHack / b.attackDetails.hackThreadsCount / b.attackDetails.minsPerHack
            return b.sort - a.sort
        })

    if (forceMoneyHack) {
        targetServers.shift()
        return targetServers
            .filter(s => {
                return s.moneyAvailable / s.moneyMax > 0.01
            })
            .find(s => s.hostname)
    }

    return targetServers.find(s => s.hostname)
}

/**
 * @param {NS} ns
 * @param {Server[]} hackingServers
 * @param {Server} targetServer
 * @param {number} hackFraction between 0 and 1
 * @param {boolean} forceMoneyHack
 */
async function attackServer(ns, hackingServers, targetServer, hackFraction, forceMoneyHack) {
    if (forceMoneyHack) {
        hackFraction = 1
    }
    const attackDetails = getAttackDetails(targetServer, hackFraction, ns.hackAnalyze, ns.growthAnalyze, ns.getHackTime, ns.getGrowTime, ns.getWeakenTime)
    if (forceMoneyHack) {
        attackDetails.type = 'hack'
        attackDetails.hackThreads.h *= 5
        attackDetails.hackThreads.w = 0
        attackDetails.hackThreads.g = 0
        attackDetails.hackThreads.gw = 0
    }

    const ramPerThread = 1.75
    const homeServer = hackingServers.find(s => s.hostname === 'home')
    const attackServers = Math.floor(homeServer.maxRam / ramPerThread) >= 1000 // TODO make a variable
        ? [homeServer]
        : hackingServers

    const totalFreeThreads = getFreeThreads(attackServers, ramPerThread)
    const commands = buildAttack(attackServers, totalFreeThreads, attackDetails, targetServer, forceMoneyHack, ns.hackAnalyze, ns.growthAnalyze, ns.getHackTime, ns.getGrowTime, ns.getWeakenTime)
    await launchAttack(commands, ns.exec, ns.sleep)

    if (!commands.length) {
        ns.tprint('no attack launched... no free ram?')
        await ns.sleep(60 * 1000)
        return
    }

    const lastCommand = commands
        .sort((a, b) => (b.delay + b.time) - (a.delay + a.time))
        .find(c => c)

    const start = new Date()
    const end = new Date(start.getTime() + lastCommand.delay + lastCommand.time + 2000)

    ns.tprint('\n' + [
        '====================================================================================================',
        `|| ⚡ Attack ${targetServer.hostname} ${formatPercent(ns, hackFraction)} from ${start.toLocaleString()} to ${end.toLocaleString()}`.padEnd(96, ' ') + ' ||',
        '====================================================================================================',
        '',
        listView(commands
            .sort((a, b) => (a.delay + a.time) - (b.delay + b.time))
            .map(c => {
                c.times = formatDelays(c.delay, c.time)
                c.script = c.script.substring(7)
                delete c.delay
                delete c.time
                delete c.start
                delete c.pid
                delete c.uuid
                return c
            }))
    ].join('\n') + '\n')

    ns.tprint(`sleeping until ${end.toLocaleString()}`)
    do {
        await ns.sleep(1000)
    }
    while (end >= new Date());
    ns.tprint(`INFO: Attack Completed! at ${new Date().toLocaleString()}`)
}