import {
    ATTACK,
    assignAttack,
    getBestHackAttack,
    getBestPrepAttack,
    launchAttack
} from './lib/Attack'
import {
    SERVER,
    getServers,
    getHackTargetServers,
    getHackingServers,
    getPrepTargetServers,
    getFreeThreads,
    getTotalThreads,
    getCracks
} from './lib/Server'
import {
    buyTor,
    formatDelay,
    formatTime,
    terminalCommand
} from "./lib/Helpers";


/**
 * Command options
 */
const argsSchema = [
    ['once', false],
    ['help', false],
]

/**
 * Command auto-complete
 */
export function autocomplete(data, _) {
    data.flags(argsSchema)
    return []
}

// fake method to count towards memory usage to prevent error
function countedTowardsMemory(ns) {
    ns.brutessh()
    ns.ftpcrack()
    ns.relaysmtp()
    ns.httpworm()
    ns.sqlinject()
}

/**
 * Entry point
 *
 * @param {NS} ns
 */
export async function main(ns) {
    // get some stuff ready
    const args = ns.flags(argsSchema)
    ns.disableLog('ALL')

    // show help
    if (args.help) {
        ns.tprint(getHelp(ns))
        ns.exit()
    }

    // startup
    ns.print('----------' + formatTime() + '----------')

    // load some helper scripts
    const host = 'home'
    const helpers = ['host.js', 'hacknet.js', 'hud.js'] // why does everything start with H ?
    for (const helper of helpers) {
        if (!ns.ps(host).filter(p => p.filename === helper).length) {
            ns.print(`launching ${helper}`)
            ns.exec(helper, host)
        }
    }
    ns.print('----------' + formatTime() + '----------')

    // load data from disk
    // const attacksContents = ns.read('/data/attacks.json.txt')
    // let currentAttacks = attacksContents
    //     ? JSON.parse(attacksContents)
    //     : []
    let currentAttacks = []

    // work, sleep, repeat
    do {
        const player = ns.getPlayer()
        const servers = getServers(ns)

        // cracks
        await buyCracks(ns, player)
        await runCracks(ns, servers)

        // attacks
        currentAttacks = await manageAttacks(ns, player, servers, currentAttacks)

        await ns.sleep(1000)
    } while (!args.once)
}

/**
 * Help text
 *
 * Player boss is stuck, let's get them some help.
 *
 * @returns {string}
 */
function getHelp(ns) {
    const script = ns.getScriptName()
    return [
        'Prepares and launches hack attacks on targets.',
        '',
        `USAGE: run ${script}`,
        '',
        'Example:',
        `> run ${script}`,
    ].join("\n")
}

/**
 * Manage the attacks.
 *
 * @param {NS} ns
 * @param {Player} player
 * @param {Server[]} servers
 * @param {Array} currentAttacks
 * @return {Promise<[]>}
 */
