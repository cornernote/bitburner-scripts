import {
    assignAttack, ATTACK,
    getBestHackAttack,
    getBestHackAttacks,
    getBestPrepAttack,
    getBestPrepAttacks,
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
    getFreeRam,
    getTotalRam,
    getCracks
} from './lib/Server'
import {
    formatDelay,
    formatTime,
    listView,
    updateHUD
} from "./lib/Helpers";


let lastHudUpdate = 0


/**
 * Command options
 */
const argsSchema = [
    ['once', false],
    ['help', false],
    ['show-targets', false],
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

    // show targets
    if (args['show-targets']) {
        ns.tprint(showTargets(ns))
        ns.exit()
    }

    // load data from disk
    // const statsContents = ns.read('/data/stats.json.txt')
    // let stats = statsContents
    //     ? JSON.parse(statsContents)
    //     : {}
    const stats = {}
    // const attacksContents = ns.read('/data/attacks.json.txt')
    // let currentAttacks = attacksContents
    //     ? JSON.parse(attacksContents)
    //     : []
    let currentAttacks = []

    let lastRun = {
        manageAttacks: 0,
    }

    // work, sleep, repeat
    do {

        // read stats
        //stats = await readStats(ns, stats)

        // manage attacks
        if (lastRun.manageAttacks + 1000 < new Date().getTime()) {
            lastRun.manageAttacks = new Date().getTime()
            currentAttacks = await manageAttacks(ns, currentAttacks, stats)
        }

        await ns.sleep(20)
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
 * @param {Array} currentAttacks
 * @return {Promise<[]>}
 */
export async function manageAttacks(ns, currentAttacks, stats) {
    // how many attacks to allow
    let maxAttacks = 3
    // decide if we should write to disk
    let changed = false
    // split attacks into hack/prep
    // remove completed attacks from the list
    const now = new Date().getTime()
    currentAttacks = currentAttacks
        .filter(ca => ca.attack.end > now) // || ca.nextCycle)

    const currentHackAttacks = currentAttacks
        .filter(ca => ca.type === 'hack')
    const currentPrepAttacks = currentAttacks
        .filter(ca => ca.type === 'prep')

    // load some data
    const player = ns.getPlayer()
    const servers = getServers(ns)
    const cores = 1 // assume we won't run on home, or home has 1 core
    const hackingServers = getHackingServers(ns, servers) //.filter(s => s.hostname !== 'home') // exclude if it has a different number of cores
    const hackTargetServers = getHackTargetServers(ns, servers)
        .filter(s => currentHackAttacks.filter(ca => ca.attack.target === s.hostname).length === 0) // exclude currentHackAttacks
    const prepTargetServers = getPrepTargetServers(ns, servers)
        .filter(s => currentHackAttacks.filter(ca => ca.attack.target === s.hostname).length === 0) // exclude currentHackAttacks
        .filter(s => currentPrepAttacks.filter(ca => ca.attack.target === s.hostname).length === 0) // exclude currentPrepAttacks

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

    // continue existing attacks - not worth it as there gets to be overlap
    // for (const currentHackTarget of Object.values(currentHackAttacks)) {
    //     if (currentHackTarget.nextCycle && currentHackTarget.nextCycle < new Date().getTime()) {
    //         const hackAttack = currentHackTarget.attack
    //         // only proceed if there have been no failures
    //         if (stats[hackAttack.target] && stats[hackAttack.target].failures > 60) {
    //             ns.print(`INFO: ${hackAttack.target} has had ${stats[hackAttack.target].failures} consecutive failures, cancelling`)
    //             currentHackTarget.nextCycle = false
    //             changed = true
    //             continue;
    //         }
    //         // check if we have enough threads to run it
    //         const freeThreads = getFreeThreads(ns, hackingServers, 1.75)
    //         if (hackAttack.info.cycleThreads * 10 > getFreeThreads(ns, hackingServers, 1.75)) {
    //             ns.print(`${hackAttack.info.cycleThreads * 10} threads needed, ${freeThreads} were available... delaying`)
    //             currentHackTarget.nextCycle += 1000
    //             changed = true
    //             continue
    //         }
    //         // continue the attack
    //         const commands = assignAttack(ns, hackAttack, hackingServers, 'cycle-' + currentHackTarget.cycle, 10)
    //         if (commands) {
    //             await launchAttack(ns, hackAttack, commands, 10)
    //             currentHackTarget.cycle++
    //             currentHackTarget.nextCycle += 10000
    //             ns.print([
    //                 `${formatTime()}: continue ${hackAttack.target}: ${formatDelay(hackAttack.time)}`,
    //                 `${ns.nFormat(hackAttack.info.cycleValue, '$0.0a')}`,
    //                 `take=${ns.nFormat(hackAttack.info.hackedPercent, '0.00%')}`,
    //                 `threads=${[hackAttack.parts.h.threads, hackAttack.parts.hw.threads, hackAttack.parts.g.threads, hackAttack.parts.gw.threads].join('|')} (${ns.nFormat(hackAttack.info.cycleThreads, '0a')} total)`,
    //             ].join(' | '))
    //             changed = true
    //         } else {
    //             ns.print(`cannot start attack, cancelling`)
    //             currentHackTarget.nextCycle = false
    //             changed = true
    //         }
    //     }
    // }

    // launch new hack attack
    const hackAttack = getBestHackAttack(ns, player, hackTargetServers, hackingServers, cores)
    // ns.tprint('find hack attack...')
    if (hackAttack) {
        // ns.tprint('found attack, can it fit')
        if (currentHackAttacks.length < maxAttacks) {
            // ns.tprint('it fits, can we get commands')
            const commands = assignAttack(ns, hackAttack, hackingServers, 'hack', hackAttack.cycles)
            if (commands.length) {
                // ns.tprint(commands)
                await launchAttack(ns, hackAttack, commands, hackAttack.cycles)
                currentAttacks.push({
                    type: 'hack',
                    attack: hackAttack,
                    cycle: 1,
                    //nextCycle: hackAttack.end + 1000,
                })
                //await ns.writePort(1, JSON.stringify({target: hackAttack.target, action: 'start'}))
                changed = true
                ns.print([
                    `${formatTime()}: hack ${hackAttack.target}: ${formatDelay(hackAttack.time)}`,
                    `${ns.nFormat(hackAttack.info.cycleValue, '$0.0a')}/cycle ${ns.nFormat(hackAttack.info.cycleValue * hackAttack.cycles, '$0.0a')}/batch`,
                    `on=${ns.nFormat(hackAttack.info.activePercent, '0.0%')} take=${ns.nFormat(hackAttack.info.hackedPercent, '0.00%')} grow=${ns.nFormat(hackAttack.info.growthRequired, '0.00%')}`,
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

    // launch new prep attacks if there is a full active attack
    if (currentHackAttacks.filter(ca => ca.attack.info.activePercent === 1).length) {
        // ns.tprint('find prep attack...')
        const prepAttack = getBestPrepAttack(ns, player, prepTargetServers, hackingServers, cores)
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
                    currentAttacks.push({
                        type: 'prep',
                        attack: prepAttack,
                        cycle: 0,
                        //nextCycle: false,
                    })
                    await ns.writePort(1, JSON.stringify({target: prepAttack.target, action: 'start'}))
                    const threadsRunMessage = commands.map(c => c.threads).reduce((prev, next) => prev + next) < prepAttack.cycleThreads ? ` (${Object.values(prepAttack.parts).map(p => p.threads).join('|')} ran)` : ''
                    changed = true
                    ns.print([ // note this may not be the amount of threads fitted, coule be less if allowRamOverflow=true
                        `${formatTime()}: prep ${prepAttack.target}: ${formatDelay(prepAttack.time)}`,
                        `threads=${ns.nFormat(prepAttack.cycleThreads, '0a')} ${threadMessage}${threadsRunMessage}`
                    ].join(' | '))
                }
            }
        }
    }

    // if there is unused ram, share ram with factions
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
                ns.exec('/hacks/share.js', server.hostname, threadsToRun, 10)
                remainingThreads -= threadsToRun
                server.ramUsed += threadsToRun * shareRam
            }
        }
        ns.print([
            `${formatTime()}: shared ${ns.nFormat(requiredThreads, '0.0a')} threads for faction use`,
        ].join(' | '))
    }

    // update HUD - todo move this
    if (lastHudUpdate + 1000 < now) {
        lastHudUpdate = now
        const ownedServers = hackingServers.filter(s => s.hostname.includes(SERVER.purchasedServerName))
        const rootedServers = hackingServers.filter(s => !s.hostname.includes(SERVER.purchasedServerName))
        let currentHackAttacks = currentAttacks
            .filter(ca => ca.type === 'hack')
        let currentPrepAttacks = currentAttacks
            .filter(ca => ca.type === 'prep')

        const hud = {
            'Script Inc:': `${ns.nFormat(ns.getScriptIncome()[0], '$0.0a')}/sec`,
            'Script Exp:': `${ns.nFormat(ns.getScriptExpGain(), '0.0a')}/sec`,
            'Share Pwr:': `${ns.nFormat(ns.getSharePower(), '0.0a')}`,
            'Servers:': `owned=${ownedServers.length}|pwnt=${rootedServers.length}`,
            'RAM:': `${ns.nFormat(getFreeRam(ns, hackingServers) * 1000000000, '0.0b')}/${ns.nFormat(getTotalRam(ns, hackingServers) * 1000000000, '0.0b')}`,
            'Threads:': `${ns.nFormat(getFreeThreads(ns, hackingServers, 1.75), '0.0a')}/${ns.nFormat(getTotalThreads(ns, hackingServers, 1.75), '0.0a')}`,
            'Targets:': `hack=${hackTargetServers.length}|prep=${prepTargetServers.length}`,
            'Attacks:': `hack=${currentHackAttacks.length}|prep=${currentPrepAttacks.length}`,
        }
        for (const currentHackAttack of currentHackAttacks.sort((a, b) => b.attack.info.cycleValue - a.attack.info.cycleValue)) {
            const started = currentHackAttack.attack.start + currentHackAttack.attack.time > now
            hud[`- ${currentHackAttack.attack.target}`] = (started ? '*' : '') + ns.nFormat(currentHackAttack.attack.info.cycleValue, '$0.0a')
            // + ' ' + currentHackAttack.attack.cycles
            // + ' ' + (currentHackAttack.attack.start + currentHackAttack.attack.time > now
            //     ? 'a' + formatDelay((currentHackAttack.attack.start + currentHackAttack.attack.time - now) * -1)
            //     : 'b' + formatDelay(currentHackAttack.attack.end - now))
        }
        // for (const currentPrepAttack of currentPrepAttacks.sort((a, b) => b.attack.end - a.attack.end)) {
        //     hud[`P ${currentPrepAttack.attack.target}`] = ns.nFormat(currentPrepAttack.attack.value, '$0.0a')
        //         + ' ' + formatDelay(currentPrepAttack.attack.end - now)
        // }
        updateHUD(hud, true)
    }

    // return attacks
    if (changed) {
        ns.print('----------------------------------------')
        //await ns.write('/data/attacks.json.txt', JSON.stringify(currentAttacks))
    }
    return currentAttacks
}


/**
 * Show the targets
 *
 * @param {NS} ns
 * @returns {string}
 */
function showTargets(ns) {
    const player = ns.getPlayer()
    const servers = getServers(ns)
    const cores = 1 // assume we won't run on home, or home has 1 core
    const hackingServers = getHackingServers(ns, servers)
    const hackTargetServers = getHackTargetServers(ns, servers)
    const hackAttacks = getBestHackAttacks(ns, player, hackTargetServers, hackingServers, cores)
    const prepTargetServers = getPrepTargetServers(ns, servers)
    const prepAttacks = getBestPrepAttacks(ns, player, prepTargetServers, hackingServers, cores)
    // const prepAttack = getBestPrepAttack(ns, player, prepTargetServers, hackingServers, cores)
    // const bestPrepAttack = prepAttack ? formatAttack(ns, prepAttack, 'prep') : ''

    return [
        ``,
        `SERVERS`,
        `${servers.map(s => s.hostname).join(', ')}`,
        ``,
        `HACKS`,
        `${hackTargetServers.map(s => s.hostname).join(', ')}`,
        `${hackAttacks.map(a => [
            `${formatTime()}: hack ${a.target}: ${formatDelay(a.time)}`,
            `${ns.nFormat(a.info.cycleValue, '$0.0a')}/cycle ${ns.nFormat(a.info.cycleValue * a.cycles, '$0.0a')}/batch`,
            `on=${ns.nFormat(a.info.activePercent, '0.0%')} take=${ns.nFormat(a.info.hackedPercent, '0.00%')} grow=${ns.nFormat(a.info.growthRequired, '0.00%')}`,
            `threads=${a.cycles}x ${ns.nFormat(a.cycleThreads, '0a')} ${Object.values(a.parts).map(p => p.threads).join('|')} (${ns.nFormat(a.cycleThreads * a.cycles, '0a')} total)`,
        ].join(' | ')).join('\n')}`,
        ``,
        `PREPS`,
        `${prepTargetServers.map(s => s.hostname).join(', ')}`,
        `${prepAttacks.map(a => [
            `${formatTime()}: prep ${a.target}: ${formatDelay(a.time)}`,
            `threads=${ns.nFormat(a.cycleThreads, '0a')} ${Object.values(a.parts).map(p => p.threads).join('|')}`
        ].join(' | ')).join('\n')}`,
        // `BEST PREP`,
        // `${bestPrepAttack}`,
    ].join('\n')
}

/**
 * Reads port data for stats.
 *
 * @param {NS} ns
 * @param {Object} stats
 * @returns {Promise<{Object}>}
 */
async function readStats(ns, stats) {
    let changed = false
    while (ns.peek(1) !== 'NULL PORT DATA') {
        const data = JSON.parse(ns.readPort(1))
        changed = true
        switch (data.action) {

            case 'hack':
                if (!stats[data.target]) {
                    stats[data.target] = {
                        target: data.target,
                        total: 0,
                        attempts: 0,
                        average: 0,
                        success: 0,
                        failures: 0,
                    }
                }
                if (data.amount > 0) {
                    stats[data.target].total += data.amount
                    stats[data.target].success++
                    stats[data.target].failures = 0
                } else {
                    stats[data.target].failures++
                }
                stats[data.target].attempts++
                stats[data.target].average = stats[data.target].total / stats[data.target].attempts
                break;

            case 'start':
            case 'restart':
                stats[data.target] = {
                    target: data.target,
                    total: 0,
                    attempts: 0,
                    average: 0,
                    success: 0,
                    failures: 0,
                }
                break;
        }
    }
    if (changed) {
        await ns.write('/data/stats.json.txt', JSON.stringify(stats), 'w')
    }
    return stats
}
