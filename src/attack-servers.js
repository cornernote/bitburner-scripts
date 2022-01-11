import {Runner} from "./lib/Runner.js"
import {settings} from "./_settings.js"

/**
 * Command options
 */
const argsSchema = [
    ['loop', false],
    ['proxy', false],
    ['help', false],
]

/**
 * Command auto-complete
 */
export function autocomplete(data, _) {
    data.flags(argsSchema)
    return []
}

/**
 * Entry method
 *
 * @param {NS} ns
 */
export async function main(ns) {
    const args = ns.flags(argsSchema)
    const runner = new Runner(ns)
    let nsProxy = runner.nsProxy
    if (!args['proxy']) {
        nsProxy = ns
    }
    // load job module
    const attackServers = new AttackServers(ns, nsProxy)
    // print help
    if (args.help) {
        ns.tprint(attackServers.getHelp())
        ns.exit()
    }
    // get ready
    do {
        // work, sleep, repeat
        await attackServers.doJob()
        await ns.sleep(10)
    } while (args.loop)
}

// fake method to count towards memory usage, used by nsProxy
function countedTowardsMemory(ns) {
    ns.run('fake.js')
    ns.isRunning(0)
    // comment below here if using nsProxy
    ns.getPlayer()
    ns.scan()
    ns.getServer('home')
    ns.exec('fake.js', 'home')
    ns.getGrowTime('home')
    ns.getHackTime('home')
    ns.getWeakenTime('home')
    ns.hackAnalyzeThreads('home', 1)
    ns.growthAnalyze('home', 1)
}


/**
 * AttackServers
 *
 * Launch a hack attack for profit.
 */
export class AttackServers {

    /**
     * The BitBurner instance
     * @type {NS}
     */
    ns

    /**
     * The nsProxy instance
     * @type {NS}
     */
    nsProxy

    /**
     * The time we last ran
     * @type {Number}
     */
    lastRun

    /**
     * Player data
     * @type {Player}
     */
    player

    /**
     * Server data
     * @type {Server[]}
     */
    servers

    /**
     * Server data, containing servers we can run scripts on
     * @type {Server[]}
     */
    hackingServers

    /**
     * Server data, sorted by hack value
     * @type {Server[]}
     */
    targetServers

    /**
     * List of hacks that are used to attack servers
     * @type {Object}
     */
    hacks = {
        weaken: {
            script: '/hacks/weaken.js',
            change: 0.05,
            ram: 1.75,
        },
        grow: {
            script: '/hacks/grow.js',
            change: 0.004,
            ram: 1.75,
        },
        hack: {
            script: '/hacks/hack.js',
            change: 0.002,
            ram: 1.7,
        },
    }


    /**
     * Information about the action taken for the cycle.
     * @type {String}
     */
    action

    /**
     * List of attacks we will be running to hack servers
     * @type {Array}
     */
    attacks = []

    /**
     * Construct the class
     *
     * @param {NS} ns - the NS instance passed into the scripts main() entry method
     * @param {NS} nsProxy - the nsProxy object
     * @param {Object} config - key/value pairs used to set object properties
     */
    constructor(ns, nsProxy, config = {}) {
        this.ns = ns
        this.nsProxy = nsProxy
        // allow override of properties in this class
        Object.entries(config).forEach(([key, value]) => this[key] = value)
    }

    /**
     * Launch a hack attack for profit.
     *
     * @returns {Promise<void>}
     */
    async doJob() {
        // check if we need to run
        if (this.lastRun + settings.intervals['attack-server'] > new Date().getTime()) {
            return
        }
        this.ns.print('AttackServers...')
        // run the attacks
        await this.attackServers()
        // set the last run time
        this.lastRun = new Date().getTime()
        // display the report
        //this.ns.tprint(this.getReport())
    }