export async function manageAttacks(ns, player, servers, currentAttacks) {
    // how many attacks to allow
    let maxAttacks = 3
    let attackSpacer = 150

    // decide if we should write
    let changed = false

    // split attacks into hack/prep
    // remove completed attacks from the list
    const now = new Date().getTime()
    currentAttacks = currentAttacks
        .filter(a => a.end + 1000 > now)
    const currentHackAttacks = currentAttacks
        .filter(a => a.type === 'hack')
    const currentPrepAttacks = currentAttacks
        .filter(a => a.type === 'prep')

    // load some data
    const cores = 1 // assume we won't run on home, or home has 1 core
    const hackingServers = getHackingServers(ns, servers) //.filter(s => s.hostname !== 'home') // exclude if it has a different number of cores
    const hackTargetServers = getHackTargetServers(ns, servers)
        .filter(s => currentAttacks.filter(a => a.target === s.hostname).length === 0) // exclude currentAttacks
    const prepTargetServers = getPrepTargetServers(ns, servers)
        .filter(s => currentAttacks.filter(a => a.target === s.hostname).length === 0) // exclude currentAttacks

    // launch new hack attacks if there is a full active attack, or if there are no current hack attacks
    if (currentAttacks.filter(a => a.type === 'hack' && a.activePercent === 1).length || !currentAttacks.filter(a => a.type === 'hack').length) {
        const hackAttack = getBestHackAttack(ns, player, hackTargetServers, hackingServers, cores, attackSpacer)
        // ns.tprint('find hack attack...')
        if (hackAttack) {
            // ns.tprint('found attack, can it fit')
            if (currentHackAttacks.length < maxAttacks) {
                // ns.tprint('it fits, can we get commands')
                const commands = assignAttack(ns, hackAttack, hackingServers, 'hack', hackAttack.cycles)
                if (commands.length) {
                    // ns.tprint(commands)
                    await launchAttack(ns, hackAttack, commands, hackAttack.cycles)
                    await ns.writePort(1, JSON.stringify({
                        type: 'add-hack',
                        attack: hackAttack,
                    }))
                    currentAttacks.push(hackAttack)
                    changed = true
                    ns.print([
                        `hack ${hackAttack.target}: ${formatDelay(hackAttack.time)}`,
                        `${ns.nFormat(hackAttack.info.cycleValue, '$0.0a')}/cycle ${ns.nFormat(hackAttack.info.cycleValue * hackAttack.cycles, '$0.0a')}/batch`,
                        `on=${ns.nFormat(hackAttack.activePercent, '0.0%')} take=${ns.nFormat(hackAttack.info.hackedPercent, '0.00%')} grow=${ns.nFormat(hackAttack.info.growthRequired, '0.00%')}`,
                        `threads=${hackAttack.cycles}x ${ns.nFormat(hackAttack.cycleThreads, '0a')} ${Object.values(hackAttack.parts).map(p => p.threads).join('|')} (${ns.nFormat(hackAttack.cycleThreads * hackAttack.cycles, '0a')} total)`,
                    ].join(' | '))
                    // ns.print(listView(commands.map(c => {
                    //     return {
                    //         script: c.script,
                    //         hostname: c.hostname,
                    //         threads: c.threads,
                    //         target: c.target,
                    //         end: c.start + c.delay + c.time,
                    //     }
                    // })))
                }
            }
        }
    }

    // launch new prep attacks if there is a full active attack, or if there are no current attacks, or if we launched an attack and we have spare ram
    if (currentAttacks.filter(a => a.type === 'hack' && a.activePercent === 1).length || !currentAttacks.length || changed) {
        // ns.tprint('find prep attack...')
        const prepAttack = getBestPrepAttack(ns, player, prepTargetServers, hackingServers, cores, 1000)
        // if the current prep can be done in available threads, or no prep attacks
        if (prepAttack) {
            // ns.tprint('found attack, can it fit')
            const freeThreads = getFreeThreads(ns, hackingServers, 1.75)
            const allowRamOverflow = currentPrepAttacks.length === 0
            if (prepAttack.cycleThreads < freeThreads || allowRamOverflow) {
                // ns.tprint('it fits, can we get commands')
                // ns.tprint(currentPrepAttacks.length === 0)
                // fit grow and weaken threads based on threads available
                const threadMessage = Object.values(prepAttack.parts).map(p => p.threads).join('|')
                if (allowRamOverflow && prepAttack.parts.g.threads) {
                    prepAttack.parts.g.threads = freeThreads
                    prepAttack.parts.gw.threads = Math.ceil((prepAttack.parts.g.threads * ATTACK.scripts.g.change) / ATTACK.scripts.w.change)
                    prepAttack.parts.g.threads -= prepAttack.parts.gw.threads
                }
                const commands = assignAttack(ns, prepAttack, hackingServers, 'prep', 1, allowRamOverflow)
                if (commands.length) {
                    // ns.tprint(commands)
                    await launchAttack(ns, prepAttack, commands)
                    await ns.writePort(1, JSON.stringify({
                        type: 'add-prep',
                        attack: prepAttack,
                    }))
                    currentAttacks.push(prepAttack)
                    await ns.writePort(1, JSON.stringify({target: prepAttack.target, action: 'start'}))
                    const threadsRunMessage = commands.map(c => c.threads).reduce((prev, next) => prev + next) < prepAttack.cycleThreads ? ` (${Object.values(prepAttack.parts).map(p => p.threads).join('|')} ran)` : ''
                    changed = true
                    ns.print([ // note this may not be the amount of threads fitted, coule be less if allowRamOverflow=true
                        `prep ${prepAttack.target}: ${formatDelay(prepAttack.time)}`,
                        `threads=${ns.nFormat(prepAttack.cycleThreads, '0a')} ${threadMessage}${threadsRunMessage}`
                    ].join(' | '))
                }
            }
        }
    }

    // if we launched an attack and if there is unused ram, share ram with factions
    if (changed) {
        const shareRam = 4
        const shareMax = prepTargetServers.length ? 0 : 0.9 // share upto 90% if we have no prep targets
        const totalThreads = getTotalThreads(ns, hackingServers, shareRam)
        const freeThreads = getFreeThreads(ns, hackingServers, shareRam)
        if (freeThreads > totalThreads * (1 - shareMax)) {
            const usedThreads = totalThreads - freeThreads
            const requiredThreads = Math.floor(totalThreads * shareMax - usedThreads)
            let remainingThreads = requiredThreads
            for (const server of hackingServers) {
                const threadsFittable = Math.max(0, Math.floor((server.maxRam - server.ramUsed) / shareRam))
                const threadsToRun = Math.max(0, Math.min(threadsFittable, remainingThreads))
                if (threadsToRun) {
                    //args[0: loop]
                    try {
                        ns.exec('/hacks/share.js', server.hostname, threadsToRun, 10)
                        remainingThreads -= threadsToRun
                        server.ramUsed += threadsToRun * shareRam
                    } catch (e) {
                    }
                }
            }
            ns.print([
                `INFO: shared ${ns.nFormat(requiredThreads, '0.0a')} threads for faction use`,
            ].join(' | '))
        }
    }

    // return attacks
    if (changed) {
        ns.print('----------' + formatTime() + '----------')
        //await ns.write('/data/attacks.json.txt', JSON.stringify(currentAttacks))
    }
    return currentAttacks
}

