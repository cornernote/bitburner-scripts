import {Runner} from "/lib/Runner"

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
    const worker = new Worker(ns, runner)
    // print help
    if (args.help) {
        ns.tprint(worker.getHelp())
        ns.exit()
    }
    // get ready
    do {
        // work, sleep, repeat
        await worker.doWork()
        await ns.sleep(10)
    } while (args.loop)
}

/**
 * Worker
 *
 * Manages the game for the player boss.
 */
export class Worker {

    /**
     * SysAdmin settings
     * @type {Object}
     */
    settings = {

        // reserved memory on home
        // used to run the daemon and background runners
        reservedHomeRam: 1.6 + 10, // 1.6 for a background script, plus the max ram function used

        // the prefix given to purchased servers
        purchasedServerPrefix: 'homenet-',

        // used to calculate hack value
        // hackValue = server.moneyMax * (settings.minSecurityWeight / (server.minSecurityLevel + server.securityLevel))
        minSecurityWeight: 100,

        // used to decide if hack action=weaken
        // if (bestTarget.securityLevel > bestTarget.minSecurityLevel + settings.minSecurityLevelOffset) action = 'weaken'
        minSecurityLevelOffset: 1,

        // used to decide if hack action=grow
        // if (bestTarget.money < bestTarget.moneyMax * settings.maxMoneyMultiplayer) action = 'grow'
        maxMoneyMultiplayer: 0.9,

        // how often to run rootServers()
        rootServersInterval: 60 * 5 * 1000, // 5mins
    }

    /**
     * The BitBurner instance
     * @type {NS}
     */
    ns

    /**
     * The Runner instance
     * @type {Runner}
     */
    runner

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
     * Server data, containing servers we own (home and purchased)
     * @type {Server[]}
     */
    myServers

    /**
     * Server data, containing servers rooted this run
     * @type {Server[]}
     */
    newlyRootedServers

    /**
     * The time we last ran rootServers()
     * @type {Number}
     */
    lastRootedServers

    /**
     * Server data, containing servers which are rootable
     * @type {Server[]}
     */
    rootableServers

    /**
     * Server data, containing servers with root access
     * @type {Server[]}
     */
    rootedServers

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
     * List of port hacks that are used to root servers
     * @type {Array}
     */
    portHacks

    /**
     * List of port hacks that have been unlocked
     * @type {Array}
     */
    ownedPortHacks

    /**
     * List of hacks that are used to attack servers
     * @type {Object}
     */
    hacks

    /**
     * Information about the action taken for the cycle.
     * @type {String}
     */
    action

    /**
     * Security change for this cycle
     * @type {String}
     */
    securityChangeLog

    /**
     * List of attacks we will be running to hack servers
     * @type {Array}
     */
    attacks

    /**
     * The timestamp when the current attack will end
     * @type {Number}
     */
    attackEndsAt = 1

    /**
     * Construct the class
     *
     * @param {NS} ns - the NS instance passed into the scripts main() entry method
     * @param {Runner} runner - the runner object
     * @param {Object} config - key/value pairs used to set object properties
     */
    constructor(ns, runner, config = {}) {
        this.ns = ns
        this.runner = runner
        // allow override of properties in this class
        Object.entries(config).forEach(([key, value]) => this[key] = value)
    }

    /**
     * The main loop.
     *
     * @returns {Promise<void>}
     */
    async doWork() {
        // root some servers
        await this.rootServers()
        // hack for profit
        await this.attackServer()
    }

    /**
     * Loads the player information.
     *
     * @returns {Promise<*[]>}
     */
    async loadPlayer() {
        this.player = await this.runner.nsProxy['getPlayer']()
    }

