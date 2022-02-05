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
        //0.8,
        0.6,
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
 */
export class Attack {
    /**
     * @param attack
     */
    constructor(attack) {
        this.uuid = attack.uuid ? attack.uuid : generateUUID()
        this.parts = new AttackParts(attack.parts)
        this.target = attack.target
        this.value = attack.value
        this.cycles = attack.cycles
        this.cycleThreads = attack.cycleThreads
        this.activePercent = attack.activePercent
        this.time = attack.time
        this.spacer = attack.spacer
        this.start = null
        this.end = null
    }
}

/**
 * HackAttack
 */
export class HackAttack extends Attack {
    /**
     * @param hackAttack
     */
    constructor(hackAttack) {
        super(hackAttack)
        this.type = 'hack'
        this.info = new AttackInfo(hackAttack.info)
    }
}

/**
 * PrepAttack
 */
export class PrepAttack extends Attack {
    /**
     * @param prepAttack
     */
    constructor(prepAttack) {
        super(prepAttack)
        this.type = 'prep'
    }
}

/**
 * HackAttackParts
 */
export class AttackParts {
    /**
     * @param attackParts
     */
    constructor(attackParts) {
        // hack
        this.h = new AttackPart(attackParts.h)
        // hack-weaken
        this.w = new AttackPart(attackParts.w)
        // grow
        this.g = new AttackPart(attackParts.g)
        // grow-weaken
        this.gw = new AttackPart(attackParts.gw)
    }
}

/**
 * AttackPart
 */
export class AttackPart {
    /**
     * @param attackPart
     */
    constructor(attackPart) {
        this.threads = attackPart.threads
        this.time = attackPart.time
        this.delay = attackPart.delay
        this.ram = attackPart.ram
        this.script = attackPart.script
        this.allowSpreading = attackPart.allowSpreading
    }
}

/**
 * AttackInfo
 */
export class AttackInfo {
    /**
     * @param attackInfo
     */
    constructor(attackInfo) {
        this.cores = attackInfo.cores
        this.hackPercent = attackInfo.hackPercent
        this.hackedPercent = attackInfo.hackedPercent
        this.growthRequired = attackInfo.growthRequired
        this.cycleValue = attackInfo.cycleValue
        this.maxCycles = attackInfo.maxCycles
        this.valuePerThread = attackInfo.valuePerThread
        this.averageValuePerThreadPerSecond = attackInfo.averageValuePerThreadPerSecond
    }
}

/**
 * AttackCommand
 */
export class AttackCommand {
    /**
     * @param attackCommand
     */
    constructor(attackCommand) {
        this.script = attackCommand.script
        this.hostname = attackCommand.hostname
        this.threads = attackCommand.threads
        this.target = attackCommand.target
        this.delay = attackCommand.delay
        this.time = attackCommand.time
        this.uuid = attackCommand.uuid ? attackCommand.uuid : generateUUID()
        this.stock = attackCommand.stock
        this.output = attackCommand.output
        this.start = attackCommand.start
        this.pid = attackCommand.pid
    }
}

/**
 * Gets the best prep attack.
 *
 * @param {NS} ns
 * @param {Player} player
 * @param {[Server]} targets
 * @param {[Server]} hackingServers
 * @param {Number} cores
 * @param {Number} spacer
 * @return {[Attack]}
 */
export function getBestPrepAttacks(ns, player, targets, hackingServers, cores = 1, spacer = 200) {
    let attacks = []
    for (const server of targets) {
        const attack = buildPrepAttack(ns, player, server, hackingServers, cores, spacer)
        attacks.push(attack)
    }
    attacks = attacks.filter(a => a.value).sort((a, b) => b.value - a.value)
    return attacks
}

/**
 * Gets the best hack attack.
 *
 * @param {NS} ns
 * @param {Player} player
 * @param {[Server]} targets
 * @param {[Server]} hackingServers
 * @param {Number} spacer
 * @param {Number} cores
 * @return {[HackAttack]}
 */
export function getBestHackAttacks(ns, player, targets, hackingServers, cores = 1, spacer = 200) {
    let attacks = []
    for (const hackPercent of ATTACK.hackPercents) {
        for (const server of targets) {
            const attack = buildHackAttack(ns, player, server, hackingServers, cores, spacer, hackPercent)
            attacks.push(attack)
        }
    }
    attacks = attacks.filter(a => a.value).sort((a, b) => b.value - a.value)
    return attacks
}