/**
 * Buys Cracks from the Darkweb using player interaction
 *
 * @param {NS} ns
 * @param {Player} player
 * @returns {Promise<void>}
 */
export async function buyCracks(ns, player) {
    // buy the tor router
    if (!player.tor && player.money > 200000) {
        ns.tprint('INFO: Buying Tor Router')
        await buyTor(ns)
    }
    // buy unowned cracks
    if (player.tor) {
        const unownedCracks = getCracks(ns).filter(c => c.cost <= player.money && !c.owned)
        if (unownedCracks.length) {
            ns.tprint(`Buying: ${unownedCracks.map(c => c.file).join(', ')}.`)
            terminalCommand([
                'connect darkweb',
                unownedCracks.map(c => `buy ${c.file}`).join(';'),
                'home',
            ].join(';'))
        }
    }
}

/**
 * Runs port hacks on rootable servers
 *
 * @param {NS} ns
 * @param {Server[]} servers
 * @returns {Promise<void>}
 */
export async function runCracks(ns, servers) {
    // run owned port hacks on rootable servers
    const ownedCracks = getCracks(ns).filter(c => c.owned)
    const rootableServers = servers.filter(s => !s.hasAdminRights
        && s.requiredHackingSkill <= ns.getPlayer().hacking
        && s.numOpenPortsRequired <= ownedCracks.length)
    for (const server of rootableServers) {
        // run port cracks
        for (const crack of ownedCracks) {
            ns[crack.method](server.hostname)
        }
        // run nuke
        ns.nuke(server.hostname)
        // copy hack scripts
        await ns.scp(SERVER.hackScripts, server.hostname)
        // tell someone about it
        ns.print(`INFO: ${server.hostname} has been nuked!`)
    }
}