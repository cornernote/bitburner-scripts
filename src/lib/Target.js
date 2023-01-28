/**
 * Target helper functions
 */

/**
 * Target Settings
 *
 * @type {{minSecurityLevelOffset: number, maxMoneyMultiplayer: number, attackSpacer: number, hackFraction: number, hackScripts: Array, backdoorHostnames: Array}}
 */
export const TargetSettings = {
    // used to decide if hack action=weaken
    // if (bestTarget.securityLevel > bestTarget.minSecurityLevel + settings.minSecurityLevelOffset) action = 'weaken'
    minSecurityLevelOffset: 1,
    // used to decide if hack action=grow
    // if (bestTarget.money < bestTarget.moneyMax * settings.maxMoneyMultiplayer) action = 'grow'
    maxMoneyMultiplayer: 0.9,
    // time (in ms) between attack parts
    attackSpacer: 250,
    // default hack percent
    hackFraction: 0.2, // 20%
    // scripts used for hacking threads
    hackScripts: [
        {
            file: '/hacks/hack.js',
            change: 0.002,
            ram: 1.7,
        },
        {
            file: '/hacks/grow.js',
            change: 0.004,
            ram: 1.75,
        },
        {
            file: '/hacks/weaken.js',
            change: 0.05,
            ram: 1.75,
        },
        {
            file: '/hacks/check.js',
            change: 0,
            ram: 2,
        },
        {
            file: '/hacks/share.js',
            change: 0,
            ram: 4,
        },
    ],
}

/**
 * AttackDetails
 */
export class AttackDetails {
    /**
     * @param attackDetails
     */
    constructor(attackDetails) {
        this.type = attackDetails.type
        this.delays = attackDetails.delays
        this.hackThreads = attackDetails.hackThreads
        this.prepThreads = attackDetails.prepThreads
        this.hackThreadsCount = attackDetails.hackThreadsCount
        this.threadsPerPrep = attackDetails.threadsPerPrep
        this.moneyPerHack = attackDetails.moneyPerHack
        this.minsPerHack = attackDetails.minsPerHack
    }
}

/**
 * ThreadPack
 */
export class ThreadPack {
    /**
     * @param threadPack
     */
    constructor(threadPack) {
        this.h = threadPack.h
        this.w = threadPack.w
        this.g = threadPack.g
        this.gw = threadPack.gw
    }
}

/**
 * ThreadPackDelay
 */
export class ThreadDelay {
    /**
     * @param threadDelay
     */
    constructor(threadDelay) {
        this.time = threadDelay.time
        this.h = threadDelay.h
        this.w = threadDelay.w
        this.g = threadDelay.g
        this.gw = threadDelay.gw
        this.times = new ThreadTime(threadDelay.times)
    }
}

/**
 * ThreadTime
 */