    /**
     * Loads a list of port hacks.
     *
     * @returns {Promise<*[]>}
     */
    async loadPortHacks() {
        // load port hacks
        this.portHacks = []
        const cracks = {
            brutessh: 'BruteSSH.exe',
            ftpcrack: 'FTPCrack.exe',
            relaysmtp: 'relaySMTP.exe',
            httpworm: 'HTTPWorm.exe',
            sqlinject: 'SQLInject.exe',
            // nuke: 'NUKE.exe', // not a port hack
        }
        for (const [method, exe] of Object.entries(cracks)) {
            this.portHacks.push({
                method: method,
                exe: exe,
                owned: await this.runner.nsProxy['fileExists'](exe, 'home'),
            })
        }
        // the ones we own
        this.ownedPortHacks = this.portHacks
            .filter(a => a.owned)
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
            for (const scannedHostName of await this.runner.nsProxy['scan'](hostname)) {
                // if they are not in the list
                if (this.servers.filter(s => s.hostname === scannedHostName).length === 0) {
                    // add them to the spider list
                    spider.push(scannedHostName)
                }
            }
            // get the server info
            const server = await this.runner.nsProxy['getServer'](hostname)
            // reserve memory on home
            if (server.hostname === 'home') {
                server.ramUsed = Math.min(server.ramUsed + this.settings.reservedHomeRam, server.maxRam)
            }
            // add this server to the list
            this.servers.push(server)
        }

        // get my servers
        this.myServers = this.servers
            // exclude home/hacknet-/homenet-
            .filter(s => s.hostname === 'home' || s.hostname.includes('hacknet-') || s.hostname.includes(this.settings.purchasedServerPrefix))

        // get rootable servers
        this.rootableServers = this.servers
            // exclude servers with root access
            .filter(s => !s.hasAdminRights)
            // include servers within hacking level and where we own enough port hacks
            .filter(s => s.requiredHackingSkill <= this.player.hacking && s.numOpenPortsRequired <= this.ownedPortHacks.length)

        // get rooted servers
        this.rootedServers = this.servers
            // exclude home/hacknet-/homenet-
            .filter(s => s.hostname !== 'home' && !s.hostname.includes('hacknet-') && !s.hostname.includes(this.settings.purchasedServerPrefix))
            // include servers with root access
            .filter(s => s.hasAdminRights)

        // get hacking servers (servers we can use to run scripts)
        // todo, order this list by mem (max first)
        this.hackingServers = this.servers
            // exclude hacknet-
            .filter(s => !s.hostname.includes('hacknet-'))
            // include servers with root access
            .filter(s => s.hasAdminRights)

        // get servers in order of hack value
        this.targetServers = []
        for (const server of this.rootedServers) {
            // get some more info about the servers
            server.analyzeHack = await this.runner.nsProxy['hackAnalyze'](server.hostname)
            server.securityLevel = await this.runner.nsProxy['getServerSecurityLevel'](server.hostname)
            server.minSecurityLevel = await this.runner.nsProxy['getServerMinSecurityLevel'](server.hostname)
            server.fullGrowThreads = server.moneyAvailable ? await this.runner.nsProxy['growthAnalyze'](server.hostname, server.moneyMax / server.moneyAvailable) : null
            server.fullHackThreads = Math.ceil(100 / Math.max(0.00000001, server.analyzeHack))
            server.hackValue = server.moneyMax * (this.settings.minSecurityWeight / (server.minSecurityLevel + server.securityLevel))
            this.targetServers.push(server)
        }
        this.targetServers.sort((a, b) => b.hackValue - a.hackValue)

