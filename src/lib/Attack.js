/**
 * Attack helper functions
 */


/**
 * Attack Constants
 *
 * @type {{scripts: {g: {change: number, script: string, ram: number}, w: {change: number, script: string, ram: number}, h: {change: number, script: string, ram: number}}, hackPercents: number[]}}
 */
export const ATTACK = {
    // scripts used for hacking
    scripts: {
        h: {
            script: '/hacks/hack.js',
            change: 0.002,
            ram: 1.7,
        },
        g: {
            script: '/hacks/grow.js',
            change: 0.004,
            ram: 1.75,
        },
        w: {
            script: '/hacks/weaken.js',
            change: 0.05,
            ram: 1.75,
        },
        c: {
            script: '/hacks/check.js',
            change: 0,
            ram: 2,
        },
    },
    // percents used when testing attack values
    hackPercents: [
        // 0.95,
        0.8,
        0.4,
        0.2,
        0.1,
        0.05,
        0.025,
        0.0125,
        0.00625,
        // 0.003125,
        // 0.0015625,
    ],
}

/**
 * Attack
 *
 * @param attack
 */
export function Attack(attack) {
    this.uuid = attack.uuid ? attack.uuid : generateUUID()
    this.target = attack.target
    this.hackValue = attack.hackValue
    this.prepValue = attack.prepValue
    this.cycles = attack.cycles
    this.time = attack.time
    this.parts = new AttackParts(attack.parts)
    this.info = new AttackInfo(attack.info)
    this.start = null
    this.end = null
}

/**
 * AttackParts
 *
 * @param attackParts
 */
export function AttackParts(attackParts) {
    // prep-weaken
    this.pw = new AttackPart(attackParts.pw)
    // pre-grow
    this.pg = new AttackPart(attackParts.pg)
    // prep-grow-weaken
    this.pgw = new AttackPart(attackParts.pgw)
    // hack
    this.h = new AttackPart(attackParts.h)
    // hack-weaken
    this.hw = new AttackPart(attackParts.hw)
    // grow
    this.g = new AttackPart(attackParts.g)
    // grow-weaken
    this.gw = new AttackPart(attackParts.gw)
    // check
    this.c = new AttackPart(attackParts.c)
}

/**
 * AttackPart
 *
 * @param attackPart
 */
export function AttackPart(attackPart) {
    this.threads = attackPart.threads
    this.time = attackPart.time
    this.delay = attackPart.delay
    this.ram = attackPart.ram
    this.script = attackPart.script
    this.allowSpreading = attackPart.allowSpreading
}

/**
 * AttackInfo
 *
 * @param attackInfo
 */
export function AttackInfo(attackInfo) {
    this.cores = attackInfo.cores
    this.hackPercent = attackInfo.hackPercent
    this.hackedPercent = attackInfo.hackedPercent
    this.growthRequired = attackInfo.growthRequired
    this.cycleValue = attackInfo.cycleValue
    this.prepThreads = attackInfo.prepThreads
    this.cycleThreads = attackInfo.cycleThreads
    this.attackThreads = attackInfo.attackThreads
    this.maxCycles = attackInfo.maxCycles
    this.activePercent = attackInfo.activePercent
    this.valuePerThread = attackInfo.valuePerThread
    this.averageValuePerThreadPerSecond = attackInfo.averageValuePerThreadPerSecond
}

/**
 * AttackCommand
 *
 * @param attackCommand
 */
export function AttackCommand(attackCommand) {
    this.script = attackCommand.script
    this.hostname = attackCommand.hostname
    this.threads = attackCommand.threads
    this.target = attackCommand.target
    this.delay = attackCommand.delay
    this.time = attackCommand.time
    this.uuid = attackCommand.uuid ? attackCommand.uuid : generateUUID()
    this.stock = attackCommand.stock
    this.tprint = attackCommand.tprint
    this.start = attackCommand.start
    this.pid = attackCommand.pid
}