    /**
     * Build and run attacks
     *
     * @returns {Promise<void>}
     */
    async attackServers() {
        await this.loadPlayer()
        await this.loadServers()

        // clean ended attacks
        this.attacks = this.attacks
            .filter(a => !a.launched || a.launched + a.end > new Date().getTime())

        // build the attacks
        for (const server of this.targetServers) {
            const attack = await this.buildAttack(server)
            if (attack.action !== 'cancelled') {
                this.attacks.push(attack)
            }
        }

        // run the attacks
        for (const attack of this.attacks.filter(a => !a.launched)) {
            //this.ns.tprint(`running ${attack.action} on ${attack.target}`)
            attack.launched = new Date().getTime()
            for (const command of attack.commands) {
                let retry = 5,
                    pid = 0
                for (let i = retry; i > 0; i--) {
                    pid = await this.nsProxy['exec'](...command)
                    if (pid) {
                        break
                    }
                    await this.ns.sleep(100)
                }
                if (!pid) {
                    this.ns.tprint(`WARNING - could not start command: ${JSON.stringify(command)}`)
                }
            }
        }
    }

    /**
     * Build the attack plan
     *
     * @see https://github.com/danielyxie/bitburner/blob/dev/doc/source/advancedgameplay/hackingalgorithms.rst
     * @returns {Promise<{commands: {}, action: string, target: string}|number>}
     */
    async buildAttack(target) {

        // create the attack structure
        const attack = {
            uuid: this.generateUUID(),
            target: target.hostname,
            value: 0,
            delay: 0, // how long before the hack effects the server
            end: 60 * 60 * 1000, // how long before the grow/weaken restore the server
            launched: 0,
            action: 'hack',
            hacks: {},
            commands: [],
        }

        // build the hack list
        // name: {
        //     script:      // target script
        //     ram:         // ram needed (calculated below)
        //     change:      // security change per thread
        //     time:        // time to run
        //     delay:       // delay ensures hacks finish in order (calculated below)
        // }
        for (const [name, _hack] of Object.entries(this.hacks)) {
            attack.hacks[name] = {};
            attack.hacks[name].script = _hack.script
            attack.hacks[name].change = _hack.change
            attack.hacks[name].ram = _hack.ram
            //attack.hacks[name].ram = await this.nsProxy['getScriptRam'](attack.hacks[name].script)
            attack.hacks[name].time = await this.nsProxy[`get${name[0].toUpperCase()}${name.slice(1)}Time`](target.hostname)
            attack.hacks[name].threads = 0
            attack.hacks[name].threadsRemaining = 0
        }
        // expose vars for shorter code below
        const w = attack.hacks['weaken'], g = attack.hacks['grow'], h = attack.hacks['hack']

        // the server values will change after hack, until weaken
        attack.delay = h.time  // delay is 0 if action !== hack, see below
        attack.end = w.time + 5000 // pad the time to avoid overlap

        // check if there is an overlapping attack
        const now = new Date().getTime();
        let hostAttacks = this.attacks
            .filter(a => a.target === target.hostname)
        let currentAttacks = hostAttacks
            .filter(a => a.launched && a.launched + a.delay < now)

        // we can't trust the server data, assume we will be at min security and max money
        if (currentAttacks.length) {
            target.hackDifficulty = target.minDifficulty + settings.minSecurityLevelOffset
            target.moneyAvailable = target.moneyMax * settings.maxMoneyMultiplayer
        }

        // decide which action to perform
        // - if security is not min then action=weaken
        // - elseif money is not max then action=grow
        // - else action=hack
        if (target.hackDifficulty > target.minDifficulty + settings.minSecurityLevelOffset) {
            // security is too high, need to weaken
            attack.action = 'weaken'
            attack.delay = 0
        } else if (target.moneyAvailable < target.moneyMax * settings.maxMoneyMultiplayer) {
            // money is too low, need to grow
            attack.action = 'grow'
            attack.delay = 0
        }

        // check for overlapping attacks
        const currentPrepAttacks = hostAttacks.filter(a => a.action !== 'hack')
        if (currentPrepAttacks.length) {
            // const current = currentPrepAttacks
            //     .map(a => a.action + ' ' + this.formatTime((a.launched + a.delay - now) / 1000) + '-' + this.formatTime((a.launched + a.end - now) / 1000))
            //     .join(' | ')
            // this.ns.tprint(`${target.hostname} ${attack.action} WAIT FOR ${current}`) // need to wait for grow/weaken
            attack.action = 'cancelled'
            return attack
        }
        if (attack.action === 'hack') {
            let overlappingAttacks = hostAttacks
                .filter(a => a.launched)
                .filter(a => (now + attack.delay > a.launched + a.delay && now + attack.delay < a.launched + a.end)
                    || (now + attack.end > a.launched + a.delay && now + attack.end < a.launched + a.end))
            if (overlappingAttacks.length) {
                // const overlaps = overlappingAttacks
                //     .map(a => a.action + ' ' + this.formatTime((a.launched + a.delay - now) / 1000) + '-' + this.formatTime((a.launched + a.end - now) / 1000))
                //     .join(' | ')
                // this.ns.tprint(`${target.hostname} ${attack.action} OVERLAPS ${overlaps}`) // will overlap if we run now
                attack.action = 'cancelled'
                return attack
            }
        }

        // // calculate the maximum threads based on available ram
        // for (const server of this.hackingServers) {
        //     for (const _hack of Object.values(hacks)) {
        //         _hack.threads += Math.floor((server.maxRam - server.ramUsed) / _hack.ram)
        //     }
        // }

        let log = '';
        const hostAttackString = hostAttacks
            .map(a => this.formatDelays(a.launched + a.delay - now, a.launched + a.end - now))
            .join(' + ')

        // build the commands
        switch (attack.action) {

            // spawn threads to WEAKEN the target
            case 'weaken':
                attack.start = now + w.time
                //w.change = await this.nsProxy['weakenAnalyze'](1) // cores matter // 0.05
                w.threads = Math.ceil((target.hackDifficulty - target.minDifficulty) / w.change)
                // while (w.change * w.threads < (target.hackDifficulty - target.minDifficulty)) {
                //     w.threads = Math.ceil(w.threads * 1.2) // try 20% more
                //     w.change = await this.nsProxy['weakenAnalyze'](w.threads) / w.threads  // cores matter
                // }

                log = this.formatTime() + ': ' + [
                    `${target.hostname} WEAKEN`,
                    `w=${w.threads}`,
                    `${this.formatDelays(attack.delay, attack.end)}`,
                    `existing: ${hostAttackString}`
                ].join(' | ')
                this.ns.tprint(log)
                await this.ns.write('/log/attack-servers.txt', log + "\n", 'a')

                w.threadsRemaining = w.threads
                for (const server of this.hackingServers) {
                    let weakenThreadsFittable = Math.max(0, Math.floor((server.maxRam - server.ramUsed) / w.ram))
                    let weakenThreadsToRun = Math.max(0, Math.min(weakenThreadsFittable, w.threadsRemaining))
                    // weaken threads
                    if (weakenThreadsToRun) {
                        //args[0: script, 1: host, 2: threads, 3: target, 4: delay, 5: uuid, 6: stock (ignored), 7: toast]
                        attack.commands.push([w.script, server.hostname, weakenThreadsToRun, target.hostname, 0, attack.uuid, false, false])
                        server.ramUsed += weakenThreadsToRun * w.ram
                        w.threadsRemaining -= weakenThreadsToRun
                    }
                }
                if (w.threadsRemaining) {
                    this.ns.tprint(`WARNING! ${w.threadsRemaining} weaken threads could not be fit`)
                }
                break

            // spawn threads to GROW the target
            case 'grow':
                attack.start = now + g.time
                g.threads = Math.ceil(await this.nsProxy['growthAnalyze'](target.hostname, target.moneyMax / target.moneyAvailable))
                //g.change = await this.nsProxy['growthAnalyzeSecurity'](g.threads) / g.threads // 0.004
                //w.change = await this.nsProxy['weakenAnalyze'](1)  // cores matter // 0.05
                w.threads = Math.ceil((g.threads * g.change) / w.change)
                // while (w.change * w.threads < g.change * g.threads) {
                //     w.threads = Math.ceil(w.threads * 1.2) // try 20% more
                //     w.change = await this.nsProxy['weakenAnalyze'](w.threads) / w.threads  // cores matter
                // }

                log = this.formatTime() + ': ' + [
                    `${target.hostname} GROW`,
                    `g=${g.threads}/w=${w.threads}`,
                    `${this.formatDelays(attack.delay, attack.end)}`,
                    `existing: ${hostAttackString}`
                ].join(' | ')
                this.ns.tprint(log)
                await this.ns.write('/log/attack-servers.txt', log + "\n", 'a')

                g.threadsRemaining = g.threads
                w.threadsRemaining = w.threads
                for (const server of this.hackingServers) {
                    // grow/weaken threads
                    let growThreadsToRun = Math.max(0, g.threadsRemaining)
                    let weakenThreadsToRun = Math.max(0, w.threadsRemaining)
                    let threadsFittable = Math.max(0, Math.floor((server.maxRam - server.ramUsed) / g.ram))
                    if (threadsFittable < growThreadsToRun + weakenThreadsToRun) {
                        const ratio = threadsFittable / (growThreadsToRun + weakenThreadsToRun)
                        growThreadsToRun = Math.floor(growThreadsToRun * ratio)
                        weakenThreadsToRun = Math.floor(weakenThreadsToRun * ratio)
                    }
                    if (growThreadsToRun) {
                        //args[0: script, 1: host, 2: threads, 3: target, 4: delay, 5: uuid, 6: stock, 7: toast]
                        attack.commands.push([g.script, server.hostname, growThreadsToRun, target.hostname, 0, attack.uuid, false, false])
                        server.ramUsed += growThreadsToRun * g.ram
                        g.threadsRemaining -= growThreadsToRun
                    }
                    if (weakenThreadsToRun) {
                        //args[0: script, 1: host, 2: threads, 3: target, 4: delay, 5: uuid, 6: stock (ignored), 7: toast]
                        attack.commands.push([w.script, server.hostname, weakenThreadsToRun, target.hostname, 0, attack.uuid, false, false])
                        server.ramUsed += weakenThreadsToRun * w.ram
                        w.threadsRemaining -= weakenThreadsToRun
                    }
                }
                if (g.threadsRemaining) {
                    this.ns.tprint(`WARNING! ${g.threadsRemaining} grow threads could not be fit`)
                }
                if (w.threadsRemaining) {
                    this.ns.tprint(`WARNING! ${w.threadsRemaining} weaken threads could not be fit`)
                }
                break

            // spawn threads to HACK the target
            case 'hack':
                if (!currentAttacks.length) {
                    // note - if we have a current hack, this will be wrong because the grow/weaken isnt complete
                    h.threads = Math.ceil(await this.nsProxy['hackAnalyzeThreads'](target.hostname, target.moneyAvailable * settings.hackPercent))
                    const hackedPercent = await this.nsProxy['hackAnalyze'](target.hostname) * h.threads
                    g.threads = Math.ceil(await this.nsProxy['growthAnalyze'](target.hostname, 1 / (1 - hackedPercent)))
                    //g.threads = Math.ceil(await this.nsProxy['growthAnalyze'](target.hostname, 1 / (1 - settings.hackPercent)))
                    w.threads = Math.ceil(h.threads * (h.change / w.change)) + Math.ceil(g.threads * (g.change / w.change)) // threads to weaken security after hack/grow
                    attack.value = target.moneyAvailable * hackedPercent

                    // h.threads = Math.ceil(await this.nsProxy['hackAnalyzeThreads'](target.hostname, target.moneyAvailable * settings.hackPercent))
                    // g.threads = Math.ceil(await this.nsProxy['growthAnalyze'](target.hostname, 1 / (1 - await this.nsProxy['hackAnalyze'](target.hostname) * h.threads))) // cores matter
                    //g.threads = Math.ceil(await this.nsProxy['growthAnalyze'](target.hostname, 1 / (1 - settings.hackPercent)))
                    //g.threads = Math.ceil(await this.nsProxy['growthAnalyze'](target.hostname, target.moneyMax / target.moneyAvailable))
                    //server growth = min(1 + 0.03 / d, 1.0035) ^ (threads * (g / 100) * h)
                    //w.change = await this.nsProxy['weakenAnalyze'](1)  // cores matter // 0.05
                    //w.threads = Math.ceil(h.threads * (h.change / w.change)) + Math.ceil(g.threads * (g.change / w.change)) // threads to weaken security after hack/grow
                    // while (w.change * w.threads < (h.change * h.threads) + (g.change * g.threads)) {
                    //     w.threads = Math.ceil(w.threads * 1.2) // try 20% more
                    //     w.change = await this.nsProxy['weakenAnalyze'](w.threads) / w.threads  // cores matter
                    // }

                } else {
                    const currentHackAttacks = currentAttacks.filter(a => a.action === 'hack')
                    if (currentHackAttacks.length) {
                        let currentHackAttack = currentHackAttacks.pop()
                        attack.value = currentHackAttack.value
                        h.threads = currentHackAttack.hacks['hack'].threads
                        g.threads = currentHackAttack.hacks['grow'].threads
                        w.threads = currentHackAttack.hacks['weaken'].threads
                    } else {
                        throw `something went wrong, we detected a current hack, but it is not in the list...`
                    }
                }

                log = this.formatTime() + ': ' + [
                    `${target.hostname} HACK`,
                    `h=${h.threads}/g=${g.threads}/w=${w.threads}`,
                    `${this.formatDelays(attack.delay, attack.end)}`,
                    `${this.ns.nFormat(attack.value, '$0.0a')}`,
                    `existing: ${hostAttackString}`
                ].join(' | ')
                this.ns.tprint(log)
                await this.ns.write('/log/attack-servers.txt', log + "\n", 'a')

                h.threadsRemaining = h.threads
                g.threadsRemaining = g.threads
                w.threadsRemaining = w.threads
                // calculate the delay required for all threads to end at the right time
                //g.delay = Math.max(0, w.time - g.time + 5000)
                //h.delay = Math.max(0, g.time + g.delay - h.time + 5000)
                for (const server of this.hackingServers) {
                    // hack threads
                    let threadsFittable = Math.max(0, Math.floor((server.maxRam - server.ramUsed) / h.ram))
                    const hackThreadsToRun = Math.max(0, Math.min(threadsFittable, h.threadsRemaining))
                    if (hackThreadsToRun) {
                        //args[0: script, 1: host, 2: threads, 3: target, 4: delay, 5: uuid, 6: stock, 7: toast]
                        attack.commands.push([h.script, server.hostname, hackThreadsToRun, target.hostname, 0, attack.uuid, false, false])
                        h.threadsRemaining -= hackThreadsToRun
                        server.ramUsed += hackThreadsToRun * h.ram
                    }
                    // grow/weaken threads
                    let growThreadsToRun = Math.max(0, g.threadsRemaining)
                    let weakenThreadsToRun = Math.max(0, w.threadsRemaining)
                    threadsFittable = Math.max(0, Math.floor((server.maxRam - server.ramUsed) / g.ram))
                    if (threadsFittable < growThreadsToRun + weakenThreadsToRun) {
                        const ratio = threadsFittable / (growThreadsToRun + weakenThreadsToRun)
                        growThreadsToRun = Math.floor(growThreadsToRun * ratio)
                        weakenThreadsToRun = Math.floor(weakenThreadsToRun * ratio)
                    }
                    if (growThreadsToRun) {
                        //args[0: script, 1: host, 2: threads, 3: target, 4: delay, 5: uuid, 6: stock, 7: toast]
                        attack.commands.push([g.script, server.hostname, growThreadsToRun, target.hostname, 0, attack.uuid, false, false])
                        g.threadsRemaining -= growThreadsToRun
                        server.ramUsed += growThreadsToRun * g.ram
                    }
                    if (weakenThreadsToRun) {
                        //args[0: script, 1: host, 2: threads, 3: target, 4: delay, 5: uuid, 6: stock (ignored), 7: toast]
                        attack.commands.push([w.script, server.hostname, weakenThreadsToRun, target.hostname, 0, attack.uuid, false, false])
                        w.threadsRemaining -= weakenThreadsToRun
                        server.ramUsed += weakenThreadsToRun * w.ram
                    }
                }
                if (h.threadsRemaining) {
                    this.ns.tprint(`WARNING! ${h.threadsRemaining} hack threads could not be fit`)
                }
                if (g.threadsRemaining) {
                    this.ns.tprint(`WARNING! ${g.threadsRemaining} grow threads could not be fit`)
                }
                if (w.threadsRemaining) {
                    this.ns.tprint(`WARNING! ${w.threadsRemaining} weaken threads could not be fit`)
                }
                break

        }

        return attack
    }

