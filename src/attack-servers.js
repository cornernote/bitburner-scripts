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
        if (this.lastRun + settings.intervals['attack-servers'] > new Date().getTime()) {
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
            .filter(a => !a.start || a.start + a.end > new Date().getTime())

        // max ram allowed for an attack (90% of total ram)
        const maxAttackRam = this.hackingServers.map(s => s.maxRam).reduce((prev, next) => prev + next) * 0.9

        // get new attacks
        let attacks = []
        for (const server of this.targetServers) {
            let attack = await this.buildAttack(server)
            if (!attack) {
                continue
            }
            if (attack.ram > maxAttackRam) {
                this.ns.tprint(`${attack.target} ${attack.action} needs ${this.formatRam(attack.ram)}`)
                continue
            }
            attacks.push(attack)
        }

        // assign attacks to a server
        for (let attack of attacks) {
            attack = await this.assignAttack(attack)
            if (!attack) {
                continue
            }
            attack = await this.launchAttack(attack)
            this.attacks.push(attack)
        }

        // write the attacks to disk
        await this.ns.write('/logs/attack-servers.json.txt', JSON.stringify(this.attacks), 'a')
    }

    /**
     * Launches an attack
     *
     * @param attack
     * @returns {Promise<number>}
     */
    async launchAttack(attack) {
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
                this.ns.tprint(`WARNING! could not start command: ${JSON.stringify(command)}`)
            }
        }
        attack.start = new Date().getTime()

        // log the calculations
        const w = attack.hacks['weaken'], g = attack.hacks['grow'], h = attack.hacks['hack']
        const log = this.formatTime() + ': ' + [
            `${attack.target} ${attack.action} `,
            `h=${h.threads}/g=${g.threads}/w=${w.threads}`,
            `${this.formatDelay(attack.end)}`,
            `${this.formatRam(attack.ram)}`,
            `${this.ns.nFormat(attack.value, '$0.0a')}`,
            `existing=${this.attacks.filter(a => a.target === attack.target).length}`
        ].join(' | ')
        this.ns.tprint(log)
        await this.ns.write('/logs/attack-servers.log.txt', log + "\n", 'a')

        return attack
    }

    /**
     * Distribute the attack threads between our hacking servers
     *
     * @param attack
     * @returns {Promise<Boolean|{hacks: {}, action: string, uuid: string, value: number, start: number, commands: *[], target: any, ram: number}>}
     */
    async assignAttack(attack) {
        const w = attack.hacks['weaken'], g = attack.hacks['grow'], h = attack.hacks['hack']
        h.threadsRemaining = h.threads
        g.threadsRemaining = g.threads
        w.threadsRemaining = w.threads
        for (const server of this.hackingServers) {
            // hack threads
            let threadsFittable = Math.max(0, Math.floor((server.maxRam - server.ramUsed) / h.ram))
            const hackThreadsToRun = Math.max(0, Math.min(threadsFittable, h.threadsRemaining))
            if (hackThreadsToRun) {
                //args[0: script, 1: host, 2: threads, 3: target, 4: delay, 5: uuid, 6: stock, 7: toast]
                attack.commands.push([h.script, server.hostname, hackThreadsToRun, attack.target, h.delay, attack.uuid, false, false])
                h.threadsRemaining -= hackThreadsToRun
                server.ramUsed += hackThreadsToRun * h.ram
            }
            // grow threads
            threadsFittable = Math.max(0, Math.floor((server.maxRam - server.ramUsed) / g.ram))
            let growThreadsToRun = Math.max(0, Math.min(threadsFittable, g.threadsRemaining))
            if (growThreadsToRun) {
                //args[0: script, 1: host, 2: threads, 3: target, 4: delay, 5: uuid, 6: stock, 7: toast]
                attack.commands.push([g.script, server.hostname, growThreadsToRun, attack.target, g.delay, attack.uuid, false, false])
                g.threadsRemaining -= growThreadsToRun
                server.ramUsed += growThreadsToRun * g.ram
            }
            // weaken threads
            threadsFittable = Math.max(0, Math.floor((server.maxRam - server.ramUsed) / w.ram))
            let weakenThreadsToRun = Math.max(0, Math.min(threadsFittable, w.threadsRemaining))
            if (weakenThreadsToRun) {
                //args[0: script, 1: host, 2: threads, 3: target, 4: delay, 5: uuid, 6: stock (ignored), 7: toast]
                attack.commands.push([w.script, server.hostname, weakenThreadsToRun, attack.target, w.delay, attack.uuid, false, false])
                w.threadsRemaining -= weakenThreadsToRun
                server.ramUsed += weakenThreadsToRun * w.ram
            }
        }
        // check for overflow
        if (h.threadsRemaining || g.threadsRemaining || w.threadsRemaining) {
            this.ns.tprint(`WARNING! some threads do not fit in ram - h=${h.threadsRemaining}/g=${g.threadsRemaining}/w=${w.threadsRemaining}`)
            if (!attack.commands.length) {
                return false
            }
        }
        return attack
    }

    /**
     * Build the attack plan
     *
     * @param target
     * @returns {Promise<Boolean|{hacks: {}, action: string, uuid: string, value: number, start: number, commands: *[], target: any, ram: number}>}
     */
    async buildAttack(target) {

        // create the attack structure
        const attack = {
            uuid: this.generateUUID(),
            target: target.hostname,
            value: 0,
            ram: 0,
            start: 0,
            end: 0,
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
        //     threads:     // how many threads to run
        //     threadsRemaining:   // how many threads are remaining to be assigned ram on a server
        // }
        for (const [name, _hack] of Object.entries(this.hacks)) {
            attack.hacks[name] = {}
            attack.hacks[name].script = _hack.script
            attack.hacks[name].change = _hack.change
            attack.hacks[name].ram = _hack.ram
            //attack.hacks[name].ram = await this.nsProxy['getScriptRam'](attack.hacks[name].script)
            attack.hacks[name].time = await this.nsProxy[`get${name[0].toUpperCase()}${name.slice(1)}Time`](target.hostname)
            attack.hacks[name].delay = 0
            attack.hacks[name].threads = 0
            attack.hacks[name].threadsRemaining = 0
        }
        // expose vars for shorter code below
        const w = attack.hacks['weaken'], g = attack.hacks['grow'], h = attack.hacks['hack']

        // the server values will change after hack, until weaken, ensure this time is minimised
        h.delay = w.time - h.time - 40
        g.delay = w.time - g.time - 20
        attack.end = w.time + 20

        // check for overlapping grow/weaken attacks
        const currentPrepAttacks = this.attacks
            .filter(a => a.target === target.hostname)
            .filter(a => a.action !== 'hack')
        if (currentPrepAttacks.length) {
            return false
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

        // calculate the thread counts
        switch (attack.action) {

            // calculate threads to WEAKEN the target
            case 'weaken':
                w.threads = Math.ceil((target.hackDifficulty - target.minDifficulty) / w.change)
                break

            // calculate threads to GROW the target
            case 'grow':
                g.threads = Math.ceil(await this.nsProxy['growthAnalyze'](target.hostname, target.moneyMax / target.moneyAvailable))
                w.threads = Math.ceil((g.threads * g.change) / w.change)
                break

            // calculate threads to HACK the target
            case 'hack':
                h.threads = Math.ceil(await this.nsProxy['hackAnalyzeThreads'](target.hostname, target.moneyAvailable * settings.hackPercent))
                const hackedPercent = await this.nsProxy['hackAnalyze'](target.hostname) * h.threads
                g.threads = Math.ceil(await this.nsProxy['growthAnalyze'](target.hostname, 1 / (1 - hackedPercent)))
                w.threads = Math.ceil(h.threads * (h.change / w.change)) + Math.ceil(g.threads * (g.change / w.change)) // threads to weaken security after hack/grow
                attack.value = target.moneyAvailable * hackedPercent
                // if (!currentAttacks.length) {
                //     // note - if we have a current hack, this will be wrong because grow() and weaken() are not complete
                // } else {
                //     const currentHackAttacks = currentAttacks.filter(a => a.action === 'hack')
                //     if (currentHackAttacks.length) {
                //         let currentHackAttack = currentHackAttacks.pop()
                //         attack.value = currentHackAttack.value
                //         h.threads = currentHackAttack.hacks['hack'].threads
                //         g.threads = currentHackAttack.hacks['grow'].threads
                //         w.threads = currentHackAttack.hacks['weaken'].threads
                //     } else {
                //         throw `something went wrong, we detected a current hack, but it is not in the list...`
                //     }
                // }
                break
        }

        // calculate the attack ram usage (do not allocate ram or set commands yet)
        attack.ram = h.threads * h.ram + g.threads * g.ram + w.threads * w.ram

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
            const skillMult = (1.75 * this.player.hacking) + (0.2 * this.player.intelligence);
            const skillChance = 1 - (server.requiredHackingSkill / skillMult)
            const difficultyMult = (100 - server.minDifficulty) / 100;
            server.successChance = skillChance * difficultyMult * this.player.hacking_chance_mult;
            server.hackValue = server.moneyMax * server.successChance * settings.hackPercent
        }
        // get servers in order of hack value
        this.targetServers = this.targetServers.sort((a, b) => b.hackValue - a.hackValue)
    }

    /**
     * Format RAM as string
     *
     * @param gb
     * @returns {string}
     */
    formatRam(gb) {
        return this.ns.nFormat(gb * 1000 * 1000 * 1000, '0.0b')
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
            seconds = Math.round(Math.abs(value) - (hours * 60 * 60) - (minutes * 60))
        return (value < 0 ? '-' : '')
            + (hours ? hours + ':' : '')
            + minutes
            + ':' + (seconds < 10 ? '0' + seconds : seconds)
    }

    /**
     * Format a delay and end time
     *
     * @param delay time in milliseconds
     * @param end time in milliseconds
     * @returns {string}
     */
    formatTimes(delay, end) {
        return this.formatTime(delay) + '-' + this.formatTime(end)
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