/**
 * Gets the best hack attack.
 * based on value/sec, considering available ram
 *
 * @param {NS} ns
 * @param {Player} player
 * @param {[Server]} servers
 * @param {String} sortField
 * @param {[Server]} hackingServers
 * @param {Number} cores
 * @return {[Attack]}
 */
export function getBestAttacks(ns, player, servers, sortField, hackingServers, cores = 1) {
    let attacks = []
    for (const hackPercent of ATTACK.hackPercents) {
        for (const server of servers) {
            const attack = buildAttack(ns, player, server, hackPercent, hackingServers, cores)
            attacks.push(attack)
        }
    }
    if (sortField === 'fastest') {
        // sort asc
        attacks = attacks.filter(a => a.time).sort((a, b) => a.time - b.time)
    } else {
        // sort desc
        attacks = attacks.filter(a => a[sortField]).sort((a, b) => b[sortField] - a[sortField])
    }
    return attacks
}

/**
 * Gets the best hack attack.
 * based on value/sec, considering available ram
 *
 * @param {NS} ns
 * @param {Player} player
 * @param {[Server]} servers
 * @param {String} sortField
 * @param {[Server]} hackingServers
 * @param {Number} cores
 * @return {Attack|Boolean|*}
 */
export function getBestAttack(ns, player, servers, sortField, hackingServers, cores = 1) {
    const attacks = getBestAttacks(ns, player, servers, sortField, hackingServers, cores)
    if (!attacks.length) {
        return false
    }
    return attacks.shift()
}

/**
 * Builds an attack against a target.
 * based on the amount you want to hack and the available ram
 *
 * @param {NS} ns
 * @param {Player} player
 * @param {Server} server
 * @param {Number} hackPercent
 * @param {[Server]} hackingServers
 * @param {Number} cores
 * @return {Attack}
 */