export class ThreadTime {
    /**
     * @param threadTime
     */
    constructor(threadTime) {
        this.h = threadTime.h
        this.w = threadTime.w
        this.g = threadTime.g
        this.s = threadTime.s
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
 * Gets the cracks used to gain root access
 *
 * @param {function} fileExistsWrap
 * @return {Object[]}
 */
export function getCracks(fileExistsWrap) {
    const cracks = []
    const c = [
        {
            method: 'brutessh',
            file: 'BruteSSH.exe',
            cost: 500000,
        },
        {
            method: 'ftpcrack',
            file: 'FTPCrack.exe',
            cost: 1500000,
        },
        {
            method: 'relaysmtp',
            file: 'relaySMTP.exe',
            cost: 5000000,
        },
        {
            method: 'httpworm',
            file: 'HTTPWorm.exe',
            cost: 30000000,
        },
        {
            method: 'sqlinject',
            file: 'SQLInject.exe',
            cost: 250000000,
        },
    ]
    for (const crack of c) {
        crack.owned = fileExistsWrap(crack.file)
        cracks.push(crack)
    }
    return cracks
}

/**
 *
 * @param target
 * @param hackFraction
 * @param hackAnalyzeWrap
 * @param growthAnalyzeWrap
 * @param getHackTimeWrap
 * @param getGrowTimeWrap
 * @param getWeakenTimeWrap
 * @return {AttackDetails}
 */
export function getAttackDetails(target, hackFraction, hackAnalyzeWrap, growthAnalyzeWrap, getHackTimeWrap, getGrowTimeWrap, getWeakenTimeWrap) {
    const delays = attackDelays(target.hostname, getHackTimeWrap, getGrowTimeWrap, getWeakenTimeWrap)
    const hackThreads = hackThreadsRequired(target, hackFraction, hackAnalyzeWrap, growthAnalyzeWrap)
    const prepThreads = prepThreadsRequired(target, growthAnalyzeWrap)
    const chance = 1 // getAttackChance(target, playerHackingSkill, playerHackingMult)

    return new AttackDetails({
        type: getAttackType(target),
        delays: delays,
        hackThreads: hackThreads,
        prepThreads: prepThreads,
        hackThreadsCount: attackThreadsCount(hackThreads),
        threadsPerPrep: attackThreadsCount(prepThreads),
        moneyPerHack: (target.moneyMax * hackFraction) * chance,
        minsPerHack: (delays.time / 1000 / 60),
    })
}

/**
 * Get the chance that a hack will be successful.
 *
 * @param {Server} target
 * @return {number}
 */
export function getAttackChance(target, playerHackingSkill, playerHackingMult) {
    // let chance
    // try {
    //     // chance = ns.formulas.hacking.hackChance(target, ns.player())
    // } catch (e) {
    const hackFactor = 1.75
    // const difficultyMult = (100 - target.minDifficulty) / 100 // assume server has min security
    const difficultyMult = (100 - target.hackDifficulty) / 100 // assume server has current security
    const skillMult = hackFactor * playerHackingSkill
    const skillChance = (skillMult - target.requiredHackingSkill) / skillMult
    return Math.max(0, Math.min(1, skillChance * difficultyMult * playerHackingMult))
    // }
    // return chance
}

/**
 * Threads required to hack a server.
 *
 * @param {Server} targetServer
 * @return {string}
 */
export function getAttackType(targetServer) {
    if (targetServer.hackDifficulty > targetServer.minDifficulty + TargetSettings.minSecurityLevelOffset
        || targetServer.moneyAvailable < targetServer.moneyMax * TargetSettings.maxMoneyMultiplayer) {
        return 'prep'
    }
    return 'hack'
}

/**
 * Threads required to hack a server.
 *
 * @param {Server} targetServer
 * @param {number} hackFraction
 * @param {function} hackAnalyzeWrap
 * @param {function} growthAnalyzeWrap
 * @return {ThreadPack}
 */
export function threadsRequired(targetServer, hackFraction, hackAnalyzeWrap, growthAnalyzeWrap) {
    if (getAttackType(targetServer) === 'prep') {
        return prepThreadsRequired(targetServer, growthAnalyzeWrap)
    }
    return hackThreadsRequired(targetServer, hackFraction, hackAnalyzeWrap, growthAnalyzeWrap)
}

/**
 * Threads required to fully weaken the server's security and grow the server's money.
 *
 * @param {Server} targetServer
 * @param {function} growthAnalyzeWrap
 * @return {ThreadPack}
 */
export function prepThreadsRequired(targetServer, growthAnalyzeWrap) {
    const difficultyDifference = targetServer.hackDifficulty - targetServer.minDifficulty
    const growthRequired = targetServer.moneyAvailable
        ? targetServer.moneyMax / targetServer.moneyAvailable
        : 100
    const changePerWeakenThread = TargetSettings.hackScripts.find(h => h.file === '/hacks/weaken.js').change
    const changePerGrowThread = TargetSettings.hackScripts.find(h => h.file === '/hacks/grow.js').change

    const w = Math.ceil(difficultyDifference / changePerWeakenThread)
    const g = Math.ceil(growthAnalyzeWrap(targetServer.hostname, growthRequired))
    const gw = Math.ceil((g * changePerGrowThread) / changePerWeakenThread)

    return new ThreadPack({
        h: 0,
        w: w,
        g: g,
        gw: gw,
    })
}

/**
 * Threads required for a full Hack Weaken Grow Weaken (HWGW) attack.
 *
 * @param {Server} targetServer
 * @param {number} hackFraction between 0 and 1
 * @param {function} hackAnalyzeWrap
 * @param {function} growthAnalyzeWrap
 * @return {ThreadPack}
 */
export function hackThreadsRequired(targetServer, hackFraction, hackAnalyzeWrap, growthAnalyzeWrap) {
    const percentStolenPerThread = hackAnalyzeWrap(targetServer.hostname) // percent of money stolen with a single thread
    const h = Math.floor(hackFraction / percentStolenPerThread) // threads to hack the amount we want, floor so that we don't over-hack
    const hackedFraction = h * percentStolenPerThread // < ~0.8 - the percent we actually hacked
    const remainingPercent = 1 - hackedFraction + 0.0001 // > ~0.2 - the percent remaining on the server
    const growthRequiredEstimated = 1 - hackFraction + 0.0001 // > ~0.2 - the percent remaining on the server
    const growthRequired = remainingPercent > 0 ? 1 / remainingPercent : 1 / growthRequiredEstimated // < ~5 - the number of times we have to grow that amount
    const growThreadsRequired = growthAnalyzeWrap(targetServer.hostname, growthRequired) // how many thread to grow the money by ~5x
    const correctionThreads = 1 // + (hackedFraction * 0.75) // some threads in case there is a misfire, the more hackedFraction the more threads
    const changePerWeakenThread = TargetSettings.hackScripts.find(h => h.file === '/hacks/weaken.js').change
    const changePerGrowThread = TargetSettings.hackScripts.find(h => h.file === '/hacks/grow.js').change
    const changePerHackThread = TargetSettings.hackScripts.find(h => h.file === '/hacks/hack.js').change

    const g = Math.ceil(growThreadsRequired * correctionThreads)  // threads to grow the amount we want, ceil so that we don't under-grow
    const w = Math.ceil(h * (changePerHackThread / changePerWeakenThread)) // weaken threads for hack, ceil so that we don't under-weaken
    const gw = Math.ceil(g * (changePerGrowThread / changePerWeakenThread)) // weaken threads for grow, ceil so that we don't under-weaken

    return new ThreadPack({
        h: h,
        w: w,
        g: g,
        gw: gw,
    })
}

/**
 *
 * @param {ThreadPack} attackThreads
 * @return {number}
 */
export function attackThreadsCount(attackThreads) {
    return attackThreads.h
        + attackThreads.w
        + attackThreads.g
        + attackThreads.gw
}

/**
 *
 * @param {ThreadPack} attackThreads
 * @return {number}
 */
export function attackRamRequired(attackThreads) {
    return attackThreads.h * TargetSettings.hackScripts.find(h => h.file === '/hacks/hack.js').ram
        + attackThreads.w * TargetSettings.hackScripts.find(h => h.file === '/hacks/weaken.js').ram
        + attackThreads.g * TargetSettings.hackScripts.find(h => h.file === '/hacks/grow.js').ram
        + attackThreads.gw * TargetSettings.hackScripts.find(h => h.file === '/hacks/weaken.js').ram
}

/**
 * Calculate delays required to land all hack scripts in sequence.
 *
 * @param {string} targetHostname
 * @param {function} getHackTimeWrap
 * @param {function} getGrowTimeWrap
 * @param {function} getWeakenTimeWrap
 * @return {ThreadDelay}
 */
export function attackDelays(targetHostname, getHackTimeWrap, getGrowTimeWrap, getWeakenTimeWrap) {
    const h = getHackTimeWrap(targetHostname)   // eg 0:20
    const g = getGrowTimeWrap(targetHostname)   // eg 0:40
    const w = getWeakenTimeWrap(targetHostname) // eg 1:00
    const s = TargetSettings.attackSpacer       // eg 0:01

    // order -> H W G GW <- with spacer between
    return new ThreadDelay({
        time: w + s * 4,     // 0. 0:00 - 1:04 - total attack time
        h: w - h,            // 1. 0:40 - 1:00 - hack, timed to end before weaken finishes
        w: s,                // 2. 0:01 - 1:01 - weaken after hack
        g: w - g + (s * 2),  // 3. 0:22 - 1:02 - grow, timed to end before grow-weaken finishes
        gw: s * 3,           // 4. 0:03 - 1:03 - weaken after grow
        times: new ThreadTime({h: h, g: g, w: w, s: s}),
    })
}

/**
 * Fits the attack threads into available threads.
 *
 * @param {Server} targetServer
 * @param {ThreadPack} attackThreads
 * @param {number} freeThreads
 * @param {boolean} forceMoneyHack
 * @param {function} hackAnalyzeWrap
 * @param {function} growthAnalyzeWrap
 * @return {ThreadPack}
 */
export function fitThreads(targetServer, attackType, attackThreads, freeThreads, forceMoneyHack, hackAnalyzeWrap, growthAnalyzeWrap) {
    if (freeThreads >= attackThreadsCount(attackThreads)) {
        return new ThreadPack(attackThreads)
    }
    const changePerWeakenThread = TargetSettings.hackScripts.find(h => h.file === '/hacks/weaken.js').change
    const changePerGrowThread = TargetSettings.hackScripts.find(h => h.file === '/hacks/grow.js').change
    const changePerHackThread = TargetSettings.hackScripts.find(h => h.file === '/hacks/hack.js').change
    const fittedThreads = new ThreadPack(attackThreads)
    const scale = freeThreads / attackThreadsCount(attackThreads)

    if (attackType === 'hack') {
        // assign as many threads to hack as we can
        fittedThreads.h = Math.min(freeThreads, Math.floor(fittedThreads.h * scale))
        freeThreads -= fittedThreads.h

        if (!forceMoneyHack) {
            // use threads from hack to weaken, ceil to ensure we weaken
            fittedThreads.w = fittedThreads.h > 0
                ? Math.ceil(fittedThreads.h * (changePerHackThread / changePerWeakenThread))
                : 0
            fittedThreads.h -= fittedThreads.w

            // use threads from hack to grow, round to not waste threads
            const percentStolenPerThread = hackAnalyzeWrap(targetServer.hostname)
            const remainingPercent = 1 - (fittedThreads.h * percentStolenPerThread)
            const growthRequired = remainingPercent > 0 ? 1 / remainingPercent : 0
            fittedThreads.g = Math.min(freeThreads, Math.round(growthAnalyzeWrap(targetServer.hostname, growthRequired)))
        }
    } else {
        // assign as many threads to weaken as we can
        fittedThreads.w = Math.min(freeThreads, Math.floor(fittedThreads.w * scale))
        freeThreads = Math.max(0, freeThreads - fittedThreads.w)

        // any remaining threads for grow
        fittedThreads.g = Math.min(freeThreads, fittedThreads.g)
    }

    if (!forceMoneyHack) {
        // use threads from grow to weaken
        fittedThreads.gw = fittedThreads.g > 1
            ? Math.ceil((fittedThreads.g * changePerGrowThread) / changePerWeakenThread)
            : 0
        fittedThreads.g -= fittedThreads.gw
    }

    return fittedThreads
}

/**
 * @param {Server[]} hackingServers
 * @param {number} totalFreeThreads
 * @param {string} attackType
 * @param {number} cycles
 * @param {ThreadPack} attackThreads
 * @param {Server} targetServer
 * @param {boolean} forceMoneyHack
 * @param {function} hackAnalyzeWrap
 * @param {function} growthAnalyzeWrap
 * @param {function} getHackTimeWrap
 * @param {function} getGrowTimeWrap
 * @param {function} getWeakenTimeWrap
 * @return {AttackCommand[]}
 */
export function buildAttack(hackingServers, totalFreeThreads, attackType, cycles, attackThreads, targetServer, forceMoneyHack, hackAnalyzeWrap, growthAnalyzeWrap, getHackTimeWrap, getGrowTimeWrap, getWeakenTimeWrap) {
    const commands = []
    const delays = attackDelays(targetServer.hostname, getHackTimeWrap, getGrowTimeWrap, getWeakenTimeWrap)
    for (const hackingServer of hackingServers) {
        for (let cycle = 1; cycle <= cycles; cycle++) {
            const freeThreads = Math.floor((hackingServer.maxRam - hackingServer.ramUsed) / 1.75)
            if (freeThreads < 100 && freeThreads / totalFreeThreads < 0.05) {
                continue
            }
            const threadsToRun = new ThreadPack(attackThreads)
            const fittedThreads = fitThreads(targetServer, attackType, threadsToRun, freeThreads, forceMoneyHack, hackAnalyzeWrap, growthAnalyzeWrap)

            // hack
            if (fittedThreads.h) {
                commands.push(new AttackCommand({
                    script: '/hacks/hack.js',
                    hostname: hackingServer.hostname,
                    threads: fittedThreads.h,
                    target: targetServer.hostname,
                    delay: (forceMoneyHack ? 0 : delays.h) + (commands.length * TargetSettings.attackSpacer),
                    time: delays.times.h,
                    stock: false,
                    output: true,
                }))
                threadsToRun.h -= fittedThreads.h
                hackingServer.ramUsed += fittedThreads.h * 1.75
            }
            // weaken
            if (fittedThreads.w) {
                commands.push(new AttackCommand({
                    script: '/hacks/weaken.js',
                    hostname: hackingServer.hostname,
                    threads: fittedThreads.w,
                    target: targetServer.hostname,
                    delay: delays.w + (commands.length * TargetSettings.attackSpacer),
                    time: delays.times.w,
                    stock: false,
                    output: true,
                }))
                threadsToRun.w -= fittedThreads.w
                hackingServer.ramUsed += fittedThreads.w * 1.75
            }
            // grow
            if (fittedThreads.g) {
                commands.push(new AttackCommand({
                    script: '/hacks/grow.js',
                    hostname: hackingServer.hostname,
                    threads: fittedThreads.g,
                    target: targetServer.hostname,
                    delay: delays.g + (commands.length * TargetSettings.attackSpacer),
                    time: delays.times.g,
                    stock: false,
                    output: true,
                }))
                threadsToRun.g -= fittedThreads.g
                hackingServer.ramUsed += fittedThreads.g * 1.75
            }
            // weaken
            if (fittedThreads.gw) {
                commands.push(new AttackCommand({
                    script: '/hacks/weaken.js',
                    hostname: hackingServer.hostname,
                    threads: fittedThreads.gw,
                    target: targetServer.hostname,
                    delay: delays.gw + (commands.length * TargetSettings.attackSpacer),
                    time: delays.times.w,
                    stock: false,
                    output: true,
                }))
                threadsToRun.gw -= fittedThreads.gw
                hackingServer.ramUsed += fittedThreads.gw * 1.75
            }
        }
    }
    return commands
}

/**
 * Launch the attack
 *
 * @param {AttackCommand[]} commands
 * @param {number} cycles
 * @param {function} execWrap
 * @param {function} sleepWrap
 * @return {Promise<{any}>}
 */
export async function launchAttack(commands, cycles, execWrap, sleepWrap) {
    // start the commands at the same time, assume 50ms to start each command
    const start = new Date().getTime() + commands.length * TargetSettings.attackSpacer
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
        try {
            command.pid = execWrap(command.script,
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
        } catch (e) {
            throw `WARNING: could not start command: ${JSON.stringify(command)}`
        }
        // sleep to prevent error: cannot be run because it does not have a main function.
        // also prevents game freeze on large commands
        await sleepWrap(0)
    }
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