    /**
     * Report for the attack.
     *
     * @returns {string}
     */
    getReport() {
        return this.attacks
        //
        // const bestTarget = this.targetServers[0]
        // const hacks = this.hacks,
        //     w = hacks['weaken'],
        //     g = hacks['grow'],
        //     h = hacks['hack']
        // const report = [
        //     '======================',
        //     `|| 🖧 Attack Server ||`,
        //     '======================',
        //     '',
        //     `Best target is ${bestTarget.hostname} for ${this.ns.nFormat(bestTarget.hackValue, '$0.0a')}:`,
        //     ` -> Hack Value: ???`, // todo how we get the hackValue
        //     ` -> Security: ${this.ns.nFormat(bestTarget.hackDifficulty, '0.0000a')} / ${bestTarget.minDifficulty}`,
        //     ` -> Money: ${this.ns.nFormat(bestTarget.moneyAvailable, '$0.0a')} / ${this.ns.nFormat(bestTarget.moneyMax, '$0.0a')}`,
        //     ` -> Security Change: hack +${h.change} | grow +${g.change} | weaken -${w.change}`,
        //     ` -> Money Growth: hack -??? | grow +${this.ns.nFormat(bestTarget.serverGrowth, '$0.0a')}`,
        //     ` -> Max Threads (for available RAM): weaken ${w.maxThreads} | grow ${g.maxThreads} | hack ${h.maxThreads}`,
        //     ` -> Threads Needed (for attack): weaken ${bestTarget.fullWeakenThreads} | grow ${bestTarget.fullGrowThreads} | hack ${bestTarget.fullHackThreads}`,
        //     '',
        //     'Attack:',
        //     ` -> Action: ${this.action}`,
        //     ` -> Duration: ${this.formatTime(w.time/1000)}`,
        //     ` -> Memory: ${this.ns.nFormat(h.runThreads * h.ram + g.runThreads * g.ram + w.runThreads * w.ram, '0.00')}GB`,
        //     ` -> Threads Run: hack ${h.runThreads} | grow ${g.runThreads} | weaken ${w.runThreads}`,
        // ]
        // if (this.attacks.length) {
        //     report.push('')
        //     report.push('Attacks Launched:')
        //     for (const a of this.attacks) {
        //         //args[0: script, 1: host, 2: threads, 3: target, 4: delay, 5: uuid, 6: stock]
        //         const baseUrl = `hbbp://${a[1]}${a[0].substr(0, 1) === '/' ? '' : '/'}${a[0]}?`
        //         const params = [
        //             `threads=${a[2]}`,
        //             `target=${a[3]}`,
        //         ]
        //         if (a[4]) params.push(`delay=${Math.round(a[4] * 1000) / 1000}`)
        //         if (a[5]) params.push(`uuid=${a[5]}`)
        //         if (a[6]) params.push(`stock=${a[6]}`)
        //         report.push(' -> ' + baseUrl + params.join('&'))
        //     }
        // }
        //
        // // glue it together
        // return "\n\n" + report.join("\n") + "\n\n\n"
    }