export function buildAttack(ns, player, server, hackPercent, hackingServers, cores = 1) {

    // create the attack objects
    const attack = new Attack({
        target: server.hostname,
        value: null,
        cycles: null,
        time: null,
        parts: new AttackParts({
            pw: new AttackPart({
                script: ATTACK.scripts.w.script,
                ram: ATTACK.scripts.w.ram,
                threads: 0,
                time: 0,
                delay: 0,
                allowSpreading: true
            }),
            pg: new AttackPart({
                script: ATTACK.scripts.g.script,
                ram: ATTACK.scripts.g.ram,
                threads: 0,
                time: 0,
                delay: 0,
            }),
            pgw: new AttackPart({
                script: ATTACK.scripts.w.script,
                ram: ATTACK.scripts.w.ram,
                threads: 0,
                time: 0,
                delay: 0,
                allowSpreading: true
            }),
            h: new AttackPart({
                script: ATTACK.scripts.h.script,
                ram: ATTACK.scripts.h.ram,
                threads: 0,
                time: 0,
                delay: 0,
            }),
            hw: new AttackPart({
                script: ATTACK.scripts.w.script,
                ram: ATTACK.scripts.w.ram,
                threads: 0,
                time: 0,
                delay: 0,
                allowSpreading: true
            }),
            g: new AttackPart({
                script: ATTACK.scripts.g.script,
                ram: ATTACK.scripts.g.ram,
                threads: 0,
                time: 0,
                delay: 0,
            }),
            gw: new AttackPart({
                script: ATTACK.scripts.w.script,
                ram: ATTACK.scripts.w.ram,
                threads: 0,
                time: 0,
                delay: 0,
                allowSpreading: true
            }),
            c: new AttackPart({
                script: ATTACK.scripts.c.script,
                ram: ATTACK.scripts.c.ram,
                threads: 0,
                time: 0,
                delay: 0,
            }),
        }),
        info: new AttackInfo({
            hackPercent: hackPercent,
            cores: cores,
            hackedPercent: null,
            cycleValue: null,
            prepThreads: null,
            threadRam: null,
            cycleThreads: null,
            maxCycles: null,
            activePercent: null,
            valuePerThread: null,
            averageValuePerThreadPerSecond: null,
        }),
    })

    // some shortcuts
    const info = attack.info,
        parts = attack.parts,
        pw = parts.pw,   // prep-weaken
        pg = parts.pg,   // prep-grow
        pgw = parts.pgw, // prep-grow-weaken
        h = parts.h,     // hack
        hw = parts.hw,   // hack-weaken
        g = parts.g,     // grow
        gw = parts.gw,   // grow-weaken
        c = parts.c      // check

    // expected hack value for a full attack
    const hackFactor = 1.75
    const difficultyMult = (100 - server.minDifficulty) / 100 // assume server has min security
    const skillMult = hackFactor * player.hacking
    const skillChance = (skillMult - server.requiredHackingSkill) / skillMult
    const chance = Math.max(0, Math.min(1, skillChance * difficultyMult * player.hacking_chance_mult))
    info.cycleValue = server.moneyMax * chance * hackPercent // assume server has max money

    // get threads for prep-weaken
    if (server.hackDifficulty > server.minDifficulty + 1) {
        pw.threads = Math.ceil((server.hackDifficulty - server.minDifficulty) / ATTACK.scripts.w.change)
    }
    // get threads for prep-grow and prep-weaken
    if (server.moneyAvailable < server.moneyMax * 0.9) {
        const growthAmount = server.moneyAvailable ? server.moneyMax / server.moneyAvailable : 100
        pg.threads = Math.ceil(ns.growthAnalyze(server.hostname, growthAmount, cores))
        pgw.threads = Math.ceil((pg.threads * ATTACK.scripts.g.change) / ATTACK.scripts.w.change)
        // only fit this if we can
        if (pw.threads && !countCycles(ns, hackingServers, [pw, pg, pgw], 1)) {
            pg.threads = 0
            pgw.threads = 0
        }
    }
    // get the threads for a full hack (HWGW) - this doesn't matter what values the server has now
    const hackAnalyze = ns.hackAnalyze(server.hostname) // percent of money stolen with a single thread
    h.threads = Math.floor(hackPercent / hackAnalyze) // threads to hack the amount we want, floor so that we don't over-hack
    info.hackedPercent = h.threads * hackAnalyze // < ~0.8 - the percent we actually hacked
    const remainingPercent = 1 - info.hackedPercent // > ~0.2 - the percent remaining on the server
    const growthRequiredEstimated = 1 / (1 - hackPercent) // 5
    info.growthRequired = remainingPercent ? 1 / remainingPercent : growthRequiredEstimated // < ~5 - the number of times we have to grow that amount
    const growthAnalyze = ns.growthAnalyze(server.hostname, info.growthRequired, cores) // how many thread to grow the money by ~5x
    g.threads = Math.ceil(growthAnalyze) // threads to grow the amount we want, ceil so that we don't under-grow
    hw.threads = Math.ceil(h.threads * (ATTACK.scripts.h.change / ATTACK.scripts.w.change)) // weaken threads for hack, ceil so that we don't under-weaken
    gw.threads = Math.ceil(g.threads * (ATTACK.scripts.g.change / ATTACK.scripts.w.change)) // weaken threads for grow, ceil so that we don't under-weaken
    c.threads = 1

    // get the count of threads
    info.prepThreads = pw.threads + pg.threads + pgw.threads
    info.cycleThreads = h.threads + hw.threads + g.threads + gw.threads
    info.valuePerThread = info.cycleValue / info.cycleThreads
    // what percentage of the time can we fill with tasks before availableThreads fills
    attack.time = ns.getWeakenTime(server.hostname) + 800
    info.maxCycles = Math.floor(attack.time / 1000) // attacks at 1/sec
    attack.cycles = countCycles(ns, hackingServers, [h, hw, g, gw, c], info.maxCycles)
    info.activePercent = attack.cycles ? attack.cycles / info.maxCycles : 0// 0.2 = 20%
    info.attackThreads = info.cycleThreads * attack.cycles
    // hack value per thread used per second (excluding the wait for the first attack to land)
    info.averageValuePerThreadPerSecond = info.valuePerThread * info.activePercent
    // hack value
    attack.hackValue = info.cycleValue * attack.cycles * info.activePercent

    // return an Attack object
    return attack
}