/**
 * Gets the best prep attack.
 *
 * @param {NS} ns
 * @param {Player} player
 * @param {[Server]} targets
 * @param {[Server]} hackingServers
 * @param {Number} cores
 * @param {Number} spacer
 * @return {Attack|Boolean}
 */
export function getBestPrepAttack(ns, player, targets, hackingServers, cores = 1, spacer = 200) {
    const attacks = getBestPrepAttacks(ns, player, targets, hackingServers, cores, spacer)
    if (!attacks.length) {
        return false
    }
    return attacks.shift()
}

/**
 * Gets the best hack attack.
 *
 * @param {NS} ns
 * @param {Player} player
 * @param {[Server]} targets
 * @param {[Server]} hackingServers
 * @param {Number} cores
 * @param {Number} spacer
 * @return {HackAttack|Boolean}
 */
export function getBestHackAttack(ns, player, targets, hackingServers, cores = 1, spacer = 200) {
    const attacks = getBestHackAttacks(ns, player, targets, hackingServers, cores, spacer)
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
 * @param {[Server]} hackingServers
 * @param {Number} cores
 * @param {Number} spacer
 * @return {PrepAttack}
 */
export function buildPrepAttack(ns, player, server, hackingServers, cores = 1, spacer = 200) {

    // create the attack objects
    const attack = new PrepAttack({
        target: server.hostname,
        value: null,
        cycles: null,
        time: null,
        spacer: spacer,
        parts: new AttackParts({
            h: new AttackPart({
                script: ATTACK.scripts.h.script,
                ram: ATTACK.scripts.h.ram,
                threads: 0,
                time: 0,
                delay: 0,
                allowSpreading: false
            }),
            w: new AttackPart({
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
                allowSpreading: false
            }),
            gw: new AttackPart({
                script: ATTACK.scripts.w.script,
                ram: ATTACK.scripts.w.ram,
                threads: 0,
                time: 0,
                delay: 0,
                allowSpreading: true
            }),
        }),
    })

    // some shortcuts
    const parts = attack.parts,
        w = parts.w,   // prep-weaken
        g = parts.g,   // prep-grow
        gw = parts.gw  // prep-grow-weaken

    // get threads for weaken
    if (server.hackDifficulty > server.minDifficulty + 1) {
        w.threads = Math.ceil((server.hackDifficulty - server.minDifficulty) / ATTACK.scripts.w.change)
    }

    // get threads for grow and grow-weaken
    if (server.moneyAvailable < server.moneyMax * 0.9) {
        const growthAmount = server.moneyAvailable ? server.moneyMax / server.moneyAvailable : 100
        g.threads = Math.ceil(ns.growthAnalyze(server.hostname, growthAmount, cores))
        gw.threads = Math.ceil((g.threads * ATTACK.scripts.g.change) / ATTACK.scripts.w.change)
        // only fit this if we can
        if (w.threads && !countCycles(ns, hackingServers, parts)) {
            g.threads = 0
            gw.threads = 0
        }
    }

    // get attack details
    attack.cycles = countCycles(ns, hackingServers, parts)
    attack.cycleThreads = g.threads + w.threads + gw.threads
    attack.time = ns.getWeakenTime(server.hostname) + attack.spacer * 8
    attack.value = attack.time * -1 // fastest first

    // return the PrepAttack object
    return attack
}

/**
 * Builds an attack against a target.
 * based on the amount you want to hack and the available ram
 * assumes the server is max money and min security
 *
 * @param {NS} ns
 * @param {Player} player
 * @param {Server} target
 * @param {[Server]} hackingServers
 * @param {Number} cores
 * @param {Number} spacer
 * @param {Number} hackPercent
 * @return {HackAttack|boolean}
 */
export function buildHackAttack(ns, player, target, hackingServers, cores = 1, spacer = 200, hackPercent = 0.2) {

    // create the attack objects
    const attack = new HackAttack({
        target: target.hostname,
        value: null,
        cycles: null,
        time: null,
        spacer: spacer,
        activePercent: null,
        parts: new AttackParts({
            h: new AttackPart({
                script: ATTACK.scripts.h.script,
                ram: ATTACK.scripts.h.ram,
                threads: 0,
                time: 0,
                delay: 0,
                allowSpreading: false
            }),
            w: new AttackPart({
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
                allowSpreading: false
            }),
            gw: new AttackPart({
                script: ATTACK.scripts.w.script,
                ram: ATTACK.scripts.w.ram,
                threads: 0,
                time: 0,
                delay: 0,
                allowSpreading: true
            }),
        }),
        info: new AttackInfo({
            hackPercent: hackPercent,
            cores: cores,
            hackedPercent: null,
            cycleValue: null,
            threadRam: null,
            maxCycles: null,
            valuePerThread: null,
            averageValuePerThreadPerSecond: null,
        }),
    })

    // some shortcuts
    const info = attack.info,
        parts = attack.parts,
        h = parts.h,     // hack
        w = parts.w,     // hack-weaken
        g = parts.g,     // grow
        gw = parts.gw    // grow-weaken

    // expected hack value for a full attack
    const hackFactor = 1.75
    const difficultyMult = (100 - target.minDifficulty) / 100 // assume server has min security
    const skillMult = hackFactor * player.hacking
    const skillChance = (skillMult - target.requiredHackingSkill) / skillMult
    const chance = Math.max(0, Math.min(1, skillChance * difficultyMult * player.hacking_chance_mult))
    info.cycleValue = target.moneyMax * chance * hackPercent // assume server has max money

    // get the threads for a full hack (HWGW) - this doesn't matter what values the server has now
    const hackAnalyze = ns.hackAnalyze(target.hostname) // percent of money stolen with a single thread
    h.threads = Math.floor(hackPercent / hackAnalyze) // threads to hack the amount we want, floor so that we don't over-hack
    info.hackedPercent = h.threads * hackAnalyze // < ~0.8 - the percent we actually hacked
    const remainingPercent = 1 - info.hackedPercent // > ~0.2 - the percent remaining on the server
    const growthRequiredEstimated = 1 / (1 - hackPercent) // 5
    info.growthRequired = remainingPercent > 0 ? 1 / remainingPercent : growthRequiredEstimated // < ~5 - the number of times we have to grow that amount
    const growthAnalyze = ns.growthAnalyze(target.hostname, info.growthRequired, cores) // how many thread to grow the money by ~5x
    const correctionThreads = 1 + (info.hackedPercent * 0.75) // some threads incase there is a misfire, the more hackedPercent the more threads
    g.threads = Math.ceil(growthAnalyze * correctionThreads)  // threads to grow the amount we want, ceil so that we don't under-grow
    w.threads = Math.ceil(h.threads * (ATTACK.scripts.h.change / ATTACK.scripts.w.change)) // weaken threads for hack, ceil so that we don't under-weaken
    gw.threads = Math.ceil(g.threads * (ATTACK.scripts.g.change / ATTACK.scripts.w.change)) // weaken threads for grow, ceil so that we don't under-weaken

    // get the count of threads
    attack.cycleThreads = h.threads + w.threads + g.threads + gw.threads
    info.valuePerThread = info.cycleValue / attack.cycleThreads
    // what percentage of the time can we fill with tasks before availableThreads fills
    attack.time = ns.getWeakenTime(target.hostname) + attack.spacer * 5
    info.maxCycles = Math.floor(attack.time / (attack.spacer * 5)) // attacks at 1/sec
    attack.cycles = countCycles(ns, hackingServers, parts, info.maxCycles)
    attack.activePercent = attack.cycles ? attack.cycles / info.maxCycles : 0// 0.2 = 20%
    info.attackThreads = attack.cycleThreads * attack.cycles
    // hack value per thread used per second (excluding the wait for the first attack to land)
    info.averageValuePerThreadPerSecond = info.valuePerThread * attack.activePercent
    // hack value
    attack.value = (info.cycleValue * attack.cycles * attack.activePercent) / attack.time

    // return the HackAttack object
    return attack
}

/**
 * Assign the attack threads between our hacking servers
 *
 * @param {NS} ns
 * @param {[Server]} servers
 * @param {AttackParts} attackParts
 * @param {number} maxCycles
 * @returns {number}
 */
export function countCycles(ns, servers, attackParts, maxCycles = 1) {
    const serverRam = {}
    // check the ram for as many cycles as needed
    for (let cycle = 1; cycle <= maxCycles; cycle++) {
        // assign each attack part to a server
        for (const part of Object.values(attackParts)) {
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
        //ns.tprint('fitting cycle ' + cycle)
        let cycleCommands = []
        const serverRam = {}

        // some shortcuts
        const parts = attack.parts,
            h = parts.h,     // hack
            w = parts.w,     // hack-weaken
            g = parts.g,     // grow
            gw = parts.gw    // grow-weaken

        // get the time needed for threads
        h.time = ns.getHackTime(attack.target)
        g.time = ns.getGrowTime(attack.target)
        w.time = gw.time = ns.getWeakenTime(attack.target)

        // calculate the delays to land all attacks together
        // prep order -> PW PG PGW <- with 50ms between
        // hack order -> H HW G GW <- with 50ms between
        h.delay = w.time - h.time + (attack.spacer * 1)
        w.delay = (attack.spacer * 2)
        g.delay = gw.time - g.time + (attack.spacer * 3)
        gw.delay = (attack.spacer * 4)
        attack.time = gw.time + (attack.spacer * 5)

        for (const part of Object.values(attack.parts)) {
            let threadsRemaining = part.threads
            if (!threadsRemaining) {
                continue
            }
            // ns.tprint('fitting part ' + part.script + ' x' + part.threads)
            for (let allowSpreading = part.allowSpreading ? 1 : 0; allowSpreading <= 1; allowSpreading++) {
                // ns.tprint('allow spreading? ' + allowSpreading)
                // ns.tprint('allow overflow? ' + allowRamOverflow)
                // ns.tprint(allowRamOverflow)
                for (let i = 0; i < servers.length; i++) {
                    const server = servers[i]
                    const threadsFittable = Math.max(0, Math.floor((server.maxRam - server.ramUsed) / part.ram))
                    // ns.tprint('fitting to server ' + server.hostname + ' which has ' + threadsFittable + ' threads available')
                    const threadsToRun = Math.max(0, Math.min(threadsFittable, threadsRemaining))
                    if (threadsToRun) {
                        // if there are not enough threads, and we cannot spread the threads, then continue to the next server
                        if (threadsToRun < threadsRemaining && allowSpreading === 0) {
                            continue
                        }
                        // ns.tprint('fitted ' + threadsToRun + ' threads')

                        // create the commands and assign the threads to this server
                        cycleCommands.push(new AttackCommand({
                            script: part.script,
                            hostname: server.hostname,
                            threads: threadsToRun,
                            target: attack.target,
                            delay: (cycle * attack.spacer * 5) + part.delay,
                            time: part.time,
                            stock: false,
                            output: false,
                        }))
                        threadsRemaining -= threadsToRun
                        server.ramUsed += threadsToRun * part.ram
                        serverRam[server.hostname] += threadsToRun * part.ram // so we can give it back if it doesn't fit
                        if (!threadsRemaining) {
                            // ns.tprint('all threads fitted!')
                            break
                        }
                    }
                }
            }
            // check for overflow
            if (threadsRemaining) {
                if (!allowRamOverflow) {
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
                ns.print(`INFO: ram overflow with ${threadsRemaining} threads remaining!`)
            }
        }
        // if we fit in ram, add to the list
        // ns.tprint(cycleCommands)
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
 * @param {number} cycles
 * @return {Promise<{any}>}
 */
export async function launchAttack(ns, attack, commands, cycles = 1) {
    // start the commands at the same time, assume 50ms to start each command
    const start = new Date().getTime() + commands.length * 50
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
        //   7: output,
        //   8: host,
        //   9: threads,
        //   10: start,
        //   11: time,
        // ]
        command.start = start
        command.pid = ns.exec(command.script,
            command.hostname,
            command.threads,
            command.target,
            command.delay,
            command.uuid,
            command.stock,
            command.output,
            command.hostname,
            command.threads,
            command.start,
            command.time)
        // sleep to prevent error: cannot be run because it does not have a main function.
        // also prevents game freeze on large commands
        await ns.sleep(0)
        if (!command.pid) {
            ns.print(`WARNING: could not start command: ${JSON.stringify(command)}`)
        }
    }
    if (!attack.start) {
        attack.start = start
    }
    attack.end = start + attack.time + (cycles * attack.spacer * 5)
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