    /**
     * Loads the player information.
     *
     * @returns {Promise<*[]>}
     */
    async loadPlayer() {
        this.player = await this.nsProxy['getPlayer']()
    }

    /**
     * Loads a list of servers in the network.
     *
     * @returns {Promise<*[]>}
     */
    async loadServers() {

        // get servers in network
        this.servers = []
        const spider = ['home']
        // run until the spider array is empty
        while (spider.length > 0) {
            const hostname = spider.pop()
            // for all the connected hosts
            for (const scannedHostName of await this.nsProxy['scan'](hostname)) {
                // if they are not in the list
                if (this.servers.filter(s => s.hostname === scannedHostName).length === 0) {
                    // add them to the spider list
                    spider.push(scannedHostName)
                }
            }
            // get the server info
            const server = await this.nsProxy['getServer'](hostname)
            // reserve memory on home
            if (server.hostname === 'home') {
                server.ramUsed = Math.min(server.ramUsed + settings.reservedHomeRam, server.maxRam)
            }
            // add this server to the list
            this.servers.push(server)
        }

        // get hacking servers (servers we can use to run scripts)
        this.hackingServers = this.servers
            // exclude hacknet-
            .filter(s => !s.hostname.includes('hacknet') && !s.hostname.includes('darkweb'))
            // include servers with root access
            .filter(s => s.hasAdminRights)
        this.hackingServers = this.hackingServers.sort((a, b) => b.maxRam - a.maxRam)

        // get target servers (servers to attack)
        this.targetServers = this.servers
            // exclude home/hacknet-/homenet-
            .filter(s => s.hostname !== 'home'
                && !s.hostname.includes('hacknet')
                && !s.hostname.includes('darkweb')
                && !s.hostname.includes(settings.purchasedServerPrefix))
            // include servers with root access
            .filter(s => s.hasAdminRights)
            // include servers with money
            .filter(s => s.moneyMax > 0)
        // get some more info about the servers
        for (const server of this.targetServers) {
            // todo, should consider serverGrowth
            // todo, should consider earlygame when we dont have many threads
            server.hackValue = server.moneyMax * (settings.minSecurityWeight / (server.minDifficulty + server.hackDifficulty))
        }
        // get servers in order of hack value
        this.targetServers = this.targetServers.sort((a, b) => b.hackValue - a.hackValue)
    }

