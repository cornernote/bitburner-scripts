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
    },
    // percents used when testing attack values
    hackPercents: [
        0.95,
        0.8,
        0.4,
        0.2,
        0.1,
        0.05,
        0.025,
        0.0125,
        0.00625,
        0.003125,
        0.0015625,
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
    this.commands = []
    this.start = null
    this.end = null
    if (attack.commands && Array.isArray(attack.commands)) {
        for (const command of attack.commands) {
            this.commands.push(new AttackCommand(command))
        }
    }
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
}

/**
 * AttackInfo
 *
 * @param attackInfo
 */
export function AttackInfo(attackInfo) {
    this.cores = attackInfo.cores
    this.availableThreads = attackInfo.availableThreads
    this.hackPercent = attackInfo.hackPercent
    this.hackedPercent = attackInfo.hackedPercent
    this.cycleValue = attackInfo.cycleValue
    this.prepThreads = attackInfo.prepThreads
    this.cycleThreads = attackInfo.cycleThreads
    this.attackThreads = attackInfo.attackThreads
    this.maxCycles = attackInfo.maxCycles
    this.activePercent = attackInfo.activePercent
    this.valuePerThread = attackInfo.valuePerThread
    this.hackTotalPerSecond = attackInfo.hackTotalPerSecond
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
    this.uuid = attackCommand.uuid
    this.stock = attackCommand.stock
    this.tprint = attackCommand.tprint
    this.toast = attackCommand.toast
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
 * @param {Number} availableThreads
 * @param {Number} cores
 * @return {[Attack]}
 */
export function getBestAttacks(ns, player, servers, sortField, availableThreads, cores = 1) {
    let attacks = []
    for (const hackPercent of ATTACK.hackPercents) {
        for (const server of servers) {
            const attack = buildAttack(ns, player, server, hackPercent, availableThreads, cores)
            if (attack[sortField]) {
                attacks.push(attack)
            }
        }
    }
    attacks = attacks.sort((a, b) => b[sortField] - a[sortField])
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
 * @param {Number} availableThreads
 * @param {Number} cores
 * @return {Attack|Boolean|*}
 */
export function getBestAttack(ns, player, servers, sortField, availableThreads, cores = 1) {
    const attacks = getBestAttacks(ns, player, servers, sortField, availableThreads, cores)
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
 * @param {Number} availableThreads
 * @param {Number} cores
 * @return {Attack}
 */
export function buildAttack(ns, player, server, hackPercent, availableThreads, cores = 1) {

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
            }),
        }),
        info: new AttackInfo({
            hackPercent: hackPercent,
            availableThreads: availableThreads,
            cores: cores,
            hackedPercent: null,
            cycleValue: null,
            prepThreads: null,
            threadRam: null,
            cycleThreads: null,
            maxCycles: null,
            activePercent: null,
            valuePerThread: null,
            hackTotalPerSecond: null,
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
        gw = parts.gw    // grow-weaken

    // expected hack value for a full attack
    const hackFactor = 1.75;
    const difficultyMult = (100 - server.hackDifficulty) / 100;
    const skillMult = hackFactor * player.hacking;
    const skillChance = (skillMult - server.requiredHackingSkill) / skillMult;
    const chance = Math.max(0, Math.min(1, skillChance * difficultyMult * player.hacking_chance_mult))
    info.cycleValue = server.moneyMax * chance * hackPercent

    // get threads for prep-weaken
    if (server.hackDifficulty > server.minDifficulty + 1) {
        pw.threads = Math.ceil((server.hackDifficulty - server.minDifficulty) / ATTACK.scripts.w.change)
    }
    // get threads for prep-grow and prep-weaken
    if (server.moneyAvailable < server.moneyMax * 0.9) {
        pg.threads = Math.ceil(ns.growthAnalyze(server.hostname, server.moneyMax / server.moneyAvailable, cores))
        pgw.threads = Math.ceil((pg.threads * ATTACK.scripts.g.change) / ATTACK.scripts.w.change)
        // only fit this if we can
        if (pw.threads && availableThreads < pw.threads + pg.threads + pgw.threads) {
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
    const growthRequired = remainingPercent ? 1 / remainingPercent : growthRequiredEstimated // < ~5 - the number of times we have to grow that amount
    const growthAnalyze = ns.growthAnalyze(server.hostname, growthRequired, cores) // how many thread to grow the money by ~5x
    g.threads = Math.ceil(growthAnalyze) // threads to grow the amount we want, ceil so that we don't under-grow
    hw.threads = Math.ceil(h.threads * (ATTACK.scripts.h.change / ATTACK.scripts.w.change)) // weaken threads for hack, ceil so that we don't under-weaken
    gw.threads = Math.ceil(g.threads * (ATTACK.scripts.g.change / ATTACK.scripts.w.change)) // weaken threads for grow, ceil so that we don't under-weaken

    // get the count of threads
    info.prepThreads = pw.threads + pg.threads + pgw.threads * ATTACK.scripts.w.ram
    info.cycleThreads = h.threads + hw.threads + g.threads + gw.threads
    info.valuePerThread = info.cycleValue / info.cycleThreads
    // what percentage of the time can we fill with tasks before availableThreads fills
    info.maxCycles = ns.getWeakenTime(server.hostname) / 1000 // attacks at 1/sec
    attack.cycles = Math.min(Math.floor(availableThreads / info.cycleThreads), info.maxCycles)
    info.activePercent = attack.cycles / info.maxCycles // 0.2 = 20%
    info.attackThreads = info.cycleThreads * attack.cycles
    // attack value per thread used per second (excluding the wait for the first attack to land)
    info.averageValuePerThreadPerSecond = info.valuePerThread * info.activePercent
    info.hackTotalPerSecond = info.cycleValue * info.activePercent // assuming we launch every second

    // if we can fit one attack in ram
    if (info.cycleThreads < availableThreads) {
        attack.hackValue = info.hackTotalPerSecond + info.averageValuePerThreadPerSecond
        //attack.hackValue = Number.parseFloat(attack.hackValue).toPrecision(1) + info.averageValuePerThreadPerSecond
    }
    // if we can fit prep attack in ram
    if (info.prepThreads < availableThreads) {
        attack.prepValue = info.averageValuePerThreadPerSecond
    }

    // return an Attack object
    return attack
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
 * @returns {Boolean}
 */
export function assignAttack(ns, attack, servers, cycleType, cycles = 1, allowRamOverflow = false) {
    attack.commands = []
    for (let cycle = 1; cycle <= cycles; cycle++) {
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
            gw = parts.gw    // grow-weaken

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
        attack.time = gw.time + gw.delay + (delay * 2)

        const attackParts = cycleType === 'prep'
            ? [attack.parts.pw, attack.parts.pg, attack.parts.pgw]
            : [attack.parts.h, attack.parts.hw, attack.parts.g, attack.parts.gw]

        for (const part of attackParts) {
            let threadsRemaining = part.threads
            for (const server of servers) {
                const threadsFittable = Math.max(0, Math.floor((server.maxRam - server.ramUsed) / part.ram))
                const threadsToRun = Math.max(0, Math.min(threadsFittable, threadsRemaining))
                if (threadsToRun) {
                    cycleCommands.push(new AttackCommand({
                        script: part.script,
                        hostname: server.hostname,
                        threads: threadsToRun,
                        target: attack.target,
                        delay: (cycle * 1000) + part.delay,
                        uuid: `${cycleType}-${cycle}-${generateUUID()}`,
                        stock: false,
                        tprint: false,
                        toast: false,
                    }))
                    threadsRemaining -= threadsToRun
                    server.ramUsed += threadsToRun * part.ram
                    serverRam[server.hostname] += threadsToRun * part.ram // so we can give it back if it doesn't fit
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
            attack.commands.push(command)
        }
    }
    return attack.commands.length > 0
}

/**
 * Launch the attack
 *
 * @param {NS} ns
 * @param {Attack} attack
 * @return {Promise<{any}>}
 */
export async function launchAttack(ns, attack) {
    // run each command in the list
    // ns.print('running commands:')
    for (const command of attack.commands) {
        let retry = 5,
            pid = 0
        // retry a few times until we get a pid
        for (let i = retry; i > 0; i--) {
            // args[0: script, 1: host, 2: threads, 3: target, 4: delay, 5: uuid, 6: stock, 7: tprint, 8: toast]
            pid = ns.exec(command.script,
                command.hostname,
                command.threads,
                command.target,
                command.delay,
                command.uuid,
                command.stock,
                command.tprint,
                command.toast)
            // ns.print(`${command.script} threads=${command.threads}`)
            // sleep to prevent error: cannot be run because it does not have a main function.
            await ns.sleep(1)
            // ensure we got a pid and break
            if (pid) {
                command.pid = pid
                break
            }
            // sleep and try again
            await ns.sleep(100)
        }
        if (!pid) {
            ns.tprint(`WARNING: could not start command: ${JSON.stringify(command)}`)
        }
    }
    attack.start = new Date().getTime()
    attack.end = attack.start + attack.time + 1000
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