/**
 * Assign the attack threads between our hacking servers
 *
 * @param {NS} ns
 * @param {[Server]} servers
 * @param {[AttackPart]} attackParts
 * @param {number} maxCycles
 * @returns {number}
 */
export function countCycles(ns, servers, attackParts, maxCycles) {
    const serverRam = {}
    // check the ram for as many cycles as needed
    for (let cycle = 1; cycle <= maxCycles; cycle++) {
        // assign each attack part to a server
        for (const part of attackParts) {
            // assign each thread to a server
            let threadsRemaining = part.threads
            for (let i = 0; i < servers.length; i++) {
                const server = servers[i]
                const threadsFittable = Math.max(0, Math.floor((server.maxRam - server.ramUsed) / part.ram))
                const threadsToRun = Math.max(0, Math.min(threadsFittable, threadsRemaining))
                // if there are not enough threads, and we cannot spread the threads
                if (threadsToRun < threadsRemaining && !part.allowSpreading) {
                    continue
                }
                // create assign the ram to this server
                if (threadsToRun) {
                    threadsRemaining -= threadsToRun
                    server.ramUsed += threadsToRun * part.ram
                    if (!serverRam[server.hostname]) {
                        serverRam[server.hostname] = 0
                    }
                    serverRam[server.hostname] += threadsToRun * part.ram
                }
            }
            // if threads are remaining then we exceeded the limit
            if (threadsRemaining) {
                maxCycles = cycle - 1
            }
        }
    }
    // give back the ram
    for (const server of servers) {
        if (serverRam[server.hostname]) {
            server.ramUsed -= serverRam[server.hostname]
        }
    }
    // return the count
    return maxCycles
}

/**
 * Assign the attack threads between our hacking servers
 *
 * @param {NS} ns
 * @param {Attack} attack
 * @param {[Server]} servers
 * @param {String} cycleType
 * @param {Number} cycles how many more cycles to assign commands for
 * @param {Boolean} allowRamOverflow
 * @returns {AttackCommand[]}
 */