    /**
     * Format a delay and end time
     *
     * @param delay time in milliseconds
     * @param end time in milliseconds
     * @returns {string}
     */
    formatDelays(delay, end) {
        return this.formatDelay(delay) + '-' + this.formatDelay(end)
    }

    /**
     * Format a delay in MM:SS
     * Allows negative times (nsFormat didn't work)
     *
     * @param value time in milliseconds
     * @returns {string}
     */
    formatDelay(value) {
        value = value / 1000
        let hours = Math.floor(Math.abs(value) / 60 / 60),
            minutes = Math.floor((Math.abs(value) - (hours * 60 * 60)) / 60),
            seconds = Math.round(Math.abs(value) - (hours * 60 * 60) - (minutes * 60));
        return (value < 0 ? '-' : '')
            + (hours ? hours + ':' : '')
            + minutes
            + ':' + (seconds < 10 ? '0' + seconds : seconds);
    }

    /**
     * Format a locale time in HH:MM:SS
     *
     * @param value time in milliseconds
     * @returns {string}
     */
    formatTime(value = 0) {
        if (!value) {
            value = new Date().getTime()
        }
        return new Date(value).toLocaleTimeString()
    }

    /**
     * Generate a UUIDv4 string
     * @returns {string}
     */
    generateUUID() {
        let dt = new Date().getTime()
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
            let r = (dt + Math.random() * 16) % 16 | 0
            dt = Math.floor(dt / 16)
            return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
        })
    }

    /**
     * Help text
     *
     * Player boss is stuck, let's get them some help.
     *
     * @returns {string}
     */
    getHelp() {
        return [
            '',
            '',
            'Launch a hack attack for profit.',
            '',
            `USAGE: run ${this.ns.getScriptName()}`,
            '',
            'Example:',
            `> run ${this.ns.getScriptName()}`,
            '',
            '',
        ].join("\n")
    }

}