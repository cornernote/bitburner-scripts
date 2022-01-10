import {Runner} from "./lib/Runner.js"
import {settings} from "./_settings.js"

/**
 * Command options
 */
const argsSchema = [
    ['loop', false],
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
    // load job module
    const attackServer = new AttackServer(ns, runner.nsProxy)
    // print help
    if (args.help) {
        ns.tprint(attackServer.getHelp())
        ns.exit()
    }
    // get ready
    do {
        // work, sleep, repeat
        await attackServer.doJob()
        await ns.sleep(10)
    } while (args.loop)
}

// fake method to count towards memory usage, used by nsProxy
function countedTowardsMemory(ns) {
    ns.run()
    ns.isRunning(0)
}


/**
 * AttackServer
 *
 * Launch a hack attack for profit.
 */
export class AttackServer {

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
        },
        grow: {
            script: '/hacks/grow.js',
            change: 0.004,
        },
        hack: {
            script: '/hacks/hack.js',
            change: 0.002,
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
        this.ns.tprint('AttackServer...')
        // run the attacks
        await this.attackServers()
        // set the last run time
        this.lastRun = new Date().getTime()
        // display the report
        this.ns.tprint(this.getReport())
    }

    /**
     * Build and run attacks
     *
     * @returns {Promise<void>}
     */
    async attackServers() {
        await this.loadPlayer()
        await this.loadServers()

        // build the attacks
        for (const server of this.targetServers) {
            const attack = await this.buildAttack(server)
            // if (!attack.commands.length) {
            //     this.ns.tprint(`ended on ${server.hostname}`)
            //     break
            // }
            this.attacks.push(attack)
        }

        // run the attacks
        for (const attack of this.attacks) {
            for (const command of attack.commands) {
                await this.nsProxy['exec'](...command)
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
            target: target.hostname,
            start: new Date().getTime(), // default, now
            end: new Date().getTime() + 60 * 60 * 1000, // default, 60 mins
            action: 'hack',
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
        const hacks = {}
        for (const [name, _hack] of Object.entries(this.hacks)) {
            hacks[name] = {};
            hacks[name].script = _hack.script
            hacks[name].time = await this.nsProxy[`get${name[0].toUpperCase()}${name.slice(1)}Time`](target.hostname)
            hacks[name].ram = await this.nsProxy['getScriptRam'](hacks[name].script)
            hacks[name].threads = 0
        }
        // expose vars for shorter code below
        const w = hacks['weaken'], g = hacks['grow'], h = hacks['hack']

        // the server values will change between these times, avoid overlapping attacks
        attack.start = new Date().getTime() + h.time
        attack.end = new Date().getTime() + w.time


        // check if there is an overlapping attack
        const overlappingAttacks = this.attacks
            .filter(a => a.target === target.hostname && attack.start < a.end)
        if (overlappingAttacks.length) {
            this.ns.tprint('Overlapping Attacks...')
            this.ns.tprint(overlappingAttacks)
            attack.type = 'cancelled'
            return attack
        }


        // decide which action to perform
        // - if security is not min then action=weaken
        // - elseif money is not max then action=grow
        // - else action=hack
        if (target.hackDifficulty > target.minDifficulty + settings.minSecurityLevelOffset) {
            // security is too high, need to weaken
            attack.action = 'weaken'
        } else if (target.moneyAvailable < target.moneyMax * settings.maxMoneyMultiplayer) {
            // money is too low, need to grow
            attack.action = 'grow'
        }

        // calculate the maximum threads based on available ram
        for (const server of this.hackingServers) {
            for (const _hack of Object.values(hacks)) {
                _hack.threads += Math.floor((server.maxRam - server.ramUsed) / _hack.ram)
            }
        }

        // build the commands
        switch (attack.action) {

            // spawn threads to WEAKEN the target
            case 'weaken':
                w.threads = Math.min(w.threads, Math.ceil((target.hackDifficulty - target.minDifficulty) / w.change)) // cores matter)
                for (const server of this.hackingServers) {
                    let weakenThreadsFittable = Math.max(0, Math.floor((server.maxRam - server.ramUsed) / w.ram))
                    let weakenThreadsToRun = Math.max(0, Math.min(weakenThreadsFittable, w.threads))
                    // weaken threads
                    if (weakenThreadsToRun) {
                        //args[0: script, 1: host, 2: threads, 3: target, 4: delay, 5: uuid, 6: stock (ignored)]
                        attack.commands.push([w.script, server.hostname, weakenThreadsToRun, target.hostname, 0])
                        server.ramUsed += weakenThreadsToRun * w.ram
                        w.threads -= weakenThreadsToRun
                    }
                }
                break

            // spawn threads to GROW the target
            case 'grow':
                g.threads = Math.min(g.threads, Math.ceil(await this.nsProxy['growthAnalyze'](target.hostname, target.moneyMax / target.moneyAvailable)))
                w.threads = Math.ceil(g.threads * (g.change / w.change)) // threads to weaken security after grow
                for (const server of this.hackingServers) {
                    // grow/weaken threads
                    let growThreadsToRun = Math.max(0, g.threads)
                    let weakenThreadsToRun = Math.max(0, w.threads)
                    let threadsFittable = Math.max(0, Math.floor((server.maxRam - server.ramUsed) / g.ram))
                    if (threadsFittable < growThreadsToRun + weakenThreadsToRun) {
                        const ratio = threadsFittable / (growThreadsToRun + weakenThreadsToRun)
                        growThreadsToRun = Math.floor(growThreadsToRun * ratio)
                        weakenThreadsToRun = Math.floor(weakenThreadsToRun * ratio)
                    }
                    if (growThreadsToRun) {
                        //args[0: script, 1: host, 2: threads, 3: target, 4: delay, 5: uuid, 6: stock]
                        attack.commands.push([g.script, server.hostname, growThreadsToRun, target.hostname, 0])
                        server.ramUsed += weakenThreadsToRun * g.ram
                        g.threads -= growThreadsToRun
                    }
                    if (weakenThreadsToRun) {
                        //args[0: script, 1: host, 2: threads, 3: target, 4: delay, 5: uuid, 6: stock (ignored)]
                        attack.commands.push([w.script, server.hostname, weakenThreadsToRun, target.hostname, 0])
                        server.ramUsed += weakenThreadsToRun * w.ram
                        w.threads -= weakenThreadsToRun
                    }
                }
                break

            // spawn threads to HACK the target
            case 'hack':
                const hackPercent = 0.2
                h.threads = Math.ceil(await this.nsProxy['hackAnalyzeThreads'](target.hostname, target.moneyMax * hackPercent))
                g.threads = Math.ceil(await this.nsProxy['growthAnalyze'](target.hostname, 1 / (1 - hackPercent))) // cores matter
                w.threads = Math.ceil(h.threads * (h.change / w.change)) + Math.ceil(g.threads * (g.change / w.change)) // threads to weaken security after hack/grow
                // calculate the delay required for all threads to end at the right time
                //g.delay = Math.max(0, w.time - g.time + 5000)
                //h.delay = Math.max(0, g.time + g.delay - h.time + 5000)
                for (const server of this.hackingServers) {
                    // hack threads
                    let threadsFittable = Math.max(0, Math.floor((server.maxRam - server.ramUsed) / h.ram))
                    const hackThreadsToRun = Math.max(0, Math.min(threadsFittable, h.threads))
                    if (hackThreadsToRun) {
                        //args[0: script, 1: host, 2: threads, 3: target, 4: delay, 5: uuid, 6: stock]
                        attack.commands.push([h.script, server.hostname, hackThreadsToRun, target.hostname, h.delay])
                        h.threads -= hackThreadsToRun
                        server.ramUsed += hackThreadsToRun * h.ram
                    }
                    // grow/weaken threads
                    let growThreadsToRun = Math.max(0, g.threads)
                    let weakenThreadsToRun = Math.max(0, w.threads)
                    threadsFittable = Math.max(0, Math.floor((server.maxRam - server.ramUsed) / g.ram))
                    if (threadsFittable < growThreadsToRun + weakenThreadsToRun) {
                        const ratio = threadsFittable / (growThreadsToRun + weakenThreadsToRun)
                        growThreadsToRun = Math.floor(growThreadsToRun * ratio)
                        weakenThreadsToRun = Math.floor(weakenThreadsToRun * ratio)
                    }
                    if (growThreadsToRun) {
                        //args[0: script, 1: host, 2: threads, 3: target, 4: delay, 5: uuid, 6: stock]
                        attack.commands.push([g.script, server.hostname, growThreadsToRun, target.hostname, g.delay])
                        g.threads -= growThreadsToRun
                        server.ramUsed += growThreadsToRun * g.ram
                    }
                    if (weakenThreadsToRun) {
                        //args[0: script, 1: host, 2: threads, 3: target, 4: delay, 5: uuid, 6: stock (ignored)]
                        attack.commands.push([w.script, server.hostname, weakenThreadsToRun, target.hostname, w.delay])
                        w.threads -= weakenThreadsToRun
                        server.ramUsed += weakenThreadsToRun * w.ram
                    }
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
        //     ` -> Duration: ${this.ns.nFormat(w.time, '00:00:00')}`,
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
        // todo, order this list by mem (max first)
        this.hackingServers = this.servers
            // exclude hacknet-
            .filter(s => !s.hostname.includes('hacknet') && !s.hostname.includes('darkweb'))
            // include servers with root access
            .filter(s => s.hasAdminRights)

        // get target servers (servers to attack)
        this.targetServers = this.servers
            // exclude home/hacknet-/homenet-
            .filter(s => s.hostname !== 'home'
                && !s.hostname.includes('hacknet')
                && !s.hostname.includes('darkweb')
                && !s.hostname.includes(settings.purchasedServerPrefix))
            // include servers with root access
            .filter(s => s.hasAdminRights)
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