export function assignAttack(ns, attack, servers, cycleType, cycles = 1, allowRamOverflow = false) {
    const commands = []
    for (let cycle = 1; cycle <= cycles; cycle++) {
        ns.tprint('fitting cycle ' + cycle)
        let cycleCommands = []
        const serverRam = {}

        // some shortcuts
        const parts = attack.parts,
            pw = parts.pw,   // prep-weaken
            pg = parts.pg,   // prep-grow
            pgw = parts.pgw, // prep-grow-weaken
            h = parts.h,     // hack
            hw = parts.hw,   // hack-weaken
            g = parts.g,     // grow
            gw = parts.gw,   // grow-weaken
            c = parts.c      // check

        // get the time needed for threads
        h.time = ns.getHackTime(attack.target)
        g.time = pg.time = ns.getGrowTime(attack.target)
        hw.time = gw.time = pw.time = pgw.time = ns.getWeakenTime(attack.target)

        // calculate the delays to land all attacks together
        // order -> PW PG PGW H HW G GW <- with 100ms between
        const delay = 100
        pw.delay = 0
        pg.delay = pgw.time - pg.time + delay
        pgw.delay = (delay * 2)
        h.delay = hw.time - h.time + (delay * 3)
        hw.delay = (delay * 4)
        g.delay = gw.time - g.time + (delay * 5)
        gw.delay = (delay * 6)
        c.delay = gw.time + (delay * 7)
        attack.time = gw.time + (delay * 8)

        const attackParts = cycleType === 'prep'
            ? [attack.parts.pw, attack.parts.pg, attack.parts.pgw]
            : [attack.parts.h, attack.parts.hw, attack.parts.g, attack.parts.gw, attack.parts.c]

        for (const part of attackParts) {
            let threadsRemaining = part.threads
            if (!threadsRemaining) {
                continue
            }
            ns.tprint('fitting part ' + part.script + ' x' + part.threads)
            for (let i = 0; i < servers.length; i++) {
                const server = servers[i]
                const threadsFittable = Math.max(0, Math.floor((server.maxRam - server.ramUsed) / part.ram))
                ns.tprint('fitting to server ' + server.hostname + ' which has ' + threadsFittable + ' threads available')
                const threadsToRun = Math.max(0, Math.min(threadsFittable, threadsRemaining))
                if (threadsToRun) {
                    // if there are not enough threads, and we cannot spread the threads, then continue to the next server
                    if (threadsToRun < threadsRemaining && !part.allowSpreading) {
                        continue
                    }
                    ns.tprint('fitted ' + threadsToRun + ' threads')

                    // create the commands and assign the threads to this server
                    cycleCommands.push(new AttackCommand({
                        script: part.script,
                        hostname: server.hostname,
                        threads: threadsToRun,
                        target: attack.target,
                        delay: (cycle * 1000) + part.delay,
                        time: part.time,
                        stock: false,
                        tprint: true,
                    }))
                    threadsRemaining -= threadsToRun
                    server.ramUsed += threadsToRun * part.ram
                    serverRam[server.hostname] += threadsToRun * part.ram // so we can give it back if it doesn't fit
                    if (!threadsRemaining) {
                        break
                    }
                }
            }
            // check for overflow
            if (!allowRamOverflow && threadsRemaining) {
                // un-assign commands
                cycleCommands = []
                // un-assign ram
                for (const server of servers) {
                    if (serverRam[server.hostname]) {
                        server.ramUsed -= serverRam[server.hostname]
                    }
                }
                ns.print(`WARNING: ram overflow with ${threadsRemaining} threads remaining!`)
                break
            }
        }
        // if we fit in ram, add to the list
        for (const command of cycleCommands) {
            commands.push(command)
        }
    }
    return commands
}

/**
 * Launch the attack
 *
 * @param {NS} ns
 * @param {Attack} attack
 * @param {AttackCommand[]} commands
 * @return {Promise<{any}>}
 */
export async function launchAttack(ns, attack, commands) {
    // run each command in the list
    for (const command of commands) {
        // ns.args = [
        //   0: script,
        //   1: host,
        //   2: threads
        //   3: target,
        //   4: delay,
        //   5: uuid,
        //   6: stock,
        //   7: tprint,
        //   8: host,
        //   9: threads,
        //   10: start,
        //   11: time,
        // ]
        command.start = new Date().getTime()
        command.pid = ns.exec(command.script,
            command.hostname,
            command.threads,
            command.target,
            command.delay,
            command.uuid,
            command.stock,
            command.tprint,
            command.hostname,
            command.threads,
            command.start,
            command.time)
        // sleep to prevent error: cannot be run because it does not have a main function.
        await ns.sleep(1)
        if (!command.pid) {
            ns.print(`WARNING: could not start command: ${JSON.stringify(command)}`)
        }
    }
    const now = new Date().getTime()
    if (!attack.start) {
        attack.start = now
    }
    attack.end = now + attack.time + (attack.cycles * 1000) + 1000
}


/**
 * Generate a UUIDv4 string
 * @returns {string}
 */
export function generateUUID() {
    let dt = new Date().getTime()
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        let r = (dt + Math.random() * 16) % 16 | 0
        dt = Math.floor(dt / 16)
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
    })
}