        // load the hacks each time after servers are loaded
        await this.loadHacks()
    }

    /**
     * Loads a list of hacks
     *
     * @returns {Promise<*[]>}
     */
    async loadHacks() {
        // build the hack list
        this.hacks = {
            // name: {
            //     script:      // target script
            //     ram:         // ram needed (calculated below)
            //     time:        // time to run
            //     delay:       // delay ensures hacks finish in order (calculated below)
            //     maxThreads:  // the max threads that can be run on our ram (calculated below)
            //     threads:     // the remaining threads to run (calculated during loadAttacks)
            //     change:      // security change per thread
            // }
            weaken: {
                script: '/hacks/weaken.js',
                ram: 0,
                time: 0,
                delay: 0,
                maxThreads: 0,
                threads: 0,
                runThreads: 0,
                change: 0.05,
            },
            grow: {
                script: '/hacks/grow.js',
                ram: 0,
                time: 0,
                delay: 0,
                maxThreads: 0,
                threads: 0,
                runThreads: 0,
                change: 0.004,
            },
            hack: {
                script: '/hacks/hack.js',
                ram: 0,
                time: 0,
                delay: 0,
                maxThreads: 0,
                threads: 0,
                runThreads: 0,
                change: 0.002,
            },
        }
        // expose vars for shorter code below
        const bestTarget = this.targetServers[0]
        const hacks = this.hacks,
            w = hacks['weaken'],
            g = hacks['grow'],
            h = hacks['hack']
        // calculate the ram needed
        for (const [name, _hack] of Object.entries(hacks)) {
            if (bestTarget) {
                _hack.time = await this.runner.nsProxy[`get${name[0].toUpperCase()}${name.slice(1)}Time`](bestTarget.hostname) / 1000 // getGrowTime
            }
            _hack.ram = await this.runner.nsProxy['getScriptRam'](_hack.script)
        }
        // calculate the maximum threads based on available ram
        for (const server of this.hackingServers) {
            for (const _hack of Object.values(hacks)) {
                _hack.maxThreads += Math.floor((server.maxRam - server.ramUsed) / _hack.ram)
            }
        }
        // calculate the delay required for all threads to end at the right time
        g.delay = Math.max(0, w.time - g.time - 20)
        h.delay = Math.max(0, g.time + g.delay - h.time - 20)
    }

    /**
     * Gain root access on any available servers.
     *
     * @returns {Promise<void>}
     */
    async rootServers() {
        // check if we need to run
        if (this.lastRootedServers + this.settings.rootServersInterval > new Date().getTime()) {
            return
        }
        this.ns.tprint('rootServers()...')
        // refresh data
        await this.loadPlayer();
        await this.loadPortHacks()
        await this.loadServers();
        // reset the list
        this.newlyRootedServers = []
        // run owned port hacks on rootable servers
        if (this.rootableServers.length) {
            for (const server of this.rootableServers) {
                // run port hacks
                for (const portHack of this.ownedPortHacks) {
                    await this.runner.nsProxy[portHack.method](server.hostname)
                }
                // run nuke
                await this.runner.nsProxy['nuke'](server.hostname)
                // copy hack scripts
                await this.runner.nsProxy['scp'](Object.values(this.hacks).map(h => h.script), server.hostname)
                // add to list
                this.newlyRootedServers.push(server)
            }
            if (this.newlyRootedServers.length) {
                await this.loadServers()
            }
        }
        // set the last run time
        this.lastRootedServers = new Date().getTime()
        // display the report
        this.ns.tprint(this.getRootServersReport())
    }

    /**
     * Report for the attack.
     *
     * @returns {string}
     */
    getRootServersReport() {
        const ram = {
            total: this.hackingServers.map(s => s.maxRam).reduce((prev, next) => prev + next),
            used: this.hackingServers.map(s => s.ramUsed).reduce((prev, next) => prev + next),
        }
        const report = [
            '',
            '',
            '=====================',
            `|| 🖥 Root Servers ||`,
            '=====================',
            '',
            `${this.servers.length} servers found in the network:`,
            ` -> ${this.servers.map(s => s.hostname).join(', ')}`,
            '',
            `${this.myServers.length} servers are mine:`,
            ` -> ${this.myServers.map(s => s.hostname + ' = ' + s.ramUsed + '/' + s.maxRam + 'GB used').join(', ')}`,
            '',
            `${this.targetServers.length} servers have root access:`,
            ` -> ${this.targetServers.map(s => s.hostname + ' = ' + this.ns.nFormat(s.hackValue, '$0.0a') + ' | ' + s.ramUsed + '/' + s.maxRam + 'GB used').join(', ')}`,
            '',
            `Memory Usage`,
            ` -> ${this.ns.nFormat(ram.used / ram.total, '0%')} - ${ram.used}GB/${ram.total}GB`,
        ]
        if (this.rootableServers.length) {
            report.push('')
            report.push(`${this.rootableServers.length} servers are within hacking level (${this.player.hacking})`)
            report.push(` -> ${this.rootableServers.map(s => s.hostname).join(', ')}`)
        }
        if (this.newlyRootedServers.length) {
            report.push('')
            report.push(`${this.newlyRootedServers.length} have been rooted!!`)
            report.push(` -> ${this.newlyRootedServers.map(s => s.hostname).join(', ')}`)
        }

        return "\n\n" + report.join("\n") + "\n\n\n"
    }

    /**
     * Load the attack plan
     *
     * @see https://github.com/danielyxie/bitburner/blob/dev/doc/source/advancedgameplay/hackingalgorithms.rst
     * @returns {Promise<void>}
     */
    async loadAttacks() {
        const bestTarget = this.targetServers[0]

        // decide which action to perform
        // - if security is not min then action=weaken
        // - elseif money is not max then action=hack
        // - else action=hack
        this.action = 'hack' // standard attack
        if (bestTarget.securityLevel > bestTarget.minSecurityLevel + this.settings.minSecurityLevelOffset) {
            // security is too high, need to weaken
            this.action = 'weaken'
        } else if (bestTarget.moneyAvailable < bestTarget.moneyMax * this.settings.maxMoneyMultiplayer) {
            // money is too low, need to grow
            this.action = 'grow'
        }

        // calculate hacks time and number of threads we can run
        const hacks = this.hacks,
            w = hacks['weaken'],
            g = hacks['grow'],
            h = hacks['hack']

        // helper, calculates how many weaken threads are needed for countering a grow/hack
        const w4 = {
            g(growThreads) {
                return Math.max(0, Math.ceil(growThreads * (g.change / w.change)))
            },
            h(hackThreads) {
                return Math.max(0, Math.ceil(hackThreads * (h.change / w.change)))
            },
        }

        // build the attacks
        this.attacks = []
        w.threads = w.maxThreads
        g.threads = g.maxThreads
        h.threads = h.maxThreads
        this.securityChangeLog = ''
        switch (this.action) {

            // spawn threads to WEAKEN the target
            case 'weaken':
                // if there are more weaken threads than needed to lower the security
                const requiredSecurityChange = bestTarget.securityLevel - bestTarget.minSecurityLevel
                if (w.change * w.threads > requiredSecurityChange) {
                    // limit weaken threads
                    w.threads = Math.ceil(requiredSecurityChange / w.change)
                    // assign threads from weaken to grow
                    g.threads = Math.max(0, g.threads - w.threads)
                    w.threads += w4.g(g.threads)
                    g.threads = Math.max(0, g.threads - w4.g(g.threads))
                } else {
                    g.threads = 0
                }
                // log and assign threads
                w.runThreads = w.threads
                g.runThreads = g.threads
                this.securityChangeLog = `security change: ${Math.floor((g.change * g.threads - w.change * w.threads) * 1000) / 1000}`
                for (const server of this.hackingServers) {
                    let threadsFittable = Math.max(0, Math.floor((server.maxRam - server.ramUsed) / w.ram))
                    const growThreadsToRun = Math.max(0, Math.min(threadsFittable, g.threads))
                    let weakenThreadsToRun = Math.min(threadsFittable, w.threads)
                    // grow threads
                    if (growThreadsToRun) {
                        //args[0: script, 1: host, 2: threads, 3: target, 4: delay, 5: uuid, 6: stock]
                        this.attacks.push([g.script, server.hostname, growThreadsToRun, bestTarget.hostname, g.delay])
                        g.threads -= growThreadsToRun
                        weakenThreadsToRun -= growThreadsToRun
                    }
                    // weaken threads
                    if (weakenThreadsToRun > 0) {
                        //args[0: script, 1: host, 2: threads, 3: target, 4: delay, 5: uuid, 6: stock (ignored)]
                        this.attacks.push([w.script, server.hostname, weakenThreadsToRun, bestTarget.hostname, w.delay])
                        w.threads -= weakenThreadsToRun
                    }
                }
                break

            // spawn threads to GROW the target
            case 'grow':
                // assign threads from grow to weaken
                w.threads = w4.g(g.threads)
                g.threads -= w.threads
                // log and assign threads
                w.runThreads = w.threads
                g.runThreads = g.threads
                this.securityChangeLog = `security change: ${Math.floor((g.change * g.threads - w.change * w.threads) * 1000) / 1000}`
                for (const server of this.hackingServers) {
                    let threadsFittable = Math.max(0, Math.floor((server.maxRam - server.ramUsed) / g.ram))
                    const growThreadsToRun = Math.max(0, Math.min(threadsFittable, g.threads))
                    let weakenThreadsToRun = Math.max(0, Math.min(threadsFittable, w.threads))
                    // grow threads
                    if (growThreadsToRun) {
                        //args[0: script, 1: host, 2: threads, 3: target, 4: delay, 5: uuid, 6: stock]
                        this.attacks.push([g.script, server.hostname, growThreadsToRun, bestTarget.hostname, g.delay])
                        g.threads -= growThreadsToRun
                        weakenThreadsToRun -= growThreadsToRun
                    }
                    // weaken threads
                    if (weakenThreadsToRun > 0) {
                        //args[0: script, 1: host, 2: threads, 3: target, 4: delay, 5: uuid, 6: stock (ignored)]
                        this.attacks.push([w.script, server.hostname, weakenThreadsToRun, bestTarget.hostname, w.delay])
                        w.threads -= weakenThreadsToRun
                    }
                }
                break

            // spawn threads to HACK the target
            case 'hack':
            default:
                // if there are more hack threads than needed
                if (h.threads > bestTarget.fullHackThreads) {
                    // limit hack threads
                    h.threads = bestTarget.fullHackThreads
                    if (h.threads * 100 < g.threads) {
                        h.threads *= 10
                    }
                    // assign threads to grow/weaken
                    g.threads = Math.max(0, g.threads - Math.ceil((h.threads * h.ram) / g.ram))
                    w.threads = w4.g(g.threads) + w4.h(h.threads)
                    g.threads = Math.max(0, g.threads - w.threads)
                    h.threads = Math.max(0, h.threads - Math.ceil((w4.h(h.threads) * w.ram) / h.ram))
                } else {
                    // assign threads from hack to weaken
                    g.threads = 0
                    w.threads = w4.h(h.threads)
                    h.threads = h.threads - Math.ceil((w.threads * w.ram) / h.ram)
                }
                // log and assign threads
                w.runThreads = w.threads
                g.runThreads = g.threads
                h.runThreads = h.threads
                this.securityChangeLog = `security change: ${Math.floor((g.change * g.threads - w.change * w.threads - h.change * h.threads) * 1000) / 1000}`
                for (const server of this.hackingServers) {
                    let threadsFittable = Math.max(0, Math.floor((server.maxRam - server.ramUsed) / h.ram))
                    const hackThreadsToRun = Math.max(0, Math.min(threadsFittable, h.threads))
                    // hack threads
                    if (hackThreadsToRun) {
                        //args[0: script, 1: host, 2: threads, 3: target, 4: delay, 5: uuid, 6: stock]
                        this.attacks.push([h.script, server.hostname, hackThreadsToRun, bestTarget.hostname, h.delay])
                        h.threads -= hackThreadsToRun
                        threadsFittable -= hackThreadsToRun
                    }
                    // grow threads
                    const freeRam = (server.maxRam - server.ramUsed) - hackThreadsToRun * g.ram
                    threadsFittable = Math.max(0, Math.floor(freeRam / g.ram))
                    if (threadsFittable && g.threads) {
                        const growThreadsToRun = Math.min(g.threads, threadsFittable)
                        //args[0: script, 1: host, 2: threads, 3: target, 4: delay, 5: uuid, 6: stock]
                        this.attacks.push([g.script, server.hostname, growThreadsToRun, bestTarget.hostname, g.delay])
                        g.threads -= growThreadsToRun
                        threadsFittable -= growThreadsToRun
                    }
                    // weaken threads
                    if (threadsFittable) {
                        //args[0: script, 1: host, 2: threads, 3: target, 4: delay, 5: uuid, 6: stock (ignored)]
                        this.attacks.push([w.script, server.hostname, threadsFittable, bestTarget.hostname, w.delay])
                        w.threads -= threadsFittable
                    }
                }
                break

        }
    }

    /**
     * Gain root access on any available servers.
     *
     * @returns {Promise<void>}
     */
    async attackServer() {
        // check if we are already attacking
        if (this.attackEndsAt > new Date().getTime()) {
            return
        }
        this.ns.tprint('attackServers()...')
        // check if we need to reload data
        if (this.attackEndsAt) {
            this.attackEndsAt = null
            await this.loadPlayer()
            await this.loadServers()
        }
        // load the attacks
        await this.loadAttacks()
        // run the attacks
        for (const attack of this.attacks) {
            await this.runner.nsProxy['exec'](...attack)
        }
        // set the end time
        this.attackEndsAt = new Date().getTime() + this.hacks['weaken'].time * 1000 + 300
        // display the report
        this.ns.tprint(this.getAttackServerReport())
    }

    /**
     * Report for the attack.
     *
     * @returns {string}
     */
    getAttackServerReport() {
        const bestTarget = this.targetServers[0]
        const hacks = this.hacks,
            w = hacks['weaken'],
            g = hacks['grow'],
            h = hacks['hack']
        const report = [
            '======================',
            `|| 🖧 Attack Server ||`,
            '======================',
            '',
            `Best target is ${bestTarget.hostname} for ${this.ns.nFormat(bestTarget.hackValue, '$0.0a')}:`,
            ` -> Hack Value: ???`, // todo how we get the hackValue
            ` -> Security: ${this.ns.nFormat(bestTarget.securityLevel, '0.0000a')} / ${bestTarget.minSecurityLevel}`,
            ` -> Money: ${this.ns.nFormat(bestTarget.moneyAvailable, '$0.0a')} / ${this.ns.nFormat(bestTarget.moneyMax, '$0.0a')}`,
            ` -> Security Change: hack +${h.change} | grow +${g.change} | weaken -${w.change}`,
            ` -> Money Growth: hack -??? | grow +${this.ns.nFormat(bestTarget.serverGrowth, '$0.0a')}`,
            ` -> Max Threads (for available RAM): weaken ${w.maxThreads} | grow ${g.maxThreads} | hack ${h.maxThreads}`,
            ` -> Threads Needed to Prepare:`,
            `   -> ${this.ns.nFormat((bestTarget.securityLevel - bestTarget.minSecurityLevel) / w.change, '0a')} weaken`,
            `   -> ${this.ns.nFormat((bestTarget.moneyMax - bestTarget.moneyAvailable) / bestTarget.serverGrowth, '0a')} grow`,
            `   -> ${this.ns.nFormat(bestTarget.fullGrowThreads, '0a')} grow?`,
            `   -> ${this.ns.nFormat(bestTarget.fullHackThreads, '0a')} hack?`,
            '',
            'Attack:',
            ` -> Action: ${this.action}`,
            ` -> Duration: ${this.ns.nFormat(w.time, '00:00:00')}`,
            ` -> Memory: ${this.ns.nFormat(h.runThreads * h.ram + g.runThreads * g.ram + w.runThreads * w.ram * 1024 * 1024 * 1000, '0.00b')}`,
            ` -> Threads Run: hack ${h.runThreads} | grow ${g.runThreads} | weaken ${w.runThreads}`,
        ]
        if (this.attacks.length) {
            report.push('')
            report.push('Attacks Launched:')
            for (const a of this.attacks) {
                //args[0: script, 1: host, 2: threads, 3: target, 4: delay, 5: uuid, 6: stock]
                const baseUrl = `hbbp://${a[1]}${a[0].substr(0, 1) === '/' ? '' : '/'}${a[0]}?`
                const params = [
                    `threads=${a[2]}`,
                    `target=${a[3]}`,
                ]
                if (a[4]) params.push(`delay=${Math.round(a[4] * 1000) / 1000}`)
                if (a[5]) params.push(`uuid=${a[5]}`)
                if (a[6]) params.push(`stock=${a[6]}`)
                report.push(' -> ' + baseUrl + params.join('&'))
            }
        }

        // glue it together
        return "\n\n" + report.join("\n") + "\n\n\n"
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
            'Manages the game for the player boss.',
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